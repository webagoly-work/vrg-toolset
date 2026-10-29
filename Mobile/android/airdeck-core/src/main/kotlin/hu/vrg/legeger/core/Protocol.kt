package hu.vrg.legeger.core

import org.json.JSONArray
import org.json.JSONObject

// The phone side of the Planner's relay envelope (Planner/projects/varler-planner/src/07a-link.js):
//   {v, from, seq, t, type, payload}  and, new with Légegér, an optional `to` (the role it is for).
// Nothing here touches Android, so the whole wire format is covered by plain JVM tests.

object Proto {
    const val V = 1
    const val ROLE = "phone"
    const val APP = "legeger-2"
    val CAPS = listOf("state", "cmd", "keys", "orientation", "gesture", "focus", "roster")
}

/** One button of an app's pad, as the app announced it in its hello (`tools`). */
data class Tool(val mode: String, val key: String?, val hint: String, val index: Int) {
    /** Same shortening as the old phone-sender.html: the part of the hint before a dash, dot or bracket. */
    val label: String
        get() = hint.split(Regex("[—·(]"))[0].trim().take(11).ifEmpty { mode }
}

data class Peer(val role: String, val app: String?)

data class Focus(val role: String?, val app: String?, val title: String?)

sealed interface Incoming {
    data class Hello(val role: String, val app: String, val caps: List<String>, val tools: List<Tool>) : Incoming
    data class State(val role: String, val fields: Map<String, Any?>) : Incoming
    data class Ack(val role: String, val id: String, val ok: Boolean, val reason: String?) : Incoming
    data class FocusChanged(val focus: Focus) : Incoming
    data class Roster(val peers: List<Peer>, val focus: Focus?) : Incoming
    /** The relay's answer to screenshot.request: a PNG to fetch over HTTP from the same host. */
    data class Shot(val ok: Boolean, val url: String?, val name: String?, val bytes: Long, val reason: String?) : Incoming
    data class Other(val role: String?, val type: String) : Incoming
    data object Echo : Incoming
    data object Junk : Incoming
}

/** Builds outgoing envelopes. One instance per connection: `seq` counts per socket, like the page did. */
class Envelopes(private val app: String = Proto.APP, private val clock: () -> Long = System::currentTimeMillis) {
    private var seq = 0

    @Synchronized
    fun build(type: String, payload: JSONObject = JSONObject(), to: String? = null): String {
        val o = JSONObject()
            .put("v", Proto.V).put("from", Proto.ROLE).put("seq", ++seq)
            .put("t", clock()).put("type", type).put("payload", payload)
        if (to != null) o.put("to", to)
        return o.toString()
    }

    fun hello(): String = build(
        "hello",
        JSONObject().put("role", Proto.ROLE).put("app", app).put("caps", JSONArray(Proto.CAPS)),
    )

    fun stateRequest(to: String?): String = build("state.request", JSONObject(), to)

    fun cmd(id: String, to: String?, extra: Map<String, Any?> = emptyMap()): String {
        val p = JSONObject().put("id", id)
        for ((k, v) in extra) p.put(k, v ?: JSONObject.NULL)
        return build("cmd", p, to)
    }

    fun keys(key: String, ctrl: Boolean, shift: Boolean, alt: Boolean, to: String?): String =
        build("keys", JSONObject().put("key", key).put("ctrl", ctrl).put("shift", shift).put("alt", alt), to)

    fun orientation(pitch: Double, yaw: Double, to: String?): String = build(
        "orientation",
        JSONObject().put("pitch", pitch).put("yaw", yaw).put("pitchEnabled", true).put("yawEnabled", true),
        to,
    )

    /** Tells the app the camera switch went off, so a relative follower (Kódváros) drops its baseline. */
    fun orientationOff(to: String?): String = build(
        "orientation",
        JSONObject().put("pitch", 45).put("yaw", 0).put("pitchEnabled", false).put("yawEnabled", false),
        to,
    )

    fun zoompan(dx: Double, dy: Double, scale: Double, to: String?): String =
        build("gesture", JSONObject().put("kind", "zoompan").put("dx", dx).put("dy", dy).put("scale", scale), to)

