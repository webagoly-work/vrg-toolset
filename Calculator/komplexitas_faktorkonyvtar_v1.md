# Komplexitás-faktorkönyvtár

**4. ág kimenete** · v1 · 2026-09-06
Bemenet: 2. ág (tételkatalógus), 3. ág (modell-specifikáció), Áron- és Varler-korpusz

---

## 0. Ami megváltozott a 3. ághoz képest

| | 3. ág | 4. ág |
|---|---|---|
| K1 Szerkezet | szorzó a tételen | **kikerül**: a szerkezetbontó primitívek faltípusonkénti változatai |
| Komplexitás-sapka | 2,5 az egész szorzatra | **2,2** a megmaradt öt családra |
| Betonmarás | önálló primitív | a szerkezeti primitívek vasbeton-változata (nem kell külön) |
| Ismeretlen hálózat felderítése | K4 faktor 0,35 | **`óra`-alapú tétellé léptetve** |

---

## 1. A faktor/primitív határszabály

Az egész könyvtár ezen a szabályon áll:

> **Ha egy tényező ugyanazt a műveletet nehezíti, faktor. Ha másik műveletet jelöl, primitív.**
>
> Gyakorlati küszöb: ha egy tényező értéke egy egész primitívosztályon következetesen `f > 1,0` (azaz több mint duplázza az időt), az nem faktor — az másik művelet. Léptesd primitívvé.

Ez alapján három tényező lépett ki a faktorok közül:

| Volt faktor | Lett | Miért |
|---|---|---|
| vasbeton szerkezet (`f ≈ 3,8`) | primitív-változat | másik szerszám, másik technika |
| ismeretlen hálózat felderítése | `óra`-alapú tétel | nem a szerelést nehezíti, hanem külön munka előtte |
| állványos magasmunka (`f ≈ 1,2`) | primitív-változat (lásd 5.) | állványépítés önálló idő, nem lassulás |

---

## 2. A szerkezetbontó primitívek faltípusonként

Nem faktor, hanem négy külön normaóra. A tégla-oszlop Áron villaajánlatából mért (`●●●`), a többi az árlistád levezetett arányaiból (`●●○`), a gipszkarton bottom-up (`●○○`).

| Primitív | Egys. | Gipszkarton | Tégla | Vegyes | Vasbeton / panel |
|---|---|--:|--:|--:|--:|
| Horonyvésés 8–16 cm² | m | 0,05 | **0,34** | 0,74 | 1,64 |
| Horonyvésés 24–50 cm² | m | — | **0,34** | 0,74 | 1,64 |
| Fészekvésés 78×78 | db | 0,12 | **0,33** | 0,51 | 0,71 |
| Fészekvésés 150–200 mm | db | 0,18 | **0,50** | 0,77 | 1,08 |
| Falátfúrás, válaszfal | db | 0,06 | **0,15** | 0,23 | 0,32 |
| Falátfúrás, felmenő 38 cm | db | — | **0,20** | 0,31 | 0,43 |
| Födémáttörés | db | — | 0,45 | — | **0,91** |
| Aljzat- / padlómarás | m | — | 0,60 | — | **1,80** |

**Arányforrás.** Vésésre `1,00 : 2,17 : 4,83` (tégla : vegyes : vasbeton) az árlistád vezetékezés-sorainak különbségeiből, függetlenül megerősítve a Dunaharaszti pótmunka 5,0×-es betonmarás/téglahorony arányával. Fészekvésésre és fúrásra `1,00 : 1,54 : 2,15` az árlista dugaljsoraiból — laposabb, ami logikus: a fészek kis felület, a horony hosszú.

**Ellenőrzés.** Vasbeton horony 1,64 h/m; 6 000 Ft/órás önköltséggel 9 840 Ft/m. A Dunaharaszti pótmunka padlómarása 7 500 Ft/fm volt — ugyanaz a nagyságrend, alatta, ami reális, mert az egy 3 méteres tétel volt kedvezőbb hozzáféréssel.

---

## 3. Az öt megmaradt faktorcsalád

```
K_tétel = (1 + ΣK2) · (1 + ΣK3) · (1 + ΣK4) · (1 + ΣK5) · (1 + ΣK6)
          felső korlát: 2,2
```

Családon belül összeadás, családok között szorzás. A sapka azért 2,2, mert a K1 kikerülésével a legnagyobb legitim halmozódás is ez alá esik; ami fölé menne, az a határszabály szerint primitív.

### K2 — Hozzáférés

| Tag | `f` | Bizonyíték |
|---|--:|---|
| Munkamagasság 2,6–3,5 m (létra) | 0,15 | ⚑ becslés |
| Bútorozott, be nem üríthető tér | 0,20 | ⚑ becslés |
| Szűk / kényszertesthelyzet (aknában, szekrény mögött, padlástérben) | 0,25 | Acsády padlástéri kábelvezetés |
| Lift nélküli épület 2. emelet fölött | 0,10 | Áron árlista: +5% a végösszegre |
| Nehéz anyagmozgatás, távoli parkolás | 0,10 | Áron árlista: +10% |
| **Család maximuma** | **0,80** | |

