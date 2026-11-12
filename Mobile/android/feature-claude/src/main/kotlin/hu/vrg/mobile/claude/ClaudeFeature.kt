package hu.vrg.mobile.claude

import android.app.Application
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.ClaudeApp
import hu.vrg.mobile.core.ClaudeList
import hu.vrg.mobile.core.ClaudeMsgs
import hu.vrg.mobile.core.ClaudeNote
import hu.vrg.mobile.core.ClaudeSession
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.relay.LinkState
import hu.vrg.mobile.kit.relay.Relay
import hu.vrg.mobile.kit.relay.Trust
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// Claude (WP M22). VRG Mobile never signs in to Claude and never sees a Claude password or token: the official Claude app is the
// sign-in, and this feature only opens it (ClaudeApp: the app when installed, else claude.ai in the browser).
//
// With a paired PC whose relay runs with --claude, the PC's Remote Control sessions: claude.list → the folders (START's own Claude
// Code menu, narrowed by Mobile/catalogue/claude.json) and the sessions the relay started; ▶ starts `claude remote-control` in a
// folder with account A or B, the relay passes back the session link, and „Megnyitás a Claude-ban” hands it to the Claude app. That
// session is the PC's Claude Code, driven from the phone. ■ stops a session the relay started. The phone sends a folder key, an account
// letter and a session id only (ClaudeMsgs); the relay checks each against its own lists.

object ClaudeFeature : VrgFeature {
    override val info = Catalogue.CLAUDE
    private const val TAG = "claude"
    private const val REFRESH_MS = 8000L

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    val list = MutableStateFlow<ClaudeList?>(null)
    val busy = MutableStateFlow(false)
    /** The folder key a start is waiting on (the relay waits up to 20 s for the link). */
    val starting = MutableStateFlow<String?>(null)
    private val notes = MutableSharedFlow<String>(extraBufferCapacity = 4)
    private var timeout: Job? = null

    override fun init(app: Application) {
        Relay.addCaps(listOf(ClaudeMsgs.CAP))
        scope.launch { Relay.incoming.collect(::onMessage) }
    }

    private fun onMessage(raw: String) {
        when (val n = ClaudeMsgs.parse(raw) ?: return) {
            is ClaudeNote.Listed -> { timeout?.cancel(); busy.value = false; list.value = n.list }
            is ClaudeNote.Started -> {
                starting.value = null
                val r = n.result
                val s = r.session
                notes.tryEmit(when {
                    !r.ok -> "Nem indult: ${r.reason ?: "?"}"
                    s?.url == null -> "Elindult (${s?.name}); a link még nem jött meg, frissíts pár másodperc múlva."
                    else -> "Elindult: ${s.name}"
                })
                if (!r.ok) VrgLog.w(TAG, r.reason ?: "start refused")
                Relay.send(ClaudeMsgs.list())
            }
            is ClaudeNote.Stopped -> {
                notes.tryEmit(if (n.result.ok) "Leállítva." else "Nem állt le: ${n.result.reason ?: "?"}")
                Relay.send(ClaudeMsgs.list())
            }
        }
    }

    fun refresh() {
        if (Relay.trust.value != Trust.TRUSTED) return
        busy.value = true
        if (!Relay.send(ClaudeMsgs.list())) { busy.value = false; return }
        timeout?.cancel()
        timeout = scope.launch { delay(10_000); busy.value = false }
    }

    private fun start(folder: String, account: String): String? {
        val msg = ClaudeMsgs.start(folder, account) ?: return "Ismeretlen mappa."
        if (!Relay.send(msg)) return "Nincs relé kapcsolat."
        starting.value = folder
        scope.launch { delay(30_000); if (starting.value == folder) starting.value = null }
        return null
    }

    // ---- the Claude app ---------------------------------------------------------------------------------------------

    fun installed(ctx: Context): Boolean = try {
        ctx.packageManager.getPackageInfo(ClaudeApp.PACKAGE, 0); true
    } catch (e: PackageManager.NameNotFoundException) { false }

