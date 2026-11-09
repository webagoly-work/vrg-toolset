package hu.vrg.mobile.relay

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.math.BigInteger
import java.security.KeyFactory
import java.security.PublicKey
import java.security.SecureRandom
import java.security.Signature
import java.security.interfaces.ECPublicKey
import java.security.spec.X509EncodedKeySpec
import java.util.Base64

// Who may use the phone's relay. The same handshake as the PC relay (relay-pair.js), with the roles turned
// round: the PHONE shows a one-time code, the PC app (Kódváros, the Planner) proves it saw that code and
// leaves a P-256 public key; on every later connect it signs the welcome's challenge with that key.
//
//   welcome{challenge, pc:{id, name}, relay:'phone'} ─┬─ known key?  auth{id, sig} ──▶ trust{ok}
//                                                     └─ a code?     pair{code, device, pub} ──▶ paired{ok, id}
//
// What differs from the PC relay, and why:
//   * The code is typed, not scanned (a PC has no camera pointed at the phone), so it is short: 10 letters
//     from a 31-letter alphabet with no 0/O/1/I/L (≈ 49 bits), shown as ABCDE-FGHJK. It lives 2 minutes, is
//     used once, and five wrong tries burn it — so guessing over the WiFi gets nowhere.
//   * A browser's WebCrypto signs in IEEE P1363 form (r‖s, 64 bytes); the Keystore and Node sign DER. Both
//     are accepted.
//   * The phone's own key is trusted as id "self", so the app's own Légegér link (on 127.0.0.1) proves itself
//     like everyone else; it is never stored and cannot be removed.

/** What a paired device signs; the same text as relay-pair.js authText() and kit-core RelayAuth.text(). */
fun authText(challenge: String, id: String) = "vrg-relay-auth:1:$challenge:$id"

data class TrustedDevice(val id: String, val device: String, val pub: String, val added: Long)

interface TrustStore {
    fun list(): List<TrustedDevice>
    fun add(device: String, pub: String, now: Long): TrustedDevice
    fun remove(id: String): Boolean
}

open class MemoryTrust(initial: List<TrustedDevice> = emptyList(), private val rnd: SecureRandom = SecureRandom()) : TrustStore {
    protected val items = initial.toMutableList()

    @Synchronized override fun list(): List<TrustedDevice> = items.toList()

    @Synchronized override fun add(device: String, pub: String, now: Long): TrustedDevice {
        items.firstOrNull { it.pub == pub }?.let { old ->
            val renamed = old.copy(device = device.ifBlank { old.device })
            items[items.indexOf(old)] = renamed
            changed()
            return renamed
        }
        val d = TrustedDevice(PairCodes.hex(rnd, 8), device.ifBlank { "PC" }, pub, now)
        items += d
        changed()
        return d
    }

    @Synchronized override fun remove(id: String): Boolean = items.removeAll { it.id == id }.also { if (it) changed() }

    protected open fun changed() {}
}

/** The paired PCs in a JSON file in the app's private storage (never in a backup: see feature-net's manifest). */
class FileTrust(private val file: File, rnd: SecureRandom = SecureRandom()) : MemoryTrust(read(file), rnd) {
    companion object {
        fun read(file: File): List<TrustedDevice> = try {
            val a = JSONObject(file.readText()).optJSONArray("devices") ?: JSONArray()
            (0 until a.length()).mapNotNull { i ->
                val o = a.optJSONObject(i) ?: return@mapNotNull null
                val id = o.optString("id"); val pub = o.optString("pub")
                if (id.isEmpty() || pub.isEmpty()) null else TrustedDevice(id, o.optString("device", "PC"), pub, o.optLong("added"))
            }
        } catch (_: Exception) { emptyList() }
    }

    override fun changed() {
        val a = JSONArray()
        items.forEach { a.put(JSONObject().put("id", it.id).put("device", it.device).put("pub", it.pub).put("added", it.added)) }
        file.parentFile?.mkdirs()
        val tmp = File(file.path + ".tmp")
        tmp.writeText(JSONObject().put("devices", a).toString(2))
        if (!tmp.renameTo(file)) { file.delete(); tmp.renameTo(file) }
    }
}

