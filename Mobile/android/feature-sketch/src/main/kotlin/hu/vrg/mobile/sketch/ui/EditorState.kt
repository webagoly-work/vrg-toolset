package hu.vrg.mobile.sketch.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import hu.vrg.mobile.sketch.Geo
import hu.vrg.mobile.sketch.Hit
import hu.vrg.mobile.sketch.Level
import hu.vrg.mobile.sketch.MeasureKind
import hu.vrg.mobile.sketch.Norm
import hu.vrg.mobile.sketch.Ops
import hu.vrg.mobile.sketch.Plugins
import hu.vrg.mobile.sketch.PointState
import hu.vrg.mobile.sketch.PointType
import hu.vrg.mobile.sketch.Pt
import hu.vrg.mobile.sketch.Sketch
import hu.vrg.mobile.sketch.Solver
import hu.vrg.mobile.sketch.Tool
import hu.vrg.mobile.sketch.Tools
import hu.vrg.mobile.sketch.Wheel
import hu.vrg.mobile.sketch.WheelItem
import hu.vrg.mobile.sketch.Wheels
import kotlin.math.max
import kotlin.math.min

/** The wheel on screen: which wheel, where (canvas px), which ring, the sector under the finger, what it is for. */
data class WheelUi(val wheel: Wheel, val center: Offset, val ring: Int, val sel: Int?, val at: Pt, val hit: Hit?, val sticky: Boolean)

/** What a dialog is asked for. */
sealed class Ask {
    data class MemoNew(val at: Pt, val target: String?) : Ask()
    data class MemoEdit(val id: String) : Ask()
    data class MeasureEdge(val room: String, val edge: Int) : Ask()
    data class MeasureRoom(val room: String) : Ask()
    data class RoomName(val room: String) : Ask()
    data class TagPick(val target: String?, val at: Pt?) : Ask()
    data class CircuitEdit(val id: String) : Ask()
    object SketchName : Ask()
    object PluginSheet : Ask()
}

/**
 * The editor: the sketch with its undo history, the view (pan / zoom), the active tool and its brushes, and the
 * gesture in progress. The canvas sends it taps, drags, holds and pinches in canvas pixels; it turns them into
 * sketch-core operations. Every change goes through [edit], which re-solves the sizes (cheap: a few rooms) so the
 * room labels show measured / derived / ≈ guessed sizes live, and hands the sketch to [onChange] for saving.
 */
class EditorState(initial: Sketch, private val onChange: (Sketch) -> Unit) {
    private val solver = Solver()

    var sketch by mutableStateOf(initial); private set
    var norm: Norm by mutableStateOf(solver.solve(initial)); private set
    private val undo = ArrayDeque<Sketch>()
    private val redo = ArrayDeque<Sketch>()
    var canUndo by mutableStateOf(false); private set
    var canRedo by mutableStateOf(false); private set

    var tool by mutableStateOf(if (initial.isEmpty) Tools.ROOM else Tools.SELECT); private set
    private var previousTool: Tool = Tools.SELECT

    // view: canvas px = sketch unit · zoom · density + pan
    var zoom by mutableStateOf(1f)
    var pan by mutableStateOf(Offset(40f, 120f))
    var density = 1f
    private val k get() = zoom * density

    // brushes
    var pointType by mutableStateOf(PointType.SOCKET)
    var pointState by mutableStateOf(PointState.PLANNED)
    var activeCircuit by mutableStateOf(initial.circuits.lastOrNull()?.id)
    var activeTag by mutableStateOf<String?>(null)

    // the gesture in progress, drawn by the canvas
    var dragRect by mutableStateOf<Pair<Pt, Pt>?>(null); private set
    var stroke by mutableStateOf<List<Pt>>(emptyList()); private set
    var lineDraft by mutableStateOf<List<Pt>>(emptyList()); private set
    var lineCursor by mutableStateOf<Pt?>(null); private set
    var wheel by mutableStateOf<WheelUi?>(null); private set
    var ask by mutableStateOf<Ask?>(null)
    var note by mutableStateOf<String?>(null)
    /** A tag being dragged in from the tray: its id and where the finger is, in canvas px. */
    var tagDrag by mutableStateOf<Pair<String, Offset>?>(null)
    /** Where the canvas is on screen and its size (px), for tags dragged in from the tray. */
    var canvasOrigin = Offset.Zero
    var canvasSize = Size.Zero

