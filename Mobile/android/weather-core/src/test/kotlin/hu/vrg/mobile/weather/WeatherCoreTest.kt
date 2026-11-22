package hu.vrg.mobile.weather

import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Invented answers in each source's shape (as Weather/test/fixtures.js); no network. The unit cases mirror
// Weather/test/a-units.test.js so the phone and the PC fuse and judge alike.
class WeatherCoreTest {
    // Friday 2026-11-20, 07:30 in Budapest
    private val now = Instant.parse("2026-11-20T06:30:00Z")
    private val bp = Config.places.first { it.id == "budapest" }

    // ------------------------------------------------------------ the bundled config
    @Test fun bundledConfigEqualsWeatherConfig() {
        val repo = File(System.getProperty("vrg.repo") ?: "../..")
        for (f in listOf("rules.json", "places.json", "sources.json", "settings.json")) {
            val pc = File(repo, "Weather/config/$f").readText()
            assertEquals(pc, Config.text(f), "weather-core/src/main/resources/weather/$f differs from Weather/config/$f: copy it over")
        }
    }

    @Test fun configReads() {
        assertEquals(setOf("kulteri", "magasban", "kabel", "tetoPV"), Config.rules.activities.map { it.id }.toSet())
        assertEquals(7, Config.settings.workday.from); assertEquals(17, Config.settings.workday.to)
        assertEquals(1.5, Config.settings.tolerance["t2m"])
        assertTrue(Config.places.size >= 7)
        assertTrue(Config.source("dwd-mosmix").stations.any { it.id == "12843" })
        for (id in Config.PHONE_SOURCES) assertEquals("yes", Config.source(id).commercial, "$id must be free for a company (D-138)")
        // every rule kind is one the phone evaluates or knowingly skips
        for (r in Config.rules.rules) assertTrue(r.kind in setOf("hourly", "warning", "heatwave") + Rules.SKIPPED_KINDS, r.id)
        // every variable a rule tests is a canonical one
        for (r in Config.rules.rules) for (c in (r.all.orEmpty() + r.any.orEmpty())) assertNotNull(Vars.ALL[c.v], "${r.id}: ${c.v}")
    }

    // ------------------------------------------------------------ vars (a-units)
    @Test fun codes() {
        assertEquals(0, Vars.metSymbolToWmo("clearsky_day"))
        assertEquals(99, Vars.metSymbolToWmo("heavyrainandthunder"))
        assertEquals(85, Vars.metSymbolToWmo("lightsnowshowers_night"))
        assertEquals(63, Vars.metSymbolToWmo("rain"))
        assertNull(Vars.metSymbolToWmo(null))
        assertEquals(95, Vars.mapWw(95.0)); assertEquals(95, Vars.mapWw(17.0)); assertEquals(61, Vars.mapWw(61.0))
        assertEquals(66, Vars.mapWw(66.0)); assertEquals(45, Vars.mapWw(45.0)); assertEquals(2, Vars.mapWw(2.0)); assertNull(Vars.mapWw(null))
        assertTrue(abs(Vars.dewpoint(20.0, 50.0)!! - 9.3) < 0.2)
        assertTrue(Vars.apparent(30.0, 70.0, 1.0)!! > 30 && Vars.apparent(0.0, 70.0, 8.0)!! < -4)
    }

