package hu.vrg.mobile.account

import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.DeviceCode
import hu.vrg.mobile.core.VrgRepo
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.github.Account
import hu.vrg.mobile.kit.github.Gh
import hu.vrg.mobile.kit.github.GitHub
import hu.vrg.mobile.kit.github.problem
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.ui.VrgSectionTitle
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

// GitHub fiók (WP M3): sign in once with the device flow, see who is signed in and whether the
// toolset repo is reachable, sign out. The code is shown big and copyable; github.com/login/device
// opens in a Custom Tab; the phone polls until it is entered. Everything else online uses this account
// through kit's GitHub client.

object AccountFeature : VrgFeature {
    override val info = Catalogue.ACCOUNT

    private sealed interface Flow {
        data object Idle : Flow
        data object Asking : Flow
        data class Code(val code: DeviceCode, val until: Long) : Flow
        data class Problem(val text: String) : Flow
    }

    private val flow = MutableStateFlow<Flow>(Flow.Idle)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var job: Job? = null

    private fun signIn() {
        job?.cancel()
        flow.value = Flow.Asking
        job = scope.launch {
            when (val r = GitHub.requestCode()) {
                is Gh.Ok -> {
                    val c = r.value
                    flow.value = Flow.Code(c, System.currentTimeMillis() + c.expiresIn * 1000L)
                    val done = GitHub.waitForToken(c)
                    flow.value = if (done is Gh.Ok) Flow.Idle else Flow.Problem(done.problem() ?: "?")
                }
                else -> flow.value = Flow.Problem(r.problem() ?: "?")
            }
        }
    }

    private fun cancel() { job?.cancel(); flow.value = Flow.Idle }