    /** A session link to the Claude app (or the browser); null url = the app itself. */
    fun openClaude(ctx: Context, url: String?): String? {
        val inApp = installed(ctx)
        if (url == null && inApp) {
            ctx.packageManager.getLaunchIntentForPackage(ClaudeApp.PACKAGE)?.let {
                return try { ctx.startActivity(it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); null } catch (e: Exception) { "A Claude alkalmazás nem nyílt meg." }
            }
        }
        val t = ClaudeApp.target(url, inApp)
        val i = Intent(Intent.ACTION_VIEW, Uri.parse(t.url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return try { ctx.startActivity(if (t.pkg != null) Intent(i).setPackage(t.pkg) else i); null } catch (e: Exception) {
            try { ctx.startActivity(i); null } catch (e2: Exception) { "Nincs böngésző a telefonon." }
        }
    }

    private fun store(ctx: Context) {
        val market = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=${ClaudeApp.PACKAGE}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try { ctx.startActivity(market) } catch (e: Exception) {
            runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(ClaudeApp.STORE)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        }
    }

    // ---- the screen ---------------------------------------------------------------------------------------------------

    @Composable
    override fun Screen(host: FeatureHost) {
        val ctx = LocalContext.current
        val now by list.collectAsStateWithLifecycle()
        val loading by busy.collectAsStateWithLifecycle()
        val link by Relay.state.collectAsStateWithLifecycle()
        val trust by Relay.trust.collectAsStateWithLifecycle()
        val pc by Relay.pc.collectAsStateWithLifecycle()
        val app = remember { installed(ctx) }
        LaunchedEffect(trust) { if (trust == Trust.TRUSTED) refresh() }
        LaunchedEffect(Unit) { notes.collect { host.note(it) } }
        // a started session's link may come a little later; and a session stopped on the PC should show it
        LaunchedEffect(trust, now?.on == true) { while (trust == Trust.TRUSTED && list.value?.on == true) { delay(REFRESH_MS); Relay.send(ClaudeMsgs.list()) } }

        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
            Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current), modifier = Modifier.clickable { host.home() }.padding(vertical = 8.dp))
            Text("CLAUDE", style = Melyviz.title.copy(fontSize = 18.sp))

            // ---- the app
            Card {
                Text("CLAUDE ALKALMAZÁS", style = Melyviz.small.copy(letterSpacing = 1.4.sp, color = Melyviz.glowDim))
                Text(if (app) "Telepítve. A belépés ott történik; a VRG Mobile nem kér és nem tárol Claude-jelszót."
                     else "Nincs telepítve: a claude.ai a böngészőben nyílik. A Remote Control munkamenetekhez az alkalmazás ajánlott.",
                    style = Melyviz.small, modifier = Modifier.padding(vertical = 6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    VrgChip(if (app) "✶ Megnyitás" else "claude.ai ↗") { openClaude(ctx, null)?.let(host::note) }
                    if (!app) VrgChip("Telepítés ›") { store(ctx) }
                }
            }

            // ---- the PC's sessions
            Card {
                Text("A PC MUNKAMENETEI (REMOTE CONTROL)", style = Melyviz.small.copy(letterSpacing = 1.4.sp, color = Melyviz.glowDim))
                pc?.let { Text("${it.name} · ${Relay.url.removePrefix("ws://")}", style = Melyviz.readout, modifier = Modifier.padding(top = 4.dp)) }
                when {
                    link != LinkState.OPEN -> Gate("Nincs relé kapcsolat. Indítsd a relét a PC-n (Mobile\\mobile.cmd relay), és párosítsd a telefont.", host)
                    trust == Trust.CHECKING -> Text("Azonosítás…", style = Melyviz.small, modifier = Modifier.padding(top = 8.dp))
                    trust != Trust.TRUSTED -> Gate("Ez a telefon nincs párosítva ezzel a PC-vel: munkamenetet csak párosított telefon indíthat.", host)
                    else -> {
                        val l = now
                        when {
                            l == null -> Text(if (loading) "Olvasás…" else "—", style = Melyviz.small, modifier = Modifier.padding(top = 8.dp))
                            !l.ok -> {
                                Text(l.reason ?: "A relé elutasította.", style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 8.dp))
                                Row(Modifier.padding(vertical = 6.dp)) { VrgChip("⟳") { refresh() } }
                            }
                            else -> Sessions(l, host)
                        }
                    }
                }
            }
            Text("Egy munkamenet a PC Claude Code-ja ebben a mappában: a Claude alkalmazásból vezérelve azt teszi a PC-n, amit ott a terminálban tenne.",
                style = Melyviz.small.copy(fontSize = 10.sp, color = Melyviz.faint), modifier = Modifier.padding(vertical = 10.dp))
        }
    }

    @Composable
    private fun Card(body: @Composable () -> Unit) {
        Column(Modifier.fillMaxWidth().padding(top = 10.dp).background(Melyviz.surface, RoundedCornerShape(Melyviz.radius))
            .border(1.dp, Melyviz.lineSoft, RoundedCornerShape(Melyviz.radius)).padding(12.dp)) { body() }
    }

    @Composable
    private fun Gate(text: String, host: FeatureHost) {
        Text(text, style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 8.dp))
        Row(Modifier.padding(vertical = 6.dp)) { VrgChip("QR párosítás ›") { host.open(Catalogue.PAIR.id) } }
    }

