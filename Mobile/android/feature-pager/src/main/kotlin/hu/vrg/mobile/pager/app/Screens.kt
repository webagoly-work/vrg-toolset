@file:OptIn(ExperimentalLayoutApi::class)

package hu.vrg.mobile.pager.app

import android.Manifest
import android.content.Intent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.ui.VrgSectionTitle
import hu.vrg.mobile.kit.ui.VrgToggle
import hu.vrg.mobile.pager.BROADCAST
import hu.vrg.mobile.pager.Clutter
import hu.vrg.mobile.pager.Crew
import hu.vrg.mobile.pager.GuardState
import hu.vrg.mobile.pager.Key
import hu.vrg.mobile.pager.MAX_UNIT
import hu.vrg.mobile.pager.ManDownState
import hu.vrg.mobile.pager.Messages
import hu.vrg.mobile.pager.PType
import hu.vrg.mobile.pager.PeerView
import hu.vrg.mobile.pager.Proximity
import hu.vrg.mobile.pager.SendStatus
import hu.vrg.mobile.pager.Zone
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// The screens of Csipogó. The Panel is drawn after the B2 belt pager (thumb keys CALL and SEEN on the left, three
// finger keys on the right, LINK on top, the OLED line and the RGB lamp), at glove size. The other tabs are what
// the phone adds.

private val engine get() = Pager.engine
private fun now() = System.currentTimeMillis()
private val hms = SimpleDateFormat("HH:mm:ss", Locale.ROOT)
private fun time(t: Long) = hms.format(Date(t))

// ---- parts ----------------------------------------------------------------------------------------------------

/**
 * A pager key. [onHold] gets true on press and false on release (CALL, PTT); [onTap] / [onLong] are the short and
 * long press (K1–K3, LINK). The gesture detector is keyed on nothing, so the screen's redraws (4 a second) never
 * cancel a press that is being held; the callbacks are read through rememberUpdatedState.
 */
@Composable
fun PadKey(
    title: String, modifier: Modifier = Modifier, sub: String? = null, tint: Color = Melyviz.glow, height: Dp = 64.dp,
    onTap: (() -> Unit)? = null, onLong: (() -> Unit)? = null, onHold: ((Boolean) -> Unit)? = null,
) {
    var down by remember { mutableStateOf(false) }
    val tap by rememberUpdatedState(onTap)
    val long by rememberUpdatedState(onLong)
    val hold by rememberUpdatedState(onHold)
    val shape = RoundedCornerShape(Melyviz.radiusSmall)
    Box(
        modifier.heightIn(min = height).clip(shape)
            .background(if (down) tint else Melyviz.raised)
            .border(2.dp, tint, shape)
            .pointerInput(Unit) {
                detectTapGestures(
                    onPress = {
                        down = true
                        hold?.invoke(true)
                        try { tryAwaitRelease() } finally { down = false; hold?.invoke(false) }
                    },
                    onTap = { tap?.invoke() },
                    onLongPress = { (long ?: tap)?.invoke() },
                )
            }
            .semantics { role = Role.Button; contentDescription = listOfNotNull(title, sub).joinToString(", ") }
            .padding(horizontal = 8.dp, vertical = 6.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(title, style = Melyviz.label.copy(fontSize = 15.sp, fontWeight = FontWeight.Bold, color = if (down) Melyviz.onGlow else Melyviz.ink), textAlign = TextAlign.Center)
            sub?.let { Text(it, style = Melyviz.small.copy(fontSize = 10.sp, color = if (down) Melyviz.onGlow else Melyviz.muted), textAlign = TextAlign.Center) }
        }
    }
}

@Composable
private fun Dot(c: Color, size: Dp = 10.dp) { Box(Modifier.size(size).clip(CircleShape).background(c)) }

private fun bars(z: Zone) = "▮".repeat(z.bars) + "▯".repeat(4 - z.bars)

