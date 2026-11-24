package hu.vrg.mobile.core

import org.json.JSONArray
import org.json.JSONObject

// Böngésző (WP M66, T7 of docs/browser/TRAJECTORIES.md): `vrg.web-links` v1, the one bookmark-and-history format of the VRG
// Asztal (<userDir>/web.json), the VRG Böngésző (Browser/src/core/links.js) and the Data Vault's browser-kit (DV-Q22). A Kotlin
// port of links.js, rule for rule; Browser/test/fixtures/links-contract.json holds the cases both sides replay (WebTest).
//
//   { format: "vrg.web-links", v: 1, exported?, bookmarks: [{ url, title, at }], history: [{ url, title, at }], "x-bongeszo"? }
//
// http / https only, ≤ 4096 characters; titles ≤ 300; bookmarks unique by URL (≤ 2000), history one row per visit, oldest
// first (≤ 20 000). A merge never loses a row; a newer `v` or another format is refused, never half-read.

data class WebRow(val url: String, val title: String, val at: Long)

data class WebLinksData(val bookmarks: List<WebRow> = emptyList(), val history: List<WebRow> = emptyList(), val ext: JSONObject? = null) {
    // the extension is carried, not compared (JSONObject has no value equality)
    override fun equals(other: Any?): Boolean = other is WebLinksData && other.bookmarks == bookmarks && other.history == history
    override fun hashCode(): Int = bookmarks.hashCode() * 31 + history.hashCode()
}

/** What a copy sends to the master: bookmark / unbookmark / visit / forget (a URL's history) / clear (history since `at`). */
data class WebOp(val op: String, val url: String = "", val title: String = "", val at: Long = 0)

/** A file that is not links, or a newer version: kind = "format" | "newer" | "empty". */
class WebLinksError(val kind: String, message: String) : Exception(message)

object WebLinks {
    const val FORMAT = "vrg.web-links"
    const val VERSION = 1
    const val EXT = "x-bongeszo"
    const val MAX_HISTORY = 20000
    const val MAX_BOOKMARKS = 2000
    const val TITLE_MAX = 300
    private const val DAY = 86_400_000L
    val OPS = setOf("bookmark", "unbookmark", "visit", "forget", "clear")

    private fun cut(s: String?) = (s ?: "").let { if (it.length > TITLE_MAX) it.substring(0, TITLE_MAX) else it }

    /** JS Number(): a number, a numeric string or null (= 0) count; anything else is not a time. */
    private fun timeOf(v: Any?): Long? = when (v) {
        null, JSONObject.NULL -> 0L
        is Number -> v.toDouble().takeIf { it.isFinite() }?.toLong()
        is String -> v.trim().let { if (it.isEmpty()) 0L else it.toDoubleOrNull()?.takeIf { d -> d.isFinite() }?.toLong() }
        is Boolean -> if (v) 1L else 0L
        else -> null
    }

    private fun row(o: Any?, defaultAt: Boolean): WebRow? {
        if (o !is JSONObject) return null
        val url = o.opt("url") as? String ?: return null
        if (!WebRules.isWebUrl(url)) return null
        val at = if (!o.has("at") && defaultAt) 0L else (if (o.has("at")) timeOf(o.opt("at")) else null) ?: return null
        return WebRow(url, cut(o.opt("title")?.takeIf { it != JSONObject.NULL }?.toString()), at)
    }

    fun read(text: String): WebLinksData {
        val j = try { JSONObject(text) } catch (e: Exception) { throw WebLinksError("format", "not a links file") }
        return read(j)
    }

    fun read(j: JSONObject): WebLinksData {
        if (j.has("format") && j.opt("format") != FORMAT) throw WebLinksError("format", "not a links file: " + j.opt("format"))
        if (j.opt("format") == FORMAT && j.optInt("v", -1) != VERSION) throw WebLinksError("newer", "links v" + j.opt("v") + " is newer than this reader")
        val b = j.opt("bookmarks") as? JSONArray
        val h = j.opt("history") as? JSONArray
        if (b == null && h == null) throw WebLinksError("empty", "no bookmarks or history")
        val bookmarks = ArrayList<WebRow>()
        val seen = HashSet<String>()
        if (b != null) for (i in 0 until b.length()) {
            val r = row(b.opt(i), defaultAt = true) ?: continue
            if (r.url in seen || bookmarks.size >= MAX_BOOKMARKS) continue
            seen += r.url; bookmarks += r
        }
        val history = ArrayList<WebRow>()
        if (h != null) for (i in 0 until h.length()) row(h.opt(i), defaultAt = false)?.let { history += it }
        val sorted = history.sortedBy { it.at }        // stable, as Array.prototype.sort
        return WebLinksData(bookmarks, sorted.takeLast(MAX_HISTORY), j.optJSONObject(EXT))
    }

    private fun rows(list: List<WebRow>) = JSONArray().apply { list.forEach { put(JSONObject().put("url", it.url).put("title", it.title).put("at", it.at)) } }

    /** The file: the envelope, then the Asztal's two arrays (so the Asztal reads it as its own web.json). */
    fun write(l: WebLinksData, exported: String? = null): String {
        val o = JSONObject().put("format", FORMAT).put("v", VERSION)
        if (exported != null) o.put("exported", exported)
        o.put("bookmarks", rows(l.bookmarks)).put("history", rows(l.history))
        l.ext?.let { o.put(EXT, it) }
        return o.toString(1)
    }

