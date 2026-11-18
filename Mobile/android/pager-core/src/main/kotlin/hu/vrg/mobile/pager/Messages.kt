package hu.vrg.mobile.pager

// The Site Pager's vocabulary, kept code for code (Archive/files/site-pager-builder.html, the Mark Plan doc), so a
// phone and a future nRF905 pager speak the same numbers: the 14 messages, the 14 packet types, the alarm reasons
// and the panel's key map (K1–K3 short / long). Only the labels are new: Hungarian on the phone, the original
// English kept beside them.

/** Packet types of the 8-byte frame. 0 is the phone's idle beacon (presence only); 1–14 are the pager's. */
enum class PType(val code: Int, val label: String) {
    IDLE(0, "jelenlét"),
    HOLD(1, "HÍVÁS"),          // CALL held: the partner buzzes while it lasts
    GOTIT(2, "MEGKAPTA"),      // device-level delivery receipt; arg = the acked seq
    SEEN(3, "LÁTTA"),          // a person pressed SEEN; arg = the seen seq (0 = generic "I saw it")
    TEXTMSG(4, "ÜZENET"),      // arg = message code 1–14
    PING(5, "LINK TESZT"),
    RELAY(6, "RELÉ"),
    RELAYSTATE(7, "RELÉ ÁLLAPOT"),
    HUBCMD(8, "PARANCS"),      // arg = target × 16 + action; the phone answers target 4 (guard) only
    HUBSTATE(9, "ÁLLAPOT"),
    ALARM(10, "RIASZTÁS"),     // arg = AlarmReason
    ARMSTATE(11, "ŐRZÉS"),     // arg = 0 off, 1 exit delay, 2 armed, 3 entry delay
    HELLO(12, "JELEN"),        // roll-call answer; arg = battery %
    ROLLCALL(13, "NÉVSOR"),
    BATT(14, "AKKU"),          // arg = battery %
    ;

    companion object {
        fun of(code: Int): PType? = entries.firstOrNull { it.code == code }
    }
}

/** One of the pager's fixed messages. [en] is the original wording. */
data class PagerMsg(
    val code: Int,
    val hu: String,
    val en: String,
    /** A message about switching power: the screen says it is a sign, never a lockout, and asks for SEEN. */
    val power: Boolean = false,
    val urgent: Boolean = false,
)

object Messages {
    val ALL: List<PagerMsg> = listOf(
        PagerMsg(1, "GYERE IDE", "COME HERE"),
        PagerMsg(2, "KAPCSOLD LE", "POWER OFF", power = true),
        PagerMsg(3, "KÉSZ", "DONE"),
        PagerMsg(4, "SÜRGŐS: GYERE", "URGENT: COME", urgent = true),
        PagerMsg(5, "KAPCSOLD FEL", "POWER ON", power = true),
        PagerMsg(6, "SZERSZÁM KELL", "NEED TOOL"),
        PagerMsg(7, "SZÜNET", "BREAK"),
        PagerMsg(8, "NÉZD AZ ELOSZTÓT", "CHECK BOARD"),
        PagerMsg(9, "AJTÓ NYITVA", "DOOR OPEN"),
        PagerMsg(10, "KAPU", "GATE"),
        PagerMsg(11, "MOZGÁS", "MOTION"),
        PagerMsg(12, "MINDENKI KI", "ALL OUT", urgent = true),
        PagerMsg(13, "GYERE A BÁZISRA", "COME TO BASE"),
        PagerMsg(14, "GYENGE AKKU", "LOW BATTERY"),
    )

    fun byCode(code: Int): PagerMsg? = ALL.firstOrNull { it.code == code }

    fun label(code: Int): String = byCode(code)?.hu ?: "ÜZENET $code"

    const val POWER_NOTE = "Üzenet, nem reteszelés: a feszültségmentesítés és a LOTO szabályai érvényesek. Kapcsolás előtt várd meg a LÁTTA jelzést."
}

/** The panel's three keys as the Mark I pager had them: short = 1 / 2 / 3, long = 4 / 5 / 6. */
enum class Key(val short: Int, val long: Int) {
    K1(1, 4), K2(2, 5), K3(3, 6);
}

/** Why a unit raised ALARM. 1–6 are the pager's guard loop and modules; 7 is the phone's man-down. */
enum class AlarmReason(val code: Int, val hu: String) {
    LID(1, "fedél"),
    LIFT(2, "felemelték"),
    TILT(3, "megdöntötték"),
    MOTION(4, "mozgás"),
    BUTTON(5, "gomb"),
    DOOR(6, "ajtó"),
    MAN_DOWN(7, "mozdulatlan / elesett"),
    SOS(8, "vészjelzés"),
    ;

    companion object {
        fun of(code: Int): AlarmReason? = entries.firstOrNull { it.code == code }
    }
}

/**
 * Vibration patterns, as [off, on, off, on, ...] milliseconds (Android's waveform shape). "Pulse count = message key,
 * long pulses = long press" (the builder's haptics note): code 1–3 are 1–3 short pulses, 4–6 are 1–3 long ones, so
 * the pocket tells which key was pressed. 7–14 get two-beat rhythms of their own.
 */
object Haptics {
    private const val S = 90L
    private const val L = 380L
    private const val GAP = 120L

    private fun beats(vararg on: Long): LongArray {
        val out = ArrayList<Long>()
        out += 0L
        on.forEachIndexed { i, v -> if (i > 0) out += GAP; out += v }
        return out.toLongArray()
    }

    fun forMessage(code: Int): LongArray = when (code) {
        1 -> beats(S); 2 -> beats(S, S); 3 -> beats(S, S, S)
        4 -> beats(L); 5 -> beats(L, L); 6 -> beats(L, L, L)
        7 -> beats(S, L); 8 -> beats(L, S); 9 -> beats(S, S, L); 10 -> beats(L, L, S)
        11 -> beats(S, L, S); 12 -> beats(L, S, L, S, L); 13 -> beats(S, S, L, L); 14 -> beats(L, S, S)
        else -> beats(S, S)
    }

    /** Builder: link OK = 120 on / 120 off / 120 on; no link = one 700 ms. */
    val LINK_OK = longArrayOf(0, 120, 120, 120)
    val NO_REPLY = longArrayOf(0, 700)
    val DELIVERED = longArrayOf(0, 40)
    val SEEN_BACK = longArrayOf(0, 40, 80, 40)
    /** CALL held by the partner: repeated while it lasts. */
    val CALL = longArrayOf(0, 400, 200)
    val ALARM = longArrayOf(0, 600, 150, 600, 150, 600, 400)
}
