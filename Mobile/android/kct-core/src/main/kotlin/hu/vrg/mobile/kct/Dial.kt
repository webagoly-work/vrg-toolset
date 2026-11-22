package hu.vrg.mobile.kct

// The Q71 watch-face .bin (notes/q71-watch/DIAL-FORMAT.md), little-endian:
//   0x00 header (64 B): magic F594D682, face id, file size, record table at 0x40, … , 0x24 width, 0x26 height
//   0x40 element records, 0x80 B each, until type 0 or the first data offset:
//        +0 type, +2 fmt, +4 x, +6 y, +12 data offset, +20 bytes per frame, +24 frame count, +26 flags
//   data: per frame u16 w | u16 h | u32 n (= w·h·2) | n bytes RGB565 LE, row-major
// The reader keeps every byte it does not understand (header, record tails), so read → write is byte-exact for a
// file laid out like FunDo's. Faces are made on the PC (D-171); the phone reads them to show and upload them.

object Dial {
    const val MAGIC = 0xF594D682.toInt()
    const val HEADER = 0x40
    const val RECORD = 0x80

    enum class Kind(val type: Int, val hu: String) {
        PREVIEW(0x0001, "előnézet"), BACKGROUND(0x0002, "háttér"), STATIC(0x0004, "kép"),
        DAY(0x0810, "nap"), WEEKDAY(0x0811, "hét napja"), HOUR(0x0814, "óra"), MINUTE(0x0816, "perc");
        companion object { fun of(t: Int) = entries.firstOrNull { it.type == t } }
    }

    class Image(val w: Int, val h: Int, val rgb565: ByteArray)

    class Element(
        val type: Int, val fmt: Int, val x: Int, val y: Int,
        /** Elements with the same [share] key point at the same data (hour and minute digits). */
        val share: Int,
        val frames: List<Image>,
        /** The record's bytes as read; the known fields are rewritten over it. */
        val raw: ByteArray = ByteArray(RECORD),
    ) {
        val kind: Kind? get() = Kind.of(type)
        val frameBytes: Int get() = frames.firstOrNull()?.let { 8 + it.w * it.h * 2 } ?: 0
    }

    class Face(val id: Int, val width: Int, val height: Int, val elements: List<Element>, val rawHeader: ByteArray = ByteArray(HEADER))

    fun read(b: ByteArray): Face {
        require(b.size >= HEADER && u32(b, 0) == MAGIC) { "nem Q71 számlap (magic)" }
        val els = mutableListOf<Element>()
        var o = HEADER
        var firstData = b.size
        while (o + RECORD <= b.size && o < firstData) {
            val type = u16(b, o); if (type == 0) break
            val off = u32(b, o + 12); val len = u32(b, o + 20); val count = u16(b, o + 24)
            require(off >= 0 && len >= 8 && off.toLong() + count.toLong() * len <= b.size) { "hibás elem #${els.size}" }
            firstData = minOf(firstData, off)
            val frames = (0 until count).map { i ->
                val f = off + i * len
                val w = u16(b, f); val h = u16(b, f + 2); val n = u32(b, f + 4)
                require(n == w * h * 2 && n + 8 <= len) { "hibás képkocka #${els.size}/$i" }
                Image(w, h, b.copyOfRange(f + 8, f + 8 + n))
            }
            els += Element(type, u16(b, o + 2), u16(b, o + 4), u16(b, o + 6), off, frames, b.copyOfRange(o, o + RECORD))
            o += RECORD
        }
        return Face(u32(b, 4), u16(b, 0x24), u16(b, 0x26), els, b.copyOfRange(0, HEADER))
    }

    /** The face as a file: header, records, then each shared data block once, in the order first used. */
    fun write(face: Face): ByteArray {
        val shares = LinkedHashMap<Int, Element>()
        face.elements.sortedBy { it.share }.forEach { shares.putIfAbsent(it.share, it) }
        var at = HEADER + face.elements.size * RECORD
        val offsets = HashMap<Int, Int>()
        for ((k, e) in shares) { offsets[k] = at; at += e.frames.size * e.frameBytes }
        val out = ByteArray(at)
        face.rawHeader.copyInto(out, 0, 0, HEADER)
        put32(out, 0, MAGIC); put32(out, 4, face.id); put32(out, 8, at)
        put16(out, 0x24, face.width); put16(out, 0x26, face.height)
        face.elements.forEachIndexed { i, e ->
            val r = HEADER + i * RECORD
            e.raw.copyInto(out, r, 0, RECORD)
            put16(out, r, e.type); put16(out, r + 2, e.fmt); put16(out, r + 4, e.x); put16(out, r + 6, e.y)
            put32(out, r + 12, offsets.getValue(e.share)); put32(out, r + 20, e.frameBytes); put16(out, r + 24, e.frames.size)
        }
        for ((k, e) in shares) {
            var f = offsets.getValue(k)
            for (img in e.frames) {
                put16(out, f, img.w); put16(out, f + 2, img.h); put32(out, f + 4, img.rgb565.size)
                img.rgb565.copyInto(out, f + 8); f += e.frameBytes
            }
        }
        return out
    }

    internal fun u16(b: ByteArray, o: Int) = (b[o].toInt() and 255) or ((b[o + 1].toInt() and 255) shl 8)
    internal fun u32(b: ByteArray, o: Int) = u16(b, o) or (u16(b, o + 2) shl 16)
    internal fun put16(b: ByteArray, o: Int, v: Int) { b[o] = v.toByte(); b[o + 1] = (v ushr 8).toByte() }
    internal fun put32(b: ByteArray, o: Int, v: Int) { put16(b, o, v and 0xFFFF); put16(b, o + 2, v ushr 16) }
}
