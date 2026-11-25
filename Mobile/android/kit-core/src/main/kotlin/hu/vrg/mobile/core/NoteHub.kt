package hu.vrg.mobile.core

import org.json.JSONArray
import org.json.JSONObject
import java.text.Normalizer
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

// VRG Jegyzetek (WP M68, D-176 … D-178): the one central Notes app. Here, pure and JVM-tested:
//  - the note (kind `vrg-note` v1) and its JSON,
//  - the notes kit (Notes/catalog/noteskit.json): modules, the versions a user picks (profiles), note templates and
//    the origins (every app that writes notes into the hub),
//  - the notebook's edits: create, edit, pin, archive, trash, tasks, search, sort, the daily note, a template,
//  - the linked mirror (D-178 = A): a feature (the Sketcher first) keeps its own record and the hub holds the same
//    note; a text edit on either side reaches the other, nothing is lost when both changed,
//  - the sync to the private branch `vrg-notes` (D-177 = B): one file per note, sha-guarded writes, a conflict copy
//    instead of an overwrite.
// The Android side (kit/notes/Notes.kt, feature-notes) only stores bytes and draws.

/** Where a note came from. [app] = an origin id of the kit; [ref] = the record inside that app ("<sketch>/<entry>"). */
data class NoteOrigin(
    val app: String,
    val ref: String = "",
    /** What the record is, as the source names it: "Kovács fürdő · Fürdőszoba". */
    val label: String = "",
    /** Facts the source attaches (the Sketcher's quick chips), shown as small chips; owned by the source. */
    val facts: List<String> = emptyList(),
    /** The source flags it as open (the Sketcher's Tisztázandó). */
    val open: Boolean = false,
    /** The source's text when the two were last equal: the base of the three-way mirror. */
    val seen: String? = null,
    /** The source record was deleted; the note stays. */
    val gone: Boolean = false,
)

data class VNote(
    val id: String,
    val title: String = "",
    val body: String = "",
    val tags: List<String> = emptyList(),
    val book: String? = null,
    val pinned: Boolean = false,
    val archived: Boolean = false,
    val trashed: Boolean = false,
    /** Emptied from the trash: a tombstone that keeps the id, so sync and mirrors do not bring it back. */
    val purged: Boolean = false,
    /** Fixed-width text (module Kód). */
    val mono: Boolean = false,
    /**
     * Sealed on the branch (D-179): only the trusted devices can read it. Set for notes of a `client` origin and the
     * conflict copies made from them, for a template marked `seal`, and by hand (🔒). Never cleared for a client origin.
     */
    val sealed: Boolean = false,
    val created: Long = 0,
    val updated: Long = 0,
    val device: String = "",
    val origin: NoteOrigin? = null,
    /** Arrived from another app and not opened yet (module Beérkező). Local only. */
    val unread: Boolean = false,
    /** Sync bookkeeping, local only: the remote file's sha when last in step, and whether this side changed since. */
    val sha: String? = null,
    val dirty: Boolean = true,
) {
    val live get() = !trashed && !purged
    /** The title a person reads: the title, or the first line of the text, or the origin's label. */
    val shown: String get() = title.trim().ifEmpty {
        body.lineSequence().map { it.trim().trimStart('#', ' ', '-', '*').removePrefix("[ ] ").removePrefix("[x] ").trim() }
            .firstOrNull { it.isNotEmpty() }?.take(80) ?: origin?.label?.takeIf { it.isNotBlank() } ?: "Névtelen jegyzet"
    }
}

object NoteJson {
    const val KIND = "vrg-note"

    /** The note as it is stored in the hub's file and on the branch. [local] adds the sync bookkeeping (the hub file). */
    fun write(n: VNote, local: Boolean = false): JSONObject {
        val o = JSONObject().put("kind", KIND).put("v", 1).put("id", n.id)
            .put("title", n.title).put("body", n.body).put("tags", JSONArray(n.tags))
            .put("created", n.created).put("updated", n.updated).put("device", n.device)
        n.book?.let { o.put("book", it) }
        if (n.pinned) o.put("pinned", true)
        if (n.archived) o.put("archived", true)
        if (n.trashed) o.put("trashed", true)
        if (n.purged) o.put("purged", true)
        if (n.mono) o.put("mono", true)
        if (n.sealed) o.put("sealed", true)
        n.origin?.let { g ->
            val go = JSONObject().put("app", g.app).put("ref", g.ref).put("label", g.label)
            if (g.facts.isNotEmpty()) go.put("facts", JSONArray(g.facts))
            if (g.open) go.put("open", true)
            if (g.gone) go.put("gone", true)
            g.seen?.let { go.put("seen", it) }
            o.put("origin", go)
        }
        if (local) {
            if (n.unread) o.put("unread", true)
            n.sha?.let { o.put("sha", it) }
            o.put("dirty", n.dirty)
        }
        return o
    }

