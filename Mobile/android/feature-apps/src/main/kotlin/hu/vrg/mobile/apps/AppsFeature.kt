package hu.vrg.mobile.apps

import android.annotation.SuppressLint
import android.app.Application
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.ConsoleMessage
import android.webkit.RenderProcessGoneDetail
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.AppEntry
import hu.vrg.mobile.core.AppManifest
import hu.vrg.mobile.core.AppScheme
import hu.vrg.mobile.core.AppStep
import hu.vrg.mobile.core.AppSync
import hu.vrg.mobile.core.AppWeb
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.DeskApp
import hu.vrg.mobile.core.DeskApps
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
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileInputStream
import java.util.Locale
import java.util.concurrent.atomic.AtomicInteger

// Alkalmazások (WP M21): the Desktop's in-shell HTML apps on the phone. Which apps and which files each may read come from the Desktop's
// own catalog (DeskApps.kt, generated); what is served is AppScheme.decide, a port of the Desktop's vrg-app:// rules.
//
// Files: like Archívum (M18), straight from main through the contents API with the M3 token. For each app the phone keeps its page and
// any other allowed file the page has asked for, in filesDir/apps/<id>/<repo path>, with a manifest of git blob shas. ⟳ lists the
// folders of those files (ETag-cached, cheap) and downloads only what changed, each to `.part`, checked against the listed size and
// renamed; a file main dropped is deleted. The apps open offline with what was last downloaded. A file the page asks for that the phone
// does not have yet (none of today's apps does this: they are single files) is fetched once, on the WebView's request thread.
//
// The WebView: JavaScript and DOM storage on, file and content access off, every app on its own origin
// https://<id>.appassets.androidplatform.net/ answered by shouldInterceptRequest, so localStorage works and stays the app's (the
// origin must never change: the app's saved data lives there). A GET to the artifact CDNs goes to the network (fonts); every other
// request off the app's origin gets an empty 403. A link that leaves the app opens in the phone's browser. An <input type=file> opens
// the phone's document picker. Back steps back in the app's own history, then leaves it.

object AppsFeature : VrgFeature {
    override val info = Catalogue.APPS
    private const val TAG = "apps"
    private const val LOCAL = "apps"
    private const val MANIFEST = "manifest.json"
    private const val RAW = "application/vnd.github.raw"

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var root: File
    private val lock = Mutex()

    /** One app's state on the phone. */
    data class AppState(
        val have: AppManifest? = null,
        val busy: Boolean = false,
        val progress: Float? = null,
        val problem: String? = null,
        val offline: Boolean = false,
        /** Bumped when new files land, so a WebView showing the app reloads. */
        val loaded: Int = 0,
    ) {
        fun ready(app: DeskApp) = have?.files?.containsKey(app.page) == true
    }

    val states = MutableStateFlow<Map<String, AppState>>(emptyMap())
    /** The app the feature's own screen shows (null = the list). */
    val showing = MutableStateFlow<String?>(null)

    private val ring = MiniTrack()
    override val activity: StateFlow<MiniStatus> get() = ring.status

    override fun init(app: Application) {
        root = File(app.filesDir, LOCAL)
        states.value = DeskApps.ALL.associate { it.id to AppState(have = manifest(it)) }
    }

    /** vrg://apps/<id> opens that app (the Asztal's ◣ menu and Kommand route web apps here). */
    override fun open(route: Route): Boolean {
        val id = route.path.trim('/')
        if (id.isEmpty()) { showing.value = null; return true }
        val app = DeskApps.ALL.firstOrNull { it.id == id } ?: return false
        showing.value = app.id
        return true
    }

    fun app(id: String): DeskApp? = DeskApps.ALL.firstOrNull { it.id == id }

    // ---- the phone's copies ---------------------------------------------------------------------------------

