package hu.vrg.mobile.core

import org.json.JSONObject
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertSame
import kotlin.test.assertTrue

// WP M20 Lapok. The first part mirrors Dashboard/test/wp-46.test.js case by case on the Desktop's 4 × 4 rules (Sheets.desktop):
// same inputs, same expected tiles, and `assertSame` where the JS test checks that an op returns the same doc. The second part is the
// phone's own: the 2 × 4 grid, the lying-down transpose (D-16), the fitted presets, the resolver and the JSON codec.

class SheetsTest {
    private val L = Sheets.desktop
    private fun T(c: Int, r: Int, w: Int, h: Int) = Tile(c, r, w, h)
    private fun C(c: Int, r: Int) = Cell(c, r)
    private fun tile(d: SheetsDoc, id: String) = L.findWin(d, id)!!.second.tile
    private fun win(id: String, c: Int, r: Int, w: Int, h: Int, max: Boolean = false, kind: String = "files") =
        SheetWin(id, kind, "pane:$kind", "{}", c, r, w, h, max)

    /** A doc with one sheet holding `wins`. */
    private fun sheetWith(vararg wins: SheetWin, rules: Sheets = L): SheetsDoc {
        val d = rules.addSheet(rules.empty(), "Teszt", wins.toList())
        assertTrue(rules.validate(d).ok, rules.validate(d).toString())
        return d
    }

    // ------------------------------------------------------------ wp-46 mirrored

    @Test fun emptyDocAndSheets() {
        val e = L.empty()
        assertEquals(Valid.Ok, L.validate(e))
        var d = L.addSheet(e, "Iroda")
        d = L.addSheet(d, "Iroda")
        assertEquals(listOf("s1" to "Iroda", "s2" to "Iroda 2"), d.sheets.map { it.id to it.name })
        assertEquals("s2", d.active)
        assertSame(d, L.activate(d, "nope"), "unknown sheet: the same doc")
        assertEquals("", L.activate(d, "").active, "'' = the Munkapad")
        val r = L.removeSheet(d, "s2")
        assertEquals("s1", r.active, "closing the active sheet activates its neighbour")
        assertEquals("", L.removeSheet(r, "s1").active)
    }

    @Test fun validationRefuses() {
        val ok = sheetWith(win("a", 0, 0, 2, 2), win("b", 2, 0, 2, 2))
        fun bad(mut: (SheetWin) -> SheetWin, i: Int = 1) =
            (L.validate(ok.copy(sheets = ok.sheets.map { s -> s.copy(wins = s.wins.mapIndexed { k, w -> if (k == i) mut(w) else w }) })) as Valid.Bad).err
        assertEquals("overlap", bad({ it.copy(c = 1) }))
        assertEquals("tile", bad({ it.copy(w = 3) }))
        val twoMax = ok.copy(sheets = ok.sheets.map { s -> s.copy(wins = s.wins.map { it.copy(max = true) }) })
        assertEquals("two-max", (L.validate(twoMax) as Valid.Bad).err)
        assertEquals("duplicate-id", bad({ it.copy(id = "a") }))
        assertEquals("kind", bad({ it.copy(kind = "shell") }))
        assertEquals("open", bad({ it.copy(open = "file:C:/x") }))
        assertEquals("win-id", bad({ it.copy(id = "../x") }))
        assertEquals("active", (L.validate(ok.copy(active = "s9")) as Valid.Bad).err)
        assertEquals("doc", (L.validate(ok.copy(v = 2)) as Valid.Bad).err)
        assertEquals("state", bad({ it.copy(state = JSONObject().put("big", "x".repeat(9000)).toString()) }, 0))
        assertEquals("open", (Sheets.desktop.validate(sheetWith(win("a", 0, 0, 1, 1), rules = Sheets.phone).let { d ->
            d.copy(sheets = d.sheets.map { s -> s.copy(wins = s.wins.map { it.copy(open = "feat:notes", kind = "files") }) }) }) as Valid.Bad).err,
            "feat: is the phone's, not the Desktop's")
    }

