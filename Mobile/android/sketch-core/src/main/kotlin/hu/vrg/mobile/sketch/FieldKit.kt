package hu.vrg.mobile.sketch

import org.json.JSONArray
import org.json.JSONObject
import java.text.Normalizer

// The VRG Sketcher field kit (WP M26-M28): the catalog (Sketcher/catalog/fieldkit.json) and the engine that turns
// whatever has been captured so far into the DIGITAL SHADOW: the questions that matter now, the photos still on the
// shot list, the suggestions the notes imply, and every loose end. Nothing here is stored: it is recomputed from the
// survey each time, so records may arrive in any order (docs/sketcher/README.md, the six rules).
//
// The JS engine (Sketcher/lib/fieldkit.js) implements the same language; Sketcher/test/fixtures/shadow.json is written
// by it and replayed by FieldKitTest, so the phone and the Desktop always show the same shadow.

// ---- the condition language ---------------------------------------------------------------------------------------

sealed class Cond {
    object True : Cond()
    object False : Cond()
    /** A fact of [kind] that is any of [ids]; for "answer", [opts] narrows it to those options (null = answered at all). */
    data class Of(val kind: String, val ids: Set<String>, val opts: Set<String>? = null) : Cond()
    data class All(val of: List<Cond>) : Cond()
    data class AnyOf(val of: List<Cond>) : Cond()
    data class Not(val of: Cond) : Cond()

    companion object {
        val KINDS = setOf("scope", "answer", "room", "point", "tag", "kw", "chip", "photo", "site", "variant")

        private fun ids(v: Any?): Set<String> = when (v) {
            is JSONArray -> (0 until v.length()).map { v.optString(it) }.filter { it.isNotEmpty() }.toSet()
            is String -> setOf(v)
            is Boolean -> if (v) setOf("true") else emptySet()
            else -> emptySet()
        }

        fun parse(v: Any?): Cond = when (v) {
            null, JSONObject.NULL -> True
            is Boolean -> if (v) True else False
            is JSONArray -> AnyOf((0 until v.length()).map { parse(v.opt(it)) })
            is JSONObject -> when {
                v.has("all") -> All(v.optJSONArray("all")?.let { a -> (0 until a.length()).map { parse(a.opt(it)) } } ?: emptyList())
                v.has("any") -> AnyOf(v.optJSONArray("any")?.let { a -> (0 until a.length()).map { parse(a.opt(it)) } } ?: emptyList())
                v.has("not") -> Not(parse(v.opt("not")))
                else -> {
                    val k = v.keys().asSequence().firstOrNull { it in KINDS } ?: throw IllegalArgumentException("unknown condition: $v")
                    Of(k, ids(v.opt(k)), if (k == "answer" && v.has("is")) ids(v.opt("is")) else null)
                }
            }
            else -> throw IllegalArgumentException("unknown condition: $v")
        }
    }
}

/** What an option, chip or keyword does: add scope toggles, or answer a question. */
data class Effect(val scope: List<String> = emptyList(), val q: String? = null, val opt: String? = null, val text: String? = null) {
    val isEmpty get() = scope.isEmpty() && q == null

    companion object {
        fun parse(o: JSONObject?): Effect? {
            if (o == null) return null
            val a = o.optJSONObject("answer")
            val sc = o.optJSONArray("scope")?.let { s -> (0 until s.length()).map { s.optString(it) } } ?: emptyList()
            val e = Effect(sc, a?.optString("q")?.takeIf { it.isNotEmpty() }, a?.optString("opt")?.takeIf { it.isNotEmpty() },
                a?.optString("text")?.takeIf { it.isNotEmpty() })
            return if (e.isEmpty) null else e
        }
    }
}

// ---- the catalog --------------------------------------------------------------------------------------------------

