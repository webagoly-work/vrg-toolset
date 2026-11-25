package hu.vrg.mobile.sketch

// Type-plate and label reading (Kamera 2): the PURE half. The phone's text recogniser (feature-sketch → the
// sketch-vision module, ML Kit's bundled Latin model, on the device) turns a photo into plain text; this file reads
// that text the way an electrician reads a meter or a board: the meter's serial number and maker, the main fuse
// ("3×25 A"), breakers ("C16"), the FI-relé's trip current ("30 mA"), the supply ("3×230/400 V"), a meter's current
// ("5(60) A"). Each finding is an OcrHit; what it may fill (an answer of the questionnaire, or a line of the photo's
// note) is a PlateUse. The UI offers every use as a chip and applies one only when it is tapped: never silently.
//
// OCR text is noisy: × is read as x, X or *, 0 as O, 1 as l or I, a decimal comma or point, spaces inside numbers.
// The patterns allow for that; they are tested on the JVM (TypePlateTest) with label texts as ML Kit returns them.

object TypePlate {
    /** The kinds of finding. */
    object Kinds {
        const val METER_NO = "mero_szam"
        const val METER_MAKER = "mero_gyarto"
        const val MAIN = "aram"            // n × A, a main fuse or a multi-pole device
        const val BREAKER = "megszakito"   // a characteristic + current: B16, C 25
        const val RCD = "fi"               // trip current: 30 mA
        const val SUPPLY = "feszultseg"    // 230 V, 3×230/400 V
        const val METER_CURRENT = "mero_aram" // 5(60) A, 10-100 A
    }

    /** What a finding can fill: an answer ([q] + [opt], or [q] + "mas" + [text]) or a line in the photo's [note]. */
    data class PlateUse(val label: String, val q: String? = null, val opt: String? = null, val text: String = "", val note: String? = null)

    val MAKERS = listOf("Landis+Gyr", "Landis", "Iskra", "Elster", "Honeywell", "Itron", "Sanxing", "Kaifa", "ZPA", "Echelon",
        "Siemens", "Schneider", "Hager", "ABB", "Legrand", "Eaton", "Moeller", "Ganz", "Kamstrup", "EMH", "Holley", "Hexing")

    /** The text with OCR's usual slips undone where it matters: × forms between digits, letter-for-digit inside numbers. */
    fun clean(raw: String): String {
        var t = raw.replace(' ', ' ').replace('\t', ' ')
        t = t.replace(Regex("(?<=\\d)\\s*[xX×*]\\s*(?=\\d)"), "×")
        // O/o read inside a run of digits ("1O0" → "100"), l/I between digits
        t = t.replace(Regex("(?<=\\d)[Oo](?=\\d)"), "0").replace(Regex("(?<=\\d)[lI|](?=\\d)"), "1")
        return t
    }

    private val reMain = Regex("(?<![\\d.,])([1-4])\\s*×\\s*(\\d{1,3})\\s*A(?![a-zA-Z])")
    private val reSupply = Regex("(?:([13])\\s*×\\s*)?(230|400)(?:\\s*/\\s*(400))?\\s*V(?![a-zA-Z])")
    private val reBreaker = Regex("(?<![A-Za-z0-9])([BCDK])\\s?(\\d{1,3})(?:\\s*A)?(?![\\d.,A-Za-z])")
    private val reMa = Regex("(?<![\\d.,])(\\d{1,3})\\s*mA(?![a-zA-Z])")
    private val reIdn = Regex("(?:I\\s*[ΔAd∆]\\s*n|IΔN|IDn)\\s*[=:]?\\s*(0[.,]\\d{1,3})\\s*A", RegexOption.IGNORE_CASE)
    private val reMeterCur = Regex("(?<![\\d.,])(\\d{1,2})\\s*\\(\\s*(\\d{2,3})\\s*\\)\\s*A(?![a-zA-Z])")
    private val reSerialLabel = Regex(
        "(?:gy[áa]ri\\s*sz[áa]m|gy\\.?\\s*sz\\.?|sorsz[áa]m|azonos[íi]t[óo]|ser(?:ial)?\\.?\\s*no\\.?|s/n|no\\.|nr\\.?)\\s*[:#.]?\\s*([0-9][0-9 ]{5,17}[0-9])",
        RegexOption.IGNORE_CASE)
    private val reLongNumber = Regex("(?<![\\d.,/×])(\\d{8,14})(?![\\d.,/×])")

