package hu.vrg.mobile.map

import android.Manifest
import android.annotation.SuppressLint
import android.app.Application
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.net.Uri
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.GeolocationPermissions
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.AppEntry
import hu.vrg.mobile.core.AppManifest
import hu.vrg.mobile.core.AppScheme
import hu.vrg.mobile.core.AppStep
import hu.vrg.mobile.core.AppSync
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.GitHubUrls
import hu.vrg.mobile.core.MapBuilds
import hu.vrg.mobile.core.MapCache
import hu.vrg.mobile.core.MapNav
import hu.vrg.mobile.core.MapPhone
import hu.vrg.mobile.core.MapRange
import hu.vrg.mobile.core.MapReq
import hu.vrg.mobile.core.MapRoute
import hu.vrg.mobile.core.MapVendor
import hu.vrg.mobile.core.MiniStatus
import hu.vrg.mobile.core.Ports
import hu.vrg.mobile.core.PortsMsgs
import hu.vrg.mobile.core.PortsNote
import hu.vrg.mobile.core.Route
import hu.vrg.mobile.core.VrgRepo
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.ShellSettings
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.github.Gh
import hu.vrg.mobile.kit.github.GitHub
import hu.vrg.mobile.kit.github.problem
import hu.vrg.mobile.kit.relay.Relay
import hu.vrg.mobile.kit.relay.Trust
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.MiniTrack
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.sketch.SiteLink
import hu.vrg.mobile.sketch.SketchJson
import hu.vrg.mobile.sketch.Solver
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.mapNotNull
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.FilterInputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate
import java.util.concurrent.atomic.AtomicInteger

// VRG Térkép (WP M43, D-48 = A, D-49 = A + B + C). The PC's own page, Map/vrg-terkep.html, from GitHub main on its own origin
// (https://map.appassets.androidplatform.net/), every request answered here. The rules (which request is what, the cache keys, the
// pinned libraries, the navigation link) are kit-core's MapPhone.kt; this file does the I/O.
//
//  - The page and its three files: from main through the contents API (AppSync, as Alkalmazások), kept for the offline open.
//  - MapLibre GL JS and PMTiles: the npm tarballs of vendor-manifest.json's versions, sha512-checked, the four files kept.
//  - PC mode: the paired PC's map server through the relay's /p/8802/ (WP M8): /data/* (offline Hungary, the address index) and
//    /jobs/* (the J layer). The public parts the page loads from /data (the address index, its manifest, fonts, sprites) are kept, so
//    search works on site; the client data (/jobs/*) is never kept: no-store, no file, MAP-D2's log on the PC.
//  - Internet mode (no PC): the page's ?remote=1. /remote/<host>/… is read from the public server with the page's Range header and
//    each answer kept in a size-capped cache (MapCache), so a place looked at once opens again offline.
//  - The phone's script (assets/map-phone.js) adds the GPS position, the Vázlat sites and Navigáció (vrg-map:nav → a geo: intent).

object MapFeature : VrgFeature {
    override val info = Catalogue.MAP
    private const val TAG = "map"
    private const val RAW = "application/vnd.github.raw"
    private const val UA = "VRG-Mobile-Map"

    enum class Mode { PC, INTERNET, OFFLINE }

    data class State(
        val busy: Boolean = false,
        val step: String? = null,
        val problem: String? = null,
        val mode: Mode? = null,
        /** The page address to load, once everything it needs is on the phone. */
        val url: String? = null,
        val loaded: Int = 0,
        val pcNote: String? = null,
    )

    val state = MutableStateFlow(State())
    private val ring = MiniTrack()
    override val activity: StateFlow<MiniStatus> get() = ring.status

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val lock = Mutex()
    private lateinit var root: File
    private lateinit var sketches: File
    private lateinit var prefs: SharedPreferences
    private lateinit var appCtx: Context

    /** The paired PC's relay link for /p/8802/: its ws:// address and the proxy token (null = no PC). */
    @Volatile private var pc: Pair<String, String>? = null
    @Volatile private var pendingJob: String? = null
    /** F1: the survey whose Helyszín the map opens on (vrg://map?site=<id>), until the page is built for it. */
    @Volatile private var pendingSite: String? = null
    /** The survey the open page is on (its site layer), so ‹ and Back return to the Sketcher instead of the home. */
    @Volatile private var activeSite: String? = null
    private val writes = AtomicInteger()

    override fun init(app: Application) {
        appCtx = app
        root = File(app.filesDir, "map")
        sketches = File(app.filesDir, "sketch")
        prefs = app.getSharedPreferences("vrg-map", Context.MODE_PRIVATE)
    }

