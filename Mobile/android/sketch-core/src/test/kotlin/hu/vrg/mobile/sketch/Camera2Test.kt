package hu.vrg.mobile.sketch

import org.json.JSONObject
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Kamera 2: the new capture fields, an M29 file opening unchanged, type-plate reading, before / after pairs, the
// export's privacy rules, the video limits, the signature and the hold menu's next missing shots.
class Camera2Test {
    private val repo = File(System.getProperty("vrg.repo") ?: "../..")
    private val kit = FieldKit.parse(File(repo, "Sketcher/catalog/fieldkit.json").readText())

    private fun survey() = Sketch("S1", name = "Kossuth u. 12")

    // ---- the model ------------------------------------------------------------------------------------------------

    @Test fun anM29FileOpensWithTheDefaultsAndWritesBackTheSame() {
        val m29 = """{"kind":"vrg-vazlat","v":2,"id":"S9","name":"Régi","seq":3,"captures":[
            {"id":"C1","file":"C-1.jpg","purpose":"merohely","at":5,"note":"","lat":47.5,"lon":19.04,
             "marks":[{"kind":"nyil","pts":[[0.1,0.2],[0.3,0.4]],"text":"","col":4293420060}]}]}"""
        val s = SketchJson.read(m29)!!
        val c = s.captures.single()
        assertEquals(CaptureKind.PHOTO, c.kind); assertNull(c.phase); assertNull(c.pair)
        assertFalse(c.privacy); assertFalse(c.keepGps); assertEquals(0, c.ocrAt); assertTrue(c.ocr.isEmpty())
        assertEquals(0.0, c.marks.single().w)
        // the written capture has no new key at all: an M29 phone reads it exactly as before
        val back = SketchJson.write(s).getJSONArray("captures").getJSONObject(0)
        for (k in listOf("kind", "phase", "pair", "privacy", "keepGps", "ocr", "ocrAt", "durationMs", "bytes", "signer")) assertFalse(back.has(k), k)
        assertFalse(back.getJSONArray("marks").getJSONObject(0).has("w"))
        assertEquals(c, SketchJson.read(SketchJson.write(s).toString())!!.captures.single())
    }

    @Test fun theNewFieldsSurviveARoundTrip() {
        var s = survey()
        val (s1, id) = Intake.addCapture(s, "C-a.jpg", "tabla", null, null, "mero_tabla", 10)
        s = Intake.editCapture(s1, id) { it.copy(phase = Camera2.BEFORE, privacy = true, keepGps = true, ocrAt = 11,
            ocr = listOf(OcrHit("mero_szam", "12345678", "Gyári szám: 12345678", used = true), OcrHit("fi", "30 mA", "30mA", dropped = true)),
            marks = listOf(Mark(MarkKind.BLUR, listOf(Pt(0.1, 0.1), Pt(0.4, 0.3))), Mark(MarkKind.BLUR_BRUSH, listOf(Pt(0.5, 0.5), Pt(0.6, 0.6), Pt(0.7, 0.6)), w = 0.05))) }
        val (s2, v) = Camera2.addVideo(s, "V-b.mp4", "nyomvonal", "R1", null, 42_000, 31_000_000, 12)
        val (s3, g) = Camera2.addSignature(s2, "S-c.png", " Kiss Anna ", Camera2.STATEMENTS[2], 13)
        val back = SketchJson.read(SketchJson.write(s3).toString())!!
        assertEquals(s3.captures, back.captures)
        assertEquals(CaptureKind.VIDEO, back.capture(v)!!.kind); assertEquals(42_000, back.capture(v)!!.durationMs)
        assertEquals("Kiss Anna", back.capture(g)!!.signer); assertEquals("dokumentum", back.capture(g)!!.purpose)
        assertTrue(MarkKind.BLUR.blur && MarkKind.BLUR_BRUSH.blur && !MarkKind.ARROW.blur)
    }

    @Test fun exportNamesCarryTheFileType() {
        var s = survey()
        val (s1, p) = Intake.addCapture(s, "C-1.jpg", "hiba", null, null, null, 1); s = s1
        val (s2, v) = Camera2.addVideo(s, "V-1.mp4", "nyomvonal", null, null, 1000, 1000, 2); s = s2
        val (s3, g) = Camera2.addSignature(s, "S-1.png", "Kiss Anna", "x", 3); s = s3
        assertEquals("kossuth-u-12_${p}_hiba.jpg", Intake.exportName(s, s.capture(p)!!))
        assertEquals("kossuth-u-12_${v}_nyomvonal.mp4", Intake.exportName(s, s.capture(v)!!))
        assertEquals("kossuth-u-12_${g}_alairas.png", Intake.exportName(s, s.capture(g)!!))
    }

    // ---- before / after -------------------------------------------------------------------------------------------

