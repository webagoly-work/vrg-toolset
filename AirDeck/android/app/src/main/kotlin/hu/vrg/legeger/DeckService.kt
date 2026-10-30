package hu.vrg.legeger

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import hu.vrg.legeger.ui.MainActivity

// Holds the process up while the Bluetooth link is in use, so switching to another app or turning
// the screen off does not drop the mouse. Owns nothing itself: Deck has the HID and the relay.
// "Leállítás" in the notification unregisters the HID app and ends the service.

class DeckService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            Deck.hid.stop()
            Deck.relay.disconnect()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }
        val n = notification()
        if (Build.VERSION.SDK_INT >= 29) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
        else startForeground(ID, n)
        return START_STICKY
    }

    private fun notification(): Notification {
        getSystemService(NotificationManager::class.java)?.createNotificationChannel(
            NotificationChannel(CHANNEL, getString(R.string.notif_channel), NotificationManager.IMPORTANCE_LOW),
        )
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE,
        )
        val stop = PendingIntent.getService(
            this, 1, Intent(this, DeckService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE,
        )
        return Notification.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_notif)
            .setContentTitle(getString(R.string.notif_title))
            .setContentText(Deck.hid.hostLabel() ?: "Bluetooth egér és billentyűzet")
            .setContentIntent(open)
            .setOngoing(true)
            .addAction(Notification.Action.Builder(null as android.graphics.drawable.Icon?, getString(R.string.notif_stop), stop).build())
            .build()
    }

    companion object {
        private const val ID = 47291
        private const val CHANNEL = "link"
        private const val ACTION_STOP = "hu.vrg.legeger.STOP"

        fun start(ctx: Context) {
            ctx.startForegroundService(Intent(ctx, DeckService::class.java))
        }
    }
}
