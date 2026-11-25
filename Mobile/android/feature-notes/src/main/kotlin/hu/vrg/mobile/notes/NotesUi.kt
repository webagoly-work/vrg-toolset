package hu.vrg.mobile.notes

import android.content.ActivityNotFoundException
import android.content.Intent
import android.speech.RecognizerIntent
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.DeviceTrust
import hu.vrg.mobile.core.NoteFilter
import hu.vrg.mobile.core.NoteSeal
import hu.vrg.mobile.core.NoteSync
import hu.vrg.mobile.core.NoteView
import hu.vrg.mobile.core.Notebook
import hu.vrg.mobile.core.VNote
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.github.Account
import hu.vrg.mobile.kit.github.GitHub
import hu.vrg.mobile.kit.notes.Notes
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.ui.VrgSectionTitle
import hu.vrg.mobile.kit.ui.VrgToggle
import java.text.SimpleDateFormat
import java.time.ZoneId
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.launch

// VRG Jegyzetek's screens (WP M69): the list, one note, and ⚙ (the version, its modules, the sync, the origins).
// What shows is decided by the modules the chosen version switches on (Notes.enabled(), kit-core NotesKit.enabled):
// a module that is off leaves no trace on screen, so Egyszerű really is just notes.

private sealed interface Page {
    data object List : Page
    data class Edit(val id: String) : Page
    data object Settings : Page
}

private fun color(hex: String?, fallback: Color): Color =
    try { if (hex.isNullOrBlank()) fallback else Color(android.graphics.Color.parseColor(hex)) } catch (e: Exception) { fallback }

@Composable
private fun fieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = Melyviz.glow, unfocusedBorderColor = Melyviz.line,
    focusedTextColor = Melyviz.ink, unfocusedTextColor = Melyviz.ink, cursorColor = Melyviz.glow,
)

@Composable
private fun rememberDictation(onText: (String) -> Unit): () -> Boolean {
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        val said = r.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()
        if (!said.isNullOrBlank()) onText(said)
    }
    return {
        val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "hu-HU")
            .putExtra(RecognizerIntent.EXTRA_PROMPT, "Mondd a jegyzetet")
        try { launcher.launch(i); true } catch (e: ActivityNotFoundException) { false }
    }
}

@Composable
fun NotesApp(host: FeatureHost) {
    var page by remember { mutableStateOf<Page>(Page.List) }
    val pending by NotesFeature.openNote.collectAsStateWithLifecycle()
    LaunchedEffect(pending) {
        pending?.let { id -> if (Notes.note(id) != null) page = Page.Edit(id); NotesFeature.openNote.value = null }
    }
    BackHandler(page != Page.List) { page = Page.List }
    Column(Modifier.fillMaxSize().background(Melyviz.water)) {
        when (val p = page) {
            Page.List -> NoteList(host, onOpen = { page = Page.Edit(it) }, onSettings = { page = Page.Settings })
            is Page.Edit -> NoteEditor(host, p.id, onBack = { page = Page.List })
            Page.Settings -> NotesSettings(host, onBack = { page = Page.List })
        }
    }
}

