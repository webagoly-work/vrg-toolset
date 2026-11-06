package hu.vrg.mobile.core

import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder
import java.security.MessageDigest
import java.text.Normalizer

// Átadás (WP M12): the file board between the phone and the PC, the parts that are rules rather than
// Android. The relay (Planner/projects/varler-planner/tools/relay-board.js) keeps the board in
// <Full>\inbox\board\; a trusted (paired, M2) phone lists it and removes from it over the socket, and
// moves files over plain HTTP with a one-transfer ticket in the X-VRG-Ticket header (never in the URL).
//
//   phone ─ board.list ─▶ relay ─ board.listed{ok, entries[]}
//   phone ─ board.ticket{op:'upload'|'download', id} ─▶ board.ticket{ok, ticket, ttl}
//         ─ POST /board/upload?name=&sha256=&target=   (X-VRG-Ticket)  ─▶ {ok, entry, delivered}
//         ─ GET  /board/file/<id>                     (X-VRG-Ticket)  ─▶ the bytes, X-VRG-Sha256
//   phone ─ board.remove{id} ─▶ board.removed{ok, id}      relay ─ board{event:'added'|'removed', …} to all
//   phone ─ clip.set{text} / clip.get ─▶ clip{ok, text?}: the PC's clipboard, text only

enum class DropFrom { PC, PHONE }

enum class DropTarget(val wire: String, val label: String) {
    INBOX("inbox", "Tábla"), PLANNER("planner", "Planner"), INVENTORY("inventory", "Inventory");

    companion object {
        fun of(s: String?): DropTarget? = entries.firstOrNull { it.wire == s }
    }
}

data class DropEntry(
    /** 16 hex: what download tickets and board.remove take. */
    val id: String,
    /** The name as the relay stored it (already sanitised there). */
    val name: String,
    val bytes: Long,
    val sha256: String,
    val from: DropFrom,
    /** ISO time it landed, as the relay wrote it. */
    val at: String,
    val target: DropTarget,
)

data class DropList(val ok: Boolean, val trusted: Boolean, val entries: List<DropEntry>, val reason: String?)
data class DropTicket(val ok: Boolean, val ticket: String?, val op: String?, val id: String?, val ttlMs: Long, val reason: String?, val trusted: Boolean)
data class DropRemoved(val ok: Boolean, val id: String?, val reason: String?, val trusted: Boolean)
data class DropClip(val ok: Boolean, val op: String?, val text: String?, val truncated: Boolean, val reason: String?, val trusted: Boolean)
/** An entry that came onto the board ([added]) or went off it, from either side. */
data class DropEvent(val added: Boolean, val entry: DropEntry)

sealed interface DropNote {
    data class Listed(val list: DropList) : DropNote
    data class Ticket(val ticket: DropTicket) : DropNote
    data class Removed(val result: DropRemoved) : DropNote
    data class Clip(val clip: DropClip) : DropNote
    data class Event(val event: DropEvent) : DropNote
}

/** The answer of POST /board/upload. */
data class DropUploaded(val ok: Boolean, val entry: DropEntry?, val delivered: Int, val reason: String?)

object Drop {
    const val CAP = "drop"
    const val TICKET_HEADER = "X-VRG-Ticket"
    const val SHA_HEADER = "X-VRG-Sha256"
    const val MAX_BYTES = 50L * 1024 * 1024
    const val CLIP_MAX = 100_000

    private val ID = Regex("[0-9a-f]{16}")
    private val TICKET = Regex("[0-9a-f]{32}")
    private val SHA = Regex("[0-9a-f]{64}")
    private val HOST = Regex("[A-Za-z0-9.\\-]+|\\[[0-9A-Fa-f:.]+]")
    private val RESERVED = Regex("(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³]|conin\\$|conout\\$|clock\\$)", RegexOption.IGNORE_CASE)
    private val STRIP = Regex("[\\u0000-\\u001f\\u007f-\\u009f\\u200e\\u200f\\u202a-\\u202e\\u2066-\\u2069\\ufeff]")

    fun validId(id: String?): Boolean = id != null && ID.matches(id)
    fun validTicket(t: String?): Boolean = t != null && TICKET.matches(t)
    fun validSha(s: String?): Boolean = s != null && SHA.matches(s)

