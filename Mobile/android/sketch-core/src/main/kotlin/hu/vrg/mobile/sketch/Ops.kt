package hu.vrg.mobile.sketch

import kotlin.math.abs

/** What a touch landed on. [edge] / [vertex] only for rooms and routes. */
data class Hit(val kind: Kind, val id: String, val edge: Int = -1, val vertex: Int = -1) {
    enum class Kind { POINT, MEMO, TAG, ROUTE, ROOM_EDGE, ROOM, LINE, PHOTO }
}

/**
 * Every edit of a sketch, as functions from the old sketch to the new one. The screen only turns touches into
 * calls here, so everything the user can do is testable on the JVM. [tol] values are in sketch units: the
 * screen passes its touch slop divided by the zoom.
 */
object Ops {
    const val MIN_ROOM = 24.0          // sketch units: a smaller rectangle is a slip, not a room

    // ---- snapping --------------------------------------------------------------------------------------------------

    /** Lays a coordinate onto an existing room corner's x (or y) within [tol]: adjacent rooms then share their wall. */
    fun snapAxes(s: Sketch, p: Pt, tol: Double, skip: String? = null): Pt {
        var bx = p.x; var dx = tol
        var by = p.y; var dy = tol
        s.rooms.filter { it.id != skip }.forEach { r ->
            r.poly.forEach { v ->
                if (abs(v.x - p.x) < dx) { dx = abs(v.x - p.x); bx = v.x }
                if (abs(v.y - p.y) < dy) { dy = abs(v.y - p.y); by = v.y }
            }
        }
        return Pt(bx, by)
    }

    data class EdgeSnap(val room: String, val edge: Int, val t: Double, val at: Pt, val d: Double)

    /** The nearest room edge within [tol]. */
    fun nearestEdge(s: Sketch, p: Pt, tol: Double): EdgeSnap? {
        var best: EdgeSnap? = null
        s.rooms.forEach { r ->
            for (k in r.poly.indices) {
                val (a, b) = Geo.edge(r.poly, k)
                val f = Geo.foot(p, a, b)
                if (f.d <= tol && (best == null || f.d < best!!.d)) best = EdgeSnap(r.id, k, f.t, f.q, f.d)
            }
        }
        return best
    }

    fun roomAt(s: Sketch, p: Pt): Room? = s.rooms.lastOrNull { Geo.inside(p, it.poly) }

    // ---- rooms and lines -------------------------------------------------------------------------------------------

    /** A rectangle drag → a room. Its corners snap to the other rooms' corner lines. Null when too small. */
    fun addRectRoom(s: Sketch, a: Pt, b: Pt, tol: Double): Pair<Sketch, String>? {
        val p = snapAxes(s, a, tol); val q = snapAxes(s, b, tol)
        if (abs(p.x - q.x) < MIN_ROOM || abs(p.y - q.y) < MIN_ROOM) return null
        return addRoom(s, Geo.rect(p, q))
    }

    /** A closed lineout → a room. Null when the outline crosses itself or has no area. */
    fun addPolyRoom(s: Sketch, pts: List<Pt>): Pair<Sketch, String>? {
        if (!Geo.validRoom(pts, MIN_ROOM * MIN_ROOM / 2)) return null
        return addRoom(s, pts)
    }

    private fun addRoom(s: Sketch, poly: List<Pt>): Pair<Sketch, String> {
        val (id, s1) = s.nextId("R")
        val kinds = emptyList<String>()
        return s1.copy(rooms = s1.rooms + Room(id, poly, "", kinds)) to id
    }

    fun addLine(s: Sketch, pts: List<Pt>): Pair<Sketch, String>? {
        if (pts.size < 2) return null
        val (id, s1) = s.nextId("L")
        return s1.copy(lines = s1.lines + Line(id, pts)) to id
    }

