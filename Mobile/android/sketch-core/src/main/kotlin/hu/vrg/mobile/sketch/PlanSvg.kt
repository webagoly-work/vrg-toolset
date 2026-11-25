package hu.vrg.mobile.sketch

import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

// F9 (WP M54, D-122): the drawing of the Felmérési jegyzőkönyv on the phone. The same SVG as the Desktop page's
// svgPlan (Sketcher/src/app.js): with a solved plan in the package, its floors in millimetres (the ≈ edges dashed and
// measured), the devices and the photo points' four wedges; without one, the sketch in drawing units. The phone feeds it
// the plan PlannerExport builds, i.e. exactly what the Desktop shows when it opens that package (ReportSvgTest replays
// the Desktop's own output from Sketcher/test/fixtures/report.json). The arithmetic follows app.js step by step, the
// numbers are printed as JavaScript prints them (JsNum), so the two documents are the same text.
object PlanSvg {
    /** app.js TYPES: the device titles. */
    private val TYPES = mapOf("socket" to "Dugalj", "switch" to "Kapcsoló", "light" to "Lámpa", "junction" to "Kötődoboz", "data" to "Adat",
        "fixed" to "Fix bekötés", "sensor" to "Érzékelő", "board" to "Elosztó", "pont" to "Típustalan")
    const val EMPTY = "<div class=\"empty\">Még nincs rajz a felmérésben.</div>"

    private class Poly(val poly: List<DoubleArray>, val name: String, val est: Set<Int>)
    private class Dev(val x: Double, val y: Double, val st: String, val type: String)
    private class Photo(val x: Double, val y: Double, val degs: List<Double>)

    private fun pts(a: JSONArray?): List<DoubleArray> = if (a == null) emptyList() else (0 until a.length()).mapNotNull { i ->
        a.optJSONArray(i)?.takeIf { it.length() >= 2 }?.let { doubleArrayOf(it.getDouble(0), it.getDouble(1)) }
    }
    private fun objs(a: JSONArray?): List<JSONObject> = if (a == null) emptyList() else (0 until a.length()).mapNotNull { a.optJSONObject(it) }
    private fun degs(o: JSONObject) = objs(o.optJSONArray("shots")).map { it.optDouble("deg", 0.0) }
    /** JavaScript's `a || b` for strings. */
    private fun or(vararg s: String?) = s.firstOrNull { !it.isNullOrEmpty() } ?: ""

