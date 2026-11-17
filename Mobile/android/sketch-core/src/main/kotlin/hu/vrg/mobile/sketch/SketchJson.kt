package hu.vrg.mobile.sketch

import org.json.JSONArray
import org.json.JSONObject

// The sketch file (`.vsketch.json`, kind "vrg-vazlat"): what the phone saves after every edit and reopens. Short
// keys, numbers rounded to 0.1 unit. Unknown keys are ignored and missing ones take their defaults, so a newer file
// opens in an older app as far as it can (and M25's photos survive a round trip through a phone without M25).
object SketchJson {
    const val KIND = "vrg-vazlat"
    const val V = 1

    private fun r1(v: Double) = Math.round(v * 10) / 10.0
    private fun pt(p: Pt) = JSONArray().put(r1(p.x)).put(r1(p.y))
    private fun pts(ps: List<Pt>) = JSONArray().also { a -> ps.forEach { a.put(pt(it)) } }
    private fun readPt(a: JSONArray?) = if (a == null || a.length() < 2) null else Pt(a.optDouble(0), a.optDouble(1))
    private fun readPts(a: JSONArray?) = if (a == null) emptyList() else (0 until a.length()).mapNotNull { readPt(a.optJSONArray(it)) }
    private fun strs(l: List<String>) = JSONArray().also { a -> l.forEach { a.put(it) } }
    private fun readStrs(a: JSONArray?) = if (a == null) emptyList() else (0 until a.length()).map { a.optString(it) }.filter { it.isNotEmpty() }
    private fun JSONObject.str(k: String): String? = if (has(k) && !isNull(k)) optString(k).takeIf { it.isNotEmpty() } else null
    private fun <T> list(a: JSONArray?, f: (JSONObject) -> T?): List<T> =
        if (a == null) emptyList() else (0 until a.length()).mapNotNull { a.optJSONObject(it)?.let(f) }

    fun write(s: Sketch): JSONObject = JSONObject()
        .put("kind", KIND).put("v", V)
        .put("id", s.id).put("name", s.name).put("level", s.level.id)
        .put("created", s.created).put("updated", s.updated).put("seq", s.seq)
        .put("plugins", strs(s.plugins))
        .put("rooms", JSONArray().also { a -> s.rooms.forEach { r ->
            a.put(JSONObject().put("id", r.id).put("poly", pts(r.poly)).put("name", r.name).put("kinds", strs(r.kinds)))
        } })
        .put("lines", JSONArray().also { a -> s.lines.forEach { a.put(JSONObject().put("id", it.id).put("pts", pts(it.pts))) } })
        .put("points", JSONArray().also { a -> s.points.forEach { p ->
            val o = JSONObject().put("id", p.id).put("at", pt(p.at)).put("type", p.type.id).put("st", p.state.id)
            if (p.room != null) o.put("room", p.room)
            if (p.edge != null && p.t != null) o.put("edge", p.edge).put("t", Math.round(p.t * 10000) / 10000.0)
            a.put(o)
        } })
        .put("measures", JSONArray().also { a -> s.measures.forEach { m ->
            a.put(JSONObject().put("id", m.id).put("room", m.room).put("kind", m.kind.id).put("mm", m.mm).put("edge", m.edge))
        } })
        .put("circuits", JSONArray().also { a -> s.circuits.forEach { c ->
            val o = JSONObject().put("id", c.id).put("name", c.name).put("col", c.color).put("members", strs(c.members)).put("ded", c.dedicated)
            if (c.board != null) o.put("board", c.board)
            a.put(o)
        } })
        .put("routes", JSONArray().also { a -> s.routes.forEach { r ->
            val o = JSONObject().put("id", r.id).put("pts", pts(r.pts))
            r.a?.let { o.put("a", it) }; r.b?.let { o.put("b", it) }; r.circuit?.let { o.put("circuit", it) }
            a.put(o)
        } })
        .put("memos", JSONArray().also { a -> s.memos.forEach { m ->
            val o = JSONObject().put("id", m.id).put("at", pt(m.at)).put("text", m.text)
            m.target?.let { o.put("target", it) }
            a.put(o)
        } })
        .put("tags", JSONArray().also { a -> s.tags.forEach { t ->
            val o = JSONObject().put("id", t.id).put("name", t.name).put("col", t.color)
            t.preset?.let { o.put("preset", it) }
            a.put(o)
        } })
        .put("tagUses", JSONArray().also { a -> s.tagUses.forEach { u ->
            val o = JSONObject().put("id", u.id).put("tag", u.tag)
            u.target?.let { o.put("target", it) }; u.at?.let { o.put("at", pt(it)) }
            a.put(o)
        } })
        .put("photos", JSONArray().also { a -> s.photos.forEach { f ->
            val o = JSONObject().put("id", f.id).put("at", pt(f.at))
            f.room?.let { o.put("room", it) }
            o.put("shots", JSONArray().also { sa -> f.shots.forEach { sh -> sa.put(JSONObject().put("deg", sh.deg).put("file", sh.file).put("taken", sh.taken)) } })
            a.put(o)
        } })

