package hu.vrg.legeger.ui

import android.bluetooth.BluetoothAdapter
import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.legeger.Deck
import hu.vrg.legeger.core.Hid
import hu.vrg.legeger.core.Layouts
import hu.vrg.legeger.core.Send
import hu.vrg.legeger.core.Target
import hu.vrg.legeger.hid.HidPeripheral
import hu.vrg.legeger.relay.Discovery
import hu.vrg.legeger.relay.RelayClient
import hu.vrg.legeger.ui.theme.Melyviz
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DeepSheet(onClose: () -> Unit, content: @Composable () -> Unit) {
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
private fun deepFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = Melyviz.glow, unfocusedBorderColor = Melyviz.line,
    focusedTextColor = Melyviz.ink, unfocusedTextColor = Melyviz.ink, cursorColor = Melyviz.glow,
    focusedLabelColor = Melyviz.glow, unfocusedLabelColor = Melyviz.muted,
)

// ---- ⌨ keyboard ---------------------------------------------------------------------------------

private val SHORTCUTS = listOf(
    "Esc" to "Escape", "Tab" to "Tab", "Enter" to "Enter", "⌫" to "Backspace", "Del" to "Delete",
    "←" to "Left", "↑" to "Up", "↓" to "Down", "→" to "Right", "Home" to "Home", "End" to "End",
    "PgUp" to "PageUp", "PgDn" to "PageDown",
    "Ctrl+Z" to "Ctrl+Z", "Ctrl+Y" to "Ctrl+Y", "Ctrl+S" to "Ctrl+S", "Ctrl+C" to "Ctrl+C", "Ctrl+V" to "Ctrl+V",
    "Ctrl+A" to "Ctrl+A", "Ctrl+F" to "Ctrl+F", "Ctrl+W" to "Ctrl+W", "Ctrl+T" to "Ctrl+T",
    "Win" to "Win", "Win+D" to "Win+D", "Win+Tab" to "Win+Tab", "Win+L" to "Win+L", "F5" to "F5", "F11" to "F11",
)