    /**
     * The same rule as relay-board.js cleanName(): the last path segment, no control or bidi-override
     * characters, none of < > : " | ? *, no leading or trailing dots and spaces, 120 characters at most
     * with the extension kept, a Windows device name prefixed with "_". Used for what the phone saves.
     */
    fun cleanName(raw: String?): String {
        var s = Normalizer.normalize(raw ?: "", Normalizer.Form.NFC).replace(STRIP, "")
        s = s.split('\\', '/').last()
        s = s.replace(Regex("[<>:\"|?*]"), "_").replace(Regex("\\s+"), " ").trim()
            .replace(Regex("^[.\\s]+"), "").replace(Regex("[.\\s]+$"), "")
        val cps = s.codePoints().toArray()
        if (cps.size > 120) {
            val ext = Regex("\\.[A-Za-z0-9]{1,10}$").find(s)?.value ?: ""
            s = String(cps, 0, 120 - ext.length).replace(Regex("[.\\s]+$"), "") + ext
        }
        if (RESERVED.matches(s.substringBefore('.').trim())) s = "_$s"
        return s.ifEmpty { "fajl" }
    }

    /** "ws://192.168.1.24:47291" -> "http://192.168.1.24:47291", or null for anything else. */
    fun httpBase(relayWs: String): String? {
        if (!relayWs.startsWith("ws://")) return null
        val hostPort = relayWs.removePrefix("ws://").substringBefore('/')
        val host = hostPort.substringBeforeLast(':')
        val port = hostPort.substringAfterLast(':').toIntOrNull()
        if (!HOST.matches(host) || !Ports.validPort(port)) return null
        return "http://$host:$port"
    }

    private fun enc(s: String) = URLEncoder.encode(s, "UTF-8").replace("+", "%20")

    /** The upload address; the ticket goes in a header, never here. Null when a part is malformed. */
    fun uploadUrl(relayWs: String, name: String, sha256: String, target: DropTarget): String? {
        val base = httpBase(relayWs) ?: return null
        if (!validSha(sha256) || name.isBlank()) return null
        return "$base/board/upload?name=${enc(name)}&sha256=$sha256&target=${target.wire}"
    }

    fun fileUrl(relayWs: String, id: String): String? {
        val base = httpBase(relayWs) ?: return null
        return if (validId(id)) "$base/board/file/$id" else null
    }

    fun hex(b: ByteArray): String = b.joinToString("") { "%02x".format(it.toInt() and 0xff) }

    fun sha256(b: ByteArray): String = hex(MessageDigest.getInstance("SHA-256").digest(b))

    /** The relay's ISO time (UTC) as the phone's local "2026-11-06 09:20"; "" when it does not parse. */
    fun localTime(iso: String, zone: java.time.ZoneId = java.time.ZoneId.systemDefault()): String = try {
        java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").format(java.time.Instant.parse(iso).atZone(zone))
    } catch (e: Exception) { "" }

    /** "830 B", "12 KB", "3.4 MB". */
    fun sizeText(bytes: Long): String = when {
        bytes < 1024 -> "$bytes B"
        bytes < 1024 * 1024 -> "${bytes / 1024} KB"
        else -> String.format(java.util.Locale.ROOT, "%.1f MB", bytes / 1048576.0)
    }

    private val MIME = mapOf(
        "jpg" to "image/jpeg", "jpeg" to "image/jpeg", "png" to "image/png", "gif" to "image/gif", "webp" to "image/webp",
        "heic" to "image/heic", "pdf" to "application/pdf", "txt" to "text/plain", "csv" to "text/csv", "json" to "application/json",
        "zip" to "application/zip", "mp4" to "video/mp4", "mp3" to "audio/mpeg", "dxf" to "application/dxf",
        "docx" to "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xlsx" to "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )

    /** The type the phone saves a download as, from its extension; the relay always sends octet-stream. */
    fun mimeOf(name: String): String = MIME[name.substringAfterLast('.', "").lowercase()] ?: "application/octet-stream"

    fun isImage(name: String): Boolean = mimeOf(name).startsWith("image/")

    /** The phone's note after an upload. */
    fun uploadedText(u: DropUploaded): String {
        if (!u.ok) return "Nem ment át: ${u.reason ?: "?"}"
        val e = u.entry ?: return "Átküldve."
        return when (e.target) {
            DropTarget.INBOX -> "A PC tábláján: ${e.name}"
            else -> if (u.delivered > 0) "Átküldve a(z) ${e.target.label} felé: ${e.name}"
            else "A táblán: ${e.name} (a(z) ${e.target.label} nincs megnyitva a PC-n)"
        }
    }
}

object DropMsgs {
    fun list(): String = RelayMsgs.build("board.list", JSONObject(), "relay")
    fun ticketUpload(): String = RelayMsgs.build("board.ticket", JSONObject().put("op", "upload"), "relay")
    fun ticketDownload(id: String): String? =
        if (Drop.validId(id)) RelayMsgs.build("board.ticket", JSONObject().put("op", "download").put("id", id), "relay") else null
    fun remove(id: String): String? = if (Drop.validId(id)) RelayMsgs.build("board.remove", JSONObject().put("id", id), "relay") else null
    fun clipGet(): String = RelayMsgs.build("clip.get", JSONObject(), "relay")

