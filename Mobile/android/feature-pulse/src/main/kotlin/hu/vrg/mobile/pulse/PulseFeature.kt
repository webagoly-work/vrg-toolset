package hu.vrg.mobile.pulse

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.Ci
import hu.vrg.mobile.core.CommitLine
import hu.vrg.mobile.core.Comparison
import hu.vrg.mobile.core.Contents
import hu.vrg.mobile.core.OpenPull
import hu.vrg.mobile.core.Pulse
import hu.vrg.mobile.core.ToolMap
import hu.vrg.mobile.core.ToolRow
import hu.vrg.mobile.core.ToolRows
import hu.vrg.mobile.core.VrgRepo
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.github.Account
import hu.vrg.mobile.kit.github.Gh
import hu.vrg.mobile.kit.github.GitHub
import hu.vrg.mobile.kit.github.problem
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.core.MiniStatus
import hu.vrg.mobile.kit.ui.MiniTrack
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.ui.VrgSectionTitle
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

// Haladás (WP M4, D-8 = A): one screen for "where does the work stand?". Everything lands on main, so
// main comes first: its commits, its CI and the tools it changed this week. A branch shows only while it
// holds recent, unmerged work. The rules are kit-core's Pulse.kt; the ETag cache makes a refresh cheap.

data class BranchCard(val name: String, val ahead: Int, val behind: Int, val last: CommitLine, val pull: OpenPull?)

data class PulseView(
    val commits: List<CommitLine>,
    val ci: Ci,
    val recentCount: Int,
    val capped: Boolean,
    val branches: List<BranchCard>,
    val rows: List<ToolRow>,
    /** Why the tools list is empty or partial; null when it is whole. */
    val toolNote: String?,
    val tookMs: Long,
)

object PulseFeature : VrgFeature {
    override val info = Catalogue.PULSE
    private const val TAG = "pulse"

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    val view = MutableStateFlow<PulseView?>(null)
    val busy = MutableStateFlow(false)
    val problem = MutableStateFlow<String?>(null)

    /** The refresh's MINI on the home tile (WP M16). */
    private val ring = MiniTrack()
    override val activity: StateFlow<MiniStatus> get() = ring.status

    fun refresh() {
        if (busy.value || !GitHub.signedIn) return
        busy.value = true
        ring.run()
        scope.launch {
            val started = System.currentTimeMillis()
            when (val r = load()) {
                is Gh.Ok -> {
                    view.value = r.value.copy(tookMs = System.currentTimeMillis() - started)
                    problem.value = null
                    ring.done()
                }
                else -> {
                    problem.value = r.problem()
                    VrgLog.w(TAG, "Nem sikerült: ${problem.value}")
                    ring.fail()
                }
            }
            busy.value = false
        }
    }

    private fun <T> Gh<T>.orNull(): T? = (this as? Gh.Ok)?.value

    private suspend fun load(): Gh<PulseView> = coroutineScope {
        val now = System.currentTimeMillis() / 1000
        val path = VrgRepo.PATH
        val recent = async { GitHub.get("$path/commits?sha=${Pulse.MAIN}&per_page=8") }
        val ci = async { GitHub.get("$path/commits/${Pulse.MAIN}/check-runs?per_page=100") }
        val pulls = async { GitHub.get("$path/pulls?state=open&per_page=100") }
        val tools = async { GitHub.get("$path/contents/${Pulse.TOOLS_FILE}?ref=${Pulse.MAIN}") }
        val before = async { GitHub.get("$path/commits?sha=${Pulse.MAIN}&until=${Pulse.since(now, Pulse.RECENT_DAYS)}&per_page=1") }
        val listed = async { GitHub.get("$path/branches?per_page=100") }

        val first = recent.await()
        if (first !is Gh.Ok) return@coroutineScope Gh.failureOf(first)
        val commits = Pulse.commits(first.value)
        val open = pulls.await().orNull()?.let { Pulse.pulls(it) }.orEmpty()

        // main's week: everything since the last commit older than 7 days
        val base = before.await().orNull()?.let { Pulse.commits(it).firstOrNull()?.sha }
        val week = base?.let { GitHub.get("$path/compare/$it...${Pulse.MAIN}?per_page=1").orNull() }?.let { Comparison.parse(it) }

        val found = listed.await().orNull()?.let { Pulse.branches(it) }.orEmpty()
            .filter { it.name != Pulse.MAIN }
            .map { b ->
                async {
                    val c = GitHub.get("$path/compare/${Pulse.MAIN}...${b.name}?per_page=1").orNull()?.let { Comparison.parse(it) }
                        ?: return@async null
                    if (c.ahead == 0) return@async null          // merged: no card, and no need for its commit
                    val last = GitHub.get("$path/commits/${b.sha}").orNull()?.let { Pulse.commit(it) } ?: return@async null
                    if (!Pulse.isActive(b.name, c.ahead, last.at, now)) return@async null
                    BranchCard(b.name, c.ahead, c.behind, last, open[b.name]) to c.files
                }
            }.awaitAll().filterNotNull()

        val map = tools.await().orNull()?.let { Contents.parse(it)?.text }?.let { ToolMap.parse(it) }
        val rows = map?.let { ToolRows.build(it, week?.files.orEmpty(), found.associate { (b, files) -> b.name to files }) }.orEmpty()
        val note = when {
            map == null -> "Az eszköztérkép nem érhető el (${Pulse.TOOLS_FILE})."
            week == null -> "A main heti változásai nem érhetők el."
            else -> null
        }
        Gh.Ok(PulseView(commits, ci.await().orNull()?.let { Ci.parse(it) } ?: Ci.NONE, week?.ahead ?: 0, week?.capped == true,
            found.map { it.first }, rows, note, 0))
    }

