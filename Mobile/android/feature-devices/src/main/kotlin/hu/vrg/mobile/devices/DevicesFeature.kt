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
import hu.vrg.mobile.kit.Access
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.Trust
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.github.GitHub
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.InstallQrPanel
import hu.vrg.mobile.kit.ui.IphoneGuideView
import hu.vrg.mobile.kit.ui.IphoneGuides
import hu.vrg.mobile.kit.ui.QrCode
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.ui.VrgSectionTitle
import hu.vrg.mobile.kit.ui.VrgToggle
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import hu.vrg.mobile.kit.ScannedLinks
import kotlinx.coroutines.delay

// Eszközök (WP M35): Proton Vault's way in, for VRG Mobile. One account (the owner's GitHub); the phones are what
// differ. A phone that is not on the list shows its request as a QR; the owner's phone reads it (the home's QR
// beolvasás, the phone's camera, or a pasted messenger message), checks the 6-character code by eye, approves — the
// phone goes on Mobile/trust/devices.json on main — and shows a grant QR that only the asking phone can open. With the
// release lock on, only listed phones are offered updates.

object DevicesFeature : VrgFeature {
    override val info = Catalogue.DEVICES

    /** A request or a grant that arrived by link (QR scanner, camera app, messenger), waiting on the screen. */
    private val incoming = MutableStateFlow<DeviceTrust.Parsed?>(null)

    /** The waiting request was read by this phone's own scanner (ScannedLinks), not tapped in a messenger. */
    private val scanned = MutableStateFlow(false)

    /** Bumped on every link that arrives, so the same request scanned again is acted on again (2026-11-20). */
    private val arrivals = MutableStateFlow(0)

    /** While this phone waits for approval it reads the list this often; the owner's approval unlocks it by itself. */
    private const val WAIT_POLL_MS = 10_000L