    @Composable
    override fun Screen(host: FeatureHost) {
        val account by GitHub.account.collectAsStateWithLifecycle()
        val f by flow.collectAsStateWithLifecycle()
        val rate by GitHub.rate.collectAsStateWithLifecycle()

        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
            Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current),
                modifier = Modifier.clickable { host.home() }.padding(vertical = 8.dp))
            Text("GITHUB FIÓK", style = Melyviz.title.copy(fontSize = 18.sp))
            Text("Egy belépés, minden online funkcióhoz (Haladás, Gyorsjegyzet, Frissítés, Értesítések).", style = Melyviz.small)
            Spacer(Modifier.height(14.dp))

            when (val a = account) {
                is Account.SignedIn -> SignedIn(a, host)
                Account.SignedOut -> when {
                    GitHub.clientId.isEmpty() -> Card {
                        Text("Még nincs beállítva", style = Melyviz.title)
                        Text("A belépéshez egy GitHub OAuth App kell (Device Flow bekapcsolva), és a Client ID-ja a " +
                            "kit/src/main/res/values/github.xml fájlba. Ez nyilvános azonosító, nem titok.", style = Melyviz.small)
                    }
                    else -> SignInFlow(f)
                }
            }

            rate?.let {
                VrgSectionTitle("GitHub keret")
                Text("${it.remaining} / ${it.limit} kérés maradt ebben az órában", style = Melyviz.readout)
            }
        }
    }

    @Composable
    private fun SignInFlow(f: Flow) {
        val ctx = LocalContext.current
        val clipboard = LocalClipboardManager.current
        when (f) {
            Flow.Idle -> {
                Text("A telefon egy kódot mutat, ezt kell beírni a github.com/login/device oldalon. Jelszó nem kell az alkalmazásba.",
                    style = Melyviz.small)
                Row(Modifier.padding(top = 10.dp)) { VrgChip("Belépés GitHubbal", true) { signIn() } }
            }
            Flow.Asking -> Text("Kód kérése a GitHubtól…", style = Melyviz.small)
            is Flow.Code -> {
                val left by produceState(initialValue = (f.until - System.currentTimeMillis()) / 1000, f) {
                    while (value > 0) { delay(1000); value = (f.until - System.currentTimeMillis()) / 1000 }
                }
                Card {
                    Text("Írd be ezt a kódot:", style = Melyviz.small)
                    Text(f.code.userCode, style = Melyviz.title.copy(fontSize = 34.sp, fontWeight = FontWeight.Bold,
                        letterSpacing = 4.sp, color = Melyviz.glow, fontFamily = Melyviz.mono))
                    Text(f.code.verificationUri, style = Melyviz.readout)
                    Text("még ${left / 60}:${"%02d".format(left % 60)}  ·  várom a GitHubot…", style = Melyviz.small)
                }
                Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    VrgChip("Megnyitás", true) {
                        clipboard.setText(AnnotatedString(f.code.userCode))
                        val uri = Uri.parse(f.code.verificationUri)
                        try { CustomTabsIntent.Builder().build().launchUrl(ctx, uri) }
                        catch (e: ActivityNotFoundException) {
                            runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
                        }
                    }
                    VrgChip("Kód másolása") { clipboard.setText(AnnotatedString(f.code.userCode)) }
                    VrgChip("Mégse") { cancel() }
                }
                Text("A „Megnyitás” a kódot a vágólapra is teszi.", style = Melyviz.small, modifier = Modifier.padding(top = 6.dp))
            }
            is Flow.Problem -> {
                Text(f.text, style = Melyviz.label.copy(color = Melyviz.coral))
                Row(Modifier.padding(top = 10.dp)) { VrgChip("Újra", true) { signIn() } }
            }
        }
    }

    @Composable
    private fun SignedIn(a: Account.SignedIn, host: FeatureHost) {
        val avatar by produceState<ImageBitmap?>(null, a.user?.avatarUrl) {
            val url = a.user?.avatarUrl ?: return@produceState
            value = GitHub.bytes(url)?.let { b -> BitmapFactory.decodeByteArray(b, 0, b.size)?.asImageBitmap() }
        }
        var busy by remember { mutableStateOf(false) }
        LaunchedEffect(Unit) { GitHub.refresh() }

        Card {
            Row(verticalAlignment = Alignment.CenterVertically) {
                avatar?.let { Image(it, null, Modifier.size(48.dp).clip(CircleShape)) }
                    ?: Spacer(Modifier.size(48.dp).clip(CircleShape).background(Melyviz.surface))
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(a.user?.login ?: "Belépve", style = Melyviz.title)
                    a.user?.name?.let { Text(it, style = Melyviz.small) }
                }
            }
        }
        VrgSectionTitle("A toolset repó")
        val repo = a.repo
        val note = a.note
        Text(
            when {
                repo == null -> note ?: "Ellenőrzés…"
                repo.push -> "✓ ${repo.fullName}  ·  olvasás + írás  ·  ${repo.defaultBranch}"
                else -> "✓ ${repo.fullName}  ·  csak olvasás"
            },
            style = Melyviz.label.copy(color = if (repo != null) Melyviz.kelp else Melyviz.sand),
        )
        if (repo == null && note == null) Text(VrgRepo.FULL, style = Melyviz.readout)
        if (repo != null && note != null) Text(note, style = Melyviz.small.copy(color = Melyviz.sand))

        Row(Modifier.padding(top = 14.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            VrgChip(if (busy) "Frissítés…" else "Frissítés") {
                if (!busy) { busy = true; scope.launch { GitHub.refresh(); busy = false } }
            }
            VrgChip("Kilépés") { GitHub.signOut() }
            VrgChip("Beállítások ›") { host.open(Catalogue.SETTINGS.id) }
        }
        Text("Kilépéskor a token törlődik a telefonról. A GitHubon a hozzáférés a Settings → Applications alatt vonható vissza.",
            style = Melyviz.small, modifier = Modifier.padding(top = 8.dp))
    }

    @Composable
    private fun Card(content: @Composable () -> Unit) {
        val shape = RoundedCornerShape(Melyviz.radius)
        Column(
            Modifier.fillMaxWidth().clip(shape).background(Melyviz.raised).border(1.dp, Melyviz.glowDim, shape).padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) { content() }
    }
}
