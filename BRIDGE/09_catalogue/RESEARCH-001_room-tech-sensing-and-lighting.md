# RESEARCH-001 — Szobánkénti technológia, érzékelés és világítás

**Kör:** 2026-10-11 · F1 kutatás + F2 adatbázis · **Státusz:** r1, véleményezésre
**Adat:** [`SMARTHOME-DB-001.json`](SMARTHOME-DB-001.json) · **Nézet:** [`smarthome-db.html`](smarthome-db.html) (offline, szűrhető)
**Forrás:** `src/*.js` → `node BRIDGE/09_catalogue/tools/build.js` (minden hivatkozást ellenőriz)

Ez a dokumentum a kutatás *következtetéseit* rögzíti. A tételes adat az adatbázisban van. A következő körre vár:
- **F3:** BRIDGE szabványszöveg.
- **F4:** CLA jelölések a v1 és v2 tervbe.
- **F5:** Planner kód.

A ⚑ jelölésű számok másodlagos forrásból származnak. Mielőtt BRIDGE szabály lesz belőlük, a szabványszöveggel vagy az eszköz kézikönyvével ellenőrizni kell őket.

---

## 1. Mi van az adatbázisban

| Szakasz | Db | Mire jó |
|---|---|---|
| Érzékelők (egyedi szenzorig bontva) | 67 | Mindegyiknél: mit mér, példa-alkatrész, zóna és magasság, táp, elemes alkalmasság, jó és kerülendő szobák, multiszenzor-társak, **multinode alkalmasság**, **miért jó**, **miért (mikor, hol) nem jó**, Planner-réteg és kód |
| Gázok | 15 | Sűrűség a levegőhöz, **vertikális hely**, magasság (mm), forrás, elhelyezés, norma |
| Multiszenzorok | 12 | A piac szokásos csomagjai |
| **Portál flotta-modulok** | 4 | FLT-H / FLT-A / FLT-N / FLT-L, Alap és Prémium tagokkal (§7) |
| Kapcsolók | 23 | Ebből 8 rejtett, plusz kinetikus, elemes és redőnykapcsoló |
| Világítás | 27 | Fő, kiegészítő, hangulat, mozgásvonal és értesítő fény; ESPHome-platformmal |
| A busz felhasználások | 21 | Ideális pontokkal és magassággal |
| Hangulatfény tipikus pontjai | 21 | Pont vagy szakasz, zónával |
| Mozgásvonal-módszerek | 9 | SQ1…SQ7, szabályok és dobozosztás (§5) |
| Vezérlés (a volt HMI réteg) | 10 interfész, 4 funkció | Foglaltságjelző, mozgásvonal, egészség, redőny |
| Helyiségek | 19 | Ma elérhető technológia, előkészítendő jövő, fény, egészség, érzékelők, A busz, kapcsolók |
| Tuya kategóriák | 140 | Magyar név, csoport, szobák, zóna, táp, viszony a BRIDGE-hez, réteg, elem |
| Elemes / ULP eszközök | 21 | Rádió, elemtípus, élettartam |

A nézetben a **helyiség-szűrő** minden fülön működik: kiválasztod a WC-t, és csak a WC-re érvényes tételek maradnak.

## 2. Tuya: hány eszköztípust különböztet meg?

- **A Tuya hivatalos listája: 103 kategória.** Forrás: Developer Platform, *Standard Instruction Set*. Az oldal 11 termékcsoportot nevez meg: világítás, villamos szerelvények, nagy és kis háztartási gépek, konyhai gépek, átjárók, érzékelők, sport és egészség, energia, szórakoztatás, kültér és utazás.
  - A kategóriák csoportba sorolását a Tuya **nem adja meg**. Az adatbázisban a táblázat sorrendjéből következtettem ki ⚑.
- **A Home Assistant 2026.10.0 140 kódot ismer:**
  - a 103 hivatalos kategóriát,
  - 3 olyat, amely máshol dokumentált (kültéri eszköz, átjáró, vezeték nélküli kapcsoló),
  - **34 terepi kódot.** Ezek valós eszközökön jelennek meg, de a hivatalos listában nincsenek. Ilyen például a formaldehid- és VOC-érzékelő, a termosztatikus radiátorszelep, a futófény-szalag és a ventilátoros fali kapcsoló.
