# tools/baseline — Erősáram alapréteg (2026-10-12)

A Planner nélkül futó motor, ami egy vázlat-`.vplan`-ból hagyományos, áramkör-pontos erősáramú alapréteget épít. Erre épül később minden további réteg (Adat/PoE, majd a többi). A motor logikája lesz a Planner későbbi munkafolyamata: Elosztó kiválasztása → használható falszakaszok → alapmagasság → szervizpontok → automatikus magasság → automatikus útvonal → áramkör-javaslat → automatikus bekötés.

```bash
node tools/baseline/run.js <vázlat.vplan.json> <kimeneti mappa> [config.js]
```

Kimenet: `<név>_alapreteg.vplan.json` (betölthető a Plannerbe) · `ALAPRETEG.md` (jóváhagyandó táblák, anyaglista) · `legs.csv` (minden csőszakasz) · `alap-halozat.png`, `alap-aramkorok.png`, `portal-sablon.png` (+ SVG).

| Fájl | Mit csinál |
|---|---|
| `geom.js` | falak, helyiségek, falsíkok (helyiségkerület, ívhossz-paraméter), a vázlatvonalakból és a Jelölés réteg „plusz” falaiból a használható falszakaszok |
| `rules.js` | szabványmagasságok, a portál összes helye (`PORTAL_SLOTS`), dobozok, kábel/cső táblák (a 05w-fill számai), csőméretezés |
| `prep.js` | végpontok (helyiség, falsík, környezet: ágy, munkalap, sziget, vizes), magasságok, portálok (kilincsoldal), portál-tagok és helyük |
| `network.js` | a fal menti gráf: csomópont a sarkokban, a szakaszhatárokon és minden horgonyon; nyitott perem; jelöletlen fal 4× súllyal |
| `plan.js` | leállás-csoportok, szervizpont-hozzárendelés, lámpa→kapcsoló, áramkörök, a gerinc-fa, kábelutak, dobozok, csőszakaszok |
| `emit.js`, `template.js`, `sheet.js` | lapok, jelentés, CSV, kimeneti vplan; a portálsablon; SVG → PNG (hordozható headless Chrome) |
| `p33.config.js` | amit a vplan még nem tud (munkalap, sziget, vizes helyiségek, világítási zónák, javasolt dugaljkörök) — később ezek Planner-műveletek |
| `labels.js` | feliratelhelyező: a feliratok nem kerülnek egymásra, jelre vagy vonalra; ha el kell tolni, vezetővonalat kapnak |
| `selv.js` | v2: minden további BRIDGE-réteg előkészítése — rétegenként a data.js útvonala (saját cső, végpontonként saját kábeltípus), a horony közös / mellett / új osztályozása a v1 horonyaihoz képest, függőleges oszlopok |
| `p33.v2.js`, `p33.v2.report.js` | P33 v2 felmérés: CHANNEL, 230 V a fülkékhez, V1 felszálló, médiafal, biztonság, egységárak és a v1 ↔ v2 összevetés → `V2_FELMERES.md`, `v2_mennyisegek.json`, `v2_legs.csv` |
| `data.js` | Adat/PoE réteg: végpont → legközelebbi RBX (vagy csillag a BASE-ből), RBX → BASE uplink, ISP-cső; saját sáv 2700-on, átvezetés a portál fészkén (H0) |
| `led.js` | LED-futások: egy kezdőpont + egy ⌀68 süllyesztett doboz futásonként, a betáphoz közelebbi végen |
| `emit-data.js` | `adat-halozat.png`, `led-betap.png`, `osszevetes.png`, `ADATRETEG.md`, `ADATRETEG-Q-001.json`, `<név>_adatreteg.vplan.json` |
| `p33.oldplan.js` | a felhasználó korábbi P33-terve ellenőrzőlistaként (78 jel, pixel → mm leképezéssel) |
| `debug-geom.js`, `debug-prep.js` | fejlesztői ellenőrzőlapok |

