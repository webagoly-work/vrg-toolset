package hu.vrg.mobile

import android.content.Context
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.gestures.detectTapGestures
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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.apps.AppsFeature
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.Cell
import hu.vrg.mobile.core.Kommand
import hu.vrg.mobile.core.KommandItem
import hu.vrg.mobile.core.MiniStatus
import hu.vrg.mobile.core.PhoneSheets
import hu.vrg.mobile.core.Resolved
import hu.vrg.mobile.core.Sheet
import hu.vrg.mobile.core.SheetPreset
import hu.vrg.mobile.core.SheetWin
import hu.vrg.mobile.core.Sheets
import hu.vrg.mobile.core.SheetsCodec
import hu.vrg.mobile.core.SheetsDoc
import hu.vrg.mobile.core.Tile
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.ui.Mini
import hu.vrg.mobile.kit.ui.MiniSize
import hu.vrg.mobile.kit.ui.RcoItem
import hu.vrg.mobile.kit.ui.RcoMenu
import hu.vrg.mobile.kit.theme.Melyviz
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlin.math.floor
import hu.vrg.mobile.core.Route
import hu.vrg.mobile.kit.theme.vrgBorder

// Lapok (WP M20): the Desktop's sheets in the Asztal's sheet area. The model is kit-core's Sheets (a port of the Desktop's sheets.js) on
// the phone's 2 × 4 grid; lying down the same sheet is drawn transposed, 4 × 2 (D-16). This file draws and turns gestures into model
// ops: a double tap on a window's header = full ⇄ one cell, a long press on its header then a drag = move (or swap), a long press near
// an edge or a corner then a drag = snap resize, a long press on a free cell = the picker (the Kommand list), a tap on a window = full.
// A full window is the feature's own screen inside the sheet area; Back gives it its tile back.

private val P = Sheets.phone

/** The doc, kept as the Desktop's JSON in the shell's preferences. A stored doc the phone's rules refuse is dropped, not repaired. */
object SheetsStore {
    private const val FILE = "shell"
    private const val KEY = "sheets"
    private var ctx: Context? = null
    private val _flow = MutableStateFlow(P.empty())
    val flow: StateFlow<SheetsDoc> = _flow
    val value: SheetsDoc get() = _flow.value

    fun init(context: Context) {
        if (ctx != null) return
        ctx = context.applicationContext
        val d = SheetsCodec.decode(context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(KEY, null))
        _flow.value = if (d != null && P.validate(d).ok) d else P.empty()
    }

    fun update(f: (SheetsDoc) -> SheetsDoc) {
        val n = f(_flow.value)
        if (n === _flow.value) return
        _flow.value = n
        ctx?.getSharedPreferences(FILE, Context.MODE_PRIVATE)?.edit()?.putString(KEY, SheetsCodec.encode(n))?.apply()
    }
}

/** A window's title and glyph, from what it shows. */
private fun titleOf(w: SheetWin): Pair<String, String> = when (w.kind) {
    "home" -> "⌂" to "Kezdőlap"
    "feat" -> Catalogue.byId(w.open.removePrefix("feat:"))?.let { it.glyph to it.title } ?: ("·" to w.open)
    "app" -> Catalogue.APPS.glyph to (AppsFeature.app(w.open.removePrefix("cat:"))?.hu ?: w.open)
    else -> "·" to w.open
}

// ------------------------------------------------------------------ the tabs in the top strip

