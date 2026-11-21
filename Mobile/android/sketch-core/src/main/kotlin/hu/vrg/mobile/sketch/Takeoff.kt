package hu.vrg.mobile.sketch

import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.sqrt

// The VRG Sketcher takeoff (Munkakör lap, docs/sketcher/TAKEOFF.md): a survey → its work items and quantities, as ONE
// document of kind "vrg-sketch-takeoff" v1, plus a Hungarian summary. The rules are data (Sketcher/catalog/takeoff.json).
// No prices: pricing belongs to the Varler Workflow Kit.
//
// This is the Kotlin twin of Sketcher/lib/takeoff.js. Sketcher/test/fixtures/takeoff.json is written by the JS engine and
// replayed by TakeoffTest (document and summary), so the phone and the Desktop always give the same takeoff. The
// arithmetic is kept identical: integer-mm plan coordinates, sqrt(dx²+dy²) per segment, a route rounded to the mm,
// metres to 0.1 with Math.round. Change the rules here and there together.

/** The rules file (Sketcher/catalog/takeoff.json). Every list keeps the file's order. */
data class TakeoffRules(
    val endReserveMm: Int = 300, val looseEndMm: Int = 0, val rawScaleMm: Double = 25.0,
    val evCableQ: String = "tavolsag", val evCableM: List<Pair<String, Double>> = emptyList(),
    val levels: List<Pair<String, Int>> = emptyList(),
    val points: List<PointRule> = emptyList(),
    val actions: List<Triple<String, String, String>> = emptyList(),
    val replaceTags: TagSpec = TagSpec(), val removeTags: TagSpec = TagSpec(), val dedicatedTags: TagSpec = TagSpec(),
    val scopePoints: List<Pair<String, String>> = emptyList(),
    val machines: List<Pair<String, Int>> = emptyList(),
    val systems: List<SystemRule> = emptyList(),
    val impliedDedicated: Boolean = false,
    val boardScope: String = "eloszto", val newBoardQ: String = "uj_eloszto", val newBoardOpt: String = "igen",
    val decisions: List<Pair<String, List<String>>> = emptyList(),
) {
    data class PointRule(val id: String, val label: String, val sym: String, val h: Int, val ceiling: Boolean)
    data class TagSpec(val presets: List<String> = emptyList(), val names: List<String> = emptyList())
    data class SystemRule(val id: String, val dedicated: Int, val qtyQ: String?, val qtyMap: List<Pair<String, Double>>, val qtyEst: List<String>)

    fun action(id: String) = actions.first { it.first == id }
    fun point(type: String) = points.firstOrNull { it.id == type } ?: points.first { it.id == "pont" }
    fun levelH(level: String) = (levels.firstOrNull { it.first == level } ?: levels.firstOrNull { it.first == "ground" })?.second ?: 2700

    companion object {
        const val KIND = "vrg-takeoff-rules"
        private fun strs(a: JSONArray?) = if (a == null) emptyList() else (0 until a.length()).map { a.optString(it) }
        private fun objs(a: JSONArray?) = if (a == null) emptyList() else (0 until a.length()).mapNotNull { a.optJSONObject(it) }
        private fun pairsD(a: JSONArray?) = if (a == null) emptyList() else (0 until a.length()).map { a.getJSONArray(it).let { p -> p.getString(0) to p.getDouble(1) } }
        private fun tagSpec(o: JSONObject?) = if (o == null) TagSpec() else TagSpec(strs(o.optJSONArray("presets")), strs(o.optJSONArray("names")))

        fun parse(json: String): TakeoffRules {
            val o = JSONObject(json)
            require(o.optString("kind") == KIND) { "not takeoff rules" }
            val c = o.getJSONObject("cable")
            return TakeoffRules(
                endReserveMm = c.optInt("endReserveMm", 300), looseEndMm = c.optInt("looseEndMm", 0), rawScaleMm = c.optDouble("rawScaleMm", 25.0),
                evCableQ = c.optString("evCableQ", "tavolsag"), evCableM = pairsD(c.optJSONArray("evCableM")),
                levels = pairsD(o.optJSONArray("levels")).map { it.first to it.second.toInt() },
                points = objs(o.optJSONArray("points")).map { PointRule(it.getString("id"), it.getString("label"), it.getString("sym"), it.getInt("h"), it.optBoolean("ceiling")) },
                actions = objs(o.optJSONArray("actions")).map { Triple(it.getString("id"), it.getString("label"), it.getString("sym")) },
                replaceTags = tagSpec(o.optJSONObject("replaceTags")), removeTags = tagSpec(o.optJSONObject("removeTags")),
                dedicatedTags = tagSpec(o.optJSONObject("dedicatedTags")),
                scopePoints = o.optJSONArray("scopePoints")?.let { a -> (0 until a.length()).map { a.getJSONArray(it).let { p -> p.getString(0) to p.getString(1) } } } ?: emptyList(),
                machines = objs(o.optJSONArray("machines")).map { it.getString("id") to it.optInt("dedicated") },
                systems = objs(o.optJSONArray("systems")).map {
                    SystemRule(it.getString("id"), it.optInt("dedicated"), if (it.has("qtyQ")) it.getString("qtyQ") else null,
                        pairsD(it.optJSONArray("qtyMap")), strs(it.optJSONArray("qtyEst")))
                },
                impliedDedicated = o.optBoolean("impliedDedicated", false),
                boardScope = o.optString("boardScope", "eloszto"), newBoardQ = o.optString("newBoardQ", "uj_eloszto"), newBoardOpt = o.optString("newBoardOpt", "igen"),
                decisions = objs(o.optJSONArray("decisions")).map { it.getString("q") to strs(it.optJSONArray("affects")) },
            )
        }
    }
}

