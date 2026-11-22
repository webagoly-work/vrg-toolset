package hu.vrg.mobile.weather

import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

// The bundled Weather/config (rules, places, sources, settings: exact copies, see build.gradle.kts) read into Kotlin.

data class Workday(val from: Int, val to: Int, val days: Set<Int>)

data class Settings(
    val zone: ZoneId,
    val horizonHours: Int,
    val workday: Workday,
    val tolerance: Map<String, Double>,
)

data class Station(val id: String, val name: String, val lat: Double, val lon: Double)

data class Source(
    val id: String, val name: String, val url: String, val attribution: String, val commercial: String,
    val cadenceMin: Int, val priorWeight: Double, val enabled: Boolean,
    val stations: List<Station> = emptyList(), val maxStationKm: Double = 45.0,
)

data class Place(
    val id: String, val name: String, val lat: Double, val lon: Double, val elev: Int?,
    val warnAreas: List<String>, val custom: Boolean = false,
)

data class Activity(val id: String, val hu: String)

data class Cond(val v: String, val op: String, val value: Double?, val values: List<Double>, val stat: String?, val and: Cond?)

data class HeatStep(val days: Int, val mean: Double, val level: String, val hu: String)

data class Rule(
    val id: String, val kind: String, val activities: List<String>, val level: String?,
    val all: List<Cond>?, val any: List<Cond>?, val hu: String, val workday: Boolean, val persist: Int,
    val basis: String, val source: String, val levels: Map<String, String>, val steps: List<HeatStep>,
)

data class RuleSet(val reviewedOn: String, val activities: List<Activity>, val rules: List<Rule>)

object Config {
    /** The phone's sources: keyless and allowed for a company (D-143); Open-Meteo stays on the PC (it needs a paid key). */
    val PHONE_SOURCES = listOf("met-no", "dwd-mosmix", "meteoalarm")

    fun text(name: String): String =
        Config::class.java.getResourceAsStream("/weather/$name")?.use { it.readBytes().toString(Charsets.UTF_8) }
            ?: error("weather/$name is not bundled")

    val settings: Settings by lazy { settings(JSONObject(text("settings.json"))) }
    val rules: RuleSet by lazy { rules(JSONObject(text("rules.json"))) }
    val places: List<Place> by lazy { places(JSONObject(text("places.json"))) }
    val sources: List<Source> by lazy { sources(JSONObject(text("sources.json"))) }

    fun source(id: String): Source = sources.first { it.id == id }

    fun settings(j: JSONObject): Settings {
        val wd = j.getJSONObject("workday")
        val tol = j.getJSONObject("fusion").getJSONObject("tolerance")
        return Settings(
            ZoneId.of(j.optString("timezone", "Europe/Budapest")), j.optInt("horizonHours", 72),
            Workday(wd.getInt("from"), wd.getInt("to"), ints(wd.getJSONArray("days")).toSet()),
            tol.keySet().associateWith { tol.getDouble(it) },
        )
    }

    fun places(j: JSONObject): List<Place> = objs(j.getJSONArray("places")).map { p ->
        Place(p.getString("id"), p.getString("name"), p.getDouble("lat"), p.getDouble("lon"),
            if (p.has("elev")) p.getInt("elev") else null, strs(p.optJSONArray("warn_areas")))
    }

    fun sources(j: JSONObject): List<Source> = objs(j.getJSONArray("sources")).map { s ->
        Source(
            s.getString("id"), s.getString("name"), s.optString("url"), s.optString("attribution"), s.optString("commercial"),
            s.optInt("cadence_min", 60), s.optDouble("prior_weight", 1.0), s.optBoolean("enabled", true),
            objs(s.optJSONArray("stations")).map { Station(it.getString("id"), it.getString("name"), it.getDouble("lat"), it.getDouble("lon")) },
            s.optDouble("max_station_km", 45.0),
        )
    }

    fun rules(j: JSONObject): RuleSet = RuleSet(
        j.optString("reviewed_on"),
        objs(j.getJSONArray("activities")).map { Activity(it.getString("id"), it.getString("hu")) },
        objs(j.getJSONArray("rules")).map { r ->
            val lv = r.optJSONObject("levels")
            Rule(
                r.getString("id"), r.getString("kind"), strs(r.optJSONArray("activities")), r.optString("level").ifEmpty { null },
                r.optJSONArray("all")?.let { a -> objs(a).map(::cond) }, r.optJSONArray("any")?.let { a -> objs(a).map(::cond) },
                r.optString("hu"), r.optBoolean("workday", false), r.optInt("persist", 1),
                r.optString("basis"), r.optString("source"),
                lv?.keySet()?.associateWith { lv.getString(it) } ?: emptyMap(),
                objs(r.optJSONArray("steps")).map { HeatStep(it.getInt("days"), it.getDouble("mean"), it.getString("level"), it.getString("hu")) },
            )
        },
    )

