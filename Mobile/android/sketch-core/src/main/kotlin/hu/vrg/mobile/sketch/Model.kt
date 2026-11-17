package hu.vrg.mobile.sketch

// The field sketch (Vázlat, WP M24) as plain data. A sketch is drawn in SKETCH UNITS: the canvas's own
// coordinates at zoom 1 (about one dp), y pointing down, with no scale at all. Proportions are whatever the
// hand drew while walking the flat; the real sizes come from the measurements, and the solver (Solver.kt)
// turns the two together into millimetres for the Planner.
//
// Every record is immutable; an edit (Ops.kt) returns a new Sketch, so undo is a list of old values.
// Ids are a prefix + the sketch's forward-only counter (`seq`), never reused, as in the Planner:
//   R room · L line · P point (Elosztó included) · M measure · K circuit · N nyomvonal (route) · J memo
//   T tag · U a tag placed on the sketch · F photo point (M25)

data class Pt(val x: Double, val y: Double) {
    operator fun plus(o: Pt) = Pt(x + o.x, y + o.y)
    operator fun minus(o: Pt) = Pt(x - o.x, y - o.y)
    operator fun times(k: Double) = Pt(x * k, y * k)
    fun dist(o: Pt) = Math.hypot(x - o.x, y - o.y)
}

/** What an installation point is. [planner] is the Planner's device type it becomes. */
enum class PointType(val id: String, val label: String, val glyph: String, val planner: String) {
    POINT("pont", "Pont", "•", "box"),
    SOCKET("socket", "Dugalj", "⊙", "socket"),
    SWITCH("switch", "Kapcsoló", "⊘", "switch"),
    LIGHT("light", "Lámpa", "✱", "light"),
    JUNCTION("junction", "Kötődoboz", "◇", "junction"),
    DATA("data", "Gyengeáram", "◈", "box"),
    FIXED("fixed", "Fix bekötés", "⊗", "socket"),
    SENSOR("sensor", "Érzékelő", "◎", "box"),
    BOARD("board", "Elosztó", "▣", "board");

    companion object {
        fun of(id: String?): PointType = entries.firstOrNull { it.id == id } ?: POINT
    }
}

/** Current (what is on the wall today) or planned (what the job adds). Drawn in two colours. */
enum class PointState(val id: String, val label: String) {
    EXISTING("meglevo", "Meglévő"),
    PLANNED("tervezett", "Tervezett");

    fun other() = if (this == EXISTING) PLANNED else EXISTING

    companion object {
        fun of(id: String?): PointState = entries.firstOrNull { it.id == id } ?: PLANNED
    }
}

/** A room: a closed outline (from a rectangle drag or a closed lineout). [kinds] are the Planner's room kinds. */
data class Room(
    val id: String,
    val poly: List<Pt>,
    val name: String = "",
    val kinds: List<String> = emptyList(),
)

/** An open lineout: the rough shape of the flat etched while walking, before it is closed into rooms. */
data class Line(val id: String, val pts: List<Pt>)

/**
 * An installation point. A point placed near a wall sits ON the room's edge ([room], [edge], [t] along it),
 * so after normalising it is still on that wall; a point in the open floor only has [at].
 */
data class SketchPoint(
    val id: String,
    val at: Pt,
    val type: PointType = PointType.POINT,
    val state: PointState = PointState.PLANNED,
    val room: String? = null,
    val edge: Int? = null,
    val t: Double? = null,
)

enum class MeasureKind(val id: String, val label: String) {
    /** One edge of a room, from corner to corner. */
    EDGE("el", "Fal"),
    /** The room's full width (left to right). */
    WIDTH("szel", "Szélesség"),
    /** The room's full depth (top to bottom). */
    DEPTH("mely", "Mélység");

    companion object {
        fun of(id: String?): MeasureKind = entries.firstOrNull { it.id == id } ?: EDGE
    }
}

/** A size taken on site, in millimetres. [edge] only for [MeasureKind.EDGE]. */
data class Measure(val id: String, val room: String, val kind: MeasureKind, val mm: Int, val edge: Int = -1)

/** Points wired together as one circuit, optionally fed from an Elosztó (a BOARD point). */
data class Circuit(
    val id: String,
    val name: String,
    val color: Long,
    val members: List<String> = emptyList(),
    val board: String? = null,
    val dedicated: Boolean = false,
)

/** Nyomvonaljelölés: where the cables run, drawn by hand. [a] / [b] are points its ends are tied to. */
data class Route(val id: String, val pts: List<Pt>, val a: String? = null, val b: String? = null, val circuit: String? = null)

