package hu.vrg.mobile.settings

import android.content.Context
import android.content.pm.PackageManager
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.pm.PackageInfoCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.Look
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.ShellSettings
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.theme.Palettes
import hu.vrg.mobile.kit.ui.PaletteRow
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.kit.ui.VrgSectionTitle
import hu.vrg.mobile.kit.ui.VrgSlider
import hu.vrg.mobile.kit.ui.VrgToggle
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// Beállítások (WP M1): the settings that belong to the whole app, not to one feature.
//   Megjelenés       palette and size, applied by the shell to every screen
//   Indulás          reopen the last feature (D-5)
//   Párosított PC-k  filled in by QR párosítás (M2); removable here
//   Névjegy          version, build, commit, open-source notices
//   Napló            the last 200 lines of VrgLog

object SettingsFeature : VrgFeature {
    override val info = Catalogue.SETTINGS

    @Composable
    override fun Screen(host: FeatureHost) {
        val s by ShellSettings.flow.collectAsStateWithLifecycle()
        val log by VrgLog.lines.collectAsStateWithLifecycle()
        val ctx = LocalContext.current
        val clipboard = LocalClipboardManager.current
        val about = remember { About.read(ctx) }

        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
            Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current),
                modifier = Modifier.clickable { host.home() }.padding(vertical = 8.dp))
            Text("BEÁLLÍTÁSOK", style = Melyviz.title.copy(fontSize = 18.sp))
            Text("Az egész alkalmazásra érvényes", style = Melyviz.small)

            // ---- look ------------------------------------------------------------------------------
            VrgSectionTitle("Megjelenés — paletta")
            Palettes.ALL.forEach { p ->
                PaletteRow(p, selected = s.palette == p.id) {
                    ShellSettings.update { it.copy(palette = p.id) }
                    VrgLog.i(info.id, "Paletta: ${p.name}")
                }
            }
            Spacer(Modifier.height(6.dp))
            VrgSlider("Kezelőfelület mérete", s.uiScale, Look.SCALE, "%.2f×") { v ->
                ShellSettings.update { it.copy(uiScale = Look.scale(v)) }
            }
            Text("Minden képernyőre érvényes, a Légegérre is.", style = Melyviz.small)

            // ---- start -----------------------------------------------------------------------------
            VrgSectionTitle("Indulás")
            VrgToggle("Az utoljára nyitott funkcióval induljon", s.startInLast) { v ->
                ShellSettings.update { it.copy(startInLast = v) }
            }

            // ---- paired PCs ------------------------------------------------------------------------
            VrgSectionTitle("Párosított PC-k")
            if (s.pairedPcs.isEmpty()) {
                Text("Még nincs párosított PC. A QR párosítás tölti meg ezt a listát.", style = Melyviz.small)
            } else s.pairedPcs.forEach { pc ->
                Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(pc.name.ifBlank { pc.id }, style = Melyviz.label)
                        Text("${pc.relay}  ·  ${DAY.format(Date(pc.pairedAt))}", style = Melyviz.readout)
                    }
                    VrgChip("Törlés") {
                        ShellSettings.update { p -> p.copy(pairedPcs = p.pairedPcs.filterNot { it.id == pc.id }) }
                        VrgLog.i(info.id, "Párosítás törölve: ${pc.name}")
                    }
                }
            }
            Row(Modifier.padding(top = 8.dp)) { VrgChip("QR párosítás ›") { host.open(Catalogue.PAIR.id) } }

            // ---- about -----------------------------------------------------------------------------
            VrgSectionTitle("Névjegy")
            Text("VRG Mobile ${about.version}", style = Melyviz.label)
            Text("build ${about.build}  ·  commit ${about.commit}", style = Melyviz.readout)
            Text("hu.vrg.mobile  ·  Android ${android.os.Build.VERSION.RELEASE}", style = Melyviz.readout)
            Spacer(Modifier.height(8.dp))
            Text("Nyílt forrású összetevők", style = Melyviz.small.copy(color = Melyviz.faint))
            NOTICES.forEach { (name, licence) ->
                Row(Modifier.fillMaxWidth()) {
                    Text(name, style = Melyviz.small, modifier = Modifier.weight(1f))
                    Text(licence, style = Melyviz.readout)
                }
            }

            // ---- log -------------------------------------------------------------------------------
            VrgSectionTitle("Napló — utolsó ${log.size} sor")
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                VrgChip("Másolás") {
                    clipboard.setText(AnnotatedString(log.joinToString("\n") { it.format() }))
                    host.note("A napló a vágólapon")
                }
                VrgChip("Törlés") { VrgLog.clear() }
            }
            Spacer(Modifier.height(6.dp))
            if (log.isEmpty()) Text("Üres. A funkciók ide írják, mi történt (kapcsolódás, bontás, hibák).", style = Melyviz.small)
            log.asReversed().forEach { l ->
                Text(l.format(), style = Melyviz.readout.copy(fontSize = 10.sp, color = if (l.warn) Melyviz.sand else Melyviz.muted))
            }
            Spacer(Modifier.height(24.dp))
        }
    }

    private val DAY = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.ROOT)

    /** What this APK is made of. Every entry is Apache 2.0, which asks for the notice, not the text. */
    private val NOTICES = listOf(
        "Kotlin, kotlinx.coroutines (JetBrains)" to "Apache 2.0",
        "AndroidX, Jetpack Compose, Material 3 (Google)" to "Apache 2.0",
        "OkHttp, Okio (Square)" to "Apache 2.0",
    )
}

/** Version, build number and commit, read from the installed package. */
private data class About(val version: String, val build: Long, val commit: String) {
    companion object {
        fun read(ctx: Context): About {
            val pm = ctx.packageManager
            @Suppress("DEPRECATION")
            val pi = pm.getPackageInfo(ctx.packageName, 0)
            @Suppress("DEPRECATION")
            val meta = pm.getApplicationInfo(ctx.packageName, PackageManager.GET_META_DATA).metaData
            val sha = meta?.getString("vrg.gitSha")?.removePrefix("git:") ?: "?"
            return About(pi.versionName ?: "?", PackageInfoCompat.getLongVersionCode(pi), sha)
        }
    }
}
