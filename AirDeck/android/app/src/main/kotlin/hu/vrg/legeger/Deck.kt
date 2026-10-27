package hu.vrg.legeger

import android.annotation.SuppressLint
import android.content.Context
import android.os.VibrationEffect
import android.os.Vibrator
import hu.vrg.legeger.core.AirPointer
import hu.vrg.legeger.core.Flick
import hu.vrg.legeger.core.FlickDetector
import hu.vrg.legeger.core.Hid
import hu.vrg.legeger.core.Keys
import hu.vrg.legeger.core.Layouts
import hu.vrg.legeger.core.Pose
import hu.vrg.legeger.core.Profile
import hu.vrg.legeger.core.Profiles
import hu.vrg.legeger.core.Scrubber
import hu.vrg.legeger.core.Send
import hu.vrg.legeger.core.Target
import hu.vrg.legeger.core.Throttle
import hu.vrg.legeger.hid.HidPeripheral
import hu.vrg.legeger.motion.MotionSource
import hu.vrg.legeger.relay.RelayClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

// The one place where the three inputs meet the two outputs.
//
//   inputs   gyro (pointer · flicks · scrub · camera pose), touch (pad · buttons), volume keys
//   outputs  Bluetooth HID (any computer, no software) · relay (Planner / Kódváros, app-aware)
//
// Layer 1 (universal) works with Bluetooth alone; layer 2 (app-aware) needs the relay. Neither needs
// the other, so a phone without the HID Device profile is still a full Planner / Kódváros controller,
// and a laptop without the relay still gets a mouse.

object Deck {
    lateinit var app: Context; private set
    lateinit var settings: SettingsStore; private set
    lateinit var hid: HidPeripheral; private set
    lateinit var relay: RelayClient; private set
    lateinit var motion: MotionSource; private set

    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    // ---- what the phone is aimed at --------------------------------------------------------------

    /** null = follow the PC's focus; otherwise a target the user pinned. */
    val pinned = MutableStateFlow<Target?>(null)
    lateinit var target: StateFlow<Target>; private set
    val profile: Profile get() = Profiles.of(target.value)

    // ---- live controls ---------------------------------------------------------------------------

    /** The clutch: the cursor follows the phone only while this is held (or latched). */
    val clutch = MutableStateFlow(false)
    val clutchLatched = MutableStateFlow(false)
    /** Gyro -> app camera (the old 🧭 button). */
    val camera = MutableStateFlow(false)
    val scrubbing = MutableStateFlow(false)
    /** Touchpad sends to: false = the PC mouse, true = the app camera. */
    val padToApp = MutableStateFlow(false)
    /** The front screen is showing: sensors run only then. */
    private val foreground = MutableStateFlow(false)

    val notes = MutableSharedFlow<String>(extraBufferCapacity = 8)

    private val pointer = AirPointer()
    private val flicks = FlickDetector()
    private val scrubber = Scrubber()
    private val poseThrottle = Throttle(33)          // ~30 Hz is plenty for a camera (old page's figure)
    private var altTabJob: Job? = null

    fun init(ctx: Context) {
        app = ctx.applicationContext
        settings = SettingsStore(app)
        hid = HidPeripheral(app, scope)
        relay = RelayClient(scope)
        motion = MotionSource(app)

        hid.preferredHost = settings.value.hostAddress
        hid.onHostConnected = { mac ->
            hid.preferredHost = mac
            if (mac != settings.value.hostAddress) settings.update { it.copy(hostAddress = mac) }
            haptic(30)
        }

        target = combine(pinned, relay.focus, relay.hellos, settings.flow) { pin, focus, hellos, s ->
            pin ?: when {
                s.followFocus && focus?.role != null && hellos.containsKey(focus.role) -> Target.fromRole(focus.role)
                hellos.size == 1 -> Target.fromRole(hellos.keys.first())
                else -> Target.GENERAL
            }
        }.stateIn(scope, SharingStarted.Eagerly, Target.GENERAL)

        // The pad follows the target: the mouse in general mode, the app camera once an app is aimed at.
        scope.launch { target.collect { padToApp.value = it != Target.GENERAL } }
        scope.launch { relay.notes.collect { notes.emit(it) } }

        motion.onGyro = ::onGyro
        motion.onPose = ::onPose
        scope.launch { combine(foreground, clutch, clutchLatched, scrubbing, settings.flow) { fg, c, l, sc, s -> fg && (c || l || sc || s.flicks) }
            .collect { motion.gyro(it); if (!it) pointer.reset() } }
        scope.launch { combine(foreground, camera) { fg, cam -> fg && cam }.collect { motion.pose(it) } }

        if (settings.value.relayUrl.isNotEmpty()) relay.connect(settings.value.relayUrl)
    }

    fun setForeground(on: Boolean) { foreground.value = on }

    fun connectRelay(url: String) {
        val u = RelayClient.normalize(url)
        settings.update { it.copy(relayUrl = u) }
        relay.connect(u)
    }

    // ---- gyro ------------------------------------------------------------------------------------