Szabályok röviden (a felhasználó döntései, 2026-10-12):
- Vízszintes pálya csak jelölt falon fut. Jelölt fal a vázlatvonal alatt van (500 mm tűréssel), vagy a Jelölés réteg „plusz” fala vagy oldala. Jelöletlen falat a motor csak akkor használ, ha másképp nem érhető el, és ilyenkor figyelmeztet.
- Falon átvezetni csak szervizponton lehet: portálnál (ajtó), RBX-nél vagy BASE-nél.
- A gerinc 2600-on fut, egyetlen fa az Elosztóból, és áramkörönként egy kábelt visz. Kerüli a többi szervizpontot, ahol van kerülőút.
- A cső ott szakad meg, ahol az áramkör véget ér vagy elágazik, RBX-ben, és 3-nál több ív után közös húzódobozban.
- A leágazó 2450-en fut. Minden leállásnál 2 szerelvényes kötődoboz van. A lámpa és a kapcsolója a kapcsoló leállás-dobozában találkozik.
- Tartalékdoboz kerül minden sarokba, ahová pálya ér, és minden pálya végére. Sarok csak a valódi irányváltás: két egy vonalban álló fal csatlakozása vagy egy 60 mm alatti falvastagság-ugrás nem sarok (javítva 2026-10-12).
- A csőben legfeljebb `maxCablesPerPipe` (P33: 3) kábel lehet. A méretezés: 1 kábelnél a cső belső átmérője ≥ 1,4 × a kábel átmérője; több kábelnél a töltés ≤ 40 %, 10 m felett ≤ 33 %.
- A portálon a zsanéroldal csak SELV, a kilincsoldal 230 V. A panel külön SELV oszlopban ül. Lásd `portal-sablon.png`.

Az ADATRETEG-Q-001 válaszai után (2026-10-12, 2. kör):
- `ceilLinks` — mennyezeti átvezetés ott, ahol a falvonal megszakad (P33: a lépcsőnyílás fölött). A gerinc és az adat használhatja, a leágazó nem. Mindkét végén húzódoboz van.
- `prepared` — előkészített útvonal (P33: a bejárati ajtó redőnye). A motor a pálya mellett megrajzolja és listázza (ALAPRETEG.md 4b), és a vplan-ban külön rétegre teszi. Az anyaglistában nincs benne.
- `led[].cont` — a szalag folytatódik, saját kezdőpont nélkül. Csak jelölve van, a hossz alaprajzi vetületben értendő.
- `data.isp` — a szolgáltatói bekötés üres csövei, mindegyik saját csőben (P33: optika + koax).
- `socketPlan[].dedicated` — új dedikált kör (P33: A15, a sütőtorony 2. készüléke). `edits[].setNote` — javított jegyzet (D12 / D13).
- `adatAnswers` + `oldPlanAnswers` — az 1. kör válaszai. Ha megvannak, a motor csak `ADATRETEG-Q-002.json`-t ír (a nyitott pontokról), a kitöltött Q-001-hez nem nyúl.
- A leállás-lánc a 2450-es dobozból a fölötte álló pontokhoz (redőnymotor) külön, felfelé fut.
- Az áthaladó leágazó-cső a doboz mellett halad el. Dobozba csak ott megy, ahol az áramköre betáplál, végpontot táplál, elágazik, véget ér, vagy ahol a kábelkészlete változik, illetve 3-nál több sarok után. A lapok a dobozok közti szakaszokat rajzolják (`R.spans`), minden ott futó csővel.
- `takeoff.js` → `<név>_takeoff.json` + `MENNYISEGEK.md`: a mennyiségek ár nélkül, a Varler Workflow Kit árazásához (horony, cső, kábel, doboz, végpont, átvezetés, adat, LED, nem számolt tételek).
- v1 pillanatkép: `Calculator/P33-baseline/v1_2026-10-12/`.
- Feliratok: az egy helyen álló pontok közös feliratot kapnak („K3 · K3b · K3c”). A ferde vonalak és a vezetővonalak is védenek a feliratok ellen.

Adat/PoE réteg (2026-10-12, alapértékek — mind kérdés az `ADATRETEG-Q-001`-ben): Cat6A, minden port saját kábel; a végpont a legközelebbi RBX-be (silver rail), az RBX 2× Cat6A-val a BASE-be; vízszintes sáv 2700, a gerinc fölött; csövenként legfeljebb 4 Cat6A, legalább M20; elágazó doboz, ahol a cső szétválik, húzódoboz 2 falsarok után; portál mellett elhaladva nem megy a dobozba, falon át csak a fészken (H0).
