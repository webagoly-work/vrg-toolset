package hu.vrg.mobile.sketch.ui

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas as ACanvas
import android.graphics.Paint
import android.graphics.Path as APath
import android.graphics.Shader
import android.media.ExifInterface
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.MediaStore
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import hu.vrg.mobile.kit.files.FileStore
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.sketch.Camera2
import hu.vrg.mobile.sketch.CameraFeatures
import hu.vrg.mobile.sketch.Capture
import hu.vrg.mobile.sketch.CaptureKind
import hu.vrg.mobile.sketch.Intake
import hu.vrg.mobile.sketch.Mark
import hu.vrg.mobile.sketch.MarkKind
import hu.vrg.mobile.sketch.Pt
import hu.vrg.mobile.sketch.Sketch
import hu.vrg.mobile.sketch.TypePlate
import hu.vrg.mobile.sketch.vision.FaceFinder
import hu.vrg.mobile.sketch.vision.TextReader
import hu.vrg.mobile.kit.ui.VrgToggle
import androidx.compose.ui.graphics.PathEffect
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.math.max
import kotlin.math.min
import hu.vrg.mobile.kit.theme.vrgBorder

// Kamera 2 (the camera's second round): the screens and the Android half of sketch-core's Camera2 / TypePlate.
// Type-plate reading (sketch-vision's TextReader, on the phone), blur kept as a vector and burned in on export, the
// "személyes adat" flag and GPS stripped from exported copies, before / after pairs with a comparison slider, the
// client's signature pad, the walk video, and faster purpose switching ("+ ugyanez még", the next missing shots first
// on the ◉ hold menu). The M29 files (CameraFront.kt, SketchEditor.kt) only call into this one.

/** Kamera 2's screen state, held by EditorState (`cam2`). */
class Cam2State {
    /** The last camera request, offered as "+ ugyanez még" for a few seconds after the shot. */
    var again by mutableStateOf<CameraReq?>(null)
    var againAt by mutableStateOf(0L)
    /** Photos waiting for the type-plate reader, and the one being read now. */
    var readQueue by mutableStateOf<List<String>>(emptyList())
    var reading by mutableStateOf<String?>(null)
    /** The switched-off features (CameraFeatures, D-90; the phone's preference, loaded by OcrRunner). */
    var off by mutableStateOf<Set<String>>(emptySet())
    var saveOff: (Set<String>) -> Unit = {}
    /** Face finding: the queue, the photo being searched, the blur rectangles proposed per photo (not yet accepted). */
    var faceQueue by mutableStateOf<List<String>>(emptyList())
    var finding by mutableStateOf<String?>(null)
    var faces by mutableStateOf<Map<String, List<Mark>>>(emptyMap())

    fun on(id: String) = CameraFeatures.on(off, id)
    fun applyOff(next: Set<String>) { off = next; saveOff(next) }

    fun taken(st: EditorState, req: CameraReq, id: String) {
        if (on(CameraFeatures.AGAIN)) { again = req.copy(pairOf = null); againAt = System.currentTimeMillis() }
        st.sketch.capture(id)?.let { if (on(CameraFeatures.OCR_AUTO) && TypePlate.readsByItself(it)) read(id) }
    }

    fun read(id: String) { if (on(CameraFeatures.OCR) && id !in readQueue && id != reading) readQueue = readQueue + id }
    fun findFaces(id: String) { if (on(CameraFeatures.FACES) && id !in faceQueue && id != finding) faceQueue = faceQueue + id }
    fun dropFaces(id: String) { faces = faces - id }
}

/** The feature switches, one per phone (SharedPreferences "sketcher-camera"; only the switched-off ids are stored). */
internal object CameraPrefs {
    private const val KEY = "off"
    fun off(ctx: Context): Set<String> = CameraFeatures.read(ctx.getSharedPreferences("sketcher-camera", Context.MODE_PRIVATE).getString(KEY, ""))
    fun save(ctx: Context, off: Set<String>) { ctx.getSharedPreferences("sketcher-camera", Context.MODE_PRIVATE).edit().putString(KEY, CameraFeatures.write(off)).apply() }
}

// ---- the editor's Kamera 2 actions ------------------------------------------------------------------------------------

/** The after-photo of [before]: same purpose, shot item and room; paired when it comes back. */
internal fun EditorState.shootAfter(before: Capture) {
    purpose = before.purpose
    camera = CameraReq(null, null, before.purpose, before.shot, before.target, before.room ?: focusRoom, pairOf = before.id)
}

/** The walk video (CaptureVideo intent): a cable route by default. */
internal fun EditorState.shootVideo(purpose: String = "nyomvonal", shot: String? = null) {
    camera = CameraReq(null, null, purpose, shot, null, focusRoom, video = true)
}

internal fun EditorState.videoTaken(req: CameraReq, file: String, durationMs: Long, bytes: Long) {
    val (s, id) = Camera2.addVideo(sketch, file, req.purpose ?: "nyomvonal", req.room ?: focusRoom, req.shot, durationMs, bytes, System.currentTimeMillis())
    edit(s)
    val warn = sketch.capture(id)?.let { Camera2.videoWarning(it) }
    note = "🎥 Videó mentve (" + Camera2.duration(durationMs) + ", " + Camera2.mb(bytes) + ")" + (warn?.let { " · $it" } ?: "")
}

internal fun EditorState.signed(file: String, signer: String, statement: String) {
    val (s, id) = Camera2.addSignature(sketch, file, signer, statement, System.currentTimeMillis())
    edit(s)
    note = "✍ Aláírás mentve"
    ask = Ask.CaptureView(id)
}

internal fun EditorState.ocrDone(id: String, text: String?) {
    if (text == null) { note = "▤ A szöveg nem olvasható ezen a képen."; return }
    edit(TypePlate.store(sketch, id, text, System.currentTimeMillis()))
    val n = sketch.capture(id)?.ocr?.count { !it.used && !it.dropped } ?: 0
    note = if (n > 0) "▤ $n adat a képen: koppints rájuk a fotón (Kamera → ▤)." else "▤ Nem találtam számot, értéket a képen."
}