    /** Everything found in [raw], each kind+value once, in the order a reader cares about. */
    fun parse(raw: String): List<OcrHit> {
        val t = clean(raw)
        val out = LinkedHashMap<String, OcrHit>()
        fun add(kind: String, value: String, src: String) { val k = "$kind|$value"; if (k !in out) out[k] = OcrHit(kind, value, src.trim()) }

        // the meter's number: after its label first; else a bare long number (not a date, not a constant)
        val labelled = reSerialLabel.findAll(t).map { it.groupValues[1].replace(" ", "") to it.value }.filter { it.first.length in 6..16 }.toList()
        labelled.forEach { add(Kinds.METER_NO, it.first, it.second) }
        if (labelled.isEmpty()) reLongNumber.findAll(t).forEach { m ->
            val around = t.substring(maxOf(0, m.range.last + 1), minOf(t.length, m.range.last + 10)).lowercase()
            if (!around.trimStart().startsWith("imp") && !around.trimStart().startsWith("rev")) add(Kinds.METER_NO, m.groupValues[1], m.value)
        }
        val lower = t.lowercase()
        MAKERS.firstOrNull { lower.contains(it.lowercase()) }?.let { add(Kinds.METER_MAKER, it, it) }

        reMain.findAll(t).forEach { m -> add(Kinds.MAIN, "${m.groupValues[1]}×${m.groupValues[2].toInt()} A", m.value) }
        reMeterCur.findAll(t).forEach { m -> add(Kinds.METER_CURRENT, "${m.groupValues[1].toInt()}(${m.groupValues[2].toInt()}) A", m.value) }
        reBreaker.findAll(t).forEach { m ->
            val a = m.groupValues[2].toInt()
            if (a in STD_CURRENTS) add(Kinds.BREAKER, "${m.groupValues[1]}$a", m.value)
        }
        reMa.findAll(t).forEach { m -> val v = m.groupValues[1].toInt(); if (v in RCD_MA) add(Kinds.RCD, "$v mA", m.value) }
        reIdn.findAll(t).forEach { m ->
            val v = Math.round(m.groupValues[1].replace(',', '.').toDouble() * 1000).toInt()
            if (v in RCD_MA) add(Kinds.RCD, "$v mA", m.value)
        }
        reSupply.findAll(t).forEach { m ->
            val n = m.groupValues[1]; val v = m.groupValues[2]; val v2 = m.groupValues[3]
            val value = when {
                n == "3" || v2.isNotEmpty() || v == "400" -> "3×230/400 V"
                else -> "230 V"
            }
            add(Kinds.SUPPLY, value, m.value)
        }
        return out.values.toList()
    }

    /** The standard rated currents of breakers and fuses (a "C7" is a misread, not a breaker). */
    val STD_CURRENTS = setOf(1, 2, 3, 4, 6, 10, 13, 16, 20, 25, 32, 35, 40, 50, 63, 80, 100, 125)
    /** The standard trip currents of an RCD. */
    val RCD_MA = setOf(10, 30, 100, 300, 500)

