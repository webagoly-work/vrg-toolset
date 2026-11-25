package hu.vrg.mobile.tag

// Diagnosztika (WP M61, step 1 of the Q71 plan, D-162): a read-only look inside any Bluetooth LE device — its services,
// characteristics and their properties, the standard Device Information (manufacturer, model, firmware, hardware,
// software), the battery — and a guess at its chip from the firmware-update service its maker left in it. Nothing is
// written to the device; only standard characteristics are read (Generic Access, Device Information, Battery).
//
// The report is one JSON (kind "vrg.device-diag", v 1), shared with Android's share sheet; the Founder's Data Vault
// keeps it in Eszközeim (the personal device register). The same format on both sides: change it only with a new v.

/** One characteristic as discovered. [value] is read only for the standard ones ([Diag.READ_SAFE]). */
data class DiagChar(val uuid: String, val props: Int, val value: ByteArray? = null) {
    override fun equals(other: Any?) = other is DiagChar && uuid == other.uuid && props == other.props && value.contentEquals(other.value)
    override fun hashCode() = uuid.hashCode() * 31 + props
}

data class DiagService(val uuid: String, val chars: List<DiagChar>)

data class DiagDevice(
    val name: String?,
    val address: String,
    val bonded: Boolean,
    /** watch | itag | findmy | other */
    val type: String,
    val majorClass: Int? = null,
)

data class ChipGuess(val guess: String, val why: String)

object Diag {
    // GATT characteristic property bits (BluetoothGattCharacteristic.PROPERTY_*)
    private val PROPS = listOf(
        0x01 to "broadcast", 0x02 to "read", 0x04 to "write-no-response", 0x08 to "write",
        0x10 to "notify", 0x20 to "indicate", 0x40 to "signed-write", 0x80 to "extended",
    )

    fun props(bits: Int): List<String> = PROPS.filter { bits and it.first != 0 }.map { it.second }

    /** "0000180a-0000-1000-8000-00805f9b34fb" → 0x180A; null for a vendor 128-bit UUID. */
    fun short(uuid: String): Int? {
        val u = uuid.lowercase()
        if (!u.startsWith("0000") || !u.endsWith("-0000-1000-8000-00805f9b34fb") || u.length != 36) return null
        return u.substring(4, 8).toIntOrNull(16)
    }

    private val SERVICES = mapOf(
        0x1800 to "Generic Access", 0x1801 to "Generic Attribute", 0x1802 to "Immediate Alert", 0x1803 to "Link Loss",
        0x1804 to "Tx Power", 0x180A to "Device Information", 0x180D to "Heart Rate", 0x180F to "Battery",
        0x1812 to "HID", 0x1814 to "Running Speed", 0x1816 to "Cycling Speed", 0x181C to "User Data",
        0x1805 to "Current Time", 0x1811 to "Alert Notification",
        0xFD44 to "Apple Find My", 0xFCB2 to "DULT (IETF)", 0xFE59 to "Nordic Secure DFU", 0xFEF5 to "Dialog SUOTA",
        0xFFE0 to "iTag / vendor (FFE0)", 0xAE00 to "vendor AE00 (JieLi RCSP?)", 0xFEE7 to "vendor FEE7 (WeChat)",
    )
    private val SERVICES_128 = mapOf(
        "15190001-12f4-c226-88ed-2ac5579f2a85" to "DULT accessory non-owner",
        "00001530-1212-efde-1523-785feabcd123" to "Nordic Legacy DFU",
        "f000ffc0-0451-4000-b000-000000000000" to "TI OAD",
        "00010203-0405-0607-0809-0a0b0c0d1912" to "Telink OTA",
        "0000d0ff-3c17-d293-8e48-14fe2e4da212" to "Realtek OTA",
        "6e400001-b5a3-f393-e0a9-e50e24dcca9e" to "Nordic UART (NUS)",
        "7dfc9000-7d1c-4951-86aa-8d9728f8d66c" to "AirTag sound",
    )
    private val CHARS = mapOf(
        0x2A00 to "Device Name", 0x2A01 to "Appearance", 0x2A04 to "Connection Parameters", 0x2A05 to "Service Changed",
        0x2A06 to "Alert Level", 0x2A07 to "Tx Power Level", 0x2A19 to "Battery Level",
        0x2A23 to "System ID", 0x2A24 to "Model Number", 0x2A25 to "Serial Number", 0x2A26 to "Firmware Revision",
        0x2A27 to "Hardware Revision", 0x2A28 to "Software Revision", 0x2A29 to "Manufacturer Name", 0x2A50 to "PnP ID",
        0x2A37 to "Heart Rate Measurement", 0x2A2B to "Current Time", 0xFFE1 to "iTag button",
    )

    fun serviceName(uuid: String): String? = short(uuid)?.let { SERVICES[it] } ?: SERVICES_128[uuid.lowercase()]
    fun charName(uuid: String): String? = short(uuid)?.let { CHARS[it] }

    /** Standard characteristics that are safe to read: names, device information, battery. Never a vendor one. */
    val READ_SAFE: Set<Int> = setOf(0x2A00, 0x2A01, 0x2A19, 0x2A24, 0x2A26, 0x2A27, 0x2A28, 0x2A29, 0x2A50)

    fun safeToRead(uuid: String): Boolean = short(uuid) in READ_SAFE

