package hu.vrg.mobile.ports

import android.app.Application
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.PortEntry
import hu.vrg.mobile.core.PortList
import hu.vrg.mobile.core.PortStatus
import hu.vrg.mobile.core.Ports
import hu.vrg.mobile.core.PortsMsgs
import hu.vrg.mobile.core.PortsNote
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

// Localhost (WP M8, D-10 = C): the PC's local servers that are running now. "🖥 A PC-n" asks the relay
// to open one in its own window on the PC; "📱 Itt" opens it on the phone through the relay's
// /p/<port>/ proxy, shown only when the relay says the proxy is on (started with --ports). Both need a
// trusted phone (M2). The rules (names, order, the proxy address) are kit-core's Ports.kt.

object PortsFeature : VrgFeature {
    override val info = Catalogue.PORTS
    private const val TAG = "ports"
    private const val TIMEOUT_MS = 20_000L

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    val list = MutableStateFlow<PortList?>(null)
    val busy = MutableStateFlow(false)
    /** A one-line answer to "A PC-n", shown through host.note() by the screen. */
    private val notes = MutableSharedFlow<String>(extraBufferCapacity = 4)
    private var timeout: Job? = null

    override fun init(app: Application) {
        Relay.addCaps(listOf(Ports.CAP))
        scope.launch { Relay.incoming.collect(::onMessage) }
    }

    private fun onMessage(raw: String) {
        when (val n = PortsMsgs.parse(raw) ?: return) {
            is PortsNote.Listed -> {
                timeout?.cancel()
                busy.value = false
                list.value = n.list
                if (!n.list.ok) VrgLog.w(TAG, "Lista: ${n.list.reason ?: "elutasítva"}")
            }
            is PortsNote.Opened -> {
                val r = n.result
                val text = if (r.ok) "Megnyitva a PC-n: localhost:${r.port}" else "Nem nyílt meg: ${r.reason ?: "?"}"
                if (!r.ok) VrgLog.w(TAG, text)
                notes.tryEmit(text)
            }
        }
    }

    fun refresh() {
        if (busy.value) return
        if (Relay.trust.value != Trust.TRUSTED) return
        busy.value = true
        if (!Relay.send(PortsMsgs.list())) { busy.value = false; return }
        timeout?.cancel()
        timeout = scope.launch {
            delay(TIMEOUT_MS)
            if (busy.value) {
                busy.value = false
                notes.tryEmit("A relé nem válaszolt a listára.")
            }
        }
    }

    private fun openOnPc(e: PortEntry): String? {
        val msg = PortsMsgs.openOnDesktop(e.port, e.path) ?: return "Hibás port vagy útvonal."
        return if (Relay.send(msg)) null else "Nincs relé kapcsolat."
    }

    private fun openHere(ctx: Context, e: PortEntry, token: String?): String? {
        val url = Ports.proxyUrl(Relay.url, e.port, e.path, token) ?: return "A telefonos megnyitás nem érhető el."
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

        PullToRefreshBox(isRefreshing = loading, onRefresh = { refresh() }, modifier = Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
                Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current),
                    modifier = Modifier.clickable { host.home() }.padding(vertical = 8.dp))
                Text("LOCALHOST", style = Melyviz.title.copy(fontSize = 18.sp))
                pc?.let { Text("${it.name} · ${Relay.url.removePrefix("ws://")}", style = Melyviz.readout) }

                when {
                    link != LinkState.OPEN -> Gate("Nincs relé kapcsolat. Indítsd a relét a PC-n, és párosítsd a telefont.", host)
                    trust == Trust.CHECKING -> Text("Azonosítás…", style = Melyviz.small, modifier = Modifier.padding(top = 8.dp))
                    trust != Trust.TRUSTED -> Gate("Ez a telefon nincs párosítva ezzel a PC-vel: a PC-n futó szerverek csak párosított telefonnak látszanak.", host)
                    else -> {
                        val l = now
                        when {
                            l == null -> Text(if (loading) "Portok olvasása…" else "Húzd le a frissítéshez.", style = Melyviz.small, modifier = Modifier.padding(top = 8.dp))
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
    private fun Body(l: PortList, ctx: Context, host: FeatureHost) {
        val (shown, other) = Ports.split(l.entries)
        var showOther by remember { mutableStateOf(false) }
        Text("${l.entries.size} port · ${l.tookMs} ms · húzd le az újratöltéshez", style = Melyviz.small)
        if (!l.proxyOn) Text("A telefonos megnyitás ki van kapcsolva: a relét --ports kapcsolóval kell indítani (Mobile\\mobile.cmd → 1).",
            style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 4.dp))

        VrgSectionTitle("Futó szerverek")
        if (shown.isEmpty()) Text("Most nem fut helyi webszerver a PC-n.", style = Melyviz.small)
        shown.forEach { Line(it, l, ctx, host) }

        if (other.isNotEmpty()) {
            Spacer(Modifier.height(8.dp))
            Text((if (showOther) "▾ " else "▸ ") + "Egyéb (${other.size})", style = Melyviz.label.copy(color = Melyviz.current),
                modifier = Modifier.clickable { showOther = !showOther }.padding(vertical = 6.dp))
            if (showOther) other.forEach { Line(it, l, ctx, host) }
        }
    }

    @Composable
    private fun Line(e: PortEntry, l: PortList, ctx: Context, host: FeatureHost) {
        Column(Modifier.fillMaxWidth().padding(vertical = 5.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(8.dp).clip(CircleShape).background(dot(e.status)))
                Spacer(Modifier.width(8.dp))
                Text(e.name, style = Melyviz.label, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            }
            Text(e.detail + if (e.self) " · ez a relé" else "", style = Melyviz.readout.copy(fontSize = 11.sp),
                maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(start = 16.dp))
            if (e.openable) Row(Modifier.padding(start = 16.dp, top = 4.dp)) {
                if (l.proxyOn && l.token != null) {
                    VrgChip("📱 Itt") { openHere(ctx, e, l.token)?.let(host::note) }
                    Spacer(Modifier.width(8.dp))
                }
                VrgChip("🖥 A PC-n") { openOnPc(e)?.let(host::note) }
            }
        }
    }

    @Composable
    private fun dot(s: PortStatus) = when (s) {
        PortStatus.WEB -> Melyviz.glow
        PortStatus.OPEN -> Melyviz.sand
        PortStatus.SYSTEM -> Melyviz.faint
    }
}
