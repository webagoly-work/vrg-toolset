package hu.vrg.mobile.pager

import kotlin.math.sqrt

// The two watchers of the pager's GUARD and the MPU6050 man-down module, with the phone's accelerometer as the
// sensor. Both are plain state machines fed with readings and the time, so the tests drive them sample by sample.

/** One accelerometer reading in m/s², gravity included (Android's TYPE_ACCELEROMETER). */
data class Accel(val x: Float, val y: Float, val z: Float) {
    val g: Double get() = sqrt((x * x + y * y + z * z).toDouble()) / 9.80665
}

/**
 * Motion out of raw readings: the deviation from the slow-moving gravity vector. A phone lying on a board door reads
 * < 0.02 g; picking it up reads > 0.15 g; a fall's impact reads > 2.5 g total.
 */
class MotionMeter(private val alpha: Float = 0.08f) {
    private var gx = 0f; private var gy = 0f; private var gz = 0f
    private var primed = false
    var lastDeviation = 0.0; private set
    /** Angle-free tilt measure: the gravity vector's change since [anchor] (0 = same pose, 2 = upside down). */
    private var ax = 0f; private var ay = 0f; private var az = 0f

    /** Forget the gravity estimate; the next reading primes it again (after a fall, the pose has changed). */
    fun reset() { primed = false }

    fun add(a: Accel): Double {
        if (!primed) { gx = a.x; gy = a.y; gz = a.z; primed = true }
        gx += alpha * (a.x - gx); gy += alpha * (a.y - gy); gz += alpha * (a.z - gz)
        val dx = a.x - gx; val dy = a.y - gy; val dz = a.z - gz
        lastDeviation = sqrt((dx * dx + dy * dy + dz * dz).toDouble()) / 9.80665
        return lastDeviation
    }

    fun anchor() { ax = gx; ay = gy; az = gz }

    fun tilt(): Double {
        val n1 = sqrt((ax * ax + ay * ay + az * az).toDouble()); val n2 = sqrt((gx * gx + gy * gy + gz * gz).toDouble())
        if (n1 < 1 || n2 < 1) return 0.0
        return 1.0 - (ax * gx + ay * gy + az * gz) / (n1 * n2)
    }
}

enum class GuardState(val code: Int, val hu: String) {
    OFF(0, "kikapcsolva"),
    EXIT(1, "élesítés…"),
    ARMED(2, "élesítve"),
    ENTRY(3, "riasztás előtt"),
    ALARM(4, "RIASZT"),
}

/**
 * Őrzés (GUARD): the phone left on the toolbox or the board door. As on the pager: arm only while the "loop" is
 * closed (here: lying still), an exit delay (5 / 15 / 30 s, default 15), then ARMED; any motion or tilt starts a 5 s
 * entry delay, then ALARM — siren, and an ALARM page to the crew every 2 s until one is acknowledged, then every
 * 30 s. Disarm on the phone (unless partner-only disarm is on) or from a crew member's phone.
 */
class Guard {
    var state = GuardState.OFF; private set
    var reason: AlarmReason = AlarmReason.MOTION; private set
    var exitDelayS = 15
    var partnerOnlyDisarm = false
    private var until = 0L
    private var nextPage = 0L
    private var acked = false
    private val meter = MotionMeter()
    private var stillSince = 0L

    sealed class Out {
        data class State(val s: GuardState) : Out()
        data class Page(val reason: AlarmReason) : Out()
        data object Chirp : Out()
        data class Refused(val why: String) : Out()
    }

    fun still(now: Long) = stillSince != 0L && now - stillSince >= 1_500

    fun arm(now: Long): List<Out> {
        if (state != GuardState.OFF) return emptyList()
        if (!still(now)) return listOf(Out.Refused("Nem élesíthető: tedd le a telefont, és ne mozdítsd."))
        state = GuardState.EXIT; until = now + exitDelayS * 1_000L
        return listOf(Out.State(state))
    }

    /** [byPartner] = a disarm command from a crew member's phone (HUBCMD target 4). */
    fun disarm(byPartner: Boolean): List<Out> {
        if (state == GuardState.OFF) return emptyList()
        if (partnerOnlyDisarm && !byPartner) return listOf(Out.Refused("Csak a társ telefonja kapcsolhatja ki (társ-kikapcsolás)."))
        state = GuardState.OFF; acked = false
        return listOf(Out.State(state))
    }

    fun acknowledged() { acked = true }

