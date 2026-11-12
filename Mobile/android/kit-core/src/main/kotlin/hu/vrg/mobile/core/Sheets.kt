package hu.vrg.mobile.core

import org.json.JSONArray
import org.json.JSONObject

// Lapok (WP M20): the VRG Desktop's sheets (Dashboard/shell/lib/sheets.js, WP-46) on the phone. The same doc, the same validation and
// the same operations, ported function by function; SheetsTest mirrors Dashboard/test/wp-46.test.js on the Desktop's 4 × 4 rules.
//
// D-16: the grid is a parameter (SheetRules). The Desktop is 4 × 4; the phone is 2 columns × 4 rows, stored upright. Lying down the
// screen shows the same sheet transposed (4 × 2): a tile (c, r, w, h) is drawn at (r, c, h, w), and a cell or a grabbed edge on the
// screen is turned back before it reaches the model. A transposed layout of valid tiles is valid, so rotating never changes the doc.
//
//   doc   = { v:1, active, bar, sheets:[sheet], mine:[preset] }      active = a sheet id, '' = the Munkapad (the phone: the home window)
//   sheet = { id, name, wins:[win], focus }
//   win   = { id, kind, open, state, c, r, w, h, max }                 state = a JSON object, kept as its text
//   preset= { id, name, wins:[{ open, state, c, r, w, h }], focus? }
//
// Every op returns a new valid doc, or the SAME doc object when it cannot apply (tests use assertSame, like the JS tests' equal()).

data class Tile(val c: Int, val r: Int, val w: Int, val h: Int) {
    /** The same tile on the other axis (D-16: the phone lying down). */
    fun transposed() = Tile(r, c, h, w)
}

data class Cell(val c: Int, val r: Int) {
    fun transposed() = Cell(r, c)
}

data class SheetWin(
    val id: String, val kind: String, val open: String, val state: String = "{}",
    val c: Int, val r: Int, val w: Int, val h: Int, val max: Boolean = false,
) {
    val tile: Tile get() = Tile(c, r, w, h)
    fun at(t: Tile) = copy(c = t.c, r = t.r, w = t.w, h = t.h)
}

data class Sheet(val id: String, val name: String, val wins: List<SheetWin> = emptyList(), val focus: String = "")

data class PresetWin(val open: String, val state: String = "{}", val c: Int, val r: Int, val w: Int, val h: Int) {
    val tile: Tile get() = Tile(c, r, w, h)
}

data class SheetPreset(val id: String, val name: String, val wins: List<PresetWin>, val focus: Int? = null)

data class SheetsDoc(
    val v: Int = 1,
    val active: String = "",
    val bar: String = "top",
    val sheets: List<Sheet> = emptyList(),
    val mine: List<SheetPreset> = emptyList(),
)

/** What a window resolves to when a preset opens: the page (here: the phone) decides which `open`s it can show. */
data class Resolved(val kind: String, val open: String? = null, val state: String? = null)

data class SheetView(val id: String, val rect: Tile, val max: Boolean, val covered: Boolean)

data class MoveTarget(val tile: Tile, val swap: String = "", val back: Tile? = null)

/** The grid and what a window may be. */
class SheetRules(val cols: Int, val rows: Int, val kinds: List<String>, val open: Regex) {
    val cells get() = cols * rows
    val full get() = Tile(0, 0, cols, rows)

    companion object {
        /** = layout.js KINDS */
        val DESKTOP_KINDS = listOf("home", "empty", "files", "term", "web", "mail", "stack", "chat", "note", "git", "feed", "app")
        val DESKTOP = SheetRules(4, 4, DESKTOP_KINDS, Regex("^(pane:[a-z]{1,10}|cat:[a-z0-9:_./-]{1,80})$"))
        /** The phone: 2 × 4 upright; a window may also be one of the phone's own features (`feat:<id>`, kind `feat`). */
        val PHONE = SheetRules(2, 4, DESKTOP_KINDS + "feat", Regex("^(pane:[a-z]{1,10}|cat:[a-z0-9:_./-]{1,80}|feat:[a-z0-9-]{1,24})$"))
    }
}

