package hu.vrg.mobile.core

import java.time.ZoneId
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Értesítések (WP M10): the notification rules on recorded GitHub answers, the dedupe across polls,
// the first-poll baseline, and the backoff on rate limiting.

class InboxTest {
    private val repo = "https://api.github.com/repos/webagoly-work/vrg-toolset"

    private fun thread(id: String, reason: String, type: String = "PullRequest", n: Int = 12, updated: String = "2026-11-06T10:00:00Z", unread: Boolean = true) = """
        {"id":"$id","unread":$unread,"reason":"$reason","updated_at":"$updated",
         "subject":{"title":"PR $n","url":"$repo/${if (type == "Issue") "issues" else "pulls"}/$n","type":"$type"},
         "repository":{"html_url":"https://github.com/webagoly-work/vrg-toolset"}}"""

    private fun run(id: Long, conclusion: String?, branch: String = "main", wf: Long = 7, at: String = "2026-11-06T10:00:00Z", n: Int = 1, attempt: Int = 1) = """
        {"id":$id,"name":"VRG Mobile (APK)","head_branch":"$branch","status":"${if (conclusion == null) "in_progress" else "completed"}",
         "conclusion":${conclusion?.let { "\"$it\"" } ?: "null"},"workflow_id":$wf,"run_number":$n,"run_attempt":$attempt,
         "display_title":"M10","html_url":"https://github.com/webagoly-work/vrg-toolset/actions/runs/$id","updated_at":"$at"}"""

    private fun runs(vararg r: String) = """{"total_count":${r.size},"workflow_runs":[${r.joinToString(",")}]}"""

    // ---- GitHub threads ---------------------------------------------------------------------------

    @Test fun threadRules() {
        val ev = InboxGitHub.threads("[" + listOf(
            thread("1", "review_requested"), thread("2", "author", n = 13), thread("3", "comment", n = 14),
            thread("4", "mention", "Issue", 15), thread("5", "ci_activity", "CheckSuite"), thread("6", "subscribed", "Release"),
            thread("7", "subscribed", n = 16, unread = false),
        ).joinToString(",") + "]")
        assertEquals(listOf("1", "2", "3", "4", "7"), ev.map { it.thread })
        assertEquals(listOf(true, true, false, true, false), ev.map { it.notify }, "review, own PR, mention ring; a comment elsewhere is only listed")
        assertEquals("https://github.com/webagoly-work/vrg-toolset/pull/12", ev[0].url)
        assertEquals("https://github.com/webagoly-work/vrg-toolset/issues/15", ev[3].url)
        assertEquals("Válasz a PR-edre", ev[1].text)
        assertTrue(ev[4].read)
        assertEquals("gh:1:2026-11-06T10:00:00Z", ev[0].id)
        assertTrue(ev.all { it.kind == InboxKind.PR })
        assertTrue(InboxGitHub.threads("not json").isEmpty())
        assertEquals(setOf("1", "2"), InboxGitHub.threadIds("[${thread("1", "author")},${thread("2", "author")}]"))
    }

    @Test fun htmlUrls() {
        assertEquals("https://github.com/o/r/commit/abc", InboxGitHub.htmlUrl("https://api.github.com/repos/o/r/commits/abc"))
        assertEquals("https://github.com/o/r/releases", InboxGitHub.htmlUrl("https://api.github.com/repos/o/r/releases/9"))
        assertNull(InboxGitHub.htmlUrl("https://evil.example/repos/o/r/pulls/1"))
        assertNull(InboxGitHub.htmlUrl(null))
    }

    // ---- Actions runs ---------------------------------------------------------------------------------

