package hu.vrg.mobile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.kit.Access
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip

// The trusted device gate (Mobile/access.json `trustedDevices`): a release build on a phone whose code
// is not listed shows only this. The code is big and copyable so the owner can add it; Frissítés and
// GitHub fiók stay open, so once a release lists the phone it can install that release from here.

/** The features a locked phone may still open: to sign in and to fetch the release that lets it in. */
val LOCK_OPEN = setOf(Catalogue.UPDATE.id, Catalogue.ACCOUNT.id)

@Composable
fun LockScreen(onOpen: (String) -> Unit) {
    val clipboard = LocalClipboardManager.current
    val shape = RoundedCornerShape(Melyviz.radius)
    Column(Modifier.fillMaxSize().systemBarsPadding().padding(horizontal = 16.dp, vertical = 24.dp)) {
        Text("VRG MOBILE", style = Melyviz.title.copy(fontSize = 18.sp))
        Text("Ez a telefon nincs a megbízható eszközök között.", style = Melyviz.label.copy(color = Melyviz.sand))
        Spacer(Modifier.height(18.dp))
        Column(
            Modifier.fillMaxWidth().clip(shape).background(Melyviz.raised).border(1.dp, Melyviz.glowDim, shape).padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text("Eszközkód", style = Melyviz.small)
            Text(Access.code, style = Melyviz.title.copy(fontSize = 30.sp, fontWeight = FontWeight.Bold,
                letterSpacing = 3.sp, color = Melyviz.glow, fontFamily = Melyviz.mono))
            Text("Küldd el ezt a kódot. Ha felkerült a listára, a következő kiadás már megnyílik ezen a telefonon.",
                style = Melyviz.small)
        }
        Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            VrgChip("Kód másolása", true) { clipboard.setText(AnnotatedString(Access.code)) }
            VrgChip("Frissítés ›") { onOpen(Catalogue.UPDATE.id) }
            VrgChip("GitHub fiók ›") { onOpen(Catalogue.ACCOUNT.id) }
        }
    }
}
