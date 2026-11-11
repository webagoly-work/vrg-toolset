# VRG MindMD — saját Markdown-szerkesztő a Jegyzetek mellett, és a bővítménytérkép

*2026-11-11. Az [ANALYSIS.hu.md](ANALYSIS.hu.md) (a 99 modul) és a [SIMPLE.hu.md](SIMPLE.hu.md) (a felszín szabályai) társa.
Az angol változat: [EDITOR.md](EDITOR.md); a kettőt együtt kell javítani. Csak elemzés, semmi sincs megépítve.*

*A bővítmény-áttekintés az Obsidian közösségi katalógusának 2026 közepi általános ismeretén alapul (a régóta legtöbbet
letöltött és az általánosan hasznos bővítmények), nem friss keresésen; egy részletre támaszkodás előtt ellenőrizni kell a
bővítmény mostani állapotát. A bővítménynevek a szerzőiké. A „hasonló szellemben, másolás nélkül” itt azt jelenti:
**kompatibilis fájlformátumok, saját kód**. Maga az Obsidian zárt forrású; a közösségi bővítmények többsége MIT-licences, és ha
valaha átveszünk belőlük kódot, a szerzői jogi megjegyzés vele megy (repószabály, CLAUDE.md „Vendored third-party code”).*

Tartalom: §1 mi a szerkesztő · §2 a bővítménytérkép · §3 hogyan működne egy bővítmény nálunk · §4 az összefésült modullista ·
§5 a kiegészítő-architektúra · §6 kompatibilitás az Obsidian-tárolókkal · §7 döntések · §8 építési sorrend.

---

## 1. Mi a szerkesztő, és hogyan viszonyul a Jegyzetekhez

**Egy motor, két előlap.**

| | **VRG Jegyzetek** | **VRG MindMD** (a szerkesztő) |
|---|---|---|
| Cél | jegyzetek rögzítése és megőrzése telefonon és PC-n | Markdown írása, összekötése, rendezése: dokumentáció, munkadossziék, tudás, hosszú szövegek |
| Első elv | előbb az egyszerű felszín, a funkciók helyeken ([SIMPLE.hu.md](SIMPLE.hu.md)) | munkatér: fájlfa, lapok, osztott panelek, oldalpanelek, parancspaletta |
| Mit nyit meg | a Jegyzetek tárolót | **bármely Markdown-mappát**: a Jegyzetek tárolót, egy munkamappát, a repó `docs/` mappáját, egy Obsidian-tárolót |
| Platformok | PC + telefon | PC (Desktop-héj, `vrg-app://`); telefonon később legfeljebb olvasó |
| Közös | `shared/notes-core` (elemzés, hivatkozások, összefésülés, keresés, láthatóság), `shared/notes-editor` (CodeMirror 6), a tárolószolgáltatás, a helyregiszter, minden kiegészítő | ugyanez |

Miért éri meg a Jegyzetek mellett, kifejezetten a VRG-ben:

- **A repó már most Markdown-tudásbázis**: `GO-*.md`, `DECISIONS`, `docs/` (216 fájl), `DEVLOG.md`, munkamappák ajánlatokkal és
  jegyzetekkel. Ma VS Code-ban szerkesztődnek. A MindMD a repót *dev* láthatóságú tárolóként nyitja meg, git-tudatosan (§4.6),
  `[[F:…]]`-szerű hivatkozásokkal a Stackbe.
- **Az ős megvan**: a `MindMap/varler_mindmd2.html` („Varler MindMD — kapcsolt jegyzetvászon”, `I:r0` ötlet) már tud
  wikilinkeket és kapcsolt jegyzetvásznat `marked` alapon. A szerkesztő MindMD megtartja a nevet és a vászon ötletét, és a
  közös magra épül újra (ED-Q02).
- **A kiegészítő egyszer íródik meg.** Egy kiegészítő megadja, hol jelenhet meg; a Jegyzetekben csak a SIMPLE.hu.md §3.2
  helyeit kapja, a MindMD-ben paneleket és állapotsor-elemeket is nyithat. Egy kódbázis, kétféle szigorúság.

---

## 2. A bővítménytérkép

Ítélet: **✔** modulként már megvan · **◐** részben; a modulunkat bővíteni kell · **＋** új modul (§4) · **◇** a szerkesztő
alapfunkciója, nem kiegészítő · **✖** nem kell, indokkal.

### 2.1 Adatok, lekérdezések, tulajdonságok

