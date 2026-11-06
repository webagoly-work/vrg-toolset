package hu.vrg.mobile.core

import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

// Értesítések (WP M10, D-11 = C): one list of what happened, and a phone notification for what matters.
// Everything here is rules, tested on the JVM against recorded GitHub answers; the Android side (kit's
// GitHub.poll, kit's VrgNotify, feature-inbox's worker) only moves bytes and posts what this file decides.
//
//   sources                         ─▶ InboxEvent[] ─▶ InboxState.ingest ─▶ (list, the ones to post)
//   POLL   GitHub every 15 min (WorkManager): /repos/{r}/notifications, /actions/runs, /releases/latest,
//          the mobile-log branch's commits — all conditional (ETag / If-Modified-Since), so a quiet repo
//          costs no rate limit
//   RELAY  live while the phone is on the PC's WiFi: the relay's `notify` (and notify.listed for the ones
//          missed), a file put on the board from the PC, the PC back on the line after a while
//   PUSH   reserved for D-11 B (a push service, a later WP): it delivers the same ids as the poller, so
//          whichever comes first wins and the other is dropped by the dedupe
//
// The rules (WP M10): a CI failure notifies always; a green run notifies only after a failure on the same
// workflow and branch; on GitHub threads only a review request, a mention, an assignment and activity on
// the user's own PR / issue notify (a comment on someone else's PR is listed, not rung); a new release
// notifies; the first poll of a source only fills the list (no flood of old news after installing).

/** Android notification channels, one per kind the user may want to silence (switchable in Beállítások). */
enum class InboxChannel(val id: String, val title: String, val blurb: String) {
    CI("vrg.ci", "CI", "Egy Actions futás elbukott, vagy egy bukás után újra zöld."),
    PR("vrg.pr", "PR", "Review kérés, válasz a te PR-edre vagy issue-dra, megemlítés."),
    RELAY("vrg.relay", "Relé", "A PC jelzése ugyanazon a WiFi-n: fájl a táblán, a PC újra vonalban, PC-s üzenet."),
    UPDATE("vrg.update", "Frissítés", "Új VRG Mobile verzió a GitHubon."),
    NOTE("vrg.note", "Jegyzet", "Jegyzet a naplóba (mobile-log) egy másik eszközről."),
}

/** What an event is about; also the list's filters, in this order. */
enum class InboxKind(val wire: String, val label: String, val channel: InboxChannel) {
    CI("ci", "CI", InboxChannel.CI),
    PR("pr", "PR", InboxChannel.PR),
    RELAY("relay", "Relé", InboxChannel.RELAY),
    NOTE("note", "Jegyzet", InboxChannel.NOTE),
    UPDATE("update", "Frissítés", InboxChannel.UPDATE);

    companion object {
        fun of(s: String?): InboxKind? = entries.firstOrNull { it.wire == s }
    }
}

enum class InboxLevel(val wire: String) {
    INFO("info"), GOOD("good"), BAD("bad");

    companion object {
        fun of(s: String?): InboxLevel = entries.firstOrNull { it.wire == s } ?: INFO
    }
}

/** Where an event came from. PUSH is D-11 B's slot (not built yet). */
enum class InboxSource(val wire: String) {
    POLL("poll"), RELAY("relay"), PUSH("push");

    companion object {
        fun of(s: String?): InboxSource = entries.firstOrNull { it.wire == s } ?: POLL
    }
}

data class InboxEvent(
    /** Stable across polls and sources: the dedupe key. `gh:<thread>:<updated>`, `run:<id>:<attempt>`, `rel:<code>`, … */
    val id: String,
    val kind: InboxKind,
    val title: String,
    val text: String,
    /** Epoch milliseconds. */
    val at: Long,
    /** The web page a tap opens (github.com, never the API). */
    val url: String? = null,
    /** Or a feature of the app a tap opens (Frissítés, Átadás, Gyorsjegyzet). */
    val feature: String? = null,
    /** The GitHub notification thread, marked read on GitHub when read here. */
    val thread: String? = null,
    val level: InboxLevel = InboxLevel.INFO,
    /** Worth a phone notification, by the rules above. */
    val notify: Boolean = false,
    val read: Boolean = false,
    val source: InboxSource = InboxSource.POLL,
    /** Rung even on a source's first poll (a new release is news whenever it is first seen). */
    val urgent: Boolean = false,
)