    private enum class Move { NONE, PAN, POINT, MEMO, TAG, ROOM, VERTEX, RECT, STROKE, FRAME }
    private var move = Move.NONE
    private var moveId: String? = null
    private var moveVertex = -1
    private var dragFrom = Pt(0.0, 0.0)
    private var lastSketchPt = Pt(0.0, 0.0)

    // ---- coordinates ---------------------------------------------------------------------------------------------
    fun toSketch(o: Offset) = Pt(((o.x - pan.x) / k).toDouble(), ((o.y - pan.y) / k).toDouble())
    fun toScreen(p: Pt) = Offset((p.x * k + pan.x).toFloat(), (p.y * k + pan.y).toFloat())
    /** A fingertip (22 dp) in sketch units. */
    val tol get() = 22.0 / zoom
    private fun hitAt(o: Offset) = Ops.hit(sketch, toSketch(o), tol)

    // ---- edits and history ---------------------------------------------------------------------------------------
    fun edit(next: Sketch, record: Boolean = true) {
        if (next == sketch) return
        if (record) checkpoint()
        sketch = next.copy(updated = System.currentTimeMillis())
        norm = solver.solve(sketch)
        if (activeCircuit != null && sketch.circuit(activeCircuit) == null) activeCircuit = sketch.circuits.lastOrNull()?.id
        if (activeTag != null && sketch.tag(activeTag) == null) activeTag = null
        onChange(sketch)
    }

    private fun checkpoint() {
        undo.addLast(sketch); if (undo.size > 100) undo.removeFirst()
        redo.clear(); canUndo = true; canRedo = false
    }

    fun undo() {
        val prev = undo.removeLastOrNull() ?: return
        redo.addLast(sketch); restore(prev)
    }

    fun redo() {
        val next = redo.removeLastOrNull() ?: return
        undo.addLast(sketch); restore(next)
    }

    private fun restore(s: Sketch) {
        sketch = s; norm = solver.solve(s)
        canUndo = undo.isNotEmpty(); canRedo = redo.isNotEmpty()
        onChange(s)
    }

    /** Applies an op that returns (sketch, id) and gives the id back, or null when it made nothing. */
    private fun <T> commit(r: Pair<Sketch, T>?): T? { if (r == null) return null; edit(r.first); return r.second }

    // ---- tools ---------------------------------------------------------------------------------------------------
    val rail get() = Plugins.rail(sketch.plugins)

    /** One tap on a tool; a tap on the active tool goes back to the one before (quick swap in the field). */
    fun pick(t: Tool) {
        if (t == tool) { val p = previousTool; previousTool = tool; tool = if (p in rail) p else Tools.SELECT }
        else { previousTool = tool; tool = t }
        cancelDraft(); note = null
    }

    fun togglePlugin(id: String) {
        edit(sketch.copy(plugins = Plugins.toggle(sketch.plugins, id)))
        if (tool !in rail) tool = Tools.SELECT
    }

    fun setLevel(l: Level) = edit(sketch.copy(level = l))
    fun rename(name: String) = edit(sketch.copy(name = name.trim()))

    private fun cancelDraft() { dragRect = null; stroke = emptyList(); lineDraft = emptyList(); lineCursor = null }

