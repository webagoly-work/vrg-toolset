package hu.vrg.mobile.core

import org.json.JSONObject

// The PC's vital signs for the Vezérlőpult (Fényjel R2, shared/fenyjel/DESIGN.md §7.2): the phone's half of `sys.stats`
// (Planner/projects/varler-planner/tools/relay-sys.js answers it). Pure Kotlin, so SysTest checks it without the SDK.

/** One reading of the PC. Shares are 0…1; sizes are bytes; [disk] is null when the PC could not read its drive. */
data class SysStats(
    val ok: Boolean,
    val host: String,
    val cpu: Float,
    val cores: Int,
    val memUsed: Long,
    val memTotal: Long,
    val disk: Disk?,
    val uptimeS: Long,
    val reason: String? = null,
) {
    data class Disk(val used: Long, val total: Long, val root: String)

    val memShare: Float get() = Sys.share(memUsed, memTotal)
    val diskShare: Float? get() = disk?.let { Sys.share(it.used, it.total) }
}

/** How a gauge reads: normal, or over its limit (the warn colour and LED; DESIGN.md §4.2). */
enum class Gauge { OK, WARN }

object Sys {
    const val CAP = "sys"
    /** How often the Vezérlőpult asks while it is on screen. */
    const val EVERY_MS = 3000L
    const val CPU_WARN = 0.9f
    const val MEM_WARN = 0.85f
    const val DISK_WARN = 0.85f

    fun share(used: Long, total: Long): Float = if (total <= 0) 0f else (used.toDouble() / total).coerceIn(0.0, 1.0).toFloat()

    fun gauge(share: Float, warnAt: Float): Gauge = if (share >= warnAt) Gauge.WARN else Gauge.OK

    /** A share as a whole percent, "34%". */
    fun percent(share: Float): String = "${(share.coerceIn(0f, 1f) * 100).toInt()}%"

    /** Bytes as GB with one decimal and a Hungarian comma: "12,4 GB". */
    fun gb(bytes: Long): String {
        val tenths = Math.round(bytes / 1e8)           // 0.1 GB steps, 1 GB = 1e9 bytes (as drives are sold)
        return "${tenths / 10},${tenths % 10} GB"
    }

    /** Uptime the short way: "45 p", "3 ó 12 p", "2 n 4 ó". */
    fun uptime(s: Long): String {
        val m = s / 60; val h = m / 60; val d = h / 24
        return when {
            d > 0 -> "$d n ${h % 24} ó"
            h > 0 -> "$h ó ${m % 60} p"
            else -> "$m p"
        }
    }
}

object SysMsgs {
    fun stats(): String = RelayMsgs.build("sys.stats", JSONObject(), "relay")

    /** The relay's `sys` answer, or null for anything else (another type, not from the relay, broken JSON). */
    fun parse(raw: String): SysStats? {
        val m = try { JSONObject(raw) } catch (e: Exception) { return null }
        if (m.optString("from") != "relay" || m.optString("type") != "sys") return null
        val p = m.optJSONObject("payload") ?: return null
        if (!p.optBoolean("ok", false)) return SysStats(false, "", 0f, 0, 0, 0, null, 0, p.optString("reason", "").ifEmpty { null })
        val mem = p.optJSONObject("mem")
        val d = p.optJSONObject("disk")
        val drive = d?.let { disk(it.optLong("used", 0), it.optLong("total", 0), it.optString("root", "")) }?.takeIf { it.total > 0 }
        return SysStats(
            ok = true,
            host = p.optString("host", "").take(64),
            cpu = p.optDouble("cpu", 0.0).let { if (it.isNaN()) 0.0 else it }.coerceIn(0.0, 1.0).toFloat(),
            cores = p.optInt("cores", 0).coerceAtLeast(0),
            memUsed = mem?.optLong("used", 0) ?: 0,
            memTotal = mem?.optLong("total", 0) ?: 0,
            disk = drive,
            uptimeS = p.optLong("uptime", 0).coerceAtLeast(0),
        )
    }

    private fun disk(used: Long, total: Long, root: String) = SysStats.Disk(used.coerceAtLeast(0), total, root.take(16))
}
