package hu.vrg.mobile

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.DeskApps
import hu.vrg.mobile.core.FeatureInfo
import hu.vrg.mobile.core.HomeLayout
import hu.vrg.mobile.core.HomePage
import hu.vrg.mobile.core.MiniStatus
import hu.vrg.mobile.core.PhoneSheets
import hu.vrg.mobile.core.Sheets
import hu.vrg.mobile.kit.Trust
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.theme.vrgBorder
import hu.vrg.mobile.kit.ui.InstallQrPanel
import hu.vrg.mobile.kit.ui.Mini
import hu.vrg.mobile.kit.ui.MiniSize
import hu.vrg.mobile.kit.ui.RcoItem
import hu.vrg.mobile.kit.ui.RcoMenu
import hu.vrg.mobile.kit.ui.rco
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import hu.vrg.mobile.core.FeatureIcons
import hu.vrg.mobile.kit.ui.PixelIcon
import androidx.compose.ui.graphics.Color

// The home (WP M38, D-47): HomeLayout's numbered pages, swiped sideways under a strip of their names, or all of them
// on one long page (a long press on ⌂ switches). The top bar and the dock around it are the Asztal's (DeskScreen) and
// stay on screen on every page. A page with up to three entries draws them as big cards, a longer one as an icon grid.

/** What a home needs from whoever shows it (the Asztal, or a Lapok window holding the home). */
class HomeActions(
    val open: (String) -> Unit,
    /** Opens one web app of Alkalmazások by its app id (the Kalkulátorok and Készlet picks). */
    val openApp: (String) -> Unit,
    /** Opens the Katalógus at a feature's page; null hides "Leírás". */
    val describe: ((String) -> Unit)? = null,
)

/** The page the home was on, kept while the app runs (opening a feature takes the home out of composition). */
private var lastPage = 0

/** A feature's MINI ring state (WP M16), idle when it has none. */
@Composable
internal fun ringOf(f: FeatureInfo): MiniStatus =
    Registry.feature(f.id)?.activity?.collectAsStateWithLifecycle()?.value ?: MiniStatus.IDLE

/** The home: paged ([list] false) or one long page ([list] true), in HomeLayout's order. */
@Composable
internal fun HomeWindow(modifier: Modifier, act: HomeActions, list: Boolean) {
    BoxWithConstraints(modifier.padding(horizontal = 10.dp)) {
        val landscape = maxWidth > maxHeight
        val cols = HomeLayout.columns(landscape && maxWidth >= 560.dp)
        if (list) {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(bottom = 12.dp)) {
                HomeLayout.PAGES.forEach { p -> PageHeader(p); PageBody(p, act, cols, landscape) }
            }
        } else PagedHome(act, cols, landscape)
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun PagedHome(act: HomeActions, cols: Int, landscape: Boolean) {
    val pages = HomeLayout.PAGES
    val pager = rememberPagerState(initialPage = lastPage.coerceIn(0, pages.lastIndex)) { pages.size }
    val scope = rememberCoroutineScope()
    LaunchedEffect(pager.currentPage) { lastPage = pager.currentPage }
    // the strip follows the pager: after a swipe to page 6-8 the lit chip was off-screen (UI audit 3.7)
    val chips = remember(pages.size) { List(pages.size) { BringIntoViewRequester() } }
    LaunchedEffect(pager.currentPage) { chips.getOrNull(pager.currentPage)?.bringIntoView() }
    Column(Modifier.fillMaxSize()) {
        // the page strip: every page's number and short name; the current one lit and bold, a tap jumps there.
        // Each pill keeps its 32 dp look inside a 48 dp touch slot (UI audit 1.1).
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(vertical = 2.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            pages.forEachIndexed { i, p ->
                val on = i == pager.currentPage
                Box(Modifier.bringIntoViewRequester(chips[i]).heightIn(min = 48.dp)
                    .clickable(role = Role.Tab) { scope.launch { pager.animateScrollToPage(i) } }
                    .semantics { selected = on; contentDescription = "${p.n}. oldal: ${p.title}" },
                    contentAlignment = Alignment.Center) {
                    Text("${p.n} ${p.short}", style = Melyviz.small.copy(fontSize = 11.sp, color = if (on) Melyviz.glow else Melyviz.muted,
                        fontWeight = if (on) FontWeight.Bold else FontWeight.Normal), maxLines = 1,
                        modifier = Modifier.heightIn(min = 32.dp).background(if (on) Melyviz.raised else Melyviz.surface.copy(alpha = .6f), RoundedCornerShape(16.dp))
                            .vrgBorder(1.dp, if (on) Melyviz.glow else Melyviz.lineSoft, RoundedCornerShape(16.dp))
                            .clearAndSetSemantics { }
                            .padding(horizontal = 10.dp, vertical = 7.dp))
                }
            }
        }
        HorizontalPager(pager, Modifier.weight(1f).fillMaxWidth(), key = { pages[it].n }) { i ->
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(bottom = 12.dp)) {
                PageHeader(pages[i])
                PageBody(pages[i], act, cols, landscape)
            }
        }
    }
}

