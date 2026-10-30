package hu.vrg.mobile.kit.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// VRG Mélyvíz — "deep water", and its variants. Every colour, radius and type size of the app lives
// here and nowhere else. A palette is plain data; `Melyviz` reads the current one from Compose state,
// so choosing another in Settings recolours the whole deck at once, with no restart.
//
// The structure every variant keeps: a background (abyss → deep), layered surfaces, thin lines, ink
// for text, ONE glow accent for whatever is live (connected, held, active tool), a second accent
// (current) for the relay / app side, and the three signal colours sand / coral / kelp.

data class Palette(
    val id: String,
    val name: String,
    val light: Boolean,
    val abyss: Color, val deep: Color, val surface: Color, val raised: Color,
    val line: Color, val lineSoft: Color,
    val ink: Color, val muted: Color, val faint: Color,
    val glow: Color, val glowDim: Color, val current: Color,
    val sand: Color, val coral: Color, val kelp: Color,
    val onGlow: Color,
    /** The top of the background gradient: light from above. */
    val shallows: Color,
)

object Palettes {
    val MELYVIZ = Palette(
        "melyviz", "Mélyvíz", false,
        abyss = Color(0xFF041019), deep = Color(0xFF071A26), surface = Color(0xFF0B2533), raised = Color(0xFF103143),
        line = Color(0xFF1D4C63), lineSoft = Color(0xFF143A4D),
        ink = Color(0xFFDCEFF4), muted = Color(0xFF86A9B8), faint = Color(0xFF4F7384),
        glow = Color(0xFF3FE0D0), glowDim = Color(0xFF1F7F7A), current = Color(0xFF4FA8FF),
        sand = Color(0xFFF2B33D), coral = Color(0xFFFF5C7A), kelp = Color(0xFF3FE08A),
        onGlow = Color(0xFF02201E), shallows = Color(0xFF0A2A3A),
    )

    /** True black for OLED screens: with the screen kept on, black pixels are the battery saver. */
    val AROK = Palette(
        "arok", "Mélytengeri árok (OLED)", false,
        abyss = Color(0xFF000000), deep = Color(0xFF000000), surface = Color(0xFF070B0D), raised = Color(0xFF0C1215),
        line = Color(0xFF16323D), lineSoft = Color(0xFF0E2029),
        ink = Color(0xFFC9E3EA), muted = Color(0xFF6F8F9B), faint = Color(0xFF3C5560),
        glow = Color(0xFF2FD3C4), glowDim = Color(0xFF176E68), current = Color(0xFF3F92E6),
        sand = Color(0xFFE0A632), coral = Color(0xFFF04F6C), kelp = Color(0xFF33CC7C),
        onGlow = Color(0xFF001A18), shallows = Color(0xFF000000),
    )

    val KORALL = Palette(
        "korall", "Korallzátony", false,
        abyss = Color(0xFF140A0D), deep = Color(0xFF1D0F14), surface = Color(0xFF29151C), raised = Color(0xFF351B24),
        line = Color(0xFF5C2B38), lineSoft = Color(0xFF42202A),
        ink = Color(0xFFFBE9E6), muted = Color(0xFFC9A09D), faint = Color(0xFF7E5A5C),
        glow = Color(0xFFFF8A6B), glowDim = Color(0xFF9A4D3D), current = Color(0xFFFFC15E),
        sand = Color(0xFFF2B33D), coral = Color(0xFFFF4D6D), kelp = Color(0xFF6EE7A8),
        onGlow = Color(0xFF2A0B05), shallows = Color(0xFF2E1219),
    )

    val LAGUNA = Palette(
        "laguna", "Éjféli lagúna", false,
        abyss = Color(0xFF0A0919), deep = Color(0xFF110F2E), surface = Color(0xFF191641), raised = Color(0xFF221E56),
        line = Color(0xFF3A3483), lineSoft = Color(0xFF2A2563),
        ink = Color(0xFFEAE8FF), muted = Color(0xFFA7A2D8), faint = Color(0xFF615C95),
        glow = Color(0xFFB892FF), glowDim = Color(0xFF6A51A3), current = Color(0xFF5EC8FF),
        sand = Color(0xFFF6C35B), coral = Color(0xFFFF6B9A), kelp = Color(0xFF6BE3B0),
        onGlow = Color(0xFF1A0B33), shallows = Color(0xFF1E1A4A),
    )