/** The poller's sources; each has its own first-poll baseline. */
object InboxSources {
    const val THREADS = "threads"
    const val RUNS = "runs"
    const val RELEASE = "release"
    const val NOTES = "notes"
    const val RELAY = "relay"
}

/** GitHub's answers, turned into events. */
object InboxGitHub {
    const val NOTIFICATIONS = "${VrgRepo.PATH}/notifications"
    const val RUNS = "${VrgRepo.PATH}/actions/runs?per_page=10"
    const val RELEASE = Updates.LATEST
    const val NOTE_COMMITS = "${VrgRepo.PATH}/commits?sha=${NoteLog.BRANCH}&per_page=10"

    /** Generated branches: their runs are machinery, not work (the same list M4 and M5 skip). */
    val DATA_BRANCHES = setOf(CityPages.BRANCH, NoteLog.BRANCH, "solomon-data")

    private val BAD_RUN = setOf("failure", "timed_out", "startup_failure")
    private val RINGS = setOf("review_requested", "author", "mention", "team_mention", "assign", "security_alert")

    fun time(iso: String?): Long = try { Instant.parse(iso).toEpochMilli() } catch (e: Exception) { 0L }

    /** api.github.com/repos/o/r/pulls/12 → github.com/o/r/pull/12 (issues, commits and releases alike). */
    fun htmlUrl(api: String?): String? {
        if (api.isNullOrEmpty()) return null
        val m = Regex("""^https://api\.github\.com/repos/([^/]+/[^/]+)/(pulls|issues|commits|releases)/([^/?#]+)$""").find(api) ?: return null
        val (repo, what, id) = m.destructured
        val seg = when (what) { "pulls" -> "pull"; "issues" -> "issues"; "commits" -> "commit"; else -> "releases" }
        return if (what == "releases") "https://github.com/$repo/releases" else "https://github.com/$repo/$seg/$id"
    }

    private fun reasonText(reason: String, type: String): String = when (reason) {
        "review_requested" -> "Review kérés"
        "author" -> if (type == "PullRequest") "Válasz a PR-edre" else "Válasz az issue-dra"
        "mention", "team_mention" -> "Megemlítettek"
        "assign" -> "Rád osztották"
        "comment" -> "Hozzászólás"
        "state_change" -> "Állapot változott"
        "security_alert" -> "Biztonsági figyelmeztetés"
        else -> "Új esemény"
    }

    /**
     * GET /repos/{r}/notifications (unread threads). Check suites and releases are left to the runs and the
     * release sources, which know more (a green build after a failure, the version code).
     */
    fun threads(json: String): List<InboxEvent> = try {
        val a = JSONArray(json)
        (0 until a.length()).mapNotNull { i ->
            val o = a.optJSONObject(i) ?: return@mapNotNull null
            val s = o.optJSONObject("subject") ?: return@mapNotNull null
            val type = s.optString("type")
            if (type == "CheckSuite" || type == "Release") return@mapNotNull null
            val thread = o.optString("id").ifEmpty { return@mapNotNull null }
            val updated = o.optString("updated_at")
            val reason = o.optString("reason")
            if (reason == "ci_activity") return@mapNotNull null
            val repoUrl = o.optJSONObject("repository")?.optString("html_url")?.ifEmpty { null }
            InboxEvent(
                id = "gh:$thread:$updated",
                kind = InboxKind.PR,
                title = s.optString("title").ifEmpty { "(cím nélkül)" },
                text = reasonText(reason, type) + if (type == "Issue") " · issue" else "",
                at = time(updated),
                url = htmlUrl(s.optString("url").ifEmpty { null }) ?: repoUrl,
                thread = thread,
                notify = reason in RINGS,
                read = !o.optBoolean("unread", true),
            )
        }
    } catch (e: Exception) { emptyList() }

    /** The thread ids an answer of [NOTIFICATIONS] holds (unread on GitHub); the others were read there. */
    fun threadIds(json: String): Set<String> = try {
        val a = JSONArray(json)
        (0 until a.length()).mapNotNull { a.optJSONObject(it)?.optString("id")?.ifEmpty { null } }.toSet()
    } catch (e: Exception) { emptySet() }

