package hu.vrg.mobile.kct

// The watch-face upload (Q7, built later on top of this; the chunker is part of Q0), as seen on 2026-11-22:
//   P→W  SETNEW,1,<total bytes>,                       W→P  RET,SETNEW,1,<block size>,1
//   P→W  SETNEW,2,<N>,<i>,<len>,<crc32>,<len bytes>    W→P  RET,SETNEW,2,<N>,<i>,1      for i = 1..N
// crc32 = standard CRC-32 (IEEE, reflected 0xEDB88320) of the block, written as a signed int32.

object SetNew {
    const val BLOCK = 4096

    /** The opening command's payload. */
    fun start(total: Int): String = "SETNEW,1,$total,"

    class Block(val index: Int, val count: Int, val data: ByteArray) {
        val crc: Int get() = Crc32.signed(data)
        /** The KCT payload of this block: the text part, then the raw bytes. */
        fun payload(): ByteArray = "SETNEW,2,$count,$index,${data.size},$crc,".toByteArray(Charsets.ISO_8859_1) + data
        fun frame(): ByteArray = Kct.cmd(payload())
    }

    /** The file cut into blocks of the size the watch asked for (RET,SETNEW,1,<size>,1), numbered from 1. */
    fun blocks(file: ByteArray, size: Int = BLOCK): List<Block> {
        require(size > 0)
        val n = (file.size + size - 1) / size
        return (0 until n).map { i -> Block(i + 1, n, file.copyOfRange(i * size, minOf(file.size, (i + 1) * size))) }
    }

    /** The block size from "RET,SETNEW,1,4096,1", null if the watch refused. */
    fun acceptedBlockSize(m: Msg): Int? =
        (m as? Msg.Ret)?.takeIf { it.cmd == "SETNEW" && it.n == 1 && it.args.getOrNull(1) == "1" }?.args?.getOrNull(0)?.toIntOrNull()

    /** The block number acknowledged by "RET,SETNEW,2,<N>,<i>,1", null for anything else. */
    fun ackedBlock(m: Msg): Int? =
        (m as? Msg.Ret)?.takeIf { it.cmd == "SETNEW" && it.n == 2 && it.args.getOrNull(2) == "1" }?.args?.getOrNull(1)?.toIntOrNull()
}

object Crc32 {
    private val table = IntArray(256) { n ->
        var c = n
        repeat(8) { c = if (c and 1 != 0) (0xEDB88320.toInt() xor (c ushr 1)) else c ushr 1 }
        c
    }

    fun of(data: ByteArray): Long = signed(data).toLong() and 0xFFFFFFFFL

    fun signed(data: ByteArray): Int {
        var c = -1
        for (b in data) c = table[(c xor b.toInt()) and 255] xor (c ushr 8)
        return c.inv()
    }
}

/**
 * A phone notification for the watch (Q5, later): MTK BT-Notifier XML in a DATA frame. Text goes into CDATA, split so
 * that a "]]>" inside it cannot end the section; names are XML-escaped. Nothing here logs or keeps the text.
 */
object NotifyXml {
    fun build(msgId: Int, sender: String, appId: String, title: String, content: String, timestampSec: Long): String =
        "<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><event_report><header><category>notification</category>" +
            "<subType>text</subType><msgId>$msgId</msgId><action>add</action></header><body><sender>${esc(sender)}</sender>" +
            "<appId>${esc(appId)}</appId><title>${cdata(title)}</title><content>${cdata(content)}</content>" +
            "<timestamp>$timestampSec</timestamp></body></event_report>"

    fun frame(xml: String): ByteArray {
        val p = xml.toByteArray(Charsets.UTF_8)
        return Frame.encode("DATA ${p.size}", p)
    }

    fun esc(s: String): String = buildString {
        for (c in s) when (c) {
            '&' -> append("&amp;"); '<' -> append("&lt;"); '>' -> append("&gt;")
            '"' -> append("&quot;"); '\'' -> append("&apos;")
            else -> if (c.code < 0x20 && c != '\t' && c != '\n') append(' ') else append(c)
        }
    }

    fun cdata(s: String): String = "<![CDATA[" + s.replace("]]>", "]]]]><![CDATA[>") + "]]>"
}
