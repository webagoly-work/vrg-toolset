package hu.vrg.mobile.core

import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sin
import kotlin.math.sqrt

// Gömb (WP M14, SOL-Q1 = A, SOL-Q2 = B): the Solomon sphere on the phone. Solomon's scan runs on the PC and
// lands on the `solomon-data` branch; here are the file's model, the placement, the projection and the
// ruling's append rule. The placement must stay the same as Solomon/src/index.html, so a dot sits in the same
// place on both; SphereTest checks it against values taken from that page. Rules: docs/solomon/README.md.

object Solomon {
    /** The one branch the phone reads and rules on. The PC makes it; the phone never does. */
    const val BRANCH = "solomon-data"
    const val SIGNALS = "Solomon/data/signals.json"
    const val RULINGS = "Solomon/data/rulings.jsonl"
    const val REFRESH_MS = 60 * 60 * 1000L

    fun writable(branch: String) = branch == BRANCH
}

enum class SignalType(val key: String, val label: String) {
    CONTRADICTION("contradiction", "Ellentmondás"),
    DARK("dark", "Sötét zóna"),
    FROZEN("frozen", "Dermedt");

    companion object { fun of(key: String) = entries.firstOrNull { it.key == key } }
}

enum class RuleHow(val key: String, val label: String) {
    FIRST("first", "Az első áll"),
    SECOND("second", "A második áll"),
    COEXIST("coexist", "Megférnek egymás mellett");

    companion object { fun label(key: String) = entries.firstOrNull { it.key == key }?.label ?: key }
}

data class Vec(val x: Double, val y: Double, val z: Double) {
    operator fun plus(o: Vec) = Vec(x + o.x, y + o.y, z + o.z)
    operator fun times(k: Double) = Vec(x * k, y * k, z * k)
    fun cross(o: Vec) = Vec(y * o.z - z * o.y, z * o.x - x * o.z, x * o.y - y * o.x)
    fun dot(o: Vec) = x * o.x + y * o.y + z * o.z
    fun unit(): Vec {
        val l = sqrt(dot(this))
        return if (l == 0.0) Vec(x, y, z) else Vec(x / l, y / l, z / l)
    }
}

data class Quote(val path: String, val line: Int, val text: String) {
    val ref: String get() = "$path:$line"
}

data class Ruling(val how: String, val why: String, val date: String)

data class Signal(
    val id: String,
    val type: SignalType,
    val stage: String?,
    val kind: String?,
    val section: String,
    val title: String,
    val a: Quote?,
    val b: Quote?,
    /** The intern's reason. */
    val note: String?,
    val ruling: Ruling?,
    val keystone: Boolean,
    /** Indexes into [SphereMap.docs]. */
    val ai: Int?,
    val bi: Int?,
) {
    val open: Boolean get() = ruling == null && stage != "dismissed"

    /** Only a contradiction the intern confirmed reaches the Founder. */
    val rulable: Boolean get() = type == SignalType.CONTRADICTION && stage == "confirmed" && ruling == null

    val stageLabel: String? get() = when (stage) {
        "candidate" -> "jelölt"
        "confirmed" -> "megerősítve"
        "dismissed" -> "elvetve"
        else -> null
    }

    /** Lists sort by this: what the Founder must look at first. */
    val order: Int get() = (if (ruling != null || stage == "dismissed") 9 else 0) + when {
        stage == "confirmed" -> 0
        type == SignalType.CONTRADICTION -> 1
        type == SignalType.DARK -> 2
        else -> 3
    }

    val tag: String get() = listOfNotNull(type.label, kind, stageLabel, "sokan hivatkoznak rá".takeIf { keystone }).joinToString(" · ")
}

