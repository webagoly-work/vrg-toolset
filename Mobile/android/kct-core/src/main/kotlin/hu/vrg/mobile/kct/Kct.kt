package hu.vrg.mobile.kct

// The KCT pedometer app's text commands inside EXCD frames (WP M65). Phone → watch:
//   header "EXCD KCT_PEDOMETER kct_pedometer 0 0 <payload length> ", payload "GET,0" / "SET,45,…" / "SETNEW,…"
// Watch → phone:
//   header "EXCD <payload length>", payload "KCT_PEDOMETER kct_pedometer 0 <body length> <body>"
// Only commands seen in the 2026-11-22 captures are built here. Never an MREE mre_installer command (the watch's app
// installer) and nothing OTA-like: [Kct.isSafe] is the gate every outgoing frame goes through.

object Kct {
    const val SENDER = "KCT_PEDOMETER"
    const val RECEIVER = "kct_pedometer"

    /** A KCT command as a frame, e.g. cmd("GET,0"). */
    fun cmd(c: String): ByteArray = cmd(c.toByteArray(Charsets.UTF_8))

    fun cmd(payload: ByteArray): ByteArray = Frame.encode("EXCD $SENDER $RECEIVER 0 0 ${payload.size} ", payload)

    /** The version request sent first on every link; the watch answers VERN 3 with "331". */
    fun syncRequest(): ByteArray = Frame.encode("SYNC REQV")

    /** The clock: Unix seconds (UTC) and the time zone's offset in ms, e.g. "SYNC 1795341812 3600000". */
    fun syncTime(unixSec: Long, tzOffsetMs: Int): ByteArray = Frame.encode("SYNC $unixSec $tzOffsetMs")

    /** GET,0: device info (firmware, MAC, screen, profile …). */
    fun deviceInfo() = cmd("GET,0")

    /** GET,10: today's activity. */
    fun todaySteps() = cmd("GET,10")

    /** SET,45: the KCT time setting, "SET,45,1|+01.0|<unix>", sent after SYNC like FunDo does. */
    fun setTime(unixSec: Long, tzOffsetMs: Int) = cmd("SET,45,1|${tzText(tzOffsetMs)}|$unixSec")

    /** SET,40: find watch on (it rings) / off; goes with 1802 Immediate Alert 02 / 00. */
    fun findWatch(on: Boolean) = cmd("SET,40,${if (on) 1 else 0}")

    /** The acknowledgement FunDo sends for a watch-initiated SET (RET,SET,43,1 · RET,SET,14,1) or a GET reply. */
    fun ret(what: String) = cmd("RET,$what")

    /** "+01.0", "-03.5", "+05.75" → hours with one decimal as FunDo writes it (+01.0 for Budapest in winter). */
    fun tzText(offsetMs: Int): String {
        val sign = if (offsetMs < 0) "-" else "+"
        val tenths = Math.round(kotlin.math.abs(offsetMs) / 360_000.0).toInt()
        return "%s%02d.%d".format(sign, tenths / 10, tenths % 10)
    }

    /** False for anything that could install software on the watch (MREE mre_installer, OTA, firmware). */
    fun isSafe(frame: ByteArray): Boolean {
        val d = Frame.decode(frame) ?: return frame.isNotEmpty()       // a continuation write of a checked frame
        val h = d.header.lowercase()
        if (d.type == "MREE") return false
        if (listOf("installer", "ota", "firmware", "upgrade", "fota").any { it in h }) return false
        val p = String(d.payload, 0, minOf(d.payload.size, 32), Charsets.ISO_8859_1).lowercase()
        return listOf("ota", "fota", "upgrade", "mre_installer").none { p.startsWith(it) }
    }

    /** The KCT body of a watch → phone frame ("RET,SET,15", "GET,0,…", "SEND,101,…"), or null for other frames. */
    fun body(d: Decoded): String? {
        if (d.type != "EXCD") return null
        val p = d.payload
        val pre = "$SENDER $RECEIVER ".toByteArray(Charsets.ISO_8859_1)
        if (p.size < pre.size || (pre.indices).any { p[it] != pre[it] }) return null
        // "0 <n> <body>": two numbers, n = the body's length in bytes
        val a = (pre.size until p.size).firstOrNull { p[it] == ' '.code.toByte() } ?: return null
        val b = (a + 1 until p.size).firstOrNull { p[it] == ' '.code.toByte() } ?: return null
        val n = String(p, a + 1, b - a - 1, Charsets.ISO_8859_1).toIntOrNull() ?: return null
        return String(p, b + 1, minOf(n, p.size - b - 1), Charsets.UTF_8)
    }

    /** The KCT body of a phone → watch frame (for logs and tests). */
    fun outgoingBody(d: Decoded): String? =
        if (d.type == "EXCD" && d.header.startsWith("EXCD $SENDER $RECEIVER ")) d.text else null

    fun parse(body: String): Msg {
        val f = body.split(',')
        val n = f.getOrNull(1)?.toIntOrNull()
        return when {
            f[0] == "RET" -> Msg.Ret(f.getOrElse(1) { "" }, f.getOrNull(2)?.toIntOrNull(), f.drop(3))
            f[0] == "GET" && n == 0 -> DeviceInfo.parse(f.drop(2))?.let { Msg.Info(it) } ?: Msg.Other(body)
            f[0] == "GET" && n == 10 -> Steps.parse(f.getOrElse(2) { "" })?.let { Msg.Today(it) } ?: Msg.Other(body)
            f[0] == "SET" && n == 40 -> Msg.FindPhone(f.getOrNull(2) == "1")
            f[0] == "SET" && n != null -> Msg.WatchSet(n, f.drop(2))
            f[0] == "SEND" && n != null -> Msg.Measure(n, f.drop(2))
            f[0] == "WEATHER" -> Msg.Ret("WEATHER", null, f.drop(1))
            else -> Msg.Other(body)
        }
    }

