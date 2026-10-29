package hu.vrg.legeger

import android.app.Application
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.speech.RecognizerIntent
import android.view.KeyEvent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import hu.vrg.legeger.core.Hid
import hu.vrg.legeger.hid.HidPeripheral
import hu.vrg.legeger.ui.DeckScreen
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.Route
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.ShellSettings
import hu.vrg.mobile.kit.VrgFeature

// Légegér as a VRG Mobile feature. This is what used to be its MainActivity and Application: the
// shell now owns the Activity, so the permission and dictation launchers are Compose launchers, the
// window flags go through the host, and the volume keys arrive through onKey.

object AirDeckFeature : VrgFeature {
    override val info = Catalogue.AIRDECK

    override fun init(app: Application) {
        Deck.init(app)
        // Before WP M1 the look was Légegér's setting; the shell takes it over once and owns it from then on.
        val (palette, scale) = Deck.settings.takeLegacyLook()
        ShellSettings.adoptLook(palette, scale)
    }

    private val permissions: Array<String>
        get() = buildList {
            if (Build.VERSION.SDK_INT >= 31) {
                add(android.Manifest.permission.BLUETOOTH_CONNECT)
                add(android.Manifest.permission.BLUETOOTH_ADVERTISE)
            }
            if (Build.VERSION.SDK_INT >= 33) add(android.Manifest.permission.POST_NOTIFICATIONS)
        }.toTypedArray()

    @Composable
    override fun Screen(host: FeatureHost) {
        val act = host.activity
        val askPermissions = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
            Deck.hid.start()
        }
        // 🎤 in the keyboard sheet: the phone's own speech recogniser, its text typed into the PC
        val dictate = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
            val text = r.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()
            if (!text.isNullOrBlank()) Deck.typeText(text)
        }
        val startDictation: () -> Unit = {
            val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE, if (Deck.settings.value.layout == "HU") "hu-HU" else "en-US")
                .putExtra(RecognizerIntent.EXTRA_PROMPT, "Mondd, és begépelem")
            try { dictate.launch(i) } catch (e: ActivityNotFoundException) { Deck.notes.tryEmit("Nincs beszédfelismerő ezen a telefonon.") }
        }

        // Bluetooth starts the first time Légegér is opened, not when the app starts: the other
        // features have no business registering the phone as a HID device.
        LaunchedEffect(Unit) {
            val missing = permissions.filter { act.checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
            if (missing.isEmpty()) Deck.hid.start() else askPermissions.launch(missing.toTypedArray())
        }
        LaunchedEffect(Unit) {
            Deck.settings.flow.collect { s -> host.keepScreenOn(s.keepScreenOn) }
        }
        // The service keeps the link up in the background; it is only needed once a PC is connected.
        LaunchedEffect(Unit) {
            Deck.hid.phase.collect { if (it == HidPeripheral.Phase.CONNECTED) DeckService.start(act) }
        }

        // The palette and the UI size come from the shell (Beállítások), around every screen.
        DeckScreen(
            onAskPermissions = { askPermissions.launch(permissions) },
            onDictate = startDictation,
            onShellSettings = { host.open(Catalogue.SETTINGS.id) },
        )
    }

    /** vrgdeck://connect?ws=ws://host:port, or the Planner's own QR, both routed here by the shell. */
    override fun open(route: Route): Boolean {
        val ws = route.params["ws"] ?: return route.path.isEmpty()
        Deck.connectRelay(ws)
        return true
    }

    override fun onForeground(on: Boolean) {
        Deck.setForeground(on)
        if (!on) {
            Deck.clutch.value = false
            Deck.setScrub(false)
        }
    }

    // ---- volume keys as mouse buttons: thumb on the side, cursor on the clutch -------------------

    override fun onKey(event: KeyEvent): Boolean {
        val s = Deck.settings.value
        if (!s.volumeClicks || !Deck.hid.connected) return false
        val mask = when (event.keyCode) {
            KeyEvent.KEYCODE_VOLUME_DOWN -> Hid.Btn.LEFT
            KeyEvent.KEYCODE_VOLUME_UP -> Hid.Btn.RIGHT
            else -> return false
        }
        when (event.action) {
            KeyEvent.ACTION_DOWN -> if (event.repeatCount == 0) { Deck.hid.button(mask, true); Deck.haptic(6) }
            KeyEvent.ACTION_UP -> Deck.hid.button(mask, false)
        }
        return true
    }
}
