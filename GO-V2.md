# GO V2 — CLA második verzió: v1 teljes kiépítés + minden további réteg előkészítése (gyorsított felmérés)

Másold be ezt egy új Claude Code munkamenetbe. Munkakönyvtár: `H:\Dev-VRG\VRG-DE\wt-planner-stack`.

Ez a fájl **önmagában teljes**: a korábbi munkamenetek memóriájára ne számíts. Más felhasználói fiókon is működnie kell, ezért minden útvonal `H:\` alatti.

---

## A felhasználó kérése, szó szerint (2026-10-12)

> Utána pedig egy ASAP feladat: mivel hamarosan küldeni kell legalább egy sablonos felmérést, egy gyrsított verzióban mérjük fel a második verziót, az alábbi munkamenetek alapján. Ez a verzió nem a teljesen kiépített rendszert fogja mutatni, hanem az egyes verziónak a teljes kiépítését, valamint a többi rétegnek az előkészítését (minden süllyesztett útvonal és kötődoboz fektetése, ehhez megfelelő méretű süllyesztett terek biztonságos méretezése (nagyjából), RBX és Portálok útvonalainak elkészítése és megfelelő mennyiságú és típusú kábelekkel való behúzása (magyarán csak a csövezés és a kábelbehúzás és a dobozhely kialakítások későbbre - de nem tartalmazza még a hardware telepítését, a későbbi informatikai munkát - viszont ez az a jövőbiztosan és magas végső igényekig, modulárisan és lépésekben feltölthető és felépíthető rendszernek az architectuális alapja, ha minden réteggel egyszerre van megtervezve.
>
> Terveim szerint azért tudunk erre arányosan kedvezőbb összárakat adni, mert ugyan a süllyesztett elemek méterben és darabszámban arányosan növelik az anyagárat, sok méterszám (cső és kábel) továbbra is egyszerre és egy helyre kerül telepítésre, amihez arányosan nagyobb és szélesebb útvonalakat kell kiépíteni - nem pedig teljesen új szakaszokat alakít ki. Erre kérlek végeztess majd a másik sessionben egy kalkulációt, ami fair árakat fogalmaz meg ennek függvényében.
>
> A marketing üzenet: ezzel lesz lehetőség az alábbi dolgokra: (itt felsorolva a legdivatosabb és modern okosotthon lehetőségeket a piacon, kiélezve az ESPHome rendszerek potenciáljára - szobánként, címszavakban felsorolva) - nem csak egy normál villamosfelújítás, hanem a potenciál kialakkításra bármire, amit a jövőben szeretnének
>
> Részletes számítások nélkül, felmérés pontossággal írd össze, így kb hány méter cső és milyen típusú vezetékek kellenek, mi változik főbb pontokban az első verzióhoz képest - számítsd ki az anyagárat (méter, darab) és a velejáró munkadíjat és ez alapján - valamint összevetve az első verzió számításaival - adj összefoglalást, miben különbözik (kiépítettségében és áraiban) a második verzió az előzőhöz képest
>
> elkészült első verzió: VG-2026-CLA-01

## Hol tartunk

**v1 alapréteg** (az erősáramú motor), kész és fagyasztva: `Calculator/CLA-baseline/v1_2026-10-12/`. Olvasd el a `VERSION.md`-t.
- Benne: a forrás-vázlat, a `motor/` (a motor másolata a `cla.config.js` döntéseivel) és a `kimenet/` (minden kimenet).
- A számok:
  - erősáram: 16 kör, 111 végpont, földszint 55,81 m²;
  - süllyesztett gégecső falhoronyban;
  - Adat/PoE: Cat6A 118 m, 11 port;
  - 5 LED-betápdoboz;
  - P1 bejárati redőny: csak előkészített útvonal.

**v1 dokumentumok, VG-2026-CLA-01**, a Varler Workflow Kittel, kész és kiszállítva: `H:\Dev-VRG\VRG-DE\CLA_ajanlat\`. A munkamappa: `H:\Dev-VRG\VRG-DE\CLA_koltsegvetesi_tervezet\job\`.
- Munkadíj **2 585 000 Ft** (P40); anyag **1 130 000 Ft** (1 017 000 – 1 243 000); fizetendő **≈ 3 715 000 Ft**.
- 284 emberóra, kb. 18–21 munkanap, 46 318 Ft/m².
- Minden v1-tétel, egységár és norma: `job\offer.json`. A menet: `job\WORKLOG_CLA.md`.

**Nyitva:** ADATRETEG-Q-002 (N01–N05) kis tervezési kérdései. A v1 a javasolt válaszokkal készült; a v2-t nem akasztják meg.

## Mi a v2

A v2 a **v1 teljes kiépítése** (változatlanul), és mellé **minden további BRIDGE-réteg előkészítése**:

- **Benne van:**
  - minden süllyesztett útvonal: horony, gégecső, átvezetés;
  - a kötő- és szerelvénydobozok;
  - nagyjából, biztonságosan méretezett süllyesztett terek: RBX-fülkék, BASE, portál-fészkek és -oszlopok;
  - RBX ↔ BASE, RBX → portál és RBX → végpont útvonalak, **behúzott kábelekkel**: megfelelő mennyiség és típus rétegenként.
- **Nincs benne:** a hardver telepítése (RBX-elektronika, szenzorok, panelek, hangszórók, kamerák, AP-k, LED-szalag) és a későbbi informatikai munka.
- **Az üzenet:** ez az architektúra-alap, amire a rendszer lépésenként, modulárisan, a legmagasabb végső igényekig felépíthető, mert minden réteg egyszerre van megtervezve.

**Az árazás elve (a felhasználóé):** a süllyesztett elemek méterben és darabban arányosan növelik az anyagot. De a csövek és kábelek nagy része **ugyanoda, ugyanabba a horonyba** kerül: a meglévő útvonal szélesebb lesz, nem épül új szakasz. Ezért a munkadíj arányosan kedvezőbb. A fair árak részletes kalkulációja a **Workflow Kit munkamenet** dolga (B fázis).

## Fázisok — a felhasználó szabálya: a nagy kérést bontsd fázisokra, és közben kérdezz

### A fázis — ebben a munkamenetben, gyorsan, felmérési pontossággal

1. **Olvasd el:**
   - `Calculator/CLA-baseline/v1_2026-10-12/VERSION.md`;
   - `Planner/projects/varler-planner/tools/baseline/README.md`;
   - `…/kimenet/MENNYISEGEK.md`;
   - `H:\Dev-VRG\VRG-DE\CLA_koltsegvetesi_tervezet\job\WORKLOG_CLA.md` (vége) és `job\offer.json` (a v1 egységárai, normái, csoportjai).
2. **A rétegek és a kábeltípusok forrása:**
   - `H:\Dev-VRG\VRG-DE\Planner_VRG_U100\BRIDGE\05_standards\BRIDGE-STD-001-A2_Layer-Wiring-Reference.md` (rétegenkénti kábelezés);
   - `BRIDGE-STD-001_Physical-Standardisation.md` (RB-S 300×400×90, RB-M 400×500×110, RB-L 500×600×110, RB-H 600×600×120);
   - `01_architecture\BRIDGE-ARCH-002_Alapozo-Architektura-Terv_HU.md`;
   - `08_builds\CLA-BUILD-001_Topology-and-Composition.md`;
   - `BRIDGE-OUTLINE-001_General-Outline.md` §4 (CLA).
   
   A vázlat rétegei és végpontjai a forrás vplan-ban vannak: `sys:CONTROL`, `sys:BUSB`, `sys:LV`, `sys:SENSOR`, `sys:HMI`, `sys:MEDIA`, `sys:USB`, `sys:SECURITY`, `sys:DATA`. Ilyen végpontok: POR, NTL, PAN, THR, SEN, SPK, CAM, ACP, ETH, USB, LNR. A motor `prep.js` / `rules.js` a portál-helyeket (H0–H3, T1, T2, L1–L4) már kiosztja.
3. **Gyors mennyiség, motorral.** Az adatréteg mintájára (`data.js`: végpont → legközelebbi RBX, RBX → BASE, sáv, fészek-átvezetés) az összes SELV-rétegre:
   - **csőhossz méretenként és horony:** külön a *közös* horony (a v1-es horony szélesítése) és az *új* horony;
   - **kábel típusonként, méterben:** a típus az STD-001-A2 szerint (pl. busz / RS485, 24 V betáp, hangszóró, Cat6A, érzékelő);
   - **dobozok és fülkék:** RBX-fülkék RB-méret szerint, BASE, portál-fészkek és -oszlopok, végpontdobozok.
   
   Ha a gyors út megbízhatóbb, elég becslés is, rétegenként egy sor a v1-mennyiségekből; csak írd le, mi a feltételezés. **Kérdezz**, ha egy réteg kábeltípusa vagy darabszáma nem egyértelmű.
4. **Anyagár és munkadíj felmérési pontossággal:** méter- és darabárak.
   - Ahol lehet, a v1 `offer.json` egységárai; az új tételeknél forrással, ●○○ jelöléssel.
   - A munkadíj tartalmazza a közös útvonal kedvezményét. Írd le, melyik tételnél mennyit és miért.
5. **Összefoglaló (magyarul):** miben különbözik a v2 a v1-től.
   - kiépítettség: mi kerül bele, mi marad későbbre;
   - mennyiségek: cső m, kábel m típusonként, dobozok;
   - anyag, munkadíj, fizetendő: v1 ↔ v2, eltérés Ft-ban és %-ban.
6. **Marketinglista:** szobánként címszavakban, a CLA helyiségeire (előszoba, konyha-étkező, lépcső, kamra, WC, nappali, szoba, fürdő). A piac legmodernebb okosotthon-lehetőségei, kiélezve az **ESPHome** potenciáljára, pl.:
   - jelenlét: mmWave;
   - ajtókontakt, portál, ToF;
   - jelenetek és cirkadián világítás;
   - redőny- és árnyékolás-automatika;
   - levegőminőség (CO₂);
   - szivárgásérzékelés;
   - multiroom audio;
   - kamera, PoE;
   - energia-monitorozás körönként;
   - helyi vezérlés felhő nélkül (Home Assistant).
   
   Ne legyen állítás, amit a v2 előkészítése nem tesz lehetővé.
7. **Kimenet:** a `Calculator/CLA-baseline/v2_…/` mappa (`V2_FELMERES.md` + a géppel olvasható mennyiségek + lapok, ha vannak). Utána másolat a `H:\Dev-VRG\VRG-DE\CLA_koltsegvetesi_tervezet\00_bemenet_v2\` mappába a Kit munkamenetnek, a `V2_FELADAT.md` mellé.

### B fázis — a Varler Workflow Kit munkamenetben (a felhasználó indítja)

Ezt nem itt kell megcsinálni, csak előkészíteni. A Kit munkamenet a v1-hez hasonlóan:
- fair árakat számol a közös útvonal elve szerint;
- elkészíti a VG-2026-CLA-02-t a marketing-oldallal.

Az indító szöveg: `H:\Dev-VRG\VRG-DE\CLA_koltsegvetesi_tervezet\V2_FELADAT.md`.

## Futtatás

```
node Planner/projects/varler-planner/tools/baseline/run.js "Calculator/CLA-baseline/v1_2026-10-12/CLA_teszt_v1_m_solat.vplan(3).json" Calculator/CLA-baseline
```

- 0 figyelmeztetéssel kell lefutnia.
- A PNG-k a fő checkout hordozható Chrome-jával készülnek (`H:/Dev-VRG/VRG-DE/Planner_VRG_U100/Planner/apps/chrome-headless-shell/`).
- Planner-előnézet: `planner-serve`, port 8131. A Planner itt nyílik: `http://localhost:8131/Planner/projects/varler-planner/dist/varler_planner.html`. Betöltés: `hardResetWorkspace(); applyProjectData(o.project)`.