| Bővítmény | Mit csinál | Nálunk | Ítélet |
|---|---|---|---|
| Dataview / Datacore | lekérdezések a frontmatter és a soron belüli mezők felett, táblázat, lista, feladatlista formában; JS-lekérdezések | N-SMART, N-TYPE | ＋ **N-QUERY** (biztonságos lekérdezőnyelv, JS nélkül) |
| Bases (2025 óta alapfunkció) | adatbázisnézetek (táblázat, kártyák) a tulajdonságok felett, `.base` fájlként mentve | N-SMART, N-BOARD | ＋ az **N-QUERY** része (nézetek) |
| Metadata Menu | típusos mezők jegyzetosztályonként, mezőszerkesztők, értékek kiegészítése | N-TYPE | ◐ az N-TYPE mezőtípusokat és szerkesztőket kap |
| Projects | táblázat / tábla / naptár / galéria egy mappa felett | N-BOARD, N-CAL | ◐ az N-QUERY nézetein át |
| Database Folder | egy mappa táblázatként | — | ◐ az N-QUERY-n át |
| Tag Wrangler | címkék átnevezése, összevonása, beágyazása mindenhol | N-TAG | ✔ (a mindenhol átnevezés az N-TAG része) |

### 2.2 Sablonok és rögzítés

| Bővítmény | Mit csinál | Nálunk | Ítélet |
|---|---|---|---|
| Templater | sablonok változókkal, dátumokkal, kérdésekkel, JS-sel | N-TYPE | ＋ **N-TPL** (változók, dátumok, kérdések; JS nélkül) |
| QuickAdd | rögzítő makrók: „fűzd az X jegyzet Y címsora alá”, választások, láncolt műveletek | N-ACTIONS, N-INBOX | ◐ az N-ACTIONS *rögzítés ide* célokat kap |
| Periodic Notes | napi, heti, havi, negyedéves jegyzetek sablonból | N-DAILY | ＋ **N-PERIODIC** (heti / havi az N-DAILY-re építve) |
| Natural Language Dates | `@holnap`, „jövő péntek” → dátumhivatkozás | N-TASK | ＋ **N-NLDATE** (magyar dátumszavak; az N-TASK, az N-REMIND és az N-TPL közösen használja) |
| Web Clipper (hivatalos) | böngészőbővítmény → Markdown-jegyzet tulajdonságokkal | N-CLIP | ✔ |
| Importer (hivatalos) | Evernote, Notion, Apple Notes, Keep, OneNote … → Markdown | N-IMPORT | ✔ |

### 2.3 Írás és szerkesztés

| Bővítmény | Mit csinál | Nálunk | Ítélet |
|---|---|---|---|
| Advanced Tables | Tab a cellák között, automatikus igazítás, képletek, rendezés | N-TABLE | ◐ az N-TABLE oszlopképleteket kap (mért értékek összege) |
| Outliner | listaelemek mozgatása billentyűvel, összecsukás, egy ágra nagyítás, jobb listaszerkesztés | — | ＋ **N-OUTLINE** |
| Various Complements / Completr | szavak, hivatkozások, címkék, frontmatter-értékek kiegészítése a tárolóból | N-LINK (csak hivatkozások) | ＋ **N-COMPLETE** |
| Linter | formázás mentéskor: címsorok, térközök, YAML-sorrend, listajelek | — | ＋ **N-LINT** (parancsként, vagy mentéskor megtartott változattal: R8) |
| Smart Typography / Typewriter | okos idézőjelek, gondolatjelek, három pont; fókuszsor | N-FOCUS | ＋ **N-TYPO** (magyar „ ” és » « idézőjel, nagykötőjel, keskeny szóköz a `3 × 16 A`-ban) |
| Editing Toolbar | formázó eszközsor | N-SLASH | ◇ a MindMD-ben választható sáv; a Jegyzetek a beszúrás lapot tartja (S5) |
| Highlightr | színes kiemelések | — | ◐ az N-EDIT része (`==szöveg==` plusz egy színattribútum) |
| Better Word Count / Novel Word Count | számlálás kijelölésre, jegyzetre, mappára | N-EDIT | ◇ állapotsor a MindMD-ben |
| Longform | sok jegyzetből álló, sorba rendezett, összefűzött kézirat | N-EXPORT | ＋ **N-LONGFORM** (kézikönyvek, munkadossziék, a VRG-dokumentáció) |
| Auto Link Title / Paste URL into selection | a beillesztett URL-ből `[cím](url)` lesz | — | ＋ **N-PASTE** (okos beillesztés: URL-cím, Excel-táblázat, képkezelés; hálózat csak megadott képességgel) |
| Image Converter / Paste image rename | beillesztett képek tömörítése, átméretezése, átnevezése, WebP/JPEG-re alakítása | N-ATT | ＋ **N-IMG** (helyszíni fotóknál fontos: méretkeret, EXIF/GPS eltávolítása vagy megtartása láthatóság szerint) |
| Kódblokk-javítók (Code Styler) | sorszámok, címek, másolás gomb | N-CODE | ✔ |

