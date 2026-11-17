package hu.vrg.mobile.core

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.nio.file.Files
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Széf (WP M24): the crypto, the secret rules, the lockout, the index and the backup, on a throwaway folder.
// Few PBKDF2 rounds here so the suite stays fast; the phone uses VaultStore.DEFAULT_ITERATIONS.

class VaultTest {
    private val dirs = ArrayList<File>()
    private fun dir() = Files.createTempDirectory("vault").toFile().also { dirs.add(it) }
    @AfterTest fun clean() { dirs.forEach { it.deleteRecursively() } }

    private val pin = "583029".toCharArray()
    private val wrong = "583028".toCharArray()
    private val now = 1_700_000_000_000L

    /** A stand-in for the Keystore device key: its own AES key, so "the key is gone" can be tested. */
    private class FakeDevice : VaultWrap {
        var key = VaultCrypto.random(32)
        override fun wrap(b: ByteArray) = VaultCrypto.seal(key, b, "device")
        override fun unwrap(b: ByteArray) = VaultCrypto.open(key, b, "device")
    }

    private fun store(d: File = dir(), device: VaultWrap = VaultWrap.NONE) = VaultStore(d, device, iterations = 1000)

    // ---- crypto --------------------------------------------------------------------------------------------------

    @Test fun sealOpensOnlyWithItsKeyAndPlace() {
        val k = VaultCrypto.random(32)
        val box = VaultCrypto.seal(k, "titok".toByteArray(), "blob:a")
        assertEquals("titok", String(VaultCrypto.open(k, box, "blob:a")))
        assertFailsWith<VaultSealBroken> { VaultCrypto.open(VaultCrypto.random(32), box, "blob:a") }
        assertFailsWith<VaultSealBroken> { VaultCrypto.open(k, box, "blob:b") }       // moved to another item
        val bent = box.copyOf().also { it[it.size - 1] = (it[it.size - 1] + 1).toByte() }
        assertFailsWith<VaultSealBroken> { VaultCrypto.open(k, bent, "blob:a") }      // one bit changed
        assertFailsWith<VaultSealBroken> { VaultCrypto.open(k, ByteArray(5), "blob:a") }
        // a fresh nonce every time
        assertFalse(box.contentEquals(VaultCrypto.seal(k, "titok".toByteArray(), "blob:a")))
    }

    @Test fun deriveIsStableAndSalted() {
        val s = VaultCrypto.random(16)
        assertContentEquals(VaultCrypto.derive(pin.copyOf(), s, 1000), VaultCrypto.derive(pin.copyOf(), s, 1000))
        assertFalse(VaultCrypto.derive(pin.copyOf(), s, 1000).contentEquals(VaultCrypto.derive(pin.copyOf(), VaultCrypto.random(16), 1000)))
        assertEquals(32, VaultCrypto.derive(pin.copyOf(), s, 1000).size)
        assertTrue(Regex("[0-9a-f]{16}").matches(VaultCrypto.newId()))
    }

    // ---- the secret ----------------------------------------------------------------------------------------------

    @Test fun pinAndPassphraseRules() {
        assertNull(VaultSecret.problem("583029", SecretKind.PIN))
        assertNotNull(VaultSecret.problem("12345", SecretKind.PIN))          // short
        assertNotNull(VaultSecret.problem("111111", SecretKind.PIN))         // all the same
        assertNotNull(VaultSecret.problem("123456", SecretKind.PIN))         // a run up
        assertNotNull(VaultSecret.problem("987654", SecretKind.PIN))         // a run down
        assertNotNull(VaultSecret.problem("12a456", SecretKind.PIN))         // not digits
        assertNotNull(VaultSecret.problem("123123", SecretKind.PIN))         // common
        assertNotNull(VaultSecret.problem("1234567890123", SecretKind.PIN))  // too long
        assertNull(VaultSecret.problem("kék villany 7", SecretKind.PASS))
        assertNotNull(VaultSecret.problem("rövid", SecretKind.PASS))
        assertNotNull(VaultSecret.problem("aaaaaaaa", SecretKind.PASS))
        assertEquals(SecretKind.PASS, SecretKind.of("pass"))
        assertEquals(SecretKind.PIN, SecretKind.of("??"))
    }

