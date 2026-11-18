package hu.vrg.mobile.pager.app

import android.annotation.SuppressLint
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import hu.vrg.mobile.kit.VrgLog
import hu.vrg.mobile.pager.Adpcm
import hu.vrg.mobile.pager.Floor
import hu.vrg.mobile.pager.LinkMsg
import kotlin.concurrent.thread

// Adóvevő: push to talk. While the button (or the volume-down key) is held, the microphone is read in 20 ms
// blocks, ADPCM-coded and sent to every open link; the speaker plays whoever holds the floor, with a roger beep
// when they let go. Voice goes over direct links only (no relaying): a talk is for the people in reach.

class VoiceIo(private val send: (LinkMsg) -> Unit, private val myUnit: () -> Int) {
    val floor = Floor()
    @Volatile private var recording = false
    private var talk = 0
    private var track: AudioTrack? = null
    private val playLock = Any()

    fun busy(now: Long): Boolean = !floor.free(myUnit(), now)

    /** Starts talking; false when someone else holds the floor (the screen says FOGLALT). */
    @SuppressLint("MissingPermission")   // the screen asks for RECORD_AUDIO before it calls this
    fun pttDown(now: Long): Boolean {
        if (recording) return true
        if (busy(now)) return false
        recording = true
        talk = (talk + 1) and 0xFFFF
        val myTalk = talk
        Pager.transmitting.value = true
        thread(name = "pager-mic", isDaemon = true) {
            val min = AudioRecord.getMinBufferSize(Adpcm.RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
            val rec = try {
                AudioRecord(MediaRecorder.AudioSource.VOICE_COMMUNICATION, Adpcm.RATE, AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT, maxOf(min, Adpcm.BLOCK_SAMPLES * 2 * 8))
            } catch (e: Exception) { VrgLog.w("pager", "mic: ${e.message}"); recording = false; Pager.transmitting.value = false; return@thread }
            if (rec.state != AudioRecord.STATE_INITIALIZED) { rec.release(); recording = false; Pager.transmitting.value = false; return@thread }
            val enc = Adpcm.Encoder()
            val buf = ShortArray(Adpcm.BLOCK_SAMPLES)
            var n = 0
            try {
                rec.startRecording()
                while (recording) {
                    var got = 0
                    while (got < buf.size && recording) { val r = rec.read(buf, got, buf.size - got); if (r <= 0) break; got += r }
                    if (got < buf.size) break
                    send(LinkMsg.Voice(myUnit(), myTalk, n, enc.encode(buf)))
                    n = (n + 1) and 0xFFFF
                }
            } catch (e: Exception) { VrgLog.w("pager", "mic read: ${e.message}") }
            finally {
                runCatching { rec.stop() }; rec.release()
                send(LinkMsg.VoiceEnd(myUnit(), myTalk))
                recording = false
                Pager.transmitting.value = false
            }
        }
        return true
    }

    fun pttUp() { recording = false }

    /** A voice message from a link. */
    fun onVoice(m: LinkMsg, now: Long) {
        when (m) {
            is LinkMsg.Voice -> {
                if (recording) return                           // half duplex: I am talking
                if (!floor.heard(m.src, m.talk, now)) return
                Pager.talker.value = m.src
                val pcm = Adpcm.decode(m.block) ?: return
                play(pcm)
            }
            is LinkMsg.VoiceEnd -> if (floor.talker == m.src) { floor.ended(m.src); Pager.talker.value = null; play(Adpcm.roger()) }
            else -> {}
        }
    }

    /** Called from the service tick: a talker whose link dropped mid-talk lets go of the floor. */
    fun tick(now: Long) {
        floor.expire(now)
        if (floor.talker == null && Pager.talker.value != null) Pager.talker.value = null
    }

    private fun play(pcm: ShortArray) = synchronized(playLock) {
        val t = track ?: run {
            val min = AudioTrack.getMinBufferSize(Adpcm.RATE, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT)
            AudioTrack.Builder()
                .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                .setAudioFormat(AudioFormat.Builder().setSampleRate(Adpcm.RATE).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).setEncoding(AudioFormat.ENCODING_PCM_16BIT).build())
                .setTransferMode(AudioTrack.MODE_STREAM)
                .setBufferSizeInBytes(maxOf(min, Adpcm.BLOCK_SAMPLES * 2 * 6))
                .build().also { it.play(); track = it }
        }
        t.write(pcm, 0, pcm.size, AudioTrack.WRITE_NON_BLOCKING)
    }

    fun release() {
        recording = false
        synchronized(playLock) { track?.let { runCatching { it.stop() }; it.release() }; track = null }
    }
}