    fun read(o: JSONObject): VNote? {
        val id = o.optString("id").ifEmpty { return null }
        if (o.optString("kind", KIND) != KIND) return null
        fun strs(a: JSONArray?) = if (a == null) emptyList() else (0 until a.length()).mapNotNull { a.optString(it).ifEmpty { null } }
        val g = o.optJSONObject("origin")?.let { go ->
            NoteOrigin(
                app = go.optString("app").ifEmpty { return@let null }, ref = go.optString("ref"), label = go.optString("label"),
                facts = strs(go.optJSONArray("facts")), open = go.optBoolean("open"),
                seen = if (go.has("seen") && !go.isNull("seen")) go.optString("seen") else null, gone = go.optBoolean("gone"),
            )
        }
        return VNote(
            id = id, title = o.optString("title"), body = o.optString("body"), tags = strs(o.optJSONArray("tags")),
            book = o.optString("book").ifEmpty { null }, pinned = o.optBoolean("pinned"), archived = o.optBoolean("archived"),
            trashed = o.optBoolean("trashed"), purged = o.optBoolean("purged"), mono = o.optBoolean("mono"), sealed = o.optBoolean("sealed"),
            created = o.optLong("created"), updated = o.optLong("updated"), device = o.optString("device"), origin = g,
            unread = o.optBoolean("unread"), sha = o.optString("sha").ifEmpty { null }, dirty = o.optBoolean("dirty", true),
        )
    }

    fun read(text: String): VNote? = try { read(JSONObject(text)) } catch (e: Exception) { null }

    /** The hub's own file: every note with its bookkeeping. */
    fun writeAll(notes: List<VNote>): String = JSONObject().put("kind", "vrg-notes").put("v", 1)
        .put("notes", JSONArray(notes.map { write(it, local = true) })).toString()

    fun readAll(text: String?): List<VNote> {
        if (text.isNullOrBlank()) return emptyList()
        return try {
            val a = JSONObject(text).optJSONArray("notes") ?: return emptyList()
            (0 until a.length()).mapNotNull { a.optJSONObject(it)?.let(::read) }
        } catch (e: Exception) { emptyList() }
    }
}

// ---- the notes kit -----------------------------------------------------------------------------------------------

data class NoteModule(val id: String, val label: String, val sym: String, val about: String, val core: Boolean, val planned: Boolean)
data class NoteProfile(
    val id: String, val name: String, val sym: String, val color: String, val premise: String,
    /** Module ids; "*" = every module that is not planned. Core modules are on in every profile. */
    val modules: List<String>,
    /** The list's look: "lista" (rows) or "kartyak" (cards). */
    val list: String,
    /** Template ids; "*" = all. */
    val templates: List<String>,
    val isDefault: Boolean,
)
data class NoteTemplate(val id: String, val label: String, val sym: String, val title: String, val body: String, val tags: List<String>, val seal: Boolean = false)
data class NoteSource(
    val id: String, val label: String, val sym: String, val color: String, val about: String,
    /** Its notes may carry client data (names, addresses). */
    val client: Boolean, val mirror: Boolean, val planned: Boolean,
    /** The VRG Mobile feature that opens its records, and the link with {placeholders} from the ref. */
    val feature: String?, val link: String?,
)

