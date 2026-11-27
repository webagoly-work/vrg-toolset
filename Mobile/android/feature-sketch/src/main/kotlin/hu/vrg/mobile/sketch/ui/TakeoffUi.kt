package hu.vrg.mobile.sketch.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.sketch.PlanView
import hu.vrg.mobile.sketch.Takeoff
import hu.vrg.mobile.kit.theme.vrgBorder

// The Munkakör lap (WP M47, docs/sketcher/TAKEOFF.md): the takeoff of the survey, live, at the top of the Munkakör front.
// Symbols and colours, little text: one chip per work item (its symbol and quantity), coral and ≈ while it is a guess,
// ⚑ while an open question can still change it, faded when nothing is done to it (an existing point that stays).
// A tap on a chip shows its name and why; the ⚑ row lists the open decisions and jumps to Kérdések.
// The same engine (sketch-core Takeoff.kt) writes the .takeoff.json + .md the Rendezés export sends with the package.

/** The takeoff of the survey as the editor has it now; null when the rules are missing from the assets. */
internal fun takeoffOf(st: EditorState): Takeoff.Result? =
    SketcherKit.rules?.let { Takeoff.build(st.kit, it, st.sketch, PlanView.of(st.sketch, st.norm), impliedDedicated = SketcherKit.impliedDedicated) }

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun TakeoffCard(st: EditorState) {
    val implied = SketcherKit.impliedDedicated
    val tk = remember(st.sketch, st.kit, st.norm, implied) { takeoffOf(st) } ?: return
    var picked by remember { mutableStateOf<String?>(null) }
    val col = st.frontColor("munkakor")
    val open = Color(0xFFD64545)
    Column(
        Modifier.fillMaxWidth().padding(vertical = 4.dp).clip(RoundedCornerShape(Melyviz.radiusSmall)).background(Melyviz.surface)
            .vrgBorder(1.dp, col, RoundedCornerShape(Melyviz.radiusSmall)).padding(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("☰ Munkakör lap", style = Melyviz.label.copy(fontSize = 13.sp, color = col), modifier = Modifier.weight(1f))
            Text("${tk.items.size}", style = Melyviz.small.copy(color = Melyviz.ink))
            if (tk.est > 0) Text("  ≈${tk.est}", style = Melyviz.small.copy(color = Melyviz.coral))
            if (tk.decisions.isNotEmpty()) Text("  ⚑${tk.decisions.size}", style = Melyviz.small.copy(color = open))
        }
        if (tk.items.isEmpty()) {
            Text("Még nincs tétel: kapcsold be lent, mi a munka, vagy rajzolj pontokat.", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 4.dp))
            return@Column
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalArrangement = Arrangement.spacedBy(5.dp), modifier = Modifier.padding(top = 6.dp)) {
            tk.items.forEach { it2 -> ItemChip(it2, it2.id == picked, col, open) { picked = if (picked == it2.id) null else it2.id } }
        }
        tk.items.firstOrNull { it.id == picked }?.let { it2 ->
            Text(it2.sym + " " + it2.label + " · " + (if (it2.est) "≈ " else "") + Takeoff.fmt(it2.qty) + " " + it2.unit,
                style = Melyviz.label.copy(fontSize = 12.sp), modifier = Modifier.padding(top = 6.dp))
            if (it2.note.isNotEmpty()) Text(it2.note, style = Melyviz.small.copy(color = Melyviz.faint))
            it2.parts?.forEach { p -> Text("  ${p.label.ifEmpty { p.ref }} ${Takeoff.fmt(p.m)} m", style = Melyviz.small.copy(color = Melyviz.muted)) }
            tk.decisions.filter { d -> d.q in it2.open }.forEach { d -> Text("⚑ " + d.label, style = Melyviz.small.copy(color = open)) }
        }
        if (tk.decisions.isNotEmpty()) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalArrangement = Arrangement.spacedBy(5.dp), modifier = Modifier.padding(top = 8.dp)) {
                tk.decisions.forEach { d ->
                    Text((if (d.state == "later") "⏱ " else "⚑ ") + d.label, style = Melyviz.small.copy(fontSize = 11.sp, color = open),
                        modifier = Modifier.clip(RoundedCornerShape(50)).vrgBorder(1.dp, open, RoundedCornerShape(50))
                            .clickable { st.front = "kerdes" }.padding(horizontal = 8.dp, vertical = 4.dp))
                }
            }
        }
        // D-79: the general toggle: dedicated circuits for the big machines and systems, counted as ≈ (off = assume nothing)
        Text((if (implied) "◉ ✓ " else "◉ ○ ") + "Dedikált kör a nagy gépeknek (≈, minden felmérésre)",
            style = Melyviz.small.copy(fontSize = 11.sp, color = if (implied) col else Melyviz.faint),
            modifier = Modifier.padding(top = 8.dp).clip(RoundedCornerShape(50)).vrgBorder(1.dp, if (implied) col else Melyviz.line, RoundedCornerShape(50))
                .clickable { SketcherKit.switchImpliedDedicated(!implied) }.padding(horizontal = 8.dp, vertical = 4.dp))
        if (tk.checks.isNotEmpty()) tk.checks.forEach { Text("! $it", style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 4.dp)) }
    }
}

@Composable
private fun ItemChip(it2: Takeoff.Item, on: Boolean, col: Color, open: Color, onClick: () -> Unit) {
    val edge = if (it2.est) Melyviz.coral else if (it2.work) col else Melyviz.line
    val ink = if (on) Color.Black else if (it2.work) Melyviz.ink else Melyviz.faint
    Row(
        Modifier.clip(RoundedCornerShape(50)).background(if (on) edge else Melyviz.abyss).vrgBorder(1.dp, edge, RoundedCornerShape(50))
            .clickable(onClick = onClick).padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(it2.sym, style = Melyviz.label.copy(fontSize = 13.sp, color = if (on) Color.Black else edge))
        Text(" " + (if (it2.est) "≈" else "") + Takeoff.fmt(it2.qty) + if (it2.unit == "m") " m" else "",
            style = Melyviz.small.copy(fontSize = 12.sp, color = ink))
        if (it2.open.isNotEmpty()) Text(" ⚑", style = Melyviz.small.copy(fontSize = 11.sp, color = if (on) Color.Black else open))
    }
}
