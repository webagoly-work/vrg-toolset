package hu.vrg.mobile

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.FeatureInfo
import hu.vrg.mobile.core.Group
import hu.vrg.mobile.core.HomeLayout
import hu.vrg.mobile.core.MiniStatus
import hu.vrg.mobile.kit.ShellSettings
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.Mini
import hu.vrg.mobile.kit.ui.MiniSize
import hu.vrg.mobile.pair.PairFeature

// The home's layout (WP M32, D-35), shared by both homes: the Asztal's home window draws its groups as icons, the
// Kompakt home as tiles; everything else (the Sketcher hero, the quick row, the foldable groups, the landscape split)
// is the same code, so the two homes never drift apart. What sits where is HomeLayout in kit-core, where it is tested.

/** A feature's MINI ring state (WP M16), idle when it has none. */
@Composable
internal fun ringOf(f: FeatureInfo): MiniStatus =
    Registry.feature(f.id)?.activity?.collectAsStateWithLifecycle()?.value ?: MiniStatus.IDLE

/** Opens a feature from the home; the QR slot of the quick row starts the scanner at once (the 2026-11-14 scan button). */
internal fun openFromHome(f: FeatureInfo, open: (String) -> Unit) {
    if (f.id == Catalogue.PAIR.id) PairFeature.scan()
    open(f.id)
}

/**
 * The home's body. Upright: header, hero, quick row and the groups in one scrolling column. Lying down: hero and quick
 * row in a left pane ([HomeLayout.LANDSCAPE_LEFT] of the width), the groups scrolling on their own on the right, when the
 * space is at least [HomeLayout.SPLIT_MIN_WIDTH_DP] wide (a phone lying down is ~800 dp).
 * [cols] is the grid's column count for the orientation; [cell] draws one feature in the groups (icon or tile).
 */
@Composable
internal fun HomeBody(
    modifier: Modifier,
    open: (String) -> Unit,
    cols: (landscape: Boolean) -> Int,
    gap: Int = 0,
    header: (@Composable () -> Unit)? = null,
    footer: (@Composable () -> Unit)? = null,
    cell: @Composable (FeatureInfo, Modifier) -> Unit,
) {
    BoxWithConstraints(modifier) {
        // a small wide window (a sheet cell holding the home) stays one column: the split needs room for both panes
        val landscape = maxWidth > maxHeight && maxWidth >= HomeLayout.SPLIT_MIN_WIDTH_DP.dp
        if (!landscape) {
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(vertical = 8.dp)) {
                header?.invoke()
                SketchHero(open)
                QuickRow(open, Modifier.padding(top = 10.dp))
                HomeGroups(cols(false), gap, open, cell)
                footer?.invoke()
            }
        } else {
            Row(Modifier.fillMaxSize()) {
                Column(Modifier.weight(HomeLayout.LANDSCAPE_LEFT).fillMaxSize().verticalScroll(rememberScrollState()).padding(vertical = 8.dp)) {
                    header?.invoke()
                    SketchHero(open)
                    QuickRow(open, Modifier.padding(top = 10.dp))
                    footer?.invoke()
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f - HomeLayout.LANDSCAPE_LEFT).fillMaxSize().verticalScroll(rememberScrollState()).padding(bottom = 8.dp)) {
                    HomeGroups(cols(true), gap, open, cell)
                }
            }
        }
    }
}

/** VRG Sketcher, the field survey instrument: the first and largest thing on the home, one tap. Its plugins are chips on it. */
@Composable
internal fun SketchHero(open: (String) -> Unit) {
    val f = HomeLayout.HERO
    val built = Registry.isBuilt(f)
    val shape = RoundedCornerShape(Melyviz.radius)
    Column(
        Modifier.fillMaxWidth().heightIn(min = 104.dp)
            .background(Melyviz.raised, shape)
            .border(BorderStroke(1.5.dp, if (built) Melyviz.glow else Melyviz.lineSoft), shape)
            .clickable(onClickLabel = "megnyitás") { open(f.id) }
            .semantics { contentDescription = f.title + ", helyszíni felmérés" }
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Mini(f.glyph, f.title, ringOf(f), size = MiniSize.MD, tint = if (built) Melyviz.glow else Melyviz.faint, quietIdle = true)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(f.title.uppercase(), style = Melyviz.title.copy(fontSize = 17.sp, color = Melyviz.ink, letterSpacing = 1.2.sp), maxLines = 1)
                Text("Helyszíni szemle · vázlat, jegyzet, kamera, helyszín", style = Melyviz.small.copy(fontSize = 11.sp), maxLines = 2,
                    overflow = TextOverflow.Ellipsis)
            }
            StageBadge(f.stage)
            Text("›", style = Melyviz.title.copy(color = Melyviz.glow), modifier = Modifier.padding(start = 8.dp))
        }
        if (HomeLayout.HERO_PLUGINS.isNotEmpty()) Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            HomeLayout.HERO_PLUGINS.forEach { p -> PluginChip(p) { open(p.id) } }
        }
    }
}