// ---- the list ----------------------------------------------------------------------------------------------------

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun NoteList(host: FeatureHost, onOpen: (String) -> Unit, onSettings: () -> Unit) {
    val all by Notes.all.collectAsStateWithLifecycle()
    val profileId by Notes.profile.collectAsStateWithLifecycle()
    val overrides by Notes.overrides.collectAsStateWithLifecycle()
    val pre by NotesFeature.draft.collectAsStateWithLifecycle()
    val why by NotesFeature.problem.collectAsStateWithLifecycle()
    val sync by NotesFeature.syncStatus.collectAsStateWithLifecycle()
    val kit = Notes.kit
    val on = remember(profileId, overrides) { kit.enabled(profileId, overrides) }
    val profile = kit.profile(profileId)
    val zone = ZoneId.systemDefault()

    var filter by remember { mutableStateOf(NoteFilter()) }
    var quick by rememberSaveable { mutableStateOf("") }
    var quickFrom by rememberSaveable { mutableStateOf("gyors") }
    LaunchedEffect(pre) {
        pre?.let { (t, from) -> quick = if (quick.isBlank()) t else "$quick\n$t"; quickFrom = from; NotesFeature.draft.value = null }
    }
    val dictate = rememberDictation { said -> quick = if (quick.isBlank()) said else "$quick $said" }

    val shown = remember(all, filter) { Notebook.list(all, filter) }
    val waiting = all.count { it.dirty }

    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        item {
            Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current),
                    modifier = Modifier.heightIn(min = 48.dp).clickable(role = Role.Button) { host.home() }.wrapContentHeight().padding(end = 12.dp))
                Text("JEGYZETEK", style = Melyviz.title.copy(fontSize = 18.sp), modifier = Modifier.weight(1f))
                VrgChip(profile.sym + " " + profile.name) { onSettings() }
                Spacer(Modifier.width(6.dp))
                VrgChip("⚙", status = sync) { onSettings() }
            }
            if (why != null || waiting > 0) {
                Text((why ?: "") + (if (waiting > 0) (if (why != null) " · " else "") + "$waiting változás vár szinkronra" else ""),
                    style = Melyviz.small.copy(color = if (why != null) Melyviz.sand else Melyviz.muted), modifier = Modifier.padding(top = 2.dp))
            }

            if ("gyors" in on || pre != null) {
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = quick, onValueChange = { quick = it }, modifier = Modifier.fillMaxWidth().heightIn(min = 56.dp),
                    placeholder = { Text("Gyorsjegyzet: mi jutott eszedbe?", style = Melyviz.small) }, colors = fieldColors(),
                )
                Row(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    VrgChip("Mentés", selected = quick.isNotBlank()) {
                        if (quick.isNotBlank()) {
                            NotesFeature.quick(quick, quickFrom); quick = ""; quickFrom = "gyors"
                            host.note(if ("naplo" in on) "Jegyzet mentve, a projektnaplóba is megy." else "Jegyzet mentve.")
                        }
                    }
                    if ("diktalas" in on) VrgChip("🎤 Diktálás") { if (!dictate()) host.note("Nincs beszédfelismerő ezen a telefonon.") }
                }
            }

            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = filter.query, onValueChange = { filter = filter.copy(query = it) }, singleLine = true,
                modifier = Modifier.fillMaxWidth(), placeholder = { Text("⌕ Keresés", style = Melyviz.small) }, colors = fieldColors(),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search), keyboardActions = KeyboardActions(),
            )

            FlowRow(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                val unread = Notebook.unread(all)
                listOfNotNull(
                    NoteView.ALL to "Mind", NoteView.PINNED to "📌 Kitűzött",
                    if ("beerkezo" in on) NoteView.INBOX to ("⇣ Beérkező" + if (unread > 0) " · $unread" else "") else null,
                    NoteView.ARCHIVE to "Archívum", NoteView.TRASH to "Kuka",
                ).forEach { (v, label) -> VrgChip(label, filter.view == v) { filter = filter.copy(view = v) } }
            }

            val origins = Notebook.origins(all).filter { it.first != Notebook.HERE }
            if (origins.isNotEmpty()) FlowRow(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                origins.forEach { (o, n) ->
                    val src = kit.origin(o)
                    VrgChip((src?.sym ?: "•") + " " + (src?.label ?: o) + " · $n", filter.origin == o) {
                        filter = filter.copy(origin = if (filter.origin == o) null else o)
                    }
                }
            }
            if ("fuzetek" in on) {
                val books = Notebook.books(all)
                if (books.isNotEmpty()) FlowRow(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    books.forEach { b -> VrgChip("▤ $b", filter.book == b) { filter = filter.copy(book = if (filter.book == b) null else b) } }
                }
            }
            val tags = Notebook.tags(all).take(14)
            if (tags.isNotEmpty()) FlowRow(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                tags.forEach { (t, _) -> VrgChip("#$t", filter.tag == t) { filter = filter.copy(tag = if (filter.tag == t) null else t) } }
            }

            FlowRow(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                VrgChip("+ Új jegyzet", selected = true) {
                    var id = ""
                    Notes.change { ns -> Notebook.create(ns, System.currentTimeMillis(), Notes.device, book = filter.book,
                        tags = listOfNotNull(filter.tag)).also { id = it.second.id }.first }
                    onOpen(id)
                }
                if ("napi" in on) VrgChip("☀ Mai jegyzet") {
                    var id = ""
                    Notes.change { ns -> Notebook.daily(ns, System.currentTimeMillis(), zone, Notes.device).also { id = it.second.id }.first }
                    onOpen(id)
                }
                if ("sablonok" in on) kit.templatesFor(profileId).forEach { t ->
                    VrgChip(t.sym + " " + t.label) {
                        var id = ""
                        Notes.change { ns -> Notebook.fromTemplate(ns, t, System.currentTimeMillis(), zone, Notes.device).also { id = it.second.id }.first }
                        onOpen(id)
                    }
                }
                if (filter.view == NoteView.TRASH && shown.isNotEmpty()) VrgChip("Kuka ürítése") {
                    Notes.change { Notebook.purgeTrash(it, System.currentTimeMillis()) }
                    host.note("A kuka üres.")
                }
            }
            Spacer(Modifier.height(10.dp))
            if (shown.isEmpty()) Text(
                when {
                    all.none { it.live } -> "Még nincs jegyzet. Írj egyet, vagy a Sketcher Jegyzet frontja is ide gyűjt."
                    else -> "Nincs ilyen jegyzet."
                }, style = Melyviz.small, modifier = Modifier.padding(vertical = 12.dp),
            )
        }
        items(shown, key = { it.id }) { n -> NoteRow(n, cards = profile.list == "kartyak", showTasks = "lista" in on) { onOpen(n.id) } }
        item { Spacer(Modifier.height(32.dp)) }
    }
}

