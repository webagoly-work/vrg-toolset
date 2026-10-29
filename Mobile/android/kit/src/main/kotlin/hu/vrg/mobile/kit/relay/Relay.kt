package hu.vrg.mobile.kit.relay

import android.content.Context
import android.os.Build
import hu.vrg.mobile.core.PairOffer
import hu.vrg.mobile.core.PairedPc
import hu.vrg.mobile.core.RelayAddress
import hu.vrg.mobile.core.RelayMsgs
import hu.vrg.mobile.core.RelayNote
import hu.vrg.mobile.kit.ShellSettings
import hu.vrg.mobile.kit.VrgLog
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
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

// The app's one link to the PC relay (Planner/projects/varler-planner/tools/phone-relay-server.js),
// lifted out of Légegér in WP M2 so every feature shares it: Légegér's deck, QR párosítás, and later
// Localhost, Indítópult and Átadás. It owns the socket (connect, reconnect every 2 s, the hello) and
// the trust handshake; what the messages mean to a feature stays in that feature, which reads
// [incoming] and writes with [send].
//
//   connect ─ hello ─▶ welcome{challenge, pc} ─┬─ paired with this PC?  auth{id, sig} ─▶ trust{ok}
//                                              └─ a QR offer pending?  pair{code, pub} ─▶ paired{ok}

enum class LinkState { OFF, CONNECTING, OPEN }

/** NONE: this PC does not know the phone (an ordinary phone). CHECKING: signature sent. */
enum class Trust { NONE, CHECKING, TRUSTED, REFUSED }

/** The PC on the other end, from its welcome. */
data class RelayPc(val id: String, val name: String)

data class PairResult(val ok: Boolean, val pcName: String?, val reason: String?)

object Relay {
    const val APP = "vrg-mobile"
    private const val TAG = "relay"

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val http = OkHttpClient.Builder()
        .connectTimeout(4, TimeUnit.SECONDS)
        .pingInterval(15, TimeUnit.SECONDS)        // a dead WiFi shows up within seconds, not minutes
        .build()

    private val _state = MutableStateFlow(LinkState.OFF)
    val state: StateFlow<LinkState> = _state
    private val _trust = MutableStateFlow(Trust.NONE)
    val trust: StateFlow<Trust> = _trust
    private val _pc = MutableStateFlow<RelayPc?>(null)
    val pc: StateFlow<RelayPc?> = _pc
    private val _incoming = MutableSharedFlow<String>(extraBufferCapacity = 64)
    /** Every message from the relay, as text, for the features to parse. */
    val incoming: SharedFlow<String> = _incoming
    private val _pairResults = MutableSharedFlow<PairResult>(extraBufferCapacity = 4)
    val pairResults: SharedFlow<PairResult> = _pairResults
    /** Messages in / out: the first thing to look at when a button seems dead. */
    private val _traffic = MutableStateFlow(0 to 0)
    val traffic: StateFlow<Pair<Int, Int>> = _traffic

    var url: String = ""
        private set
    private var ws: WebSocket? = null
    private var retry: Job? = null
    private var challenge: String? = null
    private var pending: PairOffer? = null
    private var pairTimeout: Job? = null
    private val caps = linkedSetOf("state", "cmd")

    /** A feature's relay abilities, announced in the hello. Call from init(), before the link opens. */
    @Synchronized
    fun addCaps(more: Collection<String>) { caps += more }

    /** From Application.onCreate, after ShellSettings and the features: reconnects to the last relay. */
    fun init(@Suppress("UNUSED_PARAMETER") ctx: Context) {
        val u = ShellSettings.value.relayUrl
        if (u.isNotEmpty()) open(u)
    }

    fun connect(raw: String) {
        val u = RelayAddress.normalize(raw)
        ShellSettings.update { it.copy(relayUrl = u) }
        open(u)
    }

    /** [forget] = false only drops the line for now (Légegér's "Leállítás"); the next start reconnects. */
    fun disconnect(forget: Boolean = true) {
        if (forget) ShellSettings.update { it.copy(relayUrl = "") }
        url = ""
        retry?.cancel()
        ws?.close(1000, null)
        ws = null
        reset(LinkState.OFF)
    }

    val isOpen: Boolean get() = _state.value == LinkState.OPEN

    fun send(text: String): Boolean {
        val s = ws ?: return false
        if (_state.value != LinkState.OPEN) return false
        val ok = s.send(text)
        if (ok) _traffic.value = _traffic.value.first to _traffic.value.second + 1
        return ok
    }

    /** Pairs with the PC whose QR was scanned: connects to it if needed, then sends the code. */
    fun pair(offer: PairOffer) {
        pending = offer
        pairTimeout?.cancel()
        pairTimeout = scope.launch {
            delay(10_000)
            if (pending === offer) {
                pending = null
                _pairResults.tryEmit(PairResult(false, offer.pcName, "A PC nem válaszol (${offer.ws}). Fut a relé, és egy WiFi-n vagytok?"))
            }
        }
        VrgLog.i(TAG, "Párosítás: ${offer.pcName.ifBlank { offer.ws }}")
        if (url == offer.ws && isOpen && challenge != null) sendPair(offer) else connect(offer.ws)
    }

