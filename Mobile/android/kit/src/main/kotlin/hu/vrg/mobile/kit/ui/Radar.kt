package hu.vrg.mobile.kit.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.vrg.mobile.core.BearingSource
import hu.vrg.mobile.core.Placed
import hu.vrg.mobile.core.Radar
import hu.vrg.mobile.core.RadarFrame
import hu.vrg.mobile.core.RadarHub
import hu.vrg.mobile.core.RadarLayout
import hu.vrg.mobile.core.RadarMode
import hu.vrg.mobile.core.RadarText
import hu.vrg.mobile.core.RadarTone
import hu.vrg.mobile.kit.Compass
import hu.vrg.mobile.kit.theme.Melyviz
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.delay
import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

// VrgRadar (WP M66): the radar as one Compose part, for the Radar feature and for any feature that wants its own layer
// on a radar (Tárgykereső's Környék, Csipogó's Közelség). The layout is kit-core Radar.layout — the same rule as the UI
// Kit's components/radar.js on the Desktop — so a frame looks the same on the phone and on the PC. Drawing only here.
//
// Conventions (docs/radar/README.md): tones from Mélyvíz, "you" in the middle, the sweep warm; a filled dot has a
// direction (compass, GPS, Irány keresése), a hollow dashed one only a distance; mine has a ring, an alert pulses, a
// chevron says closer (toward the middle) or away. Labels sit on a dark plate (stroked text drew as blocks on some
// phones, Gömb 2026-11-19) and flip to the left when they would leave the circle.

fun radarTone(t: RadarTone): Color = when (t) {
    RadarTone.GLOW -> Melyviz.glow
    RadarTone.CURRENT -> Melyviz.current
    RadarTone.SAND -> Melyviz.sand
    RadarTone.CORAL -> Melyviz.coral
    RadarTone.KELP -> Melyviz.kelp
    RadarTone.MUTED -> Melyviz.muted
}

/**
 * The radar. [hidden] layers are left out; [sweeps] are compass bearings found by turning round (RadarHub.sweeps);
 * [selected] gets the glow ring; a tap selects (null = empty space). [legend] draws the layer chips below, which call
 * [onToggleLayer].
 */
