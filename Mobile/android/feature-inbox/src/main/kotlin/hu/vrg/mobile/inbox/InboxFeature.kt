package hu.vrg.mobile.inbox

import android.Manifest
import android.app.Application
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.InboxEvent
import hu.vrg.mobile.core.InboxGitHub
import hu.vrg.mobile.core.InboxKind
import hu.vrg.mobile.core.InboxLevel
import hu.vrg.mobile.core.InboxPoll
import hu.vrg.mobile.core.InboxRelay
import hu.vrg.mobile.core.InboxSources
import hu.vrg.mobile.core.InboxState
import hu.vrg.mobile.core.MiniStatus
import hu.vrg.mobile.core.Route
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.VrgNotify
import hu.vrg.mobile.kit.github.Gh
import hu.vrg.mobile.kit.github.GitHub
import hu.vrg.mobile.kit.github.problem
import hu.vrg.mobile.kit.relay.Relay
import hu.vrg.mobile.kit.relay.Trust
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.MiniTrack
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.ui.VrgSectionTitle
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.File
import java.text.SimpleDateFormat
import java.time.LocalDate
import java.time.ZoneId
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

// Értesítések (WP M10, D-11 = C): what happened, in one list grouped by day, with phone notifications for
// what matters. GitHub is polled every 15 minutes by WorkManager (and once whenever the app comes on
// screen): the repo's notification threads, the Actions runs, the latest release and the mobile-log
// branch, every request conditional (kit GitHub.poll), so a quiet repo costs nothing. While the trusted
// relay link is up, its events come in live. A tap opens the GitHub page or the feature and marks the event
// read, on GitHub too for a thread (PATCH /notifications/threads/{id}). The rules are kit-core's Inbox.kt.
//
// D-11 B (a push service) is a later WP: its receiver would call [take] with InboxSource.PUSH events of the
// same ids, and the poller stays as the fallback.

object InboxFeature : VrgFeature {
    override val info = Catalogue.INBOX
    private const val TAG = "inbox"
    private const val WORK = "vrg-inbox-poll"

    private lateinit var app: Context
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val pollLock = Mutex()
    private val stateLock = Any()
    private val _state = MutableStateFlow(InboxState())
    val state: StateFlow<InboxState> = _state
    /** Why the last poll stopped, shown under the header; null after a clean one. */
    val problem = MutableStateFlow<String?>(null)
    /** An event a notification's tap asked for; the screen opens it. */
    private val pendingOpen = MutableStateFlow<String?>(null)
    /** The list is on screen: no phone notification for what the user is looking at. */
    @Volatile private var onScreen = false
    private val track = MiniTrack()
    override val activity: StateFlow<MiniStatus> get() = track.status

    private val file get() = File(app.filesDir, "inbox.json")

    override fun init(app: Application) {
        this.app = app
        _state.value = InboxState.fromJson(try { file.takeIf { it.exists() }?.readText() } catch (e: Exception) { null })
        VrgNotify.ensureChannels(app)
        Relay.addCaps(listOf(InboxRelay.CAP))
        scope.launch { Relay.incoming.collect(::onRelay) }
        scope.launch {
            var linked: String? = null      // the PC the trusted line is up to
            Relay.trust.collect { t ->
                val pc = Relay.pc.value
                val now = System.currentTimeMillis()
                if (t == Trust.TRUSTED && pc != null) {
                    val back = InboxRelay.back(pc.id, pc.name, _state.value.pcSeen[pc.id], now)
                    update { it.seenPc(pc.id, now) }
                    linked = pc.id
                    if (back != null) take(listOf(back), InboxSources.RELAY)
                    Relay.send(InboxRelay.list(_state.value.relayAfter))   // what the PC said while we were away
                } else {
                    // the line dropped: "away" counts from now, not from when it came up
                    linked?.let { id -> update { s -> s.seenPc(id, now) } }
                    linked = null
                }
            }
        }
        if (GitHub.signedIn) schedule()
    }

    override fun onAppVisible() {
        if (!GitHub.signedIn) return
        schedule()
        if (InboxPoll.dueOnOpen(_state.value, System.currentTimeMillis())) scope.launch { poll(manual = false) }
    }

