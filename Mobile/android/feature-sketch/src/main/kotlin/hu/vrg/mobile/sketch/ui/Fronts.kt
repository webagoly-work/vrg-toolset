package hu.vrg.mobile.sketch.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.sketch.AnswerState
import hu.vrg.mobile.sketch.Effect
import hu.vrg.mobile.sketch.FieldKit
import hu.vrg.mobile.sketch.KScope
import hu.vrg.mobile.sketch.Kit
import hu.vrg.mobile.sketch.PointType
import hu.vrg.mobile.sketch.Tools
import hu.vrg.mobile.sketch.Wants
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val HM = SimpleDateFormat("HH:mm", Locale("hu"))

@Composable
private fun FrontPage(st: EditorState, id: String, content: @Composable () -> Unit) {
    val f = st.fronts().firstOrNull { it.id == id }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 140.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(f?.sym ?: "", style = Melyviz.glyph.copy(fontSize = 20.sp, color = st.frontColor(id)))
            Text("  " + (f?.label ?: id).uppercase(), style = Melyviz.title.copy(fontSize = 15.sp))
        }
        st.note?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 2.dp)) }
        Spacer(Modifier.height(6.dp))
        content()
    }
}

/** A card with its function's colour as a stripe down the left edge. */
@Composable
private fun Card(color: Color, content: @Composable () -> Unit) {
    Column(
        Modifier.fillMaxWidth().padding(vertical = 4.dp).clip(RoundedCornerShape(Melyviz.radiusSmall)).background(Melyviz.surface)
            .drawBehind { drawRect(color, size = Size(4.dp.toPx(), size.height)) }
            .border(1.dp, Melyviz.line, RoundedCornerShape(Melyviz.radiusSmall)).padding(start = 14.dp, end = 10.dp, top = 10.dp, bottom = 10.dp),
    ) { content() }
}

@Composable
internal fun Pill(text: String, color: Color, on: Boolean, onClick: () -> Unit) {
    Text(text, style = Melyviz.small.copy(fontSize = 12.sp, color = if (on) Color.Black else Melyviz.ink),
        modifier = Modifier.clip(RoundedCornerShape(50)).background(if (on) color else Melyviz.surface)
            .border(1.dp, if (on) color else Melyviz.line, RoundedCornerShape(50)).clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 6.dp))
}

/** What a suggestion would do, in words. */
internal fun describe(kit: Kit, e: Effect): String {
    val parts = mutableListOf<String>()
    e.scope.forEach { parts += "＋ " + (kit.scopeItem(it)?.label ?: it) }
    if (e.q != null) {
        val q = kit.question(e.q)
        val o = q?.options?.firstOrNull { it.id == e.opt }?.label
        parts += (q?.q?.removeSuffix("?") ?: e.q) + ": " + listOfNotNull(o, e.text).joinToString(" · ")
    }
    return parts.joinToString(", ")
}

