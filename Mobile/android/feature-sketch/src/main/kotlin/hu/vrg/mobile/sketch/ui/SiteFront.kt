package hu.vrg.mobile.sketch.ui

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Looper
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import hu.vrg.mobile.core.Ports
import hu.vrg.mobile.core.PortsMsgs
import hu.vrg.mobile.core.PortsNote
import hu.vrg.mobile.kit.ShellSettings
import hu.vrg.mobile.kit.relay.Relay
import hu.vrg.mobile.kit.relay.Trust
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.sketch.Osm
import hu.vrg.mobile.sketch.SiteMath
import hu.vrg.mobile.sketch.SitePlace
import hu.vrg.mobile.core.Catalogue
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.mapNotNull
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

// Helyszín (WP M30): where the job is, and the building against the sketch. Privacy (D-31): the phone's own GPS sends
// nothing anywhere; the OSM address search sends the address and only on the button; the building outline is asked
// with the coordinates only; VRG Térkép runs on the paired PC (offline map), reached through the relay's port proxy.

private val http by lazy { OkHttpClient.Builder().connectTimeout(10, TimeUnit.SECONDS).readTimeout(20, TimeUnit.SECONDS).build() }

private suspend fun fetch(url: String): String? = withContext(Dispatchers.IO) {
    try {
        http.newCall(Request.Builder().url(url).header("User-Agent", Osm.AGENT).build()).execute().use { r -> if (r.isSuccessful) r.body?.string() else null }
    } catch (e: Exception) { null }
}

/** One position from the phone (GPS if on, else the network), or null. The permission is asked before. */
@SuppressLint("MissingPermission")
private fun locate(ctx: Context, done: (Location?) -> Unit) {
    val lm = ctx.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    val prov = when {
        lm.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
        lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
        else -> { done(null); return }
    }
    if (Build.VERSION.SDK_INT >= 30) {
        lm.getCurrentLocation(prov, null as android.os.CancellationSignal?, ctx.mainExecutor) { done(it) }
    } else {
        @Suppress("DEPRECATION")
        lm.requestSingleUpdate(prov, object : LocationListener {
            override fun onLocationChanged(location: Location) = done(location)
            @Deprecated("API 29") override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
            override fun onProviderEnabled(provider: String) {}
            override fun onProviderDisabled(provider: String) { done(null) }
        }, Looper.getMainLooper())
    }
}

/** The VRG Térkép address through the paired PC's relay (WP M8's port proxy), or why not. */
private suspend fun mapUrl(path: String): Pair<String?, String?> {
    if (Relay.trust.value != Trust.TRUSTED) return null to "A VRG Térképhez párosított PC kell (QR párosítás)."
    val relay = ShellSettings.value.relayUrl.takeIf { it.isNotEmpty() } ?: return null to "Nincs relé beállítva."
    return coroutineScope {
        // listen first: the relay's stream does not replay, so the answer must not come before the collector
        val reply = async(start = CoroutineStart.UNDISPATCHED) {
            withTimeoutOrNull(6000) { Relay.incoming.mapNotNull { (PortsMsgs.parse(it) as? PortsNote.Listed)?.list }.first() }
        }
        if (!Relay.send(PortsMsgs.list())) { reply.cancel(); return@coroutineScope null to "Nincs kapcsolat a PC reléjével." }
        listedUrl(reply.await(), relay, path)
    }
}

private fun listedUrl(l: hu.vrg.mobile.core.PortList?, relay: String, path: String): Pair<String?, String?> {
    if (l == null) return null to "A PC nem válaszolt a portlistára."
    if (!l.proxyOn) return null to "A relé --ports nélkül fut (Mobile\\mobile.cmd relay)."
    if (l.entries.none { it.port == 8802 }) return null to "A VRG Térkép nem fut a PC-n (START: szerver H)."
    return Ports.proxyUrl(relay, 8802, path, l.token) to null
}

