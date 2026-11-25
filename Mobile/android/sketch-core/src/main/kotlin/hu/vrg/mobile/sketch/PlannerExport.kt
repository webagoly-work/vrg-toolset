package hu.vrg.mobile.sketch

import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.roundToInt

// The package the Planner imports (kind "vrg-sketch"): the raw sketch, so it can be reopened on the phone, and the
// solved plan as the Planner's own records, so the Planner only has to load them (Planner src/08ca-sketch-import.js,
// through its usual "Terv betöltése fájlból").
//
//   rooms   → data.floors, stage 'outline' + clear (the Helyiség-toll's record: inner sizes, no walls yet), kinds;
//             Falak létrehozása / Padlók létrehozása then build them as for a pen-drawn room
//   points  → data.devices (Planner type, a standard height, on a wall 40 mm in front of it)
//   Elosztó → a 'board' device (the Planner fills in its height and footprint)
//   circuits→ data.circuits {name, col, dedicated, members, board}
//   routes  → data.paths at the ceiling (the Planner's default section build), their tied ends as links of the devices (a link without glue: the route
//             reaches the box from above, as the Planner's auto-link makes it)
//   memos   → data.notes; a loose tag → a note "#name"
//   photo points (WP M25) → a hidden note each {sk:{photo:true, shots:[{deg, side, file}]}}, file = the name the photo
//             has on the Átadás board (D-25 = A: each photo goes there as its own file); the Planner draws the point
//             and its view cones from it (08ca) and lists the files in plan.photos
// Everything carries `sk` {src:'vazlat', id, …}: where it came from, and for a room which edges were measured,
// derived or inferred (est), so the Planner can mark the guessed sizes until someone checks them.
object PlannerExport {
    const val KIND = "vrg-sketch"
    const val V = 1
    /** A device on a wall stands this far in front of it (the Planner's fixtures put boxes 40 mm out). */
    const val WALL_OFFSET = 40.0

    /** The standard heights (mm) a type gets; a light is on the ceiling unless it is on a wall. */
    fun height(type: PointType, onWall: Boolean, level: Level): Int = when (type) {
        PointType.SOCKET, PointType.DATA, PointType.POINT -> 300
        PointType.SWITCH -> 1100
        PointType.FIXED -> 600
        PointType.LIGHT -> if (onWall) 2000 else level.heightMm
        PointType.JUNCTION -> if (onWall) 2200 else level.heightMm
        PointType.SENSOR -> 2200
        PointType.BOARD -> 1600
    }

    private fun roomTitleOf(r: Room) = r.name.ifBlank { RoomKinds.autoName(r.kinds) }.ifBlank { r.id }

    /** Every photo file the package names, the phone's file → the board name: what the export sends with it. */
    fun photoFiles(s: Sketch): List<Pair<String, String>> =
        s.photos.flatMap { p -> p.shots.sortedBy { it.deg }.map { it.file to Photos.exportName(s, p, it.deg) } }

    private fun hex(c: Long) = "#%06x".format(c and 0xFFFFFF)
    private fun i(v: Double) = v.roundToInt()
    private fun xy(p: Pt) = JSONArray().put(i(p.x)).put(i(p.y))

