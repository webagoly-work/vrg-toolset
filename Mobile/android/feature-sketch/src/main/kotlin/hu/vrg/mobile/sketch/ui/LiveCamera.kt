package hu.vrg.mobile.sketch.ui

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.view.OrientationEventListener
import android.view.Surface
import androidx.activity.compose.BackHandler
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.FocusMeteringAction
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.sketch.CameraFeatures
import hu.vrg.mobile.sketch.CameraLive
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.io.File
import java.util.concurrent.TimeUnit
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

// Saját kamera (WP M52, fork F7; D-100 … D-109): the in-app camera. CameraX (the version QR párosítás already ships)
// with a preview and ImageCapture; the photo is written into the survey's photo folder and goes through the same path
// as a camera-app photo (SketchEditor: captureTaken / photoTaken), so the Capture record, EXIF GPS, the type-plate
// reader, the face hooks and the export are unchanged. On the viewfinder: the purpose (a tap opens the strip, the
// next missing shots first), the room, the count, the series until ✓ with the last thumbnail and ↶, the ghost of the
// before-photo for an after-photo, torch, tap-to-focus, pinch zoom, the level line and the grid. The pure half is
// sketch-core CameraLive.kt. The phone's camera app stays the fallback (⚙ → Kamera funkciók → Saját kamera off, or
// CameraX failing on this phone: LiveFallback).

/** CameraX failed on this phone during this run: the camera app takes over until the app restarts (D-101). */
internal object LiveFallback {
    @Volatile var failed = false
}

/**
 * The in-app camera over the editor. [onShot] files a photo that is in [dir] (and returns its capture id, null for a
 * Fotópont photo), [onFail] hands the request to the camera app, [onClose] closes the camera with the number taken.
 */
