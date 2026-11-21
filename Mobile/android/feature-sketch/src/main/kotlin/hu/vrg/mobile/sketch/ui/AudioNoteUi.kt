package hu.vrg.mobile.sketch.ui

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.os.Build
import android.speech.SpeechRecognizer
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.sketch.AudioNotes
import hu.vrg.mobile.sketch.Camera2
import hu.vrg.mobile.sketch.Capture
import hu.vrg.mobile.sketch.Intake
import kotlinx.coroutines.delay
import java.io.File

// F5 (WP M50, D-81): the dictation fallback. When the phone has no speech recogniser, the note's 🎤 offers
// "⏺ Hangjegyzet": a short recording (MediaRecorder, AAC .m4a, at most 3 minutes) kept as a capture of kind audio
// (sketch-core AudioNotes.kt), played back here, exported with the package, listed on the Desktop page.

/** Whether the phone has a speech recogniser (the manifest's <queries> lets Android 11+ answer truthfully). */
internal fun hasRecognizer(ctx: Context): Boolean = try { SpeechRecognizer.isRecognitionAvailable(ctx) } catch (e: Exception) { false }

private fun newRecorder(ctx: Context): MediaRecorder =
    if (Build.VERSION.SDK_INT >= 31) MediaRecorder(ctx) else @Suppress("DEPRECATION") MediaRecorder()

/** The recorder: ⏺ starts, ■ stops and keeps it (linked to [room]), Mégse throws it away. */
@Composable
internal fun AudioRecorder(st: EditorState, room: String?, close: () -> Unit) {
    val ctx = LocalContext.current
    val dir = st.photoDir
    var rec by remember { mutableStateOf<MediaRecorder?>(null) }
    var file by remember { mutableStateOf<File?>(null) }
    var started by remember { mutableLongStateOf(0L) }
    var elapsed by remember { mutableLongStateOf(0L) }
    var error by remember { mutableStateOf<String?>(null) }

    fun release(keep: Boolean) {
        val r = rec ?: return
        rec = null
        val ok = try { r.stop(); true } catch (e: RuntimeException) { false }      // stop() throws on a too-short recording
        r.release()
        val f = file ?: return
        val ms = System.currentTimeMillis() - started
        if (keep && ok && f.exists() && f.length() > 0) {
            val (s1, _) = AudioNotes.add(st.sketch, f.name, room, ms, f.length(), System.currentTimeMillis())
            st.edit(s1); st.note = "🎙 Hangjegyzet mentve (${Camera2.duration(ms)})."
        } else { f.delete(); if (keep) st.note = "Túl rövid felvétel: nem lett hangjegyzet." }
        file = null
    }

    fun start() {
        if (dir == null) { error = "Nincs hely a fájlnak."; return }
        dir.mkdirs()
        val f = File(dir, AudioNotes.fileName(System.currentTimeMillis()))
        try {
            val r = newRecorder(ctx)
            r.setAudioSource(MediaRecorder.AudioSource.MIC)
            r.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            r.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            r.setAudioEncodingBitRate(64_000); r.setAudioSamplingRate(44_100)
            r.setMaxDuration(AudioNotes.MAX_MS.toInt())
            r.setOutputFile(f.path)
            r.setOnInfoListener { _, what, _ -> if (what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED) { release(true); close() } }
            r.prepare(); r.start()
            rec = r; file = f; started = System.currentTimeMillis(); elapsed = 0; error = null
        } catch (e: Exception) { f.delete(); error = "A felvétel nem indult: ${e.message ?: "ismeretlen hiba"}" }
    }

    val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        if (ok) start() else error = "A hangfelvételhez mikrofon-engedély kell."
    }
    LaunchedEffect(rec) { while (rec != null) { elapsed = System.currentTimeMillis() - started; delay(250) } }
    DisposableEffect(Unit) { onDispose { release(false) } }

    AlertDialog(
        onDismissRequest = { release(false); close() }, containerColor = Melyviz.raised,
        title = { Text("🎙 Hangjegyzet", style = Melyviz.label.copy(color = st.frontColor("jegyzet"))) },
        text = {
            Column {
                Text("Nincs beszédfelismerő: mondd el, a telefon hangfájlként megőrzi (legfeljebb ${AudioNotes.MAX_MS / 60000} perc).",
                    style = Melyviz.small)
                Text(if (rec != null) "⏺ " + Camera2.duration(elapsed) else "—", style = Melyviz.title.copy(fontSize = 28.sp,
                    color = if (rec != null) Color(0xFFD64545) else Melyviz.faint), modifier = Modifier.padding(vertical = 10.dp))
                error?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.coral)) }
            }
        },
        confirmButton = {
            if (rec == null) TextButton({
                if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) start()
                else ask.launch(Manifest.permission.RECORD_AUDIO)
            }) { Text("⏺ Felvétel", color = Color(0xFFD64545)) }
            else TextButton({ release(true); close() }) { Text("■ Kész", color = Melyviz.glow) }
        },
        dismissButton = { TextButton({ release(false); close() }) { Text("Mégse", color = Melyviz.muted) } },
    )
}

