package hu.vrg.mobile.weather

import java.time.Instant
import java.time.LocalDate
import java.time.ZonedDateTime
import java.time.temporal.ChronoUnit
import java.util.Locale

// The field rules, ported from Weather/lib/rules.js evaluate(), sync()'s merge and windows(), plus the phone's own
// read-out: "can we work outside today", per activity. The strike rule needs lightning data, which the phone does not
// have (the PC's LINET source is still off), so it is skipped and the screen says so.

enum class Level(val rank: Int, val hu: String, val dot: String) {
    OK(0, "mehet", "🟢"), INFO(1, "info", "🔵"), AMBER(2, "óvatosan", "🟠"), RED(3, "tilos / szünet", "🔴");

    companion object { fun of(s: String?): Level = when (s) { "red" -> RED; "amber" -> AMBER; "info" -> INFO; else -> OK } }
}

data class Finding(
    val rule: String, val activity: String, val level: Level, val starts: Instant, val ends: Instant,
    val title: String, val detail: String, val basis: String, val key: String = "",
)

/** One activity's verdict for one work day. */
data class Verdict(
    val activity: Activity, val level: Level, val reasons: List<String>,
    /** The longest stretch of the day's work hours with nothing above info, as local hours (from, to), or null. */
    val window: Pair<Int, Int>?,
)

data class Day(val date: LocalDate, val label: String, val fromHour: Int, val toHour: Int, val verdicts: List<Verdict>) {
    val worst: Level get() = verdicts.maxOfOrNull { it.level } ?: Level.OK
}

object Rules {
    val SKIPPED_KINDS = setOf("strike")

    // ------------------------------------------------------------ conditions
    private fun values(h: Hour, v: String, stat: String?): List<Double> {
        val x = h[v] ?: return emptyList()
        if (stat == "any" || stat == "all") return h.members[v]?.values?.toList()?.takeIf { it.isNotEmpty() } ?: listOf(x)
        val s = h.spread[v] ?: 0.0
        return listOf(when (stat) { "upper" -> x + s; "lower" -> x - s; else -> x })
    }

    private fun test(c: Cond, x: Double): Boolean = when (c.op) {
        ">=" -> x >= c.value!!; ">" -> x > c.value!!; "<=" -> x <= c.value!!; "<" -> x < c.value!!
        "thunder" -> Vars.isThunder(x)
        "in" -> c.values.any { it == x }
        else -> error("ismeretlen művelet: ${c.op}")
    }

    fun cond(h: Hour, c: Cond): Boolean {
        val vals = values(h, c.v, c.stat)
        if (vals.isEmpty()) return false
        val hit = if (c.stat == "all") vals.all { test(c, it) } else vals.any { test(c, it) }
        return hit && (c.and == null || cond(h, c.and))
    }

    fun matches(h: Hour, r: Rule): Boolean =
        (r.all == null || r.all.all { cond(h, it) }) && (r.any == null || r.any.any { cond(h, it) }) && (r.all != null || r.any != null)

    fun inWorkday(t: Instant, s: Settings): Boolean {
        val l = t.atZone(s.zone)
        return l.hour >= s.workday.from && l.hour < s.workday.to && l.dayOfWeek.value in s.workday.days
    }

    // ------------------------------------------------------------ titles
    fun fmt(v: String, x: Double?): String = when {
        x == null -> "–"
        v in setOf("precip", "snow", "gust", "wind") -> String.format(Locale.ROOT, "%.1f", x).replace('.', ',')
        else -> Math.round(x).toString()
    }

    fun fill(tpl: String, vars: Map<String, String>): String =
        Regex("\\{(\\w+)\\}").replace(tpl) { m -> vars[m.groupValues[1]] ?: m.value }

    private fun hourVars(h: Hour): Map<String, String> {
        val o = HashMap<String, String>()
        for ((v, x) in h.value) { o[v] = fmt(v, x); o[v + "_upper"] = fmt(v, x + (h.spread[v] ?: 0.0)) }
        return o
    }

    // ------------------------------------------------------------ the rule kinds
    private data class Span(val starts: Instant, var ends: Instant, var n: Int, var worst: Hour)