@Composable
fun SheetTabs(doc: SheetsDoc, onAdd: () -> Unit, onMenu: (String) -> Unit, onHomeLong: (() -> Unit)? = null, modifier: Modifier = Modifier) {
    // + stays in view: the sheet tabs scroll sideways between ⌂ and it (with a few sheets open it used to scroll out of sight);
    // the row as a whole takes only what the top bar's buttons leave ([modifier] = weight(1f, fill = false) from the strip)
    val scroll = rememberScrollState()
    // a new sheet's tab is the last one: bring it into view
    LaunchedEffect(doc.sheets.size) { scroll.animateScrollTo(scroll.maxValue) }
    Row(modifier.padding(end = 6.dp), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
        // ⌂: the home; a long press switches it between the swiped pages and one long page (WP M38)
        Tab("⌂", doc.active.isEmpty(), "Munkapad", { SheetsStore.update { P.activate(it, "") } }, onHomeLong)
        if (doc.sheets.isNotEmpty()) Row(Modifier.weight(1f, fill = false).horizontalScroll(scroll),
            horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
            // the sheet's menu was long-press only (UI audit 3.1): a tap on the active tab (marked ▾) opens it too
            doc.sheets.forEach { s ->
                val on = doc.active == s.id
                Tab(s.name, on, "Lap: ${s.name}", { if (on) onMenu(s.id) else SheetsStore.update { P.activate(it, s.id) } }, { onMenu(s.id) }, menuHint = on)
            }
        }
        if (doc.sheets.size < Sheets.MAX_SHEETS) Tab("+", false, "Új lap", onAdd, null, role = Role.Button)
    }
}

/** A tab: the drawn pill stays 36 dp inside a 48 dp touch slot; a real tab for TalkBack (role, selected, the long press named). */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun Tab(text: String, on: Boolean, label: String, onTap: () -> Unit, onLong: (() -> Unit)?, menuHint: Boolean = false, role: Role = Role.Tab) {
    val haptic = LocalHapticFeedback.current
    Box(Modifier.heightIn(min = 48.dp)
        .combinedClickable(
            role = role,
            onClickLabel = if (menuHint) "lap műveletei" else null,
            onLongClickLabel = if (onLong != null) "lap műveletei" else null,
            onLongClick = onLong?.let { l -> { haptic.performHapticFeedback(HapticFeedbackType.LongPress); l() } },
            onClick = onTap,
        )
        .semantics { contentDescription = label; selected = on },
        contentAlignment = Alignment.Center) {
        // selected is bold and outlined in glow, not only another colour (UI-CHECKLIST 2.4)
        Text(if (menuHint) "$text ▾" else text, style = Melyviz.small.copy(color = if (on) Melyviz.glow else Melyviz.muted, fontSize = 12.sp,
            fontWeight = if (on) FontWeight.Bold else FontWeight.Normal), maxLines = 1,
            modifier = Modifier.heightIn(min = 36.dp).background(if (on) Melyviz.raised else Melyviz.surface, RoundedCornerShape(8.dp))
                .vrgBorder(1.dp, if (on) Melyviz.glow else Melyviz.lineSoft, RoundedCornerShape(8.dp))
                .clearAndSetSemantics { }
                .padding(horizontal = 10.dp, vertical = 9.dp))
    }
}

// ------------------------------------------------------------------ the sheet area

/** What the sheet area needs from the shell. */
class SheetsHost(
    val host: FeatureHost,
    /** The feature the shell has on the whole screen (null = the Asztal): a full window leaving must not switch that one off. */
    val current: () -> String?,
    /** The feature a full window shows now (null = none), so the shell routes keys and foreground to it. */
    val onFull: (String?) -> Unit,
)