/** The geometry the takeoff reads, in integer mm: from the solver on the phone, from a package's plan, or raw. */
data class PlanView(
    val solved: Boolean,
    val rooms: List<PRoom>,
    val pts: Map<String, PPt>,
    val routes: Map<String, List<Pair<Long, Long>>>,
) {
    data class PRoom(val id: String, val name: String, val kinds: List<String>, val poly: List<Pair<Long, Long>>, val est: Boolean)
    data class PPt(val x: Long, val y: Long, val h: Long)

    companion object {
        private fun r(v: Double) = Math.round(v)

        /** What PlannerExport writes for this solve, read back as the takeoff sees a package (TakeoffTest checks it). */
        fun of(s: Sketch, n: Norm): PlanView {
            val rooms = n.rooms.filter { it.poly.size >= 3 }.map { nr ->
                val kinds = (nr.kinds + Ops.tagsOf(s, nr.id).mapNotNull { t -> t.preset?.takeIf { it.startsWith("kind:") }?.removePrefix("kind:") }).distinct()
                PRoom(nr.id, nr.name.ifBlank { RoomKinds.autoName(kinds) }, kinds, nr.poly.map { r(it.x) to r(it.y) }, nr.inferred)
            }
            val pts = LinkedHashMap<String, PPt>()
            n.points.forEach { p ->
                val at = if (p.inward != null) p.at + p.inward * PlannerExport.WALL_OFFSET else p.at
                pts[p.id] = PPt(r(at.x), r(at.y), PlannerExport.height(p.type, p.inward != null, s.level).toLong())
            }
            val routes = LinkedHashMap<String, List<Pair<Long, Long>>>()
            n.routes.filter { it.pts.size >= 2 }.forEach { rt -> routes[rt.id] = rt.pts.map { r(it.x) to r(it.y) } }
            return PlanView(true, rooms, pts, routes)
        }

        /** The plan inside a vrg-sketch package (plan.data), or null. */
        fun fromPackage(pkg: JSONObject): PlanView? {
            val d = pkg.optJSONObject("plan")?.optJSONObject("data") ?: return null
            fun arr(k: String) = d.optJSONArray(k)?.let { a -> (0 until a.length()).mapNotNull { a.optJSONObject(it) } } ?: emptyList()
            fun skId(o: JSONObject) = o.optJSONObject("sk")?.let { if (it.has("id") && !it.isNull("id")) it.optString("id").takeIf { s -> s.isNotEmpty() } else null }
            val rooms = arr("floors").mapNotNull { f ->
                val poly = f.optJSONArray("poly") ?: return@mapNotNull null
                if (poly.length() < 3) return@mapNotNull null
                val id = skId(f) ?: return@mapNotNull null
                val kinds = f.optJSONArray("kinds")?.let { a -> (0 until a.length()).map { a.optString(it) } } ?: emptyList()
                PRoom(id, f.optString("name", ""), kinds, (0 until poly.length()).map { poly.getJSONArray(it).let { p -> r(p.getDouble(0)) to r(p.getDouble(1)) } },
                    (f.optJSONObject("sk")?.optJSONArray("est")?.length() ?: 0) > 0)
            }
            val pts = LinkedHashMap<String, PPt>()
            arr("devices").forEach { v -> skId(v)?.let { pts[it] = PPt(r(v.optDouble("x")), r(v.optDouble("y")), r(v.optDouble("h"))) } }
            val routes = LinkedHashMap<String, List<Pair<Long, Long>>>()
            arr("paths").forEach { p ->
                val id = skId(p) ?: return@forEach
                val nodes = p.optJSONArray("nodes") ?: return@forEach
                if (nodes.length() < 2) return@forEach
                routes[id] = (0 until nodes.length()).map { nodes.getJSONObject(it).let { nd -> r(nd.optDouble("x")) to r(nd.optDouble("y")) } }
            }
            return PlanView(true, rooms, pts, routes)
        }

        /** No solve: the sketch at the default scale, everything a guess. */
        fun raw(s: Sketch, rules: TakeoffRules): PlanView {
            val k = rules.rawScaleMm
            fun R(v: Double) = Math.round(v * k)
            val ceil = rules.levelH(s.level.id)
            val rooms = s.rooms.filter { it.poly.size >= 3 }.map { rm ->
                val kinds = (rm.kinds + Ops.tagsOf(s, rm.id).mapNotNull { t -> t.preset?.takeIf { it.startsWith("kind:") }?.removePrefix("kind:") }).distinct()
                PRoom(rm.id, rm.name, kinds, rm.poly.map { R(it.x) to R(it.y) }, true)
            }
            val pts = LinkedHashMap<String, PPt>()
            s.points.forEach { p ->
                val pr = rules.point(p.type.id)
                val onWall = p.room != null && p.edge != null && p.t != null
                pts[p.id] = PPt(R(p.at.x), R(p.at.y), (if (pr.ceiling && !onWall) ceil else pr.h).toLong())
            }
            val routes = LinkedHashMap<String, List<Pair<Long, Long>>>()
            s.routes.filter { it.pts.size >= 2 }.forEach { rt -> routes[rt.id] = rt.pts.map { R(it.x) to R(it.y) } }
            return PlanView(false, rooms, pts, routes)
        }
    }
}