data class KFront(val id: String, val label: String, val sym: String, val color: Long)
data class KPurpose(val id: String, val label: String, val sym: String, val color: Long)
data class KChip(val id: String, val label: String, val sym: String, val color: Long, val group: String, val open: Boolean, val sets: Effect?)
data class KScope(val id: String, val label: String, val sym: String, val group: String, val qty: Boolean)
data class KKeyword(val id: String, val re: Regex, val suggest: Effect?)
data class KOption(val id: String, val label: String, val sets: Effect?)
data class KQuestion(
    val id: String, val q: String, val group: String, val prio: Int, val who: String, val cond: Cond,
    val options: List<KOption>, val multi: Boolean, val unit: String?, val hint: String?,
)
data class KShot(val id: String, val purpose: String, val label: String, val hint: String?, val cond: Cond, val need: Int, val room: String?, val prio: Int)
data class KTemplate(val id: String, val label: String, val sym: String, val poly: List<Pt>)
data class PointPreset(val label: String, val glyph: String, val type: PointType, val tags: List<String> = emptyList())

/** A variant (WP M31): a JSON overlay that reshapes the Sketcher for one kind of job. */
data class Variant(
    val id: String, val name: String, val sym: String, val color: Long, val premise: String,
    /** Plain words that describe the job (for finding the variant), not keyword detectors. */
    val topics: List<String> = emptyList(),
    val pluginsOn: List<String> = emptyList(), val pluginsOff: List<String> = emptyList(),
    val rail: List<String>? = null,
    val pointPresets: List<PointPreset> = emptyList(),
    val pointRing: List<String>? = null,
    val roomRing: List<String>? = null,
    val tags: List<Tag> = emptyList(),
    val scopePreset: Map<String, Int> = emptyMap(),
    val hints: Map<String, String> = emptyMap(),
    /** The catalog additions (chips, scope, keywords, questions, shotlist, purposes, templates) as a kit to merge. */
    val adds: Kit = Kit(),
)

data class Kit(
    val fronts: List<KFront> = emptyList(),
    val purposes: List<KPurpose> = emptyList(),
    val chips: List<KChip> = emptyList(),
    val scope: List<KScope> = emptyList(),
    val keywords: List<KKeyword> = emptyList(),
    val questions: List<KQuestion> = emptyList(),
    val shotlist: List<KShot> = emptyList(),
    val templates: List<KTemplate> = emptyList(),
) {
    fun question(id: String?) = questions.firstOrNull { it.id == id }
    fun purpose(id: String?) = purposes.firstOrNull { it.id == id }
    fun chip(id: String?) = chips.firstOrNull { it.id == id }
    fun scopeItem(id: String?) = scope.firstOrNull { it.id == id }
    fun front(id: String) = fronts.firstOrNull { it.id == id }
    fun shot(id: String?) = shotlist.firstOrNull { it.id == id }

    /** The variant's additions on top: an entry with the same id replaces the base one, new ones come after. */
    fun with(v: Variant?): Kit {
        if (v == null) return this
        fun <T> merge(base: List<T>, add: List<T>, id: (T) -> String): List<T> {
            val ids = add.map(id).toSet()
            return base.map { b -> if (id(b) in ids) add.first { id(it) == id(b) } else b } + add.filter { a -> base.none { id(it) == id(a) } }
        }
        val a = v.adds
        return Kit(
            merge(fronts, a.fronts) { it.id }, merge(purposes, a.purposes) { it.id }, merge(chips, a.chips) { it.id },
            merge(scope, a.scope) { it.id }, merge(keywords, a.keywords) { it.id }, merge(questions, a.questions) { it.id },
            merge(shotlist, a.shotlist) { it.id }, merge(templates, a.templates) { it.id },
        )
    }
}

object FieldKit {
    const val KIND = "vrg-fieldkit"
    const val VARIANT_KIND = "vrg-sketcher-variant"

    /** Lower case, accents removed, so "Bojlert" and "bojler" match the same keyword. */
    fun fold(s: String): String = Normalizer.normalize(s, Normalizer.Form.NFD).replace(Regex("\\p{M}+"), "").lowercase()

    fun color(s: String?, fallback: Long = 0xFF7D8590): Long {
        val h = s?.removePrefix("#") ?: return fallback
        return h.toLongOrNull(16)?.let { if (h.length == 6) 0xFF000000 or it else it } ?: fallback
    }

