package hu.vrg.mobile.sketch.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.calculateCentroid
import androidx.compose.foundation.gestures.calculatePan
import androidx.compose.foundation.gestures.calculateZoom
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.PointerEvent
import androidx.compose.ui.input.pointer.PointerInputScope
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.files.FileStore
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.sketch.Geo
import hu.vrg.mobile.sketch.Level
import hu.vrg.mobile.sketch.MeasureKind
import hu.vrg.mobile.sketch.Intake
import hu.vrg.mobile.sketch.Photos
import hu.vrg.mobile.sketch.PointState
import hu.vrg.mobile.sketch.PointType
import hu.vrg.mobile.sketch.Pt
import hu.vrg.mobile.sketch.SizeStatus
import hu.vrg.mobile.sketch.Sketch
import hu.vrg.mobile.sketch.Tools
import hu.vrg.mobile.sketch.Wheels
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.io.File

/** The palette the canvas draws with, read once per composition (DrawScope is not composable). */
internal data class Pal(
    val abyss: Color, val surface: Color, val raised: Color, val line: Color, val ink: Color, val muted: Color,
    val faint: Color, val glow: Color, val sand: Color, val coral: Color, val current: Color, val onGlow: Color,
)

@Composable
internal fun pal() = Pal(
    Melyviz.abyss, Melyviz.surface, Melyviz.raised, Melyviz.line, Melyviz.ink, Melyviz.muted,
    Melyviz.faint, Melyviz.glow, Melyviz.sand, Melyviz.coral, Melyviz.current, Melyviz.onGlow,
)

private const val HOLD_MS = 420L
private val WHEEL_R = 112.dp
private val WHEEL_HUB = 34.dp