@Composable
internal fun LiveCamera(
    st: EditorState, req: CameraReq, dir: File,
    onShot: (CameraReq, String) -> String?,
    onFail: (CameraReq, String) -> Unit,
    onClose: (Int) -> Unit,
) {
    val ctx = LocalContext.current
    val owner = LocalLifecycleOwner.current
    val cam = st.cam2
    val photoPoint = req.photo != null
    var series by remember(req) { mutableStateOf(CameraLive.Series(req.purpose ?: st.purpose, req.shot, req.room ?: st.focusRoom, req.pairOf)) }
    var strip by remember { mutableStateOf(false) }
    var ghostShown by remember { mutableStateOf(true) }
    var ghostA by remember { mutableStateOf(CameraLive.GHOST_DEFAULT) }
    var gridShown by remember { mutableStateOf(true) }
    var torch by remember { mutableStateOf(false) }
    var camera by remember { mutableStateOf<Camera?>(null) }
    var busy by remember { mutableStateOf(false) }
    var errors by remember { mutableStateOf(0) }
    var flashAt by remember { mutableStateOf(0L) }
    var flashing by remember { mutableStateOf(false) }
    var focusAt by remember { mutableStateOf<Offset?>(null) }
    var zoom by remember { mutableStateOf(1f) }
    var level by remember { mutableStateOf<CameraLive.Level?>(null) }
    var location by remember { mutableStateOf<Location?>(null) }
    val view = remember { PreviewView(ctx).apply { scaleType = PreviewView.ScaleType.FILL_CENTER } }
    val capture = remember { ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY).build() }

    fun now(): CameraReq = req.copy(purpose = series.purpose, shot = series.shot, room = series.room, pairOf = series.pairOf)
    fun close() = onClose(series.size)

    BackHandler { if (strip) strip = false else close() }

    // ---- CameraX: preview + capture, bound to the editor's lifecycle (the QR scanner's pattern, feature-pair) ----------
    DisposableEffect(owner) {
        val future = ProcessCameraProvider.getInstance(ctx)
        val preview = Preview.Builder().build().also { it.setSurfaceProvider(view.surfaceProvider) }
        future.addListener({
            try {
                val p = future.get()
                p.unbindAll()
                camera = p.bindToLifecycle(owner, CameraSelector.DEFAULT_BACK_CAMERA, preview, capture)
            } catch (e: Exception) {
                onFail(now(), "A saját kamera nem indult (" + (e.message ?: "hiba") + "): a telefon kamerája nyílik.")
            }
        }, ContextCompat.getMainExecutor(ctx))
        onDispose {
            runCatching { future.get().unbind(preview, capture) }
            camera = null
        }
    }
    // the photo is turned the way the phone is held, even when the screen stays portrait (D-109)
    DisposableEffect(Unit) {
        val l = object : OrientationEventListener(ctx) {
            override fun onOrientationChanged(o: Int) {
                if (o == OrientationEventListener.ORIENTATION_UNKNOWN) return
                capture.targetRotation = when (o) {
                    in 45 until 135 -> Surface.ROTATION_270
                    in 135 until 225 -> Surface.ROTATION_180
                    in 225 until 315 -> Surface.ROTATION_90
                    else -> Surface.ROTATION_0
                }
            }
        }
        if (l.canDetectOrientation()) l.enable()
        onDispose { l.disable() }
    }
    // the level: gravity (or the accelerometer), smoothed (D-106)
    val levelOn = cam.on(CameraFeatures.LEVEL)
    DisposableEffect(levelOn) {
        if (!levelOn) { level = null; return@DisposableEffect onDispose { } }
        val sm = ctx.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        val sensor = sm.getDefaultSensor(Sensor.TYPE_GRAVITY) ?: sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        var acc: DoubleArray? = null
        val li = object : SensorEventListener {
            override fun onSensorChanged(e: SensorEvent) {
                val v = CameraLive.smooth(acc, doubleArrayOf(e.values[0].toDouble(), e.values[1].toDouble(), e.values[2].toDouble()))
                acc = v
                level = CameraLive.level(v[0], v[1], v[2])
            }
            override fun onAccuracyChanged(s: Sensor?, accuracy: Int) {}
        }
        if (sensor != null) sm.registerListener(li, sensor, SensorManager.SENSOR_DELAY_UI)
        onDispose { sm.unregisterListener(li) }
    }
    // GPS into the EXIF only with the permission already granted (D-102)
    val gpsOn = cam.on(CameraFeatures.LIVE_GPS)
    LaunchedEffect(gpsOn) { location = if (gpsOn) lastLocation(ctx) else null }
    val torchOn = cam.on(CameraFeatures.TORCH)
    LaunchedEffect(torch, camera) { camera?.let { c -> if (c.cameraInfo.hasFlashUnit()) c.cameraControl.enableTorch(torch && torchOn) } }
    LaunchedEffect(flashAt) { if (flashAt > 0) { flashing = true; delay(90); flashing = false } }
    LaunchedEffect(focusAt) { if (focusAt != null) { delay(1200); focusAt = null } }

    fun shoot() {
        if (busy || camera == null) return
        busy = true
        val r = now()
        dir.mkdirs()
        val name = (r.photo ?: "C") + "-" + System.currentTimeMillis().toString(36) + ".jpg"
        val f = File(dir, name)
        val meta = ImageCapture.Metadata()
        if (gpsOn) location?.let { meta.location = it }
        val opts = ImageCapture.OutputFileOptions.Builder(f).setMetadata(meta).build()
        flashAt = System.currentTimeMillis()
        capture.takePicture(opts, ContextCompat.getMainExecutor(ctx), object : ImageCapture.OnImageSavedCallback {
            override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                busy = false
                if (f.length() <= 0) { f.delete(); st.note = "A fotó üres lett, próbáld újra."; return }
                errors = 0
                val id = onShot(r, name)
                if (photoPoint) { onClose(1); return }
                if (id != null) series = CameraLive.took(st.kit, st.sketch, series, id)
                if (!CameraLive.staysOpen(cam.on(CameraFeatures.SERIES), st.series, photoPoint)) close()
            }
            override fun onError(exception: ImageCaptureException) {
                busy = false
                f.delete()
                errors += 1
                if (errors >= 2) onFail(r, "A saját kamera kétszer hibázott: a telefon kamerája nyílik.")
                else st.note = "A fotó nem sikerült, próbáld újra."
            }
        })
    }

    val kit = st.kit
    val p = kit.purpose(series.purpose)
    val col = Color(p?.color ?: 0xFF7D8590)
    val item = kit.shot(series.shot)
    val ghost = if (!photoPoint && cam.on(CameraFeatures.GHOST)) CameraLive.ghost(st.sketch, series) else null
    val ghostImg = produceState<ImageBitmap?>(null, ghost?.file) {
        value = ghost?.let { g -> withContext(Dispatchers.IO) { loadPhoto(File(dir, g.file), 1600)?.asImageBitmap() } }
    }.value
    val lastFile = series.last?.let { st.sketch.capture(it)?.file }
    val lastImg = produceState<ImageBitmap?>(null, lastFile) {
        value = lastFile?.let { n -> withContext(Dispatchers.IO) { loadPhoto(File(dir, n), 240)?.asImageBitmap() } }
    }.value

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        AndroidView({ view }, Modifier.fillMaxSize())
        if (ghost != null && ghostShown && ghostImg != null)
            Image(ghostImg, contentDescription = "előtte-kép", contentScale = ContentScale.Crop, alpha = CameraLive.ghostAlpha(ghostA), modifier = Modifier.fillMaxSize())
        // grid and level
        val gridOn = cam.on(CameraFeatures.GRID) && gridShown
        val lv = level
        Canvas(Modifier.fillMaxSize()) {
            if (gridOn) CameraLive.GRID.forEach { t ->
                drawLine(Color.White.copy(alpha = 0.35f), Offset((size.width * t).toFloat(), 0f), Offset((size.width * t).toFloat(), size.height), 1.5f)
                drawLine(Color.White.copy(alpha = 0.35f), Offset(0f, (size.height * t).toFloat()), Offset(size.width, (size.height * t).toFloat()), 1.5f)
            }
            if (lv != null) {
                val ok = lv.level()
                val c = if (ok) Color(0xFF3DDC84) else Color.White
                val mid = Offset(size.width / 2, size.height / 2)
                if (lv.flat) {
                    val rad = min(size.width, size.height) * 0.12f
                    drawCircle(Color.White.copy(alpha = 0.6f), rad, mid, style = Stroke(2f))
                    val dev = (90.0 - kotlin.math.abs(lv.pitch)).coerceIn(0.0, 15.0) / 15.0 * rad
                    val a = Math.toRadians(lv.quarter + lv.roll)
                    drawCircle(c, rad * 0.18f, Offset(mid.x + (sin(a) * dev).toFloat(), mid.y - (cos(a) * dev).toFloat()))
                } else {
                    // the world's horizon on the screen: turned back by the phone's roll (and its quarter turn)
                    val a = Math.toRadians(-(lv.quarter + lv.roll))
                    val half = min(size.width, size.height) * 0.3f
                    val d = Offset((cos(a) * half).toFloat(), (sin(a) * half).toFloat())
                    drawLine(c, mid - d, mid + d, if (ok) 4f else 2.5f)
                    val q = Math.toRadians(-lv.quarter.toDouble())
                    val t = Offset((cos(q) * half * 1.12).toFloat(), (sin(q) * half * 1.12).toFloat())
                    val n = Offset((-sin(q) * 14).toFloat(), (cos(q) * 14).toFloat())
                    drawLine(Color.White.copy(alpha = 0.7f), mid + t - n, mid + t + n, 2f)
                    drawLine(Color.White.copy(alpha = 0.7f), mid - t - n, mid - t + n, 2f)
                }
            }
        }
        // tap to focus, pinch to zoom (D-107)
        Box(Modifier.fillMaxSize()
            .pointerInput(camera) {
                detectTapGestures { o ->
                    if (strip) { strip = false; return@detectTapGestures }
                    val c = camera ?: return@detectTapGestures
                    val pt = view.meteringPointFactory.createPoint(o.x, o.y)
                    runCatching { c.cameraControl.startFocusAndMetering(FocusMeteringAction.Builder(pt).setAutoCancelDuration(3, TimeUnit.SECONDS).build()) }
                    focusAt = o
                }
            }
            .pointerInput(camera) {
                detectTransformGestures { _, _, pinch, _ ->
                    val c = camera ?: return@detectTransformGestures
                    val zs = c.cameraInfo.zoomState.value ?: return@detectTransformGestures
                    val r = CameraLive.zoom(zoom, pinch, zs.minZoomRatio, zs.maxZoomRatio)
                    if (r != zoom) { zoom = r; runCatching { c.cameraControl.setZoomRatio(r) } }
                }
            })
        focusAt?.let { o -> Canvas(Modifier.fillMaxSize()) { drawCircle(Color(0xFFFFD54F), 36f, o, style = Stroke(3f)) } }
        if (flashing) Box(Modifier.fillMaxSize().background(Color.White.copy(alpha = 0.55f)))

        // ---- the top: purpose, room, count, torch, grid -------------------------------------------------------------------
        Column(Modifier.align(Alignment.TopStart).fillMaxWidth().background(Color(0x66000000)).padding(horizontal = 8.dp, vertical = 6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("‹", style = Melyviz.title.copy(color = Color.White), modifier = Modifier.clickable { close() }.padding(horizontal = 6.dp))
                if (photoPoint) Text("◉ Fotópont", style = Melyviz.label.copy(color = Color.White))
                else {
                    Row(Modifier.clip(RoundedCornerShape(50)).background(col.copy(alpha = 0.85f)).clickable { strip = !strip }
                        .padding(horizontal = 10.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(p?.sym ?: "•", style = Melyviz.glyph.copy(fontSize = 18.sp, color = Color.White))
                        Text(" " + (item?.label ?: p?.label ?: series.purpose), style = Melyviz.small.copy(color = Color.White), maxLines = 1)
                    }
                    val rooms = listOf<String?>(null) + st.sketch.rooms.map { it.id }
                    val room = st.sketch.room(series.room)
                    Text("⌂ " + (room?.let { roomTitle(it.name, it.kinds) } ?: "—"), style = Melyviz.small.copy(color = Color.White), maxLines = 1,
                        modifier = Modifier.clip(RoundedCornerShape(50)).border(1.dp, Color.White.copy(alpha = 0.6f), RoundedCornerShape(50)).clickable {
                            val i = rooms.indexOf(series.room)
                            series = series.copy(room = rooms[(i + 1) % rooms.size])
                        }.padding(horizontal = 8.dp, vertical = 4.dp))
                    val n = CameraLive.count(st.sketch, series.purpose, series.shot)
                    Text(if (item != null) "$n/${item.need}" else "$n", style = Melyviz.readout.copy(color = Color.White))
                }
                Spacer(Modifier.weight(1f))
                if (zoom > 1.01f) Text("%.1f×".format(zoom), style = Melyviz.readout.copy(color = Color.White))
                if (torchOn && camera?.cameraInfo?.hasFlashUnit() == true)
                    RoundKey("ϟ", if (torch) Color(0xFFFFD54F) else Color.White, torch) { torch = !torch }
                if (cam.on(CameraFeatures.GRID)) RoundKey("▦", Color.White, gridShown) { gridShown = !gridShown }
            }
            lv?.let { if (!it.flat) Text("%+.1f°".format(it.roll), style = Melyviz.readout.copy(fontSize = 11.sp, color = if (it.level()) Color(0xFF3DDC84) else Color.White)) }
            st.note?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand), maxLines = 2) }
        }

        // ---- the bottom: ghost, purpose strip, thumbnail + ↶, shutter, ✓ ---------------------------------------------
        Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth().background(Color(0x66000000)).padding(horizontal = 10.dp, vertical = 10.dp)) {
            if (ghost != null) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                RoundKey("◐", Color.White, ghostShown) { ghostShown = !ghostShown }
                Slider(ghostA, { ghostA = CameraLive.ghostAlpha(it) }, valueRange = 0f..CameraLive.GHOST_MAX, modifier = Modifier.weight(1f))
                Text("✕", style = Melyviz.label.copy(color = Color.White), modifier = Modifier.clickable { series = series.copy(pairOf = null) }.padding(6.dp))
            } else if (!photoPoint && cam.on(CameraFeatures.GHOST)) {
                val cands = CameraLive.ghostCandidates(st.sketch, series.purpose, series.room)
                if (cands.isNotEmpty()) Text("◐ Előtte-kép (${cands.size})", style = Melyviz.small.copy(color = Color.White),
                    modifier = Modifier.clip(RoundedCornerShape(50)).border(1.dp, Color.White.copy(alpha = 0.6f), RoundedCornerShape(50))
                        .clickable { series = series.copy(pairOf = cands.first().id); ghostShown = true }.padding(horizontal = 10.dp, vertical = 4.dp))
            }
            if (strip && !photoPoint) {
                val picks = CameraLive.strip(kit, st.sketch, series.purpose, missingFirst = cam.on(CameraFeatures.QUICK))
                Row(Modifier.horizontalScroll(rememberScrollState()).padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    picks.forEach { k ->
                        val kp = kit.purpose(k.purpose) ?: return@forEach
                        val kc = Color(kp.color)
                        val sel = k.purpose == series.purpose && k.shot == series.shot
                        Column(Modifier.width(54.dp).clickable { series = CameraLive.pick(series, k); st.purpose = k.purpose; strip = false },
                            horizontalAlignment = Alignment.CenterHorizontally) {
                            Box(Modifier.size(44.dp).clip(CircleShape).background(kc.copy(alpha = if (sel) 0.9f else 0.45f))
                                .border(if (sel) 3.dp else 1.dp, if (sel) Color.White else kc, CircleShape), contentAlignment = Alignment.Center) {
                                Text(kp.sym, style = Melyviz.glyph.copy(fontSize = 20.sp, color = Color.White))
                                if (k.missing) Box(Modifier.align(Alignment.TopEnd).size(10.dp).clip(CircleShape).background(Melyviz.coral))
                            }
                            if (k.missing) Text(kit.shot(k.shot)?.label ?: "", style = Melyviz.small.copy(fontSize = 8.sp, color = Color.White), maxLines = 2)
                        }
                    }
                }
            }
            Row(Modifier.fillMaxWidth().padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                // the last shot of the series, ↶ takes it back
                Box(Modifier.size(56.dp)) {
                    if (lastImg != null) {
                        Image(lastImg, contentDescription = "utolsó fotó", contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(8.dp)).border(1.dp, Color.White, RoundedCornerShape(8.dp)))
                        Text("↶", style = Melyviz.label.copy(color = Color.White), modifier = Modifier.align(Alignment.TopEnd).clip(CircleShape)
                            .background(Color(0xAA000000)).clickable {
                                val (back, gone) = CameraLive.undo(series)
                                gone?.let { st.deleteCapture(it); st.note = "↶ Az utolsó fotó törölve." }
                                series = back
                            }.padding(horizontal = 6.dp, vertical = 2.dp))
                    }
                }
                Spacer(Modifier.weight(1f))
                Box(Modifier.size(76.dp).clip(CircleShape).background(Color.White.copy(alpha = if (busy || camera == null) 0.4f else 0.95f))
                    .border(5.dp, if (photoPoint) Color.White else col, CircleShape).clickable(enabled = !busy && camera != null) { shoot() },
                    contentAlignment = Alignment.Center) {
                    Text(if (photoPoint) "◉" else (p?.sym ?: "◉"), style = Melyviz.glyph.copy(fontSize = 26.sp, color = if (photoPoint) Color.Black else col))
                }
                Spacer(Modifier.weight(1f))
                Box(Modifier.size(56.dp), contentAlignment = Alignment.Center) {
                    if (!photoPoint) Text("✓" + if (series.size > 0) " ${series.size}" else "", style = Melyviz.title.copy(color = Melyviz.glow),
                        modifier = Modifier.clip(RoundedCornerShape(50)).clickable { close() }.padding(horizontal = 10.dp, vertical = 6.dp))
                }
            }
        }
    }
}