    /** vrg://map opens the map; vrg://map?job=BK2 (or vrg://map/job/BK2) flies to that job (the J layer, PC only). */
    override fun open(route: Route): Boolean {
        val job = route.params["job"] ?: route.path.trim('/').removePrefix("job/").takeIf { route.path.trim('/').startsWith("job/") }
        if (job != null && MapPhone.JOB.matches(job)) { pendingJob = job; state.update { it.copy(url = null) } }
        route.params["site"]?.takeIf { MapPhone.SITE_ID.matches(it) }?.let { pendingSite = it; state.update { s -> s.copy(url = null) } }
        return true
    }

    private fun set(f: (State) -> State) = state.update(f)

    // ---- preparing: page, libraries, mode ----------------------------------------------------------------------

    fun prepare() {
        if (state.value.busy) return
        set { it.copy(busy = true, problem = null) }
        ring.run()
        scope.launch {
            try {
                lock.withLock {
                    val page = syncPage()
                    val libs = syncLibs()
                    val mode = chooseMode()
                    val missing = page ?: libs
                    val hash = prefs.getString("hash", null)
                    val url = if (missing != null && !haveAll()) null
                        else MapPhone.pageUrl(if (mode == Mode.PC) MapPhone.Mode.PC else MapPhone.Mode.INTERNET, build(), pendingJob, hash, pendingSite)
                    activeSite = pendingSite; pendingJob = null; pendingSite = null
                    set { it.copy(mode = mode, url = url, loaded = it.loaded + 1, problem = missing, step = null) }
                    if (url == null) ring.fail() else ring.done()
                }
            } catch (e: Exception) {
                VrgLog.w(TAG, "prepare: ${e.message}")
                set { it.copy(problem = "Hiba: ${e.javaClass.simpleName}") }
                ring.fail()
            } finally { set { it.copy(busy = false, step = null) } }
        }
    }

    private fun pageFile(rel: String) = File(root, "page/$rel")
    private fun libFile(f: MapVendor.LibFile) = File(root, "lib/${f.local}")
    private fun haveAll() = MapPhone.PAGE_FILES.all { pageFile(it).isFile } && MapVendor.FILES.all { libFile(it).isFile }

    /** The page files from main (changed ones only); null = fine, else why not (the phone's copy still opens if it has one). */
    private suspend fun syncPage(): String? {
        val mf = File(root, "page/manifest.json")
        val mine = AppManifest.parse(mf.takeIf { it.isFile }?.readText())
        if (!GitHub.signedIn) return if (mine != null) null else "A repó privát: az első letöltéshez GitHub belépés kell."
        set { it.copy(step = "A térkép oldala a GitHubról…") }
        // every page file is kept, not only the ones the page asked for: seed the manifest with the missing ones
        val seeded = AppManifest((mine?.files ?: emptyMap()) + MapPhone.PAGE_FILES.filter { mine?.files?.containsKey(it) != true }.associateWith { AppEntry("", -1) })
        val have = seeded.files.keys.mapNotNull { rel -> pageFile(rel).takeIf { it.isFile }?.let { rel to it.length() } }.toMap()
        val remote = mutableMapOf<String, AppEntry>()
        for (d in AppSync.dirs(MapPhone.APP, seeded.files.keys)) {
            when (val r = GitHub.get(AppSync.listing(VrgRepo.PATH, d))) {
                is Gh.Ok -> remote += AppSync.parseListing(r.value, d) ?: return "A GitHub válasza nem mappalista ($d)."
                else -> return (r.problem() ?: "A GitHub nem válaszolt.") + if (mine != null) " A telefonon lévő változat nyílik." else ""
            }
        }
        val step = AppSync.decide(MapPhone.APP, seeded, have, remote, true)
        if (step is AppStep.Missing) return "A main ágon nincs meg a térkép oldala."
        if (step !is AppStep.Download) return null
        val now = (mine?.files ?: emptyMap()).toMutableMap()
        for (rel in step.fetch) {
            val want = step.remote.getValue(rel)
            val dest = pageFile(rel); dest.parentFile?.mkdirs()
            val part = File(dest.path + ".part")
            val got = GitHub.download(GitHubUrls.API + AppSync.contents(VrgRepo.PATH, rel), part, RAW)
            if (got !is Gh.Ok || part.length() != want.size) { part.delete(); return got.problem() ?: "A letöltés nem lett teljes ($rel)." }
            dest.delete(); part.renameTo(dest)
            now[rel] = want
        }
        for (rel in step.drop) { pageFile(rel).delete(); now.remove(rel) }
        mf.parentFile?.mkdirs(); mf.writeText(AppManifest(now).toJson())
        VrgLog.i(TAG, "oldal: ${step.fetch.size} fájl frissítve")
        return null
    }

