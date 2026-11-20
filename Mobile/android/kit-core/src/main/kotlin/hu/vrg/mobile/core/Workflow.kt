package hu.vrg.mobile.core

import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.security.KeyPair
import java.security.PrivateKey
import java.security.SecureRandom
import java.security.interfaces.ECPublicKey
import java.util.zip.GZIPInputStream
import java.util.zip.GZIPOutputStream
import javax.crypto.Cipher
import javax.crypto.KeyAgreement
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

// Varler Workflow Kit on the phone (WP M42, D-50 = C). The Kit lives on the PC (H:\VRG\Full\Varler_Workflow_Kit and
// the job folders in Full\jobs), outside Git, because it carries client data. The PC (tools/workflow-seal.js) packs
// each job's state and figures into one JSON, gzips it and seals it to one phone's device key (the Eszközök P-256 key,
// WP M35): ECDH with a fresh key, the raw 32-byte secret as the AES-GCM key (WebCrypto's deriveKey), a 12-byte IV, the
// recipient's id as additional data. Only the sealed file goes onto the `workflow-sealed` branch; nothing in clear.
//
// The branch holds:
//   keys/<ID>.json    a phone's public key (vrg-wk-key), written by the phone; the PC seals only to a key whose
//                     6-character code the Founder confirmed on the PC once (`workflow-seal.js trust <ID> <CODE>`)
//   sealed/<ID>.json  the pack for that phone (vrg-wk-sealed)
//
// The phone keeps the sealed file as it came (it opens only with the Keystore-protected device key) and decrypts it in
// memory while the screen is shown.

data class WkKey(val id: String, val name: String, val pub: Jwk, val code: String, val at: String) {
    fun toJson(): JSONObject = JSONObject().put("t", Workflow.KEY_T).put("v", 1).put("id", id).put("name", name)
        .put("pub", pub.toJson()).put("code", code).put("at", at)

    companion object {
        fun parse(text: String?): WkKey? = try {
            val o = JSONObject(text ?: return null)
            val pub = Jwk.parse(o.optJSONObject("pub"))
            val id = o.optString("id")
            if (o.optString("t") != Workflow.KEY_T || pub == null || DeviceTrust.norm(id).length !in 6..40) null
            else WkKey(id, o.optString("name"), pub, o.optString("code"), o.optString("at"))
        } catch (e: Exception) { null }
    }
}

/** The sealed pack for [to]; [made] and [jobs] are the only things readable without the key. */
data class WkSealed(val to: String, val epub: Jwk, val iv: String, val ct: String, val made: String, val jobs: Int) {
    fun toJson(): JSONObject = JSONObject().put("t", Workflow.SEALED_T).put("v", 1).put("to", to).put("epub", epub.toJson())
        .put("iv", iv).put("ct", ct).put("z", "gzip").put("made", made).put("jobs", jobs)

    companion object {
        fun parse(text: String?): WkSealed? = try {
            val o = JSONObject(text ?: return null)
            val epub = Jwk.parse(o.optJSONObject("epub"))
            if (o.optString("t") != Workflow.SEALED_T || o.optInt("v") != 1 || epub == null || o.optString("z") != "gzip") null
            else WkSealed(o.optString("to"), epub, o.optString("iv"), o.optString("ct"), o.optString("made"), o.optInt("jobs"))
        } catch (e: Exception) { null }
    }
}

/** One priced variant of an offer (offer.json's `A`, `B`, ...). Money in forints; null = not in the file. */
data class WkVariant(
    val key: String, val labour: Long?, val material: Long?, val total: Long?,
    val hours: Double?, val daysMin: Int?, val daysMax: Int?, val m2: Double?,
)

data class WkDoc(val name: String, val text: String)
data class WkFile(val name: String, val size: Long)