@Composable
private fun TargetRow() {
    val target by Pager.target.collectAsStateWithLifecycle()
    val peers = engine.peers(now())
    Row(Modifier.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Text("Kinek: ", style = Melyviz.small)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            VrgChip("Mindenki", selected = target == BROADCAST) { Pager.target.value = BROADCAST }
            peers.forEach { p -> VrgChip(p.name, selected = target == p.unit) { Pager.target.value = p.unit } }
        }
    }
}

// ---- Csipogó: the pager panel ------------------------------------------------------------------------------

@Composable
fun PanelTab(on: Boolean) {
    val target by Pager.target.collectAsStateWithLifecycle()
    val banner by Pager.banner.collectAsStateWithLifecycle()
    var powerHint by remember { mutableStateOf(false) }
    val t = now()
    if (!on) Text("A Csipogó ki van kapcsolva: a gombok csak bekapcsolva szólnak.", style = Melyviz.small.copy(color = Melyviz.sand))
    TargetRow()

    // the OLED line and the RGB lamp: green delivered, red no reply, blue SEEN, amber sending (the pager's colours)
    val last = engine.outgoing().firstOrNull { it.frame.ptype != PType.HOLD || it.status == SendStatus.NO_REPLY }
    val lamp = when {
        last == null || t - last.at > 15_000 -> Melyviz.faint
        last.status == SendStatus.SENDING -> Melyviz.sand
        last.status == SendStatus.NO_REPLY -> Melyviz.coral
        last.status == SendStatus.SEEN -> Melyviz.current
        else -> Melyviz.kelp
    }
    val callers = engine.callers(t)
    val unseen = engine.unseen()
    val (l1, l2) = when {
        callers.isNotEmpty() -> "HÍV: ${callers.joinToString { engine.who(it) }}" to "LÁTTAM = felvettem"
        engine.manDownLeft > 0 -> "MINDEN RENDBEN?" to "LÁTTAM, különben riaszt: ${engine.manDownLeft} mp"
        banner != null && t - banner!!.first < 3_500 -> banner!!.second to ""
        unseen.isNotEmpty() -> unseen.last().let { "${engine.who(it.frame.src)}: ${it.label}" to "LÁTTAM?  ${time(it.at)}" }
        last != null && t - last.at < 15_000 -> "→ ${engine.who(last.frame.dst)}: ${last.label}" to
            (last.status.hu + if (last.frame.dst == BROADCAST && last.acked.isNotEmpty()) " (${last.acked.size}/${maxOf(last.expect.size, last.acked.size)})" else "")
        else -> "${engine.peers(t).count { it.zone != Zone.OUT }} társ · ${engine.me.crew.code}" to "várakozás"
    }

    val shape = RoundedCornerShape(Melyviz.radius)
    Column(Modifier.fillMaxWidth().clip(shape).background(Melyviz.surface).border(1.dp, Melyviz.line, shape).padding(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f).clip(RoundedCornerShape(6.dp)).background(Color.Black).padding(horizontal = 10.dp, vertical = 8.dp)) {
                Text(l1, style = Melyviz.readout.copy(fontSize = 15.sp, color = Melyviz.glow), maxLines = 1)
                Text(l2, style = Melyviz.readout.copy(fontSize = 12.sp, color = Melyviz.glowDim), maxLines = 1)
            }
            Spacer(Modifier.width(10.dp))
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Dot(lamp, 18.dp)
                Spacer(Modifier.height(6.dp))
                PadKey("LINK", Modifier.width(70.dp), sub = "teszt / névsor", tint = Melyviz.current, height = 44.dp,
                    onTap = { engine.ping(target, now()) }, onLong = { engine.rollCall(now()) })
            }
        }
        Spacer(Modifier.height(10.dp))
        Row {
            Column(Modifier.weight(1.1f)) {
                PadKey("HÍVÁS", Modifier.fillMaxWidth(), sub = "nyomva tartva", tint = Melyviz.coral, height = 96.dp,
                    onHold = { down -> if (down) engine.holdStart(target, now()) else engine.holdStop(now()) })
                Spacer(Modifier.height(8.dp))
                PadKey("LÁTTAM", Modifier.fillMaxWidth(), sub = "SEEN", tint = Melyviz.current, height = 72.dp,
                    onTap = { Pager.banner.value = now() to engine.seen(now()); PagerService.current?.quiet() })
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Key.entries.forEach { k ->
                    PadKey(Messages.label(k.short), Modifier.fillMaxWidth(), sub = "hosszan: ${Messages.label(k.long)}", height = 54.dp,
                        onTap = { engine.sendMessage(k.short, target, now()); powerHint = Messages.byCode(k.short)?.power == true },
                        onLong = { engine.sendMessage(k.long, target, now()); powerHint = Messages.byCode(k.long)?.power == true })
                    Spacer(Modifier.height(6.dp))
                }
            }
        }
    }
    if (powerHint) Text(Messages.POWER_NOTE, style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 6.dp))

    VrgSectionTitle("Minden üzenet")
    Text("Koppintás küld; a feszültséget érintőket (⚡) hosszan kell nyomni.", style = Melyviz.small)
    FlowRow(Modifier.padding(vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Messages.ALL.forEach { m ->
            val send: () -> Unit = { engine.sendMessage(m.code, target, now()) }
            PadKey((if (m.power) "⚡ " else "") + m.hu, Modifier.width(150.dp), height = 44.dp,
                tint = if (m.urgent) Melyviz.coral else if (m.power) Melyviz.sand else Melyviz.line,
                onTap = if (m.power) null else send,
                onLong = { engine.sendMessage(m.code, target, now()); powerHint = m.power })
        }
    }
    PadKey("VÉSZJELZÉS", Modifier.fillMaxWidth(), sub = "hosszan nyomva: riasztás mindenkinek", tint = Melyviz.coral, height = 52.dp,
        onLong = { engine.sos(now()) })

    VrgSectionTitle("Beérkezett")
    val inc = engine.incoming()
    if (inc.isEmpty()) Text("Még semmi.", style = Melyviz.small)
    inc.take(12).forEach { i ->
        Row(Modifier.fillMaxWidth().padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
            Dot(if (i.seen) Melyviz.faint else if (i.frame.ptype == PType.ALARM) Melyviz.coral else Melyviz.glow, 8.dp)
            Spacer(Modifier.width(8.dp))
            Text("${time(i.at)}  ${engine.who(i.frame.src)}: ${i.label}" + (if (i.relayed) "  (átjátszva)" else ""), style = Melyviz.readout, modifier = Modifier.weight(1f))
        }
    }
    VrgSectionTitle("Elküldött")
    engine.outgoing().filter { it.frame.ptype != PType.HOLD }.take(8).forEach { o ->
        Text("${time(o.at)}  → ${engine.who(o.frame.dst)}: ${o.label} · ${o.status.hu}" +
            (if (o.seenBy.isNotEmpty()) " (${o.seenBy.joinToString { engine.who(it) }})" else ""),
            style = Melyviz.readout.copy(color = when (o.status) { SendStatus.NO_REPLY -> Melyviz.coral; SendStatus.SEEN -> Melyviz.current; else -> Melyviz.muted }))
    }
    engine.rollCallResult(t)?.let { rc ->
        VrgSectionTitle("Névsor")
        if (rc.isEmpty()) Text("Válaszra vár…", style = Melyviz.small)
        rc.forEach { (u, b) -> Text("✓ ${engine.who(u)}" + (if (b in 0..100) " · akku $b%" else ""), style = Melyviz.readout) }
    }
}