    // ---- create, unlock, lockout ---------------------------------------------------------------------------------

    @Test fun createThenUnlockWithThePinOnly() {
        val st = store()
        assertFalse(st.exists())
        assertIs<VaultUnlock.Missing>(st.unlock(pin, now))
        st.create(pin.copyOf(), SecretKind.PIN, now).close()
        assertTrue(st.exists())
        assertFailsWith<VaultRefused> { st.create(pin.copyOf(), SecretKind.PIN, now) }
        assertIs<VaultUnlock.Open>(st.unlock(pin.copyOf(), now))
        val w = assertIs<VaultUnlock.Wrong>(st.unlock(wrong.copyOf(), now))
        assertEquals(1, w.failures); assertEquals(0L, w.waitUntil); assertNull(w.wipeIn)
        // the right PIN resets the count
        assertIs<VaultUnlock.Open>(st.unlock(pin.copyOf(), now))
        assertEquals(0, st.header()!!.failures)
        // a weak PIN is refused at creation
        assertFailsWith<VaultRefused> { store().create("123456".toCharArray(), SecretKind.PIN, now) }
    }

    @Test fun nothingReadableOnDisk() {
        val d = dir()
        val s = store(d).create(pin.copyOf(), SecretKind.PIN, now)
        s.save(s.index.add(VaultItem(VaultCrypto.newId(), VaultKind.RECORD, "Kovács Béla ügyfél", null, "client",
            listOf(VaultField("Cím", "Fő utca 12")))))
        s.putFile("szerzodes.txt", "text/plain", "Kapukód 4711".toByteArray(), null, now)
        s.close()
        d.walkTopDown().filter { it.isFile }.forEach { f ->
            val txt = String(f.readBytes(), Charsets.ISO_8859_1)
            listOf("Kovács", "Fő utca", "Kapukód", "szerzodes", "583029").forEach { assertFalse(it in txt, "${f.name} shows '$it'") }
        }
    }

    @Test fun waitsLongerAfterRepeatedFailures() {
        val st = store()
        st.create(pin.copyOf(), SecretKind.PIN, now).close()
        var t = now
        repeat(4) { assertEquals(0L, assertIs<VaultUnlock.Wrong>(st.unlock(wrong.copyOf(), t)).waitUntil) }
        val fifth = assertIs<VaultUnlock.Wrong>(st.unlock(wrong.copyOf(), t))
        assertEquals(t + 30_000, fifth.waitUntil)
        // even the right PIN waits
        assertIs<VaultUnlock.Wait>(st.unlock(pin.copyOf(), t + 10_000))
        t += 30_000
        assertEquals(t + 60_000, assertIs<VaultUnlock.Wrong>(st.unlock(wrong.copyOf(), t)).waitUntil)
        t += 60_000
        assertIs<VaultUnlock.Open>(st.unlock(pin.copyOf(), t))
        assertEquals(listOf(0L, 0L, 30_000L, 60_000L, 300_000L, 900_000L, 3_600_000L, 3_600_000L),
            listOf(1, 4, 5, 6, 7, 8, 9, 20).map(VaultLock::delayAfter))
    }

    @Test fun tenthWrongTryWipesWhenAskedTo() {
        val d = dir()
        val st = store(d)
        val s = st.create(pin.copyOf(), SecretKind.PIN, now)
        s.setOptions(wipeAtTen = true)
        s.close()
        var t = now
        for (i in 1..9) {
            val w = assertIs<VaultUnlock.Wrong>(st.unlock(wrong.copyOf(), t))
            assertEquals(10 - i, w.wipeIn)
            t = maxOf(t, w.waitUntil)
        }
        assertIs<VaultUnlock.Wiped>(st.unlock(wrong.copyOf(), t))
        assertFalse(st.exists()); assertFalse(d.exists())
    }

