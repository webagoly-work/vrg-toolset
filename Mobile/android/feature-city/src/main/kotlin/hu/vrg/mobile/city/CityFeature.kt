package hu.vrg.mobile.city

import android.annotation.SuppressLint
import android.app.Application
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.CityMeta
import hu.vrg.mobile.core.CityPages
import hu.vrg.mobile.core.CityStore
import hu.vrg.mobile.core.CitySync
import hu.vrg.mobile.core.Contents
import hu.vrg.mobile.core.GitHubUrls
import hu.vrg.mobile.core.MiniStatus
import hu.vrg.mobile.core.VrgRepo
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.github.Account
import hu.vrg.mobile.kit.github.Gh
import hu.vrg.mobile.kit.github.GitHub
import hu.vrg.mobile.kit.github.problem
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.MiniTrack
import hu.vrg.mobile.kit.ui.VrgChip
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileInputStream

// Kódváros online (WP M5, D-7 = A): the repo's city as GitHub has it. Actions scans every pushed branch and
// publishes it on `city-pages` (.github/workflows/mobile-city.yml, Mobile/city/publish-city.js); this screen
// lists the branches that have a city, asks for the chosen one's meta.json (ETag-cached, so a check is
// cheap) and downloads city.html through the contents API with the M3 token only when its commit changed.
// The page is kept in the app's own files (filesDir/city/<key>/, not the cache Android may empty), so the
// last city opens offline too, with its date.
//
// The WebView: JavaScript and DOM storage on (Kódváros keeps its settings there), file and content access
// off. The page is served from https://appassets.androidplatform.net/city/<key>/city.html by
// shouldInterceptRequest, which answers only that one file per key; every other request (the page's /api/
// calls to the PC's Kódváros segéd, any other host) gets an empty 403, so nothing leaves the phone and
// nothing of the phone is readable. Links to other sites open in the browser. Touch: assets/city-touch.js
// (one finger orbits, two pan and pinch-zoom), injected when the page has loaded.

object CityFeature : VrgFeature {
    override val info = Catalogue.CITY
    private const val TAG = "city"
    private const val HOST = "appassets.androidplatform.net"
    private const val RAW = "application/vnd.github.raw"

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var root: File
    private lateinit var prefs: SharedPreferences
    private var touchJs = ""

    /** The branches with a city on city-pages (main first); empty until the first listing. */
    val branches = MutableStateFlow<List<String>>(emptyList())
    val selected = MutableStateFlow("main")
    /** The city on the phone for the selected branch, if any. */
    val shown = MutableStateFlow<CityMeta?>(null)
    /** Bumped when a new page lands, so the WebView reloads it. */
    val loaded = MutableStateFlow(0)
    val busy = MutableStateFlow(false)
    val progress = MutableStateFlow<Float?>(null)
    /** Why the shown city may be old, or why there is none. */
    val problem = MutableStateFlow<String?>(null)
    /** GitHub did not answer: the city shown is the phone's copy. */
    val offline = MutableStateFlow(false)

    private val ring = MiniTrack()
    override val activity: StateFlow<MiniStatus> get() = ring.status
    private var web: WebView? = null

    override fun init(app: Application) {
        root = File(app.filesDir, CityPages.DIR)
        prefs = app.getSharedPreferences("city", Context.MODE_PRIVATE)
        selected.value = prefs.getString("branch", null) ?: "main"
        shown.value = local(selected.value)
        touchJs = try { app.assets.open("city-touch.js").bufferedReader().use { it.readText() } } catch (e: Exception) { "" }
    }

    // ---- the phone's copies ---------------------------------------------------------------------------

    private fun dir(branch: String) = File(root, CityPages.key(branch))
    private fun html(branch: String) = File(dir(branch), CityPages.HTML)
    private fun local(branch: String): CityMeta? =
        try { File(dir(branch), CityPages.META).takeIf { it.exists() }?.readText()?.let { CityMeta.parse(it) } } catch (e: Exception) { null }

    private fun used(branch: String) {
        prefs.edit().putLong("used." + CityPages.key(branch), System.currentTimeMillis()).apply()
        val times = prefs.all.filterKeys { it.startsWith("used.") }.mapKeys { it.key.removePrefix("used.") }
            .mapValues { (it.value as? Long) ?: 0L }
        for (k in CityStore.prune(times, CityPages.key(branch))) {
            File(root, k).deleteRecursively()
            prefs.edit().remove("used.$k").apply()
            VrgLog.i(TAG, "Régi város törölve a telefonról: ${CityPages.branchOf(k) ?: k}")
        }
    }

