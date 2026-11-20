package hu.vrg.mobile.core

import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.security.MessageDigest
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Base64
import java.util.zip.GZIPInputStream

// VRG Térkép on the phone (WP M43, D-48 / D-49): the PC's own page (Map/vrg-terkep.html) from GitHub main, on its own https
// origin in a WebView, as Alkalmazások (M21) does. Every request the page makes is answered by the phone (shouldInterceptRequest);
// this file is the plain-Kotlin half of that: which request is what, where it may come from and what may be kept on the phone.
//
// Two ways to the map data, chosen when the map opens:
//  - PC:       the paired PC runs the map server (8802) and the relay proxies it (/p/8802/, WP M8). /data/* (the 1.7 GB offline
//              Hungary, the address index) and /jobs/* (the J layer, MAP-D2 B) come from there.
//  - INTERNET: no PC. The page runs in its ?remote=1 mode: the planet basemap (Protomaps daily build) and terrain (Mapterhorn) are
//              read with HTTP Range straight from their public servers, and every answer is kept in a size-capped cache, so what was
//              looked at once opens again offline on site.
// The libraries (MapLibre GL JS, PMTiles) are not in Git (Vendor/ is fetched): the phone downloads the same pinned npm tarballs as
// tools/fetch-vendor.js, checks their sha512 integrity and keeps the few files the page loads.
//
// D-31 holds: a client's address never leaves the phone unasked. The J layer's data is fetched through the relay only, never stored
// (no-store, no disk cache); the phone's GPS position stays in the page; navigation hands only coordinates (and a job code or sketch
// name the user sees) to the phone's navigation app, and only on a tap.

object MapPhone {
    const val ID = "map"
    val HOST = "$ID.${AppScheme.DOMAIN}"
    val ORIGIN = "https://$HOST"
    const val PC_PORT = 8802

    /** The page and the repo files it loads, all fetched from main and kept for the offline open. */
    val APP = DeskApp(ID, "VRG Térkép", "Map/vrg-terkep.html", listOf("Map/lib", "Map/style"))
    val PAGE_FILES = listOf("Map/vrg-terkep.html", "Map/lib/geocode.js", "Map/lib/jobs-layer.js", "Map/style/terep.json",
        // the weather layer (loaded by the page since its W layer) and the Sketcher's site layer (F1)
        "Map/lib/weather-layer.js", "Map/lib/site-math.js", "Map/lib/site-layer.js")

    /** The script the phone adds to the page (GPS, the Vázlat sites, Navigáció); served from the APK. */
    const val PHONE_JS = "/__phone/phone.js"
    const val SITES = "/__phone/sites.json"
    /** One survey for the site layer (F1): `?id=<sketch id>`; its place, outline, placement and solved rooms. */
    const val SITE = "/__phone/site.json"

    /** = Map/serve.js REMOTE_HOSTS: the public servers ?remote=1 reads. */
    val REMOTE_HOSTS = setOf("build.protomaps.com", "download.mapterhorn.com", "protomaps.github.io")

    /** The Protomaps build the PC page defaults to; the phone moves to a newer one when this one is gone (MapBuilds). */
    const val DEFAULT_BUILD = "20261105"

    /** Hungary with a margin (= the page's maxBounds): navigation and the site pins accept nothing outside it. */
    fun inHungary(lat: Double, lon: Double) = lat in 45.3..49.0 && lon in 15.2..23.8

    enum class Mode { PC, INTERNET }

    /** The page's address for a mode. [hash] is the camera (`#zoom/lat/lon/bearing/pitch`) the map had when it was left. */
    fun pageUrl(mode: Mode, build: String, job: String? = null, hash: String? = null, site: String? = null): String {
        val q = mutableListOf<String>()
        if (mode == Mode.INTERNET) { q += "remote=1"; q += "build=" + (build.takeIf { MapBuilds.valid(it) } ?: DEFAULT_BUILD) }
        job?.takeIf { JOB.matches(it) }?.let { q += "job=$it" }
        site?.takeIf { SITE_ID.matches(it) }?.let { q += "site=$it" }
        val h = hash?.takeIf { HASH.matches(it) } ?: ""
        return "$ORIGIN/vrg-terkep.html" + (if (q.isEmpty()) "" else "?" + q.joinToString("&")) + h
    }

    val JOB = Regex("[A-Za-z0-9_-]{1,24}")
    /** A sketch id (SketchStore: "v" + base-36 time). */
    val SITE_ID = Regex("[A-Za-z0-9_-]{1,64}")
    private val HASH = Regex("#[0-9.]+/-?[0-9.]+/-?[0-9.]+(/-?[0-9.]+(/[0-9.]+)?)?")

