package hu.vrg.mobile.tag

import org.json.JSONObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class DiagTest {
    private fun u(s: Int) = "0000%04x-0000-1000-8000-00805f9b34fb".format(s)

    /** A Q71-like watch: made-up values, not a real device. */
    private val watch = listOf(
        DiagService(u(0x1800), listOf(DiagChar(u(0x2A00), 0x02, "Q71".toByteArray()))),
        DiagService(u(0x180A), listOf(
            DiagChar(u(0x2A29), 0x02, "Acme \"Watch\"\n".toByteArray()),
            DiagChar(u(0x2A24), 0x02, "Q71".toByteArray()),
            DiagChar(u(0x2A26), 0x02, "V1.2.3\u0000".toByteArray()),
        )),
        DiagService(u(0x180F), listOf(DiagChar(u(0x2A19), 0x12, byteArrayOf(87)))),
        DiagService("0000d0ff-3c17-d293-8e48-14fe2e4da212", listOf(DiagChar("0000ffd1-3c17-d293-8e48-14fe2e4da212", 0x0C))),
        DiagService(u(0xFEE7), listOf(DiagChar(u(0xFEC9), 0x02, byteArrayOf(1, 2, 3)))),
    )

    @Test fun `uuids, names and properties`() {
        assertEquals(0x180A, Diag.short("0000180A-0000-1000-8000-00805F9B34FB"))
        assertNull(Diag.short("6e400001-b5a3-f393-e0a9-e50e24dcca9e"))
        assertEquals("Device Information", Diag.serviceName(u(0x180A)))
        assertEquals("Nordic UART (NUS)", Diag.serviceName("6E400001-B5A3-F393-E0A9-E50E24DCCA9E"))
        assertEquals("Firmware Revision", Diag.charName(u(0x2A26)))
        assertNull(Diag.charName("0000ffd1-3c17-d293-8e48-14fe2e4da212"))
        assertEquals(listOf("read", "notify"), Diag.props(0x12))
        assertEquals(listOf("write-no-response", "write"), Diag.props(0x0C))
    }

    @Test fun `only standard characteristics are read`() {
        assertTrue(Diag.safeToRead(u(0x2A26)))
        assertTrue(Diag.safeToRead(u(0x2A19)))
        assertFalse(Diag.safeToRead(u(0x2A25)), "no serial number in the report")
        assertFalse(Diag.safeToRead(u(0xFFE1)))
        assertFalse(Diag.safeToRead("0000ffd1-3c17-d293-8e48-14fe2e4da212"))
    }

    @Test fun `the chip is guessed from its update service`() {
        assertEquals("Nordic nRF5x", Diag.chip(listOf(u(0x1800), u(0xFE59)))?.guess)
        assertEquals("Nordic nRF5x", Diag.chip(listOf("00001530-1212-EFDE-1523-785FEABCD123"))?.guess)
        assertEquals("Realtek RTL87xx", Diag.chip(watch.map { it.uuid })?.guess)
        assertEquals("Telink TLSR", Diag.chip(listOf("00010203-0405-0607-0809-0a0b0c0d1912"))?.guess)
        assertEquals("Texas Instruments CC26xx", Diag.chip(listOf("f000ffc0-0451-4000-b000-000000000000"))?.guess)
        assertEquals("Dialog / Renesas DA14xxx", Diag.chip(listOf(u(0xFEF5)))?.guess)
        assertTrue(Diag.chip(listOf(u(0xAE00)))!!.guess.startsWith("JieLi"))
        assertNull(Diag.chip(listOf(u(0x1800), u(0x180A))))
    }

    @Test fun `information, battery and text`() {
        val i = Diag.info(watch)
        assertEquals("Q71", i["name"])
        assertEquals("V1.2.3", i["firmware"], "trailing NUL dropped")
        assertEquals(87, Diag.battery(watch))
        assertNull(Diag.text(byteArrayOf(1, 2, 3)), "binary is not text")
        assertNull(Diag.text(ByteArray(0)))
        assertEquals("0102ff", Diag.hex(byteArrayOf(1, 2, -1)))
        assertTrue(Diag.summary(watch).contains("fw V1.2.3"))
        assertTrue(Diag.summary(watch).contains("Realtek"))
        assertEquals("0 szolgáltatás, szabványos adatlap nélkül", Diag.summary(emptyList()))
    }

    @Test fun `the report is valid JSON in the shared format`() {
        val dev = DiagDevice("Q71", "00:11:22:33:44:55", bonded = true, type = "watch", majorClass = 0x0700)
        val j = JSONObject(Diag.report(dev, watch, "2026-11-22T04:00:00Z", "VRG Mobile 1.0"))
        assertEquals("vrg.device-diag", j.getString("kind"))
        assertEquals(1, j.getInt("v"))
        assertEquals("Q71", j.getJSONObject("device").getString("name"))
        assertEquals(1792, j.getJSONObject("device").getInt("majorClass"))
        assertTrue(j.getJSONObject("device").getBoolean("bonded"))
        assertEquals("Acme \"Watch\"", j.getJSONObject("info").getString("manufacturer").trim(), "quotes and newline escaped")
        assertEquals(87, j.getInt("battery"))
        val sv = j.getJSONArray("services")
        assertEquals(5, sv.length())
        assertEquals("Device Information", sv.getJSONObject(1).getString("name"))
        val fw = sv.getJSONObject(1).getJSONArray("characteristics").getJSONObject(2)
        assertEquals("Firmware Revision", fw.getString("name"))
        assertEquals("read", fw.getJSONArray("props").getString(0))
        assertEquals("V1.2.3", fw.getString("text"))
        val vendor = sv.getJSONObject(3).getJSONArray("characteristics").getJSONObject(0)
        assertTrue(vendor.isNull("value"), "vendor characteristics are listed, never read")
        assertTrue(vendor.isNull("name"))
        assertEquals("Realtek RTL87xx", j.getJSONObject("chip").getString("guess"))
        val bare = JSONObject(Diag.report(DiagDevice(null, "00:11:22:33:44:55", false, "other"), emptyList(), "t", "a"))
        assertTrue(bare.isNull("chip")); assertTrue(bare.isNull("battery")); assertTrue(bare.getJSONObject("device").isNull("name"))
    }

    @Test fun `json strings escape control characters`() {
        assertEquals("\"a\\u0001b\\\\c\\\"\"", Diag.q("a\u0001b\\c\""))
        assertEquals("null", Diag.q(null))
    }
}
