package hu.vrg.mobile.sketch

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// The phone and the Desktop must show the same digital shadow. Sketcher/test/fixtures/shadow.json is written by the
// JS engine (Sketcher/tools/make-fixture.js); every case is replayed here through the Kotlin engine on the same
// catalog and variants. A difference means one of the two engines changed alone.
class FieldKitTest {
    private val repo = File(System.getProperty("vrg.repo") ?: "../..")
    private val kit = FieldKit.parse(File(repo, "Sketcher/catalog/fieldkit.json").readText())
    private val variants = File(repo, "Sketcher/variants").listFiles { f -> f.name.endsWith(".json") }!!
        .map { FieldKit.parseVariant(it.readText()) }.associateBy { it.id }
    private val fixture = JSONObject(File(repo, "Sketcher/test/fixtures/shadow.json").readText())

    private fun strs(a: JSONArray) = (0 until a.length()).map { a.get(it).toString() }
    private fun rows(a: JSONArray) = (0 until a.length()).map { i -> a.getJSONArray(i).let { r -> (0 until r.length()).map { r.get(it).toString() } } }

    @Test fun theCatalogAndVariantsParse() {
        assertTrue(kit.questions.size >= 40 && kit.shotlist.size >= 20 && kit.keywords.size >= 20)
        assertEquals(7, kit.fronts.size)
        assertTrue(variants.keys.containsAll(listOf("furdo-felujitas", "ev-tolto")))
        val v = variants["ev-tolto"]!!
        assertEquals(mapOf("ev" to 1, "merohely" to 1), v.scopePreset)
        assertTrue(kit.with(v).questions.any { it.id == "ev_kabelut" } && kit.with(v).questions.size == kit.questions.size + v.adds.questions.size)
    }

    @Test fun conditionsAgree() {
        val cs = fixture.getJSONArray("conds")
        for (i in 0 until cs.length()) {
            val c = cs.getJSONObject(i)
            val s = SketchJson.read(c.getJSONObject("sketch"))!!
            assertEquals(c.getBoolean("want"), FieldKit.facts(kit, s).eval(Cond.parse(c.opt("cond"))), c.opt("cond").toString())
        }
    }

    @Test fun everyCaseGivesTheSameShadow() {
        val cases = fixture.getJSONArray("cases")
        assertTrue(cases.length() >= 9)
        for (i in 0 until cases.length()) {
            val c = cases.getJSONObject(i)
            val name = c.getString("name")
            val s = SketchJson.read(c.getJSONObject("sketch"))!!
            val now = c.getLong("now")
            val k = if (c.isNull("variant")) kit else kit.with(variants[c.getString("variant")])
            val e = c.getJSONObject("expect")
            val f = FieldKit.facts(k, s)

            val ef = e.getJSONObject("facts")
            assertEquals(strs(ef.getJSONArray("scope")), f.scope.sorted(), "$name: scope")
            assertEquals(strs(ef.getJSONArray("kw")), f.kw.sorted(), "$name: kw")
            assertEquals(strs(ef.getJSONArray("rooms")), f.rooms.sorted(), "$name: rooms")
            assertEquals(strs(ef.getJSONArray("points")), f.points.sorted(), "$name: points")
            assertEquals(strs(ef.getJSONArray("chips")), f.chips.sorted(), "$name: chips")
            assertEquals(strs(ef.getJSONArray("photos")), f.photos.sorted(), "$name: photos")
            assertEquals(ef.getBoolean("site"), f.site, "$name: site")
            val ea = ef.getJSONObject("answers")
            assertEquals(ea.keys().asSequence().toSortedSet().toList(), f.answers.keys.sorted(), "$name: answers")

            assertEquals(rows(e.getJSONArray("questions")),
                FieldKit.questions(k, s, f, now).map { listOf(it.q.id, it.fresh.toString(), it.done.toString(), it.later.toString()) }, "$name: questions")
            assertEquals(strs(e.getJSONArray("unseen")), FieldKit.unseen(k, s, f), "$name: unseen")
            val sug = FieldKit.suggestions(k, s)
            assertEquals(rows(e.getJSONArray("suggestions")), sug.map { listOf(it.id, it.effect.text ?: "", it.source ?: "") }, "$name: suggestions")
            assertEquals(rows(e.getJSONArray("shots")), FieldKit.shots(k, s, f).map { listOf(it.item.id, it.have.toString(), it.done.toString()) }, "$name: shots")
            assertEquals(strs(e.getJSONArray("open")), FieldKit.open(k, s, null, f).map { it.front + "|" + it.kind + "|" + it.ref + "|" + it.label }, "$name: open")

            var after = s
            sug.forEach { after = FieldKit.apply(k, it.effect, after, now) }
            val sc = e.getJSONObject("afterScope")
            assertEquals(sc.keys().asSequence().associateWith { sc.getInt(it) }.toSortedMap(), after.scope.toSortedMap(), "$name: scope after the suggestions")
            val an = e.getJSONObject("afterAnswers")
            assertEquals(an.keys().asSequence().associateWith { q -> an.getJSONArray(q).let { listOf(strs(it.getJSONArray(0)).toString(), it.getString(1)) } }.toSortedMap(),
                after.answers.mapValues { listOf(it.value.options.sorted().toString(), it.value.text) }.toSortedMap(), "$name: answers after the suggestions")
        }
    }

