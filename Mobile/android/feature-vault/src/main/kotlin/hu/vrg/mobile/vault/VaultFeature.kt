package hu.vrg.mobile.vault

import android.Manifest
import android.annotation.SuppressLint
import android.app.Application
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.Route
import hu.vrg.mobile.core.VaultWeb
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.ui.VrgSectionTitle
import kotlinx.coroutines.flow.MutableStateFlow
import java.io.ByteArrayInputStream
import java.util.concurrent.atomic.AtomicInteger

// Vault (WP M45, D-53 = A, D-54 = A): the Proton Vault's own web app (webagoly-work/data-vault) inside VRG Mobile.
//
// VRG Mobile adds no vault crypto and holds no vault key. The Vault page keeps its own device identity (its P-256 key
// in its own localStorage / IndexedDB, PV-D11) and its own QR approval (PV-D12), separate from Eszközök (M35): being
// approved for VRG Mobile does not open the vault, and the Keystore-backed VRG device key never reaches the page.
//
// The WebView is confined (rules in kit-core VaultWeb, tested there):
// - https only; in-place navigation only inside the Vault's path, any other link opens in the phone's browser;
// - requests only to the Vault's origin and GitHub (API, raw, sign-in), everything else gets an empty 403;
// - JavaScript and DOM storage on (the Vault needs them), file / content access off, no mixed content, no third-party
//   cookies, no geolocation; the camera only for the Vault's own origin and only if the app already holds it;
// - downloads are refused: nothing the Vault decrypts is written to shared storage;
// - FLAG_SECURE while the Vault is on screen: no screenshots, no recents thumbnail, no screen cast (Képernyő included);
// - nothing from the page reaches VrgLog: no console messages, addresses as their origin only (a grant's #fragment stays out).
// The page's storage lives in the app's private data; "A Vault adatai a telefonról" wipes it (a new, unapproved device).

object VaultFeature : VrgFeature {
    override val info = Catalogue.VAULT
    private const val TAG = "vault"
    private const val PREFS = "vault"
    private const val KEY_URL = "url"

    private lateinit var app: Application
    private fun prefs() = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /** The Vault's address (VaultWeb.normalize'd). */
    val address = MutableStateFlow(VaultWeb.DEFAULT_URL)
    /** A link to load in the page next (pasted); null = the address. Never logged. */
    private val pending = MutableStateFlow<String?>(null)
    /** Bumped to reload the page. */
    private val reloads = MutableStateFlow(0)

    override fun init(app: Application) {
        this.app = app
        address.value = VaultWeb.normalize(prefs().getString(KEY_URL, null)) ?: VaultWeb.DEFAULT_URL
    }

    /** vrg://vault opens the page; vrg://vault?open=<link inside the Vault> loads that link (e.g. the Vault's own grant). */
    override fun open(route: Route): Boolean {
        val link = route.params["open"] ?: return true
        val ok = VaultWeb.openable(address.value, link) ?: return false
        pending.value = ok
        reloads.value++
        return true
    }

    private fun setAddress(url: String): Boolean {
        val n = VaultWeb.normalize(url) ?: return false
        prefs().edit().putString(KEY_URL, n).apply()
        address.value = n
        pending.value = null
        reloads.value++
        VrgLog.i(TAG, "cím: ${VaultWeb.forLog(n)}")
        return true
    }

    /**
     * Wipes the Vault page's storage in this app, its device key with it: the page script clears localStorage,
     * IndexedDB, caches and the service worker (WebStorage alone does not reach all of them), then [done].
     */
    private fun wipe(web: WebView?, done: () -> Unit) {
        val origin = VaultWeb.origin(address.value) ?: return done()
        val finish = {
            WebStorage.getInstance().deleteOrigin(origin)
            web?.clearCache(true)
            VrgLog.i(TAG, "a Vault adatai törölve: ${VaultWeb.forLog(origin)}")
            done()
        }
        if (web == null || !VaultWeb.inVault(address.value, web.url)) return finish()
        web.evaluateJavascript(
            """(async function(){try{localStorage.clear();sessionStorage.clear();}catch(e){}
              try{for(const d of await indexedDB.databases()){indexedDB.deleteDatabase(d.name)}}catch(e){}
              try{for(const k of await caches.keys()){await caches.delete(k)}}catch(e){}
              try{for(const r of await navigator.serviceWorker.getRegistrations()){await r.unregister()}}catch(e){}
              return 1})()""",
        ) { web.postDelayed({ finish() }, 800) }   // the callback does not await the promise: give the deletes a moment
    }

    // ---- the WebView -------------------------------------------------------------------------------------------

    private fun refuse() = WebResourceResponse("text/plain", "utf-8", 403, "Forbidden",
        mapOf("Cache-Control" to "no-store"), ByteArrayInputStream(ByteArray(0)))

    private val pickers = AtomicInteger()

