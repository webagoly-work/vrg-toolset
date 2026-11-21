package hu.vrg.mobile.sketch

// Kamera 2 (the camera's second round, docs/research/2026-11-18_field-survey-camera-notes.md "later" items): the pure
// rules behind before / after pairs, privacy on export, the walk video, the client's signature and the faster
// purpose switching. The screens are feature-sketch (CameraFront.kt, Camera2Ui.kt); the decisions are D-numbers in
// docs/mobile/DECISIONS.md.

object Camera2 {
    const val BEFORE = "elotte"
    const val AFTER = "utana"

    // ---- before / after -------------------------------------------------------------------------------------------

    /**
     * The photos an after-photo [c] can be paired with: earlier photos of the same purpose, the same room first (then
     * the same shot-list item, then the newest). Videos and signatures never pair.
     */
    fun beforeCandidates(s: Sketch, c: Capture): List<Capture> = s.captures
        .filter { it.id != c.id && it.kind == CaptureKind.PHOTO && it.purpose == c.purpose && it.at <= c.at && it.phase != AFTER }
        .sortedWith(compareBy<Capture>({ if (c.room != null && it.room == c.room) 0 else 1 }, { if (c.shot != null && it.shot == c.shot) 0 else 1 }, { -it.at }))

    /** Pairs [after] with [before]: before → "elotte", after → "utana" naming it. A before keeps one after at a time. */
    fun pair(s: Sketch, afterId: String, beforeId: String): Sketch {
        if (afterId == beforeId || s.capture(afterId) == null || s.capture(beforeId) == null) return s
        return s.copy(captures = s.captures.map {
            when {
                it.id == afterId -> it.copy(phase = AFTER, pair = beforeId)
                it.id == beforeId -> it.copy(phase = BEFORE, pair = null)
                it.pair == beforeId -> it.copy(phase = null, pair = null)     // the old after of this before
                else -> it
            }
        })
    }

    /** Undoes the pair [id] is in (either side). */
    fun unpair(s: Sketch, id: String): Sketch {
        val c = s.capture(id) ?: return s
        val other = if (c.phase == AFTER) c.pair else s.captures.firstOrNull { it.pair == id }?.id
        return s.copy(captures = s.captures.map { if (it.id == id || it.id == other) it.copy(phase = null, pair = null) else it })
    }

    /** Marks [id] as a before-photo waiting for its after. */
    fun markBefore(s: Sketch, id: String) = Intake.editCapture(s, id) { if (it.phase == AFTER) it else it.copy(phase = BEFORE) }

    /** Every pair, before → after. */
    fun pairs(s: Sketch): List<Pair<Capture, Capture>> =
        s.captures.filter { it.phase == AFTER && it.pair != null }.mapNotNull { a -> s.capture(a.pair)?.let { it to a } }

    /** The after-photo of [beforeId], if there is one. */
    fun afterOf(s: Sketch, beforeId: String) = s.captures.firstOrNull { it.phase == AFTER && it.pair == beforeId }

    /** Before-photos with no after yet: the "Utána" waiting list. */
    fun waiting(s: Sketch) = s.captures.filter { it.phase == BEFORE && afterOf(s, it.id) == null }

    // ---- privacy on export ----------------------------------------------------------------------------------------

    /** What leaves the phone for one capture. */
    data class ExportPlan(
        /** The main file is a re-encoded copy with the blur burned in (the original never leaves the phone). */
        val burnBlur: Boolean,
        /** A second copy with the markup burned in (…_jel.jpg), blur included. */
        val marked: Boolean,
        /** The position is written into the exported copy's EXIF (otherwise it is removed). */
        val gps: Boolean,
    )

    /**
     * D-57: GPS is stripped from every exported copy unless the user keeps it on that photo; a "személyes adat" photo
     * never keeps it. A photo with blur leaves the phone only blurred. A plain photo without marks or blur is copied
     * as it is (and its GPS tag removed in place on the copy).
     */
    fun exportPlan(c: Capture, stripGps: Boolean = true): ExportPlan {
        val blur = c.marks.any { it.kind.blur }
        val other = c.marks.any { !it.kind.blur }
        // [stripGps] = the "GPS törlése kiadáskor" switch (CameraFeatures, D-62); a personal photo loses it regardless
        return ExportPlan(burnBlur = blur && c.kind == CaptureKind.PHOTO, marked = other && c.kind == CaptureKind.PHOTO,
            gps = (c.keepGps || !stripGps) && !c.privacy && c.kind == CaptureKind.PHOTO)
    }

