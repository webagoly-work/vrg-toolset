package hu.vrg.mobile.sketch

import org.json.JSONObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

// F4 (WP M49): the client's wants by room. The job total stays `scope`; a room holds part of it; the rest is Általános.
class WantsTest {
    private fun box(x: Double) = listOf(Pt(x, 0.0), Pt(x + 100, 0.0), Pt(x + 100, 80.0), Pt(x, 80.0))
    private val two = Sketch("W", rooms = listOf(Room("R1", box(0.0), "Konyha", listOf("konyha")), Room("R2", box(100.0), "", listOf("furdo"))))

    @Test fun addingInARoomRaisesTheTotal() {
        var s = Wants.add(two, "dugalj", "R1", +1)
        s = Wants.add(s, "dugalj", "R1", +1)
        s = Wants.add(s, "dugalj", null, +1)
        assertEquals(3, s.scope["dugalj"])
        assertEquals(mapOf("R1" to mapOf("dugalj" to 2)), s.roomScope)
        assertEquals(1, Wants.general(s, "dugalj"))
        assertEquals(2, Wants.inRoom(s, "R1", "dugalj"))
    }

    @Test fun fewerNeverGoesBelowWhatThePlaceHolds() {
        var s = Wants.add(two, "dugalj", "R1", +2)
        assertEquals(s, Wants.add(s, "dugalj", null, -1), "Általános holds nothing: no change")
        assertEquals(s, Wants.add(s, "dugalj", "R2", -1), "R2 holds nothing: no change")
        s = Wants.add(s, "dugalj", "R1", -1)
        assertEquals(1, s.scope["dugalj"]); assertEquals(1, Wants.inRoom(s, "R1", "dugalj"))
        s = Wants.add(s, "dugalj", "R1", -1)
        assertNull(s.scope["dugalj"]); assertTrue(s.roomScope.isEmpty())
    }

    @Test fun relinkingKeepsTheTotal() {
        var s = Wants.add(Wants.add(two, "lampa", null, +2), "lampa", "R1", +1)
        s = Wants.move(s, "lampa", null, "R2")            // one from Általános into the bathroom
        assertEquals(3, s.scope["lampa"]); assertEquals(1, Wants.general(s, "lampa")); assertEquals(1, Wants.inRoom(s, "R2", "lampa"))
        s = Wants.move(s, "lampa", "R1", "R2", 5)         // more than R1 has: all it has
        assertEquals(2, Wants.inRoom(s, "R2", "lampa")); assertEquals(0, Wants.inRoom(s, "R1", "lampa"))
        s = Wants.move(s, "lampa", "R2", null)            // back to the job
        assertEquals(3, s.scope["lampa"]); assertEquals(2, Wants.general(s, "lampa"))
        assertEquals(s, Wants.move(s, "lampa", "R1", "R1"))
    }

    @Test fun thePlainStepperTakesBackFromTheLastRoomFirst() {
        var s = Wants.add(Wants.add(Wants.add(two, "dugalj", "R1", +2), "dugalj", "R2", +2), "dugalj", null, +1)   // 5 = 2 + 2 + 1
        s = Intake.setScope(s, "dugalj", 4)               // the general one goes first: rooms still 4
        assertEquals(mapOf("R1" to mapOf("dugalj" to 2), "R2" to mapOf("dugalj" to 2)), s.roomScope)
        s = Intake.setScope(s, "dugalj", 3)               // now a room gives back: the last one
        assertEquals(1, Wants.inRoom(s, "R2", "dugalj")); assertEquals(2, Wants.inRoom(s, "R1", "dugalj")); assertEquals(0, Wants.general(s, "dugalj"))
        s = Intake.setScope(s, "dugalj", 0)
        assertNull(s.scope["dugalj"]); assertTrue(s.roomScope.isEmpty())
    }

    @Test fun aDeletedRoomCountsAsGeneralAndUndoBringsItBack() {
        val s = Wants.add(Wants.add(two, "dugalj", "R2", +2), "dugalj", "R1", +1)
        val gone = Ops.delete(s, "R2")
        assertEquals(3, Wants.total(gone, "dugalj")); assertEquals(2, Wants.general(gone, "dugalj"))
        assertEquals(listOf(null to listOf("dugalj" to 2)), Wants.byRoom(Kit(scope = listOf(KScope("dugalj", "Dugalj", "⏚", "igeny", true))), gone).filter { it.first == null })
        assertEquals(2, Wants.inRoom(s, "R2", "dugalj"), "the entry is still in the file")
    }

    @Test fun theFileKeepsItAndAnOldFileOpensUnchanged() {
        val s = Wants.add(Wants.add(two, "dugalj", "R1", +2), "lampa", null, +1)
        val j = SketchJson.write(s)
        assertEquals("""{"R1":{"dugalj":2}}""", j.getJSONObject("roomScope").toString())
        val back = SketchJson.read(j.toString())!!
        assertEquals(s.roomScope, back.roomScope); assertEquals(s.scope, back.scope)
        // a survey without room wants writes no key, and an old v2 file reads with none
        assertFalse(SketchJson.write(two.copy(scope = mapOf("dugalj" to 3))).has("roomScope"))
        val old = SketchJson.write(two.copy(scope = mapOf("dugalj" to 3))).also { it.remove("roomScope") }
        val r = SketchJson.read(old.toString())!!
        assertTrue(r.roomScope.isEmpty()); assertEquals(3, Wants.general(r, "dugalj"))
    }

    @Test fun aTotalSmallerThanItsRoomsIsRaisedOnRead() {
        val j = SketchJson.write(two)
        j.put("scope", JSONObject().put("dugalj", 1)).put("roomScope", JSONObject().put("R1", JSONObject().put("dugalj", 3)).put("R2", JSONObject().put("lampa", 0)))
        val s = SketchJson.read(j.toString())!!
        assertEquals(3, s.scope["dugalj"]); assertEquals(mapOf("R1" to mapOf("dugalj" to 3)), s.roomScope)
    }

    @Test fun thePlannerPackageCarriesTheRoomsWants() {
        val s = Wants.add(Wants.add(two, "dugalj", "R1", +2), "dugalj", null, +1)
        val p = PlannerExport.build(s)
        val floors = p.getJSONObject("plan").getJSONObject("data").getJSONArray("floors")
        val kitchen = (0 until floors.length()).map { floors.getJSONObject(it) }.first { it.getJSONObject("sk").getString("id") == "R1" }
        assertEquals(2, kitchen.getJSONObject("sk").getJSONObject("wants").getInt("dugalj"))
        val w = p.getJSONObject("plan").getJSONArray("wants").getJSONObject(0)
        assertEquals("dugalj", w.getString("id")); assertEquals(3, w.getInt("total")); assertEquals(1, w.getInt("general")); assertEquals(2, w.getJSONObject("rooms").getInt("R1"))
        assertFalse(PlannerExport.build(two).getJSONObject("plan").has("wants"), "no room wants: the package is as before")
        assertEquals(1, p.getJSONObject("sketch").getJSONObject("scope").length())
    }
}
