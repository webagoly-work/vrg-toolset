# VRG Post-it — jegyzet bármelyik képernyő egy pontjára (N-POSTIT)

*2026-11-25. A VRG Jegyzetek egy rögzítőpont-modulja ([SIMPLE.hu.md](SIMPLE.hu.md) S10), a VRG Asztalon (WP-50) és a VRG
Mobile-on (WP M68). Angol változat: [POSTIT.md](POSTIT.md); a kettőt együtt javítsd.*

Tartalom: §1 mi ez · §2 hogyan illeszkedik a Jegyzetekhez · §3 a horgony · §4 a csomagformátum · §5 a két folyamat (tesztelő,
fejlesztő) · §6 hol van a kódban · §7 korlátok · §8 döntések · §9 következő lépések.

---

## 1. Mi ez

Egy kis réteg, amit a tesztelő a Beállításokban kapcsol be. Bekapcsolva **két kis gomb ül a bal felső sarokban, minden képernyő
fölött**:

| Gomb | Mit csinál |
|---|---|
| 👁 **Mutat / elrejt** | a jegyzetek láthatósága |
| 📌 **Élesít / hatástalanít** | élesíti a réteget: a **következő kattintás (PC) vagy koppintás (telefon)** halvány jelet hagy azon a ponton, és mellette szövegdobozt nyit, ahogy a Planner jegyzet eszköze. Mentéskor oda kerül egy lebegő Post-it; egy jegyzet után hatástalanodik. |
| **DEV** | csak a fejlesztő telepítésén: a tesztelők jegyzetei is látszanak, tesztelőnként saját színnel |

Jobb klikk (PC) vagy hosszú nyomás (telefon) a 📌-on: kis menü — a tesztelő neve, **Export / Küldés** (egy fájl a telepítés
összes jegyzetével), a saját jegyzetek törlése, a fejlesztőnél **Behívás** (a tesztelők fájljai) és tesztelőnként egy kapcsoló.

A cél: a tesztelő *ott* ír megjegyzést, ahol a hibát látja; a fejlesztő behívja a fájljait, és DEV-vel ugyanazokon a
képernyőkön látja ugyanazokat a jegyzeteket a saját PC-jén vagy telefonján („azt látom, amit ő”).

## 2. Hogyan illeszkedik a Jegyzetekhez

A Jegyzetek R3 szabálya szerint egy funkció csak a slotjaiba rajzolhat. A Post-it a Jegyzeteken belül egyáltalán nem rajzol:
**rögzítőpont (S10)**, ami a *többi* alkalmazás fölött él, mint a telefon widget vagy a webes kivágó. Tehát a jegyzetmotor
modulja, saját kis felülettel azon kívül:

| A modul része | Hol |
|---|---|
| rögzítő felület | a réteg (két gomb, a jelek, a szerkesztő) az Asztal ablaka és a telefonos alkalmazás fölött |
| tár | ma saját fájlok (§6); amint a Jegyzetek tárolója (N-VAULT) kész, a Post-it egy közönséges jegyzet, a horgony a frontmatterben, és egy *Post-it* okos mappa (S7) |
| beállítás | egy sor (S9): *Post-it jegyzetek a képernyőn*; a telefonon egy második sor a fejlesztői réteghez |
| formátum | `vrg-postit/1` (§4), közös a két platformon, egy fixture ellen tesztelve |

A kapcsoló kikapcsolása mindent eltüntet, amit hozzáad (a PC-n nincs ablak, a telefonon semmi nem rajzolódik); a jegyzetek a
lemezen maradnak.

## 3. A horgony

Egy jegyzet **egy képernyőre** és **azon egy pontra** mutat, törtként tárolva, hogy más ablakméretet vagy telefont is túléljen:

```json
{ "screen": "d:app/inventory", "detail": "/Inventory/index.html#tab=2", "x": 0.5, "y": 0.25, "w": 1180, "h": 760 }
```

`x`, `y` a horgony **dobozának** törtrészei; `w`, `h` a doboz mérete a jegyzet születésekor (PC-n px, telefonon dp), csak azért
tároljuk, hogy később kiderüljön, ugyanaz volt-e az elrendezés. `detail` opcionális alhely, a jegyzet fejlécében látszik, az
egyeztetésben nem számít. Egy jegyzet csak akkor rajzolódik ki, ha a `screen`-je most nyitva van.

### 3.1 Képernyőkulcsok a VRG Asztalon (`d:`)

