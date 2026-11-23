package hu.vrg.mobile.sketch

import org.json.JSONArray
import org.json.JSONObject

// F4 (WP M49): the client's wants by room. The Munkakör's countable wants (the *igény* toggles with a quantity: dugalj,
// lámpa, …) can belong to a room: the room in focus when it is added, re-linkable later, never required (README §1,
// rule 2). The survey keeps two things:
//
//   scope       {scope id → qty}                the JOB TOTAL, as before (every reader of scope stays right: the
//                                               conditions, the scope card, the takeoff)
//   roomScope   {room id → {scope id → qty}}    the part of the total that belongs to a room
//
// The rest of the total is "Általános" (the job, no room). It is derived, never stored, and so is the total when a
// hand-edited file says less than its rooms: total = max(scope, sum of the live rooms). A room that was deleted keeps
// its entry in the file (an undo brings the room back with its wants) but counts as Általános meanwhile.
//
// The JS engine (Sketcher/lib/fieldkit.js `wants`) computes the same lines; Sketcher/test/fixtures/shadow.json pins it.
object Wants {
    const val KEY = "roomScope"

    /** One want: the job total, the part with no room, and the rooms (sketch order) that hold the rest. */
    data class Line(val id: String, val total: Int, val general: Int, val rooms: List<Pair<String, Int>>)

    private fun live(s: Sketch) = s.rooms.map { it.id }

    /** How many of [id] the live rooms hold. */
    fun roomSum(s: Sketch, id: String) = live(s).sumOf { s.roomScope[it]?.get(id) ?: 0 }

    fun total(s: Sketch, id: String) = maxOf(s.scope[id] ?: 0, roomSum(s, id))

    fun general(s: Sketch, id: String) = total(s, id) - roomSum(s, id)

    fun inRoom(s: Sketch, room: String?, id: String) = if (room == null || s.room(room) == null) general(s, id) else s.roomScope[room]?.get(id) ?: 0

    /** The countable wants of the kit that the survey has, in the kit's order. */
    fun lines(kit: Kit, s: Sketch): List<Line> = kit.scope.filter { it.qty }.mapNotNull { k ->
        val t = total(s, k.id)
        if (t <= 0) null
        else Line(k.id, t, general(s, k.id), live(s).mapNotNull { r -> (s.roomScope[r]?.get(k.id) ?: 0).takeIf { it > 0 }?.let { r to it } })
    }

    /** Per room (sketch order), then the job's own (room null) last: what each holds. Rooms with nothing are left out. */
    fun byRoom(kit: Kit, s: Sketch): List<Pair<String?, List<Pair<String, Int>>>> {
        val ls = lines(kit, s)
        val rooms = live(s).map { r -> r to ls.mapNotNull { l -> l.rooms.firstOrNull { it.first == r }?.let { l.id to it.second } } }.filter { it.second.isNotEmpty() }
        val gen = ls.filter { it.general > 0 }.map { it.id to it.general }
        return rooms.map { (r, l) -> (r as String?) to l } + if (gen.isEmpty()) emptyList() else listOf(null to gen)
    }

    private fun put(rs: Map<String, Map<String, Int>>, room: String, id: String, n: Int): Map<String, Map<String, Int>> {
        val m = (rs[room] ?: emptyMap()).let { if (n > 0) it + (id to n) else it - id }
        return if (m.isEmpty()) rs - room else rs + (room to m)
    }

    private fun withTotal(s: Sketch, id: String, t: Int) = s.copy(scope = if (t <= 0) s.scope - id else s.scope + (id to t))

    /**
     * One more (delta > 0) or one fewer (delta < 0) of [id] in [room] (null or a room that is gone = Általános).
     * The total follows. Fewer in Általános than it holds is not possible: the rooms' part is taken off in its room.
     */
    fun add(s: Sketch, id: String, room: String?, delta: Int): Sketch {
        if (delta == 0) return s
        val t = total(s, id)
        if (room == null || s.room(room) == null) {
            val g = general(s, id)
            val d = maxOf(delta, -g)
            return if (d == 0) s else withTotal(s, id, t + d)
        }
        val cur = s.roomScope[room]?.get(id) ?: 0
        val next = maxOf(0, cur + delta)
        if (next == cur) return s
        return withTotal(s.copy(roomScope = put(s.roomScope, room, id, next)), id, t + (next - cur))
    }

