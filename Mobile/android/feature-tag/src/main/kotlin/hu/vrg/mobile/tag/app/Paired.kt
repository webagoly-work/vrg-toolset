package hu.vrg.mobile.tag.app

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import androidx.core.content.IntentCompat
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.tag.RingResult

// The third kind of item (WP M61, D-157): a device paired in Android's Bluetooth settings — the Founder's Q71 calling
// watch (FunDo app, protocol undocumented), or earbuds, a speaker. Only what Android offers for any paired device:
//  - [PairedLink]: is it connected now? ACL connected / disconnected broadcasts, the hands-free (HEADSET) and media
//    (A2DP) profiles and GATT, OR-ed; the paired list for choosing it;
//  - [WatchRinger]: a calling watch is a hands-free headset, so a tone routed to it over SCO plays from its speaker.

data class PairedDevice(val address: String, val name: String?, val majorClass: Int?)

@SuppressLint("MissingPermission")    // started only after Tags.allowed() (BLUETOOTH_CONNECT)
class PairedLink(private val ctx: Context) {
    private val adapter: BluetoothAdapter? = ctx.getSystemService(BluetoothManager::class.java)?.adapter
    private val acl = HashMap<String, Boolean>()
    private var headset: BluetoothProfile? = null
    private var a2dp: BluetoothProfile? = null
    private var started = false

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(c: Context, i: Intent) {
            val d = IntentCompat.getParcelableExtra(i, BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java) ?: return
            when (i.action) {
                BluetoothDevice.ACTION_ACL_CONNECTED -> acl[d.address] = true
                BluetoothDevice.ACTION_ACL_DISCONNECTED -> acl[d.address] = false
            }
            VrgLog.i("tag", "acl ${d.address} ${i.action?.substringAfterLast('_')}")
            Tags.bump()
        }
    }

    private val profiles = object : BluetoothProfile.ServiceListener {
        override fun onServiceConnected(profile: Int, proxy: BluetoothProfile) {
            if (profile == BluetoothProfile.HEADSET) headset = proxy else if (profile == BluetoothProfile.A2DP) a2dp = proxy
            Tags.bump()
        }
        override fun onServiceDisconnected(profile: Int) {
            if (profile == BluetoothProfile.HEADSET) headset = null else if (profile == BluetoothProfile.A2DP) a2dp = null
        }
    }

    fun start() {
        if (started) return
        started = true
        val f = IntentFilter().apply {
            addAction(BluetoothDevice.ACTION_ACL_CONNECTED)
            addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED)
        }
        runCatching { ContextCompat.registerReceiver(ctx, receiver, f, ContextCompat.RECEIVER_EXPORTED) }
        runCatching { adapter?.getProfileProxy(ctx, profiles, BluetoothProfile.HEADSET) }
        runCatching { adapter?.getProfileProxy(ctx, profiles, BluetoothProfile.A2DP) }
    }

    fun stop() {
        if (!started) return
        started = false
        runCatching { ctx.unregisterReceiver(receiver) }
        headset?.let { runCatching { adapter?.closeProfileProxy(BluetoothProfile.HEADSET, it) } }
        a2dp?.let { runCatching { adapter?.closeProfileProxy(BluetoothProfile.A2DP, it) } }
        headset = null; a2dp = null; acl.clear()
    }

    private fun on(p: BluetoothProfile?, address: String): Boolean =
        runCatching { p?.connectedDevices?.any { it.address == address } == true }.getOrDefault(false)

    /** Connected now, by any of the ways Android tells. */
    fun connected(address: String): Boolean {
        if (acl[address] == false && !on(headset, address) && !on(a2dp, address)) return false
        return acl[address] == true || on(headset, address) || on(a2dp, address) ||
            runCatching { ctx.getSystemService(BluetoothManager::class.java)?.getConnectedDevices(BluetoothProfile.GATT)
                ?.any { it.address == address } == true }.getOrDefault(false)
    }

    /** It is connected as a hands-free headset: a tone can be played on it (WatchRinger). */
    fun callAudio(address: String): Boolean = on(headset, address)

    fun paired(): List<PairedDevice> = runCatching {
        adapter?.bondedDevices.orEmpty().map { PairedDevice(it.address, it.name, it.bluetoothClass?.majorDeviceClass) }
            .sortedWith(compareByDescending<PairedDevice> { it.majorClass == 0x0700 }.thenBy { it.name ?: "" })
    }.getOrDefault(emptyList())
}

/**
 * Csipogtatás for a calling watch: the call audio (SCO) is routed to it and a beep plays on the voice-call stream, so it
 * comes out of the watch's own speaker for [PLAY_MS]. Android 12+ picks the watch by its address; older versions can
 * only start SCO on the active headset (the watch, if it is the only one).
 */
@SuppressLint("MissingPermission")
class WatchRinger(private val ctx: Context, private val onResult: (RingResult) -> Unit) {
    private val main = Handler(Looper.getMainLooper())
    private val am = ctx.getSystemService(AudioManager::class.java)
    private var tone: ToneGenerator? = null
    private var until = 0L
    var ringing = false
        private set

    fun ring(address: String) {
        if (ringing) return
        val a = am ?: return onResult(RingResult.NO_CONNECTION)
        if (Build.VERSION.SDK_INT >= 31) {
            val dev = a.availableCommunicationDevices.firstOrNull {
                it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO && it.address.equals(address, ignoreCase = true)
            } ?: return onResult(RingResult.NO_AUDIO)
            a.mode = AudioManager.MODE_IN_COMMUNICATION
            if (!a.setCommunicationDevice(dev)) { a.mode = AudioManager.MODE_NORMAL; return onResult(RingResult.NO_AUDIO) }
        } else legacyStart(a)
        ringing = true
        until = System.currentTimeMillis() + PLAY_MS
        tone = runCatching { ToneGenerator(AudioManager.STREAM_VOICE_CALL, 100) }.getOrNull()
        VrgLog.i("tag", "watch ring $address")
        onResult(RingResult.STARTED)
        main.postDelayed(beep, 800)      // SCO needs a moment before the first sound reaches the watch
    }

    private val beep = object : Runnable {
        override fun run() {
            if (!ringing) return
            if (System.currentTimeMillis() >= until) { stop(); return }
            runCatching { tone?.startTone(ToneGenerator.TONE_PROP_BEEP2, 400) }
            main.postDelayed(this, 900)
        }
    }

    fun stop() {
        if (!ringing) return
        ringing = false
        main.removeCallbacks(beep)
        runCatching { tone?.release() }; tone = null
        am?.let { a ->
            if (Build.VERSION.SDK_INT >= 31) runCatching { a.clearCommunicationDevice() } else legacyStop(a)
            a.mode = AudioManager.MODE_NORMAL
        }
        onResult(RingResult.DONE)
    }

    @Suppress("DEPRECATION")
    private fun legacyStart(a: AudioManager) {
        a.mode = AudioManager.MODE_IN_COMMUNICATION
        a.startBluetoothSco()
        a.isBluetoothScoOn = true
    }

    @Suppress("DEPRECATION")
    private fun legacyStop(a: AudioManager) {
        a.isBluetoothScoOn = false
        a.stopBluetoothSco()
    }

    companion object { const val PLAY_MS = 8_000L }
}