data class WkJob(
    val code: String, val folder: String, val title: String, val updated: String, val address: String?,
    /** The Kit's steps that have a file in the job folder (Workflow.STEPS ids). */
    val steps: Set<String>,
    val variants: List<WkVariant>, val docs: List<WkDoc>, val files: List<WkFile>,
) {
    /** The last step reached, as its Hungarian name; "Új" when no step has a file yet. */
    val stage: String get() = Workflow.STEPS.lastOrNull { it.first in steps }?.second ?: "Új"
}

data class WkPack(val made: String, val from: String, val jobs: List<WkJob>)

object Workflow {
    const val BRANCH = "workflow-sealed"
    const val KEY_T = "vrg-wk-key"
    const val SEALED_T = "vrg-wk-sealed"
    const val PACK_T = "vrg-wk-pack"
    /** The sealer refuses bigger packs; the phone refuses to inflate past it. */
    const val MAX_PLAIN = 8 * 1024 * 1024

    /** The Kit's steps in order (README of the Kit: funnel → takeoff → price → offer → document). */
    val STEPS = listOf(
        "funnel" to "Kérdéssor", "takeoff" to "Anyagkigyűjtés", "price" to "Árazás", "offer" to "Ajánlat", "doc" to "Dokumentum",
    )

    fun keyPath(id: String) = "keys/${DeviceTrust.norm(id)}.json"
    fun sealedPath(id: String) = "sealed/${DeviceTrust.norm(id)}.json"
    fun aad(id: String) = "vrg-wk-sealed/1/${DeviceTrust.norm(id)}".toByteArray(Charsets.UTF_8)

    /** This phone's key file; its code is the Eszközök code (SHA-256 over the id and the key), checked by eye on the PC. */
    fun keyFile(id: String, name: String, pub: Jwk, at: String) =
        WkKey(DeviceTrust.norm(id), name.trim().take(40), pub, DeviceTrust.code(DeviceTrust.norm(id), pub), at)

    private val rnd = SecureRandom()

    /** Seals [plain] (the pack's JSON) to [to] / [pub]. The PC does this in Node; here for the tests and for parity. */
    fun seal(plain: String, to: String, pub: Jwk, made: String, jobs: Int, eph: KeyPair = DeviceTrust.newKeyPair()): WkSealed {
        val raw = plain.toByteArray(Charsets.UTF_8)
        require(raw.size <= MAX_PLAIN) { "too big" }
        val iv = ByteArray(12).also { rnd.nextBytes(it) }
        val c = Cipher.getInstance("AES/GCM/NoPadding").apply {
            init(Cipher.ENCRYPT_MODE, aesKey(eph.private, DeviceTrust.publicKey(pub)), GCMParameterSpec(128, iv))
            updateAAD(aad(to))
        }
        return WkSealed(DeviceTrust.norm(to), DeviceTrust.jwk(eph.public as ECPublicKey), B64.enc(iv), B64.enc(c.doFinal(gzip(raw))), made, jobs)
    }

    /** Opens a pack on the phone it was sealed for; throws when it is for another phone, was changed, or is too big. */
    fun open(s: WkSealed, myId: String, myPrivate: PrivateKey): String {
        require(DeviceTrust.sameId(s.to, myId)) { "Ez a csomag egy másik eszköznek szól." }
        val c = Cipher.getInstance("AES/GCM/NoPadding").apply {
            init(Cipher.DECRYPT_MODE, aesKey(myPrivate, DeviceTrust.publicKey(s.epub)), GCMParameterSpec(128, B64.dec(s.iv)))
            updateAAD(aad(myId))
        }
        return String(gunzip(c.doFinal(B64.dec(s.ct) ?: throw IllegalArgumentException("Sérült csomag."))), Charsets.UTF_8)
    }

    private fun aesKey(priv: PrivateKey, pub: ECPublicKey): SecretKeySpec {
        val ka = KeyAgreement.getInstance("ECDH")
        ka.init(priv)
        ka.doPhase(pub, true)
        return SecretKeySpec(ka.generateSecret(), "AES")
    }