sealed class Valid {
    object Ok : Valid() { override fun toString() = "ok" }
    data class Bad(val err: String) : Valid()
    val ok get() = this is Ok
}

class Sheets(val g: SheetRules) {
    companion object {
        const val MAX_SHEETS = 12
        const val MAX_PRESETS = 24
        const val MAX_STATE = 8192
        const val MAX_NAME = 40
        val EDGES = listOf("n", "s", "e", "w", "ne", "nw", "se", "sw")
        private val SHEET_ID = Regex("^s[0-9]{1,4}$")
        private val PANE_ID = Regex("^[a-z0-9-]{1,40}$")
        private val PRESET_ID = Regex("^[a-z0-9-]{1,24}$")
        private val CTRL = Regex("[\\u0000-\\u001f]")

        val desktop = Sheets(SheetRules.DESKTOP)
        val phone = Sheets(SheetRules.PHONE)

        /** A grabbed edge on the transposed (lying) screen → the model's edge: x on screen is r in the model, y is c. */
        fun transposeEdge(e: String): String = when (e) {
            "n" -> "w"; "w" -> "n"; "s" -> "e"; "e" -> "s"
            "ne" -> "sw"; "sw" -> "ne"
            else -> e   // nw, se
        }

        fun okName(s: String?) = s != null && s.trim().isNotEmpty() && s.length <= MAX_NAME && !CTRL.containsMatchIn(s)

        /** A state is a JSON object of at most MAX_STATE characters (the JS measures JSON.stringify's length). */
        fun okState(s: String?): Boolean {
            if (s == null || s.length > MAX_STATE * 2) return false
            return try { JSONObject(s).toString().length <= MAX_STATE } catch (e: Exception) { false }
        }

        /** Two state texts as the same object (key order and spacing ignored). */
        fun sameState(a: String, b: String): Boolean = try { canon(JSONObject(a)) == canon(JSONObject(b)) } catch (e: Exception) { a == b }

        private fun canon(v: Any?): String = when (v) {
            is JSONObject -> v.keys().asSequence().sorted().joinToString(",", "{", "}") { JSONObject.quote(it) + ":" + canon(v.opt(it)) }
            is JSONArray -> (0 until v.length()).joinToString(",", "[", "]") { canon(v.opt(it)) }
            is String -> JSONObject.quote(v)
            null, JSONObject.NULL -> "null"
            else -> v.toString()
        }
    }

    private fun int(v: Int, a: Int, b: Int) = v in a..b

    // ------------------------------------------------------------ tiles
    fun okTile(t: Tile) = int(t.c, 0, g.cols - 1) && int(t.r, 0, g.rows - 1) && int(t.w, 1, g.cols) && int(t.h, 1, g.rows) &&
        t.c + t.w <= g.cols && t.r + t.h <= g.rows

    fun overlap(a: Tile, b: Tile) = a.c < b.c + b.w && b.c < a.c + a.w && a.r < b.r + b.h && b.r < a.r + a.h

    /** The cells → the id of the window whose tile holds it ("" = free); `except` is left out. */
    fun occupancy(sheet: Sheet, except: String? = null): List<String> {
        val grid = MutableList(g.cells) { "" }
        for (w in sheet.wins) {
            if (w.id == except) continue
            for (r in w.r until w.r + w.h) for (c in w.c until w.c + w.w) grid[r * g.cols + c] = w.id
        }
        return grid
    }

    fun fits(sheet: Sheet, t: Tile, except: String? = null) = okTile(t) && sheet.wins.none { it.id != except && overlap(it.tile, t) }

    /** The cell a new window takes: `prefer` when free, else the first free cell row by row; null when the sheet is full. */
    fun freeCell(sheet: Sheet, prefer: Cell? = null): Cell? {
        val grid = occupancy(sheet)
        if (prefer != null && int(prefer.c, 0, g.cols - 1) && int(prefer.r, 0, g.rows - 1) && grid[prefer.r * g.cols + prefer.c].isEmpty()) return prefer
        val i = grid.indexOf("")
        return if (i < 0) null else Cell(i % g.cols, i / g.cols)
    }

