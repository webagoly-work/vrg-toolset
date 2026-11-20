package hu.vrg.mobile.sketch

import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

// Helyszín ↔ Térkép (fork F1): the solved sketch placed on the building, not only measured against it. The same maths
// as Map/lib/site-math.js (the map page and the Desktop Sketcher); Sketcher/test/fixtures/site.json is written by the
// JS and replayed by SitePlaceTest, so the phone, the map and the Desktop agree on where the sketch sits.
//
// Frames: lat/lon on the map; "local" = metres east (x) and south (y) of a reference point; "plan" = the solved sketch
// in metres, y down (south while the plan is not turned). A Placement puts the plan's box centre at its lat/lon,
// turned rot degrees clockwise.
object SitePlace {
    private const val R = 6371008.8
    private const val D = PI / 180

    /** One room of the solved plan, in metres. */
    data class PRoom(val name: String, val poly: List<Pt>)

    /** The oriented box: centre, long side, short side, the long side's direction (degrees clockwise from east, 0..180). */
    data class OBox(val cx: Double, val cy: Double, val w: Double, val d: Double, val axis: Double)

    data class Wall(val room: Int, val name: String, val edge: Int, val dir: String, val out: Double)

    /** [verdict]: "rendben", "elforgatva" (walls not parallel), "eltolva" (inside, off centre), "kilog" (a wall sticks out). */
    data class Report(val turn: Double, val offset: Double, val offsetDir: String, val walls: List<Wall>, val inside: Double, val verdict: String)

    fun local(lat0: Double, lon0: Double, lat: Double, lon: Double) = Pt((lon - lon0) * D * R * cos(lat0 * D), -(lat - lat0) * D * R)
    fun toLatLon(lat0: Double, lon0: Double, x: Double, y: Double) = (lat0 - y / R / D) to (lon0 + x / (R * cos(lat0 * D)) / D)
    fun turn(p: Pt, deg: Double): Pt { val c = cos(deg * D); val s = sin(deg * D); return Pt(p.x * c - p.y * s, p.x * s + p.y * c) }
    fun norm180(a: Double): Double { var x = ((a % 360) + 360) % 360; if (x > 180) x -= 360; return x }
    fun fold90(a: Double): Double { var x = ((a % 90) + 90) % 90; if (x > 45) x -= 90; return x }
    private fun round(v: Double, k: Double) = Math.round(v * k) / k

    private fun insidePoly(p: Pt, poly: List<Pt>) = Geo.inside(p, poly)

    private fun segDist(p: Pt, a: Pt, b: Pt): Double {
        val dx = b.x - a.x; val dy = b.y - a.y; val l2 = dx * dx + dy * dy
        val t = if (l2 < 1e-12) 0.0 else max(0.0, min(1.0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2))
        return hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
    }

    /** How far [p] is outside [poly] (0 inside). */
    fun outside(p: Pt, poly: List<Pt>): Double {
        if (insidePoly(p, poly)) return 0.0
        var d = Double.MAX_VALUE
        for (i in poly.indices) d = min(d, segDist(p, poly[i], poly[(i + 1) % poly.size]))
        return d
    }

    private class Ext(val a: Double, val x0: Double, val x1: Double, val y0: Double, val y1: Double) { val area = (x1 - x0) * (y1 - y0) }

