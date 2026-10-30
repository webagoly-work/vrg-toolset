package hu.vrg.legeger.relay

import hu.vrg.legeger.core.Envelopes
import hu.vrg.legeger.core.Focus
import hu.vrg.legeger.core.Inbound
import hu.vrg.legeger.core.Incoming
import hu.vrg.legeger.core.Peer
import hu.vrg.legeger.core.RelayUrl
import hu.vrg.mobile.kit.relay.LinkState
import hu.vrg.mobile.kit.relay.Relay
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

// Légegér's view of the relay: every app's hello, state and focus kept per role, the tool pad from the
// app's hello, nack notes and screenshots. Since WP M2 the socket itself is the app's shared link
// (kit: Relay), so Légegér, QR párosítás and the later features all ride one connection and one trust.

class RelayClient(private val scope: CoroutineScope) {

    val link: StateFlow<LinkState> get() = Relay.state
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
    val traffic: StateFlow<Pair<Int, Int>> get() = Relay.traffic

    val url: String get() = Relay.url
    private var env = Envelopes()

    init {
        scope.launch {
            Relay.state.collect { s ->
                if (s == LinkState.OPEN) {
                    env = Envelopes()
                    Relay.send(env.stateRequest(null))
                } else clearPeers()
            }
        }
        scope.launch { Relay.incoming.collect(::onMessage) }
    }

    fun connect(u: String) = Relay.connect(u)

    fun disconnect(forget: Boolean = true) = Relay.disconnect(forget)

    val isOpen: Boolean get() = Relay.isOpen

    /** Builds with this connection's sequence counter and sends. False when there is no link. */
    fun send(build: (Envelopes) -> String): Boolean = Relay.isOpen && Relay.send(build(env))

    private fun clearPeers() {
        _hellos.value = emptyMap(); _states.value = emptyMap(); _peers.value = emptyList(); _focus.value = null
    }

    private fun onMessage(text: String) {
        when (val m = Inbound.parse(text)) {
            is Incoming.Hello -> {
                if (m.role == "phone") return
                _hellos.value = _hellos.value + (m.role to m)
                Relay.send(env.stateRequest(m.role))
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

    companion object {
        fun normalize(raw: String): String = RelayUrl.normalize(raw)
    }
}
