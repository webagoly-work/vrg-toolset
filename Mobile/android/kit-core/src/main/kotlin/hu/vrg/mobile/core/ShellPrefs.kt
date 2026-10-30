package hu.vrg.mobile.core

// The shell's own settings (WP M1), as plain data with its storage rules. The Android side
// (kit: ShellSettings) keeps them in SharedPreferences as strings and floats; everything that decides
// what a stored value means lives here, so `gradlew :kit-core:test` checks it without the Android SDK.

/** What the look can be. The ids match `Palettes` in kit/theme/Melyviz.kt, which holds the colours. */
object Look {
    const val DEFAULT_PALETTE = "melyviz"
    val PALETTES = listOf("melyviz", "arok", "korall", "laguna", "moszat", "sekely")
    val SCALE = 0.8f..1.3f

    /** An unknown or missing palette id falls back to Mélyvíz. */
    fun palette(id: String?): String = id?.takeIf { it in PALETTES } ?: DEFAULT_PALETTE

    fun scale(v: Float?): Float = if (v == null || v.isNaN()) 1f else v.coerceIn(SCALE.start, SCALE.endInclusive)
}

/** A PC the phone has paired with (filled in by M2's QR pairing). */
data class PairedPc(
    /** This phone's id at that PC, issued by its relay; what the phone signs with. */
    val id: String,
    /** The PC's own id (relay-paired.json), so the pairing is found again when its address changes. */
    val pcId: String,
    val name: String,
    /** The relay's address, `ws://host:port`. */
    val relay: String,
    /** Epoch milliseconds. */
    val pairedAt: Long,
)

data class ShellPrefs(
    val palette: String = Look.DEFAULT_PALETTE,
    val uiScale: Float = 1f,
    /** D-5: the app reopens the feature that was on screen last. */
    val startInLast: Boolean = true,
    val pairedPcs: List<PairedPc> = emptyList(),
    /** Légegér's old look has been taken over once (see [adoptLook]). */
    val lookAdopted: Boolean = false,
    /** The relay the app connects to on start, `ws://host:port`; empty = none (WP M2: the shared link). */
    val relayUrl: String = "",
    /** Légegér's old relay address has been taken over once (see [adoptRelay]). */
    val relayAdopted: Boolean = false,
) {
    /**
     * The one-off migration: before M1 the look was a Légegér setting. The first start of an M1 build
     * takes Légegér's palette and size over; after that the shell's own value wins, even if the
     * user changes it back to the default.
     */
    fun adoptLook(legegerPalette: String?, legegerScale: Float?): ShellPrefs =
        if (lookAdopted) this
        else copy(
            palette = if (legegerPalette != null) Look.palette(legegerPalette) else palette,
            uiScale = if (legegerScale != null) Look.scale(legegerScale) else uiScale,
            lookAdopted = true,
        )

    /** Same one-off rule for the relay address, which was Légegér's until the link became the app's (M2). */
    fun adoptRelay(legegerUrl: String?): ShellPrefs =
        if (relayAdopted) this
        else copy(relayUrl = if (relayUrl.isEmpty()) RelayAddress.normalize(legegerUrl.orEmpty()) else relayUrl, relayAdopted = true)

    /** The PC a relay's welcome names, if this phone has paired with it. */
    fun pcById(pcId: String?): PairedPc? = pairedPcs.firstOrNull { it.pcId == pcId }

    /** Adds or replaces the pairing with that PC (re-pairing the same PC keeps one entry). */
    fun withPc(pc: PairedPc): ShellPrefs = copy(pairedPcs = pairedPcs.filterNot { it.pcId == pc.pcId } + pc)

    fun withoutPc(pcId: String): ShellPrefs = copy(pairedPcs = pairedPcs.filterNot { it.pcId == pcId })

    companion object {
        const val K_PALETTE = "palette"
        const val K_SCALE = "uiScale"
        const val K_START_IN_LAST = "startInLast"
        const val K_PCS = "pairedPcs"
        const val K_ADOPTED = "lookAdopted"
        const val K_RELAY = "relayUrl"
        const val K_RELAY_ADOPTED = "relayAdopted"

        /** From whatever SharedPreferences.getAll() returned; anything unreadable becomes the default. */
        fun fromMap(m: Map<String, *>): ShellPrefs {
            val d = ShellPrefs()
            return ShellPrefs(
                palette = Look.palette(m[K_PALETTE] as? String),
                uiScale = Look.scale((m[K_SCALE] as? Number)?.toFloat()),
                startInLast = m[K_START_IN_LAST] as? Boolean ?: d.startInLast,
                pairedPcs = PcCodec.decode(m[K_PCS] as? String),
                lookAdopted = m[K_ADOPTED] as? Boolean ?: d.lookAdopted,
                relayUrl = RelayAddress.normalize(m[K_RELAY] as? String ?: ""),
                relayAdopted = m[K_RELAY_ADOPTED] as? Boolean ?: d.relayAdopted,
            )
        }

        fun toMap(p: ShellPrefs): Map<String, Any> = mapOf(
            K_PALETTE to p.palette,
            K_SCALE to p.uiScale,
            K_START_IN_LAST to p.startInLast,
            K_PCS to PcCodec.encode(p.pairedPcs),
            K_ADOPTED to p.lookAdopted,
            K_RELAY to p.relayUrl,
            K_RELAY_ADOPTED to p.relayAdopted,
        )
    }
}

/**
 * Paired PCs as one string: a line per PC (id, pcId, name, relay, pairedAt), fields separated by tabs. Tabs, newlines and backslashes
 * inside a field are escaped. kit-core has no JSON library and does not need one for four fields.
 */
object PcCodec {
    fun encode(pcs: List<PairedPc>): String =
        pcs.joinToString("\n") { listOf(it.id, it.pcId, it.name, it.relay, it.pairedAt.toString()).joinToString("\t", transform = ::esc) }

    /** Lines that do not parse are dropped, not fatal: a broken entry must not lose the others. */
    fun decode(s: String?): List<PairedPc> {
        if (s.isNullOrEmpty()) return emptyList()
        return s.split('\n').mapNotNull { line ->
            val f = line.split('\t').map(::unesc)
            if (f.size != 5 || f[0].isEmpty() || f[1].isEmpty()) return@mapNotNull null
            val at = f[4].toLongOrNull() ?: return@mapNotNull null
            PairedPc(f[0], f[1], f[2], f[3], at)
        }.distinctBy { it.pcId }
    }

    private fun esc(s: String) = s.replace("\\", "\\\\").replace("\t", "\\t").replace("\n", "\\n")

    private fun unesc(s: String): String {
        val b = StringBuilder(s.length)
        var i = 0
        while (i < s.length) {
            val c = s[i]
            if (c == '\\' && i + 1 < s.length) {
                when (s[i + 1]) {
                    't' -> b.append('\t')
                    'n' -> b.append('\n')
                    else -> b.append(s[i + 1])
                }
                i += 2
            } else { b.append(c); i++ }
        }
        return b.toString()
    }
}
