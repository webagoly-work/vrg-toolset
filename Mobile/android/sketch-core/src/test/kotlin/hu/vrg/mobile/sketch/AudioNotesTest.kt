package hu.vrg.mobile.sketch

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// F5 (WP M50, D-81): the dictation fallback: a sound note is a capture of kind audio, purpose hang, an .m4a.
class AudioNotesTest {
    private val room = Room("R1", listOf(Pt(0.0, 0.0), Pt(100.0, 0.0), Pt(100.0, 80.0), Pt(0.0, 80.0)), "Konyha")
    private val s0 = Sketch("A1", name = "Hang próba", rooms = listOf(room))

    @Test fun aSoundNoteIsACaptureOfKindAudio() {
        val (s, id) = AudioNotes.add(s0, AudioNotes.fileName(5L), "R1", 42_000, 300_000, 7L)
        val c = s.capture(id)!!
        assertEquals(CaptureKind.AUDIO, c.kind); assertEquals(AudioNotes.PURPOSE, c.purpose); assertEquals("hang_5.m4a", c.file)
        assertEquals(42_000, c.durationMs); assertEquals("R1", c.room)
        assertEquals("hang-proba_${id}_hang.m4a", Intake.exportName(s, c))
        assertEquals("0:42 · Konyha", AudioNotes.line(s, c))
        assertEquals(listOf(c), AudioNotes.list(s))
        // the file keeps it
        val back = SketchJson.read(SketchJson.write(s).toString())!!
        assertEquals(c, back.capture(id))
    }

    @Test fun itIsNoPhoto() {
        val (s, _) = AudioNotes.add(s0, "hang_1.m4a", null, 1000, 10, 1L)
        assertTrue(FieldKit.shots(Kit(), s, FieldKit.facts(Kit(), s)).none { it.have > 0 }, "fills no shot-list item")
        assertEquals("m4a", CaptureKind.ext(CaptureKind.AUDIO))
    }
}
