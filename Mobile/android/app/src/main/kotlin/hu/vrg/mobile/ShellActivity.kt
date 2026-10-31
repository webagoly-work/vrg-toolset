package hu.vrg.mobile

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.KeyEvent
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.Links
import hu.vrg.mobile.core.Route
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.ShellSettings
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.theme.MelyvizTheme
import hu.vrg.mobile.kit.theme.Palettes
import kotlinx.coroutines.delay

// The one Activity. It shows either the home screen or one feature, routes links and keys to the
// feature on screen, and owns everything window-wide (system bars, keep-screen-on) so a feature
// leaving never leaves its flags behind. The look (palette, size) is the shell's too (ShellSettings,
// WP M1): it is applied here, around every screen, so no feature keeps a look of its own.

class ShellActivity : ComponentActivity(), FeatureHost {

    /** The feature on screen; null = home. Compose state. */
    private var current by mutableStateOf<String?>(null)
    private var message by mutableStateOf<String?>(null)

    private val prefs by lazy { getSharedPreferences("shell", Context.MODE_PRIVATE) }

    override val activity: ComponentActivity get() = this

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Back where the user left off (D-5): a Légegér user lands on the deck, not on a menu.
        current = savedInstanceState?.getString(KEY_CURRENT)
            ?: prefs.getString(KEY_LAST, null)?.takeIf { ShellSettings.value.startInLast && Registry.feature(it) != null }
        Melyviz.palette = Palettes.byId(ShellSettings.value.palette)

        setContent {
            val look by ShellSettings.flow.collectAsStateWithLifecycle()
            LaunchedEffect(look.palette) { Melyviz.palette = Palettes.byId(look.palette) }
            // UI size: every screen scales together, text included
            val d = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(d.density * look.uiScale, d.fontScale)) { MelyvizTheme {
                LaunchedEffect(Unit) { snapshotFlow { Melyviz.palette }.collect { applyBars() } }
                Box(Modifier.fillMaxSize().background(Melyviz.water)) {
                    val id = current
                    val feature = Registry.feature(id)
                    if (feature != null) {
                        BackHandler { home() }
                        DisposableEffect(id) { onDispose { keepScreenOn(false) } }
                        Box(Modifier.fillMaxSize().systemBarsPadding()) { feature.Screen(this@ShellActivity) }
                    } else {
                        val planned = Catalogue.byId(id)
                        if (planned != null) {
                            BackHandler { home() }
                            PlannedScreen(planned, onBack = ::home)
                        } else {
                            HomeScreen(onOpen = ::open)
                        }
                    }
                    Note(message, Modifier.align(Alignment.BottomCenter))
                }
            } }
        }
        handleLink(intent)
    }

    @Composable
    private fun Note(text: String?, modifier: Modifier) {
        if (text == null) return
        LaunchedEffect(text) { delay(3500); if (message == text) message = null }
        Text(
            text, style = Melyviz.label,
            modifier = modifier.systemBarsPadding().padding(16.dp)
                .background(Melyviz.raised, RoundedCornerShape(Melyviz.radiusSmall))
                .padding(horizontal = 14.dp, vertical = 10.dp),
        )
    }

    private fun applyBars() {
        val p = Melyviz.palette
        @Suppress("DEPRECATION")
        window.statusBarColor = p.abyss.toArgb()
        @Suppress("DEPRECATION")
        window.navigationBarColor = p.abyss.toArgb()
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = p.light
            isAppearanceLightNavigationBars = p.light
        }
    }

    // ---- FeatureHost -------------------------------------------------------------------------------

    override fun keepScreenOn(on: Boolean) {
        if (on) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    override fun home() {
        Registry.feature(current)?.onForeground(false)
        current = null
        prefs.edit().remove(KEY_LAST).apply()
    }

    override fun open(featureId: String) {
        if (featureId == current) return
        Registry.feature(current)?.onForeground(false)
        current = featureId
        val f = Registry.feature(featureId)
        if (f != null) {
            prefs.edit().putString(KEY_LAST, featureId).apply()
            f.onForeground(true)
        }
    }

    override fun note(text: String) { message = text }

    // ---- links, keys, lifecycle --------------------------------------------------------------------

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleLink(intent)
    }

    private fun handleLink(i: Intent?) {
        // "Megosztás → VRG Mobile" with text from any app: a quick note (Gyorsjegyzet, M6)
        if (i?.action == Intent.ACTION_SEND && i.type?.startsWith("text/") == true) {
            val text = i.getStringExtra(Intent.EXTRA_TEXT) ?: return
            val r = Route(Catalogue.NOTES.id, "new", mapOf("text" to text))
            open(r.feature)
            Registry.feature(r.feature)?.open(r)
            return
        }
        val link = i?.dataString ?: return
        val r = Links.route(link)
        if (r == null) { note("Ismeretlen link: $link"); return }
        open(r.feature)
        val f = Registry.feature(r.feature)
        if (f != null && !f.open(r) && r.path.isNotEmpty()) note("${f.info.title}: ezt a linket nem ismeri")
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean =
        Registry.feature(current)?.onKey(event) == true || super.dispatchKeyEvent(event)

    override fun onResume() {
        super.onResume()
        Registry.feature(current)?.onForeground(true)
        Registry.built.forEach { it.onAppVisible() }
    }

    override fun onPause() {
        Registry.feature(current)?.onForeground(false)
        super.onPause()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putString(KEY_CURRENT, current)
    }

    private companion object {
        const val KEY_CURRENT = "current"
        const val KEY_LAST = "last"
    }
}