data class NotesKit(
    val modules: List<NoteModule>,
    val profiles: List<NoteProfile>,
    val templates: List<NoteTemplate>,
    val origins: List<NoteSource>,
) {
    fun module(id: String) = modules.firstOrNull { it.id == id }
    fun profile(id: String?) = profiles.firstOrNull { it.id == id } ?: defaultProfile
    val defaultProfile: NoteProfile get() = profiles.firstOrNull { it.isDefault } ?: profiles.first()
    fun origin(id: String?) = origins.firstOrNull { it.id == id }

    /** The origins whose notes are always sealed (D-179): those marked `client`. */
    val sealedOrigins: Set<String> get() = origins.filter { it.client }.map { it.id }.toSet()

    /**
     * The modules on for [profileId] with the user's own switches ([overrides]: module id → on/off) on top. Core
     * modules are always on; planned ones are never on, whatever a profile or switch says.
     */
    fun enabled(profileId: String?, overrides: Map<String, Boolean> = emptyMap()): Set<String> {
        val p = profile(profileId)
        val base = if ("*" in p.modules) modules.filter { !it.planned }.map { it.id }.toSet() else p.modules.toSet()
        val on = base.toMutableSet()
        overrides.forEach { (k, v) -> if (v) on += k else on -= k }
        modules.filter { it.core }.forEach { on += it.id }
        return on.filter { id -> module(id)?.let { !it.planned } == true }.toSet()
    }

    fun templatesFor(profileId: String?): List<NoteTemplate> {
        val p = profile(profileId)
        return if ("*" in p.templates) templates else p.templates.mapNotNull { id -> templates.firstOrNull { it.id == id } }
    }

    companion object {
        const val KIND = "vrg-noteskit"

        fun parse(text: String): NotesKit {
            val o = JSONObject(text)
            require(o.optString("kind") == KIND) { "not a $KIND file" }
            fun arr(k: String) = o.optJSONArray(k) ?: JSONArray()
            fun strs(a: JSONArray?) = if (a == null) emptyList() else (0 until a.length()).map { a.getString(it) }
            fun <T> each(k: String, f: (JSONObject) -> T) = arr(k).let { a -> (0 until a.length()).map { f(a.getJSONObject(it)) } }
            fun JSONObject.s(k: String) = optString(k)
            fun JSONObject.n(k: String) = if (has(k) && !isNull(k)) optString(k).ifEmpty { null } else null
            return NotesKit(
                modules = each("modules") { NoteModule(it.s("id"), it.s("label"), it.s("sym"), it.s("about"), it.optBoolean("core"), it.optBoolean("planned")) },
                profiles = each("profiles") {
                    NoteProfile(it.s("id"), it.s("name"), it.s("sym"), it.s("color"), it.s("premise"), strs(it.optJSONArray("modules")),
                        it.optString("list", "lista"), strs(it.optJSONArray("templates")), it.optBoolean("default"))
                },
                templates = each("templates") { NoteTemplate(it.s("id"), it.s("label"), it.s("sym"), it.s("title"), it.s("body"), strs(it.optJSONArray("tags")), it.optBoolean("seal")) },
                origins = each("origins") {
                    NoteSource(it.s("id"), it.s("label"), it.s("sym"), it.s("color"), it.s("about"), it.optBoolean("client"),
                        it.optBoolean("mirror"), it.optBoolean("planned"), it.n("feature"), it.n("link"))
                },
            )
        }

        /** What is wrong with a kit file (the same rules as Notes/tools/check.js); empty = fine. */
        fun problems(k: NotesKit): List<String> {
            val out = mutableListOf<String>()
            fun dup(what: String, ids: List<String>) = ids.groupBy { it }.filter { it.value.size > 1 }.keys.forEach { out += "$what twice: $it" }
            dup("module", k.modules.map { it.id }); dup("profile", k.profiles.map { it.id })
            dup("template", k.templates.map { it.id }); dup("origin", k.origins.map { it.id })
            if (k.profiles.count { it.isDefault } != 1) out += "exactly one profile must be the default"
            k.profiles.forEach { p ->
                p.modules.filter { it != "*" && k.module(it) == null }.forEach { out += "profile ${p.id}: no module $it" }
                p.modules.filter { m -> k.module(m)?.planned == true }.forEach { out += "profile ${p.id}: $it is only planned" }
                p.templates.filter { t -> t != "*" && k.templates.none { it.id == t } }.forEach { t -> out += "profile ${p.id}: no template $t" }
                if (p.list !in setOf("lista", "kartyak")) out += "profile ${p.id}: list is lista or kartyak"
            }
            k.origins.filter { it.mirror && it.link == null && !it.planned }.forEach { out += "origin ${it.id}: a mirror needs a link back" }
            if (k.origin(Notebook.HERE) == null) out += "origin ${Notebook.HERE} (notes written in the app) is missing"
            return out
        }
    }
}

// ---- the notebook's edits -----------------------------------------------------------------------------------------

