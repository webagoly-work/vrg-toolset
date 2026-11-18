package hu.vrg.mobile.core

import org.json.JSONArray
import org.json.JSONObject
import java.math.BigInteger
import java.security.KeyFactory
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.MessageDigest
import java.security.PrivateKey
import java.security.SecureRandom
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.security.spec.ECPoint
import java.security.spec.ECPublicKeySpec
import java.security.spec.PKCS8EncodedKeySpec
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.KeyAgreement
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

// Eszközök (WP M35): the Proton Vault way of letting a phone in, for VRG Mobile. One account (the owner's GitHub), and
// the devices are what differ: every phone has an id and a P-256 key; a phone that wants in shows a request (vrg-req)
// as a QR; the owner's phone scans it, checks the 6-character code by eye, adds the phone to Mobile/trust/devices.json
// on main and answers with a grant (vrg-grant) QR, which only that phone can open (ECDH + AES-GCM). The list then
// unlocks the app on that phone and, with `gated` on, is the list of phones that are offered updates.
//
// The crypto is WebCrypto's shape on purpose (JWK P-256 keys; the AES-GCM key is the raw 32-byte ECDH secret, as
// deriveKey makes it; a 12-byte IV; a 128-bit tag), so the iPhone web app (WP M36) speaks it from a browser.

data class Jwk(val x: String, val y: String) {
    fun toJson(): JSONObject = JSONObject().put("kty", "EC").put("crv", "P-256").put("x", x).put("y", y)

    companion object {
        fun parse(o: JSONObject?): Jwk? {
            if (o == null || o.optString("kty") != "EC" || o.optString("crv") != "P-256") return null
            val x = o.optString("x")
            val y = o.optString("y")
            return if (B64.dec(x)?.size == 32 && B64.dec(y)?.size == 32) Jwk(x, y) else null
        }
    }
}

/** A phone asking to be let in. [back]: where the grant should send a web device (its page's address), else null. */
data class DeviceRequest(
    val id: String, val name: String, val model: String, val os: String, val app: String,
    val pub: Jwk, val code: String, val at: String, val back: String? = null,
) {
    fun toJson(): JSONObject = JSONObject().put("t", DeviceTrust.REQ).put("v", 1).put("id", id).put("name", name)
        .put("model", model).put("os", os).put("app", app).put("pub", pub.toJson()).put("code", code).put("at", at)
        .apply { if (back != null) put("back", back) }
}

/** The owner's answer: [ct] opens with the requesting phone's private key only. */
data class DeviceGrant(val to: String, val epub: Jwk, val iv: String, val ct: String, val by: String) {
    fun toJson(): JSONObject = JSONObject().put("t", DeviceTrust.GRANT).put("v", 1).put("to", to)
        .put("epub", epub.toJson()).put("iv", iv).put("ct", ct).put("by", by)
}

/** What is inside a grant. [token]: the owner's GitHub token, only when the owner chose to hand it over. */
data class GrantPayload(val by: String, val at: String, val token: String? = null) {
    fun toJson(): JSONObject = JSONObject().put("by", by).put("at", at).apply { if (token != null) put("token", token) }
}

data class TrustedDevice(
    val id: String, val name: String, val model: String, val os: String, val code: String,
    val approved: String, val by: String, val owner: Boolean = false,
) {
    fun toJson(): JSONObject = JSONObject().put("id", id).put("name", name).put("model", model).put("os", os)
        .put("code", code).put("approved", approved).put("by", by).apply { if (owner) put("owner", true) }
}

/** Mobile/trust/devices.json. [gated]: updates only for the listed devices. */
data class TrustList(val gated: Boolean, val devices: List<TrustedDevice>) {
    fun has(id: String): Boolean = devices.any { DeviceTrust.sameId(it.id, id) }

    /** Updates may be offered to [id]: the list is open, or the phone is on it. */
    fun updatesFor(id: String): Boolean = !gated || has(id)

    fun with(d: TrustedDevice): TrustList = copy(devices = devices.filterNot { DeviceTrust.sameId(it.id, d.id) } + d)
    fun without(id: String): TrustList = copy(devices = devices.filterNot { DeviceTrust.sameId(it.id, id) })

