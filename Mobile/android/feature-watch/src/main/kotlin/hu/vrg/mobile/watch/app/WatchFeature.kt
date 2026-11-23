package hu.vrg.mobile.watch.app

import android.Manifest
import android.app.Application
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.MiniStatus
import hu.vrg.mobile.core.Route
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.VrgNotify
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.ui.VrgSectionTitle
import hu.vrg.mobile.kit.ui.VrgToggle
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// Óra (WP M65, round 1 = Q1–Q3, D-170): the Q71 watch with VRG Mobile instead of FunDo (D-168). Kapcsolat (the LE link,
// a foreground service while on), the time set on every connect, Óra adatai (GET,0), today's steps (GET,10), Óra keresése
// (the watch rings) and Telefonkeresés (the watch's find phone rings this phone through its own GATT server).

object WatchFeature : VrgFeature {
    override val info = Catalogue.WATCH
    private val _activity = MutableStateFlow(MiniStatus.IDLE)
    override val activity: StateFlow<MiniStatus> get() = _activity

    override fun init(app: Application) {
        WatchService.channels(app)
        // Kapcsolat stays on across app restarts only by the user's choice; the service itself is not sticky
        if (Watch.wanted(app) && Watch.allowed(app)) runCatching { WatchService.start(app) }
    }

    /** vrg://watch (the service's notifications open it). */
    override fun open(route: Route): Boolean = true

