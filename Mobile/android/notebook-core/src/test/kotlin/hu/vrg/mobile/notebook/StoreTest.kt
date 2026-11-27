package hu.vrg.mobile.notebook

import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

class StoreTest {
    private val t0 = 1_763_700_000_000L   // 2025-11-21

    private fun walk(id: String, at: Long, perc: Double) =
        Entry(id, "kutya", "seta", at, f = mapOf("perc" to Value.Num(perc)))

    @Test fun idsAreUniqueAndStartWithE() {
        val rnd = Random(1)
        val ids = (1..2000).map { Ids.next(t0, rnd) }
        assertEquals(ids.size, ids.toSet().size)
        assertTrue(ids.all { it.startsWith("E") })
    }

    @Test fun roundTripKeepsEverything() {
        val s = Store()
            .add(Entry("E1", "alap", "jegyzet", t0, text = "Hívd vissza Pétert", tags = listOf("fontos"), open = true))
            .add(walk("E2", t0 + 1000, 30.0).copy(f = mapOf("perc" to Value.Num(30.0), "km" to Value.Num(2.5), "x" to Value.Many(listOf("a", "b")))))
            .link("E2", "E1", t0 + 2000)
            .setKit("kutya", true)
            .dismiss("open:E9")
            .copy(draft = "félig")
        val back = Store.read(s.write())
        assertEquals(s, back)
    }

    @Test fun updateStampsAndKeepsIdentity() {
        val s = Store().add(walk("E1", t0, 20.0)).update("E1", t0 + 5) { it.copy(id = "X", at = 0, f = mapOf("perc" to Value.Num(25.0))) }
        val e = s.byId("E1")!!
        assertEquals(t0, e.at); assertEquals(t0 + 5, e.ed); assertEquals(Value.Num(25.0), e.f["perc"])
    }

    @Test fun removeLeavesATombstoneAndDropsLinks() {
        val s = Store().add(walk("E1", t0, 1.0)).add(walk("E2", t0, 2.0)).link("E2", "E1", t0).remove("E1")
        assertNull(s.byId("E1"))
        assertTrue("E1" in s.gone)
        assertTrue(s.byId("E2")!!.links.isEmpty())
    }

    @Test fun theBaseKitCannotBeSwitchedOff() {
        val s = Store().setKit(Kits.BASE, false)
        assertTrue(s.isOn(Kits.BASE))
        assertTrue(Store.read(Store(kitsOn = emptySet()).write()).isOn(Kits.BASE))
    }

    @Test fun refusesForeignAndNewerFiles() {
        assertFailsWith<Unreadable> { Store.read("""{"kind":"vrg-vazlat"}""") }
        assertFailsWith<Unreadable> { Store.read("""{"kind":"vrg-fuzet","v":99}""") }
        assertFailsWith<Unreadable> { Store.read("{") }
    }
}