- Mind a 140 bekerült. Mindegyik kapott egy viszonyt a BRIDGE-hez:

  | Viszony | Db | Jelentés |
  |---|---|---|
  | **BRIDGE saját** | 32 | A BRIDGE-nek van egyenértékű végpontja (pl. PIR, nyitásérzékelő, szivárgás, CO) |
  | **Integrálható** | 65 | Harmadik fél eszköze, HA-n át |
  | **Készülék** | 25 | Csak a táp és a hely számít |
  | **Nem releváns** | 18 | Például tejadagoló, ugrókötél |

- A BRIDGE-saját tételek a `ref` mezőn keresztül a katalógus saját szenzorára vagy kapcsolójára mutatnak.

## 3. Érzékelők: a lényeg a táblázatok mögött

- **Jelenlét három rétegben.**
  - A PIR gyors indítást ad, de **soha nem jelent ürességet** (STD-003).
  - A 24 GHz-es radar tartja a jelenlétet.
  - A portál ToF-párja adja az irányt és a számlálást.
  - A 60 GHz-es radar a légzést és az esést figyeli.
  - A fürdőben a hőkamera-tömb az elsődleges (D14).
- **Multinode: mely típusok működnek jól több példányban?**

  | Alkalmasság | Mely érzékelők | Miért |
  |---|---|---|
  | **Ajánlott** | PIR, hőmérséklet, páratartalom, légnyomás, lux, CO₂, VOC, PM, CO, füst, szivárgás, BLE-vevő, UWB | Passzívak vagy gradienst mérnek. Ha több szobában vannak, a forrást és az irányt is megmutatják. |
  | **Óvatosan** | Radarok (24 / 60 GHz), ToF, Doppler | Kölcsönösen zavarhatják egymást. Egymástól elfordítva, átfedés nélkül, ToF-nál időosztással kell őket szerelni ⚑. |
  | **Nem** | Ultrahang | Egymás visszhangját hallják. Ráadásul a 40 kHz-et a kutya és a macska is hallja, ezért lakótérbe nem való. |

- **Elemes jelölés.** Minden érzékelő kapott `batt` jelölést: *elemes is jó* / *csak ritkított méréssel* / *nem*.
  - A fűtött gázérzékelők (CH₄, PB, H₂) és a radarok nem elemesek.
  - A CO-cella, a füst- és a nyitásérzékelő évekig megy elemről.
- **Kizárt elv.** Az MQ-7 (MOX CO) szerepel, de *kizártként*. Életvédelemre csak az elektrokémiai cella vagy minősített riasztó jó.

## 4. Egészségügyi szenzor minden szobában, a gáz természete szerinti magasságban

**Szabály (javaslat):**
- Minden lakott helyiségbe kerül legalább egy egészségügyi szenzor.
- **A konyhában és a fürdőben megerősített csomag** van.
- A magasságot a gáz sűrűsége dönti el.

| Hely | Gázok | Magasság |
|---|---|---|
| **Mennyezet** (könnyebb a levegőnél) | földgáz / metán, ammónia, hidrogén; füst és hő | ≤ 300 mm-re a mennyezettől ⚑ EN 50244 |
| **Légzési zóna** (keveredik) | CO, CO₂, NO₂, formaldehid, TVOC, PM, ózon | 900–1500; CO fejmagasságban 1500–1800, sarokból ≥ 20 cm (OKF) |
| **Padló** (nehezebb a levegőnél) | PB-gáz, hűtőközeg (R32 / R290), H₂S, radon | PB és hűtőközeg 100–300; H₂S 300–600; radon ≥ 500 a legalsó szinten |

**Helyiségenként:**
- **Konyha:** hő-érzékelő (füst helyett), CO, VOC/NOx, PM.
  - Metán csak gázkészüléknél, PB-gáz csak palacknál kell.
  - CLA-ban **indukciós a főzőlap** (K20), így a gázérzékelés csak gázkazán vagy gázos vízmelegítő esetén kell. Lásd D-06.
- **Fürdő / WC:** páratartalom, H₂S (lent, az összefolyónál) és NH₃ (fent).
  - CO csak gázos vízmelegítőnél kell.