private val TIME = SimpleDateFormat("MM.dd. HH:mm", Locale("hu"))

@Composable
private fun OriginBadge(n: VNote) {
    val g = n.origin ?: return
    val src = Notes.kit.origin(g.app)
    val c = color(src?.color, Melyviz.glowDim)
    val shape = RoundedCornerShape(50)
    Text((src?.sym ?: "•") + " " + (src?.label ?: g.app) + (if (g.label.isNotBlank()) " · " + g.label else "") + (if (g.gone) " · törölve a forrásban" else ""),
        style = Melyviz.small.copy(color = c, fontSize = 10.sp), maxLines = 1, overflow = TextOverflow.Ellipsis,
        modifier = Modifier.clip(shape).border(1.dp, c, shape).padding(horizontal = 7.dp, vertical = 2.dp))
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun NoteRow(n: VNote, cards: Boolean, showTasks: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(Melyviz.radiusSmall)
    Column(
        Modifier.fillMaxWidth().padding(vertical = 3.dp).clip(shape).background(Melyviz.surface)
            .border(1.dp, if (n.unread) Melyviz.glow else Melyviz.line, shape).clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = if (cards) 10.dp else 7.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (n.pinned) Text("📌 ", style = Melyviz.small)
            if (n.sealed) Text("🔒 ", style = Melyviz.small)
            Text(n.shown, style = Melyviz.label.copy(fontWeight = FontWeight.SemiBold), maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            Text(TIME.format(Date(n.updated)), style = Melyviz.readout.copy(fontSize = 10.sp))
        }
        if (cards) {
            val preview = n.body.lines().filter { it.isNotBlank() }.let { ls -> if (n.title.isBlank()) ls.drop(1) else ls }.take(3).joinToString("\n")
            if (preview.isNotBlank()) Text(preview, style = Melyviz.small.copy(color = Melyviz.muted), maxLines = 3, overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 3.dp))
        }
        val tasks = if (showTasks) Notebook.tasks(n.body) else emptyList()
        if (n.origin != null || n.tags.isNotEmpty() || tasks.isNotEmpty() || n.book != null) {
            FlowRow(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                OriginBadge(n)
                if (tasks.isNotEmpty()) Text("☑ ${tasks.count { it.done }}/${tasks.size}", style = Melyviz.small.copy(fontSize = 10.sp))
                n.book?.let { Text("▤ $it", style = Melyviz.small.copy(fontSize = 10.sp)) }
                n.tags.take(4).forEach { Text("#$it", style = Melyviz.small.copy(fontSize = 10.sp, color = Melyviz.glowDim)) }
            }
        }
    }
}

