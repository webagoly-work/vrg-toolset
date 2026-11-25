package hu.vrg.mobile.core

import kotlin.math.PI
import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

// Radar (WP M67, D-173): one display for everything that is "somewhere around": the Tárgykereső's tags and paired
// devices, the Csipogó crew's phones, the Óra, and whatever a later program adds. Any program feeds it through a
// source (kit RadarHub) that gives blips on its own layer; the radar draws them together, each layer in its tone.
//
// Pure Kotlin: the model, the layout, the direction sweep and the geodesy. The same layout is implemented in
// shared/vrg-radar/vrg-radar.js for the Desktop's HTML programs; shared/vrg-radar/fixtures/layout.json holds placements
// both implementations must reproduce (RadarTest here, vrg-radar.test.js there).
//
// The honest part: Bluetooth signal strength gives a distance, never a direction. A blip has a direction only when
//  - it has a place (lat / lon) and the phone knows its own: a GPS bearing;
//  - the user turned round once with "Irány keresése": the body shadows the signal, the strongest heading points to it
//    (BearingSweep), kept as a compass bearing so it stays put while the user turns;
//  - a source knows it some other way.
// Without one it is drawn hollow, on its distance ring, at an angle that only keeps it apart from the others.

/** Tones, mapped to the Mélyvíz palette by the renderers (glow, current, sand, coral, kelp, muted). */
enum class RadarTone { GLOW, CURRENT, SAND, CORAL, KELP, MUTED }

enum class BearingSource(val hu: String) { NONE("irány nélkül"), GPS("GPS"), SWEEP("irány keresése"), SOURCE("a forrás adja") }

enum class RadarMode(val hu: String) { HEADING_UP("Irány fel"), NORTH_UP("Észak fel") }

data class LatLon(val lat: Double, val lon: Double)

/** A layer: one source's kind of thing. [feature] is the catalogue id the blip card opens. */
data class RadarLayer(val id: String, val title: String, val glyph: String, val tone: RadarTone, val feature: String? = null)

/**
 * One thing on the radar. [distanceM] null = unknown (drawn on the outer band). [bearingDeg] is a compass bearing
 * (0 = north, clockwise) when known. [trend] +1 closer, -1 away. [rssi] lets the sweep use it.
 */
data class Blip(
    val id: String,
    val layer: String,
    val label: String,
    val distanceM: Double? = null,
    val bearingDeg: Double? = null,
    val bearingSrc: BearingSource = if (bearingDeg != null) BearingSource.SOURCE else BearingSource.NONE,
    val trend: Int = 0,
    val ageMs: Long = 0,
    val linked: Boolean = false,
    val mine: Boolean = false,
    val alert: Boolean = false,
    val detail: String? = null,
    val place: LatLon? = null,
    val rssi: Int? = null,
)

data class RadarFrame(
    val layers: List<RadarLayer>,
    val blips: List<Blip>,
    /** The phone's compass heading (0 = north), or null when there is no compass reading. */
    val headingDeg: Double? = null,
    val here: LatLon? = null,
    val mode: RadarMode = RadarMode.HEADING_UP,
    /** Fixed range in metres; null = automatic from the blips. */
    val rangeM: Double? = null,
)

/** A blip where it is drawn: unit circle, centre (0,0), x right, y down, radius 1 = the edge. */
data class Placed(
    val blip: Blip,
    val x: Double,
    val y: Double,
    val r: Double,
    /** Screen angle, 0 = up, clockwise. */
    val angleDeg: Double,
    val bearingDeg: Double?,
    val bearingSrc: BearingSource,
    val distanceM: Double?,
    val alpha: Double,
)

data class RadarLayout(val rangeM: Double, val rings: List<Pair<Double, Double>>, val placed: List<Placed>, val rotationDeg: Double)

object Radar {
    /** The radius the farthest blip may reach; beyond the range sits on it. Unknown distances use [UNKNOWN_R]. */
    const val MAX_R = 0.9
    const val UNKNOWN_R = 0.95
    const val MIN_R = 0.04
    /** Blips without a direction are kept this far apart (unit radius). */
    const val MIN_SEP = 0.085
    const val STEP_DEG = 9.0
    private val RANGES = listOf(5.0, 10.0, 30.0, 100.0, 300.0)
    private val RING_STEPS = listOf(1.0, 3.0, 10.0, 30.0, 100.0)

    /** Log scale: near things get room, far ones still fit. */
    fun radius(distanceM: Double?, rangeM: Double): Double {
        if (distanceM == null) return UNKNOWN_R
        val r = 0.86 * ln(1.0 + max(0.0, distanceM)) / ln(1.0 + rangeM)
        return min(MAX_R, max(MIN_R, r))
    }

    /** The smallest standard range that holds the farthest known blip with a little margin. */
    fun autoRange(distances: List<Double>): Double {
        val far = distances.maxOrNull() ?: return 10.0
        return RANGES.firstOrNull { it >= far * 1.15 } ?: RANGES.last()
    }