    // ---- the gestures --------------------------------------------------------------------------------------------
    fun onTap(o: Offset) {
        wheel?.let { w -> if (w.sticky) { tapWheel(w, o); return } }
        val p = toSketch(o)
        val h = hitAt(o)
        when (tool.id) {
            Tools.SELECT.id -> when (h?.kind) {
                Hit.Kind.MEMO -> ask = Ask.MemoEdit(h!!.id)
                null -> note = null
                else -> note = describe(h!!) + " · tartsd lenyomva a kerékhez"
            }
            Tools.MEMO.id -> when {
                h?.kind == Hit.Kind.MEMO -> ask = Ask.MemoEdit(h!!.id)
                h != null && h.kind != Hit.Kind.ROOM -> ask = Ask.MemoNew(beside(h), targetOf(h))
                else -> ask = Ask.MemoNew(p, h?.id)
            }
            Tools.TAG.id -> {
                val t = activeTag
                if (t == null) { note = "Válassz címkét lent, vagy húzd a lapra."; return }
                dropTag(t, o)
            }
            Tools.ROOM.id -> note = "Húzz egy téglalapot: az lesz a szoba."
            Tools.LINE.id -> lineTap(p)
            Tools.MEASURE.id -> when {
                h?.kind == Hit.Kind.ROOM_EDGE && h!!.edge >= 0 -> ask = Ask.MeasureEdge(h!!.id, h!!.edge)
                h?.kind == Hit.Kind.ROOM || h?.kind == Hit.Kind.ROOM_EDGE -> ask = Ask.MeasureRoom(h!!.id)
                else -> note = "Koppints egy falra vagy egy szoba belsejébe."
            }
            Tools.POINT.id -> if (h?.kind == Hit.Kind.POINT) note = "Tartsd lenyomva a pontot: kerék a típushoz."
                else commit(Ops.addPoint(sketch, p, pointType, pointState, tol))
            Tools.CIRCUIT.id -> if (h?.kind == Hit.Kind.POINT) circuitTap(h!!.id) else note = "Koppints pontokra, vagy húzz keretet."
            Tools.BOARD.id -> if (h?.kind == Hit.Kind.POINT) note = "Itt már van pont."
                else commit(Ops.addPoint(sketch, p, PointType.BOARD, pointState, tol))?.let { note = "Elosztó lerakva. Bekötés: lent." }
            Tools.ROUTE.id -> note = "Húzd végig az ujjad, merre megy a kábel."
        }
    }

    fun onDragStart(o: Offset) {
        wheel = null
        val p = toSketch(o); dragFrom = p; lastSketchPt = p
        val h = hitAt(o)
        move = when (tool.id) {
            Tools.ROOM.id -> Move.RECT
            Tools.ROUTE.id -> Move.STROKE
            Tools.CIRCUIT.id -> Move.FRAME
            Tools.SELECT.id -> when (h?.kind) {
                Hit.Kind.POINT -> Move.POINT
                Hit.Kind.MEMO -> Move.MEMO
                Hit.Kind.TAG -> Move.TAG
                Hit.Kind.ROOM -> Move.ROOM
                Hit.Kind.ROOM_EDGE -> if (h!!.vertex >= 0) Move.VERTEX else Move.ROOM
                else -> Move.PAN
            }
            else -> Move.PAN
        }
        moveId = h?.id; moveVertex = h?.vertex ?: -1
        if (move in setOf(Move.POINT, Move.MEMO, Move.TAG, Move.ROOM, Move.VERTEX)) checkpoint()
        if (move == Move.STROKE) stroke = listOf(p)
    }

    fun onDrag(o: Offset, delta: Offset) {
        val p = toSketch(o)
        val id = moveId
        when (move) {
            Move.PAN -> pan += delta
            Move.RECT, Move.FRAME -> dragRect = dragFrom to p
            Move.STROKE -> stroke = stroke + p
            Move.POINT -> if (id != null) edit(Ops.movePoint(sketch, id, p, tol), record = false)
            Move.MEMO -> if (id != null) edit(Ops.moveMemo(sketch, id, p), record = false)
            Move.TAG -> if (id != null) edit(Ops.moveTagUse(sketch, id, null, p), record = false)
            Move.ROOM -> if (id != null) edit(Ops.moveRoom(sketch, id, p - lastSketchPt), record = false)
            Move.VERTEX -> if (id != null) edit(Ops.moveVertex(sketch, id, moveVertex, p, tol / 2), record = false)
            Move.NONE -> {}
        }
        lastSketchPt = p
    }

