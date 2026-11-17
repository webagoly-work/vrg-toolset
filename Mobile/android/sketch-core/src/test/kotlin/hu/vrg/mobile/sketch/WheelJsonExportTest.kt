package hu.vrg.mobile.sketch

import org.json.JSONObject
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class WheelJsonExportTest {
    @Test fun wheelSectorsAreThePlannersNorthClockwise() {
        assertEquals(0, Wheels.sectorAt(0.0, -100.0, 30.0), "up = North = 0")
        assertEquals(2, Wheels.sectorAt(100.0, 0.0, 30.0), "right = East = 2")
        assertEquals(4, Wheels.sectorAt(0.0, 100.0, 30.0), "down = South = 4 (ring switch)")
        assertEquals(6, Wheels.sectorAt(-100.0, 0.0, 30.0))
        assertEquals(1, Wheels.sectorAt(70.0, -70.0, 30.0))
        assertNull(Wheels.sectorAt(10.0, 10.0, 30.0), "inside the hub: nothing")
    }

    @Test fun everyWheelHasEightSlotsAndSouthSwitchesRings() {
        val p = SketchPoint("P1", Pt(0.0, 0.0), PointType.SOCKET, PointState.EXISTING)
        val r = Room("R1", Geo.rect(Pt(0.0, 0.0), Pt(10.0, 10.0)), kinds = listOf("konyha"))
        listOf(Wheels.forPoint(p), Wheels.forRoom(r), Wheels.forEdge(r, 0), Wheels.forPaper(), Wheels.forOther("x", "J1"))
            .forEach { w -> w.rings.forEach { assertEquals(8, it.size, w.title) } }
        val pw = Wheels.forPoint(p)
        assertEquals(Wheels.MORE, pw.rings[0][4]!!.id); assertEquals(Wheels.BACK, pw.rings[1][4]!!.id)
        assertEquals("Tervezett", pw.rings[0][6]!!.label, "the state sector offers the other state")
        assertTrue(pw.rings[0].any { it?.id == "memo" }, "every node can get a memo from its wheel")
        val rw = Wheels.forRoom(r)
        assertEquals(4, rw.rings.size)
        assertEquals("kind:nappali", rw.rings[1][0]!!.id)
        assertEquals(Wheels.BACK, rw.rings[3][4]!!.id)
        assertEquals(2, Wheels.nextRing(rw, 1, rw.rings[1][4]!!)); assertEquals(0, Wheels.nextRing(rw, 3, rw.rings[3][4]!!))
        assertEquals("Konyha", rw.title)
        assertNull(Wheels.nextRing(rw, 0, rw.rings[0][0]!!))
    }

    /** The sketch the export tests use: two rooms, points, a circuit on an Elosztó, a route, memos and tags. */
    private fun field(): Sketch {
        var s = Sketch("V1", "Kossuth u. 12", Level.GROUND, created = 1, updated = 2)
        val (s1, a) = Ops.addRectRoom(s, Pt(0.0, 0.0), Pt(100.0, 80.0), 6.0)!!; s = s1
        val (s2, b) = Ops.addRectRoom(s, Pt(100.0, 0.0), Pt(150.0, 80.0), 6.0)!!; s = s2
        s = Ops.setMeasure(s, a, MeasureKind.WIDTH, 4000)
        s = Ops.setMeasure(s, a, MeasureKind.DEPTH, 3200)
        s = Ops.toggleKind(s, a, "nappali")
        val (s3, p1) = Ops.addPoint(s, Pt(50.0, 1.0), PointType.SOCKET, PointState.EXISTING, 6.0); s = s3
        val (s4, p2) = Ops.addPoint(s, Pt(99.0, 40.0), PointType.SWITCH, PointState.PLANNED, 6.0); s = s4
        val (s5, p3) = Ops.addPoint(s, Pt(50.0, 40.0), PointType.LIGHT, PointState.PLANNED, 6.0); s = s5
        val (s6, bd) = Ops.addPoint(s, Pt(149.0, 40.0), PointType.BOARD, PointState.PLANNED, 6.0); s = s6
        val (s7, _) = Ops.newCircuit(s, listOf(p1, p2, p3)); s = s7
        s = Ops.connectCircuits(s).first
        val (s8, _) = Ops.addRoute(s, listOf(s.point(p2)!!.at, Pt(70.0, 40.0), s.point(p3)!!.at), 6.0)!!; s = s8
        val (s9, _) = Ops.addMemo(s, Pt(55.0, 5.0), "régi, bontandó", p1)!!; s = s9
        s = Ops.placeTag(s, "T-ip44", p1, null)!!.first
        s = Ops.placeTag(s, "T-furdo", b, null)!!.first
        s = Ops.placeTag(s, "T-nedves", null, Pt(120.0, 60.0))!!.first
        return s.copy(photos = listOf(PhotoPoint("F99", Pt(50.0, 40.0), a, listOf(Shot(90, "R1-e.jpg", 5)))))
    }

    @Test fun theSketchFileRoundTrips() {
        val s = field()
        val back = SketchJson.read(SketchJson.write(s).toString())
        assertNotNull(back)
        assertEquals(s, back.copy(rooms = back.rooms, points = back.points))
        assertNull(SketchJson.read("{\"kind\":\"other\"}")); assertNull(SketchJson.read("not json"))
        assertEquals("kossuth-u-12", SketchJson.fileStem(s))
        assertEquals("arvizturo-tukorfurogep", SketchJson.fileStem(s.copy(name = "Árvíztűrő tükörfúrógép")))
    }

    @Test fun thePlannerPackageCarriesThePlanItsMarksAndTheRawSketch() {
        val s = field()
        val o = PlannerExport.build(s, now = 7)
        assertEquals("vrg-sketch", o.getString("kind"))
        assertNotNull(SketchJson.read(o.getJSONObject("sketch")), "the raw sketch reopens on the phone")
        val d = o.getJSONObject("plan").getJSONObject("data")
        val floors = d.getJSONArray("floors")
        assertEquals(2, floors.length())
        val f0 = floors.getJSONObject(0); val f1 = floors.getJSONObject(1)
        assertEquals("outline", f0.getString("stage")); assertTrue(f0.getBoolean("clear"))
        assertEquals("Nappali", f0.getString("name")); assertEquals("nappali", f0.getString("kind"))
        assertEquals(0, f0.getJSONObject("sk").getJSONArray("est").length(), "the measured room has no guess")
        assertTrue(f1.getJSONObject("sk").getJSONArray("est").length() == 2, "the neighbour's width is a guess")
        assertEquals("furdo", f1.getString("kind"), "the Fürdő tag became the room's kind")
        val dev = d.getJSONArray("devices")
        assertEquals(4, dev.length())
        val sock = dev.getJSONObject(0)
        assertEquals("socket", sock.getString("type")); assertEquals(300, sock.getInt("h"))
        assertEquals(2000, sock.getInt("x")); assertEquals(40, sock.getInt("y"), "40 mm in front of the top wall, inside")
        assertEquals("meglevo", sock.getJSONObject("sk").getString("st")); assertTrue(sock.getJSONObject("sk").getBoolean("ip44"))
        val light = dev.getJSONObject(2)
        assertEquals(2700, light.getInt("h"), "a free light is on the ceiling")
        assertEquals("board", dev.getJSONObject(3).getString("type"))
        val ck = d.getJSONArray("circuits").getJSONObject(0)
        assertEquals(3, ck.getJSONArray("members").length()); assertEquals(dev.getJSONObject(3).getString("id"), ck.getString("board"))
        assertTrue(ck.getString("col").matches(Regex("#[0-9a-f]{6}")))
        val path = d.getJSONArray("paths").getJSONObject(0)
        assertEquals(2700, path.getJSONArray("nodes").getJSONObject(0).getInt("h"))
        val sw = dev.getJSONObject(1)
        assertEquals(path.getString("id"), sw.getJSONArray("links").getJSONObject(0).getString("p"), "the route's tied end links the switch")
        val notes = d.getJSONArray("notes")
        assertEquals(2, notes.length()); assertEquals("#Nedves", notes.getJSONObject(1).getString("text"))
        val ids = mutableListOf<String>()
        listOf("floors", "devices", "circuits", "paths", "notes").forEach { k -> val a = d.getJSONArray(k); for (i in 0 until a.length()) ids += a.getJSONObject(i).getString("id") }
        assertEquals(ids.size, ids.toSet().size, "ids are unique")
        assertTrue(d.getInt("seq") >= ids.size)
        // the Planner's import test (spec-112) loads exactly this file
        System.getProperty("vrg.sketch.out")?.let { dir ->
            File(dir).mkdirs(); File(dir, "field.vsketch-pkg.json").writeText(o.toString(1))
        }
        assertEquals(o.toString(), JSONObject(o.toString()).toString())
        // the contract with the Planner: its spec-111 imports Planner/.../tests/sketch-field.json, which must be this
        System.getProperty("vrg.repo")?.let { repo ->
            val f = File(repo, "Planner/projects/varler-planner/tests/sketch-field.json")
            if (System.getProperty("vrg.sketch.fixture") == "update") f.writeText(o.toString(1) + "\n")
            assertTrue(f.exists() && JSONObject(f.readText()).similar(o),
                "Planner tests/sketch-field.json is not what the export writes now: VRG_SKETCH_FIXTURE=update gradlew :sketch-core:test")
        }
    }
}
