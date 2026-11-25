package hu.vrg.mobile.core

import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.security.PrivateKey
import java.security.SecureRandom
import java.security.interfaces.ECPublicKey
import java.util.zip.GZIPInputStream
import java.util.zip.GZIPOutputStream
import javax.crypto.Cipher
import javax.crypto.KeyAgreement
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

// VRG Jegyzetek: client notes sealed on the `vrg-notes` branch (WP M69, D-180), the Workflow Kit's way (D-52).
//
// A sealed note's file holds no readable text: the note (its JSON, gzipped) is encrypted with a fresh AES-256-GCM key,
// and that key is wrapped once for every recipient with P-256 ECDH (a fresh key pair per recipient, the raw shared
// secret as the AES-256-GCM key, WebCrypto's shape, as DeviceTrust and Workflow do). Additional data binds the content
// to the note id and each wrapped key to the note id and the recipient, so a file cannot be moved to another note or
// handed to another device. Only the note id and the recipients' device ids are readable.
//
// The recipients are this device and the devices whose key the owner confirmed here by its 6-character code (the
// Eszközök code, DeviceTrust.code): typed on this phone, pinned outside Git, so writing a key to the branch or to
// devices.json is not enough to receive client notes. Every device publishes its public key as keys/<ID>.json.

/** A device's public key on the branch: keys/<ID>.json. */
data class NoteKey(val id: String, val name: String, val pub: Jwk, val at: String) {
    val code: String get() = DeviceTrust.code(DeviceTrust.norm(id), pub)

    fun toJson(): JSONObject = JSONObject().put("kind", NoteSeal.KEY_KIND).put("v", 1).put("id", DeviceTrust.norm(id))
        .put("name", name).put("pub", pub.toJson()).put("code", code).put("at", at)

    companion object {
        fun parse(text: String?): NoteKey? = try {
            val o = JSONObject(text ?: "")
            if (o.optString("kind") != NoteSeal.KEY_KIND) null
            else {
                val id = DeviceTrust.norm(o.optString("id"))
                val pub = Jwk.parse(o.optJSONObject("pub"))
                if (id.isEmpty() || pub == null) null else NoteKey(id, o.optString("name").take(40), pub, o.optString("at"))
            }
        } catch (e: Exception) { null }
    }
}

/** A device a sealed note opens for. */
data class NoteRecipient(val id: String, val name: String, val pub: Jwk) {
    fun toJson(): JSONObject = JSONObject().put("id", DeviceTrust.norm(id)).put("name", name).put("pub", pub.toJson())

    companion object {
        fun parse(o: JSONObject?): NoteRecipient? {
            o ?: return null
            val id = DeviceTrust.norm(o.optString("id"))
            val pub = Jwk.parse(o.optJSONObject("pub")) ?: return null
            return if (id.isEmpty()) null else NoteRecipient(id, o.optString("name"), pub)
        }

        /** The pinned list as this device stores it (prefs, never Git). */
        fun listToJson(list: List<NoteRecipient>): String = JSONArray(list.map { it.toJson() }).toString()
        fun listFrom(text: String?): List<NoteRecipient> = try {
            val a = JSONArray(text ?: "[]")
            (0 until a.length()).mapNotNull { parse(a.optJSONObject(it)) }
        } catch (e: Exception) { emptyList() }
    }
}

object NoteSeal {
    const val KIND = "vrg-note-sealed"
    const val KEY_KIND = "vrg-note-key"
    const val KEYS = "keys"
    /** The phone refuses to inflate past it. */
    const val MAX_PLAIN = 2 * 1024 * 1024

    fun keyPath(id: String) = "$KEYS/${DeviceTrust.norm(id)}.json"
    fun keyId(name: String) = name.removeSuffix(".json").takeIf { name.endsWith(".json") }?.let(DeviceTrust::norm)

    private fun aadNote(id: String) = "vrg-note/1/$id".toByteArray(Charsets.UTF_8)
    private fun aadKey(id: String, to: String) = "vrg-note-key/1/$id/${DeviceTrust.norm(to)}".toByteArray(Charsets.UTF_8)
    private val rnd = SecureRandom()