    /** Moves a whole room, with the points on its walls and the memos pinned to it. */
    fun moveRoom(s: Sketch, id: String, d: Pt): Sketch {
        val r = s.room(id) ?: return s
        return s.copy(
            rooms = s.rooms.map { if (it.id == id) it.copy(poly = r.poly.map { p -> p + d }) else it },
            points = s.points.map { if (it.room == id) it.copy(at = it.at + d) else it },
            memos = s.memos.map { if (it.target == id) it.copy(at = it.at + d) else it },
        )
    }

    /** Moves one corner; points on the two edges it ends stay at their place along the edge. */
    fun moveVertex(s: Sketch, id: String, k: Int, p: Pt, tol: Double): Sketch {
        val r = s.room(id) ?: return s
        val q = snapAxes(s, p, tol, skip = id)
        val poly = r.poly.toMutableList().also { it[k] = q }
        if (!Geo.validRoom(poly, 1.0)) return s
        val s1 = s.copy(rooms = s.rooms.map { if (it.id == id) it.copy(poly = poly) else it })
        return reseat(s1, id)
    }

    fun renameRoom(s: Sketch, id: String, name: String) =
        s.copy(rooms = s.rooms.map { if (it.id == id) it.copy(name = name.trim()) else it })

    /** A room can carry several kinds (Konyha + Étkező), as in the Planner's room-type wheel. */
    fun toggleKind(s: Sketch, id: String, kind: String) = s.copy(rooms = s.rooms.map {
        if (it.id != id) it else it.copy(kinds = if (kind in it.kinds) it.kinds - kind else it.kinds + kind)
    })

    /** Points sitting on a room's edges follow its edges after the outline changed. */
    private fun reseat(s: Sketch, roomId: String): Sketch {
        val r = s.room(roomId) ?: return s
        return s.copy(points = s.points.map { p ->
            if (p.room != roomId || p.edge == null || p.t == null || p.edge >= r.poly.size) p
            else { val (a, b) = Geo.edge(r.poly, p.edge); p.copy(at = Geo.lerp(a, b, p.t)) }
        })
    }

    // ---- points ----------------------------------------------------------------------------------------------------

    /** A point near a wall sits on it; otherwise it is a free point in whichever room it is in. */
    fun place(s: Sketch, p: Pt, tol: Double): Triple<Pt, String?, Pair<Int, Double>?> {
        val e = nearestEdge(s, p, tol)
        if (e != null) return Triple(e.at, e.room, e.edge to e.t)
        return Triple(p, roomAt(s, p)?.id, null)
    }

    fun addPoint(s: Sketch, p: Pt, type: PointType, state: PointState, tol: Double): Pair<Sketch, String> {
        val (at, room, on) = place(s, p, tol)
        val (id, s1) = s.nextId("P")
        return s1.copy(points = s1.points + SketchPoint(id, at, type, state, room, on?.first, on?.second)) to id
    }

    fun movePoint(s: Sketch, id: String, p: Pt, tol: Double): Sketch {
        val (at, room, on) = place(s, p, tol)
        val s1 = s.copy(points = s.points.map { if (it.id == id) it.copy(at = at, room = room, edge = on?.first, t = on?.second) else it })
        return reroute(s1, id)
    }

    fun setType(s: Sketch, id: String, type: PointType): Sketch {
        var s1 = s.copy(points = s.points.map { if (it.id == id) it.copy(type = type) else it })
        if (type == PointType.BOARD) s1 = s1.copy(circuits = s1.circuits.map { it.copy(members = it.members - id) })
        else s1 = s1.copy(circuits = s1.circuits.map { if (it.board == id) it.copy(board = null) else it })
        return s1
    }

    fun setState(s: Sketch, id: String, state: PointState) =
        s.copy(points = s.points.map { if (it.id == id) it.copy(state = state) else it })

