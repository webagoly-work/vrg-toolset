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

class PortsTest {

    private val token = "0123456789abcdef0123456789abcdef"

    /** The relay's answer as Mobile/tests/relay-ports.js checks it against the live relay. */
    private fun answer(): PortList {
        val raw = File("../../tests/fixtures/relay-ports-answer.json").readText()
        val n = PortsMsgs.parse(raw)
        assertIs<PortsNote.Listed>(n)
        return n.list
    }

    @Test fun theRelayAnswerParses() {
        val l = answer()
        assertTrue(l.ok && l.trusted && l.proxyOn)
        assertEquals(token, l.token)
        assertEquals(412, l.tookMs)
        assertNull(l.entries.find { it.port == 70000 }, "a port out of range is dropped")
        assertEquals("/", l.entries.first { it.port == 8125 }.path, "a bad path falls back to /")
        val planner = l.entries.first { it.port == 8131 }
        assertEquals("/Planner/projects/varler-planner/dist/varler_planner.html", planner.path)
        assertEquals("Varler Planner · dev szerver", planner.name)
        assertEquals("8131 · node · Varler Planner", planner.detail)
    }

    @Test fun namesAndStatus() {
        val l = answer().entries.associateBy { it.port }
        assertEquals("VRG MindMap", l.getValue(8124).name, "our name first")
        assertEquals("8124 · node", l.getValue(8124).detail, "no title repeated when it is the name")
        assertEquals("Vite App", l.getValue(5173).name, "else the page title")
        assertEquals("node", l.getValue(9229).name, "else the process")
        assertEquals("Port 1", PortEntry(1, null, false, null, null, "/", false, false).name)
        assertEquals(PortStatus.WEB, l.getValue(8124).status)
        assertEquals(PortStatus.OPEN, l.getValue(9229).status)
        assertEquals(PortStatus.SYSTEM, l.getValue(135).status)
        assertTrue(l.getValue(8124).openable)
        assertFalse(l.getValue(47291).openable, "the relay itself is not opened")
        assertFalse(l.getValue(9229).openable, "a port that does not speak HTTP is not opened")
    }

    @Test fun oursFirstThenWebThenTheRest() {
        val (shown, other) = Ports.split(answer().entries)
        // ours with a page, then other pages, then ours without a page; by port inside each group
        assertEquals(listOf(8124, 8131, 5173, 8125, 5037), shown.map { it.port })
        assertTrue(shown.none { it.self || it.system }, "the relay and system services are not on the first list")
        assertEquals(listOf(9229, 135, 47291).sorted(), other.map { it.port }.sorted())
        assertEquals(47291, Ports.sorted(answer().entries).first { it.self }.port)
    }

    @Test fun theProxyAddress() {
        assertEquals("http://192.168.1.24:47291/p/8124/?vrg_t=$token", Ports.proxyUrl("ws://192.168.1.24:47291", 8124, "/", token))
        assertEquals("http://pc:47292/p/8131/a.html?x=1&vrg_t=$token#top", Ports.proxyUrl("ws://pc:47292", 8131, "/a.html?x=1#top", token))
        assertNull(Ports.proxyUrl("ws://192.168.1.24:47291", 0, "/", token), "port 0")
        assertNull(Ports.proxyUrl("ws://192.168.1.24:47291", 65536, "/", token), "port 65536")
        assertNull(Ports.proxyUrl("ws://192.168.1.24:47291", 8124, "//evil.example/", token), "a //host path")
        assertNull(Ports.proxyUrl("ws://192.168.1.24:47291", 8124, "/", null), "no token: the proxy is off")
        assertNull(Ports.proxyUrl("ws://192.168.1.24:47291", 8124, "/", "short"), "a malformed token")
        assertNull(Ports.proxyUrl("wss://pc:47291", 8124, "/", token), "only the plain LAN relay")
        assertNull(Ports.proxyUrl("ws://a b:47291", 8124, "/", token), "a host with a space")
        assertNull(Ports.proxyUrl("ws://pc", 8124, "/", token), "no relay port")
    }

    @Test fun pathsAndPorts() {
        assertTrue(Ports.validPort(1) && Ports.validPort(65535))
        assertFalse(Ports.validPort(0) || Ports.validPort(65536) || Ports.validPort(-1) || Ports.validPort(null))
        assertTrue(Ports.validPath("/") && Ports.validPath("/a/b?c=1#d"))
        listOf("", "a", "//x", "/a b", "/x\\y", "/@x", "/\n", null).forEach { assertFalse(Ports.validPath(it), "path $it") }
    }

    @Test fun theMessages() {
        val list = JSONObject(PortsMsgs.list())
        assertEquals("ports.list", list.getString("type"))
        assertEquals("relay", list.getString("to"))
        assertEquals("phone", list.getString("from"))
        val open = JSONObject(assertNotNull(PortsMsgs.openOnDesktop(8124, "/x")))
        assertEquals("ports.open", open.getString("type"))
        assertEquals(8124, open.getJSONObject("payload").getInt("port"))
        assertEquals("/x", open.getJSONObject("payload").getString("path"))
        assertEquals("desktop", open.getJSONObject("payload").getString("where"))
        assertNull(PortsMsgs.openOnDesktop(0), "a bad port is never sent")
        assertNull(PortsMsgs.openOnDesktop(8124, "http://evil.example/"), "nor a URL as a path")
        assertTrue(open.getInt("seq") > list.getInt("seq"), "one sequence with the pairing messages")
    }

    @Test fun refusalsAndOpens() {
        val refused = PortsMsgs.parse("""{"from":"relay","type":"ports","payload":{"ok":false,"trusted":false,"reason":"Párosítás kell"}}""")
        assertIs<PortsNote.Listed>(refused)
        assertFalse(refused.list.ok || refused.list.trusted)
        assertEquals("Párosítás kell", refused.list.reason)
        assertTrue(refused.list.entries.isEmpty())
        val off = PortsMsgs.parse("""{"from":"relay","type":"ports","payload":{"ok":true,"ports":[],"proxy":{"on":false,"token":"$token"}}}""")
        assertIs<PortsNote.Listed>(off)
        assertNull(off.list.token, "no token is kept while the proxy is off")
        val opened = PortsMsgs.parse("""{"from":"relay","type":"ports.opened","payload":{"ok":true,"port":8124,"url":"http://localhost:8124/","how":"chrome.exe"}}""")
        assertIs<PortsNote.Opened>(opened)
        assertEquals(PortOpened(true, 8124, "http://localhost:8124/", "chrome.exe", null, true), opened.result)
        assertNull(PortsMsgs.parse("""{"from":"phone","type":"ports","payload":{}}"""), "only the relay answers")
        assertNull(PortsMsgs.parse("""{"from":"relay","type":"welcome","payload":{}}"""))
        assertNull(PortsMsgs.parse("not json"))
    }

    @Test fun theCatalogueEntry() {
        assertEquals(Stage.LIVE, Catalogue.PORTS.stage)
        assertEquals("M8", Catalogue.PORTS.wp)
        assertTrue(Need.RELAY in Catalogue.PORTS.needs)
    }
}
