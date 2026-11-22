package hu.vrg.mobile.sketch

import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.roundToLong
import kotlin.math.sqrt

// Google AR csomag (dev line skcam, stage K6, WP M64): the pure half of the AR meter. The phone's AR screen
// (feature-sketch ArMeter.kt) runs Google's ARCore on the phone; everything it measures or collects comes here, so it is
// tested on the JVM:
//
//  - the survey's optional `ar` key: { lines: [{id, mm, label?, room?, edge?, a:[x,y,z], b:[x,y,z], at}],
//    files: [{kind: "scan"|"rec", file, n?, at}] }. The millimetres are what the meter showed (ARCore works in metres);
//    a, b are in that AR session's frame (gravity up, metres) and only mean something together.
//  - ArCloud: the points of a room scan (ARCore's feature points and, where the phone has it, Raw Depth), thinned on a
//    voxel grid, written as a `vrg-house3d` file (the K5 format, Sketcher/lib/house3d.js) that is already to scale:
//    the Desktop Sketcher's 🏠 Ház 3D viewer opens it and measures on it with no 📏 Lépték step.
//  - unproject(): a Raw Depth image (mm, uint16) and its confidence into world points, the maths behind the scan.
//
// The whole pack is one switch (FEATURE, default off): the Founder's "a pack that can be activated (not just
// feature-by-feature)". Off, nothing of it shows and the app never touches ARCore; on a phone without Google Play
// Services for AR the switch says so instead of opening the meter.
object Ar {
    /** The pack's one registry switch (Sketcher/catalog/features.json). */
    const val FEATURE = "kamera.ar"

    /** The voxel a scan keeps one point per (metres) and the most points one file holds (= house3d.js's cap). */
    const val VOXEL_M = 0.02
    const val MAX_POINTS = 250_000

    data class Line(val id: String, val mm: Int, val label: String = "", val room: String? = null, val edge: Int? = null,
                    val a: List<Double> = emptyList(), val b: List<Double> = emptyList(), val at: Long = 0)
    data class FileRef(val kind: String, val file: String, val n: Int? = null, val at: Long = 0)
    data class Record(val lines: List<Line> = emptyList(), val files: List<FileRef> = emptyList())

    private fun vec(a: JSONArray?): List<Double> =
        if (a == null || a.length() != 3) emptyList() else (0 until 3).map { a.optDouble(it) }.takeIf { v -> v.all { it.isFinite() } } ?: emptyList()
    private fun r4(v: Double) = (v * 10000).roundToLong() / 10000.0
    private fun arr(v: List<Double>) = JSONArray().apply { v.forEach { put(r4(it)) } }

    fun parse(text: String?): Record {
        val o = text?.let { runCatching { JSONObject(it) }.getOrNull() } ?: return Record()
        val lines = mutableListOf<Line>()
        o.optJSONArray("lines")?.let { a -> for (i in 0 until a.length()) a.optJSONObject(i)?.let { l ->
            val mm = l.optDouble("mm", Double.NaN)
            if (mm.isFinite() && mm > 0 && l.optString("id").isNotBlank())
                lines += Line(l.optString("id"), mm.roundToInt(), l.optString("label"), l.optString("room").ifBlank { null },
                    if (l.has("edge")) l.optInt("edge") else null, vec(l.optJSONArray("a")), vec(l.optJSONArray("b")), l.optLong("at"))
        } }
        val files = mutableListOf<FileRef>()
        o.optJSONArray("files")?.let { a -> for (i in 0 until a.length()) a.optJSONObject(i)?.let { f ->
            val kind = f.optString("kind")
            if ((kind == "scan" || kind == "rec") && f.optString("file").isNotBlank())
                files += FileRef(kind, f.optString("file"), if (f.has("n")) f.optInt("n") else null, f.optLong("at"))
        } }
        return Record(lines, files)
    }