/** Runs the type-plate reader on the queued photos, one at a time, off the main thread. Placed once on the editor. */
@Composable
internal fun OcrRunner(st: EditorState) {
    val ctx = LocalContext.current
    // M51: cam2.off follows the feature registry (FeatureSync); the camera's own setting is still where it was
    FaceRunner(st)
    val head = st.cam2.readQueue.firstOrNull()
    LaunchedEffect(head) {
        val id = head ?: return@LaunchedEffect
        val dir = st.photoDir
        val c = st.sketch.capture(id)
        st.cam2.reading = id
        val text = if (c == null || dir == null) null else withContext(Dispatchers.Default) {
            loadPhoto(File(dir, c.file), 2000)?.let { TextReader.default.read(it) }
        }
        st.cam2.reading = null
        if (c != null) st.ocrDone(id, text)
        st.cam2.readQueue = st.cam2.readQueue - id
    }
}

/** Finds faces on the queued photos and keeps them as blur proposals (accepted or dropped in the viewer, D-56 = B). */
@Composable
private fun FaceRunner(st: EditorState) {
    val head = st.cam2.faceQueue.firstOrNull()
    LaunchedEffect(head) {
        val id = head ?: return@LaunchedEffect
        val dir = st.photoDir
        val c = st.sketch.capture(id)
        st.cam2.finding = id
        val boxes = if (c == null || dir == null) null else withContext(Dispatchers.Default) {
            loadPhoto(File(dir, c.file), 1600)?.let { FaceFinder.default.find(it) }
        }
        st.cam2.finding = null
        if (c != null) {
            if (boxes == null) st.note = "☺ Az arckeresés nem sikerült ezen a képen."
            else {
                val p = CameraFeatures.proposals(boxes.map { CameraFeatures.Box(it[0].toDouble(), it[1].toDouble(), it[2].toDouble(), it[3].toDouble()) }, c.marks)
                st.cam2.faces = if (p.isEmpty()) st.cam2.faces - id else st.cam2.faces + (id to p)
                st.note = if (p.isEmpty()) "☺ Nem találtam (új) arcot." else "☺ ${p.size} arc: az elmosás jóváhagyásra vár a fotón."
            }
        }
        st.cam2.faceQueue = st.cam2.faceQueue - id
    }
}

/** A proposed blur (a face): dashed outline over a light veil, until accepted. */
internal fun DrawScope.drawProposal(m: Mark) {
    if (m.pts.size < 2) return
    val a = Offset((m.pts[0].x * size.width).toFloat(), (m.pts[0].y * size.height).toFloat())
    val b = Offset((m.pts[1].x * size.width).toFloat(), (m.pts[1].y * size.height).toFloat())
    val tl = Offset(min(a.x, b.x), min(a.y, b.y)); val sz = Size(kotlin.math.abs(b.x - a.x), kotlin.math.abs(b.y - a.y))
    drawRect(Color(0x55D64545), tl, sz)
    drawRect(Color(0xFFD64545), tl, sz, style = Stroke(2.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 8f))))
}

// ---- files ------------------------------------------------------------------------------------------------------------

/** CaptureVideo with a length and size limit the camera app is asked to keep (most do; D-60). */
internal class CaptureWalkVideo : ActivityResultContracts.CaptureVideo() {
    override fun createIntent(context: Context, input: Uri): Intent = super.createIntent(context, input)
        .putExtra(MediaStore.EXTRA_DURATION_LIMIT, Camera2.VIDEO_MAX_S)
        .putExtra(MediaStore.EXTRA_SIZE_LIMIT, Camera2.VIDEO_LIMIT_BYTES)
}

internal fun videoDuration(f: File): Long = try {
    val r = MediaMetadataRetriever()
    try { r.setDataSource(f.path); r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L } finally { r.release() }
} catch (e: Exception) { 0L }

/** A photo, a video's first frame or a signature, scaled to about [max] px. */
internal fun loadAny(f: File, max: Int): Bitmap? = when {
    f.name.endsWith(".mp4", true) -> try {
        val r = MediaMetadataRetriever()
        try { r.setDataSource(f.path); r.getScaledFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC, max, max) } finally { r.release() }
    } catch (e: Exception) { null }
    f.name.endsWith(".png", true) -> try { BitmapFactory.decodeFile(f.path) } catch (e: Exception) { null }
    else -> loadPhoto(f, max)
}

@Composable
private fun thumbAny(f: File, px: Int): ImageBitmap? = produceState<ImageBitmap?>(null, f.path, f.lastModified()) {
    value = withContext(Dispatchers.IO) { loadAny(f, px)?.asImageBitmap() }
}.value

/**
 * The blur marks burned into [src]: each blurred rectangle or brush stroke filled with a coarse mosaic of the photo
 * under it (cells of 1/40 of the short side: a face or a house number becomes unreadable). Returns a mutable copy.
 */
