package hu.vrg.mobile.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class PulseTest {
    private val map = ToolMap.parse("""{"version":1,"tools":[
        {"id":"planner","name":"Varler Planner","paths":["Planner/"]},
        {"id":"mobile","name":"VRG Mobile","paths":["Mobile/","docs/mobile/","GO-MOBILE.md"]},
        {"id":"valena","name":"Valena","paths":["Toolbox/valena.html"]},
        {"id":"toolbox","name":"Toolbox","paths":["Toolbox/"]},
        {"id":"docs","name":"Dokumentáció","paths":["docs/"]}]}""")!!
    private val day = 24L * 60 * 60
    private val now = 1793400000L

    private fun compare(ahead: Int, behind: Int, files: String) = """{"ahead_by":$ahead,"behind_by":$behind,"files":[$files]}"""
    private fun file(name: String, previous: String? = null) =
        """{"filename":"$name"${previous?.let { ""","previous_filename":"$it"""" } ?: ""}}"""

    @Test fun aFileGoesToTheLongestMatchingPath() {
        assertEquals("Valena", map.toolOf("Toolbox/valena.html")?.name)
        assertEquals("Toolbox", map.toolOf("Toolbox/other.html")?.name)
        assertEquals("VRG Mobile", map.toolOf("docs/mobile/WP/M4.md")?.name)
        assertEquals("Dokumentáció", map.toolOf("docs/hub/README.md")?.name)
    }

    @Test fun aFileRuleMatchesThatFileOnly() {
        assertEquals("VRG Mobile", map.toolOf("GO-MOBILE.md")?.name)
        assertNull(map.toolOf("GO-MOBILE.md.bak"))
        assertNull(map.toolOf("Plannerish/x"))
    }

    @Test fun aComparisonTouchingTwoTools() {
        val c = assertNotNull(Comparison.parse(compare(2, 0, file("Planner/a.js") + "," + file("Mobile/b.kt"))))
        val rows = ToolRows.build(map, emptyList(), mapOf("feature" to c.files))
        assertEquals(setOf("Varler Planner", "VRG Mobile"), rows.map { it.name }.toSet())
        assertTrue(rows.all { it.branches == listOf("feature") })
    }

    @Test fun aRenamedFileCountsInBothPlaces() {
        val c = Comparison.parse(compare(1, 0, file("Mobile/new.kt", "Planner/old.js")))!!
        assertEquals(listOf("Mobile/new.kt", "Planner/old.js"), c.files)
        assertEquals(setOf("Varler Planner", "VRG Mobile"), ToolRows.build(map, c.files, emptyMap()).map { it.name }.toSet())
    }

    @Test fun aBranchOnlyBehindMainIsNotActive() {
        val c = Comparison.parse(compare(0, 40, ""))!!
        assertEquals(40, c.behind)
        assertTrue(c.files.isEmpty())
        assertFalse(Pulse.isActive("planner-sui", c.ahead, now - day, now))
    }

    @Test fun activeMeansAheadAndRecent() {
        assertTrue(Pulse.isActive("feature", 1, now - 13 * day, now))
        assertFalse(Pulse.isActive("feature", 1, now - 15 * day, now))
    }

    @Test fun mainAndTheNotesLogAreNeverBranchCards() {
        assertFalse(Pulse.isActive("main", 5, now, now))
        assertFalse(Pulse.isActive("mobile-log", 5, now, now))
    }

    @Test fun aFullFileListIsMarkedCapped() {
        val files = (1..300).joinToString(",") { file("Planner/$it.js") }
        assertTrue(Comparison.parse(compare(1, 0, files))!!.capped)
        assertFalse(Comparison.parse(compare(1, 0, file("Planner/a.js")))!!.capped)
    }

    @Test fun rowsAreMostChangedFirstAndTheOthersLast() {
        val rows = ToolRows.build(map, listOf("Planner/a", "Planner/b", "Mobile/c", "unknown.txt", "other.txt", "third.txt"), emptyMap())
        assertEquals(listOf("Varler Planner", "VRG Mobile", ToolRows.OTHER), rows.map { it.name })
        assertEquals(listOf(2, 1, 3), rows.map { it.mainFiles })
    }

    @Test fun aToolOnlyABranchTouchedStillShows() {
        val rows = ToolRows.build(map, emptyList(), mapOf("b" to listOf("Planner/x"), "a" to listOf("Planner/y")))
        assertEquals(listOf(ToolRow("Varler Planner", 0, listOf("a", "b"))), rows)
    }

    @Test fun aFailedCheckWinsOverARunningOne() {
        fun runs(vararg r: String) = """{"check_runs":[${r.joinToString(",")}]}"""
        val done = """{"status":"completed","conclusion":"success"}"""
        val bad = """{"status":"completed","conclusion":"failure"}"""
        val busy = """{"status":"in_progress","conclusion":null}"""
        assertEquals(Ci.OK, Ci.parse(runs(done, done)))
        assertEquals(Ci.RUNNING, Ci.parse(runs(done, busy)))
        assertEquals(Ci.FAILED, Ci.parse(runs(bad, busy)))
        assertEquals(Ci.NONE, Ci.parse(runs()))
        assertEquals(Ci.NONE, Ci.parse("not json"))
    }

    @Test fun aCommitShowsItsFirstLine() {
        val c = Pulse.commit("""{"sha":"abc","html_url":"https://github.com/x","commit":{"message":"Title\n\nBody","committer":{"date":"2026-10-31T10:00:00Z"}}}""")!!
        assertEquals("Title", c.message)
        assertEquals(1793440800L, c.at)
    }

    @Test fun pullsAreFoundByTheirHeadBranch() {
        val p = Pulse.pulls("""[{"number":7,"html_url":"u","head":{"ref":"feature"}}]""")
        assertEquals(OpenPull(7, "u"), p["feature"])
    }

    @Test fun anUnusableToolMapIsRefused() {
        assertNull(ToolMap.parse("""{"tools":[{"id":"x"}]}"""))
        assertNull(ToolMap.parse("nope"))
    }
}
