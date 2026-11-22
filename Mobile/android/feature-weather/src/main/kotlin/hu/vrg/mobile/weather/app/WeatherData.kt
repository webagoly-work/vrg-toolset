package hu.vrg.mobile.weather.app

import android.content.Context
import android.content.SharedPreferences
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.weather.Config
import hu.vrg.mobile.weather.Day
import hu.vrg.mobile.weather.Finding
import hu.vrg.mobile.weather.Fuse
import hu.vrg.mobile.weather.Geo
import hu.vrg.mobile.weather.Hour
import hu.vrg.mobile.weather.Issue
import hu.vrg.mobile.weather.MeteoAlarm
import hu.vrg.mobile.weather.MetNo
import hu.vrg.mobile.weather.Mosmix
import hu.vrg.mobile.weather.Place
import hu.vrg.mobile.weather.Rules
import hu.vrg.mobile.weather.Warning
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.Instant
import java.util.Locale
import java.util.concurrent.TimeUnit

// The phone side of VRG Időjárás: requests with a cache that honours each source's cadence and MET Norway's Expires /
// If-Modified-Since, the places (named, saved, "Itt"), and the result the screen and the home card read. Everything
// stays in this app's own storage: filesDir/weather/ and the "weather" preferences.

/** One source's state for the screen. */
data class SourceState(val id: String, val name: String, val attribution: String, val text: String, val ok: Boolean)

data class WeatherResult(
    val place: Place,
    val hours: List<Hour>,
    val warnings: List<Warning>,
    val findings: List<Finding>,
    val day: Day,
    val sources: List<SourceState>,
    val at: Instant,
)

internal class WeatherData(private val ctx: Context) {
    private val prefs: SharedPreferences = ctx.getSharedPreferences("weather", Context.MODE_PRIVATE)
    private val dir = File(ctx.filesDir, "weather").apply { mkdirs() }
    private val http = OkHttpClient.Builder().connectTimeout(10, TimeUnit.SECONDS).readTimeout(25, TimeUnit.SECONDS).build()

    // ------------------------------------------------------------ settings and places
    var contact: String
        get() = prefs.getString("contact", "").orEmpty()
        set(v) { prefs.edit().putString("contact", v.trim()).apply() }

    var placeId: String
        get() = prefs.getString("place", "budapest") ?: "budapest"
        set(v) { prefs.edit().putString("place", v).apply() }

    /** The last "Itt" position, already rounded (D-144), or null. */
    var here: Place?
        get() = prefs.getString("here", null)?.let { runCatching { placeOf(JSONObject(it)) }.getOrNull() }
        set(p) { prefs.edit().putString("here", p?.let { json(it).toString() }).apply() }

    var saved: List<Place>
        get() = runCatching { JSONArray(prefs.getString("saved", "[]")).let { a -> (0 until a.length()).map { placeOf(a.getJSONObject(it)) } } }.getOrDefault(emptyList())
        set(list) { prefs.edit().putString("saved", JSONArray().apply { list.forEach { put(json(it)) } }.toString()).apply() }

    fun places(): List<Place> = Config.places + saved + listOfNotNull(here)

    fun place(): Place = places().firstOrNull { it.id == placeId } ?: Config.places.first()

    fun hereFrom(lat: Double, lon: Double): Place {
        val la = Geo.round2(lat); val lo = Geo.round2(lon)
        return Place(HERE, "Itt (%.2f, %.2f)".format(Locale.ROOT, la, lo), la, lo, null, Geo.warnAreas(la, lo), custom = true)
    }

    fun save(name: String, p: Place) {
        val id = "saved-" + System.currentTimeMillis().toString(36)
        saved = saved + p.copy(id = id, name = name.trim().ifEmpty { p.name })
        placeId = id
    }

    fun forget(id: String) {
        saved = saved.filter { it.id != id }
        if (placeId == id) placeId = "budapest"
    }

    private fun json(p: Place) = JSONObject().put("id", p.id).put("name", p.name).put("lat", p.lat).put("lon", p.lon)
        .put("warn", JSONArray(p.warnAreas))
    private fun placeOf(j: JSONObject): Place {
        val w = j.optJSONArray("warn")
        val lat = j.getDouble("lat"); val lon = j.getDouble("lon")
        return Place(j.getString("id"), j.getString("name"), lat, lon, null,
            if (w != null) (0 until w.length()).map { w.getString(it) } else Geo.warnAreas(lat, lon), custom = true)
    }

    // ------------------------------------------------------------ the cache
    private class Got(val bytes: ByteArray?, val fetched: Long, val note: String?)

