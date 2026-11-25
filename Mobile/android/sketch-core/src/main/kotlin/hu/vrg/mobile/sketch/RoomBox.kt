package hu.vrg.mobile.sketch

import org.json.JSONObject
import kotlin.math.hypot
import kotlin.math.roundToInt

// Szobadoboz on the phone (dev line skcam, stage K1b, WP M59). The room box itself is the Desktop's
// (Sketcher/lib/roombox.js + roombox-gl.js, WP M57), bundled into the APK and run in a WebView with
// Sketcher/lib/roombox-phone.js as its touch UI, as the jegyzőkönyv runs report.js (M54). This is the pure half:
//
//   - the survey's `box` key (the corrections the viewer writes), read, cleaned and written back;
//   - the viewer's input: the solved plan in mm (PlannerExport's floors and photo points), the corrections, the
//     level's height and the photos as data: URLs under their board names;
//   - the lens: a 35 mm-equivalent focal length from the camera's focal length, sensor size and zoom, which the in-app
//     camera (M52) stores with each Fotópont shot, so the box knows each photo's field of view without EXIF.
object RoomBox {
    /** The 35 mm frame's diagonal: "equivalent" focal lengths are diagonal-based. */
    val DIAG35 = hypot(36.0, 24.0)

    /** The registry switch (Sketcher/catalog/features.json): the box, and Fotópont opening at the widest zoom. */
    const val FEATURE = "vazlat.roombox"

    /** The photos go to the viewer at most this long on the long side (JPEG [JPEG_Q]): enough for a wall, small for a WebView. */
    const val PHOTO_PX = 1600
    const val JPEG_Q = 82

    // ---- the lens -----------------------------------------------------------------------------------------------

    /**
     * The 35 mm-equivalent focal length of a photo: [focalMm] the lens's real focal length, [sensorW] × [sensorH] the
     * sensor in mm (Camera2's SENSOR_INFO_PHYSICAL_SIZE), [zoom] CameraX's zoom ratio (below 1 on a phone whose logical
     * camera switches to the ultrawide). Null when the camera did not say. Rounded to 0.1 mm.
     */
    fun f35(focalMm: Float?, sensorW: Float?, sensorH: Float?, zoom: Float = 1f): Double? {
        if (focalMm == null || sensorW == null || sensorH == null || focalMm <= 0f || sensorW <= 0f || sensorH <= 0f || zoom <= 0f) return null
        val d = hypot(sensorW.toDouble(), sensorH.toDouble())
        return (focalMm * DIAG35 / d * zoom * 10).roundToInt() / 10.0
    }

    /** The zoom Fotópont opens at when the box is on: the widest the camera has (0.5× on a phone with an ultrawide). */
    fun fotopontZoom(minZoom: Float, boxOn: Boolean): Float = if (boxOn && minZoom > 0f && minZoom < 1f) minZoom else 1f

    // ---- the box key --------------------------------------------------------------------------------------------

    /** Cleans a box object to what the viewer reads: h {room: mm > 0}, eye (mm > 0), shots {key: yaw / pitch / f35}. Null when empty. */
    fun clean(o: JSONObject?): JSONObject? {
        if (o == null) return null
        val out = JSONObject()
        o.optJSONObject("h")?.let { h ->
            val j = JSONObject(); h.keys().forEach { k -> val v = h.optInt(k); if (v in 1000..10000) j.put(k, v) }
            if (j.length() > 0) out.put("h", j)
        }
        o.optInt("eye").takeIf { it in 300..2500 }?.let { out.put("eye", it) }
        o.optJSONObject("shots")?.let { sh ->
            val j = JSONObject()
            sh.keys().forEach { k ->
                if (!Regex("^[^/]+/\\d{1,3}$").matches(k)) return@forEach
                val f = sh.optJSONObject(k) ?: return@forEach
                val c = JSONObject()
                num(f, "yaw")?.takeIf { it != 0.0 && it in -45.0..45.0 }?.let { c.put("yaw", it) }
                num(f, "pitch")?.takeIf { it != 0.0 && it in -45.0..45.0 }?.let { c.put("pitch", it) }
                num(f, "f35")?.takeIf { it in 5.0..200.0 }?.let { c.put("f35", it) }
                if (c.length() > 0) j.put(k, c)
            }
            if (j.length() > 0) out.put("shots", j)
        }
        return out.takeIf { it.length() > 0 }
    }

    private fun num(o: JSONObject, k: String): Double? = if (o.has(k) && !o.isNull(k)) o.optDouble(k).takeIf { !it.isNaN() } else null

    fun read(o: JSONObject, s: Sketch): Sketch = s.copy(box = clean(o.optJSONObject("box"))?.toString())

    fun write(s: Sketch, o: JSONObject) { s.box?.let { b -> runCatching { clean(JSONObject(b)) }.getOrNull()?.let { o.put("box", it) } } }

    /** What the viewer hands back (its "Kész"): the corrections cleaned, or none. Unreadable text leaves the survey as it was. */
    fun save(s: Sketch, json: String): Sketch {
        val o = runCatching { JSONObject(json) }.getOrNull() ?: return s
        return s.copy(box = clean(o)?.toString())
    }

    // ---- the viewer's input -------------------------------------------------------------------------------------

    /** The phone's photo file → its board name (what plan.photos names), for the photos the box may show. */
    fun photoFiles(s: Sketch): List<Pair<String, String>> = PlannerExport.photoFiles(s)

    /** Can the box be drawn: a solved room with an outline. */
    fun ready(n: Norm): Boolean = n.rooms.any { it.poly.size >= 3 }

    /**
     * The input of roombox-phone.js: the plan in mm (floors and photo points as the Planner package has them), the
     * corrections, the level's height, the photos as data: URLs under their board names ([images]), and the time.
     */
    fun input(s: Sketch, n: Norm, images: Map<String, String>, now: Long = System.currentTimeMillis(), pano: Boolean = true): JSONObject {
        val plan = PlannerExport.build(s, n, now).getJSONObject("plan")
        return JSONObject()
            .put("name", s.name.ifBlank { "Vázlat" })
            .put("plan", JSONObject()
                .put("data", JSONObject().put("floors", plan.getJSONObject("data").getJSONArray("floors")))
                .put("photos", plan.getJSONArray("photos")))
            .put("box", s.box?.let { runCatching { clean(JSONObject(it)) }.getOrNull() } ?: JSONObject())
            .put("level", JSONObject().put("id", s.level.id).put("heightMm", s.level.heightMm))
            .put("images", JSONObject().also { j -> images.toSortedMap().forEach { (k, v) -> j.put(k, v) } })
            .put("now", now)
            .put("pano", pano)          // skcam K4: the Körkép buttons, behind vazlat.pano
    }
}
