package hu.vrg.mobile.tag.app

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.BluetoothStatusCodes
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.tag.FindMy
import hu.vrg.mobile.tag.Itag
import java.util.UUID

// The held connection to an iTag (WP M61): while Ottfelejtés runs, the phone stays connected. Android reconnects by
// itself when the tag comes back (autoConnect). Connected, the link
//  - subscribes to the button (0xFFE0 / 0xFFE1) → [onPress] (Telefonkereső),
//  - reads the battery once (0x180F / 0x2A19) and the RSSI every 2 s → [onHeard] (the tag stops advertising while
//    connected, so this is how it stays "heard"),
//  - rings the tag on request (Immediate Alert 0x1802 / 0x2A06: 01 on, 00 off).
// Losing the link makes the iTag slow-beep by itself (its own anti-lost alarm); its button mutes it.
// GATT allows one operation at a time, so writes and reads go through a small queue.

@SuppressLint("MissingPermission")    // opened only after Tags.allowed()
class ItagLink(
    private val ctx: Context,
    val address: String,
    private val onHeard: (rssi: Int?, batteryPct: Int?) -> Unit,
    private val onPress: () -> Unit,
    private val onState: (connected: Boolean) -> Unit,
) {
    private val main = Handler(Looper.getMainLooper())
    private var gatt: BluetoothGatt? = null
    private var alert: BluetoothGattCharacteristic? = null
    private val queue = ArrayDeque<(BluetoothGatt) -> Boolean>()
    private var busy = false
    private var closed = false

    @Volatile var connected = false
        private set

    fun open() {
        val adapter = ctx.getSystemService(BluetoothManager::class.java)?.adapter ?: return
        val device = runCatching { adapter.getRemoteDevice(address) }.getOrNull() ?: return
        VrgLog.i("tag", "itag link open $address")
        gatt = runCatching { device.connectGatt(ctx, true, callback, BluetoothDevice.TRANSPORT_LE) }.getOrNull()
    }

    /** Closing on purpose. The tag may still slow-beep (it cannot tell a goodbye from a lost signal); its button mutes it. */
    fun close() {
        closed = true
        main.removeCallbacks(poll)
        runCatching { gatt?.disconnect() }; runCatching { gatt?.close() }
        gatt = null; alert = null; connected = false; queue.clear(); busy = false
    }

    /** Ring the tag (true) or stop it (false). False = not connected, ring it the other way. */
    fun ring(on: Boolean): Boolean {
        val c = alert ?: return false
        if (!connected) return false
        enqueue { g -> write(g, c, if (on) Itag.ALERT_ON else Itag.ALERT_OFF) }
        return true
    }

    private val poll = object : Runnable {
        override fun run() {
            if (closed || !connected) return
            enqueue { g -> g.readRemoteRssi() }
            main.postDelayed(this, 2_000)
        }
    }

    private val callback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
            main.post {
                if (closed) return@post
                VrgLog.i("tag", "itag state $newState status $status")
                if (newState == BluetoothProfile.STATE_CONNECTED) {
                    g.discoverServices()
                } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                    // autoConnect keeps trying in the background; only the state changes here
                    val was = connected
                    connected = false; alert = null; queue.clear(); busy = false
                    main.removeCallbacks(poll)
                    if (was) onState(false)
                }
            }
        }

        override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
            main.post { if (!closed) ready(g) }
        }

        override fun onDescriptorWrite(g: BluetoothGatt, d: BluetoothGattDescriptor, status: Int) {
            main.post { next() }
        }

        override fun onCharacteristicWrite(g: BluetoothGatt, c: BluetoothGattCharacteristic, status: Int) {
            main.post { next() }
        }

        @Deprecated("API < 33")
        @Suppress("DEPRECATION")
        override fun onCharacteristicRead(g: BluetoothGatt, c: BluetoothGattCharacteristic, status: Int) {
            val v = c.value
            main.post { read(c, v); next() }
        }

        override fun onCharacteristicRead(g: BluetoothGatt, c: BluetoothGattCharacteristic, value: ByteArray, status: Int) {
            main.post { read(c, value); next() }
        }

        @Deprecated("API < 33")
        @Suppress("DEPRECATION")
        override fun onCharacteristicChanged(g: BluetoothGatt, c: BluetoothGattCharacteristic) {
            val v = c.value
            main.post { changed(c, v) }
        }

        override fun onCharacteristicChanged(g: BluetoothGatt, c: BluetoothGattCharacteristic, value: ByteArray) {
            main.post { changed(c, value) }
        }

        override fun onReadRemoteRssi(g: BluetoothGatt, rssi: Int, status: Int) {
            main.post {
                if (status == BluetoothGatt.GATT_SUCCESS) onHeard(rssi, null)
                next()
            }
        }
    }

    private fun ready(g: BluetoothGatt) {
        VrgLog.i("tag", "itag services: ${g.services.joinToString { it.uuid.toString().substring(4, 8) }}")
        alert = g.getService(uuid(Itag.UUID16_ALERT))?.getCharacteristic(uuid(Itag.CHAR_ALERT))
        connected = true
        onState(true)
        onHeard(null, null)
        g.getService(uuid(Itag.UUID16_BUTTON))?.getCharacteristic(uuid(Itag.CHAR_BUTTON))?.let { b ->
            g.setCharacteristicNotification(b, true)
            b.getDescriptor(CCCD)?.let { d -> enqueue { gg -> writeDescriptor(gg, d, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE) } }
        } ?: VrgLog.w("tag", "itag: no button service (0xFFE0)")
        g.getService(uuid(Itag.UUID16_BATTERY))?.getCharacteristic(uuid(Itag.CHAR_BATTERY))?.let { c ->
            enqueue { gg -> gg.readCharacteristic(c) }
        }
        main.removeCallbacks(poll)
        main.postDelayed(poll, 2_000)
    }

    private fun read(c: BluetoothGattCharacteristic, value: ByteArray?) {
        if (c.uuid == uuid(Itag.CHAR_BATTERY)) Itag.battery(value)?.let { onHeard(null, it) }
    }

    private fun changed(c: BluetoothGattCharacteristic, value: ByteArray?) {
        if (c.uuid == uuid(Itag.CHAR_BUTTON) && Itag.isPress(value)) {
            VrgLog.i("tag", "itag button")
            onPress()
        }
    }

    // ---- one GATT operation at a time ----------------------------------------------------------------------

    private fun enqueue(op: (BluetoothGatt) -> Boolean) {
        queue.addLast(op)
        if (!busy) next()
    }

    private fun next() {
        busy = false
        val g = gatt ?: return
        while (queue.isNotEmpty()) {
            val op = queue.removeFirst()
            if (runCatching { op(g) }.getOrDefault(false)) { busy = true; return }
        }
    }

    private fun write(g: BluetoothGatt, c: BluetoothGattCharacteristic, value: ByteArray): Boolean =
        if (Build.VERSION.SDK_INT >= 33) {
            g.writeCharacteristic(c, value, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT) == BluetoothStatusCodes.SUCCESS
        } else legacyWrite(g, c, value)

    @Suppress("DEPRECATION")
    private fun legacyWrite(g: BluetoothGatt, c: BluetoothGattCharacteristic, value: ByteArray): Boolean {
        c.value = value
        c.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
        return g.writeCharacteristic(c)
    }

    private fun writeDescriptor(g: BluetoothGatt, d: BluetoothGattDescriptor, value: ByteArray): Boolean =
        if (Build.VERSION.SDK_INT >= 33) g.writeDescriptor(d, value) == BluetoothStatusCodes.SUCCESS else legacyDescriptor(g, d, value)

    @Suppress("DEPRECATION")
    private fun legacyDescriptor(g: BluetoothGatt, d: BluetoothGattDescriptor, value: ByteArray): Boolean {
        d.value = value
        return g.writeDescriptor(d)
    }

    companion object {
        private val CCCD: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
        fun uuid(u16: Int): UUID = UUID.fromString(FindMy.uuid128(u16))
    }
}
