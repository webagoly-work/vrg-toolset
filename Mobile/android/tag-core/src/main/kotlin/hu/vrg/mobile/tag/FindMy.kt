package hu.vrg.mobile.tag

// What an Apple Find My tag says over the air, read by an Android phone. Android cannot join Apple's network (it holds
// no key of the tag and no Apple account), but the tag's own Bluetooth advertisements are public by design: that is
// how every passing iPhone relays them, and how Android's and AirGuard's unknown-tracker detection sees them.
//
// Sources (docs/mobile/WP/M61.md "Where the facts come from"):
//  - Offline finding advertisement: manufacturer data under Apple's company id 0x004C, type 0x12. The full form
//    (length 0x19 = 25) is sent when the tag is away from its owner ("separated"); a 2-byte form when the owner's
//    iPhone is near. Layout of the full form, after the company id:
//      [0] 0x12  [1] 0x19  [2] status  [3..24] public key bytes 6..27  [25] key byte 0 >> 6  [26] hint
//    and the random address is key bytes 0..5 with the top two bits forced to 1 (OpenHaystack, PoPETs 2021).
//  - Status byte: bits 6-7 battery (0 full … 3 critical), bits 4-5 device kind (0 Apple device, 1 AirTag,
//    2 Find My accessory) (AirGuard, seemoo-lab, Apache-2.0: DeviceManager / AppleFindMy).
//  - Service UUID 0xFD44: Apple's Find My network service, which third-party accessories expose (AirGuard rings
//    them through it). An unpaired tag in pairing mode is expected to advertise it — to be confirmed on the ISYTag.
//  - 0xFCB2: the DULT (IETF, Apple + Google) advertisement's service data. Not seen from a Find My tag yet; parsed so
//    the screen can say so if a newer firmware sends it.

/** How the tag is advertising. */
enum class AdKind(val hu: String) {
    /** Away from its owner's Apple device (or never near one): the full key, the address rotates about once a day. */
    SEPARATED("gazdától távol"),
    /** Its owner's iPhone / iPad is near: short form, the address rotates every ~15 minutes. */
    NEAR_OWNER("gazdája közelében"),
    /** No owner yet: Find My service UUID only (pairing mode, usually for minutes after the battery goes in). */
    PAIRING("párosításra vár"),
    /** A DULT (IETF unwanted-tracker) advertisement. */
    DULT("DULT hirdetés"),
}

/** Bits 4-5 of the status byte. */
enum class TagType(val hu: String) {
    APPLE_DEVICE("Apple eszköz"),
    AIRTAG("AirTag"),
    ACCESSORY("Find My kiegészítő"),
    OTHER("egyéb Apple"),
    UNKNOWN("ismeretlen");

    companion object {
        fun of(status: Int): TagType = when ((status shr 4) and 0x03) {
            0 -> APPLE_DEVICE
            1 -> AIRTAG
            2 -> ACCESSORY
            else -> OTHER
        }
    }
}

/** Bits 6-7 of the status byte. */
enum class Battery(val hu: String) {
    FULL("tele"),
    MEDIUM("közepes"),
    LOW("gyenge"),
    CRITICAL("nagyon gyenge"),
    UNKNOWN("—");

    companion object {
        fun of(status: Int): Battery = when ((status shr 6) and 0x03) {
            0 -> FULL
            1 -> MEDIUM
            2 -> LOW
            else -> CRITICAL
        }
    }
}

/** One advertisement, understood. [key] is the 28-byte P-224 public key (x) of the full form, else null. */
class FindMyAd(
    val kind: AdKind,
    val type: TagType,
    val battery: Battery,
    val status: Int?,
    val key: ByteArray?,
    val hint: Int?,
) {
    /** A short, stable label of the advertised key: the same until the tag rotates its key (separated: ~daily). */
    val keyTag: String? get() = key?.let { k -> k.copyOfRange(0, 4).joinToString("") { "%02X".format(it.toInt() and 0xFF) } }
}

object FindMy {
    const val APPLE = 0x004C
    const val TYPE_OFFLINE_FINDING = 0x12
    const val FULL_LEN = 0x19
    const val UUID16_FINDMY = 0xFD44
    const val UUID16_DULT = 0xFCB2

    /** "0000FD44-0000-1000-8000-00805F9B34FB": a 16-bit SIG UUID in its 128-bit form. */
    fun uuid128(u16: Int): String = "0000%04X-0000-1000-8000-00805F9B34FB".format(u16)

    /** One AD structure: [type] and its data. */
    class AdField(val type: Int, val data: ByteArray)

