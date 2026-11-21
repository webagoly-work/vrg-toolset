package hu.vrg.mobile.sketch

import org.json.JSONObject
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.roundToLong
import kotlin.math.sin

// F4 (WP M49): a variant tunes how the drawing tools behave, not only their order. The Founder (M31): "the agent
// rewrites and finetunes some elements of the drawing tools so that the desired shape could be sketched up easily".
// A variant's optional `draw` block (Sketcher/variants/PROTOCOL.md):
//
//   snapAngle     deg     the Vonal tool's segments turn in steps of this (90 = only along the axes, 45 = also the
//                         diagonals); 0 / missing = the original: an axis lock within 12°, free otherwise
//   snapGrid      m       corners (Szoba, Sablon, Vonal, moving a corner) land on a grid this coarse, unless they
//                         already snap to another room's corner line; 0 / missing = no grid
//   defaultRoom   {w, d}  m: a TAP with the Szoba tool lays a room of this size (centred on the tap); without it a tap
//                         only explains the drag, as before
//   measureFirst  bool    a new room opens its size dialog at once
//   pointSnap     wall | free   wall (default): a point near a wall sits on it; free: points stay where they are put
//                         (devices on hall columns, ceiling grids)
//
// Metres become sketch units through the sketch's current scale (the Solver's mm per unit on each axis), so a grid
// stays a real 1 m grid after the first measure. Everything here is pure and tested (DrawTuneTest); the editor only
// calls it. The Desktop page does not draw; it validates the block (fieldkit.js validateVariant) and shows it.
data class DrawTune(
    val snapAngle: Int = 0,
    val snapGrid: Double = 0.0,
    val defaultRoom: Pair<Double, Double>? = null,
    val measureFirst: Boolean = false,
    val freePoints: Boolean = false,
) {
    val isDefault get() = this == DrawTune()

    /** One line per tuning, Hungarian, for the variant list and the hint. */
    fun describe(): List<String> = listOfNotNull(
        if (snapAngle > 0) "Vonal: ${snapAngle}°-os lépés" else null,
        if (snapGrid > 0) "Rács: ${fmt(snapGrid)} m" else null,
        defaultRoom?.let { "Koppintás = ${fmt(it.first)} × ${fmt(it.second)} m szoba" },
        if (measureFirst) "Új szoba: rögtön a méret" else null,
        if (freePoints) "Pont: nem ugrik a falra" else null,
    )

    private fun fmt(v: Double) = if (v == floor(v)) v.toLong().toString() else v.toString().replace('.', ',')
}

object Draw {
    val ANGLES = setOf(0, 15, 30, 45, 90)
    const val MAX_GRID_M = 10.0
    const val MAX_ROOM_M = 200.0

    /** The variant's `draw` block; anything out of range falls back to the original behaviour. */
    fun parse(o: JSONObject?): DrawTune {
        if (o == null) return DrawTune()
        val a = o.optInt("snapAngle", 0).takeIf { it in ANGLES } ?: 0
        val g = o.optDouble("snapGrid", 0.0).takeIf { !it.isNaN() && it > 0 && it <= MAX_GRID_M } ?: 0.0
        val r = o.optJSONObject("defaultRoom")?.let { j ->
            val w = j.optDouble("w", 0.0); val d = j.optDouble("d", 0.0)
            if (w > 0 && d > 0 && w <= MAX_ROOM_M && d <= MAX_ROOM_M) w to d else null
        }
        return DrawTune(a, g, r, o.optBoolean("measureFirst"), o.optString("pointSnap") == "free")
    }

    /** The Vonal tool's next corner from [prev]: the original axis lock, or the direction turned to a step of snapAngle. */
    fun lock(prev: Pt, p: Pt, t: DrawTune): Pt {
        if (t.snapAngle <= 0) return Geo.axisLock(prev, p)
        val dx = p.x - prev.x; val dy = p.y - prev.y
        if (dx == 0.0 && dy == 0.0) return p
        val step = t.snapAngle * PI / 180
        val ang = Math.round(atan2(dy, dx) / step) * step
        val ux = cos(ang); val uy = sin(ang)
        val len = dx * ux + dy * uy                 // the finger's reach along the snapped direction
        return Pt(prev.x + clean(ux) * len, prev.y + clean(uy) * len)
    }

    private fun clean(v: Double) = if (abs(v) < 1e-9) 0.0 else v

    /** The grid in sketch units on x and y for [scaleX] / [scaleY] mm per unit; 0 = none. */
    fun grid(t: DrawTune, scaleX: Double, scaleY: Double): Pair<Double, Double> =
        if (t.snapGrid <= 0 || scaleX <= 0 || scaleY <= 0) 0.0 to 0.0 else t.snapGrid * 1000 / scaleX to t.snapGrid * 1000 / scaleY

    private fun round(v: Double, g: Double) = if (g <= 0) v else (v / g).roundToLong() * g

    /**
     * A corner: first onto another room's corner line (Ops.snapAxes, so neighbours share a wall), and on an axis that
     * found none, onto the grid.
     */
    fun corner(s: Sketch, p: Pt, tol: Double, t: DrawTune, scaleX: Double, scaleY: Double, skip: String? = null): Pt {
        val q = Ops.snapAxes(s, p, tol, skip)
        val (gx, gy) = grid(t, scaleX, scaleY)
        return Pt(if (q.x != p.x) q.x else round(p.x, gx), if (q.y != p.y) q.y else round(p.y, gy))
    }

    /** The box a tap lays with the Szoba tool (defaultRoom centred on the tap, its corner on the grid); null = no tap room. */
    fun tapRoom(s: Sketch, at: Pt, tol: Double, t: DrawTune, scaleX: Double, scaleY: Double): Pair<Pt, Pt>? {
        val (w, d) = t.defaultRoom ?: return null
        if (scaleX <= 0 || scaleY <= 0) return null
        val wu = w * 1000 / scaleX; val du = d * 1000 / scaleY
        val a = corner(s, Pt(at.x - wu / 2, at.y - du / 2), tol, t, scaleX, scaleY)
        return a to Pt(a.x + wu, a.y + du)
    }

    /** How close to a wall a point has to be to sit on it. */
    fun pointTol(t: DrawTune, tol: Double) = if (t.freePoints) 0.0 else tol
}
