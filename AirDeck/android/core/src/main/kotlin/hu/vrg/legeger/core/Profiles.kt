package hu.vrg.legeger.core

// What the phone's buttons mean, per target. The tool pad itself is NOT listed here: each app sends
// its own in hello (`tools`), so a tool added to the Planner or a lens added to Kódváros shows up on
// the phone without touching this file. What is listed is the fixed furniture around the pad, the
// wrist flicks, tilt-to-scrub and the multi-finger pad gestures.
//
// PHONE and PRESENT are not apps on the relay: they describe what is on the other end of the
// Bluetooth link (another smartphone, or a slide show), so they are chosen by hand or — for PHONE —
// automatically when the connected Bluetooth host reports itself as a phone.

enum class Target(val role: String?, val label: String, val fromRelay: Boolean) {
    GENERAL(null, "ÁLTALÁNOS", false),
    PLANNER("planner", "PLANNER", true),
    CODECITY("codecity", "KÓDVÁROS", true),
    PHONE(null, "TELEFON", false),
    PRESENT(null, "PREZENTÁCIÓ", false);

    companion object {
        fun fromRole(role: String?): Target = entries.firstOrNull { it.role != null && it.role == role } ?: GENERAL
    }
}

/** What the touchpad sends: the PC mouse, the app camera (relay), or touches on the target's screen. */
enum class PadMode(val label: String) { MOUSE("EGÉR"), CAMERA("KAMERA"), TOUCH("ÉRINTÉS") }

/** What a button does. HID actions go over Bluetooth, Cmd / AppKey / Gesture over the relay. */
sealed interface Send {
    /** A semantic command the app registered (07a-link.js `command(id, fn)`, 36-link.js VLINK_CMDS). */
    data class Cmd(val id: String, val extra: Map<String, Any?> = emptyMap()) : Send
    /** A keystroke delivered INTO the app's page by the relay (works without Bluetooth). */
    data class AppKey(val key: String, val ctrl: Boolean = false, val shift: Boolean = false, val alt: Boolean = false) : Send
    /** A real keyboard chord over Bluetooth, e.g. "Ctrl+Z", "Win+D". */
    data class Key(val spec: String) : Send
    data class Text(val text: String) : Send
    data class Media(val usage: Int) : Send
    data class Wheel(val notches: Int) : Send
    data class Click(val button: Int) : Send
    /** A gesture message to the app ("reset"). */
    data class Gesture(val kind: String) : Send
    /** The PC screen through the relay; on a PHONE target, the target phone's own screenshot. */
    data object Screenshot : Send
    data object AltTab : Send
    data object None : Send
}

data class Action(val glyph: String, val label: String, val send: Send)

data class Profile(
    val target: Target,
    /** The bottom row. */
    val bar: List<Action>,
    /** A row of extras under the tool pad. */
    val extras: List<Action>,
    val flicks: Map<Flick, Send>,
    /** Tilt-to-scrub: one step to the right / to the left. */
    val scrubRight: Send,
    val scrubLeft: Send,
    val scrubLabel: String,
    /** Three / four finger and edge gestures on the pad. */
    val gestures: Map<PadGesture, Action>,
    /** The pad mode this target starts in. */
    val padMode: PadMode,
    /** The pad modes offered as chips, in order. */
    val padModes: List<PadMode>,
)

object Profiles {
    private fun a(glyph: String, label: String, send: Send) = Action(glyph, label, send)

    // Windows precision-touchpad defaults, so the hands already know them.
    private val WINDOWS_GESTURES = mapOf(
        PadGesture.SWIPE3_UP to a("▦", "Feladatnézet", Send.Key("Win+Tab")),
        PadGesture.SWIPE3_DOWN to a("▭", "Asztal", Send.Key("Win+D")),
        PadGesture.SWIPE3_LEFT to a("⇤", "Előző ablak", Send.Key("Alt+Shift+Tab")),
        PadGesture.SWIPE3_RIGHT to a("⇥", "Következő ablak", Send.AltTab),
        PadGesture.TAP3 to a("⌕", "Keresés", Send.Key("Win+S")),
        PadGesture.SWIPE4_LEFT to a("◧", "Előző asztal", Send.Key("Ctrl+Win+Left")),
        PadGesture.SWIPE4_RIGHT to a("◨", "Következő asztal", Send.Key("Ctrl+Win+Right")),
        PadGesture.SWIPE4_UP to a("⛶", "Teljes képernyő", Send.Key("F11")),
        PadGesture.SWIPE4_DOWN to a("—", "Kis méret", Send.Key("Win+Down")),
        PadGesture.TAP4 to a("☰", "Értesítések", Send.Key("Win+N")),
        PadGesture.EDGE_LEFT to a("▦", "Feladatnézet", Send.Key("Win+Tab")),
        PadGesture.EDGE_RIGHT to a("☰", "Gyorsbeállítások", Send.Key("Win+A")),
    )

