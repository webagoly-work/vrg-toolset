package hu.vrg.mobile.kit.github

import android.content.Context
import android.content.SharedPreferences
import hu.vrg.mobile.core.DeviceCode
import hu.vrg.mobile.core.DeviceFlow
import hu.vrg.mobile.core.GitHubUrls
import hu.vrg.mobile.core.GitHubUser
import hu.vrg.mobile.core.RateLimit
import hu.vrg.mobile.core.RepoAccess
import hu.vrg.mobile.core.RepoName
import hu.vrg.mobile.core.TokenPoll
import hu.vrg.mobile.core.VrgRepo
import hu.vrg.mobile.kit.Access
import hu.vrg.mobile.kit.R
import hu.vrg.mobile.kit.VrgLog
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit

// The app's one GitHub client (WP M3). Sign-in is the device flow (D-2 = A): the phone shows a code,
// the user types it at github.com/login/device, the token lands in SecretStore (Keystore-backed).
// Every online feature (Haladás, Kódváros online, Gyorsjegyzet, Frissítés, Értesítések) calls
// get() / send() here, so the token, the ETag cache and the rate limit are handled in one place.
// The decisions about GitHub's answers (the flow's states, the headers) are kit-core's GitHubApi.

/** The outcome of one call, with the failures a screen has to tell apart. */
sealed interface Gh<out T> {
    data class Ok<T>(val value: T) : Gh<T>
    data object Offline : Gh<Nothing>
    data object SignedOut : Gh<Nothing>
    data class RateLimited(val waitSeconds: Long) : Gh<Nothing>
    data class Failed(val code: Int, val message: String) : Gh<Nothing>

    companion object {
        /** The same failure for a caller that returns another type. */
        @Suppress("UNCHECKED_CAST")
        fun <T> failureOf(r: Gh<*>): Gh<T> = r as Gh<T>
    }
}

/** A failure carried over to another result type (a failure holds no value). */
@Suppress("UNCHECKED_CAST")
fun <T> Gh<*>.failure(): Gh<T> {
    check(this !is Gh.Ok<*>) { "not a failure" }
    return this as Gh<T>
}

/** A Hungarian line for any failure, so every feature words them the same way. */
fun Gh<*>.problem(): String? = when (this) {
    is Gh.Ok -> null
    Gh.Offline -> "Nincs internet."
    Gh.SignedOut -> "Nincs GitHub belépés (GitHub fiók)."
    is Gh.RateLimited -> "A GitHub korlátozza a kéréseket, ${waitSeconds / 60 + 1} perc múlva újra."
    is Gh.Failed -> "GitHub hiba $code: $message"
}

sealed interface Account {
    data object SignedOut : Account
    /** [guest]: in by the repo's name, no token (Mobile/access.json `repoName`): reads only, public repo only. */
    data class SignedIn(val user: GitHubUser?, val repo: RepoAccess?, val note: String? = null, val guest: Boolean = false) : Account
}

object GitHub {
    private const val TAG = "github"
    private const val TOKEN = "github.token"
    private const val GUEST = "guest"

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val http = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    private lateinit var store: SecretStore
    private lateinit var prefs: SharedPreferences
    private var token: String? = null
    /** In by the repo's name (temporary, see kit-core Access.kt): GETs go out without a token. */
    private var guest = false
    /** From res/values/github.xml; empty until the user has created the OAuth App. */
    var clientId: String = ""
        private set

    private val _account = MutableStateFlow<Account>(Account.SignedOut)
    val account: StateFlow<Account> = _account
    private val _rate = MutableStateFlow<RateLimit?>(null)
    val rate: StateFlow<RateLimit?> = _rate
    /** Why the repo-name access ended by itself (the repo went private), for GitHub fiók. */
    private val _notice = MutableStateFlow<String?>(null)
    val notice: StateFlow<String?> = _notice

    /** url -> (etag, body): a 304 answer is free under the rate limit. */
    private val cache = HashMap<String, Pair<String, String>>()

    fun init(ctx: Context) {
        clientId = ctx.getString(R.string.github_client_id).trim()
        store = SecretStore(ctx)
        prefs = ctx.getSharedPreferences("github", Context.MODE_PRIVATE)
        token = store.get(TOKEN)
        // The repo-name access lasts only while the build allows it (Mobile/access.json)
        guest = token == null && Access.repoName && prefs.getBoolean(GUEST, false)
        if (token != null || guest) {
            _account.value = Account.SignedIn(null, null, guest = guest)
            scope.launch { refresh() }
        }
    }

    /** GitHub can be read: a token, or the repo-name access. */
    val signedIn: Boolean get() = token != null || guest
    /** GitHub can be written (Gyorsjegyzet): only with a token. */
    val canWrite: Boolean get() = token != null

    // ---- the repo-name access (temporary, kit-core Access.kt) -----------------------------------

