package hu.vrg.mobile.sketch

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

// WP M51 (D-91…D-99): the Sketcher's feature registry. The Kotlin list must equal Sketcher/catalog/features.json (the
// Desktop's data), and every case of Sketcher/test/fixtures/features.json (written by Sketcher/lib/features.js) must
// switch the same way here. Then: the camera's old setting migrates unchanged, prerequisites carry, a variant cannot
// switch back on what the user switched off.
class FeaturesTest {
    private val repo = File(System.getProperty("vrg.repo") ?: "../..")
    private val catalog = JSONObject(File(repo, "Sketcher/catalog/features.json").readText())
    private val fixture = JSONObject(File(repo, "Sketcher/test/fixtures/features.json").readText())

    private fun strs(a: JSONArray?) = (0 until (a?.length() ?: 0)).map { a!!.getString(it) }
    private fun set(a: JSONArray?) = strs(a).toSet()
    private fun hex(s: String) = 0xFF000000L or s.removePrefix("#").toLong(16)

    @Test fun theKotlinListIsTheCatalogsList() {
        val fr = catalog.getJSONArray("fronts")
        assertEquals(Features.FRONTS.size, fr.length())
        Features.FRONTS.forEachIndexed { i, f ->
            val o = fr.getJSONObject(i)
            assertEquals(Features.Front(o.getString("id"), o.getString("label"), o.getString("sym"), hex(o.getString("color")), o.getBoolean("bar")), f)
        }
        val fs = catalog.getJSONArray("features")
        assertEquals(Features.ALL.size, fs.length())
        Features.ALL.forEachIndexed { i, f ->
            val o = fs.getJSONObject(i)
            assertEquals(Features.Feature(o.getString("id"), o.getString("front"), o.getString("sym"), o.getString("label"),
                strs(o.optJSONArray("requires")), o.optBoolean("default", true), o.optBoolean("locked", false),
                o.optString("color").takeIf { it.isNotEmpty() }?.let { hex(it) }), f, f.id)
        }
        // well formed: unique ids, prerequisites exist, every front known, every rail tool and camera switch listed
        assertEquals(Features.ALL.size, Features.ALL.map { it.id }.toSet().size)
        Features.ALL.forEach { f -> assertNotNull(Features.front(f.front), f.id); f.requires.forEach { assertNotNull(Features.of(it), "${f.id} → $it") } }
        Tools.ALL.forEach { assertNotNull(Features.of(Features.tool(it.id)), it.id) }
        CameraFeatures.ALL.forEach { assertNotNull(Features.of(Features.camera(it.id)), it.id) }
        assertEquals(SketchFeatures.ALL.map { it.id }, Features.SKETCH_IDS.keys.toList())          // F5's list, every one folded in
        Features.SKETCH_IDS.values.forEach { assertNotNull(Features.of(it), it) }
        assertEquals(SketchFeatures.ALL.map { it.id }, strs(fixture.getJSONArray("sketchIds")))
        assertEquals(CameraFeatures.ALL.map { it.id }, strs(fixture.getJSONArray("cameraIds")))
        // the front bar's fronts are the field kit's fronts, in its order
        val kit = FieldKit.parse(File(repo, "Sketcher/catalog/fieldkit.json").readText())
        assertEquals(kit.fronts.map { it.id }, Features.FRONTS.filter { it.bar }.map { it.id })
    }

