package hu.vrg.mobile.core

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.security.MessageDigest
import java.time.LocalDate
import java.util.Base64
import java.util.zip.GZIPOutputStream
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

// WP M43 VRG Térkép on the phone: the request routes, the cache and build rules, the library check, navigation, and that the
// page and its files the phone fetches from main exist in this checkout.

class MapPhoneTest {
    private val repo = File(System.getProperty("vrg.repo") ?: "../..")

    @Test fun thePageAndItsFilesAreInTheRepo() {
        MapPhone.PAGE_FILES.forEach { assertTrue(File(repo, it).isFile, it) }
        assertTrue(MapPhone.APP.page in MapPhone.PAGE_FILES)
        MapPhone.PAGE_FILES.forEach { rel -> assertTrue(MapPhone.APP.allow.any { rel.startsWith("$it/") } || rel == MapPhone.APP.page, rel) }
        // the page still exposes what the phone script needs, and still loads the files the phone serves
        val html = File(repo, MapPhone.APP.page).readText()
        assertTrue(html.contains("window.vrgMap = {") && html.contains("maplibregl"), "window.vrgMap exposes the map and maplibregl")
        MapVendor.FILES.filter { !it.served.endsWith("worker.mjs") }.forEach { assertTrue(html.contains(it.served), it.served) }
        assertTrue(html.contains("/remote/build.protomaps.com/") && html.contains("remote') === '1'"))
        // every /lib file the page loads is one the phone fetches and serves: a missing module stops the whole map
        Regex("['\"]/lib/([A-Za-z0-9_-]+\\.js)['\"]").findAll(html).map { it.groupValues[1] }.toSet().forEach { f ->
            assertTrue("Map/lib/$f" in MapPhone.PAGE_FILES, "the page loads /lib/$f but the phone does not fetch it")
            assertEquals(MapReq.Page("Map/lib/$f"), MapRoute.decide("GET", "/lib/$f"))
        }
    }

    @Test fun everyScriptThePageLoadsIsKept() {
        // a new lib file the page loads must be in PAGE_FILES, or the phone serves the page without it (the shadows, 2026-11-21)
        val html = File(repo, MapPhone.APP.page).readText()
        val refs = Regex("""(?:src="|from '|import\('|fetch\(')/((?:lib|style)/[A-Za-z0-9._-]+)""").findAll(html).map { "Map/" + it.groupValues[1] }.toSet()
        assertTrue("Map/lib/sun.js" in refs && "Map/lib/shadow-layer.js" in refs && "Map/lib/feed-layer.js" in refs && "Map/lib/route-layer.js" in refs && "Map/lib/nav-layer.js" in refs, refs.toString())
        refs.forEach { assertTrue(it in MapPhone.PAGE_FILES, "$it is loaded by the page but not kept on the phone") }
        refs.forEach { assertEquals(MapReq.Page(it), MapRoute.decide("GET", "/" + it.removePrefix("Map/"))) }
    }

    @Test fun theCatalogueEntryIsBeta() {
        assertEquals("map", Catalogue.MAP.id)
        assertEquals(Stage.BETA, Catalogue.MAP.stage)
        assertEquals(MapPhone.ID, Catalogue.MAP.id)
    }

    @Test fun theVendorPinsMatchTheManifest() {
        val m = File(repo, "vendor-manifest.json").readText()
        MapVendor.PACKS.forEach { p -> assertTrue(Regex("\"npmPackage\": \"${p.name}\",\\s*\"npmVersion\": \"${Regex.escape(p.version)}\"").containsMatchIn(m), p.name) }
        assertEquals(setOf("maplibre-gl", "pmtiles"), MapVendor.PACKS.map { it.name }.toSet())
    }

    @Test fun theRemoteHostsAreTheServersOwn() {
        val serve = File(repo, "Map/serve.js").readText()
        MapPhone.REMOTE_HOSTS.forEach { assertTrue(serve.contains("'$it'"), it) }
    }

