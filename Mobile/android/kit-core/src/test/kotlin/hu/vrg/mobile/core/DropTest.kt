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

class DropTest {

    /** The relay's board.listed as Mobile/tests/relay-board.js checks it against the live relay. */
    @Test fun theRelayListParses() {
        val n = DropMsgs.parse(File("../../tests/fixtures/relay-board-list.json").readText())
        assertIs<DropNote.Listed>(n)
        val l = n.list
        assertTrue(l.ok && l.trusted)
        assertEquals(listOf("0123456789abcdef", "fedcba9876543210"), l.entries.map { it.id }, "a path for an id, a negative size, an unknown origin or target is dropped")
        val photo = l.entries[0]
        assertEquals("IMG_1.jpg", photo.name)
        assertEquals(30000L, photo.bytes)
        assertEquals(DropFrom.PHONE, photo.from)
        assertEquals(DropTarget.PLANNER, photo.target)
        assertEquals("árajánlat.pdf", l.entries[1].name)
        assertEquals(DropFrom.PC, l.entries[1].from)
    }

    @Test fun namesMatchTheRelaysRule() {
        // the same cases as relay-board.js cleanName() in Mobile/tests/relay-board.js
        val cases = listOf(
            "../../evil.txt" to "evil.txt", "..\\..\\Windows\\x.bat" to "x.bat", "C:\\Windows\\System32\\cmd.exe" to "cmd.exe",
            "/etc/passwd" to "passwd", ".." to "fajl", "" to "fajl", null to "fajl", "   " to "fajl", "CON" to "_CON", "nul.txt" to "_nul.txt",
            "com1.pdf" to "_com1.pdf", "LPT9" to "_LPT9", "a<b>c:d\"e|f?g*h.txt" to "a_b_c_d_e_f_g_h.txt", ".env" to "env", "név. " to "név",
            "line\nbreak\u0000.txt" to "linebreak.txt", "invoice\u202Etxt.exe" to "invoicetxt.exe", "árajánlat 2026.pdf" to "árajánlat 2026.pdf",
        )
        for ((i, o) in cases) assertEquals(o, Drop.cleanName(i), "cleanName($i)")
        val long = Drop.cleanName("x".repeat(300) + ".pdf")
        assertEquals(120, long.codePointCount(0, long.length))
        assertTrue(long.endsWith(".pdf"))
    }

    @Test fun addressesKeepTheTicketOutOfTheUrl() {
        val sha = "a".repeat(64)
        assertEquals("http://192.168.1.24:47291", Drop.httpBase("ws://192.168.1.24:47291"))
        assertNull(Drop.httpBase("wss://x:1"))
        assertNull(Drop.httpBase("ws://evil host:47291"))
        assertNull(Drop.httpBase("ws://x:99999"))
        val u = assertNotNull(Drop.uploadUrl("ws://192.168.1.24:47291", "árajánlat & co.pdf", sha, DropTarget.PLANNER))
        assertEquals("http://192.168.1.24:47291/board/upload?name=%C3%A1raj%C3%A1nlat%20%26%20co.pdf&sha256=$sha&target=planner", u)
        assertFalse(u.contains("ticket"))
        assertNull(Drop.uploadUrl("ws://h:1", "x", "abc", DropTarget.INBOX), "a malformed SHA-256")
        assertNull(Drop.uploadUrl("ws://h:1", " ", sha, DropTarget.INBOX), "no name")
        assertEquals("http://h:1/board/file/0123456789abcdef", Drop.fileUrl("ws://h:1", "0123456789abcdef"))
        assertNull(Drop.fileUrl("ws://h:1", "../board.json"))
    }

