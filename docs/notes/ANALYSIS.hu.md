# VRG Jegyzetek — piacelemzés és moduláris funkciólista

*Előkészítés a VRG Asztal (VRG Desktop) és a VRG Mobile beépített jegyzetalkalmazásához. 2026-11-10. Csak elemzés: semmi sincs
megépítve, és semmi sincs még bejegyezve a `launcher/vrg-menu.json` vagy a `vrg-catalog.json` fájlba. A piaci áttekintés a
termékek 2026 közepi állapotának általános ismeretén alapul, nem friss webes keresésen; a termékek részletei gyakran változnak,
ezért egy megnevezett funkciót átvétel előtt érdemes újra ellenőrizni.*

*Ez az angol [ANALYSIS.md](ANALYSIS.md) magyar változata. Eltérés esetén a kettőt együtt kell javítani. A modulválasztó oldal
(kétnyelvű, interaktív): https://claude.ai/artifact/V68RVT9rfxZPQgZj1ChdBb*

*Előbb a [SIMPLE.hu.md](SIMPLE.hu.md) olvasandó: az egyszerű felszín, a helyek és a gépház, amelybe minden alábbi modulnak bele
kell férnie. Az N-FOLDER az 1. szintre kerül, és bekerül az N-SIMPLE, az N-ENGINELOG és az N-SKIN (§6.13), így a lista 99 modulos.
Az [EDITOR.hu.md](EDITOR.hu.md) az Obsidian-bővítményeket erre a listára vetíti, és további 22-t ad a MindMD-szerkesztőhöz (összesen 121).*

Tartalom: §1 ami a VRG-ben már megvan · §2 a piac · §3 mi lehet egy jegyzet a szövegdobozon túl · §4 ami a VRG-hez illik · §5 a
háttér (tárolás, szinkron, biztonság, tartalék) · §6 a moduláris funkciólista · §7 nyitott döntések · §8 építési sorrend.

---

## 1. Ami a VRG-ben már megvan (a kiindulópont)

Jegyzet*alkalmazás* még nincs, de van két **csak írható jegyzetútvonal**, és megvan a vezetékezés nagy része, amire egy
jegyzetalkalmazásnak szüksége van.

| Elem | Hol | Mit csinál ma | Mire jó a Jegyzetekhez |
|---|---|---|---|
| **Gyorsjegyzet** (Mobile M6, ÉLES) | `Mobile/android/feature-notes`, `kit-core/Notes.kt` | szöveg + 🎤 hu-HU diktálás + címkecsipek → egy sor hozzáfűzve a `log/YYYY-MM-DD.md` fájlhoz a `mobile-log` ágon, GitHubon át; offline kimenő sor (WorkManager), azonosító-jelölő, hogy az újrapróbálás csak egyszer érkezzen meg, megosztási cél, `vrg://notes/new?text=…` | a telefon rögzítőfelülete; a kimenő sor és az újrapróbálós hozzáfűzés úgy, ahogy van, újrahasznosítható |
| **Fejlesztői jegyzet** (Desktop WP-25) | `Dashboard/shell/lib/notes.js`, `Dashboard/page/panes/note.js` | „mentés fejlesztői jegyzetként” bármely panelről (forrásfajták: `url`, `file`, `node`, `term`, `chat`) → Divergence kimenő sor → `vrg-devnotes` ág a következő Push-nál | a Desktop rögzítőablaka és a *forrás* gondolata (a jegyzet tudja, honnan jött) |
| **Telefon ↔ PC relé** (M2, M7) | `kit/relay`, `relay-core`, `Mobile/tests/relay-*.js` | QR-párosítás, P-256 eszközkulcsok, aláírt üzenetek, bizalmi kapu; a telefon maga is lehet relé | LAN-szinkron felhő nélkül, már hitelesítve |
| **Átadás** (M12) | `feature-drop`, `Drop.kt` | fájltábla: fotók és fájlok telefonról PC-re, méret- és ellenőrzőösszeg-vizsgálattal, vágólap | mellékletek (helyszíni fotók) |
| **Titkok** | Desktop `shell/lib/secrets.js` (safeStorage = DPAPI, tmp + átnevezés), Mobile `SecretStore` (Keystore AES), `PhoneKey` (Keystore P-256) | titkosított kulcstárolás mindkét oldalon, soha nincs nyílt szöveges tartalék | a tárolókulcs, a szinkronkulcsok |
| **`vrg-app://` séma** (DESKU-Q08) | `shell/lib/appscheme.js` | héjon belüli HTML-alkalmazások valódi originen, a saját mappájukba + a `shared/`-be zárva | a Jegyzetek felülete héjon belüli alkalmazásként |
| **Paletta, keresés, Stack** | `shell/lib/palette.js`, `search.js`, `innersearch.js`, `Stack/` | parancspaletta, fájl- és belső keresés, a munka többrétegű gráfja | jegyzetek keresése; jegyzetek mint Stack-réteg; hivatkozás Stack-csomópontokra |
| **MindMap / Varler MindMD** | `MindMap/` (`I:r0` ötlet: „Kapcsolt jegyzetvászon”) | a jegyzetvászon őse | a jegyzetek vászon- / gráfnézete |
| **BACKUP** | `launcher/backup.ps1` | repónként git bare mentés + tükrözött munkamappák, semmi sem íródik felül archivált másolat nélkül, újrahash-elő manifest | a tároló mentése szinte ingyen jön |
| **VRG UI Kit / Mélyvíz** | `shared/vrg-ui-kit`, `kit/theme` (generált Kotlin tokenek) | egy kinézet PC-n és telefonon | a Jegyzetek kinézete |
| **Értesítések** (M10) | `feature-inbox`, `VrgNotify` | telefonos értesítések csatornákkal | emlékeztetők |

**A hiány:** semmi sem tudja a jegyzeteket *visszaolvasni, szerkeszteni, rendezni vagy keresni*; a két útvonal két különböző git-ágba,
két formátumban ír; semmi sem köti a jegyzetet munkához, Planner-elemhez vagy készletcikkhez; és ha egy telefonos jegyzet ügyfelet
nevez meg, az ügyfél adatai nyílt szövegként kerülnének a GitHubra (a `mobile-log` ág az `origin`-on van). Az utolsó pontot az §5
javítja elsőként.

---

## 2. A piac

Aszerint csoportosítva, hogy *mire való* a termék. Az „Átvehető” oszlop azt mondja meg, mit érdemes a VRG-nek kölcsönvennie.

### 2.1 Operációs rendszerbe vagy eszközbe építve

| Termék | Platformok · tárolás | Kiemelkedő funkciók | Átvehető |
|---|---|---|---|
| **Apple Notes** | csak Apple · iCloud | mappák + címkék + intelligens mappák, ellenőrzőlisták, táblázatok, dokumentumszkennelés OCR-rel, PencilKit-tinta, zárolt jegyzetek (jelszó / Face ID), megosztott jegyzetek és mappák, gyorsjegyzet bármelyik képernyősarokból, hangfelvétel átiratozással, Math Notes, hivatkozás jegyzetek között | gyorsjegyzet bárhonnan; zárolt jegyzetek; intelligens mappák; szkennelés → kereshető |
| **Google Keep** | Android, web · Google | kártyarács, színek + címkék, kitűzés, ellenőrzőlisták, emlékeztetők, rajz, hangjegyzet átirattal, szöveg kinyerése képből (OCR), közreműködők, widgetek, exportálás Docsba | kártyarács rövid jegyzetekhez; widget; OCR fotós jegyzeteken |
| **Microsoft OneNote** | Win, Mac, mobil, web · OneDrive | jegyzetfüzet → szakasz → oldal fa, szabad elrendezésű vászon, tinta + tintából szöveg, a gépelt szöveghez szinkronizált hangfelvétel, OCR képeken és nyomatokon, címkék (Teendő, Fontos…) és címkeösszesítő, oldalverziók, szakaszjelszavak | a gépelés idővonalához szinkronizált hang; címkeösszesítő oldal; jegyzetfüzet/szakasz/oldal hierarchia |
| **Samsung Notes** | Galaxy · Samsung Cloud / OneDrive | S Pen-tinta, PDF-importálás és -jegyzetelés, kézíráshoz kötött hangfelvétel, Galaxy AI összefoglalás / formázás / fordítás, zárolás biometriával | PDF-jegyzetelés (árajánlatok, adatlapok, alaprajzok) |
| **Windows Jegyzettömb / Kurzor-jegyzetek** | Windows | Jegyzettömb: lapok, nem mentett szöveg munkamenet-visszaállítása, könnyű Markdown-formázás; Kurzor-jegyzetek (Sticky Notes): asztali cetlik, OneNote-szinkron | nem mentett szöveg visszaállítása (piszkozat soha ne vesszen el); cetlik |
| **Xiaomi Notes és más gyártói jegyzetek** | a gyártó telefonjai | beszédből szöveg, ellenőrzőlisták, rejtett mappa | — (a felhasználó telefonja Redmi; nincs mit átvenni) |

### 2.2 Mindent egyben munkaterek (blokkok + adatbázisok)

