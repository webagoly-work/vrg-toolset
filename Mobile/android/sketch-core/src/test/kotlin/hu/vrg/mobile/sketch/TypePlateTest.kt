package hu.vrg.mobile.sketch

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// Type-plate reading: texts as an on-device recogniser returns them from Hungarian meters, main fuses, breakers and FI
// labels (line breaks, × read as x, O for 0), what is found, what it may fill, and that nothing is applied untapped.
class TypePlateTest {
    private val repo = File(System.getProperty("vrg.repo") ?: "../..")
    private val kit = FieldKit.parse(File(repo, "Sketcher/catalog/fieldkit.json").readText())
    private fun found(t: String) = TypePlate.parse(t).map { it.kind to it.value }

    @Test fun aMeterLabel() {
        val t = """Landis+Gyr
            E350 ZMF100
            3x230/400V 50Hz
            5(60)A  1000 imp/kWh
            Gyári szám: 7 1234 567
            2019"""
        val f = found(t)
        assertTrue(TypePlate.Kinds.METER_NO to "71234567" in f, f.toString())
        assertTrue(TypePlate.Kinds.METER_MAKER to "Landis+Gyr" in f)
        assertTrue(TypePlate.Kinds.SUPPLY to "3×230/400 V" in f)
        assertTrue(TypePlate.Kinds.METER_CURRENT to "5(60) A" in f)
        assertFalse(f.any { it.first == TypePlate.Kinds.METER_NO && it.second == "1000" })
    }

    @Test fun aBareMeterNumberButNotTheConstant() {
        val f = found("ISKRA ME162\n10000 imp/kWh\n38 551 207\n00012345678")
        assertTrue(TypePlate.Kinds.METER_NO to "00012345678" in f, f.toString())
        assertTrue(TypePlate.Kinds.METER_MAKER to "Iskra" in f)
        assertFalse(f.any { it.second == "10000" })
    }

    @Test fun mainFuseAndBreakers() {
        assertTrue(TypePlate.Kinds.MAIN to "3×25 A" in found("Főbiztosíték 3 x 25A"))
        assertTrue(TypePlate.Kinds.MAIN to "3×25 A" in found("3X25 A"))
        assertTrue(TypePlate.Kinds.MAIN to "1×32 A" in found("1*32A"))
        val b = found("ABB S203 C25  B16 400V~ 6000")
        assertTrue(TypePlate.Kinds.BREAKER to "C25" in b && TypePlate.Kinds.BREAKER to "B16" in b, b.toString())
        assertFalse(found("C7 B99 K2X").any { it.first == TypePlate.Kinds.BREAKER })     // not standard currents / part of a word
    }

    @Test fun anRcdLabel() {
        assertTrue(TypePlate.Kinds.RCD to "30 mA" in found("Hager CDA440D 40A 30mA Type AC"))
        assertTrue(TypePlate.Kinds.RCD to "30 mA" in found("In=40A IΔn=0,03A"))
        assertTrue(TypePlate.Kinds.RCD to "300 mA" in found("I∆n 0.3 A"))
        assertFalse(found("25 mA").any { it.first == TypePlate.Kinds.RCD })
    }

    @Test fun ocrSlipsAreUndone() {
        assertEquals("3×25A", TypePlate.clean("3x25A")); assertEquals("100", TypePlate.clean("1O0")); assertEquals("111", TypePlate.clean("1l1"))
    }

    @Test fun whatAFindingFills() {
        val main = TypePlate.uses(OcrHit(TypePlate.Kinds.MAIN, "3×25 A"))
        assertEquals(listOf("fobizt" to "3x25", "fazis" to "3f"), main.map { it.q to it.opt })
        val odd = TypePlate.uses(OcrHit(TypePlate.Kinds.MAIN, "3×40 A"))
        assertEquals("mas", odd.first().opt); assertEquals("3×40 A", odd.first().text)
        assertTrue(TypePlate.uses(OcrHit(TypePlate.Kinds.BREAKER, "C25"), shot = "fobizt_tabla").any { it.q == "fobizt" })
        assertFalse(TypePlate.uses(OcrHit(TypePlate.Kinds.BREAKER, "C25"), shot = "eloszto_felirat").any { it.q == "fobizt" })
        assertEquals("fi" to "van", TypePlate.uses(OcrHit(TypePlate.Kinds.RCD, "30 mA")).first().let { it.q to it.opt })
        assertTrue(TypePlate.uses(OcrHit(TypePlate.Kinds.METER_NO, "12345678")).single().note!!.contains("12345678"))
        // every option a use names exists in the catalog
        val all = listOf(OcrHit("aram", "1×25 A"), OcrHit("aram", "3×16 A"), OcrHit("megszakito", "B16"), OcrHit("fi", "30 mA"), OcrHit("feszultseg", "3×230/400 V"))
            .flatMap { TypePlate.uses(it, "fobizt_tabla") }.filter { it.q != null }
        all.forEach { u -> assertTrue(kit.question(u.q)!!.options.any { it.id == u.opt }, "${u.q}=${u.opt}") }
    }

    @Test fun nothingIsAppliedUntilTappedThenOnlyWhatWasTapped() {
        var s = Sketch("S1")
        val (s1, id) = Intake.addCapture(s, "a.jpg", "tabla", null, null, "fobizt_tabla", 1); s = s1
        s = TypePlate.store(s, id, "3x25A\nGy.sz.: 12345678", 2)
        val c = s.capture(id)!!
        assertEquals(2, c.ocrAt); assertTrue(c.ocr.size >= 2)
        assertTrue(s.answers.isEmpty()); assertEquals("", c.note)          // stored, nothing filled
        val main = c.ocr.first { it.kind == TypePlate.Kinds.MAIN }
        s = TypePlate.apply(kit, s, id, main, TypePlate.uses(main).first(), 3)
        assertEquals(listOf("3x25"), s.answers["fobizt"]!!.options); assertFalse("fazis" in s.answers)
        assertTrue(s.capture(id)!!.ocr.first { it.kind == TypePlate.Kinds.MAIN }.used)
        val no = c.ocr.first { it.kind == TypePlate.Kinds.METER_NO }
        val u = TypePlate.uses(no).single()
        s = TypePlate.apply(kit, s, id, no, u, 4); s = TypePlate.apply(kit, s, id, no, u, 5)
        assertEquals("Mérő gyári szám: 12345678", s.capture(id)!!.note)          // once, however often tapped
        // a re-read keeps what was used or dropped
        s = TypePlate.drop(s, id, no)
        s = TypePlate.store(s, id, "3x25A\nGy.sz.: 12345678", 6)
        assertTrue(s.capture(id)!!.ocr.first { it.kind == TypePlate.Kinds.METER_NO }.dropped)
        assertTrue(TypePlate.readsByItself(s.capture(id)!!))
        assertFalse(TypePlate.readsByItself(Capture("C9", "x.jpg", purpose = "hiba")))
    }
}
