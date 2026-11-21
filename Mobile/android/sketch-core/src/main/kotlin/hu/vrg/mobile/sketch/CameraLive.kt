package hu.vrg.mobile.sketch

import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.hypot
import kotlin.math.roundToInt
import kotlin.math.sqrt

// Saját kamera (WP M52, fork F7): the pure half of the in-app camera. The viewfinder's purpose strip (the shot list's
// next missing items first), the series that stays open until ✓, the level line from the gravity sensor and the
// ghost overlay's before-photo. The screen is feature-sketch LiveCamera.kt; the decisions are D-100 … D-109.

object CameraLive {

    // ---- the purpose strip on the viewfinder (D-103) --------------------------------------------------------------

    /** One entry of the strip: a purpose, optionally for one shot-list item ([missing] = that item is still short). */
    data class Pick(val purpose: String, val shot: String? = null, val missing: Boolean = false)

    /**
     * The strip's order: the shot list's next missing items (up to [n], room items left out: they belong to Fotópont),
     * then the [current] purpose, the three used last, then the catalog's order. "szoba" is never offered (Fotópont).
     * A purpose appears once on its own besides its missing items.
     */
    fun strip(kit: Kit, s: Sketch, current: String?, missingFirst: Boolean = true, n: Int = 4): List<Pick> {
        val out = mutableListOf<Pick>()
        if (missingFirst) Camera2.nextMissing(kit, s, n).filter { it.item.purpose != "szoba" && kit.purpose(it.item.purpose) != null }
            .forEach { out += Pick(it.item.purpose, it.item.id, missing = true) }
        val plain = (listOfNotNull(current) + Camera2.recentPurposes(kit, s) + kit.purposes.map { it.id })
            .filter { it != "szoba" && kit.purpose(it) != null }.distinct()
        plain.forEach { out += Pick(it) }
        return out
    }

    /** The count shown on the viewfinder: photos of [purpose] in the survey (and of its item, when there is one). */
    fun count(s: Sketch, purpose: String, shot: String? = null): Int =
        s.captures.count { it.kind == CaptureKind.PHOTO && it.purpose == purpose && (shot == null || it.shot == shot) }

    // ---- the series (D-104) -------------------------------------------------------------------------------------------

    /**
     * The open camera's state: what the next shot is for ([purpose], [shot] item, [room], [pairOf] = the before-photo
     * it will be paired with) and the capture ids taken since it opened, the last one last.
     */
    data class Series(
        val purpose: String,
        val shot: String? = null,
        val room: String? = null,
        val pairOf: String? = null,
        val taken: List<String> = emptyList(),
    ) {
        val last get() = taken.lastOrNull()
        val size get() = taken.size
    }

    /** A shot of capture [id] is in: the pair is done (the ghost goes), and a now-complete item moves on (D-104). */
    fun took(kit: Kit, s: Sketch, at: Series, id: String): Series {
        val item = kit.shot(at.shot)
        val nextShot = if (item == null) at.shot else {
            val states = FieldKit.shots(kit, s)
            val done = states.firstOrNull { it.item.id == item.id }?.done ?: true
            if (!done) at.shot
            else states.firstOrNull { !it.done && it.item.purpose == at.purpose && it.item.room == null }?.item?.id
        }
        return at.copy(shot = nextShot, pairOf = null, taken = at.taken + id)
    }

    /** ↶: the last shot is taken back (its id, to delete), the series without it. */
    fun undo(at: Series): Pair<Series, String?> =
        if (at.taken.isEmpty()) at to null else at.copy(taken = at.taken.dropLast(1)) to at.taken.last()

    /** The purpose (and item) picked on the strip; a pick drops a pending pair unless it keeps the purpose. */
    fun pick(at: Series, p: Pick): Series = at.copy(purpose = p.purpose, shot = p.shot,
        pairOf = at.pairOf.takeIf { p.purpose == at.purpose })

