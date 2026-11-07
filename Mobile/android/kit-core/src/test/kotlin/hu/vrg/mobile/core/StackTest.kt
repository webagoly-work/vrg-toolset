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
}
