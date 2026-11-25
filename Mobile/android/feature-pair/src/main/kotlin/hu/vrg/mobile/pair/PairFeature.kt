package hu.vrg.mobile.pair

import android.Manifest
import android.app.Application
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.browser.customtabs.CustomTabsIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.PairOffer
import hu.vrg.mobile.core.Route
import hu.vrg.mobile.core.ScanCode
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.relay.LinkState
import hu.vrg.mobile.kit.relay.PairResult
import hu.vrg.mobile.kit.relay.Relay
import hu.vrg.mobile.kit.relay.Trust
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgBack
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.ui.VrgSectionTitle
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import java.util.concurrent.Executors
import hu.vrg.mobile.kit.ScannedLinks
import hu.vrg.mobile.kit.theme.vrgBorder

// QR párosítás (WP M2): read the QR on the PC's screen (http://localhost:47291/pair) and become a
// trusted phone. The scan can come from here (CameraX + ML Kit, bundled model) or from the phone's
// own camera app, which opens the vrg://pair link and the shell routes it to open(). Either way the
// offer goes to the shared link (Relay.pair), which connects, sends the code and the Keystore key,
// and stores the PC in Beállítások → Párosított PC-k.
// 2026-11-14: the home screen's "QR beolvasása" button opens this scanner too, and it reads more than the pairing QR
// (core/ScanCode.kt): a server QR from the VRG Asztal's 📱 Telefon panel opens that PC server at once in a Custom Tab,
// a vrg:// link goes back through the shell, any other LAN page is offered, anything else is only shown.

object PairFeature : VrgFeature {
    override val info = Catalogue.PAIR

    sealed interface Phase {
        data object Scanning : Phase
        data class Pairing(val offer: PairOffer) : Phase
        data class Done(val result: PairResult) : Phase
    }

    val phase = MutableStateFlow<Phase>(Phase.Scanning)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    override fun init(app: Application) {
        scope.launch { Relay.pairResults.collect { phase.value = Phase.Done(it) } }
    }

    /** vrg://pair?ws=…&c=…&n=… from the system camera, a browser or another app. */
    override fun open(route: Route): Boolean {
        val offer = PairOffer.from(route) ?: return route.params.isEmpty()
        start(offer)
        return true
    }

    private fun start(offer: PairOffer) {
        if ((phase.value as? Phase.Pairing)?.offer == offer) return
        phase.value = Phase.Pairing(offer)
        Relay.pair(offer)
    }

    /** The home screen's "QR beolvasása" button: always opens on a live scanner, whatever the last result was. */
    fun scan() { phase.value = Phase.Scanning }

    /** A server QR from the VRG Asztal's 📱 Telefon panel: that one PC server in a Custom Tab (the relay's /p/<port>/). */
    private fun openServer(ctx: Context, c: ScanCode.Server, host: FeatureHost) {
        try { CustomTabsIntent.Builder().build().launchUrl(ctx, Uri.parse(c.url)); host.note("PC :${c.port} megnyitva") }
        catch (e: Exception) { host.note("Nincs böngésző a megnyitáshoz") }
    }

