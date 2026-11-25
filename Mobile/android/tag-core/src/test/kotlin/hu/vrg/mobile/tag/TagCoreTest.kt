package hu.vrg.mobile.tag

import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class TagCoreTest {
    // ---- advertisements as a tag sends them -----------------------------------------------------------------

    private fun key(seed: Int): ByteArray = Random(seed).nextBytes(28)

    /** A separated tag's full advertisement for [key]: the record bytes and the address it must use. */
    private fun separated(key: ByteArray, status: Int = 0x20, hint: Int = 0x00): Pair<ByteArray, String> {
        val payload = byteArrayOf(0x12, 0x19, status.toByte()) + key.copyOfRange(6, 28) +
            byteArrayOf(((key[0].toInt() and 0xFF) shr 6).toByte(), hint.toByte())
        val mfg = byteArrayOf(0x4C, 0x00) + payload
        val raw = byteArrayOf(0x02, 0x01, 0x06) + byteArrayOf((mfg.size + 1).toByte(), 0xFF.toByte()) + mfg
        return raw to FindMy.addressFor(key)
    }

    private fun nearOwner(status: Int): ByteArray =
        byteArrayOf(0x07, 0xFF.toByte(), 0x4C, 0x00, 0x12, 0x02, status.toByte(), 0x01)

    private val pairingList = byteArrayOf(0x02, 0x01, 0x06, 0x03, 0x03, 0x44, 0xFD.toByte())
    private val pairingData = byteArrayOf(0x05, 0x16, 0x44, 0xFD.toByte(), 0x01, 0x02)

    @Test fun `a separated tag's advertisement gives back its whole key`() {
        val k = key(1)
        val (raw, address) = separated(k, status = 0x20 or 0x80, hint = 0x5A)
        val ad = assertNotNull(FindMy.parse(raw, address))
        assertEquals(AdKind.SEPARATED, ad.kind)
        assertEquals(TagType.ACCESSORY, ad.type, "status bits 4-5 = 2: a Find My accessory such as the ISYTag")
        assertEquals(Battery.LOW, ad.battery)
        assertEquals(0x5A, ad.hint)
        val got = assertNotNull(ad.key)
        assertContentEquals(k, got)
        assertEquals(FindMy.addressFor(got), address)
        assertEquals("%02X%02X%02X%02X".format(k[0].toInt() and 0xFF, k[1].toInt() and 0xFF, k[2].toInt() and 0xFF, k[3].toInt() and 0xFF), ad.keyTag)
    }

    @Test fun `the address carries the key's first six bytes with the top two bits set`() {
        val k = ByteArray(28) { it.toByte() }
        k[0] = 0x12
        assertEquals("D2:01:02:03:04:05", FindMy.addressFor(k))
        assertNull(FindMy.addressBytes("D2:01:02"))
        assertNull(FindMy.addressBytes("D2:01:02:03:04:ZZ"))
        assertNull(FindMy.parse(separated(k).first, null)?.key, "no address, no key")
    }

    @Test fun `near its owner a tag sends the short form`() {
        val ad = assertNotNull(FindMy.parse(nearOwner(0x10 or 0x40), "C1:00:00:00:00:01"))
        assertEquals(AdKind.NEAR_OWNER, ad.kind)
        assertEquals(TagType.AIRTAG, ad.type)
        assertEquals(Battery.MEDIUM, ad.battery)
        assertNull(ad.key)
    }

    @Test fun `an unpaired tag shows the Find My service`() {
        assertEquals(AdKind.PAIRING, FindMy.parse(pairingList, "11:22:33:44:55:66")?.kind)
        assertEquals(AdKind.PAIRING, FindMy.parse(pairingData, "11:22:33:44:55:66")?.kind)
        assertTrue(FindMy.UUID16_FINDMY in FindMy.uuid16s(pairingList))
        assertEquals(AdKind.DULT, FindMy.parse(byteArrayOf(0x04, 0x16, 0xB2.toByte(), 0xFC.toByte(), 0x00), null)?.kind)
        assertEquals("0000FD44-0000-1000-8000-00805F9B34FB", FindMy.uuid128(0xFD44))
    }

    @Test fun `other advertisements are not tags`() {
        val iBeacon = byteArrayOf(0x1A, 0xFF.toByte(), 0x4C, 0x00, 0x02, 0x15) + ByteArray(21)
        assertNull(FindMy.parse(iBeacon, null))
        assertNull(FindMy.parse(byteArrayOf(0x05, 0xFF.toByte(), 0xFF.toByte(), 0xFF.toByte(), 0x56, 0x50), null), "Csipogó's own beacon")
        assertNull(FindMy.parse(ByteArray(0), null))
        val r = Random(7)
        repeat(2_000) { FindMy.parse(r.nextBytes(r.nextInt(0, 62)), "C0:00:00:00:00:00") }   // never throws
    }

    @Test fun `apple's offline finding record is found among several apple records`() {
        val other = byteArrayOf(0x05, 0xFF.toByte(), 0x4C, 0x00, 0x10, 0x01)
        assertEquals(AdKind.NEAR_OWNER, FindMy.parse(other + nearOwner(0x00), "C1:00:00:00:00:01")?.kind)
    }

    @Test fun `status byte`() {
        assertEquals(TagType.APPLE_DEVICE, TagType.of(0x00))
        assertEquals(TagType.OTHER, TagType.of(0x30))
        assertEquals(Battery.FULL, Battery.of(0x20))
        assertEquals(Battery.CRITICAL, Battery.of(0xC0))
    }

    // ---- ringing --------------------------------------------------------------------------------------------

    @Test fun `ring protocols, their bytes and their order`() {
        assertContentEquals(byteArrayOf(0x00, 0x03), SoundProtocol.DULT.start, "Sound_Start 0x0300, little-endian")
        assertContentEquals(byteArrayOf(0x01, 0x03), SoundProtocol.DULT.stop)
        assertEquals(listOf(SoundProtocol.DULT, SoundProtocol.FINDMY, SoundProtocol.AIRTAG), SoundProtocol.order(TagType.ACCESSORY, emptySet()))
        assertEquals(SoundProtocol.AIRTAG, SoundProtocol.order(TagType.AIRTAG, emptySet()).first())
        assertEquals(SoundProtocol.FINDMY, SoundProtocol.order(TagType.ACCESSORY, setOf(0xFD44)).first())
        assertEquals(SoundProtocol.AIRTAG, SoundProtocol.order(TagType.ACCESSORY, setOf(0xFD44), lastWorked = SoundProtocol.AIRTAG).first())
        assertEquals(3, SoundProtocol.order(TagType.ACCESSORY, setOf(0xFD44), SoundProtocol.FINDMY).size)

        val discovered = listOf("00001800-0000-1000-8000-00805f9b34fb", "0000fd44-0000-1000-8000-00805f9b34fb")
        assertEquals(SoundProtocol.FINDMY, SoundProtocol.pick(SoundProtocol.DEFAULT, discovered))
        assertEquals(SoundProtocol.DULT, SoundProtocol.pick(SoundProtocol.DEFAULT, discovered + "15190001-12f4-c226-88ed-2ac5579f2a85"))
        assertNull(SoundProtocol.pick(SoundProtocol.DEFAULT, listOf("0000180f-0000-1000-8000-00805f9b34fb")))
        assertFalse(SoundProtocol.FINDMY.matchesService("1234fd44-0000-1000-8000-00805f9b34fb"))
    }

    // ---- the book: bind, follow, relink ---------------------------------------------------------------------

    private fun hear(b: TagBook, raw: ByteArray, addr: String, rssi: Int, from: Long, times: Int = 4) =
        (0 until times).forEach { b.heard(addr, raw, rssi, from + it * 200L) }

    @Test fun `ez az enyem takes the tag held against the phone, and only a clear one`() {
        val (ra, a) = separated(key(1)); val (rb, bAddr) = separated(key(2))
        val b = TagBook()
        assertIs<BindPick.None>(b.bindPick(0))
        hear(b, rb, bAddr, -78, 0)
        assertIs<BindPick.TooFar>(b.bindPick(800))
        hear(b, ra, a, -50, 1_000)
        val ok = assertIs<BindPick.Ok>(b.bindPick(1_800))
        assertEquals(a, ok.seen.address)
        hear(b, rb, bAddr, -53, 2_000, 8)
        assertIs<BindPick.Ambiguous>(b.bindPick(3_600))
        assertTrue(TagText.bindHint(b.bindPick(3_600)).contains("távolabb"))
    }

    @Test fun `after a key rotation the one new tag of its kind is followed`() {
        val (ra, a) = separated(key(1)); val (rb, bAddr) = separated(key(2)); val (rc, c) = separated(key(3))
        val b = TagBook()
        hear(b, ra, a, -45, 0)
        hear(b, rb, bAddr, -80, 0)
        val mine = b.bind(assertIs<BindPick.Ok>(b.bindPick(800)).seen, "ISYTag", 800)
        assertEquals("ISYTag", mine.name)
        assertTrue(b.isBackground(bAddr), "heard together with mine at bind time")

        // a stranger's tag comes by while mine is still talking, then mine rotates its address at t = 60 s
        hear(b, rb, bAddr, -70, 30_000)
        hear(b, ra, a, -60, 59_000, 2)
        hear(b, rc, c, -61, 61_000, 3)
        hear(b, rb, bAddr, -75, 61_000, 2)
        assertNull(b.relinkCandidate(70_000), "too soon: mine was heard 11 s ago")
        hear(b, rc, c, -61, 80_000, 2)
        hear(b, rb, bAddr, -75, 80_000, 2)
        assertEquals(c, b.relinkCandidate(81_000)?.address, "the stranger was heard with mine, the new one was not")
        assertTrue(b.relink(81_000))
        val now = assertNotNull(b.mine)
        assertEquals(c, now.address)
        assertTrue(now.guessed)
        assertEquals(listOf(a), now.pastAddresses)
        assertEquals(a to c, b.lastRelink)
        b.confirm()
        assertFalse(b.mine!!.guessed)
    }

    @Test fun `no relink when it is not clear`() {
        val (ra, a) = separated(key(1)); val (rc, c) = separated(key(3), status = 0x20)
        val (rd, d) = separated(key(4), status = 0x20)
        val b = TagBook()
        hear(b, ra, a, -45, 0)
        b.bind(b.get(a)!!, "x", 800)
        hear(b, rc, c, -60, 30_000); hear(b, rd, d, -60, 30_000)
        assertNull(b.relinkCandidate(31_000), "two new tags: either could be it")

        val b2 = TagBook()
        hear(b2, ra, a, -45, 0)
        b2.bind(b2.get(a)!!, "x", 800)
        val (re, e) = separated(key(5), status = 0x20 or 0xC0)
        hear(b2, re, e, -60, 30_000)
        assertNull(b2.relinkCandidate(31_000), "battery level differs")

        val b3 = TagBook()
        hear(b3, pairingList, "11:22:33:44:55:66", -45, 0)
        b3.bind(b3.get("11:22:33:44:55:66")!!, "x", 800)
        hear(b3, rc, c, -60, 30_000)
        assertNull(b3.relinkCandidate(31_000), "a tag in pairing mode keeps its address: nothing to follow")
    }

    @Test fun `mine is remembered across restarts`() {
        val m = Mine("ISY\nTag", "D2:01:02:03:04:05", TagType.ACCESSORY, AdKind.SEPARATED, 123, tx1m = -58,
            battery = Battery.LOW, sound = SoundProtocol.FINDMY, pastAddresses = listOf("C0:00:00:00:00:01"),
            guessed = true, lastSeenAt = 456, lastLat = 47.5, lastLon = 19.04, lastAccM = 12f)
        val back = assertNotNull(Mine.decode(m.encode()))
        assertEquals(m.copy(name = "ISY Tag"), back)
        assertNull(Mine.decode(null))
        assertNull(Mine.decode("name=x\naddress=nope"))
        assertEquals(TAG_TX1M, Mine.decode("address=C0:00:00:00:00:01\ntx1m=5")?.tx1m)
    }

    @Test fun `forgetting and pruning`() {
        val (ra, a) = separated(key(1)); val (rb, bAddr) = separated(key(2))
        val b = TagBook()
        hear(b, ra, a, -45, 0); hear(b, rb, bAddr, -80, 0)
        b.bind(b.get(a)!!, "x", 800)
        b.prune(FORGET_MS + 10_000)
        assertNotNull(b.get(a), "mine stays")
        assertNull(b.get(bAddr))
        b.forget()
        assertNull(b.mine)
        assertFalse(b.isBackground(bAddr))
    }

    @Test fun `around lists what is heard now first, nearest first`() {
        val (ra, a) = separated(key(1)); val (rb, bAddr) = separated(key(2)); val (rc, c) = separated(key(3))
        val b = TagBook()
        hear(b, rc, c, -40, 0, 1)
        hear(b, ra, a, -70, 20_000); hear(b, rb, bAddr, -50, 20_000)
        assertEquals(listOf(bAddr, a, c), b.around(21_000).map { it.address })
    }

    // ---- left behind ----------------------------------------------------------------------------------------

    @Test fun `left behind rings once when it goes quiet and once when it is back`() {
        val w = LeftBehind(afterMs = 60_000)
        assertNull(w.tick(0, 100_000), "off")
        w.arm(0)
        assertNull(w.tick(10_000, 50_000))
        assertNull(w.tick(10_000, 69_000))
        assertEquals(LeftBehind.Event.LEFT, w.tick(10_000, 70_000))
        assertEquals(LeftBehind.State.MISSING, w.state)
        assertNull(w.tick(10_000, 90_000))
        assertEquals(LeftBehind.Event.BACK, w.tick(119_000, 120_000))
        assertNull(w.tick(121_000, 121_500))
        w.disarm()
        assertEquals(LeftBehind.State.OFF, w.state)
    }

    @Test fun `arming without ever hearing the tag still counts from the arming`() {
        val w = LeftBehind(afterMs = 30_000)
        w.arm(1_000_000)
        assertNull(w.tick(0, 1_020_000))
        assertEquals(LeftBehind.Event.LEFT, w.tick(0, 1_031_000))
    }

    @Test fun `ago`() {
        assertEquals("most", TagText.ago(1_000))
        assertEquals("12 mp", TagText.ago(12_000))
        assertEquals("4 perce", TagText.ago(4 * 60_000L))
        assertEquals("2 órája", TagText.ago(2 * 3_600_000L))
        assertEquals("3 napja", TagText.ago(3 * 86_400_000L))
    }
}
