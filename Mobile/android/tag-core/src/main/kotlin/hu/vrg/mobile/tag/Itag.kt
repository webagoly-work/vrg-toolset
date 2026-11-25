package hu.vrg.mobile.tag

// The iTag: the cheap teardrop "anti-lost" key tag (one big button, CR2032, ST17H26 inside; sold as iTag / iTracing).
// Unlike a Find My tag it is an ordinary Bluetooth LE device that Android connects to directly — no network, no
// account, no pairing dialog, a fixed (public) address — so on Android it does more than an Apple tag:
//
//  - ring it: write 0x01 to Immediate Alert (0x1802) / Alert Level (0x2A06), 0x00 stops it (every non-zero level
//    beeps the same);
//  - its button notifies 0x01 on 0xFFE0 / 0xFFE1 while connected: Telefonkereső rings the phone;
//  - battery: 0x180F / 0x2A19, 0..100 %;
//  - it slow-beeps by itself when a connection drops (its own anti-lost alarm); its button mutes it.
//
// Sources (docs/mobile/WP/M61.md): mcauser/micropython-aioble-itag (MIT, README + examples alert.py, button.py,
// scan.py) and the GATT dump in gist sash13/9dded88b135944cc6259a3eae792c82e. The advertised name starts with "iTAG"
// followed by spaces. Firmware varies (PCB v1.6, v1.8, v5.0); a Link Loss service (0x1803) is not in either source.

object Itag {
    const val NAME_PREFIX = "itag"
    const val UUID16_ALERT = 0x1802
    const val UUID16_LINK_LOSS = 0x1803
    const val UUID16_BATTERY = 0x180F
    const val UUID16_BUTTON = 0xFFE0
    const val CHAR_ALERT = 0x2A06
    const val CHAR_BATTERY = 0x2A19
    const val CHAR_BUTTON = 0xFFE1

    val ALERT_ON = byteArrayOf(0x01)
    val ALERT_OFF = byteArrayOf(0x00)

    /** The local name (AD 0x09 complete, else 0x08 shortened), trimmed; null if none. */
    fun localName(raw: ByteArray): String? {
        val f = FindMy.fields(raw)
        val name = (f.firstOrNull { it.type == 0x09 } ?: f.firstOrNull { it.type == 0x08 }) ?: return null
        return String(name.data, Charsets.UTF_8).trim { it <= ' ' || it == '\u0000' }.ifEmpty { null }
    }

    fun isItag(raw: ByteArray): Boolean =
        localName(raw)?.lowercase()?.startsWith(NAME_PREFIX) == true || UUID16_BUTTON in FindMy.uuid16s(raw)

    /** An iTag's advertisement, or null. It carries nothing else of use (no battery, no state). */
    fun parse(raw: ByteArray): FindMyAd? =
        if (isItag(raw)) FindMyAd(AdKind.ITAG, TagType.ITAG, Battery.UNKNOWN, null, null, null) else null

    /** Battery Level: one byte, 0..100 %. */
    fun battery(value: ByteArray?): Int? = value?.firstOrNull()?.toInt()?.and(0xFF)?.takeIf { it <= 100 }

    /** A button notification (always 0x01 on the known firmware; any non-zero byte counts). */
    fun isPress(value: ByteArray?): Boolean = value != null && value.isNotEmpty() && value[0].toInt() != 0

    /** Battery percent to the Find My-style level, so one label serves both. */
    fun level(pct: Int?): Battery = when {
        pct == null -> Battery.UNKNOWN
        pct >= 60 -> Battery.FULL
        pct >= 30 -> Battery.MEDIUM
        pct >= 12 -> Battery.LOW
        else -> Battery.CRITICAL
    }
}

/**
 * Telefonkereső: the iTag's button rings the phone, the next press (on the tag or on the screen) stops it, and it stops
 * by itself after [ringMs]. Presses closer than [debounceMs] count once (a firmware may send more than one notification).
 */
class PhoneFinder(val ringMs: Long = 30_000, val debounceMs: Long = 400) {
    enum class Action { RING, STOP }

    var ringingSince: Long? = null
        private set
    private var lastPress = Long.MIN_VALUE / 2

    val ringing: Boolean get() = ringingSince != null

    /** The tag's button. Null = ignored (a bounce). */
    fun press(now: Long): Action? {
        if (now - lastPress < debounceMs) return null
        lastPress = now
        return if (ringingSince == null) { ringingSince = now; Action.RING } else { ringingSince = null; Action.STOP }
    }

    /** "Megvan" on the phone. */
    fun stop() { ringingSince = null }

    /** True once when the ring has run its time out. */
    fun tick(now: Long): Boolean {
        val since = ringingSince ?: return false
        if (now - since < ringMs) return false
        ringingSince = null
        return true
    }
}
