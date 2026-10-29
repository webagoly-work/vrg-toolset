package hu.vrg.legeger.relay

import hu.vrg.legeger.core.Envelopes
import hu.vrg.legeger.core.Focus
import hu.vrg.legeger.core.Inbound
import hu.vrg.legeger.core.Incoming
import hu.vrg.legeger.core.Peer
import hu.vrg.legeger.core.RelayUrl
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit

// The WiFi half: a WebSocket to Planner/projects/varler-planner/tools/phone-relay-server.js.
// Same job the old phone-sender.html did (hello, reconnect every 2 s, tool pad from the app's hello,
// state readout, nack notes), now for several apps at once: every app's hello, state and focus is
// kept per role.

class RelayClient(private val scope: CoroutineScope) {

    enum class Link { OFF, CONNECTING, OPEN }

    private val http = OkHttpClient.Builder()
        .connectTimeout(4, TimeUnit.SECONDS)
        .pingInterval(15, TimeUnit.SECONDS)        // a dead WiFi shows up within seconds, not minutes
        .build()

    private val _link = MutableStateFlow(Link.OFF)
    val link: StateFlow<Link> = _link
    private val _hellos = MutableStateFlow<Map<String, Incoming.Hello>>(emptyMap())
    val hellos: StateFlow<Map<String, Incoming.Hello>> = _hellos
    private val _states = MutableStateFlow<Map<String, Map<String, Any?>>>(emptyMap())
    val states: StateFlow<Map<String, Map<String, Any?>>> = _states
    private val _focus = MutableStateFlow<Focus?>(null)
    val focus: StateFlow<Focus?> = _focus
    private val _peers = MutableStateFlow<List<Peer>>(emptyList())
    val peers: StateFlow<List<Peer>> = _peers
    private val _shots = MutableSharedFlow<Incoming.Shot>(extraBufferCapacity = 4)
    /** The relay's answers to screenshot requests. */
    val shots: SharedFlow<Incoming.Shot> = _shots
    private val _notes = MutableSharedFlow<String>(extraBufferCapacity = 8)
    val notes: SharedFlow<String> = _notes

    /** Messages in / out, like the Planner panel's counters: the first thing to look at when a button seems dead. */
    private val _traffic = MutableStateFlow(0 to 0)
    val traffic: StateFlow<Pair<Int, Int>> = _traffic

    var url: String = ""
        private set
    private var ws: WebSocket? = null
    private var env = Envelopes()
    private var retry: Job? = null

    fun connect(u: String) {
        url = normalize(u)
        retry?.cancel()
        ws?.close(1000, null)
        ws = null
        if (url.isEmpty()) { _link.value = Link.OFF; return }
        open()
    }

    fun disconnect() {
        url = ""
        retry?.cancel()
        ws?.close(1000, null)
        ws = null
        _link.value = Link.OFF
        clearPeers()
    }

    val isOpen: Boolean get() = _link.value == Link.OPEN

    /** Builds with this connection's sequence counter and sends. False when there is no link. */
    fun send(build: (Envelopes) -> String): Boolean {
        val s = ws ?: return false
        if (_link.value != Link.OPEN) return false
        val ok = s.send(build(env))
        if (ok) _traffic.value = _traffic.value.first to _traffic.value.second + 1
        return ok
    }

    private fun open() {
        _link.value = Link.CONNECTING
        env = Envelopes()
        val req = try { Request.Builder().url(url).build() } catch (e: IllegalArgumentException) {
            _link.value = Link.OFF
            _notes.tryEmit("Hibás relé cím: $url")
            return
        }
        ws = http.newWebSocket(req, listener)
    }

    private fun scheduleRetry() {
        retry?.cancel()
        if (url.isEmpty()) return
        retry = scope.launch { delay(2000); if (url.isNotEmpty()) open() }
    }

    private fun clearPeers() {
        _hellos.value = emptyMap(); _states.value = emptyMap(); _peers.value = emptyList(); _focus.value = null
    }

    private val listener = object : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            if (webSocket !== ws) return
            _link.value = Link.OPEN
            webSocket.send(env.hello())
            webSocket.send(env.stateRequest(null))
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            if (webSocket !== ws) return
            _traffic.value = _traffic.value.first + 1 to _traffic.value.second
            when (val m = Inbound.parse(text)) {
                is Incoming.Hello -> {
                    if (m.role == "phone") return
                    _hellos.value = _hellos.value + (m.role to m)
                    webSocket.send(env.stateRequest(m.role))
                }
                is Incoming.State -> _states.value = _states.value + (m.role to m.fields)
                is Incoming.Ack -> if (!m.ok) _notes.tryEmit("elutasítva: ${m.id}" + (m.reason?.let { " — $it" } ?: ""))
                is Incoming.FocusChanged -> _focus.value = m.focus
                is Incoming.Shot -> _shots.tryEmit(m)
                is Incoming.Roster -> {
                    _peers.value = m.peers
                    val live = m.peers.map { it.role }.toSet()
                    _hellos.value = _hellos.value.filterKeys { it in live }
                    _states.value = _states.value.filterKeys { it in live }
                    _focus.value = m.focus
                }
                else -> {}
            }
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) = lost(webSocket)

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) = lost(webSocket)

        private fun lost(webSocket: WebSocket) {
            if (webSocket !== ws) return
            ws = null
            _link.value = if (url.isEmpty()) Link.OFF else Link.CONNECTING
            clearPeers()
            scheduleRetry()
        }
    }

    companion object {
        fun normalize(raw: String): String = RelayUrl.normalize(raw)
    }
}