    /** The SVG for [survey] (the survey JSON, SketchJson.write) and the package's [plan] (PlannerExport.build(...)["plan"]), or null. */
    fun svg(survey: JSONObject, plan: JSONObject?): String {
        val data = plan?.optJSONObject("data")
        val floors = objs(data?.optJSONArray("floors"))
        val mm = floors.isNotEmpty()
        val polys: List<Poly>; val devs: List<Dev>; val photos: List<Photo>
        if (mm) {
            polys = floors.map { f ->
                val est = f.optJSONObject("sk")?.optJSONArray("est")?.let { a -> (0 until a.length()).map { a.getInt(it) }.toSet() } ?: emptySet()
                Poly(pts(f.optJSONArray("poly")), f.optString("name", ""), est)
            }
            devs = objs(data!!.optJSONArray("devices")).map { d -> Dev(d.optDouble("x"), d.optDouble("y"), or(d.optJSONObject("sk")?.optString("st"), "tervezett"), d.optString("type", "")) }
            photos = objs(plan.optJSONArray("photos")).map { p -> Photo(p.optDouble("x"), p.optDouble("y"), degs(p)) }
        } else {
            polys = objs(survey.optJSONArray("rooms")).map { r ->
                Poly(pts(r.optJSONArray("poly")), or(r.optString("name"), r.optJSONArray("kinds")?.optString(0), r.optString("id")), emptySet())
            }
            devs = objs(survey.optJSONArray("points")).mapNotNull { p -> pts(JSONArray().put(p.optJSONArray("at") ?: return@mapNotNull null)).firstOrNull()?.let { Dev(it[0], it[1], or(p.optString("st"), "tervezett"), p.optString("type", "")) } }
            photos = objs(survey.optJSONArray("photos")).mapNotNull { p -> pts(JSONArray().put(p.optJSONArray("at") ?: return@mapNotNull null)).firstOrNull()?.let { Photo(it[0], it[1], degs(p)) } }
        }
        val all = ArrayList<DoubleArray>()
        polys.forEach { all.addAll(it.poly) }
        devs.forEach { all.add(doubleArrayOf(it.x, it.y)) }; photos.forEach { all.add(doubleArrayOf(it.x, it.y)) }
        if (all.isEmpty()) return EMPTY
        var b = bbox(all)
        val ext = max(max(b[2] - b[0], b[3] - b[1]), 1.0); val pad = ext * 0.08; val wr = ext / 12
        b = doubleArrayOf(b[0] - pad - wr, b[1] - pad - wr, b[2] + pad + wr, b[3] + pad + wr)
        val fs = ext * 0.03; val dr = ext * 0.012
        val n = JsNum::str
        val out = StringBuilder("<svg id=\"plansvg\" viewBox=\"" + n(b[0]) + " " + n(b[1]) + " " + n(b[2] - b[0]) + " " + n(b[3] - b[1]) + "\" xmlns=\"http://www.w3.org/2000/svg\">")
        polys.forEach { r ->
            val p = r.poly; if (p.size < 3) return@forEach
            out.append("<polygon class=\"fl\" points=\"").append(p.joinToString(" ") { n(it[0]) + "," + n(it[1]) }).append("\"/>")
            p.forEachIndexed { i, q ->
                val nx = p[(i + 1) % p.size]; val est = i in r.est; val len = hypot(nx[0] - q[0], nx[1] - q[1])
                out.append("<line class=\"" + (if (est) "est" else "edge") + "\" x1=\"" + n(q[0]) + "\" y1=\"" + n(q[1]) + "\" x2=\"" + n(nx[0]) + "\" y2=\"" + n(nx[1]) + "\"/>")
                if (est && mm) out.append("<text class=\"lbl e\" font-size=\"" + n(fs * 0.85) + "\" x=\"" + n((q[0] + nx[0]) / 2) + "\" y=\"" + n((q[1] + nx[1]) / 2 - fs * 0.4) + "\">≈ " + f1(len / 1000) + " m</text>")
            }
            val bb = bbox(p)
            if (r.name.isNotEmpty()) out.append("<text class=\"lbl\" font-size=\"" + n(fs) + "\" x=\"" + n((bb[0] + bb[2]) / 2) + "\" y=\"" + n((bb[1] + bb[3]) / 2) + "\">" + esc(r.name) + "</text>")
        }
        photos.forEach { p ->
            listOf(0, 90, 180, 270).forEach { deg ->
                val has = p.degs.any { s -> ((s % 360) + 360) % 360 == deg.toDouble() }
                fun pt(a: Int) = doubleArrayOf(p.x + wr * sin(a * PI / 180), p.y - wr * cos(a * PI / 180))
                val A = pt(deg - 40); val B = pt(deg + 40)
                out.append("<path class=\"wedge " + (if (has) "shot" else "noshot") + "\" d=\"M" + n(p.x) + " " + n(p.y) + " L" + n(A[0]) + " " + n(A[1]) +
                    " A" + n(wr) + " " + n(wr) + " 0 0 1 " + n(B[0]) + " " + n(B[1]) + " Z\"/>")
            }
        }
        devs.forEach { d ->
            val old = d.st == "meglevo"
            out.append("<circle class=\"dev " + (if (old) "meglevo" else "tervezett") + "\" cx=\"" + n(d.x) + "\" cy=\"" + n(d.y) + "\" r=\"" + n(dr) + "\"><title>" +
                esc(or(TYPES[d.type], d.type)) + " (" + (if (old) "meglévő" else "tervezett") + ")</title></circle>")
        }
        return out.append("</svg>").toString()
    }

    /** The phone's own survey: its package plan as PlannerExport builds it, then [svg]. */
    fun of(s: Sketch, norm: Norm = Solver().solve(s)): String = PlannerExport.build(s, norm, 0).let { svg(it.getJSONObject("sketch"), it.optJSONObject("plan")) }

    internal fun bbox(p: List<DoubleArray>): DoubleArray = p.fold(doubleArrayOf(Double.POSITIVE_INFINITY, Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY, Double.NEGATIVE_INFINITY)) { b, q ->
        doubleArrayOf(min(b[0], q[0]), min(b[1], q[1]), max(b[2], q[0]), max(b[3], q[1]))
    }
    private fun f1(x: Double) = JsNum.str(JsNum.round(x * 10) / 10).replace('.', ',')
    internal fun esc(s: String) = buildString { s.forEach { c -> append(when (c) { '&' -> "&amp;"; '<' -> "&lt;"; '>' -> "&gt;"; '"' -> "&quot;"; '\'' -> "&#39;"; else -> c.toString() }) } }
}