    /**
     * Pins [key] when [typed] is its code (6 characters, case and spaces ignored), as seen on the other device.
     * Null = the code does not match: the key on the branch is not the one that device shows.
     */
    fun pin(key: NoteKey, typed: String): NoteRecipient? {
        val t = typed.filter { it.isLetterOrDigit() }.uppercase()
        return if (t.length == 6 && t == key.code) NoteRecipient(key.id, key.name, key.pub) else null
    }

    fun isSealed(text: String): Boolean = try { JSONObject(text).optString("kind") == KIND } catch (e: Exception) { false }

    /** The device ids a sealed file opens for (readable without a key). */
    fun recipients(text: String): List<String> = try {
        val a = JSONObject(text).optJSONArray("to") ?: JSONArray()
        (0 until a.length()).mapNotNull { a.optJSONObject(it)?.optString("id")?.takeIf { s -> s.isNotEmpty() } }
    } catch (e: Exception) { emptyList() }

    /** The branch file of [n], sealed to [to] (duplicates by id are dropped). */
    fun seal(n: VNote, to: List<NoteRecipient>): String {
        val list = to.distinctBy { DeviceTrust.norm(it.id) }
        require(list.isNotEmpty()) { "no recipient" }
        val plain = NoteJson.write(n).toString().toByteArray(Charsets.UTF_8)
        require(plain.size <= MAX_PLAIN) { "too big" }
        val cek = ByteArray(32).also { rnd.nextBytes(it) }
        val iv = ByteArray(12).also { rnd.nextBytes(it) }
        val ct = gcm(Cipher.ENCRYPT_MODE, cek, iv, aadNote(n.id), gzip(plain))
        val wrapped = JSONArray(list.map { r ->
            val eph = DeviceTrust.newKeyPair()
            val kiv = ByteArray(12).also { rnd.nextBytes(it) }
            val ck = gcm(Cipher.ENCRYPT_MODE, ecdh(eph.private, DeviceTrust.publicKey(r.pub)), kiv, aadKey(n.id, r.id), cek)
            JSONObject().put("id", DeviceTrust.norm(r.id)).put("epub", DeviceTrust.jwk(eph.public as ECPublicKey).toJson())
                .put("iv", B64.enc(kiv)).put("ck", B64.enc(ck))
        })
        return JSONObject().put("kind", KIND).put("v", 1).put("id", n.id).put("to", wrapped)
            .put("iv", B64.enc(iv)).put("ct", B64.enc(ct)).toString(1) + "\n"
    }

    /**
     * Opens a sealed file as device [myId]. Null when it is not for this device; throws when it was changed, moved to
     * another note id ([expectId]) or is too big.
     */
    fun open(text: String, myId: String, myPrivate: PrivateKey, expectId: String? = null): VNote? {
        val o = JSONObject(text)
        require(o.optString("kind") == KIND) { "not sealed" }
        val id = o.getString("id")
        require(expectId == null || id == expectId) { "a sealed file under another note's name" }
        val a = o.optJSONArray("to") ?: JSONArray()
        val mine = (0 until a.length()).mapNotNull { a.optJSONObject(it) }.firstOrNull { DeviceTrust.sameId(it.optString("id"), myId) } ?: return null
        val epub = Jwk.parse(mine.optJSONObject("epub")) ?: throw IllegalArgumentException("broken key")
        val cek = gcm(Cipher.DECRYPT_MODE, ecdh(myPrivate, DeviceTrust.publicKey(epub)), dec(mine.optString("iv")), aadKey(id, myId), dec(mine.optString("ck")))
        val plain = gunzip(gcm(Cipher.DECRYPT_MODE, cek, dec(o.optString("iv")), aadNote(id), dec(o.optString("ct"))))
        val n = NoteJson.read(String(plain, Charsets.UTF_8)) ?: throw IllegalArgumentException("broken note")
        require(n.id == id) { "the note inside has another id" }
        return n.copy(sealed = true)
    }

