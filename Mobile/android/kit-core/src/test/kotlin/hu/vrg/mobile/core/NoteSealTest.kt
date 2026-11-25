package hu.vrg.mobile.core

import kotlinx.coroutines.runBlocking
import java.security.interfaces.ECPublicKey
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// D-179: client notes sealed on the vrg-notes branch, the Workflow Kit's way.
class NoteSealTest {
    private class Device(val id: String) {
        val kp = DeviceTrust.newKeyPair()
        val pub = DeviceTrust.jwk(kp.public as ECPublicKey)
        val me = NoteRecipient(id, "telefon $id", pub)
        val key = NoteKey(id, "telefon $id", pub, "2026-11-25T10:00:00Z")
        fun codec(trusted: List<NoteRecipient> = emptyList(), origins: Set<String> = setOf("sketcher")) =
            SealCodec(origins, { me }, { kp.private }, { trusted })
    }

    private val a = Device("AAAA11112222")
    private val b = Device("BBBB33334444")
    private val c = Device("CCCC55556666")
    private val client = VNote("sketcher-v1-E1", "", "Kovács Béla, Fő utca 12: a fürdőben IP44 lámpa", listOf("ügyfél"),
        origin = NoteOrigin("sketcher", "v1/E1", "Kovács · Fürdő", listOf("IP44"), seen = "x"), created = 1, updated = 2, device = "Pixel")

    @Test fun sealedFileHoldsNoClientTextAndOpensForEachRecipient() {
        val text = NoteSeal.seal(client, listOf(a.me, b.me))
        listOf("Kovács", "Fő utca", "IP44", "Fürdő", "ügyfél", "Pixel").forEach { assertFalse(text.contains(it), it) }
        assertTrue(NoteSeal.isSealed(text))
        assertEquals(listOf(a.id, b.id), NoteSeal.recipients(text))
        assertEquals(client.copy(sealed = true), NoteSeal.open(text, a.id, a.kp.private))
        assertEquals(client.copy(sealed = true), NoteSeal.open(text, b.id, b.kp.private))
        assertNull(NoteSeal.open(text, c.id, c.kp.private))                       // not a recipient
    }

    @Test fun tamperedMovedOrMisaddressedFilesDoNotOpen() {
        val text = NoteSeal.seal(client, listOf(a.me))
        val o = org.json.JSONObject(text)
        val ct = B64.dec(o.getString("ct"))!!; ct[5] = (ct[5].toInt() xor 1).toByte()
        val tampered = o.put("ct", B64.enc(ct)).toString()
        assertNotNull(runCatching { NoteSeal.open(tampered, a.id, a.kp.private) }.exceptionOrNull())
        val moved = org.json.JSONObject(text).put("id", "sketcher-v1-E2").toString()   // renamed to another note
        assertNotNull(runCatching { NoteSeal.open(moved, a.id, a.kp.private) }.exceptionOrNull())
        assertNotNull(runCatching { NoteSeal.open(text, a.id, a.kp.private, expectId = "masik") }.exceptionOrNull())
        val stolen = org.json.JSONObject(text).also { j -> j.getJSONArray("to").getJSONObject(0).put("id", c.id) }.toString()
        assertNotNull(runCatching { NoteSeal.open(stolen, c.id, c.kp.private) }.exceptionOrNull())   // A's wrapped key, C's name
    }

    @Test fun pinningNeedsTheCodeTheOtherDeviceShows() {
        assertEquals(DeviceTrust.code(b.id, b.pub), b.key.code)
        assertNull(NoteSeal.pin(b.key, "000000"))
        assertEquals(b.me.copy(name = b.key.name), NoteSeal.pin(b.key, " ${b.key.code.lowercase().chunked(3).joinToString(" ")} "))
        val forged = b.key.copy(pub = c.pub)                                       // B's id, someone else's key
        assertNull(NoteSeal.pin(forged, b.key.code))
        assertEquals(b.key, NoteKey.parse(b.key.toJson().toString()))
        assertEquals(listOf(b.me), NoteRecipient.listFrom(NoteRecipient.listToJson(listOf(b.me))))
    }

    @Test fun codecSealsOnlyWhatMustBeSealed() {
        val codec = a.codec()
        val plain = VNote("n1", "Bevásárlás", "kábel")
        assertFalse(NoteSeal.isSealed(codec.encode(plain)!!))
        assertTrue(NoteSeal.isSealed(codec.encode(client)!!))                        // a client origin
        assertTrue(NoteSeal.isSealed(codec.encode(plain.copy(sealed = true))!!))   // 🔒 by hand / a sealed template
        assertFalse(NoteSeal.isSealed(codec.encode(client.copy(purged = true, body = ""))!!))   // a tombstone holds nothing
        val noKey = SealCodec(setOf("sketcher"), { null }, { null }, { emptyList() })
        assertNull(noKey.encode(client))                                           // never falls back to plain
        assertIs<NoteDecoded.Locked>(noKey.decode(codec.encode(client)!!, client.id))
    }

    @Test fun anOldPlainClientFileIsSealedAgain() {
        val d = a.codec().decode(NoteSync.file(client), client.id)
        assertIs<NoteDecoded.Open>(d)
        assertTrue(d.reseal); assertTrue(d.note.sealed)
        val p = a.codec().decode(NoteSync.file(VNote("n1", body = "x")), "n1") as NoteDecoded.Open
        assertFalse(p.reseal)
        assertIs<NoteDecoded.Bad>(a.codec().decode(NoteSync.file(VNote("n1")), "n2"))
    }