    @Composable
    override fun Screen(host: FeatureHost) {
        val ctx = LocalContext.current
        val link by Watch.link.collectAsStateWithLifecycle()
        val version by Watch.version.collectAsStateWithLifecycle()
        val info by Watch.info.collectAsStateWithLifecycle()
        val steps by Watch.steps.collectAsStateWithLifecycle()
        val acky by Watch.addresses.collectAsStateWithLifecycle()
        val watchRinging by Watch.watchRinging.collectAsStateWithLifecycle()
        val phoneRinging by Watch.phoneRinging.collectAsStateWithLifecycle()
        val serverUp by Watch.serverUp.collectAsStateWithLifecycle()
        val synced by Watch.lastTimeSync.collectAsStateWithLifecycle()
        val note by Watch.note.collectAsStateWithLifecycle()
        var allowed by remember { mutableStateOf(Watch.allowed(ctx)) }
        var canScan by remember { mutableStateOf(Watch.canScan(ctx)) }
        val remembered = Watch.address(ctx)
        var bgFree by remember { mutableStateOf(Watch.backgroundFree(ctx)) }
        var autostart by remember { mutableStateOf(BackgroundSettings.autostart(ctx)) }
        var sureForget by remember { mutableStateOf(false) }
        val on = link != Watch.Link.OFF && link != Watch.Link.NO_PERMISSION
        val ready = link == Watch.Link.READY
        // the actions that need the live link say so when tapped without it, instead of doing nothing
        val needLink = { host.note("Csak élő kapcsolattal (most: ${link.hu}).") }

        LaunchedEffect(link) { _activity.value = if (ready) MiniStatus.running() else MiniStatus.IDLE }
        val askBt = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { allowed = Watch.allowed(ctx) }
        val askNotify = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
        val askLocation = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
            canScan = Watch.canScan(ctx)
            // refused without a dialog ("don't ask again", or a capped manifest): the app's settings page instead
            if (canScan) WatchService.reconnect() else BackgroundSettings.openAppDetails(ctx)
        }

        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
            Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current),
                modifier = Modifier.heightIn(min = 48.dp).clickable { host.home() }.wrapContentHeight(Alignment.CenterVertically).padding(end = 12.dp))
            Text("ÓRA", style = Melyviz.title.copy(fontSize = 18.sp))
            Text("Q71 a FunDo nélkül · kapcsolat: ${link.hu}", style = Melyviz.readout)

            if (!allowed) Column(Modifier.padding(top = 6.dp)) {
                Text("Az órához Bluetooth engedély kell (Android 9–11-en helymeghatározás).", style = Melyviz.small.copy(color = Melyviz.coral))
                VrgChip("Engedélyezés", selected = true) { askBt.launch(Watch.permissions()) }
            }
            if (remembered == null && !canScan) Column(Modifier.padding(top = 6.dp)) {
                Text("Az óra első megkereséséhez helymeghatározási engedély is kell (csak a kereséshez; a megjegyzett órához " +
                    "nélküle is visszakapcsolódik).", style = Melyviz.small.copy(color = Melyviz.coral))
                VrgChip("Helymeghatározás engedélyezése", selected = true) { askLocation.launch(Watch.locationPermissions) }
            }

            VrgSectionTitle("Kapcsolat")
            VrgToggle("Kapcsolat az órával", on) { want ->
                if (want) {
                    if (VrgNotify.needsPermission(ctx) && Build.VERSION.SDK_INT >= 33) askNotify.launch(Manifest.permission.POST_NOTIFICATIONS)
                    if (Watch.allowed(ctx)) WatchService.start(ctx) else askBt.launch(Watch.permissions())
                } else WatchService.stop(ctx)
            }
            Text("Előtte kapcsold ki a FunDo-t (Beállítások → Alkalmazások → FunDo → Letiltás, vagy vedd el az értesítés-" +
                "hozzáférését): a kényszerített leállítás nem elég, az Android azonnal újraindítja, és ketten elveszik egymás " +
                "elől az óra üzeneteit. Párosítani nem kell: a FunDo sem párosítja.", style = Melyviz.small)
            note?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand)) }
            if (on) Text("A telefon saját szervere (telefonkereséshez): ${if (serverUp) "fut" else "nem indult"}",
                style = Melyviz.readout.copy(color = if (serverUp) Melyviz.kelp else Melyviz.coral))

            VrgSectionTitle("Óra keresése")
            Row(Modifier.padding(top = 4.dp)) {
                if (watchRinging) VrgChip("■ Állj", selected = true) { WatchService.findWatch(false) }
                else VrgChip("🔔 Óra keresése", selected = false) { if (ready) WatchService.findWatch(true) else needLink() }
            }
            if (!ready) Text("Csak élő kapcsolattal.", style = Melyviz.small.copy(color = Melyviz.faint))

            VrgSectionTitle("Telefonkeresés")
            Text("Az óra „Telefon keresése” menüje ezt a telefont csörgeti meg, némítás mellett is, amíg a kapcsolat él. " +
                "Az óra vagy a Megvan leállítja; egy perc után magától is elhallgat.", style = Melyviz.small)
            if (phoneRinging) VrgChip("Megvan", selected = true) { PhoneRing.stop(ctx) }

            VrgSectionTitle("Háttérfutás")
            Text("Hogy az óra akkor is megcsörgethesse a telefont, ha a VRG Mobile nincs megnyitva, a kapcsolat a " +
                "háttérben fut, és újraindul a telefon újraindítása és az app frissítése után is.", style = Melyviz.small)
            Text("Mindhárom beállítás egy gombnyomásra nyílik; a beállítás után gyere vissza ide.", style = Melyviz.small)

            // 1 · Android battery optimisation (every phone)
            Text(if (bgFree) "1 · Akkumulátor-optimalizálás: kikapcsolva (jó)" else "1 · Akkumulátor-optimalizálás: bekapcsolva, a telefon leállíthatja",
                style = Melyviz.readout.copy(color = if (bgFree) Melyviz.kelp else Melyviz.coral), modifier = Modifier.padding(top = 6.dp))
            VrgChip(if (bgFree) "Akkumulátor-optimalizálás megnyitása" else "Háttérfutás engedélyezése", selected = !bgFree) {
                BackgroundSettings.openBatteryOptimisation(ctx)
            }

            if (BackgroundSettings.isXiaomi) {
                // 2 · Xiaomi autostart (also what lets the boot / update restart run)
                Text(when (autostart) {
                    true -> "2 · Automatikus indítás: bekapcsolva (jó)"
                    false -> "2 · Automatikus indítás: kikapcsolva, újraindítás után nem indul el"
                    null -> "2 · Automatikus indítás: a telefon nem mondja meg, nézd meg"
                }, style = Melyviz.readout.copy(color = when (autostart) { true -> Melyviz.kelp; false -> Melyviz.coral; null -> Melyviz.sand }),
                    modifier = Modifier.padding(top = 8.dp))
                VrgChip("Automatikus indítás", selected = autostart == false) { BackgroundSettings.openAutostart(ctx) }

                // 3 · Xiaomi battery saver for this app (not readable from an app)
                Text("3 · Akkumulátorkímélő: állítsd „Nincs korlátozás”-ra (HyperOS-en: Akkumulátor sor; az app nem tudja kiolvasni)",
                    style = Melyviz.readout.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 8.dp))
                VrgChip("Akkumulátorkímélő") { BackgroundSettings.openBatterySaver(ctx) }
            }

            Row(Modifier.padding(top = 8.dp)) {
                VrgChip("App beállításai") { BackgroundSettings.openAppDetails(ctx) }
            }

            VrgSectionTitle("Idő")
            Text(if (synced > 0) "Beállítva: ${clock(synced)} (minden kapcsolódáskor magától)" else "Kapcsolódáskor magától beállítom.",
                style = Melyviz.small)
            VrgChip("Idő beállítása most") { if (ready) WatchService.timeSync() else needLink() }

            VrgSectionTitle("Ma")
            Text(steps?.let { "${it.steps} lépés" } ?: "—", style = Melyviz.title.copy(fontSize = 36.sp,
                color = if (steps != null) Melyviz.glow else Melyviz.faint))
            steps?.let { s -> info?.stepGoal?.let { g -> Text("cél: $g · ${s.day}", style = Melyviz.readout) } }
            VrgChip("Frissítés") { if (ready) WatchService.readAll() else needLink() }

            VrgSectionTitle("Óra adatai")
            if (info == null && version == null) Text("Kapcsolódás után látszik.", style = Melyviz.small.copy(color = Melyviz.faint))
            version?.let { Text("protokoll: $it", style = Melyviz.readout) }
            info?.let { i ->
                i.firmware?.let { Text("firmware: $it", style = Melyviz.readout) }
                if (i.width != null) Text("kijelző: ${i.width} × ${i.height}", style = Melyviz.readout)
                i.mac?.let { Text("klasszikus cím: $it", style = Melyviz.readout) }
                if (i.heightCm != null) Text("profil: ${i.heightCm} cm, ${i.weightKg} kg", style = Melyviz.readout)
                i.batteryGuess?.let { Text("elem: $it % (feltételezés: még ellenőrizni kell)", style = Melyviz.readout.copy(color = Melyviz.sand)) }
            }
            acky?.let { a -> Text("BLE cím: ${a.le ?: "?"} · név: ${a.name ?: "?"}", style = Melyviz.readout) }
            Watch.address(ctx)?.let { addr ->
                Text("megjegyzett óra: $addr", style = Melyviz.readout)
                VrgChip(if (sureForget) "Biztosan elfelejtem" else "Elfelejtés (újrakeresés)", selected = sureForget) {
                    if (!sureForget) sureForget = true else { Watch.remember(ctx, null); sureForget = false; WatchService.reconnect() }
                }
            }

            VrgSectionTitle("Tudnivalók")
            listOf(
                "Kísérleti (WP M65, 1. kör). Az óra protokollját mi fejtettük meg; a FunDo kódjából semmi nincs benne.",
                "Az óra csak egy telefon-appal beszél egyszerre: amíg itt a Kapcsolat be van kapcsolva, a FunDo ne fusson.",
                "Szoftvert, frissítést soha nem küld az órára; csak időt, kérdést és csipogtatást.",
                "Következik: időjárás, értesítések, mérések, saját számlapok (WP M65 Q4–Q7).",
            ).forEach { Text("• $it", style = Melyviz.small, modifier = Modifier.padding(vertical = 2.dp)) }
            Spacer(Modifier.height(24.dp))
        }
        LaunchedEffect(Unit) { while (true) { allowed = Watch.allowed(ctx); canScan = Watch.canScan(ctx); bgFree = Watch.backgroundFree(ctx); autostart = BackgroundSettings.autostart(ctx); delay(2_000) } }
    }

    private fun clock(ms: Long) = SimpleDateFormat("HH:mm:ss", Locale("hu")).format(Date(ms))

}
