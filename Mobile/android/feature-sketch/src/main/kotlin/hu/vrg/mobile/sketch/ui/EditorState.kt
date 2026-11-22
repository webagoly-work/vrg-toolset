package hu.vrg.mobile.sketch.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import hu.vrg.mobile.sketch.AnswerState
import hu.vrg.mobile.sketch.Draw
import hu.vrg.mobile.sketch.DrawTune
import hu.vrg.mobile.sketch.Effect
import hu.vrg.mobile.sketch.FieldKit
import hu.vrg.mobile.sketch.Geo
import hu.vrg.mobile.sketch.Intake
import hu.vrg.mobile.sketch.KTemplate
import hu.vrg.mobile.sketch.Kit
import hu.vrg.mobile.sketch.PointPreset
import hu.vrg.mobile.sketch.Site
import hu.vrg.mobile.sketch.Variant
import hu.vrg.mobile.sketch.VariantOps
import hu.vrg.mobile.sketch.Hit
import hu.vrg.mobile.sketch.Level
import hu.vrg.mobile.sketch.MeasureKind
import hu.vrg.mobile.sketch.Norm
import hu.vrg.mobile.sketch.Ops
import hu.vrg.mobile.sketch.PhotoOps
import hu.vrg.mobile.sketch.Photos
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

/**
 * The camera asked for. A photo point's shot ([photo], [deg] null = the side comes from the swipe after it), or a
 * capture (WP M29): [purpose], the shot-list item it fulfils, the record and room it belongs to.
 */
data class CameraReq(
    val photo: String?, val deg: Int?, val purpose: String? = null, val shot: String? = null,
    val target: String? = null, val room: String? = null,
    /** Kamera 2: the photo is the after of this before-photo; [video] = the walk video (CaptureVideo). */
    val pairOf: String? = null, val video: Boolean = false,
)

/** What a dialog is asked for. */
sealed class Ask {
    data class MemoNew(val at: Pt, val target: String?) : Ask()
    data class MemoEdit(val id: String) : Ask()
    data class MeasureEdge(val room: String, val edge: Int) : Ask()
    data class MeasureRoom(val room: String) : Ask()
    data class RoomName(val room: String) : Ask()
    data class TagPick(val target: String?, val at: Pt?) : Ask()
    data class CircuitEdit(val id: String) : Ask()
    data class PhotoView(val id: String, val deg: Int) : Ask()
    data class CaptureView(val id: String) : Ask()
    data class EntryEdit(val id: String) : Ask()
    object Purposes : Ask()
    // Kamera 2: the client's signature pad, a before / after comparison, choosing the before of an after
    object Signature : Ask()
    data class Compare(val before: String, val after: String) : Ask()
    data class PairPick(val id: String) : Ask()
    object VariantRequest : Ask()
    object SketchName : Ask()
    object PluginSheet : Ask()
    /** WP M51: ⚙ → Funkciók, [front]'s switches first (the Kamera front's ⚙ Funkciók tile). */
    data class FeatureSheet(val front: String? = null) : Ask()
    /** F5: the variant's lineClose = ask: Kész with 3+ corners asks room or open line. */
    object LineClose : Ask()
    /** skcam K3 (WP M60): the Síkmérés on one photo ([key] = capture id or "F25/0"); [back] = the dialog to return to. */
    data class Measure(val key: String, val file: String, val title: String, val back: Ask? = null) : Ask()
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
    /** The field kit in force: the base, with the variant's additions while it is switched on (WP M31). */
    var kit: Kit by mutableStateOf(SketcherKit.forSketch(initial)); private set
    val variant: Variant? get() = if (sketch.variantOn) SketcherKit.variant(sketch.variant) else null

