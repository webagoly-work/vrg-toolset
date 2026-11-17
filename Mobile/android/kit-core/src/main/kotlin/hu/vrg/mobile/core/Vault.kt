package hu.vrg.mobile.core

import org.json.JSONArray
import org.json.JSONObject
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.EOFException
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.security.GeneralSecurityException
import java.security.MessageDigest
import java.security.SecureRandom
import java.text.Collator
import java.text.Normalizer
import java.util.Base64
import java.util.Locale
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

// Széf (WP M24): the phone's encrypted vault for client data, ID papers, documents, folders and files.
// Everything that decides what is safe lives here, in pure Kotlin, so the JVM tests check it without a phone:
//
//   the vault key (VK)   one random AES-256 key; it encrypts the index and every file (AES-GCM, one nonce each,
//                        the item id bound in as associated data, so a box cannot be swapped for another)
//   the PIN box          VK sealed with a key derived from the PIN or passphrase (PBKDF2-HMAC-SHA256), and that box
//                        sealed again by the device wrap (on the phone a non-exportable Android Keystore key), so
//                        the files copied off the phone cannot be brute-forced elsewhere
//   the biometric box    VK sealed by a Keystore key that only a fingerprint / face unlock releases; opaque here,
//                        the Android side makes and opens it (feature-vault/VaultKeys.kt)
//   the lockout          failed PIN tries wait longer and longer; with "10 hibás után törlés" the tenth wipes it
//   the backup           a .vrgvault file sealed with its own password, record by record, for a new phone
//
// No plaintext ever touches the disk here; the Android side keeps decrypted copies only in memory, or for
// "Megnyitás másik appban" in cache/vault-out, which every lock empties (D-19).

/** A sealed box did not open: the wrong key, or the bytes were changed. */
class VaultSealBroken(message: String) : Exception(message)

object VaultCrypto {
    const val KEY = 32
    const val NONCE = 12
    private const val TAG_BITS = 128
    private val rnd = SecureRandom()

    fun random(n: Int): ByteArray = ByteArray(n).also { rnd.nextBytes(it) }

    /** nonce ‖ ciphertext ‖ tag. [aad] ties the box to its place (its item id), so it cannot be moved. */
    fun seal(key: ByteArray, plain: ByteArray, aad: String): ByteArray {
        val nonce = random(NONCE)
        val c = Cipher.getInstance("AES/GCM/NoPadding")
        c.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_BITS, nonce))
        c.updateAAD(aad.toByteArray(Charsets.UTF_8))
        return nonce + c.doFinal(plain)
    }

    fun open(key: ByteArray, box: ByteArray, aad: String): ByteArray {
        if (box.size < NONCE + TAG_BITS / 8) throw VaultSealBroken("a doboz túl rövid")
        try {
            val c = Cipher.getInstance("AES/GCM/NoPadding")
            c.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_BITS, box, 0, NONCE))
            c.updateAAD(aad.toByteArray(Charsets.UTF_8))
            return c.doFinal(box, NONCE, box.size - NONCE)
        } catch (e: GeneralSecurityException) {
            throw VaultSealBroken("nem nyílik ($aad)")
        }
    }

    fun derive(secret: CharArray, salt: ByteArray, iterations: Int): ByteArray {
        val spec = PBEKeySpec(secret, salt, iterations, KEY * 8)
        try {
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
        } finally {
            spec.clearPassword()
        }
    }

    fun sha256(b: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(b).joinToString("") { "%02x".format(it) }

    fun wipe(b: ByteArray?) { b?.fill(0) }
    fun wipe(c: CharArray?) { c?.fill('\u0000') }

    /** 16 hex characters: item ids and blob names. */
    fun newId(): String = random(8).joinToString("") { "%02x".format(it) }

    fun b64(b: ByteArray): String = Base64.getEncoder().encodeToString(b)
    fun unb64(s: String): ByteArray = Base64.getDecoder().decode(s)
}

/** An outer layer around the PIN box. On the phone: a non-exportable, no-auth Android Keystore key. */
interface VaultWrap {
    fun wrap(b: ByteArray): ByteArray
    /** Throws [VaultSealBroken] when the device key is gone (factory reset, a restored phone). */
    fun unwrap(b: ByteArray): ByteArray

    companion object {
        val NONE = object : VaultWrap {
            override fun wrap(b: ByteArray) = b
            override fun unwrap(b: ByteArray) = b
        }
    }
}

// ---- the secret: a PIN or a passphrase ------------------------------------------------------------------------------

enum class SecretKind(val id: String, val label: String) {
    PIN("pin", "PIN-kód"),
    PASS("pass", "Jelmondat"),
    ;
    companion object { fun of(id: String?) = entries.firstOrNull { it.id == id } ?: PIN }
}

object VaultSecret {
    const val PIN_MIN = 6
    const val PIN_MAX = 12
    const val PASS_MIN = 8