    /**
     * The chip, guessed from the firmware-update (OTA / DFU) service the maker left in: each chip vendor ships its own.
     * A hint, not proof ("valószínű"): a maker can carry another vendor's protocol.
     */
    fun chip(services: List<String>): ChipGuess? {
        val s = services.map { it.lowercase() }.toSet()
        val shorts = services.mapNotNull { short(it) }.toSet()
        return when {
            0xFE59 in shorts -> ChipGuess("Nordic nRF5x", "0xFE59 szolgáltatás (Nordic Secure DFU)")
            "00001530-1212-efde-1523-785feabcd123" in s -> ChipGuess("Nordic nRF5x", "Nordic Legacy DFU szolgáltatás")
            "0000d0ff-3c17-d293-8e48-14fe2e4da212" in s -> ChipGuess("Realtek RTL87xx", "Realtek OTA szolgáltatás")
            "00010203-0405-0607-0809-0a0b0c0d1912" in s -> ChipGuess("Telink TLSR", "Telink OTA szolgáltatás")
            "f000ffc0-0451-4000-b000-000000000000" in s -> ChipGuess("Texas Instruments CC26xx", "TI OAD szolgáltatás")
            0xFEF5 in shorts -> ChipGuess("Dialog / Renesas DA14xxx", "0xFEF5 szolgáltatás (SUOTA)")
            0xAE00 in shorts -> ChipGuess("JieLi (AC69xx / AC70xx)", "0xAE00 szolgáltatás (JieLi RCSP, valószínű)")
            else -> null
        }
    }

    /** A characteristic's value as text, if it is printable UTF-8 (Device Information strings). */
    fun text(value: ByteArray?): String? {
        if (value == null || value.isEmpty()) return null
        val s = String(value, Charsets.UTF_8).trimEnd { it == '\u0000' || it.isWhitespace() }   // NUL / space padding
        return s.takeIf { t -> t.isNotEmpty() && t.all { it == ' ' || (!it.isISOControl() && it != '�') } }
    }

    fun hex(value: ByteArray?): String? = value?.joinToString("") { "%02x".format(it.toInt() and 0xFF) }

    /** The standard information read from the device, by key ("firmware", "model" …). */
    fun info(services: List<DiagService>): Map<String, String> {
        val keys = mapOf(0x2A00 to "name", 0x2A29 to "manufacturer", 0x2A24 to "model", 0x2A26 to "firmware",
            0x2A27 to "hardware", 0x2A28 to "software")
        val out = LinkedHashMap<String, String>()
        for (sv in services) for (c in sv.chars) {
            val k = short(c.uuid)?.let { keys[it] } ?: continue
            text(c.value)?.let { out[k] = it }
        }
        return out
    }

    fun battery(services: List<DiagService>): Int? = services.flatMap { it.chars }
        .firstOrNull { short(it.uuid) == 0x2A19 }?.value?.firstOrNull()?.toInt()?.and(0xFF)?.takeIf { it <= 100 }

    /** The report as JSON (kind "vrg.device-diag", v 1). Hand-written: no JSON library in the pure modules. */
    fun report(device: DiagDevice, services: List<DiagService>, atIso: String, app: String): String {
        val sb = StringBuilder()
        sb.append("{\"kind\":\"vrg.device-diag\",\"v\":1,\"at\":").append(q(atIso)).append(",\"app\":").append(q(app))
        sb.append(",\"device\":{\"name\":").append(q(device.name)).append(",\"address\":").append(q(device.address))
            .append(",\"bonded\":").append(device.bonded).append(",\"type\":").append(q(device.type))
            .append(",\"majorClass\":").append(device.majorClass?.toString() ?: "null").append('}')
        sb.append(",\"info\":{").append(info(services).entries.joinToString(",") { q(it.key) + ":" + q(it.value) }).append('}')
        sb.append(",\"battery\":").append(battery(services)?.toString() ?: "null")
        sb.append(",\"services\":[").append(services.joinToString(",") { sv ->
            "{\"uuid\":${q(sv.uuid.lowercase())},\"name\":${q(serviceName(sv.uuid))},\"characteristics\":[" +
                sv.chars.joinToString(",") { c ->
                    "{\"uuid\":${q(c.uuid.lowercase())},\"name\":${q(charName(c.uuid))},\"props\":[" +
                        props(c.props).joinToString(",") { q(it) } + "],\"value\":${q(hex(c.value))},\"text\":${q(text(c.value))}}"
                } + "]}"
        }).append(']')
        val chip = chip(services.map { it.uuid })
        sb.append(",\"chip\":").append(chip?.let { "{\"guess\":${q(it.guess)},\"why\":${q(it.why)}}" } ?: "null")
        return sb.append('}').toString()
    }

    /** A JSON string literal (or null). */
    fun q(s: String?): String {
        if (s == null) return "null"
        val b = StringBuilder("\"")
        for (ch in s) when {
            ch == '"' -> b.append("\\\"")
            ch == '\\' -> b.append("\\\\")
            ch == '\n' -> b.append("\\n")
            ch == '\r' -> b.append("\\r")
            ch == '\t' -> b.append("\\t")
            ch < ' ' || ch == ' ' || ch == ' ' -> b.append("\\u%04x".format(ch.code))
            else -> b.append(ch)
        }
        return b.append('"').toString()
    }

    /** A short human summary for the screen and the Napló. */
    fun summary(services: List<DiagService>): String {
        val i = info(services)
        val parts = listOfNotNull(
            i["manufacturer"], i["model"], i["firmware"]?.let { "fw $it" }, i["hardware"]?.let { "hw $it" },
            battery(services)?.let { "$it%" }, chip(services.map { it.uuid })?.let { "chip: ${it.guess}?" },
        )
        return if (parts.isEmpty()) "${services.size} szolgáltatás, szabványos adatlap nélkül" else parts.joinToString(" · ")
    }
}