enum class NoteView { ALL, PINNED, INBOX, ARCHIVE, TRASH }

data class NoteFilter(
    val view: NoteView = NoteView.ALL,
    val query: String = "",
    val tag: String? = null,
    val origin: String? = null,
    val book: String? = null,
)

object Notebook {
    /** The origin of notes written in the app itself. */
    const val HERE = "kezi"
    private val DAY = DateTimeFormatter.ofPattern("yyyy-MM-dd")
    private val TASK = Regex("""^(\s*[-*] )\[( |x|X)\] (.*)$""")

    fun newId(now: Long, salt: Int = 0): String = "n" + now.toString(36) + (if (salt > 0) salt.toString(36) else "")

    fun create(notes: List<VNote>, now: Long, device: String, title: String = "", body: String = "", tags: List<String> = emptyList(),
               book: String? = null, origin: NoteOrigin? = null, unread: Boolean = false, id: String? = null,
               sealed: Boolean = false): Pair<List<VNote>, VNote> {
        var salt = 0
        var nid = id ?: newId(now)
        while (notes.any { it.id == nid }) nid = newId(now, ++salt)
        val n = VNote(nid, title.trim(), body, tags.map(::cleanTag).filter { it.isNotEmpty() }.distinct(), book, created = now, updated = now,
            device = device, origin = origin?.takeIf { it.app != HERE }, unread = unread, sealed = sealed)
        return notes + n to n
    }

    fun put(notes: List<VNote>, n: VNote): List<VNote> =
        if (notes.any { it.id == n.id }) notes.map { if (it.id == n.id) n else it } else notes + n

    /** Applies [f] to note [id] and marks it changed (updated, dirty); a no-op change leaves it alone. */
    fun change(notes: List<VNote>, id: String, now: Long, f: (VNote) -> VNote): List<VNote> = notes.map {
        if (it.id != id) it else { val n = f(it); if (n == it) it else n.copy(updated = now, dirty = true) }
    }

    fun edit(notes: List<VNote>, id: String, title: String, body: String, now: Long) =
        change(notes, id, now) { it.copy(title = title, body = body) }

    fun cleanTag(t: String) = t.trim().trimStart('#').trim().lowercase().replace(Regex("\\s+"), "-")

    fun setTags(notes: List<VNote>, id: String, tags: List<String>, now: Long) =
        change(notes, id, now) { it.copy(tags = tags.map(::cleanTag).filter { t -> t.isNotEmpty() }.distinct()) }

    fun pin(notes: List<VNote>, id: String, on: Boolean, now: Long) = change(notes, id, now) { it.copy(pinned = on) }
    fun archive(notes: List<VNote>, id: String, on: Boolean, now: Long) = change(notes, id, now) { it.copy(archived = on, pinned = if (on) false else it.pinned) }
    fun trash(notes: List<VNote>, id: String, on: Boolean, now: Long) = change(notes, id, now) { it.copy(trashed = on, pinned = if (on) false else it.pinned) }
    fun setBook(notes: List<VNote>, id: String, book: String?, now: Long) = change(notes, id, now) { it.copy(book = book?.trim()?.ifEmpty { null }) }
    fun setMono(notes: List<VNote>, id: String, on: Boolean, now: Long) = change(notes, id, now) { it.copy(mono = on) }
    /** 🔒 by hand. A note of a sealed origin ([sealedOrigins]) cannot be unsealed. */
    fun setSealed(notes: List<VNote>, id: String, on: Boolean, now: Long, sealedOrigins: Set<String>) = change(notes, id, now) {
        it.copy(sealed = on || it.origin?.app in sealedOrigins)
    }
    /** The trusted devices changed: every sealed note is written again, so the branch copy opens for the new list. */
    fun reseal(notes: List<VNote>) = notes.map { if (it.sealed && !it.purged) it.copy(dirty = true) else it }
    /** Seen: clears [VNote.unread] (local only, no sync). */
    fun seen(notes: List<VNote>, id: String) = notes.map { if (it.id == id) it.copy(unread = false) else it }

    /** Empties the trash: the notes become tombstones (no text), so another device or a mirror cannot revive them. */
    fun purgeTrash(notes: List<VNote>, now: Long) = notes.map {
        if (it.trashed && !it.purged) it.copy(purged = true, title = "", body = "", tags = emptyList(), book = null,
            origin = it.origin?.copy(seen = null, facts = emptyList(), label = ""), updated = now, dirty = true) else it
    }

