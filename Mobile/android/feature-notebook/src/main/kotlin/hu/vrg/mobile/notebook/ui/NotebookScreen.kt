package hu.vrg.mobile.notebook.ui

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.speech.RecognizerIntent
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.ui.VrgSectionTitle
import hu.vrg.mobile.kit.ui.VrgToggle
import hu.vrg.mobile.notebook.Engine
import hu.vrg.mobile.notebook.Entry
import hu.vrg.mobile.notebook.FieldKind
import hu.vrg.mobile.notebook.KField
import hu.vrg.mobile.notebook.Kit
import hu.vrg.mobile.notebook.Kits
import hu.vrg.mobile.notebook.Library
import hu.vrg.mobile.notebook.OpenItem
import hu.vrg.mobile.notebook.OpenKind
import hu.vrg.mobile.notebook.Section
import hu.vrg.mobile.notebook.Store
import hu.vrg.mobile.notebook.Transfer
import hu.vrg.mobile.notebook.Value
import hu.vrg.mobile.notebook.ViewKind
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import hu.vrg.mobile.kit.theme.vrgBorder

// VRG Füzet's screens. Four places inside the feature: the home (search, kits, the kit's views, capture), the editor,
// the open items and the kits. Back walks out of them before it leaves the feature.

private sealed class Place {
    object Home : Place()
    data class Edit(val entry: Entry, val isNew: Boolean) : Place()
    object Open : Place()
    object Kits : Place()
}

private val zone: ZoneId get() = ZoneId.systemDefault()
private val HM = DateTimeFormatter.ofPattern("HH:mm")
private val MD = DateTimeFormatter.ofPattern("MM.dd. HH:mm")

private fun kitColor(k: Kit?): Color = k?.let { Color(it.color) } ?: Melyviz.glow

@Composable
private fun fieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = Melyviz.glow, unfocusedBorderColor = Melyviz.line,
    focusedTextColor = Melyviz.ink, unfocusedTextColor = Melyviz.ink, cursorColor = Melyviz.glow,
)

@Composable
fun NotebookScreen(host: FeatureHost) {
    val store by NotebookFeature.store.collectAsStateWithLifecycle()
    val lib by NotebookFeature.library.collectAsStateWithLifecycle()
    val handed by NotebookFeature.incoming.collectAsStateWithLifecycle()
    var place by remember { mutableStateOf<Place>(Place.Home) }

    LaunchedEffect(handed) {
        handed?.let { t ->
            place = Place.Edit(NotebookFeature.newEntry(Kits.BASE, Kits.NOTE_TYPE, t), true)
            NotebookFeature.incoming.value = null
        }
    }
    BackHandler { if (place is Place.Home) host.home() else place = Place.Home }

    when (val p = place) {
        Place.Home -> HomePlace(host, store, lib,
            onEdit = { e, isNew -> place = Place.Edit(e, isNew) },
            onOpen = { place = Place.Open }, onKits = { place = Place.Kits })
        is Place.Edit -> EditPlace(host, store, lib, p.entry, p.isNew, onDone = { place = Place.Home })
        Place.Open -> OpenPlace(store, lib,
            onEntry = { id -> store.byId(id)?.let { place = Place.Edit(it, false) } }, onBack = { place = Place.Home })
        Place.Kits -> KitsPlace(host, store, lib, onBack = { place = Place.Home })
    }
}

