package hu.vrg.mobile.kit.theme

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.sin

// The dot matrix on the phone: the Compose twin of shared/vrg-ui-kit/components/dotmatrix.css. A palette with
// `terminal = true` (Grafit, from --vk-frame: dots) draws its frames and indicators as a fine row of round dots;
// every other palette keeps its solid hairline, so a part written with these helpers looks unchanged there.

/**
 * A border: the palette's usual solid stroke, or — on a terminal palette — a ring of dots following [shape].
 * A drop-in for `.border(width, color, shape)`. The dots sit just inside the edge, so a `.clip(shape)` earlier in
 * the chain never cuts them; spacing is rounded so each closed outline gets a whole number of dots.
 */
fun Modifier.vrgBorder(width: Dp, color: Color, shape: Shape = RectangleShape): Modifier =
    if (!Melyviz.palette.terminal || width.value <= 0f) this.border(width, color, shape) else this.dotBorder(width, color, shape)

/** The [BorderStroke] form of [vrgBorder]. A gradient stroke stays solid: dots take one colour. */
fun Modifier.vrgBorder(border: BorderStroke, shape: Shape = RectangleShape): Modifier {
    val solid = border.brush as? SolidColor
    return if (!Melyviz.palette.terminal || solid == null || border.width.value <= 0f) this.border(border, shape) else this.dotBorder(border.width, solid.value, shape)
}

private fun Modifier.dotBorder(width: Dp, color: Color, shape: Shape): Modifier = drawWithCache {
    val p = Melyviz.palette
    // a heavier stroke (a selected row at 2 dp) means larger dots, not more of them
    val r = p.dotRadius.toPx() * max(1f, width.value)
    val pitch = max(p.dotPitch.toPx(), r * 2.6f)
    val inset = r + 0.5f
    val path = Path()
    if (size.width > inset * 2 && size.height > inset * 2) {
        when (val o = shape.createOutline(Size(size.width - inset * 2, size.height - inset * 2), layoutDirection, this)) {
            is Outline.Rectangle -> path.addRect(o.rect)
            is Outline.Rounded -> path.addRoundRect(o.roundRect)
            is Outline.Generic -> path.addPath(o.path)
        }
    }
    val measure = PathMeasure().apply { setPath(path, false) }
    val length = measure.length
    val n = if (length > 0f) max(4, (length / pitch).roundToInt()) else 0
    val step = if (n > 0) length / n else 0f
    val dots = List(n) { i -> measure.getPosition(i * step) + Offset(inset, inset) }
    onDrawBehind { dots.forEach { drawCircle(color, r, it) } }
}

/** A row of dots from [start] to [end] (a dotted rule): the terminal look of a divider line. */
fun DrawScope.dotLine(color: Color, start: Offset, end: Offset) {
    val p = Melyviz.palette
    val r = p.dotRadius.toPx()
    val len = (end - start).getDistance()
    val n = max(1, (len / p.dotPitch.toPx()).roundToInt())
    for (i in 0..n) drawCircle(color, r, start + (end - start) * (i / n.toFloat()))
}

/**
 * An arc drawn as dots (the MINI's ring on a terminal palette): [from] and [sweep] in degrees, 0 at three o'clock
 * as in drawArc, on a circle of [radius] around [centre]; the dots are [strokeWidth] wide.
 */
fun DrawScope.dotArc(color: Color, centre: Offset, radius: Float, from: Float, sweep: Float, strokeWidth: Float) {
    val p = Melyviz.palette
    val r = max(p.dotRadius.toPx(), strokeWidth * 0.55f)
    val pitch = max(p.dotPitch.toPx(), r * 2.6f)
    val full = 2f * PI.toFloat() * radius
    val n = max(1, (full * (sweep / 360f) / pitch).roundToInt())
    val last = if (sweep >= 360f) n - 1 else n
    for (i in 0..last) {
        val a = Math.toRadians((from + sweep * i / n).toDouble())
        drawCircle(color, r, Offset(centre.x + radius * cos(a).toFloat(), centre.y + radius * sin(a).toFloat()))
    }
}

/** The kit's default dot geometry, for palettes that do not set their own (only terminal palettes draw dots). */
object DotDefaults {
    val pitch: Dp = 3.dp
    val radius: Dp = 0.75.dp
}