- **CLA nappali:** **klíma** van a déli falon, ezért hűtőközeg-érzékelő kell lent, a beltéri egység alatt. A radon a földszint miatt kerül a listába.
- **CO jogi háttér Magyarországon** (2012. évi XC. tv. és 12/2014. BM rendelet):
  - kötelező nyitott égésterű készüléknél, meghatározott épülettípusokban;
  - **lakásban ajánlott, nem általánosan kötelező** ⚑ (a hatályosságot ellenőrizni kell);
  - a kéményseprő az éves vizsgálaton ellenőrzi.
- **Életvédelmi riasztó.** Ahol életvédelem a cél, ott a minősített, önálló, 10 éves riasztó az alap (EN 14604 füst, EN 50291 CO). A BRIDGE szenzor ezt kiegészíti, nem váltja ki.

## 5. Mozgásvonal: szekvenciális LED irányérzékeléssel

**A felállás:** folytonos alu profil 300 mm magasan, a belső falak mentén. Benne a szalag 500–1000 mm-es szakaszokra bontva. A haladás irányában egy szakasz előre világít, kettő mögötte marad, és a szomszédos szakaszok PWM keresztáttűnéssel váltanak (s³ görbe, STD-002).

**Irány és pozíció érzékelése, a legjobbtól a legolcsóbbig:**
1. **LD2450 a vonal végén:** x/y pozíció és irány egy eszközből.
2. **LD2410 a folyosó végén:** egydimenziós vonalon a mozgó cél távolsága maga a pozíció. Olcsóbb.
3. **ToF-pár a portálon (FLT-H):** megmondja, honnan indul a hullám.
4. **PIR-pár a két végen:** a legolcsóbb megoldás.

**Kilenc kivitel az adatbázisban.** Ezek a lényegesek:

| | Mi | Erek | Dobozok | Megjegyzés |
|---|---|---|---|---|
| **SQ2** | Elosztott ESP32-C3 négycsatornás csomópontok | 24 V + szinkron | 4 szakaszonként (750 mm-nél kb. 3 m) | **Ajánlott alap:** rövid kábel, flotta-firmware, ≥ 3 kHz |
| **SQ5a** | *A te ötleted:* olcsó kétcsatornás CCT vezérlő, WW = k. szakasz, CW = k+1. | **3 ér két szakaszra** | 2 szakaszonként | A „színhőmérséklet” csúszka maga az áttűnés, állandó összfénnyel. A legolcsóbb kész hardver. A párok közti átadás koordinációt kér. |
| SQ3 | Címezhető egyszínű 24 V szalag | 3 a teljes vonalon | csak a végeken | A legsimább mozgás. A WS2811 PWM-je gyakran < 3 kHz ⚑, az adatvonal pedig sérülékeny. |
| SQ1 | Központi PWM az RBX-ben | N + 1 | csak a végeken | Sok ér a profil mentén |
| SQ5b | Valódi CCT szalag | — | — | Csak *színirányt* ad (előtte hideg, mögötte meleg). Térben nem bontható, mert a két csatornája egymásba fésült. |
| SQ7 | PCA9685 | — | — | **Kizárva:** kb. 1,5 kHz, sérti a ≥ 3 kHz szabályt |

Az SQ2 és az SQ5a valójában ugyanaz a gondolat. Egy négycsatornás saját ESPHome-csomópont két CCT-párnak felel meg. A kész Zigbee-s CCT vezérlő akkor jó, ha nem kell saját firmware. Lásd D-03.

**Mikor kell új rejtett süllyesztett doboz:**
- **B1:** minden falszakasz elején és végén, sarkon és portálnál, mert a profil a nyílásnál megszakad.
- **B2:** a módszer csatornaszáma szerint (SQ2: 4 szakaszonként, SQ5a: 2-ként).
- **B3:** **ahol a 300 mm-es vonal Silver vagy Gold Rail alá esik.** Itt a doboz a zsanéroldali felszállóból függőlegesen kapja a tápot, ezért ezek a legolcsóbb pontok.
- **B4:** betáp legfeljebb 5 m-enként (feszültségesés).
- A szakaszhossz egész számú vágási egység legyen (24 V-on jellemzően 50 / 100 mm ⚑).

