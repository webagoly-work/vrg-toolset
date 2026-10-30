package hu.vrg.legeger.ui

import android.bluetooth.BluetoothAdapter
import android.content.Intent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.legeger.Deck
import hu.vrg.legeger.Section
import hu.vrg.legeger.hid.HidPeripheral
import hu.vrg.mobile.kit.relay.Discovery
import hu.vrg.mobile.kit.relay.LinkState
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.kit.ShellSettings
import hu.vrg.mobile.kit.relay.Relay
import hu.vrg.mobile.kit.relay.Trust
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.theme.Palettes
import kotlinx.coroutines.launch

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SettingsSheet(onAskPermissions: () -> Unit, onMacros: () -> Unit, onOpenFeature: (String) -> Unit, onClose: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val s by Deck.settings.flow.collectAsStateWithLifecycle()
    val look by ShellSettings.flow.collectAsStateWithLifecycle()
    val phase by Deck.hid.phase.collectAsStateWithLifecycle()
    val host by Deck.hid.host.collectAsStateWithLifecycle()
    val hostIsPhone by Deck.hid.hostIsPhone.collectAsStateWithLifecycle()
    val link by Deck.relay.link.collectAsStateWithLifecycle()
    val peers by Deck.relay.peers.collectAsStateWithLifecycle()
    val focus by Deck.relay.focus.collectAsStateWithLifecycle()
    val traffic by Deck.relay.traffic.collectAsStateWithLifecycle()
    val trust by Relay.trust.collectAsStateWithLifecycle()
    val pc by Relay.pc.collectAsStateWithLifecycle()
    var url by remember { mutableStateOf(Deck.relay.url) }
    var searching by remember { mutableStateOf<Int?>(null) }
    var searchNote by remember { mutableStateOf("") }

    DeepSheet(onClose) {
        Text("Beállítások", style = Melyviz.title)

        // ---- look ------------------------------------------------------------------------------
        // The palette and the size belong to the whole app since WP M1: shown here, set in Beállítások.
        SectionTitle("Megjelenés")
        Text("${Palettes.byId(look.palette).name}  ·  méret ${"%.2f".format(look.uiScale)}×", style = Melyviz.small)
        Row(Modifier.padding(top = 6.dp)) { Chip("Az alkalmazás beállításai ›", false) { onOpenFeature(Catalogue.SETTINGS.id) } }

        // ---- what is on the deck ---------------------------------------------------------------
        SectionTitle("Képernyő elemei")
        Section.entries.forEach { sec ->
            Toggle(sec.label, sec !in s.hidden) { on ->
                Deck.settings.update { it.copy(hidden = if (on) it.hidden - sec else it.hidden + sec) }
            }
        }
        Toggle("Balkezes elrendezés (gombsor tükrözve)", s.lefty) { v -> Deck.settings.update { it.copy(lefty = v) } }
        Row(Modifier.padding(top = 6.dp)) { Chip("Makrók szerkesztése ✎", false) { onMacros() } }

        // ---- Bluetooth -------------------------------------------------------------------------
        SectionTitle("Bluetooth — egér, billentyűzet, érintőképernyő")
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
                    if (host != null) "Csatlakozva: ${Deck.hid.hostLabel()}" + (if (hostIsPhone) "  (telefon)" else "")
                    else "Párosítás: a PC-n vagy a másik telefonon Bluetooth → új eszköz, és válaszd ezt a telefont.",
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
                Text("Párosított eszközök", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 10.dp, bottom = 4.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Deck.hid.bondedDevices().forEach { d ->
                        Chip(d.name ?: d.address, host?.address == d.address) { Deck.hid.connect(d) }
                    }
                }
            }
        }
        Toggle("Telefon mód magától, ha a gazda telefon", s.autoPhone) { v -> Deck.settings.update { it.copy(autoPhone = v) } }

        // ---- relay -----------------------------------------------------------------------------
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
                    else searchNote = "Nem találtam relét. Fut a legeger.cmd → 1 (vagy START.cmd → G)? Ugyanazon a WiFi-n vagytok?"
                }
            }
            Spacer(Modifier.width(6.dp))
            if (link != LinkState.OFF) Chip("Bontás", false) { Deck.relay.disconnect() }
        }
        Row(Modifier.padding(top = 6.dp)) { Chip("QR beolvasása (párosítás) ▣", false) { onOpenFeature(Catalogue.PAIR.id) } }
        if (searchNote.isNotEmpty()) Text(searchNote, style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 6.dp))
        Text(
            when (link) {
                LinkState.OPEN -> "Vonalban: " + (peers.filter { it.role != "phone" }.joinToString { it.role }.ifEmpty { "csak telefon" }) +
                    (focus?.role?.let { "  ·  fókusz: $it" } ?: "") + "  ·  be ${traffic.first} / ki ${traffic.second}" +
                    "\n" + when (trust) {
                        Trust.TRUSTED -> "Megbízható telefon ✓ ${pc?.name.orEmpty()}"
                        Trust.CHECKING -> "Aláírás ellenőrzése…"
                        Trust.REFUSED -> "A PC törölte a párosítást: QR-rel újra párosítható"
                        Trust.NONE -> "Nincs párosítva: vezérelni lehet, képernyőképhez QR párosítás kell"
                    }
                LinkState.CONNECTING -> "Kapcsolódás… (2 mp-enként újrapróbálja)"
                LinkState.OFF -> "Nincs relé. A PC-n: legeger.cmd → 1, vagy START.cmd → G."
            },
            style = Melyviz.readout, modifier = Modifier.padding(top = 6.dp),
        )
        Toggle("Kövesse a PC fókuszát (Planner ↔ Kódváros elrendezés)", s.followFocus) { v -> Deck.settings.update { it.copy(followFocus = v) } }

        // ---- screenshots -----------------------------------------------------------------------
        SectionTitle("Képernyőkép a PC-ről")
        Row(verticalAlignment = Alignment.CenterVertically) {
            Chip("Teljes képernyő", s.shotMode == "screen") { Deck.settings.update { it.copy(shotMode = "screen") } }
            Spacer(Modifier.width(6.dp))
            Chip("Aktív ablak", s.shotMode == "window") { Deck.settings.update { it.copy(shotMode = "window") } }
        }
        Text("A relé csak --shots kapcsolóval indítva készít képet (legeger.cmd → 1 így indítja). Telefon módban a 📸 a másik telefon saját képernyőképe.",
            style = Melyviz.small, modifier = Modifier.padding(top = 6.dp))

        // ---- pad -------------------------------------------------------------------------------
        SectionTitle("Érintőpad")
        Toggle("Gesztusok 3 és 4 ujjal", s.padGestures) { v -> Deck.settings.update { it.copy(padGestures = v) } }
        Toggle("Szélről behúzás (bal / jobb sáv)", s.edgeSwipes) { v -> Deck.settings.update { it.copy(edgeSwipes = v) } }
        Toggle("Súgó a padon", s.padHints) { v -> Deck.settings.update { it.copy(padHints = v) } }
        Toggle("Finom célzás: ujj a padon, amíg MUTAT", s.precision) { v -> Deck.settings.update { it.copy(precision = v) } }
        Tune("Telefon képernyő aránya (magasság / szélesség)", s.phoneAspect, 1.6f..2.4f) { v -> Deck.settings.update { it.copy(phoneAspect = v) } }
        Tune("Érintőpad sebesség (egér)", s.padSpeed, 0.5f..4f) { v -> Deck.settings.update { it.copy(padSpeed = v) } }

        // ---- pointer ---------------------------------------------------------------------------
        SectionTitle("Mutató (giroszkóp)")
        Tune("Sebesség", s.tuning.speed, 300f..2400f) { v -> Deck.settings.update { it.copy(tuning = it.tuning.copy(speed = v)) } }
        Tune("Gyorsulás", s.tuning.accel, 0f..2f) { v -> Deck.settings.update { it.copy(tuning = it.tuning.copy(accel = v)) } }
        Tune("Holtsáv (remegés)", s.tuning.deadzone, 0f..0.15f) { v -> Deck.settings.update { it.copy(tuning = it.tuning.copy(deadzone = v)) } }
        Tune("Simítás", s.tuning.smoothing, 0f..0.9f) { v -> Deck.settings.update { it.copy(tuning = it.tuning.copy(smoothing = v)) } }
        Toggle("Függőleges tengely fordítva", s.tuning.invertY) { v -> Deck.settings.update { it.copy(tuning = it.tuning.copy(invertY = v)) } }

        // ---- misc ------------------------------------------------------------------------------
        SectionTitle("Egyéb")
        Toggle("Csuklómozdulatok (gyors fordítás = parancs)", s.flicks) { v -> Deck.settings.update { it.copy(flicks = v) } }
        Toggle("Arccal lefelé az asztalon = szünet / lejátszás", s.faceDown) { v -> Deck.settings.update { it.copy(faceDown = v) } }
        Toggle("Hangerő gombok = bal / jobb kattintás", s.volumeClicks) { v -> Deck.settings.update { it.copy(volumeClicks = v) } }
        Toggle("Rezgés visszajelzés", s.haptics) { v -> Deck.settings.update { it.copy(haptics = v) } }
        Toggle("Képernyő ébren tartása", s.keepScreenOn) { v -> Deck.settings.update { it.copy(keepScreenOn = v) } }
    }
}