// ---- Jegyzet (M27) ---------------------------------------------------------------------------------------------------

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun NotesFront(st: EditorState, sh: Shadow) = FrontPage(st, "jegyzet") {
    val col = st.frontColor("jegyzet")
    if (feat("jegyzet.quick")) Pill("✎ Új jegyzet" + (if (st.sketch.draft.isNotBlank()) " (félbehagyott)" else ""), col, true) { st.noteOpen = true }
    if (sh.suggestions.isNotEmpty()) {
        Text("A jegyzetekből", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 12.dp, bottom = 4.dp))
        sh.suggestions.forEach { g ->
            Row(Modifier.fillMaxWidth().padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f).clip(RoundedCornerShape(10.dp)).border(1.dp, col.copy(alpha = 0.6f), RoundedCornerShape(10.dp))
                    .clickable { st.accept(g.effect) }.padding(8.dp)) {
                    Text(describe(st.kit, g.effect), style = Melyviz.label.copy(fontSize = 12.sp))
                    Text("„${g.match}”", style = Melyviz.small.copy(color = Melyviz.faint))
                }
                Text("✕", style = Melyviz.label.copy(color = Melyviz.faint), modifier = Modifier.clickable { st.dismiss(g.id) }.padding(10.dp))
            }
        }
    }
    if (feat("jegyzet.log")) Text("Napló (${st.sketch.entries.size})", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 12.dp, bottom = 4.dp))
    if (feat("jegyzet.log") && st.sketch.entries.isEmpty()) Text("Még nincs jegyzet. A ✎ gomb minden nézetből elér.", style = Melyviz.small)
    if (feat("jegyzet.log")) st.sketch.entries.sortedByDescending { it.at }.forEach { e -> key(e.id) {
        Card(if (e.open) Color(0xFFD64545) else col) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(HM.format(Date(e.at)) + (if (e.voice) " 🎤" else ""), style = Melyviz.readout)
                Spacer(Modifier.weight(1f))
                st.sketch.room(e.room)?.let { Text(roomTitle(it.name, it.kinds), style = Melyviz.small.copy(color = st.frontColor("vazlat"))) }
                if (feat("jegyzet.unclear")) Text(if (e.open) "  ⚑" else "  ⚐", style = Melyviz.label.copy(color = if (e.open) Color(0xFFD64545) else Melyviz.faint),
                    modifier = Modifier.clickable { st.setOpen(e.id, !e.open) })
            }
            if (e.chips.isNotEmpty()) FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(vertical = 4.dp)) {
                e.chips.mapNotNull { st.kit.chip(it) }.forEach { c ->
                    Text(c.sym + " " + c.label, style = Melyviz.small.copy(fontSize = 10.sp, color = Color(c.color)),
                        modifier = Modifier.border(1.dp, Color(c.color), RoundedCornerShape(50)).padding(horizontal = 6.dp, vertical = 2.dp))
                }
            }
            if (e.text.isNotBlank()) Text(e.text, style = Melyviz.label.copy(fontSize = 13.sp), modifier = Modifier.clickable { st.ask = Ask.EntryEdit(e.id) })
            else Text("✎ szöveg hozzáadása", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.clickable { st.ask = Ask.EntryEdit(e.id) })
        }
    } }
    if (st.sketch.memos.isNotEmpty()) Text("+ ${st.sketch.memos.size} memó a vázlaton", style = Melyviz.small, modifier = Modifier.padding(top = 8.dp))
}

// ---- Munkakör (M28) --------------------------------------------------------------------------------------------------

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun ScopeFront(st: EditorState) = FrontPage(st, "munkakor") {
    val col = st.frontColor("munkakor")
    LaunchedEffect(Unit) { st.wantRoom = st.focusRoom }   // F4: wants go to the room in focus, re-choosable under Hová
    val sum = remember(st.sketch, st.kit, st.norm) { FieldKit.summary(st.kit, st.sketch, st.norm) }
    if (feat("munkakor.summary")) Card(col) {
        Text("A munka eddig", style = Melyviz.small.copy(color = Melyviz.faint))
        val area = "%.1f".format(sum.areaM2).replace('.', ',')
        Text("${sum.rooms} szoba · $area m²" + (if (sum.guessedRooms > 0) " (${sum.guessedRooms} becsült)" else "") +
            " · ${sum.circuits} kör · ${sum.boards} elosztó", style = Melyviz.label.copy(fontSize = 13.sp))
        if (sum.planned.isNotEmpty()) Text("Tervezett: " + sum.planned.entries.sortedByDescending { it.value }.joinToString(", ") { "${it.value} ${it.key.label.lowercase()}" } +
            (if (sum.existing > 0) " · meglévő ${sum.existing}" else ""), style = Melyviz.small)
        Text("${sum.photos} fotó · ${sum.notes} jegyzet · ${sum.answered} válasz, ${sum.openQuestions} nyitott kérdés", style = Melyviz.small)
        sum.groups.forEach { (label, items) ->
            Text(label + ": " + items.joinToString(", ") { (s, n) -> s.label + if (s.qty && n > 1) " ×$n" else "" }, style = Melyviz.small.copy(color = col))
        }
    }
    if (feat("munkakor.takeoff")) TakeoffCard(st)   // the Munkakör lap (WP M47, TakeoffUi.kt)
    if (feat("munkakor.scope")) FieldKit.SCOPE_GROUPS.forEach { (g, label) ->
        val items = st.kit.scope.filter { it.group == g }
        if (items.isEmpty()) return@forEach
        Text(label, style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 12.dp, bottom = 4.dp))
        if (g == "igeny" && feat("munkakor.wants")) WantWhere(st, col)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            items.forEach { s -> ScopePill(st, s, col) }
        }
        if (g == "igeny" && feat("munkakor.wants")) WantsByRoom(st, col)
    }
}

