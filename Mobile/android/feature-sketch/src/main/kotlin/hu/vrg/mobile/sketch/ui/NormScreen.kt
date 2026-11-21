package hu.vrg.mobile.sketch.ui

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.files.FileStore
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.sketch.Geo
import hu.vrg.mobile.sketch.Intake
import hu.vrg.mobile.sketch.Norm
import hu.vrg.mobile.sketch.Photos
import hu.vrg.mobile.sketch.PlanView
import hu.vrg.mobile.sketch.PlannerExport
import hu.vrg.mobile.sketch.PointState
import hu.vrg.mobile.sketch.PointType
import hu.vrg.mobile.sketch.Pt
import hu.vrg.mobile.sketch.SizeStatus
import hu.vrg.mobile.sketch.Sketch
import hu.vrg.mobile.sketch.SketchJson
import hu.vrg.mobile.sketch.Takeoff
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.math.min
import kotlin.math.roundToInt

// Rendezés: the sketch as the Planner will get it. The solver's plan in millimetres, every wall coloured by how its
// size is known (mért = measured on site, számolt = follows from other sizes, ≈ becsült = took the sketch's
// proportions), the solver's report (contradicting sizes, slanted walls), and the export: one .vsketch.json package
// that the Planner opens with "Terv betöltése fájlból" (Planner src/08ca-sketch-import.js).

private const val MIME = "application/json"

/**
 * The package, and (WP M25, D-25 = A) every photo as its own file under the name the package gives it, ready to
 * share: Átadás's "PC-re" puts each one on the PC board. Returns the files with their types, the package first.
 */
private suspend fun writeExport(ctx: Context, s: Sketch, n: Norm): List<Pair<File, String>> = withContext(Dispatchers.IO) {
    val out = FileStore.cacheDir(ctx, "sketch")
    out.listFiles()?.forEach { if (it.name.endsWith(".jpg") || it.name.endsWith(".mp4") || it.name.endsWith(".png")) it.delete() }   // the last export's copies
    val pkg = File(out, SketchJson.fileStem(s) + ".vsketch.json")
    val strip = hu.vrg.mobile.sketch.CameraFeatures.on(CameraPrefs.off(ctx), hu.vrg.mobile.sketch.CameraFeatures.GPS_STRIP)   // D-90 switch
    // WP M47: the takeoff goes inside the package (the Planner keeps it with the job) and beside it, for the Workflow Kit
    val tk = SketcherKit.rules?.let { Takeoff.build(SketcherKit.forSketch(s), it, s, PlanView.of(s, n), impliedDedicated = SketcherKit.impliedDedicated) }
    val pj = PlannerExport.build(s, n)
    tk?.let { pj.put("takeoff", it.json) }
    pkg.writeText(pj.toString(1))
    val tkFiles = if (tk == null) emptyList() else Takeoff.fileNames(s).let { (jn, mn) ->
        listOf(File(out, jn).also { it.writeText(tk.json.toString(1) + "\n") } to MIME, File(out, mn).also { it.writeText(Takeoff.markdown(tk.json)) } to "text/markdown")
    }
    val photos = PlannerExport.photoFiles(s).mapNotNull { (local, name) ->
        val src = File(SketchFeature.store.photoDir(s.id), local)
        if (!src.exists()) null else if (!strip) File(out, name).also { src.copyTo(it, overwrite = true) }
        else copyWithoutGps(src, File(out, name))      // Kamera 2 (D-57): no GPS leaves the phone by default
    }
    // the purpose photos (WP M29), each under its board name; a photo with markup also goes burned in (…_jel.jpg)
    val caps = s.captures.flatMap { c ->
        // Kamera 2 (D-57): blur burned in, GPS removed unless kept, videos and signatures as they are
        exportCapture(s, c, File(SketchFeature.store.photoDir(s.id), c.file), out, strip)
    }
    listOf(pkg to MIME) + tkFiles + (photos + caps).map { it to mimeOf(it) }
}

