package hu.vrg.legeger.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// VRG Mélyvíz — "deep water". Every colour, radius and type size of the app lives here and nowhere
// else, so matching the Mélyvíz reference page exactly means editing this one object.
//
// The palette: an abyss background, layered blue-green depths for surfaces, thin "current" lines
// for borders, and one bioluminescent accent for whatever is live (connected, held, active tool).

object Melyviz {
    // depths, darkest first
    val abyss = Color(0xFF041019)
    val deep = Color(0xFF071A26)
    val surface = Color(0xFF0B2533)
    val raised = Color(0xFF103143)
    val line = Color(0xFF1D4C63)
    val lineSoft = Color(0xFF143A4D)

    // text
    val ink = Color(0xFFDCEFF4)
    val muted = Color(0xFF86A9B8)
    val faint = Color(0xFF4F7384)

    // light in the water
    val glow = Color(0xFF3FE0D0)        // live / active / held
    val glowDim = Color(0xFF1F7F7A)
    val current = Color(0xFF4FA8FF)     // relay / app-aware
    val sand = Color(0xFFF2B33D)        // warning, waiting
    val coral = Color(0xFFFF5C7A)       // error, disconnected
    val kelp = Color(0xFF3FE08A)        // ok

    val onGlow = Color(0xFF02201E)

    val radius = 14.dp
    val radiusSmall = 10.dp
    val gutter = 12.dp

    val mono = FontFamily.Monospace

    /** The page background: light from above fading into the abyss. */
    val water = Brush.verticalGradient(listOf(Color(0xFF0A2A3A), deep, abyss))

    val title = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.4.sp, color = ink)
    val label = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Medium, color = ink)
    val small = TextStyle(fontSize = 11.sp, color = muted)
    val readout = TextStyle(fontSize = 11.sp, fontFamily = mono, color = muted)
    val glyph = TextStyle(fontSize = 20.sp, color = ink)
}

@Composable
fun MelyvizTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Melyviz.glow,
            onPrimary = Melyviz.onGlow,
            secondary = Melyviz.current,
            background = Melyviz.abyss,
            onBackground = Melyviz.ink,
            surface = Melyviz.surface,
            onSurface = Melyviz.ink,
            surfaceVariant = Melyviz.raised,
            onSurfaceVariant = Melyviz.muted,
            outline = Melyviz.line,
            error = Melyviz.coral,
        ),
        content = content,
    )
}