    /** Ring distances and their radii: the standard steps under the range, and the range itself. */
    fun rings(rangeM: Double): List<Pair<Double, Double>> =
        (RING_STEPS.filter { it < rangeM * 0.95 } + rangeM).map { it to radius(it, rangeM) }

    /** FNV-1a, 32 bit, over UTF-8: the same angle for the same id on every run and in vrg-radar.js. */
    fun fnv1a(s: String): Long {
        var h = 0x811c9dc5L
        for (b in s.toByteArray(Charsets.UTF_8)) {
            h = h xor (b.toLong() and 0xFF)
            h = (h * 16777619L) and 0xffffffffL
        }
        return h
    }

    fun norm(deg: Double): Double { val d = deg % 360.0; return if (d < 0) d + 360.0 else d }

    /** Fades with age: full for 5 s, down to 0.35 at 60 s, then stays. */
    fun alpha(ageMs: Long): Double = when {
        ageMs <= 5_000 -> 1.0
        ageMs >= 60_000 -> 0.35
        else -> 1.0 - 0.65 * (ageMs - 5_000) / 55_000.0
    }

    /**
     * Places the visible blips. [sweeps] holds compass bearings found by "Irány keresése" (blip id → bearing), used when
     * the blip has none of its own. Deterministic: blips with a direction first, then the rest, each group by id.
     */
    fun layout(frame: RadarFrame, hidden: Set<String> = emptySet(), sweeps: Map<String, Double> = emptyMap()): RadarLayout {
        val here = frame.here
        data class Pre(val b: Blip, val dist: Double?, val bearing: Double?, val src: BearingSource)
        val pre = frame.blips.filter { it.layer !in hidden }.map { b ->
            var dist = b.distanceM
            var bearing = b.bearingDeg?.let { norm(it) }
            var src = if (bearing != null) b.bearingSrc.takeIf { it != BearingSource.NONE } ?: BearingSource.SOURCE else BearingSource.NONE
            if (b.place != null && here != null) {
                if (bearing == null) { bearing = Geo.bearing(here, b.place); src = BearingSource.GPS }
                if (dist == null) dist = Geo.distance(here, b.place)
            }
            if (bearing == null) sweeps[b.id]?.let { bearing = norm(it); src = BearingSource.SWEEP }
            Pre(b, dist, bearing, src)
        }
        // the range follows the nearby things (no place); a far place sits on the edge at its true bearing
        val near = pre.filter { it.dist != null && it.b.place == null }.ifEmpty { pre.filter { it.dist != null } }
        val range = frame.rangeM ?: autoRange(near.mapNotNull { it.dist })
        val rot = if (frame.mode == RadarMode.HEADING_UP && frame.headingDeg != null) norm(frame.headingDeg) else 0.0
        val placed = ArrayList<Placed>()
        fun at(p: Pre, angle: Double, r: Double) = Placed(p.b, r * sin(angle * PI / 180), -r * cos(angle * PI / 180), r,
            angle, p.bearing, p.src, p.dist, alpha(p.b.ageMs))
        for (p in pre.filter { it.bearing != null }.sortedBy { it.b.id }) {
            placed += at(p, norm(p.bearing!! - rot), radius(p.dist, range))
        }
        for (p in pre.filter { it.bearing == null }.sortedBy { it.b.id }) {
            val r = radius(p.dist, range)
            val start = (fnv1a(p.b.id) % 3600L) / 10.0
            var chosen = start
            for (k in 0 until 40) {
                val a = norm(start + k * STEP_DEG)
                val x = r * sin(a * PI / 180); val y = -r * cos(a * PI / 180)
                if (placed.all { q -> (q.x - x) * (q.x - x) + (q.y - y) * (q.y - y) >= MIN_SEP * MIN_SEP }) { chosen = a; break }
            }
            placed += at(p, chosen, r)
        }
        return RadarLayout(range, rings(range), placed, rot)
    }

    /** The nearest placed blip to a tap (unit coordinates), within [maxDist]. */
    fun hit(layout: RadarLayout, x: Double, y: Double, maxDist: Double = 0.08): Placed? =
        layout.placed.minByOrNull { (it.x - x) * (it.x - x) + (it.y - y) * (it.y - y) }
            ?.takeIf { (it.x - x) * (it.x - x) + (it.y - y) * (it.y - y) <= maxDist * maxDist }
}

/** Great-circle helpers for GPS bearings. */
object Geo {
    private const val R = 6_371_008.8

    private fun rad(d: Double) = d * PI / 180

    /** Initial bearing from [a] to [b], degrees clockwise from north. */
    fun bearing(a: LatLon, b: LatLon): Double {
        val p1 = rad(a.lat); val p2 = rad(b.lat); val dl = rad(b.lon - a.lon)
        val y = sin(dl) * cos(p2)
        val x = cos(p1) * sin(p2) - sin(p1) * cos(p2) * cos(dl)
        return Radar.norm(atan2(y, x) * 180 / PI)
    }