### 2.4 Navigáció és szerkezet

| Bővítmény | Mit csinál | Nálunk | Ítélet |
|---|---|---|---|
| Hover Editor / Page Preview (alap) | egy hivatkozott jegyzet előnézete vagy szerkesztése lebegő ablakban | N-LINK | ＋ **N-HOVER** |
| Folder Notes | a mappának saját nyitójegyzete van, a mappára kattintva az nyílik meg | N-FOLDER | ＋ **N-FOLDERNOTE** (egy munkamappa dossziéoldala) |
| Breadcrumbs | hierarchia- és sorrendmezők (`up:`, `next:`) navigációval | — | ＋ **N-TRAIL** |
| Homepage | indításkor egy választott jegyzet vagy nézet nyílik | N-DAILY | ◇ MindMD-beállítás; a Jegyzetek mindig a listával nyílik |
| Recent Files, Bookmarks (alap) | legutóbb nyitott, csillagozott jegyzetek és keresések | N-PIN, N-SMART | ✔ |
| Iconize / Icon Folder | ikonok és színek mappákon és jegyzeteken | N-PIN (színek) | ◐ ikonok csak a VRG UI Kit készletéből |
| Workspaces (alap), Stacked tabs | mentett panelelrendezések | — | ◇ MindMD-alap |
| Omnisearch | közelítő teljes szöveges keresés PDF-ekben és OCR-rel is | N-FIND, N-OCR | ✔ |
| Waypoint / MOC-eszközök | automatikus tartalomjegyzék egy mappához | N-FOLDERNOTE | ◐ a mappajegyzet beágyazhat egy N-QUERY listát |

### 2.5 Feladatok és idő

| Bővítmény | Mit csinál | Nálunk | Ítélet |
|---|---|---|---|
| Tasks | `- [ ] … 📅 2026-11-14 🔁 every week`, feladat-lekérdezések a tárolón át, kész-dátumok | N-TASK | ◐ az N-TASK ugyanazt az emoji-formátumot veszi át (kompatibilitás, §6); lekérdezés az N-QUERY-n át |
| Kanban | Markdown-fájlban tárolt tábla | N-BOARD | ◐ az N-BOARD ugyanilyen alakú Markdownban tárol |
| Calendar, Full Calendar, Day Planner | napi jegyzetek havi nézete; események jegyzetekben; napi idővonal | N-CAL | ◐ az N-CAL napi idővonalat kap (a helyszíni nap) |
| Reminder | értesítések dátumos feladatokhoz | N-REMIND | ✔ |

### 2.6 Vizuális gondolkodás

| Bővítmény | Mit csinál | Nálunk | Ítélet |
|---|---|---|---|
| Canvas (alap, JSON Canvas) | kártyák, jegyzetek, kapcsolatok végtelen táblán | N-CANVAS | ✔ (a MindMD vászna, JSON Canvas formátum) |
| Excalidraw | kézrajz-stílusú vázlatok Markdownban tárolva, beágyazhatóan | N-INK | ＋ **N-SKETCH** (vektoros vázlat: gyors bekötési vagy szekrényvázlat; az Excalidraw MIT, vendorolható, ED-Q06) |
| Mind Map / Markmind | címsorfa gondolattérképként | MindMap | ✔ (a MindMap eszköz; a MindMD egy jegyzetet térképként mutat) |
| Charts / Obsidian Charts | diagramok kódblokkból vagy táblázatból | — | ＋ **N-CHART** (mérési táblázatokból, pl. szigetelési ellenállás áramkörönként) |
| Mermaid (alap) | ábrák | N-DIAG | ✔ |
| Graph (alap), ExcaliBrain, Juggl | hivatkozási gráfok | N-GRAPH, Stack | ✔ |

### 2.7 Média és PDF

| Bővítmény | Mit csinál | Nálunk | Ítélet |
|---|---|---|---|
| PDF++ / Annotator | PDF-kiemelés, hivatkozás egy részletre, megjegyzések vissza Markdownba | N-PDF | ✔ (adatlapok, szabványok, ajánlatok) |
| Media Extended | hang / videó időbélyeg-hivatkozásokkal | N-VOICE | ◐ az N-VOICE időbélyeg-hivatkozásokat kap (`[[memo.m4a#t=1:32]]`) |
| Text Extractor | OCR képeken és PDF-eken | N-OCR | ✔ |
| Audio Recorder (alap) | hangfelvétel jegyzetbe | N-VOICE | ✔ |

### 2.8 Szinkron, mentés, verziókezelés

