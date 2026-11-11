# VRG Jegyzetek — Felszín és gépház

*A VRG Jegyzetek egyszerű módjának koncepciója PC-n és telefonon. 2026-11-11. Az [ANALYSIS.hu.md](ANALYSIS.hu.md)
funkciómoduljai **előtt** áll: minden ottani modulnak bele kell férnie az itteni szabályokba, és ami nem fér bele, az nem épül
meg. Az angol változat: [SIMPLE.md](SIMPLE.md); a kettőt együtt kell javítani. Interaktív prototípus (HU/EN):
https://claude.ai/artifact/HXMSS2jg9TgBQxtfX1Q8ES*

---

## 1. A gondolat egy bekezdésben

A VRG Jegyzetek **egy sima jegyzetalkalmazás, amelynek gépháza van**. A felszín (lista, jegyzet, keresés, új jegyzet) maga a
termék. Minden funkció kikapcsolva egy teljes, hétköznapi jegyzetalkalmazás, és ez a változat minden képernyő mintája. A
funkciók nem adnak hozzá képernyőt vagy eszközsort: vagy a **gépházban** dolgoznak (a háttérben, vezérlők nélkül), vagy az
eredményüket a felszín néhány rögzített **helyén** mutatják. Egy kapcsoló, az **Egyszerű mód**, egyszerre elrejt minden helyet,
és visszaviszi az alkalmazást a minta-felszínre, adat megváltoztatása vagy elvesztése nélkül. A telefonon van egy második
megjelenés, az **Ismerős**, amely úgy olvasható, mint az iPhone-felhasználók által ismert jegyzetalkalmazás; vele a funkciók
még inkább a gépházba húzódnak, így a telefon olyan fekete doboznak érződik, amely néhány egyszerű vezérlő mögött bonyolult
dolgokat végez.

---

## 2. A szabályok

| # | Szabály | Mit jelent a gyakorlatban |
|---|---|---|
| **R1** | **Az egyszerű felszín maga az alkalmazás.** | A funkciók nélküli képernyők készülnek el először, és ezek a specifikáció. Minden későbbi képernyő ez a képernyő plusz a helyek tartalma, soha nem más elrendezés. |
| **R2** | **Egy kapcsoló visszavisz.** | Az *Egyszerű mód* azonnal elrejt minden helyet. Semmi sem törlődik, alakul át vagy költözik. Kikapcsolva pontosan az előző felszín tér vissza. |
| **R3** | **A funkció csak helyet tölthet ki.** | Egy funkció a §3 helyeire rajzolhat, máshová nem. Nincs új fül, nincs állandó eszközsor, nincs magától nyíló képernyő, nincs új mező a sima jegyzet létrehozásakor, a gépelés módja nem változik. |
| **R4** | **A nagy eszköz látogatás.** | Ami teljes képernyőt kíván (vászon, naptár, tábla, PDF-jelölés, tervnézet, „kérdezd a jegyzeteimet”), az teljes képernyős lapként nyílik a `…` menüből vagy egy mappából, és oda zár vissza, ahol a felhasználó volt. Látogat, nem költözik be. |
| **R5** | **Keret van.** | Bárhány funkció van bekapcsolva, a jegyzetképernyőn az egyszerű felszínen felül legfeljebb 3 csip, 1 állapotpötty és a `…` menü látszik. Egy listasorban legfeljebb 2 kis csip. A többlet egy `+2` csipbe húzódik, amely lapot nyit. Teszt őrzi (§7). |
| **R6** | **Eredmény, nem folyamat.** | A gép az eredményt mutatja („Kovács lakás?” csipként), a munkáját soha (nincs szinkron-folyamatsáv, nincs indexelő képernyő, nincs titkosítási jelmondatkérés a mindennapi használatban). |
| **R7** | **Minden automatikus lépés látható és visszavonható.** | Minden jegyzet `…` menüjében ott a **Háttérnapló**: mit tett a gép ezzel a jegyzettel, mikor és miért, mindegyik mellett *Visszavonás*. Ez a bizalmi szelep, ettől elfogadható a fekete doboz. |
| **R8** | **A tartalom sima marad.** | Amit egy funkció hozzáad, az a jegyzet frontmatterébe vagy a jegyzet mellé kerül, a törzsszövegbe soha, hacsak nem a felhasználó gépelte. A törzs bármely szerkesztőben olvasható Markdown marad. Az a funkció, amely szöveget ír át (MI-tisztítás), új változatot ment, a régit megtartja. |
| **R9** | **A védelem soha nem szünetel.** | Egyszerű módban az adatvédő funkciók (mentés, előzmények, biztonsági mentés, szinkron, titkosítás, titokészlelés) futnak tovább. A *tartalmon dolgozó* funkciók (automatikus címkézés, munkafelismerés, MI) szünetelnek. |
| **R10** | **A megjelenés és a viselkedés két külön beállítás.** | A *Megjelenés* (Alap / Ismerős) a látványt és a vezérlők helyét változtatja; a *Viselkedés* (Kézi / Csendes) azt, mennyit tesz a gép magától. Mindkét megjelenésnek ugyanazok a képernyői és helyei, így a megjelenés váltása soha nem csinál belőle másik alkalmazást. |