3,5 m fölött nem faktor: állványos munka, lásd 5. pont.

### K3 — Környezet

| Tag | `f` | Bizonyíték |
|---|--:|---|
| IP44 kivitel | 0,15 | **Árlista-adat**: fedeles dugalj / sima dugalj munkadíj = 1,10–1,23 |
| IP55 és fölötte (tömszelence, tömítés) | 0,30 | ⚑ extrapoláció |
| Kültéri munkavégzés | 0,20 | Áron árlista: +10% |
| Nedves tér, zónabesorolt (fürdő, medence) | 0,15 | 2605: „fürdőszoba, plusz EPH" külön tétel |
| Poros, hideg vagy zajos környezet | 0,10 | ⚑ becslés |
| **Család maximuma** | **0,60** | |

Ez az egyetlen család, aminek van közvetlen, számszerű árlista-bizonyítéka.

### K4 — Rendszerillesztés

| Tag | `f` | Bizonyíték |
|---|--:|---|
| Meglévő, üzemelő hálózaton dolgozunk | 0,20 | Varler-korpusz: 13-ból 12 munka ilyen |
| Meglévő védőcsőbe húzás (kényszerpálya) | 0,45 | ⚑ becslés — **a legfontosabb mérendő** |
| Dokumentálatlan hálózat, jelöletlen körök | 0,25 | Etele: „idegen áramkörök beazonosítása" |
| Alumínium–réz átmenet szakszerű kezelése | 0,30 | Áron minden ajánlatában záradék; WAGO alu-paszta tétel |
| Nem szabványos meglévő kialakítás (TN-C) | 0,25 | Etele: TN-C-S szétválasztás |
| **Család maximuma** | **1,00** | |

**Fontos elhatárolás.** A *felderítés* nem tartozik ide — az `óra`-alapú önálló tétel (hibakeresés, nyomozás, dokumentálás). A K4 csak azt fedi, hogy a **szerelés maga** lassabb, mert meglévőbe illeszkedik. Az Etele-ajánlatban ezt már most helyesen kezelitek: külön 140 000 Ft-os sor a felderítésre, nem szorzó.

### K5 — Precizitás és esztétika

| Tag | `f` | Bizonyíték |
|---|--:|---|
| Látszó, esztétikailag értékelt szerelés | 0,20 | ⚑ becslés |
| Szimmetria- / vonalzottság-igény (sorolt szerelvények) | 0,15 | ⚑ becslés |
| Kész burkolatba, sérülésveszéllyel | 0,30 | Dunaharaszti pótmunka: helyreállítással |
| Egyedi, bútorba rejtett kialakítás | 0,25 | **LED pótmunka: „komplikált (XX), +25%"** |
| **Család maximuma** | **0,70** | |

A 0,25-ös érték nem becslés: a saját LED-pótmunka dokumentumotokban szó szerint ez a szorzó szerepel, kézzel alkalmazva.

### K6 — Üzemi korlát

| Tag | `f` | Bizonyíték |
|---|--:|---|
| Lakott ingatlan, a megrendelő ott él | 0,20 | Áron villa vs. lakás összevetés |
| Működő üzlet / szálloda, vendégforgalom mellett | 0,35 | K+K Hotel Opera |
| Szűk időablak, napi ki-be pakolás | 0,25 | ⚑ becslés |
| Szakaszolt áramtalanítás (hűtő, szerver életben) | 0,20 | ⚑ becslés — a 2. ág vakfoltja |
| Éjszakai vagy hétvégi munkavégzés | 0,40 | ⚑ becslés |
| **Család maximuma** | **0,90** | |

---

## 4. Illeszkedési mátrix

Melyik család melyik primitívosztályra hat. Ahol nincs jel, ott a faktor **nem alkalmazandó** — ez akadályozza meg, hogy egy projektszintű körülmény minden soron újra felszorozzon.

| Primitívosztály | K2 | K3 | K4 | K5 | K6 |
|---|:--:|:--:|:--:|:--:|:--:|
| **A** Szerkezetbontás (vésés, fúrás, marás) | ● | ○ | ○ | ● | ● |
| **B** Hordozó fektetés (cső, csatorna, tálca) | ● | ● | ● | ● | ● |
| **C** Vezetékmunka (behúzás, fektetés, kötés) | ● | ○ | ● | ○ | ● |
| **D** Végpont (szerelvény, doboz, lámpatest) | ● | ● | ● | ● | ● |
| **E** Elosztó és DIN modul | ○ | ● | ● | ○ | ● |
| **F** Diagnosztika, mérés (`óra`) | ○ | ○ | ○ | ○ | ● |
| **G** Logisztika (sitt, takarás, mozgatás) | ● | ○ | ○ | ○ | ● |

