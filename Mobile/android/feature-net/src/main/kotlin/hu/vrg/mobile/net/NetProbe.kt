package hu.vrg.mobile.net

import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.TrafficStats
import android.os.Build
import hu.vrg.mobile.core.IfaceAddr
import hu.vrg.mobile.core.SettingsTarget
import hu.vrg.mobile.core.Tether
import hu.vrg.mobile.core.TetherState
import java.net.Inet4Address
import java.net.NetworkInterface

// What an ordinary app can read about the phone's links (research §2–3), in one snapshot. The rules that turn
// the raw names into a state are kit-core's Net.kt; this file only asks Android.

data class NetSnapshot(
    val tether: TetherState,
    val addrs: List<IfaceAddr>,
    val wifi: Boolean,
    val mobile: Boolean,
    /** TrafficStats' mobile bytes since boot, or -1. */
    val mobileBytes: Long,
    /** The hotspot interface's bytes since it came up (Android 12+), or null. */
    val hotspotBytes: Long?,
)

object NetProbe {
    // TetheringManager.ACTION_TETHER_STATE_CHANGED and its extras: hidden constants, stable strings (research §2).
    private const val ACTION_TETHER = "android.net.conn.TETHER_STATE_CHANGED"

    fun read(ctx: Context): NetSnapshot {
        val addrs = interfaces()
        val tether = Tether.state(tetheredFromBroadcast(ctx), addrs)
        val cm = ctx.getSystemService(ConnectivityManager::class.java)
        val caps = cm?.activeNetwork?.let { cm.getNetworkCapabilities(it) }
        val hs = Tether.hotspotIface(tether)
        val hsBytes = if (hs != null && Build.VERSION.SDK_INT >= 31) {
            val rx = TrafficStats.getRxBytes(hs); val tx = TrafficStats.getTxBytes(hs)
            if (rx < 0 || tx < 0) null else rx + tx
        } else null
        val mRx = TrafficStats.getMobileRxBytes(); val mTx = TrafficStats.getMobileTxBytes()
        return NetSnapshot(
            tether, addrs,
            wifi = caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true,
            mobile = caps?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true,
            mobileBytes = if (mRx < 0 || mTx < 0) -1 else mRx + mTx,
            hotspotBytes = hsBytes,
        )
    }

    /** The interfaces that carry an IPv4 address (Android 11+ still lists those; research §2). */
    fun interfaces(): List<IfaceAddr> = try {
        NetworkInterface.getNetworkInterfaces()?.toList().orEmpty().filter { runCatching { it.isUp }.getOrDefault(false) }.flatMap { ni ->
            ni.inetAddresses.toList().filterIsInstance<Inet4Address>().map { IfaceAddr(ni.name, it.hostAddress ?: "") }
        }
    } catch (_: Exception) { emptyList() }

    /** The sticky broadcast's tethered interfaces, or null when this phone does not send it. */
    @Suppress("UnspecifiedRegisterReceiverFlag")
    private fun tetheredFromBroadcast(ctx: Context): List<String>? {
        val i = try {
            if (Build.VERSION.SDK_INT >= 33) ctx.registerReceiver(null, IntentFilter(ACTION_TETHER), Context.RECEIVER_EXPORTED)
            else ctx.registerReceiver(null, IntentFilter(ACTION_TETHER))
        } catch (_: Exception) { null } ?: return null
        val list = i.getStringArrayListExtra("tetherArray") ?: i.getStringArrayListExtra("activeArray") ?: return null
        return list.toList()
    }

    /** Opens the first settings page of [chain] that exists on this phone. False when none did. */
    fun open(ctx: Context, chain: List<SettingsTarget>): Boolean {
        for (t in chain) {
            val i = when (t) {
                is SettingsTarget.Action -> Intent(t.action)
                is SettingsTarget.Component -> Intent().setComponent(ComponentName(t.pkg, t.cls))
            }.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            try { ctx.startActivity(i); return true } catch (_: ActivityNotFoundException) {} catch (_: SecurityException) {}
        }
        return false
    }
}
