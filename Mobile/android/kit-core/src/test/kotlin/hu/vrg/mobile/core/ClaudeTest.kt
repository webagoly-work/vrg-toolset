package hu.vrg.mobile.core

import org.json.JSONObject
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

// WP M22 Claude: the phone's rules. The list answer is the fixture Mobile/tests/relay-claude.js checks the live relay against, so the
// Kotlin parser and the relay agree on the fields.

class ClaudeTest {
    private val repo = File(System.getProperty("vrg.repo") ?: "../..")
    private val fx = File(repo, "Mobile/tests/fixtures/relay-claude-answer.json").readText()

    @Test fun theListAnswerFromTheFixture() {
        val n = ClaudeMsgs.parse(fx)
        assertIs<ClaudeNote.Listed>(n)
        val l = n.list
        assertTrue(l.ok && l.on && l.trusted)
        assertEquals(listOf("1", "2"), l.folders.map { it.key })
        assertEquals("A repo gyökere", l.folderName("1"))
        assertEquals(listOf("A", "B"), l.accounts)
        assertEquals(listOf("c2", "c1"), l.sessions.map { it.id })
        assertNull(l.sessions[0].url, "the link not printed yet")
        assertEquals("https://claude.ai/code/session_01ABC?name=VRG", l.sessions[1].url)
        assertEquals("B", l.sessions[1].account)
        assertFalse(l.sessions[1].alive)
    }

    @Test fun refusalsAndOtherAnswers() {
        val off = ClaudeMsgs.parse("""{"from":"relay","type":"claude","payload":{"ok":false,"on":false,"reason":"--claude"}}""") as ClaudeNote.Listed
        assertFalse(off.list.on); assertEquals("--claude", off.list.reason)
        val untrusted = ClaudeMsgs.parse("""{"from":"relay","type":"claude.started","payload":{"ok":false,"trusted":false,"reason":"Párosítás kell"}}""") as ClaudeNote.Started
        assertFalse(untrusted.result.trusted); assertNull(untrusted.result.session)
        val started = ClaudeMsgs.parse("""{"from":"relay","type":"claude.started","payload":{"ok":true,"waiting":false,"session":{"id":"c3","name":"VRG x","folder":"1","account":"A","started":5,"url":"https://claude.ai/code/s3","alive":true}}}""") as ClaudeNote.Started
        assertEquals("https://claude.ai/code/s3", started.result.session!!.url)
        val stopped = ClaudeMsgs.parse("""{"from":"relay","type":"claude.stopped","payload":{"ok":true,"id":"c3"}}""") as ClaudeNote.Stopped
        assertEquals("c3", stopped.result.id)
        assertNull(ClaudeMsgs.parse("""{"from":"phone","type":"claude","payload":{"ok":true}}"""), "only the relay answers")
        assertNull(ClaudeMsgs.parse("""{"from":"relay","type":"launch","payload":{"ok":true}}"""))
        assertNull(ClaudeMsgs.parse("not json"))
        // a session link that is not claude.ai is dropped; a bad id drops the session
        val evil = ClaudeMsgs.parse("""{"from":"relay","type":"claude","payload":{"ok":true,"on":true,"sessions":[
            {"id":"c1","url":"https://evil.example/x","alive":true},{"id":"../x","url":"https://claude.ai/a"}],"folders":[{"key":"..","name":"x"}]}}""") as ClaudeNote.Listed
        assertEquals(1, evil.list.sessions.size); assertNull(evil.list.sessions[0].url); assertTrue(evil.list.folders.isEmpty())
    }

    @Test fun messages() {
        val s = JSONObject(ClaudeMsgs.start("1", "B")!!)
        assertEquals("claude.start", s.getString("type")); assertEquals("relay", s.getString("to"))
        assertEquals("1", s.getJSONObject("payload").getString("folder")); assertEquals("B", s.getJSONObject("payload").getString("account"))
        assertNull(ClaudeMsgs.start("../x")); assertNull(ClaudeMsgs.start("1", "C")); assertNull(ClaudeMsgs.start("12"))
        assertEquals("c4", JSONObject(ClaudeMsgs.stop("c4")!!).getJSONObject("payload").getString("id"))
        assertNull(ClaudeMsgs.stop("x")); assertNull(ClaudeMsgs.stop("c1;rm"))
        assertEquals("claude.list", JSONObject(ClaudeMsgs.list()).getString("type"))
    }

    @Test fun openingTheClaudeApp() {
        assertEquals(ClaudeOpen("https://claude.ai/code/s1", ClaudeApp.PACKAGE), ClaudeApp.target("https://claude.ai/code/s1", installed = true))
        assertEquals(ClaudeOpen("https://claude.ai/code/s1", null), ClaudeApp.target("https://claude.ai/code/s1", installed = false), "no app: the browser")
        assertEquals(ClaudeApp.WEB, ClaudeApp.target(null, true).url, "no session: Claude itself")
        assertEquals(ClaudeApp.WEB, ClaudeApp.target("https://evil.example/", true).url, "never another host")
        assertFalse(ClaudeApp.isLink("http://claude.ai/x")); assertFalse(ClaudeApp.isLink("https://claude.ai.evil/x")); assertFalse(ClaudeApp.isLink("https://claude.ai/a b"))
        assertTrue(ClaudeApp.isLink("https://claude.ai/code/session_01X?name=VRG%20a"))
    }

    @Test fun theChatPaneIsTheClaudeWindow() {
        // the Desktop's `chat` pane on the phone is this feature (PARITY.md: chat → the Claude app on the PC's session)
        assertEquals("feat:claude", PhoneSheets.resolve("pane:chat")?.open)
    }
}
