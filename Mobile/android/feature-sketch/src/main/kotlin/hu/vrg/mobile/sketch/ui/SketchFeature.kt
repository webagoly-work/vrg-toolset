package hu.vrg.mobile.sketch.ui

import android.app.Application
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.ui.VrgSectionTitle
import hu.vrg.mobile.sketch.Sketch
import hu.vrg.mobile.sketch.SketchJson
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// Vázlat (WP M24): the field sketch. The list of sketches kept on the phone, and the editor (SketchEditor.kt). Every
// sketch is one file in the app's own storage (files/sketch/<id>.vsketch.json), written a moment after each edit, so
// a sketch survives the app being closed in the middle of a room. Nothing leaves the phone until the user exports it
// from Rendezés (NormScreen.kt): a share (Átadás "PC-re", mail…) or a copy into Letöltések / VRG Vázlat.

object SketchFeature : VrgFeature {
    override val info = Catalogue.SKETCH
    private lateinit var app: Application
    internal val store by lazy { SketchStore(File(app.filesDir, "sketch")) }

    override fun init(app: Application) { this.app = app }

    @Composable
    override fun Screen(host: FeatureHost) {
        var openId by rememberSaveable { mutableStateOf<String?>(null) }
        val id = openId
        if (id == null) {
            SketchList(host) { openId = it }
            return
        }
        val sketch = remember(id) { store.load(id) }
        if (sketch == null) {
            LaunchedEffect(id) { host.note("A vázlat nem nyitható meg."); openId = null }
            return
        }
        SketchEditor(sketch, host, onClose = { openId = null })
    }
}

/**
 * Fotópont (WP M25) is a plugin of the Vázlat, not a screen of its own: its home tile says how to reach it and opens
 * the Vázlat. The plugin is switched on per sketch under ⚙.
 */
object PhotoFeature : VrgFeature {
    override val info = Catalogue.PHOTO

    @Composable
    override fun Screen(host: FeatureHost) {
        Column(Modifier.fillMaxSize().background(Melyviz.water).padding(Melyviz.gutter)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current), modifier = Modifier.clickable { host.home() }.padding(end = 12.dp))
                Text("FOTÓPONT", style = Melyviz.title.copy(fontSize = 18.sp))
            }
            Text(
                "A Vázlat bővítménye. Egy vázlatban: ⚙ → Fotópont be. A ◉ eszközzel koppints a szoba közepére, majd a " +
                    "pontra: megnyílik a kamera. A fotó után húzz a pontból arra, amerre a kép néz (É, K, D, Ny a vázlaton). " +
                    "Szobánként négy fotó; a pont négy cikke mutatja, mi van meg. A kész fotó a cikkére koppintva nézhető meg.",
                style = Melyviz.small, modifier = Modifier.padding(top = 8.dp),
            )
            Row(Modifier.padding(top = 14.dp)) { VrgChip("Vázlat megnyitása ›", selected = true) { host.open(Catalogue.SKETCH.id) } }
        }
    }
}

/** The sketches on the phone: one JSON file each, written through a temp file so a crash never leaves half a file. */
class SketchStore(private val dir: File) {
    data class Entry(val id: String, val name: String, val updated: Long, val rooms: Int, val points: Int, val measures: Int)

    private fun file(id: String) = File(dir, "$id.vsketch.json")

    fun list(): List<Entry> = (dir.listFiles { f -> f.name.endsWith(".vsketch.json") } ?: emptyArray())
        .mapNotNull { f -> try { SketchJson.read(f.readText()) } catch (e: Exception) { null } }
        .map { Entry(it.id, it.name, it.updated, it.rooms.size, it.points.size, it.measures.size) }
        .sortedByDescending { it.updated }

    fun load(id: String): Sketch? = file(id).takeIf { it.exists() }?.let { f ->
        try { SketchJson.read(f.readText()) } catch (e: Exception) { null }
    }

