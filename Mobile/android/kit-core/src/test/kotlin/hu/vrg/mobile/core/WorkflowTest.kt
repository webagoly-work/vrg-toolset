package hu.vrg.mobile.core

import org.json.JSONObject
import java.io.File
import java.security.interfaces.ECPublicKey
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// WP M42: the Workflow Kit's sealed pack. The PC seals in Node (tools/workflow-seal.js), the phone opens here.
class WorkflowTest {
    private val repo = File(System.getProperty("vrg.repo") ?: "../..")

    private val pack = """{"t":"vrg-wk-pack","v":1,"made":"2026-11-20T10:00:00Z","from":"PC","jobs":[
        {"code":"TST1","folder":"TST1_proba","title":"proba","updated":"2026-11-19T08:00:00Z","address":"Teszt utca 1.",
         "steps":{"funnel":true,"takeoff":true,"price":true,"offer":false,"doc":false},
         "variants":[{"key":"A","labour":850000,"material":420000,"hours":96,"days":[4,6],"m2":62.5}],
         "docs":[{"name":"ARAJANLAT.md","text":"# Árajánlat"}],"files":[{"name":"job/offer.json","size":120}]},
        {"code":"","title":"no code: dropped"}]}"""

    @Test fun roundTripOnTheJvm() {
        val me = DeviceTrust.newKeyPair()
        val pub = DeviceTrust.jwk(me.public as ECPublicKey)
        val s = Workflow.seal(pack, "6CDB-FB09-6833", pub, "2026-11-20T10:00:00Z", 1)
        assertEquals("6CDBFB096833", s.to)
        val again = WkSealed.parse(s.toJson().toString())!!
        assertEquals(pack, Workflow.open(again, "6cdbfb096833", me.private))
        assertFalse(s.toJson().toString().contains("Teszt"))
    }

    @Test fun anotherPhoneOrAChangeIsRefused() {
        val me = DeviceTrust.newKeyPair()
        val other = DeviceTrust.newKeyPair()
        val s = Workflow.seal(pack, "PHONE00001", DeviceTrust.jwk(me.public as ECPublicKey), "t", 1)
        assertFailsWith<IllegalArgumentException> { Workflow.open(s, "PHONE00002", me.private) }
        assertFailsWith<Exception> { Workflow.open(s, "PHONE00001", other.private) }
        // the id is bound in as additional data: relabelling the envelope does not help another phone
        assertFailsWith<Exception> { Workflow.open(s.copy(to = "PHONE00002"), "PHONE00002", me.private) }
        val ct = B64.dec(s.ct)!!.also { it[3] = (it[3].toInt() xor 1).toByte() }
        assertFailsWith<Exception> { Workflow.open(s.copy(ct = B64.enc(ct)), "PHONE00001", me.private) }
    }

    @Test fun nodeSealsWhatThePhoneOpens() {
        // written by Mobile/tests/workflow-seal.js --fixture with Node's WebCrypto through tools/workflow-seal.js
        val f = JSONObject(File(repo, "Mobile/tests/fixtures/workflow-sealed.json").readText())
        val s = WkSealed.parse(f.getJSONObject("sealed").toString())
        assertNotNull(s)
        val p = Workflow.parsePack(Workflow.open(s, f.getString("id"), DeviceTrust.privateFrom(f.getString("privatePkcs8"))))
        assertNotNull(p)
        val e = f.getJSONObject("expect")
        assertEquals(e.getInt("jobs"), p.jobs.size)
        val j = p.jobs.first { it.code == e.getString("code") }
        assertEquals(e.getString("title"), j.title)
        assertEquals(e.getLong("totalA"), j.variants.first { it.key == "A" }.total)
        assertEquals(e.getLong("labourB"), j.variants.first { it.key == "B" }.labour)
        assertEquals(e.getInt("docs"), j.docs.size)
        assertEquals("Dokumentum", j.stage)
        // the code the phone shows (Workflow.keyFile) is the one the PC checks (workflow-seal.js codeOf)
        val pub = Jwk.parse(f.getJSONObject("pub"))!!
        assertEquals(f.getString("code"), Workflow.keyFile(f.getString("id"), "t", pub, "").code)
    }

    @Test fun thePack() {
        val p = Workflow.parsePack(pack)!!
        assertEquals(1, p.jobs.size)
        val j = p.jobs[0]
        assertEquals(setOf("funnel", "takeoff", "price"), j.steps)
        assertEquals("Árazás", j.stage)
        val v = j.variants[0]
        assertEquals(1_270_000L, v.total)
        assertEquals("96 eó · 4–6 nap · 62,5 m²", Workflow.effort(v))
        assertEquals("1 270 000 Ft", Workflow.ft(1_270_000))
        assertEquals("950 Ft", Workflow.ft(950))
        assertNull(Workflow.parsePack("""{"t":"other","v":1}"""))
        assertNull(Workflow.parsePack("not json"))
    }

    @Test fun keyFiles() {
        val kp = DeviceTrust.newKeyPair()
        val pub = DeviceTrust.jwk(kp.public as ECPublicKey)
        val k = Workflow.keyFile("6CDB-FB09-6833", " Redmi ", pub, "2026-11-20")
        assertEquals("6CDBFB096833", k.id)
        assertEquals("Redmi", k.name)
        assertEquals(DeviceTrust.code("6CDBFB096833", pub), k.code)
        assertEquals(k, WkKey.parse(k.toJson().toString()))
        assertEquals("keys/6CDBFB096833.json", Workflow.keyPath("6cdb-fb09-6833"))
        assertEquals("sealed/6CDBFB096833.json", Workflow.sealedPath("6CDB-FB09-6833"))
        assertNull(WkKey.parse("""{"t":"vrg-wk-key","id":"x","pub":{}}"""))
    }

    @Test fun theCatalogueEntryIsBeta() {
        assertEquals(Stage.BETA, Catalogue.WORKFLOW.stage)
        assertEquals("workflow", Catalogue.WORKFLOW.id)
        assertTrue(Need.GITHUB in Catalogue.WORKFLOW.needs)
    }

    private fun assertFalse(b: Boolean) = assertTrue(!b)
}
