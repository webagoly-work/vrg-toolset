package hu.vrg.mobile.watch.app

import android.app.AppOpsManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings

// The three settings the Óra needs to run in the background (M65 check 11), each opened straight from the app:
// Android's battery-optimisation exemption, and on Xiaomi / Redmi / POCO (MIUI, HyperOS) the Automatikus indítás list and
// the app's Akkumulátorkímélő page. When a Xiaomi screen cannot be opened (another phone, a moved activity), the app's own
// settings page opens instead, so a button never does nothing.

object BackgroundSettings {

    val isXiaomi: Boolean
        get() = Build.MANUFACTURER.lowercase().let { it == "xiaomi" || it == "redmi" || it == "poco" }

    /** Android's battery-optimisation exemption (readable on every phone). */
    fun batteryFree(ctx: Context) = Watch.backgroundFree(ctx)

    /**
     * Xiaomi autostart: MIUI keeps it as app-op 10008 (0 = allowed). Read through the hidden int-op call;
     * null when the phone does not say (not a Xiaomi, or the call is refused).
     */
    fun autostart(ctx: Context): Boolean? {
        if (!isXiaomi) return null
        return runCatching {
            val ops = ctx.getSystemService(AppOpsManager::class.java)
            val m = AppOpsManager::class.java.getMethod("checkOpNoThrow",
                Int::class.javaPrimitiveType, Int::class.javaPrimitiveType, String::class.java)
            (m.invoke(ops, 10008, Process.myUid(), ctx.packageName) as Int) == AppOpsManager.MODE_ALLOWED
        }.getOrNull()
    }

    fun openBatteryOptimisation(ctx: Context) {
        val pkg = Uri.parse("package:" + ctx.packageName)
        if (!batteryFree(ctx) && start(ctx, Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, pkg))) return
        if (start(ctx, Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))) return
        openAppDetails(ctx)
    }

    fun openAutostart(ctx: Context) {
        val tries = listOf(
            ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
            ComponentName("com.miui.securitycenter", "com.miui.appmanager.ApplicationsDetailsActivity"),
        )
        for (c in tries) {
            val i = Intent().setComponent(c).putExtra("package_name", ctx.packageName).putExtra("package_label", label(ctx))
            if (start(ctx, i)) return
        }
        openAppDetails(ctx)
    }

    fun openBatterySaver(ctx: Context) {
        val i = Intent().setComponent(ComponentName("com.miui.powerkeeper", "com.miui.powerkeeper.ui.HiddenAppsConfigActivity"))
            .putExtra("package_name", ctx.packageName).putExtra("package_label", label(ctx))
        if (start(ctx, i)) return
        openAppDetails(ctx)
    }

    fun openAppDetails(ctx: Context) {
        start(ctx, Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + ctx.packageName)))
    }

    private fun label(ctx: Context) = ctx.applicationInfo.loadLabel(ctx.packageManager).toString()

    private fun start(ctx: Context, i: Intent): Boolean = runCatching {
        if (ctx !is android.app.Activity) i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        ctx.startActivity(i)
    }.isSuccess
}
