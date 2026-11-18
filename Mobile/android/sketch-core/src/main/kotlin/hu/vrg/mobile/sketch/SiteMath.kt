package hu.vrg.mobile.sketch

import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

// Helyszín (WP M30): the building on the map against the sketch. The building's outline comes from OpenStreetMap
// (Overpass, asked with the coordinates only, never the address) or VRG Térkép; it is measured as an oriented
// rectangle (the smallest box over all turns), so a house standing at 17° still reads as 12,4 × 9,8 m. The solved
// sketch is measured the same way, and the two are compared: a whole house should match; a flat in a block is
// smaller than its building; a plan BIGGER than its building means a size is wrong.
object SiteMath {
    private const val R = 6371008.8

    /** Metres east / south of ([lat0], [lon0]), y down like the sketch (equirectangular: fine for one building). */
    fun local(lat0: Double, lon0: Double, lat: Double, lon: Double): Pt {
        val x = Math.toRadians(lon - lon0) * R * cos(Math.toRadians(lat0))
        val y = -Math.toRadians(lat - lat0) * R
        return Pt(x, y)
    }

    /** The smallest-area rectangle over the outline: (long side, short side, turn in degrees 0..90, polygon area). */
    data class Box(val w: Double, val d: Double, val angle: Double, val area: Double)

    fun box(p: List<Pt>): Box {
        require(p.size >= 3) { "an outline needs 3 corners" }
        var best: Box? = null
        var a = 0.0
        while (a < 90.0) {
            val r = Math.toRadians(a); val c = cos(r); val s = sin(r)
            var x0 = Double.MAX_VALUE; var x1 = -Double.MAX_VALUE; var y0 = Double.MAX_VALUE; var y1 = -Double.MAX_VALUE
            for (q in p) { val x = q.x * c + q.y * s; val y = -q.x * s + q.y * c; x0 = min(x0, x); x1 = max(x1, x); y0 = min(y0, y); y1 = max(y1, y) }
            val w = x1 - x0; val d = y1 - y0
            if (best == null || w * d < best.w * best.d - 1e-9) best = Box(max(w, d), min(w, d), a, 0.0)
            a += 0.5
        }
        return best!!.copy(area = Geo.area(p))
    }

    fun footprint(outline: List<Pair<Double, Double>>, src: String, at: Long): Footprint {
        val lat0 = outline.sumOf { it.first } / outline.size; val lon0 = outline.sumOf { it.second } / outline.size
        val b = box(outline.map { local(lat0, lon0, it.first, it.second) })
        return Footprint(b.w, b.d, b.area, b.angle, src, at)
    }

    /** How the sketch sits against the building. [verdict]: "egyezik", "kisebb" (inside a bigger building), "nagyobb" (a size is off). */
    data class Comparison(val planW: Double, val planD: Double, val planArea: Double, val fp: Footprint, val dw: Double, val dd: Double, val verdict: String) {
        val text: String get() {
            fun m(v: Double) = "%.1f".format(v).replace('.', ',')
            val head = "Épület ${m(fp.w)} × ${m(fp.d)} m · vázlat ${m(planW)} × ${m(planD)} m"
            return head + " · " + when (verdict) {
                "egyezik" -> "egyezik (±${m(max(abs(dw), abs(dd)) * 100)} %)"
                "kisebb" -> "a vázlat kisebb: lakás egy nagyobb épületben, vagy hiányzik egy rész"
                else -> "a vázlat NAGYOBB az épületnél: valamelyik méret hibás"
            }
        }
    }

    /** Null when the sketch has no solved room yet. [tol] = the relative difference still called a match. */
    fun compare(norm: Norm, fp: Footprint, tol: Double = 0.08): Comparison? {
        val pts = norm.rooms.flatMap { it.poly }
        if (pts.size < 3) return null
        val b = box(pts.map { Pt(it.x / 1000, it.y / 1000) })
        val area = norm.rooms.sumOf { it.area } / 1e6
        val dw = (b.w - fp.w) / fp.w; val dd = (b.d - fp.d) / fp.d
        val verdict = when {
            abs(dw) <= tol && abs(dd) <= tol -> "egyezik"
            b.w > fp.w * (1 + tol) || b.d > fp.d * (1 + tol) -> "nagyobb"
            else -> "kisebb"
        }
        return Comparison(b.w, b.d, area, fp, dw, dd, verdict)
    }
}