    fun build(s: Sketch, norm: Norm = Solver().solve(s), now: Long = System.currentTimeMillis()): JSONObject {
        var seq = 0
        fun id(prefix: String) = prefix + (++seq)
        val lvl = s.level.id
        val tagNames = { target: String -> Ops.tagsOf(s, target) }

        // ---- rooms ----
        val floors = JSONArray()
        norm.rooms.filter { it.poly.size >= 3 }.forEach { r ->
            val tags = tagNames(r.id)
            val kinds = (r.kinds + tags.mapNotNull { t -> t.preset?.takeIf { it.startsWith("kind:") }?.removePrefix("kind:") }).distinct()
            val o = JSONObject().put("id", id("F")).put("level", lvl)
                .put("poly", JSONArray().also { a -> r.poly.forEach { a.put(xy(it)) } })
                .put("stage", "outline").put("clear", true).put("fill", "#e9e5da")
            val name = r.name.ifBlank { RoomKinds.autoName(kinds) }
            o.put("name", name)
            if (r.name.isBlank() && kinds.isNotEmpty()) o.put("nameAuto", true)
            if (kinds.isNotEmpty()) o.put("kinds", JSONArray(kinds)).put("kind", kinds[0])
            val sk = JSONObject().put("src", "vazlat").put("id", r.id)
                .put("est", JSONArray(r.edges.indices.filter { r.edges[it] == SizeStatus.INFERRED }))
                .put("der", JSONArray(r.edges.indices.filter { r.edges[it] == SizeStatus.DERIVED }))
                .put("mea", JSONArray(r.edges.indices.filter { r.edges[it] == SizeStatus.MEASURED }))
            if (tags.isNotEmpty()) sk.put("tags", JSONArray(tags.map { it.name }))
            Wants.ofRoom(s, r.id)?.let { sk.put("wants", it) }   // F4: the client's wants in this room
            o.put("sk", sk)
            floors.put(o)
        }

        // ---- points → devices ----
        val devId = HashMap<String, String>()
        val devices = JSONArray()
        val devObj = HashMap<String, JSONObject>()
        norm.points.forEach { p ->
            val did = id("D"); devId[p.id] = did
            val onWall = p.inward != null
            val at = if (p.inward != null) p.at + p.inward * WALL_OFFSET else p.at
            val tags = tagNames(p.id)
            val o = JSONObject().put("id", did).put("type", p.type.planner)
                .put("x", i(at.x)).put("y", i(at.y)).put("h", height(p.type, onWall, s.level)).put("level", lvl)
            if (p.type == PointType.DATA) o.put("lv", true)
            val sk = JSONObject().put("src", "vazlat").put("id", p.id).put("t", p.type.id).put("st", p.state.id)
            if (tags.isNotEmpty()) sk.put("tags", JSONArray(tags.map { it.name }))
            if (tags.any { it.preset == "ip44" }) sk.put("ip44", true)
            if (tags.any { it.preset == "remove" }) sk.put("remove", true)
            if (tags.any { it.preset == "replace" }) sk.put("replace", true)
            o.put("sk", sk)
            devices.put(o); devObj[did] = o
        }

        // ---- circuits ----
        val ckId = HashMap<String, String>()
        val circuits = JSONArray()
        s.circuits.forEach { c ->
            val members = c.members.mapNotNull { devId[it] }
            val cid = id("A"); ckId[c.id] = cid
            val ded = c.dedicated || tagNames(c.id).any { it.preset == "dedicated" } ||
                c.members.any { m -> tagNames(m).any { it.preset == "dedicated" } }
            val o = JSONObject().put("id", cid).put("ref", c.name).put("name", c.name).put("col", hex(c.color))
                .put("dedicated", ded).put("members", JSONArray(members))
                .put("sk", JSONObject().put("src", "vazlat").put("id", c.id))
            c.board?.let { b -> devId[b]?.let { o.put("board", it) } }
            circuits.put(o)
        }

        // ---- routes → paths at the ceiling ----
        val paths = JSONArray()
        norm.routes.filter { it.pts.size >= 2 }.forEach { r ->
            val pid = id("P")
            val nodes = r.pts.map { p -> JSONObject().put("id", id("n")).put("x", i(p.x)).put("y", i(p.y)).put("h", s.level.heightMm).put("level", lvl) }
            // one section per segment, as the Planner's own path tools make them (its default build, no circuit)
            val sections = (1 until nodes.size).map { JSONObject().put("build", "sull_gege").put("circuit", JSONObject.NULL) }
            val o = JSONObject().put("id", pid).put("level", lvl).put("nodes", JSONArray(nodes)).put("sections", JSONArray(sections))
            val sk = JSONObject().put("src", "vazlat").put("id", r.id)
            r.circuit?.let { c -> ckId[c]?.let { sk.put("circuit", it) } }
            o.put("sk", sk)
            paths.put(o)
            listOf(r.a to nodes.first(), r.b to nodes.last()).forEach { (pt, n) ->
                val d = pt?.let { devId[it] }?.let { devObj[it] } ?: return@forEach
                val links = d.optJSONArray("links") ?: JSONArray().also { d.put("links", it) }
                links.put(JSONObject().put("p", pid).put("n", n.getString("id")))
            }
        }

        // ---- memos and loose tags → notes ----
        val notes = JSONArray()
        norm.memos.forEach { m ->
            val o = JSONObject().put("id", id("N")).put("level", lvl).put("x", i(m.at.x)).put("y", i(m.at.y)).put("text", m.text)
            val sk = JSONObject().put("src", "vazlat").put("id", m.id)
            m.target?.let { t -> (devId[t] ?: ckId[t] ?: t).let { sk.put("target", it) } }
            notes.put(o.put("sk", sk))
        }
        norm.tags.forEach { t ->
            val tag = s.tag(t.tag) ?: return@forEach
            notes.put(JSONObject().put("id", id("N")).put("level", lvl).put("x", i(t.at.x)).put("y", i(t.at.y))
                .put("text", "#" + tag.name).put("sk", JSONObject().put("src", "vazlat").put("id", t.id).put("tag", tag.name)))
        }

        // ---- photo points: one hidden note each, the board file names in sk.shots and plan.photos ----
        val photos = JSONArray()
        norm.photos.forEach { f ->
            val pp = s.photos.firstOrNull { it.id == f.id } ?: return@forEach
            val shots = JSONArray(f.shots.sortedBy { it.deg }.map { sh ->
                JSONObject().put("deg", sh.deg).put("side", Photos.label(sh.deg)).put("file", Photos.exportName(s, pp, sh.deg)).put("taken", sh.taken)
                    .also { j -> sh.f35?.let { j.put("f35", it) } }   // skcam K1b: the lens, for the Szobadoboz
            })
            val room = s.room(f.room)?.let { roomTitleOf(it) } ?: ""
            notes.put(JSONObject().put("id", id("N")).put("level", lvl).put("x", i(f.at.x)).put("y", i(f.at.y))
                .put("text", "Fotópont" + (if (room.isNotEmpty()) " · $room" else "") + " (${f.shots.size}/4)").put("hidden", true)
                .put("sk", JSONObject().put("src", "vazlat").put("id", f.id).put("photo", true).put("room", room).put("shots", shots)))
            photos.put(JSONObject().put("id", f.id).put("room", room).put("x", i(f.at.x)).put("y", i(f.at.y)).put("shots", shots))
        }

        val box = norm.all.takeIf { it.isNotEmpty() }?.let { Geo.bbox(it) }
        val center = box?.let { (lo, hi) -> JSONArray().put(i((lo.x + hi.x) / 2)).put(i((lo.y + hi.y) / 2)) } ?: JSONArray().put(6000).put(4000)
        val rep = norm.report
        val report = JSONObject()
            .put("measured", rep.measured).put("derived", rep.derived).put("inferred", rep.inferred)
            .put("scaleX", Math.round(rep.scaleX * 100) / 100.0).put("scaleY", Math.round(rep.scaleY * 100) / 100.0)
            .put("warnings", JSONArray(rep.warnings))
            .put("conflicts", JSONArray(rep.conflicts.map { JSONObject().put("measure", it.measure).put("mm", it.mm).put("solved", it.solved) }))

        return JSONObject()
            .put("kind", KIND).put("v", V)
            .put("name", s.name.ifBlank { "Vázlat" })
            .put("exported", now)
            .put("level", lvl)
            .put("sketch", SketchJson.write(s))
            .put("plan", JSONObject()
                .put("center", center)
                .put("photos", photos)
                .put("report", report)
                .also { pl -> Wants.packageList(s).takeIf { it.length() > 0 }?.let { pl.put("wants", it) } }   // F4: only when a want has a room
                .put("data", JSONObject()
                    .put("v", 2).put("seq", seq)
                    .put("floors", floors).put("devices", devices).put("circuits", circuits)
                    .put("paths", paths).put("notes", notes)))
    }
}