    @Test fun routes() {
        assertEquals(MapReq.Page("Map/vrg-terkep.html"), MapRoute.decide("GET", "/"))
        assertEquals(MapReq.Page("Map/vrg-terkep.html"), MapRoute.decide("GET", "/vrg-terkep.html"))
        assertEquals(MapReq.Page("Map/lib/jobs-layer.js"), MapRoute.decide("GET", "/lib/jobs-layer.js"))
        assertEquals(MapReq.Page("Map/lib/sun.js"), MapRoute.decide("GET", "/lib/sun.js"))
        assertIs<MapReq.Refused>(MapRoute.decide("GET", "/lib/other.js"))
        assertEquals(MapReq.Page("Map/style/terep.json"), MapRoute.decide("GET", "/style/terep.json"))
        assertIs<MapReq.Refused>(MapRoute.decide("GET", "/serve.js"))
        assertIs<MapReq.Refused>(MapRoute.decide("GET", "/tools/build-jobs.js"))
        assertEquals(MapReq.Phone(MapPhone.PHONE_JS), MapRoute.decide("GET", MapPhone.PHONE_JS))
        assertEquals(MapReq.Phone(MapPhone.SITE), MapRoute.decide("GET", MapPhone.SITE))
        assertEquals(MapReq.Page("Map/lib/site-layer.js"), MapRoute.decide("GET", "/lib/site-layer.js"))
        assertIs<MapReq.Refused>(MapRoute.decide("GET", "/lib/other.js"))
        assertIs<MapReq.Refused>(MapRoute.decide("POST", MapPhone.SITE))
        val lib = MapRoute.decide("GET", "/vendor/maplibre-gl/maplibre-gl-worker.mjs")
        assertIs<MapReq.Lib>(lib); assertEquals("maplibre-gl-6.16.0/maplibre-gl-worker.mjs", lib.file.local)
        assertIs<MapReq.Refused>(MapRoute.decide("GET", "/vendor/maplibre-gl/package.json"))
        assertEquals(MapReq.Data("hungary.pmtiles", false), MapRoute.decide("HEAD", "/data/hungary.pmtiles"))
        assertEquals(MapReq.Data("addresses.json", true), MapRoute.decide("GET", "/data/addresses.json"))
        assertEquals(MapReq.Data("pois.json", true), MapRoute.decide("GET", "/data/pois.json"))
        assertEquals(MapReq.Data("roads.bin", true), MapRoute.decide("GET", "/data/roads.bin"))
        assertEquals(MapReq.Data("fonts/Noto%20Sans%20Regular/0-255.pbf", true), MapRoute.decide("GET", "/data/fonts/Noto%20Sans%20Regular/0-255.pbf"))
        assertEquals(MapReq.Data("sprites/light@2x.png", true), MapRoute.decide("GET", "/data/sprites/light@2x.png"))
        assertIs<MapReq.Refused>(MapRoute.decide("GET", "/data/src/hungary-latest.osm.pbf"))
        assertEquals(MapReq.Jobs("/jobs/helyek.json"), MapRoute.decide("GET", "/jobs/helyek.json"))
        assertIs<MapReq.Refused>(MapRoute.decide("GET", "/jobs/helyek-log.jsonl"))
        assertEquals(MapReq.Remote("https://build.protomaps.com/20261105.pmtiles", "build.protomaps.com"),
            MapRoute.decide("GET", "/remote/build.protomaps.com/20261105.pmtiles"))
        assertIs<MapReq.Refused>(MapRoute.decide("GET", "/remote/evil.example.com/x"))
        // no climbing, no dot-files, no writes
        for (p in listOf("/../secrets", "/data/../../.ssh/id", "/data/%2e%2e/x", "/remote/build.protomaps.com/..%2f..", "/.env"))
            assertIs<MapReq.Refused>(MapRoute.decide("GET", p), p)
        assertIs<MapReq.Refused>(MapRoute.decide("POST", "/jobs/status"))
    }

