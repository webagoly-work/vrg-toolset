package hu.vrg.mobile.sketch.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.ui.VrgToggle
import hu.vrg.mobile.sketch.Geo
import hu.vrg.mobile.sketch.MeasureKind
import hu.vrg.mobile.sketch.Ops
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
        is Ask.PluginSheet -> AlertDialog(
            onDismissRequest = close, containerColor = Melyviz.raised,
            title = { Text("Bővítmények", style = Melyviz.label) },
            text = {
                Column {
                    Text("A Vázlat jegyzetfüzet; a bővítmények adják az eszközeit. Ami ki van kapcsolva, nem foglal helyet a sávban.", style = Melyviz.small)
                    Plugins.ALL.forEach { p ->
                        val label = p.label + if (!p.built) " (${p.wp}, tervben)" else ""
                        if (p.id == Plugins.NOTE.id || !p.built) Text("· $label: ${p.blurb}", style = Melyviz.small.copy(color = if (p.built) Melyviz.ink else Melyviz.faint), modifier = Modifier.padding(vertical = 6.dp))
                        else VrgToggle("$label: ${p.blurb}", p.id in st.sketch.plugins) { st.togglePlugin(p.id) }
                    }
                }
            },
            confirmButton = { TextButton(close) { Text("Kész", color = Melyviz.glow) } },
        )
    }
}