// ---- one note ----------------------------------------------------------------------------------------------------

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun NoteEditor(host: FeatureHost, id: String, onBack: () -> Unit) {
    val all by Notes.all.collectAsStateWithLifecycle()
    val profileId by Notes.profile.collectAsStateWithLifecycle()
    val overrides by Notes.overrides.collectAsStateWithLifecycle()
    val on = remember(profileId, overrides) { Notes.kit.enabled(profileId, overrides) }
    val n = all.firstOrNull { it.id == id }
    if (n == null || n.purged) { LaunchedEffect(id) { onBack() }; return }
    LaunchedEffect(id) { if (n.unread) Notes.replace { Notebook.seen(it, id) } }

    var title by remember(id) { mutableStateOf(n.title) }
    var body by remember(id) { mutableStateOf(n.body) }
    // an edit from elsewhere (the source, a sync) while this note is open and untouched here
    LaunchedEffect(n.body, n.title) { if (n.body != body) body = n.body; if (n.title != title) title = n.title }
    var reading by rememberSaveable(id) { mutableStateOf(false) }
    var newTag by remember(id) { mutableStateOf("") }
    var newTask by remember(id) { mutableStateOf("") }
    var book by remember(id) { mutableStateOf(n.book ?: "") }
    val now = { System.currentTimeMillis() }
    fun commit(t: String = title, b: String = body) { title = t; body = b; Notes.change { Notebook.edit(it, id, t, b, now()) } }
    val dictate = rememberDictation { said -> commit(b = if (body.isBlank()) said else body.trimEnd() + " " + said) }
    val src = n.origin?.let { Notes.kit.origin(it.app) }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("‹ Jegyzetek", style = Melyviz.label.copy(color = Melyviz.current),
                modifier = Modifier.heightIn(min = 48.dp).clickable(role = Role.Button) { onBack() }.wrapContentHeight().padding(end = 12.dp))
            Spacer(Modifier.weight(1f))
            if (!n.trashed) VrgChip(if (n.pinned) "📌 Kitűzve" else "📌", n.pinned) { Notes.change { Notebook.pin(it, id, !n.pinned, now()) } }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            if (n.trashed) VrgChip("Visszaállítás", true) { Notes.change { Notebook.trash(it, id, false, now()) } }
            else {
                VrgChip(if (n.archived) "Vissza az archívumból" else "Archiválás") { Notes.change { Notebook.archive(it, id, !n.archived, now()) } }
                VrgChip("Kukába") { Notes.change { Notebook.trash(it, id, true, now()) }; host.note("A jegyzet a kukában."); onBack() }
            }
            if ("formazas" in on) VrgChip(if (reading) "✎ Szerkesztés" else "¶ Olvasó", reading) { reading = !reading }
            if ("kod" in on) VrgChip("⌨ Kód", n.mono) { Notes.change { Notebook.setMono(it, id, !n.mono, now()) } }
            // D-180: a client origin's note is always sealed; any other note can be sealed by hand
            val clientNote = n.origin?.app in Notes.kit.sealedOrigins
            if (!n.trashed) VrgChip(if (n.sealed) "🔒 Lezárva" else "🔓 Lezárás", n.sealed) {
                if (clientNote) host.note("Ügyféljegyzet: mindig lezárva megy fel a GitHubra.")
                else { Notes.setSealed(id, !n.sealed); host.note(if (n.sealed) "Nyílt jegyzet: a GitHubon olvasható." else "Lezárva: a GitHubon csak a megbízható eszközök olvassák.") }
            }
            if ("diktalas" in on && !n.trashed) VrgChip("🎤") { if (!dictate()) host.note("Nincs beszédfelismerő ezen a telefonon.") }
            if ("export" in on) VrgChip("⇪ Megosztás") {
                val i = Intent(Intent.ACTION_SEND).setType("text/plain")
                    .putExtra(Intent.EXTRA_SUBJECT, n.shown).putExtra(Intent.EXTRA_TEXT, Notebook.markdown(n, Notes.kit))
                try { host.activity.startActivity(Intent.createChooser(i, "Jegyzet megosztása")) } catch (e: Exception) { host.note("Nincs mivel megosztani.") }
            }
        }

        n.origin?.let { g ->
            Column(Modifier.padding(top = 10.dp)) {
                OriginBadge(n)
                if (g.facts.isNotEmpty() || g.open) Text((if (g.open) "⚑ Tisztázandó · " else "") + g.facts.joinToString(" · "),
                    style = Melyviz.small, modifier = Modifier.padding(top = 3.dp))
                if (src?.mirror == true) Text(
                    if (g.gone) "A forrásban törölték; a jegyzet itt megmaradt."
                    else "Összekötve: a szöveg ${src.label} felé is átmegy, amikor a felmérés legközelebb megnyílik.",
                    style = Melyviz.small.copy(fontSize = 10.sp), modifier = Modifier.padding(top = 3.dp))
                val feature = src?.feature
                if (!g.gone && src != null && feature != null) Row(Modifier.padding(top = 4.dp)) {
                    VrgChip("Megnyitás: ${src.label} ›") {
                        if (Notes.openSource(n)) host.open(feature) else host.note("${src.label} most nem nyitható meg innen.")
                    }
                }
            }
        }

        Spacer(Modifier.height(8.dp))
        if (reading) {
            if (title.isNotBlank()) Text(title, style = Melyviz.title.copy(fontSize = 17.sp))
            Reader(body, mono = n.mono) { line -> commit(b = Notebook.toggleTask(body, line)) }
        } else {
            OutlinedTextField(title, { commit(t = it) }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Cím", style = Melyviz.small) }, colors = fieldColors(), readOnly = n.trashed,
                textStyle = Melyviz.label.copy(fontSize = 15.sp, fontWeight = FontWeight.SemiBold))
            Spacer(Modifier.height(6.dp))
            OutlinedTextField(body, { commit(b = it) }, modifier = Modifier.fillMaxWidth().heightIn(min = 180.dp),
                placeholder = { Text(if ("formazas" in on) "Szöveg (Markdown: # címsor, **félkövér**, - lista)" else "Szöveg", style = Melyviz.small) },
                colors = fieldColors(), readOnly = n.trashed,
                textStyle = if (n.mono) TextStyle(fontFamily = Melyviz.mono, fontSize = 13.sp, color = Melyviz.ink) else Melyviz.label.copy(fontSize = 14.sp, fontWeight = FontWeight.Normal))
        }

        if ("lista" in on && !n.trashed) {
            val tasks = Notebook.tasks(body)
            VrgSectionTitle("Teendők" + if (tasks.isNotEmpty()) " · ${tasks.count { it.done }}/${tasks.size}" else "")
            if (!reading) tasks.forEach { t ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(t.done, { commit(b = Notebook.toggleTask(body, t.line)) },
                        colors = CheckboxDefaults.colors(checkedColor = Melyviz.glow, uncheckedColor = Melyviz.line, checkmarkColor = Melyviz.onGlow))
                    Text(t.text, style = Melyviz.label.copy(color = if (t.done) Melyviz.faint else Melyviz.ink))
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(newTask, { newTask = it }, singleLine = true, modifier = Modifier.weight(1f),
                    placeholder = { Text("Új teendő", style = Melyviz.small) }, colors = fieldColors())
                Spacer(Modifier.width(6.dp))
                VrgChip("+") { if (newTask.isNotBlank()) { commit(b = Notebook.addTask(body, newTask)); newTask = "" } }
            }
        }

        if (!n.trashed) {
            VrgSectionTitle("Címkék")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                n.tags.forEach { t -> VrgChip("#$t ✕") { Notes.change { Notebook.setTags(it, id, n.tags - t, now()) } } }
            }
            Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(newTag, { newTag = it }, singleLine = true, modifier = Modifier.weight(1f),
                    placeholder = { Text("új címke", style = Melyviz.small) }, colors = fieldColors())
                Spacer(Modifier.width(6.dp))
                VrgChip("+") { if (newTag.isNotBlank()) { Notes.change { Notebook.setTags(it, id, n.tags + newTag, now()) }; newTag = "" } }
            }
            val known = Notebook.tags(all).map { it.first }.filter { it !in n.tags }.take(10)
            if (known.isNotEmpty()) FlowRow(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                known.forEach { t -> VrgChip("+#$t") { Notes.change { Notebook.setTags(it, id, n.tags + t, now()) } } }
            }
            if ("fuzetek" in on) {
                VrgSectionTitle("Füzet")
                Row(verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(book, { book = it }, singleLine = true, modifier = Modifier.weight(1f),
                        placeholder = { Text("(nincs füzet)", style = Melyviz.small) }, colors = fieldColors())
                    Spacer(Modifier.width(6.dp))
                    VrgChip("Mentés") { Notes.change { Notebook.setBook(it, id, book, now()) } }
                }
                FlowRow(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Notebook.books(all).filter { it != n.book }.forEach { b -> VrgChip("▤ $b") { book = b; Notes.change { Notebook.setBook(it, id, b, now()) } } }
                }
            }
        }
        Text("Létrehozva: ${TIME.format(Date(n.created))} · módosítva: ${TIME.format(Date(n.updated))}" + (if (n.device.isNotBlank()) " · ${n.device}" else ""),
            style = Melyviz.readout.copy(fontSize = 10.sp), modifier = Modifier.padding(top = 14.dp))
        Spacer(Modifier.height(32.dp))
    }
}