    fun save(s: Sketch) {
        try {
            dir.mkdirs()
            val tmp = File(dir, s.id + ".tmp")
            tmp.writeText(SketchJson.write(s).toString())
            if (!tmp.renameTo(file(s.id))) { file(s.id).writeText(tmp.readText()); tmp.delete() }
        } catch (e: Exception) {
            VrgLog.w("sketch", "Mentés sikertelen: ${e.message}")
        }
    }

    /** Where a sketch's photos are kept (WP M25); the FileProvider shares this folder with the camera app. */
    fun photoDir(id: String) = File(dir, "photos/$id")

    fun delete(id: String) { file(id).delete(); photoDir(id).deleteRecursively() }

    fun create(name: String): Sketch {
        val now = System.currentTimeMillis()
        val s = Sketch(id = "v" + now.toString(36), name = name.trim(), created = now, updated = now)
        save(s)
        return s
    }
}

private val STAMP = SimpleDateFormat("yyyy.MM.dd HH:mm", Locale("hu"))
internal fun stamp(t: Long) = if (t <= 0) "" else STAMP.format(Date(t))

@Composable
private fun SketchList(host: FeatureHost, onOpen: (String) -> Unit) {
    val store = SketchFeature.store
    var tick by remember { mutableIntStateOf(0) }
    val entries = remember(tick) { store.list() }
    var naming by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf<SketchStore.Entry?>(null) }

    Column(Modifier.fillMaxSize().background(Melyviz.water).verticalScroll(rememberScrollState()).padding(Melyviz.gutter)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current), modifier = Modifier.clickable { host.home() }.padding(end = 12.dp))
            Text("VÁZLAT", style = Melyviz.title.copy(fontSize = 18.sp))
        }
        Text(
            "Helyszíni alaprajz: járd körbe a lakást, rajzold fel a szobákat, írd rá a méreteket, tedd le a szerelési " +
                "pontokat. A Rendezés a hiányzó méreteket kiszámolja vagy megbecsüli, és a Planner kész tervet nyit belőle.",
            style = Melyviz.small, modifier = Modifier.padding(top = 6.dp),
        )
        Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            VrgChip("＋ Új vázlat", selected = true) { naming = true }
        }
        VrgSectionTitle("A telefonon (${entries.size})")
        if (entries.isEmpty()) Text("Még nincs vázlat.", style = Melyviz.small)
        entries.forEach { e ->
            Row(
                Modifier.fillMaxWidth().padding(vertical = 4.dp).clip(RoundedCornerShape(Melyviz.radiusSmall))
                    .background(Melyviz.surface).border(1.dp, Melyviz.line, RoundedCornerShape(Melyviz.radiusSmall))
                    .clickable { onOpen(e.id) }.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(e.name.ifBlank { "Névtelen vázlat" }, style = Melyviz.label)
                    Text("${stamp(e.updated)} · ${e.rooms} szoba · ${e.points} pont · ${e.measures} méret", style = Melyviz.small)
                }
                Spacer(Modifier.width(8.dp))
                Text("✕", style = Melyviz.label.copy(color = Melyviz.coral), modifier = Modifier.clickable { deleting = e }.padding(8.dp))
            }
        }
    }

    if (naming) {
        TextDialog(
            title = "Új vázlat", label = "Cím vagy ügyfél (később is átírható)",
            initial = "Vázlat " + stamp(System.currentTimeMillis()),
            onDismiss = { naming = false },
        ) { name ->
            naming = false
            onOpen(store.create(name).id)
        }
    }
    deleting?.let { e ->
        AlertDialog(
            onDismissRequest = { deleting = null },
            containerColor = Melyviz.raised,
            title = { Text("Törlöd: ${e.name.ifBlank { "Névtelen vázlat" }}?", style = Melyviz.label) },
            text = { Text("A telefonról törlődik; ami már a PC-n van, az megmarad.", style = Melyviz.small) },
            confirmButton = { TextButton({ store.delete(e.id); deleting = null; tick++ }) { Text("Törlés", color = Melyviz.coral) } },
            dismissButton = { TextButton({ deleting = null }) { Text("Mégse", color = Melyviz.muted) } },
        )
    }
}
