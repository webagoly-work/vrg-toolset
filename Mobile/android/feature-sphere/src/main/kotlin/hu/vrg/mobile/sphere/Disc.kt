package hu.vrg.mobile.sphere

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.vrg.mobile.core.Signal
import hu.vrg.mobile.core.SignalType
import hu.vrg.mobile.core.Sphere
import hu.vrg.mobile.core.SphereDoc
import hu.vrg.mobile.core.SphereMap
import hu.vrg.mobile.core.Turn
import hu.vrg.mobile.core.Vec
import hu.vrg.mobile.kit.theme.Melyviz
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

// The disc, drawn like Solomon/src/index.html: ambient dots, the documents, the arcs of the clashes and the
// island names. A drag that starts inside it turns the sphere and is consumed here, so the pager never sees
// it; one that starts outside is left alone and swipes the page. Sizes are the web page's, in dp.

/** Where the sphere stands. Plain fields: only drawing reads them, and each frame draws anyway. */
internal class Spin(private val still: Boolean) {
    var yaw = .6
    var pitch = -.25
    var dragging = false
    private var aim: Pair<Double, Double>? = null
    var x = FloatArray(0); var y = FloatArray(0); var z = FloatArray(0)

    fun aimAt(p: Vec) { aim = Sphere.focus(p) }
    fun release() { aim = null }

    fun fit(n: Int) {
        if (x.size != n) { x = FloatArray(n); y = FloatArray(n); z = FloatArray(n) }
    }

    fun step(dt: Double, idle: Boolean) {
        val f = aim
        if (f != null) {
            val dy = (f.first - yaw + PI * 3).mod(PI * 2) - PI
            yaw += dy * min(1.0, dt * 5)
            pitch += (f.second - pitch) * min(1.0, dt * 5)
            if (abs(dy) < .004 && abs(f.second - pitch) < .004) aim = null
        } else if (!dragging && idle && !still) yaw += .07 * dt
    }
}

private val LABEL = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.SemiBold)

