package hu.vrg.mobile.core

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// WP M66 (T7): the phone's work browser keeps the VRG Böngésző's rules. The cases are the shared fixture the PC's tests replay
// too (Browser/test/fixtures/links-contract.json: vrg.web-links v1 with the Data Vault kit's cases, the ops, Tiszta link, the
// address bar), plus the engines bundled from Browser/config/engines.json.
class WebTest {
    private val repo = File(System.getProperty("vrg.repo") ?: "../../..")
    private val fx = JSONObject(File(repo, "Browser/test/fixtures/links-contract.json").readText())
    private fun rows(a: JSONArray) = (0 until a.length()).map { i -> a.getJSONArray(i).let { WebRow(it.getString(0), it.getString(1), it.getLong(2)) } }

    @Test fun theBundledEnginesAreThePcs() {
        val pc = File(repo, "Browser/config/engines.json").readText()
        val bundled = File("src/main/resources/web/engines.json").readText()
        assertEquals(pc, bundled, "copy Browser/config/engines.json to kit-core/src/main/resources/web/engines.json")
        assertTrue(WebRules.engines.size >= 20)
        assertEquals(1, WebRules.engines.count { it.isDefault })
    }

    @Test fun readsLikeThePc() {
        val cases = fx.getJSONArray("read")
        for (i in 0 until cases.length()) {
            val c = cases.getJSONObject(i)
            if (c.has("error")) {
                val e = assertFailsWith<WebLinksError> { WebLinks.read(c.getJSONObject("in")) }
                assertEquals(c.getString("error"), e.kind)
                continue
            }
            val r = WebLinks.read(c.getJSONObject("in"))
            assertEquals(rows(c.getJSONArray("bookmarks")), r.bookmarks, "read $i")
            assertEquals(rows(c.getJSONArray("history")), r.history, "read $i")
        }
    }

    @Test fun mergesVisitsAndOpsLikeThePc() {
        val m = fx.getJSONArray("merge").getJSONObject(0)
        val merged = WebLinks.merge(WebLinks.read(m.getJSONObject("a")), WebLinks.read(m.getJSONObject("b")))
        assertEquals(rows(m.getJSONArray("bookmarks")), merged.bookmarks)
        assertEquals(rows(m.getJSONArray("history")), merged.history)
        assertEquals(merged, WebLinks.merge(merged, merged), "merging with itself changes nothing")

        val v = fx.getJSONObject("visits")
        var l = WebLinksData()
        val steps = v.getJSONArray("steps")
        for (i in 0 until steps.length()) steps.getJSONArray(i).let { l = WebLinks.visit(l, it.getString(0), it.getString(1), it.getLong(2)) }
        assertEquals(rows(v.getJSONArray("history")), l.history)

        val o = fx.getJSONObject("ops")
        val ops = WebLinks.parseOps(o.getJSONArray("ops"))
        val once = WebLinks.apply(WebLinks.read(o.getJSONObject("base")), ops)
        assertEquals(rows(o.getJSONArray("bookmarks")), once.bookmarks)
        assertEquals(rows(o.getJSONArray("history")), once.history)
        assertEquals(o.getInt("clean"), WebLinks.cleanOps(ops).size)
        assertEquals(once, WebLinks.apply(once, ops), "an outbox sent twice changes nothing more")
    }

    @Test fun stripsAndReadsTheAddressBarLikeThePc() {
        val s = fx.getJSONArray("strip")
        for (i in 0 until s.length()) s.getJSONArray(i).let { assertEquals(it.getString(1), WebRules.strip(it.getString(0)), it.getString(0)) }
        val a = fx.getJSONArray("address")
        for (i in 0 until a.length()) {
            val c = a.getJSONArray(i)
            val t = WebRules.classify(c.getString(0), WebRules.engines, "google")
            when (c.getString(1)) {
                "url" -> assertEquals(Typed.Url(c.getString(2)), t, c.getString(0))
                "search" -> assertEquals(c.getString(2), (t as Typed.Search).url, c.getString(0))
                "blocked" -> assertEquals(Typed.Blocked, t, c.getString(0))
                "empty" -> assertEquals(Typed.Empty, t, c.getString(0))
            }
        }
        assertEquals("https://www.google.com/", WebRules.searchUrl(WebRules.engines.first { it.id == "google" }, ""), "an empty search opens the engine's home")
    }

    @Test fun theFileRoundTripsAndKeepsTheExtension() {
        val l = WebLinksData(listOf(WebRow("https://a.hu/", "A", 1)), listOf(WebRow("https://b.hu/", "B", 2)), JSONObject().put("meta", JSONObject()))
        val text = WebLinks.write(l, "2026-11-24")
        val j = JSONObject(text)
        assertEquals("vrg.web-links", j.getString("format")); assertEquals(1, j.getInt("v")); assertEquals("2026-11-24", j.getString("exported"))
        assertTrue(j.has("x-bongeszo"))
        assertEquals(l, WebLinks.read(text))
        assertFailsWith<WebLinksError> { WebLinks.read("[]") }
    }

    @Test fun togglePruneGrouped() {
        var l = WebLinksData()
        val (a, on) = WebLinks.toggle(l, "https://a.hu/", "A", 5); assertEquals(true, on); l = a
        assertEquals(false, WebLinks.toggle(l, "https://a.hu/", "A", 6).second)
        assertNull(WebLinks.toggle(l, "file:///x", "x", 7).second)
        val full = WebLinksData((0 until WebLinks.MAX_BOOKMARKS).map { WebRow("https://h$it.hu/", "", it.toLong()) })
        assertNull(WebLinks.toggle(full, "https://new.hu/", "n", 1).second, "the limit")
        val day = 86_400_000L
        val h = WebLinksData(history = listOf(WebRow("https://o.hu/", "", 1), WebRow("https://a.hu/", "A", 50 * day), WebRow("https://a.hu/", "", 60 * day)))
        assertEquals(listOf("https://a.hu/", "https://a.hu/"), WebLinks.prune(h, 30, 70 * day).history.map { it.url })
        val g = WebLinks.grouped(h)
        assertEquals(listOf("https://a.hu/" to 2, "https://o.hu/" to 1), g.map { it.first.url to it.second })
        assertEquals("A", g[0].first.title, "the last title that was not empty")
    }

    @Test fun theContractAndTheLog() {
        assertTrue(WebRules.isWebUrl("https://a.hu/")); assertFalse(WebRules.isWebUrl("javascript:alert(1)")); assertFalse(WebRules.isWebUrl("https://" + "a".repeat(5000)))
        assertEquals("https://a.hu", WebRules.forLog("https://a.hu/titok?token=x#y"), "only the origin is logged")
        assertEquals("none", WebRules.CONTRACT["bridge"])
        assertTrue(WebRules.isPrivateHost("192.168.0.1")); assertFalse(WebRules.isPrivateHost("8.8.8.8"))
        val json = WebLinks.opsJson(listOf(WebOp("visit", "https://a.hu/", "A", 3)))
        assertEquals("visit", json.getJSONObject(0).getString("op"))
    }
}
