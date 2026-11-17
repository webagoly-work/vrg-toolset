package hu.vrg.mobile.vault

import android.app.Activity
import android.app.Application
import android.content.BroadcastReceiver
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Bundle
import android.os.PersistableBundle
import android.provider.OpenableColumns
import androidx.compose.runtime.Composable
import androidx.core.content.ContextCompat
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.Route
import hu.vrg.mobile.core.SecretKind
import hu.vrg.mobile.core.VaultCrypto
import hu.vrg.mobile.core.VaultFiles
import hu.vrg.mobile.core.VaultIndex
import hu.vrg.mobile.core.VaultItem
import hu.vrg.mobile.core.VaultLock
import hu.vrg.mobile.core.VaultRefused
import hu.vrg.mobile.core.VaultSession
import hu.vrg.mobile.core.VaultStore
import hu.vrg.mobile.core.VaultUnlock
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.files.FileStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

// Széf (WP M24): an encrypted vault on the phone for the things that must not be readable on a lost phone: client data,
// ID papers, documents, folders and files. It opens with a PIN (6+ digits) or a passphrase, and with a fingerprint / face
// once that is turned on. The crypto, the rules and the tests are in kit-core/Vault.kt; the two Keystore keys in VaultKeys.
//
// The vault locks itself: when the screen goes off, when the app has been away for the chosen time (Azonnal, 30 mp,
// 1 perc, 5 perc), and with 🔒. A lock forgets the key, empties cache/vault-out and the clipboard copy. While the Széf is on
// screen the window is FLAG_SECURE: no screenshot, no recording, a blank card in Recents. Nothing leaves the phone except
// a backup the user saves on purpose (.vrgvault, sealed with its own password) or a file opened in another app.

object VaultFeature : VrgFeature {
    override val info = Catalogue.VAULT

    enum class Phase { NONE, LOCKED, OPEN, LOST }

    sealed interface View {
        data object List : View
        class Item(val id: String) : View
        class Edit(val draft: VaultItem, val isNew: Boolean) : View
        data object Settings : View
        /** "Újra azonosítás": [then] opens once the check passes. */
        class Guard(val target: String, val then: View) : View
    }

    private lateinit var app: Application
    internal val store by lazy { VaultStore(File(app.noBackupFilesDir, "vault"), VaultKeys.device) }
    internal val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    val phase = MutableStateFlow(Phase.NONE)
    val index = MutableStateFlow(VaultIndex.EMPTY)
    val folder = MutableStateFlow<String?>(null)
    val view = MutableStateFlow<View>(View.List)
    val busy = MutableStateFlow(false)
    /** Wrong-PIN feedback and the wait, for the lock screen. */
    val lockNote = MutableStateFlow<String?>(null)
    val waitUntil = MutableStateFlow(0L)
    internal val notes = MutableSharedFlow<String>(extraBufferCapacity = 8)

    private var session: VaultSession? = null
    private val passed = HashSet<String>()
    private var started = 0
    private var leftAt = 0L
    private var clipJob: Job? = null
    /** The lock screen asks for the fingerprint once per lock, not on every recomposition. */
    internal var bioAsked = false