    /** Why this secret is not good enough (Hungarian, for the screen), or null when it is. */
    fun problem(secret: String, kind: SecretKind): String? = when (kind) {
        SecretKind.PIN -> when {
            secret.length < PIN_MIN -> "Legalább $PIN_MIN számjegy kell."
            secret.length > PIN_MAX -> "Legfeljebb $PIN_MAX számjegy lehet."
            !secret.all { it in '0'..'9' } -> "A PIN-kód csak számjegy lehet."
            secret.toSet().size == 1 -> "Ne legyen minden számjegy azonos."
            isRun(secret, 1) || isRun(secret, -1) -> "Ne legyen sorozat (123456, 987654)."
            secret in COMMON -> "Ez túl gyakori PIN-kód."
            else -> null
        }
        SecretKind.PASS -> when {
            secret.length < PASS_MIN -> "Legalább $PASS_MIN karakter kell."
            secret.isBlank() -> "Nem lehet csak szóköz."
            secret.toSet().size < 4 -> "Túl kevés különböző karakter."
            else -> null
        }
    }

    private fun isRun(s: String, step: Int) = s.zipWithNext().all { (a, b) -> (b - a) == step }

    private val COMMON = setOf("121212", "112233", "123123", "696969", "111222", "000123", "131313", "159753", "147258", "102030")
}

// ---- lockout and auto-lock ------------------------------------------------------------------------------------------

object VaultLock {
    /** How long the next try waits after this many failures in a row. */
    fun delayAfter(failures: Int): Long = when {
        failures < 5 -> 0L
        failures == 5 -> 30_000L
        failures == 6 -> 60_000L
        failures == 7 -> 5 * 60_000L
        failures == 8 -> 15 * 60_000L
        else -> 60 * 60_000L
    }

    /** With "10 hibás után törlés" on, the tenth wrong try in a row deletes the vault. */
    const val WIPE_AT = 10

    /** The auto-lock choices, in the order the settings show them. 0 = the moment the app leaves the screen. */
    val TIMEOUTS: List<Pair<Long, String>> = listOf(0L to "Azonnal", 30_000L to "30 mp", 60_000L to "1 perc", 5 * 60_000L to "5 perc")
    const val DEFAULT_TIMEOUT = 60_000L

    /** The app left the screen at [leftAt]; must it be locked when it comes back at [now]? */
    fun autoLockDue(leftAt: Long, now: Long, after: Long): Boolean = after <= 0L || now - leftAt >= after

    /** The decrypted clipboard copy is cleared after this. */
    const val CLIPBOARD_MS = 30_000L
}

// ---- the header: everything that is stored in the clear -------------------------------------------------------------

class VaultHeader(
    val version: Int,
    val salt: ByteArray,
    val iterations: Int,
    val kind: SecretKind,
    /** device.wrap( seal(derive(secret), VK, "vk.pin") ) */
    val pinBox: ByteArray,
    /** Made and opened by the Android side with a biometric-bound Keystore key; null = biometrics off. */
    val bioBox: ByteArray?,
    val failures: Int,
    val waitUntil: Long,
    val wipeAtTen: Boolean,
    val lockAfter: Long,
    val created: Long,
) {
    fun copy(
        salt: ByteArray = this.salt, iterations: Int = this.iterations, kind: SecretKind = this.kind,
        pinBox: ByteArray = this.pinBox, bioBox: ByteArray? = this.bioBox, failures: Int = this.failures,
        waitUntil: Long = this.waitUntil, wipeAtTen: Boolean = this.wipeAtTen, lockAfter: Long = this.lockAfter,
    ) = VaultHeader(version, salt, iterations, kind, pinBox, bioBox, failures, waitUntil, wipeAtTen, lockAfter, created)

    fun toJson(): String = JSONObject()
        .put("v", version).put("salt", VaultCrypto.b64(salt)).put("iter", iterations).put("kind", kind.id)
        .put("pin", VaultCrypto.b64(pinBox)).put("bio", bioBox?.let(VaultCrypto::b64) ?: JSONObject.NULL)
        .put("failures", failures).put("waitUntil", waitUntil).put("wipeAtTen", wipeAtTen)
        .put("lockAfter", lockAfter).put("created", created)
        .toString()

    companion object {
        fun parse(s: String): VaultHeader? = try {
            val o = JSONObject(s)
            VaultHeader(
                o.getInt("v"), VaultCrypto.unb64(o.getString("salt")), o.getInt("iter"), SecretKind.of(o.optString("kind")),
                VaultCrypto.unb64(o.getString("pin")), if (o.isNull("bio")) null else VaultCrypto.unb64(o.getString("bio")),
                o.optInt("failures", 0), o.optLong("waitUntil", 0L), o.optBoolean("wipeAtTen", false),
                o.optLong("lockAfter", VaultLock.DEFAULT_TIMEOUT), o.optLong("created", 0L),
            ).takeIf { it.version == 1 && it.iterations >= 1 && it.salt.size >= 16 }
        } catch (e: Exception) { null }
    }
}