    @Test fun openingTakesOneCellAndGoesFull() {
        var d = L.addSheet(L.empty(), "A")
        d = L.openWin(d, "s1", "w-term-1", "term", "pane:term", """{"prof":"pwsh"}""", C(2, 1))
        val w = L.findWin(d, "w-term-1")!!.second
        assertEquals(listOf(2, 1, 1, 1), listOf(w.c, w.r, w.w, w.h)); assertTrue(w.max, "opened = all cells (max), its tile is the tapped cell")
        d = L.openWin(d, "s1", "w-git-1", "git", "pane:git", null, C(2, 1))
        assertEquals(T(0, 0, 1, 1), tile(d, "w-git-1"), "a taken cell → the first free cell")
        assertEquals(false, L.findWin(d, "w-term-1")!!.second.max, "one full window per sheet: the new one")
        assertEquals("w-git-1", L.sheetOf(d, "s1")!!.focus)
        val full = sheetWith(win("a", 0, 0, 4, 4))
        assertSame(full, L.openWin(full, "s1", "b", "web", "pane:web", null, C(0, 0)), "no free cell → the same doc")
        assertSame(d, L.openWin(d, "s1", "w-git-1", "git", "pane:git"), "a pane id is never used twice")
    }

    @Test fun doubleTapFullAndOneCell() {
        var d = sheetWith(win("a", 1, 1, 2, 2), win("b", 0, 0, 1, 1))
        d = L.toggleMax(d, "a")
        assertTrue(L.findWin(d, "a")!!.second.max)
        assertEquals(T(1, 1, 2, 2), tile(d, "a"), "full keeps its tile underneath")
        val v = L.view(L.sheetOf(d, "s1")!!)
        assertEquals(SheetRules.DESKTOP.full, v.first { it.id == "a" }.rect)
        assertTrue(v.first { it.id == "b" }.covered, "the others wait under it")
        assertEquals(T(1, 1, 2, 2), tile(L.restore(d, "a"), "a"), "restore: back to the tile it had")
        d = L.toggleMax(d, "a")
        assertEquals(T(1, 1, 1, 1), tile(d, "a")); assertEquals(false, L.findWin(d, "a")!!.second.max, "the header double-tap: one cell")
        assertSame(d, L.minimize(d, "a"), "already one cell: the same doc")
    }

    @Test fun resizeSnapsAndStops() {
        var d = sheetWith(win("a", 0, 0, 1, 1), win("n", 3, 0, 1, 4))
        assertEquals(T(0, 0, 2, 1), tile(L.resize(d, "a", "e", C(1, 0)), "a"), "east edge one cell: 2×1")
        assertEquals(T(0, 0, 1, 2), tile(L.resize(d, "a", "s", C(0, 1)), "a"), "south edge: 1×2")
        assertEquals(T(0, 0, 2, 2), tile(L.resize(d, "a", "se", C(1, 1)), "a"), "corner: 2×2")
        assertEquals(T(0, 0, 3, 4), tile(L.resize(d, "a", "se", C(3, 3)), "a"), "the neighbour in column 3 stops it at column 2")
        d = L.resize(d, "a", "se", C(2, 2))
        assertEquals(T(0, 0, 3, 3), tile(d, "a"))
        assertEquals(T(2, 0, 1, 3), tile(L.resize(d, "a", "w", C(2, 0)), "a"), "the west edge pulled right shrinks it, never past the east edge")
        assertEquals(T(2, 2, 1, 1), tile(L.resize(d, "a", "nw", C(3, 3)), "a"))
        val m = sheetWith(win("a", 1, 1, 1, 1, max = true))
        assertSame(m, L.resize(m, "a", "e", C(3, 1)), "a full window does not resize")
        val blocked = sheetWith(win("a", 0, 0, 1, 1), win("b", 1, 0, 1, 1))
        assertSame(blocked, L.resize(blocked, "a", "e", C(3, 0)), "nothing free that way: the same doc")
    }

    @Test fun moveFreeSwapOrRefuse() {
        val d = sheetWith(win("a", 0, 0, 2, 2), win("b", 2, 2, 2, 2), win("c", 2, 0, 1, 1))
        assertEquals(T(0, 2, 2, 2), tile(L.move(d, "a", C(0, 2)), "a"), "free → it moves")
        val sw = L.move(d, "a", C(2, 2))
        assertEquals(listOf(T(2, 2, 2, 2), T(0, 0, 2, 2)), listOf(tile(sw, "a"), tile(sw, "b")), "same size → swap")
        assertSame(d, L.move(d, "a", C(1, 1)), "half over another window → refused")
        assertSame(d, L.move(d, "c", C(0, 0)), "onto a bigger window → refused")
        assertEquals(T(2, 2, 2, 2), tile(L.move(d, "a", C(3, 3)), "a"), "past the edge → clamped, where b is the same size: swap")
        assertTrue(L.okTile(tile(L.move(d, "c", C(9, 9)), "c")), "never off the grid")
    }