    @Test fun copiedFilesNeedTheDeviceKey() {
        val dev = FakeDevice()
        val st = store(device = dev)
        st.create(pin.copyOf(), SecretKind.PIN, now).close()
        assertIs<VaultUnlock.Open>(st.unlock(pin.copyOf(), now))
        // without the device layer the PIN alone does not open it (files copied to another machine)
        assertFalse(VaultStore(st.dir, VaultWrap.NONE, 1000).unlock(pin.copyOf(), now) is VaultUnlock.Open)
        st.unlock(pin.copyOf(), now)                       // (clears the failure that copy counted)
        dev.key = VaultCrypto.random(32)                    // a factory reset: the Keystore key is new
        assertIs<VaultUnlock.KeyLost>(st.unlock(pin.copyOf(), now))
        assertEquals(0, st.header()!!.failures, "a lost key is not a wrong PIN")
    }

    @Test fun biometricPathOpensWithTheKeyOnly() {
        val st = store()
        val s = st.create(pin.copyOf(), SecretKind.PIN, now)
        val k = s.keyCopy()
        s.setBioBox(byteArrayOf(1, 2, 3))
        s.close()
        assertContentEquals(byteArrayOf(1, 2, 3), st.header()!!.bioBox)
        assertNotNull(st.unlockWithKey(k))
        assertNull(st.unlockWithKey(VaultCrypto.random(32)))
    }

    @Test fun changingThePinKeepsTheContents() {
        val st = store()
        val s = st.create(pin.copyOf(), SecretKind.PIN, now)
        s.save(s.index.add(VaultItem(VaultCrypto.newId(), VaultKind.NOTE, "Jegyzet", null, body = "szöveg")))
        assertTrue(s.verify(pin.copyOf())); assertFalse(s.verify(wrong.copyOf()))
        assertFailsWith<VaultRefused> { s.changeSecret(wrong.copyOf(), "kék villany 7".toCharArray(), SecretKind.PASS) }
        assertFailsWith<VaultRefused> { s.changeSecret(pin.copyOf(), "111111".toCharArray(), SecretKind.PIN) }
        s.changeSecret(pin.copyOf(), "kék villany 7".toCharArray(), SecretKind.PASS)
        s.close()
        assertIs<VaultUnlock.Wrong>(st.unlock(pin.copyOf(), now))
        val o = assertIs<VaultUnlock.Open>(st.unlock("kék villany 7".toCharArray(), now))
        assertEquals("szöveg", o.session.index.items.single().body)
        assertEquals(SecretKind.PASS, st.header()!!.kind)
        o.session.close()
        assertFalse(o.session.open)
        assertFailsWith<VaultRefused> { o.session.readFile("0000000000000000") }
    }

    @Test fun autoLock() {
        assertTrue(VaultLock.autoLockDue(now, now, 0))
        assertFalse(VaultLock.autoLockDue(now, now + 59_000, 60_000))
        assertTrue(VaultLock.autoLockDue(now, now + 60_000, 60_000))
        assertEquals(VaultLock.DEFAULT_TIMEOUT, VaultLock.TIMEOUTS[2].first)
    }

    @Test fun headerRoundTripsAndRefusesJunk() {
        val st = store()
        st.create(pin.copyOf(), SecretKind.PIN, now).close()
        val h = st.header()!!
        val back = VaultHeader.parse(h.toJson())!!
        assertContentEquals(h.pinBox, back.pinBox); assertContentEquals(h.salt, back.salt)
        assertEquals(h.iterations, back.iterations); assertNull(back.bioBox); assertEquals(now, back.created)
        assertNull(VaultHeader.parse("{}")); assertNull(VaultHeader.parse("nem json"))
    }