@Composable
fun VrgRadar(
    frame: RadarFrame,
    modifier: Modifier = Modifier,
    hidden: Set<String> = emptySet(),
    sweeps: Map<String, Double> = emptyMap(),
    selected: String? = null,
    onSelect: (String?) -> Unit = {},
    legend: Boolean = true,
    onToggleLayer: (String) -> Unit = {},
) {
    val layout = remember(frame, hidden, sweeps) { Radar.layout(frame, hidden, sweeps) }
    val still = animationsOff()
    val sweepAngle = if (still) 300f else rememberInfiniteTransition(label = "radar").animateFloat(
        0f, 360f, infiniteRepeatable(tween(4000, easing = LinearEasing), RepeatMode.Restart), label = "sweep").value
    val pulse = if (still) 0.5f else rememberInfiniteTransition(label = "pulse").animateFloat(
        0f, 1f, infiniteRepeatable(tween(1200, easing = LinearEasing), RepeatMode.Restart), label = "pulse").value
    val measurer = rememberTextMeasurer()
    val label = TextStyle(fontSize = 11.sp, fontFamily = FontFamily.Monospace)
    val small = TextStyle(fontSize = 9.sp, fontFamily = FontFamily.Monospace)
    val north = TextStyle(fontSize = 12.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
    val tones = frame.layers.associate { it.id to it }
    val dirless = layout.placed.count { it.bearingSrc == BearingSource.NONE }
    val caption = (if (frame.mode == RadarMode.HEADING_UP && frame.headingDeg != null) "IRÁNY FEL" else "ÉSZAK FEL") +
        " // ${RadarText.ring(layout.rangeM).uppercase()} // ${layout.placed.size} PONT" + if (dirless > 0) " ($dirless IRÁNY NÉLKÜL)" else ""

    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Canvas(
            Modifier.fillMaxWidth().aspectRatio(1f)
                .semantics { contentDescription = "Radar: $caption" }
                .pointerInput(layout) {
                    detectTapGestures { o ->
                        val r = min(size.width, size.height) / 2f * 0.92f
                        val cx = size.width / 2f; val cy = size.height / 2f
                        val hit = Radar.hit(layout, ((o.x - cx) / r).toDouble(), ((o.y - cy) / r).toDouble(), maxDist = 0.1)
                        onSelect(hit?.blip?.id)
                    }
                },
        ) {
            val r = min(size.width, size.height) / 2f * 0.92f
            val c = Offset(size.width / 2f, size.height / 2f)
            fun at(x: Double, y: Double) = Offset(c.x + (x * r).toFloat(), c.y + (y * r).toFloat())
            val hair = 1.dp.toPx()

            // ground and grid
            drawCircle(Melyviz.abyss, r * 1.06f, c)
            drawCircle(Melyviz.line, r, c, style = Stroke(hair * 1.5f))
            for ((m, rr) in layout.rings) {
                drawCircle(Melyviz.lineSoft, (rr * r).toFloat(), c, style = Stroke(hair))
                val t = measurer.measure(RadarText.ring(m), small)
                val p = at(-0.707 * rr, 0.707 * rr)
                drawText(t, Melyviz.faint, Offset(p.x - t.size.width - 3 * hair, p.y - t.size.height))
            }
            drawCircle(Melyviz.lineSoft, (Radar.UNKNOWN_R * r).toFloat(), c,
                style = Stroke(hair, pathEffect = PathEffect.dashPathEffect(floatArrayOf(6 * hair, 6 * hair))))
            drawLine(Melyviz.lineSoft, Offset(c.x - r, c.y), Offset(c.x + r, c.y), hair)
            drawLine(Melyviz.lineSoft, Offset(c.x, c.y - r), Offset(c.x, c.y + r), hair)
            val na = Radar.norm(-layout.rotationDeg) * PI / 180
            val nt = measurer.measure("É", north)
            val np = at(1.03 * sin(na), -1.03 * cos(na))
            drawText(nt, Melyviz.glow, Offset(np.x - nt.size.width / 2f, np.y - nt.size.height / 2f))

            // the sweep: a warm wedge trailing the beam
            val beam = (sweepAngle - 90f)
            drawArc(Melyviz.sand.copy(alpha = 0.10f), beam - 30f, 30f, true, Offset(c.x - r, c.y - r), Size(2 * r, 2 * r))
            val ba = (sweepAngle * PI / 180)
            drawLine(Melyviz.sand.copy(alpha = 0.55f), c, at(sin(ba), -cos(ba)), hair * 1.5f)

            // blips
            for (p in layout.placed) {
                val tone = radarTone(tones[p.blip.layer]?.tone ?: RadarTone.MUTED)
                drawBlip(p, at(p.x, p.y), tone, hair, pulse, p.blip.id == selected)
            }
            for (p in layout.placed) {
                val glyph = tones[p.blip.layer]?.glyph?.takeIf { it.isNotBlank() }
                val text = (if (glyph != null) "$glyph " else "") + p.blip.label
                val t = measurer.measure(text, label)
                val w = (t.size.width / r).toDouble() + 0.07
                val flip = (p.x + w) * (p.x + w) + p.y * p.y > 1.0 && (p.x - w) * (p.x - w) + p.y * p.y <= (p.x + w) * (p.x + w) + p.y * p.y
                val q = at(p.x, p.y)
                val left = if (flip) q.x - 0.05f * r - t.size.width else q.x + 0.05f * r
                val top = q.y - t.size.height / 2f
                val a = p.alpha.toFloat()
                drawRoundRect(Melyviz.abyss.copy(alpha = 0.78f * a), Offset(left - 3 * hair, top), Size(t.size.width + 6 * hair, t.size.height.toFloat()), CornerRadius(4 * hair))
                drawText(t, if (p.blip.id == selected) Melyviz.glow else Melyviz.ink, Offset(left, top), alpha = a)
            }

            // you
            drawCircle(Melyviz.current, 5 * hair, c)
            drawCircle(Melyviz.abyss, 5 * hair, c, style = Stroke(hair * 1.5f))
        }
        Text(caption, style = Melyviz.readout, modifier = Modifier.padding(top = 4.dp))
        if (legend && frame.layers.isNotEmpty()) {
            val counts = frame.blips.groupingBy { it.layer }.eachCount()
            Row(Modifier.padding(top = 6.dp).horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                frame.layers.forEach { l ->
                    VrgChip("${l.glyph} ${l.title} ${counts[l.id] ?: 0}", selected = l.id !in hidden) { onToggleLayer(l.id) }
                }
            }
        }
    }
}