    // ------------------------------------------------------------ fusion (a-units)
    @Test fun medianCodeConfidence() {
        val p = listOf(Fuse.P("a", 1.0, 1.0), Fuse.P("b", 1.2, 1.0), Fuse.P("c", 9.0, 1.0))
        assertEquals(1.2, Fuse.wmedian(p)); assertTrue(Fuse.wmean(p)!! > 3)
        assertEquals(2.0, Fuse.wmedian(listOf(Fuse.P("a", 1.0, 1.0), Fuse.P("b", 3.0, 1.0))))
        fun codes(vararg c: Int) = c.map { Fuse.P("m$it", it.toDouble(), 1.0) }
        assertEquals(63.0, Fuse.fuseCode(codes(95, 63, 61)).first)
        assertEquals(95.0, Fuse.fuseCode(codes(95, 96, 3)).first)
        assertEquals(95.0, Fuse.fuseCode(codes(95)).first)
        val tol = mapOf("t2m" to 1.5)
        assertEquals("magas", Fuse.confidence("t2m", 0.3, 4, tol))
        assertEquals("közepes", Fuse.confidence("t2m", 1.0, 4, tol))
        assertEquals("alacsony", Fuse.confidence("t2m", 2.0, 4, tol))
        assertEquals("egy", Fuse.confidence("t2m", null, 1, tol))
        val d = Fuse.vecmean(listOf(Fuse.P("a", 350.0, 1.0), Fuse.P("b", 10.0, 1.0)))
        assertTrue(d < 1 || d > 359, "the vector mean of 350° and 10° is north, not 180°: $d")
    }

    // ------------------------------------------------------------ parsers
    @Test fun metNoParses() {
        val iss = MetNo.parse(metJson(hours = 4, t = 8.0, gust = 6.0, symbol = "rain"), now)
        assertEquals(Instant.parse("2026-11-20T06:00:00Z"), iss.issued)
        val first = Instant.parse("2026-11-20T07:00:00Z")
        assertEquals(8.0, iss.rows.first { it.v == "t2m" && it.valid == first }.value)
        // the amount and the symbol of the hour starting at 07:00 are stored at its end, 08:00
        assertEquals(63.0, iss.rows.first { it.v == "wmo" && it.valid == first.plus(1, ChronoUnit.HOURS) }.value)
        assertTrue(iss.rows.any { it.v == "tapp" }); assertTrue(iss.rows.all { it.member == "met-no/met-no" })
        assertEquals("https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=47.4979&lon=19.0402&altitude=110",
            MetNo.url(Config.source("met-no"), bp.lat, bp.lon, bp.elev))
        assertNull(MetNo.userAgent("  "))
        assertEquals("VRG-Mobile-Idojaras/1.0 (valaki@example.com)", MetNo.userAgent("valaki@example.com"))
    }

    @Test fun metNoSixHourStepsSpread() {
        val j = JSONObject().put("properties", JSONObject()
            .put("meta", JSONObject().put("updated_at", "2026-11-20T06:00:00Z"))
            .put("timeseries", JSONArray().put(JSONObject().put("time", "2026-11-23T00:00:00Z").put("data", JSONObject()
                .put("instant", JSONObject().put("details", JSONObject().put("air_temperature", 2.0)))
                .put("next_6_hours", JSONObject().put("summary", JSONObject().put("symbol_code", "snow"))
                    .put("details", JSONObject().put("precipitation_amount", 6.0)))))))
        val rows = MetNo.parse(j.toString(), now).rows.filter { it.v == "precip" }
        assertEquals(6, rows.size); assertTrue(rows.all { it.value == 1.0 })
    }

    @Test fun mosmixParsesKmz() {
        val st = Config.source("dwd-mosmix").stations.first { it.id == "12843" }
        val iss = Mosmix.parse(kmz(listOf(281.15, 282.15), gust = listOf(13.0, 5.0), ww = listOf(95.0, 61.0)), st, now)
        assertEquals("dwd-mosmix", iss.source)
        assertEquals(8.0, iss.rows.first { it.v == "t2m" }.value, 1e-9)
        assertEquals(13.0, iss.rows.first { it.v == "gust" }.value)
        assertEquals(95.0, iss.rows.first { it.v == "wmo" }.value)
        assertTrue(iss.rows.all { it.member == "dwd-mosmix/mosmix:12843" })
        assertEquals("https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/12843/kml/MOSMIX_L_LATEST_12843.kmz",
            Mosmix.url(Config.source("dwd-mosmix"), st))
    }

