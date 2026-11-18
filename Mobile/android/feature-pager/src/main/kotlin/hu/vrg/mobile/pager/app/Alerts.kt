package hu.vrg.mobile.pager.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.ToneGenerator
import android.net.Uri
import android.os.Build
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.kit.VrgNotify
import hu.vrg.mobile.pager.Sound

// What a page feels and sounds like: the pager's vibration motor and piezo become the phone's vibrator and an
// alarm-stream tone; its OLED line becomes a notification with LÁTTAM on it, so SEEN can be answered from the
// lock screen. Alarms go out on the alarm stream, so a phone on silent still rings for RIASZTÁS.

class Alerts(private val ctx: Context) {
    private val vibrator: Vibrator? = if (Build.VERSION.SDK_INT >= 31)
        ctx.getSystemService(VibratorManager::class.java)?.defaultVibrator
    else oldVibrator(ctx)

    @Suppress("DEPRECATION")
    private fun oldVibrator(c: Context): Vibrator? = c.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator

    @Suppress("DEPRECATION")
    private fun oldVibrate(v: Vibrator, effect: VibrationEffect) =
        v.vibrate(effect, AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build())

    private val tones: ToneGenerator? = runCatching { ToneGenerator(AudioManager.STREAM_ALARM, 85) }.getOrNull()
    private val soft: ToneGenerator? = runCatching { ToneGenerator(AudioManager.STREAM_NOTIFICATION, 70) }.getOrNull()

    fun vibrate(pattern: LongArray, repeat: Boolean) {
        val v = vibrator ?: return
        if (!v.hasVibrator()) return
        val effect = VibrationEffect.createWaveform(pattern, if (repeat) 0 else -1)
        runCatching {
            if (Build.VERSION.SDK_INT >= 33) v.vibrate(effect, VibrationAttributes.createForUsage(VibrationAttributes.USAGE_ALARM))
            else oldVibrate(v, effect)
        }
    }

    fun tone(s: Sound) {
        runCatching {
            when (s) {
                Sound.PAGE -> soft?.startTone(ToneGenerator.TONE_PROP_BEEP2, 300)
                Sound.URGENT -> tones?.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 1_200)
                Sound.ALARM -> tones?.startTone(ToneGenerator.TONE_CDMA_EMERGENCY_RINGBACK, 3_000)
                Sound.CALL -> tones?.startTone(ToneGenerator.TONE_SUP_RINGTONE, 1_500)
                Sound.CHIRP -> soft?.startTone(ToneGenerator.TONE_PROP_ACK, 40)
                Sound.OK -> soft?.startTone(ToneGenerator.TONE_PROP_ACK, 120)
                Sound.FAIL -> soft?.startTone(ToneGenerator.TONE_PROP_NACK, 300)
            }
        }
    }

    /** The finder's sonar tick. */
    fun tick() { runCatching { soft?.startTone(ToneGenerator.TONE_PROP_BEEP, 35) } }

    fun quiet() {
        runCatching { vibrator?.cancel() }
        runCatching { tones?.stopTone() }
    }

    fun notify(key: String, title: String, text: String, urgent: Boolean) {
        if (!VrgNotify.allowed(ctx)) return
        val open = PendingIntent.getActivity(ctx, key.hashCode(),
            Intent(Intent.ACTION_VIEW, Uri.parse("vrg://pager")).setPackage(ctx.packageName)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE)
        val seen = PendingIntent.getService(ctx, 7, Intent(ctx, PagerService::class.java).setAction(PagerService.ACTION_SEEN),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val n = NotificationCompat.Builder(ctx, if (urgent) CH_ALARM else CH_PAGE)
            .setSmallIcon(hu.vrg.mobile.kit.R.drawable.ic_vrg_notify)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setCategory(if (urgent) NotificationCompat.CATEGORY_ALARM else NotificationCompat.CATEGORY_MESSAGE)
            .setPriority(if (urgent) NotificationCompat.PRIORITY_MAX else NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(open)
            .setAutoCancel(true)
            .addAction(0, "LÁTTAM", seen)
            .build()
        try { NotificationManagerCompat.from(ctx).notify(key, ID_PAGES, n) } catch (e: SecurityException) { VrgLog.w("pager", "notify: ${e.message}") }
    }

    fun clear(key: String) { NotificationManagerCompat.from(ctx).cancel(key, ID_PAGES) }

    fun release() { quiet(); tones?.release(); soft?.release() }

    companion object {
        const val CH_RUN = "pager-run"
        const val CH_PAGE = "pager"
        const val CH_ALARM = "pager-alarm"
        const val ID_PAGES = 47311

        fun channels(ctx: Context) {
            val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
            nm.createNotificationChannel(NotificationChannel(CH_RUN, "Csipogó (fut)", NotificationManager.IMPORTANCE_LOW))
            nm.createNotificationChannel(NotificationChannel(CH_PAGE, "Csipogó üzenetek", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Hívás, gyors üzenet, csevegés a csapattól"; enableVibration(false); setSound(null, null)
            })
            nm.createNotificationChannel(NotificationChannel(CH_ALARM, "Csipogó riasztás", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Sürgős üzenet, őrzés riasztás, mozdulatlanság"; enableVibration(false); setSound(null, null)
            })
        }
    }
}