| Termék | Platformok · tárolás | Kiemelkedő funkciók | Átvehető |
|---|---|---|---|
| **Notion** | minden · felhő, zárt | blokkok `/` parancsokkal, adatbázisok tábla / tábla(kanban) / naptár / idővonal / galéria nézettel, relációk és összesítések, sablonok, szinkronizált blokkok, megjegyzések, jogosultságok, webes közzététel, Notion AI (kérdés-válasz a munkatér felett), későn hozzáadott offline mód | `/` parancsmenü; adatbázisnézetek típusos jegyzeteken; sablonok |
| **Evernote** (Bending Spoons) | minden · felhő | webes kivágó, OCR-keresés képekben és PDF-ekben, jegyzetfüzetek + kötegek + címkék, feladatok jegyzeten belül, e-mailből jegyzet, sablonok, dokumentumszkennelés; az ingyenes szint mára erősen korlátozott | webes kivágó; keresés képekben és PDF-ekben; e-mailből jegyzet |
| **Coda** | web · felhő | dokumentum = alkalmazás: képletek, gombok, packek (integrációk), automatizálás | gombok, amelyek egy jegyzetből indítanak valamit |
| **Microsoft Loop** | M365 · felhő | élő komponensek, amelyek szinkronban maradnak, bárhová illesztik be őket (Teams, Outlook) | egy blokk, több helyen megjelenítve (transzklúzió) |
| **Anytype** | minden · local-first, E2E (any-sync), saját szerver lehetősége | objektumok típusokkal és relációkkal, halmazok és gyűjtemények, gráf, P2P-szinkron a LAN-on | típusos objektumok; local-first LAN-szinkronnal |
| **AFFiNE** | minden · local-first, nyílt forrású | dokumentumok és határtalan tábla ugyanazon a tartalmon, adatbázisok | dokumentum ⇄ vászon ugyanazon a tartalmon |
| **AppFlowy** | minden · local-first, nyílt forrású | Notion-szerű blokkok + adatbázisok, saját szerver, helyi MI | — (ugyanaz a gondolat, mint a Notion, nyíltan) |
| **Craft** | Apple, web, Windows | nagyon csiszolt blokkos dokumentumok, kártyák, napi jegyzetek, közzététel | az olvasónézet csiszoltsága |
| **Capacities** | minden · felhő | objektumtípusok (Személy, Könyv, Megbeszélés…) mappák helyett, napi jegyzetek | típusos jegyzetek: *munkajegyzet, ügyfél, eszköz, megbeszélés* |
| **Tana** | web, asztali · felhő | vázlatcsomópontok + „szupercímkék”, amelyek egy csomópontot mezős, típusos rekorddá tesznek, élő keresőlekérdezések, MI a mezőkön, megbeszélés-rögzítés | szupercímkék: egy `#mérés` címke, amely mezőket ad |

### 2.3 Markdown- és local-first tudáseszközök

| Termék | Platformok · tárolás | Kiemelkedő funkciók | Átvehető |
|---|---|---|---|
| **Obsidian** | minden · sima Markdown-mappa („vault”) | wikilinkek, visszahivatkozások, nem hivatkozott említések, gráf, Canvas (nyílt JSON Canvas formátum), Bases (adatbázisnézetek frontmatter-tulajdonságokon), napi jegyzetek, sablonok, 2000+ közösségi bővítmény, Sync (E2E) és Publish fizetős kiegészítőként, a felhasználó saját fájljain dolgozik | **a sima fájlok az igazság**; tulajdonságok a frontmatterben; Bases-szerű nézetek; JSON Canvas |
| **Logseq** | minden · Markdown-fájlok (SQLite-os adatbázis-változat készül) | vázlatkezelő, blokkhivatkozások és -beágyazások, naplók, lekérdezések, PDF-kiemelések, táblák | napi napló mint alapértelmezett kezdőlap; blokkhivatkozások |
| **Roam Research** | web · felhő | a kétirányú blokkhivatkozások és a napi jegyzetek kitalálója | — |
| **Joplin** | minden · helyi SQLite + Markdown-export, nyílt forrású | jegyzetfüzetek, címkék, E2EE, szinkron Nextcloudra / WebDAV-ra / OneDrive-ra / Dropboxra / S3-ra / Joplin Serverre, webes kivágó, bővítmények, jegyzetelőzmények, mellékletek | **szinkron egy sima mappacélra E2EE-vel**; változatelőzmények; nyílt forrású referencia |
| **Standard Notes** (Proton) | minden · felhő, E2E | titkosítás elsőként, jegyzettípusok (Markdown, formázott, kód, táblázat, feladatok), hosszú életű, auditált | egyszerűen megoldott E2E; „Super” szerkesztő |
| **Notesnook** | minden · felhő, E2E, nyílt forrású | zéró tudású szinkron, széf a zárolt jegyzeteknek, alkalmazászár, monográfiák (lejárattal közzétett jegyzetek), emlékeztetők | jegyzetenkénti széf; alkalmazászár |
| **SiYuan** | minden · local-first, nyílt forrású | blokkszintű hivatkozások, SQL-lekérdezések blokkokon, E2E-szinkron, PDF-jegyzetelés | — |
| **Trilium Notes** | asztali, webszerver · SQLite, nyílt forrású | mély hierarchia, egy jegyzet több helyen is élhet (klónok), jegyzettípusok (kód, vászon, relációtérkép, mermaid), szkriptelés, védett (titkosított) jegyzetek, saját szinkronszerver | egy jegyzet több helyen; szkriptelés; védett jegyzetek |
| **Zettlr** | asztali · Markdown | tudományos írás, hivatkozások (Zotero), Zettelkasten-azonosítók | — |
| **Typora · MarkText** | asztali · Markdown | zökkenőmentes élő előnézetű Markdown (a jelölés eltűnik, ahogy elhagyod a sort) | **élő előnézetes szerkesztés** |
| **Bear** | Apple · CloudKit | szövegbe írt beágyazott címkék (`#job/2026/kovacs`), szép témák, OCR-keresés, jegyzettitkosítás | **szövegbe írt beágyazott címkék** |
| **iA Writer · Ulysses** | Apple, Windows (iA) | fókuszmód, a próza szintaxiskiemelése, tartalomblokkok | fókusz- / írógépmód |
| **Drafts** | Apple | üres piszkozattal nyílik („előbb a szöveg, döntés később”), műveletek, amelyek bárhová elküldik a szöveget (e-mail, fájl, API) | **előbb rögzíts, később iktass**; műveletek |
| **Simplenote** | minden · Automattic-felhő | egyszerű, gyors, ingyenes, verziócsúszka | a verziócsúszka felülete |
| **UpNote · Zoho Notebook · Nimbus Note · Amplenote · NotePlan** | különféle | UpNote: gyors, olcsó; Zoho: kártyák; Nimbus: munkaterek + webes kivágások; Amplenote: jegyzetekből pontozott és ütemezett feladatok; NotePlan: Markdown-jegyzetek + naptár + feladatok egy fájlkészletben | Amplenote/NotePlan: feladatok a jegyzetekben, naptárra ütemezve |
| **QOwnNotes · Nextcloud Notes · Zim · CherryTree** | asztali / saját szerver | sima fájlok, Nextcloud-szinkron, wikiszerű hierarchia | — |
| **Memos · Blinko** | saját szerveres web | tweetszerű idővonal rövid jegyzetekből, címkék, API, Telegram-rögzítés | **villámjegyzetek idővonala** (a Gyorsjegyzet napi fájlja már ilyen) |
| **SilverBullet** | saját szerveres web | Markdown a böngészőben élő lekérdezésekkel és Lua-szkripteléssel | lekérdezések jegyzeten belül |
| **Foam · Dendron · VS Code + Markdown** | VS Code | wikilinkek és gráf a kódszerkesztőben, hierarchia fájlnevek szerint | jegyzetek a kód mellett (fejlesztői jegyzetek) |
| **Org-mode (Emacs), Vimwiki** | szövegszerkesztők | sima szöveg napirenddel, TODO-állapotokkal, táblázatokkal, írásos kóddal | TODO-kulcsszavak, napirend a szövegből |

### 2.4 Tinta, kézírás és PDF

| Termék | Kiemelkedő funkciók | Átvehető |
|---|---|---|
| **GoodNotes · Notability** | kereshető kézírás, PDF-jegyzetelés, tintához szinkronizált hang (Notability), sablonok, alakzatok illesztése | tinta egy PDF-alaprajz fölött; hang + tinta visszajátszása |
| **Nebo (MyScript)** | kézírás szöveggé alakítása, diagramok, matematika írás közben | tintából szöveg |
| **Saber · Xournal++** (nyílt forrású) | Saber: platformfüggetlen kézírás (Flutter), E2E; Xournal++: PDF-jegyzetelés asztalon | nyílt referenciák egy tintaréteghez |
| **reMarkable · Supernote · Boox** | e-tinta táblagépek, kézírás-OCR, export | — (hardver) |

### 2.5 MI-alapú és megbeszélés-jegyzetek

| Termék | Kiemelkedő funkciók | Átvehető |
|---|---|---|
| **Mem · Reflect** | MI által rendezett jegyzetek, kapcsolódó jegyzetek felajánlása, csevegés a jegyzetekkel; Reflect: E2E + visszahivatkozások + átiratozás | „kapcsolódó jegyzetek” panel |
| **Granola · Otter · Fireflies · tl;dv** | megbeszélés hangja → átirat → összefoglaló + teendők, összefésülve a felhasználó saját feljegyzett soraival | jegyzetelés hívás közben, utána tisztított jegyzet + feladatok |
| **NotebookLM** | megalapozott kérdés-válasz, összefoglalók és hangos áttekintések a felhasználó forrásai felett | kérdés-válasz egy munka dokumentumai felett, hivatkozásokkal |
| **Notion AI, Copilot a OneNote-ban, Apple Intelligence, Galaxy AI** | átírás, összefoglalás, feladatkinyerés, fordítás | ugyanezek a kis igék egy kijelölésen |

### 2.6 Terep, építőipar és szakmák (a VRG valós munkájához legközelebb)

