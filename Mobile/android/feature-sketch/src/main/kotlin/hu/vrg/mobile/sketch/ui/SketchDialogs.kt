package hu.vrg.mobile.sketch.ui

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.ui.VrgToggle
import hu.vrg.mobile.sketch.Geo
import hu.vrg.mobile.sketch.MeasureKind
import hu.vrg.mobile.sketch.Ops
import hu.vrg.mobile.sketch.Photos
import java.io.File
import hu.vrg.mobile.sketch.Plugins
import kotlin.math.roundToInt

@Composable
internal fun Field(value: String, onChange: (String) -> Unit, label: String, number: Boolean = false, lines: Int = 1, placeholder: String = "") {
    OutlinedTextField(
        value = value, onValueChange = { v -> onChange(if (number) v.filter { it.isDigit() }.take(6) else v) },
        label = { Text(label, style = Melyviz.small) },
        placeholder = { if (placeholder.isNotEmpty()) Text(placeholder, style = Melyviz.small) },
        singleLine = lines == 1, minLines = lines,
        keyboardOptions = if (number) KeyboardOptions(keyboardType = KeyboardType.Number) else KeyboardOptions.Default,
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Melyviz.glow, unfocusedBorderColor = Melyviz.line,
            focusedTextColor = Melyviz.ink, unfocusedTextColor = Melyviz.ink, cursorColor = Melyviz.glow,
        ),
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
    )
}

/** One text (or number) field, OK / Mégse, and optionally Törlés. */
@Composable
internal fun TextDialog(
    title: String, label: String, initial: String, onDismiss: () -> Unit,
    number: Boolean = false, lines: Int = 1, onDelete: (() -> Unit)? = null, onOk: (String) -> Unit,
) {
    var v by remember { mutableStateOf(initial) }
    AlertDialog(
        onDismissRequest = onDismiss, containerColor = Melyviz.raised,
        title = { Text(title, style = Melyviz.label) },
        text = { Field(v, { v = it }, label, number, lines) },
        confirmButton = { TextButton({ onOk(v) }) { Text("Rendben", color = Melyviz.glow) } },
        dismissButton = {
            if (onDelete != null) TextButton(onDelete) { Text("Törlés", color = Melyviz.coral) }
            TextButton(onDismiss) { Text("Mégse", color = Melyviz.muted) }
        },
    )
}

/** A photo scaled to about [max] px on its long side and turned upright from its EXIF orientation. */
internal fun loadPhoto(f: File, max: Int = 1400): Bitmap? = try {
    val b = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(f.path, b)
    var k = 1
    while (b.outWidth / (k * 2) >= max || b.outHeight / (k * 2) >= max) k *= 2
    val bmp = BitmapFactory.decodeFile(f.path, BitmapFactory.Options().apply { inSampleSize = k })
    val deg = when (ExifInterface(f.path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
        ExifInterface.ORIENTATION_ROTATE_90 -> 90f
        ExifInterface.ORIENTATION_ROTATE_180 -> 180f
        ExifInterface.ORIENTATION_ROTATE_270 -> 270f
        else -> 0f
    }
    if (bmp == null || deg == 0f) bmp else Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, Matrix().apply { postRotate(deg) }, true)
} catch (e: Exception) { null }