/** The Olvasó view (module Formázás): headings, bullets, **bold**, `code` and tappable tasks. */
@Composable
private fun Reader(body: String, mono: Boolean, onTask: (Int) -> Unit) {
    val base = if (mono) TextStyle(fontFamily = Melyviz.mono, fontSize = 13.sp, color = Melyviz.ink) else Melyviz.label.copy(fontSize = 14.sp, fontWeight = FontWeight.Normal)
    val taskLines = Notebook.tasks(body).associateBy { it.line }
    var inCode = false
    body.lines().forEachIndexed { i, raw ->
        if (raw.trim().startsWith("```")) { inCode = !inCode; return@forEachIndexed }
        val t = taskLines[i]
        when {
            inCode -> Text(raw, style = TextStyle(fontFamily = Melyviz.mono, fontSize = 12.sp, color = Melyviz.ink),
                modifier = Modifier.fillMaxWidth().background(Melyviz.deep).padding(horizontal = 8.dp))
            t != null -> Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(t.done, { onTask(i) }, colors = CheckboxDefaults.colors(checkedColor = Melyviz.glow, uncheckedColor = Melyviz.line, checkmarkColor = Melyviz.onGlow))
                Text(inline(t.text), style = base.copy(color = if (t.done) Melyviz.faint else Melyviz.ink))
            }
            raw.startsWith("### ") -> Text(inline(raw.drop(4)), style = base.copy(fontWeight = FontWeight.SemiBold), modifier = Modifier.padding(top = 6.dp))
            raw.startsWith("## ") -> Text(inline(raw.drop(3)), style = base.copy(fontWeight = FontWeight.Bold, fontSize = 15.sp), modifier = Modifier.padding(top = 8.dp))
            raw.startsWith("# ") -> Text(inline(raw.drop(2)), style = base.copy(fontWeight = FontWeight.Bold, fontSize = 17.sp), modifier = Modifier.padding(top = 10.dp))
            raw.trimStart().startsWith("- ") || raw.trimStart().startsWith("* ") ->
                Text(inline("•  " + raw.trimStart().drop(2)), style = base, modifier = Modifier.padding(start = 8.dp))
            raw.startsWith("> ") -> Text(inline(raw.drop(2)), style = base.copy(color = Melyviz.muted), modifier = Modifier.padding(start = 10.dp))
            raw.isBlank() -> Spacer(Modifier.height(6.dp))
            else -> Text(inline(raw), style = base)
        }
    }
}