**CLA előzetes nyomvonal** (pontosan a v1/v2 geometriájából lesz kirajzolva, F4).

A dwelling (tartózkodási) területek:
- konyha + étkező,
- a nappali pihenő része,
- az ágy a szobában.

Az útvonal: R02 konyha → R03 étkező → portál → **R06 nappali** a jobb oldali (R03/R05 felőli) falon fel, majd balra az R06/R07 közfal mentén → leendő ajtónyílás → **R07** a közfal mentén → gardrób → **R08 fürdő**.
- Az R06-ban a vonal **pontosan azon a két falon fut, amelyen az R06 Silver Railje** (a két portál közti L, IDEA-003 §7). Az RBX06 ugyanezen a közfalon van, így a B3 dobozok itt a sínből kapják a tápot.
- Durva becslés: R06 kb. 7 m vonal, kb. 9 szakasz 750 mm-rel, kb. 4 doboz (SQ2) ⚑.
- A **menekülési minimum** nem ez a vonal, hanem a B buszos lábfény (L_footlight).

## 6. Az A busz: mire jó és hova

**Az A busz kényelmi célú.** Szabad sötétbe kerülnie a vezérlővel együtt. Ami áramszünetben is kell, vagy menekülésre szolgál, az a B buszra kerül.

Általános felhasználások (21 tétel az adatbázisban):
- rejtett mennyezeti fény a ZW-o sávban, a Silver Rail mellett, ezért a tápja „ingyen” jön;
- pult-, lábazati, sziget-, polc-, médiafal-, tükör-, fülke- és szekrényfény;
- ágytámla és ágy alatti derengés;
- mozgásvonal;
- USB-C PD töltő;
- 24 V DC függönymotor, motoros vízelzáró, EC elszívó, elektromos zárfogadó;
- kültéri 24 V fény, növényfény.

**CLA, a bútorozott alaprajz alapján:**

| Helyiség | A busz pontok |
|---|---|
| **R02 konyha** | Felső szekrénysor alja a felső falon (a tervrajzon „LED fények”, kb. 1450). Lábazat a konyhasor alatt. **A sziget alja és túlnyúlása** (a pultba épített oldal az étkező felé). USB-C a szigeten. Motoros vízelzáró a strangzónánál, az R02/R08 falon (K34/1). |
| **R03 étkező** | Mozgásvonal a belső falakon. Képvilágító. Az étkezőasztal fölötti függőlámpa a nappali sarkában van (tervrajz), opcióként 24 V-on, hangolható fehérrel. |
| **R06 nappali** | Médiafal háttérfény az R06/R07 közfalon (K33). Rejtett fény ugyanezen a falon, a sínsávban. **Ablakkáva-fény a két soros redőnyhöz** (bal fal, STD-009). DC függönymotor. Mozgásvonal (§5). |
| **R07 szoba** | Ágytámla-spotok a két éjjeli lámpa helyén (felső fal, a tervrajz szerint kapcsolóval). Ugyanezekből a dobozokból ágy alatti derengés. **Gardróbbelső** a ferde gardróbfal mentén, nyitásra. A kis TV-egység háttérfénye az R07 oldalon. |
| **R08 fürdő** | Tükörfény és párátlanító a mosdónál („konnektor + tükör lámpa”, „→ LED”). Fürdőbútor-lábazat. EC elszívó. |
| **R04 WC** | Tükör. EC elszívó (szag / pára). B buszos lábfény. |
| **R01 előszoba** | Beépített szekrény belső fénye, lábazat, tükör. |
| **R05 kamra** | Nyitásra induló polcfény. |
| **Felső szint** | R09 ágytámla. R10 tükör. R12 terasz: 24 V IP67 korlát- és padlófény. |

## 7. Portál flotta-modulok (érzékelő réteg, „egységes modultípus-jelöltek”)

Ugyanaz a modul épül be minden portálnál. Egy firmware, egy ház, egy alkatrész-tartalék.