@Composable
fun SketchEditor(initial: Sketch, host: FeatureHost, onClose: () -> Unit) {
    val store = SketchFeature.store
    val ctx = LocalContext.current
    val st = remember(initial.id) { EditorState(initial) {} }
    LaunchedEffect(initial.id) { SketchFeature.takeFront(initial.id)?.let { st.front = it } }   // F1: back from the map on Helyszín
    var showNorm by remember { mutableStateOf(false) }

    // the photos (Fotópont M25, captures M29) live with the survey (files/sketch/photos/<id>/); the camera app takes them
    val dir = remember(initial.id) { store.photoDir(initial.id) }
    st.photoDir = dir
    st.dropFile = { name -> File(dir, name).delete() }
    var shooting by remember { mutableStateOf<Pair<CameraReq, String>?>(null) }
    val shoot = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        val (req, name) = shooting ?: return@rememberLauncherForActivityResult
        shooting = null
        val f = File(dir, name)
        if (ok && f.length() > 0) {
            if (req.photo != null) st.photoTaken(req, name)
            else {
                val ll = exifLatLon(f)
                st.captureTaken(req, name, ll?.first, ll?.second)
                if (st.series) st.camera = req            // Sorozat: straight back to the camera, same purpose
            }
        } else { f.delete(); st.note = if (st.series && req.photo == null) "Sorozat vége." else "Nem készült fotó." }
    }
    fun startCamera(req: CameraReq) {
        dir.mkdirs()
        val name = (req.photo ?: "C") + "-" + System.currentTimeMillis().toString(36) + ".jpg"
        shooting = req to name
        try { shoot.launch(FileStore.uri(ctx, File(dir, name))) } catch (e: Exception) { shooting = null; host.note("Nincs kamera alkalmazás.") }
    }
    var waiting by remember { mutableStateOf<CameraReq?>(null) }
    val askCamera = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        val r = waiting; waiting = null
        if (ok && r != null) startCamera(r) else if (!ok) host.note("A fotóhoz kamera engedély kell.")
    }
    LaunchedEffect(st.camera) {
        val r = st.camera ?: return@LaunchedEffect
        st.camera = null
        if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) startCamera(r)
        else { waiting = r; askCamera.launch(Manifest.permission.CAMERA) }
    }

    // saved half a second after the last edit, and once more on the way out
    LaunchedEffect(st.sketch) { delay(500); withContext(Dispatchers.IO) { store.save(st.sketch) } }
    DisposableEffect(initial.id) {
        onDispose {
            store.save(st.sketch)
            // files no longer in the survey (retaken, deleted, a shot never given a direction) go when leaving it:
            // undo can still bring one back while the survey is open
            val keep = Intake.files(st.sketch)
            dir.listFiles()?.forEach { if (it.name !in keep && it.name != shooting?.second) it.delete() }
        }
    }
    LaunchedEffect(st.note) { if (st.note != null) { delay(4500); st.note = null } }

    BackHandler {
        when {
            showNorm -> showNorm = false
            st.noteOpen -> st.noteOpen = false
            st.wheel != null -> st.closeWheel()
            st.pendingShot != null -> st.cancelShot()
            st.lineDraft.isNotEmpty() -> st.lineDrop()
            st.front != "vazlat" -> st.front = "vazlat"
            else -> onClose()
        }
    }

    if (showNorm) { NormScreen(st, host) { showNorm = false }; SketchDialogs(st); return }

    val sh = remember(st.sketch, st.kit, st.norm) { Shadow(st) }
    Column(Modifier.fillMaxSize().background(Melyviz.abyss)) {
        TopBar(st, onClose) { showNorm = true }
        FrontBar(st, sh)
        Box(Modifier.weight(1f).fillMaxWidth()) {
            when (st.front) {
                "jegyzet" -> NotesFront(st, sh)
                "munkakor" -> ScopeFront(st)
                "kerdes" -> QuestionsFront(st, sh)
                "kamera" -> CameraFront(st, sh)
                "helyszin" -> SiteFront(st)
                "nyitott" -> OpenFront(st, sh)
                else -> {
                    SketchCanvas(st)
                    Column(Modifier.padding(horizontal = 10.dp, vertical = 6.dp)) {
                        Text(st.hint(st.tool), style = Melyviz.small.copy(color = Melyviz.faint, fontSize = 10.sp), maxLines = 2)
                        st.note?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 2.dp)) }
                    }
                }
            }
            CaptureButtons(st, Modifier.align(Alignment.BottomEnd))
        }
        if (st.front == "vazlat") { ToolOptions(st); ToolRail(st) }
    }
    if (st.noteOpen) QuickNote(st)
    SketchDialogs(st)
}

/** The photo's own position (camera apps write it when location tagging is on); null when it has none. */
@Suppress("DEPRECATION")
private fun exifLatLon(f: File): Pair<Double, Double>? = try {
    val out = FloatArray(2)
    if (android.media.ExifInterface(f.path).getLatLong(out)) out[0].toDouble() to out[1].toDouble() else null
} catch (e: Exception) { null }

@Composable
private fun TopBar(st: EditorState, onClose: () -> Unit, onNorm: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().background(Melyviz.deep).padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text("‹", style = Melyviz.title.copy(color = Melyviz.current), modifier = Modifier.clickable(onClick = onClose).padding(horizontal = 6.dp))
        Text(
            st.sketch.name.ifBlank { "Névtelen felmérés" }, style = Melyviz.label, maxLines = 1, overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f).clickable { st.ask = Ask.SketchName },
        )
        // the variant toggle in the corner (WP M31): its symbol in its colour while on, grey for the original
        SketcherKit.variant(st.sketch.variant)?.let { v ->
            val on = st.sketch.variantOn
            Text(if (on) v.sym else "◐", style = Melyviz.glyph.copy(fontSize = 17.sp, color = if (on) Color(v.color) else Melyviz.faint),
                modifier = Modifier.clip(RoundedCornerShape(50)).border(1.dp, if (on) Color(v.color) else Melyviz.line, RoundedCornerShape(50))
                    .clickable { st.toggleVariant() }.padding(horizontal = 8.dp, vertical = 2.dp)
                    .semantics { contentDescription = (if (on) v.name else "Eredeti") + ": váltás" })
        }
        VrgChip(st.sketch.level.label) { st.setLevel(Level.entries[(st.sketch.level.ordinal + 1) % Level.entries.size]) }
        Text("↶", style = Melyviz.title.copy(color = if (st.canUndo) Melyviz.ink else Melyviz.faint),
            modifier = Modifier.clickable(enabled = st.canUndo) { st.undo() }.padding(horizontal = 4.dp))
        Text("↷", style = Melyviz.title.copy(color = if (st.canRedo) Melyviz.ink else Melyviz.faint),
            modifier = Modifier.clickable(enabled = st.canRedo) { st.redo() }.padding(horizontal = 4.dp))
        Text("⚙", style = Melyviz.title, modifier = Modifier.clickable { st.ask = Ask.PluginSheet }.padding(horizontal = 4.dp))
        VrgChip("Rendezés ›", selected = true, onClick = onNorm)
    }
}