    /**
     * GET /actions/runs, completed runs only, oldest first. [ci] remembers each workflow + branch's last
     * outcome ("fail" / "ok"), so a green run is news only after a red one. Returns the events and the new memory.
     */
    fun runs(json: String, ci: Map<String, String>): Pair<List<InboxEvent>, Map<String, String>> {
        val memory = ci.toMutableMap()
        val out = ArrayList<InboxEvent>()
        val a = try { JSONObject(json).getJSONArray("workflow_runs") } catch (e: Exception) { return emptyList<InboxEvent>() to ci }
        val runs = (0 until a.length()).mapNotNull { a.optJSONObject(it) }
            .filter { it.optString("status") == "completed" && it.optString("head_branch") !in DATA_BRANCHES }
            .sortedBy { time(it.optString("updated_at")) }
        for (r in runs) {
            val branch = r.optString("head_branch")
            val key = "${r.optLong("workflow_id")}@$branch"
            val conclusion = r.optString("conclusion")
            val name = r.optString("name").ifEmpty { "Actions" }
            val id = "run:${r.optLong("id")}:${r.optInt("run_attempt", 1)}"
            val text = listOf(branch, "#${r.optInt("run_number")}", r.optString("display_title")).filter { it.isNotEmpty() && it != "#0" }.joinToString(" · ")
            val at = time(r.optString("updated_at"))
            val url = r.optString("html_url").ifEmpty { null }
            when {
                conclusion in BAD_RUN -> {
                    out += InboxEvent(id, InboxKind.CI, "✕ $name elbukott", text, at, url, level = InboxLevel.BAD, notify = true)
                    memory[key] = "fail"
                }
                conclusion == "success" -> {
                    if (memory[key] == "fail") out += InboxEvent(id, InboxKind.CI, "✓ $name újra zöld", text, at, url, level = InboxLevel.GOOD, notify = true)
                    memory[key] = "ok"
                }
                // cancelled, skipped, neutral: says nothing about the code
            }
        }
        return out to memory
    }

    private val TAG = Regex("""^mobile-v(\d+)$""")

    /** GET /releases/latest: an event only when it is newer than the installed build. */
    fun release(json: String, installedCode: Long): InboxEvent? = try {
        val o = JSONObject(json)
        val code = TAG.find(o.optString("tag_name"))?.groupValues?.get(1)?.toLongOrNull()
        if (code == null || code <= installedCode) null
        else InboxEvent(
            "rel:$code", InboxKind.UPDATE, "Új verzió: ${o.optString("name").ifEmpty { "build $code" }}",
            "Koppints a frissítéshez (Frissítés).", time(o.optString("published_at")),
            feature = Catalogue.UPDATE.id, level = InboxLevel.GOOD, notify = true, urgent = true,
        )
    } catch (e: Exception) { null }

    /**
     * GET /commits?sha=mobile-log: a note written by another device. This phone's own notes end in
     * "(<its model>)" (NoteWriter's [NoteLog.message]); two phones of one model cannot be told apart.
     */
    fun noteCommits(json: String, ownDevice: String): List<InboxEvent> = try {
        val a = JSONArray(json)
        (0 until a.length()).mapNotNull { i ->
            val o = a.optJSONObject(i) ?: return@mapNotNull null
            val c = o.optJSONObject("commit") ?: return@mapNotNull null
            val msg = c.optString("message").lineSequence().first()
            if (NoteLog.writtenBy(msg) == ownDevice) return@mapNotNull null
            val sha = o.optString("sha").ifEmpty { return@mapNotNull null }
            val who = NoteLog.writtenBy(msg) ?: c.optJSONObject("author")?.optString("name")?.ifEmpty { null } ?: "másik eszköz"
            InboxEvent(
                "note:$sha", InboxKind.NOTE, "Jegyzet: $who", msg,
                time(c.optJSONObject("committer")?.optString("date") ?: c.optJSONObject("author")?.optString("date")),
                url = o.optString("html_url").ifEmpty { null }, notify = true,
            )
        }
    } catch (e: Exception) { emptyList() }
}

/**
 * The relay's side (live while connected): `notify` from a tool on the PC (the relay keeps the last few, so
 * `notify.list` after a reconnect brings the missed ones), a file put on the board from the PC (M12).
 *
 *   phone ─ notify.list{after} ─▶ relay ─ notify.listed{ok, entries[]}      relay ─ notify{id, kind, title, text, at, link?}
 */
