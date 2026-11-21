package hu.vrg.mobile.sketch

import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.max

// F9 (WP M54, D-122): the site drawing of the Felmérési jegyzőkönyv on the phone, the Desktop page's sitePlaceSvg
// (Sketcher/src/app.js) in Kotlin: the building's outline, the plan's rooms placed on it (SitePlace, the same maths as
// Map/lib/site-math.js) and the walls that stick out, north up; plus the report's lines in words. ReportSvgTest replays
// the Desktop's own output (Sketcher/test/fixtures/report.json).
object SiteSvg {
    data class Out(val svg: String, val lines: List<String>)

    /** The rooms the Desktop places: the package's floors in metres (site-math roomsFromMm). */
    fun rooms(plan: JSONObject?): List<SitePlace.PRoom> {
        val fl = plan?.optJSONObject("data")?.optJSONArray("floors") ?: return emptyList()
        return (0 until fl.length()).mapNotNull { fl.optJSONObject(it) }.mapNotNull { f ->
            val p = f.optJSONArray("poly") ?: return@mapNotNull null
            if (p.length() < 3) null else SitePlace.PRoom(f.optString("name", ""), (0 until p.length()).map { i -> p.getJSONArray(i).let { Pt(it.getDouble(0) / 1000, it.getDouble(1) / 1000) } })
        }
    }

    /** As the Desktop's report: nothing without an outline; the placement and its lines only with a plan to place. */
    fun of(site: Site?, plan: JSONObject?): Out {
        val out = site?.outline.orEmpty()
        if (out.size < 3) return Out("", emptyList())
        val rooms = rooms(plan)
        val place = site?.place?.takeIf { rooms.isNotEmpty() }
        val rep = place?.let { SitePlace.report(rooms, out, it) }
        return Out(svg(out, rooms, place, rep), SitePlace.lines(rep))
    }

    fun svg(out: List<Pair<Double, Double>>, rooms: List<SitePlace.PRoom>, place: Placement?, rep: SitePlace.Report?): String {
        var lat0 = 0.0; out.forEach { lat0 += it.first }; lat0 /= out.size
        var lon0 = 0.0; out.forEach { lon0 += it.second }; lon0 /= out.size
        val poly = out.map { SitePlace.local(lat0, lon0, it.first, it.second) }
        val pr = if (place != null) SitePlace.placed(rooms, place, lat0, lon0) else emptyList()
        val pts = (poly + pr.flatMap { it.poly }).map { doubleArrayOf(it.x, it.y) }
        var b = PlanSvg.bbox(pts)
        val ext = max(max(b[2] - b[0], b[3] - b[1]), 1.0); val pad = ext * 0.1
        b = doubleArrayOf(b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad)
        val n = JsNum::str
        fun P(p: List<Pt>) = p.joinToString(" ") { JsNum.fixed(it.x, 2) + "," + JsNum.fixed(it.y, 2) }
        val sw = ext / 150
        val svg = StringBuilder("<svg class=\"siteplace\" viewBox=\"" + n(b[0]) + " " + n(b[1]) + " " + n(b[2] - b[0]) + " " + n(b[3] - b[1]) + "\" xmlns=\"http://www.w3.org/2000/svg\">" +
            "<polygon class=\"so\" points=\"" + P(poly) + "\" stroke-width=\"" + n(sw * 2) + "\"/>")
        pr.forEach { svg.append("<polygon class=\"sp\" points=\"" + P(it.poly) + "\" stroke-width=\"" + n(sw) + "\"/>") }
        rep?.walls?.forEach { w ->
            val r = pr.getOrNull(w.room)?.poly ?: return@forEach
            val a = r[w.edge]; val c = r[(w.edge + 1) % r.size]
            svg.append("<line class=\"sb\" x1=\"" + n(a.x) + "\" y1=\"" + n(a.y) + "\" x2=\"" + n(c.x) + "\" y2=\"" + n(c.y) + "\" stroke-width=\"" + n(sw * 3) + "\"/>")
        }
        return svg.append("<text x=\"" + n(b[0] + pad * 0.3) + "\" y=\"" + n(b[1] + pad * 0.8) + "\" font-size=\"" + n(ext * 0.05) + "\">É ↑</text></svg>").toString()
    }

    internal fun outlineOf(a: JSONArray): List<Pair<Double, Double>> = (0 until a.length()).map { a.getJSONArray(it).let { p -> p.getDouble(0) to p.getDouble(1) } }
}