// ---- what is in the vault -------------------------------------------------------------------------------------------

enum class VaultKind(val id: String, val label: String, val glyph: String) {
    FOLDER("folder", "Mappa", "▸"),
    NOTE("note", "Dokumentum", "✎"),
    RECORD("record", "Adatlap", "▤"),
    FILE("file", "Fájl", "📄"),
    ;
    companion object { fun of(id: String?) = entries.firstOrNull { it.id == id } }
}

class VaultField(val label: String, val value: String, val secret: Boolean = false) {
    fun with(value: String) = VaultField(label, value, secret)
}

class VaultFile(val name: String, val mime: String, val size: Long, val sha256: String)

class VaultItem(
    val id: String,
    val kind: VaultKind,
    val title: String,
    /** The folder it is in; null = the top. */
    val parent: String?,
    /** For a RECORD: which [VaultTemplate] it was made from (its glyph and field order). */
    val template: String? = null,
    val fields: List<VaultField> = emptyList(),
    val body: String = "",
    val file: VaultFile? = null,
    /** "Megnyitáskor újra azonosítás": the item (or the folder) asks for the PIN / fingerprint again. */
    val guard: Boolean = false,
    val created: Long = 0L,
    val updated: Long = 0L,
) {
    val glyph: String get() = if (kind == VaultKind.RECORD) VaultTemplates.byId(template).glyph else kind.glyph

    fun copy(
        title: String = this.title, parent: String? = this.parent, fields: List<VaultField> = this.fields,
        body: String = this.body, file: VaultFile? = this.file, guard: Boolean = this.guard, updated: Long = this.updated,
    ) = VaultItem(id, kind, title, parent, template, fields, body, file, guard, created, updated)
}

class VaultTemplate(val id: String, val label: String, val glyph: String, val fields: List<Pair<String, Boolean>>) {
    fun blank(): List<VaultField> = fields.map { (l, s) -> VaultField(l, "", s) }
}

object VaultTemplates {
    val CLIENT = VaultTemplate("client", "Ügyfél", "👤", listOf(
        "Név" to false, "Cím" to false, "Telefon" to false, "E-mail" to false, "Adószám" to false,
        "Fogyasztási hely (POD)" to false, "Mérőóra gyári szám" to false, "Kapu- / riasztókód" to true, "Megjegyzés" to false,
    ))
    val IDCARD = VaultTemplate("idcard", "Személyi igazolvány", "🪪", listOf(
        "Név" to false, "Okmányazonosító" to true, "Születési hely, idő" to false, "Anyja neve" to false, "Érvényes" to false,
    ))
    val ADDRESS = VaultTemplate("address", "Lakcímkártya", "🏠", listOf("Név" to false, "Lakcím" to false, "Okmányazonosító" to true))
    val DRIVING = VaultTemplate("driving", "Jogosítvány", "🚗", listOf("Név" to false, "Szám" to true, "Kategóriák" to false, "Érvényes" to false))
    val PASSPORT = VaultTemplate("passport", "Útlevél", "🛂", listOf("Név" to false, "Útlevélszám" to true, "Érvényes" to false))
    val SOCIAL = VaultTemplate("social", "TAJ és adóazonosító", "⚕", listOf("Név" to false, "TAJ szám" to true, "Adóazonosító jel" to true))
    val TRADE = VaultTemplate("trade", "Szakmai jogosultság", "⚡", listOf(
        "Név" to false, "Jogosultság" to false, "Nyilvántartási szám" to true, "Kamarai szám" to false, "Érvényes" to false,
    ))
    val CARD = VaultTemplate("card", "Bankkártya", "💳", listOf(
        "Kártyabirtokos" to false, "Kártyaszám" to true, "Lejárat" to false, "CVC" to true, "PIN" to true,
    ))
    val LOGIN = VaultTemplate("login", "Belépés", "🔑", listOf("Cím / URL" to false, "Felhasználó" to false, "Jelszó" to true, "Megjegyzés" to false))
    val WIFI = VaultTemplate("wifi", "WiFi", "📶", listOf("Hálózat (SSID)" to false, "Jelszó" to true))
    val CUSTOM = VaultTemplate("custom", "Egyéni adatlap", "◇", emptyList())

    /** The "+ Új" menu's order: client data first, then the ID papers, then the rest. */
    val ALL = listOf(CLIENT, IDCARD, ADDRESS, DRIVING, PASSPORT, SOCIAL, TRADE, CARD, LOGIN, WIFI, CUSTOM)

    fun byId(id: String?): VaultTemplate = ALL.firstOrNull { it.id == id } ?: CUSTOM
}

/** Why an index operation was refused (Hungarian, for the screen). */
class VaultRefused(message: String) : Exception(message)

