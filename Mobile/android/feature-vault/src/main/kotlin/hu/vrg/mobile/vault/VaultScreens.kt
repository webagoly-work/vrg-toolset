package hu.vrg.mobile.vault

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.view.WindowManager
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.SecretKind
import hu.vrg.mobile.core.VaultBackup
import hu.vrg.mobile.core.VaultCrypto
import hu.vrg.mobile.core.VaultField
import hu.vrg.mobile.core.VaultFiles
import hu.vrg.mobile.core.VaultIndex
import hu.vrg.mobile.core.VaultItem
import hu.vrg.mobile.core.VaultKind
import hu.vrg.mobile.core.VaultLock
import hu.vrg.mobile.core.VaultSecret
import hu.vrg.mobile.core.VaultTemplate
import hu.vrg.mobile.core.VaultTemplates
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.files.FileStore
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.ui.VrgSectionTitle
import hu.vrg.mobile.kit.ui.VrgToggle
import kotlinx.coroutines.delay
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import hu.vrg.mobile.vault.VaultFeature as V

// Széf (WP M24): the screens. Hungarian on the phone, Mélyvíz colours from the kit, every action through VaultFeature.

private val DAY = SimpleDateFormat("yyyy.MM.dd. HH:mm", Locale.ROOT)

@Composable
internal fun VaultScreen(host: FeatureHost) {
    val phase by V.phase.collectAsStateWithLifecycle()
    val view by V.view.collectAsStateWithLifecycle()
    val folder by V.folder.collectAsStateWithLifecycle()

    // no screenshot, no screen recording, a blank card in Recents, while the Széf is on screen
    DisposableEffect(Unit) {
        val w = host.activity.window
        w.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        onDispose { w.clearFlags(WindowManager.LayoutParams.FLAG_SECURE) }
    }
    LaunchedEffect(Unit) { V.notes.collect { host.note(it) } }
    BackHandler(phase == V.Phase.OPEN && (view !is V.View.List || folder != null)) { back() }

    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current),
                modifier = Modifier.clickable { if (phase != V.Phase.OPEN || !back()) host.home() }.padding(vertical = 8.dp))
            Spacer(Modifier.weight(1f))
            if (phase == V.Phase.OPEN) {
                if (view !is V.View.Settings) Text("⚙", style = Melyviz.label.copy(color = Melyviz.current, fontSize = 18.sp),
                    modifier = Modifier.clickable { V.view.value = V.View.Settings }.padding(8.dp))
                Text("🔒 Zárás", style = Melyviz.label.copy(color = Melyviz.current),
                    modifier = Modifier.clickable { V.lock() }.padding(8.dp))
            }
        }
        Text("SZÉF", style = Melyviz.title.copy(fontSize = 18.sp))
        when (phase) {
            V.Phase.NONE -> Setup()
            V.Phase.LOCKED -> Locked()
            V.Phase.LOST -> Lost()
            V.Phase.OPEN -> when (val v = view) {
                V.View.List -> Browse()
                is V.View.Item -> ItemView(v.id)
                is V.View.Edit -> Editor(v)
                V.View.Settings -> SettingsView()
                is V.View.Guard -> GuardView(v)
            }
        }
    }
}

/** One step back inside the Széf; false when there is nothing left (the shell then goes home). */
private fun back(): Boolean {
    when (val v = V.view.value) {
        V.View.List -> {
            val f = V.folder.value ?: return false
            V.folder.value = V.index.value.get(f)?.parent
        }
        is V.View.Edit -> V.view.value = if (v.isNew) V.View.List else V.View.Item(v.draft.id)
        else -> V.view.value = V.View.List
    }
    return true
}

// ---- parts ------------------------------------------------------------------------------------------------------------

@Composable
private fun Field(
    value: String, onChange: (String) -> Unit, hint: String, modifier: Modifier = Modifier,
    secret: Boolean = false, digits: Boolean = false, single: Boolean = true, onDone: (() -> Unit)? = null,
) {
    BasicTextField(
        value, onChange, singleLine = single,
        textStyle = Melyviz.label.copy(fontSize = 15.sp, color = Melyviz.ink),
        cursorBrush = SolidColor(Melyviz.glow),
        visualTransformation = if (secret) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = KeyboardOptions(
            keyboardType = when { digits -> KeyboardType.NumberPassword; secret -> KeyboardType.Password; else -> KeyboardType.Text },
            autoCorrectEnabled = !secret,
            imeAction = if (onDone != null) ImeAction.Done else ImeAction.Default,
        ),
        keyboardActions = KeyboardActions(onDone = { onDone?.invoke() }),
        modifier = modifier.fillMaxWidth().padding(vertical = 4.dp)
            .background(Melyviz.surface, RoundedCornerShape(Melyviz.radiusSmall))
            .border(1.dp, Melyviz.line, RoundedCornerShape(Melyviz.radiusSmall)).padding(12.dp),
        decorationBox = { inner -> if (value.isEmpty()) Text(hint, style = Melyviz.label.copy(color = Melyviz.faint)); inner() },
    )
}