    fun encode(): String = JSONObject()
        .put("about", "VRG Mobile trusted devices (WP M35). Written by the owner's phone (Eszközök); the owner approves each one by QR.")
        .put("gated", gated)
        .put("devices", JSONArray(devices.map { it.toJson() }))
        .toString(2) + "\n"

    companion object {
        val EMPTY = TrustList(false, emptyList())

        fun parse(json: String?): TrustList? = try {
            val o = JSONObject(json ?: return null)
            val a = o.optJSONArray("devices") ?: JSONArray()
            TrustList(o.optBoolean("gated"), (0 until a.length()).mapNotNull { i ->
                val d = a.optJSONObject(i) ?: return@mapNotNull null
                val id = d.optString("id").takeIf { it.isNotBlank() } ?: return@mapNotNull null
                TrustedDevice(id, d.optString("name"), d.optString("model"), d.optString("os"), d.optString("code"),
                    d.optString("approved"), d.optString("by"), d.optBoolean("owner"))
            })
        } catch (e: Exception) { null }
    }
}

object B64 {
    fun enc(b: ByteArray): String = Base64.getUrlEncoder().withoutPadding().encodeToString(b)
    fun dec(s: String?): ByteArray? = try { if (s.isNullOrEmpty()) null else Base64.getUrlDecoder().decode(s.trim().replace('+', '-').replace('/', '_').trimEnd('=')) } catch (e: IllegalArgumentException) { null }
}

object DeviceTrust {
    const val REQ = "vrg-req"
    const val GRANT = "vrg-grant"
    /** The path of the list in the repo. */
    const val PATH = "Mobile/trust/devices.json"

    private val rnd = SecureRandom()

    // ---- keys -------------------------------------------------------------------------------------------------------