    /** The libraries: each pinned tarball once, integrity-checked, its files kept. */
    private fun syncLibs(): String? {
        for (pack in MapVendor.PACKS) {
            val files = MapVendor.FILES.filter { it.pack == pack }
            if (files.all { libFile(it).isFile }) continue
            set { it.copy(step = "Térképmotor: ${pack.name} ${pack.version}…") }
            val bytes = try { httpBytes(pack.tarball, 20L * 1024 * 1024) } catch (e: Exception) { null }
                ?: return "A térképmotor (${pack.name}) nem tölthető le: nincs internet?"
            if (!MapVendor.integrityOk(bytes, pack.integrity)) { VrgLog.w(TAG, "${pack.name}: integritás hibás"); return "A ${pack.name} csomag ellenőrzése nem sikerült (sha512)." }
            val got = MapVendor.untar(ByteArrayInputStream(bytes), files.map { it.inTar }.toSet())
            for (f in files) {
                val b = got[f.inTar] ?: return "A ${pack.name} csomagból hiányzik: ${f.inTar}"
                val dest = libFile(f); dest.parentFile?.mkdirs()
                val part = File(dest.path + ".part"); part.writeBytes(b); dest.delete(); part.renameTo(dest)
            }
            VrgLog.i(TAG, "${pack.name} ${pack.version}: ${bytes.size / 1024} KB, ellenőrizve")
        }
        return null
    }

    /** PC when the relay reaches the PC's map server and it has the offline data; else the internet, or what the phone keeps. */
    private suspend fun chooseMode(): Mode {
        set { it.copy(step = "A PC keresése…") }
        val (link, why) = relayLink()
        pc = link
        set { it.copy(pcNote = why) }
        if (link != null) {
            val ok = try { relayOpen("/data/hungary.pmtiles", "HEAD", null).let { c -> val s = c.responseCode; c.disconnect(); s == 200 } } catch (e: Exception) { false }
            if (ok) return Mode.PC
            set { it.copy(pcNote = "A PC térképe fut, de nincs letöltve az adata (node Map/tools/fetch-data.js).") }
        }
        set { it.copy(step = "A térképadat ellenőrzése…") }
        return if (checkBuild()) Mode.INTERNET else Mode.OFFLINE
    }

    private suspend fun relayLink(): Pair<Pair<String, String>?, String?> {
        if (Relay.trust.value != Trust.TRUSTED) return null to "Munkák és a PC adata: párosított PC kell (QR párosítás)."
        val relay = ShellSettings.value.relayUrl.takeIf { it.isNotEmpty() } ?: return null to "Nincs relé beállítva."
        return coroutineScope {
            val reply = async(start = CoroutineStart.UNDISPATCHED) {
                withTimeoutOrNull(6000) { Relay.incoming.mapNotNull { (PortsMsgs.parse(it) as? PortsNote.Listed)?.list }.first() }
            }
            if (!Relay.send(PortsMsgs.list())) { reply.cancel(); return@coroutineScope null to "Nincs kapcsolat a PC reléjével." }
            val l = reply.await() ?: return@coroutineScope null to "A PC nem válaszolt."
            when {
                !l.proxyOn -> null to "A relé --ports nélkül fut (Mobile\\mobile.cmd relay)."
                l.entries.none { it.port == MapPhone.PC_PORT } -> null to "A VRG Térkép nem fut a PC-n (START: szerver H)."
                l.token == null -> null to "A relé nem adott belépőt."
                else -> (relay to l.token!!) to null
            }
        }
    }

    private fun build(): String = prefs.getString("build", null)?.takeIf { MapBuilds.valid(it) } ?: MapPhone.DEFAULT_BUILD

    /** Whether the Protomaps build answers; when it is gone, the newest one that does (the old build's cache then ages out). */
    private fun checkBuild(): Boolean {
        val now = System.currentTimeMillis()
        if (!MapBuilds.recheck(prefs.getLong("buildOk", 0), now)) return true
        fun exists(b: String) = try {
            val c = open(MapBuilds.url(b), "GET", MapRange(0, 0).header); val s = c.responseCode; c.disconnect(); s == 206 || s == 200
        } catch (e: Exception) { null }
        when (exists(build())) {
            true -> { prefs.edit().putLong("buildOk", now).apply(); return true }
            null -> return false                                     // no internet: the cache is all there is
            false -> {}
        }
        for (b in MapBuilds.candidates(LocalDate.now())) if (exists(b) == true) {
            VrgLog.i(TAG, "Protomaps build: ${build()} → $b")
            prefs.edit().putString("build", b).putLong("buildOk", now).apply()
            return true
        }
        return false
    }

