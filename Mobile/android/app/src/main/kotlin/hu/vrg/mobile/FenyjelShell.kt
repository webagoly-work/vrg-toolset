package hu.vrg.mobile

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.ExperimentalFoundationApi
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.FeatureIcons
import hu.vrg.mobile.core.FeatureInfo
import hu.vrg.mobile.core.Gauge
import hu.vrg.mobile.core.HomeLayout
import hu.vrg.mobile.core.LaunchKind
import hu.vrg.mobile.core.MiniState
import hu.vrg.mobile.core.PixelGlyphs
import hu.vrg.mobile.core.Sys
import hu.vrg.mobile.core.SysMsgs
import hu.vrg.mobile.core.SysStats
import hu.vrg.mobile.inbox.InboxFeature
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.relay.LinkState
import hu.vrg.mobile.kit.relay.Relay
import hu.vrg.mobile.kit.relay.Trust
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.DotMeter
import hu.vrg.mobile.kit.ui.FjButton
import hu.vrg.mobile.kit.ui.FjSwitch
import hu.vrg.mobile.kit.ui.FjType
import hu.vrg.mobile.kit.ui.InfoButton
import hu.vrg.mobile.kit.ui.Led
import hu.vrg.mobile.kit.ui.LedDigits
import hu.vrg.mobile.kit.ui.LedState
import hu.vrg.mobile.kit.ui.PixelColours
import hu.vrg.mobile.kit.ui.PixelIcon
import hu.vrg.mobile.kit.ui.Socket
import hu.vrg.mobile.kit.ui.brackets
import hu.vrg.mobile.kit.ui.fjPlane
import hu.vrg.mobile.launch.LaunchFeature
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale

// The Fényjel shell (shared/fenyjel/DESIGN.md §7.1, §7.2; rollout R2). When the Fényjel palette is chosen, the home
// page of the app is this instead of the Asztal frame: a status rail, two tabs (Kezdőlap and Vezérlőpult) and a dock.
// What a tap does stays the shell's (DeskActions: open, Kommand, Katalógus, the QR scanner); this file only draws.
// Lapok keep the Asztal: a sheet that is up shows the Asztal as before (ShellActivity.HomePages).

private enum class FjTab { HOME, CONTROL }

private val HU = Locale("hu")
private val CLOCK = DateTimeFormatter.ofPattern("HH:mm")
private val DAY = DateTimeFormatter.ofPattern("EEEE", HU)
private val DATE = DateTimeFormatter.ofPattern("MMM d.", HU)

/** The page of the glyph grid the home was on, kept while the app runs. */
private var lastFjPage = 0

@Composable
internal fun FenyjelShell(windows: List<String>, act: DeskActions, note: (String) -> Unit) {
    var tab by rememberSaveable { mutableStateOf(FjTab.HOME) }
    var kommand by remember { mutableStateOf(false) }
    BackHandler(tab != FjTab.HOME || kommand) { if (kommand) kommand = false else tab = FjTab.HOME }
    Box(Modifier.fillMaxSize().systemBarsPadding()) {
        Column(Modifier.fillMaxSize()) {
            StatusRail()
            Box(Modifier.weight(1f).fillMaxWidth()) {
                when (tab) {
                    FjTab.HOME -> FjHome(windows, act)
                    FjTab.CONTROL -> FjController(act, note)
                }
            }
            Dock(tab, onTab = { tab = it }, onSearch = { kommand = true },
                onInbox = { act.open(Catalogue.INBOX.id) }, onSettings = { act.open(Catalogue.SETTINGS.id) })
        }
        if (kommand) KommandPanel(windows, onClose = { kommand = false }) { id -> kommand = false; act.runKommand(id) }
    }
}

// ---- status rail: the LED clock, the day, the PC and inbox LEDs (no words on the right) ------------------------

