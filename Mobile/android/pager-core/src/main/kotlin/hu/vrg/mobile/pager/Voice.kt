package hu.vrg.mobile.pager

// Adóvevő (walkie-talkie): 8 kHz mono speech in 20 ms blocks, IMA ADPCM at 4 bits a sample: 160 samples → 80
// bytes plus a 3-byte header (predictor, step index), so every block decodes on its own and a lost block costs
// 20 ms, never the rest of the talk. 32 kbit/s fits a Bluetooth LE L2CAP channel with room to spare, needs no
// codec the phone may lack (Opus encoding arrived only in Android 10), and is plain Kotlin the JVM tests run.
//
// Half duplex, like a PMR radio: [Floor] says who is talking, and a press while someone else talks is refused.

object Adpcm {
    const val RATE = 8_000
    const val BLOCK_SAMPLES = 160
    const val BLOCK_BYTES = 3 + BLOCK_SAMPLES / 2

    private val INDEX = intArrayOf(-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8)
    private val STEP = intArrayOf(
        7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97,
        107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796,
        876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428,
        4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350,
        22385, 24623, 27086, 29794, 32767,
    )

    /** Encoder state carries across blocks (better prediction); each block still writes it into its header. */
    class Encoder {
        private var predictor = 0
        private var index = 0

        fun encode(pcm: ShortArray, from: Int = 0): ByteArray {
            require(pcm.size - from >= BLOCK_SAMPLES) { "a block is $BLOCK_SAMPLES samples" }
            val out = ByteArray(BLOCK_BYTES)
            out[0] = predictor.toByte(); out[1] = (predictor shr 8).toByte(); out[2] = index.toByte()
            for (i in 0 until BLOCK_SAMPLES) {
                val nib = step(pcm[from + i].toInt())
                val at = 3 + i / 2
                out[at] = if (i % 2 == 0) (nib and 0x0F).toByte() else (out[at].toInt() or (nib shl 4)).toByte()
            }
            return out
        }

        private fun step(sample: Int): Int {
            val st = STEP[index]
            var diff = sample - predictor
            var nib = 0
            if (diff < 0) { nib = 8; diff = -diff }
            var delta = st shr 3
            if (diff >= st) { nib = nib or 4; diff -= st; delta += st }
            if (diff >= st shr 1) { nib = nib or 2; diff -= st shr 1; delta += st shr 1 }
            if (diff >= st shr 2) { nib = nib or 1; delta += st shr 2 }
            predictor = (if (nib and 8 != 0) predictor - delta else predictor + delta).coerceIn(-32768, 32767)
            index = (index + INDEX[nib]).coerceIn(0, STEP.size - 1)
            return nib
        }
    }

    /** A block → 160 samples; null for a block of the wrong size. */
    fun decode(block: ByteArray): ShortArray? {
        if (block.size != BLOCK_BYTES) return null
        var predictor = ((block[0].toInt() and 0xFF) or (block[1].toInt() shl 8)).toShort().toInt()
        var index = (block[2].toInt() and 0xFF).coerceIn(0, STEP.size - 1)
        val out = ShortArray(BLOCK_SAMPLES)
        for (i in 0 until BLOCK_SAMPLES) {
            val byte = block[3 + i / 2].toInt() and 0xFF
            val nib = if (i % 2 == 0) byte and 0x0F else byte shr 4
            val st = STEP[index]
            var delta = st shr 3
            if (nib and 4 != 0) delta += st
            if (nib and 2 != 0) delta += st shr 1
            if (nib and 1 != 0) delta += st shr 2
            predictor = (if (nib and 8 != 0) predictor - delta else predictor + delta).coerceIn(-32768, 32767)
            index = (index + INDEX[nib]).coerceIn(0, STEP.size - 1)
            out[i] = predictor.toShort()
        }
        return out
    }

    /** The "roger" beep at the end of a talk: 120 ms of 1.2 kHz, quiet. */
    fun roger(): ShortArray = ShortArray(RATE * 120 / 1000) { i ->
        val env = minOf(1.0, minOf(i, RATE * 120 / 1000 - i) / 80.0)
        (kotlin.math.sin(2 * Math.PI * 1_200 * i / RATE) * 6_000 * env).toInt().toShort()
    }
}

/** Who has the channel. A talker that sends nothing for [holdMs] has let go (lost link, crashed app). */
class Floor(private val holdMs: Long = 700) {
    var talker: Int? = null; private set
    var talkSeq: Int = -1; private set
    private var lastAt = 0L

    /** A voice block heard from [unit]; false = someone else has the floor, drop the block. */
    fun heard(unit: Int, seq: Int, now: Long): Boolean {
        expire(now)
        val t = talker
        if (t != null && t != unit) return false
        talker = unit; talkSeq = seq; lastAt = now
        return true
    }

    fun ended(unit: Int) { if (talker == unit) talker = null }

    /** May I press PTT now? */
    fun free(me: Int, now: Long): Boolean { expire(now); return talker == null || talker == me }

    fun expire(now: Long) { if (talker != null && now - lastAt > holdMs) talker = null }
}
