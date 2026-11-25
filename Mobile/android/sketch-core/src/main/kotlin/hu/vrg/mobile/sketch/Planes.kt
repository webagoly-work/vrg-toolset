package hu.vrg.mobile.sketch

import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.roundToLong

// Síkmérés (dev line skcam, stage K3, WP M60): measuring on a plane in one photo. The maths and the screen are the
// Desktop's (Sketcher/lib/plane.js + plane-ui.js), which the phone runs in a WebView; this is the pure half that keeps
// the results in the survey's optional `planes` key: { "<photo key>": record }, the key a capture id ("C12") or a
// Fotópont shot ("F25/0"). A record = { ref: {kind, w, h, pts}, floor?, lines: [{a, b, mm, label?}],
// marks: [{p, mm, label?}], aspect, at }; the millimetres come computed from plane.js, so the phone only stores and
// lists them. A record whose photo is gone is dropped on write; turning a Fotópont shot moves its record with it.
object Planes {
    /** The registry switch (Sketcher/catalog/features.json). */
    const val FEATURE = "kamera.measure"

    /** The photo goes to the screen at most this long on the long side: the corners need the detail (JPEG [JPEG_Q]). */
    const val PHOTO_PX = 2400
    const val JPEG_Q = 88

    fun captureKey(id: String) = id
    fun shotKey(point: String, deg: Int) = point + "/" + Photos.norm(deg)

    /** The photo keys that still exist in [s]: every capture photo and every Fotópont shot. */
    fun keys(s: Sketch): Set<String> =
        s.captures.filter { it.kind == CaptureKind.PHOTO }.map { captureKey(it.id) }.toSet() +
            s.photos.flatMap { p -> p.shots.map { shotKey(p.id, it.deg) } }

    private fun all(s: Sketch): JSONObject = s.planes?.let { runCatching { JSONObject(it) }.getOrNull() } ?: JSONObject()

    /** The record of one photo, or null. */
    fun of(s: Sketch, key: String): JSONObject? = all(s).optJSONObject(key)

    /** A record as kept: a JSON object with something measured in it; anything else is no record. */
    private fun valid(o: JSONObject?): JSONObject? {
        if (o == null) return null
        val hasRef = o.optJSONObject("ref")?.optJSONArray("pts")?.length() == 4
        val n = (o.optJSONArray("lines")?.length() ?: 0) + (o.optJSONArray("marks")?.length() ?: 0)
        return if (hasRef || n > 0 || o.has("floor")) o else null
    }

    /** The screen's ✓ Mentés: [json] = the record (or "null" to remove it). Unreadable text leaves the survey as it was. */
    fun put(s: Sketch, key: String, json: String): Sketch {
        val t = json.trim()
        val rec = if (t == "null" || t.isEmpty()) null else runCatching { JSONObject(t) }.getOrNull() ?: return s
        val o = all(s)
        val v = valid(rec)
        if (v == null) o.remove(key) else o.put(key, v)
        return s.copy(planes = o.takeIf { it.length() > 0 }?.toString())
    }

    /** A Fotópont shot turned from [from] to [to] (PhotoOps.turnShot): its record goes along; two records swap. */
    fun turn(s: Sketch, point: String, from: Int, to: Int): Sketch {
        val o = all(s).takeIf { it.length() > 0 } ?: return s
        val a = shotKey(point, from); val b = shotKey(point, to)
        val ra = o.optJSONObject(a); val rb = o.optJSONObject(b)
        o.remove(a); o.remove(b)
        ra?.let { o.put(b, it) }; rb?.let { o.put(a, it) }
        return s.copy(planes = o.takeIf { it.length() > 0 }?.toString())
    }

    fun read(o: JSONObject, s: Sketch): Sketch = s.copy(planes = o.optJSONObject("planes")?.takeIf { it.length() > 0 }?.toString())

    /** Written only when there is a record, and only for photos that still exist. */
    fun write(s: Sketch, o: JSONObject) {
        val all = all(s); if (all.length() == 0) return
        val live = keys(s)
        val out = JSONObject()
        all.keys().forEach { k -> if (k in live) valid(all.optJSONObject(k))?.let { out.put(k, it) } }
        if (out.length() > 0) o.put("planes", out)
    }

    /** One readable line per measurement (= plane.js summary): "Távolság 1: 1,36 m", "Magasság 1: 300 mm". */
    fun summary(rec: JSONObject?): List<String> {
        if (rec == null) return emptyList()
        val out = mutableListOf<String>()
        fun each(a: JSONArray?, f: (JSONObject, Int) -> Unit) { if (a != null) for (i in 0 until a.length()) a.optJSONObject(i)?.let { f(it, i) } }
        each(rec.optJSONArray("lines")) { l, i -> out += l.optString("label").ifBlank { "Távolság ${i + 1}" } + ": " + mm(l) }
        each(rec.optJSONArray("marks")) { m, i -> out += m.optString("label").ifBlank { "Magasság ${i + 1}" } + ": " + mm(m) }
        return out
    }

    private fun mm(o: JSONObject): String = if (!o.has("mm") || o.isNull("mm")) "—" else fmt(o.optDouble("mm"))

    /** As plane.js fmt: under a metre in mm, else metres with two decimals and a decimal comma. */
    fun fmt(mm: Double): String =
        if (mm >= 1000) ((mm / 10).roundToLong() / 100.0).let { v -> if (v == v.toLong().toDouble()) v.toLong().toString() else v.toString().trimEnd('0') }.replace('.', ',') + " m"
        else mm.roundToLong().toString() + " mm"
}