@Composable
internal fun SiteFront(st: EditorState) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val col = st.frontColor("helyszin")
    val site = st.sketch.site
    var address by remember(site?.address) { mutableStateOf(site?.address ?: "") }
    var busy by remember { mutableStateOf<String?>(null) }
    var places by remember { mutableStateOf<List<Osm.Place>>(emptyList()) }
    var map by remember { mutableStateOf<String?>(null) }
    var web by remember { mutableStateOf<WebView?>(null) }
    val askLocation = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        if (!ok) { st.note = "A helyhez helymeghatározási engedély kell."; return@rememberLauncherForActivityResult }
        busy = "Helymeghatározás…"
        locate(ctx) { l -> busy = null; if (l == null) st.note = "Nincs hely: kapcsold be a helymeghatározást." else st.setSite { it.copy(lat = l.latitude, lon = l.longitude, source = "gps") } }
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 140.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("⌖", style = Melyviz.glyph.copy(fontSize = 20.sp, color = col))
            Text("  HELYSZÍN", style = Melyviz.title.copy(fontSize = 15.sp))
        }
        (busy ?: st.note)?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand)) }
        if (feat("helyszin.address")) Field(address, { address = it }, "A munka címe")   // M51: each part behind its switch
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (feat("helyszin.address") && address != (site?.address ?: "")) Pill("✓ Cím mentése", col, true) { st.setSite { it.copy(address = address.trim()) } }
            if (feat("helyszin.gps")) Pill("⌖ Itt vagyok (GPS)", col, false) {
                if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    busy = "Helymeghatározás…"
                    locate(ctx) { l -> busy = null; if (l == null) st.note = "Nincs hely: kapcsold be a helymeghatározást." else st.setSite { it.copy(lat = l.latitude, lon = l.longitude, source = "gps") } }
                } else askLocation.launch(Manifest.permission.ACCESS_FINE_LOCATION)
            }
        }
        site?.let { s0 -> s0.lat?.let { la -> Text("⌖ %.6f, %.6f · %s".format(la, s0.lon ?: 0.0, when (s0.source) { "gps" -> "a telefon helye"; "terkep" -> "VRG Térkép"; "osm" -> "OSM keresés"; else -> "kézi" }),
            style = Melyviz.readout, modifier = Modifier.padding(vertical = 6.dp)) } }
        ClientCard(st, col)   // F5 (WP M50): the client's contact, personal

        // F1: the phone's own VRG Térkép (M43), PC or not: the outline drawn / corrected (🛰 on a tap), the sketch placed on it,
        // the job's place taken from the map's centre. The map leaves its answer for this survey and comes back here.
        if (feat("helyszin.map")) Text("VRG Térkép a telefonon", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 12.dp, bottom = 4.dp))
        if (feat("helyszin.map")) Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Pill("🗺 Körvonal és vázlat a térképen", col, true) {
                SketchFeature.store.save(st.sketch)          // the map reads the file
                try {
                    ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("vrg://${Catalogue.MAP.id}?site=${st.sketch.id}"))
                        .setPackage(ctx.packageName).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP))
                } catch (e: Exception) { st.note = "A térkép nem nyitható meg." }
            }
        }
        if (feat("helyszin.map")) Text("Ott: ▱ sarkok koppintással, húzással javítás, 🛰 műholdkép (csak koppintásra, nem tárolódik); ◫ a vázlat húzva és forgatva; ⇣ a munka helye a térkép közepe; ✓ Kész ide hozza.",
            style = Melyviz.small.copy(fontSize = 10.sp, color = Melyviz.faint))

        if (feat("helyszin.map")) Text("VRG Térkép (a PC offline térképe)", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 12.dp, bottom = 4.dp))
        if (feat("helyszin.map")) Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Pill(if (map == null) "🗺 Megnyitás" else "🗺 Bezárás", col, map != null) {
                if (map != null) { map = null; return@Pill }
                scope.launch {
                    busy = "A PC-t kérdezem…"
                    val (u, why) = try { mapUrl(Osm.mapPath(st.sketch.site)) } catch (e: Exception) { null to "A PC nem érhető el." }
                    busy = null; map = u; why?.let { st.note = it }
                }
            }
            if (map != null) Pill("⇣ Átvétel a térképről", col, true) {
                val ll = web?.url?.let { Osm.fromMapUrl(it) }
                if (ll == null) st.note = "Vidd a térképet a házra, aztán vedd át." else st.setSite { it.copy(lat = ll.first, lon = ll.second, source = "terkep") }
            }
        }
        map?.let { u ->
            AndroidView(factory = { c -> WebView(c).apply {
                settings.javaScriptEnabled = true; settings.domStorageEnabled = true
                webViewClient = WebViewClient(); loadUrl(u); web = this
            } }, modifier = Modifier.fillMaxWidth().height(360.dp).padding(vertical = 6.dp))
        }

        if (feat("helyszin.search")) Text("Az interneten (OpenStreetMap)", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 12.dp, bottom = 4.dp))
        if (feat("helyszin.search")) Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Pill("🔎 Cím keresése", col, false) {
                if (address.isBlank()) { st.note = "Előbb írd be a címet."; return@Pill }
                scope.launch {
                    busy = "Keresés…"
                    places = fetch(Osm.searchUrl(address))?.let { Osm.parseSearch(it) } ?: emptyList()
                    busy = null; if (places.isEmpty()) st.note = "Nincs találat (vagy nincs internet)."
                }
            }
            Pill("▱ Épület körvonala", col, false) {
                val la = st.sketch.site?.lat; val lo = st.sketch.site?.lon
                if (la == null || lo == null) { st.note = "Előbb a hely: GPS, térkép vagy keresés."; return@Pill }
                scope.launch {
                    busy = "Az épület körvonala…"
                    val json = fetch(Osm.OVERPASS + "?data=" + java.net.URLEncoder.encode(Osm.buildingsQuery(la, lo), "UTF-8"))
                    busy = null
                    val outline = json?.let { Osm.pickBuilding(it, la, lo) }
                    if (outline == null) st.note = "Itt nincs épület az OSM-ben (vagy nincs internet)."
                    else st.setSite { it.copy(outline = outline, footprint = SiteMath.footprint(outline, "osm", System.currentTimeMillis())) }
                }
            }
        }
        if (feat("helyszin.search")) Text("A keresés a címet, a körvonal csak a koordinátát küldi el az OSM-nek; a GPS semmit.", style = Melyviz.small.copy(fontSize = 10.sp, color = Melyviz.faint))
        places.forEach { p ->
            Text("· " + p.name, style = Melyviz.label.copy(fontSize = 13.sp), modifier = Modifier.fillMaxWidth().clickable {
                st.setSite { it.copy(lat = p.lat, lon = p.lon, source = "osm") }; places = emptyList()
            }.padding(vertical = 6.dp))
        }

        if (feat("helyszin.footprint")) st.sketch.site?.footprint?.let { fp ->
            Text("Az épület és a vázlat", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 14.dp, bottom = 4.dp))
            val cmp = SiteMath.compare(st.norm, fp)
            val m = { v: Double -> "%.1f".format(v).replace('.', ',') }
            Text("Épület: ${m(fp.w)} × ${m(fp.d)} m, ${m(fp.area)} m² (${when (fp.src) { "osm" -> "OSM"; "rajz" -> "rajzolt"; "muhold" -> "műholdról rajzolt"; else -> fp.src }})", style = Melyviz.label.copy(fontSize = 13.sp))
            if (cmp == null) Text("A vázlaton még nincs szoba.", style = Melyviz.small)
            else Text(cmp.text, style = Melyviz.label.copy(fontSize = 13.sp, color = when (cmp.verdict) {
                "egyezik" -> Melyviz.glow; "kisebb" -> Melyviz.sand; else -> Color(0xFFD64545) }))
        }
        if (feat("helyszin.place")) SitePlacement(st, col)
    }
}