    fun sample(a: Accel, now: Long): List<Out> {
        val dev = meter.add(a)
        if (dev < 0.05) { if (stillSince == 0L) stillSince = now } else stillSince = 0L
        if (state == GuardState.ARMED) {
            val tilted = meter.tilt() > 0.04          // ~16° away from the armed pose
            if (dev > 0.15 || tilted) {
                reason = if (dev > 0.15) AlarmReason.MOTION else AlarmReason.TILT
                state = GuardState.ENTRY; until = now + ENTRY_MS
                return listOf(Out.State(state))
            }
        }
        return emptyList()
    }

    fun tick(now: Long): List<Out> {
        when (state) {
            GuardState.EXIT -> if (now >= until) {
                if (!still(now)) { state = GuardState.OFF; return listOf(Out.Refused("Elmozdult az élesítés alatt: nincs élesítve."), Out.State(state)) }
                meter.anchor(); state = GuardState.ARMED
                return listOf(Out.State(state))
            } else return listOf(Out.Chirp)
            GuardState.ENTRY -> if (now >= until) {
                state = GuardState.ALARM; nextPage = now; acked = false
                return listOf(Out.State(state)) + tick(now)
            } else return listOf(Out.Chirp)
            GuardState.ALARM -> if (now >= nextPage) {
                nextPage = now + if (acked) 30_000 else 2_000
                return listOf(Out.Page(reason))
            }
            else -> {}
        }
        return emptyList()
    }

    companion object { const val ENTRY_MS = 5_000L }
}

enum class ManDownState { OFF, WATCHING, PRE_ALARM, ALARM }

/**
 * Mozdulatlanság (man-down), the MPU6050 module's job: an impact over 2.5 g followed by stillness, or no movement
 * at all for [stillLimitS], starts a pre-alarm on this phone (loud, [preAlarmS] seconds). SEEN cancels it; otherwise
 * the crew gets ALARM "mozdulatlan / elesett", repeated like the guard's. A helper for a crew that works apart, not a
 * certified lone-worker device: the screen says so.
 */
class ManDown {
    var state = ManDownState.OFF; private set
    var stillLimitS = 90
    var preAlarmS = 25
    private val meter = MotionMeter()
    private var lastMove = 0L
    private var impactAt = 0L
    private var settled = true
    private var preUntil = 0L
    private var nextPage = 0L
    private var acked = false

    sealed class Out {
        data class State(val s: ManDownState) : Out()
        data class Countdown(val secondsLeft: Int) : Out()
        data object Page : Out()
    }

    fun start(now: Long): List<Out> { state = ManDownState.WATCHING; lastMove = now; impactAt = 0; return listOf(Out.State(state)) }
    fun stop(): List<Out> { state = ManDownState.OFF; return listOf(Out.State(state)) }

    /** SEEN on this phone: "I am fine". */
    fun cancel(now: Long): List<Out> {
        if (state != ManDownState.PRE_ALARM && state != ManDownState.ALARM) return emptyList()
        state = ManDownState.WATCHING; lastMove = now; impactAt = 0; acked = false
        return listOf(Out.State(state))
    }

    fun acknowledged() { acked = true }

    fun sample(a: Accel, now: Long): List<Out> {
        if (state == ManDownState.OFF) return emptyList()
        if (a.g > 2.5) { impactAt = now; settled = false }
        val dev = meter.add(a)
        // the gravity filter is still swinging after an impact: start it afresh in the new pose
        if (impactAt != 0L && !settled) {
            if (now - impactAt > 1_500) { meter.reset(); meter.add(a); settled = true }
            return emptyList()
        }
        if (dev > 0.12) {
            lastMove = now
            if (state == ManDownState.PRE_ALARM) return cancel(now)      // moving again: the person is up
        }
        return emptyList()
    }

    fun tick(now: Long): List<Out> {
        when (state) {
            ManDownState.WATCHING -> {
                val afterImpact = impactAt != 0L && now - impactAt > 10_000 && lastMove < impactAt
                if (afterImpact || now - lastMove > stillLimitS * 1_000L) {
                    state = ManDownState.PRE_ALARM; preUntil = now + preAlarmS * 1_000L
                    return listOf(Out.State(state), Out.Countdown(preAlarmS))
                }
            }
            ManDownState.PRE_ALARM -> {
                if (now >= preUntil) { state = ManDownState.ALARM; nextPage = now; acked = false; return listOf(Out.State(state)) + tick(now) }
                return listOf(Out.Countdown(((preUntil - now + 999) / 1_000).toInt()))
            }
            ManDownState.ALARM -> if (now >= nextPage) { nextPage = now + if (acked) 30_000 else 2_000; return listOf(Out.Page) }
            ManDownState.OFF -> {}
        }
        return emptyList()
    }
}
