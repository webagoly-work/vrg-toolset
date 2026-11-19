package hu.vrg.mobile.kit

import android.os.SystemClock

// Which vrg:// link came from the app's own QR scanner (2026-11-19). The scanner hands a link back through the
// shell's link routing, the same road a link tapped in a messenger takes, so a feature cannot tell them apart from
// the Route alone. The scanner marks the link here, in this process, just before it opens it; a feature asks once.
// Another app cannot set this mark (it is not an Intent extra), which is why Eszközök may trust it: a request QR
// read off the other phone's screen by the owner's own scanner is approved without the code check by eye.

object ScannedLinks {
    private const val FRESH_MS = 15_000L
    private var last: String? = null
    private var at = 0L

    /** The scanner: [raw] is about to be opened. */
    @Synchronized
    fun mark(raw: String) { last = raw.trim(); at = SystemClock.elapsedRealtime() }

    /** True once if the scanner opened a link containing [part] in the last few seconds; the mark is used up. */
    @Synchronized
    fun consume(part: String): Boolean {
        val l = last ?: return false
        val ok = part.isNotEmpty() && l.contains(part) && SystemClock.elapsedRealtime() - at <= FRESH_MS
        if (ok) last = null
        return ok
    }
}