// ---- Közelség: who is how near, and the finder ----------------------------------------------------------------

@Composable
fun NearTab() {
    val ctx = LocalContext.current
    var finding by remember { mutableStateOf<Int?>(null) }
    var calibrating by remember { mutableStateOf<Int?>(null) }
    var calNote by remember { mutableStateOf<String?>(null) }
    val t = now()
    val peers = engine.peers(t)

    Text("A távolság a Bluetooth-jel erősségéből becsült: falak, zseb és test sokat torzítanak. A közeledik / távolodik nyíl megbízhatóbb, mint a méter.",
        style = Melyviz.small)
    Row(Modifier.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text("Környezet: ", style = Melyviz.small)
        Clutter.entries.forEach { c ->
            VrgChip(c.hu, selected = engine.clutter == c) { Pager.save(ctx, Pager.settings(ctx).copy(clutter = c)) }
            Spacer(Modifier.width(4.dp))
        }
    }
    if (engine.otherCrews > 0) Text("Más csapat jelei is hallatszanak (${engine.otherCrews}); azokat nem mutatja.", style = Melyviz.small.copy(color = Melyviz.faint))

    val f = finding?.let { u -> peers.firstOrNull { it.unit == u } }
    if (f != null) Finder(f) { finding = null }

    // the crew on the radar (WP M66): the same layer the Radar feature shows with the others
    if (peers.isNotEmpty()) hu.vrg.mobile.kit.ui.VrgHubRadar(setOf("pager"), Modifier.fillMaxWidth().padding(vertical = 6.dp))

    if (peers.isEmpty()) Text("Senki a közelben. A többieknek is be kell kapcsolniuk a Csipogót, ugyanazzal a csapatkóddal (${engine.me.crew.code}).",
        style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(vertical = 8.dp))
    peers.forEach { p ->
        Column(Modifier.fillMaxWidth().padding(vertical = 4.dp).clip(RoundedCornerShape(Melyviz.radiusSmall)).background(Melyviz.surface)
            .clickable { finding = p.unit }.padding(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(bars(p.zone), style = Melyviz.readout.copy(fontSize = 14.sp, color = if (p.zone == Zone.OUT) Melyviz.faint else Melyviz.glow))
                Spacer(Modifier.width(8.dp))
                Text(p.name, style = Melyviz.label.copy(fontSize = 14.sp), modifier = Modifier.weight(1f))
                Text(if (p.viaRelay) "átjátszón át" else "${Proximity.label(p.distanceM)} ${p.trend.arrow}", style = Melyviz.label)
            }
            Text(listOfNotNull(
                p.zone.hu,
                p.rssi?.let { "$it dBm" },
                p.battery?.let { "akku $it%" },
                if (p.linked) "kapcsolat ✓" else null,
                if (p.talking) "BESZÉL" else null,
                if (p.armed) "őrzés" else null,
                if (p.alarm) "RIASZT" else null,
                if (p.ageMs in 3_000 until Long.MAX_VALUE / 2) "${p.ageMs / 1000} mp-e" else null,
            ).joinToString(" · "), style = Melyviz.readout.copy(color = if (p.alarm) Melyviz.coral else Melyviz.muted))
            Row(Modifier.padding(top = 4.dp)) {
                VrgChip("Keresés") { finding = p.unit }
                Spacer(Modifier.width(6.dp))
                VrgChip(if (calibrating == p.unit) "Mérés…" else "1 m kalibrálás") { if (calibrating == null) calibrating = p.unit }
                if (engine.calibrations().containsKey(p.unit)) { Spacer(Modifier.width(6.dp)); VrgChip("Kalibráció törlése") { Pager.saveCalibration(ctx, p.unit, null) } }
            }
        }
    }
    calNote?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand)) }

    // one-metre calibration: 8 s of samples with the two phones held a metre apart
    val cal = calibrating
    LaunchedEffect(cal) {
        if (cal == null) return@LaunchedEffect
        calNote = "Tartsátok a két telefont 1 méterre egymástól, 8 másodpercig…"
        val samples = ArrayList<Int>()
        var lastAt = 0L
        repeat(40) {
            delay(200)
            val p = engine.peer(cal)
            if (p != null && p.rssi.lastAt != lastAt) { lastAt = p.rssi.lastAt; samples += p.rssi.raw }
        }
        val v = Proximity.calibrate(samples)
        if (v != null) { Pager.saveCalibration(ctx, cal, v); calNote = "Kalibrálva: 1 m = $v dBm (${samples.size} minta)." }
        else calNote = "Nem sikerült (${samples.size} minta, túl nagy szórás). Próbáld újra, mozdulatlanul."
        calibrating = null
    }
}