    // ---- GitHub -------------------------------------------------------------------------------------------

    fun select(branch: String) {
        if (branch == selected.value) return
        selected.value = branch
        prefs.edit().putString("branch", branch).apply()
        shown.value = local(branch)
        problem.value = null
        offline.value = false
        refresh(listing = false)
    }

    fun refresh(listing: Boolean = true) {
        if (busy.value) return
        val branch = selected.value
        if (!GitHub.signedIn) {
            offline.value = shown.value != null
            problem.value = if (shown.value != null) "Nincs GitHub belépés: a telefonon lévő város látszik." else null
            return
        }
        busy.value = true
        ring.run()
        scope.launch {
            try {
                if (listing) list()
                sync(branch)
            } catch (e: Exception) {
                problem.value = "Hiba: ${e.javaClass.simpleName}"
                VrgLog.w(TAG, "Nem sikerült: ${e.message}")
                ring.fail()
            } finally {
                busy.value = false
                progress.value = null
            }
        }
    }

    private suspend fun list() {
        when (val r = GitHub.get(CityPages.listing(VrgRepo.PATH))) {
            is Gh.Ok -> CityPages.branches(r.value)?.let { branches.value = it }
            is Gh.Failed -> if (r.code == 404) branches.value = emptyList()
            else -> Unit   // offline / rate limit: sync() below says so
        }
    }

    private suspend fun sync(branch: String) {
        val r = GitHub.get(CityPages.contents(VrgRepo.PATH, branch, CityPages.META))
        val remote = (r as? Gh.Ok)?.let { Contents.parse(it.value)?.text }?.let { CityMeta.parse(it) }
        val answered = r is Gh.Ok || (r is Gh.Failed && r.code == 404)
        val have = local(branch)
        when (val step = CitySync.decide(have, html(branch).exists(), remote, answered)) {
            CitySync.Fresh -> { offline.value = false; problem.value = null; used(branch); ring.done() }
            CitySync.Offline -> {
                offline.value = have != null
                problem.value = (r.problem() ?: "A GitHub nem válaszolt.") + if (have != null) " A telefonon lévő város látszik." else ""
                ring.fail()
            }
            CitySync.Missing -> {
                offline.value = false
                problem.value = "Ennek a branchnek még nincs városa: az Actions a következő push után készíti el."
                ring.done()
            }
            is CitySync.Download -> download(branch, step.meta)
        }
    }

    private suspend fun download(branch: String, meta: CityMeta) {
        val d = dir(branch).apply { mkdirs() }
        val part = File(d, CityPages.HTML + ".part")
        val total = meta.htmlBytes.coerceAtLeast(1)
        val started = System.currentTimeMillis()
        val got = GitHub.download(GitHubUrls.API + CityPages.contents(VrgRepo.PATH, branch, CityPages.HTML), part, RAW) { done ->
            val p = (done.toFloat() / total).coerceIn(0f, 1f)
            progress.value = p
            ring.run(p)
        }
        if (got !is Gh.Ok || part.length() != meta.htmlBytes) {
            part.delete()
            offline.value = local(branch) != null
            problem.value = got.problem() ?: "A letöltés nem lett teljes (${part.length()} / ${meta.htmlBytes} bájt)."
            VrgLog.w(TAG, "$branch: ${problem.value}")
            ring.fail()
            return
        }
        // the page first, then its meta: a cut write leaves an old meta beside a new page, which the next
        // check simply downloads again
        if (!part.renameTo(html(branch))) { html(branch).delete(); part.renameTo(html(branch)) }
        File(d, CityPages.META).writeText(meta.toJson())
        VrgLog.i(TAG, "$branch @ ${meta.head}: ${meta.htmlBytes / 1024} KB, ${System.currentTimeMillis() - started} ms")
        used(branch)
        offline.value = false
        problem.value = null
        if (selected.value == branch) { shown.value = meta; loaded.value++ }
        ring.done()
    }

    // ---- the WebView --------------------------------------------------------------------------------------

    private fun pageUrl(branch: String) = "https://$HOST/${CityPages.DIR}/${CityPages.key(branch)}/${CityPages.HTML}"