/** A sound note: play / stop, its room and caption, delete. */
@Composable
internal fun AudioViewer(st: EditorState, c: Capture, close: () -> Unit) {
    val dir = st.photoDir ?: return close()
    val f = File(dir, c.file)
    var player by remember { mutableStateOf<MediaPlayer?>(null) }
    var note by remember(c.note) { mutableStateOf(c.note) }
    fun stop() { player?.let { p -> try { p.stop() } catch (e: Exception) { }; p.release() }; player = null }
    DisposableEffect(c.id) { onDispose { stop() } }
    LaunchedEffect(note) { delay(600); if (note != st.sketch.capture(c.id)?.note) st.editCapture(c.id) { it.copy(note = note) } }
    AlertDialog(
        onDismissRequest = { stop(); close() }, containerColor = Melyviz.raised,
        title = { Text("🎙 Hangjegyzet · " + Camera2.duration(c.durationMs), style = Melyviz.label.copy(color = st.frontColor("jegyzet"))) },
        text = {
            Column {
                Text(stamp(c.at), style = Melyviz.readout)
                if (!f.exists()) Text("A fájl nincs meg.", style = Melyviz.small.copy(color = Melyviz.coral))
                else Row(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Pill(if (player == null) "▶ Lejátszás" else "■ Állj", st.frontColor("jegyzet"), player != null) {
                        if (player != null) stop()
                        else try {
                            player = MediaPlayer().apply { setDataSource(f.path); setOnCompletionListener { stop() }; prepare(); start() }
                        } catch (e: Exception) { stop(); st.note = "A hangfájl nem játszható le." }
                    }
                }
                Field(note, { note = it }, "Miről szól? (a PC-n így látszik)", lines = 2)
                Text("Fájlnév a PC-n: " + Intake.exportName(st.sketch, c), style = Melyviz.small.copy(fontSize = 10.sp, color = Melyviz.faint))
            }
        },
        confirmButton = { TextButton({ stop(); close() }) { Text("Kész", color = Melyviz.glow) } },
        dismissButton = { TextButton({ stop(); st.deleteCapture(c.id); close() }) { Text("Törlés", color = Melyviz.coral) } },
    )
}

/** The Kamera front's list of sound notes (nothing when there is none). */
@Composable
internal fun AudioList(st: EditorState) {
    val list = AudioNotes.list(st.sketch)
    if (list.isEmpty()) return
    Text("🎙 Hangjegyzetek (${list.size})", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 12.dp, bottom = 4.dp))
    list.forEach { c ->
        Text("▶ " + AudioNotes.line(st.sketch, c), style = Melyviz.label.copy(fontSize = 13.sp),
            modifier = Modifier.clickable { st.ask = Ask.CaptureView(c.id) }.padding(vertical = 5.dp))
    }
}