    @Test fun onlyTheTappedOnlineServicesGoOut() {
        assertTrue(MapRoute.mayGoOut("https", "nominatim.openstreetmap.org", "GET"))
        assertTrue(MapRoute.mayGoOut("https", "maps.google.com", "GET"))
        assertTrue(MapRoute.mayGoOut("https", "tile.googleapis.com", "GET"))
        assertTrue(MapRoute.mayGoOut("https", "cdn.jsdelivr.net", "GET"))
        assertTrue(MapRoute.mayGoOut("https", "api.tomtom.com", "GET"))
        assertFalse(MapRoute.mayGoOut("https", "api.tomtom.com", "POST"))
        assertTrue(MapRoute.mayGoOut("https", "server.arcgisonline.com", "GET"))   // the site layer's 🛰, on the tap only
        assertFalse(MapRoute.mayGoOut("https", "server.arcgisonline.com", "POST"))
        assertFalse(MapRoute.mayGoOut("http", "maps.google.com", "GET"))
        assertFalse(MapRoute.mayGoOut("https", "nominatim.openstreetmap.org", "POST"))
        assertFalse(MapRoute.mayGoOut("https", "evilgoogle.com", "GET"))
        assertFalse(MapRoute.mayGoOut("https", "example.com", "GET"))
        assertFalse(MapRoute.mayGoOut("https", "build.protomaps.com", "GET"))   // through /remote/ and the cache, not around it
    }

    @Test fun pageUrlAndInjection() {
        assertEquals("https://map.appassets.androidplatform.net/vrg-terkep.html", MapPhone.pageUrl(MapPhone.Mode.PC, "x"))
        assertEquals("https://map.appassets.androidplatform.net/vrg-terkep.html?remote=1&build=20261119#14.2/47.5/19.04/-15/45",
            MapPhone.pageUrl(MapPhone.Mode.INTERNET, "20261119", hash = "#14.2/47.5/19.04/-15/45"))
        assertEquals("https://map.appassets.androidplatform.net/vrg-terkep.html?remote=1&build=${MapPhone.DEFAULT_BUILD}&job=BK2",
            MapPhone.pageUrl(MapPhone.Mode.INTERNET, "bad", job = "BK2", hash = "#<script>"))
        assertEquals("https://map.appassets.androidplatform.net/vrg-terkep.html", MapPhone.pageUrl(MapPhone.Mode.PC, "", job = "a&b=1"))
        assertEquals("https://map.appassets.androidplatform.net/vrg-terkep.html?site=v1abc", MapPhone.pageUrl(MapPhone.Mode.PC, "", site = "v1abc"))
        assertEquals("https://map.appassets.androidplatform.net/vrg-terkep.html", MapPhone.pageUrl(MapPhone.Mode.PC, "", site = "../x"))
        val html = MapPhone.inject("<html><body><p>x</p></body></html>")
        assertTrue(html.contains("<script src=\"/__phone/phone.js\" defer></script>\n</body>"))
        val real = MapPhone.inject(File(repo, MapPhone.APP.page).readText())
        assertTrue(real.indexOf(MapPhone.PHONE_JS) > real.indexOf("window.vrgMap"))
    }

    @Test fun ranges() {
        assertEquals(MapRange(0, 16383), MapRange.parse("bytes=0-16383"))
        assertEquals(MapRange(512, null), MapRange.parse("bytes=512-"))
        assertEquals("bytes=512-", MapRange(512, null).header)
        assertNull(MapRange.parse("bytes=10-5"))
        assertNull(MapRange.parse("bytes=0-1,5-6"))
        assertNull(MapRange.parse(null))
    }

    @Test fun cacheKeysAndEviction() {
        val a = MapCache.key("https://x/y.pmtiles", MapRange(0, 9))
        assertEquals(64, a.length)
        assertTrue(a != MapCache.key("https://x/y.pmtiles", MapRange(0, 10)))
        assertTrue(a != MapCache.key("https://x/z.pmtiles", MapRange(0, 9)))
        assertEquals(a, MapCache.key("https://x/y.pmtiles", MapRange.parse("bytes=0-9")))
        val es = listOf(MapCache.Entry("old", 60, 1), MapCache.Entry("new", 60, 3), MapCache.Entry("mid", 60, 2))
        assertEquals(emptyList(), MapCache.evict(es, 200))
        assertEquals(listOf("old"), MapCache.evict(es, 150))
        assertEquals(listOf("old", "mid"), MapCache.evict(es, 60))
    }

