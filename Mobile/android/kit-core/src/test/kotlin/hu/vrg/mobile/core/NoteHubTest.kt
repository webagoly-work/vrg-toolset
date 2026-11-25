package hu.vrg.mobile.core

import kotlinx.coroutines.runBlocking
import java.io.File
import java.time.ZoneId
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class NoteHubTest {
    private val zone = ZoneId.of("Europe/Budapest")
    private val t0 = 1_763_640_000_000L          // 2025-11-20 13:20 Budapest
    private val kit by lazy {
        val repo = System.getProperty("vrg.repo") ?: "../.."
        NotesKit.parse(File(repo, "Notes/catalog/noteskit.json").readText())
    }

    // ---- the kit ----

    @Test fun theRealKitIsValid() {
        assertEquals(emptyList(), NotesKit.problems(kit))
        assertEquals("terepi", kit.defaultProfile.id)
        assertTrue(kit.origin("sketcher")!!.mirror)
        assertTrue(kit.origin("sketcher")!!.client)
    }

    @Test fun profilesSwitchModulesCoreAlwaysOnPlannedNever() {
        val simple = kit.enabled("egyszeru")
        assertEquals(kit.modules.filter { it.core }.map { it.id }.toSet(), simple)
        val full = kit.enabled("teljes")
        assertTrue("fuzetek" in full && "naplo" in full)
        assertFalse("zar" in full)                                      // planned
        val mine = kit.enabled("egyszeru", mapOf("lista" to true, "kereses" to false, "zar" to true))
        assertTrue("lista" in mine && "kereses" in mine)                // core cannot be switched off
        assertFalse("zar" in mine)
        assertEquals(kit.defaultProfile.id, kit.profile("nincs-ilyen").id)
        assertEquals(kit.templates.size, kit.templatesFor("teljes").size)
        assertEquals(listOf("bejaras", "ugyfelhivas", "anyaglista", "hibalista"), kit.templatesFor("terepi").map { it.id })
    }

    @Test fun problemsAreFound() {
        val bad = kit.copy(profiles = kit.profiles.map { if (it.id == "iroda") it.copy(modules = it.modules + "nincs" + "zar", isDefault = true) else it })
        val p = NotesKit.problems(bad)
        assertTrue(p.any { "no module nincs" in it })
        assertTrue(p.any { "zar is only planned" in it })
        assertTrue(p.any { "exactly one" in it })
    }

    // ---- the note ----

    @Test fun jsonRoundTripKeepsEverythingAndLocalOnlyStaysLocal() {
        val n = VNote("n1", "Cím", "szöveg\n- [ ] egy", listOf("anyag"), "Kovács", pinned = true, mono = true, created = t0, updated = t0 + 5,
            device = "Pixel", origin = NoteOrigin("sketcher", "v1/E3", "Kovács · Fürdő", listOf("IP44"), open = true, seen = "szöveg"),
            unread = true, sha = "abc", dirty = false)
        assertEquals(n, NoteJson.read(NoteJson.write(n, local = true)))
        val shared = NoteJson.read(NoteJson.write(n))!!
        assertFalse(shared.unread); assertNull(shared.sha); assertTrue(shared.dirty)
        assertEquals(listOf(n), NoteJson.readAll(NoteJson.writeAll(listOf(n))))
        assertEquals(emptyList(), NoteJson.readAll("nem json"))
    }

    @Test fun shownTitleFallsBack() {
        assertEquals("Első sor", VNote("a", body = "\n# Első sor\nmásik").shown)
        assertEquals("teendő", VNote("a", body = "- [ ] teendő").shown)
        assertEquals("Kovács", VNote("a", origin = NoteOrigin("sketcher", label = "Kovács")).shown)
        assertEquals("Névtelen jegyzet", VNote("a").shown)
    }

    // ---- the notebook ----

    @Test fun createEditPinArchiveTrashPurge() {
        var (ns, n) = Notebook.create(emptyList(), t0, "Pixel", "  Bejárás ", "x", listOf("#Anyag Lista", "anyag-lista"))
        assertEquals("Bejárás", n.title); assertEquals(listOf("anyag-lista"), n.tags); assertNull(n.origin)
        val (ns2, n2) = Notebook.create(ns, t0, "Pixel")
        assertTrue(n2.id != n.id)                                       // same millisecond, still unique
        ns = Notebook.edit(ns2, n.id, "Bejárás", "y", t0 + 1)
        assertEquals("y", ns.first { it.id == n.id }.body)
        assertEquals(t0 + 1, ns.first { it.id == n.id }.updated)
        assertEquals(ns, Notebook.edit(ns, n.id, "Bejárás", "y", t0 + 2))   // no change, no new time
        ns = Notebook.pin(ns, n.id, true, t0 + 3)
        assertEquals(n.id, Notebook.list(ns, NoteFilter()).first().id)
        ns = Notebook.archive(ns, n.id, true, t0 + 4)
        assertTrue(Notebook.list(ns, NoteFilter()).none { it.id == n.id })
        assertEquals(n.id, Notebook.list(ns, NoteFilter(NoteView.ARCHIVE)).single().id)
        ns = Notebook.trash(ns, n.id, true, t0 + 5)
        assertEquals(n.id, Notebook.list(ns, NoteFilter(NoteView.TRASH)).single().id)
        ns = Notebook.purgeTrash(ns, t0 + 6)
        val tomb = ns.first { it.id == n.id }
        assertTrue(tomb.purged && tomb.body.isEmpty() && tomb.dirty)
        assertTrue(Notebook.list(ns, NoteFilter(NoteView.TRASH)).isEmpty())
    }

    @Test fun tasksToggleAndAdd() {
        val b = "Lista\n- [ ] kábel\n- [x] doboz\n* [ ] cső"
        assertEquals(listOf(false, true, false), Notebook.tasks(b).map { it.done })
        val t = Notebook.toggleTask(b, 1)
        assertEquals("- [x] kábel", t.lines()[1])
        assertEquals(b, Notebook.toggleTask(Notebook.toggleTask(b, 2), 2))
        assertEquals(b, Notebook.toggleTask(b, 0))                      // not a task line
        assertEquals("a\n- [ ] új", Notebook.addTask("a", " új "))
        assertEquals("- [ ] új", Notebook.addTask("", "új"))
    }

    @Test fun searchFoldsAccentsAndFilters() {
        var ns = emptyList<VNote>()
        ns = Notebook.create(ns, t0, "", "Fürdőszoba", "IP44 lámpa", listOf("bejárás"), book = "Kovács").first
        ns = Notebook.create(ns, t0 + 1, "", "Konyha", "pult", origin = NoteOrigin("sketcher", "v1/E1", "Szabó ház")).first
        assertEquals(listOf("Fürdőszoba"), Notebook.list(ns, NoteFilter(query = "furdo lampa")).map { it.title })
        assertEquals(listOf("Konyha"), Notebook.list(ns, NoteFilter(query = "szabo")).map { it.title })
        assertEquals(listOf("Konyha"), Notebook.list(ns, NoteFilter(origin = "sketcher")).map { it.title })
        assertEquals(listOf("Fürdőszoba"), Notebook.list(ns, NoteFilter(origin = Notebook.HERE)).map { it.title })
        assertEquals(listOf("Fürdőszoba"), Notebook.list(ns, NoteFilter(tag = "bejárás")).map { it.title })
        assertEquals(listOf("Fürdőszoba"), Notebook.list(ns, NoteFilter(book = "Kovács")).map { it.title })
        assertEquals(listOf("Konyha", "Fürdőszoba"), Notebook.list(ns, NoteFilter()).map { it.title })   // newest first
        assertEquals(listOf("bejárás" to 1), Notebook.tags(ns))
        assertEquals(listOf("Kovács"), Notebook.books(ns))
    }

    @Test fun dailyNoteIsOnePerDayAndTemplatesFillTheDate() {
        val (ns, d) = Notebook.daily(emptyList(), t0, zone, "Pixel")
        assertEquals("d-2025-11-20", d.id); assertEquals("Napi · 2025-11-20", d.title)
        val (ns2, d2) = Notebook.daily(ns, t0 + 3_600_000, zone, "Pixel")
        assertEquals(ns, ns2); assertEquals(d.id, d2.id)
        val trashed = Notebook.trash(ns, d.id, true, t0 + 1)
        assertFalse(Notebook.daily(trashed, t0 + 2, zone, "").second.trashed)   // today's note comes back from the trash
        val t = kit.templates.first { it.id == "bejaras" }
        val n = Notebook.fromTemplate(emptyList(), t, t0, zone, "").second
        assertEquals("Bejárás · 2025-11-20", n.title)
        assertTrue(Notebook.tasks(n.body).size >= 3)
        assertEquals(listOf("bejárás"), n.tags)
    }

    @Test fun markdownExport() {
        val n = VNote("a", "Cím", "szöveg", listOf("x"), origin = NoteOrigin("sketcher", "v1/E1", "Kovács"))
        assertEquals("# Cím\n\n> Sketcher · Kovács\n\nszöveg\n\n#x\n", Notebook.markdown(n, kit))
    }

    // ---- the linked mirror ----

    private fun item(text: String, ref: String = "v1/E1") = MirrorItem(ref, text, "Kovács · Fürdő", listOf("IP44"))
    private fun mid(ref: String = "v1/E1") = NoteMirror.idFor("sketcher", ref)

    @Test fun mirrorCreatesTaggedUnreadNoteOnce() {
        val ns = NoteMirror.push(emptyList(), "sketcher", item("csempe alatt cső"), t0, "Pixel")
        val n = ns.single()
        assertEquals("sketcher-v1-E1", n.id)
        assertEquals("sketcher", n.origin!!.app); assertEquals("v1/E1", n.origin!!.ref)
        assertEquals("csempe alatt cső", n.origin!!.seen)
        assertTrue(n.unread)
        assertEquals(ns, NoteMirror.push(ns, "sketcher", item("csempe alatt cső"), t0 + 9, "Pixel"))   // nothing new
        assertEquals(emptyList(), NoteMirror.push(emptyList(), "sketcher", MirrorItem("v1/E2", " "), t0, ""))
    }

    @Test fun sourceEditReachesTheNote() {
        var ns = NoteMirror.push(emptyList(), "sketcher", item("a"), t0, "")
        ns = NoteMirror.push(ns, "sketcher", item("a, b"), t0 + 1, "")
        assertEquals("a, b", ns.single().body); assertEquals("a, b", ns.single().origin!!.seen)
        assertNull(NoteMirror.pull(ns, "sketcher", "v1/E1", "a, b"))
    }

    @Test fun noteEditReachesTheSourceAndThenSettles() {
        var ns = NoteMirror.push(emptyList(), "sketcher", item("a"), t0, "")
        ns = Notebook.edit(ns, mid(), "", "a (javítva)", t0 + 1)
        assertEquals(ns, NoteMirror.push(ns, "sketcher", item("a"), t0 + 2, ""))    // the source has not changed: note kept
        assertEquals("a (javítva)", NoteMirror.pull(ns, "sketcher", "v1/E1", "a"))
        ns = NoteMirror.push(ns, "sketcher", item("a (javítva)"), t0 + 3, "")      // the source took it
        assertEquals("a (javítva)", ns.single().origin!!.seen)
        assertNull(NoteMirror.pull(ns, "sketcher", "v1/E1", "a (javítva)"))
    }

    @Test fun bothEditedKeepsBothTextsWithoutPilingUp() {
        var ns = NoteMirror.push(emptyList(), "sketcher", item("a"), t0, "")
        ns = Notebook.edit(ns, mid(), "", "a-jegyzet", t0 + 1)
        ns = NoteMirror.push(ns, "sketcher", item("a-vazlat"), t0 + 2, "")
        assertEquals("a-jegyzet" + NoteMirror.BOTH + "a-vazlat", ns.single().body)
        ns = NoteMirror.push(ns, "sketcher", item("a-vazlat2"), t0 + 3, "")        // still typing in the survey
        assertEquals("a-jegyzet" + NoteMirror.BOTH + "a-vazlat2", ns.single().body)
        val merged = NoteMirror.pull(ns, "sketcher", "v1/E1", "a-vazlat2")
        assertEquals(ns.single().body, merged)                                    // the survey gets both texts too
        ns = NoteMirror.push(ns, "sketcher", item(merged!!), t0 + 4, "")
        assertNull(NoteMirror.pull(ns, "sketcher", "v1/E1", merged))
    }

    @Test fun trashedNoteIsNotRevivedAndGoneRecordsAreMarked() {
        var ns = NoteMirror.sync(emptyList(), "sketcher", "v1/", listOf(item("a", "v1/E1"), item("b", "v1/E2")), t0, "")
        assertEquals(2, ns.size)
        ns = Notebook.trash(ns, mid("v1/E1"), true, t0 + 1)
        ns = NoteMirror.push(ns, "sketcher", item("a!", "v1/E1"), t0 + 2, "")
        assertEquals("a", ns.first { it.id == mid("v1/E1") }.body)
        assertNull(NoteMirror.pull(ns, "sketcher", "v1/E1", "x"))
        ns = NoteMirror.sync(ns, "sketcher", "v1/", listOf(item("a", "v1/E1")), t0 + 3, "")
        assertTrue(ns.first { it.id == mid("v1/E2") }.origin!!.gone)
        val other = NoteMirror.push(ns, "sketcher", item("c", "v2/E1"), t0 + 4, "")
        assertEquals(ns, NoteMirror.sync(other, "sketcher", "v1/", listOf(item("a", "v1/E1")), t0 + 5, "").filter { it.id != mid("v2/E1") })
        ns = NoteMirror.sync(ns, "sketcher", "v1/", listOf(item("a", "v1/E1"), item("b", "v1/E2")), t0 + 6, "")   // undo in the survey
        assertFalse(ns.first { it.id == mid("v1/E2") }.origin!!.gone)
    }

    @Test fun linkBackFillsTheRef() {
        val src = kit.origin("sketcher")
        assertEquals("vrg://sketch?open=v1&front=jegyzet", NoteMirror.link(src, NoteOrigin("sketcher", "v1/E3")))
        assertNull(NoteMirror.link(kit.origin("kezi"), NoteOrigin("kezi")))
    }

    // ---- sync ----

    private class FakeRemote : NoteRemote {
        val files = linkedMapOf<String, Pair<String, String>>()    // path -> (text, sha)
        var branch = false
        var conflictOnce = mutableSetOf<String>()
        var writes = 0
        private var n = 0
        override suspend fun ensureBranch() { branch = true }
        override suspend fun list() = files.keys.mapNotNull { p -> NoteSync.idOf(p.removePrefix("notes/"))?.let { it to files[p]!!.second } }.toMap()
        override suspend fun read(path: String) = files[path]?.let { FileAt(it.first, it.second) }
        override suspend fun write(path: String, text: String, sha: String?, message: String): NoteWrite {
            writes++
            if (conflictOnce.remove(path)) return NoteWrite.Conflict
            if (files[path]?.second != sha) return NoteWrite.Conflict
            val s = "s" + (++n)
            files[path] = text to s
            return NoteWrite.Ok(s)
        }
        fun put(n: VNote) { files[NoteSync.path(n.id)] = NoteSync.file(n) to "r" + (++this.n) }
    }

    @Test fun syncPushesNewAndPullsForeign() = runBlocking {
        val r = FakeRemote()
        r.put(VNote("x1", "Másik telefon", "b", created = t0, updated = t0, device = "Galaxy"))
        val mine = Notebook.create(emptyList(), t0, "Pixel", "Enyém", "a").first
        val rep = NoteSync.run(r, mine, t0 + 1, "Pixel")
        assertTrue(r.branch)
        assertEquals(1, rep.pulled); assertEquals(1, rep.pushed); assertNull(rep.problem)
        assertEquals(setOf("Enyém", "Másik telefon"), rep.notes.map { it.title }.toSet())
        assertTrue(rep.notes.none { it.dirty })
        val again = NoteSync.run(r, rep.notes, t0 + 2, "Pixel")              // nothing changed: no reads, no writes
        assertEquals(0, again.pulled); assertEquals(0, again.pushed)
        assertTrue(r.files.values.none { it.first.contains("\"dirty\"") || it.first.contains("\"sha\"") })
    }

    @Test fun syncTakesRemoteChangesOfCleanNotes() = runBlocking {
        val r = FakeRemote()
        val first = NoteSync.run(r, Notebook.create(emptyList(), t0, "", "A", "1").first, t0, "").notes
        val n = first.single()
        r.put(n.copy(body = "2", updated = t0 + 5))
        val rep = NoteSync.run(r, first, t0 + 6, "")
        assertEquals("2", rep.notes.single().body)
        assertFalse(rep.notes.single().dirty)
    }

    @Test fun syncConflictKeepsACopy() = runBlocking {
        val r = FakeRemote()
        val first = NoteSync.run(r, Notebook.create(emptyList(), t0, "", "A", "1").first, t0, "").notes
        val id = first.single().id
        r.put(first.single().copy(body = "távoli", updated = t0 + 5))
        val local = Notebook.edit(first, id, "A", "helyi", t0 + 9)               // newer: wins the id
        val rep = NoteSync.run(r, local, t0 + 10, "")
        assertEquals(1, rep.conflicts)
        assertEquals("helyi", rep.notes.first { it.id == id }.body)
        val copy = rep.notes.first { it.id != id }
        assertEquals("távoli", copy.body); assertTrue("ütközés" in copy.tags); assertNull(copy.origin)
        assertTrue(rep.notes.none { it.dirty })
        assertTrue(r.files.values.any { it.first.contains("helyi") })
    }

    @Test fun syncWriteConflictWaitsForTheNextRound() = runBlocking {
        val r = FakeRemote()
        val ns = Notebook.create(emptyList(), t0, "", "A", "1").first
        r.conflictOnce += NoteSync.path(ns.single().id)
        val rep = NoteSync.run(r, ns, t0, "")
        assertEquals(0, rep.pushed); assertTrue(rep.notes.single().dirty)
        val rep2 = NoteSync.run(r, rep.notes, t0 + 1, "")
        assertEquals(1, rep2.pushed); assertFalse(rep2.notes.single().dirty)
    }

    @Test fun syncRewritesFilesMissingFromTheBranch() = runBlocking {
        val r = FakeRemote()
        val ns = NoteSync.run(r, Notebook.create(emptyList(), t0, "", "A", "1").first, t0, "").notes
        r.files.clear()
        val rep = NoteSync.run(r, ns, t0 + 1, "")
        assertEquals(1, rep.pushed); assertEquals(1, r.files.size)
    }

    @Test fun rebaseKeepsEditsMadeDuringARound() {
        val a = VNote("a", body = "1", sha = null, dirty = true)
        val b = VNote("b", body = "x", sha = "s0", dirty = false)
        val start = listOf(a, b)
        val result = listOf(a.copy(sha = "s1", dirty = false), b, VNote("c", body = "távoli", sha = "s2", dirty = false))
        val current = listOf(a.copy(body = "1+"), b, VNote("d", body = "új"))    // a edited, d made during the round
        val out = NoteSync.rebase(start, result, current).associateBy { it.id }
        assertEquals("1+", out["a"]!!.body); assertEquals("s1", out["a"]!!.sha); assertTrue(out["a"]!!.dirty)
        assertEquals(b, out["b"]); assertEquals("távoli", out["c"]!!.body); assertEquals("új", out["d"]!!.body)
        assertEquals(4, out.size)
        val removed = NoteSync.rebase(start, result, listOf(b))          // a deleted locally during the round: not revived
        assertEquals(setOf("b", "c"), removed.map { it.id }.toSet())
    }

    @Test fun contentsJson() {
        val listing = """[{"type":"file","name":"n1.json","sha":"a"},{"type":"dir","name":"x","sha":"b"},{"type":"file","name":"readme.md","sha":"c"}]"""
        assertEquals(mapOf("n1" to "a"), NoteContents.listing(listing))
        assertEquals(emptyMap(), NoteContents.listing("{\"message\":\"Not Found\"}"))
        assertEquals("z", NoteContents.writtenSha("""{"content":{"sha":"z"}}"""))
        assertNotNull(runCatching { NoteContents.putBody("x", null, "main", "m") }.exceptionOrNull())
        assertTrue(NoteContents.putBody("x", "s", NoteSync.BRANCH, "m").contains("\"sha\":\"s\""))
        assertNotNull(runCatching { NoteContents.refBody("main", "s") }.exceptionOrNull())
    }
}