    // ---- HTTP --------------------------------------------------------------------------------------------------

    private fun open(url: String, method: String, range: String?, extra: Map<String, String> = emptyMap()): HttpURLConnection =
        (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method; connectTimeout = 8000; readTimeout = 20000; instanceFollowRedirects = true
            setRequestProperty("User-Agent", UA)
            setRequestProperty("Accept-Encoding", "identity")
            range?.let { setRequestProperty("Range", it) }
            extra.forEach { (k, v) -> setRequestProperty(k, v) }
        }

    private fun httpBytes(url: String, max: Long): ByteArray? {
        val c = open(url, "GET", null)
        try {
            if (c.responseCode != 200) return null
            val b = c.inputStream.use { it.readBytes() }
            return if (b.size > max) null else b
        } finally { c.disconnect() }
    }

    private fun relayOpen(pathAndQuery: String, method: String, range: String?): HttpURLConnection {
        val (relay, token) = pc ?: error("no pc")
        val url = Ports.proxyUrl(relay, MapPhone.PC_PORT, pathAndQuery, token) ?: error("proxy url")
        return open(url, method, range)
    }

    // ---- answering the page --------------------------------------------------------------------------------------

    private fun resp(code: Int, type: String = "text/plain", body: InputStream = ByteArrayInputStream(ByteArray(0)), headers: Map<String, String> = emptyMap()): WebResourceResponse {
        val status = if (code in 300..399 || code !in 100..599) 502 else code   // WebResourceResponse refuses redirects
        val reason = when (status) { 200 -> "OK"; 206 -> "Partial Content"; 403 -> "Forbidden"; 404 -> "Not Found"; 412 -> "Precondition Failed"; 416 -> "Range Not Satisfiable"; 503 -> "Service Unavailable"; 504 -> "Gateway Timeout"; else -> "Status" }
        val t = type.substringBefore(';').trim()
        val charset = if (t.startsWith("text/") || t.endsWith("json") || t.endsWith("javascript")) "utf-8" else null
        return WebResourceResponse(t, charset, status, reason, mapOf("Cache-Control" to "no-store") + headers, body)
    }

    private fun typeOf(name: String): String = AppScheme.TYPES.entries.firstOrNull { name.endsWith(it.key, ignoreCase = true) }?.value
        ?: "application/octet-stream"

    private fun fileResp(f: File, head: Boolean, range: MapRange?): WebResourceResponse {
        if (!f.isFile) return resp(404)
        val len = f.length()
        if (range == null) return resp(200, typeOf(f.name), if (head) ByteArrayInputStream(ByteArray(0)) else FileInputStream(f), mapOf("Accept-Ranges" to "bytes"))
        if (range.start >= len) return resp(416, headers = mapOf("Content-Range" to "bytes */$len"))
        val end = minOf(range.end ?: (len - 1), len - 1)
        val ins = FileInputStream(f).also { it.skip(range.start) }
        val body = object : FilterInputStream(ins) {
            var left = end - range.start + 1
            override fun read(): Int = if (left <= 0) -1 else super.read().also { if (it >= 0) left-- }
            override fun read(b: ByteArray, off: Int, len2: Int): Int { if (left <= 0) return -1; val n = super.read(b, off, minOf(len2.toLong(), left).toInt()); if (n > 0) left -= n; return n }
        }
        return resp(206, typeOf(f.name), body, mapOf("Content-Range" to "bytes ${range.start}-$end/$len", "Accept-Ranges" to "bytes"))
    }

