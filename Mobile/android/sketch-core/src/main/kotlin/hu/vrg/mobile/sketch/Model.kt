package hu.vrg.mobile.sketch

// The field sketch (Vázlat, WP M24) as plain data. A sketch is drawn in SKETCH UNITS: the canvas's own
// coordinates at zoom 1 (about one dp), y pointing down, with no scale at all. Proportions are whatever the
// hand drew while walking the flat; the real sizes come from the measurements, and the solver (Solver.kt)
// turns the two together into millimetres for the Planner.
//
// Every record is immutable; an edit (Ops.kt) returns a new Sketch, so undo is a list of old values.
// Ids are a prefix + the sketch's forward-only counter (`seq`), never reused, as in the Planner:
//   R room · L line · P point (Elosztó included) · M measure · K circuit · N nyomvonal (route) · J memo
//   T tag · U a tag placed on the sketch · F photo point (M25) · E note entry · C capture (photo with a purpose)

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

// ---- the intake (VRG Sketcher, WP M26-M30): docs/sketcher/README.md section 3 --------------------------------------
// Every record stands alone and may arrive in any order: a note before the room exists, a photo with no purpose yet,
// an answer before its question would even show. Links (room, target) are optional and can come late.

/** A note from the conversation, or a fact made of quick chips alone. [open] = Tisztázandó. */
data class Entry(
    val id: String,
    val at: Long,
    val text: String = "",
    val chips: List<String> = emptyList(),
    val room: String? = null,
    val target: String? = null,
    val open: Boolean = false,
    val voice: Boolean = false,
)

enum class AnswerState(val id: String) {
    ANSWERED("answered"), LATER("later"), SKIP("skip");
    companion object { fun of(id: String?) = entries.firstOrNull { it.id == id } ?: ANSWERED }
}

data class Answer(val q: String, val options: List<String> = emptyList(), val text: String = "", val at: Long = 0, val state: AnswerState = AnswerState.ANSWERED)

enum class MarkKind(val id: String) {
    ARROW("nyil"), CIRCLE("kor"), LINE("vonal"), FREE("szabad"), TEXT("szoveg");
    companion object { fun of(id: String?) = entries.firstOrNull { it.id == id } ?: FREE }
}

/** Markup over a photo: points in 0..1 of the photo's width and height (upright), so it fits any size. */
data class Mark(val kind: MarkKind, val pts: List<Pt>, val text: String = "", val color: Long = 0xFFE8641C)

/** A photo taken for a purpose (Kamera, WP M29): what it shows, where, which shot-list item it fulfils. */
data class Capture(
    val id: String,
    val file: String,
    val purpose: String = "egyeb",
    val at: Long = 0,
    val room: String? = null,
    val target: String? = null,
    val shot: String? = null,
    val note: String = "",
    val lat: Double? = null,
    val lon: Double? = null,
    val marks: List<Mark> = emptyList(),
)

/** The building's outline as the map knows it (WP M30): its oriented size in metres. */
data class Footprint(val w: Double, val d: Double, val area: Double, val angle: Double, val src: String, val at: Long = 0)

/**
 * Where the solved sketch sits on the map (F1): its box centre at [lat]/[lon], turned [rot] degrees clockwise.
 * [auto] = still the first fit (SitePlace.autoFit), false once the user moved or turned it.
 */
data class Placement(val lat: Double, val lon: Double, val rot: Double, val auto: Boolean = true, val at: Long = 0)

/**
 * Where the job is (WP M30). [source]: "kezi" typed, "gps" the phone's position, "terkep" VRG Térkép, "osm" Nominatim.
 * F1: [outline] = the building's corners (lat, lon), from OSM or drawn on the map; [place] = the sketch on it.
 */
data class Site(val address: String = "", val lat: Double? = null, val lon: Double? = null, val source: String = "kezi", val footprint: Footprint? = null,
                val outline: List<Pair<Double, Double>> = emptyList(), val place: Placement? = null)

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
    // the intake (v2)
    val site: Site? = null,
    val entries: List<Entry> = emptyList(),
    val scope: Map<String, Int> = emptyMap(),
    val answers: Map<String, Answer> = emptyMap(),
    val captures: List<Capture> = emptyList(),
    val dismissed: Set<String> = emptySet(),
    val seen: Map<String, Long> = emptyMap(),
    val variant: String? = null,
    val variantOn: Boolean = false,
    val draft: String = "",
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
        captures.firstOrNull { it.id == id }?.let { c -> return anchorOf(c.target) ?: room(c.room)?.let { Geo.centroid(it.poly) } }
        circuit(id)?.let { c -> return c.members.mapNotNull { point(it)?.at }.let { if (it.isEmpty()) null else Geo.mean(it) } }
        return null
    }

    fun entry(id: String?) = entries.firstOrNull { it.id == id }
    fun capture(id: String?) = captures.firstOrNull { it.id == id }

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
