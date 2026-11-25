package hu.vrg.mobile

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.DeskCatalog
import hu.vrg.mobile.core.DeskUnit
import hu.vrg.mobile.core.FeatureInfo
import hu.vrg.mobile.core.HomeLayout
import hu.vrg.mobile.core.Kommand
import hu.vrg.mobile.core.KommandItem
import hu.vrg.mobile.core.Reach
import hu.vrg.mobile.kit.ShellSettings
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.RcoItem
import hu.vrg.mobile.kit.ui.RcoMenu
import hu.vrg.mobile.kit.ui.rco
import hu.vrg.mobile.kit.theme.vrgBorder

// The Asztal (WP M19): the VRG Desktop's frame on the phone. Top strip (sheet tabs, Kommand, the orientation toggle,
// settings), the sheet area, and the dock with the ◣ menu dial, the open windows and the ◢ Rétegverem dial. What a
// tap does is the shell's (ShellActivity.openUnit / runKommand); this file only draws. Upright and lying down use the
// same parts. The home in the sheet area is HomeParts.kt (WP M38: numbered pages or one long page).

/** What the Asztal needs from the shell. */
class DeskActions(
    val open: (String) -> Unit,
    val openUnit: (DeskUnit) -> Unit,
    val runKommand: (String) -> Unit,
    val cycleOrientation: () -> Unit,
    /** Takes a window off the dock (its RCO menu). */
    val closeWindow: (String) -> Unit = {},
    /** Takes every window but [keep] off the dock; null keeps none. */
    val closeOthers: (keep: String?) -> Unit = {},
    /** The home's own actions (WP M38): open a web app of a home tile, the Katalógus at a page, the QR scanner. */
    val openApp: (String) -> Unit = {},
    val describe: (String) -> Unit = {},
    val scan: () -> Unit = {},
)