    @Test fun everyFixtureCaseSwitchesTheSameWay() {
        val rail = strs(fixture.getJSONArray("rail")).map { Tools.of(it)!! }
        val cases = fixture.getJSONArray("cases")
        assertTrue(cases.length() >= 8)
        for (i in 0 until cases.length()) {
            val c = cases.getJSONObject(i); val n = c.getString("name")
            val fl = set(c.getJSONArray("flipped"))
            assertEquals(set(c.getJSONArray("on")), Features.ALL.filter { Features.on(fl, it.id) }.map { it.id }.toSet(), n)
            val bl = c.getJSONObject("blocked")
            assertEquals(bl.keys().asSequence().associateWith { bl.getString(it) },
                Features.ALL.mapNotNull { f -> Features.blockedBy(fl, f.id)?.let { f.id to it.id } }.toMap(), n)
            assertEquals(strs(c.getJSONArray("visible")), Features.visibleFronts(fl), n)
            val ao = c.getJSONObject("allOn")
            assertEquals(ao.getBoolean("*"), Features.allOn(fl), n)
            Features.FRONTS.forEach { assertEquals(ao.getBoolean(it.id), Features.allOn(fl, it.id), "$n ${it.id}") }
            assertEquals(set(c.getJSONArray("mindBe")), Features.all(fl, true), n)
            assertEquals(set(c.getJSONArray("mindKi")), Features.all(fl, false), n)
            val fb = c.getJSONObject("frontBe")
            Features.FRONTS.forEach { assertEquals(set(fb.getJSONArray(it.id)), Features.all(fl, true, it.id), "$n ${it.id}") }
            val st = c.getJSONObject("stores")
            assertEquals(Features.Stores(set(st.getJSONArray("cameraOff")), st.getBoolean("implied"), set(st.getJSONArray("general")), set(st.getJSONArray("sketchOff"))), Features.toStores(fl), n)
            assertEquals(set(c.getJSONArray("cameraOff")), Features.cameraOff(fl), n)
            assertEquals(strs(c.getJSONArray("rail")), Features.rail(rail, fl).map { it.id }, n)
            assertEquals(strs(c.getJSONArray("mapHide")), Features.mapHide(fl), n)
            val os = c.getJSONObject("openShown")
            os.keys().forEach { k -> assertEquals(os.getBoolean(k), Features.openShown(fl, k, if (k == "question") "kerdes" else "vazlat"), "$n open $k") }
            assertEquals(c.getBoolean("draw"), Features.draw(DrawTune(snapAngle = 90), fl) != DrawTune(), n)
            val tg = c.getJSONObject("toggled")
            tg.keys().forEach { id -> assertEquals(set(tg.getJSONArray(id)), Features.toggle(fl, id), "$n $id") }
        }
    }

    @Test fun theCamerasOldSettingMigratesUnchanged() {
        // a phone with F3's setting "faces,video" and D-79 switched on, before M51
        val old = Features.Stores(CameraFeatures.read("faces,video"), implied = true, general = emptySet())
        val fl = Features.fromStores(old)
        assertEquals(setOf("kamera.faces", "kamera.video", "munkakor.implied"), fl)
        // every camera switch behaves exactly as CameraFeatures did on the old set
        CameraFeatures.ALL.forEach { f ->
            assertEquals(CameraFeatures.on(old.cameraOff, f.id), Features.on(fl, Features.camera(f.id)), f.id)
            assertEquals(CameraFeatures.on(old.cameraOff, f.id), CameraFeatures.on(Features.cameraOff(fl), f.id), f.id)
        }
        assertTrue(Features.on(fl, "munkakor.implied"))
        // written back, the old stores are byte for byte what they were; the general store stays empty
        val back = Features.toStores(fl)
        assertEquals("faces,video", CameraFeatures.write(back.cameraOff)); assertTrue(back.implied); assertEquals(emptySet(), back.general)
        // a round trip keeps every combination, unknown ids included
        listOf(emptySet(), setOf("vazlat.memo", "kamera.ocr", "jovobeli.x", "munkakor.implied"), Features.all(emptySet(), false)).forEach {
            assertEquals(it, Features.fromStores(Features.toStores(it)))
        }
        // a fresh phone: everything on except the options that are off by default
        assertEquals(Features.ALL.filter { it.default }.map { it.id }.toSet(), Features.ALL.filter { Features.on(emptySet(), it.id) }.map { it.id }.toSet())
        assertFalse(Features.on(emptySet(), "munkakor.implied"))
        // F5's Felmérés funkciók setting ("client,line_close") reads and writes back unchanged
        val f5 = Features.fromStores(Features.Stores(emptySet(), false, emptySet(), SketchFeatures.read("client,line_close")))
        assertEquals(setOf("helyszin.client", "vazlat.line_close"), f5)
        assertEquals("client,line_close", SketchFeatures.write(Features.toStores(f5).sketchOff))
        SketchFeatures.ALL.forEach { assertEquals(it.id !in setOf("client", "line_close"), Features.own(f5, Features.SKETCH_IDS[it.id]!!), it.id) }
        // the old Kamera funkciók list writing its set replaces only the camera switches
        assertEquals(setOf("vazlat.memo", "kamera.video"), Features.withCameraOff(setOf("vazlat.memo", "kamera.ocr"), setOf("video")))
    }