    @Test fun ciFailureAlwaysGreenOnlyAfterFailure() {
        val (a, m1) = InboxGitHub.runs(runs(run(1, "success", at = "2026-11-06T09:00:00Z")), emptyMap())
        assertTrue(a.isEmpty(), "a green run with no failure before it is no news")
        assertEquals("ok", m1["7@main"])

        // newest first, as GitHub sends them: the failure is taken before the green one
        val (b, m2) = InboxGitHub.runs(runs(run(3, "success", at = "2026-11-06T11:00:00Z", n = 3), run(2, "failure", at = "2026-11-06T10:00:00Z", n = 2)), m1)
        assertEquals(listOf("run:2:1", "run:3:1"), b.map { it.id })
        assertEquals(listOf(InboxLevel.BAD, InboxLevel.GOOD), b.map { it.level })
        assertTrue(b.all { it.notify && it.kind == InboxKind.CI })
        assertTrue(b[0].title.contains("elbukott") && b[1].title.contains("újra zöld"))
        assertEquals("main · #2 · M10", b[0].text)
        assertEquals("ok", m2["7@main"])

        val (c, _) = InboxGitHub.runs(runs(run(4, "success", n = 4)), m2)
        assertTrue(c.isEmpty(), "green after green: nothing")
    }

    @Test fun ciIgnoresRunningCancelledDataBranchesAndKeepsBranchesApart() {
        val (a, m) = InboxGitHub.runs(runs(
            run(1, null), run(2, "cancelled"), run(3, "failure", branch = "city-pages"),
            run(4, "timed_out", branch = "claude/m10", at = "2026-11-06T08:00:00Z"),
        ), emptyMap())
        assertEquals(listOf("run:4:1"), a.map { it.id })
        assertNull(m["7@main"], "a cancelled run says nothing about the code")
        val (b, _) = InboxGitHub.runs(runs(run(5, "success", branch = "main")), m)
        assertTrue(b.isEmpty(), "main's green is not 'after a failure': the failure was on another branch")
        val (c, _) = InboxGitHub.runs(runs(run(4, "failure", attempt = 2, branch = "claude/m10")), m)
        assertEquals("run:4:2", c.single().id, "a re-run that fails again is its own event")
        assertTrue(InboxGitHub.runs("{}", m).first.isEmpty())
    }

    // ---- release, notes ---------------------------------------------------------------------------------

    @Test fun releaseOnlyWhenNewer() {
        val j = """{"tag_name":"mobile-v42","name":"VRG Mobile 0.42","published_at":"2026-11-06T12:00:00Z"}"""
        val e = assertNotNull(InboxGitHub.release(j, 41))
        assertEquals("rel:42", e.id)
        assertEquals(Catalogue.UPDATE.id, e.feature)
        assertTrue(e.urgent && e.notify)
        assertNull(InboxGitHub.release(j, 42))
        assertNull(InboxGitHub.release("""{"tag_name":"v9"}""", 1))
    }

    @Test fun noteMessagesNameTheirDevice() {
        assertEquals("mobile-log: 2026-11-06 [mobile] jegyzet (Pixel 8)", NoteLog.message("2026-11-06", "mobile", "Pixel 8"))
        assertEquals("mobile-log: 2026-11-06 jegyzet", NoteLog.message("2026-11-06", null, " "))
        assertEquals("Pixel 8", NoteLog.writtenBy("mobile-log: 2026-11-06 [mobile] jegyzet (Pixel 8)"))
        assertEquals("SM-A556B", NoteLog.writtenBy("mobile-log: 2026-11-06 jegyzet (SM-A556B)\n\nbody"))
        assertNull(NoteLog.writtenBy("mobile-log: 2026-11-06 jegyzet"))
        assertNull(NoteLog.writtenBy("Merge branch main"))
    }

