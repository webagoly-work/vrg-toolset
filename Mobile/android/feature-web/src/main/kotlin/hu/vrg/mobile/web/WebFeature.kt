package hu.vrg.mobile.web

import android.annotation.SuppressLint
import android.app.Application
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.net.http.SslError
import android.view.View
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.SslErrorHandler
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebStorage
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.Route
import hu.vrg.mobile.core.Typed
import hu.vrg.mobile.core.WebLinks
import hu.vrg.mobile.core.WebLinksData
import hu.vrg.mobile.core.WebLinksError
import hu.vrg.mobile.core.WebRow
import hu.vrg.mobile.core.WebRules
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.ui.VrgSectionTitle
import kotlinx.coroutines.flow.MutableStateFlow
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

// Böngésző (WP M68, T7 of docs/browser/TRAJECTORIES.md, BRW-Q04 = A): real browsing on the phone for work pages — a
// datasheet, a supplier's catalogue, a standard, the LAN admin page of a router on site — inside VRG Mobile.
//
// The WebView keeps the VRG Asztal's web contract (kit-core WebRules.CONTRACT, the same lines as the Asztal's Böngésző pane
// and the Data Vault browser-kit's RULES):
// - http and https only; mailto: / tel: go to the phone's apps, every other scheme (intent:, javascript:, file: …) is refused;
// - no bridge from a page into the app: no addJavascriptInterface, no file / content access, no mixed content, no
//   third-party cookies, no geolocation, every permission request (camera, microphone, MIDI …) denied;
// - a certificate error cancels the load and is never overridden;
// - one view: target=_blank opens in place (no pop-up windows);
// - a download is never saved by the app: after a yes it is handed to the phone's browser;
// - nothing of a page reaches VrgLog except its origin (no paths, no queries, no console messages).
// The address bar is the PC's (WebRules.classify: a URL with the scheme it needs, !bangs of Browser/config/engines.json,
// otherwise a search with the engine chosen once); Tiszta link strips tracking parameters from what is typed or opened.
// Bookmarks and history are one vrg.web-links v1 file (filesDir/web/links.json): exported, it is read by the VRG Böngésző
// (opened in the Asztal, what it loads goes on to the Asztal's web.json) and the Data Vault's browser; their exports merge in.

object WebFeature : VrgFeature {
    override val info = Catalogue.WEB
    private const val TAG = "web"
    private const val PREFS = "web"
    private const val KEY_ENGINE = "engine"
    private const val KEY_LAST = "last"
    private const val KEY_RECORD = "record"
    const val DIR = "web"
    const val FILE = "links.json"

    private lateinit var app: Application
    private fun prefs() = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private val io = Executors.newSingleThreadExecutor()

    val links = MutableStateFlow(WebLinksData())
    val engine = MutableStateFlow("google")
    /** History is kept (true) or this is a session without history (false; bookmarks still work). */
    val record = MutableStateFlow(true)
    /** The page to load next; "" = the start page. */
    private val pending = MutableStateFlow<String?>(null)
    private val reloads = MutableStateFlow(0)
    /** The page on screen now (its URL), for the address bar and the ★. */
    private val shown = MutableStateFlow("")
    private val pageTitleFlow = MutableStateFlow("")
    private val loadProgress = MutableStateFlow(100)

    private fun file() = File(File(app.filesDir, DIR), FILE)

    override fun init(app: Application) {
        this.app = app
        val p = prefs()
        engine.value = p.getString(KEY_ENGINE, null)?.takeIf { id -> WebRules.engines.any { it.id == id } }
            ?: WebRules.engines.firstOrNull { it.isDefault }?.id ?: "google"
        record.value = p.getBoolean(KEY_RECORD, true)
        io.execute {
            val f = file()
            links.value = try { if (f.isFile) WebLinks.read(f.readText()) else WebLinksData() }
            catch (e: Exception) { VrgLog.w(TAG, "a könyvjelzőfájl nem olvasható, félretéve"); f.renameTo(File(f.parentFile, "links.bad.json")); WebLinksData() }
        }
    }

    private fun save(l: WebLinksData) {
        links.value = l
        val text = WebLinks.write(l)
        io.execute {
            val f = file()
            f.parentFile?.mkdirs()
            val tmp = File(f.parentFile, "$FILE.tmp")
            tmp.writeText(text)
            if (!tmp.renameTo(f)) { f.delete(); tmp.renameTo(f) }
        }
    }

