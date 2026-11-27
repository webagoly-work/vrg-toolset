@file:OptIn(ExperimentalLayoutApi::class)

package hu.vrg.mobile.pager.app

import android.Manifest
import android.app.Application
import android.os.Build
import android.view.KeyEvent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import hu.vrg.mobile.core.Catalogue
import hu.vrg.mobile.core.MiniStatus
import hu.vrg.mobile.core.Route
import hu.vrg.mobile.kit.FeatureHost
import hu.vrg.mobile.kit.VrgFeature
import hu.vrg.mobile.kit.VrgNotify
import hu.vrg.mobile.kit.theme.Melyviz
import hu.vrg.mobile.kit.ui.VrgChip
import hu.vrg.mobile.pager.Crew
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import hu.vrg.mobile.kit.ui.FeatureTop

// Csipogó (WP M33): the Site Pager — the ESP32-S3 + nRF905 belt pager pair from the Archive's Site Pager Builder —
// reimagined on the crew's phones. Same buttons (CALL held, SEEN, K1–K3 short / long, LINK), same 14 messages and
// GOTIT / SEEN receipts, the same GUARD and man-down, carried over Bluetooth LE instead of 433 MHz; plus what a
// phone adds: who is how near (RSSI), chat, push-to-talk voice. No internet, no PC, no pairing dialog.

object PagerFeature : VrgFeature {
    override val info = Catalogue.PAGER
    private val _activity = MutableStateFlow(MiniStatus.IDLE)
    override val activity: StateFlow<MiniStatus> get() = _activity

    enum class Tab(val hu: String) { PANEL("Csipogó"), NEAR("Közelség"), CHAT("Csevegés"), TALK("Adóvevő"), SAFE("Őrzés"), SETUP("Beállítás") }

    override fun init(app: Application) {
        hu.vrg.mobile.core.RadarHub.register(PagerRadar)      // the crew on the radar (WP M67)
        Pager.applySettings(app)
        Pager.guardPrefs(app)
        keysOn = Pager.settings(app).volumeKeys
    }

    /** vrg://pager?crew=CODE — a crew code shared from another phone; the screen asks before switching. */
    override fun open(route: Route): Boolean {
        route.params["crew"]?.let { Pager.pendingCrew.value = Crew.normalise(it) }
        return true
    }