// ---- the canvas -------------------------------------------------------------------------------------------------------

@Composable
private fun SketchCanvas(st: EditorState) {
    val tm = rememberTextMeasurer()
    val c = pal()
    st.density = LocalDensity.current.density
    var fitted by remember { mutableStateOf(false) }
    Canvas(
        Modifier.fillMaxSize()
            .onGloballyPositioned {
                st.canvasOrigin = it.positionInRoot()
                st.canvasSize = Size(it.size.width.toFloat(), it.size.height.toFloat())
                if (!fitted && it.size.width > 0) { fitted = true; if (!st.sketch.isEmpty) st.fit(it.size.width.toFloat(), it.size.height.toFloat()) }
            }
            .pointerInput(st) { sketchGestures(st) },
    ) { drawSketch(st, tm, c) }
}

/** One finger: tap, drag (after the touch slop) or hold (420 ms without moving: the wheel). Two: pan + pinch. */
private suspend fun PointerInputScope.sketchGestures(st: EditorState) {
    val slop = viewConfiguration.touchSlop
    val wheelR = WHEEL_R.toPx()
    val hub = WHEEL_HUB.toPx()
    awaitEachGesture {
        val down = awaitFirstDown(requireUnconsumed = false)
        val start = down.position
        val t0 = down.uptimeMillis
        var mode = 0                         // 0 undecided · 1 drag · 2 hold · 3 two fingers
        var last = start
        while (true) {
            val ev: PointerEvent? = if (mode == 0) {
                val left = HOLD_MS - ((currentEvent.changes.firstOrNull()?.uptimeMillis ?: t0) - t0)
                if (left <= 0) null else withTimeoutOrNull(left) { awaitPointerEvent() }
            } else awaitPointerEvent()
            if (ev == null) {
                mode = 2
                st.onHold(start, size.width.toFloat(), size.height.toFloat(), wheelR)
                continue
            }
            val pressed = ev.changes.count { it.pressed }
            if (pressed >= 2 || mode == 3) {
                if (mode == 1) st.onCancel()
                if (mode == 2) st.closeWheel()
                mode = 3
                if (pressed >= 2) st.onTransform(ev.calculateCentroid(useCurrent = true), ev.calculatePan(), ev.calculateZoom())
                ev.changes.forEach { it.consume() }
                if (pressed == 0) break
                continue
            }
            val ch = ev.changes.firstOrNull { it.id == down.id } ?: ev.changes.first()
            if (!ch.pressed) {
                when (mode) {
                    0 -> st.onTap(start)
                    1 -> st.onDragEnd(ch.position)
                    2 -> st.onHoldEnd()
                }
                break
            }
            val p = ch.position
            if (mode == 0 && (p - start).getDistance() > slop) {
                mode = 1
                st.onDragStart(start)
                st.onDrag(p, p - start)
            } else if (mode == 1) st.onDrag(p, p - last)
            else if (mode == 2) st.onHoldMove(p, hub)
            last = p
            ch.consume()
        }
    }
}