    val GENERAL = Profile(
        target = Target.GENERAL,
        bar = listOf(
            a("⎋", "Esc", Send.Key("Escape")),
            a("⇥", "Alt+Tab", Send.AltTab),
            a("⊞", "Win", Send.Key("Win")),
            a("⏎", "Enter", Send.Key("Enter")),
        ),
        extras = listOf(
            a("◀◀", "Vissza", Send.Key("Alt+Left")),
            a("▶▶", "Előre", Send.Key("Alt+Right")),
            a("▭", "Asztal", Send.Key("Win+D")),
            a("⛶", "Teljes", Send.Key("F11")),
            a("⏯", "Lejátszás", Send.Media(Hid.Consumer.PLAY_PAUSE)),
            a("📸", "Képkivágás", Send.Screenshot),
        ),
        flicks = mapOf(
            Flick.LEFT to Send.Key("Alt+Left"),
            Flick.RIGHT to Send.Key("Alt+Right"),
            Flick.UP to Send.Key("Win+Tab"),
            Flick.DOWN to Send.Key("Win+D"),
        ),
        scrubRight = Send.Wheel(-1),
        scrubLeft = Send.Wheel(1),
        scrubLabel = "Görget",
        gestures = WINDOWS_GESTURES,
        padMode = PadMode.MOUSE,
        padModes = listOf(PadMode.MOUSE, PadMode.TOUCH),
    )

    val PLANNER = Profile(
        target = Target.PLANNER,
        bar = listOf(
            a("↶", "Vissza", Send.Cmd("edit.undo")),
            a("↷", "Újra", Send.Cmd("edit.redo")),
            a("⌂", "Nézet", Send.Cmd("view.reset")),
            a("⎋", "Esc", Send.AppKey("Escape")),
        ),
        extras = listOf(
            a("⌘K", "Paletta", Send.AppKey("k", ctrl = true)),
            a("⏎", "Lezárás", Send.AppKey("Enter")),
            a("⌦", "Törlés", Send.AppKey("Delete")),
            a("⬒", "2D↔3D", Send.AppKey("3", ctrl = true)),
            a("💾", "Mentés", Send.AppKey("s", ctrl = true)),
            a("📸", "Képernyő", Send.Screenshot),
        ),
        flicks = mapOf(
            Flick.LEFT to Send.Cmd("edit.undo"),
            Flick.RIGHT to Send.Cmd("edit.redo"),
            Flick.UP to Send.Cmd("view.reset"),
            Flick.DOWN to Send.AppKey("Escape"),
        ),
        scrubRight = Send.Cmd("edit.redo"),
        scrubLeft = Send.Cmd("edit.undo"),
        scrubLabel = "Előzmény",
        gestures = WINDOWS_GESTURES + mapOf(
            PadGesture.SWIPE3_LEFT to a("↶", "Vissza", Send.Cmd("edit.undo")),
            PadGesture.SWIPE3_RIGHT to a("↷", "Újra", Send.Cmd("edit.redo")),
            PadGesture.SWIPE3_UP to a("⌂", "Nézet", Send.Cmd("view.reset")),
            PadGesture.SWIPE3_DOWN to a("⎋", "Esc", Send.AppKey("Escape")),
            PadGesture.TAP3 to a("⌘K", "Paletta", Send.AppKey("k", ctrl = true)),
            PadGesture.TAP4 to a("⬒", "2D↔3D", Send.AppKey("3", ctrl = true)),
        ),
        padMode = PadMode.CAMERA,
        padModes = listOf(PadMode.MOUSE, PadMode.CAMERA),
    )

