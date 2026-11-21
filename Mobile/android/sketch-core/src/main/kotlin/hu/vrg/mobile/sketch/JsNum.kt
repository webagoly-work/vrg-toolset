package hu.vrg.mobile.sketch

import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode

// F9 (WP M54): numbers written the way JavaScript writes them, so the phone's SVG (PlanSvg, SiteSvg) is the Desktop's
// SVG character for character: Number#toString (the shortest digits that read back as the same double; 4000, not
// 4000.0) and Number#toFixed (rounded on the double's exact value, as the spec says, not on its printed digits).
internal object JsNum {
    fun str(v: Double): String {
        if (v.isNaN()) return "NaN"
        if (v.isInfinite()) return if (v > 0) "Infinity" else "-Infinity"
        if (v == 0.0) return "0"
        if (v == Math.rint(v) && Math.abs(v) < 1e21) return BigDecimal(v).toPlainString()
        val neg = v < 0
        val a = Math.abs(v)
        val exact = BigDecimal(a)
        var bd = exact
        for (p in 1..17) {
            val r = exact.round(MathContext(p, RoundingMode.HALF_EVEN))
            if (r.toDouble() == a) { bd = r; break }
        }
        val u = bd.unscaledValue().toString().trimEnd('0').ifEmpty { "0" }
        val k = u.length
        val n = bd.precision() - bd.scale()     // the decimal point sits after n digits
        val s = when {
            n in k..21 -> u + "0".repeat(n - k)
            n in 1..21 -> u.substring(0, n) + "." + u.substring(n)
            n in -5..0 -> "0." + "0".repeat(-n) + u
            else -> {
                val e = n - 1
                (if (k == 1) u else u[0] + "." + u.substring(1)) + "e" + (if (e >= 0) "+" else "-") + Math.abs(e)
            }
        }
        return if (neg) "-$s" else s
    }

    fun fixed(v: Double, digits: Int): String {
        if (v.isNaN()) return "NaN"
        if (Math.abs(v) >= 1e21) return str(v)
        val s = BigDecimal(Math.abs(v)).setScale(digits, RoundingMode.HALF_UP).toPlainString()
        return if (v < 0) "-$s" else s
    }

    /** JavaScript's Math.round: halves go up (towards +∞). */
    fun round(v: Double): Double = Math.floor(v + 0.5)
}