    override fun onForeground(on: Boolean) { onScreen = on }

    override fun open(route: Route): Boolean {
        if (route.path.isEmpty()) return true
        if (route.path != "open") return false
        route.params["id"]?.let { pendingOpen.value = it }
        return true
    }

    // ---- the state -------------------------------------------------------------------------------

    private fun update(f: (InboxState) -> InboxState) {
        val json = synchronized(stateLock) {
            val n = f(_state.value)
            if (n == _state.value) return
            _state.value = n
            n.toJson()
        }
        try { file.writeText(json) } catch (e: Exception) { VrgLog.w(TAG, "Nem menthető: ${e.message}") }
    }

    /** Takes events in from any source (the poller, the relay, later a push) and posts what rings. */
    fun take(events: List<InboxEvent>, source: String) {
        var post = emptyList<InboxEvent>()
        update { s -> s.ingest(events, source).also { post = it.second }.first }
        if (!onScreen) post.forEach { VrgNotify.post(app, it) }
        if (post.isNotEmpty()) VrgLog.i(TAG, "${post.size} új értesítés (${source})")
    }

    private fun onRelay(raw: String) {
        val pc = Relay.pc.value
        val ev = InboxRelay.parse(raw, pc?.id, pc?.name)
        if (ev.isNotEmpty()) take(ev, InboxSources.RELAY)
    }

    fun markRead(e: InboxEvent) {
        update { it.markRead(e.id) }
        VrgNotify.cancel(app, e.id)
        val t = e.thread ?: return
        scope.launch { GitHub.send("PATCH", "/notifications/threads/$t", "{}") }
    }

    fun markAllRead(kind: InboxKind?) {
        val threads = _state.value.unreadThreads(kind)
        val ids = _state.value.events.filter { !it.read && (kind == null || it.kind == kind) }.map { it.id }
        update { it.markAllRead(kind) }
        ids.forEach { VrgNotify.cancel(app, it) }
        scope.launch { threads.forEach { GitHub.send("PATCH", "/notifications/threads/$it", "{}") } }
    }

    // ---- the poller ------------------------------------------------------------------------------

