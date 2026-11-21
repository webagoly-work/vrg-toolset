package hu.vrg.mobile.sketch

import org.json.JSONArray
import org.json.JSONObject

// F9 (WP M54, the Founder's D-81 B): the Felmérési jegyzőkönyv printed and shared from the phone. The document itself
// is the Desktop's: Sketcher/lib/report.js runs in a hidden WebView (feature-sketch ReportUi.kt) through
// Sketcher/lib/report-phone.js, from the input this file puts together. Here are the rules, pure and tested:
//
//  - what goes in follows the export rules (D-123): SketchFeatures.forExport (the client only when kept, D-82; no sound
//    notes when switched off), a photo only as a downscaled re-encoded copy (no EXIF, so no GPS: D-57) with its blur
//    burned in, a *Személyes adat* photo only when something on it is blurred;
//  - *Az ügyfélnek* (D-124) also leaves out the Tisztázandó notes and the internal Ellenőrizni lines;
//  - over 15 MB the phone warns before Átadás and offers the PDF (D-126).
object Jegyzokonyv {
    /** The photos' long side in the report and their JPEG quality (D-125): sharp on A4 at a third of the width. */
    const val PHOTO_PX = 1200
    const val JPEG_Q = 80
    /** Above this the self-contained HTML is heavy to hand over (D-126): warn and offer the PDF. */
    const val MAX_HTML_BYTES = 15L * 1024 * 1024

    fun fileName(s: Sketch) = SketchJson.fileStem(s) + ".jegyzokonyv.html"
    fun pdfName(s: Sketch) = SketchJson.fileStem(s) + "_jegyzokonyv"

    /** A capture that gets a picture in the report: a photo (a personal one only blurred) or a signature. */
    fun pictured(c: Capture): Boolean = when (c.kind) {
        CaptureKind.PHOTO -> !c.privacy || c.marks.any { it.kind.blur }
        CaptureKind.SIGNATURE -> true
        else -> false
    }
    /** The blur marks burned into the report's copy (only the blur: the arrows and circles stay on the phone's markup). */
    fun blurOf(c: Capture): List<Mark> = if (c.kind == CaptureKind.PHOTO) c.marks.filter { it.kind.blur } else emptyList()

    /** The survey as it may leave the phone: the export rules (D-82, D-84, D-90). */
    fun survey(off: Set<String>, s: Sketch): Sketch = SketchFeatures.forExport(off, s)

    /** *Az ügyfélnek* (D-124): the takeoff without the Tisztázandó notes and the Ellenőrizni lines. */
    fun forClient(t: JSONObject): JSONObject {
        val o = JSONObject(t.toString())
        o.optJSONArray("notes")?.let { a -> o.put("notes", JSONArray((0 until a.length()).mapNotNull { a.optJSONObject(it) }.filter { !it.optBoolean("open") })) }
        o.put("checks", JSONArray())
        o.optJSONObject("counts")?.let { if (it.has("tisztazando")) it.put("tisztazando", 0) }
        return o
    }

    /**
     * The WebView's input for report-phone.js: the survey [s] (already through [survey]), its [takeoff] (built from the
     * same [s]), the field kit's [catalog] JSON and the active [variant] JSON, the [photos] as data: URLs by capture id
     * (only [pictured] ones), the drawing and the site as SVG (PlanSvg, SiteSvg from the package plan of [s]).
     */
    fun input(s: Sketch, norm: Norm, takeoff: JSONObject?, catalog: JSONObject, variant: JSONObject?, photos: Map<String, String>,
              forClient: Boolean, now: Long): JSONObject {
        val pkg = PlannerExport.build(s, norm, now)
        val survey = pkg.getJSONObject("sketch")
        val plan = pkg.optJSONObject("plan")
        val site = SiteSvg.of(s.site, plan)
        val rooms = JSONArray()
        plan?.optJSONObject("data")?.optJSONArray("floors")?.let { fl ->
            for (i in 0 until fl.length()) fl.optJSONObject(i)?.let { f -> rooms.put(JSONObject().put("id", f.optJSONObject("sk")?.optString("id") ?: f.optString("id")).put("name", f.optString("name"))) }
        }
        val pics = JSONObject()
        s.captures.filter { pictured(it) }.forEach { c -> photos[c.id]?.let { pics.put(c.id, it) } }
        return JSONObject()
            .put("survey", survey)
            .put("takeoff", takeoff?.let { if (forClient) forClient(it) else it } ?: JSONObject.NULL)
            .put("catalog", catalog)
            .put("variant", variant ?: JSONObject.NULL)
            .put("rooms", rooms)
            .put("photos", pics)
            .put("withheld", JSONArray(s.captures.filter { it.kind == CaptureKind.PHOTO && !pictured(it) }.map { it.id }))
            .put("planSvg", PlanSvg.svg(survey, plan))
            .put("siteSvg", site.svg)
            .put("siteLines", JSONArray(site.lines))
            .put("forClient", forClient)
            .put("now", now)
    }

    fun tooBig(bytes: Long) = bytes > MAX_HTML_BYTES
    fun mb(bytes: Long) = "%.1f MB".format(java.util.Locale.ROOT, bytes / 1048576.0).replace('.', ',')
}
