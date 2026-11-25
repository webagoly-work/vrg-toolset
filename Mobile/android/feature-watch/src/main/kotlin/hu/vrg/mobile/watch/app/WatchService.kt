package hu.vrg.mobile.watch.app

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
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import hu.vrg.mobile.kct.Decoded
import hu.vrg.mobile.kct.Session
import hu.vrg.mobile.kit.VrgLog
import java.util.TimeZone

// The Óra link (WP M65 Q1–Q3) as a connectedDevice foreground service, only while the user has Kapcsolat on (D-168:
// VRG Mobile takes the watch over; FunDo stopped). It opens the phone's GATT server first (the watch looks for it),
// then the LE link, runs the kct-core Session over it and reconnects with back-off (5 s doubling to 5 min).

class WatchService : Service() {
    private val main = Handler(Looper.getMainLooper())
    private var link: WatchLink? = null
    private var server: PhoneServer? = null
    private val session = Session(tzOffsetMs = { TimeZone.getDefault().getOffset(it) })
    private var backoff = FIRST_BACKOFF
    private var running = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() { super.onCreate(); channels(this); self = this }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> { Watch.setWanted(this, false); shutdown(); return START_NOT_STICKY }
            ACTION_FOUND -> { PhoneRing.stop(this); if (!running) stopSelf(); return START_NOT_STICKY }
        }
        val n = ongoing()
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(ID_RUN, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE) else startForeground(ID_RUN, n)
        } catch (e: RuntimeException) {       // Android 12+: a start from the background that is not allowed
            VrgLog.w(Watch.LOG, "foreground refused: ${e.message}")
            running = false; stopSelf(); return START_NOT_STICKY
        }
        if (!Watch.allowed(this)) { Watch.link.value = Watch.Link.NO_PERMISSION; shutdown(); return START_NOT_STICKY }
        if (!running) begin()
        // Sticky: if Android (or the Xiaomi battery saver) kills the link, it restarts it, so the watch can still ring
        // the phone with the app closed. Kapcsolat off (ACTION_STOP) is the only way it stays down.
        return START_STICKY
    }

    private fun begin() {
        running = true
        Watch.setWanted(this, true)
        server = PhoneServer(this) { on -> if (on) PhoneRing.ring(this) else PhoneRing.stop(this) }.also {
            if (!it.open()) VrgLog.w(Watch.LOG, "phone GATT server did not open")
        }
        link = WatchLink(this, ::ready, ::frame, ::down, ::waiting)
        connect()
    }

    private fun connect() {
        if (!running) return
        Watch.clearDevice()
        link?.open(Watch.address(this))
    }

    private fun ready() {
        backoff = FIRST_BACKOFF
        Watch.link.value = Watch.Link.READY
        Watch.note.value = null
        session.linkUp().forEach { link?.send(it) }
        refresh()
    }

    private fun frame(d: Decoded) {
        VrgLog.i(Watch.LOG, "← ${d.header.take(24)}")
        val step = session.receive(d)
        step.send.forEach { link?.send(it) }
        step.events.forEach { e ->
            when (e) {
                is Session.Event.Version -> { Watch.version.value = e.v; Watch.lastTimeSync.value = System.currentTimeMillis(); server?.notifyTime() }
                is Session.Event.Addresses -> Watch.addresses.value = e.a
                is Session.Event.Info -> Watch.info.value = e.info
                is Session.Event.Today -> Watch.steps.value = e.steps
                is Session.Event.FindPhone -> if (e.on) PhoneRing.ring(this) else PhoneRing.stop(this)
                is Session.Event.WatchRings -> Watch.watchRinging.value = e.on
                is Session.Event.Measure -> VrgLog.i(Watch.LOG, "measurement SEND,${e.n} (kept for Q6)")
                is Session.Event.Unknown -> VrgLog.i(Watch.LOG, "unhandled: ${e.text}")
            }
        }
        refresh()
    }

    private fun down(why: String) {
        Watch.clearDevice()
        if (!running) return
        Watch.note.value = why
        Watch.link.value = Watch.Link.WAITING
        VrgLog.i(Watch.LOG, "retry in ${backoff / 1000} s: $why")
        main.removeCallbacks(retry)
        main.postDelayed(retry, backoff)
        backoff = (backoff * 2).coerceAtMost(MAX_BACKOFF)
        refresh()
    }

    private val retry = Runnable { connect() }

    /** Android holds a background connect for the remembered watch: no retry timer (it would stop in deep sleep anyway). */
    private fun waiting(why: String) {
        Watch.clearDevice()
        if (!running) return
        main.removeCallbacks(retry)
        backoff = FIRST_BACKOFF
        Watch.note.value = "$why · háttérben várom: amint az óra elérhető, magától kapcsolódik"
        Watch.link.value = Watch.Link.WAITING
        refresh()
    }

    // ---- what the screen asks for --------------------------------------------------------------------------------

    private fun timeSync() {
        val l = link?.takeIf { it.isReady } ?: return
        session.timeSync().forEach { l.send(it) }
        server?.notifyTime()
        Watch.lastTimeSync.value = System.currentTimeMillis()
    }

    private fun reconnectNow() {
        if (!running || link?.isReady == true) return
        main.removeCallbacks(retry)
        backoff = FIRST_BACKOFF
        connect()
    }

    private fun readAll() { link?.takeIf { it.isReady }?.let { l -> session.refresh().forEach { l.send(it) } } }

    private fun findWatch(on: Boolean) {
        val l = link?.takeIf { it.isReady } ?: return
        l.alert(on)
        session.findWatch(on).forEach { l.send(it) }
        Watch.watchRinging.value = on
    }

    private fun shutdown() {
        running = false
        main.removeCallbacks(retry)
        link?.close(); link = null
        server?.close(); server = null
        PhoneRing.stop(this)
        Watch.clearDevice()
        Watch.link.value = Watch.Link.OFF
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        if (running) shutdown()
        if (self === this) self = null
        super.onDestroy()
    }

    private var lastText = ""
    private fun refresh() {
        val t = ongoingText()
        if (t == lastText) return
        lastText = t
        runCatching { NotificationManagerCompat.from(this).notify(ID_RUN, ongoing()) }
    }

    private fun ongoingText(): String = Watch.link.value.hu + (Watch.steps.value?.let { " · ma ${it.steps} lépés" } ?: "")

    private fun ongoing(): Notification = NotificationCompat.Builder(this, CH_RUN)
        .setSmallIcon(hu.vrg.mobile.kit.R.drawable.ic_vrg_notify)
        .setContentTitle("Óra · Q71")
        .setContentText(ongoingText())
        .setContentIntent(openIntent(this))
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .addAction(0, "Kikapcsolás", PendingIntent.getService(this, 1,
            Intent(this, WatchService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE))
        .build()

    companion object {
        private const val ID_RUN = 47330
        private const val FIRST_BACKOFF = 5_000L
        private const val MAX_BACKOFF = 300_000L
        const val CH_RUN = "watch-run"
        const val CH_ALERT = "watch-alert"
        const val ACTION_STOP = "hu.vrg.mobile.watch.STOP"
        const val ACTION_FOUND = "hu.vrg.mobile.watch.FOUND"

        private var self: WatchService? = null

        fun start(ctx: Context) { ctx.startForegroundService(Intent(ctx, WatchService::class.java)) }
        fun stop(ctx: Context) { ctx.startService(Intent(ctx, WatchService::class.java).setAction(ACTION_STOP)) }

        fun timeSync() { self?.timeSync() }
        fun readAll() { self?.readAll() }
        fun findWatch(on: Boolean) { self?.findWatch(on) }
        /** Try now (after a permission was granted or the watch was forgotten), resetting the back-off. */
        fun reconnect() { self?.reconnectNow() }

        fun openIntent(ctx: Context): PendingIntent = PendingIntent.getActivity(ctx, 0,
            Intent(Intent.ACTION_VIEW, Uri.parse("vrg://watch")).setPackage(ctx.packageName)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE)

        fun channels(ctx: Context) {
            val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
            nm.createNotificationChannel(NotificationChannel(CH_RUN, "Óra (kapcsolat)", NotificationManager.IMPORTANCE_LOW))
            nm.createNotificationChannel(NotificationChannel(CH_ALERT, "Óra: telefonkeresés", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Ha az óráról keresed a telefont"
            })
        }
    }
}