private val MEDIA = listOf(
    "🔉" to Hid.Consumer.VOL_DOWN, "🔇" to Hid.Consumer.MUTE, "🔊" to Hid.Consumer.VOL_UP,
    "⏮" to Hid.Consumer.PREV, "⏯" to Hid.Consumer.PLAY_PAUSE, "⏭" to Hid.Consumer.NEXT,
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun KeysSheet(target: Target, onClose: () -> Unit) {
    val s by Deck.settings.flow.collectAsStateWithLifecycle()
    var text by remember { mutableStateOf("") }
    var appKey by remember { mutableStateOf("") }
    var ctrl by remember { mutableStateOf(false) }
    var shift by remember { mutableStateOf(false) }
    var alt by remember { mutableStateOf(false) }

    DeepSheet(onClose) {
        Text("Billentyűzet", style = Melyviz.title)

        SectionTitle("Gépelés a gépre (Bluetooth)")
        OutlinedTextField(
            value = text, onValueChange = { text = it }, modifier = Modifier.fillMaxWidth(),
            label = { Text("Szöveg") }, colors = deepFieldColors(),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
            keyboardActions = KeyboardActions(onSend = { Deck.typeText(text); text = "" }),
        )
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("PC kiosztás:", style = Melyviz.small)
            Spacer(Modifier.width(8.dp))
            Layouts.ALL.forEach { l ->
                Chip(l.id, s.layout == l.id) { Deck.settings.update { it.copy(layout = l.id) } }
                Spacer(Modifier.width(6.dp))
            }
            Spacer(Modifier.weight(1f))
            Chip("Gépel ⏎", true) { Deck.typeText(text); text = "" }
        }

        SectionTitle("Gyorsbillentyűk")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            SHORTCUTS.forEach { (label, spec) -> Chip(label, false) { Deck.perform(Send.Key(spec)) } }
        }

        SectionTitle("Média")
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            MEDIA.forEach { (label, usage) -> Chip(label, false) { Deck.perform(Send.Media(usage)) } }
        }

        if (target != Target.GENERAL) {
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

// ---- ⚙ settings ---------------------------------------------------------------------------------

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SettingsSheet(onAskPermissions: () -> Unit, onClose: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val s by Deck.settings.flow.collectAsStateWithLifecycle()
    val phase by Deck.hid.phase.collectAsStateWithLifecycle()
    val host by Deck.hid.host.collectAsStateWithLifecycle()
    val link by Deck.relay.link.collectAsStateWithLifecycle()
    val peers by Deck.relay.peers.collectAsStateWithLifecycle()
    val focus by Deck.relay.focus.collectAsStateWithLifecycle()
    val traffic by Deck.relay.traffic.collectAsStateWithLifecycle()
    var url by remember { mutableStateOf(s.relayUrl) }
    var searching by remember { mutableStateOf<Int?>(null) }
    var searchNote by remember { mutableStateOf("") }

    DeepSheet(onClose) {
        Text("Beállítások", style = Melyviz.title)

        // ---- Bluetooth
        SectionTitle("Bluetooth — egér bármely géphez")
        when (phase) {
            HidPeripheral.Phase.NO_PERMISSION -> Chip("Engedély megadása", true) { onAskPermissions() }
            HidPeripheral.Phase.UNSUPPORTED -> Text(
                "Ez a telefon nem engedi a Bluetooth HID módot (a gyártó kikapcsolta). A relé része ettől még működik.",
                style = Melyviz.small.copy(color = Melyviz.sand),
            )
            HidPeripheral.Phase.OFF -> Chip("Bluetooth indítása", true) {
                if (!Deck.hid.bluetoothOn) ctx.startActivity(
                    Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                ) else Deck.hid.start()
            }
            else -> {
                Text(
                    if (host != null) "Csatlakozva: ${Deck.hid.hostLabel()}"
                    else "Párosítás: a PC-n Beállítások → Bluetooth → Eszköz hozzáadása, és válaszd ezt a telefont.",
                    style = Melyviz.small,
                )
                Row(Modifier.padding(top = 8.dp)) {
                    Chip("Láthatóvá tesz (2 perc)", false) {
                        ctx.startActivity(
                            Intent(BluetoothAdapter.ACTION_REQUEST_DISCOVERABLE)
                                .putExtra(BluetoothAdapter.EXTRA_DISCOVERABLE_DURATION, 120)
                                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                        )
                    }
                    Spacer(Modifier.width(6.dp))
                    if (host != null) Chip("Bontás", false) { Deck.hid.disconnect() }
                }
                Text("Párosított gépek", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 10.dp, bottom = 4.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Deck.hid.bondedDevices().forEach { d ->
                        Chip(d.name ?: d.address, host?.address == d.address) { Deck.hid.connect(d) }
                    }
                }
            }
        }

        // ---- relay
        SectionTitle("Relé — Planner és Kódváros (WiFi)")
        OutlinedTextField(
            value = url, onValueChange = { url = it }, modifier = Modifier.fillMaxWidth(), singleLine = true,
            label = { Text("ws://192.168.1.24:47291") }, colors = deepFieldColors(),
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.None, autoCorrectEnabled = false, imeAction = ImeAction.Go),
            keyboardActions = KeyboardActions(onGo = { Deck.connectRelay(url) }),
        )
        Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Chip("Csatlakozás", true) { Deck.connectRelay(url) }
            Spacer(Modifier.width(6.dp))
            Chip(searching?.let { "Keresés… $it%" } ?: "Keresés a hálózaton", false) {
                if (searching != null) return@Chip
                searching = 0; searchNote = ""
                scope.launch {
                    val found = Discovery.find(ctx) { p -> searching = p }
                    searching = null
                    if (found != null) { url = found; Deck.connectRelay(found); searchNote = "Megvan: $found" }
                    else searchNote = "Nem találtam relét. Fut a START.cmd → G? Ugyanazon a WiFi-n vagytok?"
                }
            }
            Spacer(Modifier.width(6.dp))
            if (link != RelayClient.Link.OFF) Chip("Bontás", false) { Deck.relay.disconnect(); Deck.settings.update { it.copy(relayUrl = "") } }
        }
        if (searchNote.isNotEmpty()) Text(searchNote, style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 6.dp))
        Text(
            when (link) {
                RelayClient.Link.OPEN -> "Vonalban: " + (peers.filter { it.role != "phone" }.joinToString { it.role }.ifEmpty { "csak telefon" }) +
                    (focus?.role?.let { "  ·  fókusz: $it" } ?: "") + "  ·  be ${traffic.first} / ki ${traffic.second}"
                RelayClient.Link.CONNECTING -> "Kapcsolódás… (2 mp-enként újrapróbálja)"
                RelayClient.Link.OFF -> "Nincs relé. A PC-n: START.cmd → G (Gyro relay)."
            },
            style = Melyviz.readout, modifier = Modifier.padding(top = 6.dp),
        )
        Toggle("Kövesse a PC fókuszát (Planner ↔ Kódváros elrendezés)", s.followFocus) { v -> Deck.settings.update { it.copy(followFocus = v) } }

        // ---- pointer
        SectionTitle("Mutató")
        Tune("Sebesség", s.tuning.speed, 300f..2400f) { v -> Deck.settings.update { it.copy(tuning = it.tuning.copy(speed = v)) } }
        Tune("Gyorsulás", s.tuning.accel, 0f..2f) { v -> Deck.settings.update { it.copy(tuning = it.tuning.copy(accel = v)) } }
        Tune("Holtsáv (remegés)", s.tuning.deadzone, 0f..0.15f) { v -> Deck.settings.update { it.copy(tuning = it.tuning.copy(deadzone = v)) } }
        Tune("Simítás", s.tuning.smoothing, 0f..0.9f) { v -> Deck.settings.update { it.copy(tuning = it.tuning.copy(smoothing = v)) } }
        Tune("Érintőpad sebesség", s.padSpeed, 0.5f..4f) { v -> Deck.settings.update { it.copy(padSpeed = v) } }
        Toggle("Függőleges tengely fordítva", s.tuning.invertY) { v -> Deck.settings.update { it.copy(tuning = it.tuning.copy(invertY = v)) } }

        // ---- misc
        SectionTitle("Egyéb")
        Toggle("Csuklómozdulatok (gyors fordítás = parancs)", s.flicks) { v -> Deck.settings.update { it.copy(flicks = v) } }
        Toggle("Hangerő gombok = bal / jobb kattintás", s.volumeClicks) { v -> Deck.settings.update { it.copy(volumeClicks = v) } }
        Toggle("Rezgés visszajelzés", s.haptics) { v -> Deck.settings.update { it.copy(haptics = v) } }
        Toggle("Képernyő ébren tartása", s.keepScreenOn) { v -> Deck.settings.update { it.copy(keepScreenOn = v) } }
    }
}

@Composable
private fun Toggle(label: String, value: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = Melyviz.label, modifier = Modifier.weight(1f))
        Switch(value, onChange, colors = SwitchDefaults.colors(
            checkedThumbColor = Melyviz.onGlow, checkedTrackColor = Melyviz.glow,
            uncheckedThumbColor = Melyviz.muted, uncheckedTrackColor = Melyviz.surface, uncheckedBorderColor = Melyviz.line,
        ))
    }
}

@Composable
private fun Tune(label: String, value: Float, range: ClosedFloatingPointRange<Float>, onChange: (Float) -> Unit) {
    Column(Modifier.fillMaxWidth()) {
        Row {
            Text(label, style = Melyviz.label, modifier = Modifier.weight(1f))
            Text(if (range.endInclusive > 10f) "%.0f".format(value) else "%.2f".format(value), style = Melyviz.readout)
        }
        Slider(value, onChange, valueRange = range, colors = SliderDefaults.colors(
            thumbColor = Melyviz.glow, activeTrackColor = Melyviz.glow, inactiveTrackColor = Melyviz.line,
        ), modifier = Modifier.height(32.dp))
    }
}
