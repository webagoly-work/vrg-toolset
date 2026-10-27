package hu.vrg.legeger.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.legeger.Deck
import hu.vrg.legeger.core.Hid
import hu.vrg.legeger.core.Profiles
import hu.vrg.legeger.core.Send
import hu.vrg.legeger.core.Target
import hu.vrg.legeger.hid.HidPeripheral
import hu.vrg.legeger.relay.RelayClient
import hu.vrg.legeger.ui.theme.Melyviz
import kotlinx.coroutines.delay

enum class Sheet { NONE, KEYS, SETTINGS }

@Composable
fun DeckScreen(onAskPermissions: () -> Unit) {
    val target by Deck.target.collectAsStateWithLifecycle()
    val pinned by Deck.pinned.collectAsStateWithLifecycle()
    val phase by Deck.hid.phase.collectAsStateWithLifecycle()
    val host by Deck.hid.host.collectAsStateWithLifecycle()
    val link by Deck.relay.link.collectAsStateWithLifecycle()
    val hellos by Deck.relay.hellos.collectAsStateWithLifecycle()
    val states by Deck.relay.states.collectAsStateWithLifecycle()
    val clutch by Deck.clutch.collectAsStateWithLifecycle()
    val latched by Deck.clutchLatched.collectAsStateWithLifecycle()
    val camera by Deck.camera.collectAsStateWithLifecycle()
    val scrubbing by Deck.scrubbing.collectAsStateWithLifecycle()
    val padToApp by Deck.padToApp.collectAsStateWithLifecycle()

    var sheet by remember { mutableStateOf(Sheet.NONE) }
    var note by remember { mutableStateOf("") }
    var leftHeld by remember { mutableStateOf(false) }
    var rightHeld by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { Deck.notes.collect { note = it } }
    LaunchedEffect(note) { if (note.isNotEmpty()) { delay(4000); note = "" } }

    val profile = Profiles.of(target)
    val hello = target.role?.let { hellos[it] }
    val state = target.role?.let { states[it] }
    val activeMode = state?.get("mode")?.toString()

    Box(Modifier.fillMaxSize().background(Melyviz.water)) {
        Column(
            Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(horizontal = Melyviz.gutter),
        ) {
            // ---- header: brand, target, the two links ----------------------------------------
            Row(Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("◈", style = Melyviz.title.copy(color = Melyviz.glow, fontSize = 18.sp))
                Spacer(Modifier.width(6.dp))
                Text("LÉGEGÉR", style = Melyviz.title)
                Spacer(Modifier.width(10.dp))
                TargetChip(target, pinned)
                Spacer(Modifier.weight(1f))
                IconTile("⌨") { sheet = Sheet.KEYS }
                Spacer(Modifier.width(6.dp))
                IconTile("⚙") { sheet = Sheet.SETTINGS }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatusPill(
                    when (phase) {
                        HidPeripheral.Phase.CONNECTED -> "BT · ${host?.let { Deck.hid.hostLabel() } ?: ""}"
                        HidPeripheral.Phase.READY -> "BT · párosításra kész"
                        HidPeripheral.Phase.CONNECTING -> "BT · kapcsolódás…"
                        HidPeripheral.Phase.STARTING -> "BT · indul…"
                        HidPeripheral.Phase.NO_PERMISSION -> "BT · engedély kell"
                        HidPeripheral.Phase.UNSUPPORTED -> "BT · nem támogatott"
                        HidPeripheral.Phase.OFF -> "BT · ki"
                    },
                    when (phase) {
                        HidPeripheral.Phase.CONNECTED -> Melyviz.kelp
                        HidPeripheral.Phase.READY, HidPeripheral.Phase.CONNECTING, HidPeripheral.Phase.STARTING -> Melyviz.sand
                        else -> Melyviz.coral
                    },
                ) { if (phase == HidPeripheral.Phase.NO_PERMISSION) onAskPermissions() else sheet = Sheet.SETTINGS }
                StatusPill(
                    when (link) {
                        RelayClient.Link.OPEN -> if (hellos.isEmpty()) "RELÉ · nincs app" else "RELÉ · " + hellos.keys.joinToString(" · ")
                        RelayClient.Link.CONNECTING -> "RELÉ · kapcsolódás…"
                        RelayClient.Link.OFF -> "RELÉ · nincs beállítva"
                    },
                    when {
                        link == RelayClient.Link.OPEN && hellos.isNotEmpty() -> Melyviz.current
                        link == RelayClient.Link.OFF -> Melyviz.faint
                        else -> Melyviz.sand
                    },
                ) { sheet = Sheet.SETTINGS }
            }

            // ---- readout from the app --------------------------------------------------------
            val bits = Profiles.stateBits(target, state)
            Text(
                if (target == Target.GENERAL) "Bármely gépen: tartsd a középső gombot és mutass."
                else if (bits.isEmpty()) "nincs adat — ${target.label.lowercase()}"
                else bits.joinToString("  ·  "),
                style = Melyviz.readout.copy(color = if (bits.isEmpty()) Melyviz.faint else Melyviz.ink),
                maxLines = 1, overflow = TextOverflow.Ellipsis,
                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
            )

            // ---- the app's own pad (from its hello) ----------------------------------------
            val tools = hello?.tools.orEmpty()
            if (tools.isNotEmpty()) {
                LazyVerticalGrid(
                    columns = GridCells.Fixed(5),
                    modifier = Modifier.fillMaxWidth().heightIn(max = 172.dp),
                    horizontalArrangement = Arrangement.spacedBy(5.dp),
                    verticalArrangement = Arrangement.spacedBy(5.dp),
                ) {
                    items(tools, key = { it.mode }) { t ->
                        DeckTile(t.key ?: "·", t.label, active = t.mode == activeMode, minHeight = 50.dp) {
                            Deck.perform(Send.Cmd("tool.select", mapOf("index" to t.index, "key" to t.key)))
                        }
                    }
                }
                Spacer(Modifier.height(6.dp))
            }
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                profile.extras.forEach { a ->
                    DeckTile(a.glyph, a.label, modifier = Modifier.width(64.dp), minHeight = 44.dp) { Deck.perform(a.send) }
                }
            }
            Spacer(Modifier.height(8.dp))

            // ---- pad ---------------------------------------------------------------------------
            Box(Modifier.fillMaxWidth().weight(1f)) {
                Touchpad(padToApp, Modifier.fillMaxSize())
                if (target != Target.GENERAL) {
                    Row(Modifier.align(Alignment.TopEnd).padding(8.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Chip("EGÉR", !padToApp) { Deck.padToApp.value = false }
                        Chip("KAMERA", padToApp) { Deck.padToApp.value = true }
                    }
                }
            }
            Spacer(Modifier.height(8.dp))

            // ---- L · CLUTCH · R --------------------------------------------------------------
            Row(Modifier.fillMaxWidth().height(92.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                HoldTile(Modifier.weight(1f).fillMaxSize(), held = leftHeld, accent = Melyviz.current,
                    onPress = { leftHeld = true; Deck.hid.button(Hid.Btn.LEFT, true); Deck.haptic(6) },
                    onRelease = { leftHeld = false; Deck.hid.button(Hid.Btn.LEFT, false) }) {
                    Text("BAL", style = Melyviz.label.copy(letterSpacing = 1.5.sp))
                }
                HoldTile(Modifier.weight(1.5f).fillMaxSize(), held = clutch || latched,
                    onPress = { Deck.clutch.value = true; Deck.haptic(12) },
                    onRelease = { Deck.clutch.value = false }) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("⟡", style = Melyviz.glyph.copy(fontSize = 26.sp, color = if (clutch || latched) Melyviz.onGlow else Melyviz.glow))
                        Text(if (latched) "MUTAT · RÖGZÍTVE" else "TARTSD · MUTAT",
                            style = Melyviz.label.copy(letterSpacing = 1.5.sp, fontWeight = FontWeight.Bold,
                                color = if (clutch || latched) Melyviz.onGlow else Melyviz.ink))
                    }
                }
                HoldTile(Modifier.weight(1f).fillMaxSize(), held = rightHeld, accent = Melyviz.current,
                    onPress = { rightHeld = true; Deck.hid.button(Hid.Btn.RIGHT, true); Deck.haptic(6) },
                    onRelease = { rightHeld = false; Deck.hid.button(Hid.Btn.RIGHT, false) }) {
                    Text("JOBB", style = Melyviz.label.copy(letterSpacing = 1.5.sp))
                }
            }
            Spacer(Modifier.height(8.dp))

            // ---- bottom row: the profile's four, then camera, scrub, latch ---------------------
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                profile.bar.forEach { a ->
                    DeckTile(a.glyph, a.label, modifier = Modifier.weight(1f), minHeight = 50.dp) { Deck.perform(a.send) }
                }
                if (target != Target.GENERAL) {
                    DeckTile("🧭", "Kamera", modifier = Modifier.weight(1f), active = camera, accent = Melyviz.current, minHeight = 50.dp) {
                        Deck.setCamera(!camera)
                    }
                }
                HoldTile(Modifier.weight(1f).height(50.dp), held = scrubbing,
                    onPress = { Deck.setScrub(true) }, onRelease = { Deck.setScrub(false) }) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("⇆", style = Melyviz.glyph.copy(fontSize = 17.sp, color = if (scrubbing) Melyviz.onGlow else Melyviz.ink))
                        Text(profile.scrubLabel, style = Melyviz.small.copy(fontSize = 10.sp, color = if (scrubbing) Melyviz.onGlow else Melyviz.muted))
                    }
                }
                DeckTile("⚲", "Rögzít", modifier = Modifier.weight(1f), active = latched, minHeight = 50.dp) {
                    Deck.clutchLatched.value = !latched
                }
            }

            Text(note, style = Melyviz.small.copy(color = Melyviz.sand), maxLines = 2,
                modifier = Modifier.fillMaxWidth().heightIn(min = 22.dp).padding(top = 4.dp, bottom = 6.dp))
        }

        when (sheet) {
            Sheet.KEYS -> KeysSheet(target) { sheet = Sheet.NONE }
            Sheet.SETTINGS -> SettingsSheet(onAskPermissions) { sheet = Sheet.NONE }
            Sheet.NONE -> {}
        }
    }
}