    @Test fun moveToAnotherSheet() {
        var d = sheetWith(win("a", 1, 1, 2, 2))
        d = L.addSheet(d, "B", listOf(SheetWin("b", "web", "pane:web", "{}", 1, 1, 1, 1, false)))
        val m = L.moveToSheet(d, "a", "s2")
        assertEquals("s2", L.findWin(m, "a")!!.first.id)
        assertEquals(T(0, 0, 1, 1), tile(m, "a"), "its 2×2 tile is not free there")
        assertTrue(L.validate(m).ok)
    }

    @Test fun closeFocusStateKind() {
        var d = sheetWith(win("a", 0, 0, 1, 1), win("b", 1, 0, 1, 1))
        d = L.focusWin(d, "b")
        d = L.closeWin(d, "b")
        assertEquals("a", L.sheetOf(d, "s1")!!.focus)
        d = L.setState(d, "a", """{"left":{"root":"x"}}""")
        assertTrue(Sheets.sameState("""{ "left": { "root": "x" } }""", L.findWin(d, "a")!!.second.state))
        assertSame(d, L.setState(d, "a", JSONObject().put("x", "y".repeat(9000)).toString()), "too big a state is not taken")
        assertSame(d, L.setState(d, "a", """{"left":{"root":"x"}}"""), "the same state: the same doc")
        assertEquals("term", L.findWin(L.setKind(d, "a", "term", "pane:term"), "a")!!.second.kind)
    }

    @Test fun presetsFreshIdsResolveSaveRemove() {
        val p = SheetPreset("dev", "Fejlesztés", listOf(
            PresetWin("pane:term", """{"prof":"pwsh"}""", 0, 0, 2, 4), PresetWin("cat:planner", "{}", 2, 0, 2, 2), PresetWin("pane:git", "{}", 2, 2, 2, 2)))
        var d = L.addSheet(L.empty(), "X", listOf(SheetWin("w-term-1", "term", "pane:term", "{}", 0, 0, 1, 1, false)))
        val plain = L.fromPreset(d, p, null, listOf("w-git-1"))!!
        assertEquals(listOf("w-term-2", "w-git-2"), plain.map { it.id }, "ids unique over the doc and the taken ones; the unresolved cat: item is left out")
        val all = L.fromPreset(d, p, { pw -> if (pw.open == "cat:planner") Resolved("app", pw.open, """{"id":"planner"}""") else Resolved(pw.open.removePrefix("pane:"), null, pw.state) })!!
        assertEquals(3, all.size)
        d = L.addSheet(d, p.name, all)
        assertTrue(L.validate(d).ok)
        assertNull(L.fromPreset(d, SheetPreset("x", "x", listOf(PresetWin("pane:files", "{}", 0, 0, 2, 2), PresetWin("pane:git", "{}", 1, 1, 1, 1)))), "an overlapping preset is refused")
        d = L.savePreset(d, d.active, "sajat", "Saját")
        assertEquals(listOf("pane:term", "cat:planner", "pane:git"), d.mine[0].wins.map { it.open })
        assertEquals(0, L.removePreset(d, "sajat").mine.size)
    }

    @Test fun presetFocusByTile() {
        val wins = listOf(PresetWin("pane:files", "{}", 0, 0, 2, 2), PresetWin("cat:nope", "{}", 2, 0, 2, 2), PresetWin("pane:web", "{}", 0, 2, 4, 2))
        assertEquals("", L.validPreset(SheetPreset("f", "F", wins, 2)))
        for (bad in listOf(3, -1)) assertEquals("preset-focus", L.validPreset(SheetPreset("f", "F", wins, bad)), bad.toString())
        val p = SheetPreset("f", "F", wins, 2)
        var d = L.empty()
        val out = L.fromPreset(d, p)!!
        assertEquals(2, out.size)
        assertEquals(out[1].id, L.presetFocus(p, out), "the web window, by its tile")
        assertEquals("", L.presetFocus(SheetPreset("f", "F", wins.take(2), 1), L.fromPreset(d, SheetPreset("f", "F", wins.take(2)))!!), "a skipped item focuses nothing")
        assertEquals("", L.presetFocus(SheetPreset("g", "G", wins), out), "no focus → none")
        d = L.addSheet(d, "F", out)
        d = L.focusWin(d, out[1].id)
        d = L.savePreset(d, d.active, "sajat", "Saját")
        assertEquals(1, d.mine[0].focus)
        assertTrue(L.validate(d).ok)
        d = L.focusWin(d, out[0].id)
        assertEquals(0, L.savePreset(d, d.active, "sajat", "Saját").mine[0].focus)
    }

