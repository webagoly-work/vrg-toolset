package hu.vrg.mobile.core

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

// WP M21 Alkalmazások. AppScheme.decide is Dashboard/shell/lib/appscheme.js decide() on the phone's origins; the cases below are
// Dashboard/test/wp-43.test.js's, with vrg-app://<id>/ written as https://<id>.appassets.androidplatform.net/. Whether a file exists is
// asked of the repo checkout here (on the phone: of main's listing). Then the generated app list and the sync rules.

class AppsTest {
    private val repo = File(System.getProperty("vrg.repo") ?: "../..")
    private val exists: (String) -> Boolean = { File(repo, it).isFile }
    private fun u(id: String, path: String) = "https://$id.${AppScheme.DOMAIN}/$path"
    private fun decide(url: String, apps: List<DeskApp> = DeskApps.ALL) = AppScheme.decide(url, exists, apps)

    @Test fun urlForTheAppPageUnderItsOwnOrigin() {
        assertEquals("https://calc-panel.appassets.androidplatform.net/Calculator/panel_anyagar_kalkulator.html", AppScheme.urlFor("calc-panel"))
        assertEquals("", AppScheme.urlFor("files"))
        assertEquals("", AppScheme.urlFor("nope"))
    }

    @Test fun thePageItsFolderAndSharedAreServedWithAType() {
        var r = decide(u("calc-panel", "Calculator/panel_anyagar_kalkulator.html"))
        assertTrue(r.ok); assertEquals("text/html; charset=utf-8", r.type)
        r = decide(u("calc-panel", "shared/melyviz.css"))
        assertTrue(r.ok, r.why); assertEquals("text/css; charset=utf-8", r.type)
        r = decide(u("calc-panel", ""))
        assertTrue(r.ok); assertTrue(r.rel.endsWith("panel_anyagar_kalkulator.html"), "the root serves the page")
    }

    @Test fun outsideTraversalOtherAppsDotFilesSecretsDrivesAreRefused() {
        fun no(url: String, status: Int? = null) {
            val r = decide(url)
            assertFalse(r.ok, url)
            if (status != null) assertEquals(status, r.status, url + " " + r.why)
        }
        no(u("calc-panel", "launcher/vrg-menu.json"), 403)
        no(u("calc-panel", "Calculator/../tools/anonymise.js"), 403)
        no(u("calc-panel", "Calculator/%2e%2e/tools/anonymise.js"), 403)
        no(u("calc-panel", "Calculator/..%5c..%5cCLAUDE.md"), 403)
        no(u("calc-panel", "%2e%2e/%2e%2e/Windows/win.ini"), 403)
        no(u("calc-panel", "C:/Windows/win.ini"), 403)
        no(u("calc-panel", "MindMap/vrg_mindmap.html"), 403)
        no(u("calc-panel", "Calculator/.secret"), 403)
        no(u("calc-panel", "Calculator/no-such-file.html"), 404)
        no(u("files", "anything"), 404)
        no(u("repo", "x"), 404)
        no("http://calc-panel.${AppScheme.DOMAIN}/Calculator/x.html", 400)
        no("not a url", 400)
        no("https://example.com/Calculator/panel_anyagar_kalkulator.html", 404)
        no("https://${AppScheme.DOMAIN}/Calculator/panel_anyagar_kalkulator.html", 404)
    }

    @Test fun namesWindowsWouldNormaliseStreamsPortsAndUserInfoAreRefused() {
        for (p in listOf("Calculator/panel_anyagar_kalkulator.html.", "Calculator/panel_anyagar_kalkulator.html%20", "Calculator/secrets.bin.", "Calculator/a.pem%20",
            "Calculator./panel_anyagar_kalkulator.html", "Calculator/panel_anyagar_kalkulator.html::\$DATA", "Calculator/panel_anyagar_kalkulator.html%3a%3a\$DATA"))
            assertFalse(decide(u("calc-panel", p)).ok, p)
        assertFalse(decide("https://calc-panel.${AppScheme.DOMAIN}:80/Calculator/panel_anyagar_kalkulator.html").ok)
        assertFalse(decide("https://user@calc-panel.${AppScheme.DOMAIN}/Calculator/panel_anyagar_kalkulator.html").ok)
        assertFalse(AppScheme.sameApp("calc-panel", "https://calc-panel.${AppScheme.DOMAIN}:80/x"))
        assertFalse(AppScheme.sameApp("calc-panel", "https://u@calc-panel.${AppScheme.DOMAIN}/x"))
    }

    @Test fun aRepoRootPageIsServedAloneNeverItsSiblings() {
        val vendor = listOf(DeskApp("vendor", "VRG Vendor", "vrg-vendor.html", listOf("vrg-vendor.html", "shared/")))
        assertTrue(decide(u("vendor", "vrg-vendor.html"), vendor).ok)
        assertFalse(decide(u("vendor", "CLAUDE.md"), vendor).ok)
        assertFalse(decide(u("vendor", "vendor-manifest.json"), vendor).ok)
        assertTrue(decide(u("vendor", "shared/melyviz.css"), vendor).ok)
    }