private fun inline(s: String) = buildAnnotatedString {
    var i = 0
    while (i < s.length) {
        when {
            s.startsWith("**", i) && s.indexOf("**", i + 2) > i + 2 -> {
                val e = s.indexOf("**", i + 2)
                withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(s.substring(i + 2, e)) }; i = e + 2
            }
            s[i] == '`' && s.indexOf('`', i + 1) > i + 1 -> {
                val e = s.indexOf('`', i + 1)
                withStyle(SpanStyle(fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace)) { append(s.substring(i + 1, e)) }; i = e + 1
            }
            else -> { append(s[i]); i++ }
        }
    }
}

// ---- ⚙ ----------------------------------------------------------------------------------------------------------

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun NotesSettings(host: FeatureHost, onBack: () -> Unit) {
    val profileId by Notes.profile.collectAsStateWithLifecycle()
    val overrides by Notes.overrides.collectAsStateWithLifecycle()
    val all by Notes.all.collectAsStateWithLifecycle()
    val account by GitHub.account.collectAsStateWithLifecycle()
    val why by NotesFeature.problem.collectAsStateWithLifecycle()
    val last by NotesFeature.lastSync.collectAsStateWithLifecycle()
    val sync by NotesFeature.syncStatus.collectAsStateWithLifecycle()
    val kit = Notes.kit
    val on = kit.enabled(profileId, overrides)

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
        Text("‹ Jegyzetek", style = Melyviz.label.copy(color = Melyviz.current),
            modifier = Modifier.heightIn(min = 48.dp).clickable(role = Role.Button) { onBack() }.wrapContentHeight())
        Text("JEGYZETEK · BEÁLLÍTÁSOK", style = Melyviz.title.copy(fontSize = 18.sp))

        VrgSectionTitle("Változat")
        Text("A változat dönti el, mely modulok látszanak. Váltáskor egy jegyzet sem vész el.", style = Melyviz.small)
        kit.profiles.forEach { p ->
            val sel = p.id == kit.profile(profileId).id
            val c = color(p.color, Melyviz.glow)
            val shape = RoundedCornerShape(Melyviz.radiusSmall)
            Column(
                Modifier.fillMaxWidth().padding(top = 6.dp).clip(shape).background(Melyviz.surface)
                    .border(if (sel) 2.dp else 1.dp, if (sel) c else Melyviz.line, shape)
                    .clickable { Notes.setProfile(p.id) }.padding(horizontal = 12.dp, vertical = 9.dp),
            ) {
                Text(p.sym + "  " + p.name + if (sel) "  ✓" else "", style = Melyviz.label.copy(color = c, fontWeight = FontWeight.SemiBold))
                Text(p.premise, style = Melyviz.small, modifier = Modifier.padding(top = 2.dp))
                val mods = kit.enabled(p.id).mapNotNull { kit.module(it) }.filter { !it.core }
                if (mods.isNotEmpty()) Text(mods.joinToString("  ") { it.sym + " " + it.label }, style = Melyviz.small.copy(fontSize = 10.sp, color = Melyviz.faint),
                    modifier = Modifier.padding(top = 3.dp))
            }
        }

        VrgSectionTitle("Modulok" + if (overrides.isNotEmpty()) " · saját beállítás" else "")
        kit.modules.forEach { m ->
            when {
                m.core -> Row(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                    Text(m.sym + "  " + m.label, style = Melyviz.label, modifier = Modifier.weight(1f)); Text("mindig be", style = Melyviz.small)
                }
                m.planned -> Row(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                    Text(m.sym + "  " + m.label, style = Melyviz.label.copy(color = Melyviz.faint), modifier = Modifier.weight(1f)); Text("hamarosan", style = Melyviz.small)
                }
                else -> VrgToggle(m.sym + "  " + m.label, m.id in on) { Notes.setModule(m.id, it) }
            }
            Text(m.about, style = Melyviz.small.copy(fontSize = 10.sp), modifier = Modifier.padding(bottom = 2.dp))
        }
        if (overrides.isNotEmpty()) Row(Modifier.padding(top = 6.dp)) { VrgChip("Vissza a változat moduljaira") { Notes.setProfile(kit.profile(profileId).id) } }

        VrgSectionTitle("Szinkron")
        Text("A jegyzetek a telefonon vannak, és a repó privát ${NoteSync.BRANCH} branchére is felmennek (jegyzetenként egy fájl, notes/). " +
            "Így a többi eszköz és a munkamenetek is látják. Ha két helyen módosul ugyanaz, egyik sem vész el: a régebbi „ütközés” címkével külön jegyzet lesz.",
            style = Melyviz.small)
        val signed = account is Account.SignedIn && !(account as Account.SignedIn).guest
        if (!signed) {
            Text("Nincs GitHub belépés: a jegyzetek addig csak a telefonon vannak.", style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 4.dp))
            Row(Modifier.padding(vertical = 6.dp)) { VrgChip("GitHub fiók ›") { host.open(Catalogue.ACCOUNT.id) } }
        }
        Text("Vár: ${all.count { it.dirty }} · utoljára: " + (last?.let { TIME.format(Date(it)) } ?: "még nem"), style = Melyviz.readout, modifier = Modifier.padding(top = 4.dp))
        why?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand)) }
        Row(Modifier.padding(top = 6.dp)) { VrgChip("Szinkron most", status = sync) { NotesFeature.sendNow() } }
        if ("naplo" in on) Text("Projektnapló: a Gyorsjegyzet sorai a ${hu.vrg.mobile.core.NoteLog.BRANCH} branch napi fájljába is mennek.",
            style = Melyviz.small, modifier = Modifier.padding(top = 6.dp))

        SealSettings(host)

        VrgSectionTitle("Honnan jönnek a jegyzetek")
        val counts = Notebook.origins(all).toMap()
        kit.origins.forEach { o ->
            Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(o.sym + "  " + o.label, style = Melyviz.label.copy(color = color(o.color, Melyviz.ink)), modifier = Modifier.weight(1f))
                Text(if (o.planned) "tervben" else "${counts[o.id] ?: 0}", style = Melyviz.readout)
            }
            Text(o.about + if (o.client) " Ügyféladatot is tartalmazhat." else "", style = Melyviz.small.copy(fontSize = 10.sp))
        }
        Spacer(Modifier.height(32.dp))
    }
}

