package hu.vrg.mobile.core

import org.json.JSONArray
import org.json.JSONObject

// PC ablakok (WP M23): the phone's side of the PC's work folders, as plain rules. With a paired PC whose relay runs with --files, the
// relay lists the work roots (D-17: Repó, VRG Full, Közös), a folder, a look at one file, and copies a file onto the Átadás board
// (M12), where the phone takes it as any board file. The relay's rules: Planner/projects/varler-planner/tools/relay-files.js.
//
// The phone never sends a path: every row carries a handle the relay made (16 hex), and the phone sends one back, a place key (a
// Desktop unit such as Munkák) or nothing (the roots). A row whose handle is not of that shape is dropped here too.

data class PcRow(val h: String, val name: String, val dir: Boolean, val bytes: Long, val mtime: Long)
data class PcCrumb(val h: String, val name: String)

data class PcListing(
    val ok: Boolean,
    val trusted: Boolean = true,
    /** The relay runs with --files. */
    val on: Boolean = false,
    /** The folder's handle; null = the roots. */
    val h: String? = null,
    val root: String? = null,
    val crumbs: List<PcCrumb> = emptyList(),
    val entries: List<PcRow> = emptyList(),
    val truncated: Boolean = false,
    val reason: String? = null,
) {
    val atRoots: Boolean get() = h == null
    /** One level up: the crumb before the last, or the roots (null) from a root. */
    val up: String? get() = if (crumbs.size >= 2) crumbs[crumbs.size - 2].h else null
    val title: String get() = crumbs.joinToString(" / ") { it.name }.ifEmpty { "A PC munkamappái" }
}

enum class PcKind { TEXT, IMAGE, BINARY }

data class PcLook(
    val ok: Boolean, val h: String?, val name: String, val size: Long, val kind: PcKind,
    val text: String? = null, val encoding: String? = null, val mime: String? = null, val data: String? = null,
    val truncated: Boolean = false, val reason: String? = null, val trusted: Boolean = true,
)

data class PcCopied(val ok: Boolean, val id: String?, val name: String?, val bytes: Long, val reason: String?)

sealed interface PcNote {
    data class Listed(val listing: PcListing) : PcNote
    data class Looked(val look: PcLook) : PcNote
    data class Copied(val copied: PcCopied) : PcNote
}

object PcFiles {
    const val CAP = "files"
    private val H = Regex("^[0-9a-f]{16}$")
    private val PLACE = Regex("^[a-z0-9-]{1,24}$")
    private val BOARD_ID = Regex("^[0-9a-f]{16}$")
    private val MIMES = setOf("image/png", "image/jpeg", "image/gif", "image/webp")

    fun isHandle(h: String?): Boolean = h != null && H.matches(h)

    /** The roots (no handle), a folder by its handle, or a place (a Desktop unit's folder) by its key. Null for a bad handle / key. */
    fun list(h: String? = null, place: String? = null): String? = when {
        h != null -> if (isHandle(h)) RelayMsgs.build("files.list", JSONObject().put("h", h), "relay") else null
        place != null -> if (PLACE.matches(place)) RelayMsgs.build("files.list", JSONObject().put("place", place), "relay") else null
        else -> RelayMsgs.build("files.list", JSONObject(), "relay")
    }

    fun read(h: String): String? = if (isHandle(h)) RelayMsgs.build("files.read", JSONObject().put("h", h), "relay") else null
    fun copy(h: String): String? = if (isHandle(h)) RelayMsgs.build("files.copy", JSONObject().put("h", h), "relay") else null

    /** The Desktop units that open the browser at their own folder (Mobile/catalogue/files.json → places). */
    val PLACES = setOf("jobs", "bridge", "workflow-kit")

    private fun str(o: JSONObject?, k: String): String? =
        if (o == null || !o.has(k) || o.isNull(k)) null else o.optString(k).takeIf { it.isNotEmpty() }

    private fun <T> objects(a: JSONArray?, f: (JSONObject) -> T?): List<T> = buildList {
        if (a != null) for (i in 0 until a.length()) a.optJSONObject(i)?.let(f)?.let(::add)
    }

    /** A name to show: no path separators or control characters reach the screen as a path. */
    private fun name(o: JSONObject?): String? = str(o, "name")?.takeIf { n -> n.length <= 255 && n.none { it == '/' || it == '\\' || it < ' ' } }

    fun parse(raw: String): PcNote? {
        val m = try { JSONObject(raw) } catch (e: Exception) { return null }
        if (m.optString("from") != "relay") return null
        val p = m.optJSONObject("payload") ?: return null
        val ok = p.optBoolean("ok", false)
        return when (m.optString("type")) {
            "files" -> PcNote.Listed(PcListing(
                ok, p.optBoolean("trusted", true), p.optBoolean("on", false),
                str(p, "h")?.takeIf(::isHandle), str(p, "root"),
                objects(p.optJSONArray("crumbs")) { c -> str(c, "h")?.takeIf(::isHandle)?.let { h -> PcCrumb(h, name(c) ?: "?") } },
                objects(p.optJSONArray("entries")) { e ->
                    val h = str(e, "h")?.takeIf(::isHandle) ?: return@objects null
                    PcRow(h, name(e) ?: return@objects null, e.optBoolean("dir", false), e.optLong("bytes", 0).coerceAtLeast(0), e.optLong("mtime", 0))
                },
                p.optBoolean("truncated", false), str(p, "reason"),
            ))
            "files.read" -> {
                val kind = when (str(p, "kind")) { "text" -> PcKind.TEXT; "image" -> PcKind.IMAGE; else -> PcKind.BINARY }
                val mime = str(p, "mime")?.takeIf { it in MIMES }
                PcNote.Looked(PcLook(ok, str(p, "h")?.takeIf(::isHandle), name(p) ?: "", p.optLong("size", 0),
                    if (kind == PcKind.IMAGE && mime == null) PcKind.BINARY else kind,
                    if (kind == PcKind.TEXT) str(p, "text") ?: "" else null, str(p, "encoding"), mime,
                    if (kind == PcKind.IMAGE && mime != null) str(p, "data") else null,
                    p.optBoolean("truncated", false), str(p, "reason"), p.optBoolean("trusted", true)))
            }
            "files.copied" -> {
                val e = p.optJSONObject("entry")
                PcNote.Copied(PcCopied(ok, str(e, "id")?.takeIf { BOARD_ID.matches(it) }, name(e), e?.optLong("bytes", 0) ?: 0, str(p, "reason")))
            }
            else -> null
        }
    }

    /** 0 B, 2,0 kB, 1,5 MB — the Desktop's Hungarian decimal comma. */
    fun size(bytes: Long): String = when {
        bytes < 1024 -> "$bytes B"
        bytes < 1024 * 1024 -> String.format(java.util.Locale.ROOT, "%.1f kB", bytes / 1024.0).replace('.', ',')
        bytes < 1024L * 1024 * 1024 -> String.format(java.util.Locale.ROOT, "%.1f MB", bytes / 1024.0 / 1024).replace('.', ',')
        else -> String.format(java.util.Locale.ROOT, "%.1f GB", bytes / 1024.0 / 1024 / 1024).replace('.', ',')
    }
}
