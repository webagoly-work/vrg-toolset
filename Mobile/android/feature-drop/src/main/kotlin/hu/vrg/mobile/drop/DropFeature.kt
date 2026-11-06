package hu.vrg.mobile.drop

import android.Manifest
import android.app.Application
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.Drop
import hu.vrg.mobile.core.DropEntry
import hu.vrg.mobile.core.DropFrom
import hu.vrg.mobile.core.DropList
import hu.vrg.mobile.core.DropMsgs
import hu.vrg.mobile.core.DropNote
import hu.vrg.mobile.core.DropTarget
import hu.vrg.mobile.core.DropTicket
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.files.FileStore
import hu.vrg.mobile.kit.relay.LinkState
import hu.vrg.mobile.kit.relay.Relay
import hu.vrg.mobile.kit.relay.Trust
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.ui.VrgSectionTitle
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okio.BufferedSink
import java.io.File
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import java.util.concurrent.TimeUnit

// Átadás (WP M12): the relay's file board on the phone. Files and photos go to the PC (onto the board,
// or for the Planner / the Inventory), the board's files come down into Letöltések (Képek for a
// picture), and the clipboard goes both ways. One transfer at a time; each one asks the relay for a
// one-transfer ticket first, which travels in a header. The rules are kit-core's Drop.kt; the relay's
// side is relay-board.js.

object DropFeature : VrgFeature {
    override val info = Catalogue.DROP
    private const val TAG = "drop"
    private const val LIST_TIMEOUT_MS = 15_000L
    private const val TICKET_TIMEOUT_MS = 10_000L
    private const val TRUST_WAIT_MS = 15_000L
    private const val FOLDER = "VRG"

