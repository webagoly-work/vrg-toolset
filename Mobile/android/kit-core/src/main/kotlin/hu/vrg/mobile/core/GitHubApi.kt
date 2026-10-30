package hu.vrg.mobile.core

import org.json.JSONObject
import java.net.URLEncoder

// GitHub for VRG Mobile (WP M3), the parts that are rules rather than Android: the repo constant, the
// device flow (D-2 = A) as a state machine, the rate-limit headers and the few response models the
// features read. The Android client (kit: GitHub) only moves bytes; every decision about what GitHub
// answered is made here, so it is tested on the JVM against recorded answers and never against GitHub.

/** The one repository the app works with. Every feature asks here; nothing else spells it out. */
object VrgRepo {
    const val OWNER = "webagoly-work"
    const val NAME = "vrg-toolset"
    const val FULL = "$OWNER/$NAME"
    const val PATH = "/repos/$FULL"

    /** `repo` because the toolset repository is private; `notifications` for Értesítések (M10). */
    const val SCOPES = "repo notifications"
}

object GitHubUrls {
    const val API = "https://api.github.com"
    const val DEVICE_CODE = "https://github.com/login/device/code"
    const val TOKEN = "https://github.com/login/oauth/access_token"
    const val GRANT = "urn:ietf:params:oauth:grant-type:device_code"

    fun form(vararg kv: Pair<String, String>): String =
        kv.joinToString("&") { (k, v) -> URLEncoder.encode(k, "UTF-8") + "=" + URLEncoder.encode(v, "UTF-8") }
}

/** GitHub's answer to POST /login/device/code: the code the user types at verification_uri. */
data class DeviceCode(
    val deviceCode: String,
    val userCode: String,
    val verificationUri: String,
    val expiresIn: Int,
    val interval: Int,
) {
    companion object {
        /** Null when GitHub answered with an error instead (device flow off, wrong client id). */
        fun parse(json: String): DeviceCode? {
            val o = try { JSONObject(json) } catch (e: Exception) { return null }
            if (o.has("error")) return null
            val dc = o.optString("device_code").ifEmpty { return null }
            val uc = o.optString("user_code").ifEmpty { return null }
            return DeviceCode(
                dc, uc,
                o.optString("verification_uri").ifEmpty { "https://github.com/login/device" },
                o.optInt("expires_in", 900),
                o.optInt("interval", 5).coerceAtLeast(1),
            )
        }

        /** The error GitHub gave instead of a code, in Hungarian for the screen. */
        fun error(json: String): String {
            val e = try { JSONObject(json).optString("error") } catch (ex: Exception) { "" }
            return when (e) {
                "device_flow_disabled" -> "Az OAuth Appban nincs bekapcsolva a Device Flow."
                "incorrect_client_credentials", "unauthorized_client" -> "Hibás Client ID (github.xml)."
                "" -> "A GitHub nem adott kódot."
                else -> "GitHub hiba: $e"
            }
        }
    }
}

/** One answer to the token poll (POST /login/oauth/access_token). */
sealed interface TokenPoll {
    data class Success(val token: String, val scopes: List<String>) : TokenPoll
    data object Pending : TokenPoll
    /** GitHub says: poll slower. It may name the new interval; otherwise add 5 s (RFC 8628 §3.5). */
    data class SlowDown(val interval: Int?) : TokenPoll
    data object Expired : TokenPoll
    data object Denied : TokenPoll
    data class Failed(val error: String) : TokenPoll

    companion object {
        fun parse(json: String): TokenPoll {
            val o = try { JSONObject(json) } catch (e: Exception) { return Failed("nem JSON válasz") }
            val token = o.optString("access_token")
            if (token.isNotEmpty()) {
                return Success(token, o.optString("scope").split(',', ' ').map { it.trim() }.filter { it.isNotEmpty() })
            }
            return when (val e = o.optString("error")) {
                "authorization_pending" -> Pending
                "slow_down" -> SlowDown(if (o.has("interval")) o.optInt("interval") else null)
                "expired_token" -> Expired
                "access_denied" -> Denied
                "" -> Failed("üres válasz")
                else -> Failed(e)
            }
        }
    }
}

/**
 * The device flow as a pure state machine: the client asks [next] after every poll answer what to do,
 * and only sleeps, polls or stops as told. `now` is in seconds.
 */
object DeviceFlow {
    data class State(val code: DeviceCode, val interval: Int, val deadline: Long)

    sealed interface Step {
        data class Wait(val seconds: Int, val state: State) : Step
        data class Done(val token: String, val scopes: List<String>) : Step
        data class Fail(val reason: String) : Step
    }

    fun start(code: DeviceCode, now: Long): State = State(code, code.interval, now + code.expiresIn)

    fun next(s: State, poll: TokenPoll, now: Long): Step {
        if (poll is TokenPoll.Success) return Step.Done(poll.token, poll.scopes)
        if (now >= s.deadline) return Step.Fail("A kód lejárt. Kérj újat.")
        return when (poll) {
            is TokenPoll.Success -> Step.Done(poll.token, poll.scopes)
            TokenPoll.Pending -> Step.Wait(s.interval, s)
            is TokenPoll.SlowDown -> {
                val n = s.copy(interval = maxOf(poll.interval ?: 0, s.interval + 5))
                Step.Wait(n.interval, n)
            }
            TokenPoll.Expired -> Step.Fail("A kód lejárt. Kérj újat.")
            TokenPoll.Denied -> Step.Fail("A belépést elutasítottad a GitHubon.")
            is TokenPoll.Failed -> Step.Fail("GitHub hiba: ${poll.error}")
        }
    }
}

/** The X-RateLimit-* headers. Conditional requests answered 304 do not count against the limit. */
data class RateLimit(val limit: Int, val remaining: Int, val resetEpoch: Long) {
    val exhausted: Boolean get() = remaining <= 0

    /** Seconds until the window resets, never negative. */
    fun waitSeconds(nowEpoch: Long): Long = (resetEpoch - nowEpoch).coerceAtLeast(0)

    companion object {
        /** Header names are case-insensitive; null when GitHub did not send them. */
        fun parse(headers: Map<String, String>): RateLimit? {
            val h = headers.mapKeys { it.key.lowercase() }
            val limit = h["x-ratelimit-limit"]?.toIntOrNull() ?: return null
            val remaining = h["x-ratelimit-remaining"]?.toIntOrNull() ?: return null
            val reset = h["x-ratelimit-reset"]?.toLongOrNull() ?: 0L
            return RateLimit(limit, remaining, reset)
        }
    }
}

data class GitHubUser(val login: String, val name: String?, val avatarUrl: String?) {
    companion object {
        fun parse(json: String): GitHubUser? = try {
            val o = JSONObject(json)
            val login = o.optString("login").ifEmpty { null }
            login?.let {
                GitHubUser(it, o.optString("name").takeIf { n -> n.isNotEmpty() && n != "null" },
                    o.optString("avatar_url").ifEmpty { null })
            }
        } catch (e: Exception) { null }
    }
}

/** What GET /repos/{owner}/{repo} says about this account's access. */
data class RepoAccess(val fullName: String, val private: Boolean, val push: Boolean, val defaultBranch: String) {
    companion object {
        fun parse(json: String): RepoAccess? = try {
            val o = JSONObject(json)
            val p = o.optJSONObject("permissions")
            RepoAccess(
                o.getString("full_name"), o.optBoolean("private"),
                p?.optBoolean("push") ?: false, o.optString("default_branch", "main"),
            )
        } catch (e: Exception) { null }
    }
}
