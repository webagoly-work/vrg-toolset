package hu.vrg.mobile.pager

import java.security.MessageDigest
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

// The wire. The pager's third-unit plan fixed an 8-byte payload [type, arg, src, dst, seq, ttl, crew, 0x5A] so
// three or more units can share one channel; the phone carries exactly that frame inside a Bluetooth LE
// advertisement, with the transmitting phone's presence around it and a crew MAC after it:
//
//   manufacturer data, company 0xFFFF (the SIG's test id: a closed crew tool, never a product), 23 bytes:
//    0  'V'  1 'P'           magic
//    2  ver << 4 | flags     flags: 1 link open, 2 talking (PTT), 4 guard armed, 8 alarm
//    3  txUnit               the phone sending this beacon (a relayed frame keeps its own src)
//    4–11 frame              [type, arg, src, dst, seq, ttl, crew, 0x5A]
//   12  battery %            255 = unknown
//   13  tx@1m                signed dBm the sender is heard with at 1 m (calibration)
//   14–15 psm                L2CAP channel for chat and voice, 0 = none (big-endian)
//   16  ackSrc  17 ackSeq    fast-path GOTIT: txUnit received (ackSrc, ackSeq); ackSrc 0 = none
//   18  minute               epoch minutes mod 256: a recorded beacon replayed later is refused
//   19–22 mac                HMAC-SHA256(crew key, bytes 0–18), first 4 bytes
//
// The builder's lesson about fixed-code fobs ("a recorded press can be replayed") is why the MAC and the minute are
// there: a stranger's phone cannot send KAPCSOLD FEL into a crew, and a sniffed one cannot be played back later.

const val BROADCAST = 0
const val FRAME_TAIL = 0x5A
const val MAX_TTL = 2
const val MAX_UNIT = 30
const val COMPANY_ID = 0xFFFF

data class Frame(
    val type: Int,
    val arg: Int,
    val src: Int,
    val dst: Int,
    val seq: Int,
    val ttl: Int,
    val crew: Int,
) {
    val ptype: PType? get() = PType.of(type)

    fun bytes(): ByteArray = byteArrayOf(type.b, arg.b, src.b, dst.b, seq.b, ttl.b, crew.b, FRAME_TAIL.toByte())

    /** For me, or for everyone. */
    fun addressedTo(unit: Int) = dst == BROADCAST || dst == unit

    /** The identity used for de-duplication and acknowledgement. */
    val key: Long get() = (src.toLong() shl 8) or seq.toLong()

    companion object {
        fun parse(b: ByteArray, off: Int = 0): Frame? {
            if (b.size < off + 8 || b[off + 7].u != FRAME_TAIL) return null
            return Frame(b[off].u, b[off + 1].u, b[off + 2].u, b[off + 3].u, b[off + 4].u, b[off + 5].u, b[off + 6].u)
        }
    }
}

/** A crew: the code everyone types in (or opens as vrg://pager?crew=…), its one-byte id and its MAC key. */
class Crew(code: String) {
    val code: String = normalise(code)
    val key: ByteArray = sha256("vrg-pager:1:${this.code}".toByteArray())
    val id: Int = sha256("vrg-pager-id:${this.code}".toByteArray())[0].u

    fun mac(data: ByteArray, from: Int = 0, len: Int = data.size): ByteArray {
        val m = Mac.getInstance("HmacSHA256")
        m.init(SecretKeySpec(key, "HmacSHA256"))
        m.update(data, from, len)
        return m.doFinal()
    }

