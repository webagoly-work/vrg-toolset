package hu.vrg.mobile.sketch.ui

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.speech.RecognizerIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.vrg.mobile.kit.files.FileStore
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.sketch.VariantRequests
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

// Variánsok (WP M31): under the options (⚙) of the original Sketcher. Choosing one puts its toggle in the top corner;
// "Új variáns kérése" hands a request to an agent (Sketcher/variants/PROTOCOL.md, codephrase GO VARIANT).

@Composable
internal fun VariantSection(st: EditorState) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val all by SketcherKit.variants.collectAsState()
    var msg by remember { mutableStateOf<String?>(null) }
    Text("Variánsok", style = Melyviz.label, modifier = Modifier.padding(top = 14.dp, bottom = 2.dp))
    Text("Egy munkatípusra hangolt Sketcher; a sarokban lévő kapcsoló bármikor visszavált az eredetire.", style = Melyviz.small)
    Column(Modifier.padding(vertical = 4.dp)) {
        Row(Modifier.fillMaxWidth().clickable { st.chooseVariant(null) }.padding(vertical = 6.dp)) {
            Text(if (!st.sketch.variantOn) "◉ " else "○ ", style = Melyviz.label.copy(color = Melyviz.glow))
            Text("Eredeti Sketcher", style = Melyviz.label)
        }
        all.forEach { v ->
            val on = st.sketch.variantOn && st.sketch.variant == v.id
            Column(Modifier.fillMaxWidth().clickable { st.chooseVariant(v) }.padding(vertical = 6.dp)) {
                Row {
                    Text(if (on) "◉ " else "○ ", style = Melyviz.label.copy(color = Color(v.color)))
                    Text(v.sym + " " + v.name, style = Melyviz.label.copy(color = if (on) Color(v.color) else Melyviz.ink))
                }
                Text(v.premise, style = Melyviz.small.copy(fontSize = 10.sp), maxLines = 3)
            }
        }
    }
    Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("⟳ Frissítés a main ágról", style = Melyviz.label.copy(color = Melyviz.current, fontSize = 12.sp),
            modifier = Modifier.clickable { msg = "Frissítés…"; scope.launch { msg = SketcherKit.refresh(ctx) } }.padding(vertical = 6.dp))
        Text("＋ Új variáns kérése", style = Melyviz.label.copy(color = Melyviz.current, fontSize = 12.sp),
            modifier = Modifier.clickable { st.ask = Ask.VariantRequest }.padding(vertical = 6.dp))
    }
    msg?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand)) }
}

/** The request: 1-3 sentences, the toggles that describe the job, a few photos. No client data goes with it. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun VariantRequestDialog(st: EditorState, inlineNote: Boolean = false, close: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var premise by remember { mutableStateOf("") }
    var topics by remember { mutableStateOf(st.sketch.scope.filterValues { it > 0 }.keys.toList()) }
    var photos by remember { mutableStateOf(listOf<String>()) }
    val dictate = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        val said = r.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()
        if (!said.isNullOrBlank()) premise = if (premise.isBlank()) said else "$premise $said"
    }
    AlertDialog(
        onDismissRequest = close, containerColor = Melyviz.raised,
        title = { Text("◐ Új variáns kérése", style = Melyviz.label) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                Text("Egy-három mondat a munkáról: mi a feladat, milyen a hely, mire figyelj. Az ügynök ebből tervez, és visszakérdez.", style = Melyviz.small)
                Field(premise, { premise = it }, "A munka lényege", lines = 3)
                Text("🎤 Diktálás", style = Melyviz.label.copy(color = Melyviz.current), modifier = Modifier.clickable {
                    try { dictate.launch(dictationIntent("Mondd el a munkát")) } catch (e: ActivityNotFoundException) { st.note = "Nincs beszédfelismerő a telefonon." }
                }.padding(vertical = 4.dp))
                Text("Kulcsszavak", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 6.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    st.kit.scope.filter { it.group != "igeny" }.forEach { s ->
                        Pill(s.sym + " " + s.label, st.frontColor("munkakor"), s.id in topics) { topics = if (s.id in topics) topics - s.id else topics + s.id }
                    }
                }
                if (inlineNote) st.note?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 6.dp)) }   // F4: opened from the home
                if (st.sketch.captures.isNotEmpty()) {
                    Text("Fotók az ügynöknek (legfeljebb 5; a házszámot, arcot kerüld)", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 8.dp))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        // Kamera 2: personal photos, videos and signatures never go to an agent
                        st.sketch.captures.filter { it.kind == hu.vrg.mobile.sketch.CaptureKind.PHOTO && !it.privacy }.forEach { c ->
                            val p = st.kit.purpose(c.purpose)
                            Pill((p?.sym ?: "•") + " " + c.id, Color(p?.color ?: 0xFF7D8590), c.id in photos) {
                                photos = if (c.id in photos) photos - c.id else if (photos.size < 5) photos + c.id else photos
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton({
                if (premise.trim().length < 15) { st.note = "Írj legalább egy mondatot a munkáról."; return@TextButton }
                scope.launch {
                    val files = withContext(Dispatchers.IO) { writeRequest(ctx, st, premise, topics, photos) }
                    copyText(ctx, VariantRequests.prompt(premise, files[0].first.name))
                    shareAll(ctx, files)
                    st.note = "A kérés megosztva; a „GO VARIANT” szöveg a vágólapon."
                    close()
                }
            }) { Text("Küldés", color = Melyviz.glow) }
        },
        dismissButton = { TextButton(close) { Text("Mégse", color = Melyviz.muted) } },
    )
}

private fun writeRequest(ctx: Context, st: EditorState, premise: String, topics: List<String>, photoIds: List<String>): List<Pair<File, String>> {
    val out = FileStore.cacheDir(ctx, "sketch")
    val dir = st.photoDir
    val pics = photoIds.mapNotNull { st.sketch.capture(it) }.mapNotNull { c ->
        val src = dir?.let { File(it, c.file) }?.takeIf { it.exists() } ?: return@mapNotNull null
        // the request names the photos by purpose only, never by the survey's (client's) name
        val f = File(out, "variant-photo-${c.id}-${c.purpose}.jpg")
        if (c.privacy || c.kind != hu.vrg.mobile.sketch.CaptureKind.PHOTO) return@mapNotNull null
        // Kamera 2 (D-57): the blur burned in, the GPS removed
        if (c.marks.any { it.kind.blur }) burnMarks(src, c.marks.filter { it.kind.blur }, f) else copyWithoutGps(src, f)
    }
    val now = System.currentTimeMillis()
    val req = File(out, "variant-request-$now.json")
    req.writeText(VariantRequests.build(st.sketch, st.kit, premise, topics, pics.map { it.name }, now).toString(1))
    return listOf(req to "application/json") + pics.map { it to "image/jpeg" }
}

private fun copyText(ctx: Context, text: String) {
    (ctx.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager)?.setPrimaryClip(ClipData.newPlainText("GO VARIANT", text))
}