    /** Route ends tied to a moved point follow it. */
    private fun reroute(s: Sketch, pointId: String): Sketch {
        val at = s.point(pointId)?.at ?: return s
        return s.copy(routes = s.routes.map { r ->
            var pts = r.pts
            if (r.a == pointId && pts.isNotEmpty()) pts = listOf(at) + pts.drop(1)
            if (r.b == pointId && pts.isNotEmpty()) pts = pts.dropLast(1) + at
            if (pts === r.pts) r else r.copy(pts = pts)
        })
    }

    // ---- measurements ----------------------------------------------------------------------------------------------

    /** Sets (or with mm ≤ 0 removes) a room's size. One measure per room + kind + edge. */
    fun setMeasure(s: Sketch, room: String, kind: MeasureKind, mm: Int, edge: Int = -1): Sketch {
        val e = if (kind == MeasureKind.EDGE) edge else -1
        val old = s.measures.firstOrNull { it.room == room && it.kind == kind && it.edge == e }
        if (mm <= 0) return if (old == null) s else s.copy(measures = s.measures - old)
        if (old != null) return s.copy(measures = s.measures.map { if (it === old) it.copy(mm = mm) else it })
        val (id, s1) = s.nextId("M")
        return s1.copy(measures = s1.measures + Measure(id, room, kind, mm, e))
    }

    fun measuresOf(s: Sketch, room: String) = s.measures.filter { it.room == room }

    // ---- circuits and the Elosztó ----------------------------------------------------------------------------------

    fun newCircuit(s: Sketch, members: List<String> = emptyList()): Pair<Sketch, String> {
        val (id, s1) = s.nextId("K")
        val name = "K" + (s1.circuits.size + 1)
        val ok = members.filter { s1.point(it)?.type?.let { t -> t != PointType.BOARD } == true }
        val cleared = s1.circuits.map { it.copy(members = it.members - ok.toSet()) }
        return s1.copy(circuits = cleared + Circuit(id, name, CircuitColors.next(s1.circuits.size), ok)) to id
    }

    /** A point joins the circuit (leaving any other), or leaves it if it was already in. An Elosztó never joins. */
    fun toggleMember(s: Sketch, circuit: String, point: String): Sketch {
        val p = s.point(point) ?: return s
        if (p.type == PointType.BOARD) return s
        val c = s.circuit(circuit) ?: return s
        if (point in c.members) return s.copy(circuits = s.circuits.map { if (it.id == circuit) it.copy(members = it.members - point) else it })
        return s.copy(circuits = s.circuits.map {
            if (it.id == circuit) it.copy(members = it.members + point) else it.copy(members = it.members - point)
        })
    }

    fun addMembers(s: Sketch, circuit: String, points: List<String>): Sketch =
        points.fold(s) { acc, p -> if (acc.circuit(circuit)?.members?.contains(p) == true) acc else toggleMember(acc, circuit, p) }

    fun renameCircuit(s: Sketch, id: String, name: String) =
        s.copy(circuits = s.circuits.map { if (it.id == id) it.copy(name = name.trim().ifEmpty { it.name }) else it })

    fun setDedicated(s: Sketch, id: String, on: Boolean) =
        s.copy(circuits = s.circuits.map { if (it.id == id) it.copy(dedicated = on) else it })

    fun setBoard(s: Sketch, circuit: String, board: String?) =
        s.copy(circuits = s.circuits.map { if (it.id == circuit) it.copy(board = board) else it })

    /**
     * Bekötés: every circuit that has members and no Elosztó yet is fed from the nearest one. Returns the sketch
     * and how many circuits were connected. Circuits already on a board keep it (the user chose it).
     */
    fun connectCircuits(s: Sketch): Pair<Sketch, Int> {
        val boards = s.boards
        if (boards.isEmpty()) return s to 0
        var n = 0
        val cs = s.circuits.map { c ->
            if (c.board != null && s.point(c.board) != null) return@map c
            val pts = c.members.mapNotNull { s.point(it)?.at }
            if (pts.isEmpty()) return@map c
            val m = Geo.mean(pts)
            n++
            c.copy(board = boards.minByOrNull { it.at.dist(m) }!!.id)
        }
        return s.copy(circuits = cs) to n
    }