private fun DrawScope.label(
    tm: TextMeasurer, text: String, at: Offset, color: Color, size: TextUnit = 11.sp,
    bg: Color? = null, border: Color? = null, bold: Boolean = false, center: Boolean = true,
) {
    if (text.isEmpty()) return
    val lay = tm.measure(text, TextStyle(color = color, fontSize = size, fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal))
    val w = lay.size.width.toFloat(); val h = lay.size.height.toFloat()
    val tl = if (center) Offset(at.x - w / 2, at.y - h / 2) else at
    val padX = 4.dp.toPx(); val padY = 1.5.dp.toPx()
    if (bg != null) drawRoundRect(bg, Offset(tl.x - padX, tl.y - padY), Size(w + 2 * padX, h + 2 * padY), CornerRadius(5.dp.toPx()))
    if (border != null) drawRoundRect(border, Offset(tl.x - padX, tl.y - padY), Size(w + 2 * padX, h + 2 * padY), CornerRadius(5.dp.toPx()), style = Stroke(1.dp.toPx()))
    drawText(lay, topLeft = tl)
}

private fun mm(v: Double) = "%.2f".format(v / 1000).replace('.', ',')

private fun DrawScope.drawSketch(st: EditorState, tm: TextMeasurer, c: Pal) {
    val s = st.sketch
    val n = st.norm
    fun P(p: Pt) = st.toScreen(p)
    fun path(pts: List<Pt>, close: Boolean) = Path().apply {
        pts.forEachIndexed { i, p -> val o = P(p); if (i == 0) moveTo(o.x, o.y) else lineTo(o.x, o.y) }
        if (close) close()
    }
    val dash = PathEffect.dashPathEffect(floatArrayOf(10.dp.toPx(), 6.dp.toPx()))

    // the paper: a faint 40-unit grid while it is not too dense
    val step = 40f * st.zoom * density
    if (step >= 16f) {
        var x = st.pan.x % step; while (x < size.width) { drawLine(c.line.copy(alpha = 0.25f), Offset(x, 0f), Offset(x, size.height), 1f); x += step }
        var y = st.pan.y % step; while (y < size.height) { drawLine(c.line.copy(alpha = 0.25f), Offset(0f, y), Offset(size.width, y), 1f); y += step }
    }

    // rooms, with the solved size: measured / derived in the glow colour, a guess with ≈ in coral
    s.rooms.forEach { r ->
        val p = path(r.poly, true)
        drawPath(p, c.surface.copy(alpha = 0.6f))
        drawPath(p, c.ink, style = Stroke(2.dp.toPx()))
        val nr = n.room(r.id)
        val ctr = P(Geo.centroid(r.poly))
        label(tm, roomTitle(r.name, r.kinds), ctr - Offset(0f, 9.dp.toPx()), c.ink, 12.sp, bold = true)
        if (nr != null && nr.poly.size >= 3) {
            val (lo, hi) = Geo.bbox(nr.poly)
            val guess = nr.inferred
            label(tm, (if (guess) "≈ " else "") + mm(hi.x - lo.x) + " × " + mm(hi.y - lo.y) + " m", ctr + Offset(0f, 8.dp.toPx()),
                if (guess) c.coral else c.glow, 10.sp)
            // the guessed walls of this room, dashed in coral on top of the outline
            if (guess && nr.poly.size == r.poly.size) nr.edges.forEachIndexed { k, e ->
                if (e == SizeStatus.INFERRED) { val (a, b) = Geo.edge(r.poly, k); drawLine(c.coral, P(a), P(b), 3.dp.toPx(), pathEffect = dash) }
            }
        }
    }
    // sizes taken on site, on their wall
    s.measures.forEach { m ->
        val r = s.room(m.room) ?: return@forEach
        when (m.kind) {
            MeasureKind.EDGE -> if (m.edge in r.poly.indices) {
                val (a, b) = Geo.edge(r.poly, m.edge)
                val at = P(Geo.lerp(a, b, 0.5)) + Offset(Geo.inward(r.poly, m.edge).x.toFloat(), Geo.inward(r.poly, m.edge).y.toFloat()) * 14.dp.toPx()
                label(tm, "${m.mm}", at, c.sand, 10.sp, bg = c.abyss.copy(alpha = 0.7f), bold = true)
            }
            MeasureKind.WIDTH -> { val (lo, hi) = Geo.bbox(r.poly); label(tm, "↔ ${m.mm}", P(Pt((lo.x + hi.x) / 2, lo.y)) + Offset(0f, 12.dp.toPx()), c.sand, 10.sp, bold = true) }
            MeasureKind.DEPTH -> { val (lo, hi) = Geo.bbox(r.poly); label(tm, "↕ ${m.mm}", P(Pt(lo.x, (lo.y + hi.y) / 2)) + Offset(24.dp.toPx(), 0f), c.sand, 10.sp, bold = true) }
        }
    }
    // open lineouts
    s.lines.forEach { l -> drawPath(path(l.pts, false), c.muted, style = Stroke(2.dp.toPx(), pathEffect = dash)) }

    // nyomvonal: dash-dot in its circuit's colour
    val dashDot = PathEffect.dashPathEffect(floatArrayOf(12.dp.toPx(), 4.dp.toPx(), 2.dp.toPx(), 4.dp.toPx()))
    s.routes.forEach { r ->
        val col = s.circuit(r.circuit)?.let { Color(it.color) } ?: c.current
        drawPath(path(r.pts, false), col, style = Stroke(3.dp.toPx(), pathEffect = dashDot))
    }
    // Bekötés: each circuit's thin link from its Elosztó to its nearest point
    s.circuits.forEach { k ->
        val b = s.point(k.board) ?: return@forEach
        val near = k.members.mapNotNull { s.point(it) }.minByOrNull { it.at.dist(b.at) } ?: return@forEach
        drawLine(Color(k.color).copy(alpha = 0.7f), P(b.at), P(near.at), 1.5.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 4.dp.toPx())))
        label(tm, k.name, (P(b.at) + P(near.at)) / 2f, Color(k.color), 9.sp, bg = c.abyss.copy(alpha = 0.7f))
    }

    // points: planned in the glow colour, existing in sand; the circuit as a ring; the Elosztó as a square
    val circuitTool = st.tool.id == Tools.CIRCUIT.id
    s.points.forEach { p ->
        val o = P(p.at)
        val k = s.circuitOf(p.id)
        if (k != null) drawCircle(Color(k.color), (if (circuitTool && k.id == st.activeCircuit) 15 else 13).dp.toPx(), o, style = Stroke((if (circuitTool && k.id == st.activeCircuit) 4 else 3).dp.toPx()))
        val fill = if (p.state == PointState.EXISTING) c.sand else c.glow
        if (p.type == PointType.BOARD) {
            val h = 11.dp.toPx()
            drawRoundRect(c.coral, Offset(o.x - h, o.y - h), Size(2 * h, 2 * h), CornerRadius(3.dp.toPx()))
            drawRoundRect(fill, Offset(o.x - h, o.y - h), Size(2 * h, 2 * h), CornerRadius(3.dp.toPx()), style = Stroke(2.dp.toPx()))
        } else {
            drawCircle(fill, 10.dp.toPx(), o)
            if (p.state == PointState.EXISTING) drawCircle(c.abyss, 10.dp.toPx(), o, style = Stroke(1.5.dp.toPx()))
        }
        label(tm, p.type.glyph, o, c.abyss, 11.sp, bold = true)
    }

    // memos: a small card, tied to their record with a thin line
    s.memos.forEach { m ->
        val o = P(m.at)
        s.anchorOf(m.target)?.let { a -> drawLine(c.faint, P(a), o, 1.dp.toPx()) }
        val t = if (m.text.length > 26) m.text.take(25) + "…" else m.text
        label(tm, "✎ " + t, o, c.ink, 10.sp, bg = c.raised, border = c.sand)
    }
    // tags: pills under their record, or loose on the paper
    s.tagUses.groupBy { it.target }.forEach { (target, uses) ->
        if (target == null) uses.forEach { u ->
            val t = s.tag(u.tag) ?: return@forEach
            u.at?.let { label(tm, "#" + t.name, P(it), Color.White, 9.sp, bg = Color(t.color), bold = true) }
        } else {
            val a = s.anchorOf(target) ?: return@forEach
            uses.forEachIndexed { i, u ->
                val t = s.tag(u.tag) ?: return@forEachIndexed
                label(tm, "#" + t.name, P(a) + Offset(16.dp.toPx(), (16 + i * 15).dp.toPx()), Color.White, 9.sp, bg = Color(t.color), bold = true, center = false)
            }
        }
    }

    // photo points (M25): a wedge per side, filled where a photo faces it; all four lit while a shot waits
    s.photos.forEach { f ->
        val o = P(f.at)
        val waiting = st.pendingShot?.first == f.id
        val rr = 27.dp.toPx(); val sw = 15.dp.toPx()
        Photos.DIRS.forEach { d ->
            val has = Photos.shot(f, d) != null
            val col = when { waiting -> c.sand.copy(alpha = 0.75f); has -> c.glow.copy(alpha = 0.8f); else -> c.line.copy(alpha = 0.55f) }
            drawArc(col, d - 90f - 38f, 76f, false, Offset(o.x - rr, o.y - rr), Size(2 * rr, 2 * rr), style = Stroke(sw))
            val (dx, dy) = Wheels.dirOf(d / 45)
            label(tm, Photos.label(d), o + Offset(dx.toFloat(), dy.toFloat()) * rr, if (has && !waiting) c.abyss else c.ink, 8.sp, bold = true)
        }
        drawCircle(c.coral, 10.dp.toPx(), o)
        label(tm, "◉", o, c.abyss, 11.sp, bold = true)
        if (waiting) label(tm, "Húzz arra, amerre a kép néz", o + Offset(0f, 48.dp.toPx()), c.sand, 11.sp, bg = c.abyss.copy(alpha = 0.85f), bold = true)
    }

    // what is being drawn right now
    st.dragRect?.let { (a, b) ->
        val r = Geo.rect(a, b); val p = path(r, true)
        val frame = st.tool.id == Tools.CIRCUIT.id
        drawPath(p, (if (frame) c.current else c.glow).copy(alpha = 0.15f))
        drawPath(p, if (frame) c.current else c.glow, style = Stroke(2.dp.toPx(), pathEffect = dash))
    }
    if (st.stroke.size >= 2) drawPath(path(st.stroke, false), c.current, style = Stroke(3.dp.toPx()))
    if (st.lineDraft.isNotEmpty()) {
        drawPath(path(st.lineDraft, false), c.glow, style = Stroke(2.5.dp.toPx()))
        st.lineDraft.forEachIndexed { i, p -> drawCircle(if (i == 0) c.coral else c.glow, (if (i == 0) 7 else 4).dp.toPx(), P(p)) }
    }

    // a tag on its way from the tray
    st.tagDrag?.let { (id, o) -> s.tag(id)?.let { label(tm, "#" + it.name, o, Color.White, 12.sp, bg = Color(it.color), bold = true) } }

    // the wheel
    st.wheel?.let { w -> drawWheel(w, tm, c) }
}

