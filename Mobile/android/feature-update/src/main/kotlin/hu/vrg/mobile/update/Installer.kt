package hu.vrg.mobile.update

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import java.io.File

// Hands a checked APK to Android. A self-update through PackageInstaller still shows Android's own
// confirmation: the session answers STATUS_PENDING_USER_ACTION with the Intent that asks the user.

object Installer {
    fun install(ctx: Context, apk: File) {
        val pi = ctx.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setAppPackageName(ctx.packageName)
            setSize(apk.length())
        }
        val id = pi.createSession(params)
        pi.openSession(id).use { s ->
            s.openWrite("base.apk", 0, apk.length()).use { out ->
                apk.inputStream().use { it.copyTo(out) }
                s.fsync(out)
            }
            val report = Intent(ctx, InstallReceiver::class.java)
            // Mutable: the installer writes its status into this Intent
            val pending = PendingIntent.getBroadcast(ctx, id, report, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE)
            s.commit(pending.intentSender)
        }
    }
}

class InstallReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        when (val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                @Suppress("DEPRECATION")
                val ask = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT) ?: return
                ctx.startActivity(ask.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
            // The app is replaced and restarted by then; a success is seen as the new version.
            PackageInstaller.STATUS_SUCCESS -> {}
            else -> UpdateFeature.installFailed(status, intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE))
        }
    }
}