    // ---- files ---------------------------------------------------------------------------------------------------

    @Test fun filesInAndOut() {
        val st = store()
        val s = st.create(pin.copyOf(), SecretKind.PIN, now)
        val folder = VaultItem(VaultCrypto.newId(), VaultKind.FOLDER, "Ügyfelek", null)
        s.save(s.index.add(folder))
        val bytes = ByteArray(70_000) { (it % 251).toByte() }
        val f = s.putFile("../../etc/foto 1.jpg", "image/jpeg", bytes, folder.id, now)
        assertEquals("foto 1.jpg", f.title)
        assertEquals(folder.id, f.parent)
        assertEquals(VaultCrypto.sha256(bytes), f.file!!.sha256)
        assertContentEquals(bytes, s.readFile(f.id))
        assertFailsWith<VaultRefused> { s.putFile("nagy.bin", "", ByteArray((VaultStore.MAX_FILE + 1).toInt()), null, now) }
        // deleting the folder deletes the file's box
        s.remove(folder.id)
        assertTrue(s.index.items.isEmpty())
        assertFailsWith<VaultRefused> { s.readFile(f.id) }
        assertFalse(File(st.dir, "blobs/${f.id}.box").exists())
    }

    @Test fun fileHelpers() {
        assertEquals("a.txt", VaultFiles.safeName("C:\\x\\a.txt"))
        assertEquals("fajl", VaultFiles.safeName("..."))
        assertEquals("env", VaultFiles.safeName(".env"))
        assertTrue(VaultFiles.isImage("image/png")); assertFalse(VaultFiles.isImage("image/svg+xml"))
        assertTrue(VaultFiles.isText("application/octet-stream", "jegyzet.MD"))
        assertEquals("1.5 KB", VaultFiles.size(1536)); assertEquals("•••••", VaultFiles.mask("12345")); assertEquals("", VaultFiles.mask(""))
    }

    // ---- the index -----------------------------------------------------------------------------------------------

    private fun item(title: String, kind: VaultKind = VaultKind.NOTE, parent: String? = null, guard: Boolean = false) =
        VaultItem(VaultCrypto.newId(), kind, title, parent, guard = guard)

    @Test fun foldersCrumbsAndOrder() {
        val a = item("Ügyfelek", VaultKind.FOLDER)
        val b = item("Budapest", VaultKind.FOLDER, a.id, guard = true)
        val n1 = item("zebra", parent = b.id)
        val n2 = item("Ábel", parent = b.id)
        val n3 = item("Cecil", parent = b.id)
        val sub = item("Archív", VaultKind.FOLDER, b.id)
        val idx = VaultIndex.EMPTY.add(a).add(b).add(n1).add(n2).add(n3).add(sub)
        assertEquals(listOf("Archív", "Ábel", "Cecil", "zebra"), idx.children(b.id).map { it.title })
        assertEquals(listOf(a.id, b.id), idx.crumbs(n1.id).map { it.id })
        assertTrue(idx.guarded(n1.id)); assertFalse(idx.guarded(a.id))
        assertFailsWith<VaultRefused> { idx.add(item("x", parent = n1.id)) }            // a note is not a folder
        assertFailsWith<VaultRefused> { idx.add(item("x", parent = "0000000000000000")) }
        assertFailsWith<VaultRefused> { idx.move(a.id, sub.id) }                        // into itself
        assertFailsWith<VaultRefused> { idx.add(n1) }                                   // same id
        val moved = idx.move(n1.id, null)
        assertNull(moved.get(n1.id)!!.parent)
        val (left, files) = idx.remove(b.id)
        assertEquals(listOf(a.id), left.items.map { it.id }); assertTrue(files.isEmpty())
        assertEquals("Névtelen", VaultIndex.EMPTY.add(item("   ")).items.single().title)
    }

