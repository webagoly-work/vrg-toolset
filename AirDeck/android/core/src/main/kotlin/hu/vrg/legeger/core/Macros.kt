package hu.vrg.legeger.core

import org.json.JSONArray
import org.json.JSONObject

// Macros: a short script, one step per line or separated by `;`. Written for a person typing on a
// phone, so it is forgiving about case and spaces, and every line that cannot be read is reported
// back by line number instead of being skipped silently.
//
//   Ctrl+S                    a key chord over Bluetooth (anything Keys.chord reads)
//   type Szia!                text, through the PC's keyboard layout
//   wait 300  ·  300ms        a pause
//   cmd view.reset            a relay command for the app in focus; extra args as k=v (d=-1)
//   app Ctrl+K                a key delivered into the app's page by the relay
//   media play|next|prev|mute|vol+|vol-|home|back|search|power
//   click left|right|middle   ·   wheel -3
//   shot                      a screenshot (PC via the relay; on a phone target its own screenshot)

sealed interface Step {
    data class Do(val send: Send) : Step
    data class Wait(val ms: Long) : Step
}

data class Macro(val id: String, val glyph: String, val name: String, val script: String, val onDeck: Boolean = true)

data class Parsed(val steps: List<Step>, val errors: List<String>)

object MacroScript {
    private val MEDIA = mapOf(
        "play" to Hid.Consumer.PLAY_PAUSE, "pause" to Hid.Consumer.PLAY_PAUSE, "next" to Hid.Consumer.NEXT,
        "prev" to Hid.Consumer.PREV, "mute" to Hid.Consumer.MUTE, "vol+" to Hid.Consumer.VOL_UP,
        "vol-" to Hid.Consumer.VOL_DOWN, "home" to Hid.Consumer.AC_HOME, "back" to Hid.Consumer.AC_BACK,
        "search" to Hid.Consumer.AC_SEARCH, "power" to Hid.Consumer.POWER,
    )
    private val BUTTONS = mapOf("left" to Hid.Btn.LEFT, "right" to Hid.Btn.RIGHT, "middle" to Hid.Btn.MIDDLE,
        "bal" to Hid.Btn.LEFT, "jobb" to Hid.Btn.RIGHT)

    /** Longest single wait, so a typo like `wait 30000000` cannot hang the deck. */
    const val MAX_WAIT = 10_000L

    fun parse(script: String): Parsed {
        val steps = ArrayList<Step>()
        val errors = ArrayList<String>()
        script.split('\n').forEachIndexed { li, line ->
            // `;` separates steps, except inside `type ...`, which takes the rest of the line
            val parts = splitSteps(line)
            for (raw in parts) {
                val t = raw.trim()
                if (t.isEmpty() || t.startsWith("#")) continue
                val step = one(t)
                if (step == null) errors += "${li + 1}. sor: nem értem: „$t”" else steps += step
            }
        }
        return Parsed(steps, errors)
    }

    private fun splitSteps(line: String): List<String> {
        val out = ArrayList<String>()
        var rest = line
        while (rest.isNotEmpty()) {
            val trimmed = rest.trimStart()
            if (trimmed.lowercase().startsWith("type ")) { out += trimmed; break }
            val i = rest.indexOf(';')
            if (i < 0) { out += rest; break }
            out += rest.substring(0, i)
            rest = rest.substring(i + 1)
        }
        return out
    }

    private fun one(t: String): Step? {
        val lower = t.lowercase()
        val word = lower.substringBefore(' ')
        val arg = t.substringAfter(' ', "").trim()
        Regex("^(\\d{1,6})\\s*ms$").find(lower)?.let { return Step.Wait(it.groupValues[1].toLong().coerceAtMost(MAX_WAIT)) }
        return when (word) {
            "wait", "várj", "varj" -> arg.removeSuffix("ms").trim().toLongOrNull()?.let { Step.Wait(it.coerceIn(0, MAX_WAIT)) }
            "type", "írd", "ird" -> if (arg.isEmpty()) null else Step.Do(Send.Text(arg))
            "cmd" -> cmd(arg)
            "app" -> appKey(arg)
            "media" -> MEDIA[arg.lowercase()]?.let { Step.Do(Send.Media(it)) }
            "click" -> BUTTONS[arg.lowercase()]?.let { Step.Do(Send.Click(it)) }
            "wheel" -> arg.toIntOrNull()?.let { Step.Do(Send.Wheel(it.coerceIn(-20, 20))) }
            "shot", "kép", "kep" -> Step.Do(Send.Screenshot)
            else -> Keys.chord(t)?.let { Step.Do(Send.Key(t)) }
        }
    }

    private fun cmd(arg: String): Step? {
        val bits = arg.split(Regex("\\s+")).filter { it.isNotEmpty() }
        if (bits.isEmpty()) return null
        val extra = LinkedHashMap<String, Any?>()
        for (b in bits.drop(1)) {
            val k = b.substringBefore('=', "")
            if (k.isEmpty()) return null
            val v = b.substringAfter('=')
            extra[k] = v.toIntOrNull() ?: v.toDoubleOrNull() ?: when (v) { "true" -> true; "false" -> false; else -> v }
        }
        return Step.Do(Send.Cmd(bits[0], extra))
    }

    private fun appKey(arg: String): Step? {
        if (arg.isEmpty()) return null
        val parts = arg.split('+').map { it.trim() }
        val key = parts.last()
        if (key.isEmpty()) return null
        val mods = parts.dropLast(1).map { it.lowercase() }
        if (mods.any { it !in setOf("ctrl", "shift", "alt") }) return null
        return Step.Do(Send.AppKey(key, ctrl = "ctrl" in mods, shift = "shift" in mods, alt = "alt" in mods))
    }

    // ---- storage ---------------------------------------------------------------------------------

    fun toJson(list: List<Macro>): String = JSONArray().apply {
        list.forEach {
            put(JSONObject().put("id", it.id).put("glyph", it.glyph).put("name", it.name)
                .put("script", it.script).put("onDeck", it.onDeck))
        }
    }.toString()

    fun fromJson(s: String?): List<Macro>? {
        if (s.isNullOrBlank()) return null
        return try {
            val a = JSONArray(s)
            (0 until a.length()).map { i ->
                val o = a.getJSONObject(i)
                Macro(o.getString("id"), o.optString("glyph", "★"), o.optString("name", "Makró"),
                    o.optString("script", ""), o.optBoolean("onDeck", true))
            }
        } catch (e: Exception) { null }
    }

    /** What a fresh install starts with: useful on Windows, and an example of each kind of step. */
    val DEFAULTS = listOf(
        Macro("m1", "✂", "Kivágás", "Win+Shift+S"),
        Macro("m2", "🔒", "Zárolás", "Win+L"),
        Macro("m3", "🎙", "Némít (Teams)", "Ctrl+Shift+M"),
        Macro("m4", "💾", "Mentés + nézet", "Ctrl+S; wait 250; cmd view.reset"),
        Macro("m5", "📸", "Képernyőkép", "shot", onDeck = false),
    )
}