A PC-s réteg megkeresi a kattintás alatti legfelső panelt (a beépített alkalmazások, a webes lapok és a Kezdőlap ismert
téglalapú WebContentsView-k), és **ahhoz a panelhez** horgonyoz, így a jegyzet az alkalmazás ugyanazon pontján marad, ha a
paneleket mozgatják vagy átméretezik.

| Kulcs | A doboz |
|---|---|
| `d:app/<katalógus id>` | egy beépített HTML alkalmazás panelje (`vrg-app://<id>/…`); `detail` = útvonal és hash |
| `d:web/<host>` | egy webes lap panelje; `detail` = az útvonal (soha a lekérdezés: tokent tartalmazhat) |
| `d:home` · `d:mail` | a Kezdőlap panel · a levélolvasó nézet |
| `d:frame/dashboard` · `d:frame/desktop` | maga a keret, minden panel alatt: az Irányítópult vagy az Asztal nézet |

### 3.2 Képernyőkulcsok a VRG Mobile-on (`m:`)

A telefon az egész alkalmazás-területhez horgonyoz (egyszerre egy alkalmazás látszik): `m:<funkció id>` (`m:notes`, `m:sketch`
…), `m:home`, `m:home/compact`, `m:catalog`, `m:planned/<id>`, `m:sheet/<id>`, `m:lock`. Telefonos jegyzet csak telefonon,
PC-s csak PC-n rajzolódik ki; mindkettő megmarad és listázódik, bármelyik oldal hívja is be.

## 4. A `vrg-postit/1` csomagformátum

Exportonként egy JSON fájl, neve `postit-<dátum>….vrgpostit.json`. Közös fixture: `shared/postit/fixtures/bundle-v1.json`.
A mintát lásd az angol változat §4-ében (a mezők nevei angolok, a kettő ugyanaz a fájl).

Szabályok (a `postit-core.js` és a `PostIt.kt` is betartatja; hibás fájlt az első okkal utasít el): az `author.id` az első
indításkor készült véletlen azonosító (soha nem név, fiók vagy hardverazonosító); `platform` `desktop` vagy `mobile`; legfeljebb
500 jegyzet; szöveg 1–2000 karakter; `state` `open` vagy `done`; `edited ≥ at`; egyedi azonosítók; a képernyőkulcs illeszkedik a
`^[dm]:[A-Za-z0-9._/:-]{1,158}$` mintára. Az ismeretlen kulcsok olvasáskor kiesnek, íráskor sosem kerülnek bele.

**Összefésülés a fejlesztő bejövő tárába:** szerzőnként tárolva, azonosító szerint párosítva; az újabb `edited` nyer. Ugyanazt a
fájlt kétszer behívni semmit nem változtat; ugyanannak a tesztelőnek egy későbbi exportja csak hozzáad és frissít. A fejlesztő
*Kész* jelölése a bejövő tárban marad (a tesztelő saját példánya az övé).

## 5. A két folyamat

**Tesztelő** (PC vagy telefon, Felhasználó szint / fejlesztői réteg nem engedélyezett):
1. Beállítások → *Post-it jegyzetek a képernyőn* be. Megjelenik a két gomb bal felül.
2. 📌, majd kattintás vagy koppintás oda, ahol a gond van. Gépelés, **Mentés** (PC-n Ctrl+Enter). Kívül kattintás is ment;
   Esc / Vissza: mégse.
3. Hosszan nyomva / jobb klikk a 📌-on → egyszer a név → **Küldés / Export**: a PC fájlt ment, a telefon megosztja (bármilyen
   üzenetküldő, levél, Drive).

**Fejlesztő** (PC Dev vagy Minden szinten; telefon *Fejlesztői réteg engedélyezése* bekapcsolva):
1. Hosszan nyomva / jobb klikk a 📌-on → **Behívás fájlból…** → egy vagy több fájl. (Telefonon a VRG Mobile-nak szövegként
   megosztott csomag is behívódik.) Az első behívás bekapcsolja a DEV-et.
2. Nyisd meg azokat a képernyőket, amikről a tesztelők írtak: a jegyzeteik ott lebegnek, ahová tűzték, a tesztelő színében,
   névvel és eszközzel. Koppintva olvasható, és **Kész**-re állítható.
3. A menü tesztelőnként egy kapcsolót ad, hogy egyszerre egy tesztelőt lehessen nézni.

## 6. Hol van a kódban