    // tasks: "- [ ] …" lines (module Teendőlista)
    data class Task(val line: Int, val done: Boolean, val text: String)

    fun tasks(body: String): List<Task> = body.lines().mapIndexedNotNull { i, l ->
        TASK.find(l)?.let { m -> Task(i, m.groupValues[2] != " ", m.groupValues[3]) }
    }

    fun toggleTask(body: String, line: Int): String {
        val ls = body.lines().toMutableList()
        if (line !in ls.indices) return body
        val m = TASK.find(ls[line]) ?: return body
        ls[line] = m.groupValues[1] + "[" + (if (m.groupValues[2] == " ") "x" else " ") + "] " + m.groupValues[3]
        return ls.joinToString("\n")
    }

    fun addTask(body: String, text: String): String {
        val t = text.trim().ifEmpty { return body }
        return (if (body.isEmpty() || body.endsWith("\n")) body else body + "\n") + "- [ ] " + t
    }

    // search and order
    /** Lower case, no accents: "Fürdő" and "furdo" match. */
    fun fold(s: String): String = Normalizer.normalize(s.lowercase(), Normalizer.Form.NFD).replace(Regex("\\p{M}+"), "")

    fun matches(n: VNote, f: NoteFilter): Boolean {
        if (n.purged) return false
        val inView = when (f.view) {
            NoteView.ALL -> n.live && !n.archived
            NoteView.PINNED -> n.live && n.pinned
            NoteView.INBOX -> n.live && n.unread
            NoteView.ARCHIVE -> n.live && n.archived
            NoteView.TRASH -> n.trashed
        }
        if (!inView) return false
        if (f.tag != null && f.tag !in n.tags) return false
        if (f.origin != null && (n.origin?.app ?: HERE) != f.origin) return false
        if (f.book != null && n.book != f.book) return false
        val q = fold(f.query.trim())
        if (q.isEmpty()) return true
        val hay = fold(listOf(n.title, n.body, n.tags.joinToString(" "), n.book ?: "", n.origin?.label ?: "", n.origin?.facts?.joinToString(" ") ?: "").joinToString("\n"))
        return q.split(Regex("\\s+")).all { hay.contains(it) }
    }

    /** Pinned first, then the newest change. */
    fun list(notes: List<VNote>, f: NoteFilter): List<VNote> =
        notes.filter { matches(it, f) }.sortedWith(compareByDescending<VNote> { it.pinned && f.view != NoteView.TRASH }.thenByDescending { it.updated })

    fun tags(notes: List<VNote>): List<Pair<String, Int>> =
        notes.filter { it.live }.flatMap { it.tags }.groupingBy { it }.eachCount().entries
            .sortedWith(compareByDescending<Map.Entry<String, Int>> { it.value }.thenBy { it.key }).map { it.key to it.value }

    fun books(notes: List<VNote>): List<String> = notes.filter { it.live }.mapNotNull { it.book }.distinct().sorted()

    fun origins(notes: List<VNote>): List<Pair<String, Int>> =
        notes.filter { it.live }.groupingBy { it.origin?.app ?: HERE }.eachCount().entries.sortedByDescending { it.value }.map { it.key to it.value }

    fun unread(notes: List<VNote>) = notes.count { it.live && it.unread }

    // the daily note and templates
    fun day(at: Long, zone: ZoneId): String = DAY.format(Instant.ofEpochMilli(at).atZone(zone))
    fun dailyId(day: String) = "d-$day"

    /** Today's note: the existing one, or a new one titled with the day. */
    fun daily(notes: List<VNote>, now: Long, zone: ZoneId, device: String): Pair<List<VNote>, VNote> {
        val d = day(now, zone)
        notes.firstOrNull { it.id == dailyId(d) }?.let { ex ->
            return if (ex.trashed && !ex.purged) trash(notes, ex.id, false, now).let { it to it.first { n -> n.id == ex.id } } else notes to ex
        }
        return create(notes, now, device, title = "Napi · $d", tags = listOf("napi"), id = dailyId(d))
    }

    fun fromTemplate(notes: List<VNote>, t: NoteTemplate, now: Long, zone: ZoneId, device: String): Pair<List<VNote>, VNote> {
        val d = day(now, zone)
        return create(notes, now, device, title = t.title.replace("{date}", d), body = t.body.replace("{date}", d), tags = t.tags, sealed = t.seal)
    }