@Composable
private fun Finder(p: PeerView, close: () -> Unit) {
    val shape = RoundedCornerShape(Melyviz.radius)
    Column(Modifier.fillMaxWidth().padding(vertical = 6.dp).clip(shape).background(Melyviz.raised).border(2.dp, Melyviz.glow, shape).padding(14.dp),
        horizontalAlignment = Alignment.CenterHorizontally) {
        Text("KERESÉS: ${p.name}", style = Melyviz.title)
        Text(if (p.zone == Zone.OUT) "nincs jel" else Proximity.label(p.distanceM), style = Melyviz.title.copy(fontSize = 44.sp, color = Melyviz.glow))
        Text("${p.trend.arrow} ${p.trend.hu} · ${p.zone.hu}", style = Melyviz.label)
        Text("Sűrűbb pittyegés = közelebb. Fordulj lassan körbe: arra erősebb, amerre ő van (a tested árnyékol).", style = Melyviz.small, textAlign = TextAlign.Center)
        Row(Modifier.padding(top = 6.dp)) {
            VrgChip("Hívom (HÍVÁS 2 mp)") { engine.holdStart(p.unit, now()) }
            Spacer(Modifier.width(6.dp))
            VrgChip("Bezár") { engine.holdStop(now()); close() }
        }
    }
    LaunchedEffect(p.unit) {
        while (true) {
            val cur = engine.peers(now()).firstOrNull { it.unit == p.unit }
            if (cur != null && cur.zone != Zone.OUT) PagerService.current?.finderTick()
            delay(Proximity.finderInterval(cur?.distanceM))
            if (engine.holding && engine.outgoing().firstOrNull()?.let { now() - it.at > 2_000 } == true) engine.holdStop(now())
        }
    }
}

