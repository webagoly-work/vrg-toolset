package hu.vrg.mobile.notes

import android.app.Application
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.speech.RecognizerIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.Note
import hu.vrg.mobile.core.NoteFile
import hu.vrg.mobile.core.NoteLog
import hu.vrg.mobile.core.NoteWriter
import hu.vrg.mobile.core.NotesApi
import hu.vrg.mobile.core.Outbox
import hu.vrg.mobile.core.PutResult
import hu.vrg.mobile.core.Route
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.github.Account
import hu.vrg.mobile.kit.github.GitHub
import hu.vrg.mobile.kit.github.GitHubNotes
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.ui.VrgSectionTitle
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.ZoneId
import java.util.UUID
import java.util.concurrent.TimeUnit

// Gyorsjegyzet (WP M6, D-6 = A): type, dictate or share a note and it lands in log/<today>.md on the
// `mobile-log` branch, the project's chat log. A note goes into the outbox first (kept on the phone),
// and is sent, oldest first, right away and again each time the app comes on screen. WorkManager is the
// fallback for offline notes. It cannot be the only sender: on Android 15 a process kept alive behind
// the lock screen has its network blocked (APP_BACKGROUND), yet WorkManager still runs the worker in
// it, so every try fails at once. The rules (the line, the append with retry, the order) are kit-core's Notes.kt.

object NotesFeature : VrgFeature {
    override val info = Catalogue.NOTES
    private const val WORK = "vrg-notes-send"

    private lateinit var app: Context
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val zone: ZoneId get() = ZoneId.systemDefault()

    val outbox = MutableStateFlow(Outbox())
    /** Why the last send stopped, shown under the outbox; null after a clean run. */
    val problem = MutableStateFlow<String?>(null)
    /** A note pre-filled by a link or a share (vrg://notes/new?text=…). */
    val draft = MutableStateFlow("")
    private val lock = Mutex()

    override fun init(app: Application) {
        this.app = app
        outbox.value = Outbox.fromJson(prefs().getString("outbox", null))
        if (outbox.value.notes.isNotEmpty()) schedule()
    }

    override fun onAppVisible() = sendNow()

    private fun prefs() = app.getSharedPreferences("notes", Context.MODE_PRIVATE)

    private fun save(o: Outbox) {
        outbox.value = o
        prefs().edit().putString("outbox", o.toJson()).apply()
    }

    override fun open(route: Route): Boolean {
        route.params["text"]?.let { draft.value = it }
        return route.path.isEmpty() || route.path == "new"
    }

    fun submit(text: String, tag: String?) {
        if (text.isBlank()) return
        save(outbox.value.add(Note(UUID.randomUUID().toString().take(8), System.currentTimeMillis(), text.trim(), tag)))
        sendNow()
    }

    private fun schedule() {
        // LINEAR: an exponential backoff left a note waiting over an hour after the network came back
        val req = OneTimeWorkRequestBuilder<SendWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.LINEAR, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(app).enqueueUniqueWork(WORK, ExistingWorkPolicy.KEEP, req)
    }

    /** One try now, not behind a waiting retry (KEEP leaves that one as it is); the worker stays as the fallback. */
    private fun sendNow() {
        if (outbox.value.notes.isEmpty()) return
        schedule()
        scope.launch { flush() }
    }

    /** Sends the outbox, oldest first. true = done (or nothing to do), false = try again later. */
    suspend fun flush(): Boolean = lock.withLock {
        if (!GitHub.signedIn) { problem.value = "Nincs GitHub belépés: a jegyzetek a telefonon várnak."; return true }
        while (true) {
            val n = outbox.value.next ?: break
            val r = try { NoteWriter.send(GitHubNotes, n, zone) } catch (e: NotesApi.Problem) {
                problem.value = e.message
                return false
            }
            when (r) {
                PutResult.Ok -> { save(outbox.value.sent(n.id)); VrgLog.i(info.id, "Jegyzet elküldve: ${NoteLog.path(n.at, zone)}") }
                else -> {
                    problem.value = (r as? PutResult.Failed)?.reason ?: "Ütközés, újrapróbálom."
                    VrgLog.w(info.id, "Jegyzet nem ment el: ${problem.value}")
                    return false
                }
            }
        }
        problem.value = null
        true
    }

    /** Today's file read back, as lines. */
    suspend fun today(): Result<List<String>> = try {
        val f = GitHubNotes.read(NoteLog.path(System.currentTimeMillis(), zone), NoteLog.BRANCH)
        Result.success(f?.let { NoteFile.read(it.text) } ?: emptyList())
    } catch (e: NotesApi.Problem) { Result.failure(e) }