private fun DrawScope.drawBlip(p: Placed, at: Offset, tone: Color, hair: Float, pulse: Float, selected: Boolean) {
    val a = p.alpha.toFloat()
    val dot = 7 * hair
    if (p.blip.alert) {
        drawCircle(Melyviz.coral.copy(alpha = (1f - pulse) * a), dot * (1.4f + 1.6f * pulse), at, style = Stroke(hair * 2))
    }
    if (p.blip.mine) drawCircle(tone.copy(alpha = a), dot * 1.7f, at, style = Stroke(hair * 1.6f))
    if (p.bearingSrc == BearingSource.NONE) {
        drawCircle(Melyviz.abyss.copy(alpha = a), dot, at)
        drawCircle(tone.copy(alpha = a), dot, at,
            style = Stroke(hair * 2.4f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(5 * hair, 3 * hair))))
    } else {
        drawCircle(tone.copy(alpha = a), dot, at)
    }
    if (p.blip.linked) drawCircle(Melyviz.ink.copy(alpha = a), 2 * hair, at)
    if (selected) drawCircle(Melyviz.glow, dot + 3 * hair, at, style = Stroke(hair * 2.5f))
    if (p.blip.trend != 0) {
        // a chevron toward the middle (closer) or away from it
        val ang = atan2(-p.y, -p.x) + if (p.blip.trend > 0) 0.0 else PI
        val cs = cos(ang).toFloat(); val sn = sin(ang).toFloat()
        val tip = Offset(at.x + cs * dot * 2.2f, at.y + sn * dot * 2.2f)
        val base = Offset(at.x + cs * dot * 1.45f, at.y + sn * dot * 1.45f)
        val side = Offset(-sn * dot * 0.6f, cs * dot * 0.6f)
        val path = Path().apply { moveTo(base.x + side.x, base.y + side.y); lineTo(tip.x, tip.y); lineTo(base.x - side.x, base.y - side.y) }
        drawPath(path, tone.copy(alpha = a), style = Stroke(hair * 2f, cap = StrokeCap.Round))
    }
}

/**
 * A feature's own radar (Tárgykereső's Környék, Csipogó's Közelség): only its [layers] from RadarHub, with the compass,
 * the kept sweep bearings and a tap that selects; [onFull] adds "Teljes radar" (the Radar feature with every layer).
 * The feature keeps its own scanner running; this one only reads.
 */
@Composable
fun VrgHubRadar(layers: Set<String>, modifier: Modifier = Modifier, onFull: (() -> Unit)? = null, onSelect: (String?) -> Unit = {}) {
    val ctx = LocalContext.current
    var frame by remember { mutableStateOf(RadarFrame(emptyList(), emptyList())) }
    var sweeps by remember { mutableStateOf(emptyMap<String, Double>()) }
    var selected by remember { mutableStateOf<String?>(null) }
    DisposableEffect(Unit) { Compass.start(ctx); onDispose { Compass.stop() } }
    LaunchedEffect(layers) {
        while (true) {
            val now = System.currentTimeMillis()
            frame = RadarHub.frame(now, Compass.heading.value, null, RadarMode.HEADING_UP, only = layers)
            sweeps = RadarHub.sweeps(now)
            delay(400)
        }
    }
    Column(modifier) {
        VrgRadar(frame, Modifier.fillMaxWidth(), sweeps = sweeps, selected = selected, legend = false,
            onSelect = { selected = it; onSelect(it) })
        val p = Radar.layout(frame, emptySet(), sweeps).find(selected)
        p?.let { Text(radarDescribe(it, frame.layers.firstOrNull { l -> l.id == it.blip.layer }?.title), style = Melyviz.readout) }
        onFull?.let { f -> Row(Modifier.padding(top = 4.dp)) { VrgChip("◎ Teljes radar") { f() } } }
    }
}

/** The text for a selected blip's card: where it is and how it is known. */
fun radarDescribe(p: Placed, layerTitle: String?): String = buildString {
    append(p.blip.label)
    layerTitle?.let { append(" · ").append(it) }
    append(" · ").append(RadarText.distance(p.distanceM))
    val bearing = p.bearingDeg                  // a local copy: no smart cast across modules
    if (p.bearingSrc != BearingSource.NONE && bearing != null) {
        append(" · ").append(RadarText.relative(p.angleDeg)).append(" (").append(RadarText.compass(bearing))
            .append(", ").append(p.bearingSrc.hu).append(')')
    } else append(" · irány nélkül")
    p.blip.detail?.let { append(" · ").append(it) }
}

/** Looks a blip up in a layout (for the card under a radar). */
fun RadarLayout.find(id: String?): Placed? = placed.firstOrNull { it.blip.id == id }