data class SphereDoc(
    val path: String,
    val section: String,
    val title: String,
    val date: String,
    /** How many documents cite it. */
    val cited: Int,
    val pos: Vec,
    val recent: Boolean,
    val signals: List<Signal>,
) {
    /** What the dot shows: 4 confirmed clash, 3 candidate, 2 dark zone, 1 frozen, 0 plain. */
    val rank: Int = signals.filter { it.open }.maxOfOrNull {
        when {
            it.type == SignalType.CONTRADICTION -> if (it.stage == "confirmed") 4 else 3
            it.type == SignalType.DARK -> 2
            else -> 1
        }
    } ?: 0

    fun shows(layer: SignalType?) = layer == null || signals.any { it.open && it.type == layer }
}

data class SphereSection(val id: String, val name: String, val docs: Int, val reviewed: String?, val summary: String?, val center: Vec)

data class SphereMap(
    val generated: String,
    val commit: String,
    val sections: List<SphereSection>,
    val docs: List<SphereDoc>,
    val signals: List<Signal>,
) {
    val open: List<Signal> = signals.filter { it.open }
    val arcs: List<Signal> = open.filter { it.type == SignalType.CONTRADICTION && it.ai != null && it.bi != null && it.ai != it.bi }

    fun count(t: SignalType) = open.count { it.type == t }
    fun openIn(section: String) = open.count { it.section == section }
    fun sorted(t: SignalType?) = signals.filter { t == null || it.type == t }.sortedBy { it.order }
}

/** One rotation of the sphere; the sines are worked out once per frame. */
class Turn(yaw: Double, pitch: Double) {
    val cy = cos(yaw); val sy = sin(yaw); val cp = cos(pitch); val sp = sin(pitch)

    /** [out] gets the point in unit coordinates: y up, z towards the viewer. Inline, so a frame allocates nothing. */
    inline fun <R> see(p: Vec, out: (x: Double, y: Double, z: Double) -> R): R {
        val z0 = -p.x * sy + p.z * cy
        return out(p.x * cy + p.z * sy, p.y * cp - z0 * sp, p.y * sp + z0 * cp)
    }
}

object Sphere {
    private val GOLD = PI * (3 - sqrt(5.0))
    const val MIN_PITCH = -1.3
    const val MAX_PITCH = 1.3

    fun fib(i: Int, n: Int): Vec {
        val y = 1 - 2 * (i + .5) / n
        val r = sqrt(1 - y * y)
        val a = i * GOLD
        return Vec(cos(a) * r, y, sin(a) * r)
    }

    val ambient: List<Vec> by lazy { List(640) { fib(it, 640) } }

    /** The yaw and pitch that bring [p] to the middle of the disc. */
    fun focus(p: Vec): Pair<Double, Double> = atan2(-p.x, p.z) to asin(p.y)

    /** One island per section, each document on a golden-angle spiral inside its cap. Keep the same as the web page. */
    private fun place(sections: List<Triple<String, Int, Vec>>, docSections: List<String>): List<Vec> {
        val pos = arrayOfNulls<Vec>(docSections.size)
        val most = sections.maxOfOrNull { it.second } ?: 1
        for ((id, docs, c) in sections) {
            val t1 = c.cross(if (abs(c.y) > .9) Vec(1.0, 0.0, 0.0) else Vec(0.0, 1.0, 0.0)).unit()
            val t2 = c.cross(t1)
            val cap = .16 + .36 * sqrt(docs.toDouble() / most)
            val members = docSections.indices.filter { docSections[it] == id }
            members.forEachIndexed { j, doc ->
                val r = cap * sqrt((j + .5) / members.size)
                val a = j * GOLD
                pos[doc] = (c + t1 * (r * cos(a)) + t2 * (r * sin(a))).unit()
            }
        }
        return pos.map { it ?: Vec(0.0, 1.0, 0.0) }
    }

    private fun JSONObject.text(k: String) = if (isNull(k)) null else optString(k).ifEmpty { null }

    private fun quote(o: JSONObject?) = o?.let { Quote(it.getString("p"), it.optInt("line"), it.optString("text")) }