    fun onDragEnd(o: Offset) {
        val p = toSketch(o)
        when (move) {
            Move.RECT -> {
                if (commit(Ops.addRectRoom(sketch, dragFrom, p, tol / 2)) == null) note = "Túl kicsi: húzz nagyobb téglalapot."
                else note = "Szoba kész. Tartsd lenyomva: név, típus, méret."
            }
            Move.STROKE -> if (commit(Ops.addRoute(sketch, stroke + p, tol)) == null) note = "Túl rövid nyomvonal."
            Move.FRAME -> {
                val ids = Ops.pointsIn(sketch, dragFrom, p).filter { sketch.point(it)?.type != PointType.BOARD }
                if (ids.isNotEmpty()) {
                    val c = activeCircuit?.takeIf { sketch.circuit(it) != null }
                    if (c == null) activeCircuit = commit(Ops.newCircuit(sketch, ids))
                    else edit(Ops.addMembers(sketch, c, ids))
                    note = "${ids.size} pont a(z) ${sketch.circuit(activeCircuit)?.name ?: ""} körben."
                }
            }
            Move.TAG -> moveId?.let { id ->
                // a loose tag dropped on a record sticks to it
                val h = Ops.hit(sketch.copy(tagUses = sketch.tagUses.filter { it.id != id }), p, tol)
                if (h != null && h.kind != Hit.Kind.TAG) edit(Ops.moveTagUse(sketch, id, targetOf(h), p), record = false)
            }
            else -> {}
        }
        move = Move.NONE; moveId = null; dragRect = null; stroke = emptyList()
    }

    fun onCancel() { move = Move.NONE; moveId = null; dragRect = null; stroke = emptyList() }

    fun onTransform(centroid: Offset, panDelta: Offset, zoomBy: Float) {
        val z = (zoom * zoomBy).coerceIn(0.25f, 8f)
        val f = z / zoom
        pan = centroid - (centroid - pan) * f + panDelta
        zoom = z
    }

    /** Fits the whole sketch into a canvas of [w] × [h] px. */
    fun fit(w: Float, h: Float) {
        val pts = sketch.rooms.flatMap { it.poly } + sketch.points.map { it.at } + sketch.lines.flatMap { it.pts } + sketch.memos.map { it.at }
        if (pts.isEmpty() || w <= 0 || h <= 0) { zoom = 1f; pan = Offset(40f, 120f); return }
        val (lo, hi) = Geo.bbox(pts)
        val bw = max(hi.x - lo.x, 40.0); val bh = max(hi.y - lo.y, 40.0)
        zoom = (min((w - 80) / (bw * density), (h - 240) / (bh * density))).toFloat().coerceIn(0.25f, 8f)
        pan = Offset((w / 2 - (lo.x + bw / 2) * k).toFloat(), (h / 2 - (lo.y + bh / 2) * k).toFloat())
    }

    // ---- hold: the wheel -------------------------------------------------------------------------------------------
    fun onHold(o: Offset, canvasW: Float, canvasH: Float, radius: Float) {
        cancelDraft()
        val h = hitAt(o)
        val w = when (h?.kind) {
            Hit.Kind.POINT -> sketch.point(h!!.id)?.let { Wheels.forPoint(it) }
            Hit.Kind.ROOM_EDGE -> sketch.room(h!!.id)?.let { if (h!!.edge >= 0) Wheels.forEdge(it, h!!.edge) else Wheels.forRoom(it) }
            Hit.Kind.ROOM -> sketch.room(h!!.id)?.let { Wheels.forRoom(it) }
            Hit.Kind.MEMO -> Wheels.forOther("Memó", h!!.id, editable = true)
            Hit.Kind.TAG -> Wheels.forOther("Címke", h!!.id)
            Hit.Kind.ROUTE -> Wheels.forOther("Nyomvonal", h!!.id)
            Hit.Kind.LINE -> Wheels.forOther("Vonal", h!!.id)
            Hit.Kind.PHOTO -> Wheels.forOther("Fotópont", h!!.id)
            null -> Wheels.forPaper()
        } ?: Wheels.forPaper()
        val c = Offset(o.x.coerceIn(radius, max(radius, canvasW - radius)), o.y.coerceIn(radius, max(radius, canvasH - radius)))
        wheel = WheelUi(w, c, 0, null, toSketch(o), h, sticky = false)
    }

    fun onHoldMove(o: Offset, hub: Float) {
        val w = wheel ?: return
        val s = Wheels.sectorAt((o.x - w.center.x).toDouble(), (o.y - w.center.y).toDouble(), hub.toDouble())
        if (s != w.sel) wheel = w.copy(sel = s)
    }