| Termék | Kiemelkedő funkciók | Átvehető |
|---|---|---|
| **CompanyCam** | fotóközpontú munkajegyzetek kivitelezőknek: minden fotón idő, GPS, projekt; jelölés (nyilak, szöveg), ellenőrzőlisták, előtte/utána, jelentések és oldalak fotókból | **a helyszíni fotó maga a jegyzet**; jegyzetekből épített jelentések |
| **SafetyCulture (iAuditor)** | ellenőrzési sablonok kötelező mezőkkel, aláírások, fotók, pontozás, PDF-jelentés | ellenőrzési / mérési sablonok kötelező mezőkkel |
| **Fieldwire · Procore · Autodesk Construction Cloud (PlanGrid)** | tűk egy rajzon (feladat vagy jegyzet *a terv egy pontján*), hibalisták, lapverziók | **a Planner-terv egy pontjára tűzött jegyzet** |
| **Raken · napló-alkalmazások** | napi helyszíni jelentés: időjárás, csapat, elvégzett munka, fotók, késések | a terepnapló sablonja |
| **Jobber · ServiceTitan** | a csapattal megosztott munkajegyzetek és mellékletek, ügyfél által látható és belső jegyzetek | ügyfél által látható / belső jelző |
| **Fulcrum** | egyedi űrlapok, térinformatikai adatok, offline | offline űrlapok |

---

## 3. Mi lehet egy jegyzet a szövegdobozon túl — a funkciótér

Minden §2-ben látott funkció, családokba rendezve. Az §6 ezekből modulokat csinál; ez itt a szókészlet.

**A. Rögzítés** — globális gyorsbillentyű és tálcaikon, üresen és fókuszban nyíló gyorsjegyzet-ablak, telefonos widget és
zárolóképernyő-csempe, megosztási cél (szöveg, hivatkozások, képek, fájlok), diktálás, hangjegyzet átirattal, fotó- /
dokumentumszkennelés OCR-rel és kiegyenesítéssel, vágólap-rögzítés, webes kivágó (oldal, kijelölés, egyszerűsített cikk,
képernyőkép), e-mailből jegyzet, rögzítés egy másik alkalmazás környezetéből (a forrás), sablonok, „előbb rögzíts, később iktass”
beérkező mappa, NFC- / QR-címke egy eszközön vagy szekrényen, amely megnyitja a jegyzetét.

**B. Írás és szerkesztés** — sima szöveg · Markdown élő előnézettel · formázott blokkok; címsorok, listák, ellenőrzőlisták,
táblázatok, kiemelt kód, matematika (KaTeX), diagramok (Mermaid), kiemelőblokkok, idézetek, elválasztók, beágyazások; `/`
parancsmenü; blokkok húzása; kép beillesztése; keresés és csere; szó- / karakterszám; helyesírás-ellenőrzés (hu + en); fókusz- /
írógépmód; olvasónézet; hivatkozások, címkék és személyek automatikus kiegészítése; tinta- / kézírásréteg; vázlatmód (összecsukás,
egy ágra nagyítás).

**C. Rendezés** — mappák / jegyzetfüzetek, címkék (beágyazott, szövegbe írt), kitűzés, színek, kedvencek, archívum, kuka,
tulajdonságok (típusos mezők), jegyzettípusok (mezős sablonok), intelligens mappák / mentett keresések, rendezés és csoportosítás,
egy jegyzet több helyen, beérkező mappa az iktatatlan jegyzeteknek.

**D. Hivatkozás (tudás)** — wikilinkek `[[ ]]`, visszahivatkozások, nem hivatkozott említések, álnevek, blokkhivatkozások és
-beágyazások (transzklúzió), hivatkozás *külső dolgokra* (fájl, URL, commit, munka), gráfnézet, vászon / tábla, napi jegyzetek,
tartalomtérképek.

**E. Keresés** — teljes szöveges keresés magyar ékezetfeloldással (á→a, ő→o …), közelítő keresés, operátorok (`tag:`, `job:`,
`has:photo`, `before:`), keresés képekben (OCR) és PDF-ekben, szemantikus keresés, legutóbbi és gyakran megnyitott, gyorsváltó,
parancspaletta, találati előnézetek kiemelt találattal.

**F. Feladatok és idő** — jelölőnégyzetek mint feladatok, határidők, emlékeztetők (idő; a telefonon hely), ismétlődés,
jegyzeteken átívelő napirendnézet, naptárnézet, kanban a jegyzetállapotok felett, a napi jegyzet mint a nap kezdőlapja.

**G. Strukturált adatok** — tulajdonságok, adatbázisnézetek (tábla, kanban, naptár, galéria, térkép), űrlapok kötelező mezőkkel,
számított mezők, összesítések (pl. mért értékek összege), egy nézet CSV / JSON exportja.

**H. Média és mellékletek** — képek (jelöléssel), PDF-ek (megtekintés, kiemelés, jegyzetelés), hang (felvétel, a szöveghez
szinkronizált lejátszás), videó, bármilyen fájl; tartalomcímzett tárolás, így ugyanaz a fotó egyszer tárolódik; bélyegképek;
méretkorlátok; EXIF / GPS kezelése.

**I. Megosztás és együttműködés** — jegyzet megosztása hivatkozásként, fájlként, Varler-dokumentumstílusú PDF-ként vagy oldalként;
közzététel lejárattal; megjegyzések; valós idejű közös szerkesztés; jogosultságok; belső és ügyfél által látható.

**J. Eszközök és szinkron** — offline-first, szinkron PC és telefon között, ütközéskezelés, szelektív szinkron (mellékletek
igény szerint), látható szinkronállapot.

**K. Biztonság és adatvédelem** — alkalmazászár, zárolt jegyzetek (jelmondat / biometria), titkosítás tároláskor, végponttól
végpontig titkosítás mindenre, ami elhagyja az eszközt, titokészlelés, személyesadat-tudatosság, kitakarás exportáláskor, napló
arról, hogy ki / mi olvasott egy jegyzetet.

**L. Biztonsági hálók** — automatikus mentés, a nem mentett piszkozat visszaállítása összeomlás után, változatelőzmények
különbségnézettel és visszaállítással, kuka megőrzési idővel, ütközési másolatok, mentések, integritás-ellenőrzés, az alkalmazás
nélkül is olvasható.

**M. Átjárhatóság** — importálás (Markdown-mappák, Obsidian-tárolók, Evernote ENEX, Google Keep Takeout, OneNote exporton át,
Apple Notes export, Joplin JEX / RAW, sima szöveg), exportálás (Markdown + mellékletek, HTML, PDF, JSON), stabil nyílt formátumok
(Markdown, YAML frontmatter, JSON Canvas).

**N. Automatizálás és bővítés** — URL-séma / mélyhivatkozások, műveletek (jegyzet küldése levélbe, a Plannerbe, egy
munkamappába, commit-üzenetbe), API más eszközöknek, bővítmények, ütemezett feladatok (pl. heti összesítő), webhookok.

**O. MI** — összefoglalás, átírás, fordítás, cím- és címkejavaslat, feladatkinyerés, diktált jegyzet rendbetétele,
kérdés-válasz a jegyzetek felett hivatkozásokkal, kapcsolódó jegyzetek, hangátirat.

**P. Élmény** — témák (Mélyvíz), sötét / világos, sűrűség, billentyűzet-központúság, akadálymentesség (képernyőolvasó,
betűméret, kontraszt), widgetek, sebesség (megnyitás 200 ms alatt, akadásmentes gépelés 10 000 jegyzetnél), magyar felület.

---

## 4. Ami kifejezetten a VRG-hez illik

Az általános piac *második agyat* épít. A VRG jegyzeteinek három valódi feladata van, és a tervnek ezeket kell kiszolgálnia,
mielőtt bármi általánosat:

1. **Terepjegyzetek villanyszerelési munkákhoz** — a helyszínen, telefonon, gyakran offline, gyakran kesztyűben és fotóval: mit
   mértek, mit találtak, mit kért az ügyfél, mit kell megvenni. Egy **munkához** tartoznak (`H:\VRG\Full\jobs\…`), és gyakran a
   **terv egy pontjához**. **Az ügyfél személyes adatait** hordozzák.
2. **Irodai jegyzetek** — hívások ügyfelekkel és beszállítókkal, az árajánlat indoklása, árfeltárások; ezek táplálják a
   Költségvetési Tervezetet, az Árajánlatot és a munkanyilvántartást.
3. **Fejlesztői jegyzetek** — amit a meglévő Desktop fejlesztőijegyzet-ablak és a Divergence már most csinál: ötletek,
   megállapítások, TODO-k a kódról, Stack-csomópontokhoz, commitokhoz, ágakhoz kötve.

Ebből adódnak a csak VRG-s funkciók (amelyek egyetlen piaci alkalmazásban sincsenek meg, mert a VRG eszközkészlet többi részére
van szükségük):