@Composable
private fun Hint(text: String, warn: Boolean = false) =
    Text(text, style = Melyviz.small.copy(color = if (warn) Melyviz.sand else Melyviz.muted), modifier = Modifier.padding(vertical = 4.dp))

@Composable
private fun Card(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) =
    Column(modifier.fillMaxWidth().background(Melyviz.surface, RoundedCornerShape(Melyviz.radius))
        .border(1.dp, Melyviz.lineSoft, RoundedCornerShape(Melyviz.radius)).padding(12.dp), content = content)

@Composable
private fun KindChoice(kind: SecretKind, onPick: (SecretKind) -> Unit) =
    Row(Modifier.padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        SecretKind.entries.forEach { k -> VrgChip(k.label, selected = k == kind) { onPick(k) } }
    }

// ---- first run --------------------------------------------------------------------------------------------------------

@Composable
private fun Setup() {
    val ctx = LocalContext.current
    val busy by V.busy.collectAsStateWithLifecycle()
    var kind by rememberSaveable { mutableStateOf(SecretKind.PIN) }
    var a by remember { mutableStateOf("") }
    var b by remember { mutableStateOf("") }
    var err by remember { mutableStateOf<String?>(null) }
    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState())) {
        Hint("Ügyféladatok, igazolványok, dokumentumok és fájlok titkosítva, csak ezen a telefonon. " +
            "A Széf PIN-kóddal vagy jelmondattal nyílik, később ujjlenyomattal is.")
        VrgSectionTitle("Új széf")
        KindChoice(kind) { kind = it; a = ""; b = ""; err = null }
        val digits = kind == SecretKind.PIN
        Field(a, { a = it; err = null }, if (digits) "PIN-kód (legalább ${VaultSecret.PIN_MIN} számjegy)" else "Jelmondat (legalább ${VaultSecret.PASS_MIN} karakter)", secret = true, digits = digits)
        Field(b, { b = it; err = null }, "Még egyszer", secret = true, digits = digits)
        err?.let { Hint(it, warn = true) }
        Row(Modifier.padding(vertical = 8.dp)) {
            VrgChip(if (busy) "Létrehozás…" else "Széf létrehozása", selected = true) {
                if (busy) return@VrgChip
                val p = VaultSecret.problem(a, kind)
                err = when { p != null -> p; a != b -> "A kettő nem egyezik."; else -> null }
                if (err == null) {
                    V.create(a.toCharArray(), kind) { e ->
                        err = e
                        if (e == null && VaultKeys.bioProblem(ctx) == null) V.enrollBio(ctx)
                    }
                    a = ""; b = ""
                }
            }
        }
        Card(Modifier.padding(top = 8.dp)) {
            Text("Jó tudni", style = Melyviz.label)
            Hint("• A kódot senki nem tudja visszaállítani, mi sem. Elfelejtve a tartalom elveszik.")
            Hint("• Gyári visszaállítás vagy új telefon után a Széf csak mentésből jön vissza: Beállítások → Mentés fájlba.")
            Hint("• A Széf zár, amikor a képernyő kikapcsol, vagy az app a választott ideig háttérben van.")
            Hint("• Amíg a Széf látszik, képernyőkép nem készülhet róla.")
        }
    }
}

// ---- locked -----------------------------------------------------------------------------------------------------------

