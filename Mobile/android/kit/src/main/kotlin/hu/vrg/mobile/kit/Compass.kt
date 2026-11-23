package hu.vrg.mobile.kit

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.view.Surface
import android.view.WindowManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin

// Compass (WP M66): the way the phone faces, for the radar's "Irány fel" and for Irány keresése. The rotation-vector
// sensor (gyro + accelerometer + magnetometer fused by Android), remapped for the screen's rotation, smoothed on the
// circle so 359° → 1° does not swing through 180°. Shared, reference-counted: every radar on screen calls start /
// stop; the sensor runs only while one is visible. Null when the phone has no such sensor (the radar then shows north up).

object Compass {
    private val _heading = MutableStateFlow<Double?>(null)
    val heading: StateFlow<Double?> get() = _heading
    private var users = 0
    private var sm: SensorManager? = null
    private var sx = 0.0
    private var sy = 0.0
    private var rotation = Surface.ROTATION_0

    private val listener = object : SensorEventListener {
        private val m = FloatArray(9)
        private val r = FloatArray(9)
        private val o = FloatArray(3)
        override fun onSensorChanged(e: SensorEvent) {
            SensorManager.getRotationMatrixFromVector(m, e.values)
            val (ax, ay) = when (rotation) {
                Surface.ROTATION_90 -> SensorManager.AXIS_Y to SensorManager.AXIS_MINUS_X
                Surface.ROTATION_180 -> SensorManager.AXIS_MINUS_X to SensorManager.AXIS_MINUS_Y
                Surface.ROTATION_270 -> SensorManager.AXIS_MINUS_Y to SensorManager.AXIS_X
                else -> SensorManager.AXIS_X to SensorManager.AXIS_Y
            }
            SensorManager.remapCoordinateSystem(m, ax, ay, r)
            SensorManager.getOrientation(r, o)
            val az = o[0].toDouble()                                 // radians, 0 = magnetic north
            // circular low-pass: average the unit vectors, not the angles
            sx = sx * 0.85 + sin(az) * 0.15
            sy = sy * 0.85 + cos(az) * 0.15
            val deg = (atan2(sx, sy) * 180 / PI + 360) % 360
            _heading.value = deg
        }
        override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
    }

    @Synchronized fun start(ctx: Context) {
        users++
        if (users > 1) return
        val s = ctx.applicationContext.getSystemService(SensorManager::class.java) ?: return
        val sensor = s.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR) ?: s.getDefaultSensor(Sensor.TYPE_GEOMAGNETIC_ROTATION_VECTOR) ?: return
        @Suppress("DEPRECATION")
        rotation = runCatching { (ctx.getSystemService(Context.WINDOW_SERVICE) as WindowManager).defaultDisplay.rotation }.getOrDefault(Surface.ROTATION_0)
        sm = s
        s.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_UI)
    }

    @Synchronized fun stop() {
        if (users == 0) return
        users--
        if (users > 0) return
        sm?.unregisterListener(listener)
        sm = null
        _heading.value = null
        sx = 0.0; sy = 0.0
    }
}
