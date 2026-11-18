package hu.vrg.mobile.pager.app

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertisingSet
import android.bluetooth.le.AdvertisingSetCallback
import android.bluetooth.le.AdvertisingSetParameters
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.pager.COMPANY_ID

// The air. One legacy advertising set (connectable, so the L2CAP link can be dialled; scannable, so the name
// rides in the scan response) whose data is swapped in place whenever the engine's beacon changes, and one
// filtered scanner that hands every crew advertisement to the engine. Android throttles scan *starts* (five in
// 30 s), so the scanner is started once and only restarted when the screen turns on or off (duty change).

@SuppressLint("MissingPermission")    // the service starts the radio only after Pager.radioAllowed()
class BleRadio(private val ctx: Context, private val onAdvert: (raw: ByteArray, rssi: Int, device: BluetoothDevice) -> Unit) {
    private val adapter: BluetoothAdapter? = ctx.getSystemService(BluetoothManager::class.java)?.adapter
    private var set: AdvertisingSet? = null
    private var lastData: ByteArray? = null
    private var lastName: ByteArray? = null
    private var pendingData: ByteArray? = null
    private var pendingName: ByteArray? = null
    private var scanning = false
    private var lowPower = false

    val enabled: Boolean get() = adapter?.isEnabled == true

    private val advCallback = object : AdvertisingSetCallback() {
        override fun onAdvertisingSetStarted(s: AdvertisingSet?, txPower: Int, status: Int) {
            if (status != ADVERTISE_SUCCESS || s == null) {
                VrgLog.w("pager", "advertising failed: $status")
                Pager.radioDetail = "hirdetés hiba $status"
                Pager.setRadio(if (status == ADVERTISE_FAILED_FEATURE_UNSUPPORTED) Pager.Radio.UNSUPPORTED else Pager.Radio.FAILED)
                return
            }
            set = s
            Pager.setRadio(Pager.Radio.ON)
            pendingData?.let { update(it, pendingName ?: ByteArray(0)) }
        }

        override fun onAdvertisingSetStopped(s: AdvertisingSet?) { if (s === set) set = null }
    }

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) { deliver(result) }
        override fun onBatchScanResults(results: MutableList<ScanResult>) { results.forEach { deliver(it) } }
        override fun onScanFailed(errorCode: Int) {
            VrgLog.w("pager", "scan failed: $errorCode")
            scanning = false
            Pager.radioDetail = "keresés hiba $errorCode"
            Pager.setRadio(Pager.Radio.FAILED)
        }
    }

    private fun deliver(r: ScanResult) {
        val raw = r.scanRecord?.bytes ?: return
        onAdvert(raw, r.rssi, r.device)
    }

    private fun data(payload: ByteArray) = AdvertiseData.Builder().setIncludeDeviceName(false).setIncludeTxPowerLevel(false)
        .addManufacturerData(COMPANY_ID, payload).build()

    fun start(beacon: ByteArray, name: ByteArray): Boolean {
        val a = adapter ?: run { Pager.setRadio(Pager.Radio.UNSUPPORTED); return false }
        if (!a.isEnabled) { Pager.setRadio(Pager.Radio.NO_BT); return false }
        val adv = a.bluetoothLeAdvertiser ?: run { Pager.setRadio(Pager.Radio.UNSUPPORTED); return false }
        Pager.setRadio(Pager.Radio.STARTING)
        pendingData = beacon; pendingName = name
        if (set == null) {
            val params = AdvertisingSetParameters.Builder()
                .setLegacyMode(true).setConnectable(true).setScannable(true)
                .setInterval(AdvertisingSetParameters.INTERVAL_LOW)
                .setTxPowerLevel(AdvertisingSetParameters.TX_POWER_HIGH)
                .build()
            runCatching { adv.startAdvertisingSet(params, data(beacon), data(name), null, null, advCallback) }
                .onFailure { VrgLog.w("pager", "advertise: ${it.message}"); Pager.setRadio(Pager.Radio.FAILED); return false }
            lastData = beacon; lastName = name
        }
        startScan(lowPower)
        return true
    }

    /** Swap the advertisement in place; a no-op when nothing changed. */
    fun update(beacon: ByteArray, name: ByteArray) {
        pendingData = beacon; pendingName = name
        val s = set ?: return
        if (!beacon.contentEquals(lastData)) { lastData = beacon; runCatching { s.setAdvertisingData(data(beacon)) } }
        if (!name.contentEquals(lastName)) { lastName = name; runCatching { s.setScanResponseData(data(name)) } }
    }

    /** Screen off: balanced scanning saves battery; a page still arrives within a second or two. */
    fun setLowPower(on: Boolean) {
        if (on == lowPower) return
        lowPower = on
        if (scanning) { stopScan(); startScan(on) }
    }

    private fun startScan(low: Boolean) {
        if (scanning) return
        val sc = adapter?.bluetoothLeScanner ?: return
        // both crew records start with 'V' ('VP' beacon, 'VN' name): Android keeps only one entry per company id
        // in its parsed record, so the filter matches the shared first byte and the engine parses the raw bytes
        val filter = ScanFilter.Builder().setManufacturerData(COMPANY_ID, byteArrayOf(0x56), byteArrayOf(-1)).build()
        val settings = ScanSettings.Builder()
            .setScanMode(if (low) ScanSettings.SCAN_MODE_BALANCED else ScanSettings.SCAN_MODE_LOW_LATENCY)
            .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
            .setReportDelay(0)
            .build()
        runCatching { sc.startScan(listOf(filter), settings, scanCallback); scanning = true }
            .onFailure { VrgLog.w("pager", "scan: ${it.message}") }
    }

    private fun stopScan() {
        runCatching { adapter?.bluetoothLeScanner?.stopScan(scanCallback) }
        scanning = false
    }

    fun stop() {
        stopScan()
        runCatching { adapter?.bluetoothLeAdvertiser?.stopAdvertisingSet(advCallback) }
        set = null; lastData = null; lastName = null
        Pager.setRadio(Pager.Radio.OFF)
    }

    val bluetoothAdapter: BluetoothAdapter? get() = adapter
}
