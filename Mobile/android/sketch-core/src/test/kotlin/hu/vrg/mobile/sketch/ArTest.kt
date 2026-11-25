package hu.vrg.mobile.sketch

import org.json.JSONObject
import java.io.File
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Google AR csomag (skcam K6, WP M64): the pure half of the AR meter. The distances in the survey's `ar` key, the Raw
// Depth maths, the scan's voxel thinning and its vrg-house3d file. A scan of a known room is written to
// Sketcher/test/fixtures/ar-scan.house3d.json (VRG_SKETCH_FIXTURE=update ./gradlew :sketch-core:test), which
// Sketcher/test/ar-scan.test.js opens with the Desktop's own house3d.js.
class ArTest {
    private val repo = File(System.getProperty("vrg.repo") ?: "../..")
    private fun survey(): Sketch = SketchJson.read(JSONObject(File(repo, "Sketcher/test/fixtures/e2e/a-lakas-felujitas.json").readText())
        .getJSONObject("package").getJSONObject("sketch"))!!

    @Test fun thePackIsOneSwitchOffByDefault() {
        val f = Features.of(Ar.FEATURE)!!
        assertEquals("kamera", f.front); assertTrue(!f.default, "Google's runtime only when switched on")
        assertTrue(!Features.on(emptySet(), Ar.FEATURE))
        val on = Features.set(emptySet(), Ar.FEATURE, true)
        assertTrue(Features.on(on, Ar.FEATURE))
        assertTrue(!Features.on(Features.set(on, "kamera.capture", false), Ar.FEATURE), "no camera, no AR")
        assertTrue(Features.ALL.none { it.id.startsWith("kamera.ar_") }, "one pack, not one switch per AR feature")
        assertTrue(!Features.on(Features.all(emptySet(), true), Ar.FEATURE), "Mind be leaves a default-off option as it was (D-94)")
    }

    @Test fun distancesAreKeptInTheSurvey() {
        var s = survey()
        assertNull(s.ar); assertTrue(!SketchJson.write(s).has("ar"), "nothing measured, no key")
        val room = s.rooms.first().id
        s = Ar.addLine(s, 3420, listOf(0.0, 0.0, 0.0), listOf(3.42, 0.0, 0.0), 10, "Nappali fal", room, 1)
        s = Ar.addLine(s, 2611, listOf(0.0, 0.0, 0.0), listOf(0.0, 2.611, 0.0), 11)
        assertEquals(listOf("Nappali fal: 3,42 m", "Távolság A2: 2,61 m"), Ar.summary(s))
        val back = SketchJson.read(SketchJson.write(s))!!
        assertEquals(Ar.of(s), Ar.of(back), "round trip")
        assertEquals(listOf("A1", "A2"), Ar.of(back).lines.map { it.id })
        assertEquals(1, Ar.of(back).lines[0].edge)
        assertEquals("A3", Ar.of(Ar.addLine(Ar.removeLine(back, "A1"), 500, emptyList(), emptyList(), 12)).lines.last().id, "ids never come back")
        assertEquals("Ajtó", Ar.of(Ar.relabel(back, "A2", " Ajtó ")).lines[1].label)
        assertEquals(s, Ar.addLine(s, 0, emptyList(), emptyList(), 13), "a zero distance is not kept")
        // a line whose room was deleted keeps its distance, loses the room
        val gone = SketchJson.read(SketchJson.write(Ops.delete(s, room)))!!
        assertEquals(3420, Ar.of(gone).lines[0].mm); assertNull(Ar.of(gone).lines[0].room)
        // files
        val f = Ar.addFile(Ar.addFile(back, "scan", "nappali-ar-20261122-1010.house3d.json", 20, 5000), "rec", "nappali-ar-20261122-1012.mp4", 21)
        assertEquals(listOf("scan", "rec"), Ar.of(SketchJson.read(SketchJson.write(f))!!).files.map { it.kind })
        assertEquals(2, Ar.of(Ar.addFile(f, "scan", "nappali-ar-20261122-1010.house3d.json", 22, 6000)).files.size, "the same file once")
        assertEquals(Ar.Record(), Ar.parse("not json"))
    }

    @Test fun fileNamesAreSafe() {
        assertEquals("Kovács-u.-12-ar-20261122-1010.mp4", Ar.fileName("Kovács u. 12", "20261122-1010", "mp4"))
        assertEquals("vazlat-ar-1.house3d.json", Ar.fileName("  /:  ", "1", "house3d.json"))
    }

