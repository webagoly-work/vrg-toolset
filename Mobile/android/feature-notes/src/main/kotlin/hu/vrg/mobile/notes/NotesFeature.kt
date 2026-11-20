package hu.vrg.mobile.notes

import android.app.Application
import android.content.Context
import androidx.compose.runtime.Composable
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.MiniStatus
import hu.vrg.mobile.core.Note
import hu.vrg.mobile.core.NoteLog
import hu.vrg.mobile.core.NoteSync
import hu.vrg.mobile.core.NoteWriter
import hu.vrg.mobile.core.NotesApi
import hu.vrg.mobile.core.Outbox
import hu.vrg.mobile.core.PutResult
import hu.vrg.mobile.core.Route
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.github.GitHub
import hu.vrg.mobile.kit.github.GitHubNoteHub
import hu.vrg.mobile.kit.github.GitHubNotes
import hu.vrg.mobile.kit.notes.Notes
import hu.vrg.mobile.kit.ui.MiniTrack
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.ZoneId
import java.util.UUID
import java.util.concurrent.TimeUnit

// VRG Jegyzetek (WP M46): the central Notes app. Every note of VRG Mobile is in kit's hub (Notes); this feature is
// its screen (NotesUi.kt) and its sync:
//  - the hub ⇄ the private branch `vrg-notes` (D-56 = B), a few seconds after a change, each time the app comes on
//    screen, and through WorkManager when offline (kit-core NoteSync: one file per note, conflict copies);
//  - the Projektnapló module: a quick note also goes to the M6 day log on `mobile-log` (kit-core Notes.kt), the
//    project's chat log, with the old outbox. On Android 15 a process kept alive behind the lock screen has its
//    network blocked, so WorkManager cannot be the only sender (the M6 lesson): sends also run on screen.

object NotesFeature : VrgFeature {
    override val info = Catalogue.NOTES
    private const val WORK = "vrg-notes-send"

    private lateinit var app: Context
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val zone: ZoneId get() = ZoneId.systemDefault()

    /** The Projektnapló outbox (M6). */
    val outbox = MutableStateFlow(Outbox())
    /** Why the last sync or send stopped; null after a clean run. */
    val problem = MutableStateFlow<String?>(null)
    val lastSync = MutableStateFlow<Long?>(null)
    /** A note pre-filled by a link or a share: the text and its origin id. */
    val draft = MutableStateFlow<Pair<String, String>?>(null)
    /** A note to open (vrg://notes/note?id=…). */
    val openNote = MutableStateFlow<String?>(null)
    private val lock = Mutex()
    private var soon: Job? = null

    override fun init(app: Application) {
        this.app = app
        Notes.init(app)
        Notes.changed = { syncSoon() }
        outbox.value = Outbox.fromJson(prefs().getString("outbox", null))
        if (outbox.value.notes.isNotEmpty() || Notes.all.value.any { it.dirty }) schedule()
    }

    override fun onAppVisible() = sendNow()

    private fun prefs() = app.getSharedPreferences("notes", Context.MODE_PRIVATE)

    private fun save(o: Outbox) {
        outbox.value = o
        prefs().edit().putString("outbox", o.toJson()).apply()
    }

    override fun open(route: Route): Boolean = when (route.path) {
        "", "new" -> {
            route.params["text"]?.let { draft.value = it to (route.params["from"] ?: "gyors") }
            true
        }
        "note" -> { openNote.value = route.params["id"]; true }
        else -> false
    }

    /** A quick note (the Gyorsjegyzet field, a share): into the hub, and into the day log with Projektnapló on. */
    fun quick(text: String, origin: String, tag: String? = null): String? {
        val id = Notes.add(origin, text, tags = listOfNotNull(tag)) ?: return null
        if ("naplo" in Notes.enabled()) {
            save(outbox.value.add(Note(UUID.randomUUID().toString().take(8), System.currentTimeMillis(), text.trim(), tag)))
        }
        sendNow()
        return id
    }

    private fun schedule() {
        // LINEAR: an exponential backoff left a note waiting over an hour after the network came back (M6)
        val req = OneTimeWorkRequestBuilder<SendWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.LINEAR, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(app).enqueueUniqueWork(WORK, ExistingWorkPolicy.KEEP, req)
    }

    /** A change in the hub: one round a few seconds later, so typing does not send every letter. */
    private fun syncSoon() {
        soon?.cancel()
        soon = scope.launch { delay(4_000); sendNow() }
    }

    fun sendNow() {
        if (!::app.isInitialized) return
        if (outbox.value.notes.isEmpty() && Notes.all.value.none { it.dirty } && lastSync.value != null) return
        schedule()
        scope.launch { flush() }
    }

    /** One round of everything. true = done (or nothing to do / no sign-in), false = try again later. */
    suspend fun flush(): Boolean = lock.withLock {
        if (!GitHub.canWrite) {
            problem.value = "Nincs GitHub belépés: a jegyzetek a telefonon vannak, a szinkron vár."
            return true
        }
        val ok = syncHub() && sendLog()
        if (ok) problem.value = null
        ok
    }

    private suspend fun syncHub(): Boolean {
        val start = Notes.all.value
        val busy = start.any { it.dirty }
        if (busy) syncing.run(null)
        return try {
            val r = NoteSync.run(GitHubNoteHub, start, System.currentTimeMillis(), Notes.device)
            Notes.replace { cur -> NoteSync.rebase(start, r.notes, cur) }
            lastSync.value = System.currentTimeMillis()
            if (r.pulled + r.pushed + r.conflicts > 0) VrgLog.i(info.id, "Szinkron: ${r.pushed} fel, ${r.pulled} le, ${r.conflicts} ütközés")
            if (r.problem != null) { problem.value = r.problem; syncing.fail(); false }
            else { if (busy || r.pulled > 0) syncing.done(); true }
        } catch (e: NotesApi.Problem) {
            problem.value = e.message; syncing.fail(); false
        } catch (e: Exception) {
            problem.value = e.message ?: "A szinkron megállt."; syncing.fail(); false
        }
    }

    /** The Projektnapló outbox to `mobile-log`, oldest first (M6's rules). */
    private suspend fun sendLog(): Boolean {
        while (true) {
            val n = outbox.value.next ?: return true
            val r = try { NoteWriter.send(GitHubNotes, n, zone, android.os.Build.MODEL) } catch (e: NotesApi.Problem) {
                problem.value = e.message; return false
            }
            when (r) {
                PutResult.Ok -> { save(outbox.value.sent(n.id)); VrgLog.i(info.id, "Projektnapló: ${NoteLog.path(n.at, zone)}") }
                else -> {
                    problem.value = (r as? PutResult.Failed)?.reason ?: "Ütközés a naplóban, újrapróbálom."
                    return false
                }
            }
        }
    }

    /** The sync's MINI (WP M16): the tile's ring. */
    private val syncing = MiniTrack()
    override val activity: StateFlow<MiniStatus> get() = syncing.status
    val syncStatus: StateFlow<MiniStatus> get() = syncing.status

    @Composable
    override fun Screen(host: FeatureHost) = NotesApp(host)
}

/** WorkManager's side: runs only with a network, retries until the hub and the day log are sent. */
class SendWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result = if (NotesFeature.flush()) Result.success() else Result.retry()
}
