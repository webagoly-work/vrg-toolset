package hu.vrg.mobile.core

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.PI
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** The radar (WP M67): the shared layout fixture the UI Kit's radar.js writes, the sweep, the geodesy, the texts. */
class RadarTest {
    private val repo = File(System.getProperty("vrg.repo") ?: "../..")
    private val fixture = JSONObject(File(repo, "shared/vrg-ui-kit/test/fixtures/radar-layout.json").readText())

    private fun JSONObject.dbl(k: String): Double? = if (!has(k) || isNull(k)) null else getDouble(k)

    private fun frameOf(f: JSONObject): RadarFrame {
        val bl = f.getJSONArray("blips")
        val blips = (0 until bl.length()).map { i ->
            val b = bl.getJSONObject(i)
            Blip(
                id = b.getString("id"), layer = b.getString("layer"), label = b.getString("label"),
                distanceM = b.dbl("distanceM"), bearingDeg = b.dbl("bearingDeg"), trend = b.optInt("trend", 0),
                ageMs = b.optLong("ageMs", 0), linked = b.optBoolean("linked"), mine = b.optBoolean("mine"),
                place = b.optJSONObject("place")?.let { LatLon(it.getDouble("lat"), it.getDouble("lon")) },
            )
        }
        return RadarFrame(
            layers = emptyList(), blips = blips, headingDeg = f.dbl("headingDeg"),
            here = f.optJSONObject("here")?.let { LatLon(it.getDouble("lat"), it.getDouble("lon")) },
            mode = if (f.optString("mode") == "north-up") RadarMode.NORTH_UP else RadarMode.HEADING_UP,
            rangeM = f.dbl("rangeM"),
        )
    }

    private fun strings(a: JSONArray?) = (0 until (a?.length() ?: 0)).map { a!!.getString(it) }.toSet()

    @Test fun `the layout reproduces the UI Kit's placements`() {
        val cases = fixture.getJSONArray("cases")
        assertTrue(cases.length() >= 4)
        for (i in 0 until cases.length()) {
            val c = cases.getJSONObject(i)
            val name = c.getString("name")
            val sw = c.getJSONObject("sweeps")
            val sweeps = sw.keySet().associateWith { sw.getDouble(it) }
            val lay = Radar.layout(frameOf(c.getJSONObject("frame")), strings(c.optJSONArray("hidden")), sweeps)
            val e = c.getJSONObject("expect")
            assertEquals(e.getDouble("rangeM"), lay.rangeM, "$name: range")
            val exp = e.getJSONArray("placed")
            assertEquals(exp.length(), lay.placed.size, "$name: count")
            for (j in 0 until exp.length()) {
                val x = exp.getJSONObject(j); val p = lay.placed[j]
                val id = x.getString("id")
                assertEquals(id, p.blip.id, "$name: order")
                assertEquals(x.getString("bearingSrc"), p.bearingSrc.name.lowercase(), "$name: $id source")
                for ((k, v) in listOf("x" to p.x, "y" to p.y, "r" to p.r, "angleDeg" to p.angleDeg, "alpha" to p.alpha)) {
                    assertTrue(abs(x.getDouble(k) - v) < 1e-5, "$name: $id.$k ${x.getDouble(k)} vs $v")
                }
            }
            val rings = e.getJSONArray("rings")
            assertEquals(rings.length(), lay.rings.size, "$name: rings")
        }
    }

    @Test fun `scale, range, rings, fade and the hash`() {
        assertEquals(Radar.UNKNOWN_R, Radar.radius(null, 10.0))
        assertEquals(Radar.MAX_R, Radar.radius(1e6, 10.0))
        assertTrue(Radar.radius(1.0, 10.0) < Radar.radius(3.0, 10.0))
        assertEquals(10.0, Radar.autoRange(emptyList()))
        assertEquals(5.0, Radar.autoRange(listOf(4.0)))
        assertEquals(300.0, Radar.autoRange(listOf(5000.0)))
        assertEquals(listOf(1.0, 3.0, 10.0, 30.0), Radar.rings(30.0).map { it.first })
        assertEquals(1.0, Radar.alpha(0)); assertEquals(0.35, Radar.alpha(120_000))
        assertEquals(0x811c9dc5L, Radar.fnv1a(""))
        assertEquals(0xe40c292cL, Radar.fnv1a("a"))
    }

    @Test fun `hidden layers vanish and a tap finds the nearest blip`() {
        val f = RadarFrame(emptyList(), listOf(Blip("a", "x", "A", 3.0, 0.0), Blip("b", "y", "B", 3.0, 180.0)))
        val lay = Radar.layout(f, hidden = setOf("y"))
        assertEquals(listOf("a"), lay.placed.map { it.blip.id })
        val a = lay.placed.single()
        assertEquals("a", Radar.hit(lay, a.x + 0.01, a.y)?.blip?.id)
        assertNull(Radar.hit(lay, 0.8, 0.8))
    }

    @Test fun `a swept bearing stays on the compass while the phone turns`() {
        val b = Blip("t", "tag", "T", 5.0)
        val f0 = RadarFrame(emptyList(), listOf(b), headingDeg = 0.0)
        val f90 = f0.copy(headingDeg = 90.0)
        val s = mapOf("t" to 120.0)
        assertEquals(120.0, Radar.layout(f0, sweeps = s).placed.single().angleDeg, 1e-9)
        assertEquals(30.0, Radar.layout(f90, sweeps = s).placed.single().angleDeg, 1e-9, "turned right 90°: it is now 30° to the right")
        assertEquals(BearingSource.SWEEP, Radar.layout(f90, sweeps = s).placed.single().bearingSrc)
        assertEquals(120.0, Radar.layout(f90.copy(mode = RadarMode.NORTH_UP), sweeps = s).placed.single().angleDeg, 1e-9)
    }