    /** The note as Markdown, for Megosztás. */
    fun markdown(n: VNote, kit: NotesKit? = null): String = buildString {
        append("# ").append(n.shown).append("\n\n")
        n.origin?.let { g -> append("> ").append(kit?.origin(g.app)?.label ?: g.app).append(if (g.label.isNotBlank()) " · ${g.label}" else "").append("\n\n") }
        append(n.body.trimEnd()).append("\n")
        if (n.tags.isNotEmpty()) append("\n").append(n.tags.joinToString(" ") { "#$it" }).append("\n")
    }
}

// ---- the linked mirror (D-178 = A) ----------------------------------------------------------------------------------
// A feature keeps its own record (the Sketcher's Entry stays in the survey and goes to the Planner with it); the hub
// holds a note with a fixed id. The base is NoteOrigin.seen, the source's text when the two last agreed:
//   source changed, note not      → the note takes the source's text            (push)
//   note changed, source not      → the source takes the note's text            (pull, when the source next opens)
//   both changed to the same text → only the base moves
//   both changed, differently     → the note keeps both texts, nothing is lost; the source then takes that text
// A trashed or purged note is never revived by its source; a deleted source record marks the note `gone`.

data class MirrorItem(val ref: String, val text: String, val label: String = "", val facts: List<String> = emptyList(), val open: Boolean = false)

object NoteMirror {
    fun idFor(app: String, ref: String) = app + "-" + ref.replace(Regex("[^A-Za-z0-9_-]"), "-")

    const val BOTH = "\n\n⚠ Közben a forrásban ez lett:\n"

    fun push(notes: List<VNote>, app: String, item: MirrorItem, now: Long, device: String, seal: Boolean = false): List<VNote> {
        val id = idFor(app, item.ref)
        val ex = notes.firstOrNull { it.id == id }
        if (ex == null) {
            if (item.text.isBlank() && item.facts.isEmpty()) return notes
            val g = NoteOrigin(app, item.ref, item.label, item.facts, item.open, seen = item.text)
            return Notebook.create(notes, now, device, body = item.text, origin = g, unread = true, id = id, sealed = seal).first
        }
        if (ex.trashed || ex.purged) return notes
        val g = ex.origin ?: NoteOrigin(app, item.ref)
        val base = g.seen
        val src = item.text
        val (body, seen) = when {
            src == ex.body -> ex.body to src                                       // in step (also: just pulled)
            base == null || ex.body == base -> src to src                          // only the source changed
            src == base -> ex.body to base                                         // only the note changed: pull carries it
            ex.body.endsWith(BOTH + base) -> ex.body.dropLast(base.length) + src to src   // a kept conflict, source still typing
            else -> ex.body + BOTH + src to src                                    // both changed: keep both
        }
        val next = ex.copy(body = body, origin = g.copy(label = item.label, facts = item.facts, open = item.open, seen = seen, gone = false),
            sealed = ex.sealed || seal)
        if (next == ex) return notes
        return notes.map { if (it.id == id) next.copy(updated = now, dirty = true) else it }
    }

    /**
     * All of one source scope at once (one survey): pushes every item and marks notes of that scope whose record is
     * gone. [scope] is the ref prefix ("<sketch id>/").
     */
    fun sync(notes: List<VNote>, app: String, scope: String, items: List<MirrorItem>, now: Long, device: String, seal: Boolean = false): List<VNote> {
        var out = notes
        items.forEach { out = push(out, app, it, now, device, seal) }
        val live = items.map { idFor(app, it.ref) }.toSet()
        return out.map { n ->
            val g = n.origin
            if (g != null && g.app == app && g.ref.startsWith(scope) && n.id !in live && !g.gone && !n.purged)
                n.copy(origin = g.copy(gone = true), updated = now, dirty = true) else n
        }
    }

    /** The text the source should take now, or null when it already has the right one. */
    fun pull(notes: List<VNote>, app: String, ref: String, sourceText: String): String? {
        val n = notes.firstOrNull { it.id == idFor(app, ref) } ?: return null
        if (n.trashed || n.purged) return null
        val base = n.origin?.seen ?: return null
        return if (n.body != base && n.body != sourceText && sourceText == base) n.body else null
    }

