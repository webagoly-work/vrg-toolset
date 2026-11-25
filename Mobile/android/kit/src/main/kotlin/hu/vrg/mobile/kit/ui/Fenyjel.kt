package hu.vrg.mobile.kit.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.vrg.mobile.core.PixelGlyph
import hu.vrg.mobile.core.PixelGlyphs
import hu.vrg.mobile.kit.theme.KitFaces
import hu.vrg.mobile.kit.theme.Melyviz

// Fényjel on the phone (shared/fenyjel/DESIGN.md, rollout R2): the Compose twins of fenyjel.css's parts. The shell's
// Fényjel home and Vezérlőpult (app/FenyjelShell.kt) are built from these; feature pages take them in R3.
//   LedDigits · Led · DotMeter · Socket · Modifier.fjPlane · Modifier.brackets · InfoButton · FjType

/** The type roles (DESIGN.md §6): VT323 for titles, labels and buttons; numbers are [LedDigits], never a font. */
object FjType {
    val title get() = TextStyle(fontFamily = KitFaces.term, fontSize = 26.sp, color = Melyviz.ink)
    val label get() = TextStyle(fontFamily = KitFaces.term, fontSize = 17.sp, color = Melyviz.muted)
    val button get() = TextStyle(fontFamily = KitFaces.term, fontSize = 20.sp)
    val display get() = TextStyle(fontFamily = KitFaces.dot, fontSize = 34.sp, color = Melyviz.ink)
    val sub get() = TextStyle(fontFamily = KitFaces.sans, fontSize = 13.sp, color = Melyviz.muted)
    val mono get() = TextStyle(fontFamily = KitFaces.mono, fontSize = 12.sp, color = Melyviz.faint)
}

/** Status for a [Led]: shape-backed, always next to a number or a word (DESIGN.md §4.2). */
enum class LedState { OFF, OK, WARN, CRIT, HUE }

private const val UNLIT = 0.1f

/**
 * A number on the 5×7 LED grid (PixelGlyphs.DIGITS, from shared/fenyjel/icons.js), [height] tall; unlit dots faintly
 * visible like a real display. Characters without a glyph are skipped. TalkBack reads [text].
 */
@Composable
fun LedDigits(text: String, height: Dp, modifier: Modifier = Modifier, color: Color = Melyviz.ink) {
    val glyphs = text.mapNotNull { PixelGlyphs.DIGITS[it] }
    val cols = glyphs.sumOf { it[0].length } + (glyphs.size - 1).coerceAtLeast(0)
    if (cols <= 0) return
    val cell = height / 7
    Canvas(modifier.width(cell * cols).height(height).clearAndSetSemantics { contentDescription = text }) {
        val c = size.height / 7
        val r = c * 0.42f
        var x0 = 0f
        glyphs.forEach { g ->
            val w = g[0].length
            g.forEachIndexed { y, row ->
                row.forEachIndexed { x, ch ->
                    val on = ch == '#'
                    drawCircle(if (on) color else color.copy(alpha = color.alpha * UNLIT), r, Offset(x0 + (x + 0.5f) * c, (y + 0.5f) * c))
                }
            }
            x0 += (w + 1) * c
        }
    }
}

/** A 3×3 dot LED. [hue] colours the HUE state (a family colour: "this server runs"). */
@Composable
fun Led(state: LedState, modifier: Modifier = Modifier, hue: Color = Melyviz.glow, size: Dp = 9.dp) {
    val p = Melyviz.palette
    val c = when (state) {
        LedState.OFF -> if (p.light) p.line else Color(0xFF3A4A57)          // --fj-off
        LedState.OK -> p.kelp
        LedState.WARN -> p.sand
        LedState.CRIT -> p.coral
        LedState.HUE -> hue
    }
    Canvas(modifier.size(size)) {
        val cell = this.size.minDimension / 3
        for (y in 0 until 3) for (x in 0 until 3) drawCircle(c, cell * 0.36f, Offset((x + 0.5f) * cell, (y + 0.5f) * cell))
    }
}

/** A dot meter: a band of dots, lit from the left to [value] (0…1), whole dots only. */
@Composable
fun DotMeter(value: Float, modifier: Modifier = Modifier, color: Color = Melyviz.glow, height: Dp = 9.dp) {
    Canvas(modifier.fillMaxWidth().height(height)) {
        val pitch = this.size.height / 3
        val cols = (this.size.width / pitch).toInt().coerceAtLeast(1)
        val lit = (value.coerceIn(0f, 1f) * cols).toInt()
        val off = Melyviz.ink.copy(alpha = 0.14f)
        for (x in 0 until cols) for (y in 0 until 3) {
            drawCircle(if (x < lit) color else off, pitch * if (x < lit) 0.37f else 0.33f, Offset((x + 0.5f) * pitch, (y + 0.5f) * pitch))
        }
    }
}

/**
 * The lit well a glyph sits in (DESIGN.md §5): a raised face, the family colour glowing behind the glyph, a hairline
 * in that colour. [dim] draws a planned feature (grey glyph, no glow).
 */