| Ötlet | Hogyan működik | Mit használ újra |
|---|---|---|
| **Jegyzet ↔ munka** | minden jegyzet megnevezhet egy munkaazonosítót; a munkamappa mutatja a jegyzeteit; egy új munka kap egy jegyzetszakaszt; a munka ajánlata idézhet egy jegyzetet | munkanyilvántartás, `jobs\` mappák |
| **Tű a Planner-terven** | egy Planner-elemhez (helyiség, áramkör, eszköz, kábelnyomvonal) vagy egy lap x/y pontjához horgonyzott jegyzet — Fieldwire-szerű tűk rétegként a Plannerben; egy tűre koppintva megnyílik a jegyzet | Planner-elemazonosítók, Views |
| **Jegyzet ↔ Készlet / BuildTree** | `[[inv:…]]` hivatkozás egy készletcikkre; a „venni” ellenőrzőlista-sorokból bevásárlólista-sorok lesznek | Készlet (Inventory) |
| **Helyszíni fotó környezettel** | az Átadás már most mozgat fotókat; a Jegyzetek ráírja az időt, a munkát, opcionálisan a GPS-t, jelölőréteget ad (nyilak, szöveg, méretek), előtte/utána párokat | Átadás, FileStore |
| **Mérési sablonok** | típusos jegyzettípusok kötelező mezőkkel (pl. felmérés, átadás, szigetelési / hurokimpedancia-mérési sorkészlet) → táblázat, amely CSV-be és Varler-stílusú PDF-jelentésbe exportálható | Varler-dokumentumstílus (`shared/varler-doc`) |
| **Terepnapló** | egy munkanap napi jegyzete: kik voltak ott, órák, elvégzett munka, fotók, akadályok — Raken-szerűen; munkánként összesítheti az órákat | napijegyzet-modul |
| **Hivatkozás a munkagráfra** | `[[F:…]]`, `[[L:…]]`, `[[R:5ee8b1e]]`, `[[C:Planner/src]]` Stack-csomópontokra mutat; a jegyzetek Stack-réteggé (`N`) válnak, így a `stack_search` megtalálja őket, és egy csomópont kártyája felsorolja a jegyzeteit | Stack, vrg-stack MCP |
| **Telefonról PC-re azonnal, felhő nélkül** | a telefonon írt jegyzet egy másodpercen belül megjelenik a Desktopon a párosított, aláírt relén át, ha azonos hálózaton vannak; a felhős útvonal csak tartalék | relé M2/M7, bizalmi kapu |
| **Desktop-rögzítés bárhonnan** | a meglévő „mentés fejlesztői jegyzetként” ablakból univerzális rögzítő lesz: terminálkijelölésből, csevegőválaszból, levélből, weboldalról, fájlból, Stack-csomópontból — a jegyzet megtartja a forrást | `note.js` forrásfajták |
| **Hang a helyszínen, magyarul** | diktálás (már hu-HU) plusz a jegyzettel együtt megtartott hangfelvétel, amit később a PC átiratoz, ha a telefon nem tette meg | Gyorsjegyzet 🎤 |
| **QR / NFC egy szekrényen** | egy villamos elosztószekrényben lévő matrica a telefonon megnyitja az adott berendezés jegyzetét (`vrg://notes/open?id=…`) | Links-útválasztás, QR (M2-szkenner) |
| **Paletta, tárcsa, dokk** | a `notes` egy katalógusazonosító: „Új jegyzet” palettasor, dokkikon, Sarokvezérlő-sor a Munka alatt; az Esc / dupla Tab szabályok betartva | katalógus, paletta |
| **Commit-üzenet jegyzetekből** | a nap fejlesztői jegyzetei commit-törzs piszkozataként felajánlva; ággal címkézett jegyzetek | vrg-git, Divergence |
| **Ügyfél által látható export** | egy *ügyfélnek* jelölt jegyzet tiszta Varler-PDF-ként exportálható; belső jegyzetek soha nem kerülnek bele | varler-doc |
| **Az ügynökök olvashatnak (és csak olvashatnak)** | a Claude-munkamenetek a Stacket kérdezik, nem a tárolót; egy privátnak jelölt jegyzet soha nem kerül a Stack-indexbe vagy egy ügynök kontextusába | Stack-építő szabályai |

Amire a VRG-nek **korán nincs** szüksége: valós idejű többfelhasználós közös szerkesztés, nyilvános webes közzététel,
bővítménypiac, saját táblamotor (ott a MindMap), kézírás-felismerés.

---

## 5. A háttér — stabil kód, biztonság, tartalék

### 5.1 Hol élnek a jegyzetek

**Javaslat: a sima fájlok az igazság, minden index újraépíthető.** Ez az Obsidian, a Joplin exportja, a Bear és minden olyan
alkalmazás tanulsága, amely megszűnt, és magával vitte a felhasználói jegyzeteit (a Skiff Notes 2024-ben bezárt; az Evernote
megváltoztatta a feltételeit).

```
H:\VRG\Full\jegyzetek\              <- a tároló: a fő repón KÍVÜL (ügyféladat soha nem érheti el az origint)
  .vault.json                        formátumverzió, tárolóazonosító, létrehozás ideje, kulcsellenőrzés (titkosításkor)
  notes\
    01JC8Z…Q.md                      egy jegyzet = egy fájl, az azonosítója (ULID) szerint elnevezve, soha nem a címe szerint
  att\
    sha256\ab\ab12…f9.jpg            mellékletek, tartalomcímzetten: ugyanaz a fotó egyszer tárolódik; név = hash
  journal\
    2026-11-10.jsonl                 csak hozzáfűzhető műveletnapló (létrehozás / szerkesztés / áthelyezés / törlés), szinkronhoz és helyreállításhoz
  trash\                             törölt jegyzetek 30 napig megőrizve (áthelyezve, nem eltávolítva)
  .index\                            SQLite FTS5 (Desktop) — eldobható, eltéréskor újraépül a notes\ alapján
  .history\                          tömörített korábbi változatok, vagy a tároló a saját helyi git-repója (Q04)
```

Egy jegyzetfájl:

```markdown
---
id: 01JC8Z5M7Q3T8K2V9WXYZABCDE
title: Kovács lakás — elosztó felmérés
type: felmeres            # jegyzettípus (N-TYPE modul); alapértelmezés "note"
tags: [job/2026/kovacs, eloszto]
job: 2026-031             # opcionális hivatkozások a VRG világára
plan: { file: kovacs.vrgplan, el: "circuit:K3" }
visibility: internal      # internal | client | private (private = a Stack soha nem indexeli, titkosítatlanul soha nem szinkronizálódik az eszközről)
created: 2026-11-10T09:14:03+01:00
updated: 2026-11-10T09:31:40+01:00
rev: 7                    # jegyzetenkénti változatszámláló
base: 9f2c…               # annak a szövegnek a hash-e, amelyre ez a változat íródott (háromutas összefésüléshez)
device: pc-witoo          # ki írta ezt a változatot
---
Elosztó: 3×16 A … 
- [ ] FI-relé csere (30 mA)  📅 2026-11-14
![[att:ab12…f9.jpg]]
```

Miért ilyen alakú:

- **A Markdown + YAML frontmatter** olvasható a Jegyzettömbben, a VS Code-ban, az Obsidianben, a GitHubon, 20 év múlva is. Ha az
  alkalmazás elromlik, semmi sem vész el: ez *maga* a tartalék.
- **ULID / UUIDv7 azonosítók mint fájlnevek**: egy jegyzet átnevezése nem változtat útvonalat, a hivatkozások soha nem törnek el,
  két eszköz nem választhatja ugyanazt a nevet.
- **Tartalomcímzett mellékletek**: az integritás ellenőrizhető (újrahash = fájlnév), a duplikátumok eltűnnek, a szinkron
  kihagyhatja, ami a másik oldalon már megvan.
- **Az index gyorsítótár.** Verzióeltérésnél, hiányzó fájlnál vagy sikertelen integritás-ellenőrzésnél eldobódik és újraépül.
  Nincs olyan felhasználói adat, amely csak az indexben létezik.

**A telefonon:** ugyanez a modell egy Room / SQLite adatbázisban (gyors listák, FTS4/5 a kereséshez), **plusz** ugyanazok a
Markdown-fájlok minden változáskor kiexportálva az alkalmazás privát tárhelyére, így egy telefonmentés vagy egy USB-s másolat is
olvasható jegyzet marad. A telefon replikát tart; a PC-s tároló az otthoni példány.

### 5.2 Biztonságos írás (nincs elveszett billentyűleütés, nincs félig írt fájl)