    private fun extent(pts: List<Pt>, a: Double): Ext {
        val c = cos(a * D); val s = sin(a * D)
        var x0 = Double.POSITIVE_INFINITY; var x1 = Double.NEGATIVE_INFINITY; var y0 = Double.POSITIVE_INFINITY; var y1 = Double.NEGATIVE_INFINITY
        for (q in pts) { val x = q.x * c + q.y * s; val y = -q.x * s + q.y * c; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
        return Ext(a, x0, x1, y0, y1)
    }

    /** The smallest-area box over [pts], searched in 0.5° steps and refined in 0.05° steps. */
    fun obox(pts: List<Pt>): OBox? {
        if (pts.size < 3) return null
        var best = extent(pts, 0.0)
        for (i in 1 until 180) { val e = extent(pts, i * 0.5); if (e.area < best.area - 1e-9) best = e }
        val a0 = best.a
        for (i in -10..10) { val e = extent(pts, a0 + i * 0.05); if (e.area < best.area - 1e-9) best = e }
        val wx = best.x1 - best.x0; val wy = best.y1 - best.y0; val mx = (best.x0 + best.x1) / 2; val my = (best.y0 + best.y1) / 2
        val c = cos(best.a * D); val s = sin(best.a * D)
        var axis = if (wx >= wy) best.a else best.a + 90
        axis = ((axis % 180) + 180) % 180
        return OBox(mx * c - my * s, mx * s + my * c, max(wx, wy), min(wx, wy), axis)
    }

    /** The solved sketch's rooms in metres. */
    fun rooms(norm: Norm): List<PRoom> = norm.rooms.filter { it.poly.size >= 3 }.map { r -> PRoom(r.name, r.poly.map { Pt(it.x / 1000, it.y / 1000) }) }

    /** The plan placed in the local frame of ([lat0], [lon0]). */
    fun placed(rooms: List<PRoom>, place: Placement, lat0: Double, lon0: Double): List<PRoom> {
        val pb = obox(rooms.flatMap { it.poly }) ?: return emptyList()
        val at = local(lat0, lon0, place.lat, place.lon)
        return rooms.map { r -> PRoom(r.name, r.poly.map { p -> turn(Pt(p.x - pb.cx, p.y - pb.cy), place.rot) + at }) }
    }

    /** The placed corners as (lon, lat), per room: what the map draws. */
    fun placedLonLat(rooms: List<PRoom>, place: Placement): List<List<Pair<Double, Double>>> =
        placed(rooms, place, place.lat, place.lon).map { r -> r.poly.map { p -> toLatLon(place.lat, place.lon, p.x, p.y).let { it.second to it.first } } }

    private fun ref(outline: List<Pair<Double, Double>>) = outline.sumOf { it.first } / outline.size to outline.sumOf { it.second } / outline.size

    private fun samples(a: Pt, b: Pt, step: Double): List<Pt> {
        val n = max(1, ceil(hypot(b.x - a.x, b.y - a.y) / step).toInt())
        return (0..n).map { i -> Pt(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n) }
    }

    private fun stickScore(rooms: List<PRoom>, poly: List<Pt>): Double {
        var s = 0.0
        for (r in rooms) for (i in r.poly.indices) for (q in samples(r.poly[i], r.poly[(i + 1) % r.poly.size], 0.25)) s += outside(q, poly)
        return s
    }

    /**
     * The first placement: the plan turned to the building's walls (four candidates a quarter turn apart), centred on the
     * building's box; the candidate whose walls stick out least wins, the smaller turn on a tie. Null without a plan or an outline.
     */
    fun autoFit(rooms: List<PRoom>, outline: List<Pair<Double, Double>>, at: Long = 0): Placement? {
        if (rooms.isEmpty() || outline.size < 3) return null
        val (lat0, lon0) = ref(outline)
        val poly = outline.map { local(lat0, lon0, it.first, it.second) }
        val fb = obox(poly) ?: return null
        val pb = obox(rooms.flatMap { it.poly }) ?: return null
        val c = toLatLon(lat0, lon0, fb.cx, fb.cy)
        var best: Pair<Double, Placement>? = null
        for (k in 0 until 4) {
            val rot = round(norm180(fb.axis - pb.axis + k * 90), 100.0)
            val place = Placement(c.first, c.second, rot)
            val score = round(stickScore(placed(rooms, place, lat0, lon0), poly), 1000.0)
            val b = best
            if (b == null || score < b.first - 1e-6 || (abs(score - b.first) <= 1e-6 && abs(rot) < abs(b.second.rot))) best = score to place
        }
        val p = best!!.second
        return Placement(round(p.lat, 1e7), round(p.lon, 1e7), p.rot, true, at)
    }

    val DIRS = listOf("É" to "északi", "ÉK" to "északkeleti", "K" to "keleti", "DK" to "délkeleti", "D" to "déli", "DNy" to "délnyugati", "Ny" to "nyugati", "ÉNy" to "északnyugati")
    private fun sector(x: Double, y: Double) = Math.round((((atan2(x, -y) / D) + 360) % 360) / 45).toInt() % 8

    /** How the placed sketch sits on the building; null without a plan, an outline or a placement. */
    fun report(rooms: List<PRoom>, outline: List<Pair<Double, Double>>, place: Placement?, tol: Double = 0.25): Report? {
        if (rooms.isEmpty() || outline.size < 3 || place == null) return null
        val (lat0, lon0) = ref(outline)
        val poly = outline.map { local(lat0, lon0, it.first, it.second) }
        val pr = placed(rooms, place, lat0, lon0)
        val fb = obox(poly) ?: return null
        val pb = obox(pr.flatMap { it.poly }) ?: return null
        val turnDeg = round(fold90(pb.axis - fb.axis), 10.0)
        val ox = pb.cx - fb.cx; val oy = pb.cy - fb.cy; val off = round(hypot(ox, oy), 100.0)
        val walls = mutableListOf<Wall>()
        var n = 0; var inside = 0
        pr.forEachIndexed { ri, r ->
            val p = r.poly
            for (i in p.indices) {
                val a = p[i]; val b = p[(i + 1) % p.size]
                var worst = 0.0
                val sm = samples(a, b, 0.1)
                // judged on its middle 80 %: a wall that is only too long shows on the walls at its ends instead
                sm.forEachIndexed { k, q ->
                    val o = outside(q, poly); n++; if (o == 0.0) inside++
                    val t = k.toDouble() / (sm.size - 1)
                    if (t >= 0.1 - 1e-9 && t <= 0.9 + 1e-9 && o > worst) worst = o
                }
                if (worst > tol) {
                    val dx = b.x - a.x; val dy = b.y - a.y; val l = hypot(dx, dy).takeIf { it > 0 } ?: 1.0
                    var nx = dy / l; var ny = -dx / l
                    val mid = Pt((a.x + b.x) / 2 + nx * 0.01, (a.y + b.y) / 2 + ny * 0.01)
                    if (insidePoly(mid, p)) { nx = -nx; ny = -ny }
                    walls += Wall(ri, rooms[ri].name, i, DIRS[sector(nx, ny)].first, round(worst, 100.0))
                }
            }
        }
        val verdict = when { walls.isNotEmpty() -> "kilog"; abs(turnDeg) > 3 -> "elforgatva"; off > 1 -> "eltolva"; else -> "rendben" }
        return Report(turnDeg, off, if (off < 0.05) "" else DIRS[sector(ox, oy)].first, walls, if (n > 0) round(inside.toDouble() / n, 1000.0) else 0.0, verdict)
    }

    private fun m1(v: Double) = "%.1f".format(java.util.Locale.ROOT, Math.round(v * 10) / 10.0).replace('.', ',')

    /** The report in the field's words (the map page and the Desktop show the same lines). */
    fun lines(r: Report?): List<String> {
        if (r == null) return emptyList()
        val out = mutableListOf<String>()
        out += when (r.verdict) {
            "rendben" -> "A vázlat a körvonalon belül van, a falak párhuzamosak."
            "elforgatva" -> "A vázlat falai ${m1(abs(r.turn))}°-kal elfordulnak az épületéhez képest."
            "eltolva" -> "A vázlat a körvonalon belül van, de nem középen."
            else -> "A vázlat ${r.walls.size} fala kilóg a körvonalból."
        }
        out += "Elfordulás: ${m1(r.turn)}° · középpont eltérése: ${m1(r.offset)} m" + (if (r.offsetDir.isNotEmpty()) " " + r.offsetDir else "")
        val adj = DIRS.toMap()
        r.walls.take(8).forEach { w -> out += "· ${w.name.ifEmpty { "Helyiség" }}, ${adj[w.dir]} fal: ${m1(w.out)} m-rel kilóg" }
        if (r.walls.size > 8) out += "· … és még ${r.walls.size - 8}"
        return out
    }

    // ---- the survey file: site.outline and site.place (optional keys; a file without them opens as before) ----------

    private fun r7(v: Double) = Math.round(v * 1e7) / 1e7

    internal fun writeSite(t: Site, j: JSONObject) {
        if (t.outline.isNotEmpty()) j.put("outline", outlineJson(t.outline))
        t.place?.let { p -> j.put("place", JSONObject().put("lat", r7(p.lat)).put("lon", r7(p.lon)).put("rot", Math.round(p.rot * 100) / 100.0).put("auto", p.auto).put("at", p.at)) }
    }

    internal fun readSite(t: JSONObject, s: Site): Site = s.copy(outline = readOutline(t.optJSONArray("outline")), place = readPlace(t.optJSONObject("place")))

    fun outlineJson(o: List<Pair<Double, Double>>) = JSONArray().also { a -> o.forEach { a.put(JSONArray().put(r7(it.first)).put(r7(it.second))) } }

    fun readOutline(a: JSONArray?): List<Pair<Double, Double>> {
        if (a == null) return emptyList()
        val pts = (0 until a.length()).mapNotNull { i ->
            val q = a.optJSONArray(i) ?: return@mapNotNull null
            val la = q.optDouble(0); val lo = q.optDouble(1)
            if (la.isNaN() || lo.isNaN() || abs(la) > 90 || abs(lo) > 180) null else la to lo
        }
        return if (pts.size >= 3) pts.take(200) else emptyList()
    }

    fun readPlace(o: JSONObject?): Placement? {
        if (o == null) return null
        val la = o.optDouble("lat"); val lo = o.optDouble("lon"); val rot = o.optDouble("rot", 0.0)
        if (la.isNaN() || lo.isNaN() || rot.isNaN() || abs(la) > 90 || abs(lo) > 180) return null
        return Placement(la, lo, norm180(rot), o.optBoolean("auto", false), o.optLong("at"))
    }
}

/**
 * The phone's map page and the Sketcher talk through two small JSON documents (F1):
 *  - [payload]: what /__phone/site.json gives the map page for one survey (its place, outline, placement and the solved
 *    rooms in metres; no address: the page does not need it);
 *  - the result the page hands back on ✓ Kész (vrg-map:site?…), kept as a file until the Sketcher opens the survey
 *    again and [apply]s it. The same shapes go over postMessage between the Desktop Sketcher and its embedded map.
 */
object SiteLink {
    const val V = 1