    @Test fun updateKeepsKindAndCanMove() {
        val f = item("Mappa", VaultKind.FOLDER)
        val n = item("Jegyzet")
        val idx = VaultIndex.EMPTY.add(f).add(n)
        val up = idx.update(n.copy(title = "Új cím", body = "tartalom", parent = f.id))
        assertEquals("Új cím", up.get(n.id)!!.title); assertEquals(f.id, up.get(n.id)!!.parent)
        assertFailsWith<VaultRefused> { idx.update(VaultItem(n.id, VaultKind.FILE, "x", null)) }
    }

    @Test fun searchIgnoresCaseAccentsAndSecrets() {
        val c = VaultItem(VaultCrypto.newId(), VaultKind.RECORD, "Kovács Béla", null, "client",
            listOf(VaultField("Cím", "Győr, Árpád út 3"), VaultField("Kapu- / riasztókód", "4711", secret = true)))
        val idx = VaultIndex.EMPTY.add(c).add(item("Bevásárlás"))
        assertEquals(listOf(c.id), idx.search("kovacs").map { it.id })
        assertEquals(listOf(c.id), idx.search("GYOR arpad").map { it.id })
        assertTrue(idx.search("4711").isEmpty(), "a secret value is not searchable")
        assertTrue(idx.search("  ").isEmpty())
    }

    @Test fun indexRoundTripsAndHealsBrokenEntries() {
        val f = item("Mappa", VaultKind.FOLDER)
        val r = VaultItem(VaultCrypto.newId(), VaultKind.RECORD, "Személyi", f.id, "idcard",
            VaultTemplates.IDCARD.blank().map { it.with("x") }, guard = true, created = 5, updated = 6)
        val file = VaultItem(VaultCrypto.newId(), VaultKind.FILE, "a.pdf", null, file = VaultFile("a.pdf", "application/pdf", 10, "ab"))
        val idx = VaultIndex.EMPTY.add(f).add(r).add(file)
        val back = VaultIndex.parse(idx.toJson())
        val r2 = back.get(r.id)!!
        assertEquals("idcard", r2.template); assertTrue(r2.guard); assertEquals(5L, r2.created)
        assertEquals(VaultTemplates.IDCARD.fields.map { it.second }, r2.fields.map { it.secret })
        assertEquals("application/pdf", back.get(file.id)!!.file!!.mime)
        assertEquals("🪪", r2.glyph)
        // a bad id, an unknown kind, a missing parent, a loop
        val l1 = "aaaaaaaaaaaaaaaa"; val l2 = "bbbbbbbbbbbbbbbb"
        val junk = """{"items":[
            {"id":"x","kind":"note","title":"rossz id"},
            {"id":"cccccccccccccccc","kind":"alien","title":"?"},
            {"id":"dddddddddddddddd","kind":"note","title":"árva","parent":"eeeeeeeeeeeeeeee"},
            {"id":"$l1","kind":"folder","title":"A","parent":"$l2"},
            {"id":"$l2","kind":"folder","title":"B","parent":"$l1"}]}"""
        val healed = VaultIndex.parse(junk)
        assertEquals(setOf("dddddddddddddddd", l1, l2), healed.items.map { it.id }.toSet())
        assertNull(healed.get("dddddddddddddddd")!!.parent)
        assertTrue(healed.items.any { it.parent == null && it.kind == VaultKind.FOLDER }, "the loop is broken")
    }

    @Test fun templates() {
        val ids = VaultTemplates.ALL.map { it.id }
        assertEquals(ids.size, ids.toSet().size)
        assertEquals(VaultTemplates.CUSTOM, VaultTemplates.byId("nincs"))
        assertTrue(VaultTemplates.CARD.blank().first { it.label == "CVC" }.secret)
        assertEquals("client", VaultTemplates.ALL.first().id)
    }

    // ---- the backup ----------------------------------------------------------------------------------------------

