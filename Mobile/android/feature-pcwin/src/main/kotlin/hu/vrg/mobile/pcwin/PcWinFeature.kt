package hu.vrg.mobile.pcwin

import android.app.Application
import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.PcFiles
import hu.vrg.mobile.core.PcKind
import hu.vrg.mobile.core.PcListing
import hu.vrg.mobile.core.PcLook
import hu.vrg.mobile.core.PcNote
import hu.vrg.mobile.core.PcRow
import hu.vrg.mobile.core.Route
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.VrgFeature
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

// PC ablakok (WP M23): the VRG Desktop's files window on the phone. With a paired PC whose relay runs with --files, the PC's work
// folders (D-17: Repó, VRG Full, Közös) read-only: browse, a look at a text or an image, and ⇄ Átadásra, which puts a copy on the
// Átadás board (M12), from where the phone takes it like any board file. Nothing on the PC is written, moved or deleted from here.
// The phone sends only handles the relay made, a place key (Munkák, BRIDGE, Workflow Kit from the ◣ menu) or nothing (PcFiles).
// Mail and the feed stay on the PC (D-18); terminal and git are dev level.

object PcWinFeature : VrgFeature {
    override val info = Catalogue.PCWIN

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    val listing = MutableStateFlow<PcListing?>(null)
    val look = MutableStateFlow<PcLook?>(null)
    val busy = MutableStateFlow(false)
    /** The name of the file just put on the board: the screen then offers Átadás ›. */
    val copied = MutableStateFlow<String?>(null)
    private val notes = MutableSharedFlow<String>(extraBufferCapacity = 4)
    /** A place asked for before the link was trusted (from the ◣ menu or Kommand). */
    private var pendingPlace: String? = null
    private var timeout: Job? = null

    override fun init(app: Application) {
        Relay.addCaps(listOf(PcFiles.CAP))
        scope.launch { Relay.incoming.collect(::onMessage) }
    }

    private fun onMessage(raw: String) {
        when (val n = PcFiles.parse(raw) ?: return) {
            is PcNote.Listed -> { done(); look.value = null; listing.value = n.listing }
            is PcNote.Looked -> {
                done()
                if (n.look.ok) look.value = n.look else notes.tryEmit(n.look.reason ?: "A fájl nem olvasható.")
            }
            is PcNote.Copied -> {
                done()
                val c = n.copied
                if (c.ok) { copied.value = c.name; notes.tryEmit("A táblán: ${c.name} (${PcFiles.size(c.bytes)}). Az Átadásban letölthető.") }
                else notes.tryEmit("Nem került a táblára: ${c.reason ?: "?"}")
            }
        }
    }

    private fun done() { timeout?.cancel(); busy.value = false }

    private fun send(msg: String?): Boolean {
        if (msg == null) return false
        if (Relay.trust.value != Trust.TRUSTED || !Relay.send(msg)) { notes.tryEmit("Nincs párosított relé kapcsolat."); return false }
        busy.value = true
        timeout?.cancel()
        timeout = scope.launch { delay(15_000); busy.value = false }
        return true
    }

    fun go(h: String?) { copied.value = null; send(PcFiles.list(h)) }
    private fun lookAt(r: PcRow) { copied.value = null; send(PcFiles.read(r.h)) }
    private fun copy(h: String) { send(PcFiles.copy(h)) }

    /** pcwin/<place>: a Desktop unit's folder (Mobile/catalogue/files.json → places). */
    override fun open(route: Route): Boolean {
        val place = route.path.takeIf { it in PcFiles.PLACES } ?: return route.path.isEmpty()
        if (Relay.trust.value == Trust.TRUSTED) { pendingPlace = null; send(PcFiles.list(place = place)) } else pendingPlace = place
        return true
    }

    /** ‹ one step: the look closes, then the folder goes up, then the roots. False at the roots (the shell takes Back). */
    private fun back(): Boolean {
        if (look.value != null) { look.value = null; return true }
        val l = listing.value ?: return false
        if (l.atRoots || !l.ok) return false
        go(l.up)
        return true
    }

    // ---- the screen ---------------------------------------------------------------------------------------------------

