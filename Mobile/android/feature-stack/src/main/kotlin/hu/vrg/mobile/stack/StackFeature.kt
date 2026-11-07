package hu.vrg.mobile.stack

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ContextWrapper
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
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
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
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
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.style.TextOverflow
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.Contents
import hu.vrg.mobile.core.GitHubUrls
import hu.vrg.mobile.core.MiniStatus
import hu.vrg.mobile.core.StackMeta
import hu.vrg.mobile.core.StackPages
import hu.vrg.mobile.core.StackSync
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

// Rétegverem (WP M17): the VRG Stack's two 3D pages on the phone. The stack is built on the PC and published on
// `stack-pages` by Mobile/stack/publish-stack.js (START → R Rétegverem → T); each page is one self-contained HTML
// file with the data inside. This screen reads stack/meta.json (ETag-cached, a check is cheap) and downloads the
// pages through the contents API with the M3 token only when the publish changed. The copies live in
// filesDir/stack/, so the last publish opens offline too, with its date.
//
// The WebView is set up like Kódváros online (M5): JavaScript and DOM storage on, file and content access off,
// the pages served from https://appassets.androidplatform.net/stack/<file> by shouldInterceptRequest, which
// answers only the two page files; every other request gets an empty 403, so nothing leaves the phone. Touch is
// in the pages themselves (notes/stack/touch.js): one finger orbits, pinch zooms, twist turns, tap picks, double
// tap resets, long press selects; on Holo a two-finger swipe changes the form and a long press on empty space
// opens / closes the Őrség lock.
//
// Full screen (2026-11-07): ⛶ here or in the page hides this screen's bar and the system bars, so only the 3D is
// left; the page's ✕ or Back brings them back. The page and the app tell each other through one JavaScript
// interface, `VRGApp.fullscreen(on)`; it is the only thing the pages can call, and only our two pages load here.

object StackFeature : VrgFeature {
    override val info = Catalogue.STACK
    private const val TAG = "stack"
    private const val HOST = "appassets.androidplatform.net"
    private const val RAW = "application/vnd.github.raw"

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var root: File
    private lateinit var prefs: SharedPreferences

    val page = MutableStateFlow(StackPages.PAGES.first())
    /** The publish on the phone, if any. */
    val shown = MutableStateFlow<StackMeta?>(null)
    /** Bumped when new pages land, so the WebView reloads. */
    val loaded = MutableStateFlow(0)
    val busy = MutableStateFlow(false)
    val progress = MutableStateFlow<Float?>(null)
    val problem = MutableStateFlow<String?>(null)
    val offline = MutableStateFlow(false)
    /** Full screen: only the 3D, no bars. */
    val full = MutableStateFlow(false)
    private val main = Handler(Looper.getMainLooper())

    /** What the pages may call: window.VRGApp.fullscreen(on). */
    private class Bridge { @JavascriptInterface fun fullscreen(on: Boolean) { main.post { full.value = on } } }

    private val ring = MiniTrack()
    override val activity: StateFlow<MiniStatus> get() = ring.status
    private var web: WebView? = null

    override fun init(app: Application) {
        root = File(app.filesDir, StackPages.DIR)
        prefs = app.getSharedPreferences("stack", Context.MODE_PRIVATE)
        page.value = StackPages.page(prefs.getString("page", null))
        shown.value = local()
    }

    // ---- the phone's copies ---------------------------------------------------------------------------

    private fun file(name: String) = File(root, name)
    private fun local(): StackMeta? = try { file(StackPages.META).takeIf { it.exists() }?.readText()?.let { StackMeta.parse(it) } } catch (e: Exception) { null }
    private fun have(): Map<String, Long> = StackPages.PAGES.associate { it.file to (file(it.file).takeIf { f -> f.isFile }?.length() ?: -1L) }