    val MOSZAT = Palette(
        "moszat", "Moszaterdő", false,
        abyss = Color(0xFF05110B), deep = Color(0xFF091B12), surface = Color(0xFF0E271A), raised = Color(0xFF143423),
        line = Color(0xFF225538), lineSoft = Color(0xFF183F2A),
        ink = Color(0xFFE1F5E9), muted = Color(0xFF8DB89F), faint = Color(0xFF4E7560),
        glow = Color(0xFF8BE86F), glowDim = Color(0xFF4B8A3A), current = Color(0xFF3FC1C9),
        sand = Color(0xFFE8C14A), coral = Color(0xFFFF6B6B), kelp = Color(0xFF52E39A),
        onGlow = Color(0xFF0B2005), shallows = Color(0xFF12301F),
    )

    /** The light one, for daylight and sunny sites. */
    val SEKELY = Palette(
        "sekely", "Sekély víz (világos)", true,
        abyss = Color(0xFFE4F2F5), deep = Color(0xFFEDF7F9), surface = Color(0xFFFFFFFF), raised = Color(0xFFF3FAFB),
        line = Color(0xFFB4D4DD), lineSoft = Color(0xFFD2E6EB),
        ink = Color(0xFF062633), muted = Color(0xFF486B78), faint = Color(0xFF86A4AE),
        glow = Color(0xFF0E9C9C), glowDim = Color(0xFF6CC3C3), current = Color(0xFF1E6FD9),
        sand = Color(0xFFB7791F), coral = Color(0xFFD6365A), kelp = Color(0xFF1F9D5C),
        onGlow = Color(0xFFFFFFFF), shallows = Color(0xFFD4ECF1),
    )

    /** Same ids, same order as `Look.PALETTES` in kit-core, which the stored setting is checked against. */
    val ALL = listOf(MELYVIZ, AROK, KORALL, LAGUNA, MOSZAT, SEKELY)

    fun byId(id: String?): Palette = ALL.firstOrNull { it.id == id } ?: MELYVIZ
}

object Melyviz {
    /** The palette in use. Compose state: every reader recomposes when Settings changes it. */
    var palette: Palette by mutableStateOf(Palettes.MELYVIZ)

    val abyss get() = palette.abyss
    val deep get() = palette.deep
    val surface get() = palette.surface
    val raised get() = palette.raised
    val line get() = palette.line
    val lineSoft get() = palette.lineSoft
    val ink get() = palette.ink
    val muted get() = palette.muted
    val faint get() = palette.faint
    val glow get() = palette.glow
    val glowDim get() = palette.glowDim
    val current get() = palette.current
    val sand get() = palette.sand
    val coral get() = palette.coral
    val kelp get() = palette.kelp
    val onGlow get() = palette.onGlow

    val radius = 14.dp
    val radiusSmall = 10.dp
    val gutter = 12.dp

    val mono = FontFamily.Monospace

    /** The page background: light from above fading into the abyss. */
    val water get() = Brush.verticalGradient(listOf(palette.shallows, deep, abyss))

    val title get() = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.4.sp, color = ink)
    val label get() = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Medium, color = ink)
    val small get() = TextStyle(fontSize = 11.sp, color = muted)
    val readout get() = TextStyle(fontSize = 11.sp, fontFamily = mono, color = muted)
    val glyph get() = TextStyle(fontSize = 20.sp, color = ink)
}

@Composable
fun MelyvizTheme(content: @Composable () -> Unit) {
    val p = Melyviz.palette
    val scheme = if (p.light) lightColorScheme(
        primary = p.glow, onPrimary = p.onGlow, secondary = p.current, background = p.abyss, onBackground = p.ink,
        surface = p.surface, onSurface = p.ink, surfaceVariant = p.raised, onSurfaceVariant = p.muted,
        outline = p.line, error = p.coral, surfaceContainer = p.raised, surfaceContainerHigh = p.raised,
    ) else darkColorScheme(
        primary = p.glow, onPrimary = p.onGlow, secondary = p.current, background = p.abyss, onBackground = p.ink,
        surface = p.surface, onSurface = p.ink, surfaceVariant = p.raised, onSurfaceVariant = p.muted,
        outline = p.line, error = p.coral, surfaceContainer = p.raised, surfaceContainerHigh = p.raised,
    )
    MaterialTheme(colorScheme = scheme, content = content)
}
