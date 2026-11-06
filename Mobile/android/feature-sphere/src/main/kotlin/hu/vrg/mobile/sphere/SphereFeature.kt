package hu.vrg.mobile.sphere

import android.app.Application
import android.content.Context
import android.provider.Settings
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.activity.compose.BackHandler
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.NotesApi
import hu.vrg.mobile.core.PutResult
import hu.vrg.mobile.core.Quote
import hu.vrg.mobile.core.RuleHow
import hu.vrg.mobile.core.Rulings
import hu.vrg.mobile.core.Signal
import hu.vrg.mobile.core.SignalType
import hu.vrg.mobile.core.Solomon
import hu.vrg.mobile.core.Sphere
import hu.vrg.mobile.core.SphereDoc
import hu.vrg.mobile.core.SphereMap
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.github.Account
import hu.vrg.mobile.kit.github.GitHub
import hu.vrg.mobile.kit.github.GitHubNotes
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.core.MiniStatus
import hu.vrg.mobile.kit.ui.VrgChip
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import java.io.File
import java.time.LocalDate

// Gömb (WP M14): the three Solomon signals on the phone, as a page to the right of the home screen and as a
// tile. It reads and rules; it never edits a source (docs/solomon/README.md). The data comes from the
// solomon-data branch at most hourly and stays on disk, so the page opens offline with its date showing.
// A ruling is one more line in rulings.jsonl on that branch, which the PC brings home on its next run.

object SphereFeature : VrgFeature {
    override val info = Catalogue.SPHERE

    private lateinit var app: Context
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    val map = MutableStateFlow<SphereMap?>(null)
    val busy = MutableStateFlow(false)
    val problem = MutableStateFlow<String?>(null)

    private val signalsFile get() = File(app.filesDir, "solomon/signals.json")
    private val rulingsFile get() = File(app.filesDir, "solomon/rulings.jsonl")

    override fun init(app: Application) {
        this.app = app
        scope.launch {
            val f = signalsFile
            if (f.exists() && map.value == null) map.value = Sphere.parse(f.readText(), rulingsFile.takeIf { it.exists() }?.readText())
        }
    }

    fun refresh(force: Boolean = false) {
        if (busy.value || !GitHub.signedIn) return
        if (!force && System.currentTimeMillis() - signalsFile.lastModified() < Solomon.REFRESH_MS && map.value != null) return
        busy.value = true
        scope.launch {
            try {
                val signals = GitHubNotes.read(Solomon.SIGNALS, Solomon.BRANCH)
                    ?: throw NotesApi.Problem("Még nincs adat a ${Solomon.BRANCH} branchen.")
                val rulings = GitHubNotes.read(Solomon.RULINGS, Solomon.BRANCH)?.text.orEmpty()
                val next = Sphere.parse(signals.text, rulings) ?: throw NotesApi.Problem("A jelzésfájl nem olvasható.")
                signalsFile.parentFile?.mkdirs()
                signalsFile.writeText(signals.text)
                rulingsFile.writeText(rulings)
                map.value = next
                problem.value = null
            } catch (e: NotesApi.Problem) {
                problem.value = e.message
                VrgLog.w(info.id, "Nem sikerült: ${e.message}")
            } finally { busy.value = false }
        }
    }

    /** Null when the ruling landed, otherwise why not; the reason stays in the box until it does. */
    private suspend fun rule(id: String, how: RuleHow, why: String): String? {
        val r = try { Rulings.send(GitHubNotes, id, how, why, LocalDate.now().toString()) }
        catch (e: NotesApi.Problem) { return e.message }
        return when (r) {
            PutResult.Ok -> {
                while (busy.value) delay(100)      // a refresh already under way read the file before this line
                refresh(force = true)
                null
            }
            is PutResult.Failed -> r.reason
            PutResult.Conflict -> "Ütközés, próbáld újra."
        }
    }

    @Composable
    override fun Screen(host: FeatureHost) = Page(back = host::home, signIn = { host.open(Catalogue.ACCOUNT.id) })