    fun choose(id: String) {
        val p = StackPages.page(id)
        if (p == page.value) return
        page.value = p
        prefs.edit().putString("page", p.id).apply()
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
        val r = GitHub.get(StackPages.contents(VrgRepo.PATH, StackPages.META))
        val remote = (r as? Gh.Ok)?.let { Contents.parse(it.value)?.text }?.let { StackMeta.parse(it) }
        val answered = r is Gh.Ok || (r is Gh.Failed && r.code == 404)
        val mine = local()
        when (val step = StackSync.decide(mine, have(), remote, answered)) {
            StackSync.Fresh -> { offline.value = false; problem.value = null; ring.done() }
            StackSync.Offline -> {
                offline.value = mine != null
                problem.value = (r.problem() ?: "A GitHub nem válaszolt.") + if (mine != null) " A telefonon lévő változat látszik." else ""
                ring.fail()
            }
            StackSync.Missing -> {
                offline.value = false
                problem.value = "Még nincs feltöltve: a PC-n START → R Rétegverem → T (Telefonra)."
                ring.done()
            }
            is StackSync.Download -> download(step.meta)
        }
    }

    private suspend fun download(meta: StackMeta) {
        root.mkdirs()
        val total = StackPages.PAGES.sumOf { meta.bytes(it) }.coerceAtLeast(1)
        var before = 0L
        val started = System.currentTimeMillis()
        val parts = mutableListOf<Pair<File, File>>()
        for (p in StackPages.PAGES) {
            val want = meta.bytes(p)
            val part = file(p.file + ".part")
            val got = GitHub.download(GitHubUrls.API + StackPages.contents(VrgRepo.PATH, p.file), part, RAW) { done ->
                val f = ((before + done).toFloat() / total).coerceIn(0f, 1f)
                progress.value = f; ring.run(f)
            }
            if (got !is Gh.Ok || part.length() != want) {
                parts.forEach { it.first.delete() }; part.delete()
                offline.value = local() != null
                problem.value = got.problem() ?: "A letöltés nem lett teljes (${p.title}: ${part.length()} / $want bájt)."
                VrgLog.w(TAG, problem.value ?: "")
                ring.fail()
                return
            }
            before += want
            parts += part to file(p.file)
        }
        // the pages first, then the meta: a cut write leaves an old meta beside new pages, which the next check
        // simply downloads again
        for ((part, dest) in parts) if (!part.renameTo(dest)) { dest.delete(); part.renameTo(dest) }
        file(StackPages.META).writeText(meta.toJson())
        VrgLog.i(TAG, "Rétegverem ${meta.generatedLabel}: ${total / 1024} KB, ${System.currentTimeMillis() - started} ms")
        offline.value = false
        problem.value = null
        shown.value = meta
        loaded.value++
        ring.done()
    }

    // ---- the WebView --------------------------------------------------------------------------------------

    private fun pageUrl(file: String) = "https://$HOST/${StackPages.DIR}/$file"

    /** Only the two page files; everything else is refused. */
    private fun serve(uri: Uri): WebResourceResponse {
        val seg = uri.pathSegments
        val p = if (uri.host == HOST && seg.size == 2 && seg[0] == StackPages.DIR) StackPages.byFile(seg[1]) else null
        val f = p?.let { file(it.file) }?.takeIf { it.isFile }
            ?: return WebResourceResponse("text/plain", "utf-8", 403, "Forbidden", mapOf("Cache-Control" to "no-store"), ByteArrayInputStream(ByteArray(0)))
        return WebResourceResponse("text/html", "utf-8", 200, "OK", mapOf("Cache-Control" to "no-store"), FileInputStream(f))
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
        addJavascriptInterface(Bridge(), "VRGApp")
        webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse = serve(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url
                if (u.host == HOST) return false
                if (request.isForMainFrame && (u.scheme == "https" || u.scheme == "http"))
                    runCatching { view.context.startActivity(Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
                return true
            }

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                // two WebGL pages with ~25 000 points can run out of memory on a small phone: drop the view, keep the app
                VrgLog.w(TAG, "A Rétegverem megjelenítője leállt (crash: ${detail.didCrash()})")
                problem.value = "A megjelenítő leállt. Nyisd meg újra."
                if (web === view) web = null
                view.destroy()
                return true
            }
        }
    }

    private tailrec fun Context.findActivity(): Activity? = when (this) { is Activity -> this; is ContextWrapper -> baseContext.findActivity(); else -> null }

