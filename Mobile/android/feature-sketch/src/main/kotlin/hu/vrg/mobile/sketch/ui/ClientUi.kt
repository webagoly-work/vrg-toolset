package hu.vrg.mobile.sketch.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.sketch.ClientInfo

// F5 (WP M50, D-82): the client's contact on the Helyszín front. Personal: kept in the survey on the phone, stripped from
// the Rendezés package unless "marad" is on; never in a variant request. The address is the site's (above).

@Composable
internal fun ClientCard(st: EditorState, col: Color) {
    if (!SketchFeaturePrefs.on(androidx.compose.ui.platform.LocalContext.current, hu.vrg.mobile.sketch.SketchFeatures.CLIENT)) return   // D-90: off, no trace
    val c = st.sketch.client
    var name by remember(c?.name) { mutableStateOf(c?.name ?: "") }
    var phone by remember(c?.phone) { mutableStateOf(c?.phone ?: "") }
    var email by remember(c?.email) { mutableStateOf(c?.email ?: "") }
    Text("👤 Ügyfél (személyes adat)", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 14.dp, bottom = 4.dp))
    Field(name, { name = it }, "Név")
    Field(phone, { phone = it }, "Telefon")
    Field(email, { email = it }, "E-mail")
    if (!ClientInfo.emailLooksOk(email)) Text("Az e-mail cím hiányosnak tűnik.", style = Melyviz.small.copy(color = Melyviz.sand))
    val changed = name.trim() != (c?.name ?: "") || phone.trim() != (c?.phone ?: "") || email.trim() != (c?.email ?: "")
    Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        if (changed) Pill("✓ Ügyfél mentése", col, true) { st.edit(ClientInfo.set(st.sketch, name, phone, email)) }
        if (c != null) Pill(if (c.keep) "👤 A kiadott csomagban marad" else "👤 Kiadáskor törlődik", col, c.keep) {
            st.edit(ClientInfo.setKeep(st.sketch, !c.keep))
        }
    }
    Text(if (c?.keep == true) "A Rendezés csomagja (PC, Planner, jegyzőkönyv) viszi az ügyfél adatait. Variáns-kérésbe soha nem kerül."
        else "A felmérésben a telefonon marad; a kiadott csomagból törlődik, hacsak be nem kapcsolod. Variáns-kérésbe soha nem kerül.",
        style = Melyviz.small.copy(fontSize = 10.sp, color = Melyviz.faint))
}