/** The PC link as a LED: trusted and open = ok, on the way = warn, refused = crit, nothing = off. */
private fun pcLed(link: LinkState, trust: Trust): LedState = when {
    trust == Trust.REFUSED -> LedState.CRIT
    link == LinkState.OPEN && trust == Trust.TRUSTED -> LedState.OK
    link == LinkState.CONNECTING || trust == Trust.CHECKING || link == LinkState.OPEN -> LedState.WARN
    else -> LedState.OFF
}

private fun pcSays(s: LedState): String = when (s) {
    LedState.OK -> "kapcsolódva"
    LedState.WARN -> "kapcsolódik"
    LedState.CRIT -> "elutasítva"
    else -> "nincs kapcsolat"
}

@Composable
private fun StatusRail() {
    val now by produceState(LocalTime.now()) { while (true) { value = LocalTime.now(); delay(15_000) } }
    val today = remember(now.hour) { LocalDate.now() }
    val link by Relay.state.collectAsStateWithLifecycle()
    val trust by Relay.trust.collectAsStateWithLifecycle()
    val inbox by InboxFeature.state.collectAsStateWithLifecycle()
    val pc = pcLed(link, trust)
    val unread = inbox.unread
    Row(Modifier.fillMaxWidth().padding(start = 18.dp, end = 16.dp, top = 12.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        LedDigits(now.format(CLOCK), 28.dp)
        Spacer(Modifier.width(12.dp))
        Column {
            Text(today.format(DAY), style = FjType.sub.copy(fontSize = 12.sp), maxLines = 1)
            Text(today.format(DATE), style = FjType.sub.copy(fontSize = 12.sp), maxLines = 1)
        }
        Spacer(Modifier.weight(1f))
        Row(Modifier.semantics(mergeDescendants = true) { contentDescription = "PC: ${pcSays(pc)}; értesítés: $unread olvasatlan" },
            horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Led(pc)
            Led(if (unread > 0) LedState.HUE else LedState.OFF, hue = PixelColours.family("alert"))
        }
    }
}

// ---- Kezdőlap: one focus card, then the glyph grid ------------------------------------------------------------

@Composable
private fun FjHome(windows: List<String>, act: DeskActions) {
    val home = remember(act) { HomeActions(open = act.open, openApp = act.openApp, describe = act.describe) }
    // the focus: the feature opened last (the Asztal's windows are newest first), else Légegér, the phone's own job
    val focus = windows.firstNotNullOfOrNull { Catalogue.byId(it) } ?: Catalogue.AIRDECK
    Column(Modifier.fillMaxSize().padding(horizontal = 14.dp)) {
        Spacer(Modifier.height(6.dp))
        FocusCard(focus, act)
        Spacer(Modifier.height(10.dp))
        GlyphPages(home, Modifier.weight(1f))
    }
}

private fun stateWord(f: FeatureInfo, s: MiniState): String = when (s) {
    MiniState.RUNNING -> "fut"
    MiniState.DONE -> "kész"
    MiniState.ERROR -> "hiba"
    MiniState.WAITING -> "vár"
    MiniState.PAUSED -> "szünetel"
    else -> f.stage.label.lowercase()
}

@Composable
private fun FocusCard(f: FeatureInfo, act: DeskActions) {
    val glyph = FeatureIcons.of(f)
    val hue = PixelColours.family(glyph?.family)
    val status = ringOf(f)
    Column(Modifier.fillMaxWidth().fjPlane(hue).brackets(hue.copy(alpha = 0.85f)).padding(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (glyph != null) Socket(glyph, 64.dp) else Text(f.glyph, style = Melyviz.glyph.copy(fontSize = 34.sp, color = hue))
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(f.title, style = FjType.title, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(listOfNotNull(FeatureIcons.familyName(f.id), stateWord(f, status.state)).joinToString(" · "),
                    style = FjType.sub, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            InfoButton("${f.title}: leírás") { act.describe(f.id) }
        }
        Spacer(Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            FjButton("Folytatás", hue, solid = true) { act.open(f.id) }
            Spacer(Modifier.width(14.dp))
            val p = status.progress
            if (p != null) {
                DotMeter(p, Modifier.weight(1f), color = hue)
                Spacer(Modifier.width(10.dp))
                LedDigits(Sys.percent(p), 18.dp)
            } else Spacer(Modifier.weight(1f))
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun GlyphPages(home: HomeActions, modifier: Modifier) {
    val pages = HomeLayout.PAGES
    val pager = rememberPagerState(initialPage = lastFjPage.coerceIn(0, pages.lastIndex)) { pages.size }
    val scope = rememberCoroutineScope()
    LaunchedEffect(pager.currentPage) { lastFjPage = pager.currentPage }
    Column(modifier) {
        HorizontalPager(pager, Modifier.weight(1f).fillMaxWidth(), key = { pages[it].n }) { i ->
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                pages[i].items.chunked(4).forEach { row ->
                    Row(Modifier.fillMaxWidth()) {
                        row.forEach { f -> FeatureRco(f, home, Modifier.weight(1f)) { inner -> GlyphTile(f, inner) } }
                        repeat(4 - row.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
        }
        // the pages: a dot each, the current one lit and named (one word); a tap jumps there
        Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            pages.forEachIndexed { i, p ->
                val on = i == pager.currentPage
                Box(Modifier.heightIn(min = 32.dp).clickable(role = Role.Tab) { scope.launch { pager.animateScrollToPage(i) } }
                    .semantics { selected = on; contentDescription = "${p.n}. oldal: ${p.title}" }.padding(horizontal = 4.dp),
                    contentAlignment = Alignment.Center) {
                    if (on) Text(p.short, style = FjType.label.copy(fontSize = 15.sp, color = Melyviz.glow), modifier = Modifier.clearAndSetSemantics { })
                    else Box(Modifier.size(6.dp, 3.dp).background(Melyviz.faint))
                }
            }
        }
    }
}

@Composable
private fun GlyphTile(f: FeatureInfo, modifier: Modifier) {
    val built = Registry.isBuilt(f)
    val glyph = FeatureIcons.of(f)
    val status = ringOf(f)
    Column(modifier.padding(vertical = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box {
            if (glyph != null) Socket(glyph, 58.dp, dim = !built)
            else Box(Modifier.size(58.dp), contentAlignment = Alignment.Center) { Text(f.glyph, style = Melyviz.glyph.copy(color = Melyviz.muted)) }
            // running: a lit corner, in the run colour (DESIGN.md §8 .fj-tile[data-state=run])
            if (status.busy) Box(Modifier.align(Alignment.TopEnd).padding(5.dp).size(6.dp).background(PixelColours.family("run")))
        }
        Spacer(Modifier.height(6.dp))
        Text(FeatureIcons.label(f), style = FjType.label.copy(fontSize = 16.sp, color = if (built) Melyviz.muted else Melyviz.faint),
            maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

// ---- Vezérlőpult: the PC's console on the phone -----------------------------------------------------------

@Composable
private fun FjController(act: DeskActions, note: (String) -> Unit) {
    val link by Relay.state.collectAsStateWithLifecycle()
    val trust by Relay.trust.collectAsStateWithLifecycle()
    val pc by Relay.pc.collectAsStateWithLifecycle()
    val launch by LaunchFeature.list.collectAsStateWithLifecycle()
    val starting by LaunchFeature.starting.collectAsStateWithLifecycle()
    val log by VrgLog.lines.collectAsStateWithLifecycle()
    var stats by remember { mutableStateOf<SysStats?>(null) }
    LaunchedEffect(Unit) { Relay.incoming.collect { raw -> SysMsgs.parse(raw)?.let { stats = it } } }
    // while the tab is on screen: the PC's vital signs and what runs, every few seconds
    LaunchedEffect(trust) {
        if (trust == Trust.TRUSTED) {
            LaunchFeature.refresh()
            while (true) { Relay.send(SysMsgs.stats()); LaunchFeature.askStatus(); delay(Sys.EVERY_MS) }
        }
    }
    val led = pcLed(link, trust)
    val linkHue = PixelColours.family("link")
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 14.dp, vertical = 6.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)) {
        // head: the PC, its link, its uptime
        Row(verticalAlignment = Alignment.CenterVertically) {
            PixelGlyphs.byName("devices")?.let { Socket(it, 44.dp) }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(pc?.name ?: stats?.host?.ifEmpty { null } ?: "PC", style = FjType.title, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Led(led); Spacer(Modifier.width(8.dp))
                    Text(pcSays(led) + (stats?.takeIf { it.ok }?.let { " · fut ${Sys.uptime(it.uptimeS)}" } ?: ""), style = FjType.mono, maxLines = 1)
                }
            }
        }
        if (trust != Trust.TRUSTED) {
            Column(Modifier.fillMaxWidth().fjPlane(linkHue).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Nincs párosított PC", style = FjType.title.copy(fontSize = 22.sp))
                Text("A PC képernyőjén nyisd meg a párosító QR-t, és olvasd be.", style = FjType.sub)
                FjButton("Párosítás", linkHue, solid = true) { act.scan() }
            }
        } else Gauges(stats)
        // what the phone does to the PC: four big sockets, one word each
        Row(Modifier.fillMaxWidth()) {
            listOf(Catalogue.AIRDECK, Catalogue.SCREEN, Catalogue.DROP, Catalogue.PCWIN).forEach { f ->
                Column(Modifier.weight(1f).clickable(role = Role.Button) { act.open(f.id) }.semantics(mergeDescendants = true) { contentDescription = f.title }
                    .padding(vertical = 6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    FeatureIcons.of(f)?.let { Socket(it, 56.dp) }
                    Spacer(Modifier.height(6.dp))
                    Text(FeatureIcons.label(f), style = FjType.label.copy(fontSize = 16.sp), maxLines = 1)
                }
            }
        }
        // START's servers: LED, name, port, switch (a server another tool started shows, but only its starter stops it)
        val l = launch
        if (trust == Trust.TRUSTED && l != null && l.ok) {
            val servers = l.entries.filter { it.kind == LaunchKind.SERVER }
            val runHue = PixelColours.family("run")
            if (servers.isNotEmpty()) Column(Modifier.fillMaxWidth().fjPlane().padding(horizontal = 14.dp, vertical = 4.dp)) {
                servers.forEach { e ->
                    val running = l.isRunning(e)
                    val mine = l.isMine(e)
                    Row(Modifier.fillMaxWidth().heightIn(min = 48.dp), verticalAlignment = Alignment.CenterVertically) {
                        Led(if (running) LedState.HUE else LedState.OFF, hue = runHue)
                        Spacer(Modifier.width(10.dp))
                        Text(e.name, style = FjType.label.copy(fontSize = 18.sp, color = Melyviz.ink), maxLines = 1, overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f))
                        e.port?.let { Text(":$it", style = FjType.mono) }
                        FjSwitch(checked = running || e.id in starting, label = "${e.name}: ${if (running) "fut" else "áll"}", hue = runHue,
                            enabled = e.id !in starting && (!running || mine)) { on ->
                            val said = if (on) LaunchFeature.start(e) else LaunchFeature.stop(e)
                            said?.let(note)
                        }
                    }
                }
            }
        }
        // the console: the last lines of the app's log, and the prompt
        Column(Modifier.fillMaxWidth().background(Melyviz.abyss, RoundedCornerShape(3.dp)).padding(12.dp)) {
            log.takeLast(4).forEach { line ->
                Text(line.format(), style = FjType.mono.copy(fontSize = 11.sp, color = if (line.warn) Melyviz.sand else Melyviz.muted),
                    maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("vrg> ", style = FjType.mono.copy(fontSize = 11.sp, color = PixelColours.family("run")))
                Box(Modifier.size(7.dp, 12.dp).background(PixelColours.family("run")))
            }
        }
        Spacer(Modifier.height(4.dp))
    }
}

/** CPU, memory and disk: glyph, dot meter, LED percent; over its limit a gauge turns warn (DESIGN.md §4.2). */
@Composable
private fun Gauges(s: SysStats?) {
    Column(Modifier.fillMaxWidth().fjPlane().padding(14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (s == null || !s.ok) {
            Text(if (s == null) "Mérés…" else (s.reason ?: "A PC nem válaszolt."), style = FjType.sub)
            return@Column
        }
        GaugeRow("pulse", "Processzor", s.cpu, Sys.CPU_WARN)
        GaugeRow("stack", "Memória", s.memShare, Sys.MEM_WARN)
        s.diskShare?.let { GaugeRow("archive", "Lemez ${s.disk?.root ?: ""}".trim(), it, Sys.DISK_WARN) }
        Text("${Sys.gb(s.memUsed)} / ${Sys.gb(s.memTotal)} · ${s.cores} mag", style = FjType.mono, maxLines = 1)
    }
}

@Composable
private fun GaugeRow(glyphName: String, label: String, share: Float, warnAt: Float) {
    val g = PixelGlyphs.byName(glyphName)
    val warn = Sys.gauge(share, warnAt) == Gauge.WARN
    val c: Color = if (warn) Melyviz.sand else PixelColours.family(g?.family)
    Row(Modifier.fillMaxWidth().semantics(mergeDescendants = true) { contentDescription = "$label: ${Sys.percent(share)}" },
        verticalAlignment = Alignment.CenterVertically) {
        if (g != null) PixelIcon(g, 18.dp, color = c)
        Spacer(Modifier.width(10.dp))
        DotMeter(share, Modifier.weight(1f), color = c)
        Spacer(Modifier.width(12.dp))
        Box(Modifier.width(52.dp), contentAlignment = Alignment.CenterEnd) { LedDigits(Sys.percent(share), 18.dp, color = c) }
    }
}

// ---- the dock: icons only, the open tab lit, search in the middle ---------------------------------------------

@Composable
private fun Dock(tab: FjTab, onTab: (FjTab) -> Unit, onSearch: () -> Unit, onInbox: () -> Unit, onSettings: () -> Unit) {
    val inbox by InboxFeature.state.collectAsStateWithLifecycle()
    val p = Melyviz.palette
    Row(Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp)
        .background(p.surface.copy(alpha = 0.92f), RoundedCornerShape(3.dp)).padding(horizontal = 6.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceAround, verticalAlignment = Alignment.CenterVertically) {
        DockSlot("home", "Kezdőlap", on = tab == FjTab.HOME) { onTab(FjTab.HOME) }
        DockSlot("control", "Vezérlőpult", on = tab == FjTab.CONTROL) { onTab(FjTab.CONTROL) }
        DockSlot("search", "Keresés", on = false, main = true, onClick = onSearch)
        DockSlot("inbox", "Értesítések", on = false, badge = inbox.unread, onClick = onInbox)
        DockSlot("settings", "Beállítások", on = false, onClick = onSettings)
    }
}

@Composable
private fun DockSlot(glyphName: String, label: String, on: Boolean, main: Boolean = false, badge: Int = 0, onClick: () -> Unit) {
    val g = PixelGlyphs.byName(glyphName) ?: return
    val p = Melyviz.palette
    Box(
        Modifier.size(if (main) 56.dp else 52.dp)
            .then(if (main) Modifier.background(p.raised, RoundedCornerShape(3.dp)) else Modifier)
            .clickable(role = Role.Tab, onClick = onClick)
            .semantics { contentDescription = if (badge > 0) "$label, $badge olvasatlan" else label; selected = on },
        contentAlignment = Alignment.Center,
    ) {
        PixelIcon(g, 26.dp, modifier = Modifier.alpha(if (on || main) 1f else 0.6f))
        if (on) Box(Modifier.align(Alignment.BottomCenter).padding(bottom = 4.dp).size(12.dp, 3.dp).background(p.glow))
        if (badge > 0) Box(Modifier.align(Alignment.TopEnd).padding(top = 6.dp, end = 4.dp)
            .background(PixelColours.family("alert"), RoundedCornerShape(2.dp)).padding(horizontal = 4.dp)) {
            Text(if (badge > 99) "99+" else "$badge", style = FjType.mono.copy(fontSize = 10.sp, color = p.abyss))
        }
    }
}