    private fun serve(req: WebResourceRequest): WebResourceResponse? {
        val u = req.url
        if (!u.host.equals(MapPhone.HOST, ignoreCase = true) || u.scheme != "https")
            return if (MapRoute.mayGoOut(u.scheme, u.host, req.method)) null else resp(403)
        val head = req.method.equals("HEAD", true)
        val range = req.requestHeaders.entries.firstOrNull { it.key.equals("Range", true) }?.value?.let { MapRange.parse(it) }
        return try {
            when (val r = MapRoute.decide(req.method, u.encodedPath ?: "/")) {
                is MapReq.Page -> {
                    val f = pageFile(r.rel)
                    if (!f.isFile) resp(404)
                    else if (r.rel == MapPhone.APP.page) resp(200, "text/html", ByteArrayInputStream(MapPhone.inject(f.readText()).toByteArray()))
                    else fileResp(f, head, null)
                }
                is MapReq.Lib -> fileResp(libFile(r.file), head, null)
                is MapReq.Phone -> when (r.path) {
                    MapPhone.PHONE_JS -> resp(200, "text/javascript", appCtx.assets.open("map-phone.js"))
                    MapPhone.SITE -> site(u.getQueryParameter("id"))
                    else -> resp(200, "application/json", ByteArrayInputStream(sites().toByteArray()))
                }
                is MapReq.Data -> data(r, req.method, range, u.encodedQuery)
                is MapReq.Jobs -> jobs(r.path)
                is MapReq.Remote -> remote(r.url + (u.encodedQuery?.let { "?$it" } ?: ""), range,
                    req.requestHeaders.entries.firstOrNull { it.key.equals("If-Match", true) }?.value)
                is MapReq.Refused -> resp(r.status)
            }
        } catch (e: Exception) {
            VrgLog.w(TAG, "${u.encodedPath}: ${e.javaClass.simpleName} ${e.message}")
            resp(504)
        }
    }

    /** The /data files: through the relay in PC mode (public parts kept on the phone); without the PC, only the kept parts. */
    private fun data(r: MapReq.Data, method: String, range: MapRange?, query: String?): WebResourceResponse {
        val kept = File(root, "data/${r.rel}")
        if (pc == null) return if (r.keep) fileResp(kept, method.equals("HEAD", true), range) else resp(404)
        val c = try { relayOpen("/data/${r.rel}" + (query?.let { "?$it" } ?: ""), method.uppercase(), range?.header) } catch (e: Exception) { null }
            ?: return if (r.keep) fileResp(kept, method.equals("HEAD", true), range) else resp(504)
        val status = try { c.responseCode } catch (e: Exception) { c.disconnect(); return if (r.keep) fileResp(kept, method.equals("HEAD", true), range) else resp(504) }
        val headers = listOf("Content-Range", "Accept-Ranges", "ETag", "Last-Modified").mapNotNull { k -> c.getHeaderField(k)?.let { k to it } }.toMap()
        val type = c.contentType ?: typeOf(r.rel)
        if (method.equals("HEAD", true) || status !in 200..299) { c.disconnect(); return resp(status, type, headers = headers) }
        if (!(r.keep && status == 200 && range == null)) return resp(status, type, c.inputStream, headers)
        // a public file read whole: kept on the phone while the page reads it
        kept.parentFile?.mkdirs()
        val part = File(kept.path + ".part")
        val tee = object : FilterInputStream(c.inputStream) {
            val out = FileOutputStream(part)
            var ok = true
            override fun read(): Int = super.read().also { if (it >= 0) out.write(it) else finish() }
            override fun read(b: ByteArray, off: Int, len: Int): Int = super.read(b, off, len).also { if (it > 0) out.write(b, off, it) else if (it < 0) finish() }
            private var done = false
            private fun finish() { if (done) return; done = true; out.close(); if (ok) { kept.delete(); part.renameTo(kept) } else part.delete() }
            override fun close() { try { super.close() } finally { if (!done) { ok = false; finish() } } ; c.disconnect() }
        }
        return resp(status, type, tee, headers)
    }

    /** The J layer: client data, through the relay only; never written to the phone (D-31, MAP-D2 B). */
    private fun jobs(path: String): WebResourceResponse {
        if (pc == null) return if (path == "/jobs/status")
            resp(200, "application/json", ByteArrayInputStream(JSONObject().put("on", false).put("reason", "csak párosított PC-vel, a relén át").toString().toByteArray()))
            else resp(403)
        val c = relayOpen(path, "GET", null)
        val s = c.responseCode
        val body = if (s in 200..299) c.inputStream else (c.errorStream ?: ByteArrayInputStream(ByteArray(0)))
        return resp(s, c.contentType ?: "application/json", body, mapOf("X-Content-Type-Options" to "nosniff", "Referrer-Policy" to "no-referrer"))
    }

    // ---- the tile cache (internet mode) ---------------------------------------------------------------------------

    private fun cacheDir() = File(root, "cache").also { it.mkdirs() }

    private fun cached(key: String): Pair<JSONObject, File>? {
        val m = File(cacheDir(), "$key.meta"); val b = File(cacheDir(), "$key.bin")
        if (!m.isFile || !b.isFile) return null
        return try { JSONObject(m.readText()).also { m.setLastModified(System.currentTimeMillis()) } to b } catch (e: Exception) { null }
    }

