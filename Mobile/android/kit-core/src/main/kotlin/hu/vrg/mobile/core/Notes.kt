package hu.vrg.mobile.core

import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Base64

// Gyorsjegyzet (WP M6, D-6 = A): quick notes from the phone, appended to one file per day on the
// `mobile-log` branch, which works as the project's chat log. Here: the note and its Markdown line,
// the day file, the append rule (read + sha, append, PUT with sha; on a conflict re-read and retry),
// the outbox order, and the GitHub contents JSON. The Android side only carries bytes.

object NoteLog {
    /** The one branch notes go to. The writer refuses any other (see [writable]). */
    const val BRANCH = "mobile-log"
    const val BASE = "main"
    const val RETRIES = 3

    /** What a note can be about; the toolset's parts. M4 (Haladás) can later feed this from its tool map. */
    val TAGS = listOf("planner", "codecity", "inventory", "mobile", "kapu", "mindmap", "firmware", "bridge", "általános")

    fun writable(branch: String) = branch == BRANCH

    fun day(at: Long, zone: ZoneId): String = DAY.format(Instant.ofEpochMilli(at).atZone(zone))

    fun path(at: Long, zone: ZoneId) = "log/${day(at, zone)}.md"

    fun header(day: String) = "# Mobil napló · $day\n\nJegyzetek a VRG Mobile-ból (Gyorsjegyzet). Egy sor egy jegyzet.\n\n"

    private val DAY = DateTimeFormatter.ofPattern("yyyy-MM-dd")
    internal val TIME: DateTimeFormatter = DateTimeFormatter.ofPattern("HH:mm")
}

data class Note(
    /** Unique per phone; keeps a retried note from being written twice. */
    val id: String,
    val at: Long,
    val text: String,
    val tag: String? = null,
    val branch: String? = null,
) {
    /**
     * `- 14:32 · [planner] szöveg… (from: phone, branch: x) <!-- n:id -->`. Further lines of the text
     * are indented under the item, so a multi-line note stays one list item.
     */
    fun line(zone: ZoneId): String {
        val time = NoteLog.TIME.format(Instant.ofEpochMilli(at).atZone(zone))
        val body = text.trim().replace("\r\n", "\n").lines().joinToString("\n  ")
        val from = "from: phone" + (branch?.let { ", branch: $it" } ?: "")
        return "- $time · " + (tag?.let { "[$it] " } ?: "") + body + " ($from) <!-- n:$id -->"
    }
}

object NoteFile {
    /** The day file with the note added; a new file starts with its header. Idempotent for one note id. */
    fun append(existing: String?, note: Note, zone: ZoneId): String {
        val base = existing ?: NoteLog.header(NoteLog.day(note.at, zone))
        if (base.contains("<!-- n:${note.id} -->")) return base
        return (if (base.endsWith("\n")) base else base + "\n") + note.line(zone) + "\n"
    }

    /** The notes of a day file, newest last, as the lines a person reads (markers stripped). */
    fun read(text: String): List<String> =
        text.lines().filter { it.startsWith("- ") }.map { it.replace(Regex("\\s*<!-- n:[^>]* -->$"), "") }
}

/** One file as the contents API returns it. */
data class FileAt(val text: String, val sha: String)

sealed interface PutResult {
    data object Ok : PutResult
    /** The sha was stale: someone else wrote the file in between. */
    data object Conflict : PutResult
    data class Failed(val reason: String) : PutResult
}

/** The few GitHub calls the writer needs; kit implements it, the tests fake it. */
interface NotesApi {
    /** null = the file does not exist yet. Throws [NotesApi.Problem] when GitHub cannot be asked. */
    suspend fun read(path: String, branch: String): FileAt?
    suspend fun write(path: String, branch: String, text: String, sha: String?, message: String): PutResult
    suspend fun branchExists(branch: String): Boolean
    suspend fun createBranch(branch: String, from: String)

    class Problem(message: String) : Exception(message)
}

object NoteWriter {
    /**
     * Appends one note to its day file on [NoteLog.BRANCH]: makes the branch if it is missing, then
     * read + sha, append, write with that sha; a conflict re-reads and tries again, [NoteLog.RETRIES] times.
     */
    suspend fun send(api: NotesApi, note: Note, zone: ZoneId): PutResult {
        val branch = NoteLog.BRANCH
        if (!api.branchExists(branch)) api.createBranch(branch, NoteLog.BASE)
        val path = NoteLog.path(note.at, zone)
        repeat(NoteLog.RETRIES) {
            val cur = api.read(path, branch)
            val text = NoteFile.append(cur?.text, note, zone)
            if (cur != null && text == cur.text) return PutResult.Ok          // already there (an earlier try landed)
            val msg = "mobile-log: ${NoteLog.day(note.at, zone)} " + (note.tag?.let { "[$it] " } ?: "") + "jegyzet"
            when (val r = api.write(path, branch, text, cur?.sha, msg)) {
                PutResult.Conflict -> {}
                else -> return r
            }
        }
        return PutResult.Failed("A nap fájlját többször is más írta közben; később újra.")
    }
}

/** The notes waiting to go out, oldest first. Plain data, stored as JSON by the app. */
data class Outbox(val notes: List<Note> = emptyList()) {
    fun add(n: Note) = if (notes.any { it.id == n.id }) this else Outbox(notes + n)
    fun sent(id: String) = Outbox(notes.filterNot { it.id == id })
    val next: Note? get() = notes.firstOrNull()

    fun toJson(): String = JSONArray(notes.map { n ->
        JSONObject().put("id", n.id).put("at", n.at).put("text", n.text)
            .put("tag", n.tag ?: JSONObject.NULL).put("branch", n.branch ?: JSONObject.NULL)
    }).toString()

    companion object {
        fun fromJson(s: String?): Outbox {
            if (s.isNullOrEmpty()) return Outbox()
            return try {
                val a = JSONArray(s)
                Outbox((0 until a.length()).mapNotNull { i ->
                    val o = a.optJSONObject(i) ?: return@mapNotNull null
                    fun str(k: String) = if (o.isNull(k)) null else o.optString(k).ifEmpty { null }
                    Note(str("id") ?: return@mapNotNull null, o.optLong("at"), o.optString("text"), str("tag"), str("branch"))
                })
            } catch (e: Exception) { Outbox() }
        }
    }
}

/** The GitHub contents API's JSON, both ways. */
object Contents {
    fun parse(json: String): FileAt? = try {
        val o = JSONObject(json)
        val raw = o.getString("content")
        FileAt(String(Base64.getMimeDecoder().decode(raw), Charsets.UTF_8), o.getString("sha"))
    } catch (e: Exception) { null }

    fun putBody(text: String, sha: String?, branch: String, message: String): String {
        require(NoteLog.writable(branch)) { "only ${NoteLog.BRANCH} is written" }
        val o = JSONObject().put("message", message).put("branch", branch)
            .put("content", Base64.getEncoder().encodeToString(text.toByteArray(Charsets.UTF_8)))
        if (sha != null) o.put("sha", sha)
        return o.toString()
    }

    /** GET /git/ref/heads/<branch>'s commit sha. */
    fun refSha(json: String): String? = try { JSONObject(json).getJSONObject("object").getString("sha") } catch (e: Exception) { null }

    fun refBody(branch: String, sha: String): String {
        require(NoteLog.writable(branch)) { "only ${NoteLog.BRANCH} is created" }
        return JSONObject().put("ref", "refs/heads/$branch").put("sha", sha).toString()
    }
}