    @Test fun deskSheetsMatchesTheDesktopConfig() {
        val repo = File(System.getProperty("vrg.repo") ?: "../..")
        val cfg = JSONObject(File(repo, "Dashboard/config/sheets.json").readText()).getJSONArray("presets")
        val user = (0 until cfg.length()).map { cfg.getJSONObject(it) }.filter { it.getString("level") == "user" }
        assertEquals(user.map { it.getString("id") }, DeskSheets.PRESETS.map { it.id })
        assertTrue(DeskSheets.PRESETS.size >= 5)
        for (p in DeskSheets.PRESETS) assertEquals("", L.validPreset(p), p.id)
    }

    // ------------------------------------------------------------ the phone (D-16)

    private val P = Sheets.phone

    @Test fun phoneGridIsTwoByFour() {
        val d = sheetWith(win("a", 0, 0, 2, 4), rules = P)
        assertTrue(P.validate(d).ok)
        val off = d.copy(sheets = d.sheets.map { s -> s.copy(wins = s.wins.map { it.copy(w = 3) }) })
        assertEquals("tile", (P.validate(off) as Valid.Bad).err)
        var e = P.addSheet(P.empty(), "Lap")
        repeat(8) { i -> e = P.openWin(e, "s1", "w-feat-${i + 1}", "feat", "feat:notes", max = false) }
        assertEquals(8, P.sheetOf(e, "s1")!!.wins.size)
        assertSame(e, P.openWin(e, "s1", "w-feat-9", "feat", "feat:notes"), "eight cells: the ninth is refused")
        assertEquals(T(1, 3, 1, 1), P.findWin(e, "w-feat-8")!!.second.tile, "filled row by row")
        assertEquals(T(0, 0, 2, 4), P.resizeTarget(P.sheetOf(sheetWith(win("a", 0, 0, 1, 1), rules = P), "s1")!!, "a", "se", C(5, 9)), "clamped to 2 × 4")
    }

    @Test fun lyingDownIsTheTranspose() {
        val d = sheetWith(win("a", 0, 0, 2, 1), win("b", 0, 1, 1, 3), win("c", 1, 1, 1, 1), rules = P)
        val s = P.sheetOf(d, "s1")!!
        val lying = P.viewOn(s, lying = true)
        assertEquals(T(0, 0, 1, 2), lying.first { it.id == "a" }.rect)
        assertEquals(T(1, 0, 3, 1), lying.first { it.id == "b" }.rect)
        // the transposed rects fit a 4 × 2 grid and never overlap
        val g42 = Sheets(SheetRules(4, 2, SheetRules.PHONE.kinds, SheetRules.PHONE.open))
        assertTrue(lying.all { g42.okTile(it.rect) })
        for (i in lying.indices) for (j in i + 1 until lying.size) assertTrue(!g42.overlap(lying[i].rect, lying[j].rect))
        // a drag on the lying screen, turned back: the screen's east edge of a is the model's south edge
        assertEquals("s", Sheets.transposeEdge("e"))
        assertEquals("ne", Sheets.transposeEdge("sw"))
        for (e in Sheets.EDGES) assertEquals(e, Sheets.transposeEdge(Sheets.transposeEdge(e)), "an involution")
        val c = P.sheetOf(sheetWith(win("a", 0, 0, 1, 1), rules = P), "s1")!!
        // lying: pull a's screen-east edge to screen cell (2, 0) → model south edge to row 2 → a is 1 × 3 upright, 3 × 1 lying
        val t = P.resizeTarget(c, "a", Sheets.transposeEdge("e"), C(2, 0).transposed())!!
        assertEquals(T(0, 0, 1, 3), t)
        assertEquals(T(0, 0, 3, 1), t.transposed())
        assertEquals(SheetRules.PHONE.full.transposed(), P.viewOn(sheetWith(win("m", 0, 0, 1, 1, true), rules = P).sheets[0], true)[0].rect)
    }