    /** Lets the phone in when [input] names the toolset repo and GitHub shows it without a token. */
    suspend fun enterByRepoName(input: String): Gh<Unit> {
        if (!Access.repoName) return Gh.Failed(0, "Ez a belépés ebben a buildben ki van kapcsolva.")
        if (!RepoName.matches(input)) return Gh.Failed(0, "Nem ez a repó neve.")
        guest = true
        return when (val r = get(VrgRepo.PATH)) {
            is Gh.Ok -> {
                prefs.edit().putBoolean(GUEST, true).apply()
                _notice.value = null
                _account.value = Account.SignedIn(null, RepoAccess.parse(r.value), guest = true)
                VrgLog.i(TAG, "Belépve a repó nevével (token nélkül, csak olvasás)")
                Gh.Ok(Unit)
            }
            is Gh.Failed -> {
                guest = false
                if (r.code == 404) Gh.Failed(404, "A repó most nem nyilvános: GitHub belépés kell.") else r.failure()
            }
            else -> { guest = false; r.failure() }
        }
    }

    // ---- sign-in: the device flow ----------------------------------------------------------------

    suspend fun requestCode(): Gh<DeviceCode> = withContext(Dispatchers.IO) {
        if (clientId.isEmpty()) return@withContext Gh.Failed(0, "Nincs Client ID (kit/src/main/res/values/github.xml).")
        val body = GitHubUrls.form("client_id" to clientId, "scope" to VrgRepo.SCOPES)
        when (val r = postForm(GitHubUrls.DEVICE_CODE, body)) {
            is Gh.Ok -> DeviceCode.parse(r.value)?.let { Gh.Ok(it) } ?: Gh.Failed(0, DeviceCode.error(r.value))
            else -> r.failure<DeviceCode>()
        }
    }

    /** Polls until the user has entered the code (or it expires); signs in on success. */
    suspend fun waitForToken(code: DeviceCode): Gh<Unit> = withContext(Dispatchers.IO) {
        var state = DeviceFlow.start(code, now())
        var wait = state.interval
        while (true) {
            delay(wait * 1000L)
            val body = GitHubUrls.form("client_id" to clientId, "device_code" to code.deviceCode, "grant_type" to GitHubUrls.GRANT)
            val poll = when (val r = postForm(GitHubUrls.TOKEN, body)) {
                is Gh.Ok -> TokenPoll.parse(r.value)
                Gh.Offline -> TokenPoll.Pending          // keep trying while the code is alive
                else -> return@withContext r.failure<Unit>()
            }
            when (val step = DeviceFlow.next(state, poll, now())) {
                is DeviceFlow.Step.Wait -> { state = step.state; wait = step.seconds }
                is DeviceFlow.Step.Done -> {
                    store.put(TOKEN, step.token)
                    token = step.token
                    leaveGuest()
                    VrgLog.i(TAG, "Belépve (${step.scopes.joinToString(",")})")
                    refresh()
                    return@withContext Gh.Ok(Unit)
                }
                is DeviceFlow.Step.Fail -> return@withContext Gh.Failed(0, step.reason)
            }
        }
        @Suppress("UNREACHABLE_CODE") Gh.Failed(0, "")
    }

    fun signOut() {
        store.remove(TOKEN)
        token = null
        leaveGuest()
        synchronized(cache) { cache.clear() }
        _account.value = Account.SignedOut
        VrgLog.i(TAG, "Kilépve")
    }

    private fun leaveGuest() {
        guest = false
        prefs.edit().remove(GUEST).apply()
    }

    /** Re-reads who is signed in and whether the toolset repo is reachable. */
    suspend fun refresh() {
        if (token == null && guest) {
            val repo = get(VrgRepo.PATH)
            when {
                repo is Gh.Ok -> _account.value = Account.SignedIn(null, RepoAccess.parse(repo.value), guest = true)
                repo is Gh.Failed && repo.code == 404 -> {
                    // Private again: the repo-name access ends by itself, as access.json promises
                    signOut()
                    _notice.value = "A repó már nem nyilvános, a repó nevével nem lehet tovább belépni. GitHub belépés kell."
                }
                else -> {
                    val was = _account.value as? Account.SignedIn
                    _account.value = Account.SignedIn(null, was?.repo, repo.problem(), guest = true)
                }
            }
            return
        }
        if (token == null) return
        val user = get("/user")
        if (user is Gh.Ok) {
            val repo = get(VrgRepo.PATH)
            _account.value = Account.SignedIn(
                GitHubUser.parse(user.value),
                if (repo is Gh.Ok) RepoAccess.parse(repo.value) else null,
                if (repo is Gh.Ok) null else repo.problem() ?: "A repó nem érhető el ezzel a fiókkal.",
            )
        } else if (user !is Gh.SignedOut) {
            val was = _account.value as? Account.SignedIn
            _account.value = Account.SignedIn(was?.user, was?.repo, user.problem())
        }
    }

