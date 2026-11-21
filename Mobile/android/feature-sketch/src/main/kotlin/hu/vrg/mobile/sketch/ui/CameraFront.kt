package hu.vrg.mobile.sketch.ui

import android.content.ActivityNotFoundException
import android.graphics.Bitmap
import android.graphics.Canvas as ACanvas
import android.graphics.Paint
import android.graphics.Path as APath
import android.speech.RecognizerIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.sketch.Capture
import hu.vrg.mobile.sketch.Mark
import hu.vrg.mobile.sketch.MarkKind
import hu.vrg.mobile.sketch.Pt
import hu.vrg.mobile.sketch.Tools
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

// Kamera (WP M29). The photo is taken with the phone's own camera app (as Átadás and Fotópont do); everything that
// makes a field photo useful happens around it (docs/research/2026-11-18_field-survey-camera-notes.md, "build now"):
// a purpose per photo, the shot list that grows with the job, the room it was taken in, GPS from the photo itself,
// a caption by voice, markup kept as vectors over the untouched original, a gallery by purpose, and Sorozat (the
// camera comes back after each shot until the user stops).

/** A small thumbnail, decoded off the main thread. */
@Composable
private fun thumb(f: File, px: Int): ImageBitmap? = produceState<ImageBitmap?>(null, f.path, f.lastModified()) {
    value = withContext(Dispatchers.IO) { loadAny(f, px)?.asImageBitmap() }     // Kamera 2: videos and signatures too
}.value

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun CameraFront(st: EditorState, sh: Shadow) {
    val col = st.frontColor("kamera")
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 140.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("◉", style = Melyviz.glyph.copy(fontSize = 20.sp, color = col))
            Text("  KAMERA", style = Melyviz.title.copy(fontSize = 15.sp))
            Spacer(Modifier.weight(1f))
            Pill(if (st.series) "⟳ Sorozat: be" else "⟳ Sorozat", col, st.series) { st.series = !st.series }
        }
        st.note?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand)) }
        Text("Koppints a célra: a kamera nyílik, a fotó a célt, a szobát (" +
            (st.sketch.room(st.focusRoom)?.let { roomTitle(it.name, it.kinds) } ?: "nincs kiválasztva") + ") és a helyet megkapja.",
            style = Melyviz.small, modifier = Modifier.padding(vertical = 6.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            st.kit.purposes.forEach { p ->
                val c = Color(p.color)
                Column(Modifier.width(78.dp).clip(RoundedCornerShape(12.dp)).background(if (st.purpose == p.id) c.copy(alpha = 0.25f) else Melyviz.surface)
                    .border(1.dp, c, RoundedCornerShape(12.dp)).clickable { if (p.id == "szoba") toPhotoPoint(st) else st.shoot(p.id) }.padding(vertical = 8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(p.sym, style = Melyviz.glyph.copy(fontSize = 22.sp, color = c))
                    Text(p.label, style = Melyviz.small.copy(fontSize = 9.sp), maxLines = 2)
                    val n = st.sketch.captures.count { it.purpose == p.id }
                    if (n > 0) Text("$n", style = Melyviz.readout.copy(color = c))
                }
            }
        }
        Camera2Section(st)
        Text("Képlista", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 14.dp, bottom = 4.dp))
        if (sh.shots.isEmpty()) Text("A munkakör alakulásával jelennek meg a kötelező képek.", style = Melyviz.small)
        sh.shots.forEach { s -> key(s.item.id) {
            val p = st.kit.purpose(s.item.purpose)
            val c = Color(p?.color ?: 0xFF7D8590)
            Row(Modifier.fillMaxWidth().clickable { if (s.item.purpose == "szoba") toPhotoPoint(st) else st.shoot(s.item.purpose, s.item.id) }.padding(vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Text(if (s.done) "✓" else (p?.sym ?: "•"), style = Melyviz.glyph.copy(fontSize = 16.sp, color = if (s.done) Melyviz.glow else c), modifier = Modifier.width(26.dp))
                Column(Modifier.weight(1f)) {
                    Text(s.item.label, style = Melyviz.label.copy(fontSize = 13.sp, color = if (s.done) Melyviz.muted else Melyviz.ink))
                    s.item.hint?.let { Text(it, style = Melyviz.small.copy(fontSize = 10.sp, color = Melyviz.faint)) }
                }
                Text("${s.have}/${s.item.need}", style = Melyviz.readout.copy(color = if (s.done) Melyviz.glow else c))
            }
        } }
        Text("Fotók (${st.sketch.captures.size})", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 14.dp, bottom = 4.dp))
        val dir = st.photoDir
        st.kit.purposes.forEach { p ->
            val caps = st.sketch.captures.filter { it.purpose == p.id }
            if (caps.isEmpty() || dir == null) return@forEach
            Text(p.sym + " " + p.label, style = Melyviz.small.copy(color = Color(p.color)), modifier = Modifier.padding(top = 6.dp))
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                caps.sortedByDescending { it.at }.forEach { c -> key(c.id) {
                    val img = thumb(File(dir, c.file), 240)
                    Box(Modifier.size(84.dp).clip(RoundedCornerShape(8.dp)).background(Melyviz.surface).clickable { st.ask = Ask.CaptureView(c.id) }) {
                        if (img != null) Image(img, contentDescription = p.label, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                        CaptureBadges(c, Modifier.align(Alignment.TopStart).padding(2.dp))
                        if (c.marks.isNotEmpty()) Text("✎", style = Melyviz.small.copy(color = Color.White), modifier = Modifier.align(Alignment.TopEnd).padding(3.dp))
                        st.sketch.room(c.room)?.let { Text(roomTitle(it.name, it.kinds), style = Melyviz.small.copy(fontSize = 8.sp, color = Color.White),
                            modifier = Modifier.align(Alignment.BottomStart).background(Color(0x99000000)).padding(horizontal = 3.dp)) }
                    }
                } }
            }
        }
    }
}

