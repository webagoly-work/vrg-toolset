package hu.vrg.mobile.update

import android.app.Application
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.provider.Settings
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.ReleaseAssets
import hu.vrg.mobile.core.UpdateInfo
import hu.vrg.mobile.core.Updates
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.github.Account
import hu.vrg.mobile.kit.github.Gh
import hu.vrg.mobile.kit.github.GitHub
import hu.vrg.mobile.kit.github.problem
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.ui.VrgSectionTitle
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.File

// Frissítés (WP M9, D-3 = A): the app updates itself from GitHub Releases. It checks when it comes on
// screen, at most every 6 hours, and from the tile. A newer release is downloaded with the shared
// GitHub client, checked against update.json and handed to Android, which asks the user to confirm.
// A release is signed with the key in the repo secrets; an APK with another key cannot replace this one.

sealed interface UpdateState {
    data object Idle : UpdateState
    data object Checking : UpdateState
    data object UpToDate : UpdateState
    data class Available(val info: UpdateInfo) : UpdateState
    data class Downloading(val info: UpdateInfo, val percent: Int) : UpdateState
    data class Installing(val info: UpdateInfo) : UpdateState

    /** The home screen's "⟳ új" mark is up. */
    val waiting: Boolean get() = this is Available || this is Downloading || this is Installing
}

object UpdateFeature : VrgFeature {
    override val info = Catalogue.UPDATE
    private const val TAG = "update"
    private const val APK = "vrg-mobile.apk"

    private lateinit var app: Context
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val lock = Mutex()

    private val _state = MutableStateFlow<UpdateState>(UpdateState.Idle)
    val state: StateFlow<UpdateState> = _state
    /** Why the last step stopped; null after a clean one. */
    val problem = MutableStateFlow<String?>(null)
    /** Android's "install unknown apps" switch is off for this app. */
    val needsPermission = MutableStateFlow(false)

    private fun prefs() = app.getSharedPreferences("update", Context.MODE_PRIVATE)

    private val installed: Long get() = app.packageManager.getPackageInfo(app.packageName, 0).longVersionCode

    override fun init(app: Application) {
        this.app = app
        apkFile().delete()
        // The offer found by an earlier check, unless this very install was that update
        val seen = prefs().getString("info", null)?.let { UpdateInfo.parse(it) }
        if (seen != null && Updates.isNewer(seen, installed)) _state.value = UpdateState.Available(seen)
    }

    override fun onAppVisible() {
        if (GitHub.signedIn && Updates.checkDue(prefs().getLong("checked", 0), System.currentTimeMillis())) check()
    }

    fun check() {
        scope.launch {
            lock.withLock {
                val before = _state.value
                if (before is UpdateState.Downloading || before is UpdateState.Installing) return@withLock
                _state.value = UpdateState.Checking
                problem.value = null
                when (val r = find()) {
                    is Gh.Ok -> {
                        prefs().edit().putLong("checked", System.currentTimeMillis()).apply()
                        val found = r.value?.takeIf { Updates.isNewer(it, installed) }
                        _state.value = if (found != null) UpdateState.Available(found) else UpdateState.UpToDate
                    }
                    is Gh.Failed -> {
                        if (r.code == 404) {                  // no release yet
                            prefs().edit().putLong("checked", System.currentTimeMillis()).apply()
                            _state.value = UpdateState.UpToDate
                        } else fail(before, r.problem())
                    }
                    else -> fail(before, r.problem())
                }
            }
        }
    }

    private fun fail(before: UpdateState, why: String?) {
        problem.value = why
        VrgLog.w(TAG, "Nem sikerült: $why")
        _state.value = before.takeIf { it is UpdateState.Available } ?: UpdateState.Idle
    }

    /** Reads the latest release and its update.json; Ok(null) when the release has no usable assets. */
    private suspend fun find(): Gh<UpdateInfo?> {
        val latest = GitHub.get(Updates.LATEST)
        if (latest !is Gh.Ok) return failure(latest)
        val assets = ReleaseAssets.parse(latest.value) ?: return Gh.Ok(null)
        val file = File(app.cacheDir, ReleaseAssets.UPDATE_JSON)
        val got = GitHub.download(assets.updateJsonUrl, file)
        if (got !is Gh.Ok) return failure(got)
        val text = file.readText()
        file.delete()
        val info = UpdateInfo.parse(text) ?: return Gh.Failed(0, "Érthetetlen update.json.")
        prefs().edit().putString("info", text).putString("apk", assets.apkUrl).apply()
        return Gh.Ok(info)
    }

    @Suppress("UNCHECKED_CAST")
    private fun <T> failure(r: Gh<*>): Gh<T> = r as Gh<T>

