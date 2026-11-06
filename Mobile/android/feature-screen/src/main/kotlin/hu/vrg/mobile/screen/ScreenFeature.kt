package hu.vrg.mobile.screen

import android.app.Application
import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.FrameMeter
import hu.vrg.mobile.core.FrameParse
import hu.vrg.mobile.core.Screen
import hu.vrg.mobile.core.ScreenEvent
import hu.vrg.mobile.core.ScreenMode
import hu.vrg.mobile.core.ScreenMonitor
import hu.vrg.mobile.core.ScreenMsgs
import hu.vrg.mobile.core.ScreenNote
import hu.vrg.mobile.core.ScreenQuality
import hu.vrg.mobile.core.ScreenSettings
import hu.vrg.mobile.core.ScreenState
import hu.vrg.mobile.core.ScreenStop
import hu.vrg.mobile.core.ScreenTicket
import hu.vrg.mobile.core.ScreenViewer
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.Pointer
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.relay.LinkState
import hu.vrg.mobile.kit.relay.Relay
import hu.vrg.mobile.kit.relay.Trust
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import java.util.concurrent.TimeUnit

// Képernyő (WP M13): the PC's screen, live. A trusted link asks the relay for a one-connection ticket,
// then frames come on their own WebSocket (/screen), so they never hold up the app's relay link. The
// reader decodes one frame at a time on OkHttp's thread: while it is busy the socket is not read, and
// the relay drops frames instead of queueing them. A slow phone sees fewer frames, never older ones.
// The stream stops when the view is left, the app goes to the background (Home, the screen off) and
// after 30 minutes; the PC shows a notice window the whole time. Steering uses Légegér's sender through
// the kit (Pointer); tapping the picture does nothing on the PC.

object ScreenFeature : VrgFeature {
    override val info = Catalogue.SCREEN
    private const val TAG = "screen"
    private const val TICKET_TIMEOUT_MS = 10_000L

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val http = OkHttpClient.Builder()
        .connectTimeout(4, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)         // a keep-alive frame comes every 5 s at least
        .pingInterval(10, TimeUnit.SECONDS)
        .build()

    val state = MutableStateFlow<ScreenState>(ScreenState.Idle)
    val image = MutableStateFlow<ImageBitmap?>(null)
    val monitors = MutableStateFlow<List<ScreenMonitor>>(emptyList())
    val settings = MutableStateFlow(ScreenSettings())
    val meter = MutableStateFlow("")
    private val frames = FrameMeter()
    private var ws: WebSocket? = null
    private var ticketWait: CompletableDeferred<ScreenTicket>? = null
    private var limit: Job? = null
    private var ticker: Job? = null
    private var onScreen = false

    override fun init(app: Application) {
        Relay.addCaps(listOf(Screen.CAP))
        scope.launch { Relay.incoming.collect { raw -> ScreenMsgs.parseTicket(raw)?.let { ticketWait?.complete(it) } } }
        // a pairing lost on this side (or refused by the PC) ends the stream here too
        scope.launch { Relay.trust.collect { if (it != Trust.TRUSTED && it != Trust.CHECKING) stop(ScreenStop.UNTRUSTED) } }
    }

    @Synchronized
    private fun event(e: ScreenEvent) {
        val was = state.value
        val now = ScreenViewer.next(was, e)
        if (now == was) return
        state.value = now
        if (now is ScreenState.Stopped) {
            limit?.cancel(); ticker?.cancel()
            ws?.close(1000, null); ws = null
            Pointer.sink?.hold(false)
            VrgLog.i(TAG, "Leállt: ${now.why.name.lowercase()}")
        }
    }

    // ---- start and stop ---------------------------------------------------------------------------

