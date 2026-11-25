package hu.vrg.mobile.kit.postit

import android.content.ActivityNotFoundException
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CutCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.onLongClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.PiAnchor
import hu.vrg.mobile.core.PiAuthor
import hu.vrg.mobile.core.PiBox
import hu.vrg.mobile.core.PostIt
import hu.vrg.mobile.core.PostItNote
import hu.vrg.mobile.kit.theme.Melyviz
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// Post-it (WP M68, docs/notes/POSTIT.md): the overlay the shell draws over every screen, last in its root Box, so it is above
// every feature, the Asztal and the Katalógus. Off (the default) it draws nothing at all. On: two small buttons in the upper
// left (👁 show / hide, 📌 arm; a long press on 📌 opens the menu; DEV when the developer's layer is allowed). Armed, a
// full-screen catcher takes the next tap, leaves a faint mark there and opens the text box beside it, as in the Planner.
// Where nothing of the overlay is (no catcher, no card, no button), taps go through to the app: Compose hit-testing only
// stops at nodes with pointer input.

private val Paper = Color(0xFFF2D27A)
private val PaperInk = Color(0xFF2A2310)
private val Panel = Color(0xF2121C24)
private const val CARD_W = 190.0
private const val CARD_H = 58.0
private const val EDIT_W = 270.0
private const val EDIT_H = 210.0

private sealed class Editing {
    abstract val anchor: PiAnchor
    data class New(override val anchor: PiAnchor) : Editing()
    data class Mine(val note: PostItNote) : Editing() { override val anchor get() = note.anchor }
    data class Theirs(val author: PiAuthor, val note: PostItNote) : Editing() { override val anchor get() = note.anchor }
}

private data class Shown(val note: PostItNote, val author: PiAuthor?)

/**
 * [screen] is this screen's key ("m:" + what the shell shows, PostIt.screen), [detail] an optional sub-place (a route path).
 * [onNote] shows a short line at the bottom (the shell's note()).
 */
