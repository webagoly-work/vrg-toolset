package hu.vrg.mobile.relay

import org.json.JSONObject
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.SecureRandom
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.util.Base64
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// The phone relay's envelope and routing, replaying Mobile/tests/relay-e2e.js's fake-client traffic on the JVM:
// the same Planner hello, Kódváros hello + focus, phone hello, cmd/keys/gesture to codecity, a screenshot request,
// a focus change and the Planner leaving. The difference from the PC relay is the gate: every client pairs first
// (a code from the phone, then a signature on each connect), as the browser apps do with WebCrypto (P1363 form).

class PhoneRelayTest {
    private class Fake(override val id: Int, override val remote: String = "192.168.43.${id + 10}") : WsConn {
        override val isLoopback = false
        val got = mutableListOf<JSONObject>()
        var closedWith: Int? = null
        override fun send(text: String): Boolean { if (closedWith != null) return false; got += JSONObject(text); return true }
        override fun close(code: Int, reason: String) { closedWith = code }
        fun of(type: String) = got.filter { it.optString("type") == type }
        fun last(type: String) = of(type).lastOrNull()
    }

    private var now = 1_000_000L
    private val rnd = SecureRandom()
    private val selfKey = key()
    private val relay = PhoneRelay(MemoryTrust(), "phone-id", "Redmi", b64(selfKey.public.encoded), { now }, rnd)
    private var seqs = 0
    private var ids = 0

