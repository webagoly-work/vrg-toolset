package hu.vrg.mobile

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.CatalogGuide
import hu.vrg.mobile.core.GuidePage
import hu.vrg.mobile.core.HomeLayout
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgBack
import hu.vrg.mobile.kit.ui.VrgChip
import kotlinx.coroutines.launch
import hu.vrg.mobile.kit.theme.vrgBorder
import hu.vrg.mobile.core.FeatureIcons
import hu.vrg.mobile.kit.ui.PixelIcon

// Katalógus (WP M38): every program, feature and function of VRG Mobile and the VRG Desktop on a page of its own,
// swiped sideways, for a new user finding their way around. The pages are CatalogGuide's (kit-core, plain data), in the
// home's page order, then the Desktop-only programs. A phone feature's page offers "Megnyitás"; Tartalom lists them all.

@Composable
fun CatalogScreen(startAt: String, onBack: () -> Unit, onOpen: (String) -> Unit) {
    val pages = CatalogGuide.PAGES
    if (pages.isEmpty()) {
        Column(Modifier.fillMaxSize().padding(20.dp)) {
            VrgBack(onBack)
            Text("A Katalógus még üres.", style = Melyviz.label)
        }
        return
    }
    val start = pages.indexOfFirst { it.id == startAt }.coerceAtLeast(0)
    val pager = rememberPagerState(initialPage = start) { pages.size }
    val scope = rememberCoroutineScope()
    var contents by remember { mutableStateOf(false) }
    BackHandler(contents) { contents = false }

    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            VrgBack(onBack)
            Text("KATALÓGUS", style = Melyviz.title.copy(fontSize = 16.sp), modifier = Modifier.weight(1f))
            Text("${pager.currentPage + 1} / ${pages.size}", style = Melyviz.readout)
            Spacer(Modifier.width(8.dp))
            VrgChip(if (contents) "Lapok" else "Tartalom", selected = contents) { contents = !contents }
        }
        if (contents) {
            LazyColumn(Modifier.fillMaxSize()) {
                itemsIndexed(pages, key = { _, p -> p.id }) { i, p ->
                    Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable { contents = false; scope.launch { pager.scrollToPage(i) } }
                        .padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        val px = FeatureIcons.of(p.id)
                        Box(Modifier.width(34.dp)) { if (px != null) PixelIcon(px, 22.dp) else Text(p.glyph, style = Melyviz.glyph.copy(fontSize = 18.sp, color = Melyviz.glow)) }
                        Column(Modifier.weight(1f)) {
                            Text(p.title, style = Melyviz.label, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(sectionOf(p), style = Melyviz.small.copy(fontSize = 10.sp), maxLines = 1)
                        }
                    }
                }
            }
        } else {
            HorizontalPager(pager, Modifier.weight(1f).fillMaxWidth(), key = { pages[it].id }) { i -> GuidePageView(pages[i], onOpen) }
        }
    }
}

/** "Telefon · 1. oldal: Terep", or "Asztal (PC)" for a Desktop-only program. */
private fun sectionOf(p: GuidePage): String {
    val page = HomeLayout.pageOf(p.id)?.let { n -> HomeLayout.PAGES.first { it.n == n } }
    return p.side.label + (page?.let { " · ${it.n}. oldal: ${it.short}" } ?: "")
}

@Composable
private fun GuidePageView(p: GuidePage, onOpen: (String) -> Unit) {
    val feature = Catalogue.byId(p.id)
    val shape = RoundedCornerShape(Melyviz.radius)
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(vertical = 8.dp)) {
        Column(Modifier.fillMaxWidth().background(Melyviz.raised, shape).vrgBorder(1.dp, Melyviz.glowDim, shape).padding(16.dp)) {
            val px = FeatureIcons.of(p.id)
            if (px != null) PixelIcon(px, 48.dp) else Text(p.glyph, style = Melyviz.glyph.copy(fontSize = 40.sp, color = Melyviz.glow))
            Text(p.title, style = Melyviz.title.copy(fontSize = 20.sp), modifier = Modifier.padding(top = 6.dp))
            Row(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(sectionOf(p), style = Melyviz.readout)
                feature?.let { StageBadge(it.stage) }
            }
        }
        Spacer(Modifier.height(14.dp))
        Text(p.what, style = Melyviz.label.copy(fontSize = 15.sp, color = Melyviz.ink))
        if (p.how.isNotEmpty()) {
            Text("HOGYAN", style = Melyviz.small.copy(letterSpacing = 1.4.sp, color = Melyviz.glowDim), modifier = Modifier.padding(top = 16.dp, bottom = 4.dp))
            p.how.forEach { line ->
                Row(Modifier.padding(vertical = 3.dp)) {
                    Text("•", style = Melyviz.label.copy(color = Melyviz.glow), modifier = Modifier.width(16.dp))
                    Text(line, style = Melyviz.label)
                }
            }
        }
        p.needs?.let { Fact("KELL HOZZÁ", it) }
        p.pair?.let { Fact("A MÁSIK OLDALON", it) }
        // a phone feature that can be opened: the page takes you there (the Katalógus itself and the home are not opened)
        if (feature != null && feature.id != Catalogue.CATALOG.id && feature.id != Catalogue.DESK.id) {
            Spacer(Modifier.height(18.dp))
            Box(Modifier.semantics { contentDescription = "${feature.title} megnyitása" }) {
                VrgChip(if (Registry.isBuilt(feature)) "Megnyitás ›" else "Terv megnézése ›", selected = true) { onOpen(feature.id) }
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun Fact(title: String, text: String) {
    Text(title, style = Melyviz.small.copy(letterSpacing = 1.4.sp, color = Melyviz.glowDim), modifier = Modifier.padding(top = 16.dp, bottom = 4.dp))
    Text(text, style = Melyviz.label)
}
