package hu.vrg.mobile.core

import org.json.JSONObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Fényjel R2: the phone's half of sys.stats against the shape relay-sys.js sends (Mobile/tests/relay-sys.js checks
// that side, including one real sample).
class SysTest {
    private fun answer(payload: String) = """{"v":1,"from":"relay","seq":3,"t":1,"type":"sys","payload":$payload}"""

    @Test fun theRequestIsARelayQuestion() {
        val m = JSONObject(SysMsgs.stats())
        assertEquals("sys.stats", m.getString("type"))
        assertEquals("relay", m.getString("to"))
        assertEquals("phone", m.getString("from"))
    }

    @Test fun parsesAFullAnswer() {
        val s = assertNotNull(SysMsgs.parse(answer("""{"ok":true,"host":"VRG-PC","cpu":0.342,"cores":8,"mem":{"used":12000000000,"total":16000000000},"disk":{"used":860000000000,"total":1000000000000,"root":"H:\\"},"uptime":11520}""")))
        assertTrue(s.ok)
        assertEquals("VRG-PC", s.host)
        assertEquals(0.342f, s.cpu, 1e-6f)
        assertEquals(8, s.cores)
        assertEquals(0.75f, s.memShare, 1e-6f)
        assertEquals(0.86f, assertNotNull(s.diskShare), 1e-6f)
        assertEquals("H:\\", s.disk?.root)
        assertEquals(11520L, s.uptimeS)
    }

    @Test fun toleratesMissingAndBadValues() {
        val s = assertNotNull(SysMsgs.parse(answer("""{"ok":true,"cpu":7,"disk":null}""")))
        assertEquals(1f, s.cpu, "cpu clamped to 1")
        assertNull(s.disk)
        assertNull(s.diskShare)
        assertEquals(0f, s.memShare, "no memory numbers = 0, not a division by zero")
        val bad = assertNotNull(SysMsgs.parse(answer("""{"ok":true,"disk":{"used":5,"total":0}}""")))
        assertNull(bad.disk, "a disk without a total is no disk")
    }

    @Test fun aRefusalCarriesItsReason() {
        val s = assertNotNull(SysMsgs.parse(answer("""{"ok":false,"trusted":false,"reason":"Párosítás kell."}""")))
        assertFalse(s.ok)
        assertEquals("Párosítás kell.", s.reason)
    }

    @Test fun ignoresEverythingElse() {
        assertNull(SysMsgs.parse("nem json"))
        assertNull(SysMsgs.parse("""{"from":"relay","type":"launch","payload":{"ok":true}}"""))
        assertNull(SysMsgs.parse("""{"from":"phone","type":"sys","payload":{"ok":true}}"""))
    }

    @Test fun readouts() {
        assertEquals("34%", Sys.percent(0.342f))
        assertEquals("100%", Sys.percent(1.4f))
        assertEquals("12,4 GB", Sys.gb(12_400_000_000))
        assertEquals("0,5 GB", Sys.gb(480_000_000))
        assertEquals("45 p", Sys.uptime(45 * 60 + 10))
        assertEquals("3 ó 12 p", Sys.uptime(3 * 3600 + 12 * 60))
        assertEquals("2 n 4 ó", Sys.uptime(2 * 86400 + 4 * 3600 + 59))
        assertEquals(Gauge.WARN, Sys.gauge(0.86f, Sys.DISK_WARN))
        assertEquals(Gauge.OK, Sys.gauge(0.5f, Sys.MEM_WARN))
    }
}
