package hu.vrg.mobile.kit.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.theme.Palette

// Mélyvíz building blocks shared by the features' screens (the shell's settings first). They match
// the ones Légegér's sheets were drawn with, so a setting looks the same wherever it sits.

@Composable
fun VrgSectionTitle(text: String) {
    Text(text.uppercase(), style = Melyviz.small.copy(letterSpacing = 1.6.sp, color = Melyviz.glowDim),
        modifier = Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 6.dp))
}

@Composable
fun VrgChip(text: String, selected: Boolean = false, onClick: () -> Unit) {
    val shape = RoundedCornerShape(50)
    Text(
        text,
        style = Melyviz.label.copy(color = if (selected) Melyviz.onGlow else Melyviz.ink, fontSize = 11.sp),
        modifier = Modifier.clip(shape).background(if (selected) Melyviz.glow else Melyviz.surface)
            .border(1.dp, if (selected) Melyviz.glow else Melyviz.line, shape)
            .clickable(onClick = onClick).padding(horizontal = 10.dp, vertical = 5.dp),
    )
}

@Composable
fun VrgToggle(label: String, value: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = Melyviz.label, modifier = Modifier.weight(1f))
        Switch(value, onChange, colors = SwitchDefaults.colors(
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
        ), modifier = Modifier.height(32.dp))
    }
}

/** One palette: its name and a strip of its colours, so it can be chosen without trying each. */
@Composable
fun PaletteRow(p: Palette, selected: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(Melyviz.radiusSmall)
    Row(
        Modifier.fillMaxWidth().padding(vertical = 3.dp).clip(shape)
            .background(p.surface)
            .border(if (selected) 2.dp else 1.dp, if (selected) Melyviz.glow else Melyviz.line, shape)
            .clickable(onClick = onClick).padding(horizontal = 12.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(p.name, style = Melyviz.label.copy(color = p.ink, fontSize = 12.sp), modifier = Modifier.weight(1f))
        listOf(p.abyss, p.raised, p.line, p.glow, p.current, p.sand, p.coral).forEach { c ->
            Box(Modifier.padding(start = 4.dp).size(14.dp).clip(CircleShape).background(c).border(1.dp, p.line, CircleShape))
        }
        if (selected) Text("  ✓", style = Melyviz.label.copy(color = p.glow))
    }
}