internal fun shareAll(ctx: Context, files: List<Pair<File, String>>) {
    if (files.size == 1) { ctx.startActivity(FileStore.shareIntent(ctx, files[0].first, files[0].second, "Vázlat küldése")); return }
    val uris = ArrayList<Uri>(files.map { FileStore.uri(ctx, it.first) })
    val send = Intent(Intent.ACTION_SEND_MULTIPLE).setType("*/*")
        .putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    send.clipData = ClipData.newRawUri(null, uris[0]).apply { uris.drop(1).forEach { addItem(ClipData.Item(it)) } }
    ctx.startActivity(Intent.createChooser(send, "Vázlat küldése").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
}

@Composable
internal fun NormScreen(st: EditorState, host: FeatureHost, onBack: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val n = st.norm
    val rep = n.report
    var done by remember { mutableStateOf<String?>(null) }
    val tm = rememberTextMeasurer()
    val c = pal()

    Column(Modifier.fillMaxSize().background(Melyviz.abyss)) {
        Column(Modifier.fillMaxWidth().background(Melyviz.deep).padding(horizontal = 12.dp, vertical = 8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("‹ Vázlat", style = Melyviz.label.copy(color = Melyviz.current), modifier = Modifier.clickable(onClick = onBack).padding(end = 12.dp))
                Text("RENDEZÉS", style = Melyviz.title.copy(fontSize = 18.sp))
            }
            Text("${rep.measured} mért · ${rep.derived} számolt · ${rep.inferred} becsült fal · lépték ${rep.scaleX.roundToInt()} mm / egység",
                style = Melyviz.small, modifier = Modifier.padding(top = 4.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(top = 2.dp)) {
                Text("━ mért", style = Melyviz.small.copy(color = Melyviz.ink))
                Text("━ számolt", style = Melyviz.small.copy(color = Melyviz.glow))
                Text("┅ ≈ becsült", style = Melyviz.small.copy(color = Melyviz.coral))
            }
        }
        if (rep.conflicts.isNotEmpty() || rep.warnings.isNotEmpty()) {
            Column(Modifier.fillMaxWidth().heightIn(max = 110.dp).verticalScroll(rememberScrollState()).padding(horizontal = 12.dp, vertical = 4.dp)) {
                rep.conflicts.forEach { k ->
                    val m = st.sketch.measure(k.measure)
                    val where = m?.let { st.sketch.room(it.room) }?.let { roomTitle(it.name, it.kinds) + " · " + m.kind.label.lowercase() } ?: k.measure
                    Text("Ellentmondás: $where ${k.mm} mm, a többi méret szerint ${k.solved} mm.", style = Melyviz.small.copy(color = Melyviz.coral))
                }
                rep.warnings.forEach { Text(it, style = Melyviz.small.copy(color = Melyviz.sand)) }
            }
        }
        Box(Modifier.weight(1f).fillMaxWidth().padding(8.dp)) {
            if (n.rooms.isEmpty()) Text("Még nincs szoba a vázlaton.", style = Melyviz.small, modifier = Modifier.align(Alignment.Center))
            else Canvas(Modifier.fillMaxSize()) { drawPlan(n, st.sketch, tm, c) }
        }
        Column(Modifier.fillMaxWidth().background(Melyviz.surface).padding(12.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                VrgChip("⇪ Küldés a Plannerbe", selected = true) {
                    scope.launch {
                        try {
                            val files = writeExport(ctx, st.sketch, n)
                            shareAll(ctx, files)
                            val ph = files.count { it.second == "image/jpeg" }
                            done = "Megosztva: ${files[0].first.name}" + (if (files.size > ph + 1) " + munkakör lap" else "") + if (ph > 0) " és $ph fotó" else ""
                        } catch (e: Exception) {
                            VrgLog.w("sketch", "Megosztás sikertelen: ${e.message}"); host.note("A megosztás nem sikerült.")
                        }
                    }
                }
                VrgChip("⤓ Mentés a telefonra") {
                    scope.launch {
                        val files = writeExport(ctx, st.sketch, n)
                        val at = files.map { (f, mime) -> FileStore.saveShared(ctx, f, f.name, mime, "VRG Vázlat") }
                        val ph = files.count { it.second == "image/jpeg" }
                        done = if (at.any { it == null }) "A mentés nem sikerült." else "Mentve: ${at[0]}" + (if (files.size > ph + 1) " + munkakör lap (.takeoff.json, .md)" else "") + if (ph > 0) " · $ph fotó: Képek / VRG Vázlat" else ""
                    }
                }
            }
            val shots = st.sketch.photos.sumOf { it.shots.size } + st.sketch.captures.size
            if (shots > 0) Text("$shots fotó megy vele, mindegyik külön fájlként.", style = Melyviz.small.copy(color = Melyviz.glow), modifier = Modifier.padding(top = 6.dp))
            Text("A PC-n: Planner → Terv betöltése fájlból → a .vsketch.json (⌘K → Felmérés: munkakör lap); a fotók: ⌘K → Vázlat: fotók. A .takeoff.json + .md a Workflow Kitnek. Átadással: Küldés → PC-re, és minden fájl a PC táblájára kerül.",
                style = Melyviz.small, modifier = Modifier.padding(top = 6.dp))
            done?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.glow), modifier = Modifier.padding(top = 4.dp)) }
        }
    }
}

private fun DrawScope.text(tm: TextMeasurer, s: String, at: Offset, color: Color, size: TextUnit, bold: Boolean = false, bg: Color? = null) {
    val lay = tm.measure(s, TextStyle(color = color, fontSize = size, fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal))
    val tl = Offset(at.x - lay.size.width / 2f, at.y - lay.size.height / 2f)
    if (bg != null) drawRect(bg, Offset(tl.x - 3, tl.y - 1), androidx.compose.ui.geometry.Size(lay.size.width + 6f, lay.size.height + 2f))
    drawText(lay, topLeft = tl)
}