    override fun open(route: Route): Boolean {
        val req = route.params["req"]
        val raw = req?.let { "req=$it" } ?: route.params["grant"]?.let { "grant=$it" } ?: return route.path.isEmpty()
        scanned.value = req != null && ScannedLinks.consume(req)
        incoming.value = DeviceTrust.read(raw)
        arrivals.value++
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
        val arrival by arrivals.collectAsStateWithLifecycle()
        var note by remember { mutableStateOf<String?>(null) }
        var busy by remember { mutableStateOf(false) }
        var showRequest by remember { mutableStateOf(false) }
        var showInstall by remember { mutableStateOf(false) }
        var showWebQr by remember { mutableStateOf(false) }
        var showGuide by remember { mutableStateOf(false) }
        var grantLink by remember { mutableStateOf<Pair<String, DeviceRequest>?>(null) }
        var name by remember { mutableStateOf(Trust.name) }
        var typedCode by remember { mutableStateOf("") }
        var typedName by remember { mutableStateOf("") }
        val owner = GitHub.canWrite
        // the admin phone (2026-11-19): the list's owner entry, signed in. A request its own scanner reads is approved
        // at once: the QR came straight off the other phone's screen, so the code check by eye adds nothing there.
        // A pasted or messenger request still waits for Jóváhagyás and the code check.
        val admin = Trust.isOwner && owner
        // the full page is the owner's (or a phone holding the owner's token); every other phone gets the short one
        val full = Trust.isOwner || owner
        val listed = list?.has(Trust.id) == true
        LaunchedEffect(Unit) { note = Trust.refresh() }

        // a grant for this phone: open it at once; a request scanned on the admin phone: approve it at once
        // keyed on the arrival too (the same QR scanned twice) and on admin (signed in since the request came: a request
        // the owner's scanner read waits here, and is approved once the owner is back from GitHub fiók with a token)
        LaunchedEffect(inc, arrival, admin) {
            when (val i = inc) {
                is DeviceTrust.Parsed.Grant -> {
                    note = try { "Engedély elfogadva: " + Trust.accept(i.g) } catch (e: Exception) { e.message ?: "Az engedély nem nyílt meg." }
                    incoming.value = null
                }
                is DeviceTrust.Parsed.Req -> if (scanned.value && admin && !busy) {
                    scanned.value = false
                    val r = i.r
                    if (Trust.list.value?.has(r.id) == true) { note = "${r.name} már a listán van."; incoming.value = null; return@LaunchedEffect }
                    busy = true
                    val (link, problem) = Trust.approve(r, false)
                    busy = false
                    if (link != null) {
                        grantLink = link to r; incoming.value = null
                        note = "Jóváhagyva beolvasással: ${r.name} (kód ${r.code}). A másik telefon magától feloldódik, legfeljebb egy perc."
                    } else note = problem   // the card below stays: Jóváhagyás by hand once the problem is fixed
                }
                else -> {}
            }
        }

        // this phone waits for approval: read the list now and then, so the owner's approval unlocks it without a grant QR
        LaunchedEffect(listed) {
            if (listed) return@LaunchedEffect
            while (true) {
                delay(WAIT_POLL_MS)
                Trust.refresh()
                if (Trust.listed) { note = "Jóváhagyva: a telefon feloldva."; break }
            }
        }

        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
            Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current), modifier = Modifier.clickable { host.home() }.padding(vertical = 8.dp))
            Text("ESZKÖZÖK", style = Melyviz.title.copy(fontSize = 18.sp))
            note?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 6.dp)) }

            if (!full) {
                // ---- the short page: every phone but the owner's sees only what it needs
                if (listed) {
                    Text("Ez a telefon jóvá van hagyva.", style = Melyviz.label.copy(color = Melyviz.kelp), modifier = Modifier.padding(top = 10.dp))
                    granted?.let { Text(it, style = Melyviz.small) }
                    Text(Access.code, style = Melyviz.readout, modifier = Modifier.padding(top = 4.dp))
                } else {
                    val req = remember { Trust.request() }
                    val link = DeviceTrust.requestLink(req)
                    Text("Mutasd meg ezt a QR-kódot a tulajdonosnak: ő a saját telefonjával beolvassa.", style = Melyviz.label, modifier = Modifier.padding(top = 10.dp))
                    QrCode(link, Modifier.widthIn(max = 300.dp).fillMaxWidth().padding(vertical = 8.dp), "A hozzáférés-kérés QR-kódja")
                    Text("Kód: ${req.code}", style = Melyviz.title.copy(fontSize = 20.sp, fontFamily = Melyviz.mono))
                    Text("Jóváhagyásra vár… a telefon magától feloldódik.", style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 4.dp))
                    Row(Modifier.padding(vertical = 8.dp)) {
                        VrgChip("Megosztás") { share(ctx, "VRG Mobile hozzáférés-kérés (${req.name}, kód ${req.code}):\n$link") }
                        Spacer(Modifier.width(6.dp))
                        VrgChip("Engedély beillesztése") { clipboard.getText()?.text?.let { incoming.value = DeviceTrust.read(it) } ?: run { note = "A vágólap üres." } }
                    }
                }
                (inc as? DeviceTrust.Parsed.Bad)?.let { Text(it.why, style = Melyviz.small.copy(color = Melyviz.coral)) }
                (inc as? DeviceTrust.Parsed.Req)?.r?.let { r -> NeedsSignIn(r, host, ownerPhone = false) }
                Spacer(Modifier.height(24.dp))
                return@Column
            }

            // ---- the full page (the owner)
            Text("Egy fiók (a tulajdonosé), a telefonok különböznek: mindegyiket QR-kóddal hagyja jóvá a tulajdonos telefonja.", style = Melyviz.small)

            // ---- this phone
            VrgSectionTitle("Ez a telefon")
            Text(Access.code, style = Melyviz.title.copy(fontSize = 24.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp, color = Melyviz.glow, fontFamily = Melyviz.mono))
            val status = when {
                list == null -> "A lista még nincs beolvasva."
                Trust.isOwner -> "Tulajdonos" + if (admin) " · a beolvasott kéréseket azonnal jóváhagyja." else " · jóváhagyáshoz GitHub belépés kell."
                listed -> "Jóváhagyott eszköz" + (granted?.let { ": $it" } ?: ".")
                else -> "Nincs a megbízható eszközök között."
            }
            Text(status, style = Melyviz.label.copy(color = if (listed) Melyviz.kelp else Melyviz.sand))
            if (Trust.isOwner && !owner) {
                Text(if (GitHub.signedIn) "A repó nevével vagy belépve: ez csak olvasás. A jóváhagyás a listát írja, ehhez tokenes (eszközkódos) GitHub belépés kell."
                    else "Nincs GitHub belépés (vagy lejárt). A jóváhagyás a listát írja, ehhez tokenes (eszközkódos) belépés kell.",
                    style = Melyviz.small.copy(color = Melyviz.coral))
                Row(Modifier.padding(vertical = 6.dp)) { VrgChip("GitHub belépés ›", true) { host.open(Catalogue.ACCOUNT.id) } }
            }
            if (list?.gated == true) Text(if (Trust.updatesAllowed()) "Frissítést kaphat." else "Frissítést csak jóváhagyás után kap (a kiadások zárolva).", style = Melyviz.small)
            OutlinedTextField(name, { name = it.take(40) }, Modifier.fillMaxWidth().padding(top = 6.dp), singleLine = true,
                label = { Text("A telefon neve a listán", style = Melyviz.small) }, colors = fieldColors())
            Row(Modifier.padding(vertical = 6.dp)) {
                if (name != Trust.name) { VrgChip("Név mentése", true) { Trust.name = name; note = "Mentve." }; Spacer(Modifier.width(6.dp)) }
                VrgChip("Lista frissítése") { scope.launch { busy = true; note = Trust.refresh() ?: "A lista friss."; busy = false } }
            }

            if (!listed || showRequest) {
                VrgSectionTitle("Hozzáférés kérése")
                if (!showRequest && listed) VrgChip("Kérés QR-kódja", true) { showRequest = true }
                else {
                    val req = remember { Trust.request() }
                    val link = DeviceTrust.requestLink(req)
                    QrCode(link, Modifier.widthIn(max = 300.dp).fillMaxWidth().padding(vertical = 8.dp), "A hozzáférés-kérés QR-kódja")
                    Text("Ellenőrző kód: ${req.code}", style = Melyviz.title.copy(fontSize = 20.sp, fontFamily = Melyviz.mono))
                    Row(Modifier.padding(vertical = 6.dp)) {
                        VrgChip("Megosztás") { share(ctx, "VRG Mobile hozzáférés-kérés (${req.name}, kód ${req.code}):\n$link") }
                        Spacer(Modifier.width(6.dp))
                        if (listed) VrgChip("Elrejtés") { showRequest = false }
                    }
                }
                Row(Modifier.padding(vertical = 6.dp)) {
                    VrgChip("Engedély beillesztése") { clipboard.getText()?.text?.let { incoming.value = DeviceTrust.read(it) } ?: run { note = "A vágólap üres." } }
                }
            }

            // ---- the owner's side
            if (owner) {
                VrgSectionTitle("Jóváhagyás (tulajdonos)")
                Text(if (admin) "Olvasd be a másik telefon kérés-QR-ját (kezdőlap: QR beolvasás): azonnal jóváhagyja, a másik telefon magától feloldódik. Messengeren kapott kérést illessz be (ott a kódot ellenőrizd)."
                    else "Egy kérés QR-kódját a kezdőlap QR beolvasásával vagy a kamerával olvasd be; messengeren kapott kérést illessz be.", style = Melyviz.small)
                Row(Modifier.padding(vertical = 6.dp)) {
                    VrgChip("QR beolvasása ›") { host.open(Catalogue.PAIR.id) }
                    Spacer(Modifier.width(6.dp))
                    VrgChip("Kérés beillesztése") { clipboard.getText()?.text?.let { scanned.value = false; incoming.value = DeviceTrust.read(it) } ?: run { note = "A vágólap üres." } }
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
                } else InstallQrPanel(onClose = { showInstall = false })
            }
            // ---- the fallback (2026-11-20): the owner's own phone only. When the QR will not do, the other phone's
            // Eszközkód (big on its lock screen) is typed here and sent: it goes on the list, the phone unlocks itself.
            if (Trust.isOwner) {
                VrgSectionTitle("Jóváhagyás eszközkóddal (tartalék)")
                Text("Ha a QR nem megy: írd be a másik telefon zárképernyőjén látható eszközkódot, és küldd el. A telefon felkerül a listára, " +
                    "és 1–5 percen belül magától feloldódik. Itt nincs ellenőrző kód, ezért csak olyan kódot írj be, amit magad láttál azon a telefonon.",
                    style = Melyviz.small)
                OutlinedTextField(typedCode, { typedCode = it.uppercase().take(16) }, Modifier.fillMaxWidth().padding(top = 6.dp), singleLine = true,
                    label = { Text("Eszközkód (XXXX-XXXX-XXXX)", style = Melyviz.small) }, colors = fieldColors())
                OutlinedTextField(typedName, { typedName = it.take(40) }, Modifier.fillMaxWidth().padding(top = 4.dp), singleLine = true,
                    label = { Text("Név a listán (nem kötelező)", style = Melyviz.small) }, colors = fieldColors())
                val ok = DeviceTrust.typedCode(typedCode)
                if (typedCode.isNotBlank()) Text(if (ok != null) "→ $ok" else "12 betű vagy szám kell (kötőjel nélkül is jó).",
                    style = Melyviz.small.copy(color = if (ok != null) Melyviz.kelp else Melyviz.coral))
                Row(Modifier.padding(vertical = 6.dp)) {
                    if (!owner) VrgChip("GitHub belépés ›", true) { host.open(Catalogue.ACCOUNT.id) }
                    else VrgChip(if (busy) "Küldés…" else "Küldés", ok != null) {
                        if (busy || ok == null) return@VrgChip
                        scope.launch {
                            busy = true
                            val problem = Trust.approveByCode(typedCode, typedName)
                            busy = false
                            note = problem ?: "Felvéve: ${typedName.trim().ifBlank { ok }} ($ok). A másik telefon magától feloldódik (1–5 perc), ha a zárképernyője nyitva van."
                            if (problem == null) { typedCode = ""; typedName = "" }
                        }
                    }
                }
                if (!owner) Text("A küldéshez tokenes GitHub belépés kell.", style = Melyviz.small.copy(color = Melyviz.coral))
            }
            // ---- iPhone (2026-11-20): an iPhone runs the web app (WP M36), not the APK. The guide is the same file the
            // web app shows (Mobile/web/guide/iphone.json, bundled); the QR opens the web app in the iPhone's camera.
            VrgSectionTitle("iPhone csatlakoztatása")
            Text("Az iPhone nem telepítheti az Android alkalmazást: a VRG Mobile webappot használja, és ugyanígy, QR-kóddal hagyod jóvá. " +
                "1. az iPhone Kamerájával beolvassa a Webapp QR-t, 2. ott Eszköz → Kérés QR-kódja, 3. te QR beolvasása, 4. az iPhone magától feloldódik.",
                style = Melyviz.small)
            Row(Modifier.padding(vertical = 6.dp)) {
                VrgChip(if (showWebQr) "Webapp QR elrejtése" else "Webapp QR", !showWebQr) { showWebQr = !showWebQr }
                Spacer(Modifier.width(6.dp))
                VrgChip(if (showGuide) "Útmutató elrejtése" else "Részletes útmutató") { showGuide = !showGuide }
            }
            if (showWebQr) {
                val url = IphoneGuides.load(ctx)?.url ?: "https://webagoly-work.github.io/vrg-toolset/mobile/"
                QrCode(url, Modifier.widthIn(max = 300.dp).fillMaxWidth().padding(vertical = 8.dp), "A VRG Mobile webapp címe QR-kódban")
                Text("Az iPhone Kamera alkalmazásával olvasd be, és koppints a sárga „Safari” feliratra.", style = Melyviz.small)
                Text(url, style = Melyviz.readout.copy(fontSize = 10.sp))
                Row(Modifier.padding(vertical = 6.dp)) { VrgChip("Link megosztása") { share(ctx, "VRG Mobile iPhone-ra (webapp):\n$url") } }
            }
            if (showGuide) IphoneGuideView(Modifier.padding(vertical = 6.dp))
            (inc as? DeviceTrust.Parsed.Bad)?.let { Text(it.why, style = Melyviz.small.copy(color = Melyviz.coral)) }
            (inc as? DeviceTrust.Parsed.Req)?.r?.let { r ->
                if (!owner) NeedsSignIn(r, host, ownerPhone = Trust.isOwner)
                else if (busy && admin) Text("Jóváhagyás…", style = Melyviz.small)
                else Approve(r, busy, onDone = { link -> grantLink = link to r; incoming.value = null }, onBusy = { busy = it }, onNote = { note = it },
                    onCancel = { incoming.value = null })
            }
            grantLink?.let { (link, r) ->
                VrgSectionTitle("Engedély: ${r.name}")
                QrCode(link, Modifier.widthIn(max = 300.dp).fillMaxWidth().padding(vertical = 8.dp), "Az engedély QR-kódja")
                Text(if (r.back != null) "iPhone: magától feloldódik, ha az Eszköz oldal nyitva marad (legfeljebb néhány perc). Azonnalihoz vagy tokennel: Safariban a Kamerájával olvassa be ezt; kezdőképernyős appban a megosztott üzenetet illessze be (Eszköz → Engedély beillesztése)."
                    else "Nem kötelező: a másik telefon magától feloldódik (legfeljebb egy perc). Ha azonnal kell, a kamerájával olvassa be.",
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

    /** A request arrived on a phone without a GitHub token: show it (with its code) and the way to sign in. It stays here;
     *  back from GitHub fiók with a token, a scanned one is approved at once, a pasted one gets the Jóváhagyás card. */
    @Composable
    private fun NeedsSignIn(r: DeviceRequest, host: FeatureHost, ownerPhone: Boolean) {
        val shape = RoundedCornerShape(Melyviz.radius)
        Column(Modifier.fillMaxWidth().padding(vertical = 8.dp).clip(shape).background(Melyviz.raised).border(2.dp, Melyviz.sand, shape).padding(14.dp)) {
            Text("KÉRÉS: ${r.name}", style = Melyviz.title)
            Text(r.code, style = Melyviz.title.copy(fontSize = 34.sp, letterSpacing = 4.sp, color = Melyviz.glow, fontFamily = Melyviz.mono), modifier = Modifier.padding(vertical = 6.dp))
            Text(if (ownerPhone) "Ez a te telefonod, de a jóváhagyáshoz GitHub-írás kell. Lépj be eszközkóddal (GitHub fiók → Belépés), " +
                    "majd gyere vissza ide: a kérés megvárja, és beolvasott kérésnél azonnal jóváhagyja."
                else "Jóváhagyni a tulajdonos telefonja tud, tokenes GitHub belépéssel. Ha ez a tulajdonos telefonja, lépj be, majd gyere vissza ide: a kérés megvárja.",
                style = Melyviz.small)
            Row(Modifier.padding(top = 8.dp)) {
                VrgChip("GitHub belépés ›", true) { host.open(Catalogue.ACCOUNT.id) }
                Spacer(Modifier.width(6.dp))
                VrgChip("Elvetés") { incoming.value = null; scanned.value = false }
            }
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
