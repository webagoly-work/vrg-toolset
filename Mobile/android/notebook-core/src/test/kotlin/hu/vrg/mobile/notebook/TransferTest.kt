package hu.vrg.mobile.notebook

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class TransferTest {
    private fun e(id: String, at: Long, text: String, ed: Long? = null) = Entry(id, "alap", "jegyzet", at, ed, text)

    @Test fun newerWinsAndDeletionsHold() {
        val phone = Store().add(e("A", 1, "régi")).add(e("B", 2, "csak itt")).add(e("C", 3, "c")).remove("C")
        val other = Store(kitsOn = setOf("alap", "kutya")).add(e("A", 1, "új", ed = 10)).add(e("C", 3, "visszajönne")).add(e("D", 4, "onnan"))
        val m = Transfer.merge(phone, other)
        assertEquals("új", m.store.byId("A")!!.text)
        assertNull(m.store.byId("C"), "deleted here stays deleted")
        assertEquals(setOf("A", "B", "D"), m.store.entries.map { it.id }.toSet())
        assertEquals(Triple(1, 1, 0), Triple(m.added, m.updated, m.removed))
        assertTrue(m.store.isOn("kutya"))
    }

    @Test fun deletionsFromTheFileApplyHere() {
        val phone = Store().add(e("A", 1, "a")).add(e("B", 2, "b").copy(links = listOf("A")))
        val other = Store().add(e("A", 1, "a")).remove("A")
        val m = Transfer.merge(phone, other)
        assertNull(m.store.byId("A")); assertEquals(1, m.removed)
        assertTrue(m.store.byId("B")!!.links.isEmpty())
    }

    @Test fun mergingTwiceChangesNothing() {
        val phone = Store().add(e("A", 1, "a"))
        val file = Store.read(Transfer.export(Store().add(e("B", 2, "b"))))
        val once = Transfer.merge(phone, file).store
        val twice = Transfer.merge(once, file)
        assertFalse(twice.changed); assertEquals(once, twice.store)
        assertEquals("Nincs új a fájlban.", twice.describe())
    }

    @Test fun exportLeavesTheDraftOut() {
        assertEquals("", Store.read(Transfer.export(Store(draft = "titok"))).draft)
    }
}
