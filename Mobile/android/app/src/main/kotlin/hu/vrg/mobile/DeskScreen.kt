package hu.vrg.mobile

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import hu.vrg.mobile.core.Kommand
import hu.vrg.mobile.core.KommandItem
import hu.vrg.mobile.core.Reach
import hu.vrg.mobile.kit.ShellSettings
import hu.vrg.mobile.kit.theme.Melyviz

// The Asztal (WP M19): the VRG Desktop's frame on the phone. Top strip (sheet tabs, Kommand, the orientation toggle,
// settings), the sheet area, and the dock with the ◣ menu dial, the open windows and the ◢ Rétegverem dial. What a
// tap does is the shell's (ShellActivity.openUnit / runKommand); this file only draws. Upright and lying down use the
// same parts: the icon grid takes 4 columns upright and 8 lying down.

/** What the Asztal needs from the shell. */
class DeskActions(
    val open: (String) -> Unit,
    val openUnit: (DeskUnit) -> Unit,
    val runKommand: (String) -> Unit,
    val cycleOrientation: () -> Unit,
)

@Composable
fun DeskScreen(
    windows: List<String>,
    act: DeskActions,
    sheetArea: (@Composable (Modifier) -> Unit)? = null,
    tabs: (@Composable () -> Unit)? = null,
) {
    var menu by remember { mutableStateOf(false) }
    var kommand by remember { mutableStateOf(false) }
    val look by ShellSettings.flow.collectAsStateWithLifecycle()
    BackHandler(menu || kommand) { menu = false; kommand = false }

    Box(Modifier.fillMaxSize().systemBarsPadding()) {
        Column(Modifier.fillMaxSize()) {
            // ---- top strip ----------------------------------------------------------------------
            Row(Modifier.fillMaxWidth().background(Melyviz.abyss.copy(alpha = 0.6f)).padding(horizontal = 8.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically) {
                if (tabs != null) tabs() else Text("ASZTAL", style = Melyviz.title.copy(fontSize = 13.sp), modifier = Modifier.padding(end = 8.dp))
                Row(
                    Modifier.weight(1f).heightIn(min = 36.dp).background(Melyviz.surface, RoundedCornerShape(Melyviz.radiusSmall))
                        .border(1.dp, Melyviz.line, RoundedCornerShape(Melyviz.radiusSmall))
                        .clickable { kommand = true }.padding(horizontal = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) { Text("⌕  Kommand…", style = Melyviz.label.copy(color = Melyviz.muted)) }
                Text(
                    look.orientation.glyph + " " + look.orientation.label, style = Melyviz.small.copy(color = Melyviz.current),
                    modifier = Modifier.clickable(onClick = act.cycleOrientation).padding(horizontal = 8.dp, vertical = 10.dp)
                        .semantics { contentDescription = "Tájolás: ${look.orientation.label}, koppintásra a következő" },
                )
                Text(Catalogue.SETTINGS.glyph, style = Melyviz.glyph.copy(color = Melyviz.muted, fontSize = 18.sp),
                    modifier = Modifier.clickable { act.open(Catalogue.SETTINGS.id) }.padding(6.dp))
            }

            // ---- the sheet area (M20) or the home window ------------------------------------------
            if (sheetArea != null) sheetArea(Modifier.weight(1f).fillMaxWidth())
            else HomeWindow(Modifier.weight(1f).fillMaxWidth(), act.open)

            // ---- dock ---------------------------------------------------------------------------
            Row(Modifier.fillMaxWidth().background(Melyviz.abyss.copy(alpha = 0.7f)).padding(horizontal = 6.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Dial("◣", "Menü") { menu = !menu; kommand = false }
                Row(Modifier.weight(1f).horizontalScroll(rememberScrollState()).padding(horizontal = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (windows.isEmpty()) Text("nincs nyitott ablak", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(8.dp))
                    windows.mapNotNull { Catalogue.byId(it) }.forEach { f ->
                        Text("${f.glyph} ${f.title}", style = Melyviz.small.copy(color = Melyviz.ink), maxLines = 1,
                            modifier = Modifier.background(Melyviz.raised, RoundedCornerShape(8.dp)).border(1.dp, Melyviz.glowDim, RoundedCornerShape(8.dp))
                                .clickable { act.open(f.id) }.padding(horizontal = 10.dp, vertical = 8.dp))
                    }
                }
                Dial("◢", "Rétegverem") { act.open(Catalogue.STACK.id) }
            }
        }
        if (menu) MenuPanel(Modifier.align(Alignment.BottomStart)) { u -> menu = false; act.openUnit(u) }
        if (kommand) KommandPanel(windows, onClose = { kommand = false }) { id -> kommand = false; act.runKommand(id) }
    }
}

@Composable
private fun Dial(glyph: String, label: String, onClick: () -> Unit) {
    Box(
        Modifier.size(44.dp).background(Melyviz.surface, RoundedCornerShape(10.dp)).border(1.dp, Melyviz.glow, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick).semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) { Text(glyph, style = Melyviz.glyph.copy(color = Melyviz.glow, fontSize = 22.sp)) }
}

/** The home window: the phone's features as desktop icons, grouped. */
@Composable
internal fun HomeWindow(modifier: Modifier, open: (String) -> Unit) {
    BoxWithConstraints(modifier.padding(horizontal = 10.dp)) {
        val cols = if (maxWidth > maxHeight) 8 else 4
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(vertical = 8.dp)) {
            Registry.catalogue.forEach { (group, items) ->
                Text(group.label.uppercase(), style = Melyviz.small.copy(letterSpacing = 1.6.sp, color = Melyviz.glowDim), modifier = Modifier.padding(top = 10.dp, bottom = 4.dp))
                items.chunked(cols).forEach { row ->
                    Row(Modifier.fillMaxWidth()) {
                        row.forEach { Icon(it, Modifier.weight(1f)) { open(it.id) } }
                        repeat(cols - row.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
        }
    }
}

@Composable
private fun Icon(f: FeatureInfo, modifier: Modifier, onClick: () -> Unit) {
    val built = Registry.isBuilt(f)
    Column(modifier.clickable(onClick = onClick).padding(vertical = 8.dp, horizontal = 2.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(46.dp).background(if (built) Melyviz.raised else Melyviz.surface.copy(alpha = 0.6f), RoundedCornerShape(12.dp))
            .border(BorderStroke(1.dp, if (built) Melyviz.glowDim else Melyviz.lineSoft), RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
            Text(f.glyph, style = Melyviz.glyph.copy(color = if (built) Melyviz.glow else Melyviz.faint))
        }
        Text(f.title, style = Melyviz.small.copy(fontSize = 10.sp, color = if (built) Melyviz.ink else Melyviz.muted), maxLines = 1,
            overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 4.dp))
    }
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
        modifier.padding(start = 6.dp, bottom = 62.dp).widthIn(max = 340.dp).fillMaxWidth(0.92f).heightIn(max = 460.dp)
            .background(Melyviz.deep, RoundedCornerShape(Melyviz.radius)).border(1.dp, Melyviz.glowDim, RoundedCornerShape(Melyviz.radius))
            .verticalScroll(rememberScrollState()).padding(12.dp),
    ) {
        Text("VRG ASZTAL · MENÜ", style = Melyviz.title.copy(fontSize = 12.sp))
        DeskCatalog.GROUPS.forEach { (g, name) ->
            val units = DeskCatalog.UNITS.filter { it.group == g }
            if (units.isEmpty()) return@forEach
            Text(name.uppercase(), style = Melyviz.small.copy(letterSpacing = 1.4.sp, color = Melyviz.glowDim), modifier = Modifier.padding(top = 10.dp, bottom = 2.dp))
            units.forEach { u ->
                val off = u.reach == Reach.NONE
                Row(Modifier.fillMaxWidth().heightIn(min = 40.dp).clickable { onUnit(u) }.padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
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
    Column(Modifier.fillMaxSize().background(Melyviz.abyss.copy(alpha = 0.94f)).padding(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            BasicTextField(
                q, { q = it }, singleLine = true,
                textStyle = Melyviz.label.copy(fontSize = 15.sp), cursorBrush = SolidColor(Melyviz.glow),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Go),
                keyboardActions = KeyboardActions(onGo = { (url?.let { "url:$it" } ?: hits.firstOrNull()?.id)?.let(onRun) }),
                modifier = Modifier.weight(1f).focusRequester(focus).background(Melyviz.surface, RoundedCornerShape(Melyviz.radiusSmall))
                    .border(1.dp, Melyviz.glow, RoundedCornerShape(Melyviz.radiusSmall)).padding(12.dp),
                decorationBox = { inner -> if (q.isEmpty()) Text("Keresés: eszköz, funkció, ablak, webcím…", style = Melyviz.label.copy(color = Melyviz.faint)); inner() },
            )
            Text("✕", style = Melyviz.glyph.copy(color = Melyviz.muted), modifier = Modifier.clickable(onClick = onClose).padding(12.dp))
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
