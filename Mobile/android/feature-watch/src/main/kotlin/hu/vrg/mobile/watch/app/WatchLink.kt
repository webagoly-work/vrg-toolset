package hu.vrg.mobile.watch.app

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.BluetoothStatusCodes
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import hu.vrg.mobile.kct.Decoded
import hu.vrg.mobile.kct.Kct
import hu.vrg.mobile.kct.Reassembler
import hu.vrg.mobile.kct.attChunks
import hu.vrg.mobile.kit.VrgLog
import java.util.UUID

// The phone → watch link (WP M65 Q1): LE, never bonded (FunDo does not bond either; no pairing dialog), MTU 517.
// Watch service 18A0: frames are written to 2AA1 (write with response); the watch notifies 2AA0 with the ASCII doorbell
// "ios indication" and the phone then reads 2AA0 until it comes back empty. One GATT operation at a time (a queue), every
// outgoing frame through Kct.isSafe. Finding the watch: by its remembered address, else one scan for the name Q71_LE.

@SuppressLint("MissingPermission")    // the service starts only after Watch.allowed()
class WatchLink(
    private val ctx: Context,
    private val onReady: () -> Unit,
    private val onFrame: (Decoded) -> Unit,
    private val onDown: (String) -> Unit,
    /** The link is down but Android keeps a background connect open for the remembered watch (no timer needed). */
    private val onWaiting: (String) -> Unit = onDown,
) {
    companion object {
        fun uuid16(x: Int): UUID = UUID.fromString("0000%04x-0000-1000-8000-00805f9b34fb".format(x))
        val SVC = uuid16(0x18A0)
        val RX = uuid16(0x2AA0)        // watch → phone: doorbell notify + read
        val TX = uuid16(0x2AA1)        // phone → watch: frames
        val IMMEDIATE_ALERT = uuid16(0x1802)
        val ALERT_LEVEL = uuid16(0x2A06)
        val CCCD = uuid16(0x2902)
        const val MTU = 517
        const val SCAN_MS = 20_000L
        const val CONNECT_MS = 20_000L
    }

    private val main = Handler(Looper.getMainLooper())
    private var gatt: BluetoothGatt? = null
    private var rx: BluetoothGattCharacteristic? = null
    private var tx: BluetoothGattCharacteristic? = null
    private var alert: BluetoothGattCharacteristic? = null
    private var mtu = 23
    private var ready = false
    private var scanning = false
    private var background = false
    private val reasm = Reassembler()

    private sealed class Op {
        class Write(val c: BluetoothGattCharacteristic, val v: ByteArray, val type: Int) : Op()
        class Read(val c: BluetoothGattCharacteristic) : Op()
        class Desc(val d: BluetoothGattDescriptor, val v: ByteArray) : Op()
    }
    private val queue = ArrayDeque<Op>()
    private var busy: Op? = null
    private var readQueued = false

    val isReady: Boolean get() = ready
    val device: BluetoothDevice? get() = gatt?.device

    fun open(address: String?) {
        close()
        val adapter = ctx.getSystemService(BluetoothManager::class.java)?.adapter ?: return onDown("nincs Bluetooth")
        if (!adapter.isEnabled) return onDown("a Bluetooth ki van kapcsolva")
        // A watch the phone already holds an LE link to does not advertise, so a scan never hears it (seen on the
        // Xiaomi 2026-11-22: Android re-links Q71_LE by itself when Bluetooth comes on). Join that link instead.
        alreadyLinked()?.let { d ->
            VrgLog.i(Watch.LOG, "already linked by the phone: ${d.address}")
            Watch.remember(ctx, d.address)
            connect(d); return
        }
        if (address != null) { connect(leDevice(adapter, address)); return }
        // Without location permission Android hands this app's scans no results at all (BLUETOOTH_SCAN is declared
        // without neverForLocation for Tárgykereső and Csipogó; seen on the Xiaomi 2026-11-23: 0 results in 10 scans).
        if (!Watch.canScan(ctx)) return onDown(Watch.NEED_LOCATION)
        val scanner = adapter.bluetoothLeScanner ?: return onDown("nincs BLE kereső")
        Watch.link.value = Watch.Link.SEARCHING
        scanning = true
        VrgLog.i(Watch.LOG, "scan for ${Watch.NAME}")
        // No name filter: the Q71 may carry its name only in the scan response, and some phones filter on the
        // advertisement alone. The name is checked in the callback.
        runCatching {
            scanner.startScan(emptyList<ScanFilter>(),
                ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(), scanCb)
        }.onFailure { scanning = false; return onDown("a keresés nem indult: ${it.message}") }
        main.postDelayed(scanTimeout, SCAN_MS)
    }

    private val scanCb = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            main.post {
                if (!scanning) return@post
                val name = result.scanRecord?.deviceName ?: runCatching { result.device.name }.getOrNull()
                if (!isWatch(name)) return@post
                stopScan()
                VrgLog.i(Watch.LOG, "found ${result.device.address} rssi ${result.rssi}")
                Watch.remember(ctx, result.device.address)
                connect(result.device)
            }
        }
        override fun onScanFailed(errorCode: Int) { main.post { stopScan(); onDown("a keresés hibát adott ($errorCode)") } }
    }

    private fun isWatch(name: String?) = name != null && (name == Watch.NAME || name.startsWith("Q71"))

    /** The Q71 if the phone already has an LE (GATT) link to it: Android's own, or one another app left open. */
    private fun alreadyLinked(): BluetoothDevice? = runCatching {
        ctx.getSystemService(BluetoothManager::class.java)?.getConnectedDevices(BluetoothProfile.GATT)
            ?.firstOrNull { d -> isWatch(runCatching { d.name }.getOrNull()) || d.address == Watch.address(ctx) }
    }.getOrNull()

    private val scanTimeout = Runnable {
        if (scanning) { stopScan(); onDown("nem hallom a(z) ${Watch.NAME} órát (a FunDo fut? az óra Bluetooth-a be van kapcsolva? kapcsold ki és be a telefon Bluetooth-át, majd azonnal a Kapcsolatot)") }
    }

    private fun stopScan() {
        scanning = false
        main.removeCallbacks(scanTimeout)
        runCatching { ctx.getSystemService(BluetoothManager::class.java)?.adapter?.bluetoothLeScanner?.stopScan(scanCb) }
    }

    /**
     * The remembered address as an LE device of the right address type. After a phone restart Android no longer knows
     * that the Q71's CB:… is a random static address; getRemoteDevice() then takes it for a public one and the connect
     * never lands (seen 2026-11-23: every connect timed out with the watch beside the phone).
     */
    private fun leDevice(adapter: android.bluetooth.BluetoothAdapter, address: String): BluetoothDevice {
        val randomStatic = runCatching { (address.substring(0, 2).toInt(16) and 0xC0) == 0xC0 }.getOrDefault(false)
        return if (Build.VERSION.SDK_INT >= 33 && randomStatic)
            runCatching { adapter.getRemoteLeDevice(address, BluetoothDevice.ADDRESS_TYPE_RANDOM) }.getOrNull() ?: adapter.getRemoteDevice(address)
        else adapter.getRemoteDevice(address)
    }

    private fun connect(d: BluetoothDevice) {
        Watch.link.value = Watch.Link.CONNECTING
        background = false
        VrgLog.i(Watch.LOG, "connect ${d.address} (LE, no bond)")
        gatt = runCatching { d.connectGatt(ctx, false, callback, BluetoothDevice.TRANSPORT_LE) }.getOrNull()
            ?: return onDown("a kapcsolódás nem indult")
        main.postDelayed(connectTimeout, CONNECT_MS)
    }

    /**
     * Hand the remembered watch to Android's background connect (autoConnect): the Bluetooth chip links it whenever it
     * shows up, also while the phone sleeps, with no scan, no location and no timer in this app.
     */
    private fun waitInBackground(d: BluetoothDevice, why: String) {
        main.removeCallbacks(connectTimeout)
        gatt?.let { runCatching { it.disconnect() }; runCatching { it.close() } }
        ready = false; queue.clear(); busy = null; readQueued = false; reasm.reset()
        rx = null; tx = null; alert = null
        background = true
        VrgLog.i(Watch.LOG, "wait in background for ${d.address}: $why")
        gatt = runCatching { d.connectGatt(ctx, true, callback, BluetoothDevice.TRANSPORT_LE) }.getOrNull()
        if (gatt == null) { background = false; return fail("a háttér-kapcsolódás nem indult") }
        onWaiting(why)
    }

    private val connectTimeout = Runnable {
        if (ready) return@Runnable
        val d = gatt?.device
        if (d != null && Watch.address(ctx) != null) waitInBackground(d, "nem válaszolt időben") else fail("nem válaszolt időben")
    }

    fun close() {
        background = false
        stopScan()
        main.removeCallbacks(connectTimeout)
        ready = false
        queue.clear(); busy = null; readQueued = false
        reasm.reset()
        gatt?.let { runCatching { it.disconnect() }; runCatching { it.close() } }
        gatt = null; rx = null; tx = null; alert = null
    }

    private fun fail(why: String) {
        VrgLog.w(Watch.LOG, "link down: $why")
        close()
        onDown(why)
    }

    /** One frame to the watch (refused if it is not a safe command). */
    fun send(frame: ByteArray): Boolean {
        val g = gatt; val c = tx
        if (!ready || g == null || c == null) return false
        if (!Kct.isSafe(frame)) { VrgLog.w(Watch.LOG, "refused an unsafe frame"); return false }
        frame.attChunks(mtu).forEach { queue.addLast(Op.Write(c, it, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT)) }
        next()
        return true
    }

    /** The watch's own Immediate Alert (1802 / 2A06, handle 0x115 on the Q71): 02 rings, 00 stops. */
    fun alert(on: Boolean): Boolean {
        val c = alert ?: return false
        queue.addLast(Op.Write(c, byteArrayOf(if (on) 2 else 0), BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE))
        next()
        return true
    }

    private fun next() {
        if (busy != null) return
        val g = gatt ?: return
        val op = queue.removeFirstOrNull() ?: return
        busy = op
        val ok = when (op) {
            is Op.Write -> write(g, op.c, op.v, op.type)
            is Op.Read -> { readQueued = false; g.readCharacteristic(op.c) }
            is Op.Desc -> writeDescriptor(g, op.d, op.v)
        }
        if (!ok) { VrgLog.w(Watch.LOG, "gatt op refused: ${op.javaClass.simpleName}"); busy = null; main.post { next() } }
    }

    private fun done() { busy = null; next() }

    private fun queueRead() {
        val c = rx ?: return
        if (readQueued) return
        readQueued = true
        queue.addLast(Op.Read(c))
        next()
    }

    private val callback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
            main.post {
                if (g !== gatt) return@post
                if (newState == BluetoothProfile.STATE_CONNECTED) {
                    VrgLog.i(Watch.LOG, "connected, status $status")
                    if (!g.requestMtu(MTU)) g.discoverServices()
                } else {
                    val d = g.device
                    val why = "a kapcsolat megszakadt (status $status)"
                    // a dropped link to the remembered watch goes straight back to the background connect
                    if (!background && Watch.address(ctx) != null) waitInBackground(d, why) else fail(why)
                }
            }
        }

        override fun onMtuChanged(g: BluetoothGatt, m: Int, status: Int) {
            main.post {
                if (g !== gatt) return@post
                if (status == BluetoothGatt.GATT_SUCCESS) mtu = m
                VrgLog.i(Watch.LOG, "mtu $mtu")
                g.discoverServices()
            }
        }

        override fun onServicesDiscovered(g: BluetoothGatt, status: Int) { main.post { discovered(g) } }

        override fun onCharacteristicWrite(g: BluetoothGatt, c: BluetoothGattCharacteristic, status: Int) {
            main.post {
                if (status != BluetoothGatt.GATT_SUCCESS) VrgLog.w(Watch.LOG, "write status $status")
                done()
            }
        }

        override fun onDescriptorWrite(g: BluetoothGatt, d: BluetoothGattDescriptor, status: Int) { main.post { done() } }

        @Deprecated("API < 33")
        @Suppress("DEPRECATION")
        override fun onCharacteristicRead(g: BluetoothGatt, c: BluetoothGattCharacteristic, status: Int) {
            val v = c.value ?: ByteArray(0)
            main.post { read(v, status) }
        }

        override fun onCharacteristicRead(g: BluetoothGatt, c: BluetoothGattCharacteristic, value: ByteArray, status: Int) {
            main.post { read(value, status) }
        }

        @Deprecated("API < 33")
        @Suppress("DEPRECATION")
        override fun onCharacteristicChanged(g: BluetoothGatt, c: BluetoothGattCharacteristic) {
            val u = c.uuid
            main.post { changed(u) }
        }

        override fun onCharacteristicChanged(g: BluetoothGatt, c: BluetoothGattCharacteristic, value: ByteArray) {
            val u = c.uuid
            main.post { changed(u) }
        }
    }

    private fun discovered(g: BluetoothGatt) {
        if (g !== gatt) return
        val s = g.getService(SVC) ?: return fail("nincs 18A0 szolgáltatás: ez nem a Q71?")
        rx = s.getCharacteristic(RX); tx = s.getCharacteristic(TX)
        alert = g.getService(IMMEDIATE_ALERT)?.getCharacteristic(ALERT_LEVEL)
        val r = rx ?: return fail("nincs 2AA0")
        if (tx == null) return fail("nincs 2AA1")
        g.setCharacteristicNotification(r, true)     // 2AA0 has no CCCD on the Q71; this only routes its notifications here
        r.getDescriptor(CCCD)?.let { queue.addLast(Op.Desc(it, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)) }
        main.removeCallbacks(connectTimeout)
        ready = true
        VrgLog.i(Watch.LOG, "ready: 18A0 ok, 1802 ${if (alert != null) "ok" else "none"}")
        onReady()
        next()
    }

    // the doorbell ("ios indication") or anything else on 2AA0: read it empty
    private fun changed(u: UUID) { if (u == RX) queueRead() }

    private fun read(v: ByteArray, status: Int) {
        busy = null
        if (status == BluetoothGatt.GATT_SUCCESS && v.isNotEmpty()) {
            reasm.push(v).forEach { f -> runCatching { onFrame(f) }.onFailure { VrgLog.w(Watch.LOG, "frame: ${it.message}") } }
            queueRead()                              // until it comes back empty
        }
        next()
    }

    private fun write(g: BluetoothGatt, c: BluetoothGattCharacteristic, v: ByteArray, type: Int): Boolean =
        if (Build.VERSION.SDK_INT >= 33) g.writeCharacteristic(c, v, type) == BluetoothStatusCodes.SUCCESS
        else legacyWrite(g, c, v, type)       // Android calls onCharacteristicWrite for write-without-response too

    @Suppress("DEPRECATION")
    private fun legacyWrite(g: BluetoothGatt, c: BluetoothGattCharacteristic, v: ByteArray, type: Int): Boolean {
        c.value = v; c.writeType = type
        return g.writeCharacteristic(c)
    }

    private fun writeDescriptor(g: BluetoothGatt, d: BluetoothGattDescriptor, v: ByteArray): Boolean =
        if (Build.VERSION.SDK_INT >= 33) g.writeDescriptor(d, v) == BluetoothStatusCodes.SUCCESS else legacyDescriptor(g, d, v)

    @Suppress("DEPRECATION")
    private fun legacyDescriptor(g: BluetoothGatt, d: BluetoothGattDescriptor, v: ByteArray): Boolean { d.value = v; return g.writeDescriptor(d) }
}