    private fun open(ctx: Context, url: String) {
        if (url.isEmpty()) return
        val uri = Uri.parse(url)
        try { CustomTabsIntent.Builder().build().launchUrl(ctx, uri) }
        catch (e: Exception) { runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } }
    }

    private fun ago(at: Long): String {
        val minutes = (System.currentTimeMillis() / 1000 - at) / 60
        return when {
            minutes < 1 -> "most"
            minutes < 60 -> "$minutes perce"
            minutes < 24 * 60 -> "${minutes / 60} órája"
            else -> "${minutes / (24 * 60)} napja"
        }
    }

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    override fun Screen(host: FeatureHost) {
        val now by view.collectAsStateWithLifecycle()
        val loading by busy.collectAsStateWithLifecycle()
        val why by problem.collectAsStateWithLifecycle()
        val account by GitHub.account.collectAsStateWithLifecycle()
        val ctx = LocalContext.current
        LaunchedEffect(account is Account.SignedIn) { refresh() }

        PullToRefreshBox(isRefreshing = loading, onRefresh = { refresh() }, modifier = Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
                Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current),
                    modifier = Modifier.clickable { host.home() }.padding(vertical = 8.dp))
                Text("HALADÁS", style = Melyviz.title.copy(fontSize = 18.sp))

                if (account !is Account.SignedIn) {
                    Text("A repó privát: GitHub belépés kell.", style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 8.dp))
                    Row(Modifier.padding(vertical = 6.dp)) { VrgChip("GitHub fiók ›") { host.open(Catalogue.ACCOUNT.id) } }
                }
                why?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 6.dp)) }
                val v = now
                if (v == null) {
                    if (loading) Text("Betöltés…", style = Melyviz.small, modifier = Modifier.padding(top = 8.dp))
                } else Body(v, ctx)
                Spacer(Modifier.height(24.dp))
            }
        }
    }

    @Composable
    private fun Body(v: PulseView, ctx: Context) {
        Text("Frissítve ${v.tookMs} ms alatt · húzd le az újratöltéshez", style = Melyviz.small)

        VrgSectionTitle("main")
        Text("${v.ci.mark} ${v.ci.label}", style = Melyviz.readout)
        Text("${v.recentCount}${if (v.capped) "+" else ""} commit az elmúlt ${Pulse.RECENT_DAYS} napban", style = Melyviz.small)
        Spacer(Modifier.height(6.dp))
        v.commits.forEach { Commit(it, ctx) }

        VrgSectionTitle("Nyitott munka")
        if (v.branches.isEmpty()) Text("Minden munka a mainen van.", style = Melyviz.small)
        v.branches.forEach { b ->
            Text(b.name, style = Melyviz.title)
            Text("${b.ahead} előrébb · ${b.behind} mögötte · ${ago(b.last.at)}", style = Melyviz.small)
            b.pull?.let { p ->
                Text("PR #${p.number}", style = Melyviz.small.copy(color = Melyviz.current),
                    modifier = Modifier.clickable { open(ctx, p.url) }.padding(vertical = 2.dp))
            }
            Commit(b.last, ctx)
            Spacer(Modifier.height(8.dp))
        }

        VrgSectionTitle("Eszközök · ${Pulse.RECENT_DAYS} nap")
        v.toolNote?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand)) }
        if (v.capped) Text("A GitHub legfeljebb ${Pulse.FILE_LIMIT} fájlt listáz, a számok alsó becslések.", style = Melyviz.small.copy(color = Melyviz.sand))
        v.rows.forEach { r ->
            Row(Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
                Text(r.name, style = Melyviz.small.copy(color = Melyviz.ink), modifier = Modifier.weight(1f))
                if (r.mainFiles > 0) Text("${r.mainFiles} fájl", style = Melyviz.readout.copy(fontSize = 11.sp))
                if (r.branches.isNotEmpty()) {
                    Spacer(Modifier.width(8.dp))
                    Text(r.branches.joinToString(), style = Melyviz.small.copy(color = Melyviz.sand))
                }
            }
        }
    }

    @Composable
    private fun Commit(c: CommitLine, ctx: Context) {
        Column(Modifier.fillMaxWidth().clickable { open(ctx, c.url) }.padding(vertical = 3.dp)) {
            Text(c.message, style = Melyviz.small.copy(color = Melyviz.ink), maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text("${c.sha.take(7)} · ${ago(c.at)}", style = Melyviz.readout.copy(fontSize = 11.sp))
        }
    }
}
