package hu.vrg.mobile.core

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

// Fényjel R1: the generated PixelGlyphs.kt against its real sources (shared/fenyjel/icons.js and fenyjel.css), and the
// catalogue against the glyphs. The repo root comes from Gradle (vrg.repo, kit-core/build.gradle.kts).
class FeatureIconsTest {
    private val repo = File(System.getProperty("vrg.repo") ?: "../../..")
    private val fj = File(repo, "shared/fenyjel")

    /** name → (family, rows), read from icons.js the way a person reads it. */
    private fun sourceGlyphs(): Map<String, Pair<String, List<String>>> {
        val src = File(fj, "icons.js").readText()
        return Regex("""(\w+): \{ family: '(\w+)', hu: '[^']*', rows: \[([\s\S]*?)\] \}""").findAll(src).associate { m ->
            m.groupValues[1] to (m.groupValues[2] to Regex("'([#+.]{12})'").findAll(m.groupValues[3]).map { it.groupValues[1] }.toList())
        }
    }

    @Test fun generatedGlyphsEqualIconsJs() {
        val src = sourceGlyphs()
        assertTrue(src.size >= 46, "icons.js read: ${src.size} glyphs")
        assertEquals(src.keys, PixelGlyphs.ALL.keys, "the same glyph names, nothing missing or extra")
        src.forEach { (name, v) ->
            val g = PixelGlyphs.ALL.getValue(name)
            assertEquals(v.first, g.family, "$name: family")
            assertEquals(v.second, g.rows, "$name: rows")
        }
    }

    @Test fun everyGlyphIsATwelveByTwelveGridOfKnownPixels() {
        PixelGlyphs.ALL.values.forEach { g ->
            assertEquals(PixelGlyphs.SIZE, g.rows.size, "${g.name}: rows")
            g.rows.forEach { r -> assertTrue(r.length == PixelGlyphs.SIZE && r.all { it == '#' || it == '+' || it == '.' }, "${g.name}: $r") }
            assertTrue(g.rows.any { '#' in it }, "${g.name}: at least one lit pixel")
            assertTrue(g.family in PixelGlyphs.FAMILY_COLOURS, "${g.name}: family ${g.family} has a colour")
        }
    }

    @Test fun familyColoursEqualFenyjelCss() {
        val css = File(fj, "fenyjel.css").readText()
        PixelGlyphs.FAMILY_COLOURS.forEach { (f, c) ->
            val token = if (f == "ui") "--fj-ink" else "--fj-f-$f"
            val m = assertNotNull(Regex("""$token:\s*#([0-9a-fA-F]{6})""").find(css), "$token in fenyjel.css")
            assertEquals(m.groupValues[1].toInt(16), c, token)
        }
    }

    @Test fun everyCatalogueFeatureHasAGlyph() {
        val missing = Catalogue.ALL.map { it.id }.filter { FeatureIcons.of(it) == null }
        assertEquals(emptyList(), missing, "catalogue features without a pixel glyph (map them in FeatureIcons)")
        FeatureIcons.BY_FEATURE.forEach { (id, name) ->
            assertNotNull(PixelGlyphs.byName(name), "$id → $name: no such glyph")
            assertNotNull(Catalogue.byId(id), "$id: not in the catalogue any more")
        }
    }

    @Test fun familiesFollowTheDesignSpec() {
        // DESIGN.md §4.1, a few anchors: what a thing does decides its colour
        assertEquals("link", FeatureIcons.familyOf("airdeck"))
        assertEquals("run", FeatureIcons.familyOf("pulse"))
        assertEquals("stock", FeatureIcons.familyOf("workflow"))
        assertEquals("alert", FeatureIcons.familyOf("pager"))
        assertEquals("plan", FeatureIcons.familyOf("sketch"))
        assertEquals("sys", FeatureIcons.familyOf("settings"))
        assertEquals(null, FeatureIcons.of("nincs-ilyen"))
    }
}
