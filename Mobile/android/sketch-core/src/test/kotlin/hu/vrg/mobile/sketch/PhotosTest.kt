package hu.vrg.mobile.sketch

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Fotópont (WP M25): D-24 = A (the four sides of the room as drawn), D-25 = A (each photo its own board file),
// D-26 = A (no compass: the swipe is the direction).
class PhotosTest {
    private fun room(): Pair<Sketch, String> = Ops.addRectRoom(Sketch("S", "Kossuth u. 12"), Pt(0.0, 0.0), Pt(100.0, 80.0), 6.0)!!

    @Test fun aSwipePointsAtOneOfFourSides() {
        assertEquals(0, Photos.snap(3.0, -80.0)); assertEquals(90, Photos.snap(80.0, 10.0))
        assertEquals(180, Photos.snap(-5.0, 60.0)); assertEquals(270, Photos.snap(-70.0, -20.0))
        assertEquals(90, Photos.snap(50.0, -49.0), "just under 45° from right is right")
        assertNull(Photos.snap(3.0, 4.0, min = 10.0), "a twitch is no swipe")
        assertEquals(listOf("É", "K", "D", "Ny"), Photos.DIRS.map { Photos.label(it) })
        assertEquals(90, Photos.wedgeAt(30.0, 0.0, 14.0, 40.0)); assertNull(Photos.wedgeAt(5.0, 0.0, 14.0, 40.0))
        assertNull(Photos.wedgeAt(60.0, 0.0, 14.0, 40.0))
    }

    @Test fun thePointLandsInTheMiddleOfTheRoom() {
        val (s0, r) = room()
        val (s1, f) = PhotoOps.add(s0, Pt(55.0, 37.0), 6.0)
        val p = s1.photos.first { it.id == f }
        assertEquals(Pt(50.0, 40.0), p.at); assertEquals(r, p.room)
        val (s2, g) = PhotoOps.add(s1, Pt(90.0, 70.0), 6.0)
        assertEquals(Pt(90.0, 70.0), s2.photos.first { it.id == g }.at, "far from the middle it stays where it was put")
        val moved = Ops.moveRoom(s2, r, Pt(10.0, 0.0))
        assertEquals(Pt(60.0, 40.0), moved.photos.first { it.id == f }.at, "it moves with its room")
        assertEquals(Hit(Hit.Kind.PHOTO, f), Ops.hit(s2, Pt(51.0, 41.0), 8.0))
    }

    @Test fun oneShotPerSideAndTheNextOneMissing() {
        val (s0, _) = room()
        var (s, f) = PhotoOps.add(s0, Pt(50.0, 40.0), 6.0)
        assertEquals(0, Photos.next(s.photos[0]))
        val (s1, old1) = PhotoOps.addShot(s, f, 0, "a.jpg", 1); s = s1; assertNull(old1)
        val (s2, _) = PhotoOps.addShot(s, f, 450, "b.jpg", 2); s = s2               // 450 = 90
        assertEquals(180, Photos.next(s.photos[0]))
        val (s3, old3) = PhotoOps.addShot(s, f, 0, "c.jpg", 3); s = s3
        assertEquals("a.jpg", old3, "a retake hands back the old file to delete")
        assertEquals(listOf(0 to "c.jpg", 90 to "b.jpg"), s.photos[0].shots.map { it.deg to it.file })
        s = PhotoOps.turnShot(s, f, 0, 90)
        assertEquals(listOf(0 to "b.jpg", 90 to "c.jpg"), s.photos[0].shots.map { it.deg to it.file }, "a turn onto a taken side swaps")
        s = PhotoOps.turnShot(s, f, 90, 270)
        assertEquals(listOf(0, 270), s.photos[0].shots.map { it.deg })
        val (s4, gone) = PhotoOps.removeShot(s, f, 270); s = s4
        assertEquals("c.jpg", gone); assertEquals(listOf(90, 180, 270), Photos.missing(s.photos[0]))
        assertEquals(setOf("b.jpg"), Photos.files(s))
        assertEquals("kossuth-u-12_${f}_eszak.jpg", Photos.exportName(s, s.photos[0], 0))
        assertTrue(Ops.delete(s, f).photos.isEmpty())
    }

    @Test fun theWheelHasTheFourSidesAtItsSides() {
        val (s0, _) = room()
        val (s1, f) = PhotoOps.add(s0, Pt(50.0, 40.0), 6.0)
        val s = PhotoOps.addShot(s1, f, 90, "k.jpg", 1).first
        val w = Wheels.forPhoto(s.photos[0])
        assertEquals(1, w.rings.size); assertEquals(8, w.rings[0].size)
        assertEquals(listOf("shot:0", "shot:90", "shot:180", "shot:270"), listOf(0, 2, 4, 6).map { w.rings[0][it]!!.id })
        assertEquals("K ✓", w.rings[0][2]!!.label); assertEquals("É +", w.rings[0][0]!!.label)
        assertNull(Wheels.nextRing(w, 0, w.rings[0][4]!!), "South is a side here, not a ring switch")
        assertEquals("Fotópont 1/4", w.title)
    }

    @Test fun theSolvedPointStaysInTheMiddleOfTheSolvedRoom() {
        val (s0, r) = room()
        var s = Ops.setMeasure(s0, r, MeasureKind.WIDTH, 5000)
        s = Ops.setMeasure(s, r, MeasureKind.DEPTH, 3000)
        val (s1, f) = PhotoOps.add(s, Pt(50.0, 40.0), 6.0)
        val n = Solver().solve(s1)
        assertEquals(Pt(2500.0, 1500.0), n.photos.first { it.id == f }.at)
        val back = SketchJson.read(SketchJson.write(PhotoOps.addShot(s1, f, 180, "d.jpg", 9).first).toString())!!
        assertEquals(listOf(Shot(180, "d.jpg", 9)), back.photos[0].shots)
    }
}
