package hu.vrg.mobile.sketch

import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SiteMathTest {
    private fun near(a: Double, b: Double, t: Double) = abs(a - b) <= t

    /** A 12 × 8 m house turned by [deg], as lat/lon corners around Budapest. */
    private fun house(deg: Double, w: Double = 12.0, d: Double = 8.0): List<Pair<Double, Double>> {
        val lat0 = 47.4979; val lon0 = 19.0402; val r = Math.toRadians(deg)
        return listOf(-w / 2 to -d / 2, w / 2 to -d / 2, w / 2 to d / 2, -w / 2 to d / 2).map { (x, y) ->
            val xr = x * cos(r) - y * sin(r); val yr = x * sin(r) + y * cos(r)
            (lat0 - Math.toDegrees(yr / 6371008.8)) to (lon0 + Math.toDegrees(xr / (6371008.8 * cos(Math.toRadians(lat0)))))
        }
    }

    @Test fun aTurnedHouseStillMeasuresItsSides() {
        for (deg in listOf(0.0, 17.0, 44.0, 73.0)) {
            val f = SiteMath.footprint(house(deg), "osm", 1)
            assertTrue(near(f.w, 12.0, 0.15) && near(f.d, 8.0, 0.15), "$deg°: ${f.w} × ${f.d}")
            assertTrue(near(f.area, 96.0, 1.0))
        }
    }

    @Test fun theSketchAgainstTheBuilding() {
        var s = Sketch("S")
        val (s1, a) = Ops.addRectRoom(s, Pt(0.0, 0.0), Pt(120.0, 80.0), 4.0)!!; s = s1
        s = Ops.setMeasure(s, a, MeasureKind.WIDTH, 11800); s = Ops.setMeasure(s, a, MeasureKind.DEPTH, 7900)
        val n = Solver().solve(s)
        val fp = SiteMath.footprint(house(17.0), "osm", 1)
        val c = SiteMath.compare(n, fp)!!
        assertEquals("egyezik", c.verdict, c.text); assertTrue(c.text.startsWith("Épület 12,0 × 8,0 m · vázlat 11,8 × 7,9 m"), c.text)
        val big = Ops.setMeasure(s, a, MeasureKind.WIDTH, 14500)
        assertEquals("nagyobb", SiteMath.compare(Solver().solve(big), fp)!!.verdict)
        val flat = SiteMath.compare(n, SiteMath.footprint(house(0.0, 30.0, 14.0), "osm", 1))!!
        assertEquals("kisebb", flat.verdict)
        assertNull(SiteMath.compare(Solver().solve(Sketch("E")), fp))
    }

    @Test fun osmAnswersAreRead() {
        val places = Osm.parseSearch("""[{"lat":"47.49","lon":"19.04","display_name":"Kossuth utca 12"},{"lat":"x"}]""")
        assertEquals(1, places.size); assertEquals(47.49, places[0].lat)
        assertTrue(Osm.parseSearch("not json").isEmpty())
        assertTrue(Osm.searchUrl("Kossuth u. 12, Budaörs").contains("q=Kossuth+u.+12%2C+Buda%C3%B6rs"))
        assertTrue(Osm.buildingsQuery(47.5, 19.04).contains("way(around:40,47.500000,19.040000)[\"building\"]"))
        val h = house(0.0); val far = house(0.0).map { (la, lo) -> (la + 0.0003) to lo }
        fun way(p: List<Pair<Double, Double>>) = "{\"type\":\"way\",\"geometry\":[" + (p + p.first()).joinToString(",") { "{\"lat\":${it.first},\"lon\":${it.second}}" } + "]}"
        val json = "{\"elements\":[${way(far)},${way(h)}]}"
        val got = Osm.pickBuilding(json, 47.4979, 19.0402)
        assertNotNull(got); assertEquals(4, got.size, "the closing corner dropped"); assertEquals(h[0], got[0], "the one the point is in")
        assertNull(Osm.pickBuilding("{\"elements\":[]}", 47.0, 19.0))
        assertEquals(47.4979 to 19.0402, Osm.fromMapUrl("http://x/vrg-terkep.html?embed=1#18.2/47.4979/19.0402/30/55"))
        assertNull(Osm.fromMapUrl("http://x/vrg-terkep.html"))
        assertEquals("/vrg-terkep.html?embed=1&q=Kossuth+u.+12", Osm.mapPath(Site("Kossuth u. 12")))
        assertEquals("/vrg-terkep.html?embed=1#18/47.100000/19.200000/0/50", Osm.mapPath(Site("Kossuth u. 12", 47.1, 19.2)))
    }
}
