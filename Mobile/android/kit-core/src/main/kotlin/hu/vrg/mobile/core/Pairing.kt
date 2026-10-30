package hu.vrg.mobile.core

import org.json.JSONObject
import java.security.KeyFactory
import java.security.PrivateKey
import java.security.PublicKey
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import java.util.Base64

// QR pairing with the PC relay (WP M2), the parts that are rules rather than Android: the relay's
// address, what the PC's QR carries, what the phone signs, and the relay messages. The handshake
// itself is described in Planner/projects/varler-planner/tools/relay-pair.js; this is its phone side.
// Signing is plain JCA (SHA256withECDSA): on the phone the key comes from the Android Keystore, in
// the tests from a software key, and Mobile/tests/fixtures/relay-auth.json checks both against Node.

object RelayAddress {
    const val DEFAULT_PORT = 47291

    /** Accepts what a person types or a QR carries: "192.168.1.24", "pc:47292", http://…/phone-sender.html, ws://… */
    fun normalize(raw: String): String {
        var s = raw.trim()
        if (s.isEmpty()) return ""
        s = s.replace(Regex("^http(s?)://"), "ws$1://")
        if (!s.startsWith("ws://") && !s.startsWith("wss://")) s = "ws://$s"
        val scheme = s.substringBefore("://")
        val rest = s.substringAfter("://")
        val host = rest.substringBefore('/')
        val withPort = if (host.contains(':')) host else "$host:$DEFAULT_PORT"
        return "$scheme://$withPort"
    }
}

/** What the PC's pairing QR carries: vrg://pair?ws=ws://<lan-ip>:<port>&c=<code>&n=<pc name>. */
data class PairOffer(val ws: String, val code: String, val pcName: String) {
    companion object {
        private val CODE = Regex("[0-9a-f]{32}")
        private val WS = Regex("ws://[A-Za-z0-9.\\-]+:[0-9]{1,5}")

        /** From a routed link (Links sends vrg://pair here). Null unless every part is well formed. */
        fun from(route: Route): PairOffer? {
            if (route.feature != Catalogue.PAIR.id) return null
            val code = route.params["c"]?.lowercase() ?: return null
            if (!CODE.matches(code)) return null
            val ws = RelayAddress.normalize(route.params["ws"] ?: return null)
            if (!WS.matches(ws)) return null
            val name = route.params["n"].orEmpty().filter { it >= ' ' }.take(60)
            return PairOffer(ws, code, name)
        }

        /** From whatever a scanner read: only our own pairing link counts. */
        fun parse(scanned: String?): PairOffer? = Links.route(scanned)?.let(::from)
    }
}

object RelayAuth {
    const val ALGORITHM = "SHA256withECDSA"

    /** What the phone signs; the same string as authText() in relay-pair.js. */
    fun text(challenge: String, id: String) = "vrg-relay-auth:1:$challenge:$id"

    /** The DER signature, base64, as the relay's crypto.verify(..., {dsaEncoding:'der'}) expects. */
    fun sign(key: PrivateKey, challenge: String, id: String): String {
        val s = Signature.getInstance(ALGORITHM)
        s.initSign(key)
        s.update(text(challenge, id).toByteArray(Charsets.UTF_8))
        return Base64.getEncoder().encodeToString(s.sign())
    }

    fun verify(publicKeyB64: String, challenge: String, id: String, sigB64: String): Boolean = try {
        val s = Signature.getInstance(ALGORITHM)
        s.initVerify(decodePublic(publicKeyB64))
        s.update(text(challenge, id).toByteArray(Charsets.UTF_8))
        s.verify(Base64.getDecoder().decode(sigB64))
    } catch (e: Exception) { false }

    /** X.509 SubjectPublicKeyInfo, base64: what the relay stores and Node's createPublicKey reads. */
    fun encodePublic(key: PublicKey): String = Base64.getEncoder().encodeToString(key.encoded)

    fun decodePublic(b64: String): PublicKey =
        KeyFactory.getInstance("EC").generatePublic(X509EncodedKeySpec(Base64.getDecoder().decode(b64)))
}

/** The relay's own answers about pairing and trust, parsed; everything else is null. */
sealed interface RelayNote {
    data class Welcome(val challenge: String, val pcId: String, val pcName: String) : RelayNote
    data class Paired(val ok: Boolean, val id: String?, val pcId: String?, val pcName: String?, val reason: String?) : RelayNote
    data class Trust(val ok: Boolean, val id: String?, val pcId: String?, val challenge: String?, val reason: String?) : RelayNote
}

object RelayMsgs {
    private var seq = 0

    @Synchronized
    private fun build(type: String, payload: JSONObject, to: String? = null): String {
        val o = JSONObject().put("v", 1).put("from", "phone").put("seq", ++seq)
            .put("t", System.currentTimeMillis()).put("type", type).put("payload", payload)
        if (to != null) o.put("to", to)
        return o.toString()
    }

    /** The phone's one hello for the app-wide link: the caps of every feature that uses the relay. */
    fun hello(app: String, caps: Collection<String>): String =
        build("hello", JSONObject().put("role", "phone").put("app", app).put("caps", org.json.JSONArray(caps.toList())))

    fun pair(code: String, device: String, publicKeyB64: String): String =
        build("pair", JSONObject().put("code", code).put("device", device).put("pub", publicKeyB64), "relay")

    fun auth(id: String, sig: String): String = build("auth", JSONObject().put("id", id).put("sig", sig), "relay")

    fun unpair(id: String): String = build("unpair", JSONObject().put("id", id), "relay")

    fun parse(raw: String): RelayNote? {
        val m = try { JSONObject(raw) } catch (e: Exception) { return null }
        if (m.optString("from") != "relay") return null
        val p = m.optJSONObject("payload") ?: return null
        val pc = p.optJSONObject("pc")
        fun str(o: JSONObject?, k: String): String? = if (o == null || !o.has(k) || o.isNull(k)) null else o.optString(k)
        return when (m.optString("type")) {
            "welcome" -> {
                val ch = str(p, "challenge") ?: return null
                RelayNote.Welcome(ch, str(pc, "id") ?: return null, str(pc, "name").orEmpty())
            }
            "paired" -> RelayNote.Paired(p.optBoolean("ok", false), str(p, "id"), str(pc, "id"), str(pc, "name"), str(p, "reason"))
            "trust" -> RelayNote.Trust(p.optBoolean("ok", false), str(p, "id"), str(pc, "id"), str(p, "challenge"), str(p, "reason"))
            else -> null
        }
    }
}
