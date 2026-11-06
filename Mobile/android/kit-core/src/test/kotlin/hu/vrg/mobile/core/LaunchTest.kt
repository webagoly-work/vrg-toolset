package hu.vrg.mobile.core

import org.json.JSONObject
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class LaunchTest {

    /** The relay's answer as Mobile/tests/relay-launch.js checks it against the live relay. */
    private fun answer(): LaunchList {
        val n = LaunchMsgs.parse(File("../../tests/fixtures/relay-launch-answer.json").readText())
        assertIs<LaunchNote.Listed>(n)
        return n.list
    }

    @Test fun theRelayAnswerParses() {
        val l = answer()
        assertTrue(l.ok && l.trusted && l.proxyOn)
        assertEquals("0123456789abcdef0123456789abcdef", l.token)
        assertNull(l.entries.find { it.id == "bad id with spaces" }, "an id of the wrong shape is dropped")
        assertNull(l.entries.first { it.id == "server:huge" }.port, "a port out of range is dropped, the entry kept")
        val planner = l.entries.first { it.id == "tool:1" }
        assertEquals("1", planner.key)
        assertEquals(LaunchKind.TOOL, planner.kind)
        assertEquals(8131, planner.port)
        assertEquals("/Planner/projects/varler-planner/dist/varler_planner.html", planner.path)
        assertEquals("K·S", l.entries.first { it.id == "extra:K.S" }.key)
        assertEquals("O3", l.entries.first { it.id == "server:mindmap" }.key)
        assertFalse(l.entries.first { it.id == "tool:7" }.exists)
        assertEquals(setOf("tool:1", "server:mindmap", "nope").filter { Launch.validId(it) }.toSet(), l.running)
        assertEquals(listOf("Eszközök", "Helyi szerverek"), l.groups().map { it.first })
    }

    @Test fun runningAndOpenHere() {
        val l = answer()
        val planner = l.entries.first { it.id == "tool:1" }
        val calc = l.entries.first { it.id == "tool:2" }
        val city = l.entries.first { it.id == "tool:K" }
        assertTrue(l.isRunning(planner))
        assertTrue(Launch.openableHere(l, planner))
        assertFalse(Launch.openableHere(l, calc), "no server")
        assertFalse(Launch.openableHere(l, city), "its server is not running")
        assertFalse(Launch.openableHere(l.copy(proxyOn = false, token = null), planner), "the proxy is off")
        val s = LaunchMsgs.parse("""{"from":"relay","type":"launch.status","payload":{"ok":true,"running":["tool:K"],"mine":["tool:K"]}}""")
        assertIs<LaunchNote.Status>(s)
        val l2 = l.withStatus(s.status)
        assertTrue(l2.isRunning(city) && l2.isMine(city) && !l2.isRunning(planner))
    }

    @Test fun messagesCarryOnlyAnIdOfTheListShape() {
        val run = assertNotNull(LaunchMsgs.run("tool:K"))
        val o = JSONObject(run)
        assertEquals("launch.run", o.getString("type"))
        assertEquals("relay", o.getString("to"))
        assertEquals("tool:K", o.getJSONObject("payload").getString("id"))
        assertEquals(1, o.getJSONObject("payload").length())
        for (bad in listOf("", "K", "tool:", "tool:1 & calc", "tool:1;calc", "tool:../x", "C:\\x.exe", "cmd:calc", "tool:" + "x".repeat(40))) {
            assertNull(LaunchMsgs.run(bad), bad)
            assertNull(LaunchMsgs.stop(bad), bad)
            assertNull(LaunchMsgs.log(bad), bad)
        }
        assertEquals("launch.list", JSONObject(LaunchMsgs.list()).getString("type"))
    }

    @Test fun answers() {
        val ran = LaunchMsgs.parse("""{"from":"relay","type":"launch.ran","payload":{"ok":true,"id":"server:mindmap","how":"chrome.exe","started":true}}""")
        assertIs<LaunchNote.Ran>(ran)
        assertEquals("Elindítva és megnyitva a PC-n: VRG MindMap", Launch.ranText(ran.result, "VRG MindMap"))
        val no = LaunchMsgs.parse("""{"from":"relay","type":"launch.ran","payload":{"ok":false,"trusted":false,"reason":"Párosítás kell"}}""")
        assertIs<LaunchNote.Ran>(no)
        assertFalse(no.result.trusted)
        assertEquals("Nem indult: Párosítás kell", Launch.ranText(no.result, null))
        val log = LaunchMsgs.parse("""{"from":"relay","type":"launch.log","payload":{"ok":true,"id":"server:mindmap","lines":["a","b"]}}""")
        assertIs<LaunchNote.Log>(log)
        assertEquals(listOf("a", "b"), log.log.lines)
        assertNull(LaunchMsgs.parse("""{"from":"phone","type":"launch","payload":{"ok":true}}"""), "only the relay answers")
        assertNull(LaunchMsgs.parse("""{"from":"relay","type":"ports","payload":{"ok":true}}"""), "not ours")
        assertNull(LaunchMsgs.parse("not json"))
    }
}
