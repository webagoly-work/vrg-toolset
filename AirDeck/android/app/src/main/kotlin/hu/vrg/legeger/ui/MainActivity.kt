package hu.vrg.legeger.ui

import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.lifecycleScope
import hu.vrg.legeger.Deck
import hu.vrg.legeger.DeckService
import hu.vrg.legeger.core.Hid
import hu.vrg.legeger.hid.HidPeripheral
import hu.vrg.legeger.ui.theme.MelyvizTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private val permissions: Array<String>
        get() = buildList {
            if (Build.VERSION.SDK_INT >= 31) {
                add(android.Manifest.permission.BLUETOOTH_CONNECT)
                add(android.Manifest.permission.BLUETOOTH_ADVERTISE)
            }
            if (Build.VERSION.SDK_INT >= 33) add(android.Manifest.permission.POST_NOTIFICATIONS)
        }.toTypedArray()

    private val askPermissions = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        startBluetooth()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { MelyvizTheme { DeckScreen(onAskPermissions = { askPermissions.launch(permissions) }) } }

        val missing = permissions.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isEmpty()) startBluetooth() else askPermissions.launch(missing.toTypedArray())

        handleLink(intent)

        lifecycleScope.launch {
            Deck.settings.flow.collect { s ->
                if (s.keepScreenOn) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
        }
        // The service keeps the link up in the background; it is only needed once a PC is connected.
        lifecycleScope.launch {
            Deck.hid.phase.collect { if (it == HidPeripheral.Phase.CONNECTED) DeckService.start(this@MainActivity) }
        }
    }

    private fun startBluetooth() {
        Deck.hid.start()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleLink(intent)
    }

    /** vrgdeck://connect?ws=ws://host:port  or the Planner's own QR, http://host:47291/phone-sender.html */
    private fun handleLink(i: Intent?) {
        val u = i?.data ?: return
        val ws = when (u.scheme) {
            "vrgdeck" -> u.getQueryParameter("ws")
            "http", "https" -> "ws://${u.host}:${if (u.port > 0) u.port else 47291}"
            else -> null
        } ?: return
        Deck.connectRelay(ws)
    }

    override fun onResume() {
        super.onResume()
        Deck.setForeground(true)
    }

    override fun onPause() {
        Deck.setForeground(false)
        Deck.clutch.value = false
        Deck.setScrub(false)
        super.onPause()
    }

    // ---- volume keys as mouse buttons: thumb on the side, cursor on the clutch -------------------

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val s = Deck.settings.value
        if (s.volumeClicks && Deck.hid.connected) {
            val mask = when (event.keyCode) {
                KeyEvent.KEYCODE_VOLUME_DOWN -> Hid.Btn.LEFT
                KeyEvent.KEYCODE_VOLUME_UP -> Hid.Btn.RIGHT
                else -> 0
            }
            if (mask != 0) {
                when (event.action) {
                    KeyEvent.ACTION_DOWN -> if (event.repeatCount == 0) { Deck.hid.button(mask, true); Deck.haptic(6) }
                    KeyEvent.ACTION_UP -> Deck.hid.button(mask, false)
                }
                return true
            }
        }
        return super.dispatchKeyEvent(event)
    }
}