    private fun yaw(deg: Double, t: DoubleArray): FloatArray {
        val a = Math.toRadians(deg); val c = cos(a); val s = sin(a)
        // column-major, rotation about +Y then translation (Pose.toMatrix)
        return floatArrayOf(c.toFloat(), 0f, (-s).toFloat(), 0f, 0f, 1f, 0f, 0f, s.toFloat(), 0f, c.toFloat(), 0f, t[0].toFloat(), t[1].toFloat(), t[2].toFloat(), 1f)
    }

    @Test fun rawDepthLandsOnTheWall() {
        val w = 64; val h = 48
        val depth = ShortArray(w * h) { 3000 }
        val conf = ByteArray(w * h) { 255.toByte() }
        // looking along −Z from (1, 1.5, 2): the wall 3 m ahead is z = −1
        val p = Ar.unproject(depth, conf, w, h, 50.0, 50.0, 32.0, 24.0, yaw(0.0, doubleArrayOf(1.0, 1.5, 2.0)), step = 4)
        assertEquals(16 * 12 * 3, p.size)
        for (i in 0 until p.size / 3) assertTrue(abs(p[3 * i + 2] + 1.0) < 1e-6, "z = −1")
        val xs = (0 until p.size / 3).map { p[3 * it] }; val ys = (0 until p.size / 3).map { p[3 * it + 1] }
        assertTrue(xs.min() < 1.0 - 1.5 && xs.max() > 1.0 + 1.5, "the image's width spread over the wall (±1.9 m at 3 m, f = 50 px)")
        assertTrue(ys.first() > 1.5 && ys.last() < 1.5, "the top row of the image is above the camera (+Y up)")
        // turned 90° to the left: looking along −X, the wall at x = 1 − 3 = −2
        val q = Ar.unproject(depth, conf, w, h, 50.0, 50.0, 32.0, 24.0, yaw(90.0, doubleArrayOf(1.0, 1.5, 2.0)), step = 8)
        for (i in 0 until q.size / 3) assertTrue(abs(q[3 * i] + 2.0) < 1e-5, "x = −2")
        // unsure pixels and those out of range are left out
        conf.fill(10.toByte(), 0, w * h / 2)
        val half = Ar.unproject(depth, conf, w, h, 50.0, 50.0, 32.0, 24.0, yaw(0.0, doubleArrayOf(0.0, 0.0, 0.0)), step = 4)
        assertEquals(16 * 6 * 3, half.size)
        assertEquals(0, Ar.unproject(ShortArray(w * h) { 9000 }, null, w, h, 50.0, 50.0, 32.0, 24.0, yaw(0.0, DoubleArray(3))).size, "past 6 m")
        val pix = mutableListOf<Int>()
        Ar.unproject(depth, null, w, h, 50.0, 50.0, 32.0, 24.0, yaw(0.0, DoubleArray(3)), step = 16, pix = pix)
        assertEquals(listOf(8, 8, 24, 8, 40, 8, 56, 8), pix.take(8), "the pixel each point came from")
    }

    @Test fun colours() {
        assertEquals(0xffffff, Ar.rgb(255, 128, 128)); assertEquals(0x000000, Ar.rgb(0, 128, 128))
        val red = Ar.rgb(76, 85, 255); assertTrue((red shr 16) > 240 && ((red shr 8) and 0xff) < 15 && (red and 0xff) < 15, "BT.601 red")
    }

    @Test fun theCloudKeepsOnePointPerVoxel() {
        val c = ArCloud(voxel = 0.02, cap = 5)
        assertTrue(c.add(0.001, 0.001, 0.001)); assertTrue(!c.add(0.011, 0.012, 0.019), "same 2 cm cell")
        assertTrue(c.add(0.021, 0.0, 0.0)); assertTrue(c.add(-0.001, 0.0, 0.0), "the other side of zero is another cell")
        assertEquals(3, c.size)
        c.add(1.0, 1.0, 1.0); c.add(2.0, 2.0, 2.0); c.add(3.0, 3.0, 3.0)
        assertEquals(5, c.size); assertTrue(c.full, "the cap holds")
        assertTrue(!c.add(Double.NaN, 0.0, 0.0))
        val d = ArCloud()
        d.camera(doubleArrayOf(0.0, 1.5, 0.0), doubleArrayOf(0.0, 0.0, -1.0)); d.camera(doubleArrayOf(0.1, 1.5, 0.0), doubleArrayOf(0.0, 0.0, -1.0))
        d.camera(doubleArrayOf(0.4, 1.5, 0.0), doubleArrayOf(0.0, 0.0, -1.0))
        assertEquals(2, d.cameras, "a camera every 30 cm")
    }