@Composable
private fun PluginChip(f: FeatureInfo, onClick: () -> Unit) {
    val shape = RoundedCornerShape(50)
    Row(
        Modifier.heightIn(min = 40.dp).background(Melyviz.surface, shape).border(1.dp, Melyviz.glowDim, shape)
            .clickable(onClick = onClick).semantics { role = Role.Button; contentDescription = f.title }
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(f.glyph, style = Melyviz.glyph.copy(fontSize = 15.sp, color = Melyviz.glow))
        Spacer(Modifier.width(6.dp))
        Text(f.title, style = Melyviz.label.copy(fontSize = 12.sp, color = Melyviz.ink), maxLines = 1)
    }
}

/** The quick row: four pinned features, the same in every orientation. */
@Composable
internal fun QuickRow(open: (String) -> Unit, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        HomeLayout.QUICK.forEach { f -> QuickButton(f, Modifier.weight(1f)) { openFromHome(f, open) } }
    }
}

private fun quickLabel(f: FeatureInfo): String = if (f.id == Catalogue.PAIR.id) "QR beolvasás" else f.title

@Composable
private fun QuickButton(f: FeatureInfo, modifier: Modifier, onClick: () -> Unit) {
    val built = Registry.isBuilt(f)
    val shape = RoundedCornerShape(Melyviz.radiusSmall)
    Column(
        modifier.heightIn(min = 72.dp).background(Melyviz.surface, shape)
            .border(BorderStroke(1.dp, if (built) Melyviz.glowDim else Melyviz.lineSoft), shape)
            .clickable(onClick = onClick).semantics { role = Role.Button; contentDescription = quickLabel(f) }
            .padding(vertical = 8.dp, horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Mini(f.glyph, f.title, ringOf(f), size = MiniSize.SM, tint = if (built) Melyviz.glow else Melyviz.faint, quietIdle = true)
        Text(quickLabel(f), style = Melyviz.small.copy(fontSize = 10.sp, color = Melyviz.ink), maxLines = 1,
            overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 4.dp))
    }
}

/** The catalogue's groups without the pinned entries, each foldable; the folded set is stored (ShellPrefs.homeFolded). */
@Composable
internal fun HomeGroups(cols: Int, gap: Int, open: (String) -> Unit, cell: @Composable (FeatureInfo, Modifier) -> Unit) {
    val prefs by ShellSettings.flow.collectAsStateWithLifecycle()
    HomeLayout.sections().forEach { (group, items) ->
        val folded = group in prefs.homeFolded
        GroupHeader(group, items.size, folded) { ShellSettings.update { it.toggleFold(group) } }
        if (!folded) items.chunked(cols).forEach { row ->
            Row(Modifier.fillMaxWidth().padding(bottom = gap.dp), horizontalArrangement = Arrangement.spacedBy(gap.dp)) {
                row.forEach { f -> cell(f, Modifier.weight(1f)) }
                repeat(cols - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun GroupHeader(g: Group, count: Int, folded: Boolean, onToggle: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(top = 10.dp).heightIn(min = 40.dp).clickable(onClick = onToggle)
            .semantics {
                role = Role.Button
                contentDescription = g.label
                stateDescription = if (folded) "összecsukva, $count elem" else "kinyitva"
            },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(20.dp), contentAlignment = Alignment.Center) {
            Text(if (folded) "▸" else "▾", style = Melyviz.small.copy(color = Melyviz.glowDim, fontSize = 12.sp))
        }
        Text(
            g.label.uppercase() + if (folded) "  ($count)" else "",
            style = Melyviz.small.copy(letterSpacing = 1.6.sp, color = if (folded) Melyviz.muted else Melyviz.glowDim),
        )
    }
}