    private fun dir(app: DeskApp) = File(root, app.id)
    private fun file(app: DeskApp, rel: String) = File(dir(app), rel)
    private fun manifest(app: DeskApp): AppManifest? = try { File(dir(app), MANIFEST).takeIf { it.isFile }?.readText()?.let { AppManifest.parse(it) } } catch (e: Exception) { null }
    private fun have(app: DeskApp): Map<String, Long> =
        (manifest(app)?.files?.keys ?: emptySet()).mapNotNull { rel -> file(app, rel).takeIf { it.isFile }?.let { rel to it.length() } }.toMap()
    private fun save(app: DeskApp, m: AppManifest) { dir(app).mkdirs(); File(dir(app), MANIFEST).writeText(m.toJson()) }

    private fun set(id: String, f: (AppState) -> AppState) = states.update { it + (id to f(it[id] ?: AppState())) }

    // ---- GitHub ----------------------------------------------------------------------------------------------

    fun refresh(id: String) {
        val app = app(id) ?: return
        if (states.value[id]?.busy == true) return
        if (!GitHub.signedIn) {
            set(id) { s -> s.copy(offline = s.have != null, problem = if (s.have != null) "Nincs GitHub belépés: a telefonon lévő változat nyílik." else "A repó privát: GitHub belépés kell.") }
            return
        }
        set(id) { it.copy(busy = true, problem = null) }
        ring.run()
        scope.launch {
            try { lock.withLock { sync(app) } } catch (e: Exception) {
                set(id) { it.copy(problem = "Hiba: ${e.javaClass.simpleName}") }
                VrgLog.w(TAG, "${app.id}: ${e.message}")
                ring.fail()
            } finally { set(id) { it.copy(busy = false, progress = null) } }
        }
    }

    fun refreshAll() = DeskApps.ALL.forEach { if (states.value[it.id]?.have != null) refresh(it.id) }

    /** main's files in the folders of what the phone keeps for [app]; null + why when a listing failed. */
    private suspend fun listings(app: DeskApp, keep: Collection<String>): Pair<Map<String, AppEntry>?, String?> {
        val out = mutableMapOf<String, AppEntry>()
        for (d in AppSync.dirs(app, keep)) {
            when (val r = GitHub.get(AppSync.listing(VrgRepo.PATH, d))) {
                is Gh.Ok -> out += AppSync.parseListing(r.value, d) ?: return null to "A GitHub válasza nem mappalista ($d)."
                is Gh.Failed -> if (r.code != 404) return null to r.problem()
                else -> return null to r.problem()
            }
        }
        return out to null
    }

    private suspend fun sync(app: DeskApp) {
        val mine = manifest(app)
        val (remote, why) = listings(app, mine?.files?.keys ?: emptySet())
        when (val step = AppSync.decide(app, mine, have(app), remote, remote != null)) {
            AppStep.Fresh -> { set(app.id) { it.copy(offline = false, problem = null) }; ring.done() }
            AppStep.Offline -> {
                set(app.id) { it.copy(offline = mine != null, problem = (why ?: "A GitHub nem válaszolt.") + if (mine != null) " A telefonon lévő változat nyílik." else "") }
                ring.fail()
            }
            AppStep.Missing -> { set(app.id) { it.copy(problem = "A main ágon nincs meg az oldala (${app.page}). Frissítsd a VRG Mobile-t.") }; ring.done() }
            is AppStep.Download -> download(app, mine, step)
        }
    }

    private suspend fun download(app: DeskApp, mine: AppManifest?, step: AppStep.Download) {
        val total = step.bytes().coerceAtLeast(1)
        var before = 0L
        val now = (mine?.files ?: emptyMap()).toMutableMap()
        var failed: String? = null
        for (rel in step.fetch) {
            val want = step.remote.getValue(rel)
            val got = fetchOne(app, rel, want) { done ->
                val f = ((before + done).toFloat() / total).coerceIn(0f, 1f)
                set(app.id) { it.copy(progress = f) }; ring.run(f)
            }
            if (got != null) { failed = got; break }
            now[rel] = want
            before += want.size
        }
        if (failed == null) for (rel in step.drop) { file(app, rel).delete(); now.remove(rel) }
        val result = AppManifest(now)
        save(app, result)
        set(app.id) { it.copy(have = result, loaded = it.loaded + 1, offline = failed != null, problem = failed) }
        if (failed != null) { VrgLog.w(TAG, "${app.id}: $failed"); ring.fail(); return }
        VrgLog.i(TAG, "${app.id}: ${step.fetch.size} fájl, ${total / 1024} KB, ${step.drop.size} törölve")
        ring.done()
    }