    private fun strs(a: JSONArray?) = if (a == null) emptyList() else (0 until a.length()).map { a.optString(it) }.filter { it.isNotEmpty() }
    private fun <T> objs(a: JSONArray?, f: (JSONObject) -> T): List<T> =
        if (a == null) emptyList() else (0 until a.length()).mapNotNull { a.optJSONObject(it)?.let(f) }
    private fun s(o: JSONObject, k: String) = if (o.has(k) && !o.isNull(k)) o.optString(k) else ""

    /** The catalog's lists out of [o] (the kit itself, or a variant's additions). */
    fun parseLists(o: JSONObject): Kit = Kit(
        objs(o.optJSONArray("fronts")) { KFront(s(it, "id"), s(it, "label"), s(it, "sym"), color(s(it, "color"))) },
        objs(o.optJSONArray("purposes")) { KPurpose(s(it, "id"), s(it, "label"), s(it, "sym"), color(s(it, "color"))) },
        objs(o.optJSONArray("chips")) { KChip(s(it, "id"), s(it, "label"), s(it, "sym"), color(s(it, "color")), s(it, "group"), it.optBoolean("open"), Effect.parse(it.optJSONObject("sets"))) },
        objs(o.optJSONArray("scope")) { KScope(s(it, "id"), s(it, "label"), s(it, "sym"), s(it, "group"), it.optBoolean("qty")) },
        objs(o.optJSONArray("keywords")) { KKeyword(s(it, "id"), Regex(s(it, "re")), Effect.parse(it.optJSONObject("suggest"))) },
        objs(o.optJSONArray("questions")) { q ->
            KQuestion(s(q, "id"), s(q, "q"), s(q, "group"), q.optInt("prio", 1), s(q, "who").ifEmpty { "ugyfel" }, Cond.parse(q.opt("when")),
                objs(q.optJSONArray("options")) { KOption(s(it, "id"), s(it, "label"), Effect.parse(it.optJSONObject("sets"))) },
                q.optBoolean("multi"), q.optJSONObject("num")?.optString("unit"), s(q, "hint").ifEmpty { null })
        },
        objs(o.optJSONArray("shotlist")) { h ->
            KShot(s(h, "id"), s(h, "purpose"), s(h, "label"), s(h, "hint").ifEmpty { null }, Cond.parse(h.opt("when")),
                h.optInt("need", 1), s(h, "room").ifEmpty { null }, h.optInt("prio", 1))
        },
        objs(o.optJSONArray("templates")) { t ->
            val p = t.optJSONArray("poly")
            KTemplate(s(t, "id"), s(t, "label"), s(t, "sym"),
                if (p == null) emptyList() else (0 until p.length()).mapNotNull { i -> p.optJSONArray(i)?.let { Pt(it.optDouble(0), it.optDouble(1)) } })
        },
    )

    fun parse(json: String): Kit {
        val o = JSONObject(json)
        require(o.optString("kind") == KIND) { "not a field kit" }
        return parseLists(o)
    }

    fun parseVariant(json: String): Variant {
        val o = JSONObject(json)
        require(o.optString("kind") == VARIANT_KIND) { "not a variant" }
        val pl = o.optJSONObject("plugins")
        val sc = o.optJSONObject("scopePreset")
        return Variant(
            id = s(o, "id"), name = s(o, "name"), sym = s(o, "sym").ifEmpty { "◐" }, color = color(s(o, "color"), 0xFF8A5CD6),
            premise = s(o, "premise"), topics = strs(o.optJSONArray("topics")),
            pluginsOn = strs(pl?.optJSONArray("on")), pluginsOff = strs(pl?.optJSONArray("off")),
            rail = o.optJSONArray("rail")?.let { strs(it) },
            pointPresets = objs(o.optJSONArray("pointPresets")) { PointPreset(s(it, "label"), s(it, "glyph").ifEmpty { "•" }, PointType.of(s(it, "type")), strs(it.optJSONArray("tags"))) },
            pointRing = o.optJSONArray("pointRing")?.let { strs(it) },
            roomRing = o.optJSONArray("roomRing")?.let { strs(it) },
            tags = objs(o.optJSONArray("tags")) { Tag(s(it, "id"), s(it, "name"), color(s(it, "color")), s(it, "preset").ifEmpty { null }) },
            scopePreset = sc?.let { j -> j.keys().asSequence().associateWith { j.optInt(it, 1) } } ?: emptyMap(),
            hints = o.optJSONObject("hints")?.let { j -> j.keys().asSequence().associateWith { j.optString(it) } } ?: emptyMap(),
            adds = parseLists(o),
        )
    }

