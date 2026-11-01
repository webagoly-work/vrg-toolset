package hu.vrg.mobile.core

import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import java.io.File
import java.util.Base64
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SphereTest {
    private val json = """{"generated":"2026-11-01","commit":"abc1234",
      "sections":[{"id":"a","n":"Alfa","docs":3,"reviewed":"2026-11-01","summary":"kész"},
                  {"id":"b","n":"Béta","docs":2,"reviewed":null,"summary":null},
                  {"id":"c","n":"Céta","docs":1,"reviewed":null,"summary":null}],
      "docs":[{"p":"a/1.md","s":"a","t":"Egy","d":"2026-10-01","i":4},{"p":"b/1.md","s":"b","t":"Kettő","d":"2026-10-02","i":0},
              {"p":"a/2.md","s":"a","t":"Három","d":"2026-10-30","i":1},{"p":"a/3.md","s":"a","t":"Négy","d":"2026-10-04","i":0},
              {"p":"b/2.md","s":"b","t":"Öt","d":"2026-10-05","i":0},{"p":"c/1.md","s":"c","t":"Hat","d":"2026-10-06","i":0}],
      "signals":[
        {"id":"c1","type":"contradiction","stage":"confirmed","sec":"a","title":"41 W vagy 42 W?","by":"caleb",
         "a":{"p":"a/1.md","line":97,"text":"41 W"},"b":{"p":"b/1.md","line":232,"text":"42 W"},"ai":0,"bi":1},
        {"id":"c2","type":"contradiction","stage":"candidate","sec":"a","title":"1400 vagy 1450?",
         "a":{"p":"a/2.md","line":1,"text":"x"},"b":{"p":"a/3.md","line":2,"text":"y"},"ai":2,"bi":3},
        {"id":"c3","type":"contradiction","stage":"dismissed","sec":"a","title":"elvetve","note":"Rossz egyezés",
         "a":{"p":"a/2.md","line":3,"text":"z"},"ai":2},
        {"id":"d1","type":"dark","kind":"kérdés","stage":"candidate","sec":"b","title":"Nyitott kérdés",
         "a":{"p":"b/2.md","line":9,"text":"q"},"ai":4},
        {"id":"f1","type":"frozen","kind":"alvó","sec":"c","title":"60 napja","a":{"p":"c/1.md","line":1,"text":"t"},"age":60,"keystone":true,"ai":5},
        {"id":"v1","type":"dark","kind":"ellenőrzés","sec":"b","title":"Hibás ellenőrzés","a":{"p":"tools/x.js","line":1,"text":"hiba"}},
        {"id":"u1","type":"újfajta","sec":"a","title":"későbbi verzió jele"}
      ]}"""

    private val map = assertNotNull(Sphere.parse(json, null))

    private fun assertNear(want: Vec, got: Vec) {
        assertTrue(abs(want.x - got.x) < 1e-9 && abs(want.y - got.y) < 1e-9 && abs(want.z - got.z) < 1e-9, "want $want, got $got")
    }

    /** The numbers come from running the placement code of Solomon/src/index.html on this same file. */
    @Test fun aDotSitsWhereTheWebPagePutsIt() {
        assertNear(Vec(0.566785732050, 0.363636363636, 0.739271620574), Sphere.fib(3, 11))
        val want = listOf(
            Vec(0.729107808777, 0.652133849340, 0.207661372734),
            Vec(-0.868592619479, 0.000000000000, 0.495526852336),
            Vec(0.854974542521, 0.451955131530, -0.254470215791),
            Vec(0.388551119987, 0.920664144100, 0.037490811219),
            Vec(-0.504012480253, -0.247139139951, 0.827583026199),
            Vec(0.313831362701, -0.645198271799, -0.696583854143),
        )
        want.forEachIndexed { i, v -> assertNear(v, map.docs[i].pos) }
    }

    @Test fun readsTheFile() {
        assertEquals("2026-11-01", map.generated)
        assertEquals(listOf("Alfa", "Béta", "Céta"), map.sections.map { it.name })
        assertEquals("kész", map.sections[0].summary)
        assertNull(map.sections[1].reviewed)
        assertEquals(6, map.signals.size, "an unknown signal type is skipped")
        assertEquals("a/1.md:97", map.signals[0].a?.ref)
        assertEquals("Rossz egyezés", map.signals[2].note)
        assertTrue(map.docs[2].recent)
        assertFalse(map.docs[0].recent)
    }

    @Test fun theRepositorysOwnFileReads() {
        val file = File("../../../Solomon/data/signals.json")
        if (!file.exists()) return
        val real = assertNotNull(Sphere.parse(file.readText(), null))
        assertEquals(JSONObject(file.readText()).getJSONArray("docs").length(), real.docs.size)
        assertTrue(real.signals.isNotEmpty())
    }

    @Test fun aBrokenFileIsNoMap() {
        assertNull(Sphere.parse("{nem json", null))
        assertNull(Sphere.parse("""{"generated":"2026-11-01"}""", null))
    }

    @Test fun theDotShowsItsStrongestOpenSignal() {
        assertEquals(listOf(4, 4, 3, 3, 2, 1), map.docs.map { it.rank })
    }

    @Test fun aDismissedOrRuledSignalNoLongerCounts() {
        assertEquals(2, map.count(SignalType.CONTRADICTION))
        assertEquals(2, map.count(SignalType.DARK))
        assertEquals(1, map.count(SignalType.FROZEN))
        assertEquals(2, map.openIn("a"))
        assertEquals(listOf("c1", "c2"), map.arcs.map { it.id })
    }

    @Test fun onlyAConfirmedClashCanBeRuled() {
        assertEquals(listOf("c1"), map.signals.filter { it.rulable }.map { it.id })
    }

    @Test fun listsPutTheFoundersWorkFirst() {
        assertEquals(listOf("c1", "c2", "d1", "v1", "f1", "c3"), map.sorted(null).map { it.id })
        assertEquals(listOf("f1"), map.sorted(SignalType.FROZEN).map { it.id })
    }

    @Test fun aTagReadsLikeThePage() {
        assertEquals("Dermedt · alvó · sokan hivatkoznak rá", map.signals[4].tag)
        assertEquals("Ellentmondás · megerősítve", map.signals[0].tag)
    }

    @Test fun aLayerDimsDocumentsWithoutThatSignal() {
        assertTrue(map.docs[0].shows(null))
        assertTrue(map.docs[0].shows(SignalType.CONTRADICTION))
        assertFalse(map.docs[0].shows(SignalType.FROZEN))
    }

    @Test fun focusBringsADotToTheMiddle() {
        for (d in map.docs) {
            val (yaw, pitch) = Sphere.focus(d.pos)
            val at = Turn(yaw, pitch).see(d.pos) { x, y, z -> Vec(x, y, z) }
            assertNear(Vec(0.0, 0.0, 1.0), at)
        }
    }

    @Test fun projectionMatchesThePage() {
        // project() of the page at its starting yaw .6, pitch -.25, for a unit vector along x
        val at = Turn(.6, -.25).see(Vec(1.0, 0.0, 0.0)) { x, y, z -> Vec(x, y, z) }
        assertNear(Vec(0.8253356149096783, -0.13969478348119838, -0.547089106297872), at)
    }

    @Test fun aDragCannotFlipTheSphere() {
        assertEquals(1.3, Sphere.pitched(1.25, .2))
        assertEquals(-1.3, Sphere.pitched(-1.25, -.2))
    }

    @Test fun aRulingOnTheBranchCountsBeforeTheNextScan() {
        val line = Rulings.line("c1", RuleHow.COEXIST, "  mindkettő igaz  ", "2026-11-02")
        val m = assertNotNull(Sphere.parse(json, line + "\n"))
        val s = m.signals[0]
        assertEquals(Ruling("coexist", "mindkettő igaz", "2026-11-02"), s.ruling)
        assertFalse(s.open)
        assertFalse(s.rulable)
        assertEquals(listOf("c2"), m.arcs.map { it.id })
        assertEquals(0, m.docs[0].rank)
    }

    @Test fun theLastRulingWinsAndABadLineIsSkipped() {
        val text = Rulings.line("c1", RuleHow.FIRST, "a", "2026-11-02") + "\nnem json\n" + Rulings.line("c1", RuleHow.SECOND, "b", "2026-11-03") + "\n"
        assertEquals(Ruling("second", "b", "2026-11-03"), Rulings.parse(text)["c1"])
        assertTrue(Rulings.parse(null).isEmpty())
    }

    @Test fun aRulingLineIsWhatThePcReads() {
        val o = JSONObject(Rulings.line("c1", RuleHow.FIRST, "ok", "2026-11-02"))
        assertEquals("c1", o.getString("id")); assertEquals("first", o.getString("how"))
        assertEquals("ok", o.getString("why")); assertEquals("2026-11-02", o.getString("date"))
    }

    @Test fun appendKeepsOneLinePerRuling() {
        assertEquals("x\n", Rulings.append("", "x"))
        assertEquals("a\nx\n", Rulings.append("a\n", "x"))
        assertEquals("a\nx\n", Rulings.append("a", "x"))
    }

    private class Fake(var text: String?, var conflicts: Int = 0) : NotesApi {
        var writes = 0
        override suspend fun read(path: String, branch: String) = text?.let { FileAt(it, "sha") }
        override suspend fun write(path: String, branch: String, text: String, sha: String?, message: String): PutResult {
            assertEquals(Solomon.BRANCH, branch)
            assertEquals(Solomon.RULINGS, path)
            if (conflicts-- > 0) return PutResult.Conflict
            this.text = text; writes++
            return PutResult.Ok
        }
        override suspend fun branchExists(branch: String) = text != null
        override suspend fun createBranch(branch: String, from: String) = error("the phone never makes this branch")
    }

    @Test fun aRulingRetriesAConflict() = runBlocking {
        val api = Fake("", conflicts = 2)
        assertEquals(PutResult.Ok, Rulings.send(api, "c1", RuleHow.FIRST, "ok", "2026-11-02"))
        assertEquals(1, api.writes)
        assertEquals("first", Rulings.parse(api.text)["c1"]?.how)
    }

    @Test fun aRulingGivesUpAfterTheRetries() = runBlocking {
        assertIs<PutResult.Failed>(Rulings.send(Fake("", conflicts = 9), "c1", RuleHow.FIRST, "ok", "2026-11-02"))
        Unit
    }

    @Test fun noBranchNoRuling() = runBlocking {
        assertIs<PutResult.Failed>(Rulings.send(Fake(null), "c1", RuleHow.FIRST, "ok", "2026-11-02"))
        Unit
    }

    @Test fun thePhoneWritesOnlyItsTwoBranches() {
        val body = JSONObject(Contents.putBody("x", "sha", Solomon.BRANCH, "m"))
        assertEquals(Solomon.BRANCH, body.getString("branch"))
        assertEquals("x", String(Base64.getDecoder().decode(body.getString("content"))))
        assertFalse(Solomon.writable("main"))
    }
}