@Composable
private fun ScopePill(st: EditorState, s: KScope, col: Color) {
    val n = if (s.qty) Wants.total(st.sketch, s.id) else st.sketch.scope[s.id] ?: 0
    if (!s.qty) { Pill(s.sym + " " + s.label, col, n > 0) { st.setScope(s.id, if (n > 0) 0 else 1) }; return }
    // F4: + / − go to the room chosen under Hová; the pill shows the job total and how many are in that room
    val here = st.wantRoom?.takeIf { st.sketch.room(it) != null }?.let { Wants.inRoom(st.sketch, it, s.id) } ?: 0
    Row(Modifier.clip(RoundedCornerShape(50)).background(if (n > 0) col else Melyviz.surface).border(1.dp, if (n > 0) col else Melyviz.line, RoundedCornerShape(50)),
        verticalAlignment = Alignment.CenterVertically) {
        val ink = if (n > 0) Color.Black else Melyviz.ink
        if (n > 0) Text(" − ", style = Melyviz.label.copy(color = ink), modifier = Modifier.clickable { st.addWant(s.id, -1) }.padding(horizontal = 6.dp, vertical = 6.dp))
        Text(s.sym + " " + s.label + (if (n > 0) " $n" else "") + (if (here > 0) " ($here itt)" else ""), style = Melyviz.small.copy(fontSize = 12.sp, color = ink),
            modifier = Modifier.clickable { st.addWant(s.id, +1) }.padding(horizontal = 8.dp, vertical = 6.dp))
        if (n > 0) Text(" + ", style = Melyviz.label.copy(color = ink), modifier = Modifier.clickable { st.addWant(s.id, +1) }.padding(horizontal = 6.dp, vertical = 6.dp))
    }
}

// ---- Kérdések (M28) --------------------------------------------------------------------------------------------------

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun QuestionsFront(st: EditorState, sh: Shadow) = FrontPage(st, "kerdes") {
    val col = st.frontColor("kerdes")
    var who by remember { mutableStateOf("") }
    var showDone by remember { mutableStateOf(false) }
    // the shadow's arrival times: what appears now is "new" for ten minutes
    val unseen = remember(st.sketch, st.kit) { FieldKit.unseen(st.kit, st.sketch, sh.facts) }
    LaunchedEffect(unseen) { st.markSeen(unseen) }
    if (feat("kerdes.filter")) Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Pill("Mind", col, who == "") { who = "" }
        Pill("☺ Ügyfél", col, who == "ugyfel") { who = "ugyfel" }
        Pill("◎ Szemle", col, who == "szemle") { who = "szemle" }
    }
    val qs = sh.questions.filter { who == "" || it.q.who == who || !feat("kerdes.filter") }
    val open = qs.filter { !it.done }
    if (open.isEmpty()) Text("Most nincs nyitott kérdés. Ahogy a munkakör, a jegyzet vagy a vázlat alakul, újak jönnek.", style = Melyviz.small, modifier = Modifier.padding(top = 10.dp))
    open.forEach { qs1 -> key(qs1.q.id) { QuestionCard(st, qs1, col) } }
    val done = qs.filter { it.done }
    if (done.isNotEmpty()) {
        Text((if (showDone) "▾ " else "▸ ") + "Megválaszolva (${done.size})", style = Melyviz.label.copy(color = Melyviz.muted),
            modifier = Modifier.clickable { showDone = !showDone }.padding(vertical = 10.dp))
        if (showDone) done.forEach { qs1 -> key(qs1.q.id) { QuestionCard(st, qs1, col) } }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun QuestionCard(st: EditorState, s: FieldKit.QState, col: Color) {
    val q = s.q
    val a = s.answer
    val chosen = a?.options ?: emptyList()
    var text by remember(a?.text) { mutableStateOf(a?.text ?: "") }
    Card(if (s.later) Melyviz.faint else col) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (s.fresh && feat("kerdes.fresh")) Box(Modifier.size(8.dp).clip(CircleShape).background(col))
            Text((if (s.fresh && feat("kerdes.fresh")) " " else "") + q.q, style = Melyviz.label.copy(fontSize = 13.sp), modifier = Modifier.weight(1f))
            Text(if (q.who == "szemle") "◎" else "☺", style = Melyviz.small.copy(color = Melyviz.faint))
        }
        q.hint?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.faint)) }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(vertical = 6.dp)) {
            q.options.forEach { o ->
                Pill(o.label, col, o.id in chosen) {
                    val next = if (q.multi) (if (o.id in chosen) chosen - o.id else chosen + o.id) else (if (o.id in chosen) emptyList() else listOf(o.id))
                    if (next.isEmpty() && text.isBlank()) st.clearAnswer(q.id) else st.answer(q.id, next, text, AnswerState.ANSWERED)
                }
            }
        }
        Field(text, { text = it }, "Megjegyzés" + (q.unit?.let { " ($it)" } ?: ""), number = false)
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            if (text != (a?.text ?: "")) Text("✓ Mentés", style = Melyviz.label.copy(color = col),
                modifier = Modifier.clickable { st.answer(q.id, chosen, text, AnswerState.ANSWERED) }.padding(vertical = 4.dp))
            if (!s.done && !s.later && feat("kerdes.later")) Text("⏱ Később", style = Melyviz.small, modifier = Modifier.clickable { st.answer(q.id, chosen, text, AnswerState.LATER) }.padding(vertical = 4.dp))
            if (feat("kerdes.later")) Text("⊘ Nem releváns", style = Melyviz.small, modifier = Modifier.clickable { st.answer(q.id, chosen, text, AnswerState.SKIP) }.padding(vertical = 4.dp))
            if (a != null) Text("↺", style = Melyviz.small, modifier = Modifier.clickable { st.clearAnswer(q.id) }.padding(vertical = 4.dp))
        }
    }
}

