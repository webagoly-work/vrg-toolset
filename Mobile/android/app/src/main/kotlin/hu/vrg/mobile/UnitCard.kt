package hu.vrg.mobile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import hu.vrg.mobile.core.DeskUnit
import hu.vrg.mobile.core.Reach
import hu.vrg.mobile.kit.theme.Melyviz

// The description card of a Desktop unit the phone does not open (WP M46, launcher/vrg-parity.json): a GREY one makes no
// sense on a phone, so the card says what it is on the Desktop and why it stays there; a GAP one belongs here and is not
// built yet, so the card says what it is, what the phone version will do and which work package builds it. Nothing else
// happens on the tap: the Desktop's feature is shown, never started from here. [extra] is an optional stand-in action
// (Posta: the phone's own mail app until M48).

/** The short tag the ◣ menu and Kommand show for a unit: "" native, "web", "PC", "—" grey, "terv" gap. */
fun reachTag(u: DeskUnit): String = when (u.reach) {
    Reach.NATIVE -> ""
    Reach.WEBAPP -> "web"
    Reach.PC -> "PC"
    Reach.GREY -> "—"
    Reach.GAP -> "terv"
}

@Composable
fun UnitCard(u: DeskUnit, onClose: () -> Unit, extra: Pair<String, () -> Unit>? = null) {
    Dialog(onDismissRequest = onClose) {
        val shape = RoundedCornerShape(Melyviz.radius)
        val grey = u.reach == Reach.GREY
        Column(
            Modifier.fillMaxWidth().background(Melyviz.deep, shape).border(1.dp, if (grey) Melyviz.faint else Melyviz.glowDim, shape)
                .heightIn(max = 520.dp).verticalScroll(rememberScrollState()).padding(16.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(u.icon.ifEmpty { "·" }, style = Melyviz.readout.copy(color = if (grey) Melyviz.faint else Melyviz.glow, fontSize = 15.sp), modifier = Modifier.width(40.dp))
                Column(Modifier.weight(1f)) {
                    Text(u.hu, style = Melyviz.title.copy(fontSize = 16.sp))
                    Text("VRG Asztal" + (if (u.level == "user") "" else " · fejlesztői") + (if (u.en.isNotEmpty() && u.en != u.hu) " · " + u.en else ""),
                        style = Melyviz.small.copy(fontSize = 10.sp, color = Melyviz.muted))
                }
            }
            Spacer(Modifier.height(10.dp))
            Text(
                if (grey) "A TELEFONON NEM ELÉRHETŐ" else "KÉSZÜL A TELEFONRA" + (if (u.wp.isNotEmpty()) " · " + u.wp else ""),
                style = Melyviz.small.copy(letterSpacing = 1.2.sp, color = if (grey) Melyviz.muted else Melyviz.glow),
            )
            Spacer(Modifier.height(6.dp))
            if (u.about.isNotEmpty()) Text(u.about, style = Melyviz.label.copy(color = Melyviz.ink))
            if (u.note.isNotEmpty()) {
                Spacer(Modifier.height(8.dp))
                Text(if (grey) "Miért: " + u.note else "A telefonon: " + u.note, style = Melyviz.small)
            }
            if (!grey && u.wpHu.isNotEmpty()) {
                Spacer(Modifier.height(4.dp))
                Text("Munkacsomag: ${u.wp} · ${u.wpHu}", style = Melyviz.small.copy(color = Melyviz.muted))
            }
            Spacer(Modifier.height(14.dp))
            Row {
                extra?.let { (label, act) -> CardButton(label) { onClose(); act() }; Spacer(Modifier.width(8.dp)) }
                Spacer(Modifier.weight(1f))
                CardButton("Bezárás", onClose)
            }
        }
    }
}

@Composable
private fun CardButton(label: String, onClick: () -> Unit) {
    val shape = RoundedCornerShape(Melyviz.radiusSmall)
    Text(
        label, style = Melyviz.label.copy(color = Melyviz.glow),
        modifier = Modifier.heightIn(min = 44.dp).border(1.dp, Melyviz.glowDim, shape).clickable(role = Role.Button, onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 12.dp),
    )
}
