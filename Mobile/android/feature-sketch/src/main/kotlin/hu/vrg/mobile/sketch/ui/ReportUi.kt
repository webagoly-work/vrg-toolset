package hu.vrg.mobile.sketch.ui

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Handler
import android.os.Looper
import android.print.PrintAttributes
import android.print.PrintManager
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.files.FileStore
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.ui.VrgToggle
import hu.vrg.mobile.sketch.Capture
import hu.vrg.mobile.sketch.CaptureKind
import hu.vrg.mobile.sketch.Jegyzokonyv
import hu.vrg.mobile.sketch.Norm
import hu.vrg.mobile.sketch.PlanView
import hu.vrg.mobile.sketch.Sketch
import hu.vrg.mobile.sketch.Takeoff
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.math.max
import kotlin.math.roundToInt

// F9 (WP M54, the Founder's D-81 B): the Felmérési jegyzőkönyv from the phone. The document is the Desktop's own
// (Sketcher/lib/report.js, bundled as assets sketcher/report/ by build.gradle.kts): a hidden WebView runs it through
// report-phone.js over the input sketch-core Jegyzokonyv.input puts together, and hands back one self-contained HTML
// (the photos inside as data: URLs). That HTML goes to Android's print dialog (Nyomtatás / PDF) or is shared as
// <név>.jegyzokonyv.html (Átadás). Nothing of it is kept: the files live in the export cache until the next one.

internal object PhoneReport {
    /** The bundled renderer, in load order (= REPORT_ASSETS in build.gradle.kts). */
    private val ASSETS = listOf("fieldkit.js", "report.js", "report-phone.js")

    class Made(val file: File, val bytes: Long, val html: String, val name: String)

    private fun dir(ctx: Context) = File(FileStore.cacheDir(ctx, "sketch"), "report").apply { mkdirs() }

    /** Builds the jegyzőkönyv of [s0] (as the phone has it) under the export rules; [forClient] = *Az ügyfélnek*. */
    suspend fun make(ctx: Context, s0: Sketch, n: Norm, forClient: Boolean): Made {
        val s = Jegyzokonyv.survey(SketchFeaturePrefs.off(ctx), s0)
        val input = withContext(Dispatchers.IO) {
            val out = dir(ctx).apply { listFiles()?.forEach { it.delete() } }      // the last report's copies
            val photos = HashMap<String, String>()
            s.captures.filter { Jegyzokonyv.pictured(it) }.forEach { c ->
                picture(File(SketchFeature.store.photoDir(s.id), c.file), c, out)?.let { photos[c.id] = it }
            }
            val tk = SketcherKit.rules?.let { Takeoff.build(SketcherKit.forSketch(s), it, s, PlanView.of(s, n), impliedDedicated = SketcherKit.impliedDedicated) }?.json
            val catalog = SketcherKit.catalogJson(ctx) ?: error("a field kit hiányzik")
            Jegyzokonyv.input(s, n, tk, catalog, SketcherKit.variantJson(ctx, s), photos, forClient, System.currentTimeMillis()).toString()
        }
        val html = render(ctx, input)
        val name = Jegyzokonyv.fileName(s)
        val f = withContext(Dispatchers.IO) { File(dir(ctx), name).also { it.writeText(html) } }
        return Made(f, f.length(), html, Jegyzokonyv.pdfName(s))
    }

