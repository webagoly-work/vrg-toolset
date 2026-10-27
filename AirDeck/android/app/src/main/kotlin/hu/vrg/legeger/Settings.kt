package hu.vrg.legeger

import android.content.Context
import hu.vrg.legeger.core.AirTuning
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** Everything the user can set, in one immutable value. Changed only through [SettingsStore.update]. */
data class DeckSettings(
    val relayUrl: String = "",
    val hostAddress: String = "",          // the PC paired last; reconnected on start
    val tuning: AirTuning = AirTuning(),
    val layout: String = "HU",
    val followFocus: Boolean = true,       // switch the layout to the app focused on the PC
    val flicks: Boolean = true,
    val volumeClicks: Boolean = true,
    val haptics: Boolean = true,
    val keepScreenOn: Boolean = true,
    val padSpeed: Float = 1.6f,
)

class SettingsStore(ctx: Context) {
    private val sp = ctx.getSharedPreferences("legeger", Context.MODE_PRIVATE)
    private val _flow = MutableStateFlow(load())
    val flow: StateFlow<DeckSettings> = _flow
    val value: DeckSettings get() = _flow.value

    fun update(f: (DeckSettings) -> DeckSettings) {
        val n = f(_flow.value)
        _flow.value = n
        save(n)
    }

    private fun load(): DeckSettings {
        val d = DeckSettings()
        return DeckSettings(
            relayUrl = sp.getString("relayUrl", d.relayUrl) ?: "",
            hostAddress = sp.getString("hostAddress", d.hostAddress) ?: "",
            tuning = AirTuning(
                speed = sp.getFloat("speed", d.tuning.speed),
                accel = sp.getFloat("accel", d.tuning.accel),
                deadzone = sp.getFloat("deadzone", d.tuning.deadzone),
                smoothing = sp.getFloat("smoothing", d.tuning.smoothing),
                invertY = sp.getBoolean("invertY", d.tuning.invertY),
            ),
            layout = sp.getString("layout", d.layout) ?: d.layout,
            followFocus = sp.getBoolean("followFocus", d.followFocus),
            flicks = sp.getBoolean("flicks", d.flicks),
            volumeClicks = sp.getBoolean("volumeClicks", d.volumeClicks),
            haptics = sp.getBoolean("haptics", d.haptics),
            keepScreenOn = sp.getBoolean("keepScreenOn", d.keepScreenOn),
            padSpeed = sp.getFloat("padSpeed", d.padSpeed),
        )
    }

    private fun save(s: DeckSettings) {
        sp.edit()
            .putString("relayUrl", s.relayUrl)
            .putString("hostAddress", s.hostAddress)
            .putFloat("speed", s.tuning.speed)
            .putFloat("accel", s.tuning.accel)
            .putFloat("deadzone", s.tuning.deadzone)
            .putFloat("smoothing", s.tuning.smoothing)
            .putBoolean("invertY", s.tuning.invertY)
            .putString("layout", s.layout)
            .putBoolean("followFocus", s.followFocus)
            .putBoolean("flicks", s.flicks)
            .putBoolean("volumeClicks", s.volumeClicks)
            .putBoolean("haptics", s.haptics)
            .putBoolean("keepScreenOn", s.keepScreenOn)
            .putFloat("padSpeed", s.padSpeed)
            .apply()
    }
}