    /** Nothing in either side is lost: a bookmark in both keeps the earlier `at` and the longer title; history = every distinct (url, at). */
    fun merge(a: WebLinksData, b: WebLinksData): WebLinksData {
        val by = LinkedHashMap<String, WebRow>()
        for (r in a.bookmarks + b.bookmarks) {
            val o = by[r.url]
            by[r.url] = if (o == null) r else o.copy(at = minOf(o.at, r.at), title = if (r.title.length > o.title.length) r.title else o.title)
        }
        val visits = LinkedHashMap<String, WebRow>()
        for (r in a.history + b.history) {
            val k = "${r.at} ${r.url}"
            val o = visits[k]
            visits[k] = if (o == null || r.title.length > o.title.length) r else o
        }
        return normalise(by.values.toList(), visits.values.toList())
    }

    private fun normalise(bookmarks: List<WebRow>, history: List<WebRow>) =
        WebLinksData(bookmarks.distinctBy { it.url }.take(MAX_BOOKMARKS), history.sortedBy { it.at }.takeLast(MAX_HISTORY))

    /** A page finished loading: a new row, or the same URL right after itself refreshed (the Asztal's rule). */
    fun visit(l: WebLinksData, url: String, title: String?, now: Long): WebLinksData {
        if (!WebRules.isWebUrl(url)) return l
        val h = l.history.toMutableList()
        val last = h.lastOrNull()
        if (last != null && last.url == url) h[h.size - 1] = last.copy(at = maxOf(last.at, now), title = if (!title.isNullOrEmpty()) cut(title) else last.title)
        else h += WebRow(url, cut(title), now)
        return l.copy(history = h.takeLast(MAX_HISTORY))
    }

    /** Adds or removes a bookmark → (links, bookmarked) or (links, null) at the limit or for a non-web URL. */
    fun toggle(l: WebLinksData, url: String, title: String?, now: Long): Pair<WebLinksData, Boolean?> {
        if (!WebRules.isWebUrl(url)) return l to null
        if (l.bookmarks.any { it.url == url }) return l.copy(bookmarks = l.bookmarks.filter { it.url != url }) to false
        if (l.bookmarks.size >= MAX_BOOKMARKS) return l to null
        return l.copy(bookmarks = l.bookmarks + WebRow(url, cut(title), now)) to true
    }

    /** History kept for `days` (0 keeps none); bookmarks are never pruned. */
    fun prune(l: WebLinksData, days: Int, now: Long): WebLinksData = l.copy(history = l.history.filter { it.at >= now - days.coerceAtLeast(0) * DAY })

    fun cleanOps(ops: List<WebOp>): List<WebOp> = ops.take(2000)
        .filter { it.op in OPS && (if (it.op == "clear") it.url.isEmpty() else WebRules.isWebUrl(it.url)) }
        .map { it.copy(title = cut(it.title)) }

    fun parseOps(a: JSONArray?): List<WebOp> = (0 until (a?.length() ?: 0)).mapNotNull { i ->
        val o = a!!.optJSONObject(i) ?: return@mapNotNull null
        WebOp(o.optString("op"), o.optString("url", ""), o.optString("title", ""), timeOf(o.opt("at")) ?: 0L)
    }

    /** Applying the same ops twice changes nothing more (an outbox may be sent twice). */
    fun apply(l: WebLinksData, ops: List<WebOp>): WebLinksData {
        val b = l.bookmarks.toMutableList()
        var h = l.history.toMutableList()
        for (o in cleanOps(ops)) when (o.op) {
            "bookmark" -> {
                val i = b.indexOfFirst { it.url == o.url }
                if (i >= 0) { if (o.title.isNotEmpty() && b[i].title.isEmpty()) b[i] = b[i].copy(title = o.title) }
                else if (b.size < MAX_BOOKMARKS) b += WebRow(o.url, o.title, o.at)
            }
            "unbookmark" -> b.removeAll { it.url == o.url }
            "forget" -> h.removeAll { it.url == o.url }
            "clear" -> h = h.filter { it.at < o.at }.toMutableList()
            else -> if (h.none { it.url == o.url && it.at == o.at }) h += WebRow(o.url, o.title, o.at)
        }
        return WebLinksData(b, h.sortedBy { it.at }.takeLast(MAX_HISTORY), l.ext)
    }

    /** History per URL, newest first: (row with the last time and title, visit count). */
    fun grouped(l: WebLinksData, q: String = "", limit: Int = Int.MAX_VALUE): List<Pair<WebRow, Int>> {
        val by = LinkedHashMap<String, Pair<WebRow, Int>>()
        for (r in l.history) {
            val g = by[r.url]
            by[r.url] = if (g == null) r to 1 else {
                val (row, n) = g
                (if (r.at >= row.at) row.copy(at = r.at, title = r.title.ifEmpty { row.title }) else row.copy(title = row.title.ifEmpty { r.title })) to n + 1
            }
        }
        val n = q.trim().lowercase()
        return by.values.filter { n.isEmpty() || it.first.url.lowercase().contains(n) || it.first.title.lowercase().contains(n) }
            .sortedByDescending { it.first.at }.take(limit)
    }

    fun opsJson(ops: List<WebOp>): JSONArray = JSONArray().apply {
        ops.forEach { put(JSONObject().put("op", it.op).put("url", it.url).put("title", it.title).put("at", it.at)) }
    }
}
