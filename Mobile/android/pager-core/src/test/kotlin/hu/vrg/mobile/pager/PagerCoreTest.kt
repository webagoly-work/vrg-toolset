package hu.vrg.mobile.pager

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.security.SecureRandom
import kotlin.math.abs
import kotlin.math.sin
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class PagerCoreTest {
    private val crew = Crew("Villany-01")
    private val t0 = 1_794_960_000_000L

    @Test fun messageSetKeepsThePagersNumbers() {
        assertEquals(14, Messages.ALL.size)
        assertEquals((1..14).toList(), Messages.ALL.map { it.code })
        assertEquals("COME HERE", Messages.byCode(1)!!.en)
        assertEquals("POWER ON", Messages.byCode(5)!!.en)
        assertTrue(Messages.byCode(2)!!.power && Messages.byCode(5)!!.power)
        // Mark I key map: K1 1/4, K2 2/5, K3 3/6
        assertEquals(listOf(1 to 4, 2 to 5, 3 to 6), Key.entries.map { it.short to it.long })
        assertEquals((0..14).toList(), PType.entries.map { it.code })
        // pulse count = key: code 2 is two short pulses, code 5 two long ones
        assertEquals(4, Haptics.forMessage(2).size)
        assertTrue(Haptics.forMessage(5)[1] > Haptics.forMessage(2)[1])
    }

    @Test fun frameIsThePagersEightBytes() {
        val f = Frame(PType.TEXTMSG.code, 4, 3, 0, 77, 2, crew.id)
        val b = f.bytes()
        assertEquals(8, b.size)
        assertEquals(0x5A, b[7].toInt() and 0xFF)
        assertEquals(f, Frame.parse(b))
        assertNull(Frame.parse(b.copyOf(7)))
        assertNull(Frame.parse(b.also { it[7] = 0 }))
    }

    @Test fun crewCodesNormalise() {
        assertEquals("VILLANY-01", Crew(" villany 01 ").code)
        assertEquals(Crew("villany-01").id, crew.id)
        assertEquals("VRG", Crew("").code)
    }

    @Test fun beaconRoundTripAndFitsAnAdvertisement() {
        val bc = Beacon(Flags.LINK or Flags.TALK, 3, Frame(4, 2, 3, 7, 9, 2, crew.id), 81, -61, 0x0081, 7, 5, Beacon.minuteOf(t0))
        val bytes = bc.encode(crew)
        assertEquals(Beacon.SIZE, bytes.size)
        // flags (3) + manufacturer header (4) + payload must fit the 31-byte legacy advertisement
        assertTrue(3 + AdParser.manufacturerAd(bytes).size <= 31)
        val r = Beacon.decode(bytes, crew, t0 + 30_000)
        assertIs<Beacon.Companion.Result.Ok>(r)
        assertEquals(bc, r.beacon)
    }

    @Test fun otherCrewsAndForgeriesAreRefused() {
        val bytes = Beacon(0, 3, Frame(4, 5, 3, 0, 9, 2, crew.id), 50, -59, 0, 0, 0, Beacon.minuteOf(t0)).encode(crew)
        assertIs<Beacon.Companion.Result.OtherCrew>(Beacon.decode(bytes, Crew("MASIK"), t0))
        // flip KAPCSOLD FEL's argument: the MAC no longer matches
        val forged = bytes.copyOf().also { it[5] = 2 }
        assertIs<Beacon.Companion.Result.OtherCrew>(Beacon.decode(forged, crew, t0))
        assertIs<Beacon.Companion.Result.NotOurs>(Beacon.decode(byteArrayOf(1, 2, 3), crew, t0))
    }

    @Test fun aRecordedBeaconCannotBeReplayedLater() {
        val bytes = Beacon(0, 3, Frame(4, 5, 3, 0, 9, 2, crew.id), 50, -59, 0, 0, 0, Beacon.minuteOf(t0)).encode(crew)
        assertIs<Beacon.Companion.Result.Ok>(Beacon.decode(bytes, crew, t0 + 2 * 60_000))
        assertIs<Beacon.Companion.Result.Stale>(Beacon.decode(bytes, crew, t0 + 10 * 60_000))
        // a phone a minute behind is still fine
        assertIs<Beacon.Companion.Result.Ok>(Beacon.decode(bytes, crew, t0 - 60_000))
    }

    @Test fun adParserFindsBothRecordsAndSurvivesJunk() {
        val beacon = Beacon(0, 3, Frame(0, 0, 3, 0, 0, 0, crew.id), 50, -59, 0, 0, 0, 0).encode(crew)
        val name = NameRecord.encode(3, "Kovács Árpád")
        val flags = byteArrayOf(2, 0x01, 0x06)
        val other = byteArrayOf(5, 0xFF.toByte(), 0x4C, 0x00, 1, 2)        // Apple's company id: ignored
        val raw = flags + AdParser.manufacturerAd(beacon) + other + AdParser.manufacturerAd(name) + byteArrayOf(0, 0, 0)
        val found = AdParser.manufacturer(raw)
        assertEquals(2, found.size)
        assertContentEquals(beacon, found[0])
        assertEquals(3 to "Kovács Árpád", NameRecord.decode(found[1]))
        assertEquals(emptyList(), AdParser.manufacturer(byteArrayOf(30, 0xFF.toByte(), 1)))   // truncated
        assertEquals(emptyList(), AdParser.manufacturer(null))
    }

    @Test fun namesAreCutOnCharacterBoundaries() {
        val b = NameRecord.utf8Prefix("ŐŐŐŐŐŐŐŐŐŐŐŐ", 20)
        assertEquals(20, b.size)
        assertEquals("ŐŐŐŐŐŐŐŐŐŐ", String(b, Charsets.UTF_8))
        assertEquals(19, NameRecord.utf8Prefix("a" + "Ő".repeat(12), 20).size)
    }

    @Test fun proximityFiltersAndEstimates() {
        val tr = RssiTrack()
        var t = t0
        // a noisy -71 dBm walk
        listOf(-65, -77, -70, -72, -69, -95, -71, -73).forEach { tr.add(it, t); t += 300 }
        val v = tr.value!!
        assertTrue(abs(v - -71) < 3, "filtered $v")              // the -95 spike is mostly gone
        val d = Proximity.distance(v, -59, Clutter.SITE)
        assertTrue(d in 2.0..5.0, "distance $d")
        assertEquals(Zone.MID, Proximity.zone(d * 2, 1_000))
        assertEquals(Zone.OUT, Proximity.zone(d, Proximity.LOST_MS + 1))
        assertEquals(Zone.NEAR, Proximity.zone(1.0, 0))
        // walking closer: RSSI rises → CLOSER
        repeat(12) { tr.add(-55, t); t += 300 }
        assertEquals(Trend.CLOSER, tr.trend(t))
        assertEquals("~1 m", Proximity.label(1.2))
        assertEquals("~25 m", Proximity.label(23.0))
        assertTrue(Proximity.finderInterval(1.0) < Proximity.finderInterval(10.0))
        assertEquals(-60, Proximity.calibrate(listOf(-60, -61, -59, -60, -62, -58, -60, -60, -75)))
        assertNull(Proximity.calibrate(listOf(-60, -61)))
    }

    @Test fun adpcmKeepsSpeechShapedAudio() {
        val pcm = ShortArray(Adpcm.BLOCK_SAMPLES * 10) { i -> (sin(2 * Math.PI * 440 * i / 8000.0) * 9_000 + sin(2 * Math.PI * 1_300 * i / 8000.0) * 3_000).toInt().toShort() }
        val enc = Adpcm.Encoder()
        var err = 0.0; var sig = 0.0
        for (k in 0 until 10) {
            val block = enc.encode(pcm, k * Adpcm.BLOCK_SAMPLES)
            assertEquals(Adpcm.BLOCK_BYTES, block.size)
            val out = Adpcm.decode(block)!!
            for (i in out.indices) { val s = pcm[k * Adpcm.BLOCK_SAMPLES + i]; err += (out[i] - s).toDouble().let { it * it }; sig += s.toDouble() * s }
        }
        val snr = 10 * kotlin.math.log10(sig / err)
        assertTrue(snr > 15, "SNR $snr dB")
        assertNull(Adpcm.decode(ByteArray(10)))
        assertEquals(960, Adpcm.roger().size)
    }

    @Test fun floorIsHalfDuplex() {
        val f = Floor(holdMs = 700)
        assertTrue(f.free(1, t0))
        assertTrue(f.heard(2, 1, t0))
        assertFalse(f.free(1, t0 + 100))
        assertFalse(f.heard(3, 1, t0 + 200))
        assertTrue(f.free(1, t0 + 1_000))         // talker 2 went quiet
        f.heard(3, 2, t0 + 1_100); f.ended(3)
        assertTrue(f.free(1, t0 + 1_150))
    }

    @Test fun linkCodecRoundTrips() {
        val msgs = listOf(
            LinkMsg.Hello(3, crew.id, ByteArray(8) { it.toByte() }, "Bence"),
            LinkMsg.Auth(ByteArray(16) { 7 }),
            LinkMsg.FrameMsg(Frame(4, 1, 3, 0, 5, 2, crew.id)),
            LinkMsg.Chat(3, 0, 65_000, 3, t0, "Hozd a 2,5-ös kábelt 🙂"),
            LinkMsg.ChatAck(5, 3, 65_000),
            LinkMsg.Voice(3, 12, 400, ByteArray(Adpcm.BLOCK_BYTES) { it.toByte() }),
            LinkMsg.VoiceEnd(3, 12),
        )
        val out = ByteArrayOutputStream()
        msgs.forEach { LinkCodec.write(out, it) }
        val input = ByteArrayInputStream(out.toByteArray())
        val back = generateSequence { LinkCodec.read(input) }.toList()
        assertEquals(msgs.size, back.size)
        msgs.zip(back).forEach { (a, b) ->
            when (a) {
                is LinkMsg.Hello -> { b as LinkMsg.Hello; assertEquals(a.unit, b.unit); assertEquals(a.name, b.name); assertContentEquals(a.nonce, b.nonce) }
                is LinkMsg.Auth -> assertContentEquals(a.proof, (b as LinkMsg.Auth).proof)
                is LinkMsg.Voice -> { b as LinkMsg.Voice; assertEquals(a.n, b.n); assertContentEquals(a.block, b.block) }
                else -> assertEquals(a, b)
            }
        }
    }

    @Test fun linkHandshakeNeedsTheCrewKey() {
        val a = LinkHandshake(crew, 3, "A", SecureRandom())
        val b = LinkHandshake(crew, 5, "B", SecureRandom())
        val authB = a.onHello(b.hello)!!
        val authA = b.onHello(a.hello)!!
        assertTrue(a.onAuth(authA))
        assertTrue(b.onAuth(authB))
        // an impostor who copies the crew id byte but not the key
        val evil = LinkHandshake(Crew("TALALGAT"), 9, "X")
        val forgedHello = evil.hello.copy(crewId = crew.id)
        val c = LinkHandshake(crew, 4, "C")
        val toEvil = c.onHello(forgedHello)!!
        assertNotNull(toEvil)
        assertFalse(c.onAuth(LinkMsg.Auth(ByteArray(16))))
        assertNull(c.onHello(a.hello.copy(unit = 4)))               // same unit as me
    }

    @Test fun guardFollowsThePagersSequence() {
        val g = Guard()
        var t = t0
        val flat = Accel(0f, 0f, 9.81f)
        // moving: arming refused (the loop is open)
        g.sample(Accel(3f, 2f, 9f), t)
        assertIs<Guard.Out.Refused>(g.arm(t).single())
        repeat(50) { t += 100; g.sample(flat, t) }
        assertEquals(GuardState.EXIT, (g.arm(t).single() as Guard.Out.State).s)
        t += g.exitDelayS * 1_000L; g.sample(flat, t)
        assertTrue(g.tick(t).any { it is Guard.Out.State && it.s == GuardState.ARMED })
        // someone lifts it
        t += 100; g.sample(Accel(4f, 1f, 12f), t)
        assertEquals(GuardState.ENTRY, g.state)
        t += Guard.ENTRY_MS
        val outs = g.tick(t)
        assertEquals(GuardState.ALARM, g.state)
        assertTrue(outs.any { it is Guard.Out.Page })
        assertTrue(g.tick(t + 1_000).isEmpty())
        assertTrue(g.tick(t + 2_000).any { it is Guard.Out.Page })            // every 2 s until acknowledged
        g.acknowledged()
        assertTrue(g.tick(t + 4_000).any { it is Guard.Out.Page })            // the one already due
        assertTrue(g.tick(t + 10_000).isEmpty())                             // then every 30 s
        g.partnerOnlyDisarm = true
        assertIs<Guard.Out.Refused>(g.disarm(byPartner = false).single())
        assertEquals(GuardState.OFF, (g.disarm(byPartner = true).single() as Guard.Out.State).s)
    }

    @Test fun manDownPreAlarmsThenPages() {
        val m = ManDown().apply { stillLimitS = 60; preAlarmS = 20 }
        var t = t0
        m.start(t)
        val flat = Accel(0f, 0f, 9.81f)
        repeat(10) { t += 1_000; m.sample(flat, t) }
        assertTrue(m.tick(t).isEmpty())
        t += 55_000
        assertEquals(ManDownState.PRE_ALARM, (m.tick(t).first() as ManDown.Out.State).s)
        // SEEN cancels
        m.cancel(t + 1_000)
        assertEquals(ManDownState.WATCHING, m.state)
        // an impact, then lying still → pre-alarm after 10 s, no 60 s wait
        t += 5_000; m.sample(Accel(25f, 18f, 9f), t)
        repeat(12) { t += 1_000; m.sample(flat, t) }
        assertTrue(m.tick(t).any { it is ManDown.Out.State && it.s == ManDownState.PRE_ALARM })
        t += 20_000
        assertTrue(m.tick(t).any { it is ManDown.Out.Page })
        assertEquals(ManDownState.ALARM, m.state)
    }

    @Test fun manDownMovementCancelsThePreAlarm() {
        val m = ManDown().apply { stillLimitS = 30 }
        var t = t0
        m.start(t); t += 31_000
        m.tick(t)
        assertEquals(ManDownState.PRE_ALARM, m.state)
        m.sample(Accel(0f, 0f, 9.81f), t); t += 50
        m.sample(Accel(5f, 3f, 12f), t)
        assertEquals(ManDownState.WATCHING, m.state)
    }

    @Test fun chatEntriesSurviveJson() {
        val e = ChatEntry(3, 0, 41, t0, "Kész a 3-as kör", mine = true).also { it.acked += 5 }
        val back = ChatEntry.fromJson(e.toJson())
        assertEquals(e, back)
        assertEquals(setOf(5), back.acked)
    }
}
