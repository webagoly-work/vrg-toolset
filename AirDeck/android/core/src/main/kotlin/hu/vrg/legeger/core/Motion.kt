package hu.vrg.legeger.core

import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max

// Gyro maths, free of Android. Inputs are the raw gyroscope rates in DEVICE axes (rad/s):
//   x — across the screen, left to right     (pitch: the top edge rising is +x)
//   y — along the screen, bottom to top      (roll:  the right edge dropping is +y)
//   z — out of the screen, towards the face  (yaw:   turning left, seen from above, is +z)
// The grip is a TV remote's: screen up, top edge pointing at the monitor.

data class AirTuning(
    /** Pixels per radian at low speed. */
    val speed: Float = 900f,
    /** How much faster a fast swing travels: gain = speed · (1 + accel · |ω|). */
    val accel: Float = 0.6f,
    /** Rates below this (rad/s) are hand tremor and are dropped. */
    val deadzone: Float = 0.035f,
    /** 0 = raw, 0.9 = very smooth and laggy. */
    val smoothing: Float = 0.35f,
    val invertY: Boolean = false,
)

/** Turns gyro rates into HID mouse deltas. Keeps the sub-pixel remainder so slow aiming still moves. */
class AirPointer(var tuning: AirTuning = AirTuning()) {
    private var fx = 0f
    private var fy = 0f
    private var accX = 0f
    private var accY = 0f

    fun reset() { fx = 0f; fy = 0f; accX = 0f; accY = 0f }

    /** Returns the (dx, dy) to send now; both 0 when the hand is still. */
    fun step(gx: Float, gy: Float, gz: Float, dt: Float): Pair<Int, Int> {
        val t = tuning
        val a = 1f - t.smoothing.coerceIn(0f, 0.95f)
        fx += (-gz - fx) * a
        fy += ((if (t.invertY) gx else -gx) - fy) * a

        val mag = hypot(fx, fy)
        if (mag < t.deadzone) { accX = 0f; accY = 0f; return 0 to 0 }
        val soft = (mag - t.deadzone) / mag                 // no step at the deadzone edge
        val gain = t.speed * (1f + t.accel * mag) * soft
        val d = dt.coerceIn(0f, 0.05f)                      // a stalled sensor must not fling the cursor
        accX += fx * gain * d
        accY += fy * gain * d
        val dx = accX.toInt().coerceIn(-127, 127)
        val dy = accY.toInt().coerceIn(-127, 127)
        accX -= dx; accY -= dy
        return dx to dy
    }
}

enum class Flick { LEFT, RIGHT, UP, DOWN }

/** A sharp wrist flick, as a command. One axis must clearly dominate, and then it stays quiet for a while. */
class FlickDetector(var threshold: Float = 7f, var refractoryMs: Long = 450) {
    private var quietUntil = 0L

    fun step(gx: Float, gz: Float, nowMs: Long): Flick? {
        if (nowMs < quietUntil) return null
        val ax = abs(gx)
        val az = abs(gz)
        val f = when {
            az > threshold && az > ax * 1.6f -> if (gz > 0) Flick.LEFT else Flick.RIGHT
            ax > threshold && ax > az * 1.6f -> if (gx > 0) Flick.UP else Flick.DOWN
            else -> null
        }
        if (f != null) quietUntil = nowMs + refractoryMs
        return f
    }
}

/** Tilt-to-scrub: while held, every `stepRad` of roll is one step (+1 rolling right, −1 rolling left). */
class Scrubber(var stepRad: Float = 0.22f) {
    private var acc = 0f

    fun reset() { acc = 0f }

    fun step(gy: Float, dt: Float): Int {
        acc += gy * dt.coerceIn(0f, 0.05f)
        var n = 0
        while (acc >= stepRad) { acc -= stepRad; n++ }
        while (acc <= -stepRad) { acc += stepRad; n-- }
        return n
    }
}

/** Two-finger scroll on the touchpad: pixels in, wheel notches out. */
class WheelAccumulator(var pxPerNotch: Float = 28f) {
    private var acc = 0f
    fun reset() { acc = 0f }
    fun step(dyPx: Float): Int {
        acc += dyPx
        val n = (acc / pxPerNotch).toInt()
        acc -= n * pxPerNotch
        return n
    }
}

/** Rate limiter for anything sent at sensor speed: true when at least `periodMs` has passed. */
class Throttle(private val periodMs: Long) {
    private var last = Long.MIN_VALUE / 2
    fun ready(nowMs: Long): Boolean {
        if (nowMs - last < periodMs) return false
        last = nowMs
        return true
    }
}

/** Orientation for the app cameras, in the old phone page's convention (pitch 5..90, yaw 0..360). */
object Pose {
    /**
     * `pitchRad` and `azimuthRad` as SensorManager.getOrientation gives them. Flat on the table is
     * pitch 90 (looking straight down); held upright it drops towards 5.
     */
    fun fromAndroid(pitchRad: Float, azimuthRad: Float): Pair<Double, Double> {
        val beta = -Math.toDegrees(pitchRad.toDouble())          // the DeviceOrientation β
        val pitch = (90.0 - abs(beta)).coerceIn(5.0, 90.0)
        val alpha = 360.0 - Math.toDegrees(azimuthRad.toDouble())  // α runs counter-clockwise
        val yaw = ((alpha % 360.0) + 360.0) % 360.0
        return pitch to max(0.0, yaw)
    }
}
