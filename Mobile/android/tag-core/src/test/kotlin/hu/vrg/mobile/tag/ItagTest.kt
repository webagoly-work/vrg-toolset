package hu.vrg.mobile.tag

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ItagTest {
    /** "iTAG" + spaces as the complete local name, as the tag advertises it. */
    private fun named(name: String, type: Int = 0x09): ByteArray {
        val b = name.toByteArray(Charsets.UTF_8)
        return byteArrayOf(0x02, 0x01, 0x06, (b.size + 1).toByte(), type.toByte()) + b
    }

    private val addr = "FF:FF:C1:12:34:56"

    @Test fun `an iTag is known by its name or its button service`() {
        val ad = assertNotNull(Itag.parse(named("iTAG            ")))
        assertEquals(AdKind.ITAG, ad.kind)
        assertEquals(TagType.ITAG, ad.type)
        assertEquals("iTAG", Itag.localName(named("iTAG            ")))
        assertNotNull(Itag.parse(named("ITAG", type = 0x08)), "shortened name, any case")
        assertNotNull(Itag.parse(byteArrayOf(0x03, 0x03, 0xE0.toByte(), 0xFF.toByte())), "0xFFE0 in the UUID list")
        assertNull(Itag.parse(named("Mi Band")))
        assertNull(Itag.parse(byteArrayOf(0x02, 0x01, 0x06)))
        assertNull(Itag.localName(named("   ")))
    }

    @Test fun `the book takes an iTag, and a Find My tag stays a Find My tag`() {
        val b = TagBook()
        val s = assertNotNull(b.heard(addr, named("iTAG            "), -50, 0))
        assertEquals(TagType.ITAG, s.ad.type)
        val fm = byteArrayOf(0x07, 0xFF.toByte(), 0x4C, 0x00, 0x12, 0x02, 0x20, 0x01) + named("iTAG")
        assertEquals(AdKind.NEAR_OWNER, b.heard("C1:00:00:00:00:01", fm, -50, 0)?.ad?.kind, "Find My is read first")
    }

    @Test fun `bind an iTag by holding it, it never relinks`() {
        val b = TagBook()
        repeat(4) { b.heard(addr, named("iTAG"), -45, it * 200L) }
        val pick = b.bindPick(800)
        assertTrue(pick is BindPick.Ok)
        val m = b.bind((pick as BindPick.Ok).seen, "Kulcs", 800)
        assertEquals(AdKind.ITAG, m.kind)
        assertFalse(m.rotates)
        repeat(3) { b.heard("FF:FF:C1:00:00:09", named("iTAG"), -50, 40_000L + it * 200) }
        assertNull(b.relinkCandidate(41_000), "a fixed address is never swapped for another tag")
    }

    @Test fun `a held connection keeps mine heard, with RSSI and battery`() {
        val b = TagBook()
        repeat(4) { b.heard(addr, named("iTAG"), -45, it * 200L) }
        b.bind(b.get(addr)!!, "Kulcs", 800)
        val w = LeftBehind(afterMs = 30_000)
        w.arm(800)
        for (t in 2_000L..120_000L step 2_000L) {
            b.heardLinked(addr, -58, t, batteryPct = if (t == 2_000L) 87 else null)
            assertNull(w.tick(b.mine!!.lastSeenAt, t), "linked at $t")
        }
        val m = b.mine!!
        assertEquals(120_000L, m.lastSeenAt)
        assertEquals(87, m.batteryPct)
        assertEquals(Battery.FULL, m.battery)
        assertNotNull(b.get(addr)?.rssi?.value)
        // the link drops: nothing reports in, Ottfelejtés rings after its time
        assertNull(w.tick(m.lastSeenAt, 140_000))
        assertEquals(LeftBehind.Event.LEFT, w.tick(m.lastSeenAt, 150_000))
        assertEquals(87, Mine.decode(m.encode())?.batteryPct)
    }

    @Test fun `heardLinked on an address never scanned creates it`() {
        val b = TagBook()
        val s = b.heardLinked(addr, null, 5)
        assertEquals(TagType.ITAG, s.ad.type)
        assertNull(s.rssi.value)
    }

    @Test fun `ringing an iTag uses Immediate Alert only`() {
        assertEquals(listOf(SoundProtocol.ITAG), SoundProtocol.order(TagType.ITAG, setOf(0xFFE0), lastWorked = SoundProtocol.DULT))
        assertEquals(SoundProtocol.ITAG, SoundProtocol.pick(listOf(SoundProtocol.ITAG),
            listOf("0000180f-0000-1000-8000-00805f9b34fb", "00001802-0000-1000-8000-00805f9b34fb")))
        assertFalse(SoundProtocol.ITAG in SoundProtocol.order(TagType.ACCESSORY, emptySet()), "never tried on a Find My tag")
        assertEquals(0x01, SoundProtocol.ITAG.start.single().toInt())
        assertEquals(0x00, SoundProtocol.ITAG.stop!!.single().toInt())
    }

    @Test fun `battery and button bytes`() {
        assertEquals(96, Itag.battery(byteArrayOf(0x60)))
        assertNull(Itag.battery(byteArrayOf(0x65)), "over 100 is not a percent")
        assertNull(Itag.battery(null))
        assertTrue(Itag.isPress(byteArrayOf(0x01)))
        assertFalse(Itag.isPress(byteArrayOf(0x00)))
        assertFalse(Itag.isPress(ByteArray(0)))
        assertEquals(Battery.CRITICAL, Itag.level(5))
        assertEquals(Battery.LOW, Itag.level(20))
        assertEquals(Battery.UNKNOWN, Itag.level(null))
    }

    @Test fun `telefonkereso rings on a press, stops on the next or by itself`() {
        val f = PhoneFinder(ringMs = 30_000, debounceMs = 400)
        assertEquals(PhoneFinder.Action.RING, f.press(1_000))
        assertNull(f.press(1_200), "a bounce")
        assertTrue(f.ringing)
        assertEquals(PhoneFinder.Action.STOP, f.press(3_000))
        assertFalse(f.ringing)
        assertEquals(PhoneFinder.Action.RING, f.press(10_000))
        assertFalse(f.tick(39_000))
        assertTrue(f.tick(40_000))
        assertFalse(f.tick(41_000), "only once")
        assertEquals(PhoneFinder.Action.RING, f.press(50_000))
        f.stop()
        assertFalse(f.ringing)
    }
}