| Modul | Hely | Tagok (Prémium) | Szerep |
|---|---|---|---|
| **FLT-H** fej ★ | szemöldök fölött 2150 | ToF-pár, függöny-PIR, lux, nyitásérzékelő | Irány, számlálás, áthaladás: a portálgráf éle |
| **FLT-A** levegő ★ | zsanéroldali felszálló, szoba felőli oldal, 1400 | CO₂, VOC/NOx, hőmérséklet, páratartalom (+ CO) | **Így minden szobába jut egészségügyi szenzor új vezeték nélkül.** A nyitásérzékelő kapuzza: nyitott ajtónál és utána kb. 2 percig a CO₂ nem érvényes. |
| **FLT-N** értesítő | értesítő fény mellett, 1150 | kapacitív közelség, gyorsulásmérő, piezo | Foglaltságjelző és kopogás (§9) |
| **FLT-L** láb | felszálló alja, 300 | PIR, lux | Lábfény-indítás, háziállat szétválasztása |

★ = elsődleges egységes típus. **Fenntartás az FLT-A-hoz:** az ajtó közelében a levegő keveredik. Ha a szobának van ≥ 1 m-re eső belső fala, ott pontosabb a mérés. Lásd D-04.

## 8. Szobánkénti világítás (BRIDGE / ESPHome-preferált)

Mind a 19 helyiség kap fő / kiegészítő / hangulat opciókat (nézet: *Szobák* fül). A meghajtás mindig ESPHome:
- `monochromatic` + `ledc` (≥ 3 kHz),
- `cwww` / `color_temperature` (2700 + 4000 K),
- `rgbww`,
- `esp32_rmt_led_strip`,
- a 230 V-os fényt a BRIDGE-DN bistabil relé kapcsolja (kézi elsőbbség).

**Új trend:** a 48 V-os mágneses sín. Saját tápegységet kér ⚑, a 24 V-os busz nem viszi.

## 9. Értesítő fény mint foglaltságjelző (WC, fürdő)

**Mi adja az állapotot:** bent a világítást vezérlő jelenlétérzékelő (WC: mmWave, fürdő: hőkamera-tömb).

**Hogyan látszik kívül:**
- **Közeledés:** kapacitív vagy rövid ToF érzékelő a tokon. Foglaltnál piros ⚑, szabadnál semmi vagy egy rövid zöld.
- **Kopogás az ajtón vagy a tokon:** gyorsulásmérő vagy piezo. Három villanás: zöld = szabad, piros ⚑ = foglalt. Bent az értesítő fény jelzi, hogy valaki vár.

**Adatvédelem:** a foglaltság csak közeledésre vagy kopogásra jelenik meg, nem világít folyamatosan a lakás felé.

**Ütközés:** az STD-008 a pirosat hibának és riasztásnak tartja fenn. Lásd D-01.

## 10. Az SSC csomópont helye

**Biztonsági iparági gyakorlat:**
- A központi egység **rejtve, a védett téren belül** legyen, **ne a bejárat mellett** (a betörő ne érje el és ne verje szét a belépési késleltetés alatt).
- **Érzékelő lássa.**
- **Kapcsolatlan, állandó táp** kell neki (nem kapcsolt dugalj, nem FI-védett kör).
- A szirénát a lakótérben hallani kell.
- A kezelő (keypad) a bejáratnál van, a központ máshol.

**CLA ajánlás: R05 kamra** (lépcső alatt), a felső hátsó sarokban, zárható takaró mögött.
- A lakás közepén van, a bejárattól nem látszik.
- Az R03 hub-radar és a kamraajtó nyitásérzékelője lefedi.
- Mellette van a felszálló (rövid út a felső szintre és minden szobába, csillag topológia `from:'ssc'`).
- Az RBX03 hub és az ISP-belépés közel esik.

**Feltétel:** a K27 biztosított akkucsomag is ebben a kamrában van. Ezért az SSC **saját házban, a szemközti falon** legyen, saját tartalékakkuval. Egy kamratűz így se tegye egyszerre némává a riasztót és sötétté a menekülő fényt. A szabotázs- és tápkimaradás-jelzés távfelügyeletre menjen.

**Alternatíva: R07 gardrób.** Klasszikus „hálószobai szekrény” hely, a legmesszebb a bejárattól. Hátránya: hosszabb kábelutak, és az RBX06 is ott van. Lásd D-02.

**Kerülendő:** R01 beépített szekrény (bejárat), az Elosztószekrény, a fürdő és a konyha.