@Composable
fun DeskScreen(
    windows: List<String>,
    act: DeskActions,
    /** The home as one long page (the old Kompakt) instead of the swiped pages (WP M38). */
    list: Boolean = false,
    sheetArea: (@Composable (Modifier) -> Unit)? = null,
    /** The sheet tabs; given RowScope so they take only the width the buttons leave (the audit: they squeezed Kommand to 0 dp). */
    tabs: (@Composable RowScope.() -> Unit)? = null,
) {
    var menu by remember { mutableStateOf(false) }
    var kommand by remember { mutableStateOf(false) }
    val look by ShellSettings.flow.collectAsStateWithLifecycle()
    BackHandler(menu || kommand) { menu = false; kommand = false }

    Box(Modifier.fillMaxSize().systemBarsPadding()) {
        Column(Modifier.fillMaxSize()) {
            // ---- top strip ----------------------------------------------------------------------
            // WP M38: the top bar is "page 0" with the dock, on every page. Its buttons have fixed 48 dp targets and are
            // measured first; the sheet tabs get what is left and scroll inside it (UI-CHECKLIST: no primary action can be
            // squeezed out). On a phone Kommand is a ⌕ button; from 600 dp it is the search bar. Katalógus and the orientation
            // are in ⋮ (on a 360 dp phone with three sheets they pushed Kommand and ⚙ to zero width).
            BoxWithConstraints(Modifier.fillMaxWidth()) {
                val wide = maxWidth >= 600.dp
                var more by remember { mutableStateOf(false) }
                Row(Modifier.fillMaxWidth().background(Melyviz.abyss.copy(alpha = 0.6f)).padding(horizontal = 8.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    if (tabs != null) tabs() else Text("ASZTAL", style = Melyviz.title.copy(fontSize = 13.sp), modifier = Modifier.weight(1f, fill = false).padding(end = 8.dp))
                    if (wide) Row(
                        Modifier.weight(1f).heightIn(min = 44.dp).background(Melyviz.surface, RoundedCornerShape(Melyviz.radiusSmall))
                            .vrgBorder(1.dp, Melyviz.line, RoundedCornerShape(Melyviz.radiusSmall))
                            .clickable(role = Role.Button, onClickLabel = "Kommand megnyitása") { kommand = true }.padding(horizontal = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) { Text("⌕  Kommand…", style = Melyviz.label.copy(color = Melyviz.muted), maxLines = 1, overflow = TextOverflow.Ellipsis) }
                    else {
                        Spacer(Modifier.weight(1f))
                        StripButton("⌕", "Kommand: keresés") { kommand = true }
                    }
                    UpdateMark { act.open(Catalogue.UPDATE.id) }
                    StripButton("▦", "QR beolvasás", act.scan)
                    if (wide) {
                        StripButton(Catalogue.CATALOG.glyph, Catalogue.CATALOG.title) { act.open(Catalogue.CATALOG.id) }
                        StripButton(look.orientation.glyph, "Tájolás: ${look.orientation.label}, koppintásra a következő", act.cycleOrientation)
                    } else Box {
                        StripButton("⋮", "Több: Katalógus, tájolás") { more = true }
                        RcoMenu(more, { more = false }, "Több", listOf(
                            RcoItem(Catalogue.CATALOG.glyph, Catalogue.CATALOG.title) { act.open(Catalogue.CATALOG.id) },
                            RcoItem(look.orientation.glyph, "Tájolás: ${look.orientation.label} → következő") { act.cycleOrientation() },
                        ))
                    }
                    StripButton(Catalogue.SETTINGS.glyph, Catalogue.SETTINGS.title) { act.open(Catalogue.SETTINGS.id) }
                }
            }

            // ---- the sheet area (M20) or the home window ------------------------------------------
            if (sheetArea != null) sheetArea(Modifier.weight(1f).fillMaxWidth())
            else HomeWindow(Modifier.weight(1f).fillMaxWidth(), HomeActions(act.open, act.openApp, act.describe), list)

            // ---- dock ---------------------------------------------------------------------------
            Row(Modifier.fillMaxWidth().background(Melyviz.abyss.copy(alpha = 0.7f)).padding(horizontal = 6.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Dial("◣", "Menü") { menu = !menu; kommand = false }
                // VRG Sketcher, one tap from every sheet too (D-35); the Desktop's dock has its `sketcher` unit (D-34)
                Spacer(Modifier.width(6.dp))
                Box {   // F4 (WP M49): a long press lists the Sketcher's variants (SketchLaunch.kt)
                    var sketchMenu by remember { mutableStateOf(false) }
                    Dial(Catalogue.SKETCH.glyph, Catalogue.SKETCH.title, onLong = { sketchMenu = true }) { act.open(Catalogue.SKETCH.id) }
                    RcoMenu(sketchMenu, { sketchMenu = false }, Catalogue.SKETCH.title,
                        listOf(RcoItem(Catalogue.SKETCH.glyph, "Megnyitás") { act.open(Catalogue.SKETCH.id) }) +
                            hu.vrg.mobile.sketch.ui.sketcherRcoItems(open = { act.open(Catalogue.SKETCH.id) }))
                }
                Row(Modifier.weight(1f).horizontalScroll(rememberScrollState()).padding(horizontal = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (windows.isEmpty()) Text("nincs nyitott ablak", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(8.dp))
                    windows.mapNotNull { Catalogue.byId(it) }.forEach { f -> WindowChip(f, windows.size, act) }
                }
                // closing windows was long-press only (UI audit 3.1): ⋯ lists them with Bezárás and Mind bezárása
                if (windows.isNotEmpty()) Box {
                    var winMenu by remember { mutableStateOf(false) }
                    StripButton("⋯", "Ablakok bezárása") { winMenu = true }
                    RcoMenu(winMenu, { winMenu = false }, "Ablakok", windows.mapNotNull { Catalogue.byId(it) }.map { f ->
                        RcoItem("✕", "${f.title} bezárása", danger = true) { act.closeWindow(f.id) }
                    } + listOfNotNull(if (windows.size > 1) RcoItem("⊠", "Mind bezárása", danger = true) { act.closeOthers(null) } else null))
                }
                Dial("◢", "Rétegverem") { act.open(Catalogue.STACK.id) }
            }
        }
        if (menu) {
            // a tap beside the menu closes it instead of reaching the home under it (UI audit 6.1)
            Box(Modifier.fillMaxSize().pointerInput(Unit) { detectTapGestures { menu = false } })
            MenuPanel(Modifier.align(Alignment.BottomStart)) { u -> menu = false; act.openUnit(u) }
        }
        if (kommand) KommandPanel(windows, onClose = { kommand = false }) { id -> kommand = false; act.runKommand(id) }
    }
}

/** An open window on the dock: tap opens it, long press (RCO) closes it, the others, or all of them. */
@Composable
private fun WindowChip(f: FeatureInfo, count: Int, act: DeskActions) {
    var menu by remember { mutableStateOf(false) }
    Box {
        // the drawn chip keeps its size inside a 48 dp tall touch slot (UI audit 1.1)
        Box(Modifier.heightIn(min = 48.dp).rco(onClick = { act.open(f.id) }, onLong = { menu = true }, longLabel = "ablak műveletei")
            .semantics { role = Role.Button }, contentAlignment = Alignment.Center) {
            Text("${f.glyph} ${f.title}", style = Melyviz.small.copy(color = Melyviz.ink), maxLines = 1,
                modifier = Modifier.background(Melyviz.raised, RoundedCornerShape(8.dp)).vrgBorder(1.dp, Melyviz.glowDim, RoundedCornerShape(8.dp))
                    .padding(horizontal = 10.dp, vertical = 8.dp))
        }
        RcoMenu(menu, { menu = false }, f.title, listOfNotNull(
            RcoItem("▣", "Megnyitás") { act.open(f.id) },
            RcoItem("✕", "Bezárás", danger = true) { act.closeWindow(f.id) },
            if (count > 1) RcoItem("⊟", "Többi bezárása") { act.closeOthers(f.id) } else null,
            if (count > 1) RcoItem("⊠", "Mind bezárása", danger = true) { act.closeOthers(null) } else null,
        ))
    }
}

/** A top bar button: a glyph with a 48 dp target and its name for TalkBack. */
@Composable
private fun StripButton(glyph: String, label: String, onClick: () -> Unit) {
    Box(Modifier.size(48.dp).clickable(role = Role.Button, onClick = onClick).semantics { contentDescription = label }, contentAlignment = Alignment.Center) {
        Text(glyph, style = Melyviz.glyph.copy(color = Melyviz.muted, fontSize = 17.sp))
    }
}

@Composable
private fun Dial(glyph: String, label: String, onLong: (() -> Unit)? = null, onClick: () -> Unit) {
    Box(
        Modifier.size(48.dp).background(Melyviz.surface, RoundedCornerShape(10.dp)).vrgBorder(1.dp, Melyviz.glow, RoundedCornerShape(10.dp))
            .then(if (onLong != null) Modifier.rco(onClick = onClick, onLong = onLong) else Modifier.clickable(role = Role.Button, onClick = onClick))
            .semantics { contentDescription = label; role = Role.Button },
        contentAlignment = Alignment.Center,
    ) { Text(glyph, style = Melyviz.glyph.copy(color = Melyviz.glow, fontSize = 22.sp)) }
}

private fun reachTag(u: DeskUnit): String = when (u.reach) {
    Reach.NATIVE -> ""
    Reach.WEBAPP -> "web"
    Reach.PC -> "PC"
    Reach.NONE -> "—"
}

/** ◣: the Desktop's catalog at User level, in the Desktop's groups. A unit the phone cannot open is dimmed, not hidden. */
@Composable
private fun MenuPanel(modifier: Modifier, onUnit: (DeskUnit) -> Unit) {
    Column(
        modifier.padding(start = 6.dp, bottom = 66.dp).widthIn(max = 340.dp).fillMaxWidth(0.92f).heightIn(max = 460.dp)
            .background(Melyviz.deep, RoundedCornerShape(Melyviz.radius)).vrgBorder(1.dp, Melyviz.glowDim, RoundedCornerShape(Melyviz.radius))
            .verticalScroll(rememberScrollState()).padding(12.dp),
    ) {
        Text("VRG ASZTAL · MENÜ", style = Melyviz.title.copy(fontSize = 12.sp))
        DeskCatalog.GROUPS.forEach { (g, name) ->
            val units = DeskCatalog.UNITS.filter { it.group == g }
            if (units.isEmpty()) return@forEach
            Text(name.uppercase(), style = Melyviz.small.copy(letterSpacing = 1.4.sp, color = Melyviz.glowDim), modifier = Modifier.padding(top = 10.dp, bottom = 2.dp))
            units.forEach { u ->
                val off = u.reach == Reach.NONE
                Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable { onUnit(u) }.padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(u.icon.ifEmpty { "·" }, style = Melyviz.readout.copy(color = if (off) Melyviz.faint else Melyviz.glow), modifier = Modifier.width(30.dp))
                    Text(u.hu, style = Melyviz.label.copy(color = if (off) Melyviz.faint else Melyviz.ink), modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(reachTag(u), style = Melyviz.small.copy(fontSize = 9.sp, color = Melyviz.muted))
                }
            }
        }
    }
}

/** Kommand: the Desktop palette's search over the catalog, the features and the open windows. */
@Composable
private fun KommandPanel(windows: List<String>, onClose: () -> Unit, onRun: (String) -> Unit) {
    var q by remember { mutableStateOf("") }
    val look by ShellSettings.flow.collectAsStateWithLifecycle()
    val index = remember(windows) { Kommand.index(windows = windows.mapNotNull { id -> Catalogue.byId(id)?.let { id to it.title } }) }
    val hits = remember(q, look.kommandRecent, index) { Kommand.search(index, q, look.kommandRecent).take(40) }
    val url = Kommand.asUrl(q)
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { focus.requestFocus() }
    // the overlay takes every touch (taps went through to the home and the dock under it) and stays above the keyboard
    Column(Modifier.fillMaxSize().background(Melyviz.abyss.copy(alpha = 0.94f)).pointerInput(Unit) { detectTapGestures { } }.imePadding().padding(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            BasicTextField(
                q, { q = it }, singleLine = true,
                textStyle = Melyviz.label.copy(fontSize = 15.sp), cursorBrush = SolidColor(Melyviz.glow),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Go),
                keyboardActions = KeyboardActions(onGo = { (url?.let { "url:$it" } ?: hits.firstOrNull()?.id)?.let(onRun) }),
                modifier = Modifier.weight(1f).focusRequester(focus).background(Melyviz.surface, RoundedCornerShape(Melyviz.radiusSmall))
                    .vrgBorder(1.dp, Melyviz.glow, RoundedCornerShape(Melyviz.radiusSmall)).padding(12.dp),
                decorationBox = { inner -> if (q.isEmpty()) Text("Keresés: eszköz, funkció, ablak, webcím…", style = Melyviz.label.copy(color = Melyviz.faint)); inner() },
            )
            Box(Modifier.size(48.dp).clickable(role = Role.Button, onClick = onClose).semantics { contentDescription = "Kommand bezárása" }, contentAlignment = Alignment.Center) {
                Text("✕", style = Melyviz.glyph.copy(color = Melyviz.muted))
            }
        }
        Spacer(Modifier.height(8.dp))
        LazyColumn(Modifier.fillMaxWidth()) {
            if (url != null) item { KommandRow("↗", "Megnyitás a böngészőben", url) { onRun("url:$url") } }
            items(hits, key = { it.id }) { h -> KommandRow(kindGlyph(h), h.hu, kindLabel(h)) { onRun(h.id) } }
            if (hits.isEmpty() && url == null) item { Text("Nincs találat.", style = Melyviz.small, modifier = Modifier.padding(12.dp)) }
        }
    }
}

private fun kindGlyph(h: KommandItem): String = when {
    h.id.startsWith("win:") -> "▣"
    h.id.startsWith("feat:") -> Catalogue.byId(h.id.removePrefix("feat:"))?.glyph ?: "·"
    else -> DeskCatalog.UNITS.firstOrNull { "cat:" + it.id == h.id }?.icon?.ifEmpty { "·" } ?: "·"
}

private fun kindLabel(h: KommandItem): String = when {
    h.id.startsWith("win:") -> "nyitott ablak"
    h.id.startsWith("feat:") -> "telefon"
    else -> DeskCatalog.UNITS.firstOrNull { "cat:" + it.id == h.id }?.let { u -> "Asztal" + reachTag(u).let { if (it.isEmpty()) "" else " · $it" } } ?: ""
}

@Composable
private fun KommandRow(glyph: String, title: String, sub: String, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable(onClick = onClick).padding(horizontal = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(glyph, style = Melyviz.readout.copy(color = Melyviz.glow, fontSize = 13.sp), modifier = Modifier.width(34.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = Melyviz.label, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(sub, style = Melyviz.small.copy(fontSize = 10.sp), maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}