    /**
     * What to answer a watch-initiated message with, as FunDo does: RET,SET,<n>,1 for SET,14 and for SET,43,1; RET,GET,10
     * after the day's activity; nothing for find phone (SET,40: the 1802 write carries it) or a measurement.
     */
    fun replyTo(m: Msg): ByteArray? = when (m) {
        is Msg.WatchSet -> when {
            m.n == 14 -> ret("SET,14,1")
            m.n == 43 && m.args.firstOrNull() == "1" -> ret("SET,43,1")
            else -> null
        }
        is Msg.Today -> ret("GET,10")
        else -> null
    }
}

sealed class Msg {
    /** RET,<cmd>,<n>,…: the watch acknowledges one of ours (RET,SET,15 · RET,SET,40,1 · RET,SETNEW,2,52,1,1). */
    data class Ret(val cmd: String, val n: Int?, val args: List<String>) : Msg()
    data class Info(val info: DeviceInfo) : Msg()
    data class Today(val steps: Steps) : Msg()
    /** SET,40,1 / SET,40,0 from the watch: its "find phone" (the watch also writes the phone's 1802). */
    data class FindPhone(val on: Boolean) : Msg()
    /** Other watch-initiated SETs: 14 remote camera, 43 and 16 not known yet. */
    data class WatchSet(val n: Int, val args: List<String>) : Msg()
    /** SEND,100 / 101 / 102: an instant measurement (start, one value per second, end). Kept for Q6. */
    data class Measure(val n: Int, val args: List<String>) : Msg()
    data class Other(val body: String) : Msg()
}

/**
 * GET,0's reply, e.g. `GET,0,2502,2.024,1|240|240,1|0,0|0|21:00|09:00,0,0,10000|1|170|60|0|0|0|0-0-0,0,0,100,
 * 64:c0:f9:a2:62:61,XT2002D_AB024_Q71_T6_B_2104_V0.1_2111261102,0,0,2104,0,0,0,0|0|0|0|0,0`. The firmware, the MAC and
 * the screen are certain; the field before the MAC (100) is probably the battery in % — shown as unconfirmed.
 */
data class DeviceInfo(
    val fields: List<String>,
    val firmware: String?,
    val mac: String?,
    val width: Int?,
    val height: Int?,
    val stepGoal: Int?,
    val heightCm: Int?,
    val weightKg: Int?,
    /** Unconfirmed (M65 Telefonon ellenőrizni): the number just before the MAC. */
    val batteryGuess: Int?,
) {
    companion object {
        private val MAC = Regex("^[0-9a-fA-F]{2}(:[0-9a-fA-F]{2}){5}$")
        private val FW = Regex("^[A-Za-z0-9]+_[A-Za-z0-9_.]+$")

        fun parse(fields: List<String>): DeviceInfo? {
            if (fields.isEmpty()) return null
            val macAt = fields.indexOfFirst { MAC.matches(it) }
            val fw = fields.firstOrNull { FW.matches(it) && !MAC.matches(it) }
            val screen = fields.firstOrNull { it.count { c -> c == '|' } == 2 }?.split('|')
            val profile = fields.firstOrNull { it.count { c -> c == '|' } >= 3 && it.split('|')[0].toIntOrNull()?.let { g -> g >= 100 } == true }
                ?.split('|')
            val bat = if (macAt > 0) fields[macAt - 1].toIntOrNull()?.takeIf { it in 0..100 } else null
            return DeviceInfo(
                fields, fw, if (macAt >= 0) fields[macAt].uppercase() else null,
                screen?.getOrNull(1)?.toIntOrNull(), screen?.getOrNull(2)?.toIntOrNull(),
                profile?.getOrNull(0)?.toIntOrNull(), profile?.getOrNull(2)?.toIntOrNull(), profile?.getOrNull(3)?.toIntOrNull(),
                bat,
            )
        }
    }
}

/** GET,10's reply: "2026-11-22|0|0|0|0" = the day and its steps (the other three: distance, kcal, ? – unverified). */
data class Steps(val day: String, val steps: Int, val rest: List<String>) {
    companion object {
        fun parse(s: String): Steps? {
            val p = s.split('|')
            val steps = p.getOrNull(1)?.toIntOrNull() ?: return null
            return Steps(p[0], steps, p.drop(2))
        }
    }
}

/**
 * The watch's ACKY answer to SYNC <time>: its two Bluetooth addresses and its name, NUL-padded,
 * e.g. "64-c0-f9-a2-62-61 cb-1c-7f-39-dd-60 Q71".
 */
data class Acky(val classic: String?, val le: String?, val name: String?) {
    companion object {
        fun parse(d: Decoded): Acky? {
            if (d.type != "ACKY") return null
            val t = String(d.payload, Charsets.ISO_8859_1).substringBefore('\u0000').trim().split(' ')
            fun mac(s: String?) = s?.takeIf { it.length == 17 }?.replace('-', ':')?.uppercase()
            return Acky(mac(t.getOrNull(0)), mac(t.getOrNull(1)), t.getOrNull(2))
        }
    }
}
