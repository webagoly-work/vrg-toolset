package hu.vrg.mobile.net

import android.content.Context
import android.os.Build
import hu.vrg.mobile.core.PairedPc
import hu.vrg.mobile.core.RelayAddress
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.relay.PhoneKey
import hu.vrg.mobile.kit.relay.Relay
import hu.vrg.mobile.relay.CodeBook
import hu.vrg.mobile.relay.FileTrust
import hu.vrg.mobile.relay.PairCodes
import hu.vrg.mobile.relay.PhoneRelay
import hu.vrg.mobile.relay.TrustedDevice
import hu.vrg.mobile.relay.WsServer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.security.SecureRandom

// The phone's own relay (D-9 = A) on the phone: relay-core's PhoneRelay behind its WsServer, started and stopped
// only by the user (NetService holds it in the foreground). Off by default; never started at boot.
//
// Who may connect: PCs paired with a code shown here (relay-core Trust.kt), and this phone itself as "self"
// (Légegér's link to 127.0.0.1 signs with the phone's Keystore key, through kit Relay.localPairing). The paired
// PCs are kept in noBackupFilesDir, so they never travel in a backup.

object PhoneRelayHost {
    private const val TAG = "phone-relay"
    private const val PREFS = "net"

    data class State(val running: Boolean = false, val port: Int = 0, val error: String? = null)

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state
    private val _peers = MutableStateFlow<List<PhoneRelay.Peer>>(emptyList())
    val peers: StateFlow<List<PhoneRelay.Peer>> = _peers
    private val _devices = MutableStateFlow<List<TrustedDevice>>(emptyList())
    val devices: StateFlow<List<TrustedDevice>> = _devices
    private val _code = MutableStateFlow<CodeBook.Live?>(null)
    val code: StateFlow<CodeBook.Live?> = _code

    private var server: WsServer? = null
    private var relay: PhoneRelay? = null
    private var ticker: Job? = null

    /** This phone's id as a relay: stable across starts, so a paired PC finds it again. */
    fun selfId(ctx: Context): String {
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return p.getString("relayId", null) ?: PairCodes.hex(SecureRandom(), 8).also { p.edit().putString("relayId", it).apply() }
    }

    @Synchronized
    fun start(ctx: Context) {
        if (server != null) return
        val app = ctx.applicationContext
        val id = selfId(app)
        val selfPub = try { PhoneKey.publicKeyB64() } catch (e: Exception) { VrgLog.w(TAG, "Saját kulcs: ${e.message}"); null }
        val r = PhoneRelay(FileTrust(app.noBackupFilesDir.resolve("phone-relay-paired.json")), id,
            Build.MODEL ?: "telefon", selfPub, log = { VrgLog.i(TAG, it) })
        r.onChange = { refresh() }
        val s = WsServer(r, log = { VrgLog.i(TAG, it) })
        val port = try { s.start(RelayAddress.DEFAULT_PORT) } catch (e: Exception) {
            _state.value = State(false, 0, "Nem indult: ${e.message}")
            VrgLog.w(TAG, "Nem indult: ${e.message}")
            return
        }
        relay = r; server = s
        Relay.localPairing = { pcId -> if (pcId == id) PairedPc(PhoneRelay.SELF_ID, id, "Ez a telefon", "ws://127.0.0.1:$port", 0) else null }
        ticker = scope.launch { while (isActive) { delay(5_000); r.tick(); _code.value = r.codes.current() } }
        _state.value = State(true, port, null)
        refresh()
        VrgLog.i(TAG, "Telefon relé fut: $port")
    }

    @Synchronized
    fun stop() {
        ticker?.cancel(); ticker = null
        server?.stop(); server = null
        relay = null
        _code.value = null
        _peers.value = emptyList()
        _state.value = State()
        VrgLog.i(TAG, "Telefon relé leállítva")
    }

    /** A fresh pairing code (the old one is retired). */
    fun newCode(): CodeBook.Live? = relay?.codes?.issue().also { _code.value = it }

    fun cancelCode() { relay?.codes?.cancel(); _code.value = null }

    fun forget(id: String) { relay?.forget(id); refresh() }

    /** The paired PCs, readable while the relay is off too. */
    fun loadDevices(ctx: Context) {
        if (relay == null) _devices.value = FileTrust(ctx.applicationContext.noBackupFilesDir.resolve("phone-relay-paired.json")).list()
    }

    fun forgetOffline(ctx: Context, id: String) {
        FileTrust(ctx.applicationContext.noBackupFilesDir.resolve("phone-relay-paired.json")).remove(id)
        loadDevices(ctx)
    }

    private fun refresh() {
        val r = relay ?: return
        _peers.value = r.peers()
        _devices.value = r.devices()
        _code.value = r.codes.current()
    }
}