| Bővítmény | Mit csinál | Nálunk | Ítélet |
|---|---|---|---|
| Obsidian Git | a tároló git-repóként, automatikus commit / pull / push, előzmények, különbség | N-HIST, NOTES-Q04 | ＋ **N-GIT** (helyi commitok; push csak a mentési remote-ra, vagy *dev* tárolónál a repó saját szabályai szerint) |
| Remotely Save, Self-hosted LiveSync, Sync (hivatalos) | szinkron S3/WebDAV/CouchDB felé, E2E | N-SYNC-* | ✔ (a relénk + titkosított csomagok) |
| File Recovery (alap) | pillanatképek | N-HIST | ✔ |

### 2.9 Exportálás és közzététel

| Bővítmény | Mit csinál | Nálunk | Ítélet |
|---|---|---|---|
| Pandoc / Enhancing Export | DOCX, PDF, LaTeX, ePub Pandoccal | N-EXPORT | ◐ DOCX Pandoccal, *választható külső programként* (GPL-bináris, soha nem vendoroljuk a kódunkba) |
| Better Export PDF | PDF fejléccel, tartalomjegyzékkel, oldalszámmal | N-REPORT | ✔ (Varler-dokumentumstílus) |
| Digital Garden / Quartz / Publish | jegyzetek közzététele weboldalként | — | ✖ (nincs nyilvános közzététel; SIMPLE/ANALYSIS) |

### 2.10 Automatizálás és integráció

| Bővítmény | Mit csinál | Nálunk | Ítélet |
|---|---|---|---|
| Advanced URI | megnyitás, létrehozás, hozzáfűzés, keresés `obsidian://` hivatkozásokkal | N-LINKS | ✔ (`vrg://notes/…`) |
| Commander | parancsok felvétele eszközsorokba és menükbe | — | ◇ MindMD: a felhasználó által rendezett eszközsor; a Jegyzetekben soha (R3) |
| Shell Commands | parancssori parancsok futtatása jegyzetekből | — | ✖ (tetszőleges futtatás; egy jegyzet helyette megnevezhet egy START-műveletet, amelyet a héj a saját szabályai szerint futtat) |
| Execute Code | kódblokkok futtatása | — | ✖ (ugyanezért) |
| Local REST API, MCP Tools | HTTP / MCP hozzáférés a tárolóhoz szkripteknek és MI-ügynököknek | N-CLI, N-STACK | ＋ **N-MCP** (csak olvasó eszközök Claude-munkamenetek számára a vrg-stack MCP-n át, a láthatóság betartásával) |

### 2.11 MI

| Bővítmény | Mit csinál | Nálunk | Ítélet |
|---|---|---|---|
| Smart Connections | helyi beágyazások, kapcsolódó jegyzetek, csevegés a tároló felett | N-SEM, N-AI-ASK | ＋ **N-RELATED** („kapcsolódó jegyzetek” panel; a Jegyzetekben legfeljebb egy csip) |
| Copilot, Text Generator | csevegés, átírás, generálás promptokból | N-AI-* | ✔ (3. szint, kapcsoló mögött, *private*-on soha) |

### 2.12 Kinézet

| Bővítmény | Mit csinál | Nálunk | Ítélet |
|---|---|---|---|
| Style Settings, témák, CSS-töredékek | a kinézet módosítása változókkal és CSS-sel | VRG UI Kit | ＋ **N-THEME** (Mélyvíz-változók, sűrűség, betű; jegyzetből érkező szabad CSS nincs) |
| Banners, Pretty Properties | fejlécképek, tulajdonság-stílusok | — | ✖ (díszítés; a tulajdonságok csipként látszanak) |
| Minimal Theme Settings | elrendezési finomítások | N-FOCUS | ◇ |

### 2.13 Tanulás

| Bővítmény | Mit csinál | Nálunk | Ítélet |
|---|---|---|---|
| Spaced Repetition, Anki-szinkron | tanulókártyák jegyzetekből | — | ✖ egyelőre (később esetleg tanuló betanítására szabványokból; nem jegyzetigény) |
| Zotero Integration, Citations | tudományos hivatkozások | — | ✖ (az adatlapok és szabványok fájlként és PDF-ként kapcsolódnak) |

### 2.14 Amit a mi listánk tud, és egyetlen bővítmény sem

N-JOB, N-PLANPIN, N-SITE, N-MEAS, N-DIARY, N-REPORT (Varler-stílus), N-XLINK és N-STACK (hivatkozások a VRG munkagráfjába),
N-DEV és N-COMMIT (fejlesztői jegyzetek a Divergence-be és commitokba), N-VIS (négy láthatósági szint, minden kimenet
betartatja), N-SECRET (ügyféladat-őr), N-SYNC-LAN (telefon ↔ PC a párosított relén), Egyszerű mód helykerettel, a Háttérnapló
visszavonással. A piac bővítményei a *tudásról* szólnak, a mieink a *munkákról*. Az összefésülés mindkettőt megtartja.

