package hu.vrg.mobile.kit.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.role
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import hu.vrg.mobile.core.MiniStatus
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.theme.Palette
import hu.vrg.mobile.kit.theme.vrgBorder

// Mélyvíz building blocks shared by the features' screens (the shell's settings first). They match
// the ones Légegér's sheets were drawn with, so a setting looks the same wherever it sits.

@Composable
fun VrgSectionTitle(text: String) {
    Text(text.uppercase(), style = Melyviz.small.copy(letterSpacing = 1.6.sp, color = Melyviz.glowDim),
        modifier = Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 6.dp))
}

/**
 * A chip. With a busy [status] (WP M16) a small MINI ring stands before the text and TalkBack reads the state
 * ("Küldés — fut"); without one, or idle, it is the chip it always was.
 */
@Composable
fun VrgChip(text: String, selected: Boolean = false, status: MiniStatus? = null, enabled: Boolean = true, onClick: () -> Unit) {
    val shape = RoundedCornerShape(50)
    // [enabled] false (audit 6.3): an outline chip in muted text that does nothing and says so to TalkBack
    val lit = selected && enabled
    val style = Melyviz.label.copy(color = if (lit) Melyviz.onGlow else if (enabled) Melyviz.ink else Melyviz.muted, fontSize = 11.sp)
    // a button for TalkBack (with its selected state), and taller than it was (25 → ~33 dp; Compose widens the touch area
    // to 48 dp where there is room): UI-CHECKLIST 1, 6, 8. Selected is a filled chip, unselected an outline: not colour alone.
    val base = Modifier.clip(shape).background(if (lit) Melyviz.glow else Melyviz.surface)
        .vrgBorder(1.dp, if (lit) Melyviz.glow else Melyviz.line, shape)
        .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
        .semantics { this.selected = selected }
    if (status == null || !status.busy) {
        Text(text, style = style, modifier = base.padding(horizontal = 12.dp, vertical = 9.dp))
        return
    }
    Row(
        base.clearAndSetSemantics { contentDescription = status.describe(text); role = Role.Button; if (!enabled) disabled() }
            .padding(start = 9.dp, end = 12.dp, top = 9.dp, bottom = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Mini(null, text, status, size = MiniSize.XS, modifier = Modifier.padding(end = 5.dp))
        Text(text, style = style)
    }
}

@Composable
fun VrgToggle(label: String, value: Boolean, onChange: (Boolean) -> Unit) {
    // the whole row toggles (label included) and is one TalkBack stop: UI-CHECKLIST 1.3
    Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).toggleable(value = value, role = Role.Switch, onValueChange = onChange).padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = Melyviz.label, modifier = Modifier.weight(1f))
        Switch(value, onCheckedChange = null, colors = SwitchDefaults.colors(
            checkedThumbColor = Melyviz.onGlow, checkedTrackColor = Melyviz.glow,
            uncheckedThumbColor = Melyviz.muted, uncheckedTrackColor = Melyviz.surface, uncheckedBorderColor = Melyviz.line,
        ))
    }
}

@Composable
fun VrgSlider(label: String, value: Float, range: ClosedFloatingPointRange<Float>, format: String, onChange: (Float) -> Unit) {
    Column(Modifier.fillMaxWidth()) {
        Row {
            Text(label, style = Melyviz.label, modifier = Modifier.weight(1f))
            Text(format.format(value), style = Melyviz.readout)
        }
        Slider(value, onChange, valueRange = range, colors = SliderDefaults.colors(
            thumbColor = Melyviz.glow, activeTrackColor = Melyviz.glow, inactiveTrackColor = Melyviz.line,
        ))   // no fixed height: it clipped the slider's 48 dp touch area
    }
}

/** One palette: its name and a strip of its colours, so it can be chosen without trying each. */
@Composable
fun PaletteRow(p: Palette, selected: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(Melyviz.radiusSmall)
    Row(
        Modifier.fillMaxWidth().padding(vertical = 3.dp).heightIn(min = 48.dp).clip(shape)
            .background(p.surface)
            .vrgBorder(if (selected) 2.dp else 1.dp, if (selected) Melyviz.glow else Melyviz.line, shape)
            .clickable(role = Role.RadioButton, onClick = onClick).semantics { this.selected = selected }.padding(horizontal = 12.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(p.name, style = Melyviz.label.copy(color = p.ink, fontSize = 12.sp), modifier = Modifier.weight(1f))
        listOf(p.abyss, p.raised, p.line, p.glow, p.current, p.sand, p.coral).forEach { c ->
            Box(Modifier.padding(start = 4.dp).size(14.dp).clip(CircleShape).background(c).border(1.dp, p.line, CircleShape))
        }
        if (selected) Text("  ✓", style = Melyviz.label.copy(color = p.glow))
    }
}

/** "‹ Vissza" at the top of a page: a 48 dp target that TalkBack reads as a button (UI audit; it was ~32 dp of text). */
@Composable
fun VrgBack(onClick: () -> Unit) {
    Box(Modifier.heightIn(min = 48.dp).clickable(role = Role.Button, onClickLabel = "Vissza", onClick = onClick)
        .semantics { contentDescription = "Vissza" }.padding(end = 12.dp), contentAlignment = Alignment.CenterStart) {
        Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current), modifier = Modifier.clearAndSetSemantics { })
    }
}
