package hu.vrg.mobile.sketch

import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

// The user's own case (2026-11-17): "one room has X and Y measures, but two rooms next to them have half missing
// measurements — these should be enough to normalise it into a proper Planner project; areas whose size was
// inferred get a visual mark". Sketch units are deliberately out of proportion with the millimetres.
class SolverTest {
    private fun rect(s: Sketch, x0: Double, y0: Double, x1: Double, y1: Double): Pair<Sketch, String> =
        Ops.addRectRoom(s, Pt(x0, y0), Pt(x1, y1), 4.0)!!

    private fun near(a: Double, b: Double, tol: Double = 1.0) = abs(a - b) <= tol
    private fun xs(r: NRoom) = r.poly.map { it.x }
    private fun ys(r: NRoom) = r.poly.map { it.y }

    /** A (measured both ways) | B (width only) on top, C (depth only) under both. */
    private fun abc(): Triple<Sketch, List<String>, Unit> {
        var s = Sketch("S1")
        val (s1, a) = rect(s, 0.0, 0.0, 100.0, 80.0); s = s1
        val (s2, b) = rect(s, 103.0, 1.0, 160.0, 79.0); s = s2           // drawn a little off: still A's wall lines
        val (s3, c) = rect(s, 1.0, 82.0, 158.0, 130.0); s = s3
        s = Ops.setMeasure(s, a, MeasureKind.WIDTH, 4000)
        s = Ops.setMeasure(s, a, MeasureKind.DEPTH, 3000)
        s = Ops.setMeasure(s, b, MeasureKind.WIDTH, 2500)
        s = Ops.setMeasure(s, c, MeasureKind.DEPTH, 2000)
        return Triple(s, listOf(a, b, c), Unit)
    }

    @Test fun halfMeasuredNeighboursAreDerivedNotGuessed() {
        val (s, ids) = abc()
        val n = Solver().solve(s)
        val (a, b, c) = ids.map { n.room(it)!! }
        assertEquals(listOf(0.0, 4000.0), xs(a).distinct().sorted())
        assertEquals(listOf(0.0, 3000.0), ys(a).distinct().sorted())
        assertEquals(listOf(4000.0, 6500.0), xs(b).distinct().sorted(), "B shares A's right wall")
        assertEquals(listOf(0.0, 3000.0), ys(b).distinct().sorted(), "B's depth comes from A: nobody measured it")
        assertEquals(listOf(0.0, 6500.0), xs(c).distinct().sorted(), "C's width = A + B")
        assertEquals(listOf(3000.0, 5000.0), ys(c).distinct().sorted())
        assertEquals(0, n.report.inferred, "nothing had to be guessed")
        assertTrue(b.edges.contains(SizeStatus.DERIVED) && b.edges.contains(SizeStatus.MEASURED))
        assertTrue(c.edges.all { it != SizeStatus.INFERRED })
        assertTrue(n.report.conflicts.isEmpty())
    }

    @Test fun anUnmeasuredRoomTakesTheSketchScaleAndIsMarked() {
        var (s, ids) = abc()
        val (s1, d) = rect(s, 160.0, 82.0, 210.0, 130.0); s = s1        // D right of C, 50 units wide, nothing measured
        val n = Solver().solve(s)
        val dr = n.room(d)!!
        assertTrue(dr.inferred, "D's width is a guess")
        val w = xs(dr).max() - xs(dr).min()
        // x scale = median(4000/100, 2500/60) ≈ 40.8 mm per unit (the ±1.5 units of drawing slop move it a little)
        assertTrue(w in 1950.0..2150.0, "D ≈ 2 m wide, was $w")
        assertEquals(3000.0, ys(dr).min()); assertEquals(5000.0, ys(dr).max(), "its depth is C's: derived")
        val horiz = dr.poly.indices.filter { k -> dr.poly[k].y == dr.poly[(k + 1) % dr.poly.size].y }
        assertTrue(horiz.all { dr.edges[it] == SizeStatus.INFERRED })
        val vert = dr.poly.indices.filter { k -> dr.poly[k].x == dr.poly[(k + 1) % dr.poly.size].x }
        assertTrue(vert.all { dr.edges[it] != SizeStatus.INFERRED })
        assertTrue(!n.room(ids[0])!!.inferred && !n.room(ids[2])!!.inferred, "a guess next door does not taint measured rooms")
        assertTrue(n.report.inferred >= 2)
    }