    val CODECITY = Profile(
        target = Target.CODECITY,
        bar = listOf(
            a("◀", "Commit −1", Send.Cmd("time.step", mapOf("d" to -1))),
            a("⏯", "Lejátszás", Send.Cmd("time.play")),
            a("▶", "Commit +1", Send.Cmd("time.step", mapOf("d" to 1))),
            a("⏭", "Legújabb", Send.Cmd("time.latest")),
        ),
        extras = listOf(
            a("⌂", "Föld", Send.Cmd("land.home")),
            a("U", "Utak", Send.Cmd("roads.toggle")),
            a("B", "Bázis", Send.Cmd("compare.base")),
            a("⌘K", "Paletta", Send.Cmd("palette.open")),
            a("/", "Keresés", Send.AppKey("/")),
            a("📸", "Képernyő", Send.Screenshot),
        ),
        flicks = mapOf(
            Flick.LEFT to Send.Cmd("time.step", mapOf("d" to -1)),
            Flick.RIGHT to Send.Cmd("time.step", mapOf("d" to 1)),
            Flick.UP to Send.Cmd("land.home"),
            Flick.DOWN to Send.AppKey("Escape"),
        ),
        scrubRight = Send.Cmd("time.step", mapOf("d" to 1)),
        scrubLeft = Send.Cmd("time.step", mapOf("d" to -1)),
        scrubLabel = "Idő",
        gestures = WINDOWS_GESTURES + mapOf(
            PadGesture.SWIPE3_LEFT to a("◀", "Commit −1", Send.Cmd("time.step", mapOf("d" to -1))),
            PadGesture.SWIPE3_RIGHT to a("▶", "Commit +1", Send.Cmd("time.step", mapOf("d" to 1))),
            PadGesture.SWIPE3_UP to a("⌂", "Föld", Send.Cmd("land.home")),
            PadGesture.SWIPE3_DOWN to a("⎋", "Esc", Send.AppKey("Escape")),
            PadGesture.TAP3 to a("⌘K", "Paletta", Send.Cmd("palette.open")),
            PadGesture.TAP4 to a("⏯", "Lejátszás", Send.Cmd("time.play")),
            PadGesture.SWIPE4_RIGHT to a("⏭", "Legújabb", Send.Cmd("time.latest")),
        ),
        padMode = PadMode.CAMERA,
        padModes = listOf(PadMode.MOUSE, PadMode.CAMERA),
    )

    // Another smartphone on the Bluetooth link. Its own navigation keys: HID consumer AC Back / AC Home
    // map to Android BACK / HOME; Meta+Tab and Meta+N are Android's recents and notification shortcuts;
    // SysRq (PrintScreen) is its screenshot key.
    val PHONE = Profile(
        target = Target.PHONE,
        bar = listOf(
            a("◁", "Vissza", Send.Media(Hid.Consumer.AC_BACK)),
            a("○", "Kezdőlap", Send.Media(Hid.Consumer.AC_HOME)),
            a("▢", "Appok", Send.Key("Win+Tab")),
            a("🔔", "Értesítés", Send.Key("Win+N")),
        ),
        extras = listOf(
            a("📸", "Képernyőkép", Send.Key("PrintScreen")),
            a("🔉", "Halkít", Send.Media(Hid.Consumer.VOL_DOWN)),
            a("🔊", "Hangosít", Send.Media(Hid.Consumer.VOL_UP)),
            a("⏯", "Lejátszás", Send.Media(Hid.Consumer.PLAY_PAUSE)),
            a("⌕", "Keresés", Send.Media(Hid.Consumer.AC_SEARCH)),
            a("⏻", "Kijelző", Send.Media(Hid.Consumer.POWER)),
        ),
        flicks = mapOf(
            Flick.LEFT to Send.Media(Hid.Consumer.AC_BACK),
            Flick.RIGHT to Send.Key("Win+Tab"),
            Flick.UP to Send.Media(Hid.Consumer.AC_HOME),
            Flick.DOWN to Send.Key("Win+N"),
        ),
        scrubRight = Send.Wheel(-1),
        scrubLeft = Send.Wheel(1),
        scrubLabel = "Görget",
        gestures = mapOf(
            PadGesture.SWIPE3_LEFT to a("◁", "Vissza", Send.Media(Hid.Consumer.AC_BACK)),
            PadGesture.SWIPE3_RIGHT to a("▢", "Appok", Send.Key("Win+Tab")),
            PadGesture.SWIPE3_UP to a("○", "Kezdőlap", Send.Media(Hid.Consumer.AC_HOME)),
            PadGesture.SWIPE3_DOWN to a("🔔", "Értesítés", Send.Key("Win+N")),
            PadGesture.TAP3 to a("📸", "Képernyőkép", Send.Key("PrintScreen")),
            PadGesture.TAP4 to a("⏯", "Lejátszás", Send.Media(Hid.Consumer.PLAY_PAUSE)),
            PadGesture.SWIPE4_UP to a("🔊", "Hangosít", Send.Media(Hid.Consumer.VOL_UP)),
            PadGesture.SWIPE4_DOWN to a("🔉", "Halkít", Send.Media(Hid.Consumer.VOL_DOWN)),
            PadGesture.EDGE_LEFT to a("◁", "Vissza", Send.Media(Hid.Consumer.AC_BACK)),
            PadGesture.EDGE_RIGHT to a("◁", "Vissza", Send.Media(Hid.Consumer.AC_BACK)),
        ),
        padMode = PadMode.TOUCH,
        padModes = listOf(PadMode.TOUCH, PadMode.MOUSE),
    )

