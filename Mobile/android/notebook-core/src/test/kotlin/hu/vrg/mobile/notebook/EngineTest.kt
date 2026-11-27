package hu.vrg.mobile.notebook

import java.io.File
import java.time.LocalDate
import java.time.ZoneId
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class EngineTest {
    private val zone = ZoneId.of("Europe/Budapest")
    private val dir = File(System.getProperty("vrg.repo") ?: "../..", "Mobile/notebook/kits")
    private val lib = Library(dir.listFiles { f -> f.name.endsWith(".json") }!!.map { Kits.parse(it.readText()).kit!! })
    private fun at(d: String, h: Int = 12) = LocalDate.parse(d).atTime(h, 0).atZone(zone).toInstant().toEpochMilli()
    private val now = at("2026-11-21", 18)
    private val on = Store(kitsOn = setOf("alap", "munka", "otthon", "kutya"))

    @Test fun numbersReadTheHungarianWay() {
        assertEquals("2", Engine.num(2.0)); assertEquals("2,5", Engine.num(2.5)); assertEquals("0,33", Engine.num(1.0 / 3))
    }

    @Test fun searchFoldsAccentsAndSeesFieldsTagsAndTypes() {
        val s = on.add(Entry("E1", "alap", "jegyzet", at("2026-11-20"), text = "Bojler csöpög a fürdőben", tags = listOf("sürgős")))
            .add(Entry("E2", "munka", "anyag", at("2026-11-21"), f = mapOf("nev" to Value.Text("NYM-J 3x2,5"), "db" to Value.Num(50.0))))
        assertEquals(listOf("E1"), Engine.search(s, lib, "csopog furdo").map { it.id })
        assertEquals(listOf("E1"), Engine.search(s, lib, "#surgos").map { it.id })
        assertEquals(listOf("E2"), Engine.search(s, lib, "nym-j anyag").map { it.id })
        assertTrue(Engine.search(s, lib, "   ").isEmpty())
    }

    @Test fun timelineGroupsByDayNewestFirst() {
        val s = on.add(Entry("A", "kutya", "seta", at("2026-11-19"), f = mapOf("perc" to Value.Num(20.0))))
            .add(Entry("B", "kutya", "seta", at("2026-11-21", 8), f = mapOf("perc" to Value.Num(30.0))))
            .add(Entry("C", "kutya", "seta", at("2026-11-21", 17), f = mapOf("perc" to Value.Num(45.0))))
        val kit = lib.kit("kutya")!!
        val r = Engine.view(s, lib, kit, kit.view("naplo")!!, zone, now)
        assertEquals(listOf("Ma", "november 19., csütörtök"), r.sections.map { it.title })
        assertEquals(listOf("C", "B"), r.sections[0].entries.map { it.id })
    }

    @Test fun tallyAddsUpByWeek() {
        val s = on.add(Entry("A", "kutya", "seta", at("2026-11-10"), f = mapOf("perc" to Value.Num(20.0))))
            .add(Entry("B", "kutya", "seta", at("2026-11-17"), f = mapOf("perc" to Value.Num(30.0))))
            .add(Entry("C", "kutya", "seta", at("2026-11-21"), f = mapOf("perc" to Value.Num(45.5))))
        val kit = lib.kit("kutya")!!
        val r = Engine.view(s, lib, kit, kit.view("setak")!!, zone, now)
        assertEquals(listOf("Ez a hét", "2026. 46. hét"), r.sections.map { it.title })
        assertEquals(75.5, r.sections[0].sum); assertEquals("perc", r.sections[0].unit); assertEquals(2, r.sections[0].count)
    }

    @Test fun tallyByFieldSortsByTheSum() {
        val s = on.add(Entry("A", "munka", "anyag", at("2026-11-20"), f = mapOf("nev" to Value.Text("Dugalj"), "db" to Value.Num(4.0))))
            .add(Entry("B", "munka", "anyag", at("2026-11-21"), f = mapOf("nev" to Value.Text("Kábel"), "db" to Value.Num(50.0))))
            .add(Entry("C", "munka", "anyag", at("2026-11-21"), f = mapOf("nev" to Value.Text("dugalj"), "db" to Value.Num(2.0))))
        val kit = lib.kit("munka")!!
        val r = Engine.view(s, lib, kit, kit.view("anyagok")!!, zone, now)
        assertEquals(listOf(50.0, 6.0), r.sections.map { it.sum })
    }

    @Test fun checklistPutsTheEarliestDueFirstAndDoneLast() {
        val k = { id: String, d: String?, done: Boolean -> Entry(id, "otthon", "karbantartas", at("2026-11-01"), done = done,
            f = buildMap { put("mit", Value.Text(id)); d?.let { put("kovetkezo", Value.Text(it)) } }) }
        val s = on.add(k("late", "2026-12-20", false)).add(k("none", null, false)).add(k("soon", "2026-11-25", false)).add(k("ok", "2026-11-01", true))
        val kit = lib.kit("otthon")!!
        val r = Engine.view(s, lib, kit, kit.view("karbantartas")!!, zone, now)
        assertEquals(listOf("soon", "late", "none"), r.sections[0].entries.map { it.id })
        assertEquals(listOf("ok"), r.sections[1].entries.map { it.id })
    }

    @Test fun openItemsAreDerived() {
        val s = on
            .add(Entry("M", "munka", "szigeteles", at("2026-11-21"), f = mapOf("aramkor" to Value.Text("F3"), "ertek" to Value.Num(0.4))))
            .add(Entry("R", "munka", "rcd", at("2026-11-21"), f = mapOf("ertek" to Value.Num(25.0))))
            .add(Entry("D", "otthon", "karbantartas", at("2026-11-01"), f = mapOf("mit" to Value.Text("Kazán"), "kovetkezo" to Value.Text("2026-11-15"))))
            .add(Entry("O", "alap", "jegyzet", at("2026-11-21"), text = "Kérdezd meg a fázist", open = true))
            .add(Entry("W", "kutya", "seta", at("2026-11-20"), f = mapOf("perc" to Value.Num(30.0))))
        val items = Engine.open(s, lib, zone, now)
        val keys = items.map { it.key }
        assertTrue("limit:M:ertek" in keys, keys.toString())
        assertTrue("miss:R:aramkor" in keys)
        assertTrue("limit:R:ertek" !in keys, "25 ms is under 300 ms")
        assertTrue("due:D:kovetkezo" in keys)
        assertTrue("open:O" in keys)
        assertTrue(keys.any { it.startsWith("stale:kutya:napi-seta:") }, "no walk today")
        assertTrue(keys.any { it.startsWith("stale:otthon:havi-ora:") }, "no meter reading yet")
        assertEquals(OpenKind.DUE, items.first().kind, "due first")
        val detail = items.first { it.key == "limit:M:ertek" }.detail
        assertEquals("Mért érték: 0,4 MΩ, legalább 1 MΩ kell", detail)
    }

    @Test fun offKitsAndDismissedItemsStayQuiet() {
        val s = Store().add(Entry("W", "kutya", "seta", at("2026-11-01"), f = emptyMap()))
        assertTrue(Engine.open(s, lib, zone, now).none { it.kit == "kutya" })
        val on2 = s.setKit("kutya", true)
        val key = Engine.open(on2, lib, zone, now).first { it.kind == OpenKind.MISSING }.key
        assertTrue(Engine.open(on2.dismiss(key), lib, zone, now).none { it.key == key })
    }

    @Test fun aNoteCanBecomeAnotherKitsType() {
        val s = on.add(Entry("N", "alap", "jegyzet", at("2026-11-21"), text = "Elromlott a bojler, nem működik"))
        val sug = Engine.open(s, lib, zone, now).filter { it.kind == OpenKind.SUGGEST && it.entryId == "N" }
        val toType = sug.first { it.toType != null }
        assertEquals("otthon" to "karbantartas", toType.toKit to toType.toType)
        val after = Engine.apply(s, toType, now)
        assertEquals("otthon", after.byId("N")!!.kit)
        assertTrue(Engine.open(after, lib, zone, now).none { it.key == toType.key })
        val tag = Engine.open(on.add(Entry("T", "alap", "jegyzet", at("2026-11-21"), text = "Elfogyott a kötődoboz")), lib, zone, now)
            .first { it.tag == "beszerezni" }
        assertEquals(listOf("beszerezni"), Engine.apply(on.add(Entry("T", "alap", "jegyzet", at("2026-11-21"), text = "x")), tag, now).byId("T")!!.tags)
    }

    @Test fun oldNotesGetNoSuggestions() {
        val s = on.add(Entry("N", "alap", "jegyzet", at("2026-10-01"), text = "Elromlott a bojler"))
        assertTrue(Engine.suggestions(s, lib, zone, now).isEmpty())
    }
}
