package hu.vrg.mobile.core

import java.util.Locale

// Hálózat's usage watch (WP M7): the day's mobile data from TrafficStats' since-boot counters, and the one
// warning a day when it passes the threshold the user set. TrafficStats restarts from zero at every boot,
// so the day keeps a carried part: what was counted before the reboot. Bytes between the last sample and a
// reboot are lost (a sample a minute keeps that small). The day starts at the first sample of that day, so
// a phone that was not watching in the morning shows "since watching started" — the screen says so.

data class UsageDay(
    /** yyyy-MM-dd, local time. */
    val day: String,
    /** The counter's value at the day's first sample, or after a reboot (then 0). */
    val base: Long,
    /** The counter at the last sample. */
    val last: Long,
    /** Counted before the last reboot today. */
    val carried: Long = 0,
    /** The day the threshold warning went out, so it rings once a day. */
    val warned: String? = null,
) {
    val today: Long get() = carried + (last - base)

    fun encode() = listOf(day, base, last, carried, warned ?: "").joinToString("|")

    companion object {
        fun decode(s: String?): UsageDay? {
            val p = s?.split('|') ?: return null
            if (p.size != 5) return null
            return UsageDay(p[0], p[1].toLongOrNull() ?: return null, p[2].toLongOrNull() ?: return null,
                p[3].toLongOrNull() ?: return null, p[4].ifEmpty { null })
        }
    }
}

object Usage {
    /** TrafficStats.UNSUPPORTED */
    const val UNSUPPORTED = -1L

    /** The thresholds offered on the screen, in MB; 0 = no warning. */
    val THRESHOLDS_MB = listOf(0, 500, 1000, 2000, 5000, 10000)

    fun sample(prev: UsageDay?, day: String, raw: Long): UsageDay? {
        if (raw < 0) return prev
        if (prev == null) return UsageDay(day, raw, raw)
        if (prev.day != day) return UsageDay(day, raw, raw, 0, prev.warned)
        if (raw < prev.last) return prev.copy(base = 0, last = raw, carried = prev.today)   // rebooted
        return prev.copy(last = raw)
    }

    fun shouldWarn(d: UsageDay?, thresholdMb: Int): Boolean =
        d != null && thresholdMb > 0 && d.today >= thresholdMb * 1_000_000L && d.warned != d.day

    fun warned(d: UsageDay) = d.copy(warned = d.day)

    /** 1,2 GB · 850 MB · 12 kB, Hungarian decimal comma, SI units like the phone's own data page. */
    fun format(bytes: Long): String {
        val b = maxOf(0, bytes).toDouble()
        fun one(v: Double) = String.format(Locale.ROOT, "%.1f", v).replace('.', ',')
        return when {
            b >= 1e9 -> one(b / 1e9) + " GB"
            b >= 1e6 -> String.format(Locale.ROOT, "%.0f", b / 1e6) + " MB"
            b >= 1e3 -> String.format(Locale.ROOT, "%.0f", b / 1e3) + " kB"
            else -> "${b.toLong()} B"
        }
    }

    /**
     * The notification's text. The day figure is the whole phone's mobile data (research §3), so it is called
     * that; the hotspot interface's own bytes (Android 12+, since the hotspot came on) are added when known.
     */
    fun line(d: UsageDay?, hotspotBytes: Long? = null): String {
        val day = "mobilnet ma: ${format(d?.today ?: 0)}"
        return if (hotspotBytes != null && hotspotBytes >= 0) "Hotspot: ${format(hotspotBytes)} · $day" else "Hotspot be · $day"
    }

    fun thresholdLabel(mb: Int): String = if (mb <= 0) "nincs" else format(mb * 1_000_000L)
}
