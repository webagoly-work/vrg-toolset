package hu.vrg.mobile.kit.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.unit.Dp
import hu.vrg.mobile.core.PixelGlyph
import hu.vrg.mobile.core.PixelGlyphs
import hu.vrg.mobile.kit.theme.Melyviz

// Fényjel R1: the pixel icons on the phone (shared/fenyjel/DESIGN.md §5). The glyphs are data (kit-core PixelGlyphs,
// generated from shared/fenyjel/icons.js); this draws one as square cells with a hairline gutter, the "modern LED
// matrix" look of the web's default rendering. Lit pixels take the colour, dim ones the same colour at 40 %.

/** How strong a glyph's dim tone is (fenyjel.css --fj-px-dim). */
private const val DIM = 0.4f

/** The gutter between cells, as a share of a cell; dropped when a cell is under 3 px, so tiny icons stay solid. */
private const val GAP = 0.14f

object PixelColours {
    /**
     * A family's colour on the current palette. The Fényjel hues are tuned for dark grounds; on a light palette they are
     * pulled toward black so they keep their contrast. "ui" glyphs (home, info, search…) take the palette's ink.
     */
    fun family(family: String?): Color {
        val p = Melyviz.palette
        if (family == null || family == "ui") return p.ink
        val rgb = PixelGlyphs.FAMILY_COLOURS[family] ?: return p.ink
        val c = Color(0xFF000000.toInt() or rgb)
        return if (p.light) lerp(c, Color.Black, 0.45f) else c
    }
}

/** The lit (2) / dim (1) / off (0) value of every cell, row by row: parsed once per glyph. */
private fun cellsOf(g: PixelGlyph): ByteArray {
    val n = PixelGlyphs.SIZE
    val out = ByteArray(n * n)
    g.rows.forEachIndexed { y, row -> row.forEachIndexed { x, ch -> out[y * n + x] = when (ch) { '#' -> 2; '+' -> 1; else -> 0 } } }
    return out
}

/**
 * A Fényjel pixel icon, [size] square. [color] overrides the family colour (a state: off, error, a planned feature).
 * Decorative by default (a label sits beside it); pass [contentDescription] when the icon stands alone.
 */
@Composable
fun PixelIcon(glyph: PixelGlyph, size: Dp, modifier: Modifier = Modifier, color: Color? = null, contentDescription: String? = null) {
    val cells = remember(glyph.name) { cellsOf(glyph) }
    val lit = color ?: PixelColours.family(glyph.family)
    val dim = lit.copy(alpha = lit.alpha * DIM)
    val sem = if (contentDescription != null) Modifier.clearAndSetSemantics { this.contentDescription = contentDescription } else Modifier.clearAndSetSemantics { }
    Canvas(modifier.size(size).then(sem)) {
        val n = PixelGlyphs.SIZE
        val cell = this.size.minDimension / n
        val gap = if (cell >= 3f) cell * GAP else 0f
        val side = Size(cell - gap, cell - gap)
        for (i in cells.indices) {
            val v = cells[i]
            if (v.toInt() == 0) continue
            drawRect(if (v.toInt() == 2) lit else dim, Offset((i % n) * cell + gap / 2, (i / n) * cell + gap / 2), side)
        }
    }
}