| Szabály | Hogyan |
|---|---|
| Atomi mentés | `x.md.tmp` írása → flush + fsync → átnevezés `x.md`-re (a `secrets.js` már ezt a mintát használja; fsync hozzáadva). Windows: a `fs.renameSync` NTFS-en, azonos köteten atomian cserél |
| Automatikus mentés | 400–800 ms késleltetés az utolsó billentyűleütés után, plusz fókuszvesztéskor, panelzáráskor, ablakzáráskor, felfüggesztéskor |
| Piszkozatnapló | minden gépelési löket először egy jegyzetenkénti piszkozatnaplóba kerül; induláskor a jegyzeténél újabb piszkozatot visszaajánlja („Visszaállítsam?”) — a Jegyzettömb munkamenet-visszaállításának ötlete |
| Egy író | az Electron fő folyamata birtokolja a tárolót (az oldal szavakat küld, soha nem útvonalakat — a meglévő CONTRACT); egy PID-et tartalmazó zárolófájl véd egy második Desktop-példány vagy egy egyidejűleg író CLI ellen |
| Külső szerkesztések | egy fájlfigyelő észreveszi, ha egy jegyzetet kívülről szerkesztettek (VS Code, Obsidian, egy szkript); tiszta → újratöltés; a szerkesztőben módosított → ütközési sáv, soha nincs csendes felülírás |
| Méretkorlátok | a jegyzetszöveg korlátozott (pl. 2 MB), a melléklet is (pl. 200 MB), elérésükkor világos magyar üzenet |
| Sémaverzió | `.vault.json` `format: 1`; verziónként egy migrációs lépés, előbb egy másolaton futtatva, az eredeti a `trash\migrations\<stamp>` alatt megmarad |
| Soha ne törölj | törlés = áthelyezés a `trash\`-be; a kuka csak 30 nap után ürül, *és* csak akkor, ha egy sikeres BACKUP-futás lefedte a jegyzetet |

### 5.3 Szinkron

Három csatorna, előnyben részesítési sorrendben. Mindegyik ugyanazt viszi: **műveleteket a naplóból** (vagy teljes
jegyzetváltozatokat), soha nem „a mappát”.

| Csatorna | Mikor | Biztonság |
|---|---|---|
| **1. LAN-relé** (telefon ↔ PC) | azonos hálózat vagy a telefon hotspotja; azonnali | már párosítva P-256 kulcsokkal és aláírt üzenetekkel; ehhez jön a tartalom titkosítása (ECDH a két eszközkulcs között → AES-GCM), így egy jegyzet a vezetéken még a LAN-on belül is olvashatatlan |
| **2. OneDrive / Megosztott mappa** | PC ↔ egy másik PC vagy laptop | csak titkosított csomagfájlok (`sync\<device>\<seq>.vnote`), soha nem sima jegyzetek a OneDrive-on |
| **3. Privát GitHub-ág** | a telefon messze van, a PC ki van kapcsolva; ezt az útvonalat használja ma a Gyorsjegyzet | **csak E2E-titkosított tartalom**; sima szöveg csak a kifejezetten *dev* `visibility`-jű jegyzeteknél (a meglévő `mobile-log` / `vrg-devnotes` viselkedés, „fejlesztői kimenetként” megtartva) |

**Ütközések.** Minden jegyzet hordozza a `rev` + `base` mezőt (annak a szövegnek a hash-e, amelyből szerkesztették):

1. Mindkét oldalon azonos alap → előrehúzás (fast-forward).
2. Egy alapból eltérő szerkesztések → **soronkénti háromutas összefésülés** (diff3); a tisztán összefésült szöveg mentődik, a
   jegyzet csendes „összefésülve” jelet kap az előzményeiben.
3. Átfedő szerkesztések → a beérkező változat **ütközési másolatként** mentődik, a jegyzetből hivatkozva, egymás melletti
   nézettel; a felhasználó választ. Semmi sem vész el soha.
4. A frontmatter-mezők mezőnként fésülődnek össze (címkék = unió, a törlések sírkőként rögzítve).

Egy **CRDT** (Yjs vagy Automerge, mindkettő MIT) karakterszintű összefésülést és élő közös szerkesztést adna, de az igazságot
bináris dokumentumformátumba költöztetné. Javaslat: előbb diff3 + ütközési másolatok (egyszerű, a fájlok maradnak az igazság);
CRDT csak akkor, ha két embernek egyszerre kell ugyanazt a jegyzetet szerkesztenie (Q06).

### 5.4 Biztonság

A VRG számára valós fenyegetések, sorrendben: (1) **ügyfél személyes adatainak kiszivárgása** a GitHubra / a OneDrive-ra / egy
képernyőképre; (2) **elveszett vagy ellopott telefon**; (3) **rosszindulatú tartalom** egy beillesztett vagy kivágott jegyzetben,
amely szkriptet futtat a Desktop héjában; (4) jegyzetbe gépelt, majd szinkronizált vagy indexelt titkok (jelszavak, tokenek);
(5) egy ügynökmunkamenet, amely privát jegyzeteket húz be egy promptba.

| Intézkedés | Részlet |
|---|---|
| Láthatósági szintek | `private` · `internal` (alapértelmezés) · `client` (megjelenhet ügyfélexportokban) · `dev` (sima szövegként mehet a fejlesztői ágakra). Munkaazonosítós jegyzet alapértelmezése `internal` |
| Titkosítás tároláskor (bekapcsolható tároló, a 2–3. szinkroncsatornához kötelező) | jegyzetenkénti AES-256-GCM véletlen jegyzetkulccsal, a tárolókulccsal becsomagolva; a tárolókulcs egy jelmondatból származik **scrypt**-tel (Node beépített) vagy Argon2id-vel (vendorolt WASM), és DPAPI-val (`safeStorage`) becsomagolva tárolódik a PC-n, a Keystore-ban a telefonon, így a mindennapi használathoz nem kell jelmondat |
| Zárolt jegyzetek | jegyzetenkénti külön jelmondat / biometria (Android BiometricPrompt, később Windows Hello); a tartalom soha nincs az indexben, a cím helyett „Zárolt jegyzet” áll |
| Alkalmazászár a telefonon | biometria / PIN N perc háttérben töltött idő után; `FLAG_SECURE` a zárolt jegyzeteken (nincs képernyőkép, rejtve a legutóbbi alkalmazások nézetében) |
| Eszközfelvétel | egy új eszköz a tárolókulcsot csak a párosított relén át kapja meg (ECDH, mindkét képernyőn megjelenő kóddal megerősítve), soha nem levélben vagy fájlban |
| Megjelenítés | Markdown → HTML egy fertőtlenítőn (DOMPurify) át engedélylistával; szigorú CSP a Jegyzetek oldalon (nincs beágyazott szkript, nincs távoli szkript); távoli képek alapból tiltva (követőpixelek a kivágott oldalakban), „képek mutatása” jegyzetenként; a hivatkozások a héjon kívül nyílnak; `vrg-app://` bezárás, mint a többi héjon belüli alkalmazásnál |
| Titokészlelő | ugyanazok a minták, mint a `vrg-git.ps1`-ben (tokenek, privát kulcsok, `password=`) figyelmeztetnek, ha egy jegyzet ilyet tartalmaz, és kizárják minden sima szöveges csatornából |
| Személyesadat-őr | egy könnyű felismerő (nevek címek mellett, telefonszámok, e-mail, magyar adóazonosító- / igazolványformátumok) `internal` / `private` szintet javasol; az ügyfélexportok kitakarási előnézetet futtatnak |
| Stack és ügynökök | a Stack-építő alapból csak az `internal` / `dev` jegyzetek címét és címkéit indexeli, `private` jegyzeteket soha, `client` munkák jegyzettörzsét csak külön engedélyre |
| Napló (audit) | csak hozzáfűzhető napló az exportokról, megosztásokról, zárolt jegyzetek visszafejtéséről, eszközfelvételekről (a héjnak már van `audit.js`-e) |
| Ellátási lánc | minden szerkesztő- / elemzőkönyvtár a `vendor-manifest.json`-on át vendorolva, pontos npm-verzióval + sha512-vel, ahogy a repó szabálya előírja |

### 5.5 Tartalék és helyreállítás (mi történik, ha valami elromlik)

| Hiba | Ami továbbra is működik |
|---|---|
| A Jegyzetek alkalmazás / a Desktop nem indul | a tároló egy Markdown-fájlokból álló mappa: a START tartalék kap egy „Jegyzetek mappa megnyitása” pontot (megnyitja a mappát) és egy sima szöveges keresőszkriptet (`node tools/notes-find.js <szavak>`) |
| Sérült / régi verziójú index | induláskor eldobódik és újraépül; folyamatjelző értesítés; a keresés vár, a szerkesztés nem |
| Áramszünet mentés közben | a tmp + átnevezés miatt vagy a régi, vagy az új fájl marad, soha nem félig írt; a piszkozatnapló visszaállítja az utolsó leütéseket |
| A szinkronpartner offline | a kimenő sor sorban tartja (a Gyorsjegyzet kimenő sora már ezt csinálja, a 2026-10-31-én megtanult lineáris visszalépéssel és folytatáskori ürítéssel) |
| Elromlott szinkron | ütközési másolatok, soha nincs felülírás; minden szinkronköteg a naplóban van, így egy rossz köteg visszavonható |
| Elveszett titkosítási kulcs | a tároló létrehozásakor egyszer kinyomtatott helyreállítási kulcs (24 szó vagy QR-kód) — nélküle a titkosított jegyzetek elvesznek, ezt a beállításkor világosan ki kell mondani |
| Lemez- / meghajtóvesztés | a BACKUP tükrözi a tárolómappát (a `jegyzetek` felvétele a mentés `work` listájára); ha a tároló helyi git-repó, `git push --all` a `Backup\code\jegyzetek.git`-be, mint bármely repónál, `fsck`-val az integritási lépésben |
| Elveszett telefon | a PC-n megvan a teljes példány; a telefon párosításának bontása (bizalmi kapu) és a tárolókulcs cseréje |
| Rossz migráció | a migráció egy másolaton futott; az eredeti a `trash\migrations` alatt van |

### 5.6 A kód alakja (hogy stabil maradjon)

- **Tiszta mag, vékony héjak.** Egy tiszta JS-mag (`shared/notes-core/`: frontmatter elemzése / szerializálása, hivatkozások,
  címkék, összefésülés, keresési tokenizálás magyar ékezetfeloldással, a láthatósági szabályok), `node --test`-tel tesztelve; egy
  tiszta Kotlin-mag (`kit-core/notes/`) ugyanazokkal a szabályokkal és **ugyanazokkal az aranytesztfájlokkal** (egy közös
  `test/fixtures/*.md` készlet, amelyet mindkét oldalnak azonosan kell elemeznie). A felület mindkét oldalon csak a magot hívja.
- **A fő folyamaté az I/O** a Desktopon (a `shell/lib/notes.js` tárolószolgáltatássá nő; az oldal `{ id, text }`-et küld, soha nem
  útvonalat) — egyezik a meglévő CONTRACT §3 / §4.1-gyel.
- **Egy szerkesztő, két gazda (Q05).** A szerkesztő (CodeMirror 6, MIT) a `shared/notes-editor/` alatt él, és a Desktop-oldalon,
  valamint teljes szerkesztéshez egy bezárt Android WebView-ban fut; a telefon a gyors rögzítéshez natív Compose-mezőt tart meg
  (a mostani Gyorsjegyzet-képernyő).
- **Eldobható tárolók a tesztekben** a `%TEMP%\VRG\notes-*` alatt, soha nem a valódi tároló (ugyanaz a szabály, mint a git- és a
  mentéstesztekben).
- **Kínzótesztek**: a folyamat leölése mentés közben; két író; 10 000 jegyzetes tároló a sebességhez; egy jegyzet minden
  Markdown-szerkezettel; kivágott HTML szkripttel / eseménykezelőkkel (ártalmatlanul kell megjelennie); háromutas
  összefésülési korpusz.
- **Nyilvántartási kötelesség**: egy `notes` bejegyzés a `launcher/vrg-menu.json`-ban + a `vrg-catalog.json`-ban (utána
  `node tools/check-start.js`, `node tools/check-catalog.js`, `node tools/build-hub.js`), a Mobile `Catalogue` sora, egy
  Stack-réteg — ugyanabban a változtatásban, amely az alkalmazást hozzáadja.

---

## 6. A moduláris funkciólista

