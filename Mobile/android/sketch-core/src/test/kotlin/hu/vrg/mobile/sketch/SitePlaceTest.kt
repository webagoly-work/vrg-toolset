package hu.vrg.mobile.sketch

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Helyszín ↔ Térkép (F1). Sketcher/test/fixtures/site.json is written by Map/lib/site-math.js (the map page and the
// Desktop); every case is replayed here through SitePlace, so the three cannot disagree on where the sketch sits.
class SitePlaceTest {
    private val repo = File(System.getProperty("vrg.repo") ?: "../..")
    private val fixture = JSONObject(File(repo, "Sketcher/test/fixtures/site.json").readText())

    private fun near(a: Double, b: Double, t: Double, m: String) = assertTrue(abs(a - b) <= t, "$m: $a ≠ $b")
    private fun ll(a: JSONArray) = (0 until a.length()).map { a.getJSONArray(it).let { p -> p.getDouble(0) to p.getDouble(1) } }
    private fun rooms(a: JSONArray) = (0 until a.length()).map { i ->
        val r = a.getJSONObject(i); val p = r.getJSONArray("poly")
        SitePlace.PRoom(r.getString("name"), (0 until p.length()).map { Pt(p.getJSONArray(it).getDouble(0), p.getJSONArray(it).getDouble(1)) })
    }
    private fun place(o: JSONObject?) = o?.let { Placement(it.getDouble("lat"), it.getDouble("lon"), it.getDouble("rot"), it.optBoolean("auto")) }

    @Test fun theJsMathsReplayed() {
        val cases = fixture.getJSONArray("cases")
        assertTrue(cases.length() >= 6)
        for (i in 0 until cases.length()) {
            val c = cases.getJSONObject(i); val about = c.getString("about")
            val outline = ll(c.getJSONArray("outline")); val rs = rooms(c.getJSONArray("rooms"))
            // the footprint: the same oriented size as the JS (and as SiteMath, the M30 comparison)
            val fpJ = c.getJSONObject("footprint")
            val fb = SitePlace.obox(outline.map { SitePlace.local(outline.sumOf { it.first } / outline.size, outline.sumOf { it.second } / outline.size, it.first, it.second) })!!
            near(fb.w, fpJ.getDouble("w"), 0.02, "$about: w"); near(fb.d, fpJ.getDouble("d"), 0.02, "$about: d")
            near(fb.axis, fpJ.getDouble("axis"), 0.11, "$about: axis")
            val fp = SiteMath.footprint(outline, "rajz", 0)
            near(fp.w, fpJ.getDouble("w"), 0.15, "$about: SiteMath w"); near(fp.area, fpJ.getDouble("area"), 0.2, "$about: area")
            // the first fit
            val fit = SitePlace.autoFit(rs, outline)
            if (c.isNull("fit")) { assertNull(fit, about); continue }
            val fj = c.getJSONObject("fit")
            assertNotNull(fit, about)
            near(fit.lat, fj.getDouble("lat"), 1e-6, "$about: lat"); near(fit.lon, fj.getDouble("lon"), 1e-6, "$about: lon")
            near(fit.rot, fj.getDouble("rot"), 0.11, "$about: rot")
            // the report on the (possibly user-moved) placement
            val p = place(c.getJSONObject("place"))!!
            val r = SitePlace.report(rs, outline, p)!!
            val rj = c.getJSONObject("report")
            assertEquals(rj.getString("verdict"), r.verdict, about)
            near(r.turn, rj.getDouble("turn"), 0.11, "$about: turn"); near(r.offset, rj.getDouble("offset"), 0.02, "$about: offset")
            assertEquals(rj.getString("offsetDir"), r.offsetDir, about)
            val wj = rj.getJSONArray("walls")
            assertEquals(wj.length(), r.walls.size, "$about: walls")
            r.walls.forEachIndexed { k, w ->
                val x = wj.getJSONObject(k)
                assertEquals(x.getInt("room") to x.getInt("edge"), w.room to w.edge, about); assertEquals(x.getString("dir"), w.dir, about)
                near(w.out, x.getDouble("out"), 0.02, "$about: out")
            }
            val lj = c.getJSONArray("lines")
            assertEquals((0 until lj.length()).map { lj.getString(it) }, SitePlace.lines(r), about)
            // the corners the map draws
            val cj = c.getJSONArray("corners"); val got = SitePlace.placedLonLat(rs, p)
            assertEquals(cj.length(), got.size)
            got.forEachIndexed { ri, ring -> ring.forEachIndexed { k, q ->
                val e = cj.getJSONArray(ri).getJSONArray(k); near(q.first, e.getDouble(0), 2e-7, "$about: lon"); near(q.second, e.getDouble(1), 2e-7, "$about: lat")
            } }
        }
    }

    @Test fun theSolvedSketchPlacedOnAHouse() {
        var s = Sketch("S")
        val (s1, a) = Ops.addRectRoom(s, Pt(0.0, 0.0), Pt(120.0, 80.0), 4.0)!!; s = s1
        s = Ops.setMeasure(s, a, MeasureKind.WIDTH, 12000); s = Ops.setMeasure(s, a, MeasureKind.DEPTH, 8000)
        val rs = SitePlace.rooms(Solver().solve(s))
        val outline = listOf(-6.0 to -4.0, 6.0 to -4.0, 6.0 to 4.0, -6.0 to 4.0).map { (x, y) -> SitePlace.turn(Pt(x, y), 30.0) }
            .map { SitePlace.toLatLon(47.5, 19.05, it.x, it.y) }
        val p = SitePlace.autoFit(rs, outline, 7)!!
        near(p.rot, 30.0, 0.11, "turned to the building"); assertEquals(7, p.at)
        assertEquals("rendben", SitePlace.report(rs, outline, p)!!.verdict)
        val moved = SitePlace.report(rs, outline, p.copy(lat = p.lat + 2 / 111195.0))!!
        assertEquals("kilog", moved.verdict); near(moved.offset, 2.0, 0.05, "2 m north"); assertEquals("É", moved.offsetDir)
        assertTrue(moved.walls.any { it.dir == "ÉNy" || it.dir == "É" }, "the northern wall sticks out")
        assertNull(SitePlace.report(rs, outline, null)); assertNull(SitePlace.autoFit(emptyList(), outline))
    }

    @Test fun outlineAndPlacementInTheFile() {
        val o = listOf(47.5 to 19.05, 47.5001 to 19.05, 47.5001 to 19.0502)
        val s = Sketch("S", site = Site("x", 47.5, 19.05, "gps", SiteMath.footprint(o, "rajz", 3), o, Placement(47.50005, 19.0501, -12.5, false, 9)))
        val back = SketchJson.read(SketchJson.write(s).toString())!!
        assertEquals(o, back.site!!.outline); assertEquals(Placement(47.50005, 19.0501, -12.5, false, 9), back.site!!.place)
        assertEquals(2, SketchJson.write(s).getInt("v"), "the survey file stays v2")
        // a v2 file written before F1 opens unchanged: no outline, no placement, the old footprint kept
        val old = JSONObject(SketchJson.write(Sketch("O", site = Site("y", 47.1, 19.2, "osm", Footprint(12.0, 8.0, 96.0, 17.0, "osm", 1)))).toString())
        assertTrue(!old.getJSONObject("site").has("outline") && !old.getJSONObject("site").has("place"), "nothing new written when empty")
        val o2 = SketchJson.read(old.toString())!!
        assertEquals(emptyList(), o2.site!!.outline); assertNull(o2.site!!.place); assertEquals(12.0, o2.site!!.footprint!!.w)
        // a broken outline or placement is dropped, not a crash
        val bad = JSONObject(old.toString()); bad.getJSONObject("site").put("outline", JSONArray("[[1,2],[\"x\",3]]")).put("place", JSONObject().put("lat", "?"))
        assertEquals(emptyList(), SketchJson.read(bad.toString())!!.site!!.outline); assertNull(SketchJson.read(bad.toString())!!.site!!.place)
    }

    @Test fun theMapPagesAnswer() {
        var s = Sketch("v1abc", name = "Teszt")
        val (s1, _) = Ops.addRectRoom(s, Pt(0.0, 0.0), Pt(120.0, 80.0), 4.0)!!; s = s1
        val pay = SiteLink.payload(s, Solver().solve(s))
        assertEquals("vrg-site", pay.getString("kind")); assertEquals(1, pay.getJSONArray("rooms").length())
        assertTrue(!pay.has("address"), "the page does not get the address")
        val o = listOf(47.5 to 19.05, 47.5001 to 19.05, 47.5001 to 19.0502, 47.5 to 19.0502)
        val r = SiteLink.parseResult(SiteLink.resultJson("v1abc", o, "muhold", Placement(47.50005, 19.0501, 3.0, false)).toString())!!
        val after = SiteLink.apply(s, r, 42)
        assertEquals(o, after.site!!.outline); assertEquals("muhold", after.site!!.footprint!!.src); assertEquals(42, after.site!!.place!!.at)
        assertEquals("terkep", after.site!!.source, "no place yet: the outline's middle becomes it")
        // the place is kept when the page only cleared the placement
        val cleared = SiteLink.apply(after, SiteLink.parseResult(SiteLink.resultJson("v1abc", null, "rajz", null).toString())!!, 43)
        assertNull(cleared.site!!.place); assertEquals(o, cleared.site!!.outline)
        val centred = SiteLink.apply(cleared, SiteLink.parseResult(SiteLink.resultJson("v1abc", null, "rajz", null, 47.6 to 19.1).toString())!!, 44)
        assertEquals(47.6, centred.site!!.lat); assertEquals("terkep", centred.site!!.source); assertEquals(o, centred.site!!.outline)
        assertNull(SiteLink.parseResult("{\"kind\":\"vrg-site-result\",\"v\":1,\"id\":\"../x\"}"), "an unsafe id")
        assertNull(SiteLink.parseResult("{\"kind\":\"other\"}")); assertNull(SiteLink.parseResult("nope"))
        assertNull(SiteLink.parseResult("{\"kind\":\"vrg-site-result\",\"v\":1,\"id\":\"a\",\"cancelled\":true}"), "✕ changes nothing")
        assertEquals("rajz", SiteLink.parseResult("{\"kind\":\"vrg-site-result\",\"v\":1,\"id\":\"a\",\"outlineSrc\":\"evil\"}")!!.outlineSrc)
    }
}
