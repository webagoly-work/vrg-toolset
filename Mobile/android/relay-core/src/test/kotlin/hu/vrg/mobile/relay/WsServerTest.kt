package hu.vrg.mobile.relay

import org.json.JSONObject
import java.net.InetAddress
import java.net.Socket
import java.net.URI
import java.net.http.HttpClient
import java.net.http.WebSocket
import java.security.KeyPairGenerator
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.util.Base64
import java.util.concurrent.CompletionStage
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

// The WebSocket server over real sockets, with the JDK's own client (java.net.http) on the other end, and the
// whole phone relay behind it: the pairing handshake and a routed message, as a PC browser would do it.

class WsServerTest {
    private val trust = MemoryTrust()
    private val relay = PhoneRelay(trust, "phone-id", "Teszt telefon")
    private val server = WsServer(relay)
    private val port = server.start(0, bind = InetAddress.getLoopbackAddress())

    @AfterTest fun stop() = server.stop()

    private class Client(port: Int) : WebSocket.Listener {
        val got = LinkedBlockingQueue<JSONObject>()
        val closed = LinkedBlockingQueue<Int>()
        private val buf = StringBuilder()
        val ws: WebSocket = HttpClient.newHttpClient().newWebSocketBuilder()
            .buildAsync(URI("ws://127.0.0.1:$port/"), this).get(5, TimeUnit.SECONDS)

        override fun onText(webSocket: WebSocket, data: CharSequence, last: Boolean): CompletionStage<*>? {
            buf.append(data)
            if (last) { got += JSONObject(buf.toString()); buf.setLength(0) }
            webSocket.request(1)
            return null
        }
        override fun onClose(webSocket: WebSocket, statusCode: Int, reason: String): CompletionStage<*>? { closed += statusCode; return null }

        fun send(o: JSONObject) { ws.sendText(o.toString(), true).get(5, TimeUnit.SECONDS) }
        fun next(type: String): JSONObject {
            while (true) {
                val m = got.poll(5, TimeUnit.SECONDS) ?: error("no '$type' within 5 s")
                if (m.optString("type") == type) return m
            }
        }
    }

    private fun env(from: String, type: String, payload: JSONObject, to: String? = null) =
        JSONObject().put("v", 1).put("from", from).put("seq", 1).put("t", 0).put("type", type).put("payload", payload)
            .apply { if (to != null) put("to", to) }

    @Test fun handshakeAcceptKeyIsTheRfcExample() {
        assertEquals("s3pPLMBiTxaQ9kYGzzhZRbK+xOo=", WsServer.acceptFor("dGhlIHNhbXBsZSBub25jZQ=="))
    }

    @Test fun aBrowserLikeClientPairsAuthsAndIsRouted() {
        val k = KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec("secp256r1")) }.generateKeyPair()
        val pub = Base64.getEncoder().encodeToString(k.public.encoded)
        fun sign(ch: String, id: String) = Base64.getEncoder().encodeToString(Signature.getInstance("SHA256withECDSAinP1363Format")
            .run { initSign(k.private); update(authText(ch, id).toByteArray()); sign() })

        val city = Client(port)
        city.send(env("codecity", "hello", JSONObject().put("role", "codecity")))
        val w = city.next("welcome").getJSONObject("payload")
        assertEquals("phone", w.getString("relay")); assertEquals("phone-id", w.getJSONObject("pc").getString("id"))
        val code = relay.codes.issue().code
        city.send(env("codecity", "pair", JSONObject().put("code", PairCodes.pretty(code)).put("device", "Kódváros").put("pub", pub), "relay"))
        val id = city.next("paired").getJSONObject("payload").getString("id")
        city.ws.sendClose(1000, "").get(5, TimeUnit.SECONDS)

        val again = Client(port)
        again.send(env("codecity", "hello", JSONObject().put("role", "codecity")))
        val ch = again.next("welcome").getJSONObject("payload").getString("challenge")
        again.send(env("codecity", "auth", JSONObject().put("id", id).put("sig", sign(ch, id)), "relay"))
        assertTrue(again.next("trust").getJSONObject("payload").getBoolean("ok"))

        // a second trusted client (another PC app) — Kódváros' state reaches it, a 70 kB message intact
        val other = Client(port)
        other.send(env("phone", "hello", JSONObject().put("role", "phone")))
        val ch2 = other.next("welcome").getJSONObject("payload").getString("challenge")
        val code2 = relay.codes.issue().code
        val k2 = KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec("secp256r1")) }.generateKeyPair()
        other.send(env("phone", "pair", JSONObject().put("code", code2).put("device", "x").put("pub", Base64.getEncoder().encodeToString(k2.public.encoded)), "relay"))
        assertTrue(other.next("paired").getJSONObject("payload").getBoolean("ok"), "challenge $ch2 not needed when pairing")
        assertNotNull(other.next("hello"), "Kódváros' hello replayed")
        val big = "x".repeat(70_000)
        again.send(env("codecity", "state", JSONObject().put("blob", big)))
        assertEquals(big, other.next("state").getJSONObject("payload").getString("blob"))
    }

    @Test fun plainHttpAndUnmaskedFramesAreRefused() {
        Socket("127.0.0.1", port).use { s ->
            s.getOutputStream().write("GET / HTTP/1.1\r\nHost: x\r\n\r\n".toByteArray())
            val head = s.getInputStream().readNBytes(40).toString(Charsets.US_ASCII)
            assertTrue(head.startsWith("HTTP/1.1 426"), head)
        }
        Socket("127.0.0.1", port).use { s ->
            s.getOutputStream().write(("GET / HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
                "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n").toByteArray())
            val inp = s.getInputStream()
            val head = StringBuilder()
            while (!head.endsWith("\r\n\r\n")) head.append(inp.read().toChar())
            assertTrue(head.contains("s3pPLMBiTxaQ9kYGzzhZRbK+xOo="))
            s.getOutputStream().write(byteArrayOf(0x81.toByte(), 2, 'h'.code.toByte(), 'i'.code.toByte()))   // no mask bit
            val b0 = inp.read(); val len = inp.read(); val code = (inp.read() shl 8) or inp.read()
            assertEquals(0x88, b0); assertTrue(len >= 2); assertEquals(1002, code)
        }
    }

    @Test fun anUntrustedClientIsClosedWith4401OnTick() {
        val held = PhoneRelay(MemoryTrust(), "p", "n", holdMs = 0)
        val s = WsServer(held)
        val p = s.start(0, bind = InetAddress.getLoopbackAddress())
        try {
            val c = Client(p)
            c.send(env("planner", "hello", JSONObject().put("role", "planner")))
            c.next("welcome")
            held.tick()
            assertEquals(PhoneRelay.CLOSE_UNTRUSTED, c.closed.poll(5, TimeUnit.SECONDS))
        } finally { s.stop() }
    }
}
