package hu.vrg.mobile.core

// The home screen's layout (WP M38, D-47): numbered pages, swiped sideways, each a band of the work in the order the
// Founder set on 2026-11-19 — first what has to be whipped up at once on site, then the tools of a few minutes, the
// Desktop-side work, the relay and connection tools, the rest, and last the account and the settings. The top bar
// and the dock (page "0") stay on screen over every page. A long press on ⌂ switches to one long page with the same
// order (the old Kompakt). Plain data, shared by both views; HomeLayoutTest checks every catalogue entry is on the
// home exactly once. Ids only point at Catalogue entries; nothing here renames a feature (deep links use the ids).

/** One page of the home. [short] is its label in the page strip. */
data class HomePage(val n: Int, val title: String, val short: String, val items: List<FeatureInfo>) {
    /** A page with few entries draws them as big cards; a longer one as an icon grid. */
    val cards: Boolean get() = items.size <= 3
}

object HomeLayout {
    val PAGES: List<HomePage> = listOf(
        HomePage(1, "Terep: azonnal kell", "Terep", listOf(Catalogue.SKETCH, Catalogue.PAGER)),
        HomePage(2, "Munka: pár perc", "Munka", listOf(Catalogue.PLANNER, Catalogue.CALC, Catalogue.INVENTORY)),
        HomePage(3, "Workflow Kit", "Workflow", listOf(Catalogue.WORKFLOW)),
        HomePage(4, "Térkép · Időjárás · Vault", "Térkép", listOf(Catalogue.MAP, Catalogue.WEATHER, Catalogue.VAULT)),
        HomePage(5, "Archívum · Claude · DevLap", "Archívum", listOf(Catalogue.ARCHIVE, Catalogue.CLAUDE, Catalogue.DEVLAP)),
        HomePage(6, "Kapcsolat a PC-vel", "Kapcsolat", listOf(
            Catalogue.PAIR, Catalogue.NET, Catalogue.AIRDECK, Catalogue.SCREEN,
            Catalogue.DROP, Catalogue.PCWIN, Catalogue.LAUNCH, Catalogue.PORTS,
        )),
        HomePage(7, "Egyéb", "Egyéb", listOf(
            Catalogue.NOTES, Catalogue.INBOX, Catalogue.PULSE, Catalogue.CITY,
            Catalogue.SPHERE, Catalogue.STACK, Catalogue.APPS, Catalogue.SHEETS, Catalogue.TAG, Catalogue.WATCH, Catalogue.RADAR, Catalogue.WEB,
        )),
        HomePage(8, "Fiók és beállítások", "Fiók", listOf(Catalogue.ACCOUNT, Catalogue.DEVICES, Catalogue.UPDATE, Catalogue.SETTINGS)),
    )

    /** A feature's plugins, drawn as chips on its card instead of tiles of their own (Fotópont on the Sketcher). */
    val PLUGINS: Map<String, List<FeatureInfo>> = mapOf(Catalogue.SKETCH.id to listOf(Catalogue.PHOTO))

    /** On the home but not on a page: the home itself, and the Katalógus, which has its button in the top bar. */
    val OFF_PAGES: Set<String> = setOf(Catalogue.DESK.id, Catalogue.CATALOG.id)

    /**
     * Home tiles that open web apps of Alkalmazások (M21) by their app ids: one opens at once, several are offered
     * as a pick (the three calculators; Készlet, BuildTree and Valena until the new Inventory merges them).
     */
    val SHORTCUTS: Map<String, List<String>> = mapOf(
        Catalogue.PLANNER.id to listOf("planner"),
        Catalogue.CALC.id to listOf("calc-panel", "calc-general", "calc-led"),
        Catalogue.INVENTORY.id to listOf("inventory", "buildtree", "valena"),
    )

    /** The page a feature is on (1-based), or null. */
    fun pageOf(id: String): Int? = PAGES.firstOrNull { p -> p.items.any { it.id == id } }?.n

    /** Icon columns of a grid page: 4 upright, 6 lying down. */
    fun columns(landscape: Boolean): Int = if (landscape) 6 else 4

    /**
     * The Sketcher's surveys as its card counts them: the files in `filesDir/[SKETCH_DIR]` named `<id>[SKETCH_SUFFIX]`.
     * They are SketchStore's names in feature-sketch (another session's module, not changed from here);
     * HomeLayoutTest reads that source and fails if they drift. A save's `.tmp` file is not counted.
     */
    const val SKETCH_DIR = "sketch"
    const val SKETCH_SUFFIX = ".vsketch.json"

    /** Whether a file in the sketch folder is a survey. */
    fun isSketchFile(name: String): Boolean = name.endsWith(SKETCH_SUFFIX) && name.length > SKETCH_SUFFIX.length

    /** The Sketcher card's count line; null (not counted yet) shows nothing. */
    fun sketchCountLabel(count: Int?): String? = when {
        count == null -> null
        count <= 0 -> "Még nincs felmérés a telefonon"
        else -> "$count felmérés a telefonon"
    }

    /**
     * VRG Időjárás's home card line (WP M44): feature-weather writes `<epoch ms>\n<line>` to `filesDir/[WEATHER_SUMMARY]`
     * after each refresh; the card shows it while it is younger than [WEATHER_MAX_AGE_MS], with its age.
     */
    const val WEATHER_SUMMARY = "weather/summary.txt"
    const val WEATHER_MAX_AGE_MS = 12 * 3600_000L

    fun weatherLine(file: String?, nowMs: Long): String? {
        val lines = file?.lines() ?: return null
        val at = lines.firstOrNull()?.trim()?.toLongOrNull() ?: return null
        val line = lines.getOrNull(1)?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        val age = nowMs - at
        if (age < 0 || age > WEATHER_MAX_AGE_MS) return null
        val min = age / 60_000
        return "$line · " + if (min < 60) "$min perce" else "${min / 60} órája"
    }
}
