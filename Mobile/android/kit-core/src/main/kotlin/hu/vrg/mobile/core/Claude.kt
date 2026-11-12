package hu.vrg.mobile.core

import org.json.JSONArray
import org.json.JSONObject

// Claude (WP M22): the phone's side, as plain rules. VRG Mobile never signs in to Claude: the official Claude app does, and the phone
// only opens it (ClaudeApp). With a paired PC whose relay runs with --claude, the relay lists the folders where it may start a Remote
// Control session (START's own Claude Code menu), the sessions it started, and starts or stops one (ClaudeMsgs; the relay's rules in
// Planner/projects/varler-planner/tools/relay-claude.js). A session's link opens in the Claude app, where the PC's session is then
// driven from the phone: the "even more like the full Desktop" the user asked for.

object ClaudeApp {
    /** The official Claude app on Android. Its sign-in is the only Claude sign-in on the phone. */
    const val PACKAGE = "com.anthropic.claude"
    /** Without the app: the web, in the phone's browser. */
    const val WEB = "https://claude.ai/"
    const val STORE = "https://play.google.com/store/apps/details?id=$PACKAGE"

    private val LINK = Regex("^https://claude\\.ai/[A-Za-z0-9._~:/?#\\[\\]@!$&'()*+,;=%-]*$")

    /** A link the phone may open: claude.ai over https only (a session link comes from the PC, so it is checked here too). */
    fun isLink(url: String?): Boolean = url != null && url.length <= 2048 && LINK.matches(url)

    /** What a tap on "open" does: the app when installed (the link handed to it), else the browser. */
    fun target(url: String?, installed: Boolean): ClaudeOpen {
        val u = url?.takeIf { isLink(it) } ?: WEB
        return ClaudeOpen(u, if (installed) PACKAGE else null)
    }
}

/** An ACTION_VIEW of [url], with the Claude app as its package, or none (the browser). */
data class ClaudeOpen(val url: String, val pkg: String?)

data class ClaudeFolder(val key: String, val name: String, val hint: String)

data class ClaudeSession(
    val id: String, val name: String, val folder: String, val account: String,
    val started: Long, val url: String?, val alive: Boolean,
)

data class ClaudeList(
    val ok: Boolean,
    val trusted: Boolean = true,
    /** The relay runs with --claude. */
    val on: Boolean = false,
    val folders: List<ClaudeFolder> = emptyList(),
    val accounts: List<String> = emptyList(),
    val sessions: List<ClaudeSession> = emptyList(),
    val reason: String? = null,
) {
    fun folderName(key: String): String = folders.firstOrNull { it.key == key }?.name ?: key
}

data class ClaudeStarted(val ok: Boolean, val session: ClaudeSession?, val waiting: Boolean, val reason: String?, val trusted: Boolean = true)
data class ClaudeStopped(val ok: Boolean, val id: String?, val reason: String?)

sealed interface ClaudeNote {
    data class Listed(val list: ClaudeList) : ClaudeNote
    data class Started(val result: ClaudeStarted) : ClaudeNote
    data class Stopped(val result: ClaudeStopped) : ClaudeNote
}

object ClaudeMsgs {
    const val CAP = "claude"
    private val KEY = Regex("^[A-Z0-9]$")
    private val SID = Regex("^c[0-9]{1,6}$")

    fun list(): String = RelayMsgs.build("claude.list", JSONObject(), "relay")

    /** Null for a key or account not of the list's shape; the relay checks both against its own lists anyway. */
    fun start(folder: String, account: String = "A"): String? =
        if (KEY.matches(folder) && (account == "A" || account == "B"))
            RelayMsgs.build("claude.start", JSONObject().put("folder", folder).put("account", account), "relay") else null

    fun stop(id: String): String? = if (SID.matches(id)) RelayMsgs.build("claude.stop", JSONObject().put("id", id), "relay") else null

    private fun str(o: JSONObject?, k: String): String? =
        if (o == null || !o.has(k) || o.isNull(k)) null else o.optString(k).takeIf { it.isNotEmpty() }

    private fun session(o: JSONObject?): ClaudeSession? {
        val id = str(o, "id")?.takeIf { SID.matches(it) } ?: return null
        return ClaudeSession(id, str(o, "name") ?: id, str(o, "folder") ?: "", if (str(o, "account") == "B") "B" else "A",
            o!!.optLong("started", 0), str(o, "url")?.takeIf { ClaudeApp.isLink(it) }, o.optBoolean("alive", false))
    }

    private fun <T> objects(a: JSONArray?, f: (JSONObject) -> T?): List<T> = buildList {
        if (a != null) for (i in 0 until a.length()) a.optJSONObject(i)?.let(f)?.let(::add)
    }

    fun parse(raw: String): ClaudeNote? {
        val m = try { JSONObject(raw) } catch (e: Exception) { return null }
        if (m.optString("from") != "relay") return null
        val p = m.optJSONObject("payload") ?: return null
        val ok = p.optBoolean("ok", false)
        return when (m.optString("type")) {
            "claude" -> ClaudeNote.Listed(ClaudeList(
                ok, p.optBoolean("trusted", true), p.optBoolean("on", false),
                objects(p.optJSONArray("folders")) { f -> str(f, "key")?.takeIf { KEY.matches(it) }?.let { ClaudeFolder(it, str(f, "name") ?: it, str(f, "hint") ?: "") } },
                buildList { p.optJSONArray("accounts")?.let { a -> for (i in 0 until a.length()) a.optString(i).takeIf { it == "A" || it == "B" }?.let(::add) } },
                objects(p.optJSONArray("sessions"), ::session),
                str(p, "reason"),
            ))
            "claude.started" -> ClaudeNote.Started(ClaudeStarted(ok, session(p.optJSONObject("session")), p.optBoolean("waiting", false), str(p, "reason"), p.optBoolean("trusted", true)))
            "claude.stopped" -> ClaudeNote.Stopped(ClaudeStopped(ok, str(p, "id"), str(p, "reason")))
            else -> null
        }
    }
}
