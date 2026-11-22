package hu.vrg.mobile.weather

import kotlin.math.exp
import kotlin.math.ln

// The canonical variables and the WMO code table, ported from Weather/lib/vars.js. The ids are the PC's: never rename one.

enum class Kind { CONT, SUM, PROB, DIR, CODE }

data class VarInfo(val unit: String, val kind: Kind, val hu: String)

object Vars {
    val ALL: Map<String, VarInfo> = linkedMapOf(
        "t2m" to VarInfo("°C", Kind.CONT, "Hőmérséklet"),
        "tapp" to VarInfo("°C", Kind.CONT, "Hőérzet"),
        "dew2m" to VarInfo("°C", Kind.CONT, "Harmatpont"),
        "rh2m" to VarInfo("%", Kind.CONT, "Relatív páratartalom"),
        "precip" to VarInfo("mm/h", Kind.SUM, "Csapadék"),
        "pop" to VarInfo("%", Kind.PROB, "Csapadék valószínűsége"),
        "pthunder" to VarInfo("%", Kind.PROB, "Zivatar valószínűsége"),
        "snow" to VarInfo("cm/h", Kind.SUM, "Hó"),
        "wind" to VarInfo("m/s", Kind.CONT, "Szél (10 m)"),
        "gust" to VarInfo("m/s", Kind.CONT, "Széllökés"),
        "wdir" to VarInfo("°", Kind.DIR, "Szélirány"),
        "cloud" to VarInfo("%", Kind.CONT, "Felhőzet"),
        "pmsl" to VarInfo("hPa", Kind.CONT, "Légnyomás (tszf.)"),
        "cape" to VarInfo("J/kg", Kind.CONT, "CAPE (labilitás)"),
        "lpi" to VarInfo("J/kg", Kind.CONT, "Villámpotenciál"),
        "wmo" to VarInfo("kód", Kind.CODE, "Időkép"),
        "swrad" to VarInfo("W/m²", Kind.CONT, "Napsugárzás (GHI)"),
        "uv" to VarInfo("", Kind.CONT, "UV-index"),
        "vis" to VarInfo("m", Kind.CONT, "Látótávolság"),
        "tsoil0" to VarInfo("°C", Kind.CONT, "Talajfelszín hőm."),
        "frzlvl" to VarInfo("m", Kind.CONT, "Fagyszint"),
        "pm25" to VarInfo("µg/m³", Kind.CONT, "PM2,5"),
        "pm10" to VarInfo("µg/m³", Kind.CONT, "PM10"),
        "o3" to VarInfo("µg/m³", Kind.CONT, "Ózon"),
        "no2" to VarInfo("µg/m³", Kind.CONT, "NO₂"),
        "eaqi" to VarInfo("", Kind.CONT, "Európai légminőség-index"),
        "ragweed" to VarInfo("db/m³", Kind.CONT, "Parlagfű pollen"),
        "grass" to VarInfo("db/m³", Kind.CONT, "Fűpollen"),
        "birch" to VarInfo("db/m³", Kind.CONT, "Nyírpollen"),
    )

    data class Wmo(val hu: String, val sev: Int, val icon: String)

    val WMO: Map<Int, Wmo> = mapOf(
        0 to Wmo("derült", 0, "sun"), 1 to Wmo("túlnyomóan derült", 1, "sun"), 2 to Wmo("részben felhős", 2, "part"),
        3 to Wmo("borult", 3, "cloud"), 45 to Wmo("köd", 10, "fog"), 48 to Wmo("zúzmarás köd", 12, "fog"),
        51 to Wmo("gyenge szitálás", 20, "drizzle"), 53 to Wmo("szitálás", 21, "drizzle"), 55 to Wmo("erős szitálás", 22, "drizzle"),
        56 to Wmo("ónos szitálás", 40, "ice"), 57 to Wmo("erős ónos szitálás", 42, "ice"),
        61 to Wmo("gyenge eső", 24, "rain"), 63 to Wmo("eső", 26, "rain"), 65 to Wmo("erős eső", 30, "rain"),
        66 to Wmo("ónos eső", 44, "ice"), 67 to Wmo("erős ónos eső", 46, "ice"),
        71 to Wmo("gyenge havazás", 32, "snow"), 73 to Wmo("havazás", 34, "snow"), 75 to Wmo("erős havazás", 38, "snow"),
        77 to Wmo("hószemcse", 31, "snow"), 80 to Wmo("gyenge zápor", 25, "shower"), 81 to Wmo("zápor", 28, "shower"),
        82 to Wmo("heves zápor", 36, "shower"), 85 to Wmo("hózápor", 33, "snow"), 86 to Wmo("erős hózápor", 37, "snow"),
        95 to Wmo("zivatar", 50, "thunder"), 96 to Wmo("zivatar jégesővel", 55, "thunder"), 99 to Wmo("heves zivatar jégesővel", 60, "thunder"),
    )