object Takeoff {
    const val KIND = "vrg-sketch-takeoff"
    const val V = 1

    // ---- numbers, the same as the JS engine ------------------------------------------------------------------------
    fun m1(mm: Double): Double = Math.round(mm / 100) / 10.0
    fun a1(mm2: Double): Double = Math.round(mm2 / 1e5) / 10.0
    fun fmt(x: Double): String {
        val r = Math.round(x * 10)
        if (r % 10 == 0L) return (r / 10).toString()
        val a = abs(r)
        return (if (r < 0) "-" else "") + (a / 10) + "," + (a % 10)
    }
    private fun area(p: List<Pair<Long, Long>>): Double {
        var s = 0.0
        for (i in p.indices) { val q = p[(i + 1) % p.size]; s += p[i].first.toDouble() * q.second - q.first.toDouble() * p[i].second }
        return abs(s) / 2
    }
    private fun seg(a: Pair<Long, Long>, b: Pair<Long, Long>): Double {
        val dx = (b.first - a.first).toDouble(); val dy = (b.second - a.second).toDouble(); return sqrt(dx * dx + dy * dy)
    }

    class Item(val id: String, val cat: String, val label: String, val sym: String, val unit: String, val qty: Double,
               val est: Boolean = false, val work: Boolean = true, val note: String = "", val refs: List<String> = emptyList()) {
        val open = mutableListOf<String>()
        var parts: List<Part>? = null
    }
    data class Part(val ref: String, val label: String, val m: Double)
    data class Decision(val q: String, val label: String, val who: String, val state: String, val affects: List<String>)
    data class Question(val q: String, val label: String, val who: String, val state: String, val options: List<String>, val text: String)
    data class Note(val id: String, val text: String, val chips: List<String>, val room: String, val open: Boolean)
    data class PhotoGroup(val purpose: String, val label: String, val sym: String, val n: Int, val files: List<String>)
    data class RoomRow(val id: String, val name: String, val kinds: List<String>, val areaM2: Double, val est: Boolean,
                       /** F4 (WP M49): the client's wants this room holds (roomScope), kit order. */
                       val wants: List<Pair<KScope, Int>> = emptyList())

    /** The whole takeoff. Kept as JSON (the export contract) and as the rows the phone's Munkakör lap draws. */
    class Result(
        val json: JSONObject, val items: List<Item>, val decisions: List<Decision>, val checks: List<String>,
        val questions: List<Question>, val notes: List<Note>, val photos: List<PhotoGroup>, val rooms: List<RoomRow>,
    ) {
        val est get() = items.count { it.est }
        val openItems get() = items.count { it.open.isNotEmpty() }
    }

