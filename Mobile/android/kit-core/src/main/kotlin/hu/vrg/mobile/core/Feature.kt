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
        "⎔", Group.LINK, Stage.LIVE, "M3", setOf(Need.INTERNET),
    )
    val NET = FeatureInfo(
        "net", "Hálózat", "A telefon kapcsolatai egy helyen: hotspot adatforgalom-figyeléssel, USB és Bluetooth megosztás, helyi WiFi, Bluetooth HID és a telefon saját reléje.",
        "📶", Group.LINK, Stage.BETA, "M7",
    )
    val PULSE = FeatureInfo(
        "pulse", "Haladás", "A main és a nyitott munkák friss állapota: melyik eszköz mit kapott, commitok, PR-ek, CI.",
        "📈", Group.WORK, Stage.LIVE, "M4", setOf(Need.INTERNET, Need.GITHUB),
    )
    val CITY = FeatureInfo(
        "city", "Kódváros online", "A repó városa a GitHub friss állapotából, csak az online részek (nem a PC és nem a H:).",
        "🏙", Group.WORK, Stage.BETA, "M5", setOf(Need.INTERNET, Need.GITHUB),
    )
    val NOTES = FeatureInfo(
        "notes", "Gyorsjegyzet", "Jegyzet a telefonról egy külön branchbe, ami a projekt naplójaként (chat log) működik.",
        "✎", Group.WORK, Stage.LIVE, "M6", setOf(Need.INTERNET, Need.GITHUB),
    )
    val PORTS = FeatureInfo(
        "ports", "Localhost", "A PC-n futó helyi szerverek listája: megnyitás a telefonon, vagy külön ablakban a PC-n.",
        "⌘", Group.WORK, Stage.LIVE, "M8", setOf(Need.RELAY),
    )
    val INBOX = FeatureInfo(
        "inbox", "Értesítések", "PR, CI, új verzió, jegyzet és relé események egy helyen, telefonos értesítéssel.",
        "🔔", Group.WORK, Stage.BETA, "M10", setOf(Need.INTERNET, Need.GITHUB),
    )
    val LAUNCH = FeatureInfo(
        "launch", "Indítópult", "A START eszközei a telefonról: indítás a PC-n, futó eszközök, napló.",
        "▶", Group.CONTROL, Stage.LIVE, "M11", setOf(Need.RELAY),
    )
    val DROP = FeatureInfo(
        "drop", "Átadás", "Fotó, fájl, vágólap és helyszíni kép a telefonról a PC-re (Planner, Inventory) és vissza.",
        "⇅", Group.CONTROL, Stage.LIVE, "M12", setOf(Need.RELAY, Need.CAMERA),
    )
    val SCREEN = FeatureInfo(
        "screen", "Képernyő", "A PC képernyője élőben a telefonon, Légegér vezérléssel. A PC-n jelzi, hogy nézik.",
        "▣", Group.CONTROL, Stage.BETA, "M13", setOf(Need.RELAY),
    )
    val SPHERE = FeatureInfo(
        "sphere", "Gömb", "A tudásbázis három jelzése: ellentmondás, sötét zóna, dermedt. A kezdőlapról balra húzva is elérhető.",
        "◉", Group.WORK, Stage.LIVE, "M14", setOf(Need.INTERNET, Need.GITHUB),
    )
    val STACK = FeatureInfo(
        "stack", "Rétegverem", "A VRG Stack 3D-ben: Konnektóm (agyterületek funkció szerint) és Holo (Polip, Gömb, Föld, Mag, Őrség zár), érintéssel.",
        "🧠", Group.WORK, Stage.BETA, "M17", setOf(Need.INTERNET, Need.GITHUB),
    )
    val ARCHIVE = FeatureInfo(
        "archive", "Archívum", "Minden egyszeri interaktív oldal, amit Claude készített: mikor, miért, mi zajlott akkor. A mentett példányok offline is megnyílnak.",
        "🗂", Group.WORK, Stage.BETA, "M18", setOf(Need.INTERNET, Need.GITHUB),
    )
    val UPDATE = FeatureInfo(
        "update", "Frissítés", "Új verzió a GitHubról: az app magát frissíti, ha a branchen újabb build van.",
        "⟳", Group.APP, Stage.LIVE, "M9", setOf(Need.INTERNET, Need.GITHUB),
    )
    val SETTINGS = FeatureInfo(
        "settings", "Beállítások", "Megjelenés (Mélyvíz paletták, méret), fiókok, párosított PC-k, napló.",
        "⚙", Group.APP, Stage.LIVE, "M1",
    )

    // The night run of 2026-11-12 (docs/mobile/PARITY.md): VRG Mobile as a simplified VRG Desktop.
    val DESK = FeatureInfo(
        "desk", "Asztal", "A VRG Asztal a telefonon: lapfülek, Kommand kereső, dokk, menü és Rétegverem tárcsa, álló / fekvő váltó.",
        "◧", Group.APP, Stage.PLANNED, "M19",
    )
    val SHEETS = FeatureInfo(
        "sheets", "Lapok", "Az Asztal lapjai a telefonon: ablakok rácsban, dupla koppintás = teljes ⇄ egy cella, húzással méretezés és mozgatás.",
        "▦", Group.APP, Stage.PLANNED, "M20",
    )
    val APPS = FeatureInfo(
        "apps", "Alkalmazások", "Az Asztal HTML alkalmazásai (Planner, kalkulátorok, Készlet, MindMap, BuildTree, Valena) a telefonon, offline is.",
        "▤", Group.WORK, Stage.PLANNED, "M21", setOf(Need.INTERNET),
    )
    val CLAUDE = FeatureInfo(
        "claude", "Claude", "A Claude alkalmazás megnyitása; párosított PC-vel a PC Remote Control munkamenetei: lista, indítás egy mappában.",
        "✶", Group.LINK, Stage.PLANNED, "M22",
    )
    val PCWIN = FeatureInfo(
        "pcwin", "PC ablakok", "A PC munkamappái csak olvasva, másolat az Átadáson át; posta és hírfolyam, ha elérhető.",
        "🗁", Group.CONTROL, Stage.PLANNED, "M23", setOf(Need.RELAY),
    )

    val ALL: List<FeatureInfo> = listOf(
        DESK, SHEETS,
        AIRDECK, LAUNCH, DROP, SCREEN, PCWIN,
        PAIR, ACCOUNT, NET, CLAUDE,
        PULSE, SPHERE, CITY, STACK, ARCHIVE, APPS, NOTES, PORTS, INBOX,
        UPDATE, SETTINGS,
    )

    fun byId(id: String?): FeatureInfo? = ALL.firstOrNull { it.id == id }

    fun grouped(): List<Pair<Group, List<FeatureInfo>>> =
        Group.entries.map { g -> g to ALL.filter { it.group == g } }.filter { it.second.isNotEmpty() }
}
