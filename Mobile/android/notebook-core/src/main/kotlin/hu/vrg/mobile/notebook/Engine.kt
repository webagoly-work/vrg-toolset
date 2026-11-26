package hu.vrg.mobile.notebook

import java.text.Normalizer
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeParseException
import java.time.temporal.ChronoUnit
import java.time.temporal.IsoFields

// What VRG Füzet derives from the store each time it is shown: titles, search, the kits' views and the open items.
// Nothing here is stored, so entries may arrive in any order and a new kit or rule applies to old entries at once.

/** The kits the app knows: bundled ones and the ones the user imported. Later ids replace earlier ones. */
class Library(kits: List<Kit>) {
    val all: List<Kit> = kits.associateBy { it.id }.values.sortedWith(compareBy({ it.id != Kits.BASE }, { it.name }))

    fun kit(id: String?): Kit? = all.firstOrNull { it.id == id }
    fun type(e: Entry): KType? = kit(e.kit)?.type(e.type)
    fun on(store: Store): List<Kit> = all.filter { store.isOn(it.id) }
}

data class Section(
    val key: String, val title: String, val entries: List<Entry>,
    val count: Int = entries.size, val sum: Double? = null, val unit: String? = null,
)

data class ViewResult(val view: KView, val sections: List<Section>) {
    val isEmpty get() = sections.all { it.entries.isEmpty() }
}

enum class OpenKind(val label: String, val sym: String) {
    DUE("Esedékes", "⏰"), LIMIT("Határérték", "⚠"), OPEN("Tisztázandó", "⚑"),
    MISSING("Hiányzik", "◌"), STALE("Rég volt", "↺"), SUGGEST("Javaslat", "✦"),
}

/** A loose end, derived. [key] is stable, so a dismissed one stays dismissed. A suggestion carries what it would do. */
data class OpenItem(
    val key: String, val kind: OpenKind, val kit: String, val entryId: String?,
    val title: String, val detail: String,
    val tag: String? = null, val toKit: String? = null, val toType: String? = null,
)

object Engine {
    private val DAYS = listOf("hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat", "vasárnap")
    private val MONTHS = listOf("január", "február", "március", "április", "május", "június", "július", "augusztus",
        "szeptember", "október", "november", "december")
    /** Suggestions are offered for entries this recent, so an import of old notes does not flood the list. */
    const val SUGGEST_DAYS = 14L

    fun fold(s: String): String = Normalizer.normalize(s, Normalizer.Form.NFD).replace(Regex("\\p{M}+"), "").lowercase()

    fun day(at: Long, zone: ZoneId): LocalDate = Instant.ofEpochMilli(at).atZone(zone).toLocalDate()

    fun date(s: String?): LocalDate? = try { s?.let { LocalDate.parse(it.trim()) } } catch (e: DateTimeParseException) { null }

    /** 2 → "2", 2.5 → "2,5", 0.333 → "0,33". */
    fun num(n: Double): String {
        if (n == Math.rint(n) && Math.abs(n) < 1e15) return n.toLong().toString()
        return String.format(java.util.Locale.ROOT, "%.2f", n).trimEnd('0').trimEnd('.').replace('.', ',')
    }

    fun valueText(field: KField?, v: Value): String = when (v) {
        is Value.Text -> if (field?.kind == FieldKind.DATE) date(v.s)?.let { "${it.year}. ${"%02d".format(it.monthValue)}. ${"%02d".format(it.dayOfMonth)}." } ?: v.s else v.s
        is Value.Num -> if (field?.kind == FieldKind.RATING) "★".repeat(v.n.toInt().coerceIn(0, 5)) else num(v.n) + (field?.unit?.let { " $it" } ?: "")
        is Value.Bool -> if (v.b) "igen" else "nem"
        is Value.Many -> v.items.joinToString(", ")
    }

    /** The fields in one line, in the type's order: "30 perc · 2,1 km". */
    fun summary(e: Entry, lib: Library): String {
        val t = lib.type(e)
        val order = t?.fields?.map { it.id } ?: e.f.keys.sorted()
        return order.mapNotNull { id -> e.f[id]?.takeUnless { it.isBlank }?.let { valueText(t?.field(id), it) } }.joinToString(" · ")
    }

    /** What an entry is called in a list: its first text line, else its fields, else its type. */
    fun title(e: Entry, lib: Library): String =
        e.text.lineSequence().firstOrNull { it.isNotBlank() }?.trim()?.take(120)
            ?: summary(e, lib).takeIf { it.isNotEmpty() }
            ?: lib.type(e)?.label ?: e.type

    fun dayTitle(d: LocalDate, today: LocalDate): String = when (d) {
        today -> "Ma"
        today.minusDays(1) -> "Tegnap"
        else -> (if (d.year != today.year) "${d.year}. " else "") + "${MONTHS[d.monthValue - 1]} ${d.dayOfMonth}., ${DAYS[d.dayOfWeek.value - 1]}"
    }

    // ---- search ------------------------------------------------------------------------------------------------