    private fun tagHit(tags: List<Tag>, spec: TakeoffRules.TagSpec) = tags.any { (it.preset != null && it.preset in spec.presets) || FieldKit.fold(it.name) in spec.names }
    private fun actionOf(s: Sketch, rules: TakeoffRules, p: SketchPoint): String {
        val tags = Ops.tagsOf(s, p.id)
        if (tagHit(tags, rules.removeTags)) return "bontas"
        if (tagHit(tags, rules.replaceTags)) return "csere"
        return if (p.state == PointState.EXISTING) "marad" else "uj"
    }
    private fun scopeQ(s: Sketch, id: String) = (s.scope[id] ?: 0).let { if (it > 0) it else 0 }
    private fun answered(s: Sketch, q: String) = s.answers[q]?.takeIf { it.state == AnswerState.ANSWERED }
    private fun roomTitle(r: PlanView.PRoom) = r.name.ifEmpty { r.kinds.joinToString(" + ").ifEmpty { r.id } }
    private fun jstrs(l: List<String>) = JSONArray().also { a -> l.forEach { a.put(it) } }

    fun build(kit: Kit, rules: TakeoffRules, s: Sketch, plan0: PlanView?, now: Long = System.currentTimeMillis(),
              endReserveMm: Int? = null, looseEndMm: Int? = null, impliedDedicated: Boolean? = null): Result {
        val plan = plan0 ?: PlanView.raw(s, rules)
        val reserve = endReserveMm ?: rules.endReserveMm
        // D-79: the dedicated circuits the machines and systems imply are counted only when asked (a general toggle)
        val impliedOn = impliedDedicated ?: rules.impliedDedicated
        val loose = looseEndMm ?: rules.looseEndMm
        val ceil = rules.levelH(s.level.id)
        val items = mutableListOf<Item>(); val checks = mutableListOf<String>()
        val points = s.points
        val circuits = s.circuits.filter { it.members.isNotEmpty() }

        // points by type and action; the Igények counts reconcile with what is drawn
        var fixedDrawn = 0
        rules.points.filter { it.id != "board" }.forEach { t ->
            val of = points.filter { it.type.id == t.id }
            val want = rules.scopePoints.filter { it.second == t.id }.sumOf { scopeQ(s, it.first) }
            rules.actions.forEach { (aid, alabel, _) ->
                val list = of.filter { actionOf(s, rules, it) == aid }; val drawn = list.size
                if (t.id == "fixed" && (aid == "uj" || aid == "csere")) fixedDrawn += drawn
                val isNew = aid == "uj"
                val qty = if (isNew) max(drawn, want) else drawn
                if (qty <= 0) return@forEach
                val note = if (isNew && want > 0 && want != drawn) "Munkakör: $want, vázlat: $drawn" else ""
                items += Item("pont.${t.id}.$aid", "pont", t.label + " — " + alabel, t.sym, "db", qty.toDouble(),
                    est = (isNew && want > drawn) || t.id == "pont", work = aid != "marad", note = note, refs = list.map { it.id })
            }
        }

        // machines (gépbekötés) from the scope
        var machines = 0; var implied = 0.0
        rules.machines.forEach { (id, ded) ->
            val q = scopeQ(s, id); if (q == 0) return@forEach
            val k = kit.scopeItem(id)
            machines += q; implied += (q * ded).toDouble()
            items += Item("gep.$id", "gep", k?.label ?: id, k?.sym ?: "⊗", "db", q.toDouble())
        }
        if (machines > 0 && fixedDrawn > 0 && machines != fixedDrawn) checks += "Gépbekötés a Munkakörben: $machines, fix bekötés a vázlaton: $fixedDrawn"

        // systems from the scope; a count from its answer where the rules name one
        val sysItems = mutableListOf<Item>()
        rules.systems.forEach { y ->
            if (scopeQ(s, y.id) == 0) return@forEach
            val k = kit.scopeItem(y.id)
            var qty = 1.0; var est = false; var note = ""
            if (y.qtyQ != null) {
                val a = answered(s, y.qtyQ)
                val hit = a?.let { ans -> y.qtyMap.firstOrNull { it.first in ans.options } }
                if (hit != null) { qty = hit.second; est = hit.first in y.qtyEst } else { est = true; note = "a darabszám még nincs meg" }
            }
            implied += qty * y.dedicated
            sysItems += Item("rendszer.${y.id}", "rendszer", k?.label ?: y.id, k?.sym ?: "◈", "db", qty, est = est, note = note)
        }

        // circuits: drawn ones, and the dedicated circuits the machines and systems imply
        fun dedOf(c: Circuit) = c.dedicated || tagHit(Ops.tagsOf(s, c.id), rules.dedicatedTags) || c.members.any { m -> tagHit(Ops.tagsOf(s, m), rules.dedicatedTags) }
        val ded = circuits.filter { dedOf(it) }; val gen = circuits.filter { !dedOf(it) }
        if (gen.isNotEmpty()) items += Item("aramkor.altalanos", "aramkor", "Áramkör — általános", "◌", "db", gen.size.toDouble(), refs = gen.map { it.id })
        val dq = if (impliedOn) max(ded.size.toDouble(), implied) else ded.size.toDouble()
        if (dq > 0) items += Item("aramkor.dedikalt", "aramkor", "Áramkör — dedikált", "◉", "db", dq, est = impliedOn && implied > ded.size,
            note = if (impliedOn && implied > 0 && implied != ded.size.toDouble()) "gépek, rendszerek szerint: ${fmt(implied)}, vázlat: ${ded.size}" else "", refs = ded.map { it.id })
        if (!impliedOn && implied > ded.size) checks += "A gépek, rendszerek szerint ${fmt(implied)} dedikált kör kellhet, a vázlaton ${ded.size} van"

        // boards: the one feeding most circuits is the main one, the others are taken for sub-boards (≈)
        val boards = points.filter { it.type == PointType.BOARD }
        fun fed(b: SketchPoint) = s.circuits.count { it.board == b.id }
        var main: SketchPoint? = null
        boards.forEach { b -> if (main == null || fed(b) > fed(main!!)) main = b }
        fun bAct(b: SketchPoint): String { val a = actionOf(s, rules, b); return if (b === main && a == "marad" && scopeQ(s, rules.boardScope) > 0) "csere" else a }
        listOf("eloszto", "aleloszto").forEach { role -> rules.actions.forEach { (aid, alabel, _) ->
            val list = boards.filter { b -> (if (b === main) "eloszto" else "aleloszto") == role && bAct(b) == aid }
            if (list.isEmpty()) return@forEach
            items += Item("$role.$aid", role, (if (role == "eloszto") "Elosztó" else "Alelosztó") + " — " + alabel, "▣", "db", list.size.toDouble(),
                est = role == "aleloszto", work = aid != "marad", note = if (role == "aleloszto") "alelosztónak vettük" else "", refs = list.map { it.id })
        } }
        if (boards.isEmpty() && scopeQ(s, rules.boardScope) > 0)
            items += Item("eloszto.csere", "eloszto", "Elosztó — " + rules.action("csere").second, "▣", "db", 1.0, est = true, note = "a vázlaton nincs elosztó")
        val nb = answered(s, rules.newBoardQ)
        if (nb != null && rules.newBoardOpt in nb.options && items.none { it.id == "eloszto.uj" }) {
            val q = kit.question(rules.newBoardQ)
            items += Item("eloszto.uj", "eloszto", "Elosztó — " + rules.action("uj").second, "▣", "db", 1.0, est = true,
                note = "a válasz szerint: " + (q?.q ?: rules.newBoardQ))
        }

        // cable: every route (its solved length + a drop at each end), then the home runs nobody drew (≈)
        fun drop(id: String?): Long { val p = id?.let { plan.pts[it] } ?: return loose.toLong(); return max(0L, ceil - p.h) + reserve }
        fun inEst(pt: Pair<Long, Long>) = plan.rooms.any { r ->
            r.est && pt.first >= r.poly.minOf { it.first } - 1 && pt.first <= r.poly.maxOf { it.first } + 1 &&
                pt.second >= r.poly.minOf { it.second } - 1 && pt.second <= r.poly.maxOf { it.second } + 1
        }
        fun cname(id: String?) = s.circuit(id)?.let { it.name.ifEmpty { it.id } } ?: ""
        var rtot = 0L; var rest = false; val rparts = mutableListOf<Part>(); val rrefs = mutableListOf<String>()
        s.routes.forEach { rt ->
            val P = plan.routes[rt.id] ?: return@forEach
            var len = 0.0; for (i in 1 until P.size) len += seg(P[i - 1], P[i])
            val mm = Math.round(len) + drop(rt.a) + drop(rt.b)
            rtot += mm; rrefs += rt.id
            if (!plan.solved || P.any { inEst(it) }) rest = true
            rparts += Part(rt.id, cname(rt.circuit), m1(mm.toDouble()))
        }
        if (rrefs.isNotEmpty()) items += Item("kabel.nyomvonal", "kabel", "Kábel a nyomvonalon", "〰", "m", m1(rtot.toDouble()), est = rest, refs = rrefs.toList(),
            note = "nyomvonal + végenként ${fmt(reserve / 1000.0)} m tartalék és a függőleges szakasz").also { it.parts = rparts }
        var htot = 0L; val hparts = mutableListOf<Part>(); val hrefs = mutableListOf<String>()
        circuits.forEach { c ->
            val b = c.board?.let { plan.pts[it] } ?: return@forEach
            val mem = c.members
            if (s.routes.any { rt -> plan.routes[rt.id] != null && (rt.circuit == c.id || rt.a in mem || rt.b in mem) }) return@forEach
            var best: String? = null; var bd = Long.MAX_VALUE
            mem.forEach { id -> val p = plan.pts[id] ?: return@forEach; val d = abs(p.x - b.x) + abs(p.y - b.y); if (d < bd) { bd = d; best = id } }
            if (best == null) return@forEach
            val mm = bd + drop(c.board) + drop(best)
            htot += mm; hrefs += c.id; hparts += Part(c.id, c.name.ifEmpty { c.id }, m1(mm.toDouble()))
        }
        if (hrefs.isNotEmpty()) items += Item("kabel.bekotes", "kabel", "Kábel az elosztótól (rajzolatlan)", "⚡", "m", m1(htot.toDouble()), est = true, refs = hrefs.toList(),
            note = "az elosztótól a legközelebbi pontig, derékszögben").also { it.parts = hparts }
        if (scopeQ(s, "ev") > 0) {
            val a = answered(s, rules.evCableQ)
            val hit = a?.let { ans -> rules.evCableM.firstOrNull { it.first in ans.options } }
            items += Item("kabel.ev", "kabel", "Kábel az e-autó töltőhöz", "⚡", "m", hit?.second ?: 0.0, est = true,
                note = if (hit != null) "a válasz szerint" else "a távolság még nincs meg")
        }

        items += sysItems

        // the other countable wants
        val covered = (rules.scopePoints.map { it.first } + rules.machines.map { it.first }).toSet()
        kit.scope.filter { it.group == "igeny" && it.qty && it.id !in covered && scopeQ(s, it.id) > 0 }.forEach { k ->
            items += Item("igeny.${k.id}", "igeny", k.label, k.sym, "db", scopeQ(s, k.id).toDouble())
        }

        // the open decisions that change a quantity (⚑)
        val f = FieldKit.facts(kit, s)
        val shadow = FieldKit.questions(kit, s, f, now)
        fun hits(id: String, p: String) = id == p || id.startsWith("$p.")
        val decisions = mutableListOf<Decision>()
        rules.decisions.forEach { (q, affects) ->
            val x = shadow.firstOrNull { it.q.id == q } ?: return@forEach
            if (x.done) return@forEach
            val aff = items.filter { it2 -> affects.any { hits(it2.id, it) } }.map { it.id }
            aff.forEach { id -> items.first { it.id == id }.open += q }
            decisions += Decision(q, x.q.q, x.q.who, if (x.later) "later" else "open", aff)
        }

        // the intake as it is
        val order = kit.questions.withIndex().associate { it.value.id to it.index }
        val questions = shadow.sortedBy { order[it.q.id] ?: 0 }.map { x ->
            Question(x.q.id, x.q.q, x.q.who, if (x.done) "answered" else if (x.later) "later" else "open",
                (x.answer?.options ?: emptyList()).map { o -> x.q.options.firstOrNull { it.id == o }?.label ?: o }, x.answer?.text ?: "")
        }
        fun roomName(id: String?): String {
            if (id == null) return ""
            plan.rooms.firstOrNull { it.id == id }?.let { return roomTitle(it) }
            return s.room(id)?.let { it.name.ifEmpty { id } } ?: id
        }
        val notes = s.entries.map { e -> Note(e.id, e.text, e.chips.map { c -> kit.chip(c)?.label ?: c }, roomName(e.room), e.open) }
        val purposeIds = kit.purposes.map { it.id }.toMutableList()
        val caps = s.captures.filter { it.kind != CaptureKind.AUDIO }   // F5: a sound note is not a photo
        caps.forEach { if (it.purpose !in purposeIds) purposeIds += it.purpose }
        val roomShots = s.photos.sumOf { it.shots.size }
        val photos = purposeIds.mapNotNull { id ->
            val list = caps.filter { it.purpose == id }
            val n = list.size + if (id == "szoba") roomShots else 0
            if (n == 0) return@mapNotNull null
            val k = kit.purpose(id)
            PhotoGroup(id, k?.label ?: id, k?.sym ?: "◉", n, list.map { Intake.exportName(s, it) })   // F8: the board name (.mp4, _alairas.png)
        }
        val rooms = plan.rooms.map { RoomRow(it.id, roomTitle(it), it.kinds, a1(area(it.poly)), it.est,
            kit.scope.filter { k -> k.qty && (s.roomScope[it.id]?.get(k.id) ?: 0) > 0 }.map { k -> k to s.roomScope[it.id]!![k.id]!! }) }
        val scopeGroups = FieldKit.SCOPE_GROUPS.map { (g, label) -> g to label }.mapNotNull { (g, label) ->
            val its = kit.scope.filter { it.group == g && scopeQ(s, it.id) > 0 }
            if (its.isEmpty()) null else Triple(g, label, its)
        }
        val totalArea = a1(plan.rooms.sumOf { area(it.poly) })

        // ---- the document ----
        val j = JSONObject().put("kind", KIND).put("v", V).put("made", now)
        j.put("source", JSONObject().put("name", s.name).put("id", s.id).put("level", s.level.id).put("plan", if (plan.solved) "megoldott" else "nyers")
            .put("variant", if (s.variantOn && s.variant != null) s.variant else ""))
        j.put("config", JSONObject().put("endReserveMm", reserve).put("looseEndMm", loose).put("ceilingMm", ceil).put("impliedDedicated", impliedOn))
        j.put("counts", JSONObject().put("items", items.size).put("work", items.count { it.work }).put("est", items.count { it.est })
            .put("open", items.count { it.open.isNotEmpty() }).put("decisions", decisions.size).put("tisztazando", notes.count { it.open })
            .put("answered", questions.count { it.state == "answered" }).put("questionsOpen", questions.count { it.state != "answered" })
            .put("rooms", rooms.size).put("areaM2", totalArea).put("photos", photos.sumOf { it.n }))
        j.put("scope", JSONArray(scopeGroups.map { (g, label, its) ->
            JSONObject().put("group", g).put("label", label).put("items", JSONArray(its.map { k ->
                JSONObject().put("id", k.id).put("label", k.label).put("sym", k.sym).put("qty", scopeQ(s, k.id)) }))
        }))
        j.put("items", JSONArray(items.map { it2 ->
            val o = JSONObject().put("id", it2.id).put("cat", it2.cat).put("label", it2.label).put("sym", it2.sym).put("unit", it2.unit).put("qty", it2.qty)
                .put("est", it2.est).put("work", it2.work).put("open", jstrs(it2.open)).put("note", it2.note).put("refs", jstrs(it2.refs))
            it2.parts?.let { ps -> o.put("parts", JSONArray(ps.map { JSONObject().put("ref", it.ref).put("label", it.label).put("m", it.m) })) }
            o
        }))
        j.put("decisions", JSONArray(decisions.map { JSONObject().put("q", it.q).put("label", it.label).put("who", it.who).put("state", it.state).put("affects", jstrs(it.affects)) }))
        j.put("checks", jstrs(checks))
        j.put("questions", JSONArray(questions.map { JSONObject().put("q", it.q).put("label", it.label).put("who", it.who).put("state", it.state)
            .put("options", jstrs(it.options)).put("text", it.text) }))
        j.put("notes", JSONArray(notes.map { JSONObject().put("id", it.id).put("text", it.text).put("chips", jstrs(it.chips)).put("room", it.room).put("open", it.open) }))
        j.put("memos", JSONArray(s.memos.map { JSONObject().put("id", it.id).put("text", it.text) }))
        j.put("photos", JSONArray(photos.map { JSONObject().put("purpose", it.purpose).put("label", it.label).put("sym", it.sym).put("n", it.n).put("files", jstrs(it.files)) }))
        j.put("rooms", JSONArray(rooms.map { r -> JSONObject().put("id", r.id).put("name", r.name).put("kinds", jstrs(r.kinds)).put("areaM2", r.areaM2).put("est", r.est)
            .also { o -> if (r.wants.isNotEmpty()) o.put("wants", JSONArray(r.wants.map { (k, n) -> JSONObject().put("id", k.id).put("label", k.label).put("sym", k.sym).put("qty", n) })) } }))
        return Result(j, items, decisions, checks, questions, notes, photos, rooms)
    }