    // VRG Sketcher (WP M26): which front is open, and the room last touched on the sketch: a note or a photo taken
    // "here" belongs to it, whatever front it was taken from
    var front by mutableStateOf("vazlat")
    var focusRoom by mutableStateOf<String?>(null)
    var noteOpen by mutableStateOf(false)
    /** Kamera (WP M29): the purpose the ◉ button shoots with, and Sorozat (the camera comes back after each shot). */
    var purpose by mutableStateOf("egyeb")
    var series by mutableStateOf(false)
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
    /** A variant's labelled point brush (type + tags), over [pointType] while set. */
    var preset by mutableStateOf<PointPreset?>(null)
    /** The Sablon tool's shape. */
    var template by mutableStateOf<KTemplate?>(null)
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
    // Fotópont (M25): the camera to open, the shot waiting for its direction swipe (photo point id, file), the folder
    // the sketch's photos live in, and how a file that is no longer needed is deleted (set by the screen)
    var camera by mutableStateOf<CameraReq?>(null)
    var pendingShot by mutableStateOf<Pair<String, String>?>(null); private set
    var photoDir: java.io.File? = null
    var dropFile: (String) -> Unit = {}
    /** Kamera 2: "+ ugyanez még", the type-plate reader's queue (Camera2Ui.kt). */
    val cam2 = Cam2State()

    /** Where the canvas is on screen and its size (px), for tags dragged in from the tray. */
    var canvasOrigin = Offset.Zero
    var canvasSize = Size.Zero