    /** What [h] can fill. [shot] / [purpose] are the photo's: a C25 on a main-fuse photo is the main fuse. */
    fun uses(h: OcrHit, shot: String? = null, purpose: String? = null): List<PlateUse> = when (h.kind) {
        Kinds.METER_NO -> listOf(PlateUse("Mérő gyári szám: ${h.value}", note = "Mérő gyári szám: ${h.value}"))
        Kinds.METER_MAKER -> listOf(PlateUse("Gyártó: ${h.value}", note = "Gyártó: ${h.value}"))
        Kinds.METER_CURRENT -> listOf(PlateUse("Mérő: ${h.value}", note = "Mérő áram: ${h.value}"))
        Kinds.MAIN -> {
            val (n, a) = h.value.removeSuffix(" A").split('×').let { it[0].toInt() to it[1].toInt() }
            val opt = "${n}x$a"
            listOfNotNull(
                if (opt in MAIN_OPTS) PlateUse("Főbiztosíték ${h.value}", q = "fobizt", opt = opt)
                else PlateUse("Főbiztosíték ${h.value}", q = "fobizt", opt = "mas", text = h.value),
                when (n) { 1 -> PlateUse("1 fázis", q = "fazis", opt = "1f"); 3 -> PlateUse("3 fázis", q = "fazis", opt = "3f"); else -> null },
            )
        }
        Kinds.BREAKER -> listOfNotNull(
            PlateUse("Kismegszakító ${h.value}", note = "Kismegszakító: ${h.value}"),
            PlateUse("Biztosíték: kismegszakító", q = "biztositek", opt = "kismegszakito"),
            if (shot == "fobizt_tabla" || purpose == "merohely") PlateUse("Főbiztosíték ${h.value} (A)", q = "fobizt", opt = "mas", text = h.value) else null,
        )
        Kinds.RCD -> listOf(PlateUse("FI-relé ${h.value}", q = "fi", opt = "van"), PlateUse("FI ${h.value} a jegyzetbe", note = "FI-relé: ${h.value}"))
        Kinds.SUPPLY -> if (h.value.startsWith("3")) listOf(PlateUse("3 fázis (${h.value})", q = "fazis", opt = "3f")) else listOf(PlateUse(h.value, note = "Feszültség: ${h.value}"))
        else -> listOf(PlateUse(h.value, note = h.value))
    }

    private val MAIN_OPTS = setOf("1x25", "1x32", "3x16", "3x25")

    /** The reading of a photo stored on it (no undo-worthy change to anything else). */
    fun store(s: Sketch, id: String, text: String, now: Long): Sketch = Intake.editCapture(s, id) { c ->
        val old = c.ocr.associateBy { it.kind + "|" + it.value }
        c.copy(ocrAt = now, ocr = parse(text).map { h -> old[h.kind + "|" + h.value] ?: h })
    }

    /** Applies use [u] of hit [hit] of photo [id]: the answer through the questionnaire, or a line in the photo's note. */
    fun apply(kit: Kit, s: Sketch, id: String, hit: OcrHit, u: PlateUse, now: Long): Sketch {
        var o = s
        if (u.q != null && u.opt != null) {
            val q = kit.question(u.q)
            val opts = if (q?.multi == true) ((s.answers[u.q]?.options ?: emptyList()) + u.opt).distinct() else listOf(u.opt)
            o = Intake.answer(kit, o, u.q, opts, u.text, AnswerState.ANSWERED, now)
        }
        if (u.note != null) o = Intake.editCapture(o, id) { c ->
            if (c.note.lines().any { it.trim() == u.note }) c else c.copy(note = if (c.note.isBlank()) u.note else c.note.trimEnd() + "\n" + u.note)
        }
        return markHit(o, id, hit) { it.copy(used = true) }
    }

    /** Swipes a finding away (it stays on the photo, greyed, and is not offered again). */
    fun drop(s: Sketch, id: String, hit: OcrHit) = markHit(s, id, hit) { it.copy(dropped = true) }

    private fun markHit(s: Sketch, id: String, hit: OcrHit, f: (OcrHit) -> OcrHit) = Intake.editCapture(s, id) { c ->
        c.copy(ocr = c.ocr.map { if (it.kind == hit.kind && it.value == hit.value) f(it) else it })
    }

    /** The purposes and shot-list items whose photos are read without asking (the rest: on a tap of "Olvasás"). */
    val AUTO_PURPOSES = setOf("tabla")
    val AUTO_SHOTS = setOf("mero_tabla", "fobizt_tabla", "fi_tabla", "eloszto_felirat", "merohely_nyitott")
    fun readsByItself(c: Capture) = c.kind == CaptureKind.PHOTO && (c.purpose in AUTO_PURPOSES || c.shot in AUTO_SHOTS)
}
