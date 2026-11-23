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
import hu.vrg.mobile.tag.RingResult
import hu.vrg.mobile.tag.SoundProtocol
import java.util.UUID

// Csipogtatás: connect to the tag (LE, no bonding, no pairing dialog), find which sound protocol it offers, subscribe
// to its answers, write Sound_Start, and Sound_Stop after [PLAY_MS] or when the user taps Állj. One ring at a time.
// Every step is logged (Beállítások → Napló, tag "tag") so the phone check can say which protocol the ISYTag took.

@SuppressLint("MissingPermission")    // the screen rings only after Tags.allowed()
class TagGatt(private val ctx: Context, private val onResult: (RingResult, SoundProtocol?) -> Unit) {
    private val main = Handler(Looper.getMainLooper())
    private var gatt: BluetoothGatt? = null
    private var order: List<SoundProtocol> = SoundProtocol.DEFAULT
    private var chosen: SoundProtocol? = null
    private var char: BluetoothGattCharacteristic? = null
    private var lastWrite: ByteArray? = null
    private var started = false
    private var finished = false

    val busy: Boolean get() = gatt != null

    fun ring(address: String, order: List<SoundProtocol>) {
        if (busy) return
        val adapter = ctx.getSystemService(BluetoothManager::class.java)?.adapter ?: return done(RingResult.NO_CONNECTION)
        val device = runCatching { adapter.getRemoteDevice(address) }.getOrNull() ?: return done(RingResult.NO_CONNECTION)
        this.order = order; chosen = null; char = null; started = false; finished = false
        VrgLog.i("tag", "ring $address, order ${order.joinToString { it.name }}")
        gatt = runCatching { device.connectGatt(ctx, false, callback, BluetoothDevice.TRANSPORT_LE) }.getOrNull()
            ?: return done(RingResult.NO_CONNECTION)
        main.postDelayed(timeout, CONNECT_MS)
    }

    /** Állj: Sound_Stop if the protocol has one, then hang up. */
    fun stop() {
        main.removeCallbacks(autoStop)
        val g = gatt ?: return
        val stopBytes = chosen?.stop
        val c = char
        if (started && stopBytes != null && c != null) write(g, c, stopBytes) else finish(g, RingResult.DONE)
    }

    private val timeout = Runnable { gatt?.let { finish(it, if (started) RingResult.DONE else RingResult.TIMEOUT) } }
    private val autoStop = Runnable { stop() }

    private val callback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
            main.post { connectionChanged(g, status, newState) }
        }

        override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
            main.post { discovered(g) }
        }

        override fun onDescriptorWrite(g: BluetoothGatt, d: BluetoothGattDescriptor, status: Int) {
            main.post {
                VrgLog.i("tag", "cccd status $status")
                val p = chosen
                val c = char
                if (p != null && c != null && !started) write(g, c, p.start)
            }
        }

        override fun onCharacteristicWrite(g: BluetoothGatt, c: BluetoothGattCharacteristic, status: Int) {
            main.post { written(g, status) }
        }

        @Deprecated("API < 33")
        @Suppress("DEPRECATION")
        override fun onCharacteristicChanged(g: BluetoothGatt, c: BluetoothGattCharacteristic) {
            VrgLog.i("tag", "answer ${hex(c.value)}")
        }

        override fun onCharacteristicChanged(g: BluetoothGatt, c: BluetoothGattCharacteristic, value: ByteArray) {
            VrgLog.i("tag", "answer ${hex(value)}")
        }
    }

    private fun connectionChanged(g: BluetoothGatt, status: Int, newState: Int) {
        VrgLog.i("tag", "gatt state $newState status $status")
        when {
            newState == BluetoothProfile.STATE_CONNECTED && status == BluetoothGatt.GATT_SUCCESS -> {
                if (!g.discoverServices()) finish(g, RingResult.NO_CONNECTION)
            }
            // an AirTag hangs up when it has played (status 19): that is success, not an error
            newState == BluetoothProfile.STATE_DISCONNECTED -> finish(g, when {
                started -> RingResult.DONE
                chosen != null -> RingResult.REFUSED
                else -> RingResult.NO_CONNECTION
            })
            else -> finish(g, RingResult.NO_CONNECTION)
        }
    }

    private fun discovered(g: BluetoothGatt) {
        val uuids = g.services.map { it.uuid.toString() }
        VrgLog.i("tag", "services: ${uuids.joinToString()}")
        val p = SoundProtocol.pick(order, uuids)
        if (p == null) { finish(g, RingResult.NO_SERVICE); return }
        val service = g.services.firstOrNull { p.matchesService(it.uuid.toString()) }
        val c = service?.getCharacteristic(UUID.fromString(p.characteristic))
        if (c == null) { finish(g, RingResult.NO_SERVICE); return }
        chosen = p
        char = c
        VrgLog.i("tag", "protocol ${p.name}")
        val cccd = c.getDescriptor(CCCD)
        if (p.notify && cccd != null) {
            g.setCharacteristicNotification(c, true)
            val v = if ((c.properties and BluetoothGattCharacteristic.PROPERTY_INDICATE) != 0)
                BluetoothGattDescriptor.ENABLE_INDICATION_VALUE else BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
            if (!writeDescriptor(g, cccd, v)) write(g, c, p.start)
        } else write(g, c, p.start)
    }

    private fun written(g: BluetoothGatt, status: Int) {
        val p = chosen
        VrgLog.i("tag", "write ${hex(lastWrite)} status $status")
        if (status != BluetoothGatt.GATT_SUCCESS) { finish(g, RingResult.REFUSED); return }
        if (p == null) return
        val stopBytes = p.stop
        if (lastWrite.contentEquals(p.start)) {
            started = true
            main.removeCallbacks(timeout)
            onResult(RingResult.STARTED, p)
            if (stopBytes != null) main.postDelayed(autoStop, PLAY_MS) else main.postDelayed(timeout, PLAY_MS + 5_000)
        } else if (stopBytes != null && lastWrite.contentEquals(stopBytes)) {
            finish(g, RingResult.DONE)
        }
    }

    private fun write(g: BluetoothGatt, c: BluetoothGattCharacteristic, value: ByteArray) {
        lastWrite = value
        val ok = if (Build.VERSION.SDK_INT >= 33) {
            g.writeCharacteristic(c, value, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT) == BluetoothStatusCodes.SUCCESS
        } else legacyWrite(g, c, value)
        if (!ok) finish(g, RingResult.REFUSED)
    }

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

    private fun finish(g: BluetoothGatt, r: RingResult) {
        if (finished) return
        finished = true
        main.removeCallbacks(timeout); main.removeCallbacks(autoStop)
        runCatching { g.disconnect() }; runCatching { g.close() }
        if (gatt === g) gatt = null
        VrgLog.i("tag", "ring end: ${r.name}")
        onResult(r, chosen)
    }

    private fun done(r: RingResult) { onResult(r, null) }

    private fun hex(b: ByteArray?) = b?.joinToString(" ") { "%02X".format(it.toInt() and 0xFF) } ?: "—"

    companion object {
        private val CCCD: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
        const val CONNECT_MS = 15_000L
        const val PLAY_MS = 10_000L
    }
}