/** The two OSM services the phone may ask, only when the user presses the button (D-31). */
object Osm {
    const val NOMINATIM = "https://nominatim.openstreetmap.org/search"
    const val OVERPASS = "https://overpass-api.de/api/interpreter"
    /** A generic client name: no user detail goes to an outside service (OSM asks for an identifying agent). */
    const val AGENT = "VRG-Mobile-Sketcher/1.0"

    fun searchUrl(address: String) = NOMINATIM + "?format=jsonv2&limit=3&countrycodes=hu&q=" + java.net.URLEncoder.encode(address, "UTF-8")

    data class Place(val lat: Double, val lon: Double, val name: String)

    fun parseSearch(json: String): List<Place> = try {
        val a = JSONArray(json)
        (0 until a.length()).mapNotNull { i ->
            val o = a.optJSONObject(i) ?: return@mapNotNull null
            val lat = o.optString("lat").toDoubleOrNull(); val lon = o.optString("lon").toDoubleOrNull()
            if (lat == null || lon == null) null else Place(lat, lon, o.optString("display_name"))
        }
    } catch (e: Exception) { emptyList() }

    /** Buildings within [radius] m of the point, with their outlines. */
    fun buildingsQuery(lat: Double, lon: Double, radius: Int = 40) =
        "[out:json][timeout:15];way(around:$radius,${"%.6f".format(java.util.Locale.ROOT, lat)},${"%.6f".format(java.util.Locale.ROOT, lon)})[\"building\"];out geom;"

    /** The building the point is in, else the nearest one (by its middle) within the query's radius; null when none. */
    fun pickBuilding(json: String, lat: Double, lon: Double): List<Pair<Double, Double>>? = try {
        val els = JSONObject(json).optJSONArray("elements") ?: JSONArray()
        val outlines = (0 until els.length()).mapNotNull { i ->
            val g = els.optJSONObject(i)?.optJSONArray("geometry") ?: return@mapNotNull null
            val pts = (0 until g.length()).mapNotNull { j -> g.optJSONObject(j)?.let { it.optDouble("lat") to it.optDouble("lon") } }
                .let { if (it.size > 1 && it.first() == it.last()) it.dropLast(1) else it }
            if (pts.size >= 3) pts else null
        }
        val here = Pt(0.0, 0.0)
        val local = outlines.map { o -> o to o.map { SiteMath.local(lat, lon, it.first, it.second) } }
        (local.firstOrNull { Geo.inside(here, it.second) } ?: local.minByOrNull { Geo.mean(it.second).dist(here) })?.first
    } catch (e: Exception) { null }

    /** The coordinates out of a VRG Térkép address: its hash is #zoom/lat/lon/bearing/pitch. */
    fun fromMapUrl(url: String): Pair<Double, Double>? {
        val h = url.substringAfter('#', "").split('/')
        if (h.size < 3) return null
        val lat = h[1].toDoubleOrNull(); val lon = h[2].toDoubleOrNull()
        return if (lat == null || lon == null || abs(lat) > 90 || abs(lon) > 180) null else lat to lon
    }

    /** The VRG Térkép page to embed: slim UI, at the coordinates when known, else searching the address. */
    fun mapPath(site: Site?): String {
        val q = site?.address?.takeIf { it.isNotBlank() }?.let { "&q=" + java.net.URLEncoder.encode(it, "UTF-8") } ?: ""
        val hash = if (site?.lat != null && site.lon != null) "#18/${"%.6f".format(java.util.Locale.ROOT, site.lat)}/${"%.6f".format(java.util.Locale.ROOT, site.lon)}/0/50" else ""
        return "/vrg-terkep.html?embed=1" + (if (hash.isEmpty()) q else "") + hash
    }

}