    /**
     * vrg://web opens the browser where it was; vrg://web?u=<an address or anything typed> opens that (a search when it is
     * not an address); vrg://web?q=<words> searches with the chosen engine. The shell sends the Kommand's URLs, the Asztal's
     * Böngésző unit and the VRG Böngésző web app's pages here.
     */
    override fun open(route: Route): Boolean {
        route.params["u"]?.let { return go(it) == null }
        route.params["q"]?.let { q ->
            val e = WebRules.engines.firstOrNull { it.id == engine.value } ?: return false
            load(WebRules.searchUrl(e, q)); return true
        }
        return route.path.isEmpty()
    }

    /** Loads what was typed; returns why not, or null. */
    private fun go(typed: String): String? = when (val t = WebRules.classify(typed, WebRules.engines, engine.value)) {
        is Typed.Url -> { load(WebRules.strip(t.url)); null }
        is Typed.Search -> { load(t.url); null }
        Typed.Blocked -> "Ezt a címet a Böngésző nem nyitja meg (csak http és https)."
        Typed.Empty -> null
    }

    private fun load(url: String) {
        pending.value = url
        reloads.value++
    }

    private fun setEngine(id: String) {
        engine.value = id
        prefs().edit().putString(KEY_ENGINE, id).apply()
    }

    private fun setRecord(on: Boolean) {
        record.value = on
        prefs().edit().putBoolean(KEY_RECORD, on).apply()
    }

    private fun visited(url: String?, t: String?) {
        if (url == null || !WebRules.isWebUrl(url)) return
        shown.value = url
        prefs().edit().putString(KEY_LAST, url).apply()
        if (!record.value) return
        val next = WebLinks.visit(links.value, url, t, System.currentTimeMillis())
        if (next != links.value) save(next)
    }

    /** Cookies, the page cache, the pages' storage and the history; bookmarks stay. */
    private fun clearData(web: WebView?) {
        CookieManager.getInstance().removeAllCookies(null)
        WebStorage.getInstance().deleteAllData()
        web?.clearCache(true)
        web?.clearHistory()
        save(links.value.copy(history = emptyList()))
        prefs().edit().remove(KEY_LAST).apply()
        VrgLog.i(TAG, "böngészési adatok törölve")
    }

    // ---- the WebView -------------------------------------------------------------------------------------------