class VaultIndex(val items: List<VaultItem>) {
    private val byId = items.associateBy { it.id }

    fun get(id: String?): VaultItem? = id?.let(byId::get)

    /** Folders first, then by title in Hungarian order. */
    fun children(parent: String?): List<VaultItem> =
        items.filter { it.parent == parent }.sortedWith(compareBy<VaultItem> { it.kind != VaultKind.FOLDER }.thenBy(COLLATOR) { it.title })

    /** The folders from the top down to [id] (itself included when it is a folder). */
    fun crumbs(id: String?): List<VaultItem> {
        val out = ArrayList<VaultItem>()
        var cur = get(id)
        val seen = HashSet<String>()
        while (cur != null && seen.add(cur.id)) {
            if (cur.kind == VaultKind.FOLDER) out.add(0, cur)
            cur = get(cur.parent)
        }
        return out
    }

    /** Is [id] or one of its folders marked "újra azonosítás"? */
    fun guarded(id: String?): Boolean {
        var cur = get(id)
        val seen = HashSet<String>()
        while (cur != null && seen.add(cur.id)) {
            if (cur.guard) return true
            cur = get(cur.parent)
        }
        return false
    }

    /** [id] and everything below it. */
    fun subtree(id: String): List<VaultItem> {
        val root = get(id) ?: return emptyList()
        val out = arrayListOf(root)
        var i = 0
        while (i < out.size) { out.addAll(items.filter { it.parent == out[i].id }); i++ }
        return out
    }

    fun add(item: VaultItem): VaultIndex {
        if (byId.containsKey(item.id)) throw VaultRefused("Ez az azonosító már létezik.")
        checkParent(item.parent)
        return VaultIndex(items + clean(item))
    }

    fun update(item: VaultItem): VaultIndex {
        val old = get(item.id) ?: throw VaultRefused("Nincs ilyen elem.")
        if (old.kind != item.kind) throw VaultRefused("A fajtája nem változhat.")
        if (item.parent != old.parent) return move(item.id, item.parent).update(item)
        return VaultIndex(items.map { if (it.id == item.id) clean(item) else it })
    }

    fun move(id: String, to: String?): VaultIndex {
        val it0 = get(id) ?: throw VaultRefused("Nincs ilyen elem.")
        checkParent(to)
        if (to != null && subtree(id).any { it.id == to }) throw VaultRefused("Mappa nem kerülhet önmagába.")
        return VaultIndex(items.map { if (it.id == id) it0.copy(parent = to) else it })
    }

    /** Removes [id] and everything below it. The second value: the ids whose file boxes must be deleted. */
    fun remove(id: String): Pair<VaultIndex, List<String>> {
        val gone = subtree(id)
        if (gone.isEmpty()) return this to emptyList()
        val ids = gone.map { it.id }.toSet()
        return VaultIndex(items.filter { it.id !in ids }) to gone.filter { it.kind == VaultKind.FILE }.map { it.id }
    }

    /** Titles, non-secret field values, note text and file names; case and accents do not matter. */
    fun search(q: String): List<VaultItem> {
        val words = fold(q).split(' ').filter { it.isNotBlank() }
        if (words.isEmpty()) return emptyList()
        return items.filter { item ->
            val hay = fold(buildString {
                append(item.title).append(' ').append(item.body).append(' ').append(item.file?.name ?: "")
                item.fields.filter { !it.secret }.forEach { append(' ').append(it.label).append(' ').append(it.value) }
            })
            words.all { it in hay }
        }.sortedWith(compareBy(COLLATOR) { it.title })
    }

    private fun checkParent(p: String?) {
        if (p == null) return
        val f = get(p) ?: throw VaultRefused("A mappa nem létezik.")
        if (f.kind != VaultKind.FOLDER) throw VaultRefused("Csak mappába lehet tenni.")
    }

    fun toJson(): String = JSONObject().put("v", 1).put("items", JSONArray().apply {
        items.forEach { i ->
            put(JSONObject()
                .put("id", i.id).put("kind", i.kind.id).put("title", i.title).put("parent", i.parent ?: JSONObject.NULL)
                .put("template", i.template ?: JSONObject.NULL).put("body", i.body).put("guard", i.guard)
                .put("created", i.created).put("updated", i.updated)
                .put("fields", JSONArray().apply { i.fields.forEach { f -> put(JSONObject().put("l", f.label).put("v", f.value).put("s", f.secret)) } })
                .put("file", i.file?.let { JSONObject().put("name", it.name).put("mime", it.mime).put("size", it.size).put("sha", it.sha256) } ?: JSONObject.NULL))
        }
    }).toString()