    @Test fun notesFromOtherDevicesOnly() {
        fun c(sha: String, msg: String) = """{"sha":"$sha","html_url":"https://github.com/x/commit/$sha","commit":{"message":"$msg",
            "author":{"name":"Witoo","date":"2026-11-06T10:00:00Z"},"committer":{"date":"2026-11-06T10:00:01Z"}}}"""
        val ev = InboxGitHub.noteCommits("[" + listOf(
            c("a", "mobile-log: 2026-11-06 jegyzet (Pixel 8)"), c("b", "mobile-log: 2026-11-06 [planner] jegyzet (SM-X)"),
            c("c", "log: from the PC"),
        ).joinToString(",") + "]", "Pixel 8")
        assertEquals(listOf("note:b", "note:c"), ev.map { it.id })
        assertEquals("Jegyzet: SM-X", ev[0].title)
        assertEquals("Jegyzet: Witoo", ev[1].title)
        assertTrue(ev.all { it.kind == InboxKind.NOTE && it.notify })
    }

    // ---- the relay ------------------------------------------------------------------------------------------

    @Test fun relayEvents() {
        val n = InboxRelay.parse("""{"from":"relay","type":"notify","t":5,"payload":{"id":"a1b2","title":"Build kész","text":"Kapu","at":1000,"link":"javascript:alert(1)","level":"good"}}""", "pc1", "WORK")
        val e = n.single()
        assertEquals("relay:pc1:a1b2", e.id)
        assertNull(e.url, "only http(s) links are kept")
        assertEquals(InboxLevel.GOOD, e.level)
        assertEquals(InboxSource.RELAY, e.source)

        val listed = InboxRelay.parse("""{"from":"relay","type":"notify.listed","payload":{"ok":true,"entries":[{"id":"x","title":"A","at":1},{"id":"y","at":2},{"id":"z","title":"C","at":3,"link":"https://github.com"}]}}""", "pc1", null)
        assertEquals(listOf("relay:pc1:x", "relay:pc1:z"), listed.map { it.id }, "an entry without a title is dropped")
        assertTrue(InboxRelay.parse("""{"from":"relay","type":"notify.listed","payload":{"ok":false,"trusted":false}}""", "pc1", null).isEmpty())

        val board = InboxRelay.parse("""{"from":"relay","type":"board","t":9,"payload":{"event":"added","id":"0123456789abcdef","name":"terv.pdf","from":"pc"}}""", "pc1", "WORK").single()
        assertEquals("board:0123456789abcdef", board.id)
        assertEquals(Catalogue.DROP.id, board.feature)
        assertTrue(InboxRelay.parse("""{"from":"relay","type":"board","payload":{"event":"added","id":"1","name":"x","from":"phone"}}""", "pc1", null).isEmpty(), "the phone's own upload is no news")
        assertTrue(InboxRelay.parse("""{"from":"phone","type":"notify","payload":{"id":"1","title":"x"}}""", "pc1", null).isEmpty(), "only the relay speaks for the PC")
        assertTrue(InboxRelay.list(5).contains("\"notify.list\"") && InboxRelay.list(5).contains("\"after\":5"))
    }

    @Test fun pcBackOnlyAfterBeingAway() {
        assertNull(InboxRelay.back("pc1", "WORK", null, 1_000_000), "the first contact ever is not 'back'")
        assertNull(InboxRelay.back("pc1", "WORK", 1_000_000, 1_000_000 + InboxRelay.AWAY_MS - 1))
        val e = assertNotNull(InboxRelay.back("pc1", "WORK", 1_000_000, 1_000_000 + InboxRelay.AWAY_MS))
        assertEquals("WORK újra vonalban", e.title)
    }

    // ---- the state: dedupe, baseline, threads -------------------------------------------------------------

    private fun ev(id: String, at: Long, notify: Boolean = true, thread: String? = null, kind: InboxKind = InboxKind.CI, urgent: Boolean = false) =
        InboxEvent(id, kind, id, "", at, thread = thread, notify = notify, urgent = urgent)

