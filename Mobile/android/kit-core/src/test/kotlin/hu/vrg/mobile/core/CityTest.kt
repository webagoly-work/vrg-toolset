package hu.vrg.mobile.core

import org.json.JSONObject
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertIs
import kotlin.test.assertNull

class CityTest {
    // the same cases Mobile/tests/city-publish.js checks publish-city.js against
    private val fixture = JSONObject(File("../../tests/fixtures/city-keys.json").readText())

    @Test fun keysMatchThePublisher() {
        val pairs = fixture.getJSONArray("pairs")
        for (i in 0 until pairs.length()) {
            val p = pairs.getJSONObject(i)
            assertEquals(p.getString("key"), CityPages.key(p.getString("branch")), "key(${p.getString("branch")})")
            assertEquals(p.getString("branch"), CityPages.branchOf(p.getString("key")), "branchOf(${p.getString("key")})")
        }
        val bad = fixture.getJSONArray("notKeys")
        for (i in 0 until bad.length()) assertNull(CityPages.branchOf(bad.getString(i)), "branchOf(${bad.getString(i)})")
        assertFailsWith<IllegalArgumentException> { CityPages.key("") }
    }

    @Test fun paths() {
        assertEquals("/repos/o/r/contents/city/claude~2fm5/meta.json?ref=city-pages", CityPages.contents("/repos/o/r", "claude/m5", CityPages.META))
        assertEquals("/repos/o/r/contents/city?ref=city-pages", CityPages.listing("/repos/o/r"))
    }

    @Test fun theListing() {
        val json = """[
            {"name":"zeta","type":"dir"},{"name":"claude~2fm5-city","type":"dir"},{"name":"main","type":"dir"},
            {"name":"README.md","type":"file"},{"name":"bad~zz","type":"dir"},{"name":"alpha","type":"dir"}]"""
        assertEquals(listOf("main", "alpha", "claude/m5-city", "zeta"), CityPages.branches(json))
        assertEquals(emptyList(), CityPages.branches("[]"))
        assertNull(CityPages.branches("""{"message":"Not Found"}"""))
    }

    private val meta = """{"kind":"vrg-city-meta","version":1,"branch":"claude/m5","key":"claude~2fm5",
        "sha":"bfcf6daff4c464aaa3e9e55350de0f708e54dfd6","head":"bfcf6da","scannedAt":"2026-11-06T15:04:35.800Z",
        "commits":346,"files":1773,"htmlBytes":1472664,"run":"https://github.com/o/r/actions/runs/1"}"""

    @Test fun theMetaFile() {
        val m = CityMeta.parse(meta)!!
        assertEquals("claude/m5", m.branch)
        assertEquals(346, m.commits)
        assertEquals(1472664L, m.htmlBytes)
        assertEquals("2026-11-06 15:04", m.scannedLabel)
        assertEquals(m, CityMeta.parse(m.toJson()), "it round-trips (the phone keeps its copy)")
        assertNull(CityMeta.parse("""{"kind":"other","branch":"main","key":"main"}"""))
        assertNull(CityMeta.parse(meta.replace("\"key\":\"claude~2fm5\"", "\"key\":\"main\"")), "a key that is not the branch's")
        assertNull(CityMeta.parse("not json"))
    }

    @Test fun whenToDownload() {
        val remote = CityMeta.parse(meta)!!
        assertIs<CitySync.Download>(CitySync.decide(null, false, remote, true))
        assertEquals(CitySync.Fresh, CitySync.decide(remote, true, remote, true))
        assertIs<CitySync.Download>(CitySync.decide(remote, false, remote, true), "the page file went missing")
        assertIs<CitySync.Download>(CitySync.decide(remote.copy(sha = "0".repeat(40)), true, remote, true), "a newer commit")
        assertIs<CitySync.Download>(CitySync.decide(remote.copy(htmlBytes = 1), true, remote, true), "a cut download")
        assertEquals(CitySync.Offline, CitySync.decide(remote, true, null, false))
        assertEquals(CitySync.Offline, CitySync.decide(null, false, null, false))
        assertEquals(CitySync.Missing, CitySync.decide(remote, true, null, true))
    }

    @Test fun whatThePhoneKeeps() {
        val used = mapOf("a" to 1L, "b" to 5L, "c" to 3L, "d" to 4L, "e" to 2L)
        assertEquals(listOf("e", "a"), CityStore.prune(used, null, 3))
        assertEquals(listOf("e"), CityStore.prune(used, "a", 4), "the shown city stays, however old")
        assertEquals(emptyList(), CityStore.prune(mapOf("main" to 1L), "main"))
    }
}
