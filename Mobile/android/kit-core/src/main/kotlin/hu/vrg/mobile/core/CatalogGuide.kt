package hu.vrg.mobile.core

// Katalógus (2026-11-19): one page per program / feature / function of VRG Mobile and the VRG Desktop, for a new user
// finding their way around. Plain data, Hungarian text (it is phone UI), shown by the shell's Katalógus screen as
// swipeable pages in the home's order, then the Desktop's own programs. CatalogGuideTest checks it against Catalogue.

/** Where a program lives. */
enum class GuideSide(val label: String) {
    PHONE("Telefon"),
    DESKTOP("Asztal (PC)"),
    BOTH("Telefon és Asztal"),
}

data class GuidePage(
    /** The Catalogue feature id when the phone has it (the page offers "Megnyitás"), else a Desktop unit id prefixed "desk:". */
    val id: String,
    val title: String,
    val glyph: String,
    val side: GuideSide,
    /** One or two sentences: what it is for. */
    val what: String,
    /** Two to five short steps or facts: how it is used day to day. */
    val how: List<String>,
    /** What it needs (Bluetooth, the PC's relay, GitHub sign-in, camera, internet), or null. */
    val needs: String? = null,
    /** Its counterpart on the other side, if any (e.g. the Desktop page of the Sketcher), or null. */
    val pair: String? = null,
)