    // ------------------------------------------------------------ validation
    private fun validWin(w: SheetWin, ids: MutableSet<String>): String {
        if (!PANE_ID.matches(w.id)) return "win-id"
        if (!ids.add(w.id)) return "duplicate-id"
        if (w.kind !in g.kinds) return "kind"
        if (!g.open.matches(w.open)) return "open"
        if (!okState(w.state)) return "state"
        if (!okTile(w.tile)) return "tile"
        return ""
    }

    fun validPreset(p: SheetPreset): String {
        if (!PRESET_ID.matches(p.id) || !okName(p.name) || p.wins.size > g.cells) return "preset"
        val f = p.focus
        if (f != null && (f < 0 || f >= p.wins.size)) return "preset-focus"
        val placed = mutableListOf<Tile>()
        for (w in p.wins) {
            if (!g.open.matches(w.open) || !okState(w.state) || !okTile(w.tile)) return "preset-win"
            if (placed.any { overlap(it, w.tile) }) return "preset-overlap"
            placed += w.tile
        }
        return ""
    }

    fun validate(doc: SheetsDoc): Valid {
        fun bad(e: String) = Valid.Bad(e)
        if (doc.v != 1) return bad("doc")
        if (doc.bar != "top" && doc.bar != "bottom") return bad("bar")
        if (doc.sheets.size > MAX_SHEETS) return bad("sheets")
        if (doc.mine.size > MAX_PRESETS) return bad("mine")
        val sids = mutableSetOf<String>()
        val ids = mutableSetOf<String>()
        for (s in doc.sheets) {
            if (!SHEET_ID.matches(s.id) || !sids.add(s.id)) return bad("sheet-id")
            if (!okName(s.name)) return bad("name")
            if (s.wins.size > g.cells) return bad("wins")
            for (w in s.wins) { val e = validWin(w, ids); if (e.isNotEmpty()) return bad(e) }
            for (i in s.wins.indices) for (j in i + 1 until s.wins.size) if (overlap(s.wins[i].tile, s.wins[j].tile)) return bad("overlap")
            if (s.wins.count { it.max } > 1) return bad("two-max")
            if (s.focus.isNotEmpty() && s.wins.none { it.id == s.focus }) return bad("focus")
        }
        if (doc.active.isNotEmpty() && doc.active !in sids) return bad("active")
        val pids = mutableSetOf<String>()
        for (p in doc.mine) {
            val e = validPreset(p); if (e.isNotEmpty()) return bad(e)
            if (!pids.add(p.id)) return bad("preset-id")
        }
        return Valid.Ok
    }

    // ------------------------------------------------------------ helpers over a doc
    fun empty() = SheetsDoc()
    fun sheetOf(doc: SheetsDoc, sid: String): Sheet? = doc.sheets.firstOrNull { it.id == sid }
    fun findWin(doc: SheetsDoc, wid: String): Pair<Sheet, SheetWin>? {
        for (s in doc.sheets) s.wins.firstOrNull { it.id == wid }?.let { return s to it }
        return null
    }
    fun wins(doc: SheetsDoc): List<SheetWin> = doc.sheets.flatMap { it.wins }

    /** Edit one sheet; `fn` returns null when the op does not apply → the same doc comes back. */
    private fun edit(doc: SheetsDoc, sid: String, fn: (Sheet) -> Sheet?): SheetsDoc {
        val s = sheetOf(doc, sid) ?: return doc
        val n = fn(s) ?: return doc
        val d = doc.copy(sheets = doc.sheets.map { if (it.id == sid) n else it })
        return if (validate(d).ok) d else doc
    }

    private fun editWin(doc: SheetsDoc, wid: String, fn: (SheetWin, Sheet) -> Sheet?): SheetsDoc {
        val (s, w) = findWin(doc, wid) ?: return doc
        return edit(doc, s.id) { fn(w, s) }
    }

    private fun Sheet.put(w: SheetWin) = copy(wins = wins.map { if (it.id == w.id) w else it })

