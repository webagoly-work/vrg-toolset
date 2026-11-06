package hu.vrg.mobile.kit

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import hu.vrg.mobile.core.InboxChannel
import hu.vrg.mobile.core.InboxEvent
import hu.vrg.mobile.core.InboxLevel
import hu.vrg.mobile.core.Links

// The app's phone notifications (WP M10): one Android channel per kit-core InboxChannel (CI, PR, Relé,
// Frissítés, Jegyzet), so each can be silenced on its own. Beállítások (M1) lists them and opens Android's
// page for the one tapped; the switch itself is Android's, there is no second copy of it in the app.
// Android 13+ asks for POST_NOTIFICATIONS: the app asks in context (on the Értesítések screen) and works
// without it, the list fills either way.

object VrgNotify {
    private const val GROUP = "vrg.inbox"

    /** Creates (or renames) the channels; cheap and safe to call on every start. */
    fun ensureChannels(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        InboxChannel.entries.forEach { c ->
            val importance = if (c == InboxChannel.UPDATE || c == InboxChannel.NOTE) NotificationManager.IMPORTANCE_DEFAULT else NotificationManager.IMPORTANCE_HIGH
            nm.createNotificationChannel(NotificationChannel(c.id, c.title, importance).apply { description = c.blurb })
        }
    }

    /** Whether Android 13+'s runtime permission still has to be asked for. */
    fun needsPermission(ctx: Context): Boolean =
        Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED

    /** The app may notify at all (the permission, and the app's master switch). */
    fun allowed(ctx: Context): Boolean = !needsPermission(ctx) && NotificationManagerCompat.from(ctx).areNotificationsEnabled()

    /** One channel's switch as Android has it. */
    fun channelOn(ctx: Context, c: InboxChannel): Boolean {
        val ch = ctx.getSystemService(NotificationManager::class.java)?.getNotificationChannel(c.id) ?: return true
        return ch.importance != NotificationManager.IMPORTANCE_NONE
    }

    /** Android's page for one channel (or for the whole app with null). */
    fun settingsIntent(ctx: Context, c: InboxChannel?): Intent =
        (if (c == null) Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
        else Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_CHANNEL_ID, c.id))
            .putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

    /** A tap opens vrg://inbox/open?id=<event>: the inbox marks it read and opens its page or feature. */
    fun post(ctx: Context, e: InboxEvent) {
        if (!allowed(ctx)) return
        val link = Uri.parse("${Links.SCHEME}://inbox/open?id=" + Uri.encode(e.id))
        val tap = Intent(Intent.ACTION_VIEW, link).setPackage(ctx.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        val pi = PendingIntent.getActivity(ctx, e.id.hashCode(), tap, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val n = NotificationCompat.Builder(ctx, e.kind.channel.id)
            .setSmallIcon(R.drawable.ic_vrg_notify)
            .setContentTitle(e.title)
            .setContentText(e.text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(e.text))
            .setWhen(if (e.at > 0) e.at else System.currentTimeMillis())
            .setShowWhen(true)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .setGroup(GROUP)
            .apply { if (e.level == InboxLevel.BAD) setColor(0xFFE0605A.toInt()) }
            .build()
        try { NotificationManagerCompat.from(ctx).notify(e.id, 0, n) } catch (x: SecurityException) { VrgLog.w("notify", "Nincs engedély: ${x.message}") }
    }

    /** Takes a read event's notification off the shade. */
    fun cancel(ctx: Context, id: String) = NotificationManagerCompat.from(ctx).cancel(id, 0)
}