    /** Null when [o] is not a sketch file. */
    fun read(o: JSONObject): Sketch? {
        if (o.optString("kind") != KIND) return null
        val id = o.str("id") ?: return null
        return Sketch(
            id = id,
            name = o.optString("name"),
            level = Level.of(o.str("level")),
            created = o.optLong("created"), updated = o.optLong("updated"), seq = o.optInt("seq"),
            plugins = if (o.has("plugins")) readStrs(o.optJSONArray("plugins")) else Plugins.DEFAULT_ON,
            rooms = list(o.optJSONArray("rooms")) { r ->
                val poly = readPts(r.optJSONArray("poly"))
                if (poly.size < 3) null else Room(r.str("id") ?: return@list null, poly, r.optString("name"), readStrs(r.optJSONArray("kinds")))
            },
            lines = list(o.optJSONArray("lines")) { l -> Line(l.str("id") ?: return@list null, readPts(l.optJSONArray("pts"))) },
            points = list(o.optJSONArray("points")) { p ->
                SketchPoint(
                    p.str("id") ?: return@list null, readPt(p.optJSONArray("at")) ?: return@list null,
                    PointType.of(p.str("type")), PointState.of(p.str("st")), p.str("room"),
                    if (p.has("edge")) p.optInt("edge") else null, if (p.has("t")) p.optDouble("t") else null,
                )
            },
            measures = list(o.optJSONArray("measures")) { m ->
                Measure(m.str("id") ?: return@list null, m.str("room") ?: return@list null, MeasureKind.of(m.str("kind")), m.optInt("mm"), m.optInt("edge", -1))
            },
            circuits = list(o.optJSONArray("circuits")) { c ->
                Circuit(c.str("id") ?: return@list null, c.optString("name"), c.optLong("col", CircuitColors.ALL[0]),
                    readStrs(c.optJSONArray("members")), c.str("board"), c.optBoolean("ded"))
            },
            routes = list(o.optJSONArray("routes")) { r ->
                Route(r.str("id") ?: return@list null, readPts(r.optJSONArray("pts")), r.str("a"), r.str("b"), r.str("circuit"))
            },
            memos = list(o.optJSONArray("memos")) { m ->
                Memo(m.str("id") ?: return@list null, readPt(m.optJSONArray("at")) ?: return@list null, m.optString("text"), m.str("target"))
            },
            tags = if (o.has("tags")) list(o.optJSONArray("tags")) { t ->
                Tag(t.str("id") ?: return@list null, t.optString("name"), t.optLong("col", 0xFF888888), t.str("preset"))
            } else Tags.PRESETS,
            tagUses = list(o.optJSONArray("tagUses")) { u ->
                TagUse(u.str("id") ?: return@list null, u.str("tag") ?: return@list null, u.str("target"), readPt(u.optJSONArray("at")))
            },
            photos = list(o.optJSONArray("photos")) { f ->
                PhotoPoint(f.str("id") ?: return@list null, readPt(f.optJSONArray("at")) ?: return@list null, f.str("room"),
                    list(f.optJSONArray("shots")) { sh -> Shot(sh.optInt("deg"), sh.optString("file"), sh.optLong("taken")) })
            },
        )
    }

    fun read(text: String): Sketch? = try { read(JSONObject(text)) } catch (e: Exception) { null }

    /** A file name from the sketch's name: letters, digits, dashes; accents dropped. */
    fun fileStem(s: Sketch): String {
        val base = java.text.Normalizer.normalize(s.name.ifBlank { "vazlat" }, java.text.Normalizer.Form.NFD)
            .replace(Regex("\\p{M}+"), "")
            .replace(Regex("[^A-Za-z0-9]+"), "-").trim('-').lowercase()
        return base.ifEmpty { "vazlat" }.take(40)
    }
}