    fun orbit(dx: Double, dy: Double, to: String?): String =
        build("gesture", JSONObject().put("kind", "orbit").put("dx", dx).put("dy", dy), to)

    fun reset(to: String?): String = build("gesture", JSONObject().put("kind", "reset"), to)

    /** Asks the relay itself (not an app) for a capture of the PC: mode "screen" or "window". */
    fun screenshotRequest(mode: String): String = build("screenshot.request", JSONObject().put("mode", mode), "relay")
}

object Inbound {
    fun parse(raw: String): Incoming {
        val m = try { JSONObject(raw) } catch (e: Exception) { return Incoming.Junk }
        val from = m.optString("from", "").ifEmpty { null }
        if (from == Proto.ROLE) return Incoming.Echo
        val type = m.optString("type", "")
        val p = m.optJSONObject("payload") ?: JSONObject()
        val role = from ?: "?"
        return when (type) {
            "hello" -> Incoming.Hello(
                role = p.optString("role", role),
                app = p.optString("app", "?"),
                caps = p.optJSONArray("caps").strings(),
                tools = tools(p.optJSONArray("tools")),
            )
            "state" -> Incoming.State(role, p.toMap())
            "ack" -> Incoming.Ack(role, p.optString("id"), p.optBoolean("ok", true), p.optStringOrNull("reason"))
            "focus" -> Incoming.FocusChanged(Focus(role, p.optStringOrNull("app"), p.optStringOrNull("title")))
            "roster" -> Incoming.Roster(
                peers = (0 until (p.optJSONArray("peers")?.length() ?: 0)).mapNotNull { i ->
                    p.getJSONArray("peers").optJSONObject(i)?.let { Peer(it.optString("role"), it.optStringOrNull("app")) }
                },
                focus = p.optJSONObject("focus")?.let {
                    Focus(it.optStringOrNull("role"), it.optStringOrNull("app"), it.optStringOrNull("title"))
                },
            )
            "screenshot" -> Incoming.Shot(
                ok = p.optBoolean("ok", false),
                url = p.optStringOrNull("url"),
                name = p.optStringOrNull("name"),
                bytes = p.optLong("bytes", 0L),
                reason = p.optStringOrNull("reason"),
            )
            "" -> Incoming.Junk
            else -> Incoming.Other(from, type)
        }
    }

    private fun tools(a: JSONArray?): List<Tool> {
        if (a == null) return emptyList()
        return (0 until a.length()).mapNotNull { i ->
            val t = a.optJSONObject(i) ?: return@mapNotNull null
            Tool(t.optString("mode"), t.optStringOrNull("key"), t.optString("hint", ""), i)
        }
    }

    private fun JSONArray?.strings(): List<String> =
        if (this == null) emptyList() else (0 until length()).map { optString(it) }

    private fun JSONObject.optStringOrNull(k: String): String? =
        if (!has(k) || isNull(k)) null else optString(k)

    private fun JSONObject.toMap(): Map<String, Any?> {
        val out = LinkedHashMap<String, Any?>()
        val it = keys()
        while (it.hasNext()) {
            val k = it.next()
            out[k] = if (isNull(k)) null else get(k)
        }
        return out
    }
}

object RelayUrl {
    const val DEFAULT_PORT = 47291

    /** Accepts what a person types or a QR carries: "192.168.1.24", "pc:47292", http://…/phone-sender.html, ws://… */
    fun normalize(raw: String): String {
        var s = raw.trim()
        if (s.isEmpty()) return ""
        s = s.replace(Regex("^http(s?)://"), "ws$1://")
        if (!s.startsWith("ws://") && !s.startsWith("wss://")) s = "ws://$s"
        val scheme = s.substringBefore("://")
        val rest = s.substringAfter("://")
        val host = rest.substringBefore('/')
        val withPort = if (host.contains(':')) host else "$host:$DEFAULT_PORT"
        return "$scheme://$withPort"
    }

    /** The relay's HTTP address for a path it serves (a screenshot), from its ws:// address. */
    fun http(ws: String, path: String): String {
        val base = normalize(ws).replaceFirst(Regex("^ws(s?)://"), "http$1://")
        return base + (if (path.startsWith("/")) path else "/$path")
    }
}
