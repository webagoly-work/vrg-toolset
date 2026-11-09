package hu.vrg.mobile.net

import android.annotation.SuppressLint
import android.content.Context
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import hu.vrg.mobile.kit.VrgLog
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

// "Helyi WiFi": Android's LocalOnlyHotspot (research §1). A WiFi network the PC can join on a site with no router,
// without internet. The reservation is held here; closing it (or the app's process ending) ends the network.
// The permission (NEARBY_WIFI_DEVICES on 13+, precise location before) is asked by the screen before start().

object LocalWifi {
    sealed interface State {
        data object Off : State
        data object Starting : State
        data class On(val ssid: String, val pass: String?) : State
        data class Failed(val reason: String) : State
    }

    private val _state = MutableStateFlow<State>(State.Off)
    val state: StateFlow<State> = _state
    private var reservation: WifiManager.LocalOnlyHotspotReservation? = null

    @SuppressLint("MissingPermission")   // the screen asks for it first; a SecurityException is reported
    fun start(ctx: Context) {
        if (reservation != null || _state.value == State.Starting) return
        val wm = ctx.applicationContext.getSystemService(WifiManager::class.java) ?: run { _state.value = State.Failed("Nincs WiFi."); return }
        _state.value = State.Starting
        try {
            wm.startLocalOnlyHotspot(object : WifiManager.LocalOnlyHotspotCallback() {
                override fun onStarted(r: WifiManager.LocalOnlyHotspotReservation) {
                    reservation = r
                    val (ssid, pass) = if (Build.VERSION.SDK_INT >= 30) {
                        val c = r.softApConfiguration
                        (if (Build.VERSION.SDK_INT >= 33) c.wifiSsid?.toString()?.trim('"') else @Suppress("DEPRECATION") c.ssid).orEmpty() to c.passphrase
                    } else {
                        @Suppress("DEPRECATION") val c = r.wifiConfiguration
                        @Suppress("DEPRECATION") (c?.SSID.orEmpty() to c?.preSharedKey)
                    }
                    _state.value = State.On(ssid, pass)
                    VrgLog.i("net", "Helyi WiFi fut: $ssid")
                }
                override fun onStopped() { reservation = null; _state.value = State.Off }
                override fun onFailed(reason: Int) {
                    reservation = null
                    _state.value = State.Failed(when (reason) {
                        ERROR_INCOMPATIBLE_MODE -> "Most nem indítható: kapcsold ki a hotspotot / megosztást, és próbáld újra."
                        ERROR_TETHERING_DISALLOWED -> "Ezen a telefonon tiltva van (eszközszabály)."
                        ERROR_NO_CHANNEL -> "Nincs szabad WiFi csatorna."
                        else -> "Nem indult (hiba $reason). Kapcsold be a helymeghatározást és a WiFit."
                    })
                }
            }, Handler(Looper.getMainLooper()))
        } catch (e: SecurityException) {
            _state.value = State.Failed("Engedély kell: ${if (Build.VERSION.SDK_INT >= 33) "Közeli WiFi eszközök" else "pontos hely"}.")
        } catch (e: IllegalStateException) {
            _state.value = State.Failed("Már fut egy kérés: ${e.message}")
        }
    }

    fun stop() {
        reservation?.close()
        reservation = null
        _state.value = State.Off
    }
}