    // ---- facts ----------------------------------------------------------------------------------------------------

    /** Everything the conditions can ask about, derived from the survey. */
    data class Facts(
        val scope: Set<String>, val answers: Map<String, Set<String>>, val rooms: Set<String>, val points: Set<String>,
        val tags: Set<String>, val kw: Set<String>, val chips: Set<String>, val photos: Set<String>, val site: Boolean,
        val variant: String?,
    ) {
        fun eval(c: Cond): Boolean = when (c) {
            Cond.True -> true
            Cond.False -> false
            is Cond.All -> c.of.all { eval(it) }
            is Cond.AnyOf -> c.of.any { eval(it) }
            is Cond.Not -> !eval(c.of)
            is Cond.Of -> when (c.kind) {
                "scope" -> c.ids.any { it in scope }
                "answer" -> c.ids.any { q -> answers[q]?.let { a -> c.opts == null || c.opts.any { it in a } } == true }
                "room" -> c.ids.any { it in rooms }
                "point" -> c.ids.any { it in points }
                "tag" -> c.ids.any { it in tags }
                "kw" -> c.ids.any { it in kw }
                "chip" -> c.ids.any { it in chips }
                "photo" -> c.ids.any { it in photos }
                "site" -> site == ("true" in c.ids)
                "variant" -> variant != null && variant in c.ids
                else -> false
            }
        }
    }

    /** The texts the background processes read: notes, memos and photo captions. */
    fun texts(s: Sketch): List<Pair<String?, String>> =
        s.entries.map { it.id to it.text } + s.memos.map { it.id to it.text } + s.captures.map { it.id to it.note }

    /** Keyword id → (the record it was found in, the matched words), first match wins. */
    fun hits(kit: Kit, s: Sketch): Map<String, Pair<String?, String>> {
        val out = LinkedHashMap<String, Pair<String?, String>>()
        val ts = texts(s).filter { it.second.isNotBlank() }.map { it.first to fold(it.second) }
        for (k in kit.keywords) for ((id, t) in ts) {
            val m = k.re.find(t) ?: continue
            out[k.id] = id to m.value.trim(); break
        }
        return out
    }

    fun facts(kit: Kit, s: Sketch): Facts {
        val kinds = s.rooms.flatMap { r -> r.kinds + Ops.tagsOf(s, r.id).mapNotNull { t -> t.preset?.takeIf { it.startsWith("kind:") }?.removePrefix("kind:") } }
        val photos = s.captures.map { it.purpose }.toMutableSet()
        if (s.photos.any { it.shots.isNotEmpty() }) photos += "szoba"
        return Facts(
            scope = s.scope.filterValues { it > 0 }.keys,
            answers = s.answers.filterValues { it.state == AnswerState.ANSWERED }.mapValues { it.value.options.toSet() },
            rooms = kinds.toSet(),
            points = s.points.map { it.type.id }.toSet(),
            tags = s.tagUses.map { it.tag }.toSet(),
            kw = hits(kit, s).keys,
            chips = s.entries.flatMap { it.chips }.toSet(),
            photos = photos,
            site = s.site?.address?.isNotBlank() == true || s.site?.lat != null,
            variant = if (s.variantOn) s.variant else null,
        )
    }

    // ---- the shadow -----------------------------------------------------------------------------------------------

