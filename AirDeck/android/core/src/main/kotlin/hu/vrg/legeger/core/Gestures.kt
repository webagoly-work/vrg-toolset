package hu.vrg.legeger.core

import kotlin.math.abs
import kotlin.math.ln
import kotlin.math.min

// Screen gestures on the touchpad, for every mode. The pad itself keeps doing what it does with one
// and two fingers (mouse, camera or touchscreen); three and four fingers, and swipes in from the
// edge strips, are commands — the same vocabulary a Windows precision touchpad or a phone teaches.

enum class PadGesture(val label: String) {
    SWIPE3_LEFT("3 ujj ←"), SWIPE3_RIGHT("3 ujj →"), SWIPE3_UP("3 ujj ↑"), SWIPE3_DOWN("3 ujj ↓"), TAP3("3 ujj koppint"),
    SWIPE4_LEFT("4 ujj ←"), SWIPE4_RIGHT("4 ujj →"), SWIPE4_UP("4 ujj ↑"), SWIPE4_DOWN("4 ujj ↓"), TAP4("4 ujj koppint"),
    EDGE_LEFT("bal szélről be"), EDGE_RIGHT("jobb szélről be"),
}

object GestureClassifier {
    /** Width of each edge strip, as a share of the pad's width. */
    const val EDGE = 0.07f

    /**
     * A finished multi-finger gesture. dx, dy = how far the centroid travelled (px); travel = the
     * total path, so a wobbly tap is still a tap; padW, padH = the pad size (px).
     */
    fun multi(fingers: Int, dx: Float, dy: Float, travel: Float, durMs: Long, padW: Float, padH: Float): PadGesture? {
        if (fingers < 3) return null
        val four = fingers >= 4
        if (travel < 24f && durMs < 350) return if (four) PadGesture.TAP4 else PadGesture.TAP3
        val need = 0.16f * min(padW, padH)
        val ax = abs(dx)
        val ay = abs(dy)
        return when {
            ax >= need && ax > ay * 1.3f ->
                if (dx < 0) (if (four) PadGesture.SWIPE4_LEFT else PadGesture.SWIPE3_LEFT)
                else (if (four) PadGesture.SWIPE4_RIGHT else PadGesture.SWIPE3_RIGHT)
            ay >= need && ay > ax * 1.3f ->
                if (dy < 0) (if (four) PadGesture.SWIPE4_UP else PadGesture.SWIPE3_UP)
                else (if (four) PadGesture.SWIPE4_DOWN else PadGesture.SWIPE3_DOWN)
            else -> null
        }
    }

    /** True when a one-finger touch starting at startX belongs to an edge strip. */
    fun inEdge(startX: Float, padW: Float): Boolean = startX < padW * EDGE || startX > padW * (1 - EDGE)

    /** A one-finger touch that started in an edge strip: a gesture once it has come far enough in. */
    fun edge(startX: Float, dx: Float, dy: Float, padW: Float): PadGesture? {
        val inward = 0.22f * padW
        return when {
            startX < padW * EDGE && dx > inward && dx > abs(dy) -> PadGesture.EDGE_LEFT
            startX > padW * (1 - EDGE) && -dx > inward && -dx > abs(dy) -> PadGesture.EDGE_RIGHT
            else -> null
        }
    }
}

/** Pinch on the mouse pad as Ctrl+wheel zoom: one notch for every `step` of scale (12 % by default). */
class PinchZoom(var step: Float = 0.12f) {
    private var acc = 0.0

    fun reset() { acc = 0.0 }

    /** scale = this frame's span ratio; returns wheel notches (+ = zoom in). */
    fun step(scale: Float): Int {
        if (scale <= 0f) return 0
        acc += ln(scale.toDouble())
        val unit = ln(1.0 + step)
        var n = 0
        while (acc >= unit) { acc -= unit; n++ }
        while (acc <= -unit) { acc += unit; n-- }
        return n
    }
}