    /** A pane id no window and no `taken` id uses: w-<kind>-<n>. */
    fun newPaneId(doc: SheetsDoc, kind: String, taken: Collection<String> = emptyList()): String {
        val used = wins(doc).map { it.id }.toSet() + taken
        var i = 1
        while (true) { val id = "w-$kind-$i"; if (id !in used) return id; i++ }
    }

    fun newSheetId(doc: SheetsDoc): String {
        val used = doc.sheets.map { it.id }.toSet()
        var i = 1
        while (true) { if ("s$i" !in used) return "s$i"; i++ }
    }

    fun uniqueName(doc: SheetsDoc, name: String?): String {
        val base = (name ?: "Lap").trim().take(MAX_NAME - 4).ifEmpty { "Lap" }
        val used = doc.sheets.map { it.name }.toSet()
        if (base !in used) return base
        var i = 2
        while (true) { if ("$base $i" !in used) return "$base $i"; i++ }
    }

    // ------------------------------------------------------------ sheets
    fun addSheet(doc: SheetsDoc, name: String?, wins0: List<SheetWin> = emptyList()): SheetsDoc {
        if (doc.sheets.size >= MAX_SHEETS) return doc
        val id = newSheetId(doc)
        val d = doc.copy(sheets = doc.sheets + Sheet(id, uniqueName(doc, name), wins0, ""), active = id)
        return if (validate(d).ok) d else doc
    }

    fun removeSheet(doc: SheetsDoc, sid: String): SheetsDoc {
        val i = doc.sheets.indexOfFirst { it.id == sid }
        if (i < 0) return doc
        val rest = doc.sheets.filterIndexed { k, _ -> k != i }
        val active = if (doc.active == sid) (if (rest.isNotEmpty()) rest[minOf(i, rest.size - 1)].id else "") else doc.active
        return doc.copy(sheets = rest, active = active)
    }

    fun renameSheet(doc: SheetsDoc, sid: String, name: String?): SheetsDoc =
        if (okName(name)) edit(doc, sid) { it.copy(name = name!!.trim()) } else doc

    fun activate(doc: SheetsDoc, sid: String): SheetsDoc {
        if (sid.isNotEmpty() && sheetOf(doc, sid) == null) return doc
        if (doc.active == sid) return doc
        return doc.copy(active = sid)
    }

    fun moveSheet(doc: SheetsDoc, sid: String, delta: Int): SheetsDoc {
        val i = doc.sheets.indexOfFirst { it.id == sid }
        val j = i + delta
        if (i < 0 || j < 0 || j >= doc.sheets.size) return doc
        val l = doc.sheets.toMutableList()
        l.add(j, l.removeAt(i))
        return doc.copy(sheets = l)
    }

    fun setBar(doc: SheetsDoc, bar: String): SheetsDoc = if ((bar == "top" || bar == "bottom") && bar != doc.bar) doc.copy(bar = bar) else doc

    // ------------------------------------------------------------ windows
    /** A new window at `cell` (or the first free cell), one cell big; opened = it covers the sheet (max) unless max = false. */
    fun openWin(doc: SheetsDoc, sid: String, id: String, kind: String, open: String, state: String? = null, cell: Cell? = null, max: Boolean = true): SheetsDoc {
        val s0 = sheetOf(doc, sid) ?: return doc
        if (findWin(doc, id) != null) return doc
        val at = freeCell(s0, cell) ?: return doc
        return edit(doc, sid) { s ->
            val ws = if (max) s.wins.map { it.copy(max = false) } else s.wins
            s.copy(wins = ws + SheetWin(id, kind, open, state ?: "{}", at.c, at.r, 1, 1, max), focus = id)
        }
    }

    fun closeWin(doc: SheetsDoc, wid: String): SheetsDoc = editWin(doc, wid) { _, s ->
        val ws = s.wins.filter { it.id != wid }
        s.copy(wins = ws, focus = if (s.focus == wid) ws.lastOrNull()?.id ?: "" else s.focus)
    }

    fun focusWin(doc: SheetsDoc, wid: String): SheetsDoc = editWin(doc, wid) { _, s -> if (s.focus == wid) null else s.copy(focus = wid) }