    /**
     * The cached answer of [key] if it is younger than [cadenceMin] (or before its Expires), else a new request; a 304
     * keeps the cached copy. A failed request falls back to the cache with a note.
     */
    private fun get(key: String, url: String, cadenceMin: Int, ua: String, force: Boolean): Got {
        val file = File(dir, key)
        val meta = prefs.getString("m:$key", null)?.let { runCatching { JSONObject(it) }.getOrNull() }
        val fetched = meta?.optLong("at") ?: 0L
        val expires = meta?.optLong("expires") ?: 0L
        val now = System.currentTimeMillis()
        val fresh = file.exists() && (now - fetched < cadenceMin * 60_000L || now < expires)
        if (fresh && !force) return Got(file.readBytes(), fetched, null)
        val req = Request.Builder().url(url).header("User-Agent", ua)   // OkHttp asks for gzip and unpacks it itself
        meta?.optString("lm")?.takeIf { it.isNotEmpty() && file.exists() }?.let { req.header("If-Modified-Since", it) }
        return try {
            http.newCall(req.build()).execute().use { r ->
                when {
                    r.code == 304 && file.exists() -> { store(key, now, r.header("Last-Modified") ?: meta?.optString("lm"), r.header("Expires")); Got(file.readBytes(), now, null) }
                    r.isSuccessful -> {
                        val b = r.body?.bytes() ?: ByteArray(0)
                        File(dir, "$key.part").apply { writeBytes(b); renameTo(file) }
                        store(key, now, r.header("Last-Modified"), r.header("Expires"))
                        Got(b, now, null)
                    }
                    else -> Got(if (file.exists()) file.readBytes() else null, fetched, "HTTP ${r.code}")
                }
            }
        } catch (e: Exception) {
            VrgLog.w(TAG, "$key: ${e.message}")
            Got(if (file.exists()) file.readBytes() else null, fetched, "nincs kapcsolat")
        }
    }

    private fun store(key: String, at: Long, lm: String?, expires: String?) {
        val exp = expires?.let { runCatching { java.time.ZonedDateTime.parse(it, java.time.format.DateTimeFormatter.RFC_1123_DATE_TIME).toInstant().toEpochMilli() }.getOrNull() } ?: 0L
        prefs.edit().putString("m:$key", JSONObject().put("at", at).put("lm", lm ?: "").put("expires", exp).toString()).apply()
    }

    private fun ago(at: Long): String {
        if (at <= 0) return "–"
        val min = (System.currentTimeMillis() - at) / 60_000
        return if (min < 1) "most" else if (min < 90) "$min perce" else "${min / 60} órája"
    }

    // ------------------------------------------------------------ one refresh
    suspend fun load(force: Boolean): WeatherResult = withContext(Dispatchers.IO) {
        val place = place()
        val issues = ArrayList<Issue>(); val states = ArrayList<SourceState>()
        var warnings: List<Warning> = emptyList()

        // MET Norway: waits until the contact is set (its terms; D-143)
        val met = Config.source("met-no")
        val ua = MetNo.userAgent(contact)
        if (ua == null) states += SourceState(met.id, met.name, met.attribution, "vár: add meg a Kapcsolatot (⚙)", false)
        else {
            val g = get("met-no-%.4f-%.4f.json".format(Locale.ROOT, place.lat, place.lon), MetNo.url(met, place.lat, place.lon, place.elev), met.cadenceMin, ua, force)
            states += parse(met.id, met.name, met.attribution, g) { issues += MetNo.parse(String(it, Charsets.UTF_8)) }
        }

        // DWD MOSMIX: the nearest listed station within its range
        val dwd = Config.source("dwd-mosmix")
        val st = Geo.station(dwd, place.lat, place.lon)
        if (st == null) states += SourceState(dwd.id, dwd.name, dwd.attribution, "nincs állomás ${dwd.maxStationKm.toInt()} km-en belül", false)
        else {
            val g = get("dwd-${st.first.id}.kmz", Mosmix.url(dwd, st.first), dwd.cadenceMin, AGENT, force)
            states += parse(dwd.id, "${dwd.name} · ${st.first.name} (${st.second.toInt()} km)", dwd.attribution, g) { issues += Mosmix.parse(it, st.first) }
        }

        // MeteoAlarm: the whole country, matched to the place's area
        val ma = Config.source("meteoalarm")
        val g = get("meteoalarm.json", ma.url, ma.cadenceMin, AGENT, force)
        states += parse(ma.id, ma.name, ma.attribution, g) { warnings = MeteoAlarm.parse(String(it, Charsets.UTF_8)) }

        val prior = Config.sources.associate { it.id to it.priorWeight }
        val now = Instant.now()
        val hours = Fuse.fuse(issues, prior, now = now)
        val findings = Rules.evaluate(place, hours, warnings, now = now)
        val day = Rules.day(findings, now = now)
        val r = WeatherResult(place, hours, warnings.filter { w -> place.warnAreas.any { hu.vrg.mobile.weather.Areas.match(w.area, it) } && w.expires >= now },
            findings, day, states, now)
        if (hours.isNotEmpty()) writeSummary(Rules.summary(place.name, day, hours, now))
        r
    }

    private fun parse(id: String, name: String, attribution: String, g: Got, use: (ByteArray) -> Unit): SourceState {
        val b = g.bytes ?: return SourceState(id, name, attribution, "nincs adat (${g.note ?: "hiba"})", false)
        return try {
            use(b)
            SourceState(id, name, attribution, "frissítve ${ago(g.fetched)}" + (g.note?.let { " · tárolt másolat ($it)" } ?: ""), true)
        } catch (e: Exception) {
            VrgLog.w(TAG, "$id parse: ${e.message}")
            SourceState(id, name, attribution, "nem olvasható válasz", false)
        }
    }

    /** The home card's line (read by the shell from filesDir/weather/summary.txt, like the Sketcher's count). */
    private fun writeSummary(line: String) {
        runCatching { File(ctx.filesDir, hu.vrg.mobile.core.HomeLayout.WEATHER_SUMMARY).writeText("${System.currentTimeMillis()}\n$line") }
    }

    companion object {
        const val TAG = "weather"
        const val HERE = "here"
        /** DWD and MeteoAlarm need no contact: a generic client name (D-31's rule). */
        const val AGENT = "VRG-Mobile-Idojaras/1.0"
    }
}