object CatalogGuide {
    /**
     * The order is the home's page order (HomeLayout.PAGES, then the Katalógus itself), then the Desktop-only programs:
     * every level-"user" unit of launcher/vrg-catalog.json that no phone page covers. Units folded into a phone page:
     * the Desktop's frame parts (views, palette, quick bar, Munkaterek, Értesítések, Beállítások, Telefon kapcsolat, F ·
     * Kiemelt) go to desk:desktop, sheets, inbox, settings, pair; Ügyfélnézet to planner; Fájlok and Munkák to pcwin;
     * the Rétegverem layers (Keresés, I, Q) and the Konnektóm-labor to stack; VRG Mobile is the phone itself.
     */
    val PAGES: List<GuidePage> = listOf(
        // 1 · Terep: azonnal kell
        GuidePage(
            id = "sketch", title = "VRG Sketcher", glyph = "📐", side = GuideSide.BOTH,
            what = "Helyszíni szemle, méretvétel és munkafelmérés egy helyen: vázlat, jegyzet, munkakör, kérdések, fotó és helyszín egy felmérésben. Akkor is jól használható, ha közben folyton megszakítanak.",
            how = listOf(
                "＋ Új felmérés, aztán a felső sáv hét jele között váltasz: Vázlat, Jegyzet, Munkakör, Kérdések, Kamera, Helyszín, Nyitott.",
                "A ✎ (jegyzet) és a ◉ (fotó) minden nézetből elérhető, utána ugyanott folytatod.",
                "A Vázlatban a szobát téglalappal vagy vonallal rajzolod. A le nem mért méreteket a program kiszámolja vagy megbecsüli; a becsültet ≈ jelöli.",
                "A Nyitott (⚑) mutatja, mi hiányzik még. Egy koppintás odavisz.",
                "A kész felmérést elküldöd a PC-re, ott a Planner tervként nyitja meg.",
            ),
            pair = "Asztal: a VRG Sketcher oldala (START P → S), ahol a felmérés átnézhető és kiegészíthető",
        ),
        GuidePage(
            id = "photo", title = "Fotópont", glyph = "📷", side = GuideSide.PHONE,
            what = "A Sketcher bővítménye: egy pont a szoba közepén, ahonnan a szobát négy irányba lefotózod. A kép iránya is elmentődik, így minden fotó a helyén van a rajzon.",
            how = listOf(
                "A vázlatban ⚙ → Fotópont bekapcsolása. Ekkor megjelenik a ◉ eszköz.",
                "Koppints a szoba közepe közelébe: oda kerül a pont. A pontra koppintva megnyílik a kamera.",
                "Fotó után húzd az ujjad arra, amerre a kép néz (É, K, D, Ny).",
                "Egy üres cikkre koppintva rögtön abba az irányba fotózol, húzás nélkül.",
                "Szobánként négy kép az egész helyiséget megmutatja.",
            ),
            needs = "kamera",
            pair = "Asztal: a Planner kirajzolja a pontokat és a látószögeket, és hozzárendeli a fotókat",
        ),
        GuidePage(
            id = "pager", title = "Csipogó", glyph = "📟", side = GuideSide.PHONE,
            what = "Terepi személyhívó a brigád telefonjain, Bluetooth-on, internet és PC nélkül. Hívás, gyors üzenetek visszaigazolással, csevegés és adóvevő.",
            how = listOf(
                "Bekapcsolás minden telefonon. A Beállításban mindenki saját nevet kap, a brigádkód közös.",
                "A HÍVÁS nyomva tartva csörget a másik telefonon. A K1–K3 gyors üzenetet küld, a másik fél LÁTTAM-mal nyugtázza.",
                "Ha senki nem válaszol, NINCS VÁLASZ jelzést kapsz. A LINK gomb megmutatja a kapcsolatot és a távolságot.",
                "Van csevegés és adóvevő is. Az Őrzés és a Mozdulatlanság-riasztás az egyedül dolgozónak szól.",
                "Zsebben, sötét képernyővel is megjön a hívás.",
            ),
            needs = "Bluetooth",
        ),

        // 2 · Munka: pár perc
        GuidePage(
            id = "planner", title = "Varler Planner", glyph = "🏠", side = GuideSide.BOTH,
            what = "A villamos tervező: alaprajz, szerelvények, áramkörök és nézetek egy offline fájlban. A telefonon ugyanaz a program fut, mint az Asztalon.",
            how = listOf(
                "Első megnyitáskor letölti a programot a GitHubról, utána internet nélkül is megy.",
                "Csippentéssel nagyítasz, egy ujjal mozgatod a rajzot.",
                "Projekt → Import: a telefonon lévő tervfájlt nyitja meg.",
                "A Sketcher felmérését a PC-s Planner tervként nyitja meg; a becsült méreteket ≈ jelöli.",
                "Az Ügyfélnézet a Planner része: egy 3D oldal, amit az ügyfél maga nézhet meg.",
            ),
            needs = "internet és GitHub belépés az első letöltéshez",
            pair = "Asztal: Varler Planner (START 1, a projektmenü START P)",
        ),
        GuidePage(
            id = "calc", title = "Kalkulátorok", glyph = "🧮", side = GuideSide.BOTH,
            what = "Három árkalkulátor egy csempén: panellakás anyagár, általános villanyszerelői (anyag és munkadíj) és LED szalag munkadíj. A helyszínen, felmérés közben is gyorsan kitölthetők.",
            how = listOf(
                "A csempére koppintva választasz a három közül.",
                "Minden mezőnél − / + gomb van, kesztyűben is nyomható. A beírt értékek megmaradnak.",
                "Az általános kalkulátorban árpresetet választasz (VillanyÁron, VárlerÁron, Saját, Piac), aztán a munka jellegét és az épületet.",
                "A LED kalkulátor a 2–2–6–8 modellel számol: szalag méterre, kötési pont, dimmer csatorna, tápegység.",
                "A panel anyagár kalkulátorba beírhatod a munkadíjat, és megmutatja az anyag arányát a teljes díjban.",
            ),
            needs = "internet és GitHub belépés az első letöltéshez",
            pair = "Asztal: START 2 (panel anyagár), 3 (általános), 8 (LED)",
        ),
        GuidePage(
            id = "inventory", title = "Készlet", glyph = "📦", side = GuideSide.BOTH,
            what = "A rendszeresen rendelt villanyszerelési anyagok adatbázisa, beszállítótól függetlenül. Ugyanez a csempe nyitja a VRG BuildTree-t és a Valena választót is, amíg egy megújult Készletbe nem olvadnak.",
            how = listOf(
                "A csempére koppintva választasz: Készlet, VRG BuildTree vagy Valena választó.",
                "Készlet: egy Planner-tervből látod, mi kell hozzá. Rendelési listát állítasz össze, exportálod, árat ellenőrzöl vagy QR-kódot készítesz.",
                "VRG BuildTree: a hardverág saját eszközei számlaadatokkal, készletléptetővel és változásnaplóval; az Eszköz-builderben elemekből eszközfát raksz össze.",
                "Valena választó: Legrand Valena Life szerelvénysor tervezése, ellenőrzőlistával és bevásárlólistával.",
                "Az Import a telefon fájlválasztóját nyitja meg.",
            ),
            needs = "internet és GitHub belépés az első letöltéshez",
            pair = "Asztal: Készlet (START 6), VRG BuildTree (START 9), Valena választó (START 5)",
        ),

        // 3 · Workflow Kit
        GuidePage(
            id = "workflow", title = "Varler Workflow Kit", glyph = "⚒", side = GuideSide.BOTH,
            what = "A PC-n futó árajánlati munkák a telefonon: melyik munka hol tart (kérdéssor, anyagkigyűjtés, árazás, ajánlat, dokumentum), a változatok munkadíja, anyaga, összege és az ajánlat szövegei. Az ügyféladat titkosítva, csak ennek a telefonnak.",
            how = listOf(
                "Először a telefonon: Kulcs közzététele. A képernyő mutat egy 6 jegyű kódot.",
                "A PC-n egyszer: node tools/workflow-seal.js trust <azonosító> <kód>, utána seal. A PC csak ennek a telefonnak a kulcsára titkosít.",
                "⟳ letölti a titkosított csomagot; offline is megnyílik, a kulcs a telefon Keystore-jában van.",
                "Egy munkára koppintva: a lépések, a változatok összegei, a szövegek és a fájlok listája. A PDF-ek a PC ablakokban olvashatók (◣ menü → Workflow Kit).",
                "A képernyőről nem készül képernyőkép, és a Képernyő is feketét mutat, amíg nyitva van.",
            ),
            needs = "GitHub belépés; a csomagot a PC készíti",
            pair = "Asztal: Varler Workflow Kit (Munka → Árazás)",
        ),

        // 4 · Térkép · Időjárás · Vault
        GuidePage(
            id = "map", title = "VRG Térkép", glyph = "🗺", side = GuideSide.BOTH,
            what = "Magyarország térképe saját terepi stílusban: címkeresés, 3D épületek, domborzat. A telefonon a saját helyed, a Vázlatok helyszínei és párosított PC-vel a munkák is rajta vannak.",
            how = listOf(
                "Első megnyitáskor a telefon letölti az oldalt (GitHub belépés kell) és a térképmotort; utána offline is nyílik.",
                "Párosított PC-vel (START → M fut) a „PC adat” jelzés látszik: a PC térképe és a Munkák gomb a relén át. A munkák adata nem marad a telefonon.",
                "PC nélkül az „Internet” jelzés: a térkép az internetről jön, és amit egyszer megnéztél, a helyszínen offline is megjelenik.",
                "◎ a saját helyed, lila pötty a Vázlat helyszíne. Árnyék: az épületek árnyéka bármikor. Feed: a legközelebbi otthon, bolt, étkezés, orvos… idővel; nyomva tartva útvonalat tervez, ▶ Indulás: hangos vezetés.",
                "Munka vagy helyszín kártyáján a Navigáció a navigációs alkalmazásnak csak a koordinátát és a kódot adja át, a címet nem.",
            ),
            needs = "internet az első letöltéshez; a munkákhoz a PC reléje (párosítva)",
            pair = "Asztal: VRG Térkép (START M)",
        ),
        GuidePage(
            id = "weather", title = "VRG Időjárás", glyph = "⛅", side = GuideSide.BOTH,
            what = "Lehet-e ma kint dolgozni? A telefon a MET Norway és a DWD előrejelzését egyesíti a szórásukkal együtt, hozzáveszi a hivatalos (HungaroMet) figyelmeztetéseket, és a PC terepi szabályaival tevékenységenként mond zöldet, sárgát vagy pirosat, munkaablakkal.",
            how = listOf(
                "Először ⚙ → Kapcsolat (MET Norway): egy e-mail cím vagy honlap. Amíg üres, csak a DWD és a figyelmeztetések jönnek.",
                "Válassz várost, vagy ◎ Itt: a telefon egyszer, a gombra kérdezi meg a helyet, ~1 km-re kerekítve; a ⚙ alatt elmenthető helyként.",
                "Fent a mai (munkaidő után a következő munkanapi) ítélet: kültéri szerelés, létra / emelőkosár, kábelfektetés, tető / napelem, az okokkal.",
                "Alatta a 72 óra: ég, hőmérséklet ± a források szórása, széllökés, csapadék, biztonság; a keret színe a legrosszabb tevékenységé.",
                "A határértékek óvatos alapértékek; a gép adattáblája és a kábel adatlapja erősebb. Villám nincs a telefonon: Radar ↗. PC nézet ›: a PC teljes oldala a relén át.",
            ),
            needs = "internet; a PC nézethez párosított PC",
            pair = "Asztal: VRG Időjárás (START W → I)",
        ),
        GuidePage(
            id = "vault", title = "Vault", glyph = "🔒", side = GuideSide.PHONE,
            what = "A titkosított személyes adattár (Proton Vault) saját webes felülete, a VRG Mobile-on belül. A titkosítás a Vaulté: a VRG Mobile nem lát bele.",
            how = listOf(
                "Első megnyitáskor a Vault ezt a telefont új eszközként látja: a Vaultban QR-kóddal kérsz hozzáférést, a tulajdonos telefonja jóváhagyja.",
                "Ez a jóváhagyás külön van az Eszközöktől: a VRG Mobile-ba engedett telefon még nem látja a Vaultot.",
                "⚙: a Vault címe, egy üzenetben kapott Vault-link megnyitása itt, és a Vault adatainak törlése a telefonról.",
                "Képernyőkép és képernyőmegosztás a Vault oldalán tiltva; letöltést nem ment a közös tárhelyre.",
            ),
            needs = "internet",
        ),

        // 5 · Archívum · Claude
        GuidePage(
            id = "archive", title = "Archívum", glyph = "🗂", side = GuideSide.BOTH,
            what = "Minden egyszeri interaktív oldal, amit Claude készített: mikor, miért, és mi zajlott akkor. A mentett példányok offline is megnyílnak.",
            how = listOf(
                "A ⟳ letölti a listát a GitHubról. Később csak az új fájlokat hozza le.",
                "Elöl a VRG oldalak, aztán az egyebek. Szűrhetsz (MIND, VRG, EGYÉB), csoportra és keresőszóra.",
                "Egy sorra koppintva a részletek jönnek; a ▶ Megnyitás a mentett oldalt mutatja teljes képernyőn.",
                "A claude.ai ↗ a telefon böngészőjében nyílik meg.",
                "Repülő módban a legutóbbi változat látszik, „· offline” jelzéssel.",
            ),
            needs = "internet és GitHub belépés",
            pair = "Asztal: Archívum (START R → A)",
        ),
        GuidePage(
            id = "claude", title = "Claude", glyph = "✶", side = GuideSide.PHONE,
            what = "Megnyitja a hivatalos Claude alkalmazást; a VRG Mobile maga nem lép be a Claude-ba. Párosított PC-vel a PC Remote Control munkameneteit is látod és indítod.",
            how = listOf(
                "✶ Megnyitás: elindul a Claude app. Ha nincs telepítve, felajánlja.",
                "A PC kártyáján a mappák: a repó gyökere, a Planner projekt és az Inventory projekt.",
                "▶ Indítás egy mappán: a PC-n új munkamenet indul, és pár másodperc múlva megjelenik a listában.",
                "✶ Megnyitás a Claude-ban: a Claude app arra a munkamenetre nyílik, és amit ott írsz, az a PC-n fut.",
                "■ Leállítás: a munkamenet leáll.",
            ),
            needs = "a PC reléje (párosítva) a munkamenetekhez",
            pair = "PC: a Claude Code Remote Control munkamenetei, a relén át",
        ),

        // 6 · Kapcsolat a PC-vel
        GuidePage(
            id = "pair", title = "QR párosítás", glyph = "▣", side = GuideSide.PHONE,
            what = "Egy QR-kód beolvasása a PC képernyőjéről: a telefon csatlakozik a PC reléjéhez, és megbízható telefon lesz. Ami a PC-n csinál valamit, az csak párosított telefonról működik.",
            how = listOf(
                "A kezdőlap QR beolvasás gombja rögtön a kamerát nyitja.",
                "A PC-n fusson a relé (START → L → S). A kódot a relé párosító oldala vagy az Asztal Telefon kapcsolat ablaka mutatja; 2 percig él, és egyszer használható.",
                "Beolvasás után pár másodperc, és kész a párosítás. A relé újraindítása után is megmarad.",
                "A párosított PC-k a Beállításokban vannak, ott egy PC törölhető.",
            ),
            needs = "kamera, a PC reléje",
            pair = "Asztal: Telefon kapcsolat (a QR-kód a PC képernyőjén)",
        ),
        GuidePage(
            id = "net", title = "Hálózat", glyph = "📶", side = GuideSide.PHONE,
            what = "A telefon minden kapcsolata egy helyen: hotspot adatforgalom-figyeléssel, USB- és Bluetooth-megosztás, helyi WiFi, a Légegér Bluetooth állapota és a telefon saját reléje. Mindegyiknél a valódi állapot látszik.",
            how = listOf(
                "Amit egy app nem kapcsolhat (hotspot, USB- és Bluetooth-megosztás), ott a „Beállítások ›” a megfelelő rendszeroldalra visz.",
                "Helyi WiFi: internet nélküli WiFi a telefonról, hogy router nélkül is összeérjen a telefon és a PC.",
                "Adatforgalom: a napi mobilnet. Beállíthatsz egy határt, és naponta egyszer szól, ha elérted.",
                "Telefon relé: a telefon maga lesz a relé. A PC a telefonon megjelenő kóddal párosodik.",
            ),
        ),
        GuidePage(
            id = "airdeck", title = "Légegér", glyph = "🖱", side = GuideSide.PHONE,
            what = "A telefon giroszkópos egér, billentyűzet és médiatávirányító bármely PC-hez, Bluetooth-on, a PC-re telepítés nélkül. A Planner és a Kódváros vezérlője is.",
            how = listOf(
                "Párosítsd Bluetooth-on a PC-vel. A PC egy közönséges egeret lát.",
                "A TARTSD · MUTAT gombot nyomva a telefon mozgása viszi a kurzort. A BAL / JOBB gomb vagy a hangerőgombok kattintanak.",
                "A ⌨ lapon szöveget írsz, a ⚙ lapon az érzékenységet és a relét állítod.",
                "A relén át követi, hogy a PC-n a Planner vagy a Kódváros van-e elöl, és ahhoz igazítja a gombokat.",
                "Másik telefonon érintőképernyőként is működik.",
            ),
            needs = "Bluetooth; a Planner és a Kódváros vezérléséhez a PC reléje",
            pair = "PC: bármely gép Bluetooth-on; a Planner és a Kódváros a relén át",
        ),
        GuidePage(
            id = "screen", title = "Képernyő", glyph = "▣", side = GuideSide.PHONE,
            what = "A PC képernyője élőben a telefonon, másodpercenként néhány képpel. Közben a Légegérrel vezérelheted is a PC-t.",
            how = listOf(
                "A PC-n fusson a relé (START → L → S), és a telefon legyen párosítva.",
                "Megnyitva mozog a PC képe, a kurzor is látszik. Válthatsz monitort, vagy csak az aktív ablakot nézed.",
                "A PC-n egy ablak jelzi, hogy a telefon nézi; a Leállítás azonnal megszakítja.",
                "A vezérléshez a Légegér Bluetooth kapcsolata kell.",
            ),
            needs = "a PC reléje (párosítva)",
            pair = "PC: a relé képküldése, egy értesítő ablakkal és Leállítás gombbal",
        ),
        GuidePage(
            id = "drop", title = "Átadás", glyph = "⇅", side = GuideSide.PHONE,
            what = "Közös fájltábla a telefon és a PC között: fájl, fotó és vágólap mindkét irányba. A fotókat megjelölheted a Planner vagy a Készlet számára.",
            how = listOf(
                "A PC-n a tábla a böngészőben: localhost:47291/board (START → O → 7 is megnyitja).",
                "Amit a PC-n a táblára teszel, megjelenik a telefonon; letöltve a Letöltések/VRG mappába kerül.",
                "A galériából „Megosztás → VRG Mobile”: a fotó a PC tábláján lesz.",
                "A vágólap mindkét irányba átvihető.",
            ),
            needs = "a PC reléje (párosítva); kamera a helyszíni képhez",
            pair = "PC: a tábla a böngészőben (localhost:47291/board), a fájlok a VRG Full inbox mappájában",
        ),
        GuidePage(
            id = "pcwin", title = "PC ablakok", glyph = "🗁", side = GuideSide.PHONE,
            what = "A PC munkamappái a telefonon, csak olvasásra: Repó, VRG Full és Közös (OneDrive). Szöveg- és képelőnézettel, másolat az Átadáson át.",
            how = listOf(
                "A PC-n fusson a relé (START → L → S), és a telefon legyen párosítva.",
                "Mappára koppintva belépsz. A .txt és .md fájl szövegként, a fotó képként nyílik meg.",
                "Amit a telefon nem mutat (például PDF): ⇄ Átadásra, és a tábláról letöltheted. Az eredeti a PC-n érintetlen marad.",
                "A ◣ menü Munkák, BRIDGE és Workflow Kit pontja egyenesen abba a mappába nyit.",
                "A ‹ Vissza mappánként lép feljebb.",
            ),
            needs = "a PC reléje (párosítva)",
            pair = "Asztal: Fájlok és Munkák (az ügyfélmunkák mappái)",
        ),
        GuidePage(
            id = "launch", title = "Indítópult", glyph = "▶", side = GuideSide.PHONE,
            what = "A START menü eszközei a telefonról: egy koppintás, és a program elindul a PC-n. Azt is látod, mi fut, és a naplója végét.",
            how = listOf(
                "Két rész van: Eszközök (1 … 9, 0, K, …) és Helyi szerverek (O1, O2, …), ugyanazokkal a betűkkel, mint a START-ban.",
                "Koppintásra a program a PC-n nyílik meg, a telefon kiírja: „Megnyitva a PC-n: …”.",
                "A futó programoknál a napló vége is olvasható. Hosszan nyomva további műveletek jönnek.",
                "Csak párosított telefonról működik.",
            ),
            needs = "a PC reléje (párosítva)",
            pair = "PC: a START menü",
        ),
        GuidePage(
            id = "ports", title = "Localhost", glyph = "⌘", side = GuideSide.PHONE,
            what = "A PC-n futó helyi szerverek listája (MindMap, Készlet, Térkép, Kódváros és a többi). Egy koppintással megnyitod a telefonon, vagy külön ablakban a PC-n.",
            how = listOf(
                "A PC-n fusson a relé (START → L → S), és a telefon legyen párosítva.",
                "A lista a programot és a portot mutatja; a világító pont jelzi, hogy fut. Lehúzva frissül.",
                "Megnyitás a telefonon: a relé továbbítja az oldalt.",
                "Megnyitás a PC-n: az oldal külön alkalmazásablakban nyílik.",
            ),
            needs = "a PC reléje (párosítva)",
            pair = "PC: START → O (Helyi szerverek)",
        ),

        // 7 · Egyéb
        GuidePage(
            id = "notes", title = "Gyorsjegyzet", glyph = "✎", side = GuideSide.PHONE,
            what = "Rövid jegyzet a telefonról egy külön branchbe, ami a projekt naplójaként működik. Bárhonnan olvasható, a munkamenetek is látják.",
            how = listOf(
                "Írd be vagy diktáld (🎤), válassz címkét (melyik eszközről szól), és küldd el.",
                "Internet nélkül is írhatsz: a jegyzet sorba áll, és magától elmegy, amikor lesz net.",
                "Más appból „Megosztás → VRG Mobile”: a szövegből jegyzet lesz.",
                "Alul a mai nap jegyzetei olvashatók vissza.",
            ),
            needs = "internet, GitHub belépés",
            pair = "A repó mobile-log branche, naponta egy fájllal",
        ),
        GuidePage(
            id = "inbox", title = "Értesítések", glyph = "🔔", side = GuideSide.PHONE,
            what = "PR, CI, új verzió, jegyzet és relé események egy listában, napok szerint. A fontosakról telefonos értesítés is jön.",
            how = listOf(
                "Lehúzva frissül. A GitHubot negyedóránként magától is megnézi.",
                "Szűrők: Mind, CI, PR, Relé, Jegyzet, Frissítés.",
                "Egy értesítésre koppintva a GitHub oldal, a Frissítés vagy az Átadás nyílik meg.",
                "A „✓ Mind olvasott” a github.com-on is olvasottnak jelöli őket.",
                "Hogy miről jöjjön értesítés, a Beállításokban választod ki.",
            ),
            needs = "internet, GitHub belépés",
            pair = "Asztal: Értesítések",
        ),
        GuidePage(
            id = "pulse", title = "Haladás", glyph = "📈", side = GuideSide.PHONE,
            what = "Hol tart a munka: a main friss commitjai és CI-állapota, a héten változott eszközök, és a main előtt járó nyitott munkák a PR-jükkel.",
            how = listOf(
                "Elöl a main: CI (✓ ✗ ●), a commitok száma és az utolsó commitok.",
                "Alatta az eszközök, amelyekhez a héten hozzányúltak, fájlszámmal.",
                "Lehúzva frissül; a képernyő kiírja, mennyi ideig tartott.",
                "Egy commitra vagy PR-re koppintva a github.com-on nyílik meg. Hosszan nyomva az SHA másolható.",
            ),
            needs = "internet, GitHub belépés",
            pair = "Asztal: Irányítópult nézet",
        ),
        GuidePage(
            id = "city", title = "Kódváros online", glyph = "🏙", side = GuideSide.BOTH,
            what = "A repó kódja városként, 3D-ben, a GitHub friss állapotából. Csak az online rész látszik, a PC és a H: meghajtó nem.",
            how = listOf(
                "Fent chipek: a main és a nyitott munkák branchei. Koppintással váltasz köztük.",
                "Egy ujj forgat, két ujj széthúzva nagyít, két ujjal együtt húzva mozgat.",
                "Egy épületre koppintva kijelölöd, és megnyílik a Kódváros panelje.",
                "A ⟳ csak akkor tölt le, ha változott valami. Offline a legutóbbi város látszik, a dátumával.",
            ),
            needs = "internet, GitHub belépés",
            pair = "Asztal: VRG Kódváros (START K)",
        ),
        GuidePage(
            id = "sphere", title = "Gömb", glyph = "◉", side = GuideSide.BOTH,
            what = "A tudásbázis gömbje: dokumentumonként egy pont, három jelzéssel (ellentmondás, sötét zóna, dermedt). Ahol két állítás ütközik, a pont piros.",
            how = listOf(
                "Három fül: Gömb, Jelzések, Szakaszok.",
                "A gömböt ujjal forgatod. Egy pontra koppintva látod a jelzéseit a forrásukkal.",
                "Megerősített ellentmondásnál dönthetsz (az első, a második, vagy mindkettő marad), indoklással.",
                "A telefon csak olvas és dönt, forrást nem szerkeszt. Offline a legutóbbi adat látszik.",
            ),
            needs = "internet, GitHub belépés",
            pair = "Asztal: Solomon Gömb (START T)",
        ),
        GuidePage(
            id = "stack", title = "Rétegverem", glyph = "🧠", side = GuideSide.BOTH,
            what = "A VRG Stack, a munka teljes térképe, 3D-ben. A Konnektóm agyként mutatja, funkció szerint; a Holo Polip, Gömb, Föld és Mag formában.",
            how = listOf(
                "A ⟳ letölti a két oldalt, utána offline is megy.",
                "Konnektóm: egy ujj forgat, csippentés nagyít, koppintás kiválaszt, dupla koppintás alaphelyzetbe tesz.",
                "Holo: két ujjas söprés vált formát. Hosszan nyomva üres helyen zárod vagy nyitod az Őrséget.",
                "Az Asztal dokkjában a ◢ tárcsa is ide visz.",
            ),
            needs = "internet, GitHub belépés",
            pair = "Asztal: Rétegverem (START R): keresés, Ötletfolyam, Döntésnapló, Konnektóm-labor",
        ),
        GuidePage(
            id = "apps", title = "Alkalmazások", glyph = "▤", side = GuideSide.BOTH,
            what = "Az Asztal HTML alkalmazásai a telefonon: Planner, kalkulátorok, Készlet, MindMap, BuildTree, Valena. Ugyanazok a programok, mint a PC-n.",
            how = listOf(
                "Első megnyitáskor letölti a GitHubról (a sor mutatja, hol tart), utána offline is megnyílik.",
                "A beírt adatok megmaradnak, az app bezárása után is.",
                "A ⟳ csak a változott fájlokat tölti le. Egy appot hosszan nyomva megnyitás nélkül frissítesz.",
                "Külső link a telefon böngészőjében nyílik meg.",
            ),
            needs = "internet, GitHub belépés",
            pair = "Asztal: az Alkalmazások csoport",
        ),
        GuidePage(
            id = "sheets", title = "Lapok", glyph = "▦", side = GuideSide.BOTH,
            what = "Az Asztal lapjai a telefonon: több ablak egy rácson, állva 2 × 4, fekve 4 × 2 cellában. Ugyanaz a lapmodell, mint a PC-n.",
            how = listOf(
                "Egy üres cellára koppintva kiválasztod, mi nyíljon meg benne.",
                "Dupla koppintás az ablak fejlécén: teljes méret ⇄ egy cella.",
                "Hosszan nyomva a szélét húzod: átméretezés. A fejlécét húzod: mozgatás vagy csere.",
                "Kész elrendezések is vannak, például Iroda és Áttekintés.",
            ),
            pair = "Asztal: Munkaterek és lapok",
        ),
        GuidePage(
            id = "tag", title = "Tárgykereső", glyph = "🏷", side = GuideSide.PHONE,
            what = "Kísérleti. Apple Find My címke (például ISYTag vagy AirTag), iTag kulcstartó és párosított óra (például Q71) Androidról, közvetlenül Bluetooth-on. Az Apple hálózatán jelentett helyet Android nem látja: azt csak a címke gazdájának Apple eszköze mutatja.",
            how = listOf(
                "Környék: minden Find My címke a közelben, távolsággal és elemszinttel.",
                "Ez az enyém: tartsd a címkét a telefon hátához, és a Tárgykereső megjegyzi. A címke néha új címet kap, ezt követi.",
                "Keresés: nagy távolságkijelzés és hangjelzés, ami közeledve gyorsul. A Csipogtatás megszólaltatja a címkét, ha engedi.",
                "Ottfelejtés: ha bekapcsolod, értesítést kapsz, amikor a címke lemarad. A telefon azt is megjegyzi, hol hallotta utoljára.",
                "iTag: csatlakozva marad, és a gombja megcsörgeti a telefont. Párosított óra: a listából választod, a kapcsolata jelzi, hogy veled van, és az óra hangszóróján csipogtatható.",
            ),
            needs = "Bluetooth (a hely megjegyzéséhez helymeghatározás)",
        ),
        GuidePage(
            id = "desk", title = "Asztal", glyph = "◧", side = GuideSide.PHONE,
            what = "Maga a kezdőlap: a VRG Asztal egyszerűsített változata a telefonon. Számozott lapok oldalra lapozva, felül a sáv, alul a dokk.",
            how = listOf(
                "Oldalra húzva lapozol: 1 Terep, 2 Munka, 3 Workflow, 4 Térkép, 5 Archívum, 6 Kapcsolat, 7 Egyéb, 8 Fiók.",
                "A felső sávban a Kommand kereső (például „led” → LED árkalkulátor), a tájolás váltó és a Katalógus gomb.",
                "A dokkban a nyitott ablakok, a ◣ menü, a ◢ Rétegverem és a 📐 Sketcher. Egy ablakot hosszan nyomva bezárhatsz.",
                "A ⌂ hosszan nyomva vált a lapozós kezdőlap és az egy hosszú oldal között.",
            ),
            pair = "PC: a VRG Asztal (START D)",
        ),

        // 8 · Fiók és beállítások
        GuidePage(
            id = "account", title = "GitHub fiók", glyph = "⎔", side = GuideSide.PHONE,
            what = "Belépés a GitHubra egy eszközkóddal. A többi online funkció (Haladás, Gyorsjegyzet, Archívum, Frissítés és a többi) ezt a fiókot használja.",
            how = listOf(
                "Belépés: a telefon egy nagy kódot mutat, és megnyitja a github.com/login/device oldalt.",
                "Írd be ott a kódot. A telefon magától észreveszi, hogy beléptél.",
                "Utána látod a fiókot és a repó hozzáférést (írás és olvasás, vagy csak olvasás).",
                "A kijelentkezés törli a tokent a telefonról.",
            ),
            needs = "internet",
        ),
        GuidePage(
            id = "devices", title = "Eszközök", glyph = "🔐", side = GuideSide.PHONE,
            what = "Ez a telefon és a megbízható eszközök listája. Új telefon QR-kóddal kér hozzáférést, a tulajdonos telefonja jóváhagyja, és a lista dönti el, ki kap frissítést.",
            how = listOf(
                "Új telefonon: Hozzáférés kérése. Megjelenik a kérés QR-kódja és egy rövid kód.",
                "A tulajdonos telefonja beolvassa a QR-t és jóváhagyja. A kérő telefon kb. egy percen belül magától feloldódik.",
                "Messengeren át is mehet: Megosztás, a másik oldalon Engedély beillesztése.",
                "A tulajdonosnak: a lista, Eltávolítás, Kiadások zárolása, és Telepítő QR egy másik telefonhoz.",
            ),
            needs = "internet",
        ),
        GuidePage(
            id = "update", title = "Frissítés", glyph = "⟳", side = GuideSide.PHONE,
            what = "Az app magát frissíti a GitHubról: ha van újabb kiadás, szól, letölti, és átadja az Android telepítőjének.",
            how = listOf(
                "Ha van új verzió, a Frissítés felajánlja. Egy koppintással jóváhagyod a telepítést.",
                "A beállítások megmaradnak.",
                "Az új kiadásról az Értesítések is szólnak.",
                "Zárolt kiadásoknál csak a listán lévő telefon kap frissítést; ha a tiéd nincs rajta, az Eszközökhöz irányít.",
            ),
            needs = "internet, GitHub belépés",
        ),
        GuidePage(
            id = "settings", title = "Beállítások", glyph = "⚙", side = GuideSide.PHONE,
            what = "Az app beállításai: megjelenés, tájolás, értesítések, párosított PC-k, névjegy és napló.",
            how = listOf(
                "Megjelenés: a Mélyvíz paletta és a méret azonnal átszínezi az egész appot.",
                "Tájolás: Automatikus, Álló vagy Fekvő.",
                "Párosított PC-k: itt törölhetsz egy PC-t.",
                "Névjegy és Napló: a verzió, és az utolsó naplósorok hiba esetére.",
            ),
            pair = "Asztal: Beállítások",
        ),

        // 9 · Katalógus (in the top bar, not on a page)
        GuidePage(
            id = "catalog", title = "Katalógus", glyph = "📖", side = GuideSide.PHONE,
            what = "Ez az útmutató: minden program és funkció egy-egy lapon, előbb a telefoné a kezdőlap sorrendjében, aztán az Asztal saját programjai.",
            how = listOf(
                "Oldalra húzva lapozol.",
                "A Megnyitás gomb elindítja az adott funkciót, ha a telefonon megvan.",
                "Minden lapon: mire jó, hogyan használd, mi kell hozzá, és mi a párja a másik oldalon.",
                "A felső sáv Katalógus gombjával bármikor visszajössz.",
            ),
        ),

        // 10 · The Desktop's own programs (level "user" in launcher/vrg-catalog.json, not covered above)
        GuidePage(
            id = "desk:desktop", title = "VRG Asztal", glyph = "🖥", side = GuideSide.DESKTOP,
            what = "A PC teljes képernyős munkafelülete: minden eszköz, ablak és állapot egy helyen. Két nézete van: az Irányítópult (áttekintés) és az Asztal (ikonok, dokk, ablakok).",
            how = listOf(
                "Indítás: START → D.",
                "Ctrl+Shift+P: a Parancspaletta bármelyik eszközt vagy parancsot megtalálja. A felső sáv Gyorskeresője ugyanígy működik.",
                "Munkaterek: az ablakok elrendezése elmenthető és visszahívható.",
                "Az Értesítések és a Beállítások is innen érhetők el.",
                "Telefon kapcsolat: itt jelenik meg a párosító QR-kód.",
            ),
            pair = "Telefon: az Asztal kezdőlap és a Lapok",
        ),
        GuidePage(
            id = "desk:rajztar", title = "Rajztár Stúdió", glyph = "📑", side = GuideSide.DESKTOP,
            what = "Offline szerkesztő villamos tervdokumentációhoz: tervcsomag, rajzlap szabványos kerettel és szövegmezővel, rajzjelek. A szabályokat a Rajztár adattárából veszi.",
            how = listOf(
                "Indítás: START → P → J.",
                "Csomag: a projektosztály, a fázis és a szintek alapján elkészül a tervjegyzék, és kiderül, melyik kötelező lap hiányzik.",
                "Lap: valódi milliméteres rajzlap. Rajzjel, vonal és szöveg a 2,5 mm-es rácsra; nyomtatás PDF-be vagy mentés SVG-be.",
                "Jelek: a rajzjelek szerkesztője, élő előnézettel.",
                "A telefonon még nincs meg; egy későbbi munkacsomag.",
            ),
        ),
        GuidePage(
            id = "desk:bridge", title = "BRIDGE dokumentáció", glyph = "🌉", side = GuideSide.DESKTOP,
            what = "A BRIDGE okosotthon-rendszer leírása, megépíthető részletességig. Az elve: a kézi működés az első, hardverben megoldva. Az első valódi példánya a CLA lakás.",
            how = listOf(
                "Az Asztalon a Munka → Anyag csoportban nyílik.",
                "A mappák: architektúra, BRIDGE-DN (DIN-sínes hub), OmniComm Hub, kapcsolódó hardver, szabványok.",
                "A telefonon a PC ablakokban olvasható (◣ menü → BRIDGE).",
            ),
            pair = "Telefon: PC ablakok → BRIDGE",
        ),
        GuidePage(
            id = "desk:mindmap", title = "VRG MindMap", glyph = "💭", side = GuideSide.DESKTOP,
            what = "Kapcsolt jegyzetvászon: buborékok, keretek, színes kapcsolatrétegek, rétegekhez kötött jegyzetek és spirál nézet. Billentyűzetről is végig kezelhető.",
            how = listOf(
                "Indítás: START → 4. A szervere a 8124-es porton fut (START → O).",
                "Szerverről nyisd, ne fájlból: csak így menti el a munkát.",
                "A telefonon az Alkalmazások között is megvan.",
            ),
            pair = "Telefon: Alkalmazások → VRG MindMap",
        ),
        GuidePage(
            id = "desk:web", title = "Böngésző", glyph = "🌐", side = GuideSide.DESKTOP,
            what = "Beépített böngésző az Asztalon, a többi ablak mellett: fülek, címsor, könyvjelzők, előzmények és a helyi szerverek.",
            how = listOf(
                "Ablakként nyílik az Asztalon, lapra is tehető.",
                "Ctrl+L a címsor, Ctrl+T új fül, Ctrl+F keresés az oldalon.",
                "A helyi szerverek (Térkép, MindMap és a többi) innen is megnyithatók.",
            ),
            pair = "Telefon: a telefon saját böngészője; a Kommandba írt cím abban nyílik meg",
        ),
        GuidePage(
            id = "desk:mail", title = "Posta", glyph = "✉", side = GuideSide.DESKTOP,
            what = "Levelezés az Asztalon: fiókok, beérkezett levelek, keresés és biztonságos olvasónézet. A mellékletek csak kérésre mentődnek.",
            how = listOf(
                "A Gmail fiók a PC saját belépésével fut; más webes postafiók a böngészőben nyílik.",
                "A levél távoli képei csak a Képek betöltése gombra jelennek meg.",
                "A telefonon nincs meg: ott a telefon saját levelezője nyílik.",
            ),
            pair = "Telefon: a telefon saját levelező appja",
        ),
        GuidePage(
            id = "desk:search", title = "Belső keresés", glyph = "🔍", side = GuideSide.DESKTOP,
            what = "Egy keresőmező a VRG Stackre és a kód indexére egyszerre. Rétegekre szűrhetsz, és a találat a helyén nyílik meg.",
            how = listOf(
                "A felső sávból nyílik, a többi ablak fölött.",
                "Írd be a szavakat; a rétegbetűkkel (F, I, Q, …) szűkíthetsz.",
                "Kódtalálatra koppintva a fájl a megfelelő sornál nyílik meg.",
                "A telefonon még nincs meg; egy későbbi munkacsomag.",
            ),
            pair = "Telefon: a Kommand a katalógusban keres",
        ),
        GuidePage(
            id = "desk:feed", title = "Hírfolyam", glyph = "📰", side = GuideSide.DESKTOP,
            what = "Mentett keresések blokkokban: mindegyiknél a legutóbbi futás ideje és a találatai.",
            how = listOf(
                "Blokkonként Frissítés, vagy az Összes frissítése egyszerre.",
                "Egy találatra koppintva megnyílik, amire mutat.",
                "A PC-n fut, saját gyorsítótárral; a telefonon nincs meg.",
            ),
        ),
        GuidePage(
            id = "desk:console", title = "Varler Console", glyph = "🎛", side = GuideSide.DESKTOP,
            what = "Villanyszerelői terepi konzol és zseb-műszerfal böngészőben: munkák, mérések, elosztó-kiosztás, ellenőrzőlisták, kalkulátorok, súgó és egy ügynöknyom nézet. Offline is megy, az adatokat helyben tárolja.",
            how = listOf(
                "Indítás: START → W → S (localhost:8133).",
                "Telefonra telepíthető webappként (Hozzáadás a kezdőképernyőhöz); utána kábel és net nélkül fut.",
                "Az Ügynöknyom megmutatja, mit csinál épp egy Claude munkamenet, és mikor vár rád.",
                "Párosított telefonon a Localhost is megnyitja.",
            ),
            pair = "Telefon: Localhost → Varler Console",
        ),
        GuidePage(
            id = "desk:servicekit", title = "ServiceKit", glyph = "🧰", side = GuideSide.DESKTOP,
            what = "Hordozható szervizkészlet Windowshoz, pendrive-on. A programokat a hivatalos forrásukból tölti le, és egy Irányítópultot ad hozzájuk: élő állapot, offline súgó, biztonságos futtatás.",
            how = listOf(
                "Kicsomagolás a pendrive-ra, aztán SETUP.cmd: az Alap gomb az ajánlott készletet jelöli ki.",
                "START.cmd nyitja meg az Irányítópultot; a mellette induló kis ablakot hagyd nyitva.",
                "Régi gépekhez a Cél Windows mezőben Windows 7 vagy 8.1 választható.",
                "Még fejlesztés alatt áll; a telefonon nincs meg.",
            ),
        ),
    )

    fun byId(id: String): GuidePage? = PAGES.firstOrNull { it.id == id }
}