    // ---- the API ---------------------------------------------------------------------------------

    /** GET on api.github.com (a path) or a full URL, with the token and the ETag cache. */
    suspend fun get(pathOrUrl: String): Gh<String> = call("GET", pathOrUrl, null)

    /** PUT / POST / PATCH / DELETE with a JSON body (Gyorsjegyzet's writes, M6). */
    suspend fun send(method: String, path: String, json: String?): Gh<String> = call(method, path, json)

    /** Raw bytes of a URL that needs no token (an avatar). */
    suspend fun bytes(url: String): ByteArray? = withContext(Dispatchers.IO) {
        try { http.newCall(Request.Builder().url(url).build()).execute().use { if (it.isSuccessful) it.body?.bytes() else null } }
        catch (e: IOException) { null }
    }

    /**
     * A release asset into [into], streamed. The asset url needs the token (a private repo) and
     * octet-stream; GitHub redirects to its storage, and OkHttp drops the token on that other host.
     * In by the repo's name there is no token, which a public repo's asset does not need.
     */
    suspend fun download(url: String, into: File, onProgress: (Long) -> Unit = {}): Gh<Unit> = withContext(Dispatchers.IO) {
        val t = token
        if (t == null && !guest) return@withContext Gh.SignedOut
        val req = Request.Builder().url(url)
            .apply { if (t != null) header("Authorization", "Bearer $t") }
            .header("Accept", "application/octet-stream")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .build()
        try {
            http.newCall(req).execute().use { r ->
                if (r.code == 401) { VrgLog.w(TAG, "A token már nem érvényes"); signOut(); return@use Gh.SignedOut }
                val body = r.body
                if (!r.isSuccessful || body == null) return@use Gh.Failed(r.code, message(body?.string().orEmpty()))
                into.outputStream().use { out ->
                    val input = body.byteStream()
                    val buf = ByteArray(64 * 1024)
                    var done = 0L
                    while (true) {
                        val n = input.read(buf)
                        if (n < 0) break
                        out.write(buf, 0, n)
                        done += n
                        onProgress(done)
                    }
                }
                Gh.Ok(Unit)
            }
        } catch (e: IOException) {
            VrgLog.w(TAG, "A letöltés megszakadt: ${e.javaClass.simpleName}: ${e.message}")
            Gh.Offline
        }
    }

    private suspend fun call(method: String, pathOrUrl: String, json: String?): Gh<String> = withContext(Dispatchers.IO) {
        val t = token
        // Without a token only the repo-name access reads, and it never writes
        if (t == null && (!guest || method != "GET")) return@withContext Gh.SignedOut
        val url = if (pathOrUrl.startsWith("http")) pathOrUrl else GitHubUrls.API + pathOrUrl
        val b = Request.Builder().url(url)
            .apply { if (t != null) header("Authorization", "Bearer $t") }
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
        val cached = if (method == "GET") synchronized(cache) { cache[url] } else null
        if (cached != null) b.header("If-None-Match", cached.first)
        b.method(method, json?.toRequestBody("application/json".toMediaType()))
        try {
            http.newCall(b.build()).execute().use { r ->
                val rate = RateLimit.parse(r.headers.toMultimap().mapValues { it.value.firstOrNull().orEmpty() })
                if (rate != null) _rate.value = rate
                val body = r.body?.string().orEmpty()
                when {
                    r.code == 304 && cached != null -> Gh.Ok(cached.second)
                    r.isSuccessful -> {
                        val etag = r.header("ETag")
                        if (method == "GET" && etag != null) synchronized(cache) { cache[url] = etag to body }
                        Gh.Ok(body)
                    }
                    r.code == 401 -> { VrgLog.w(TAG, "A token már nem érvényes"); signOut(); Gh.SignedOut }
                    (r.code == 403 || r.code == 429) && rate?.exhausted == true -> Gh.RateLimited(rate.waitSeconds(now()))
                    else -> Gh.Failed(r.code, message(body))
                }
            }
        } catch (e: IOException) {
            VrgLog.w(TAG, "$method nem ment ki: ${e.javaClass.simpleName}: ${e.message}")
            Gh.Offline
        }
    }

    private fun postForm(url: String, body: String): Gh<String> = try {
        val req = Request.Builder().url(url).header("Accept", "application/json")
            .post(body.toRequestBody("application/x-www-form-urlencoded".toMediaType())).build()
        http.newCall(req).execute().use { r -> Gh.Ok(r.body?.string().orEmpty()) }
    } catch (e: IOException) { Gh.Offline }

    private fun message(body: String): String =
        try { org.json.JSONObject(body).optString("message").ifEmpty { body.take(120) } } catch (e: Exception) { body.take(120) }

    private fun now(): Long = System.currentTimeMillis() / 1000
}