    // ---- nyomvonal -------------------------------------------------------------------------------------------------

    /** A drawn route: simplified to its corners, each end tied to a point or Elosztó within [tol]. */
    fun addRoute(s: Sketch, raw: List<Pt>, tol: Double): Pair<Sketch, String>? {
        if (raw.size < 2) return null
        var pts = Geo.simplify(Geo.thin(raw, tol / 4), tol / 3)
        if (Geo.perimeter(pts, closed = false) < tol) return null
        val a = s.points.filter { it.at.dist(pts.first()) <= tol }.minByOrNull { it.at.dist(pts.first()) }
        val b = s.points.filter { it.at.dist(pts.last()) <= tol && it.id != a?.id }.minByOrNull { it.at.dist(pts.last()) }
        if (a != null) pts = listOf(a.at) + pts.drop(1)
        if (b != null) pts = pts.dropLast(1) + b.at
        val circuit = listOfNotNull(a, b).firstNotNullOfOrNull { s.circuitOf(it.id)?.id }
        val (id, s1) = s.nextId("N")
        return s1.copy(routes = s1.routes + Route(id, pts, a?.id, b?.id, circuit)) to id
    }

    // ---- memos and tags --------------------------------------------------------------------------------------------

    fun addMemo(s: Sketch, at: Pt, text: String, target: String? = null): Pair<Sketch, String>? {
        if (text.isBlank()) return null
        val (id, s1) = s.nextId("J")
        return s1.copy(memos = s1.memos + Memo(id, at, text.trim(), target)) to id
    }

    fun editMemo(s: Sketch, id: String, text: String): Sketch =
        if (text.isBlank()) delete(s, id) else s.copy(memos = s.memos.map { if (it.id == id) it.copy(text = text.trim()) else it })

    fun moveMemo(s: Sketch, id: String, at: Pt) = s.copy(memos = s.memos.map { if (it.id == id) it.copy(at = at) else it })

    fun addTag(s: Sketch, name: String): Pair<Sketch, String>? {
        val n = name.trim()
        if (n.isEmpty()) return null
        s.tags.firstOrNull { it.name.equals(n, ignoreCase = true) }?.let { return s to it.id }
        val (id, s1) = s.nextId("T")
        return s1.copy(tags = s1.tags + Tag(id, n, Tags.colorFor(s1.tags.size))) to id
    }

    /** A tag dropped on a record (once per record) or loose on the sketch. */
    fun placeTag(s: Sketch, tag: String, target: String?, at: Pt?): Pair<Sketch, String>? {
        if (s.tag(tag) == null || (target == null && at == null)) return null
        if (target != null) s.tagUses.firstOrNull { it.tag == tag && it.target == target }?.let { return s to it.id }
        val (id, s1) = s.nextId("U")
        return s1.copy(tagUses = s1.tagUses + TagUse(id, tag, target, if (target == null) at else null)) to id
    }

    fun moveTagUse(s: Sketch, id: String, target: String?, at: Pt) =
        s.copy(tagUses = s.tagUses.map { if (it.id == id) it.copy(target = target, at = if (target == null) at else null) else it })

    fun tagsOf(s: Sketch, target: String) = s.tagUses.filter { it.target == target }.mapNotNull { s.tag(it.tag) }

    // ---- delete ----------------------------------------------------------------------------------------------------

