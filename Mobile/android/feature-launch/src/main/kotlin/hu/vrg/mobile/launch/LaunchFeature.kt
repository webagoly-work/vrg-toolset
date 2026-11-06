package hu.vrg.mobile.launch

import android.app.Application
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.Launch
import hu.vrg.mobile.core.LaunchEntry
import hu.vrg.mobile.core.LaunchList
import hu.vrg.mobile.core.LaunchLog
import hu.vrg.mobile.core.LaunchMsgs
import hu.vrg.mobile.core.LaunchNote
import hu.vrg.mobile.core.Ports
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.relay.LinkState
import hu.vrg.mobile.kit.relay.Relay
import hu.vrg.mobile.kit.relay.Trust
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.ui.VrgSectionTitle
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

// Indítópult (WP M11): START's tools as a grid with their START keys. A tap starts one on the PC (the
// relay opens its page, starting its server first when needed); a long-press selects it and shows
// what else it can do: "Megnyitás a telefonon" through the M8 proxy when its server runs, its log
// tail and "Leállítás" when the relay started it. The rules are kit-core's Launch.kt.

object LaunchFeature : VrgFeature {
    override val info = Catalogue.LAUNCH
    private const val TAG = "launch"
    private const val LIST_TIMEOUT_MS = 20_000L
    private const val RUN_TIMEOUT_MS = 200_000L     // Kódváros scans the repo first (up to 3 minutes)
    private const val STATUS_EVERY_MS = 5_000L

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    val list = MutableStateFlow<LaunchList?>(null)
    val busy = MutableStateFlow(false)
    /** Ids whose launch.run has not been answered yet. */
    val starting = MutableStateFlow<Set<String>>(emptySet())
    val log = MutableStateFlow<LaunchLog?>(null)
    private val notes = MutableSharedFlow<String>(extraBufferCapacity = 4)
    private var timeout: Job? = null

    override fun init(app: Application) {
        Relay.addCaps(listOf(Launch.CAP))
        scope.launch { Relay.incoming.collect(::onMessage) }
    }

    private fun nameOf(id: String?): String? = list.value?.entries?.firstOrNull { it.id == id }?.name

    private fun onMessage(raw: String) {
        when (val n = LaunchMsgs.parse(raw) ?: return) {
            is LaunchNote.Listed -> {
                timeout?.cancel()
                busy.value = false
                list.value = n.list
                if (!n.list.ok) VrgLog.w(TAG, "Lista: ${n.list.reason ?: "elutasítva"}")
            }
            is LaunchNote.Status -> if (n.status.ok) list.value?.let { list.value = it.withStatus(n.status) }
            is LaunchNote.Ran -> {
                val r = n.result
                r.id?.let { id -> starting.value = starting.value - id }
                if (r.id == null) starting.value = emptySet()
                val text = Launch.ranText(r, nameOf(r.id))
                if (!r.ok) VrgLog.w(TAG, text)
                notes.tryEmit(text)
                if (r.ok) Relay.send(LaunchMsgs.status())
            }
            is LaunchNote.Log -> log.value = n.log
            is LaunchNote.Stopped -> {
                notes.tryEmit(if (n.result.ok) "Leállítva: ${nameOf(n.result.id) ?: n.result.id}" else "Nem állt le: ${n.result.reason ?: "?"}")
                Relay.send(LaunchMsgs.status())
            }
        }
    }

    fun refresh() {
        if (busy.value || Relay.trust.value != Trust.TRUSTED) return
        busy.value = true
        if (!Relay.send(LaunchMsgs.list())) { busy.value = false; return }
        timeout?.cancel()
        timeout = scope.launch {
            delay(LIST_TIMEOUT_MS)
            if (busy.value) { busy.value = false; notes.tryEmit("A relé nem válaszolt a listára.") }
        }
    }

