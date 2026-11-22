package hu.vrg.mobile.tag.app

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothManager
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.ParcelUuid
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.tag.FindMy
import hu.vrg.mobile.tag.LeftBehind
import hu.vrg.mobile.tag.Mine
import hu.vrg.mobile.tag.PhoneFinder
import hu.vrg.mobile.tag.TagBook
import hu.vrg.mobile.tag.TagType
import kotlinx.coroutines.flow.MutableStateFlow

// Tárgykereső's state, shared by the screen and the left-behind service: the tag book (tag-core), one filtered BLE
// scanner, the left-behind watch, and the phone's last known place whenever "mine" is heard. The scanner runs while
// someone wants it: the screen while it is visible (fast), the service while Ottfelejtés is on (balanced). Android
// throttles scan starts (five in 30 s), so it is only restarted when that wish changes.

@SuppressLint("MissingPermission")    // started only after allowed()
object Tags {
    enum class Radio(val hu: String) { OFF("ki"), ON("hallgat"), NO_BT("a Bluetooth ki van kapcsolva"), NO_PERMISSION("nincs engedély"), FAILED("hiba") }

    val book = TagBook()
    val watch = LeftBehind()
    /** Bumped on every change the screen draws. */
    val version = MutableStateFlow(0L)
    val radio = MutableStateFlow(Radio.OFF)
    /** The last ring attempt's message, for the screen. */
    val ringText = MutableStateFlow<String?>(null)

    /** An iTag held connected (Ottfelejtés on): true while the link is up. */
    val linkUp = MutableStateFlow(false)
    /** Telefonkereső: the iTag's button rings the phone. */
    val finder = PhoneFinder()
    private var link: ItagLink? = null
    private var ringtone: Ringtone? = null

    /** Raw RSSI of mine collected during the 1 m calibration, else null. */
    @Volatile var calibrating: MutableList<Int>? = null

    private const val PREFS = "vrg-tag"
    private var loaded = false
    private var wantScreen = false
    private var wantWatch = false
    private var scanningLow: Boolean? = null
    private var appCtx: Context? = null
    private var lastSave = 0L
    private var lastPlace = 0L
    private var lastRelinkCheck = 0L

    fun load(ctx: Context) {
        if (loaded) return
        loaded = true
        appCtx = ctx.applicationContext
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        book.load(Mine.decode(p.getString("mine", null)))
        watch.afterMs = p.getInt("watchSecs", 90) * 1000L
    }

    fun saveMine(ctx: Context) {
        lastSave = System.currentTimeMillis()
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("mine", book.mine?.encode()).apply()
    }

    fun watchWanted(ctx: Context): Boolean = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("watch", false)
    fun setWatchWanted(ctx: Context, on: Boolean) =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("watch", on).apply()

    fun setWatchSecs(ctx: Context, secs: Int) {
        watch.afterMs = secs * 1000L
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putInt("watchSecs", secs).apply()
        bump()
    }

    fun bump() { version.value = System.nanoTime() }

    // ---- permissions -----------------------------------------------------------------------------------------

