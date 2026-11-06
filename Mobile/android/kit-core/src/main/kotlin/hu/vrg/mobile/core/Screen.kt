package hu.vrg.mobile.core

import org.json.JSONObject

// Képernyő (WP M13): the PC's screen live on the phone, the parts that are rules rather than Android.
// The relay (Planner/projects/varler-planner/tools/relay-screen.js) captures the PC only for a trusted
// (paired, M2) phone, only when it was started with --shots, one viewer at a time, and shows a notice
// window on the PC while it streams.
//
//   phone ─ screen.ticket ─▶ relay ─ screen.ticket{ok, ticket, ttl, path} | {ok:false, reason, busy?, trusted?}
//   phone ─ ws://<pc>:<port>/screen  (X-VRG-Ticket header, never in the URL) ─▶ its own WebSocket:
//       binary  [V S][1][flags][seq:4][width:2][height:2][length:4][JPEG]      (big-endian, 16-byte header)
//       text    screen.monitors{monitors[], mode, monitor, quality} · screen.state{visible, reason}
//               screen.end{reason, text}
//   phone ─ screen.set{mode, monitor, quality} on the same socket: no new ticket needed.

enum class ScreenMode(val wire: String, val label: String) {
    SCREEN("screen", "Monitor"), WINDOW("window", "Aktív ablak");

    companion object { fun of(s: String?): ScreenMode? = entries.firstOrNull { it.wire == s } }
}

enum class ScreenQuality(val wire: String, val label: String) {
    LOW("low", "Kíméletes"), HIGH("high", "Éles");

    companion object { fun of(s: String?): ScreenQuality? = entries.firstOrNull { it.wire == s } }
}

data class ScreenMonitor(val index: Int, val width: Int, val height: Int, val primary: Boolean) {
    val label: String get() = "${index + 1}. ${width}×$height" + if (primary) " (fő)" else ""
}

data class ScreenSettings(val mode: ScreenMode = ScreenMode.SCREEN, val monitor: Int = 0, val quality: ScreenQuality = ScreenQuality.HIGH)

/** One decoded frame: where the JPEG starts in the message and how long it is. */
data class ScreenFrame(val seq: Long, val keepalive: Boolean, val width: Int, val height: Int, val offset: Int, val length: Int)

sealed interface FrameParse {
    data class Ok(val frame: ScreenFrame) : FrameParse
    /** Fewer than 16 bytes. */
    data object Short : FrameParse
    /** Not "VS", or a version this app does not read. */
    data object Foreign : FrameParse
    /** The header's length does not match what arrived. */
    data class WrongLength(val said: Long, val got: Int) : FrameParse
}

/** Why a stream stopped, in the phone's words. [resumable]: the view offers "Folytatás". */
enum class ScreenStop(val text: String, val resumable: Boolean) {
    LEFT("Leállítva.", true),
    BACKGROUND("Leállt: az alkalmazás a háttérbe került.", true),
    LIMIT("30 perc letelt. Folytatás egy érintéssel.", true),
    PC("A PC-n leállították (Leállítás).", true),
    UNPAIRED("A párosítást törölték: a kép leállt.", false),
    SOURCE("A képernyő rögzítése leállt a PC-n.", true),
    RELAY("A relé leállt.", true),
    LOST("Megszakadt a kapcsolat.", true),
    BUSY("Már nézi egy másik telefon.", true),
    REFUSED("A relé nem engedte.", true),
    UNTRUSTED("Ez a telefon nincs párosítva ezzel a PC-vel.", false),
}

sealed interface ScreenState {
    data object Idle : ScreenState
    data object Connecting : ScreenState
    data object Live : ScreenState
    /** The capture is impossible right now (lock screen, UAC, secure desktop); it recovers by itself. */
    data class NotVisible(val reason: String) : ScreenState
    data class Stopped(val why: ScreenStop, val text: String) : ScreenState
}

/** What can happen to a viewer. */
sealed interface ScreenEvent {
    data object Start : ScreenEvent
    data class TicketRefused(val reason: String?, val busy: Boolean, val trusted: Boolean) : ScreenEvent
    data object Opened : ScreenEvent
    data object Frame : ScreenEvent
    data class Visible(val visible: Boolean, val reason: String?) : ScreenEvent
    /** screen.end from the relay. */
    data class Ended(val reason: String?, val text: String?) : ScreenEvent
    /** The socket closed or failed without a screen.end (code -1 = failure; httpStatus for a refused upgrade). */
    data class Closed(val code: Int, val httpStatus: Int = 0) : ScreenEvent
    /** The phone stopped it: the view left, or the app went to the background. */
    data class Stop(val why: ScreenStop) : ScreenEvent
    /** The phone's own 30-minute clock. */
    data object Limit : ScreenEvent
}