// ---- home ------------------------------------------------------------------------------------------------------------

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun HomePlace(
    host: FeatureHost, store: Store, lib: Library,
    onEdit: (Entry, Boolean) -> Unit, onOpen: () -> Unit, onKits: () -> Unit,
) {
    val undo by NotebookFeature.undo.collectAsStateWithLifecycle()
    val problem by NotebookFeature.problem.collectAsStateWithLifecycle()
    var query by remember { mutableStateOf("") }
    var kitId by remember { mutableStateOf(Kits.BASE) }
    var viewId by remember { mutableStateOf<String?>(null) }
    val now = System.currentTimeMillis()
    val kits = lib.on(store)
    val kit = kits.firstOrNull { it.id == kitId } ?: kits.firstOrNull()
    val view = kit?.view(viewId) ?: kit?.views?.firstOrNull()
    val open = remember(store, lib) { Engine.open(store, lib, zone, System.currentTimeMillis()) }

    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current), modifier = Modifier.clickable { host.home() }.padding(vertical = 8.dp))
            Spacer(Modifier.weight(1f))
            VrgChip("⚑ Nyitott ${open.size}", selected = open.any { it.kind == OpenKind.DUE || it.kind == OpenKind.LIMIT }) { onOpen() }
            Spacer(Modifier.width(6.dp))
            VrgChip("⚙ Kitek") { onKits() }
        }
        Text("VRG FÜZET", style = Melyviz.title.copy(fontSize = 18.sp))
        problem?.let {
            Text(it, style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 4.dp).clickable { NotebookFeature.problem.value = null })
        }
        OutlinedTextField(
            value = query, onValueChange = { query = it }, singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
            placeholder = { Text("Keresés mindenben (#címke is)", style = Melyviz.small) }, colors = fieldColors(),
        )

        // capture: the plain note always, then the chosen kit's types
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            VrgChip("✎ Jegyzet", selected = true) { onEdit(NotebookFeature.newEntry(Kits.BASE, Kits.NOTE_TYPE, store.draft), true) }
            kit?.let { k ->
                k.types.filterNot { k.id == Kits.BASE && it.id == Kits.NOTE_TYPE }.forEach { t ->
                    VrgChip("＋ ${t.sym} ${t.label}") { onEdit(NotebookFeature.newEntry(k.id, t.id), true) }
                }
            }
        }
        undo?.let {
            Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Bejegyzés törölve.", style = Melyviz.small)
                Spacer(Modifier.width(8.dp))
                VrgChip("Visszavonás") { NotebookFeature.undoDelete() }
                Spacer(Modifier.width(6.dp))
                VrgChip("✕") { NotebookFeature.undo.value = null }
            }
        }

        if (query.isNotBlank()) {
            val found = remember(store, lib, query) { Engine.search(store, lib, query) }
            VrgSectionTitle("Találat · ${found.size}")
            LazyColumn(Modifier.weight(1f)) {
                items(found, key = { it.id }) { e -> EntryRow(e, lib, showKit = true, now = now) { onEdit(e, false) } }
            }
            return@Column
        }

        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            kits.forEach { k -> VrgChip("${k.sym} ${k.name}", selected = k.id == kit?.id) { kitId = k.id; viewId = null } }
        }
        if (kit == null || view == null) { Text("Nincs bekapcsolt kit.", style = Melyviz.small); return@Column }
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            kit.views.forEach { v -> VrgChip("${v.sym} ${v.label}", selected = v.id == view.id) { viewId = v.id } }
        }
        val result = remember(store, lib, kit.id, view.id) { Engine.view(store, lib, kit, view, zone, System.currentTimeMillis()) }
        LazyColumn(Modifier.weight(1f).padding(top = 4.dp)) {
            if (result.isEmpty) item {
                Text("Itt még nincs bejegyzés. A fenti ＋ gombokkal veszel fel.", style = Melyviz.small, modifier = Modifier.padding(vertical = 12.dp))
            }
            result.sections.filter { it.entries.isNotEmpty() || view.kind == ViewKind.CHECKLIST }.forEach { sec ->
                item(key = "s:" + sec.key) { SectionHead(sec, view.kind == ViewKind.TALLY) }
                if (view.kind != ViewKind.TALLY) items(sec.entries, key = { sec.key + ":" + it.id }) { e ->
                    if (view.kind == ViewKind.CHECKLIST) CheckRow(e, lib, now) { onEdit(e, false) }
                    else EntryRow(e, lib, showKit = false, now = now) { onEdit(e, false) }
                }
            }
        }
    }
}

