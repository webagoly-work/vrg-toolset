package hu.vrg.mobile.sketch

import org.json.JSONObject
import java.io.File
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

// F4 (WP M49): a variant's `draw` block tunes the drawing tools; without one everything is as before.
class DrawTuneTest {
    private val repo = File(System.getProperty("vrg.repo") ?: "../..")
    private fun near(a: Double, b: Double) = abs(a - b) < 1e-6
    private fun assertPt(want: Pt, got: Pt, msg: String) = assertTrue(near(want.x, got.x) && near(want.y, got.y), "$msg: want $want, got $got")

    @Test fun parseKeepsOnlySaneValues() {
        assertTrue(Draw.parse(null).isDefault)
        val t = Draw.parse(JSONObject("""{"snapAngle":90,"snapGrid":1,"defaultRoom":{"w":30,"d":20},"measureFirst":true,"pointSnap":"free"}"""))
        assertEquals(DrawTune(90, 1.0, 30.0 to 20.0, true, true), t)
        val bad = Draw.parse(JSONObject("""{"snapAngle":37,"snapGrid":-2,"defaultRoom":{"w":0,"d":5},"pointSnap":"wall"}"""))
        assertTrue(bad.isDefault, "out-of-range values fall back to the original")
        assertEquals(listOf("Vonal: 90°-os lépés", "Rács: 1 m", "Koppintás = 30 × 20 m szoba", "Új szoba: rögtön a méret", "Pont: nem ugrik a falra"), t.describe())
    }

    @Test fun theOriginalLineLockIsUntouched() {
        val prev = Pt(0.0, 0.0)
        for (p in listOf(Pt(100.0, 5.0), Pt(100.0, 60.0), Pt(-3.0, 80.0))) assertEquals(Geo.axisLock(prev, p), Draw.lock(prev, p, DrawTune()))
    }

    @Test fun snapAngleTurnsTheSegment() {
        val prev = Pt(10.0, 10.0)
        val t90 = DrawTune(snapAngle = 90)
        assertPt(Pt(110.0, 10.0), Draw.lock(prev, Pt(110.0, 50.0), t90), "90°: 22° off the axis still lies on it")
        assertPt(Pt(10.0, 80.0), Draw.lock(prev, Pt(40.0, 80.0), t90), "90°: down")
        val t45 = DrawTune(snapAngle = 45)
        assertPt(Pt(60.0, 60.0), Draw.lock(prev, Pt(55.0, 65.0), t45), "45°: the diagonal")
        assertPt(prev, Draw.lock(prev, prev, t45), "no move")
    }

    @Test fun cornersLandOnTheGridUnlessANeighbourIsNear() {
        val t = DrawTune(snapGrid = 1.0)                 // 1 m at 25 mm / unit = 40 units
        assertEquals(40.0 to 40.0, Draw.grid(t, 25.0, 25.0))
        val empty = Sketch("D")
        assertPt(Pt(80.0, 40.0), Draw.corner(empty, Pt(93.0, 22.0), 5.0, t, 25.0, 25.0), "onto the grid")
        val s = empty.copy(rooms = listOf(Room("R1", listOf(Pt(0.0, 0.0), Pt(97.0, 0.0), Pt(97.0, 50.0), Pt(0.0, 50.0)))))
        assertPt(Pt(97.0, 40.0), Draw.corner(s, Pt(95.0, 30.0), 5.0, t, 25.0, 25.0), "x shares the neighbour's wall, y the grid")
        assertPt(Pt(93.0, 22.0), Draw.corner(empty, Pt(93.0, 22.0), 5.0, DrawTune(), 25.0, 25.0), "no grid: as given")
        assertEquals(80.0 to 40.0, Draw.grid(t, 12.5, 25.0), "after a measure the grid follows the scale")
    }

    @Test fun aTapLaysTheDefaultRoom() {
        val t = DrawTune(snapGrid = 1.0, defaultRoom = 30.0 to 20.0)
        val (a, b) = Draw.tapRoom(Sketch("D"), Pt(600.0, 400.0), 5.0, t, 25.0, 25.0)!!
        assertPt(Pt(0.0, 0.0), a, "centred, the corner on the grid"); assertPt(Pt(1200.0, 800.0), b, "30 × 20 m")
        assertNull(Draw.tapRoom(Sketch("D"), Pt(0.0, 0.0), 5.0, DrawTune(), 25.0, 25.0))
        val made = Ops.addRectRoom(Sketch("D"), a, b, 5.0)!!
        assertEquals(4, made.first.room(made.second)!!.poly.size)
    }

    @Test fun freePointsStayWhereTheyArePut() {
        val s = Sketch("D", rooms = listOf(Room("R1", listOf(Pt(0.0, 0.0), Pt(100.0, 0.0), Pt(100.0, 80.0), Pt(0.0, 80.0)))))
        val near = Pt(50.0, 4.0)
        val wall = Ops.addPoint(s, near, PointType.LIGHT, PointState.PLANNED, Draw.pointTol(DrawTune(), 10.0)).let { it.first.point(it.second)!! }
        val free = Ops.addPoint(s, near, PointType.LIGHT, PointState.PLANNED, Draw.pointTol(DrawTune(freePoints = true), 10.0)).let { it.first.point(it.second)!! }
        assertEquals(0.0, wall.at.y); assertEquals(0, wall.edge)
        assertEquals(near, free.at); assertNull(free.edge); assertEquals("R1", free.room)
    }

    @Test fun theVariantsCarryTheirDrawBlocks() {
        val v = File(repo, "Sketcher/variants").listFiles { f -> f.name.endsWith(".json") }!!.map { FieldKit.parseVariant(it.readText()) }.associateBy { it.id }
        val ip = v["ipari-telephely"]!!.draw
        assertEquals(90, ip.snapAngle); assertTrue(ip.snapGrid >= 1.0); assertTrue(ip.defaultRoom!!.first >= 20.0); assertTrue(ip.freePoints)
        assertTrue(!v["furdo-felujitas"]!!.draw.isDefault)
        assertEquals("auto", v["furdo-felujitas"]!!.draw.lineClose)
    }

    // F5 (WP M50, D-80): lineClose decides what the Vonal tool's Kész does with 3+ corners
    @Test fun lineCloseAutoOrAsk() {
        assertEquals("auto", Draw.parse(JSONObject("""{"lineClose":"auto"}""")).lineClose)
        assertEquals("ask", Draw.parse(JSONObject("""{"lineClose":"ask"}""")).lineClose)
        assertTrue(Draw.parse(JSONObject("""{"lineClose":"maybe","wallThickness":30}""")).isDefault, "a bad value and an unknown key: the original")
        assertEquals(Draw.LineDone.LINE, Draw.lineDone(DrawTune(), 5), "original: Kész leaves an open line")
        assertEquals(Draw.LineDone.ROOM, Draw.lineDone(DrawTune(lineClose = "auto"), 3))
        assertEquals(Draw.LineDone.ASK, Draw.lineDone(DrawTune(lineClose = "ask"), 4))
        assertEquals(Draw.LineDone.LINE, Draw.lineDone(DrawTune(lineClose = "auto"), 2), "two corners are never a room")
        assertEquals(10.0, Draw.closeTol(DrawTune(), 10.0)); assertEquals(20.0, Draw.closeTol(DrawTune(lineClose = "auto"), 10.0))
        assertEquals(listOf("Vonal: Kész = szoba"), DrawTune(lineClose = "auto").describe())
    }
}
