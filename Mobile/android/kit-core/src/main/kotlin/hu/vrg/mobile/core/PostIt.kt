package hu.vrg.mobile.core

import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

// Post-it (WP M68, docs/notes/POSTIT.md): testers pin notes to a point of any screen; the developer calls them in and sees
// them on the same screens. This is the phone's half of the shared format "vrg-postit/1"; the JS twin is
// shared/postit/postit-core.js, and both are tested against shared/postit/fixtures/bundle-v1.json. Pure Kotlin + org.json,
// so `gradlew :kit-core:test` checks it in the cloud. The overlay itself is kit's PostItLayer.

object PostIt {
    const val FORMAT = "vrg-postit/1"
    const val MAX_TEXT = 2000
    const val MAX_NOTES = 500
    const val MAX_DETAIL = 200
    const val MAX_NAME = 60
    val STATES = listOf("open", "done")
    val PLATFORMS = listOf("desktop", "mobile")
    val SCREEN = Regex("""^[dm]:[A-Za-z0-9._/:-]{1,158}$""")
    private val ID = Regex("""^[A-Za-z0-9_-]{4,40}$""")

    fun validId(s: String?) = s != null && ID.matches(s)

    /** "m:" + what the shell shows (POSTIT.md §3.2): a feature id, "home", "catalog", "sphere"… made safe for the pattern. */
    fun screen(key: String): String = "m:" + key.replace(Regex("[^A-Za-z0-9._/:-]"), "_").take(158).ifEmpty { "home" }

    fun newId(rand: () -> Double = Math::random): String =
        "pn-" + (1..12).joinToString("") { "abcdefghijklmnopqrstuvwxyz0123456789"[(rand() * 36).toInt() % 36].toString() }

    private fun round4(v: Double) = (v * 10000).roundToInt() / 10000.0
    private fun clamp01(v: Double) = max(0.0, min(1.0, v))

    /** A point inside a box (px or dp, the box's own unit) → the anchor's fractions; the box size is kept as w, h. */
    fun fromPx(x: Double, y: Double, box: PiBox): Triple<Double, Double, Pair<Int, Int>> {
        val w = max(1, box.w.roundToInt()); val h = max(1, box.h.roundToInt())
        return Triple(round4(clamp01((x - box.x) / w)), round4(clamp01((y - box.y) / h)), w to h)
    }

    fun anchorAt(screen: String, detail: String?, x: Double, y: Double, box: PiBox): PiAnchor {
        val (fx, fy, wh) = fromPx(x, y, box)
        return PiAnchor(screen, detail?.takeIf { it.isNotEmpty() }?.take(MAX_DETAIL), fx, fy, wh.first, wh.second)
    }

    fun toPx(a: PiAnchor, box: PiBox): Pair<Double, Double> = (box.x + a.x * box.w) to (box.y + a.y * box.h)

    /** The note's card beside its mark: right of it and a little up; left when it would leave the box; then kept inside. */
    fun cardAt(markX: Double, markY: Double, box: PiBox, cardW: Double, cardH: Double, gap: Double = 14.0): PiCard {
        var x = markX + gap
        var y = markY - (cardH / 3).roundToInt()
        if (x + cardW > box.x + box.w) x = markX - gap - cardW
        x = max(box.x + 4, min(x, box.x + box.w - cardW - 4))
        y = max(box.y + 4, min(y, box.y + box.h - cardH - 4))
        return PiCard(x.roundToInt().toDouble(), y.roundToInt().toDouble(), if (x < markX) "left" else "right")
    }

    /** A stable hue per author id, the same number as postit-core.js's hue() (the dev layer tells testers apart). */
    fun hue(id: String): Int {
        var h = 0L
        for (c in id) h = (h * 31 + c.code) and 0xFFFFFFFFL
        return ((h % 12) * 30 + 15).toInt()
    }

    fun make(text: String, anchor: PiAnchor, at: Long = System.currentTimeMillis(), rand: () -> Double = Math::random) =
        PostItNote(newId(rand), at, at, text.take(MAX_TEXT), "open", anchor)

    // ---- reading and writing the bundle

    fun check(n: PostItNote): String? = when {
        !validId(n.id) -> "id"
        n.at <= 0 -> "at"
        n.edited < n.at -> "edited"
        n.text.isBlank() || n.text.length > MAX_TEXT -> "text"
        n.state !in STATES -> "state"
        else -> checkAnchor(n.anchor)
    }