    /** Does the camera stay open after a shot? With the series switch on, or Sorozat (M29) on; never for Fotópont. */
    fun staysOpen(seriesOn: Boolean, sorozat: Boolean, photoPoint: Boolean) = !photoPoint && (seriesOn || sorozat)

    // ---- the ghost overlay (D-105) ------------------------------------------------------------------------------------

    /** The before-photo shown over the preview: the one asked for ([Series.pairOf]), if it is still a photo. */
    fun ghost(s: Sketch, at: Series): Capture? =
        s.capture(at.pairOf)?.takeIf { it.kind == CaptureKind.PHOTO }

    /** Befores still waiting for their after, of [purpose]; the same [room] first, then the newest. */
    fun ghostCandidates(s: Sketch, purpose: String, room: String?): List<Capture> =
        Camera2.waiting(s).filter { it.kind == CaptureKind.PHOTO && it.purpose == purpose }
            .sortedWith(compareBy<Capture>({ if (room != null && it.room == room) 0 else 1 }, { -it.at }))

    const val GHOST_DEFAULT = 0.4f
    const val GHOST_MAX = 0.8f
    fun ghostAlpha(v: Float) = v.coerceIn(0f, GHOST_MAX)

    // ---- the level (D-106) ----------------------------------------------------------------------------------------------

    /**
     * What the gravity sensor says, for a phone held in front of the user. [roll] = how far the picture's horizon is
     * off, in degrees, from the nearest of the four ways up ([quarter]: 0 = portrait, 90 = turned left (landscape),
     * 180 = upside down, 270 = turned right); [pitch] = how far the camera looks down (+) or up (−) from the horizon;
     * [flat] = the phone lies nearly flat (pointing at the floor or the ceiling), where the roll means nothing and the
     * level shows a bubble instead.
     */
    data class Level(val roll: Double, val quarter: Int, val pitch: Double, val flat: Boolean) {
        /** Within [tol] degrees: the line turns green. */
        fun level(tol: Double = 1.0) = if (flat) abs(pitch) >= 90 - tol else abs(roll) <= tol
    }

    /**
     * Android's gravity vector (x right, y up the screen, z out of the screen, m/s²) → the level. Portrait upright:
     * (0, 9.8, 0) → roll 0, quarter 0, pitch 0.
     */
    fun level(gx: Double, gy: Double, gz: Double): Level {
        val g = sqrt(gx * gx + gy * gy + gz * gz)
        if (g < 1e-6) return Level(0.0, 0, 0.0, false)
        val inPlane = hypot(gx, gy)
        // pitch: the camera (−z) looks down when gravity has a component out of the screen's back... z > 0 = screen up
        val pitch = Math.toDegrees(atan2(gz, inPlane))
        val flat = inPlane / g < 0.26          // within ~15° of flat
        // the screen's "up" against gravity, clockwise: 0 = portrait upright
        var a = Math.toDegrees(atan2(gx, gy))
        if (a < 0) a += 360.0
        val q = ((a / 90.0).roundToInt() % 4) * 90
        var roll = a - q
        if (roll > 180) roll -= 360.0
        if (roll < -180) roll += 360.0
        return Level(roll, q, pitch, flat)
    }

    /** A low-pass step for the sensor's jitter: [alpha] of the new reading. */
    fun smooth(prev: DoubleArray?, next: DoubleArray, alpha: Double = 0.15): DoubleArray =
        if (prev == null || prev.size != next.size) next.copyOf() else DoubleArray(next.size) { prev[it] + alpha * (next[it] - prev[it]) }

    // ---- the grid -----------------------------------------------------------------------------------------------------------

    /** The rule-of-thirds lines, in 0..1 of the frame. */
    val GRID = listOf(1.0 / 3, 2.0 / 3)

    // ---- zoom ------------------------------------------------------------------------------------------------------------------

    /** A pinch's zoom factor applied to [ratio], kept inside what the camera can do. */
    fun zoom(ratio: Float, pinch: Float, min: Float, max: Float): Float =
        (ratio * pinch).coerceIn(min.coerceAtMost(max), max.coerceAtLeast(min))
}