    /** The source's link for a note, its {placeholders} filled from the ref's parts ("{sketch}/{entry}" style). */
    fun link(src: NoteSource?, origin: NoteOrigin?): String? {
        val tpl = src?.link ?: return null
        val g = origin ?: return null
        val keys = Regex("\\{([a-z]+)\\}").findAll(tpl).map { it.groupValues[1] }.toList()
        val parts = g.ref.split('/')
        var out = tpl
        keys.forEachIndexed { i, k -> out = out.replace("{$k}", java.net.URLEncoder.encode(parts.getOrElse(i) { "" }, "UTF-8")) }
        return out
    }
}

// ---- sync to the private branch (D-177 = B) ---------------------------------------------------------------------------

object NoteSync {
    const val BRANCH = "vrg-notes"
    const val BASE = "main"
    const val DIR = "notes"

    fun writable(branch: String) = branch == BRANCH
    fun path(id: String) = "$DIR/$id.json"
    fun idOf(name: String) = name.removeSuffix(".json").takeIf { name.endsWith(".json") }

    /** The commit message names the note's id only: a title could name a client (D-179). */
    fun message(n: VNote, device: String) =
        "vrg-notes: " + n.id + (if (n.purged) " törölve" else if (n.sealed) " (lezárt)" else "") +
            (device.trim().takeIf { it.isNotEmpty() }?.let { " ($it)" } ?: "")

    /** The text of the branch's file for a plain note: the note without local bookkeeping. */
    fun file(n: VNote): String = NoteJson.write(n).toString(1) + "\n"

    /**
     * [locked]: sealed files this device cannot open (id → sha), kept so they are not fetched again each round.
     * [waiting]: changed notes not written because they could not be sealed here (no key yet).
     */
    data class Report(val notes: List<VNote>, val pulled: Int, val pushed: Int, val conflicts: Int, val problem: String? = null,
                      val locked: Map<String, String> = emptyMap(), val waiting: Int = 0)

    /**
     * One round: list the branch, take what changed there, keep a conflict copy where both sides changed, then write
     * every changed note with its sha. A write that meets a newer file is left dirty for the next round.
     */
    suspend fun run(remote: NoteRemote, start: List<VNote>, now: Long, device: String,
                    codec: NoteCodec = NoteCodec.Plain, locked: Map<String, String> = emptyMap()): Report {
        remote.ensureBranch()
        val there = remote.list()
        var notes = start
        var pulled = 0; var conflicts = 0; var pushed = 0; var waiting = 0
        val stillLocked = locked.filter { (id, sha) -> there[id] == sha }.toMutableMap()
        for ((id, sha) in there) {
            val mine = notes.firstOrNull { it.id == id }
            if (mine != null && mine.sha == sha) continue
            if (stillLocked[id] == sha) continue
            val f = remote.read(path(id)) ?: continue
            val theirs = when (val d = codec.decode(f.text, id)) {
                is NoteDecoded.Open -> d.note.copy(sha = f.sha, dirty = d.reseal)
                NoteDecoded.Locked -> { stillLocked[id] = f.sha; continue }
                NoteDecoded.Bad -> continue
            }
            when {
                mine == null -> { notes = notes + theirs.copy(unread = theirs.origin != null && theirs.live); pulled++ }
                !mine.dirty -> { notes = Notebook.put(notes, theirs.copy(unread = mine.unread, sealed = theirs.sealed || mine.sealed,
                    dirty = theirs.dirty || (mine.sealed && !theirs.sealed))); pulled++ }
                else -> {
                    val r = resolve(mine, theirs, notes, now)
                    notes = r.first; conflicts += r.second; pulled++
                }
            }
        }
        // a file that vanished from the branch (a reset branch) is written again
        notes = notes.map { if (it.sha != null && it.id !in there) it.copy(sha = null, dirty = true) else it }
        for (n in notes.filter { it.dirty }) {
            val text = codec.encode(n) ?: run { waiting++; null } ?: continue
            when (val r = remote.write(path(n.id), text, n.sha, message(n, device))) {
                is NoteWrite.Ok -> { notes = notes.map { if (it.id == n.id) it.copy(sha = r.sha, dirty = false) else it }; pushed++ }
                NoteWrite.Conflict -> {}
                is NoteWrite.Failed -> return Report(notes, pulled, pushed, conflicts, r.reason, stillLocked, waiting)
            }
        }
        return Report(notes, pulled, pushed, conflicts, locked = stillLocked, waiting = waiting)
    }