    /** The page with the phone's script added before </body> (the page itself is the PC's, unchanged). */
    fun inject(html: String): String {
        val tag = "<script src=\"$PHONE_JS\" defer></script>\n"
        val at = html.lastIndexOf("</body>", ignoreCase = true)
        return if (at < 0) html + tag else html.substring(0, at) + tag + html.substring(at)
    }
}

/** What one request of the map page is. */
sealed interface MapReq {
    /** A repo file from main ([rel] is repo-relative). */
    data class Page(val rel: String) : MapReq
    /** One of the vendored library files. */
    data class Lib(val file: MapVendor.LibFile) : MapReq
    /** The phone's own script or data. */
    data class Phone(val path: String) : MapReq
    /** /data/<rel>: the PC's offline data; [keep] = public data the phone may store (the address index, fonts, sprites). */
    data class Data(val rel: String, val keep: Boolean) : MapReq
    /** /jobs/status or /jobs/helyek.json: client data, through the relay only, never stored. */
    data class Jobs(val path: String) : MapReq
    /** /remote/<host>/<path>: a public map server, read straight and cached. */
    data class Remote(val url: String, val host: String) : MapReq
    data class Refused(val status: Int, val why: String) : MapReq
}

object MapRoute {
    private val SAFE = Regex("[A-Za-z0-9._~%+@-]+")
    private val DATA_FILES = setOf("hungary.pmtiles", "terrain.pmtiles", "addresses.json", "manifest.json")
    private val FONT = Regex("fonts/[A-Za-z0-9 %+._-]+/[0-9]+-[0-9]+\\.pbf")
    private val SPRITE = Regex("sprites/[A-Za-z0-9_-]+(@2x)?\\.(json|png)")

    private fun cleanSegments(path: String): List<String>? {
        val segs = path.split('/').filter { it.isNotEmpty() }
        if (segs.any { it == "." || it == ".." || !SAFE.matches(it) || it.startsWith(".") || it.contains("%2f", true) || it.contains("%5c", true) || it.contains("%2e", true) }) return null
        return segs
    }

    /** [method] and [path] (no query) of a request on the map's origin. */
    fun decide(method: String, path: String): MapReq {
        if (!method.equals("GET", true) && !method.equals("HEAD", true)) return MapReq.Refused(405, "only GET")
        val segs = cleanSegments(path) ?: return MapReq.Refused(403, "path")
        val p = segs.joinToString("/")
        if (p == "" || p == "vrg-terkep.html" || p == "index.html") return MapReq.Page(MapPhone.APP.page)
        if ("Map/$p" in MapPhone.PAGE_FILES && "Map/$p" != MapPhone.APP.page) return MapReq.Page("Map/$p")
        if ("/$p" == MapPhone.PHONE_JS || "/$p" == MapPhone.SITES || "/$p" == MapPhone.SITE) return MapReq.Phone("/$p")
        if (segs[0] == "vendor") return MapVendor.FILES.firstOrNull { it.served == "/$p" }?.let { MapReq.Lib(it) } ?: MapReq.Refused(404, "not a library file")
        if (segs[0] == "jobs") return if (p == "jobs/status" || p == "jobs/helyek.json") MapReq.Jobs("/$p") else MapReq.Refused(404, "jobs")
        if (segs[0] == "data" && segs.size >= 2) {
            val rel = segs.drop(1).joinToString("/")
            val decoded = java.net.URLDecoder.decode(rel.replace("+", "%2B"), "UTF-8")
            return when {
                rel in DATA_FILES -> MapReq.Data(rel, keep = rel == "addresses.json" || rel == "manifest.json")
                FONT.matches(decoded) || SPRITE.matches(rel) -> MapReq.Data(rel, keep = true)
                else -> MapReq.Refused(404, "not map data")
            }
        }
        if (segs[0] == "remote" && segs.size >= 3) {
            val host = segs[1]
            if (host !in MapPhone.REMOTE_HOSTS) return MapReq.Refused(403, "remote host")
            return MapReq.Remote("https://$host/" + segs.drop(2).joinToString("/"), host)
        }
        return MapReq.Refused(404, "not found")
    }

