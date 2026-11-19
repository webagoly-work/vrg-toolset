package hu.vrg.mobile.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// WP M38: the Katalógus has a page for every phone feature, in the home's order, then the Desktop-only programs.
class CatalogGuideTest {

    private val pages = CatalogGuide.PAGES

    @Test fun everyFeatureHasExactlyOnePage() {
        val ids = pages.map { it.id }
        assertEquals(ids.size, ids.toSet().size, "a page twice: " + ids.groupBy { it }.filter { it.value.size > 1 }.keys)
        val phone = ids.filterNot { it.startsWith("desk:") }
        assertEquals(Catalogue.ALL.map { it.id }.toSet(), phone.toSet(), "every catalogue entry, nothing else")
    }

    @Test fun phonePagesFollowTheHomeAndComeFirst() {
        val ids = pages.map { it.id }
        val firstDesk = ids.indexOfFirst { it.startsWith("desk:") }
        assertTrue(firstDesk < 0 || ids.drop(firstDesk).all { it.startsWith("desk:") }, "Desktop-only pages come last")
        // the home's page entries appear in the home's order
        val homeOrder = HomeLayout.PAGES.flatMap { it.items }.map { it.id }
        assertEquals(homeOrder, ids.filter { it in homeOrder })
    }

    @Test fun pagesAreFilledIn() {
        pages.forEach { p ->
            assertTrue(p.title.isNotBlank() && p.glyph.isNotBlank() && p.what.isNotBlank(), p.id)
            assertTrue(p.how.size in 2..5, "${p.id}: ${p.how.size} how lines")
            if (!p.id.startsWith("desk:")) assertEquals(Catalogue.byId(p.id)?.glyph?.let { true } ?: false, true, p.id)
        }
        pages.filter { it.id.startsWith("desk:") }.forEach { assertEquals(GuideSide.DESKTOP, it.side, it.id) }
    }
}
