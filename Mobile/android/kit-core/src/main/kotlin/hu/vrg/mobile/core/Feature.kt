package hu.vrg.mobile.core

// What VRG Mobile is made of, as plain data. The shell builds its home screen from this list, the
// build pack (docs/mobile/) numbers its work packages after the same ids, and a feature that exists
// only as a plan still gets a tile, so the app always shows the whole roadmap and where it stands.
//
// Pure Kotlin on purpose: `gradlew :kit-core:test` checks the catalogue without the Android SDK.

enum class Stage(val label: String) {
    LIVE("Kész"),
    BETA("Teszt"),
    PLANNED("Terv"),
}

/** What a feature needs before it can work. The shell shows the missing ones on the tile. */
enum class Need(val label: String) {
    BLUETOOTH("Bluetooth"),
    RELAY("Relé a PC-n"),
    INTERNET("Internet"),
    GITHUB("GitHub belépés"),
    CAMERA("Kamera"),
}

/** The home screen's sections, in order. */
enum class Group(val label: String) {
    CONTROL("Vezérlés"),
    LINK("Kapcsolat"),
    WORK("Munka"),
    APP("Alkalmazás"),
}

data class FeatureInfo(
    /** Stable id: deep links (`vrg://<id>`), settings keys and the WP names use it. Never rename. */
    val id: String,
    val title: String,
    val blurb: String,
    val glyph: String,
    val group: Group,
    val stage: Stage,
    /** The work package in docs/mobile/WP that builds or finishes it. */
    val wp: String,
    val needs: Set<Need> = emptySet(),
)

object Catalogue {
    val AIRDECK = FeatureInfo(
        "airdeck", "Légegér", "Giroszkópos egér, billentyűzet, érintőképernyő bármely PC-re és telefonra; Planner és Kódváros vezérlő.",
        "🖱", Group.CONTROL, Stage.LIVE, "M0", setOf(Need.BLUETOOTH, Need.RELAY),
    )
    val PAIR = FeatureInfo(
        "pair", "QR párosítás", "A PC képernyőjén lévő QR-kód beolvasása: csatlakozás a reléhez és megbízható telefon egy mozdulattal.",
        "▣", Group.LINK, Stage.LIVE, "M2", setOf(Need.CAMERA, Need.RELAY),
    )
    val ACCOUNT = FeatureInfo(
        "account", "GitHub fiók", "Belépés a GitHubra eszközkóddal; a többi online funkció ezt a fiókot használja.",
        "⎔", Group.LINK, Stage.BETA, "M3", setOf(Need.INTERNET),
    )
    val NET = FeatureInfo(
        "net", "Hálózat", "Bluetooth HID, WiFi relé, hotspot adatforgalom-figyeléssel, USB és Bluetooth internetmegosztás.",
        "📶", Group.LINK, Stage.PLANNED, "M7",
    )
    val PULSE = FeatureInfo(
        "pulse", "Haladás", "Az aktív branchek friss állapota: melyik eszköz mit kapott, commitok, PR-ek, CI.",
        "📈", Group.WORK, Stage.PLANNED, "M4", setOf(Need.INTERNET, Need.GITHUB),
    )
    val CITY = FeatureInfo(
        "city", "Kódváros online", "A repó városa a GitHub friss állapotából, csak az online részek (nem a PC és nem a H:).",
        "🏙", Group.WORK, Stage.PLANNED, "M5", setOf(Need.INTERNET, Need.GITHUB),
    )
    val NOTES = FeatureInfo(
        "notes", "Gyorsjegyzet", "Jegyzet a telefonról egy külön branchbe, ami a projekt naplójaként (chat log) működik.",
        "✎", Group.WORK, Stage.BETA, "M6", setOf(Need.INTERNET, Need.GITHUB),
    )
    val PORTS = FeatureInfo(
        "ports", "Localhost", "A PC-n futó helyi szerverek listája: megnyitás a telefonon, vagy külön ablakban a PC-n.",
        "⌘", Group.WORK, Stage.PLANNED, "M8", setOf(Need.RELAY),
    )
    val INBOX = FeatureInfo(
        "inbox", "Értesítések", "PR, CI, felhő-session és relé események egy helyen, telefonos értesítéssel.",
        "🔔", Group.WORK, Stage.PLANNED, "M10", setOf(Need.INTERNET, Need.GITHUB),
    )
    val LAUNCH = FeatureInfo(
        "launch", "Indítópult", "A START.cmd eszközei a telefonról: indítás a PC-n, futó eszközök, napló.",
        "▶", Group.CONTROL, Stage.PLANNED, "M11", setOf(Need.RELAY),
    )
    val DROP = FeatureInfo(
        "drop", "Átadás", "Fotó, fájl, vágólap és helyszíni kép a telefonról a PC-re (Planner, Inventory) és vissza.",
        "⇅", Group.CONTROL, Stage.PLANNED, "M12", setOf(Need.RELAY),
    )
    val SCREEN = FeatureInfo(
        "screen", "Képernyő", "A PC képernyője élőben a telefonon, Légegér vezérléssel. A PC-n jelzi, hogy nézik.",
        "▣", Group.CONTROL, Stage.PLANNED, "M13", setOf(Need.RELAY),
    )
    val UPDATE = FeatureInfo(
        "update", "Frissítés", "Új verzió a GitHubról: az app magát frissíti, ha a branchen újabb build van.",
        "⟳", Group.APP, Stage.PLANNED, "M9", setOf(Need.INTERNET, Need.GITHUB),
    )
    val SETTINGS = FeatureInfo(
        "settings", "Beállítások", "Megjelenés (Mélyvíz paletták, méret), fiókok, párosított PC-k, napló.",
        "⚙", Group.APP, Stage.LIVE, "M1",
    )

    val ALL: List<FeatureInfo> = listOf(
        AIRDECK, LAUNCH, DROP, SCREEN,
        PAIR, ACCOUNT, NET,
        PULSE, CITY, NOTES, PORTS, INBOX,
        UPDATE, SETTINGS,
    )

    fun byId(id: String?): FeatureInfo? = ALL.firstOrNull { it.id == id }

    fun grouped(): List<Pair<Group, List<FeatureInfo>>> =
        Group.entries.map { g -> g to ALL.filter { it.group == g } }.filter { it.second.isNotEmpty() }
}