// ---- Csevegés: chat over the links ---------------------------------------------------------------------------

@Composable
fun ChatTab() {
    val target by Pager.target.collectAsStateWithLifecycle()
    var text by remember { mutableStateOf("") }
    val links = PagerService.current?.linkCount() ?: 0
    val supported = PagerService.current?.linksSupported ?: true
    TargetRow()
    if (!supported) Text("A csevegéshez Android 10 vagy újabb kell (Bluetooth LE csatorna). A hívás és a gyors üzenetek működnek.", style = Melyviz.small.copy(color = Melyviz.sand))
    else Text(if (links == 0) "Nincs nyitott kapcsolat: az üzenet elmegy, amint valaki kapcsolódik (egy órán át)." else "$links kapcsolat; az üzenet a kapcsolatokon át továbbjut (legfeljebb 3 ugrás).",
        style = Melyviz.small)
    val list = engine.chats().takeLast(60)
    Column(Modifier.padding(vertical = 8.dp)) {
        if (list.isEmpty()) Text("Még nincs üzenet.", style = Melyviz.small)
        list.forEach { c ->
            val shape = RoundedCornerShape(Melyviz.radiusSmall)
            Row(Modifier.fillMaxWidth().padding(vertical = 3.dp), horizontalArrangement = if (c.mine) Arrangement.End else Arrangement.Start) {
                Column(Modifier.clip(shape).background(if (c.mine) Melyviz.raised else Melyviz.surface).border(1.dp, if (c.mine) Melyviz.glowDim else Melyviz.line, shape).padding(8.dp)) {
                    Text((if (c.mine) "én" else engine.who(c.src)) + (if (c.dst != BROADCAST) " → ${engine.who(c.dst)}" else "") + " · ${time(c.at)}",
                        style = Melyviz.readout.copy(fontSize = 10.sp))
                    Text(c.text, style = Melyviz.label.copy(fontSize = 14.sp))
                    if (c.mine) Text(if (c.acked.isEmpty()) "elküldve" else "megkapta: ${c.acked.joinToString { engine.who(it) }}", style = Melyviz.readout.copy(fontSize = 10.sp))
                }
            }
        }
    }
    OutlinedTextField(
        value = text, onValueChange = { text = it.take(300) },
        modifier = Modifier.fillMaxWidth(),
        placeholder = { Text("Üzenet…", style = Melyviz.small) },
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Melyviz.glow, unfocusedBorderColor = Melyviz.line,
            focusedTextColor = Melyviz.ink, unfocusedTextColor = Melyviz.ink, cursorColor = Melyviz.glow,
        ),
    )
    Row(Modifier.padding(vertical = 6.dp)) {
        VrgChip("Küldés", selected = text.isNotBlank()) { if (engine.chat(text, target, now()) != null) text = "" }
    }
}

