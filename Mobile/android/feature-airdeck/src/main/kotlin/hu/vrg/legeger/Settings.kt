package hu.vrg.legeger

import android.content.Context
import hu.vrg.legeger.core.AirTuning
import hu.vrg.legeger.core.Macro
import hu.vrg.legeger.core.MacroScript
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** The parts of the deck screen, each of which can be switched off in Settings → Képernyő elemei. */
enum class Section(val label: String) {
    PILLS("Kapcsolat jelzők (BT · RELÉ)"),
    STATE("Állapotsor az alkalmazásból"),
    TOOLS("Az alkalmazás eszközei (tool pad)"),
    EXTRAS("Extra gombsor"),
    MACROS("Makró sor"),
    PAD("Érintőpad"),
    BUTTONS("BAL · MUTAT · JOBB"),
    BAR("Alsó gombsor"),
    NOTE("Üzenetsor"),
}

/** Everything the user can set, in one immutable value. Changed only through [SettingsStore.update]. */
data class DeckSettings(
    val hostAddress: String = "",          // the device paired last; reconnected on start
    val tuning: AirTuning = AirTuning(),
    val layout: String = "HU",
    val followFocus: Boolean = true,       // switch the layout to the app focused on the PC
    val autoPhone: Boolean = true,         // phone mode when the Bluetooth host is a phone
    val flicks: Boolean = true,
    val volumeClicks: Boolean = true,
    val haptics: Boolean = true,
    val keepScreenOn: Boolean = true,
    val padSpeed: Float = 1.6f,
    // look (the palette and the UI size are the shell's since WP M1: ShellSettings in kit)
    val hidden: Set<Section> = emptySet(),
    val lefty: Boolean = false,            // mirror the button row for the left hand
    // pad
    val padGestures: Boolean = true,       // 3 / 4 finger gestures
    val edgeSwipes: Boolean = true,
    val padHints: Boolean = true,
    val precision: Boolean = true,         // a finger on the pad while pointing = fine aim
    val phoneAspect: Float = 2.16f,        // target phone screen, height / width (20:9 ≈ 2.22, 16:9 = 1.78)
    // extras
    val faceDown: Boolean = false,         // face down on the table = play / pause
    val shotMode: String = "screen",       // or "window"
    val macros: List<Macro> = MacroScript.DEFAULTS,
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

    /**
     * The look Légegér stored before WP M1 (palette, UI size), removed from its store as it is read.
     * AirDeckFeature hands it to the shell once; nulls when there was none.
     */
    fun takeLegacyLook(): Pair<String?, Float?> {
        val palette = sp.getString("palette", null)
        val scale = if (sp.contains("uiScale")) sp.getFloat("uiScale", 1f) else null
        if (palette != null || scale != null) sp.edit().remove("palette").remove("uiScale").apply()
        return palette to scale
    }

    /** The relay address Légegér stored before WP M2, removed as it is read; the shell's link owns it now. */
    fun takeLegacyRelay(): String? {
        val u = sp.getString("relayUrl", null)
        if (u != null) sp.edit().remove("relayUrl").apply()
        return u
    }

    private fun load(): DeckSettings {
        val d = DeckSettings()
        return DeckSettings(
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
            autoPhone = sp.getBoolean("autoPhone", d.autoPhone),
            flicks = sp.getBoolean("flicks", d.flicks),
            volumeClicks = sp.getBoolean("volumeClicks", d.volumeClicks),
            haptics = sp.getBoolean("haptics", d.haptics),
            keepScreenOn = sp.getBoolean("keepScreenOn", d.keepScreenOn),
            padSpeed = sp.getFloat("padSpeed", d.padSpeed),
            hidden = (sp.getString("hidden", "") ?: "").split(',')
                .mapNotNull { n -> Section.entries.firstOrNull { it.name == n } }.toSet(),
            lefty = sp.getBoolean("lefty", d.lefty),
            padGestures = sp.getBoolean("padGestures", d.padGestures),
            edgeSwipes = sp.getBoolean("edgeSwipes", d.edgeSwipes),
            padHints = sp.getBoolean("padHints", d.padHints),
            precision = sp.getBoolean("precision", d.precision),
            phoneAspect = sp.getFloat("phoneAspect", d.phoneAspect),
            faceDown = sp.getBoolean("faceDown", d.faceDown),
            shotMode = sp.getString("shotMode", d.shotMode) ?: d.shotMode,
            macros = MacroScript.fromJson(sp.getString("macros", null)) ?: d.macros,
        )
    }

    private fun save(s: DeckSettings) {
        sp.edit()
            .putString("hostAddress", s.hostAddress)
            .putFloat("speed", s.tuning.speed)
            .putFloat("accel", s.tuning.accel)
            .putFloat("deadzone", s.tuning.deadzone)
            .putFloat("smoothing", s.tuning.smoothing)
            .putBoolean("invertY", s.tuning.invertY)
            .putString("layout", s.layout)
            .putBoolean("followFocus", s.followFocus)
            .putBoolean("autoPhone", s.autoPhone)
            .putBoolean("flicks", s.flicks)
            .putBoolean("volumeClicks", s.volumeClicks)
            .putBoolean("haptics", s.haptics)
            .putBoolean("keepScreenOn", s.keepScreenOn)
            .putFloat("padSpeed", s.padSpeed)
            .putString("hidden", s.hidden.joinToString(",") { it.name })
            .putBoolean("lefty", s.lefty)
            .putBoolean("padGestures", s.padGestures)
            .putBoolean("edgeSwipes", s.edgeSwipes)
            .putBoolean("padHints", s.padHints)
            .putBoolean("precision", s.precision)
            .putFloat("phoneAspect", s.phoneAspect)
            .putBoolean("faceDown", s.faceDown)
            .putString("shotMode", s.shotMode)
            .putString("macros", MacroScript.toJson(s.macros))
            .apply()
    }
}