Minden modul önállóan megépíthető, tesztelhető és bekapcsolható. **Szint**: `0` = mag (minden más előtt kell) · `1` = első
használható változat · `2` = erős második hullám · `3` = később / csak ha kell. **Hol**: D = Desktop, M = Mobile, D+M mindkettő.
**Ráépül**: meglévő VRG-elemek, amelyeket újrahasznosít.

### 6.1 Mag (0. szint)

| Azonosító | Modul | Mi ez | Hol | Ráépül |
|---|---|---|---|---|
| N-VAULT | Tároló és jegyzetmodell | a mappaszerkezet, a jegyzetfájl (ULID-név, YAML frontmatter, Markdown-törzs), `.vault.json` a formátumverzióval, a zárolófájl | D+M | — |
| N-STORE | Biztonságos író | atomi mentés (tmp + fsync + átnevezés), automatikus mentés késleltetéssel, piszkozatnapló és visszaállítás, méretkorlátok, külsőszerkesztés-figyelő | D+M | a `secrets.js` mentési mintája |
| N-ATT | Melléklettár | tartalomcímzett `att/sha256/…`, bélyegképek, duplikátumszűrés, újrahash-ellenőrzés, méretkorlát | D+M | az Átadás ellenőrzőösszege |
| N-INDEX | Index | SQLite FTS5 (D) / Room FTS (M), újraépíthető, magyar ékezetfeloldás, növekményes frissítés a figyelőből | D+M | — |
| N-TRASH | Kuka és törlési szabályok | áthelyezés a `trash\`-be, 30 napos megőrzés egy lefedő mentéshez kötve, visszaállítás | D+M | BACKUP |
| N-API | Tárolószolgáltatás | fő folyamati IPC a Desktopon (`notes.list/get/save/move/delete/search`), Kotlin-repository a telefonon; az egyetlen kód, amely fájlokhoz nyúl | D+M | CONTRACT §3, `shell/lib/notes.js` |
| N-CORE-TEST | Közös aranyfixtúrák | egy fixtúrakészlet, amelyet mindkét magnak azonosan kell elemeznie és szerializálnia; kínzótesztek | D+M | `node --test`, kit-core tesztek |

### 6.2 Rögzítés

| Azonosító | Modul | Mi ez | Szint | Hol | Ráépül |
|---|---|---|---|---|---|
| N-QUICK | Gyorsjegyzet-ablak | globális gyorsbillentyű + tálcapont + „Új jegyzet” palettasor → kis, fókuszált ablak, az Esc ment és bezár | 1 | D | `quick.js`, `tray.js`, paletta |
| N-INBOX | Beérkező mappa | az iktatatlan jegyzetek a *Beérkezett* alá kerülnek; később egy billentyűvel iktathatók munka / címke szerint | 1 | D+M | — |
| N-SOURCE | Rögzítés forrással | „mentés jegyzetként” bármely panelről megtartja a forrást (`url`, `file`, `node`, `term`, `chat`, `mail`) tulajdonságként és visszahivatkozásként | 1 | D | `note.js` ablak |
| N-PHONE | Telefonos rögzítés | a mai Gyorsjegyzet-képernyő a tárolómodellbe ír (szinkronon át) a napi napló helyett / mellett; címkecsipek; az offline kimenő sor megmarad | 1 | M | M6 |
| N-SHARE | Megosztási cél | szöveg, hivatkozások, képek, fájlok bármely Android-alkalmazásból → új jegyzet (szövegre már van; képek és fájlok hozzáadása) | 1 | M | M6, FileStore |
| N-WIDGET | Widget és csempe | kezdőképernyő-widget (új jegyzet, új hangjegyzet, új fotós jegyzet) és Gyorsbeállítások-csempe | 2 | M | — |
| N-VOICE | Hangjegyzet | hangfelvétel a jegyzetbe (Opus/M4A), hu-HU diktálás, mint most, lejátszás; átirat később a PC-n | 2 | D+M | M6 🎤 |
| N-SCAN | Fotó- és dokumentumszkennelés | kamera → kiegyenesítés → jegyzet a képpel; az OCR-szöveg mellette tárolva a kereséshez | 2 | M | CameraX + ML Kit (M2) |
| N-CLIP | Webes kivágó | a Desktop böngészőpaneljéről: oldal Markdownként (readability), kijelölés, képernyőkép, URL címmel | 2 | D | `web.js`, `textify.js` |
| N-MAILIN | Levélből jegyzet | „mentés jegyzetként” a levélpanelen (törzs + mellékletek, a feladó mint forrás) | 2 | D | `mail.js`, `mailview.html` |
| N-TAG-QR | QR- / NFC-címkék | QR nyomtatása (vagy NFC-címke írása) egy jegyzethez; beolvasáskor megnyílik (`vrg://notes/open?id=`) | 3 | M | Links, M2-szkenner |

### 6.3 Írás és szerkesztés

| Azonosító | Modul | Mi ez | Szint | Hol | Ráépül |
|---|---|---|---|---|---|
| N-EDIT | Szerkesztőmag | CodeMirror 6 Markdownnal, élő előnézet (a jelölés elhalványul az aktuális soron kívül), visszavonási előzmények, keresés / csere, szószám | 1 | D (+M WebView) | vendorolt CM6 |
| N-CHECK | Ellenőrzőlisták | `- [ ]` kattintással / koppintással átkapcsolva, haladás a jegyzetkártyán | 1 | D+M | — |
| N-SLASH | `/` parancsmenü | címsor, ellenőrzőlista, táblázat, kód, kiemelőblokk, dátum, fotó, hivatkozás munkára… | 1 | D+M | — |
| N-TABLE | Táblázatok | Markdown-táblázatok rácsként szerkesztve; beillesztés Excelből / CSV-ből | 2 | D | — |
| N-CODE | Kódblokkok | kiemelés (CM6-nyelvek); másolás gomb; jó fejlesztői jegyzetekhez és konfigurációs részletekhez | 1 | D | — |
| N-MATH | Matematika és mértékegységek | KaTeX; plusz egy apró soron belüli számológép (`= 3*16 A`) — terhelésösszegekhez hasznos | 3 | D | vendorolt KaTeX |
| N-DIAG | Diagramok | Mermaid-blokkok megjelenítve az olvasónézetben | 3 | D | vendorolt Mermaid |
| N-SPELL | Helyesírás-ellenőrzés hu + en | az Electron beépített helyesírás-ellenőrzője hu-HU szótárral; az Android rendszerellenőrzője | 2 | D+M | Electron |
| N-FOCUS | Fókusz- és olvasómód | írógép- / fókuszmód, tiszta olvasónézet, betűméret | 2 | D+M | VRG UI Kit |
| N-INK | Tintaréteg | rajzolás jegyzetre vagy fotóra / tervképre ujjal vagy tollal; SVG-ként tárolva a jegyzet mellett | 3 | M (+D nézet) | — |
| N-ANNOT | Fotójelölés | nyilak, keretek, szöveg, mérővonal egy helyszíni fotón; az eredeti megmarad, a jelölés rétegként | 2 | M (+D) | — |
| N-PDF | PDF-jegyzetelés | PDF-melléklet megnyitása, kiemelés, megjegyzés, jegyzet tűzése egy oldalra | 3 | D | `Vendor/pdfjs` (legacy build) |

### 6.4 Rendezés és hivatkozás

| Azonosító | Modul | Mi ez | Szint | Hol | Ráépül |
|---|---|---|---|---|---|
| N-TAG | Címkék | szövegbe írt beágyazott címkék (`#job/2026/kovacs`) + frontmatter-címkék, címkefa az oldalsávban, címke átnevezése mindenhol | 1 | D+M | — |
| N-PIN | Kitűzés, színek, kedvencek, archívum | a kis rendező igék | 1 | D+M | — |
| N-FOLDER | Mappák | tulajdonságként, nem könyvtárként tárolt virtuális mappák (a fájlok laposak maradnak); az egyszerű felszín része (SIMPLE.hu.md) | 1 | D+M | — |
| N-LINK | Wikilinkek és visszahivatkozások | `[[cím]]` automatikus kiegészítéssel, visszahivatkozás-panel, nem hivatkozott említések, álnevek, átnevezésbiztos (a háttérben azonosító szerint hivatkozik) | 1 | D (+M nézet) | — |
| N-XLINK | Hivatkozás a VRG világára | `[[job:2026-031]]`, `[[inv:…]]`, `[[plan:kovacs#K3]]`, `[[F:…]]` / `[[R:sha]]` (Stack-azonosítók), `[[file:…]]`; mindegyik a katalóguson / a `desktop.open`-en át nyílik | 1 | D | katalógus, Stack-azonosítók |
| N-EMBED | Beágyazás / transzklúzió | `![[jegyzet#címsor]]` egy másik jegyzet részét mutatja a szövegben (Loop / Obsidian ötlet) | 3 | D | — |
| N-GRAPH | Gráfnézet | a hivatkozási gráf; vagy a jegyzetek átadása a Stack meglévő nézegetőinek egy új helyett | 3 | D | Stack, MindMap |
| N-CANVAS | Vászon | jegyzetek kártyaként egy táblán, JSON Canvasként (nyílt formátum) mentve; a MindMap a gazda | 3 | D | MindMap / MindMD |
| N-DAILY | Napi jegyzet | naponta egy jegyzet mint kezdőlap; a nap villámjegyzetei (a Gyorsjegyzet idővonala) benne összegyűjtve | 1 | D+M | M6 napi fájlok |
| N-TYPE | Jegyzettípusok (mezős sablonok) | egy típus = sablon + típusos tulajdonságok + kötelező mezők (Tana-szupercímkék / Capacities-objektumok): *jegyzet, felmérés, mérés, átadás, telefon, ötlet, dev* | 2 | D+M | — |
| N-SMART | Mentett keresések / intelligens mappák | az oldalsávban megtartott keresés (`job:2026-031 has:photo`) | 2 | D+M | N-INDEX |