private fun DrawScope.drawWheel(w: WheelUi, tm: TextMeasurer, c: Pal) {
    val r = WHEEL_R.toPx(); val hub = WHEEL_HUB.toPx()
    drawCircle(c.abyss.copy(alpha = 0.94f), r, w.center)
    drawCircle(c.line, r, w.center, style = Stroke(1.5.dp.toPx()))
    val ring = w.wheel.rings[w.ring]
    ring.forEachIndexed { i, item ->
        val (dx, dy) = Wheels.dirOf(i)
        val at = w.center + Offset(dx.toFloat(), dy.toFloat()) * (r * 0.66f)
        if (item == null) { drawCircle(c.line.copy(alpha = 0.3f), 3.dp.toPx(), at); return@forEachIndexed }
        val sel = w.sel == i
        drawCircle(if (sel) c.glow else c.surface, 25.dp.toPx(), at)
        val col = item.color?.let { Color(it) } ?: if (sel) c.onGlow else c.ink
        label(tm, item.glyph, at - Offset(0f, 7.dp.toPx()), col, 15.sp, bold = true)
        label(tm, item.label, at + Offset(0f, 11.dp.toPx()), if (sel) c.onGlow else c.muted, 8.sp)
    }
    drawCircle(c.raised, hub, w.center)
    label(tm, if (w.wheel.rings.size > 1) "${w.wheel.title} ${w.ring + 1}/${w.wheel.rings.size}" else w.wheel.title, w.center, c.ink, 8.sp, bold = true)
}

