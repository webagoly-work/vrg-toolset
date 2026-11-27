package hu.vrg.mobile.kct

// The 18A0 frame of a MediaTek wearable (the Q71 and other KCT / FunDo watches), decoded 2026-11-22 from FunDo's
// libCommand.so (WP M65, notes/q71-watch/PROTOCOL-2026-11-22.md):
//
//   F0 F0 F0 F1 | u32 big-endian n | n bytes = RC4(KEY, "<TYPE> <args>\0") | payload (plain)
//
// RC4 is textbook RC4, re-keyed for every frame, and the header's NUL is encrypted too. TYPE is one of DATA SYNC MAPX
// MAPD CAPC MREE EXCD from the phone, and VERN ACKY MREE EXCD from the watch. The header's last number is the payload's
// length in bytes, except for SYNC (the time and the version request carry no payload).

object Frame {
    val MAGIC = byteArrayOf(0xF0.toByte(), 0xF0.toByte(), 0xF0.toByte(), 0xF1.toByte())

    /** MediaTek's built-in default key: the 129-character sentence stored in libCommand.so, plus its NUL (130 bytes). */
    val KEY: ByteArray = ("we had everything before us, we had nothing before us, we were all going direct to Heaven, " +
        "we were all going direct the other way").toByteArray(Charsets.ISO_8859_1) + byteArrayOf(0)

    fun rc4(data: ByteArray, key: ByteArray = KEY): ByteArray {
        val s = IntArray(256) { it }
        var j = 0
        for (i in 0 until 256) {
            j = (j + s[i] + (key[i % key.size].toInt() and 255)) and 255
            val t = s[i]; s[i] = s[j]; s[j] = t
        }
        val out = ByteArray(data.size)
        var i = 0; j = 0
        for (n in data.indices) {
            i = (i + 1) and 255
            j = (j + s[i]) and 255
            val t = s[i]; s[i] = s[j]; s[j] = t
            out[n] = (data[n].toInt() xor s[(s[i] + s[j]) and 255]).toByte()
        }
        return out
    }

    /** A header (without the NUL) and its payload as one frame. */
    fun encode(header: String, payload: ByteArray = ByteArray(0)): ByteArray {
        val h = rc4(header.toByteArray(Charsets.ISO_8859_1) + byteArrayOf(0))
        return MAGIC + be32(h.size) + h + payload
    }

    fun encode(header: String, payload: String): ByteArray = encode(header, payload.toByteArray(Charsets.UTF_8))

    /** A whole frame back to header + payload; null if it does not start with the magic or is cut short. */
    fun decode(buf: ByteArray): Decoded? {
        if (buf.size < 8 || !startsWithMagic(buf, 0)) return null
        val n = readBe32(buf, 4)
        if (n < 1 || 8 + n > buf.size) return null
        val header = String(rc4(buf.copyOfRange(8, 8 + n)), Charsets.ISO_8859_1).removeSuffix("\u0000")
        return Decoded(header, buf.copyOfRange(8 + n, buf.size))
    }

    /** How many payload bytes follow a header: its last number, none for SYNC. */
    fun payloadLength(header: String): Int {
        val parts = header.trim().split(' ')
        if (parts.firstOrNull() == "SYNC") return 0
        return parts.lastOrNull()?.toIntOrNull()?.takeIf { it >= 0 } ?: 0
    }

    internal fun startsWithMagic(b: ByteArray, at: Int): Boolean =
        at + 4 <= b.size && (0..3).all { b[at + it] == MAGIC[it] }

    internal fun be32(v: Int) = byteArrayOf((v ushr 24).toByte(), (v ushr 16).toByte(), (v ushr 8).toByte(), v.toByte())

    internal fun readBe32(b: ByteArray, at: Int): Int =
        ((b[at].toInt() and 255) shl 24) or ((b[at + 1].toInt() and 255) shl 16) or
            ((b[at + 2].toInt() and 255) shl 8) or (b[at + 3].toInt() and 255)
}

class Decoded(val header: String, val payload: ByteArray) {
    val type: String get() = header.substringBefore(' ')
    val text: String get() = String(payload, Charsets.UTF_8)
    override fun toString() = "[$header] ${payload.size} B"
}

/**
 * Glues ATT reads (watch → phone) or writes (phone → watch) back into frames. A big frame spans several reads, and one
 * read can end one frame and begin the next (seen in the 2026-11-22 capture), so this is a byte stream cut by the
 * header's payload length. Bytes before a magic are dropped (resync after a lost read).
 */
class Reassembler(private val maxFrame: Int = 1 shl 20) {
    private var buf = ByteArray(0)
    var dropped = 0
        private set

    /** Adds one ATT value; returns every frame it completed, in order. */
    fun push(chunk: ByteArray): List<Decoded> {
        if (chunk.isNotEmpty()) buf += chunk
        val out = mutableListOf<Decoded>()
        while (true) {
            val at = findMagic()
            if (at < 0) { keepTail(); break }
            if (at > 0) { dropped += at; buf = buf.copyOfRange(at, buf.size) }
            if (buf.size < 8) break
            val n = Frame.readBe32(buf, 4)
            if (n !in 1..1024) { dropped += 4; buf = buf.copyOfRange(4, buf.size); continue }
            if (buf.size < 8 + n) break
            val header = String(Frame.rc4(buf.copyOfRange(8, 8 + n)), Charsets.ISO_8859_1).removeSuffix("\u0000")
            val total = 8 + n + Frame.payloadLength(header)
            if (total > maxFrame) { dropped += 4; buf = buf.copyOfRange(4, buf.size); continue }
            if (buf.size < total) break
            out += Decoded(header, buf.copyOfRange(8 + n, total))
            buf = buf.copyOfRange(total, buf.size)
        }
        return out
    }

    /** Bytes still waiting for the rest of their frame. */
    val pending: Int get() = buf.size

    /** Zero padding after a frame (the watch pads reads) is not the start of anything. */
    val pendingIsPadding: Boolean get() = buf.all { it.toInt() == 0 }

    fun reset() { buf = ByteArray(0) }

    private fun findMagic(): Int {
        for (i in 0..buf.size - 4) if (Frame.startsWithMagic(buf, i)) return i
        return -1
    }

    // no magic: keep at most the last 3 bytes, a magic may be split across two reads
    private fun keepTail() {
        if (buf.size > 3) { dropped += buf.size - 3; buf = buf.copyOfRange(buf.size - 3, buf.size) }
    }
}

/** A frame cut into ATT writes: FunDo writes at most 512 bytes at a time (an ATT value's limit), `mtu - 3` below it. */
fun ByteArray.attChunks(mtu: Int): List<ByteArray> {
    val step = minOf(512, maxOf(20, mtu - 3))
    return (indices step step).map { copyOfRange(it, minOf(size, it + step)) }
}