// ---- Adóvevő: push to talk -------------------------------------------------------------------------------------

@Composable
fun TalkTab() {
    val ctx = LocalContext.current
    val talker by Pager.talker.collectAsStateWithLifecycle()
    val tx by Pager.transmitting.collectAsStateWithLifecycle()
    var busy by remember { mutableStateOf(false) }
    var micOk by remember { mutableStateOf(Pager.has(ctx, Manifest.permission.RECORD_AUDIO)) }
    val askMic = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { micOk = it }
    val svc = PagerService.current
    val links = svc?.linkCount() ?: 0

    Text("Nyomd és beszélj, mint egy URH rádión. A hang a közvetlen kapcsolatban lévőkhöz jut el; egyszerre egy ember beszél.", style = Melyviz.small)
    if (svc?.linksSupported == false) Text("Az adóvevőhöz Android 10 vagy újabb kell.", style = Melyviz.small.copy(color = Melyviz.sand))
    Text(when {
        tx -> "ADÁS…"
        talker != null -> "BESZÉL: ${engine.who(talker!!)}"
        busy -> "FOGLALT: más beszél"
        links == 0 -> "Nincs kapcsolat: senki nem hallana."
        else -> "$links kapcsolat · szabad a csatorna"
    }, style = Melyviz.title.copy(fontSize = 20.sp, color = if (tx) Melyviz.coral else if (talker != null) Melyviz.glow else Melyviz.ink),
        modifier = Modifier.padding(vertical = 10.dp))
    if (!micOk) VrgChip("Mikrofon engedély", selected = true) { askMic.launch(Manifest.permission.RECORD_AUDIO) }
    else PadKey(if (tx) "ADÁS" else "NYOMD ÉS BESZÉLJ", Modifier.fillMaxWidth(), sub = "vagy a hangerő le gomb", tint = Melyviz.coral, height = 160.dp,
        onHold = { down -> if (down) { busy = svc?.pttDown() == false } else { svc?.pttUp(); busy = false } })
    VrgSectionTitle("Kapcsolatban")
    val linked = engine.peers(now()).filter { it.linked }
    if (linked.isEmpty()) Text("Senki. A kapcsolat magától épül, amikor egy csapattárs hallható (Android 10+ mindkét oldalon).", style = Melyviz.small)
    linked.forEach { Text("● ${it.name} · ${Proximity.label(it.distanceM)}" + if (it.talking) " · BESZÉL" else "", style = Melyviz.readout) }
}

// ---- Őrzés + Mozdulatlanság ---------------------------------------------------------------------------------------

