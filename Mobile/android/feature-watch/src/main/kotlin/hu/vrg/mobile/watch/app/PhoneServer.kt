package hu.vrg.mobile.watch.app

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattServerCallback
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothStatusCodes
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import hu.vrg.mobile.kit.VrgLog
import java.util.Calendar
import java.util.TimeZone
import java.util.UUID

// The phone's own GATT server (WP M65 Q3). The Q71 is also a GATT client of the phone: over the link the phone opened,
// it discovers the phone's services, writes the phone's 1802 Immediate Alert for "find phone" (02 start, 00 stop) and
// subscribes to 1805 Current Time. FunDo's server has more (FCC0, FDAA, 1811 …); the watch was only seen using these.

@SuppressLint("MissingPermission")
class PhoneServer(private val ctx: Context, private val onAlert: (Boolean) -> Unit) {
    private val main = Handler(Looper.getMainLooper())
    private var server: BluetoothGattServer? = null
    private val pending = ArrayDeque<BluetoothGattService>()
    private val subscribed = mutableSetOf<String>()
    private var time: BluetoothGattCharacteristic? = null

    companion object {
        val CURRENT_TIME_SVC: UUID = WatchLink.uuid16(0x1805)
        val CURRENT_TIME: UUID = WatchLink.uuid16(0x2A2B)
        val LOCAL_TIME_INFO: UUID = WatchLink.uuid16(0x2A0F)

        /** Current Time (2A2B): year LE, month, day, h, m, s, weekday (1 = Monday), 1/256 s, adjust reason. */
        fun currentTime(ms: Long, tz: TimeZone = TimeZone.getDefault()): ByteArray {
            val c = Calendar.getInstance(tz).apply { timeInMillis = ms }
            val y = c.get(Calendar.YEAR)
            val wd = ((c.get(Calendar.DAY_OF_WEEK) + 5) % 7) + 1
            return byteArrayOf(y.toByte(), (y shr 8).toByte(), (c.get(Calendar.MONTH) + 1).toByte(), c.get(Calendar.DAY_OF_MONTH).toByte(),
                c.get(Calendar.HOUR_OF_DAY).toByte(), c.get(Calendar.MINUTE).toByte(), c.get(Calendar.SECOND).toByte(), wd.toByte(),
                (c.get(Calendar.MILLISECOND) * 256 / 1000).toByte(), 1)
        }

        /** Local Time Information (2A0F): the zone in 15-minute steps, DST 0 / 4 (= +1 h). */
        fun localTimeInfo(ms: Long, tz: TimeZone = TimeZone.getDefault()): ByteArray =
            byteArrayOf((tz.rawOffset / 900_000).toByte(), (if (tz.inDaylightTime(java.util.Date(ms))) 4 else 0).toByte())
    }

    fun open(): Boolean {
        if (server != null) return true
        val bm = ctx.getSystemService(BluetoothManager::class.java) ?: return false
        val s = runCatching { bm.openGattServer(ctx, callback) }.getOrNull() ?: return false
        server = s
        val alert = BluetoothGattService(WatchLink.IMMEDIATE_ALERT, BluetoothGattService.SERVICE_TYPE_PRIMARY).apply {
            addCharacteristic(BluetoothGattCharacteristic(WatchLink.ALERT_LEVEL,
                BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE or BluetoothGattCharacteristic.PROPERTY_WRITE,
                BluetoothGattCharacteristic.PERMISSION_WRITE))
        }
        val t = BluetoothGattCharacteristic(CURRENT_TIME,
            BluetoothGattCharacteristic.PROPERTY_READ or BluetoothGattCharacteristic.PROPERTY_NOTIFY,
            BluetoothGattCharacteristic.PERMISSION_READ).apply {
            addDescriptor(BluetoothGattDescriptor(WatchLink.CCCD,
                BluetoothGattDescriptor.PERMISSION_READ or BluetoothGattDescriptor.PERMISSION_WRITE))
        }
        time = t
        val clock = BluetoothGattService(CURRENT_TIME_SVC, BluetoothGattService.SERVICE_TYPE_PRIMARY).apply {
            addCharacteristic(t)
            addCharacteristic(BluetoothGattCharacteristic(LOCAL_TIME_INFO, BluetoothGattCharacteristic.PROPERTY_READ,
                BluetoothGattCharacteristic.PERMISSION_READ))
        }
        pending.clear(); pending.addLast(alert); pending.addLast(clock)
        addNext()
        return true
    }

    private fun addNext() {
        val svc = pending.removeFirstOrNull() ?: run { Watch.serverUp.value = true; VrgLog.i(Watch.LOG, "phone server up (1802, 1805)"); return }
        if (server?.addService(svc) != true) VrgLog.w(Watch.LOG, "addService ${svc.uuid} refused")
    }

    fun close() {
        runCatching { server?.close() }
        server = null; subscribed.clear(); pending.clear()
        Watch.serverUp.value = false
    }

    /** After a time sync: tell a subscribed watch the new time over 1805 too. */
    fun notifyTime() {
        val s = server ?: return; val c = time ?: return
        val bm = ctx.getSystemService(BluetoothManager::class.java) ?: return
        val v = currentTime(System.currentTimeMillis())
        bm.getConnectedDevices(android.bluetooth.BluetoothProfile.GATT_SERVER).filter { it.address in subscribed }.forEach { d ->
            if (Build.VERSION.SDK_INT >= 33) s.notifyCharacteristicChanged(d, c, false, v) else legacyNotify(s, d, c, v)
        }
    }