    // A slide show (PowerPoint, Google Slides, PDF in full screen). The gyro pointer is the laser:
    // Ctrl+L turns PowerPoint's cursor into its red laser dot.
    val PRESENT = Profile(
        target = Target.PRESENT,
        bar = listOf(
            a("◀", "Előző dia", Send.Key("PageUp")),
            a("▶", "Következő", Send.Key("PageDown")),
            a("⬛", "Fekete", Send.Key("B")),
            a("⎋", "Kilépés", Send.Key("Escape")),
        ),
        extras = listOf(
            a("▷", "Indítás", Send.Key("F5")),
            a("▷·", "Innen", Send.Key("Shift+F5")),
            a("◉", "Lézer", Send.Key("Ctrl+L")),
            a("⬜", "Fehér", Send.Key("W")),
            a("⏯", "Videó", Send.Media(Hid.Consumer.PLAY_PAUSE)),
        ),
        flicks = mapOf(
            Flick.LEFT to Send.Key("PageUp"),
            Flick.RIGHT to Send.Key("PageDown"),
            Flick.UP to Send.Key("F5"),
            Flick.DOWN to Send.Key("B"),
        ),
        scrubRight = Send.Key("PageDown"),
        scrubLeft = Send.Key("PageUp"),
        scrubLabel = "Diák",
        gestures = WINDOWS_GESTURES + mapOf(
            PadGesture.SWIPE3_LEFT to a("◀", "Előző dia", Send.Key("PageUp")),
            PadGesture.SWIPE3_RIGHT to a("▶", "Következő", Send.Key("PageDown")),
            PadGesture.SWIPE3_DOWN to a("⬛", "Fekete", Send.Key("B")),
            PadGesture.SWIPE3_UP to a("▷", "Indítás", Send.Key("F5")),
            PadGesture.TAP3 to a("◉", "Lézer", Send.Key("Ctrl+L")),
        ),
        padMode = PadMode.MOUSE,
        padModes = listOf(PadMode.MOUSE),
    )

    fun of(t: Target): Profile = when (t) {
        Target.GENERAL -> GENERAL
        Target.PLANNER -> PLANNER
        Target.CODECITY -> CODECITY
        Target.PHONE -> PHONE
        Target.PRESENT -> PRESENT
    }

    /** The readout strip: a few short bits from the app's last `state`, in the old page's style. */
    fun stateBits(t: Target, s: Map<String, Any?>?): List<String> {
        if (s == null) return emptyList()
        val out = ArrayList<String>()
        when (t) {
            Target.PLANNER -> {
                s["mode"]?.let { out += it.toString() }
                s["level"]?.let { out += "szint $it" }
                s["freeHeight"]?.let { out += "h $it" }
                s["pathType"]?.let { out += "⌀$it" }
                s["cableType"]?.let { out += it.toString() }
                if (s["flat"] == true) out += "2D"
                if (s["lockTouch"] == true) out += "🔒"
            }
            Target.CODECITY -> {
                s["mode"]?.let { out += it.toString() }
                val tt = s["T"]; val last = s["last"]
                if (tt != null && last != null) out += "$tt/$last"
                if (s["playing"] == true) out += "▶"
                if (s["roads"] == true) out += "utak"
                s["commit"]?.let { out += it.toString() }
            }
            else -> {}
        }
        return out
    }
}
