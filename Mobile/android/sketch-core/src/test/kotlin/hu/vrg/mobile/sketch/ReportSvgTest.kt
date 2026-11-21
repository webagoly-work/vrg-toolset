package hu.vrg.mobile.sketch

import org.json.JSONObject
import java.io.File
import kotlin.math.abs
import kotlin.math.max
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// F9 (WP M54): the phone's jegyzőkönyv drawings against the Desktop's. Sketcher/test/fixtures/report.json holds what
// the Desktop page's own svgPlan / sitePlaceSvg (taken out of Sketcher/src/app.js by tools/make-report-fixture.js) draw
// for the shared field package; PlanSvg and SiteSvg must draw the same. The text around the numbers must be identical;
// a number may differ only in its last digits (Java's and V8's sin / cos are allowed one ulp apart).
class ReportSvgTest {
    private val repo = File(System.getProperty("vrg.repo") ?: "../..")
    private val fixture = JSONObject(File(repo, "Sketcher/test/fixtures/report.json").readText())
    private val pkg = JSONObject(File(repo, fixture.getString("package")).readText())
    private val num = Regex("-?\\d+(?:\\.\\d+)?(?:e[+-]\\d+)?")

    private fun same(want: String, got: String, about: String) {
        assertEquals(num.replace(want, "#"), num.replace(got, "#"), "$about: the SVG around its numbers")
        val a = num.findAll(want).map { it.value }.toList(); val b = num.findAll(got).map { it.value }.toList()
        assertEquals(a.size, b.size, "$about: as many numbers")
        a.zip(b).forEachIndexed { i, (x, y) ->
            if (x == y) return@forEachIndexed
            val dx = x.toDouble(); val dy = y.toDouble()
            // two decimals (toFixed): a half-way case may round the other way after a one-ulp difference
            val tol = if (Regex("-?\\d+\\.\\d\\d").matches(x)) 0.0101 else max(1e-9, abs(dx) * 1e-12)
            assertTrue(abs(dx - dy) <= tol, "$about: number #$i $x ≠ $y")
        }
    }

    @Test fun planSvgIsTheDesktopsSvg() {
        val cases = fixture.getJSONArray("cases")
        var n = 0
        for (i in 0 until cases.length()) {
            val c = cases.getJSONObject(i); if (!c.has("plan")) continue
            val plan = if (c.getBoolean("plan")) pkg.getJSONObject("plan") else null
            same(c.getString("svg"), PlanSvg.svg(pkg.getJSONObject("sketch"), plan), c.getString("about")); n++
        }
        assertEquals(2, n)
    }

    @Test fun thePhonesOwnSurveyDrawsTheSame() {
        // the survey read back from the package, solved and exported again on the phone: what the Desktop drew
        val s = SketchJson.read(pkg.getJSONObject("sketch"))!!
        same(fixture.getJSONArray("cases").getJSONObject(0).getString("svg"), PlanSvg.of(s), "the phone's survey")
        assertEquals(PlanSvg.EMPTY, PlanSvg.of(Sketch(id = "x")), "nothing drawn: the Desktop's empty note")
    }

    @Test fun siteSvgIsTheDesktopsSvg() {
        val cases = fixture.getJSONArray("cases")
        val rooms = SiteSvg.rooms(pkg.getJSONObject("plan"))
        assertEquals(2, rooms.size)
        var n = 0
        for (i in 0 until cases.length()) {
            val c = cases.getJSONObject(i); if (!c.has("outline")) continue
            val outline = SiteSvg.outlineOf(c.getJSONArray("outline"))
            val place = c.optJSONObject("place")?.let { Placement(it.getDouble("lat"), it.getDouble("lon"), it.getDouble("rot"), it.optBoolean("auto", true)) }
            val out = SiteSvg.of(Site(outline = outline, place = place), pkg.getJSONObject("plan"))
            same(c.getString("svg"), out.svg, c.getString("about"))
            val lines = c.getJSONArray("lines").let { a -> (0 until a.length()).map { a.getString(it) } }
            assertEquals(lines, out.lines, c.getString("about") + ": the lines")
            n++
        }
        assertEquals(4, n)
        assertEquals(SiteSvg.Out("", emptyList()), SiteSvg.of(Site(), pkg.getJSONObject("plan")), "no outline: no site drawing")
    }

    @Test fun numbersAsJavaScriptWritesThem() {
        listOf(4000.0 to "4000", -980.0 to "-980", 0.0 to "0", 0.1 to "0.1", 0.1 + 0.2 to "0.30000000000000004", 153.0 to "153", 1.5e-7 to "1.5e-7",
            123456789012345680000000.0 to "1.2345678901234569e+23", 0.000001 to "0.000001", -8.29113296008997 to "-8.29113296008997", 1e21 to "1e+21")
            .forEach { (v, s) -> assertEquals(s, JsNum.str(v), "str $v") }
        listOf(Triple(1.005, 2, "1.00"), Triple(2.5, 0, "3"), Triple(-4.567, 2, "-4.57"), Triple(-0.001, 2, "-0.00"), Triple(6.91, 2, "6.91"))
            .forEach { (v, d, s) -> assertEquals(s, JsNum.fixed(v, d), "fixed $v") }
    }
}