    @Suppress("DEPRECATION")
    private fun legacyNotify(s: BluetoothGattServer, d: BluetoothDevice, c: BluetoothGattCharacteristic, v: ByteArray) {
        c.value = v; s.notifyCharacteristicChanged(d, c, false)
    }

    private val callback = object : BluetoothGattServerCallback() {
        override fun onServiceAdded(status: Int, service: BluetoothGattService) { main.post { addNext() } }

        override fun onCharacteristicReadRequest(d: BluetoothDevice, id: Int, offset: Int, c: BluetoothGattCharacteristic) {
            val now = System.currentTimeMillis()
            val v = when (c.uuid) {
                CURRENT_TIME -> currentTime(now)
                LOCAL_TIME_INFO -> localTimeInfo(now)
                else -> null
            }
            val s = server ?: return
            if (v == null) s.sendResponse(d, id, android.bluetooth.BluetoothGatt.GATT_READ_NOT_PERMITTED, 0, null)
            else s.sendResponse(d, id, android.bluetooth.BluetoothGatt.GATT_SUCCESS, offset, if (offset < v.size) v.copyOfRange(offset, v.size) else ByteArray(0))
        }

        override fun onCharacteristicWriteRequest(d: BluetoothDevice, id: Int, c: BluetoothGattCharacteristic, prepared: Boolean,
                                                  needsResponse: Boolean, offset: Int, value: ByteArray?) {
            if (needsResponse) server?.sendResponse(d, id, android.bluetooth.BluetoothGatt.GATT_SUCCESS, 0, null)
            if (c.uuid == WatchLink.ALERT_LEVEL) {
                val level = value?.firstOrNull()?.toInt() ?: 0
                VrgLog.i(Watch.LOG, "find phone from ${d.address}: level $level")
                main.post { onAlert(level != 0) }
            }
        }

        override fun onDescriptorWriteRequest(d: BluetoothDevice, id: Int, desc: BluetoothGattDescriptor, prepared: Boolean,
                                              needsResponse: Boolean, offset: Int, value: ByteArray?) {
            if (desc.uuid == WatchLink.CCCD && desc.characteristic.uuid == CURRENT_TIME) {
                val on = value != null && value.isNotEmpty() && value[0].toInt() != 0
                main.post { if (on) subscribed += d.address else subscribed -= d.address }
                VrgLog.i(Watch.LOG, "1805 time ${if (on) "subscribed" else "unsubscribed"} by ${d.address}")
            }
            if (needsResponse) server?.sendResponse(d, id, android.bluetooth.BluetoothGatt.GATT_SUCCESS, 0, null)
        }

        override fun onDescriptorReadRequest(d: BluetoothDevice, id: Int, offset: Int, desc: BluetoothGattDescriptor) {
            val v = if (d.address in subscribed) BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE else BluetoothGattDescriptor.DISABLE_NOTIFICATION_VALUE
            server?.sendResponse(d, id, android.bluetooth.BluetoothGatt.GATT_SUCCESS, 0, v)
        }
    }
}

/** Telefonkeresés: the alarm sound (it plays on silent too), vibration and a notification with Megvan; 60 s at most. */
object PhoneRing {
    private const val ID = 47331
    private const val MAX_MS = 60_000L
    private var ringtone: Ringtone? = null
    private val main = Handler(Looper.getMainLooper())
    private val autoStop = Runnable { appCtx?.let { stop(it) } }
    private var appCtx: Context? = null

    fun ring(ctx: Context) {
        appCtx = ctx.applicationContext
        if (Watch.phoneRinging.value) return
        Watch.phoneRinging.value = true
        VrgLog.i(Watch.LOG, "ring the phone")
        val uri = RingtoneManager.getActualDefaultRingtoneUri(ctx, RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getActualDefaultRingtoneUri(ctx, RingtoneManager.TYPE_RINGTONE)
        ringtone = uri?.let { RingtoneManager.getRingtone(ctx, it) }?.apply {
            audioAttributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build()
            if (Build.VERSION.SDK_INT >= 28) isLooping = true
            runCatching { play() }
        }
        vibrator(ctx)?.let { runCatching { it.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 600, 400), 0)) } }
        val stop = PendingIntent.getService(ctx, 2, Intent(ctx, WatchService::class.java).setAction(WatchService.ACTION_FOUND),
            PendingIntent.FLAG_IMMUTABLE)
        val n = NotificationCompat.Builder(ctx, WatchService.CH_ALERT)
            .setSmallIcon(hu.vrg.mobile.kit.R.drawable.ic_vrg_notify)
            .setContentTitle("Itt a telefon")
            .setContentText("Az óráról keresték. A Megvan vagy az óra leállítja.")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setContentIntent(WatchService.openIntent(ctx))
            .setOngoing(true)
            .addAction(0, "Megvan", stop)
            .build()
        try { NotificationManagerCompat.from(ctx).notify(ID, n) } catch (e: SecurityException) { VrgLog.w(Watch.LOG, "notify: ${e.message}") }
        main.removeCallbacks(autoStop); main.postDelayed(autoStop, MAX_MS)
    }

    fun stop(ctx: Context) {
        main.removeCallbacks(autoStop)
        runCatching { ringtone?.stop() }; ringtone = null
        vibrator(ctx)?.let { runCatching { it.cancel() } }
        NotificationManagerCompat.from(ctx).cancel(ID)
        Watch.phoneRinging.value = false
    }

    private fun vibrator(ctx: Context): Vibrator? =
        if (Build.VERSION.SDK_INT >= 31) ctx.getSystemService(VibratorManager::class.java)?.defaultVibrator else oldVibrator(ctx)

    @Suppress("DEPRECATION")
    private fun oldVibrator(ctx: Context): Vibrator? = ctx.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
}
