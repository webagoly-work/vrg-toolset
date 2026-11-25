package hu.vrg.mobile.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

// WP M38 / D-47: the paged home. Every catalogue entry is on the home exactly once, in the Founder's order.
class HomeLayoutTest {

    @Test fun theFoundersOrder() {
        assertEquals((1..8).toList(), HomeLayout.PAGES.map { it.n })
        assertEquals(listOf("sketch", "pager"), HomeLayout.PAGES[0].items.map { it.id }, "page 1: what is whipped up on site")
        assertEquals(listOf("planner", "calc", "inventory"), HomeLayout.PAGES[1].items.map { it.id })
        assertEquals(listOf("workflow"), HomeLayout.PAGES[2].items.map { it.id })
        assertEquals(listOf("map", "weather", "vault"), HomeLayout.PAGES[3].items.map { it.id })
        assertEquals(listOf("archive", "claude", "devlap"), HomeLayout.PAGES[4].items.map { it.id })
        assertEquals(listOf("account", "devices", "update", "settings"), HomeLayout.PAGES.last().items.map { it.id }, "account and settings last")
        assertEquals(listOf("photo"), HomeLayout.PLUGINS["sketch"]?.map { it.id })
    }

    @Test fun everyEntryIsOnTheHomeExactlyOnce() {
        val shown = HomeLayout.PAGES.flatMap { it.items }.map { it.id } + HomeLayout.PLUGINS.values.flatten().map { it.id } + HomeLayout.OFF_PAGES
        assertEquals(shown.size, shown.toSet().size, "shown twice: " + shown.groupBy { it }.filter { it.value.size > 1 }.keys)
        assertEquals(Catalogue.ALL.map { it.id }.toSet(), shown.toSet())
    }

    @Test fun shortcutsOpenRealApps() {
        val apps = DeskApps.ALL.map { it.id }.toSet()
        HomeLayout.SHORTCUTS.forEach { (feature, ids) ->
            assertNotNull(Catalogue.byId(feature), feature)
            assertTrue(ids.isNotEmpty() && ids.all { it in apps }, "$feature -> $ids")
        }
        assertEquals(listOf("inventory", "buildtree", "valena"), HomeLayout.SHORTCUTS["inventory"], "Készlet gathers BuildTree and Valena")
        HomeLayout.SHORTCUTS.keys.forEach { assertFalse(PhoneSheets.isWindow(it), "$it is a shortcut, not a sheet window") }
        assertFalse(PhoneSheets.isWindow(Catalogue.CATALOG.id))
    }

    @Test fun cardsAndColumns() {
        assertTrue(HomeLayout.PAGES[0].cards)
        assertFalse(HomeLayout.PAGES[5].cards, "the relay page is a grid")
        assertEquals(4, HomeLayout.columns(landscape = false))
        assertEquals(6, HomeLayout.columns(landscape = true))
        assertEquals(6, HomeLayout.pageOf("airdeck"))
        assertEquals(null, HomeLayout.pageOf("photo"))
    }

    @Test fun homeModesKeepTheirIds() {
        assertEquals(HomeMode.COMPACT, HomeMode.of("compact"), "a stored Kompakt is the one-page view now")
        assertEquals(HomeMode.DESK, HomeMode.of(null))
    }

    @Test fun sketchCount() {
        assertEquals(null, HomeLayout.sketchCountLabel(null))
        assertEquals("Még nincs felmérés a telefonon", HomeLayout.sketchCountLabel(0))
        assertEquals("1 felmérés a telefonon", HomeLayout.sketchCountLabel(1))
        assertTrue(HomeLayout.isSketchFile("a1b2.vsketch.json"))
        assertFalse(HomeLayout.isSketchFile("a1b2.tmp"), "a save in progress is not a survey")
        assertFalse(HomeLayout.isSketchFile(".vsketch.json"))
    }

    /** The count reads the Sketcher's folder without its code: pin the names to SketchStore's source. */
    @Test fun sketchNamesMatchTheSketcherStore() {
        val src = java.io.File("../feature-sketch/src/main/kotlin/hu/vrg/mobile/sketch/ui/SketchFeature.kt")
        assertTrue(src.exists(), "SketchFeature.kt moved: update HomeLayout.SKETCH_DIR / SKETCH_SUFFIX and this path")
        val text = src.readText()
        assertTrue("File(app.filesDir, \"${HomeLayout.SKETCH_DIR}\")" in text, "the Sketcher's folder is no longer filesDir/${HomeLayout.SKETCH_DIR}")
        assertTrue("\"\$id${HomeLayout.SKETCH_SUFFIX}\"" in text, "the Sketcher's file name is no longer <id>${HomeLayout.SKETCH_SUFFIX}")
    }
}