    /** Where the map leaves its answer for the Sketcher, relative to the sketches' folder (files/sketch/). */
    fun handoffPath(id: String) = "handoff/$id.site.json"

    fun payload(s: Sketch, norm: Norm): JSONObject {
        val site = s.site ?: Site()
        val o = JSONObject().put("kind", "vrg-site").put("v", V).put("id", s.id).put("name", s.name)
        site.lat?.let { o.put("lat", it) }; site.lon?.let { o.put("lon", it) }
        o.put("outline", SitePlace.outlineJson(site.outline))
        o.put("outlineSrc", site.footprint?.src ?: "")
        site.place?.let { p -> o.put("place", JSONObject().put("lat", p.lat).put("lon", p.lon).put("rot", p.rot).put("auto", p.auto)) }
        o.put("rooms", JSONArray().also { a -> SitePlace.rooms(norm).forEach { r ->
            a.put(JSONObject().put("name", r.name).put("poly", JSONArray().also { pa -> r.poly.forEach { pa.put(JSONArray().put(Math.round(it.x * 1000) / 1000.0).put(Math.round(it.y * 1000) / 1000.0)) } }))
        } })
        return o
    }

    /** [center]: "⇣ Hely átvétele", the map's centre as the job's place (the M30 Átvétel, now without a PC). */
    data class Result(val id: String, val outline: List<Pair<Double, Double>>?, val outlineSrc: String, val place: Placement?, val clearPlace: Boolean,
                      val center: Pair<Double, Double>? = null)

