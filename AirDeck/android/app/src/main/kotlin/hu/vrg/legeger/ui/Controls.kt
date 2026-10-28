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
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.PointerId
import androidx.compose.ui.input.pointer.PointerInputChange
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.vrg.legeger.Deck
import hu.vrg.legeger.core.GestureClassifier
import hu.vrg.legeger.core.Hid
import hu.vrg.legeger.core.PadMode
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

@Composable
fun SectionTitle(text: String) {
    Text(text.uppercase(), style = Melyviz.small.copy(letterSpacing = 1.6.sp, color = Melyviz.glowDim),
        modifier = Modifier.fillMaxWidth().padding(top = 14.dp, bottom = 6.dp))
}

/** Settings for one pad: everything it needs besides the mode, so the gesture loop restarts when it changes. */
data class PadConfig(
    val gestures: Boolean,
    val edges: Boolean,
    val hints: Boolean,
    val phoneAspect: Float,
    /** One line per gesture group, from the profile: what 3 / 4 fingers do here. */
    val cheat: String,
)

/** The phone-shaped frame touches are mapped into, centred in the pad, `aspect` = height / width. */
fun phoneFrame(w: Float, h: Float, aspect: Float): Rect {
    val m = 14f
    var fh = h - 2 * m
    var fw = fh / aspect
    if (fw > w - 2 * m) { fw = w - 2 * m; fh = fw * aspect }
    val l = (w - fw) / 2f
    val t = (h - fh) / 2f
    return Rect(l, t, l + fw, t + fh)
}

/**
 * The pad, in three modes, with the screen gestures on top of all of them.
 *
 *   MOUSE   one finger moves · tap clicks · two-finger tap right-clicks · two fingers scroll · pinch zooms (Ctrl+wheel)
 *   CAMERA  the old phone page: one finger pans · pinch zooms · two fingers orbit · double tap resets
 *   TOUCH   a touchscreen for the phone on the other end: every finger (up to two) lands on its screen
 *           at the same place in the frame — tap, hold, swipe, scroll, pinch, its own edge gestures
 *
 *   all     3 / 4 fingers: swipes and taps from the profile; MOUSE / CAMERA also the edge strips
 */
