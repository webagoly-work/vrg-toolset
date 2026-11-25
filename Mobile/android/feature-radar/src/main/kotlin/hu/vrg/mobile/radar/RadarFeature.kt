package hu.vrg.mobile.radar

import android.Manifest
import android.annotation.SuppressLint
import android.app.Application
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import hu.vrg.mobile.core.BearingSweep
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.LatLon
import hu.vrg.mobile.core.MiniStatus
import hu.vrg.mobile.core.Radar
import hu.vrg.mobile.core.RadarFrame
import hu.vrg.mobile.core.RadarHub
import hu.vrg.mobile.core.RadarMode
import hu.vrg.mobile.core.RadarSnapshot
import hu.vrg.mobile.core.RadarText
import hu.vrg.mobile.core.Route
import hu.vrg.mobile.kit.Compass
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.ui.VrgRadar
import hu.vrg.mobile.kit.ui.VrgSectionTitle
import hu.vrg.mobile.kit.ui.find
import hu.vrg.mobile.kit.ui.radarDescribe
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

// Radar (WP M67, D-173 … D-175): the universal locator, proximity and connection display. Everything any program has
// registered in RadarHub on one radar, each layer in its tone: the Tárgykereső's tags and paired devices, the Csipogó
// crew, the Óra, and whatever comes later. Bluetooth gives distances; directions come from places (GPS) and from
// Irány keresése — hold the phone in front of you and turn round once, slowly: your body shadows the signal, so the
// strongest heading points to the device (kit-core BearingSweep). The found bearing is kept on the compass (RadarHub),
// so the blip stays where it is while you turn, for ten minutes.

object RadarFeature : VrgFeature {
    override val info = Catalogue.RADAR
    private val _activity = MutableStateFlow(MiniStatus.IDLE)
    override val activity: StateFlow<MiniStatus> get() = _activity

    private const val PREFS = "radar"

    override fun init(app: Application) {}

    /** vrg://radar[?focus=<blip id>] */
    override fun open(route: Route): Boolean { route.params["focus"]?.let { focus.value = it }; return true }

    private val focus = MutableStateFlow<String?>(null)

    private fun hiddenOf(ctx: Context): Set<String> =
        ctx.getSharedPreferences(PREFS, 0).getStringSet("hidden", emptySet())?.toSet() ?: emptySet()
    private fun saveHidden(ctx: Context, s: Set<String>) = ctx.getSharedPreferences(PREFS, 0).edit().putStringSet("hidden", s).apply()

    private fun placeAllowed(ctx: Context) = listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
        .any { ctx.checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }

    /** The phone's last known place: no fix is started (nothing spent); null when unknown or older than 10 minutes. */
    @SuppressLint("MissingPermission")
    private fun lastPlace(ctx: Context): LatLon? {
        if (!placeAllowed(ctx)) return null
        val lm = ctx.getSystemService(LocationManager::class.java) ?: return null
        val l = runCatching { lm.getProviders(true).mapNotNull { lm.getLastKnownLocation(it) }.maxByOrNull { it.time } }.getOrNull() ?: return null
        return if (System.currentTimeMillis() - l.time > 10 * 60_000L) null else LatLon(l.latitude, l.longitude)
    }