/**
 * ⚙ → Lezárás (D-180): the client notes go to the branch sealed. This device opens them; another device opens them
 * once its code was typed here (the code that device shows on this screen), the Workflow Kit's rule (D-52).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SealSettings(host: FeatureHost) {
    val trusted by Notes.trusted.collectAsStateWithLifecycle()
    val keys by NotesFeature.branchKeys.collectAsStateWithLifecycle()
    val locked by NotesFeature.lockedCount.collectAsStateWithLifecycle()
    val all by Notes.all.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    var loadNote by remember { mutableStateOf<String?>(null) }
    val codes = remember { mutableStateOf(mapOf<String, String>()) }
    LaunchedEffect(Unit) { if (keys == null) { loadNote = "Betöltés…"; loadNote = NotesFeature.loadKeys() } }
    val myId = Notes.me()?.id

    VrgSectionTitle("Lezárás")
    Text("Az ügyféljegyzetek (Sketcher, és amit 🔒-tal lezársz) a GitHubra csak titkosítva mennek: a fájlban és a commitban " +
        "nincs olvasható szöveg. Ez a telefon mindig olvassa őket; egy másik eszköz akkor, ha itt beírod a kódját.",
        style = Melyviz.small)
    Text("Ennek az eszköznek a kódja: " + (Notes.myCode() ?: "nincs még eszközkulcs"),
        style = Melyviz.readout.copy(fontSize = 13.sp, color = Melyviz.ink), modifier = Modifier.padding(top = 6.dp))
    Text("${all.count { it.sealed && !it.purged }} lezárt jegyzet itt" + (if (locked > 0) " · $locked a GitHubon, ami nem ennek az eszköznek szól (a másik eszközön kell megbízni ebben)" else ""),
        style = Melyviz.small, modifier = Modifier.padding(top = 2.dp))

    if (trusted.isNotEmpty()) {
        Text("Megbízható eszközök", style = Melyviz.label, modifier = Modifier.padding(top = 8.dp))
        trusted.forEach { r ->
            Row(Modifier.fillMaxWidth().padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(r.name.ifBlank { r.id } + " · " + DeviceTrust.code(r.id, r.pub), style = Melyviz.small, modifier = Modifier.weight(1f))
                VrgChip("Megvonás") { Notes.untrust(r.id); host.note("${r.name.ifBlank { r.id }} az új változatokat már nem olvassa.") }
            }
        }
    }
    val others = keys.orEmpty().filter { k -> myId == null || !DeviceTrust.sameId(k.id, myId) }.filter { k -> trusted.none { DeviceTrust.sameId(it.id, k.id) } }
    if (others.isNotEmpty()) {
        Text("Eszközök a GitHubon, még nem megbízhatók", style = Melyviz.label, modifier = Modifier.padding(top = 8.dp))
        others.forEach { k ->
            Column(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                Text(k.name.ifBlank { k.id } + " · " + k.id.chunked(4).joinToString("-"), style = Melyviz.small)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(codes.value[k.id] ?: "", { codes.value = codes.value + (k.id to it.take(8)) }, singleLine = true,
                        modifier = Modifier.weight(1f), placeholder = { Text("a kódja azon az eszközön", style = Melyviz.small) }, colors = fieldColors())
                    Spacer(Modifier.width(6.dp))
                    VrgChip("Megbízom") {
                        val r = NoteSeal.pin(k, codes.value[k.id] ?: "")
                        if (r == null) host.note("A kód nem egyezik. Nézd meg azon az eszközön: Jegyzetek → ⚙ → Lezárás.")
                        else { Notes.trust(r); NotesFeature.sendNow(); host.note("${r.name.ifBlank { r.id }} mostantól olvassa a lezárt jegyzeteket.") }
                    }
                }
            }
        }
    }
    loadNote?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 4.dp)) }
    Row(Modifier.padding(top = 6.dp)) {
        VrgChip("Eszközök frissítése") { scope.launch { loadNote = "Betöltés…"; loadNote = NotesFeature.loadKeys() } }
    }
}
