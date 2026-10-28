package hu.vrg.legeger.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.legeger.Deck
import hu.vrg.legeger.core.Hid
import hu.vrg.legeger.core.Layouts
import hu.vrg.legeger.core.Send
import hu.vrg.legeger.core.Target
import hu.vrg.legeger.ui.theme.Melyviz

// ---- shared sheet furniture ---------------------------------------------------------------------

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DeepSheet(onClose: () -> Unit, content: @Composable () -> Unit) {
    ModalBottomSheet(
        onDismissRequest = onClose,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = Melyviz.deep,
        contentColor = Melyviz.ink,
        scrimColor = Melyviz.abyss.copy(alpha = 0.7f),
    ) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 28.dp),
        ) { content() }
    }
}

@Composable
fun deepFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = Melyviz.glow, unfocusedBorderColor = Melyviz.line,
    focusedTextColor = Melyviz.ink, unfocusedTextColor = Melyviz.ink, cursorColor = Melyviz.glow,
    focusedLabelColor = Melyviz.glow, unfocusedLabelColor = Melyviz.muted,
)

@Composable
fun Toggle(label: String, value: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = Melyviz.label, modifier = Modifier.weight(1f))
        Switch(value, onChange, colors = SwitchDefaults.colors(
            checkedThumbColor = Melyviz.onGlow, checkedTrackColor = Melyviz.glow,
            uncheckedThumbColor = Melyviz.muted, uncheckedTrackColor = Melyviz.surface, uncheckedBorderColor = Melyviz.line,
        ))
    }
}

@Composable
fun Tune(label: String, value: Float, range: ClosedFloatingPointRange<Float>, format: String = "", onChange: (Float) -> Unit) {
    Column(Modifier.fillMaxWidth()) {
        Row {
            Text(label, style = Melyviz.label, modifier = Modifier.weight(1f))
            Text(format.ifEmpty { if (range.endInclusive > 10f) "%.0f" else "%.2f" }.format(value), style = Melyviz.readout)
        }
        Slider(value, onChange, valueRange = range, colors = SliderDefaults.colors(
            thumbColor = Melyviz.glow, activeTrackColor = Melyviz.glow, inactiveTrackColor = Melyviz.line,
        ), modifier = Modifier.height(32.dp))
    }
}

// ---- ⌨ keyboard ---------------------------------------------------------------------------------

private val SHORTCUTS = listOf(
    "Esc" to "Escape", "Tab" to "Tab", "Enter" to "Enter", "⌫" to "Backspace", "Del" to "Delete",
    "←" to "Left", "↑" to "Up", "↓" to "Down", "→" to "Right", "Home" to "Home", "End" to "End",
    "PgUp" to "PageUp", "PgDn" to "PageDown",
    "Ctrl+Z" to "Ctrl+Z", "Ctrl+Y" to "Ctrl+Y", "Ctrl+S" to "Ctrl+S", "Ctrl+C" to "Ctrl+C", "Ctrl+V" to "Ctrl+V",
    "Ctrl+A" to "Ctrl+A", "Ctrl+F" to "Ctrl+F", "Ctrl+W" to "Ctrl+W", "Ctrl+T" to "Ctrl+T",
    "Win" to "Win", "Win+D" to "Win+D", "Win+Tab" to "Win+Tab", "Win+L" to "Win+L", "Win+Shift+S" to "Win+Shift+S",
    "F5" to "F5", "F11" to "F11",
)

private val MEDIA = listOf(
    "🔉" to Hid.Consumer.VOL_DOWN, "🔇" to Hid.Consumer.MUTE, "🔊" to Hid.Consumer.VOL_UP,
    "⏮" to Hid.Consumer.PREV, "⏯" to Hid.Consumer.PLAY_PAUSE, "⏭" to Hid.Consumer.NEXT,
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun KeysSheet(target: Target, onDictate: () -> Unit, onClose: () -> Unit) {
    val s by Deck.settings.flow.collectAsStateWithLifecycle()
    val clipboard = LocalClipboardManager.current
    var text by remember { mutableStateOf("") }
    var appKey by remember { mutableStateOf("") }
    var ctrl by remember { mutableStateOf(false) }
    var shift by remember { mutableStateOf(false) }
    var alt by remember { mutableStateOf(false) }

    DeepSheet(onClose) {
        Text("Billentyűzet", style = Melyviz.title)

        SectionTitle("Gépelés (Bluetooth)")
        OutlinedTextField(
            value = text, onValueChange = { text = it }, modifier = Modifier.fillMaxWidth(),
            label = { Text("Szöveg") }, colors = deepFieldColors(),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
            keyboardActions = KeyboardActions(onSend = { Deck.typeText(text); text = "" }),
        )
        FlowRow(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Chip("Gépel ⏎", true) { Deck.typeText(text); text = "" }
            // speak instead of typing: the phone's own speech recogniser, Hungarian first
            Chip("🎤 Diktálás", false) { onDictate() }
            // whatever was copied on the phone, typed into the PC
            Chip("📋 Vágólap begépelése", false) {
                val clip = clipboard.getText()?.text.orEmpty()
                if (clip.isEmpty()) Deck.notes.tryEmit("A vágólap üres.") else Deck.typeText(clip)
            }
        }
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Gépelési kiosztás (a fogadó gépé):", style = Melyviz.small)
            Spacer(Modifier.width(8.dp))
            Layouts.ALL.forEach { l ->
                Chip(l.id, s.layout == l.id) { Deck.settings.update { it.copy(layout = l.id) } }
                Spacer(Modifier.width(6.dp))
            }
        }

        SectionTitle("Gyorsbillentyűk")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            SHORTCUTS.forEach { (label, spec) -> Chip(label, false) { Deck.perform(Send.Key(spec)) } }
        }

        SectionTitle("Média")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            MEDIA.forEach { (label, usage) -> Chip(label, false) { Deck.perform(Send.Media(usage)) } }
        }

        if (target.fromRelay) {
            // The old phone page's ⌨ dialog: a key delivered straight into the app's page by the relay.
            SectionTitle("Billentyű az alkalmazásnak (relé) — ${target.label}")
            OutlinedTextField(
                value = appKey, onValueChange = { appKey = it }, modifier = Modifier.fillMaxWidth(),
                label = { Text("pl. g, Escape, Delete") }, colors = deepFieldColors(), singleLine = true,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.None, autoCorrectEnabled = false),
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                ModBox("Ctrl", ctrl) { ctrl = it }
                ModBox("Shift", shift) { shift = it }
                ModBox("Alt", alt) { alt = it }
                Spacer(Modifier.weight(1f))
                Chip("Küld", true) {
                    val k = appKey.trim()
                    if (k.isNotEmpty()) Deck.perform(Send.AppKey(k, ctrl, shift, alt))
                }
            }
        }
    }
}

@Composable
private fun ModBox(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Checkbox(checked, onChange, colors = CheckboxDefaults.colors(checkedColor = Melyviz.glow, uncheckedColor = Melyviz.line, checkmarkColor = Melyviz.onGlow))
        Text(label, style = Melyviz.small)
    }
}
