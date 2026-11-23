package hu.vrg.mobile.sketch

import java.io.File
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Saját kamera (WP M52): the viewfinder's purpose strip, the series, the ghost's before-photo, the level maths and
// the new switches. The camera screen itself (CameraX) is feature-sketch and runs only on a phone.
class CameraLiveTest {
    private val repo = File(System.getProperty("vrg.repo") ?: "../..")
    private val kit = FieldKit.parse(File(repo, "Sketcher/catalog/fieldkit.json").readText())
    private fun survey() = Sketch("S1", name = "Kossuth u. 12").copy(scope = mapOf("merohely" to 1))

    @Test fun theStripPutsTheNextMissingItemsFirstAndNeverOffersTheRoomPurpose() {
        val s = survey()
        val strip = CameraLive.strip(kit, s, "hiba")
        val missing = strip.takeWhile { it.missing }
        assertTrue(missing.isNotEmpty() && missing.size <= 4)
        assertTrue(missing.all { it.shot != null && kit.shot(it.shot)!!.room == null })
        val plain = strip.drop(missing.size)
        assertEquals("hiba", plain.first().purpose)                       // the current purpose leads the plain ones
        assertTrue(plain.none { it.shot != null || it.missing })
        assertEquals(plain.map { it.purpose }.distinct(), plain.map { it.purpose })
        assertTrue(strip.none { it.purpose == "szoba" })
        assertEquals(kit.purposes.count { it.id != "szoba" }, plain.size)  // every other purpose is reachable
        // with "Hiányzók elöl" off the strip starts with the current purpose
        assertEquals("hiba", CameraLive.strip(kit, s, "hiba", missingFirst = false).first().purpose)
    }

    @Test fun aTakenItemLeavesTheStripAndTheCountGrows() {
        var s = survey()
        val first = CameraLive.strip(kit, s, null).first { it.missing }
        val need = kit.shot(first.shot)!!.need
        repeat(need) { i -> s = Intake.addCapture(s, "x$i.jpg", first.purpose, null, null, first.shot, i.toLong()).first }
        assertTrue(CameraLive.strip(kit, s, null).none { it.shot == first.shot })
        assertEquals(need, CameraLive.count(s, first.purpose, first.shot))
        assertTrue(CameraLive.count(s, first.purpose) >= need)
    }

    @Test fun theSeriesMovesOnWhenItsItemIsCompleteAndUndoTakesTheLastBack() {
        var s = survey()
        val item = FieldKit.shots(kit, s).first { !it.done && it.item.room == null && it.item.need == 1 }.item
        var ser = CameraLive.Series(item.purpose, item.id, room = null, pairOf = "C9")
        val (s1, id1) = Intake.addCapture(s, "a.jpg", item.purpose, null, null, item.id, 1); s = s1
        ser = CameraLive.took(kit, s, ser, id1)
        assertEquals(listOf(id1), ser.taken)
        assertNull(ser.pairOf)                                               // the pair is done: no ghost for the next
        assertTrue(ser.shot != item.id)                                      // the item is complete: moved on
        val next = ser.shot?.let { kit.shot(it) }
        if (next != null) assertEquals(item.purpose, next.purpose)          // ...to an item of the same purpose, or none
        // a purpose without an item keeps going without one
        var free = CameraLive.Series("hiba")
        val (s2, id2) = Intake.addCapture(s, "b.jpg", "hiba", null, null, null, 2); s = s2
        free = CameraLive.took(kit, s, free, id2)
        assertNull(free.shot); assertEquals(1, free.size)
        val (back, gone) = CameraLive.undo(free)
        assertEquals(id2, gone); assertEquals(0, back.size)
        assertNull(CameraLive.undo(back).second)
    }

    @Test fun pickingAnotherPurposeDropsThePendingPair() {
        val ser = CameraLive.Series("hiba", pairOf = "C1")
        assertEquals("C1", CameraLive.pick(ser, CameraLive.Pick("hiba")).pairOf)
        val other = CameraLive.pick(ser, CameraLive.Pick("tabla", "tabla_nyitva", true))
        assertNull(other.pairOf); assertEquals("tabla", other.purpose); assertEquals("tabla_nyitva", other.shot)
        assertTrue(CameraLive.staysOpen(seriesOn = true, sorozat = false, photoPoint = false))
        assertTrue(CameraLive.staysOpen(seriesOn = false, sorozat = true, photoPoint = false))
        assertFalse(CameraLive.staysOpen(seriesOn = false, sorozat = false, photoPoint = false))
        assertFalse(CameraLive.staysOpen(seriesOn = true, sorozat = true, photoPoint = true))
    }

    @Test fun theGhostIsTheBeforePhotoAndTheCandidatesAreTheWaitingOnesSameRoomFirst() {
        var s = survey()
        val (a, b1) = Intake.addCapture(s, "b1.jpg", "hiba", "R1", null, null, 1); s = a
        val (b, b2) = Intake.addCapture(s, "b2.jpg", "hiba", "R2", null, null, 2); s = b
        val (c, other) = Intake.addCapture(s, "o.jpg", "tabla", "R1", null, null, 3); s = c
        s = Camera2.markBefore(Camera2.markBefore(Camera2.markBefore(s, b1), b2), other)
        assertEquals(listOf(b1, b2), CameraLive.ghostCandidates(s, "hiba", "R1").map { it.id })
        assertEquals(listOf(b2, b1), CameraLive.ghostCandidates(s, "hiba", null).map { it.id })   // the newest first
        assertEquals(b1, CameraLive.ghost(s, CameraLive.Series("hiba", pairOf = b1))?.id)
        assertNull(CameraLive.ghost(s, CameraLive.Series("hiba")))
        // once paired, a before no longer waits
        val (d, after) = Intake.addCapture(s, "u.jpg", "hiba", "R1", null, null, 4); s = Camera2.pair(d, after, b1)
        assertEquals(listOf(b2), CameraLive.ghostCandidates(s, "hiba", "R1").map { it.id })
        assertEquals(0.8f, CameraLive.ghostAlpha(2f)); assertEquals(0f, CameraLive.ghostAlpha(-1f))
    }