    fun maximize(doc: SheetsDoc, wid: String): SheetsDoc = editWin(doc, wid) { w, s ->
        if (w.max) null else s.copy(wins = s.wins.map { it.copy(max = it.id == wid) }, focus = wid)
    }

    fun restore(doc: SheetsDoc, wid: String): SheetsDoc = editWin(doc, wid) { w, s -> if (!w.max) null else s.put(w.copy(max = false)) }

    /** Back to one cell at the tile's top-left (the cell is the window's own, so it is always free). */
    fun minimize(doc: SheetsDoc, wid: String): SheetsDoc = editWin(doc, wid) { w, s ->
        if (!w.max && w.w == 1 && w.h == 1) null else s.put(w.copy(max = false, w = 1, h = 1))
    }

    fun toggleMax(doc: SheetsDoc, wid: String): SheetsDoc {
        val (_, w) = findWin(doc, wid) ?: return doc
        return if (w.max) minimize(doc, wid) else maximize(doc, wid)
    }

    fun setState(doc: SheetsDoc, wid: String, state: String): SheetsDoc =
        if (okState(state)) editWin(doc, wid) { w, s -> if (sameState(w.state, state)) null else s.put(w.copy(state = state)) } else doc

    fun setKind(doc: SheetsDoc, wid: String, kind: String, open: String): SheetsDoc =
        if (kind in g.kinds && g.open.matches(open)) editWin(doc, wid) { w, s -> s.put(w.copy(kind = kind, open = open, state = "{}")) } else doc

    /**
     * The tile a resize drag asks for: `edge` is the one grabbed, `cell` the cell under the pointer. The edges not grabbed stay put; a
     * grabbed edge goes to the pointer, never past the opposite edge. Of the reachable free tiles the one nearest the pull wins, the
     * larger on a tie — so a window stops against its neighbour instead of jumping over it. → a tile, or null when the edge is unknown.
     */
    fun resizeTarget(sheet: Sheet, wid: String, edge: String, cell: Cell?): Tile? {
        val w = sheet.wins.firstOrNull { it.id == wid } ?: return null
        if (edge !in EDGES || cell == null) return null
        val pc = cell.c.coerceIn(0, g.cols - 1)
        val pr = cell.r.coerceIn(0, g.rows - 1)
        val L = w.c; val R = w.c + w.w - 1; val T = w.r; val B = w.r + w.h - 1
        var wL = L; var wR = R; var wT = T; var wB = B
        if ('e' in edge) wR = maxOf(pc, L)
        if ('w' in edge) wL = minOf(pc, R)
        if ('s' in edge) wB = maxOf(pr, T)
        if ('n' in edge) wT = minOf(pr, B)
        fun span(a: Int, b: Int) = minOf(a, b)..maxOf(a, b)
        var best: Triple<Tile, Int, Int>? = null
        for (l in span(L, wL)) for (r in span(R, wR)) for (t in span(T, wT)) for (b in span(B, wB)) {
            if (r < l || b < t) continue
            val tile = Tile(l, t, r - l + 1, b - t + 1)
            if (!fits(sheet, tile, wid)) continue
            val miss = Math.abs(l - wL) + Math.abs(r - wR) + Math.abs(t - wT) + Math.abs(b - wB)
            val area = tile.w * tile.h
            val bb = best
            if (bb == null || miss < bb.second || (miss == bb.second && area > bb.third)) best = Triple(tile, miss, area)
        }
        return best?.first ?: w.tile
    }

    fun resize(doc: SheetsDoc, wid: String, edge: String, cell: Cell?): SheetsDoc {
        val (s, w) = findWin(doc, wid) ?: return doc
        if (w.max) return doc
        val t = resizeTarget(s, wid, edge, cell) ?: return doc
        if (t == w.tile) return doc
        return editWin(doc, wid) { x, sh -> sh.put(x.at(t)) }
    }