    fun text(r: Record): String? {
        if (r.lines.isEmpty() && r.files.isEmpty()) return null
        val o = JSONObject()
        if (r.lines.isNotEmpty()) o.put("lines", JSONArray().apply { r.lines.forEach { l ->
            put(JSONObject().put("id", l.id).put("mm", l.mm).apply {
                if (l.label.isNotBlank()) put("label", l.label)
                l.room?.let { put("room", it) }; l.edge?.let { put("edge", it) }
                if (l.a.size == 3) put("a", arr(l.a)); if (l.b.size == 3) put("b", arr(l.b))
                put("at", l.at)
            })
        } })
        if (r.files.isNotEmpty()) o.put("files", JSONArray().apply { r.files.forEach { f ->
            put(JSONObject().put("kind", f.kind).put("file", f.file).apply { f.n?.let { put("n", it) } }.put("at", f.at))
        } })
        return o.toString()
    }

    fun of(s: Sketch): Record = parse(s.ar)

    /** One measured distance into the survey; its id is "A" + the next number. */
    fun addLine(s: Sketch, mm: Int, a: List<Double>, b: List<Double>, now: Long, label: String = "", room: String? = null, edge: Int? = null): Sketch {
        if (mm <= 0) return s
        val r = of(s)
        val n = (r.lines.mapNotNull { it.id.removePrefix("A").toIntOrNull() }.maxOrNull() ?: 0) + 1
        return s.copy(ar = text(r.copy(lines = r.lines + Line("A$n", mm, label.trim(), room, edge, a, b, now))))
    }

    fun relabel(s: Sketch, id: String, label: String): Sketch {
        val r = of(s)
        return s.copy(ar = text(r.copy(lines = r.lines.map { if (it.id == id) it.copy(label = label.trim()) else it })))
    }

    fun removeLine(s: Sketch, id: String): Sketch { val r = of(s); return s.copy(ar = text(r.copy(lines = r.lines.filter { it.id != id }))) }

    /** A scan or a recording saved to the phone's shared folder, listed with the survey (the file itself is not in it). */
    fun addFile(s: Sketch, kind: String, file: String, now: Long, n: Int? = null): Sketch {
        val r = of(s)
        return s.copy(ar = text(r.copy(files = r.files.filter { it.file != file } + FileRef(kind, file, n, now))))
    }

    fun read(o: JSONObject, s: Sketch): Sketch = s.copy(ar = o.optJSONObject("ar")?.let { text(parse(it.toString())) })

    /** Written only when something is in it; a line whose room is gone loses its room (the distance stays). */
    fun write(s: Sketch, o: JSONObject) {
        val r = of(s)
        if (r.lines.isEmpty() && r.files.isEmpty()) return
        val rooms = s.rooms.map { it.id }.toSet()
        val clean = r.copy(lines = r.lines.map { if (it.room != null && it.room !in rooms) it.copy(room = null, edge = null) else it })
        o.put("ar", JSONObject(text(clean)!!))
    }

    /** One readable line per distance: "Távolság A1: 3,42 m", the label instead of the default name when there is one. */
    fun summary(s: Sketch): List<String> = of(s).lines.map { (it.label.ifBlank { "Távolság " + it.id }) + ": " + Planes.fmt(it.mm.toDouble()) }

    /** The distance between two points in metres, as whole millimetres (what the meter shows and keeps). */
    fun mm(a: DoubleArray, b: DoubleArray): Int {
        val dx = a[0] - b[0]; val dy = a[1] - b[1]; val dz = a[2] - b[2]
        return (sqrt(dx * dx + dy * dy + dz * dz) * 1000).roundToInt()
    }

    /** A file name for a scan or a recording: "<survey>-ar-<yyyyMMdd-HHmm>.<ext>" (safe characters only). */
    fun fileName(survey: String, stamp: String, ext: String): String =
        (survey.ifBlank { "vazlat" }.replace(Regex("[^\\p{L}\\p{N}._-]+"), "-").trim('-').take(40).ifBlank { "vazlat" }) + "-ar-" + stamp + "." + ext

    // ---- Raw Depth → world points ------------------------------------------------------------------------------------