    /** A question in play: its answer if any, and whether it is new (appeared in the last [FRESH_MS]). */
    data class QState(val q: KQuestion, val answer: Answer?, val fresh: Boolean) {
        val done get() = answer?.state == AnswerState.ANSWERED
        val later get() = answer?.state == AnswerState.LATER
    }

    const val FRESH_MS = 10 * 60 * 1000L

    /**
     * The questions whose condition holds now, skipped ones left out. Open ones first (by priority, then the order
     * they appeared, then the catalog's), then the ones put off for later, then the answered ones.
     */
    fun questions(kit: Kit, s: Sketch, f: Facts = facts(kit, s), now: Long = System.currentTimeMillis()): List<QState> {
        val idx = kit.questions.withIndex().associate { it.value.id to it.index }
        return kit.questions.filter { f.eval(it.cond) && s.answers[it.id]?.state != AnswerState.SKIP }
            .map { q -> QState(q, s.answers[q.id], s.seen[q.id].let { it == null || now - it < FRESH_MS } && s.answers[q.id] == null) }
            .sortedWith(compareBy<QState>({ if (it.done) 2 else if (it.later) 1 else 0 }, { it.q.prio }, { s.seen[it.q.id] ?: Long.MAX_VALUE }, { idx[it.q.id] }))
    }

    /** The questions active now that were never seen: the UI records their arrival (Intake.markSeen). */
    fun unseen(kit: Kit, s: Sketch, f: Facts = facts(kit, s)) = kit.questions.filter { f.eval(it.cond) && it.id !in s.seen }.map { it.id }

    /** A suggestion from the notes: a keyword hit whose effect is not in the survey yet, and not swiped away. */
    data class Suggestion(val id: String, val keyword: String, val effect: Effect, val match: String, val source: String?)

    fun applied(e: Effect, s: Sketch): Boolean {
        if (e.scope.isNotEmpty() && e.scope.all { (s.scope[it] ?: 0) > 0 }) return e.q == null || answered(e, s)
        if (e.scope.isEmpty() && e.q != null) return answered(e, s)
        return false
    }

    private fun answered(e: Effect, s: Sketch): Boolean {
        val a = s.answers[e.q] ?: return false
        return a.state == AnswerState.ANSWERED || a.state == AnswerState.SKIP
    }

    fun suggestions(kit: Kit, s: Sketch): List<Suggestion> = hits(kit, s).mapNotNull { (k, hit) ->
        val kw = kit.keywords.firstOrNull { it.id == k } ?: return@mapNotNull null
        val raw = kw.suggest ?: return@mapNotNull null
        val e = raw.copy(text = raw.text?.replace("\$0", hit.second))
        val id = "kw:$k"
        if (id in s.dismissed || applied(e, s)) null else Suggestion(id, k, e, hit.second, hit.first)
    }

    /** Applies an option's, chip's or accepted suggestion's effect. Scope toggles are added; an answer is set. */
    fun apply(kit: Kit, e: Effect?, s: Sketch, now: Long): Sketch {
        if (e == null) return s
        var o = s
        if (e.scope.isNotEmpty()) o = o.copy(scope = o.scope + e.scope.associateWith { maxOf(1, o.scope[it] ?: 0) })
        if (e.q != null) {
            val q = kit.question(e.q)
            val old = o.answers[e.q]
            val opts = when {
                e.opt == null -> old?.options ?: emptyList()
                q?.multi == true -> ((old?.options ?: emptyList()) + e.opt).distinct()
                else -> listOf(e.opt)
            }
            val text = e.text ?: old?.text ?: ""
            o = o.copy(answers = o.answers + (e.q to Answer(e.q, opts, text, now, AnswerState.ANSWERED)))
        }
        return o
    }

    /** A shot-list item in play and how many photos it has. */
    data class ShotState(val item: KShot, val have: Int) {
        val done get() = have >= item.need
    }