---

## 3. A felszín és a helyei

### 3.1 Az egyszerű felszín (minden kikapcsolva)

| Képernyő | Telefon | PC |
|---|---|---|
| **Mappák** | mappalista darabszámokkal; *Összes jegyzet*, a felhasználó mappái, *Nemrég törölt* | összecsukható oldalsáv ugyanezzel a listával |
| **Lista** | jegyzetek a legújabbal kezdve, dátum szerint csoportosítva (*Ma*, *Előző 7 nap*, *Előző 30 nap*, aztán hónapok), a kitűzöttek felül; cím, idő, első sor, fotó-bélyegkép, ha van | középső oszlop, ugyanezekkel a sorokkal |
| **Jegyzet** | cím (az első sor), dátum, szöveg ellenőrzőlistákkal és fotókkal; írósáv *ellenőrzőlista*, *fotó*, *továbbiak* gombbal | jobb oldali oszlop, ugyanaz a jegyzet; vékony eszközsor |
| **Keresés** | egy mező a lista fölött; címben, szövegben és fotók szövegében keres | egy mező az ablak tetején |
| **Új** | egy gomb; koppintás = üres jegyzet, benne a kurzorral | gomb, `Ctrl+N`, a globális gyorsbillentyű |

Az egyszerű mód funkciói, amelyek magának a felszínnek a részei: mappák, kitűzés, ellenőrzőlista, fotók és fájlok, keresés,
megosztás / másolás, *Nemrég törölt* (30 nap), a telefon megosztási célja, a PC gyorsjegyzet-billentyűje. Ez nagyjából az a
funkciókészlet, amelyre egy régóta iPhone-os jegyzeteket használó ember támaszkodik, így semmi sem hiányzik, amiért nyúlna.

### 3.2 A helyek

