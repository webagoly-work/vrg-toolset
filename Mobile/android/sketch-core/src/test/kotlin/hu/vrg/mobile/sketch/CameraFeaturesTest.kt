package hu.vrg.mobile.sketch

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// D-90: every Kamera 2 feature on by default, each and all switchable; faces become blur proposals.
class CameraFeaturesTest {
    @Test fun everythingIsOnByDefaultAndANewFeatureArrivesOn() {
        assertTrue(CameraFeatures.ALL.all { CameraFeatures.on(emptySet(), it.id) })
        assertTrue(CameraFeatures.on(setOf("ocr"), "valami_uj"))           // not in the list yet: on
        assertEquals(CameraFeatures.ALL.size, CameraFeatures.ALL.map { it.id }.toSet().size)
        CameraFeatures.ALL.forEach { f -> f.needs?.let { assertTrue(CameraFeatures.of(it) != null, f.id) } }
    }

    @Test fun eachAndAllSwitch_andPrerequisitesCarry() {
        var off = CameraFeatures.toggle(emptySet(), CameraFeatures.OCR)
        assertFalse(CameraFeatures.on(off, CameraFeatures.OCR)); assertFalse(CameraFeatures.on(off, CameraFeatures.OCR_AUTO))
        assertTrue(CameraFeatures.on(off, CameraFeatures.VIDEO))
        off = CameraFeatures.toggle(off, CameraFeatures.OCR)
        assertTrue(CameraFeatures.on(off, CameraFeatures.OCR_AUTO))
        // blur off takes face finding (and its automatic run) with it
        off = setOf(CameraFeatures.BLUR)
        assertFalse(CameraFeatures.on(off, CameraFeatures.FACES)); assertFalse(CameraFeatures.on(off, CameraFeatures.FACES_AUTO))
        assertTrue(CameraFeatures.ALL.none { CameraFeatures.on(CameraFeatures.all(false), it.id) })
        assertTrue(CameraFeatures.allOn(CameraFeatures.all(true))); assertFalse(CameraFeatures.allOn(off))
    }

    @Test fun theStoredFormRoundTripsAndKeepsUnknownIds() {
        val off = setOf("video", "faces", "jovobeli")
        assertEquals("faces,jovobeli,video", CameraFeatures.write(off))
        assertEquals(off, CameraFeatures.read(CameraFeatures.write(off)))
        assertEquals(emptySet(), CameraFeatures.read(null)); assertEquals(emptySet(), CameraFeatures.read(" , "))
    }

    @Test fun facesBecomePaddedClippedBlurRectanglesNotProposedTwice() {
        val faces = listOf(CameraFeatures.Box(0.4, 0.4, 0.6, 0.6), CameraFeatures.Box(0.0, 0.0, 0.1, 0.1), CameraFeatures.Box(0.5, 0.5, 0.5, 0.7))
        val p = CameraFeatures.proposals(faces, emptyList())
        assertEquals(2, p.size)                                             // the zero-width box is dropped
        assertTrue(p.all { it.kind == MarkKind.BLUR && it.pts.size == 2 })
        assertEquals(Pt(0.36, 0.36), p[0].pts[0].let { Pt(Math.round(it.x * 100) / 100.0, Math.round(it.y * 100) / 100.0) })
        assertEquals(Pt(0.0, 0.0), p[1].pts[0])                               // clipped at the edge
        // a face already blurred is not proposed again
        assertEquals(1, CameraFeatures.proposals(faces, listOf(p[0])).size)
        // a brush stroke over the face does not count as a rectangle
        assertEquals(2, CameraFeatures.proposals(faces, listOf(Mark(MarkKind.BLUR_BRUSH, listOf(Pt(0.5, 0.5))))).size)
    }

    @Test fun gpsStripCanBeSwitchedOffButAPersonalPhotoStillLosesIt() {
        val c = Capture("C1", "a.jpg", lat = 47.0, lon = 19.0)
        assertFalse(Camera2.exportPlan(c).gps)
        assertTrue(Camera2.exportPlan(c, stripGps = false).gps)
        assertFalse(Camera2.exportPlan(c.copy(privacy = true), stripGps = false).gps)
    }
}