    private fun key(): KeyPair = KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec("secp256r1")) }.generateKeyPair()
    private fun b64(b: ByteArray) = Base64.getEncoder().encodeToString(b)

    /** What the browser apps send: WebCrypto's ECDSA, r‖s (P1363). */
    private fun signP1363(k: KeyPair, challenge: String, id: String) = b64(Signature.getInstance("SHA256withECDSAinP1363Format").run {
        initSign(k.private); update(authText(challenge, id).toByteArray()); sign()
    })
    /** What the phone's Keystore and Node send: DER. */
    private fun signDer(k: KeyPair, challenge: String, id: String) = b64(Signature.getInstance("SHA256withECDSA").run {
        initSign(k.private); update(authText(challenge, id).toByteArray()); sign()
    })

    private fun env(from: String, type: String, payload: JSONObject = JSONObject(), to: String? = null) = JSONObject()
        .put("v", 1).put("from", from).put("seq", ++seqs).put("t", now).put("type", type).put("payload", payload)
        .apply { if (to != null) put("to", to) }.toString()

    private fun open(): Fake = Fake(++ids).also { relay.onOpen(it) }
    private fun say(c: Fake, from: String, type: String, payload: JSONObject = JSONObject(), to: String? = null) =
        relay.onText(c, env(from, type, payload, to))

    /** hello -> welcome -> pair with a fresh code; returns the device id. */
    private fun pairIn(c: Fake, role: String, k: KeyPair, hello: JSONObject = JSONObject()): String {
        say(c, role, "hello", hello.put("role", role))
        assertNotNull(c.last("welcome"), "$role got a welcome")
        val code = relay.codes.issue().code
        say(c, role, "pair", JSONObject().put("code", PairCodes.pretty(code).lowercase()).put("device", "PC $role").put("pub", b64(k.public.encoded)), "relay")
        val p = c.last("paired")!!.getJSONObject("payload")
        assertTrue(p.getBoolean("ok"), "pairing ok: $p")
        return p.getString("id")
    }

    private fun authIn(c: Fake, role: String, id: String, sign: (String) -> String, hello: JSONObject = JSONObject()): Boolean {
        say(c, role, "hello", hello.put("role", role))
        val ch = c.last("welcome")!!.getJSONObject("payload").getString("challenge")
        say(c, role, "auth", JSONObject().put("id", id).put("sig", sign(ch)), "relay")
        return c.last("trust")!!.getJSONObject("payload").getBoolean("ok")
    }

    private val plannerHello get() = JSONObject().put("app", "test").put("caps", listOf("state", "cmd"))
        .put("tools", org.json.JSONArray().put(JSONObject().put("mode", "device").put("key", "1").put("hint", "Eszköz")))
    private val cityHello get() = JSONObject().put("app", "codecity").put("caps", listOf("state", "cmd", "keys"))
        .put("tools", org.json.JSONArray((0 until 7).map { JSONObject().put("mode", "lens$it") }))

    @Test fun relayE2eTrafficRoutesAsOnThePc() {
        val pk = key(); val ck = key()
        val planner = open(); pairIn(planner, "planner", pk, plannerHello)
        val city = open(); pairIn(city, "codecity", ck, cityHello)
        say(city, "codecity", "focus", JSONObject().put("app", "codecity").put("title", "Kódváros"))

        // the phone is the app's own Légegér link: it proves itself with the phone's key as "self"
        val phone = open()
        assertTrue(authIn(phone, "phone", PhoneRelay.SELF_ID, { signDer(selfKey, it, PhoneRelay.SELF_ID) },
            JSONObject().put("app", "e2e").put("caps", listOf("state", "cmd", "keys", "focus", "roster"))))

        val hellos = phone.of("hello")
        assertTrue(hellos.any { it.getString("from") == "planner" && it.getJSONObject("payload").getJSONArray("tools").length() == 1 }, "Planner hello replayed")
        assertTrue(hellos.any { it.getString("from") == "codecity" && it.getJSONObject("payload").getJSONArray("tools").length() >= 6 }, "Kódváros hello replayed")
        val roster = phone.last("roster")!!.getJSONObject("payload")
        val roles = (0 until roster.getJSONArray("peers").length()).map { roster.getJSONArray("peers").getJSONObject(it).getString("role") }
        assertEquals(setOf("planner", "codecity", "phone"), roles.toSet())
        assertEquals("codecity", roster.getJSONObject("focus").getString("role"))
        assertTrue(planner.got.none { it.optString("from") == "codecity" }, "no app-to-app")

        // cmd to codecity reaches Kódváros only; its ack reaches the phone
        val before = planner.got.size
        say(phone, "phone", "cmd", JSONObject().put("id", "tool.select").put("index", 2), "codecity")
        assertEquals("tool.select", city.last("cmd")!!.getJSONObject("payload").getString("id"))
        assertTrue(planner.got.drop(before).none { it.optString("type") == "cmd" }, "a cmd to codecity did not reach the Planner")
        say(city, "codecity", "ack", JSONObject().put("id", "tool.select").put("ok", true))
        assertTrue(phone.last("ack")!!.getJSONObject("payload").getBoolean("ok"))
        assertNull(planner.last("ack"), "the ack is not app-to-app")
        say(phone, "phone", "keys", JSONObject().put("key", "u"), "codecity")
        say(phone, "phone", "gesture", JSONObject().put("kind", "orbit").put("dx", 80), "codecity")
        assertEquals("u", city.last("keys")!!.getJSONObject("payload").getString("key"))
        assertEquals("orbit", city.last("gesture")!!.getJSONObject("payload").getString("kind"))

        // a message without `to` from the phone reaches both apps, never echoes back
        say(phone, "phone", "state.request")
        assertNotNull(planner.last("state.request")); assertNotNull(city.last("state.request"))
        assertNull(phone.last("state.request"))

        // the PC relay's own abilities: answered, not silent, and only to the asker
        say(planner, "planner", "screenshot.request", JSONObject().put("mode", "screen"), "relay")
        val shot = planner.last("screenshot")!!.getJSONObject("payload")
        assertFalse(shot.getBoolean("ok")); assertTrue(shot.getBoolean("unsupported"))
        assertNull(phone.last("screenshot"))

        // focus moves to the Planner; the Planner leaving clears it and updates the roster
        say(planner, "planner", "focus", JSONObject().put("app", "planner"))
        assertEquals("planner", phone.last("focus")!!.getString("from"))
        relay.onClose(planner)
        val r2 = phone.last("roster")!!.getJSONObject("payload")
        val roles2 = (0 until r2.getJSONArray("peers").length()).map { r2.getJSONArray("peers").getJSONObject(it).getString("role") }
        assertFalse("planner" in roles2)
        assertTrue(r2.isNull("focus"), "focus cleared")

        // every relay message carries the envelope
        val w = phone.last("roster")!!
        assertEquals(1, w.getInt("v")); assertEquals("relay", w.getString("from")); assertTrue(w.has("seq") && w.has("t"))
    }

    @Test fun anUnpairedClientIsHeldAndHearsNothing() {
        val phone = open()
        assertTrue(authIn(phone, "phone", PhoneRelay.SELF_ID, { signDer(selfKey, it, PhoneRelay.SELF_ID) }))
        val stranger = open()
        say(stranger, "planner", "hello", JSONObject().put("role", "planner"))
        assertNull(phone.last("hello"), "an untrusted hello is not routed")
        say(stranger, "planner", "state", JSONObject().put("mode", "x"))
        say(stranger, "planner", "focus", JSONObject())
        assertNull(phone.last("state")); assertNull(phone.last("focus"))
        val warn = stranger.last("trust")!!.getJSONObject("payload")
        assertFalse(warn.getBoolean("ok")); assertTrue(warn.getString("reason").contains("Párosítás"))
        say(phone, "phone", "cmd", JSONObject().put("id", "edit.undo"))
        assertNull(stranger.last("cmd"), "nothing is routed to an untrusted client")
        say(stranger, "planner", "screenshot.request", JSONObject(), "relay")
        assertNull(stranger.last("screenshot"), "not even an 'unsupported' answer")
        // held too long -> closed
        now += 29_000; relay.tick(); assertNull(stranger.closedWith)
        now += 2_000; relay.tick(); assertEquals(PhoneRelay.CLOSE_UNTRUSTED, stranger.closedWith)
        assertNull(phone.closedWith)
    }

    @Test fun pairThenAuthWithAWebCryptoSignature() {
        val k = key()
        val first = open(); val id = pairIn(first, "codecity", k)
        assertEquals(listOf(id), relay.devices().map { it.id })
        relay.onClose(first)
        val again = open()
        assertTrue(authIn(again, "codecity", id, { signP1363(k, it, id) }), "P1363 accepted")
        val third = open()
        assertTrue(authIn(third, "codecity", id, { signDer(k, it, id) }), "DER accepted")
        // a stale signature (old challenge) or another key fails, and a new challenge comes with the answer
        val fourth = open()
        say(fourth, "codecity", "hello", JSONObject().put("role", "codecity"))
        val ch = fourth.last("welcome")!!.getJSONObject("payload").getString("challenge")
        say(fourth, "codecity", "auth", JSONObject().put("id", id).put("sig", signP1363(key(), ch, id)), "relay")
        val t = fourth.last("trust")!!.getJSONObject("payload")
        assertFalse(t.getBoolean("ok")); assertTrue(t.getString("challenge") != ch)
        say(fourth, "codecity", "auth", JSONObject().put("id", id).put("sig", signP1363(k, ch, id)), "relay")
        assertFalse(fourth.last("trust")!!.getJSONObject("payload").getBoolean("ok"), "one try per challenge")
        // the same key pairing again keeps its id
        val fifth = open(); assertEquals(id, pairIn(fifth, "codecity", k))
        assertEquals(1, relay.devices().size)
    }

    @Test fun codesAreSingleUseShortLivedAndBurnAfterFiveWrongTries() {
        val k = key()
        val c = open()
        say(c, "planner", "hello", JSONObject().put("role", "planner"))
        fun pair(code: String) = run {
            say(c, "planner", "pair", JSONObject().put("code", code).put("device", "x").put("pub", b64(k.public.encoded)), "relay")
            c.last("paired")!!.getJSONObject("payload").getBoolean("ok")
        }
        assertFalse(pair("AAAAA-AAAAA"), "no live code")
        val live = relay.codes.issue().code
        repeat(4) { assertFalse(pair("ZZZZZ-ZZZZ$it")) }
        assertFalse(pair("22222-22222"))                       // the fifth wrong try
        assertFalse(pair(live), "burnt")
        val next = relay.codes.issue().code
        now += PairCodes.TTL_MS + 1
        assertFalse(pair(next), "expired")
        val third = relay.codes.issue().code
        assertTrue(pair(" ${third.lowercase()} "), "spaces and case do not matter")
        val d = open()
        say(d, "planner", "hello", JSONObject().put("role", "planner"))
        say(d, "planner", "pair", JSONObject().put("code", third).put("device", "x").put("pub", b64(key().public.encoded)), "relay")
        assertFalse(d.last("paired")!!.getJSONObject("payload").getBoolean("ok"), "single use")
        // a non-P-256 key is refused even with a good code
        val e = open()
        say(e, "planner", "hello", JSONObject().put("role", "planner"))
        val code = relay.codes.issue().code
        val rsa = KeyPairGenerator.getInstance("RSA").apply { initialize(1024) }.generateKeyPair()
        say(e, "planner", "pair", JSONObject().put("code", code).put("device", "x").put("pub", b64(rsa.public.encoded)), "relay")
        assertFalse(e.last("paired")!!.getJSONObject("payload").getBoolean("ok"))
        assertTrue(PairCodes.ALPHABET.none { it in "01OIL" })
    }

    @Test fun forgettingAPairingDropsItsConnection() {
        val k = key()
        val c = open(); val id = pairIn(c, "planner", k)
        relay.forget(id)
        assertEquals(PhoneRelay.CLOSE_UNTRUSTED, c.closedWith)
        assertTrue(relay.devices().isEmpty())
        val again = open()
        assertFalse(authIn(again, "planner", id, { signP1363(k, it, id) }))
        // a client can remove only its own pairing, and never "self"
        val k2 = key(); val a = open(); val idA = pairIn(a, "planner", k2)
        val b = open(); val idB = pairIn(b, "codecity", key())
        say(a, "planner", "unpair", JSONObject().put("id", idB), "relay")
        assertEquals(2, relay.devices().size)
        say(a, "planner", "unpair", JSONObject().put("id", idA), "relay")
        assertEquals(listOf(idB), relay.devices().map { it.id })
    }

    /** A signature from a real WebCrypto (Node's, Mobile/tests/fixtures), as Kódváros and the Planner make it. */
    @Test fun aWebCryptoSignatureFromNodeVerifies() {
        val f = JSONObject(java.io.File("../../tests/fixtures/phone-relay-webcrypto.json").readText())
        val pub = f.getString("pub"); val ch = f.getString("challenge"); val id = f.getString("id"); val sig = f.getString("sig")
        assertNotNull(RelayKeys.parsePub(pub))
        assertTrue(RelayKeys.verify(pub, ch, id, sig))
        assertFalse(RelayKeys.verify(pub, ch + "0", id, sig))
        assertFalse(RelayKeys.verify(pub, ch, id, null))
    }

    @Test fun p1363ToDerMatchesTheJdk() {
        val k = key()
        repeat(20) {
            val raw = Base64.getDecoder().decode(signP1363(k, "c$it", "id"))
            assertTrue(Signature.getInstance("SHA256withECDSA").run { initVerify(k.public); update(authText("c$it", "id").toByteArray()); verify(RelayKeys.p1363ToDer(raw)) })
        }
    }

    @Test fun fileTrustSurvivesARestart() {
        val f = kotlin.io.path.createTempDirectory("vrg-relay").toFile().resolve("paired.json")
        val t = FileTrust(f)
        val d = t.add("PC", b64(key().public.encoded), 5)
        assertEquals(listOf(d), FileTrust(f).list())
        t.remove(d.id)
        assertTrue(FileTrust(f).list().isEmpty())
        assertTrue(FileTrust(f.resolveSibling("missing.json")).list().isEmpty())
    }
}