    @OptIn(ExperimentalLayoutApi::class)
    @Composable
    override fun Screen(host: FeatureHost) {
        val box by outbox.collectAsStateWithLifecycle()
        val why by problem.collectAsStateWithLifecycle()
        val pre by draft.collectAsStateWithLifecycle()
        val account by GitHub.account.collectAsStateWithLifecycle()
        val scope = rememberCoroutineScope()
        var text by remember { mutableStateOf(pre) }
        var tag by remember { mutableStateOf<String?>(null) }
        var log by remember { mutableStateOf<List<String>?>(null) }
        var logNote by remember { mutableStateOf<String?>(null) }
        LaunchedEffect(pre) { if (pre.isNotEmpty()) { text = pre; draft.value = "" } }

        val dictate = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
            val said = r.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()
            if (!said.isNullOrBlank()) text = if (text.isBlank()) said else "$text $said"
        }
        val reload: () -> Unit = {
            scope.launch {
                logNote = "Betöltés…"
                today().onSuccess { log = it; logNote = null }.onFailure { logNote = it.message }
            }
        }
        LaunchedEffect(account) { if (account is Account.SignedIn) reload() }

        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
            Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current),
                modifier = Modifier.clickable { host.home() }.padding(vertical = 8.dp))
            Text("GYORSJEGYZET", style = Melyviz.title.copy(fontSize = 18.sp))
            Text("A ${NoteLog.BRANCH} branch napi fájljába kerül (log/ÉÉÉÉ-HH-NN.md).", style = Melyviz.small)
            Spacer(Modifier.height(10.dp))

            if (account !is Account.SignedIn) {
                Text("Nincs GitHub belépés. Írni lehet, a jegyzet a telefonon vár, amíg be nem lépsz.",
                    style = Melyviz.small.copy(color = Melyviz.sand))
                Row(Modifier.padding(vertical = 6.dp)) { VrgChip("GitHub fiók ›") { host.open(Catalogue.ACCOUNT.id) } }
            }

            OutlinedTextField(
                value = text, onValueChange = { text = it },
                modifier = Modifier.fillMaxWidth().heightIn(min = 120.dp),
                placeholder = { Text("Mi jutott eszedbe?", style = Melyviz.small) },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Melyviz.glow, unfocusedBorderColor = Melyviz.line,
                    focusedTextColor = Melyviz.ink, unfocusedTextColor = Melyviz.ink, cursorColor = Melyviz.glow,
                ),
            )
            FlowRow(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                NoteLog.TAGS.forEach { t -> VrgChip(t, tag == t) { tag = if (tag == t) null else t } }
            }
            Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                VrgChip("Küldés", true) {
                    if (text.isNotBlank()) { submit(text, tag); text = ""; host.note("A jegyzet a kimenőben, küldöm.") }
                }
                VrgChip("🎤 Diktálás") {
                    val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                        .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                        .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "hu-HU")
                        .putExtra(RecognizerIntent.EXTRA_PROMPT, "Mondd a jegyzetet")
                    try { dictate.launch(i) } catch (e: ActivityNotFoundException) { host.note("Nincs beszédfelismerő ezen a telefonon.") }
                }
            }

            if (box.notes.isNotEmpty() || why != null) {
                VrgSectionTitle("Kimenő · ${box.notes.size}")
                box.notes.forEach { n -> Text("· " + (n.tag?.let { "[$it] " } ?: "") + n.text.take(80), style = Melyviz.small) }
                why?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 4.dp)) }
                if (box.notes.isNotEmpty()) Row(Modifier.padding(top = 6.dp)) { VrgChip("Küldés most") { sendNow() } }
            }

            VrgSectionTitle("Ma · ${NoteLog.day(System.currentTimeMillis(), zone)}")
            logNote?.let { Text(it, style = Melyviz.small) }
            log?.let { lines ->
                if (lines.isEmpty() && logNote == null) Text("Ma még nincs jegyzet.", style = Melyviz.small)
                lines.forEach { Text(it, style = Melyviz.readout.copy(fontSize = 11.sp), modifier = Modifier.padding(vertical = 2.dp)) }
            }
            Row(Modifier.padding(top = 6.dp)) { VrgChip("Frissítés") { reload() } }
            Spacer(Modifier.height(24.dp))
        }
    }
}

/** WorkManager's side: runs only with a network, retries with backoff until the outbox is empty. */
class SendWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result = if (NotesFeature.flush()) Result.success() else Result.retry()
}