    /**
     * The points of one Raw Depth image. [depth] holds millimetres (0 = none), row by row ([w] × [h]); [conf] the
     * confidence 0…255 per pixel (null: all kept). [fx], [fy], [cx], [cy] are the depth image's intrinsics (the camera's,
     * scaled to its size). [pose] is ARCore's camera pose as a column-major 4×4 matrix (Camera.getPose().toMatrix):
     * +X right and +Y up along the image readout, the camera looking down −Z. Every [step]-th pixel in both directions,
     * kept when confident enough and between [near] and [far] metres. Returns x, y, z triples in world metres and,
     * when [pix] is given, the pixel (u, v) each came from (for its colour).
     */
    fun unproject(depth: ShortArray, conf: ByteArray?, w: Int, h: Int, fx: Double, fy: Double, cx: Double, cy: Double,
                  pose: FloatArray, step: Int = 4, minConf: Int = 128, near: Double = 0.2, far: Double = 6.0,
                  pix: MutableList<Int>? = null): DoubleArray {
        val out = ArrayList<Double>()
        val st = max(1, step)
        var v = st / 2
        while (v < h) {
            var u = st / 2
            while (u < w) {
                val i = v * w + u
                val d = (depth[i].toInt() and 0xffff) / 1000.0
                val c = if (conf == null) 255 else conf[i].toInt() and 0xff
                if (d in near..far && c >= minConf) {
                    val xc = (u + 0.5 - cx) / fx * d
                    val yc = -(v + 0.5 - cy) / fy * d
                    val zc = -d
                    out += pose[0] * xc + pose[4] * yc + pose[8] * zc + pose[12]
                    out += pose[1] * xc + pose[5] * yc + pose[9] * zc + pose[13]
                    out += pose[2] * xc + pose[6] * yc + pose[10] * zc + pose[14]
                    pix?.add(u); pix?.add(v)
                }
                u += st
            }
            v += st
        }
        return out.toDoubleArray()
    }

    /** One pixel of a YUV 4:2:0 camera image as 0xRRGGBB (BT.601, full range: what Android's camera hands over). */
    fun rgb(y: Int, u: Int, v: Int): Int {
        val yy = y.toDouble(); val uu = u - 128.0; val vv = v - 128.0
        fun c(x: Double) = min(255, max(0, x.roundToInt()))
        return (c(yy + 1.402 * vv) shl 16) or (c(yy - 0.344136 * uu - 0.714136 * vv) shl 8) or c(yy + 1.772 * uu)
    }
}

/**
 * The points of one room scan, one per [voxel] (metres): the first point in a voxel stays, later ones there add nothing,
 * so standing still never grows the file. The camera's path is kept every [camStep] metres. Not thread-safe: the AR
 * screen adds from its GL thread and writes the file after the scan has stopped.
 */
class ArCloud(private val voxel: Double = Ar.VOXEL_M, private val cap: Int = Ar.MAX_POINTS, private val camStep: Double = 0.3) {
    private val seen = HashSet<Long>()
    private var xyz = FloatArray(3 * 4096)
    private var rgb = IntArray(4096)
    var size = 0; private set
    var depth = false; private set
    private val cams = mutableListOf<Pair<DoubleArray, DoubleArray>>()
    val full get() = size >= cap

    private fun key(x: Double, y: Double, z: Double): Long {
        // 21 bits per axis: ±20 km at 2 cm, more than any house
        fun q(v: Double) = (floor(v / voxel).toLong() + (1L shl 20)) and 0x1fffff
        return (q(x) shl 42) or (q(y) shl 21) or q(z)
    }

    /** Adds one point (world metres) with its colour (0xRRGGBB, or -1 when unknown). Returns true when it was new. */
    fun add(x: Double, y: Double, z: Double, color: Int = -1): Boolean {
        if (size >= cap || !x.isFinite() || !y.isFinite() || !z.isFinite()) return false
        if (!seen.add(key(x, y, z))) return false
        if (3 * size + 3 > xyz.size) { xyz = xyz.copyOf(xyz.size * 2); rgb = rgb.copyOf(rgb.size * 2) }
        xyz[3 * size] = x.toFloat(); xyz[3 * size + 1] = y.toFloat(); xyz[3 * size + 2] = z.toFloat()
        rgb[size] = color
        size++
        return true
    }