private data class Drag(val wid: String, val edge: String?, val grab: Cell, val start: Offset, val now: Offset)

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun SheetArea(modifier: Modifier, doc: SheetsDoc, sh: SheetsHost, onPick: (Cell?) -> Unit) {
    val sheet = P.sheetOf(doc, doc.active) ?: return
    val full = sheet.wins.firstOrNull { it.max }
    if (full != null) { FullWindow(modifier, full, sh); return }
    LaunchedEffect(Unit) { sh.onFull(null) }

    BoxWithConstraints(modifier.padding(4.dp)) {
        val lying = maxWidth > maxHeight
        val cols = if (lying) P.g.rows else P.g.cols
        val rows = if (lying) P.g.cols else P.g.rows
        val cw = maxWidth / cols
        val ch = maxHeight / rows
        val dens = LocalDensity.current
        val cwPx = with(dens) { cw.toPx() }
        val chPx = with(dens) { ch.toPx() }
        val edgePx = with(dens) { 28.dp.toPx() }
        val headPx = with(dens) { 48.dp.toPx() }   // the header's height (48 dp controls, UI audit 1.1)
        // screen ⇄ model (D-16)
        fun toModel(c: Cell) = if (lying) c.transposed() else c
        fun toScreen(t: Tile) = if (lying) t.transposed() else t
        fun cellAt(o: Offset) = Cell(floor(o.x / cwPx).toInt().coerceIn(0, cols - 1), floor(o.y / chPx).toInt().coerceIn(0, rows - 1))
        var drag by remember { mutableStateOf<Drag?>(null) }

        // free cells: a tap (or a long press) opens the picker there; each shows a faint + (it was long-press only once a
        // sheet had a window: UI audit 3.1)
        val occ = P.occupancy(sheet)
        for (sr in 0 until rows) for (sc in 0 until cols) {
            val m = toModel(Cell(sc, sr))
            if (occ[m.r * P.g.cols + m.c].isNotEmpty()) continue
            Box(Modifier.offset(cw * sc, ch * sr).size(cw, ch).padding(3.dp)
                .vrgBorder(1.dp, Melyviz.lineSoft.copy(alpha = 0.5f), RoundedCornerShape(10.dp))
                .combinedClickable(onClickLabel = "új ablak", onLongClick = { onPick(m) }, onClick = { onPick(m) })
                .semantics { contentDescription = "Üres cella, koppintásra új ablak" },
                contentAlignment = Alignment.Center) {
                if (sheet.wins.isEmpty() && sr == 0 && sc == 0) Text("Koppints:\núj ablak", style = Melyviz.small.copy(color = Melyviz.faint), textAlign = TextAlign.Center)
                else Text("+", style = Melyviz.glyph.copy(color = Melyviz.faint, fontSize = 18.sp))
            }
        }

        // the drag's target, drawn under the windows
        drag?.let { d ->
            val cell = cellAt(d.now)
            val t: Tile? = if (d.edge == null) P.moveTarget(sheet, d.wid, toModel(Cell(cell.c - d.grab.c, cell.r - d.grab.r)))?.tile
            else P.resizeTarget(sheet, d.wid, if (lying) Sheets.transposeEdge(d.edge) else d.edge, toModel(cell))
            if (t != null) {
                val s = toScreen(t)
                Box(Modifier.offset(cw * s.c, ch * s.r).size(cw * s.w, ch * s.h).padding(2.dp)
                    .background(Melyviz.glow.copy(alpha = 0.12f), RoundedCornerShape(12.dp)).vrgBorder(2.dp, Melyviz.glow, RoundedCornerShape(12.dp)))
            }
        }

        for (v in P.viewOn(sheet, lying)) {
            val w = sheet.wins.first { it.id == v.id }
            val r = v.rect
            val dragging = drag?.wid == w.id
            // the same moves and resizes as the drags, from the header's ⋯ and TalkBack (UI audit 3.1, 9.5), in screen terms
            fun moveBy(dc: Int, dr: Int, glyph: String, label: String): RcoItem {
                val to = toModel(Cell(r.c + dc, r.r + dr))
                val t = P.moveTarget(sheet, w.id, to)
                return RcoItem(glyph, label, enabled = t != null && (t.tile != w.tile || t.swap.isNotEmpty())) { SheetsStore.update { P.move(it, w.id, to) } }
            }
            fun sizeBy(edge: String, at: Cell, glyph: String, label: String): RcoItem {
                val e = if (lying) Sheets.transposeEdge(edge) else edge
                val to = toModel(at)
                val t = P.resizeTarget(sheet, w.id, e, to)
                return RcoItem(glyph, label, enabled = t != null && t != w.tile) { SheetsStore.update { P.resize(it, w.id, e, to) } }
            }
            val actions = listOf(
                RcoItem("▣", "Teljes méret") { SheetsStore.update { P.maximize(it, w.id) } },
                moveBy(-1, 0, "◀", "Balra"), moveBy(1, 0, "▶", "Jobbra"), moveBy(0, -1, "▲", "Fel"), moveBy(0, 1, "▼", "Le"),
                sizeBy("e", Cell(r.c + r.w, r.r), "+↔", "Szélesebb"), sizeBy("e", Cell(r.c + r.w - 2, r.r), "−↔", "Keskenyebb"),
                sizeBy("s", Cell(r.c, r.r + r.h), "+↕", "Magasabb"), sizeBy("s", Cell(r.c, r.r + r.h - 2), "−↕", "Alacsonyabb"),
                RcoItem("✕", "Bezárás", danger = true) { SheetsStore.update { P.closeWin(it, w.id) } },
            )
            Box(Modifier.offset(cw * r.c, ch * r.r).size(cw * r.w, ch * r.h).padding(3.dp)
                .pointerInput(w.id, w.c, w.r, w.w, w.h, lying) {
                    detectDragGesturesAfterLongPress(
                        onDragStart = { at ->
                            val wPx = r.w * cwPx - 6; val hPx = r.h * chPx - 6
                            val e = buildString {
                                // the header moves; the band just under it is the north edge
                                if (at.y > headPx && at.y < headPx + edgePx) append('n')
                                if (at.y > hPx - edgePx) append('s')
                                if (at.x < edgePx) append('w') else if (at.x > wPx - edgePx) append('e')
                            }.let { if (at.y <= headPx || it.isEmpty()) null else it }
                            val start = Offset(r.c * cwPx + 3 + at.x, r.r * chPx + 3 + at.y)
                            val c = cellAt(start)
                            drag = Drag(w.id, e, Cell(c.c - r.c, c.r - r.r), start, start)
                        },
                        onDrag = { ch2, delta -> ch2.consume(); drag = drag?.let { it.copy(now = it.now + delta) } },
                        onDragEnd = {
                            drag?.let { d ->
                                val cell = cellAt(d.now)
                                SheetsStore.update {
                                    if (d.edge == null) P.move(it, d.wid, toModel(Cell(cell.c - d.grab.c, cell.r - d.grab.r)))
                                    else P.resize(it, d.wid, if (lying) Sheets.transposeEdge(d.edge) else d.edge, toModel(cell))
                                }
                            }
                            drag = null
                        },
                        onDragCancel = { drag = null },
                    )
                }) {
                WindowCard(w, sheet.focus == w.id, dragging, small = r.w * r.h == 1, actions)
            }
        }
    }
}

