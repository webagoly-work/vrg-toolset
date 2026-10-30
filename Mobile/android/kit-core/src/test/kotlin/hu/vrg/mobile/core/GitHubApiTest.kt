package hu.vrg.mobile.core

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Recorded answers in the shape GitHub documents for the device flow and the REST API. The tests
// never call GitHub.
class GitHubApiTest {

    private val codeJson = """{"device_code":"3584d83530557fdd1f46af8289938c8ef79f9dc5","user_code":"WDJB-MJHT",
        "verification_uri":"https://github.com/login/device","expires_in":900,"interval":5}"""

    @Test fun deviceCodeParses() {
        val c = DeviceCode.parse(codeJson)!!
        assertEquals("WDJB-MJHT", c.userCode)
        assertEquals(5, c.interval)
        assertEquals(900, c.expiresIn)
        assertNull(DeviceCode.parse("""{"error":"device_flow_disabled"}"""))
        assertEquals("Az OAuth Appban nincs bekapcsolva a Device Flow.", DeviceCode.error("""{"error":"device_flow_disabled"}"""))
        assertNull(DeviceCode.parse("nem json"))
    }

    @Test fun tokenPollAnswers() {
        assertEquals(TokenPoll.Pending, TokenPoll.parse("""{"error":"authorization_pending","error_description":"..."}"""))
        assertEquals(TokenPoll.SlowDown(10), TokenPoll.parse("""{"error":"slow_down","interval":10}"""))
        assertEquals(TokenPoll.SlowDown(null), TokenPoll.parse("""{"error":"slow_down"}"""))
        assertEquals(TokenPoll.Expired, TokenPoll.parse("""{"error":"expired_token"}"""))
        assertEquals(TokenPoll.Denied, TokenPoll.parse("""{"error":"access_denied"}"""))
        assertEquals(
            TokenPoll.Success("gho_16C7e42F292c6912E7710c838347Ae178B4a", listOf("repo", "notifications")),
            TokenPoll.parse("""{"access_token":"gho_16C7e42F292c6912E7710c838347Ae178B4a","token_type":"bearer","scope":"repo,notifications"}"""),
        )
        assertIs<TokenPoll.Failed>(TokenPoll.parse("""{"error":"incorrect_device_code"}"""))
    }

    @Test fun theFlowPollsSlowsDownAndFinishes() {
        val c = DeviceCode.parse(codeJson)!!
        var s = DeviceFlow.start(c, now = 1000)
        var step = DeviceFlow.next(s, TokenPoll.Pending, 1005)
        assertEquals(5, (step as DeviceFlow.Step.Wait).seconds)
        s = step.state
        step = DeviceFlow.next(s, TokenPoll.SlowDown(null), 1010)
        assertEquals(10, (step as DeviceFlow.Step.Wait).seconds, "slow_down without an interval: +5 s")
        s = step.state
        step = DeviceFlow.next(s, TokenPoll.SlowDown(20), 1020)
        assertEquals(20, (step as DeviceFlow.Step.Wait).seconds, "GitHub's interval wins when it is larger")
        s = step.state
        step = DeviceFlow.next(s, TokenPoll.Pending, 1040)
        assertEquals(20, (step as DeviceFlow.Step.Wait).seconds, "the slower pace stays")
        assertEquals(DeviceFlow.Step.Done("t", listOf("repo")), DeviceFlow.next(step.state, TokenPoll.Success("t", listOf("repo")), 1060))
    }

    @Test fun theFlowStops() {
        val s = DeviceFlow.start(DeviceCode.parse(codeJson)!!, now = 0)
        assertIs<DeviceFlow.Step.Fail>(DeviceFlow.next(s, TokenPoll.Expired, 10))
        assertIs<DeviceFlow.Step.Fail>(DeviceFlow.next(s, TokenPoll.Denied, 10))
        assertIs<DeviceFlow.Step.Fail>(DeviceFlow.next(s, TokenPoll.Pending, 900), "past expires_in the code is dead even if GitHub says pending")
        assertIs<DeviceFlow.Step.Fail>(DeviceFlow.next(s, TokenPoll.Failed("x"), 10))
    }

    @Test fun rateLimitHeaders() {
        val r = RateLimit.parse(mapOf("X-RateLimit-Limit" to "5000", "x-ratelimit-remaining" to "0", "X-RATELIMIT-RESET" to "1761800000"))!!
        assertEquals(5000, r.limit)
        assertTrue(r.exhausted)
        assertEquals(100, r.waitSeconds(1761799900))
        assertEquals(0, r.waitSeconds(1761900000))
        assertNull(RateLimit.parse(mapOf("Content-Type" to "application/json")))
    }

    @Test fun userAndRepo() {
        val u = GitHubUser.parse("""{"login":"webagoly-work","id":320772495,"name":null,"avatar_url":"https://avatars.githubusercontent.com/u/320772495?v=4"}""")!!
        assertEquals("webagoly-work", u.login)
        assertNull(u.name)
        val r = RepoAccess.parse("""{"full_name":"webagoly-work/vrg-toolset","private":true,"default_branch":"main","permissions":{"admin":true,"push":true,"pull":true}}""")!!
        assertEquals(RepoAccess(VrgRepo.FULL, true, true, "main"), r)
        assertNull(RepoAccess.parse("""{"message":"Not Found"}"""))
    }

    @Test fun formEncoding() {
        assertEquals("client_id=abc&scope=repo+notifications", GitHubUrls.form("client_id" to "abc", "scope" to VrgRepo.SCOPES))
    }
}