internal fun applyBlur(src: Bitmap, marks: List<Mark>): Bitmap {
    val bmp = src.copy(Bitmap.Config.ARGB_8888, true)
    val blurs = marks.filter { it.kind.blur }
    if (blurs.isEmpty()) return bmp
    val cell = max(8, min(bmp.width, bmp.height) / 40)
    val small = Bitmap.createScaledBitmap(bmp, max(1, bmp.width / cell), max(1, bmp.height / cell), true)
    val mosaic = Bitmap.createScaledBitmap(small, bmp.width, bmp.height, false)
    val paint = Paint().apply { shader = BitmapShader(mosaic, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP); isAntiAlias = true }
    val cv = ACanvas(bmp)
    fun x(p: Pt) = (p.x * bmp.width).toFloat()
    fun y(p: Pt) = (p.y * bmp.height).toFloat()
    for (m in blurs) {
        if (m.kind == MarkKind.BLUR && m.pts.size >= 2) {
            val a = m.pts.first(); val b = m.pts.last()
            paint.style = Paint.Style.FILL
            cv.drawRect(min(x(a), x(b)), min(y(a), y(b)), max(x(a), x(b)), max(y(a), y(b)), paint)
        } else if (m.kind == MarkKind.BLUR_BRUSH && m.pts.isNotEmpty()) {
            val wpx = ((if (m.w > 0) m.w else BRUSH_W) * min(bmp.width, bmp.height)).toFloat()
            paint.style = Paint.Style.STROKE; paint.strokeWidth = wpx; paint.strokeCap = Paint.Cap.ROUND; paint.strokeJoin = Paint.Join.ROUND
            val path = APath(); path.moveTo(x(m.pts[0]), y(m.pts[0])); m.pts.drop(1).forEach { path.lineTo(x(it), y(it)) }
            if (m.pts.size == 1) path.lineTo(x(m.pts[0]) + 0.5f, y(m.pts[0]))
            cv.drawPath(path, paint)
        }
    }
    small.recycle()
    return bmp
}

/** The brush's width as a share of the photo's short side. */
internal const val BRUSH_W = 0.06

/** The blur as the viewer shows it: an opaque grey patch (what is hidden on screen is hidden in the export too). */
internal fun DrawScope.drawBlurPreview(m: Mark) {
    val col = Color(0xF2404850)
    fun P(p: Pt) = Offset((p.x * size.width).toFloat(), (p.y * size.height).toFloat())
    if (m.kind == MarkKind.BLUR && m.pts.size >= 2) {
        val a = P(m.pts.first()); val b = P(m.pts.last())
        drawRect(col, Offset(min(a.x, b.x), min(a.y, b.y)), Size(kotlin.math.abs(b.x - a.x), kotlin.math.abs(b.y - a.y)))
        drawRect(Color.White.copy(alpha = 0.5f), Offset(min(a.x, b.x), min(a.y, b.y)), Size(kotlin.math.abs(b.x - a.x), kotlin.math.abs(b.y - a.y)), style = Stroke(1.dp.toPx()))
    } else if (m.kind == MarkKind.BLUR_BRUSH && m.pts.isNotEmpty()) {
        val w = ((if (m.w > 0) m.w else BRUSH_W) * size.minDimension).toFloat()
        val path = Path().apply { moveTo(P(m.pts[0]).x, P(m.pts[0]).y); m.pts.drop(1).forEach { lineTo(P(it).x, P(it).y) } }
        drawPath(path, col, style = Stroke(w, cap = StrokeCap.Round, join = StrokeJoin.Round))
    }
}

private val GPS_TAGS = listOf(
    ExifInterface.TAG_GPS_LATITUDE, ExifInterface.TAG_GPS_LATITUDE_REF, ExifInterface.TAG_GPS_LONGITUDE, ExifInterface.TAG_GPS_LONGITUDE_REF,
    ExifInterface.TAG_GPS_ALTITUDE, ExifInterface.TAG_GPS_ALTITUDE_REF, ExifInterface.TAG_GPS_TIMESTAMP, ExifInterface.TAG_GPS_DATESTAMP,
    ExifInterface.TAG_GPS_PROCESSING_METHOD, ExifInterface.TAG_GPS_SPEED, ExifInterface.TAG_GPS_SPEED_REF,
    ExifInterface.TAG_GPS_IMG_DIRECTION, ExifInterface.TAG_GPS_IMG_DIRECTION_REF,
)

/** Removes the position from a JPEG copy. False when the file could not be rewritten. */
internal fun stripGps(f: File): Boolean = try {
    val e = ExifInterface(f.path)
    GPS_TAGS.forEach { e.setAttribute(it, null) }
    e.saveAttributes()
    true
} catch (e: Exception) { false }

/** android.media.ExifInterface has no setLatLong: the degrees / minutes / seconds rationals are written by hand. */
internal fun setGps(f: File, lat: Double, lon: Double) {
    fun dms(v: Double): String {
        val a = kotlin.math.abs(v); val d = a.toInt(); val m = ((a - d) * 60).toInt(); val s = Math.round(((a - d) * 60 - m) * 60 * 1000)
        return "$d/1,$m/1,$s/1000"
    }
    try {
        ExifInterface(f.path).apply {
            setAttribute(ExifInterface.TAG_GPS_LATITUDE, dms(lat)); setAttribute(ExifInterface.TAG_GPS_LATITUDE_REF, if (lat >= 0) "N" else "S")
            setAttribute(ExifInterface.TAG_GPS_LONGITUDE, dms(lon)); setAttribute(ExifInterface.TAG_GPS_LONGITUDE_REF, if (lon >= 0) "E" else "W")
            saveAttributes()
        }
    } catch (e: Exception) { }
}

/** A copied photo with its GPS removed; when that fails the copy is re-encoded (no EXIF at all) rather than sent with it. */
internal fun copyWithoutGps(src: File, out: File): File? {
    src.copyTo(out, overwrite = true)
    if (stripGps(out)) return out
    out.delete()
    return burnMarks(src, emptyList(), out)
}

/**
 * What one capture sends with the package (D-57): the main file under its board name (a photo with blur only blurred,
 * its GPS removed unless kept), a "_jel" copy with the markup burned in, the video or the signature as they are.
 */