@Composable
internal fun Disc(map: SphereMap, spin: Spin, still: Boolean, selected: SphereDoc?, layer: SignalType?, onPick: (SphereDoc?) -> Unit, modifier: Modifier) {
    var frame by remember { mutableLongStateOf(0L) }
    val idle = selected == null
    val pick by rememberUpdatedState(onPick)
    val now by rememberUpdatedState(map)
    val calm by rememberUpdatedState(idle)
    LaunchedEffect(spin) {
        var last = 0L
        while (true) withFrameNanos { ns ->
            spin.step(if (last == 0L) 0.0 else min(.05, (ns - last) / 1e9), calm)
            last = ns
            frame = ns
        }
    }

    val measurer = rememberTextMeasurer()
    val labels = remember(map) { map.sections.map { measurer.measure(it.name.uppercase(), LABEL) } }
    val glow = Melyviz.glow; val recent = Melyviz.current; val coral = Melyviz.coral
    val sand = Melyviz.sand; val muted = Melyviz.muted; val abyss = Melyviz.abyss

    Canvas(modifier.pointerInput(spin) {
        awaitEachGesture {
            val down = awaitFirstDown(requireUnconsumed = false)
            val r = min(size.width, size.height) * .47f
            val inside = hypot(down.position.x - size.width / 2f, down.position.y - size.height / 2f) <= r + 14.dp.toPx()
            if (!inside) return@awaitEachGesture
            down.consume()
            spin.dragging = true
            spin.release()
            var moved = 0f
            var at = down.position
            while (true) {
                val c = awaitPointerEvent().changes.firstOrNull { it.id == down.id } ?: break
                c.consume()
                if (!c.pressed) break
                val d = c.position - at
                at = c.position
                moved += abs(d.x) + abs(d.y)
                spin.yaw += d.x / r
                spin.pitch = Sphere.pitched(spin.pitch, (d.y / r).toDouble())
            }
            spin.dragging = false
            if (moved < 7.dp.toPx()) pick(pickAt(now, spin, at, density))
        }
    }) {
        val t = frame / 1e9
        val u = density
        val r = min(size.width, size.height) * .47f
        val cx = size.width / 2; val cy = size.height / 2
        val turn = Turn(spin.yaw, spin.pitch)
        spin.fit(map.docs.size)

        drawCircle(glow, r, Offset(cx, cy), alpha = .16f, style = Stroke(u))
        val speck = Size(1.4f * u, 1.4f * u)
        for (p in Sphere.ambient) turn.see(p) { x, y, z ->
            drawRect(glow, Offset(cx + r * x.toFloat(), cy - r * y.toFloat()), speck, alpha = (if (z > 0) .1 + .16 * z else .05).toFloat())
        }

        val pulse = if (still) .5f else (.5 + .5 * sin(t * 2.6)).toFloat()
        val ring = Stroke(1.2f * u)
        val dotted = Stroke(1.1f * u, pathEffect = PathEffect.dashPathEffect(floatArrayOf(1.2f * u, 2.2f * u)))
        map.docs.forEachIndexed { i, d ->
            turn.see(d.pos) { x, y, z ->
                spin.x[i] = cx + r * x.toFloat(); spin.y[i] = cy - r * y.toFloat(); spin.z[i] = z.toFloat()
            }
            val at = Offset(spin.x[i], spin.y[i])
            val depth = .2f + .8f * (spin.z[i] + 1) / 2
            val faint = if (d.shows(layer)) 1f else .22f
            when (d.rank) {
                4 -> {
                    drawCircle(coral, (6 + 5 * pulse) * u, at, alpha = depth * (.2f + .25f * pulse) * faint)
                    drawCircle(coral, 3.4f * u, at, alpha = depth * faint)
                }
                3 -> drawCircle(coral, 3.6f * u, at, alpha = depth * .75f * faint, style = ring)
                2 -> drawCircle(sand, 3.4f * u, at, alpha = depth * .9f * faint, style = ring)
                1 -> drawCircle(muted, 3.6f * u, at, alpha = depth * .8f * faint, style = dotted)
                else -> drawCircle(if (d.recent) recent else glow, (1.6f + min(1.8f, d.cited * .25f)) * u, at,
                    alpha = depth * (if (d.recent) 1f else .8f) * faint)
            }
            if (d.path == selected?.path) drawCircle(glow, 9 * u, at, style = Stroke(1.4f * u))
        }

        if (layer == null || layer == SignalType.CONTRADICTION) {
            for (s in map.arcs) arc(map.docs[s.ai!!].pos, map.docs[s.bi!!].pos, s, turn, r, cx, cy, coral)
        }

        // Island names on the near side only; a label that would touch a nearer one is left out.
        val placed = ArrayList<FloatArray>()
        map.sections.indices.map { i -> i to turn.see(map.sections[i].center) { x, y, z -> Triple(x.toFloat(), y.toFloat(), z.toFloat()) } }
            .sortedByDescending { it.second.third }
            .forEach { (i, q) ->
                if (q.third < .2f) return@forEach
                val text = labels[i]
                val w = text.size.width + 10 * u; val h = 16 * u
                val box = floatArrayOf(cx + r * q.first - w / 2, cy - r * q.second - h / 2, w, h)
                if (placed.any { box[0] < it[0] + it[2] && box[0] + box[2] > it[0] && box[1] < it[1] + it[3] && box[1] + box[3] > it[1] }) return@forEach
                placed.add(box)
                val at = Offset(cx + r * q.first - text.size.width / 2f, cy - r * q.second - text.size.height / 2f)
                val a = min(1f, (q.third - .2f) * 3)
                drawText(text, abyss, at, alpha = a, drawStyle = Stroke(3.5f * u))
                drawText(text, muted, at, alpha = a)
            }
    }
}

/** A great circle lifted off the surface. A confirmed clash is a solid line, a candidate a broken one. */
private fun DrawScope.arc(a: Vec, b: Vec, s: Signal, turn: Turn, r: Float, cx: Float, cy: Float, coral: Color) {
    val ang = acos(a.dot(b).coerceIn(-1.0, 1.0))
    val sn = sin(ang).let { if (it == 0.0) 1.0 else it }
    val red = s.stage == "confirmed"
    val wide = (if (red) 1.3f else .7f) * density
    var px = 0f; var py = 0f
    for (i in 0..36) {
        val u = i / 36.0
        val lift = 1 + .14 * sin(PI * u)
        val p = (a * (sin((1 - u) * ang) / sn) + b * (sin(u * ang) / sn)) * lift
        turn.see(p) { x, y, z ->
            val qx = cx + r * x.toFloat(); val qy = cy - r * y.toFloat()
            if (i > 0 && (red || i % 2 == 0)) {
                drawLine(coral, Offset(px, py), Offset(qx, qy), wide, alpha = (if (red) .9f else .3f) * max(.12f, ((z + 1) / 2).toFloat()))
            }
            px = qx; py = qy
        }
    }
}

/** The nearest dot on the near side; a dot with a signal is easier to hit. */
private fun pickAt(map: SphereMap, spin: Spin, at: Offset, density: Float): SphereDoc? {
    if (spin.x.size != map.docs.size) return null
    var best: SphereDoc? = null
    var bestD = Float.MAX_VALUE
    map.docs.forEachIndexed { i, d ->
        if (spin.z[i] < 0) return@forEachIndexed
        val dx = spin.x[i] - at.x; val dy = spin.y[i] - at.y
        val far = sqrt(dx * dx + dy * dy)
        val reach = (if (d.rank > 0) 22 else 10) * density
        val score = far - d.rank * 2 * density
        if (far < reach && score < bestD) { bestD = score; best = d }
    }
    return best
}