    /**
     * The shot list now. A photo taken for an item counts for it; a photo of the same purpose taken without an item
     * fills the first item of that purpose still short (list order). A room item (purpose "szoba") counts the most
     * directions a photo point has in a room of that kind.
     */
    fun shots(kit: Kit, s: Sketch, f: Facts = facts(kit, s)): List<ShotState> {
        val items = kit.shotlist.filter { f.eval(it.cond) }
        val have = items.associate { it.id to 0 }.toMutableMap()
        s.captures.filter { it.shot != null }.forEach { c -> if (c.shot in have) have[c.shot!!] = have[c.shot]!! + 1 }
        s.captures.filter { (it.shot == null || it.shot !in have) && it.kind != CaptureKind.SIGNATURE }.forEach { c ->   // a signature fills no item (M46)
            val it2 = items.firstOrNull { it.purpose == c.purpose && it.room == null && have[it.id]!! < it.need } ?: return@forEach
            have[it2.id] = have[it2.id]!! + 1
        }
        items.filter { it.room != null }.forEach { item ->
            val rooms = s.rooms.filter { r -> item.room in r.kinds || Ops.tagsOf(s, r.id).any { it.preset == "kind:${item.room}" } }.map { it.id }.toSet()
            have[item.id] = s.photos.filter { it.room in rooms }.maxOfOrNull { it.shots.size } ?: 0
        }
        return items.map { ShotState(it, have[it.id]!!) }.sortedWith(compareBy({ if (it.done) 1 else 0 }, { it.item.prio }))
    }

    // ---- loose ends -----------------------------------------------------------------------------------------------

    /** One loose end: [front] is where it is fixed, [ref] what to open there. */
    data class Open(val front: String, val kind: String, val ref: String, val label: String)

    fun open(kit: Kit, s: Sketch, norm: Norm?, f: Facts = facts(kit, s)): List<Open> {
        val out = mutableListOf<Open>()
        if (s.draft.isNotBlank()) out += Open("jegyzet", "draft", "draft", "Félbehagyott jegyzet: " + s.draft.take(40))
        s.entries.filter { it.open }.forEach { out += Open("jegyzet", "entry", it.id, "Tisztázandó: " + it.text.ifBlank { it.chips.mapNotNull { c -> kit.chip(c)?.label }.joinToString(", ") }.take(60)) }
        suggestions(kit, s).forEach { out += Open("jegyzet", "suggestion", it.id, "Javaslat a jegyzetből: „${it.match}”") }
        questions(kit, s, f).filter { !it.done && it.q.prio == 1 }.forEach { out += Open("kerdes", "question", it.q.id, it.q.q) }
        shots(kit, s, f).filter { !it.done && it.item.prio == 1 }.forEach { out += Open("kamera", "shot", it.item.id, "Fotó: " + it.item.label + if (it.item.need > 1) " (${it.have}/${it.item.need})" else "") }
        s.photos.filter { it.shots.size in 1..3 }.forEach { p -> out += Open("vazlat", "photo", p.id, "Fotópont: hiányzik " + Photos.missing(p).joinToString(", ") { Photos.label(it) }) }
        norm?.rooms?.filter { it.inferred }?.forEach { r -> out += Open("vazlat", "room", r.id, "Becsült méret: " + r.name.ifBlank { RoomKinds.autoName(r.kinds) }.ifBlank { r.id }) }
        s.points.filter { it.type == PointType.POINT }.forEach { out += Open("vazlat", "point", it.id, "Típus nélküli pont") }
        if (s.boards.isNotEmpty()) s.circuits.filter { it.board == null && it.members.isNotEmpty() }.forEach { out += Open("vazlat", "circuit", it.id, "Nincs bekötve: " + it.name) }
        s.captures.filter { it.purpose == "egyeb" && it.note.isBlank() }.forEach { out += Open("kamera", "capture", it.id, "Fotó cél nélkül") }
        if (s.site == null || (s.site.address.isBlank() && s.site.lat == null)) out += Open("helyszin", "site", "site", "Nincs cím")
        return out
    }

    // ---- the scope card -------------------------------------------------------------------------------------------

    data class Summary(
        val groups: List<Pair<String, List<Pair<KScope, Int>>>>,
        val rooms: Int, val areaM2: Double, val guessedRooms: Int,
        val planned: Map<PointType, Int>, val existing: Int, val circuits: Int, val boards: Int,
        val photos: Int, val notes: Int, val answered: Int, val openQuestions: Int,
    )