    fun install() {
        val offer = _state.value as? UpdateState.Available ?: return
        if (!app.packageManager.canRequestPackageInstalls()) { needsPermission.value = true; return }
        needsPermission.value = false
        val url = prefs().getString("apk", null) ?: return
        scope.launch {
            lock.withLock {
                problem.value = null
                _state.value = UpdateState.Downloading(offer.info, 0)
                val apk = apkFile()
                val got = GitHub.download(url, apk) { done ->
                    _state.value = UpdateState.Downloading(offer.info, (done * 100 / offer.info.size).toInt().coerceAtMost(100))
                }
                if (got !is Gh.Ok) { apk.delete(); fail(offer, got.problem()); return@withLock }
                val hash = apk.inputStream().use { Updates.sha256(it) }
                if (!Updates.verified(offer.info, apk.length(), hash)) {
                    apk.delete()
                    fail(offer, "A letöltött fájl nem azonos a kiadással, nem telepítem.")
                    return@withLock
                }
                _state.value = UpdateState.Installing(offer.info)
                try {
                    Installer.install(app, apk)
                } catch (e: Exception) {
                    fail(offer, "A telepítő nem indult el: ${e.message}")
                }
            }
        }
    }

    fun installFailed(status: Int, message: String?) {
        val why = when (status) {
            PackageInstaller.STATUS_FAILURE_ABORTED -> "A telepítést megszakítottad."
            PackageInstaller.STATUS_FAILURE_CONFLICT, PackageInstaller.STATUS_FAILURE_INCOMPATIBLE ->
                "Más kulccsal aláírt build van a telefonon: egyszer el kell távolítani."
            else -> "A telepítés nem sikerült: ${message ?: status}"
        }
        (_state.value as? UpdateState.Installing)?.let { fail(UpdateState.Available(it.info), why) }
    }

    private fun apkFile() = File(app.cacheDir, APK)

    private fun openInstallSetting(host: FeatureHost) {
        host.activity.startActivity(
            Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${app.packageName}")),
        )
    }

    @Composable
    override fun Screen(host: FeatureHost) {
        val now by state.collectAsStateWithLifecycle()
        val why by problem.collectAsStateWithLifecycle()
        val blocked by needsPermission.collectAsStateWithLifecycle()
        val account by GitHub.account.collectAsStateWithLifecycle()
        val pi = app.packageManager.getPackageInfo(app.packageName, 0)

        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
            Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current),
                modifier = Modifier.clickable { host.home() }.padding(vertical = 8.dp))
            Text("FRISSÍTÉS", style = Melyviz.title.copy(fontSize = 18.sp))
            Text("Most: ${pi.versionName}", style = Melyviz.small)
            Spacer(Modifier.height(10.dp))

            if (account !is Account.SignedIn) {
                Text("A kiadások a privát repóban vannak: GitHub belépés kell.", style = Melyviz.small.copy(color = Melyviz.sand))
                Row(Modifier.padding(vertical = 6.dp)) { VrgChip("GitHub fiók ›") { host.open(Catalogue.ACCOUNT.id) } }
            }

            when (val s = now) {
                UpdateState.Idle -> Unit
                UpdateState.Checking -> Text("Keresés a GitHubon…", style = Melyviz.small)
                UpdateState.UpToDate -> Text("Ez a legfrissebb verzió.", style = Melyviz.small)
                is UpdateState.Available -> Offer(s.info, host, blocked)
                is UpdateState.Downloading -> Text("Letöltés: ${s.info.name} · ${s.percent} %", style = Melyviz.readout)
                is UpdateState.Installing -> Text("A telepítő indul: ${s.info.name}", style = Melyviz.readout)
            }
            why?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 6.dp)) }

            if (account is Account.SignedIn) Row(Modifier.padding(top = 12.dp)) { VrgChip("Keresés most") { check() } }
            Spacer(Modifier.height(24.dp))
        }
    }

    @Composable
    private fun Offer(u: UpdateInfo, host: FeatureHost, blocked: Boolean) {
        Text("Új verzió: ${u.name}", style = Melyviz.title)
        Text("${u.size / (1024 * 1024)} MB", style = Melyviz.small)
        if (u.notes.isNotBlank()) {
            VrgSectionTitle("Mi változott")
            Text(u.notes, style = Melyviz.small)
        }
        Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            VrgChip("Letöltés és telepítés", true) { install() }
        }
        if (blocked) {
            Text("Az Androidnak engedélyeznie kell, hogy ez az app telepíthessen. Engedélyezd, majd gyere vissza.",
                style = Melyviz.small.copy(color = Melyviz.sand), modifier = Modifier.padding(top = 8.dp))
            Row(Modifier.padding(top = 6.dp)) { VrgChip("Engedély megnyitása") { openInstallSetting(host) } }
        }
    }
}
