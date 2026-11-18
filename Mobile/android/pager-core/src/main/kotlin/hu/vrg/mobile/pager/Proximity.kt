package hu.vrg.mobile.pager

import kotlin.math.abs
import kotlin.math.pow
import kotlin.math.roundToInt

// Közelség: how near each crew member is, from the beacons' RSSI. The builder's radio model was log-distance path
// loss with the exponent set by clutter (open 2.2, site 2.7, dense 3.2); the phone runs the same formula backwards.
// Phone RSSI jumps ±6 dB from one packet to the next (body, pocket, orientation), so a median over a short window
// goes first and a light EMA after it. The distance is an estimate and the screen says so; zones and the trend
// arrow are what a person actually uses.

enum class Clutter(val exponent: Double, val hu: String) {
    OPEN(2.2, "nyílt terep"),
    SITE(2.7, "építkezés"),
    DENSE(3.2, "sűrű, beton"),
}

enum class Zone(val hu: String, val bars: Int) {
    NEAR("közel", 4),
    MID("közepes", 3),
    FAR("messze", 2),
    EDGE("határon", 1),
    OUT("nincs jel", 0),
}

enum class Trend(val arrow: String, val hu: String) {
    CLOSER("↗", "közeledik"),
    STEADY("→", "áll"),
    AWAY("↘", "távolodik"),
}

class RssiTrack(private val windowMs: Long = 4_000, private val alpha: Double = 0.35) {
    private val samples = ArrayDeque<Pair<Long, Int>>()
    private var ema: Double? = null
    private val history = ArrayDeque<Pair<Long, Double>>()
    var lastAt: Long = 0; private set
    var raw: Int = -127; private set

    fun add(rssi: Int, now: Long) {
        if (rssi >= 0 || rssi < -127) return             // Android reports 127 for "unknown"
        raw = rssi; lastAt = now
        samples.addLast(now to rssi)
        while (samples.size > 1 && now - samples.first().first > windowMs) samples.removeFirst()
        while (samples.size > 15) samples.removeFirst()
        val sorted = samples.map { it.second }.sorted()
        val median = if (sorted.size % 2 == 1) sorted[sorted.size / 2].toDouble()
        else (sorted[sorted.size / 2 - 1] + sorted[sorted.size / 2]) / 2.0
        ema = ema?.let { it + alpha * (median - it) } ?: median
        history.addLast(now to ema!!)
        while (history.size > 1 && now - history.first().first > 6_000) history.removeFirst()
    }

    /** The filtered RSSI, or null before the first sample. */
    val value: Double? get() = ema

    fun age(now: Long): Long = if (lastAt == 0L) Long.MAX_VALUE else now - lastAt

    /** Rising RSSI over the last ~3 s means getting closer. */
    fun trend(now: Long): Trend {
        val cur = ema ?: return Trend.STEADY
        val past = history.firstOrNull { now - it.first <= 3_500 } ?: return Trend.STEADY
        val d = cur - past.second
        return when {
            d >= 3.0 -> Trend.CLOSER
            d <= -3.0 -> Trend.AWAY
            else -> Trend.STEADY
        }
    }
}

object Proximity {
    /** Beacons stop for this long → the person is out of range (or the phone is off). */
    const val LOST_MS = 15_000L
    /** A typical phone's legacy advertisement at high TX power, heard at 1 m. */
    const val DEFAULT_TX1M = -59

    /** d = 10 ^ ((tx@1m − rssi) / (10 n)), metres. */
    fun distance(rssi: Double, tx1m: Int, clutter: Clutter): Double =
        10.0.pow((tx1m - rssi) / (10.0 * clutter.exponent)).coerceIn(0.1, 500.0)

    fun zone(distanceM: Double?, ageMs: Long): Zone = when {
        distanceM == null || ageMs > LOST_MS -> Zone.OUT
        distanceM < 3 -> Zone.NEAR
        distanceM < 12 -> Zone.MID
        distanceM < 35 -> Zone.FAR
        else -> Zone.EDGE
    }

    /** "~4 m", "~25 m", "40+ m": rounded so it never pretends to be a tape measure. */
    fun label(distanceM: Double?): String = when {
        distanceM == null -> "—"
        distanceM < 1.5 -> "~1 m"
        distanceM < 10 -> "~${distanceM.roundToInt()} m"
        distanceM < 40 -> "~${(distanceM / 5).roundToInt() * 5} m"
        else -> "40+ m"
    }

    /** Keresés (the finder): a sonar tick, faster the nearer. Milliseconds between ticks. */
    fun finderInterval(distanceM: Double?): Long =
        if (distanceM == null) 2_500 else (120 + 110 * distanceM).toLong().coerceIn(120, 2_500)

    /**
     * One-metre calibration: the median of the samples taken while the two phones are held 1 m apart. Needs at
     * least eight samples whose middle half agrees within 8 dB; otherwise null (someone walked between them).
     */
    fun calibrate(samples: List<Int>): Int? {
        val s = samples.filter { it in -127..-1 }.sorted()
        if (s.size < 8 || abs(s[s.size * 3 / 4] - s[s.size / 4]) > 8) return null
        return s[s.size / 2]
    }
}