    val SCOPE_GROUPS = listOf("jelleg" to "A munka jellege", "terulet" to "Terület", "rendszer" to "Rendszerek", "igeny" to "Igények")

    fun summary(kit: Kit, s: Sketch, norm: Norm?, f: Facts = facts(kit, s)): Summary {
        val qs = questions(kit, s, f)
        return Summary(
            groups = SCOPE_GROUPS.map { (g, label) -> label to kit.scope.filter { it.group == g && (s.scope[it.id] ?: 0) > 0 }.map { it to s.scope[it.id]!! } }
                .filter { it.second.isNotEmpty() },
            rooms = s.rooms.size,
            areaM2 = (norm?.rooms?.sumOf { it.area } ?: 0.0) / 1e6,
            guessedRooms = norm?.rooms?.count { it.inferred } ?: 0,
            planned = s.points.filter { it.state == PointState.PLANNED && it.type != PointType.BOARD }.groupingBy { it.type }.eachCount(),
            existing = s.points.count { it.state == PointState.EXISTING },
            circuits = s.circuits.size, boards = s.boards.size,
            photos = s.captures.size + s.photos.sumOf { it.shots.size },
            notes = s.entries.size + s.memos.size,
            answered = qs.count { it.done }, openQuestions = qs.count { !it.done },
        )
    }
}

/** Choosing a variant (WP M31): it becomes the sketch's, switched on, with its tags, preset scope and plugins added. */
object VariantOps {
    fun activate(s: Sketch, v: Variant): Sketch {
        val tags = s.tags + v.tags.filter { t -> s.tags.none { it.id == t.id } }
        val scope = s.scope + v.scopePreset.filterKeys { (s.scope[it] ?: 0) <= 0 }
        val plugins = (s.plugins + v.pluginsOn).distinct()
        return s.copy(variant = v.id, variantOn = true, tags = tags, scope = scope, plugins = plugins)
    }

    /** The plugins in force: the sketch's, with the variant's off-list taken away while it is on. */
    fun plugins(s: Sketch, v: Variant?) = if (v != null && s.variantOn) s.plugins - v.pluginsOff.toSet() else s.plugins
}

/**
 * A request for a new variant (WP M31, Sketcher/variants/PROTOCOL.md §1). It carries the job's SHAPE, never the client:
 * no survey name, no address, no notes text: the premise the user writes, the toggles, and counts of what is drawn.
 */
object VariantRequests {
    const val KIND = "vrg-sketcher-variant-request"

    fun build(s: Sketch, kit: Kit, premise: String, topics: List<String>, photos: List<String>, now: Long): JSONObject {
        val from = JSONObject()
            .put("rooms", s.rooms.size)
            .put("kinds", JSONArray(s.rooms.flatMap { it.kinds }.distinct().sorted()))
            .put("points", JSONObject().also { o -> s.points.groupingBy { it.type.id }.eachCount().toSortedMap().forEach { (k, v) -> o.put(k, v) } })
            .put("routes", s.routes.size).put("entries", s.entries.size).put("captures", s.captures.size)
            .put("purposes", JSONArray(s.captures.map { it.purpose }.distinct().sorted()))
        s.variant?.let { from.put("variant", it) }
        return JSONObject().put("kind", KIND).put("v", 1).put("created", now)
            .put("premise", premise.trim())
            .put("topics", JSONArray(topics.distinct()))
            .put("topicLabels", JSONArray(topics.distinct().map { kit.scopeItem(it)?.label ?: it }))
            .put("scope", JSONObject().also { o -> s.scope.toSortedMap().forEach { (k, v) -> o.put(k, v) } })
            .put("from", from)
            .put("photos", JSONArray(photos))
            .put("protocol", "Sketcher/variants/PROTOCOL.md")
    }

    /** What the user pastes into the agent session. */
    fun prompt(premise: String, file: String) = "GO VARIANT — $file\n${premise.trim()}"
}