    /**
     * A request off the map's origin may go to the network only for what the page does on the user's tap: the online search
     * (Nominatim, "Keresés az interneten"), the Google view (G: the keyless embed, or Cesium from jsDelivr with the user's key) and
     * the Sketcher site layer's satellite image (🛰: Esri World Imagery; the WebView does not cache it, the tile cache never sees it).
     * Everything else is refused, so nothing the page holds leaves the phone by itself.
     */
    private val OUT_HOSTS = setOf("nominatim.openstreetmap.org", "cdn.jsdelivr.net", "server.arcgisonline.com")
    private val OUT_SUFFIXES = listOf("google.com", "gstatic.com", "googleapis.com", "ggpht.com", "googleusercontent.com")
    fun mayGoOut(scheme: String?, host: String?, method: String?): Boolean {
        if (scheme != "https" || host == null || method == null || !method.equals("GET", true)) return false
        val h = host.lowercase()
        return h in OUT_HOSTS || OUT_SUFFIXES.any { h == it || h.endsWith(".$it") }
    }
}

/** One HTTP byte range as a pmtiles reader asks for it: `bytes=a-b` or `bytes=a-`. */
data class MapRange(val start: Long, val end: Long?) {
    val header: String get() = "bytes=$start-" + (end?.toString() ?: "")

    companion object {
        private val RX = Regex("bytes=(\\d{1,15})-(\\d{0,15})")
        fun parse(h: String?): MapRange? {
            val m = RX.matchEntire(h?.trim() ?: return null) ?: return null
            val a = m.groupValues[1].toLong()
            val b = m.groupValues[2].takeIf { it.isNotEmpty() }?.toLong()
            if (b != null && b < a) return null
            return MapRange(a, b)
        }
    }
}

/** The tile cache's rules: one entry per (url, range); the oldest-used entries go when it is over its size. */
object MapCache {
    const val CAP_BYTES = 400L * 1024 * 1024

    data class Entry(val key: String, val bytes: Long, val used: Long)

    fun key(url: String, range: MapRange?): String {
        val d = MessageDigest.getInstance("SHA-256").digest((url + "|" + (range?.header ?: "")).toByteArray())
        return d.joinToString("") { "%02x".format(it) }
    }

    /** The entries to delete (oldest use first) so the rest fits in [cap]. */
    fun evict(entries: List<Entry>, cap: Long = CAP_BYTES): List<String> {
        var total = entries.sumOf { it.bytes }
        if (total <= cap) return emptyList()
        val out = mutableListOf<String>()
        for (e in entries.sortedBy { it.used }) { if (total <= cap) break; out += e.key; total -= e.bytes }
        return out
    }
}

/** Which Protomaps daily build to read: builds are dated files that disappear after a while, so a gone one is replaced. */
object MapBuilds {
    private val FMT = DateTimeFormatter.ofPattern("yyyyMMdd")
    private val RX = Regex("20\\d{6}")
    const val RECHECK_MS = 24L * 60 * 60 * 1000

    fun valid(b: String?) = b != null && RX.matches(b)
    fun url(build: String) = "https://build.protomaps.com/$build.pmtiles"

    /** The builds to try when the current one is gone, newest first: yesterday back [days] days (today's may not be finished). */
    fun candidates(today: LocalDate, days: Int = 21): List<String> = (1..days).map { today.minusDays(it.toLong()).format(FMT) }

    /** Whether to ask the server again whether [build] still exists. */
    fun recheck(lastOkMs: Long, nowMs: Long) = lastOkMs <= 0 || nowMs - lastOkMs >= RECHECK_MS
}

/** The pinned libraries: the same npm tarballs and versions as vendor-manifest.json, checked by their sha512 integrity. */
object MapVendor {
    data class Pack(val name: String, val version: String, val integrity: String) {
        val tarball: String get() = "https://registry.npmjs.org/$name/-/$name-$version.tgz"
    }
    /** [inTar]: the path inside the npm tarball; [served]: where the page asks for it (= Map/serve.js /vendor/<target>/…). */
    data class LibFile(val pack: Pack, val inTar: String, val served: String) {
        val local: String get() = pack.name + "-" + pack.version + "/" + inTar.substringAfterLast('/')
    }

    // vendor-manifest.json: maplibre-gl 6.16.0, pmtiles 4.5.0. Both BSD-3-Clause (the notices travel inside the files).
    val MAPLIBRE = Pack("maplibre-gl", "6.16.0", "sha512-gApO66EMtoDZuio680RUBvskR7ahFd/NNhLN4tBAs+Y7FeT4gQV8zVFgYVMRmFxQznOEzecW19w6xOd9XjZjiA==")
    val PMTILES = Pack("pmtiles", "4.5.0", "sha512-CBeD4SoUluFziGdy/8k7FOjQxQy486n+929W/tWophauvMICpkZ26vGBWhDt/6b1FZQWNaf4jFdT/5+q0Wii5w==")