@Composable
private fun Locked() {
    val ctx = LocalContext.current
    val busy by V.busy.collectAsStateWithLifecycle()
    val note by V.lockNote.collectAsStateWithLifecycle()
    val until by V.waitUntil.collectAsStateWithLifecycle()
    val kind = remember { V.store.header()?.kind ?: SecretKind.PIN }
    val bio = remember { V.bioOn() }
    var s by remember { mutableStateOf("") }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(until) { while (until > System.currentTimeMillis()) { now = System.currentTimeMillis(); delay(1000) }; now = System.currentTimeMillis() }
    LaunchedEffect(Unit) { if (bio && !V.bioAsked) { V.bioAsked = true; V.unlockBio(ctx) } }
    val waiting = until > now

    Column(Modifier.fillMaxWidth().padding(top = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text("🔐", style = Melyviz.glyph.copy(fontSize = 44.sp))
        Text("A Széf zárva", style = Melyviz.label, modifier = Modifier.padding(vertical = 8.dp))
        val submit = {
            if (!waiting && s.isNotEmpty()) { V.unlock(s.toCharArray()); s = "" }
            Unit
        }
        Field(s, { s = it }, if (waiting) "Várj ${(until - now) / 1000 + 1} mp…" else kind.label, secret = true,
            digits = kind == SecretKind.PIN, onDone = submit)
        Row(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            VrgChip(if (busy) "Feloldás…" else "Feloldás", selected = true) { submit() }
            if (bio) VrgChip("☝ Ujjlenyomat") { V.unlockBio(ctx) }
        }
        note?.let { Hint(it, warn = true) }
    }
}

@Composable
private fun Lost() {
    var sure by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth().padding(top = 12.dp)) {
        Hint("A Széf kulcsa nincs meg ezen a telefonon (gyári visszaállítás, vagy a fájlok másik telefonról jöttek). " +
            "A titkosított tartalom így nem nyitható meg, a PIN-kód sem segít.", warn = true)
        Hint("Kezdj új Széfet, majd Beállítások → Visszaállítás mentésből, ha van .vrgvault mentésed.")
        Row(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (!sure) VrgChip("Új Széf…") { sure = true }
            else { VrgChip("Igen, a régi törlődik", selected = true) { V.startOver() }; VrgChip("Mégse") { sure = false } }
        }
    }
}

// ---- the list ---------------------------------------------------------------------------------------------------------

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ColumnScope.Browse() {
    val ctx = LocalContext.current
    val idx by V.index.collectAsStateWithLifecycle()
    val here by V.folder.collectAsStateWithLifecycle()
    val busy by V.busy.collectAsStateWithLifecycle()
    var q by rememberSaveable { mutableStateOf("") }
    var adding by remember { mutableStateOf(false) }
    var camPath by rememberSaveable { mutableStateOf<String?>(null) }

    val pick = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { u -> if (u != null) V.importUri(ctx, u) }
    val shoot = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { ok ->
        val f = camPath?.let(::File)
        camPath = null
        if (ok && f != null && f.length() > 0) V.importPhoto(f) else f?.delete()
    }
    fun startCamera() {
        val f = File(File(V.outDir(), "cam").apply { mkdirs() }, "IMG_${SimpleDateFormat("yyyyMMdd_HHmmss", Locale.ROOT).format(Date())}.jpg")
        camPath = f.absolutePath
        try { shoot.launch(FileStore.uri(ctx, f)) } catch (e: Exception) { camPath = null; V.notes.tryEmit("Nincs kamera alkalmazás.") }
    }
    val askCamera = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        if (ok) startCamera() else V.notes.tryEmit("A fotóhoz kamera engedély kell.")
    }

    fun draft(kind: VaultKind, t: VaultTemplate? = null) {
        adding = false
        val id = VaultCrypto.newId()
        val now = System.currentTimeMillis()
        val draft = VaultItem(id, kind, if (t != null && t != VaultTemplates.CUSTOM) t.label else "", here,
            template = t?.id, fields = t?.blank() ?: emptyList(), created = now, updated = now)
        V.view.value = V.View.Edit(draft, isNew = true)
    }

    // crumbs
    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text("⌂", style = Melyviz.label.copy(color = Melyviz.current), modifier = Modifier.clickable { V.enter(null) }.padding(end = 6.dp))
        val crumbs = idx.crumbs(here)
        crumbs.forEachIndexed { i, c ->
            Text(" / ", style = Melyviz.small)
            Text(c.title, style = Melyviz.label.copy(color = if (i == crumbs.lastIndex) Melyviz.ink else Melyviz.current),
                maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.clickable { if (i != crumbs.lastIndex) V.enter(c.id) })
        }
        if (busy) Text("  …", style = Melyviz.small)
    }
    Field(q, { q = it }, "Keresés a Széfben…")
    FlowRow(Modifier.padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        VrgChip("+ Új", selected = adding) { adding = !adding }
        if (adding) {
            VrgChip("▸ Mappa") { draft(VaultKind.FOLDER) }
            VrgChip("✎ Dokumentum") { draft(VaultKind.NOTE) }
            VrgChip("📎 Fájl") { adding = false; pick.launch(arrayOf("*/*")) }
            VrgChip("📷 Fotó") {
                adding = false
                if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) startCamera()
                else askCamera.launch(Manifest.permission.CAMERA)
            }
        }
    }
    if (adding) {
        Text("Adatlap", style = Melyviz.small, modifier = Modifier.padding(top = 4.dp))
        FlowRow(Modifier.padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            VaultTemplates.ALL.forEach { t -> VrgChip("${t.glyph} ${t.label}") { draft(VaultKind.RECORD, t) } }
        }
    }

    val rows = if (q.isNotBlank()) idx.search(q) else idx.children(here)
    Column(Modifier.fillMaxWidth().weight(1f).padding(top = 6.dp).background(Melyviz.surface, RoundedCornerShape(Melyviz.radius))
        .border(1.dp, Melyviz.lineSoft, RoundedCornerShape(Melyviz.radius)).verticalScroll(rememberScrollState())) {
        if (rows.isEmpty()) Text(when {
            q.isNotBlank() -> "Nincs találat. (A rejtett mezők értékében nem keres.)"
            here == null -> "Még üres. + Új: mappa, dokumentum, ügyfél vagy igazolvány adatlap, fájl, fotó."
            else -> "Üres mappa."
        }, style = Melyviz.small, modifier = Modifier.padding(12.dp))
        rows.forEach { r -> Line(r, idx, showPath = q.isNotBlank()) }
    }
    Text("Titkosítva ezen a telefonon (AES-256). Zárás: 🔒, képernyő ki, vagy háttérben ${lockLabel()} után.",
        style = Melyviz.small.copy(fontSize = 10.sp, color = Melyviz.faint), modifier = Modifier.padding(vertical = 8.dp))
}