    /** A link the app itself answers (vrg://…, the Planner's phone-sender QR): back through the shell's link routing. */
    private fun openLink(ctx: Context, raw: String) {
        ScannedLinks.mark(raw)   // so Eszközök knows a device request came from this scanner, not from a messenger
        runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(raw)).setPackage(ctx.packageName).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)) }
    }

    @OptIn(ExperimentalLayoutApi::class)
    @Composable
    override fun Screen(host: FeatureHost) {
        val ctx = LocalContext.current
        val p by phase.collectAsStateWithLifecycle()
        val link by Relay.state.collectAsStateWithLifecycle()
        val trust by Relay.trust.collectAsStateWithLifecycle()
        val pc by Relay.pc.collectAsStateWithLifecycle()
        var granted by remember {
            mutableStateOf(ContextCompat.checkSelfPermission(ctx, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED)
        }
        // "Don't ask again": the request answers false at once, so the button looked dead; then Android's app settings
        // are offered instead (UI audit 5.5). Coming back from there re-reads the permission.
        var denied by remember { mutableStateOf(false) }
        val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
            granted = ok
            denied = !ok && !ActivityCompat.shouldShowRequestPermissionRationale(host.activity, Manifest.permission.CAMERA)
        }
        LifecycleResumeEffect(Unit) {
            granted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
            onPauseOrDispose { }
        }
        var foreign by remember { mutableStateOf<String?>(null) }
        var lan by remember { mutableStateOf<ScanCode.Lan?>(null) }
        var last by remember { mutableStateOf<String?>(null) }
        // a camera that would not start (busy, missing) was only logged: the user saw a black square (UI audit 5.5)
        var camError by remember { mutableStateOf<String?>(null) }
        var camTry by remember { mutableIntStateOf(0) }
        // lying down a full-width square preview put the results ~670 dp down a 336 dp screen: at most ~55 % of the
        // height (in the app's own dp, so the UI size setting is included), and the results above it (UI audit 4.5, 6.6)
        val screenPx = LocalConfiguration.current.screenHeightDp * ctx.resources.displayMetrics.density
        val previewMax = with(LocalDensity.current) { screenPx.toDp() } * 0.55f

        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
            VrgBack { host.home() }
            Text("QR OLVASÓ", style = Melyviz.title.copy(fontSize = 18.sp))
            Text("A PC-n: VRG Asztal → Telefon (rádiók, minden szerver, QR szerverenként), vagy http://localhost:47291/pair", style = Melyviz.small)
            Spacer(Modifier.height(12.dp))

            when (val ph = p) {
                Phase.Scanning -> {
                    if (granted) {
                        last?.let { Text("✓ Megnyitva: $it", style = Melyviz.small.copy(color = Melyviz.kelp), modifier = Modifier.padding(bottom = 6.dp)) }
                        lan?.let { l ->
                            Text("Helyi hálózati oldal: ${l.url.take(80)}", style = Melyviz.small)
                            Row(Modifier.padding(top = 4.dp, bottom = 6.dp)) {
                                VrgChip("Megnyitás böngészőben", true) {
                                    runCatching { CustomTabsIntent.Builder().build().launchUrl(ctx, Uri.parse(l.url)) }
                                    lan = null
                                }
                            }
                        }
                        foreign?.let { Text("Ez nem VRG kód: $it", style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(bottom = 6.dp)) }
                        val err = camError
                        if (err != null) {
                            Text("A kamera nem indult: $err", style = Melyviz.small.copy(color = Melyviz.coral))
                            Row(Modifier.padding(top = 8.dp)) { VrgChip("Újra", true) { camError = null; camTry++ } }
                        } else key(camTry) {
                            // one scanner for everything the PC shows: the pairing QR, a server QR (opens at once), a VRG link
                            Scanner(Modifier.align(Alignment.CenterHorizontally).widthIn(max = previewMax).fillMaxWidth().aspectRatio(1f),
                                onError = { camError = it }) { raw ->
                                foreign = null; lan = null
                                when (val c = ScanCode.classify(raw)) {
                                    is ScanCode.PairLink -> start(c.offer)
                                    is ScanCode.Server -> { last = "PC szerver :${c.port}  ·  ${c.host}"; openServer(ctx, c, host) }
                                    is ScanCode.Open -> openLink(ctx, raw)
                                    is ScanCode.Lan -> lan = c
                                    is ScanCode.Other -> foreign = c.text.take(80)
                                }
                            }
                        }
                    } else if (denied) {
                        Text("A kamera engedélyét a telefon Beállításaiban lehet megadni (Engedélyek → Kamera).", style = Melyviz.small)
                        Row(Modifier.padding(top = 8.dp)) {
                            VrgChip("Beállítások megnyitása", true) {
                                runCatching {
                                    ctx.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", ctx.packageName, null))
                                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                                }
                            }
                        }
                    } else {
                        Text("A QR beolvasásához kamera engedély kell. A kép a telefonon marad, semmi nem kerül mentésre.", style = Melyviz.small)
                        Row(Modifier.padding(top = 8.dp)) { VrgChip("Kamera engedélyezése", true) { ask.launch(Manifest.permission.CAMERA) } }
                    }
                    Text("A telefon saját kamerájával is mehet: a vrg://pair linket ez az alkalmazás nyitja meg.",
                        style = Melyviz.small, modifier = Modifier.padding(top = 10.dp))
                }
                is Phase.Pairing -> {
                    Card {
                        Text("Párosítás…", style = Melyviz.title)
                        Text(ph.offer.pcName.ifBlank { "PC" } + "  ·  " + ph.offer.ws, style = Melyviz.readout)
                        Text(if (link == LinkState.OPEN) "Kód elküldve, várom a PC-t." else "Kapcsolódás a reléhez…", style = Melyviz.small)
                    }
                }
                is Phase.Done -> {
                    val r = ph.result
                    Card {
                        Text(if (r.ok) "✓ Párosítva" else "Nem sikerült", style = Melyviz.title.copy(color = if (r.ok) Melyviz.kelp else Melyviz.coral))
                        Text(r.pcName.orEmpty().ifBlank { "PC" }, style = Melyviz.label)
                        Text(if (r.ok) "Megbízható telefon: a képernyőkép és a későbbi PC-funkciók elérhetők." else r.reason ?: "Ismeretlen hiba.",
                            style = Melyviz.small)
                    }
                    FlowRow(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        if (r.ok) VrgChip("Légegér ›", true) { host.open(Catalogue.AIRDECK.id) }
                        VrgChip(if (r.ok) "Másik PC" else "Újra") { foreign = null; phase.value = Phase.Scanning }
                        VrgChip("Párosított PC-k ›") { host.open(Catalogue.SETTINGS.id) }
                    }
                }
            }

            VrgSectionTitle("Most")
            Text(
                when (link) {
                    LinkState.OFF -> "Nincs relé beállítva."
                    LinkState.CONNECTING -> "Kapcsolódás: ${Relay.url}"
                    LinkState.OPEN -> "Vonalban: ${pc?.name ?: Relay.url}  ·  " + when (trust) {
                        Trust.TRUSTED -> "megbízható ✓"
                        Trust.CHECKING -> "ellenőrzés…"
                        Trust.REFUSED -> "a PC törölte a párosítást"
                        Trust.NONE -> "nincs párosítva"
                    }
                },
                style = Melyviz.readout,
            )
        }
    }

    @Composable
    private fun Card(content: @Composable () -> Unit) {
        val shape = RoundedCornerShape(Melyviz.radius)
        Column(
            Modifier.fillMaxWidth().clip(shape).background(Melyviz.raised).vrgBorder(1.dp, Melyviz.glowDim, shape).padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) { content() }
    }

    /** The camera preview with a QR reader on its frames. [onCode] gets each distinct QR text once. */
    @Composable
    private fun Scanner(modifier: Modifier, onError: (String) -> Unit, onCode: (String) -> Unit) {
        val ctx = LocalContext.current
        val owner = LocalLifecycleOwner.current
        val view = remember { PreviewView(ctx).apply { scaleType = PreviewView.ScaleType.FILL_CENTER } }
        val shape = RoundedCornerShape(Melyviz.radius)

        DisposableEffect(owner) {
            val executor = Executors.newSingleThreadExecutor()
            val scanner = BarcodeScanning.getClient(BarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).build())
            var last: String? = null
            val futureProvider = ProcessCameraProvider.getInstance(ctx)
            futureProvider.addListener({
                val provider = futureProvider.get()
                val preview = Preview.Builder().build().also { it.setSurfaceProvider(view.surfaceProvider) }
                val analysis = ImageAnalysis.Builder().setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build()
                analysis.setAnalyzer(executor) { img -> read(img, scanner) { text ->
                    if (text != last) { last = text; ContextCompat.getMainExecutor(ctx).execute { onCode(text) } }
                } }
                try {
                    provider.unbindAll()
                    provider.bindToLifecycle(owner, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis)
                } catch (e: Exception) {
                    VrgLog.w(info.id, "Kamera hiba: ${e.message}")
                    onError(e.message ?: e.javaClass.simpleName)   // this listener runs on the main thread
                }
            }, ContextCompat.getMainExecutor(ctx))
            onDispose {
                runCatching { futureProvider.get().unbindAll() }
                scanner.close()
                executor.shutdown()
            }
        }

        Box(modifier.clip(shape).vrgBorder(2.dp, Melyviz.glow, shape), contentAlignment = Alignment.Center) {
            AndroidView({ view }, Modifier.fillMaxSize())
        }
    }

    @androidx.annotation.OptIn(ExperimentalGetImage::class)
    private fun read(img: ImageProxy, scanner: com.google.mlkit.vision.barcode.BarcodeScanner, onText: (String) -> Unit) {
        val media = img.image ?: run { img.close(); return }
        scanner.process(InputImage.fromMediaImage(media, img.imageInfo.rotationDegrees))
            .addOnSuccessListener { codes -> codes.firstNotNullOfOrNull { it.rawValue }?.let(onText) }
            .addOnCompleteListener { img.close() }
    }
}
