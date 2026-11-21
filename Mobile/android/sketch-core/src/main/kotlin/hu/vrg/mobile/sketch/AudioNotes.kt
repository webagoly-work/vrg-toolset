package hu.vrg.mobile.sketch

// F5 (WP M50, D-84): the dictation fallback. A phone with no speech recogniser (no Google app, a de-Googled ROM) can
// still keep what the client said: a short sound recording (MediaRecorder, AAC in .m4a), a capture of kind "audio",
// purpose "hang" (not a photo purpose: it fills no shot-list item, the takeoff does not count it as a photo). Played
// back in the viewer, exported with the package as <stem>_<id>_hang.m4a, listed on the Desktop page and in the report.
// The recording itself is the phone's (feature-sketch AudioNoteUi.kt); this file is the record and its rules.
object AudioNotes {
    const val PURPOSE = "hang"
    /** The longest note; the recorder stops itself there (a note, not a meeting). */
    const val MAX_MS = 180_000L

    fun add(s: Sketch, file: String, room: String?, durationMs: Long, bytes: Long, now: Long): Pair<Sketch, String> {
        val (s1, id) = Intake.addCapture(s, file, PURPOSE, room, null, null, now)
        return Intake.editCapture(s1, id) { it.copy(kind = CaptureKind.AUDIO, durationMs = durationMs.coerceAtLeast(0), bytes = bytes.coerceAtLeast(0)) } to id
    }

    fun list(s: Sketch) = s.captures.filter { it.kind == CaptureKind.AUDIO }

    /** The phone's own file name for a new recording. */
    fun fileName(now: Long) = "hang_$now.m4a"

    /** One line for the list: "0:42 · Konyha · a csempe alatt?" */
    fun line(s: Sketch, c: Capture): String = listOfNotNull(Camera2.duration(c.durationMs),
        s.room(c.room)?.let { r -> r.name.ifBlank { RoomKinds.autoName(r.kinds) } }?.takeIf { it.isNotBlank() },
        c.note.takeIf { it.isNotBlank() }).joinToString(" · ")
}