    companion object {
        const val MAX_TITLE = 120
        const val MAX_BODY = 200_000
        val EMPTY = VaultIndex(emptyList())
        private val COLLATOR: Comparator<String> = Collator.getInstance(Locale("hu", "HU")).apply { strength = Collator.SECONDARY }
            .let { c -> Comparator<String> { a, b -> c.compare(a, b) } }
        private val ID = Regex("[0-9a-f]{16}")

        fun fold(s: String): String =
            Normalizer.normalize(s.lowercase(Locale.ROOT), Normalizer.Form.NFD).replace(Regex("\\p{Mn}+"), "").replace(Regex("\\s+"), " ")

        /** A title as stored: trimmed, no control characters, at most [MAX_TITLE]; empty becomes "Névtelen". */
        fun title(s: String): String = s.filter { !it.isISOControl() }.trim().take(MAX_TITLE).ifEmpty { "Névtelen" }

        private fun clean(i: VaultItem) = i.copy(title = title(i.title), body = i.body.take(MAX_BODY))

        /** A broken item (bad id, unknown kind, a parent that is missing or not a folder) is moved or dropped, never fatal. */
        fun parse(s: String): VaultIndex {
            val arr = JSONObject(s).getJSONArray("items")
            val raw = (0 until arr.length()).mapNotNull { k ->
                val o = arr.getJSONObject(k)
                val id = o.optString("id")
                val kind = VaultKind.of(o.optString("kind")) ?: return@mapNotNull null
                if (!ID.matches(id)) return@mapNotNull null
                val fa = o.optJSONArray("fields") ?: JSONArray()
                val fo = o.optJSONObject("file")
                VaultItem(
                    id, kind, title(o.optString("title")), if (o.isNull("parent")) null else o.optString("parent"),
                    if (o.isNull("template")) null else o.optString("template"),
                    (0 until fa.length()).map { j -> fa.getJSONObject(j).let { VaultField(it.optString("l"), it.optString("v"), it.optBoolean("s")) } },
                    o.optString("body"),
                    fo?.let { VaultFile(it.optString("name"), it.optString("mime", "application/octet-stream"), it.optLong("size"), it.optString("sha")) },
                    o.optBoolean("guard"), o.optLong("created"), o.optLong("updated"),
                )
            }.distinctBy { it.id }
            val folders = raw.filter { it.kind == VaultKind.FOLDER }.associateBy { it.id }
            // a parent that is missing or not a folder: the item goes to the top; then break any folder loop the same way
            var fixed = raw.map { if (it.parent != null && it.parent !in folders) it.copy(parent = null) else it }
            val byId = fixed.associateBy { it.id }
            fixed = fixed.map { item ->
                var p = item.parent
                val seen = hashSetOf(item.id)
                while (p != null) { if (!seen.add(p)) return@map item.copy(parent = null); p = byId[p]?.parent }
                item
            }
            return VaultIndex(fixed)
        }
    }
}

// ---- the store: the vault's folder on the phone ---------------------------------------------------------------------

sealed interface VaultUnlock {
    class Open(val session: VaultSession) : VaultUnlock
    /** Wrong secret. [waitUntil] > now: the next try must wait. [wipeIn]: tries left before the wipe, when it is on. */
    class Wrong(val failures: Int, val waitUntil: Long, val wipeIn: Int?) : VaultUnlock
    class Wait(val until: Long) : VaultUnlock
    /** The tenth wrong try with "10 hibás után törlés" on: the vault is gone. */
    data object Wiped : VaultUnlock
    /** The device key is gone (a factory reset, a cloned phone): only a backup brings the contents back. */
    data object KeyLost : VaultUnlock
    data object Missing : VaultUnlock
}

class VaultStore(val dir: File, private val device: VaultWrap = VaultWrap.NONE, private val iterations: Int = DEFAULT_ITERATIONS) {
    private val headerFile = File(dir, "vault.json")
    private val indexFile = File(dir, "index.box")
    private val blobs = File(dir, "blobs")

    fun exists(): Boolean = headerFile.isFile && header() != null

    fun header(): VaultHeader? = if (headerFile.isFile) VaultHeader.parse(headerFile.readText()) else null

    internal fun writeHeader(h: VaultHeader) = atomic(headerFile, h.toJson().toByteArray(Charsets.UTF_8))

    @Synchronized
    fun create(secret: CharArray, kind: SecretKind, now: Long): VaultSession {
        if (exists()) throw VaultRefused("Már van széf ezen a telefonon.")
        VaultSecret.problem(String(secret), kind)?.let { throw VaultRefused(it) }
        dir.mkdirs(); blobs.mkdirs()
        val vk = VaultCrypto.random(VaultCrypto.KEY)
        val salt = VaultCrypto.random(16)
        val h = VaultHeader(1, salt, iterations, kind, pinBox(secret, salt, iterations, vk), null, 0, 0L, false, VaultLock.DEFAULT_TIMEOUT, now)
        writeHeader(h)
        val s = VaultSession(this, vk)
        s.save(VaultIndex.EMPTY)
        return s
    }

