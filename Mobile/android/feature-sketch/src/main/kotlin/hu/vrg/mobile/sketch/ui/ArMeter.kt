package hu.vrg.mobile.sketch.ui

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.pm.PackageManager
import android.net.Uri
import android.opengl.GLES11Ext
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.opengl.Matrix
import android.os.Handler
import android.os.Looper
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.ar.core.Anchor
import com.google.ar.core.ArCoreApk
import com.google.ar.core.Config
import com.google.ar.core.Coordinates2d
import com.google.ar.core.DepthPoint
import com.google.ar.core.Frame
import com.google.ar.core.HitResult
import com.google.ar.core.Plane
import com.google.ar.core.Point
import com.google.ar.core.RecordingConfig
import com.google.ar.core.RecordingStatus
import com.google.ar.core.Session
import com.google.ar.core.TrackingFailureReason
import com.google.ar.core.TrackingState
import com.google.ar.core.exceptions.NotYetAvailableException
import com.google.ar.core.exceptions.UnavailableException
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.files.FileStore
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.sketch.Ar
import hu.vrg.mobile.sketch.ArCloud
import hu.vrg.mobile.sketch.MeasureKind
import hu.vrg.mobile.sketch.Ops
import hu.vrg.mobile.sketch.Planes
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

// Google AR csomag (dev line skcam, stage K6, WP M64): the AR meter. Google's ARCore (Google Play Services for AR,
// installed from the Play Store when it is missing) tracks the phone; this screen draws the camera with OpenGL ES 2 and
// does three things with it:
//
//  - 📏 Mérés: aim the cross at a spot and tap ＋ Pont twice; the distance between them reads live in mm while aiming
//    (ARCore's planes, feature points and, where the phone has depth, depth points). ✓ Mentés keeps it in the survey's
//    `ar` key; opened from a wall's Méret, the length goes onto the wall too.
//  - ⬚ Pásztázás: walking the room, the feature points and (with Raw Depth) the depth points gather on a 2 cm grid;
//    ⇩ Mentés writes a vrg-house3d file to the shared "VRG Vázlat" folder, which the Desktop's 🏠 Ház 3D opens to scale.
//  - ⏺ Felvétel: ARCore's Recording API writes the camera, the depth and the motion sensors into one MP4 for the PC.
//
// The whole pack is the one switch Ar.FEATURE (default off, D-165). Nothing here runs, and ARCore is never asked about,
// until the user switches it on and opens the meter; the APK says AR is optional (AndroidManifest.xml), so it installs
// and works on phones without ARCore. All the maths that can be is in sketch-core Ar.kt, tested on the JVM.

private tailrec fun Context.activity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.activity()
    else -> null
}

/** What the GL thread tells the screen; read every 150 ms (plain volatile fields, no locking needed). */
private class ArState {
    @Volatile var tracking = false
    @Volatile var hint = "Indul a Google AR…"
    @Volatile var aimOk = false
    @Volatile var a: DoubleArray? = null
    @Volatile var b: DoubleArray? = null
    @Volatile var live: DoubleArray? = null       // the aimed point, when there is one
    @Volatile var points = 0
    @Volatile var depth = false
    @Volatile var recording = false
    @Volatile var error: String? = null
}

private enum class ArMode { MEASURE, SCAN }

