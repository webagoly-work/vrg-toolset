package hu.vrg.mobile.archive

import android.annotation.SuppressLint
import android.app.Application
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.ArchiveManifest
import hu.vrg.mobile.core.ArchivePages
import hu.vrg.mobile.core.ArchiveSync
import hu.vrg.mobile.core.ArchiveWeb
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.GitHubUrls
import hu.vrg.mobile.core.MiniStatus
import hu.vrg.mobile.core.Route
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
import java.util.Locale

// Archívum (WP M18): the VRG Artifact Archive on the phone. The archive is the repo's Archive/ folder (VRG Desktop
// WP-46): vrg-archive.html, its data index.js and the saved pages files/<id>.html. The phone reads that folder
// straight from main through the contents API with the M3 token (D-13): two listings (ETag-cached, a check is
// cheap), then only the files whose git blob sha changed, each to `.part`, checked against the listed size and
// renamed. The copies live in filesDir/archive/, so the archive opens offline with what was last downloaded.
// The viewer is the PC's own page, unchanged: it is already laid out for a phone (list → entry → full-screen
// viewer under 760 px), so nothing is forked or re-implemented here.
//
// The WebView is set up like Rétegverem (M17): JavaScript and DOM storage on, file and content access off, the
// files served from https://appassets.androidplatform.net/archive/<file> by shouldInterceptRequest, which answers
// only the viewer, index.js and files/<name>.html. The saved pages are published artifacts, which may load fonts
// and libraries from the artifact CDNs (ArchiveWeb.CDN): a GET there goes to the network; every other request
// gets an empty 403. A link that leaves the archive (claude.ai ↗, a datasheet link in a saved page) opens in the
// phone's browser, never inside the app.
//
// Back: the viewer keeps its place with history.replaceState, so the WebView cannot step back through it; Back
// asks the page (ArchiveWeb.BACK_JS): the open saved page closes, then the entry goes back to the list, then the
// app leaves the archive. A saved file opened in the main frame ("Archivált fájl") steps back in WebView history.

object ArchiveFeature : VrgFeature {
    override val info = Catalogue.ARCHIVE
    private const val TAG = "archive"
    private const val HOST = "appassets.androidplatform.net"
    private const val RAW = "application/vnd.github.raw"

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val main = Handler(Looper.getMainLooper())
    private lateinit var root: File

    /** The archive on the phone, if any. */
    val shown = MutableStateFlow<ArchiveManifest?>(null)
    /** Bumped when new files land, so the WebView reloads. */
    val loaded = MutableStateFlow(0)
    val busy = MutableStateFlow(false)
    val progress = MutableStateFlow<Float?>(null)
    val problem = MutableStateFlow<String?>(null)
    val offline = MutableStateFlow(false)
    /** An entry asked for by a link (vrg://archive/<id>), shown on the next load. */
    private val pending = MutableStateFlow<String?>(null)

    private val ring = MiniTrack()
    override val activity: StateFlow<MiniStatus> get() = ring.status
    private var web: WebView? = null

    override fun init(app: Application) {
        root = File(app.filesDir, ArchivePages.LOCAL)
        shown.value = local()
    }

    /** vrg://archive/<id> opens that entry; vrg://archive/<id>/open opens its saved page too. */
    override fun open(route: Route): Boolean {
        val want = route.path.trim('/')
        if (want.isEmpty()) return true
        val w = web
        if (w == null) pending.value = want
        else main.post { w.evaluateJavascript("location.hash=${quote(want)}", null) }
        return true
    }

    private fun quote(s: String) = "'#" + s.replace("\\", "").replace("'", "") + "'"

    // ---- the phone's copies ---------------------------------------------------------------------------

    private fun file(rel: String) = File(root, rel)
    private fun local(): ArchiveManifest? = try { file(ArchivePages.MANIFEST).takeIf { it.exists() }?.readText()?.let { ArchiveManifest.parse(it) } } catch (e: Exception) { null }
    private fun have(): Map<String, Long> {
        val out = mutableMapOf<String, Long>()
        ArchivePages.ROOT_FILES.forEach { r -> file(r).takeIf { it.isFile }?.let { out[r] = it.length() } }
        File(root, ArchivePages.FILES).listFiles()?.filter { it.isFile && !it.name.endsWith(".part") }?.forEach {
            val rel = ArchivePages.FILES + "/" + it.name
            if (ArchivePages.keeps(rel)) out[rel] = it.length()
        }
        return out
    }

    // ---- GitHub -------------------------------------------------------------------------------------------

