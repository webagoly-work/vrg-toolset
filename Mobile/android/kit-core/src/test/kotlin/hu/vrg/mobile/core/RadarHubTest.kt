package hu.vrg.mobile.core

import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class RadarHubTest {
    private class Fake(id: String, val n: Int, val boom: Boolean = false) : RadarSource {
        override val layer = RadarLayer(id, id, "•", RadarTone.GLOW, feature = id)
        var watched = false
        override fun blips(now: Long): List<Blip> {
            if (boom) error("a broken source")
            return (0 until n).map { Blip("${layer.id}:$it", layer.id, "${layer.id} $it", distanceM = 2.0 + it) } +
                Blip("stray", "other-layer", "not mine")       // a blip on someone else's layer is dropped
        }
        override fun watch(on: Boolean) { watched = on }
    }

    @AfterTest fun clean() = RadarHub.reset()

    @Test fun `sources plug in, a broken one is skipped, foreign layers are dropped`() {
        val a = Fake("tag", 2); val b = Fake("pager", 3); val c = Fake("bad", 1, boom = true)
        RadarHub.register(a); RadarHub.register(b); RadarHub.register(c)
        assertEquals(listOf("tag", "pager", "bad"), RadarHub.layers().map { it.id })
        val all = RadarHub.blips(0)
        assertEquals(5, all.size)
        assertTrue(all.none { it.id == "stray" })
        assertEquals(2, RadarHub.frame(0, null, null, RadarMode.NORTH_UP, only = setOf("tag")).blips.size)
        RadarHub.register(Fake("tag", 1))
        assertEquals(4, RadarHub.blips(0).size, "the same layer id replaces the old source")
        RadarHub.unregister("pager")
        assertEquals(listOf("bad", "tag"), RadarHub.layers().map { it.id })
    }

    @Test fun `the first radar on screen wakes the sources, the last one calms them`() {
        val a = Fake("tag", 1)
        RadarHub.register(a)
        RadarHub.watch(true); assertTrue(a.watched)
        RadarHub.watch(true); RadarHub.watch(false); assertTrue(a.watched, "one radar still on screen")
        val late = Fake("late", 1); RadarHub.register(late); assertTrue(late.watched, "a source added while watched is woken")
        RadarHub.watch(false); assertTrue(!a.watched && !late.watched)
        RadarHub.watch(false); assertTrue(!RadarHub.watched, "never below zero")
    }

    @Test fun `swept directions are kept for ten minutes`() {
        RadarHub.keepSweep("tag:0", 370.0, 0.8, 1_000)
        assertEquals(10.0, RadarHub.sweep("tag:0", 2_000)?.bearingDeg)
        assertEquals(mapOf("tag:0" to 10.0), RadarHub.sweeps(5_000))
        assertNull(RadarHub.sweep("tag:0", 1_000 + RadarHub.SWEEP_KEEP_MS + 1))
        assertTrue(RadarHub.sweeps(1_000 + RadarHub.SWEEP_KEEP_MS + 1).isEmpty())
        RadarHub.keepSweep("x", 5.0, 0.5, 0); RadarHub.dropSweep("x")
        assertNull(RadarHub.sweep("x", 1))
    }
}