@Composable
private fun IconTile(glyph: String, onClick: () -> Unit) {
    val shape = RoundedCornerShape(Melyviz.radiusSmall)
    Box(
        Modifier.size(38.dp).clip(shape).background(Melyviz.surface).border(1.dp, Melyviz.line, shape).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Text(glyph, style = Melyviz.glyph.copy(fontSize = 17.sp)) }
}

/** Shows what the phone is aimed at; tap to pin a target or go back to following the PC's focus. */
@Composable
private fun TargetChip(target: Target, pinned: Target?) {
    var open by remember { mutableStateOf(false) }
    Box {
        val shape = RoundedCornerShape(50)
        Text(
            (if (pinned == null) "◎ " else "⚲ ") + target.label,
            style = Melyviz.readout.copy(color = if (target == Target.GENERAL) Melyviz.muted else Melyviz.current, fontSize = 11.sp),
            modifier = Modifier.clip(shape).border(1.dp, Melyviz.lineSoft, shape).clickable { open = true }
                .padding(horizontal = 9.dp, vertical = 4.dp),
        )
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(text = { Text("◎ Követi a PC fókuszt") }, onClick = { Deck.pinned.value = null; open = false })
            Target.entries.forEach { t ->
                DropdownMenuItem(text = { Text("⚲ " + t.label) }, onClick = { Deck.pinned.value = t; open = false })
            }
        }
    }
}