    fun refresh() {
        if (busy.value) return
        if (!GitHub.signedIn) {
            offline.value = shown.value != null
            problem.value = if (shown.value != null) "Nincs GitHub belépés: a telefonon lévő változat látszik." else null
            return
        }
        busy.value = true
        ring.run()
        scope.launch {
            try { sync() } catch (e: Exception) {
                problem.value = "Hiba: ${e.javaClass.simpleName}"
                VrgLog.w(TAG, "Nem sikerült: ${e.message}")
                ring.fail()
            } finally { busy.value = false; progress.value = null }
        }
    }

    private suspend fun sync() {
        val r = GitHub.get(ArchivePages.listing(VrgRepo.PATH))
        var answered = r is Gh.Ok || (r is Gh.Failed && r.code == 404)
        var remote: ArchiveManifest? = null
        var why = r.problem()
        if (r is Gh.Ok) {
            val f = GitHub.get(ArchivePages.listing(VrgRepo.PATH, ArchivePages.FILES))
            when {
                f is Gh.Ok -> remote = ArchiveManifest.fromListings(r.value, f.value)
                f is Gh.Failed && f.code == 404 -> remote = ArchiveManifest.fromListings(r.value, null)
                else -> { answered = false; why = f.problem() }
            }
        }
        val mine = local()
        when (val step = ArchiveSync.decide(mine, have(), remote, answered)) {
            ArchiveSync.Fresh -> { offline.value = false; problem.value = null; ring.done() }
            ArchiveSync.Offline -> {
                offline.value = mine != null
                problem.value = (why ?: "A GitHub nem válaszolt.") + if (mine != null) " A telefonon lévő változat látszik." else ""
                ring.fail()
            }
            ArchiveSync.Missing -> {
                offline.value = false
                problem.value = "A main ágon még nincs Archívum (Archive/vrg-archive.html és index.js)."
                ring.done()
            }
            is ArchiveSync.Download -> download(mine, step)
        }
    }

    private suspend fun download(mine: ArchiveManifest?, step: ArchiveSync.Download) {
        File(root, ArchivePages.FILES).mkdirs()
        val total = step.bytes().coerceAtLeast(1)
        var before = 0L
        val started = System.currentTimeMillis()
        // what the phone has, updated file by file: a cut download keeps every finished file, and the next ⟳
        // fetches only the rest
        val now = (mine?.files ?: emptyMap()).toMutableMap()
        var failed: String? = null
        for (rel in step.fetch) {
            val want = step.remote.files.getValue(rel)
            val part = file("$rel.part")
            val got = GitHub.download(GitHubUrls.API + ArchivePages.contents(VrgRepo.PATH, rel), part, RAW) { done ->
                val f = ((before + done).toFloat() / total).coerceIn(0f, 1f)
                progress.value = f; ring.run(f)
            }
            if (got !is Gh.Ok || part.length() != want.size) {
                failed = got.problem() ?: "A letöltés nem lett teljes ($rel: ${part.length()} / ${want.size} bájt)."
                part.delete()
                break
            }
            val dest = file(rel)
            if (!part.renameTo(dest)) { dest.delete(); part.renameTo(dest) }
            now[rel] = want
            before += want.size
        }
        if (failed == null) for (rel in step.drop) { file(rel).delete(); now.remove(rel) }
        val result = ArchiveManifest(now)
        file(ArchivePages.MANIFEST).writeText(result.toJson())
        shown.value = result.takeIf { it.complete }
        loaded.value++
        if (failed != null) {
            offline.value = true
            problem.value = failed
            VrgLog.w(TAG, failed)
            ring.fail()
            return
        }
        VrgLog.i(TAG, "Archívum: ${step.fetch.size} fájl, ${total / 1024} KB, ${step.drop.size} törölve, ${System.currentTimeMillis() - started} ms")
        offline.value = false
        problem.value = null
        ring.done()
    }

    // ---- the WebView --------------------------------------------------------------------------------------

    private val pageUrl = "https://$HOST/${ArchivePages.LOCAL}/${ArchivePages.PAGE}"

    private fun refuse() = WebResourceResponse("text/plain", "utf-8", 403, "Forbidden", mapOf("Cache-Control" to "no-store"), ByteArrayInputStream(ByteArray(0)))