/** A room's four directions belong to Fotópont (M25): to the sketch with its tool. */
private fun toPhotoPoint(st: EditorState) {
    st.front = "vazlat"
    if (Tools.PHOTO !in st.rail) st.togglePlugin("fotopont")
    if (Tools.PHOTO in st.rail) st.pick(Tools.PHOTO)
    st.note = "◉ Fotópont: koppints a szoba közepére, majd a pontra."
}

/** Choosing the purpose first (a hold on ◉). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun PurposePicker(st: EditorState, close: () -> Unit) = AlertDialog(
    onDismissRequest = close, containerColor = Melyviz.raised,
    title = { Text("◉ Mit fotózol?", style = Melyviz.label.copy(color = st.frontColor("kamera"))) },
    text = { Column(Modifier.verticalScroll(rememberScrollState())) {
        QuickRow(st, close)      // Kamera 2: the next missing shots first, video, signature, the recent purposes
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            st.kit.purposes.forEach { p ->
                val c = Color(p.color)
                Column(Modifier.width(76.dp).clip(RoundedCornerShape(12.dp)).border(1.dp, c, RoundedCornerShape(12.dp))
                    .clickable { close(); if (p.id == "szoba") toPhotoPoint(st) else st.shoot(p.id) }.padding(vertical = 8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(p.sym, style = Melyviz.glyph.copy(fontSize = 22.sp, color = c))
                    Text(p.label, style = Melyviz.small.copy(fontSize = 9.sp), maxLines = 2)
                }
            }
        }
    } },
    confirmButton = { TextButton(close) { Text("Mégse", color = Melyviz.muted) } },
)

private val MARK_COLORS = listOf(0xFFE8641C, 0xFFD64545, 0xFFE0B020, 0xFF27C2B0, 0xFFFFFFFF)

/** One photo: the picture with its markup, purpose, room, caption (typed or dictated), delete. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun CaptureViewer(st: EditorState, id: String, close: () -> Unit) {
    val c = st.sketch.capture(id) ?: return close()
    val dir = st.photoDir ?: return close()
    if (c.kind != hu.vrg.mobile.sketch.CaptureKind.PHOTO) { MediaViewer(st, c, close); return }    // Kamera 2
    val bmp = remember(c.file) { loadPhoto(File(dir, c.file), 1600)?.asImageBitmap() }
    var marking by remember { mutableStateOf(false) }
    var kind by remember { mutableStateOf(MarkKind.ARROW) }
    var color by remember { mutableStateOf(MARK_COLORS[0]) }
    var draft by remember { mutableStateOf<List<Pt>?>(null) }
    var textAt by remember { mutableStateOf<Pt?>(null) }
    var note by remember(c.note) { mutableStateOf(c.note) }
    LaunchedEffect(note) { kotlinx.coroutines.delay(600); if (note != st.sketch.capture(id)?.note) st.editCapture(id) { it.copy(note = note) } }
    val dictate = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        val said = r.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()
        if (!said.isNullOrBlank()) note = if (note.isBlank()) said else "$note $said"
    }
    Dialog(onDismissRequest = close, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(Modifier.fillMaxSize().background(Melyviz.abyss).verticalScroll(rememberScrollState()).padding(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("‹", style = Melyviz.title.copy(color = Melyviz.current), modifier = Modifier.clickable(onClick = close).padding(end = 12.dp))
                val p = st.kit.purpose(c.purpose)
                Text((p?.sym ?: "•") + " " + (p?.label ?: c.purpose), style = Melyviz.label.copy(color = Color(p?.color ?: 0xFF7D8590)))
                Spacer(Modifier.weight(1f))
                Text(stamp(c.at), style = Melyviz.readout)
            }
            if (bmp != null) {
                var box by remember { mutableStateOf(IntSize.Zero) }
                Box(Modifier.fillMaxWidth().aspectRatio(bmp.width.toFloat() / bmp.height).padding(vertical = 6.dp)) {
                    Image(bmp, contentDescription = "fotó", contentScale = ContentScale.FillBounds, modifier = Modifier.fillMaxSize())
                    Canvas(Modifier.fillMaxSize()
                        .pointerInput(marking, kind, color) {
                            if (!marking) return@pointerInput
                            box = size
                            if (kind == MarkKind.TEXT) detectTapGestures { o -> textAt = Pt((o.x / size.width).toDouble(), (o.y / size.height).toDouble()) }
                            else detectDragGestures(
                                onDragStart = { o -> draft = listOf(Pt((o.x / size.width).toDouble(), (o.y / size.height).toDouble())) },
                                onDrag = { ch, _ -> ch.consume(); val q = ch.position
                                    val pt = Pt((q.x / size.width).toDouble().coerceIn(0.0, 1.0), (q.y / size.height).toDouble().coerceIn(0.0, 1.0))
                                    draft = if (kind == MarkKind.FREE || kind == MarkKind.BLUR_BRUSH) (draft ?: emptyList()) + pt else listOf(draft?.firstOrNull() ?: pt, pt) },
                                onDragEnd = { val d = draft; draft = null
                                    if (d != null && d.size >= 2) st.editCapture(id) { it.copy(marks = it.marks + Mark(kind, d, "", color, w = if (kind == MarkKind.BLUR_BRUSH) BRUSH_W else 0.0)) } },
                                onDragCancel = { draft = null },
                            )
                        }) {
                        c.marks.forEach { m -> drawMark(m) }
                        st.cam2.faces[id]?.forEach { drawProposal(it) }          // Kamera 2: faces waiting for ✓ Elmosás
                        draft?.let { drawMark(Mark(kind, it, "", color, w = if (kind == MarkKind.BLUR_BRUSH) BRUSH_W else 0.0)) }
                    }
                }
            } else Text("A fotó nem olvasható.", style = Melyviz.small.copy(color = Melyviz.coral))
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Pill(if (marking) "✎ Jelölés: be" else "✎ Jelölés", Color(color), marking) { marking = !marking }
                if (marking) {
                    (listOf(MarkKind.ARROW to "➚", MarkKind.CIRCLE to "◯", MarkKind.LINE to "╱", MarkKind.FREE to "〰", MarkKind.TEXT to "T") +
                        if (st.cam2.on(hu.vrg.mobile.sketch.CameraFeatures.BLUR)) listOf(MarkKind.BLUR to "▦", MarkKind.BLUR_BRUSH to "▒") else emptyList()).forEach { (k, sym) ->
                        Pill(sym, Color(color), kind == k) { kind = k }
                    }
                    MARK_COLORS.forEach { mc -> Box(Modifier.size(24.dp).clip(RoundedCornerShape(50)).background(Color(mc))
                        .border(2.dp, if (mc == color) Melyviz.ink else Color.Transparent, RoundedCornerShape(50)).clickable { color = mc }) }
                    if (c.marks.isNotEmpty()) Pill("↶", Melyviz.faint, false) { st.editCapture(id) { it.copy(marks = it.marks.dropLast(1)) } }
                }
            }
            if (marking && kind.blur) Text("▦ / ▒ elmosás: a kiadott képen kockásítva, az eredeti a telefonon marad.", style = Melyviz.small.copy(fontSize = 10.sp, color = Melyviz.faint))
            PhotoExtras(st, c)       // Kamera 2: reading, privacy, before / after
            Text("Cél", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 8.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                st.kit.purposes.filter { it.id != "szoba" }.forEach { p -> Pill(p.sym + " " + p.label, Color(p.color), c.purpose == p.id) {
                    st.editCapture(id) { it.copy(purpose = p.id, shot = if (st.kit.shot(it.shot)?.purpose == p.id) it.shot else null) } } }
            }
            Text("Szoba", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 8.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Pill("—", Melyviz.faint, c.room == null) { st.editCapture(id) { it.copy(room = null) } }
                st.sketch.rooms.forEach { r -> Pill(roomTitle(r.name, r.kinds), st.frontColor("vazlat"), c.room == r.id) { st.editCapture(id) { it.copy(room = r.id) } } }
            }
            Field(note, { note = it }, "Felirat, megjegyzés", lines = 2)
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("🎤 Diktálás", style = Melyviz.label.copy(color = Melyviz.current), modifier = Modifier.clickable {
                    try { dictate.launch(dictationIntent("Mi látszik a képen?")) } catch (e: ActivityNotFoundException) { st.note = NO_RECOGNIZER }
                }.padding(vertical = 8.dp))
                if (c.lat != null && c.lon != null) Text("⌖ %.5f, %.5f".format(c.lat, c.lon), style = Melyviz.readout, modifier = Modifier.padding(vertical = 8.dp))
                Spacer(Modifier.weight(1f))
                Text("Törlés", style = Melyviz.label.copy(color = Melyviz.coral), modifier = Modifier.clickable { st.deleteCapture(id); close() }.padding(vertical = 8.dp))
            }
            Text("Fájlnév a PC-n: " + hu.vrg.mobile.sketch.Intake.exportName(st.sketch, c), style = Melyviz.small.copy(fontSize = 10.sp, color = Melyviz.faint))
        }
    }
    textAt?.let { at ->
        TextDialog("Felirat a képre", "pl. ide jön a kötődoboz", "", { textAt = null }) { t ->
            if (t.isNotBlank()) st.editCapture(id) { it.copy(marks = it.marks + Mark(MarkKind.TEXT, listOf(at), t.trim(), color)) }
            textAt = null
        }
    }
}

/** A mark in a DrawScope of the photo's size (its points are 0..1). */
private fun DrawScope.drawMark(m: Mark) {
    val col = Color(m.color)
    val w = max(3f, size.minDimension / 160f)
    fun P(p: Pt) = Offset((p.x * size.width).toFloat(), (p.y * size.height).toFloat())
    when (m.kind) {
        MarkKind.ARROW -> if (m.pts.size >= 2) {
            val a = P(m.pts.first()); val b = P(m.pts.last())
            drawLine(col, a, b, w)
            val ang = atan2((b.y - a.y).toDouble(), (b.x - a.x).toDouble()); val hl = w * 5
            for (d in listOf(2.6, -2.6)) drawLine(col, b, Offset((b.x + hl * cos(ang + d)).toFloat(), (b.y + hl * sin(ang + d)).toFloat()), w)
        }
        MarkKind.LINE -> if (m.pts.size >= 2) drawLine(col, P(m.pts.first()), P(m.pts.last()), w)
        MarkKind.CIRCLE -> if (m.pts.size >= 2) {
            val a = P(m.pts.first()); val b = P(m.pts.last())
            drawOval(col, Offset(min(a.x, b.x), min(a.y, b.y)), Size(kotlin.math.abs(b.x - a.x), kotlin.math.abs(b.y - a.y)), style = Stroke(w))
        }
        MarkKind.FREE -> for (i in 0 until m.pts.size - 1) drawLine(col, P(m.pts[i]), P(m.pts[i + 1]), w)
        MarkKind.BLUR, MarkKind.BLUR_BRUSH -> drawBlurPreview(m)
        MarkKind.TEXT -> m.pts.firstOrNull()?.let { p ->
            val paint = Paint().apply { color = col.toArgb(); textSize = w * 7; isAntiAlias = true; setShadowLayer(4f, 0f, 0f, android.graphics.Color.BLACK) }
            drawContext.canvas.nativeCanvas.drawText(m.text, P(p).x, P(p).y, paint)
        }
    }
}