    private val pass = "mentes-jelszo-2026".toCharArray()

    private fun filled(): Pair<VaultSession, List<String>> {
        val s = store().create(pin.copyOf(), SecretKind.PIN, now)
        val f = item("Ügyfelek", VaultKind.FOLDER)
        val inner = item("Győr", VaultKind.FOLDER, f.id)
        s.save(s.index.add(f).add(inner).add(item("jegyzet", parent = inner.id)))
        val a = s.putFile("a.jpg", "image/jpeg", ByteArray(3000) { 7 }, inner.id, now)
        val b = s.putFile("b.txt", "text/plain", "szia".toByteArray(), null, now)
        return s to listOf(a.id, b.id)
    }

    @Test fun backupRestoresOnAnotherPhone() {
        val (s, files) = filled()
        val out = ByteArrayOutputStream()
        assertEquals(5, s.export(out, pass.copyOf(), 1000))
        val raw = String(out.toByteArray(), Charsets.ISO_8859_1)
        assertFalse("Ügyfelek" in raw || "szia" in raw || "jegyzet" in raw)
        // a new phone: a new vault with another PIN, then the backup
        val other = store(device = FakeDevice()).create("907153".toCharArray(), SecretKind.PIN, now)
        assertEquals(5, other.import(ByteArrayInputStream(out.toByteArray()), pass.copyOf(), null, now))
        assertEquals("szia", String(other.readFile(files[1])))
        assertEquals(3000, other.readFile(files[0]).size)
        assertEquals(listOf("Ügyfelek", "Győr"), other.index.crumbs(files[0]).map { it.title })
        // twice adds nothing
        assertEquals(0, other.import(ByteArrayInputStream(out.toByteArray()), pass.copyOf(), null, now))
        assertEquals(5, other.index.items.size)
    }

    @Test fun backupIntoAFolder() {
        val (s, _) = filled()
        val out = ByteArrayOutputStream().also { s.export(it, pass.copyOf(), 1000) }
        val other = store().create("907153".toCharArray(), SecretKind.PIN, now)
        val dest = item("Régi telefon", VaultKind.FOLDER)
        other.save(other.index.add(dest))
        other.import(ByteArrayInputStream(out.toByteArray()), pass.copyOf(), dest.id, now)
        val tops = other.index.items.filter { it.parent == dest.id }.map { it.title }.toSet()
        assertEquals(setOf("Ügyfelek", "b.txt"), tops)
    }

    @Test fun backupRefusesWrongPasswordCutAndChangedFiles() {
        val (s, _) = filled()
        val bytes = ByteArrayOutputStream().also { s.export(it, pass.copyOf(), 1000) }.toByteArray()
        val other = store().create("907153".toCharArray(), SecretKind.PIN, now)
        fun imp(b: ByteArray, p: CharArray = pass.copyOf()) = other.import(ByteArrayInputStream(b), p, null, now)
        assertFailsWith<VaultRefused> { imp(bytes, "masik-jelszo-99".toCharArray()) }
        assertFailsWith<VaultRefused> { imp(bytes.copyOf(bytes.size - 20)) }                 // cut
        assertFailsWith<VaultRefused> { imp(bytes.copyOf().also { it[it.size - 40] = (it[it.size - 40] + 1).toByte() }) }
        assertFailsWith<VaultRefused> { imp("nem mentés".toByteArray()) }
        assertTrue(other.index.items.isEmpty(), "a refused backup leaves nothing behind")
        assertFalse(File(other.let { store().dir }, "blobs").listFiles().orEmpty().isNotEmpty())
        // a weak backup password is refused before anything is written
        assertFailsWith<VaultRefused> { s.export(ByteArrayOutputStream(), "rovid".toCharArray(), 1000) }
        assertEquals("vrg-szef-2026-11-17.vrgvault", VaultBackup.fileName("2026-11-17"))
    }
}
