package hu.vrg.mobile.pager

import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.security.SecureRandom

// The link: a Bluetooth LE L2CAP channel between two phones (its PSM rides in the beacon), for what does not fit in
// an advertisement: chat text and walkie-talkie voice, plus the pager frames again for a faster path. One stream,
// framed as [u16 length][u8 kind][body]. Both sides prove the crew first (HELLO with a nonce, AUTH = HMAC of the
// other's nonce); nothing else is accepted before that. The channel itself is Android's "insecure" L2CAP (no
// Bluetooth bonding, so no pairing dialog on site): the crew proof keeps strangers out, it does not hide the talk.

sealed class LinkMsg {
    data class Hello(val unit: Int, val crewId: Int, val nonce: ByteArray, val name: String) : LinkMsg()
    data class Auth(val proof: ByteArray) : LinkMsg()
    data class FrameMsg(val frame: Frame) : LinkMsg()
    data class Chat(val src: Int, val dst: Int, val seq: Int, val ttl: Int, val at: Long, val text: String) : LinkMsg() {
        val key: Long get() = (src.toLong() shl 16) or seq.toLong()
    }
    data class ChatAck(val from: Int, val src: Int, val seq: Int) : LinkMsg()
    data class Voice(val src: Int, val talk: Int, val n: Int, val block: ByteArray) : LinkMsg()
    data class VoiceEnd(val src: Int, val talk: Int) : LinkMsg()
}

object LinkCodec {
    const val MAX_BODY = 1_024
    const val MAX_TEXT_BYTES = 600

    private const val HELLO = 1
    private const val AUTH = 2
    private const val FRAME = 3
    private const val CHAT = 4
    private const val CHAT_ACK = 5
    private const val VOICE = 6
    private const val VOICE_END = 7

    fun encode(m: LinkMsg): ByteArray {
        val body = ByteArrayOutputStream()
        val d = DataOutputStream(body)
        val kind = when (m) {
            is LinkMsg.Hello -> { d.writeByte(m.unit); d.writeByte(m.crewId); d.write(m.nonce.copyOf(8)); d.write(NameRecord.utf8Prefix(m.name, 40)); HELLO }
            is LinkMsg.Auth -> { d.write(m.proof.copyOf(16)); AUTH }
            is LinkMsg.FrameMsg -> { d.write(m.frame.bytes()); FRAME }
            is LinkMsg.Chat -> {
                d.writeByte(m.src); d.writeByte(m.dst); d.writeShort(m.seq); d.writeByte(m.ttl); d.writeLong(m.at)
                d.write(NameRecord.utf8Prefix(m.text, MAX_TEXT_BYTES)); CHAT
            }
            is LinkMsg.ChatAck -> { d.writeByte(m.from); d.writeByte(m.src); d.writeShort(m.seq); CHAT_ACK }
            is LinkMsg.Voice -> { d.writeByte(m.src); d.writeShort(m.talk); d.writeShort(m.n); d.write(m.block); VOICE }
            is LinkMsg.VoiceEnd -> { d.writeByte(m.src); d.writeShort(m.talk); VOICE_END }
        }
        d.flush()
        val b = body.toByteArray()
        val out = ByteArrayOutputStream(b.size + 3)
        DataOutputStream(out).apply { writeShort(b.size + 1); writeByte(kind); write(b); flush() }
        return out.toByteArray()
    }

    fun write(out: OutputStream, m: LinkMsg) { out.write(encode(m)); out.flush() }

    /** Reads one message; null at a clean end of stream. Throws on a malformed one (the link is then closed). */
    fun read(input: InputStream): LinkMsg? {
        val d = DataInputStream(input)
        val hi = d.read()
        if (hi < 0) return null
        val len = (hi shl 8) or d.readUnsignedByte()
        if (len < 1 || len > MAX_BODY + 1) throw IllegalStateException("link: bad length $len")
        val buf = ByteArray(len)
        d.readFully(buf)
        return parse(buf[0].toInt() and 0xFF, buf.copyOfRange(1, len))
    }

    fun parse(kind: Int, b: ByteArray): LinkMsg {
        val d = DataInputStream(b.inputStream())
        fun rest(): ByteArray = d.readBytes()
        return when (kind) {
            HELLO -> LinkMsg.Hello(d.readUnsignedByte(), d.readUnsignedByte(), ByteArray(8).also { d.readFully(it) }, String(rest(), Charsets.UTF_8))
            AUTH -> LinkMsg.Auth(ByteArray(16).also { d.readFully(it) })
            FRAME -> LinkMsg.FrameMsg(Frame.parse(ByteArray(8).also { d.readFully(it) }) ?: throw IllegalStateException("link: bad frame"))
            CHAT -> LinkMsg.Chat(d.readUnsignedByte(), d.readUnsignedByte(), d.readUnsignedShort(), d.readUnsignedByte(), d.readLong(), String(rest(), Charsets.UTF_8))
            CHAT_ACK -> LinkMsg.ChatAck(d.readUnsignedByte(), d.readUnsignedByte(), d.readUnsignedShort())
            VOICE -> LinkMsg.Voice(d.readUnsignedByte(), d.readUnsignedShort(), d.readUnsignedShort(), rest())
            VOICE_END -> LinkMsg.VoiceEnd(d.readUnsignedByte(), d.readUnsignedShort())
            else -> throw IllegalStateException("link: unknown kind $kind")
        }
    }
}

/**
 * One side of the crew proof. Send [hello] first; feed the peer's Hello to [onHello], which returns the Auth to send;
 * feed the peer's Auth to [onAuth]. [trusted] turns true only when the peer proved it knows the crew key.
 */
class LinkHandshake(private val crew: Crew, private val myUnit: Int, myName: String, random: SecureRandom = SecureRandom()) {
    private val nonce = ByteArray(8).also { random.nextBytes(it) }
    val hello = LinkMsg.Hello(myUnit, crew.id, nonce, myName)
    var peer: LinkMsg.Hello? = null; private set
    var trusted = false; private set

    fun onHello(h: LinkMsg.Hello): LinkMsg.Auth? {
        if (h.crewId != crew.id || h.unit !in 1..MAX_UNIT || h.unit == myUnit) return null
        peer = h
        return LinkMsg.Auth(proof(h.nonce, myUnit))
    }

    fun onAuth(a: LinkMsg.Auth): Boolean {
        val p = peer ?: return false
        trusted = proof(nonce, p.unit).contentEquals(a.proof)
        return trusted
    }

    private fun proof(n: ByteArray, unit: Int): ByteArray =
        crew.mac("vrg-pager-link:1".toByteArray() + n + byteArrayOf(unit.toByte())).copyOf(16)
}