    @Test fun `the sweep finds the strongest heading`() {
        val sw = BearingSweep()
        assertNull(sw.result(), "nothing yet")
        val rnd = java.util.Random(7)
        // body shadowing: strongest facing 70°, about 14 dB weaker facing away, ±2 dB noise
        for (k in 0 until 3) for (h in 0 until 360 step 5) {
            val rssi = -66 + 7 * cos((h - 70) * PI / 180) + rnd.nextGaussian() * 2
            sw.add(h.toDouble(), rssi.toInt())
        }
        val r = assertNotNull(sw.result())
        val err = abs(((r.bearingDeg - 70 + 540) % 360) - 180)
        assertTrue(err <= 20, "bearing ${r.bearingDeg}")
        assertTrue(r.confidence > 0.5, "confidence ${r.confidence}")
        assertEquals(1.0, r.coverage)
        sw.clear()
        for (h in 0 until 360 step 5) sw.add(h.toDouble(), -70 + rnd.nextInt(3))
        assertTrue(assertNotNull(sw.result()).confidence < 0.15, "flat signal: no direction")
        sw.clear()
        for (h in 0 until 180 step 5) sw.add(h.toDouble(), -60)
        assertNull(sw.result(), "half a turn is not enough")
        assertTrue(RadarText.sweepHint(sw.coverage, null).contains("50%"))
    }

    @Test fun `geodesy and texts`() {
        assertEquals(0.0, Geo.bearing(LatLon(0.0, 0.0), LatLon(1.0, 0.0)), 1e-9)
        assertEquals(90.0, Geo.bearing(LatLon(0.0, 0.0), LatLon(0.0, 1.0)), 1e-9)
        assertTrue(abs(Geo.distance(LatLon(0.0, 0.0), LatLon(1.0, 0.0)) - 111195) < 5)
        assertEquals("jobbra", RadarText.relative(90.0))
        assertEquals("balra elöl", RadarText.relative(-40.0))
        assertEquals("DNy", RadarText.compass(225.0))
        assertEquals("~20 m", RadarText.distance(23.0))
        assertEquals("1,2 km", RadarText.distance(1234.0))
        assertEquals("távolság ismeretlen", RadarText.distance(null))
    }

    @Test fun `blips without a direction keep apart on a crowded ring`() {
        val f = RadarFrame(emptyList(), (0 until 12).map { Blip("n$it", "p", "U$it", 6.0) })
        val pl = Radar.layout(f).placed
        for (i in pl.indices) for (j in i + 1 until pl.size)
            assertTrue(hypot(pl[i].x - pl[j].x, pl[i].y - pl[j].y) >= Radar.MIN_SEP - 1e-9)
    }

    @Test fun `a snapshot for the Data Vault carries the frame, the swept directions and nothing live`() {
        val f = RadarFrame(
            layers = listOf(RadarLayer("tag", "Saját címke", "🏷", RadarTone.SAND, "tag"), RadarLayer("pager", "Csipogó", "📟", RadarTone.CURRENT, "pager")),
            blips = listOf(
                Blip("tag:mine", "tag", "ISY \"kulcs\"\n", 4.0, mine = true, trend = 1, rssi = -60, detail = "elem tele"),
                Blip("tag:last", "tag", "utoljára", place = LatLon(47.501, 19.041), ageMs = 90_000),
                Blip("pager:2", "pager", "Ödön", 9.0, alert = true),
            ),
            headingDeg = 40.0, here = LatLon(47.5, 19.04),
        )
        val j = JSONObject(RadarSnapshot.encode(f, mapOf("tag:mine" to 120.0), "2026-11-25T08:00:00Z", "VRG Mobile test", hidden = setOf("pager")))
        assertEquals("vrg.radar-frame", j.getString("kind")); assertEquals(1, j.getInt("v"))
        assertEquals("heading-up", j.getString("mode")); assertEquals(40.0, j.getDouble("headingDeg"))
        assertEquals(47.5, j.getJSONObject("here").getDouble("lat"))
        assertEquals(listOf("tag"), (0 until j.getJSONArray("layers").length()).map { j.getJSONArray("layers").getJSONObject(it).getString("id") }, "a hidden layer is not shared")
        assertEquals("sand", j.getJSONArray("layers").getJSONObject(0).getString("tone"))
        val b = j.getJSONArray("blips")
        assertEquals(2, b.length())
        val mine = b.getJSONObject(0)
        assertEquals("ISY \"kulcs\"\n", mine.getString("label"), "quotes and newline survive the escaping")
        assertEquals(120.0, mine.getDouble("bearingDeg")); assertEquals("sweep", mine.getString("bearingSrc"))
        assertTrue(!mine.has("rssi"), "live RSSI is not shared")
        assertEquals(1, mine.getInt("trend")); assertTrue(mine.getBoolean("mine"))
        val last = b.getJSONObject(1)
        assertTrue(last.isNull("distanceM") && last.isNull("bearingDeg")); assertEquals("none", last.getString("bearingSrc"))
        assertEquals(19.041, last.getJSONObject("place").getDouble("lon"))
        assertTrue(JSONObject(RadarSnapshot.encode(RadarFrame(emptyList(), emptyList()), emptyMap(), "t", "a")).isNull("here"))
    }
}
