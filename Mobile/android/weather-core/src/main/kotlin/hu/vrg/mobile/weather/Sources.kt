package hu.vrg.mobile.weather

import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.Locale
import java.util.zip.ZipInputStream

// The phone's three sources, parsed as on the PC (Weather/lib/adapters/met-no.js, dwd-mosmix.js, meteoalarm.js). Only
// parsing lives here; feature-weather does the requests and the cache.

/** One forecast value of one member: member = "<source>/<model>", valid = the hour it is for (amounts: the hour's end). */
data class Fc(val member: String, val source: String, val valid: Instant, val v: String, val value: Double)

data class Issue(val source: String, val issued: Instant, val rows: List<Fc>)

data class Warning(
    val id: String, val area: String, val event: String?, val type: String?, val level: Int?,
    val onset: Instant, val expires: Instant, val headline: String?, val description: String?,
)

object MetNo {
    /** The request: coordinates cut to 4 decimals as the terms ask, altitude rounded. */
    fun url(src: Source, lat: Double, lon: Double, elev: Int?): String =
        src.url.replace("{lat}", "%.4f".format(Locale.ROOT, lat)).replace("{lon}", "%.4f".format(Locale.ROOT, lon))
            .replace("{elev}", (elev ?: 100).toString())

    /** MET Norway asks every client to name itself with a way to reach its owner. Blank contact = the source waits. */
    fun userAgent(contact: String): String? = contact.trim().takeIf { it.isNotEmpty() }?.let { "VRG-Mobile-Idojaras/1.0 ($it)" }

    fun parse(text: String, now: Instant = Instant.now()): Issue {
        val p = JSONObject(text).optJSONObject("properties") ?: JSONObject()
        val issued = Time.parse(p.optJSONObject("meta")?.optString("updated_at")) ?: now
        val out = ArrayList<Fc>()
        fun put(valid: Instant, v: String, value: Double?) { if (value != null && value.isFinite()) out += Fc("met-no/met-no", "met-no", valid, v, value) }
        val ts = p.optJSONArray("timeseries") ?: JSONArray()
        for (i in 0 until ts.length()) {
            val t = ts.getJSONObject(i)
            val valid = Time.parse(t.optString("time")) ?: continue
            val data = t.optJSONObject("data") ?: continue
            val d = data.optJSONObject("instant")?.optJSONObject("details") ?: JSONObject()
            val temp = d.num("air_temperature"); val rh = d.num("relative_humidity"); val ws = d.num("wind_speed")
            put(valid, "t2m", temp)
            put(valid, "rh2m", rh)
            put(valid, "dew2m", d.num("dew_point_temperature") ?: Vars.dewpoint(temp, rh))
            put(valid, "pmsl", d.num("air_pressure_at_sea_level"))
            put(valid, "cloud", d.num("cloud_area_fraction"))
            put(valid, "wind", ws)
            put(valid, "wdir", d.num("wind_from_direction"))
            put(valid, "gust", d.num("wind_speed_of_gust"))
            put(valid, "uv", d.num("ultraviolet_index_clear_sky"))
            put(valid, "tapp", Vars.apparent(temp, rh, ws))
            d.num("fog_area_fraction")?.let { if (it >= 50) put(valid, "vis", 500.0) }
            val n1 = data.optJSONObject("next_1_hours"); val n6 = data.optJSONObject("next_6_hours")
            // amounts are for the hour that STARTS at `time`; stored at the hour's end, like MOSMIX
            if (n1 != null) {
                val at = valid.plus(1, ChronoUnit.HOURS); val det = n1.optJSONObject("details") ?: JSONObject()
                put(at, "precip", det.num("precipitation_amount"))
                put(at, "pop", det.num("probability_of_precipitation"))
                put(at, "pthunder", det.num("probability_of_thunder"))
                put(at, "wmo", Vars.metSymbolToWmo(n1.optJSONObject("summary")?.optString("symbol_code"))?.toDouble())
            } else if (n6 != null) {
                val det = n6.optJSONObject("details") ?: JSONObject()
                val code = Vars.metSymbolToWmo(n6.optJSONObject("summary")?.optString("symbol_code"))?.toDouble()
                for (h in 1L..6L) {
                    val at = valid.plus(h, ChronoUnit.HOURS)
                    det.num("precipitation_amount")?.let { put(at, "precip", it / 6) }
                    put(at, "pop", det.num("probability_of_precipitation"))
                    put(at, "pthunder", det.num("probability_of_thunder"))
                    put(at, "wmo", code)
                }
            }
        }
        return Issue("met-no", issued, out)
    }
}

