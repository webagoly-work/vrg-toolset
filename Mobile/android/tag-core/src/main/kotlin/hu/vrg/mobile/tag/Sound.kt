package hu.vrg.mobile.tag

// Csipogtatás: making a Find My tag beep from Android, over a plain GATT connection (no bonding, no Apple account).
// Three ways exist; a tag offers one or more of them, and they are tried in [SoundProtocol.order].
//
//  - DULT: the IETF "Detecting Unwanted Location Trackers" accessory non-owner service (Apple + Google). Opcodes are
//    16-bit little-endian: Sound_Start 0x0300, Sound_Stop 0x0301. The spec allows them only while the accessory is
//    separated from its owner; it plays 5-30 s (12 s recommended).
//  - FINDMY: the sound characteristic under Apple's Find My service (0xFD44), which third-party Find My accessories
//    expose: start 01 00 03, stop 01 01 03.
//  - AIRTAG: the first-generation AirTag's own service: one byte 0xAF, the AirTag hangs up when it has played.
//
// The UUIDs and bytes were cross-checked against AirGuard (seemoo-lab/AirGuard, Apache-2.0,
// .../device/types/AppleFindMy.kt); this file is our own code. docs/mobile/WP/M46.md says what the ISYTag should show.

enum class SoundProtocol(
    val hu: String,
    /** The service: a full 128-bit UUID, or for FINDMY the 16-bit one, matched inside a 128-bit UUID. */
    val service: String,
    val characteristic: String,
    val start: ByteArray,
    /** Null: the tag stops by itself (AirTag hangs up). */
    val stop: ByteArray?,
    /** Subscribe to notifications / indications before writing (the tag answers and reports Sound_Completed). */
    val notify: Boolean,
) {
    DULT("DULT (IETF)",
        "15190001-12F4-C226-88ED-2AC5579F2A85", "8E0C0001-1D68-FB92-BF61-48377421680E",
        byteArrayOf(0x00, 0x03), byteArrayOf(0x01, 0x03), notify = true),
    FINDMY("Find My (FD44)",
        "FD44", "4F860003-943B-49EF-BED4-2F730304427A",
        byteArrayOf(0x01, 0x00, 0x03), byteArrayOf(0x01, 0x01, 0x03), notify = true),
    AIRTAG("AirTag",
        "7DFC9000-7D1C-4951-86AA-8D9728F8D66C", "7DFC9001-7D1C-4951-86AA-8D9728F8D66C",
        byteArrayOf(0xAF.toByte()), null, notify = false);

    /** Does a discovered service's UUID ("0000fd44-0000-1000-8000-00805f9b34fb") belong to this protocol? */
    fun matchesService(uuid: String): Boolean {
        val u = uuid.uppercase()
        return if (service.length == 4) u.startsWith("0000$service-") else u == service
    }

    companion object {
        /** Default order for a Find My accessory: the open standard first, Apple's own after, the AirTag's last. */
        val DEFAULT = listOf(DULT, FINDMY, AIRTAG)
        /** A tag that says it is an AirTag: its own protocol first. */
        val FOR_AIRTAG = listOf(AIRTAG, DULT, FINDMY)

        /**
         * The order to try, from what the tag is ([type]) and what it advertised ([advertised16]: 16-bit UUIDs). A
         * protocol whose service the tag advertises goes first; [lastWorked] (remembered per tag) goes before all.
         */
        fun order(type: TagType, advertised16: Set<Int>, lastWorked: SoundProtocol? = null): List<SoundProtocol> {
            val base = if (type == TagType.AIRTAG) FOR_AIRTAG else DEFAULT
            val hinted = if (FindMy.UUID16_FINDMY in advertised16) listOf(FINDMY) else emptyList()
            return (listOfNotNull(lastWorked) + hinted + base).distinct()
        }

        /** The first protocol in [order] whose service is among the discovered ones, or null (the tag offers no sound). */
        fun pick(order: List<SoundProtocol>, discovered: List<String>): SoundProtocol? =
            order.firstOrNull { p -> discovered.any { p.matchesService(it) } }

        fun byName(name: String?): SoundProtocol? = entries.firstOrNull { it.name == name }
    }
}

/** What the screen says after a ring attempt; the shell maps GATT outcomes onto it. */
enum class RingResult(val hu: String) {
    STARTED("Csipog: figyeld a hangot."),
    DONE("Kész."),
    NO_SERVICE("Ez a címke nem kínál hangot Androidnak (csak a gazdája Apple eszközéről szólaltatható meg)."),
    REFUSED("A címke elutasította. A DULT szabvány szerint csak akkor szól, ha a gazdájától távol van."),
    NO_CONNECTION("Nem sikerült csatlakozni: menj közelebb, vagy várj, amíg újra hirdet."),
    TIMEOUT("Nem válaszolt időben."),
}