    /** The page's answer; null when it is not one. [outline] null = unchanged, empty = cleared. */
    fun parseResult(json: String): Result? = try {
        val o = JSONObject(json)
        if (o.optString("kind") != "vrg-site-result" || o.optInt("v") != V || o.optBoolean("cancelled")) null
        else {
            val id = o.optString("id").takeIf { SAFE_ID.matches(it) }
            if (id == null) null
            else Result(id,
                if (o.has("outline")) SitePlace.readOutline(o.optJSONArray("outline")) else null,
                o.optString("outlineSrc", "rajz").takeIf { it in SOURCES } ?: "rajz",
                SitePlace.readPlace(o.optJSONObject("place")),
                o.has("place") && o.isNull("place"),
                o.optJSONArray("center")?.let { c -> val la = c.optDouble(0); val lo = c.optDouble(1)
                    if (la.isNaN() || lo.isNaN() || abs(la) > 90 || abs(lo) > 180) null else la to lo })
        }
    } catch (e: Exception) { null }

    private val SAFE_ID = Regex("[A-Za-z0-9_-]{1,64}")
    val SOURCES = setOf("osm", "rajz", "muhold")

    /** The survey with the page's answer applied: the outline (its footprint measured again) and the placement. */
    fun apply(s: Sketch, r: Result, now: Long): Sketch = Intake.setSite(s) { site ->
        var t = site
        r.center?.let { (la, lo) -> t = t.copy(lat = la, lon = lo, source = "terkep") }
        r.outline?.let { o ->
            t = if (o.size >= 3) t.copy(outline = o, footprint = SiteMath.footprint(o, r.outlineSrc, now)) else t.copy(outline = emptyList(), footprint = null)
            if (t.lat == null && o.size >= 3) t = t.copy(lat = o.sumOf { it.first } / o.size, lon = o.sumOf { it.second } / o.size, source = "terkep")
        }
        when {
            r.place != null -> t = t.copy(place = r.place.copy(at = now))
            r.clearPlace -> t = t.copy(place = null)
        }
        t
    }

    /** The result as the page writes it (tests, and the phone's own ⤢ Illesztés). */
    fun resultJson(id: String, outline: List<Pair<Double, Double>>?, src: String, place: Placement?, center: Pair<Double, Double>? = null): JSONObject {
        val o = JSONObject().put("kind", "vrg-site-result").put("v", V).put("id", id).put("outlineSrc", src)
        center?.let { o.put("center", JSONArray().put(it.first).put(it.second)) }
        outline?.let { o.put("outline", SitePlace.outlineJson(it)) }
        o.put("place", place?.let { p -> JSONObject().put("lat", p.lat).put("lon", p.lon).put("rot", p.rot).put("auto", p.auto) } ?: JSONObject.NULL)
        return o
    }
}