    /**
     * A move drag: the tile's top-left goes to `cell` (clamped so the tile stays on the grid). Free → it moves. Covered by exactly one
     * window of the same size that fits where this one was → the two swap. Anything else → null (refused).
     */
    fun moveTarget(sheet: Sheet, wid: String, cell: Cell?): MoveTarget? {
        val w = sheet.wins.firstOrNull { it.id == wid } ?: return null
        if (cell == null) return null
        val t = Tile(cell.c.coerceIn(0, g.cols - w.w), cell.r.coerceIn(0, g.rows - w.h), w.w, w.h)
        if (t == w.tile) return MoveTarget(t)
        if (fits(sheet, t, wid)) return MoveTarget(t)
        val hit = sheet.wins.filter { it.id != wid && overlap(it.tile, t) }
        if (hit.size == 1 && hit[0].tile == t) return MoveTarget(t, hit[0].id, w.tile)
        return null
    }

    fun move(doc: SheetsDoc, wid: String, cell: Cell?): SheetsDoc {
        val (s, w) = findWin(doc, wid) ?: return doc
        if (w.max) return doc
        val m = moveTarget(s, wid, cell) ?: return doc
        if (m.tile == w.tile && m.swap.isEmpty()) return doc
        return edit(doc, s.id) { sh ->
            sh.copy(wins = sh.wins.map {
                when (it.id) {
                    wid -> it.at(m.tile)
                    m.swap -> it.at(m.back!!)
                    else -> it
                }
            })
        }
    }

    /** A window from one sheet to another: its tile when that is free there, else the first free cell (one cell big). */
    fun moveToSheet(doc: SheetsDoc, wid: String, sid: String): SheetsDoc {
        val (from, w) = findWin(doc, wid) ?: return doc
        val to = sheetOf(doc, sid) ?: return doc
        if (from.id == sid) return doc
        var tile = w.tile
        if (!fits(to, tile)) { val at = freeCell(to) ?: return doc; tile = Tile(at.c, at.r, 1, 1) }
        val d = doc.copy(sheets = doc.sheets.map { s ->
            when (s.id) {
                from.id -> { val ws = s.wins.filter { it.id != wid }; s.copy(wins = ws, focus = if (s.focus == wid) ws.lastOrNull()?.id ?: "" else s.focus) }
                sid -> s.copy(wins = (if (w.max) s.wins.map { it.copy(max = false) } else s.wins) + w.at(tile), focus = wid)
                else -> s
            }
        })
        return if (validate(d).ok) d else doc
    }

    /** What is drawn: each window's tile (the full grid when max) and whether another max window hides it. */
    fun view(sheet: Sheet): List<SheetView> {
        val top = sheet.wins.firstOrNull { it.max }
        return sheet.wins.map { SheetView(it.id, if (it.max) g.full else it.tile, it.max, top != null && top.id != it.id) }
    }

    /** The view on a screen lying down (D-16): every rect transposed. */
    fun viewOn(sheet: Sheet, lying: Boolean): List<SheetView> =
        if (!lying) view(sheet) else view(sheet).map { it.copy(rect = it.rect.transposed()) }

    // ------------------------------------------------------------ presets
    /**
     * A preset's windows as they are, with fresh pane ids. `resolve(open)` → Resolved | null (an item the page cannot turn into a window is
     * left out). Without `resolve` only `pane:` items open, as their own kind. → null when the preset is invalid.
     */
    fun fromPreset(doc: SheetsDoc, preset: SheetPreset, resolve: ((PresetWin) -> Resolved?)? = null, taken: Collection<String> = emptyList()): List<SheetWin>? {
        if (validPreset(preset).isNotEmpty()) return null
        val out = mutableListOf<SheetWin>()
        val used = taken.toMutableSet()
        for (pw in preset.wins) {
            val r = if (resolve != null) resolve(pw) else if (pw.open.startsWith("pane:")) Resolved(pw.open.removePrefix("pane:"), pw.open, pw.state) else null
            if (r == null || r.kind !in g.kinds) continue
            val id = newPaneId(doc.copy(sheets = listOf(Sheet("s0", "x", out)) + doc.sheets), r.kind, used)
            used += id
            out += SheetWin(id, r.kind, r.open ?: pw.open, r.state ?: pw.state, pw.c, pw.r, pw.w, pw.h, false)
        }
        return out
    }

