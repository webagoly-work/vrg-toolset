package hu.vrg.mobile

import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.net.Uri
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
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.core.content.IntentCompat
import androidx.core.view.WindowCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.DeskUnit
import hu.vrg.mobile.core.HomeMode
import hu.vrg.mobile.core.Kommand
import hu.vrg.mobile.core.Orientation
import hu.vrg.mobile.core.Reach
import hu.vrg.mobile.core.Links
import hu.vrg.mobile.core.Route
import hu.vrg.mobile.drop.DropFeature
import hu.vrg.mobile.kit.Access
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.ShellSettings
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.theme.MelyvizTheme
import hu.vrg.mobile.kit.theme.Palettes
import hu.vrg.mobile.sphere.SphereFeature
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// The one Activity. It shows either the home screen or one feature, routes links and keys to the
// feature on screen, and owns everything window-wide (system bars, keep-screen-on) so a feature
// leaving never leaves its flags behind. The look (palette, size) is the shell's too (ShellSettings,
// WP M1): it is applied here, around every screen, so no feature keeps a look of its own.

class ShellActivity : ComponentActivity(), FeatureHost {

    /** The feature on screen; null = home. Compose state. */
    private var current by mutableStateOf<String?>(null)
    private var message by mutableStateOf<String?>(null)
    /** The Asztal's dock (WP M19): the features opened in this run, newest first. */
    private var windows by mutableStateOf<List<String>>(emptyList())
    /** "Irányítópult nézet" from the Asztal's menu shows the Kompakt home once, until Back. */
    private var compactPeek by mutableStateOf(false)

    private val prefs by lazy { getSharedPreferences("shell", Context.MODE_PRIVATE) }

    override val activity: ComponentActivity get() = this

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Back where the user left off (D-5): a Légegér user lands on the deck, not on a menu.
        current = savedInstanceState?.getString(KEY_CURRENT)
            ?: prefs.getString(KEY_LAST, null)?.takeIf { ShellSettings.value.startInLast && Registry.feature(it) != null }
        Melyviz.palette = Palettes.byId(ShellSettings.value.palette)
        applyOrientation(ShellSettings.value.orientation)
        windows = savedInstanceState?.getStringArrayList(KEY_WINDOWS).orEmpty()