    @Synchronized
    fun unlock(secret: CharArray, now: Long): VaultUnlock {
        val h = header() ?: return VaultUnlock.Missing
        if (h.waitUntil > now) return VaultUnlock.Wait(h.waitUntil)
        val vk = try { openPinBox(h, secret) } catch (e: KeyLostException) { return VaultUnlock.KeyLost }
        if (vk != null) {
            if (h.failures != 0 || h.waitUntil != 0L) writeHeader(h.copy(failures = 0, waitUntil = 0L))
            return VaultUnlock.Open(VaultSession(this, vk))
        }
        val failures = h.failures + 1
        if (h.wipeAtTen && failures >= VaultLock.WIPE_AT) { destroy(); return VaultUnlock.Wiped }
        val wait = VaultLock.delayAfter(failures).let { if (it > 0) now + it else 0L }
        writeHeader(h.copy(failures = failures, waitUntil = wait))
        return VaultUnlock.Wrong(failures, wait, if (h.wipeAtTen) VaultLock.WIPE_AT - failures else null)
    }

    /** The biometric path: the Android side released VK from the bio box. Null when it does not open the index. */
    @Synchronized
    fun unlockWithKey(vk: ByteArray): VaultSession? {
        val h = header() ?: return null
        return try {
            VaultCrypto.open(vk, indexFile.readBytes(), "index")
            if (h.failures != 0 || h.waitUntil != 0L) writeHeader(h.copy(failures = 0, waitUntil = 0L))
            VaultSession(this, vk.copyOf())
        } catch (e: Exception) { null }
    }

    /** Deletes the whole vault folder. The phone side also drops its Keystore keys. */
    @Synchronized
    fun destroy() { dir.deleteRecursively() }

    private class KeyLostException : Exception()

    internal fun openPinBox(h: VaultHeader, secret: CharArray): ByteArray? {
        val inner = try { device.unwrap(h.pinBox) } catch (e: Exception) { throw KeyLostException() }
        val k = VaultCrypto.derive(secret, h.salt, h.iterations)
        return try { VaultCrypto.open(k, inner, "vk.pin") } catch (e: VaultSealBroken) { null } finally { VaultCrypto.wipe(k) }
    }

    internal fun pinBox(secret: CharArray, salt: ByteArray, iter: Int, vk: ByteArray): ByteArray {
        val k = VaultCrypto.derive(secret, salt, iter)
        try { return device.wrap(VaultCrypto.seal(k, vk, "vk.pin")) } finally { VaultCrypto.wipe(k) }
    }

    internal val iterationsForNew get() = iterations
    internal fun indexBox(): ByteArray? = if (indexFile.isFile) indexFile.readBytes() else null
    internal fun writeIndexBox(b: ByteArray) = atomic(indexFile, b)
    internal fun blob(id: String) = File(blobs, "$id.box")
    internal fun writeBlob(id: String, b: ByteArray) { blobs.mkdirs(); atomic(blob(id), b) }

    companion object {
        /** PBKDF2 rounds for a new vault: about a second on a mid-range phone, stored per vault so it can change. */
        const val DEFAULT_ITERATIONS = 310_000
        /** One file at most: it is encrypted in memory in one go. */
        const val MAX_FILE = 25L * 1024 * 1024

        internal fun atomic(f: File, b: ByteArray) {
            f.parentFile?.mkdirs()
            val tmp = File(f.parentFile, f.name + ".tmp")
            tmp.outputStream().use { it.write(b); it.fd.sync() }
            if (!tmp.renameTo(f)) { f.delete(); if (!tmp.renameTo(f)) throw java.io.IOException("nem írható: ${f.name}") }
        }
    }
}

/** An open vault. [close] forgets the key; every lock calls it. */
class VaultSession internal constructor(private val store: VaultStore, private var vk: ByteArray?) {
    var index: VaultIndex = VaultIndex.EMPTY
        private set

    init {
        store.indexBox()?.let { index = VaultIndex.parse(String(VaultCrypto.open(key(), it, "index"), Charsets.UTF_8)) }
    }

    val open: Boolean get() = vk != null

    private fun key(): ByteArray = vk ?: throw VaultRefused("A széf zárva van.")

    @Synchronized
    fun save(next: VaultIndex) {
        store.writeIndexBox(VaultCrypto.seal(key(), next.toJson().toByteArray(Charsets.UTF_8), "index"))
        index = next
    }

    /** A file into the vault as a new FILE item (or replacing [replace]'s content). */
    @Synchronized
    fun putFile(name: String, mime: String, bytes: ByteArray, parent: String?, now: Long): VaultItem {
        if (bytes.size > VaultStore.MAX_FILE) throw VaultRefused("Túl nagy fájl (legfeljebb ${VaultStore.MAX_FILE / 1024 / 1024} MB).")
        val id = VaultCrypto.newId()
        store.writeBlob(id, VaultCrypto.seal(key(), bytes, "blob:$id"))
        val clean = VaultFiles.safeName(name)
        val item = VaultItem(id, VaultKind.FILE, clean, parent, file = VaultFile(clean, mime.ifBlank { "application/octet-stream" },
            bytes.size.toLong(), VaultCrypto.sha256(bytes)), created = now, updated = now)
        try { save(index.add(item)) } catch (e: Exception) { store.blob(id).delete(); throw e }
        return item
    }