● hat · ○ nem hat

**Az `F` osztály szinte üres, és ez szándékos.** Az órában mért munka esetén a nehézség már az órákban benne van — ha lassabban megy a hibakeresés, akkor több órát írsz, nem szorzót. Kizárólag a K6 marad, mert az az időablakot korlátozza, nem a tempót.

---

## 5. Primitívvé léptetett tényezők

Ezek a határszabály szerint kikerültek a faktorok közül. Saját normaórájuk van, és **külön soron jelennek meg az ajánlatban** — ami egyben ügyfélkommunikációs előny: látható, miért drágább.

| Új primitív | Egység | `h` | Miért nem faktor |
|---|---|--:|---|
| Állványépítés és -bontás (3,5 m fölött) | alkalom | 1,5 | önálló idő, nem lassulás |
| Meglévő hálózat felderítése, körazonosítás | óra | — | külön munka a szerelés előtt |
| Hibakeresés, nyomozás | óra | — | nincs mennyisége |
| Szakaszolt áramtalanítás megszervezése | alkalom | 0,75 | egyszeri, nem tételarányos |
| Ideiglenes ellátás kiépítése és bontása | klt→db | 3,0 | önálló szerelés |

---

## 6. Mennyit magyaráz meg a könyvtár?

Ez a legfontosabb ellenőrzés, és **részleges eredményt hoz** — érdemes előre tudni, mielőtt a 8. ág visszamér.

Áron horonyvésés-tétele a villán 1 500 Ft/m, a budapesti lakásokon 5 000–5 500 Ft/m. Megfigyelt arány: **3,67×**. A modell ugyanarra a primitívre ugyanazt a normaórát adja (0,34 h/m, mindkettő tégla), tehát a különbséget a faktoroknak és a projektrétegnek kell magyaráznia:

| | Villa | Lakás |
|---|--:|--:|
| Volumenfaktor `V` | 0,85 | 1,05 |
| Nehézség `N` | 1,00 | 1,20 |
| K6 (lakott + szakaszolás) | 1,00 | 1,40 |
| K2 (bútorozott + lift) | 1,00 | 1,30 |
| **Szorzat** | **0,85** | **2,29** |

Modell szerinti arány: **2,70×**. Megfigyelt: **3,67×**.

Logaritmikusan a modell a szórás **76%-át** magyarázza meg. A maradék 1,36× háromféle lehet, és ezt a 8. ágnak kell eldöntenie:

1. **Hiányzó faktor** — valami, amit a hat család nem fog meg (pl. a helyreállítási igény különbsége).
2. **Áron kisprojekt-árrése** — nem költség, hanem árazási döntés. Ha ez, akkor nem a modellbe való, hanem az árszint-paraméterbe.
3. **A `V` és `N` alulparaméterezése** — a `B = 0,10` kitevő túl lapos.

**A 76% önmagában elfogadható eredmény.** Egy hat-tényezős, kézzel kalibrált modell háromnegyedét megfogja egy olyan szórásnak, amit korábban egyetlen 3,5-ös számnak láttunk. A fennmaradó rész pedig most már nevesített hipotézis, nem homály.

---

## 7. Bizonyítéki állapot

| Család | Adatvezérelt tagok | Becsült tagok | Erő |
|---|--:|--:|:--:|
| Szerkezet (primitív) | 3 forrásból megerősítve | — | ●●● |
| K3 Környezet | 3 / 5 | 2 | ●●○ |
| K4 Rendszerillesztés | 4 / 5 | 1 | ●●○ |
| K5 Precizitás | 2 / 4 | 2 | ●●○ |
| K6 Üzemi korlát | 2 / 5 | 3 | ●○○ |
| K2 Hozzáférés | 2 / 5 | 3 | ●○○ |

**A K2 és K6 a leggyengébb**, és a K6 a legnagyobb hatású — ez a kombináció teszi a K6-ot az egész modell legfontosabb mérendő paraméterévé. A visszamérési naplóban ezért minden munkánál rögzítendő a lakottság, az időablak és a hozzáférés, még akkor is, ha semmi más nem kerül be.

---

## 8. Mit visz tovább

Az 5. ág (piackutatás) számára három konkrét kérdés, amire a versenytársak árlistáiban kell választ keresni:

1. Mások milyen arányt alkalmaznak vasbeton és tégla vésés között? (a mi 4,83-unk két forrásból jön, de mindkettő házon belüli)
2. Van-e nyilvános ár a meglévő csőbe történő újrahúzásra? (K4 legfontosabb becsült tagja)
3. Hogyan árazzák a lakott ingatlanban végzett munkát? (K6, a leggyengébb bizonyítékú család)
