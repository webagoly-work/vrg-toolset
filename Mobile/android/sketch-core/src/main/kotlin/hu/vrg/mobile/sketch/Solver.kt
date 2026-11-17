package hu.vrg.mobile.sketch

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.roundToLong

// Rendezés: a disproportionate sketch plus some of its sizes → a plan in millimetres.
//
// THE IDEA. A flat is (nearly always) square. Every room corner's x lies on one of a few vertical WALL LINES and
// every y on one of a few horizontal ones; rooms drawn next to each other share them. So the corners' x values
// are clustered into lines X0 < X1 < … and the y values into Y0 < Y1 < …, and the unknowns are the real GAPS
// between neighbouring lines, per axis. A measured size is a linear equation on them: a wall from line 2 to line 5
// is g2 + g3 + g4 = 3600 mm; a room's width is the span of its lines. Two rooms side by side with the total and
// one room measured give the other room's width exactly, without anyone measuring it.
//
// THE SOLVE, per axis, is a small weighted least squares:
//   · every measure: (Σ g − mm)² weighted heavily (relative to its size), so consistent measures hold exactly;
//   · every gap: a weak pull towards the sketch's own proportions, k · sketch gap (k = mm per sketch unit, the
//     median of what the measures say), weighted by 1 / gap, which spreads any slack PROPORTIONALLY.
// The weak prior only decides what the measures leave open.
//
// WHAT WAS GUESSED. A gap is DETERMINED when it is a linear combination of the measures (its unit vector lies in the
// measure matrix's row space; checked by reducing it against the matrix's echelon form). An edge is
// MEASURED (someone measured exactly that span), DERIVED (determined by other measures) or INFERRED (it took the
// sketch's proportions). A room with an inferred edge is an inferred area; the Planner draws both with a mark.
//
// A slanted wall's own measure is not used (it would make the problem non-linear): it is reported, and the wall
// takes its ends from the lines its corners are on. Measures that contradict each other are reported too.

enum class SizeStatus(val id: String, val label: String) {
    MEASURED("mert", "mért"),
    DERIVED("szamolt", "számolt"),
    INFERRED("becsult", "becsült"),
}

data class NRoom(
    val id: String, val name: String, val kinds: List<String>,
    /** The outline in mm, corners on the solved wall lines, consecutive duplicates dropped. */
    val poly: List<Pt>,
    /** One status per edge of [poly]. */
    val edges: List<SizeStatus>,
) {
    val inferred get() = SizeStatus.INFERRED in edges
    val area get() = Geo.area(poly)
}

/** [inward] is the wall's inward normal when the point sits on a wall. */
data class NPoint(val id: String, val at: Pt, val type: PointType, val state: PointState, val room: String?, val inward: Pt?)
data class NRoute(val id: String, val pts: List<Pt>, val a: String?, val b: String?, val circuit: String?)
data class NMemo(val id: String, val at: Pt, val text: String, val target: String?)
data class NTag(val id: String, val tag: String, val at: Pt)

data class Conflict(val measure: String, val mm: Int, val solved: Int)

data class Report(
    val measured: Int, val derived: Int, val inferred: Int,
    val conflicts: List<Conflict>, val warnings: List<String>,
    /** mm per sketch unit on x and y (what the measures say, or the default). */
    val scaleX: Double, val scaleY: Double,
) {
    val edges get() = measured + derived + inferred
}

data class Norm(
    val rooms: List<NRoom>, val points: List<NPoint>, val routes: List<NRoute>,
    val memos: List<NMemo>, val tags: List<NTag>, val report: Report,
) {
    fun room(id: String?) = rooms.firstOrNull { it.id == id }
    fun point(id: String?) = points.firstOrNull { it.id == id }
    val all: List<Pt> get() = rooms.flatMap { it.poly } + points.map { it.at } + routes.flatMap { it.pts } + memos.map { it.at }
}

