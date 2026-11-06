package hu.vrg.mobile.core

import org.json.JSONArray
import org.json.JSONObject

// Indítópult (WP M11): START from the phone, the parts that are rules rather than Android. The relay
// (Planner/projects/varler-planner/tools/relay-launch.js) lists START's tools from launcher/vrg-menu.json
// plus the servers and extras Mobile/catalogue/launch.json allows, and runs one by its id. The phone
// only ever sends an id from that list; the relay checks it again. Needs a trusted (paired, M2) phone.
//
//   phone ─ launch.list ─▶ relay ─ launch{ok, entries[], running[], mine[], proxy{on, token}}
//   phone ─ launch.run{id} ─▶ relay ─ launch.ran{ok, id, how, started, note | reason}
//   phone ─ launch.status / launch.log{id} / launch.stop{id} ─▶ launch.status / launch.log / launch.stopped

enum class LaunchKind { TOOL, SERVER, EXTRA }

data class LaunchEntry(
    /** "tool:K", "server:mindmap", "extra:K.S": what launch.run takes. */
    val id: String,
    val kind: LaunchKind,
    /** The START key, exactly as the registry has it ("1", "K", "O3", "K·S"): the user knows them by heart. */
    val key: String,
    val name: String,
    val hint: String?,
    /** The section on screen: "Eszközök" or "Helyi szerverek". */
    val group: String,
    /** The page or script exists on the PC; a missing one shows dimmed. */
    val exists: Boolean,
    /** The registry server that serves it, its port and page path: the running dot and "Megnyitás a telefonon". */
    val server: String?,
    val port: Int?,
    val path: String,
)

data class LaunchList(
    val ok: Boolean,
    val trusted: Boolean,
    val entries: List<LaunchEntry>,
    /** Ids whose server listens now. */
    val running: Set<String>,
    /** Ids whose server this relay started (they have a log and can be stopped from the phone). */
    val mine: Set<String>,
    val proxyOn: Boolean,
    val token: String?,
    val reason: String?,
) {
    fun isRunning(e: LaunchEntry) = e.id in running
    fun isMine(e: LaunchEntry) = e.id in mine

    /** Sections in the relay's order, each in START's order. */
    fun groups(): List<Pair<String, List<LaunchEntry>>> = entries.groupBy { it.group }.toList()

    fun withStatus(s: LaunchStatus): LaunchList = copy(running = s.running, mine = s.mine)
}

data class LaunchRan(val ok: Boolean, val id: String?, val how: String?, val started: Boolean, val note: String?, val reason: String?, val trusted: Boolean)
data class LaunchStatus(val ok: Boolean, val running: Set<String>, val mine: Set<String>)
data class LaunchLog(val ok: Boolean, val id: String?, val lines: List<String>, val note: String?, val reason: String?)
data class LaunchStopped(val ok: Boolean, val id: String?, val reason: String?)

sealed interface LaunchNote {
    data class Listed(val list: LaunchList) : LaunchNote
    data class Ran(val result: LaunchRan) : LaunchNote
    data class Status(val status: LaunchStatus) : LaunchNote
    data class Log(val log: LaunchLog) : LaunchNote
    data class Stopped(val result: LaunchStopped) : LaunchNote
}

object Launch {
    const val CAP = "launch"

    /** The same shape as relay-launch.js ID: kind, a colon, a registry key. */
    private val ID = Regex("(tool|server|extra):[A-Za-z0-9._-]{1,32}")

    fun validId(id: String?): Boolean = id != null && ID.matches(id)

    /** "Megnyitás a telefonon" makes sense: its server runs, and the relay's proxy is on. */
    fun openableHere(l: LaunchList, e: LaunchEntry): Boolean =
        e.port != null && l.proxyOn && l.token != null && l.isRunning(e)

