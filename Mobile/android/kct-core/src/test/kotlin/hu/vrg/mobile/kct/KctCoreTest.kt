package hu.vrg.mobile.kct

import java.io.File
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// WP M65 Q0: the codec against the 2026-11-22 capture (q71-capture-b.txt: the 18A0 ATT values in order, the weather
// place replaced by "dummyplace", no notification text). Every frame decodes, and re-encodes byte-exact.
class KctCoreTest {

    private class Line(val dir: String, val handle: String, val bytes: ByteArray)

    private val lines: List<Line> = javaClass.getResource("/q71-capture-b.txt")!!.readText().lines()
        .filter { it.isNotBlank() && !it.startsWith("#") }
        .map { val p = it.split(' '); Line(p[0], p[1], hex(p.getOrElse(2) { "" })) }

    private fun hex(s: String) = ByteArray(s.length / 2) { s.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
    private fun hexOf(b: ByteArray) = b.joinToString("") { "%02x".format(it) }

    private val phone get() = lines.filter { it.dir == "P>W" && it.handle == "0107" }
    private val watchReads get() = lines.filter { it.dir == "W>P" && it.handle == "0105" }

    private fun watchFrames(): List<Decoded> { val r = Reassembler(); return watchReads.flatMap { r.push(it.bytes) } }

    @Test fun keyIsMediaTeksDefault() {
        assertEquals(130, Frame.KEY.size)
        assertEquals(0, Frame.KEY.last().toInt())
    }

    @Test fun everyPhoneFrameRoundTripsByteExact() {
        assertEquals(23, phone.size)
        phone.forEach { l ->
            val d = assertNotNull(Frame.decode(l.bytes), hexOf(l.bytes))
            assertContentEquals(l.bytes, Frame.encode(d.header, d.payload), d.header)
            assertEquals(Frame.payloadLength(d.header), d.payload.size, d.header)
        }
    }

    @Test fun watchReadsReassembleIntoWholeFramesAndRoundTrip() {
        val frames = watchFrames()
        // multi-read GET,0 and SEND,100, and reads that end one frame and start the next, glue into 26 frames
        assertEquals(listOf("VERN 3", "ACKY 92", "MREE 18", "EXCD 43", "EXCD 208"), frames.take(5).map { it.header })
        assertEquals(26, frames.size)
        val stream = watchReads.fold(ByteArray(0)) { a, l -> a + l.bytes }
        val again = frames.fold(ByteArray(0)) { a, d -> a + Frame.encode(d.header, d.payload) }
        assertContentEquals(stream, again, "the whole watch → phone stream re-encodes byte-exact")
    }

    @Test fun reassemblerSurvivesOneByteReads() {
        val r = Reassembler()
        val all = watchReads.fold(ByteArray(0)) { a, l -> a + l.bytes }
        val frames = all.flatMap { r.push(byteArrayOf(it)) }
        assertEquals(26, frames.size)
        assertEquals(0, r.pending)
    }

    @Test fun reassemblerResyncsAfterJunk() {
        val r = Reassembler()
        val f = Kct.cmd("GET,0")
        val got = r.push(byteArrayOf(1, 2, 3, 0xF0.toByte(), 9) + f)
        assertEquals(1, got.size)
        assertEquals("GET,0", got[0].text)
        assertTrue(r.dropped > 0)
    }

    @Test fun buildersMatchFunDosFrames() {
        val p = phone.map { it.bytes }
        assertContentEquals(p[0], Kct.syncRequest())
        assertContentEquals(p[1], Kct.syncTime(1795341812, 3_600_000))
        assertTrue(p.any { it.contentEquals(Kct.deviceInfo()) }, "GET,0")
        assertTrue(p.any { it.contentEquals(Kct.todaySteps()) }, "GET,10")
        assertTrue(p.any { it.contentEquals(Kct.setTime(1795341813, 3_600_000)) }, "SET,45")
        assertTrue(p.any { it.contentEquals(Kct.ret("GET,10")) }, "RET,GET,10")
        assertTrue(p.any { it.contentEquals(Kct.ret("SET,43,1")) }, "RET,SET,43,1")
        assertTrue(p.any { it.contentEquals(Kct.ret("SET,14,1")) }, "RET,SET,14,1")
        val weather = p.map { Frame.decode(it)!!.text }.first { it.startsWith("WEATHER;d") }
        assertTrue(weather.startsWith("WEATHER;dummyplace;0,2026-11-22"), "the fixture is redacted")
    }

    @Test fun repliesParse() {
        val bodies = watchFrames().mapNotNull { Kct.body(it) }
        assertEquals("RET,SET,15", bodies[0])
        val info = assertIs<Msg.Info>(Kct.parse(bodies.first { it.startsWith("GET,0,") })).info
        assertEquals("XT2002D_AB024_Q71_T6_B_2104_V0.1_2111261102", info.firmware)
        assertEquals("64:C0:F9:A2:62:61", info.mac)
        assertEquals(240, info.width); assertEquals(240, info.height)
        assertEquals(10000, info.stepGoal); assertEquals(170, info.heightCm); assertEquals(60, info.weightKg)
        assertEquals(100, info.batteryGuess)
        val today = assertIs<Msg.Today>(Kct.parse(bodies.first { it.startsWith("GET,10,") })).steps
        assertEquals("2026-11-22", today.day); assertEquals(0, today.steps)
        assertEquals(Msg.FindPhone(true), Kct.parse("SET,40,1"))
        assertEquals(Msg.FindPhone(false), Kct.parse("SET,40,0"))
        assertEquals(Msg.Ret("SET", 15, emptyList()), Kct.parse("RET,SET,15"))
        assertIs<Msg.Measure>(Kct.parse(bodies.first { it.startsWith("SEND,101") }))
        assertEquals(Msg.Ret("WEATHER", null, listOf("OK")), Kct.parse("WEATHER,OK"))
    }

    @Test fun ackyCarriesTheWatchsAddresses() {
        val a = assertNotNull(Acky.parse(watchFrames()[1]))
        assertEquals("64:C0:F9:A2:62:61", a.classic)
        assertEquals("CB:1C:7F:39:DD:60", a.le)
        assertEquals("Q71", a.name)
    }

    @Test fun repliesFollowFunDo() {
        assertContentEquals(Kct.ret("SET,43,1"), Kct.replyTo(Kct.parse("SET,43,1")))
        assertNull(Kct.replyTo(Kct.parse("SET,43,2")))
        assertContentEquals(Kct.ret("SET,14,1"), Kct.replyTo(Kct.parse("SET,14,0")))
        assertNull(Kct.replyTo(Kct.parse("SET,40,1")))
        assertNull(Kct.replyTo(Kct.parse("RET,SET,15")))
    }

    @Test fun timeZoneText() {
        assertEquals("+01.0", Kct.tzText(3_600_000))
        assertEquals("+02.0", Kct.tzText(7_200_000))
        assertEquals("-03.5", Kct.tzText(-12_600_000))
        assertEquals("+00.0", Kct.tzText(0))
    }

    @Test fun safetyGateBlocksInstallers() {
        assertTrue(Kct.isSafe(Kct.deviceInfo()))
        assertTrue(Kct.isSafe(Kct.syncRequest()))
        assertFalse(Kct.isSafe(Frame.encode("MREE mre_installer smartwatch 9 0 5 ", "9 cta")))
        assertFalse(Kct.isSafe(Frame.encode("MREE yahooweather yahooweather 1 0 0 ")))
        assertFalse(Kct.isSafe(Kct.cmd("OTA,1")))
        phone.map { Frame.decode(it.bytes)!! }.filter { it.type == "MREE" }.forEach { assertFalse(Kct.isSafe(Frame.encode(it.header, it.payload))) }
    }

    @Test fun attChunksSplitAndRejoin() {
        val f = SetNew.blocks(ByteArray(5000) { it.toByte() })[0].frame()
        val parts = f.attChunks(517)
        assertTrue(parts.all { it.size <= 512 })
        assertContentEquals(f, parts.fold(ByteArray(0)) { a, b -> a + b })
        val r = Reassembler()
        val got = parts.flatMap { r.push(it) }
        assertEquals(1, got.size)
        assertContentEquals(f, Frame.encode(got[0].header, got[0].payload))
    }

    @Test fun setNewBlocksAsCaptured() {
        // the captured face: 209 128 B → 52 blocks, the last 232 B; CRC32(4096 × 00) = -954466287 (PROTOCOL notes)
        val b = SetNew.blocks(ByteArray(209_128))
        assertEquals(52, b.size)
        assertEquals(232, b.last().data.size)
        assertEquals(-954466287, b[0].crc)
        assertEquals("SETNEW,1,209128,", SetNew.start(209_128))
        val head = String(b[0].payload(), 0, 30, Charsets.ISO_8859_1)
        assertEquals("SETNEW,2,52,1,4096,-954466287,", head)
        assertEquals("EXCD KCT_PEDOMETER kct_pedometer 0 0 4126 ", Frame.decode(b[0].frame())!!.header)
        assertEquals(0xCBF43926L, Crc32.of("123456789".toByteArray()))
        assertEquals(4096, SetNew.acceptedBlockSize(Kct.parse("RET,SETNEW,1,4096,1")))
        assertNull(SetNew.acceptedBlockSize(Kct.parse("RET,SETNEW,1,4096,0")))
        assertEquals(7, SetNew.ackedBlock(Kct.parse("RET,SETNEW,2,52,7,1")))
    }

    @Test fun notificationXmlIsSafe() {
        val x = NotifyXml.build(1, "A&B <app>", "x.y", "cím ]]> vége", "szöveg", 1795341813)
        assertTrue("<sender>A&amp;B &lt;app&gt;</sender>" in x)
        assertTrue("<![CDATA[cím ]]]]><![CDATA[> vége]]>" in x)
        val d = Frame.decode(NotifyXml.frame(x))!!
        assertEquals("DATA ${x.toByteArray().size}", d.header)
        assertEquals(x, d.text)
    }

    // ---- the watch-face .bin -----------------------------------------------------------------------------------

    private fun img(w: Int, h: Int, seed: Int) = Dial.Image(w, h, ByteArray(w * h * 2) { (it * 7 + seed).toByte() })

    private fun sampleFace(): Dial.Face {
        val digits = (0..9).map { img(24, 40, it) }
        return Dial.Face(0x6dfafce3.toInt() xor 0x1234, 240, 240, listOf(
            Dial.Element(0x0001, 4, 40, 40, 1, listOf(img(16, 16, 1))),
            Dial.Element(0x0002, 4, 0, 0, 2, listOf(img(24, 24, 2))),
            Dial.Element(0x0004, 4, 150, 40, 3, listOf(img(6, 40, 3))),
            Dial.Element(0x0814, 2, 96, 40, 4, digits),
            Dial.Element(0x0816, 2, 160, 40, 4, digits),
            Dial.Element(0x0811, 2, 140, 90, 5, (0..13).map { img(38, 17, it) }),
            Dial.Element(0x0810, 2, 186, 92, 6, (0..10).map { img(12, 14, it) }),
        ))
    }

    @Test fun dialWriteReadWriteIsByteExact() {
        val bin = Dial.write(sampleFace())
        val face = Dial.read(bin)
        assertEquals(7, face.elements.size)
        assertEquals(240, face.width)
        assertEquals(listOf(Dial.Kind.PREVIEW, Dial.Kind.BACKGROUND, Dial.Kind.STATIC, Dial.Kind.HOUR, Dial.Kind.MINUTE,
            Dial.Kind.WEEKDAY, Dial.Kind.DAY), face.elements.map { it.kind })
        assertEquals(face.elements[3].share, face.elements[4].share, "hour and minute share their digits")
        assertEquals(bin.size, Dial.u32(bin, 8))
        assertContentEquals(bin, Dial.write(face))
    }

    /** Only on the PC with the captured face (never in the repo): Q71_FACE=…\watchface-pushed.bin gradlew :kct-core:test */
    @Test fun capturedFaceReadsAndWritesByteExactWhenPresent() {
        val path = System.getenv("Q71_FACE") ?: return
        val bin = File(path).takeIf { it.isFile }?.readBytes() ?: return
        val face = Dial.read(bin)
        assertEquals(7, face.elements.size)
        assertContentEquals(bin, Dial.write(face))
    }
}