    /** The whole page; the shell shows it beside the home screen too, where [back] scrolls there. */
    @Composable
    fun Page(back: () -> Unit, signIn: () -> Unit) {
        val data by map.collectAsStateWithLifecycle()
        val loading by busy.collectAsStateWithLifecycle()
        val why by problem.collectAsStateWithLifecycle()
        val account by GitHub.account.collectAsStateWithLifecycle()
        val ctx = LocalContext.current
        val still = remember { Settings.Global.getFloat(ctx.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f }
        val spin = remember { Spin(still) }
        var tab by remember { mutableStateOf(0) }
        var layer by remember { mutableStateOf<SignalType?>(null) }
        var chosen by remember { mutableStateOf<String?>(null) }
        LaunchedEffect(account is Account.SignedIn) { refresh() }

        val selected = data?.docs?.firstOrNull { it.path == chosen }
        BackHandler(selected != null) { chosen = null }

        Box(Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize()) {
                Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current),
                            modifier = Modifier.clickable(onClick = back).padding(vertical = 8.dp))
                        Spacer(Modifier.weight(1f))
                        VrgChip(if (loading) "Frissítés…" else "Frissítés", status = if (loading) MiniStatus.running() else null) { refresh(force = true) }
                    }
                    Text("GÖMB", style = Melyviz.title.copy(fontSize = 18.sp))
                    data?.let { Text("${it.docs.size} dokumentum · ${it.generated} · ${it.commit}", style = Melyviz.readout) }
                    if (account !is Account.SignedIn) {
                        Text("A repó privát: GitHub belépés kell a friss adathoz.", style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 6.dp))
                        Row(Modifier.padding(vertical = 6.dp)) { VrgChip("GitHub fiók ›", onClick = signIn) }
                    }
                    why?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 4.dp)) }
                }
                val d = data
                Box(Modifier.weight(1f).fillMaxWidth()) {
                    when {
                        d == null -> Text(if (loading) "Betöltés…" else "Még nincs adat ezen a telefonon.", style = Melyviz.small, modifier = Modifier.padding(16.dp))
                        tab == 0 -> Column(Modifier.fillMaxSize()) {
                            Disc(d, spin, still, selected, layer, { chosen = it?.path }, Modifier.weight(1f).fillMaxWidth())
                            Legend(d, layer) { layer = if (layer == it) null else it }
                        }
                        tab == 1 -> SignalList(d) { s ->
                            d.docs.getOrNull(s.ai ?: -1)?.let { doc -> tab = 0; chosen = doc.path; spin.aimAt(doc.pos) }
                        }
                        else -> SectionList(d)
                    }
                }
                Tabs(tab) { tab = it; chosen = null }
            }
            selected?.let { Card(it, Modifier.align(Alignment.BottomCenter)) { chosen = null } }
        }
    }

    @Composable
    private fun Tabs(tab: Int, onTab: (Int) -> Unit) {
        Row(Modifier.fillMaxWidth()) {
            listOf("Gömb", "Jelzések", "Szakaszok").forEachIndexed { i, n ->
                val on = i == tab
                val line = Melyviz.glow
                Text(n.uppercase(), style = Melyviz.small.copy(letterSpacing = 1.2.sp, color = if (on) Melyviz.glow else Melyviz.faint),
                    modifier = Modifier.weight(1f).clickable { onTab(i) }
                        .drawBehind { if (on) drawLine(line, Offset.Zero, Offset(size.width, 0f), 2.dp.toPx()) }
                        .padding(vertical = 12.dp).padding(horizontal = 6.dp))
            }
        }
    }

    /** The swatch of a signal type: the same marks the dots carry. */
    @Composable
    private fun Mark(t: SignalType) {
        val coral = Melyviz.coral; val sand = Melyviz.sand; val muted = Melyviz.muted
        Canvas(Modifier.size(12.dp)) {
            val r = size.minDimension / 2 - 1.dp.toPx()
            when (t) {
                SignalType.CONTRADICTION -> drawCircle(coral)
                SignalType.DARK -> drawCircle(sand, r, style = Stroke(2.dp.toPx()))
                SignalType.FROZEN -> drawCircle(muted, r, style = Stroke(2.dp.toPx(),
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(2.dp.toPx(), 2.dp.toPx()))))
            }
        }
    }

    @Composable
    private fun Legend(d: SphereMap, layer: SignalType?, onLayer: (SignalType) -> Unit) {
        Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 6.dp, bottom = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            SignalType.entries.forEach { t ->
                val shape = RoundedCornerShape(Melyviz.radiusSmall)
                val on = layer == t
                Column(Modifier.weight(1f).background(if (on) Melyviz.raised else Melyviz.surface, shape)
                    .border(1.dp, if (on) Melyviz.glow else Melyviz.line, shape)
                    .clickable { onLayer(t) }.padding(horizontal = 9.dp, vertical = 7.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Mark(t)
                        Spacer(Modifier.size(7.dp))
                        Text("${d.count(t)}", style = Melyviz.title.copy(fontSize = 17.sp, fontFamily = FontFamily.Monospace, letterSpacing = 0.sp))
                    }
                    Text(t.label, style = Melyviz.small, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }

    @OptIn(ExperimentalLayoutApi::class)
    @Composable
    private fun SignalList(d: SphereMap, onOpen: (Signal) -> Unit) {
        var type by remember { mutableStateOf<SignalType?>(null) }
        val rows = remember(d, type) { d.sorted(type) }
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            item {
                FlowRow(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    VrgChip("Összes", type == null) { type = null }
                    SignalType.entries.forEach { t -> VrgChip(t.label, type == t) { type = t } }
                }
            }
            if (rows.isEmpty()) item { Text("Nincs ilyen jelzés.", style = Melyviz.small) }
            items(rows, key = { it.id }) { s ->
                val shape = RoundedCornerShape(Melyviz.radiusSmall)
                Column(Modifier.fillMaxWidth().background(Melyviz.surface, shape).border(1.dp, Melyviz.lineSoft, shape)
                    .clickable { onOpen(s) }.padding(horizontal = 11.dp, vertical = 9.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Mark(s.type)
                        Spacer(Modifier.size(8.dp))
                        Text(s.title, style = Melyviz.label)
                    }
                    Text(listOfNotNull(s.a?.ref, if (s.ruling != null) "eldöntve" else s.stageLabel ?: s.kind).joinToString(" · "),
                        style = Melyviz.readout.copy(fontSize = 10.sp), modifier = Modifier.padding(top = 3.dp))
                }
            }
            item { Spacer(Modifier.height(8.dp)) }
        }
    }

    @Composable
    private fun SectionList(d: SphereMap) {
        LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            item { Spacer(Modifier.height(8.dp)) }
            items(d.sections, key = { it.id }) { s ->
                val shape = RoundedCornerShape(Melyviz.radiusSmall)
                Column(Modifier.fillMaxWidth().background(Melyviz.surface, shape).border(1.dp, Melyviz.lineSoft, shape).padding(horizontal = 11.dp, vertical = 9.dp)) {
                    Row {
                        Text(s.name, style = Melyviz.label, modifier = Modifier.weight(1f))
                        Text("${s.docs} dok. · ${d.openIn(s.id)} nyitott", style = Melyviz.readout)
                    }
                    Text("Átnézve: ${s.reviewed ?: "még nem"}", style = Melyviz.readout.copy(fontSize = 10.sp), modifier = Modifier.padding(top = 2.dp))
                    s.summary?.let { Text("Gyakornok: $it", style = Melyviz.small, modifier = Modifier.padding(top = 4.dp)) }
                }
            }
            item { Spacer(Modifier.height(8.dp)) }
        }
    }

    @Composable
    private fun Card(d: SphereDoc, modifier: Modifier, onClose: () -> Unit) {
        val high = (LocalConfiguration.current.screenHeightDp * .72f).dp
        Column(modifier.fillMaxWidth().heightIn(max = high).imePadding()
            .background(Melyviz.surface, RoundedCornerShape(topStart = Melyviz.radius, topEnd = Melyviz.radius))
            .border(1.dp, Melyviz.line, RoundedCornerShape(topStart = Melyviz.radius, topEnd = Melyviz.radius))
            .verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 12.dp)) {
            Row {
                Text(d.title, style = Melyviz.title.copy(fontSize = 14.sp, letterSpacing = 0.sp), modifier = Modifier.weight(1f))
                Text("×", style = Melyviz.glyph.copy(color = Melyviz.muted), modifier = Modifier.clickable(onClick = onClose).padding(horizontal = 8.dp))
            }
            Text(listOfNotNull(d.path, d.date, d.cited.takeIf { it > 0 }?.let { "$it hivatkozás" }).joinToString(" · "),
                style = Melyviz.readout.copy(fontSize = 10.sp), modifier = Modifier.padding(top = 3.dp))
            if (d.signals.isEmpty()) Text("Nincs jelzés ezen a dokumentumon.", style = Melyviz.small, modifier = Modifier.padding(top = 10.dp))
            d.signals.sortedBy { it.order }.forEach { Block(it) }
            Spacer(Modifier.height(8.dp))
        }
    }

    @Composable
    private fun Block(s: Signal) {
        Column(Modifier.fillMaxWidth().padding(top = 12.dp)) {
            Spacer(Modifier.fillMaxWidth().height(1.dp).background(Melyviz.line))
            Row(Modifier.padding(top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                Mark(s.type)
                Spacer(Modifier.size(8.dp))
                Text(s.title, style = Melyviz.label)
            }
            Text(s.tag.uppercase(), style = Melyviz.readout.copy(fontSize = 10.sp), modifier = Modifier.padding(top = 3.dp))
            s.a?.let { Quoted(it) }
            s.b?.let { Quoted(it) }
            s.note?.let { Text("Gyakornok: $it", style = Melyviz.small, modifier = Modifier.padding(top = 7.dp)) }
            val done = s.ruling
            if (done != null) {
                Text("${RuleHow.label(done.how)} (${done.date}): ${done.why}", style = Melyviz.label.copy(color = Melyviz.kelp), modifier = Modifier.padding(top = 8.dp))
            } else if (s.rulable) RuleBox(s)
        }
    }

    @Composable
    private fun Quoted(q: Quote) {
        val shape = RoundedCornerShape(8.dp)
        Column(Modifier.fillMaxWidth().padding(top = 7.dp).background(Melyviz.raised, shape).border(1.dp, Melyviz.lineSoft, shape).padding(horizontal = 9.dp, vertical = 8.dp)) {
            Text(q.text, style = Melyviz.label.copy(fontSize = 12.sp))
            Text(q.ref, style = Melyviz.readout.copy(fontSize = 10.sp), modifier = Modifier.padding(top = 5.dp))
        }
    }

    @OptIn(ExperimentalLayoutApi::class)
    @Composable
    private fun RuleBox(s: Signal) {
        var why by remember(s.id) { mutableStateOf("") }
        var note by remember(s.id) { mutableStateOf<String?>(null) }
        var sending by remember { mutableStateOf(false) }
        val scope = rememberCoroutineScope()
        OutlinedTextField(
            value = why, onValueChange = { why = it },
            modifier = Modifier.fillMaxWidth().padding(top = 9.dp),
            placeholder = { Text("Indoklás (kötelező)", style = Melyviz.small) },
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Melyviz.glow, unfocusedBorderColor = Melyviz.line,
                focusedTextColor = Melyviz.ink, unfocusedTextColor = Melyviz.ink, cursorColor = Melyviz.glow,
            ),
        )
        FlowRow(Modifier.padding(top = 7.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            RuleHow.entries.forEach { how ->
                VrgChip(how.label) {
                    if (why.isBlank()) { note = "Előbb az indoklás."; return@VrgChip }
                    if (sending) return@VrgChip
                    sending = true
                    note = "Küldés…"
                    scope.launch {
                        note = rule(s.id, how, why)
                        sending = false
                    }
                }
            }
        }
        note?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 5.dp)) }
    }
}
