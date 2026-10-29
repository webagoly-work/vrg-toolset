package hu.vrg.mobile

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.vrg.mobile.core.FeatureInfo
import hu.vrg.mobile.core.Stage
import hu.vrg.mobile.kit.theme.Melyviz

// The home screen: every feature of the catalogue as a tile, grouped. Built ones open; planned ones
// open their PlannedScreen, which says what they will do and which WP builds them.

@Composable
fun HomeScreen(onOpen: (String) -> Unit) {
    Column(
        Modifier.fillMaxSize().systemBarsPadding().verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        Text("VRG MOBILE", style = Melyviz.title.copy(fontSize = 18.sp))
        Text("A VRG munka társalkalmazása", style = Melyviz.small)
        Spacer(Modifier.height(8.dp))
        Registry.catalogue.forEach { (group, items) ->
            Text(group.label.uppercase(), style = Melyviz.small.copy(letterSpacing = 1.6.sp), modifier = Modifier.padding(top = 14.dp, bottom = 6.dp))
            items.chunked(2).forEach { row ->
                Row(Modifier.fillMaxWidth().padding(bottom = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    row.forEach { Tile(it, Modifier.weight(1f)) { onOpen(it.id) } }
                    if (row.size == 1) Spacer(Modifier.weight(1f))
                }
            }
        }
        Spacer(Modifier.height(24.dp))
        Text("v${BuildConfig.VERSION_NAME}", style = Melyviz.readout)
    }
}

@Composable
private fun Tile(f: FeatureInfo, modifier: Modifier, onClick: () -> Unit) {
    val built = Registry.isBuilt(f)
    val shape = RoundedCornerShape(Melyviz.radius)
    Column(
        modifier.heightIn(min = 112.dp)
            .background(if (built) Melyviz.raised else Melyviz.surface.copy(alpha = 0.7f), shape)
            .border(BorderStroke(1.dp, if (built) Melyviz.glowDim else Melyviz.lineSoft), shape)
            .clickable(onClick = onClick)
            .padding(12.dp),
    ) {
        Row {
            Text(f.glyph, style = Melyviz.glyph.copy(color = if (built) Melyviz.glow else Melyviz.faint))
            Spacer(Modifier.weight(1f))
            StageBadge(f.stage)
        }
        Spacer(Modifier.height(6.dp))
        Text(f.title, style = Melyviz.label.copy(color = if (built) Melyviz.ink else Melyviz.muted))
        Text(f.blurb, style = Melyviz.small.copy(fontSize = 10.sp), maxLines = 3)
    }
}

@Composable
fun StageBadge(s: Stage) {
    val c: Color = when (s) {
        Stage.LIVE -> Melyviz.kelp
        Stage.BETA -> Melyviz.sand
        Stage.PLANNED -> Melyviz.faint
    }
    Text(
        s.label, style = Melyviz.small.copy(fontSize = 9.sp, color = c),
        modifier = Modifier.border(BorderStroke(1.dp, c), RoundedCornerShape(6.dp)).padding(horizontal = 5.dp, vertical = 1.dp),
    )
}

@Composable
fun PlannedScreen(f: FeatureInfo, onBack: () -> Unit) {
    Column(Modifier.fillMaxSize().systemBarsPadding().padding(20.dp)) {
        Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current), modifier = Modifier.clickable(onClick = onBack).padding(vertical = 8.dp))
        Spacer(Modifier.height(24.dp))
        Text(f.glyph, style = Melyviz.glyph.copy(fontSize = 44.sp, color = Melyviz.glowDim))
        Spacer(Modifier.height(10.dp))
        Row { Text(f.title, style = Melyviz.title); Spacer(Modifier.weight(1f)); StageBadge(f.stage) }
        Spacer(Modifier.height(10.dp))
        Text(f.blurb, style = Melyviz.label.copy(color = Melyviz.muted))
        Spacer(Modifier.height(18.dp))
        Text("Munkacsomag: ${f.wp}  ·  docs/mobile/WP/${f.wp}.md", style = Melyviz.readout)
        if (f.needs.isNotEmpty()) Text("Kell hozzá: " + f.needs.joinToString(" · ") { it.label }, style = Melyviz.readout)
    }
}
