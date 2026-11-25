package hu.vrg.mobile.notebook

import org.json.JSONArray
import org.json.JSONObject
import kotlin.random.Random

// The one store of VRG Füzet: every entry of every kit in one plain JSON file (kind "vrg-fuzet"), so one search finds
// everything and one export carries everything. The Sketcher's rules hold here too: every entry stands alone, links
// may come late, and what is missing is derived (Engine.open), never stored.

/** A field's value. Dates are text "ÉÉÉÉ-HH-NN"; ratings are numbers. */
sealed class Value {
    data class Text(val s: String) : Value()
    data class Num(val n: Double) : Value()
    data class Bool(val b: Boolean) : Value()
    data class Many(val items: List<String>) : Value()

    val isBlank: Boolean get() = when (this) {
        is Text -> s.isBlank()
        is Many -> items.isEmpty()
        else -> false
    }

    fun toJson(): Any = when (this) {
        is Text -> s
        is Num -> n
        is Bool -> b
        is Many -> JSONArray(items)
    }

    companion object {
        fun fromJson(v: Any?): Value? = when (v) {
            null, JSONObject.NULL -> null
            is String -> Text(v)
            is Boolean -> Bool(v)
            is Number -> Num(v.toDouble())
            is JSONArray -> Many((0 until v.length()).map { v.optString(it) }.filter { it.isNotEmpty() })
            else -> null
        }
    }
}

data class Entry(
    val id: String,
    val kit: String,
    val type: String,
    /** When it was captured (epoch ms). */
    val at: Long,
    /** When it was last changed; null = never. */
    val ed: Long? = null,
    val text: String = "",
    val f: Map<String, Value> = emptyMap(),
    val tags: List<String> = emptyList(),
    val links: List<String> = emptyList(),
    val done: Boolean = false,
    /** Tisztázandó: still to be cleared up. */
    val open: Boolean = false,
) {
    val touched: Long get() = ed ?: at

    fun toJson(): JSONObject = JSONObject().apply {
        put("id", id); put("kit", kit); put("type", type); put("at", at)
        ed?.let { put("ed", it) }
        if (text.isNotEmpty()) put("text", text)
        if (f.isNotEmpty()) put("f", JSONObject().apply { f.forEach { (k, v) -> put(k, v.toJson()) } })
        if (tags.isNotEmpty()) put("tags", JSONArray(tags))
        if (links.isNotEmpty()) put("links", JSONArray(links))
        if (done) put("done", true)
        if (open) put("open", true)
    }

    companion object {
        fun fromJson(o: JSONObject): Entry? {
            val id = o.optString("id").takeIf { it.isNotEmpty() } ?: return null
            val fo = o.optJSONObject("f")
            val f = buildMap { fo?.keys()?.forEach { k -> Value.fromJson(fo.opt(k))?.let { put(k, it) } } }
            fun list(k: String) = o.optJSONArray(k)?.let { a -> (0 until a.length()).map { a.optString(it) }.filter { it.isNotEmpty() } } ?: emptyList()
            return Entry(
                id, o.optString("kit").ifEmpty { Kits.BASE }, o.optString("type").ifEmpty { Kits.NOTE_TYPE },
                o.optLong("at", 0L), if (o.has("ed")) o.optLong("ed") else null, o.optString("text"),
                f, list("tags"), list("links"), o.optBoolean("done", false), o.optBoolean("open", false),
            )
        }
    }
}

/** A file that is not a Füzet store, or one written by a newer version. The message is for the user. */
class Unreadable(msg: String) : Exception(msg)

object Ids {
    private const val DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz"

    /** Unique across phones without a counter: the time in base 36 and four random characters. */
    fun next(at: Long, rnd: Random = Random.Default): String =
        "E" + at.toString(36) + (1..4).map { DIGITS[rnd.nextInt(DIGITS.length)] }.joinToString("")
}