    private fun schedule() {
        val req = PeriodicWorkRequestBuilder<InboxWorker>(InboxPoll.PERIOD_MIN, TimeUnit.MINUTES)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(app).enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP, req)
    }

    private val installed: Long get() = try {
        @Suppress("DEPRECATION") app.packageManager.getPackageInfo(app.packageName, 0).longVersionCode
    } catch (e: Exception) { Long.MAX_VALUE }

    /** One round over the sources. False when it had to stop (offline, signed out, rate limited). */
    suspend fun poll(manual: Boolean): Boolean = pollLock.withLock {
        if (!GitHub.signedIn) return@withLock true
        val now = System.currentTimeMillis()
        if (!InboxPoll.due(_state.value, now, manual)) {
            if (manual) problem.value = "Még korai: a GitHub legfeljebb ${maxOf(InboxPoll.MIN_GAP_S, _state.value.pollEvery)} másodpercenként kérdezhető."
            return@withLock true
        }
        track.run()
        var interval: Long? = null
        // Threads need a token (notifications scope); the repo-name access reads only the public rest
        val sources = buildList {
            if (GitHub.canWrite) add(InboxSources.THREADS to InboxGitHub.NOTIFICATIONS)
            add(InboxSources.RUNS to InboxGitHub.RUNS)
            add(InboxSources.RELEASE to InboxGitHub.RELEASE)
            add(InboxSources.NOTES to InboxGitHub.NOTE_COMMITS)
        }
        for ((source, path) in sources) {
            when (val r = GitHub.poll(path)) {
                is Gh.Ok -> {
                    val p = r.value
                    if (source == InboxSources.THREADS) interval = InboxPoll.pollInterval(p.headers)
                    if (!p.fresh && source in _state.value.baselined) continue    // 304: nothing new
                    when (source) {
                        InboxSources.THREADS -> {
                            take(InboxGitHub.threads(p.body), source)
                            val unread = InboxGitHub.threadIds(p.body)
                            update { it.syncThreads(unread) }
                        }
                        InboxSources.RUNS -> {
                            var events = emptyList<InboxEvent>()
                            update { s -> InboxGitHub.runs(p.body, s.ci).let { (ev, ci) -> events = ev; s.copy(ci = ci) } }
                            take(events, source)
                        }
                        InboxSources.RELEASE -> take(listOfNotNull(InboxGitHub.release(p.body, installed)), source)
                        InboxSources.NOTES -> take(InboxGitHub.noteCommits(p.body, Build.MODEL ?: ""), source)
                    }
                }
                is Gh.Failed -> {
                    val wait = InboxPoll.limitedFor(r.code, GitHub.lastHeaders, r.message, now / 1000, _state.value.failures)
                    if (wait != null) {
                        update { it.limited(now, wait) }
                        problem.value = "A GitHub korlátozza a kéréseket: ${wait / 60 + 1} perc szünet."
                        VrgLog.w(TAG, "Rate limit ($source, ${r.code}): $wait s szünet")
                        track.fail()
                        return@withLock false
                    }
                    // 404: no release yet, no mobile-log yet; the other sources go on
                    if (r.code != 404) VrgLog.w(TAG, "$source: ${r.problem()}")
                }
                else -> {
                    problem.value = r.problem()
                    track.fail()
                    return@withLock false
                }
            }
        }
        update { it.polled(now, interval) }
        problem.value = null
        track.done()
        true
    }

    private fun openEvent(ctx: Context, host: FeatureHost, e: InboxEvent) {
        markRead(e)
        val f = e.feature
        val u = e.url
        when {
            f != null -> host.open(f)
            u != null -> {
                val uri = Uri.parse(u)
                try { CustomTabsIntent.Builder().build().launchUrl(ctx, uri) }
                catch (x: Exception) { runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } }
            }
        }
    }

    // ---- the screen ------------------------------------------------------------------------------

    @OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
    @Composable
    override fun Screen(host: FeatureHost) {
        val s by state.collectAsStateWithLifecycle()
        val why by problem.collectAsStateWithLifecycle()
        val busy by track.status.collectAsStateWithLifecycle()
        val asked by pendingOpen.collectAsStateWithLifecycle()
        val ctx = LocalContext.current
        var filter by remember { mutableStateOf<InboxKind?>(null) }
        // Android's own answer is read again after the permission dialog or a trip to its settings
        var permTick by remember { mutableIntStateOf(0) }
        val allowed = remember(permTick) { VrgNotify.allowed(ctx) }
        val needsPerm = remember(permTick) { VrgNotify.needsPermission(ctx) }
        val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { permTick++ }

        LaunchedEffect(asked) {
            val id = asked ?: return@LaunchedEffect
            pendingOpen.value = null
            state.value.byId(id)?.let { openEvent(ctx, host, it) }
        }
        LaunchedEffect(Unit) { permTick++ }

        PullToRefreshBox(isRefreshing = busy.busy && busy.state == hu.vrg.mobile.core.MiniState.RUNNING,
            onRefresh = { scope.launch { poll(manual = true) } }, modifier = Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
                Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current),
                    modifier = Modifier.clickable { host.home() }.padding(vertical = 8.dp))
                Text("ÉRTESÍTÉSEK", style = Melyviz.title.copy(fontSize = 18.sp))
                Text(status(s), style = Melyviz.readout)
                why?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 4.dp)) }

                if (!GitHub.signedIn) {
                    Text("GitHub belépés kell a CI, PR és frissítés eseményekhez. A relé eseményei enélkül is jönnek.",
                        style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 8.dp))
                    Row(Modifier.padding(vertical = 6.dp)) { VrgChip("GitHub fiók ›") { host.open(Catalogue.ACCOUNT.id) } }
                } else if (!GitHub.canWrite) {
                    Text("Repó névvel belépve: a GitHub értesítések (PR, review) tokent kérnek, a CI és a frissítés így is megy.",
                        style = Melyviz.small, modifier = Modifier.padding(top = 4.dp))
                }

                if (!allowed) PermissionCard(needsPerm,
                    onAsk = { if (Build.VERSION.SDK_INT >= 33) ask.launch(Manifest.permission.POST_NOTIFICATIONS) },
                    onSettings = { runCatching { ctx.startActivity(VrgNotify.settingsIntent(ctx, null)) } })

                Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    VrgChip("⟳ Most", status = busy) { scope.launch { poll(manual = true) } }
                    if (s.unread > 0) VrgChip("✓ Mind olvasott") { markAllRead(filter) }
                }
                FlowRow(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    VrgChip("Mind" + count(s, null), selected = filter == null) { filter = null }
                    InboxKind.entries.forEach { k -> VrgChip(k.label + count(s, k), selected = filter == k) { filter = if (filter == k) null else k } }
                }

                val days = s.days(filter, ZoneId.systemDefault())
                if (days.isEmpty()) Text(
                    if (s.baselined.isEmpty()) "Még nem volt lekérdezés. Húzd le, vagy várj a következőre (15 percenként)." else "Nincs esemény ebben a nézetben.",
                    style = Melyviz.small, modifier = Modifier.padding(top = 14.dp),
                )
                days.forEach { (day, events) ->
                    VrgSectionTitle(dayLabel(day))
                    events.forEach { e -> EventRow(e) { openEvent(ctx, host, e) } }
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }

    @Composable
    private fun PermissionCard(canAsk: Boolean, onAsk: () -> Unit, onSettings: () -> Unit) {
        Column(Modifier.fillMaxWidth().padding(top = 10.dp).clip(RoundedCornerShape(12.dp)).background(Melyviz.surface).padding(10.dp)) {
            Text("A telefonos értesítések ki vannak kapcsolva", style = Melyviz.label)
            Text("A lista így is frissül; értesítés csak engedéllyel jön (CI hiba, review kérés, új verzió, PC-s fájl).", style = Melyviz.small)
            Row(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (canAsk) VrgChip("Engedélyezés") { onAsk() }
                VrgChip("Android beállítások ›") { onSettings() }
            }
        }
    }

    @Composable
    private fun EventRow(e: InboxEvent, onTap: () -> Unit) {
        val mark = when (e.level) { InboxLevel.BAD -> Melyviz.coral; InboxLevel.GOOD -> Melyviz.kelp; InboxLevel.INFO -> Melyviz.glow }
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).clickable(onClick = onTap)
                .semantics { contentDescription = listOfNotNull(e.kind.label, if (e.read) null else "olvasatlan", e.title, e.text).joinToString(", ") }
                .padding(vertical = 7.dp),
            verticalAlignment = Alignment.Top,
        ) {
            Box(Modifier.padding(top = 5.dp).size(8.dp).clip(CircleShape).background(if (e.read) Melyviz.line else mark))
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(e.title, style = Melyviz.label.copy(color = if (e.read) Melyviz.muted else Melyviz.ink), maxLines = 2, overflow = TextOverflow.Ellipsis)
                if (e.text.isNotEmpty()) Text(e.text, style = Melyviz.small, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            Text("${e.kind.label} · ${TIME.format(Date(e.at))}", style = Melyviz.readout.copy(fontSize = 10.sp), modifier = Modifier.padding(start = 8.dp))
        }
    }

    private fun count(s: InboxState, k: InboxKind?): String {
        val n = s.events.count { !it.read && (k == null || it.kind == k) }
        return if (n > 0) " ($n)" else ""
    }

    private fun status(s: InboxState): String {
        val now = System.currentTimeMillis()
        return when {
            s.backoffUntil > now -> "Szünet ${TIME.format(Date(s.backoffUntil))}-ig (GitHub korlát)"
            s.lastPoll == 0L -> "GitHub: még nem kérdezte · 15 percenként"
            else -> "GitHub: ${TIME.format(Date(s.lastPoll))} · 15 percenként · ${s.unread} olvasatlan"
        }
    }

    private fun dayLabel(d: LocalDate): String {
        val today = LocalDate.now()
        return when (d) {
            today -> "Ma"
            today.minusDays(1) -> "Tegnap"
            else -> d.toString()
        }
    }

    private val TIME = SimpleDateFormat("HH:mm", Locale.ROOT)
}

/** WorkManager's side: one round every 15 minutes with a network. A rate limit is handled by the backoff, not by retry. */
class InboxWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        InboxFeature.poll(manual = false)
        return Result.success()
    }
}