    /**
     * Splits a raw advertisement (+ scan response) into its AD structures by hand: Android's parsed ScanRecord keeps
     * only one manufacturer entry per company id, and a zero length ends the record.
     */
    fun fields(raw: ByteArray): List<AdField> {
        val out = ArrayList<AdField>()
        var i = 0
        while (i < raw.size) {
            val len = raw[i].toInt() and 0xFF
            if (len == 0 || i + 1 + len > raw.size) break
            out += AdField(raw[i + 1].toInt() and 0xFF, raw.copyOfRange(i + 2, i + 1 + len))
            i += 1 + len
        }
        return out
    }

    /** The 16-bit service UUIDs listed (AD 0x02 / 0x03) or carrying service data (AD 0x16). */
    fun uuid16s(raw: ByteArray): Set<Int> {
        val out = HashSet<Int>()
        for (f in fields(raw)) when (f.type) {
            0x02, 0x03 -> for (j in 0 until f.data.size / 2) out += le16(f.data, j * 2)
            0x16 -> if (f.data.size >= 2) out += le16(f.data, 0)
        }
        return out
    }

    /** Apple's manufacturer data after the company id, the offline-finding one if there are several. */
    fun appleData(raw: ByteArray): ByteArray? {
        val apple = fields(raw).filter { it.type == 0xFF && it.data.size >= 2 && le16(it.data, 0) == APPLE }
            .map { it.data.copyOfRange(2, it.data.size) }
        return apple.firstOrNull { it.isNotEmpty() && (it[0].toInt() and 0xFF) == TYPE_OFFLINE_FINDING } ?: apple.firstOrNull()
    }

    /**
     * Reads a raw scan record. [address] is the Bluetooth address Android reports ("C4:12:…"); it carries the first six
     * bytes of the key in the full form. Null when the record is not a Find My tag's.
     */
    fun parse(raw: ByteArray, address: String?): FindMyAd? {
        appleData(raw)?.let { m -> offlineFinding(m, address)?.let { return it } }
        val uuids = uuid16s(raw)
        if (UUID16_FINDMY in uuids) return FindMyAd(AdKind.PAIRING, TagType.UNKNOWN, Battery.UNKNOWN, null, null, null)
        if (UUID16_DULT in uuids) return FindMyAd(AdKind.DULT, TagType.UNKNOWN, Battery.UNKNOWN, null, null, null)
        return null
    }

    /** The offline-finding payload (after the company id), or null if it is another Apple message. */
    fun offlineFinding(m: ByteArray, address: String?): FindMyAd? {
        if (m.size < 3 || (m[0].toInt() and 0xFF) != TYPE_OFFLINE_FINDING) return null
        val len = m[1].toInt() and 0xFF
        val status = m[2].toInt() and 0xFF
        return if (len >= FULL_LEN && m.size >= 2 + FULL_LEN) {
            FindMyAd(AdKind.SEPARATED, TagType.of(status), Battery.of(status), status,
                key(m, address), m[26].toInt() and 0xFF)
        } else {
            FindMyAd(AdKind.NEAR_OWNER, TagType.of(status), Battery.of(status), status, null, null)
        }
    }

    /** The 28-byte public key: six bytes from the address (top two bits from byte 25), 22 from the payload. */
    fun key(m: ByteArray, address: String?): ByteArray? {
        val a = addressBytes(address) ?: return null
        if (m.size < 27) return null
        val k = ByteArray(28)
        for (j in 0 until 6) k[j] = a[j]
        k[0] = ((a[0].toInt() and 0x3F) or ((m[25].toInt() and 0x03) shl 6)).toByte()
        for (j in 0 until 22) k[6 + j] = m[3 + j]
        return k
    }

    /** The address the tag must use for a given key: key bytes 0..5, top two bits set (a static random address). */
    fun addressFor(key: ByteArray): String {
        val b = key.copyOfRange(0, 6)
        b[0] = (b[0].toInt() or 0xC0).toByte()
        return b.joinToString(":") { "%02X".format(it.toInt() and 0xFF) }
    }

    fun addressBytes(address: String?): ByteArray? {
        val parts = address?.split(":") ?: return null
        if (parts.size != 6) return null
        val out = ByteArray(6)
        for (i in 0 until 6) out[i] = (parts[i].toIntOrNull(16)?.takeIf { it in 0..255 } ?: return null).toByte()
        return out
    }

    private fun le16(b: ByteArray, at: Int): Int = (b[at].toInt() and 0xFF) or ((b[at + 1].toInt() and 0xFF) shl 8)
}