    /** Removes any record by id and everything that only made sense with it. */
    fun delete(s: Sketch, id: String): Sketch {
        val pinned = { t: String? -> t == id }
        var o = s.copy(
            memos = s.memos.filter { it.id != id && !pinned(it.target) },
            tagUses = s.tagUses.filter { it.id != id && !pinned(it.target) && it.tag != id },
        )
        when {
            s.room(id) != null -> o = o.copy(
                rooms = o.rooms.filter { it.id != id },
                measures = o.measures.filter { it.room != id },
                points = o.points.map { if (it.room == id) it.copy(room = null, edge = null, t = null) else it },
            )
            s.point(id) != null -> o = o.copy(
                points = o.points.filter { it.id != id },
                circuits = o.circuits.map { c -> c.copy(members = c.members - id, board = if (c.board == id) null else c.board) },
                routes = o.routes.map { r -> r.copy(a = if (r.a == id) null else r.a, b = if (r.b == id) null else r.b) },
            )
            s.circuit(id) != null -> o = o.copy(
                circuits = o.circuits.filter { it.id != id },
                routes = o.routes.map { if (it.circuit == id) it.copy(circuit = null) else it },
            )
            s.route(id) != null -> o = o.copy(routes = o.routes.filter { it.id != id })
            s.line(id) != null -> o = o.copy(lines = o.lines.filter { it.id != id })
            s.measure(id) != null -> o = o.copy(measures = o.measures.filter { it.id != id })
            s.tag(id) != null -> o = o.copy(tags = o.tags.filter { it.id != id })
            s.photos.any { it.id == id } -> o = o.copy(photos = o.photos.filter { it.id != id })
        }
        return o
    }

    // ---- hit testing -----------------------------------------------------------------------------------------------

    /**
     * What is under [p] within [tol], the small things first: points, memos, loose tags, route corners and lines,
     * room corners and walls, then the inside of a room, then a lineout.
     */
    fun hit(s: Sketch, p: Pt, tol: Double, memoAt: (Memo) -> Pt = { it.at }): Hit? {
        s.points.filter { it.at.dist(p) <= tol }.minByOrNull { it.at.dist(p) }?.let { return Hit(Hit.Kind.POINT, it.id) }
        s.photos.filter { it.at.dist(p) <= tol }.minByOrNull { it.at.dist(p) }?.let { return Hit(Hit.Kind.PHOTO, it.id) }
        s.memos.filter { memoAt(it).dist(p) <= tol * 1.4 }.minByOrNull { memoAt(it).dist(p) }?.let { return Hit(Hit.Kind.MEMO, it.id) }
        s.tagUses.filter { it.at != null && it.at.dist(p) <= tol }.minByOrNull { it.at!!.dist(p) }?.let { return Hit(Hit.Kind.TAG, it.id) }
        for (r in s.routes.asReversed()) {
            r.pts.forEachIndexed { i, q -> if (q.dist(p) <= tol) return Hit(Hit.Kind.ROUTE, r.id, vertex = i) }
            for (i in 0 until r.pts.size - 1) if (Geo.foot(p, r.pts[i], r.pts[i + 1]).d <= tol / 2) return Hit(Hit.Kind.ROUTE, r.id, edge = i)
        }
        for (r in s.rooms.asReversed()) r.poly.forEachIndexed { k, v -> if (v.dist(p) <= tol) return Hit(Hit.Kind.ROOM_EDGE, r.id, vertex = k) }
        nearestEdge(s, p, tol / 1.5)?.let { return Hit(Hit.Kind.ROOM_EDGE, it.room, edge = it.edge) }
        roomAt(s, p)?.let { return Hit(Hit.Kind.ROOM, it.id) }
        for (l in s.lines.asReversed()) for (i in 0 until l.pts.size - 1) if (Geo.foot(p, l.pts[i], l.pts[i + 1]).d <= tol / 2) return Hit(Hit.Kind.LINE, l.id)
        return null
    }

    /** The points inside a rectangle drag (the circuit tool's frame). */
    fun pointsIn(s: Sketch, a: Pt, b: Pt, types: Set<PointType>? = null): List<String> {
        val (lo, hi) = Geo.bbox(listOf(a, b))
        return s.points.filter { it.at.x in lo.x..hi.x && it.at.y in lo.y..hi.y && (types == null || it.type in types) }.map { it.id }
    }
}