@Composable
fun Touchpad(mode: PadMode, cfg: PadConfig, modifier: Modifier = Modifier) {
    var lastTap by remember { mutableLongStateOf(0L) }
    val wheel = remember { WheelAccumulator() }
    val dash = remember { PathEffect.dashPathEffect(floatArrayOf(14f, 10f)) }
    val touches = remember { mutableStateListOf<Offset>() }
    val edgeColor = Melyviz.glowDim
    val frameColor = Melyviz.current
    val glow = Melyviz.glow
    val lineColor = if (mode == PadMode.CAMERA) Melyviz.current.copy(alpha = 0.6f) else Melyviz.line
    val contour = Melyviz.lineSoft

    Box(
        modifier
            .clip(RoundedCornerShape(Melyviz.radius))
            .background(Melyviz.deep)
            .drawBehind {
                drawRoundRect(color = lineColor, cornerRadius = CornerRadius(Melyviz.radius.toPx()),
                    style = Stroke(width = 1.5.dp.toPx(), pathEffect = dash))
                if (mode == PadMode.TOUCH) {
                    val f = phoneFrame(size.width, size.height, cfg.phoneAspect)
                    drawRoundRect(frameColor.copy(alpha = 0.10f), f.topLeft, f.size, CornerRadius(22.dp.toPx()))
                    drawRoundRect(frameColor.copy(alpha = 0.7f), f.topLeft, f.size, CornerRadius(22.dp.toPx()),
                        style = Stroke(width = 1.5.dp.toPx()))
                    drawCircle(frameColor.copy(alpha = 0.6f), 3.dp.toPx(), Offset(f.center.x, f.top + 10.dp.toPx()))
                    touches.forEach {
                        drawCircle(glow.copy(alpha = 0.25f), 26.dp.toPx(), it)
                        drawCircle(glow, 9.dp.toPx(), it)
                    }
                } else {
                    val step = 34.dp.toPx()
                    var y = step
                    while (y < size.height) {
                        drawLine(contour.copy(alpha = 0.35f), Offset(18f, y), Offset(size.width - 18f, y), 1f)
                        y += step
                    }
                    if (cfg.edges) {
                        val ew = size.width * GestureClassifier.EDGE
                        drawRect(edgeColor.copy(alpha = 0.14f), Offset(0f, 0f), Size(ew, size.height))
                        drawRect(edgeColor.copy(alpha = 0.14f), Offset(size.width - ew, 0f), Size(ew, size.height))
                    }
                }
            }
            .pointerInput(mode, cfg) {
                awaitEachGesture {
                    val w = size.width.toFloat()
                    val h = size.height.toFloat()
                    val first = awaitFirstDown(requireUnconsumed = false)
                    val t0 = first.uptimeMillis
                    var tEnd = t0
                    var maxFingers = 1
                    var travel = 0f
                    var prevC: Offset? = null
                    var prevSpan = 0f
                    var prevN = 0
                    // multi-finger gesture: once three fingers are down, the pad stops being a pad
                    var multi = false
                    var mStart = Offset.Zero
                    var mLast = Offset.Zero
                    var mTravel = 0f
                    // edge strip: a one-finger touch that starts there is a gesture, not a cursor move
                    val edge = mode != PadMode.TOUCH && cfg.edges && GestureClassifier.inEdge(first.position.x, w)
                    var edgeDone = false
                    // touchscreen slots: pointer -> contact 0 / 1
                    val slots = HashMap<PointerId, Int>()
                    val frame = phoneFrame(w, h, cfg.phoneAspect)

                    fun liftAll() {
                        if (slots.isEmpty()) return
                        Deck.touchFrame(slots.values.map { Hid.Contact(it, 0, 0, false) })
                        slots.clear(); touches.clear()
                    }

                    // awaitFirstDown has already taken the first finger's down: send it now, or a
                    // quick tap (down, up, no move in between) would never reach the other phone
                    if (mode == PadMode.TOUCH) {
                        slots[first.id] = 0
                        val (x, y) = Hid.touchUnits(first.position.x, first.position.y, frame.left, frame.top, frame.width, frame.height)
                        Deck.touchFrame(listOf(Hid.Contact(0, x, y, true)))
                        touches.clear(); touches += first.position
                    }

                    wheel.reset()
                    Deck.padGestureStart()
                    if (Deck.clutch.value || Deck.clutchLatched.value) Deck.precisionHeld.value = true

                    while (true) {
                        val ev = awaitPointerEvent()
                        ev.changes.forEach { tEnd = maxOf(tEnd, it.uptimeMillis) }
                        val down = ev.changes.filter { it.pressed }
                        val n = down.size
                        if (n > maxFingers) maxFingers = n

                        if (!multi && cfg.gestures && n >= 3) {
                            multi = true
                            liftAll()
                            mStart = centroid(down); mLast = mStart
                        }
                        if (n == 0) { if (mode == PadMode.TOUCH) liftAll(); break }

                        if (multi) {
                            val c = centroid(down)
                            mTravel += (c - mLast).getDistance(); mLast = c
                            ev.changes.forEach { it.consume() }
                            continue
                        }

                        if (edge) {
                            val d = first.position.let { p -> down[0].position - p }
                            travel = d.getDistance()
                            if (!edgeDone) GestureClassifier.edge(first.position.x, d.x, d.y, w)?.let { g ->
                                edgeDone = true; Deck.padGesture(g)
                            }
                            ev.changes.forEach { it.consume() }
                            continue
                        }

                        if (mode == PadMode.TOUCH) {
                            val contacts = ArrayList<Hid.Contact>()
                            for (ch in ev.changes) {
                                val slot = slots[ch.id] ?: run {
                                    if (!ch.pressed) return@run null
                                    val free = (0 until Hid.TOUCH_CONTACTS).firstOrNull { it !in slots.values } ?: return@run null
                                    slots[ch.id] = free; free
                                } ?: continue
                                val (x, y) = Hid.touchUnits(ch.position.x, ch.position.y, frame.left, frame.top, frame.width, frame.height)
                                contacts += Hid.Contact(slot, x, y, ch.pressed)
                                if (!ch.pressed) slots.remove(ch.id)
                            }
                            if (contacts.isNotEmpty()) Deck.touchFrame(contacts)
                            touches.clear(); down.forEach { if (slots.containsKey(it.id)) touches += it.position }
                            ev.changes.forEach { it.consume() }
                            continue
                        }

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
                    Deck.precisionHeld.value = false

                    when {
                        multi -> GestureClassifier.multi(maxFingers, mLast.x - mStart.x, mLast.y - mStart.y, mTravel, tEnd - t0, w, h)
                            ?.let { Deck.padGesture(it) }
                        edge -> if (!edgeDone && travel < 14f && tEnd - t0 < 260) Deck.padTap(1)
                        mode != PadMode.TOUCH && travel < 14f && tEnd - t0 < 260 -> {
                            Deck.padTap(maxFingers)
                            if (maxFingers == 1 && t0 - lastTap < 320) { Deck.padDoubleTap(); lastTap = 0L } else lastTap = t0
                        }
                    }
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        if (cfg.hints) {
            val base = when (mode) {
                PadMode.MOUSE -> "Egy ujj — egér · koppintás — kattintás\nKét ujj — görgetés · csippentés — nagyítás\nKét ujjal koppint — jobb gomb"
                PadMode.CAMERA -> "Egy ujj — mozgatás · csippentés — nagyítás\nKét ujj — forgatás · dupla koppintás — nézet vissza"
                PadMode.TOUCH -> "A keret a telefon képernyője:\nkoppints, tarts, húzz, csippents — ahogy rajta"
            }
            Text(
                base + if (cfg.gestures && cfg.cheat.isNotEmpty()) "\n\n" + cfg.cheat else "",
                style = Melyviz.small.copy(color = Melyviz.faint, textAlign = TextAlign.Center, fontSize = 10.5.sp),
                modifier = Modifier.padding(horizontal = 28.dp, vertical = 16.dp),
            )
        }
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
