package hu.vrg.mobile.core

import org.json.JSONObject
import java.io.File
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.spec.ECGenParameterSpec
import java.security.spec.PKCS8EncodedKeySpec
import java.util.Base64
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

class PairingTest {

    private val code = "0123456789abcdef0123456789abcdef"

    @Test fun theQrLinkParses() {
        val link = "vrg://pair?ws=ws%3A%2F%2F192.168.1.24%3A47291&c=$code&n=IRODA-PC"
        assertEquals(PairOffer("ws://192.168.1.24:47291", code, "IRODA-PC"), PairOffer.parse(link))
        // what relay-pair.js pairLink() makes, with a name that needs encoding
        assertEquals("Iroda gép", PairOffer.parse("vrg://pair?ws=ws%3A%2F%2F10.0.0.5%3A47292&c=$code&n=Iroda%20g%C3%A9p")?.pcName)
    }

    @Test fun anythingElseIsNotAnOffer() {
        assertNull(PairOffer.parse("vrg://pair?ws=ws%3A%2F%2F192.168.1.24%3A47291&c=rovid"), "short code")
        assertNull(PairOffer.parse("vrg://pair?c=$code"), "no relay")
        assertNull(PairOffer.parse("vrg://pair?ws=ws%3A%2F%2Fa%20b%3A1&c=$code"), "a host with a space")
        assertNull(PairOffer.parse("vrg://airdeck?ws=ws%3A%2F%2F192.168.1.24%3A47291&c=$code"), "another feature")
        assertNull(PairOffer.parse("https://example.com/?c=$code"))
        assertNull(PairOffer.parse(null))
        assertEquals("ws://192.168.1.24:47291", PairOffer.parse("vrg://pair?ws=192.168.1.24&c=$code")?.ws, "a bare address gets the default port")
    }

    @Test fun relayAddresses() {
        assertEquals("ws://192.168.1.24:47291", RelayAddress.normalize("192.168.1.24"))
        assertEquals("ws://pc:47292", RelayAddress.normalize("http://pc:47292/phone-sender.html"))
        assertEquals("", RelayAddress.normalize("  "))
    }

    @Test fun signAndVerifyOnTheJvm() {
        val g = KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec("secp256r1")) }
        val kp = g.generateKeyPair()
        val pub = RelayAuth.encodePublic(kp.public)
        val sig = RelayAuth.sign(kp.private, "ch", "id1")
        assertTrue(RelayAuth.verify(pub, "ch", "id1", sig))
        assertFalse(RelayAuth.verify(pub, "masik", "id1", sig), "another challenge")
        assertFalse(RelayAuth.verify(pub, "ch", "id2", sig), "another id")
        assertFalse(RelayAuth.verify("nem kulcs", "ch", "id1", sig))
    }

    /** The same fixture Mobile/tests/relay-pair.js checks: Node's signature verifies here, ours verifies there. */
    @Test fun signaturesMatchNode() {
        val fx = JSONObject(File("../../tests/fixtures/relay-auth.json").readText())
        val ch = fx.getString("challenge")
        val id = fx.getString("id")
        assertEquals(fx.getString("text"), RelayAuth.text(ch, id), "the signed text is the relay's authText()")
        assertTrue(RelayAuth.verify(fx.getString("spki"), ch, id, fx.getString("sigNode")), "a Node signature verifies on the JVM")
        assertTrue(RelayAuth.verify(fx.getString("spki"), ch, id, fx.getString("sigJvm")))
        // and a fresh JVM signature with the fixture key verifies with the fixture's public key
        val key = KeyFactory.getInstance("EC").generatePrivate(PKCS8EncodedKeySpec(Base64.getDecoder().decode(fx.getString("pkcs8"))))
        assertTrue(RelayAuth.verify(fx.getString("spki"), ch, id, RelayAuth.sign(key, ch, id)))
    }

    @Test fun relayMessages() {
        val pair = JSONObject(RelayMsgs.pair(code, "Pixel 8", "PUB"))
        assertEquals("pair", pair.getString("type"))
        assertEquals("relay", pair.getString("to"))
        assertEquals("phone", pair.getString("from"))
        assertEquals(code, pair.getJSONObject("payload").getString("code"))
        assertEquals("PUB", pair.getJSONObject("payload").getString("pub"))
        val auth = JSONObject(RelayMsgs.auth("id1", "SIG")).getJSONObject("payload")
        assertEquals("SIG", auth.getString("sig"))
        val hello = JSONObject(RelayMsgs.hello("vrg-mobile", listOf("state", "cmd"))).getJSONObject("payload")
        assertEquals("phone", hello.getString("role"))
        assertEquals(2, hello.getJSONArray("caps").length())
    }

    @Test fun relayAnswers() {
        val w = RelayMsgs.parse("""{"v":1,"from":"relay","seq":3,"t":0,"type":"welcome","payload":{"challenge":"abc","pc":{"id":"p1","name":"IRODA"},"pairing":true}}""")
        assertEquals(RelayNote.Welcome("abc", "p1", "IRODA"), w)
        val ok = RelayMsgs.parse("""{"from":"relay","type":"paired","payload":{"ok":true,"id":"d1","pc":{"id":"p1","name":"IRODA"}}}""")
        assertEquals(RelayNote.Paired(true, "d1", "p1", "IRODA", null), ok)
        val no = RelayMsgs.parse("""{"from":"relay","type":"trust","payload":{"ok":false,"id":"d1","pc":{"id":"p1"},"challenge":"new","reason":"nincs"}}""")
        assertIs<RelayNote.Trust>(no)
        assertFalse(no.ok)
        assertEquals("new", no.challenge)
        assertNull(RelayMsgs.parse("""{"from":"planner","type":"welcome","payload":{"challenge":"x","pc":{"id":"p"}}}"""), "only the relay speaks for the relay")
        assertNull(RelayMsgs.parse("""{"from":"relay","type":"roster","payload":{}}"""))
        assertNull(RelayMsgs.parse("nem json"))
    }
}