### 6.5 Keresés

| Azonosító | Modul | Mi ez | Szint | Hol | Ráépül |
|---|---|---|---|---|---|
| N-FIND | Keresés | teljes szöveges, ékezetfeloldással, kiemelt részletekkel, operátorokkal (`tag:`, `job:`, `type:`, `has:photo`, `before:`, `is:task`) | 1 | D+M | N-INDEX |
| N-SWITCH | Gyorsváltó | bármely jegyzet megnyitása cím szerint gépeléssel (Ctrl+O stílusban), a legutóbbiak elöl | 1 | D | paletta |
| N-PALETTE | Paletta és globális keresés | a jegyzetek megjelennek a Desktop palettájában és a héj keresési találataiban | 1 | D | `palette.js`, `search.js` |
| N-OCR | Keresés képekben és PDF-ekben | szkennelések / fotók OCR-szövege és a PDF-szöveg az indexbe | 2 | D+M | ML Kit (M), pdfjs (D) |
| N-STACK | Jegyzetek mint Stack-réteg | a Stack-építő beolvassa a jegyzetek címét / címkéit / hivatkozásait (láthatóság szerint) → `N` réteg; egy csomópont kártyája mutatja a jegyzeteit; a `stack_search` megtalálja őket | 2 | D | Stack |
| N-SEM | Szemantikus keresés | helyi beágyazások a „ehhez hasonló jegyzetek” kereséshez — csak ha a teljes szöveges keresés kevésnek bizonyul | 3 | D | — |

### 6.6 Feladatok, idő és emlékeztetők

| Azonosító | Modul | Mi ez | Szint | Hol | Ráépül |
|---|---|---|---|---|---|
| N-TASK | Feladatok a jegyzetekben | egy dátumos (`📅 2026-11-14`) vagy prioritásos jelölőnégyzet-sor feladat; egy napirend az összes jegyzeten át | 2 | D+M | N-CHECK |
| N-REMIND | Emlékeztetők | egy jegyzeten vagy feladaton lévő időpont → telefonos értesítés (M10-csatorna) és Desktop-értesítés | 2 | D+M | M10 `VrgNotify`, `toasts.js` |
| N-CAL | Naptárnézet | jegyzetek és feladatok naponként; terepnapló-napok munkánként | 3 | D | — |
| N-BOARD | Állapottábla | kanban egy tulajdonság felett (pl. *nyitott → rendelve → kész*) | 3 | D | N-TYPE |
| N-BUY | Bevásárlósorok | `- [ ] 2× FI-relé 30 mA #vesz` sorok bevásárlólistába gyűjtve; később átadva a Készletnek | 3 | D+M | Készlet (Inventory) |

### 6.7 A VRG-munka integrációja

| Azonosító | Modul | Mi ez | Szint | Hol | Ráépül |
|---|---|---|---|---|---|
| N-JOB | Munkához kötés | `job:` tulajdonság, a munka jegyzetei a mappanézetében és a munkanyilvántartásban; új jegyzet egy munkából | 1 | D+M | munkanyilvántartás, `jobs\` |
| N-PLANPIN | Tűk a terven | Planner-elemhez vagy laphelyzethez horgonyzott jegyzet; tűréteg a Plannerben; bármelyik oldalról megnyitható | 2 | D (+M nézet) | Planner, Views |
| N-SITE | Helyszíni fotós jegyzetek | fotó + idő + munka + opcionális GPS + jelölés; előtte/utána párok; egy munka fotógalériája | 2 | M (+D) | Átadás, N-ANNOT |
| N-MEAS | Mérési űrlapok | jegyzettípusok, amelyek mezői táblázatot alkotnak (áramkör, érték, határérték, megfelelt/nem felelt meg); CSV-export | 2 | D+M | N-TYPE |
| N-DIARY | Terepnapló | egy munkanap napi jegyzete: emberek, órák, munka, fotók, akadályok; munkánkénti óraösszesítés | 2 | D+M | N-DAILY, N-JOB |
| N-REPORT | Jelentésexport | egy jegyzet, jegyzetek egy halmaza vagy egy munka jegyzetei → Varler-stílusú PDF (csak az ügyfél által látható részek, kitakarási előnézet) | 2 | D | `shared/varler-doc` |
| N-DEV | Fejlesztői kimenet | a `dev` láthatóságú jegyzetek továbbra is sima szövegként mennek a `vrg-devnotes` / `mobile-log` ágakra, mint ma; a Divergence-tábla olvassa őket | 1 | D+M | Divergence, M6 |
| N-COMMIT | Jegyzetekből commit-szöveg | egy ág mai fejlesztői jegyzetei commit-törzs piszkozataként felajánlva a git-panelen | 3 | D | `git.js` |

### 6.8 Szinkron és eszközök

| Azonosító | Modul | Mi ez | Szint | Hol | Ráépül |
|---|---|---|---|---|---|
| N-JOURNAL | Műveletnapló | minden változás csak hozzáfűzhető `journal\*.jsonl` naplója: a szinkron és egy szinkron visszavonásának bemenete | 1 | D+M | — |
| N-SYNC-LAN | LAN-szinkron | telefon ↔ PC a párosított relén át, titkosított tartalommal, folytatható, mellékletek igény szerint | 1 | D+M | relé M2/M7, bizalmi kapu |
| N-MERGE | Összefésülés és ütközések | rev + alap-hash, soronkénti diff3, mezőnkénti frontmatter-összefésülés, ütközési másolatok egymás melletti választóval | 1 | D+M | — |
| N-SYNC-FILE | Mappaszinkron | titkosított csomagok a OneDrive-on / a Megosztott mappán át egy második PC-hez | 3 | D | `roots.json` Shared |
| N-SYNC-GH | GitHub-tartalék | titkosított csomagok egy privát ágon, ha a PC elérhetetlen (a nem fejlesztői jegyzeteknél a sima `mobile-log` helyett) | 2 | M (+D olvasó) | GitHub-kliens, kimenő sor |
| N-STATUS | Szinkronállapot | jegyzetenkénti pötty (helyi / szinkronizált / ütközés), utolsó szinkron ideje a felső sávban | 1 | D+M | felső sáv |
| N-SELECT | Szelektív szinkron | mely jegyzetfüzetek / munkák mennek a telefonra; mellékletek csak bélyegképként, amíg meg nem nyitják őket | 3 | M | — |

### 6.9 Biztonság és adatvédelem

| Azonosító | Modul | Mi ez | Szint | Hol | Ráépül |
|---|---|---|---|---|---|
| N-VIS | Láthatósági szintek | private / internal / client / dev, minden kimenet (szinkron, export, Stack, ügynökök) betartatja | 0 | D+M | — |
| N-CRYPT | Tárolótitkosítás | jegyzetenkénti AES-256-GCM kulcsok a tárolókulccsal becsomagolva; a tárolókulcs scrypt / Argon2id-ből, DPAPI / Keystore által becsomagolva tartva; helyreállítási kulcs | 1 (kötelező az N-SYNC-GH / FILE előtt) | D+M | `secrets.js`, `SecretStore` |
| N-LOCK | Zárolt jegyzetek | jegyzetenkénti külön jelmondat / biometria; kívül az indexen | 2 | D+M | BiometricPrompt |
| N-APPLOCK | Alkalmazászár | telefon: biometria / PIN tétlenség után, `FLAG_SECURE` a zárolt jegyzeteknél | 2 | M | — |
| N-ENROL | Eszközfelvétel | a tárolókulcs új eszközre csak a párosított relén át, megerősítő kóddal | 1 | D+M | relé-bizalom |
| N-SAFE-HTML | Biztonságos megjelenítés | DOMPurify-engedélylista, szigorú CSP, távoli képek alapból kikapcsolva, a hivatkozások kívül nyílnak | 0 | D (+M WebView) | vendorolt DOMPurify |
| N-SECRET | Titok- és személyesadat-észlelő | figyelmeztet tokenekre / kulcsokra / jelszavakra és ügyfél személyes adataira; kizárja a sima szöveges kimeneteket | 1 | D+M | `vrg-git.ps1` minták |
| N-AUDIT | Auditnapló | exportok, megosztások, visszafejtések, eszközfelvételek | 2 | D | `audit.js` |

### 6.10 Előzmények és ellenállóképesség

| Azonosító | Modul | Mi ez | Szint | Hol | Ráépül |
|---|---|---|---|---|---|
| N-HIST | Változatelőzmények | összevont pillanatképek (pl. legfeljebb egy 5 percnyi szerkesztésenként + minden szinkronösszefésülésnél), különbségnézet, visszaállítás; vagy a tároló mint helyi git-repó (Q04) | 1 | D (+M csak a legutóbbiak) | `git.js` |
| N-RECOVER | Összeomlás utáni helyreállítás | a piszkozatnapló visszaállítása induláskor, „nem mentett szöveg a legutóbbi munkamenetből” sáv | 0 | D+M | N-STORE |
| N-BACKUP | Mentés bekötése | a tároló a BACKUP munkalistáján (vagy saját bare repóként), az `att\` integritási újrahash-elése | 1 | D | `backup.ps1` |
| N-FSCK | Integritás-ellenőrzés | induláskor és kérésre: minden jegyzet elemezhető, minden mellékletnek egyezik a hash-e, minden hivatkozás feloldható; jelentés, soha nincs automatikus törlés | 1 | D | — |
| N-FALLBACK | Tartalék hozzáférés | START tartalék „Jegyzetek mappa” pont, `tools/notes-find.js` sima keresés | 1 | D | START |

### 6.11 Átjárhatóság, megosztás, automatizálás

| Azonosító | Modul | Mi ez | Szint | Hol | Ráépül |
|---|---|---|---|---|---|
| N-EXPORT | Exportálás | Markdown + mellékletek (zip), HTML, PDF (Varler-stílus), JSON; egy teljes munka vagy egy keresési találat | 1 | D | `varler-doc` |
| N-IMPORT | Importálás | Markdown-mappák / Obsidian-tárolók, Google Keep (Takeout JSON), Evernote ENEX, Joplin, sima szöveg; a régi `mobile-log` és `vrg-devnotes` előzmények | 2 | D | — |
| N-SHAREOUT | Kifelé megosztás | jegyzet küldése levélbe, a telefonra (Átadás), a vágólapra Markdownként vagy sima szövegként | 2 | D+M | levélpanel, Átadás |
| N-LINKS | Mélyhivatkozások | `vrg://notes/new`, `/open?id=`, `/search?q=` mindkét oldalon | 1 | D+M | `Links.kt`, `acts.js` |
| N-ACTIONS | Műveletek | Drafts-szerű megnevezett műveletek egy jegyzeten: „a munkamappába .md-ként”, „commit-üzenetbe”, „a Plannerbe tűként”, „CSV-be” | 3 | D | acts |
| N-CLI | CLI / szkript-API | `node tools/notes.js add|find|export` szkripteknek és ügynököknek (a láthatóság betartásával) | 2 | D | — |

