package hu.vrg.mobile.notebook

import org.json.JSONArray
import org.json.JSONObject

// A kit is one application of VRG Füzet as plain data (Mobile/notebook/kits/<id>.json, PROTOCOL.md there): the entry
// types it records and their fields, the quick chips, the views that show its entries, the rules that raise open items
// and the keyword detectors behind the notes. No code ships with a kit, so an agent can write one and the phone can
// import it. The four parts of the framework: entries (types), views, actions (chips) and rules.

enum class FieldKind(val id: String) {
    TEXT("text"), NUMBER("number"), CHOICE("choice"), MULTI("multi"), CHECK("check"), DATE("date"), RATING("rating");

    companion object { fun of(s: String?): FieldKind? = entries.firstOrNull { it.id == s } }
}

data class KField(
    val id: String, val label: String, val kind: FieldKind,
    val unit: String? = null, val options: List<String> = emptyList(),
    val required: Boolean = false,
    /** A date field whose day passing raises an open item while the entry is not done. */
    val due: Boolean = false,
    /** Limits of a number field: a value outside them is an open item (a measurement against its limit). */
    val min: Double? = null, val max: Double? = null,
)

data class KType(
    val id: String, val label: String, val sym: String, val color: Long?,
    val fields: List<KField>, val checkable: Boolean = false,
) {
    fun field(id: String): KField? = fields.firstOrNull { it.id == id }
}

/** A quick chip: one tap sets the entry's type, adds a tag or marks it open (Tisztázandó). */
data class KChip(val id: String, val label: String, val sym: String, val type: String? = null, val tag: String? = null, val open: Boolean = false)

enum class ViewKind(val id: String) {
    TIMELINE("timeline"), LIST("list"), CHECKLIST("checklist"), TALLY("tally");

    companion object { fun of(s: String?): ViewKind? = entries.firstOrNull { it.id == s } }
}

/** What a tally groups by. */
sealed class GroupBy {
    object Day : GroupBy()
    object Week : GroupBy()
    object Month : GroupBy()
    object Type : GroupBy()
    object Tag : GroupBy()
    data class Field(val id: String) : GroupBy()

    companion object {
        fun parse(s: String?): GroupBy? = when {
            s == null || s == "day" -> Day
            s == "week" -> Week
            s == "month" -> Month
            s == "type" -> Type
            s == "tag" -> Tag
            s.startsWith("field:") && s.length > 6 -> Field(s.substring(6))
            else -> null
        }
    }
}

data class KView(
    val id: String, val label: String, val sym: String, val kind: ViewKind,
    /** Only these types (empty = every type of the kit). */
    val types: Set<String> = emptySet(),
    val tags: Set<String> = emptySet(),
    val by: GroupBy = GroupBy.Day,
    /** A tally's number field to add up; null = count only. */
    val sum: String? = null,
)

/** A rule beyond the built-in ones (missing, open, due, limit): "stale" = no entry of [type] for [days] days. */
data class KRule(val id: String, val kind: String, val type: String, val days: Int, val label: String)

data class KKeyword(val id: String, val re: Regex, val tag: String? = null, val type: String? = null)

data class Kit(
    val id: String, val name: String, val sym: String, val color: Long, val about: String,
    val types: List<KType>, val chips: List<KChip>, val views: List<KView>,
    val rules: List<KRule>, val keywords: List<KKeyword>,
) {
    fun type(id: String?): KType? = types.firstOrNull { it.id == id }
    fun view(id: String?): KView? = views.firstOrNull { it.id == id }
}

/** A parsed kit, or why it was refused. Warnings never stop a kit; errors always do. */
data class KitParse(val kit: Kit?, val errors: List<String>, val warnings: List<String> = emptyList()) {
    val ok get() = kit != null
}

object Kits {
    const val KIND = "vrg-fuzet-kit"
    const val VERSION = 1
    /** The kit that is always on and holds the plain note. */
    const val BASE = "alap"
    const val NOTE_TYPE = "jegyzet"

    private val ID = Regex("[a-z][a-z0-9-]{0,39}")

    fun color(s: String?, fallback: Long = 0xFF93D3E6): Long {
        val h = s?.removePrefix("#") ?: return fallback
        if (h.length != 6 && h.length != 8) return fallback
        return h.toLongOrNull(16)?.let { if (h.length == 6) 0xFF000000 or it else it } ?: fallback
    }