    /** The glyph the phone draws for a code's icon. */
    val ICON_GLYPH = mapOf("sun" to "☀", "part" to "⛅", "cloud" to "☁", "fog" to "🌫", "drizzle" to "🌦", "rain" to "🌧",
        "ice" to "🧊", "snow" to "❄", "shower" to "🌦", "thunder" to "⛈")

    fun wmoSev(c: Int?): Int = c?.let { WMO[it]?.sev } ?: -1
    fun isThunder(c: Double?): Boolean = c != null && c >= 95 && c <= 99
    fun glyph(code: Double?): String = code?.let { WMO[it.toInt()]?.icon }?.let { ICON_GLYPH[it] } ?: "·"

    private val MET_SYMBOL = mapOf(
        "clearsky" to 0, "fair" to 1, "partlycloudy" to 2, "cloudy" to 3, "fog" to 45,
        "lightrain" to 61, "rain" to 63, "heavyrain" to 65, "lightrainshowers" to 80, "rainshowers" to 81, "heavyrainshowers" to 82,
        "lightsleet" to 66, "sleet" to 66, "heavysleet" to 67, "lightsleetshowers" to 66, "sleetshowers" to 66, "heavysleetshowers" to 67,
        "lightsnow" to 71, "snow" to 73, "heavysnow" to 75, "lightsnowshowers" to 85, "snowshowers" to 85, "heavysnowshowers" to 86,
    )

    /** A MET Norway symbol_code (with or without _day/_night/_polartwilight) as the nearest WMO code. */
    fun metSymbolToWmo(sym: String?): Int? {
        if (sym.isNullOrEmpty()) return null
        val base = sym.replace(Regex("_(day|night|polartwilight)$"), "")
        if ("thunder" in base) return if ("heavy" in base) 99 else if ("snow" in base || "sleet" in base) 96 else 95
        return MET_SYMBOL[base]
    }

    /** WMO 4677 present weather (DWD MOSMIX ww) onto the code subset above; dwd-mosmix.js mapWw. */
    fun mapWw(raw: Double?): Int? {
        if (raw == null || !raw.isFinite()) return null
        val ww = Math.round(raw).toInt()
        return when {
            ww >= 95 -> if (ww == 95) 95 else if (ww == 97) 99 else 96
            ww in 91..94 -> 95
            ww >= 85 -> if (ww == 85) 85 else 86
            ww >= 80 -> if (ww == 80) 80 else if (ww == 81) 81 else if (ww <= 84) 82 else 81
            ww >= 70 -> if (ww <= 71) 71 else if (ww <= 73) 73 else if (ww <= 75) 75 else 77
            ww >= 66 -> if (ww == 67) 67 else 66
            ww >= 60 -> if (ww <= 61) 61 else if (ww <= 63) 63 else 65
            ww >= 56 -> if (ww == 56) 56 else 57
            ww >= 50 -> if (ww <= 51) 51 else if (ww <= 53) 53 else 55
            ww >= 40 -> if (ww >= 48) 48 else 45
            ww in 17..19 -> 95
            ww <= 3 -> ww
            else -> null
        }
    }

    /** Magnus dew point, °C. */
    fun dewpoint(t: Double?, rh: Double?): Double? {
        if (t == null || rh == null || rh <= 0) return null
        val a = 17.62; val b = 243.12
        val g = ln(rh / 100) + a * t / (b + t)
        return b * g / (a - g)
    }

    /** Australian BoM apparent temperature without the radiation term; wind in m/s. */
    fun apparent(t: Double?, rh: Double?, wind: Double?): Double? {
        if (t == null || rh == null) return null
        val e = rh / 100 * 6.105 * exp(17.27 * t / (237.7 + t))
        return t + 0.33 * e - 0.7 * (wind ?: 0.0) - 4
    }
}
