@file:OptIn(ExperimentalLayoutApi::class)

package hu.vrg.mobile.weather.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Application
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.MiniState
import hu.vrg.mobile.core.MiniStatus
import hu.vrg.mobile.core.Ports
import hu.vrg.mobile.core.PortsMsgs
import hu.vrg.mobile.core.PortsNote
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.relay.Relay
import hu.vrg.mobile.kit.relay.Trust
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.ui.VrgSectionTitle
import hu.vrg.mobile.weather.Config
import hu.vrg.mobile.weather.Hour
import hu.vrg.mobile.weather.Level
import hu.vrg.mobile.weather.MeteoAlarm
import hu.vrg.mobile.weather.Rules
import hu.vrg.mobile.weather.Vars
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.mapNotNull
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import java.time.format.DateTimeFormatter

// VRG Időjárás (WP M44, D-142 … D-144): "can we work outside today" per activity, the fused 72 hours with their spread,
// the official warnings of the place's county, the sources with their attribution; the PC's full page through the relay.

object WeatherFeature : VrgFeature {
    override val info = Catalogue.WEATHER

    private lateinit var data: WeatherData
    private val result = MutableStateFlow<WeatherResult?>(null)
    private val busy = MutableStateFlow(false)
    /** Why the last load failed (null = it worked), so the screen can say it and offer a retry. */
    private val lastError = MutableStateFlow<String?>(null)
    private val ring = MutableStateFlow(MiniStatus.IDLE)
    override val activity: StateFlow<MiniStatus> get() = ring

    override fun init(app: Application) { data = WeatherData(app) }

    private suspend fun refresh(force: Boolean) {
        if (busy.value) return
        busy.value = true; ring.value = MiniStatus(MiniState.RUNNING)
        try {
            result.value = data.load(force)
            lastError.value = null
            ring.value = MiniStatus.IDLE
        } catch (e: Exception) {
            VrgLog.w(WeatherData.TAG, "load: ${e.message}")
            lastError.value = e.message?.takeIf { it.isNotBlank() } ?: e.javaClass.simpleName
            ring.value = MiniStatus(MiniState.ERROR)
        } finally { busy.value = false }
    }

