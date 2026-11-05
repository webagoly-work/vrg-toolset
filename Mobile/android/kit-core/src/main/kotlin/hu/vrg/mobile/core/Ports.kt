package hu.vrg.mobile.core

import org.json.JSONObject
import java.net.URLEncoder

// Localhost (WP M8, D-10 = C): the PC's local servers, the parts that are rules rather than Android.
// The relay (Planner/projects/varler-planner/tools/relay-ports.js) lists the listening ports and opens
// one on the desktop; on the phone a server opens through the relay's /p/<port>/ proxy, which exists
// only when the relay runs with --ports. Both need a trusted (paired, M2) phone.
//
//   phone ─ ports.list ─▶ relay ─ ports{ok, ports[], proxy{on, token}}
//   phone ─ ports.open{port, path, where:'desktop'} ─▶ relay ─ ports.opened{ok, url, how | reason}

/** The dot in front of a row: a web page answered, a port that does not speak HTTP, a system service. */
enum class PortStatus { WEB, OPEN, SYSTEM }

data class PortEntry(
    val port: Int,
    val process: String?,
    val http: Boolean,
    val title: String?,
    /** The tool's name from Mobile/catalogue/ports.json, when the port is one of ours. */
    val known: String?,
    /** Where the tool opens (the Planner's dev server serves a page below /); "/" otherwise. */
    val path: String,
    val system: Boolean,
    /** The relay's own port. */
    val self: Boolean,
) {
    /** What the row is called: our name, else the page's title, else the process. */
    val name: String get() = known ?: title ?: process ?: "Port $port"

    /** The second line: "8124 · node", plus the page title when the name is the catalogue's. */
    val detail: String get() = buildList {
        add(port.toString())
        process?.let { add(it) }
        if (known != null && title != null && title != known) add(title)
    }.joinToString(" · ")

    val status: PortStatus get() = when {
        system -> PortStatus.SYSTEM
        http -> PortStatus.WEB
        else -> PortStatus.OPEN
    }

    /** Opening it makes sense: a web page, and not the relay itself. */
    val openable: Boolean get() = http && !self
}

/** The relay's answer to ports.list. [trusted] = false: the phone must pair first. */
data class PortList(
    val ok: Boolean,
    val trusted: Boolean,
    val entries: List<PortEntry>,
    val proxyOn: Boolean,
    val token: String?,
    val reason: String?,
    val tookMs: Long,
)

data class PortOpened(val ok: Boolean, val port: Int?, val url: String?, val how: String?, val reason: String?, val trusted: Boolean)

sealed interface PortsNote {
    data class Listed(val list: PortList) : PortsNote
    data class Opened(val result: PortOpened) : PortsNote
}

object Ports {
    const val CAP = "ports"
    private val TOKEN = Regex("[0-9a-f]{32}")
    private val HOST = Regex("[A-Za-z0-9.\\-]+|\\[[0-9A-Fa-f:.]+]")

    fun validPort(p: Int?): Boolean = p != null && p in 1..65535

    /** The same rule as relay-ports.js portUrl(): one leading "/", no space, backslash, "@" or control character. */
    fun validPath(p: String?): Boolean =
        p != null && p.length <= 1024 && p.startsWith("/") && !p.startsWith("//") &&
            p.none { it == '\\' || it == '@' || it.isWhitespace() || it < ' ' || it == '\u007f' }

    /** The order on screen: ours first, then other web pages, then the rest; by port within each. */
    fun sorted(entries: List<PortEntry>): List<PortEntry> =
        entries.sortedWith(compareBy<PortEntry>({ rank(it) }, { it.port }))

    private fun rank(e: PortEntry): Int = when {
        e.self -> 3
        e.known != null && e.http -> 0
        e.http -> 1
        e.known != null -> 2
        e.system -> 5
        else -> 4
    }

    /** The rows shown at once (ours and web pages) and the rest, behind "Egyéb". */
    fun split(entries: List<PortEntry>): Pair<List<PortEntry>, List<PortEntry>> =
        sorted(entries).partition { !it.self && (it.http || it.known != null) }

    /**
     * The address the phone opens for "📱 Itt": the relay's own host, /p/<port><path>, with the token
     * that the relay turns into a cookie. Null unless the relay is a ws:// address and every part is well formed.
     */
    fun proxyUrl(relayWs: String, port: Int, path: String, token: String?): String? {
        if (!validPort(port) || !validPath(path) || token == null || !TOKEN.matches(token)) return null
        if (!relayWs.startsWith("ws://")) return null
        val hostPort = relayWs.removePrefix("ws://").substringBefore('/')
        val host = hostPort.substringBeforeLast(':')
        val relayPort = hostPort.substringAfterLast(':').toIntOrNull()
        if (!HOST.matches(host) || !validPort(relayPort)) return null
        // the token goes into the query, before any #fragment (a browser never sends the fragment)
        val (beforeHash, hash) = path.indexOf('#').let { if (it < 0) path to "" else path.substring(0, it) to path.substring(it) }
        val query = if (beforeHash.contains('?')) '&' else '?'
        return "http://$host:$relayPort/p/$port$beforeHash${query}vrg_t=${URLEncoder.encode(token, "UTF-8")}$hash"
    }
}

object PortsMsgs {
    fun list(): String = RelayMsgs.build("ports.list", JSONObject(), "relay")

    /** Null when the port or path would be refused anyway; the relay checks both again. */
    fun openOnDesktop(port: Int, path: String = "/"): String? {
        if (!Ports.validPort(port) || !Ports.validPath(path)) return null
        return RelayMsgs.build("ports.open", JSONObject().put("port", port).put("path", path).put("where", "desktop"), "relay")
    }

    fun parse(raw: String): PortsNote? {
        val m = try { JSONObject(raw) } catch (e: Exception) { return null }
        if (m.optString("from") != "relay") return null
        val p = m.optJSONObject("payload") ?: return null
        fun str(o: JSONObject?, k: String): String? = if (o == null || !o.has(k) || o.isNull(k)) null else o.optString(k).takeIf { it.isNotEmpty() }
        return when (m.optString("type")) {
            "ports" -> {
                val arr = p.optJSONArray("ports")
                val entries = buildList {
                    if (arr != null) for (i in 0 until arr.length()) {
                        val e = arr.optJSONObject(i) ?: continue
                        val port = e.optInt("port", 0)
                        if (!Ports.validPort(port)) continue
                        val path = str(e, "path")?.takeIf { Ports.validPath(it) } ?: "/"
                        add(PortEntry(port, str(e, "process"), e.optBoolean("http", false), str(e, "title"), str(e, "known"),
                            path, e.optBoolean("system", false), e.optBoolean("self", false)))
                    }
                }
                val proxy = p.optJSONObject("proxy")
                val on = proxy?.optBoolean("on", false) == true
                PortsNote.Listed(PortList(p.optBoolean("ok", false), p.optBoolean("trusted", true), entries, on,
                    if (on) str(proxy, "token") else null, str(p, "reason"), p.optLong("took", 0)))
            }
            "ports.opened" -> PortsNote.Opened(PortOpened(p.optBoolean("ok", false), p.optInt("port", 0).takeIf { Ports.validPort(it) },
                str(p, "url"), str(p, "how"), str(p, "reason"), p.optBoolean("trusted", true)))
            else -> null
        }
    }
}
