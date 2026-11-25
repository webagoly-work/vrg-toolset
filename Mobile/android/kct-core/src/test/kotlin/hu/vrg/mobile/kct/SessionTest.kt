package hu.vrg.mobile.kct

import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

// WP M65 Q1–Q3 without a phone: the captured watch frames played into a Session give what FunDo got, and the Session
// sends what FunDo sent for the same moment (11:03:33, Budapest winter time).
class SessionTest {

    private val readsHex = javaClass.getResource("/q71-capture-b.txt")!!.readText().lines()
        .filter { it.startsWith("W>P 0105 ") }.map { it.substringAfterLast(' ') }

    private fun hex(s: String) = ByteArray(s.length / 2) { s.substring(it * 2, it * 2 + 2).toInt(16).toByte() }

    private fun session() = Session(clock = { 1_795_341_813_000L }, tzOffsetMs = { 3_600_000 })

    @Test fun linkUpAsksForTheVersion() {
        assertContentEquals(Kct.syncRequest(), session().linkUp().single())
    }

    @Test fun capturedConversation() {
        val s = session()
        val r = Reassembler()
        val steps = readsHex.flatMap { r.push(hex(it)) }.map { s.receive(it) }
        // VERN → time + info + steps
        val first = steps[0]
        assertEquals(Session.Event.Version("331"), first.events.single())
        assertEquals(4, first.send.size)
        assertContentEquals(Kct.syncTime(1_795_341_813, 3_600_000), first.send[0])
        assertContentEquals(Kct.setTime(1_795_341_813, 3_600_000), first.send[1])
        assertContentEquals(Kct.deviceInfo(), first.send[2])
        assertContentEquals(Kct.todaySteps(), first.send[3])

        val events = steps.flatMap { it.events }
        assertEquals("CB:1C:7F:39:DD:60", s.addresses?.le)
        assertEquals("XT2002D_AB024_Q71_T6_B_2104_V0.1_2111261102", s.info?.firmware)
        assertEquals(0, s.steps?.steps)
        assertEquals(listOf(true, false), events.filterIsInstance<Session.Event.FindPhone>().map { it.on })
        assertTrue(events.filterIsInstance<Session.Event.Measure>().map { it.n }.containsAll(listOf(100, 101, 102)))

        // answers, as FunDo gave them: RET,GET,10 once, RET,SET,43,1 twice, RET,SET,14,1 four times
        val sent = steps.drop(1).flatMap { it.send }.map { Frame.decode(it)!!.text }
        assertEquals(listOf("RET,GET,10", "RET,SET,43,1", "RET,SET,43,1", "RET,SET,14,1", "RET,SET,14,1", "RET,SET,14,1", "RET,SET,14,1"), sent)
        sent.forEach { assertTrue(Kct.isSafe(Kct.cmd(it))) }
    }

    @Test fun findWatchAcknowledged() {
        val s = session()
        val ack = Frame.encode("EXCD 45", "KCT_PEDOMETER kct_pedometer 0 12 RET,SET,40,1")
        assertEquals(Session.Event.WatchRings(true), s.receive(Frame.decode(ack)!!).events.single())
        assertEquals("SET,40,1", Frame.decode(s.findWatch(true).single())!!.text)
        assertIs<Session.Event.Unknown>(s.receive(Frame.decode(Frame.encode("MAPX 0"))!!).events.single())
    }
}