A táblázat az angol változat §6-ában van (fájlnevek, mindkét nyelven ugyanazok). Röviden: közös szabályok
`shared/postit/postit-core.js` és `kit-core/.../PostIt.kt`; PC: `Dashboard/shell/lib/postit.js` + `Dashboard/page/postit.html`
/ `postit.js`; telefon: `kit/.../postit/PostItStore.kt` + `PostItLayer.kt`; tesztek: `Dashboard/test/wp-50.test.js` és a
`kit-core` `PostItTest`.

**Miért ablak a PC-n:** a beépített alkalmazások, a webes lapok és a Kezdőlap WebContentsView-k, natív rétegek a keret oldala
fölött, így a keret DOM-jában semmi nem takarhatja őket. A réteg egy átlátszó, keret nélküli **gyermekablak** a főablak
tartalma fölött (vele mozog, méreteződik, rejtőzik). Átengedi az egeret (`setIgnoreMouseEvents(true, {forward})`), kivéve a saját
gombjai, kártyái, szerkesztője és menüje fölött; élesítve egy kattintásra az egész felületet átveszi.

**Miért utolsó a gyökér Boxban a telefonon:** a Compose találatvizsgálata a legfelső, érintést fogadó elemnél áll meg, így a
réteg gombjai és kártyái megkapják a koppintásukat, élesítve a fogó réteg kapja a következőt, máshol pedig a koppintás átmegy
az alkalmazásnak.

## 7. Korlátok (ma)

- **Saját ablakot nyitó telefonos párbeszédek és lapok** (Compose `Dialog`, `ModalBottomSheet`, rendszerválasztó) az alkalmazás
  ablaka fölött ülnek, így a réteg fölött is. Ezekre jegyzetet a POSTIT-Q03 „más alkalmazások fölött” módja adna.
- **PC-s natív felugrók** (`<select>` lista, helyi menü) nyitva a rétegablak fölött vannak.
- A jegyzet képernyőhöz kötött, nem elemhez: ha egy alkalmazás a panelen belül arrébb teszi a gombot, a jegyzet a régi helyre
  mutat. A `w`, `h` később felismerhetővé teszi az elrendezésváltást (POSTIT-Q05).
- Az átvitel fájl (export → bármilyen csatorna → behívás). Nincs szerver, nincs fiók, semmi nem hagyja el magától az eszközt.

## 8. Döntések (A = itt alapértelmezésként megépítve; a Founder módosíthatja)

| # | Kérdés | A (megépítve) | B / C |
|---|---|---|---|
| POSTIT-Q01 | Átvitel tesztelőtől fejlesztőig | **fájl** (PC: mentés; telefon: megosztás), a fejlesztő hívja be | B a GitHub `mobile-log` ág (a Gyorsjegyzet útja) párosított eszközöknek · C a LAN relay |
| POSTIT-Q02 | Ki látja a DEV réteget | **PC: Dev / Minden szint; telefon: Beállítások kapcsoló** | B build kapcsoló |
| POSTIT-Q03 | „Mindenek felett” a telefonon | **alkalmazáson belüli réteg** (a VRG Mobile minden képernyője fölött, a párbeszédablakai fölött nem) | B „más alkalmazások fölött” mód is (SYSTEM_ALERT_WINDOW engedély) |
| POSTIT-Q04 | Horgonydoboz a PC-n | **a kattintás alatti panel** (túléli a panelmozgatást) | B az egész ablak |
| POSTIT-Q05 | Ha az elrendezés változott (`w`/`h` nagyon eltér) | **ugyanazon törteknél rajzol** | B halványan, „más elrendezés” jelzéssel |
| POSTIT-Q06 | Képernyőkép minden jegyzethez | **nem** (adatvédelem: a képernyőn ügyféladat lehet) | B opcionális, elmosott bélyegkép |
| POSTIT-Q07 | Élesítésenként egy jegyzet | **igen**, lerakás után hatástalanodik | B élesítve marad a következő 📌-ig |

## 9. Következő lépések

1. **Telefonon ellenőrizni** (M68) és a PC-s ellenőrzőlista a `docs/mobile/WP/M68.md`-ben — mindkettő BETA, amíg a Founder végig
   nem ment rajtuk.
2. POSTIT-Q01 B: *Elküldés* párosított telefonról a repó `mobile-log` ágára, és *Behívás a repóból* a PC-n.
3. Ha a Jegyzetek tárolója kész: a Post-itek `anchor:` frontmatteres jegyzetek lesznek egy okos mappával; a csomag marad a
   csereformátum.
4. POSTIT-Q03 B, ha a párbeszédablakokra írt jegyzet fontosnak bizonyul.
