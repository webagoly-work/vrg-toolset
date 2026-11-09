package hu.vrg.mobile.relay

import java.io.BufferedInputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketTimeoutException
import java.security.MessageDigest
import java.util.Base64
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

// A deliberately small WebSocket server (RFC 6455): text messages only, which is all the relay envelope
// needs. Written here rather than pulled in (Ktor, NanoHTTPD, Java-WebSocket) so the phone carries no
// server framework and the JVM tests run the very same code over real sockets.
//
//   * The handshake: GET with Upgrade: websocket, Sec-WebSocket-Version 13 and a key; anything else gets a
//     short HTTP answer and is closed. Headers are capped at 8 KB.
//   * Frames: client frames must be masked (else 1002); text and continuation are joined; binary is refused
//     (1003); one message is at most 1 MiB (1009); ping is answered, close is echoed.
//   * Liveness: a ping every 20 s, and a socket silent for 60 s is dropped, so a phone that walks away from
//     the WiFi does not keep a dead PC on the roster.
//
// Threads: one acceptor, one reader per connection, one small scheduler for the pings. Sends are
// synchronised per connection, so the relay may send from any thread.

interface WsConn {
    val id: Int
    /** The peer's address as text, without the IPv4-mapped prefix. */
    val remote: String
    val isLoopback: Boolean
    fun send(text: String): Boolean
    fun close(code: Int = 1000, reason: String = "")
}

interface WsHandler {
    fun onOpen(c: WsConn)
    fun onText(c: WsConn, text: String)
    fun onClose(c: WsConn)
}