/** The viewer's state machine. Pure: the feature feeds it events and draws what it returns. */
object ScreenViewer {
    fun next(s: ScreenState, e: ScreenEvent): ScreenState = when (e) {
        ScreenEvent.Start -> if (s is ScreenState.Connecting || s is ScreenState.Live || s is ScreenState.NotVisible) s else ScreenState.Connecting
        is ScreenEvent.TicketRefused -> if (s !is ScreenState.Connecting) s else when {
            !e.trusted -> ScreenState.Stopped(ScreenStop.UNTRUSTED, e.reason ?: ScreenStop.UNTRUSTED.text)
            e.busy -> ScreenState.Stopped(ScreenStop.BUSY, e.reason ?: ScreenStop.BUSY.text)
            else -> ScreenState.Stopped(ScreenStop.REFUSED, e.reason ?: ScreenStop.REFUSED.text)
        }
        ScreenEvent.Opened -> s
        ScreenEvent.Frame -> if (s is ScreenState.Connecting || s is ScreenState.NotVisible) ScreenState.Live else s
        is ScreenEvent.Visible -> when {
            s is ScreenState.Stopped || s is ScreenState.Idle -> s
            e.visible -> if (s is ScreenState.NotVisible) ScreenState.Live else s
            else -> ScreenState.NotVisible(e.reason ?: "A képernyő most nem látható.")
        }
        is ScreenEvent.Ended -> if (s is ScreenState.Stopped || s is ScreenState.Idle) s else {
            val why = Screen.stopOf(e.reason)
            ScreenState.Stopped(why, e.text?.takeIf { it.isNotBlank() } ?: why.text)
        }
        is ScreenEvent.Closed -> if (s is ScreenState.Stopped || s is ScreenState.Idle) s else {
            val why = Screen.stopOfClose(e.code, e.httpStatus)
            ScreenState.Stopped(why, why.text)
        }
        is ScreenEvent.Stop -> if (s is ScreenState.Stopped || s is ScreenState.Idle) s else ScreenState.Stopped(e.why, e.why.text)
        ScreenEvent.Limit -> if (s is ScreenState.Stopped || s is ScreenState.Idle) s else ScreenState.Stopped(ScreenStop.LIMIT, ScreenStop.LIMIT.text)
    }

    /** The stream should be running (a socket open or being opened). */
    fun running(s: ScreenState): Boolean = s is ScreenState.Connecting || s is ScreenState.Live || s is ScreenState.NotVisible
}

/** Frames a second and KB a second over the last [windowMs]. */
class FrameMeter(private val windowMs: Long = 2000) {
    private val times = ArrayDeque<Long>()
    private val sizes = ArrayDeque<Int>()

    fun add(now: Long, bytes: Int) {
        times.addLast(now); sizes.addLast(bytes)
        trim(now)
    }

    private fun trim(now: Long) {
        while (times.isNotEmpty() && now - times.first() > windowMs) { times.removeFirst(); sizes.removeFirst() }
    }

    fun fps(now: Long): Double { trim(now); return times.size * 1000.0 / windowMs }
    fun kbps(now: Long): Double { trim(now); return sizes.sum() / 1024.0 * 1000.0 / windowMs }

    /** "4.5 kép/s · 380 KB/s" */
    fun line(now: Long): String = String.format(java.util.Locale.ROOT, "%.1f kép/s · %.0f KB/s", fps(now), kbps(now))

    fun reset() { times.clear(); sizes.clear() }
}

object Screen {
    const val CAP = "screen"
    const val TICKET_HEADER = "X-VRG-Ticket"
    const val HEADER_BYTES = 16
    const val LIMIT_MS = 30L * 60 * 1000
    /** Bigger than any frame the relay sends (1280 px JPEGs are ~100 KB): anything over it is not a frame. */
    const val MAX_FRAME = 8 * 1024 * 1024

    private val TICKET = Regex("[0-9a-f]{32}")

    fun validTicket(t: String?): Boolean = t != null && TICKET.matches(t)

    /** "ws://192.168.1.24:47291" -> "ws://192.168.1.24:47291/screen"; null for anything else. */
    fun socketUrl(relayWs: String): String? = Drop.httpBase(relayWs)?.let { "ws://" + it.removePrefix("http://") + "/screen" }