    companion object {
        const val DEFAULT = "VRG"
        fun normalise(code: String): String = code.trim().uppercase().replace(Regex("\\s+"), "-").ifEmpty { DEFAULT }
        internal fun sha256(b: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(b)
    }
}

object Flags {
    const val LINK = 1
    const val TALK = 2
    const val ARMED = 4
    const val ALARM = 8
}

data class Beacon(
    val flags: Int,
    val txUnit: Int,
    val frame: Frame,
    val battery: Int,
    val tx1m: Int,
    val psm: Int,
    val ackSrc: Int,
    val ackSeq: Int,
    val minute: Int,
) {
    fun encode(crew: Crew): ByteArray {
        val b = ByteArray(SIZE)
        b[0] = 'V'.code.toByte(); b[1] = 'P'.code.toByte()
        b[2] = ((VERSION shl 4) or (flags and 0x0F)).toByte()
        b[3] = txUnit.b
        frame.bytes().copyInto(b, 4)
        b[12] = battery.coerceIn(0, 255).b
        b[13] = tx1m.coerceIn(-128, 127).toByte()
        b[14] = (psm shr 8).b; b[15] = psm.b
        b[16] = ackSrc.b; b[17] = ackSeq.b
        b[18] = minute.b
        crew.mac(b, 0, MAC_AT).copyInto(b, MAC_AT, 0, 4)
        return b
    }

    companion object {
        const val VERSION = 1
        const val SIZE = 23
        private const val MAC_AT = 19

        sealed class Result {
            data class Ok(val beacon: Beacon) : Result()
            /** Ours, but another crew (or a wrong code): shown as a count, never as a person. */
            data object OtherCrew : Result()
            /** Right crew, but its minute is more than two off: replayed, or a phone with a wrong clock. */
            data object Stale : Result()
            data object NotOurs : Result()
        }

        fun minuteOf(nowMs: Long): Int = ((nowMs / 60_000L) and 0xFF).toInt()

        fun decode(b: ByteArray?, crew: Crew, nowMs: Long): Result {
            if (b == null || b.size < SIZE || b[0] != 'V'.code.toByte() || b[1] != 'P'.code.toByte() || (b[2].u shr 4) != VERSION) return Result.NotOurs
            val frame = Frame.parse(b, 4) ?: return Result.NotOurs
            val mac = crew.mac(b, 0, MAC_AT)
            if (frame.crew != crew.id || (0 until 4).any { mac[it] != b[MAC_AT + it] }) return Result.OtherCrew
            val minute = b[18].u
            val d = (minuteOf(nowMs) - minute + 256) % 256
            if (d > 2 && d < 254) return Result.Stale
            return Result.Ok(Beacon(b[2].u and 0x0F, b[3].u, frame, b[12].u, b[13].toInt(), (b[14].u shl 8) or b[15].u, b[16].u, b[17].u, minute))
        }
    }
}

/** The scan response: who the phone is, in words (the beacon itself has no room for a name). */
object NameRecord {
    fun encode(unit: Int, name: String): ByteArray {
        val head = byteArrayOf('V'.code.toByte(), 'N'.code.toByte(), unit.b)
        return head + utf8Prefix(name, 20)
    }

    fun decode(b: ByteArray?): Pair<Int, String>? {
        if (b == null || b.size < 3 || b[0] != 'V'.code.toByte() || b[1] != 'N'.code.toByte()) return null
        return b[2].u to String(b, 3, b.size - 3, Charsets.UTF_8)
    }

    /** The longest prefix of [s] that fits in [max] bytes without splitting a character. */
    fun utf8Prefix(s: String, max: Int): ByteArray {
        val out = StringBuilder()
        var used = 0
        var i = 0
        while (i < s.length) {
            val cp = s.codePointAt(i)
            val n = String(Character.toChars(cp)).toByteArray(Charsets.UTF_8).size
            if (used + n > max) break
            out.appendCodePoint(cp); used += n; i += Character.charCount(cp)
        }
        return out.toString().toByteArray(Charsets.UTF_8)
    }
}

/**
 * Raw advertisement bytes (advertisement + scan response, as Android's ScanRecord.getBytes() gives them) → every
 * manufacturer-data entry for [company]. Parsed by hand because Android's own map keeps only the last entry per
 * company, and the beacon and the name record share one.
 */
object AdParser {
    fun manufacturer(raw: ByteArray?, company: Int = COMPANY_ID): List<ByteArray> {
        if (raw == null) return emptyList()
        val out = ArrayList<ByteArray>()
        var i = 0
        while (i < raw.size) {
            val len = raw[i].u
            if (len == 0) break
            if (i + 1 + len > raw.size) break          // a truncated structure: stop, never read past the end
            val type = raw[i + 1].u
            if (type == 0xFF && len >= 3) {
                val id = raw[i + 2].u or (raw[i + 3].u shl 8)
                if (id == company) out += raw.copyOfRange(i + 4, i + 1 + len)
            }
            i += 1 + len
        }
        return out
    }

    /** Builds the AD structure Android would put on the air; for tests and the simulator. */
    fun manufacturerAd(data: ByteArray, company: Int = COMPANY_ID): ByteArray =
        byteArrayOf((data.size + 3).b, 0xFF.toByte(), company.b, (company shr 8).b) + data
}

internal val Byte.u: Int get() = toInt() and 0xFF
internal val Int.b: Byte get() = (this and 0xFF).toByte()
