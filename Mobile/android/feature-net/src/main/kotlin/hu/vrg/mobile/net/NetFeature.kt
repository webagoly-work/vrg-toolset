package hu.vrg.mobile.net

import android.Manifest
import android.app.Application
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.LinkKind
import hu.vrg.mobile.core.MiniStatus
import hu.vrg.mobile.core.NetSettings
import hu.vrg.mobile.core.RelayAddrs
import hu.vrg.mobile.core.Usage
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.HidPhase
import hu.vrg.mobile.kit.HidStatus
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.VrgNotify
import hu.vrg.mobile.kit.relay.Relay
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.ui.VrgSectionTitle
import hu.vrg.mobile.kit.ui.VrgToggle
import hu.vrg.mobile.relay.PairCodes
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

// Hálózat (WP M7, D-9 = A): every way the phone links to the PC and the internet, each with its honest state and,
// where an app cannot switch it, a one-tap link to the settings page plus the one tap left to the person
// (docs/mobile/research/M7-network.md). And the phone's own relay: off until the user starts it, PCs pair with a
// code shown here, then Kódváros (?relay=<address>) and the Planner find it like the PC relay.

object NetFeature : VrgFeature {
    override val info = Catalogue.NET
    private val _activity = MutableStateFlow(MiniStatus.IDLE)
    override val activity: StateFlow<MiniStatus> get() = _activity

    override fun init(app: Application) {
        UsageWatch.load(app)
        PhoneRelayHost.loadDevices(app)
    }