    private fun gzip(b: ByteArray): ByteArray = ByteArrayOutputStream().also { o -> GZIPOutputStream(o).use { it.write(b) } }.toByteArray()

    private fun gunzip(b: ByteArray): ByteArray {
        val out = ByteArrayOutputStream()
        GZIPInputStream(ByteArrayInputStream(b)).use { z ->
            val buf = ByteArray(16 * 1024)
            while (true) {
                val n = z.read(buf)
                if (n < 0) break
                out.write(buf, 0, n)
                require(out.size() <= MAX_PLAIN) { "A csomag túl nagy." }
            }
        }
        return out.toByteArray()
    }

    // ---- the pack ----------------------------------------------------------------------------------------------------

    fun parsePack(json: String?): WkPack? = try {
        val o = JSONObject(json ?: return null)
        if (o.optString("t") != PACK_T || o.optInt("v") != 1) null
        else WkPack(o.optString("made"), o.optString("from"), objs(o.optJSONArray("jobs")).mapNotNull(::job))
    } catch (e: Exception) { null }

    private fun job(o: JSONObject): WkJob? {
        val code = o.optString("code").takeIf { it.isNotBlank() } ?: return null
        val steps = o.optJSONObject("steps")
        return WkJob(
            code = code, folder = o.optString("folder"), title = o.optString("title").ifBlank { code },
            updated = o.optString("updated"), address = o.optString("address").takeIf { it.isNotBlank() },
            steps = STEPS.map { it.first }.filter { steps?.optBoolean(it) == true }.toSet(),
            variants = objs(o.optJSONArray("variants")).map { v ->
                val days = v.optJSONArray("days")
                WkVariant(
                    key = v.optString("key"), labour = long(v, "labour"), material = long(v, "material"),
                    total = long(v, "total") ?: sum(long(v, "labour"), long(v, "material")),
                    hours = num(v, "hours"), daysMin = days?.optInt(0)?.takeIf { days.length() > 0 },
                    daysMax = days?.optInt(days.length() - 1)?.takeIf { days.length() > 0 }, m2 = num(v, "m2"),
                )
            },
            docs = objs(o.optJSONArray("docs")).mapNotNull { d -> d.optString("name").takeIf { it.isNotBlank() }?.let { WkDoc(it, d.optString("text")) } },
            files = objs(o.optJSONArray("files")).mapNotNull { f -> f.optString("name").takeIf { it.isNotBlank() }?.let { WkFile(it, f.optLong("size")) } },
        )
    }

    private fun objs(a: JSONArray?): List<JSONObject> = if (a == null) emptyList() else (0 until a.length()).mapNotNull { a.optJSONObject(it) }
    private fun num(o: JSONObject, k: String): Double? = if (o.has(k) && !o.isNull(k)) o.optDouble(k).takeIf { !it.isNaN() } else null
    private fun long(o: JSONObject, k: String): Long? = num(o, k)?.let { Math.round(it) }
    private fun sum(a: Long?, b: Long?): Long? = if (a == null && b == null) null else (a ?: 0) + (b ?: 0)

    /** 1 270 000 Ft: groups of three with a narrow no-break space, as the Kit's documents print them. */
    fun ft(n: Long): String {
        val s = kotlin.math.abs(n).toString().reversed().chunked(3).joinToString("\u202F").reversed()
        return (if (n < 0) "−" else "") + s + " Ft"
    }

    /** Hours and days as a short line: "96 eó · 4–6 nap · 62 m²". */
    fun effort(v: WkVariant): String = listOfNotNull(
        v.hours?.let { "${trim(it)} eó" },
        v.daysMin?.let { a -> if (v.daysMax != null && v.daysMax != a) "$a–${v.daysMax} nap" else "$a nap" },
        v.m2?.let { "${trim(it)} m²" },
    ).joinToString(" · ")

    private fun trim(d: Double): String = if (d == Math.floor(d)) d.toLong().toString() else "%.1f".format(java.util.Locale.ROOT, d).replace('.', ',')
}
