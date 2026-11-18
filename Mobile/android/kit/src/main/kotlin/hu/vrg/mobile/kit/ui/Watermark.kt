package hu.vrg.mobile.kit.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import hu.vrg.mobile.kit.R
import hu.vrg.mobile.kit.theme.Melyviz

/**
 * The Varler mark, faint, behind a screen: the home's background (both homes). It takes the palette's glow, so it
 * changes with the look like the launcher icon does. Decorative: TalkBack skips it.
 */
@Composable
fun VarlerWatermark(modifier: Modifier = Modifier, alpha: Float = if (Melyviz.palette.light) 0.07f else 0.06f) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Image(
            painterResource(R.drawable.vk_varler_mark), contentDescription = null,
            modifier = Modifier.fillMaxSize(0.62f),
            contentScale = ContentScale.Fit,
            colorFilter = ColorFilter.tint(Melyviz.glow.copy(alpha = alpha)),
        )
    }
}