private fun lockLabel(): String {
    val ms = V.store.header()?.lockAfter ?: VaultLock.DEFAULT_TIMEOUT
    return VaultLock.TIMEOUTS.firstOrNull { it.first == ms }?.second?.lowercase(Locale.ROOT) ?: "${ms / 1000} mp"
}

@Composable
private fun Line(r: VaultItem, idx: VaultIndex, showPath: Boolean) {
    Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable {
        if (r.kind == VaultKind.FOLDER) V.enter(r.id) else V.go(r.id, V.View.Item(r.id))
    }.padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(r.glyph, style = Melyviz.label.copy(color = if (r.kind == VaultKind.FOLDER) Melyviz.current else Melyviz.glow), modifier = Modifier.width(30.dp))
        Column(Modifier.weight(1f)) {
            Text(r.title, style = Melyviz.label.copy(color = if (r.kind == VaultKind.FOLDER) Melyviz.current else Melyviz.ink),
                maxLines = 1, overflow = TextOverflow.Ellipsis)
            val sub = buildList {
                if (showPath) idx.crumbs(r.parent).joinToString(" / ") { it.title }.takeIf { it.isNotEmpty() }?.let(::add)
                when (r.kind) {
                    VaultKind.FOLDER -> add("${idx.children(r.id).size} elem")
                    VaultKind.FILE -> add(VaultFiles.size(r.file?.size ?: 0))
                    VaultKind.RECORD -> add(VaultTemplates.byId(r.template).label)
                    VaultKind.NOTE -> {}
                }
            }.joinToString(" · ")
            if (sub.isNotEmpty()) Text(sub, style = Melyviz.small.copy(fontSize = 10.sp), maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        if (r.guard) Text("🔒", style = Melyviz.small)
    }
}

// ---- one item ---------------------------------------------------------------------------------------------------------

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ColumnScope.ItemView(id: String) {
    val ctx = LocalContext.current
    val idx by V.index.collectAsStateWithLifecycle()
    val item = idx.get(id) ?: run { LaunchedEffect(id) { V.view.value = V.View.List }; return }
    var confirmDelete by remember(id) { mutableStateOf(false) }
    var moving by remember(id) { mutableStateOf(false) }
    val shown = remember(id) { mutableStateListOf<Int>() }
    val saveOut = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument(item.file?.mime ?: "application/octet-stream")) { u ->
        if (u != null) V.saveOut(ctx, item, u)
    }

    Text("${item.glyph}  ${item.title}", style = Melyviz.label.copy(fontSize = 16.sp), modifier = Modifier.padding(top = 8.dp),
        maxLines = 2, overflow = TextOverflow.Ellipsis)
    Text(buildString {
        if (item.kind == VaultKind.RECORD) append(VaultTemplates.byId(item.template).label).append(" · ")
        append("módosítva ").append(DAY.format(Date(item.updated)))
    }, style = Melyviz.small.copy(fontSize = 10.sp))
    FlowRow(Modifier.padding(vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        VrgChip("‹ Lista") { V.view.value = V.View.List }
        VrgChip("✎ Szerkesztés") { V.view.value = V.View.Edit(item, isNew = false) }
        if (item.kind == VaultKind.FILE) {
            VrgChip("↗ Megnyitás") { V.openElsewhere(ctx, item) }
            VrgChip("⤓ Mentés a telefonra") { saveOut.launch(item.file?.name ?: "fajl") }
        }
        VrgChip("⇢ Áthelyezés", selected = moving) { moving = !moving; confirmDelete = false }
        VrgChip("🗑 Törlés", selected = confirmDelete) { confirmDelete = !confirmDelete; moving = false }
    }
    if (confirmDelete) Card {
        Hint("Végleg törlöd: ${item.title}? Ez nem vonható vissza.", warn = true)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            VrgChip("Törlés", selected = true) { if (V.remove(item.id)) V.view.value = V.View.List }
            VrgChip("Mégse") { confirmDelete = false }
        }
    }
    if (moving) MovePicker(item, idx) { moving = false }

    Column(Modifier.fillMaxWidth().weight(1f).padding(top = 6.dp)) {
        when (item.kind) {
            VaultKind.NOTE -> Card(Modifier.weight(1f)) {
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                    Text(item.body.ifEmpty { "(üres)" }, style = Melyviz.label.copy(color = Melyviz.ink, fontSize = 14.sp))
                }
            }
            VaultKind.RECORD -> Card(Modifier.weight(1f)) {
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                    item.fields.forEachIndexed { i, f ->
                        Text(f.label, style = Melyviz.small.copy(fontSize = 10.sp), modifier = Modifier.padding(top = if (i == 0) 0.dp else 10.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            val open = !f.secret || i in shown
                            Text(if (open) f.value.ifEmpty { "—" } else VaultFiles.mask(f.value),
                                style = Melyviz.label.copy(color = Melyviz.ink, fontSize = 15.sp), modifier = Modifier.weight(1f))
                            if (f.secret && f.value.isNotEmpty()) Text(if (open) "◌" else "👁", style = Melyviz.label.copy(color = Melyviz.current),
                                modifier = Modifier.clickable { if (open) shown.remove(i) else shown.add(i) }.padding(8.dp))
                            if (f.value.isNotEmpty()) Text("⧉", style = Melyviz.label.copy(color = Melyviz.current),
                                modifier = Modifier.clickable { V.copy(ctx, f.value) }.padding(8.dp))
                        }
                    }
                    if (item.body.isNotEmpty()) {
                        Text("Megjegyzés", style = Melyviz.small.copy(fontSize = 10.sp), modifier = Modifier.padding(top = 10.dp))
                        Text(item.body, style = Melyviz.label.copy(color = Melyviz.ink))
                    }
                }
            }
            VaultKind.FILE -> FileLook(item, Modifier.weight(1f))
            VaultKind.FOLDER -> LaunchedEffect(id) { V.enter(id) }
        }
    }
}