    /** One file to `.part`, checked and renamed; null = done, else why not. */
    private suspend fun fetchOne(app: DeskApp, rel: String, want: AppEntry, onProgress: (Long) -> Unit = {}): String? {
        val dest = file(app, rel)
        dest.parentFile?.mkdirs()
        val part = File(dest.path + ".part")
        val got = GitHub.download(GitHubUrls.API + AppSync.contents(VrgRepo.PATH, rel), part, RAW, onProgress)
        if (got !is Gh.Ok || part.length() != want.size) {
            part.delete()
            return got.problem() ?: "A letöltés nem lett teljes ($rel: ${part.length()} / ${want.size} bájt)."
        }
        if (!part.renameTo(dest)) { dest.delete(); part.renameTo(dest) }
        return null
    }

    /** A file the page asks for that the phone does not keep yet: its folder's listing for the sha, then the file. On the request thread. */
    private fun fetchLate(app: DeskApp, rel: String): Boolean = runBlocking {
        if (!GitHub.signedIn) return@runBlocking false
        lock.withLock {
            if (file(app, rel).isFile) return@withLock true
            val d = rel.substringBeforeLast('/', "")
            val r = GitHub.get(AppSync.listing(VrgRepo.PATH, d)) as? Gh.Ok ?: return@withLock false
            val want = AppSync.parseListing(r.value, d)?.get(rel) ?: return@withLock false
            if (fetchOne(app, rel, want) != null) return@withLock false
            val m = AppManifest((manifest(app)?.files ?: emptyMap()) + (rel to want))
            save(app, m)
            set(app.id) { it.copy(have = m) }
            VrgLog.i(TAG, "${app.id}: később kért fájl letöltve: $rel")
            true
        }
    }

    // ---- the WebView -------------------------------------------------------------------------------------------

    private fun refuse(status: Int = 403) = WebResourceResponse("text/plain", "utf-8", status, if (status == 404) "Not Found" else "Forbidden",
        mapOf("Cache-Control" to "no-store"), ByteArrayInputStream(ByteArray(0)))

    /** The app's own files (AppScheme.decide); a GET to an artifact CDN goes to the network (null); the rest is refused. */
    private fun serve(app: DeskApp, request: WebResourceRequest): WebResourceResponse? {
        val uri = request.url
        if (!uri.host.equals(AppScheme.host(app.id), ignoreCase = true))
            return if (AppWeb.mayLoad(uri.scheme, uri.host, request.method)) null else refuse()
        if (!request.method.equals("GET", ignoreCase = true)) return refuse()
        val d = AppScheme.decide(uri.toString())
        if (!d.ok || d.id != app.id) return refuse(d.status.takeIf { it == 404 } ?: 403)
        val f = file(app, d.rel)
        if (!f.isFile && !fetchLate(app, d.rel)) return refuse(404)
        val type = d.type.substringBefore(';')
        return WebResourceResponse(type, if (type.startsWith("text/") || type.endsWith("json") || type.endsWith("javascript")) "utf-8" else null,
            200, "OK", mapOf("Cache-Control" to "no-store"), FileInputStream(f))
    }

    private val pickers = AtomicInteger()