    @Test fun prerequisitesCarryAndComeBack() {
        var fl = Features.set(emptySet(), "kamera.capture", false)
        assertTrue(Features.ALL.filter { it.front == "kamera" }.none { Features.on(fl, it.id) })
        assertEquals("kamera.capture", Features.blockedBy(fl, "kamera.ocr")?.id)
        assertFalse("kamera" in Features.visibleFronts(fl))
        fl = Features.set(fl, "kamera.capture", true)
        assertTrue(Features.on(fl, "kamera.ocr"))                     // the dependents' own switches were kept
        // the locked Mozgat never goes off, so Vázlat never leaves the front bar
        assertEquals(emptySet(), Features.set(emptySet(), "vazlat.select", false))
        assertEquals(listOf("vazlat"), Features.visibleFronts(Features.all(emptySet(), false)))
        // Mind be leaves the default-off option alone; Mind ki takes it off
        assertFalse(Features.on(Features.all(emptySet(), true), "munkakor.implied"))
        assertTrue(Features.on(Features.all(setOf("munkakor.implied"), true), "munkakor.implied"))
        assertFalse(Features.on(Features.all(setOf("munkakor.implied"), false), "munkakor.implied"))
    }

    @Test fun aVariantCannotSwitchOnWhatTheUserSwitchedOff() {
        val ev = FieldKit.parseVariant(File(repo, "Sketcher/variants").listFiles { f -> f.name.endsWith(".json") }!!.sorted()
            .map { it.readText() }.first { it.contains("\"draw\"") })
        val off = setOf(Features.tool("photo"), Features.tool("route"), "vazlat.drawtune")
        // the variant's rail order and its plugins: the tools stay out
        val s = Sketch("S1", plugins = Plugins.DEFAULT_ON + Plugins.PHOTO.id + ev.pluginsOn)
        val rail = Features.rail(Plugins.rail(VariantOps.plugins(s.copy(variantOn = true), ev), (ev.rail ?: emptyList()) + listOf("photo", "route")), off)
        assertTrue(rail.none { it.id == "photo" || it.id == "route" })
        assertTrue(rail.any { it.id == "select" })
        // its draw tune is ignored while Rajz-hangolás is off, kept while on
        assertFalse(ev.draw.isDefault)
        assertEquals(DrawTune(), Features.draw(ev.draw, off)); assertEquals(ev.draw, Features.draw(ev.draw, emptySet()))
        // the hold wheel loses the items of features that are off, its sectors stay where they were
        val pw = Wheels.forPaper()
        val trimmed = Features.wheel(pw, setOf("vazlat.memo", "vazlat.point"))
        assertEquals(pw.rings.map { it.size }, trimmed.rings.map { it.size })
        assertTrue(trimmed.rings.flatten().filterNotNull().none { it.id == "memo" || it.id == "point-here" })
        assertTrue(trimmed.rings.flatten().filterNotNull().any { it.id == "tag" })
        assertEquals(pw, Features.wheel(pw, emptySet()))
        // a plugin whose every tool is off is not offered; the note taker always is
        assertFalse(Features.pluginShown(Plugins.PHOTO, off)); assertTrue(Features.pluginShown(Plugins.NOTE, Features.all(emptySet(), false)))
    }
}