### 6.12 MI (opcionális, mind kapcsoló mögött, soha nem `private` jegyzeteken)

| Azonosító | Modul | Mi ez | Szint | Hol |
|---|---|---|---|---|
| N-AI-CLEAN | Diktált jegyzet rendbetétele | írásjelek, bekezdések, magyar helyesírás, az eredeti változatként megtartva | 3 | D |
| N-AI-SUM | Összefoglalás / feladatkinyerés | egy munka jegyzetei → összefoglaló és nyitott feladatok listája | 3 | D |
| N-AI-ASK | Kérdezd a jegyzeteimet | kérdés-válasz a jegyzetek felett, jegyzetazonosítókra mutató hivatkozásokkal, egy munkára szűkítve | 3 | D |
| N-AI-TAG | Címke / típus / munka javaslata | a szövegből és a forrásból | 3 | D |
| N-AI-TRANS | Hang átiratozása | hangjegyzetek → szöveg a PC-n (helyi modell előnyben; bármi kifelé csak hozzájárulással) | 3 | D |

### 6.13 Élmény

| Azonosító | Modul | Mi ez | Szint | Hol |
|---|---|---|---|---|
| N-UI | A Jegyzetek felülete | három panel a Desktopon (oldalsáv · lista · jegyzet), kártyarács vagy lista a telefonon, Mélyvíz-kinézet a VRG UI Kiten át | 1 | D+M |
| N-KEYS | Billentyűzet-központúság | minden műveletnek van billentyűje; a billentyűk a `keymap.json`-ban; a héj dupla Tab / Esc szabályai betartva | 1 | D |
| N-A11Y | Akadálymentesség | betűméretezés, kontraszt, képernyőolvasó-címkék, nagy érintési célok (kesztyű) | 1 | D+M |
| N-PERF | Sebességkeret | megnyitás < 200 ms, keresés < 100 ms, a gépelést soha nem blokkolja a mentés vagy az index, 10 000 jegyzetnél | 0 | D+M |
| N-I18N | Elsőként magyarul | a felület szövegei egy táblában (hu, később en); dátumok és számok hu-HU szerint | 1 | D+M |
| N-SIMPLE | Felszín és helyek | az eszközönkénti profil, a helyregiszter, a keret, az *Egyszerű mód* kapcsoló, a visszaviteli teszt ([SIMPLE.hu.md](SIMPLE.hu.md)) | 0 | D+M |
| N-ENGINELOG | Háttérnapló | jegyzetenként és tárolónként: minden automatikus lépés okkal és *Visszavonással* | 1 | D+M |
| N-SKIN | Ismerős megjelenés | az iOS-stílusú telefonos megjelenés ugyanazokon a képernyőkön és helyeken; alapértelmezett viselkedése a Csendes | 1 | M |

---

## 7. Nyitott döntések (A = javasolt alapértelmezés)

| # | Kérdés | A (javasolt) | B / C |
|---|---|---|---|
| NOTES-Q01 | Hol él a tároló? | **`H:\VRG\Full\jegyzetek\`**, a repón kívül, a BACKUP menti | B a repón belül, git által figyelmen kívül hagyva · C a `Shared`-ben (OneDrive) |
| NOTES-Q02 | Az igazság forrása | **Markdown-fájlok + újraépíthető index** | B SQLite mint igazság, Markdown-exporttal · C CRDT-dokumentumok |
| NOTES-Q03 | Terméknév | **VRG Jegyzetek** (katalógusazonosító `notes`) | B „Gyorsjegyzet” marad a telefonos rögzítésnek, „Jegyzetek” az alkalmazásnak |
| NOTES-Q04 | Változatelőzmények | **a tároló mint saját helyi git-repó** (origin nélkül, csak `Backup\code\jegyzetek.git`) — a vrg-git launcher-collect pusha ki kell hagyja | B saját pillanatképfájlok a `.history\` alatt |
| NOTES-Q05 | Telefonos szerkesztő | **natív Compose a rögzítéshez, a közös CodeMirror-szerkesztő WebView-ban a teljes szerkesztéshez** | B minden natív Compose · C minden WebView |
| NOTES-Q06 | Összefésülési stratégia | **rev + alap + diff3 + ütközési másolatok** | B CRDT (Yjs / Automerge) az elejétől |
| NOTES-Q07 | Titkosítás | **az egész tárolóra az első naptól bekapcsolva** (DPAPI / Keystore által becsomagolt kulcs, így nincs jelmondatkérés); bármely LAN-on kívüli szinkronhoz kötelező | B alapból kikapcsolva, tárolónként bekapcsolható |
| NOTES-Q08 | A meglévő `mobile-log` és `vrg-devnotes` ágak | **csak `dev` kimenetként megtartva**; az új, nem fejlesztői telefonos jegyzetek a tárolószinkronon mennek; a régi előzmények egyszer importálva | B mindkettő megszüntetése |
| NOTES-Q09 | Jegyzettípusok az első változatban | **jegyzet, felmérés, telefon, dev** (négy) | B először csak sima jegyzetek |
| NOTES-Q10 | MI-funkciók | **kikapcsolva és megépítetlenül a 3. szintig**; ha megépül, helyi először, soha nem `private`-on | B az N-AI-CLEAN korai megépítése a diktáláshoz |

---

## 8. Építési sorrend

1. **NT0 — mag, felület nélkül:** N-VAULT, N-STORE, N-ATT, N-INDEX, N-TRASH, N-API, N-VIS, N-SAFE-HTML, N-RECOVER, N-PERF keret,
   N-CORE-TEST, N-SIMPLE. Tiszta magok JS-ben és Kotlinban, a közös fixtúrákkal. Semmi sem látható; minden tesztelve.
2. **NT1 — a Desktop-alkalmazás:** N-UI, N-EDIT, N-CHECK, N-SLASH, N-CODE, N-TAG, N-PIN, N-LINK, N-FIND, N-SWITCH, N-PALETTE,
   N-QUICK, N-SOURCE (a fejlesztőijegyzet-ablakból univerzális rögzítő lesz), N-FOLDER, N-ENGINELOG, N-DAILY, N-HIST, N-BACKUP, N-FSCK, N-FALLBACK,
   N-EXPORT, N-LINKS, N-KEYS. Bejegyezve a `vrg-menu.json` + `vrg-catalog.json` fájlba. *Használható a PC-n.*
3. **NT2 — csatlakozik a telefon:** N-CRYPT, N-ENROL, N-JOURNAL, N-SYNC-LAN, N-MERGE, N-STATUS, N-PHONE, N-SHARE, N-INBOX, N-DEV, N-SKIN
   (a Gyorsjegyzet mostantól tárolójegyzeteket ír; a fejlesztői jegyzetek továbbra is úgy folynak, mint ma). *PC és telefon
   összhangban, felhő nélkül.*
4. **NT3 — a munka:** N-JOB, N-XLINK, N-TYPE (négy típus), N-SITE, N-ANNOT, N-VOICE, N-MEAS, N-DIARY, N-REPORT, N-TASK,
   N-REMIND, N-SMART, N-STACK. *A jegyzetalkalmazás a munkák terepi jegyzetfüzete lesz.*
5. **NT4 — kiterjesztés:** N-SYNC-GH (titkosítva), N-SCAN + N-OCR, N-CLIP, N-MAILIN, N-PLANPIN, N-LOCK, N-APPLOCK, N-AUDIT,
   N-IMPORT, N-SHAREOUT, N-WIDGET, N-SPELL, N-FOCUS, N-TABLE, N-CLI.
6. **Később, csak ha kell:** N-CANVAS (a MindMapen át), N-GRAPH, N-EMBED, N-INK, N-PDF, N-MATH, N-DIAG, N-CAL, N-BOARD, N-BUY,
   N-ACTIONS, N-COMMIT, N-SYNC-FILE, N-SELECT, N-TAG-QR, N-SEM, az MI-modulok.

Könyvtárak, amelyeket ez vendorolna (mind pontos verzióval + sha512-vel rögzítve a `vendor-manifest.json`-ban; a licenceket
akkor újra kell ellenőrizni): CodeMirror 6 (MIT), markdown-it (MIT) vagy micromark (MIT), DOMPurify (Apache-2.0 / MPL-2.0), egy
YAML-elemző (`yaml`, ISC), MiniSearch (MIT) csak ha egy környezetben nem SQLite FTS-t használunk, KaTeX (MIT), Mermaid (MIT);
Android: Room (Apache-2.0), ML Kit szövegfelismerés (Google-feltételek), CameraX (Apache-2.0). Opcionálisan később: Yjs /
Automerge (MIT), egy Argon2 WASM-build.