| Hely | Hol | Korlát | Példa tartalom |
|---|---|---|---|
| **S1 Sorcsipek** | a jegyzet címe alatt a listában | 2 kis csip | munkanév, határidő |
| **S2 Fejléccsipek** | a cím alatt a jegyzetben | 3 csip, aztán `+N` | munka, címke, emlékeztető, típus, láthatóság (csak ha nem az alapértelmezés), ütközés |
| **S3 Állapotpötty** | egy pötty a cím mellett (telefon) vagy a címsorban (PC) | 1 | még nincs szinkronizálva · ütközés · zárolt; semmi, ha minden rendben |
| **S4 `…` menü** | a jegyzet menüje | 6 sor, aztán *Több…* | export, jelentés, előzmények, zárolás, Háttérnapló, látogatások (§2 R4) |
| **S5 Beszúrás lap** | Alap: az írósáv **+** gombja mögött (és `/` a PC-n); Ismerős: a kamera gomb mögött | rács; soha nem új gomb a sávon | hangjegyzet, szkennelés, táblázat, mérési űrlap, hivatkozás munkára |
| **S6 Új jegyzet, lenyomva** | az *Új* hosszú lenyomása (telefon), a nyíl az *Új* mellett (PC) | rövid lista | jegyzettípusok: felmérés, telefon, mérés… A koppintás mindig sima jegyzet |
| **S7 Mappák** | a mappalista / oldalsáv | az intelligens mappák sima mappának látszanak | *Beérkezett* (csak ha nem üres), *Ma*, *Teendők*, egy munka mappája |
| **S8 Keresési tippek** | a keresőmező alatt gépelés közben | csipek, sosem kötelezőek | `munka: Kovács`, `van fotó`, `teendő` |
| **S9 Beállítás sor** | *Beállítások → Funkciók* | funkciónként egy sor | be / ki, Csendes módban: *háttérben* / *javasol* |
| **S10 Rögzítési pontok** | az alkalmazáson kívül | — | telefonos widget, Gyorsbeállítások-csempe, megosztási cél, webes kivágó, levélpanel, paletta, QR egy szekrényen |

Máshová funkció nem rajzolhat. Egy új fajta hely ennek a dokumentumnak a döntése, nem egy modulé.

---

## 4. Két megjelenés, két viselkedés

### 4.1 Megjelenés

| | **Alap** (alapértelmezés; Android és Windows) | **Ismerős** (csak telefonon, választható) |
|---|---|---|
| Kinek | mindenkinek, aki mást nem választ | aki iPhone-ról jön, és azt szeretné, hogy az alkalmazás úgy olvasható legyen, mint az általa ismert jegyzetalkalmazás |
| Látványnyelv | VRG Mélyvíz a VRG UI Kiten át: sötét először, hajszálvonalak, szögletes, levágott sarkú vezérlők, jégkék kiemelés | iOS-stílus: rendszerbetű, nagy félkövér képernyőcímek, kerekített csoportos listák szürke alapon, borostyánsárga kiemelés, alapból világos, a telefon témáját követi |
| Navigáció | keresősáv felül, a menüikon mögött a mappafiókkal; szögletes **+** gomb jobbra lent | *‹ Mappák* vissza-felirat bal felül; a képernyőcím nagy, görgetéskor összemegy; alsó eszközsor, középen a jegyzetszám, jobbra az írás ikon |
| Jegyzetképernyő | felső sáv: vissza, kitűzés, `…`; írósáv a billentyűzet fölött | felső sáv: *‹ vissza*, megosztás, `…`, gépelés közben *Kész*; alsó eszközsor: ellenőrzőlista, kamera, toll, új |
| Gesztusok | sor hosszú lenyomása menüt nyit; húzás archivál | sor balra húzása: *kitűzés* és *törlés*; hosszú lenyomás: előnézet műveletekkel |

Az Ismerős a felhasználó által megtanult elrendezési szokásokat veszi át (hol a vissza-felirat, az írás gomb és az
eszközsor), senkinek a márkáját nem: nincs Apple-név, -ikon vagy -grafika, és az alkalmazás megtartja a saját nevét és logóját.

A PC-n csak Alap van. A PC egyszerű felszíne a §3.1 három oszlopa, az oldalsáv alapból összecsukva.

### 4.2 Viselkedés