    /** Megosztás: the frame as a vrg.radar-frame snapshot through Android's share sheet (the Data Vault's Radarom keeps it). */
    private fun share(ctx: Context, frame: RadarFrame, sweeps: Map<String, Double>, hidden: Set<String>) {
        val app = "VRG Mobile " + (runCatching { ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName }.getOrNull() ?: "?")
        val json = RadarSnapshot.encode(frame, sweeps, java.time.Instant.now().toString(), app, hidden)
        val send = Intent(Intent.ACTION_SEND).setType("text/plain")
            .putExtra(Intent.EXTRA_SUBJECT, "Radar pillanatkép")
            .putExtra(Intent.EXTRA_TEXT, json)
        runCatching { ctx.startActivity(Intent.createChooser(send, "Radar megosztása").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    }

    @Composable
    override fun Screen(host: FeatureHost) {
        val ctx = LocalContext.current
        var mode by rememberSaveable { mutableStateOf(RadarMode.HEADING_UP) }
        var hidden by remember { mutableStateOf(hiddenOf(ctx)) }
        var selected by rememberSaveable { mutableStateOf(focus.value) }
        var frame by remember { mutableStateOf(RadarFrame(emptyList(), emptyList())) }
        var sweeps by remember { mutableStateOf(emptyMap<String, Double>()) }
        var here by remember { mutableStateOf<LatLon?>(null) }
        var sweep by remember { mutableStateOf<BearingSweep?>(null) }
        var sweepFor by remember { mutableStateOf<String?>(null) }
        var sweepText by remember { mutableStateOf<String?>(null) }
        val askPlace = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { here = lastPlace(ctx) }

        DisposableEffect(Unit) {
            Compass.start(ctx)
            RadarHub.watch(true)
            _activity.value = MiniStatus.running()
            onDispose { Compass.stop(); RadarHub.watch(false); _activity.value = MiniStatus.IDLE }
        }
        LaunchedEffect(Unit) {
            focus.value?.let { selected = it; focus.value = null }
            var tick = 0
            while (true) {
                val now = System.currentTimeMillis()
                if (tick % 120 == 0) here = lastPlace(ctx)                        // every 30 s
                val heading = Compass.heading.value
                frame = RadarHub.frame(now, heading, here, mode)
                sweeps = RadarHub.sweeps(now)
                val sw = sweep; val id = sweepFor
                if (sw != null && id != null) {
                    val rssi = frame.blips.firstOrNull { it.id == id }?.rssi
                    if (heading != null && rssi != null) sw.add(heading, rssi)
                    sweepText = RadarText.sweepHint(sw.coverage, sw.result())
                }
                tick++
                delay(250)
            }
        }
        LaunchedEffect(sweep) { host.keepScreenOn(sweep != null) }

        val layout = remember(frame, hidden, sweeps) { Radar.layout(frame, hidden, sweeps) }
        val chosen = layout.find(selected)
        val heading = Compass.heading.value

        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
            Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current),
                modifier = Modifier.clickable { host.home() }.padding(vertical = 8.dp))
            Text("RADAR", style = Melyviz.title.copy(fontSize = 18.sp))
            Text("Ami körülötted van, minden programból egy helyen: címkék, párosított eszközök, a Csipogó brigád, az óra.",
                style = Melyviz.small)

            VrgRadar(
                frame = frame.copy(mode = mode), modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                hidden = hidden, sweeps = sweeps, selected = selected,
                onSelect = { selected = it },
                onToggleLayer = { id -> hidden = if (id in hidden) hidden - id else hidden + id; saveHidden(ctx, hidden) },
            )

            Row(Modifier.padding(top = 8.dp).horizontalScroll(rememberScrollState())) {
                VrgChip(if (mode == RadarMode.HEADING_UP) "Irány fel" else "Észak fel", selected = true) {
                    mode = if (mode == RadarMode.HEADING_UP) RadarMode.NORTH_UP else RadarMode.HEADING_UP
                }
                Spacer(Modifier.width(6.dp))
                VrgChip("Megosztás") { share(ctx, frame.copy(mode = mode), sweeps, hidden) }
                Spacer(Modifier.width(6.dp))
                if (here == null) VrgChip(if (placeAllowed(ctx)) "Nincs friss hely" else "Hely a GPS-irányokhoz") {
                    if (!placeAllowed(ctx)) askPlace.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
                    else here = lastPlace(ctx)
                }
            }
            if (heading == null) Text("Nincs iránytű-adat: a radar északkal felfelé áll.", style = Melyviz.small.copy(color = Melyviz.sand))

            if (frame.layers.isEmpty()) Text("Még egy program sem adott pontot. A Tárgykereső, a Csipogó és az Óra kapcsolja be a saját rétegét, ha fut.",
                style = Melyviz.small, modifier = Modifier.padding(top = 8.dp))

            // the selected blip
            if (chosen != null) {
                val layer = frame.layers.firstOrNull { it.id == chosen.blip.layer }
                VrgSectionTitle(chosen.blip.label)
                Text(radarDescribe(chosen, layer?.title), style = Melyviz.readout)
                Text("Utoljára: ${if (chosen.blip.ageMs < 5_000) "most" else "${chosen.blip.ageMs / 1000} mp-e"}" +
                    (chosen.blip.rssi?.let { " · $it dBm" } ?: ""), style = Melyviz.small)
                Row(Modifier.padding(top = 6.dp).horizontalScroll(rememberScrollState())) {
                    layer?.feature?.let { f -> VrgChip("Megnyitás: ${layer.title}") { host.open(f) }; Spacer(Modifier.width(6.dp)) }
                    if (chosen.blip.rssi != null && sweep == null) VrgChip("Irány keresése", selected = true) {
                        sweep = BearingSweep(); sweepFor = chosen.blip.id; sweepText = RadarText.sweepHint(0.0, null)
                    }
                    if (RadarHub.sweep(chosen.blip.id, System.currentTimeMillis()) != null && sweep == null) {
                        Spacer(Modifier.width(6.dp))
                        VrgChip("Irány törlése") { RadarHub.dropSweep(chosen.blip.id); sweeps = RadarHub.sweeps(System.currentTimeMillis()) }
                    }
                }
                if (chosen.blip.rssi == null && chosen.bearingSrc == hu.vrg.mobile.core.BearingSource.NONE)
                    Text("Ehhez nincs élő jelerősség, így iránya sem kereshető (csak a kapcsolata látszik).", style = Melyviz.small.copy(color = Melyviz.faint))
            }

            // Irány keresése in progress
            if (sweep != null) {
                VrgSectionTitle("Irány keresése")
                Text("Tartsd a telefont magad előtt, és fordulj lassan egyszer körbe (kb. 20 másodperc). A tested árnyékolja a jelet: " +
                    "arra a legerősebb, amerre az eszköz van.", style = Melyviz.small)
                sweepText?.let { Text(it, style = Melyviz.label.copy(color = Melyviz.glow), modifier = Modifier.padding(vertical = 4.dp)) }
                Row {
                    val res = sweep?.result()
                    VrgChip("Kész", selected = res != null && res.confidence >= 0.15) {
                        val r = sweep?.result(); val id = sweepFor
                        if (r != null && id != null && r.confidence >= 0.15) RadarHub.keepSweep(id, r.bearingDeg, r.confidence, System.currentTimeMillis())
                        sweep = null; sweepFor = null; sweeps = RadarHub.sweeps(System.currentTimeMillis())
                    }
                    Spacer(Modifier.width(6.dp))
                    VrgChip("Újra") { sweep = BearingSweep() }
                    Spacer(Modifier.width(6.dp))
                    VrgChip("Mégse") { sweep = null; sweepFor = null }
                }
            }

            VrgSectionTitle("Jelmagyarázat")
            listOf(
                "Telt pont: ismert irány (iránytű, GPS vagy Irány keresése). Szaggatott üres pont: csak a távolsága ismert.",
                "A körök logaritmikusak: a közeli dolgoknak több hely jut. A külső szaggatott kör: távolság ismeretlen.",
                "Gyűrű a pont körül: a tiéd. Lüktető piros: riasztás. Kis nyíl: közeledik (befelé) vagy távolodik.",
                "A távolság Bluetooth-jelerősségből becsült érték, nem mérőszalag.",
            ).forEach { Text("• $it", style = Melyviz.small, modifier = Modifier.padding(vertical = 2.dp)) }
            Spacer(Modifier.height(24.dp))
        }
    }
}