    override fun onForeground(on: Boolean) {
        web?.let { if (on) it.onResume() else it.onPause() }
    }

    // ---- the screen -----------------------------------------------------------------------------------------

    @Composable
    override fun Screen(host: FeatureHost) {
        val account by GitHub.account.collectAsStateWithLifecycle()
        val current by page.collectAsStateWithLifecycle()
        val meta by shown.collectAsStateWithLifecycle()
        val tick by loaded.collectAsStateWithLifecycle()
        val loading by busy.collectAsStateWithLifecycle()
        val pct by progress.collectAsStateWithLifecycle()
        val why by problem.collectAsStateWithLifecycle()
        val old by offline.collectAsStateWithLifecycle()
        val isFull by full.collectAsStateWithLifecycle()
        LaunchedEffect(account is Account.SignedIn) { refresh() }
        // full screen: the system bars go too (swipe from the edge shows them for a moment); the page is told as well
        val view = LocalView.current
        LaunchedEffect(isFull) {
            view.context.findActivity()?.window?.let { w ->
                val c = WindowCompat.getInsetsController(w, view)
                if (isFull) { c.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE; c.hide(WindowInsetsCompat.Type.systemBars()) }
                else c.show(WindowInsetsCompat.Type.systemBars())
            }
            web?.evaluateJavascript("window.setFull && setFull($isFull)", null)
        }
        DisposableEffect(Unit) { onDispose { if (full.value) { full.value = false; view.context.findActivity()?.window?.let { WindowCompat.getInsetsController(it, view).show(WindowInsetsCompat.Type.systemBars()) } } } }
        BackHandler(isFull) { full.value = false }

        Column(Modifier.fillMaxSize().then(if (isFull) Modifier.background(Melyviz.abyss) else Modifier)) {
            if (!isFull) Column(Modifier.padding(horizontal = 12.dp, vertical = 2.dp)) {
                // one row: back, the title, the two pages, refresh, full screen; nothing wraps or overlaps
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("‹", style = Melyviz.title.copy(fontSize = 22.sp, color = Melyviz.current),
                        modifier = Modifier.clickable { host.home() }.padding(horizontal = 4.dp, vertical = 6.dp))
                    Text("RÉTEGVEREM", style = Melyviz.title.copy(fontSize = 13.sp), maxLines = 1, overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f))
                    StackPages.PAGES.forEach { p -> VrgChip(p.title, selected = p == current) { choose(p.id) } }
                    VrgChip(if (loading) "…" else "⟳") { refresh() }
                    if (meta != null) VrgChip("⛶") { full.value = true }
                }
                val m = meta
                if (m != null) {
                    Text("${m.generatedLabel} UTC · ${m.nodes} csomópont · ${m.points} × 2 KB · ${m.lines} pálya" + if (old) " · offline" else "",
                        style = Melyviz.readout.copy(fontSize = 10.sp), maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                pct?.let { Text("Letöltés… ${(it * 100).toInt()} %", style = Melyviz.small) }
                if (account !is Account.SignedIn && m == null) {
                    Text("A repó privát: GitHub belépés kell.", style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 6.dp))
                    Row(Modifier.padding(vertical = 6.dp)) { VrgChip("GitHub fiók ›") { host.open(Catalogue.ACCOUNT.id) } }
                }
                why?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand), maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(vertical = 2.dp)) }
            }
            Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                val m = meta
                if (m == null) {
                    Text(if (loading) "Betöltés…" else "Itt jelenik meg a Rétegverem.", style = Melyviz.small)
                } else {
                    val url = pageUrl(current.file)
                    AndroidView(
                        factory = { ctx -> makeWebView(ctx).also { web = it } },
                        modifier = Modifier.fillMaxSize(),
                        update = { wv ->
                            val want = "$url@${m.published}#$tick"
                            if (wv.tag != want) { wv.tag = want; wv.loadUrl(if (isFull) "$url#full" else url) }
                        },
                        onRelease = { wv -> if (web === wv) web = null; wv.destroy() },
                    )
                }
            }
        }
    }
}