---

## 3. Hogyan működne egy bővítmény nálunk

### 3.1 A lényeges különbség

Egy Obsidian közösségi bővítmény JavaScript, amely **a teljes alkalmazás-API-val, asztali gépen Node-dal és Electronnal**
töltődik be: bármely fájlt olvashat és írhat, elérheti a hálózatot, más kódot foltozhat, és a felület bármely részét
megváltoztathatja. A frissítések a bővítmény saját repójából érkeznek. Ez a szabadság az oka, hogy ezernyi bővítmény van, és
hogy mindegyik bizalmi döntés.

A miénk ennek fordítottja:

| | Obsidian közösségi bővítmény | VRG kiegészítő |
|---|---|---|
| Hol fut | az alkalmazás folyamatában, asztalon Node-dal | csak az oldalon (renderer); nincs Node, nincs `require`, nincs shell |
| Fájlok | bármely útvonal | a tárolószolgáltatás API-ja, jegyzetazonosító szerint, a láthatósági szűrőn át |
| Hálózat | bármi | csak a manifestben felsorolt hosztok, a héj fetch-én át; alapból semmi |
| Felület | bárhol, bármely DOM | csak a megadott kiegészítési pontok (§3.2); a Jegyzetekben csak a SIMPLE-helyek |
| Privát jegyzetek | olvashatók | soha nem kapja meg, hacsak a manifest nem kéri a `private`-ot, és a felhasználó meg nem adja |
| Tartalmi változtatás | csendben | a tárolószolgáltatáson át, a Háttérnaplóba írva, visszavonhatóan (R7, R8) |
| Terjesztés | közösségi katalógus, frissítés a szerző ütemében | saját kód a repóban, vagy a `vendor-manifest.json` által pontos verzióval és sha512-vel vendorolva; futás közbeni katalógus nincs |
| Ellenőrzés | beküldéskor | minden változás repóváltozás, ugyanúgy tesztelve, mint a többi |

### 3.2 Kiegészítési pontok (a bővítmény-API megfelelője)