object Mosmix {
    fun url(src: Source, station: Station): String = src.url.split("{station}").joinToString(station.id)

    private fun kml(bytes: ByteArray): String {
        if (bytes.size > 1 && bytes[0] == 0x50.toByte() && bytes[1] == 0x4b.toByte()) {
            ZipInputStream(ByteArrayInputStream(bytes)).use { z ->
                while (true) {
                    val e = z.nextEntry ?: break
                    if (e.name.lowercase().endsWith(".kml")) return z.readBytes().toString(Charsets.UTF_8)
                }
            }
            error("MOSMIX: no .kml in the KMZ")
        }
        return bytes.toString(Charsets.UTF_8)
    }

    fun parse(bytes: ByteArray, station: Station, now: Instant = Instant.now()): Issue {
        val kml = kml(bytes)
        val issued = Time.parse(Regex("<dwd:IssueTime[^>]*>([\\s\\S]*?)</dwd:IssueTime>").find(kml)?.groupValues?.get(1)) ?: now
        val steps = Regex("<dwd:TimeStep>([^<]+)</dwd:TimeStep>").findAll(kml).map { Time.parse(it.groupValues[1]) }.toList()
        val el = HashMap<String, List<Double?>>()
        for (m in Regex("<dwd:Forecast\\s+dwd:elementName=\"([^\"]+)\">\\s*<dwd:value>([\\s\\S]*?)</dwd:value>").findAll(kml))
            el[m.groupValues[1]] = m.groupValues[2].trim().split(Regex("\\s+")).map { if (it == "-" || it.isEmpty()) null else it.toDoubleOrNull() }
        require(steps.isNotEmpty() && el["TTT"] != null) { "MOSMIX: no time steps or no TTT" }
        val member = "dwd-mosmix/mosmix:${station.id}"
        val out = ArrayList<Fc>()
        for (i in steps.indices) {
            val valid = steps[i] ?: continue
            fun g(k: String): Double? = el[k]?.getOrNull(i)
            fun put(v: String, value: Double?) { if (value != null && value.isFinite()) out += Fc(member, "dwd-mosmix", valid, v, value) }
            val t = g("TTT")?.let { it - 273.15 }; val td = g("Td")?.let { it - 273.15 }
            val rh = if (t != null && td != null) 100 * Math.exp(17.625 * td / (243.04 + td)) / Math.exp(17.625 * t / (243.04 + t)) else null
            put("t2m", t); put("dew2m", td); put("rh2m", rh)
            put("wind", g("FF")); put("gust", g("FX1")); put("wdir", g("DD"))
            put("precip", g("RR1c")); put("pop", g("R101")); put("pthunder", g("wwT"))
            put("cloud", g("N")); put("pmsl", g("PPPP")?.let { it / 100 })
            put("swrad", g("Rad1h")?.let { it / 3.6 })
            put("vis", g("VV")); put("wmo", Vars.mapWw(g("ww"))?.toDouble())
            put("tapp", Vars.apparent(t, rh, g("FF")))
        }
        return Issue("dwd-mosmix", issued, out)
    }
}

