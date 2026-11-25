package hu.vrg.legeger.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.legeger.Deck
import hu.vrg.legeger.Section
import hu.vrg.legeger.core.Hid
import hu.vrg.legeger.core.PadGesture
import hu.vrg.legeger.core.Profile
import hu.vrg.legeger.core.Profiles
import hu.vrg.legeger.core.Send
import hu.vrg.legeger.core.Target
import hu.vrg.legeger.hid.HidPeripheral
import hu.vrg.mobile.kit.relay.LinkState
import hu.vrg.mobile.kit.theme.Melyviz
import kotlinx.coroutines.delay
import java.io.File

enum class Sheet { NONE, KEYS, SETTINGS, SHOTS, MACROS }

/**
 * The deck. [onNote] (the shell's note line) takes the deck's messages while its own Üzenetsor is hidden, so an error such
 * as "A vágólap üres." is never lost (UI-CHECKLIST 6.5).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun DeckScreen(
    onAskPermissions: () -> Unit,
    onDictate: () -> Unit,
    onOpenFeature: (String) -> Unit,
    onNote: ((String) -> Unit)? = null,
) {
    val s by Deck.settings.flow.collectAsStateWithLifecycle()
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
    val padMode by Deck.padMode.collectAsStateWithLifecycle()
    val running by Deck.macroRunning.collectAsStateWithLifecycle()
    val shots by Deck.shots.collectAsStateWithLifecycle()
    val shotPending by Deck.shotPending.collectAsStateWithLifecycle()

    var sheet by remember { mutableStateOf(Sheet.NONE) }
    var shotOpen by remember { mutableStateOf<File?>(null) }
    var note by remember { mutableStateOf("") }
    var leftHeld by remember { mutableStateOf(false) }
    var rightHeld by remember { mutableStateOf(false) }

    val hiddenNow by rememberUpdatedState(s.hidden)
    val toShell by rememberUpdatedState(onNote)
    LaunchedEffect(Unit) {
        Deck.notes.collect { n ->
            val out = toShell
            if (Section.NOTE in hiddenNow && out != null) { out(n); return@collect }
            note = n
        }
    }
    LaunchedEffect(note) { if (note.isNotEmpty()) { delay(4000); note = "" } }
    // a screenshot from the PC opens itself, ready to save or share
    LaunchedEffect(Unit) { Deck.shotArrived.collect { shotOpen = it; sheet = Sheet.SHOTS } }

    val profile = Profiles.of(target)
    val hello = target.role?.let { hellos[it] }
    val state = target.role?.let { states[it] }
    val activeMode = state?.get("mode")?.toString()
    fun shown(x: Section) = x !in s.hidden

    // ---- the sections, each one composable, laid out below either upright or side by side ---------
    val header: @Composable () -> Unit = {
        Row(Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 2.dp), verticalAlignment = Alignment.CenterVertically) {
            // the brand is only the mark: the header is full of things to press
            Text("◈", style = Melyviz.title.copy(color = Melyviz.glow, fontSize = 20.sp))
            Spacer(Modifier.width(8.dp))
            Box(Modifier.weight(1f)) { TargetChip(target, pinned) }
            IconTile(if (shotPending) "⏳" else "📸", if (shotPending) "Képernyőkép készül" else "Képernyőkép a PC-ről") { Deck.screenshot() }
            if (shots.isNotEmpty()) IconTile("🖼", "Képernyőképek") { shotOpen = shots.first(); sheet = Sheet.SHOTS }
            IconTile("⌨", "Billentyűzet") { sheet = Sheet.KEYS }
            IconTile("⚙", "Beállítások") { sheet = Sheet.SETTINGS }
        }
    }

    // everything between the header and the pad: it scrolls when the screen is short (UI-CHECKLIST 4.1)
    val upper: @Composable () -> Unit = {
        Column(Modifier.fillMaxWidth()) {
            // the two pills share the row; each gives way instead of pushing the other out (UI-CHECKLIST 4.5)
            if (shown(Section.PILLS)) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
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
                    Modifier.weight(1f, fill = false),
                ) { if (phase == HidPeripheral.Phase.NO_PERMISSION) onAskPermissions() else sheet = Sheet.SETTINGS }
                StatusPill(
                    when (link) {
                        LinkState.OPEN -> if (hellos.isEmpty()) "RELÉ · nincs app" else "RELÉ · " + hellos.keys.joinToString(" · ")
                        LinkState.CONNECTING -> "RELÉ · kapcsolódás…"
                        LinkState.OFF -> "RELÉ · nincs beállítva"
                    },
                    when {
                        link == LinkState.OPEN && hellos.isNotEmpty() -> Melyviz.current
                        link == LinkState.OFF -> Melyviz.faint
                        else -> Melyviz.sand
                    },
                    Modifier.weight(1f, fill = false),
                ) { sheet = Sheet.SETTINGS }
            }

            // ---- readout ----------------------------------------------------------------------
            if (shown(Section.STATE)) {
                val bits = Profiles.stateBits(target, state)
                Text(
                    when {
                        target == Target.PHONE -> "Telefon mód: a pad a másik telefon képernyője. ◁ ○ ▢ lent."
                        target == Target.PRESENT -> "Prezentáció: tartsd a MUTAT-ot lézernek, csukló ← → diák."
                        target == Target.GENERAL -> "Bármely gépen: tartsd a középső gombot és mutass."
                        bits.isEmpty() -> "nincs adat — ${target.label.lowercase()}"
                        else -> bits.joinToString("  ·  ")
                    },
                    style = Melyviz.readout.copy(color = if (bits.isEmpty()) Melyviz.faint else Melyviz.ink),
                    maxLines = 1, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                )
            } else Spacer(Modifier.height(8.dp))

            // ---- the app's own pad (from its hello) ------------------------------------------
            val tools = hello?.tools.orEmpty()
            if (shown(Section.TOOLS) && tools.isNotEmpty()) {
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
            if (shown(Section.EXTRAS)) {
                ScrollRow {
                    profile.extras.forEach { a ->
                        DeckTile(a.glyph, a.label, modifier = Modifier.width(64.dp), minHeight = 44.dp) { Deck.perform(a.send) }
                    }
                }
                Spacer(Modifier.height(6.dp))
            }
            if (shown(Section.MACROS)) {
                // the edit tile stays outside the scroller, so more macros cannot push it off-screen (UI-CHECKLIST 3.5)
                Row(Modifier.fillMaxWidth()) {
                    ScrollRow(Modifier.weight(1f)) {
                        s.macros.filter { it.onDeck }.forEach { m ->
                            DeckTile(m.glyph, m.name, modifier = Modifier.width(64.dp), minHeight = 44.dp,
                                active = running == m.id, accent = Melyviz.current) { Deck.runMacro(m) }
                        }
                    }
                    Spacer(Modifier.width(5.dp))
                    DeckTile("✎", "Makrók", modifier = Modifier.width(56.dp), minHeight = 44.dp) { sheet = Sheet.MACROS }
                }
                Spacer(Modifier.height(6.dp))
            }
        }
    }

    // ---- pad ---------------------------------------------------------------------------
    val pad: @Composable () -> Unit = {
        Box(Modifier.fillMaxSize()) {
            Touchpad(
                padMode,
                PadConfig(s.padGestures, s.edgeSwipes, s.padHints, s.phoneAspect, cheatOf(profile)),
                Modifier.fillMaxSize(),
            )
            if (profile.padModes.size > 1) {
                Row(Modifier.align(Alignment.TopEnd).padding(8.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    profile.padModes.forEach { m -> Chip(m.label, padMode == m) { Deck.padMode.value = m } }
                }
            }
        }
    }

    val lower: @Composable () -> Unit = {
        Column(Modifier.fillMaxWidth()) {
            // ---- L · CLUTCH · R (mirrored for the left hand) ----------------------------------
            if (shown(Section.BUTTONS)) {
                Row(Modifier.fillMaxWidth().height(92.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    val left: @Composable RowScope.() -> Unit = {
                        HoldTile(Modifier.weight(1f).fillMaxSize(), held = leftHeld, accent = Melyviz.current, label = "Bal klikk",
                            onPress = { leftHeld = true; Deck.hid.button(Hid.Btn.LEFT, true); Deck.haptic(6) },
                            onRelease = { leftHeld = false; Deck.hid.button(Hid.Btn.LEFT, false) }) {
                            Text("BAL", style = Melyviz.label.copy(letterSpacing = 1.5.sp))
                        }
                    }
                    val right: @Composable RowScope.() -> Unit = {
                        HoldTile(Modifier.weight(1f).fillMaxSize(), held = rightHeld, accent = Melyviz.current, label = "Jobb klikk",
                            onPress = { rightHeld = true; Deck.hid.button(Hid.Btn.RIGHT, true); Deck.haptic(6) },
                            onRelease = { rightHeld = false; Deck.hid.button(Hid.Btn.RIGHT, false) }) {
                            Text("JOBB", style = Melyviz.label.copy(letterSpacing = 1.5.sp))
                        }
                    }
                    if (s.lefty) right() else left()
                    // without a finger to hold it, TalkBack's click latches the pointer on or off
                    HoldTile(Modifier.weight(1.5f).fillMaxSize(), held = clutch || latched,
                        label = if (latched) "Mutatás rögzítve, kikapcsolás" else "Mutatás rögzítése",
                        onAccessClick = { Deck.clutchLatched.value = !Deck.clutchLatched.value },
                        onPress = { Deck.clutch.value = true; Deck.haptic(12) },
                        onRelease = { Deck.clutch.value = false }) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("⟡", style = Melyviz.glyph.copy(fontSize = 26.sp, color = if (clutch || latched) Melyviz.onGlow else Melyviz.glow))
                            Text(if (latched) "MUTAT · RÖGZÍTVE" else "TARTSD · MUTAT",
                                style = Melyviz.label.copy(letterSpacing = 1.5.sp, fontWeight = FontWeight.Bold,
                                    color = if (clutch || latched) Melyviz.onGlow else Melyviz.ink))
                            if (s.precision && (clutch || latched)) Text("ujj a padon = finom", style = Melyviz.small.copy(
                                fontSize = 9.sp, color = Melyviz.onGlow))
                        }
                    }
                    if (s.lefty) left() else right()
                }
                Spacer(Modifier.height(8.dp))
            }

            // ---- bottom row: the profile's four, then camera, scrub, latch ---------------------
            // more than six tiles wrap four to a row, so none gets narrower than a thumb (UI-CHECKLIST 1.1, 1.5)
            val barCount = profile.bar.size + (if (target.fromRelay) 1 else 0) + 2
            if (shown(Section.BAR)) FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(5.dp),
                verticalArrangement = Arrangement.spacedBy(5.dp), maxItemsInEachRow = if (barCount > 6) 4 else barCount) {
                profile.bar.forEach { a ->
                    DeckTile(a.glyph, a.label, modifier = Modifier.weight(1f), minHeight = 50.dp) { Deck.perform(a.send) }
                }
                if (target.fromRelay) {
                    DeckTile("🧭", "Kamera", modifier = Modifier.weight(1f), active = camera, accent = Melyviz.current, minHeight = 50.dp) {
                        Deck.setCamera(!camera)
                    }
                }
                // TalkBack's click turns the scrub on or off (a finger holds it)
                HoldTile(Modifier.weight(1f).height(50.dp), held = scrubbing,
                    label = profile.scrubLabel + if (scrubbing) " (be)" else " (ki)",
                    onAccessClick = { Deck.setScrub(!Deck.scrubbing.value) },
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

            if (shown(Section.NOTE)) Text(note, style = Melyviz.small.copy(color = Melyviz.sand), maxLines = 2,
                modifier = Modifier.fillMaxWidth().heightIn(min = 22.dp).padding(top = 4.dp, bottom = 6.dp))
            else Spacer(Modifier.height(8.dp))
        }
    }

    Box(Modifier.fillMaxSize().background(Melyviz.water)) {
        BoxWithConstraints(
            Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(horizontal = Melyviz.gutter),
        ) {
            // lying down (or any short screen) the pad takes the left half and the rest scrolls on the right; upright the
            // pad keeps at least 160 dp and what is above it scrolls (UI-CHECKLIST 4.1, 4.5, 2.2)
            if (maxHeight < 520.dp && shown(Section.PAD)) {
                Row(Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(Modifier.weight(1f).fillMaxHeight().padding(vertical = 8.dp)) { pad() }
                    Column(Modifier.weight(1f).fillMaxHeight()) {
                        header()
                        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState())) {
                            upper()
                            lower()
                        }
                    }
                }
            } else {
                PadColumn(
                    padMin = if (shown(Section.PAD)) 160.dp else 0.dp,
                    header = header,
                    upper = { Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState())) { upper() } },
                    pad = { if (shown(Section.PAD)) Box(Modifier.fillMaxSize().padding(bottom = 8.dp)) { pad() } },
                    lower = lower,
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }

        when (sheet) {
            Sheet.KEYS -> KeysSheet(target, onDictate) { sheet = Sheet.NONE }
            Sheet.SETTINGS -> SettingsSheet(
                onAskPermissions, onMacros = { sheet = Sheet.MACROS },
                onOpenFeature = { id -> sheet = Sheet.NONE; onOpenFeature(id) },
            ) { sheet = Sheet.NONE }
            Sheet.MACROS -> MacroSheet { sheet = Sheet.NONE }
            Sheet.SHOTS -> ShotSheet(shotOpen ?: shots.firstOrNull(), onPick = { shotOpen = it }) { sheet = Sheet.NONE }
            Sheet.NONE -> {}
        }
    }
}

@Composable
private fun ScrollRow(modifier: Modifier = Modifier.fillMaxWidth(), content: @Composable RowScope.() -> Unit) {
    Row(modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(5.dp), content = content)
}

/**
 * The upright deck, top to bottom: [header] and [lower] as tall as they are, [upper] (which scrolls itself) at most what is
 * left after the pad's [padMin], and [pad] the rest. So a short screen or a large font scrolls the rows above the pad
 * instead of squeezing the pad to nothing and pushing the bottom rows off-screen (UI-CHECKLIST 4.1).
 */