class WsServer(
    private val handler: WsHandler,
    private val pingMs: Long = 20_000,
    private val idleMs: Int = 60_000,
    private val log: (String) -> Unit = {},
) {
    companion object {
        const val MAX_MESSAGE = 1 shl 20
        private const val MAX_HEADER = 8 * 1024
        private const val GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

        /** The Sec-WebSocket-Accept value for a key (RFC 6455 §4.2.2). */
        fun acceptFor(key: String): String = Base64.getEncoder().encodeToString(
            MessageDigest.getInstance("SHA-1").digest((key.trim() + GUID).toByteArray(Charsets.US_ASCII)),
        )
    }

    private var server: ServerSocket? = null
    private var pinger: ScheduledExecutorService? = null
    private val conns = ConcurrentHashMap<Int, Conn>()
    private val ids = AtomicInteger()

    val port: Int get() = server?.localPort ?: -1
    val running: Boolean get() = server?.isClosed == false
    val count: Int get() = conns.size

    /** Binds [port] (0 = any free one) on every interface, or on [bind]. Tries [tries] ports upward, like the PC relay. */
    @Synchronized
    fun start(port: Int, tries: Int = 8, bind: InetAddress? = null): Int {
        check(server == null) { "already running" }
        var last: IOException? = null
        for (i in 0 until maxOf(1, tries)) {
            val p = if (port == 0) 0 else port + i
            try {
                val s = ServerSocket()
                s.reuseAddress = true
                s.bind(InetSocketAddress(bind, p))
                server = s
                break
            } catch (e: IOException) { last = e }
        }
        val s = server ?: throw last ?: IOException("no port")
        Thread({ acceptLoop(s) }, "ws-accept").apply { isDaemon = true }.start()
        pinger = Executors.newSingleThreadScheduledExecutor { r -> Thread(r, "ws-ping").apply { isDaemon = true } }.also {
            it.scheduleWithFixedDelay({ conns.values.forEach { c -> c.ping() } }, pingMs, pingMs, TimeUnit.MILLISECONDS)
        }
        log("relay listening on ${s.localPort}")
        return s.localPort
    }

    @Synchronized
    fun stop() {
        pinger?.shutdownNow(); pinger = null
        try { server?.close() } catch (_: IOException) {}
        server = null
        conns.values.toList().forEach { it.close(1001, "A relé leállt.") }
        conns.clear()
    }

    private fun acceptLoop(s: ServerSocket) {
        while (!s.isClosed) {
            val sock = try { s.accept() } catch (_: IOException) { break }
            Thread({ serve(sock) }, "ws-conn").apply { isDaemon = true }.start()
        }
    }

    private fun serve(sock: Socket) {
        val c = try {
            sock.soTimeout = 10_000                        // the handshake must arrive quickly
            sock.tcpNoDelay = true
            val input = BufferedInputStream(sock.getInputStream())
            val out = sock.getOutputStream()
            if (!handshake(input, out)) { sock.close(); return }
            sock.soTimeout = idleMs
            Conn(ids.incrementAndGet(), sock, input, out)
        } catch (_: IOException) { try { sock.close() } catch (_: IOException) {}; return }
        conns[c.id] = c
        try {
            handler.onOpen(c)
            c.readLoop()
        } finally {
            conns.remove(c.id)
            c.shut()
            handler.onClose(c)
        }
    }

    private fun handshake(input: InputStream, out: OutputStream): Boolean {
        val head = readHead(input) ?: return false
        val lines = head.split("\r\n")
        val request = lines.first().split(' ')
        val headers = lines.drop(1).mapNotNull { l ->
            val i = l.indexOf(':'); if (i <= 0) null else l.substring(0, i).trim().lowercase() to l.substring(i + 1).trim()
        }.toMap()
        fun answer(status: String, body: String): Boolean {
            val b = body.toByteArray(Charsets.UTF_8)
            out.write(("HTTP/1.1 $status\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: ${b.size}\r\n" +
                "Connection: close\r\n\r\n").toByteArray(Charsets.US_ASCII) + b)
            out.flush()
            return false
        }
        val key = headers["sec-websocket-key"]
        val upgrade = headers["upgrade"]?.lowercase() == "websocket" &&
            headers["connection"]?.lowercase()?.contains("upgrade") == true
        if (request.size < 2 || request[0] != "GET") return answer("405 Method Not Allowed", "VRG Mobile relé")
        if (!upgrade || key.isNullOrBlank()) return answer("426 Upgrade Required", "VRG Mobile relé: WebSocket kell.")
        if (headers["sec-websocket-version"] != "13") return answer("426 Upgrade Required", "WebSocket 13 kell.")
        out.write(("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
            "Sec-WebSocket-Accept: ${acceptFor(key)}\r\n\r\n").toByteArray(Charsets.US_ASCII))
        out.flush()
        return true
    }

    private fun readHead(input: InputStream): String? {
        val buf = StringBuilder()
        while (buf.length < MAX_HEADER) {
            val b = input.read()
            if (b < 0) return null
            buf.append(b.toChar())
            if (buf.endsWith("\r\n\r\n")) return buf.substring(0, buf.length - 4)
        }
        return null
    }

    private inner class Conn(
        override val id: Int,
        private val sock: Socket,
        private val input: InputStream,
        private val out: OutputStream,
    ) : WsConn {
        override val remote: String = (sock.inetAddress?.hostAddress ?: "?").removePrefix("::ffff:")
        override val isLoopback: Boolean = sock.inetAddress?.isLoopbackAddress == true
        @Volatile private var closed = false

        override fun send(text: String): Boolean = frame(0x1, text.toByteArray(Charsets.UTF_8))

        fun ping() { frame(0x9, ByteArray(0)) }

        override fun close(code: Int, reason: String) {
            if (closed) return
            val r = reason.toByteArray(Charsets.UTF_8).let { if (it.size > 123) it.copyOf(123) else it }
            frame(0x8, byteArrayOf((code shr 8).toByte(), code.toByte()) + r)
            shut()
        }

        fun shut() {
            closed = true
            try { sock.close() } catch (_: IOException) {}
        }

        @Synchronized
        private fun frame(op: Int, data: ByteArray): Boolean {
            if (closed) return false
            return try {
                val n = data.size
                val head = when {
                    n < 126 -> byteArrayOf((0x80 or op).toByte(), n.toByte())
                    n < 65536 -> byteArrayOf((0x80 or op).toByte(), 126, (n shr 8).toByte(), n.toByte())
                    else -> ByteArray(10).also { h ->
                        h[0] = (0x80 or op).toByte(); h[1] = 127
                        for (i in 0 until 8) h[9 - i] = (n.toLong() shr (8 * i)).toByte()
                    }
                }
                out.write(head + data)
                out.flush()
                true
            } catch (_: IOException) { shut(); false }
        }

        fun readLoop() {
            val msg = java.io.ByteArrayOutputStream()
            var collecting = false
            while (!closed) {
                val b0 = try { input.read() } catch (_: SocketTimeoutException) { return } catch (_: IOException) { return }
                if (b0 < 0) return
                val b1 = input.read(); if (b1 < 0) return
                val fin = b0 and 0x80 != 0
                val op = b0 and 0x0f
                if (b0 and 0x70 != 0) { close(1002, "RSV"); return }
                if (b1 and 0x80 == 0) { close(1002, "Maszk nélküli keret."); return }
                var len = (b1 and 0x7f).toLong()
                if (len == 126L) len = ((readN(2) ?: return).let { (it[0].toLong() and 0xff shl 8) or (it[1].toLong() and 0xff) })
                else if (len == 127L) len = (readN(8) ?: return).fold(0L) { a, x -> (a shl 8) or (x.toLong() and 0xff) }
                if (op >= 0x8 && (len > 125 || !fin)) { close(1002, "Vezérlőkeret."); return }
                if (len > MAX_MESSAGE || msg.size() + len > MAX_MESSAGE) { close(1009, "Túl nagy üzenet."); return }
                val mask = readN(4) ?: return
                val data = readN(len.toInt()) ?: return
                for (i in data.indices) data[i] = (data[i].toInt() xor mask[i and 3].toInt()).toByte()
                when (op) {
                    0x8 -> { close(1000, ""); return }
                    0x9 -> frame(0xA, data)
                    0xA -> {}
                    0x2 -> { close(1003, "Csak szöveg."); return }
                    0x1, 0x0 -> {
                        if (op == 0x1 && collecting) { close(1002, "Félbehagyott üzenet."); return }
                        if (op == 0x0 && !collecting) { close(1002, "Folytatás üzenet nélkül."); return }
                        msg.write(data)
                        collecting = !fin
                        if (fin) {
                            val text = msg.toString(Charsets.UTF_8.name())
                            msg.reset()
                            try { handler.onText(this, text) } catch (e: Exception) { log("handler: ${e.message}") }
                        }
                    }
                    else -> { close(1002, "Ismeretlen keret."); return }
                }
            }
        }

        private fun readN(n: Int): ByteArray? {
            val b = ByteArray(n)
            var off = 0
            while (off < n) {
                val r = try { input.read(b, off, n - off) } catch (_: IOException) { return null }
                if (r < 0) return null
                off += r
            }
            return b
        }
    }
}