    @Test fun sameAppOnlyItsOwnOrigin() {
        assertTrue(AppScheme.sameApp("calc-panel", u("calc-panel", "Calculator/x.html")))
        assertFalse(AppScheme.sameApp("calc-panel", u("planner", "x")))
        assertFalse(AppScheme.sameApp("calc-panel", "https://example.com/"))
        assertFalse(AppScheme.sameApp("calc-panel", "file:///C:/x"))
    }

    @Test fun oneOriginPerAppAndTheGeneratedListMatchesTheCatalog() {
        val ids = DeskApps.ALL.map { it.id }
        assertEquals(ids.distinct(), ids)
        assertEquals(DeskCatalog.UNITS.filter { it.reach == Reach.WEBAPP }.map { it.target }.distinct().sorted(), ids.sorted(), "every webapp target is an app")
        assertEquals("planner", DeskCatalog.UNITS.first { it.id == "client-preview" }.target, "Ügyfélnézet shares the Planner's origin")
        for (a in DeskApps.ALL) {
            assertTrue(File(repo, a.page).isFile, a.page + " is in the repo")
            assertTrue(decide(AppScheme.urlFor(a.id)).ok, a.id + " page is served")
            assertEquals(a, AppScheme.byHost(AppScheme.host(a.id)))
            assertTrue(a.allow.contains("shared/"))
        }
        assertNull(AppScheme.byHost(AppScheme.DOMAIN), "the bare domain is no app (the Archívum's)")
    }

    // ------------------------------------------------------------ sync

    private val calc = DeskApps.ALL.first { it.id == "calc-led" }
    private fun e(sha: String, size: Long = 10) = AppEntry(sha, size)

    @Test fun syncFetchesThePageFirstAndOnlyWhatChanged() {
        val remote = mapOf(calc.page to e("a", 100), "Calculator/x.css" to e("c", 5), "Calculator/other.html" to e("o"))
        // first time: only the page (the others are not the phone's yet)
        var s = AppSync.decide(calc, null, emptyMap(), remote, true)
        assertIs<AppStep.Download>(s); assertEquals(listOf(calc.page), s.fetch); assertEquals(100, s.bytes())
        // the page is there and the same; a lazily fetched css changed on main
        val local = AppManifest(mapOf(calc.page to e("a", 100), "Calculator/x.css" to e("old", 5)))
        s = AppSync.decide(calc, local, mapOf(calc.page to 100L, "Calculator/x.css" to 5L), remote, true)
        assertIs<AppStep.Download>(s); assertEquals(listOf("Calculator/x.css"), s.fetch); assertEquals(setOf(calc.page, "Calculator/x.css"), s.remote.keys)
        // all the same
        val same = AppManifest(mapOf(calc.page to e("a", 100), "Calculator/x.css" to e("c", 5)))
        assertEquals(AppStep.Fresh, AppSync.decide(calc, same, mapOf(calc.page to 100L, "Calculator/x.css" to 5L), remote, true))
        // a cut download: same sha, wrong size on the phone
        assertEquals(listOf(calc.page), (AppSync.decide(calc, same, mapOf(calc.page to 40L, "Calculator/x.css" to 5L), remote, true) as AppStep.Download).fetch)
        // a kept file gone from main is dropped
        val gone = AppSync.decide(calc, same, mapOf(calc.page to 100L, "Calculator/x.css" to 5L), mapOf(calc.page to e("a", 100)), true)
        assertIs<AppStep.Download>(gone); assertEquals(listOf("Calculator/x.css"), gone.drop); assertTrue(gone.fetch.isEmpty())
        assertEquals(AppStep.Offline, AppSync.decide(calc, same, emptyMap(), null, false))
        assertEquals(AppStep.Missing, AppSync.decide(calc, same, emptyMap(), mapOf("Calculator/x.css" to e("c")), true), "the page is not on main")
    }

    @Test fun listingsPathsAndManifest() {
        assertEquals(listOf("Calculator", "shared"), AppSync.dirs(calc, listOf("shared/melyviz.css", calc.page)))
        assertEquals("repos/o/r/contents/Planner/projects?ref=main", AppSync.listing("repos/o/r", "Planner/projects"))
        assertEquals("repos/o/r/contents?ref=main", AppSync.listing("repos/o/r", ""))
        assertEquals("repos/o/r/contents/Calculator/Altalanos_Villanyszerelui_Kalkulator.html?ref=main", AppSync.contents("repos/o/r", "Calculator/Altalanos_Villanyszerelui_Kalkulator.html"))
        assertEquals("repos/o/r/contents/a%20b/%C3%A1.html?ref=main", AppSync.contents("repos/o/r", "a b/á.html"))
        val l = AppSync.parseListing("""[{"type":"file","name":"x.html","sha":"s1","size":3},{"type":"dir","name":"sub","sha":"s2","size":0}]""", "Calculator")
        assertEquals(mapOf("Calculator/x.html" to AppEntry("s1", 3)), l)
        assertNull(AppSync.parseListing("""{"message":"Not Found"}""", "x"))
        val m = AppManifest(mapOf(calc.page to e("a", 100)))
        assertEquals(m, AppManifest.parse(m.toJson()))
        assertNull(AppManifest.parse("""{"kind":"other"}"""))
        assertNull(AppManifest.parse(null))
        assertEquals("text/html; charset=utf-8", AppScheme.type("A/B.HTML"))
        assertEquals("application/octet-stream", AppScheme.type("A/noext"))
    }
}
