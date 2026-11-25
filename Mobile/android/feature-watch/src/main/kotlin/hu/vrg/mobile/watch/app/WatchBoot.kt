package hu.vrg.mobile.watch.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import hu.vrg.mobile.kit.VrgLog

// Brings the Óra link back after a phone restart or an app update, only if the user left Kapcsolat on (WP M65):
// find phone has to work without the app ever being opened. Boot is one of the moments Android lets an app start a
// foreground service from the background.
class WatchBoot : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED && intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        if (!Watch.wanted(ctx) || !Watch.allowed(ctx)) return
        runCatching { WatchService.start(ctx) }
            .onSuccess { VrgLog.i(Watch.LOG, "restarted after ${intent.action?.substringAfterLast('.')}") }
            .onFailure { VrgLog.w(Watch.LOG, "restart refused: ${it.message}") }
    }
}