object InboxRelay {
    const val CAP = "notify"
    /** The PC back on the line rings only after this long away; a WiFi blip does not. */
    const val AWAY_MS = 10L * 60 * 1000

    fun list(after: Long): String = RelayMsgs.build("notify.list", JSONObject().put("after", after), "relay")

    private fun str(o: JSONObject?, k: String): String? =
        if (o == null || !o.has(k) || o.isNull(k)) null else o.optString(k).takeIf { it.isNotEmpty() }

    /** One relay notify payload; [pcId] keeps two PCs' ids apart. Only http(s) links are kept. */
    fun entry(p: JSONObject, pcId: String?): InboxEvent? {
        val id = str(p, "id") ?: return null
        val title = str(p, "title") ?: return null
        val link = str(p, "link")?.takeIf { it.startsWith("https://") || it.startsWith("http://") }
        return InboxEvent(
            "relay:${pcId ?: "pc"}:$id", InboxKind.RELAY, title, str(p, "text").orEmpty(),
            p.optLong("at").takeIf { it > 0 } ?: 0L, url = link,
            level = InboxLevel.of(str(p, "level")), notify = true, source = InboxSource.RELAY,
        )
    }

    /** Any relay message that is news for the inbox; empty for the rest. */
    fun parse(raw: String, pcId: String?, pcName: String?): List<InboxEvent> {
        val m = try { JSONObject(raw) } catch (e: Exception) { return emptyList() }
        if (m.optString("from") != "relay") return emptyList()
        val p = m.optJSONObject("payload") ?: return emptyList()
        return when (m.optString("type")) {
            "notify" -> listOfNotNull(entry(p, pcId))
            "notify.listed" -> {
                if (!p.optBoolean("ok")) return emptyList()
                val a = p.optJSONArray("entries") ?: return emptyList()
                (0 until a.length()).mapNotNull { a.optJSONObject(it)?.let { e -> entry(e, pcId) } }
            }
            "board" -> {
                if (str(p, "event") != "added" || str(p, "from") != "pc") return emptyList()
                val id = str(p, "id") ?: return emptyList()
                listOf(InboxEvent(
                    "board:$id", InboxKind.RELAY, "Fájl a PC-ről: ${str(p, "name") ?: "?"}",
                    "A táblán vár" + (pcName?.let { " ($it)" } ?: "") + ". Koppints: Átadás.",
                    p.optLong("at").takeIf { it > 0 } ?: m.optLong("t"), feature = Catalogue.DROP.id,
                    notify = true, source = InboxSource.RELAY,
                ))
            }
            else -> emptyList()
        }
    }

    /** The trusted link to a PC came up: news only when the phone had not heard from it for [AWAY_MS]. */
    fun back(pcId: String, pcName: String, lastSeen: Long?, now: Long): InboxEvent? {
        if (lastSeen == null || now - lastSeen < AWAY_MS) return null
        return InboxEvent(
            "pc:$pcId:$now", InboxKind.RELAY, "$pcName újra vonalban", "A relé elérhető ezen a WiFi-n.", now,
            feature = Catalogue.LAUNCH.id, notify = true, source = InboxSource.RELAY,
        )
    }
}

/** When the poller may ask GitHub, and how long it stays away after being told to. */
object InboxPoll {
    /** WorkManager's minimum period. */
    const val PERIOD_MIN = 15L
    /** A manual ⟳ is not sent more often than this, nor than GitHub's X-Poll-Interval. */
    const val MIN_GAP_S = 60L
    const val MAX_BACKOFF_S = 60L * 60

    /** 1, 2, 4 … 60 minutes after the 1st, 2nd, 3rd … rate limit in a row. */
    fun backoffSeconds(failures: Int): Long = minOf(MAX_BACKOFF_S, 60L shl failures.coerceIn(0, 6))

    fun due(s: InboxState, now: Long, manual: Boolean): Boolean {
        if (now < s.backoffUntil) return false
        if (!manual) return true
        return now < s.lastPoll || now - s.lastPoll >= maxOf(MIN_GAP_S, s.pollEvery) * 1000
    }

    /** The app came on screen: a round only when the last one is [OPEN_GAP_MS] old (switching apps is not a reason). */
    const val OPEN_GAP_MS = 5L * 60 * 1000

    fun dueOnOpen(s: InboxState, now: Long): Boolean =
        due(s, now, manual = false) && (now < s.lastPoll || now - s.lastPoll >= OPEN_GAP_MS)

