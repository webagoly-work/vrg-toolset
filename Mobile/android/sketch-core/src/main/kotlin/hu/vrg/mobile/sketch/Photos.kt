package hu.vrg.mobile.sketch

import kotlin.math.atan2
import kotlin.math.hypot

// Fotópont (WP M25). A point in the middle of a room; each photo taken from it faces one of the room's four
// sides as drawn (D-24 = A): 0 = up on the sketch, 90 = right, 180 = down, 270 = left. There is no compass
// (D-26 = A): the direction is the swipe the user makes after the shot, relative to the sketch, which is not
// north-up anyway. Four photos map a room out. Each photo reaches the PC as its own file on the Átadás board
// (D-25 = A), under the name exportName gives it; the Planner package lists those names.
object Photos {
    val DIRS = listOf(0, 90, 180, 270)

    /** The short Hungarian side name shown on the wedge: É(szak), K(elet), D(él), Ny(ugat) of the sketch. */
    fun label(deg: Int) = when (norm(deg)) { 0 -> "É"; 90 -> "K"; 180 -> "D"; else -> "Ny" }

    /** The ASCII word used in file names. */
    fun word(deg: Int) = when (norm(deg)) { 0 -> "eszak"; 90 -> "kelet"; 180 -> "del"; else -> "nyugat" }

    fun norm(deg: Int) = ((deg % 360) + 360) % 360

    /**
     * A swipe (dx, dy in screen px or sketch units, y down) → the side it points at, or null when it is shorter
     * than [min]. Each side takes the 90° around it.
     */
    fun snap(dx: Double, dy: Double, min: Double = 0.0): Int? {
        if (hypot(dx, dy) < max(min, 1e-9)) return null
        var a = Math.toDegrees(atan2(dx, -dy))          // 0 = up, clockwise
        if (a < 0) a += 360.0
        return (Math.round(a / 90.0).toInt() % 4) * 90
    }

    private fun max(a: Double, b: Double) = if (a > b) a else b

    /** Which side's wedge a touch at (dx, dy) from the point is on, when it is between [inner] and [outer]. */
    fun wedgeAt(dx: Double, dy: Double, inner: Double, outer: Double): Int? {
        val r = hypot(dx, dy)
        return if (r < inner || r > outer) null else snap(dx, dy)
    }

    fun shot(p: PhotoPoint, deg: Int) = p.shots.firstOrNull { norm(it.deg) == norm(deg) }
    fun missing(p: PhotoPoint) = DIRS.filter { shot(p, it) == null }
    /** The side to take next: the first one still missing, in É, K, D, Ny order. */
    fun next(p: PhotoPoint) = missing(p).firstOrNull()

    /** The file name on the board: `<sketch>_<point id>_<side>.jpg`, ASCII only. */
    fun exportName(s: Sketch, p: PhotoPoint, deg: Int) = "${SketchJson.fileStem(s)}_${p.id}_${word(deg)}.jpg"

    /** Every photo file the sketch keeps (the phone's own names), for clean-up. */
    fun files(s: Sketch) = s.photos.flatMap { p -> p.shots.map { it.file } }.toSet()
}

/** The photo-point edits (WP M25); the rest of the sketch's edits are in Ops. */
object PhotoOps {
    /** A photo point; a tap near the middle of a room lands on the middle (its centroid). */
    fun add(s: Sketch, p: Pt, tol: Double): Pair<Sketch, String> {
        val room = Ops.roomAt(s, p)
        val at = room?.let { r -> Geo.centroid(r.poly).takeIf { it.dist(p) <= tol * 1.5 } } ?: p
        val (id, s1) = s.nextId("F")
        return s1.copy(photos = s1.photos + PhotoPoint(id, at, room?.id)) to id
    }

    fun move(s: Sketch, id: String, p: Pt) = s.copy(photos = s.photos.map {
        if (it.id == id) it.copy(at = p, room = Ops.roomAt(s, p)?.id) else it
    })

    /** A photo facing [deg]. One per side: a new one replaces the old, whose file is returned to delete. */
    fun addShot(s: Sketch, id: String, deg: Int, file: String, taken: Long, f35: Double? = null): Pair<Sketch, String?> {
        val p = s.photos.firstOrNull { it.id == id } ?: return s to file
        val d = Photos.norm(deg)
        val old = Photos.shot(p, d)
        val shots = (p.shots.filter { Photos.norm(it.deg) != d } + Shot(d, file, taken, f35)).sortedBy { it.deg }
        return s.copy(photos = s.photos.map { if (it.id == id) it.copy(shots = shots) else it }) to old?.file?.takeIf { it != file }
    }

    /** Removes the photo facing [deg]; its file is returned to delete. */
    fun removeShot(s: Sketch, id: String, deg: Int): Pair<Sketch, String?> {
        val p = s.photos.firstOrNull { it.id == id } ?: return s to null
        val old = Photos.shot(p, deg) ?: return s to null
        return s.copy(photos = s.photos.map { if (it.id == id) it.copy(shots = it.shots - old) else it }) to old.file
    }

    /** The photo facing [from] was really facing [to]; if [to] already has one, the two swap. */
    fun turnShot(s: Sketch, id: String, from: Int, to: Int): Sketch {
        val p = s.photos.firstOrNull { it.id == id } ?: return s
        val a = Photos.shot(p, from) ?: return s
        val b = Photos.shot(p, to)
        val shots = p.shots.map {
            when (it) { a -> it.copy(deg = Photos.norm(to)); b -> it.copy(deg = Photos.norm(from)); else -> it }
        }.sortedBy { it.deg }
        return s.copy(photos = s.photos.map { if (it.id == id) it.copy(shots = shots) else it })
    }
}