    @Test fun phoneResolver() {
        assertEquals(Resolved("home", "pane:home", "{}"), PhoneSheets.resolve("pane:home"))
        assertEquals("feat:notes", PhoneSheets.resolve("pane:note")!!.open)
        assertEquals("feat:stack", PhoneSheets.resolve("pane:stack")!!.open)
        assertEquals("feat:archive", PhoneSheets.resolve("cat:archive")!!.open, "a native catalog unit opens its feature")
        assertEquals("feat:inbox", PhoneSheets.resolve("cat:notifications")!!.open)
        assertEquals(Resolved("app", "cat:planner", "{}"), PhoneSheets.resolve("cat:planner"), "a web app is an app window (M21)")
        assertEquals("cat:planner", PhoneSheets.resolve("cat:client-preview")!!.open, "Ügyfélnézet opens the Planner's origin")
        assertEquals("feat:pcwin", PhoneSheets.resolve("cat:workflow-kit")!!.open, "a PC folder unit is the PC ablakok window (M23)")
        assertEquals("feat:pcwin", PhoneSheets.resolve("pane:files")!!.open)
        assertNull(PhoneSheets.resolve("cat:feed"), "the feed stays on the PC (D-18)")
        assertNull(PhoneSheets.resolve("cat:desktop"), "the frame is not a window")
        assertNull(PhoneSheets.resolve("cat:workspaces"), "Lapok itself is not a window")
        assertNull(PhoneSheets.resolve("pane:mail"))
        assertNull(PhoneSheets.resolve("pane:feed"))
        assertNull(PhoneSheets.resolve("feat:nope"))
        assertEquals("feat:airdeck", PhoneSheets.resolve("feat:airdeck")!!.open)
    }

    @Test fun phonePresetsFitTheGrid() {
        val ps = PhoneSheets.PRESETS
        assertEquals(DeskSheets.PRESETS.map { it.id }, ps.map { it.id })
        for (p in ps) assertEquals("", P.validPreset(p), p.id)
        val over = ps.first { it.id == "attekintes" }
        assertEquals(listOf("pane:home", "pane:files"), over.wins.map { it.open }, "the feed stays on the PC (D-18); files = PC ablakok (M23)")
        assertEquals(T(0, 0, 2, 3), over.wins[0].tile, "3 of 4 columns → both phone columns, rows kept")
        assertEquals(T(0, 3, 2, 1), over.wins[1].tile, "the files strip along the bottom")
        val iroda = ps.first { it.id == "iroda" }
        assertEquals(listOf("cat:planner"), iroda.wins.map { it.open }, "the Planner takes both columns; the calculator would overlap it")
        assertEquals(T(0, 0, 2, 4), iroda.wins[0].tile)
        assertEquals(listOf("cat:inventory"), ps.first { it.id == "keszlet" }.wins.map { it.open })
        // the fitting rule on its own, with everything kept
        val fit = P.fitPreset(DeskSheets.PRESETS.first { it.id == "attekintes" }, SheetRules.DESKTOP)
        assertEquals(listOf("pane:home", "pane:files"), fit.wins.map { it.open }, "feed would overlap home on two columns: dropped")
        assertEquals(T(0, 3, 2, 1), fit.wins[1].tile)
        val f = P.fitPreset(SheetPreset("x", "X", listOf(PresetWin("pane:note", "{}", 0, 0, 2, 2), PresetWin("pane:web", "{}", 2, 0, 2, 4)), focus = 1), SheetRules.DESKTOP)
        assertEquals(listOf(T(0, 0, 1, 2), T(1, 0, 1, 4)), f.wins.map { it.tile })
        assertEquals(1, f.focus, "the focus follows its item")
        var d = P.empty()
        d = P.addSheet(d, over.name, PhoneSheets.windows(d, over))
        assertTrue(P.validate(d).ok)
        assertEquals(listOf("home", "feat"), d.sheets[0].wins.map { it.kind })
        assertEquals("feat:pcwin", d.sheets[0].wins[1].open)
    }

    @Test fun codecRoundTrip() {
        var d = P.addSheet(P.empty(), "Iroda", listOf(SheetWin("w-feat-1", "feat", "feat:notes", """{"a":[1,"b"]}""", 0, 0, 2, 2, false)))
        d = P.openWin(d, "s1", "w-home-1", "home", "pane:home")
        d = P.savePreset(d, "s1", "sajat", "Saját")
        val text = SheetsCodec.encode(d)
        val back = SheetsCodec.decode(text)
        assertNotNull(back)
        assertTrue(P.validate(back).ok)
        assertEquals(SheetsCodec.encode(back), text)
        assertEquals(d.sheets[0].wins.map { it.tile }, back.sheets[0].wins.map { it.tile })
        assertNull(SheetsCodec.decode("""{"v":1}"""), "the wrong shape")
        assertNull(SheetsCodec.decode("not json"))
        assertNull(SheetsCodec.decode(null))
        // a Desktop doc decodes, and the phone's rules say whether it fits
        val desk = SheetsCodec.decode(SheetsCodec.encode(sheetWith(win("a", 0, 0, 4, 1))))!!
        assertEquals("tile", (P.validate(desk) as Valid.Bad).err, "a 4-wide Desktop tile does not fit the phone")
    }
}