    /**
     * How long to wait after an answer, or null when it is not a rate limit: 429 always; 403 when the
     * primary limit is spent, or a secondary limit (Retry-After, or GitHub's "rate limit" message).
     * The wait is GitHub's (Retry-After, X-RateLimit-Reset) but never shorter than the backoff.
     */
    fun limitedFor(code: Int, headers: Map<String, String>, body: String, nowS: Long, failures: Int): Long? {
        if (code != 403 && code != 429) return null
        val h = headers.mapKeys { it.key.lowercase() }
        val retry = h["retry-after"]?.trim()?.toLongOrNull()
        val rate = RateLimit.parse(headers)
        val limited = code == 429 || retry != null || rate?.exhausted == true || body.contains("rate limit", ignoreCase = true)
        if (!limited) return null
        val told = retry ?: rate?.takeIf { it.exhausted }?.waitSeconds(nowS) ?: 0L
        return maxOf(told, backoffSeconds(failures))
    }

    /** X-Poll-Interval (seconds) of the notifications endpoint, when GitHub sends one. */
    fun pollInterval(headers: Map<String, String>): Long? =
        headers.entries.firstOrNull { it.key.equals("x-poll-interval", ignoreCase = true) }?.value?.trim()?.toLongOrNull()?.takeIf { it > 0 }
}

