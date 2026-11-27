package hu.vrg.mobile.kct

// One link's conversation with the watch (WP M65 Q1–Q3), without Android: what to send when the link comes up and what
// each received frame means and needs as an answer. The Android shell (feature-watch) only moves the bytes.
//
//   link up        → SYNC REQV
//   VERN <n>       → SYNC <unix> <tz ms>, SET,45 (time), GET,0 (device info), GET,10 (today's steps)
//   ACKY           → the watch's addresses and name
//   GET,0 / GET,10 → info / steps (GET,10 is acknowledged with RET,GET,10, as FunDo does)
//   SET,40,1|0     → the watch's find phone (the 1802 write on the phone's server rings; this is the second signal)
//   RET,SET,40,1   → the watch rings (our find watch arrived)
//   SET,14 / 43    → answered RET,SET,<n>,1 like FunDo; SEND,10x → a measurement (kept for Q6)

class Session(private val clock: () -> Long = { System.currentTimeMillis() }, private val tzOffsetMs: (Long) -> Int) {

    sealed class Event {
        data class Version(val v: String) : Event()
        data class Addresses(val a: Acky) : Event()
        data class Info(val info: DeviceInfo) : Event()
        data class Today(val steps: Steps) : Event()
        data class FindPhone(val on: Boolean) : Event()
        data class WatchRings(val on: Boolean) : Event()
        data class Measure(val n: Int, val args: List<String>) : Event()
        data class Unknown(val text: String) : Event()
    }

    class Step(val send: List<ByteArray>, val events: List<Event>)

    var version: String? = null; private set
    var info: DeviceInfo? = null; private set
    var steps: Steps? = null; private set
    var addresses: Acky? = null; private set

    fun linkUp(): List<ByteArray> { version = null; return listOf(Kct.syncRequest()) }

    /** The clock now: SYNC with the zone's offset, then the KCT time setting. */
    fun timeSync(): List<ByteArray> {
        val ms = clock()
        val sec = ms / 1000
        val tz = tzOffsetMs(ms)
        return listOf(Kct.syncTime(sec, tz), Kct.setTime(sec, tz))
    }

    fun refresh(): List<ByteArray> = listOf(Kct.deviceInfo(), Kct.todaySteps())

    fun findWatch(on: Boolean): List<ByteArray> = listOf(Kct.findWatch(on))

    fun receive(d: Decoded): Step {
        when (d.type) {
            "VERN" -> {
                version = d.text.trim('\u0000', ' ')
                return Step(timeSync() + refresh(), listOf(Event.Version(version!!)))
            }
            "ACKY" -> Acky.parse(d)?.let { addresses = it; return Step(emptyList(), listOf(Event.Addresses(it))) }
            "EXCD" -> {
                val body = Kct.body(d) ?: return Step(emptyList(), listOf(Event.Unknown(d.header)))
                val m = Kct.parse(body)
                val reply = listOfNotNull(Kct.replyTo(m))
                val ev: Event = when (m) {
                    is Msg.Info -> { info = m.info; Event.Info(m.info) }
                    is Msg.Today -> { steps = m.steps; Event.Today(m.steps) }
                    is Msg.FindPhone -> Event.FindPhone(m.on)
                    is Msg.Ret -> if (m.cmd == "SET" && m.n == 40) Event.WatchRings(m.args.firstOrNull() == "1") else Event.Unknown(body.take(40))
                    is Msg.Measure -> Event.Measure(m.n, m.args)
                    is Msg.WatchSet -> Event.Unknown(body.take(40))
                    is Msg.Other -> Event.Unknown(body.take(40))
                }
                return Step(reply, listOf(ev))
            }
        }
        return Step(emptyList(), listOf(Event.Unknown(d.header.take(40))))
    }
}