    /** <input type=file>: the phone's document picker, through the Activity's result registry (no Fragment needed). */
    private fun pick(host: FeatureHost, cb: ValueCallback<Array<Uri>>, params: WebChromeClient.FileChooserParams): Boolean {
        val types = params.acceptTypes.orEmpty().flatMap { it.split(',') }.map { it.trim() }.filter { it.contains('/') }.ifEmpty { listOf("*/*") }
        val key = "vrg-apps-file-" + pickers.incrementAndGet()
        var launcher: androidx.activity.result.ActivityResultLauncher<Array<String>>? = null
        launcher = host.activity.activityResultRegistry.register(key, ActivityResultContracts.OpenMultipleDocuments()) { uris ->
            cb.onReceiveValue(if (params.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) uris.toTypedArray() else uris.take(1).toTypedArray())
            launcher?.unregister()
        }
        return try { launcher.launch(types.toTypedArray()); true } catch (e: Exception) { launcher.unregister(); cb.onReceiveValue(null); false }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun makeWebView(ctx: Context, app: DeskApp, host: FeatureHost): WebView = WebView(ctx).apply {
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.setGeolocationEnabled(false)
        settings.mediaPlaybackRequiresUserGesture = true
        settings.cacheMode = WebSettings.LOAD_NO_CACHE
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.setSupportZoom(true)
        settings.builtInZoomControls = true
        settings.displayZoomControls = false
        webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? = serve(app, request)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url
                if (AppScheme.sameApp(app.id, u.toString())) return false
                if (request.isForMainFrame && (u.scheme == "https" || u.scheme == "http" || u.scheme == "mailto" || u.scheme == "tel"))
                    runCatching { view.context.startActivity(Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
                return true
            }

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                VrgLog.w(TAG, "${app.id} megjelenítője leállt (crash: ${detail.didCrash()})")
                set(app.id) { it.copy(problem = "A megjelenítő leállt. Nyisd meg újra.") }
                view.destroy()
                return true
            }
        }
        webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(view: WebView, cb: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean = pick(host, cb, params)

            override fun onConsoleMessage(m: ConsoleMessage): Boolean {
                if (m.messageLevel() == ConsoleMessage.MessageLevel.ERROR) VrgLog.w(TAG, "${app.id}: ${m.message()} (${m.sourceId().substringAfterLast('/')}:${m.lineNumber()})")
                return true
            }
        }
    }

    // ---- the screens -------------------------------------------------------------------------------------------