@Composable
fun Socket(glyph: PixelGlyph, size: Dp, modifier: Modifier = Modifier, dim: Boolean = false, glyphColor: Color? = null) {
    val p = Melyviz.palette
    val hue = PixelColours.family(glyph.family)
    val shape = RoundedCornerShape(3.dp)
    Box(
        modifier.size(size).shadow(if (dim) 0.dp else 6.dp, shape, ambientColor = Color.Black, spotColor = Color.Black)
            .background(Brush.verticalGradient(listOf(p.raised, p.surface)), shape)
            .then(if (dim) Modifier else Modifier.background(Brush.radialGradient(listOf(hue.copy(alpha = 0.22f), Color.Transparent)), shape))
            .border(1.dp, if (dim) p.lineSoft else hue.copy(alpha = 0.28f), shape),
        contentAlignment = Alignment.Center,
    ) {
        PixelIcon(glyph, size * 0.56f, color = glyphColor ?: if (dim) p.faint else null)
    }
}

/** A Fényjel plane: lit from above (raised → surface), a 1 px rim on top, a hairline edge; [hue] glows from below. */
fun Modifier.fjPlane(hue: Color? = null): Modifier = this
    .shadow(10.dp, RoundedCornerShape(3.dp), ambientColor = Color.Black, spotColor = Color.Black)
    .drawBehind {
        val p = Melyviz.palette
        drawRect(Brush.verticalGradient(listOf(p.raised, p.surface), endY = size.height * 0.4f))
        if (hue != null) drawRect(Brush.radialGradient(listOf(hue.copy(alpha = 0.16f), Color.Transparent),
            center = Offset(size.width / 2, size.height * 1.15f), radius = size.maxDimension * 0.75f))
        drawRect(p.lineSoft, style = androidx.compose.ui.graphics.drawscope.Stroke(1.dp.toPx()))
        drawLine(p.ink.copy(alpha = 0.07f), Offset(1f, 0.5f), Offset(size.width - 1f, 0.5f), 1.dp.toPx())
    }

/** Four thin HUD corner brackets (DESIGN.md §2 rule 4), [len] long, in [color]. */
fun Modifier.brackets(color: Color, len: Dp = 10.dp): Modifier = this.drawBehind {
    val l = len.toPx(); val w = 1.dp.toPx(); val r = size.width; val b = size.height
    fun h(x: Float, y: Float) = drawRect(color, Offset(x, y), Size(l, w))
    fun v(x: Float, y: Float) = drawRect(color, Offset(x, y), Size(w, l))
    h(0f, 0f); v(0f, 0f); h(r - l, 0f); v(r - w, 0f); h(0f, b - w); v(0f, b - l); h(r - l, b - w); v(r - w, b - l)
}

/** The i button: details live behind it, never on the face (DESIGN.md §7.5). A 40 dp target. */
@Composable
fun InfoButton(label: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val info = PixelGlyphs.byName("info") ?: return
    Box(modifier.size(40.dp).clickable(onClick = onClick).semantics { contentDescription = label; role = Role.Button },
        contentAlignment = Alignment.Center) {
        PixelIcon(info, 18.dp, color = Melyviz.muted)
    }
}

/** A thin-line button in [hue]; [solid] = the screen's one primary action (filled, text in the ground colour). */
@Composable
fun FjButton(text: String, hue: Color, modifier: Modifier = Modifier, solid: Boolean = false, enabled: Boolean = true, onClick: () -> Unit) {
    val shape = RoundedCornerShape(3.dp)
    val c = if (enabled) hue else Melyviz.faint
    Box(
        modifier.heightIn(min = 44.dp).background(if (solid && enabled) c else c.copy(alpha = 0.08f), shape)
            .border(1.dp, c.copy(alpha = if (solid) 1f else 0.6f), shape)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick).padding(horizontal = 16.dp),
        contentAlignment = Alignment.Center,
    ) {
        androidx.compose.material3.Text(text, style = FjType.button.copy(color = if (solid && enabled) Melyviz.palette.abyss else c), maxLines = 1)
    }
}

/** A square switch (DESIGN.md §8): the knob lights in [hue] when on. [enabled] false = shown, not changeable. */
@Composable
fun FjSwitch(checked: Boolean, label: String, hue: Color, modifier: Modifier = Modifier, enabled: Boolean = true, onChange: (Boolean) -> Unit) {
    val p = Melyviz.palette
    Box(
        modifier.size(48.dp).toggleable(value = checked, enabled = enabled, role = Role.Switch, onValueChange = onChange)
            .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        Canvas(Modifier.width(36.dp).height(20.dp)) {
            val w = 1.dp.toPx()
            drawRect(p.abyss)
            drawRect(if (checked) hue.copy(alpha = if (enabled) 0.75f else 0.35f) else p.line, style = androidx.compose.ui.graphics.drawscope.Stroke(w))
            val k = size.height - 8.dp.toPx()
            val x = if (checked) size.width - 4.dp.toPx() - k else 4.dp.toPx()
            drawRect(if (checked) (if (enabled) hue else hue.copy(alpha = 0.5f)) else p.faint, Offset(x, 4.dp.toPx()), Size(k, k))
        }
    }
}