@Composable
private fun SectionHead(sec: Section, tally: Boolean) {
    val total = sec.sum?.let { " · " + Engine.num(it) + (sec.unit?.let { u -> " $u" } ?: "") } ?: ""
    if (!tally) { VrgSectionTitle("${sec.title} · ${sec.count}$total"); return }
    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(sec.title, style = Melyviz.label, modifier = Modifier.weight(1f))
        Text("${sec.count} db$total", style = Melyviz.readout.copy(color = Melyviz.glow, fontSize = 13.sp))
    }
}

private fun stamp(at: Long, now: Long): String {
    val t = Instant.ofEpochMilli(at).atZone(zone)
    return if (t.toLocalDate() == Instant.ofEpochMilli(now).atZone(zone).toLocalDate()) t.format(HM) else t.format(MD)
}

@Composable
private fun EntryRow(e: Entry, lib: Library, showKit: Boolean, now: Long, onClick: () -> Unit) {
    val t = lib.type(e)
    val k = lib.kit(e.kit)
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 7.dp), verticalAlignment = Alignment.Top) {
        Text(t?.sym ?: "•", style = Melyviz.glyph.copy(fontSize = 18.sp, color = t?.color?.let { Color(it) } ?: kitColor(k)), modifier = Modifier.width(30.dp))
        Column(Modifier.weight(1f)) {
            Text((if (e.open) "⚑ " else "") + Engine.title(e, lib), style = Melyviz.label, maxLines = 2)
            val sub = listOfNotNull(
                if (showKit) k?.name ?: e.kit else null,
                Engine.summary(e, lib).takeIf { it.isNotEmpty() && e.text.isNotBlank() },
                e.tags.takeIf { it.isNotEmpty() }?.joinToString(" ") { "#$it" },
            ).joinToString(" · ")
            if (sub.isNotEmpty()) Text(sub, style = Melyviz.small, maxLines = 2)
        }
        Text(stamp(e.at, now), style = Melyviz.readout)
    }
}

@Composable
private fun CheckRow(e: Entry, lib: Library, now: Long, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(if (e.done) "☑" else "☐", style = Melyviz.glyph.copy(color = if (e.done) Melyviz.kelp else Melyviz.ink),
            modifier = Modifier.clickable { NotebookFeature.change { it.toggleDone(e.id, System.currentTimeMillis()) } }.padding(end = 10.dp))
        Column(Modifier.weight(1f).clickable(onClick = onClick)) {
            Text(Engine.title(e, lib), style = Melyviz.label.copy(color = if (e.done) Melyviz.faint else Melyviz.ink))
            val due = lib.type(e)?.fields?.firstOrNull { it.due }?.let { f -> e.f[f.id]?.let { Engine.valueText(f, it) } }
            if (due != null) Text(due, style = Melyviz.small)
        }
        Text(stamp(e.at, now), style = Melyviz.readout)
    }
}