## A felhasználó tartós szabályai

- **Dokumentumok:**
  - A Költségvetési Tervezet egyoldalú, tájékoztató becslés. Sosem „ajánlat”, és sosem említi, hogy utána Árajánlat jön.
  - Az Árajánlat sosem hivatkozik vissza a Tervezetre.
  - Aláírók: Hefler Tamás, Várkonyi Tamás. Pinkovszki Áron neve nem kerülhet ügyféldokumentumra.
  - Árak „tiszták”: a munkadíj 5 000 Ft-os lépésben, az egységárak kerek lépésekben.
- **Képek:** minden képen, amit küldesz, minden szám olvasható legyen, és semmi ne kerüljön egymásra. Használd a `labels.js`-t, és küldés előtt nézd meg a PNG-t.
- **Nyelv:** a felület szövege magyar, a kód azonosítói angolok.
- **Munkamód:**
  - Ne törölj semmit kérdezés nélkül.
  - A nagy kéréseket bontsd fázisokra, és közben kérdezz.
  - **Commit és push: soha.** Azt a felhasználó csinálja.
  - Tuner-válaszformátum: `ID=kulcs ~ megjegyzés`. A Tuner: `H:\Dev-VRG\VRG-DE\Planner_VRG_U100\BRIDGE\_tuner\bridge-tuner.html`.
- **Ügyféladat:** a CLA ügyféladat. A `BRIDGE/07_CLA`, a `CLA_koltsegvetesi_tervezet` és a `CLA_ajanlat` nem kerül gitbe, és nem hagyhatja el a gépet. Az `É03 Földszinti alaprajz.pdf` másik projekt (Érd), ne használd.

**Kezdd** azzal, hogy elolvasod a fentieket, és 6–8 sorban visszaigazolod:
- a v1 számait;
- a v2 hatókörét;
- a rétegek listáját a kábeltípusokkal, ahogy a STD-001-A2-ből érted.

Utána tedd fel, ami nem egyértelmű (legfeljebb 5 kérdés), és kezdd az A fázist.