class Solver(
    /** Corners closer than this on an axis are one wall line (sketch units: about a fingertip). */
    val clusterTol: Double = 10.0,
    /** mm per sketch unit when there is no measure at all (a room drawn ~150 dp wide reads as ~3.75 m). */
    val defaultScale: Double = 25.0,
) {
    private class Con(val lo: Int, val hi: Int, val mm: Int, val id: String, val room: String)

    /** One axis: its wall lines, the measures on it, the solved gaps. */
    private class Axis(values: List<Double>, tol: Double) {
        val lines: DoubleArray
        var gaps = DoubleArray(0)
        var real = DoubleArray(0)
        var determined = BooleanArray(0)
        var scale = 0.0
        val cons = mutableListOf<Con>()
        private var echelon: List<DoubleArray> = emptyList()

        init {
            val v = values.sorted()
            val out = mutableListOf<Double>()
            var start = 0
            for (i in v.indices) {
                val first = i == v.size - 1 || v[i + 1] - v[i] > tol || v[i + 1] - v[start] > 2 * tol
                if (first) { out += v.subList(start, i + 1).average(); start = i + 1 }
            }
            lines = out.toDoubleArray()
        }

        val n get() = lines.size
        fun idx(v: Double): Int {
            var best = 0; var bd = Double.MAX_VALUE
            for (i in lines.indices) { val d = abs(lines[i] - v); if (d < bd) { bd = d; best = i } }
            return best
        }

        fun span(i: Int) = if (i + 1 < n) lines[i + 1] - lines[i] else 0.0

        fun solve(k: Double) {
            scale = k
            val m = n - 1
            if (m <= 0) { gaps = DoubleArray(0); real = DoubleArray(n) { 0.0 }; determined = BooleanArray(0); return }
            val a = Array(m) { DoubleArray(m) }
            val b = DoubleArray(m)
            for (c in cons) {
                val w = 1e4 / max(c.mm, 1)
                for (i in c.lo until c.hi) { b[i] += w * c.mm; for (j in c.lo until c.hi) a[i][j] += w }
            }
            for (i in 0 until m) {
                val prior = k * span(i)
                val w = 1.0 / max(prior, 1.0)
                a[i][i] += w; b[i] += w * prior
            }
            val g = gauss(a, b)
            echelon = rref(cons.map { c -> DoubleArray(m) { i -> if (i >= c.lo && i < c.hi) 1.0 else 0.0 } })
            determined = BooleanArray(m) { i -> inRowSpace(DoubleArray(m) { if (it == i) 1.0 else 0.0 }) }
            // the line POSITIONS are rounded to the mm, not the gaps: a measured span then holds to the mm
            // however many guessed gaps lie inside it
            var acc = 0.0
            real = DoubleArray(n)
            for (i in 1 until n) { acc += max(g[i - 1], 1.0); real[i] = acc.roundToLong().toDouble() }
            gaps = DoubleArray(m) { i -> real[i + 1] - real[i] }
        }

        /** The sum of gaps lo until hi before rounding was checked against each measure here. */
        fun spanMm(lo: Int, hi: Int) = real[hi] - real[lo]

        /** MEASURED only when this room's own measure is exactly the span; another room's is DERIVED here. */
        fun status(lo: Int, hi: Int, room: String): SizeStatus {
            val (a, b) = if (lo <= hi) lo to hi else hi to lo
            if (a == b) return SizeStatus.DERIVED
            if (cons.any { it.lo == a && it.hi == b && it.room == room }) return SizeStatus.MEASURED
            val v = DoubleArray(n - 1) { if (it >= a && it < b) 1.0 else 0.0 }
            return if (inRowSpace(v)) SizeStatus.DERIVED else SizeStatus.INFERRED
        }

        fun determinedSpan(lo: Int, hi: Int): Boolean {
            val (a, b) = if (lo <= hi) lo to hi else hi to lo
            if (a == b) return true
            return inRowSpace(DoubleArray(n - 1) { if (it >= a && it < b) 1.0 else 0.0 })
        }

        /** Any sketch coordinate → mm: linear between the two lines around it, the axis scale beyond the ends. */
        fun map(v: Double): Double {
            if (n == 0) return v * scale
            if (v <= lines[0]) return real[0] - (lines[0] - v) * scale
            if (v >= lines[n - 1]) return real[n - 1] + (v - lines[n - 1]) * scale
            var i = 0
            while (i < n - 2 && v > lines[i + 1]) i++
            val s = span(i)
            return if (s <= 0) real[i] else real[i] + (v - lines[i]) / s * gaps[i]
        }

        private fun inRowSpace(v0: DoubleArray): Boolean {
            val v = v0.copyOf()
            for (row in echelon) {
                val p = row.indexOfFirst { abs(it) > 1e-9 }
                if (p < 0) continue
                val f = v[p]
                if (f != 0.0) for (j in v.indices) v[j] -= f * row[j]
            }
            return v.all { abs(it) < 1e-6 }
        }
    }

    fun solve(s: Sketch): Norm {
        val warnings = mutableListOf<String>()
        val verts = s.rooms.flatMap { it.poly }
        val ax = Axis(verts.map { it.x }, clusterTol)
        val ay = Axis(verts.map { it.y }, clusterTol)

        // ---- the measures as equations ----
        val usable = mutableListOf<Pair<Measure, Double>>()      // measure + its sketch span, for the scale
        for (m in s.measures) {
            val r = s.room(m.room) ?: continue
            if (m.mm <= 0) continue
            when (m.kind) {
                MeasureKind.WIDTH -> addCon(ax, ax.idx(r.poly.minOf { it.x }), ax.idx(r.poly.maxOf { it.x }), m, usable, warnings, r)
                MeasureKind.DEPTH -> addCon(ay, ay.idx(r.poly.minOf { it.y }), ay.idx(r.poly.maxOf { it.y }), m, usable, warnings, r)
                MeasureKind.EDGE -> {
                    if (m.edge !in r.poly.indices) continue
                    val (a, b) = Geo.edge(r.poly, m.edge)
                    val xa = ax.idx(a.x); val xb = ax.idx(b.x); val ya = ay.idx(a.y); val yb = ay.idx(b.y)
                    when {
                        ya == yb && xa != xb -> addCon(ax, xa, xb, m, usable, warnings, r)
                        xa == xb && ya != yb -> addCon(ay, ya, yb, m, usable, warnings, r)
                        xa != xb -> warnings += "${roomName(r)}: a ferde fal mérete (${m.mm} mm) csak jegyzet, a számításba nem kerül."
                        else -> warnings += "${roomName(r)}: a mért fal a vázlaton nulla hosszú."
                    }
                }
            }
        }

        // ---- the scale: what the measures say, per axis where possible ----
        fun median(v: List<Double>) = v.sorted().let { if (it.isEmpty()) null else if (it.size % 2 == 1) it[it.size / 2] else (it[it.size / 2 - 1] + it[it.size / 2]) / 2 }
        val rx = ax.cons.mapNotNull { c -> (ax.lines[c.hi] - ax.lines[c.lo]).takeIf { it > 0 }?.let { c.mm / it } }
        val ry = ay.cons.mapNotNull { c -> (ay.lines[c.hi] - ay.lines[c.lo]).takeIf { it > 0 }?.let { c.mm / it } }
        val all = median(rx + ry) ?: defaultScale
        if (s.measures.isEmpty() && s.rooms.isNotEmpty()) warnings += "Nincs méret: minden méret becsült (${defaultScale.toInt()} mm / egység)."
        ax.solve(median(rx) ?: all)
        ay.solve(median(ry) ?: all)

        val conflicts = (ax.cons.map { ax to it } + ay.cons.map { ay to it }).mapNotNull { (a, c) ->
            val got = a.spanMm(c.lo, c.hi)
            if (abs(got - c.mm) > max(10.0, c.mm * 0.005)) Conflict(c.id, c.mm, got.roundToLong().toInt()) else null
        }

        // ---- rooms ----
        var mea = 0; var der = 0; var inf = 0
        val rooms = s.rooms.map { r ->
            val idx = r.poly.map { ax.idx(it.x) to ay.idx(it.y) }
            val clean = idx.filterIndexed { i, v -> v != idx[(i + idx.size - 1) % idx.size] }.ifEmpty { idx.take(1) }
            val edgeMeasured = s.measures.filter { it.room == r.id && it.kind == MeasureKind.EDGE }.map { it.edge }.toSet()
            val poly = clean.map { (i, j) -> Pt(ax.real[i], ay.real[j]) }
            val edges = clean.indices.map { k ->
                val (x0, y0) = clean[k]; val (x1, y1) = clean[(k + 1) % clean.size]
                when {
                    y0 == y1 -> ax.status(x0, x1, r.id)
                    x0 == x1 -> ay.status(y0, y1, r.id)
                    ax.determinedSpan(x0, x1) && ay.determinedSpan(y0, y1) -> SizeStatus.DERIVED
                    else -> SizeStatus.INFERRED
                }
            }.toMutableList()
            // a slanted wall someone measured on site is still "measured" for the mark, though the solve ignores it
            r.poly.indices.filter { it in edgeMeasured }.forEach { k ->
                val a = idx[k]; val b = idx[(k + 1) % idx.size]
                val ck = clean.indexOf(a)
                if (ck >= 0 && clean[(ck + 1) % clean.size] == b && a.first != b.first && a.second != b.second) edges[ck] = SizeStatus.MEASURED
            }
            edges.forEach { when (it) { SizeStatus.MEASURED -> mea++; SizeStatus.DERIVED -> der++; SizeStatus.INFERRED -> inf++ } }
            NRoom(r.id, r.name, r.kinds, if (poly.size >= 3) poly else emptyList(), if (poly.size >= 3) edges else emptyList())
        }

        fun map(p: Pt) = Pt(ax.map(p.x), ay.map(p.y))
        fun vert(r: Room, k: Int) = r.poly[k].let { Pt(ax.real[ax.idx(it.x)], ay.real[ay.idx(it.y)]) }

        // ---- points: on a wall they stay on it; in the open they move with the lines around them ----
        val points = s.points.map { p ->
            val r = s.room(p.room)
            if (r != null && p.edge != null && p.t != null && p.edge in r.poly.indices) {
                val a = vert(r, p.edge); val b = vert(r, (p.edge + 1) % r.poly.size)
                val mmPoly = r.poly.indices.map { vert(r, it) }
                val n = if (a.dist(b) > 0) Geo.inward(mmPoly, p.edge) else null
                NPoint(p.id, Geo.lerp(a, b, p.t), p.type, p.state, p.room, n)
            } else NPoint(p.id, map(p.at), p.type, p.state, p.room, null)
        }
        val routes = s.routes.map { r ->
            var pts = r.pts.map(::map)
            points.firstOrNull { it.id == r.a }?.let { pts = listOf(it.at) + pts.drop(1) }
            points.firstOrNull { it.id == r.b }?.let { pts = pts.dropLast(1) + it.at }
            NRoute(r.id, pts, r.a, r.b, r.circuit)
        }
        val memos = s.memos.map { NMemo(it.id, map(it.at), it.text, it.target) }
        val tags = s.tagUses.filter { it.at != null }.map { NTag(it.id, it.tag, map(it.at!!)) }

        return Norm(rooms, points, routes, memos, tags, Report(mea, der, inf, conflicts, warnings, ax.scale, ay.scale))
    }

    private fun roomName(r: Room) = r.name.ifEmpty { RoomKinds.autoName(r.kinds).ifEmpty { r.id } }

    private fun addCon(a: Axis, i: Int, j: Int, m: Measure, usable: MutableList<Pair<Measure, Double>>, warnings: MutableList<String>, r: Room) {
        if (i == j) { warnings += "${roomName(r)}: a ${m.kind.label.lowercase()} a vázlaton nulla hosszú, kimarad."; return }
        val lo = minOf(i, j); val hi = maxOf(i, j)
        a.cons += Con(lo, hi, m.mm, m.id, r.id)
        usable += m to (a.lines[hi] - a.lines[lo])
    }

    companion object {
        /** Gaussian elimination with partial pivoting; the system is symmetric positive definite (the priors). */
        internal fun gauss(a0: Array<DoubleArray>, b0: DoubleArray): DoubleArray {
            val n = b0.size
            val a = Array(n) { a0[it].copyOf() }; val b = b0.copyOf()
            for (c in 0 until n) {
                var p = c
                for (r in c + 1 until n) if (abs(a[r][c]) > abs(a[p][c])) p = r
                if (abs(a[p][c]) < 1e-12) continue
                if (p != c) { val t = a[p]; a[p] = a[c]; a[c] = t; val tb = b[p]; b[p] = b[c]; b[c] = tb }
                for (r in c + 1 until n) {
                    val f = a[r][c] / a[c][c]
                    if (f == 0.0) continue
                    for (k in c until n) a[r][k] -= f * a[c][k]
                    b[r] -= f * b[c]
                }
            }
            val x = DoubleArray(n)
            for (r in n - 1 downTo 0) {
                var v = b[r]
                for (k in r + 1 until n) v -= a[r][k] * x[k]
                x[r] = if (abs(a[r][r]) < 1e-12) 0.0 else v / a[r][r]
            }
            return x
        }

        /** Reduced row echelon form; zero rows dropped. */
        internal fun rref(rows: List<DoubleArray>): List<DoubleArray> {
            if (rows.isEmpty()) return emptyList()
            val m = rows.map { it.copyOf() }.toMutableList()
            val cols = m[0].size
            var lead = 0
            val out = mutableListOf<DoubleArray>()
            for (c in 0 until cols) {
                var p = -1
                for (r in lead until m.size) if (abs(m[r][c]) > 1e-9) { p = r; break }
                if (p < 0) continue
                val t = m[p]; m[p] = m[lead]; m[lead] = t
                val piv = m[lead][c]
                for (k in 0 until cols) m[lead][k] /= piv
                for (r in m.indices) if (r != lead && abs(m[r][c]) > 1e-12) {
                    val f = m[r][c]
                    for (k in 0 until cols) m[r][k] -= f * m[lead][k]
                }
                lead++
                if (lead == m.size) break
            }
            for (r in 0 until lead) out += m[r]
            return out
        }
    }
}
