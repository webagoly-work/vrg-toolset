package hu.vrg.mobile.kit

import android.content.Context
import android.os.Build
import hu.vrg.mobile.core.DeviceGrant
import hu.vrg.mobile.core.DeviceRequest
import hu.vrg.mobile.core.DeviceTrust
import hu.vrg.mobile.core.GrantPayload
import hu.vrg.mobile.core.Jwk
import hu.vrg.mobile.core.TrustList
import hu.vrg.mobile.core.TrustedDevice
import hu.vrg.mobile.core.VrgRepo
import hu.vrg.mobile.kit.github.Gh
import hu.vrg.mobile.kit.github.GitHub
import hu.vrg.mobile.kit.github.SecretStore
import hu.vrg.mobile.kit.github.problem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.security.PrivateKey
import java.security.interfaces.ECPublicKey
import java.time.Instant
import java.util.Base64
import java.util.concurrent.TimeUnit

// Eszközök (WP M35) on the phone: who this phone is (its id is the Access device code, its P-256 key lives in the
// Keystore-backed store), the trusted list (Mobile/trust/devices.json on main, cached), and the two halves of the
// Proton Vault flow — a phone asks with a QR, the owner's phone approves (writes the list, shows a grant QR), the
// asking phone accepts the grant. The rules and the crypto are kit-core's DeviceTrust.

object Trust {
    private const val TAG = "trust"
    private const val KEY = "device.key"
    private lateinit var ctx: Context
    private lateinit var store: SecretStore
    private val http = OkHttpClient.Builder().connectTimeout(8, TimeUnit.SECONDS).readTimeout(15, TimeUnit.SECONDS).build()

    private val _list = MutableStateFlow<TrustList?>(null)
    /** The last list read (cached across starts); null before the first. */
    val list: StateFlow<TrustList?> = _list
    /** Who approved this phone and when, once a grant was accepted here. */
    val granted = MutableStateFlow<String?>(null)

    private fun prefs() = ctx.getSharedPreferences("trust", Context.MODE_PRIVATE)

    /** After Access and GitHub. */
    fun init(context: Context) {
        ctx = context.applicationContext
        store = SecretStore(ctx)
        _list.value = TrustList.parse(prefs().getString("list", null))
        granted.value = prefs().getString("granted", null)
        Access.recheck()
    }

    /** This phone's id: the Access device code without dashes. */
    val id: String get() = DeviceTrust.norm(Access.code)
    val listed: Boolean get() = _list.value?.has(id) == true
    val isOwner: Boolean get() = _list.value?.devices?.any { it.owner && DeviceTrust.sameId(it.id, id) } == true

    /** Updates for this phone: the list is open, lists it, or has not been read yet (never lock the owner out offline). */
    fun updatesAllowed(): Boolean = _list.value?.updatesFor(id) ?: true

    var name: String
        get() = prefs().getString("name", null) ?: "${Build.MANUFACTURER} ${Build.MODEL}".trim()
        set(v) { prefs().edit().putString("name", v.trim().take(40)).apply() }

    // ---- this phone's key ---------------------------------------------------------------------------------------

    private fun keys(): Pair<PrivateKey, Jwk> {
        val saved = store.get(KEY)
        val pub = prefs().getString("pub", null)
        if (saved != null && pub != null) {
            val (x, y) = pub.split('.', limit = 2)
            return DeviceTrust.privateFrom(saved) to Jwk(x, y)
        }
        val kp = DeviceTrust.newKeyPair()
        val j = DeviceTrust.jwk(kp.public as ECPublicKey)
        store.put(KEY, DeviceTrust.privateToString(kp.private))
        prefs().edit().putString("pub", "${j.x}.${j.y}").apply()
        VrgLog.i(TAG, "Új eszközkulcs")
        return kp.private to j
    }

    fun request(): DeviceRequest {
        val app = runCatching { ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName }.getOrNull() ?: "?"
        return DeviceTrust.request(id, name, "${Build.MANUFACTURER} ${Build.MODEL}", "Android ${Build.VERSION.RELEASE}", app, keys().second,
            Instant.now().toString())
    }

    // ---- the list -----------------------------------------------------------------------------------------------