internal fun exportCapture(s: Sketch, c: Capture, src: File, out: File, stripGps: Boolean = true): List<File> {
    if (!src.exists()) return emptyList()
    val name = Intake.exportName(s, c)
    if (c.kind != CaptureKind.PHOTO) return listOf(File(out, name).also { src.copyTo(it, overwrite = true) })
    val plan = Camera2.exportPlan(c, stripGps)
    val made = if (plan.burnBlur) {
        burnMarks(src, c.marks.filter { it.kind.blur }, File(out, name))
    } else if (plan.gps) {
        File(out, name).also { src.copyTo(it, overwrite = true) }          // GPS kept: the camera's own copy
    } else {
        copyWithoutGps(src, File(out, name))
    }
    val main = made ?: return emptyList()      // never the original instead of a failed blurred copy
    if (plan.gps && c.lat != null && c.lon != null) setGps(main, c.lat!!, c.lon!!)
    val marked = if (!plan.marked) null else burnMarks(src, c.marks, File(out, name.removeSuffix(".jpg") + "_jel.jpg"))
    if (marked != null && plan.gps && c.lat != null && c.lon != null) setGps(marked, c.lat!!, c.lon!!)
    return listOfNotNull(main, marked)
}

internal fun mimeOf(f: File) = when (f.extension.lowercase()) { "mp4" -> "video/mp4"; "m4a" -> "audio/mp4"; "png" -> "image/png"; "json" -> "application/json"; else -> "image/jpeg" }

// ---- small pieces on the editor ----------------------------------------------------------------------------------------

/** "+ ugyanez még": the same purpose (and item) once more, for a few seconds after a photo. */
@Composable
internal fun AgainPill(st: EditorState, modifier: Modifier) {
    val r = st.cam2.again ?: return
    LaunchedEffect(st.cam2.againAt) { delay(9000); st.cam2.again = null }
    if (st.series || !st.cam2.on(CameraFeatures.AGAIN)) return
    val p = st.kit.purpose(r.purpose)
    val col = Color(p?.color ?: 0xFF2A8CDB)
    Row(modifier.clip(RoundedCornerShape(50)).background(Melyviz.raised).vrgBorder(1.dp, col, RoundedCornerShape(50))
        .clickable { st.cam2.again = null; st.camera = r }.padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Text("＋ ", style = Melyviz.label.copy(color = col))
        Text(p?.sym ?: "•", style = Melyviz.glyph.copy(fontSize = 16.sp, color = col))
        Text(" még", style = Melyviz.small.copy(color = Melyviz.ink))
    }
}

/** The ◉ hold menu's first part: the shot list's next missing items, then video, signature, the recent purposes. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun QuickRow(st: EditorState, close: () -> Unit) {
    val miss = remember(st.sketch, st.kit) { Camera2.nextMissing(st.kit, st.sketch) }
    if (miss.isNotEmpty() && st.cam2.on(CameraFeatures.QUICK)) {
        Text("Hiányzik", style = Melyviz.small.copy(color = Melyviz.faint))
        miss.forEach { s -> key(s.item.id) {
            val p = st.kit.purpose(s.item.purpose); val c = Color(p?.color ?: 0xFF7D8590)
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).clickable { close(); st.shoot(s.item.purpose, s.item.id) }.padding(vertical = 7.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Text(p?.sym ?: "•", style = Melyviz.glyph.copy(fontSize = 18.sp, color = c), modifier = Modifier.width(28.dp))
                Text(s.item.label, style = Melyviz.label.copy(fontSize = 13.sp), modifier = Modifier.weight(1f), maxLines = 2)
                Text("${s.have}/${s.item.need}", style = Melyviz.readout.copy(color = c))
            }
        } }
    }
    Row(Modifier.padding(vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        if (st.cam2.on(CameraFeatures.VIDEO)) BigTile("🎥", "Séta videó", Color(0xFF20A8A0)) { close(); st.shootVideo() }
        if (st.cam2.on(CameraFeatures.SIGNATURE)) BigTile("✍", "Aláírás", Color(0xFFB07A2A)) { close(); st.ask = Ask.Signature }
        if (st.cam2.on(CameraFeatures.QUICK)) Camera2.recentPurposes(st.kit, st.sketch).forEach { id -> st.kit.purpose(id)?.let { p ->
            BigTile(p.sym, p.label, Color(p.color)) { close(); st.shoot(p.id) }
        } }
    }
}

@Composable
private fun BigTile(sym: String, label: String, c: Color, onClick: () -> Unit) {
    Column(Modifier.width(66.dp).clip(RoundedCornerShape(12.dp)).vrgBorder(1.dp, c, RoundedCornerShape(12.dp)).clickable(onClick = onClick).padding(vertical = 7.dp),
        horizontalAlignment = Alignment.CenterHorizontally) {
        Text(sym, style = Melyviz.glyph.copy(fontSize = 20.sp, color = c))
        Text(label, style = Melyviz.small.copy(fontSize = 9.sp), maxLines = 2)
    }
}

/** The small symbols on a gallery thumbnail: ▶ video, ✍ signature, 👤 personal, ◐ before / after, ▤ readings waiting. */
@Composable
internal fun CaptureBadges(c: Capture, modifier: Modifier) {
    val b = buildString {
        if (c.kind == CaptureKind.VIDEO) append("▶")
        if (c.kind == CaptureKind.SIGNATURE) append("✍")
        if (c.privacy) append("👤")
        if (c.phase != null) append(if (c.phase == Camera2.AFTER) "◑" else "◐")
        if (c.ocr.any { !it.used && !it.dropped }) append("▤")
    }
    if (b.isEmpty()) return
    Text(b, style = Melyviz.small.copy(fontSize = 11.sp, color = Color.White), modifier = modifier.background(Color(0x99000000), RoundedCornerShape(4.dp)).padding(horizontal = 3.dp))
}