@Composable
private fun FileLook(item: VaultItem, modifier: Modifier) {
    val f = item.file ?: return
    var img by remember(item.id) { mutableStateOf<ImageBitmap?>(null) }
    var text by remember(item.id) { mutableStateOf<String?>(null) }
    var failed by remember(item.id) { mutableStateOf(false) }
    val image = VaultFiles.isImage(f.mime)
    val plain = VaultFiles.isText(f.mime, f.name) && f.size <= 512 * 1024
    LaunchedEffect(item.id) {
        if (!image && !plain) return@LaunchedEffect
        val b = V.read(item.id) ?: run { failed = true; return@LaunchedEffect }
        if (image) {
            val o = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeByteArray(b, 0, b.size, o)
            var sample = 1
            while (maxOf(o.outWidth, o.outHeight) / sample > 2048) sample *= 2
            img = BitmapFactory.decodeByteArray(b, 0, b.size, BitmapFactory.Options().apply { inSampleSize = sample })?.asImageBitmap()
            failed = img == null
        } else text = String(b, Charsets.UTF_8)
        b.fill(0)
    }
    Card(modifier) {
        Text("${f.name} · ${VaultFiles.size(f.size)} · ${f.mime}", style = Melyviz.small.copy(fontSize = 10.sp), maxLines = 1, overflow = TextOverflow.Ellipsis)
        Spacer(Modifier.height(6.dp))
        when {
            failed -> Hint("A fájl nem nyílik (sérült?).", warn = true)
            img != null -> Image(img!!, f.name, Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
            text != null -> Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                Text(text!!, style = Melyviz.readout.copy(color = Melyviz.ink, fontSize = 11.sp))
            }
            image || plain -> Hint("Visszafejtés…")
            else -> Hint("Ezt a fájlt a Széf nem mutatja. ↗ Megnyitás: egy visszafejtett másolat a zárásig, egy másik appban.")
        }
    }
}