    /**
     * A round ran on [start] while the user kept writing; [current] is the list now. A note untouched meanwhile takes
     * the round's result; one edited meanwhile keeps the edit, takes the new sha and stays dirty for the next round.
     */
    fun rebase(start: List<VNote>, result: List<VNote>, current: List<VNote>): List<VNote> {
        val before = start.associateBy { it.id }
        val after = result.associateBy { it.id }
        val out = current.map { now ->
            val r = after[now.id] ?: return@map now
            when {
                before[now.id] == now -> r                                   // not touched during the round
                before[now.id] == null -> now.copy(sha = r.sha, dirty = true)  // made meanwhile and fetched too: keep mine
                else -> now.copy(sha = r.sha, dirty = true)
            }
        }
        val have = current.map { it.id }.toSet()
        return out + result.filter { it.id !in have && it.id !in before }   // fetched or copied in the round
    }

    /**
     * Both sides changed one note. The newer change keeps the id; the other side's text survives as a separate note
     * tagged `ütközés` (no origin, so no mirror touches it). Returns the notes and 1 when a copy was made.
     */
    fun resolve(mine: VNote, theirs: VNote, notes: List<VNote>, now: Long): Pair<List<VNote>, Int> {
        val same = mine.copy(sha = null, dirty = false, unread = false, updated = 0) == theirs.copy(sha = null, dirty = false, unread = false, updated = 0)
        if (same) return Notebook.put(notes, mine.copy(sha = theirs.sha, dirty = false)) to 0
        val mineWins = mine.updated >= theirs.updated
        val keep = if (mineWins) mine.copy(sha = theirs.sha, dirty = true) else theirs.copy(dirty = false, unread = mine.unread)
        val lost = if (mineWins) theirs else mine
        var out = Notebook.put(notes, keep)
        if (lost.purged || (lost.title == keep.title && lost.body == keep.body)) return out to 0
        val copy = VNote(
            id = keep.id + "-u" + now.toString(36), title = lost.shown + " (ütközés)", body = lost.body,
            tags = (lost.tags + "ütközés").distinct(), book = lost.book, created = now, updated = now, device = lost.device, dirty = true,
            sealed = lost.sealed || keep.sealed,     // a copy of a client note stays sealed although it has no origin
        )
        out = out + copy
        return out to 1
    }
}

sealed interface NoteWrite {
    data class Ok(val sha: String) : NoteWrite
    data object Conflict : NoteWrite
    data class Failed(val reason: String) : NoteWrite
}

/** The branch as the sync sees it; kit implements it against GitHub's contents API, the tests fake it. */
interface NoteRemote {
    /** Makes [NoteSync.BRANCH] if it is missing. */
    suspend fun ensureBranch()
    /** Note id → the file's sha, for every file in [NoteSync.DIR]. */
    suspend fun list(): Map<String, String>
    suspend fun read(path: String): FileAt?
    suspend fun write(path: String, text: String, sha: String?, message: String): NoteWrite
}

/** GitHub's JSON for the notes branch. */
object NoteContents {
    /** GET /contents/notes: the list (a missing folder is an empty list). */
    fun listing(json: String): Map<String, String> = try {
        val a = JSONArray(json)
        (0 until a.length()).mapNotNull { i ->
            val o = a.optJSONObject(i) ?: return@mapNotNull null
            if (o.optString("type") != "file") return@mapNotNull null
            NoteSync.idOf(o.optString("name"))?.let { it to o.optString("sha") }
        }.toMap()
    } catch (e: Exception) { emptyMap() }

    /** The PUT's answer: the new file's sha. */
    fun writtenSha(json: String): String? = try { JSONObject(json).getJSONObject("content").getString("sha") } catch (e: Exception) { null }

    fun putBody(text: String, sha: String?, branch: String, message: String): String {
        require(NoteSync.writable(branch)) { "only ${NoteSync.BRANCH} is written" }
        val o = JSONObject().put("message", message).put("branch", branch)
            .put("content", java.util.Base64.getEncoder().encodeToString(text.toByteArray(Charsets.UTF_8)))
        if (sha != null) o.put("sha", sha)
        return o.toString()
    }

    fun refBody(branch: String, sha: String): String {
        require(NoteSync.writable(branch)) { "only ${NoteSync.BRANCH} is created" }
        return JSONObject().put("ref", "refs/heads/$branch").put("sha", sha).toString()
    }
}