    private fun haystack(e: Entry, lib: Library): String {
        val t = lib.type(e)
        return fold(listOf(e.text, t?.label ?: e.type, lib.kit(e.kit)?.name ?: e.kit, summary(e, lib), e.tags.joinToString(" ")).joinToString(" "))
    }

    /** Every entry of every kit that has all the words; "#címke" means that tag exactly. Newest first. */
    fun search(store: Store, lib: Library, query: String): List<Entry> {
        val words = query.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
        if (words.isEmpty()) return emptyList()
        val tags = words.filter { it.startsWith("#") && it.length > 1 }.map { fold(it.substring(1)) }
        val plain = words.filterNot { it.startsWith("#") }.map(::fold)
        return store.entries.filter { e ->
            val hay = haystack(e, lib)
            tags.all { t -> e.tags.any { fold(it) == t } } && plain.all { hay.contains(it) }
        }.sortedByDescending { it.at }
    }

    /** Entries linked to [id], either way. */
    fun linked(store: Store, id: String): List<Entry> {
        val e = store.byId(id) ?: return emptyList()
        return store.entries.filter { it.id != id && (it.id in e.links || id in it.links) }.sortedByDescending { it.at }
    }

    // ---- views -------------------------------------------------------------------------------------------------

    fun entriesOf(store: Store, kit: Kit, view: KView): List<Entry> = store.entries.filter { e ->
        e.kit == kit.id && (view.types.isEmpty() || e.type in view.types) && (view.tags.isEmpty() || e.tags.any { it in view.tags })
    }

    fun view(store: Store, lib: Library, kit: Kit, view: KView, zone: ZoneId, now: Long): ViewResult {
        val es = entriesOf(store, kit, view)
        val today = day(now, zone)
        val sections = when (view.kind) {
            ViewKind.LIST -> listOf(Section("", view.label, es.sortedByDescending { it.at }))
            ViewKind.TIMELINE -> es.groupBy { day(it.at, zone) }.toSortedMap(reverseOrder())
                .map { (d, list) -> Section(d.toString(), dayTitle(d, today), list.sortedByDescending { it.at }) }
            ViewKind.CHECKLIST -> {
                val (done, todo) = es.partition { it.done }
                val due = { e: Entry -> lib.type(e)?.fields?.firstOrNull { it.due }?.let { f -> (e.f[f.id] as? Value.Text)?.s?.let(::date) } }
                listOf(
                    Section("todo", "Teendő", todo.sortedWith(compareBy<Entry, Long?>(nullsLast()) { due(it)?.toEpochDay() }.thenBy { it.at })),
                    Section("done", "Kész", done.sortedByDescending { it.touched }),
                )
            }
            ViewKind.TALLY -> tally(es, lib, kit, view, zone, today)
        }
        return ViewResult(view, sections)
    }

