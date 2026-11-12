package hu.vrg.mobile.core

import org.json.JSONObject
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

// WP M23 PC ablakok: the phone's rules. The folder answer is the fixture Mobile/tests/relay-files.js checks the live relay against,
// so the Kotlin parser and the relay agree on the fields.

class PcFilesTest {
    private val repo = File(System.getProperty("vrg.repo") ?: "../..")
    private val fx = File(repo, "Mobile/tests/fixtures/relay-files-answer.json").readText()

    @Test fun theFolderAnswerFromTheFixture() {
        val n = PcFiles.parse(fx)
        assertIs<PcNote.Listed>(n)
        val l = n.listing
        assertTrue(l.ok && l.on && l.trusted && !l.atRoots)
        assertEquals("full", l.root)
        assertEquals("VRG Full / jobs", l.title)
        assertEquals("1111111111111111", l.up, "one level up: the crumb before")
        assertEquals(listOf("2026-11 Kovács", "árajánlat.txt"), l.entries.map { it.name }, "a row with a bad handle is dropped")
        assertTrue(l.entries[0].dir); assertEquals(2048, l.entries[1].bytes)
    }

    @Test fun theRootsAndRefusals() {
        val roots = PcFiles.parse("""{"from":"relay","type":"files","payload":{"ok":true,"on":true,"h":null,"crumbs":[],"entries":[{"h":"aaaaaaaaaaaaaaaa","name":"Repó","dir":true}]}}""") as PcNote.Listed
        assertTrue(roots.listing.atRoots); assertNull(roots.listing.up); assertEquals("A PC munkamappái", roots.listing.title)
        val off = PcFiles.parse("""{"from":"relay","type":"files","payload":{"ok":false,"on":false,"reason":"--files"}}""") as PcNote.Listed
        assertFalse(off.listing.on); assertEquals("--files", off.listing.reason)
        val untrusted = PcFiles.parse("""{"from":"relay","type":"files","payload":{"ok":false,"trusted":false,"on":true,"reason":"Párosítás kell"}}""") as PcNote.Listed
        assertFalse(untrusted.listing.trusted)
        // names with a path in them never reach the screen
        val evil = PcFiles.parse("""{"from":"relay","type":"files","payload":{"ok":true,"on":true,"entries":[{"h":"bbbbbbbbbbbbbbbb","name":"..\\x"},{"h":"cccccccccccccccc","name":"a/b"}]}}""") as PcNote.Listed
        assertTrue(evil.listing.entries.isEmpty())
        assertNull(PcFiles.parse("""{"from":"phone","type":"files","payload":{"ok":true}}"""), "only the relay answers")
        assertNull(PcFiles.parse("""{"from":"relay","type":"claude","payload":{"ok":true}}"""))
        assertNull(PcFiles.parse("nope"))
    }

    @Test fun lookingAtAFile() {
        val t = (PcFiles.parse("""{"from":"relay","type":"files.read","payload":{"ok":true,"h":"aaaaaaaaaaaaaaaa","name":"a.txt","size":5,"kind":"text","text":"árvíz","encoding":"utf-8","truncated":false}}""") as PcNote.Looked).look
        assertEquals(PcKind.TEXT, t.kind); assertEquals("árvíz", t.text)
        val i = (PcFiles.parse("""{"from":"relay","type":"files.read","payload":{"ok":true,"name":"p.png","size":3,"kind":"image","mime":"image/png","data":"AAEC"}}""") as PcNote.Looked).look
        assertEquals(PcKind.IMAGE, i.kind); assertEquals("AAEC", i.data)
        val svg = (PcFiles.parse("""{"from":"relay","type":"files.read","payload":{"ok":true,"name":"p.svg","kind":"image","mime":"image/svg+xml","data":"PHN2Zz4="}}""") as PcNote.Looked).look
        assertEquals(PcKind.BINARY, svg.kind, "only the four bitmap types are drawn"); assertNull(svg.data)
        val b = (PcFiles.parse("""{"from":"relay","type":"files.read","payload":{"ok":true,"name":"x.zip","kind":"binary","size":9}}""") as PcNote.Looked).look
        assertEquals(PcKind.BINARY, b.kind); assertNull(b.text)
    }

    @Test fun copiedOntoTheBoard() {
        val c = (PcFiles.parse("""{"from":"relay","type":"files.copied","payload":{"ok":true,"entry":{"id":"0123456789abcdef","name":"a.txt","bytes":5}}}""") as PcNote.Copied).copied
        assertTrue(c.ok); assertEquals("0123456789abcdef", c.id); assertEquals("a.txt", c.name)
        val no = (PcFiles.parse("""{"from":"relay","type":"files.copied","payload":{"ok":false,"reason":"Túl nagy"}}""") as PcNote.Copied).copied
        assertFalse(no.ok); assertNull(no.id); assertEquals("Túl nagy", no.reason)
    }

    @Test fun messagesCarryHandlesOnly() {
        assertEquals("files.list", JSONObject(PcFiles.list()!!).getString("type"))
        assertFalse(JSONObject(PcFiles.list()!!).getJSONObject("payload").has("h"))
        assertEquals("0123456789abcdef", JSONObject(PcFiles.list("0123456789abcdef")!!).getJSONObject("payload").getString("h"))
        assertEquals("jobs", JSONObject(PcFiles.list(place = "jobs")!!).getJSONObject("payload").getString("place"))
        assertNull(PcFiles.list("C:\\Windows")); assertNull(PcFiles.list("../x")); assertNull(PcFiles.list(place = "../x"))
        assertEquals("relay", JSONObject(PcFiles.read("0123456789abcdef")!!).getString("to"))
        assertNull(PcFiles.read("x")); assertNull(PcFiles.copy("0123456789ABCDEF"))
        assertEquals("files.copy", JSONObject(PcFiles.copy("0123456789abcdef")!!).getString("type"))
    }

    @Test fun sizesAndPlaces() {
        assertEquals("0 B", PcFiles.size(0)); assertEquals("2,0 kB", PcFiles.size(2048)); assertEquals("1,5 MB", PcFiles.size(1536L * 1024))
        // the places the phone may name are the ones files.json defines
        val conf = JSONObject(File(repo, "Mobile/catalogue/files.json").readText()).getJSONObject("places")
        assertEquals(conf.keySet(), PcFiles.PLACES)
        // and each is a Desktop unit that opens the PC ablakok window
        PcFiles.PLACES.forEach { p -> assertEquals("pcwin", DeskCatalog.UNITS.first { it.id == p }.target, p) }
    }
}