    @Synchronized
    fun readFile(id: String): ByteArray {
        val f = store.blob(id)
        if (!f.isFile) throw VaultRefused("A fájl tartalma hiányzik.")
        return VaultCrypto.open(key(), f.readBytes(), "blob:$id")
    }

    @Synchronized
    fun remove(id: String) {
        val (next, files) = index.remove(id)
        save(next)
        files.forEach { store.blob(it).delete() }
    }

    fun verify(secret: CharArray): Boolean {
        val h = store.header() ?: return false
        val k = try { store.openPinBox(h, secret) } catch (e: Exception) { null } ?: return false
        val same = k.contentEquals(key())
        VaultCrypto.wipe(k)
        return same
    }

    /** A new PIN / passphrase; the vault key and so the contents stay. The biometric box stays too. */
    @Synchronized
    fun changeSecret(old: CharArray, new: CharArray, kind: SecretKind) {
        if (!verify(old)) throw VaultRefused("A jelenlegi kód nem jó.")
        VaultSecret.problem(String(new), kind)?.let { throw VaultRefused(it) }
        val h = store.header() ?: throw VaultRefused("Nincs széf.")
        val salt = VaultCrypto.random(16)
        val iter = store.iterationsForNew
        store.writeHeader(h.copy(salt = salt, iterations = iter, kind = kind, pinBox = store.pinBox(new, salt, iter, key())))
    }

    /** A copy of the key for the Android side to seal into the biometric box. The caller wipes it. */
    fun keyCopy(): ByteArray = key().copyOf()

    fun setBioBox(box: ByteArray?) { store.header()?.let { store.writeHeader(it.copy(bioBox = box)) } }

    fun setOptions(wipeAtTen: Boolean? = null, lockAfter: Long? = null) {
        val h = store.header() ?: return
        store.writeHeader(h.copy(wipeAtTen = wipeAtTen ?: h.wipeAtTen, lockAfter = lockAfter ?: h.lockAfter))
    }

    /** The whole vault into a backup sealed with [password]. Returns the number of items written. */
    fun export(out: OutputStream, password: CharArray, iterations: Int = VaultStore.DEFAULT_ITERATIONS): Int {
        val idx = index
        VaultBackup.write(out, password, iterations, idx) { id -> readFile(id) }
        return idx.items.size
    }

    /**
     * A backup merged in: its items keep their ids, an id already here is skipped (so importing twice adds nothing).
     * Its top-level items go into [into] (a folder, or the top). Returns how many items were added.
     */
    @Synchronized
    fun import(input: InputStream, password: CharArray, into: String?, now: Long): Int {
        var added = 0
        val written = ArrayList<String>()
        try {
            VaultBackup.read(input, password,
                onIndex = { theirs ->
                    val fresh = theirs.items.filter { index.get(it.id) == null }
                    val freshIds = fresh.map { it.id }.toSet()
                    var next = index
                    // folders first, parents before children, so every add finds its parent
                    val ordered = fresh.sortedBy { depth(theirs, it.id) }
                    for (i in ordered) {
                        val p = if (i.parent == null || i.parent !in freshIds && index.get(i.parent)?.kind != VaultKind.FOLDER) into else i.parent
                        next = next.add(i.copy(parent = p, updated = now))
                        added++
                    }
                    index = next
                    freshIds
                },
                onBlob = { id, bytes -> store.writeBlob(id, VaultCrypto.seal(key(), bytes, "blob:$id")); written.add(id) },
            )
        } catch (e: Exception) {
            written.forEach { store.blob(it).delete() }
            store.indexBox()?.let { index = VaultIndex.parse(String(VaultCrypto.open(key(), it, "index"), Charsets.UTF_8)) }
            throw e
        }
        save(index)
        return added
    }

    private fun depth(idx: VaultIndex, id: String): Int = idx.crumbs(idx.get(id)?.parent).size

    fun close() { VaultCrypto.wipe(vk); vk = null; index = VaultIndex.EMPTY }
}

object VaultFiles {
    /** A file name as kept: no path, no control characters, at most 120 characters. */
    fun safeName(name: String): String =
        name.substringAfterLast('/').substringAfterLast('\\').filter { !it.isISOControl() && it !in "<>:\"|?*" }
            .trim().trimStart('.').take(VaultIndex.MAX_TITLE).ifEmpty { "fajl" }

    fun isImage(mime: String) = mime in setOf("image/jpeg", "image/png", "image/webp", "image/gif")
    fun isText(mime: String, name: String) =
        mime.startsWith("text/") || mime == "application/json" || name.substringAfterLast('.', "").lowercase(Locale.ROOT) in setOf("txt", "md", "csv", "json", "log")

