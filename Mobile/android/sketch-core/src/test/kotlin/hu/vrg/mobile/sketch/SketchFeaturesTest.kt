package hu.vrg.mobile.sketch

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// F5 (WP M50) under D-90: each F5 feature on its own switch; off leaves no trace in what leaves the phone.
class SketchFeaturesTest {
    private val s0 = Sketch("F1", name = "Kapcsolók")
    private val withAll = AudioNotes.add(ClientInfo.setKeep(ClientInfo.set(s0, "Minta", "+36", ""), true), "hang_1.m4a", null, 1000, 10, 1L).first

    @Test fun storedIsWhatIsOff() {
        assertTrue(SketchFeatures.allOn(emptySet()))
        assertEquals("audio,client", SketchFeatures.write(setOf("client", "audio")))
        assertEquals(setOf("client", "later"), SketchFeatures.read("client, later,"), "a newer app's ids survive")
        assertEquals(SketchFeatures.ALL.size, SketchFeatures.all(false).size)
        assertTrue(SketchFeatures.all(true).isEmpty())
    }

    @Test fun offLeavesNoTraceInTheExport() {
        val on = SketchFeatures.forExport(emptySet(), withAll)
        assertEquals("Minta", on.client?.name); assertEquals(1, AudioNotes.list(on).size)
        val off = SketchFeatures.forExport(setOf(SketchFeatures.CLIENT, SketchFeatures.AUDIO), withAll)
        assertNull(off.client); assertTrue(AudioNotes.list(off).isEmpty())
        assertFalse("Minta" in PlannerExport.build(off).toString())
        // not kept: stripped even with the feature on
        assertNull(SketchFeatures.forExport(emptySet(), ClientInfo.setKeep(withAll, false)).client)
    }

    @Test fun lineCloseFollowsItsSwitch() {
        val t = DrawTune(snapAngle = 90, lineClose = "auto")
        assertEquals(t, SketchFeatures.tune(emptySet(), t))
        assertEquals(DrawTune(snapAngle = 90), SketchFeatures.tune(setOf(SketchFeatures.LINE_CLOSE), t))
    }

    @Test fun csereOnOpenFollowsItsSwitch() {
        val old = s0.copy(tags = Tags.PRESETS.filter { it.preset != "replace" })
        assertTrue(SketchFeatures.onOpen(emptySet(), old).tags.any { it.preset == "replace" })
        assertEquals(old, SketchFeatures.onOpen(setOf(SketchFeatures.CSERE_OLD), old))
    }
}