    /** What the phone says after launch.ran. */
    fun ranText(r: LaunchRan, name: String?): String {
        val n = name ?: r.id ?: "?"
        if (!r.ok) return "Nem indult: ${r.reason ?: "?"}"
        val base = if (r.started) "Elindítva és megnyitva a PC-n: $n" else "Megnyitva a PC-n: $n"
        return if (r.note != null) "$base (${r.note})" else base
    }
}

object LaunchMsgs {
    fun list(): String = RelayMsgs.build("launch.list", JSONObject(), "relay")
    fun status(): String = RelayMsgs.build("launch.status", JSONObject(), "relay")

    /** Null for an id that is not of the list's shape; the relay checks it against the list anyway. */
    fun run(id: String): String? = if (Launch.validId(id)) RelayMsgs.build("launch.run", JSONObject().put("id", id), "relay") else null
    fun log(id: String): String? = if (Launch.validId(id)) RelayMsgs.build("launch.log", JSONObject().put("id", id), "relay") else null
    fun stop(id: String): String? = if (Launch.validId(id)) RelayMsgs.build("launch.stop", JSONObject().put("id", id), "relay") else null

    private fun str(o: JSONObject?, k: String): String? =
        if (o == null || !o.has(k) || o.isNull(k)) null else o.optString(k).takeIf { it.isNotEmpty() }

    private fun ids(a: JSONArray?): Set<String> = buildSet {
        if (a != null) for (i in 0 until a.length()) a.optString(i, "").takeIf { Launch.validId(it) }?.let(::add)
    }

    private fun lines(a: JSONArray?): List<String> = buildList {
        if (a != null) for (i in 0 until a.length()) add(a.optString(i, ""))
    }

    private fun entry(e: JSONObject): LaunchEntry? {
        val id = str(e, "id")?.takeIf { Launch.validId(it) } ?: return null
        val kind = when (str(e, "kind")) { "tool" -> LaunchKind.TOOL; "server" -> LaunchKind.SERVER; "extra" -> LaunchKind.EXTRA; else -> return null }
        val port = if (e.has("port") && !e.isNull("port")) e.optInt("port", 0).takeIf { Ports.validPort(it) } else null
        return LaunchEntry(id, kind, str(e, "key") ?: id.substringAfter(':'), str(e, "name") ?: id, str(e, "hint"),
            str(e, "group") ?: "Eszközök", e.optBoolean("exists", true), str(e, "server"), port,
            str(e, "path")?.takeIf { Ports.validPath(it) } ?: "/")
    }

    fun parse(raw: String): LaunchNote? {
        val m = try { JSONObject(raw) } catch (e: Exception) { return null }
        if (m.optString("from") != "relay") return null
        val p = m.optJSONObject("payload") ?: return null
        val ok = p.optBoolean("ok", false)
        return when (m.optString("type")) {
            "launch" -> {
                val arr = p.optJSONArray("entries")
                val entries = buildList { if (arr != null) for (i in 0 until arr.length()) arr.optJSONObject(i)?.let(::entry)?.let(::add) }
                val proxy = p.optJSONObject("proxy")
                val on = proxy?.optBoolean("on", false) == true
                LaunchNote.Listed(LaunchList(ok, p.optBoolean("trusted", true), entries, ids(p.optJSONArray("running")),
                    ids(p.optJSONArray("mine")), on, if (on) str(proxy, "token") else null, str(p, "reason")))
            }
            "launch.ran" -> LaunchNote.Ran(LaunchRan(ok, str(p, "id"), str(p, "how"), p.optBoolean("started", false),
                str(p, "note"), str(p, "reason"), p.optBoolean("trusted", true)))
            "launch.status" -> LaunchNote.Status(LaunchStatus(ok, ids(p.optJSONArray("running")), ids(p.optJSONArray("mine"))))
            "launch.log" -> LaunchNote.Log(LaunchLog(ok, str(p, "id"), lines(p.optJSONArray("lines")), str(p, "note"), str(p, "reason")))
            "launch.stopped" -> LaunchNote.Stopped(LaunchStopped(ok, str(p, "id"), str(p, "reason")))
            else -> null
        }
    }
}
