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
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
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
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.core.content.IntentCompat
import androidx.core.view.WindowCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.Cell
import hu.vrg.mobile.core.PhoneSheets
import hu.vrg.mobile.core.Sheets
import hu.vrg.mobile.core.SheetsDoc
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
import hu.vrg.mobile.kit.ui.VarlerWatermark
import hu.vrg.mobile.kit.theme.MelyvizTheme
import hu.vrg.mobile.kit.theme.Palettes
import hu.vrg.mobile.sphere.SphereFeature
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import hu.vrg.mobile.core.HomeLayout
import hu.vrg.mobile.pair.PairFeature

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
    /** "Irányítópult nézet" from the Asztal's menu shows the home as one long page once, until Back (WP M38). */
    private var compactPeek by mutableStateOf(false)
    /** The Katalógus on screen (WP M38): the id of the page it opened at ("" = the first); null = not shown. */
    private var catalogAt by mutableStateOf<String?>(null)
    /** The feature a Lapok window shows full (WP M20); keys and the foreground go to it while no feature has the screen. */
    private var sheetFull by mutableStateOf<String?>(null)

    private val prefs by lazy { getSharedPreferences("shell", Context.MODE_PRIVATE) }

    override val activity: ComponentActivity get() = this

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Back where the user left off (D-5): a Légegér user lands on the deck, not on a menu.
        current = savedInstanceState?.getString(KEY_CURRENT)
            ?: prefs.getString(KEY_LAST, null)?.takeIf { ShellSettings.value.startInLast && Registry.feature(it) != null }
        Melyviz.palette = Palettes.byId(ShellSettings.value.palette)
        applyOrientation(ShellSettings.value.orientation)
        SheetsStore.init(this)
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
                        // imePadding: edge-to-edge (targetSdk 35) no longer resizes the window for the keyboard (UI audit 4.4)
                        Box(Modifier.fillMaxSize().systemBarsPadding().imePadding()) { feature.Screen(this@ShellActivity) }
                    } else {
                        val planned = Catalogue.byId(id)
                        val at = catalogAt
                        if (at != null) {
                            BackHandler { catalogAt = null }
                            Box(Modifier.fillMaxSize().systemBarsPadding()) {
                                CatalogScreen(at, onBack = { catalogAt = null }, onOpen = { fid -> catalogAt = null; open(fid) })
                            }
                        } else if (planned != null) {
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
        val sheets by SheetsStore.flow.collectAsStateWithLifecycle()
        // a sheet's windows have drags of their own (move, resize, a full feature's touchpad): no page swipe while a sheet
        // is up; the paged home swipes its own pages (Gömb is on its page 7), so only the one long page swipes to Gömb
        val list = mode == HomeMode.COMPACT || compactPeek
        val onSheet = sheets.active.isNotEmpty()
        HorizontalPager(pages, Modifier.fillMaxSize(), userScrollEnabled = !onSheet && (list || pages.currentPage != 0)) { page ->
            if (page != 0) Box(Modifier.fillMaxSize().systemBarsPadding()) { SphereFeature.Page(back = toHome, signIn = { open(Catalogue.ACCOUNT.id) }) }
            else Box(Modifier.fillMaxSize()) {
                VarlerWatermark()        // the Varler mark, faint, in the palette's glow, behind both homes
                BackHandler(compactPeek) { compactPeek = false }
                Desk(sheets, list)
            }
        }
    }

    /** The Asztal with its Lapok (WP M20): the tabs in the top strip, the active sheet in the sheet area, the panels over it. */
    @Composable
    private fun Desk(sheets: SheetsDoc, list: Boolean) {
        var pickAt by remember { mutableStateOf<Cell?>(null) }
        var picking by remember { mutableStateOf(false) }
        var adding by remember { mutableStateOf(false) }
        var menuFor by remember { mutableStateOf<String?>(null) }
        Box(Modifier.fillMaxSize()) {
            DeskScreen(
                windows, desk, list,
                sheetArea = if (Sheets.phone.sheetOf(sheets, sheets.active) == null) null
                else { m -> SheetArea(m, sheets, sheetsHost) { c -> pickAt = c; picking = true } },
                tabs = { SheetTabs(sheets, onAdd = { adding = true }, onMenu = { menuFor = it }, onHomeLong = ::toggleHomeView, modifier = Modifier.weight(1f, fill = false)) },
            )
            if (picking) SheetPicker(pickAt) { picking = false }
            if (adding) NewSheetPanel(sheets) { adding = false }
            menuFor?.let { SheetMenu(sheets, it) { menuFor = null } }
        }
    }

    private val sheetsHost by lazy { SheetsHost(this, current = { current }, onFull = { sheetFull = it }) }

    @Composable
    private fun Note(text: String?, modifier: Modifier) {
        if (text == null) return
        // read out by TalkBack, above the dock, a little longer, and a tap puts it away (UI audit 6.5, 8.5)
        LaunchedEffect(text) { delay(6000); if (message == text) message = null }
        Text(
            text, style = Melyviz.label,
            modifier = modifier.systemBarsPadding().padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 72.dp)
                .background(Melyviz.raised, RoundedCornerShape(Melyviz.radiusSmall))
                .clickable(onClickLabel = "elrejtés") { if (message == text) message = null }
                .semantics { liveRegion = LiveRegionMode.Polite }
                .padding(horizontal = 14.dp, vertical = 10.dp),
        )
    }

    // ---- the Asztal (WP M19) ------------------------------------------------------------------------

    private val desk = DeskActions(open = ::open, openUnit = ::openUnit, runKommand = ::runKommand,
        cycleOrientation = { ShellSettings.update { it.copy(orientation = it.orientation.next()) }.also { note("Tájolás: " + ShellSettings.value.orientation.label) } },
        // the dock's RCO: a window leaves the bar (the dock only shows on the Asztal, so none of them is on screen)
        closeWindow = { id -> windows = windows - id },
        closeOthers = { keep -> windows = windows.filter { it == keep } },
        openApp = { id -> openRoute(Route(Catalogue.APPS.id, id)) },
        describe = { id -> catalogAt = id },
        scan = { PairFeature.scan(); open(Catalogue.PAIR.id) })

    /** A long press on ⌂ (WP M38): the swiped pages ⇄ one long page, the same order. Kept as the Kezdőlap setting. */
    private fun toggleHomeView() {
        compactPeek = false
        val next = if (ShellSettings.value.home == HomeMode.DESK) HomeMode.COMPACT else HomeMode.DESK
        ShellSettings.update { it.copy(home = next) }
        note("Kezdőlap: " + next.label.lowercase())
    }

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
            Reach.PC -> when {
                u.target.startsWith("port:") -> open(Catalogue.PORTS.id)
                // a PC folder unit (M23): PC ablakok at the unit's own folder (Munkák → Full\jobs, …), else at the roots
                u.target == Catalogue.PCWIN.id && u.id in hu.vrg.mobile.core.PcFiles.PLACES -> openRoute(Route(u.target, u.id))
                else -> open(u.target)
            }
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
        catalogAt = null
        if (featureId == Catalogue.DESK.id) {   // the Asztal is the home itself
            home(); compactPeek = false
            return
        }
        if (featureId == Catalogue.CATALOG.id) { home(); catalogAt = ""; return }   // WP M38: a shell screen over the home
        HomeLayout.SHORTCUTS[featureId]?.let { apps ->   // WP M38: a home tile for web apps of Alkalmazások
            if (apps.size == 1) openRoute(Route(Catalogue.APPS.id, apps[0])) else openRoute(Route(Catalogue.APPS.id))
            return
        }
        if (featureId == Catalogue.DEVLAP.id) {   // M66: the home's DevLap tile shows the DevLap sheet (the open one, or a new one)
            open(Catalogue.DESK.id)
            val d = SheetsStore.value
            if (d.sheets.none { it.name == Catalogue.DEVLAP.title } && d.sheets.size >= Sheets.MAX_SHEETS)
                note("Nincs hely új lapnak (legfeljebb ${Sheets.MAX_SHEETS}). Zárj be egy lapot.")
            else SheetsStore.update { PhoneSheets.openDevLap(it) }
            return
        }
        if (featureId == Catalogue.SHEETS.id) {   // Lapok lives in the Asztal: show a sheet (the first one, or a new blank one)
            open(Catalogue.DESK.id)
            SheetsStore.update { d ->
                if (d.sheets.isEmpty()) Sheets.phone.addSheet(d, "Lap")
                else if (d.active.isEmpty()) Sheets.phone.activate(d, d.sheets.first().id) else d
            }
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
        // "Megosztás → VRG Mobile" with text from any app: a note in VRG Jegyzetek (M68), origin Megosztás
        if (i?.action == Intent.ACTION_SEND && i.type?.startsWith("text/") == true) {
            val text = i.getStringExtra(Intent.EXTRA_TEXT) ?: return
            val r = Route(Catalogue.NOTES.id, "new", mapOf("text" to text, "from" to "megosztas"))
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
        Registry.feature(current ?: sheetFull)?.onKey(event) == true || super.dispatchKeyEvent(event)

    override fun onResume() {
        super.onResume()
        Registry.feature(current ?: sheetFull)?.onForeground(true)
        Registry.built.forEach { it.onAppVisible() }
    }

    override fun onPause() {
        Registry.feature(current ?: sheetFull)?.onForeground(false)
        super.onPause()
    }

    /** Leaving the screen: the home-screen icon takes the palette's colours (switched here, not while choosing). */
    override fun onStop() {
        LauncherIcon.apply(this, ShellSettings.value.palette)
        super.onStop()
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