/** A memo, next to a record ([target]) or anywhere on the sketch. */
data class Memo(val id: String, val at: Pt, val text: String, val target: String? = null)

/** A tag the user made (or a preset). [preset] gives it a meaning in the Planner, e.g. "kind:furdo". */
data class Tag(val id: String, val name: String, val color: Long, val preset: String? = null)

/** A tag dropped on the sketch: on a record ([target]) or loose at [at]. */
data class TagUse(val id: String, val tag: String, val target: String? = null, val at: Pt? = null)

/** WP M25 (Fotópont): a spot in a room with photos, each taken facing [Shot.deg] (0 = up on the sketch, clockwise). */
data class Shot(val deg: Int, val file: String, val taken: Long = 0)
data class PhotoPoint(val id: String, val at: Pt, val room: String? = null, val shots: List<Shot> = emptyList())

/** Which level of the building the sketch is: the Planner's level ids. */
enum class Level(val id: String, val label: String, val heightMm: Int) {
    BASEMENT("basement", "Pince", 2500),
    GROUND("ground", "Földszint", 2700),
    UPPER("upper", "Emelet", 2700);

    companion object {
        fun of(id: String?): Level = entries.firstOrNull { it.id == id } ?: GROUND
    }
}

data class Sketch(
    val id: String,
    val name: String = "",
    val level: Level = Level.GROUND,
    val created: Long = 0,
    val updated: Long = 0,
    val seq: Int = 0,
    val rooms: List<Room> = emptyList(),
    val lines: List<Line> = emptyList(),
    val points: List<SketchPoint> = emptyList(),
    val measures: List<Measure> = emptyList(),
    val circuits: List<Circuit> = emptyList(),
    val routes: List<Route> = emptyList(),
    val memos: List<Memo> = emptyList(),
    val tags: List<Tag> = Tags.PRESETS,
    val tagUses: List<TagUse> = emptyList(),
    val photos: List<PhotoPoint> = emptyList(),
    /** The tool plugins switched on for this sketch (Plugins.kt). */
    val plugins: List<String> = Plugins.DEFAULT_ON,
) {
    /** The next id with [prefix], and the sketch with its counter moved on. */
    fun nextId(prefix: String): Pair<String, Sketch> = (prefix + (seq + 1)) to copy(seq = seq + 1)

    fun room(id: String?) = rooms.firstOrNull { it.id == id }
    fun point(id: String?) = points.firstOrNull { it.id == id }
    fun circuit(id: String?) = circuits.firstOrNull { it.id == id }
    fun route(id: String?) = routes.firstOrNull { it.id == id }
    fun memo(id: String?) = memos.firstOrNull { it.id == id }
    fun tag(id: String?) = tags.firstOrNull { it.id == id }
    fun tagUse(id: String?) = tagUses.firstOrNull { it.id == id }
    fun line(id: String?) = lines.firstOrNull { it.id == id }
    fun measure(id: String?) = measures.firstOrNull { it.id == id }

    /** The circuit a point belongs to (a point is in at most one, as in the Planner). */
    fun circuitOf(pointId: String) = circuits.firstOrNull { pointId in it.members }

    /** Where a record sits, for memos and tags placed next to it. */
    fun anchorOf(id: String?): Pt? {
        if (id == null) return null
        point(id)?.let { return it.at }
        room(id)?.let { return Geo.centroid(it.poly) }
        memo(id)?.let { return it.at }
        route(id)?.let { r -> return r.pts.getOrNull(r.pts.size / 2) }
        line(id)?.let { l -> return l.pts.firstOrNull() }
        photos.firstOrNull { it.id == id }?.let { return it.at }
        circuit(id)?.let { c -> return c.members.mapNotNull { point(it)?.at }.let { if (it.isEmpty()) null else Geo.mean(it) } }
        return null
    }

    val boards get() = points.filter { it.type == PointType.BOARD }
    val isEmpty get() = rooms.isEmpty() && lines.isEmpty() && points.isEmpty() && memos.isEmpty() && routes.isEmpty()
}

/** The circuit colours, in the order new circuits take them (readable on both the dark and the light palettes). */
object CircuitColors {
    val ALL: List<Long> = listOf(
        0xFFE8641C, 0xFF2A8CDB, 0xFF3DAE5A, 0xFFC03FA8, 0xFFE0B020, 0xFF20A8A0, 0xFF8A5CD6, 0xFFD64545,
    )
    fun next(used: Int) = ALL[used % ALL.size]
}