    /** A 4 × 3 m room, 2.6 m high, scanned from its middle: walls, floor and a ceiling, every 5 cm. */
    private fun room(): Pair<ArCloud, List<Pair<List<Double>, List<Double>>>> {
        val c = ArCloud(voxel = 0.1)
        // the AR session's origin is where the phone started: the room's corner (0, 0, 0) is at (−1.2, −1.4, 0.7)
        val o = doubleArrayOf(-1.2, -1.4, 0.7)
        fun put(x: Double, y: Double, z: Double, col: Int) = c.add(o[0] + x, o[1] + y, o[2] - z, col)
        var a = 0.0
        while (a <= 4.0001) { var y = 0.0; while (y <= 2.6001) { put(a, y, 0.0, 0xc8b496); put(a, y, 3.0, 0xc8b496); y += 0.05 }; a += 0.05 }
        a = 0.0
        while (a <= 3.0001) { var y = 0.0; while (y <= 2.6001) { put(0.0, y, a, 0xb4a082); put(4.0, y, a, -1); y += 0.05 }; a += 0.05 }
        var x = 0.0
        while (x <= 4.0001) { var z = 0.0; while (z <= 3.0001) { put(x, 0.0, z, 0x6e5a46); z += 0.05 }; x += 0.05 }
        // the phone walked round the middle at 1.5 m
        for (i in 0 until 12) {
            val t = 2 * Math.PI * i / 12
            c.camera(doubleArrayOf(o[0] + 2 + 0.8 * cos(t), o[1] + 1.5, o[2] - 1.5 - 0.6 * sin(t)), doubleArrayOf(cos(t), 0.0, -sin(t)))
        }
        val m = listOf(
            listOf(o[0], o[1], o[2]) to listOf(o[0] + 4.0, o[1], o[2]),                // the long wall along the floor: 4 m
            listOf(o[0], o[1], o[2]) to listOf(o[0], o[1] + 2.6, o[2]),                // the height: 2.6 m
        )
        return c to m
    }

    @Test fun aScanIsAHouse3dFileToScale() {
        val (c, m) = room()
        val h = c.toHouse3d("Nappali (AR)", 1_763_800_000_000, m) { listOf("Hosszú fal", "Belmagasság")[it] }
        assertEquals("vrg-house3d", h.getString("kind")); assertEquals(1, h.getInt("v"))
        assertEquals(1000, h.getJSONObject("scale").getInt("mmPerUnit"), "already to scale: 1 unit = 1 m")
        assertTrue(h.getJSONObject("tool").getBoolean("arcore"))
        val pts = h.getJSONArray("pts"); assertEquals(3 * c.size, pts.length()); assertEquals(pts.length(), h.getJSONArray("rgb").length())
        assertEquals(12, h.getJSONArray("cams").length())
        // centred on the camera path: the cameras' mean at the origin
        val cams = h.getJSONArray("cams")
        val mean = DoubleArray(3).also { s -> for (i in 0 until cams.length()) for (k in 0..2) s[k] += cams.getJSONObject(i).getJSONArray("c").getDouble(k) / cams.length() }
        assertTrue(mean.all { abs(it) < 1e-3 }, "centred: " + mean.toList())
        val ms = h.getJSONArray("measures"); assertEquals(2, ms.length())
        fun len(i: Int): Double { val a = ms.getJSONObject(i).getJSONArray("a"); val b = ms.getJSONObject(i).getJSONArray("b"); return Math.sqrt((0..2).sumOf { (a.getDouble(it) - b.getDouble(it)).let { d -> d * d } }) * 1000 }
        assertEquals(4000.0, len(0), 1.0); assertEquals(2600.0, len(1), 1.0)
        assertEquals("Hosszú fal", ms.getJSONObject(0).getString("label"))
        assertTrue(c.size < 3 * (81 * 53 + 61 * 53 + 81 * 61), "the voxel thinned the 5 cm grid")

        val fx = JSONObject().put("about", "skcam K6 (WP M64): a scan of a known 4 × 3 × 2.6 m room as the AR meter writes it, by sketch-core ArTest (VRG_SKETCH_FIXTURE=update); opened by Sketcher/test/ar-scan.test.js with the Desktop's house3d.js. Do not edit.")
            .put("house", h)
        val file = File(repo, "Sketcher/test/fixtures/ar-scan.house3d.json")
        if (System.getenv("VRG_SKETCH_FIXTURE") == "update") file.writeText(fx.toString() + "\n")
        assertNotNull(file.takeIf { it.exists() }, "ar-scan.house3d.json missing: VRG_SKETCH_FIXTURE=update ./gradlew :sketch-core:test")
        assertTrue(JSONObject(file.readText()).similar(fx), "ar-scan.house3d.json is stale: VRG_SKETCH_FIXTURE=update ./gradlew :sketch-core:test")
    }
}