@Composable
fun PostItLayer(screen: String, detail: String? = null, onNote: (String) -> Unit) {
    if (!PostItStore.ready) return
    val s by PostItStore.flow.collectAsStateWithLifecycle()
    if (!s.enabled) return
    val ctx = LocalContext.current
    var editing by remember { mutableStateOf<Editing?>(null) }
    var menu by remember { mutableStateOf(false) }
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        if (uris.isNotEmpty()) onNote(PostItStore.importUris(uris))
    }
    // a screen change closes what belonged to the old one
    LaunchedEffect(screen) { if (editing is Editing.New) editing = null }
    BackHandler(s.armed || editing != null || menu) {
        when {
            editing != null -> editing = null
            menu -> menu = false
            else -> PostItStore.setArmed(false)
        }
    }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val box = PiBox(0.0, 0.0, maxWidth.value.toDouble(), maxHeight.value.toDouble())   // dp: the anchor's box is the whole app

        // ---- the notes of this screen: faint marks, leader lines, hovering cards
        val shown = if (!s.show) emptyList() else
            PostIt.onScreen(s.mine, screen).map { Shown(it, null) } +
                (if (s.dev && s.devAllowed) PostIt.inboxNotes(s.inbox, s.hidden).filter { it.second.anchor.screen == screen }.map { Shown(it.second, it.first) } else emptyList())
        val marks = shown.map { PostIt.toPx(it.note.anchor, box) }
        val cards = PostIt.stack(marks.map { (x, y) -> PostIt.cardAt(x, y, box, CARD_W, CARD_H) }, CARD_W, CARD_H)
        val pending = editing?.let { e -> if (e is Editing.New) PostIt.toPx(e.anchor, box) else null }
        Canvas(Modifier.fillMaxSize()) {
            val d = this.density
            shown.forEachIndexed { i, sh ->
                val col = colourOf(sh.author)
                val m = Offset((marks[i].first * d).toFloat(), (marks[i].second * d).toFloat())
                val c = cards[i]
                val end = Offset(((if (c.side == "right") c.x else c.x + CARD_W) * d).toFloat(), ((c.y + 14) * d).toFloat())
                drawLine(col.copy(alpha = .45f), m, end, strokeWidth = 1f * d)
                drawCircle(col.copy(alpha = .7f), 6f * d, m, style = Stroke(1.2f * d))
                drawCircle(col.copy(alpha = .8f), 2f * d, m)
            }
            pending?.let { (x, y) ->
                val m = Offset((x * d).toFloat(), (y * d).toFloat())
                drawCircle(Paper.copy(alpha = .8f), 6f * d, m, style = Stroke(1.2f * d))
                drawCircle(Paper, 2f * d, m)
            }
        }
        shown.forEachIndexed { i, sh ->
            val c = cards[i]
            NoteCard(sh, Modifier.offset(c.x.dp, c.y.dp)) {
                editing = if (sh.author == null) Editing.Mine(sh.note) else Editing.Theirs(sh.author, sh.note)
            }
        }

        // ---- armed: the whole surface takes the next tap
        if (s.armed) Box(
            Modifier.fillMaxSize().background(Paper.copy(alpha = .05f)).border(2.dp, Paper.copy(alpha = .55f))
                .pointerInput(screen, detail) {
                    detectTapGestures { off ->
                        val a = PostIt.anchorAt(screen, detail, off.x.toDp().value.toDouble(), off.y.toDp().value.toDouble(), box)
                        PostItStore.setArmed(false)
                        editing = Editing.New(a)
                    }
                }
                .semantics { contentDescription = "Post-it élesítve: koppints oda, ahová a jegyzet szól" },
        ) {
            Text("Koppints oda, ahová a jegyzet szól · Vissza: mégse", style = TextStyle(fontSize = 11.sp, color = Paper, fontFamily = Melyviz.mono),
                modifier = Modifier.systemBarsPadding().padding(start = 6.dp, top = 52.dp).background(Panel).padding(horizontal = 8.dp, vertical = 4.dp))
        }

        // ---- the two buttons (and DEV), upper left, over everything
        Row(Modifier.systemBarsPadding().padding(start = 6.dp, top = 6.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            CornerButton("Jegyzetek mutatása", s.show, onTap = { PostItStore.setShow(!s.show) }) { on -> eye(on) }
            CornerButton("Post-it élesítése", s.armed, onTap = { menu = false; editing = null; PostItStore.setArmed(!s.armed) }, onLong = { menu = !menu }) { on -> pin(on) }
            if (s.devAllowed) DevButton(s.dev) { PostItStore.setDev(!s.dev) }
        }
        if (menu) Menu(s, onClose = { menu = false }, onNote = onNote,
            onShare = {
                val i = PostItStore.shareIntent()
                if (i == null) onNote("Még nincs Post-it jegyzet.") else try { ctx.startActivity(i) } catch (e: ActivityNotFoundException) { onNote("Nincs megosztó alkalmazás.") }
            },
            onImport = { try { pick.launch(arrayOf("application/json", "text/plain", "application/octet-stream", "*/*")) } catch (e: ActivityNotFoundException) { onNote("Nincs fájlválasztó.") } })

        // ---- the text box beside the mark (a tap outside saves, like the PC)
        editing?.let { e ->
            Box(Modifier.fillMaxSize().pointerInput(e) { detectTapGestures { editing = null } })
            BoxWithConstraints(Modifier.fillMaxSize().imePadding()) {
                val area = PiBox(0.0, 0.0, maxWidth.value.toDouble(), maxHeight.value.toDouble())
                val (mx, my) = PostIt.toPx(e.anchor, box)
                val at = PostIt.cardAt(mx, my, area, EDIT_W, EDIT_H, 16.0)
                Editor(e, Modifier.offset(at.x.dp, at.y.dp), onDone = { editing = null }, onNote = onNote)
            }
        }
    }
}

