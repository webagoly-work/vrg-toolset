package hu.vrg.mobile.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull

class StackTest {
    private val json = """{"kind":"vrg-stack-meta","generated":"2026-11-07T13:54:21.654Z","stackGenerated":"2026-11-07T09:23:39.536Z",
        "published":"2026-11-07T15:06:25.335Z","nodes":2068,"points":24859,"lines":50,"files":{"konnektom.html":559878,"holo.html":632195,"retegek.html":512345}}"""

    @Test fun parsesWhatThePublisherWrites() {
        val m = StackMeta.parse(json)!!
        assertEquals(2068, m.nodes); assertEquals(24859, m.points); assertEquals(50, m.lines)
        assertEquals(559878L, m.bytes(StackPages.page("konnektom")))
        assertEquals(632195L, m.bytes(StackPages.page("holo")))
        assertEquals(512345L, m.bytes(StackPages.page("retegek")))
        assertEquals("2026-11-07 13:54", m.generatedLabel)
        assertEquals(m, StackMeta.parse(m.toJson()))
    }

    @Test fun refusesOtherFilesAndMissingPages() {
        assertNull(StackMeta.parse("""{"kind":"vrg-city-meta"}"""))
        assertNull(StackMeta.parse("not json"))
        assertNull(StackMeta.parse("""{"kind":"vrg-stack-meta","published":"x","files":{"konnektom.html":10}}"""))
    }

    @Test fun pathsAndPages() {
        assertEquals("/repos/o/r/contents/stack/meta.json?ref=stack-pages", StackPages.contents("/repos/o/r", StackPages.META))
        assertEquals("konnektom", StackPages.page(null).id)
        assertEquals("holo", StackPages.page("holo").id)
        assertEquals("holo", StackPages.byFile("holo.html")?.id)
        assertNull(StackPages.byFile("x.html"))
    }

    @Test fun syncDecides() {
        val m = StackMeta.parse(json)!!
        val have = mapOf("konnektom.html" to 559878L, "holo.html" to 632195L, "retegek.html" to 512345L)
        assertIs<StackSync.Offline>(StackSync.decide(m, have, null, answered = false))
        assertIs<StackSync.Missing>(StackSync.decide(null, emptyMap(), null, answered = true))
        assertIs<StackSync.Fresh>(StackSync.decide(m, have, m, answered = true))
        assertIs<StackSync.Download>(StackSync.decide(null, emptyMap(), m, answered = true))
        assertIs<StackSync.Download>(StackSync.decide(m, have - "holo.html", m, answered = true))
        assertIs<StackSync.Download>(StackSync.decide(m, have, m.copy(published = "2026-11-08T00:00:00Z"), answered = true))
    }

    @Test fun layerPagesAreOptional() {
        val m = StackMeta.parse(json)!!                         // a publish from before the layer pages
        assertEquals(listOf("konnektom", "holo", "retegek"), m.pages().map { it.id })
        val have = mapOf("konnektom.html" to 559878L, "holo.html" to 632195L, "retegek.html" to 512345L)
        assertIs<StackSync.Fresh>(StackSync.decide(m, have, m, answered = true))
        val withLayers = m.copy(files = m.files + ("dontesek.html" to 90000L))
        assertIs<StackSync.Download>(StackSync.decide(m, have, withLayers, answered = true))
        assertIs<StackSync.Fresh>(StackSync.decide(withLayers, have + ("dontesek.html" to 90000L), withLayers, answered = true))
        assertEquals("dontesek", StackPages.byFile("dontesek.html")?.id)
    }

    @Test fun stackMenuIsTheLayersTopToBottomWithRetegekLast() {
        val rows = StackMenu.ROWS
        assertEquals(listOf("F", "I", "Q", "L", "A", "U", "R", "C", "G", "Z", ""), rows.map { it.layer })
        assertEquals("Rétegek", rows.last().title)
        rows.forEach { r ->                                      // every page target is a real page id
            val t = r.target
            if (t is StackMenu.Target.Page) assertEquals(t.page, StackPages.page(t.page).id)
            if (t is StackMenu.Target.Feature) assertEquals(t.id, Catalogue.byId(t.id)?.id)
        }
        val old = StackMeta.parse(json)!!
        val dontesek = rows.first { it.layer == "Q" }
        assertEquals(false, StackMenu.available(dontesek, old), "not published yet: the row says so")
        assertEquals(true, StackMenu.available(dontesek, old.copy(files = old.files + ("dontesek.html" to 1L))))
        assertEquals(true, StackMenu.available(rows.last(), old))
        assertEquals(false, StackMenu.available(rows.first { it.layer == "Z" }, old))
    }
}