@Composable
private fun PadColumn(
    padMin: Dp,
    header: @Composable () -> Unit,
    upper: @Composable () -> Unit,
    pad: @Composable () -> Unit,
    lower: @Composable () -> Unit,
    modifier: Modifier = Modifier,
) {
    Layout(
        content = {
            Box { header() }
            Box { upper() }
            Box { pad() }
            Box { lower() }
        },
        modifier = modifier,
    ) { ms, c ->
        val w = c.maxWidth
        val loose = Constraints(minWidth = w, maxWidth = w, minHeight = 0, maxHeight = if (c.hasBoundedHeight) c.maxHeight else Constraints.Infinity)
        val head = ms[0].measure(loose)
        val low = ms[3].measure(loose)
        val minPad = padMin.roundToPx()
        val h = if (c.hasBoundedHeight) c.maxHeight else head.height + low.height + minPad * 3
        val upMax = (h - head.height - low.height - minPad).coerceAtLeast(0)
        val up = ms[1].measure(Constraints(minWidth = w, maxWidth = w, minHeight = 0, maxHeight = upMax))
        val padH = (h - head.height - up.height - low.height).coerceAtLeast(0)
        val padP = ms[2].measure(Constraints.fixed(w, padH))
        layout(w, h) {
            var y = 0
            head.place(0, y); y += head.height
            up.place(0, y); y += up.height
            padP.place(0, y); y += padH
            low.place(0, y)
        }
    }
}