data class Store(
    val entries: List<Entry> = emptyList(),
    /** Ids deleted here, kept so an import cannot bring them back. */
    val gone: Set<String> = emptySet(),
    /** Kits switched on (the base kit is on whatever this says). */
    val kitsOn: Set<String> = setOf(Kits.BASE),
    /** Open items and suggestions swiped away; they do not come back. */
    val dismissed: Set<String> = emptySet(),
    /** The note being typed, so nothing half-done is lost. */
    val draft: String = "",
) {
    fun byId(id: String?): Entry? = entries.firstOrNull { it.id == id }

    fun isOn(kit: String) = kit == Kits.BASE || kit in kitsOn

    fun add(e: Entry): Store = copy(entries = entries.filterNot { it.id == e.id } + e)

    /** Changes one entry and stamps it with [at]. Unknown id = no change. */
    fun update(id: String, at: Long, fn: (Entry) -> Entry): Store {
        val old = byId(id) ?: return this
        val new = fn(old).copy(id = old.id, at = old.at, ed = at)
        return copy(entries = entries.map { if (it.id == id) new else it })
    }

    fun remove(id: String): Store =
        if (byId(id) == null) this
        else copy(entries = entries.filterNot { it.id == id }.map { e -> if (id in e.links) e.copy(links = e.links - id) else e }, gone = gone + id)

    fun toggleDone(id: String, at: Long) = update(id, at) { it.copy(done = !it.done) }

    /** Links [a] to [b]; a link reads both ways (Engine.linked). */
    fun link(a: String, b: String, at: Long): Store =
        if (a == b || byId(b) == null) this else update(a, at) { if (b in it.links) it else it.copy(links = it.links + b) }

    fun unlink(a: String, b: String, at: Long): Store =
        update(a, at) { it.copy(links = it.links - b) }.let { s -> s.update(b, at) { it.copy(links = it.links - a) } }

    fun addTag(id: String, tag: String, at: Long) = update(id, at) { if (tag in it.tags) it else it.copy(tags = it.tags + tag) }

    fun setKit(kit: String, on: Boolean) = if (kit == Kits.BASE) this else copy(kitsOn = if (on) kitsOn + kit else kitsOn - kit)

    fun dismiss(key: String) = copy(dismissed = dismissed + key)

    fun toJson(): JSONObject = JSONObject().apply {
        put("kind", KIND); put("v", VERSION)
        put("entries", JSONArray().apply { entries.sortedBy { it.at }.forEach { put(it.toJson()) } })
        if (gone.isNotEmpty()) put("gone", JSONArray(gone.sorted()))
        put("kitsOn", JSONArray(kitsOn.sorted()))
        if (dismissed.isNotEmpty()) put("dismissed", JSONArray(dismissed.sorted()))
        if (draft.isNotEmpty()) put("draft", draft)
    }

    fun write(): String = toJson().toString(1)

    companion object {
        const val KIND = "vrg-fuzet"
        const val VERSION = 1

        /** Reads a store file. A newer version is refused, not half-read; an older one is migrated here. */
        fun read(text: String): Store {
            val o = try { JSONObject(text) } catch (e: org.json.JSONException) { throw Unreadable("Nem JSON fájl.") }
            if (o.optString("kind") != KIND) throw Unreadable("Nem Füzet fájl (kind: ${o.optString("kind")}).")
            val v = o.optInt("v", 1)
            if (v > VERSION) throw Unreadable("Újabb Füzet ($v) írta: frissítsd az appot.")
            fun set(k: String) = o.optJSONArray(k)?.let { a -> (0 until a.length()).map { a.optString(it) }.filter { it.isNotEmpty() }.toSet() }
            val ea = o.optJSONArray("entries") ?: JSONArray()
            val entries = (0 until ea.length()).mapNotNull { ea.optJSONObject(it)?.let(Entry::fromJson) }.distinctBy { it.id }
            return Store(entries, set("gone") ?: emptySet(), (set("kitsOn") ?: emptySet()) + Kits.BASE, set("dismissed") ?: emptySet(), o.optString("draft"))
        }
    }
}
