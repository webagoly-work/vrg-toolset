package hu.vrg.mobile.devices

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.DeviceRequest
import hu.vrg.mobile.core.DeviceTrust
import hu.vrg.mobile.core.Route
import hu.vrg.mobile.core.Updates
import hu.vrg.mobile.kit.Access
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.Trust
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.github.GitHub
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.QrCode
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.ui.VrgSectionTitle
import hu.vrg.mobile.kit.ui.VrgToggle
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

// Eszközök (WP M35): Proton Vault's way in, for VRG Mobile. One account (the owner's GitHub); the phones are what
// differ. A phone that is not on the list shows its request as a QR; the owner's phone reads it (the home's QR
// beolvasás, the phone's camera, or a pasted messenger message), checks the 6-character code by eye, approves — the
// phone goes on Mobile/trust/devices.json on main — and shows a grant QR that only the asking phone can open. With the
// release lock on, only listed phones are offered updates.

object DevicesFeature : VrgFeature {
    override val info = Catalogue.DEVICES

    /** A request or a grant that arrived by link (QR scanner, camera app, messenger), waiting on the screen. */
    private val incoming = MutableStateFlow<DeviceTrust.Parsed?>(null)

    override fun open(route: Route): Boolean {
        val raw = route.params["req"]?.let { "req=$it" } ?: route.params["grant"]?.let { "grant=$it" } ?: return route.path.isEmpty()
        incoming.value = DeviceTrust.read(raw)
        return true
    }