object PairCodes {
    const val ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
    const val LENGTH = 10
    const val TTL_MS = 2 * 60 * 1000L
    const val MAX_WRONG = 5

    fun hex(rnd: SecureRandom, bytes: Int): String = ByteArray(bytes).also(rnd::nextBytes).joinToString("") { "%02x".format(it) }

    fun newCode(rnd: SecureRandom): String = (1..LENGTH).map { ALPHABET[rnd.nextInt(ALPHABET.length)] }.joinToString("")

    /** ABCDE-FGHJK: how the phone shows it. */
    fun pretty(code: String) = code.chunked(5).joinToString("-")

    /** What a person typed: case, spaces and dashes do not matter (the alphabet has no look-alikes to confuse). */
    fun normalize(typed: String?): String = (typed ?: "").uppercase().filter { it in ALPHABET }
}

/** One live code at a time; issuing a new one retires the old. */
class CodeBook(private val rnd: SecureRandom, private val clock: () -> Long) {
    data class Live(val code: String, val expires: Long)

    private var live: Live? = null
    private var wrong = 0

    @Synchronized fun issue(): Live = Live(PairCodes.newCode(rnd), clock() + PairCodes.TTL_MS).also { live = it; wrong = 0 }

    @Synchronized fun current(): Live? = live?.takeIf { it.expires > clock() }

    @Synchronized fun cancel() { live = null }

    /** Single use. A wrong code counts against the live one; the fifth wrong try burns it. */
    @Synchronized fun consume(typed: String?): Boolean {
        val l = live ?: return false
        if (l.expires <= clock()) { live = null; return false }
        val ok = MessageDigestEq.eq(PairCodes.normalize(typed), l.code)
        if (ok) { live = null; return true }
        if (++wrong >= PairCodes.MAX_WRONG) live = null
        return false
    }
}

internal object MessageDigestEq {
    fun eq(a: String, b: String) = java.security.MessageDigest.isEqual(a.toByteArray(), b.toByteArray())
}

object RelayKeys {
    /** A base64 X.509 SubjectPublicKeyInfo that is an EC P-256 key, or null. */
    fun parsePub(b64: String?): PublicKey? = try {
        val k = KeyFactory.getInstance("EC").generatePublic(X509EncodedKeySpec(Base64.getDecoder().decode(b64 ?: return null)))
        if (k is ECPublicKey && k.params.curve.field.fieldSize == 256 && k.params.order.bitLength() == 256) k else null
    } catch (_: Exception) { null }

    fun verify(pubB64: String, challenge: String, id: String, sigB64: String?): Boolean {
        val key = parsePub(pubB64) ?: return false
        val raw = try { Base64.getDecoder().decode(sigB64 ?: return false) } catch (_: Exception) { return false }
        val forms = if (raw.size == 64) listOf(p1363ToDer(raw), raw) else listOf(raw)
        return forms.any { der ->
            try {
                Signature.getInstance("SHA256withECDSA").run {
                    initVerify(key)
                    update(authText(challenge, id).toByteArray(Charsets.UTF_8))
                    verify(der)
                }
            } catch (_: Exception) { false }
        }
    }

    /** WebCrypto's r‖s (32 + 32 bytes) as the DER SEQUENCE{INTEGER r, INTEGER s} that JCA verifies. */
    fun p1363ToDer(sig: ByteArray): ByteArray {
        fun int(b: ByteArray): ByteArray {
            val v = BigInteger(1, b).toByteArray()          // minimal, with a 0x00 when the top bit is set
            return byteArrayOf(0x02, v.size.toByte()) + v
        }
        val body = int(sig.copyOfRange(0, 32)) + int(sig.copyOfRange(32, 64))
        return byteArrayOf(0x30, body.size.toByte()) + body
    }
}