    @Test fun slackIsSpreadInProportionToTheSketch() {
        // two rooms side by side, only the total measured: 6000 split 1 : 3 as drawn
        var s = Sketch("S2")
        val (s1, a) = rect(s, 0.0, 0.0, 50.0, 60.0); s = s1
        val (s2, b) = rect(s, 50.0, 0.0, 200.0, 60.0); s = s2
        val (s3, c) = rect(s, 0.0, 60.0, 200.0, 100.0); s = s3
        s = Ops.setMeasure(s, c, MeasureKind.WIDTH, 6000)
        val n = Solver().solve(s)
        val wa = xs(n.room(a)!!).let { it.max() - it.min() }
        val wb = xs(n.room(b)!!).let { it.max() - it.min() }
        assertTrue(near(wa, 1500.0, 2.0) && near(wb, 4500.0, 2.0), "$wa / $wb")
        assertTrue(n.room(a)!!.inferred && n.room(b)!!.inferred)
        assertTrue(!n.room(c)!!.edges.filterIndexed { k, _ -> n.room(c)!!.poly[k].y == n.room(c)!!.poly[(k + 1) % 4].y }.contains(SizeStatus.INFERRED))
    }

    @Test fun contradictingMeasuresAreReported() {
        var (s, ids) = abc()
        s = Ops.setMeasure(s, ids[2], MeasureKind.WIDTH, 7000)            // A + B = 6500, C says 7000
        val n = Solver().solve(s)
        assertTrue(n.report.conflicts.isNotEmpty(), "the 500 mm disagreement is reported")
        assertTrue(n.report.conflicts.all { it.mm in setOf(7000, 4000, 2500) })
        val c = xs(n.room(ids[2])!!).let { it.max() - it.min() }
        assertTrue(c > 6500 && c < 7000, "least squares lands between the two answers: $c")
    }

    @Test fun edgeMeasureAndPointsFollowTheirWalls() {
        var s = Sketch("S3")
        val (s1, a) = rect(s, 0.0, 0.0, 100.0, 50.0); s = s1
        s = Ops.setMeasure(s, a, MeasureKind.EDGE, 5000, edge = 0)      // the top edge
        s = Ops.setMeasure(s, a, MeasureKind.EDGE, 3000, edge = 1)      // the right edge
        val (s2, p) = Ops.addPoint(s, Pt(99.0, 25.0), PointType.SOCKET, PointState.EXISTING, 6.0); s = s2
        val (s3, q) = Ops.addPoint(s, Pt(50.0, 25.0), PointType.LIGHT, PointState.PLANNED, 6.0); s = s3
        val n = Solver().solve(s)
        assertTrue(n.room(a)!!.edges.all { it != SizeStatus.INFERRED })
        val np = n.point(p)!!
        assertEquals(5000.0, np.at.x); assertTrue(near(np.at.y, 1500.0))
        assertNotNull(np.inward); assertTrue(near(np.inward!!.x, -1.0, 1e-9), "the right wall's inside is to the left")
        val nq = n.point(q)!!
        assertTrue(near(nq.at.x, 2500.0) && near(nq.at.y, 1500.0)); assertEquals(null, nq.inward)
    }

    @Test fun noMeasuresAtAllUsesTheDefaultScale() {
        val (s, a) = rect(Sketch("S4"), 0.0, 0.0, 120.0, 80.0)
        val n = Solver(defaultScale = 25.0).solve(s)
        val r = n.room(a)!!
        assertEquals(3000.0, xs(r).max() - xs(r).min()); assertEquals(2000.0, ys(r).max() - ys(r).min())
        assertTrue(r.edges.all { it == SizeStatus.INFERRED })
        assertTrue(n.report.warnings.isNotEmpty())
    }

    @Test fun anLShapedLineoutKeepsItsShape() {
        val l = listOf(Pt(0.0, 0.0), Pt(100.0, 0.0), Pt(100.0, 40.0), Pt(60.0, 40.0), Pt(60.0, 90.0), Pt(0.0, 90.0))
        val (s0, r) = Ops.addPolyRoom(Sketch("S5"), l)!!
        var s = Ops.setMeasure(s0, r, MeasureKind.WIDTH, 5000)
        s = Ops.setMeasure(s, r, MeasureKind.DEPTH, 4500)
        s = Ops.setMeasure(s, r, MeasureKind.EDGE, 2000, edge = 1)       // the short right wall
        s = Ops.setMeasure(s, r, MeasureKind.EDGE, 3000, edge = 4)       // the inner corner's x: 0 → line of x=60 is the bottom edge
        val n = Solver().solve(s)
        val nr = n.room(r)!!
        assertEquals(6, nr.poly.size)
        assertEquals(listOf(0.0, 3000.0, 5000.0), xs(nr).distinct().sorted())
        assertEquals(listOf(0.0, 2000.0, 4500.0), ys(nr).distinct().sorted())
        assertEquals(0, n.report.inferred)
    }

    @Test fun echelonAndGaussBasics() {
        val e = Solver.rref(listOf(doubleArrayOf(1.0, 1.0, 0.0), doubleArrayOf(0.0, 1.0, 1.0), doubleArrayOf(1.0, 2.0, 1.0)))
        assertEquals(2, e.size, "the third row is the sum of the first two")
        val x = Solver.gauss(arrayOf(doubleArrayOf(2.0, 1.0), doubleArrayOf(1.0, 3.0)), doubleArrayOf(3.0, 5.0))
        assertTrue(near(x[0], 0.8, 1e-9) && near(x[1], 1.4, 1e-9))
    }
}
