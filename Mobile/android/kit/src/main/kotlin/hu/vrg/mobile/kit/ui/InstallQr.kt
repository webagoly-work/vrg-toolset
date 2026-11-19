package hu.vrg.mobile.kit.ui

import android.content.Context
import android.content.Intent
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.vrg.mobile.core.Updates
import hu.vrg.mobile.kit.theme.Melyviz

// The install QR (D-44): the newest release's fixed download link for a phone that has no VRG Mobile yet, with the
// three steps. Drawn by Eszközök and by the home's owner button; who may see it (Trust.isOwner) is the caller's check.

/** The QR, the steps, the link and two buttons; [onClose] is "Elrejtés". */
@Composable
fun InstallQrPanel(onClose: () -> Unit, modifier: Modifier = Modifier) {
    val ctx = LocalContext.current
    Column(modifier) {
        QrCode(Updates.PUBLIC_APK, Modifier.widthIn(max = 300.dp).fillMaxWidth().padding(vertical = 8.dp), "A VRG Mobile letöltésének QR-kódja")
        Text("1. A másik telefon kamerájával olvasd be: a böngésző letölti a vrg-mobile.apk fájlt.\n" +
            "2. Megnyitáskor engedélyezni kell a böngészőnek az ismeretlen alkalmazások telepítését.\n" +
            "3. Az app zárolva indul: ott Hozzáférés kérése ›, a kérés QR-kódját te olvasod be (Eszközök).",
            style = Melyviz.small)
        Text(Updates.PUBLIC_APK, style = Melyviz.readout.copy(fontSize = 10.sp), modifier = Modifier.padding(top = 4.dp))
        Row(Modifier.padding(vertical = 6.dp)) {
            VrgChip("Link megosztása") { shareText(ctx, "VRG Mobile letöltése (Android):\n" + Updates.PUBLIC_APK) }
            Spacer(Modifier.width(6.dp))
            VrgChip("Elrejtés", onClick = onClose)
        }
    }
}

/** The system share sheet for a text. */
fun shareText(ctx: Context, text: String) {
    val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
    runCatching { ctx.startActivity(Intent.createChooser(send, "Küldés").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
}