    @Test fun meteoAlarmJsonAndAtom() {
        val w = MeteoAlarm.parse(alarmJson("Pest", level = "2; yellow; Moderate", type = "1; Wind"))
        assertEquals(1, w.size); assertEquals(2, w[0].level); assertEquals("szél", w[0].type); assertEquals("Pest", w[0].area)
        assertEquals(Instant.parse("2026-11-20T09:00:00Z"), w[0].onset)   // +01:00 offset read
        val atom = """<feed><entry><cap:areaDesc>Budapest</cap:areaDesc><cap:event>Széllökés</cap:event>
            <cap:onset>2026-11-20T08:00:00+01:00</cap:onset><cap:expires>2026-11-20T20:00:00+01:00</cap:expires>
            <cap:awareness_level>3; orange; Severe</cap:awareness_level><cap:awareness_type>1; Wind</cap:awareness_type>
            <cap:identifier>x1</cap:identifier><title>Szél</title></entry></feed>"""
        val a = MeteoAlarm.parse(atom)
        assertEquals(1, a.size); assertEquals(3, a[0].level); assertEquals("x1#0", a[0].id)
        // a cancelled JSON alert is dropped
        assertTrue(MeteoAlarm.parse(alarmJson("Pest", "2; yellow; Moderate", "1; Wind", msgType = "Cancel")).isEmpty())
    }

    @Test fun areasAndPlaces() {
        assertTrue(Areas.match("Csongrád", "Csongrád-Csanád"))
        assertTrue(Areas.match("Pest megye", "Pest"))
        assertFalse(Areas.match("Pest", "Budapest"))
        assertEquals(listOf("Budapest"), Geo.warnAreas(47.50, 19.05))
        assertEquals(listOf("Pest"), Geo.warnAreas(47.60, 19.36))      // Gödöllő
        assertEquals(listOf("Hajdú-Bihar"), Geo.warnAreas(47.53, 21.63))
        assertEquals(47.5, Geo.round2(47.4979)); assertEquals(19.04, Geo.round2(19.0402))
        assertEquals("12843", Geo.station(Config.source("dwd-mosmix"), bp.lat, bp.lon)!!.first.id)
        assertNull(Geo.station(Config.source("dwd-mosmix"), 46.9, 16.3))   // far from every listed station
    }

    // ------------------------------------------------------------ fuse + rules end to end
    private fun issues(metGust: Double, dwdGust: List<Double>, ww: List<Double> = listOf(3.0, 3.0), t: Double = 8.0): List<Issue> {
        val st = Config.source("dwd-mosmix").stations.first { it.id == "12843" }
        val met = MetNo.parse(metJson(hours = 13, t = t, gust = metGust, symbol = "cloudy", start = "2026-11-20T06:00:00Z"), now)
        val dwd = Mosmix.parse(kmz(List(2) { t + 273.15 }, gust = dwdGust, ww = ww), st, now)
        return listOf(met, dwd)
    }
    private val prior = mapOf("met-no" to 1.0, "dwd-mosmix" to 1.0)

    @Test fun calmDayAllClear() {
        val hours = Fuse.fuse(issues(4.0, listOf(4.0, 4.0)), prior, now = now)
        assertTrue(hours.isNotEmpty())
        val two = hours.first { it.valid == Instant.parse("2026-11-20T07:00:00Z") }
        assertEquals(setOf("met-no/met-no", "dwd-mosmix/mosmix:12843"), two.members["t2m"]!!.keys)
        assertEquals("magas", two.conf["t2m"])
        val f = Rules.evaluate(bp, hours, emptyList(), now = now)
        val day = Rules.day(f, now = now)
        assertEquals("Ma", day.label); assertEquals(8, day.fromHour)
        assertEquals(Level.OK, day.verdicts.first { it.activity.id == "kulteri" }.level)
        assertNotNull(day.verdicts.first().window)
        assertTrue(Rules.summary(bp.name, day, hours, now).startsWith("Budapest (belváros) · Ma: 🟢 mehet · 8 °C"))
    }