    /** Adds x, y, z triples (as unproject() returns them), with [colors] per point when known. Returns how many were new. */
    fun addAll(p: DoubleArray, colors: IntArray? = null, fromDepth: Boolean = false): Int {
        var n = 0
        for (i in 0 until p.size / 3) if (add(p[3 * i], p[3 * i + 1], p[3 * i + 2], colors?.getOrNull(i) ?: -1)) n++
        if (fromDepth && n > 0) depth = true
        return n
    }

    /** The camera at [c] looking along [d] (world): kept when it has moved [camStep] from the last one kept. */
    fun camera(c: DoubleArray, d: DoubleArray) {
        val last = cams.lastOrNull()?.first
        if (last == null || Ar.mm(last, c) >= camStep * 1000) cams += c.copyOf() to d.copyOf()
    }
    val cameras get() = cams.size

    /** The points as a flat x, y, z array (world metres), for the screen's preview. */
    fun points(): FloatArray = xyz.copyOf(3 * size)

    /** The points added since the [start]-th, as a flat x, y, z array: the screen appends them to its preview. */
    fun pointsFrom(start: Int): FloatArray = if (start >= size) FloatArray(0) else xyz.copyOfRange(3 * max(0, start), 3 * size)

    /**
     * The scan as a `vrg-house3d` file (Sketcher/lib/house3d.js, v 1): centred on the camera path like a COLMAP model,
     * already upright (ARCore's +Y is up), and to scale: 1 unit = 1 m (scale.mmPerUnit 1000, its line a metre along +X
     * at the middle). [measures] are AR distances of the same session (world metres), kept as the file's measurements.
     */
    fun toHouse3d(name: String, now: Long, measures: List<Pair<List<Double>, List<Double>>> = emptyList(), label: (Int) -> String? = { null }): JSONObject {
        val n = max(1, cams.size)
        val mid = DoubleArray(3).also { m -> if (cams.isEmpty()) { for (i in 0 until size) for (k in 0..2) m[k] += xyz[3 * i + k] / max(1, size) } else cams.forEach { (c, _) -> for (k in 0..2) m[k] += c[k] / n } }
        fun r4(v: Double) = (v * 10000).roundToLong() / 10000.0
        fun at(v: List<Double>) = JSONArray().apply { for (k in 0..2) put(r4(v[k] - mid[k])) }
        val pts = JSONArray(); val col = JSONArray()
        var coloured = 0
        for (i in 0 until size) {
            for (k in 0..2) pts.put(r4(xyz[3 * i + k] - mid[k]))
            val c = rgb[i]
            if (c >= 0) coloured++
            val cc = if (c >= 0) c else 0x9aa7b4    // no colour: the viewer's grey-blue
            col.put((cc shr 16) and 0xff); col.put((cc shr 8) and 0xff); col.put(cc and 0xff)
        }
        val camsJ = JSONArray()
        cams.forEachIndexed { i, (c, d) ->
            camsJ.put(JSONObject().put("name", "ar-%03d".format(i + 1)).put("c", at(c.toList())).put("d", JSONArray().apply { d.forEach { put(r4(it)) } }))
        }
        val meas = JSONArray()
        measures.forEachIndexed { i, (a, b) ->
            if (a.size == 3 && b.size == 3) meas.put(JSONObject().put("a", at(a)).put("b", at(b)).apply { label(i)?.takeIf { it.isNotBlank() }?.let { put("label", it) } })
        }
        return JSONObject()
            .put("kind", "vrg-house3d").put("v", 1).put("name", name).put("created", now)
            .put("tool", JSONObject().put("arcore", true).put("depth", depth).put("voxel", voxel))
            .put("report", JSONObject().put("images", cams.size).put("registered", cams.size).put("points", size).put("err", JSONObject.NULL)
                .put("ar", true).put("coloured", coloured))
            .put("up", JSONArray().put(0).put(1).put(0))
            .put("pts", pts).put("rgb", col).put("cams", camsJ)
            .put("scale", JSONObject().put("mmPerUnit", 1000).put("a", JSONArray().put(0).put(0).put(0)).put("b", JSONArray().put(1).put(0).put(0)).put("mm", 1000))
            .put("measures", meas)
    }
}