    @Composable
    override fun Screen(host: FeatureHost) {
        val ctx = LocalContext.current
        val radio by Pager.radio.collectAsStateWithLifecycle()
        Pager.version.collectAsStateWithLifecycle().value          // redraw with the engine
        var tab by rememberSaveable { mutableStateOf(Tab.PANEL) }
        var denied by remember { mutableStateOf(false) }
        LaunchedEffect(radio) { _activity.value = if (radio == Pager.Radio.ON) MiniStatus.running() else MiniStatus.IDLE }

        val askNotify = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
        val askRadio = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { r ->
            if (r.values.all { it }) {
                if (VrgNotify.needsPermission(ctx) && Build.VERSION.SDK_INT >= 33) askNotify.launch(Manifest.permission.POST_NOTIFICATIONS)
                PagerService.start(ctx)
            } else denied = true
        }
        val switchOn = {
            if (Pager.radioAllowed(ctx)) {
                if (VrgNotify.needsPermission(ctx) && Build.VERSION.SDK_INT >= 33) askNotify.launch(Manifest.permission.POST_NOTIFICATIONS)
                PagerService.start(ctx)
            } else askRadio.launch(Pager.radioPermissions())
        }

        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
            // the header (Fényjel: kit FeatureTop), then who this phone is on the crew
            FeatureTop(host, info) {
                if (radio == Pager.Radio.ON || radio == Pager.Radio.STARTING) VrgChip("Kikapcsolás") { PagerService.stop(ctx) }
                else VrgChip("Bekapcsolás", selected = true) { denied = false; switchOn() }
            }
            val me = Pager.engine.me
            Text("${me.crew.code} · ${me.unit}. egység · ${me.name} · rádió: ${radio.hu}", style = Melyviz.readout)
            Pager.radioDetail?.takeIf { radio == Pager.Radio.FAILED }?.let { Text(it, style = Melyviz.small.copy(color = Melyviz.coral)) }
            if (radio == Pager.Radio.NO_BT) Text("Kapcsold be a Bluetootht; a Csipogó magától újraindul.", style = Melyviz.small.copy(color = Melyviz.sand))
            if (denied || radio == Pager.Radio.NO_PERMISSION) Text("A Csipogónak a Bluetooth (Android 9–11-en a helymeghatározás) engedély kell: e nélkül nem hallja a csapatot.",
                style = Melyviz.small.copy(color = Melyviz.coral))
            if (Pager.engine.unitClash) Text("Egy másik telefon is a(z) ${Pager.engine.me.unit}. egységszámot használja: válassz másikat a Beállításban.",
                style = Melyviz.small.copy(color = Melyviz.coral))

            Pager.pendingCrew.collectAsStateWithLifecycle().value?.let { code -> CrewInvite(code) }

            // a wrapping strip: on a phone the six tabs take two lines, so Beállítás is never scrolled out of sight
            FlowRow(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Tab.entries.forEach { t -> VrgChip(t.hu + badge(t), selected = t == tab) { tab = t } }
            }

            when (tab) {
                Tab.PANEL -> PanelTab(radio == Pager.Radio.ON)
                Tab.NEAR -> NearTab()
                Tab.CHAT -> ChatTab()
                Tab.TALK -> TalkTab()
                Tab.SAFE -> SafeTab()
                Tab.SETUP -> SetupTab(host)
            }
            Spacer(Modifier.height(24.dp))
        }
    }

    private fun badge(t: Tab): String = when (t) {
        Tab.PANEL -> Pager.engine.unseen().size.takeIf { it > 0 }?.let { " ($it)" } ?: ""
        Tab.NEAR -> Pager.engine.peers(System.currentTimeMillis()).count { it.ageMs < 15_000 || it.linked }.takeIf { it > 0 }?.let { " ($it)" } ?: ""
        else -> ""
    }

    @Composable
    private fun CrewInvite(code: String) {
        val ctx = LocalContext.current
        Column(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
            Text("Csatlakozás a(z) $code csapathoz?", style = Melyviz.label.copy(color = Melyviz.glow))
            Text("Ezután csak a $code kódú telefonokat hallod.", style = Melyviz.small)
            Row(Modifier.padding(top = 4.dp)) {
                VrgChip("Csatlakozom", selected = true) {
                    Pager.save(ctx, Pager.settings(ctx).copy(crew = code)); Pager.pendingCrew.value = null
                }
                Spacer(Modifier.width(8.dp))
                VrgChip("Mégse") { Pager.pendingCrew.value = null }
            }
        }
    }

    // ---- hardware keys: the pager's thumb buttons on the phone's side --------------------------------------

    /** Volume down held = PTT (Adóvevő); volume up = LÁTTAM. Only while Csipogó is on screen and the setting is on. */
    override fun onKey(event: KeyEvent): Boolean {
        val svc = PagerService.current ?: return false
        if (!keysOn) return false
        when (event.keyCode) {
            KeyEvent.KEYCODE_VOLUME_DOWN -> when (event.action) {
                KeyEvent.ACTION_DOWN -> if (event.repeatCount == 0) svc.pttDown()
                KeyEvent.ACTION_UP -> svc.pttUp()
            }
            KeyEvent.KEYCODE_VOLUME_UP -> if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
                Pager.banner.value = System.currentTimeMillis() to Pager.engine.seen(System.currentTimeMillis())
            }
            else -> return false
        }
        return true
    }

    /** Mirrors the "volumeKeys" setting; the screen sets it when it loads the settings. */
    @Volatile var keysOn = true

    override fun onForeground(on: Boolean) { if (!on) PagerService.current?.pttUp() }
}