    @Composable
    override fun Screen(host: FeatureHost) {
        val ctx = LocalContext.current
        var snap by remember { mutableStateOf(NetProbe.read(ctx)) }
        LaunchedEffect(Unit) { while (true) { snap = NetProbe.read(ctx); if (UsageWatch.on(ctx)) UsageWatch.sample(ctx, snap); delay(2_000) } }
        val relay by PhoneRelayHost.state.collectAsStateWithLifecycle()
        LaunchedEffect(relay.running) { _activity.value = if (relay.running) MiniStatus.running() else MiniStatus.IDLE }

        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
            Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current),
                modifier = Modifier.clickable { host.home() }.padding(vertical = 8.dp))
            Text("HÁLÓZAT", style = Melyviz.title.copy(fontSize = 18.sp))
            Text(listOfNotNull(if (snap.wifi) "WiFi" else null, if (snap.mobile) "mobilnet" else null).joinToString(" + ")
                .ifEmpty { "nincs internet" }, style = Melyviz.readout)

            RelaySection(ctx, host, snap)
            TetherSection(ctx, host, snap)
            LocalWifiSection(ctx)
            UsageSection(ctx, snap)
            HidSection(ctx, host)
            Spacer(Modifier.height(24.dp))
        }
    }

    // ---- the phone relay -----------------------------------------------------------------------------

    @Composable
    private fun RelaySection(ctx: Context, host: FeatureHost, snap: NetSnapshot) {
        val st by PhoneRelayHost.state.collectAsStateWithLifecycle()
        val peers by PhoneRelayHost.peers.collectAsStateWithLifecycle()
        val devices by PhoneRelayHost.devices.collectAsStateWithLifecycle()
        val code by PhoneRelayHost.code.collectAsStateWithLifecycle()
        val askNotify = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }

        VrgSectionTitle("Telefon relé")
        Text("A PC-s alkalmazások (Kódváros, Planner) a telefonhoz is kapcsolódhatnak, ha nincs PC-s relé — például a telefon hotspotján. Csak párosított PC csatlakozhat.",
            style = Melyviz.small)
        VrgToggle("Relé fut", st.running) { on ->
            if (on) {
                if (VrgNotify.needsPermission(ctx) && Build.VERSION.SDK_INT >= 33) askNotify.launch(Manifest.permission.POST_NOTIFICATIONS)
                PhoneRelayHost.start(ctx)
            } else PhoneRelayHost.stop()
            NetService.kick(ctx)
        }
        st.error?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.coral)) }
        if (st.running) {
            val addrs = RelayAddrs.order(snap.addrs, snap.tether)
            if (addrs.isEmpty()) Text("Nincs hálózat, amin a PC elérné: kapcsold be a WiFit, a hotspotot vagy a Helyi WiFit.",
                style = Melyviz.small.copy(color = Melyviz.sand))
            addrs.forEach { a ->
                val pcText = RelayAddrs.forPc(a, st.port)
                Row(Modifier.fillMaxWidth().padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("${a.address}:${st.port}", style = Melyviz.label, modifier = Modifier.weight(1f))
                    Text(LinkKindLabel(a.name), style = Melyviz.readout.copy(fontSize = 11.sp))
                    Spacer(Modifier.width(8.dp))
                    VrgChip("Másol") { copy(ctx, pcText); host.note("Vágólapon: $pcText") }
                }
            }
            Text("A PC-n: Kódváros …/vrg-codecity.html?relay=<cím>, Planner …/varler_planner.html?relay=<cím>; az első alkalommal a kódot kéri.",
                style = Melyviz.small.copy(color = Melyviz.faint))

            val c = code
            var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
            LaunchedEffect(c) { while (c != null) { now = System.currentTimeMillis(); delay(1_000) } }
            if (c != null && c.expires > now) {
                Text(PairCodes.pretty(c.code), style = Melyviz.title.copy(fontSize = 28.sp, color = Melyviz.glow), modifier = Modifier.padding(top = 8.dp))
                Text("Párosító kód, még ${(c.expires - now) / 1000} mp, egyszer használható.", style = Melyviz.small)
                Row(Modifier.padding(vertical = 6.dp)) { VrgChip("Mégse") { PhoneRelayHost.cancelCode() } }
            } else Row(Modifier.padding(vertical = 6.dp)) {
                VrgChip("Új párosító kód") { PhoneRelayHost.newCode() }
                Spacer(Modifier.width(8.dp))
                VrgChip("Légegér erre a relére") { Relay.connect("ws://127.0.0.1:${st.port}"); host.note("Légegér a telefon reléjén") }
            }

            if (peers.isNotEmpty()) Text("Kapcsolatok", style = Melyviz.label, modifier = Modifier.padding(top = 6.dp))
            peers.forEach { p ->
                Row(Modifier.padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                    Dot(if (p.trusted) Melyviz.glow else Melyviz.sand)
                    Spacer(Modifier.width(8.dp))
                    Text("${p.role ?: "?"} · ${p.device ?: if (p.trusted) "" else "nincs párosítva (30 mp)"} · ${p.remote}", style = Melyviz.readout)
                }
            }
        }
        if (devices.isNotEmpty()) Text("Párosított PC-k", style = Melyviz.label, modifier = Modifier.padding(top = 6.dp))
        devices.forEach { d ->
            Row(Modifier.fillMaxWidth().padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(d.device, style = Melyviz.small, modifier = Modifier.weight(1f))
                VrgChip("Törlés") { if (st.running) PhoneRelayHost.forget(d.id) else PhoneRelayHost.forgetOffline(ctx, d.id) }
            }
        }
    }

    // ---- tethering ---------------------------------------------------------------------------------------

    @Composable
    private fun TetherSection(ctx: Context, host: FeatureHost, snap: NetSnapshot) {
        VrgSectionTitle("Megosztás (internet a PC-nek)")
        Text("Ezeket csak a telefon beállításaiban lehet be- és kikapcsolni; az app mutatja az állapotot és odavisz.",
            style = Melyviz.small)
        LinkRow("WiFi hotspot", snap.tether.hotspot, LinkKind.HOTSPOT, ctx, host)
        LinkRow("USB-megosztás", snap.tether.usb, LinkKind.USB, ctx, host)
        LinkRow("Bluetooth-megosztás", snap.tether.bluetooth, LinkKind.BLUETOOTH, ctx, host)
        Text(if (snap.tether.fromBroadcast) "Forrás: a rendszer jelzése." else "Forrás: a hálózati csatolók neve (becslés; a telefon nem küld jelzést).",
            style = Melyviz.readout.copy(fontSize = 10.sp))
    }

    @Composable
    private fun LinkRow(name: String, on: Boolean, kind: LinkKind, ctx: Context, host: FeatureHost) {
        Column(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Dot(if (on) Melyviz.glow else Melyviz.faint)
                Spacer(Modifier.width(8.dp))
                Text("$name: ${if (on) "be" else "ki"}", style = Melyviz.label, modifier = Modifier.weight(1f))
                VrgChip("Beállítások ›") { if (!NetProbe.open(ctx, NetSettings.TETHER)) host.note("Nem nyílt meg a beállítás.") }
            }
            if (!on) Text(NetSettings.hint(kind), style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(start = 16.dp))
        }
    }

    // ---- local-only WiFi --------------------------------------------------------------------------------

    @Composable
    private fun LocalWifiSection(ctx: Context) {
        val st by LocalWifi.state.collectAsStateWithLifecycle()
        val perms = if (Build.VERSION.SDK_INT >= 33) arrayOf(Manifest.permission.NEARBY_WIFI_DEVICES)
        else arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
        val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { r ->
            if (r.values.all { it }) LocalWifi.start(ctx)
        }
        VrgSectionTitle("Helyi WiFi (internet nélkül)")
        Text("A telefon saját WiFi hálózatot nyit a PC-nek, ahol nincs router. Internet nincs rajta; a telefon relé ezen is elérhető.",
            style = Melyviz.small)
        when (val s = st) {
            is LocalWifi.State.On -> {
                Text("Hálózat: ${s.ssid}", style = Melyviz.label, modifier = Modifier.padding(top = 4.dp))
                s.pass?.let { Text("Jelszó: $it", style = Melyviz.label) }
                Row(Modifier.padding(vertical = 6.dp)) { VrgChip("Leállítás") { LocalWifi.stop() } }
            }
            LocalWifi.State.Starting -> Text("Indul…", style = Melyviz.small)
            else -> {
                if (s is LocalWifi.State.Failed) Text(s.reason, style = Melyviz.small.copy(color = Melyviz.sand))
                Row(Modifier.padding(vertical = 6.dp)) {
                    VrgChip("Indítás") {
                        val missing = perms.any { ctx.checkSelfPermission(it) != android.content.pm.PackageManager.PERMISSION_GRANTED }
                        if (missing) ask.launch(perms) else LocalWifi.start(ctx)
                    }
                }
            }
        }
    }

    // ---- usage ----------------------------------------------------------------------------------------

    @Composable
    private fun UsageSection(ctx: Context, snap: NetSnapshot) {
        val day by UsageWatch.day.collectAsStateWithLifecycle()
        var watch by remember { mutableStateOf(UsageWatch.on(ctx)) }
        var limit by remember { mutableStateOf(UsageWatch.thresholdMb(ctx)) }
        val askNotify = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
        VrgSectionTitle("Adatforgalom")
        Text(if (snap.mobileBytes < 0) "Ez a telefon nem ad forgalmi adatot." else
            "Mobilnet ma: ${Usage.format(day?.today ?: 0)}" + (snap.hotspotBytes?.let { " · hotspot: ${Usage.format(it)}" } ?: ""),
            style = Melyviz.label)
        Text("A napi szám a telefon teljes mobilforgalma attól kezdve, hogy a figyelés aznap először mért; kliensenkénti adat nincs.",
            style = Melyviz.small.copy(color = Melyviz.faint))
        VrgToggle("Figyelés hotspot közben (értesítés)", watch) { on ->
            watch = on
            UsageWatch.setOn(ctx, on)
            if (on && VrgNotify.needsPermission(ctx) && Build.VERSION.SDK_INT >= 33) askNotify.launch(Manifest.permission.POST_NOTIFICATIONS)
            NetService.kick(ctx)
        }
        Text("Figyelmeztetés ennél:", style = Melyviz.small, modifier = Modifier.padding(top = 4.dp))
        Row(Modifier.padding(vertical = 4.dp).horizontalScroll(rememberScrollState())) {
            Usage.THRESHOLDS_MB.forEach { mb ->
                VrgChip(Usage.thresholdLabel(mb), selected = mb == limit) { limit = mb; UsageWatch.setThresholdMb(ctx, mb) }
                Spacer(Modifier.width(4.dp))
            }
        }
        Row { VrgChip("Adathasználat beállítások ›") { NetProbe.open(ctx, NetSettings.DATA_USAGE) } }
    }

    // ---- Bluetooth HID ---------------------------------------------------------------------------------

    @Composable
    private fun HidSection(ctx: Context, host: FeatureHost) {
        val hid by HidStatus.info.collectAsStateWithLifecycle()
        VrgSectionTitle("Bluetooth HID (Légegér)")
        Row(verticalAlignment = Alignment.CenterVertically) {
            Dot(when (hid.phase) {
                HidPhase.CONNECTED -> Melyviz.glow
                HidPhase.READY, HidPhase.CONNECTING, HidPhase.STARTING -> Melyviz.sand
                HidPhase.UNSUPPORTED, HidPhase.NO_PERMISSION -> Melyviz.coral
                else -> Melyviz.faint
            })
            Spacer(Modifier.width(8.dp))
            Text(hid.phase.label + (hid.host?.let { ": $it" } ?: ""), style = Melyviz.label)
        }
        Row(Modifier.padding(vertical = 6.dp)) {
            VrgChip("Légegér ›") { host.open(Catalogue.AIRDECK.id) }
            Spacer(Modifier.width(8.dp))
            VrgChip("Bluetooth beállítások ›") { NetProbe.open(ctx, NetSettings.BLUETOOTH) }
        }
    }

    // ---- small parts ---------------------------------------------------------------------------------

    @Composable
    private fun Dot(c: Color) { Box(Modifier.size(8.dp).clip(CircleShape).background(c)) }

    private fun LinkKindLabel(iface: String) = hu.vrg.mobile.core.NetIfaces.kind(iface).label

    private fun copy(ctx: Context, text: String) {
        ctx.getSystemService(ClipboardManager::class.java)?.setPrimaryClip(ClipData.newPlainText("VRG relé", text))
    }
}