@Composable
fun SafeTab() {
    val ctx = LocalContext.current
    val g = engine.guard
    val md = engine.manDown

    VrgSectionTitle("Őrzés (GUARD)")
    Text("A telefon a szerszámosládán vagy az elosztó ajtaján: ha valaki megmozdítja, 5 mp múlva riaszt itt hangosan, és riasztást küld a csapatnak, amíg valaki nem nyugtázza.",
        style = Melyviz.small)
    Text(g.state.hu.uppercase(), style = Melyviz.title.copy(fontSize = 22.sp, color = when (g.state) {
        GuardState.ALARM -> Melyviz.coral; GuardState.ENTRY, GuardState.EXIT -> Melyviz.sand; GuardState.ARMED -> Melyviz.glow; else -> Melyviz.muted
    }), modifier = Modifier.padding(vertical = 6.dp))
    Row {
        if (g.state == GuardState.OFF) VrgChip("Élesítés (tedd le, ne mozdítsd)", selected = true) { engine.guardArm(now()) }
        else VrgChip("Kikapcsolás") { engine.guardDisarm(now()) }
    }
    Row(Modifier.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text("Kilépési idő: ", style = Melyviz.small)
        listOf(5, 15, 30).forEach { s -> VrgChip("$s mp", selected = g.exitDelayS == s) { Pager.putInt(ctx, "exitDelay", s) }; Spacer(Modifier.width(4.dp)) }
    }
    VrgToggle("Csak a társ kapcsolhatja ki (társ-kikapcsolás)", g.partnerOnlyDisarm) { Pager.putBool(ctx, "partnerOnly", it) }
    val others = engine.peers(now()).filter { it.zone != Zone.OUT || it.linked }
    if (others.isNotEmpty()) Text("Társak telefonja távolról:", style = Melyviz.label, modifier = Modifier.padding(top = 6.dp))
    others.forEach { p ->
        Row(Modifier.padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("${p.name}${if (p.armed) " · őrzés" else ""}${if (p.alarm) " · RIASZT" else ""}", style = Melyviz.small, modifier = Modifier.weight(1f))
            VrgChip("Élesít") { engine.remoteGuard(p.unit, true, now()) }
            Spacer(Modifier.width(4.dp))
            VrgChip("Kikapcsol") { engine.remoteGuard(p.unit, false, now()) }
        }
    }

    VrgSectionTitle("Mozdulatlanság (man-down)")
    Text("Egyedül dolgozóknak: ha a telefon esés után vagy hosszan nem mozdul, előbb itt szól; LÁTTAM nélkül riasztást küld a csapatnak. Segítség, nem minősített egyedül-dolgozó készülék.",
        style = Melyviz.small)
    VrgToggle("Figyelés", md.state != ManDownState.OFF) { engine.setManDown(it, now()) }
    Row(Modifier.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Text("Mozdulatlan: ", style = Melyviz.small)
        listOf(60, 90, 180, 300).forEach { s -> VrgChip(if (s < 120) "$s mp" else "${s / 60} perc", selected = md.stillLimitS == s) { Pager.putInt(ctx, "stillLimit", s) }; Spacer(Modifier.width(4.dp)) }
    }
    Row(Modifier.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Text("Előriasztás: ", style = Melyviz.small)
        listOf(15, 25, 40).forEach { s -> VrgChip("$s mp", selected = md.preAlarmS == s) { Pager.putInt(ctx, "preAlarm", s) }; Spacer(Modifier.width(4.dp)) }
    }
    if (md.state == ManDownState.PRE_ALARM || md.state == ManDownState.ALARM) {
        PadKey(if (md.state == ManDownState.ALARM) "RIASZTÁS ELMENT — jól vagyok" else "JÓL VAGYOK (${engine.manDownLeft} mp)", Modifier.fillMaxWidth().padding(top = 6.dp),
            tint = Melyviz.coral, height = 80.dp, onTap = { engine.seen(now()); PagerService.current?.quiet() })
    }
}

// ---- Beállítás ----------------------------------------------------------------------------------------------------