private fun colourOf(a: PiAuthor?): Color = if (a == null) Paper else Color.hsl(PostIt.hue(a.id).toFloat(), .7f, .7f)

@Composable
private fun NoteCard(sh: Shown, modifier: Modifier, onOpen: () -> Unit) {
    val bg = if (sh.author == null) Paper else Color.hsl(PostIt.hue(sh.author.id).toFloat(), .7f, .78f)
    Column(modifier.width(CARD_W.dp).background(bg.copy(alpha = if (sh.note.done) .5f else 1f), CutCornerShape(bottomEnd = 7.dp))
        .clickable(onClickLabel = "megnyitás", onClick = onOpen).padding(horizontal = 8.dp, vertical = 6.dp)) {
        if (sh.author != null) Text(sh.author.name + (sh.author.device?.let { " · $it" } ?: ""), maxLines = 1, overflow = TextOverflow.Ellipsis,
            style = TextStyle(fontSize = 10.sp, fontFamily = Melyviz.mono, color = PaperInk.copy(alpha = .7f)))
        Text(sh.note.text, maxLines = 3, overflow = TextOverflow.Ellipsis,
            style = TextStyle(fontSize = 12.sp, color = PaperInk, textDecoration = if (sh.note.done) TextDecoration.LineThrough else null))
    }
}

@Composable
private fun CornerButton(label: String, on: Boolean, onTap: () -> Unit, onLong: (() -> Unit)? = null, icon: androidx.compose.ui.graphics.drawscope.DrawScope.(Boolean) -> Unit) {
    val bg = if (on) Paper else Panel
    Box(
        Modifier.size(40.dp).background(bg, CutCornerShape(bottomEnd = 6.dp)).border(1.dp, if (on) Paper else Melyviz.line, CutCornerShape(bottomEnd = 6.dp))
            .pointerInput(onLong) { detectTapGestures(onTap = { onTap() }, onLongPress = onLong?.let { f -> { _: Offset -> f() } }) }
            .semantics {
                contentDescription = label; role = Role.Button; stateDescription = if (on) "be" else "ki"
                onClick { onTap(); true }
                if (onLong != null) onLongClick(label = "menü") { onLong(); true }
            },
        contentAlignment = Alignment.Center,
    ) { Canvas(Modifier.size(18.dp)) { icon(on) } }
}