    /** Letting go: on a sector picks it; in the hub the wheel stays for a tap. */
    fun onHoldEnd() {
        val w = wheel ?: return
        val item = w.sel?.let { w.wheel.rings[w.ring][it] }
        if (item == null) { wheel = w.copy(sticky = true, sel = null); return }
        choose(w, item)
    }

    private fun tapWheel(w: WheelUi, o: Offset) {
        val s = Wheels.sectorAt((o.x - w.center.x).toDouble(), (o.y - w.center.y).toDouble(), (36 * density).toDouble())
        val far = (o - w.center).getDistance() > 150 * density
        val item = if (far) null else s?.let { w.wheel.rings[w.ring][it] }
        if (item == null) { wheel = null; return }
        choose(w, item)
    }

    fun closeWheel() { wheel = null }

    private fun choose(w: WheelUi, item: WheelItem) {
        Wheels.nextRing(w.wheel, w.ring, item)?.let { r -> wheel = w.copy(ring = r, sel = null, sticky = true); return }
        wheel = null
        val h = w.hit
        val id = h?.id
        when {
            item.id.startsWith("type:") -> id?.let { edit(Ops.setType(sketch, it, PointType.of(item.id.removePrefix("type:")))) }
            item.id.startsWith("kind:") -> id?.let {
                edit(Ops.toggleKind(sketch, it, item.id.removePrefix("kind:")))
                wheel = w.copy(wheel = Wheels.forRoom(sketch.room(it)!!), sel = null, sticky = true)   // several kinds in a row
            }
            item.id == "state" -> id?.let { pid -> sketch.point(pid)?.let { edit(Ops.setState(sketch, pid, it.state.other())) } }
            item.id == "memo" -> ask = if (h == null) Ask.MemoNew(w.at, null) else Ask.MemoNew(beside(h), targetOf(h))
            item.id == "edit" -> id?.let { ask = Ask.MemoEdit(it) }
            item.id == "tag" -> ask = if (h == null) Ask.TagPick(null, w.at) else Ask.TagPick(targetOf(h), null)
            item.id == "del" -> id?.let { edit(Ops.delete(sketch, it)); note = "Törölve. ↶ visszahozza." }
            item.id == "circuit" -> id?.let { circuitTap(it) }
            item.id == "name" -> id?.let { ask = Ask.RoomName(it) }
            item.id == "measure" -> id?.let { ask = Ask.MeasureRoom(it) }
            item.id == "measure-edge" -> if (h != null && h.edge >= 0) ask = Ask.MeasureEdge(h.id, h.edge)
            item.id == "point-here" -> commit(Ops.addPoint(sketch, w.at, pointType, pointState, tol))
            item.id == "board-here" -> commit(Ops.addPoint(sketch, w.at, PointType.BOARD, pointState, tol))
            item.id == "room" -> id?.let { rid -> sketch.room(rid)?.let { wheel = w.copy(wheel = Wheels.forRoom(it), ring = 0, sel = null, sticky = true) } }
            item.id == "points" -> id?.let { rid ->
                val ids = sketch.points.filter { it.room == rid && it.type != PointType.BOARD }.map { it.id }
                if (ids.isEmpty()) note = "A szobában még nincs pont."
                else { activeCircuit = commit(Ops.newCircuit(sketch, ids)); note = "${ids.size} pont egy új körben." }
            }
        }
    }

    // ---- helpers ---------------------------------------------------------------------------------------------------
    /** The record a hit stands for (a wall edge is its room). */
    private fun targetOf(h: Hit): String = h.id

    /** Where a memo next to a record goes: up and right of it, a fingertip away. */
    private fun beside(h: Hit): Pt {
        val a = sketch.anchorOf(h.id) ?: Pt(0.0, 0.0)
        return if (h.kind == Hit.Kind.ROOM_EDGE && h.edge >= 0) sketch.room(h.id)?.let { r ->
            val (p, q) = Geo.edge(r.poly, h.edge); Geo.lerp(p, q, 0.5) + Geo.inward(r.poly, h.edge) * (tol * 1.2)
        } ?: a else a + Pt(tol * 0.9, -tol * 0.9)
    }

