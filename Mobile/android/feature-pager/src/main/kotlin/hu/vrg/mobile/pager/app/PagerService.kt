package hu.vrg.mobile.pager.app

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.pager.Accel
import hu.vrg.mobile.pager.Effect
import hu.vrg.mobile.pager.GuardState
import hu.vrg.mobile.pager.LinkMsg
import hu.vrg.mobile.pager.ManDownState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

// Csipogó's foreground service (connectedDevice): while it runs the phone is a pager — it advertises its beacon,
// listens for the crew, keeps the links, rings, and watches the accelerometer when Őrzés or Mozdulatlanság is on.
// Started only from the screen (a tap), stopped from the screen or the notification's Kikapcsolás.

class PagerService : Service(), SensorEventListener {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private var loop: Job? = null
    private lateinit var alerts: Alerts
    private var radio: BleRadio? = null
    private var links: Links? = null
    lateinit var voice: VoiceIo; private set
    private var wake: PowerManager.WakeLock? = null
    private var sensing = false
    private var linkIdentity: Pair<Int, String>? = null
    private var lastChats = 0

    private val engine get() = Pager.engine

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        Alerts.channels(this)
        alerts = Alerts(this)
        voice = VoiceIo(send = { m -> links?.send(m) }, myUnit = { engine.me.unit })
        Pager.applySettings(this)
        Pager.guardPrefs(this)
        Pager.loadChats(this)
        lastChats = engine.chats().size
        current = this
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> { Pager.setWanted(this, false); shutdown(); return START_NOT_STICKY }
            ACTION_SEEN -> { engine.seen(System.currentTimeMillis()); flush(System.currentTimeMillis()) }
        }
        val n = notification()
        if (Build.VERSION.SDK_INT >= 29) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE) else startForeground(ID, n)
        if (!Pager.radioAllowed(this)) { Pager.setRadio(Pager.Radio.NO_PERMISSION); shutdown(); return START_NOT_STICKY }
        if (loop == null) start()
        return START_NOT_STICKY
    }

    private fun start() {
        Pager.setWanted(this, true)
        wake = getSystemService(PowerManager::class.java)?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "vrg:pager")?.also { it.setReferenceCounted(false); it.acquire(10 * 60 * 60 * 1000L) }
        val r = BleRadio(this) heard@{ raw, rssi, device ->
            val now = System.currentTimeMillis()
            val unit = engine.onAdvert(raw, rssi, now) ?: return@heard
            links?.maybeDial(unit, engine.peer(unit)?.psm ?: 0, device, now)
        }
        radio = r
        r.bluetoothAdapter?.let { a ->
            links = Links(a, crew = { engine.me.crew }, me = { engine.me.unit to engine.me.name },
                onUp = { u, name -> engine.linkUp(u, name, System.currentTimeMillis()) },
                onDown = { u -> engine.linkDown(u, System.currentTimeMillis()) },
                onMsg = { m, from ->
                    val now = System.currentTimeMillis()
                    if (m is LinkMsg.Voice || m is LinkMsg.VoiceEnd) voice.onVoice(m, now) else engine.onLink(m, from, now)
                })
        }
        startRadio()
        loop = scope.launch {
            var lastSlow = 0L
            var lastUi = 0L
            while (isActive) {
                val now = System.currentTimeMillis()
                try {
                    if (now - lastSlow >= 2_000) { lastSlow = now; slow(now) }
                    engine.psm = links?.psm ?: 0
                    engine.talking = Pager.transmitting.value
                    engine.tick(now)
                    voice.tick(now)
                    radio?.update(engine.beacon(now), engine.nameRecord())
                    flush(now)
                    if (now - lastUi >= 250) { lastUi = now; Pager.changed() }
                } catch (e: Exception) { VrgLog.w("pager", "tick: ${e.message}") }
                delay(100)
            }
        }
    }

    private fun startRadio() {
        val r = radio ?: return
        val now = System.currentTimeMillis()
        if (r.start(engine.beacon(now), engine.nameRecord())) {
            links?.start()
            linkIdentity = engine.me.unit to engine.me.crew.code
        }
    }

    /** Every 2 s: battery, Bluetooth on/off, screen duty, a changed crew or unit, the sensors, the notification. */
    private fun slow(now: Long) {
        engine.battery = getSystemService(BatteryManager::class.java)?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)?.takeIf { it in 0..100 } ?: 255
        val r = radio ?: return
        if (!r.enabled) { if (Pager.radio.value != Pager.Radio.NO_BT) { r.stop(); links?.stop(); Pager.setRadio(Pager.Radio.NO_BT) } }
        else if (Pager.radio.value == Pager.Radio.NO_BT || Pager.radio.value == Pager.Radio.OFF) startRadio()
        r.setLowPower(getSystemService(PowerManager::class.java)?.isInteractive == false)
        val id = engine.me.unit to engine.me.crew.code
        if (linkIdentity != null && id != linkIdentity) { links?.stop(); links?.start(); linkIdentity = id }
        val wantSensor = engine.guard.state != GuardState.OFF || engine.manDown.state != ManDownState.OFF
        if (wantSensor != sensing) sensors(wantSensor)
        if (engine.chats().size != lastChats) { lastChats = engine.chats().size; Pager.saveChats(this) }
        getSystemService(android.app.NotificationManager::class.java)?.notify(ID, notification())
    }

    private fun flush(now: Long) {
        for (e in engine.drain()) when (e) {
            is Effect.Haptic -> alerts.vibrate(e.pattern, e.repeat)
            is Effect.Tone -> alerts.tone(e.sound)
            Effect.Quiet -> alerts.quiet()
            is Effect.Notify -> alerts.notify(e.key, e.title, e.text, e.urgent)
            is Effect.ClearNotify -> alerts.clear(e.key)
            is Effect.Send -> links?.send(e.msg, e.to)
            is Effect.Banner -> Pager.banner.value = now to e.text
        }
    }

    private fun sensors(on: Boolean) {
        val sm = getSystemService(SensorManager::class.java) ?: return
        if (on) sm.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)?.let { sensing = sm.registerListener(this, it, SensorManager.SENSOR_DELAY_UI) }
        else { sm.unregisterListener(this); sensing = false }
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (event.sensor.type != Sensor.TYPE_ACCELEROMETER) return
        engine.sensor(Accel(event.values[0], event.values[1], event.values[2]), System.currentTimeMillis())
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    // ---- actions from the screen -----------------------------------------------------------------------------

    /** Push to talk; false = someone else is talking. */
    fun pttDown(): Boolean = voice.pttDown(System.currentTimeMillis())
    fun pttUp() = voice.pttUp()
    fun finderTick() = alerts.tick()
    fun quiet() = alerts.quiet()
    fun linkCount() = links?.count() ?: 0
    val linksSupported: Boolean get() = links?.supported == true

    private fun shutdown() {
        loop?.cancel(); loop = null
        sensors(false)
        Pager.saveChats(this)
        radio?.stop(); links?.stop(); voice.release(); alerts.quiet()
        wake?.let { if (it.isHeld) it.release() }; wake = null
        Pager.setRadio(Pager.Radio.OFF)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        if (loop != null) shutdown()
        alerts.release()
        scope.cancel()
        if (current === this) current = null
        super.onDestroy()
    }

    private fun notification(): Notification {
        val now = System.currentTimeMillis()
        val peers = engine.peers(now).count { it.ageMs < 15_000 || it.linked }
        val unseen = engine.unseen().size
        val title = "Csipogó · ${engine.me.crew.code} · ${engine.me.unit}. egység"
        val text = listOfNotNull(
            "$peers társ a közelben",
            if (unseen > 0) "$unseen új jelzés" else null,
            if (engine.guard.state != GuardState.OFF) "őrzés: ${engine.guard.state.hu}" else null,
            if (engine.manDown.state != ManDownState.OFF) "mozdulatlanság-figyelés" else null,
        ).joinToString(" · ")
        val open = PendingIntent.getActivity(this, 0,
            Intent(Intent.ACTION_VIEW, Uri.parse("vrg://pager")).setPackage(packageName)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE)
        val stop = PendingIntent.getService(this, 1, Intent(this, PagerService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE)
        val seen = PendingIntent.getService(this, 2, Intent(this, PagerService::class.java).setAction(ACTION_SEEN), PendingIntent.FLAG_IMMUTABLE)
        return Notification.Builder(this, Alerts.CH_RUN)
            .setSmallIcon(hu.vrg.mobile.kit.R.drawable.ic_vrg_notify)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(open)
            .setOngoing(true)
            .addAction(Notification.Action.Builder(null as android.graphics.drawable.Icon?, "LÁTTAM", seen).build())
            .addAction(Notification.Action.Builder(null as android.graphics.drawable.Icon?, "Kikapcsolás", stop).build())
            .build()
    }

    companion object {
        private const val ID = 47310
        const val ACTION_STOP = "hu.vrg.mobile.pager.STOP"
        const val ACTION_SEEN = "hu.vrg.mobile.pager.SEEN"

        @Volatile var current: PagerService? = null; private set

        /** Start (or refresh) the pager; only from a user tap on the screen. */
        fun start(ctx: Context) { ctx.startForegroundService(Intent(ctx, PagerService::class.java)) }
        fun stop(ctx: Context) { ctx.startService(Intent(ctx, PagerService::class.java).setAction(ACTION_STOP)) }
    }
}