    private enum class Move { NONE, PAN, POINT, MEMO, TAG, ROOM, VERTEX, RECT, STROKE, FRAME, PHOTO, SHOT }
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
        kit = SketcherKit.forSketch(sketch)
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
        sketch = s; norm = solver.solve(s); kit = SketcherKit.forSketch(s)
        canUndo = undo.isNotEmpty(); canRedo = redo.isNotEmpty()
        onChange(s)
    }

    /** Applies an op that returns (sketch, id) and gives the id back, or null when it made nothing. */
    private fun <T> commit(r: Pair<Sketch, T>?): T? { if (r == null) return null; edit(r.first); return r.second }

    // ---- tools ---------------------------------------------------------------------------------------------------
    val rail get() = hu.vrg.mobile.sketch.Features.rail(Plugins.rail(VariantOps.plugins(sketch, variant), variant?.rail), FeaturePrefs.flipped)   // M51: a tool switched off stays out, whatever the variant says

    /** The tool's line on the canvas: the variant's own hint while it is on. */
    fun hint(t: Tool) = variant?.hints?.get(t.id) ?: t.hint

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
        if (pendingShot != null) { shotToward(o); return }
        if (photoTap(o)) return
        val p = toSketch(o)
        val h = hitAt(o)
        focusOn(h, p)
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
            Tools.ROOM.id -> if (h == null) tapRoom(p) else note = "Húzz egy téglalapot: az lesz a szoba."   // F4: a tap on paper only
            Tools.TEMPLATE.id -> note = "Húzd a sablont a szoba méretére" + (template?.let { ": " + it.label } ?: "; az alakot lent választod.")
            Tools.LINE.id -> lineTap(p)
            Tools.MEASURE.id -> when {
                h?.kind == Hit.Kind.ROOM_EDGE && h!!.edge >= 0 -> ask = Ask.MeasureEdge(h!!.id, h!!.edge)
                h?.kind == Hit.Kind.ROOM || h?.kind == Hit.Kind.ROOM_EDGE -> ask = Ask.MeasureRoom(h!!.id)
                else -> note = "Koppints egy falra vagy egy szoba belsejébe."
            }
            Tools.POINT.id -> if (h?.kind == Hit.Kind.POINT) note = "Tartsd lenyomva a pontot: kerék a típushoz."
                else placePoint(p)
            Tools.CIRCUIT.id -> if (h?.kind == Hit.Kind.POINT) circuitTap(h!!.id) else note = "Koppints pontokra, vagy húzz keretet."
            Tools.BOARD.id -> if (h?.kind == Hit.Kind.POINT) note = "Itt már van pont."
                else commit(Ops.addPoint(sketch, p, PointType.BOARD, pointState, Draw.pointTol(draw, tol)))?.let { note = "Elosztó lerakva. Bekötés: lent." }
            Tools.ROUTE.id -> note = "Húzd végig az ujjad, merre megy a kábel."
            Tools.PHOTO.id -> if (h?.kind == Hit.Kind.PHOTO) camera = CameraReq(h!!.id, null)
                else commit(PhotoOps.add(sketch, p, tol))?.let { note = "Fotópont. Koppints rá: kamera; utána húzz arra, amerre a kép néz." }
        }
    }

    fun onDragStart(o: Offset) {
        wheel = null
        val p = toSketch(o); dragFrom = p; lastSketchPt = p
        if (pendingShot != null) { move = Move.SHOT; shotFrom = o; return }
        val h = hitAt(o)
        move = when (tool.id) {
            Tools.ROOM.id, Tools.TEMPLATE.id -> Move.RECT
            Tools.ROUTE.id -> Move.STROKE
            Tools.CIRCUIT.id -> Move.FRAME
            Tools.SELECT.id -> when (h?.kind) {
                Hit.Kind.POINT -> Move.POINT
                Hit.Kind.MEMO -> Move.MEMO
                Hit.Kind.TAG -> Move.TAG
                Hit.Kind.ROOM -> Move.ROOM
                Hit.Kind.ROOM_EDGE -> if (h!!.vertex >= 0) Move.VERTEX else Move.ROOM
                Hit.Kind.PHOTO -> Move.PHOTO
                else -> Move.PAN
            }
            else -> Move.PAN
        }
        moveId = h?.id; moveVertex = h?.vertex ?: -1
        if (move in setOf(Move.POINT, Move.MEMO, Move.TAG, Move.ROOM, Move.VERTEX, Move.PHOTO)) checkpoint()
        if (move == Move.STROKE) stroke = listOf(p)
    }

    fun onDrag(o: Offset, delta: Offset) {
        val p = toSketch(o)
        val id = moveId
        when (move) {
            Move.PAN -> pan += delta
            Move.RECT, Move.FRAME -> dragRect = dragFrom to p
            Move.STROKE -> stroke = stroke + p
            Move.POINT -> if (id != null) edit(Ops.movePoint(sketch, id, p, Draw.pointTol(draw, tol)), record = false)
            Move.MEMO -> if (id != null) edit(Ops.moveMemo(sketch, id, p), record = false)
            Move.TAG -> if (id != null) edit(Ops.moveTagUse(sketch, id, null, p), record = false)
            Move.ROOM -> if (id != null) edit(Ops.moveRoom(sketch, id, p - lastSketchPt), record = false)
            Move.VERTEX -> if (id != null) edit(Ops.moveVertex(sketch, id, moveVertex, corner(p, id), tol / 2), record = false)
            Move.PHOTO -> if (id != null) edit(PhotoOps.move(sketch, id, p), record = false)
            Move.SHOT, Move.NONE -> {}
        }
        lastSketchPt = p
    }

    fun onDragEnd(o: Offset) {
        val p = toSketch(o)
        when (move) {
            Move.RECT -> {
                val shape = if (tool.id == Tools.TEMPLATE.id) (template ?: kit.templates.firstOrNull()) else null
                val a = corner(dragFrom); val b = corner(p)   // F4: a variant's grid (DrawTune)
                val made = if (shape != null) commit(Ops.addTemplateRoom(sketch, shape.poly, a, b, tol / 2)) else commit(Ops.addRectRoom(sketch, a, b, tol / 2))
                if (made == null) note = "Túl kicsi: húzz nagyobbat."
                else roomMade(made, (shape?.label?.let { "$it kész." } ?: "Szoba kész.") + " Tartsd lenyomva: név, típus, méret.")
            }
            Move.STROKE -> if (commit(Ops.addRoute(sketch, stroke + p, tol)) == null) note = "Túl rövid nyomvonal."
            Move.SHOT -> {
                val d = Photos.snap((o.x - shotFrom.x).toDouble(), (o.y - shotFrom.y).toDouble(), 24.0 * density)
                if (d == null) note = "Húzz hosszabban: arra, amerre a kép néz." else pendingShot?.let { (f, file) -> saveShot(f, d, file) }
            }
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
        if (!FeaturePrefs.on("vazlat.wheels")) return   // M51: Tartásra kerék switched off
        val h = hitAt(o)
        focusOn(h, toSketch(o))
        val v = variant
        val w = when (h?.kind) {
            Hit.Kind.POINT -> sketch.point(h!!.id)?.let { Wheels.forPoint(it, v?.pointRing) }
            Hit.Kind.ROOM_EDGE -> sketch.room(h!!.id)?.let { if (h!!.edge >= 0) Wheels.forEdge(it, h!!.edge) else Wheels.forRoom(it, v?.roomRing) }
            Hit.Kind.ROOM -> sketch.room(h!!.id)?.let { Wheels.forRoom(it, v?.roomRing) }
            Hit.Kind.MEMO -> Wheels.forOther("Memó", h!!.id, editable = true)
            Hit.Kind.TAG -> Wheels.forOther("Címke", h!!.id)
            Hit.Kind.ROUTE -> Wheels.forOther("Nyomvonal", h!!.id)
            Hit.Kind.LINE -> Wheels.forOther("Vonal", h!!.id)
            Hit.Kind.PHOTO -> sketch.photos.firstOrNull { it.id == h!!.id }?.let { Wheels.forPhoto(it) }
            null -> Wheels.forPaper()
        } ?: Wheels.forPaper()
        val c = Offset(o.x.coerceIn(radius, max(radius, canvasW - radius)), o.y.coerceIn(radius, max(radius, canvasH - radius)))
        wheel = WheelUi(hu.vrg.mobile.sketch.Features.wheel(w, FeaturePrefs.flipped), c, 0, null, toSketch(o), h, sticky = false)   // M51
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
            item.id.startsWith("shot:") -> id?.let { f ->
                val d = item.id.removePrefix("shot:").toInt()
                val pp = sketch.photos.firstOrNull { it.id == f }
                if (pp != null && Photos.shot(pp, d) != null) ask = Ask.PhotoView(f, d) else camera = CameraReq(f, d)
            }
            item.id.startsWith("type:") -> id?.let { edit(Ops.setType(sketch, it, PointType.of(item.id.removePrefix("type:")))) }
            item.id.startsWith("kind:") -> id?.let {
                edit(Ops.toggleKind(sketch, it, item.id.removePrefix("kind:")))
                wheel = w.copy(wheel = hu.vrg.mobile.sketch.Features.wheel(Wheels.forRoom(sketch.room(it)!!, variant?.roomRing), FeaturePrefs.flipped), sel = null, sticky = true)   // several kinds in a row
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
            item.id == "point-here" -> placePoint(w.at)
            item.id == "board-here" -> commit(Ops.addPoint(sketch, w.at, PointType.BOARD, pointState, tol))
            item.id == "room" -> id?.let { rid -> sketch.room(rid)?.let { wheel = w.copy(wheel = hu.vrg.mobile.sketch.Features.wheel(Wheels.forRoom(it, variant?.roomRing), FeaturePrefs.flipped), ring = 0, sel = null, sticky = true) } }
            item.id == "points" -> id?.let { rid ->
                val ids = sketch.points.filter { it.room == rid && it.type != PointType.BOARD }.map { it.id }
                if (ids.isEmpty()) note = "A szobában még nincs pont."
                else { activeCircuit = commit(Ops.newCircuit(sketch, ids)); note = "${ids.size} pont egy új körben." }
            }
        }
    }

    // ---- VRG Sketcher: focus, points, variants (WP M26, M31) --------------------------------------------------------
    /** The room a touch is about becomes the focus: notes and photos taken now belong to it. */
    private fun focusOn(h: Hit?, p: Pt) {
        val r = when (h?.kind) {
            Hit.Kind.ROOM, Hit.Kind.ROOM_EDGE -> h!!.id
            Hit.Kind.POINT -> sketch.point(h!!.id)?.room
            Hit.Kind.PHOTO -> sketch.photos.firstOrNull { it.id == h!!.id }?.room
            else -> Ops.roomAt(sketch, p)?.id
        }
        if (r != null) focusRoom = r
    }

    /** A point with the brush: the variant preset's type and tags, else the plain type. */
    private fun placePoint(p: Pt) {
        val pr = preset
        val (s1, id) = Ops.addPoint(sketch, p, pr?.type ?: pointType, pointState, Draw.pointTol(draw, tol))
        var s = s1
        pr?.tags?.forEach { t -> if (s.tag(t) != null) Ops.placeTag(s, t, id, null)?.let { s = it.first } }
        edit(s)
        if (pr != null) note = pr.label
    }

    fun chooseVariant(v: Variant?) {
        if (v == null) { edit(sketch.copy(variantOn = false)); note = "Eredeti Sketcher."; return }
        edit(VariantOps.activate(sketch, v)); preset = null; template = null
        if (tool !in rail) tool = rail.first()
        note = "${v.sym} ${v.name}: a sarokban a kapcsoló vált vissza."
    }

    fun toggleVariant() {
        if (sketch.variant == null) return
        edit(sketch.copy(variantOn = !sketch.variantOn)); preset = null; template = null
        if (tool !in rail) tool = Tools.SELECT
    }

    // ---- the intake (WP M27-M30) --------------------------------------------------------------------------------
    private val now get() = System.currentTimeMillis()

    /** A note from the quick-note sheet or the Jegyzet front; chips with an effect apply it (the user tapped them). */
    fun addNote(text: String, chips: List<String>, open: Boolean, voice: Boolean, room: String? = focusRoom, target: String? = null): Boolean {
        val k = kit
        val r = Intake.addEntry(sketch, text, chips, room, target, open || chips.any { k.chip(it)?.open == true }, voice, now) ?: return false
        var s = r.first.copy(draft = "")
        chips.forEach { c -> s = FieldKit.apply(k, k.chip(c)?.sets, s, now) }
        edit(s)
        note = "✎ Jegyzet mentve" + (room?.let { sketch.room(it) }?.let { " · " + roomTitle(it.name, it.kinds) } ?: "")
        return true
    }

    fun setDraft(text: String) { if (text != sketch.draft) edit(sketch.copy(draft = text), record = false) }
    fun editEntry(id: String, text: String, chips: List<String>) = edit(Intake.editEntry(sketch, id, text, chips))
    fun setOpen(id: String, open: Boolean) = edit(Intake.setOpen(sketch, id, open))
    fun linkEntry(id: String, room: String?) = edit(Intake.linkEntry(sketch, id, room, sketch.entry(id)?.target))
    fun deleteEntry(id: String) = edit(Intake.deleteEntry(sketch, id))
    fun setScope(id: String, qty: Int) = edit(Intake.setScope(sketch, id, qty))
    // F4 (WP M49): the client's wants by room. [wantRoom] = where the Igények' + / − go (null = Általános); the
    // Munkakör sets it to the room in focus each time it opens. Fewer in Általános than it holds takes the total down.
    var wantRoom by mutableStateOf<String?>(null)
    fun addWant(id: String, delta: Int) {
        val r = wantRoom?.takeIf { sketch.room(it) != null }
        val next = hu.vrg.mobile.sketch.Wants.add(sketch, id, r, delta)
        edit(if (next == sketch && r == null && delta < 0) Intake.setScope(sketch, id, hu.vrg.mobile.sketch.Wants.total(sketch, id) + delta) else next)
    }
    fun moveWant(id: String, from: String?, to: String?, n: Int = 1) = edit(hu.vrg.mobile.sketch.Wants.move(sketch, id, from, to, n))
    fun answer(q: String, options: List<String>, text: String, state: AnswerState) = edit(Intake.answer(kit, sketch, q, options, text, state, now))
    fun clearAnswer(q: String) = edit(Intake.clearAnswer(sketch, q))
    fun accept(e: Effect) = edit(FieldKit.apply(kit, e, sketch, now))
    fun dismiss(id: String) = edit(Intake.dismiss(sketch, id))
    /** Shadow questions seen for the first time get their arrival time (bookkeeping, no undo step). */
    fun markSeen(ids: List<String>) { if (ids.isNotEmpty()) edit(Intake.markSeen(sketch, ids, now), record = false) }
    fun setSite(f: (Site) -> Site) = edit(Intake.setSite(sketch, f))

    /** A purpose photo is back from the camera. */
    fun captureTaken(req: CameraReq, file: String, lat: Double?, lon: Double?) {
        val purpose = req.purpose ?: this.purpose
        val (s, id) = Intake.addCapture(sketch, file, purpose, req.room ?: focusRoom, req.target, req.shot, now, lat, lon)
        edit(if (req.pairOf != null) hu.vrg.mobile.sketch.Camera2.pair(s, id, req.pairOf) else s)
        cam2.taken(this, req, id)
        note = "◉ " + (kit.purpose(purpose)?.label ?: purpose) + " mentve" + (if (series) " · sorozat: a kamera visszajön" else "")
    }

    fun editCapture(id: String, f: (hu.vrg.mobile.sketch.Capture) -> hu.vrg.mobile.sketch.Capture) = edit(Intake.editCapture(sketch, id, f))
    fun deleteCapture(id: String) { val (s, file) = Intake.deleteCapture(sketch, id); edit(s); file?.let(dropFile) }

    /** The camera for a purpose (and a shot-list item), from the ◉ button, the Kamera front or a record's wheel. */
    fun shoot(purpose: String, shot: String? = null, target: String? = null) {
        this.purpose = purpose
        camera = CameraReq(null, null, purpose, shot, target, focusRoom)
    }

    // ---- Fotópont (M25) --------------------------------------------------------------------------------------------
    private var shotFrom = Offset.Zero

    /** skcam K1b: the lens of the photo waiting for its direction (its file → the 35 mm equivalent the camera reported). */
    private var pendingLens: Pair<String, Double>? = null

    /**
     * The camera came back with a photo ([f35]: its lens, when the in-app camera knew it). A side asked for in advance
     * saves it; otherwise it waits for the swipe.
     */
    fun photoTaken(req: CameraReq, file: String, f35: Double? = null) {
        val f = req.photo ?: return
        pendingLens = f35?.let { file to it }
        if (req.deg != null) saveShot(f, req.deg, file)
        else { pendingShot = f to file; note = "Húzz arra, amerre a kép néz (É, K, D, Ny)." }
    }

    fun cancelShot() { pendingShot?.let { dropFile(it.second) }; pendingShot = null; note = "A fotó elvetve." }

    private fun saveShot(photo: String, deg: Int, file: String) {
        val lens = pendingLens?.takeIf { it.first == file }?.second
        pendingLens = null
        val (s, old) = PhotoOps.addShot(sketch, photo, deg, file, System.currentTimeMillis(), lens)
        edit(s); old?.let(dropFile)
        pendingShot = null
        val pp = sketch.photos.firstOrNull { it.id == photo }
        val next = pp?.let { Photos.next(it) }
        note = Photos.label(deg) + " fotó mentve (${pp?.shots?.size ?: 0}/4)." + (next?.let { " Következő: " + Photos.label(it) } ?: " A szoba kész.")
    }

    /** While a shot waits: a tap away from its point gives the direction too. */
    private fun shotToward(o: Offset) {
        val (f, file) = pendingShot ?: return
        val at = sketch.photos.firstOrNull { it.id == f }?.at ?: return cancelShot()
        val c = toScreen(at)
        val d = Photos.snap((o.x - c.x).toDouble(), (o.y - c.y).toDouble(), 24.0 * density)
        if (d == null) note = "Húzz vagy koppints a pontól arra, amerre a kép néz." else saveShot(f, d, file)
    }

    /** A tap on a photo point's wedge: the photo of that side, or (with the Fotópont tool) the camera for it. */
    private fun photoTap(o: Offset): Boolean {
        for (pp in sketch.photos) {
            val c = toScreen(pp.at)
            val d = Photos.wedgeAt((o.x - c.x).toDouble(), (o.y - c.y).toDouble(), 13.0 * density, 42.0 * density) ?: continue
            if (Photos.shot(pp, d) != null) { ask = Ask.PhotoView(pp.id, d); return true }
            if (tool.id == Tools.PHOTO.id) { camera = CameraReq(pp.id, d); return true }
        }
        return false
    }

    fun removeShot(photo: String, deg: Int) {
        val (s, old) = PhotoOps.removeShot(sketch, photo, deg)
        edit(s); old?.let(dropFile)
    }

    fun turnShot(photo: String, from: Int, to: Int) = edit(PhotoOps.turnShot(sketch, photo, from, to))

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
        Hit.Kind.PHOTO -> sketch.photos.firstOrNull { it.id == h.id }?.let { "Fotópont ${it.shots.size}/4" } ?: "Fotópont"
    }

    private fun lineTap(raw: Pt) {
        val d = lineDraft
        if (d.size >= 3 && raw.dist(d.first()) <= Draw.closeTol(draw, tol)) { lineClose(); return }   // F5: auto reaches further
        val p = if (d.isEmpty()) corner(raw) else Draw.lock(d.last(), corner(raw), draw)   // F4: the variant's angle step and grid
        lineDraft = d + p; lineCursor = null
        note = if (lineDraft.size >= 3) "Az első pontra koppintva szoba lesz." else null
    }

    fun lineBack() { lineDraft = lineDraft.dropLast(1) }
    fun lineDone() {
        // F5 (WP M50, D-83): a variant's lineClose decides what Kész does with 3+ corners
        when (Draw.lineDone(draw, lineDraft.size)) {
            Draw.LineDone.ROOM -> { lineClose(); return }
            Draw.LineDone.ASK -> { ask = Ask.LineClose; return }
            Draw.LineDone.LINE -> {}
        }
        lineOpen()
    }
    /** The drawn corners as an open line (the original Kész). */
    fun lineOpen() {
        if (lineDraft.size >= 2) commit(Ops.addLine(sketch, lineDraft))
        lineDraft = emptyList(); lineCursor = null
    }
    /** The drawn corners closed into a room. */
    fun lineClose() {
        val d = lineDraft
        if (d.size < 3) { lineOpen(); return }
        val made = commit(Ops.addPolyRoom(sketch, d))
        if (made == null) note = "A vonal keresztezi magát: nem lett szoba." else roomMade(made, "Szoba kész.")
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

    // ---- F4 (WP M49): a variant's drawing tune (sketch-core DrawTune.kt); the original when none --------------------
    /** F5 (D-90): the Felmérés funkciók switched off on this phone (SketchFeaturePrefs), set when the editor opens. */
    var featOff by mutableStateOf<Set<String>>(emptySet())
    // M51: Rajz-hangolás off = the original; F5's Vonal: Kész zár on top of it
    val draw: DrawTune get() = hu.vrg.mobile.sketch.Features.draw(hu.vrg.mobile.sketch.SketchFeatures.tune(featOff, variant?.draw ?: DrawTune()), FeaturePrefs.flipped)
    /** A corner onto a neighbour's wall line, else onto the variant's grid (in the sketch's current scale). */
    private fun corner(p: Pt, skip: String? = null) = Draw.corner(sketch, p, tol / 2, draw, norm.report.scaleX, norm.report.scaleY, skip)
    private fun roomMade(id: String, msg: String) {
        focusRoom = id; note = msg
        if (draw.measureFirst) ask = Ask.MeasureRoom(id)
    }
    /** A tap with the Szoba tool: the variant's default room there, or how to draw one. */
    private fun tapRoom(p: Pt) {
        val box = Draw.tapRoom(sketch, p, tol / 2, draw, norm.report.scaleX, norm.report.scaleY)
        if (box == null) { note = "Húzz egy téglalapot: az lesz a szoba."; return }
        val made = commit(Ops.addRectRoom(sketch, box.first, box.second, tol / 2))
        if (made == null) note = "Húzz egy téglalapot: az lesz a szoba."
        else draw.defaultRoom?.let { (w, d) -> roomMade(made, "Szoba ${fmtM(w)} × ${fmtM(d)} m. Húzással más méret.") }
    }
    private fun fmtM(v: Double) = if (v == Math.floor(v)) v.toLong().toString() else v.toString().replace('.', ',')
}

fun roomTitle(name: String, kinds: List<String>) =
    name.ifBlank { hu.vrg.mobile.sketch.RoomKinds.autoName(kinds) }.ifBlank { "Szoba" }