    @Test fun mewpGustIsRedForHeightOnly() {
        // both members agree on 13–14 m/s at 08:00 UTC (09:00 local) → magasban red, kültéri untouched
        val hours = Fuse.fuse(issues(14.0, listOf(13.0, 13.0)), prior, now = now)
        val f = Rules.evaluate(bp, hours, emptyList(), now = now)
        val day = Rules.day(f, now = now)
        val height = day.verdicts.first { it.activity.id == "magasban" }
        assertEquals(Level.RED, height.level)
        assertTrue(height.reasons.first().startsWith("Széllökés"), height.reasons.toString())
        assertEquals(Level.OK, day.verdicts.first { it.activity.id == "kabel" }.level)
    }

    @Test fun loneThunderIsAmberNotRed() {
        val hours = Fuse.fuse(issues(4.0, listOf(4.0, 4.0), ww = listOf(95.0, 95.0)), prior, now = now)
        val f = Rules.evaluate(bp, hours, emptyList(), now = now)
        assertTrue(f.any { it.rule == "thunder-possible" }); assertFalse(f.any { it.rule == "thunder-agreed" })
        assertEquals(Level.AMBER, Rules.day(f, now = now).verdicts.first { it.activity.id == "kulteri" }.level)
    }

    @Test fun coldIsForCableWork() {
        val hours = Fuse.fuse(issues(3.0, listOf(3.0, 3.0), t = -1.0), prior, now = now)
        val f = Rules.evaluate(bp, hours, emptyList(), now = now)
        val cable = Rules.day(f, now = now).verdicts.first { it.activity.id == "kabel" }
        assertEquals(Level.RED, cable.level)   // ≤ 0 °C for 2 h on a work day
        assertTrue(cable.reasons.any { it.startsWith("Fagy") })
    }

    @Test fun officialWarningMatchesTheArea() {
        val hours = Fuse.fuse(issues(4.0, listOf(4.0, 4.0)), prior, now = now)
        val w = MeteoAlarm.parse(alarmJson("Budapest", "3; orange; Severe", "1; Wind"))
        val f = Rules.evaluate(bp, hours, w, now = now)
        val off = f.filter { it.rule == "official-warning" }
        assertEquals(1, off.size); assertEquals(Level.RED, off[0].level)
        assertTrue(off[0].title.contains("narancs"), off[0].title)
        // the same warning for another county does not touch Budapest
        assertTrue(Rules.evaluate(bp, hours, MeteoAlarm.parse(alarmJson("Zala", "3; orange; Severe", "1; Wind")), now = now)
            .none { it.rule == "official-warning" })
    }

    @Test fun staleIssuesDoNotCount() {
        val old = issues(4.0, listOf(4.0, 4.0)).map { it.copy(issued = now.minus(40, ChronoUnit.HOURS)) }
        assertTrue(Fuse.fuse(old, prior, now = now).isEmpty())
    }

    @Test fun afterWorkTheVerdictIsForTheNextWorkDay() {
        val sat = Instant.parse("2026-11-21T17:00:00Z")   // Saturday 18:00 local; Sunday is off
        val day = Rules.day(emptyList(), now = sat)
        assertEquals(java.time.LocalDate.of(2026, 11, 23), day.date); assertEquals("Hétfő", day.label)
        assertEquals("Holnap", Rules.day(emptyList(), now = Instant.parse("2026-11-19T17:00:00Z")).label)
    }