// ---- the bars under the canvas ---------------------------------------------------------------------------------------

@Composable
private fun ToolRail(st: EditorState) {
    Row(
        Modifier.fillMaxWidth().background(Melyviz.deep).horizontalScroll(rememberScrollState()).padding(horizontal = 4.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        st.rail.forEach { t ->
            val on = t == st.tool
            Column(
                Modifier.width(58.dp).height(54.dp).clip(RoundedCornerShape(Melyviz.radiusSmall))
                    .background(if (on) Melyviz.glow else Melyviz.surface)
                    .border(1.dp, if (on) Melyviz.glow else Melyviz.line, RoundedCornerShape(Melyviz.radiusSmall))
                    .clickable { st.pick(t) },
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center,
            ) {
                Text(t.glyph, style = Melyviz.glyph.copy(fontSize = 19.sp, color = if (on) Melyviz.onGlow else Melyviz.ink))
                Text(t.label, style = Melyviz.small.copy(fontSize = 10.sp, color = if (on) Melyviz.onGlow else Melyviz.muted), maxLines = 1)
            }
        }
    }
}

@Composable
private fun OptionRow(content: @Composable () -> Unit) {
    Row(
        Modifier.fillMaxWidth().background(Melyviz.surface).horizontalScroll(rememberScrollState()).padding(horizontal = 8.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically,
    ) { content() }
}

@Composable
private fun ToolOptions(st: EditorState) {
    when (st.tool.id) {
        Tools.POINT.id -> OptionRow {
            PointState.entries.forEach { s -> VrgChip(s.label, selected = st.pointState == s) { st.pointState = s } }
            Text("·", style = Melyviz.small)
            // a variant's own devices first (type + tags under its label), then the plain types
            st.variant?.pointPresets?.forEach { pr -> VrgChip(pr.glyph + " " + pr.label, selected = st.preset == pr) { st.preset = if (st.preset == pr) null else pr } }
            val order = st.variant?.pointRing?.map { PointType.of(it) } ?: emptyList()
            (order + listOf(PointType.SOCKET, PointType.SWITCH, PointType.LIGHT, PointType.JUNCTION, PointType.DATA, PointType.FIXED, PointType.SENSOR, PointType.POINT))
                .distinct().filter { it != PointType.BOARD }
                .forEach { t -> VrgChip(t.glyph + " " + t.label, selected = st.preset == null && st.pointType == t) { st.preset = null; st.pointType = t } }
        }
        Tools.TEMPLATE.id -> OptionRow {
            val shapes = st.kit.templates
            if (shapes.isEmpty()) Text("Nincs sablon.", style = Melyviz.small)
            shapes.forEach { t -> VrgChip(t.sym + " " + t.label, selected = (st.template ?: shapes.first()) == t) { st.template = t } }
        }
        Tools.BOARD.id -> OptionRow {
            PointState.entries.forEach { s -> VrgChip(s.label, selected = st.pointState == s) { st.pointState = s } }
            VrgChip("⚡ Bekötés", selected = true) { st.connect() }
            Text("${st.sketch.boards.size} Elosztó · ${st.sketch.circuits.count { it.board != null }}/${st.sketch.circuits.size} kör bekötve", style = Melyviz.small)
        }
        Tools.CIRCUIT.id -> OptionRow {
            st.sketch.circuits.forEach { k ->
                val on = k.id == st.activeCircuit
                Row(
                    Modifier.clip(RoundedCornerShape(50)).background(if (on) Color(k.color) else Melyviz.raised)
                        .border(2.dp, Color(k.color), RoundedCornerShape(50))
                        .clickable { if (on) st.ask = Ask.CircuitEdit(k.id) else st.activeCircuit = k.id }
                        .padding(horizontal = 10.dp, vertical = 5.dp),
                ) {
                    Text("${k.name} · ${k.members.size}" + (if (k.board != null) " ⚡" else ""), style = Melyviz.label.copy(fontSize = 11.sp, color = if (on) Color.White else Melyviz.ink))
                }
            }
            VrgChip("＋ Új kör") { st.newCircuit() }
            VrgChip("⚡ Bekötés") { st.connect() }
        }
        Tools.LINE.id -> OptionRow {
            Text("${st.lineDraft.size} pont", style = Melyviz.small)
            VrgChip("↶ Pont") { st.lineBack() }
            VrgChip("Kész: nyitott vonal") { st.lineDone() }
            VrgChip("Elvet") { st.lineDrop() }
        }
        Tools.TAG.id -> TagTray(st)
        Tools.PHOTO.id -> OptionRow {
            val ps = st.sketch.photos
            Text("${ps.size} fotópont · ${ps.sumOf { it.shots.size }} fotó · ${ps.count { Photos.missing(it).isEmpty() }} kész szoba", style = Melyviz.small)
        }
        else -> {}
    }
    if (st.pendingShot != null) OptionRow {
        Text("A fotó iránya: húzz a pontból É / K / D / Ny felé.", style = Melyviz.small.copy(color = Melyviz.sand))
        VrgChip("Elvet") { st.cancelShot() }
    }
}

/** The tag tray: tap a tag to make it the brush, or drag it straight onto the sketch. */
@Composable
private fun TagTray(st: EditorState) {
    OptionRow {
        st.sketch.tags.forEach { t -> key(t.id) {
            var origin by remember { mutableStateOf(Offset.Zero) }
            var at by remember { mutableStateOf(Offset.Zero) }
            val on = st.activeTag == t.id
            Text(
                "#" + t.name,
                style = Melyviz.label.copy(fontSize = 11.sp, color = Color.White),
                modifier = Modifier
                    .onGloballyPositioned { origin = it.positionInRoot() }
                    .pointerInput(t.id) {
                        detectDragGestures(
                            onDragStart = { off -> at = origin + off - st.canvasOrigin; st.tagDrag = t.id to at },
                            onDrag = { ch, d -> ch.consume(); at += d; st.tagDrag = t.id to at },
                            onDragEnd = {
                                st.tagDrag = null
                                if (at.y in 0f..st.canvasSize.height && at.x in 0f..st.canvasSize.width) st.dropTag(t.id, at)
                            },
                            onDragCancel = { st.tagDrag = null },
                        )
                    }
                    .clip(RoundedCornerShape(50)).background(Color(t.color))
                    .border(if (on) 2.dp else 0.dp, if (on) Melyviz.ink else Color(t.color), RoundedCornerShape(50))
                    .clickable { st.activeTag = if (on) null else t.id }
                    .padding(horizontal = 10.dp, vertical = 5.dp),
            )
        } }
        VrgChip("＋ Új címke") { st.ask = Ask.TagPick(null, null) }
    }
}
