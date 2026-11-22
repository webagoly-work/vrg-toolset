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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.sketch.Planes
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import kotlin.math.max
import kotlin.math.roundToInt

// Síkmérés on the phone (dev line skcam, stage K3, WP M60): measuring on a plane in one photo. The screen is the
// Desktop's (Sketcher/lib/plane.js + plane-ui.js), bundled as assets sketcher/plane/ (build.gradle.kts, PLANE_ASSETS)
// and run in a WebView, as the Szobadoboz runs (M59). The phone hands over the photo (an upright copy, at most
// Planes.PHOTO_PX, in memory only), the title and the stored record; ✓ Mentés hands back the record, which goes into
// the survey's `planes` key (one undo step). Nothing leaves the phone.

internal object PlanePhone {
    /** The bundled files, in load order (= PLANE_ASSETS in build.gradle.kts; Sketcher/test/plane.test.js checks both). */
    val ASSETS = listOf("plane.js", "plane-ui.js")

    suspend fun page(ctx: android.content.Context): String = withContext(Dispatchers.IO) {
        "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,maximum-scale=1\"></head><body style=\"margin:0;background:#0a141c\">" +
            ASSETS.joinToString("\n") { n -> "<script>\n" + ctx.assets.open("sketcher/plane/$n").bufferedReader().readText() + "\n</script>" } +
            "<script>VRGPlaneUI.run();</script></body></html>"
    }

    /** The input: the photo as a data: URL (upright, scaled), the title and the stored record of [key]. */
    suspend fun input(st: EditorState, key: String, file: String, title: String): String = withContext(Dispatchers.IO) {
        val dir = st.photoDir ?: error("nincs fotómappa")
        val b = loadPhoto(File(dir, file), Planes.PHOTO_PX * 2) ?: error("a fotó nem olvasható")
        val out = ByteArrayOutputStream()
        fit(b).compress(Bitmap.CompressFormat.JPEG, Planes.JPEG_Q, out)
        JSONObject()
            .put("image", "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP))
            .put("title", title)
            .put("record", Planes.of(st.sketch, key) ?: JSONObject.NULL)
            .toString()
    }

    private fun fit(b: Bitmap): Bitmap {
        val long = max(b.width, b.height)
        if (long <= Planes.PHOTO_PX) return b
        val k = Planes.PHOTO_PX.toDouble() / long
        return Bitmap.createScaledBitmap(b, max(1, (b.width * k).roundToInt()), max(1, (b.height * k).roundToInt()), true)
    }

    /** What plane-ui.js run() talks to (VRGPlaneIO.input / save / close / fail); the answers come back on the main thread. */
    class Bridge(private val input: String, private val onSave: (String) -> Unit, private val onClose: () -> Unit, private val onFail: (String) -> Unit) {
        private val main = Handler(Looper.getMainLooper())
        @JavascriptInterface fun input(): String = input
        @JavascriptInterface fun save(json: String) { main.post { onSave(json) } }
        @JavascriptInterface fun close() { main.post { onClose() } }
        @JavascriptInterface fun fail(msg: String) { main.post { onFail(msg) } }
    }
}

/** 📏 Mérés: the Síkmérés over the whole screen; ✓ Mentés keeps the record, ✕ or Back leaves; both return to the photo. */
@SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
@Composable
internal fun PlaneDialog(st: EditorState, key: String, file: String, title: String, onDone: () -> Unit) {
    val ctx = LocalContext.current
    var page by remember { mutableStateOf<Pair<String, String>?>(null) }
    var err by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(key) {
        try { page = PlanePhone.page(ctx) to PlanePhone.input(st, key, file, title) }
        catch (e: Exception) { VrgLog.w("sketch", "Mérés: ${e.message}"); err = "A mérés nem nyílt meg: ${e.message ?: "ismeretlen hiba"}" }
    }
    Dialog(onDismissRequest = onDone, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(Modifier.fillMaxSize().background(Melyviz.abyss)) {
            val p = page
            when {
                err != null -> Text(err!!, style = Melyviz.small.copy(color = Melyviz.coral), modifier = Modifier.align(Alignment.Center).padding(24.dp))
                p == null -> Text("Készül a mérés…", style = Melyviz.small.copy(color = Melyviz.glow), modifier = Modifier.align(Alignment.Center))
                else -> AndroidView(modifier = Modifier.fillMaxSize(), factory = { c ->
                    WebView(c).apply {
                        settings.javaScriptEnabled = true
                        addJavascriptInterface(PlanePhone.Bridge(p.second,
                            onSave = { json ->
                                val next = Planes.put(st.sketch, key, json)
                                if (next != st.sketch) { st.edit(next); st.note = "Mérés mentve: " + (Planes.summary(Planes.of(next, key)).firstOrNull() ?: "nincs mérés") }
                                onDone()
                            },
                            onClose = onDone,
                            onFail = { m -> VrgLog.w("sketch", "Mérés: $m"); err = "A mérés hibára futott: " + (m.lineSequence().firstOrNull() ?: m) }), "VRGPlaneIO")
                        loadDataWithBaseURL(null, p.first, "text/html", "utf-8", null)
                    }
                }, onRelease = { it.destroy() })
            }
        }
    }
}
