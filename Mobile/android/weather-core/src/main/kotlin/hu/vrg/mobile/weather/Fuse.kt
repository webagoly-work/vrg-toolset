package hu.vrg.mobile.weather

import java.time.Instant
import java.time.temporal.ChronoUnit
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

// The consensus, ported from Weather/lib/fuse.js. The phone has no verification (no measurements, no skill table), so
// every member keeps its prior weight and continuous values are always the weighted median: the PC's rule until a member
// has 30 verified pairs.

/** One fused hour: value, spread and confidence per variable, and each member's own value. */
data class Hour(
    val valid: Instant,
    val value: Map<String, Double>,
    val spread: Map<String, Double?>,
    val conf: Map<String, String?>,
    val members: Map<String, Map<String, Double>>,
) {
    operator fun get(v: String): Double? = value[v]
}

object Fuse {
    data class P(val member: String, val v: Double, val w: Double, val derived: Boolean = false)

    fun wmedian(pairs: List<P>): Double? {
        val s = pairs.filter { it.w > 0 }.sortedBy { it.v }
        val tot = s.sumOf { it.w }
        var c = 0.0
        for (i in s.indices) {
            c += s[i].w
            if (c > tot / 2 + 1e-9) return s[i].v
            if (abs(c - tot / 2) < 1e-9 && i + 1 < s.size) return (s[i].v + s[i + 1].v) / 2
        }
        return s.lastOrNull()?.v
    }

    fun wmean(pairs: List<P>): Double? { val t = pairs.sumOf { it.w }; return if (t > 0) pairs.sumOf { it.w * it.v } / t else null }

    fun wstd(pairs: List<P>, m: Double?): Double? {
        if (pairs.size < 2 || m == null) return null
        val t = pairs.sumOf { it.w }
        return sqrt(pairs.sumOf { it.w * (it.v - m) * (it.v - m) } / t)
    }

    fun vecmean(pairs: List<P>): Double {
        var x = 0.0; var y = 0.0
        for (p in pairs) { x += p.w * sin(Math.toRadians(p.v)); y += p.w * cos(Math.toRadians(p.v)) }
        return (Math.toDegrees(atan2(x, y)) + 360) % 360
    }

    /** The most severe code that at least two members reach, so one model's thunderstorm stays "possible". */
    fun fuseCode(pairs: List<P>): Pair<Double, Double?> {
        if (pairs.size == 1) return pairs[0].v to null
        val sev = { p: P -> Vars.wmoSev(p.v.toInt()) }
        val sorted = pairs.sortedByDescending(sev)
        for (p in sorted) {
            val reach = pairs.count { sev(it) >= sev(p) }
            if (reach >= 2) return p.v to 1 - pairs.count { it.v == p.v }.toDouble() / pairs.size
        }
        return sorted.last().v to 1.0
    }

    fun confidence(v: String, spread: Double?, n: Int, tol: Map<String, Double>): String? {
        if (n <= 1) return "egy"
        if (spread == null) return "magas"
        if (Vars.ALL[v]?.kind == Kind.CODE) return if (spread <= 0.34) "magas" else if (spread <= 0.67) "közepes" else "alacsony"
        val t = tol[v] ?: return null
        val r = spread / t
        return if (r < 0.5) "magas" else if (r < 1) "közepes" else "alacsony"
    }

    /**
     * Fuse the latest issue of every member. An issue older than 36 hours does not count. Hours from 6 h ago to the
     * horizon are kept, sorted.
     */
    fun fuse(issues: List<Issue>, prior: Map<String, Double>, settings: Settings = Config.settings, now: Instant = Instant.now()): List<Hour> {
        val stale = now.minus(36, ChronoUnit.HOURS)
        val from = Time.hourFloor(now).minus(6, ChronoUnit.HOURS)
        val to = Time.hourFloor(now).plus(settings.horizonHours.toLong(), ChronoUnit.HOURS)
        val g = sortedMapOf<Instant, MutableMap<String, MutableList<P>>>()
        for (iss in issues) {
            if (iss.issued < stale) continue
            for (r in iss.rows) {
                if (Vars.ALL[r.v] == null || r.valid < from || r.valid > to) continue
                g.getOrPut(r.valid) { linkedMapOf() }.getOrPut(r.v) { ArrayList() } += P(r.member, r.value, prior[r.source] ?: 1.0)
            }
        }
        val out = ArrayList<Hour>()
        for ((valid, byVar) in g) {
            // precipitation probability: a member with only an amount votes 100 / 0
            val pops = byVar["pop"] ?: ArrayList()
            val have = pops.map { it.member }.toSet()
            for (p in byVar["precip"].orEmpty()) if (p.member !in have) pops += P(p.member, if (p.v >= 0.1) 100.0 else 0.0, p.w, derived = true)
            if (pops.isNotEmpty()) byVar["pop"] = pops
            val value = linkedMapOf<String, Double>(); val spread = linkedMapOf<String, Double?>()
            val conf = linkedMapOf<String, String?>(); val members = linkedMapOf<String, Map<String, Double>>()
            for ((v, pairs) in byVar) {
                val kind = Vars.ALL.getValue(v).kind
                val (x, s) = when (kind) {
                    Kind.CODE -> fuseCode(pairs)
                    Kind.DIR -> vecmean(pairs) to null
                    Kind.PROB -> wmean(pairs).let { it to wstd(pairs, it) }
                    else -> wmedian(pairs) to wstd(pairs, wmean(pairs))
                }
                if (x == null) continue
                value[v] = x; spread[v] = s
                conf[v] = confidence(v, s, pairs.size, settings.tolerance)
                members[v] = pairs.filter { !it.derived }.associate { it.member to Math.round(it.v * 100) / 100.0 }
            }
            out += Hour(valid, value, spread, conf, members)
        }
        return out
    }
}