    // ------------------------------------------------------------ fixtures
    private fun metJson(hours: Int, t: Double, gust: Double, symbol: String, start: String = "2026-11-20T07:00:00Z"): String {
        val ts = JSONArray()
        for (h in 0 until hours) {
            val time = Instant.parse(start).plus(h.toLong(), ChronoUnit.HOURS)
            ts.put(JSONObject().put("time", time.toString()).put("data", JSONObject()
                .put("instant", JSONObject().put("details", JSONObject().put("air_temperature", t).put("relative_humidity", 80.0)
                    .put("wind_speed", 3.0).put("wind_speed_of_gust", gust).put("wind_from_direction", 200.0)
                    .put("air_pressure_at_sea_level", 1015.0).put("cloud_area_fraction", 90.0)))
                .put("next_1_hours", JSONObject().put("summary", JSONObject().put("symbol_code", symbol))
                    .put("details", JSONObject().put("precipitation_amount", 0.0).put("probability_of_precipitation", 10.0)))))
        }
        return JSONObject().put("type", "Feature").put("properties", JSONObject()
            .put("meta", JSONObject().put("updated_at", "2026-11-20T06:00:00Z")).put("timeseries", ts)).toString()
    }

    /** A KMZ with time steps 07:00 … 18:00 UTC; the given lists fill the first values, the rest repeat the last one. */
    private fun kmz(tK: List<Double>, gust: List<Double>, ww: List<Double>): ByteArray {
        val n = 12
        val steps = (0 until n).joinToString("") { "<dwd:TimeStep>${Instant.parse("2026-11-20T07:00:00Z").plus(it.toLong(), ChronoUnit.HOURS)}</dwd:TimeStep>" }
        fun el(name: String, v: List<Double>) = "<dwd:Forecast dwd:elementName=\"$name\"><dwd:value> " +
            (0 until n).joinToString("  ") { (v.getOrNull(it) ?: v.last()).toString() } + " </dwd:value></dwd:Forecast>"
        val kml = """<?xml version="1.0"?><kml:kml><kml:Document><kml:ExtendedData><dwd:ProductDefinition>
            <dwd:IssueTime>2026-11-20T03:00:00.000Z</dwd:IssueTime><dwd:ForecastTimeSteps>$steps</dwd:ForecastTimeSteps>
            </dwd:ProductDefinition></kml:ExtendedData><kml:Placemark><kml:name>12843</kml:name><kml:ExtendedData>
            ${el("TTT", tK)}${el("Td", tK.map { it - 2 })}${el("FF", listOf(3.0))}${el("FX1", gust)}${el("DD", listOf(190.0))}
            ${el("RR1c", listOf(0.0))}${el("R101", listOf(10.0))}${el("wwT", listOf(5.0))}${el("N", listOf(85.0))}
            ${el("PPPP", listOf(101500.0))}${el("ww", ww)}
            <dwd:Forecast dwd:elementName="VV"><dwd:value> - - - - - - - - - - - - </dwd:value></dwd:Forecast>
            </kml:ExtendedData></kml:Placemark></kml:Document></kml:kml>"""
        val bos = ByteArrayOutputStream()
        ZipOutputStream(bos).use { z -> z.putNextEntry(ZipEntry("MOSMIX_L_2026112003_12843.kml")); z.write(kml.toByteArray()); z.closeEntry() }
        return bos.toByteArray()
    }

    private fun alarmJson(area: String, level: String, type: String, msgType: String = "Alert"): String =
        JSONObject().put("warnings", JSONArray().put(JSONObject().put("alert", JSONObject()
            .put("identifier", "2.49.0.1.348.0.TEST").put("sent", "2026-11-20T06:00:00+01:00").put("msgType", msgType)
            .put("info", JSONArray().put(JSONObject().put("language", "hu-HU").put("event", "Széllökés")
                .put("onset", "2026-11-20T10:00:00+01:00").put("expires", "2026-11-20T22:00:00+01:00")
                .put("parameter", JSONArray()
                    .put(JSONObject().put("valueName", "awareness_level").put("value", level))
                    .put(JSONObject().put("valueName", "awareness_type").put("value", type)))
                .put("area", JSONArray().put(JSONObject().put("areaDesc", area)))))))).toString()
}
