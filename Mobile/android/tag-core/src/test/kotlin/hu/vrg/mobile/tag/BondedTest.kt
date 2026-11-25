package hu.vrg.mobile.tag

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class BondedTest {
    private val watch = "41:42:43:44:45:46"

    @Test fun `a BLE name is the paired device's only when it clearly is`() {
        assertTrue(Bonded.sameDevice("Q71", "Q71"))
        assertTrue(Bonded.sameDevice("Q71", "q71-LE"))
        assertTrue(Bonded.sameDevice("Q71", "Q71_BLE"))
        assertTrue(Bonded.sameDevice("Q71 LE", "Q71"))
        assertFalse(Bonded.sameDevice("Q71", "Q710"), "a longer model number is another model")
        assertFalse(Bonded.sameDevice("Q71", "Q7"))
        assertFalse(Bonded.sameDevice("Q7", "Q7"), "too short to trust")
        assertFalse(Bonded.sameDevice("Smart Watch", "Smart Watch"), "generic names match strangers")
        assertFalse(Bonded.sameDevice(null, "Q71"))
        assertFalse(Bonded.sameDevice("Q71", null))
    }

    @Test fun `a paired watch is bound from the list and remembered`() {
        val b = TagBook()
        val m = b.bindBonded(watch, "Q71", "", 1_000, connected = true)
        assertEquals("Q71", m.name, "the Bluetooth name when no name is typed")
        assertEquals(TagType.WATCH, m.type)
        assertEquals(AdKind.BONDED, m.kind)
        assertFalse(m.rotates)
        assertEquals(1_000L, m.lastSeenAt)
        assertEquals(0L, TagBook().bindBonded(watch, "Q71", "Óra", 1_000, connected = false).lastSeenAt)
        val back = assertNotNull(Mine.decode(m.encode()))
        assertEquals("Q71", back.btName)
        assertEquals(TagType.WATCH, back.type)
    }

    @Test fun `while connected it is heard, and Ottfelejtes rings after the link has been gone its time`() {
        val b = TagBook()
        b.bindBonded(watch, "Q71", "Óra", 0, connected = true)
        val w = LeftBehind(afterMs = 60_000)
        w.arm(0)
        for (t in 2_000L..300_000L step 2_000L) {
            b.heardLinked(watch, null, t)
            assertNull(w.tick(b.mine!!.lastSeenAt, t))
        }
        assertEquals(TagType.WATCH, b.get(watch)?.ad?.type, "the stand-in is the watch's, not an iTag's")
        assertNull(w.tick(300_000, 359_000), "a short drop (out of the room) is not left behind")
        assertEquals(LeftBehind.Event.LEFT, w.tick(300_000, 360_000))
        b.heardLinked(watch, null, 400_000)
        assertEquals(LeftBehind.Event.BACK, w.tick(b.mine!!.lastSeenAt, 401_000))
    }

    @Test fun `its BLE side by name gives the distance`() {
        val b = TagBook()
        assertFalse(b.heardByName("Q71", -60, 0), "nothing is mine yet")
        b.bindBonded(watch, "Q71", "Óra", 0, connected = false)
        assertTrue(b.heardByName("Q71-LE", -60, 1_000))
        assertTrue(b.heardByName("Q71", -62, 1_200))
        assertFalse(b.heardByName("Mi Band 6", -40, 1_300))
        assertEquals(1_200L, b.mine!!.lastSeenAt)
        assertNotNull(b.mineSeen()?.rssi?.value)
    }

    @Test fun `a Find My tag as mine takes no name credit`() {
        val b = TagBook()
        val raw = byteArrayOf(0x07, 0xFF.toByte(), 0x4C, 0x00, 0x12, 0x02, 0x20, 0x01)
        repeat(4) { b.heard("C1:00:00:00:00:01", raw, -40, it * 200L) }
        b.bind(b.get("C1:00:00:00:00:01")!!, "x", 800)
        assertFalse(b.heardByName("Q71", -50, 900))
    }

    @Test fun `kind labels`() {
        assertEquals("óra / viselhető", Bonded.kindLabel(0x0700))
        assertEquals("hang (fülhallgató, hangszóró)", Bonded.kindLabel(0x0400))
        assertEquals("párosított eszköz", Bonded.kindLabel(null))
    }
}
