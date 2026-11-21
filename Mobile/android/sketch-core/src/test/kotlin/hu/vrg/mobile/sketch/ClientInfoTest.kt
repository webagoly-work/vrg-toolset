package hu.vrg.mobile.sketch

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// F5 (WP M50, D-79): the client's contact is personal: in the file on the phone, out of every copy that leaves it unless
// kept, never in a variant request.
class ClientInfoTest {
    private val room = Room("R1", listOf(Pt(0.0, 0.0), Pt(100.0, 0.0), Pt(100.0, 80.0), Pt(0.0, 80.0)))
    private val base = Sketch("S1", name = "Próba", rooms = listOf(room), site = Site(address = "Fő u. 1"))
    private val filled = ClientInfo.set(base, "  Minta Ügyfél ", "+36 30 000 0000", "minta@example.com")

    @Test fun setTrimsAndBlankRemoves() {
        assertEquals(Client("Minta Ügyfél", "+36 30 000 0000", "minta@example.com"), filled.client)
        assertNull(ClientInfo.set(filled, " ", "", "").client)
        assertTrue(ClientInfo.set(ClientInfo.setKeep(filled, true), "Más", "", "").client!!.keep, "a re-typed contact keeps its keep flag")
        assertEquals(base, ClientInfo.setKeep(base, true), "no contact: nothing to keep")
        assertEquals("Minta Ügyfél · +36 30 000 0000 · minta@example.com", ClientInfo.line(filled.client))
        assertTrue(ClientInfo.emailLooksOk("") && ClientInfo.emailLooksOk("a@b.hu") && !ClientInfo.emailLooksOk("a@b"))
    }

    @Test fun theFileKeepsItAndAnOldFileOpensUnchanged() {
        val j = SketchJson.write(ClientInfo.setKeep(filled, true))
        assertTrue(org.json.JSONObject("""{"name":"Minta Ügyfél","phone":"+36 30 000 0000","email":"minta@example.com","keep":true}""").similar(j.getJSONObject("client")), j.toString())
        assertEquals(ClientInfo.setKeep(filled, true).client, SketchJson.read(j.toString())!!.client)
        assertFalse(SketchJson.write(base).has("client"), "no contact, no key: the file is as before")
        assertNull(SketchJson.read(SketchJson.write(base).toString())!!.client)
        assertFalse(SketchJson.write(filled).getJSONObject("client").has("keep"))
    }

    @Test fun whatLeavesThePhoneHasNoContactUnlessKept() {
        val out = ClientInfo.forExport(filled)
        assertNull(out.client); assertEquals(filled.copy(client = null), out)
        val pkg = PlannerExport.build(out).toString()
        assertFalse("Minta" in pkg || "example.com" in pkg || "\"client\"" in pkg)
        val kept = ClientInfo.forExport(ClientInfo.setKeep(filled, true))
        assertTrue("Minta Ügyfél" in PlannerExport.build(kept).getJSONObject("sketch").getJSONObject("client").toString())
        assertEquals(base, ClientInfo.forExport(base))
    }

    @Test fun neverInAVariantRequest() {
        val kept = ClientInfo.setKeep(filled, true)
        val r = VariantRequests.build(kept, Kit(), "Egy próba kérés.", emptyList(), emptyList(), 1L).toString()
        assertFalse("Minta" in r || "+36" in r || "example.com" in r || "client" in r, r)
    }
}
