package hu.vrg.mobile

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.FeatureInfo
import hu.vrg.mobile.core.Stage
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.theme.vrgBorder
import hu.vrg.mobile.kit.ui.Mini
import hu.vrg.mobile.kit.ui.MiniSize
import hu.vrg.mobile.kit.ui.VrgBack
import hu.vrg.mobile.update.UpdateFeature
import hu.vrg.mobile.core.FeatureIcons
import hu.vrg.mobile.kit.ui.PixelIcon

// Parts shared by the home and the shell: the update mark, the stage badge and the PlannedScreen of a planned feature
// (what it will do and which WP builds it). The Kompakt home that lived here is the one-page view now (WP M38).

/** "⟳ új" in the top bar while an update waits; opens Frissítés. */
@Composable
internal fun UpdateMark(onOpen: () -> Unit) {
    val state by UpdateFeature.state.collectAsStateWithLifecycle()
    if (state.waiting) {
        // a 48 dp tall button in the top strip (UI audit 1.1: it was ~32 dp of text)
        Box(Modifier.heightIn(min = 48.dp).clickable(role = Role.Button, onClickLabel = "Frissítés megnyitása", onClick = onOpen).padding(horizontal = 8.dp),
            contentAlignment = Alignment.Center) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                val px = FeatureIcons.of(Catalogue.UPDATE)
                if (px != null) { PixelIcon(px, 16.dp, color = Melyviz.sand); Spacer(Modifier.width(5.dp)); Text("új", style = Melyviz.label.copy(color = Melyviz.sand)) }
                else Text("${Catalogue.UPDATE.glyph} új", style = Melyviz.label.copy(color = Melyviz.sand))
            }
        }
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
        modifier = Modifier.vrgBorder(BorderStroke(1.dp, c), RoundedCornerShape(6.dp)).padding(horizontal = 5.dp, vertical = 1.dp),
    )
}

@Composable
fun PlannedScreen(f: FeatureInfo, onBack: () -> Unit) {
    // scrolls: lying down the blurb and "Kell hozzá" were cut off (UI audit 4.1)
    Column(Modifier.fillMaxSize().systemBarsPadding().verticalScroll(rememberScrollState()).padding(20.dp)) {
        VrgBack(onBack)
        Spacer(Modifier.height(24.dp))
        val px = FeatureIcons.of(f)
        if (px != null) PixelIcon(px, 48.dp) else Text(f.glyph, style = Melyviz.glyph.copy(fontSize = 44.sp, color = Melyviz.glowDim))
        Spacer(Modifier.height(10.dp))
        Row { Text(f.title, style = Melyviz.title); Spacer(Modifier.weight(1f)); StageBadge(f.stage) }
        Spacer(Modifier.height(10.dp))
        Text(f.blurb, style = Melyviz.label.copy(color = Melyviz.muted))
        Spacer(Modifier.height(18.dp))
        Text("Munkacsomag: ${f.wp}  ·  docs/mobile/WP/${f.wp}.md", style = Melyviz.readout)
        if (f.needs.isNotEmpty()) Text("Kell hozzá: " + f.needs.joinToString(" · ") { it.label }, style = Melyviz.readout)
    }
}