| | **Kézi** | **Csendes** |
|---|---|---|
| Alapértelmezés ehhez | Alap | Ismerős |
| Csipek | azt mutatják, amit a felhasználó beállított; *csip hozzáadása* vezérlő a fejlécben, amint bármely csipes funkció be van kapcsolva | a gép tölti ki őket javaslatként (szaggatott keret, `?`); egy koppintás elfogadja, egy húzás elveti; nincs hozzáadó vezérlő |
| Beszúrás lap | minden bekapcsolt funkció csempeként | csak az öt leggyakoribb; a többi a *Több* alatt |
| Gép | azt teszi, amit mondanak neki; a tartalmon végzett munka előtt kérdez | magától cselekszik, ahol az eredmény visszavonható, és minden lépést a Háttérnaplóba ír |
| Beállítás sorok | be / ki | be / ki, plusz *háttérben* (csak gépház, nincs csip) vagy *javasol* (a gép csipet javasol) |

### 4.3 Amit a gép Csendes módban magától tesz (példák)

| Funkció | Amit a felhasználó lát | Amit a gép tesz |
|---|---|---|
| Munka | egy *Kovács lakás?* csip egy új jegyzeten | kitalálja a munkát a mappából, a legutóbb nyitott munkából, abból, hogy a telefon egy munka címe közelében van, vagy a PC-n nyitott Planner-fájlból |
| Helyszíni fotó | egy fotó a jegyzetben, semmi más | ráírja az időt, a munkát és (ha engedélyezett) a helyet; kiolvassa belőle a szöveget a keresőnek; a jelölések alatt megtartja az eredetit |
| Feladat, emlékeztető | egy kis dátumcsip, miután egy ellenőrzőlista-sorba *holnap* vagy *nov. 14* került | létrehozza az emlékeztetőt, és értesít a telefonon és a PC-n |
| Szinkron | semmit, vagy egy pöttyöt, ha valami nincs rendben | a párosított LAN-relén szinkronizál, aztán a titkosított tartalékokon |
| Titkosítás | semmit (egy sor a Beállításokban, egy helyreállítási kulcs a beállításkor) | minden jegyzetet titkosít tároláskor és a vezetéken |
| Ütközés | egy *2 változat* csipet, csak valódi ütközésnél | összefésül mindent, ami tisztán összefésülhető |
| Ügyféladat | egy csendes *belső* csipet, ha egy névvel és címmel ellátott jegyzetet *ügyfélnek* jelöltek | kizárja minden sima szöveges kimenetből és a Stackből |
| Terepnapló | a munkanap jegyzetei a *Ma* mappában | összegyűjti őket aznapi terepnaplóvá órákkal és fotókkal |
| Diktálás tisztítása | a tisztított szöveget | a diktált eredetit változatként megtartja (R8) |

---

## 5. Minden modul aszerint, hol él

Az [ANALYSIS.hu.md §6](ANALYSIS.hu.md) mind a 96 modulja, a fő lenyomatuk szerint. Egy modul ezen felül egy sort adhat a
Beállításokhoz (S9).

| Lenyomat | Modulok | Db |
|---|---|---|
| **Felszín** (az egyszerű alkalmazás része; nem kapcsolható ki) | N-UI, N-EDIT, N-CHECK, N-PIN, N-FOLDER, N-FIND, N-ATT, N-TRASH, N-SHAREOUT, N-QUICK, N-PHONE, N-SHARE, N-A11Y, N-I18N | 14 |
| **Gépház** (semmi felszín) | N-VAULT, N-STORE, N-INDEX, N-API, N-CORE-TEST, N-JOURNAL, N-SYNC-LAN, N-SYNC-FILE, N-SYNC-GH, N-CRYPT, N-ENROL, N-SAFE-HTML, N-AUDIT, N-RECOVER, N-BACKUP, N-FSCK, N-FALLBACK, N-PERF, N-OCR, N-STACK, N-SEM, N-SPELL, N-DEV, N-CLI, N-LINKS, N-KEYS, N-SELECT, N-AI-TRANS, N-APPLOCK | 29 |
| **Csipek** (S1, S2) | N-JOB, N-TAG, N-VIS, N-TYPE, N-REMIND, N-TASK, N-SOURCE, N-SITE, N-SECRET, N-MERGE, N-AI-TAG | 11 |
| **Állapotpötty** (S3) | N-STATUS | 1 |
| **Menü és beszúrás** (S4, S5, S6) | N-SLASH, N-TABLE, N-CODE, N-MATH, N-DIAG, N-VOICE, N-SCAN, N-ANNOT, N-INK, N-LINK, N-XLINK, N-EMBED, N-LOCK, N-MEAS, N-BUY, N-FOCUS, N-HIST, N-EXPORT, N-REPORT, N-ACTIONS, N-COMMIT, N-IMPORT, N-AI-CLEAN, N-AI-SUM | 24 |
| **Mappák** (S7) | N-INBOX, N-SMART, N-DAILY, N-DIARY | 4 |
| **Látogatások** (R4) | N-CANVAS, N-GRAPH, N-CAL, N-BOARD, N-PDF, N-PLANPIN, N-AI-ASK | 7 |
| **Rögzítési pontok** (S10) | N-WIDGET, N-TAG-QR, N-CLIP, N-MAILIN, N-PALETTE, N-SWITCH | 6 |