    @Test fun builds() {
        val c = MapBuilds.candidates(LocalDate.of(2026, 11, 20), 3)
        assertEquals(listOf("20261119", "20261118", "20261117"), c)
        assertTrue(MapBuilds.valid("20261105")); assertFalse(MapBuilds.valid("2026-11-05")); assertFalse(MapBuilds.valid(null))
        assertEquals("https://build.protomaps.com/20261105.pmtiles", MapBuilds.url("20261105"))
        assertTrue(MapBuilds.recheck(0, 5)); assertFalse(MapBuilds.recheck(1000, 2000)); assertTrue(MapBuilds.recheck(1000, 1000 + MapBuilds.RECHECK_MS))
    }

    // a tiny npm-like tarball: package/dist/a.js, a long-named file, package/x.txt
    private fun tar(files: List<Pair<String, ByteArray>>): ByteArray {
        val o = ByteArrayOutputStream()
        fun header(name: String, size: Int, type: Char) {
            val h = ByteArray(512)
            name.toByteArray().copyInto(h, 0, 0, minOf(100, name.length))
            "%011o\u0000".format(size).toByteArray().copyInto(h, 124)
            h[156] = type.code.toByte()
            "ustar\u0000".toByteArray().copyInto(h, 257)
            o.write(h)
        }
        fun body(b: ByteArray) { o.write(b); o.write(ByteArray(((b.size + 511) / 512 * 512) - b.size)) }
        for ((n, b) in files) {
            if (n.length > 100) { val nb = (n + "\u0000").toByteArray(); header("././@LongLink", nb.size, 'L'); body(nb) }
            header(n, b.size, '0'); body(b)
        }
        o.write(ByteArray(1024))
        val g = ByteArrayOutputStream(); GZIPOutputStream(g).use { it.write(o.toByteArray()) }
        return g.toByteArray()
    }

    @Test fun untarAndIntegrity() {
        val long = "package/dist/" + "x".repeat(120) + ".js"
        val big = ByteArray(1300) { (it % 251).toByte() }
        val tgz = tar(listOf("package/x.txt" to "skip".toByteArray(), "package/dist/a.js" to big, long to "L".toByteArray()))
        val got = MapVendor.untar(ByteArrayInputStream(tgz), setOf("package/dist/a.js", long, "package/dist/missing.js"))
        assertTrue(got["package/dist/a.js"]!!.contentEquals(big))
        assertEquals("L", String(got[long]!!))
        assertFalse("package/x.txt" in got); assertFalse("package/dist/missing.js" in got)
        val integ = "sha512-" + Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-512").digest(tgz))
        assertTrue(MapVendor.integrityOk(tgz, integ))
        assertFalse(MapVendor.integrityOk(tgz + byteArrayOf(1), integ))
        assertFalse(MapVendor.integrityOk(tgz, "sha1-abc"))
        assertFalse(MapVendor.integrityOk(tgz, "sha512-!!!"))
    }

    @Test fun navigationSendsCoordinatesAndALabelOnly() {
        assertEquals("geo:47.497900,19.040200?q=47.497900,19.040200(BK2)", MapNav.geoUri(47.4979, 19.0402, "BK2"))
        assertEquals("geo:47.497900,19.040200?q=47.497900,19.040200(Kert%C3%A9sz%20f%C3%B6ldszint)", MapNav.geoUri(47.4979, 19.0402, "Kertész <földszint>"))
        assertEquals("geo:47.497900,19.040200?q=47.497900,19.040200", MapNav.geoUri(47.4979, 19.0402, null))
        assertNull(MapNav.geoUri(51.5, -0.12, "London"))
        assertNull(MapNav.geoUri(Double.NaN, 19.0, "x"))
        assertEquals(32, MapNav.label("a".repeat(50)).length)
    }
}
