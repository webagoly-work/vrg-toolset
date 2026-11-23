package hu.vrg.mobile.sketch.ui

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.files.FileStore
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.sketch.RoomBox
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File
import kotlin.math.max
import kotlin.math.roundToInt

// Szobadoboz on the phone (dev line skcam, stage K1b, WP M59): the room in 3D with its Fotópont photos. The box is
// the Desktop's (Sketcher/lib/roombox.js + roombox-gl.js, WP M57) with lib/roombox-phone.js as its touch UI, bundled
// as assets sketcher/roombox/ (build.gradle.kts, ROOMBOX_ASSETS) and run in a WebView, as the jegyzőkönyv runs
// report.js (M54). The phone hands over sketch-core RoomBox.input (the plan in mm, the corrections, the level, the
// photos as data: URLs); ✓ Kész hands back the corrections, which go into the survey's `box` key (one undo step).
// Nothing leaves the phone: the photos are scaled copies in memory, only for this view.

internal object RoomBoxPhone {
    /** The bundled files, in load order (= ROOMBOX_ASSETS in build.gradle.kts; Sketcher/test/roombox-phone.test.js checks both). */
    val ASSETS = listOf("roombox.js", "roombox-gl.js", "pano.js", "roombox-phone.js")

    /** The page: the three files inlined (no file access needed), then run(), which reads the bridge. */
    suspend fun page(ctx: android.content.Context): String = withContext(Dispatchers.IO) {
        "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,maximum-scale=1\"></head><body>" +
            ASSETS.joinToString("\n") { n -> "<script>\n" + ctx.assets.open("sketcher/roombox/$n").bufferedReader().readText() + "\n</script>" } +
            "<script>VRGRoomBoxPhone.run();</script></body></html>"
    }

    /** The input: the solved plan and the photos, scaled to [RoomBox.PHOTO_PX] and re-encoded, under their board names. */
    suspend fun input(st: EditorState): String = withContext(Dispatchers.IO) {
        val dir = st.photoDir
        val images = HashMap<String, String>()
        if (dir != null) RoomBox.photoFiles(st.sketch).forEach { (file, board) ->
            val b = loadPhoto(File(dir, file), RoomBox.PHOTO_PX * 2) ?: return@forEach
            val out = ByteArrayOutputStream()
            fit(b).compress(Bitmap.CompressFormat.JPEG, RoomBox.JPEG_Q, out)
            images[board] = "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        }
        RoomBox.input(st.sketch, st.norm, images, pano = FeaturePrefs.on("vazlat.pano")).toString()
    }

    private fun fit(b: Bitmap): Bitmap {
        val long = max(b.width, b.height)
        if (long <= RoomBox.PHOTO_PX) return b
        val k = RoomBox.PHOTO_PX.toDouble() / long
        return Bitmap.createScaledBitmap(b, max(1, (b.width * k).roundToInt()), max(1, (b.height * k).roundToInt()), true)
    }

    /** What roombox-phone.js talks to (VRGBox.input / save / close / fail); the answers come back on the main thread. */
    class Bridge(private val input: String, private val onSave: (String) -> Unit, private val onClose: () -> Unit, private val onFail: (String) -> Unit,
                 private val onPano: (String, ByteArray) -> Unit = { _, _ -> }) {
        private val main = Handler(Looper.getMainLooper())
        @JavascriptInterface fun input(): String = input
        /** skcam K4: a 360° image (equirectangular JPEG with its GPano XMP) to keep. */
        @JavascriptInterface fun pano(name: String, b64: String) {
            val bytes = runCatching { Base64.decode(b64, Base64.DEFAULT) }.getOrNull() ?: return
            main.post { onPano(name, bytes) }
        }
        @JavascriptInterface fun save(json: String) { main.post { onSave(json) } }
        @JavascriptInterface fun close() { main.post { onClose() } }
        @JavascriptInterface fun fail(msg: String) { main.post { onFail(msg) } }
    }
}

/** Rendezés → ⬚ Szobadoboz: the 3D view over the whole screen; ✓ Kész saves the corrections, ✕ or Back leaves. */
@SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
@Composable
internal fun RoomBoxDialog(st: EditorState, onDismiss: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var page by remember { mutableStateOf<Pair<String, String>?>(null) }      // the page and its input
    var err by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        try { page = RoomBoxPhone.page(ctx) to RoomBoxPhone.input(st) }
        catch (e: Exception) { VrgLog.w("sketch", "Szobadoboz: ${e.message}"); err = "A Szobadoboz nem nyílt meg: ${e.message ?: "ismeretlen hiba"}" }
    }
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(Modifier.fillMaxSize().background(Melyviz.abyss)) {
            val p = page
            when {
                err != null -> Text(err!!, style = Melyviz.small.copy(color = Melyviz.coral), modifier = Modifier.align(Alignment.Center).padding(24.dp))
                p == null -> Text("Készül a Szobadoboz…", style = Melyviz.small.copy(color = Melyviz.glow), modifier = Modifier.align(Alignment.Center))
                else -> AndroidView(modifier = Modifier.fillMaxSize(), factory = { c ->
                    WebView(c).apply {
                        // MATCH_PARENT, as in MapFeature.makeWebView: with WRAP_CONTENT a page sized by 100% / vh is 0 px tall
                        layoutParams = android.view.ViewGroup.LayoutParams(android.view.ViewGroup.LayoutParams.MATCH_PARENT, android.view.ViewGroup.LayoutParams.MATCH_PARENT)
                        settings.javaScriptEnabled = true
                        addJavascriptInterface(RoomBoxPhone.Bridge(p.second,
                            onSave = { json ->
                                val next = RoomBox.save(st.sketch, json)
                                if (next != st.sketch) { st.edit(next); st.note = "Szobadoboz: a javítások mentve." }
                                onDismiss()
                            },
                            onClose = onDismiss,
                            onFail = { m -> VrgLog.w("sketch", "Szobadoboz: $m"); err = "A Szobadoboz hibára futott: " + (m.lineSequence().firstOrNull() ?: m) },
                            onPano = { name, bytes -> scope.launch {
                                // skcam K4: the 360° image into Képek / VRG Vázlat, as the sketch's photos are saved
                                val f = withContext(Dispatchers.IO) { File(FileStore.cacheDir(c, "sketch"), name.replace(Regex("[^\\w.-]+"), "-")).also { it.writeBytes(bytes) } }
                                val at = FileStore.saveShared(c, f, f.name, "image/jpeg", "VRG Vázlat")
                                st.note = if (at != null) "360° kép mentve: $at" else "A 360° kép mentése nem sikerült."
                            } }), "VRGBox")
                        loadDataWithBaseURL(null, p.first, "text/html", "utf-8", null)
                    }
                }, onRelease = { it.destroy() })
            }
        }
    }
}
