package hu.vrg.mobile.sketch

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class OpsTest {
    private fun twoRooms(): Triple<Sketch, String, String> {
        val (s1, a) = Ops.addRectRoom(Sketch("S"), Pt(0.0, 0.0), Pt(100.0, 80.0), 6.0)!!
        val (s2, b) = Ops.addRectRoom(s1, Pt(104.0, 3.0), Pt(170.0, 78.0), 6.0)!!
        return Triple(s2, a, b)
    }

    @Test fun aNeighbourSnapsOntoTheSharedWall() {
        val (s, _, b) = twoRooms()
        val r = s.room(b)!!
        assertEquals(100.0, r.poly.minOf { it.x }); assertEquals(0.0, r.poly.minOf { it.y }); assertEquals(80.0, r.poly.maxOf { it.y })
        assertNull(Ops.addRectRoom(s, Pt(300.0, 300.0), Pt(310.0, 360.0), 6.0), "a 10-unit sliver is a slip")
        assertEquals(listOf("R1", "R2"), s.rooms.map { it.id })
    }

    @Test fun aClosedLineoutBecomesARoomACrossedOneDoesNot() {
        val ok = Ops.addPolyRoom(Sketch("S"), listOf(Pt(0.0, 0.0), Pt(100.0, 0.0), Pt(100.0, 60.0), Pt(0.0, 60.0)))
        assertNotNull(ok)
        val bow = Ops.addPolyRoom(Sketch("S"), listOf(Pt(0.0, 0.0), Pt(100.0, 60.0), Pt(100.0, 0.0), Pt(0.0, 60.0)))
        assertNull(bow)
        assertEquals(Pt(80.0, 0.0), Geo.axisLock(Pt(0.0, 0.0), Pt(80.0, 9.0)), "a nearly flat segment is laid flat")
        assertEquals(Pt(80.0, 40.0), Geo.axisLock(Pt(0.0, 0.0), Pt(80.0, 40.0)), "a real diagonal stays")
    }

    @Test fun pointsSitOnWallsAndFollowThem() {
        val (s0, a, _) = twoRooms()
        val (s1, p) = Ops.addPoint(s0, Pt(50.0, 3.0), PointType.SOCKET, PointState.EXISTING, 6.0)
        val pt = s1.point(p)!!
        assertEquals(a, pt.room); assertEquals(0, pt.edge); assertEquals(Pt(50.0, 0.0), pt.at)
        val moved = Ops.moveVertex(s1, a, 1, Pt(120.0, 0.0), 1.0)              // the top-right corner further right
        assertEquals(Pt(60.0, 0.0), moved.point(p)!!.at, "half way along the stretched wall")
        val free = Ops.addPoint(s1, Pt(50.0, 40.0), PointType.LIGHT, PointState.PLANNED, 6.0)
        assertNull(free.first.point(free.second)!!.edge); assertEquals(a, free.first.point(free.second)!!.room)
        val shifted = Ops.moveRoom(s1, a, Pt(10.0, 10.0))
        assertEquals(Pt(60.0, 10.0), shifted.point(p)!!.at)
    }

    @Test fun aPointIsInOneCircuitAndTheBoardInNone() {
        var (s, _, _) = twoRooms()
        val (s1, p1) = Ops.addPoint(s, Pt(10.0, 1.0), PointType.SOCKET, PointState.PLANNED, 6.0); s = s1
        val (s2, p2) = Ops.addPoint(s, Pt(20.0, 1.0), PointType.SOCKET, PointState.PLANNED, 6.0); s = s2
        val (s3, bd) = Ops.addPoint(s, Pt(1.0, 40.0), PointType.BOARD, PointState.PLANNED, 6.0); s = s3
        val (s4, k1) = Ops.newCircuit(s, listOf(p1, p2, bd)); s = s4
        assertEquals(listOf(p1, p2), s.circuit(k1)!!.members, "the Elosztó never joins")
        val (s5, k2) = Ops.newCircuit(s); s = s5
        s = Ops.toggleMember(s, k2, p2)
        assertEquals(listOf(p1), s.circuit(k1)!!.members); assertEquals(listOf(p2), s.circuit(k2)!!.members)
        assertTrue(s.circuit(k1)!!.color != s.circuit(k2)!!.color)
        val (c, n) = Ops.connectCircuits(s)
        assertEquals(2, n); assertTrue(c.circuits.all { it.board == bd })
        val del = Ops.delete(c, bd)
        assertTrue(del.circuits.all { it.board == null }, "deleting the Elosztó unhooks its circuits")
    }

    @Test fun routesTieTheirEndsToPoints() {
        var (s, _, _) = twoRooms()
        val (s1, p1) = Ops.addPoint(s, Pt(10.0, 1.0), PointType.SWITCH, PointState.PLANNED, 6.0); s = s1
        val (s2, p2) = Ops.addPoint(s, Pt(90.0, 79.0), PointType.LIGHT, PointState.PLANNED, 6.0); s = s2
        val stroke = (0..40).map { i -> Pt(12.0 + i * 2, 3.0 + i * 1.9) }
        val (s3, r) = Ops.addRoute(s, stroke, 8.0)!!; s = s3
        val route = s.route(r)!!
        assertEquals(p1, route.a); assertEquals(p2, route.b)
        assertEquals(s.point(p1)!!.at, route.pts.first()); assertEquals(s.point(p2)!!.at, route.pts.last())
        assertTrue(route.pts.size <= 4, "a straight stroke is simplified to its ends: ${route.pts.size}")
        s = Ops.movePoint(s, p2, Pt(70.0, 79.0), 6.0)
        assertEquals(Pt(70.0, 80.0), s.route(r)!!.pts.last(), "the tied end follows the point")
    }

    @Test fun memosAndTagsPinToRecordsAndGoWithThem() {
        var (s, a, _) = twoRooms()
        val (s1, m) = Ops.addMemo(s, Pt(30.0, 30.0), "  régi vezeték a parkett alatt ", a)!!; s = s1
        assertEquals("régi vezeték a parkett alatt", s.memo(m)!!.text)
        assertNull(Ops.addMemo(s, Pt(0.0, 0.0), "   "))
        val (s2, u) = Ops.placeTag(s, "T-furdo", a, null)!!; s = s2
        assertEquals(u, Ops.placeTag(s, "T-furdo", a, null)!!.second, "once per record")
        val (s3, t) = Ops.addTag(s, "Padlófűtés")!!; s = s3
        assertEquals(t, Ops.addTag(s, "padlófűtés")!!.second, "names are unique, case aside")
        val (s4, loose) = Ops.placeTag(s, t, null, Pt(500.0, 500.0))!!; s = s4
        assertEquals(Pt(500.0, 500.0), s.tagUse(loose)!!.at)
        val gone = Ops.delete(s, a)
        assertTrue(gone.memos.isEmpty() && gone.tagUses.none { it.target == a }, "a room's memo and tag go with it")
        assertEquals(1, gone.tagUses.size)
    }

    @Test fun measuresReplaceAndRemove() {
        var (s, a, _) = twoRooms()
        s = Ops.setMeasure(s, a, MeasureKind.WIDTH, 4000)
        s = Ops.setMeasure(s, a, MeasureKind.WIDTH, 4100)
        assertEquals(1, s.measures.size); assertEquals(4100, s.measures[0].mm)
        s = Ops.setMeasure(s, a, MeasureKind.EDGE, 3000, edge = 1)
        assertEquals(2, s.measures.size)
        s = Ops.setMeasure(s, a, MeasureKind.WIDTH, 0)
        assertEquals(listOf(MeasureKind.EDGE), s.measures.map { it.kind })
    }

    @Test fun hitFindsTheSmallThingFirst() {
        var (s, a, b) = twoRooms()
        val (s1, p) = Ops.addPoint(s, Pt(50.0, 1.0), PointType.SOCKET, PointState.PLANNED, 6.0); s = s1
        assertEquals(Hit(Hit.Kind.POINT, p), Ops.hit(s, Pt(51.0, 2.0), 8.0))
        assertEquals(Hit.Kind.ROOM_EDGE, Ops.hit(s, Pt(20.0, 2.0), 8.0)!!.kind)
        assertEquals(Hit(Hit.Kind.ROOM, a), Ops.hit(s, Pt(40.0, 40.0), 8.0))
        assertEquals(Hit(Hit.Kind.ROOM_EDGE, b, vertex = 2), Ops.hit(s, Pt(169.0, 79.0), 8.0))
        assertNull(Ops.hit(s, Pt(400.0, 400.0), 8.0))
        assertEquals(listOf(p), Ops.pointsIn(s, Pt(0.0, 0.0), Pt(60.0, 10.0)))
    }

    @Test fun pluginsBuildTheRail() {
        assertEquals(listOf("select", "memo", "tag", "room", "line", "measure", "point", "circuit", "board", "route"),
            Plugins.rail(Plugins.DEFAULT_ON).map { it.id })
        val noElectric = Plugins.toggle(Plugins.DEFAULT_ON, Plugins.ELECTRIC.id)
        assertEquals(listOf("select", "memo", "tag", "room", "line", "measure"), Plugins.rail(noElectric).map { it.id })
        assertEquals(noElectric, Plugins.toggle(noElectric, Plugins.NOTE.id), "the note taker stays")
        assertEquals(noElectric, Plugins.toggle(noElectric, Plugins.PHOTO.id), "a planned plugin cannot be switched on yet")
        assertEquals(Plugins.DEFAULT_ON, Plugins.toggle(noElectric, Plugins.ELECTRIC.id), "back in catalogue order")
    }
}