    private val TIME = SimpleDateFormat("MM.dd. HH:mm", Locale.ROOT)

    @Composable
    private fun Sessions(l: ClaudeList, host: FeatureHost) {
        val ctx = LocalContext.current
        val wait by starting.collectAsStateWithLifecycle()
        var account by remember { mutableStateOf("A") }
        if (l.sessions.isEmpty()) Text("Nincs futó munkamenet.", style = Melyviz.small, modifier = Modifier.padding(top = 8.dp))
        l.sessions.forEach { s -> SessionRow(s, l, host, ctx) }

        Text("ÚJ MUNKAMENET", style = Melyviz.small.copy(letterSpacing = 1.4.sp, color = Melyviz.glowDim), modifier = Modifier.padding(top = 14.dp, bottom = 4.dp))
        if (l.accounts.size > 1) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Fiók:", style = Melyviz.small)
            l.accounts.forEach { a -> VrgChip((if (a == account) "● " else "") + a) { account = a } }
        }
        l.folders.forEach { f ->
            Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(f.name, style = Melyviz.label, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (f.hint.isNotEmpty()) Text(f.hint, style = Melyviz.small.copy(fontSize = 10.sp), maxLines = 1)
                }
                VrgChip(if (wait == f.key) "indul…" else "▶ Indítás") { if (wait == null) start(f.key, account)?.let(host::note) }
            }
        }
        if (l.folders.isEmpty()) Text("A PC nem kínál mappát (Mobile/catalogue/claude.json).", style = Melyviz.small)
    }

    @Composable
    private fun SessionRow(s: ClaudeSession, l: ClaudeList, host: FeatureHost, ctx: Context) {
        Column(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(8.dp).background(if (s.alive) Melyviz.current else Melyviz.faint, CircleShape)
                    .semantics { contentDescription = if (s.alive) "fut" else "leállt" })
                Text(s.name, style = Melyviz.label, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f).padding(start = 8.dp))
            }
            Text("${l.folderName(s.folder)} · ${s.account} fiók · ${TIME.format(Date(s.started))}" + if (!s.alive) " · leállt" else "",
                style = Melyviz.small.copy(fontSize = 10.sp), modifier = Modifier.padding(start = 16.dp))
            Row(Modifier.padding(start = 16.dp, top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (s.url != null) VrgChip("✶ Megnyitás a Claude-ban") { openClaude(ctx, s.url)?.let(host::note) }
                else if (s.alive) Text("a link még nem jött meg…", style = Melyviz.small.copy(color = Melyviz.muted))
                if (s.alive) VrgChip("■ Leállítás") { ClaudeMsgs.stop(s.id)?.let { if (!Relay.send(it)) host.note("Nincs relé kapcsolat.") } }
            }
        }
    }
}