    @Test fun messages() {
        val t = JSONObject(DropMsgs.ticketUpload())
        assertEquals("board.ticket", t.getString("type"))
        assertEquals("relay", t.getString("to"))
        assertEquals("upload", t.getJSONObject("payload").getString("op"))
        assertEquals("0123456789abcdef", JSONObject(assertNotNull(DropMsgs.ticketDownload("0123456789abcdef"))).getJSONObject("payload").getString("id"))
        for (bad in listOf("", "../x", "0123456789ABCDEF", "0123456789abcdef0", "x")) {
            assertNull(DropMsgs.ticketDownload(bad), bad)
            assertNull(DropMsgs.remove(bad), bad)
        }
        assertNull(DropMsgs.clipSet(""))
        assertNull(DropMsgs.clipSet("x".repeat(Drop.CLIP_MAX + 1)))
        assertEquals("Árvíztűrő", JSONObject(assertNotNull(DropMsgs.clipSet("Árvíztűrő"))).getJSONObject("payload").getString("text"))
        assertEquals("board.list", JSONObject(DropMsgs.list()).getString("type"))
        assertEquals("clip.get", JSONObject(DropMsgs.clipGet()).getString("type"))
    }

    @Test fun answers() {
        val tk = DropMsgs.parse("""{"from":"relay","type":"board.ticket","payload":{"op":"board.ticket","ok":true,"ticket":"0123456789abcdef0123456789abcdef","ttl":60000}}""")
        assertIs<DropNote.Ticket>(tk)
        assertTrue(tk.ticket.ok)
        assertEquals(60000L, tk.ticket.ttlMs)
        val badTk = DropMsgs.parse("""{"from":"relay","type":"board.ticket","payload":{"ok":true,"ticket":"short"}}""")
        assertIs<DropNote.Ticket>(badTk)
        assertFalse(badTk.ticket.ok, "a malformed ticket is not a ticket")
        val no = DropMsgs.parse("""{"from":"relay","type":"board.listed","payload":{"ok":false,"trusted":false,"reason":"Párosítás kell"}}""")
        assertIs<DropNote.Listed>(no)
        assertFalse(no.list.trusted)
        val ev = DropMsgs.parse("""{"from":"relay","type":"board","payload":{"event":"removed","id":"0123456789abcdef","name":"a.pdf","bytes":3,"sha256":"x","from":"pc","at":"t","target":"inbox"}}""")
        assertIs<DropNote.Event>(ev)
        assertFalse(ev.event.added)
        val clip = DropMsgs.parse("""{"from":"relay","type":"clip","payload":{"op":"clip.get","ok":true,"text":"a PC vágólapja"}}""")
        assertIs<DropNote.Clip>(clip)
        assertEquals("a PC vágólapja", clip.clip.text)
        assertNull(DropMsgs.parse("""{"from":"phone","type":"board.listed","payload":{"ok":true}}"""), "only the relay answers")
        assertNull(DropMsgs.parse("""{"from":"relay","type":"launch","payload":{"ok":true}}"""), "not ours")
        assertNull(DropMsgs.parse("not json"))
    }

    @Test fun uploadAnswerAndNotes() {
        val body = """{"ok":true,"entry":{"id":"0123456789abcdef","name":"IMG_1.jpg","bytes":5,"sha256":"x","from":"phone","at":"t","target":"planner"},"delivered":0}"""
        val u = DropMsgs.uploaded(200, body)
        assertTrue(u.ok)
        assertEquals("A táblán: IMG_1.jpg (a(z) Planner nincs megnyitva a PC-n)", Drop.uploadedText(u))
        assertEquals("Átküldve a(z) Planner felé: IMG_1.jpg", Drop.uploadedText(u.copy(delivered = 1)))
        val bad = DropMsgs.uploaded(400, """{"ok":false,"reason":"Az ellenőrzőösszeg nem egyezik"}""")
        assertEquals("Nem ment át: Az ellenőrzőösszeg nem egyezik", Drop.uploadedText(bad))
        assertFalse(DropMsgs.uploaded(502, "<html>").ok)
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", Drop.sha256("abc".toByteArray()))
        assertEquals("2026-11-06 09:15", Drop.localTime("2026-11-06T08:15:00.000Z", java.time.ZoneId.of("Europe/Budapest")), "the relay's UTC in local time")
        assertEquals("", Drop.localTime("t"))
        assertEquals("12 KB", Drop.sizeText(12 * 1024 + 5))
        assertEquals("3.4 MB", Drop.sizeText((3.4 * 1048576).toLong()))
        assertEquals("application/pdf", Drop.mimeOf("a.PDF"))
        assertEquals("application/octet-stream", Drop.mimeOf("evil.html"), "HTML is saved as a plain file, never as a page")
    }
}
