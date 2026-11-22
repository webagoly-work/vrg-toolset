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
import android.os.Build
import android.os.ParcelUuid
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.tag.FindMy
import hu.vrg.mobile.tag.LeftBehind
import hu.vrg.mobile.tag.Mine
import hu.vrg.mobile.tag.TagBook
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
        val want = wantScreen || wantWatch
        val low = !wantScreen
        if (!want) { stopScan(ctx); radio.value = Radio.OFF; bump(); return }
        if (!allowed(ctx)) { stopScan(ctx); radio.value = Radio.NO_PERMISSION; bump(); return }
        val adapter = ctx.getSystemService(BluetoothManager::class.java)?.adapter
        if (adapter == null || !adapter.isEnabled) { stopScan(ctx); radio.value = Radio.NO_BT; bump(); return }
        if (scanningLow == low) return
        stopScan(ctx)
        val scanner = adapter.bluetoothLeScanner ?: run { radio.value = Radio.NO_BT; return }
        // Two filters: Apple's offline-finding record (company 0x004C, first byte 0x12) and the Find My service
        // (an unpaired tag). Filtered scans keep running with the screen off; an unfiltered one would not.
        val filters = listOf(
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