    // ---- the readable summary (Hungarian), the same text as the JS engine's -----------------------------------------
    fun markdown(t: JSONObject): String {
        val L = mutableListOf<String>()
        fun cell(x: String) = x.replace("|", "/").replace("\n", " ")
        fun objs(a: JSONArray?) = if (a == null) emptyList() else (0 until a.length()).map { a.getJSONObject(it) }
        fun strs(a: JSONArray?) = if (a == null) emptyList() else (0 until a.length()).map { a.getString(it) }
        val src = t.getJSONObject("source"); val counts = t.getJSONObject("counts")
        val items = objs(t.optJSONArray("items"))
        fun flags(it: JSONObject): String { val e = it.getBoolean("est"); val o = it.getJSONArray("open").length() > 0; return (if (e) "≈" else "") + (if (o) (if (e) " " else "") + "⚑" else "") }
        L += "# Munkakör lap — " + src.getString("name").ifEmpty { "Felmérés" }
        L += ""
        L += "*" + KIND + " v" + t.getInt("v") + " · felmérés " + src.getString("id") + " · terv: " + src.getString("plan") +
            (if (src.getString("variant").isNotEmpty()) " · variáns: " + src.getString("variant") else "") +
            " · " + counts.getInt("rooms") + " helyiség, " + fmt(counts.getDouble("areaM2")) + " m²*"
        L += ""
        L += "≈ = becsült, ⚑ = nyitott döntés változtathat rajta. Árat nem tartalmaz: az árazás a Varler Workflow Kit dolga."
        val scope = objs(t.optJSONArray("scope"))
        if (scope.isNotEmpty()) {
            L += ""; L += "## Munkakör"; L += ""
            scope.forEach { g -> L += "- **" + g.getString("label") + ":** " + objs(g.getJSONArray("items")).joinToString(", ") { i -> i.getString("label") + if (i.getInt("qty") > 1) " ×" + i.getInt("qty") else "" } }
        }
        L += ""; L += "## Tételek"; L += ""
        if (items.isEmpty()) L += "Még nincs tétel."
        else {
            L += "| | Tétel | Mennyiség | | Megjegyzés |"; L += "|---|---|---|---|---|"
            items.forEach { L += "| " + it.getString("sym") + " | " + cell(it.getString("label")) + " | " + fmt(it.getDouble("qty")) + " " + it.getString("unit") + " | " + flags(it) + " | " + cell(it.getString("note")) + " |" }
            items.filter { (it.optJSONArray("parts")?.length() ?: 0) > 0 }.forEach { it2 ->
                L += ""
                L += "**" + it2.getString("label") + "** szakaszonként: " + objs(it2.getJSONArray("parts")).joinToString(", ") { p -> p.getString("label").ifEmpty { p.getString("ref") } + " " + fmt(p.getDouble("m")) + " m" }
            }
        }
        val decisions = objs(t.optJSONArray("decisions"))
        if (decisions.isNotEmpty()) {
            L += ""; L += "## Döntésre vár ⚑"; L += ""
            fun lab(id: String) = items.firstOrNull { it.getString("id") == id }?.getString("label") ?: id
            decisions.forEach { d -> val aff = strs(d.getJSONArray("affects"))
                L += "- " + (if (d.getString("state") == "later") "⏱ " else "") + d.getString("label") + (if (aff.isNotEmpty()) " → " + aff.joinToString(", ") { lab(it) } else "") }
        }
        val checks = strs(t.optJSONArray("checks"))
        if (checks.isNotEmpty()) { L += ""; L += "## Ellenőrizni"; L += ""; checks.forEach { L += "- $it" } }
        val qs = objs(t.optJSONArray("questions"))
        if (qs.isNotEmpty()) {
            L += ""; L += "## Kérdések (" + counts.getInt("answered") + " megválaszolva, " + counts.getInt("questionsOpen") + " nyitott)"; L += ""
            qs.forEach { q -> val st = q.getString("state"); val opts = strs(q.getJSONArray("options")); val tx = q.getString("text")
                L += "- " + (if (st == "answered") "✓" else if (st == "later") "⏱" else "○") + " " + q.getString("label") +
                    (if (opts.isNotEmpty()) " — " + opts.joinToString(", ") else "") + (if (tx.isNotEmpty()) " — „$tx”" else "") }
        }
        val notes = objs(t.optJSONArray("notes")); val memos = objs(t.optJSONArray("memos"))
        if (notes.isNotEmpty() || memos.isNotEmpty()) {
            L += ""; L += "## Jegyzetek"; L += ""
            notes.forEach { n -> val ch = strs(n.getJSONArray("chips")); val rm = n.getString("room")
                L += "- " + (if (n.getBoolean("open")) "⚑ Tisztázandó: " else "") + n.getString("text").ifEmpty { "(csak címke)" } +
                    (if (ch.isNotEmpty()) " [" + ch.joinToString(", ") + "]" else "") + (if (rm.isNotEmpty()) " · $rm" else "") }
            memos.forEach { L += "- ✎ " + it.getString("text") }
        }
        val photos = objs(t.optJSONArray("photos"))
        if (photos.isNotEmpty()) { L += ""; L += "## Fotók"; L += ""; photos.forEach { L += "- " + it.getString("sym") + " " + it.getString("label") + ": " + it.getInt("n") } }
        val rooms = objs(t.optJSONArray("rooms"))
        if (rooms.isNotEmpty()) { L += ""; L += "## Helyiségek"; L += ""; rooms.forEach { L += "- " + it.getString("name") + ": " + (if (it.getBoolean("est")) "≈ " else "") + fmt(it.getDouble("areaM2")) + " m²" +
            (it.optJSONArray("wants")?.let { w -> " — " + objs(w).joinToString(", ") { x -> x.getString("label") + " ×" + x.getInt("qty") } } ?: "") } }
        return L.joinToString("\n") + "\n"
    }

    /** The export file names next to the package: <stem>.takeoff.json and <stem>.takeoff.md. */
    fun fileNames(s: Sketch) = SketchJson.fileStem(s).let { "$it.takeoff.json" to "$it.takeoff.md" }
}
