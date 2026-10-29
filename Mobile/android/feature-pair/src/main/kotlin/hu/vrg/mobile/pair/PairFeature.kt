package hu.vrg.mobile.pair

import android.Manifest
import android.app.Application
import android.content.pm.PackageManager
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
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.PairOffer
import hu.vrg.mobile.core.Route
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.relay.LinkState
import hu.vrg.mobile.kit.relay.PairResult
import hu.vrg.mobile.kit.relay.Relay
import hu.vrg.mobile.kit.relay.Trust
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.ui.VrgSectionTitle
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import java.util.concurrent.Executors

// QR párosítás (WP M2): read the QR on the PC's screen (http://localhost:47291/pair) and become a
// trusted phone. The scan can come from here (CameraX + ML Kit, bundled model) or from the phone's
// own camera app, which opens the vrg://pair link and the shell routes it to open(). Either way the
// offer goes to the shared link (Relay.pair), which connects, sends the code and the Keystore key,
// and stores the PC in Beállítások → Párosított PC-k.

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
        val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted = it }
        var foreign by remember { mutableStateOf<String?>(null) }

        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
            Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current),
                modifier = Modifier.clickable { host.home() }.padding(vertical = 8.dp))
            Text("QR PÁROSÍTÁS", style = Melyviz.title.copy(fontSize = 18.sp))
            Text("A PC-n: START.cmd → G (relé), majd böngészőben http://localhost:47291/pair", style = Melyviz.small)
            Spacer(Modifier.height(12.dp))

            when (val ph = p) {
                Phase.Scanning -> {
                    if (granted) {
                        Scanner(Modifier.fillMaxWidth().aspectRatio(1f)) { raw ->
                            val offer = PairOffer.parse(raw)
                            if (offer != null) start(offer) else foreign = raw.take(80)
                        }
                        foreign?.let { Text("Ez nem VRG párosító kód: $it", style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 6.dp)) }
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
                    Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
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
            Modifier.fillMaxWidth().clip(shape).background(Melyviz.raised).border(1.dp, Melyviz.glowDim, shape).padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) { content() }
    }

    /** The camera preview with a QR reader on its frames. [onCode] gets each distinct QR text once. */
    @Composable
    private fun Scanner(modifier: Modifier, onCode: (String) -> Unit) {
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
                }
            }, ContextCompat.getMainExecutor(ctx))
            onDispose {
                runCatching { futureProvider.get().unbindAll() }
                scanner.close()
                executor.shutdown()
            }
        }

        Box(modifier.clip(shape).border(2.dp, Melyviz.glow, shape), contentAlignment = Alignment.Center) {
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