    @Composable
    override fun Screen(host: FeatureHost) {
        val now by listing.collectAsStateWithLifecycle()
        val seen by look.collectAsStateWithLifecycle()
        val loading by busy.collectAsStateWithLifecycle()
        val onBoard by copied.collectAsStateWithLifecycle()
        val link by Relay.state.collectAsStateWithLifecycle()
        val trust by Relay.trust.collectAsStateWithLifecycle()
        val pc by Relay.pc.collectAsStateWithLifecycle()
        LaunchedEffect(trust) {
            if (trust == Trust.TRUSTED) {
                val p = pendingPlace
                pendingPlace = null
                if (p != null) send(PcFiles.list(place = p)) else if (listing.value?.ok != true) go(null)
            }
        }
        LaunchedEffect(Unit) { notes.collect { host.note(it) } }

        Column(Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current), modifier = Modifier.clickable { if (!back()) host.home() }.padding(vertical = 8.dp))
                Text(if (loading) "  olvasás…" else "", style = Melyviz.small)
            }
            Text("PC ABLAKOK", style = Melyviz.title.copy(fontSize = 18.sp))
            pc?.let { Text("${it.name} · csak olvasva", style = Melyviz.readout, modifier = Modifier.padding(top = 2.dp)) }
            when {
                link != LinkState.OPEN -> Gate("Nincs relé kapcsolat. Indítsd a relét a PC-n (Mobile\\mobile.cmd relay), és párosítsd a telefont.", host)
                trust == Trust.CHECKING -> Text("Azonosítás…", style = Melyviz.small, modifier = Modifier.padding(top = 8.dp))
                trust != Trust.TRUSTED -> Gate("Ez a telefon nincs párosítva ezzel a PC-vel: a PC mappáit csak párosított telefon látja.", host)
                seen != null -> Look(seen!!, onBoard, host)
                else -> {
                    val l = now
                    when {
                        l == null -> Text(if (loading) "Olvasás…" else "—", style = Melyviz.small, modifier = Modifier.padding(top = 8.dp))
                        !l.ok -> {
                            Text(l.reason ?: "A relé elutasította.", style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 8.dp))
                            Row(Modifier.padding(vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                VrgChip("⟳ Gyökerek") { go(null) }
                            }
                        }
                        else -> Folder(l)
                    }
                }
            }
        }
    }

    @Composable
    private fun Gate(text: String, host: FeatureHost) {
        Text(text, style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 8.dp))
        Row(Modifier.padding(vertical = 6.dp)) { VrgChip("QR párosítás ›") { host.open(Catalogue.PAIR.id) } }
    }

    private val TIME = SimpleDateFormat("yyyy.MM.dd. HH:mm", Locale.ROOT)

    @Composable
    private fun ColumnScope.Folder(l: PcListing) {
        // the crumbs: each one a step back up
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("⌂", style = Melyviz.label.copy(color = Melyviz.current), modifier = Modifier.clickable { go(null) }.padding(end = 6.dp))
            l.crumbs.forEachIndexed { i, c ->
                Text(" / ", style = Melyviz.small)
                Text(c.name, style = Melyviz.label.copy(color = if (i == l.crumbs.lastIndex) Melyviz.ink else Melyviz.current),
                    modifier = Modifier.clickable { if (i != l.crumbs.lastIndex) go(c.h) })
            }
        }
        Column(Modifier.fillMaxWidth().weight(1f).background(Melyviz.surface, RoundedCornerShape(Melyviz.radius))
            .border(1.dp, Melyviz.lineSoft, RoundedCornerShape(Melyviz.radius)).verticalScroll(rememberScrollState())) {
            if (l.entries.isEmpty()) Text(if (l.atRoots) "A PC nem kínál munkamappát (Mobile/catalogue/files.json)." else "Üres mappa.",
                style = Melyviz.small, modifier = Modifier.padding(12.dp))
            l.entries.forEach { r -> RowLine(r) }
            if (l.truncated) Text("… az első ${l.entries.size} elem; a többit a PC-n nézd meg.", style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(12.dp))
        }
        Text("Csak olvasás: a telefonról a PC-n semmi sem íródik, mozdul vagy törlődik. Fájlt a ⇄ Átadásra visz át.",
            style = Melyviz.small.copy(fontSize = 10.sp, color = Melyviz.faint), modifier = Modifier.padding(vertical = 8.dp))
    }

    @Composable
    private fun RowLine(r: PcRow) {
        Column(Modifier.fillMaxWidth().clickable { if (r.dir) go(r.h) else lookAt(r) }.padding(horizontal = 12.dp, vertical = 8.dp)) {
            Text((if (r.dir) "▸ " else "  ") + r.name, style = Melyviz.label.copy(color = if (r.dir) Melyviz.current else Melyviz.ink),
                maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (!r.dir) Text("${PcFiles.size(r.bytes)} · ${TIME.format(Date(r.mtime))}", style = Melyviz.small.copy(fontSize = 10.sp), modifier = Modifier.padding(start = 16.dp))
        }
    }

    @Composable
    private fun ColumnScope.Look(f: PcLook, onBoard: String?, host: FeatureHost) {
        Column(Modifier.fillMaxWidth().weight(1f).padding(top = 8.dp)) {
            Text(f.name, style = Melyviz.label.copy(color = Melyviz.ink), maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(PcFiles.size(f.size) + (if (f.encoding != null && f.encoding != "utf-8") " · ${f.encoding}" else "") +
                (if (f.truncated) " · az eleje" else ""), style = Melyviz.small.copy(fontSize = 10.sp))
            Row(Modifier.padding(vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                VrgChip("‹ Mappa") { look.value = null }
                if (f.h != null) VrgChip("⇄ Átadásra") { copy(f.h!!) }
                if (onBoard != null) VrgChip("Átadás ›") { host.open(Catalogue.DROP.id) }
            }
            Column(Modifier.fillMaxWidth().weight(1f).background(Melyviz.surface, RoundedCornerShape(Melyviz.radius))
                .border(1.dp, Melyviz.lineSoft, RoundedCornerShape(Melyviz.radius)).padding(10.dp)) {
                when (f.kind) {
                    PcKind.TEXT -> Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).horizontalScroll(rememberScrollState())) {
                        Text(f.text ?: "", style = Melyviz.readout.copy(color = Melyviz.ink, fontSize = 11.sp))
                    }
                    PcKind.IMAGE -> {
                        val bmp = remember(f.data) {
                            runCatching { Base64.decode(f.data, Base64.DEFAULT).let { BitmapFactory.decodeByteArray(it, 0, it.size) } }.getOrNull()
                        }
                        if (bmp != null) Image(bmp.asImageBitmap(), f.name, Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
                        else Text("A kép nem rajzolható ki. ⇄ Átadásra, és a telefonon nyisd meg.", style = Melyviz.small)
                    }
                    PcKind.BINARY -> Text("Ezt a fájlt a telefon nem mutatja (bináris vagy túl nagy). ⇄ Átadásra, és az Átadásból a telefonon nyílik.",
                        style = Melyviz.small)
                }
            }
        }
    }

}
