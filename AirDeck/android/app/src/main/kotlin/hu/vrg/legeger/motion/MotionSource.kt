package hu.vrg.legeger.motion

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager

// Two sensor feeds, each on only while something uses it (both cost battery):
//   gyro — raw angular rate, for the pointer, flicks and scrubbing. Relative motion is exactly what
//          an air mouse wants, and the raw gyro has no magnetometer lag.
//   pose — GAME_ROTATION_VECTOR, for the app cameras (absolute pitch / yaw, compass-free so a steel
//          desk or a speaker magnet does not swing it).

class MotionSource(ctx: Context) : SensorEventListener {
    private val sm = ctx.getSystemService(SensorManager::class.java)
    private val gyro: Sensor? = sm?.getDefaultSensor(Sensor.TYPE_GYROSCOPE)
    private val rotation: Sensor? = sm?.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR)

    val hasGyro: Boolean get() = gyro != null
    val hasPose: Boolean get() = rotation != null

    /** gx, gy, gz in rad/s (device axes), dt in seconds, now in ms. Sensor thread. */
    var onGyro: (gx: Float, gy: Float, gz: Float, dt: Float, nowMs: Long) -> Unit = { _, _, _, _, _ -> }
    /** pitch and azimuth in radians, as SensorManager.getOrientation gives them. Sensor thread. */
    var onPose: (pitch: Float, azimuth: Float, nowMs: Long) -> Unit = { _, _, _ -> }

    private var gyroOn = false
    private var poseOn = false
    private var lastNs = 0L
    private val rot = FloatArray(9)
    private val ori = FloatArray(3)

    fun gyro(on: Boolean) {
        if (on == gyroOn || gyro == null) return
        gyroOn = on
        lastNs = 0L
        if (on) sm?.registerListener(this, gyro, SensorManager.SENSOR_DELAY_GAME)
        else sm?.unregisterListener(this, gyro)
    }

    fun pose(on: Boolean) {
        if (on == poseOn || rotation == null) return
        poseOn = on
        if (on) sm?.registerListener(this, rotation, SensorManager.SENSOR_DELAY_GAME)
        else sm?.unregisterListener(this, rotation)
    }

    fun stopAll() { gyro(false); pose(false) }

    override fun onSensorChanged(e: SensorEvent) {
        val now = e.timestamp / 1_000_000L
        when (e.sensor.type) {
            Sensor.TYPE_GYROSCOPE -> {
                val dt = if (lastNs == 0L) 0f else (e.timestamp - lastNs) / 1e9f
                lastNs = e.timestamp
                onGyro(e.values[0], e.values[1], e.values[2], dt, now)
            }
            Sensor.TYPE_GAME_ROTATION_VECTOR -> {
                SensorManager.getRotationMatrixFromVector(rot, e.values)
                SensorManager.getOrientation(rot, ori)
                onPose(ori[1], ori[0], now)
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
}