    @Test fun theLevelReadsTheGravityVector() {
        val g = 9.81
        fun at(deg: Double, tiltDown: Double = 0.0): CameraLive.Level {
            val r = Math.toRadians(deg); val t = Math.toRadians(tiltDown)
            return CameraLive.level(g * cos(t) * sin(r), g * cos(t) * cos(r), g * sin(t))
        }
        at(0.0).let { assertEquals(0, it.quarter); assertTrue(abs(it.roll) < 1e-9); assertTrue(it.level()); assertFalse(it.flat) }
        at(3.0).let { assertEquals(0, it.quarter); assertEquals(3.0, it.roll, 1e-6); assertFalse(it.level()) }
        at(-2.5).let { assertEquals(0, it.quarter); assertEquals(-2.5, it.roll, 1e-6) }
        at(88.0).let { assertEquals(90, it.quarter); assertEquals(-2.0, it.roll, 1e-6) }      // landscape, nearly level
        at(271.0).let { assertEquals(270, it.quarter); assertEquals(1.0, it.roll, 1e-6); assertTrue(it.level()) }
        at(180.0).let { assertEquals(180, it.quarter) }
        at(359.5).let { assertEquals(0, it.quarter); assertEquals(-0.5, it.roll, 1e-6) }
        at(0.0, 30.0).let { assertEquals(30.0, it.pitch, 1e-6); assertFalse(it.flat) }          // looking down 30°
        at(0.0, 85.0).let { assertTrue(it.flat); assertTrue(it.level(6.0)) }                     // at the floor
        at(0.0, -85.0).let { assertTrue(it.flat); assertTrue(it.pitch < 0) }                     // at the ceiling
        assertEquals(CameraLive.Level(0.0, 0, 0.0, false), CameraLive.level(0.0, 0.0, 0.0))
    }

    @Test fun smoothingAndZoomStayInBounds() {
        val a = CameraLive.smooth(null, doubleArrayOf(0.0, 10.0))
        assertEquals(10.0, a[1])
        val b = CameraLive.smooth(a, doubleArrayOf(10.0, 10.0), 0.5)
        assertEquals(5.0, b[0]); assertEquals(10.0, b[1])
        assertEquals(2f, CameraLive.zoom(1f, 2f, 1f, 8f))
        assertEquals(8f, CameraLive.zoom(4f, 3f, 1f, 8f))
        assertEquals(1f, CameraLive.zoom(1f, 0.2f, 1f, 8f))
        assertEquals(2.0 / 3, CameraLive.GRID[1], 1e-9)
    }

    @Test fun theInAppCameraAndEachHelperAreSwitchesOnByDefault() {
        val live = listOf(CameraFeatures.LIVE, CameraFeatures.LIVE_GPS, CameraFeatures.SERIES, CameraFeatures.GHOST,
            CameraFeatures.LEVEL, CameraFeatures.GRID, CameraFeatures.TORCH)
        assertTrue(live.all { CameraFeatures.of(it) != null && CameraFeatures.on(emptySet(), it) })
        // off = the phone's camera app: every helper goes with it
        val off = setOf(CameraFeatures.LIVE)
        assertTrue(live.none { CameraFeatures.on(off, it) })
        assertTrue(CameraFeatures.on(off, CameraFeatures.PAIRS))           // the pairs themselves stay
        // the ghost also needs the before / after pairs
        assertFalse(CameraFeatures.on(setOf(CameraFeatures.PAIRS), CameraFeatures.GHOST))
        assertTrue(CameraFeatures.on(setOf(CameraFeatures.PAIRS), CameraFeatures.LEVEL))
        // each helper on its own
        assertFalse(CameraFeatures.on(setOf(CameraFeatures.TORCH), CameraFeatures.TORCH))
        assertTrue(CameraFeatures.on(setOf(CameraFeatures.TORCH), CameraFeatures.GRID))
        // a phone that stored Kamera 2's switches before M52 gets the new ones on
        assertTrue(live.all { CameraFeatures.on(CameraFeatures.read("blur,video"), it) })
        assertTrue(CameraFeatures.all(false).containsAll(live))
    }

    @Test fun audioNotesAreLeftAlone() {
        // F5's sound notes (kind audio, purpose "hang") never reach the camera's strip, count or ghost
        var s = survey()
        val (s1, a) = AudioNotes.add(s, "A-1.m4a", null, 1200, 999, 1); s = Camera2.markBefore(s1, a)
        assertTrue(CameraLive.strip(kit, s, null).none { it.purpose == AudioNotes.PURPOSE })
        assertEquals(0, CameraLive.count(s, AudioNotes.PURPOSE))
        assertTrue(CameraLive.ghostCandidates(s, AudioNotes.PURPOSE, null).isEmpty())
        assertNull(CameraLive.ghost(s, CameraLive.Series(AudioNotes.PURPOSE, pairOf = a)))
    }
}
