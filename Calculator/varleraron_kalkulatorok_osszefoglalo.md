# várlerÁron — Munkadíj + Anyagár kalkulátorok

**Forrás:** „LED munkadíj árképzési kalkulátor" beszélgetés (2026-06-08)
**Tartalom:** három önálló, egyfájlos HTML eszköz árképzési modellje, egységáraival és felépítésével együtt.

---

## 0. Az eszközcsalád logikája

Három kalkulátor, egységes sötét-borostyán stílusban (Saira Condensed + JetBrains Mono), mindegyik önálló HTML fájl, offline is fut, telefonra optimalizálva felmérésre:

| Fájl | Mit fed le |
|---|---|
| `led_arkalkulator.html` | LED szalag telepítés **munkadíj** |
| `panel_felujitas_kalkulator.html` | Panellakás részleges felújítás **munkadíj** |
| `panel_anyagar_kalkulator.html` | Panellakás **anyagár** (a fenti párja) |

A munkadíj- és az anyagár-kalkulátor együtt adja a `Végösszeg`-et. Az anyagár-kalkulátor aljára beírható a munkadíj a másik eszközből, és kiszámolja az **anyag arányát** a teljes díjból.

---

## 1. LED szalag munkadíj — a „2–2–6–8" modell

**Referenciamunka:** 250 000 Ft munkadíj · 42 m szalag · 33 kötési pont · 5 tápegység · 10 dimmer csatorna

Négytényezős, súlyozott bontás:

```
  Szalag            2 000 Ft / m
  Kötési pont       2 000 Ft / db
  Dimmer csatorna   6 000 Ft / db
  Tápegység         8 000 Ft / db
```

Fejben tartható rövidítés: **2–2–6–8**.

**Az eszköz funkciói**
- Mind a négy egységár helyben átírható (drágább táp, COB szalag magasabb méterára stb.), „2/2/6/8 alaphelyzet" gomb visszaállít.
- Haszonkulcs csúszka 0–60%, az „Alap" (kulcs nélküli) összeg külön is látszik.
- Önellenőrző mutatók: effektív Ft/m, kötéssűrűség (kötés/m), komplexitás arány (dimmer + táp hányada az alapdíjban).
- +/– léptető gombok minden mezőn, hogy helyszínen kesztyűvel is menjen.

---

## 2. Panellakás felújítás munkadíj — nyolctényezős modell

**Referenciamunka:** ~1 500 000 Ft · 55–60 m² panellakás · részleges villamos felújítás

