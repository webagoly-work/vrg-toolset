package hu.vrg.legeger.ui

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.legeger.Deck
import hu.vrg.legeger.ShotStore
import hu.vrg.legeger.ui.theme.Melyviz
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

// 📸 — the screenshot that just arrived from the PC, ready to keep: save to the gallery, share to any
// app, take another, or pick an earlier one from the strip.

@Composable
fun ShotSheet(file: File?, onPick: (File) -> Unit, onClose: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val shots by Deck.shots.collectAsStateWithLifecycle()
    val pending by Deck.shotPending.collectAsStateWithLifecycle()
    var saved by remember(file) { mutableStateOf("") }

    DeepSheet(onClose) {
        Text("Képernyőkép", style = Melyviz.title)
        if (file == null || !file.exists()) {
            Text("Még nincs kép. A 📸 gomb kér egyet a PC-től (a relén át).", style = Melyviz.small, modifier = Modifier.padding(top = 8.dp))
            Row(Modifier.padding(top = 10.dp)) { Chip(if (pending) "Készül…" else "📸 Kép most", true) { Deck.screenshot() } }
            return@DeepSheet
        }
        val bmp by produceState<ImageBitmap?>(null, file) { value = withContext(Dispatchers.IO) { decode(file, 1600) } }
        Box(
            Modifier.fillMaxWidth().padding(top = 10.dp).heightIn(min = 120.dp, max = 420.dp)
                .clip(RoundedCornerShape(Melyviz.radius)).background(Melyviz.abyss).border(1.dp, Melyviz.line, RoundedCornerShape(Melyviz.radius)),
            contentAlignment = Alignment.Center,
        ) {
            bmp?.let { Image(it, contentDescription = file.name, contentScale = ContentScale.Fit, modifier = Modifier.fillMaxWidth()) }
                ?: Text("betöltés…", style = Melyviz.small)
        }
        Text("${file.name} · ${file.length() / 1024} KB", style = Melyviz.readout, modifier = Modifier.padding(top = 6.dp))

        Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Chip("⬇ Mentés a Galériába", true) {
                scope.launch { saved = ShotStore.saveToGallery(ctx, file)?.let { "Elmentve: $it" } ?: "A mentés nem sikerült." }
            }
            Chip("⇪ Megosztás", false) { ctx.startActivity(ShotStore.shareIntent(ctx, file)) }
        }
        Row(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Chip(if (pending) "Készül…" else "📸 Új kép", false) { Deck.screenshot() }
            Chip("✕ Törlés", false) {
                val next = shots.firstOrNull { it != file }
                Deck.deleteShot(file)
                if (next != null) onPick(next) else onClose()
            }
        }
        if (saved.isNotEmpty()) Text(saved, style = Melyviz.small.copy(color = Melyviz.kelp), modifier = Modifier.padding(top = 6.dp))

        if (shots.size > 1) {
            SectionTitle("Korábbiak")
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                shots.forEach { f -> Thumb(f, selected = f == file) { onPick(f) } }
            }
        }
    }
}

@Composable
private fun Thumb(f: File, selected: Boolean, onClick: () -> Unit) {
    val bmp by produceState<ImageBitmap?>(null, f) { value = withContext(Dispatchers.IO) { decode(f, 240) } }
    val shape = RoundedCornerShape(8.dp)
    Box(
        Modifier.size(96.dp, 64.dp).clip(shape).background(Melyviz.abyss)
            .border(if (selected) 2.dp else 1.dp, if (selected) Melyviz.glow else Melyviz.line, shape).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { bmp?.let { Image(it, contentDescription = f.name, contentScale = ContentScale.Crop, modifier = Modifier.size(96.dp, 64.dp)) } }
}

/** Decodes with a power-of-two sample size so a 4K desktop does not cost 30 MB of heap per preview. */
private fun decode(f: File, maxSide: Int): ImageBitmap? {
    val b = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(f.absolutePath, b)
    var sample = 1
    while (maxOf(b.outWidth, b.outHeight) / sample > maxSide) sample *= 2
    val o = BitmapFactory.Options().apply { inSampleSize = sample; inPreferredConfig = Bitmap.Config.ARGB_8888 }
    return BitmapFactory.decodeFile(f.absolutePath, o)?.asImageBitmap()
}