    /** A transfer on screen: what, which way, how far. */
    data class Transfer(val name: String, val up: Boolean, val done: Long, val total: Long)

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var app: Application
    private val http = OkHttpClient.Builder()
        .connectTimeout(4, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    val list = MutableStateFlow<DropList?>(null)
    val busy = MutableStateFlow(false)
    val target = MutableStateFlow(DropTarget.INBOX)
    val transfer = MutableStateFlow<Transfer?>(null)
    /** Transfers waiting behind the current one. */
    val waiting = MutableStateFlow(0)
    private val notes = MutableSharedFlow<String>(extraBufferCapacity = 8)
    private val one = Mutex()
    private var ticketWait: CompletableDeferred<DropTicket>? = null
    private var timeout: Job? = null

    override fun init(app: Application) {
        this.app = app
        Relay.addCaps(listOf(Drop.CAP))
        scope.launch { Relay.incoming.collect(::onMessage) }
    }

    private fun note(text: String) { notes.tryEmit(text) }

    private fun onMessage(raw: String) {
        when (val n = DropMsgs.parse(raw) ?: return) {
            is DropNote.Listed -> {
                timeout?.cancel()
                busy.value = false
                list.value = n.list
                if (!n.list.ok) VrgLog.w(TAG, "Lista: ${n.list.reason ?: "elutasítva"}")
            }
            is DropNote.Ticket -> ticketWait?.complete(n.ticket)
            is DropNote.Removed -> if (!n.result.ok) note("Nem sikerült levenni: ${n.result.reason ?: "?"}")
            is DropNote.Event -> {
                val e = n.event.entry
                list.value?.let { l ->
                    val rest = l.entries.filter { it.id != e.id }
                    list.value = l.copy(entries = if (n.event.added) listOf(e) + rest else rest)
                }
                if (n.event.added && e.from == DropFrom.PC) note("Új a táblán: ${e.name}")
            }
            is DropNote.Clip -> onClip(n)
        }
    }

    private fun onClip(n: DropNote.Clip) {
        val c = n.clip
        if (!c.ok) { note("Vágólap: ${c.reason ?: "?"}"); return }
        if (c.op == "clip.set") { note("A szöveg a PC vágólapján."); return }
        val text = c.text ?: ""
        if (text.isEmpty()) { note("A PC vágólapján nincs szöveg."); return }
        scope.launch(Dispatchers.Main) {
            val cm = app.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            cm.setPrimaryClip(ClipData.newPlainText("PC vágólap", text))
            note("A PC vágólapja a telefonon (${text.length} karakter)" + if (c.truncated) ", levágva." else ".")
        }
    }

    fun refresh() {
        if (busy.value || Relay.trust.value != Trust.TRUSTED) return
        busy.value = true
        if (!Relay.send(DropMsgs.list())) { busy.value = false; return }
        timeout?.cancel()
        timeout = scope.launch {
            delay(LIST_TIMEOUT_MS)
            if (busy.value) { busy.value = false; note("A relé nem válaszolt a listára.") }
        }
    }

    /** A trusted link, waiting a little for one: a share can start the app cold, before the relay answers. */
    private suspend fun trusted(): Boolean =
        Relay.trust.value == Trust.TRUSTED || withTimeoutOrNull(TRUST_WAIT_MS) { Relay.trust.first { it == Trust.TRUSTED } } != null

    private suspend fun ticket(msg: String): DropTicket? {
        val d = CompletableDeferred<DropTicket>()
        ticketWait = d
        try {
            if (!Relay.send(msg)) return null
            return withTimeoutOrNull(TICKET_TIMEOUT_MS) { d.await() }
        } finally { ticketWait = null }
    }

    // ---- to the PC -------------------------------------------------------------------------------

    /** A file staged in the app's cache: copied once, so the share's permission may end, and hashed on the way. */
    private class Staged(val file: File, val name: String, val bytes: Long, val sha: String)

    private fun stageDir(): File = File(FileStore.cacheDir(app, "drop/out"), UUID.randomUUID().toString()).apply { mkdirs() }

    private fun displayName(uri: Uri): String? = try {
        app.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) c.getString(0) else null
        }
    } catch (e: Exception) { null }

    /** Null (with a note) when it cannot be read or is over the 50 MB limit. */
    private fun stage(open: () -> java.io.InputStream?, rawName: String): Staged? {
        val name = Drop.cleanName(rawName)
        val dir = stageDir()
        val out = File(dir, name)
        val md = MessageDigest.getInstance("SHA-256")
        var n = 0L
        try {
            val input = open() ?: run { note("Nem olvasható: $name"); dir.deleteRecursively(); return null }
            input.use { i ->
                out.outputStream().use { o ->
                    val buf = ByteArray(64 * 1024)
                    while (true) {
                        val k = i.read(buf)
                        if (k < 0) break
                        n += k
                        if (n > Drop.MAX_BYTES) { note("Túl nagy: $name (legfeljebb 50 MB)."); dir.deleteRecursively(); return null }
                        o.write(buf, 0, k); md.update(buf, 0, k)
                    }
                }
            }
        } catch (e: Exception) { note("Nem olvasható: $name"); dir.deleteRecursively(); return null }
        return Staged(out, name, n, Drop.hex(md.digest()))
    }

    /** From the share sheet or the picker. */
    fun send(uris: List<Uri>, to: DropTarget = target.value) {
        if (uris.isEmpty()) return
        waiting.value += uris.size
        scope.launch {
            for (u in uris) {
                val s = stage({ app.contentResolver.openInputStream(u) }, displayName(u) ?: u.lastPathSegment ?: "fajl")
                if (s == null) { waiting.value -= 1; continue }
                upload(s, to)
            }
        }
    }

    /** A photo the camera wrote into the cache. */
    private fun sendPhoto(f: File, to: DropTarget) {
        waiting.value += 1
        scope.launch {
            val s = stage({ f.inputStream() }, f.name)
            f.delete()
            if (s == null) { waiting.value -= 1; return@launch }
            upload(s, to)
        }
    }

    /** "Megosztás → PC-re" from another app: files go to the board, text to the PC's clipboard. */
    fun share(uris: List<Uri>, text: String?) {
        if (uris.isNotEmpty()) { send(uris); return }
        if (!text.isNullOrEmpty()) scope.launch {
            if (!trusted()) { note("A vágólaphoz párosított PC kell."); return@launch }
            val m = DropMsgs.clipSet(text) ?: run { note("Túl hosszú szöveg."); return@launch }
            if (!Relay.send(m)) note("Nincs relé kapcsolat.")
        }
    }

    private class ProgressBody(val f: File, val onProgress: (Long) -> Unit) : RequestBody() {
        override fun contentType() = "application/octet-stream".toMediaType()
        override fun contentLength() = f.length()
        override fun writeTo(sink: BufferedSink) {
            var done = 0L
            f.inputStream().use { i ->
                val buf = ByteArray(64 * 1024)
                while (true) {
                    val k = i.read(buf)
                    if (k < 0) break
                    sink.write(buf, 0, k)
                    done += k
                    onProgress(done)
                }
            }
        }
    }

    private suspend fun upload(s: Staged, to: DropTarget) = one.withLock {
        waiting.value = (waiting.value - 1).coerceAtLeast(0)
        try {
            if (!trusted()) { note("Nem ment át: ${s.name}: ehhez párosított PC kell."); return@withLock }
            val url = Drop.uploadUrl(Relay.url, s.name, s.sha, to) ?: run { note("Hibás relé cím."); return@withLock }
            val t = ticket(DropMsgs.ticketUpload())
            if (t == null || !t.ok || t.ticket == null) { note("Nem ment át: ${s.name}: ${t?.reason ?: "a relé nem adott jegyet."}"); return@withLock }
            transfer.value = Transfer(s.name, true, 0, s.bytes)
            val req = Request.Builder().url(url).header(Drop.TICKET_HEADER, t.ticket!!)
                .post(ProgressBody(s.file) { d -> transfer.value = Transfer(s.name, true, d, s.bytes) }).build()
            try {
                http.newCall(req).execute().use { r ->
                    val u = DropMsgs.uploaded(r.code, r.body?.string())
                    note(Drop.uploadedText(u))
                    if (!u.ok) VrgLog.w(TAG, "Feltöltés: ${s.name}: ${u.reason}")
                }
            } catch (e: Exception) {
                VrgLog.w(TAG, "Feltöltés megszakadt: ${s.name}: ${e.message}")
                note("Megszakadt: ${s.name}. A PC-n nem marad belőle fél fájl; küldd újra.")
            }
        } finally {
            transfer.value = null
            s.file.parentFile?.deleteRecursively()
        }
    }

    // ---- from the PC -----------------------------------------------------------------------------

    fun download(e: DropEntry) {
        scope.launch {
            one.withLock {
                val url = Drop.fileUrl(Relay.url, e.id) ?: run { note("Hibás relé cím."); return@withLock }
                val t = ticket(DropMsgs.ticketDownload(e.id) ?: return@withLock)
                if (t == null || !t.ok || t.ticket == null) { note("Nem jött le: ${e.name}: ${t?.reason ?: "a relé nem adott jegyet."}"); return@withLock }
                val dir = File(FileStore.cacheDir(app, "drop/in"), UUID.randomUUID().toString())
                transfer.value = Transfer(e.name, false, 0, e.bytes)
                try {
                    val got = FileStore.download(url, File(dir, Drop.cleanName(e.name)), mapOf(Drop.TICKET_HEADER to t.ticket!!)) { d, _ ->
                        transfer.value = Transfer(e.name, false, d, e.bytes)
                    }
                    when {
                        got == null -> note("Nem jött le: ${e.name} (megszakadt).")
                        Drop.validSha(e.sha256) && got.sha256 != e.sha256 -> note("Sérülten jött le, nem mentettem: ${e.name}")
                        else -> {
                            val where = FileStore.saveShared(app, got.file, Drop.cleanName(e.name), Drop.mimeOf(e.name), FOLDER)
                            note(if (where != null) "Elmentve: $where" else "A mentés nem sikerült: ${e.name}")
                        }
                    }
                } finally {
                    transfer.value = null
                    dir.deleteRecursively()
                }
            }
        }
    }

    fun remove(e: DropEntry) {
        val m = DropMsgs.remove(e.id) ?: return
        if (!Relay.send(m)) note("Nincs relé kapcsolat.")
    }

    // ---- the clipboard ---------------------------------------------------------------------------

    private fun clipToPc(ctx: Context) {
        val cm = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val text = cm.primaryClip?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.coerceToText(ctx)?.toString().orEmpty()
        if (text.isEmpty()) { note("A telefon vágólapján nincs szöveg."); return }
        val m = DropMsgs.clipSet(text) ?: run { note("Túl hosszú szöveg (legfeljebb ${Drop.CLIP_MAX} karakter)."); return }
        if (!Relay.send(m)) note("Nincs relé kapcsolat.")
    }

    private fun clipFromPc() { if (!Relay.send(DropMsgs.clipGet())) note("Nincs relé kapcsolat.") }

    // ---- the screen ------------------------------------------------------------------------------

    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    override fun Screen(host: FeatureHost) {
        val now by list.collectAsStateWithLifecycle()
        val loading by busy.collectAsStateWithLifecycle()
        val link by Relay.state.collectAsStateWithLifecycle()
        val trust by Relay.trust.collectAsStateWithLifecycle()
        val pc by Relay.pc.collectAsStateWithLifecycle()
        LaunchedEffect(trust) { if (trust == Trust.TRUSTED) refresh() }
        LaunchedEffect(Unit) { notes.collect { host.note(it) } }

        PullToRefreshBox(isRefreshing = loading, onRefresh = { refresh() }, modifier = Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
                Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current),
                    modifier = Modifier.clickable { host.home() }.padding(vertical = 8.dp))
                Text("ÁTADÁS", style = Melyviz.title.copy(fontSize = 18.sp))
                pc?.let { Text("${it.name} · ${Relay.url.removePrefix("ws://")}", style = Melyviz.readout) }

                when {
                    link != LinkState.OPEN -> Gate("Nincs relé kapcsolat. Indítsd a relét a PC-n, és párosítsd a telefont.", host)
                    trust == Trust.CHECKING -> Text("Azonosítás…", style = Melyviz.small, modifier = Modifier.padding(top = 8.dp))
                    trust != Trust.TRUSTED -> Gate("Ez a telefon nincs párosítva ezzel a PC-vel: a táblát csak párosított telefon látja.", host)
                    else -> Body(now, loading, host)
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

    private fun stamp(): String = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.ROOT).format(Date())

    @Composable
    private fun Body(l: DropList?, loading: Boolean, host: FeatureHost) {
        val ctx = LocalContext.current
        val to by target.collectAsStateWithLifecycle()
        val moving by transfer.collectAsStateWithLifecycle()
        val queue by waiting.collectAsStateWithLifecycle()
        var camPath by rememberSaveable { mutableStateOf<String?>(null) }

        val pick = rememberLauncherForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris -> send(uris, target.value) }
        val shoot = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
            val f = camPath?.let(::File)
            camPath = null
            if (ok && f != null && f.length() > 0) sendPhoto(f, DropTarget.PLANNER) else f?.delete()
        }
        fun startCamera() {
            val f = File(FileStore.cacheDir(ctx, "drop/cam"), "IMG_${stamp()}.jpg")
            camPath = f.absolutePath
            try { shoot.launch(FileStore.uri(ctx, f)) } catch (e: Exception) { camPath = null; host.note("Nincs kamera alkalmazás.") }
        }
        val askCamera = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
            if (ok) startCamera() else host.note("A fotóhoz kamera engedély kell.")
        }

        VrgSectionTitle("A PC-re")
        Text("Cél", style = Melyviz.small)
        Row(Modifier.padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for (t in DropTarget.entries) VrgChip(t.label, selected = t == to) { target.value = t }
        }
        Row(Modifier.padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            VrgChip("📎 Fájlok") { pick.launch("*/*") }
            VrgChip("📷 Fotó a Plannerbe") {
                if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) startCamera()
                else askCamera.launch(Manifest.permission.CAMERA)
            }
        }
        Text("Más alkalmazásból: Megosztás → PC-re. Legfeljebb 50 MB fájlonként.", style = Melyviz.small.copy(color = Melyviz.faint))

        moving?.let { m ->
            Column(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                Text((if (m.up) "⇡ " else "⇣ ") + m.name + if (queue > 0) "  (+$queue vár)" else "",
                    style = Melyviz.small, maxLines = 1, overflow = TextOverflow.Ellipsis)
                LinearProgressIndicator(
                    progress = { if (m.total > 0) (m.done.toFloat() / m.total).coerceIn(0f, 1f) else 0f },
                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp), color = Melyviz.glow, trackColor = Melyviz.line,
                )
                Text("${Drop.sizeText(m.done)} / ${Drop.sizeText(m.total)}", style = Melyviz.readout.copy(fontSize = 11.sp))
            }
        }

        VrgSectionTitle("Vágólap")
        Row(Modifier.padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            VrgChip("⇡ A telefoné a PC-re") { clipToPc(ctx) }
            VrgChip("⇣ A PC-é ide") { clipFromPc() }
        }

        VrgSectionTitle("A táblán")
        when {
            l == null -> Text(if (loading) "A tábla olvasása…" else "Húzd le a frissítéshez.", style = Melyviz.small)
            !l.ok -> {
                Text(l.reason ?: "A relé elutasította.", style = Melyviz.small.copy(color = Melyviz.sand))
                if (!l.trusted) Row(Modifier.padding(vertical = 6.dp)) { VrgChip("QR párosítás ›") { host.open(Catalogue.PAIR.id) } }
            }
            l.entries.isEmpty() -> Text("Üres. A PC-n: http://localhost:47291/board", style = Melyviz.small)
            else -> for (e in l.entries) EntryRow(e, moving != null)
        }
        Text("A levett fájl a PC-n a tábla _removed mappájába kerül, nem törlődik.", style = Melyviz.small.copy(color = Melyviz.faint),
            modifier = Modifier.padding(top = 8.dp))
    }

    @Composable
    private fun EntryRow(e: DropEntry, moving: Boolean) {
        val from = if (e.from == DropFrom.PHONE) "telefon" else "PC"
        Column(
            Modifier.fillMaxWidth().padding(vertical = 4.dp).clip(RoundedCornerShape(12.dp)).background(Melyviz.surface).padding(10.dp)
                .semantics { contentDescription = "${e.name}, ${Drop.sizeText(e.bytes)}, $from" },
        ) {
            Text(e.name, style = Melyviz.label, maxLines = 2, overflow = TextOverflow.Ellipsis)
            val meta = listOfNotNull(Drop.sizeText(e.bytes), from, Drop.localTime(e.at).takeIf { it.isNotBlank() },
                e.target.takeIf { it != DropTarget.INBOX }?.label)
            Text(meta.joinToString(" · "), style = Melyviz.readout.copy(fontSize = 11.sp))
            Row(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                VrgChip(if (moving) "⇣ Letöltés (vár)" else "⇣ Letöltés") { download(e) }
                VrgChip("Levétel") { remove(e) }
            }
        }
    }
}