    fun start() {
        if (ScreenViewer.running(state.value)) return
        event(ScreenEvent.Start)
        frames.reset(); meter.value = ""
        scope.launch {
            if (Relay.trust.value != Trust.TRUSTED) {
                event(ScreenEvent.TicketRefused(null, busy = false, trusted = false)); return@launch
            }
            val url = Screen.socketUrl(Relay.url) ?: run { event(ScreenEvent.TicketRefused("Hibás relé cím.", false, true)); return@launch }
            val d = CompletableDeferred<ScreenTicket>()
            ticketWait = d
            val t = try {
                if (!Relay.send(ScreenMsgs.ticket())) null else withTimeoutOrNull(TICKET_TIMEOUT_MS) { d.await() }
            } finally { ticketWait = null }
            if (t == null) { event(ScreenEvent.TicketRefused("A relé nem válaszolt.", false, true)); return@launch }
            if (!t.ok || t.ticket == null) { event(ScreenEvent.TicketRefused(t.reason, t.busy, t.trusted)); return@launch }
            if (state.value !is ScreenState.Connecting) return@launch            // left while waiting
            val req = Request.Builder().url(url).header(Screen.TICKET_HEADER, t.ticket!!).build()
            synchronized(this@ScreenFeature) { ws = http.newWebSocket(req, Listener()) }
            limit?.cancel()
            limit = scope.launch { delay(Screen.LIMIT_MS); event(ScreenEvent.Limit) }
            ticker?.cancel()
            ticker = scope.launch { while (true) { delay(1000); meter.value = frames.line(System.currentTimeMillis()) } }
            VrgLog.i(TAG, "Nézés indul: ${Relay.pc.value?.name ?: Relay.url}")
        }
    }

    fun stop(why: ScreenStop) = event(ScreenEvent.Stop(why))

    fun change(s: ScreenSettings) {
        settings.value = s
        ws?.send(ScreenMsgs.set(s))
    }