    @Composable
    override fun Screen(host: FeatureHost) {
        val r by result.collectAsStateWithLifecycle()
        val loading by busy.collectAsStateWithLifecycle()
        val failed by lastError.collectAsStateWithLifecycle()
        val scope = rememberCoroutineScope()
        val ctx = LocalContext.current
        var settings by remember { mutableStateOf(false) }
        var tick by remember { mutableStateOf(0) }   // re-reads the places after a change
        LaunchedEffect(tick) { refresh(force = false) }
        BackHandler(settings) { settings = false }
        val retry = { scope.launch { refresh(force = true) }; Unit }

        val askLocation = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
            if (granted.values.any { it }) locateHere(ctx, host) { tick++ } else host.note("Helyhozzáférés nélkül az „Itt” nem működik.")
        }

        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current),
                    modifier = Modifier.heightIn(min = 48.dp).clickable { host.home() }.wrapContentHeight(Alignment.CenterVertically).padding(end = 12.dp))
                Spacer(Modifier.weight(1f))
                IconChip(if (loading) "Frissítés…" else "⟳", "Frissítés") { retry() }
                Spacer(Modifier.width(6.dp))
                IconChip("⚙", "Beállítások", selected = settings) { settings = !settings }
            }
            Text("VRG IDŐJÁRÁS", style = Melyviz.title.copy(fontSize = 18.sp))

            // places: "Itt", the user's saved places, the named towns; wrapping, so the chosen one is always in view
            FlowRow(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                VrgChip("◎ Itt", selected = data.placeId == WeatherData.HERE) {
                    val perm = listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
                    if (perm.any { ContextCompat.checkSelfPermission(ctx, it) == PackageManager.PERMISSION_GRANTED }) locateHere(ctx, host) { tick++ }
                    else askLocation.launch(perm.toTypedArray())
                }
                for (p in data.saved + Config.places) VrgChip(p.name, selected = data.placeId == p.id) { data.placeId = p.id; tick++ }
            }

            if (settings) Settings(host) { tick++ }

            val res = r
            when {
                res == null && !loading && failed != null -> Column(Modifier.padding(top = 8.dp)) {
                    Text("Nem sikerült letölteni az előrejelzést (nincs internet?): $failed", style = Melyviz.small.copy(color = Melyviz.sand))
                    Row(Modifier.padding(top = 6.dp)) { VrgChip("Újra") { retry() } }
                }
                res == null -> Text(if (loading) "Adatok letöltése…" else "Nincs adat még.", style = Melyviz.small, modifier = Modifier.padding(top = 8.dp))
                else -> Body(res, host, if (loading) null else failed, retry)
            }
            Spacer(Modifier.height(24.dp))
        }
    }

    @Composable
    private fun Body(r: WeatherResult, host: FeatureHost, failed: String?, retry: () -> Unit) {
        val scope = rememberCoroutineScope()
        val ctx = LocalContext.current
        Text("${r.place.name} · figyelmeztetési terület: ${r.place.warnAreas.joinToString(", ").ifEmpty { "–" }}", style = Melyviz.readout)
        // how old the data is, and whether this refresh reached the sources (offline, the cached copy shows)
        val newest = r.sources.filter { it.ok }.maxOfOrNull { it.fetchedAt } ?: 0L
        if (newest > 0) Text("adat: ${fmtTime(java.time.Instant.ofEpochMilli(newest))}", style = Melyviz.readout)
        if (failed != null || r.sources.any { it.failed }) Row(Modifier.padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(if (newest > 0) "A frissítés nem sikerült (nincs internet?): a tárolt adat látszik." else "A frissítés nem sikerült (nincs internet?).",
                style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.weight(1f))
            Spacer(Modifier.width(6.dp))
            VrgChip("Újra") { retry() }
        }

        if (r.hours.isEmpty()) {
            Text("Nincs előrejelzés: egyik forrás sem adott adatot ehhez a helyhez (lásd a Forrásokat lent).",
                style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 8.dp))
        } else {
            // the verdict
            val d = r.day
            VrgSectionTitle("${d.label} kint dolgozhatunk? · %02d–%02d óra".format(d.fromHour, d.toHour))
            for (v in d.verdicts) Verdict(v)
            Text("Óvatos alapértékek (felülvizsgálva ${Config.rules.reviewedOn}). A gép adattáblája és a kábel adatlapja mindig erősebb; " +
                "villámadat a telefonon nincs, a radart nézd.", style = Melyviz.small.copy(fontSize = 10.sp), modifier = Modifier.padding(top = 6.dp))

            // the official warnings
            if (r.warnings.isNotEmpty()) {
                VrgSectionTitle("Hivatalos figyelmeztetések")
                for (w in r.warnings.sortedByDescending { it.level ?: 0 }) {
                    val c = if ((w.level ?: 0) >= 3) Melyviz.coral else Melyviz.sand
                    Text("⚠ ${w.event ?: w.type ?: "figyelmeztetés"} · ${MeteoAlarm.LEVEL_HU[w.level] ?: ""} · ${w.area}", style = Melyviz.label.copy(color = c))
                    Text("${fmtTime(w.onset)} – ${fmtTime(w.expires)}" + (w.headline?.let { " · $it" } ?: ""), style = Melyviz.small,
                        modifier = Modifier.padding(bottom = 6.dp))
                }
            }

            // the hours
            VrgSectionTitle("72 óra (konszenzus, ± a források szórása)")
            HourStrip(r)
        }

        // the sources
        VrgSectionTitle("Források")
        for (s in r.sources) {
            Text("${if (s.ok) "●" else "○"} ${s.name}", style = Melyviz.label.copy(color = if (s.ok) Melyviz.ink else Melyviz.muted, fontSize = 12.sp))
            Text("${s.text} · ${s.attribution}", style = Melyviz.small.copy(fontSize = 10.sp), modifier = Modifier.padding(start = 12.dp, bottom = 4.dp))
        }
        Text("Az Open-Meteo és a légminőség csak a PC-n fut (fizetős kulcs kell); a villám- és radaradat sincs a telefonon.",
            style = Melyviz.small.copy(fontSize = 10.sp))

        Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            VrgChip("PC nézet ›") { scope.launch { pcView(ctx)?.let { host.note(it) } } }
            VrgChip("Radar ↗") { if (!openUrl(ctx, Config.source("hungaromet-radar").url)) host.note("Nincs böngésző a megnyitáshoz.") }
        }
    }

    @Composable
    private fun Verdict(v: hu.vrg.mobile.weather.Verdict) {
        val c = levelColor(v.level)
        val shape = RoundedCornerShape(Melyviz.radiusSmall)
        Column(Modifier.fillMaxWidth().padding(vertical = 3.dp).background(Melyviz.raised, shape).border(1.dp, c.copy(alpha = .6f), shape)
            .padding(horizontal = 10.dp, vertical = 7.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(v.level.dot, style = Melyviz.label)
                Spacer(Modifier.width(8.dp))
                Text(v.activity.hu, style = Melyviz.label.copy(color = Melyviz.ink), modifier = Modifier.weight(1f))
                Text(v.level.hu.uppercase(), style = Melyviz.readout.copy(color = c))
            }
            val w = v.window
            Text(if (w != null) "Ablak: %02d–%02d óra".format(w.first, w.second) else "Ma nincs nyugodt munkaablak.",
                style = Melyviz.small.copy(fontSize = 11.sp))
            for (why in v.reasons.take(3)) Text("· $why", style = Melyviz.small.copy(fontSize = 11.sp, color = Melyviz.ink))
        }
    }

    @Composable
    private fun HourStrip(r: WeatherResult) {
        val zone = Config.settings.zone
        val acts = Config.rules.activities.map { it.id }
        val upcoming = r.hours.filter { it.valid > r.at }.take(72)
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            for (h in upcoming) {
                val lv = acts.maxOf { Rules.levelAt(r.findings, it, h.valid).first }
                val shape = RoundedCornerShape(Melyviz.radiusSmall)
                Column(Modifier.width(54.dp).background(Melyviz.surface, shape).border(1.dp, levelColor(lv).copy(alpha = if (lv == Level.OK) .25f else .8f), shape)
                    .padding(4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    val l = h.valid.atZone(zone)
                    Text(if (l.hour == 0) "%02d.%02d".format(l.monthValue, l.dayOfMonth) else "%02d h".format(l.hour), style = Melyviz.readout.copy(fontSize = 10.sp))
                    Text(Vars.glyph(h["wmo"]), style = Melyviz.glyph.copy(fontSize = 18.sp))
                    Text(value(h, "t2m", "°"), style = Melyviz.label.copy(fontSize = 12.sp, color = Melyviz.ink))
                    Text(value(h, "gust", ""), style = Melyviz.readout.copy(fontSize = 10.sp))
                    Text(h["precip"]?.let { if (it >= 0.1) Rules.fmt("precip", it) + " mm" else "–" } ?: "–", style = Melyviz.readout.copy(fontSize = 10.sp))
                    Text(confGlyph(h.conf["t2m"]), style = Melyviz.readout.copy(fontSize = 10.sp))
                }
            }
        }
        Text("Oszlopok: idő · ég · hőmérséklet ± szórás · széllökés m/s · csapadék · biztonság (●●● magas, ●● közepes, ● alacsony, 1 = egy forrás)",
            style = Melyviz.small.copy(fontSize = 10.sp), modifier = Modifier.padding(top = 4.dp))
    }

    private fun value(h: Hour, v: String, unit: String): String {
        val x = h[v] ?: return "–"
        val s = h.spread[v]
        val main = Rules.fmt(v, x) + unit
        return if (s != null && s >= 0.5) "$main±${Math.round(s)}" else main
    }

    private fun confGlyph(c: String?) = when (c) { "magas" -> "●●●"; "közepes" -> "●●"; "alacsony" -> "●"; "egy" -> "1"; else -> "" }

    @Composable
    private fun levelColor(l: Level): Color = when (l) {
        Level.RED -> Melyviz.coral; Level.AMBER -> Melyviz.sand; Level.INFO -> Melyviz.current; Level.OK -> Melyviz.kelp
    }

    private val TIME = DateTimeFormatter.ofPattern("MM.dd. HH:mm")
    private fun fmtTime(t: java.time.Instant) = t.atZone(Config.settings.zone).format(TIME)

    /** A glyph-only chip (⟳, ⚙): TalkBack reads [label], and the touch area is at least 48 dp. */
    @Composable
    private fun IconChip(glyph: String, label: String, selected: Boolean = false, action: () -> Unit) {
        Box(Modifier.minimumInteractiveComponentSize().clearAndSetSemantics {
            contentDescription = label; role = Role.Button; this.selected = selected
            onClick { action(); true }
        }, contentAlignment = Alignment.Center) { VrgChip(glyph, selected = selected, onClick = action) }
    }

    @Composable
    private fun Settings(host: FeatureHost, changed: () -> Unit) {
        var contact by remember { mutableStateOf(data.contact) }
        var name by remember { mutableStateOf("") }
        var sureForget by remember { mutableStateOf<String?>(null) }   // a 2-tap delete, as Tárgykereső's Elfelejtés
        val colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = Melyviz.glow, unfocusedBorderColor = Melyviz.line,
            focusedTextColor = Melyviz.ink, unfocusedTextColor = Melyviz.ink, cursorColor = Melyviz.glow)
        VrgSectionTitle("Kapcsolat (MET Norway)")
        Text("A MET Norway feltétele, hogy a lekérés megnevezze, kit lehet elérni (e-mail vagy honlap). Csak ezen a telefonon " +
            "tárolódik, és csak a MET Norway kapja meg. Amíg üres, ez a forrás vár.", style = Melyviz.small)
        OutlinedTextField(contact, { contact = it }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
            placeholder = { Text("e-mail vagy honlap", style = Melyviz.small) },
            keyboardOptions = KeyboardOptions(autoCorrectEnabled = false, keyboardType = KeyboardType.Email), colors = colors)
        Row(Modifier.padding(top = 6.dp)) { VrgChip("Mentés", contact.trim() != data.contact) { data.contact = contact; host.note("Mentve."); changed() } }

        val here = data.here
        VrgSectionTitle("Helyek")
        if (here != null) {
            Text("Utolsó „Itt”: ${here.name} (két tizedesre kerekítve, ~1 km)", style = Melyviz.small)
            OutlinedTextField(name, { name = it }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                placeholder = { Text("név, pl. a munka kódja", style = Melyviz.small) }, colors = colors)
            Row(Modifier.padding(top = 6.dp)) { VrgChip("Mentés helyként") { data.save(name, here); name = ""; changed() } }
        } else Text("Az „◎ Itt” gombbal a mostani helyed menthető.", style = Melyviz.small)
        for (p in data.saved) Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
            Text(p.name, style = Melyviz.label.copy(color = Melyviz.ink), modifier = Modifier.weight(1f))
            VrgChip(if (sureForget == p.id) "Biztosan törlöm" else "Törlés", selected = sureForget == p.id) {
                if (sureForget != p.id) sureForget = p.id else { sureForget = null; data.forget(p.id); changed() }
            }
        }
        Text("A helyek csak ezen a telefonon vannak; a koordináta csak az előrejelzés lekérésébe kerül.", style = Melyviz.small.copy(fontSize = 10.sp),
            modifier = Modifier.padding(top = 6.dp))
    }

    // ------------------------------------------------------------ the phone's position, once, on a tap (D-144)
    @SuppressLint("MissingPermission")
    private fun locateHere(ctx: Context, host: FeatureHost, done: () -> Unit) {
        val lm = ctx.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val prov = when {
            lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
            lm.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
            else -> { host.note("A helymeghatározás ki van kapcsolva."); return }
        }
        host.note("Hely keresése…")
        val use = { l: Location? ->
            if (l == null) host.note("Nem sikerült helyet kapni.")
            else { data.here = data.hereFrom(l.latitude, l.longitude); data.placeId = WeatherData.HERE; done() }
        }
        try {
            if (android.os.Build.VERSION.SDK_INT >= 30) lm.getCurrentLocation(prov, null as android.os.CancellationSignal?, ctx.mainExecutor) { use(it) }
            else use(lm.getLastKnownLocation(prov))
        } catch (e: Exception) { host.note("Nem sikerült helyet kapni.") }
    }

    // ------------------------------------------------------------ the PC's page through the relay's port proxy (WP M8)
    private suspend fun pcView(ctx: Context): String? {
        if (Relay.trust.value != Trust.TRUSTED) return "A PC nézethez párosított PC kell (QR párosítás)."
        val l = coroutineScope {
            val reply = async(start = CoroutineStart.UNDISPATCHED) {
                withTimeoutOrNull(6000) { Relay.incoming.mapNotNull { (PortsMsgs.parse(it) as? PortsNote.Listed)?.list }.first() }
            }
            if (!Relay.send(PortsMsgs.list())) { reply.cancel(); return@coroutineScope null }
            reply.await()
        } ?: return "A PC nem válaszolt a portlistára."
        if (!l.proxyOn) return "A relé --ports nélkül fut (Mobile\\mobile.cmd relay)."
        if (l.entries.none { it.port == PC_PORT }) return "A VRG Időjárás nem fut a PC-n (START W → I → 1)."
        val url = Ports.proxyUrl(Relay.url, PC_PORT, "/", l.token) ?: return "A telefonos megnyitás nem érhető el."
        openUrl(ctx, url)
        return null
    }

    private fun openUrl(ctx: Context, url: String): Boolean =
        runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }.isSuccess

    private const val PC_PORT = 8808
}
