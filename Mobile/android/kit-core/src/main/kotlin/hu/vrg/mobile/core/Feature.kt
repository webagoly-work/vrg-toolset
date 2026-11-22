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
        "sphere", "Gömb", "A tudásbázis három jelzése: ellentmondás, sötét zóna, dermedt. Az egyoldalas kezdőlapról balra húzva is elérhető.",
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
        "◧", Group.APP, Stage.BETA, "M19",
    )
    val SHEETS = FeatureInfo(
        "sheets", "Lapok", "Az Asztal lapjai a telefonon: ablakok rácsban, dupla koppintás = teljes ⇄ egy cella, húzással méretezés és mozgatás.",
        "▦", Group.APP, Stage.BETA, "M20",
    )
    val APPS = FeatureInfo(
        "apps", "Alkalmazások", "Az Asztal HTML alkalmazásai (Planner, kalkulátorok, Készlet, MindMap, BuildTree, Valena) a telefonon, offline is.",
        "▤", Group.WORK, Stage.BETA, "M21", setOf(Need.INTERNET, Need.GITHUB),
    )
    val CLAUDE = FeatureInfo(
        "claude", "Claude", "A Claude alkalmazás megnyitása; párosított PC-vel a PC Remote Control munkamenetei: lista, indítás egy mappában.",
        "✶", Group.LINK, Stage.BETA, "M22", setOf(Need.RELAY),
    )
    val PCWIN = FeatureInfo(
        "pcwin", "PC ablakok", "A PC munkamappái (Repó, VRG Full, Közös) csak olvasva: böngészés, szöveg és kép előnézete, másolat az Átadáson át.",
        "🗁", Group.CONTROL, Stage.BETA, "M23", setOf(Need.RELAY),
    )

    // The field sketch (2026-11-17): a purpose-made note taker with plugins, the Planner's quick build for the site.
    val SKETCH = FeatureInfo(
        "sketch", "VRG Sketcher", "Helyszíni szemle, méretvétel, munkafelmérés, adatgyűjtés egy helyen: vázlat, jegyzet, munkakör, kérdések, kamera, helyszín; a Planner és az Asztal folytatja.",
        "📐", Group.WORK, Stage.BETA, "M24",
    )
    val PHOTO = FeatureInfo(
        "photo", "Fotópont", "A Vázlat bővítménye: pont a szoba közepén, a kamera onnan fotóz, a húzás iránya a kép iránya (szobánként négy kép).",
        "📷", Group.WORK, Stage.BETA, "M25", setOf(Need.CAMERA),
    )
    // WP M33: the Site Pager (the ESP32-S3 + nRF905 pager pair, Archive "Site Pager Builder") reimagined on phones.
    val PAGER = FeatureInfo(
        "pager", "Csipogó", "Terepi személyhívó Bluetooth-on, internet nélkül: hívás gombnyomásra, gyors üzenetek LÁTTAM visszaigazolással, közelségjelző, csevegés, adóvevő, őrzés és mozdulatlanság-riasztás.",
        "📟", Group.LINK, Stage.BETA, "M33", setOf(Need.BLUETOOTH),
    )

    // WP M61 (experimental, 2026-11-20): Apple Find My tags (the ISYTag, AirTags) used from Android over plain BLE;
    // since 2026-11-22 also the iTag (the teardrop anti-lost key tag: connected, ring, button = find the phone).
    val TAG = FeatureInfo(
        "tag", "Tárgykereső", "Kísérleti: Apple Find My címke (ISYTag, AirTag) és iTag kulcstartó Androidról: milyen messze van, csipogtatás, ottfelejtés-riasztás, az utolsó hely, ahol a telefon hallotta, és iTaggel telefonkereső.",
        "🏷", Group.LINK, Stage.BETA, "M61", setOf(Need.BLUETOOTH),
    )

    // WP M35: Proton Vault's device approval for VRG Mobile: one account, the phones differ, approved by QR.
    val DEVICES = FeatureInfo(
        "devices", "Eszközök", "Ez a telefon és a megbízható eszközök: hozzáférés kérése QR-kóddal, jóváhagyás a tulajdonos telefonján, a frissítések zárolása a listára.",
        "🔐", Group.APP, Stage.BETA, "M35", setOf(Need.INTERNET),
    )

    // The paged home (2026-11-19, WP M38): the Desktop's work tools as tiles of their own. Planner, Kalkulátorok and
    // Készlet open the M21 web apps (Kalkulátorok and Készlet offer their members: the three calculators; Készlet,
    // VRG BuildTree and the Valena választó until they merge into an overhauled Inventory). The rest is planned.
    val PLANNER = FeatureInfo(
        "planner", "Varler Planner", "A villamos tervező a telefonon: alaprajz, áramkörök, nézetek; a Desktop Plannerével azonos fájl.",
        "🏠", Group.WORK, Stage.BETA, "M39", setOf(Need.INTERNET, Need.GITHUB),
    )
    val CALC = FeatureInfo(
        "calc", "Kalkulátorok", "Panel anyagár, általános villanyszerelői és LED árkalkulátor egy helyen.",
        "🧮", Group.WORK, Stage.BETA, "M40", setOf(Need.INTERNET, Need.GITHUB),
    )
    val INVENTORY = FeatureInfo(
        "inventory", "Készlet", "Anyagok és szerszámok; alatta a VRG BuildTree és a Valena választó, amíg egy új Készletbe olvadnak.",
        "📦", Group.WORK, Stage.BETA, "M41", setOf(Need.INTERNET, Need.GITHUB),
    )
    val WORKFLOW = FeatureInfo(
        "workflow", "Varler Workflow Kit", "A PC munkái titkosítva ezen a telefonon: hol tart a kérdéssor, az árazás, az ajánlat; a Költségvetési Tervezet és az Árajánlat összegei.",
        "⚒", Group.WORK, Stage.BETA, "M42", setOf(Need.INTERNET, Need.GITHUB),
    )
    val MAP = FeatureInfo(
        "map", "VRG Térkép", "Magyarország térképe 3D épületekkel és domborzattal: saját hely, a Vázlatok helyszínei, a munkák (PC-vel) és navigáció.",
        "🗺", Group.WORK, Stage.BETA, "M43", setOf(Need.INTERNET),
    )
    val WEATHER = FeatureInfo(
        "weather", "VRG Időjárás", "Lehet-e ma kint dolgozni: MET Norway, DWD és a hivatalos figyelmeztetések egyesítve, terepi szabályokkal, tevékenységenként.",
        "⛅", Group.WORK, Stage.BETA, "M44", setOf(Need.INTERNET),
    )
    val VAULT = FeatureInfo(
        "vault", "Vault", "A titkosított személyes adattár (Proton Vault) saját webes felülete a telefonon, saját eszközkulccsal és QR-os jóváhagyással.",
        "🔒", Group.APP, Stage.BETA, "M45", setOf(Need.INTERNET),
    )
    val CATALOG = FeatureInfo(
        "catalog", "Katalógus", "Minden program, funkció és eszköz egy-egy lapon, a telefonon és az Asztalon: új felhasználóknak.",
        "📖", Group.APP, Stage.BETA, "M38",
    )

    val ALL: List<FeatureInfo> = listOf(
        DESK, SHEETS,
        AIRDECK, LAUNCH, DROP, SCREEN, PCWIN,
        PAIR, ACCOUNT, NET, PAGER, TAG, CLAUDE,
        SKETCH, PHOTO,
        PLANNER, CALC, INVENTORY, WORKFLOW, MAP, WEATHER,
        PULSE, SPHERE, CITY, STACK, ARCHIVE, APPS, NOTES, PORTS, INBOX,
        UPDATE, DEVICES, VAULT, CATALOG, SETTINGS,
    )

    fun byId(id: String?): FeatureInfo? = ALL.firstOrNull { it.id == id }

    fun grouped(): List<Pair<Group, List<FeatureInfo>>> =
        Group.entries.map { g -> g to ALL.filter { it.group == g } }.filter { it.second.isNotEmpty() }
}
