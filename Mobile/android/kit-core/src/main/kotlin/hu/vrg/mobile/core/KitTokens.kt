package hu.vrg.mobile.core

import kotlin.math.pow
import kotlin.math.roundToInt

// The VRG UI Kit's look on the phone (WP M16), the pure half. shared/vrg-ui-kit/tools/kotlin-tokens.js writes the
// Compose values (kit/theme/KitTokens.kt); this is the same mapping and colour maths in Kotlin, so KitTokensTest can
// read the real token files and prove the generated file says what the tokens say, without the Android SDK.

/** One kit theme as phone colours: palette field → 0xRRGGBB (opaque), plus the two radii in dp. */
data class KitPalette(
    val id: String,
    val name: String,
    val light: Boolean,
    val colours: Map<String, Int>,
    val radius: Float,
    val radiusSmall: Float,
)

object KitTokens {
    /** Theme file → palette id and Hungarian name, in `Look.PALETTES` order. */
    val THEMES = listOf(
        Triple("theme-dark.css", "kit-ej", "Éj"),
        Triple("theme-light.css", "kit-papir", "Papír"),
        Triple("theme-contrast.css", "kit-kontraszt", "Kontraszt"),
        Triple("theme-melyviz.css", "kit-melyviz", "Mélyvíz (kit)"),
    )
    val IDS: List<String> = THEMES.map { it.second }

    /** Palette field → kit token (docs/mobile/WP/M16.md). Translucent tokens are resolved over the theme's --vk-bg. */
    val FIELDS = listOf(
        "abyss" to "--vk-bg-sunken", "deep" to "--vk-bg", "surface" to "--vk-surface-1", "raised" to "--vk-surface-2",
        "line" to "--vk-line-strong", "lineSoft" to "--vk-line",
        "ink" to "--vk-text", "muted" to "--vk-text-muted", "faint" to "--vk-text-faint",
        "glow" to "--vk-accent", "glowDim" to "--vk-accent-line", "current" to "--vk-info",
        "sand" to "--vk-warn", "coral" to "--vk-crit", "kelp" to "--vk-ok",
        "onGlow" to "--vk-text-on-accent", "shallows" to "--vk-bg",
        "activity" to "--vk-activity",
    )

    /** An sRGB colour, channels 0…255, alpha 0…1. */
    data class Rgba(val r: Double, val g: Double, val b: Double, val a: Double = 1.0) {
        fun over(bg: Rgba): Rgba = if (a >= 1.0) this else Rgba(
            (r * a + bg.r * (1 - a)).roundToInt().toDouble(),
            (g * a + bg.g * (1 - a)).roundToInt().toDouble(),
            (b * a + bg.b * (1 - a)).roundToInt().toDouble(),
        )
        val rgb: Int get() = (r.roundToInt() shl 16) or (g.roundToInt() shl 8) or b.roundToInt()
    }

    /** The `--vk-*` declarations of the first block whose selector contains [selector]. */
    fun block(css: String, selector: String): Map<String, String> {
        val clean = css.replace(Regex("/\\*[\\s\\S]*?\\*/"), "")
        val m = Regex("([^{}]+)\\{([^{}]*)\\}").findAll(clean).firstOrNull { selector in it.groupValues[1].trim() }
            ?: error("no block $selector")
        return Regex("(--vk-[\\w-]+)\\s*:\\s*([^;]+);").findAll(m.groupValues[2])
            .associate { it.groupValues[1] to it.groupValues[2].trim() }
    }

    fun expand(v: String, vars: Map<String, String>, depth: Int = 0): String {
        require(depth < 20) { "var() loop at $v" }
        return Regex("var\\(\\s*(--vk-[\\w-]+)\\s*\\)").replace(v) {
            expand(vars[it.groupValues[1]] ?: error("unknown token ${it.groupValues[1]}"), vars, depth + 1)
        }
    }

