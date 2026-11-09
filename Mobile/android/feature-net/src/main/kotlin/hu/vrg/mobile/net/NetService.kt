package hu.vrg.mobile.net

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
import hu.vrg.mobile.core.Usage
import hu.vrg.mobile.core.UsageDay
import hu.vrg.mobile.kit.VrgNotify
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.time.LocalDate

// Hálózat's foreground service (connectedDevice, research §5): it holds the phone relay up while the user has it
// on, and samples the mobile data once a minute while the usage watch is on. One ongoing notification shows both
// and carries Leállítás; the threshold warning is a separate notification, once a day. Started only from the
// screen (a user tap): Android 12+ forbids starting it from the background, and nothing here needs a boot start.

class NetService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var loop: Job? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            PhoneRelayHost.stop()
            UsageWatch.setOn(this, false)
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }
        channels(this)
        val n = notification(UsageWatch.line.value)
        if (Build.VERSION.SDK_INT >= 29) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
        else startForeground(ID, n)
        if (!PhoneRelayHost.state.value.running && !UsageWatch.on(this)) {      // both switched off on the screen
            stopForeground(STOP_FOREGROUND_REMOVE); stopSelf(); return START_NOT_STICKY
        }
        if (loop == null) loop = scope.launch {
            while (isActive) {
                tick()
                if (!PhoneRelayHost.state.value.running && !UsageWatch.on(this@NetService)) { stopSelf(); break }
                delay(60_000)
            }
        }
        return START_NOT_STICKY       // after a kill the user starts it again: never a relay nobody asked for
    }

    override fun onDestroy() {
        loop?.cancel()
        PhoneRelayHost.stop()
        super.onDestroy()
    }

    private fun tick() {
        val snap = NetProbe.read(this)
        if (UsageWatch.on(this)) UsageWatch.sample(this, snap)
        getSystemService(NotificationManager::class.java)?.notify(ID, notification(UsageWatch.line.value))
    }

    private fun notification(usage: String?): Notification {
        val r = PhoneRelayHost.state.value
        val peers = PhoneRelayHost.peers.value.count { it.trusted }
        val title = if (r.running) "Telefon relé fut · $peers kapcsolat" else "Hálózat figyelés"
        val text = listOfNotNull(if (r.running) "port ${r.port}" else null, usage).joinToString(" · ").ifEmpty { "Hálózat" }
        val open = PendingIntent.getActivity(this, 0,
            Intent(Intent.ACTION_VIEW, android.net.Uri.parse("vrg://net")).setPackage(packageName)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE)
        val stop = PendingIntent.getService(this, 1, Intent(this, NetService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE)
        return Notification.Builder(this, CHANNEL)
            .setSmallIcon(hu.vrg.mobile.kit.R.drawable.ic_vrg_notify)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(open)
            .setOngoing(true)
            .addAction(Notification.Action.Builder(null as android.graphics.drawable.Icon?, "Leállítás", stop).build())
            .build()
    }

    companion object {
        private const val ID = 47297
        const val CHANNEL = "net"
        const val CHANNEL_WARN = "net-usage"
        private const val ACTION_STOP = "hu.vrg.mobile.net.STOP"

        fun channels(ctx: Context) {
            val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
            nm.createNotificationChannel(NotificationChannel(CHANNEL, "Hálózat (folyamatos)", NotificationManager.IMPORTANCE_LOW))
            nm.createNotificationChannel(NotificationChannel(CHANNEL_WARN, "Adatforgalom figyelmeztetés", NotificationManager.IMPORTANCE_HIGH))
        }

        /** Starts or refreshes the service; only from a user tap on the screen. */
        fun kick(ctx: Context) { ctx.startForegroundService(Intent(ctx, NetService::class.java)) }
    }
}

/** The usage watch's settings and its day counter, in the "net" preferences. */
object UsageWatch {
    private const val PREFS = "net"
    private val _line = MutableStateFlow<String?>(null)
    /** The current notification text, or null while the hotspot is off / the watch is off. */
    val line: StateFlow<String?> = _line
    private val _day = MutableStateFlow<UsageDay?>(null)
    val day: StateFlow<UsageDay?> = _day

    private fun p(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun on(ctx: Context) = p(ctx).getBoolean("watch", false)
    fun setOn(ctx: Context, v: Boolean) { p(ctx).edit().putBoolean("watch", v).apply(); if (!v) _line.value = null }
    fun thresholdMb(ctx: Context) = p(ctx).getInt("thresholdMb", 2000)
    fun setThresholdMb(ctx: Context, mb: Int) = p(ctx).edit().putInt("thresholdMb", mb).apply()

    fun load(ctx: Context) { _day.value = UsageDay.decode(p(ctx).getString("usage", null)) }

    /** One sample: the day counter always (so the screen shows it), the notification line and warning only while tethering. */
    fun sample(ctx: Context, snap: NetSnapshot) {
        var d = Usage.sample(UsageDay.decode(p(ctx).getString("usage", null)), LocalDate.now().toString(), snap.mobileBytes)
        val tethering = snap.tether.hotspot || snap.tether.usb || snap.tether.bluetooth
        _line.value = if (tethering) Usage.line(d, snap.hotspotBytes) else null
        if (tethering && d != null && Usage.shouldWarn(d, thresholdMb(ctx)) && VrgNotify.allowed(ctx)) {
            val n = Notification.Builder(ctx, NetService.CHANNEL_WARN)
                .setSmallIcon(hu.vrg.mobile.kit.R.drawable.ic_vrg_notify)
                .setContentTitle("Adatforgalom: elérte a ${Usage.thresholdLabel(thresholdMb(ctx))} határt")
                .setContentText(Usage.line(d, snap.hotspotBytes))
                .setAutoCancel(true)
                .build()
            ctx.getSystemService(NotificationManager::class.java)?.notify(47298, n)
            d = Usage.warned(d)
        }
        if (d != null) p(ctx).edit().putString("usage", d.encode()).apply()
        _day.value = d
    }
}