| Obsidian-API fogalom | A mi kiegészítési pontunk | MindMD | Jegyzetek-hely |
|---|---|---|---|
| `addCommand` | `commands` | paletta, billentyűk, eszközsor | `…` menü (S4) |
| `registerMarkdownCodeBlockProcessor` | `codeblock` (pl. ` ```lekérdezés `) | olvasó- és élő nézetben megjelenítve | a jegyzetben megjelenítve (a törzsben: nem kerül helybe) |
| `registerMarkdownPostProcessor` | `render` (a megjelenített HTML átalakítása, utána fertőtlenítve) | igen | igen |
| `registerEditorExtension` (CM6) | `editor` (CodeMirror 6 kiegészítés) | igen | csak *csendesek* (nincs új felület): kiegészítés, okos tipográfia |
| `registerEditorSuggest` | `suggest` (`[[`, `#`, `@`, `/`) | igen | igen (gépelési segítség, nem hely) |
| `registerView` | `panel` (oldalpanel vagy lap) | igen | ✖, vagy *látogatás* (R4) |
| `addStatusBarItem` | `status` | igen | ✖ (az egyetlen állapotpötty a szinkroné) |
| `addRibbonIcon` | — | MindMD-eszközsor Commander-szerű beállítással | ✖ |
| fájlmenü / szerkesztőmenü események | `menu` | helyi menük | `…` menü (S4) |
| `addSettingTab` | `settings` | kiegészítőnként egy oldal | egy sor a Funkciókban (S9) |
| tárolóesemények (`create`, `modify`, `rename`) | `on` események | igen | igen |
| — (nincs megfelelője) | `job` (háttérfeladat naplóbejegyzéssel és visszavonással) | igen | a gépház |
| — | `chip` (csipszolgáltató prioritással) | a tulajdonságpanelen | S1, S2 |
| — | `folder` (intelligensmappa-szolgáltató) | fájlfa-szakasz | S7 |
| — | `field` (tulajdonságtípus: dátum, munka, pénz, áramkör, mérés) | tulajdonságpanel | csipek / jegyzettípus-űrlapok |
| — | `import` / `export` (formátum) | igen | `…` menü |

---

## 4. Az összefésült modullista (új modulok)

Ezek az ANALYSIS.hu.md §6 listáját (99 modul) **121**-re bővítik. Gazda: **J** Jegyzetek, **E** MindMD, **J+E** mindkettő.
A *Jegyzetek-lenyomat* a SIMPLE.hu.md §5 szerint.

### 4.1 Írás

| Azonosító | Modul | Mi ez | Szint | Gazda | Jegyzetek-lenyomat | Forrás |
|---|---|---|---|---|---|---|
| N-OUTLINE | Vázlatkezelő | listaelemek és ágak mozgatása billentyűvel, összecsukás, ágra nagyítás, listatudatos Enter / Tab | 2 | J+E | gépház (csak billentyűk) | Outliner |
| N-COMPLETE | Kiegészítés | szavak, hivatkozások, címkék, személyek, munkák és tulajdonságértékek a tárolóból, magyarul is | 2 | J+E | semmi (gépelési segítség) | Various Complements |
| N-LINT | Formázó | címsorok, listák, térközök, YAML-sorrend egységesítése; parancsként, vagy mentéskor változat megtartásával | 2 | E (+J parancs) | `…` menü | Linter |
| N-TYPO | Magyar tipográfia | „ ” és » « idézőjel, nagykötőjel, három pont, nem törő szóköz a `3 × 16 A`-ban, `30 mA`-ben | 2 | J+E | gépház | Smart Typography |
| N-PASTE | Okos beillesztés | URL → `[cím](url)` (hálózati képesség), Excel / CSV → táblázat, HTML → tiszta Markdown, kép → N-IMG | 1 | J+E | semmi | Auto Link Title, Paste URL |
| N-IMG | Képkezelés | átméretezés, tömörítés, átnevezés jegyzet és idő szerint, EXIF / GPS megtartása vagy eltávolítása láthatóság szerint | 1 | J+E | gépház | Image Converter |
| N-LONGFORM | Kéziratok | jegyzetek sorba rendezett halmaza egy dokumentummá fűzve (kézikönyv, munkadosszié) → N-EXPORT / N-REPORT | 3 | E | — | Longform |

### 4.2 Szerkezet és adatok

| Azonosító | Modul | Mi ez | Szint | Gazda | Jegyzetek-lenyomat | Forrás |
|---|---|---|---|---|---|---|
| N-QUERY | Lekérdezések és nézetek | biztonságos lekérdezőblokk (§5.3) és mentett nézetek: táblázat, lista, feladatlista, tábla, naptár, kártyák, tulajdonságok, címkék, hivatkozások, feladatok felett | 2 | E (+J eredmények) | a törzsben; a mentett nézetek mappaként (S7) | Dataview, Bases |
| N-TPL | Sablonok | változók (`{{dátum}}`, `{{munka}}`, `{{kérdés: Ügyfél?}}`), dátumszámítás, kurzorhely; kód nélkül | 1 | J+E | + lenyomva (S6) | Templater |
| N-PERIODIC | Időszakos jegyzetek | heti, havi jegyzetek sablonból; egy munka hete | 3 | J+E | mappák (S7) | Periodic Notes |
| N-NLDATE | Magyar dátumok | `holnap`, `jövő kedd`, `nov. 14`, `2 hét múlva` → dátum, feladatokhoz, emlékeztetőkhöz, sablonokhoz, kereséshez | 1 | J+E | gépház | Natural Language Dates |
| N-FOLDERNOTE | Mappajegyzetek | a mappa saját nyitójegyzete; a munkamappa a dossziéoldalával nyílik | 2 | J+E | mappák (S7) | Folder Notes |
| N-TRAIL | Hierarchia és sorrend | `fel:` / `következő:` tulajdonságok, morzsamenü, előző / következő | 3 | E | — | Breadcrumbs |
| N-HOVER | Lebegő előnézet | hivatkozott jegyzet előnézete és szerkesztése lebegő ablakban | 2 | E | — | Hover Editor |
| N-RELATED | Kapcsolódó jegyzetek | helyi hasonlóság (közös hivatkozások, címkék, szavak; később beágyazások) egy panelen | 3 | E (+J egy csip) | csip (S2) | Smart Connections |

### 4.3 Vizuális és média

| Azonosító | Modul | Mi ez | Szint | Gazda | Jegyzetek-lenyomat | Forrás |
|---|---|---|---|---|---|---|
| N-SKETCH | Vektoros vázlat | gyors vázlatok (szekrényelrendezés, bekötési ötlet) a jegyzet mellett tárolva, beágyazhatóan; telefonon toll, PC-n egér | 3 | J+E | beszúrás (S5) | Excalidraw |
| N-CHART | Diagramok | diagram táblázatból vagy lekérdezésből (mérési sorozatok, órák munkánként) | 3 | E (+J megjelenítés) | a törzsben | Charts |

### 4.4 Platform

| Azonosító | Modul | Mi ez | Szint | Gazda | Jegyzetek-lenyomat | Forrás |
|---|---|---|---|---|---|---|
| N-EXT | Kiegészítő-gazda | manifest, képességek, kiegészítési pontok (§3.2), láthatósági szűrő a kiegészítőknek, kiegészítőnkénti beállítások, a tesztkeret | 0 | J+E | — (ezen át töltődnek a helyek) | a bővítmény-API |
| N-WORKSPACE | MindMD-munkatér | fájlfa, lapok, osztott panelek, oldalpanelek, mentett elrendezések, bármely mappa megnyitása tárolóként | 1 | E | — | alap |
| N-GIT | Git-tároló | a tároló helyi repóként: commit tétlenségkor, előzmények és különbség a szerkesztőben, push csak az engedélyezett remote-ra (§4.6) | 2 | E (+J előzmények) | `…` menü → előzmények | Obsidian Git |
| N-MCP | Ügynöki hozzáférés | csak olvasó MCP-eszközök (`notes_search`, `notes_get`) a vrg-stack szerveren át, a láthatóság betartásával, minden olvasás az auditnaplóban | 3 | E | gépház | Local REST API, MCP Tools |
| N-THEME | Kinézet-beállítások | Mélyvíz-változók, sűrűség, betűk, olvasási szélesség; szabad CSS nincs | 2 | J+E | beállítások (S9) | Style Settings |

### 4.5 Meglévő modulok, amelyek nőnek

N-TYPE (mezőtípusok és -szerkesztők, a Metadata Menu nyomán) · N-ACTIONS (*rögzítés ide* célok, a QuickAdd nyomán) · N-TABLE
(oszlopképletek) · N-TASK (Tasks emoji-formátum, ismétlődés) · N-BOARD (Markdownban tárolt táblák, Kanban-formátum) · N-CAL
(napi idővonal) · N-VOICE (időbélyeg-hivatkozások) · N-EXPORT (DOCX választható külső Pandoccal) · N-EDIT (`==kiemelés==`,
szószám).

### 4.6 A git-szabály a MindMD-tárolókra

| Tároló | Commitok | Push |
|---|---|---|
| Jegyzetek tároló (ügyféladat) | helyben, tétlenségkor | csak a `Backup\code\jegyzetek.git`-be; az `origin`-ba soha; a `vrg-git` launcher-collect kihagyja (NOTES-Q04) |
| A repó tárolóként megnyitva (*dev*) | automatikusan soha; a MindMD mutatja a különbséget, a felhasználó a meglévő git-panelen commitol | a repó szabályai (`launcher-collect`, soha `--force`) |
| Egy munkamappa | helyben, tétlenségkor, ha a felhasználó bekapcsolja rá az N-GIT-et | csak a mentési remote |

---

## 5. A kiegészítő-architektúra

### 5.1 Egy manifest

```json
{
  "id": "query",
  "name": { "hu": "Lekérdezések", "en": "Queries" },
  "version": "1.0.0",
  "hosts": ["mindmd", "jegyzetek"],
  "capabilities": ["vault.read"],
  "visibility": ["internal", "dev"],
  "points": {
    "codeblock": ["lekérdezés", "query"],
    "folder": true,
    "settings": true
  },
  "jegyzetek": { "footprint": "folder", "behaviour": { "csendes": "background" } }
}
```

Képességek: `vault.read`, `vault.write` (a tárolószolgáltatáson át, naplózva), `net:<host>` (minden hoszt felsorolva),
`clipboard`, `notify`. Nincs `fs`, nincs `shell`, nincs `eval`. A `visibility` sorolja fel, mely jegyzeteket láthatja a
kiegészítő; a `private`-ot kérni kell, és a felhasználó kiegészítőnként adja meg.

### 5.2 Hol élnek a kiegészítők

`shared/notes-ext/<id>/` (manifest, `index.js`, `test/`, fixtúrák). A sajátok közönséges repókódok. Egy külső **vendorolva**
kerül be (pontos verzió + sha512 a `vendor-manifest.json`-ban), mi csomagoljuk manifestbe, és ugyanúgy átnézzük és teszteljük,
mint a sajátunkat. Futás közben semmi sem töltődik le. Minden kiegészítő fixtúrákat hoz, amelyeket a közös aranytesztek
futtatnak, és a SIMPLE visszaviteli tesztje minden kiegészítő bekapcsolásával is fut.

### 5.3 A lekérdezőnyelv (N-QUERY)

Olvasható, magyar és angol kulcsszavakkal, kód nélkül, így egy lekérdezés sosem tehet többet az olvasásnál:

````markdown
```lekérdezés
TÁBLA cím, munka, határidő
HONNAN #mérés
HOL munka = "Lakatos u. 12" ÉS NEM kész
RENDEZ határidő
```
````

Ugyanez angol kulcsszavakkal: `TABLE … FROM … WHERE … AND NOT done SORT …`. Az egyszerű Dataview-alakok (`TABLE`, `LIST`,
`TASK`, `FROM #tag`, `WHERE`, `SORT`) ugyanígy olvashatók, így egy importált Obsidian-tároló lekérdezései többnyire tovább
működnek; a JS-lekérdezések (`dataviewjs`) kódként látszanak, soha nem futnak.

---

## 6. Kompatibilitás az Obsidian-tárolókkal

A formátumok nyíltak, így a MindMD meg tud nyitni egy Obsidian-tárolót, az Obsidian pedig a miénket, miközben minden kódsor a
miénk:

| Formátum | Közös |
|---|---|
| Markdown + YAML frontmatter, tulajdonságnevek | ✔ |
| `[[wikilinkek]]`, `[[jegyzet#címsor]]`, `[[jegyzet#^blokk]]`, `![[beágyazások]]`, álnevek | ✔ |
| Kiemelőblokkok `> [!note]` | ✔ |
| Címkék `#a/b` a szövegben és a `tags:` mezőben | ✔ |
| Tasks emoji-formátum `📅 ⏳ 🔁 ✅` | ✔ |
| JSON Canvas `.canvas` | ✔ |
| Kanban-táblák Markdownként | ✔ (azonos alak) |
| Excalidraw `.excalidraw.md` | ◐ később olvasva, ha az N-SKETCH vendorolja az Excalidraw-t |
| `.obsidian/` beállítások és bővítmények | ✖ figyelmen kívül hagyva, soha nem futtatva |
| A mi többletünk | `id`, `rev`, `base`, `visibility`, `job` frontmatter-mezők: az Obsidianben ártalmatlanok; az `att/sha256/` alatti mellékletek sima útvonalként oldódnak fel |

---

## 7. Nyitott döntések (A = javasolt alapértelmezés)

| # | Kérdés | A (javasolt) | B / C |
|---|---|---|---|
| ED-Q01 | Név | **VRG MindMD** (megtartja a meglévő nevet és az `I:r0` ötletet) | B VRG Írás · C új név |
| ED-Q02 | Kódalap | **újraépítés a `shared/notes-core` + `notes-editor` alapon; a régi `varler_mindmd2.html` vászna az N-CANVAS kiindulópontja** | B a `varler_mindmd2.html` továbbnövesztése úgy, ahogy van |
| ED-Q03 | Külső kiegészítők | **csak vendorolva és becsomagolva; futás közbeni katalógus nincs** | B később válogatott katalógus, továbbra is rögzített verzióval |
| ED-Q04 | Lekérdezőnyelv | **saját biztonságos nyelv HU + EN kulcsszavakkal, amely az egyszerű Dataview-lekérdezéseket is olvassa** | B csak Dataview-szintaxis · C nincs lekérdezés, csak mentett keresések |
| ED-Q05 | A repó megnyitása tárolóként | **igen, *dev*-ként, git-tudatosan, automatikus commit nélkül** | B csak külön tárolók |
| ED-Q06 | Vázlatok | **N-SKETCH az Excalidraw (MIT) vendorolásával, 3. szinten** | B saját kis vektoros vázlat · C csak N-INK |
| ED-Q07 | Telefon | **a MindMD csak PC-s; a telefon a Jegyzeteken át olvassa a jegyzeteit** | B MindMD-olvasó telefonra |
| ED-Q08 | Pandoc | **választható külső program DOCX-hez, felismerve, soha nem csomagolva** | B nincs DOCX |

---

## 8. Építési sorrend (a Jegyzetek NT0–NT1 után, amelyek a közös magot építik)

1. **E1 — a munkatér:** N-EXT, N-WORKSPACE, N-PASTE, N-IMG, N-NLDATE, N-TPL. Bármely mappa megnyitása; lapok, panelek,
   paletta; a kiegészítők a gazdán át töltődnek. Bejegyezve a `vrg-menu.json` + `vrg-catalog.json` fájlba, mint bármely eszköz.
2. **E2 — tudás:** N-QUERY, N-FOLDERNOTE, N-HOVER, N-COMPLETE, N-OUTLINE, N-LINT, N-TYPO, N-GIT, N-THEME.
3. **E3 — vizuális és kiterjesztés:** N-CANVAS (a régi MindMD-ből), N-CHART, N-SKETCH, N-RELATED, N-TRAIL, N-PERIODIC,
   N-LONGFORM, N-MCP.

A Jegyzetek minden kiegészítőt abban a pillanatban megkap, amint a Jegyzetek-lenyomata meg van határozva, és a helykerethez
mérten tesztelve van.