    fun newKeyPair(): KeyPair = KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec("secp256r1"), rnd) }.generateKeyPair()

    fun jwk(pub: ECPublicKey): Jwk = Jwk(B64.enc(fixed(pub.w.affineX)), B64.enc(fixed(pub.w.affineY)))

    fun publicKey(j: Jwk): ECPublicKey {
        // the curve's parameters from a generated key: no BouncyCastle, works on Android and the JVM
        val params = (newKeyPair().public as ECPublicKey).params
        val point = ECPoint(BigInteger(1, B64.dec(j.x)), BigInteger(1, B64.dec(j.y)))
        return KeyFactory.getInstance("EC").generatePublic(ECPublicKeySpec(point, params)) as ECPublicKey
    }

    fun privateToString(k: PrivateKey): String = B64.enc(k.encoded)
    fun privateFrom(s: String): PrivateKey = KeyFactory.getInstance("EC").generatePrivate(PKCS8EncodedKeySpec(B64.dec(s)))

    private fun fixed(n: BigInteger): ByteArray {
        val b = n.toByteArray()
        return when {
            b.size == 32 -> b
            b.size > 32 -> b.copyOfRange(b.size - 32, b.size)        // a leading sign byte
            else -> ByteArray(32 - b.size) + b                         // a short number: pad to 32
        }
    }

    // ---- the request ------------------------------------------------------------------------------------------------

    /** The 6-character code both screens show: SHA-256 over the id and the key, so a changed QR shows another code. */
    fun code(id: String, pub: Jwk): String = sha256Hex("$id.${pub.x}.${pub.y}").take(6).uppercase()

    fun request(id: String, name: String, model: String, os: String, app: String, pub: Jwk, at: String, back: String? = null) =
        DeviceRequest(id, name.trim().take(40), model.take(60), os.take(20), app.take(20), pub, code(id, pub), at, back)

    /** Ids compare without dashes, spaces or case (an Android device code "6CDB-FB09-6833" is the id "6CDBFB096833"). */
    fun sameId(a: String, b: String): Boolean = norm(a) == norm(b)
    fun norm(id: String): String = id.filter { it.isLetterOrDigit() }.uppercase()

    // ---- the grant --------------------------------------------------------------------------------------------------

    fun grant(req: DeviceRequest, payload: GrantPayload, eph: KeyPair = newKeyPair()): DeviceGrant {
        val key = aesKey(eph.private, publicKey(req.pub))
        val iv = ByteArray(12).also { rnd.nextBytes(it) }
        val c = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(128, iv)) }
        val ct = c.doFinal(payload.toJson().toString().toByteArray(Charsets.UTF_8))
        return DeviceGrant(req.id, jwk(eph.public as ECPublicKey), B64.enc(iv), B64.enc(ct), payload.by)
    }

    /** Opens a grant on the phone it was made for; throws when it is for another phone or was changed. */
    fun open(g: DeviceGrant, myId: String, myPrivate: PrivateKey): GrantPayload {
        require(sameId(g.to, myId)) { "Ez az engedély egy másik eszköznek szól." }
        val key = aesKey(myPrivate, publicKey(g.epub))
        val c = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, B64.dec(g.iv))) }
        val o = JSONObject(String(c.doFinal(B64.dec(g.ct)), Charsets.UTF_8))
        return GrantPayload(o.optString("by"), o.optString("at"), o.optString("token").takeIf { it.isNotEmpty() })
    }

    private fun aesKey(priv: PrivateKey, pub: ECPublicKey): SecretKeySpec {
        val ka = KeyAgreement.getInstance("ECDH")
        ka.init(priv)
        ka.doPhase(pub, true)
        return SecretKeySpec(ka.generateSecret(), "AES")        // the raw 32-byte secret, as WebCrypto's deriveKey uses it
    }

    // ---- capsules: what a QR or a messenger carries -------------------------------------------------------------

    fun pack(o: JSONObject): String = B64.enc(o.toString().toByteArray(Charsets.UTF_8))

    /** The QR / link for a request: the app's scanner and the phone's camera both route it to Eszközök. */
    fun requestLink(r: DeviceRequest): String = "vrg://devices?req=" + pack(r.toJson())

    /** The QR / link for a grant: back to a web device's own page, or to the app's Eszközök. */
    fun grantLink(g: DeviceGrant, back: String?): String {
        val c = pack(g.toJson())
        return if (back != null && back.startsWith("https://")) back.substringBefore('#') + "#grant=" + c else "vrg://devices?grant=$c"
    }

    sealed class Parsed {
        data class Req(val r: DeviceRequest) : Parsed()
        data class Grant(val g: DeviceGrant) : Parsed()
        data class Bad(val why: String) : Parsed()
    }

    /** A capsule from a link (vrg://devices?req=…, …#grant=…), a raw capsule, or a whole messenger message holding one. */
    fun read(text: String?): Parsed {
        val s = text?.trim().orEmpty()
        val cap = Regex("(?:req|grant)=([A-Za-z0-9_-]{40,})").find(s)?.groupValues?.get(1)
            ?: Regex("([A-Za-z0-9_-]{80,})").find(s)?.groupValues?.get(1)
            ?: return Parsed.Bad("Nem találok kérést vagy engedélyt a szövegben.")
        val o = try { JSONObject(String(B64.dec(cap) ?: return Parsed.Bad("Sérült kód."), Charsets.UTF_8)) } catch (e: Exception) { return Parsed.Bad("Sérült kód.") }
        return when (o.optString("t")) {
            REQ -> {
                val pub = Jwk.parse(o.optJSONObject("pub")) ?: return Parsed.Bad("A kérés kulcsa hibás.")
                val id = o.optString("id").takeIf { norm(it).length in 6..40 } ?: return Parsed.Bad("A kérésből hiányzik az eszköz azonosítója.")
                val r = DeviceRequest(id, o.optString("name"), o.optString("model"), o.optString("os"), o.optString("app"), pub,
                    o.optString("code"), o.optString("at"), o.optString("back").takeIf { it.startsWith("https://") })
                if (r.code != code(id, pub)) Parsed.Bad("A kérés kódja nem egyezik: sérült vagy módosított üzenet.") else Parsed.Req(r)
            }
            GRANT -> {
                val epub = Jwk.parse(o.optJSONObject("epub")) ?: return Parsed.Bad("Az engedély kulcsa hibás.")
                Parsed.Grant(DeviceGrant(o.optString("to"), epub, o.optString("iv"), o.optString("ct"), o.optString("by")))
            }
            else -> Parsed.Bad("Ez nem VRG eszköz-kérés vagy -engedély.")
        }
    }

    private fun sha256Hex(s: String): String =
        MessageDigest.getInstance("SHA-256").digest(s.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
}