    private fun tally(es: List<Entry>, lib: Library, kit: Kit, view: KView, zone: ZoneId, today: LocalDate): List<Section> {
        val unit = view.sum?.let { s -> kit.types.firstNotNullOfOrNull { it.field(s)?.unit } }
        fun sumOf(list: List<Entry>): Double? = view.sum?.let { s -> list.sumOf { (it.f[s] as? Value.Num)?.n ?: 0.0 } }
        val timed = view.by is GroupBy.Day || view.by is GroupBy.Week || view.by is GroupBy.Month
        val groups: List<Pair<Pair<String, String>, Entry>> = es.flatMap { e ->
            val d = day(e.at, zone)
            when (val by = view.by) {
                GroupBy.Day -> listOf((d.toString() to dayTitle(d, today)) to e)
                GroupBy.Week -> {
                    val y = d.get(IsoFields.WEEK_BASED_YEAR); val w = d.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR)
                    val ty = today.get(IsoFields.WEEK_BASED_YEAR); val tw = today.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR)
                    listOf(("%04d-W%02d".format(y, w) to if (y == ty && w == tw) "Ez a hét" else "$y. $w. hét") to e)
                }
                GroupBy.Month -> listOf(("%04d-%02d".format(d.year, d.monthValue) to "${d.year}. ${MONTHS[d.monthValue - 1]}") to e)
                GroupBy.Type -> listOf((e.type to (lib.type(e)?.label ?: e.type)) to e)
                GroupBy.Tag -> if (e.tags.isEmpty()) listOf(("" to "(címke nélkül)") to e) else e.tags.map { (it to "#$it") to e }
                is GroupBy.Field -> {
                    val v = e.f[by.id]?.takeUnless { it.isBlank }
                    val txt = v?.let { valueText(lib.type(e)?.field(by.id), it) }
                    listOf(((txt?.let(::fold) ?: "") to (txt ?: "(üres)")) to e)
                }
            }
        }
        // grouped by the key alone: "Dugalj" and "dugalj" are one material, titled as it was first written
        val sections = groups.groupBy { it.first.first }.map { (key, pairs) ->
            val list = pairs.map { it.second }
            Section(key, pairs.minByOrNull { it.second.at }!!.first.second, list.sortedByDescending { it.at }, sum = sumOf(list), unit = unit)
        }
        return if (timed) sections.sortedByDescending { it.key }
        else sections.sortedWith(compareByDescending<Section> { it.sum ?: it.count.toDouble() }.thenBy { it.title })
    }

    // ---- open items --------------------------------------------------------------------------------------------

    fun open(store: Store, lib: Library, zone: ZoneId, now: Long): List<OpenItem> {
        val today = day(now, zone)
        val on = lib.on(store)
        val onIds = on.map { it.id }.toSet()
        val out = mutableListOf<OpenItem>()
        store.entries.filter { it.kit in onIds }.sortedByDescending { it.at }.forEach { e ->
            val t = lib.type(e)
            val name = title(e, lib)
            if (e.open) out += OpenItem("open:${e.id}", OpenKind.OPEN, e.kit, e.id, name, t?.label ?: e.type)
            t?.fields?.forEach { f ->
                val v = e.f[f.id]
                if (f.required && !e.done && (v == null || v.isBlank)) out += OpenItem("miss:${e.id}:${f.id}", OpenKind.MISSING, e.kit, e.id, name, "${t.label}: ${f.label}")
                val dt = v as? Value.Text
                val d = if (f.due && !e.done) date(dt?.s) else null
                if (d != null && dt != null && !d.isAfter(today)) out += OpenItem("due:${e.id}:${f.id}", OpenKind.DUE, e.kit, e.id, name,
                    if (d == today) "${f.label}: ma" else "${f.label}: ${valueText(f, dt)}, lejárt")
                val nv = v as? Value.Num
                if (nv != null && f.kind == FieldKind.NUMBER) {
                    val low = f.min?.let { nv.n < it } ?: false
                    val high = f.max?.let { nv.n > it } ?: false
                    if (low || high) out += OpenItem("limit:${e.id}:${f.id}", OpenKind.LIMIT, e.kit, e.id, name,
                        "${f.label}: ${valueText(f, nv)}, " + (if (low) "legalább ${num(f.min!!)}" else "legfeljebb ${num(f.max!!)}") + (f.unit?.let { " $it" } ?: "") + " kell")
                }
            }
        }
        on.forEach { k ->
            k.rules.filter { it.kind == "stale" }.forEach { r ->
                val last = store.entries.filter { it.kit == k.id && it.type == r.type }.maxOfOrNull { it.at }
                val since = last?.let { ChronoUnit.DAYS.between(day(it, zone), today) }
                if (since == null || since >= r.days) out += OpenItem("stale:${k.id}:${r.id}:$today", OpenKind.STALE, k.id, null, r.label,
                    since?.let { "utoljára $it napja: ${k.type(r.type)?.label ?: r.type}" } ?: "még nincs ilyen: ${k.type(r.type)?.label ?: r.type}")
            }
        }
        out += suggestions(store, lib, zone, now)
        return out.filterNot { it.key in store.dismissed }.sortedBy { it.kind.ordinal }
    }

    /**
     * The keyword detectors of the kits that are on, over recent entries: a tag the text implies, or for a plain note a
     * type of any kit (a note "elromlott a bojler" becomes Otthon › Karbantartás with one tap).
     */
    fun suggestions(store: Store, lib: Library, zone: ZoneId, now: Long): List<OpenItem> {
        val from = day(now, zone).minusDays(SUGGEST_DAYS)
        val on = lib.on(store)
        val out = mutableListOf<OpenItem>()
        store.entries.filter { store.isOn(it.kit) && !it.done && it.text.isNotBlank() && !day(it.at, zone).isBefore(from) }.forEach { e ->
            val text = e.text.lowercase()
            on.forEach { k ->
                k.keywords.filter { it.re.containsMatchIn(text) }.forEach { kw ->
                    val name = title(e, lib)
                    if (kw.tag != null && kw.tag !in e.tags)
                        out += OpenItem("kw:${e.id}:${k.id}:${kw.id}:tag", OpenKind.SUGGEST, e.kit, e.id, name, "címke: #${kw.tag}", tag = kw.tag)
                    val plain = e.kit == Kits.BASE && e.type == Kits.NOTE_TYPE
                    if (kw.type != null && plain && !(e.kit == k.id && e.type == kw.type))
                        out += OpenItem("kw:${e.id}:${k.id}:${kw.id}:type", OpenKind.SUGGEST, e.kit, e.id, name,
                            "legyen ${k.name} › ${k.type(kw.type)?.label ?: kw.type}", toKit = k.id, toType = kw.type)
                }
            }
        }
        return out
    }

    /** Does what a suggestion offers; anything else only dismisses. */
    fun apply(store: Store, item: OpenItem, at: Long): Store {
        val id = item.entryId ?: return store.dismiss(item.key)
        val s = when {
            item.tag != null -> store.addTag(id, item.tag, at)
            item.toKit != null && item.toType != null -> store.update(id, at) { it.copy(kit = item.toKit, type = item.toType) }
            else -> store
        }
        return s.dismiss(item.key)
    }
}