object MeteoAlarm {
    val TYPE_HU = mapOf(1 to "szél", 2 to "hó, ónos eső", 3 to "zivatar", 4 to "köd", 5 to "hőség", 6 to "hideg", 7 to "part menti esemény",
        8 to "erdőtűz", 9 to "lavina", 10 to "eső", 12 to "árvíz", 13 to "eső-árvíz")
    val LEVEL_HU = mapOf(1 to "zöld", 2 to "sárga", 3 to "narancs", 4 to "piros")

    private fun levelOf(s: String?): Int? = Regex("^(\\d)").find(s ?: "")?.groupValues?.get(1)?.toInt()
    private fun typeOf(s: String?): String? = Regex("^(\\d+)\\s*;\\s*(.*)$").find(s ?: "")?.let { TYPE_HU[it.groupValues[1].toInt()] ?: it.groupValues[2].trim() }

    fun parse(text: String): List<Warning> {
        val s = text.trim()
        return (if (s.startsWith("<")) atom(s) else json(JSONObject(s)))
    }

    private fun json(j: JSONObject): List<Warning> {
        val out = ArrayList<Warning>()
        val ws = j.optJSONArray("warnings") ?: return out
        for (i in 0 until ws.length()) {
            val w = ws.getJSONObject(i)
            val a = w.optJSONObject("alert") ?: w
            if (a.optString("msgType") == "Cancel") continue
            val infos = a.optJSONArray("info") ?: continue
            val list = (0 until infos.length()).map { infos.getJSONObject(it) }
            val info = list.firstOrNull { it.optString("language").lowercase().startsWith("hu") }
                ?: list.firstOrNull { it.optString("language").lowercase().startsWith("en") } ?: list.firstOrNull() ?: continue
            val params = info.optJSONArray("parameter")
            fun param(n: String): String? = params?.let { p -> (0 until p.length()).map { p.getJSONObject(it) }.firstOrNull { it.optString("valueName") == n }?.optString("value") }
            val onset = Time.parse(info.optString("onset").ifEmpty { info.optString("effective").ifEmpty { a.optString("sent") } }) ?: continue
            val expires = Time.parse(info.optString("expires")) ?: continue
            val areas = info.optJSONArray("area") ?: continue
            for (k in 0 until areas.length()) {
                val area = areas.getJSONObject(k).optString("areaDesc").ifEmpty { null } ?: continue
                out += Warning("${a.optString("identifier")}#$k", area, info.optString("event").ifEmpty { null }, typeOf(param("awareness_type")),
                    levelOf(param("awareness_level")), onset, expires, info.optString("headline").ifEmpty { null }, info.optString("description").ifEmpty { null })
            }
        }
        return out
    }

    private fun atom(xml: String): List<Warning> {
        fun g(s: String, n: String): String? = Regex("<$n[^>]*>([\\s\\S]*?)</$n>").find(s)?.groupValues?.get(1)
            ?.replace(Regex("<!\\[CDATA\\[|]]>"), "")?.trim()
        val out = ArrayList<Warning>()
        var k = 0
        for (m in Regex("<entry[\\s>][\\s\\S]*?</entry>").findAll(xml)) {
            val e = m.value
            if (g(e, "cap:message_type")?.contains("cancel", ignoreCase = true) == true) continue
            val area = g(e, "cap:areaDesc") ?: continue
            val onset = Time.parse(g(e, "cap:onset") ?: g(e, "cap:effective")) ?: continue
            val expires = Time.parse(g(e, "cap:expires")) ?: continue
            val id = g(e, "cap:identifier") ?: g(e, "id") ?: "atom-${k++}"
            out += Warning("$id#0", area, g(e, "cap:event"), typeOf(g(e, "cap:awareness_type")), levelOf(g(e, "cap:awareness_level")),
                onset, expires, g(e, "title"), null)
        }
        return out
    }
}

private fun JSONObject.num(k: String): Double? = if (has(k) && !isNull(k)) optDouble(k).takeIf { it.isFinite() } else null