// ---- Nyitott (M26) ---------------------------------------------------------------------------------------------------

@Composable
internal fun OpenFront(st: EditorState, sh: Shadow) = FrontPage(st, "nyitott") {
    if (sh.open.isEmpty()) Text("Minden szál elvarrva.", style = Melyviz.label)
    Text("Ami még hiányzik vagy félbemaradt. Koppintva odaugrik; semmit nem kell sorrendben lezárni.", style = Melyviz.small)
    st.shownFronts().forEach { f ->
        val items = sh.open.filter { it.front == f.id }
        if (items.isEmpty()) return@forEach
        Row(Modifier.padding(top = 12.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(f.sym, style = Melyviz.glyph.copy(fontSize = 16.sp, color = Color(f.color)))
            Text("  " + f.label + " · ${items.size}", style = Melyviz.small.copy(color = Melyviz.faint))
        }
        items.forEach { o ->
            Text("· " + o.label, style = Melyviz.label.copy(fontSize = 13.sp),
                modifier = Modifier.fillMaxWidth().clickable { jump(st, o) }.padding(vertical = 5.dp))
        }
    }
}

private fun jump(st: EditorState, o: FieldKit.Open) {
    when (o.kind) {
        "draft" -> st.noteOpen = true
        "entry" -> { st.front = "jegyzet"; st.ask = Ask.EntryEdit(o.ref) }
        "capture" -> { st.front = "kamera"; st.ask = Ask.CaptureView(o.ref) }
        "shot" -> st.kit.shot(o.ref)?.let { item ->
            if (item.purpose == "szoba") { st.front = "vazlat"; if (Tools.PHOTO in st.rail) st.pick(Tools.PHOTO) else st.note = "⚙ → Fotópont be, majd ◉ a szoba közepére." }
            else st.shoot(item.purpose, item.id)
        }
        "room", "point", "circuit", "photo" -> {
            st.front = "vazlat"
            if (o.kind == "room") st.focusRoom = o.ref
            st.note = o.label + when (o.kind) {
                "room" -> " · a Méret eszközzel mérd meg"
                "point" -> " · tartsd lenyomva a pontot"
                "circuit" -> " · Elosztó → Bekötés"
                else -> " · koppints az üres cikkre a ◉ eszközzel"
            }
            if (o.kind == "room" && Tools.MEASURE in st.rail) st.pick(Tools.MEASURE)
        }
        else -> st.front = o.front
    }
}

internal fun pointLabel(t: PointType) = t.glyph + " " + t.label