    fun size(b: Long): String = when {
        b < 1024 -> "$b B"
        b < 1024 * 1024 -> "%.1f KB".format(Locale.ROOT, b / 1024.0)
        else -> "%.1f MB".format(Locale.ROOT, b / 1024.0 / 1024.0)
    }

    /** Shown in place of a secret field's value until 👁 is tapped. */
    fun mask(v: String) = if (v.isEmpty()) "" else "•".repeat(v.length.coerceIn(4, 12))
}

/**
 * The backup file (.vrgvault):
 *   "VRGVAULT" 0x0A · int version (1) · int salt length · salt · int iterations
 *   records: UTF name · int length · seal(exportKey, bytes, aad = name)
 *     "index" first, then "blob:<id>" for every file, then "end" (sealed too, so a cut file is caught)
 * Each record is sealed on its own, so a large vault is never held in memory whole.
 */
object VaultBackup {
    private val MAGIC = "VRGVAULT\n".toByteArray(Charsets.US_ASCII)
    const val EXT = "vrgvault"
    const val MIME = "application/octet-stream"

    fun write(out: OutputStream, password: CharArray, iterations: Int, index: VaultIndex, file: (String) -> ByteArray) {
        VaultSecret.problem(String(password), SecretKind.PASS)?.let { throw VaultRefused("A mentés jelszava: $it") }
        val salt = VaultCrypto.random(16)
        val k = VaultCrypto.derive(password, salt, iterations)
        try {
            val d = DataOutputStream(out)
            d.write(MAGIC); d.writeInt(1); d.writeInt(salt.size); d.write(salt); d.writeInt(iterations)
            fun rec(name: String, b: ByteArray) { val box = VaultCrypto.seal(k, b, name); d.writeUTF(name); d.writeInt(box.size); d.write(box) }
            rec("index", index.toJson().toByteArray(Charsets.UTF_8))
            index.items.filter { it.kind == VaultKind.FILE }.forEach { rec("blob:${it.id}", file(it.id)) }
            rec("end", ByteArray(0))
            d.flush()
        } finally { VaultCrypto.wipe(k) }
    }

    /**
     * Reads a backup. [onIndex] gets its index and answers with the file ids it wants; [onBlob] gets each of those.
     * Throws [VaultRefused] for a wrong password, a file that is not a backup, a cut or changed file.
     */
    fun read(input: InputStream, password: CharArray, onIndex: (VaultIndex) -> Set<String>, onBlob: (String, ByteArray) -> Unit) {
        val d = DataInputStream(input)
        try {
            val magic = ByteArray(MAGIC.size).also { d.readFully(it) }
            if (!magic.contentEquals(MAGIC)) throw VaultRefused("Ez nem széf mentés.")
            if (d.readInt() != 1) throw VaultRefused("Ismeretlen mentés-változat.")
            val saltLen = d.readInt()
            if (saltLen !in 16..64) throw VaultRefused("Sérült mentés.")
            val salt = ByteArray(saltLen).also { d.readFully(it) }
            val iter = d.readInt()
            if (iter !in 1..10_000_000) throw VaultRefused("Sérült mentés.")
            val k = VaultCrypto.derive(password, salt, iter)
            try {
                fun rec(): Pair<String, ByteArray> {
                    val name = d.readUTF()
                    val len = d.readInt()
                    if (len < 0 || len > VaultStore.MAX_FILE + 64) throw VaultRefused("Sérült mentés.")
                    val box = ByteArray(len).also { d.readFully(it) }
                    return name to VaultCrypto.open(k, box, name)
                }
                val (first, idxBytes) = try { rec() } catch (e: VaultSealBroken) { throw VaultRefused("Rossz jelszó, vagy sérült mentés.") }
                if (first != "index") throw VaultRefused("Sérült mentés.")
                val idx = VaultIndex.parse(String(idxBytes, Charsets.UTF_8))
                val want = onIndex(idx)
                val files = idx.items.filter { it.kind == VaultKind.FILE }.map { it.id }.toSet()
                while (true) {
                    val (name, bytes) = rec()
                    if (name == "end") break
                    val id = name.removePrefix("blob:")
                    if (!name.startsWith("blob:") || id !in files) throw VaultRefused("Sérült mentés.")
                    if (id in want) onBlob(id, bytes)
                }
            } finally { VaultCrypto.wipe(k) }
        } catch (e: EOFException) {
            throw VaultRefused("A mentés csonka (a vége hiányzik).")
        } catch (e: VaultSealBroken) {
            throw VaultRefused("A mentés sérült vagy megváltozott.")
        }
    }

    /** The file name offered when saving: vrg-szef-2026-11-17.vrgvault */
    fun fileName(date: String) = "vrg-szef-$date.$EXT"
}