    /** Re-links [n] of [id] from one place to another (null = Általános). The total does not change. */
    fun move(s: Sketch, id: String, from: String?, to: String?, n: Int = 1): Sketch {
        val f = from?.takeIf { s.room(it) != null }
        val d = to?.takeIf { s.room(it) != null }
        if (f == d || n <= 0) return s
        val t = total(s, id)
        val have = inRoom(s, f, id)
        val m = minOf(n, have)
        if (m <= 0) return s
        var rs = s.roomScope
        if (f != null) rs = put(rs, f, id, have - m)
        if (d != null) rs = put(rs, d, id, (rs[d]?.get(id) ?: 0) + m)
        return withTotal(s.copy(roomScope = rs), id, t)
    }

    /**
     * The total of [id] set to [qty] (the Munkakör's plain stepper, Intake.setScope): when it drops below what the
     * rooms hold, the rooms give back, the last room first; 0 clears the want everywhere.
     */
    fun trim(s: Sketch, id: String, qty: Int): Sketch {
        if (qty <= 0) return s.copy(scope = s.scope - id, roomScope = s.roomScope.mapValues { it.value - id }.filterValues { it.isNotEmpty() })
        var over = roomSum(s, id) - qty
        if (over <= 0) return s
        var rs = s.roomScope
        for (r in live(s).reversed()) {
            if (over <= 0) break
            val n = rs[r]?.get(id) ?: 0
            val take = minOf(n, over)
            if (take > 0) { rs = put(rs, r, id, n - take); over -= take }
        }
        return s.copy(roomScope = rs)
    }

    // ---- the file ----------------------------------------------------------------------------------------------------

    /** Written only when some want has a room, so a survey without any stays byte-for-byte as before. */
    fun write(s: Sketch, o: JSONObject) {
        val rs = s.roomScope.filterValues { m -> m.values.any { it > 0 } }
        if (rs.isEmpty()) return
        o.put(KEY, JSONObject().also { j -> rs.toSortedMap().forEach { (r, m) ->
            j.put(r, JSONObject().also { mj -> m.filterValues { it > 0 }.toSortedMap().forEach { (k, v) -> mj.put(k, v) } })
        } })
    }

    /** Reads roomScope; a total smaller than its rooms is raised to their sum, so every reader of scope agrees. */
    fun read(o: JSONObject, s: Sketch): Sketch {
        val j = o.optJSONObject(KEY) ?: return s
        val rs = j.keys().asSequence().mapNotNull { r ->
            val m = j.optJSONObject(r) ?: return@mapNotNull null
            val v = m.keys().asSequence().associateWith { m.optInt(it) }.filterValues { it > 0 }
            if (v.isEmpty()) null else r to v
        }.toMap()
        val s1 = s.copy(roomScope = rs)
        val ids = rs.values.flatMap { it.keys }.toSet()
        return s1.copy(scope = s1.scope + ids.associateWith { total(s1, it) }.filterValues { it > 0 })
    }

    /** The Planner package: a room's own wants on its floor record (`sk.wants`), ids → qty. */
    fun ofRoom(s: Sketch, room: String): JSONObject? {
        val m = s.roomScope[room]?.filterValues { it > 0 } ?: return null
        if (m.isEmpty()) return null
        return JSONObject().also { j -> m.toSortedMap().forEach { (k, v) -> j.put(k, v) } }
    }

    /** The Planner package's `plan.wants`: every want with its total, the Általános part and the rooms (by room id). */
    fun packageList(s: Sketch): JSONArray {
        val ids = (s.scope.keys + s.roomScope.values.flatMap { it.keys }).filter { roomSum(s, it) > 0 }.toSortedSet()
        return JSONArray(ids.map { id ->
            JSONObject().put("id", id).put("total", total(s, id)).put("general", general(s, id))
                .put("rooms", JSONObject().also { j -> live(s).forEach { r -> (s.roomScope[r]?.get(id) ?: 0).takeIf { it > 0 }?.let { j.put(r, it) } } })
        })
    }
}