    // ---- through the sync ----

    private class Branch : NoteRemote {
        val files = linkedMapOf<String, Pair<String, String>>()
        val messages = mutableListOf<String>()
        private var n = 0
        override suspend fun ensureBranch() {}
        override suspend fun list() = files.keys.mapNotNull { p -> NoteSync.idOf(p.removePrefix("notes/"))?.let { it to files[p]!!.second } }.toMap()
        override suspend fun read(path: String) = files[path]?.let { FileAt(it.first, it.second) }
        override suspend fun write(path: String, text: String, sha: String?, message: String): NoteWrite {
            if (files[path]?.second != sha) return NoteWrite.Conflict
            val s = "s" + (++n); files[path] = text to s; messages += message
            return NoteWrite.Ok(s)
        }
    }

    @Test fun syncKeepsClientTextOffTheBranchAndOutOfCommitMessages() = runBlocking {
        val r = Branch()
        val mine = listOf(client.copy(dirty = true, sealed = true), VNote("n1", "Saját", "semmi titkos", dirty = true))
        val rep = NoteSync.run(r, mine, 10, "Pixel", a.codec())
        assertEquals(2, rep.pushed)
        val file = r.files[NoteSync.path(client.id)]!!.first
        assertTrue(NoteSeal.isSealed(file)); assertFalse(file.contains("Kovács"))
        assertTrue(r.messages.none { it.contains("Kovács") || it.contains("Saját") })
        assertTrue(r.messages.any { it.contains("(lezárt)") })
    }

    @Test fun aSecondDeviceSeesNothingUntilTrustedThenEverything() = runBlocking {
        val r = Branch()
        NoteSync.run(r, listOf(client.copy(dirty = true, sealed = true)), 10, "", a.codec())
        // B is not trusted on A yet: the note stays locked on B, and is not fetched again
        val onB = NoteSync.run(r, emptyList(), 11, "", b.codec())
        assertTrue(onB.notes.isEmpty()); assertEquals(setOf(client.id), onB.locked.keys)
        val again = NoteSync.run(r, emptyList(), 12, "", b.codec(), onB.locked)
        assertEquals(0, again.pulled); assertEquals(onB.locked, again.locked)
        // A trusts B (code checked) and seals every sealed note again
        val pinned = NoteSeal.pin(b.key, b.key.code)!!
        val aNotes = NoteSync.run(r, emptyList(), 13, "", a.codec()).notes
        val resealed = NoteSync.run(r, Notebook.reseal(aNotes), 14, "", a.codec(listOf(pinned)))
        assertEquals(1, resealed.pushed)
        val onB2 = NoteSync.run(r, emptyList(), 15, "", b.codec(), again.locked)
        assertEquals("Kovács Béla, Fő utca 12: a fürdőben IP44 lámpa", onB2.notes.single().body)
        assertTrue(onB2.locked.isEmpty())
    }

    @Test fun aPlainClientFileOnTheBranchIsRewrittenSealed() = runBlocking {
        val r = Branch()
        r.files[NoteSync.path(client.id)] = NoteSync.file(client) to "old"          // written by the build before D-179
        val rep = NoteSync.run(r, emptyList(), 10, "", a.codec())
        assertEquals(1, rep.pushed)
        assertTrue(NoteSeal.isSealed(r.files[NoteSync.path(client.id)]!!.first))
        assertTrue(rep.notes.single().sealed); assertFalse(rep.notes.single().dirty)
    }

    @Test fun withoutAKeyClientNotesWaitAndPlainOnesGo() = runBlocking {
        val r = Branch()
        val noKey = SealCodec(setOf("sketcher"), { null }, { null }, { emptyList() })
        val rep = NoteSync.run(r, listOf(client.copy(dirty = true), VNote("n1", body = "x", dirty = true)), 10, "", noKey)
        assertEquals(1, rep.pushed); assertEquals(1, rep.waiting)
        assertTrue(rep.notes.first { it.id == client.id }.dirty)
        assertNull(r.files[NoteSync.path(client.id)])
    }

    @Test fun conflictCopiesOfSealedNotesStaySealedAndMirrorsSeal() {
        val mine = client.copy(sealed = true, body = "helyi", updated = 9, dirty = true)
        val theirs = client.copy(sealed = true, body = "távoli", updated = 5, dirty = false)
        val (out, n) = NoteSync.resolve(mine, theirs, listOf(mine), 10)
        assertEquals(1, n)
        val copy = out.first { it.id != client.id }
        assertNull(copy.origin); assertTrue(copy.sealed)
        assertTrue(a.codec().mustSeal(copy))
        val m = NoteMirror.push(emptyList(), "sketcher", MirrorItem("v2/E1", "szöveg"), 1, "", seal = true)
        assertTrue(m.single().sealed)
        val ns = Notebook.setSealed(m, m.single().id, false, 2, setOf("sketcher"))
        assertTrue(ns.single().sealed)                                             // a client note cannot be unsealed
        val own = Notebook.setSealed(listOf(VNote("n1")), "n1", true, 2, setOf("sketcher"))
        assertTrue(own.single().sealed)
        assertTrue(Notebook.setSealed(own, "n1", false, 3, setOf("sketcher")).single().sealed.not())
    }
}