private fun thousands(v: Double) = v.roundToInt().toString().reversed().chunked(3).joinToString(" ").reversed()

/** The solved plan fitted into the canvas, y down as on the sketch and in the Planner. */
private fun DrawScope.drawPlan(n: Norm, s: Sketch, tm: TextMeasurer, c: Pal) {
    val pts = n.rooms.flatMap { it.poly }.ifEmpty { return }
    val (lo, hi) = Geo.bbox(pts)
    val pad = 36.dp.toPx()
    val w = (hi.x - lo.x).coerceAtLeast(1.0); val h = (hi.y - lo.y).coerceAtLeast(1.0)
    val k = min((size.width - 2 * pad) / w, (size.height - 2 * pad) / h)
    val ox = (size.width - w * k) / 2 - lo.x * k; val oy = (size.height - h * k) / 2 - lo.y * k
    fun P(p: Pt) = Offset((p.x * k + ox).toFloat(), (p.y * k + oy).toFloat())
    val dash = PathEffect.dashPathEffect(floatArrayOf(8.dp.toPx(), 5.dp.toPx()))

    n.rooms.filter { it.poly.size >= 3 }.forEach { r ->
        val path = Path().apply { r.poly.forEachIndexed { i, p -> val o = P(p); if (i == 0) moveTo(o.x, o.y) else lineTo(o.x, o.y) }; close() }
        drawPath(path, (if (r.inferred) c.coral else c.surface).copy(alpha = if (r.inferred) 0.10f else 0.7f))
        r.poly.indices.forEach { i ->
            val a = r.poly[i]; val b = r.poly[(i + 1) % r.poly.size]
            val st = r.edges.getOrNull(i) ?: SizeStatus.INFERRED
            val col = when (st) { SizeStatus.MEASURED -> c.ink; SizeStatus.DERIVED -> c.glow; SizeStatus.INFERRED -> c.coral }
            drawLine(col, P(a), P(b), (if (st == SizeStatus.INFERRED) 2.5 else 2.0).dp.toPx(), pathEffect = if (st == SizeStatus.INFERRED) dash else null)
            val inw = Geo.inward(r.poly, i)
            val mid = P(Geo.lerp(a, b, 0.5)) + Offset(inw.x.toFloat(), inw.y.toFloat()) * 11.dp.toPx()
            text(tm, (if (st == SizeStatus.INFERRED) "≈ " else "") + thousands(a.dist(b)), mid, col, 9.sp, bg = c.abyss.copy(alpha = 0.6f))
        }
        val ctr = P(Geo.centroid(r.poly))
        text(tm, roomTitle(r.name, r.kinds), ctr - Offset(0f, 8.dp.toPx()), c.ink, 11.sp, bold = true)
        text(tm, (if (r.inferred) "≈ " else "") + "%.2f m²".format(r.area / 1e6).replace('.', ','), ctr + Offset(0f, 8.dp.toPx()),
            if (r.inferred) c.coral else c.muted, 10.sp)
    }
    n.routes.forEach { r ->
        val col = s.circuit(r.circuit)?.let { Color(it.color) } ?: c.current
        for (i in 0 until r.pts.size - 1) drawLine(col, P(r.pts[i]), P(r.pts[i + 1]), 2.dp.toPx(),
            pathEffect = PathEffect.dashPathEffect(floatArrayOf(10.dp.toPx(), 3.dp.toPx(), 2.dp.toPx(), 3.dp.toPx())))
    }
    n.points.forEach { p ->
        val o = P(p.at)
        s.circuitOf(p.id)?.let { drawCircle(Color(it.color), 7.dp.toPx(), o, style = Stroke(2.dp.toPx())) }
        val fill = if (p.state == PointState.EXISTING) c.sand else c.glow
        if (p.type == PointType.BOARD) drawRect(c.coral, Offset(o.x - 6.dp.toPx(), o.y - 6.dp.toPx()), androidx.compose.ui.geometry.Size(12.dp.toPx(), 12.dp.toPx()))
        else drawCircle(fill, 5.dp.toPx(), o)
    }
    n.memos.forEach { m -> text(tm, "✎", P(m.at), c.sand, 10.sp) }
    n.photos.forEach { f ->
        val o = P(f.at)
        Photos.DIRS.forEach { d ->
            val has = f.shots.any { Photos.norm(it.deg) == d }
            drawArc(if (has) c.glow else c.line, d - 90f - 30f, 60f, true, Offset(o.x - 16.dp.toPx(), o.y - 16.dp.toPx()),
                androidx.compose.ui.geometry.Size(32.dp.toPx(), 32.dp.toPx()), alpha = if (has) 0.6f else 0.35f)
        }
        drawCircle(c.coral, 5.dp.toPx(), o)
    }
}