@Composable
private fun MiniThumb(st: EditorState, c: Capture, size: Int = 72, onClick: () -> Unit) {
    val dir = st.photoDir ?: return
    val img = thumbAny(File(dir, c.file), 240)
    Box(Modifier.size(size.dp).clip(RoundedCornerShape(8.dp)).background(Melyviz.surface).clickable(onClick = onClick)) {
        if (img != null) Image(img, contentDescription = c.id, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        CaptureBadges(c, Modifier.align(Alignment.TopStart).padding(2.dp))
        if (c.kind == CaptureKind.VIDEO) Text(Camera2.duration(c.durationMs), style = Melyviz.small.copy(fontSize = 9.sp, color = Color.White),
            modifier = Modifier.align(Alignment.BottomEnd).background(Color(0x99000000)).padding(horizontal = 3.dp))
    }
}

/** The Kamera front's Kamera 2 part: video and signature, personal photos still unblurred, readings, before / after. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun Camera2Section(st: EditorState) {
    val s = st.sketch
    Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        val vids = s.captures.count { it.kind == CaptureKind.VIDEO }; val sigs = Camera2.signatures(s).size
        if (st.cam2.on(CameraFeatures.VIDEO)) BigTile("🎥", "Séta videó" + if (vids > 0) " ($vids)" else "", Color(0xFF20A8A0)) { st.shootVideo() }
        if (st.cam2.on(CameraFeatures.SIGNATURE)) BigTile("✍", "Aláírás" + if (sigs > 0) " ($sigs)" else "", Color(0xFFB07A2A)) { st.ask = Ask.Signature }
        BigTile("⚙", "Funkciók", Melyviz.faint) { st.ask = Ask.FeatureSheet("kamera") }   // M51: the Kamera switches first
    }
    val open = Camera2.privacyOpen(s)
    if (open.isNotEmpty() && st.cam2.on(CameraFeatures.PRIVACY)) Text("👤 ${open.size} személyes fotón még nincs elmosás: koppints, ✎ Jelölés → ▦ / ▒",
        style = Melyviz.small.copy(color = Melyviz.coral), modifier = Modifier.padding(top = 8.dp).clickable { st.ask = Ask.CaptureView(open.first().id) })
    val reads = s.captures.filter { c -> c.ocr.any { !it.used && !it.dropped } }
    if ((reads.isNotEmpty() || st.cam2.reading != null) && st.cam2.on(CameraFeatures.OCR)) {
        Text("▤ Kiolvasva" + if (st.cam2.reading != null) " · olvasás…" else "", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 12.dp, bottom = 4.dp))
        reads.forEach { c -> key(c.id) {
            Row(verticalAlignment = Alignment.Top) {
                MiniThumb(st, c, 52) { st.ask = Ask.CaptureView(c.id) }
                Column(Modifier.padding(start = 8.dp).weight(1f)) { OcrChips(st, c) }
            }
        } }
    }
    val pairs = Camera2.pairs(s); val waiting = Camera2.waiting(s)
    if ((pairs.isNotEmpty() || waiting.isNotEmpty()) && st.cam2.on(CameraFeatures.PAIRS)) {
        Text("◐ Előtte / utána", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 12.dp, bottom = 4.dp))
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            pairs.forEach { (b, a) -> key(b.id + a.id) {
                Row(Modifier.clip(RoundedCornerShape(10.dp)).vrgBorder(1.dp, Melyviz.line, RoundedCornerShape(10.dp)).padding(3.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    MiniThumb(st, b, 60) { st.ask = Ask.Compare(b.id, a.id) }
                    MiniThumb(st, a, 60) { st.ask = Ask.Compare(b.id, a.id) }
                }
            } }
            waiting.forEach { b -> key(b.id) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    MiniThumb(st, b, 60) { st.ask = Ask.CaptureView(b.id) }
                    Text("◑ Utána", style = Melyviz.small.copy(fontSize = 10.sp, color = st.frontColor("kamera")), modifier = Modifier.clickable { st.shootAfter(b) }.padding(3.dp))
                }
            } }
        }
    }
}

/** A photo's readings as chips: each tap fills one answer or note line; ✕ drops the finding. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun OcrChips(st: EditorState, c: Capture) {
    val live = c.ocr.filter { !it.used && !it.dropped }
    val col = Color(0xFFC03FA8)
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        live.forEach { h ->
            TypePlate.uses(h, c.shot, c.purpose).forEach { u ->
                Pill("＋ " + u.label, col, false) { st.edit(TypePlate.apply(st.kit, st.sketch, c.id, h, u, System.currentTimeMillis())) }
            }
            Pill("✕", Melyviz.faint, false) { st.edit(TypePlate.drop(st.sketch, c.id, h)) }
        }
    }
    val used = c.ocr.filter { it.used }
    if (used.isNotEmpty()) Text("✓ " + used.joinToString(" · ") { it.value }, style = Melyviz.small.copy(fontSize = 10.sp, color = Melyviz.glow))
}

/** The photo viewer's Kamera 2 rows: reading, privacy, before / after. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun PhotoExtras(st: EditorState, c: Capture) {
    val s = st.sketch
    val cam = st.cam2
    if (cam.on(CameraFeatures.OCR)) {
    Text("▤ Adattábla, címke", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 8.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        val busy = st.cam2.reading == c.id || c.id in st.cam2.readQueue
        Pill(if (busy) "▤ Olvasás…" else if (c.ocrAt > 0) "▤ Újraolvasás" else "▤ Szöveg kiolvasása", Color(0xFFC03FA8), busy) { st.cam2.read(c.id) }
        if (c.ocrAt > 0 && c.ocr.isEmpty()) Text("nem találtam értéket", style = Melyviz.small.copy(color = Melyviz.faint))
    }
    if (c.ocr.isNotEmpty()) Box(Modifier.padding(top = 6.dp)) { Column { OcrChips(st, c) } }
    }

    Text("Adatvédelem", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 8.dp))
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (cam.on(CameraFeatures.PRIVACY)) Pill(if (c.privacy) "👤 Személyes adat" else "👤 Nincs személyes adat", Melyviz.coral, c.privacy) {
            val turningOn = !c.privacy
            st.editCapture(c.id) { it.copy(privacy = !it.privacy, keepGps = if (!it.privacy) false else it.keepGps) }
            if (turningOn && cam.on(CameraFeatures.FACES_AUTO)) cam.findFaces(c.id)
        }
        if (c.lat != null && !c.privacy && cam.on(CameraFeatures.GPS_STRIP)) Pill(if (c.keepGps) "⌖ GPS a kiadott képen marad" else "⌖ GPS kiadáskor törlődik", st.frontColor("helyszin"), c.keepGps) {
            st.editCapture(c.id) { it.copy(keepGps = !it.keepGps) }
        }
        if (cam.on(CameraFeatures.FACES)) {
            val busy = cam.finding == c.id || c.id in cam.faceQueue
            Pill(if (busy) "☺ Keresés…" else "☺ Arcok keresése", Melyviz.coral, busy) { cam.findFaces(c.id) }
        }
    }
    cam.faces[c.id]?.takeIf { it.isNotEmpty() }?.let { prop ->
        Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("☺ ${prop.size} arc", style = Melyviz.small.copy(color = Melyviz.coral))
            Pill("✓ Elmosás", Melyviz.coral, true) { st.editCapture(c.id) { it.copy(marks = it.marks + prop) }; cam.dropFaces(c.id) }
            Pill("✕", Melyviz.faint, false) { cam.dropFaces(c.id) }
        }
    }
    if (c.privacy && c.marks.none { it.kind.blur } && cam.on(CameraFeatures.BLUR)) Text("Mosd el az arcot, a házszámot, a nevet: ✎ Jelölés → ▦ téglalap / ▒ ecset.",
        style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 4.dp))

    if (!cam.on(CameraFeatures.PAIRS)) return
    Text("◐ Előtte / utána", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 8.dp))
    val partner = if (c.phase == Camera2.AFTER) s.capture(c.pair) else Camera2.afterOf(s, c.id)
    val kam = st.frontColor("kamera")
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (partner != null) Pill("◐ Összevetés", kam, true) {
            st.ask = if (c.phase == Camera2.AFTER) Ask.Compare(partner.id, c.id) else Ask.Compare(c.id, partner.id)
        }
        if (c.phase != Camera2.AFTER) Pill("◑ Utána fotó", kam, false) { st.ask = null; st.shootAfter(c) }
        if (partner == null && c.phase != Camera2.BEFORE && Camera2.beforeCandidates(s, c).isNotEmpty()) Pill("◐ Előtte-kép…", kam, false) { st.ask = Ask.PairPick(c.id) }
        if (c.phase == null) Pill("◐ Ez előtte-kép", kam, false) { st.edit(Camera2.markBefore(s, c.id)) }
        if (c.phase != null) Pill("Pár bontása", Melyviz.faint, false) { st.edit(Camera2.unpair(s, c.id)) }
    }
}

// ---- dialogs ------------------------------------------------------------------------------------------------------------

/** Choosing the before-photo of [id] among the earlier ones of its purpose (its room first). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun PairPickDialog(st: EditorState, id: String, close: () -> Unit) {
    val c = st.sketch.capture(id) ?: return close()
    val cands = Camera2.beforeCandidates(st.sketch, c)
    AlertDialog(
        onDismissRequest = close, containerColor = Melyviz.raised,
        title = { Text("◐ Melyik az előtte-kép?", style = Melyviz.label.copy(color = st.frontColor("kamera"))) },
        text = {
            FlowRow(Modifier.verticalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                cands.forEach { b -> key(b.id) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        MiniThumb(st, b, 84) { st.edit(Camera2.pair(st.sketch, id, b.id)); st.ask = Ask.Compare(b.id, id) }
                        Text(stamp(b.at), style = Melyviz.small.copy(fontSize = 9.sp))
                        st.sketch.room(b.room)?.let { Text(roomTitle(it.name, it.kinds), style = Melyviz.small.copy(fontSize = 9.sp, color = Melyviz.faint)) }
                    }
                } }
            }
        },
        confirmButton = { TextButton(close) { Text("Mégse", color = Melyviz.muted) } },
    )
}

/**
 * Before and after: the after-photo over the before, revealed up to the slider (the intent camera has no live ghost
 * overlay, so the comparison happens here), or the two side by side.
 */
@Composable
internal fun CompareDialog(st: EditorState, beforeId: String, afterId: String, close: () -> Unit) {
    val dir = st.photoDir ?: return close()
    val b = st.sketch.capture(beforeId) ?: return close()
    val a = st.sketch.capture(afterId) ?: return close()
    val bb = remember(b.file) { loadPhoto(File(dir, b.file), 1400)?.asImageBitmap() }
    val ab = remember(a.file) { loadPhoto(File(dir, a.file), 1400)?.asImageBitmap() }
    var k by remember { mutableStateOf(0.5f) }
    var side by remember { mutableStateOf(false) }
    val col = st.frontColor("kamera")
    Dialog(onDismissRequest = close, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(Modifier.fillMaxSize().background(Melyviz.abyss).verticalScroll(rememberScrollState()).padding(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("‹", style = Melyviz.title.copy(color = Melyviz.current), modifier = Modifier.clickable(onClick = close).padding(end = 12.dp))
                Text("◐ Előtte / utána", style = Melyviz.label.copy(color = col))
                Spacer(Modifier.weight(1f))
                Pill(if (side) "▯▯ Egymás mellett" else "⇹ Csúszka", col, true) { side = !side }
            }
            if (bb == null || ab == null) Text("A fotó nem olvasható.", style = Melyviz.small.copy(color = Melyviz.coral))
            else if (side) Row(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf(b to bb, a to ab).forEach { (c, img) ->
                    Column(Modifier.weight(1f)) {
                        Text((if (c === b) "Előtte · " else "Utána · ") + stamp(c.at), style = Melyviz.small.copy(fontSize = 10.sp))
                        Image(img, contentDescription = null, contentScale = ContentScale.Fit, modifier = Modifier.fillMaxWidth().aspectRatio(img.width.toFloat() / img.height))
                    }
                }
            } else {
                Box(Modifier.fillMaxWidth().aspectRatio(bb.width.toFloat() / bb.height).padding(vertical = 6.dp)) {
                    Image(bb, contentDescription = "előtte", contentScale = ContentScale.FillBounds, modifier = Modifier.fillMaxSize())
                    Image(ab, contentDescription = "utána", contentScale = ContentScale.FillBounds, modifier = Modifier.fillMaxSize()
                        .drawWithContent { clipRect(right = size.width * k) { this@drawWithContent.drawContent() } })
                    Canvas(Modifier.fillMaxSize()) { drawLine(Color.White, Offset(size.width * k, 0f), Offset(size.width * k, size.height), 2.dp.toPx()) }
                    Text("Utána", style = Melyviz.small.copy(color = Color.White), modifier = Modifier.align(Alignment.TopStart).background(Color(0x99000000)).padding(3.dp))
                    Text("Előtte", style = Melyviz.small.copy(color = Color.White), modifier = Modifier.align(Alignment.TopEnd).background(Color(0x99000000)).padding(3.dp))
                }
                Slider(value = k, onValueChange = { k = it })
                Text("Előtte " + stamp(b.at) + " · utána " + stamp(a.at), style = Melyviz.small.copy(fontSize = 10.sp, color = Melyviz.faint))
            }
            listOf(b, a).filter { it.note.isNotBlank() }.forEach { Text(it.note, style = Melyviz.small, modifier = Modifier.padding(top = 4.dp)) }
            Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Pill("Előtte-kép megnyitása", col, false) { st.ask = Ask.CaptureView(b.id) }
                Pill("Utána-kép megnyitása", col, false) { st.ask = Ask.CaptureView(a.id) }
                Pill("Pár bontása", Melyviz.faint, false) { st.edit(Camera2.unpair(st.sketch, a.id)); close() }
            }
        }
    }
}