// ---- editor ----------------------------------------------------------------------------------------------------------

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun EditPlace(host: FeatureHost, store: Store, lib: Library, start: Entry, isNew: Boolean, onDone: () -> Unit) {
    var e by remember(start.id) { mutableStateOf(start) }
    var tagText by remember(start.id) { mutableStateOf("") }
    val kits = lib.on(store)
    val kit = lib.kit(e.kit)
    val type = kit?.type(e.type)

    val dictate = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        val said = r.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()
        if (!said.isNullOrBlank()) e = e.copy(text = if (e.text.isBlank()) said else e.text + " " + said)
    }
    // nothing half-done is lost: a new note's text is kept as the draft while it is typed
    LaunchedEffect(e.text) { if (isNew && e.kit == Kits.BASE && e.type == Kits.NOTE_TYPE) NotebookFeature.store.value = NotebookFeature.store.value.copy(draft = e.text) }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
        Text("‹ Mégse", style = Melyviz.label.copy(color = Melyviz.current), modifier = Modifier.clickable { onDone() }.padding(vertical = 8.dp))
        Text(if (isNew) "ÚJ BEJEGYZÉS" else "BEJEGYZÉS", style = Melyviz.title.copy(fontSize = 18.sp))
        if (!isNew) Text("Felvéve: " + stamp(e.at, System.currentTimeMillis()) + (e.ed?.let { " · módosítva: " + stamp(it, System.currentTimeMillis()) } ?: ""), style = Melyviz.small)

        VrgSectionTitle("Kit és típus")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            kits.forEach { k -> VrgChip("${k.sym} ${k.name}", selected = k.id == e.kit) {
                if (k.id != e.kit) e = e.copy(kit = k.id, type = k.types.first().id)
            } }
        }
        if (kit != null) FlowRow(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            kit.types.forEach { t -> VrgChip("${t.sym} ${t.label}", selected = t.id == e.type) { e = e.copy(type = t.id) } }
        }
        if (kit == null) Text("Ez a bejegyzés a(z) „${e.kit}” kitből jött, ami most nincs betöltve. A szöveg és a mezők megmaradnak.", style = Melyviz.small.copy(color = Melyviz.sand))

        OutlinedTextField(
            value = e.text, onValueChange = { e = e.copy(text = it) },
            modifier = Modifier.fillMaxWidth().heightIn(min = 96.dp).padding(top = 10.dp),
            placeholder = { Text("Szöveg (nem kötelező)", style = Melyviz.small) }, colors = fieldColors(),
        )
        Row(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            VrgChip("🎤 Diktálás") {
                val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                    .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "hu-HU")
                try { dictate.launch(i) } catch (x: ActivityNotFoundException) { host.note("Nincs beszédfelismerő ezen a telefonon.") }
            }
        }

        type?.fields?.takeIf { it.isNotEmpty() }?.let { fields ->
            VrgSectionTitle(type.label)
            fields.forEach { f -> FieldInput(f, e.f[f.id]) { v -> e = e.copy(f = if (v == null) e.f - f.id else e.f + (f.id to v)) } }
        }

        val chips = (lib.kit(Kits.BASE)?.chips.orEmpty() + (kit?.takeIf { it.id != Kits.BASE }?.chips.orEmpty()))
        if (chips.isNotEmpty()) {
            VrgSectionTitle("Gyors jelölés")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                chips.forEach { c ->
                    val tag: String? = c.tag
                    val ctype: String? = c.type
                    val on = (tag != null && tag in e.tags) || (c.open && e.open && tag == null)
                    VrgChip("${c.sym} ${c.label}", selected = on) {
                        var n = e
                        if (tag != null) n = n.copy(tags = if (tag in n.tags) n.tags - tag else n.tags + tag)
                        if (c.open) n = n.copy(open = !on)
                        if (ctype != null && kit?.type(ctype) != null) n = n.copy(type = ctype)
                        e = n
                    }
                }
            }
        }

        VrgSectionTitle("Címkék")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            e.tags.forEach { t -> VrgChip("#$t ✕") { e = e.copy(tags = e.tags - t) } }
        }
        OutlinedTextField(
            value = tagText, onValueChange = { v ->
                if (v.endsWith(" ") || v.endsWith(",")) {
                    val t = v.trim(' ', ',', '#')
                    if (t.isNotEmpty() && t !in e.tags) e = e.copy(tags = e.tags + t)
                    tagText = ""
                } else tagText = v
            },
            singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
            placeholder = { Text("új címke, szóközzel zárva", style = Melyviz.small) }, colors = fieldColors(),
        )
        VrgToggle("⚑ Tisztázandó", e.open) { e = e.copy(open = it) }
        if (type?.checkable == true) VrgToggle("☑ Kész", e.done) { e = e.copy(done = it) }

        if (!isNew) {
            val linked = Engine.linked(store, e.id)
            if (linked.isNotEmpty()) {
                VrgSectionTitle("Kapcsolódik · ${linked.size}")
                linked.forEach { l -> Text("· " + Engine.title(l, lib), style = Melyviz.small) }
            }
        }

        Row(Modifier.padding(top = 14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            VrgChip("Mentés", selected = true) {
                val t = tagText.trim(' ', ',', '#')
                NotebookFeature.save(if (t.isNotEmpty() && t !in e.tags) e.copy(tags = e.tags + t) else e)
                host.note(if (isNew) "Felvéve." else "Mentve.")
                onDone()
            }
            if (!isNew) VrgChip("Törlés") { NotebookFeature.delete(e.id); onDone() }
            VrgChip("Mégse") { onDone() }
        }
        Spacer(Modifier.height(32.dp))
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FieldInput(f: KField, v: Value?, set: (Value?) -> Unit) {
    val label = f.label + (f.unit?.let { " ($it)" } ?: "") + if (f.required) " *" else ""
    when (f.kind) {
        FieldKind.TEXT -> OutlinedTextField(
            value = (v as? Value.Text)?.s ?: "", onValueChange = { set(if (it.isEmpty()) null else Value.Text(it)) },
            label = { Text(label, style = Melyviz.small) }, modifier = Modifier.fillMaxWidth().padding(top = 4.dp), colors = fieldColors(),
        )
        FieldKind.NUMBER -> {
            var raw by remember(f.id) { mutableStateOf((v as? Value.Num)?.n?.let(Engine::num) ?: "") }
            val limit = listOfNotNull(f.min?.let { "≥ " + Engine.num(it) }, f.max?.let { "≤ " + Engine.num(it) }).joinToString(" ")
            OutlinedTextField(
                value = raw, onValueChange = { s ->
                    raw = s
                    val n = s.trim().replace(',', '.').toDoubleOrNull()
                    set(n?.let { Value.Num(it) })
                },
                singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                label = { Text(label + if (limit.isNotEmpty()) "  $limit" else "", style = Melyviz.small) },
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp), colors = fieldColors(),
            )
        }
        FieldKind.CHOICE -> {
            Text(label, style = Melyviz.small, modifier = Modifier.padding(top = 8.dp))
            FlowRow(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                f.options.forEach { o -> val sel = (v as? Value.Text)?.s == o; VrgChip(o, sel) { set(if (sel) null else Value.Text(o)) } }
            }
        }
        FieldKind.MULTI -> {
            val cur = (v as? Value.Many)?.items ?: emptyList()
            Text(label, style = Melyviz.small, modifier = Modifier.padding(top = 8.dp))
            FlowRow(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                f.options.forEach { o ->
                    val sel = o in cur
                    VrgChip(o, sel) { val n = if (sel) cur - o else cur + o; set(if (n.isEmpty()) null else Value.Many(n)) }
                }
            }
        }
        FieldKind.CHECK -> VrgToggle(label, (v as? Value.Bool)?.b ?: false) { set(Value.Bool(it)) }
        FieldKind.DATE -> {
            val today = LocalDate.now(zone)
            OutlinedTextField(
                value = (v as? Value.Text)?.s ?: "", onValueChange = { set(if (it.isBlank()) null else Value.Text(it.trim())) },
                singleLine = true, label = { Text("$label  ÉÉÉÉ-HH-NN", style = Melyviz.small) },
                isError = (v as? Value.Text)?.s?.let { Engine.date(it) == null } ?: false,
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp), colors = fieldColors(),
            )
            Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                VrgChip("Ma") { set(Value.Text(today.toString())) }
                VrgChip("Holnap") { set(Value.Text(today.plusDays(1).toString())) }
                VrgChip("+1 hét") { set(Value.Text(today.plusWeeks(1).toString())) }
                VrgChip("+1 hónap") { set(Value.Text(today.plusMonths(1).toString())) }
            }
        }
        FieldKind.RATING -> {
            val n = (v as? Value.Num)?.n?.toInt() ?: 0
            Text(label, style = Melyviz.small, modifier = Modifier.padding(top = 8.dp))
            Row(Modifier.padding(top = 4.dp)) {
                (1..5).forEach { i ->
                    Text(if (i <= n) "★" else "☆", style = Melyviz.glyph.copy(color = if (i <= n) Melyviz.sand else Melyviz.faint),
                        modifier = Modifier.clickable { set(if (i == n) null else Value.Num(i.toDouble())) }.padding(end = 10.dp))
                }
            }
        }
    }
}

