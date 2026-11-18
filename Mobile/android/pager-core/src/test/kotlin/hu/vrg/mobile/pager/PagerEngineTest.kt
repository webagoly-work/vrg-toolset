package hu.vrg.mobile.pager

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * A crew of simulated phones on a simulated air: every 100 ms each phone's beacon reaches the phones in range with
 * the RSSI of that pair, and open links carry the engines' Send effects. What the tests check is what the person on
 * site sees: the message arrives, the sender's status goes green then blue, the stairwell phone carries it, etc.
 */
class PagerEngineTest {
    private val crew = Crew("TESZT")
    private val t0 = 1_794_960_000_000L

    private class Phone(val e: PagerEngine) {
        val fx = ArrayList<Effect>()
        fun drain() { fx += e.drain() }
        inline fun <reified T : Effect> has(): Boolean = fx.any { it is T }
    }

    private inner class Air(vararg names: Pair<Int, String>) {
        val phones = names.associate { (u, n) -> u to Phone(PagerEngine(Me(u, n, crew))) }
        val rssi = mutableMapOf<Pair<Int, Int>, Int>()           // (from, to) → dBm; absent = out of range
        val links = mutableSetOf<Pair<Int, Int>>()
        var t = t0

        fun range(a: Int, b: Int, dbm: Int) { rssi[a to b] = dbm; rssi[b to a] = dbm }
        fun cut(a: Int, b: Int) { rssi.remove(a to b); rssi.remove(b to a) }
        fun link(a: Int, b: Int) { links += a to b; links += b to a; phones[a]!!.e.linkUp(b, "", t); phones[b]!!.e.linkUp(a, "", t) }
        fun p(u: Int) = phones[u]!!

        fun step(ms: Long = 100) {
            t += ms
            for ((u, ph) in phones) {
                val raw = byteArrayOf(2, 1, 6) + AdParser.manufacturerAd(ph.e.beacon(t)) + AdParser.manufacturerAd(ph.e.nameRecord())
                for ((v, other) in phones) if (v != u) rssi[u to v]?.let { other.e.onAdvert(raw, it, t) }
            }
            phones.values.forEach { it.e.tick(t) }
            // link traffic: deliver every Send to the linked phones (one hop per step, like a real socket)
            repeat(3) {
                for ((u, ph) in phones) {
                    val out = ph.e.drain()
                    ph.fx += out
                    out.filterIsInstance<Effect.Send>().forEach { s ->
                        for ((v, other) in phones) if ((u to v) in links && (s.to == null || s.to == v)) other.e.onLink(s.msg, u, t)
                    }
                }
            }
        }

        fun run(ms: Long) { var left = ms; while (left > 0) { step(); left -= 100 } }
    }

    @Test fun aMessageIsDeliveredThenSeen() {
        val air = Air(1 to "Bence", 2 to "Dóri")
        air.range(1, 2, -70)
        air.run(1_000)
        assertEquals("Dóri", air.p(1).e.peers(air.t).single().name)       // the scan response carried the name
        val out = air.p(1).e.sendMessage(1, 2, air.t)
        air.run(1_500)
        assertEquals(SendStatus.DELIVERED, out.status)
        val inc = air.p(2).e.unseen().single()
        assertEquals("GYERE IDE", inc.label)
        assertTrue(air.p(2).fx.any { it is Effect.Haptic && it.pattern.contentEquals(Haptics.forMessage(1)) })
        assertTrue(air.p(2).fx.any { it is Effect.Notify })
        // Dóri presses SEEN → Bence's status turns blue
        air.p(2).e.seen(air.t)
        air.run(1_500)
        assertEquals(SendStatus.SEEN, out.status)
        assertTrue(air.p(2).e.unseen().isEmpty())
        assertTrue(air.p(1).fx.any { it is Effect.Haptic && it.pattern.contentEquals(Haptics.SEEN_BACK) })
    }

    @Test fun nobodyThereIsNoReply() {
        val air = Air(1 to "Bence", 2 to "Dóri")
        val out = air.p(1).e.sendMessage(4, 2, air.t)
        air.run(PagerEngine.SEND_WINDOW_MS + 500)
        assertEquals(SendStatus.NO_REPLY, out.status)
        assertTrue(air.p(1).fx.any { it is Effect.Haptic && it.pattern.contentEquals(Haptics.NO_REPLY) })
    }