/** A video or a signature: what it is, play / view, delete. (Photos have CaptureViewer.) */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun MediaViewer(st: EditorState, c: Capture, close: () -> Unit) {
    val ctx = LocalContext.current
    val dir = st.photoDir ?: return close()
    val f = File(dir, c.file)
    val img = remember(c.file) { loadAny(f, 1400)?.asImageBitmap() }
    val video = c.kind == CaptureKind.VIDEO
    var note by remember(c.note) { mutableStateOf(c.note) }
    LaunchedEffect(note) { delay(600); if (video && note != st.sketch.capture(c.id)?.note) st.editCapture(c.id) { it.copy(note = note) } }
    Dialog(onDismissRequest = close, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(Modifier.fillMaxSize().background(Melyviz.abyss).verticalScroll(rememberScrollState()).padding(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("‹", style = Melyviz.title.copy(color = Melyviz.current), modifier = Modifier.clickable(onClick = close).padding(end = 12.dp))
                Text(if (video) "🎥 Séta videó" else "✍ Ügyfél aláírása", style = Melyviz.label.copy(color = st.frontColor("kamera")))
                Spacer(Modifier.weight(1f))
                Text(stamp(c.at), style = Melyviz.readout)
            }
            if (img != null) Box(Modifier.fillMaxWidth().aspectRatio(img.width.toFloat() / img.height).padding(vertical = 6.dp)
                .background(if (video) Color.Black else Color.White).clickable(enabled = video) { play(ctx, f) }) {
                Image(img, contentDescription = null, contentScale = ContentScale.Fit, modifier = Modifier.fillMaxSize())
                if (video) Text("▶", style = Melyviz.glyph.copy(fontSize = 48.sp, color = Color.White), modifier = Modifier.align(Alignment.Center))
            } else Text(if (f.exists()) "Nincs előnézet." else "A fájl nincs meg.", style = Melyviz.small.copy(color = Melyviz.coral))
            if (video) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Pill("▶ Lejátszás", st.frontColor("kamera"), true) { play(ctx, f) }
                    Text(Camera2.duration(c.durationMs) + " · " + Camera2.mb(c.bytes), style = Melyviz.readout)
                }
                Camera2.videoWarning(c)?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.coral), modifier = Modifier.padding(top = 4.dp)) }
                Text("Cél", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 8.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    st.kit.purposes.filter { it.id != "szoba" }.forEach { p -> Pill(p.sym + " " + p.label, Color(p.color), c.purpose == p.id) {
                        st.editCapture(c.id) { it.copy(purpose = p.id, shot = if (st.kit.shot(it.shot)?.purpose == p.id) it.shot else null) } } }
                }
                Text("Szoba", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 8.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Pill("—", Melyviz.faint, c.room == null) { st.editCapture(c.id) { it.copy(room = null) } }
                    st.sketch.rooms.forEach { r -> Pill(roomTitle(r.name, r.kinds), st.frontColor("vazlat"), c.room == r.id) { st.editCapture(c.id) { it.copy(room = r.id) } } }
                }
                Field(note, { note = it }, "Mit mutat a videó?", lines = 2)
            } else {
                Text("Aláíró: " + c.signer.ifBlank { "—" }, style = Melyviz.label, modifier = Modifier.padding(top = 6.dp))
                Text(c.note, style = Melyviz.small, modifier = Modifier.padding(top = 4.dp))
                Text("Időpont: " + stamp(c.at), style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 4.dp))
            }
            Row(Modifier.padding(top = 8.dp)) {
                Spacer(Modifier.weight(1f))
                // UI audit 5.6: 48 dp, and the delete is undoable (st.deleteCapture says "↶ visszahozza")
                Box(Modifier.heightIn(min = 48.dp).clickable(role = androidx.compose.ui.semantics.Role.Button) { st.deleteCapture(c.id); close() }, contentAlignment = Alignment.Center) {
                    Text("Törlés", style = Melyviz.label.copy(color = Melyviz.coral))
                }
            }
            Text("Fájlnév a PC-n: " + Intake.exportName(st.sketch, c), style = Melyviz.small.copy(fontSize = 10.sp, color = Melyviz.faint))
        }
    }
}