    /** Reads the 16-byte header of a binary message of [size] bytes. */
    fun frame(b: ByteArray, size: Int = b.size): FrameParse {
        if (size < HEADER_BYTES) return FrameParse.Short
        if (b[0] != 'V'.code.toByte() || b[1] != 'S'.code.toByte() || b[2] != 1.toByte()) return FrameParse.Foreign
        fun u16(i: Int) = ((b[i].toInt() and 0xff) shl 8) or (b[i + 1].toInt() and 0xff)
        fun u32(i: Int) = ((b[i].toLong() and 0xff) shl 24) or ((b[i + 1].toLong() and 0xff) shl 16) or
            ((b[i + 2].toLong() and 0xff) shl 8) or (b[i + 3].toLong() and 0xff)
        val len = u32(12)
        val got = size - HEADER_BYTES
        if (len != got.toLong() || len > MAX_FRAME) return FrameParse.WrongLength(len, got)
        return FrameParse.Ok(ScreenFrame(u32(4), (b[3].toInt() and 1) == 1, u16(8), u16(10), HEADER_BYTES, got))
    }

    fun stopOf(reason: String?): ScreenStop = when (reason) {
        "pc" -> ScreenStop.PC
        "limit" -> ScreenStop.LIMIT
        "unpaired" -> ScreenStop.UNPAIRED
        "source" -> ScreenStop.SOURCE
        "relay" -> ScreenStop.RELAY
        "left" -> ScreenStop.LEFT
        else -> ScreenStop.LOST
    }

    /** A close without screen.end: the relay's codes, a refused upgrade, or a lost network. */
    fun stopOfClose(code: Int, httpStatus: Int): ScreenStop = when {
        httpStatus == 409 -> ScreenStop.BUSY
        httpStatus == 403 || httpStatus == 404 -> ScreenStop.REFUSED
        code == 4000 -> ScreenStop.PC
        code == 4408 -> ScreenStop.LIMIT
        code == 4410 -> ScreenStop.UNPAIRED
        code == 4500 -> ScreenStop.SOURCE
        code == 1001 -> ScreenStop.RELAY
        else -> ScreenStop.LOST
    }
}

data class ScreenTicket(val ok: Boolean, val ticket: String?, val ttlMs: Long, val reason: String?, val busy: Boolean, val trusted: Boolean)

/** A text message on the /screen socket. */
sealed interface ScreenNote {
    data class Monitors(val monitors: List<ScreenMonitor>, val settings: ScreenSettings) : ScreenNote
    data class State(val visible: Boolean, val reason: String?) : ScreenNote
    data class End(val reason: String?, val text: String?) : ScreenNote
}

object ScreenMsgs {
    fun ticket(): String = RelayMsgs.build("screen.ticket", JSONObject(), "relay")

    /** What the phone sends on the /screen socket to change what it sees. */
    fun set(s: ScreenSettings): String =
        JSONObject().put("type", "screen.set").put("mode", s.mode.wire).put("monitor", s.monitor).put("quality", s.quality.wire).toString()

    private fun str(o: JSONObject?, k: String): String? =
        if (o == null || !o.has(k) || o.isNull(k)) null else o.optString(k).takeIf { it.isNotEmpty() }

    /** The relay's answer on the control link, or null for any other message. */
    fun parseTicket(raw: String): ScreenTicket? {
        val m = try { JSONObject(raw) } catch (e: Exception) { return null }
        if (m.optString("from") != "relay" || m.optString("type") != "screen.ticket") return null
        val p = m.optJSONObject("payload") ?: return null
        val t = str(p, "ticket")?.takeIf { Screen.validTicket(it) }
        return ScreenTicket(p.optBoolean("ok", false) && t != null, t, p.optLong("ttl", 0), str(p, "reason"),
            p.optBoolean("busy", false), p.optBoolean("trusted", true))
    }

    /** A text message on the /screen socket, or null. */
    fun parse(raw: String): ScreenNote? {
        val m = try { JSONObject(raw) } catch (e: Exception) { return null }
        return when (m.optString("type")) {
            "screen.monitors" -> {
                val a = m.optJSONArray("monitors")
                val list = buildList {
                    if (a != null) for (i in 0 until a.length()) {
                        val o = a.optJSONObject(i) ?: continue
                        val w = o.optInt("w", 0); val h = o.optInt("h", 0)
                        if (w > 0 && h > 0) add(ScreenMonitor(o.optInt("i", i), w, h, o.optBoolean("primary", false)))
                    }
                }
                ScreenNote.Monitors(list, ScreenSettings(ScreenMode.of(str(m, "mode")) ?: ScreenMode.SCREEN, m.optInt("monitor", 0),
                    ScreenQuality.of(str(m, "quality")) ?: ScreenQuality.HIGH))
            }
            "screen.state" -> ScreenNote.State(m.optBoolean("visible", true), str(m, "reason"))
            "screen.end" -> ScreenNote.End(str(m, "reason"), str(m, "text"))
            else -> null
        }
    }
}