@Composable
private fun MovePicker(item: VaultItem, idx: VaultIndex, done: () -> Unit) {
    val blocked = idx.subtree(item.id).map { it.id }.toSet()
    val targets = idx.items.filter { it.kind == VaultKind.FOLDER && it.id !in blocked }
        .map { f -> f to (idx.crumbs(f.id).joinToString(" / ") { it.title }) }.sortedBy { it.second.lowercase(Locale.ROOT) }
    Card(Modifier.heightIn(max = 260.dp)) {
        Text("Hová?", style = Melyviz.small)
        Column(Modifier.verticalScroll(rememberScrollState())) {
            if (item.parent != null) Text("⌂ Felső szint", style = Melyviz.label.copy(color = Melyviz.current),
                modifier = Modifier.fillMaxWidth().clickable { V.move(item.id, null); done() }.padding(vertical = 8.dp))
            targets.filter { it.first.id != item.parent }.forEach { (f, path) ->
                Text("▸ $path", style = Melyviz.label.copy(color = Melyviz.current), maxLines = 1, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.fillMaxWidth().clickable { V.move(item.id, f.id); done() }.padding(vertical = 8.dp))
            }
            if (targets.isEmpty() && item.parent == null) Hint("Nincs mappa, ahová kerülhetne.")
        }
    }
}

// ---- the editor -------------------------------------------------------------------------------------------------------

@Composable
private fun ColumnScope.Editor(e: V.View.Edit) {
    val d = e.draft
    var title by remember(d.id) { mutableStateOf(d.title) }
    var body by remember(d.id) { mutableStateOf(d.body) }
    var guard by remember(d.id) { mutableStateOf(d.guard) }
    val fields = remember(d.id) { mutableStateListOf<VaultField>().apply { addAll(d.fields) } }
    var newLabel by remember(d.id) { mutableStateOf("") }
    var newSecret by remember(d.id) { mutableStateOf(false) }
    val shown = remember(d.id) { mutableStateListOf<Int>() }

    Text(when (d.kind) {
        VaultKind.FOLDER -> if (e.isNew) "Új mappa" else "Mappa"
        VaultKind.NOTE -> if (e.isNew) "Új dokumentum" else "Dokumentum"
        VaultKind.RECORD -> VaultTemplates.byId(d.template).let { "${it.glyph} ${it.label}" }
        VaultKind.FILE -> "Fájl"
    }, style = Melyviz.small, modifier = Modifier.padding(top = 6.dp))
    Column(Modifier.fillMaxWidth().weight(1f).verticalScroll(rememberScrollState())) {
        Field(title, { title = it.take(VaultIndex.MAX_TITLE) }, if (d.kind == VaultKind.RECORD) "Megnevezés (pl. ügyfél neve)" else "Cím")
        if (d.kind == VaultKind.RECORD) {
            fields.forEachIndexed { i, f ->
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
                    Text(f.label + if (f.secret) "  🔒" else "", style = Melyviz.small.copy(fontSize = 10.sp), modifier = Modifier.weight(1f))
                    if (f.secret) Text(if (i in shown) "◌" else "👁", style = Melyviz.small.copy(color = Melyviz.current),
                        modifier = Modifier.clickable { if (i in shown) shown.remove(i) else shown.add(i) }.padding(horizontal = 6.dp))
                    if (VaultTemplates.byId(d.template) == VaultTemplates.CUSTOM || f.label !in VaultTemplates.byId(d.template).fields.map { it.first })
                        Text("✕", style = Melyviz.small.copy(color = Melyviz.coral), modifier = Modifier.clickable { fields.removeAt(i); shown.clear() }.padding(horizontal = 6.dp))
                }
                Field(f.value, { fields[i] = f.with(it) }, f.label, secret = f.secret && i !in shown, single = !f.label.startsWith("Megjegyzés"))
            }
            Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Field(newLabel, { newLabel = it.take(40) }, "Új mező neve", modifier = Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                VrgChip("🔒 Rejtett", selected = newSecret) { newSecret = !newSecret }
                VrgChip("+ Mező") { if (newLabel.isNotBlank()) { fields.add(VaultField(newLabel.trim(), "", newSecret)); newLabel = ""; newSecret = false } }
            }
        }
        if (d.kind == VaultKind.NOTE || d.kind == VaultKind.RECORD) {
            Field(body, { body = it.take(VaultIndex.MAX_BODY) }, if (d.kind == VaultKind.NOTE) "Szöveg" else "Megjegyzés",
                single = false, modifier = Modifier.heightIn(min = if (d.kind == VaultKind.NOTE) 220.dp else 80.dp))
        }
        VrgToggle("Megnyitáskor újra azonosítás", guard) { guard = it }
        Hint(if (d.kind == VaultKind.FOLDER) "A mappa és minden, ami benne van, a nyitott Széfben is külön PIN-kódot / ujjlenyomatot kér."
            else "A nyitott Széfben is külön PIN-kódot / ujjlenyomatot kér, mielőtt megmutatja.")
    }
    Row(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        VrgChip("Mentés", selected = true) {
            val item = d.copy(title = title, body = body, guard = guard, fields = fields.toList())
            if (V.save(item, e.isNew)) V.view.value = if (d.kind == VaultKind.FOLDER) V.View.List else V.View.Item(d.id)
        }
        VrgChip("Mégse") { back() }
    }
}