@Composable
private fun WindowCard(w: SheetWin, focused: Boolean, dragging: Boolean, small: Boolean, actions: List<RcoItem>) {
    val (glyph, title) = titleOf(w)
    val f = Registry.feature(w.open.removePrefix("feat:"))
    val status by (f?.activity ?: remember { MutableStateFlow(MiniStatus.IDLE) }).collectAsState()
    var menu by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().background(if (dragging) Melyviz.surface.copy(alpha = 0.6f) else Melyviz.raised, RoundedCornerShape(12.dp))
        .vrgBorder(if (focused) 2.dp else 1.dp, if (focused) Melyviz.glow else Melyviz.glowDim, RoundedCornerShape(12.dp))
        .semantics { customActions = actions.filter { it.enabled }.map { a -> CustomAccessibilityAction("$title: ${a.label}") { a.onClick(); true } } }) {
        Row(Modifier.fillMaxWidth().heightIn(min = 40.dp).background(Melyviz.abyss.copy(alpha = 0.5f), RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp))
            .pointerInput(w.id) { detectTapGestures(onDoubleTap = { SheetsStore.update { P.toggleMax(it, w.id) } }, onTap = { SheetsStore.update { P.focusWin(it, w.id) } }) }
            .semantics { contentDescription = "$title ablak, dupla koppintás: teljes vagy egy cella" }
            .padding(start = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(glyph, style = Melyviz.small.copy(color = Melyviz.glow))
            Text(title, style = Melyviz.small.copy(color = Melyviz.ink, fontSize = 11.sp), maxLines = 1, overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f).padding(horizontal = 6.dp))
            Box {
                HeadButton("⋯", "$title: mozgatás, méret") { menu = true }
                RcoMenu(menu, { menu = false }, title, actions)
            }
            HeadButton("✕", "$title bezárása") { SheetsStore.update { P.closeWin(it, w.id) } }
        }
        // the face: the window's compact self; a tap opens it full
        Column(Modifier.weight(1f).fillMaxWidth().clickable { SheetsStore.update { P.maximize(it, w.id) } }.padding(6.dp),
            horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Mini(glyph, title, status, size = if (small) MiniSize.SM else MiniSize.MD, tint = Melyviz.glow, quietIdle = true)
            if (!small) {
                val blurb = when (w.kind) {
                    "home" -> "A telefon funkciói ikonokként."
                    "app" -> "Az Asztal alkalmazása, a telefonon tárolt példányból."
                    else -> Catalogue.byId(w.open.removePrefix("feat:"))?.blurb.orEmpty()
                }
                Text(blurb, style = Melyviz.small.copy(fontSize = 10.sp, color = Melyviz.muted), textAlign = TextAlign.Center,
                    maxLines = 4, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 6.dp))
            }
        }
    }
}

