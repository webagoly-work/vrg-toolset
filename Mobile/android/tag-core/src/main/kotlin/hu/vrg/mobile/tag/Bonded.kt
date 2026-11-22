package hu.vrg.mobile.tag

// The third kind of item (WP M61, 2026-11-22): a device already paired with the phone in Android's Bluetooth settings —
// the Founder's Q71 calling smartwatch first (a FunDo-app watch), but equally earbuds or a speaker. Its maker's protocol
// is undocumented (FunDo), so nothing brand-specific is spoken; everything rests on what Android itself offers for any
// paired device:
//
//  - whether it is connected now (ACL connected / disconnected, the hands-free and media profiles): while it is, mine
//    counts as heard (TagBook.heardLinked), so Ottfelejtés rings when the connection has been gone for its time;
//  - a calling watch is a hands-free headset (HFP), so the phone can route a tone to it over SCO: it plays out of the
//    watch's own speaker (Csipogtatás, the shell's WatchRinger);
//  - many such watches also advertise over BLE under the same name (or the name with a suffix, "Q71-LE"): that gives
//    the distance (RSSI), credited to mine by name.
//
// Binding is by choosing it from the phone's paired list, not by holding it to the phone: the pairing already says it
// is ours.

object Bonded {
    /** The advertisement-less stand-in for a paired device in the tag book. */
    val AD = FindMyAd(AdKind.BONDED, TagType.WATCH, Battery.UNKNOWN, null, null, null)

    /** Short or generic names that would match strangers' devices; never matched by name. */
    private val TOO_GENERIC = setOf("watch", "smart watch", "smartwatch", "band", "bt", "ble", "audio", "headset")

    private fun norm(s: String?): String = s.orEmpty().trim { it <= ' ' || it == '\u0000' }.lowercase()

    /**
     * Is a BLE advertisement named [advertised] the paired device named [paired]? Equal names, or one is the other plus
     * a separator and a suffix ("Q71" / "Q71-LE", "Q71_BLE", "Q71 LE"). At least three characters, never a generic name.
     */
    fun sameDevice(paired: String?, advertised: String?): Boolean {
        val p = norm(paired); val a = norm(advertised)
        if (p.length < 3 || a.length < 3 || p in TOO_GENERIC || a in TOO_GENERIC) return false
        if (p == a) return true
        val (short, long) = if (p.length <= a.length) p to a else a to p
        return long.startsWith(short) && long[short.length] in " -_("
    }

    /** What kind of paired device the phone says it is, for the label (BluetoothClass major device class). */
    fun kindLabel(majorClass: Int?): String = when (majorClass) {
        0x0700 -> "óra / viselhető"
        0x0400 -> "hang (fülhallgató, hangszóró)"
        0x0200 -> "telefon"
        0x0100 -> "számítógép"
        else -> "párosított eszköz"
    }
}
