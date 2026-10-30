package hu.vrg.legeger.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.legeger.Deck
import hu.vrg.legeger.core.Macro
import hu.vrg.legeger.core.MacroScript
import hu.vrg.legeger.ui.theme.Melyviz

// Macros: the list (run, edit, pin to the deck, delete) and an editor that reads the script as it is
// typed, so a mistake shows up here and not halfway through a run.

private const val HELP = """Egy lépés soronként vagy ;-vel elválasztva:
Ctrl+S · Win+D · Escape — billentyű
type Szöveg — begépelés
wait 300  ·  300ms — várakozás
cmd view.reset · cmd time.step d=-1 — parancs az appnak (relé)
app Ctrl+K — billentyű az app oldalába (relé)
media play|next|prev|mute|vol+|vol-|home|back
click left|right · wheel -3 · shot — képernyőkép"""

@Composable
fun MacroSheet(onClose: () -> Unit) {
    val s by Deck.settings.flow.collectAsStateWithLifecycle()
    var editing by remember { mutableStateOf<Macro?>(null) }

    DeepSheet(onClose) {
        val e = editing
        if (e != null) {
            MacroEditor(e, onDone = { saved ->
                if (saved != null) Deck.settings.update { st ->
                    val exists = st.macros.any { it.id == saved.id }
                    st.copy(macros = if (exists) st.macros.map { if (it.id == saved.id) saved else it } else st.macros + saved)
                }
                editing = null
            })
            return@DeepSheet
        }

        Text("Makrók", style = Melyviz.title)
        Text("Koppintás a sorban: futtatás · ismét koppintva: leállítás. A ⚲ jelölt makrók a vezérlőn is megjelennek.",
            style = Melyviz.small, modifier = Modifier.padding(top = 4.dp, bottom = 8.dp))
        s.macros.forEach { m ->
            val shape = RoundedCornerShape(Melyviz.radiusSmall)
            Row(
                Modifier.fillMaxWidth().padding(vertical = 3.dp).clip(shape).background(Melyviz.surface)
                    .border(1.dp, Melyviz.line, shape).clickable { Deck.runMacro(m) }.padding(horizontal = 10.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(m.glyph, style = Melyviz.glyph.copy(fontSize = 18.sp))
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(m.name, style = Melyviz.label)
                    Text(m.script.replace('\n', ';'), style = Melyviz.readout.copy(fontSize = 10.sp), maxLines = 1)
                }
                Chip(if (m.onDeck) "⚲" else "○", m.onDeck) {
                    Deck.settings.update { st -> st.copy(macros = st.macros.map { if (it.id == m.id) it.copy(onDeck = !it.onDeck) else it }) }
                }
                Spacer(Modifier.width(4.dp))
                Chip("✎", false) { editing = m }
                Spacer(Modifier.width(4.dp))
                Chip("✕", false) { Deck.settings.update { st -> st.copy(macros = st.macros.filterNot { it.id == m.id }) } }
            }
        }
        Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Chip("+ Új makró", true) { editing = Macro("m" + System.currentTimeMillis().toString(36), "★", "Új makró", "") }
            Chip("Alapértelmezettek vissza", false) { Deck.settings.update { it.copy(macros = MacroScript.DEFAULTS) } }
        }
    }
}

@Composable
private fun MacroEditor(m: Macro, onDone: (Macro?) -> Unit) {
    var glyph by remember { mutableStateOf(m.glyph) }
    var name by remember { mutableStateOf(m.name) }
    var script by remember { mutableStateOf(m.script) }
    val parsed = remember(script) { MacroScript.parse(script) }

    Text("Makró szerkesztése", style = Melyviz.title)
    Row(Modifier.padding(top = 10.dp)) {
        OutlinedTextField(glyph, { glyph = it.take(2) }, Modifier.width(76.dp), label = { Text("Jel") }, singleLine = true, colors = deepFieldColors())
        Spacer(Modifier.width(8.dp))
        OutlinedTextField(name, { name = it.take(24) }, Modifier.weight(1f), label = { Text("Név") }, singleLine = true, colors = deepFieldColors())
    }
    OutlinedTextField(
        script, { script = it }, Modifier.fillMaxWidth().padding(top = 8.dp), label = { Text("Lépések") },
        minLines = 4, colors = deepFieldColors(), textStyle = TextStyle(fontFamily = Melyviz.mono, fontSize = 13.sp, color = Melyviz.ink),
    )
    Text(
        if (parsed.errors.isEmpty()) "✓ ${parsed.steps.size} lépés" else parsed.errors.joinToString("\n"),
        style = Melyviz.small.copy(color = if (parsed.errors.isEmpty()) Melyviz.kelp else Melyviz.coral),
        modifier = Modifier.padding(top = 6.dp),
    )
    Text(HELP, style = Melyviz.readout.copy(fontSize = 10.sp), modifier = Modifier.padding(top = 10.dp))
    Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Chip("Mentés", true) {
            if (parsed.errors.isEmpty() && name.isNotBlank()) onDone(m.copy(glyph = glyph.ifBlank { "★" }, name = name.trim(), script = script))
        }
        Chip("Kipróbál", false) { Deck.runMacro(m.copy(id = m.id + "-try", script = script, name = name)) }
        Chip("Mégse", false) { onDone(null) }
    }
}
