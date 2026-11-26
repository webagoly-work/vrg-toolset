package hu.vrg.mobile.notebook

import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

// Every bundled kit (Mobile/notebook/kits) must parse with no errors, and the parser must refuse what it should.
class KitTest {
    private val dir = File(System.getProperty("vrg.repo") ?: "../..", "Mobile/notebook/kits")

    @Test fun bundledKitsAllParse() {
        val files = dir.listFiles { f -> f.name.endsWith(".json") }!!.sortedBy { it.name }
        assertTrue(files.size >= 4, "kits found: ${files.map { it.name }}")
        files.forEach { f ->
            val p = Kits.parse(f.readText())
            assertTrue(p.ok, "${f.name}: ${p.errors}")
            assertEquals(f.nameWithoutExtension, p.kit!!.id, "${f.name}: the file is named after the kit id")
            assertTrue(p.warnings.isEmpty(), "${f.name}: ${p.warnings}")
        }
        val base = Kits.parse(File(dir, "alap.json").readText()).kit!!
        assertNotNull(base.type(Kits.NOTE_TYPE))
    }

    @Test fun limitsAndDueAreRead() {
        val munka = Kits.parse(File(dir, "munka.json").readText()).kit!!
        assertEquals(1.0, munka.type("szigeteles")!!.field("ertek")!!.min)
        assertEquals(300.0, munka.type("rcd")!!.field("ertek")!!.max)
        val otthon = Kits.parse(File(dir, "otthon.json").readText()).kit!!
        assertTrue(otthon.type("karbantartas")!!.field("kovetkezo")!!.due)
        assertEquals(GroupBy.Field("ora"), otthon.view("orak")!!.by)
    }

    private fun kit(body: String) = Kits.parse("""{"kind":"vrg-fuzet-kit","v":1,"id":"proba","name":"Próba",$body}""")

    @Test fun refusesBrokenKits() {
        assertTrue(kit(""""types":[]""").errors.any { it.startsWith("types") })
        assertTrue(kit(""""types":[{"id":"a","fields":[{"id":"x","kind":"choice"}]}]""").errors.any { "options" in it })
        assertTrue(kit(""""types":[{"id":"a","fields":[{"id":"x","kind":"text","due":true}]}]""").errors.any { "due" in it })
        assertTrue(kit(""""types":[{"id":"a","fields":[{"id":"x","kind":"text","min":1}]}]""").errors.any { "min/max" in it })
        assertTrue(kit(""""types":[{"id":"a","fields":[]}],"views":[{"id":"v","kind":"tally","sum":"x"}]""").errors.any { "sum" in it })
        assertTrue(kit(""""types":[{"id":"a","fields":[]}],"views":[{"id":"v","kind":"checklist"}]""").errors.any { "pipálható" in it })
        assertTrue(kit(""""types":[{"id":"a","fields":[]}],"rules":[{"id":"r","kind":"stale","type":"b","days":1}]""").errors.any { "rules" in it })
        assertTrue(kit(""""types":[{"id":"a","fields":[]}],"keywords":[{"id":"k","re":"(","suggest":{"tag":"t"}}]""").errors.any { "hibás" in it })
        assertTrue(Kits.parse("""{"kind":"vrg-fuzet-kit","v":2,"id":"x","name":"X","types":[{"id":"a"}]}""").errors.any { it.startsWith("v:") })
        assertTrue(Kits.parse("nem json").errors.isNotEmpty())
    }

    @Test fun aKitWithoutViewsGetsTheLog() {
        val p = kit(""""types":[{"id":"a","fields":[]}]""")
        assertTrue(p.ok, p.errors.toString())
        assertEquals(ViewKind.TIMELINE, p.kit!!.views.single().kind)
        assertTrue(p.warnings.isNotEmpty())
    }
}
