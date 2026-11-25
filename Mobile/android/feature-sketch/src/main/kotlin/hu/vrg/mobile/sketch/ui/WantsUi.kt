package hu.vrg.mobile.sketch.ui

import hu.vrg.mobile.kit.ui.VrgChip
import androidx.compose.foundation.layout.Row
import androidx.compose.ui.Alignment
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.RcoItem
import hu.vrg.mobile.kit.ui.RcoMenu
import hu.vrg.mobile.kit.ui.rco
import hu.vrg.mobile.sketch.Wants

// F4 (WP M49): the client's wants by room on the Munkakör. "Hová" says where the Igények' + / − go: the room in focus
// when the front opens (the one last touched on the sketch), Általános, or any room. The Szobánként card shows what
// each room holds; a long press on a want (RCO) re-links one of it to Általános or another room. Never required: with
// Hová on Általános everything works as before.

private fun roomLabel(st: EditorState, id: String?) =
    if (id == null) "Általános" else st.sketch.room(id)?.let { roomTitle(it.name, it.kinds) } ?: "Általános"

/** Hová: Általános or a room, as pills. Shown only when the sketch has rooms. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun WantWhere(st: EditorState, col: Color) {
    if (st.sketch.rooms.isEmpty()) return
    Text("Hová kerül: a koppintott szoba, vagy a munka egésze", style = Melyviz.small.copy(fontSize = 10.sp, color = Melyviz.faint),
        modifier = Modifier.padding(bottom = 4.dp))
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(bottom = 6.dp)) {
        Pill("Általános", col, st.wantRoom == null) { st.wantRoom = null }
        st.sketch.rooms.forEach { r -> Pill("⌂ " + roomTitle(r.name, r.kinds), col, st.wantRoom == r.id) { st.wantRoom = r.id } }
    }
}

/** Szobánként: per room what it holds (and how many notes it has), then Általános. Long press re-links one. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun WantsByRoom(st: EditorState, col: Color) {
    val rows = remember(st.sketch, st.kit) { Wants.byRoom(st.kit, st.sketch) }
    if (rows.none { it.first != null }) return
    val totals = remember(st.sketch, st.kit) { Wants.lines(st.kit, st.sketch) }
    var moving by remember { mutableStateOf(false) }   // UI audit 3.1: the visible way to move an item (not the long press alone)
    Column(
        Modifier.fillMaxWidth().padding(top = 8.dp).clip(RoundedCornerShape(Melyviz.radiusSmall)).background(Melyviz.surface)
            .border(1.dp, Melyviz.line, RoundedCornerShape(Melyviz.radiusSmall)).padding(10.dp),
    ) {
        Text("Szobánként · összesen " + totals.joinToString(", ") { (st.kit.scopeItem(it.id)?.label ?: it.id) + " ×" + it.total },
            style = Melyviz.small.copy(color = Melyviz.faint))
        rows.forEach { (room, items) ->
            val notes = if (room == null) 0 else st.sketch.entries.count { it.room == room }
            Text((if (room == null) "" else "⌂ ") + roomLabel(st, room) + if (notes > 0) "  · ✎ $notes jegyzet" else "",
                style = Melyviz.label.copy(fontSize = 12.sp, color = if (room == st.wantRoom) col else Melyviz.ink), modifier = Modifier.padding(top = 6.dp, bottom = 3.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                items.forEach { (id, n) -> WantChip(st, id, n, room, col, moving) }
            }
        }
        Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            VrgChip("⇄ Áthelyezés", selected = moving) { moving = !moving }
            Text(if (moving) "Koppints a tételre: hová kerüljön." else "Vagy tartsd lenyomva a tételt: másik szobába vagy az Általánosba.",
                style = Melyviz.small.copy(color = Melyviz.muted), modifier = Modifier.weight(1f))
        }
    }
}

@Composable
private fun WantChip(st: EditorState, id: String, n: Int, room: String?, col: Color, moving: Boolean) {
    var menu by remember { mutableStateOf(false) }
    val k = st.kit.scopeItem(id)
    val label = (k?.sym?.let { "$it " } ?: "") + (k?.label ?: id) + " ×$n"
    Box {
        Text(label, style = Melyviz.small.copy(fontSize = 12.sp, color = if (room != null) Color.Black else Melyviz.ink),
            modifier = Modifier.clip(RoundedCornerShape(50)).background(if (room != null) col else Melyviz.surface)
                .border(1.dp, col, RoundedCornerShape(50))
                .rco(onClick = { if (moving) menu = true else st.wantRoom = room }, onLong = { menu = true }, longLabel = "áthelyezés")
                .padding(horizontal = 10.dp, vertical = 6.dp))
        val targets = listOf<String?>(null) + st.sketch.rooms.map { it.id }
        RcoMenu(menu, { menu = false }, label, targets.filter { it != room }.map { to ->
            RcoItem(if (to == null) "⇠" else "⌂", "Egyet ide: " + roomLabel(st, to)) { st.moveWant(id, room, to) }
        } + listOfNotNull(if (n > 1) RcoItem("⇉", "Mindet ide: " + roomLabel(st, if (room == null) st.wantRoom else null)) {
            st.moveWant(id, room, if (room == null) st.wantRoom else null, n)
        }.takeIf { room != null || st.wantRoom != null } else null))
    }
}