/** A round viewfinder key. */
@Composable
private fun RoundKey(sym: String, color: Color, on: Boolean, onClick: () -> Unit) {
    Box(Modifier.size(38.dp).clip(CircleShape).background(if (on) color.copy(alpha = 0.3f) else Color(0x44000000))
        .border(1.dp, color.copy(alpha = if (on) 1f else 0.6f), CircleShape).clickable(onClick = onClick), contentAlignment = Alignment.Center) {
        Text(sym, style = Melyviz.glyph.copy(fontSize = 18.sp, color = color))
    }
}

/** The phone's last known position, only when a location permission was already granted (the camera never asks). */
@SuppressLint("MissingPermission")
private suspend fun lastLocation(ctx: Context): Location? = withContext(Dispatchers.IO) {
    val fine = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    val coarse = ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
    if (!fine && !coarse) return@withContext null
    try {
        val lm = ctx.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val provs = if (Build.VERSION.SDK_INT >= 31) listOf(LocationManager.FUSED_PROVIDER, LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
            else listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
        provs.mapNotNull { runCatching { lm.getLastKnownLocation(it) }.getOrNull() }
            // a position older than 30 minutes says where the phone was, not where the photo is
            .filter { System.currentTimeMillis() - it.time < 30 * 60_000L }
            .maxByOrNull { it.time }
    } catch (e: Exception) { null }
}