    /** One app, full size: used by the feature's screen and by a Lapok window of kind `app` (M20). */
    @Composable
    fun AppView(id: String, host: FeatureHost, modifier: Modifier = Modifier, onLeave: () -> Unit) {
        val app = app(id) ?: return Text("Ismeretlen alkalmazás: $id", style = Melyviz.small, modifier = modifier.padding(16.dp))
        val all by states.collectAsStateWithLifecycle()
        val account by GitHub.account.collectAsStateWithLifecycle()
        val s = all[id] ?: AppState()
        LaunchedEffect(id, account is Account.SignedIn) { refresh(id) }
        val web = remember(id) { arrayOfNulls<WebView>(1) }
        BackHandler { val w = web[0]; if (w != null && w.canGoBack()) w.goBack() else onLeave() }
        Column(modifier) {
            if (s.busy || s.problem != null || !s.ready(app)) Column(Modifier.padding(horizontal = 12.dp, vertical = 4.dp)) {
                s.progress?.let { Text("Letöltés… ${(it * 100).toInt()} %", style = Melyviz.small) }
                if (s.busy && s.progress == null) Text("Ellenőrzés a GitHubon…", style = Melyviz.small)
                s.problem?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand), maxLines = 3, overflow = TextOverflow.Ellipsis) }
                if (account !is Account.SignedIn && !s.ready(app)) Row(Modifier.padding(vertical = 6.dp)) { VrgChip("GitHub fiók ›") { host.open(Catalogue.ACCOUNT.id) } }
            }
            Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                if (!s.ready(app)) Text(if (s.busy) "Betöltés…" else "Itt nyílik meg: ${app.hu}", style = Melyviz.small)
                else AndroidView(
                    factory = { ctx -> makeWebView(ctx, app, host) },
                    modifier = Modifier.fillMaxSize(),
                    update = { wv ->
                        web[0] = wv
                        val want = "${s.loaded}"
                        if (wv.tag != want) { wv.tag = want; wv.loadUrl(AppScheme.urlFor(app.id)) }
                    },
                    onRelease = { wv -> if (web[0] === wv) web[0] = null; wv.destroy() },
                )
            }
        }
    }

    override fun onForeground(on: Boolean) {}

    @Composable
    override fun Screen(host: FeatureHost) {
        val id by showing.collectAsStateWithLifecycle()
        val cur = id?.let { app(it) }
        if (cur != null) {
            Column(Modifier.fillMaxSize()) {
                Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 2.dp), verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("‹", style = Melyviz.title.copy(fontSize = 22.sp, color = Melyviz.current),
                        modifier = Modifier.clickable { showing.value = null }.padding(horizontal = 4.dp, vertical = 6.dp))
                    Text(cur.hu.uppercase(Locale.ROOT), style = Melyviz.title.copy(fontSize = 13.sp), maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                    VrgChip("⟳") { refresh(cur.id) }
                }
                AppView(cur.id, host, Modifier.fillMaxWidth().weight(1f)) { showing.value = null }
            }
            return
        }
        AppList(host)
    }

    @Composable
    private fun AppList(host: FeatureHost) {
        val all by states.collectAsStateWithLifecycle()
        val account by GitHub.account.collectAsStateWithLifecycle()
        BackHandler { host.home() }
        Column(Modifier.fillMaxSize().padding(horizontal = 12.dp)) {
            Row(Modifier.fillMaxWidth().padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("‹", style = Melyviz.title.copy(fontSize = 22.sp, color = Melyviz.current), modifier = Modifier.clickable { host.home() }.padding(horizontal = 4.dp, vertical = 6.dp))
                Text("ALKALMAZÁSOK", style = Melyviz.title.copy(fontSize = 13.sp), modifier = Modifier.weight(1f))
                VrgChip("⟳ mind") { refreshAll() }
            }
            if (account !is Account.SignedIn && all.values.none { it.have != null }) {
                Text("A repó privát: az első letöltéshez GitHub belépés kell. Utána offline is nyílnak.", style = Melyviz.small.copy(color = Melyviz.sand))
                Row(Modifier.padding(vertical = 6.dp)) { VrgChip("GitHub fiók ›") { host.open(Catalogue.ACCOUNT.id) } }
            }
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                DeskApps.ALL.forEach { a ->
                    val s = all[a.id] ?: AppState()
                    val state = when {
                        s.busy -> s.progress?.let { "letöltés ${(it * 100).toInt()} %" } ?: "ellenőrzés…"
                        s.ready(a) -> String.format(Locale.ROOT, "%.1f MB", (s.have?.bytes ?: 0) / 1048576.0) + if (s.offline) " · offline" else " · a telefonon"
                        else -> "még nincs letöltve"
                    }
                    Row(Modifier.fillMaxWidth().heightIn(min = 56.dp).clickable { showing.value = a.id }.padding(vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(40.dp).background(Melyviz.raised, RoundedCornerShape(10.dp)).border(1.dp, if (s.ready(a)) Melyviz.glowDim else Melyviz.lineSoft, RoundedCornerShape(10.dp)),
                            contentAlignment = Alignment.Center) {
                            Text(a.hu.split(' ').take(2).joinToString("") { it.take(1) }.uppercase(Locale.ROOT), style = Melyviz.readout.copy(color = if (s.ready(a)) Melyviz.glow else Melyviz.faint))
                        }
                        Column(Modifier.weight(1f).padding(start = 10.dp)) {
                            Text(a.hu, style = Melyviz.label, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(state, style = Melyviz.small.copy(fontSize = 10.sp), maxLines = 1)
                            s.problem?.let { Text(it, style = Melyviz.small.copy(fontSize = 10.sp, color = Melyviz.sand), maxLines = 1, overflow = TextOverflow.Ellipsis) }
                        }
                        Text("›", style = Melyviz.title.copy(color = Melyviz.muted))
                    }
                }
            }
        }
    }
}
