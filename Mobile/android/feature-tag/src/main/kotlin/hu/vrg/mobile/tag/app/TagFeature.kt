package hu.vrg.mobile.tag.app

import android.Manifest
import android.app.Application
import android.content.Intent
import android.media.AudioManager
import android.media.ToneGenerator
import android.net.Uri
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
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
import hu.vrg.mobile.kit.ui.VrgSectionTitle
import hu.vrg.mobile.kit.ui.VrgToggle
import hu.vrg.mobile.pager.Proximity
import hu.vrg.mobile.tag.AdKind
import hu.vrg.mobile.tag.BindPick
import hu.vrg.mobile.tag.HEARD_MS
import hu.vrg.mobile.tag.LeftBehind
import hu.vrg.mobile.tag.RingResult
import hu.vrg.mobile.tag.Seen
import hu.vrg.mobile.tag.SoundProtocol
import hu.vrg.mobile.tag.TagText
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

// Tárgykereső (WP M61, experimental): an Apple Find My tag — the ISYTag from MediaMarkt / Saturn, an AirTag, any
// "Works with Apple Find My" tag — used from Android. Android cannot join Apple's network, so this is everything the
// tag itself says over Bluetooth: which tags are around and how near, "this one is mine" (held to the phone), a finder
// with a sonar tick, ringing it where the tag allows, a left-behind alarm, and the phone's place when it last heard
// it. The Tudnivalók tab says plainly what is not possible and why.

object TagFeature : VrgFeature {
    override val info = Catalogue.TAG
    private val _activity = MutableStateFlow(MiniStatus.IDLE)
    override val activity: StateFlow<MiniStatus> get() = _activity

    enum class Tab(val hu: String) { MINE("Saját címke"), AROUND("Környék"), ABOUT("Tudnivalók") }

    override fun init(app: Application) { Tags.load(app) }

    /** vrg://tag (the service's notifications open it). */
    override fun open(route: Route): Boolean = true

    override fun onForeground(on: Boolean) { Tags.screenForeground(on) }