    /** #rgb, #rrggbb, rgb(a)(), transparent, color-mix(in srgb, C P%, transparent). */
    fun colour(s: String): Rgba {
        val v = s.trim()
        if (v == "transparent") return Rgba(0.0, 0.0, 0.0, 0.0)
        Regex("^#([0-9a-fA-F]{3})$").find(v)?.let { m ->
            val h = m.groupValues[1]
            return Rgba(h.substring(0, 1).repeat(2).toInt(16).toDouble(), h.substring(1, 2).repeat(2).toInt(16).toDouble(), h.substring(2, 3).repeat(2).toInt(16).toDouble())
        }
        Regex("^#([0-9a-fA-F]{6})$").find(v)?.let { m ->
            val n = m.groupValues[1].toInt(16)
            return Rgba(((n shr 16) and 255).toDouble(), ((n shr 8) and 255).toDouble(), (n and 255).toDouble())
        }
        Regex("^rgba?\\(\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*(?:,\\s*([\\d.]+)\\s*)?\\)$").find(v)?.let { m ->
            val (r, g, b, a) = m.destructured
            return Rgba(r.toDouble(), g.toDouble(), b.toDouble(), a.ifEmpty { "1" }.toDouble())
        }
        Regex("^color-mix\\(\\s*in srgb\\s*,\\s*(.+?)\\s+([\\d.]+)%\\s*,\\s*transparent\\s*\\)$").find(v)?.let { m ->
            val c = colour(m.groupValues[1])
            return c.copy(a = c.a * m.groupValues[2].toDouble() / 100)
        }
        error("cannot read colour $v")
    }

    private fun px(v: String): Float = v.trim().removeSuffix("px").toFloat()

    /** The four palettes from the token files: [read] gives a file of shared/vrg-ui-kit/tokens by name. */
    fun palettes(read: (String) -> String): List<KitPalette> {
        val base = block(read("base.css"), ":root")
        return THEMES.map { (file, id, name) ->
            val css = read(file)
            val vars = base + block(css, "data-vk-theme")
            val bg = colour(expand(vars.getValue("--vk-bg"), vars))
            val light = Regex("color-scheme:\\s*(light|dark)").find(css.substring(css.indexOf('{')))?.groupValues?.get(1) == "light"
            KitPalette(
                id, name, light,
                FIELDS.associate { (f, tok) -> f to colour(expand(vars.getValue(tok), vars)).over(bg).rgb },
                px(expand(vars.getValue("--vk-radius-lg"), vars)), px(expand(vars.getValue("--vk-radius"), vars)),
            )
        }
    }

    /** WCAG 2 relative luminance of 0xRRGGBB. */
    fun luminance(rgb: Int): Double {
        fun ch(c: Int): Double { val s = c / 255.0; return if (s <= 0.03928) s / 12.92 else ((s + 0.055) / 1.055).pow(2.4) }
        return 0.2126 * ch((rgb shr 16) and 255) + 0.7152 * ch((rgb shr 8) and 255) + 0.0722 * ch(rgb and 255)
    }

    /** WCAG 2 contrast ratio, 1…21. */
    fun contrast(a: Int, b: Int): Double {
        val la = luminance(a); val lb = luminance(b)
        return (maxOf(la, lb) + 0.05) / (minOf(la, lb) + 0.05)
    }
}

/** The MINI's states (WP M16), as the web kit's `data-state`. */
enum class MiniState { IDLE, RUNNING, DONE, ERROR, WAITING, PAUSED, OFF }

/** What a MINI shows: its state and, while running, the progress 0…1 (null = indeterminate, a sweeping arc). */
data class MiniStatus(val state: MiniState = MiniState.IDLE, val progress: Float? = null) {
    val busy: Boolean get() = state != MiniState.IDLE

    /** The accessible name, as the web `VK.mini` writes aria-label: "Gyorsjegyzet — 42%", "… — kész", "… — hiba". */
    fun describe(label: String): String {
        val p = progress
        val tail = if (state == MiniState.RUNNING && p != null) "${(p.coerceIn(0f, 1f) * 100).roundToInt()}%" else STATE_HU[state]
        return if (tail.isNullOrEmpty()) label else "$label — $tail"
    }

    companion object {
        val IDLE = MiniStatus()
        val STATE_HU = mapOf(
            MiniState.RUNNING to "fut", MiniState.DONE to "kész", MiniState.ERROR to "hiba",
            MiniState.WAITING to "várakozik", MiniState.PAUSED to "szünetel", MiniState.OFF to "kikapcsolva",
        )
        fun running(progress: Float? = null) = MiniStatus(MiniState.RUNNING, progress)
    }
}