    private fun outside(ctx: Context, u: Uri) =
        runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }.isSuccess

    @SuppressLint("SetJavaScriptEnabled")
    private fun makeWebView(ctx: Context, host: FeatureHost, onProblem: (String?) -> Unit, onDownload: (String, String) -> Unit): WebView = WebView(ctx).apply {
        layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.setGeolocationEnabled(false)
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.javaScriptCanOpenWindowsAutomatically = false
        settings.setSupportMultipleWindows(false)          // target=_blank loads in this view
        settings.mediaPlaybackRequiresUserGesture = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.setSupportZoom(true)
        settings.builtInZoomControls = true
        settings.displayZoomControls = false
        CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)
        setDownloadListener { url, _, disposition, mime, _ ->
            if (WebRules.isWebUrl(url)) onDownload(url, URLUtil.guessFileName(url, disposition, mime))
        }
        webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url
                val s = u.scheme?.lowercase()
                if (s == "http" || s == "https") return false
                if (request.isForMainFrame && (s == "mailto" || s == "tel")) { if (!outside(view.context, u)) host.note("Nincs ehhez alkalmazás a telefonon.") }
                else if (request.isForMainFrame) host.note("A Böngésző csak http és https címet nyit meg.")
                return true
            }

            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                onProblem(null)
                if (url != null && WebRules.isWebUrl(url)) shown.value = url
            }

            override fun onPageFinished(view: WebView, url: String?) = visited(url, view.title)

            override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
                handler.cancel()   // never proceed
                VrgLog.w(TAG, "tanúsítványhiba: ${WebRules.forLog(error.url)}")
                onProblem("A webhely tanúsítványa hibás vagy nem megbízható, ezért nem nyílt meg.")
            }

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                VrgLog.w(TAG, "a megjelenítő leállt (crash: ${detail.didCrash()})")
                onProblem("A megjelenítő leállt. Nyisd meg újra.")
                view.destroy()
                return true
            }
        }
        webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, p: Int) { loadProgress.value = p }
            override fun onReceivedTitle(view: WebView, t: String?) { pageTitleFlow.value = t.orEmpty(); visited(view.url, t) }
            override fun onPermissionRequest(request: PermissionRequest) {
                request.deny()
                VrgLog.i(TAG, "engedélykérés elutasítva: ${WebRules.forLog(request.origin.toString())}")
            }
            override fun onGeolocationPermissionsShowPrompt(origin: String?, callback: GeolocationPermissions.Callback) = callback.invoke(origin, false, false)
            // a work page may still upload: <input type=file> gets the phone's document picker, reading only
            override fun onShowFileChooser(view: WebView, cb: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean = pick(host, cb, params)
            override fun onConsoleMessage(m: ConsoleMessage): Boolean = true
        }
    }

    private val pickers = AtomicInteger()

    private fun pick(host: FeatureHost, cb: ValueCallback<Array<Uri>>, params: WebChromeClient.FileChooserParams): Boolean {
        val types = params.acceptTypes.orEmpty().flatMap { it.split(',') }.map { it.trim() }.filter { it.contains('/') }.ifEmpty { listOf("*/*") }
        val key = "vrg-web-file-" + pickers.incrementAndGet()
        var launcher: androidx.activity.result.ActivityResultLauncher<Array<String>>? = null
        launcher = host.activity.activityResultRegistry.register(key, ActivityResultContracts.OpenMultipleDocuments()) { uris ->
            cb.onReceiveValue(if (params.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) uris.toTypedArray() else uris.take(1).toTypedArray())
            launcher?.unregister()
        }
        return try { launcher.launch(types.toTypedArray()); true } catch (e: Exception) { launcher.unregister(); cb.onReceiveValue(null); false }
    }

    /** Export: the phone's "save as" (a file the Asztal, the VRG Böngésző and the Data Vault read). */
    private fun export(host: FeatureHost) {
        val key = "vrg-web-export-" + pickers.incrementAndGet()
        val day = SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(Date())
        var launcher: androidx.activity.result.ActivityResultLauncher<String>? = null
        launcher = host.activity.activityResultRegistry.register(key, ActivityResultContracts.CreateDocument("application/json")) { uri ->
            launcher?.unregister()
            if (uri == null) return@register
            val text = WebLinks.write(links.value, day)
            io.execute {
                val ok = runCatching { app.contentResolver.openOutputStream(uri, "wt")!!.use { it.write(text.toByteArray(Charsets.UTF_8)) } }.isSuccess
                host.activity.runOnUiThread { host.note(if (ok) "Exportálva: ${links.value.bookmarks.size} könyvjelző, ${links.value.history.size} látogatás." else "Az export nem sikerült.") }
            }
        }
        try { launcher.launch("vrg-web-links-$day.json") } catch (e: Exception) { launcher.unregister() }
    }

    /** Import: a vrg.web-links file (or the Asztal's web.json) merged in; nothing on the phone is lost. */
    private fun importFile(host: FeatureHost) {
        val key = "vrg-web-import-" + pickers.incrementAndGet()
        var launcher: androidx.activity.result.ActivityResultLauncher<Array<String>>? = null
        launcher = host.activity.activityResultRegistry.register(key, ActivityResultContracts.OpenDocument()) { uri ->
            launcher?.unregister()
            if (uri == null) return@register
            io.execute {
                val msg = try {
                    val text = app.contentResolver.openInputStream(uri)!!.use { s -> s.readBytes().also { if (it.size > 16_000_000) throw WebLinksError("format", "too big") }.toString(Charsets.UTF_8) }
                    val inc = WebLinks.read(text)
                    val before = links.value
                    val merged = WebLinks.merge(before, inc).copy(ext = before.ext)
                    host.activity.runOnUiThread { save(merged) }
                    "Importálva: +${merged.bookmarks.size - before.bookmarks.size} könyvjelző, +${merged.history.size - before.history.size} látogatás."
                } catch (e: WebLinksError) {
                    when (e.kind) { "newer" -> "Ez a fájl újabb változatú, mint amit ez az alkalmazás olvas."; else -> "Ez nem könyvjelzőfájl (vrg.web-links)." }
                } catch (e: Exception) { "Az import nem sikerült." }
                host.activity.runOnUiThread { host.note(msg) }
            }
        }
        try { launcher.launch(arrayOf("application/json", "text/plain", "*/*")) } catch (e: Exception) { launcher.unregister() }
    }

    private fun share(host: FeatureHost, url: String, t: String) {
        val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, url).putExtra(Intent.EXTRA_SUBJECT, t)
        runCatching { host.activity.startActivity(Intent.createChooser(send, "Link megosztása")) }
    }

    // ---- the screen ----------------------------------------------------------------------------------------------

    private enum class Panel { NONE, START, BOOKMARKS, HISTORY, TOOLS }

    @Composable
    override fun Screen(host: FeatureHost) {
        val reload by reloads.collectAsStateWithLifecycle()
        val url by shown.collectAsStateWithLifecycle()
        val pageTitle by pageTitleFlow.collectAsStateWithLifecycle()
        val loading by loadProgress.collectAsStateWithLifecycle()
        val l by links.collectAsStateWithLifecycle()
        val eng by engine.collectAsStateWithLifecycle()
        var panel by remember { mutableStateOf(if (pending.value == null && prefs().getString(KEY_LAST, null) == null) Panel.START else Panel.NONE) }
        var problem by remember { mutableStateOf<String?>(null) }
        var download by remember { mutableStateOf<Pair<String, String>?>(null) }
        var typing by remember { mutableStateOf(false) }
        var text by remember { mutableStateOf("") }
        val web = remember { arrayOfNulls<WebView>(1) }
        val focus = LocalFocusManager.current

        BackHandler {
            val w = web[0]
            when {
                typing -> focus.clearFocus()
                panel != Panel.NONE && w?.url != null -> panel = Panel.NONE
                w != null && w.canGoBack() -> w.goBack()
                else -> host.home()
            }
        }
        fun submit() {
            val why = go(text)
            if (why != null) host.note(why) else { panel = Panel.NONE; focus.clearFocus() }
        }
        val marked = l.bookmarks.any { it.url == url }
        val colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Melyviz.glow, unfocusedBorderColor = Melyviz.line,
            focusedTextColor = Melyviz.ink, unfocusedTextColor = Melyviz.ink, cursorColor = Melyviz.glow,
        )

        Column(Modifier.fillMaxSize()) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 2.dp), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("‹", style = Melyviz.title.copy(fontSize = 22.sp, color = Melyviz.current),
                    modifier = Modifier.clickable { host.home() }.padding(horizontal = 4.dp, vertical = 6.dp))
                OutlinedTextField(
                    value = if (typing) text else url,
                    onValueChange = { text = it.take(2000) },
                    modifier = Modifier.weight(1f).onFocusChanged { f ->
                        if (f.isFocused && !typing) text = shown.value
                        typing = f.isFocused
                    },
                    singleLine = true, textStyle = Melyviz.small.copy(color = Melyviz.ink),
                    placeholder = { Text("Cím vagy keresés · !bang", style = Melyviz.small) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri, imeAction = ImeAction.Go, autoCorrectEnabled = false),
                    keyboardActions = KeyboardActions(onGo = { submit() }),
                    colors = colors,
                )
                if (url.isNotEmpty() && !typing) Text(if (marked) "★" else "☆", style = Melyviz.title.copy(fontSize = 20.sp, color = if (marked) Melyviz.sand else Melyviz.muted),
                    modifier = Modifier.clickable {
                        val (next, on) = WebLinks.toggle(links.value, url, pageTitle, System.currentTimeMillis())
                        if (on == null) host.note("Ez az oldal nem tehető könyvjelzőbe.") else { save(next); host.note(if (on) "Könyvjelző mentve." else "Könyvjelző törölve.") }
                    }.padding(horizontal = 4.dp, vertical = 6.dp))
                VrgChip("☰", selected = panel != Panel.NONE) { panel = if (panel == Panel.NONE) Panel.START else Panel.NONE }
            }
            if (loading in 1..99 && panel == Panel.NONE) Box(Modifier.fillMaxWidth(loading / 100f).height(2.dp).background(Melyviz.glow))
            problem?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(horizontal = 12.dp)) }
            download?.let { (u, name) ->
                Column(Modifier.fillMaxWidth().background(Melyviz.deep).padding(horizontal = 12.dp, vertical = 6.dp)) {
                    Text("Letöltés: $name · a VRG Mobile nem ment fájlt; a telefon böngészője tölti le.", style = Melyviz.small)
                    Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        VrgChip("Letöltés a böngészővel", true) { download = null; if (!outside(host.activity, Uri.parse(u))) host.note("Nincs böngésző a telefonon.") }
                        VrgChip("Mégse") { download = null }
                    }
                }
            }
            Box(Modifier.fillMaxWidth().weight(1f)) {
                AndroidView(
                    factory = { ctx -> makeWebView(ctx, host, { problem = it }) { u, n -> download = u to n } },
                    modifier = Modifier.fillMaxSize(),
                    update = { wv ->
                        web[0] = wv
                        wv.visibility = if (panel != Panel.NONE) View.INVISIBLE else View.VISIBLE
                        val want = "#$reload"
                        if (wv.tag != want) {
                            val fresh = wv.tag == null   // a new view (the feature came back): the page where it was left
                            wv.tag = want
                            val go = pending.value ?: if (fresh) prefs().getString(KEY_LAST, null)?.takeIf { WebRules.isWebUrl(it) } else null
                            pending.value = null
                            if (go != null) { wv.loadUrl(go); VrgLog.i(TAG, "megnyitva: ${WebRules.forLog(go)}"); panel = Panel.NONE }
                        }
                    },
                    onRelease = { wv -> if (web[0] === wv) web[0] = null; wv.destroy() },
                )
                if (panel != Panel.NONE) Box(Modifier.fillMaxSize().background(Melyviz.deep)) {
                    Panels(host, panel, { panel = it }, l, eng, url, pageTitle, { web[0] }) { u -> load(u); panel = Panel.NONE }
                }
            }
        }
    }

    @Composable
    private fun Panels(host: FeatureHost, panel: Panel, switch: (Panel) -> Unit, l: WebLinksData, eng: String, url: String, pageTitle: String,
                       web: () -> WebView?, openUrl: (String) -> Unit) {
        var q by remember(panel) { mutableStateOf("") }
        var confirm by remember { mutableStateOf(false) }
        val rec by record.collectAsStateWithLifecycle()
        Column(Modifier.fillMaxSize().padding(horizontal = 12.dp, vertical = 6.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                VrgChip("Kezdő", panel == Panel.START) { switch(Panel.START) }
                VrgChip("★ ${l.bookmarks.size}", panel == Panel.BOOKMARKS) { switch(Panel.BOOKMARKS) }
                VrgChip("Előzmények", panel == Panel.HISTORY) { switch(Panel.HISTORY) }
                VrgChip("⚙", panel == Panel.TOOLS) { switch(Panel.TOOLS) }
            }
            when (panel) {
                Panel.START -> LazyColumn(Modifier.fillMaxSize()) {
                    item {
                        val e = WebRules.engines.firstOrNull { it.id == eng }
                        Text("Írj címet vagy keresőszót a fenti sávba. Kereső: ${e?.hu ?: eng}; más keresőt egy !jellel választasz (!w Wikipédia, !tme TME, !m térkép …).",
                            style = Melyviz.small, modifier = Modifier.padding(vertical = 6.dp))
                        if (url.isNotEmpty()) Row(Modifier.padding(bottom = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            VrgChip("⟳ Újratöltés") { web()?.reload(); switch(Panel.NONE) }
                            VrgChip("Telefon böngészője ↗") { if (!outside(host.activity, Uri.parse(url))) host.note("Nincs böngésző a telefonon.") }
                            VrgChip("Megosztás") { share(host, url, pageTitle) }
                        }
                        if (l.bookmarks.isNotEmpty()) VrgSectionTitle("Könyvjelzők")
                    }
                    items(l.bookmarks.takeLast(12).reversed()) { b -> Line(b, null, { openUrl(b.url) }) }
                    val recent = WebLinks.grouped(l, limit = 8)
                    if (recent.isNotEmpty()) item { VrgSectionTitle("Legutóbb") }
                    items(recent) { (r, n) -> Line(r, n, { openUrl(r.url) }) }
                }
                Panel.BOOKMARKS, Panel.HISTORY -> Column(Modifier.fillMaxSize()) {
                    OutlinedTextField(q, { q = it.take(200) }, Modifier.fillMaxWidth().padding(vertical = 4.dp), singleLine = true,
                        textStyle = Melyviz.small.copy(color = Melyviz.ink), placeholder = { Text("Szűrés", style = Melyviz.small) })
                    val n = q.trim().lowercase()
                    LazyColumn(Modifier.fillMaxSize()) {
                        if (panel == Panel.BOOKMARKS) {
                            val list = l.bookmarks.reversed().filter { n.isEmpty() || it.url.lowercase().contains(n) || it.title.lowercase().contains(n) }
                            if (list.isEmpty()) item { Text("Nincs könyvjelző. Egy oldalon a ☆ menti.", style = Melyviz.small) }
                            items(list) { b -> Line(b, null, { openUrl(b.url) }) { save(l.copy(bookmarks = l.bookmarks.filter { it.url != b.url })) } }
                        } else {
                            val list = WebLinks.grouped(l, q, 500)
                            if (list.isEmpty()) item { Text(if (rec) "Még nincs előzmény." else "Az előzmények mentése ki van kapcsolva (⚙).", style = Melyviz.small) }
                            items(list) { (r, c) -> Line(r, c, { openUrl(r.url) }) { save(l.copy(history = l.history.filter { it.url != r.url })) } }
                        }
                    }
                }
                Panel.TOOLS -> LazyColumn(Modifier.fillMaxSize()) {
                    item {
                        VrgSectionTitle("Kereső")
                        Text("Egyszer választod ki (BRW-Q02); a !bang egy keresésre másikat választ.", style = Melyviz.small)
                    }
                    item {
                        val groups = WebRules.engines.groupBy { it.group }
                        Column(Modifier.padding(vertical = 4.dp)) {
                            for ((_, es) in groups) Row(Modifier.padding(vertical = 2.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                es.take(4).forEach { e -> VrgChip(e.hu, e.id == eng) { setEngine(e.id) } }
                            }
                        }
                    }
                    item {
                        VrgSectionTitle("Könyvjelzők és előzmények")
                        Text("Egy fájl (vrg.web-links v1): a PC-n a VRG Böngésző tölti be (az Asztalban futva az Asztal könyvjelzői közé), és a Data Vault böngészője is; az ő mentésük ide is betölthető. Az import semmit nem töröl.",
                            style = Melyviz.small)
                        Row(Modifier.padding(vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            VrgChip("Export…") { export(host) }
                            VrgChip("Import…") { importFile(host) }
                        }
                        Row(Modifier.padding(vertical = 2.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            VrgChip(if (rec) "Előzmények mentése: be" else "Előzmények mentése: ki", rec) { setRecord(!rec) }
                        }
                        VrgSectionTitle("Böngészési adatok")
                        Text("Törli a sütiket, a gyorsítótárat, az oldalak tárolt adatait és az előzményeket. A könyvjelzők maradnak.", style = Melyviz.small)
                        Row(Modifier.padding(vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            if (!confirm) VrgChip("Törlés…") { confirm = true }
                            else {
                                VrgChip("Igen, törlés", true) { confirm = false; clearData(web()); host.note("Böngészési adatok törölve.") }
                                VrgChip("Mégse") { confirm = false }
                            }
                        }
                        VrgSectionTitle("Szabályok")
                        Text("Csak http és https. Az oldal nem kap engedélyt (kamera, mikrofon, hely), és nem éri el az alkalmazást. Hibás tanúsítványú oldal nem nyílik meg. Letöltést a telefon böngészője végez, kérdés után.",
                            style = Melyviz.small.copy(fontSize = 10.sp), modifier = Modifier.padding(bottom = 12.dp))
                    }
                }
                Panel.NONE -> {}
            }
        }
    }

    @Composable
    private fun Line(r: WebRow, count: Int?, open: () -> Unit, remove: (() -> Unit)? = null) {
        Row(Modifier.fillMaxWidth().clickable(onClick = open).padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(r.title.ifEmpty { r.url }, style = Melyviz.label, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(r.url + (if (count != null && count > 1) " · ${count}×" else ""), style = Melyviz.readout.copy(fontSize = 10.sp), maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            if (remove != null) Text("×", style = Melyviz.title.copy(color = Melyviz.muted), modifier = Modifier.clickable(onClick = remove).padding(horizontal = 10.dp, vertical = 4.dp))
        }
    }
}