private fun fmt(mm: Double) = mm.roundToInt().toString().reversed().chunked(3).joinToString(" ").reversed()

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun SketchDialogs(st: EditorState) {
    val a = st.ask ?: return
    val close = { st.ask = null }
    val s = st.sketch
    when (a) {
        is Ask.MemoNew -> TextDialog("Memó", "Mi legyen itt?", "", close, lines = 3) { t ->
            Ops.addMemo(st.sketch, a.at, t, a.target)?.let { st.edit(it.first) }; close()
        }
        is Ask.MemoEdit -> {
            val m = s.memo(a.id) ?: return close()
            TextDialog("Memó", "Szöveg (üresen: törlés)", m.text, close, lines = 3, onDelete = { st.edit(Ops.delete(st.sketch, a.id)); close() }) { t ->
                st.edit(Ops.editMemo(st.sketch, a.id, t)); close()
            }
        }
        is Ask.MeasureEdge -> {
            val r = s.room(a.room) ?: return close()
            val old = s.measures.firstOrNull { it.room == a.room && it.kind == MeasureKind.EDGE && it.edge == a.edge }
            val nr = st.norm.room(a.room)
            val guess = nr?.takeIf { it.poly.size == r.poly.size }?.let { val (p, q) = Geo.edge(it.poly, a.edge); "≈ " + fmt(p.dist(q)) + " mm" } ?: ""
            TextDialog("${roomTitle(r.name, r.kinds)} · fal hossza (mm)", if (guess.isEmpty()) "mm" else "most: $guess", old?.mm?.toString() ?: "", close,
                number = true, onDelete = old?.let { { st.setMeasure(a.room, MeasureKind.EDGE, 0, a.edge); close() } }) { v ->
                st.setMeasure(a.room, MeasureKind.EDGE, v.toIntOrNull() ?: 0, a.edge); close()
            }
        }
        is Ask.MeasureRoom -> {
            val r = s.room(a.room) ?: return close()
            val w0 = s.measures.firstOrNull { it.room == a.room && it.kind == MeasureKind.WIDTH }?.mm?.toString() ?: ""
            val d0 = s.measures.firstOrNull { it.room == a.room && it.kind == MeasureKind.DEPTH }?.mm?.toString() ?: ""
            var w by remember(a) { mutableStateOf(w0) }
            var d by remember(a) { mutableStateOf(d0) }
            val nr = st.norm.room(a.room)
            val box = nr?.takeIf { it.poly.size >= 3 }?.let { Geo.bbox(it.poly) }
            AlertDialog(
                onDismissRequest = close, containerColor = Melyviz.raised,
                title = { Text("${roomTitle(r.name, r.kinds)} · méret (mm)", style = Melyviz.label) },
                text = {
                    Column {
                        Field(w, { w = it }, "Szélesség ↔", number = true, placeholder = box?.let { "most ≈ " + fmt(it.second.x - it.first.x) } ?: "")
                        Field(d, { d = it }, "Mélység ↕", number = true, placeholder = box?.let { "most ≈ " + fmt(it.second.y - it.first.y) } ?: "")
                        Text("Üresen hagyva a Rendezés számolja vagy becsüli. Egy falat a Méret eszközzel a falra koppintva mérhetsz.", style = Melyviz.small)
                    }
                },
                confirmButton = {
                    TextButton({
                        var x = Ops.setMeasure(st.sketch, a.room, MeasureKind.WIDTH, w.toIntOrNull() ?: 0)
                        x = Ops.setMeasure(x, a.room, MeasureKind.DEPTH, d.toIntOrNull() ?: 0)
                        st.edit(x); close()
                    }) { Text("Rendben", color = Melyviz.glow) }
                },
                dismissButton = { TextButton(close) { Text("Mégse", color = Melyviz.muted) } },
            )
        }
        is Ask.RoomName -> {
            val r = s.room(a.room) ?: return close()
            TextDialog("Szoba neve", "pl. Gyerekszoba (üresen: a típusa)", r.name, close) { t -> st.edit(Ops.renameRoom(st.sketch, a.room, t)); close() }
        }
        is Ask.SketchName -> TextDialog("Vázlat címe", "Cím vagy ügyfél", s.name, close) { t -> st.rename(t); close() }
        is Ask.TagPick -> {
            var fresh by remember(a) { mutableStateOf("") }
            val on = a.target?.let { t -> Ops.tagsOf(s, t).map { it.id }.toSet() } ?: emptySet()
            AlertDialog(
                onDismissRequest = close, containerColor = Melyviz.raised,
                title = { Text(if (a.target == null && a.at == null) "Új címke" else "Címkék" + (a.target?.let { " · " + st.describeId(it) } ?: " a lapra"), style = Melyviz.label) },
                text = {
                    Column {
                        if (a.target != null || a.at != null) FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            s.tags.forEach { t ->
                                VrgChip("#" + t.name, selected = t.id in on) {
                                    val tgt = a.target
                                    if (tgt != null) {
                                        val use = st.sketch.tagUses.firstOrNull { it.tag == t.id && it.target == tgt }
                                        if (use != null) st.edit(Ops.delete(st.sketch, use.id))
                                        else Ops.placeTag(st.sketch, t.id, tgt, null)?.let { st.edit(it.first) }
                                    } else {
                                        Ops.placeTag(st.sketch, t.id, null, a.at)?.let { st.edit(it.first) }; close()
                                    }
                                }
                            }
                        }
                        Field(fresh, { fresh = it }, "Új címke neve", placeholder = "pl. Padlófűtés")
                        Text("A Fürdő és Konyha címke a szoba típusa lesz a Plannerben; az IP44, Dedikált és Bontás a pont vagy kör jelzője.", style = Melyviz.small)
                    }
                },
                confirmButton = {
                    TextButton({
                        val r = Ops.addTag(st.sketch, fresh)
                        if (r != null) {
                            st.edit(r.first)
                            when {
                                a.target != null -> Ops.placeTag(st.sketch, r.second, a.target, null)?.let { st.edit(it.first) }
                                a.at != null -> Ops.placeTag(st.sketch, r.second, null, a.at)?.let { st.edit(it.first) }
                                else -> st.activeTag = r.second
                            }
                        }
                        close()
                    }) { Text(if (fresh.isBlank()) "Kész" else "Hozzáad", color = Melyviz.glow) }
                },
            )
        }
        is Ask.CircuitEdit -> {
            val k = s.circuit(a.id) ?: return close()
            var name by remember(a) { mutableStateOf(k.name) }
            AlertDialog(
                onDismissRequest = close, containerColor = Melyviz.raised,
                title = { Text("Áramkör", style = Melyviz.label) },
                text = {
                    Column {
                        Field(name, { name = it }, "Név")
                        VrgToggle("Dedikált (egy fogyasztó, egyenesen az Elosztóból)", k.dedicated) { st.edit(Ops.setDedicated(st.sketch, a.id, it)) }
                        Text("${k.members.size} pont · " + (s.point(k.board)?.let { "Elosztó: bekötve" } ?: "még nincs Elosztón"), style = Melyviz.small)
                        if (k.board != null) VrgChip("Leválasztás az Elosztóról") { st.edit(Ops.setBoard(st.sketch, a.id, null)) }
                    }
                },
                confirmButton = { TextButton({ st.edit(Ops.renameCircuit(st.sketch, a.id, name)); close() }) { Text("Rendben", color = Melyviz.glow) } },
                dismissButton = {
                    TextButton({ st.edit(Ops.delete(st.sketch, a.id)); close() }) { Text("Kör törlése", color = Melyviz.coral) }
                },
            )
        }
        is Ask.PhotoView -> {
            val pp = s.photos.firstOrNull { it.id == a.id } ?: return close()
            val shot = Photos.shot(pp, a.deg) ?: return close()
            val dir = st.photoDir
            val bmp = remember(shot.file) { dir?.let { loadPhoto(File(it, shot.file)) } }
            val room = s.room(pp.room)?.let { roomTitle(it.name, it.kinds) } ?: "Fotópont"
            AlertDialog(
                onDismissRequest = close, containerColor = Melyviz.raised,
                title = { Text("$room · ${Photos.label(a.deg)} felé (${pp.shots.size}/4)", style = Melyviz.label) },
                text = {
                    Column {
                        if (bmp != null) Image(bmp.asImageBitmap(), contentDescription = "$room, ${Photos.label(a.deg)} felé",
                            contentScale = ContentScale.Fit, modifier = Modifier.fillMaxWidth().heightIn(max = 420.dp))
                        else Text("A fotó nem olvasható.", style = Melyviz.small.copy(color = Melyviz.coral))
                        Text("Más irányba nézett?", style = Melyviz.small, modifier = Modifier.padding(top = 8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Photos.DIRS.forEach { d ->
                                VrgChip(Photos.label(d), selected = d == a.deg) { if (d != a.deg) { st.turnShot(a.id, a.deg, d); st.ask = Ask.PhotoView(a.id, d) } }
                            }
                        }
                    }
                },
                confirmButton = { TextButton({ close(); st.camera = CameraReq(a.id, a.deg) }) { Text("Újra", color = Melyviz.glow) } },
                dismissButton = {
                    TextButton({ st.removeShot(a.id, a.deg); close() }) { Text("Törlés", color = Melyviz.coral) }
                    TextButton(close) { Text("Bezár", color = Melyviz.muted) }
                },
            )
        }
        is Ask.Purposes -> PurposePicker(st, close)
        is Ask.CaptureView -> CaptureViewer(st, a.id, close)
        is Ask.Signature -> SignaturePad(st, close)                 // Kamera 2
        is Ask.Compare -> CompareDialog(st, a.before, a.after, close)
        is Ask.PairPick -> PairPickDialog(st, a.id, close)
        is Ask.VariantRequest -> VariantRequestDialog(st, close)
        is Ask.EntryEdit -> {
            val e = s.entry(a.id) ?: return close()
            var text by remember(a) { mutableStateOf(e.text) }
            var chips by remember(a) { mutableStateOf(e.chips) }
            var room by remember(a) { mutableStateOf(e.room) }
            var open by remember(a) { mutableStateOf(e.open) }
            AlertDialog(
                onDismissRequest = close, containerColor = Melyviz.raised,
                title = { Text("✎ Jegyzet · " + stamp(e.at), style = Melyviz.label) },
                text = {
                    Column(Modifier.verticalScroll(rememberScrollState())) {
                        Field(text, { text = it }, "Szöveg", lines = 3)
                        Text(if (open) "⚑ Tisztázandó" else "⚐ Tisztázandó?", style = Melyviz.label.copy(color = if (open) Melyviz.coral else Melyviz.muted),
                            modifier = Modifier.clickable { open = !open }.padding(vertical = 6.dp))
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            st.kit.chips.forEach { c -> ChipPill(c, c.id in chips) { chips = if (c.id in chips) chips - c.id else chips + c.id } }
                        }
                        Text("Szoba", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 8.dp))
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Pill("—", Melyviz.faint, room == null) { room = null }
                            s.rooms.forEach { r -> Pill(roomTitle(r.name, r.kinds), st.frontColor("vazlat"), room == r.id) { room = r.id } }
                        }
                    }
                },
                confirmButton = { TextButton({
                    st.editEntry(a.id, text, chips); if (room != e.room) st.linkEntry(a.id, room); if (open != e.open) st.setOpen(a.id, open); close()
                }) { Text("Rendben", color = Melyviz.glow) } },
                dismissButton = { TextButton({ st.deleteEntry(a.id); close() }) { Text("Törlés", color = Melyviz.coral) } },
            )
        }
        is Ask.PluginSheet -> AlertDialog(
            onDismissRequest = close, containerColor = Melyviz.raised,
            title = { Text("Bővítmények", style = Melyviz.label) },
            text = {
                Column(Modifier.verticalScroll(rememberScrollState())) {
                    Text("A Vázlat jegyzetfüzet; a bővítmények adják az eszközeit. Ami ki van kapcsolva, nem foglal helyet a sávban.", style = Melyviz.small)
                    Plugins.ALL.forEach { p ->
                        val label = p.label + if (!p.built) " (${p.wp}, tervben)" else ""
                        if (p.id == Plugins.NOTE.id || !p.built) Text("· $label: ${p.blurb}", style = Melyviz.small.copy(color = if (p.built) Melyviz.ink else Melyviz.faint), modifier = Modifier.padding(vertical = 6.dp))
                        else VrgToggle("$label: ${p.blurb}", p.id in st.sketch.plugins) { st.togglePlugin(p.id) }
                    }
                    VariantSection(st)
                    CameraFeatureSection(st)        // Kamera 2: each feature on its own switch (D-62)
                }
            },
            confirmButton = { TextButton(close) { Text("Kész", color = Melyviz.glow) } },
        )
    }
}