private fun play(ctx: Context, f: File) {
    try {
        ctx.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(FileStore.uri(ctx, f), "video/mp4")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK))
    } catch (e: ActivityNotFoundException) { }
}

/**
 * The client's signature: a statement (átvétel / fotózás / both), the name, the time, a pad; saved as a PNG with the
 * name and time written under the strokes, a capture of purpose "dokumentum" (kind "signature").
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun SignaturePad(st: EditorState, close: () -> Unit) {
    var name by remember { mutableStateOf("") }
    var which by remember { mutableStateOf(0) }
    val strokes = remember { mutableStateListOf<List<Offset>>() }
    var cur by remember { mutableStateOf<List<Offset>>(emptyList()) }
    var box by remember { mutableStateOf(IntSize.Zero) }
    val px = with(LocalDensity.current) { 3.dp.toPx() }
    val col = Color(0xFFB07A2A)
    val opened = remember { System.currentTimeMillis() }
    Dialog(onDismissRequest = close, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(Modifier.fillMaxSize().background(Melyviz.abyss).verticalScroll(rememberScrollState()).padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("‹", style = Melyviz.title.copy(color = Melyviz.current), modifier = Modifier.clickable(onClick = close).padding(end = 12.dp))
                Text("✍ Ügyfél aláírása", style = Melyviz.label.copy(color = col))
                Spacer(Modifier.weight(1f))
                Text(stamp(opened), style = Melyviz.readout)
            }
            FlowRow(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("Átvétel", "Fotózás", "Mindkettő").forEachIndexed { i, l -> Pill(l, col, which == i) { which = i } }
            }
            Text(Camera2.STATEMENTS[which], style = Melyviz.small, modifier = Modifier.padding(vertical = 6.dp))
            Field(name, { name = it }, "Név")
            Box(Modifier.fillMaxWidth().height(230.dp).clip(RoundedCornerShape(10.dp)).background(Color.White).onSizeChanged { box = it }
                .pointerInput(Unit) {
                    detectDragGestures(
                        onDragStart = { o -> cur = listOf(o) },
                        onDrag = { ch, _ -> ch.consume(); cur = cur + ch.position },
                        onDragEnd = { if (cur.size > 1) strokes.add(cur); cur = emptyList() },
                        onDragCancel = { cur = emptyList() },
                    )
                }) {
                Canvas(Modifier.fillMaxSize()) {
                    (strokes + listOf(cur)).forEach { s -> for (i in 0 until s.size - 1) drawLine(Color.Black, s[i], s[i + 1], px, cap = StrokeCap.Round) }
                }
                if (strokes.isEmpty() && cur.isEmpty()) Text("Ide írjon alá", style = Melyviz.small.copy(color = Color(0xFF9AA3AD)), modifier = Modifier.align(Alignment.Center))
            }
            Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                Pill("Újra", Melyviz.faint, false) { strokes.clear() }
                Spacer(Modifier.weight(1f))
                val ok = strokes.isNotEmpty() && name.isNotBlank()
                Pill(if (ok) "✓ Mentés" else "Név és aláírás kell", if (ok) Melyviz.glow else Melyviz.faint, ok) {
                    if (!ok) return@Pill
                    val dir = st.photoDir ?: return@Pill
                    val now = System.currentTimeMillis()
                    val file = "S-" + now.toString(36) + ".png"
                    dir.mkdirs()
                    if (writeSignature(File(dir, file), strokes.toList(), box, px, name.trim() + " · " + stamp(now))) {
                        close(); st.signed(file, name, Camera2.STATEMENTS[which])
                    } else st.note = "Az aláírás nem menthető."
                }
            }
        }
    }
}

private fun writeSignature(out: File, strokes: List<List<Offset>>, box: IntSize, px: Float, caption: String): Boolean = try {
    val w = max(1, box.width); val h = max(1, box.height)
    val foot = (px * 10).toInt()
    val bmp = Bitmap.createBitmap(w, h + foot, Bitmap.Config.ARGB_8888)
    val cv = ACanvas(bmp)
    cv.drawColor(android.graphics.Color.WHITE)
    val p = Paint().apply { color = android.graphics.Color.BLACK; style = Paint.Style.STROKE; strokeWidth = px; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND; isAntiAlias = true }
    strokes.forEach { s -> if (s.size > 1) { val path = APath(); path.moveTo(s[0].x, s[0].y); s.drop(1).forEach { path.lineTo(it.x, it.y) }; cv.drawPath(path, p) } }
    val t = Paint().apply { color = android.graphics.Color.DKGRAY; textSize = px * 5; isAntiAlias = true }
    cv.drawLine(0f, h.toFloat(), w.toFloat(), h.toFloat(), Paint().apply { color = android.graphics.Color.LTGRAY; strokeWidth = 1f })
    cv.drawText(caption, px * 3, h + foot * 0.65f, t)
    out.outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    true
} catch (e: Exception) { false }

/** ⚙ → Kamera funkciók: every Kamera 2 feature on its own switch, and all at once (D-90). One setting per phone. */
@Composable
internal fun CameraFeatureSection(st: EditorState) {
    val cam = st.cam2
    Text("Kamera funkciók (minden felmérésre)", style = Melyviz.label.copy(color = st.frontColor("kamera")), modifier = Modifier.padding(top = 12.dp, bottom = 4.dp))
    VrgToggle("Mind", CameraFeatures.allOn(cam.off)) { cam.applyOff(CameraFeatures.all(it)) }
    CameraFeatures.ALL.forEach { f ->
        val need = (listOfNotNull(f.needs) + f.also).firstOrNull { !cam.on(it) }      // M52: [also] prerequisites too
        val blocked = need != null
        VrgToggle(f.sym + " " + f.label + ": " + f.blurb + if (blocked) " (előbb: " + (need?.let { CameraFeatures.of(it)?.label } ?: "") + ")" else "",
            f.id !in cam.off && !blocked) { want -> if (!blocked || !want) cam.applyOff(if (want) cam.off - f.id else cam.off + f.id) }
    }
}