// ---- open items ------------------------------------------------------------------------------------------------------

@Composable
private fun OpenPlace(store: Store, lib: Library, onEntry: (String) -> Unit, onBack: () -> Unit) {
    val items = remember(store, lib) { Engine.open(store, lib, zone, System.currentTimeMillis()) }
    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 8.dp)) {
        Text("‹ Füzet", style = Melyviz.label.copy(color = Melyviz.current), modifier = Modifier.clickable { onBack() }.padding(vertical = 8.dp))
        Text("NYITOTT · ${items.size}", style = Melyviz.title.copy(fontSize = 18.sp))
        Text("Mi esedékes, mi lóg ki a határértékből, mi hiányzik, mire utal egy jegyzet. Ki van számolva, nem kell lezárni: ami rendbe jön, eltűnik.", style = Melyviz.small)
        if (items.isEmpty()) Text("Nincs nyitott szál.", style = Melyviz.label, modifier = Modifier.padding(top = 16.dp))
        LazyColumn(Modifier.weight(1f).padding(top = 6.dp)) {
            items(items, key = { it.key }) { item -> OpenRow(item, lib, onEntry) }
        }
    }
}

@Composable
private fun OpenRow(item: OpenItem, lib: Library, onEntry: (String) -> Unit) {
    val k = lib.kit(item.kit)
    val tone = when (item.kind) {
        OpenKind.DUE, OpenKind.LIMIT -> Melyviz.coral
        OpenKind.OPEN, OpenKind.MISSING -> Melyviz.sand
        OpenKind.STALE -> Melyviz.ink
        OpenKind.SUGGEST -> Melyviz.glow
    }
    Column(Modifier.fillMaxWidth().padding(vertical = 6.dp).vrgBorder(1.dp, Melyviz.line, RoundedCornerShape(10.dp))
        .background(Melyviz.surface, RoundedCornerShape(10.dp)).padding(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("${item.kind.sym} ${item.kind.label}", style = Melyviz.small.copy(color = tone), modifier = Modifier.weight(1f))
            Text("${k?.sym ?: ""} ${k?.name ?: item.kit}", style = Melyviz.small.copy(color = kitColor(k)))
        }
        Text(item.title, style = Melyviz.label, modifier = Modifier.padding(top = 2.dp))
        Text(item.detail, style = Melyviz.small)
        Row(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            if (item.kind == OpenKind.SUGGEST) VrgChip("Alkalmaz", selected = true) {
                NotebookFeature.change { Engine.apply(it, item, System.currentTimeMillis()) }
            }
            item.entryId?.let { id -> VrgChip("Megnyitás") { onEntry(id) } }
            VrgChip("Elvet") { NotebookFeature.change { it.dismiss(item.key) } }
        }
    }
}

