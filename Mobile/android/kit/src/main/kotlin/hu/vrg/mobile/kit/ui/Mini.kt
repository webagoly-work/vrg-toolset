package hu.vrg.mobile.kit.ui

import android.provider.Settings
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.max
import hu.vrg.mobile.core.MiniState
import hu.vrg.mobile.core.MiniStatus
import hu.vrg.mobile.kit.theme.KitSize
import hu.vrg.mobile.kit.theme.Melyviz

// The MINI (WP M16, decision 4A): the VRG UI Kit's small icon that is also a button and a progress indicator,
// drawn for the phone. The web original is shared/vrg-ui-kit/components/mini.css + mini.js; the rules are the
// same: one glyph, one ring (or 12 ticks), and the state readable by shape as well as colour:
//   idle · running (an arc of the progress, or a sweeping quarter arc) · done (full ring + check corner)
//   error (notched ring + "!" corner) · waiting (dashed) · paused (two-bar corner) · off (no ring) · pressed = glow.
// Ice (glow) is "you"; the warm activity colour is "the system working". The accessible name is the state's
// sentence ("Gyorsjegyzet — 42%"). With Android's "remove animations" the arc stands still and shows the state only.

enum class MiniSize(val ring: Dp, val stroke: Dp) {
    /** A badge inside a chip; not a touch target on its own. */
    XS(14.dp, 1.5.dp),
    /** Around a tile's glyph; the tile is the touch target. */
    SM(36.dp, 1.5.dp),
    MD(44.dp, 2.dp),
    LG(70.dp, 2.5.dp),
}

enum class MiniMeter { RING, TICKS }

