package hu.vrg.legeger

import android.annotation.SuppressLint
import android.content.Context
import android.os.VibrationEffect
import android.os.Vibrator
import hu.vrg.legeger.core.AirPointer
import hu.vrg.legeger.core.Chord
import hu.vrg.legeger.core.FaceDown
import hu.vrg.legeger.core.Flick
import hu.vrg.legeger.core.FlickDetector
import hu.vrg.legeger.core.Hid
import hu.vrg.legeger.core.Incoming
import hu.vrg.legeger.core.Keys
import hu.vrg.legeger.core.Layouts
import hu.vrg.legeger.core.Macro
import hu.vrg.legeger.core.MacroScript
import hu.vrg.legeger.core.PadGesture
import hu.vrg.legeger.core.PadMode
import hu.vrg.legeger.core.PinchZoom
import hu.vrg.legeger.core.Pose
import hu.vrg.legeger.core.Profile
import hu.vrg.legeger.core.Profiles
import hu.vrg.legeger.core.RelayUrl
import hu.vrg.legeger.core.Scrubber
import hu.vrg.legeger.core.Send
import hu.vrg.legeger.core.Step
import hu.vrg.legeger.core.Target
import hu.vrg.legeger.core.Throttle
import hu.vrg.legeger.hid.HidPeripheral
import hu.vrg.legeger.motion.MotionSource
import hu.vrg.legeger.relay.RelayClient
import hu.vrg.mobile.kit.VrgLog
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
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.io.File