    private fun strings(a: JSONArray?): List<String> =
        if (a == null) emptyList() else (0 until a.length()).map { a.optString(it) }.filter { it.isNotEmpty() }

    private fun JSONObject.str(k: String): String? = if (has(k) && !isNull(k)) optString(k).takeIf { it.isNotEmpty() } else null
    private fun JSONObject.num(k: String): Double? = if (has(k) && !isNull(k)) optDouble(k).takeIf { !it.isNaN() } else null

    fun parse(text: String): KitParse = try {
        parse(JSONObject(text))
    } catch (e: org.json.JSONException) {
        KitParse(null, listOf("nem JSON: " + (e.message ?: "")))
    }

    fun parse(o: JSONObject): KitParse {
        val err = mutableListOf<String>()
        val warn = mutableListOf<String>()
        if (o.optString("kind") != KIND) err += "kind: \"$KIND\" kell"
        val v = o.optInt("v", -1)
        if (v != VERSION) err += "v: $VERSION kell (ez: $v)"
        val id = o.optString("id")
        if (!ID.matches(id)) err += "id: kisbetű, szám, kötőjel, legfeljebb 40 (ez: \"$id\")"
        val name = o.optString("name").trim()
        if (name.isEmpty()) err += "name: üres"

        val types = mutableListOf<KType>()
        val ta = o.optJSONArray("types")
        if (ta == null || ta.length() == 0) err += "types: legalább egy típus kell"
        for (i in 0 until (ta?.length() ?: 0)) {
            val t = ta!!.optJSONObject(i) ?: run { err += "types[$i]: nem objektum"; null } ?: continue
            val tid = t.optString("id")
            if (!ID.matches(tid)) err += "types[$i].id: \"$tid\""
            if (types.any { it.id == tid }) err += "types: \"$tid\" kétszer"
            val fields = mutableListOf<KField>()
            val fa = t.optJSONArray("fields")
            for (j in 0 until (fa?.length() ?: 0)) {
                val f = fa!!.optJSONObject(j) ?: run { err += "$tid.fields[$j]: nem objektum"; null } ?: continue
                val fid = f.optString("id")
                val where = "$tid.$fid"
                if (!ID.matches(fid)) err += "$tid.fields[$j].id: \"$fid\""
                if (fields.any { it.id == fid }) err += "$where kétszer"
                val kind = FieldKind.of(f.optString("kind"))
                if (kind == null) { err += "$where.kind: \"${f.optString("kind")}\" (text, number, choice, multi, check, date, rating)"; continue }
                val options = strings(f.optJSONArray("options"))
                if ((kind == FieldKind.CHOICE || kind == FieldKind.MULTI) && options.isEmpty()) err += "$where: a $kind mezőnek options kell"
                if (options.size != options.toSet().size) err += "$where.options: ismétlődő elem"
                val due = f.optBoolean("due", false)
                if (due && kind != FieldKind.DATE) err += "$where.due: csak date mezőn"
                val min = f.num("min"); val max = f.num("max")
                if ((min != null || max != null) && kind != FieldKind.NUMBER) err += "$where.min/max: csak number mezőn"
                if (min != null && max != null && min > max) err += "$where: min > max"
                fields += KField(fid, f.optString("label").ifBlank { fid }, kind, f.str("unit"), options, f.optBoolean("required", false), due, min, max)
            }
            types += KType(tid, t.optString("label").ifBlank { tid }, t.optString("sym").ifBlank { "•" },
                t.str("color")?.let { color(it) }, fields, t.optBoolean("checkable", false))
        }
        if (id == BASE && types.none { it.id == NOTE_TYPE }) err += "az alap kitnek \"$NOTE_TYPE\" típus kell"

        val chips = mutableListOf<KChip>()
        val ca = o.optJSONArray("chips")
        for (i in 0 until (ca?.length() ?: 0)) {
            val c = ca!!.optJSONObject(i) ?: continue
            val cid = c.optString("id")
            if (!ID.matches(cid)) err += "chips[$i].id: \"$cid\""
            val type = c.str("type")
            if (type != null && types.none { it.id == type }) err += "chips.$cid.type: nincs \"$type\" típus"
            val chip = KChip(cid, c.optString("label").ifBlank { cid }, c.optString("sym").ifBlank { "•" }, type, c.str("tag"), c.optBoolean("open", false))
            if (chip.type == null && chip.tag == null && !chip.open) warn += "chips.$cid: nem csinál semmit"
            chips += chip
        }

        val views = mutableListOf<KView>()
        val va = o.optJSONArray("views")
        for (i in 0 until (va?.length() ?: 0)) {
            val w = va!!.optJSONObject(i) ?: continue
            val wid = w.optString("id")
            if (!ID.matches(wid)) err += "views[$i].id: \"$wid\""
            if (views.any { it.id == wid }) err += "views: \"$wid\" kétszer"
            val kind = ViewKind.of(w.optString("kind"))
            if (kind == null) { err += "views.$wid.kind: \"${w.optString("kind")}\" (timeline, list, checklist, tally)"; continue }
            val vt = strings(w.optJSONArray("types")).toSet()
            vt.filter { t -> types.none { it.id == t } }.forEach { err += "views.$wid.types: nincs \"$it\" típus" }
            val scope = if (vt.isEmpty()) types else types.filter { it.id in vt }
            val by = GroupBy.parse(w.str("by"))
            if (by == null) err += "views.$wid.by: \"${w.optString("by")}\" (day, week, month, type, tag, field:<id>)"
            if (by is GroupBy.Field && scope.none { it.field(by.id) != null }) err += "views.$wid.by: nincs \"${by.id}\" mező"
            val sum = w.str("sum")
            if (sum != null && scope.none { it.field(sum)?.kind == FieldKind.NUMBER }) err += "views.$wid.sum: \"$sum\" nem number mező"
            if (kind == ViewKind.CHECKLIST && scope.none { it.checkable }) err += "views.$wid: a checklist pipálható típust kér"
            views += KView(wid, w.optString("label").ifBlank { wid }, w.optString("sym").ifBlank { "▤" }, kind, vt,
                strings(w.optJSONArray("tags")).toSet(), by ?: GroupBy.Day, sum)
        }
        if (views.isEmpty()) warn += "views: nincs nézet, a Napló látszik"

        val rules = mutableListOf<KRule>()
        val ra = o.optJSONArray("rules")
        for (i in 0 until (ra?.length() ?: 0)) {
            val r = ra!!.optJSONObject(i) ?: continue
            val rid = r.optString("id")
            if (!ID.matches(rid)) err += "rules[$i].id: \"$rid\""
            val kind = r.optString("kind")
            if (kind != "stale") { err += "rules.$rid.kind: \"$kind\" (stale)"; continue }
            val type = r.optString("type")
            if (types.none { it.id == type }) err += "rules.$rid.type: nincs \"$type\" típus"
            val days = r.optInt("days", 0)
            if (days < 1) err += "rules.$rid.days: legalább 1"
            rules += KRule(rid, kind, type, days, r.optString("label").ifBlank { rid })
        }

        val keywords = mutableListOf<KKeyword>()
        val ka = o.optJSONArray("keywords")
        for (i in 0 until (ka?.length() ?: 0)) {
            val k = ka!!.optJSONObject(i) ?: continue
            val kid = k.optString("id")
            val re = try { Regex(k.optString("re"), RegexOption.IGNORE_CASE) } catch (e: Exception) { err += "keywords.$kid.re: hibás minta"; continue }
            if (k.optString("re").isEmpty()) { err += "keywords.$kid.re: üres"; continue }
            val s = k.optJSONObject("suggest")
            val tag = s?.str("tag"); val type = s?.str("type")
            if (tag == null && type == null) err += "keywords.$kid.suggest: tag vagy type kell"
            if (type != null && types.none { it.id == type }) err += "keywords.$kid.suggest.type: nincs \"$type\" típus"
            keywords += KKeyword(kid, re, tag, type)
        }

        if (err.isNotEmpty()) return KitParse(null, err, warn)
        val shown = views.ifEmpty { listOf(KView("naplo", "Napló", "▤", ViewKind.TIMELINE)) }
        return KitParse(
            Kit(id, name, o.optString("sym").ifBlank { "▤" }, color(o.str("color")), o.optString("about"), types, chips, shown, rules, keywords),
            emptyList(), warn,
        )
    }
}
