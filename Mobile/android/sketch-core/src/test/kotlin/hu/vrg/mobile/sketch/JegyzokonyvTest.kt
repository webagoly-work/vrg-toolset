package hu.vrg.mobile.sketch

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// F9 (WP M54): what the phone's jegyzőkönyv may contain (D-123 … D-126). The document is report.js's (the Node test
// report-phone.test.js renders it); here are the inputs: the export rules, Az ügyfélnek, the photos, the size.
class JegyzokonyvTest {
    private val repo = File(System.getProperty("vrg.repo") ?: "../..")
    private val pkg = JSONObject(File(repo, "Planner/projects/varler-planner/tests/sketch-field.json").readText())
    private val catalog = JSONObject(File(repo, "Sketcher/catalog/fieldkit.json").readText())
    private val base = SketchJson.read(pkg.getJSONObject("sketch"))!!

    private fun cap(id: String, kind: String = CaptureKind.PHOTO, privacy: Boolean = false, blur: Boolean = false) =
        Capture(id, "$id.jpg", kind = kind, privacy = privacy, lat = 47.5, lon = 19.0,
            marks = (if (blur) listOf(Mark(MarkKind.BLUR, listOf(Pt(0.1, 0.1), Pt(0.3, 0.3)))) else emptyList()) + Mark(MarkKind.ARROW, listOf(Pt(0.5, 0.5), Pt(0.6, 0.6))))

    @Test fun whichCapturesArePictured() {
        assertTrue(Jegyzokonyv.pictured(cap("a")))
        assertFalse(Jegyzokonyv.pictured(cap("b", privacy = true)), "a personal photo with nothing blurred stays out")
        assertTrue(Jegyzokonyv.pictured(cap("c", privacy = true, blur = true)), "...and goes in once blurred")
        assertTrue(Jegyzokonyv.pictured(cap("d", kind = CaptureKind.SIGNATURE)))
        assertFalse(Jegyzokonyv.pictured(cap("e", kind = CaptureKind.VIDEO)), "a video is listed, not pictured")
        assertFalse(Jegyzokonyv.pictured(cap("f", kind = CaptureKind.AUDIO)))
        assertEquals(listOf(MarkKind.BLUR), Jegyzokonyv.blurOf(cap("c", blur = true)).map { it.kind }, "only the blur is burned into the report's copy")
    }

    @Test fun theExportRulesApply() {
        val s = base.copy(client = Client("Minta Ügyfél", "+36 30 000 0000"), captures = listOf(cap("a"), Capture("h", "h.m4a", kind = CaptureKind.AUDIO)))
        val out = Jegyzokonyv.survey(emptySet(), s)
        assertEquals(null, out.client, "the client stays on the phone unless kept (D-82)")
        assertEquals("Minta Ügyfél", Jegyzokonyv.survey(emptySet(), s.copy(client = s.client!!.copy(keep = true))).client?.name)
        assertEquals(null, Jegyzokonyv.survey(setOf(SketchFeatures.CLIENT), s.copy(client = s.client!!.copy(keep = true))).client, "client data switched off: none")
        assertEquals(2, out.captures.size)
        assertEquals(1, Jegyzokonyv.survey(setOf(SketchFeatures.AUDIO), s).captures.size, "no sound notes when switched off")
    }

    @Test fun forTheClient() {
        val t = JSONObject().put("notes", JSONArray().put(JSONObject().put("text", "kérdés").put("open", true)).put(JSONObject().put("text", "rendben").put("open", false)))
            .put("checks", JSONArray().put("Ellenőrizni: a földelés")).put("counts", JSONObject().put("tisztazando", 1).put("items", 3))
        val c = Jegyzokonyv.forClient(t)
        assertEquals(1, c.getJSONArray("notes").length()); assertEquals("rendben", c.getJSONArray("notes").getJSONObject(0).getString("text"))
        assertEquals(0, c.getJSONArray("checks").length()); assertEquals(0, c.getJSONObject("counts").getInt("tisztazando"))
        assertEquals(3, c.getJSONObject("counts").getInt("items"))
        assertEquals(2, t.getJSONArray("notes").length(), "the original takeoff is untouched")
    }

    @Test fun theInput() {
        val s = base.copy(captures = listOf(cap("a"), cap("b", privacy = true), cap("d", kind = CaptureKind.SIGNATURE)))
        val t = JSONObject().put("notes", JSONArray().put(JSONObject().put("text", "x").put("open", true))).put("checks", JSONArray().put("y"))
        val inp = Jegyzokonyv.input(s, Solver().solve(s), t, catalog, null, mapOf("a" to "data:a", "b" to "data:b", "d" to "data:d"), forClient = true, now = 5)
        assertEquals(setOf("a", "d"), inp.getJSONObject("photos").keySet(), "only the pictured ones, whatever the phone handed over")
        assertEquals("[\"b\"]", inp.getJSONArray("withheld").toString(), "the unblurred personal photo is named as withheld")
        assertEquals(0, inp.getJSONObject("takeoff").getJSONArray("notes").length())
        assertTrue(inp.getString("planSvg").startsWith("<svg id=\"plansvg\""))
        assertEquals("", inp.getString("siteSvg"), "no outline, no site drawing")
        val rooms = inp.getJSONArray("rooms")
        assertEquals("R1", rooms.getJSONObject(0).getString("id")); assertEquals("Nappali", rooms.getJSONObject(0).getString("name"))
        assertEquals(base.name, inp.getJSONObject("survey").getString("name"))
        val keep = Jegyzokonyv.input(s, Solver().solve(s), t, catalog, null, emptyMap(), forClient = false, now = 5)
        assertEquals(1, keep.getJSONObject("takeoff").getJSONArray("notes").length(), "the full report keeps the notes")
        assertTrue(Jegyzokonyv.input(s, Solver().solve(s), null, catalog, null, emptyMap(), false, 5).isNull("takeoff"))
    }

    @Test fun namesAndSize() {
        assertEquals(SketchJson.fileStem(base) + ".jegyzokonyv.html", Jegyzokonyv.fileName(base))
        assertFalse(Jegyzokonyv.tooBig(6L * 1024 * 1024)); assertTrue(Jegyzokonyv.tooBig(16L * 1024 * 1024))
        assertEquals("15,0 MB", Jegyzokonyv.mb(Jegyzokonyv.MAX_HTML_BYTES))
    }

    @Test fun theSwitchIsInTheRegistry() {
        assertEquals("📄", SketchFeatures.of(SketchFeatures.REPORT)?.sym)
        assertTrue(SketchFeatures.on(emptySet(), SketchFeatures.REPORT), "new features arrive on (D-90)")
        assertFalse(SketchFeatures.on(SketchFeatures.all(false), SketchFeatures.REPORT), "Mind off switches it off too")
    }
}