    @Composable
    override fun Screen(host: FeatureHost) {
        val ctx = LocalContext.current
        val scope = rememberCoroutineScope()
        val clipboard = LocalClipboardManager.current
        val list by Trust.list.collectAsStateWithLifecycle()
        val granted by Trust.granted.collectAsStateWithLifecycle()
        val inc by incoming.collectAsStateWithLifecycle()
        var note by remember { mutableStateOf<String?>(null) }
        var busy by remember { mutableStateOf(false) }
        var showRequest by remember { mutableStateOf(false) }
        var showInstall by remember { mutableStateOf(false) }
        var grantLink by remember { mutableStateOf<Pair<String, DeviceRequest>?>(null) }
        var name by remember { mutableStateOf(Trust.name) }
        val owner = GitHub.canWrite
        LaunchedEffect(Unit) { note = Trust.refresh() }

        // a grant for this phone: open it at once
        LaunchedEffect(inc) {
            val g = (inc as? DeviceTrust.Parsed.Grant)?.g ?: return@LaunchedEffect
            note = try { "Engedély elfogadva: " + Trust.accept(g) } catch (e: Exception) { e.message ?: "Az engedély nem nyílt meg." }
            incoming.value = null
        }

        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
            Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current), modifier = Modifier.clickable { host.home() }.padding(vertical = 8.dp))
            Text("ESZKÖZÖK", style = Melyviz.title.copy(fontSize = 18.sp))
            Text("Egy fiók (a tulajdonosé), a telefonok különböznek: mindegyiket QR-kóddal hagyja jóvá a tulajdonos telefonja.", style = Melyviz.small)
            note?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 6.dp)) }

            // ---- this phone
            VrgSectionTitle("Ez a telefon")
            Text(Access.code, style = Melyviz.title.copy(fontSize = 24.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp, color = Melyviz.glow, fontFamily = Melyviz.mono))
            val status = when {
                list == null -> "A lista még nincs beolvasva."
                Trust.isOwner -> "Tulajdonos."
                Trust.listed -> "Jóváhagyott eszköz" + (granted?.let { ": $it" } ?: ".")
                else -> "Nincs a megbízható eszközök között."
            }
            Text(status, style = Melyviz.label.copy(color = if (Trust.listed) Melyviz.kelp else Melyviz.sand))
            if (list?.gated == true) Text(if (Trust.updatesAllowed()) "Frissítést kaphat." else "Frissítést csak jóváhagyás után kap (a kiadások zárolva).", style = Melyviz.small)
            OutlinedTextField(name, { name = it.take(40) }, Modifier.fillMaxWidth().padding(top = 6.dp), singleLine = true,
                label = { Text("A telefon neve a listán", style = Melyviz.small) }, colors = fieldColors())
            Row(Modifier.padding(vertical = 6.dp)) {
                if (name != Trust.name) { VrgChip("Név mentése", true) { Trust.name = name; note = "Mentve." }; Spacer(Modifier.width(6.dp)) }
                VrgChip("Lista frissítése") { scope.launch { busy = true; note = Trust.refresh() ?: "A lista friss."; busy = false } }
            }

            if (!Trust.listed || showRequest) {
                VrgSectionTitle("Hozzáférés kérése")
                if (!showRequest) VrgChip("Kérés QR-kódja", true) { showRequest = true }
                else {
                    val req = remember { Trust.request() }
                    val link = DeviceTrust.requestLink(req)
                    QrCode(link, Modifier.widthIn(max = 300.dp).fillMaxWidth().padding(vertical = 8.dp), "A hozzáférés-kérés QR-kódja")
                    Text("Ellenőrző kód: ${req.code}", style = Melyviz.title.copy(fontSize = 20.sp, fontFamily = Melyviz.mono))
                    Text("A tulajdonos a saját telefonján olvassa be (kezdőlap: QR beolvasása, vagy a kamerája), és ugyanezt a kódot kell látnia. Messengeren is elküldheted.",
                        style = Melyviz.small)
                    Row(Modifier.padding(vertical = 6.dp)) {
                        VrgChip("Megosztás") { share(ctx, "VRG Mobile hozzáférés-kérés (${req.name}, kód ${req.code}):\n$link") }
                        Spacer(Modifier.width(6.dp))
                        VrgChip("Elrejtés") { showRequest = false }
                    }
                }
                Text("A választ (engedély QR) a telefon kamerájával olvasd be, vagy másold ki az üzenetből:", style = Melyviz.small, modifier = Modifier.padding(top = 6.dp))
                Row(Modifier.padding(vertical = 6.dp)) {
                    VrgChip("Engedély beillesztése") { clipboard.getText()?.text?.let { incoming.value = DeviceTrust.read(it) } ?: run { note = "A vágólap üres." } }
                }
            }

            // ---- the owner's side
            if (owner) {
                VrgSectionTitle("Jóváhagyás (tulajdonos)")
                Text("Egy kérés QR-kódját a kezdőlap QR beolvasásával vagy a kamerával olvasd be; messengeren kapott kérést illessz be.", style = Melyviz.small)
                Row(Modifier.padding(vertical = 6.dp)) {
                    VrgChip("QR beolvasása ›") { host.open(Catalogue.PAIR.id) }
                    Spacer(Modifier.width(6.dp))
                    VrgChip("Kérés beillesztése") { clipboard.getText()?.text?.let { incoming.value = DeviceTrust.read(it) } ?: run { note = "A vágólap üres." } }
                }
            }
            // ---- the install QR (2026-11-19): only on the owner's own phone (this phone is the list's owner entry),
            // not on a phone that was merely handed the owner's token. A phone without the app reads it with its camera,
            // downloads the newest release and installs it; it then starts locked and asks for access as above.
            if (Trust.isOwner) {
                VrgSectionTitle("Telepítés másik telefonra")
                if (!showInstall) {
                    Text("Egy QR, amit a másik telefon kamerájával beolvasva letölti a VRG Mobile legújabb kiadását. Csak neked látszik.", style = Melyviz.small)
                    Row(Modifier.padding(vertical = 6.dp)) { VrgChip("Telepítő QR", true) { showInstall = true } }
                } else {
                    QrCode(Updates.PUBLIC_APK, Modifier.widthIn(max = 300.dp).fillMaxWidth().padding(vertical = 8.dp), "A VRG Mobile letöltésének QR-kódja")
                    Text("1. A másik telefon kamerájával olvasd be: a böngésző letölti a vrg-mobile.apk fájlt.\n" +
                        "2. Megnyitáskor engedélyezni kell a böngészőnek az ismeretlen alkalmazások telepítését.\n" +
                        "3. Az app zárolva indul: ott Hozzáférés kérése ›, a kérés QR-kódját te olvasod be itt.",
                        style = Melyviz.small)
                    Text(Updates.PUBLIC_APK, style = Melyviz.readout.copy(fontSize = 10.sp), modifier = Modifier.padding(top = 4.dp))
                    Row(Modifier.padding(vertical = 6.dp)) {
                        VrgChip("Link megosztása") { share(ctx, "VRG Mobile letöltése (Android):\n" + Updates.PUBLIC_APK) }
                        Spacer(Modifier.width(6.dp))
                        VrgChip("Elrejtés") { showInstall = false }
                    }
                }
            }
            (inc as? DeviceTrust.Parsed.Bad)?.let { Text(it.why, style = Melyviz.small.copy(color = Melyviz.coral)) }
            (inc as? DeviceTrust.Parsed.Req)?.r?.let { r ->
                if (!owner) Text("Kérés érkezett (${r.name}), de jóváhagyni csak a tulajdonos telefonja tud (GitHub belépéssel).", style = Melyviz.small.copy(color = Melyviz.sand))
                else Approve(r, busy, onDone = { link -> grantLink = link to r; incoming.value = null }, onBusy = { busy = it }, onNote = { note = it },
                    onCancel = { incoming.value = null })
            }
            grantLink?.let { (link, r) ->
                VrgSectionTitle("Engedély: ${r.name}")
                QrCode(link, Modifier.widthIn(max = 300.dp).fillMaxWidth().padding(vertical = 8.dp), "Az engedély QR-kódja")
                Text(if (r.back != null) "Az iPhone a saját kamerájával olvassa be: a VRG webapp nyílik meg vele." else "A másik telefon a kamerájával olvassa be (vagy Eszközök → Engedély beillesztése).",
                    style = Melyviz.small)
                Row(Modifier.padding(vertical = 6.dp)) {
                    VrgChip("Megosztás") { share(ctx, "VRG Mobile engedély ide: ${r.name}\n$link") }
                    Spacer(Modifier.width(6.dp))
                    VrgChip("Kész") { grantLink = null }
                }
            }

            // ---- the list
            VrgSectionTitle("Megbízható eszközök")
            val l = list
            if (l == null) Text("Még nincs beolvasva.", style = Melyviz.small)
            else {
                if (owner) VrgToggle("Kiadások zárolása: csak a listán lévők kapnak frissítést", l.gated) { on ->
                    scope.launch { busy = true; note = Trust.setGated(on) ?: if (on) "Zárolva." else "Feloldva."; busy = false }
                }
                if (owner && l.gated) Text("A repó nyilvános: a letöltési link ettől még nyitott, a zár az alkalmazáson belüli frissítést szűri.", style = Melyviz.small.copy(color = Melyviz.faint))
                l.devices.forEach { d ->
                    Column(Modifier.fillMaxWidth().padding(vertical = 3.dp).clip(RoundedCornerShape(Melyviz.radiusSmall)).background(Melyviz.surface).padding(10.dp)) {
                        Text(d.name.ifBlank { d.model } + (if (d.owner) " · tulajdonos" else "") + (if (DeviceTrust.sameId(d.id, Trust.id)) " · ez a telefon" else ""), style = Melyviz.label)
                        Text("${d.model} · ${d.os} · ${d.id}", style = Melyviz.readout)
                        Text("jóváhagyva ${d.approved.take(10)}" + (if (d.by.isNotBlank()) " · ${d.by}" else ""), style = Melyviz.readout.copy(fontSize = 10.sp))
                        if (owner && !d.owner) Row(Modifier.padding(top = 4.dp)) {
                            VrgChip("Eltávolítás") { scope.launch { busy = true; note = Trust.remove(d.id) ?: "Eltávolítva: ${d.name}"; busy = false } }
                        }
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }

    @Composable
    private fun Approve(r: DeviceRequest, busy: Boolean, onDone: (String) -> Unit, onBusy: (Boolean) -> Unit, onNote: (String?) -> Unit, onCancel: () -> Unit) {
        val scope = rememberCoroutineScope()
        var withToken by remember { mutableStateOf(false) }
        val shape = RoundedCornerShape(Melyviz.radius)
        Column(Modifier.fillMaxWidth().padding(vertical = 8.dp).clip(shape).background(Melyviz.raised).border(2.dp, Melyviz.glow, shape).padding(14.dp)) {
            Text("KÉRÉS: ${r.name}", style = Melyviz.title)
            Text("${r.model} · ${r.os} · app ${r.app}", style = Melyviz.readout)
            Text("azonosító ${r.id}", style = Melyviz.readout)
            Text(r.code, style = Melyviz.title.copy(fontSize = 34.sp, letterSpacing = 4.sp, color = Melyviz.glow, fontFamily = Melyviz.mono), modifier = Modifier.padding(vertical = 6.dp))
            Text("Csak akkor hagyd jóvá, ha a másik telefonon pontosan ez a kód látszik.", style = Melyviz.small)
            VrgToggle("A GitHub tokenem is (írás a fiókommal)", withToken) { withToken = it }
            if (withToken) Text("A token az ÖSSZES repódhoz ad írási jogot, nem csak ehhez. Csak saját vagy teljesen megbízható telefonnak.",
                style = Melyviz.small.copy(color = Melyviz.coral))
            Row(Modifier.padding(top = 8.dp)) {
                VrgChip(if (busy) "Írás…" else "Jóváhagyás", true) {
                    if (busy) return@VrgChip
                    scope.launch {
                        onBusy(true)
                        val (link, problem) = Trust.approve(r, withToken)
                        onBusy(false)
                        if (link != null) { onNote("Jóváhagyva: ${r.name}. Mutasd meg neki az engedély QR-kódját."); onDone(link) } else onNote(problem)
                    }
                }
                Spacer(Modifier.width(6.dp))
                VrgChip("Elutasítás") { onCancel() }
            }
        }
    }

    @Composable
    private fun fieldColors() = OutlinedTextFieldDefaults.colors(
        focusedBorderColor = Melyviz.glow, unfocusedBorderColor = Melyviz.line,
        focusedTextColor = Melyviz.ink, unfocusedTextColor = Melyviz.ink, cursorColor = Melyviz.glow,
    )

    private fun share(ctx: android.content.Context, text: String) {
        val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
        runCatching { ctx.startActivity(Intent.createChooser(send, "Küldés").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    }
}
