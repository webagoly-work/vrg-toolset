package hu.vrg.mobile.core

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// WP M16: the phone's kit palettes against the real VRG UI Kit token files (shared/vrg-ui-kit/tokens), and the
// generated kit/theme/KitTokens.kt against both. The repo root comes from Gradle (vrg.repo, kit-core/build.gradle.kts).
class KitTokensTest {
    private val repo = File(System.getProperty("vrg.repo") ?: "../../..")
    private val tokens = File(repo, "shared/vrg-ui-kit/tokens")
    private val theme = File(repo, "Mobile/android/kit/src/main/kotlin/hu/vrg/mobile/kit/theme")
    private val kit = KitTokens.palettes { File(tokens, it).readText() }
    private val generated = File(theme, "KitTokens.kt").readText()

    /** `val X = Palette(\n "id", …)` blocks of a Kotlin file, in order: id → field → 0xRRGGBB. */
    private fun kotlinPalettes(src: String): LinkedHashMap<String, Map<String, Int>> {
        val out = LinkedHashMap<String, Map<String, Int>>()
        Regex("Palette\\(\\s*\"([\\w-]+)\"([\\s\\S]*?)\\n\\s*\\)").findAll(src).forEach { m ->
            out[m.groupValues[1]] = Regex("(\\w+) = Color\\(0xFF([0-9A-Fa-f]{6})\\)").findAll(m.groupValues[2])
                .associate { it.groupValues[1] to it.groupValues[2].toInt(16) }
        }
        return out
    }

    @Test fun theTenIdsMatchLookPalettes() {
        assertEquals(11, Look.PALETTES.size)
        assertEquals(Look.PALETTES.size, Look.PALETTES.toSet().size)
        assertEquals("melyviz", Look.DEFAULT_PALETTE, "the default stays the app's own")
        assertEquals(KitTokens.IDS, Look.PALETTES.takeLast(4))
        val six = kotlinPalettes(File(theme, "Melyviz.kt").readText()).keys.toList()
        assertEquals(Look.PALETTES, six + kotlinPalettes(generated).keys.toList(), "Palettes.ALL = the seven + KitTokens.ALL, in this order")
        assertTrue(Regex("ALL = listOf\\(MELYVIZ, AROK, KORALL, LAGUNA, MOSZAT, SEKELY, SUI\\) \\+ KitTokens.ALL").containsMatchIn(File(theme, "Melyviz.kt").readText()))
    }

    @Test fun everyKitColourEqualsItsToken() {
        val gen = kotlinPalettes(generated)
        kit.forEach { p ->
            val g = gen[p.id] ?: error("${p.id} missing from KitTokens.kt")
            assertEquals(KitTokens.FIELDS.map { it.first }.toSet(), g.keys, "${p.id}: every field")
            p.colours.forEach { (f, c) -> assertEquals(c, g[f], "${p.id}.$f") }
        }
    }

    @Test fun knownValuesFromTheTokenFiles() {
        val ej = kit.first { it.id == "kit-ej" }
        assertEquals(0x0B0D0F, ej.colours["deep"])                 // --vk-bg
        assertEquals(0xEAA46F, ej.colours["activity"])             // --vk-activity, the warm one
        // --vk-line-strong rgba(235,240,245,.24) over #0b0d0f
        assertEquals(KitTokens.Rgba(235.0, 240.0, 245.0, .24).over(KitTokens.colour("#0b0d0f")).rgb, ej.colours["line"])
        // --vk-accent-line = color-mix(in srgb, --vk-accent 55%, transparent) over the ground
        assertEquals(KitTokens.colour("#9fd8ea").copy(a = .55).over(KitTokens.colour("#0b0d0f")).rgb, ej.colours["glowDim"])
        assertTrue(kit.first { it.id == "kit-papir" }.light)
        assertEquals(listOf(false, true, false, false), kit.map { it.light })
        assertEquals(0f, kit.first { it.id == "kit-melyviz" }.radius, "Mélyvíz (kit) is square")
        assertEquals(5f, ej.radius)
        assertTrue(Regex("\"kit-melyviz\"[\\s\\S]*?radius = 0\\.dp, radiusSmall = 0\\.dp").containsMatchIn(generated))
        assertTrue("val targetMin = 40.dp" in generated && "val fsMd = 15.sp" in generated, "the touch density sizes")
    }

    @Test fun inkAndMutedAreReadable() {
        kit.forEach { p ->
            for (fg in listOf("ink", "muted")) for (bg in listOf("deep", "surface")) {
                val r = KitTokens.contrast(p.colours.getValue(fg), p.colours.getValue(bg))
                assertTrue(r >= 4.5, "${p.id}: $fg on $bg is ${"%.2f".format(r)}:1")
            }
        }
    }

    @Test fun colourMaths() {
        assertEquals(0xFFFFFF, KitTokens.colour("#fff").rgb)
        assertEquals(21.0, KitTokens.contrast(0x000000, 0xFFFFFF), 1e-9)
        assertEquals(0x808080, KitTokens.Rgba(255.0, 255.0, 255.0, .5).over(KitTokens.colour("#000000")).rgb)
        assertEquals(0.0, KitTokens.colour("transparent").a)
        assertEquals(.15, KitTokens.colour("color-mix(in srgb, rgba(1, 2, 3, 1) 15%, transparent)").a, 1e-9)
    }

    @Test fun miniDescribesItsState() {
        assertEquals("Gyorsjegyzet", MiniStatus.IDLE.describe("Gyorsjegyzet"))
        assertEquals("Gyorsjegyzet — 42%", MiniStatus.running(.42f).describe("Gyorsjegyzet"))
        assertEquals("Frissítés — fut", MiniStatus.running().describe("Frissítés"))
        assertEquals("Gyorsjegyzet — kész", MiniStatus(MiniState.DONE).describe("Gyorsjegyzet"))
        assertEquals("Haladás — hiba", MiniStatus(MiniState.ERROR).describe("Haladás"))
        assertEquals("X — 100%", MiniStatus.running(7f).describe("X"))
        assertTrue(MiniState.entries.filter { it != MiniState.IDLE }.all { it in MiniStatus.STATE_HU })
    }
}