Következmények az ANALYSIS-re: **az N-FOLDER a 2. szintről az 1.-re kerül** (a mappák az egyszerű felszín részei), és három
modul kerül be, mind 0. vagy 1. szintű, mert minden más ezeken lóg:

| Azonosító | Modul | Mi ez | Szint | Hol |
|---|---|---|---|---|
| N-SIMPLE | Felszín és helyek | a profil (§6), a helyregiszter, a keret, az *Egyszerű mód* kapcsoló, a visszaviteli teszt | 0 | D+M |
| N-ENGINELOG | Háttérnapló | jegyzetenként és tárolónként: minden automatikus lépés okkal és *Visszavonással* | 1 | D+M |
| N-SKIN | Ismerős megjelenés | az iOS-stílusú telefonos megjelenés ugyanazokon a képernyőkön és helyeken; alapértelmezett viselkedése a Csendes | 1 | M |

---

## 6. Hogyan épül

**A profil** eszközönkénti beállítás (a telefon lehet egyszerű, miközben a PC teljes):

```json
{
  "simple": false,
  "look": "alap",
  "behaviour": "kezi",
  "features": { "job": "suggest", "tag": "visible", "site": "background", "ai-clean": "off" }
}
```

Funkciónként: `off` · `background` (csak gépház, semmi a felszínen) · `suggest` (a gép csipet tölt ki, a felhasználó
megerősíti) · `visible` (a funkció helyein lévő vezérlők látszanak). A `simple: true` a felszín számára mindent `off`-ra
takar, és szünetelteti a tartalmon dolgozó gépházi feladatokat (R9); a `features` térkép érintetlen marad, így a visszakapcsolás
pontosan helyreállítja.

**A helyregiszter** az egyetlen út, amelyen egy funkció a felszínre jut:

```js
slots.register('job', 'header-chip', { priority: 30, render: (note) => chip(note.job) });
slots.register('report', 'menu', { group: 'export', label: 'Jelentés (PDF)', run: openReport });
```

A felszín minden helyhez megkérdezi a regisztert, a profil szerint szűrve, és a hely korlátjáig vágva prioritás szerint. Ha
egy funkció a `slots.register`-en kívül bármi mással rajzol, az áttekintéskor hibának számít. Ugyanez a regiszter megvan
Kotlinban (`kit-core/notes/Slots.kt`) és JS-ben (`shared/notes-core/slots.js`), a helynevek és korlátok egy közös listájából.

**A gépház** feladatokat futtat (index, szinkron, OCR, munkafelismerés, napló-összesítés…), amelyek csak a tárolószolgáltatáson
át írnak, és minden tartalmi változást a Háttérnaplóba írnak `{ note, feature, act, reason, undo }` alakban.

---