    /** signals.json with the rulings file laid over it: a ruling on the branch counts before the PC's next scan. Null when unreadable. */
    fun parse(signals: String, rulings: String?): SphereMap? = try {
        val o = JSONObject(signals)
        val generated = o.getString("generated")
        val laid = Rulings.parse(rulings)

        val secs = o.getJSONArray("sections").objects()
        val centers = secs.mapIndexed { i, s -> Triple(s.getString("id"), s.getInt("docs"), fib(i, secs.size)) }
        val sections = secs.mapIndexed { i, s ->
            SphereSection(s.getString("id"), s.getString("n"), s.getInt("docs"), s.text("reviewed"), s.text("summary"), centers[i].third)
        }

        val list = o.getJSONArray("signals").objects().mapNotNull { s ->
            val type = SignalType.of(s.optString("type")) ?: return@mapNotNull null
            val own = s.optJSONObject("ruling")?.let { Ruling(it.getString("how"), it.getString("why"), it.getString("date")) }
            val id = s.getString("id")
            Signal(
                id, type, s.text("stage"), s.text("kind"), s.optString("sec"), s.optString("title"),
                quote(s.optJSONObject("a")), quote(s.optJSONObject("b")), s.text("note"), laid[id] ?: own, s.optBoolean("keystone"),
                if (s.has("ai")) s.getInt("ai") else null, if (s.has("bi")) s.getInt("bi") else null,
            )
        }

        val raw = o.getJSONArray("docs").objects()
        val placed = place(centers, raw.map { it.getString("s") })
        val day = LocalDate.parse(generated)
        val docs = raw.mapIndexed { i, d ->
            val date = d.getString("d")
            SphereDoc(
                d.getString("p"), d.getString("s"), d.getString("t"), date, d.optInt("i"), placed[i],
                ChronoUnit.DAYS.between(LocalDate.parse(date), day) < 7,
                list.filter { it.ai == i || it.bi == i },
            )
        }
        SphereMap(generated, o.optString("commit"), sections, docs, list)
    } catch (e: Exception) { null }

    private fun JSONArray.objects(): List<JSONObject> = (0 until length()).map { getJSONObject(it) }

    /** The pitch after a drag; a drag never turns the sphere over. */
    fun pitched(pitch: Double, by: Double) = max(MIN_PITCH, minOf(MAX_PITCH, pitch + by))
}

object Rulings {
    /** The last ruling on each signal. Unreadable lines are skipped: one bad line must not hide the rest. */
    fun parse(text: String?): Map<String, Ruling> {
        val out = HashMap<String, Ruling>()
        text.orEmpty().lines().filter { it.isNotBlank() }.forEach { l ->
            try {
                val o = JSONObject(l)
                out[o.getString("id")] = Ruling(o.getString("how"), o.getString("why"), o.getString("date"))
            } catch (e: Exception) { }
        }
        return out
    }

    fun line(id: String, how: RuleHow, why: String, date: String): String =
        JSONObject().put("id", id).put("how", how.key).put("why", why.trim()).put("date", date).put("from", "phone").toString()

    fun append(existing: String, line: String): String =
        (if (existing.isEmpty() || existing.endsWith("\n")) existing else existing + "\n") + line + "\n"

    /** Appends one ruling on [Solomon.BRANCH]: read + sha, append, write with that sha; a conflict re-reads, like a note. */
    suspend fun send(api: NotesApi, id: String, how: RuleHow, why: String, date: String): PutResult {
        repeat(NoteLog.RETRIES) {
            val cur = api.read(Solomon.RULINGS, Solomon.BRANCH) ?: return PutResult.Failed("Nincs ${Solomon.BRANCH} branch; a PC hozza létre.")
            val text = append(cur.text, line(id, how, why, date))
            when (val r = api.write(Solomon.RULINGS, Solomon.BRANCH, text, cur.sha, "solomon-data: döntés $id")) {
                PutResult.Conflict -> {}
                else -> return r
            }
        }
        return PutResult.Failed("A fájlt többször is más írta közben; később újra.")
    }
}