// ---- the guard --------------------------------------------------------------------------------------------------------

@Composable
private fun GuardView(g: V.View.Guard) {
    val ctx = LocalContext.current
    val bio = remember { V.bioOn() }
    val kind = remember { V.store.header()?.kind ?: SecretKind.PIN }
    var s by remember { mutableStateOf("") }
    var err by remember { mutableStateOf<String?>(null) }
    fun bioCheck() = VaultKeys.confirm(ctx) { r ->
        when (r) {
            is VaultKeys.BioResult.Ok -> V.guardPassed(g)
            is VaultKeys.BioResult.Failed -> { err = r.why }
            else -> {}
        }
    }
    LaunchedEffect(g.target) { if (bio) bioCheck() }
    val submit = {
        val ok = V.session()?.verify(s.toCharArray()) == true
        s = ""
        if (ok) V.guardPassed(g) else { err = "Hibás kód." }
        Unit
    }
    Column(Modifier.fillMaxWidth().padding(top = 16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text("🔒", style = Melyviz.glyph.copy(fontSize = 36.sp))
        Text("Védett: ${V.index.value.get(g.target)?.title ?: ""}", style = Melyviz.label, modifier = Modifier.padding(vertical = 8.dp),
            maxLines = 2, overflow = TextOverflow.Ellipsis)
        Field(s, { s = it; err = null }, kind.label, secret = true, digits = kind == SecretKind.PIN, onDone = submit)
        Row(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            VrgChip("Megnyitás", selected = true) { submit() }
            if (bio) VrgChip("☝ Ujjlenyomat") { bioCheck() }
            VrgChip("Mégse") { V.view.value = V.View.List }
        }
        err?.let { Hint(it, warn = true) }
    }
}

// ---- settings ---------------------------------------------------------------------------------------------------------

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ColumnScope.SettingsView() {
    val ctx = LocalContext.current
    val busy by V.busy.collectAsStateWithLifecycle()
    var h by remember { mutableStateOf(V.store.header()) }
    fun refresh() { h = V.store.header() }
    val bioWhy = remember { VaultKeys.bioProblem(ctx) }
    var bioOn by remember { mutableStateOf(V.bioOn()) }

    var backupPass by remember { mutableStateOf("") }
    var backupPass2 by remember { mutableStateOf("") }
    var backupErr by remember { mutableStateOf<String?>(null) }
    var restorePass by remember { mutableStateOf("") }
    val pending = remember { arrayOfNulls<CharArray>(1) }
    val makeBackup = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument(VaultBackup.MIME)) { u ->
        val p = pending[0]; pending[0] = null
        if (u != null && p != null) V.backup(ctx, u, p) else VaultCrypto.wipe(p)
    }
    val pickBackup = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { u ->
        val p = pending[0]; pending[0] = null
        if (u != null && p != null) V.restore(ctx, u, p) else VaultCrypto.wipe(p)
    }

    var oldS by remember { mutableStateOf("") }
    var newS by remember { mutableStateOf("") }
    var newS2 by remember { mutableStateOf("") }
    var newKind by remember { mutableStateOf(h?.kind ?: SecretKind.PIN) }
    var changeMsg by remember { mutableStateOf<String?>(null) }
    var delS by remember { mutableStateOf("") }
    var delOpen by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxWidth().weight(1f).verticalScroll(rememberScrollState())) {
        VrgSectionTitle("Zárás")
        Text("Automatikus zárás háttérben", style = Melyviz.small)
        FlowRow(Modifier.padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            VaultLock.TIMEOUTS.forEach { (ms, label) ->
                VrgChip(label, selected = h?.lockAfter == ms) { V.session()?.setOptions(lockAfter = ms); refresh() }
            }
        }
        Hint("A képernyő kikapcsolásakor mindig zár.")
        VrgToggle("10 hibás próba után törlés", h?.wipeAtTen == true) { V.session()?.setOptions(wipeAtTen = it); refresh() }
        Hint("Bekapcsolva a tizedik egymás utáni hibás kód végleg törli a Széfet. Kikapcsolva csak egyre hosszabb várakozás jön (5. hiba után).")

        VrgSectionTitle("Ujjlenyomat / arc")
        if (bioWhy != null) Hint(bioWhy, warn = true)
        else VrgToggle("Feloldás ujjlenyomattal", bioOn) { on ->
            if (on) V.enrollBio(ctx) else V.disableBio()
            bioOn = on
        }
        Hint("A PIN-kód mindig működik. Új ujjlenyomat rögzítése után ezt újra be kell kapcsolni.")

        VrgSectionTitle("Kód cseréje")
        KindChoice(newKind) { newKind = it; newS = ""; newS2 = "" }
        Field(oldS, { oldS = it }, "Jelenlegi ${h?.kind?.label ?: "kód"}", secret = true, digits = h?.kind == SecretKind.PIN)
        Field(newS, { newS = it }, "Új ${newKind.label}", secret = true, digits = newKind == SecretKind.PIN)
        Field(newS2, { newS2 = it }, "Még egyszer", secret = true, digits = newKind == SecretKind.PIN)
        changeMsg?.let { Hint(it, warn = true) }
        Row(Modifier.padding(vertical = 4.dp)) {
            VrgChip("Kód cseréje") {
                changeMsg = when {
                    newS != newS2 -> "Az új kód kétszer nem egyezik."
                    else -> try {
                        V.session()?.changeSecret(oldS.toCharArray(), newS.toCharArray(), newKind); refresh(); "Kész: az új kód él."
                    } catch (e: Exception) { e.message }
                }
                oldS = ""; newS = ""; newS2 = ""
            }
        }

        VrgSectionTitle("Mentés fájlba")
        Hint("Egy titkosított .vrgvault fájl a teljes Széfről, saját jelszóval. Ezzel jön vissza a tartalom új telefonon vagy gyári visszaállítás után. " +
            "Tedd biztos helyre (pl. a PC-re az Átadással), és a jelszavát ne a Széfben tartsd.")
        Field(backupPass, { backupPass = it; backupErr = null }, "A mentés jelszava (legalább ${VaultSecret.PASS_MIN} karakter)", secret = true)
        Field(backupPass2, { backupPass2 = it; backupErr = null }, "Még egyszer", secret = true)
        backupErr?.let { Hint(it, warn = true) }
        Row(Modifier.padding(vertical = 4.dp)) {
            VrgChip(if (busy) "Mentés…" else "⤓ Mentés…") {
                backupErr = VaultSecret.problem(backupPass, SecretKind.PASS) ?: if (backupPass != backupPass2) "A kettő nem egyezik." else null
                if (backupErr == null) {
                    pending[0] = backupPass.toCharArray(); backupPass = ""; backupPass2 = ""
                    makeBackup.launch(VaultBackup.fileName(SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(Date())))
                }
            }
        }

        VrgSectionTitle("Visszaállítás mentésből")
        Hint("A mentés elemei hozzáadódnak (ami már itt van, kimarad), abba a mappába, amelyik a listában nyitva volt.")
        Field(restorePass, { restorePass = it }, "A mentés jelszava", secret = true)
        Row(Modifier.padding(vertical = 4.dp)) {
            VrgChip("⤒ Mentés kiválasztása…") {
                if (restorePass.isNotEmpty()) { pending[0] = restorePass.toCharArray(); restorePass = ""; pickBackup.launch(arrayOf("*/*")) }
                else V.notes.tryEmit("Előbb írd be a mentés jelszavát.")
            }
        }

        VrgSectionTitle("A Széf törlése")
        if (!delOpen) Row { VrgChip("Széf törlése…") { delOpen = true } }
        else {
            Hint("Minden tartalom végleg törlődik erről a telefonról. Erősítsd meg a kóddal.", warn = true)
            Field(delS, { delS = it }, h?.kind?.label ?: "Kód", secret = true, digits = h?.kind == SecretKind.PIN)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                VrgChip("Végleges törlés", selected = true) {
                    if (!V.destroy(delS.toCharArray())) V.notes.tryEmit("Hibás kód.")
                    delS = ""
                }
                VrgChip("Mégse") { delOpen = false; delS = "" }
            }
        }
        h?.let { Text("Létrehozva: ${DAY.format(Date(it.created))} · PBKDF2 ${it.iterations} kör · AES-256-GCM · Android Keystore",
            style = Melyviz.small.copy(fontSize = 10.sp, color = Melyviz.faint), modifier = Modifier.padding(vertical = 12.dp)) }
    }
}
