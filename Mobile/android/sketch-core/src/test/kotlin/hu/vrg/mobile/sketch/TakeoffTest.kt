package hu.vrg.mobile.sketch

import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// The phone and the Desktop must give the same takeoff (Munkakör lap). Sketcher/test/fixtures/takeoff.json is written by
// the JS engine (Sketcher/tools/make-takeoff-fixture.js); every case is replayed here through Takeoff.kt on the same
// catalog, rules and variants: the document must be equal value by value and the summary character by character.
class TakeoffTest {
    private val repo = File(System.getProperty("vrg.repo") ?: "../..")
    private val kit = FieldKit.parse(File(repo, "Sketcher/catalog/fieldkit.json").readText())
    private val rules = TakeoffRules.parse(File(repo, "Sketcher/catalog/takeoff.json").readText())
    private val variants = File(repo, "Sketcher/variants").listFiles { f -> f.name.endsWith(".json") }!!
        .map { FieldKit.parseVariant(it.readText()) }.associateBy { it.id }
    private val fixture = JSONObject(File(repo, "Sketcher/test/fixtures/takeoff.json").readText())

    /** JSON as plain values: maps sorted by key, every number a Double, so 12 and 12.0 are the same. */
    private fun canon(v: Any?): Any? = when (v) {
        null, JSONObject.NULL -> null
        is JSONObject -> v.keys().asSequence().sorted().associateWith { canon(v.opt(it)) }
        is JSONArray -> (0 until v.length()).map { canon(v.opt(it)) }
        is Number -> v.toDouble()
        else -> v
    }

    private fun input(o: JSONObject): Pair<Sketch, PlanView?> =
        if (o.optString("kind") == "vrg-sketch") SketchJson.read(o.getJSONObject("sketch"))!! to PlanView.fromPackage(o)
        else SketchJson.read(o)!! to null

    @Test fun everyFixtureCaseGivesTheSameTakeoffAndSummary() {
        val cases = fixture.getJSONArray("cases")
        assertTrue(cases.length() >= 7)
        for (i in 0 until cases.length()) {
            val c = cases.getJSONObject(i)
            val (s, plan) = input(c.getJSONObject("input"))
            val k = if (s.variantOn) kit.with(variants[s.variant]) else kit
            val o = c.getJSONObject("opts")
            val r = Takeoff.build(k, rules, s, plan, fixture.getLong("now"),
                if (o.has("endReserveMm")) o.getInt("endReserveMm") else null, if (o.has("looseEndMm")) o.getInt("looseEndMm") else null,
                if (o.has("impliedDedicated")) o.getBoolean("impliedDedicated") else null)
            val name = c.getString("name")
            val want = canon(c.getJSONObject("expect")) as Map<*, *>
            val got = canon(r.json) as Map<*, *>
            for (key in want.keys) assertEquals(want[key], got[key], "$name: $key")
            assertEquals(want.keys, got.keys, name)
            assertEquals(c.getString("markdown"), Takeoff.markdown(r.json), "$name: summary")
        }
    }

    @Test fun thePhonesSolveGivesThePlanThePackageCarries() {
        // the phone builds the takeoff from its own solve; the Desktop and the CLI from the package it exported
        val pkg = JSONObject(File(repo, "Planner/projects/varler-planner/tests/sketch-field.json").readText())
        val s = SketchJson.read(pkg.getJSONObject("sketch"))!!
        val mine = PlanView.of(s, Solver().solve(s))
        val theirs = PlanView.fromPackage(pkg)!!
        assertEquals(theirs, mine)
        val a = Takeoff.build(kit, rules, s, mine, 1L).json; val b = Takeoff.build(kit, rules, s, theirs, 1L).json
        assertEquals(canon(b), canon(a))
    }

    @Test fun theRulesHeightsAreTheExportsHeights() {
        // the raw plan (no solve) uses the rules' heights: they must be the ones PlannerExport gives the Planner
        for (t in PointType.entries) {
            val r = rules.point(t.id)
            assertEquals(r.id, t.id, "rules for ${t.id}")
            assertEquals(PlannerExport.height(t, true, Level.GROUND), r.h, "${t.id} on a wall")
            assertEquals(PlannerExport.height(t, false, Level.UPPER), if (r.ceiling) Level.UPPER.heightMm else r.h, "${t.id} in the open")
        }
        Level.entries.forEach { assertEquals(it.heightMm, rules.levelH(it.id)) }
    }

    @Test fun quantitiesFollowTheSurvey() {
        val s0 = Sketch("X", points = listOf(
            SketchPoint("P1", Pt(0.0, 0.0), PointType.SOCKET, PointState.PLANNED),
            SketchPoint("P2", Pt(10.0, 0.0), PointType.SOCKET, PointState.EXISTING),
            SketchPoint("P3", Pt(20.0, 0.0), PointType.SOCKET, PointState.EXISTING),
            SketchPoint("P5", Pt(30.0, 0.0), PointType.SOCKET, PointState.EXISTING)),
            tagUses = listOf(TagUse("U4", "T-bontas", "P3"), TagUse("U6", "T-csere", "P5")))
        val t0 = Takeoff.build(kit, rules, s0, null, 1L)
        // the built-in Csere tag (D-77) makes an existing point a replacement
        assertEquals(listOf("pont.socket.uj", "pont.socket.csere", "pont.socket.bontas", "pont.socket.marad"), t0.items.map { it.id })
        assertTrue(t0.items.none { it.est }, "drawn, nothing wanted: no guess")
        // the client wants four: the drawn one is not enough, the rest is a guess until drawn
        val s1 = Intake.setScope(s0, "dugalj", 4)
        val uj = Takeoff.build(kit, rules, s1, null, 1L).items.first { it.id == "pont.socket.uj" }
        assertEquals(4.0, uj.qty); assertTrue(uj.est); assertEquals("Munkakör: 4, vázlat: 1", uj.note)
        // a dedicated machine implies a dedicated circuit only with the toggle on (D-79); off, it is a check line
        val s2 = Intake.setScope(Intake.setScope(s1, "konyha", 1), "fozolap", 1)
        val off = Takeoff.build(kit, rules, s2, null, 1L)
        assertTrue(off.items.none { it.id == "aramkor.dedikalt" })
        assertEquals(listOf("A gépek, rendszerek szerint 1 dedikált kör kellhet, a vázlaton 0 van"), off.checks)
        val t2 = Takeoff.build(kit, rules, s2, null, 1L, impliedDedicated = true)
        val ded = t2.items.first { it.id == "aramkor.dedikalt" }
        assertEquals(1.0, ded.qty); assertTrue(ded.est && "fozolap_tipus" in ded.open)
        assertTrue(t2.decisions.any { it.q == "fozolap_tipus" && "gep.fozolap" in it.affects })
        // answered, the decision goes
        val s3 = Intake.answer(kit, s2, "fozolap_tipus", listOf("indukcio"), "", AnswerState.ANSWERED, 2L)
        assertTrue(Takeoff.build(kit, rules, s3, null, 3L).decisions.none { it.q == "fozolap_tipus" })
    }

    @Test fun anOldSurveyWithoutIntakeStillGivesATakeoff() {
        val v1 = JSONObject(SketchJson.write(Sketch("OLD", name = "Régi")).toString()).put("v", 1)
        listOf("entries", "scope", "answers", "captures", "dismissed", "seen").forEach { v1.remove(it) }
        val s = SketchJson.read(v1)!!
        val r = Takeoff.build(kit, rules, s, null, 1L)
        assertEquals(0, r.items.size)
        assertTrue(Takeoff.markdown(r.json).contains("Még nincs tétel."))
    }
}