    val FILES = listOf(
        LibFile(MAPLIBRE, "package/dist/maplibre-gl.mjs", "/vendor/maplibre-gl/maplibre-gl.mjs"),
        LibFile(MAPLIBRE, "package/dist/maplibre-gl-worker.mjs", "/vendor/maplibre-gl/maplibre-gl-worker.mjs"),
        LibFile(MAPLIBRE, "package/dist/maplibre-gl.css", "/vendor/maplibre-gl/maplibre-gl.css"),
        LibFile(PMTILES, "package/dist/pmtiles.js", "/vendor/pmtiles/pmtiles.js"),
    )
    val PACKS: List<Pack> get() = FILES.map { it.pack }.distinct()

    /** npm's integrity string ("sha512-<base64>") against the tarball's bytes. */
    fun integrityOk(bytes: ByteArray, integrity: String): Boolean {
        if (!integrity.startsWith("sha512-")) return false
        val want = try { Base64.getDecoder().decode(integrity.removePrefix("sha512-")) } catch (e: IllegalArgumentException) { return false }
        return MessageDigest.isEqual(MessageDigest.getInstance("SHA-512").digest(bytes), want)
    }

    /** The [wanted] files of a .tgz (ustar, GNU long names; pax headers are skipped). Missing ones are absent from the map. */
    fun untar(tgz: InputStream, wanted: Set<String>): Map<String, ByteArray> {
        val out = mutableMapOf<String, ByteArray>()
        val inp = GZIPInputStream(tgz)
        val head = ByteArray(512)
        var longName: String? = null
        while (true) {
            if (!readFully(inp, head)) break
            if (head.all { it.toInt() == 0 }) break
            fun str(off: Int, len: Int) = String(head, off, len, Charsets.UTF_8).substringBefore('\u0000')
            val size = str(124, 12).trim().ifEmpty { "0" }.toLong(8)
            val type = head[156].toInt().toChar()
            val prefix = str(345, 155)
            val name = longName ?: (if (prefix.isNotEmpty()) "$prefix/" else "") + str(0, 100)
            longName = null
            val padded = (size + 511) / 512 * 512
            val body = if (type == 'L' || ((type == '0' || type == '\u0000') && name in wanted)) readN(inp, size) else { skip(inp, size); null }
            skip(inp, padded - size)
            when {
                type == 'L' && body != null -> longName = String(body, Charsets.UTF_8).substringBefore('\u0000')
                body != null -> out[name] = body
            }
            if (out.keys.containsAll(wanted)) break
        }
        return out
    }

    private fun readFully(inp: InputStream, b: ByteArray): Boolean {
        var n = 0
        while (n < b.size) { val r = inp.read(b, n, b.size - n); if (r < 0) return false; n += r }
        return true
    }
    private fun readN(inp: InputStream, size: Long): ByteArray {
        val o = ByteArrayOutputStream(size.toInt().coerceAtLeast(0))
        val buf = ByteArray(65536); var left = size
        while (left > 0) { val r = inp.read(buf, 0, minOf(buf.size.toLong(), left).toInt()); if (r < 0) break; o.write(buf, 0, r); left -= r }
        return o.toByteArray()
    }
    private fun skip(inp: InputStream, n: Long) { var left = n; val buf = ByteArray(8192); while (left > 0) { val r = inp.read(buf, 0, minOf(buf.size.toLong(), left).toInt()); if (r < 0) break; left -= r } }
}

/** Navigáció: a geo: link for the phone's navigation app. Coordinates and a short visible label only, never an address. */
object MapNav {
    private val LABEL = Regex("[^\\p{L}0-9 ._-]")

    fun label(s: String?): String = LABEL.replace(s ?: "", "").trim().take(32)

    fun geoUri(lat: Double, lon: Double, label: String?): String? {
        if (lat.isNaN() || lon.isNaN() || !MapPhone.inHungary(lat, lon)) return null
        val l = label(label)
        val c = "%.6f,%.6f".format(java.util.Locale.ROOT, lat, lon)
        return "geo:$c?q=$c" + if (l.isEmpty()) "" else "(" + java.net.URLEncoder.encode(l, "UTF-8").replace("+", "%20") + ")"
    }
}