/** The intake edits (WP M27-M30); the sketch's own edits are in Ops and PhotoOps. */
object Intake {
    fun addEntry(s: Sketch, text: String, chips: List<String>, room: String?, target: String?, open: Boolean, voice: Boolean, now: Long): Pair<Sketch, String>? {
        if (text.isBlank() && chips.isEmpty()) return null
        val (id, s1) = s.nextId("E")
        return s1.copy(entries = s1.entries + Entry(id, now, text.trim(), chips.distinct(), room, target, open, voice)) to id
    }

    fun editEntry(s: Sketch, id: String, text: String, chips: List<String>) = s.copy(entries = s.entries.map {
        if (it.id == id) it.copy(text = text.trim(), chips = chips.distinct()) else it
    })

    fun setOpen(s: Sketch, id: String, open: Boolean) = s.copy(entries = s.entries.map { if (it.id == id) it.copy(open = open) else it })
    fun linkEntry(s: Sketch, id: String, room: String?, target: String?) = s.copy(entries = s.entries.map { if (it.id == id) it.copy(room = room, target = target) else it })
    fun deleteEntry(s: Sketch, id: String) = s.copy(entries = s.entries.filter { it.id != id })

    /** A munkakör toggle: qty 0 removes it. A total below what the rooms hold takes it back from them (Wants.trim, F4). */
    fun setScope(s: Sketch, id: String, qty: Int) = Wants.trim(s.copy(scope = if (qty <= 0) s.scope - id else s.scope + (id to qty)), id, qty)

    /** An answer to [q]: options (one, or several for a multi question), free text, and its state. */
    fun answer(kit: Kit, s: Sketch, q: String, options: List<String>, text: String, state: AnswerState, now: Long): Sketch {
        var o = s.copy(answers = s.answers + (q to Answer(q, options.distinct(), text.trim(), now, state)))
        if (state == AnswerState.ANSWERED) kit.question(q)?.options?.filter { it.id in options }?.forEach { o = FieldKit.apply(kit, it.sets, o, now) }
        return o
    }

    fun clearAnswer(s: Sketch, q: String) = s.copy(answers = s.answers - q)

    fun dismiss(s: Sketch, id: String) = s.copy(dismissed = s.dismissed + id)

    /** Records when shadow items first appeared (no undo step: this is bookkeeping, not an edit). */
    fun markSeen(s: Sketch, ids: List<String>, now: Long) = if (ids.isEmpty()) s else s.copy(seen = s.seen + ids.filter { it !in s.seen }.associateWith { now })

    fun addCapture(s: Sketch, file: String, purpose: String, room: String?, target: String?, shot: String?, now: Long, lat: Double? = null, lon: Double? = null): Pair<Sketch, String> {
        val (id, s1) = s.nextId("C")
        return s1.copy(captures = s1.captures + Capture(id, file, purpose, now, room, target, shot, "", lat, lon)) to id
    }

    fun editCapture(s: Sketch, id: String, f: (Capture) -> Capture) = s.copy(captures = s.captures.map { if (it.id == id) f(it) else it })

    /** Removes a capture; its file is returned to delete. */
    fun deleteCapture(s: Sketch, id: String): Pair<Sketch, String?> {
        val c = s.capture(id) ?: return s to null
        return s.copy(captures = s.captures - c) to c.file
    }

    fun setSite(s: Sketch, f: (Site) -> Site) = s.copy(site = f(s.site ?: Site()))

    /** The capture's board file name: `<sketch>_<capture id>_<purpose>.jpg` (WP M29, as M25's photos). */
    fun exportName(s: Sketch, c: Capture) = "${SketchJson.fileStem(s)}_${c.id}_${if (c.kind == CaptureKind.SIGNATURE) "alairas" else c.purpose}.${CaptureKind.ext(c.kind)}"   // M46: .mp4 / .png

    /** Every photo file the survey keeps (captures + photo points), for clean-up. */
    fun files(s: Sketch) = Photos.files(s) + s.captures.map { it.file }
}
