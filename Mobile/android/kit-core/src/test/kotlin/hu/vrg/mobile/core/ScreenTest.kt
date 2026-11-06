package hu.vrg.mobile.core

import org.json.JSONObject
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ScreenTest {

    /** The relay's frame: the header frameHeader() writes in relay-screen.js, then [jpeg]. */
    private fun frame(seq: Long, w: Int, h: Int, jpeg: ByteArray, keepalive: Boolean = false, len: Long = jpeg.size.toLong()): ByteArray {
        val b = ByteArray(16 + jpeg.size)
        b[0] = 'V'.code.toByte(); b[1] = 'S'.code.toByte(); b[2] = 1; b[3] = if (keepalive) 1 else 0
        for (i in 0..3) b[4 + i] = (seq shr (24 - 8 * i)).toByte()
        b[8] = (w shr 8).toByte(); b[9] = w.toByte(); b[10] = (h shr 8).toByte(); b[11] = h.toByte()
        for (i in 0..3) b[12 + i] = (len shr (24 - 8 * i)).toByte()
        jpeg.copyInto(b, 16)
        return b
    }

    private val jpeg = byteArrayOf(0xff.toByte(), 0xd8.toByte(), 1, 2, 3, 0xff.toByte(), 0xd9.toByte())

    // ---- the frame header ----------------------------------------------------------------------------

    @Test fun aFrameParses() {
        val r = Screen.frame(frame(4_000_000_001L, 1280, 720, jpeg, keepalive = true))
        assertIs<FrameParse.Ok>(r)
        assertEquals(4_000_000_001L, r.frame.seq, "seq is unsigned 32-bit")
        assertEquals(1280, r.frame.width); assertEquals(720, r.frame.height)
        assertEquals(16, r.frame.offset); assertEquals(jpeg.size, r.frame.length)
        assertTrue(r.frame.keepalive)
        assertFalse((Screen.frame(frame(1, 960, 540, jpeg)) as FrameParse.Ok).frame.keepalive)
    }

    @Test fun shortCorruptAndWrongLengthAreRefused() {
        assertEquals(FrameParse.Short, Screen.frame(ByteArray(0)))
        assertEquals(FrameParse.Short, Screen.frame(frame(1, 10, 10, jpeg).copyOf(15)))
        val bad = frame(1, 10, 10, jpeg).also { it[0] = 'X'.code.toByte() }
        assertEquals(FrameParse.Foreign, Screen.frame(bad), "wrong magic")
        val v2 = frame(1, 10, 10, jpeg).also { it[2] = 2 }
        assertEquals(FrameParse.Foreign, Screen.frame(v2), "a version this app does not read")
        assertEquals(FrameParse.WrongLength(99, jpeg.size), Screen.frame(frame(1, 10, 10, jpeg, len = 99)), "the header says more than arrived")
        val cut = frame(1, 10, 10, jpeg)
        assertEquals(FrameParse.WrongLength(jpeg.size.toLong(), 3), Screen.frame(cut, 16 + 3), "fewer bytes than the header said")
        assertIs<FrameParse.WrongLength>(Screen.frame(frame(1, 10, 10, jpeg, len = 0xffffffffL)), "an absurd length")
    }

    @Test fun theHeaderMatchesTheRelaysBytes() {
        // the bytes relay-screen.js frameHeader(7, 1280, 720, 1234, true) writes, as Mobile/tests/relay-screen.js checks them
        val h = byteArrayOf(0x56, 0x53, 1, 1, 0, 0, 0, 7, 0x05, 0x00, 0x02, 0xd0.toByte(), 0, 0, 0x04, 0xd2.toByte())
        val r = Screen.frame(h + ByteArray(1234))
        assertIs<FrameParse.Ok>(r)
        assertEquals(ScreenFrame(7, true, 1280, 720, 16, 1234), r.frame)
    }

    // ---- addresses and messages ---------------------------------------------------------------------

    @Test fun theSocketAddress() {
        assertEquals("ws://192.168.1.24:47291/screen", Screen.socketUrl("ws://192.168.1.24:47291"))
        assertNull(Screen.socketUrl("http://192.168.1.24:47291"))
        assertNull(Screen.socketUrl("ws://evil.example/x:47291"))
        assertNull(Screen.socketUrl("ws://a b:47291"))
    }

    @Test fun theTicketAnswer() {
        val t = ScreenMsgs.parseTicket(File("../../tests/fixtures/relay-screen-ticket.json").readText())!!
        assertTrue(t.ok && t.trusted && !t.busy)
        assertEquals("0123456789abcdef0123456789abcdef", t.ticket)
        assertEquals(60000L, t.ttlMs)
        val busy = ScreenMsgs.parseTicket("""{"from":"relay","type":"screen.ticket","payload":{"ok":false,"busy":true,"viewer":"Pixel 7","reason":"Már nézi valaki: Pixel 7."}}""")!!
        assertTrue(!busy.ok && busy.busy && busy.reason!!.contains("Pixel 7"))
        val untrusted = ScreenMsgs.parseTicket("""{"from":"relay","type":"screen.ticket","payload":{"ok":false,"trusted":false,"reason":"Párosítás kell"}}""")!!
        assertFalse(untrusted.trusted)
        val malformed = ScreenMsgs.parseTicket("""{"from":"relay","type":"screen.ticket","payload":{"ok":true,"ticket":"../x"}}""")!!
        assertFalse(malformed.ok, "ok with a ticket that is not 32 hex is not ok")
        assertNull(ScreenMsgs.parseTicket("""{"from":"phone","type":"screen.ticket","payload":{"ok":true}}"""))
        assertNull(ScreenMsgs.parseTicket("""{"from":"relay","type":"board.ticket","payload":{"ok":true}}"""))
    }

    @Test fun theScreenSocketsNotes() {
        val m = ScreenMsgs.parse(File("../../tests/fixtures/relay-screen-monitors.json").readText())
        assertIs<ScreenNote.Monitors>(m)
        assertEquals(listOf(ScreenMonitor(0, 1920, 1080, true), ScreenMonitor(1, 1280, 1024, false)), m.monitors)
        assertEquals(ScreenSettings(ScreenMode.SCREEN, 0, ScreenQuality.HIGH), m.settings)
        assertEquals("1. 1920×1080 (fő)", m.monitors[0].label)
        assertEquals(ScreenNote.State(false, "nem látható"), ScreenMsgs.parse("""{"type":"screen.state","visible":false,"reason":"nem látható"}"""))
        assertEquals(ScreenNote.End("limit", "30 perc"), ScreenMsgs.parse("""{"type":"screen.end","reason":"limit","text":"30 perc"}"""))
        assertNull(ScreenMsgs.parse("""{"type":"other"}"""))
        assertNull(ScreenMsgs.parse("not json"))
    }

    @Test fun theMessagesThePhoneSends() {
        val t = JSONObject(ScreenMsgs.ticket())
        assertEquals("screen.ticket", t.getString("type")); assertEquals("relay", t.getString("to")); assertEquals("phone", t.getString("from"))
        val s = JSONObject(ScreenMsgs.set(ScreenSettings(ScreenMode.WINDOW, 1, ScreenQuality.LOW)))
        assertEquals("screen.set", s.getString("type")); assertEquals("window", s.getString("mode"))
        assertEquals(1, s.getInt("monitor")); assertEquals("low", s.getString("quality"))
    }

    // ---- the state machine --------------------------------------------------------------------------

    private fun run(vararg e: ScreenEvent, from: ScreenState = ScreenState.Idle) = e.fold(from) { s, x -> ScreenViewer.next(s, x) }

    @Test fun startConnectFramesNotVisibleRecover() {
        assertEquals(ScreenState.Connecting, run(ScreenEvent.Start))
        assertEquals(ScreenState.Connecting, run(ScreenEvent.Start, ScreenEvent.Opened), "open but no frame yet")
        assertEquals(ScreenState.Live, run(ScreenEvent.Start, ScreenEvent.Opened, ScreenEvent.Frame))
        val hidden = run(ScreenEvent.Start, ScreenEvent.Frame, ScreenEvent.Visible(false, "zárolva"))
        assertEquals(ScreenState.NotVisible("zárolva"), hidden)
        assertEquals(ScreenState.Live, ScreenViewer.next(hidden, ScreenEvent.Visible(true, null)), "it recovers by itself")
        assertEquals(ScreenState.Live, ScreenViewer.next(hidden, ScreenEvent.Frame), "a frame means it is visible again")
        assertTrue(ScreenViewer.running(hidden))
        assertEquals(ScreenState.Live, run(ScreenEvent.Start, ScreenEvent.Frame, ScreenEvent.Start), "a second Start while live changes nothing")
    }

    @Test fun everyWayItStops() {
        val live = run(ScreenEvent.Start, ScreenEvent.Frame)
        fun stop(e: ScreenEvent) = ScreenViewer.next(live, e) as ScreenState.Stopped
        assertEquals(ScreenStop.PC, stop(ScreenEvent.Ended("pc", "A PC-n leállították (Leállítás).")).why)
        assertEquals(ScreenStop.LIMIT, stop(ScreenEvent.Ended("limit", null)).why)
        assertEquals(ScreenStop.UNPAIRED, stop(ScreenEvent.Ended("unpaired", null)).why)
        assertEquals(ScreenStop.SOURCE, stop(ScreenEvent.Ended("source", null)).why)
        assertEquals(ScreenStop.LOST, stop(ScreenEvent.Ended("something new", null)).why, "an unknown reason is still a stop")
        assertEquals("a relé szövege", stop(ScreenEvent.Ended("pc", "a relé szövege")).text, "the relay's text wins")
        assertEquals(ScreenStop.LOST, stop(ScreenEvent.Closed(-1)).why)
        assertEquals(ScreenStop.UNPAIRED, stop(ScreenEvent.Closed(4410)).why)
        assertEquals(ScreenStop.LIMIT, stop(ScreenEvent.Closed(4408)).why)
        assertEquals(ScreenStop.PC, stop(ScreenEvent.Closed(4000)).why)
        assertEquals(ScreenStop.BACKGROUND, stop(ScreenEvent.Stop(ScreenStop.BACKGROUND)).why)
        assertEquals(ScreenStop.LIMIT, stop(ScreenEvent.Limit).why)
        assertTrue(ScreenStop.LIMIT.resumable && ScreenStop.PC.resumable)
        assertFalse(ScreenStop.UNPAIRED.resumable, "no Folytatás without a pairing")
        assertFalse(ScreenViewer.running(stop(ScreenEvent.Limit)))
    }

    @Test fun theFirstStopReasonStays() {
        val s = run(ScreenEvent.Start, ScreenEvent.Frame, ScreenEvent.Ended("unpaired", null), ScreenEvent.Closed(4410), ScreenEvent.Closed(-1), ScreenEvent.Frame)
        assertEquals(ScreenStop.UNPAIRED, (s as ScreenState.Stopped).why, "the close after screen.end, or a late frame, does not overwrite why it stopped")
        assertEquals(ScreenState.Idle, run(ScreenEvent.Frame, ScreenEvent.Visible(false, "x"), ScreenEvent.Closed(1000)), "nothing happens before Start")
    }

    @Test fun refusedTickets() {
        val c = run(ScreenEvent.Start)
        assertEquals(ScreenStop.BUSY, (ScreenViewer.next(c, ScreenEvent.TicketRefused("Már nézi: Pixel 7", busy = true, trusted = true)) as ScreenState.Stopped).why)
        assertEquals(ScreenStop.UNTRUSTED, (ScreenViewer.next(c, ScreenEvent.TicketRefused(null, busy = false, trusted = false)) as ScreenState.Stopped).why)
        val off = ScreenViewer.next(c, ScreenEvent.TicketRefused("--shots kell", busy = false, trusted = true)) as ScreenState.Stopped
        assertEquals(ScreenStop.REFUSED, off.why); assertEquals("--shots kell", off.text)
        assertEquals(ScreenStop.BUSY, (ScreenViewer.next(c, ScreenEvent.Closed(-1, 409)) as ScreenState.Stopped).why, "a refused upgrade (409)")
        assertEquals(ScreenStop.REFUSED, (ScreenViewer.next(c, ScreenEvent.Closed(-1, 403)) as ScreenState.Stopped).why)
        assertEquals(ScreenState.Live, ScreenViewer.next(ScreenState.Live, ScreenEvent.TicketRefused("late", false, true)), "a late refusal does not stop a live stream")
    }

    @Test fun resumingAfterTheLimit() {
        val stopped = run(ScreenEvent.Start, ScreenEvent.Frame, ScreenEvent.Limit)
        assertEquals(ScreenState.Connecting, ScreenViewer.next(stopped, ScreenEvent.Start), "Folytatás starts it again")
    }

    // ---- the meter -----------------------------------------------------------------------------------

    @Test fun theMeter() {
        val m = FrameMeter(2000)
        for (i in 0 until 10) m.add(i * 200L, 51200)
        assertEquals(5.0, m.fps(1900), 0.001)
        assertEquals(250.0, m.kbps(1900), 0.001)
        assertEquals("5.0 kép/s · 250 KB/s", m.line(1900))
        assertEquals(0.0, m.fps(10_000), "old frames fall out of the window")
    }
}
