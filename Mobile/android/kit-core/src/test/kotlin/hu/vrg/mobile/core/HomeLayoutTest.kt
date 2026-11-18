package hu.vrg.mobile.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// WP M32 / D-35: the home's layout. Every catalogue entry is reachable from the home exactly once, VRG Sketcher is the hero.
class HomeLayoutTest {

    @Test fun sketcherIsTheHero() {
        assertEquals("sketch", HomeLayout.HERO.id)
        assertEquals(listOf("photo"), HomeLayout.HERO_PLUGINS.map { it.id })
    }

    @Test fun everyEntryIsOnTheHomeExactlyOnce() {
        val shown = listOf(HomeLayout.HERO) + HomeLayout.HERO_PLUGINS + HomeLayout.QUICK + HomeLayout.sections().flatMap { it.second }
        val ids = shown.map { it.id }
        assertEquals(ids.size, ids.toSet().size, "a feature shown twice: " + ids.groupBy { it }.filter { it.value.size > 1 }.keys)
        assertEquals(Catalogue.ALL.map { it.id }.toSet(), ids.toSet())
    }

    @Test fun pinnedEntriesAreCatalogueEntries() {
        HomeLayout.pinnedIds.forEach { assertEquals(it, Catalogue.byId(it)?.id, "pinned id not in the catalogue: $it") }
        assertEquals(4, HomeLayout.QUICK.size, "the quick row is one row of four")
    }

    @Test fun sectionsKeepTheCatalogueOrder() {
        val s = HomeLayout.sections()
        assertEquals(Group.entries.filter { g -> s.any { it.first == g } }, s.map { it.first })
        s.forEach { (g, items) ->
            assertEquals(Catalogue.ALL.filter { it.group == g && it.id !in HomeLayout.pinnedIds }, items)
            assertTrue(items.isNotEmpty())
        }
    }

    @Test fun columns() {
        assertEquals(4, HomeLayout.columns(landscape = false))
        assertEquals(5, HomeLayout.columns(landscape = true))
    }

    @Test fun foldedGroupsRoundTrip() {
        assertEquals(HomeLayout.DEFAULT_FOLDED, ShellPrefs().homeFolded)
        assertEquals(HomeLayout.DEFAULT_FOLDED, ShellPrefs.fromMap(emptyMap<String, Any>()).homeFolded)
        val p = ShellPrefs().toggleFold(Group.WORK).toggleFold(Group.APP)
        assertEquals(setOf(Group.WORK), p.homeFolded)
        assertEquals(p, ShellPrefs.fromMap(ShellPrefs.toMap(p)))
        val open = p.toggleFold(Group.WORK)
        assertTrue(open.homeFolded.isEmpty())
        assertEquals(open, ShellPrefs.fromMap(ShellPrefs.toMap(open)), "every group open survives a restart")
        assertEquals(setOf(Group.LINK), ShellPrefs.foldedOf("LINK,nincs-ilyen,"))
        assertFalse(Group.APP in ShellPrefs.foldedOf(""))
    }

    @Test fun sketchCount() {
        assertEquals(null, HomeLayout.sketchCountLabel(null))
        assertEquals("Még nincs felmérés a telefonon", HomeLayout.sketchCountLabel(0))
        assertEquals("1 felmérés a telefonon", HomeLayout.sketchCountLabel(1))
        assertEquals("12 felmérés a telefonon", HomeLayout.sketchCountLabel(12))
        assertTrue(HomeLayout.isSketchFile("a1b2.vsketch.json"))
        assertFalse(HomeLayout.isSketchFile("a1b2.tmp"), "a save in progress is not a survey")
        assertFalse(HomeLayout.isSketchFile(".vsketch.json"))
        assertFalse(HomeLayout.isSketchFile("photos"))
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
