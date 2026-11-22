package hu.vrg.mobile.watch.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import hu.vrg.mobile.kct.Acky
import hu.vrg.mobile.kct.DeviceInfo
import hu.vrg.mobile.kct.Steps
import kotlinx.coroutines.flow.MutableStateFlow

// What the Óra screen shows, shared by the screen and WatchService (the link lives in the service). Main thread only.

object Watch {
    const val NAME = "Q71_LE"
    const val LOG = "watch"

    enum class Link(val hu: String) {
        OFF("kikapcsolva"), SEARCHING("keresem az órát…"), CONNECTING("kapcsolódás…"), READY("kapcsolódva"),
        WAITING("újrapróbálás hamarosan"), NO_PERMISSION("nincs Bluetooth engedély"), NO_BT("a Bluetooth ki van kapcsolva"),
    }

    val link = MutableStateFlow(Link.OFF)
    val version = MutableStateFlow<String?>(null)
    val info = MutableStateFlow<DeviceInfo?>(null)
    val steps = MutableStateFlow<Steps?>(null)
    val addresses = MutableStateFlow<Acky?>(null)
    val watchRinging = MutableStateFlow(false)
    val phoneRinging = MutableStateFlow(false)
    val serverUp = MutableStateFlow(false)
    val lastTimeSync = MutableStateFlow(0L)
    val note = MutableStateFlow<String?>(null)

    // ---- the remembered watch: found once by name, then connected by address --------------------------------------

    private const val PREFS = "watch"

    fun address(ctx: Context): String? = ctx.getSharedPreferences(PREFS, 0).getString("address", null)

    fun remember(ctx: Context, address: String?) {
        ctx.getSharedPreferences(PREFS, 0).edit().apply { if (address == null) remove("address") else putString("address", address) }.apply()
    }

    fun wanted(ctx: Context): Boolean = ctx.getSharedPreferences(PREFS, 0).getBoolean("wanted", false)
    fun setWanted(ctx: Context, on: Boolean) { ctx.getSharedPreferences(PREFS, 0).edit().putBoolean("wanted", on).apply() }

    fun permissions(): Array<String> = if (Build.VERSION.SDK_INT >= 31) arrayOf(
        Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT,
    ) else arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)

    /** Off battery optimisation: Android (and MIUI / HyperOS) then leaves the link service running in the background. */
    fun backgroundFree(ctx: Context): Boolean =
        ctx.getSystemService(android.os.PowerManager::class.java)?.isIgnoringBatteryOptimizations(ctx.packageName) == true

    fun allowed(ctx: Context) = permissions().all { ctx.checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }

    fun clearDevice() {
        version.value = null; info.value = null; steps.value = null; addresses.value = null
        watchRinging.value = false
    }
}
