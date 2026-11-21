package hu.vrg.mobile.sketch

// Kamera 2's features as switches (the Founder, 2026-11-21, D-62): every feature is built in and on by default, and
// each one, or all of them at once, can be switched off in ⚙ → Kamera funkciók. The phone stores only what is OFF,
// so a feature added later arrives switched on. A feature that needs another is off while the other is off.

object CameraFeatures {
    data class Feature(val id: String, val sym: String, val label: String, val blurb: String, val needs: String? = null)

    const val OCR = "ocr"
    const val OCR_AUTO = "ocr_auto"
    const val FACES = "faces"
    const val FACES_AUTO = "faces_auto"
    const val BLUR = "blur"
    const val PRIVACY = "privacy"
    const val GPS_STRIP = "gps_strip"
    const val PAIRS = "pairs"
    const val SIGNATURE = "signature"
    const val VIDEO = "video"
    const val QUICK = "quick"
    const val AGAIN = "again"

    val ALL = listOf(
        Feature(OCR, "▤", "Szöveg kiolvasása", "típustábla, címke: számok chipként"),
        Feature(OCR_AUTO, "▤", "Címkefotó magától", "a Típustábla és a címke-tételek fotója rögtön olvasva", needs = OCR),
        Feature(BLUR, "▦", "Elmosás", "▦ téglalap és ▒ ecset a jelölésben"),
        Feature(FACES, "☺", "Arckeresés", "elmosandó arcokat javasol", needs = BLUR),
        Feature(FACES_AUTO, "☺", "Arckeresés személyes fotón", "a 👤 jelölésre magától keres", needs = FACES),
        Feature(PRIVACY, "👤", "Személyes adat jelölés", "a fotó csak elmosva, GPS nélkül megy ki"),
        Feature(GPS_STRIP, "⌖", "GPS törlése kiadáskor", "a kiadott képekből a helyadat kikerül"),
        Feature(PAIRS, "◐", "Előtte / utána", "párok, csúszkás összevetés"),
        Feature(SIGNATURE, "✍", "Aláírás", "ügyfél aláírása nyilatkozattal"),
        Feature(VIDEO, "🎥", "Séta videó", "rövid videó a nyomvonalról"),
        Feature(QUICK, "◉", "Hiányzók elöl", "a ◉ tartásra előbb a hiányzó képek"),
        Feature(AGAIN, "＋", "„+ még” gomb", "fotó után ugyanaz még egyszer"),
    )

    fun of(id: String) = ALL.firstOrNull { it.id == id }

    /** Is [id] on, given the ids switched off? A feature whose prerequisite is off is off too. */
    fun on(off: Set<String>, id: String): Boolean {
        if (id in off) return false
        val f = of(id) ?: return true
        return f.needs == null || on(off, f.needs)
    }

    fun toggle(off: Set<String>, id: String): Set<String> = if (id in off) off - id else off + id

    /** All on (an empty set) or all off. */
    fun all(on: Boolean): Set<String> = if (on) emptySet() else ALL.map { it.id }.toSet()

    fun allOn(off: Set<String>) = ALL.none { it.id in off }

    /** The stored form: the ids that are off, comma separated; unknown ids are kept (a newer app's switches survive). */
    fun write(off: Set<String>) = off.sorted().joinToString(",")
    fun read(s: String?): Set<String> = s.orEmpty().split(',').map { it.trim() }.filter { it.isNotEmpty() }.toSet()

    // ---- faces → blur proposals -------------------------------------------------------------------------------------

    /** A face the finder saw, in 0..1 of the upright photo. */
    data class Box(val l: Double, val t: Double, val r: Double, val b: Double)

    /**
     * Blur rectangles for [faces]: each grown by [pad] of its size on every side (hair, ears), clipped to the photo;
     * a face already under one of [existing]'s blur rectangles is not proposed again.
     */
    fun proposals(faces: List<Box>, existing: List<Mark>, pad: Double = 0.2): List<Mark> {
        val blurred = existing.filter { it.kind == MarkKind.BLUR && it.pts.size >= 2 }.map { m ->
            val a = m.pts.first(); val c = m.pts.last()
            Box(minOf(a.x, c.x), minOf(a.y, c.y), maxOf(a.x, c.x), maxOf(a.y, c.y))
        }
        return faces.filter { it.r > it.l && it.b > it.t }.filter { f ->
            val cx = (f.l + f.r) / 2; val cy = (f.t + f.b) / 2
            blurred.none { cx in it.l..it.r && cy in it.t..it.b }
        }.map { f ->
            val w = f.r - f.l; val h = f.b - f.t
            Mark(MarkKind.BLUR, listOf(Pt((f.l - w * pad).coerceIn(0.0, 1.0), (f.t - h * pad).coerceIn(0.0, 1.0)),
                Pt((f.r + w * pad).coerceIn(0.0, 1.0), (f.b + h * pad).coerceIn(0.0, 1.0))), color = 0xFF404850)
        }
    }
}