    fun permissions(): Array<String> = if (Build.VERSION.SDK_INT >= 31) arrayOf(
        Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT,
    ) else arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)

    private fun has(ctx: Context, perm: String) = ctx.checkSelfPermission(perm) == PackageManager.PERMISSION_GRANTED
    fun allowed(ctx: Context) = permissions().all { has(ctx, it) }
    fun placeAllowed(ctx: Context) = has(ctx, Manifest.permission.ACCESS_FINE_LOCATION) || has(ctx, Manifest.permission.ACCESS_COARSE_LOCATION)

    // ---- the scanner -------------------------------------------------------------------------------------------

    private val callback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) { heard(result) }
        override fun onBatchScanResults(results: MutableList<ScanResult>) { results.forEach { heard(it) } }
        override fun onScanFailed(errorCode: Int) {
            VrgLog.w("tag", "scan failed: $errorCode")
            scanningLow = null
            radio.value = Radio.FAILED
        }
    }

    /** The screen is visible (true) or gone (false). */
    fun wantForScreen(ctx: Context, on: Boolean) { wantScreen = on; apply(ctx) }

    /** The app went to / came back from the background with the screen showing (no Context at hand there). */
    fun screenForeground(on: Boolean) { appCtx?.let { wantForScreen(it, on) } }

    /** The left-behind service runs (true) or stopped (false). */
    fun wantForWatch(ctx: Context, on: Boolean) { wantWatch = on; apply(ctx) }

    @Synchronized
    private fun apply(ctx: Context) {
        load(ctx)
        syncLink(ctx)
        val want = wantScreen || wantWatch
        val low = !wantScreen
        if (!want) { stopScan(ctx); radio.value = Radio.OFF; bump(); return }
        if (!allowed(ctx)) { stopScan(ctx); radio.value = Radio.NO_PERMISSION; bump(); return }
        val adapter = ctx.getSystemService(BluetoothManager::class.java)?.adapter
        if (adapter == null || !adapter.isEnabled) { stopScan(ctx); radio.value = Radio.NO_BT; bump(); return }
        if (scanningLow == low) return
        stopScan(ctx)
        val scanner = adapter.bluetoothLeScanner ?: run { radio.value = Radio.NO_BT; return }
        // Screen on: an unfiltered scan, so an iTag (known only by its name) is heard too; the parser drops the rest.
        // Screen off (Ottfelejtés only): two filters, Apple's offline-finding record (company 0x004C, first byte 0x12)
        // and the Find My service (an unpaired tag), because Android pauses unfiltered scans with the screen off. An
        // iTag needs no scan then: the service holds a connection to it (ItagLink).
        val filters = if (!low) emptyList() else listOf(
            ScanFilter.Builder().setManufacturerData(FindMy.APPLE, byteArrayOf(FindMy.TYPE_OFFLINE_FINDING.toByte()), byteArrayOf(-1)).build(),
            ScanFilter.Builder().setServiceUuid(ParcelUuid.fromString(FindMy.uuid128(FindMy.UUID16_FINDMY))).build(),
        )
        val settings = ScanSettings.Builder()
            .setScanMode(if (low) ScanSettings.SCAN_MODE_BALANCED else ScanSettings.SCAN_MODE_LOW_LATENCY)
            .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
            .setReportDelay(0)
            .build()
        runCatching { scanner.startScan(filters, settings, callback); scanningLow = low; radio.value = Radio.ON }
            .onFailure { VrgLog.w("tag", "scan: ${it.message}"); radio.value = Radio.FAILED }
        bump()
    }

    private fun stopScan(ctx: Context) {
        if (scanningLow == null) return
        runCatching { ctx.getSystemService(BluetoothManager::class.java)?.adapter?.bluetoothLeScanner?.stopScan(callback) }
        scanningLow = null
    }

    /** Bluetooth came back or went away: re-evaluate (the screen calls it when it comes on). */
    fun refresh(ctx: Context) { scanningLow = null; apply(ctx) }

    private fun heard(r: ScanResult) {
        val raw = r.scanRecord?.bytes ?: return
        val now = System.currentTimeMillis()
        val address = r.device?.address ?: return
        val before = book.mine?.address
        book.heard(address, raw, r.rssi, now) ?: return
        val ctx = appCtx
        if (address == before) {
            calibrating?.add(r.rssi)
            if (ctx != null && now - lastPlace > 60_000) { lastPlace = now; rememberPlace(ctx) }
            if (ctx != null && now - lastSave > 30_000) saveMine(ctx)
        }
        if (now - lastRelinkCheck > 2_000) {
            lastRelinkCheck = now
            if (book.relink(now)) {
                VrgLog.i("tag", "relink ${book.lastRelink?.first} -> ${book.lastRelink?.second}")
                ctx?.let { saveMine(it) }
            }
        }
        bump()
    }

    // ---- the iTag: a held connection, ringing over it, Telefonkereső --------------------------------------------

    /** Keeps the link to an iTag that is mine while Ottfelejtés runs; closes it otherwise. Cheap, called often. */
    fun syncLink(ctx: Context) {
        val m = book.mine
        val want = wantWatch && m != null && m.type == TagType.ITAG && allowed(ctx)
        if (want && link?.address == m!!.address) return
        link?.close(); link = null
        if (linkUp.value) { linkUp.value = false; bump() }
        if (!want) return
        val address = m!!.address
        val app = ctx.applicationContext
        link = ItagLink(app, address,
            onHeard = { rssi, pct ->
                val now = System.currentTimeMillis()
                book.heardLinked(address, rssi, now, pct)
                if (now - lastPlace > 60_000) { lastPlace = now; rememberPlace(app) }
                if (pct != null || now - lastSave > 30_000) saveMine(app)
                bump()
            },
            onPress = { pressed(app) },
            onState = { up -> linkUp.value = up; bump() },
        ).also { it.open() }
    }

    /** Ring mine over the held link; false = no link, ring it with a fresh connection (TagGatt). */
    fun ringOverLink(address: String, on: Boolean): Boolean = link?.takeIf { it.address == address }?.ring(on) == true

    fun linkedTo(address: String): Boolean = linkUp.value && link?.address == address

    private fun pressed(ctx: Context) {
        when (finder.press(System.currentTimeMillis())) {
            PhoneFinder.Action.RING -> ringPhone(ctx)
            PhoneFinder.Action.STOP -> stopPhone(ctx)
            null -> {}
        }
        bump()
    }

    /** Telefonkereső: the alarm sound (it plays on silent too), vibration, and a notification with Megvan. */
    private fun ringPhone(ctx: Context) {
        VrgLog.i("tag", "find phone")
        val uri = RingtoneManager.getActualDefaultRingtoneUri(ctx, RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getActualDefaultRingtoneUri(ctx, RingtoneManager.TYPE_RINGTONE)
        ringtone?.stop()
        ringtone = uri?.let { RingtoneManager.getRingtone(ctx, it) }?.apply {
            audioAttributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build()
            isLooping = true
            runCatching { play() }
        }
        vibrator(ctx)?.let { v -> runCatching { v.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 600, 400), 0)) } }
        val stop = android.app.PendingIntent.getService(ctx, 3,
            android.content.Intent(ctx, TagService::class.java).setAction(TagService.ACTION_FOUND), android.app.PendingIntent.FLAG_IMMUTABLE)
        val n = NotificationCompat.Builder(ctx, TagService.CH_ALERT)
            .setSmallIcon(hu.vrg.mobile.kit.R.drawable.ic_vrg_notify)
            .setContentTitle("Itt a telefon")
            .setContentText("A(z) ${book.mine?.name ?: "címke"} gombját megnyomták. A címke gombja vagy a Megvan leállítja.")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setContentIntent(TagService.openIntent(ctx))
            .setOngoing(true)
            .addAction(0, "Megvan", stop)
            .build()
        try { NotificationManagerCompat.from(ctx).notify(ID_FIND, n) } catch (e: SecurityException) { VrgLog.w("tag", "notify: ${e.message}") }
    }

    /** Megvan: stops the phone's ring (from the screen, the notification, the tag's button or the time-out). */
    fun stopPhone(ctx: Context) {
        finder.stop()
        runCatching { ringtone?.stop() }; ringtone = null
        vibrator(ctx)?.let { runCatching { it.cancel() } }
        NotificationManagerCompat.from(ctx).cancel(ID_FIND)
        bump()
    }

    private fun vibrator(ctx: Context): Vibrator? =
        if (Build.VERSION.SDK_INT >= 31) ctx.getSystemService(VibratorManager::class.java)?.defaultVibrator else oldVibrator(ctx)

    @Suppress("DEPRECATION")
    private fun oldVibrator(ctx: Context): Vibrator? = ctx.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator

    private const val ID_FIND = 47322

    /** The phone's last known place, stored on mine: no GPS fix is started, so it costs nothing. */
    private fun rememberPlace(ctx: Context) {
        if (!placeAllowed(ctx)) return
        val lm = ctx.getSystemService(LocationManager::class.java) ?: return
        val best = runCatching {
            lm.getProviders(true).mapNotNull { lm.getLastKnownLocation(it) }.maxByOrNull { it.time }
        }.getOrNull() ?: return
        if (System.currentTimeMillis() - best.time > 10 * 60_000L) return     // too old to say "here"
        book.update { it.copy(lastLat = best.latitude, lastLon = best.longitude, lastAccM = if (best.hasAccuracy()) best.accuracy else null) }
    }
}