/** F1: where the sketch sits on the building: the placement's report, ⤢ fit without the map, ✕ clear. */
@Composable
private fun SitePlacement(st: EditorState, col: Color) {
    val site = st.sketch.site ?: return
    if (site.outline.size < 3) return
    val rooms = SitePlace.rooms(st.norm)
    Text("A vázlat az épületen", style = Melyviz.small.copy(color = Melyviz.faint), modifier = Modifier.padding(top = 14.dp, bottom = 4.dp))
    if (rooms.isEmpty()) { Text("A vázlaton még nincs szoba.", style = Melyviz.small); return }
    val rep = SitePlace.report(rooms, site.outline, site.place)
    if (rep == null) Text("Még nincs elhelyezve: ⤢ Illesztés, vagy a térképen ◫.", style = Melyviz.small)
    else SitePlace.lines(rep).forEachIndexed { i, l ->
        Text(l, style = Melyviz.label.copy(fontSize = 13.sp, color = if (i > 0) Melyviz.label.color else when (rep.verdict) {
            "rendben" -> Melyviz.glow; "eltolva" -> Melyviz.sand; else -> Color(0xFFD64545) }))
    }
    site.place?.let { p -> Text("Elforgatás ${"%.1f".format(p.rot).replace('.', ',')}°" + if (p.auto) " (automatikus)" else " (kézzel igazítva)", style = Melyviz.small) }
    Row(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Pill("⤢ Illesztés", col, site.place == null) {
            val p = SitePlace.autoFit(rooms, site.outline, System.currentTimeMillis())
            if (p == null) st.note = "Nem illeszthető." else st.setSite { it.copy(place = p) }
        }
        if (site.place != null) Pill("✕ Elhelyezés", col, false) { st.setSite { it.copy(place = null) } }
    }
}