## 11. Javítások, amiket ez a kör rögzít

- **A redőny nem dedikált kör.**
  - A fali fel / le kapcsoló tartalék kézi útnak megmarad, akkor is, ha nem használják.
  - A vezérlés a legközelebbi RBX-en megy át.
  - Az adatbázisban: `sw_shutter` (javasolt `SWI/shu`) és a `F_shutter_fallback` funkció.
  - A Planner `EP_CAT`-ban a SHU már `from:'rbx'`.
  - **A te CLA_teszt_v1 terved** 4 SHU-t és 5 DED-et tartalmaz. Az F5-ben ellenőrzöm, hogy a SHU-k nem dedikált áramkörön vannak-e.
- **A világítási string áramkör** nem kell, hogy minden RBX-et érintsen. Szükség esetén megosztható a szobák dugaljköreivel.
- **HMI → Vezérlés.**
  - A panel, a termosztát és az új interfészek (jelenetpanel, forgatógomb, e-papír, hangszatellit, kaputelefon) a `sys:CONTROL` rétegre kerülnek.
  - A HMI szerep megszűnik. A régi fájlok elemei betöltéskor átköltöznek (F5).

## 12. Döntések, amik tőled kellenek

| # | Kérdés | Javaslat |
|---|---|---|
| **D-01** | Foglaltságjelző színe: (a) foglalt = borostyán / magenta, a piros marad riasztásnak; (b) WC / fürdő ajtón kivétel, piros / zöld | **(b)**, mert egyetemesen érthető, és csak közeledésre / kopogásra látszik. Az STD-008 kap egy kivétel-bekezdést. |
| **D-02** | SSC: R05 kamra vagy R07 gardrób | **R05**, saját házban, az akkucsomaggal szemközt |
| **D-03** | Mozgásvonal-kivitel: SQ2 (saját négycsatornás ESPHome-csomópont), SQ5a (kész CCT vezérlő párok) vagy SQ3 (címezhető) | **SQ2**, a szakasz alapból 750 mm |
| **D-04** | FLT-A levegőmodul a portálnál (kényelmes) vagy belső falon ≥ 1 m-re (pontos) | Portálnál, ajtóállapot-kapuzással; ahol van szabad belső fal, ott a fal |
| **D-05** | Új kódok / változatok az STD-004-be: `SWI/shu`, `SWI/rf`, `PAN/scene · knob · voice · door`, `DIS/epaper`, `SEN/co · gas` | Felvenni (F3 szabványmódosítás + F5 `EP_CAT`) |
| **D-06** | Van-e CLA-ban gázkészülék (kazán, vízmelegítő)? A K42 padlófűtés nyitott | Ha igen: CO + CH₄ a készülék helyiségében |
| **D-07** | A mozgásvonal az A buszon fut (kényelem), a menekülést a B buszos lábfény viszi | Igen |

## 13. Források

- Tuya Developer Platform — Standard Instruction Set: <https://developer.tuya.com/en/docs/iot/standarddescription?id=K9i5ql6waswzq>
- Home Assistant core 2026.10.0 — `homeassistant/components/tuya/const.py` (Apache-2.0): <https://github.com/home-assistant/core/blob/2026.10.0/homeassistant/components/tuya/const.py>
- 12/2014. (II. 21.) BM rendelet és 2012. évi XC. tv. (CO-érzékelő), Nemzeti Jogszabálytár: <https://njt.hu/>
- Katasztrófavédelem — CO-érzékelő elhelyezési ajánlás: <https://baranya.katasztrofavedelem.hu/application/uploads/documents/2016-07/43146.pdf>
- EN 50244:2016 (BSI összefoglaló): <https://knowledge.bsigroup.com/products/electrical-apparatus-for-the-detection-of-combustible-gases-in-domestic-premises-guide-on-the-selection-installation-use-and-maintenance>
- Gázérzékelő magasság (másodlagos): <https://www.buygasmonitors.com/blog/what-height-should-you-mount-your-gas-detector/>
- Riasztóközpont elhelyezése (másodlagos): <https://ultrasecuredirect.com/blog/?p=796>
- WLED Animated Staircase usermod: <https://mm.kno.wled.ge/usermods/staircase/>
