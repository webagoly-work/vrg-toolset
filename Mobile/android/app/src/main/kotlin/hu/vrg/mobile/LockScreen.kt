package hu.vrg.mobile

import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.kit.Access
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.theme.vrgBorder

// The trusted device gate (Mobile/access.json `trustedDevices`): a release build on a phone whose code
// is not listed shows only this. The code is big and copyable so the owner can add it; Frissítés and
// GitHub fiók stay open, so once a release lists the phone it can install that release from here.

/** The features a locked phone may still open: to sign in and to fetch the release that lets it in. */
val LOCK_OPEN = setOf(Catalogue.UPDATE.id, Catalogue.ACCOUNT.id, Catalogue.DEVICES.id)   // Eszközök: ask for access by QR (WP M35)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun LockScreen(onOpen: (String) -> Unit) {
    val clipboard = LocalClipboardManager.current
    val shape = RoundedCornerShape(Melyviz.radius)
    // scrolls: lying down at a large font the exit chips were below the edge (UI audit)
    Column(Modifier.fillMaxSize().systemBarsPadding().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 24.dp)) {
        Text("VRG MOBILE", style = Melyviz.title.copy(fontSize = 18.sp))
        Text("Ez a telefon nincs a megbízható eszközök között.", style = Melyviz.label.copy(color = Melyviz.sand))
        Spacer(Modifier.height(18.dp))
        Column(
            Modifier.fillMaxWidth().clip(shape).background(Melyviz.raised).vrgBorder(1.dp, Melyviz.glowDim, shape).padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text("Eszközkód", style = Melyviz.small)
            // one line, never broken inside the code (the owner copies it by eye): the size shrinks to fit (UI audit 4.6).
            // A mono glyph is ~0.62 em wide plus the 3 sp letter spacing; both grow with the font scale.
            BoxWithConstraints(Modifier.fillMaxWidth()) {
                val fontScale = LocalDensity.current.fontScale
                val fit = (maxWidth.value / Access.code.length.coerceAtLeast(1) / fontScale - 3f) / 0.62f
                Text(Access.code, maxLines = 1, softWrap = false, style = Melyviz.title.copy(fontSize = fit.coerceIn(14f, 30f).sp, fontWeight = FontWeight.Bold,
                    letterSpacing = 3.sp, color = Melyviz.glow, fontFamily = Melyviz.mono))
            }
            Text("Kérj hozzáférést: az Eszközök QR-kódját a tulajdonos telefonja olvassa be és hagyja jóvá. Utána ez a telefon új kiadás nélkül megnyílik.",
                style = Melyviz.small)
        }
        // wraps: four chips need ~440 dp, a phone has ~328, and "GitHub fiók" was drawn at 0 width (UI audit)
        FlowRow(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            VrgChip("Hozzáférés kérése ›", true) { onOpen(Catalogue.DEVICES.id) }
            VrgChip("Kód másolása") { clipboard.setText(AnnotatedString(Access.code)) }
            VrgChip("Frissítés ›") { onOpen(Catalogue.UPDATE.id) }
            VrgChip("GitHub fiók ›") { onOpen(Catalogue.ACCOUNT.id) }
        }
    }
}
