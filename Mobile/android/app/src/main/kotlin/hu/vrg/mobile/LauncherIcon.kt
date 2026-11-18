package hu.vrg.mobile

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import hu.vrg.mobile.core.Look
import hu.vrg.mobile.kit.VrgLog

// The home-screen icon wears the palette chosen in Beállítások → Megjelenés. An app cannot repaint its own launcher
// icon, so the manifest carries one activity-alias per palette (Mobile/catalogue/icon-gen.js) and this switches which
// one is enabled. It runs when the app leaves the screen, not while the user is trying palettes: on some launchers
// the icon blinks, and a few (MIUI among them) need a moment to show the new one. The target is enabled before the
// others are disabled, so the app is never left without a launcher entry.

object LauncherIcon {
    fun apply(ctx: Context, palette: String) {
        val pm = ctx.packageManager
        val want = Look.launcherAlias(palette)
        val all = Look.PALETTES.map { Look.launcherAlias(it) }
        fun on(name: String): Boolean = when (pm.getComponentEnabledSetting(ComponentName(ctx, name))) {
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED -> true
            PackageManager.COMPONENT_ENABLED_STATE_DEFAULT -> name == Look.launcherAlias(Look.DEFAULT_PALETTE)
            else -> false
        }
        try {
            if (all.filter { on(it) } == listOf(want)) return
            pm.setComponentEnabledSetting(ComponentName(ctx, want), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP)
            all.filter { it != want }.forEach {
                pm.setComponentEnabledSetting(ComponentName(ctx, it), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP)
            }
            VrgLog.i("icon", "Ikon: $palette")
        } catch (e: Exception) {
            VrgLog.w("icon", "Az ikon nem váltott: ${e.message}")
        }
    }
}