    private fun checkAnchor(a: PiAnchor): String? = when {
        !SCREEN.matches(a.screen) -> "anchor.screen"
        a.detail != null && a.detail.length > MAX_DETAIL -> "anchor.detail"
        a.x !in 0.0..1.0 || a.y !in 0.0..1.0 -> "anchor.xy"
        a.w !in 1..20000 -> "anchor.w"
        a.h !in 1..20000 -> "anchor.h"
        else -> null
    }

    sealed class Parsed {
        data class Ok(val bundle: PiBundle) : Parsed()
        data class Bad(val err: String) : Parsed()
    }

    /** A bundle from text (a file, a share); every field is checked, unknown keys are dropped. */
    fun parse(text: String): Parsed {
        if (text.length > 2_000_000) return Parsed.Bad("size")
        val j = try { JSONObject(text.removePrefix("﻿")) } catch (e: Exception) { return Parsed.Bad("json") }
        if (j.optString("format") != FORMAT) return Parsed.Bad("format")
        val aj = j.optJSONObject("author") ?: return Parsed.Bad("author")
        val author = PiAuthor(aj.optString("id"), aj.optString("name"), aj.optString("platform"),
            aj.optString("device").takeIf { aj.has("device") }, aj.optString("app").takeIf { aj.has("app") })
        when {
            !validId(author.id) -> return Parsed.Bad("author.id")
            aj.opt("name") !is String || author.name.length > MAX_NAME -> return Parsed.Bad("author.name")
            author.platform !in PLATFORMS -> return Parsed.Bad("author.platform")
        }
        val arr = j.optJSONArray("notes") ?: return Parsed.Bad("notes")
        if (arr.length() > MAX_NOTES) return Parsed.Bad("notes")
        val notes = ArrayList<PostItNote>()
        for (i in 0 until arr.length()) {
            val n = noteOf(arr.optJSONObject(i)) ?: return Parsed.Bad("notes[$i].note")
            check(n)?.let { return Parsed.Bad("notes[$i].$it") }
            notes += n
        }
        if (notes.map { it.id }.toSet().size != notes.size) return Parsed.Bad("notes.dup")
        return Parsed.Ok(PiBundle(j.optString("exportedAt"), author, notes))
    }

    private fun noteOf(o: JSONObject?): PostItNote? {
        if (o == null) return null
        val a = o.optJSONObject("anchor") ?: return null
        fun num(k: String) = if (a.opt(k) is Number) a.getDouble(k) else Double.NaN
        fun int(k: String) = (a.opt(k) as? Number)?.takeIf { it.toDouble() == Math.floor(it.toDouble()) }?.toInt() ?: -1
        fun long(k: String) = (o.opt(k) as? Number)?.toLong() ?: -1L
        val text = o.opt("text") as? String ?: return null
        return PostItNote(o.optString("id"), long("at"), long("edited"), text, o.optString("state"),
            PiAnchor(a.optString("screen"), (a.opt("detail") as? String)?.takeIf { it.isNotEmpty() }, num("x"), num("y"), int("w"), int("h")))
    }

    fun toJson(n: PostItNote): JSONObject = JSONObject()
        .put("id", n.id).put("at", n.at).put("edited", n.edited).put("text", n.text).put("state", n.state)
        .put("anchor", JSONObject().put("screen", n.anchor.screen).apply { n.anchor.detail?.let { put("detail", it) } }
            .put("x", n.anchor.x).put("y", n.anchor.y).put("w", n.anchor.w).put("h", n.anchor.h))

    /** The export: this phone's notes under its author (valid notes only, at most [MAX_NOTES]). */
    fun bundle(author: PiAuthor, notes: List<PostItNote>, at: Long = System.currentTimeMillis()): String =
        JSONObject()
            .put("format", FORMAT)
            .put("exportedAt", Instant.ofEpochMilli(at).toString())
            .put("author", JSONObject().put("id", author.id).put("name", author.name.take(MAX_NAME)).put("platform", author.platform)
                .apply { author.device?.let { put("device", it.take(80)) }; author.app?.let { put("app", it.take(80)) } })
            .put("notes", JSONArray().apply { notes.filter { check(it) == null }.take(MAX_NOTES).forEach { put(toJson(it)) } })
            .toString(1)