    private class Listener : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            if (webSocket !== ws) return
            event(ScreenEvent.Opened)
            if (settings.value != ScreenSettings()) webSocket.send(ScreenMsgs.set(settings.value))
        }

        override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
            if (webSocket !== ws) return
            val b = bytes.toByteArray()
            when (val r = Screen.frame(b)) {
                is FrameParse.Ok -> {
                    frames.add(System.currentTimeMillis(), r.frame.length)
                    // a keep-alive repeats the picture already on screen: no need to decode it again
                    if (!r.frame.keepalive || image.value == null) {
                        val bmp = BitmapFactory.decodeByteArray(b, r.frame.offset, r.frame.length)
                        if (bmp != null) image.value = bmp.asImageBitmap()
                    }
                    event(ScreenEvent.Frame)
                }
                else -> VrgLog.w(TAG, "Hibás képkocka: $r")
            }
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            if (webSocket !== ws) return
            when (val n = ScreenMsgs.parse(text) ?: return) {
                is ScreenNote.Monitors -> {
                    monitors.value = n.monitors
                    if (ws != null) settings.value = n.settings
                }
                is ScreenNote.State -> event(ScreenEvent.Visible(n.visible, n.reason))
                is ScreenNote.End -> event(ScreenEvent.Ended(n.reason, n.text))
            }
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            if (webSocket === ws) event(ScreenEvent.Closed(code))
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            if (webSocket !== ws) return
            val status = response?.code ?: 0
            if (status != 0) {
                val why = try { response?.body?.string()?.take(300) } catch (e: Exception) { null }
                VrgLog.w(TAG, "A relé elutasította ($status): ${why ?: ""}")
            }
            event(ScreenEvent.Closed(-1, status))
        }
    }

    // ---- the host's signals -----------------------------------------------------------------------

    override fun onForeground(on: Boolean) {
        val s = state.value
        if (!on) { stop(ScreenStop.BACKGROUND); return }
        // back from Home: watch again, the view is on screen (the PC shows its window again too)
        if (onScreen && s is ScreenState.Stopped && s.why == ScreenStop.BACKGROUND) start()
    }

    // ---- the screen -------------------------------------------------------------------------------

    @Composable
    override fun Screen(host: FeatureHost) {
        val st by state.collectAsStateWithLifecycle()
        val link by Relay.state.collectAsStateWithLifecycle()
        val trust by Relay.trust.collectAsStateWithLifecycle()
        val pc by Relay.pc.collectAsStateWithLifecycle()
        val running = ScreenViewer.running(st)

        DisposableEffect(Unit) {
            onScreen = true
            onDispose { onScreen = false; stop(ScreenStop.LEFT) }
        }
        LaunchedEffect(running) { host.keepScreenOn(running) }
        LaunchedEffect(trust) {
            val s = state.value
            if (trust == Trust.TRUSTED && (s is ScreenState.Idle || (s is ScreenState.Stopped && (s.why == ScreenStop.LEFT || s.why == ScreenStop.BACKGROUND)))) start()
        }

        Column(Modifier.fillMaxSize().padding(horizontal = 12.dp, vertical = 8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current),
                    modifier = Modifier.clickable { host.home() }.padding(vertical = 8.dp, horizontal = 4.dp))
                Text("KÉPERNYŐ", style = Melyviz.title.copy(fontSize = 18.sp), modifier = Modifier.padding(start = 8.dp).weight(1f))
                if (running) VrgChip("■ Leállítás") { stop(ScreenStop.LEFT) }
            }
            pc?.let { Text("${it.name} · ${Relay.url.removePrefix("ws://")}", style = Melyviz.readout) }

            when {
                link != LinkState.OPEN -> Gate("Nincs relé kapcsolat. Indítsd a relét a PC-n --shots kapcsolóval, és párosítsd a telefont.", host)
                trust == Trust.CHECKING -> Text("Azonosítás…", style = Melyviz.small, modifier = Modifier.padding(top = 8.dp))
                trust != Trust.TRUSTED -> Gate("Ez a telefon nincs párosítva ezzel a PC-vel: a képernyőt csak párosított telefon láthatja.", host)
                else -> Body(st, host)
            }
        }
    }

    @Composable
    private fun Gate(text: String, host: FeatureHost) {
        Text(text, style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 8.dp))
        Row(Modifier.padding(vertical = 6.dp)) { VrgChip("QR párosítás ›") { host.open(Catalogue.PAIR.id) } }
    }

    @Composable
    private fun ColumnScope.Body(st: ScreenState, host: FeatureHost) {
        val img by image.collectAsStateWithLifecycle()
        val line by meter.collectAsStateWithLifecycle()
        val mons by monitors.collectAsStateWithLifecycle()
        val set by settings.collectAsStateWithLifecycle()

        // the picture, with pinch zoom and pan; it is only a picture: no tap reaches the PC
        var scale by remember { mutableFloatStateOf(1f) }
        var offset by remember { mutableStateOf(Offset.Zero) }
        Box(
            Modifier.fillMaxWidth().weight(1f).padding(vertical = 6.dp).clip(RoundedCornerShape(10.dp)).background(Melyviz.abyss)
                .border(1.dp, if (st is ScreenState.Live) Melyviz.glow else Melyviz.line, RoundedCornerShape(10.dp))
                .pointerInput(Unit) {
                    detectTransformGestures { _, pan, zoom, _ ->
                        scale = (scale * zoom).coerceIn(1f, 6f)
                        offset = if (scale == 1f) Offset.Zero else offset + pan
                    }
                }
                .semantics { contentDescription = "A PC képernyője" },
            contentAlignment = Alignment.Center,
        ) {
            img?.let {
                Image(it, contentDescription = null, contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxSize().alpha(if (st is ScreenState.Live) 1f else 0.35f)
                        .graphicsLayer { scaleX = scale; scaleY = scale; translationX = offset.x; translationY = offset.y })
            }
            val over: String? = when (st) {
                ScreenState.Idle -> "Indításra kész."
                ScreenState.Connecting -> "Kapcsolódás… (a PC-n megjelenik az értesítő ablak)"
                is ScreenState.NotVisible -> st.reason
                is ScreenState.Stopped -> st.text
                ScreenState.Live -> null
            }
            if (over != null) Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(16.dp)) {
                Text(over, style = Melyviz.label.copy(color = if (st is ScreenState.Stopped || st is ScreenState.NotVisible) Melyviz.sand else Melyviz.ink),
                    textAlign = TextAlign.Center)
                if (st is ScreenState.Stopped) Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (st.why.resumable) VrgChip("▶ Folytatás") { start() }
                    if (st.why == ScreenStop.UNTRUSTED || st.why == ScreenStop.UNPAIRED) VrgChip("QR párosítás ›") { host.open(Catalogue.PAIR.id) }
                }
                if (st == ScreenState.Idle) VrgChip("▶ Indítás") { start() }
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(listOfNotNull(line.takeIf { it.isNotEmpty() && ScreenViewer.running(st) }, img?.let { "${it.width}×${it.height}" },
                if (scale > 1f) "×${"%.1f".format(scale)}" else null).joinToString(" · "),
                style = Melyviz.readout, modifier = Modifier.weight(1f))
            if (scale > 1f) Text("1:1", style = Melyviz.small.copy(color = Melyviz.current),
                modifier = Modifier.clickable { scale = 1f; offset = Offset.Zero }.padding(6.dp))
        }

        // what to show: a monitor or the active window; the quality
        Row(Modifier.horizontalScroll(rememberScrollState()).padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            for (m in mons) VrgChip(m.label, selected = set.mode == ScreenMode.SCREEN && set.monitor == m.index) {
                change(set.copy(mode = ScreenMode.SCREEN, monitor = m.index))
            }
            VrgChip(ScreenMode.WINDOW.label, selected = set.mode == ScreenMode.WINDOW) { change(set.copy(mode = ScreenMode.WINDOW)) }
            for (q in ScreenQuality.entries) VrgChip(q.label, selected = set.quality == q) { change(set.copy(quality = q)) }
        }

        PointerStrip(host)
    }

    /** Légegér's pointer on this view: hold the pad to aim with the phone (or drag on it), left and right click. */
    @Composable
    private fun PointerStrip(host: FeatureHost) {
        val ready by Pointer.ready.collectAsStateWithLifecycle()
        if (!ready) {
            Row(Modifier.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Irányítás: Légegér Bluetooth kapcsolat kell.", style = Melyviz.small, modifier = Modifier.weight(1f))
                VrgChip("Légegér ›") { host.open(Catalogue.AIRDECK.id) }
            }
            return
        }
        var held by remember { mutableStateOf(false) }
        Row(Modifier.fillMaxWidth().height(64.dp).padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(
                Modifier.weight(1f).fillMaxSize().clip(RoundedCornerShape(12.dp))
                    .background(if (held) Melyviz.raised else Melyviz.surface)
                    .border(1.dp, if (held) Melyviz.glow else Melyviz.line, RoundedCornerShape(12.dp))
                    .pointerInput(Unit) {
                        awaitEachGesture {
                            awaitFirstDown(requireUnconsumed = false)
                            held = true
                            Pointer.sink?.hold(true)
                            try {
                                while (true) {
                                    val ev = awaitPointerEvent()
                                    val c = ev.changes.firstOrNull() ?: break
                                    if (!c.pressed) break
                                    val d = c.positionChange()
                                    if (d != Offset.Zero) { Pointer.sink?.drag(d.x, d.y); c.consume() }
                                }
                            } finally {
                                held = false
                                Pointer.sink?.hold(false)
                            }
                        }
                    }
                    .semantics { contentDescription = "Egér: tartsd, és mozgasd a telefont" },
                contentAlignment = Alignment.Center,
            ) {
                Text(if (held) "Mozgatás…" else "✋ Tartsd: a telefon mozgatja az egeret", style = Melyviz.small.copy(color = if (held) Melyviz.glow else Melyviz.muted))
            }
            Box(Modifier.fillMaxSize().weight(0.32f).clip(RoundedCornerShape(12.dp)).background(Melyviz.surface)
                .border(1.dp, Melyviz.line, RoundedCornerShape(12.dp)).clickable { Pointer.sink?.click(false) }
                .semantics { contentDescription = "Bal klikk" }, contentAlignment = Alignment.Center) { Text("Bal", style = Melyviz.label) }
            Box(Modifier.fillMaxSize().weight(0.32f).clip(RoundedCornerShape(12.dp)).background(Melyviz.surface)
                .border(1.dp, Melyviz.line, RoundedCornerShape(12.dp)).clickable { Pointer.sink?.click(true) }
                .semantics { contentDescription = "Jobb klikk" }, contentAlignment = Alignment.Center) { Text("Jobb", style = Melyviz.label) }
        }
    }
}
