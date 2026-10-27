package hu.vrg.legeger.core

// What the phone's buttons mean, per app. The tool pad itself is NOT listed here: each app sends its
// own in hello (`tools`), so a tool added to the Planner or a lens added to Kódváros shows up on the
// phone without touching this file. What is listed is the fixed furniture around the pad.

enum class Target(val role: String?, val label: String) {
    GENERAL(null, "ÁLTALÁNOS"),
    PLANNER("planner", "PLANNER"),
    CODECITY("codecity", "KÓDVÁROS");

    companion object {
        fun fromRole(role: String?): Target = entries.firstOrNull { it.role != null && it.role == role } ?: GENERAL
    }
}

/** What a button does. HID actions go over Bluetooth, the rest over the relay. */
sealed interface Send {
    /** A semantic command the app registered (07a-link.js `command(id, fn)`, 36-link.js VLINK_CMDS). */
    data class Cmd(val id: String, val extra: Map<String, Any?> = emptyMap()) : Send
    /** A keystroke delivered INTO the app's page by the relay (works without Bluetooth). */
    data class AppKey(val key: String, val ctrl: Boolean = false, val shift: Boolean = false, val alt: Boolean = false) : Send
    /** A real keyboard chord over Bluetooth, e.g. "Ctrl+Z", "Win+D". */
    data class Key(val spec: String) : Send
    data class Media(val usage: Int) : Send
    data class Wheel(val notches: Int) : Send
    /** A gesture message to the app ("reset"). */
    data class Gesture(val kind: String) : Send
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
)

object Profiles {
    val GENERAL = Profile(
        target = Target.GENERAL,
        bar = listOf(
            Action("⎋", "Esc", Send.Key("Escape")),
            Action("⇥", "Alt+Tab", Send.AltTab),
            Action("⊞", "Win", Send.Key("Win")),
            Action("⏎", "Enter", Send.Key("Enter")),
        ),
        extras = listOf(
            Action("◀◀", "Vissza", Send.Key("Alt+Left")),
            Action("▶▶", "Előre", Send.Key("Alt+Right")),
            Action("▭", "Asztal", Send.Key("Win+D")),
            Action("⛶", "Teljes", Send.Key("F11")),
            Action("⏯", "Lejátszás", Send.Media(Hid.Consumer.PLAY_PAUSE)),
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
    )

    val PLANNER = Profile(
        target = Target.PLANNER,
        bar = listOf(
            Action("↶", "Vissza", Send.Cmd("edit.undo")),
            Action("↷", "Újra", Send.Cmd("edit.redo")),
            Action("⌂", "Nézet", Send.Cmd("view.reset")),
            Action("⎋", "Esc", Send.AppKey("Escape")),
        ),
        extras = listOf(
            Action("⌘K", "Paletta", Send.AppKey("k", ctrl = true)),
            Action("⏎", "Lezárás", Send.AppKey("Enter")),
            Action("⌦", "Törlés", Send.AppKey("Delete")),
            Action("⬒", "2D↔3D", Send.AppKey("3", ctrl = true)),
            Action("💾", "Mentés", Send.AppKey("s", ctrl = true)),
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
    )

    val CODECITY = Profile(
        target = Target.CODECITY,
        bar = listOf(
            Action("◀", "Commit −1", Send.Cmd("time.step", mapOf("d" to -1))),
            Action("⏯", "Lejátszás", Send.Cmd("time.play")),
            Action("▶", "Commit +1", Send.Cmd("time.step", mapOf("d" to 1))),
            Action("⏭", "Legújabb", Send.Cmd("time.latest")),
        ),
        extras = listOf(
            Action("⌂", "Föld", Send.Cmd("land.home")),
            Action("U", "Utak", Send.Cmd("roads.toggle")),
            Action("B", "Bázis", Send.Cmd("compare.base")),
            Action("⌘K", "Paletta", Send.Cmd("palette.open")),
            Action("/", "Keresés", Send.AppKey("/")),
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
    )

    fun of(t: Target): Profile = when (t) {
        Target.GENERAL -> GENERAL
        Target.PLANNER -> PLANNER
        Target.CODECITY -> CODECITY
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
            Target.GENERAL -> {}
        }
        return out
    }
}