    /**
     * One capture for the report (D-125, D-57): scaled to [Jegyzokonyv.PHOTO_PX], the blur burned in, re-encoded as
     * JPEG 80 (so no EXIF and no GPS goes with it) into the export cache; a signature as a PNG. Null when it cannot be read.
     */
    private fun picture(src: File, c: Capture, out: File): String? {
        if (!src.exists()) return null
        return try {
            if (c.kind == CaptureKind.SIGNATURE) {
                val b = BitmapFactory.decodeFile(src.path) ?: return null
                val bytes = encode(fit(b), Bitmap.CompressFormat.PNG, 100)
                File(out, c.id + "_alairas.png").writeBytes(bytes)
                "data:image/png;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP)
            } else {
                val b = loadPhoto(src, Jegyzokonyv.PHOTO_PX * 2) ?: return null
                val blurred = applyBlur(fit(b), Jegyzokonyv.blurOf(c))
                val bytes = encode(blurred, Bitmap.CompressFormat.JPEG, Jegyzokonyv.JPEG_Q)
                File(out, c.id + ".jpg").writeBytes(bytes)
                "data:image/jpeg;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP)
            }
        } catch (e: Exception) { VrgLog.w("sketch", "Jegyzőkönyv: ${c.id} nem olvasható: ${e.message}"); null }
    }

    private fun fit(b: Bitmap): Bitmap {
        val long = max(b.width, b.height)
        if (long <= Jegyzokonyv.PHOTO_PX) return b
        val k = Jegyzokonyv.PHOTO_PX.toDouble() / long
        return Bitmap.createScaledBitmap(b, max(1, (b.width * k).roundToInt()), max(1, (b.height * k).roundToInt()), true)
    }

    private fun encode(b: Bitmap, f: Bitmap.CompressFormat, q: Int): ByteArray = ByteArrayOutputStream().also { b.compress(f, q, it) }.toByteArray()

    /** The bridge report-phone.js talks to (VRGIn.input / done / fail). */
    private class Bridge(private val input: String, private val onDone: (String) -> Unit, private val onFail: (String) -> Unit) {
        @JavascriptInterface fun input(): String = input
        @JavascriptInterface fun done(html: String) = onDone(html)
        @JavascriptInterface fun fail(msg: String) = onFail(msg)
    }

    /** Runs report-phone.js in a hidden WebView over [input]; returns the document. */
    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    private suspend fun render(ctx: Context, input: String): String {
        val scripts = withContext(Dispatchers.IO) {
            ASSETS.joinToString("\n") { n -> "<script>\n" + ctx.assets.open("sketcher/report/$n").bufferedReader().readText() + "\n</script>" }
        }
        return withContext(Dispatchers.Main) {
            suspendCancellableCoroutine { cont ->
                val main = Handler(Looper.getMainLooper())
                val wv = WebView(ctx)
                val once = AtomicBoolean(false)
                fun finish(block: () -> Unit) { if (once.compareAndSet(false, true)) main.post { try { wv.destroy() } catch (e: Exception) { }; block() } }
                wv.settings.javaScriptEnabled = true
                wv.addJavascriptInterface(Bridge(input,
                    { h -> finish { if (cont.isActive) cont.resume(h) } },
                    { m -> finish { if (cont.isActive) cont.resumeWithException(IllegalStateException(m.lineSequence().firstOrNull() ?: m)) } }), "VRGIn")
                cont.invokeOnCancellation { finish { } }
                wv.loadDataWithBaseURL(null, "<!doctype html><html><head><meta charset=\"utf-8\"></head><body>" + scripts +
                    "<script>VRGReportPhone.run();</script></body></html>", "text/html", "utf-8", null)
            }
        }
    }

    /** Held until the print dialog has taken the document (the adapter reads from this WebView). */
    private var printing: WebView? = null

    /** Android's print dialog on the document: a printer, or *PDF mentése*. A4, as the Desktop's @page. */
    fun print(ctx: Context, m: Made): Boolean {
        val act = ctx.activity() ?: return false
        val wv = WebView(act)
        val started = AtomicBoolean(false)
        wv.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String?) {
                if (!started.compareAndSet(false, true)) return
                val pm = act.getSystemService(Context.PRINT_SERVICE) as PrintManager
                pm.print(m.name, view.createPrintDocumentAdapter(m.name),
                    PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build())
            }
        }
        printing?.destroy()
        printing = wv
        wv.loadDataWithBaseURL(null, m.html, "text/html", "utf-8", null)
        return true
    }

    /** Átadás: the one self-contained file, to the share sheet (PC-re on the Átadás board). */
    fun share(ctx: Context, m: Made) = ctx.startActivity(FileStore.shareIntent(ctx, m.file, "text/html", "Jegyzőkönyv küldése"))

    private tailrec fun Context.activity(): Activity? = this as? Activity ?: (this as? ContextWrapper)?.baseContext?.activity()
}