    private fun run(e: LaunchEntry): String? {
        if (e.id in starting.value) return "Már indul: ${e.name}"
        val msg = LaunchMsgs.run(e.id) ?: return "Hibás azonosító."
        if (!Relay.send(msg)) return "Nincs relé kapcsolat."
        starting.value = starting.value + e.id
        scope.launch {
            delay(RUN_TIMEOUT_MS)
            if (e.id in starting.value) { starting.value = starting.value - e.id; notes.tryEmit("A relé nem válaszolt: ${e.name}") }
        }
        return "Indítás a PC-n: ${e.name}…"
    }

    private fun openHere(ctx: Context, l: LaunchList, e: LaunchEntry): String? {
        val port = e.port ?: return "Ennek nincs szervere."
        val url = Ports.proxyUrl(Relay.url, port, e.path, l.token) ?: return "A telefonos megnyitás nem érhető el."
        val uri = Uri.parse(url)
        try { CustomTabsIntent.Builder().build().launchUrl(ctx, uri) }
        catch (x: Exception) { runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } }
        return null
    }

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    override fun Screen(host: FeatureHost) {
        val now by list.collectAsStateWithLifecycle()
        val loading by busy.collectAsStateWithLifecycle()
        val link by Relay.state.collectAsStateWithLifecycle()
        val trust by Relay.trust.collectAsStateWithLifecycle()
        val pc by Relay.pc.collectAsStateWithLifecycle()
        val ctx = LocalContext.current
        LaunchedEffect(trust) { if (trust == Trust.TRUSTED) refresh() }
        LaunchedEffect(Unit) { notes.collect { host.note(it) } }
        // what runs: asked again every few seconds while the screen is open
        LaunchedEffect(trust, now != null) {
            while (trust == Trust.TRUSTED && list.value?.ok == true) { delay(STATUS_EVERY_MS); Relay.send(LaunchMsgs.status()) }
        }

        PullToRefreshBox(isRefreshing = loading, onRefresh = { refresh() }, modifier = Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
                Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current),
                    modifier = Modifier.clickable { host.home() }.padding(vertical = 8.dp))
                Text("INDÍTÓPULT", style = Melyviz.title.copy(fontSize = 18.sp))
                pc?.let { Text("${it.name} · ${Relay.url.removePrefix("ws://")}", style = Melyviz.readout) }

                when {
                    link != LinkState.OPEN -> Gate("Nincs relé kapcsolat. Indítsd a relét a PC-n, és párosítsd a telefont.", host)
                    trust == Trust.CHECKING -> Text("Azonosítás…", style = Melyviz.small, modifier = Modifier.padding(top = 8.dp))
                    trust != Trust.TRUSTED -> Gate("Ez a telefon nincs párosítva ezzel a PC-vel: a PC-n csak párosított telefon indíthat.", host)
                    else -> {
                        val l = now
                        when {
                            l == null -> Text(if (loading) "A START lista olvasása…" else "Húzd le a frissítéshez.", style = Melyviz.small, modifier = Modifier.padding(top = 8.dp))
                            !l.ok -> {
                                Text(l.reason ?: "A relé elutasította.", style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 8.dp))
                                if (!l.trusted) Row(Modifier.padding(vertical = 6.dp)) { VrgChip("QR párosítás ›") { host.open(Catalogue.PAIR.id) } }
                            }
                            else -> Body(l, ctx, host)
                        }
                    }
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }

    @Composable
    private fun Gate(text: String, host: FeatureHost) {
        Text(text, style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 8.dp))
        Row(Modifier.padding(vertical = 6.dp)) { VrgChip("QR párosítás ›") { host.open(Catalogue.PAIR.id) } }
    }

    @Composable
    private fun Body(l: LaunchList, ctx: Context, host: FeatureHost) {
        val going by starting.collectAsStateWithLifecycle()
        var picked by remember { mutableStateOf<String?>(null) }
        Text("Koppintás: indítás a PC-n · hosszan nyomva: több", style = Melyviz.small)
        for ((group, entries) in l.groups()) {
            VrgSectionTitle(group)
            entries.chunked(3).forEach { row ->
                Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.forEach { e ->
                        Tile(e, l, e.id in going, e.id == picked, Modifier.weight(1f),
                            onTap = { run(e)?.let(host::note) },
                            onLong = { picked = if (picked == e.id) null else e.id; log.value = null })
                    }
                    repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                }
                row.firstOrNull { it.id == picked }?.let { Detail(it, l, ctx, host) }
            }
        }
    }

    @OptIn(ExperimentalFoundationApi::class)
    @Composable
    private fun Tile(e: LaunchEntry, l: LaunchList, going: Boolean, picked: Boolean, modifier: Modifier, onTap: () -> Unit, onLong: () -> Unit) {
        val shape = RoundedCornerShape(12.dp)
        val running = l.isRunning(e)
        val state = when { going -> "indul"; running -> "fut"; e.server != null -> "nem fut"; else -> null }
        Box(
            modifier.heightIn(min = 76.dp).clip(shape)
                .background(if (picked) Melyviz.raised else Melyviz.surface)
                .border(1.dp, if (picked) Melyviz.glow else Melyviz.line, shape)
                .alpha(if (e.exists) 1f else 0.45f)
                .combinedClickable(onClick = onTap, onLongClick = onLong)
                .semantics { contentDescription = listOfNotNull(e.key, e.name, state, if (!e.exists) "nincs a PC-n" else null).joinToString(", ") }
                .padding(8.dp),
        ) {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(e.key, style = Melyviz.title.copy(fontSize = 22.sp, color = if (going) Melyviz.sand else Melyviz.glow))
                Text(e.name, style = Melyviz.small.copy(fontSize = 11.sp), maxLines = 2, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
            }
            if (e.server != null || going) Box(
                Modifier.align(Alignment.TopEnd).size(8.dp).clip(CircleShape)
                    .background(when { going -> Melyviz.sand; running -> Melyviz.glow; else -> Melyviz.faint }),
            )
        }
    }

    @Composable
    private fun Detail(e: LaunchEntry, l: LaunchList, ctx: Context, host: FeatureHost) {
        val tail by log.collectAsStateWithLifecycle()
        Column(Modifier.fillMaxWidth().padding(vertical = 6.dp).clip(RoundedCornerShape(12.dp)).background(Melyviz.surface).padding(10.dp)) {
            Text("${e.key} · ${e.name}", style = Melyviz.label)
            val sub = listOfNotNull(e.hint, e.port?.let { "localhost:$it" + if (l.isRunning(e)) " · fut" else " · nem fut" },
                if (!e.exists) "nincs meg a PC-n" else null)
            if (sub.isNotEmpty()) Text(sub.joinToString(" · "), style = Melyviz.readout.copy(fontSize = 11.sp))
            Row(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                VrgChip("▶ A PC-n") { run(e)?.let(host::note) }
                if (Launch.openableHere(l, e)) VrgChip("📱 Megnyitás a telefonon") { openHere(ctx, l, e)?.let(host::note) }
            }
            if (e.port != null && l.isRunning(e) && !l.proxyOn) Text("A telefonos megnyitáshoz a relét --ports kapcsolóval kell indítani (Mobile\\mobile.cmd → 1).",
                style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 4.dp))
            if (e.server != null) Row(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                VrgChip("Napló") { LaunchMsgs.log(e.id)?.let { if (!Relay.send(it)) host.note("Nincs relé kapcsolat.") } }
                if (l.isMine(e)) VrgChip("■ Leállítás") { LaunchMsgs.stop(e.id)?.let { if (!Relay.send(it)) host.note("Nincs relé kapcsolat.") } }
            }
            val t = tail
            if (t != null && t.id == e.id) {
                Spacer(Modifier.height(6.dp))
                when {
                    !t.ok -> Text(t.reason ?: "A napló nem olvasható.", style = Melyviz.small.copy(color = Melyviz.sand))
                    t.lines.isEmpty() -> Text(t.note ?: "A napló üres.", style = Melyviz.small)
                    else -> Text(t.lines.joinToString("\n"), style = Melyviz.readout.copy(fontSize = 10.sp),
                        modifier = Modifier.fillMaxWidth().background(Melyviz.deep).padding(6.dp))
                }
            }
        }
    }
}