    /** Removes a pairing on the phone, and on the PC too when it is the one connected and trusted. */
    fun forget(pc: PairedPc) {
        if (_pc.value?.id == pc.pcId && _trust.value == Trust.TRUSTED) send(RelayMsgs.unpair(pc.id))
        if (_pc.value?.id == pc.pcId) _trust.value = Trust.NONE
        ShellSettings.update { it.withoutPc(pc.pcId) }
        VrgLog.i(TAG, "Párosítás törölve: ${pc.name}")
    }

    // ---- the socket ------------------------------------------------------------------------------

    private fun open(u: String) {
        url = u
        retry?.cancel()
        ws?.close(1000, null)
        ws = null
        if (u.isEmpty()) { reset(LinkState.OFF); return }
        reset(LinkState.CONNECTING)
        val req = try { Request.Builder().url(u).build() } catch (e: IllegalArgumentException) {
            reset(LinkState.OFF)
            VrgLog.w(TAG, "Hibás relé cím: $u")
            return
        }
        ws = http.newWebSocket(req, listener)
    }

    private fun reset(s: LinkState) {
        _state.value = s
        _trust.value = Trust.NONE
        _pc.value = null
        challenge = null
    }

    private fun scheduleRetry() {
        retry?.cancel()
        if (url.isEmpty()) return
        retry = scope.launch { delay(2000); if (url.isNotEmpty() && ws == null) open(url) }
    }

    private val listener = object : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            if (webSocket !== ws) return
            webSocket.send(RelayMsgs.hello(APP, synchronized(this@Relay) { caps.toList() }))
            _state.value = LinkState.OPEN
            VrgLog.i(TAG, "Kapcsolódva: $url")
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            if (webSocket !== ws) return
            _traffic.value = _traffic.value.first + 1 to _traffic.value.second
            RelayMsgs.parse(text)?.let { onNote(it) }
            _incoming.tryEmit(text)
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) = lost(webSocket)

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) = lost(webSocket)

        private fun lost(webSocket: WebSocket) {
            if (webSocket !== ws) return
            ws = null
            if (_state.value == LinkState.OPEN) VrgLog.i(TAG, "Megszakadt: $url")
            reset(if (url.isEmpty()) LinkState.OFF else LinkState.CONNECTING)
            scheduleRetry()
        }
    }

    // ---- the trust handshake ---------------------------------------------------------------------

    private fun onNote(n: RelayNote) {
        when (n) {
            is RelayNote.Welcome -> {
                challenge = n.challenge
                _pc.value = RelayPc(n.pcId, n.pcName)
                val offer = pending
                val known = ShellSettings.value.pcById(n.pcId)
                when {
                    offer != null -> sendPair(offer)
                    known != null -> auth(known, n.challenge)
                    else -> _trust.value = Trust.NONE
                }
            }
            is RelayNote.Paired -> {
                val offer = pending ?: return
                pending = null
                pairTimeout?.cancel()
                val id = n.id
                val pcId = n.pcId
                if (n.ok && id != null && pcId != null) {
                    val name = n.pcName ?: offer.pcName
                    ShellSettings.update { it.withPc(PairedPc(id, pcId, name, url, System.currentTimeMillis())) }
                    _trust.value = Trust.TRUSTED
                    VrgLog.i(TAG, "Párosítva és megbízható: $name")
                    _pairResults.tryEmit(PairResult(true, name, null))
                } else {
                    VrgLog.w(TAG, "Párosítás sikertelen: ${n.reason ?: "?"}")
                    _pairResults.tryEmit(PairResult(false, n.pcName ?: offer.pcName, n.reason))
                }
            }
            is RelayNote.Trust -> {
                n.challenge?.let { challenge = it }
                val known = ShellSettings.value.pcById(n.pcId ?: _pc.value?.id)
                if (n.ok) {
                    _trust.value = Trust.TRUSTED
                    // the PC's address may have changed since the pairing: remember the one that works
                    if (known != null && known.relay != url) ShellSettings.update { it.withPc(known.copy(relay = url)) }
                    VrgLog.i(TAG, "Megbízható: ${known?.name ?: _pc.value?.name}")
                } else if (known != null && (n.id == null || n.id == known.id)) {
                    // the PC no longer knows this phone (removed on the PC): the pairing is gone here too
                    _trust.value = Trust.REFUSED
                    ShellSettings.update { it.withoutPc(known.pcId) }
                    VrgLog.w(TAG, "A PC törölte a párosítást: ${known.name}")
                }
            }
        }
    }

    private fun auth(pc: PairedPc, ch: String) {
        _trust.value = Trust.CHECKING
        scope.launch {
            val sig = try { PhoneKey.sign(ch, pc.id) } catch (e: Exception) {
                VrgLog.w(TAG, "Aláírás hiba: ${e.message}")
                _trust.value = Trust.NONE
                return@launch
            }
            send(RelayMsgs.auth(pc.id, sig))
        }
    }

    private fun sendPair(offer: PairOffer) {
        scope.launch {
            val pub = try { PhoneKey.publicKeyB64() } catch (e: Exception) {
                pending = null
                _pairResults.tryEmit(PairResult(false, offer.pcName, "A telefon kulcsa nem készült el: ${e.message}"))
                return@launch
            }
            send(RelayMsgs.pair(offer.code, Build.MODEL ?: "telefon", pub))
        }
    }
}