        setContent {
            val look by ShellSettings.flow.collectAsStateWithLifecycle()
            LaunchedEffect(look.palette) { Melyviz.palette = Palettes.byId(look.palette) }
            LaunchedEffect(look.orientation) { applyOrientation(look.orientation) }
            // UI size: every screen scales together, text included
            val d = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(d.density * look.uiScale, d.fontScale)) { MelyvizTheme {
                LaunchedEffect(Unit) { snapshotFlow { Melyviz.palette }.collect { applyBars() } }
                Box(Modifier.fillMaxSize().background(Melyviz.water)) {
                    val id = current
                    val feature = Registry.feature(id)
                    if (Access.locked && id !in LOCK_OPEN) {
                        LockScreen(onOpen = ::open)
                    } else if (feature != null) {
                        BackHandler { home() }
                        DisposableEffect(id) { onDispose { keepScreenOn(false) } }
                        Box(Modifier.fillMaxSize().systemBarsPadding()) { feature.Screen(this@ShellActivity) }
                    } else {
                        val planned = Catalogue.byId(id)
                        if (planned != null) {
                            BackHandler { home() }
                            PlannedScreen(planned, onBack = ::home)
                        } else {
                            HomePages(look.home)
                        }
                    }
                    Note(message, Modifier.align(Alignment.BottomCenter))
                }
            } }
        }
        handleLink(intent)
    }

    /** Home, and the Gömb one swipe to its right (WP M14). The sphere's own drags stay inside its disc. */
    @Composable
    private fun HomePages(mode: HomeMode) {
        val pages = rememberPagerState { 2 }
        val scope = rememberCoroutineScope()
        val toHome: () -> Unit = { scope.launch { pages.animateScrollToPage(0) } }
        BackHandler(pages.currentPage != 0, toHome)
        HorizontalPager(pages, Modifier.fillMaxSize()) { page ->
            if (page != 0) Box(Modifier.fillMaxSize().systemBarsPadding()) { SphereFeature.Page(back = toHome, signIn = { open(Catalogue.ACCOUNT.id) }) }
            else if (mode == HomeMode.COMPACT || compactPeek) {
                BackHandler(compactPeek) { compactPeek = false }
                HomeScreen(onOpen = ::open)
            } else DeskScreen(windows, desk)
        }
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

    // ---- the Asztal (WP M19) ------------------------------------------------------------------------

    private val desk = DeskActions(open = ::open, openUnit = ::openUnit, runKommand = ::runKommand,
        cycleOrientation = { ShellSettings.update { it.copy(orientation = it.orientation.next()) }.also { note("Tájolás: " + ShellSettings.value.orientation.label) } })

    private fun applyOrientation(o: Orientation) {
        requestedOrientation = when (o) {
            Orientation.AUTO -> ActivityInfo.SCREEN_ORIENTATION_FULL_USER
            Orientation.PORTRAIT -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            Orientation.LANDSCAPE -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        }
    }

    /** A Desktop unit from the ◣ menu or Kommand: the phone's feature, an M21 app, the relay's side, or why not. */
    private fun openUnit(u: DeskUnit) {
        when (u.reach) {
            Reach.NATIVE -> when (u.target) {
                "desk" -> { compactPeek = false; note("Ez az Asztal.") }
                "kompakt" -> compactPeek = true
                "kommand" -> note("A Kommand a felső sávban van.")
                "browser" -> browse("https://www.google.com/")
                else -> open(u.target)
            }
            Reach.WEBAPP -> openRoute(Route(Catalogue.APPS.id, u.target))
            Reach.PC -> if (u.target.startsWith("port:")) open(Catalogue.PORTS.id) else open(u.target)
            Reach.NONE -> if (u.id == "mail") mailApp() else note("${u.hu}: ${u.target}")
        }
    }

    private fun runKommand(id: String) {
        if (id.startsWith("url:")) { browse(id.removePrefix("url:")); return }
        ShellSettings.update { it.copy(kommandRecent = Kommand.remember(it.kommandRecent, id)) }
        when {
            id.startsWith("win:") -> open(id.removePrefix("win:"))
            id.startsWith("feat:") -> open(id.removePrefix("feat:"))
            id.startsWith("cat:") -> hu.vrg.mobile.core.DeskCatalog.UNITS.firstOrNull { it.id == id.removePrefix("cat:") }?.let(::openUnit)
        }
    }

    private fun openRoute(r: Route) {
        open(r.feature)
        Registry.feature(r.feature)?.open(r)
    }

    private fun browse(url: String) {
        try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } catch (e: Exception) { note("Nincs böngésző a telefonon.") }
    }

    private fun mailApp() {
        try { startActivity(Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_EMAIL).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        catch (e: Exception) { note("Posta: nincs levelezőalkalmazás a telefonon.") }
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
        if (featureId == Catalogue.DESK.id) {   // the Asztal is the home itself; from Kompakt its tile makes it the home
            home(); compactPeek = false
            if (ShellSettings.value.home != HomeMode.DESK) { ShellSettings.update { it.copy(home = HomeMode.DESK) }; note("Kezdőlap: Asztal (Beállításokban visszaváltható)") }
            return
        }
        if (featureId == current) return
        Registry.feature(current)?.onForeground(false)
        current = featureId
        val f = Registry.feature(featureId)
        if (f != null) {
            windows = (listOf(featureId) + windows.filter { it != featureId }).take(MAX_WINDOWS)
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
        // "Megosztás → PC-re" (the ShareToPc alias): files to the PC's board, text to its clipboard (Átadás, M12)
        if (i != null && i.component?.className?.endsWith(".ShareToPc") == true &&
            (i.action == Intent.ACTION_SEND || i.action == Intent.ACTION_SEND_MULTIPLE)) {
            val uris = if (i.action == Intent.ACTION_SEND_MULTIPLE)
                IntentCompat.getParcelableArrayListExtra(i, Intent.EXTRA_STREAM, Uri::class.java).orEmpty()
            else listOfNotNull(IntentCompat.getParcelableExtra(i, Intent.EXTRA_STREAM, Uri::class.java))
            open(Catalogue.DROP.id)
            DropFeature.share(uris, i.getStringExtra(Intent.EXTRA_TEXT))
            return
        }
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
        outState.putStringArrayList(KEY_WINDOWS, ArrayList(windows))
    }

    private companion object {
        const val KEY_CURRENT = "current"
        const val KEY_LAST = "last"
        const val KEY_WINDOWS = "windows"
        const val MAX_WINDOWS = 8
    }
}
