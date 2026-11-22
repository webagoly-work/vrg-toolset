package hu.vrg.mobile.sketch

import org.json.JSONObject
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Síkmérés (skcam K3, WP M60): the survey's `planes` key on the phone. The records come from the shared screen
// (Sketcher/lib/plane-ui.js); the phone stores them by photo, drops those whose photo is gone, moves a record with a
// turned Fotópont shot and lists them in the same words as plane.js summary.
class PlanesTest {
    private val repo = File(System.getProperty("vrg.repo") ?: "../..")
    private fun survey(): Sketch = SketchJson.read(JSONObject(File(repo, "Sketcher/test/fixtures/e2e/a-lakas-felujitas.json").readText())
        .getJSONObject("package").getJSONObject("sketch"))!!
    private val rec = """{"aspect":1.3333,"ref":{"kind":"a4","w":210,"h":297,"pts":[[0.1,0.1],[0.2,0.1],[0.2,0.25],[0.1,0.25]]},
        "lines":[{"a":[0.3,0.5],"b":[0.6,0.6],"mm":1803,"label":"Dugalj – kapcsoló"}],"marks":[{"p":[0.4,0.8],"mm":300}],"at":5}"""

    @Test fun aRecordIsKeptByPhotoAndSurvivesJson() {
        var s = survey()
        assertNull(s.planes); assertTrue(!SketchJson.write(s).has("planes"), "no measurement, no key")
        s = Planes.put(s, "C30", rec)
        val back = SketchJson.read(SketchJson.write(s))!!
        assertEquals(1803, Planes.of(back, "C30")!!.getJSONArray("lines").getJSONObject(0).getInt("mm"))
        assertEquals(listOf("Dugalj – kapcsoló: 1,8 m", "Magasság 1: 300 mm"), Planes.summary(Planes.of(back, "C30")), "the same words as plane.js")
        assertEquals(s, Planes.put(s, "C30", "not json"), "unreadable text changes nothing")
        assertNull(Planes.put(s, "C30", "null").planes, "null removes the record (and the empty key)")
        assertNull(Planes.put(s, "C31", """{"aspect":1.3}""").let { Planes.of(it, "C31") }, "a record with nothing measured is no record")
    }

    @Test fun aRecordWhosePhotoIsGoneIsDroppedOnWrite() {
        var s = Planes.put(survey(), "C30", rec)
        s = Planes.put(s, "C999", rec)                             // no such capture
        val o = SketchJson.write(s).getJSONObject("planes")
        assertEquals(setOf("C30"), o.keySet())
        val (gone, _) = Intake.deleteCapture(s, "C30")
        assertTrue(!SketchJson.write(gone).has("planes"), "deleting the photo drops its measurement from the file")
    }

    @Test fun aTurnedShotTakesItsRecordAlong() {
        var s = survey()
        val f = s.photos.first()
        s = Planes.put(s, Planes.shotKey(f.id, 0), rec)
        s = PhotoOps.turnShot(s, f.id, 0, 90)
        assertNull(Planes.of(s, Planes.shotKey(f.id, 0)))
        assertEquals(1803, Planes.of(s, Planes.shotKey(f.id, 90))!!.getJSONArray("lines").getJSONObject(0).getInt("mm"))
        assertEquals(setOf(Planes.shotKey(f.id, 90)), SketchJson.write(s).getJSONObject("planes").keySet(), "kept under the shot's new side")
        assertEquals(Planes.shotKey("F25", 450), "F25/90")
    }

    @Test fun theNumbersReadAsPlaneJsWritesThem() {
        assertEquals("300 mm", Planes.fmt(300.0)); assertEquals("999 mm", Planes.fmt(999.4))
        assertEquals("1,8 m", Planes.fmt(1803.0)); assertEquals("1,36 m", Planes.fmt(1360.0)); assertEquals("2 m", Planes.fmt(2000.0))
        assertEquals(listOf("Távolság 1: —"), Planes.summary(JSONObject("""{"lines":[{"a":[0,0],"b":[1,1],"mm":null}]}""")))
    }
}
