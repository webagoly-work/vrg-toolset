package hu.vrg.mobile.pager.app

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothServerSocket
import android.bluetooth.BluetoothSocket
import android.os.Build
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.pager.Crew
import hu.vrg.mobile.pager.LinkCodec
import hu.vrg.mobile.pager.LinkHandshake
import hu.vrg.mobile.pager.LinkMsg
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import kotlin.concurrent.thread

// The links: Bluetooth LE L2CAP connection-oriented channels (Android 10+), one per crew member in reach, for chat
// and voice. Every phone listens on a dynamic PSM and puts it in its beacon; the phone with the *lower* unit number
// dials, so two phones never open two links to each other. A link counts only after the crew handshake
// (pager-core LinkHandshake); a stranger's socket is closed after five seconds without it.

@SuppressLint("MissingPermission")
class Links(
    private val adapter: BluetoothAdapter,
    private val crew: () -> Crew,
    private val me: () -> Pair<Int, String>,
    private val onUp: (unit: Int, name: String) -> Unit,
    private val onDown: (unit: Int) -> Unit,
    private val onMsg: (msg: LinkMsg, from: Int) -> Unit,
) {
    private inner class Link(val socket: BluetoothSocket) {
        @Volatile var unit = 0
        private val out = socket.outputStream
        fun send(m: LinkMsg): Boolean = try { synchronized(out) { LinkCodec.write(out, m) }; true } catch (e: IOException) { close(); false }
        fun close() { runCatching { socket.close() } }
    }

    private val links = ConcurrentHashMap<Int, Link>()
    private val dialling = ConcurrentHashMap<Int, Long>()
    private var server: BluetoothServerSocket? = null
    @Volatile private var running = false

    /** The PSM to advertise, 0 when this phone cannot listen (Android 9 has no LE L2CAP). */
    @Volatile var psm = 0; private set

    val supported: Boolean get() = Build.VERSION.SDK_INT >= 29

    fun start() {
        if (!supported || running) return
        running = true
        val s = try { adapter.listenUsingInsecureL2capChannel() } catch (e: Exception) { VrgLog.w("pager", "l2cap listen: ${e.message}"); running = false; return }
        server = s
        psm = s.psm
        thread(name = "pager-accept", isDaemon = true) {
            while (running) {
                val sock = try { s.accept() } catch (e: IOException) { break }
                serve(sock, dialled = 0)
            }
        }
    }

    fun stop() {
        running = false; psm = 0
        runCatching { server?.close() }; server = null
        links.values.forEach { it.close() }; links.clear()
    }

    fun linked(unit: Int) = links.containsKey(unit)
    fun count() = links.size

    /** Dial a crew member heard in a beacon, if it is our turn (lower unit dials) and no link or attempt is open. */
    fun maybeDial(unit: Int, peerPsm: Int, device: BluetoothDevice, now: Long) {
        if (!running || peerPsm == 0 || links.containsKey(unit)) return
        if (me().first >= unit) return
        val last = dialling[unit]
        if (last != null && now - last < 15_000) return
        dialling[unit] = now
        thread(name = "pager-dial-$unit", isDaemon = true) {
            val sock = try { device.createInsecureL2capChannel(peerPsm).also { it.connect() } }
            catch (e: Exception) { VrgLog.i("pager", "dial $unit: ${e.message}"); return@thread }
            serve(sock, dialled = unit)
        }
    }

    private fun serve(sock: BluetoothSocket, dialled: Int) {
        thread(name = "pager-link", isDaemon = true) {
            val link = Link(sock)
            val (myUnit, myName) = me()
            val hs = LinkHandshake(crew(), myUnit, myName)
            val input = sock.inputStream
            // a socket that does not prove the crew within 5 s is closed
            val guard = thread(isDaemon = true) { try { Thread.sleep(5_000) } catch (e: InterruptedException) { return@thread }; if (!hs.trusted) link.close() }
            try {
                if (!link.send(hs.hello)) return@thread
                while (running) {
                    val m = LinkCodec.read(input) ?: break
                    if (!hs.trusted) {
                        when (m) {
                            is LinkMsg.Hello -> { if (dialled != 0 && m.unit != dialled) break; val a = hs.onHello(m) ?: break; link.send(a) }
                            is LinkMsg.Auth -> {
                                if (!hs.onAuth(m)) break
                                val peer = hs.peer!!
                                if (links.putIfAbsent(peer.unit, link) != null) break     // a link to this unit is already open
                                link.unit = peer.unit
                                guard.interrupt()
                                onUp(peer.unit, peer.name)
                            }
                            else -> break
                        }
                        continue
                    }
                    onMsg(m, link.unit)
                }
            } catch (e: Exception) {
                VrgLog.i("pager", "link ${link.unit}: ${e.message}")
            } finally {
                link.close()
                if (link.unit != 0 && links.remove(link.unit, link)) onDown(link.unit)
            }
        }
    }

    /** To one unit, or to every open link. */
    fun send(m: LinkMsg, to: Int? = null) {
        if (to != null) { links[to]?.send(m); return }
        links.values.forEach { it.send(m) }
    }
}