// ---- kits, export, import --------------------------------------------------------------------------------------------

private const val REQUEST = """VRG Füzet: új kit kérése (Mobile/notebook/kits/PROTOCOL.md)

Mire való:
Mit szeretnék felírni (típusok és mezők):
Hogyan akarom látni (napló, lista, pipálható, összesítő mi szerint):
Mire figyelmeztessen (határidő, határérték, ha rég volt):
"""

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun KitsPlace(host: FeatureHost, store: Store, lib: Library, onBack: () -> Unit) {
    val ctx = LocalContext.current
    val sources by NotebookFeature.sources.collectAsStateWithLifecycle()
    var msg by remember { mutableStateOf<String?>(null) }
    fun read(uri: Uri): String? = try { ctx.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() } } catch (e: Exception) { msg = "Nem olvasható: ${e.message}"; null }

    val pickKit = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> uri?.let(::read)?.let { msg = NotebookFeature.importKit(it) } }
    val pickStore = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri -> uri?.let(::read)?.let { msg = NotebookFeature.importStore(it) } }
    val saveStore = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        uri ?: return@rememberLauncherForActivityResult
        msg = try {
            ctx.contentResolver.openOutputStream(uri)?.use { it.write(NotebookFeature.exportText().toByteArray()) }
            "Kimentve: ${store.entries.size} bejegyzés."
        } catch (e: Exception) { "Nem sikerült menteni: ${e.message}" }
    }
    val types = arrayOf("application/json", "application/octet-stream", "text/plain")

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
        Text("‹ Füzet", style = Melyviz.label.copy(color = Melyviz.current), modifier = Modifier.clickable { onBack() }.padding(vertical = 8.dp))
        Text("KITEK", style = Melyviz.title.copy(fontSize = 18.sp))
        Text("Egy kit a füzet egy alkalmazása: milyen bejegyzések vannak benne, hogyan látszanak, mire figyelmeztet. A bejegyzések a kit kikapcsolásakor is megmaradnak.", style = Melyviz.small)
        msg?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 6.dp)) }

        lib.all.forEach { k ->
            val src = sources.firstOrNull { it.id == k.id && it.errors.isEmpty() }
            val count = store.entries.count { it.kit == k.id }
            Column(Modifier.fillMaxWidth().padding(top = 10.dp).vrgBorder(1.dp, Melyviz.line, RoundedCornerShape(10.dp)).padding(10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(k.sym, style = Melyviz.glyph.copy(color = kitColor(k)), modifier = Modifier.width(32.dp))
                    Column(Modifier.weight(1f)) {
                        Text(k.name, style = Melyviz.label)
                        Text("${k.types.size} típus · ${k.views.size} nézet · $count bejegyzés" + if (src?.own == true) " · saját" else " · beépített", style = Melyviz.readout)
                    }
                }
                if (k.about.isNotBlank()) Text(k.about, style = Melyviz.small, modifier = Modifier.padding(top = 4.dp))
                if (k.id == Kits.BASE) Text("Mindig be van kapcsolva.", style = Melyviz.small.copy(color = Melyviz.faint))
                else VrgToggle("Bekapcsolva", store.isOn(k.id)) { on -> NotebookFeature.change { it.setKit(k.id, on) } }
                if (src?.own == true) Row(Modifier.padding(top = 4.dp)) { VrgChip("Saját kit törlése") { NotebookFeature.removeOwnKit(k.id); msg = "${k.name} törölve (a bejegyzései megmaradtak)." } }
            }
        }
        sources.filter { it.errors.isNotEmpty() }.forEach { s ->
            Text("⚠ ${s.file}: ${s.errors.first()}", style = Melyviz.small.copy(color = Melyviz.coral), modifier = Modifier.padding(top = 6.dp))
        }

        VrgSectionTitle("Új kit")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            VrgChip("Kit betöltése fájlból") { pickKit.launch(types) }
            VrgChip("✦ Kit kérése") {
                val note = NotebookFeature.newEntry(Kits.BASE, "keres", REQUEST)
                NotebookFeature.save(note)
                val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, REQUEST)
                try { ctx.startActivity(Intent.createChooser(send, "Kit kérése")) } catch (e: ActivityNotFoundException) { host.note("Nincs megosztó alkalmazás.") }
                msg = "A kérés Kérés bejegyzésként is felkerült az Alap kitbe."
            }
        }
        Text("Egy Claude munkamenet a kérésből egy kit JSON-t ír (PROTOCOL.md). A fájlt itt töltöd be, vagy a következő frissítéssel érkezik.", style = Melyviz.small, modifier = Modifier.padding(top = 4.dp))

        VrgSectionTitle("A füzet egy fájlban")
        Text("${store.entries.size} bejegyzés. Az export egy sima JSON fájl: olvasható app nélkül is, és importáláskor összefésül (a frissebb nyer, a törlés megmarad).", style = Melyviz.small)
        Row(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            VrgChip("Export") { saveStore.launch(Transfer.fileName(LocalDate.now(zone))) }
            VrgChip("Import") { pickStore.launch(types) }
        }
        Spacer(Modifier.height(32.dp))
    }
}