    @Test fun firstPollFillsTheListWithoutRinging() {
        val (s1, post1) = InboxState().ingest(listOf(ev("run:1:1", 1), ev("rel:9", 2, urgent = true, kind = InboxKind.UPDATE)), InboxSources.RUNS)
        assertEquals(listOf("rel:9"), post1.map { it.id }, "only the urgent one rings on a first poll")
        assertEquals(2, s1.events.size)
        val (_, post2) = s1.ingest(listOf(ev("run:2:1", 3)), InboxSources.RUNS)
        assertEquals(listOf("run:2:1"), post2.map { it.id })
        val (_, post3) = s1.ingest(listOf(ev("gh:1:t", 3, kind = InboxKind.PR)), InboxSources.THREADS)
        assertTrue(post3.isEmpty(), "each source has its own baseline")
    }

    @Test fun dedupeAcrossPollsAndSources() {
        var s = InboxState().ingest(emptyList(), InboxSources.RUNS).first
        assertTrue(InboxSources.RUNS in s.baselined, "an empty first answer still sets the baseline")
        val (s1, p1) = s.ingest(listOf(ev("run:5:1", 10), ev("run:5:1", 10)), InboxSources.RUNS)
        assertEquals(1, p1.size)
        assertEquals(1, s1.events.size)
        val (s2, p2) = s1.ingest(listOf(ev("run:5:1", 10)), InboxSources.RUNS)
        assertTrue(p2.isEmpty() && s2.events.size == 1, "the same run on the next poll: nothing")
        // a push (D-11 B) delivering an id the poller already had: dropped
        val (_, p3) = s2.ingest(listOf(ev("run:5:1", 10).copy(source = InboxSource.PUSH)), "push")
        assertTrue(p3.isEmpty())
        // an event removed from the list stays seen
        s = s2.copy(events = emptyList())
        assertTrue(s.ingest(listOf(ev("run:5:1", 10)), InboxSources.RUNS).first.events.isEmpty())
        // only notify && unread events ring
        val (_, p4) = s2.ingest(listOf(ev("a", 11, notify = false), ev("b", 12).copy(read = true)), InboxSources.RUNS)
        assertTrue(p4.isEmpty())
    }

    @Test fun aThreadsNewerStateReplacesTheOlderAndReadOnGitHubSyncs() {
        val s0 = InboxState(baselined = setOf(InboxSources.THREADS))
        val (s1, _) = s0.ingest(listOf(ev("gh:1:a", 1, thread = "1", kind = InboxKind.PR), ev("gh:2:a", 2, thread = "2", kind = InboxKind.PR)), InboxSources.THREADS)
        val (s2, p) = s1.ingest(listOf(ev("gh:1:b", 3, thread = "1", kind = InboxKind.PR)), InboxSources.THREADS)
        assertEquals(listOf("gh:1:b", "gh:2:a"), s2.events.map { it.id })
        assertEquals(1, p.size)
        val s3 = s2.syncThreads(setOf("1"))
        assertEquals(listOf(false, true), s3.events.map { it.read }, "thread 2 is no longer unread on GitHub")
        assertEquals(listOf("1"), s3.unreadThreads())
        assertEquals(0, s3.markAllRead().unread)
        assertEquals(1, s3.markRead("gh:2:a").markRead("x").unread)
    }

    @Test fun relayAfterFollowsNotifyEntriesOnly() {
        val (s, _) = InboxState().ingest(listOf(
            ev("relay:pc1:a", 500).copy(source = InboxSource.RELAY), ev("board:1", 900).copy(source = InboxSource.RELAY),
        ), InboxSources.RELAY)
        assertEquals(500, s.relayAfter)
    }

    @Test fun keepsAtMostKeep() {
        val many = (1..(InboxState.KEEP + 20)).map { ev("e$it", it.toLong(), notify = false) }
        val s = InboxState().ingest(many, InboxSources.RUNS).first
        assertEquals(InboxState.KEEP, s.events.size)
        assertEquals("e${InboxState.KEEP + 20}", s.events.first().id, "newest first")
    }

    // ---- polling and backoff ----------------------------------------------------------------------------------

