package hu.vrg.mobile.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ArchiveTest {
    // what GitHub's contents API answers for a folder (trimmed to the fields the phone reads)
    private val root = """[
        {"name":"archive.js","path":"Archive/archive.js","sha":"a1","size":8695,"type":"file"},
        {"name":"files","path":"Archive/files","sha":"d1","size":0,"type":"dir"},
        {"name":"index.js","path":"Archive/index.js","sha":"i1","size":32627,"type":"file"},
        {"name":"index.json","path":"Archive/index.json","sha":"j1","size":35740,"type":"file"},
        {"name":"vrg-archive.html","path":"Archive/vrg-archive.html","sha":"v1","size":23614,"type":"file"}]"""
    private val files = """[
        {"name":"kit-gyar.html","path":"Archive/files/kit-gyar.html","sha":"k1","size":95227,"type":"file"},
        {"name":"sui-rings.html","path":"Archive/files/sui-rings.html","sha":"s1","size":34244,"type":"file"},
        {"name":"notes.txt","path":"Archive/files/notes.txt","sha":"n1","size":10,"type":"file"}]"""

    @Test fun listingsKeepOnlyTheViewerItsDataAndThePages() {
        val m = ArchiveManifest.fromListings(root, files)!!
        assertEquals(setOf("vrg-archive.html", "index.js", "files/kit-gyar.html", "files/sui-rings.html"), m.files.keys)
        assertEquals(2, m.pages)
        assertTrue(m.complete)
        assertEquals(23614L + 32627 + 95227 + 34244, m.bytes)
        assertEquals(m, ArchiveManifest.parse(m.toJson()))
        assertEquals(ArchiveManifest(m.files.filterKeys { !it.startsWith("files/") }), ArchiveManifest.fromListings(root, null))
        assertNull(ArchiveManifest.fromListings("""{"message":"Not Found"}""", null))
        assertNull(ArchiveManifest.parse("""{"kind":"vrg-stack-meta"}"""))
        assertNull(ArchiveManifest.parse("not json"))
    }

    @Test fun pathsAndRoutes() {
        assertEquals("/repos/o/r/contents/Archive?ref=main", ArchivePages.listing("/repos/o/r"))
        assertEquals("/repos/o/r/contents/Archive/files?ref=main", ArchivePages.listing("/repos/o/r", ArchivePages.FILES))
        assertEquals("/repos/o/r/contents/Archive/files/x.html?ref=main", ArchivePages.contents("/repos/o/r", "files/x.html"))
        assertEquals("vrg-archive.html", ArchivePages.route(listOf("archive", "vrg-archive.html")))
        assertEquals("index.js", ArchivePages.route(listOf("archive", "index.js")))
        assertEquals("files/kit-gyar.html", ArchivePages.route(listOf("archive", "files", "kit-gyar.html")))
        assertNull(ArchivePages.route(listOf("archive", "index.json")))
        assertNull(ArchivePages.route(listOf("archive", "archive.js")))
        assertNull(ArchivePages.route(listOf("archive", "files", "..", "index.json")))
        assertNull(ArchivePages.route(listOf("archive", "files", ".hidden.html")))
        assertNull(ArchivePages.route(listOf("stack", "holo.html")))
        assertNull(ArchivePages.route(listOf("archive")))
        assertEquals("application/javascript", ArchivePages.mime("index.js"))
        assertEquals("text/html", ArchivePages.mime("files/x.html"))
    }

    @Test fun syncDownloadsOnlyWhatChanged() {
        val remote = ArchiveManifest.fromListings(root, files)!!
        val have = remote.files.mapValues { it.value.size }
        assertIs<ArchiveSync.Offline>(ArchiveSync.decide(remote, have, null, answered = false))
        assertIs<ArchiveSync.Missing>(ArchiveSync.decide(null, emptyMap(), null, answered = true))
        // a listing without the viewer is not an archive yet
        assertIs<ArchiveSync.Missing>(ArchiveSync.decide(null, emptyMap(), ArchiveManifest(remote.files - "index.js"), answered = true))
        assertIs<ArchiveSync.Fresh>(ArchiveSync.decide(remote, have, remote, answered = true))

        // first time: everything, the viewer and its data first
        val first = ArchiveSync.decide(null, emptyMap(), remote, answered = true) as ArchiveSync.Download
        assertEquals(listOf("index.js", "vrg-archive.html", "files/kit-gyar.html", "files/sui-rings.html"), first.fetch)
        assertEquals(remote.bytes, first.bytes())

        // one page changed on main, one was removed there, one new: fetch two, drop one
        val changed = ArchiveManifest(remote.files - "files/sui-rings.html" +
            ("files/kit-gyar.html" to ArchiveEntry("k2", 96000)) + ("files/new.html" to ArchiveEntry("x1", 100)))
        val step = ArchiveSync.decide(remote, have, changed, answered = true) as ArchiveSync.Download
        assertEquals(listOf("files/kit-gyar.html", "files/new.html"), step.fetch)
        assertEquals(listOf("files/sui-rings.html"), step.drop)

        // a cut file (size differs) is fetched again even with the same sha
        val cut = ArchiveSync.decide(remote, have + ("files/kit-gyar.html" to 10L), remote, answered = true) as ArchiveSync.Download
        assertEquals(listOf("files/kit-gyar.html"), cut.fetch)
    }

    @Test fun onlyTheArtifactCdnsLeaveThePhone() {
        assertTrue(ArchiveWeb.mayLoad("https", "fonts.googleapis.com", "GET"))
        assertTrue(ArchiveWeb.mayLoad("https", "cdnjs.cloudflare.com", "get"))
        assertFalse(ArchiveWeb.mayLoad("http", "fonts.googleapis.com", "GET"))
        assertFalse(ArchiveWeb.mayLoad("https", "fonts.googleapis.com", "POST"))
        assertFalse(ArchiveWeb.mayLoad("https", "claude.ai", "GET"))
        assertFalse(ArchiveWeb.mayLoad("https", "api.github.com", "GET"))
        assertFalse(ArchiveWeb.mayLoad("https", null, "GET"))
    }

    @Test fun backLeavesOnlyFromTheList() {
        assertTrue(ArchiveWeb.leaves("\"list\""))
        assertTrue(ArchiveWeb.leaves("\"none\""))
        assertTrue(ArchiveWeb.leaves("null"))
        assertTrue(ArchiveWeb.leaves(null))
        assertFalse(ArchiveWeb.leaves("\"viewer\""))
        assertFalse(ArchiveWeb.leaves("\"detail\""))
    }

    @Test fun inTheCatalogue() {
        assertEquals("M18", Catalogue.ARCHIVE.wp)
        assertEquals(Stage.BETA, Catalogue.ARCHIVE.stage)
        assertEquals(Catalogue.ARCHIVE, Catalogue.byId("archive"))
    }
}