// The one place where the inputs meet the outputs.
//
//   inputs   gyro (pointer · flicks · scrub · camera pose) · gravity (face down) · touch (pad · tiles)
//            · volume keys · macros
//   outputs  Bluetooth HID (any PC or phone, no software: mouse, keyboard, media keys, touchscreen)
//            · relay (Planner / Kódváros, app-aware; PC screenshots)
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

    /** null = automatic (PC focus, or phone mode for a phone host); otherwise a target the user pinned. */
    val pinned = MutableStateFlow<Target?>(null)
    lateinit var target: StateFlow<Target>; private set
    val profile: Profile get() = Profiles.of(target.value)

    // ---- live controls ---------------------------------------------------------------------------

    /** The clutch: the cursor follows the phone only while this is held (or latched). */
    val clutch = MutableStateFlow(false)
    val clutchLatched = MutableStateFlow(false)
    /** A finger resting on the pad while pointing: fine aim. */
    val precisionHeld = MutableStateFlow(false)
    /** Gyro -> app camera (the old 🧭 button). */
    val camera = MutableStateFlow(false)
    val scrubbing = MutableStateFlow(false)
    /** What the touchpad drives; follows the target, the chips over the pad override it. */
    val padMode = MutableStateFlow(PadMode.MOUSE)
    /** The front screen is showing: sensors run only then. */
    private val foreground = MutableStateFlow(false)

    val notes = MutableSharedFlow<String>(extraBufferCapacity = 8)

    /** The macro being played, by id; null when none. */
    val macroRunning = MutableStateFlow<String?>(null)
    private var macroJob: Job? = null

    /** Screenshots received from the PC, newest first; [shotArrived] fires for each new one. */
    val shots = MutableStateFlow<List<File>>(emptyList())
    val shotArrived = MutableSharedFlow<File>(extraBufferCapacity = 2)
    val shotPending = MutableStateFlow(false)

    private val pointer = AirPointer()
    private val flicks = FlickDetector()
    private val scrubber = Scrubber()
    private val pinch = PinchZoom()
    private val faceDown = FaceDown()
    private val poseThrottle = Throttle(33)          // ~30 Hz is plenty for a camera (old page's figure)
    private var altTabJob: Job? = null

    fun init(ctx: Context) {
        app = ctx.applicationContext
        settings = SettingsStore(app)
        hid = HidPeripheral(app, scope)
        relay = RelayClient(scope)
        motion = MotionSource(app)
        shots.value = ShotStore.list(app)

        hid.preferredHost = settings.value.hostAddress
        hid.onHostConnected = { mac ->
            hid.preferredHost = mac
            if (mac != settings.value.hostAddress) settings.update { it.copy(hostAddress = mac) }
            haptic(30)
        }

        target = combine(pinned, relay.focus, relay.hellos, settings.flow, hid.hostIsPhone) { pin, focus, hellos, s, phoneHost ->
            pin ?: when {
                s.autoPhone && phoneHost -> Target.PHONE
                s.followFocus && focus?.role != null && hellos.containsKey(focus.role) -> Target.fromRole(focus.role)
                hellos.size == 1 -> Target.fromRole(hellos.keys.first())
                else -> Target.GENERAL
            }
        }.stateIn(scope, SharingStarted.Eagerly, Target.GENERAL)

        // Each target brings its own pad mode: the mouse on a PC, the camera in an app, touch on a phone.
        scope.launch { target.collect { padMode.value = Profiles.of(it).padMode } }
        scope.launch { relay.notes.collect { notes.emit(it) } }
        scope.launch { relay.shots.collect { onShot(it) } }
        logLinks()

        motion.onGyro = ::onGyro
        motion.onPose = ::onPose
        motion.onGravity = ::onGravity
        scope.launch {
            combine(foreground, clutch, clutchLatched, scrubbing, settings.flow) { fg, c, l, sc, s -> fg && (c || l || sc || s.flicks) }
                .collect { motion.gyro(it); if (!it) pointer.reset() }
        }
        scope.launch { combine(foreground, camera) { fg, cam -> fg && cam }.collect { motion.pose(it) } }
        scope.launch {
            combine(foreground, settings.flow.map { it.faceDown }.distinctUntilChanged()) { fg, on -> fg && on }
                .collect { motion.gravity(it) }
        }

        if (settings.value.relayUrl.isNotEmpty()) relay.connect(settings.value.relayUrl)
    }

    fun setForeground(on: Boolean) { foreground.value = on }

    /** Connects and disconnects, for Beállítások → Napló. Only the edges: a relay retrying stays quiet. */
    private fun logLinks() {
        val tag = AirDeckFeature.info.id
        scope.launch {
            var was: HidPeripheral.Phase? = null
            hid.phase.collect { p ->
                when {
                    p == HidPeripheral.Phase.CONNECTED -> VrgLog.i(tag, "Bluetooth: csatlakozva — ${hid.hostLabel() ?: "?"}")
                    was == HidPeripheral.Phase.CONNECTED -> VrgLog.i(tag, "Bluetooth: bontva")
                    p == HidPeripheral.Phase.NO_PERMISSION -> VrgLog.w(tag, "Bluetooth: nincs engedély")
                    p == HidPeripheral.Phase.UNSUPPORTED -> VrgLog.w(tag, "Bluetooth: a telefon nem engedi a HID módot")
                }
                was = p
            }
        }
        scope.launch {
            var was = RelayClient.Link.OFF
            relay.link.collect { l ->
                if (l == RelayClient.Link.OPEN) VrgLog.i(tag, "Relé: kapcsolódva — ${settings.value.relayUrl}")
                else if (was == RelayClient.Link.OPEN) VrgLog.i(tag, if (l == RelayClient.Link.OFF) "Relé: bontva" else "Relé: megszakadt, újrapróbálom")
                was = l
            }
        }
    }

    fun connectRelay(url: String) {
        val u = RelayClient.normalize(url)
        settings.update { it.copy(relayUrl = u) }
        relay.connect(u)
    }

    // ---- sensors ---------------------------------------------------------------------------------

    private fun onGyro(gx: Float, gy: Float, gz: Float, dt: Float, now: Long) {
        val s = settings.value
        if (clutch.value || clutchLatched.value) {
            val fine = s.precision && precisionHeld.value
            pointer.tuning = if (fine) s.tuning.copy(speed = s.tuning.speed * 0.3f, accel = 0f) else s.tuning
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
            val arrow = when (f) { Flick.LEFT -> "←"; Flick.RIGHT -> "→"; Flick.UP -> "↑"; Flick.DOWN -> "↓" }
            notes.tryEmit("csuklómozdulat $arrow")
        }
    }

    private fun onPose(pitch: Float, azimuth: Float, now: Long) {
        if (!camera.value || !poseThrottle.ready(now)) return
        val (p, y) = Pose.fromAndroid(pitch, azimuth)
        relay.send { it.orientation(p, y, target.value.role) }
    }

    private fun onGravity(gz: Float, now: Long) {
        if (!faceDown.step(gz, now)) return
        perform(Send.Media(Hid.Consumer.PLAY_PAUSE), buzz = 40)
        notes.tryEmit("arccal lefelé — szünet / lejátszás")
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
            is Send.Text -> hidOr { hid.type(send.text, Layouts.byId(settings.value.layout)) }
            is Send.Media -> hidOr { hid.media(send.usage) }
            is Send.Wheel -> hidOr { hid.wheel(send.notches) }
            is Send.Click -> hidOr { hid.click(send.button) }
            is Send.AltTab -> hidOr { altTab() }
            is Send.Screenshot -> screenshot()
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
        if (!hid.connected) { notes.tryEmit("Nincs Bluetooth eszköz — ⚙ → Bluetooth"); return false }
        f(); return true
    }

    /** Alt stays down between taps, so repeated taps walk the switcher; it lets go 0.9 s after the last. */
    private fun altTab() {
        hid.modsDown(Hid.Mod.LALT)
        hid.chordDown(Chord(Hid.Mod.LALT, 0x2B))
        hid.modsDown(Hid.Mod.LALT)
        altTabJob?.cancel()
        altTabJob = scope.launch { delay(900); hid.keysUp() }
    }

    fun typeText(text: String) {
        if (text.isEmpty()) return
        if (!hid.connected) { notes.tryEmit("Nincs Bluetooth eszköz — ⚙ → Bluetooth"); return }
        hid.type(text, Layouts.byId(settings.value.layout)) { skipped ->
            if (skipped > 0) notes.tryEmit("$skipped karakter nem gépelhető ezzel a kiosztással")
        }
    }

    // ---- pad gestures (all modes) ------------------------------------------------------------------

    fun padGesture(g: PadGesture) {
        val a = profile.gestures[g] ?: return
        if (perform(a.send, buzz = 16)) notes.tryEmit("${g.label} — ${a.label}")
    }

    // ---- touchpad: mouse / camera ------------------------------------------------------------------

    fun padMove(dx: Float, dy: Float) {
        when (padMode.value) {
            PadMode.CAMERA -> relay.send { it.zoompan(dx.toDouble(), dy.toDouble(), 1.0, target.value.role) }
            PadMode.MOUSE -> {
                if (clutch.value || clutchLatched.value) return      // the finger is anchoring a fine aim
                val k = settings.value.padSpeed
                hid.move((dx * k).toInt(), (dy * k).toInt())
            }
            PadMode.TOUCH -> {}
        }
    }

    fun padTwoFinger(dx: Float, dy: Float, scale: Float, wheelNotches: Int) {
        when (padMode.value) {
            PadMode.CAMERA -> {
                if (scale != 1f) relay.send { it.zoompan(0.0, 0.0, scale.toDouble(), target.value.role) }
                if (dx != 0f || dy != 0f) relay.send { it.orbit(dx.toDouble(), dy.toDouble(), target.value.role) }
            }
            PadMode.MOUSE -> {
                // pinch = Ctrl+wheel (zoom in every PC app); otherwise two fingers scroll
                val z = pinch.step(scale)
                if (z != 0) { hid.modsDown(Hid.Mod.LCTRL); hid.wheel(z); hid.keysUp() }
                else if (wheelNotches != 0) hid.wheel(-wheelNotches)
            }
            PadMode.TOUCH -> {}
        }
    }

    fun padGestureStart() { pinch.reset() }

    fun padTap(fingers: Int) {
        if (padMode.value != PadMode.MOUSE) return
        hid.click(if (fingers >= 2) Hid.Btn.RIGHT else Hid.Btn.LEFT)
        haptic(6)
    }

    fun padDoubleTap() {
        if (padMode.value == PadMode.CAMERA) perform(Send.Gesture("reset"), buzz = 14)
    }

    // ---- touchpad: touchscreen (phone mode) --------------------------------------------------------

    fun touchFrame(contacts: List<Hid.Contact>) {
        if (!hid.connected) return
        hid.touch(contacts)
    }

    // ---- macros ----------------------------------------------------------------------------------

    fun runMacro(m: Macro) {
        if (macroRunning.value == m.id) { macroJob?.cancel(); macroRunning.value = null; return }   // tap again = stop
        val parsed = MacroScript.parse(m.script)
        if (parsed.errors.isNotEmpty()) { notes.tryEmit("${m.name}: ${parsed.errors.first()}"); return }
        macroJob?.cancel()
        macroRunning.value = m.id
        haptic(10)
        macroJob = scope.launch {
            try {
                for (st in parsed.steps) {
                    when (st) {
                        is Step.Wait -> delay(st.ms)
                        is Step.Do -> {
                            val sd = st.send
                            if (!perform(sd, buzz = 0)) break
                            // text is typed asynchronously; give it time before the next step
                            delay(if (sd is Send.Text) 14L * sd.text.length + 40 else 40)
                        }
                    }
                }
            } finally {
                if (macroRunning.value == m.id) macroRunning.value = null
            }
        }
    }

    // ---- screenshots -----------------------------------------------------------------------------

    /** The PC (through the relay), or — in phone mode — the target phone's own screenshot key. */
    fun screenshot(): Boolean {
        if (target.value == Target.PHONE) return hidOr { Keys.chord("PrintScreen")?.let { hid.tap(it) } }
        if (!relay.isOpen) { notes.tryEmit("A képernyőképhez relé kell (⚙ → Relé)."); return false }
        shotPending.value = true
        notes.tryEmit("Képernyőkép készül…")
        relay.send { it.screenshotRequest(settings.value.shotMode) }
        scope.launch { delay(25_000); shotPending.value = false }
        return true
    }

    private suspend fun onShot(s: Incoming.Shot) {
        // a local copy: Shot lives in :core, so the compiler won't smart-cast s.url
        val url = s.url
        if (!s.ok || url == null) {
            shotPending.value = false
            notes.emit(s.reason ?: "A képernyőkép nem sikerült.")
            return
        }
        val f = ShotStore.download(app, RelayUrl.http(relay.url, url), s.name ?: "kepernyo.png")
        shotPending.value = false
        if (f == null) { notes.emit("A kép letöltése nem sikerült."); return }
        shots.value = ShotStore.list(app)
        haptic(25)
        shotArrived.emit(f)
    }

    fun deleteShot(f: File) {
        f.delete()
        shots.value = ShotStore.list(app)
    }

    // ---- haptics ---------------------------------------------------------------------------------

    @SuppressLint("MissingPermission")
    fun haptic(ms: Long) {
        if (!settings.value.haptics || ms <= 0) return
        val v = app.getSystemService(Vibrator::class.java) ?: return
        try { v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE)) } catch (_: Exception) {}
    }
}