    private fun onGyro(gx: Float, gy: Float, gz: Float, dt: Float, now: Long) {
        val s = settings.value
        if (clutch.value || clutchLatched.value) {
            pointer.tuning = s.tuning
            val (dx, dy) = pointer.step(gx, gy, gz, dt)
            hid.move(dx, dy)
            return
        }
        if (scrubbing.value) {
            val n = scrubber.step(gy, dt)
            val p = profile
            repeat(kotlin.math.abs(n)) { perform(if (n > 0) p.scrubRight else p.scrubLeft, buzz = 6) }
            return
        }
        if (s.flicks) {
            val f = flicks.step(gx, gz, now) ?: return
            perform(profile.flicks[f] ?: return, buzz = 18)
            flickNote(f)
        }
    }

    private fun flickNote(f: Flick) {
        val arrow = when (f) { Flick.LEFT -> "←"; Flick.RIGHT -> "→"; Flick.UP -> "↑"; Flick.DOWN -> "↓" }
        notes.tryEmit("csuklómozdulat $arrow")
    }

    private fun onPose(pitch: Float, azimuth: Float, now: Long) {
        if (!camera.value || !poseThrottle.ready(now)) return
        val (p, y) = Pose.fromAndroid(pitch, azimuth)
        relay.send { it.orientation(p, y, target.value.role) }
    }

    fun setCamera(on: Boolean) {
        if (on && !relay.isOpen) { notes.tryEmit("A kamerához relé kell (⚙ → Relé)."); return }
        camera.value = on
        if (!on) relay.send { it.orientationOff(target.value.role) }
    }

    fun setScrub(on: Boolean) {
        scrubber.reset()
        scrubbing.value = on
    }

    // ---- actions ---------------------------------------------------------------------------------

    /** Runs one action. Returns false (and says why) when its channel is down. */
    fun perform(send: Send, buzz: Long = 8): Boolean {
        val to = target.value.role
        val ok = when (send) {
            is Send.Cmd -> relayOr { it.cmd(send.id, to, send.extra) }
            is Send.AppKey -> relayOr { it.keys(send.key, send.ctrl, send.shift, send.alt, to) }
            is Send.Gesture -> relayOr { if (send.kind == "reset") it.reset(to) else it.orbit(0.0, 0.0, to) }
            is Send.Key -> hidOr { Keys.chord(send.spec)?.let { c -> hid.tap(c) } }
            is Send.Media -> hidOr { hid.media(send.usage) }
            is Send.Wheel -> hidOr { hid.wheel(send.notches) }
            is Send.AltTab -> hidOr { altTab() }
            is Send.None -> true
        }
        if (ok) haptic(buzz)
        return ok
    }

    private fun relayOr(build: (hu.vrg.legeger.core.Envelopes) -> String): Boolean {
        if (relay.send(build)) return true
        notes.tryEmit("Nincs relé kapcsolat — ⚙ → Relé")
        return false
    }

    private inline fun hidOr(f: () -> Unit): Boolean {
        if (!hid.connected) { notes.tryEmit("Nincs Bluetooth gép — ⚙ → Bluetooth"); return false }
        f(); return true
    }

    /** Alt stays down between taps, so repeated taps walk the switcher; it lets go 0.9 s after the last. */
    private fun altTab() {
        hid.modsDown(Hid.Mod.LALT)
        hid.chordDown(hu.vrg.legeger.core.Chord(Hid.Mod.LALT, 0x2B))
        hid.modsDown(Hid.Mod.LALT)
        altTabJob?.cancel()
        altTabJob = scope.launch { delay(900); hid.keysUp() }
    }

    fun typeText(text: String) {
        if (!hid.connected) { notes.tryEmit("Nincs Bluetooth gép — ⚙ → Bluetooth"); return }
        hid.type(text, Layouts.byId(settings.value.layout)) { skipped ->
            if (skipped > 0) notes.tryEmit("$skipped karakter nem gépelhető ezzel a kiosztással")
        }
    }

    // ---- touchpad --------------------------------------------------------------------------------

    fun padMove(dx: Float, dy: Float) {
        if (padToApp.value) relay.send { it.zoompan(dx.toDouble(), dy.toDouble(), 1.0, target.value.role) }
        else {
            val k = settings.value.padSpeed
            hid.move((dx * k).toInt(), (dy * k).toInt())
        }
    }

    fun padTwoFinger(dx: Float, dy: Float, scale: Float, wheelNotches: Int) {
        if (padToApp.value) {
            if (scale != 1f) relay.send { it.zoompan(0.0, 0.0, scale.toDouble(), target.value.role) }
            if (dx != 0f || dy != 0f) relay.send { it.orbit(dx.toDouble(), dy.toDouble(), target.value.role) }
        } else if (wheelNotches != 0) hid.wheel(-wheelNotches)
    }

    fun padTap(fingers: Int) {
        if (padToApp.value) return
        hid.click(if (fingers >= 2) Hid.Btn.RIGHT else Hid.Btn.LEFT)
        haptic(6)
    }

    fun padDoubleTap() {
        if (padToApp.value) perform(Send.Gesture("reset"), buzz = 14)
    }

    // ---- haptics ---------------------------------------------------------------------------------

    @SuppressLint("MissingPermission")
    fun haptic(ms: Long) {
        if (!settings.value.haptics || ms <= 0) return
        val v = app.getSystemService(Vibrator::class.java) ?: return
        try { v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE)) } catch (_: Exception) {}
    }
}