    @Composable
    override fun Screen(host: FeatureHost) {
        val ctx = LocalContext.current
        val radio by Tags.radio.collectAsStateWithLifecycle()
        val watching by TagService.running.collectAsStateWithLifecycle()
        Tags.version.collectAsStateWithLifecycle().value          // redraw with every advertisement
        var tab by rememberSaveable { mutableStateOf(Tab.MINE) }
        var now by remember { mutableStateOf(System.currentTimeMillis()) }

        DisposableEffect(Unit) {
            Tags.load(ctx)
            TagService.channels(ctx)
            Tags.wantForScreen(ctx, true)
            onDispose { Tags.wantForScreen(ctx, false) }
        }
        LaunchedEffect(Unit) { while (true) { now = System.currentTimeMillis(); delay(500) } }
        LaunchedEffect(radio, watching) {
            _activity.value = if (watching || radio == Tags.Radio.ON) MiniStatus.running() else MiniStatus.IDLE
        }

        val askBt = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { Tags.refresh(ctx) }

        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
            Text("‹ Vissza", style = Melyviz.label.copy(color = Melyviz.current),
                modifier = Modifier.clickable { host.home() }.padding(vertical = 8.dp))
            Text("TÁRGYKERESŐ", style = Melyviz.title.copy(fontSize = 18.sp))
            Text("Kísérleti · Apple Find My címkék Androidon · rádió: ${radio.hu}", style = Melyviz.readout)
            when (radio) {
                Tags.Radio.NO_PERMISSION -> Column(Modifier.padding(top = 6.dp)) {
                    Text("A címkék hallásához Bluetooth engedély kell (Android 9–11-en helymeghatározás).",
                        style = Melyviz.small.copy(color = Melyviz.coral))
                    VrgChip("Engedélyezés", selected = true) { askBt.launch(Tags.permissions()) }
                }
                Tags.Radio.NO_BT -> Column(Modifier.padding(top = 6.dp)) {
                    Text("Kapcsold be a Bluetootht.", style = Melyviz.small.copy(color = Melyviz.sand))
                    VrgChip("Újra") { Tags.refresh(ctx) }
                }
                Tags.Radio.FAILED -> VrgChip("Keresés újraindítása") { Tags.refresh(ctx) }
                else -> {}
            }

            Row(Modifier.padding(vertical = 8.dp).horizontalScroll(rememberScrollState())) {
                Tab.entries.forEach { t ->
                    val n = if (t == Tab.AROUND) Tags.book.around(now).count { it.age(now) <= HEARD_MS } else 0
                    VrgChip(t.hu + if (n > 0) " ($n)" else "", selected = t == tab) { tab = t }
                    Spacer(Modifier.width(4.dp))
                }
            }

            when (tab) {
                Tab.MINE -> MineTab(host, now, watching) { tab = Tab.AROUND }
                Tab.AROUND -> AroundTab(now)
                Tab.ABOUT -> AboutTab()
            }
            Spacer(Modifier.height(24.dp))
        }
    }

    // ---- ringing, shared by both tabs ---------------------------------------------------------------------------

    private var gatt: TagGatt? = null
    private val ringing = MutableStateFlow<String?>(null)     // the address being rung

    private fun ring(ctx: android.content.Context, s: Seen) {
        val g = gatt ?: TagGatt(ctx.applicationContext) { r, p ->
            Tags.ringText.value = r.hu + (p?.let { " (${it.hu})" } ?: "")
            if (r == RingResult.STARTED && p != null && Tags.book.mine?.address == ringing.value) {
                Tags.book.update { it.copy(sound = p) }
                Tags.saveMine(ctx.applicationContext)
            }
            if (r != RingResult.STARTED) ringing.value = null
            Tags.bump()
        }.also { gatt = it }
        if (g.busy) return
        val last = Tags.book.mine?.takeIf { it.address == s.address }?.sound
        ringing.value = s.address
        Tags.ringText.value = "Csatlakozás…"
        g.ring(s.address, SoundProtocol.order(s.ad.type, s.uuids, last))
    }

    @Composable
    private fun RingControls(s: Seen) {
        val ctx = LocalContext.current
        val who by ringing.collectAsStateWithLifecycle()
        val text by Tags.ringText.collectAsStateWithLifecycle()
        Row(Modifier.padding(top = 6.dp)) {
            if (who == s.address) VrgChip("■ Állj", selected = true) { gatt?.stop() }
            else VrgChip("🔔 Csipogtatás") { ring(ctx, s) }
        }
        if (text != null && (who == s.address || who == null)) Text(text!!, style = Melyviz.small)
    }

    // ---- Saját címke -----------------------------------------------------------------------------------------

    @Composable
    private fun MineTab(host: FeatureHost, now: Long, watching: Boolean, toAround: () -> Unit) {
        val ctx = LocalContext.current
        val mine = Tags.book.mine
        if (mine == null) { BindPanel(now, toAround); return }
        val seen = Tags.book.mineSeen()
        val heardNow = seen != null && seen.age(now) <= HEARD_MS
        val d = seen?.takeIf { it.age(now) <= 15_000 }?.distance(mine.tx1m)

        var finder by remember { mutableStateOf(false) }
        var calib by remember { mutableStateOf(false) }
        var calibText by remember { mutableStateOf<String?>(null) }
        var sureForget by remember { mutableStateOf(false) }
        val askNotify = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
        val askPlace = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { Tags.bump() }

        VrgSectionTitle(mine.name)
        Text("${mine.type.hu} · ${mine.kind.hu} · elem: ${mine.battery.hu}", style = Melyviz.readout)
        Text(if (mine.lastSeenAt > 0) "Utoljára hallottam: ${TagText.ago(now - mine.lastSeenAt)}" else "Még nem hallottam.",
            style = Melyviz.small.copy(color = if (heardNow) Melyviz.kelp else Melyviz.sand))

        if (mine.guessed) Column(Modifier.padding(vertical = 6.dp)) {
            Text("A címke új címet kapott (ez rendes: így védi a gazdáját). Ezt a címkét tartom a tiédnek: csipogtasd meg, " +
                "hogy biztos legyél.", style = Melyviz.small.copy(color = Melyviz.sand))
            VrgChip("Igen, ez az") { Tags.book.confirm(); Tags.saveMine(ctx); Tags.bump() }
        }

        // the big readout
        Text(if (heardNow || d != null) Proximity.label(d) else "nincs jel",
            style = Melyviz.title.copy(fontSize = 44.sp, color = if (heardNow) Melyviz.glow else Melyviz.faint),
            modifier = Modifier.padding(top = 8.dp))
        if (seen != null && heardNow) {
            val t = seen.rssi.trend(now)
            Text("${Proximity.zone(d, seen.age(now)).hu} · ${t.arrow} ${t.hu} · ${seen.rssi.value?.toInt() ?: "—"} dBm",
                style = Melyviz.readout)
        }

        if (seen != null) RingControls(seen)
        Row(Modifier.padding(top = 6.dp)) {
            VrgChip(if (finder) "Keresés ki" else "Keresés (hangjelzés)", selected = finder) { finder = !finder }
            Spacer(Modifier.width(6.dp))
            VrgChip(if (calib) "Kalibrálás…" else "1 m kalibrálás", selected = calib) { if (!calib) { calibText = null; calib = true } }
        }
        if (calib) Text("Tartsd a címkét pontosan 1 méterre a telefontól 6 másodpercig.", style = Melyviz.small)
        calibText?.let { Text(it, style = Melyviz.small) }

        LaunchedEffect(finder) {
            host.keepScreenOn(finder)
            if (!finder) return@LaunchedEffect
            val tone = runCatching { ToneGenerator(AudioManager.STREAM_MUSIC, 80) }.getOrNull()
            try {
                while (true) {
                    val s = Tags.book.mineSeen()
                    val t = System.currentTimeMillis()
                    val dist = s?.takeIf { it.age(t) <= 8_000 }?.distance(Tags.book.mine?.tx1m ?: -62)
                    if (dist != null) runCatching { tone?.startTone(ToneGenerator.TONE_PROP_BEEP, 35) }
                    delay(Proximity.finderInterval(dist))
                }
            } finally { tone?.release() }
        }
        LaunchedEffect(calib) {
            if (!calib) return@LaunchedEffect
            Tags.calibrating = mutableListOf()
            delay(6_000)
            val samples = Tags.calibrating.orEmpty().toList()
            Tags.calibrating = null
            val tx = Proximity.calibrate(samples)
            calibText = if (tx != null) {
                Tags.book.update { it.copy(tx1m = tx) }; Tags.saveMine(ctx)
                "Kész: 1 m-en $tx dBm (${samples.size} minta)."
            } else "Nem sikerült (${samples.size} minta, túl ingadozó). Próbáld újra, mozdulatlanul."
            calib = false
        }

        // where it was last heard
        VrgSectionTitle("Utolsó hely")
        if (mine.lastLat != null && mine.lastLon != null) {
            Text("A telefon helye, amikor utoljára hallotta (±${mine.lastAccM?.toInt() ?: "?"} m). " +
                "Nem a címke saját helye: az csak a gazdája Apple eszközén látszik.", style = Melyviz.small)
            VrgChip("Megnyitás térképen") {
                val q = "${mine.lastLat},${mine.lastLon}"
                runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("geo:$q?q=$q(${Uri.encode(mine.name)})"))) }
            }
        } else Text("Még nincs megjegyzett hely.", style = Melyviz.small)
        if (!Tags.placeAllowed(ctx)) VrgChip("Hely megjegyzése: engedély") {
            askPlace.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
        }

        // left behind
        VrgSectionTitle("Ottfelejtés")
        VrgToggle("Szóljon, ha lemarad", watching) { on ->
            if (on) {
                if (VrgNotify.needsPermission(ctx) && Build.VERSION.SDK_INT >= 33) askNotify.launch(Manifest.permission.POST_NOTIFICATIONS)
                TagService.start(ctx)
            } else TagService.stop(ctx)
        }
        Text("Állapot: ${Tags.watch.state.hu}. A képernyő kikapcsolva is figyel; ehhez állandó értesítést mutat.", style = Melyviz.small)
        Row(Modifier.padding(top = 4.dp).horizontalScroll(rememberScrollState())) {
            val cur = (Tags.watch.afterMs / 1000).toInt()
            LeftBehind.CHOICES.forEach { s ->
                VrgChip(if (s < 60) "$s mp" else "${s / 60} perc", selected = s == cur) { Tags.setWatchSecs(ctx, s) }
                Spacer(Modifier.width(4.dp))
            }
        }

        VrgSectionTitle("Részletek")
        Text("cím: ${mine.address}" + (if (mine.pastAddresses.isNotEmpty()) " · korábbi: ${mine.pastAddresses.size}" else ""), style = Melyviz.readout)
        Text("1 m-es szint: ${mine.tx1m} dBm · hang: ${mine.sound?.hu ?: "még nem szólt"}", style = Melyviz.readout)
        Row(Modifier.padding(top = 8.dp)) {
            VrgChip(if (sureForget) "Biztosan elfelejtem" else "Elfelejtés", selected = sureForget) {
                if (!sureForget) sureForget = true
                else { TagService.stop(ctx); Tags.book.forget(); Tags.saveMine(ctx); sureForget = false; Tags.bump() }
            }
        }
    }

    @Composable
    private fun BindPanel(now: Long, toAround: () -> Unit) {
        val ctx = LocalContext.current
        var name by rememberSaveable { mutableStateOf("ISYTag") }
        val pick = Tags.book.bindPick(now)
        VrgSectionTitle("Ez az enyém")
        Text("Tartsd a címkét a telefon hátához. Ha még soha nem volt párosítva, nyomd meg a gombját, vagy vedd ki és " +
            "tedd vissza az elemét: párosítási módban is hallom.", style = Melyviz.small)
        Text(TagText.bindHint(pick), style = Melyviz.label.copy(color = if (pick is BindPick.Ok) Melyviz.glow else Melyviz.sand),
            modifier = Modifier.padding(vertical = 6.dp))
        OutlinedTextField(
            value = name, onValueChange = { name = it.take(24) }, singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("név, pl. Kulcscsomó", style = Melyviz.small) },
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Melyviz.glow, unfocusedBorderColor = Melyviz.line,
                focusedTextColor = Melyviz.ink, unfocusedTextColor = Melyviz.ink, cursorColor = Melyviz.glow,
            ),
        )
        Row(Modifier.padding(top = 8.dp)) {
            VrgChip("Ez az enyém", selected = pick is BindPick.Ok) {
                if (pick is BindPick.Ok) { Tags.book.bind(pick.seen, name, System.currentTimeMillis()); Tags.saveMine(ctx); Tags.bump() }
            }
            Spacer(Modifier.width(6.dp))
            VrgChip("Környék") { toAround() }
        }
    }

    // ---- Környék ---------------------------------------------------------------------------------------------

    @Composable
    private fun AroundTab(now: Long) {
        val ctx = LocalContext.current
        var open by remember { mutableStateOf<String?>(null) }
        val list = Tags.book.around(now)
        VrgSectionTitle("Find My címkék a közelben")
        if (list.isEmpty()) Text("Még egy sem. Egy gazdájától távoli címke 2 mp-enként hirdet; egy párosítatlan csak " +
            "pár percig a bekapcsolása után.", style = Melyviz.small)
        val mineAddr = Tags.book.mine?.address
        list.forEach { s ->
            val heard = s.age(now) <= HEARD_MS
            val tag = when {
                s.address == mineAddr -> "★ "
                Tags.book.isBackground(s.address) -> "· "
                else -> ""
            }
            Column(Modifier.fillMaxWidth().clickable { open = if (open == s.address) null else s.address }.padding(vertical = 6.dp)) {
                Text("$tag${s.ad.type.hu} · ${s.ad.kind.hu}" + (if (s.ad.battery.name != "UNKNOWN") " · elem: ${s.ad.battery.hu}" else ""),
                    style = Melyviz.label.copy(color = if (heard) Melyviz.ink else Melyviz.faint))
                Text("${if (heard) Proximity.label(s.distance(Tags.book.mine?.takeIf { it.address == s.address }?.tx1m ?: -62)) else "nincs jel"} · " +
                    "${s.rssi.value?.toInt() ?: "—"} dBm · ${TagText.ago(s.age(now))}" + (s.ad.keyTag?.let { " · kulcs $it…" } ?: ""),
                    style = Melyviz.readout)
                if (open == s.address) {
                    RingControls(s)
                    if (s.address != mineAddr) Row(Modifier.padding(top = 4.dp)) {
                        VrgChip("Ez az enyém") {
                            Tags.book.bind(s, Tags.book.mine?.name ?: (if (s.ad.kind == AdKind.PAIRING) "ISYTag" else "Címke"), System.currentTimeMillis())
                            Tags.saveMine(ctx); Tags.bump()
                        }
                    }
                }
            }
        }
        Text("★ a tiéd · · a tiéddel egy időben hallott, tehát biztosan nem a tiéd. A kulcs a címke nyilvános kulcsának " +
            "eleje: naponta egyszer változik.", style = Melyviz.small, modifier = Modifier.padding(top = 8.dp))
    }

    // ---- Tudnivalók ------------------------------------------------------------------------------------------

    @Composable
    private fun AboutTab() {
        VrgSectionTitle("Mit tud Androidon")
        listOf(
            "Hallja a címkét Bluetooth-on, kb. 10–30 m-ig, és becsüli, milyen messze van (tájékoztató érték, nem mérőszalag).",
            "Megjegyzi a tiédet, és követi, amikor új címet kap.",
            "Megszólaltatja, ha a címke engedi. A gyártóktól független szabvány (DULT) szerint csak akkor szól, ha a gazdája " +
                "Apple eszközétől távol van. Egy soha nem párosított címkénél ez a telefonon derül ki.",
            "Szól, ha lemarad, és megjegyzi, hol volt a telefon, amikor utoljára hallotta.",
        ).forEach { Text("• $it", style = Melyviz.small, modifier = Modifier.padding(vertical = 2.dp)) }
        VrgSectionTitle("Mit nem tud, és miért")
        listOf(
            "Távoli helyet nem mutat. Az Apple Find My hálózat helyjelentéseit csak a címke gazdájának Apple fiókja tudja " +
                "visszafejteni. A kulcs a párosításkor az Apple eszközön marad, Android nem kap belőle.",
            "Androidról nem párosítható Apple fiókhoz. A párosítás csak iPhone, iPad vagy Mac Lokátor appjából megy.",
            "A Google Lokátor (Find Hub) hálózatára sem tehető fel: a címke gyári szoftvere csak az Apple hálózatát ismeri.",
            "Ha egy iPhone-nal párosítod, a címke a gazdájától távol is rendesen hirdet, és ez az app úgy is látja. " +
                "Ilyenkor egy idő után az Android ismeretlen nyomkövetőt jelezhet: ez a saját címkéd.",
        ).forEach { Text("• $it", style = Melyviz.small, modifier = Modifier.padding(vertical = 2.dp)) }
        VrgSectionTitle("Kísérleti")
        Text("Az ISYTag (IMTRON / MediaMarkt, IIT 1000) viselkedését még nem ellenőriztük telefonon: ez a WP M61 " +
            "„Telefonon ellenőrizni” listája. A Napló („tag”) minden csipogtatási lépést rögzít.", style = Melyviz.small)
    }
}
