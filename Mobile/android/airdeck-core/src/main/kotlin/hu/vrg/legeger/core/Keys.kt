package hu.vrg.legeger.core

// Key chords for the HID keyboard. Shortcuts ("Ctrl+Z", "Win+D") are layout-independent: they name
// physical keys. Typed text is not: the PC turns a usage into a character through ITS layout, so the
// phone must know which one is set there. Hungarian QWERTZ is the default here; US is the fallback.

data class Chord(val mods: Int, val usage: Int)

object Keys {
    val NAMED: Map<String, Int> = buildMap {
        put("Enter", 0x28); put("Escape", 0x29); put("Esc", 0x29); put("Backspace", 0x2A); put("Tab", 0x2B)
        put("Space", 0x2C); put("CapsLock", 0x39); put("PrintScreen", 0x46); put("ScrollLock", 0x47)
        put("Pause", 0x48); put("Insert", 0x49); put("Home", 0x4A); put("PageUp", 0x4B); put("Delete", 0x4C)
        put("Del", 0x4C); put("End", 0x4D); put("PageDown", 0x4E)
        put("ArrowRight", 0x4F); put("ArrowLeft", 0x50); put("ArrowDown", 0x51); put("ArrowUp", 0x52)
        put("Right", 0x4F); put("Left", 0x50); put("Down", 0x51); put("Up", 0x52)
        put("ContextMenu", 0x65)
        for (i in 1..12) put("F$i", 0x39 + i)
        for (c in 'A'..'Z') put(c.toString(), 0x04 + (c - 'A'))
        for (d in 1..9) put(d.toString(), 0x1D + d)
        put("0", 0x27)
    }

    private val MODS = mapOf(
        "ctrl" to Hid.Mod.LCTRL, "control" to Hid.Mod.LCTRL, "shift" to Hid.Mod.LSHIFT,
        "alt" to Hid.Mod.LALT, "altgr" to Hid.Mod.RALT, "win" to Hid.Mod.LGUI, "meta" to Hid.Mod.LGUI,
        "gui" to Hid.Mod.LGUI, "cmd" to Hid.Mod.LGUI,
    )

    /** "Ctrl+Shift+Z", "Win+D", "Alt+F4", "Escape". A modifier alone ("Win") presses just that modifier. */
    fun chord(spec: String): Chord? {
        val parts = spec.split('+').map { it.trim() }.filter { it.isNotEmpty() }
        if (parts.isEmpty()) return null
        var mods = 0
        var usage = 0
        for ((i, p) in parts.withIndex()) {
            val m = MODS[p.lowercase()]
            if (m != null && (i < parts.lastIndex || parts.size == 1)) { mods = mods or m; continue }
            usage = NAMED[p] ?: NAMED[p.uppercase()] ?: return null
        }
        return Chord(mods, usage)
    }
}

interface KeyLayout {
    val id: String
    fun map(c: Char): Chord?
}

object UsLayout : KeyLayout {
    override val id = "US"
    private const val S = Hid.Mod.LSHIFT
    private val table: Map<Char, Chord> = buildMap {
        for (c in 'a'..'z') put(c, Chord(0, 0x04 + (c - 'a')))
        for (c in 'A'..'Z') put(c, Chord(S, 0x04 + (c - 'A')))
        "1234567890".forEachIndexed { i, c -> put(c, Chord(0, 0x1E + i)) }
        "!@#$%^&*()".forEachIndexed { i, c -> put(c, Chord(S, 0x1E + i)) }
        put('\n', Chord(0, 0x28)); put('\t', Chord(0, 0x2B)); put(' ', Chord(0, 0x2C))
        put('-', Chord(0, 0x2D)); put('_', Chord(S, 0x2D)); put('=', Chord(0, 0x2E)); put('+', Chord(S, 0x2E))
        put('[', Chord(0, 0x2F)); put('{', Chord(S, 0x2F)); put(']', Chord(0, 0x30)); put('}', Chord(S, 0x30))
        put('\\', Chord(0, 0x31)); put('|', Chord(S, 0x31)); put(';', Chord(0, 0x33)); put(':', Chord(S, 0x33))
        put('\'', Chord(0, 0x34)); put('"', Chord(S, 0x34)); put('`', Chord(0, 0x35)); put('~', Chord(S, 0x35))
        put(',', Chord(0, 0x36)); put('<', Chord(S, 0x36)); put('.', Chord(0, 0x37)); put('>', Chord(S, 0x37))
        put('/', Chord(0, 0x38)); put('?', Chord(S, 0x38))
    }
    override fun map(c: Char) = table[c]
}

/** Hungarian QWERTZ (Windows "Magyar"). The AltGr symbols are the common ones; anything missing returns null. */
object HuLayout : KeyLayout {
    override val id = "HU"
    private const val S = Hid.Mod.LSHIFT
    private const val G = Hid.Mod.RALT
    private val table: Map<Char, Chord> = buildMap {
        for (c in 'a'..'z') {
            val u = when (c) { 'y' -> 0x1D; 'z' -> 0x1C; else -> 0x04 + (c - 'a') }   // Y and Z swap places
            put(c, Chord(0, u)); put(c.uppercaseChar(), Chord(S, u))
        }
        put('0', Chord(0, 0x35)); put('§', Chord(S, 0x35))
        "123456789".forEachIndexed { i, c -> put(c, Chord(0, 0x1E + i)) }
        "'\"+!%/=()".forEachIndexed { i, c -> put(c, Chord(S, 0x1E + i)) }
        fun pair(lo: Char, hi: Char, u: Int) { put(lo, Chord(0, u)); put(hi, Chord(S, u)) }
        // top row after 9: ö ü ó · second row end: ő ú · home row end: é á ű · ISO key left of Y: í
        pair('ö', 'Ö', 0x27); pair('ü', 'Ü', 0x2D); pair('ó', 'Ó', 0x2E); pair('ő', 'Ő', 0x2F)
        pair('ú', 'Ú', 0x30); pair('é', 'É', 0x33); pair('á', 'Á', 0x34); pair('ű', 'Ű', 0x31)
        pair('í', 'Í', 0x64); pair(',', '?', 0x36); pair('.', ':', 0x37); pair('-', '_', 0x38)
        put('\n', Chord(0, 0x28)); put('\t', Chord(0, 0x2B)); put(' ', Chord(0, 0x2C))
        put('~', Chord(G, 0x1E))
        put('@', Chord(G, 0x19)); put('\\', Chord(G, 0x14)); put('|', Chord(G, 0x1A))
        put('[', Chord(G, 0x09)); put(']', Chord(G, 0x0A)); put('{', Chord(G, 0x05)); put('}', Chord(G, 0x11))
        put('#', Chord(G, 0x1B)); put('&', Chord(G, 0x06)); put('$', Chord(G, 0x33)); put(';', Chord(G, 0x36))
        put('<', Chord(G, 0x64)); put('>', Chord(G, 0x1D)); put('*', Chord(G, 0x38))
    }
    override fun map(c: Char) = table[c]
}

object Layouts {
    val ALL = listOf(HuLayout, UsLayout)
    fun byId(id: String?): KeyLayout = ALL.firstOrNull { it.id == id } ?: HuLayout
}