@Composable
private fun DevButton(on: Boolean, onTap: () -> Unit) {
    Box(Modifier.heightIn(min = 40.dp).background(if (on) Melyviz.glow else Panel, CutCornerShape(bottomEnd = 6.dp))
        .border(1.dp, if (on) Melyviz.glow else Melyviz.line, CutCornerShape(bottomEnd = 6.dp))
        .clickable(onClickLabel = "fejlesztői réteg", onClick = onTap).padding(horizontal = 8.dp), contentAlignment = Alignment.Center) {
        Text("DEV", style = TextStyle(fontSize = 11.sp, fontFamily = Melyviz.mono, color = if (on) Melyviz.onGlow else Melyviz.muted))
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.eye(on: Boolean) {
    val c = if (on) PaperInk else Color(0xFFA6AFB7)
    val w = size.width; val h = size.height
    val p = Path().apply { moveTo(0f, h / 2); quadraticBezierTo(w / 2, -h * .15f, w, h / 2); quadraticBezierTo(w / 2, h * 1.15f, 0f, h / 2); close() }
    drawPath(p, c, style = Stroke(1.6f * density))
    drawCircle(c, w * .15f, Offset(w / 2, h / 2), style = Stroke(1.6f * density))
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.pin(on: Boolean) {
    val c = if (on) PaperInk else Color(0xFFA6AFB7)
    val w = size.width; val h = size.height
    val p = Path().apply { moveTo(w * .1f, h * .08f); lineTo(w * .9f, h * .08f); lineTo(w * .9f, h * .68f); lineTo(w * .66f, h * .92f); lineTo(w * .1f, h * .92f); close() }
    drawPath(p, c, style = Stroke(1.6f * density))
    drawLine(c, Offset(w * .28f, h * .34f), Offset(w * .7f, h * .34f), 1.6f * density)
    drawLine(c, Offset(w * .28f, h * .52f), Offset(w * .56f, h * .52f), 1.6f * density)
}

@Composable
private fun Editor(e: Editing, modifier: Modifier, onDone: () -> Unit, onNote: (String) -> Unit) {
    val focus = remember { FocusRequester() }
    var text by remember(e) { mutableStateOf(if (e is Editing.Mine) e.note.text else "") }
    var sure by remember(e) { mutableStateOf(false) }
    val fmt = remember { SimpleDateFormat("yyyy.MM.dd HH:mm", Locale("hu")) }
    Column(modifier.width(EDIT_W.dp).background(Panel).border(1.dp, Paper).pointerInput(Unit) { detectTapGestures { } }.padding(8.dp)) {
        val meta = when (e) {
            is Editing.Theirs -> e.author.name + (e.author.device?.let { " · $it" } ?: "") + " · " + fmt.format(Date(e.note.at))
            is Editing.Mine -> label(e.anchor) + " · " + fmt.format(Date(e.note.at))
            is Editing.New -> label(e.anchor)
        }
        Text(meta, style = TextStyle(fontSize = 10.sp, fontFamily = Melyviz.mono, color = Melyviz.muted), modifier = Modifier.padding(bottom = 6.dp))
        if (e is Editing.Theirs) {
            Text(e.note.text, style = TextStyle(fontSize = 14.sp, color = Melyviz.ink), modifier = Modifier.heightIn(max = 140.dp).verticalScroll(rememberScrollState()))
            Text(label(e.anchor), style = TextStyle(fontSize = 10.sp, fontFamily = Melyviz.mono, color = Melyviz.muted), modifier = Modifier.padding(top = 6.dp))
            Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                EdButton(if (e.note.done) "Újranyitás" else "Kész", main = true) { PostItStore.settle(e.author.id, e.note.id, if (e.note.done) "open" else "done"); onDone() }
                Spacer(Modifier.weight(1f))
                EdButton("Bezár") { onDone() }
            }
        } else {
            BasicTextField(text, { text = it.take(PostIt.MAX_TEXT) }, textStyle = TextStyle(fontSize = 14.sp, color = Melyviz.ink), cursorBrush = SolidColor(Paper),
                modifier = Modifier.fillMaxWidth().heightIn(min = 84.dp, max = 160.dp).background(Melyviz.abyss).border(1.dp, Melyviz.line).padding(6.dp).focusRequester(focus),
                decorationBox = { inner -> Box { if (text.isEmpty()) Text("Mit látsz itt?", style = TextStyle(fontSize = 14.sp, color = Melyviz.faint)); inner() } })
            LaunchedEffect(e) { focus.requestFocus() }
            Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                EdButton("Mentés", main = true) {
                    when {
                        text.isBlank() -> onNote("Üres jegyzet nem menthető.")
                        e is Editing.New -> { PostItStore.add(text, e.anchor); onDone() }
                        e is Editing.Mine -> { PostItStore.edit(e.note.id, text = text); onDone() }
                    }
                }
                if (e is Editing.Mine) EdButton(if (e.note.done) "Újranyit" else "Kész") { PostItStore.edit(e.note.id, state = if (e.note.done) "open" else "done"); onDone() }
                Spacer(Modifier.weight(1f))
                if (e is Editing.Mine) EdButton(if (sure) "Biztos?" else "Törlés") { if (sure) { PostItStore.remove(e.note.id); onDone() } else sure = true }
                EdButton("Mégse") { onDone() }
            }
        }
    }
}

private fun label(a: PiAnchor): String {
    val s = a.screen
    val base = when {
        s.startsWith("m:") -> "Telefon: " + s.removePrefix("m:")
        s.startsWith("d:") -> "PC: " + s.removePrefix("d:")
        else -> s
    }
    return base + (a.detail?.let { " · $it" } ?: "")
}

@Composable
private fun EdButton(text: String, main: Boolean = false, onClick: () -> Unit) {
    Box(Modifier.heightIn(min = 40.dp).widthIn(min = 48.dp).background(if (main) Paper else Melyviz.raised).border(1.dp, if (main) Paper else Melyviz.line)
        .clickable(onClick = onClick).padding(horizontal = 10.dp), contentAlignment = Alignment.Center) {
        Text(text, style = TextStyle(fontSize = 13.sp, color = if (main) PaperInk else Melyviz.ink))
    }
}

@Composable
private fun Menu(s: PostItState, onClose: () -> Unit, onNote: (String) -> Unit, onShare: () -> Unit, onImport: () -> Unit) {
    var name by remember { mutableStateOf(s.name) }
    var wipe by remember { mutableStateOf(false) }
    Box(Modifier.fillMaxSize().pointerInput(Unit) { detectTapGestures { PostItStore.setName(name); onClose() } })
    Column(Modifier.systemBarsPadding().padding(start = 6.dp, top = 52.dp).width(280.dp).background(Panel).border(1.dp, Melyviz.line)
        .pointerInput(Unit) { detectTapGestures { } }.padding(8.dp).verticalScroll(rememberScrollState())) {
        Head("Post-it")
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Név", style = Melyviz.label, modifier = Modifier.padding(end = 8.dp))
            BasicTextField(name, { name = it.take(PostIt.MAX_NAME) }, singleLine = true, textStyle = TextStyle(fontSize = 14.sp, color = Melyviz.ink), cursorBrush = SolidColor(Paper),
                modifier = Modifier.weight(1f).background(Melyviz.abyss).border(1.dp, Melyviz.line).padding(6.dp),
                decorationBox = { inner -> Box { if (name.isEmpty()) Text("a neved az exportban", style = TextStyle(fontSize = 14.sp, color = Melyviz.faint)); inner() } })
        }
        MenuItem("Küldés / exportálás (${s.mine.size})") { PostItStore.setName(name); onShare() }
        MenuItem(if (wipe) "Biztos? Mind törlődik" else "Saját jegyzetek törlése") { if (wipe) { PostItStore.clearMine(); onNote("A saját Post-it jegyzetek törölve."); onClose() } else wipe = true }
        if (s.devAllowed) {
            Head("Fejlesztő")
            MenuItem("Behívás fájlból…") { onImport(); onClose() }
            for (e in s.inbox.values) {
                val off = e.author.id in s.hidden
                Row(Modifier.fillMaxWidth().clickable { PostItStore.setHidden(e.author.id, !off) }, verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(4.dp, 28.dp).background(Color.hsl(PostIt.hue(e.author.id).toFloat(), .7f, .7f)))
                    Checkbox(!off, onCheckedChange = { PostItStore.setHidden(e.author.id, !it) })
                    Text("${e.author.name} · ${e.author.platform}" + (e.author.device?.let { " · $it" } ?: "") + " (${e.notes.size})", style = Melyviz.label)
                }
            }
        }
    }
}

@Composable
private fun Head(t: String) = Text(t.uppercase(), style = TextStyle(fontSize = 10.sp, fontFamily = Melyviz.mono, letterSpacing = 1.sp, color = Melyviz.muted),
    modifier = Modifier.padding(top = 6.dp, bottom = 4.dp))

@Composable
private fun MenuItem(t: String, onClick: () -> Unit) {
    Box(Modifier.fillMaxWidth().padding(vertical = 3.dp).heightIn(min = 44.dp).background(Melyviz.raised).border(1.dp, Melyviz.line).clickable(onClick = onClick).padding(horizontal = 10.dp),
        contentAlignment = Alignment.CenterStart) { Text(t, style = Melyviz.label) }
}