/** The inbox, stored as JSON on the phone. Every change returns a new value. */
data class InboxState(
    /** Newest first, at most [KEEP]. */
    val events: List<InboxEvent> = emptyList(),
    /** Every id ever taken in (at most [SEEN]), so an event cleared from the list does not come back. */
    val seen: List<String> = emptyList(),
    /** Each workflow + branch's last outcome (InboxGitHub.runs). */
    val ci: Map<String, String> = emptyMap(),
    /** Sources polled at least once: their first answer only fills the list. */
    val baselined: Set<String> = emptySet(),
    val lastPoll: Long = 0,
    val backoffUntil: Long = 0,
    val failures: Int = 0,
    /** GitHub's X-Poll-Interval, seconds. */
    val pollEvery: Long = InboxPoll.MIN_GAP_S,
    /** Last contact with each PC over the relay (pcId → ms), for "újra vonalban". */
    val pcSeen: Map<String, Long> = emptyMap(),
    /** The newest relay notify taken in, asked for with notify.list after a reconnect. */
    val relayAfter: Long = 0,
) {
    val unread: Int get() = events.count { !it.read }

    /**
     * Takes [new] in from [source]: unknown ids only; a newer state of a GitHub thread replaces the older one.
     * Returns the new state and the events to post as phone notifications.
     */
    fun ingest(new: List<InboxEvent>, source: String): Pair<InboxState, List<InboxEvent>> {
        val known = seen.toHashSet()
        val fresh = new.filter { it.id !in known }.distinctBy { it.id }
        val first = source !in baselined
        if (fresh.isEmpty()) return copy(baselined = baselined + source) to emptyList()
        val threads = fresh.mapNotNull { it.thread }.toSet()
        val kept = events.filterNot { it.thread != null && it.thread in threads }
        val merged = (fresh + kept).sortedByDescending { it.at }.take(KEEP)
        val post = fresh.filter { it.notify && !it.read && (!first || it.urgent) }
        val relay = fresh.filter { it.id.startsWith("relay:") }.maxOfOrNull { it.at } ?: 0L
        return copy(
            events = merged,
            seen = (seen + fresh.map { it.id }).takeLast(SEEN),
            baselined = baselined + source,
            relayAfter = maxOf(relayAfter, relay),
        ) to post
    }

    /** Threads no longer in GitHub's unread list were read there (or on another device): read here too. */
    fun syncThreads(unreadOnGitHub: Set<String>): InboxState =
        copy(events = events.map { if (it.thread != null && !it.read && it.thread !in unreadOnGitHub) it.copy(read = true) else it })

    fun markRead(id: String): InboxState = copy(events = events.map { if (it.id == id) it.copy(read = true) else it })

    fun markAllRead(kind: InboxKind? = null): InboxState =
        copy(events = events.map { if (kind == null || it.kind == kind) it.copy(read = true) else it })

    /** The GitHub threads that are unread here, to mark read there with "Mind olvasott". */
    fun unreadThreads(kind: InboxKind? = null): List<String> =
        events.filter { !it.read && it.thread != null && (kind == null || it.kind == kind) }.mapNotNull { it.thread }

    fun byId(id: String?): InboxEvent? = events.firstOrNull { it.id == id }

    fun polled(now: Long, pollEvery: Long?): InboxState = copy(lastPoll = now, failures = 0, backoffUntil = 0, pollEvery = pollEvery ?: this.pollEvery)

    fun limited(now: Long, waitSeconds: Long): InboxState = copy(backoffUntil = now + waitSeconds * 1000, failures = failures + 1)

    fun seenPc(pcId: String, now: Long): InboxState = copy(pcSeen = pcSeen + (pcId to now))

    /** The list for one filter (null = all), grouped by day, newest first. */
    fun days(kind: InboxKind?, zone: ZoneId): List<Pair<LocalDate, List<InboxEvent>>> =
        events.filter { kind == null || it.kind == kind }
            .groupBy { Instant.ofEpochMilli(it.at).atZone(zone).toLocalDate() }
            .toList().sortedByDescending { it.first }

    fun toJson(): String = JSONObject()
        .put("events", JSONArray(events.map { eventJson(it) }))
        .put("seen", JSONArray(seen))
        .put("ci", JSONObject(ci as Map<*, *>))
        .put("baselined", JSONArray(baselined.toList()))
        .put("lastPoll", lastPoll).put("backoffUntil", backoffUntil).put("failures", failures).put("pollEvery", pollEvery)
        .put("pcSeen", JSONObject(pcSeen as Map<*, *>))
        .put("relayAfter", relayAfter)
        .toString()

    companion object {
        const val KEEP = 300
        const val SEEN = 2000

        fun eventJson(e: InboxEvent): JSONObject = JSONObject()
            .put("id", e.id).put("kind", e.kind.wire).put("title", e.title).put("text", e.text).put("at", e.at)
            .put("url", e.url ?: JSONObject.NULL).put("feature", e.feature ?: JSONObject.NULL).put("thread", e.thread ?: JSONObject.NULL)
            .put("level", e.level.wire).put("notify", e.notify).put("read", e.read).put("source", e.source.wire).put("urgent", e.urgent)

        private fun str(o: JSONObject, k: String): String? = if (!o.has(k) || o.isNull(k)) null else o.optString(k).ifEmpty { null }

        fun eventOf(o: JSONObject): InboxEvent? {
            val kind = InboxKind.of(str(o, "kind")) ?: return null
            return InboxEvent(
                str(o, "id") ?: return null, kind, o.optString("title"), o.optString("text"), o.optLong("at"),
                str(o, "url"), str(o, "feature"), str(o, "thread"), InboxLevel.of(str(o, "level")),
                o.optBoolean("notify"), o.optBoolean("read"), InboxSource.of(str(o, "source")), o.optBoolean("urgent"),
            )
        }

        /** Anything unreadable gives an empty inbox rather than a crash. */
        fun fromJson(s: String?): InboxState {
            if (s.isNullOrEmpty()) return InboxState()
            return try {
                val o = JSONObject(s)
                fun arr(k: String) = o.optJSONArray(k) ?: JSONArray()
                fun strings(k: String) = arr(k).let { a -> (0 until a.length()).map { a.optString(it) }.filter { it.isNotEmpty() } }
                fun longs(k: String): Map<String, Long> = o.optJSONObject(k)?.let { m -> m.keys().asSequence().associateWith { m.optLong(it) } } ?: emptyMap()
                InboxState(
                    events = arr("events").let { a -> (0 until a.length()).mapNotNull { a.optJSONObject(it)?.let(::eventOf) } },
                    seen = strings("seen"),
                    ci = o.optJSONObject("ci")?.let { m -> m.keys().asSequence().associateWith { m.optString(it) } } ?: emptyMap(),
                    baselined = strings("baselined").toSet(),
                    lastPoll = o.optLong("lastPoll"), backoffUntil = o.optLong("backoffUntil"), failures = o.optInt("failures"),
                    pollEvery = o.optLong("pollEvery", InboxPoll.MIN_GAP_S),
                    pcSeen = longs("pcSeen"),
                    relayAfter = o.optLong("relayAfter"),
                )
            } catch (e: Exception) { InboxState() }
        }
    }
}