    /** Personal-data photos with nothing blurred yet: a loose end before the package goes. */
    fun privacyOpen(s: Sketch) = s.captures.filter { it.privacy && it.kind == CaptureKind.PHOTO && it.marks.none { m -> m.kind.blur } }

    // ---- the walk video ---------------------------------------------------------------------------------------------

    /** The camera app is asked to stop here (most honour it; D-60). */
    const val VIDEO_MAX_S = 90
    /** Over this the video is flagged: slow to send, heavy on the PC board. */
    const val VIDEO_WARN_BYTES = 80L * 1024 * 1024
    /** The camera app is asked to stop at this size (EXTRA_SIZE_LIMIT). */
    const val VIDEO_LIMIT_BYTES = 150L * 1024 * 1024

    fun addVideo(s: Sketch, file: String, purpose: String, room: String?, shot: String?, durationMs: Long, bytes: Long, now: Long): Pair<Sketch, String> {
        val (s1, id) = Intake.addCapture(s, file, purpose, room, null, shot, now)
        return Intake.editCapture(s1, id) { it.copy(kind = CaptureKind.VIDEO, durationMs = durationMs, bytes = bytes) } to id
    }

    fun videoWarning(c: Capture): String? = when {
        c.kind != CaptureKind.VIDEO -> null
        c.bytes > VIDEO_WARN_BYTES -> "Nagy videó (${mb(c.bytes)}): lassú küldés. Rövidebb séta ajánlott."
        c.durationMs > VIDEO_MAX_S * 1000L + 5000 -> "Hosszú videó (${duration(c.durationMs)})."
        else -> null
    }

    fun mb(bytes: Long) = if (bytes <= 0) "?" else "%.1f MB".format(java.util.Locale.ROOT, bytes / 1048576.0).replace('.', ',')
    fun duration(ms: Long): String { val t = (ms + 500) / 1000; return "%d:%02d".format(t / 60, t % 60) }

    // ---- the client's signature ------------------------------------------------------------------------------------

    /** The statements a signature can stand under (the first is the default). */
    val STATEMENTS = listOf(
        "A felmérést átvettem, a rögzített adatok a helyszínen elhangzottaknak megfelelnek.",
        "Hozzájárulok, hogy a felmérés során az ingatlanról fotók készüljenek, és azokat az ajánlat elkészítéséhez felhasználják.",
        "A felmérést átvettem, és hozzájárulok a fotózáshoz.",
    )

    /** A signature: a capture of purpose "dokumentum", kind "signature", the statement as its note, the signer, the time. */
    fun addSignature(s: Sketch, file: String, signer: String, statement: String, now: Long): Pair<Sketch, String> {
        val (s1, id) = Intake.addCapture(s, file, "dokumentum", null, null, null, now)
        return Intake.editCapture(s1, id) { it.copy(kind = CaptureKind.SIGNATURE, signer = signer.trim(), note = statement.trim()) } to id
    }

    fun signatures(s: Sketch) = s.captures.filter { it.kind == CaptureKind.SIGNATURE }

    /** Has the client consented to photos (a signature under a statement mentioning it)? */
    fun photoConsent(s: Sketch) = signatures(s).any { FieldKit.fold(it.note).contains("fot") }

    // ---- faster purpose switching -----------------------------------------------------------------------------------

    /** The ◉ hold menu's first row: the shot list's next missing items (room items go to Fotópont, so they are left out). */
    fun nextMissing(kit: Kit, s: Sketch, n: Int = 4): List<FieldKit.ShotState> =
        FieldKit.shots(kit, s).filter { !it.done && it.item.room == null }.take(n)

    /** The purposes ordered for the hold menu: the recently used first (up to three), then the catalog's order. */
    fun recentPurposes(kit: Kit, s: Sketch, n: Int = 3): List<String> =
        s.captures.filter { it.kind == CaptureKind.PHOTO }.sortedByDescending { it.at }.map { it.purpose }.distinct()
            .filter { kit.purpose(it) != null }.take(n)
}
