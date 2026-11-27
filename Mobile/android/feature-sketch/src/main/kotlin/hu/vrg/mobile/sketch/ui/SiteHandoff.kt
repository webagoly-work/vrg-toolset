package hu.vrg.mobile.sketch.ui

import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.sketch.SiteLink
import hu.vrg.mobile.sketch.Sketch

// Helyszín ↔ Térkép (fork F1): the phone's own VRG Térkép edits a survey's outline and placement, but the survey file
// belongs to the Sketcher. So the map never writes the survey: it leaves its answer in files/sketch/handoff/<id>.site.json
// and opens vrg://sketch?open=<id>&front=helyszin; the Sketcher applies the answer the next time it opens that survey
// (now, or after the app was killed in between: nothing half-done is lost) and deletes the file.
internal object SiteHandoff {
    val SAFE_ID = Regex("[A-Za-z0-9_-]{1,64}")

    /** [s] with the waiting answer applied and saved, or [s] unchanged when there is none (or it is not for this survey). */
    fun take(store: SketchStore, s: Sketch): Sketch {
        val f = store.handoff(s.id)
        if (!f.isFile) return s
        val r = try { SiteLink.parseResult(f.readText()) } catch (e: Exception) { null }
        f.delete()
        if (r == null || r.id != s.id) { VrgLog.w("sketch", "a térkép válasza nem ehhez a vázlathoz tartozik"); return s }
        val now = System.currentTimeMillis()
        val next = SiteLink.apply(s, r, now).copy(updated = now)
        store.save(next)
        return next
    }
}
