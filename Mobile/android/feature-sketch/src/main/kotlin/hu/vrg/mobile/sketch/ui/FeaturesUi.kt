package hu.vrg.mobile.sketch.ui

import android.content.Context
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.sketch.Features
import hu.vrg.mobile.sketch.Tools

// WP M51 (D-91…D-99): the Sketcher's feature switches on the phone. One setting per phone, never per survey. The state
// lives in three stores so nothing an earlier app saved moves (D-96): F3's camera set ("sketcher-camera" / off, the
// CameraFeatures ids), D-79's boolean (SketcherKit, "sketcher" / takeoff.impliedDedicated) and the new general set
// ("sketcher-features" / flipped). The registry itself is pure (sketch-core Features.kt); this file only keeps the
// state, follows it in the editor (FeatureSync) and draws ⚙ → Funkciók (FeatureSheet).

internal object FeaturePrefs {
    private const val PREFS = "sketcher-features"
    private const val KEY = "flipped"
    private var ctx: Context? = null
    private var general by mutableStateOf<Set<String>>(emptySet())
    private var camOff by mutableStateOf<Set<String>>(emptySet())

    /** The ids that differ from their default, read live from the three stores (the D-79 toggle included). */
    val flipped: Set<String> get() = Features.fromStores(Features.Stores(camOff, SketcherKit.impliedDedicated, general))

    fun init(c: Context) {
        val app = c.applicationContext
        ctx = app
        general = Features.read(app.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, ""))
        camOff = CameraPrefs.off(app)
    }

    fun on(id: String) = Features.on(flipped, id)

    fun apply(next: Set<String>) {
        val s = Features.toStores(next)
        general = s.general; camOff = s.cameraOff
        if (s.implied != SketcherKit.impliedDedicated) SketcherKit.switchImpliedDedicated(s.implied)
        ctx?.let { c ->
            c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, Features.write(s.general)).apply()
            CameraPrefs.save(c, s.cameraOff)
        }
    }
}

/** Is the feature on, on this phone? Every place that shows a feature asks this (D-93: off leaves no trace). */
internal fun feat(id: String) = FeaturePrefs.on(id)

/** The fronts the front bar shows: the kit's, without those whose every feature is off (D-97). */
internal fun EditorState.shownFronts() = fronts().let { all -> Features.visibleFronts(FeaturePrefs.flipped, all.map { it.id }).let { v -> all.filter { it.id in v } } }

/** Keeps the editor in step with the switches: Kamera 2's off-set, a hidden front, a tool that left the rail. */
@Composable
internal fun FeatureSync(st: EditorState) {
    val fl = FeaturePrefs.flipped
    LaunchedEffect(fl) {
        st.cam2.off = Features.cameraOff(fl)
        st.cam2.saveOff = { o -> FeaturePrefs.apply(Features.withCameraOff(FeaturePrefs.flipped, o)) }
        if (st.shownFronts().none { it.id == st.front }) st.front = "vazlat"
        if (st.tool !in st.rail) st.pick(Tools.SELECT)
    }
}

/** ⚙ → Funkciók: every feature by front, its symbol, 1–3 words and a switch; Mind per front and for everything. */
@Composable
internal fun FeatureSheet(st: EditorState, first: String?, close: () -> Unit) {
    val fl = FeaturePrefs.flipped
    AlertDialog(
        onDismissRequest = close, containerColor = Melyviz.raised,
        title = { Text("⚙ Funkciók", style = Melyviz.label) },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState())) {
                Text("Ezen a telefonon, minden felmérésre. Ami ki van kapcsolva, eltűnik; az adat megmarad.", style = Melyviz.small.copy(color = Melyviz.faint))
                SwitchRow("✱", "Mind", Melyviz.ink, Features.allOn(fl), enabled = true, bold = true) { FeaturePrefs.apply(Features.all(fl, it)) }
                val order = Features.FRONTS.sortedBy { if (it.id == first) 0 else 1 }
                order.forEach { fr ->
                    val col = Color(fr.color)
                    Row(Modifier.fillMaxWidth().padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(fr.sym, style = Melyviz.glyph.copy(fontSize = 17.sp, color = col), modifier = Modifier.width(28.dp))
                        Text(fr.label, style = Melyviz.label.copy(color = col), modifier = Modifier.weight(1f))
                        VSwitch(Features.allOn(fl, fr.id), true) { FeaturePrefs.apply(Features.all(fl, it, fr.id)) }
                    }
                    Features.inFront(fr.id).forEach { f ->
                        val block = Features.blockedBy(fl, f.id)
                        SwitchRow(f.sym, f.label + (block?.let { " · előbb: " + it.label } ?: ""), f.color?.let { Color(it) } ?: col,
                            Features.on(fl, f.id), enabled = !f.locked && block == null, dim = block != null) { FeaturePrefs.apply(Features.set(fl, f.id, it)) }
                    }
                }
            }
        },
        confirmButton = { TextButton(close) { Text("Kész", color = Melyviz.glow) } },
    )
}

@Composable
private fun SwitchRow(sym: String, label: String, col: Color, value: Boolean, enabled: Boolean, dim: Boolean = false, bold: Boolean = false, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().alpha(if (dim) 0.45f else 1f).clickable(enabled = enabled) { onChange(!value) }.padding(vertical = 1.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(sym, style = Melyviz.glyph.copy(fontSize = 14.sp, color = col), modifier = Modifier.width(28.dp))
        Text(label, style = (if (bold) Melyviz.label else Melyviz.small).copy(fontSize = 13.sp), modifier = Modifier.weight(1f))
        VSwitch(value, enabled, onChange)
    }
}

@Composable
private fun VSwitch(value: Boolean, enabled: Boolean, onChange: (Boolean) -> Unit) =
    Switch(value, onChange, enabled = enabled, colors = SwitchDefaults.colors(
        checkedThumbColor = Melyviz.onGlow, checkedTrackColor = Melyviz.glow,
        uncheckedThumbColor = Melyviz.muted, uncheckedTrackColor = Melyviz.surface, uncheckedBorderColor = Melyviz.line,
    ))

/** A loose end is listed only while the feature it belongs to is on (D-93). */
internal fun openShown(o: hu.vrg.mobile.sketch.FieldKit.Open): Boolean = Features.openShown(FeaturePrefs.flipped, o.kind, o.front)