/** A full window: the feature's own screen (or the home icons) inside the sheet area, under a thin header. */
@Composable
private fun FullWindow(modifier: Modifier, w: SheetWin, sh: SheetsHost) {
    val (glyph, title) = titleOf(w)
    val fid = w.open.removePrefix("feat:")
    val f = if (w.kind == "feat") Registry.feature(fid) else null
    BackHandler { SheetsStore.update { P.restore(it, w.id) } }
    DisposableEffect(w.id) {
        sh.onFull(f?.info?.id)
        f?.onForeground(true)
        onDispose {
            sh.onFull(null)
            if (sh.current() == null) { f?.onForeground(false); sh.host.keepScreenOn(false) }
            else if (sh.current() != f?.info?.id) f?.onForeground(false)
        }
    }
    Column(modifier) {
        Row(Modifier.fillMaxWidth().heightIn(min = 40.dp).background(Melyviz.abyss.copy(alpha = 0.5f))
            .pointerInput(w.id) { detectTapGestures(onDoubleTap = { SheetsStore.update { P.toggleMax(it, w.id) } }) }
            .padding(start = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("$glyph  $title", style = Melyviz.small.copy(color = Melyviz.glow), modifier = Modifier.weight(1f), maxLines = 1)
            HeadButton("⧉", "Vissza a lapra") { SheetsStore.update { P.restore(it, w.id) } }
            HeadButton("✕", "$title bezárása") { SheetsStore.update { P.closeWin(it, w.id) } }
        }
        Box(Modifier.weight(1f).fillMaxWidth()) {
            when {
                // a sheet window holding the home: the one long page (a small window has no room for the page strip)
                w.kind == "home" -> HomeWindow(Modifier.fillMaxSize(), HomeActions(sh.host::open, openApp = { id ->
                    sh.host.open(Catalogue.APPS.id); Registry.feature(Catalogue.APPS.id)?.open(Route(Catalogue.APPS.id, id))
                }), list = true)
                w.kind == "app" -> AppsFeature.AppView(w.open.removePrefix("cat:"), sh.host, Modifier.fillMaxSize()) { SheetsStore.update { P.restore(it, w.id) } }
                f != null -> f.Screen(sh.host)
                else -> Text("$title: ez az ablak ezen a telefonon nem nyílik meg.", style = Melyviz.small, modifier = Modifier.padding(16.dp))
            }
        }
    }
}

/** A window header's control: the small glyph in a 48 dp target, named for TalkBack (UI audit 1.1: they were ~30 dp). */
@Composable
private fun HeadButton(glyph: String, label: String, onClick: () -> Unit) {
    Box(Modifier.size(48.dp).clickable(role = Role.Button, onClick = onClick).semantics { contentDescription = label }, contentAlignment = Alignment.Center) {
        Text(glyph, style = Melyviz.small.copy(color = Melyviz.muted))
    }
}

// ------------------------------------------------------------------ the picker and the sheet menus

/** What can be a window: the home icons, then the Kommand list (phone features and Desktop units) that resolve to one. */
private fun pickable(): List<Pair<KommandItem, Resolved>> {
    val out = mutableListOf(KommandItem("pane:home", "Kezdőlap (ikonok)", "Home") to Resolved("home", "pane:home", "{}"))
    for (it in Kommand.index()) {
        val r = when {
            it.id.startsWith("feat:") -> PhoneSheets.resolve(it.id)
            it.id.startsWith("cat:") -> PhoneSheets.resolve(it.id)
            else -> null
        }?.takeIf { r -> r.kind == "home" || r.kind == "app" || Registry.feature(r.open!!.removePrefix("feat:")) != null } ?: continue
        if (out.none { o -> o.second.open == r.open }) out += it to r
    }
    return out
}

/** Long press on a free cell (or the first tap on an empty sheet): pick what opens there. It opens full, as on the Desktop. */
@Composable
fun SheetPicker(cell: Cell?, onClose: () -> Unit) {
    var q by remember { mutableStateOf("") }
    val all = remember { pickable() }
    val hits = remember(q) { Kommand.search(all, q) { it.first } }
    val focus = remember { FocusRequester() }
    BackHandler(onBack = onClose)
    fun pick(r: Resolved) {
        SheetsStore.update { d -> P.openWin(d, d.active, P.newPaneId(d, r.kind), r.kind, r.open!!, r.state, cell) }
        onClose()
    }
    Panel("ÚJ ABLAK" + (cell?.let { " · ${it.c + 1}. oszlop, ${it.r + 1}. sor" } ?: ""), onClose) {
        BasicTextField(q, { q = it }, singleLine = true, textStyle = Melyviz.label.copy(fontSize = 15.sp), cursorBrush = SolidColor(Melyviz.glow),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Go), keyboardActions = KeyboardActions(onGo = { hits.firstOrNull()?.let { pick(it.second) } }),
            modifier = Modifier.fillMaxWidth().focusRequester(focus).background(Melyviz.surface, RoundedCornerShape(Melyviz.radiusSmall))
                .vrgBorder(1.dp, Melyviz.glow, RoundedCornerShape(Melyviz.radiusSmall)).padding(12.dp),
            decorationBox = { inner -> if (q.isEmpty()) Text("Keresés…", style = Melyviz.label.copy(color = Melyviz.faint)); inner() })
        Spacer(Modifier.height(6.dp))
        LazyColumn(Modifier.fillMaxWidth().heightIn(max = 420.dp)) {
            items(hits, key = { it.first.id }) { (item, r) ->
                val glyph = when (r.kind) { "home" -> "⌂"; "app" -> Catalogue.APPS.glyph; else -> Catalogue.byId(r.open!!.removePrefix("feat:"))?.glyph ?: "·" }
                Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable { pick(r) }.padding(horizontal = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(glyph, style = Melyviz.readout.copy(color = Melyviz.glow), modifier = Modifier.width(34.dp))
                    Text(item.hu, style = Melyviz.label, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
            if (hits.isEmpty()) item { Text("Nincs találat.", style = Melyviz.small, modifier = Modifier.padding(12.dp)) }
        }
    }
}

/** "+": a new sheet, blank or from a preset (the phone's own — DevLap — then the Desktop's User-level ones fitted to the phone, then the user's own). */
@Composable
fun NewSheetPanel(doc: SheetsDoc, onClose: () -> Unit) {
    BackHandler(onBack = onClose)
    fun add(p: SheetPreset) {
        SheetsStore.update { d ->
            val wins = PhoneSheets.windows(d, p)
            val n = P.addSheet(d, p.name, wins)
            val f = P.presetFocus(p, wins)
            if (f.isNotEmpty()) P.focusWin(n, f) else n
        }
        onClose()
    }
    Panel("ÚJ LAP", onClose) {
        // the list scrolls (lying down, or with presets of your own, it is taller than the screen); DevLap is first
        Column(Modifier.fillMaxWidth().heightIn(max = 420.dp).verticalScroll(rememberScrollState())) {
            (PhoneSheets.PRESETS + doc.mine).forEach { p ->
                val n = PhoneSheets.windows(doc, p).size
                Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable { add(p) }.padding(horizontal = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(if (p in doc.mine) "★" else "▦", style = Melyviz.readout.copy(color = Melyviz.glow), modifier = Modifier.width(34.dp))
                    Text(p.name, style = Melyviz.label, modifier = Modifier.weight(1f))
                    Text(if (n == 0) "üres" else "$n ablak", style = Melyviz.small.copy(color = Melyviz.muted))
                }
            }
        }
        Text("A Desktop sablonjaiból azok az ablakok jönnek át, amelyeket a telefon meg tud nyitni.", style = Melyviz.small.copy(fontSize = 10.sp, color = Melyviz.faint),
            modifier = Modifier.padding(top = 8.dp))
    }
}

/** Long press on a sheet's tab: rename, move, save as a preset, close. */
@Composable
fun SheetMenu(doc: SheetsDoc, sid: String, onClose: () -> Unit) {
    val s: Sheet = P.sheetOf(doc, sid) ?: run { onClose(); return }
    var name by remember(sid) { mutableStateOf(s.name) }
    var sure by remember(sid) { mutableStateOf(false) }   // closing drops the sheet and its windows: asked once more
    BackHandler(onBack = onClose)
    Panel("LAP · ${s.name}", onClose) {
        BasicTextField(name, { name = it.take(Sheets.MAX_NAME) }, singleLine = true, textStyle = Melyviz.label.copy(fontSize = 15.sp), cursorBrush = SolidColor(Melyviz.glow),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { SheetsStore.update { P.renameSheet(it, sid, name) }; onClose() }),
            modifier = Modifier.fillMaxWidth().background(Melyviz.surface, RoundedCornerShape(Melyviz.radiusSmall))
                .vrgBorder(1.dp, Melyviz.line, RoundedCornerShape(Melyviz.radiusSmall)).padding(12.dp))
        MenuRow("✓", "Átnevezés") { SheetsStore.update { P.renameSheet(it, sid, name) }; onClose() }
        MenuRow("◀", "Előrébb") { SheetsStore.update { P.moveSheet(it, sid, -1) } }
        MenuRow("▶", "Hátrébb") { SheetsStore.update { P.moveSheet(it, sid, 1) } }
        MenuRow("★", "Mentés sablonként") {
            val id = "m-" + Kommand.words(s.name).joinToString("-").filter { it in 'a'..'z' || it in '0'..'9' || it == '-' }.take(20).ifEmpty { "lap" }
            SheetsStore.update { P.savePreset(it, sid, id, s.name) }; onClose()
        }
        if (!sure) MenuRow("✕", "Lap bezárása…", danger = true) { sure = true }
        else {
            MenuRow("✕", "Igen, bezárás" + if (s.wins.isEmpty()) "" else " (${s.wins.size} ablakkal)", danger = true) {
                SheetsStore.update { P.removeSheet(it, sid) }; onClose()
            }
            MenuRow("↩", "Mégse") { sure = false }
        }
    }
}

@Composable
private fun MenuRow(glyph: String, label: String, danger: Boolean = false, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable(onClick = onClick).padding(horizontal = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(glyph, style = Melyviz.readout.copy(color = if (danger) Melyviz.coral else Melyviz.glow), modifier = Modifier.width(34.dp))
        Text(label, style = Melyviz.label.copy(color = if (danger) Melyviz.coral else Melyviz.ink))
    }
}

@Composable
private fun Panel(title: String, onClose: () -> Unit, body: @Composable () -> Unit) {
    Box(Modifier.fillMaxSize().background(Melyviz.abyss.copy(alpha = 0.85f)).clickable(onClick = onClose), contentAlignment = Alignment.Center) {
        // the panel scrolls and keeps above the keyboard: lying down the sheet menu was taller than the screen (Lap bezárása cut off)
        Column(Modifier.imePadding().padding(16.dp).widthIn(max = 420.dp).fillMaxWidth().background(Melyviz.deep, RoundedCornerShape(Melyviz.radius))
            .vrgBorder(1.dp, Melyviz.glowDim, RoundedCornerShape(Melyviz.radius)).clickable(enabled = false) {}.verticalScroll(rememberScrollState()).padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(title, style = Melyviz.title.copy(fontSize = 12.sp), modifier = Modifier.weight(1f))
                Box(Modifier.size(48.dp).clickable(role = Role.Button, onClick = onClose).semantics { contentDescription = "Bezárás" },
                    contentAlignment = Alignment.Center) { Text("✕", style = Melyviz.glyph.copy(color = Melyviz.muted)) }
            }
            Spacer(Modifier.height(8.dp))
            body()
        }
    }
}