    private fun cond(c: JSONObject): Cond {
        val raw = c.opt("value")
        return Cond(
            c.getString("var"), c.getString("op"),
            (raw as? Number)?.toDouble(), (raw as? JSONArray)?.let { a -> (0 until a.length()).map { a.getDouble(it) } } ?: emptyList(),
            c.optString("stat").ifEmpty { null }, c.optJSONObject("and")?.let(::cond),
        )
    }

    private fun objs(a: JSONArray?): List<JSONObject> = if (a == null) emptyList() else (0 until a.length()).map { a.getJSONObject(it) }
    private fun strs(a: JSONArray?): List<String> = if (a == null) emptyList() else (0 until a.length()).map { a.getString(it) }
    private fun ints(a: JSONArray): List<Int> = (0 until a.length()).map { a.getInt(it) }
}

object Geo {
    fun km(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val r = Math.PI / 180
        val h = sin((lat2 - lat1) * r / 2).pow(2) + cos(lat1 * r) * cos(lat2 * r) * sin((lon2 - lon1) * r / 2).pow(2)
        return 2 * 6371 * asin(sqrt(h))
    }

    /** The nearest DWD MOSMIX station within the source's max_station_km, or null (then MET Norway is alone). */
    fun station(src: Source, lat: Double, lon: Double): Pair<Station, Double>? =
        src.stations.map { it to km(lat, lon, it.lat, it.lon) }.filter { it.second <= src.maxStationKm }.minByOrNull { it.second }

    /**
     * The MeteoAlarm area of a position that is not one of the named places (the "Itt" button, a saved place): Budapest
     * within 12 km of its centre, otherwise the county whose approximate centre is nearest. Approximate near a border.
     */
    fun warnAreas(lat: Double, lon: Double): List<String> {
        if (km(lat, lon, 47.4979, 19.0402) <= 12) return listOf("Budapest")
        return listOf(COUNTIES.minBy { km(lat, lon, it.second, it.third) }.first)
    }

    /** Hungary's 19 counties with an approximate centre each. */
    val COUNTIES = listOf(
        Triple("Bács-Kiskun", 46.57, 19.38), Triple("Baranya", 46.05, 18.23), Triple("Békés", 46.77, 21.03),
        Triple("Borsod-Abaúj-Zemplén", 48.20, 20.80), Triple("Csongrád-Csanád", 46.42, 20.25), Triple("Fejér", 47.12, 18.60),
        Triple("Győr-Moson-Sopron", 47.65, 17.25), Triple("Hajdú-Bihar", 47.45, 21.45), Triple("Heves", 47.80, 20.20),
        Triple("Jász-Nagykun-Szolnok", 47.25, 20.50), Triple("Komárom-Esztergom", 47.60, 18.30), Triple("Nógrád", 48.00, 19.55),
        Triple("Pest", 47.40, 19.40), Triple("Somogy", 46.55, 17.60), Triple("Szabolcs-Szatmár-Bereg", 48.00, 22.00),
        Triple("Tolna", 46.50, 18.55), Triple("Vas", 47.10, 16.75), Triple("Veszprém", 47.10, 17.60), Triple("Zala", 46.75, 16.90),
    )

    /** GPS rounded to two decimals (about 1 km) before it is used anywhere (D-144). */
    fun round2(x: Double): Double = Math.round(x * 100) / 100.0
}

object Time {
    /** ISO time with Z or an offset; null when it does not parse. */
    fun parse(s: String?): Instant? {
        if (s.isNullOrBlank()) return null
        return try { Instant.parse(s.trim()) } catch (e: Exception) {
            try { OffsetDateTime.parse(s.trim()).toInstant() } catch (e2: Exception) { null }
        }
    }

    fun hourFloor(t: Instant): Instant = t.truncatedTo(ChronoUnit.HOURS)
}

/** Accent-free, lower case, split into words; common.js fold + areaMatch. */
object Areas {
    fun fold(s: String?): String = java.text.Normalizer.normalize(s ?: "", java.text.Normalizer.Form.NFD)
        .replace(Regex("\\p{M}+"), "").lowercase()

    fun match(area: String?, name: String?): Boolean {
        val w = { s: String? -> fold(s).split(Regex("[^a-z0-9]+")).filter { it.isNotEmpty() } }
        val a = w(area); val n = w(name)
        if (a.isEmpty() || n.isEmpty()) return false
        return n.all { it in a } || a.all { it in n }
    }
}