/** The AR meter over the whole screen. [room] / [edge]: opened from a wall's Méret, the saved length goes onto it. */
@Composable
internal fun ArDialog(st: EditorState, room: String?, edge: Int?, onDone: () -> Unit) {
    val ctx = LocalContext.current
    val owner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()
    var granted by remember { mutableStateOf(ContextCompat.checkSelfPermission(ctx, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) }
    val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted = it }
    var problem by remember { mutableStateOf<String?>(null) }
    var session by remember { mutableStateOf<Session?>(null) }
    var installAsked by remember { mutableStateOf(false) }
    val state = remember { ArState() }
    val cloud = remember { ArCloud() }
    val renderer = remember { mutableStateOf<ArRenderer?>(null) }
    var view by remember { mutableStateOf<GLSurfaceView?>(null) }
    var mode by remember { mutableStateOf(ArMode.MEASURE) }
    var scanning by remember { mutableStateOf(false) }
    var tick by remember { mutableIntStateOf(0) }
    var label by remember { mutableStateOf("") }
    var saved by remember { mutableStateOf<List<Pair<List<Double>, List<Double>>>>(emptyList()) }
    var savedLabels by remember { mutableStateOf<List<String>>(emptyList()) }
    var recFile by remember { mutableStateOf<File?>(null) }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { if (!granted) ask.launch(Manifest.permission.CAMERA) }

    /** Google Play Services for AR: installed (or asked for once), then the session. Called again on each resume. */
    fun open() {
        if (session != null || problem != null || !granted) return
        val act = ctx.activity() ?: run { problem = "Nem nyitható meg (nincs ablak)."; return }
        try {
            when (ArCoreApk.getInstance().requestInstall(act, !installAsked)) {
                ArCoreApk.InstallStatus.INSTALL_REQUESTED -> { installAsked = true; return }   // the Play Store opens; we come back on resume
                ArCoreApk.InstallStatus.INSTALLED -> {}
                else -> {}
            }
            val s = Session(ctx)
            val cfg = Config(s).apply {
                focusMode = Config.FocusMode.AUTO
                planeFindingMode = Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL
                updateMode = Config.UpdateMode.LATEST_CAMERA_IMAGE
                lightEstimationMode = Config.LightEstimationMode.DISABLED
                depthMode = if (s.isDepthModeSupported(Config.DepthMode.RAW_DEPTH_ONLY)) Config.DepthMode.RAW_DEPTH_ONLY else Config.DepthMode.DISABLED
            }
            s.configure(cfg)
            state.depth = cfg.depthMode == Config.DepthMode.RAW_DEPTH_ONLY
            session = s
        } catch (e: UnavailableException) {
            VrgLog.w("sketch", "AR: ${e.javaClass.simpleName}: ${e.message}")
            problem = when (e.javaClass.simpleName) {
                "UnavailableUserDeclinedInstallationException" -> "A Google AR (Google Play Services for AR) telepítése elmaradt. Telepítés után nyisd meg újra."
                "UnavailableDeviceNotCompatibleException" -> "Ez a telefon nem támogatja a Google AR-t. A Mérés a fotón (📏) és a Szobadoboz enélkül is működik."
                "UnavailableApkTooOldException" -> "A Google Play Services for AR túl régi: frissítsd a Play Áruházban."
                "UnavailableSdkTooOldException" -> "Az alkalmazás AR része túl régi ehhez a Google AR-hoz: frissítsd a VRG Mobile-t."
                else -> "A Google AR nem indult el: " + (e.message ?: e.javaClass.simpleName)
            }
        } catch (e: Exception) {
            VrgLog.w("sketch", "AR: ${e.message}")
            problem = "A Google AR nem indult el: " + (e.message ?: e.javaClass.simpleName)
        }
    }

    LaunchedEffect(granted) { if (granted) open() }

    DisposableEffect(owner, session) {
        val s0 = session                                  // this effect's session: a new one restarts the effect
        val obs = LifecycleEventObserver { _, ev ->
            when (ev) {
                Lifecycle.Event.ON_RESUME -> { if (s0 == null) open() else { runCatching { s0.resume() }.onFailure { problem = "A kamera nem érhető el: " + it.message }; view?.onResume() } }
                Lifecycle.Event.ON_PAUSE -> { view?.onPause(); s0?.pause(); state.recording = false }
                else -> {}
            }
        }
        owner.lifecycle.addObserver(obs)
        s0?.let { s -> runCatching { s.resume() }.onFailure { problem = "A kamera nem érhető el: " + it.message } }
        onDispose {
            owner.lifecycle.removeObserver(obs)
            if (s0 != null) {
                view?.onPause()
                runCatching { if (s0.recordingStatus == RecordingStatus.OK) s0.stopRecording() }
                s0.pause(); s0.close()
            }
        }
    }

    // the screen reads what the GL thread found, a few times a second
    LaunchedEffect(Unit) { while (true) { delay(150); tick++ } }

    val close = {
        view?.let { v -> v.queueEvent { renderer.value?.stopRecording() } }
        onDone()
    }
    BackHandler { close() }

    fun now() = System.currentTimeMillis()
    fun stamp() = SimpleDateFormat("yyyyMMdd-HHmmss", Locale.ROOT).format(Date())

    Dialog(onDismissRequest = close, properties = DialogProperties(usePlatformDefaultWidth = false, dismissOnBackPress = true)) {
        Box(Modifier.fillMaxSize().background(Color.Black)) {
            @Suppress("UNUSED_VARIABLE") val t = tick
            val s = session
            when {
                !granted -> Msg("A méréshez kell a kamera engedélye.")
                problem != null -> Msg(problem!!)
                s == null -> Msg(if (installAsked) "Telepítsd a Google Play Services for AR-t, majd térj vissza ide." else "Indul a Google AR…")
                else -> {
                    AndroidView(modifier = Modifier.fillMaxSize(), factory = { c ->
                        GLSurfaceView(c).apply {
                            preserveEGLContextOnPause = true
                            setEGLContextClientVersion(2)
                            setEGLConfigChooser(8, 8, 8, 8, 16, 0)
                            val r = ArRenderer(s, state, cloud, this)
                            setRenderer(r)
                            renderMode = GLSurfaceView.RENDERMODE_CONTINUOUSLY
                            renderer.value = r
                            view = this
                        }
                    })
                    // the cross the user aims with
                    Box(Modifier.align(Alignment.Center).size(28.dp).border(2.dp, if (state.aimOk) Melyviz.glow else Color.White.copy(alpha = 0.6f), CircleShape))
                    Box(Modifier.align(Alignment.Center).size(4.dp).background(if (state.aimOk) Melyviz.glow else Color.White, CircleShape))
                    // the top: what to do, the reading
                    Column(Modifier.align(Alignment.TopCenter).fillMaxWidth().background(Color(0xAA0A141C)).padding(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("📐 AR mérő", style = Melyviz.title.copy(fontSize = 15.sp))
                            Spacer(Modifier.weight(1f))
                            Text(if (state.depth) "mélység: van" else "mélység: nincs", style = Melyviz.small.copy(color = Melyviz.faint))
                            Text("   ✕", style = Melyviz.title.copy(fontSize = 18.sp, color = Melyviz.muted), modifier = Modifier.padding(start = 8.dp).clickable { close() })
                        }
                        Text(state.hint, style = Melyviz.small.copy(color = Melyviz.sand))
                        if (mode == ArMode.MEASURE) {
                            val a = state.a; val b = state.b ?: state.live
                            if (a != null && b != null) {
                                val mm = Ar.mm(a, b)
                                val dy = kotlin.math.abs(b[1] - a[1]) * 1000; val dh = hypot(b[0] - a[0], b[2] - a[2]) * 1000
                                Text(Planes.fmt(mm.toDouble()), style = Melyviz.readout.copy(fontSize = 30.sp, color = if (state.b != null) Melyviz.glow else Color.White))
                                Text("↕ " + Planes.fmt(dy) + "   ↔ " + Planes.fmt(dh), style = Melyviz.small.copy(color = Melyviz.faint))
                            }
                        } else {
                            Text("${state.points} pont" + (if (scanning) " · gyűjtés…" else "") + (if (cloud.full) " · tele" else ""), style = Melyviz.readout.copy(fontSize = 22.sp, color = if (scanning) Melyviz.glow else Color.White))
                        }
                        st.note?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.glow)) }
                    }
                    // the bottom: the mode and its buttons
                    Column(Modifier.align(Alignment.BottomCenter).fillMaxWidth().background(Color(0xAA0A141C)).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (room == null) Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Pill("📏 Mérés", Melyviz.current, mode == ArMode.MEASURE) { mode = ArMode.MEASURE; view?.queueEvent { renderer.value?.scan = false }; scanning = false }
                            Pill("⬚ Pásztázás", Melyviz.current, mode == ArMode.SCAN) { mode = ArMode.SCAN; view?.queueEvent { renderer.value?.clearPoints() } }
                            Spacer(Modifier.weight(1f))
                            Pill(if (state.recording) "⏹ Felvétel leáll" else "⏺ Felvétel", Melyviz.coral, state.recording) {
                                val v = view ?: return@Pill
                                if (!state.recording) {
                                    val dir = File(ctx.getExternalFilesDir(null) ?: ctx.cacheDir, "ar").apply { mkdirs() }
                                    val f = File(dir, Ar.fileName(st.sketch.name, stamp(), "mp4"))
                                    recFile = f
                                    v.queueEvent { renderer.value?.startRecording(f) }
                                } else {
                                    val f = recFile
                                    v.queueEvent {
                                        renderer.value?.stopRecording()
                                        if (f != null) Handler(Looper.getMainLooper()).post {
                                            scope.launch {
                                                val at = if (f.exists() && f.length() > 0) FileStore.saveShared(ctx, f, f.name, "video/mp4", "VRG Vázlat") else null
                                                if (at != null) { st.edit(Ar.addFile(st.sketch, "rec", f.name, now())); st.note = "Felvétel mentve: $at"; f.delete() }
                                                else st.note = "A felvétel nem készült el."
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        if (mode == ArMode.MEASURE) {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                val a = state.a; val b = state.b
                                Pill(if (a == null) "＋ 1. pont" else if (b == null) "＋ 2. pont" else "＋ Új mérés", Melyviz.glow, false) {
                                    view?.queueEvent { renderer.value?.addPoint() }
                                }
                                Pill("↺ Újra", Melyviz.muted, false) { view?.queueEvent { renderer.value?.reset() } }
                                Spacer(Modifier.weight(1f))
                                if (a != null && b != null) Pill("✓ Mentés", Melyviz.glow, true) {
                                    val mm = Ar.mm(a, b)
                                    var next = st.sketch
                                    if (room != null && edge != null) next = Ops.setMeasure(next, room, MeasureKind.EDGE, mm, edge)
                                    next = Ar.addLine(next, mm, a.toList(), b.toList(), now(), label, room, edge)
                                    st.edit(next)
                                    saved = saved + (a.toList() to b.toList()); savedLabels = savedLabels + label
                                    st.note = "Mentve: " + (label.ifBlank { "távolság" }) + " " + Planes.fmt(mm.toDouble())
                                    label = ""
                                    view?.queueEvent { renderer.value?.reset() }
                                    if (room != null) onDone()
                                }
                            }
                            if (state.b != null) Field(label, { label = it }, "Felirat (nem kötelező)")
                            Ar.summary(st.sketch).takeLast(3).takeIf { it.isNotEmpty() }?.let { Text("📐 " + it.joinToString(" · "), style = Melyviz.small.copy(color = Melyviz.faint)) }
                        } else {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Pill(if (scanning) "⏸ Megáll" else "▶ Gyűjtés", Melyviz.glow, scanning) {
                                    scanning = !scanning; val on = scanning
                                    view?.queueEvent { renderer.value?.scan = on }
                                }
                                Spacer(Modifier.weight(1f))
                                if (state.points > 0 && !busy) Pill("⇩ Mentés", Melyviz.glow, true) {
                                    scanning = false; busy = true
                                    val v = view
                                    val name = Ar.fileName(st.sketch.name, stamp(), "house3d.json")
                                    val title = (st.sketch.name.ifBlank { "Vázlat" }) + " (AR)"
                                    v?.queueEvent {
                                        renderer.value?.scan = false
                                        Handler(Looper.getMainLooper()).post {
                                            scope.launch {
                                                val at = withContext(Dispatchers.IO) {
                                                    val json = synchronized(cloud) { cloud.toHouse3d(title, now(), saved) { savedLabels.getOrNull(it) } }
                                                    val f = File(ctx.cacheDir, name)
                                                    f.writeText(json.toString())
                                                    FileStore.saveShared(ctx, f, name, "application/json", "VRG Vázlat").also { f.delete() }
                                                }
                                                busy = false
                                                if (at != null) { st.edit(Ar.addFile(st.sketch, "scan", name, now(), state.points)); st.note = "Pásztázás mentve: $at (a PC-n: Sketcher → Helyszín → 🏠 Ház 3D)" }
                                                else st.note = "A pásztázás nem menthető."
                                            }
                                        }
                                    }
                                }
                            }
                            Text("Járd körbe lassan a szobát, a falakat 1–2 m-ről. A pontok a gépen a Ház 3D-ben mérhetők, lépték nélkül.", style = Melyviz.small.copy(color = Melyviz.faint))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Msg(text: String) = Box(Modifier.fillMaxSize().background(Melyviz.abyss).padding(24.dp)) {
    Text(text, style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.align(Alignment.Center))
}

/** The GL side: the camera picture, the cross's hit test, the two points and their line, the scan's points. */
private class ArRenderer(private val session: Session, private val state: ArState, private val cloud: ArCloud, private val view: GLSurfaceView) : GLSurfaceView.Renderer {
    private val bg = ArBackground()
    private val lines = ArLines()
    private val proj = FloatArray(16); private val viewM = FloatArray(16); private val vp = FloatArray(16)
    private var w = 1; private var h = 1
    private var a: Anchor? = null; private var b: Anchor? = null
    private var aim: HitResult? = null
    @Volatile var scan = false
    private var frames = 0
    private val preview: FloatBuffer = ByteBuffer.allocateDirect(4 * 3 * Ar.MAX_POINTS).order(ByteOrder.nativeOrder()).asFloatBuffer()
    private var shown = 0

    override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
        GLES20.glClearColor(0f, 0f, 0f, 1f)
        bg.create(); lines.create()
        session.setCameraTextureName(bg.tex)
    }

    override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
        w = width; h = height
        GLES20.glViewport(0, 0, width, height)
        session.setDisplayGeometry(view.display?.rotation ?: 0, width, height)
    }

    override fun onDrawFrame(gl: GL10?) {
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT or GLES20.GL_DEPTH_BUFFER_BIT)
        val frame = try { session.update() } catch (e: Exception) { state.hint = "A kamera nem érhető el."; return }
        bg.draw(frame)
        val cam = frame.camera
        if (cam.trackingState != TrackingState.TRACKING) {
            state.tracking = false; state.aimOk = false; state.live = null
            state.hint = when (cam.trackingFailureReason) {
                TrackingFailureReason.INSUFFICIENT_LIGHT -> "Kevés a fény."
                TrackingFailureReason.EXCESSIVE_MOTION -> "Lassabban mozgasd a telefont."
                TrackingFailureReason.INSUFFICIENT_FEATURES -> "Fordulj mintásabb felület felé (sima fehér falon nehéz)."
                TrackingFailureReason.CAMERA_UNAVAILABLE -> "A kamera foglalt."
                else -> "Mozgasd lassan a telefont, amíg a Google AR körülnéz."
            }
            return
        }
        state.tracking = true
        cam.getProjectionMatrix(proj, 0, 0.05f, 30f)
        cam.getViewMatrix(viewM, 0)
        Matrix.multiplyMM(vp, 0, proj, 0, viewM, 0)

        // the cross: the first good hit at the middle of the screen
        aim = frame.hitTest(w / 2f, h / 2f).firstOrNull { good(it) }
        val live = aim?.hitPose?.let { doubleArrayOf(it.tx().toDouble(), it.ty().toDouble(), it.tz().toDouble()) }
        state.live = live; state.aimOk = live != null
        val pa = a?.takeIf { it.trackingState == TrackingState.TRACKING }?.pose?.let { doubleArrayOf(it.tx().toDouble(), it.ty().toDouble(), it.tz().toDouble()) }
        val pb = b?.takeIf { it.trackingState == TrackingState.TRACKING }?.pose?.let { doubleArrayOf(it.tx().toDouble(), it.ty().toDouble(), it.tz().toDouble()) }
        state.a = pa; state.b = pb
        state.hint = when {
            scan -> "Gyűjtés: lassan, a falakat végigpásztázva."
            pa == null && live == null -> "Célozz egy felületre: a kör zöld, ha van mire mérni."
            pa == null -> "＋ 1. pont: a kör közepe."
            pb == null -> "Célozz a 2. pontra, és ＋ 2. pont."
            else -> "✓ Mentés, vagy ＋ Új mérés."
        }

        // the scan
        if (scan && !cloud.full) collect(frame)
        if (shown < cloud.size) synchronized(cloud) {
            val add = cloud.pointsFrom(shown)
            preview.position(3 * shown); preview.put(add); shown = cloud.size
        }
        state.points = cloud.size

        // overlays: the scan's points, the measuring line, its ends
        if (shown > 0) lines.points(vp, preview, shown, floatArrayOf(0.15f, 0.76f, 0.69f, 0.9f), 4f)
        val end = pb ?: live
        if (pa != null && end != null) lines.segment(vp, pa, end, if (pb != null) floatArrayOf(0.15f, 0.76f, 0.69f, 1f) else floatArrayOf(1f, 1f, 1f, 0.9f))
        pa?.let { lines.dot(vp, it, floatArrayOf(0.88f, 0.69f, 0.13f, 1f), 22f) }
        pb?.let { lines.dot(vp, it, floatArrayOf(0.88f, 0.69f, 0.13f, 1f), 22f) }
        state.recording = session.recordingStatus == RecordingStatus.OK
    }

    private fun good(hit: HitResult): Boolean = when (val t = hit.trackable) {
        is Plane -> t.trackingState == TrackingState.TRACKING && t.isPoseInPolygon(hit.hitPose)
        is DepthPoint -> true
        is Point -> t.orientationMode == Point.OrientationMode.ESTIMATED_SURFACE_NORMAL
        else -> false
    }

    /** One more point at the cross: the first, the second, or (with both) a new first. Anchored, so it stays put. */
    fun addPoint() {
        val hit = aim ?: return
        val an = try { hit.createAnchor() } catch (e: Exception) { return }
        if (a == null || b != null) { a?.detach(); b?.detach(); a = an; b = null } else b = an
    }

    fun reset() { a?.detach(); b?.detach(); a = null; b = null }

    fun clearPoints() { /* the cloud keeps what it has: a second ▶ Gyűjtés adds to it */ }

    private fun collect(frame: Frame) {
        frames++
        val cam = frame.camera
        val pose = FloatArray(16); cam.pose.toMatrix(pose, 0)
        val c = doubleArrayOf(cam.pose.tx().toDouble(), cam.pose.ty().toDouble(), cam.pose.tz().toDouble())
        val z = cam.pose.zAxis
        synchronized(cloud) {
            cloud.camera(c, doubleArrayOf(-z[0].toDouble(), -z[1].toDouble(), -z[2].toDouble()))
            // ARCore's feature points: few, everywhere, every frame
            try {
                frame.acquirePointCloud().use { pc ->
                    val p = pc.points
                    while (p.remaining() >= 4) {
                        val x = p.get(); val y = p.get(); val zz = p.get(); val conf = p.get()
                        if (conf >= 0.3f) cloud.add(x.toDouble(), y.toDouble(), zz.toDouble())
                    }
                }
            } catch (e: Exception) { }
        }
        // Raw Depth: many, near, every third frame, coloured from the camera image
        if (!state.depth || frames % 3 != 0) return
        try {
            frame.acquireRawDepthImage16Bits().use { d ->
                frame.acquireRawDepthConfidenceImage().use { cf ->
                    val dw = d.width; val dh = d.height
                    val dp = d.planes[0]; val db = dp.buffer.order(ByteOrder.nativeOrder())
                    val depth = ShortArray(dw * dh)
                    for (v in 0 until dh) for (u in 0 until dw) depth[v * dw + u] = db.getShort(v * dp.rowStride + u * dp.pixelStride)
                    val cp = cf.planes[0]; val cb = cp.buffer
                    val conf = ByteArray(dw * dh)
                    for (v in 0 until dh) for (u in 0 until dw) conf[v * dw + u] = cb.get(v * cp.rowStride + u * cp.pixelStride)
                    val k = cam.textureIntrinsics
                    val f = k.focalLength; val pp = k.principalPoint; val dim = k.imageDimensions
                    val sx = dw.toDouble() / dim[0]; val sy = dh.toDouble() / dim[1]
                    val pix = ArrayList<Int>()
                    val pts = Ar.unproject(depth, conf, dw, dh, f[0] * sx, f[1] * sy, pp[0] * sx, pp[1] * sy, pose, step = 3, pix = pix)
                    val colors = colors(frame, pix, dw, dh)
                    synchronized(cloud) { cloud.addAll(pts, colors, fromDepth = true) }
                }
            }
        } catch (e: NotYetAvailableException) { } catch (e: Exception) { VrgLog.w("sketch", "AR mélység: ${e.message}") }
    }

    /** The colour of each depth pixel from the camera's CPU image (YUV 4:2:0, the same view as the depth image). */
    private fun colors(frame: Frame, pix: List<Int>, dw: Int, dh: Int): IntArray? = try {
        frame.acquireCameraImage().use { img ->
            val iw = img.width; val ih = img.height
            val yP = img.planes[0]; val uP = img.planes[1]; val vP = img.planes[2]
            val out = IntArray(pix.size / 2)
            for (i in out.indices) {
                val x = min(iw - 1, (pix[2 * i] * iw / dw)); val y = min(ih - 1, (pix[2 * i + 1] * ih / dh))
                val yy = yP.buffer.get(y * yP.rowStride + x * yP.pixelStride).toInt() and 0xff
                val ci = (y / 2) * uP.rowStride + (x / 2) * uP.pixelStride
                val cv = (y / 2) * vP.rowStride + (x / 2) * vP.pixelStride
                out[i] = Ar.rgb(yy, uP.buffer.get(ci).toInt() and 0xff, vP.buffer.get(cv).toInt() and 0xff)
            }
            out
        }
    } catch (e: Exception) { null }

    fun startRecording(f: File) {
        try {
            session.startRecording(RecordingConfig(session).setMp4DatasetUri(Uri.fromFile(f)).setAutoStopOnPause(true))
            state.recording = true
        } catch (e: Exception) { VrgLog.w("sketch", "AR felvétel: ${e.message}"); state.hint = "A felvétel nem indult: ${e.message}" }
    }

    fun stopRecording() {
        try { if (session.recordingStatus == RecordingStatus.OK) session.stopRecording() } catch (e: Exception) { VrgLog.w("sketch", "AR felvétel: ${e.message}") }
        state.recording = false
    }
}

/** The camera picture: ARCore's external texture on a full-screen quad, its corners from the frame's display geometry. */
private class ArBackground {
    var tex = 0; private set
    private var prog = 0; private var aPos = 0; private var aTex = 0
    private val quad: FloatBuffer = floats(floatArrayOf(-1f, -1f, 1f, -1f, -1f, 1f, 1f, 1f))
    private val uv: FloatBuffer = floats(FloatArray(8))

    fun create() {
        val t = IntArray(1); GLES20.glGenTextures(1, t, 0); tex = t[0]
        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, tex)
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
        prog = program(
            "attribute vec4 p; attribute vec2 t; varying vec2 v; void main() { gl_Position = p; v = t; }",
            "#extension GL_OES_EGL_image_external : require\nprecision mediump float; varying vec2 v; uniform samplerExternalOES s; void main() { gl_FragColor = texture2D(s, v); }")
        aPos = GLES20.glGetAttribLocation(prog, "p"); aTex = GLES20.glGetAttribLocation(prog, "t")
    }

    fun draw(frame: Frame) {
        if (frame.hasDisplayGeometryChanged()) {
            quad.position(0); uv.position(0)
            frame.transformCoordinates2d(Coordinates2d.OPENGL_NORMALIZED_DEVICE_COORDINATES, quad, Coordinates2d.TEXTURE_NORMALIZED, uv)
        }
        if (frame.timestamp == 0L) return
        GLES20.glDisable(GLES20.GL_DEPTH_TEST); GLES20.glDepthMask(false)
        GLES20.glUseProgram(prog)
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, tex)
        quad.position(0); uv.position(0)
        GLES20.glVertexAttribPointer(aPos, 2, GLES20.GL_FLOAT, false, 0, quad)
        GLES20.glVertexAttribPointer(aTex, 2, GLES20.GL_FLOAT, false, 0, uv)
        GLES20.glEnableVertexAttribArray(aPos); GLES20.glEnableVertexAttribArray(aTex)
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
        GLES20.glDisableVertexAttribArray(aPos); GLES20.glDisableVertexAttribArray(aTex)
        GLES20.glDepthMask(true)
    }
}

/** Points and lines in the world (metres), one colour each, drawn over the picture. */
private class ArLines {
    private var prog = 0; private var aPos = 0; private var uMvp = 0; private var uCol = 0; private var uSize = 0
    private val two: FloatBuffer = floats(FloatArray(6))

    fun create() {
        prog = program(
            "uniform mat4 m; uniform float s; attribute vec3 p; void main() { gl_Position = m * vec4(p, 1.0); gl_PointSize = s; }",
            "precision mediump float; uniform vec4 c; void main() { gl_FragColor = c; }")
        aPos = GLES20.glGetAttribLocation(prog, "p"); uMvp = GLES20.glGetUniformLocation(prog, "m")
        uCol = GLES20.glGetUniformLocation(prog, "c"); uSize = GLES20.glGetUniformLocation(prog, "s")
    }

    private fun draw(vp: FloatArray, buf: FloatBuffer, n: Int, col: FloatArray, size: Float, modeGl: Int) {
        GLES20.glDisable(GLES20.GL_DEPTH_TEST)
        GLES20.glEnable(GLES20.GL_BLEND); GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA)
        GLES20.glUseProgram(prog)
        GLES20.glUniformMatrix4fv(uMvp, 1, false, vp, 0)
        GLES20.glUniform4fv(uCol, 1, col, 0)
        GLES20.glUniform1f(uSize, size)
        buf.position(0)
        GLES20.glVertexAttribPointer(aPos, 3, GLES20.GL_FLOAT, false, 0, buf)
        GLES20.glEnableVertexAttribArray(aPos)
        GLES20.glLineWidth(6f)
        GLES20.glDrawArrays(modeGl, 0, n)
        GLES20.glDisableVertexAttribArray(aPos)
        GLES20.glDisable(GLES20.GL_BLEND)
    }

    fun points(vp: FloatArray, buf: FloatBuffer, n: Int, col: FloatArray, size: Float) = draw(vp, buf, n, col, size, GLES20.GL_POINTS)

    fun segment(vp: FloatArray, a: DoubleArray, b: DoubleArray, col: FloatArray) {
        two.position(0); two.put(floatArrayOf(a[0].toFloat(), a[1].toFloat(), a[2].toFloat(), b[0].toFloat(), b[1].toFloat(), b[2].toFloat()))
        draw(vp, two, 2, col, 1f, GLES20.GL_LINES)
    }

    fun dot(vp: FloatArray, p: DoubleArray, col: FloatArray, size: Float) {
        two.position(0); two.put(floatArrayOf(p[0].toFloat(), p[1].toFloat(), p[2].toFloat(), 0f, 0f, 0f))
        draw(vp, two, 1, col, size, GLES20.GL_POINTS)
    }
}

private fun floats(a: FloatArray): FloatBuffer = ByteBuffer.allocateDirect(4 * a.size).order(ByteOrder.nativeOrder()).asFloatBuffer().apply { put(a); position(0) }

private fun shader(type: Int, src: String): Int {
    val s = GLES20.glCreateShader(type)
    GLES20.glShaderSource(s, src); GLES20.glCompileShader(s)
    val ok = IntArray(1); GLES20.glGetShaderiv(s, GLES20.GL_COMPILE_STATUS, ok, 0)
    if (ok[0] == 0) VrgLog.w("sketch", "AR shader: " + GLES20.glGetShaderInfoLog(s))
    return s
}

private fun program(vs: String, fs: String): Int {
    val p = GLES20.glCreateProgram()
    GLES20.glAttachShader(p, shader(GLES20.GL_VERTEX_SHADER, vs)); GLES20.glAttachShader(p, shader(GLES20.GL_FRAGMENT_SHADER, fs))
    GLES20.glLinkProgram(p)
    return p
}
