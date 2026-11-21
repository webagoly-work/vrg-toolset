package hu.vrg.mobile.sketch.ui

import android.content.ActivityNotFoundException
import android.content.Intent
import android.speech.RecognizerIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.sketch.FieldKit
import hu.vrg.mobile.sketch.KChip
import hu.vrg.mobile.sketch.KFront
import kotlinx.coroutines.delay

// VRG Sketcher's frame (WP M26): the fronts as symbols in their colour (no rows of text buttons), each with its count;
// the two capture buttons that are on every front (✎ note, ◉ photo), so whatever the user was doing, a fact or a
// picture is one tap away and the front stays as it was; the quick-note sheet.

/** The digital shadow, computed once per change and shared by the fronts and their badges. */
class Shadow(st: EditorState) {
    val facts = FieldKit.facts(st.kit, st.sketch)
    // M51 (D-93): a feature switched off leaves no trace: its cards, badges and loose ends go; the data stays
    val questions = if (feat("kerdes.questions")) FieldKit.questions(st.kit, st.sketch, facts) else emptyList()
    val suggestions = if (feat("jegyzet.keywords")) FieldKit.suggestions(st.kit, st.sketch) else emptyList()
    val shots = if (feat("kamera.shotlist")) FieldKit.shots(st.kit, st.sketch, facts) else emptyList()
    val open = FieldKit.open(st.kit, st.sketch, st.norm, facts).filter { openShown(it) }
    val openQuestions get() = questions.count { !it.done && !it.later }
    val fresh get() = questions.any { it.fresh }
    val missingShots get() = shots.count { !it.done && it.item.prio == 1 }
}

private val DEFAULT_FRONTS = listOf(
    KFront("vazlat", "Vázlat", "◫", 0xFF27C2B0), KFront("jegyzet", "Jegyzet", "✎", 0xFFE0B020),
    KFront("munkakor", "Munkakör", "☰", 0xFF3DAE5A), KFront("kerdes", "Kérdések", "?", 0xFFE8641C),
    KFront("kamera", "Kamera", "◉", 0xFF2A8CDB), KFront("helyszin", "Helyszín", "⌖", 0xFF8A5CD6),
    KFront("nyitott", "Nyitott", "⚑", 0xFFD64545),
)

fun EditorState.fronts() = kit.fronts.ifEmpty { DEFAULT_FRONTS }
fun EditorState.frontColor(id: String) = Color(fronts().firstOrNull { it.id == id }?.color ?: 0xFF7D8590)

@Composable
internal fun FrontBar(st: EditorState, sh: Shadow) {
    Row(Modifier.fillMaxWidth().background(Melyviz.deep).horizontalScroll(rememberScrollState()).padding(horizontal = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        st.shownFronts().forEach { f ->   // M51: a front whose features are all off is not on the bar
            val on = st.front == f.id
            val col = Color(f.color)
            val badge = when (f.id) {
                "kerdes" -> sh.openQuestions
                "jegyzet" -> sh.suggestions.size
                "kamera" -> sh.missingShots
                "nyitott" -> sh.open.size
                else -> 0
            }
            Box(
                Modifier.width(52.dp).height(48.dp).clickable { st.front = f.id }
                    .semantics { contentDescription = f.label + if (badge > 0) ", $badge" else "" },
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(f.sym, style = Melyviz.glyph.copy(fontSize = 19.sp, color = if (on) col else col.copy(alpha = 0.55f)))
                    Text(f.label, style = Melyviz.small.copy(fontSize = 8.sp, color = if (on) Melyviz.ink else Melyviz.faint), maxLines = 1)
                }
                if (on) Box(Modifier.align(Alignment.BottomCenter).width(30.dp).height(3.dp).background(col, RoundedCornerShape(2.dp)))
                if (badge > 0) {
                    val hot = f.id == "kerdes" && sh.fresh && feat("kerdes.fresh")
                    Text(if (badge > 99) "99+" else "$badge",
                        style = Melyviz.small.copy(fontSize = 9.sp, color = if (hot) Color.White else Melyviz.ink),
                        modifier = Modifier.align(Alignment.TopEnd).offset(x = (-2).dp, y = 3.dp)
                            .clip(RoundedCornerShape(50)).background(if (hot) col else Melyviz.raised).padding(horizontal = 4.dp))
                }
            }
        }
    }
}