    private fun fromCache(meta: JSONObject, body: File): WebResourceResponse {
        val h = mutableMapOf("Accept-Ranges" to "bytes")
        meta.optString("crange").takeIf { it.isNotEmpty() }?.let { h["Content-Range"] = it }
        meta.optString("etag").takeIf { it.isNotEmpty() }?.let { h["ETag"] = it }
        return resp(meta.optInt("status", 200), meta.optString("type", "application/octet-stream"), FileInputStream(body), h)
    }

    /** A public map file: the phone's copy first (builds and assets do not change under a name), else the server, then kept. */
    private fun remote(url: String, range: MapRange?, ifMatch: String?): WebResourceResponse {
        val key = MapCache.key(url, range)
        cached(key)?.let { (m, b) -> if (ifMatch == null || m.optString("etag") == ifMatch || m.optString("etag").isEmpty()) return fromCache(m, b) }
        val c = try { open(url, "GET", range?.header, ifMatch?.let { mapOf("If-Match" to it) } ?: emptyMap()) } catch (e: Exception) { return resp(504) }
        val s = try { c.responseCode } catch (e: Exception) { c.disconnect(); return resp(504) }
        if (s == 412) { c.disconnect(); dropUrl(url); return resp(412) }   // the file changed on the server: forget its old pieces
        if (s != 200 && s != 206) { c.disconnect(); return resp(s) }
        val bytes = c.inputStream.use { it.readBytes() }
        val meta = JSONObject().put("url", url).put("status", s).put("type", c.contentType ?: typeOf(url))
            .put("crange", c.getHeaderField("Content-Range") ?: "").put("etag", c.getHeaderField("ETag") ?: "")
        c.disconnect()
        try {
            val b = File(cacheDir(), "$key.bin"); val part = File(cacheDir(), "$key.part")
            part.writeBytes(bytes); b.delete(); part.renameTo(b)
            File(cacheDir(), "$key.meta").writeText(meta.toString())
            if (writes.incrementAndGet() % 64 == 0) scope.launch { trim() }
        } catch (e: Exception) { VrgLog.w(TAG, "cache: ${e.message}") }
        return fromCache(meta, File(cacheDir(), "$key.bin").takeIf { it.isFile } ?: return resp(s, meta.optString("type"), ByteArrayInputStream(bytes)))
    }

    private fun dropUrl(url: String) {
        cacheDir().listFiles { f -> f.name.endsWith(".meta") }?.forEach { m ->
            val u = try { JSONObject(m.readText()).optString("url") } catch (e: Exception) { "" }
            if (u == url) { File(m.path.removeSuffix(".meta") + ".bin").delete(); m.delete() }
        }
    }

    private fun trim() {
        val metas = cacheDir().listFiles { f -> f.name.endsWith(".meta") } ?: return
        val entries = metas.map { m -> MapCache.Entry(m.name.removeSuffix(".meta"), File(m.path.removeSuffix(".meta") + ".bin").length(), m.lastModified()) }
        MapCache.evict(entries).forEach { k -> File(cacheDir(), "$k.bin").delete(); File(cacheDir(), "$k.meta").delete() }
    }

    fun cacheBytes(): Long = (File(root, "cache").listFiles { f -> f.name.endsWith(".bin") } ?: emptyArray()).sumOf { it.length() }

    fun clearCache() { File(root, "cache").deleteRecursively(); prefs.edit().remove("buildOk").apply() }

    // ---- the Vázlat sites -----------------------------------------------------------------------------------------

    /** The Sketcher's sites with a place, read from its files (read-only); shown in the page, never sent anywhere. */
    private fun sites(): String {
        val arr = JSONArray()
        (sketches.listFiles { f -> f.name.endsWith(".vsketch.json") } ?: emptyArray()).forEach { f ->
            val s = try { SketchJson.read(f.readText()) } catch (e: Exception) { null } ?: return@forEach
            val lat = s.site?.lat; val lon = s.site?.lon
            if (lat != null && lon != null && MapPhone.inHungary(lat, lon))
                arr.put(JSONObject().put("id", s.id).put("name", s.name).put("address", s.site?.address ?: "").put("lat", lat).put("lon", lon))
        }
        return JSONObject().put("sites", arr).toString()
    }