    /** Reads the list from main (public raw file, then the API with a token). Returns a problem or null. */
    suspend fun refresh(): String? = withContext(Dispatchers.IO) {
        val raw = try {
            val url = "https://raw.githubusercontent.com/${VrgRepo.FULL}/main/${DeviceTrust.PATH}?t=${System.currentTimeMillis() / 60_000}"
            http.newCall(Request.Builder().url(url).header("Cache-Control", "no-cache").build()).execute().use { r -> if (r.isSuccessful) r.body?.string() else null }
        } catch (e: Exception) { null }
        val text = raw ?: readViaApi().let { if (it is Gh.Ok) it.value.second else null }
        val t = TrustList.parse(text) ?: return@withContext if (text == null) "A lista nem olvasható (nincs net, vagy a repó privát és nincs belépés)." else "A lista hibás."
        store(t)
        null
    }

    private fun store(t: TrustList) {
        _list.value = t
        prefs().edit().putString("list", t.encode()).apply()
        Access.recheck()
    }

    private suspend fun readViaApi(): Gh<Pair<String, String>> {
        val r = GitHub.get("${VrgRepo.PATH}/contents/${DeviceTrust.PATH}?ref=main")
        if (r !is Gh.Ok) return Gh.failureOf(r)
        val o = JSONObject(r.value)
        val text = String(Base64.getMimeDecoder().decode(o.getString("content")), Charsets.UTF_8)
        return Gh.Ok(o.getString("sha") to text)
    }

    /** Read, change and write the list on main in one go (the owner's phone). Returns a problem or null. */
    private suspend fun change(message: String, f: (TrustList) -> TrustList): String? {
        if (!GitHub.canWrite) return "Ehhez GitHub belépés kell (a tulajdonos fiókja)."
        val cur = readViaApi()
        val (sha, before) = when (cur) {
            is Gh.Ok -> cur.value.first to (TrustList.parse(cur.value.second) ?: TrustList.EMPTY)
            is Gh.Failed -> if (cur.code == 404) null to TrustList.EMPTY else return cur.problem()
            else -> return cur.problem()
        }
        val after = f(before)
        val body = JSONObject().put("message", message).put("branch", "main")
            .put("content", Base64.getEncoder().encodeToString(after.encode().toByteArray(Charsets.UTF_8)))
            .apply { if (sha != null) put("sha", sha) }
        val w = GitHub.send("PUT", "${VrgRepo.PATH}/contents/${DeviceTrust.PATH}", body.toString())
        if (w !is Gh.Ok) return w.problem()
        store(after)
        return null
    }

    /** The owner approves [req]: the phone goes on the list, and the grant link (for its QR) comes back. */
    suspend fun approve(req: DeviceRequest, withToken: Boolean): Pair<String?, String?> {
        val by = "$name · $id"
        val problem = change("trust: ${req.name} (${req.model}, ${req.id}) jóváhagyva") { t ->
            t.with(TrustedDevice(req.id, req.name, req.model, req.os, req.code, Instant.now().toString(), by))
        }
        if (problem != null) return null to problem
        val token = if (withToken) GitHub.tokenForGrant() else null
        val g = DeviceTrust.grant(req, GrantPayload(by, Instant.now().toString(), token))
        VrgLog.i(TAG, "Jóváhagyva: ${req.name} (${req.id})" + if (token != null) ", tokennel" else "")
        return DeviceTrust.grantLink(g, req.back) to null
    }

    suspend fun setGated(on: Boolean): String? = change("trust: kiadások ${if (on) "zárolva" else "nyitva"}") { it.copy(gated = on) }

    suspend fun remove(deviceId: String): String? = change("trust: $deviceId eltávolítva") { it.without(deviceId) }

    /** The asking phone opens a grant: a token in it is kept like a sign-in; the list is read again. */
    suspend fun accept(g: DeviceGrant): String {
        val p = DeviceTrust.open(g, id, keys().first)
        p.token?.let { GitHub.adoptToken(it) }
        val line = "${p.by}, ${p.at.take(10)}" + if (p.token != null) " (írási joggal)" else ""
        prefs().edit().putString("granted", line).apply()
        granted.value = line
        refresh()
        return line
    }
}