    /** The sheet as a preset of the user's own (Mentés sablonként); same id → replaced. */
    fun savePreset(doc: SheetsDoc, sid: String, id: String?, name: String?): SheetsDoc {
        val s = sheetOf(doc, sid) ?: return doc
        if (id == null || !PRESET_ID.matches(id) || !okName(name)) return doc
        val fi = s.wins.indexOfFirst { it.id == s.focus }
        val p = SheetPreset(id, name!!.trim(), s.wins.map { PresetWin(it.open, it.state, it.c, it.r, it.w, it.h) }, if (fi >= 0) fi else null)
        val i = doc.mine.indexOfFirst { it.id == id }
        val mine = if (i >= 0) doc.mine.mapIndexed { k, x -> if (k == i) p else x } else { if (doc.mine.size >= MAX_PRESETS) return doc; doc.mine + p }
        val d = doc.copy(mine = mine)
        return if (validate(d).ok) d else doc
    }

    /** The window of a sheet made by fromPreset that the preset focuses ("" = none): found by its tile. */
    fun presetFocus(preset: SheetPreset?, wins: List<SheetWin>): String {
        val f = preset?.focus ?: return ""
        val pw = preset.wins.getOrNull(f) ?: return ""
        return wins.firstOrNull { it.c == pw.c && it.r == pw.r }?.id ?: ""
    }

    fun removePreset(doc: SheetsDoc, id: String): SheetsDoc =
        if (doc.mine.any { it.id == id }) doc.copy(mine = doc.mine.filter { it.id != id }) else doc

    /**
     * A preset made for another grid (the Desktop's 4 × 4) fitted onto this one (D-16): every edge is scaled to the nearest cell line
     * outward-in (start floored, end ceiled), items `keep` refuses are dropped first so they take no room, and an item that would
     * overlap one placed before it is dropped. The result is a valid preset of this grid; `focus` follows its item or is cleared.
     */
    fun fitPreset(p: SheetPreset, from: SheetRules, keep: (PresetWin) -> Boolean = { true }): SheetPreset {
        val out = mutableListOf<PresetWin>()
        var focus: Int? = null
        p.wins.forEachIndexed { i, w ->
            if (!keep(w)) return@forEachIndexed
            val c0 = w.c * g.cols / from.cols
            val c1 = ceilDiv((w.c + w.w) * g.cols, from.cols)
            val r0 = w.r * g.rows / from.rows
            val r1 = ceilDiv((w.r + w.h) * g.rows, from.rows)
            val t = Tile(c0, r0, maxOf(1, c1 - c0), maxOf(1, r1 - r0))
            if (!okTile(t) || out.any { overlap(it.tile, t) }) return@forEachIndexed
            if (p.focus == i) focus = out.size
            out += w.copy(c = t.c, r = t.r, w = t.w, h = t.h)
        }
        return p.copy(wins = out, focus = focus)
    }

    private fun ceilDiv(a: Int, b: Int) = (a + b - 1) / b
}

/** The doc as JSON text and back, in the Desktop's shape (desk.sheets). */
object SheetsCodec {
    fun encode(d: SheetsDoc): String = JSONObject()
        .put("v", d.v).put("active", d.active).put("bar", d.bar)
        .put("sheets", JSONArray(d.sheets.map { s ->
            JSONObject().put("id", s.id).put("name", s.name).put("focus", s.focus).put("wins", JSONArray(s.wins.map { w ->
                JSONObject().put("id", w.id).put("kind", w.kind).put("open", w.open).put("state", JSONObject(w.state))
                    .put("c", w.c).put("r", w.r).put("w", w.w).put("h", w.h).put("max", w.max)
            }))
        }))
        .put("mine", JSONArray(d.mine.map(::presetJson)))
        .toString()

    fun presetJson(p: SheetPreset): JSONObject {
        val o = JSONObject().put("id", p.id).put("name", p.name).put("wins", JSONArray(p.wins.map { w ->
            JSONObject().put("open", w.open).put("state", JSONObject(w.state)).put("c", w.c).put("r", w.r).put("w", w.w).put("h", w.h)
        }))
        p.focus?.let { o.put("focus", it) }
        return o
    }