    /** Haversine distance in metres. */
    fun distance(a: LatLon, b: LatLon): Double {
        val dp = rad(b.lat - a.lat); val dl = rad(b.lon - a.lon)
        val h = sin(dp / 2) * sin(dp / 2) + cos(rad(a.lat)) * cos(rad(b.lat)) * sin(dl / 2) * sin(dl / 2)
        return 2 * R * asin(min(1.0, sqrt(h)))
    }
}

/**
 * Irány keresése: the user holds the phone in front and turns round slowly; the body shadows the signal behind them, so
 * the heading where the filtered RSSI is strongest points to the device. Samples (compass heading, RSSI) go into 24
 * sectors of 15°; once 60 % of them are filled, the bearing is the weighted circular mean of the sectors within 3 dB of
 * the strongest. The confidence grows with the contrast (strongest − weakest, 4 dB = 0, 14 dB = full) and the coverage.
 */
class BearingSweep(val sectors: Int = 24) {
    private val samples = Array(sectors) { ArrayList<Int>() }

    data class Result(val bearingDeg: Double, val confidence: Double, val contrastDb: Double, val coverage: Double)

    fun add(headingDeg: Double, rssi: Int) {
        if (rssi >= 0 || rssi < -127) return
        val s = (floor(Radar.norm(headingDeg) / (360.0 / sectors)).toInt()).coerceIn(0, sectors - 1)
        val l = samples[s]
        l += rssi
        if (l.size > 12) l.removeAt(0)
    }

    val coverage: Double get() = samples.count { it.isNotEmpty() }.toDouble() / sectors

    private fun median(l: List<Int>): Double {
        val s = l.sorted()
        return if (s.size % 2 == 1) s[s.size / 2].toDouble() else (s[s.size / 2 - 1] + s[s.size / 2]) / 2.0
    }

    /** Null until 60 % of the circle has been covered. */
    fun result(): Result? {
        if (coverage < 0.6) return null
        val med = samples.mapIndexedNotNull { i, l -> if (l.isEmpty()) null else i to median(l) }
        val top = med.maxOf { it.second }
        val low = med.minOf { it.second }
        var sx = 0.0; var sy = 0.0
        for ((i, m) in med) if (m >= top - 3.0) {
            val w = m - (top - 3.0) + 1.0
            val a = (i + 0.5) * (360.0 / sectors) * PI / 180
            sx += w * sin(a); sy += w * cos(a)
        }
        val bearing = Radar.norm(atan2(sx, sy) * 180 / PI)
        val contrast = top - low
        val conf = ((contrast - 4.0) / 10.0).coerceIn(0.0, 1.0) * min(1.0, coverage / 0.75)
        return Result(bearing, conf, contrast, coverage)
    }

    fun clear() = samples.forEach { it.clear() }
}

object RadarText {
    private val REL = listOf("elöl", "jobbra elöl", "jobbra", "jobbra hátul", "hátul", "balra hátul", "balra", "balra elöl")
    private val COMPASS = listOf("É", "ÉK", "K", "DK", "D", "DNy", "Ny", "ÉNy")

    private fun octant(deg: Double): Int = (floor((Radar.norm(deg) + 22.5) / 45.0).toInt()) % 8

    /** Where to look, relative to the way the phone faces ("jobbra elöl"). */
    fun relative(screenAngleDeg: Double): String = REL[octant(screenAngleDeg)]

    /** A compass point ("ÉK"). */
    fun compass(bearingDeg: Double): String = COMPASS[octant(bearingDeg)]

    /** "~4 m", "~25 m", "40+ m", "1,2 km"; "távolság ismeretlen" for null. */
    fun distance(m: Double?): String = when {
        m == null -> "távolság ismeretlen"
        m < 1.5 -> "~1 m"
        m < 10 -> "~${m.toInt()} m"
        m < 40 -> "~${(m / 5).toInt() * 5} m"
        m < 1000 -> "~${(m / 10).toInt() * 10} m"
        else -> String.format(java.util.Locale.ROOT, "%.1f km", m / 1000).replace('.', ',')
    }

    fun ring(m: Double): String = if (m >= 1000) "${(m / 1000).toInt()} km" else "${m.toInt()} m"

    /** Hint for a turning user from a sweep in progress. */
    fun sweepHint(coverage: Double, result: BearingSweep.Result?): String = when {
        result == null -> "Fordulj lassan körbe a telefonnal magad előtt: ${(coverage * 100).toInt()}% kész."
        result.confidence < 0.15 -> "Nem egyértelmű (${result.contrastDb.toInt()} dB különbség). Fordulj még egyszer, lassabban, nyílt helyen."
        else -> "Irány: ${compass(result.bearingDeg)} (${result.bearingDeg.toInt()}°), biztosság ${(result.confidence * 100).toInt()}%."
    }
}