    /** Null for empty or too long text; the relay checks again. */
    fun clipSet(text: String): String? =
        if (text.isEmpty() || text.length > Drop.CLIP_MAX) null else RelayMsgs.build("clip.set", JSONObject().put("text", text), "relay")

    private fun str(o: JSONObject?, k: String): String? =
        if (o == null || !o.has(k) || o.isNull(k)) null else o.optString(k).takeIf { it.isNotEmpty() }

    /** One entry, or null when its id, size, origin or target is not one the relay could have sent. */
    fun entry(e: JSONObject?): DropEntry? {
        if (e == null) return null
        val id = str(e, "id")?.takeIf { Drop.validId(it) } ?: return null
        val bytes = e.optLong("bytes", -1).takeIf { it >= 0 } ?: return null
        val from = when (str(e, "from")) { "phone" -> DropFrom.PHONE; "pc" -> DropFrom.PC; else -> return null }
        val target = DropTarget.of(str(e, "target")) ?: return null
        return DropEntry(id, Drop.cleanName(str(e, "name")), bytes, str(e, "sha256") ?: "", from, str(e, "at") ?: "", target)
    }

    private fun entries(a: JSONArray?): List<DropEntry> = buildList {
        if (a != null) for (i in 0 until a.length()) entry(a.optJSONObject(i))?.let(::add)
    }

    /** The body of POST /board/upload. */
    fun uploaded(status: Int, body: String?): DropUploaded {
        val p = try { JSONObject(body ?: "") } catch (e: Exception) { null }
        if (p == null) return DropUploaded(false, null, 0, "A relé válasza hibás (HTTP $status).")
        val ok = status == 200 && p.optBoolean("ok", false)
        return DropUploaded(ok, entry(p.optJSONObject("entry")), p.optInt("delivered", 0), str(p, "reason") ?: if (ok) null else "HTTP $status")
    }

    fun parse(raw: String): DropNote? {
        val m = try { JSONObject(raw) } catch (e: Exception) { return null }
        if (m.optString("from") != "relay") return null
        val p = m.optJSONObject("payload") ?: return null
        val ok = p.optBoolean("ok", false)
        val trusted = p.optBoolean("trusted", true)
        return when (m.optString("type")) {
            "board.listed" -> DropNote.Listed(DropList(ok, trusted, entries(p.optJSONArray("entries")), str(p, "reason")))
            "board.ticket" -> {
                val t = str(p, "ticket")?.takeIf { Drop.validTicket(it) }
                DropNote.Ticket(DropTicket(ok && t != null, t, str(p, "op"), str(p, "id"), p.optLong("ttl", 0), str(p, "reason"), trusted))
            }
            "board.removed" -> DropNote.Removed(DropRemoved(ok, str(p, "id"), str(p, "reason"), trusted))
            "clip" -> DropNote.Clip(DropClip(ok, str(p, "op"), if (p.has("text") && !p.isNull("text")) p.optString("text") else null,
                p.optBoolean("truncated", false), str(p, "reason"), trusted))
            "board" -> {
                val e = entry(p) ?: return null
                when (str(p, "event")) {
                    "added" -> DropNote.Event(DropEvent(true, e))
                    "removed" -> DropNote.Event(DropEvent(false, e))
                    else -> null
                }
            }
            else -> null
        }
    }
}