    @Test fun anAllCallCountsEachReceiver() {
        val air = Air(1 to "Bence", 2 to "Dóri", 3 to "Gergő")
        air.range(1, 2, -65); air.range(1, 3, -72); air.range(2, 3, -60)
        air.run(1_000)
        val out = air.p(1).e.sendMessage(12, BROADCAST, air.t)
        air.run(2_000)
        assertEquals(setOf(2, 3), out.acked)
        assertEquals(SendStatus.DELIVERED, out.status)
        assertEquals(1, air.p(2).e.unseen().size)
        assertEquals(1, air.p(3).e.unseen().size)
    }

    @Test fun callBuzzesWhileHeldAndStopsAfter() {
        val air = Air(1 to "Bence", 2 to "Dóri")
        air.range(1, 2, -70)
        air.run(600)
        air.p(1).e.holdStart(2, air.t)
        air.run(800)
        assertTrue(air.p(2).e.callers(air.t).contains(1))
        assertTrue(air.p(2).fx.any { it is Effect.Haptic && it.repeat })
        air.run(3_000)                                  // still held: still calling
        assertTrue(air.p(2).e.callers(air.t).contains(1))
        air.p(1).e.holdStop(air.t)
        air.run(2_000)
        assertTrue(air.p(2).e.callers(air.t).isEmpty())
        assertTrue(air.p(2).fx.any { it is Effect.Quiet })
    }

    @Test fun theStairwellPhoneCarriesAMessageAcrossFloors() {
        // Bence in the basement, Dóri on the second floor: no direct path; the repeater phone in the stairwell hears both
        val air = Air(1 to "Bence", 2 to "Dóri", 9 to "Lépcső")
        air.range(1, 9, -84); air.range(9, 2, -86)
        air.p(9).e.repeater = true
        air.run(1_000)
        val out = air.p(1).e.sendMessage(1, 2, air.t)
        air.run(4_000)
        val inc = air.p(2).e.unseen().singleOrNull()
        assertNotNull(inc, "relayed message arrived")
        assertTrue(inc.relayed)
        // the receipt came back the same way (GOTIT as a relayed event)
        assertTrue(2 in out.acked, "acked by ${out.acked}")
        // Bence sees Dóri as "heard through a relay", not as a distance
        val dori = air.p(1).e.peers(air.t).first { it.unit == 2 }
        assertTrue(dori.viaRelay)
        assertEquals(Zone.EDGE, dori.zone)
    }

    @Test fun aStrangerCrewIsCountedNotShown() {
        val air = Air(1 to "Bence")
        val stranger = PagerEngine(Me(5, "Idegen", Crew("MASIK")))
        air.step()
        air.p(1).e.onBeacon(stranger.beacon(air.t), -60, air.t)
        assertTrue(air.p(1).e.peers(air.t).isEmpty())
        assertEquals(1, air.p(1).e.otherCrews)
    }

    @Test fun sameUnitNumberIsReported() {
        val air = Air(1 to "Bence")
        val twin = PagerEngine(Me(1, "Másik Bence", crew))
        air.p(1).e.onBeacon(twin.beacon(air.t), -60, air.t)
        assertTrue(air.p(1).e.unitClash)
    }

    @Test fun rollCallAndPing() {
        val air = Air(1 to "Bence", 2 to "Dóri", 3 to "Gergő")
        air.range(1, 2, -65); air.range(1, 3, -75)
        air.p(2).e.battery = 64; air.p(3).e.battery = 12
        air.run(1_000)
        air.p(1).e.rollCall(air.t)
        air.run(3_000)
        assertEquals(mapOf(2 to 64, 3 to 12), air.p(1).e.rollCallResult(air.t))
        val ping = air.p(1).e.ping(2, air.t)
        air.run(1_500)
        assertEquals(SendStatus.DELIVERED, ping.status)
        assertTrue(air.p(1).fx.any { it is Effect.Banner && it.text.startsWith("LINK OK") })
        // Gergő's 12 % made his phone send GYENGE AKKU to everyone on its own
        assertTrue(air.p(1).e.incoming().any { it.frame.src == 3 && it.frame.arg == 14 })
    }