/**
 * The photo with its markup burned in, for the PC (the original stays as it is). Null when the photo cannot be read.
 */
internal fun burnMarks(src: File, marks: List<Mark>, out: File): File? {
    val b = loadPhoto(src, 2400) ?: return null
    val bmp = applyBlur(b, marks)      // Kamera 2: blur first (a mutable copy either way)
    val cv = ACanvas(bmp)
    val w = max(4f, min(bmp.width, bmp.height) / 160f)
    val paint = Paint().apply { isAntiAlias = true; style = Paint.Style.STROKE; strokeWidth = w; strokeCap = Paint.Cap.ROUND }
    fun x(p: Pt) = (p.x * bmp.width).toFloat()
    fun y(p: Pt) = (p.y * bmp.height).toFloat()
    for (m in marks) {
        paint.color = m.color.toInt(); paint.style = Paint.Style.STROKE
        when (m.kind) {
            MarkKind.ARROW, MarkKind.LINE -> if (m.pts.size >= 2) {
                val a = m.pts.first(); val c = m.pts.last()
                cv.drawLine(x(a), y(a), x(c), y(c), paint)
                if (m.kind == MarkKind.ARROW) {
                    val ang = atan2((y(c) - y(a)).toDouble(), (x(c) - x(a)).toDouble()); val hl = w * 5
                    for (d in listOf(2.6, -2.6)) cv.drawLine(x(c), y(c), (x(c) + hl * cos(ang + d)).toFloat(), (y(c) + hl * sin(ang + d)).toFloat(), paint)
                }
            }
            MarkKind.CIRCLE -> if (m.pts.size >= 2) {
                val a = m.pts.first(); val c = m.pts.last()
                cv.drawOval(min(x(a), x(c)), min(y(a), y(c)), max(x(a), x(c)), max(y(a), y(c)), paint)
            }
            MarkKind.FREE -> if (m.pts.size >= 2) {
                val path = APath(); path.moveTo(x(m.pts[0]), y(m.pts[0])); m.pts.drop(1).forEach { path.lineTo(x(it), y(it)) }
                cv.drawPath(path, paint)
            }
            MarkKind.BLUR, MarkKind.BLUR_BRUSH -> {}     // burned in by applyBlur
            MarkKind.TEXT -> m.pts.firstOrNull()?.let { p ->
                val t = Paint().apply { color = m.color.toInt(); textSize = w * 7; isAntiAlias = true; setShadowLayer(5f, 0f, 0f, android.graphics.Color.BLACK) }
                cv.drawText(m.text, x(p), y(p), t)
            }
        }
    }
    return try { out.outputStream().use { bmp.compress(Bitmap.CompressFormat.JPEG, 88, it) }; out } catch (e: Exception) { null }
}

@Suppress("unused") private fun hyp(a: Offset, b: Offset) = hypot(a.x - b.x, a.y - b.y)
@Suppress("unused") private fun capLabel(c: Capture) = c.purpose