/** ✎ and ◉, on every front. ◉: tap = a photo for the current purpose; hold = choose the purpose first. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
internal fun CaptureButtons(st: EditorState, modifier: Modifier) {
    Column(modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        val note = st.frontColor("jegyzet"); val cam = st.frontColor("kamera")
        if (feat("jegyzet.quick")) Box(Modifier.size(48.dp).clip(CircleShape).background(note).clickable { st.noteOpen = true }
            .semantics { contentDescription = "Gyors jegyzet" }, contentAlignment = Alignment.Center) {
            Text("✎", style = Melyviz.glyph.copy(fontSize = 22.sp, color = Color.Black))
        }
        val p = st.kit.purpose(st.purpose)
        if (feat("kamera.capture")) Box(Modifier.size(56.dp).clip(CircleShape).background(cam)
            .combinedClickable(onClick = { st.shoot(st.purpose) }, onLongClick = { st.ask = Ask.Purposes })
            .semantics { contentDescription = "Fotó: " + (p?.label ?: "egyéb") + ". Tartsd: cél választása." },
            contentAlignment = Alignment.Center) {
            Text("◉", style = Melyviz.glyph.copy(fontSize = 26.sp, color = Color.White))
            Text(p?.sym ?: "•", style = Melyviz.small.copy(fontSize = 10.sp, color = Color.White),
                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 2.dp))
        }
    }
}

/** A chip of the catalog: its symbol in its colour, filled when on. */
@Composable
internal fun ChipPill(c: KChip, on: Boolean, onClick: () -> Unit) {
    val col = Color(c.color)
    Row(Modifier.clip(RoundedCornerShape(50)).background(if (on) col else Melyviz.surface).border(1.dp, col, RoundedCornerShape(50))
        .clickable(onClick = onClick).padding(horizontal = 9.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(c.sym, style = Melyviz.label.copy(fontSize = 12.sp, color = if (on) Color.Black else col))
        Text(" " + c.label, style = Melyviz.small.copy(fontSize = 11.sp, color = if (on) Color.Black else Melyviz.ink))
    }
}

/** F4: no speech recogniser on the phone (no Google app, a de-Googled ROM): the keyboard's own mic still dictates. */
internal const val NO_RECOGNIZER = "Nincs beszédfelismerő a telefonon: a billentyűzet 🎤 gombjával diktálhatsz a mezőbe."

internal fun dictationIntent(prompt: String) = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
    .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
    .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "hu-HU")
    .putExtra(RecognizerIntent.EXTRA_PROMPT, prompt)

/**
 * The quick note: text or dictation, the catalog's chips instead of typing, ⚑ Tisztázandó, and the room in focus.
 * Closing without saving keeps the text as the survey's draft (rule 4: nothing half-done is lost).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun QuickNote(st: EditorState) {
    var text by remember { mutableStateOf(st.sketch.draft) }
    var chips by remember { mutableStateOf(listOf<String>()) }
    var open by remember { mutableStateOf(false) }
    var voice by remember { mutableStateOf(false) }
    var room by remember { mutableStateOf(st.focusRoom) }
    LaunchedEffect(text) { delay(700); st.setDraft(text) }
    val dictate = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        val said = r.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()
        if (!said.isNullOrBlank()) { text = if (text.isBlank()) said else "$text $said"; voice = true }
    }
    val close = { st.setDraft(text); st.noteOpen = false }
    AlertDialog(
        onDismissRequest = close, containerColor = Melyviz.raised,
        title = { Text("✎ Jegyzet", style = Melyviz.label.copy(color = st.frontColor("jegyzet"))) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                Field(text, { text = it }, "Mit mond az ügyfél? Mit látsz?", lines = 3)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (feat("jegyzet.dictation")) Text("🎤 Diktálás", style = Melyviz.label.copy(color = Melyviz.current), modifier = Modifier.clickable {
                        try { dictate.launch(dictationIntent("Mondd a jegyzetet")) } catch (e: ActivityNotFoundException) { st.note = NO_RECOGNIZER }
                    }.padding(vertical = 6.dp))
                    if (feat("jegyzet.unclear")) Text(if (open) "⚑ Tisztázandó" else "⚐ Tisztázandó?", style = Melyviz.label.copy(color = if (open) Color(0xFFD64545) else Melyviz.muted),
                        modifier = Modifier.clickable { open = !open }.padding(vertical = 6.dp))
                }
                val r = st.sketch.room(room)
                Text(if (r != null) "Szoba: " + roomTitle(r.name, r.kinds) + "  ✕" else "Nincs szobához kötve",
                    style = Melyviz.small, modifier = Modifier.clickable { room = null }.padding(vertical = 4.dp))
                if (feat("jegyzet.chips")) listOf("ugyfel" to "Ügyfél", "helyzet" to "Helyzet").forEach { (g, label) ->
                    Text(label, style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 6.dp, bottom = 2.dp))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        st.kit.chips.filter { it.group == g }.forEach { c -> ChipPill(c, c.id in chips) { chips = if (c.id in chips) chips - c.id else chips + c.id } }
                    }
                }
            }
        },
        confirmButton = {
            TextButton({ if (st.addNote(text, chips, open, voice, room)) { text = ""; st.noteOpen = false } else close() }) {
                Text(if (text.isBlank() && chips.isEmpty()) "Bezár" else "Mentés", color = Melyviz.glow)
            }
        },
        dismissButton = { TextButton(close) { Text("Később", color = Melyviz.muted) } },
    )
}