> Feltételezés: az 1 500 000 Ft **anyag + munka** együtt („Végösszeg"), nem tiszta munkadíj — ezért magasabbak az egységárak. Tiszta munkadíjra az árak egyszerűen átírandók.

### Szétbontás (kapcsoló 7 db, kábel 52 m, alapterület 57 m²)

| Tétel | Egységár | Menny. | Részösszeg | Arány |
|---|---|---|---|---|
| Elosztótábla (ÁVK, 6–8 kör) | 330 000 | 1 | 330 000 | 22% |
| Dugalj (kiemelőkeretes, FK) | 12 000 | 30 | 360 000 | 24% |
| Új áramkör | 45 000 | 4 | 180 000 | 12% |
| Kábel (anyag + húzás) | 3 500 / m | 52 | 182 000 | 12% |
| Alapterület (általános / felvonulás) | 3 600 / m² | 57 | 205 200 | 14% |
| Vésés (panelbe + helyreállítás) | 10 000 / m | 10 | 100 000 | 7% |
| Lámpa (20×20 LED panel) | 20 000 | 5 | 100 000 | 7% |
| Kapcsoló csere | 6 000 | 7 | 42 000 | 3% |
| | | | **≈ 1 499 200** | 100% |

### A „létra" — nagyság szerint lefelé

```
  Tábla         330 000
  Áramkör        45 000  / db
  Lámpa          20 000  / db
  Dugalj         12 000  / db
  Vésés          10 000  / m
  Kapcsoló        6 000  / db
  Kábel           3 500  / m
  Alapterület     3 600  / m²
```

### Csoportosítás a kalkulátorban
Négy blokk, felmérési sorrendben: **munkaterület → infrastruktúra → szerelvénypontok → folyóméter**.

- **Infrastruktúra** (tábla + áramkörök) ≈ 34%
- **Darabszámos pontok** (dugalj + lámpa + kapcsoló) ≈ 34%
- **Folyóméter + alapterület** ≈ 33%

### Sanity-mutatók
- **Infrastruktúra arány** — 40% fölött a munka komplexitás-vezérelt, nem darabszám-vezérelt.
- **Effektív Ft/m²** — az ügyfél ezt várja, de félrevezető. (1 500 000 / 57 m² = 26 316 Ft/m², ugyanaz a 57 m² viszont a fele is lehetne új tábla és kevés pont mellett.)
- **Szerelvénypont db** — kapcsoló + dugalj + lámpa összege gyors ellenőrzésre.

### Figyelmeztetések a modellhez
- A **vésés 10 000 Ft/m helyreállítással együtt**. Helyreállítás nélkül vagy gipszkarton mögé húzva jóval kevesebb; panelbetonnál felfelé csúszik. Falazat szerint állítandó a felmérésen.
- A **tábla 330 000 Ft a legnagyobb egyedi bizonytalanság**: egyszerű ÁVK + 6 kismegszakító csere ~200 000 is lehet, egy túlfeszültségvédős, mért, dokumentált, 8-körös szabványosított tábla viszont 400 000 fölé is mehet. Egyetlen darab, közvetlenül a mezőjében állítandó — a végösszegre ez hat a legérzékenyebben.
- Az **m² nem közvetlen költségtényező**, hanem általános ráfordítás (felvonulás, takarítás, helyreállítás, mozgás, felmérés) — alacsony m²-es alapdíjként visszük be, így más méretű lakásra is skálázódik.

---

## 3. Panel anyagár kalkulátor

**Alaphelyzet a referenciamunkára:** ~417 000 Ft anyag (a ~1,5 M Ft-os díj ~28%-a → a díj ~72%-a munka, ami a sok véséssel és táblamunkával reális).

### Egységárak

**Elosztótábla** — csúszka 120 000 – 200 000 Ft (alap: 160 000)

**Kábel**
| Tétel | Ár |
|---|---|
| MBCu 3×1,5 | 500–700 Ft/fm (alap 600) |
| MBCu 3×2,5 | 750–900 Ft/fm (alap 825) |
| Gégecső | 150–250 Ft/fm (alap 200) |
| Kábelcsatorna vékony | 1 500 Ft/m |
| Kábelcsatorna vastag | 2 500–3 000 Ft/m (alap 2 750) |
| Gipsz | 250–500 Ft/kg (alap 375) |

**Schneider Asfora szerelvények**
| Tétel | Ár |
|---|---|
| Dugalj | 1 000–2 000 Ft/db (alap 1 500) |
| Kapcsoló — sima | 1 000–2 000 Ft/db (alap 1 500) |
| Kapcsoló — dupla (102, 105, 106) | 1 500–3 000 Ft/db (alap 2 250) |
| Kapcsoló — extra (107, 106+6 stb.) | 3 000–5 000 Ft/db (alap 4 000) |
| Kiemelőkeret | 2 000–3 000 Ft/db (alap 2 500) |

**Lámpa** — összérték + darabszám külön beírva, per-db átlagot mutat.

### A kábelszekció kétszintű logikája (ez a kulcsrész)

1. **Felső csúszka**: az összhosszt osztja 1,5 / 2,5 keresztmetszetre (alap 60% / 40%), élőben mutatja a méterlebontást → ebből jön a tiszta kábel-anyagár.
2. **Alatta a szerelési mód** méterben: **sima** (kábelszeg, álmennyezet felett) / **süllyesztett** (gégecső hozzászámolva) / **csatornás** (vékony-vastag csatorna, külön aránycsúszkával).
3. **Kiosztás-ellenőrző**: a „Kiosztva: X / Y m" sor **zöldre vált**, ha a három mód összege kiadja az összhosszt; ha nem stimmel, sárga marad — azonnal látszik az elszámolás.

### Egyéb szekciók
- **Egyéb költség**: tetszőleges sorok, szerkeszthető szöveg + ár, hozzáadható/törölhető. Példasor: „Kötődobozok / WAGO / apró anyag" — 15 000 Ft.
- **Tartalék csúszka**: 0–30%, a végösszeg előtt. Mutatja a felárat forintban is.
- **Munkadíj mező** a legalján: beírva kiszámolja a `Végösszeg`-et és az anyag arányát.

### Export
Szöveges anyaglista generálása pontozott sorokkal:
- a tartalék **bele van építve a tételárakba**, de a százalék maga **nem jelenik meg** az exportban;
- „Vágólapra" gomb + letöltés `anyaglista.txt` néven.

### Két gomb, két külön funkció
- **„Példa munka"** — betölti a teljes referenciamunkát (mennyiségek + egységárak).
- **„Nullázás"** — csak a **mennyiségeket** nullázza, az összes kalibrált egységárat és arányt megtartja. Betöltéskor is ez az alapállapot.

### Amit helyszínen finomítani érdemes
A **kiemelőkeret darabszáma** alaphelyzetben 30 (a falon kívüli dugaljakhoz). Ha több poszt kap keretet vagy keretes blokkokba kerülnek, ott állítandó — ez a szerelvény-anyag egyik legérzékenyebb tétele.

---

## 4. Egységes tervezési elvek (mindhárom eszközben)

- Önálló, egyfájlos HTML — nincs függőség, offline megy, pendrive-ról is.
- Sötét ipari stílus, borostyán kiemelés; Saira Condensed (címek) + JetBrains Mono (számok).
- Nagy betűk, 46 px magas beviteli mezők — kesztyűs, telefonos használatra.
- Minden egységár **helyben átírható**, nem beégetett.
- Szekciónkénti élő részösszeg + globális végösszeg.
- Csúszkák az arányokhoz, számmezők a darabszámokhoz.
- Sanity-mutatók minden eszközben (arányok, effektív egységárak, darabszám-ellenőrzés).