@Composable
private fun PageHeader(p: HomePage) {
    Text("${p.n} · ${p.title.uppercase()}", style = Melyviz.small.copy(letterSpacing = 1.4.sp, color = Melyviz.glowDim),
        modifier = Modifier.padding(top = 12.dp, bottom = 6.dp))
}

@Composable
private fun PageBody(p: HomePage, act: HomeActions, cols: Int, landscape: Boolean) {
    if (p.cards) {
        // big cards: one a row upright, side by side lying down
        val perRow = if (landscape) p.items.size else 1
        p.items.chunked(perRow).forEach { row ->
            Row(Modifier.fillMaxWidth().padding(bottom = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                row.forEach { f -> FeatureCard(f, act, Modifier.weight(1f)) }
            }
        }
    } else {
        p.items.chunked(cols).forEach { row ->
            Row(Modifier.fillMaxWidth()) {
                row.forEach { f -> FeatureRco(f, act, Modifier.weight(1f)) { inner -> HomeIcon(f, inner) } }
                repeat(cols - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
    // the install QR for other phones sits with the account and devices, on the owner's phone only (D-44)
    if (p.items.any { it.id == Catalogue.DEVICES.id }) OwnerInstallButton(Modifier.padding(top = 10.dp))
}

/** A big card: the MINI ring, the title, the blurb, its stage; plugin chips (Fotópont on the Sketcher); the survey count on the Sketcher. */
@Composable
private fun FeatureCard(f: FeatureInfo, act: HomeActions, modifier: Modifier) {
    val built = Registry.isBuilt(f)
    val shape = RoundedCornerShape(Melyviz.radius)
    val apps = HomeLayout.SHORTCUTS[f.id].orEmpty()
    var pick by remember { mutableStateOf(false) }
    val sketch = f.id == Catalogue.SKETCH.id
    val count = if (sketch) sketchCount() else null
    val countLabel = HomeLayout.sketchCountLabel(count) ?: if (f.id == Catalogue.WEATHER.id) weatherLine() else null   // WP M44
    // a tile with several apps (Kalkulátorok, Készlet) offers them; any other opens its feature
    val tap: () -> Unit = { if (apps.size > 1) pick = true else act.open(f.id) }
    FeatureRco(f, act, modifier, onTap = tap) { inner ->
        Box {
            Column(
                inner.heightIn(min = 96.dp)
                    .background(if (built) Melyviz.raised else Melyviz.surface.copy(alpha = .7f), shape)
                    .vrgBorder(BorderStroke(if (sketch) 1.5.dp else 1.dp, if (built) (if (sketch) Melyviz.glow else Melyviz.glowDim) else Melyviz.lineSoft), shape)
                    .padding(horizontal = 14.dp, vertical = 12.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Mini(f.glyph, f.title, ringOf(f), size = MiniSize.MD, tint = glyphTint(f, built), quietIdle = true, pixel = FeatureIcons.of(f))
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(f.title.uppercase(), style = Melyviz.title.copy(fontSize = 15.sp, color = if (built) Melyviz.ink else Melyviz.muted, letterSpacing = 1.sp),
                            maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(f.blurb, style = Melyviz.small.copy(fontSize = 11.sp), maxLines = 2, overflow = TextOverflow.Ellipsis)
                        if (countLabel != null) Text(countLabel, style = Melyviz.readout.copy(fontSize = 11.sp,
                            color = if (count == 0) Melyviz.muted else Melyviz.sand), maxLines = 1, modifier = Modifier.padding(top = 2.dp))
                        if (apps.size > 1) Text(apps.mapNotNull { id -> DeskApps.ALL.firstOrNull { it.id == id }?.hu }.joinToString(" · "),
                            style = Melyviz.readout.copy(fontSize = 10.sp), maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 2.dp))
                    }
                    StageBadge(f.stage)
                    Text("›", style = Melyviz.title.copy(color = if (built) Melyviz.glow else Melyviz.faint), modifier = Modifier.padding(start = 8.dp))
                }
                HomeLayout.PLUGINS[f.id]?.let { plugins ->
                    Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        plugins.forEach { p -> PluginChip(p) { act.open(p.id) } }
                    }
                }
            }
            RcoMenu(pick, { pick = false }, f.title, apps.mapNotNull { id ->
                DeskApps.ALL.firstOrNull { it.id == id }?.let { a -> RcoItem("▣", a.hu) { act.openApp(a.id) } }
            })
        }
    }
}

/** VRG Időjárás's last summary (WP M44), read from its file each time the home is shown; off the main thread. */
@Composable
private fun weatherLine(): String? {
    val ctx = LocalContext.current
    val line by produceState<String?>(null) {
        value = withContext(Dispatchers.IO) {
            try { HomeLayout.weatherLine(File(ctx.filesDir, HomeLayout.WEATHER_SUMMARY).takeIf { it.exists() }?.readText(), System.currentTimeMillis()) }
            catch (e: Exception) { null }
        }
    }
    return line
}

/** The Sketcher's surveys on the phone, counted from its folder each time the home is shown; off the main thread. */
@Composable
private fun sketchCount(): Int? {
    val ctx = LocalContext.current
    val n by produceState<Int?>(null) {
        value = withContext(Dispatchers.IO) {
            try { File(ctx.filesDir, HomeLayout.SKETCH_DIR).list()?.count { HomeLayout.isSketchFile(it) } ?: 0 }
            catch (e: SecurityException) { null }
        }
    }
    return n
}

@Composable
private fun PluginChip(f: FeatureInfo, onClick: () -> Unit) {
    val shape = RoundedCornerShape(50)
    Row(
        Modifier.heightIn(min = 40.dp).background(Melyviz.surface, shape).vrgBorder(1.dp, Melyviz.glowDim, shape)
            .clickable(onClick = onClick).semantics { role = Role.Button; contentDescription = f.title }
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val px = FeatureIcons.of(f)
        if (px != null) PixelIcon(px, 18.dp) else Text(f.glyph, style = Melyviz.glyph.copy(fontSize = 15.sp, color = Melyviz.glow))
        Spacer(Modifier.width(6.dp))
        Text(f.title, style = Melyviz.label.copy(fontSize = 12.sp, color = Melyviz.ink), maxLines = 1)
    }
}

/**
 * The colour of a feature's glyph on the home (Fényjel R1): a built feature with a pixel glyph wears its family colour
 * (null = the glyph's own), a text glyph keeps the palette's glow, and a planned feature stays grey either way.
 */
internal fun glyphTint(f: FeatureInfo, built: Boolean): Color? = when {
    !built -> Melyviz.faint
    FeatureIcons.of(f) != null -> null
    else -> Melyviz.glow
}

/** A grid page's icon (the tap and the RCO come in with [modifier]). */
@Composable
private fun HomeIcon(f: FeatureInfo, modifier: Modifier) {
    val built = Registry.isBuilt(f)
    Column(modifier.padding(vertical = 8.dp, horizontal = 2.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(50.dp).background(if (built) Melyviz.raised else Melyviz.surface.copy(alpha = 0.6f), RoundedCornerShape(12.dp))
            .vrgBorder(BorderStroke(1.dp, if (built) Melyviz.glowDim else Melyviz.lineSoft), RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
            Mini(f.glyph, f.title, ringOf(f), size = MiniSize.SM, tint = glyphTint(f, built), quietIdle = true, pixel = FeatureIcons.of(f))
        }
        Text(f.title, style = Melyviz.small.copy(fontSize = 10.sp, color = if (built) Melyviz.ink else Melyviz.muted), maxLines = 1,
            overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 4.dp))
    }
}

/**
 * Puts a feature in a window on a Lapok sheet (the home's RCO): on the active sheet when it has a free cell,
 * otherwise on a new sheet named after the feature. Returns what to tell the user.
 */
internal fun openOnSheet(f: FeatureInfo): String {
    val r = PhoneSheets.resolve("feat:${f.id}") ?: return "${f.title}: lapon nem nyitható."
    val p = Sheets.phone
    var placed = false
    SheetsStore.update { d0 ->
        val onActive = if (p.sheetOf(d0, d0.active) != null) p.openWin(d0, d0.active, p.newPaneId(d0, r.kind), r.kind, r.open!!, r.state) else d0
        if (onActive != d0) { placed = true; return@update onActive }
        val d1 = p.addSheet(d0, f.title)
        if (d1 == d0) return@update d0
        val d2 = p.openWin(d1, d1.active, p.newPaneId(d1, r.kind), r.kind, r.open!!, r.state)
        placed = d2 != d1
        if (placed) d2 else d0
    }
    return if (placed) "${f.title}: lapon." else "Nincs hely új lapnak (legfeljebb ${Sheets.MAX_SHEETS})."
}

/**
 * A home entry with its RCO (long press): Megnyitás, Leírás (the Katalógus page), Megnyitás lapon (a built feature that
 * can be a window). [modifier] is the cell's (its weight); [onTap] is what a tap does (open the feature, or a card's pick
 * of apps); [content] draws the card or the icon with the modifier it is given, which carries the tap and the long press.
 */
@Composable
internal fun FeatureRco(f: FeatureInfo, act: HomeActions, modifier: Modifier, onTap: () -> Unit = { act.open(f.id) }, content: @Composable (Modifier) -> Unit) {
    var menu by remember { mutableStateOf(false) }
    var said by remember { mutableStateOf<String?>(null) }
    Column(modifier) {
        Box {
            content(Modifier.fillMaxWidth().rco(onClick = onTap, onLong = { menu = true }))
            // F4 (WP M49): the Sketcher's variants sit under its own Megnyitás (a new survey in one, ⟳, ＋ request)
            val extra = if (f.id == Catalogue.SKETCH.id) hu.vrg.mobile.sketch.ui.sketcherRcoItems(open = { act.open(f.id) }, say = { said = it }) else emptyList()
            RcoMenu(menu, { menu = false }, f.title, listOfNotNull(
                RcoItem(f.glyph, "Megnyitás", pixel = FeatureIcons.of(f)) { onTap() },
                act.describe?.let { d -> RcoItem("📖", "Leírás") { d(f.id) } },
                if (Registry.isBuilt(f) && PhoneSheets.isWindow(f.id)) RcoItem("▦", "Megnyitás lapon") { said = openOnSheet(f) } else null,
            ) + extra)
        }
        said?.let { text ->
            LaunchedEffect(text) { delay(2500); said = null }
            Text(text, style = Melyviz.small.copy(fontSize = 10.sp, color = Melyviz.sand), maxLines = 2)
        }
    }
}

/**
 * The install QR (D-44) on the home: a slim button on the account page, drawn only on the owner's own phone (this phone
 * is the trusted list's owner entry; the list is cached, so it shows from the start). It opens the same panel as
 * Eszközök in a dialog.
 */
@Composable
internal fun OwnerInstallButton(modifier: Modifier = Modifier) {
    val list by Trust.list.collectAsStateWithLifecycle()
    if (list == null || !Trust.isOwner) return
    var open by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(Melyviz.radiusSmall)
    Row(
        modifier.fillMaxWidth().heightIn(min = 48.dp).background(Melyviz.surface, shape).vrgBorder(1.dp, Melyviz.lineSoft, shape)
            .clickable { open = true }.semantics { role = Role.Button; contentDescription = "Telepítő QR másik telefonra" }
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("▦", style = Melyviz.glyph.copy(fontSize = 18.sp, color = Melyviz.glow))
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text("Telepítő QR", style = Melyviz.label.copy(color = Melyviz.ink))
            Text("másik telefonra · csak neked látszik", style = Melyviz.small.copy(fontSize = 10.sp), maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Text("›", style = Melyviz.title.copy(color = Melyviz.glowDim))
    }
    if (open) Dialog(onDismissRequest = { open = false }) {
        val dshape = RoundedCornerShape(Melyviz.radius)
        Column(
            Modifier.fillMaxWidth().background(Melyviz.deep, dshape).vrgBorder(1.dp, Melyviz.glowDim, dshape)
                .verticalScroll(rememberScrollState()).padding(16.dp),
        ) {
            Text("TELEPÍTŐ QR", style = Melyviz.title.copy(fontSize = 15.sp))
            Text("A VRG Mobile legújabb kiadása egy másik telefonra.", style = Melyviz.small)
            Spacer(Modifier.height(4.dp))
            InstallQrPanel(onClose = { open = false })
        }
    }
}