/** True when Android's "remove animations" (animator duration scale 0) is on. */
@Composable
fun animationsOff(): Boolean {
    val ctx = LocalContext.current
    return remember { Settings.Global.getFloat(ctx.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f }
}

/**
 * A MINI. With [onClick] it is a button (at least 48 dp); without it, an indicator whose ring is drawn around
 * its glyph without taking room, so it can sit in a tile or a chip. [quietIdle]: draw no track while idle, so
 * a resting tile looks exactly as it did before the MINI.
 */
@Composable
fun Mini(
    icon: String?,
    label: String,
    status: MiniStatus,
    onClick: (() -> Unit)? = null,
    size: MiniSize = MiniSize.MD,
    modifier: Modifier = Modifier,
    pressed: Boolean = false,
    tint: Color? = null,
    meter: MiniMeter = MiniMeter.RING,
    quietIdle: Boolean = false,
) {
    val still = animationsOff()
    val spinning = status.state == MiniState.RUNNING && status.progress == null && !still
    val turn = if (spinning) {
        val t = rememberInfiniteTransition(label = "mini")
        t.animateFloat(0f, 360f, infiniteRepeatable(tween(1100, easing = LinearEasing), RepeatMode.Restart), label = "spin").value
    } else 0f

    val interaction = remember { MutableInteractionSource() }
    val down by interaction.collectIsPressedAsState()
    val on = pressed || down
    val p = Melyviz.palette
    val glyphColour = tint ?: when {
        status.state == MiniState.ERROR -> p.coral
        status.state == MiniState.OFF -> p.faint
        on -> p.glow
        else -> p.ink
    }
    val desc = status.describe(label)
    val silent = quietIdle && !status.busy && !on

    var m = modifier
    if (onClick != null) {
        m = m.size(max(max(size.ring, KitSize.targetMin), 48.dp))
            .then(if (on) Modifier.background(p.glow.copy(alpha = 0.15f), CircleShape) else Modifier)
            .clickable(interactionSource = interaction, indication = null, onClick = onClick)
    }
    if (!silent) m = m.clearAndSetSemantics { contentDescription = desc; if (onClick != null) role = Role.Button }
    m = m.drawBehind { if (!silent) drawMini(status, size, meter, on, turn, still) }

    Box(m, contentAlignment = Alignment.Center) {
        if (!icon.isNullOrEmpty()) {
            val base = if (size == MiniSize.LG) Melyviz.glyph.copy(fontSize = Melyviz.glyph.fontSize * 1.4f) else Melyviz.glyph
            Text(icon, style = base.copy(color = glyphColour))
        } else Box(Modifier.size(size.ring))
    }
}

private fun DrawScope.drawMini(s: MiniStatus, size: MiniSize, meter: MiniMeter, pressed: Boolean, turn: Float, still: Boolean) {
    val p = Melyviz.palette
    val w = size.stroke.toPx()
    val d = size.ring.toPx() - w
    val topLeft = Offset(center.x - d / 2, center.y - d / 2)
    val box = Size(d, d)
    val stroke = Stroke(w, cap = StrokeCap.Butt)
    fun arc(c: Color, from: Float, sweep: Float) = drawArc(c, from - 90f, sweep, false, topLeft, box, style = stroke)
    /** [n] segments of [on]° every [every]°, starting at [from]. */
    fun segments(c: Color, n: Int, on: Float, every: Float, from: Float = 0f) { for (i in 0 until n) arc(c, from + i * every, on) }
    fun track(c: Color) = if (meter == MiniMeter.TICKS) segments(c, 12, 24f, 30f) else arc(c, 0f, 360f)

    val trackColour = if (pressed) p.glowDim else p.line
    when (s.state) {
        MiniState.OFF -> return
        MiniState.IDLE -> track(if (pressed) p.glow else trackColour)
        MiniState.RUNNING -> {
            track(trackColour)
            val prog = s.progress
            when {
                prog != null -> arc(p.activity, 0f, 360f * prog.coerceIn(0f, 1f))
                still -> segments(p.activity, 6, 30f, 60f)       // standing still: every other 30°, like the web's reduced motion
                else -> arc(p.activity, turn, 0.22f * 360f)
            }
        }
        MiniState.DONE -> { arc(p.kelp, 0f, 360f); if (size != MiniSize.XS) corner(p.kelp, d, Mark.CHECK) }
        MiniState.ERROR -> { arc(p.coral, 14f, 332f); if (size != MiniSize.XS) corner(p.coral, d, Mark.BANG) }
        MiniState.WAITING -> segments(p.sand, 10, 18f, 36f)
        MiniState.PAUSED -> {
            track(trackColour)
            s.progress?.let { arc(p.muted, 0f, 360f * it.coerceIn(0f, 1f)) }
            if (size != MiniSize.XS) corner(p.muted, d, Mark.BARS)
        }
    }
}

private enum class Mark { CHECK, BANG, BARS }

/** The corner mark at the bottom right of the ring, on a dot of the ground so it reads against the glyph. */
private fun DrawScope.corner(c: Color, ringPx: Float, mark: Mark) {
    val r = ringPx * 0.15f
    val at = Offset(center.x + ringPx * 0.36f, center.y + ringPx * 0.36f)
    drawCircle(Melyviz.palette.deep, r * 1.25f, at)
    when (mark) {
        Mark.CHECK -> drawPath(
            Path().apply {
                moveTo(at.x - r * 0.6f, at.y + r * 0.04f)
                lineTo(at.x - r * 0.16f, at.y + r * 0.46f)
                lineTo(at.x + r * 0.6f, at.y - r * 0.44f)
            },
            c, style = Stroke(r * 0.4f, cap = StrokeCap.Round),
        )
        Mark.BANG -> {
            drawLine(c, Offset(at.x, at.y - r * 0.7f), Offset(at.x, at.y + r * 0.2f), r * 0.4f, StrokeCap.Round)
            drawCircle(c, r * 0.2f, Offset(at.x, at.y + r * 0.62f))
        }
        Mark.BARS -> for (dx in listOf(-0.35f, 0.35f))
            drawLine(c, Offset(at.x + dx * r, at.y - r * 0.6f), Offset(at.x + dx * r, at.y + r * 0.6f), r * 0.38f)
    }
}