    @Test fun anAfterPhotoPairsWithAnEarlierOneOfTheSamePurposeTheSameRoomFirst() {
        var s = survey()
        fun add(purpose: String, room: String?, at: Long, kind: String = CaptureKind.PHOTO): String {
            val (o, id) = Intake.addCapture(s, "$at.jpg", purpose, room, null, null, at); s = Intake.editCapture(o, id) { it.copy(kind = kind) }; return id
        }
        val a = add("hiba", "R2", 1); val b = add("hiba", "R1", 2); val c = add("eloszto", "R1", 3); val vid = add("hiba", "R1", 4, CaptureKind.VIDEO)
        val after = add("hiba", "R1", 10)
        assertEquals(listOf(b, a), Camera2.beforeCandidates(s, s.capture(after)!!).map { it.id })
        assertFalse(c in Camera2.beforeCandidates(s, s.capture(after)!!).map { it.id }); assertFalse(vid in Camera2.beforeCandidates(s, s.capture(after)!!).map { it.id })
        s = Camera2.pair(s, after, b)
        assertEquals(Camera2.BEFORE, s.capture(b)!!.phase); assertEquals(Camera2.AFTER, s.capture(after)!!.phase); assertEquals(b, s.capture(after)!!.pair)
        assertEquals(listOf(b to after), Camera2.pairs(s).map { it.first.id to it.second.id })
        // a second after for the same before replaces the first
        val after2 = add("hiba", "R1", 11)
        s = Camera2.pair(s, after2, b)
        assertNull(s.capture(after)!!.phase); assertEquals(after2, Camera2.afterOf(s, b)!!.id)
        // unpair from the before side clears both
        s = Camera2.unpair(s, b)
        assertTrue(Camera2.pairs(s).isEmpty()); assertNull(s.capture(after2)!!.pair)
        // a before waiting for its after
        s = Camera2.markBefore(s, a)
        assertEquals(listOf(a), Camera2.waiting(s).map { it.id })
        assertEquals(s, Camera2.pair(s, a, a))
    }

    // ---- privacy -----------------------------------------------------------------------------------------------------

    @Test fun gpsLeavesThePhoneOnlyWhenKeptAndNeverFromAPersonalPhoto() {
        val c = Capture("C1", "a.jpg", lat = 47.0, lon = 19.0)
        assertEquals(Camera2.ExportPlan(burnBlur = false, marked = false, gps = false), Camera2.exportPlan(c))
        assertTrue(Camera2.exportPlan(c.copy(keepGps = true)).gps)
        assertFalse(Camera2.exportPlan(c.copy(keepGps = true, privacy = true)).gps)
        val blur = Mark(MarkKind.BLUR, listOf(Pt(0.0, 0.0), Pt(0.5, 0.5)))
        val arrow = Mark(MarkKind.ARROW, listOf(Pt(0.0, 0.0), Pt(0.5, 0.5)))
        assertEquals(Camera2.ExportPlan(true, false, false), Camera2.exportPlan(c.copy(marks = listOf(blur))))
        assertEquals(Camera2.ExportPlan(true, true, false), Camera2.exportPlan(c.copy(marks = listOf(blur, arrow))))
        assertEquals(Camera2.ExportPlan(false, true, false), Camera2.exportPlan(c.copy(marks = listOf(arrow))))
        assertFalse(Camera2.exportPlan(c.copy(kind = CaptureKind.VIDEO, keepGps = true)).gps)
        val s = survey().copy(captures = listOf(c.copy(privacy = true), c.copy(id = "C2", privacy = true, marks = listOf(blur)), c.copy(id = "C3")))
        assertEquals(listOf("C1"), Camera2.privacyOpen(s).map { it.id })
    }

    // ---- video, signature, the hold menu -----------------------------------------------------------------------------

    @Test fun aLongOrLargeVideoIsFlagged() {
        val v = Capture("C1", "v.mp4", kind = CaptureKind.VIDEO, durationMs = 40_000, bytes = 20L * 1048576)
        assertNull(Camera2.videoWarning(v))
        assertNotNull(Camera2.videoWarning(v.copy(bytes = Camera2.VIDEO_WARN_BYTES + 1)))
        assertNotNull(Camera2.videoWarning(v.copy(durationMs = 200_000)))
        assertEquals("1:05", Camera2.duration(65_000)); assertEquals("20,0 MB", Camera2.mb(20L * 1048576))
    }

    @Test fun aSignatureIsADocumentThatFillsNoShotItemAndRecordsConsent() {
        var s = survey().copy(scope = mapOf("napelem" to 1))     // pv_szamla is a dokumentum item
        val before = FieldKit.shots(kit, s).associate { it.item.id to it.have }
        s = Camera2.addSignature(s, "S-1.png", "Kiss Anna", Camera2.STATEMENTS[1], 5).first
        assertEquals(before, FieldKit.shots(kit, s).associate { it.item.id to it.have })
        assertTrue(Camera2.photoConsent(s))
        assertFalse(Camera2.photoConsent(Camera2.addSignature(survey(), "S.png", "X", Camera2.STATEMENTS[0], 1).first))
        assertEquals(1, Camera2.signatures(s).size)
    }

    @Test fun theHoldMenuOffersTheNextMissingShotsAndTheRecentPurposes() {
        var s = survey().copy(scope = mapOf("merohely" to 1))
        val next = Camera2.nextMissing(kit, s)
        assertTrue(next.isNotEmpty() && next.size <= 4 && next.none { it.done || it.item.room != null })
        val first = next.first().item
        s = Intake.addCapture(s, "x.jpg", first.purpose, null, null, first.id, 1).first
        if (first.need == 1) assertFalse(Camera2.nextMissing(kit, s).any { it.item.id == first.id })
        s = Intake.addCapture(s, "y.jpg", "hiba", null, null, null, 2).first
        assertEquals(listOf("hiba", first.purpose).distinct(), Camera2.recentPurposes(kit, s))
    }

    @Test fun theFixtureCaseKeepsTheTwoEnginesInStep() {
        val fx = JSONObject(File(repo, "Sketcher/test/fixtures/shadow.json").readText()).getJSONArray("cases")
        val found = (0 until fx.length()).map { fx.getJSONObject(it) }.firstOrNull { it.getString("name").startsWith("Kamera 2") }
        assertNotNull(found)
    }
}