    /**
     * F1: one survey for the site layer, read from the Sketcher's file (read-only): its place, outline, placement and the solved
     * rooms in metres. No address (the page does not need it); shown in the page, never sent anywhere.
     */
    private fun site(id: String?): WebResourceResponse {
        if (id == null || !MapPhone.SITE_ID.matches(id)) return resp(404)
        val f = File(sketches, "$id.vsketch.json")
        val s = try { SketchJson.read(f.readText()) } catch (e: Exception) { null } ?: return resp(404)
        return resp(200, "application/json", ByteArrayInputStream(SiteLink.payload(s, Solver().solve(s), sketcherMapHide()).toString().toByteArray()))
    }

    /** M51: the Sketcher's switches for the site panel (its general store; the map only reads it). */
    private fun sketcherMapHide(): List<String> = try {
        hu.vrg.mobile.sketch.Features.mapHide(hu.vrg.mobile.sketch.Features.read(appCtx.getSharedPreferences("sketcher-features", Context.MODE_PRIVATE).getString("flipped", "")))
    } catch (e: Exception) { emptyList() }

    /** F1: the site layer's ✓ Kész / ✕: the answer is left for the Sketcher (it owns the survey file), then back to its Helyszín. */
    private fun siteDone(host: FeatureHost, d: String?) {
        val r = d?.let { SiteLink.parseResult(it) }
        val id = r?.id ?: d?.let { runCatching { JSONObject(it).optString("id") }.getOrNull() }?.takeIf { MapPhone.SITE_ID.matches(it) }
        if (r != null) {
            try {
                val f = File(sketches, SiteLink.handoffPath(r.id)); f.parentFile?.mkdirs()
                val part = File(f.path + ".part"); part.writeText(d); f.delete(); part.renameTo(f)
            } catch (e: Exception) { VrgLog.w(TAG, "site: ${e.message}"); host.note("A helyszín nem menthető."); return }
        }
        state.update { it.copy(url = null) }          // the next open is the plain map again
        activeSite = null
        if (id == null) { host.home(); return }
        runCatching {
            host.activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("vrg://${Catalogue.SKETCH.id}?open=$id&front=helyszin"))
                .setPackage(host.activity.packageName).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP))
        }.onFailure { host.open(Catalogue.SKETCH.id) }
    }

    // ---- the WebView ----------------------------------------------------------------------------------------------

    private val asks = AtomicInteger()

    /** The page's position button: the Android permission first (asked once, in context), then the WebView's own question. */
    private fun geo(host: FeatureHost, origin: String, cb: GeolocationPermissions.Callback) {
        if (!origin.startsWith(MapPhone.ORIGIN)) { cb.invoke(origin, false, false); return }
        val ctx = host.activity
        if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            cb.invoke(origin, true, false); return
        }
        val key = "vrg-map-geo-" + asks.incrementAndGet()
        var launcher: androidx.activity.result.ActivityResultLauncher<Array<String>>? = null
        launcher = ctx.activityResultRegistry.register(key, ActivityResultContracts.RequestMultiplePermissions()) { got ->
            val ok = got.values.any { it }
            if (!ok) host.note("A saját helyhez helymeghatározási engedély kell.")
            cb.invoke(origin, ok, false)
            launcher?.unregister()
        }
        launcher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
    }

    /** vrg-map:nav?lat=…&lon=…&label=… (Navigáció) and vrg-map:sketch?id=… (Vázlat), from the phone script. */
    private fun phoneLink(host: FeatureHost, u: Uri): Boolean {
        val q = Uri.parse("x://y?" + (u.encodedSchemeSpecificPart.substringAfter('?', "")))
        when (u.encodedSchemeSpecificPart.substringBefore('?')) {
            "nav" -> {
                val geo = MapNav.geoUri(q.getQueryParameter("lat")?.toDoubleOrNull() ?: Double.NaN, q.getQueryParameter("lon")?.toDoubleOrNull() ?: Double.NaN, q.getQueryParameter("label"))
                    ?: run { host.note("Ehhez a ponthoz nincs érvényes hely."); return true }
                try { host.activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(geo))) }
                catch (e: Exception) { host.note("Nincs navigációs alkalmazás a telefonon.") }
            }
            "sketch" -> host.open(Catalogue.SKETCH.id)
            "site" -> siteDone(host, q.getQueryParameter("d"))
        }
        return true
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun makeWebView(ctx: Context, host: FeatureHost): WebView = WebView(ctx).apply {
        // MATCH_PARENT, as in Archívum (ArchiveFeature.makeWebView): with WRAP_CONTENT the map's container is 0 px tall.
        layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.setGeolocationEnabled(true)
        settings.mediaPlaybackRequiresUserGesture = true
        settings.cacheMode = WebSettings.LOAD_NO_CACHE
        settings.setSupportZoom(false)          // the map does its own pinch
        webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? = serve(request)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url
                if (u.scheme == "vrg-map") return if (request.isForMainFrame) phoneLink(host, u) else true
                if (u.host.equals(MapPhone.HOST, ignoreCase = true)) return false
                if (request.isForMainFrame && (u.scheme == "https" || u.scheme == "http"))
                    runCatching { view.context.startActivity(Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
                return request.isForMainFrame
            }

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                VrgLog.w(TAG, "a megjelenítő leállt (crash: ${detail.didCrash()})")
                set { it.copy(problem = "A megjelenítő leállt. Nyisd meg újra.", url = null) }
                view.destroy()
                return true
            }
        }
        webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) = geo(host, origin, callback)

            override fun onConsoleMessage(m: ConsoleMessage): Boolean {
                if (m.messageLevel() == ConsoleMessage.MessageLevel.ERROR) VrgLog.w(TAG, "${m.message()} (${m.sourceId().substringAfterLast('/')}:${m.lineNumber()})")
                return true
            }
        }
    }

    /** The camera the map had (#zoom/lat/lon/bearing/pitch), so the map opens where it was left. */
    private fun keepHash(wv: WebView?) {
        val h = wv?.url?.substringAfter('#', "")?.takeIf { it.isNotEmpty() } ?: return
        prefs.edit().putString("hash", "#$h").apply()
    }

    // ---- the screen -----------------------------------------------------------------------------------------------

    @Composable
    override fun Screen(host: FeatureHost) {
        val s by state.collectAsStateWithLifecycle()
        val web = remember { arrayOfNulls<WebView>(1) }
        LaunchedEffect(Unit) { if (state.value.url == null) prepare() }
        LaunchedEffect(s.url) { if (s.url == null && !s.busy && s.loaded > 0 && (pendingJob != null || pendingSite != null)) prepare() }
        // F1: from a survey's Helyszín, ‹ and Back go back to it (nothing saved: ✓ Kész saves)
        val leave = { keepHash(web[0]); activeSite?.let { siteDone(host, JSONObject().put("id", it).toString()) } ?: host.home() }
        BackHandler { leave() }
        Column(Modifier.fillMaxSize()) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 2.dp), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("‹", style = Melyviz.title.copy(fontSize = 22.sp, color = Melyviz.current),
                    modifier = Modifier.clickable { leave() }.padding(horizontal = 4.dp, vertical = 6.dp))
                Text("VRG TÉRKÉP", style = Melyviz.title.copy(fontSize = 13.sp), maxLines = 1, modifier = Modifier.weight(1f))
                when (s.mode) {
                    Mode.PC -> VrgChip("PC adat", selected = true) { host.note("A térkép és a munkák a PC-ről jönnek, a relén át.") }
                    Mode.INTERNET -> VrgChip("Internet") { host.note(s.pcNote ?: "A térkép az internetről jön; amit megnéztél, offline is megmarad.") }
                    Mode.OFFLINE -> VrgChip("Offline") { host.note("Nincs internet és PC: a telefonon tárolt térképrészek látszanak.") }
                    null -> {}
                }
                VrgChip("⟳") { keepHash(web[0]); state.update { it.copy(url = null) }; prepare() }
            }
            if (s.busy || s.problem != null) Column(Modifier.padding(horizontal = 12.dp, vertical = 2.dp)) {
                if (s.busy) Text(s.step ?: "Előkészítés…", style = Melyviz.small)
                s.problem?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand), maxLines = 3, overflow = TextOverflow.Ellipsis) }
                if (!GitHub.signedIn && s.url == null && !s.busy) Row(Modifier.padding(vertical = 6.dp)) { VrgChip("GitHub fiók ›") { host.open(Catalogue.ACCOUNT.id) } }
            }
            Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                val url = s.url
                if (url == null) Text(if (s.busy) "Betöltés…" else "A térkép itt nyílik meg.", style = Melyviz.small)
                else AndroidView(
                    factory = { ctx -> makeWebView(ctx, host) },
                    modifier = Modifier.fillMaxSize(),
                    update = { wv ->
                        web[0] = wv
                        val want = "${s.loaded}|$url"
                        if (wv.tag != want) { wv.tag = want; wv.loadUrl(url) }
                    },
                    onRelease = { wv -> keepHash(wv); if (web[0] === wv) web[0] = null; wv.destroy() },
                )
            }
        }
    }
}
