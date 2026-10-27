package hu.vrg.legeger.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.PointerInputChange
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.vrg.legeger.Deck
import hu.vrg.legeger.core.WheelAccumulator
import hu.vrg.legeger.ui.theme.Melyviz
import kotlin.math.hypot

/** A tile of the deck. `active` lights it in the accent colour. */
@Composable
fun DeckTile(
    glyph: String,
    label: String?,
    modifier: Modifier = Modifier,
    active: Boolean = false,
    accent: Color = Melyviz.glow,
    minHeight: Dp = 52.dp,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(Melyviz.radiusSmall)
    Column(
        modifier
            .heightIn(min = minHeight)
            .clip(shape)
            .background(if (active) accent else Melyviz.surface)
            .border(1.dp, if (active) accent else Melyviz.line, shape)
            .clickable(onClick = onClick)
            .padding(horizontal = 4.dp, vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(glyph, style = Melyviz.glyph.copy(color = if (active) Melyviz.onGlow else Melyviz.ink, fontSize = 17.sp),
            maxLines = 1, overflow = TextOverflow.Clip)
        if (label != null) Text(label, style = Melyviz.small.copy(color = if (active) Melyviz.onGlow else Melyviz.muted, fontSize = 10.sp),
            maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
    }
}

/** A button that reports press and release separately: the clutch, the mouse buttons, the scrub. */
@Composable
fun HoldTile(
    modifier: Modifier = Modifier,
    held: Boolean,
    accent: Color = Melyviz.glow,
    onPress: () -> Unit,
    onRelease: () -> Unit,
    content: @Composable () -> Unit,
) {
    val shape = RoundedCornerShape(Melyviz.radius)
    Box(
        modifier
            .clip(shape)
            .background(if (held) accent.copy(alpha = 0.9f) else Melyviz.raised)
            .border(1.dp, if (held) accent else Melyviz.line, shape)
            .pointerInput(Unit) {
                awaitEachGesture {
                    awaitFirstDown(requireUnconsumed = false)
                    onPress()
                    waitForUpOrCancellation()
                    onRelease()
                }
            },
        contentAlignment = Alignment.Center,
    ) { content() }
}

@Composable
fun StatusDot(color: Color, size: Dp = 9.dp) {
    Box(Modifier.size(size).clip(CircleShape).background(color))
}

@Composable
fun StatusPill(label: String, color: Color, onClick: () -> Unit) {
    val shape = RoundedCornerShape(50)
    Row(
        Modifier.clip(shape).background(Melyviz.surface).border(1.dp, Melyviz.lineSoft, shape)
            .clickable(onClick = onClick).padding(horizontal = 9.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        StatusDot(color)
        Spacer(Modifier.width(6.dp))
        Text(label, style = Melyviz.readout.copy(color = Melyviz.ink), maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
fun Chip(text: String, selected: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(50)
    Text(
        text,
        style = Melyviz.label.copy(color = if (selected) Melyviz.onGlow else Melyviz.ink, fontSize = 11.sp),
        modifier = Modifier.clip(shape).background(if (selected) Melyviz.glow else Melyviz.surface)
            .border(1.dp, if (selected) Melyviz.glow else Melyviz.line, shape)
            .clickable(onClick = onClick).padding(horizontal = 10.dp, vertical = 5.dp),
    )
}

/**
 * The pad. To the PC: one finger moves, tap clicks, two-finger tap right-clicks, two fingers scroll.
 * To the app (the old phone page's pad): one finger pans, pinch zooms, two fingers orbit, double tap resets.
 */
@Composable
fun Touchpad(toApp: Boolean, modifier: Modifier = Modifier) {
    var lastTap by remember { mutableLongStateOf(0L) }
    val wheel = remember { WheelAccumulator() }
    val dash = remember { PathEffect.dashPathEffect(floatArrayOf(14f, 10f)) }
    Box(
        modifier
            .clip(RoundedCornerShape(Melyviz.radius))
            .background(Melyviz.deep)
            .drawBehind {
                drawRoundRect(
                    color = if (toApp) Melyviz.current.copy(alpha = 0.6f) else Melyviz.line,
                    cornerRadius = CornerRadius(Melyviz.radius.toPx()),
                    style = Stroke(width = 1.5.dp.toPx(), pathEffect = dash),
                )
                // faint contour lines: depth soundings
                val step = 34.dp.toPx()
                var y = step
                while (y < size.height) {
                    drawLine(Melyviz.lineSoft.copy(alpha = 0.35f), Offset(18f, y), Offset(size.width - 18f, y), 1f)
                    y += step
                }
            }
            .pointerInput(toApp) {
                awaitEachGesture {
                    val first = awaitFirstDown(requireUnconsumed = false)
                    val t0 = first.uptimeMillis
                    var tEnd = t0
                    var maxFingers = 1
                    var travel = 0f
                    var prevC: Offset? = null
                    var prevSpan = 0f
                    var prevN = 0
                    wheel.reset()
                    while (true) {
                        val ev = awaitPointerEvent()
                        val down = ev.changes.filter { it.pressed }
                        ev.changes.forEach { tEnd = maxOf(tEnd, it.uptimeMillis) }
                        val n = down.size
                        if (n == 0) break
                        if (n > maxFingers) maxFingers = n
                        val c = centroid(down)
                        val span = spanOf(down, c)
                        val p = prevC
                        if (p != null && n == prevN) {
                            val d = c - p
                            travel += d.getDistance()
                            if (n == 1) Deck.padMove(d.x, d.y)
                            else {
                                val scale = if (prevSpan > 4f) span / prevSpan else 1f
                                Deck.padTwoFinger(d.x, d.y, scale, wheel.step(d.y))
                            }
                        }
                        prevC = c; prevSpan = span; prevN = n
                        ev.changes.forEach { it.consume() }
                    }
                    if (travel < 14f && tEnd - t0 < 260) {
                        Deck.padTap(maxFingers)
                        if (maxFingers == 1 && t0 - lastTap < 320) { Deck.padDoubleTap(); lastTap = 0L } else lastTap = t0
                    }
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            if (toApp) "Egy ujj — mozgatás\nCsippentés — nagyítás\nKét ujj — forgatás\nDupla koppintás — nézet vissza"
            else "Egy ujj — egér\nKoppintás — kattintás · két ujjal — jobb gomb\nKét ujj — görgetés",
            style = Melyviz.small.copy(color = Melyviz.faint, textAlign = TextAlign.Center),
            modifier = Modifier.padding(16.dp),
        )
    }
}

private fun centroid(p: List<PointerInputChange>): Offset {
    var x = 0f; var y = 0f
    for (c in p) { x += c.position.x; y += c.position.y }
    return Offset(x / p.size, y / p.size)
}

private fun spanOf(p: List<PointerInputChange>, c: Offset): Float {
    if (p.size < 2) return 0f
    var s = 0f
    for (q in p) s += hypot(q.position.x - c.x, q.position.y - c.y)
    return s / p.size
}

@Composable
fun SectionTitle(text: String) {
    Text(text.uppercase(), style = Melyviz.small.copy(letterSpacing = 1.6.sp, color = Melyviz.glowDim),
        modifier = Modifier.fillMaxWidth().padding(top = 14.dp, bottom = 6.dp))
}