@Composable
fun SetupTab(host: FeatureHost) {
    val ctx = LocalContext.current
    val s = remember(Pager.version.collectAsStateWithLifecycle().value / 40) { Pager.settings(ctx) }
    var name by remember { mutableStateOf(s.name) }
    var crew by remember { mutableStateOf(s.crew) }
    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = Melyviz.glow, unfocusedBorderColor = Melyviz.line,
        focusedTextColor = Melyviz.ink, unfocusedTextColor = Melyviz.ink, cursorColor = Melyviz.glow,
    )

    VrgSectionTitle("Én")
    OutlinedTextField(name, { name = it.take(20) }, Modifier.fillMaxWidth(), singleLine = true, label = { Text("Név a többiek telefonján", style = Melyviz.small) }, colors = fieldColors)
    Text("Egységszám (a pager 1–8-ja helyett 1–$MAX_UNIT): csapaton belül mindenkinek más.", style = Melyviz.small, modifier = Modifier.padding(top = 6.dp))
    FlowRow(Modifier.padding(vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        val taken = engine.peers(now()).map { it.unit }.toSet()
        (1..MAX_UNIT).forEach { u ->
            VrgChip(if (u in taken && u != s.unit) "$u·" else "$u", selected = u == s.unit) { Pager.save(ctx, Pager.settings(ctx).copy(unit = u)) }
        }
    }
    Text("· = egy hallható társ már ezt használja", style = Melyviz.readout.copy(fontSize = 10.sp))

    VrgSectionTitle("Csapat")
    OutlinedTextField(crew, { crew = it.take(24) }, Modifier.fillMaxWidth(), singleLine = true, label = { Text("Csapatkód", style = Melyviz.small) }, colors = fieldColors)
    Text("Csak az azonos kódú telefonok hallják egymást; a kódból képzett kulcs hitelesít minden jelzést, így idegen nem küldhet KAPCSOLD FEL-t.",
        style = Melyviz.small)
    Row(Modifier.padding(vertical = 6.dp)) {
        VrgChip("Mentés", selected = name != s.name || Crew.normalise(crew) != s.crew) { Pager.save(ctx, Pager.settings(ctx).copy(name = name, crew = crew)) }
        Spacer(Modifier.width(6.dp))
        VrgChip("Kód megosztása") {
            val link = "vrg://pager?crew=" + android.net.Uri.encode(s.crew)
            val send = Intent(Intent.ACTION_SEND).setType("text/plain")
                .putExtra(Intent.EXTRA_TEXT, "Csipogó csapat: ${s.crew}\n$link")
            runCatching { ctx.startActivity(Intent.createChooser(send, "Csapatkód megosztása").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
                .onFailure { host.note("Nem nyílt meg a megosztás.") }
        }
    }

    VrgSectionTitle("Működés")
    VrgToggle("Átjátszó (lépcsőházi csomópont): mindent továbbad", s.repeater) { Pager.save(ctx, Pager.settings(ctx).copy(repeater = it)) }
    Text("Bekapcsolva ez a telefon minden csapatjelzést továbbküld: tedd le a lépcsőházban, ha a födémek elnyelik a jelet. Kikapcsolva csak a gyengén hallott jelzéseket adja tovább.",
        style = Melyviz.small)
    VrgToggle("Hangerő gombok: le = adóvevő, fel = LÁTTAM", s.volumeKeys) { Pager.save(ctx, Pager.settings(ctx).copy(volumeKeys = it)); PagerFeature.keysOn = it }
    Text("Saját jelerősség 1 m-en (a többiek ehhez mérnek): ${s.tx1m} dBm", style = Melyviz.readout, modifier = Modifier.padding(top = 6.dp))
    if (engine.staleBeacons > 0) Text("${engine.staleBeacons} elavult jelzés eldobva (rossz óra egy telefonon, vagy visszajátszás).", style = Melyviz.small.copy(color = Melyviz.sand))

    VrgSectionTitle("Eseménynapló")
    engine.log().take(40).forEach { l ->
        Text("${time(l.at)}  ${l.text}", style = Melyviz.readout.copy(color = if (l.bad) Melyviz.coral else Melyviz.muted))
    }
}
