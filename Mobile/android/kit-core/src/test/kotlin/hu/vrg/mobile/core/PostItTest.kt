package hu.vrg.mobile.core

import org.json.JSONObject
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

// WP M68 Post-it: the phone's half of "vrg-postit/1" against the fixture the Desktop's JS test reads too
// (Dashboard/test/wp-50.test.js), so a phone's export opens on the PC and the other way round.
class PostItTest {
    private val fixture = File("../../../shared/postit/fixtures/bundle-v1.json").readText()

    private fun ok(text: String) = assertIs<PostIt.Parsed.Ok>(PostIt.parse(text)).bundle
    private fun err(text: String) = assertIs<PostIt.Parsed.Bad>(PostIt.parse(text)).err

    @Test fun fixtureParses() {
        val b = ok(fixture)
        assertEquals("t-kovacs01", b.author.id)
        assertEquals("Pixel 8", b.author.device)
        assertEquals(3, b.notes.size)
        assertEquals(PiAnchor("m:notes", "new", 0.82, 0.91, 412, 915), b.notes[0].anchor)
        assertTrue(b.notes[1].done)
        assertEquals(b, ok("﻿" + fixture))
    }

    @Test fun hueMatchesTheJsTwin() {
        assertEquals(165, PostIt.hue("t-kovacs01"))   // the same numbers as wp-50.test.js
        assertEquals(75, PostIt.hue("t-x9"))
    }

    @Test fun badBundlesSayWhy() {
        fun bad(edit: (JSONObject) -> Unit): String { val j = JSONObject(fixture); edit(j); return err(j.toString()) }
        assertEquals("format", bad { it.put("format", "vrg-postit/2") })
        assertEquals("author.platform", bad { it.getJSONObject("author").put("platform", "ios") })
        assertEquals("author.name", bad { it.getJSONObject("author").remove("name") })
        assertEquals("notes[1].anchor.screen", bad { it.getJSONArray("notes").getJSONObject(1).getJSONObject("anchor").put("screen", "x:home") })
        assertEquals("notes[0].anchor.xy", bad { it.getJSONArray("notes").getJSONObject(0).getJSONObject("anchor").put("x", 1.2) })
        assertEquals("notes[2].text", bad { it.getJSONArray("notes").getJSONObject(2).put("text", "   ") })
        assertEquals("notes[0].edited", bad { it.getJSONArray("notes").getJSONObject(0).put("edited", 1) })
        assertEquals("notes.dup", bad { val a = it.getJSONArray("notes"); a.getJSONObject(2).put("id", a.getJSONObject(0).getString("id")) })
        assertEquals("json", err("{"))
    }

    @Test fun bundleRoundTripsAndDropsInvalidNotes() {
        val n = PostIt.make("Lassú", PiAnchor("m:home", null, 0.5, 0.25, 412, 915), at = 1000, rand = { 0.5 })
        assertEquals("pn-ssssssssssss", n.id)                     // the same id postit-core.js makes from the same draws
        val broken = n.copy(id = "x")
        val text = PostIt.bundle(PiAuthor("a-123456", "Teszt", "mobile", "Pixel 8", "VRG Mobile"), listOf(n, broken), at = 2000)
        val b = ok(text)
        assertEquals(listOf(n), b.notes)
        assertEquals("1970-01-01T00:00:02Z", b.exportedAt)
        assertTrue(PostIt.looksLikeBundle(text))
        assertTrue(!PostIt.looksLikeBundle("Bevásárlás: kábel"))
        assertEquals(listOf(n), PostIt.mineFromJson(text))
    }

    @Test fun mergeKeepsTheNewerEditAndIsIdempotent() {
        val b = ok(fixture)
        val m1 = PostIt.mergeInbox(emptyMap(), b, 1)
        assertEquals(3 to 0, m1.added to m1.updated)
        val m2 = PostIt.mergeInbox(m1.inbox, b, 2)
        assertEquals(0 to 0, m2.added to m2.updated)
        val newer = b.copy(notes = listOf(b.notes[0].copy(text = "Javítva?", edited = b.notes[0].edited + 1000), b.notes[1].copy(text = "régebbi", edited = b.notes[1].edited - 1)))
        val m3 = PostIt.mergeInbox(m2.inbox, newer, 3)
        assertEquals(0 to 1, m3.added to m3.updated)
        val notes = m3.inbox.getValue("t-kovacs01").notes
        assertEquals("Javítva?", notes.first { it.id == "pn-a1b2c3d4e5f6" }.text)
        assertEquals("A cím levágódik fekvő módban.", notes.first { it.id == "pn-0000000000aa" }.text)
        val other = b.copy(author = b.author.copy(id = "t-x9", name = "Más"))
        val m4 = PostIt.mergeInbox(m3.inbox, other, 4)
        assertEquals(6, PostIt.inboxNotes(m4.inbox).size)
        assertEquals(3, PostIt.inboxNotes(m4.inbox, setOf("t-x9")).size)
        // the inbox survives its file
        assertEquals(m4.inbox, PostIt.inboxFromJson(PostIt.inboxToJson(m4.inbox)))
        assertEquals(emptyMap(), PostIt.inboxFromJson("nem json"))
    }

    @Test fun placementMatchesThePc() {
        val box = PiBox(100.0, 50.0, 800.0, 600.0)
        val a = PostIt.anchorAt("m:home", "", 500.0, 350.0, box)
        assertEquals(PiAnchor("m:home", null, 0.5, 0.5, 800, 600), a)
        assertEquals(500.0 to 350.0, PostIt.toPx(a, box))
        assertEquals(PiAnchor("m:home", null, 1.0, 0.0, 800, 600), PostIt.anchorAt("m:home", null, 2000.0, -5.0, box))
        assertEquals("right", PostIt.cardAt(300.0, 300.0, box, 190.0, 60.0).side)
        val c = PostIt.cardAt(880.0, 60.0, box, 190.0, 60.0)
        assertEquals("left", c.side)
        assertTrue(c.x >= box.x && c.x + 190 <= box.x + box.w && c.y >= box.y)
        val s = PostIt.stack(listOf(PiCard(10.0, 10.0, "right"), PiCard(12.0, 20.0, "right")), 190.0, 58.0)
        assertEquals(20.0 + 58 + 6, s[1].y)   // moved one card down from where it was
    }

    @Test fun screenKeys() {
        assertEquals("m:notes", PostIt.screen("notes"))
        assertEquals("m:apps/inventory", PostIt.screen("apps/inventory"))
        assertEquals("m:a_b", PostIt.screen("a b"))
        assertTrue(PostIt.SCREEN.matches(PostIt.screen("x".repeat(400))))
        assertNull(PostIt.check(PostIt.make("x", PiAnchor(PostIt.screen("home"), null, 0.0, 1.0, 1, 1))))
    }
}