/** "3 ujj: ↑ Feladatnézet · ↓ Asztal …" — the cheat sheet under the pad hints. */
private fun cheatOf(p: Profile): String {
    fun line(prefix: String, items: List<Pair<String, PadGesture>>): String? {
        val parts = items.mapNotNull { (arrow, g) -> p.gestures[g]?.let { "$arrow ${it.label}" } }
        return if (parts.isEmpty()) null else "$prefix: " + parts.joinToString(" · ")
    }
    return listOfNotNull(
        line("3 ujj", listOf("↑" to PadGesture.SWIPE3_UP, "↓" to PadGesture.SWIPE3_DOWN, "←" to PadGesture.SWIPE3_LEFT,
            "→" to PadGesture.SWIPE3_RIGHT, "•" to PadGesture.TAP3)),
        line("4 ujj", listOf("↑" to PadGesture.SWIPE4_UP, "↓" to PadGesture.SWIPE4_DOWN, "←" to PadGesture.SWIPE4_LEFT,
            "→" to PadGesture.SWIPE4_RIGHT, "•" to PadGesture.TAP4)),
    ).joinToString("\n")
}

/** A header button: the 38 dp tile as before inside a 48 dp target, named [label] for TalkBack (UI-CHECKLIST 1.1, 3.4, 8.1). */
@Composable
private fun IconTile(glyph: String, label: String, onClick: () -> Unit) {
    val shape = RoundedCornerShape(Melyviz.radiusSmall)
    Box(
        Modifier.size(48.dp).clickable(role = Role.Button, onClick = onClick).semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        Box(Modifier.size(38.dp).clip(shape).background(Melyviz.surface).border(1.dp, Melyviz.line, shape), contentAlignment = Alignment.Center) {
            Text(glyph, style = Melyviz.glyph.copy(fontSize = 17.sp))
        }
    }
}

/** Shows what the phone is aimed at; tap to pin a target or go back to automatic. */
@Composable
private fun TargetChip(target: Target, pinned: Target?) {
    var open by remember { mutableStateOf(false) }
    Box {
        val shape = RoundedCornerShape(50)
        Text(
            (if (pinned == null) "◎ " else "⚲ ") + target.label,
            style = Melyviz.readout.copy(color = if (target == Target.GENERAL) Melyviz.muted else Melyviz.current, fontSize = 11.sp),
            maxLines = 1,
            // a 48 dp target around the small chip (UI-CHECKLIST 1.1)
            modifier = Modifier.heightIn(min = 48.dp).clickable(role = Role.Button, onClickLabel = "cél választása") { open = true }
                .wrapContentHeight().clip(shape).border(1.dp, Melyviz.lineSoft, shape)
                .padding(horizontal = 9.dp, vertical = 4.dp),
        )
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(text = { Text("◎ Automatikus (PC fókusz / telefon)") }, onClick = { Deck.pinned.value = null; open = false })
            Target.entries.forEach { t ->
                DropdownMenuItem(text = { Text("⚲ " + t.label) }, onClick = { Deck.pinned.value = t; open = false })
            }
        }
    }
}