    /** Does this shared text look like a bundle (Megosztás → VRG Mobile hands it to the overlay, not to Gyorsjegyzet)? */
    fun looksLikeBundle(text: String) = text.trimStart('﻿', ' ', '\n', '\r', '\t').startsWith("{") && text.contains("\"$FORMAT\"")

    // ---- the developer's inbox

    data class Merge(val inbox: Map<String, PiInboxEntry>, val added: Int, val updated: Int)

    /** Notes matched by id, the newer `edited` wins: the same file twice changes nothing. */
    fun mergeInbox(inbox: Map<String, PiInboxEntry>, b: PiBundle, at: Long = System.currentTimeMillis()): Merge {
        val prev = inbox[b.author.id]
        val byId = LinkedHashMap<String, PostItNote>()
        prev?.notes?.forEach { byId[it.id] = it }
        var added = 0; var updated = 0
        for (n in b.notes) {
            val old = byId[n.id]
            if (old == null) { byId[n.id] = n; added++ } else if (n.edited > old.edited) { byId[n.id] = n; updated++ }
        }
        val entry = PiInboxEntry(b.author, byId.values.sortedBy { it.at }.takeLast(MAX_NOTES), at)
        return Merge(inbox + (b.author.id to entry), added, updated)
    }

    fun inboxNotes(inbox: Map<String, PiInboxEntry>, hidden: Set<String> = emptySet()): List<Pair<PiAuthor, PostItNote>> =
        inbox.values.filter { it.author.id !in hidden }.flatMap { e -> e.notes.map { e.author to it } }

    fun onScreen(notes: List<PostItNote>, screen: String) = notes.filter { it.anchor.screen == screen }

    // ---- the inbox on disk (one JSON file)

    fun inboxToJson(inbox: Map<String, PiInboxEntry>): String = JSONObject().put("authors", JSONObject().apply {
        for ((id, e) in inbox) put(id, JSONObject(bundle(e.author, e.notes, e.importedAt)).put("importedAt", e.importedAt))
    }).toString()

    fun inboxFromJson(text: String?): Map<String, PiInboxEntry> {
        if (text.isNullOrBlank()) return emptyMap()
        val a = try { JSONObject(text).optJSONObject("authors") } catch (e: Exception) { null } ?: return emptyMap()
        val out = LinkedHashMap<String, PiInboxEntry>()
        for (k in a.keys()) {
            val o = a.optJSONObject(k) ?: continue
            val p = parse(o.toString()) as? Parsed.Ok ?: continue
            out[p.bundle.author.id] = PiInboxEntry(p.bundle.author, p.bundle.notes, o.optLong("importedAt"))
        }
        return out
    }

    /** This phone's own notes on disk: a bundle under its own author, so the file is also a ready export. */
    fun mineFromJson(text: String?): List<PostItNote> =
        if (text.isNullOrBlank()) emptyList() else (parse(text) as? Parsed.Ok)?.bundle?.notes.orEmpty()

    /** Several notes whose cards would overlap at one place are moved down one card each (the same rule as the PC). */
    fun stack(cards: List<PiCard>, cardW: Double, cardH: Double): List<PiCard> {
        val placed = ArrayList<PiCard>()
        for (c0 in cards) {
            var c = c0
            var k = 0
            while (k < 8 && placed.any { abs(it.x - c.x) < cardW && abs(it.y - c.y) < cardH + 4 }) { c = c.copy(y = c.y + cardH + 6); k++ }
            placed += c
        }
        return placed
    }
}

data class PiBox(val x: Double, val y: Double, val w: Double, val h: Double)
data class PiCard(val x: Double, val y: Double, val side: String)

data class PiAnchor(val screen: String, val detail: String?, val x: Double, val y: Double, val w: Int, val h: Int)

data class PostItNote(val id: String, val at: Long, val edited: Long, val text: String, val state: String, val anchor: PiAnchor) {
    val done get() = state == "done"
}

data class PiAuthor(val id: String, val name: String, val platform: String, val device: String? = null, val app: String? = null)

data class PiBundle(val exportedAt: String, val author: PiAuthor, val notes: List<PostItNote>)

data class PiInboxEntry(val author: PiAuthor, val notes: List<PostItNote>, val importedAt: Long)
