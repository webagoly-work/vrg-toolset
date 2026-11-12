package hu.vrg.mobile.core

import org.json.JSONObject
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

// WP M19: Kommand finds what the Desktop's command palette finds, in the same order. The fixture holds the palette's
// own answers (Dashboard/shell/lib/palette.js search(), run by Mobile/catalogue/desk-gen.js); mobile.cmd test checks
// with `desk-gen.js --check` that the fixture still matches the catalog.

class KommandTest {
    private val repo = File(System.getProperty("vrg.repo") ?: "../..")
    private val fx = JSONObject(File(repo, "Mobile/tests/fixtures/kommand.json").readText())

    @Test fun sameResultsAsTheDesktopPalette() {
        val items = fx.getJSONArray("items").let { a -> (0 until a.length()).map { a.getJSONObject(it).let { o -> KommandItem(o.getString("id"), o.getString("hu"), o.getString("en")) } } }
        val recent = fx.getJSONArray("recent").let { a -> (0 until a.length()).map { a.getString(it) } }
        val cases = fx.getJSONArray("cases")
        assertTrue(cases.length() >= 20)
        for (i in 0 until cases.length()) {
            val c = cases.getJSONObject(i)
            val want = c.getJSONArray("ids").let { a -> (0 until a.length()).map { a.getString(it) } }
            assertEquals(want, Kommand.search(items, c.getString("q"), recent).map { it.id }, "query '${c.getString("q")}'")
        }
    }

    @Test fun foldsLikeThePalette() {
        val f = fx.getJSONArray("folds")
        for (i in 0 until f.length()) {
            val o = f.getJSONObject(i)
            assertEquals(o.getString("fold"), Kommand.fold(o.getString("s")))
            val w = o.getJSONArray("words").let { a -> (0 until a.length()).map { a.getString(it) } }
            assertEquals(w, Kommand.words(o.getString("s")))
        }
    }

    @Test fun theFixtureIsTheGeneratedCatalog() {
        val ids = fx.getJSONArray("items").let { a -> (0 until a.length()).map { a.getJSONObject(it).getString("id") } }
        assertEquals(DeskCatalog.UNITS.map { "cat:" + it.id }, ids)
        assertEquals(34, DeskCatalog.UNITS.size, "the Desktop had 34 User-level units on 2026-11-12; a new one needs a PARITY.md row")
    }

    @Test fun theIndexLeavesOutWhatThePhoneCannotOpen() {
        val ix = Kommand.index(windows = listOf("w1" to "Planner"))
        assertEquals("win:w1", ix.first().id)
        assertTrue(ix.none { it.id == "cat:mail" || it.id == "cat:mobile" })
        assertTrue(ix.any { it.id == "cat:planner" } && ix.any { it.id == "feat:airdeck" })
        assertEquals(ix.size, ix.map { it.id }.toSet().size)
        assertEquals("feat:airdeck", Kommand.search(ix, "legeger").first().id)
    }

    @Test fun everyNativeTargetIsAFeatureOrAFramePart() {
        val frame = setOf("kompakt", "kommand", "browser")
        for (u in DeskCatalog.UNITS) when (u.reach) {
            Reach.NATIVE -> assertTrue(u.target in frame || Catalogue.byId(u.target) != null, u.id)
            Reach.PC -> assertTrue(u.target.startsWith("port:") || Catalogue.byId(u.target) != null, u.id)
            Reach.WEBAPP -> assertTrue(Regex("[a-z0-9-]+").matches(u.target), u.id)
            Reach.NONE -> assertTrue(u.target.isNotBlank(), u.id)
        }
        assertTrue(DeskCatalog.GROUPS.map { it.first }.containsAll(DeskCatalog.UNITS.map { it.group }.toSet()))
    }

    @Test fun recentAndUrls() {
        assertEquals(listOf("b", "a", "c"), Kommand.remember(listOf("a", "b", "c"), "b"))
        assertEquals(Kommand.MAX_RECENT, Kommand.remember((1..40).map { "x$it" }, "y").size)
        assertEquals("https://claude.ai", Kommand.asUrl("claude.ai"))
        assertEquals("http://192.168.1.2:8124/x", Kommand.asUrl("http://192.168.1.2:8124/x"))
        assertNull(Kommand.asUrl("led kalk"))
        assertNull(Kommand.asUrl("planner"))
    }

    @Test fun homeAndOrientationSettings() {
        assertEquals(HomeMode.DESK, ShellPrefs().home)
        assertEquals(Orientation.PORTRAIT, ShellPrefs().orientation, "D-14: nothing turns on its own after the update")
        assertEquals(Orientation.LANDSCAPE, Orientation.PORTRAIT.next())
        assertEquals(Orientation.AUTO, Orientation.LANDSCAPE.next())
        assertEquals(Orientation.PORTRAIT, Orientation.AUTO.next())
        val p = ShellPrefs(home = HomeMode.COMPACT, orientation = Orientation.AUTO, kommandRecent = listOf("cat:planner", "feat:notes"))
        assertEquals(p, ShellPrefs.fromMap(ShellPrefs.toMap(p)))
        val junk = ShellPrefs.fromMap(mapOf("home" to "nope", "orientation" to 7, "kommandRecent" to "\n\n"))
        assertEquals(HomeMode.DESK, junk.home)
        assertEquals(Orientation.PORTRAIT, junk.orientation)
        assertEquals(emptyList(), junk.kommandRecent)
    }
}

class DeskCatalogueTest {
    @Test fun theAsztalIsBeta() {
        assertEquals(Stage.BETA, Catalogue.DESK.stage)
        assertEquals("M19", Catalogue.DESK.wp)
    }
}