    /** Text → doc, or null when it is not a doc of the expected shape (the caller then validates it with its rules). */
    fun decode(text: String?): SheetsDoc? = try {
        val o = JSONObject(text ?: return null)
        if (!o.keys().asSequence().toSet().equals(setOf("v", "active", "bar", "sheets", "mine"))) null
        else SheetsDoc(
            v = o.getInt("v"), active = o.getString("active"), bar = o.getString("bar"),
            sheets = o.getJSONArray("sheets").objects().map { s ->
                Sheet(s.getString("id"), s.getString("name"), s.getJSONArray("wins").objects().map { w ->
                    SheetWin(w.getString("id"), w.getString("kind"), w.getString("open"), w.getJSONObject("state").toString(),
                        w.getInt("c"), w.getInt("r"), w.getInt("w"), w.getInt("h"), w.getBoolean("max"))
                }, s.getString("focus"))
            },
            mine = o.getJSONArray("mine").objects().map(::presetOf),
        )
    } catch (e: Exception) { null }

    fun presetOf(p: JSONObject): SheetPreset = SheetPreset(
        p.getString("id"), p.getString("name"),
        p.getJSONArray("wins").objects().map { w ->
            PresetWin(w.getString("open"), w.optJSONObject("state")?.toString() ?: "{}", w.getInt("c"), w.getInt("r"), w.getInt("w"), w.getInt("h"))
        },
        if (p.has("focus")) p.getInt("focus") else null,
    )

    private fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }
}

/** The phone's side of Lapok: what a Desktop window becomes here, and the Desktop presets fitted to the 2 × 4 grid. */
object PhoneSheets {
    /** Desktop panes the phone has its own feature for. The rest (files, term, mail, web, git, feed) wait for M23. */
    private val PANES = mapOf("note" to Catalogue.NOTES.id, "stack" to Catalogue.STACK.id, "chat" to Catalogue.CLAUDE.id)

    /** Shell parts, not windows: the Asztal and Lapok themselves. */
    private val FRAME = setOf(Catalogue.DESK.id, Catalogue.SHEETS.id)

    /** A phone feature that can be a window: known, not only planned, not the frame. */
    fun isWindow(featureId: String): Boolean {
        val f = Catalogue.byId(featureId) ?: return false
        return f.stage != Stage.PLANNED && f.id !in FRAME
    }

    fun feat(featureId: String): Resolved? = if (isWindow(featureId)) Resolved("feat", "feat:$featureId", "{}") else null

    /** An `open` → what the phone shows, or null (left out, as the Desktop leaves out a cat: item it cannot open). */
    fun resolve(open: String, state: String = "{}"): Resolved? = when {
        open == "pane:home" -> Resolved("home", open, state)
        open.startsWith("pane:") -> PANES[open.removePrefix("pane:")]?.let(::feat)
        open.startsWith("feat:") -> feat(open.removePrefix("feat:"))?.copy(state = state)
        open.startsWith("cat:") -> DeskCatalog.UNITS.firstOrNull { it.id == open.removePrefix("cat:") }?.let { u ->
            when (u.reach) {
                Reach.NATIVE -> feat(u.target)
                // a web app (M21): the Desktop's own window kind, opened by its owner id (Ügyfélnézet → the Planner's origin)
                Reach.WEBAPP -> if (isWindow(Catalogue.APPS.id) && DeskApps.ALL.any { it.id == u.target }) Resolved("app", "cat:${u.target}", "{}") else null
                else -> null
            }
        }
        else -> null
    }

    /** The Desktop's User-level presets on the phone's grid: what the phone cannot show takes no room, then fitPreset (D-16). */
    val PRESETS: List<SheetPreset> by lazy {
        DeskSheets.PRESETS.map { Sheets.phone.fitPreset(it, SheetRules.DESKTOP) { w -> resolve(w.open, w.state) != null } }
    }

    /** A preset's windows ready for a new sheet. */
    fun windows(doc: SheetsDoc, p: SheetPreset): List<SheetWin> =
        Sheets.phone.fromPreset(doc, p, { resolve(it.open, it.state) }).orEmpty()
}