    /** The archive's own files from filesDir; a GET to an artifact CDN goes to the network (null); the rest is refused. */
    private fun serve(request: WebResourceRequest): WebResourceResponse? {
        val uri = request.url
        if (uri.host != HOST) return if (ArchiveWeb.mayLoad(uri.scheme, uri.host, request.method)) null else refuse()
        val rel = ArchivePages.route(uri.pathSegments) ?: return refuse()
        val f = file(rel).takeIf { it.isFile } ?: return refuse()
        return WebResourceResponse(ArchivePages.mime(rel), "utf-8", 200, "OK", mapOf("Cache-Control" to "no-store"), FileInputStream(f))
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
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? = serve(request)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url
                if (u.host == HOST) return false
                // claude.ai ↗ and every outside link: the phone's browser, only on a tap that leaves the page
                if (request.isForMainFrame && (u.scheme == "https" || u.scheme == "http"))
                    runCatching { view.context.startActivity(Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
                return true
            }

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                VrgLog.w(TAG, "Az Archívum megjelenítője leállt (crash: ${detail.didCrash()})")
                problem.value = "A megjelenítő leállt. Nyisd meg újra."
                if (web === view) web = null
                view.destroy()
                return true
            }
        }
    }

    override fun onForeground(on: Boolean) {
        web?.let { if (on) it.onResume() else it.onPause() }
    }

    /** Back inside the archive first; only from the list does the app leave it. */
    private fun back(host: FeatureHost) {
        val w = web ?: return host.home()
        val path = Uri.parse(w.url ?: "").path.orEmpty()
        if (!path.endsWith("/" + ArchivePages.PAGE) && w.canGoBack()) { w.goBack(); return }
        w.evaluateJavascript(ArchiveWeb.BACK_JS) { answer -> if (ArchiveWeb.leaves(answer)) host.home() }
    }

    // ---- the screen -----------------------------------------------------------------------------------------

    @Composable
    override fun Screen(host: FeatureHost) {
        val account by GitHub.account.collectAsStateWithLifecycle()
        val meta by shown.collectAsStateWithLifecycle()
        val tick by loaded.collectAsStateWithLifecycle()
        val loading by busy.collectAsStateWithLifecycle()
        val pct by progress.collectAsStateWithLifecycle()
        val why by problem.collectAsStateWithLifecycle()
        val old by offline.collectAsStateWithLifecycle()
        LaunchedEffect(account is Account.SignedIn) { refresh() }
        BackHandler(meta != null) { back(host) }

        Column(Modifier.fillMaxSize()) {
            Column(Modifier.padding(horizontal = 12.dp, vertical = 2.dp)) {
                // one row: back, the title, the size, refresh; the page below has its own search and filters
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("‹", style = Melyviz.title.copy(fontSize = 22.sp, color = Melyviz.current),
                        modifier = Modifier.clickable { host.home() }.padding(horizontal = 4.dp, vertical = 6.dp))
                    Text("ARCHÍVUM", style = Melyviz.title.copy(fontSize = 13.sp), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    val m = meta
                    Text(
                        if (m == null) "" else "${m.pages} mentett oldal · ${String.format(Locale.ROOT, "%.1f", m.bytes / 1048576.0)} MB" + if (old) " · offline" else "",
                        style = Melyviz.readout.copy(fontSize = 10.sp), maxLines = 1, overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                    VrgChip(if (loading) "…" else "⟳") { refresh() }
                }
                pct?.let { Text("Letöltés… ${(it * 100).toInt()} %", style = Melyviz.small) }
                if (account !is Account.SignedIn && meta == null) {
                    Text("A repó privát: GitHub belépés kell.", style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 6.dp))
                    Row(Modifier.padding(vertical = 6.dp)) { VrgChip("GitHub fiók ›") { host.open(Catalogue.ACCOUNT.id) } }
                }
                why?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand), maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(vertical = 2.dp)) }
            }
            Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                val m = meta
                if (m == null) {
                    Text(if (loading) "Betöltés…" else "Itt jelenik meg az Archívum.", style = Melyviz.small)
                } else {
                    AndroidView(
                        factory = { ctx -> makeWebView(ctx).also { web = it } },
                        modifier = Modifier.fillMaxSize(),
                        update = { wv ->
                            val want = "$tick"
                            if (wv.tag != want) {
                                wv.tag = want
                                // a link's entry, or after new files landed the entry that was showing
                                val go = pending.value ?: Uri.parse(wv.url ?: "").fragment
                                pending.value = null
                                wv.loadUrl(if (!go.isNullOrEmpty()) "$pageUrl#" + Uri.encode(go, "/") else pageUrl)
                            }
                        },
                        onRelease = { wv -> if (web === wv) web = null; wv.destroy() },
                    )
                }
            }
        }
    }
}