/** Rendezés → 📄 Jegyzőkönyv: *Az ügyfélnek*, then Nyomtatás / PDF or Átadás (D-128). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun ReportDialog(st: EditorState, onDismiss: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var forClient by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var msg by remember { mutableStateOf<String?>(null) }
    var big by remember { mutableStateOf<PhoneReport.Made?>(null) }
    fun go(act: (PhoneReport.Made) -> Unit) {
        if (busy) return
        busy = true; msg = "Készül a jegyzőkönyv…"; big = null
        scope.launch {
            try {
                val m = PhoneReport.make(ctx, st.sketch, st.norm, forClient)
                msg = m.file.name + " · " + Jegyzokonyv.mb(m.bytes)
                act(m)
            } catch (e: Exception) {
                VrgLog.w("sketch", "Jegyzőkönyv: ${e.message}"); msg = "A jegyzőkönyv nem készült el: ${e.message ?: "ismeretlen hiba"}"
            } finally { busy = false }
        }
    }
    val print: (PhoneReport.Made) -> Unit = { m -> if (!PhoneReport.print(ctx, m)) msg = "A nyomtatás innen nem indítható." }
    val share: (PhoneReport.Made) -> Unit = { m -> if (Jegyzokonyv.tooBig(m.bytes)) big = m else PhoneReport.share(ctx, m) }
    AlertDialog(
        onDismissRequest = onDismiss, containerColor = Melyviz.raised,
        title = { Text("📄 Felmérési jegyzőkönyv", style = Melyviz.label) },
        text = {
            // UI audit 4.1: the body scrolls (landscape, font 1.5 with the "too big" block cut off the two actions)
            Column(Modifier.verticalScroll(rememberScrollState())) {
                Text("Ugyanaz a dokumentum, mint az Asztal Sketcher oldalán: munkakör, tételek, kérdések, jegyzetek, helyiségek, vázlat, fotók, helyszín, aláírás.",
                    style = Melyviz.small)
                VrgToggle("Az ügyfélnek (a Tisztázandó jegyzetek és az Ellenőrizni sorok nélkül)", forClient) { forClient = it }
                Text("A fotók kicsinyítve, GPS nélkül, az elmosás beégetve; személyes adat fotó csak elmosva. Az ügyfél adatai csak akkor, ha „A kiadott csomagban marad”.",
                    style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 4.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 10.dp)) {
                    VrgChip("🖨 Nyomtatás / PDF", selected = true) { go(print) }
                    VrgChip("⇪ Átadás (.html)") { go(share) }
                }
                big?.let { m ->
                    Text("A jegyzőkönyv ${Jegyzokonyv.mb(m.bytes)}: túl nagy az Átadáshoz (15 MB fölött). A PDF jóval kisebb: Nyomtatás / PDF → PDF mentése.",
                        style = Melyviz.small.copy(color = Melyviz.coral), modifier = Modifier.padding(top = 8.dp))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 4.dp)) {
                        VrgChip("🖨 Inkább PDF", selected = true) { big = null; print(m) }
                        VrgChip("Mégis küldöm") { big = null; PhoneReport.share(ctx, m) }
                    }
                }
                msg?.let { Text(it, style = Melyviz.small.copy(color = if (busy) Melyviz.glow else Melyviz.ink), modifier = Modifier.padding(top = 8.dp)) }
            }
        },
        confirmButton = { TextButton(onDismiss) { Text("Bezár", color = Melyviz.muted) } },
    )
}