    fun hourly(rule: Rule, hours: List<Hour>, s: Settings): List<Finding> {
        val first = (rule.all ?: rule.any)!!.first()
        val out = ArrayList<Span>(); var span: Span? = null
        fun close() { span?.let { if (it.n >= rule.persist) out += it }; span = null }
        for (h in hours) {
            val ok = matches(h, rule) && (!rule.workday || inWorkday(h.valid, s))
            if (!ok) { close(); continue }
            val sp = span ?: Span(h.valid.minus(1, ChronoUnit.HOURS), h.valid, 0, h).also { span = it }
            sp.ends = h.valid; sp.n++
            val a = h[first.v]; val b = sp.worst[first.v]
            if (a != null && b != null && (if (first.op == "<=" || first.op == "<") a < b else a > b)) sp.worst = h
        }
        close()
        return out.map { sp ->
            val conf = sp.worst.conf[first.v]
            val src = sp.worst.members[first.v]?.keys?.joinToString(", ").orEmpty().ifEmpty { "–" }
            Finding(rule.id, "", Level.of(rule.level), sp.starts, sp.ends, fill(rule.hu, hourVars(sp.worst)),
                "${sp.n} óra; biztonság: ${conf ?: "–"}; források: $src", rule.basis)
        }
    }

    fun warning(rule: Rule, place: Place, warnings: List<Warning>, s: Settings, now: Instant): List<Finding> {
        val until = now.plus(s.horizonHours.toLong(), ChronoUnit.HOURS)
        return warnings.filter { w -> w.expires >= now && w.onset <= until && place.warnAreas.any { Areas.match(w.area, it) } }
            .mapNotNull { w ->
                val lvl = rule.levels[w.level?.toString()] ?: return@mapNotNull null
                Finding(rule.id, "", Level.of(lvl), w.onset, w.expires,
                    fill(rule.hu, mapOf("event" to (w.event ?: w.type ?: "figyelmeztetés"), "levelHu" to (MeteoAlarm.LEVEL_HU[w.level] ?: ""))),
                    listOfNotNull(w.area, w.headline, w.description).joinToString(" — ").take(600), rule.basis, key = w.event ?: "")
            }
    }

    fun heatwave(rule: Rule, hours: List<Hour>, s: Settings): List<Finding> {
        val days = linkedMapOf<LocalDate, MutableList<Double>>()
        for (h in hours) h["t2m"]?.let { days.getOrPut(h.valid.atZone(s.zone).toLocalDate()) { ArrayList() } += it }
        val means = days.filter { it.value.size >= 20 }.map { (d, a) -> d to a.average() }
        for (step in rule.steps) {
            var run = ArrayList<Pair<LocalDate, Double>>()
            for (m in means + listOf<Pair<LocalDate, Double>?>(null)) {
                if (m != null && m.second >= step.mean) { run += m; continue }
                if (run.size >= step.days) {
                    val from = run.first().first; val to = run.last().first
                    return listOf(Finding(rule.id, "", Level.of(step.level), from.atStartOfDay(s.zone).toInstant(),
                        to.plusDays(1).atStartOfDay(s.zone).toInstant().minusSeconds(60),
                        fill(step.hu, mapOf("from" to from.toString(), "to" to to.toString())),
                        "napi átlag: " + run.joinToString(", ") { "${it.first} ${String.format(Locale.ROOT, "%.1f", it.second)} °C" }, rule.basis))
                }
                run = ArrayList()
            }
        }
        return emptyList()
    }

    // ------------------------------------------------------------ evaluate
    /**
     * Every rule over the fused hours of [place] (from the next hour to the horizon) and its warnings, for all four
     * activities (D-142: the phone answers for every kind of work). Findings of one rule, activity and local start day
     * are one, as the PC's alert fingerprint makes them.
     */
    fun evaluate(place: Place, hours: List<Hour>, warnings: List<Warning>, set: RuleSet = Config.rules, s: Settings = Config.settings,
                 now: Instant = Instant.now()): List<Finding> {
        val from = Time.hourFloor(now).plus(1, ChronoUnit.HOURS)
        val to = Time.hourFloor(now).plus(s.horizonHours.toLong(), ChronoUnit.HOURS)
        val hs = hours.filter { it.valid >= from && it.valid <= to }
        val acts = set.activities.map { it.id }
        val found = ArrayList<Finding>()
        for (rule in set.rules) {
            if (rule.kind in SKIPPED_KINDS) continue
            val targets = if ("*" in rule.activities) listOf("*") else rule.activities.filter { it in acts }
            if (targets.isEmpty()) continue
            val f = when (rule.kind) {
                "hourly" -> hourly(rule, hs, s)
                "warning" -> warning(rule, place, warnings, s, now)
                "heatwave" -> heatwave(rule, hs, s)
                else -> error("ismeretlen szabályfajta: ${rule.kind}")
            }
            for (x in f) for (a in targets) found += x.copy(activity = a)
        }
        // merge as the PC's sync(): one per rule | activity | key | local start day, the first start to the last end
        val merged = linkedMapOf<String, Finding>()
        for (f in found) {
            val k = listOf(f.rule, f.activity, f.key, f.starts.atZone(s.zone).toLocalDate()).joinToString("|")
            val m = merged[k]
            merged[k] = if (m == null) f else m.copy(
                starts = minOf(m.starts, f.starts), ends = maxOf(m.ends, f.ends),
                level = maxOf(m.level, f.level), title = if (f.level > m.level) f.title else m.title,
            )
        }
        return merged.values.toList()
    }

