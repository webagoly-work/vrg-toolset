package hu.vrg.mobile.core

import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import java.time.ZoneId
import java.util.Base64
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue

class NotesTest {
    private val zone = ZoneId.of("Europe/Budapest")
    private val at = 1793367120000L                       // 2026-10-30 14:32 in Budapest

    @Test fun theMarkdownLine() {
        assertEquals("log/2026-10-30.md", NoteLog.path(at, zone))
        assertEquals("- 14:32 · [planner] Konyha: 2 dugalj a pult fölé (from: phone) <!-- n:a1 -->",
            Note("a1", at, "  Konyha: 2 dugalj a pult fölé ", "planner").line(zone))
        assertEquals("- 14:32 · első sor\n  második sor (from: phone, branch: main) <!-- n:a2 -->",
            Note("a2", at, "első sor\r\nmásodik sor", null, "main").line(zone))
    }

    @Test fun theDayFile() {
        val first = NoteFile.append(null, Note("a1", at, "egy"), zone)
        assertTrue(first.startsWith("# Mobil napló · 2026-10-30\n"))
        val both = NoteFile.append(first, Note("a2", at + 60_000, "kettő"), zone)
        assertEquals(listOf("- 14:32 · egy (from: phone)", "- 14:33 · kettő (from: phone)"), NoteFile.read(both))
        assertEquals(both, NoteFile.append(both, Note("a2", at + 60_000, "kettő"), zone), "the same note is not added twice")
        assertTrue(NoteFile.append("no newline", Note("a3", at, "x"), zone).startsWith("no newline\n- "))
    }

    /** A GitHub with one branch and some files, which can be told to answer a conflict. */
    private class FakeApi(var conflicts: Int = 0) : NotesApi {
        val files = HashMap<String, FileAt>()
        val branches = mutableSetOf("main")
        var writes = 0
        override suspend fun read(path: String, branch: String) = files["$branch:$path"]
        override suspend fun write(path: String, branch: String, text: String, sha: String?, message: String): PutResult {
            writes++
            if (conflicts > 0) {
                conflicts--
                // someone else wrote meanwhile: the file moved on
                val cur = files["$branch:$path"]
                files["$branch:$path"] = FileAt((cur?.text ?: NoteLog.header("2026-10-30")) + "- 14:00 · máshonnan\n", "sha-other-$writes")
                return PutResult.Conflict
            }
            if (files["$branch:$path"]?.sha != sha) return PutResult.Conflict
            files["$branch:$path"] = FileAt(text, "sha-$writes")
            return PutResult.Ok
        }
        override suspend fun branchExists(branch: String) = branch in branches
        override suspend fun createBranch(branch: String, from: String) { check(from in branches); branches += branch }
    }

    @Test fun appendCreatesTheBranchAndTheFile() = runBlocking {
        val api = FakeApi()
        assertEquals(PutResult.Ok, NoteWriter.send(api, Note("a1", at, "egy"), zone))
        assertTrue("mobile-log" in api.branches)
        assertEquals(listOf("- 14:32 · egy (from: phone)"), NoteFile.read(api.files["mobile-log:log/2026-10-30.md"]!!.text))
    }

    @Test fun aConflictIsRetriedOnTheNewFile() = runBlocking {
        val api = FakeApi(conflicts = 1)
        assertEquals(PutResult.Ok, NoteWriter.send(api, Note("a1", at, "egy"), zone))
        val lines = NoteFile.read(api.files["mobile-log:log/2026-10-30.md"]!!.text)
        assertEquals(listOf("- 14:00 · máshonnan", "- 14:32 · egy (from: phone)"), lines, "the other writer's line is kept")
        assertEquals(2, api.writes)
    }

    @Test fun threeConflictsGiveUp() = runBlocking {
        val api = FakeApi(conflicts = 5)
        assertIs<PutResult.Failed>(NoteWriter.send(api, Note("a1", at, "egy"), zone))
        assertEquals(NoteLog.RETRIES, api.writes)
    }

    @Test fun aNoteThatAlreadyLandedIsNotWrittenAgain() = runBlocking {
        val api = FakeApi()
        NoteWriter.send(api, Note("a1", at, "egy"), zone)
        val before = api.writes
        assertEquals(PutResult.Ok, NoteWriter.send(api, Note("a1", at, "egy"), zone))
        assertEquals(before, api.writes)
    }

    @Test fun theOutboxKeepsItsOrder() {
        var o = Outbox().add(Note("1", 1, "a", "planner")).add(Note("2", 2, "b")).add(Note("1", 1, "a"))
        assertEquals(listOf("1", "2"), o.notes.map { it.id })
        o = Outbox.fromJson(o.toJson())
        assertEquals(Note("1", 1, "a", "planner"), o.next)
        o = o.sent("1")
        assertEquals("2", o.next?.id)
        assertEquals(Outbox(), Outbox.fromJson("rossz"))
    }

    @Test fun contentsJson() {
        val b64 = Base64.getMimeEncoder().encodeToString("# Napló\n- 14:32 · egy\n".toByteArray())
        val f = Contents.parse(JSONObject().put("content", b64).put("sha", "abc").toString())!!
        assertEquals(FileAt("# Napló\n- 14:32 · egy\n", "abc"), f)
        val put = JSONObject(Contents.putBody("szöveg", "abc", "mobile-log", "msg"))
        assertEquals("mobile-log", put.getString("branch"))
        assertEquals("szöveg", String(Base64.getDecoder().decode(put.getString("content"))))
        assertFalse(JSONObject(Contents.putBody("x", null, "mobile-log", "m")).has("sha"), "a new file has no sha")
        assertEquals("deadbeef", Contents.refSha("""{"ref":"refs/heads/main","object":{"sha":"deadbeef","type":"commit"}}"""))
    }

    @Test fun noOtherBranchIsEverWritten() {
        assertFailsWith<IllegalArgumentException> { Contents.putBody("x", null, "main", "m") }
        assertFailsWith<IllegalArgumentException> { Contents.refBody("main", "abc") }
        assertFalse(NoteLog.writable("ccr-3aebf098-ytpsqa"))
    }
}
