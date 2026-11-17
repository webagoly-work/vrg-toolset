package hu.vrg.mobile.sketch

import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.hypot

/** Plane geometry for the sketch. Everything is in whatever unit the points are in (sketch units or mm). */
object Geo {
    fun rect(a: Pt, b: Pt): List<Pt> {
        val x0 = minOf(a.x, b.x); val x1 = maxOf(a.x, b.x)
        val y0 = minOf(a.y, b.y); val y1 = maxOf(a.y, b.y)
        return listOf(Pt(x0, y0), Pt(x1, y0), Pt(x1, y1), Pt(x0, y1))
    }

    fun mean(ps: List<Pt>) = Pt(ps.sumOf { it.x } / ps.size, ps.sumOf { it.y } / ps.size)

    /** Signed area (shoelace); positive = clockwise on a y-down screen. */
    fun signedArea(p: List<Pt>): Double {
        var s = 0.0
        for (i in p.indices) { val a = p[i]; val b = p[(i + 1) % p.size]; s += a.x * b.y - b.x * a.y }
        return s / 2
    }

    fun area(p: List<Pt>) = abs(signedArea(p))

    fun perimeter(p: List<Pt>, closed: Boolean = true): Double {
        var s = 0.0
        val n = if (closed) p.size else p.size - 1
        for (i in 0 until n) s += p[i].dist(p[(i + 1) % p.size])
        return s
    }

    fun centroid(p: List<Pt>): Pt {
        val a = signedArea(p)
        if (abs(a) < 1e-9) return mean(p)
        var cx = 0.0; var cy = 0.0
        for (i in p.indices) {
            val q = p[i]; val r = p[(i + 1) % p.size]
            val f = q.x * r.y - r.x * q.y
            cx += (q.x + r.x) * f; cy += (q.y + r.y) * f
        }
        return Pt(cx / (6 * a), cy / (6 * a))
    }

    fun bbox(p: List<Pt>): Pair<Pt, Pt> =
        Pt(p.minOf { it.x }, p.minOf { it.y }) to Pt(p.maxOf { it.x }, p.maxOf { it.y })

    fun inside(p: Pt, poly: List<Pt>): Boolean {
        var c = false
        var j = poly.size - 1
        for (i in poly.indices) {
            val a = poly[i]; val b = poly[j]
            if ((a.y > p.y) != (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c
            j = i
        }
        return c
    }

    /** The foot of [p] on segment a–b: the point, its parameter t in 0..1 and the distance. */
    data class Foot(val q: Pt, val t: Double, val d: Double)

    fun foot(p: Pt, a: Pt, b: Pt): Foot {
        val dx = b.x - a.x; val dy = b.y - a.y; val l2 = dx * dx + dy * dy
        if (l2 == 0.0) return Foot(a, 0.0, p.dist(a))
        val t = (((p.x - a.x) * dx + (p.y - a.y) * dy) / l2).coerceIn(0.0, 1.0)
        val q = Pt(a.x + dx * t, a.y + dy * t)
        return Foot(q, t, p.dist(q))
    }

    fun lerp(a: Pt, b: Pt, t: Double) = Pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)

    fun edge(poly: List<Pt>, k: Int): Pair<Pt, Pt> = poly[k] to poly[(k + 1) % poly.size]

    /** The edge's unit normal pointing into the room. */
    fun inward(poly: List<Pt>, k: Int): Pt {
        val (a, b) = edge(poly, k)
        val l = hypot(b.x - a.x, b.y - a.y).takeIf { it > 0 } ?: return Pt(0.0, 0.0)
        val n = Pt(-(b.y - a.y) / l, (b.x - a.x) / l)          // left of a→b on a y-down screen
        return if (signedArea(poly) > 0) n else n * -1.0      // clockwise poly: left is inside
    }

    /** 0 = horizontal, 1 = vertical, -1 = slanted (more than [tolDeg] off both axes). */
    fun axisOf(a: Pt, b: Pt, tolDeg: Double = 8.0): Int {
        val ang = Math.toDegrees(atan2(abs(b.y - a.y), abs(b.x - a.x)))
        return when {
            ang <= tolDeg -> 0
            ang >= 90 - tolDeg -> 1
            else -> -1
        }
    }

    /**
     * A field lineout is nearly always square: a segment within [tolDeg] of an axis is laid onto it. Returns the
     * end point to use for the segment from [prev] towards [p].
     */
    fun axisLock(prev: Pt, p: Pt, tolDeg: Double = 12.0): Pt = when (axisOf(prev, p, tolDeg)) {
        0 -> Pt(p.x, prev.y)
        1 -> Pt(prev.x, p.y)
        else -> p
    }

    /** A polygon is usable as a room: at least 3 corners, some area, no edge crossing another. */
    fun validRoom(p: List<Pt>, minArea: Double = 100.0): Boolean {
        if (p.size < 3 || area(p) < minArea) return false
        val n = p.size
        for (i in 0 until n) for (j in i + 2 until n) {
            if (i == 0 && j == n - 1) continue
            if (segX(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) return false
        }
        return true
    }

    private fun segX(a: Pt, b: Pt, c: Pt, d: Pt): Boolean {
        fun o(p: Pt, q: Pt, r: Pt) = (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
        val d1 = o(c, d, a); val d2 = o(c, d, b); val d3 = o(a, b, c); val d4 = o(a, b, d)
        return ((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) && ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9))
    }

    /** Drops points closer than [min] to the previous one (freehand routes). */
    fun thin(pts: List<Pt>, min: Double): List<Pt> {
        if (pts.size < 3) return pts
        val out = mutableListOf(pts.first())
        for (i in 1 until pts.size - 1) if (pts[i].dist(out.last()) >= min) out += pts[i]
        out += pts.last()
        return out
    }

    /** Ramer–Douglas–Peucker: a freehand stroke reduced to its corners. */
    fun simplify(pts: List<Pt>, eps: Double): List<Pt> {
        if (pts.size < 3) return pts
        var best = -1.0; var at = 0
        for (i in 1 until pts.size - 1) {
            val d = foot(pts[i], pts.first(), pts.last()).d
            if (d > best) { best = d; at = i }
        }
        if (best <= eps) return listOf(pts.first(), pts.last())
        val l = simplify(pts.subList(0, at + 1), eps)
        val r = simplify(pts.subList(at, pts.size), eps)
        return l.dropLast(1) + r
    }
}