    /** Per activity, per hour ending at h: the worst level of the findings covering it, and their titles (rules.js windows). */
    fun levelAt(findings: List<Finding>, activity: String, h: Instant): Pair<Level, List<Finding>> {
        var level = Level.OK; val why = ArrayList<Finding>()
        for (f in findings) if ((f.activity == activity || f.activity == "*") && f.starts < h && f.ends >= h) {
            if (f.level > level) level = f.level
            why += f
        }
        return level to why
    }

    /**
     * The next work day's verdict: today if work hours are still ahead (and today is a work day), else the next work day.
     * Each activity gets its worst level over the remaining work hours, the reasons (worst first) and the longest window.
     */
    fun day(findings: List<Finding>, set: RuleSet = Config.rules, s: Settings = Config.settings, now: Instant = Instant.now()): Day {
        val local = now.atZone(s.zone)
        var date = local.toLocalDate()
        var fromHour = maxOf(s.workday.from, local.hour + if (local.minute > 0) 1 else 0)
        if (date.dayOfWeek.value !in s.workday.days || fromHour >= s.workday.to) {
            do date = date.plusDays(1) while (date.dayOfWeek.value !in s.workday.days)
            fromHour = s.workday.from
        }
        val label = when (date) { local.toLocalDate() -> "Ma"; local.toLocalDate().plusDays(1) -> "Holnap"; else -> HU_DAYS[date.dayOfWeek.value - 1] }
        val verdicts = set.activities.map { act ->
            var worst = Level.OK; val reasons = linkedMapOf<String, Level>()
            var best: Pair<Int, Int>? = null; var runStart: Int? = null
            for (hour in fromHour until s.workday.to) {
                // the hour from `hour` to `hour + 1` is the one ending at hour + 1 (amounts are stored at their end)
                val end = ZonedDateTime.of(date, java.time.LocalTime.of(hour, 0), s.zone).toInstant().plus(1, ChronoUnit.HOURS)
                val (lv, why) = levelAt(findings, act.id, end)
                if (lv > worst) worst = lv
                for (f in why) if ((reasons[f.title]?.rank ?: -1) < f.level.rank) reasons[f.title] = f.level
                if (lv.rank <= Level.INFO.rank) {
                    if (runStart == null) runStart = hour
                    val len = hour + 1 - runStart
                    if (best == null || len > best.second - best.first) best = runStart to hour + 1
                } else runStart = null
            }
            Verdict(act, worst, reasons.entries.sortedByDescending { it.value.rank }.map { it.key }.filter { reasons[it]!! > Level.OK }, best)
        }
        return Day(date, label, fromHour, s.workday.to, verdicts)
    }

    val HU_DAYS = listOf("Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap")

    /** The home card's one line: "Budapest · Ma: 🟠 óvatosan · 7 °C · ablak 07–11". */
    fun summary(placeName: String, day: Day, hours: List<Hour>, now: Instant = Instant.now()): String {
        val t = hours.minByOrNull { Math.abs(it.valid.epochSecond - now.epochSecond) }?.get("t2m")
        val w = day.verdicts.firstOrNull { it.activity.id == "kulteri" }?.window
        return buildList {
            add(placeName)
            add("${day.label}: ${day.worst.dot} ${day.worst.hu}")
            t?.let { add("${Math.round(it)} °C") }
            w?.let { add("kültéri ablak %02d–%02d".format(it.first, it.second)) }
        }.joinToString(" · ")
    }
}
