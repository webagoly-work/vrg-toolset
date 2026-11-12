package hu.vrg.mobile.core

import java.text.Normalizer
import java.util.Locale

// Kommand (WP M19): the Asztal's one search over the Desktop's catalog, the phone's features and the open windows.
// fold / words / search are Dashboard/shell/lib/palette.js line by line, so a query finds the same things in the same
// order on the phone as in the Desktop's command palette; KommandTest replays the palette's own results
// (Mobile/tests/fixtures/kommand.json, written by Mobile/catalogue/desk-gen.js).

/** How a Desktop unit reaches the phone (docs/mobile/PARITY.md). */
enum class Reach { NATIVE, WEBAPP, PC, NONE }

/**
 * One User-level unit of the Desktop's catalog (DeskCatalog.kt, generated). [target] by [reach]: NATIVE a feature id or
 * a frame part (`kompakt`, `kommand`, `browser`), WEBAPP an M21 app id, PC a feature id or `port:<n>` (M8), NONE the reason.
 */
data class DeskUnit(
    val id: String, val hu: String, val en: String, val group: String, val icon: String,
    val reach: Reach, val target: String,
)

/** What the palette searches: an id and its Hungarian and English names. */
data class KommandItem(val id: String, val hu: String, val en: String)

object Kommand {
    const val MAX_RECENT = 30
    private val MARKS = Regex("[\\u0300-\\u036f]")
    private val SPLIT = Regex("[^a-z0-9]+")

    fun fold(s: String?): String = MARKS.replace(Normalizer.normalize(s.orEmpty(), Normalizer.Form.NFD), "").lowercase(Locale.ROOT)

    fun words(s: String?): List<String> = fold(s).split(SPLIT).filter { it.isNotEmpty() }

    /**
     * Every query word must be a prefix of a word in hu + en; rank = the sum of the positions of those words, then
     * recent use, then the index order. An empty query returns everything, recent first.
     */
    fun <T> search(items: List<T>, query: String, recent: List<String> = emptyList(), key: (T) -> KommandItem): List<T> {
        val q = words(query)
        fun rank(id: String) = recent.indexOf(id).let { if (it < 0) 1_000_000 else it }
        data class Hit<T>(val it: T, val score: Int, val r: Int, val n: Int)
        val out = ArrayList<Hit<T>>()
        items.forEachIndexed { n, t ->
            val k = key(t)
            if (q.isEmpty()) { out += Hit(t, 0, rank(k.id), n); return@forEachIndexed }
            val w = words(k.hu + " " + k.en)
            var score = 0
            for (x in q) {
                val at = w.indexOfFirst { it.startsWith(x) }
                if (at < 0) return@forEachIndexed
                score += at
            }
            out += Hit(t, score, rank(k.id), n)
        }
        return out.sortedWith(compareBy<Hit<T>>({ it.score }, { it.r }, { it.n })).map { it.it }
    }

    fun search(items: List<KommandItem>, query: String, recent: List<String> = emptyList()): List<KommandItem> =
        search(items, query, recent) { it }

    /** A used id goes to the front, once; the list keeps [MAX_RECENT]. */
    fun remember(recent: List<String>, id: String): List<String> = (listOf(id) + recent.filter { it != id }).take(MAX_RECENT)

    /**
     * The phone's index: the Desktop's units that open something here (`cat:`), the phone's own features (`feat:`), and
     * the open windows (`win:`, title given by the caller). Units the phone cannot reach are left out of the search;
     * the ◣ menu still lists them, dimmed, so the map stays whole.
     */
    fun index(units: List<DeskUnit> = DeskCatalog.UNITS, features: List<FeatureInfo> = Catalogue.ALL, windows: List<Pair<String, String>> = emptyList()): List<KommandItem> {
        val out = ArrayList<KommandItem>()
        val seen = HashSet<String>()
        fun add(id: String, hu: String, en: String) { if (seen.add(id)) out += KommandItem(id, hu, en) }
        windows.forEach { (id, title) -> add("win:$id", "Ablak · $title", "window") }
        units.filter { it.reach != Reach.NONE }.forEach { add("cat:${it.id}", it.hu, it.en) }
        features.forEach { add("feat:${it.id}", it.title, it.id) }
        return out
    }

    /** A query that is a web address: Kommand offers to open it in the phone's browser (the Desktop's `web` window). */
    fun asUrl(query: String): String? {
        val s = query.trim()
        if (s.isEmpty() || s.any { it.isWhitespace() }) return null
        if (s.startsWith("https://") || s.startsWith("http://")) return s
        val host = s.substringBefore('/')
        return if (Regex("^[a-z0-9-]+(\\.[a-z0-9-]+)*\\.[a-z]{2,}$", RegexOption.IGNORE_CASE).matches(host)) "https://$s" else null
    }
}

/** Kezdőlap (WP M19): the Asztal frame, or the tile home it replaces, kept as Kompakt. */
enum class HomeMode(val id: String, val label: String) {
    DESK("desk", "Asztal"),
    COMPACT("compact", "Kompakt");

    companion object { fun of(id: String?): HomeMode = entries.firstOrNull { it.id == id } ?: DESK }
}

/** Tájolás (WP M19, the user's manual toggle): the top strip's button cycles Automatikus → Álló → Fekvő. */
enum class Orientation(val id: String, val label: String, val glyph: String) {
    AUTO("auto", "Automatikus", "⟳"),
    PORTRAIT("portrait", "Álló", "▯"),
    LANDSCAPE("landscape", "Fekvő", "▭");

    fun next(): Orientation = entries[(ordinal + 1) % entries.size]

    companion object {
        /** D-14: an unknown or missing value is Álló, the lock every build before M19 had, so nothing turns on its own. */
        fun of(id: String?): Orientation = entries.firstOrNull { it.id == id } ?: PORTRAIT
    }
}