## 7. Hogyan tesztelt (a garanciák)

| Teszt | Akkor megy át, ha |
|---|---|
| **Visszavitel** | minden funkció bekapcsolva és `simple: true` mellett a megjelenített felszín (PC-n a DOM, telefonon a Compose szemantikai fa) azonos ugyanazon tárolóadatok felszínével minden funkció kikapcsolva (a prototípus ezt az összevetést élőben futtatja) |
| **Oda-vissza** | az Egyszerű mód akárhányszori ki-bekapcsolása után a profil, a jegyzetek és a frontmatter bájtra azonos |
| **Keret** | minden funkció `visible` állapotában a jegyzetképernyőn az egyszerű felszínen felül legfeljebb 3 fejléccsip + 1 pötty + a menü van, egy listasorban legfeljebb 2 csip |
| **Sima törzs** | a kínzókorpusz minden gépházi feladata után minden jegyzettörzs azonos azzal, amit a felhasználó gépelt (vagy van új változat, és a régi megmaradt) |
| **Visszavonás** | a korpusz által előállított minden Háttérnapló-bejegyzés visszavonható, és a jegyzet visszatér korábbi bájtjaihoz |
| **Megjelenés-egyezés** | az Alap és az Ismerős ugyanazokat a képernyőket, helyeket és műveleteket kínálja (csak a látvány és a helyzetek térnek el) |

---

## 8. Első indítás és a beállítások oldal

- A telefon **első indításkor** egy kérdést tesz fel: *Honnan jössz?* *iPhone* → Ismerős + Csendes; *Android* vagy *mindegy* →
  Alap + Kézi. Bármikor módosítható.
- Minden új telepítés **Egyszerű módban** indul, semmi sincs bekapcsolva. A felhasználó egyenként kapcsolja be a funkciókat.
- A *Beállítások → Funkciók* minden funkciót egy sorral mutat arról, mit csinál, és **hol fog megjelenni** (*„csip a cím
  alatt”*, *„csak háttérben”*, *„a … menüben”*), így egy bekapcsolás soha nem meglepetés.
- Az oldal tetején: **Egyszerű mód** (a kapcsoló) és **Mindent vissza alapra** (minden funkció kikapcsolása, az oldalon belüli
  megerősítés után).
- Az *Egyszerű mód* a PC-n palettasor, a telefonon a mappaképernyő címének hosszú lenyomása is, így a visszalépés soha nincs két
  mozdulatnál messzebb.

---

## 9. Nyitott döntések (A = javasolt alapértelmezés)

| # | Kérdés | A (javasolt) | B / C |
|---|---|---|---|
| SIMPLE-Q01 | Első indítás | **Egyszerű mód, semmi sincs bekapcsolva** | B az NT1 készlet bekapcsolva |
| SIMPLE-Q02 | Az Egyszerű mód és a profil hatóköre | **eszközönként** | B tárolónként (minden eszköz együtt) |
| SIMPLE-Q03 | Ismerős a PC-n | **csak telefonon** | B PC-s megjelenés is |
| SIMPLE-Q04 | Alapértelmezett viselkedés | **a megjelenést követi** (Ismerős → Csendes, Alap → Kézi) | B mindig Kézi, amíg át nem állítják |
| SIMPLE-Q05 | Téma | **Alap a VRG-témát követi (sötét először); Ismerős a telefon világos / sötét beállítását** | B mindkettő a telefont |
| SIMPLE-Q06 | Csipkeret | **3 a jegyzetfejlécben, 2 a sorban** | B 4 és 2 · C 2 és 1 |
| SIMPLE-Q07 | Ismerős kiemelőszín | **az ismerőshöz közeli borostyánsárga** | B a VRG meleg kiemelése |
| SIMPLE-Q08 | Mit tehet a gép magától Csendes módban | **csak a Háttérnaplóból visszavonható lépéseket** | B visszavonhatatlant is, megerősítéssel |
