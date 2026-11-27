package hu.vrg.mobile.core

import org.json.JSONObject
import java.io.File
import java.security.interfaces.ECPublicKey
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

class DeviceTrustTest {
    private val repo = File(System.getProperty("vrg.repo") ?: "../..")
    private val at = "2026-11-18T19:00:00Z"

    private fun device(id: String) = DeviceTrust.newKeyPair().let { kp ->
        Triple(kp, DeviceTrust.request(id, "Teszt telefon", "Pixel 9", "Android 16", "0.9.1", DeviceTrust.jwk(kp.public as ECPublicKey), at), id)
    }

    @Test fun requestRoundTripsThroughItsQr() {
        val (_, req) = device("ABCD1234EF56")
        val link = DeviceTrust.requestLink(req)
        assertTrue(link.startsWith("vrg://devices?req="))
        assertTrue(link.length < 900, "fits a QR comfortably (${link.length})")
        val back = assertIs<DeviceTrust.Parsed.Req>(DeviceTrust.read(link)).r
        assertEquals(req, back)
        assertEquals(6, back.code.length)
        // the shell routes the same link to the feature
        assertEquals("devices", Links.route(link)?.feature)
        // a whole messenger message holding it still reads
        assertIs<DeviceTrust.Parsed.Req>(DeviceTrust.read("Szia! Ezt nyisd meg: $link köszi"))
    }

    @Test fun aChangedRequestShowsAnotherCode() {
        val (_, req) = device("ABCD1234EF56")
        val (_, other) = device("ABCD1234EF56")
        val forged = DeviceTrust.pack(req.toJson().put("pub", other.pub.toJson()))
        assertIs<DeviceTrust.Parsed.Bad>(DeviceTrust.read("vrg://devices?req=$forged"))
        assertIs<DeviceTrust.Parsed.Bad>(DeviceTrust.read("semmi ilyen"))
    }

    @Test fun onlyTheRequestingPhoneOpensTheGrant() {
        val (kp, req, id) = device("ABCD1234EF56")
        val g = DeviceTrust.grant(req, GrantPayload("Redmi (tulajdonos)", at, token = "token-a-tesztben"))
        val link = DeviceTrust.grantLink(g, req.back)
        assertTrue(link.startsWith("vrg://devices?grant="))
        val read = assertIs<DeviceTrust.Parsed.Grant>(DeviceTrust.read(link)).g
        val p = DeviceTrust.open(read, id, kp.private)
        assertEquals("token-a-tesztben", p.token)
        assertEquals("Redmi (tulajdonos)", p.by)
        // another phone, even told the right id, cannot
        val (stranger, _) = device("XXXX")
        assertFailsWith<Exception> { DeviceTrust.open(read, id, stranger.private) }
        assertFailsWith<IllegalArgumentException> { DeviceTrust.open(read, "MASIK", kp.private) }
        // a grant without the token: approval only
        assertNull(DeviceTrust.open(DeviceTrust.grant(req, GrantPayload("x", at)), id, kp.private).token)
    }

    @Test fun privateKeysSurviveStorage() {
        val (kp, req, id) = device("ABCD1234EF56")
        val restored = DeviceTrust.privateFrom(DeviceTrust.privateToString(kp.private))
        assertEquals("x", DeviceTrust.open(DeviceTrust.grant(req, GrantPayload("x", at)), id, restored).by)
    }

    @Test fun webCryptoAndTheAppAgree() {
        // written by Mobile/tests/device-trust-fixture.js with Node's WebCrypto, what the iPhone web app (M36) runs
        val f = JSONObject(File(repo, "Mobile/tests/fixtures/device-trust-web.json").readText())
        // a browser's request reads here, its code matches, and a grant made here opens with the browser's key
        val req = assertIs<DeviceTrust.Parsed.Req>(DeviceTrust.read(f.getString("webRequestLink"))).r
        assertEquals(f.getString("webCode"), req.code)
        assertEquals("https://example.invalid/vrg-mobile/", req.back)
        val g = DeviceTrust.grant(req, GrantPayload("app", at, "t"))
        assertTrue(DeviceTrust.grantLink(g, req.back).startsWith("https://example.invalid/vrg-mobile/#grant="))
        assertEquals("t", DeviceTrust.open(g, req.id, DeviceTrust.privateFrom(f.getString("webPrivatePkcs8"))).token)
        // a grant made in the browser opens here
        val wg = assertIs<DeviceTrust.Parsed.Grant>(DeviceTrust.read(f.getString("grantLink"))).g
        val p = DeviceTrust.open(wg, f.getString("appId"), DeviceTrust.privateFrom(f.getString("appPrivatePkcs8")))
        assertEquals(f.getJSONObject("grantPayload").getString("token"), p.token)
    }

    @Test fun theTrustListGatesUpdates() {
        val owner = TrustedDevice("6CDB-FB09-6833", "Redmi", "Redmi Note 13 Pro 5G", "Android 15", "", at, "kézzel", owner = true)
        var t = TrustList(gated = true, devices = listOf(owner))
        assertTrue(t.updatesFor("6CDBFB096833"))                  // dashes and case do not matter
        assertFalse(t.updatesFor("ABCD1234EF56"))
        t = t.with(TrustedDevice("ABCD1234EF56", "Pixel", "Pixel 9", "Android 16", "A1B2C3", at, "Redmi"))
        assertTrue(t.updatesFor("abcd-1234-ef56"))
        assertTrue(TrustList(false, emptyList()).updatesFor("anyone"))
        val back = TrustList.parse(t.encode())!!
        assertEquals(t, back)
        assertEquals(1, back.without("ABCD1234EF56").devices.size)
        assertNull(TrustList.parse("nem json"))
    }

    @Test fun aTypedDeviceCode() {
        assertEquals("6CDB-FB09-6833", DeviceTrust.typedCode("6CDB-FB09-6833"))
        assertEquals("6CDB-FB09-6833", DeviceTrust.typedCode(" 6cdb fb09 6833 "), "spaces and case do not matter")
        assertEquals("6CDB-FB09-6833", DeviceTrust.typedCode("6CDBFB096833"))
        assertEquals("ABCD-EFGH-2345", DeviceTrust.typedCode("abcdefgh2345"), "an iPhone web app id")
        assertNull(DeviceTrust.typedCode("6CDB-FB09-683"), "too short")
        assertNull(DeviceTrust.typedCode("6CDB-FB09-68334"), "too long")
        assertNull(DeviceTrust.typedCode("E50AAF"), "the 6-character check code is not a device code")
        assertNull(DeviceTrust.typedCode("ÁBCD-EFGH-2345"), "letters outside A-Z")
        assertTrue(DeviceTrust.sameId(DeviceTrust.typedCode("6cdbfb096833")!!, "6CDB-FB09-6833"))
    }

    @Test fun theRepoListParses() {
        val t = TrustList.parse(File(repo, "Mobile/trust/devices.json").readText())!!
        assertTrue(t.devices.any { it.owner }, "the owner's phone is on the list")
    }
}