    @Test fun backoffOnRateLimits() {
        assertEquals(listOf(60L, 120L, 240L, 3600L, 3600L), listOf(0, 1, 2, 6, 30).map { InboxPoll.backoffSeconds(it) })
        val spent = mapOf("X-RateLimit-Limit" to "5000", "X-RateLimit-Remaining" to "0", "X-RateLimit-Reset" to "1900")
        assertEquals(900L, InboxPoll.limitedFor(403, spent, "", 1000, 0), "the primary limit: until the reset")
        assertEquals(60L, InboxPoll.limitedFor(403, spent, "", 1890, 0), "never shorter than the backoff")
        assertEquals(120L, InboxPoll.limitedFor(403, emptyMap(), "You have exceeded a secondary rate limit", 0, 1))
        assertEquals(300L, InboxPoll.limitedFor(429, mapOf("retry-after" to "300"), "", 0, 0))
        assertNull(InboxPoll.limitedFor(403, mapOf("X-RateLimit-Remaining" to "4000", "X-RateLimit-Limit" to "5000"), "Resource not accessible", 0, 0), "a plain 403 is not a rate limit")
        assertNull(InboxPoll.limitedFor(404, emptyMap(), "rate limit", 0, 0))

        val s = InboxState(lastPoll = 1_000_000).limited(1_000_000, 120)
        assertEquals(1, s.failures)
        assertFalse(InboxPoll.due(s, 1_000_000 + 119_000, manual = false), "the worker stays away while backing off")
        assertTrue(InboxPoll.due(s, 1_000_000 + 120_000, manual = false))
        val ok = s.polled(2_000_000, 300)
        assertEquals(0, ok.failures)
        assertEquals(300, ok.pollEvery)
        assertFalse(InboxPoll.due(ok, 2_000_000 + 299_000, manual = true), "a manual ⟳ honours X-Poll-Interval")
        assertTrue(InboxPoll.due(ok, 2_000_000 + 299_000, manual = false), "the 15-minute worker always may")
        assertTrue(InboxPoll.due(ok, 1_000, manual = true), "a clock moved back does not block")
        assertFalse(InboxPoll.dueOnOpen(ok, 2_000_000 + InboxPoll.OPEN_GAP_MS - 1), "coming back to the app a minute later: no new round")
        assertTrue(InboxPoll.dueOnOpen(ok, 2_000_000 + InboxPoll.OPEN_GAP_MS))
        assertFalse(InboxPoll.dueOnOpen(s.copy(backoffUntil = 10_000_000), 9_000_000), "nor while backing off")
        assertEquals(60L, InboxPoll.pollInterval(mapOf("x-poll-interval" to "60")))
        assertNull(InboxPoll.pollInterval(mapOf("X-Poll-Interval" to "0")))
    }

    // ---- storage and the list ------------------------------------------------------------------------------------

    @Test fun jsonRoundTripAndDays() {
        val zone = ZoneId.of("Europe/Budapest")
        val e1 = InboxEvent("gh:1:a", InboxKind.PR, "PR 1", "Review kérés", 1_762_416_000_000, "https://github.com/x/pull/1", null, "1", InboxLevel.INFO, true, false)
        val e2 = InboxEvent("relay:pc:1", InboxKind.RELAY, "Kész", "", 1_762_416_000_000 - 86_400_000, null, "drop", null, InboxLevel.GOOD, true, true, InboxSource.RELAY, true)
        val s = InboxState(listOf(e1, e2), listOf("gh:1:a", "relay:pc:1"), mapOf("7@main" to "fail"), setOf("runs"), 5, 6, 2, 90, mapOf("pc" to 77L), 44)
        assertEquals(s, InboxState.fromJson(s.toJson()))
        assertEquals(InboxState(), InboxState.fromJson("{broken"))
        assertEquals(InboxState(), InboxState.fromJson(null))
        val days = s.days(null, zone)
        assertEquals(2, days.size)
        assertEquals(listOf("gh:1:a"), days.first().second.map { it.id })
        assertEquals(listOf("relay:pc:1"), s.days(InboxKind.RELAY, zone).single().second.map { it.id })
    }
}