    /** <input type=file> (an import into the Vault): the phone's document picker. Reading only; nothing is written out. */
    private fun pick(host: FeatureHost, cb: ValueCallback<Array<Uri>>, params: WebChromeClient.FileChooserParams): Boolean {
        val types = params.acceptTypes.orEmpty().flatMap { it.split(',') }.map { it.trim() }.filter { it.contains('/') }.ifEmpty { listOf("*/*") }
        val key = "vrg-vault-file-" + pickers.incrementAndGet()
        var launcher: androidx.activity.result.ActivityResultLauncher<Array<String>>? = null
        launcher = host.activity.activityResultRegistry.register(key, ActivityResultContracts.OpenMultipleDocuments()) { uris ->
            cb.onReceiveValue(if (params.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) uris.toTypedArray() else uris.take(1).toTypedArray())
            launcher?.unregister()
        }
        return try { launcher.launch(types.toTypedArray()); true } catch (e: Exception) { launcher.unregister(); cb.onReceiveValue(null); false }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun makeWebView(ctx: Context, host: FeatureHost, onProblem: (String) -> Unit, onLoading: (Boolean) -> Unit): WebView = WebView(ctx).apply {
        layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.setGeolocationEnabled(false)
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.javaScriptCanOpenWindowsAutomatically = false
        settings.setSupportMultipleWindows(false)
        settings.mediaPlaybackRequiresUserGesture = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)
        setDownloadListener { _, _, _, _, _ -> host.note("A Vault letöltéseit a VRG Mobile nem menti a telefon közös tárhelyére.") }
        webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                if (VaultWeb.mayLoad(address.value, request.url.toString())) null else refuse()

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url
                if (VaultWeb.inVault(address.value, u.toString())) return false
                if (request.isForMainFrame && (u.scheme == "https" || u.scheme == "mailto"))
                    runCatching { view.context.startActivity(Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
                return true
            }

            // a loading line while the page comes, and a plain reason when it cannot (offline, the Vault host down)
            override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) { onLoading(true) }

            override fun onPageFinished(view: WebView, url: String?) { onLoading(false) }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) onProblem("A Vault nem érhető el (nincs internet?).")
            }

            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
                if (request.isForMainFrame) onProblem("A Vault nem érhető el (HTTP ${response.statusCode}).")
            }

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                VrgLog.w(TAG, "a Vault megjelenítője leállt (crash: ${detail.didCrash()})")
                onProblem("A megjelenítő leállt. Nyisd meg újra.")
                view.destroy()
                return true
            }
        }
        webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(view: WebView, cb: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean = pick(host, cb, params)

            // the Vault's own QR scanner (a request or grant read in the page): the camera, for its origin only
            override fun onPermissionRequest(request: PermissionRequest) {
                val mine = VaultWeb.sameOrigin(address.value, request.origin.toString())
                val video = request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
                val held = ContextCompat.checkSelfPermission(ctx, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                if (mine && video && held) request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
                else {
                    request.deny()
                    if (mine && video) host.note("Kamera engedély kell: nyisd meg egyszer a QR beolvasást.")
                }
            }

            // the page's console may hold vault content: nothing of it is logged
            override fun onConsoleMessage(m: ConsoleMessage): Boolean = true
        }
    }

    // ---- the screen ----------------------------------------------------------------------------------------------

    @Composable
    override fun Screen(host: FeatureHost) {
        val url by address.collectAsStateWithLifecycle()
        val reload by reloads.collectAsStateWithLifecycle()
        var tools by remember { mutableStateOf(false) }
        var problem by remember { mutableStateOf<String?>(null) }
        var loading by remember { mutableStateOf(false) }
        val web = remember { arrayOfNulls<WebView>(1) }

        // no screenshots, recents thumbnail or screen cast of the Vault; undone when it leaves
        DisposableEffect(Unit) {
            host.activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
            onDispose { host.activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE) }
        }
        val reloadPage = { problem = null; pending.value = null; reloads.value++; Unit }
        LaunchedEffect(url, reload) { problem = null }   // a new load starts without the last one's reason
        BackHandler {
            val w = web[0]
            when {
                tools -> tools = false
                w != null && w.canGoBack() -> w.goBack()
                else -> host.home()
            }
        }

        Column(Modifier.fillMaxSize()) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 2.dp), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("‹", style = Melyviz.title.copy(fontSize = 22.sp, color = Melyviz.current),
                    modifier = Modifier.minimumInteractiveComponentSize().clickable(onClickLabel = "Vissza") { host.home() }
                        .semantics { contentDescription = "Vissza" }.padding(horizontal = 4.dp))
                Text("VAULT", style = Melyviz.title.copy(fontSize = 13.sp), modifier = Modifier.weight(1f))
                IconChip("⟳", "Újratöltés") { reloadPage() }
                IconChip("⚙", "Beállítások", selected = tools) { tools = !tools }
            }
            if (loading && problem == null && !tools) Text("Betöltés…", style = Melyviz.small, modifier = Modifier.padding(horizontal = 12.dp))
            problem?.let {
                Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(it, style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.weight(1f))
                    VrgChip("⟳ Újra") { reloadPage() }
                }
            }
            // the WebView stays composed under the tools, so the wipe can run in the page
            Box(Modifier.fillMaxWidth().weight(1f)) {
                AndroidView(
                    factory = { ctx -> makeWebView(ctx, host, onProblem = { problem = it }, onLoading = { loading = it }) },
                    modifier = Modifier.fillMaxSize(),
                    update = { wv ->
                        web[0] = wv
                        wv.visibility = if (tools) View.INVISIBLE else View.VISIBLE   // touches go to the tools, the page stays alive
                        val want = "$url#$reload"
                        if (wv.tag != want) {
                            wv.tag = want
                            val go = pending.value?.let { VaultWeb.openable(url, it) } ?: url
                            pending.value = null
                            wv.loadUrl(go)
                        }
                    },
                    onRelease = { wv -> if (web[0] === wv) web[0] = null; wv.destroy() },
                )
                if (tools) Box(Modifier.fillMaxSize().background(Melyviz.deep)) { Tools(host, url, { web[0] }) { tools = false } }
            }
        }
    }

    @Composable
    private fun Tools(host: FeatureHost, url: String, web: () -> WebView?, close: () -> Unit) {
        var edit by remember(url) { mutableStateOf(url) }
        var link by remember { mutableStateOf("") }
        var confirm by remember { mutableStateOf(false) }
        // each section's result shows under its own row, not at the bottom of the panel
        var addrNote by remember { mutableStateOf<String?>(null) }
        var linkNote by remember { mutableStateOf<String?>(null) }
        val colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Melyviz.glow, unfocusedBorderColor = Melyviz.line,
            focusedTextColor = Melyviz.ink, unfocusedTextColor = Melyviz.ink, cursorColor = Melyviz.glow,
        )
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
            Text("A Vault saját oldala nyílik meg itt, a saját titkosításával. A VRG Mobile nem lát bele és nem tárol belőle semmit a közös tárhelyen.", style = Melyviz.small)
            Text("A Vault külön jóváhagyást kér: ez a telefon a Vaultban is QR-kóddal kér hozzáférést, akkor is, ha az Eszközökben már jóvá van hagyva.",
                style = Melyviz.small, modifier = Modifier.padding(top = 6.dp))

            VrgSectionTitle("A Vault címe")
            OutlinedTextField(edit, { edit = it.take(300) }, Modifier.fillMaxWidth(), singleLine = true,
                label = { Text("https://…", style = Melyviz.small) }, colors = colors)
            Row(Modifier.padding(vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (edit.trim() != url) VrgChip("Mentés", true) {
                    addrNote = if (setAddress(edit)) { close(); null } else "Csak https:// cím lehet, felhasználónév nélkül."
                }
                if (url != VaultWeb.DEFAULT_URL) VrgChip("Alapérték") { setAddress(VaultWeb.DEFAULT_URL); edit = VaultWeb.DEFAULT_URL }
            }
            addrNote?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand)) }
            Text("Másik cím másik eszközt jelent a Vault szemében: ott újra jóvá kell hagyni.", style = Melyviz.small.copy(fontSize = 10.sp))

            VrgSectionTitle("Vault-link megnyitása")
            Text("Egy Vault-link (például a Vault engedélye üzenetben) itt, a VRG Mobile-ban nyílik meg, nem a böngészőben.", style = Melyviz.small)
            OutlinedTextField(link, { link = it.take(4000) }, Modifier.fillMaxWidth().padding(top = 6.dp), singleLine = true,
                label = { Text("Link beillesztése", style = Melyviz.small) }, colors = colors)
            Row(Modifier.padding(vertical = 6.dp)) {
                VrgChip("Megnyitás", link.isNotBlank()) {
                    val ok = VaultWeb.openable(url, VaultWeb.findLink(link))
                    if (ok == null) linkNote = "Ez nem a Vault címén lévő link."
                    else { pending.value = ok; reloads.value++; link = ""; close() }
                }
            }
            linkNote?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand)) }

            VrgSectionTitle("A Vault adatai a telefonról")
            Text("Törli a Vault oldalának adatait ebben az alkalmazásban, az eszközkulcsával együtt. Utána ez a telefon új, jóvá nem hagyott eszköz a Vaultban.",
                style = Melyviz.small)
            // the destructive confirm is not drawn as the default (selected) chip, and sits apart from Mégse
            Row(Modifier.padding(vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                if (!confirm) VrgChip("Törlés…") { confirm = true }
                else {
                    VrgChip("Igen, törlés") {
                        confirm = false
                        wipe(web()) { pending.value = null; reloads.value++; host.note("A Vault adatai törölve erről a telefonról."); close() }
                    }
                    VrgChip("Mégse") { confirm = false }
                }
            }
        }
    }

    /** A glyph-only chip (⟳, ⚙): TalkBack reads [label], and the touch area is at least 48 dp. */
    @Composable
    private fun IconChip(glyph: String, label: String, selected: Boolean = false, action: () -> Unit) {
        Box(Modifier.minimumInteractiveComponentSize().clearAndSetSemantics {
            contentDescription = label; role = Role.Button; this.selected = selected
            onClick { action(); true }
        }, contentAlignment = Alignment.Center) { VrgChip(glyph, selected = selected, onClick = action) }
    }
}