    override fun init(app: Application) {
        this.app = app
        phase.value = phaseOnDisk()
        app.registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {
            override fun onActivityStarted(a: Activity) {
                if (started++ == 0 && session != null) {
                    val after = store.header()?.lockAfter ?: VaultLock.DEFAULT_TIMEOUT
                    if (VaultLock.autoLockDue(leftAt, System.currentTimeMillis(), after)) lock("Automatikus zárás")
                }
            }
            override fun onActivityStopped(a: Activity) {
                started = (started - 1).coerceAtLeast(0)
                if (started == 0) leftAt = System.currentTimeMillis()
            }
            override fun onActivityCreated(a: Activity, b: Bundle?) {}
            override fun onActivityResumed(a: Activity) {}
            override fun onActivityPaused(a: Activity) {}
            override fun onActivitySaveInstanceState(a: Activity, b: Bundle) {}
            override fun onActivityDestroyed(a: Activity) {}
        })
        val screenOff = object : BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) { if (session != null) lock("Képernyő kikapcsolva") }
        }
        ContextCompat.registerReceiver(app, screenOff, IntentFilter(Intent.ACTION_SCREEN_OFF), ContextCompat.RECEIVER_NOT_EXPORTED)
        // a decrypted copy left over from a crash or a kill
        outDir().deleteRecursively()
    }

    private fun phaseOnDisk() = if (store.exists()) Phase.LOCKED else Phase.NONE

    override fun open(route: Route): Boolean = true

    @Composable
    override fun Screen(host: FeatureHost) = VaultScreen(host)

    // ---- lock and unlock ----------------------------------------------------------------------------------------

    fun lock(why: String? = null) {
        session?.close()
        session = null
        index.value = VaultIndex.EMPTY
        passed.clear()
        view.value = View.List
        folder.value = null
        bioAsked = false
        outDir().deleteRecursively()
        clearClip(force = false)
        if (phase.value == Phase.OPEN) phase.value = phaseOnDisk()
        if (why != null) VrgLog.i("vault", why)
    }

    internal fun opened(s: VaultSession) {
        session = s
        // a fingerprint key dropped while locked (a new fingerprint enrolled): forget its dead box too
        if (store.header()?.bioBox != null && !keyPresent()) s.setBioBox(null)
        index.value = s.index
        lockNote.value = null
        waitUntil.value = 0L
        phase.value = Phase.OPEN
    }

    fun create(secret: CharArray, kind: SecretKind, done: (String?) -> Unit) {
        busy.value = true
        scope.launch {
            val r = withContext(Dispatchers.Default) {
                runCatching { store.create(secret, kind, System.currentTimeMillis()) }.also { VaultCrypto.wipe(secret) }
            }
            busy.value = false
            r.onSuccess { opened(it); done(null) }.onFailure { done(it.message ?: "Nem sikerült.") }
        }
    }

    fun unlock(secret: CharArray) {
        if (busy.value) return
        busy.value = true
        scope.launch {
            val now = System.currentTimeMillis()
            val r = withContext(Dispatchers.Default) {
                try { store.unlock(secret, now) } catch (e: Exception) { null } finally { VaultCrypto.wipe(secret) }
            }
            busy.value = false
            when (r) {
                is VaultUnlock.Open -> opened(r.session)
                is VaultUnlock.Wrong -> {
                    waitUntil.value = r.waitUntil
                    lockNote.value = "Hibás kód (${r.failures}. egymás után)." + (r.wipeIn?.let { " Még $it próba a törlésig." } ?: "")
                }
                is VaultUnlock.Wait -> { waitUntil.value = r.until; lockNote.value = "Túl sok hibás próba: várj." }
                VaultUnlock.Wiped -> { VaultKeys.dropAll(); phase.value = Phase.NONE; notes.tryEmit("10 hibás próba: a Széf törlődött.") }
                VaultUnlock.KeyLost -> phase.value = Phase.LOST
                VaultUnlock.Missing -> phase.value = Phase.NONE
                null -> lockNote.value = "A Széf nem olvasható (sérült fájl)."
            }
        }
    }

    fun unlockBio(ctx: Context) {
        val box = store.header()?.bioBox ?: return
        VaultKeys.open(ctx, box) { r ->
            when (r) {
                is VaultKeys.BioResult.Ok -> {
                    val s = store.unlockWithKey(r.bytes)
                    VaultCrypto.wipe(r.bytes)
                    if (s != null) opened(s) else lockNote.value = "Az ujjlenyomat kulcs már nem jó: nyisd PIN-kóddal."
                }
                VaultKeys.BioResult.Invalidated -> {
                    lockNote.value = "Új ujjlenyomatot rögzítettek a telefonon, ezért a Széf most csak PIN-kóddal nyílik. Utána a Beállításokban újra bekapcsolható."
                    turnOffBioOnDisk()
                }
                VaultKeys.BioResult.Cancelled -> {}
                is VaultKeys.BioResult.Failed -> lockNote.value = r.why
            }
        }
    }

    private fun turnOffBioOnDisk() {
        // the header is written by a session; with none open, a short one would need the key, so only drop the Keystore key:
        // an unopenable bio box is then just ignored by bioOn()
        VaultKeys.dropBio()
    }

    fun bioOn(): Boolean = store.header()?.bioBox != null && VaultKeys.bioProblem(app) == null && keyPresent()

    private fun keyPresent() = runCatching {
        java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.containsAlias("vrg-vault-bio")
    }.getOrDefault(false)

    fun enrollBio(ctx: Context) {
        val s = session ?: return
        val vk = s.keyCopy()
        VaultKeys.enroll(ctx, vk) { r ->
            VaultCrypto.wipe(vk)
            when (r) {
                is VaultKeys.BioResult.Ok -> { s.setBioBox(r.bytes); notes.tryEmit("Ujjlenyomat bekapcsolva.") }
                is VaultKeys.BioResult.Failed -> notes.tryEmit(r.why)
                else -> {}
            }
        }
    }

    fun disableBio() { session?.setBioBox(null); VaultKeys.dropBio(); notes.tryEmit("Ujjlenyomat kikapcsolva.") }

    /** A vault whose device key is gone (factory reset): start again, a backup brings the contents back. */
    fun startOver() { store.destroy(); VaultKeys.dropAll(); lock(); phase.value = Phase.NONE }

    fun destroy(secret: CharArray): Boolean {
        val s = session ?: return false
        val ok = s.verify(secret)
        VaultCrypto.wipe(secret)
        if (!ok) return false
        lock(); store.destroy(); VaultKeys.dropAll(); phase.value = Phase.NONE
        notes.tryEmit("A Széf törölve.")
        return true
    }

    internal fun session(): VaultSession? = session

    // ---- the contents ---------------------------------------------------------------------------------------------

    /** Runs a change on the session and refreshes the list; a refusal becomes a note. */
    internal fun change(block: (VaultSession) -> Unit): Boolean {
        val s = session ?: return false
        return try { block(s); index.value = s.index; true } catch (e: VaultRefused) { notes.tryEmit(e.message ?: "Nem sikerült."); false }
        catch (e: Exception) { notes.tryEmit("Hiba: ${e.message ?: e.javaClass.simpleName}"); false }
    }

    fun save(item: VaultItem, isNew: Boolean) = change { s ->
        val now = System.currentTimeMillis()
        val i = item.copy(updated = now)
        s.save(if (isNew) s.index.add(i) else s.index.update(i))
    }

    fun remove(id: String) = change { it.remove(id) }

    fun move(id: String, to: String?) = change { s -> s.save(s.index.move(id, to)) }

    /** Ids of the guarded items from [id] up; all of them must have passed this session. */
    private fun guards(id: String?): List<String> {
        val idx = index.value
        val out = ArrayList<String>()
        var cur = idx.get(id)
        val seen = HashSet<String>()
        while (cur != null && seen.add(cur.id)) { if (cur.guard) out.add(cur.id); cur = idx.get(cur.parent) }
        return out
    }

    /** Opens [then] for [id], through the guard screen when it or a folder above it asks for it. */
    fun go(id: String?, then: View) {
        val need = guards(id).filter { it !in passed }
        view.value = if (id != null && need.isNotEmpty()) View.Guard(id, then) else then
    }

    fun enter(folderId: String?) {
        if (folderId == null) { folder.value = null; view.value = View.List; return }
        val need = guards(folderId).filter { it !in passed }
        if (need.isEmpty()) { folder.value = folderId; view.value = View.List } else view.value = View.Guard(folderId, View.List)
    }

    fun guardPassed(g: View.Guard) {
        passed.addAll(guards(g.target))
        val t = index.value.get(g.target)
        if (g.then is View.List && t?.kind == hu.vrg.mobile.core.VaultKind.FOLDER) folder.value = g.target
        view.value = g.then
    }

    // ---- files ------------------------------------------------------------------------------------------------------

    internal fun outDir() = File(app.cacheDir, "vault-out")

    fun displayName(ctx: Context, uri: Uri): String? = runCatching {
        ctx.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) c.getString(0) else null
        }
    }.getOrNull()

    /** A picked file into the vault, in the folder on screen. */
    fun importUri(ctx: Context, uri: Uri) {
        val parent = folder.value
        busy.value = true
        scope.launch {
            val r = withContext(Dispatchers.IO) {
                runCatching {
                    val size = ctx.contentResolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { c ->
                        if (c.moveToFirst() && !c.isNull(0)) c.getLong(0) else -1L
                    } ?: -1L
                    if (size > VaultStore.MAX_FILE) throw VaultRefused("Túl nagy fájl (legfeljebb ${VaultStore.MAX_FILE / 1024 / 1024} MB).")
                    val bytes = ctx.contentResolver.openInputStream(uri)?.use { input ->
                        val out = java.io.ByteArrayOutputStream()
                        val buf = ByteArray(64 * 1024)
                        var total = 0L
                        while (true) {
                            val n = input.read(buf)
                            if (n < 0) break
                            total += n
                            if (total > VaultStore.MAX_FILE) throw VaultRefused("Túl nagy fájl (legfeljebb ${VaultStore.MAX_FILE / 1024 / 1024} MB).")
                            out.write(buf, 0, n)
                        }
                        out.toByteArray()
                    } ?: throw VaultRefused("A fájl nem olvasható.")
                    val name = displayName(ctx, uri) ?: uri.lastPathSegment ?: "fajl"
                    val mime = ctx.contentResolver.getType(uri) ?: "application/octet-stream"
                    val s = session ?: throw VaultRefused("A Széf zárva van.")
                    val item = s.putFile(name, mime, bytes, parent, System.currentTimeMillis())
                    bytes.fill(0)
                    item
                }
            }
            busy.value = false
            r.onSuccess { index.value = session?.index ?: index.value; notes.tryEmit("A Széfben: ${it.title}. Az eredeti a helyén maradt; töröld, ha már nem kell.") }
                .onFailure { notes.tryEmit(it.message ?: "Nem sikerült.") }
        }
    }

    /** The camera's photo (written to cache/vault-out) sealed into the vault, then the plain file deleted. */
    fun importPhoto(f: File) {
        val parent = folder.value
        busy.value = true
        scope.launch {
            val r = withContext(Dispatchers.IO) {
                runCatching {
                    val bytes = f.readBytes()
                    val s = session ?: throw VaultRefused("A Széf zárva van.")
                    s.putFile(f.name, "image/jpeg", bytes, parent, System.currentTimeMillis()).also { bytes.fill(0) }
                }.also { f.delete() }
            }
            busy.value = false
            r.onSuccess { index.value = session?.index ?: index.value; notes.tryEmit("Fotó a Széfben: ${it.title}") }
                .onFailure { notes.tryEmit(it.message ?: "Nem sikerült.") }
        }
    }

    suspend fun read(id: String): ByteArray? = withContext(Dispatchers.IO) { runCatching { session?.readFile(id) }.getOrNull() }

    /** "Megnyitás másik appban": a decrypted copy in cache/vault-out until the next lock. */
    fun openElsewhere(ctx: Context, item: VaultItem) {
        val f = item.file ?: return
        scope.launch {
            val bytes = read(item.id) ?: run { notes.tryEmit("A fájl nem nyílik."); return@launch }
            val out = withContext(Dispatchers.IO) {
                File(File(outDir(), item.id).apply { mkdirs() }, VaultFiles.safeName(f.name)).apply { writeBytes(bytes) }
            }
            bytes.fill(0)
            try {
                ctx.startActivity(Intent.createChooser(
                    Intent(Intent.ACTION_VIEW).setDataAndType(FileStore.uri(ctx, out), f.mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),
                    "Megnyitás",
                ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                notes.tryEmit("A másolat a Széf zárásáig marad meg.")
            } catch (e: Exception) { notes.tryEmit("Nincs alkalmazás ehhez a fájlhoz.") }
        }
    }

    /** "Mentés a telefonra": a plain copy where the user chose (CreateDocument). */
    fun saveOut(ctx: Context, item: VaultItem, to: Uri) {
        scope.launch {
            val bytes = read(item.id) ?: run { notes.tryEmit("A fájl nem nyílik."); return@launch }
            val ok = withContext(Dispatchers.IO) { runCatching { ctx.contentResolver.openOutputStream(to)?.use { it.write(bytes) } != null }.getOrDefault(false) }
            bytes.fill(0)
            notes.tryEmit(if (ok) "Elmentve, titkosítás nélkül." else "Nem sikerült menteni.")
        }
    }

    // ---- backup -----------------------------------------------------------------------------------------------------

    fun backup(ctx: Context, to: Uri, password: CharArray) {
        val s = session ?: return
        busy.value = true
        scope.launch {
            val r = withContext(Dispatchers.IO) {
                runCatching { ctx.contentResolver.openOutputStream(to)?.use { s.export(it, password) } ?: throw VaultRefused("A fájl nem írható.") }
                    .also { VaultCrypto.wipe(password) }
            }
            busy.value = false
            r.onSuccess { notes.tryEmit("Mentés kész: $it elem. Tedd biztos helyre, és jegyezd meg a jelszavát.") }
                .onFailure { notes.tryEmit(it.message ?: "Nem sikerült.") }
        }
    }

    fun restore(ctx: Context, from: Uri, password: CharArray) {
        val s = session ?: return
        val into = folder.value
        busy.value = true
        scope.launch {
            val r = withContext(Dispatchers.IO) {
                runCatching { ctx.contentResolver.openInputStream(from)?.use { s.import(it, password, into, System.currentTimeMillis()) } ?: throw VaultRefused("A fájl nem olvasható.") }
                    .also { VaultCrypto.wipe(password) }
            }
            busy.value = false
            r.onSuccess { index.value = s.index; notes.tryEmit(if (it == 0) "Nincs új elem (már mind itt van)." else "Visszaállítva: $it elem.") }
                .onFailure { notes.tryEmit(it.message ?: "Nem sikerült.") }
        }
    }

    // ---- clipboard --------------------------------------------------------------------------------------------------

    private const val CLIP_LABEL = "VRG Széf"

    fun copy(ctx: Context, value: String) {
        val cm = ctx.getSystemService(ClipboardManager::class.java) ?: return
        val clip = ClipData.newPlainText(CLIP_LABEL, value)
        // Android 13+ hides a sensitive clip's preview; older versions ignore the extra
        clip.description.extras = PersistableBundle().apply { putBoolean("android.content.extra.IS_SENSITIVE", true) }
        cm.setPrimaryClip(clip)
        clipJob?.cancel()
        clipJob = scope.launch { delay(VaultLock.CLIPBOARD_MS); clearClip(force = false) }
        notes.tryEmit("Vágólapra másolva; ${VaultLock.CLIPBOARD_MS / 1000} mp múlva törlődik.")
    }

    private fun clearClip(force: Boolean) {
        val cm = app.getSystemService(ClipboardManager::class.java) ?: return
        runCatching { if (force || cm.primaryClipDescription?.label == CLIP_LABEL) cm.clearPrimaryClip() }
    }
}