    @Test fun guardAlarmReachesTheCrewAndPartnerDisarms() {
        val air = Air(1 to "Bence", 2 to "Láda")
        air.range(1, 2, -70)
        val flat = Accel(0f, 0f, 9.81f)
        repeat(40) { air.p(2).e.sensor(flat, air.t); air.step() }
        air.p(2).e.guard.exitDelayS = 5
        air.p(2).e.guardArm(air.t)
        repeat(60) { air.p(2).e.sensor(flat, air.t); air.step() }
        assertEquals(GuardState.ARMED, air.p(2).e.guard.state)
        assertTrue(air.p(1).e.peers(air.t).single().armed)
        air.p(2).e.sensor(Accel(5f, 3f, 13f), air.t)                // the toolbox is opened
        air.run(Guard.ENTRY_MS + 1_500)
        assertEquals(GuardState.ALARM, air.p(2).e.guard.state)
        val alarm = air.p(1).e.unseen().first { it.frame.ptype == PType.ALARM }
        assertEquals(AlarmReason.MOTION.code, alarm.frame.arg)
        assertTrue(air.p(1).fx.any { it is Effect.Tone && it.sound == Sound.ALARM })
        // Bence disarms the box from his phone (PARTNER-ONLY DISARM style)
        air.p(1).e.remoteGuard(2, on = false, now = air.t)
        air.run(1_500)
        assertEquals(GuardState.OFF, air.p(2).e.guard.state)
    }

    @Test fun manDownAlarmAndTheAllClear() {
        val air = Air(1 to "Bence", 2 to "Dóri")
        air.range(1, 2, -70)
        air.p(2).e.manDown.stillLimitS = 20; air.p(2).e.manDown.preAlarmS = 5
        air.p(2).e.setManDown(true, air.t)
        air.run(21_000)
        assertEquals(ManDownState.PRE_ALARM, air.p(2).e.manDown.state)
        assertTrue(air.p(1).e.unseen().isEmpty())                  // only her own phone knows yet
        air.run(6_000)
        assertEquals(ManDownState.ALARM, air.p(2).e.manDown.state)
        assertTrue(air.p(1).e.unseen().any { it.frame.arg == AlarmReason.MAN_DOWN.code })
        // she was fine: SEEN on her phone clears it for the crew too
        air.p(2).e.seen(air.t)
        air.run(1_500)
        assertTrue(air.p(1).e.unseen().none { it.frame.ptype == PType.ALARM })
    }

    @Test fun chatGoesOverTheLinkAndWaitsForLateComers() {
        val air = Air(1 to "Bence", 2 to "Dóri", 3 to "Gergő")
        air.range(1, 2, -60); air.range(1, 3, -60)
        air.link(1, 2)
        air.run(300)
        val e = air.p(1).e.chat("Ebéd 12-kor a konténernél", BROADCAST, air.t)!!
        air.run(300)
        assertEquals("Ebéd 12-kor a konténernél", air.p(2).e.chats().single().text)
        assertEquals(setOf(2), e.acked)
        assertTrue(air.p(3).e.chats().isEmpty())
        // Gergő's link opens later: store and forward
        air.link(1, 3)
        air.run(300)
        assertEquals(1, air.p(3).e.chats().size)
        assertEquals(setOf(2, 3), e.acked)
    }

    @Test fun chatHopsAcrossTheLinkMesh() {
        val air = Air(1 to "Bence", 2 to "Dóri", 3 to "Gergő")
        air.link(1, 2); air.link(2, 3)                               // 1 and 3 have no link of their own
        val e = air.p(1).e.chat("A 2. emeleten vagyok", 3, air.t)!!
        air.run(500)
        assertEquals("A 2. emeleten vagyok", air.p(3).e.chats().single().text)
        assertTrue(air.p(2).e.chats().isEmpty(), "not addressed to Dóri: carried, not shown")
        assertEquals(setOf(3), e.acked)
    }

    @Test fun proximityShowsWhoIsNearest() {
        val air = Air(1 to "Bence", 2 to "Dóri", 3 to "Gergő")
        air.range(1, 2, -62); air.range(1, 3, -88)
        air.run(3_000)
        val list = air.p(1).e.peers(air.t)
        assertEquals(listOf(2, 3), list.map { it.unit })
        assertTrue(list[0].zone.ordinal < list[1].zone.ordinal)
        air.cut(1, 3)
        air.run(Proximity.LOST_MS + 500)
        assertEquals(Zone.OUT, air.p(1).e.peers(air.t).first { it.unit == 3 }.zone)
        assertFalse(air.p(1).e.peers(air.t).first { it.unit == 2 }.zone == Zone.OUT)
    }
}