    @Test fun intakeRecordsStandAloneAndRoundTrip() {
        var s = Sketch("S", "Kossuth u. 12")
        val (s1, e) = Intake.addEntry(s, "  a nappaliban égett szag  ", listOf("problema", "problema"), "R9", null, true, true, 5)!!; s = s1
        assertEquals(listOf("problema"), s.entry(e)!!.chips, "a chip once"); assertEquals("R9", s.entry(e)!!.room, "a room that does not exist yet is fine")
        assertEquals(null, Intake.addEntry(s, "  ", emptyList(), null, null, false, false, 6))
        s = Intake.answer(kit, s, "lenyeg", listOf("csere", "bovites"), "konyha is", AnswerState.ANSWERED, 7)
        assertEquals(setOf("felujitas", "bovites"), s.scope.keys, "an option's effect adds the scope")
        s = Intake.setScope(s, "dugalj", 4)
        val (s2, c) = Intake.addCapture(s, "x.jpg", "merohely", null, null, "merohely_zart", 8, 47.5, 19.04); s = s2
        s = Intake.editCapture(s, c) { it.copy(marks = listOf(Mark(MarkKind.ARROW, listOf(Pt(0.1, 0.2), Pt(0.5, 0.5)), color = 0xFFD64545))) }
        s = Intake.setSite(s) { it.copy(address = "Kossuth u. 12", lat = 47.1, lon = 19.2, source = "gps", footprint = Footprint(12.4, 9.8, 121.5, 17.0, "osm", 9)) }
        s = Intake.markSeen(Intake.dismiss(s, "kw:x"), listOf("lenyeg", "kor"), 10).copy(variant = "ev-tolto", variantOn = true, draft = "még a garázs")
        val back = SketchJson.read(SketchJson.write(s).toString())!!
        assertEquals(s, back)
        assertEquals("kossuth-u-12_${c}_merohely.jpg", Intake.exportName(s, s.capture(c)!!))
        val v1 = SketchJson.write(Sketch("old")).put("v", 1)
        listOf("entries", "scope", "answers", "captures", "seen", "dismissed").forEach { v1.remove(it) }
        assertEquals(Sketch("old"), SketchJson.read(v1), "a v1 file opens with an empty intake")
    }

    @Test fun aVariantRequestCarriesTheShapeNotTheClient() {
        var s = Sketch("S", "Kovács Béla, Petőfi u. 3")
        s = Ops.addRectRoom(s, Pt(0.0, 0.0), Pt(100.0, 80.0), 4.0)!!.first
        s = Ops.toggleKind(s, s.rooms[0].id, "furdo")
        s = Intake.addEntry(s, "a tulaj Kovács Béla, telefonszáma …", emptyList(), null, null, false, false, 1)!!.first
        s = Intake.setSite(s) { it.copy(address = "Petőfi u. 3") }
        val o = VariantRequests.build(s, kit, " Fürdők felújítása panelházban. ", listOf("furdo", "felujitas"), listOf("x_C1_hely.jpg"), 5)
        val text = o.toString()
        assertTrue("Kovács" !in text && "Petőfi" !in text && "telefon" !in text, text)
        assertEquals("Fürdők felújítása panelházban.", o.getString("premise"))
        assertEquals(listOf("Fürdő", "Felújítás, csere"), (0 until 2).map { o.getJSONArray("topicLabels").getString(it) })
        assertEquals(1, o.getJSONObject("from").getInt("rooms")); assertEquals("furdo", o.getJSONObject("from").getJSONArray("kinds").getString(0))
        assertTrue(VariantRequests.prompt("Fürdők.", "variant-request-1.json").startsWith("GO VARIANT — variant-request-1.json"))
    }
}