    fun describeId(id: String): String = when {
        sketch.point(id) != null -> describe(Hit(Hit.Kind.POINT, id))
        sketch.room(id) != null -> describe(Hit(Hit.Kind.ROOM, id))
        sketch.memo(id) != null -> "Memó"
        sketch.route(id) != null -> "Nyomvonal"
        sketch.circuit(id) != null -> sketch.circuit(id)!!.name
        else -> id
    }

    fun describe(h: Hit): String = when (h.kind) {
        Hit.Kind.POINT -> sketch.point(h.id)?.let { "${it.type.label} (${it.state.label.lowercase()})" } ?: h.id
        Hit.Kind.ROOM, Hit.Kind.ROOM_EDGE -> sketch.room(h.id)?.let { roomTitle(it.name, it.kinds) } ?: h.id
        Hit.Kind.MEMO -> "Memó"
        Hit.Kind.TAG -> sketch.tagUse(h.id)?.let { "#" + (sketch.tag(it.tag)?.name ?: "") } ?: "Címke"
        Hit.Kind.ROUTE -> "Nyomvonal"
        Hit.Kind.LINE -> "Vonal"
        Hit.Kind.PHOTO -> "Fotópont"
    }

    private fun lineTap(raw: Pt) {
        val d = lineDraft
        if (d.size >= 3 && raw.dist(d.first()) <= tol) {
            if (commit(Ops.addPolyRoom(sketch, d)) == null) note = "A vonal keresztezi magát: nem lett szoba."
            else note = "Szoba kész."
            lineDraft = emptyList(); lineCursor = null; return
        }
        val p = if (d.isEmpty()) Ops.snapAxes(sketch, raw, tol / 2) else Geo.axisLock(d.last(), Ops.snapAxes(sketch, raw, tol / 2))
        lineDraft = d + p; lineCursor = null
        note = if (lineDraft.size >= 3) "Az első pontra koppintva szoba lesz." else null
    }

    fun lineBack() { lineDraft = lineDraft.dropLast(1) }
    fun lineDone() {
        if (lineDraft.size >= 2) commit(Ops.addLine(sketch, lineDraft))
        lineDraft = emptyList(); lineCursor = null
    }
    fun lineDrop() { lineDraft = emptyList(); lineCursor = null }

    private fun circuitTap(pointId: String) {
        val pt = sketch.point(pointId) ?: return
        if (pt.type == PointType.BOARD) {
            val c = activeCircuit
            if (c == null) { note = "Előbb válassz vagy indíts egy kört."; return }
            edit(Ops.setBoard(sketch, c, pointId)); note = "${sketch.circuit(c)?.name} → Elosztó"; return
        }
        val c = activeCircuit?.takeIf { sketch.circuit(it) != null }
        if (c == null) activeCircuit = commit(Ops.newCircuit(sketch, listOf(pointId)))
        else edit(Ops.toggleMember(sketch, c, pointId))
    }

    fun newCircuit() { activeCircuit = commit(Ops.newCircuit(sketch)) }

    fun connect() {
        if (sketch.boards.isEmpty()) { note = "Nincs Elosztó: tedd le az Elosztó eszközzel."; return }
        val (s, n) = Ops.connectCircuits(sketch)
        edit(s)
        note = if (n == 0) "Minden kör be van kötve." else "$n kör bekötve a legközelebbi Elosztóra."
    }

    /** A tag dropped at canvas point [o]: on whatever is there, or loose on the paper. */
    fun dropTag(tag: String, o: Offset) {
        val p = toSketch(o)
        val h = hitAt(o)
        val r = if (h == null || h.kind == Hit.Kind.TAG) Ops.placeTag(sketch, tag, null, p) else Ops.placeTag(sketch, tag, targetOf(h), null)
        commit(r)?.let { note = "#" + (sketch.tag(tag)?.name ?: "") + (if (h == null) " a lapon" else " → " + describe(h)) }
    }

    fun setMeasure(room: String, kind: MeasureKind, mm: Int, edge: Int = -1) = edit(Ops.setMeasure(sketch, room, kind, mm, edge))
}

fun roomTitle(name: String, kinds: List<String>) =
    name.ifBlank { hu.vrg.mobile.sketch.RoomKinds.autoName(kinds) }.ifBlank { "Szoba" }