    /** The one file per key the page may load; everything else is refused. */
    private fun serve(uri: Uri): WebResourceResponse {
        val seg = uri.pathSegments
        val branch = if (uri.host == HOST && seg.size == 3 && seg[0] == CityPages.DIR && seg[2] == CityPages.HTML) CityPages.branchOf(seg[1]) else null
        val file = branch?.let { html(it) }?.takeIf { it.isFile }
            ?: return WebResourceResponse("text/plain", "utf-8", 403, "Forbidden", mapOf("Cache-Control" to "no-store"), ByteArrayInputStream(ByteArray(0)))
        return WebResourceResponse("text/html", "utf-8", 200, "OK", mapOf("Cache-Control" to "no-store"), FileInputStream(file))
    }

    private fun openOutside(ctx: Context, uri: Uri) {
        runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun makeWebView(ctx: Context): WebView = WebView(ctx).apply {
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.setGeolocationEnabled(false)
        settings.mediaPlaybackRequiresUserGesture = true
        settings.cacheMode = WebSettings.LOAD_NO_CACHE
        webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse = serve(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url
                if (u.host == HOST) return false
                if (request.isForMainFrame && (u.scheme == "https" || u.scheme == "http")) openOutside(view.context, u)
                return true
            }

            override fun onPageFinished(view: WebView, url: String) {
                if (touchJs.isNotEmpty()) view.evaluateJavascript(touchJs, null)
            }

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                // a WebGL page can run out of memory on a small phone: drop this WebView, keep the app
                VrgLog.w(TAG, "A város megjelenítője leállt (crash: ${detail.didCrash()})")
                problem.value = "A város megjelenítője leállt. Nyisd meg újra."
                if (web === view) web = null
                view.destroy()
                return true
            }
        }
    }

    override fun onForeground(on: Boolean) {
        web?.let { if (on) it.onResume() else it.onPause() }
    }

    // ---- the screen -----------------------------------------------------------------------------------------

    @Composable
    override fun Screen(host: FeatureHost) {
        val account by GitHub.account.collectAsStateWithLifecycle()
        val list by branches.collectAsStateWithLifecycle()
        val branch by selected.collectAsStateWithLifecycle()
        val meta by shown.collectAsStateWithLifecycle()
        val tick by loaded.collectAsStateWithLifecycle()
        val loading by busy.collectAsStateWithLifecycle()
        val pct by progress.collectAsStateWithLifecycle()
        val why by problem.collectAsStateWithLifecycle()
        val old by offline.collectAsStateWithLifecycle()
        LaunchedEffect(account is Account.SignedIn) { refresh() }

        Column(Modifier.fillMaxSize()) {
            Column(Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current),
                        modifier = Modifier.clickable { host.home() }.padding(vertical = 8.dp))
                    Text("KÓDVÁROS ONLINE", style = Melyviz.title.copy(fontSize = 16.sp),
                        modifier = Modifier.weight(1f).padding(start = 12.dp))
                    VrgChip(if (loading) "…" else "⟳ Frissítés") { refresh() }
                }
                val choices = (list + branch).distinct()
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    choices.forEach { b -> VrgChip(b, selected = b == branch) { select(b) } }
                }
                val m = meta
                if (m != null) {
                    Text("${m.head} · ${m.scannedLabel} UTC · ${m.commits} commit · ${m.files} fájl" + if (old) " · offline" else "",
                        style = Melyviz.readout.copy(fontSize = 11.sp))
                }
                pct?.let { Text("Letöltés… ${(it * 100).toInt()} %", style = Melyviz.small) }
                if (account !is Account.SignedIn && m == null) {
                    Text("A repó privát: GitHub belépés kell.", style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 6.dp))
                    Row(Modifier.padding(vertical = 6.dp)) { VrgChip("GitHub fiók ›") { host.open(Catalogue.ACCOUNT.id) } }
                }
                why?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(vertical = 2.dp)) }
            }
            Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                val m = meta
                if (m == null) {
                    Text(if (loading) "Betöltés…" else "Itt jelenik meg a város.", style = Melyviz.small)
                } else {
                    val url = pageUrl(m.branch)
                    AndroidView(
                        factory = { ctx -> makeWebView(ctx).also { web = it } },
                        modifier = Modifier.fillMaxSize(),
                        update = { wv ->
                            val want = "$url@${m.sha}#$tick"
                            if (wv.tag != want) { wv.tag = want; wv.loadUrl(url) }
                        },
                        onRelease = { wv -> if (web === wv) web = null; wv.destroy() },
                    )
                }
            }
        }
    }
}