    private fun dec(s: String) = B64.dec(s) ?: throw IllegalArgumentException("broken field")

    private fun gcm(mode: Int, key: ByteArray, iv: ByteArray, aad: ByteArray, data: ByteArray): ByteArray =
        Cipher.getInstance("AES/GCM/NoPadding").apply {
            init(mode, SecretKeySpec(key, "AES"), GCMParameterSpec(128, iv)); updateAAD(aad)
        }.doFinal(data)

    private fun ecdh(priv: PrivateKey, pub: ECPublicKey): ByteArray =
        KeyAgreement.getInstance("ECDH").apply { init(priv); doPhase(pub, true) }.generateSecret()

    private fun gzip(b: ByteArray): ByteArray = ByteArrayOutputStream().also { o -> GZIPOutputStream(o).use { it.write(b) } }.toByteArray()

    private fun gunzip(b: ByteArray): ByteArray {
        val out = ByteArrayOutputStream()
        GZIPInputStream(ByteArrayInputStream(b)).use { z ->
            val buf = ByteArray(16 * 1024)
            while (true) {
                val k = z.read(buf); if (k < 0) break
                out.write(buf, 0, k)
                require(out.size() <= MAX_PLAIN) { "too big" }
            }
        }
        return out.toByteArray()
    }
}

/** What a branch file became on this device. */
sealed interface NoteDecoded {
    /** [reseal]: it must be written again (a client note found unsealed: an older build wrote it). */
    data class Open(val note: VNote, val reseal: Boolean = false) : NoteDecoded
    /** Sealed for other devices only. */
    data object Locked : NoteDecoded
    data object Bad : NoteDecoded
}

/** How notes become branch files and back (NoteSync.run). */
interface NoteCodec {
    /** The file for [n], or null when it cannot be written yet (a sealed note and no key here): it stays dirty. */
    fun encode(n: VNote): String?
    fun decode(text: String, id: String): NoteDecoded

    /** Everything plain: the tests and a hub without sealing. */
    object Plain : NoteCodec {
        override fun encode(n: VNote) = NoteSync.file(n)
        override fun decode(text: String, id: String): NoteDecoded =
            NoteJson.read(text)?.takeIf { it.id == id }?.let { NoteDecoded.Open(it) } ?: NoteDecoded.Bad
    }
}

/**
 * Seals what must be sealed: a note flagged [VNote.sealed] or of a [sealedOrigins] origin. A tombstone (purged) holds
 * no text and stays plain. [me] and [key] are this device; [trusted] the pinned other devices.
 */
class SealCodec(
    private val sealedOrigins: Set<String>,
    private val me: () -> NoteRecipient?,
    private val key: () -> PrivateKey?,
    private val trusted: () -> List<NoteRecipient>,
) : NoteCodec {
    fun mustSeal(n: VNote) = !n.purged && (n.sealed || n.origin?.app in sealedOrigins)

    override fun encode(n: VNote): String? {
        if (!mustSeal(n)) return NoteSync.file(n)
        val self = me() ?: return null
        return try { NoteSeal.seal(n.copy(sealed = true), listOf(self) + trusted()) } catch (e: Exception) { null }
    }

    override fun decode(text: String, id: String): NoteDecoded {
        if (!NoteSeal.isSealed(text)) {
            val n = NoteJson.read(text)?.takeIf { it.id == id } ?: return NoteDecoded.Bad
            val must = mustSeal(n)
            return NoteDecoded.Open(n.copy(sealed = n.sealed || must), reseal = must)
        }
        val self = me() ?: return NoteDecoded.Locked
        val priv = key() ?: return NoteDecoded.Locked
        return try {
            NoteSeal.open(text, self.id, priv, expectId = id)?.let { NoteDecoded.Open(it) } ?: NoteDecoded.Locked
        } catch (e: Exception) { NoteDecoded.Bad }
    }
}
