package hu.vrg.mobile.sketch

import org.json.JSONObject
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Szobadoboz on the phone (skcam K1b, WP M59): the lens per Fotópont shot, the survey's `box` key, and the input the
// phone hands roombox-phone.js. The input of the end-to-end survey is written to Sketcher/test/fixtures/roombox-input.json
// (VRG_SKETCH_FIXTURE=update ./gradlew :sketch-core:test); Sketcher/test/roombox-phone.test.js renders it with the
// Desktop's roombox.js, so the phone's numbers and the box's maths are checked together.
class RoomBoxTest {
    private val repo = File(System.getProperty("vrg.repo") ?: "../..")
    private val e2e = JSONObject(File(repo, "Sketcher/test/fixtures/e2e/a-lakas-felujitas.json").readText())
    private fun survey(): Sketch = SketchJson.read(e2e.getJSONObject("package").getJSONObject("sketch"))!!

    @Test fun theLensAsA35mmEquivalent() {
        // a typical main camera: 6.9 mm on a 9.8 × 7.4 mm sensor ≈ 24 mm; at 0.5× the logical camera halves it
        assertEquals(24.3, RoomBox.f35(6.9f, 9.8f, 7.4f))
        assertEquals(12.2, RoomBox.f35(6.9f, 9.8f, 7.4f, 0.5f))
        assertEquals(48.6, RoomBox.f35(6.9f, 9.8f, 7.4f, 2f))
        assertNull(RoomBox.f35(null, 9.8f, 7.4f)); assertNull(RoomBox.f35(6.9f, 0f, 7.4f)); assertNull(RoomBox.f35(6.9f, 9.8f, 7.4f, 0f))
        assertEquals(0.6f, RoomBox.fotopontZoom(0.6f, true), "with the box on, Fotópont opens on the ultrawide")
        assertEquals(1f, RoomBox.fotopontZoom(0.6f, false)); assertEquals(1f, RoomBox.fotopontZoom(1f, true), "no ultrawide: 1×")
    }

    @Test fun aShotKeepsItsLensThroughJsonTurnAndExport() {
        var s = survey()
        val f = s.photos.first()
        s = PhotoOps.addShot(s, f.id, 90, "F-k-k.jpg", 5, f35 = 13.5).first
        val back = SketchJson.read(SketchJson.write(s))!!
        assertEquals(13.5, back.photos.first().shots.first { it.deg == 90 }.f35)
        assertNull(back.photos.first().shots.first { it.deg == 0 }.f35, "an older shot has no lens")
        assertTrue(!SketchJson.write(survey()).toString().contains("\"f35\""), "a survey without lenses writes no f35 (an old file stays as it was)")
        val turned = PhotoOps.turnShot(s, f.id, 90, 270)
        assertEquals(13.5, turned.photos.first().shots.first { it.deg == 270 }.f35, "turning a shot keeps its lens")
        val plan = PlannerExport.build(s, Solver().solve(s), 1).getJSONObject("plan")
        val shots = plan.getJSONArray("photos").getJSONObject(0).getJSONArray("shots")
        assertEquals(13.5, (0 until shots.length()).map { shots.getJSONObject(it) }.first { it.getInt("deg") == 90 }.getDouble("f35"))
    }

    @Test fun theBoxKeyIsKeptCleanedAndOptional() {
        val s = survey()
        assertNull(s.box); assertTrue(!SketchJson.write(s).has("box"), "no corrections, no key")
        val desk = """{"h":{"R1":2650,"R9":50},"eye":1450,"shots":{"F25/0":{"yaw":3.5,"f35":14},"F25/180":{"yaw":0},"bad key":{"yaw":2}},"junk":1}"""
        val saved = RoomBox.save(s, desk)
        val o = JSONObject(saved.box!!)
        assertEquals(2650, o.getJSONObject("h").getInt("R1")); assertTrue(!o.getJSONObject("h").has("R9"), "an impossible height is dropped")
        assertEquals(1450, o.getInt("eye")); assertTrue(!o.has("junk"))
        assertEquals(setOf("F25/0"), o.getJSONObject("shots").keySet(), "zero corrections and odd keys go")
        val back = SketchJson.read(SketchJson.write(saved))!!
        assertTrue(JSONObject(back.box!!).similar(o), "the Desktop's box survives the phone's save (K1's known gap)")
        assertNull(RoomBox.save(saved, "{}").box, "an empty box removes the key")
        assertEquals(saved, RoomBox.save(saved, "not json"), "unreadable text changes nothing")
    }

    @Test fun theViewerInputAndItsFixture() {
        var s = survey()
        val f = s.photos.first()
        s = PhotoOps.addShot(s, f.id, 0, f.shots.first { it.deg == 0 }.file, 1763699991000, f35 = 13.0).first
        s = RoomBox.save(s, """{"h":{"R1":2650}}""")
        val n = Solver().solve(s)
        assertTrue(RoomBox.ready(n))
        val names = RoomBox.photoFiles(s)
        assertEquals(s.photos.sumOf { it.shots.size }, names.size)
        val images = names.associate { (_, board) -> board to "data:image/jpeg;base64,AAAA" }
        val inp = RoomBox.input(s, n, images, NOW)
        val floors = inp.getJSONObject("plan").getJSONObject("data").getJSONArray("floors")
        assertTrue(floors.length() >= 1 && floors.getJSONObject(0).getJSONArray("poly").length() >= 3, "the rooms in mm")
        val photos = inp.getJSONObject("plan").getJSONArray("photos")
        assertEquals(images.keys, (0 until photos.length()).flatMap { i -> photos.getJSONObject(i).getJSONArray("shots").let { a -> (0 until a.length()).map { a.getJSONObject(it).getString("file") } } }.toSet(),
            "every shot's board name has its image")
        assertEquals(2650, inp.getJSONObject("box").getJSONObject("h").getInt("R1"))
        assertEquals(s.level.heightMm, inp.getJSONObject("level").getInt("heightMm"))

        val fx = JSONObject().put("about", "skcam K1b (WP M59): the input the phone hands roombox-phone.js, written by sketch-core RoomBoxTest (VRG_SKETCH_FIXTURE=update); read by Sketcher/test/roombox-phone.test.js. Do not edit.")
            .put("input", inp)
        val file = File(repo, "Sketcher/test/fixtures/roombox-input.json")
        if (System.getenv("VRG_SKETCH_FIXTURE") == "update") file.writeText(fx.toString(1) + "\n")
        assertNotNull(file.takeIf { it.exists() }, "roombox-input.json missing: VRG_SKETCH_FIXTURE=update ./gradlew :sketch-core:test")
        assertTrue(JSONObject(file.readText()).similar(fx), "roombox-input.json is stale: VRG_SKETCH_FIXTURE=update ./gradlew :sketch-core:test")
    }

    companion object { const val NOW = 1763700000000L }
}
