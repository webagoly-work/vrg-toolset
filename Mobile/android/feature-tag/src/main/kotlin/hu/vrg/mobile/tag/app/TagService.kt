package hu.vrg.mobile.tag.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.VrgNotify
import hu.vrg.mobile.tag.LeftBehind
import hu.vrg.mobile.tag.TagText
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

// Ottfelejtés (left behind): a connectedDevice foreground service that keeps the filtered scan running with the screen
// off and rings once when "mine" has not been heard for the chosen time, and once more when it is back. Started only
// from a tap on the screen, stopped there or from its notification. The loop runs on the main thread, like the
// scanner's callbacks, so the tag book is only ever touched from one thread.

class TagService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var loop: Job? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        channels(this)
        Tags.load(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) { Tags.setWatchWanted(this, false); shutdown(); return START_NOT_STICKY }
        if (intent?.action == ACTION_FOUND) {
            Tags.stopPhone(this)
            if (loop == null) stopSelf()          // Megvan never starts the watch by itself
            return START_NOT_STICKY
        }
        val n = ongoing()
        if (Build.VERSION.SDK_INT >= 29) startForeground(ID_RUN, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE) else startForeground(ID_RUN, n)
        if (!Tags.allowed(this) || Tags.book.mine == null) { shutdown(); return START_NOT_STICKY }
        if (loop == null) start()
        return START_NOT_STICKY
    }

    private fun start() {
        Tags.setWatchWanted(this, true)
        Tags.wantForWatch(this, true)
        Tags.watch.arm(System.currentTimeMillis())
        running.value = true
        Tags.bump()
        loop = scope.launch {
            while (isActive) {
                val now = System.currentTimeMillis()
                val mine = Tags.book.mine
                if (mine == null) { shutdown(); break }
                when (Tags.watch.tick(mine.lastSeenAt, now)) {
                    LeftBehind.Event.LEFT -> { alert(left = true); Tags.saveMine(this@TagService) }
                    LeftBehind.Event.BACK -> alert(left = false)
                    null -> {}
                }
                Tags.syncLink(this@TagService)                    // an iTag: keep the connection (ItagLink)
                Tags.pollPaired()                                 // a paired watch: its connection is its presence
                if (Tags.finder.tick(now)) Tags.stopPhone(this@TagService)
                Tags.book.prune(now)
                refresh()
                delay(2_000)
            }
        }
    }

    private var lastText = ""
    private fun refresh() {
        val t = ongoingText()
        if (t == lastText) return
        lastText = t
        runCatching { NotificationManagerCompat.from(this).notify(ID_RUN, ongoing()) }
    }

    private fun ongoingText(): String {
        val m = Tags.book.mine ?: return ""
        val heard = if (m.lastSeenAt > 0) TagText.ago(System.currentTimeMillis() - m.lastSeenAt) else "még nem"
        val link = when (m.type) {
            hu.vrg.mobile.tag.TagType.ITAG -> if (Tags.linkUp.value) " · kapcsolat él" else " · kapcsolódás…"
            hu.vrg.mobile.tag.TagType.WATCH -> if (Tags.linkUp.value) " · kapcsolódva" else " · nincs kapcsolat"
            else -> ""
        }
        return "${Tags.watch.state.hu} · hallottam: $heard$link"
    }

    private fun ongoing(): Notification {
        val name = Tags.book.mine?.name ?: "Címke"
        return NotificationCompat.Builder(this, CH_RUN)
            .setSmallIcon(hu.vrg.mobile.kit.R.drawable.ic_vrg_notify)
            .setContentTitle("Tárgykereső · $name figyelése")
            .setContentText(ongoingText())
            .setContentIntent(openIntent(this))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .addAction(0, "Kikapcsolás", PendingIntent.getService(this, 1,
                Intent(this, TagService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE))
            .build()
    }

    private fun alert(left: Boolean) {
        val m = Tags.book.mine ?: return
        VrgLog.i("tag", if (left) "left behind" else "back")
        val nm = NotificationManagerCompat.from(this)
        if (!left) { nm.cancel(ID_ALERT); return }
        buzz()
        if (!VrgNotify.allowed(this)) return
        val place = if (m.lastLat != null && m.lastLon != null) " Utoljára ott hallottam, ahol a telefon " +
            "${TagText.ago(System.currentTimeMillis() - m.lastSeenAt)} volt: a Tárgykeresőben megnyitható." else ""
        val n = NotificationCompat.Builder(this, CH_ALERT)
            .setSmallIcon(hu.vrg.mobile.kit.R.drawable.ic_vrg_notify)
            .setContentTitle("Lemaradt: ${m.name}")
            .setContentText("Már nem hallom a címkét.$place")
            .setStyle(NotificationCompat.BigTextStyle().bigText("Már nem hallom a címkét.$place"))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setContentIntent(openIntent(this))
            .setAutoCancel(true)
            .build()
        try { nm.notify(ID_ALERT, n) } catch (e: SecurityException) { VrgLog.w("tag", "notify: ${e.message}") }
    }

    private fun buzz() {
        val v: Vibrator? = if (Build.VERSION.SDK_INT >= 31) getSystemService(VibratorManager::class.java)?.defaultVibrator
        else oldVibrator()
        runCatching { v?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 300, 150, 300, 150, 600), -1)) }
    }

    @Suppress("DEPRECATION")
    private fun oldVibrator(): Vibrator? = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator

    private fun shutdown() {
        loop?.cancel(); loop = null
        Tags.stopPhone(this)
        Tags.watch.disarm()
        Tags.wantForWatch(this, false)
        running.value = false
        Tags.bump()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        if (loop != null) shutdown()
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        private const val ID_RUN = 47320
        private const val ID_ALERT = 47321
        const val CH_RUN = "tag-run"
        const val CH_ALERT = "tag-alert"
        const val ACTION_STOP = "hu.vrg.mobile.tag.STOP"
        const val ACTION_FOUND = "hu.vrg.mobile.tag.FOUND"

        val running = kotlinx.coroutines.flow.MutableStateFlow(false)

        fun start(ctx: Context) { ctx.startForegroundService(Intent(ctx, TagService::class.java)) }
        fun stop(ctx: Context) { ctx.startService(Intent(ctx, TagService::class.java).setAction(ACTION_STOP)) }

        fun openIntent(ctx: Context): PendingIntent = PendingIntent.getActivity(ctx, 0,
            Intent(Intent.ACTION_VIEW, Uri.parse("vrg://tag")).setPackage(ctx.packageName)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE)

        fun channels(ctx: Context) {
            val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
            nm.createNotificationChannel(NotificationChannel(CH_RUN, "Tárgykereső (figyel)", NotificationManager.IMPORTANCE_LOW))
            nm.createNotificationChannel(NotificationChannel(CH_ALERT, "Tárgykereső: lemaradt", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Ha a saját címkéd lemarad (ottfelejtés)"
            })
        }
    }
}
