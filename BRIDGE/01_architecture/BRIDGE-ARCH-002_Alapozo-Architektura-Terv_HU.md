# BRIDGE — Alapozó Architektúra Terv

**Dok.:** BRIDGE-ARCH-002 · r1 · v1.0 tervezet · 2026-09-21 · magyar változat
**Felváltja:** CLA-BRIDGE-ARCH-01 (a CLA falba épített vázlat ennek a tervnek az első *alkalmazása* lesz)
**Szülő / testvér dokumentumok:** BRIDGE-ARCH-001 (egységflotta-alapozó) · BRIDGE-ARCH-A1 (bistabil kapcsolótopológiák) · BRIDGE — Smart Switch (ζ/η családok) · BRIDGE-DN és OmniComm Hub specifikációk (hub hardver, protokollrádiók, tápláncolat, hálózati mag)
**Nyelvi megjegyzés:** az angol eredeti (BRIDGE-ARCH-002) a mérvadó rendszertervezési nyelv. A rétegek, elemek és protokollok nevei (BASE, NET, COMP, MEDIA, CHANNEL, ROOMBOX, ARM, PANEL LINK stb.) szándékosan angolul maradnak, hogy a két változat egy az egyben megfeleltethető legyen.

> **Állapot.** Architektúra-szintű terv: mi létezik, hol helyezkedik el, mi mihez kapcsolódik, és mely szabályokat tilos megszegni. A méretek tervezési burkolóméretek, nem termékhez kötött kivágási méretek. Az erősáramú munkák az MSZ HD 60364, a kábelezési elkülönítés az EN 50174-2, a SELV az IEC 60364-4-41, a behatolásjelző rendszerek az EN 50131 szerint. Az életvédelmi érzékelés (füst EN 14604, CO EN 50291, gáz EN 50194) mindig tanúsított, önálló érzékelőkkel történik — a BRIDGE szenzorai kiegészítők, soha nem az egyetlen védelmi vonal.

---

## Tartalom

1. Cél és tervezési alapelvek
2. A fizikai rendszer áttekintése
3. Belépési csoport: Betáp, Elosztószekrény, internet-belépés, BASE
4. BASE — NET, COMP és MEDIA rétegek
5. Szétválasztott rétegtelepítés és a LAYER TIE
6. PANEL LINK — COMP és Elosztószekrény
7. CHANNEL — a gerinc
8. ROOMBOX — a helyiségcsomópont
9. ARM-ok és VÉGPONTOK
10. Rétegenkénti specifikáció (MAINS · LV · CONTROL · DATA · MEDIA & AUDIO · USB · KNX · RF · SENSOR · CLIMATE · ACCESS & HMI · SECURITY · OUTDOOR)
11. A vezeték nélküli réteg emergens képességei
12. Biztonsági Szolgáltatási Központ és a SECURITY réteg
13. RoomBox funkciójegyzék (teljes)
14. Szabályok összefoglalása
15. Nyitott döntések
A. függelék — Forrásfájl-leltár a H: meghajtós átdolgozási mappához

---

## 1. Cél és tervezési alapelvek

A BRIDGE egy otthonautomatizálási és otthoni hálózati architektúra, amely egyetlen központi koordinátorra és egy ismétlődő, helyiségszintű csomópontra épül. Fizikai formája **az épületbe fektetett, rögzített nyomvonalrendszer**: egy központi BASE, a védőcsövekből álló gerinc (CHANNEL), helyiségenként vagy területenként egy ROOMBOX, és minden végpontig elérő ARM-ok. A hardver az épület élettartama alatt változik; a nyomvonalakat úgy tervezzük, hogy túléljék azt.

**A korábbi BRIDGE munkából átvett alapelvek:**

| Alapelv | Jelentése ebben a tervben |
|---|---|
| **Kézi elsőbbség** | Minden fizikai kezelőszerv működik akkor is, ha a hálózat, a COMP és a CHANNEL kiesik. A vezeték nélküli vezérlés és az automatizálás a kézi útvonal egyenrangú társa, soha nem ura (ζ/η topológiák, a bistabil elem kötelező). |
| **Könnyű koordinátor** | A COMP réteg koordinál és vezérel. Soha nem végez nehéz számítást — a streamelés, átkódolás, tömeges adatátvitel, renderelés és MI-következtetés máshol fut. |
| **Szervezz, ne olvassz be** | Minden új képesség egy csomópont vagy egy modul egy meglévő rétegben, soha nem szétszórt eszközhalmaz. |
| **Opcionalitás** | Nyomvonal mindenhez kiépül; hardver csak akkor, amikor szükséges. Az üres, elérhető pozíció a szabványos átadási állapot. |
| **Táp a felhasználás helyén, jel a központból** | A hálózati táp az Elosztószekrényből jön; a jel és a vezérlés a BASE-ből; a törpefeszültség helyben, minden RoomBoxban készül. |
| **Elkülönítés** | Az erősáram, a SELV, az adat, a média és a biztonsági rendszer mindegyike saját nyomvonalcsaláddal rendelkezik. Csak osztott (válaszfalas) dobozokon belül találkoznak, soha nem közös védőcsőben. |
| **A csatorna túléli a kábelt** | Minden védőcső mérete, nyomvonala és behúzózsinórja olyan, hogy a mai kábel falbontás nélkül cserélhető legyen. |

---

## 2. A fizikai rendszer áttekintése

### 2.1 Elemek

| Elem | Szerep | Elhelyezés |
|---|---|---|
| **Betáp + Elosztószekrény** | Hálózati betáplálás, védelem, áramkörök kiindulópontja | A bejárat közelében (szokásos eset) |
| **Internet-belépés** | Szolgáltatói optika / koax / réz érkezése | A bejárat közelében, ideálisan az Elosztószekrény mellett |
| **BASE** | Központi, falba épített oszlop: NET, COMP, MEDIA rétegek | A belépési csoport mellett vagy közelében |
| **PANEL LINK** | Csak adatot vivő nyomvonal a COMP és az Elosztószekrény mérő-/vezérlőtere között | Rövid szakasz a belépési csoporton belül |
| **LAYER TIE** | A BASE belső kapcsolatait helyettesíti, ha a rétegek külön helyre kerülnek | Csak szétválasztott telepítésnél |
| **CHANNEL** | Gerinc a BASE és minden RoomBox között (csillag vagy lánc) | Belső falak, mennyezeti/padló gerincek |
| **ROOMBOX** | Helyiség/terület alvezérlő, tápátalakító, rádióközpont, kötési pont | Helyiségenként/területenként egy, belső falon |
| **ARM** | Nyomvonal a RoomBoxtól a végpontokig (dedikált vagy busz jellegű) | A helyiségen belül |
| **VÉGPONT** | Bármely eszközpozíció: kapcsoló, dugalj, lámpa, szenzor, panel, AP, kamera, hangszóró… | Fal, mennyezet, tok, padló |
| **Biztonsági Szolgáltatási Központ (SSC)** | Külső vagyonvédelmi szolgáltató központi egységének helye | Beljebb a lakásban, az 1. vagy 2. RoomBox közelében |
| **SECURITY CHANNEL / ARM-ok** | Párhuzamos, a biztonsági szolgáltatónak dedikált nyomvonalréteg | A CHANNEL és az ARM-ok útvonalát követi |

### 2.2 Rendszertopológia

```
               SZOLGÁLTATÓ ──► INTERNET-BELÉPÉS
                                │ (belépő védőcső)
  HÁLÓZAT ──► BETÁP ──► ELOSZTÓSZEKRÉNY ◄═══ PANEL LINK (csak adat) ═══╗
               │ erősáramú áramkörök                                   ║
               │   ├─► BASE (dedikált áramkörök)                       ║
               │   ├─► minden RoomBox (világítás/vezérlés + dugaljak)  ║
               │   ├─► SSC (2 dedikált áramkör)                        ║
               │   └─► nagy fogyasztók (közvetlenül, nem RoomBoxon át) ║
               ▼                                                       ║
        ┌──────────────── BASE ────────────────┐                       ║
        │  NET   : modem/ONT · PoE switch ·    │                       ║
        │          protokoll-mesterek          │                       ║
        │  COMP  : koordinátor · érintőképernyő╪═══════════════════════╝
        │  MEDIA : tároló · médiaszerver ·     │
        │          legacy lejátszók · HID-dokk │
        └──────────────────┬───────────────────┘
                           │  CHANNEL (DATA · CONTROL · MEDIA · TARTALÉK)
             ┌─────────────┼─────────────────────┐
             ▼             ▼                     ▼
        ROOMBOX 1 ──► ROOMBOX 2 ──► …       ROOMBOX n      (közvetlen csillag, vagy lánc "megállókkal")
          │ ARM-ok        │ ARM-ok               │ ARM-ok
          ▼               ▼                      ▼
      VÉGPONTOK       VÉGPONTOK              VÉGPONTOK

  SSC (az 1./2. RoomBox közelében) ══ SECURITY CHANNEL (a CHANNEL-lel párhuzamos) ══► biztonsági pont minden RoomBox mellett
                                                                                      └─► csillag a biztonsági végpontokhoz
```

### 2.3 Rétegek

Minden nyomvonal pontosan egy réteghez tartozik. A rétegek párhuzamosan futnak ugyanazon az architektúrán (Elosztó/BASE → CHANNEL → RoomBox → ARM → végpont), de soha nem osztoznak védőcsövön.

| Réteg | Mit visz | Kiindulás | Színkód (rajzokon) |
|---|---|---|---|
| **MAINS** | 230 VAC áramkörök | Elosztószekrény | borostyán |
| **LV** | SELV 24 / 12 / 5 VDC | RoomBox (helyben előállítva) | acélkék |
| **CONTROL** | BRIDGE_LINK vezetékes vezérlés (RS-485 jellegű) | COMP | bíbor |
| **DATA** | Ethernet / PoE | NET | kékeszöld |
| **MEDIA & AUDIO** | HDMI-osztályú videó, vonal-/hangszórószintű hang | MEDIA | ibolya |
| **USB** | USB-hosszabbítási pontok | RoomBox | világos kékeszöld |
| **KNX** (opcionális) | KNX TP busz | KNX tápegység az Elosztóban / BASE-ben | zöld |
| **SENSOR** | szenzorbusz és táp a szenzorpontokhoz | RoomBox | sárga |
| **RF** | nem nyomvonal — lefedettségi terv, amelyet a DATA/LV szolgál ki | RoomBox csomópontok | szaggatott |
| **SECURITY** | külső szolgáltatói riasztóhuzalozás | SSC | piros |

---

## 3. Belépési csoport: Betáp, Elosztószekrény, internet-belépés, BASE

Az alapfeltevés, hogy a hálózati betáplálás (Betáp) és az internetkapcsolat is a bejárat közelében érkezik, és a BASE mindkettőhöz közel helyezkedik el. Ez a három pont alkotja a **belépési csoportot**.

**Szabályok**

- Az internet-belépés saját belépő védőcsövön jut a **NET rétegig** (legalább M25, koax + optika esetén M32). Ha a csoport nem tartható egyben, a belépő cső oda fut, ahová a NET kerül — a külső kapcsolat mindig a NET-et éri el elsőként a BRIDGE elemei közül.
- Az Elosztószekrény **dedikált áramkörökkel** táplálja a BASE-t (ajánlott: egy a NET + COMP, egy a MEDIA számára; saját kismegszakító, 30 mA-es ÁVK, 2. típusú túlfeszültség-levezető a szekrényben, 3. típusú a BASE-nél).
- Az Elosztószekrény és a COMP között két külön útvonal van: **hálózati táp** (MAINS nyomvonalcsalád) és **PANEL LINK** (csak adat, 6. fejezet). Soha nem osztoznak védőcsövön.
- A nagy fogyasztók (sütő, főzőlap, mosogatógép, mosógép, vízmelegítő, EV-töltő) **közvetlenül az Elosztószekrényből** kapnak tápot, nem RoomBoxon keresztül. Megfigyelésük a PANEL LINK mérésen, vezérlésük saját interfészükön vagy a szekrényben elhelyezett tanúsított kontaktoron keresztül történik — a nagy áramok kimaradnak a RoomBoxokból.

---

## 4. BASE — NET, COMP és MEDIA rétegek

A BASE egy függőleges, falba épített oszlop. Egy egységként telepítve: **felül a NET, szemmagasságban a COMP, alul a MEDIA.**

### 4.1 Egyegységes burkolóméret (referencia)

| Tétel | Érték |
|---|---|
| Külső fülke (Sz × M × M) | 800 × 2100 × 220 mm (padlószint +0,50 → +2,60 m) |
| Terek | 560 mm eszköztér · 100 mm fémmel leválasztott tápgerinc · 60 mm légkémény |
| Rétegmagasságok | kábelfej 2,30–2,60 · NET 1,85–2,30 · COMP 1,25–1,85 (képernyőközép +1,55) · MEDIA 0,65–1,25 · beszívó lábazat 0,50–0,65 |
| Falszerkezet | előtétfal vagy ≥ 25 cm-es vésett falazat |
| Hőtechnika | 70–110 W belső veszteség → szűrt lábazati beszívás, PWM-es elszívás a fejben, terelőlemezek a rétegek között |
| Földelés | egyetlen csillagpont-csavar a PE-hez, minden rétegketrec külön bekötve |

### 4.2 NET — kommunikációs réteg

| Funkció | Hardverosztály |
|---|---|
| Internet-végződtetés | Szolgáltatói ONT / DOCSIS modem rekesz (szolgáltatói dobozra méretezve) vagy SFP ONT modul |
| Hálózati mag | Menedzselt PoE switch, **16 portos ajánlott** (a 8 portos csak kb. 5 helyiséget fed le), SFP uplink, VLAN-ok: Trusted / IoT+Audio / Cameras / Guest, PoE-keret ≥ 15–25 W RoomBoxonként |
| Protokoll-mesterek | Protokollonként egy dedikált koordinátor: Zigbee (elsődleges + tartalék), Thread border router ×2, Z-Wave 800, dedikált BLE, EnOcean 868, **LoRa / Meshtastic (csak BASE-protokoll)**, Wi-Fi HaLow (nagy hatótávú kültéri), sub-GHz SDR vétel, KNX IP interfész, DALI-2 átjáró (ha van) |
| Tartalék WAN | 4G/5G LTE + GNSS (időforrás) |
| Rendezőmező | Cat6A keystone-ok, RoomBoxonként egy felcímkézett port + tartalékok |
| Antennák | SMA átvezetők egy nem fém fejrácshoz |

**Kulcsszabály:** a protokoll-mesterek **hálózatra csatlakoznak** (Ethernet/PoE koordinátorok, ser2net), nem USB-n a COMP-hoz. Így a NET ↔ COMP kapcsolat tisztán Ethernet marad, ami lehetővé teszi a szétválasztott telepítést az architektúra megváltoztatása nélkül (5. fejezet).

### 4.3 COMP — a koordinátor

A COMP réteg futtatja a Home Assistantot és a vezérlési réteget. **Szándékosan nem teherhordó.**

| Funkció | Hardverosztály |
|---|---|
| Koordinátor | Raspberry Pi 5 osztály (Pi 5 8 GB NVMe-vel, vagy CM5 kétportos Ethernet hordozón) |
| Tároló | NVMe 128–250 GB, csak a HA és az előzményei számára |
| HMI | Nagy, fixen bekötött érintőképernyő (legalább 10,1", nagyobb ajánlott) szemmagasságban — teljes rendszerhozzáférés |
| Terminál opció | Vékony USB-HID billentyűzet kihúzható tálcán vagy fixen a képernyő alatt (teljes terminál érzet) |
| CONTROL mester | Többcsatornás, galvanikusan leválasztott RS-485 interfész — RoomBoxonként egy csatorna (+ tartalékok) |
| PANEL LINK mester | Modbus RTU / Ethernet az Elosztó mérőteréhez |
| Szervizpanel | Előlapi USB 2.0 + 3.x portok, soros konzol, állapot-LED-ek, fizikai gombok |
| Táp | 12 V-os UPS lánc (falba építve LiFePO4 ajánlott), az OmniComm-ból átvett négyforrású redundancia |

**A COMP-on fut:** Home Assistant, MQTT, Zigbee2MQTT / Z-Wave JS / Matter szerver, ESPHome felület, Node-RED, OpenWRT/tűzfal (ha átjáró), AdGuard.
**Soha nem a COMP-on:** média-átkódolás, médiakönyvtár-kiszolgálás, kamerarögzítés, tömeges mentések, helyi LLM, renderelés. Ezek a MEDIA-ra (teljes csomag) vagy egy dedikált számítási csomópontra kerülnek.

### 4.4 MEDIA — adat- és médiaréteg

Két definiált csomag:

| | **Alapcsomag** | **Teljes csomag** |
|---|---|---|
| Cél | Közös otthoni tároló minden felhasználó személyes fájljainak és fogyasztói médiájának | Az alapcsomag mindene + dedikált otthoni szerver, amely minden adatfolyamot kiszolgál |
| Tároló | 0,5–1 TB SSD (NAS-jellegű megosztás) | SSD rendszer + HDD/SSD rekeszek a könyvtár méretéhez, NVR tároló a kamerákhoz |
| Streamelés | Csak közvetlen fájlelérés és közvetlen lejátszás; **nincs átkódolás** | 4K streamelés és átkódolás (hardveres videómotor), több helyiség egyidejűleg |
| Szolgáltatások | SMB/NFS megosztás, mentési cél | Médiaszerver, Music Assistant + Snapcast szerver, NVR, mentés, opcionális helyi MI |
| Számítás | Alacsony fogyasztású tárolóvezérlő | Mini otthoni szerver osztály (alacsony fogyasztású x86 hardveres videómotorral, vagy azzal egyenértékű) |
| Videó a helyiségekbe | A helyiségek saját lejátszóin keresztül | HDMI-elosztás (osztó vagy mátrix) minden RoomBoxhoz |

**Mindkét csomagban közös:**

- **Felhasználói portok** a MEDIA előlapján (USB, SD, HDMI be, TOSLINK, RCA/3,5 mm). Ha a réteg nem kényelmes magasságban van, vagy külön helyre került, a portpanel **néhány méterrel kihosszabbítható** a rétegtől, vagy egy RoomBoxnál is kivezethető.
- **Legacy lejátszó rekesz** (opcionális): vékony Blu-ray/DVD meghajtó, régi hangbemenetek, hely egy régi lejátszónak.
- **Médiavezérlő sáv** és **kézi vezérlő dokkoló** (töltőbölcső +1,00–1,15 m magasságban).

---

## 5. Szétválasztott rétegtelepítés és a LAYER TIE

A három réteg telepíthető **egy egységként**, vagy **külön egységként, a ház különböző pontjain**. A logikai architektúrának mindkét esetben azonosnak kell lennie.

**Szabály:** ha a rétegek szét vannak választva, egy dedikált **LAYER TIE** nyomvonal az egyegységes kiépítés minden belső, rétegek közötti kapcsolatát egy az egyben reprodukálja. Semmit nem tervezünk újra; csak a kapcsolat hossza változik.

**Következmény minden tervre:** minden réteghatárt átlépő kapcsolatnak **távolságtűrőnek** kell lennie. USB és HDMI egy rétegen *belül* használható, rétegek *között* soha.

| Határ | Egyegységes kapcsolat | LAYER TIE megfelelő |
|---|---|---|
| NET ↔ COMP | 2× Cat6A patch (LAN + WAN, ha a COMP az átjáró) | 2× Cat6A + 1× tartalék Cat6A |
| NET ↔ MEDIA | 1–2× Cat6A patch (teljes csomagnál 10 GbE-képes) | 2× Cat6A vagy 1× optika (OM4/OS2) |
| COMP ↔ MEDIA | Ethernet (vezérlés) + RS-485 (legacy lejátszó vezérlése/IR/CEC) | 1× Cat6A + 1× Cat6A S/FTP vezérlő |
| Minden réteg | Közös UPS DC-elosztás | Minden leválasztott réteg saját 230 V-os áramkört és saját UPS-t kap |
| Tartalék | — | határonként 1× üres M32 behúzózsinórral |

**Ajánlott összekötő védőcső:** határonként 2× M32 (egy használt, egy tartalék). Egyegységes telepítésnél ugyanezek a kapcsolatok rövid belső patchként léteznek — egy réteg későbbi áthelyezése a patchek összekötő kábelkötegre cserélését jelenti.

---

## 6. PANEL LINK — COMP és Elosztószekrény

Egy **csak adatot vivő** nyomvonal a COMP és az Elosztószekrény között hálózati szintű megfigyelést és vezérlést ad a BRIDGE-nek. Akkor is kiépül, ha az első napon semmilyen mérőhardver nincs beépítve.

### 6.1 A hely kialakításának két módja

| Változat | Leírás | Minimális térfogat |
|---|---|---|
| **A · Szabad DIN-sor** | Az Elosztószekrényen belül egy teljes DIN-sor szabadon marad a BRIDGE eszközeinek | 1 DIN-sor (jellemzően 12–18 modul) |
| **B · Mérőgaléria** | Külön doboz közvetlenül a szekrény felett vagy alatt, amelyen **minden kimenő áramkör (a gerinc) áthalad**, miután elhagyta a szekrényt | Legalább 1 DIN-sor belső térfogata; ajánlott 2 sor |

**A B változat az előnyösebb**, mert fizikai hozzáférést ad minden áramkörhöz a védelmi eszközök *után*, és a szervizhurkok elég hosszúak ahhoz, hogy később bontható áramváltókat lehessen felhelyezni a szekrény saját huzalozásának érintése nélkül.

### 6.2 Mit fogad be ez a tér (fokozatosan)

- Egész lakásos 3 fázisú / 1 fázisú fogyasztásmérő (Modbus DIN mérő osztály)
- Áramkörönkénti árammérés **bontható áramváltókkal** (kialakításukból adódóan galvanikusan leválasztott)
- Feszültség-, frekvencia- és hálózatminőség-figyelés
- Távvezérelhető védelem: motoros kismegszakító/áramvédős kismegszakító hajtások, automatikus visszakapcsolású ÁVK-k (csak tanúsított eszközök)
- Túlfeszültség-levezető állapotérintkezők, gyűjtősín/szekrény hőmérséklet-érzékelők
- Egy Modbus / ESPHome átjárócsomópont, amely mindezt a COMP-hoz köti

**Szabályok:** a PANEL LINK oldalhoz csak galvanikusan leválasztott mérés csatlakozhat (áramváltók, tanúsított DIN mérők). Az adatvédőcső (M25, Cat6A S/FTP + tartalék) soha nem osztozik nyomvonalon a szekrény erősáramú csöveivel.

---

## 7. CHANNEL — a gerinc

### 7.1 Topológia

- A BASE **mindig** közvetlenül éri el az első (általában fő) RoomBoxot.
- Minden további RoomBoxot vagy **közvetlenül a BASE-ből (csillag)**, vagy **egy korábbi RoomBoxon mint megállón keresztül (lánc)** érünk el, amíg minden helyiség és terület lefedett nem lesz.
- Egy RoomBoxon túl minden — minden végpont — **csak abból a RoomBoxból** érhető el.

**Fizikai lánc kontra logikai lánc.** Egy CHANNEL *fizikailag* áthaladhat egy RoomBoxon (annak átmenő rekeszében, érintetlenül), miközben *logikailag* közvetlen vonal marad. Ez az előnyös megoldás: fizikai lánc, logikai csillag.

| Réteg | Logikai lánc megengedett? | Megjegyzés |
|---|---|---|
| DATA | Igen | A RoomBox switch uplinkjén keresztül (VLAN trunk). Plusz hibapontot jelent és megosztja az uplink sávszélességét — nagy helyiségeknél közvetlen vonal ajánlott. |
| CONTROL | Igen, természetesen | Az RS-485 többpontos busz; minden RoomBox egy leágazás. Áganként egy csatorna, legfeljebb kb. 32 egységterhelés, 120 Ω mindkét végen. |
| MEDIA | Csak közvetlen vonal | A HDMI nem láncolható tisztán (ismétlő/HDCP korlátok). Átmenő kábelként halad át a RoomBoxon, vagy HDMI-over-IP a DATA rétegen. |
| MAINS | Csak átmenő | Egy későbbi helyiség áramkörei áthaladhatnak egy RoomBox átmenő terén, de ott nem ágaznak le. Minden helyiség saját áramköröket kap az Elosztóból. |
| SECURITY | Külön réteg | Saját védőcsövekben követi a CHANNEL útvonalát (12. fejezet). |

### 7.2 Nyomvonal-preferenciák

- **Először a belső falak.** A CHANNEL szakaszok a belső falakat (mindkét oldalon ugyanaz a lakás) részesítik előnyben, és kerülik a külső/határoló falakat, valamint a szomszéddal közös falakat — hőhíd és hőszigetelés, páralecsapódási kockázat, akusztikai elválasztás és a közös falakra vonatkozó korlátok miatt.
- **L-minta helyiségenként** (lásd 8.2): a RoomBox belső falon, egy sarok közelében helyezkedik el, ARM-jai lefedik ezt a falat és a szomszédos falat — ideálisan egy, a következő helyiséggel közös falat, ahol a következő RoomBox folytatja a mintát.
- A közös fal két oldalán lévő RoomBoxok **eltolva, soha nem hátat hátnak** kerülnek ugyanabba a mezőbe (hangátvitel, tűzszakasz-elválasztás, szerkezeti vésési korlátok).
- A gerincek mennyezeti vagy padlórétegben futnak; folyosókon a DATA/CONTROL/MEDIA gerinc és a MAINS gerinc ellentétes oldalon.

### 7.3 CHANNEL köteg RoomBoxonként

| Csatorna | Védőcső | Kábel az első napon | Jövő |
|---|---|---|---|
| **C1 · DATA** | M25 | 2× Cat6A U/FTP (PoE uplink + tartalék) | optika, második PoE-betáp |
| **C2 · MEDIA** | M40 | 1× HDMI 2.1 AOC + 1× Cat6A (HDBaseT / HDMI-over-IP) | új videószabvány |
| **C3 · CONTROL** | M20 | 1× Cat6A S/FTP (BRIDGE_LINK) | CAN / második RS-485 |
| **C4 · TARTALÉK** | M25 | üres + behúzózsinór | koax, optika, hang |
| **C5 · KNX** (ha van) | M20 | KNX TP kábel | — |
| **Átmenő** (lánc) | továbbvezetett helyiségenként | átmenő kötegek | — |

A helyiség MAINS ellátása: áramkörcsoportonként M25, az Elosztószekrényből saját nyomvonalon.

**BRIDGE_LINK érpár-kiosztás (Cat6A S/FTP):** 1. pár RS-485 A/B · 2. pár RS-485 #2 vagy CAN · 3. pár életjel / reteszelés · 4. pár referenciaföld + tartalék. A BRIDGE_LINK-en nincs tápellátás; az árnyékolás csak a BASE oldalon földelt.

### 7.4 Védőcső-szabályok

Két behúzási pont között legfeljebb két 90°-os ív, kb. 15 méterenként behúzódoboz; hajlítási sugár ≥ a kábel külső átmérőjének 8-szorosa (Cat6A ≈ 65–75 mm); kitöltés az első napon ≤ 40 %; behúzózsinór minden csőben, a foglaltakban is; mindkét vég felcímkézve `<projekt>-R<helyiség>-C<n>` formában; fotódokumentáció a lezárás előtt.

---

## 8. ROOMBOX — a helyiségcsomópont

### 8.1 Meghatározás

A RoomBox **a helyiség egyetlen fizikai központja**. A helyiség minden nyomvonala itt kezdődik vagy végződik, így minden végpont fizikailag elérhető belőle. Egyszerre:

- a helyiség **kötési pontja** minden réteg számára (erősáram, LV, adat, média, vezérlés, KNX, szenzor),
- egy **átkonfigurálható kapcsolási pont**, ahol bármely áramkör logikája falbontás nélkül átköthető,
- a helyiség **tápátalakítója** 230 VAC-ról SELV-re,
- a helyiség **vezetékes alvezérlője** (ESP32 osztály, opcionálisan Pi osztály), a COMP alá rendelve,
- a helyiség **vezeték nélküli központja** minden helyiség-hatótávú protokoll számára,
- a helyiség **elsődleges szenzorpozíciója**,
- **átmenő pont** a további helyiségekhez láncolt CHANNEL szakaszok számára.

### 8.2 Elhelyezés — az L-minta

```
   külső fal ──────────────────────────────────────┐
   │                                               │
   │                                               │ külső fal
   │                                               │
   │   3. sarok ◄──────── ARM B ─────────┐         │
   │                                     │         │
   │                                     │         │
   └──────────────  belső fal (közös a következő helyiséggel) ─────
                                         │
                2. sarok ◄─ ARM A ─ [ROOMBOX] ── 1. sarok
                                     belső fal (folyosó felőli)
                                         ║
                                     CHANNEL
```

A RoomBox belső falon, az 1. sarok közelében ül; az ARM A lefedi ezt a falat, az ARM B a szomszédos belső falat — együtt **két falat és három sarkot**. A három sarokpozíció egyben a többcsomópontos rádiós helymeghatározáshoz szükséges geometriát is adja (11. fejezet). Szerelési magasság: alsó éle ≥ +1,90 m, a helyiség bejáratának közelében, mindig hozzáférhetően (a kötéseknek elérhetőnek kell maradniuk).

### 8.3 Belső zónák

| Zóna | Tartalom | Elkülönítés |
|---|---|---|
| **Z1 MAINS** | beérkező helyiségáramkörök, 230 V-os sorkapcsok (WAGO 221 tartókon), bistabil relék lámpákhoz és dugaljakhoz, dimmerek, redőnymotor-relék (reteszelt fel/le), 230 → 24 V tápegység | IP2X, megerősített válaszfal minden más zóna felé |
| **Z2 LV & CONTROL** | 24 → 12 V állítható és 24 → 5 V átalakítók, biztosított SELV ágak, ágankénti árammérők, ESP32 osztályú alvezérlő, leválasztott RS-485, I/O bővítők, SELV sorkapcsok (WAGO 243 / 2601 / 2059) | csak SELV |
| **Z3 DATA / MEDIA / USB** | PoE-ről táplált helyiségswitch, keystone-ok, HDMI-osztó/hosszabbító, hangerősítő rekesz, USB-hosszabbító egységek | csak SELV/adat |
| **Z4 RF** | ESP32-C6 (Wi-Fi/BLE/802.15.4), S3+H2 Thread border router pár, Zigbee router, sub-GHz adó-vevők, 2,4 GHz-es HID átjáró, IR | műanyag RF-ablak mögött, antennák fémtől távol |
| **Z5 SENSOR** | helyiség-környezeti és jelenlét-szenzorok, hőtechnikailag leválasztva a tápegységtől | szellőzött, a doboz alján |
| **ZI BELSŐ** | dobozhőmérséklet és páratartalom, tápegység-hőmérséklet, ajtó-/szabotázskapcsoló, vízbehatolás-érzékelő | belül, minden zónában |
| **ZT ÁTMENŐ** | átmenő kábelek és szervizhurkok a további RoomBoxok számára | érintetlen, felcímkézett |
| **KNX** (opcionális) | KNX vonal belépése és elágaztató sorkapcsai, opcionális kompakt KNX aktorok | SELV oldal |

### 8.4 Méretosztályok

| Osztály | Belső szabad méret (Sz × M × M) | Felhasználás |
|---|---|---|
| **RB-S** | 300 × 400 × 90 mm | fürdő, WC, kamra, előszoba |
| **RB-M** | 400 × 500 × 110 mm | hálószoba, dolgozószoba, konyha |
| **RB-L** | 500 × 600 × 110 mm | nappali, médiaszoba, nyitott tér |
| **RB-H** (központi) | 600 × 600 × 120 mm | 1. RoomBox vagy bármely láncpont, amely 2+ helyiség átmenő kábeleit viszi |
| **RB-O** (kültéri) | 400 × 500 × 150 mm, IP65 | kert, terasz, garázs, öntözés |

Minden RoomBox mellett külön **biztonsági pont** van (12. fejezet); ez nem a RoomBox rekesze.

### 8.5 Táp a RoomBoxon belül

- 230 VAC → **24 VDC** fő SELV sín (biztonsági leválasztású tápegység, jellemzően 60 W, RB-L/RB-H esetén 100–150 W)
- 24 → **12 VDC állítható** sín a helyi terhelésekhez
- 24 → **5 VDC** sín a RoomBox saját elektronikájához
- **PoE** a NET-ből mint független tápútvonal a vezérlő és az RF számára (opcionális kis LiFePO4 vagy szuperkondenzátoros puffer, hogy a vezérlő és a szenzorok áthidalják a hálózati kimaradást)
- Minden, a dobozt elhagyó SELV ág egyedileg biztosított és árammérővel figyelt

---

## 9. ARM-ok és VÉGPONTOK

### 9.1 ARM-típusok

| Típus | Alak | Felhasználás |
|---|---|---|
| **Dedikált ARM** | egy nyomvonal, egy végpont (csillag) | minden lámpa, Ethernet pontok, kamerák, érintőpanelek, hangszórók, biztonsági eszközök, termosztát |
| **Busz ARM** | egy vastagabb nyomvonal a helyiség körül, amely több kötődobozt fűz fel | dugaljcsoportok, KNX vonal, szenzorbusz, LV világítószalagok helyi leágazásokkal |

**Szabály:** minden lámpa saját dedikált ARM-ot kap a RoomBoxig, így mindegyik egyenként kapcsolható és átrendelhető. A busz ARM-ok csak RoomBoxban záródnak — soha nem hurkolódnak vissza az Elosztóhoz.

### 9.2 Univerzális végpont-pozíció (UEP)

Ahol a funkció még nem eldöntött, **univerzális végpontot** kell kiépíteni: mély süllyesztett doboz, benne erősáramú érpár (ha szükséges), SELV érpár, jelérpár és egy üres tartalék védőcső vissza a RoomBoxig. Bármely modul később falbontás nélkül beépíthető.

### 9.3 Végpontkatalógus

| Végpont | Elérő rétegek | ARM | Tipikus pozíció |
|---|---|---|---|
| Fali kapcsoló (ζ/η okoskapcsoló) | MAINS vagy LV + CONTROL | dedikált | ajtó mellett, +1,05 m |
| Dugaljcsoport | MAINS | busz | +0,30 m / munkalap felett +1,10 m |
| Lámpa (hálózati) | MAINS | dedikált | mennyezet / fal |
| LV hangulat-/ambient világítás | LV | dedikált vagy busz | párkányok, szegélyek, bútorok |
| Redőny-/zsalumotor | MAINS vagy LV (24 V-os motor) | dedikált | ablak felett |
| Dedikált hálózati eszköz (helyiség léptékű) | MAINS | dedikált | igény szerint |
| Ajtó- és ablaktok pont | LV + SENSOR | dedikált | tok felső része, minden ajtónál és ablaknál |
| Érintős vezérlőpanel | DATA (PoE) + LV tartalék | dedikált | ajtó mellett / ajtó felőli oldalon |
| Termosztát pont | DATA/LV + CONTROL | dedikált | belső fal, +1,50 m, hőforrásoktól távol |
| Fűtési aktor / osztó-gyűjtő kapcsolat | LV vagy MAINS + CONTROL | dedikált | osztó-gyűjtő / radiátor |
| Szenzorpont (környezet/jelenlét) | SENSOR (LV + busz) | busz vagy dedikált | mennyezet közepe, sarkok |
| Biztonsági szenzorpont (füst, CO, gáz, szivárgás) | SENSOR + LV | dedikált | mennyezet; szivárgásnál padlószint |
| Kamera | DATA (PoE) + LV tartalék | dedikált | sarkok, bejáratok |
| Wi-Fi hozzáférési pont | DATA (PoE) | dedikált | mennyezet közepe |
| Rádiócsomópont (BLE/UWB horgony) | LV vagy PoE | dedikált | 1–3. sarok |
| Médiafal (TV) | MEDIA + DATA + MAINS | dedikált | TV helye |
| Hangszórópozíciók | AUDIO | dedikált | mennyezet/fal, elrendezés szerint |
| USB pont | USB (hosszabbítón át) + LV | dedikált | íróasztal, ágy mellett, médiafal |
| Íróasztal / munkaállomás | DATA + USB + MAINS | dedikált | íróasztal melletti fal |
| Biztonsági eszköz | SECURITY | dedikált (csillag) | a szolgáltató terve szerint |

---

## 10. Rétegenkénti specifikáció

### 10.1 MAINS

- A helyiség áramkörei (világítás/vezérlés, dugaljak, dedikált eszközök) az Elosztószekrényből érkeznek a Z1-be.
- Lámpák: a Z1-ben lévő relék kapcsolják, amelyek tekercseit SELV hajtja — **a relépaneleknek megerősített tekercs–érintkező szigeteléssel kell rendelkezniük (≥ 8 mm-es kúszóút osztály)**.
- A bistabil elem (bistabil relé) a RoomBoxban van; a fali kapcsoló huzalozása a ζ (peer) vagy η (gate) topológiát követi.
- Redőnyök: reteszelt fel/le relék; a nagy fogyasztók elkerülik a RoomBoxot (3. fejezet).

### 10.2 LV (SELV)

- 24 V hosszú szakaszokra (LED-szalagok, motorok, szenzorok), 12 V állítható a helyi terhelésekhez, 5 V csak belső használatra.
- A vezetőket ≤ 3–5 % feszültségesésre kell méretezni; minden ágat biztosítani és figyelni kell.
- LV hangulatvilágítás: állandó feszültségű 24 V-os szalagok PWM-meghajtókkal a Z2-ben vagy a végpontnál.
- A hálózati lámpák LV-tekercses reléi erről a sínről kapnak tápot.

### 10.3 CONTROL (BRIDGE_LINK)

- A COMP minden RoomBox alvezérlővel leválasztott RS-485-ön kommunikál (ESPHome vagy Modbus RTU), az Ethernet hálózattól függetlenül.
- Az alvezérlő figyel minden relét és bemenetet, helyi automatizmusokat futtat, és megtartja az utolsó állapotot, ha a COMP vagy a kapcsolat kiesik.
- Pi osztályú alvezérlő opcionális azoknál a RoomBoxoknál, amelyek helyi számítást igényelnek (nagy helyiségek, médiaszobák).

### 10.4 DATA

- PoE uplink a NET-ből a RoomBox switchhez; a switch látja el a mennyezeti AP(-ka)t, az érintőpaneleket, a kamerákat, és láncolásnál a következő RoomBoxot.
- A helyiség Ethernet pontjai dedikált ARM-okon a Z3-ból (TV-fal, íróasztal, ágy melletti pont szükség szerint).

### 10.5 MEDIA & AUDIO — a helyiség- és egész lakásos hangrendszer alapjai

- **Videó:** HDMI 2.1 AOC közvetlen vonal a MEDIA-tól a RoomBoxig, majd onnan a TV-falig; mellette Cat6A HDBaseT-hez vagy HDMI-over-IP-hez.
- **Hang — javasolt alapok:**
  - **Erősítőrekesz a RoomBoxban** (Z3): ESP32 Snapcast kliens Class-D erősítővel (ESPHome-mal építve, nyitva tartva a Sendspin irányt), amelyet a hálózaton keresztül a MEDIA Snapcast szervere táplál — szinkronizált többhelyiséges hang.
  - **Hangszóró ARM-ok:** dedikált 2 × 1,5–2,5 mm²-es hangszórókábel a RoomBoxtól minden hangszórópozícióig. Pozíciók helyiségosztályonként: sztereó pár (hálószoba/dolgozószoba), 5.1 vagy 5.1.2 készlet (nappali/médiaszoba, mennyezeti pozíciókkal és egy mélysugárzó ponttal).
  - **TV hangvisszavezetés:** TOSLINK vagy HDMI eARC útvonal a TV-faltól vissza a RoomBoxig, hogy a TV hangja a helyiség rendszerén szóljon.
  - **Vonalszintű tartalék:** egy Cat6A a médiafalhoz, amely szimmetrikus vonali hanghoz vagy további hálózati ponthoz használható.
  - Opcionális **mikrofon- / hangasszisztens-szatellit pont** a szenzorzónában vagy a mennyezeten a helyi hangvezérléshez.

### 10.6 USB

- A passzív USB rövid hatótávú (USB 2.0 ≈ 5 m, USB 3.x ≈ 2–3 m), ezért az USB pontokat **USB-over-Cat6A hosszabbítók** (USB 2.0, kb. 100 m-ig) vagy USB-over-IP szolgálja ki a Z3-ból; nagyobb távolságú USB 3.x-hez aktív optikai kábel kell.
- A Type-C **táp**aljzatokat a RoomBox LV sínje táplálja (USB-PD modulok a végponton).

### 10.7 KNX (opcionális)

- A KNX vonal a KNX tápegységtől (Elosztó vagy BASE) belép a RoomBoxba, és onnan busz ARM-okként ágazik a KNX eszközökhöz.
- Topológia: vonal, fa vagy csillag — **soha nem gyűrű**. Vonalhossz ≤ 1000 m, ≤ 700 m a tápegység és bármely eszköz között, szegmensenként ≤ 64 eszköz.
- Kompakt KNX aktorok az Elosztó helyett a RoomBoxban is elhelyezhetők.

### 10.8 RF — helyiségszintű vezeték nélküli lefedettség

| Funkció | RoomBox hardverosztály | Megjegyzés |
|---|---|---|
| Wi-Fi (2,4 + 5 GHz, kettős lefedettség) | 1–2 **PoE-s mennyezeti AP** a RoomBox switchről táplálva, vezetékes gerincű mesh | Egy falba épített ESP32 nem hozzáférési pont; a RoomBox táplálja az AP-t |
| Bluetooth / BLE | ESP32 BLE proxyk — egy a dobozban + csomópontok a 2. és 3. sarokban | a helymeghatározás alapja (11. fejezet) |
| Matter | Thread border router (ESP32-S3 + ESP32-H2 pár) + Matter-over-Wi-Fi az AP-n keresztül | a koordinátorok a BASE-ben; a helyiségek a hálót bővítik |
| Zigbee | dedikált Zigbee router (EFR32 vagy ESP32-C6 osztály) | egy hálózat, a koordinátor a BASE-ben |
| Z-Wave | opcionális ismétlőcsomópont | a hálózati tápos Z-Wave eszközök eleve ismételnek |
| 2,4 GHz-es HID átjáró | ESP32-S3 vevő, amely USB HID-ként jelenik meg egy helyiségbeli eszközön, vagy USB-over-IP-n kiajánlott gyári vevő | a gyári donglék közvetlen gazdagépet várnak — eszközönként kell módszert választani |
| 433 / 868 MHz | CC1101 osztályú adó-vevő ESP32-n | régi távirányítók, redőnyök, szenzorok |
| IR | IR adó + vevő, ablak felé néző | klímák, TV-k, régi AV eszközök |
| **LoRa** | **a RoomBoxokban nincs** | csak BASE-protokoll |

### 10.9 SENSOR

- **Helyiségszenzorok a RoomBoxban (Z5):** hőmérséklet/páratartalom, CO₂, VOC, fény, mmWave jelenlét. A Z5 hőtechnikailag le van választva a tápegységtől; ahol a pontosság számít, +1,5 m magasságban távoli hőmérsékletszonda kerül be.
- **Szenzorvégpontok** (busz vagy dedikált ARM-ok): mennyezetközépi jelenlétérzékelő, sarokmozgás-érzékelő, ablak melletti fényérzékelő, ajtó-/ablaknyitás-érzékelők, zajszint.
- **Biztonsági végpontok:** füst, CO, földgáz, vízszivárgás (padlószinten, mosogatók és gépek alatt), opcionális fő vízelzáró szeleppel. Az életvédelmi réteg továbbra is a tanúsított, önálló érzékelő.
- **Belső szenzorok (ZI):** dobozhőmérséklet, tápegység-hőmérséklet, páratartalom, szabotázs, vízbehatolás, ágankénti áram.
- **Egészség-/jólléti szenzorok:** helyiségenként fenntartott egyedi pontok (levegőminőség, ahol releváns radon, speciális érzékelők).
- Minden szenzoradat helyiségenként a RoomBoxban gyűlik, és onnan jut a COMP-hoz.

### 10.10 CLIMATE

- Nyomvonal RoomBox → **termosztát pont** (adat/LV + vezérlés).
- Nyomvonal a fűtésrendszerhez: padlófűtési osztó-gyűjtő aktorok (24 V-os vagy 230 V-os termoelektromos aktorok) vagy radiátorszelepek, valamint BASE/COMP kapcsolat a hőtermelőhöz (OpenTherm / Modbus / relé).
- Szellőztetés (hővisszanyerős egység) és klíma: Modbus vagy IR, fenntartott nyomvonal a legközelebbi RoomBoxtól.

### 10.11 ACCESS & HMI

- **Minden RoomBoxhoz tartozhat fali érintőképernyős panel** (PoE-ről táplálva) az ajtónál vagy más választott helyen.
- Opcionális **okostelefonos jellegű ujjlenyomat-azonosítás** a panelen: kapacitív ujjlenyomat-modul, amely a mintákat magán a szenzoron tárolja, és csak egyezés/nem egyezés eredményt ad vissza — a biometrikus adat soha nem hagyja el a modult.
- Bejárati zóna minta (bármely ajtónál újrahasznosítható): fény-/mozgásérzékelő az ajtó felett, sarokmozgás-érzékelő/kameratartó, tok tetején nyitásérzékelő, többfunkciós pont a kapcsoló mellett (panel, kódbillentyűzet/ujjlenyomat/NFC, csengőjelző, süllyesztett vezeték nélküli modul).
- COMP főképernyő: teljes hozzáférés; helyiségpanelek: helyiségre korlátozott hozzáférés felhasználói szerepkörökkel.

### 10.12 SECURITY — lásd a 12. fejezetet.

### 10.13 OUTDOOR (kültér)

- A kertet, teraszt, garázst és öntözést egy **kültéri RoomBox (RB-O)** szolgálja ki, amelyet a CHANNEL ugyanúgy ér el, mint bármely más helyiséget, saját ÁVK-val védett áramkörrel és túlfeszültség-levezetővel.
- Az öntözőszelepek jellemzően **24 VAC**-t igényelnek — az RB-O a DC sínek mellett dedikált 24 VAC-os transzformátort is tartalmaz.
- Kültéri világítás, kapu-/ajtómozgatók, kültéri kamerák, időjárás-szenzorok, EV-töltő vezérlése (maga a töltő közvetlenül az Elosztóról kap tápot).

---

## 11. A vezeték nélküli réteg emergens képességei

Amint minden helyiségben több, ismert pozíciójú rádiócsomópont van (RoomBox + sarkok), olyan képességek jelennek meg, amelyeket egyetlen csomópont sem tud nyújtani. Ezekkel tervezünk, de nem vesszük őket adottnak.

| Képesség | Miből épül | Pontosság |
|---|---|---|
| Helyiségszintű jelenlét telefonok/órák alapján | BLE RSSI a RoomBox csomópontok között | helyiség |
| Helyiségpontos címke- és matricakövetés tárgyakhoz, háziállatokhoz, kulcsokhoz | BLE jeladócímkék + többcsomópontos RSSI | helyiség / zóna |
| Eszközök helymeghatározása | Wi-Fi és BLE RSSI fúzió | zóna |
| Eszköz nélküli jelenlét- és mozgásérzékelés | Wi-Fi CSI érzékelés a csomópontok között | zóna |
| Pontos helymeghatározás (opcionális) | UWB horgonyok az L-minta három sarkában | deciméter |
| Megbízhatósági pontszámmal súlyozott foglaltság | mmWave, PIR, RSSI, CSI és ajtóérzékelők fúziója szenzoronkénti súlyokkal | helyiség |

Az L-minta három sarokpozíciója a 2D trilaterációhoz szükséges minimális horgonygeometria — az elhelyezési szabály és a helymeghatározási képesség kölcsönösen erősíti egymást.

---

## 12. Biztonsági Szolgáltatási Központ és a SECURITY réteg

### 12.1 Cél

Egy teljes, független nyomvonalréteg fenntartása, hogy egy **külső, professzionális vagyonvédelmi szolgáltató** később rögtönzött útvonalak nélkül telepíthessen rendszert, miközben az összhangban marad a BRIDGE topológiájával.

### 12.2 Biztonsági Szolgáltatási Központ (SSC)

- Fenntartott pozíció a szolgáltató **központi egysége** számára (központ, tápegység, akkumulátor, kommunikátor).
- Kialakításából adódóan **a bejárattól távolabb** helyezkedik el — várhatóan **az 1. vagy 2. RoomBox közelében**, nem a BASE-nél.
- **Két dedikált áramkörrel táplálja az Elosztószekrény** (központ/tápegység, illetve kiegészítő/sziréna/kommunikátor), mindkettő saját kismegszakítóval, SECURITY felirattal.
- Burkolóméret: 400 × 500 × 150 mm-es zárható fülke szabotázsvédelmi lehetőséggel, plusz tartalék védőcsőkapacitás.

### 12.3 SECURITY CHANNEL és ARM-ok

- A SECURITY CHANNEL **a CHANNEL-lel párhuzamosan**, saját védőcsövekben fut, és ugyanúgy éri el az egyes helyiségeket, mint a CHANNEL.
- Minden RoomBox mellett egy különálló **biztonsági pont** van (lezárt, a szolgáltató tulajdonában lévő kötődoboz, 200 × 200 × 80 mm).
- A biztonsági pontból **csillagos ARM-ok** futnak az egyes biztonsági végpontokhoz (mozgásérzékelők, ajtó-/ablaknyitás-érzékelők, üvegtörés-érzékelők, kezelők, szirénák, biztonsági kamerák), ugyanazokat az L-minta útvonalakat követve, mint a helyiség ARM-jai, de külön védőcsövekben.
- Az ajtó- és ablaktokok így **két** nyomvonalat kapnak: egyet a RoomBoxtól (automatizálás) és egyet a biztonsági ponttól (riasztó).

### 12.4 Integrációs határ

A biztonsági rendszer a szolgáltató tulajdona és felelőssége marad (EN 50131 szerinti fokozat). A BRIDGE integrációja opcionális, és csak **a szolgáltató által jóváhagyott, leválasztott interfészeken** keresztül történik: potenciálmentes kimenetek (élesítve / riasztás / hiba) vagy a központ saját IP-modulja egy dedikált VLAN-on. A BRIDGE soha nem nyúl bele a riasztórendszer huzalozásába.

---

## 13. RoomBox funkciójegyzék (teljes)

Minden külön megvalósítható funkció, azzal együtt, hogy hol helyezkedik el. **Belül** = a RoomBoxon belül. **ARM** = egy ARM-mal elért végponton. **Mindkettő** = a hardver megoszlik a kettő között.

| # | Funkció | Réteg | Belül / ARM | Forrás |
|---|---|---|---|---|
| 1 | A helyiség erősáramú áramköreinek végződtetése és elosztása dugaljak, kapcsolók, lámpák felé (minden lámpa egyedileg bekötve) | MAINS | Mindkettő | felhasználói lista |
| 2 | Egyéb 230 V-os pontok: redőnyök, helyiség léptékű hálózati eszközök | MAINS | Mindkettő | felhasználói lista |
| 3 | 230 VAC → 24 / 12 áll. / 5 VDC átalakítás | LV | Belül | felhasználói lista |
| 4 | SELV-elosztás ágankénti biztosítással és figyeléssel | LV | Mindkettő | felhasználói lista |
| 5 | Relék, vezérlők, bistabil elemek (ζ/η) | MAINS/CONTROL | Belül | felhasználói lista + ARCH-A1 |
| 6 | LV-tekercses relék és dimmerek hálózati lámpákhoz | MAINS/LV | Belül | felhasználói lista |
| 7 | LV ambient / hangulatvilágítás | LV | Mindkettő | felhasználói lista |
| 8 | KNX helyiségelosztó pont | KNX | Mindkettő | felhasználói lista |
| 9 | Biztonsági elosztópont (külön, szomszédos pontként) | SECURITY | Mellette | felhasználói lista |
| 10 | Nyomvonalak minden ajtóhoz és ablakhoz (automatizálás) | SENSOR/LV | ARM | felhasználói lista |
| 11 | Vezetékes alvezérlő (ESP32 / Pi) a COMP alatt | CONTROL | Belül | felhasználói lista |
| 12 | HDMI médiavonal és hangrendszer-alapok | MEDIA/AUDIO | Mindkettő | felhasználói lista |
| 13 | USB 3.x / Type-C adatpontok | USB | Mindkettő | felhasználói lista |
| 14 | PoE switch a helyiségen belüli elosztáshoz és a lánchoz | DATA | Belül | felhasználói lista |
| 15 | Wi-Fi AP / mesh (kétsávos, 1+ csomópont) | RF/DATA | ARM (mennyezeti AP) | felhasználói lista |
| 16 | Bluetooth csomópontok (helyiségenként 1+) | RF | Mindkettő | felhasználói lista |
| 17 | Thread border router + Wi-Fi a Matterhez | RF | Belül | felhasználói lista |
| 18 | Dedikált Zigbee hardver | RF | Belül | felhasználói lista |
| 19 | 2,4 GHz-es USB-HID átjáró | RF/USB | Belül | felhasználói lista |
| 20 | 433 / 868 MHz-es adó-vevők + másodlagos rádiók | RF | Belül | felhasználói lista |
| 21 | Szenzorvégpont-nyomvonalak, nyers adat helyiségenként | SENSOR | ARM | felhasználói lista |
| 22 | Kameranyomvonalak (PoE + LV) | DATA/LV | ARM | felhasználói lista |
| 23 | Kert / öntözés elérése (kültéri RoomBox) | OUTDOOR | RB-O | felhasználói lista |
| 24 | Termosztát- és fűtésrendszer-nyomvonalak | CLIMATE | ARM | felhasználói lista |
| 25 | Ajtó melletti / egyedi érintőpanel-nyomvonalak, ujjlenyomat-opció | ACCESS | ARM | felhasználói lista |
| 26 | Biztonsági / egészségügyi szenzorpontok (gáz, szivárgás, füst) | SENSOR | ARM | felhasználói lista |
| 27 | Belső dobozfelügyelet (hőmérséklet stb.) | SENSOR | Belül | felhasználói lista |
| 28 | Emergens többcsomópontos képességek (helymeghatározás, jelenlét, címkék) | RF | Mindkettő | felhasználói lista |
| 29 | Átmenő út a további RoomBoxok felé | minden | Belül (ZT) | felhasználói szabály |
| 30 | Klímák, TV-k, régi AV eszközök IR-vezérlése | RF | Belül | szenzorlista · OmniComm |
| 31 | mmWave jelenlétérzékelés | SENSOR | Belül/ARM | BRIDGE-DN |
| 32 | Megbízhatósági pontszámmal súlyozott jelenlétfúzió | CONTROL | Belül | BRIDGE-DN |
| 33 | Snapcast kliens + erősítőrekesz | AUDIO | Belül | OmniComm médiamodul |
| 34 | Hangasszisztens-szatellit / mikrofonpont | SENSOR/AUDIO | ARM | szenzorlista |
| 35 | NFC / RFID olvasó ajtóknál | ACCESS | ARM | OmniComm · szenzorlista |
| 36 | Csengő és bejárati többfunkciós pont | ACCESS | ARM | BRIDGE-DN bejárati minta |
| 37 | Áramkörönkénti energiaadat a helyiségről | MAINS/CONTROL | PANEL LINK-en át | BRIDGE-DN mérés |
| 38 | Vezérlő áthidaló tápja (PoE + puffer) | LV | Belül | OmniComm tápredundancia |
| 39 | Vízszivárgás → fő vízelzáró szelep működtetése | SENSOR/CLIMATE | ARM | kiegészítés |
| 40 | Szellőztetés / hővisszanyerés és klíma vezérlési kapcsolata | CLIMATE | ARM | kiegészítés |
| 41 | Wi-Fi CSI eszköz nélküli érzékelés | RF | Mindkettő | ESPBLOK |
| 42 | UWB horgonyok (opcionális pontos helymeghatározás, háziállat-/tárgykövetés) | RF | ARM (sarkok) | BRIDGE-DN követés |
| 43 | Állapotjelzés a dobozon (LED-sáv) és helyi szervizport | CONTROL | Belül | OmniComm |
| 44 | Univerzális végpont-pozíciók a még eldöntetlen funkciókhoz | minden | ARM | BRIDGE-DN stub-out minta |

---

## 14. Szabályok összefoglalása

1. A BASE közvetlenül éri el az 1. RoomBoxot; a további RoomBoxok csillagban vagy láncban érhetők el; minden végpont csak RoomBoxból érhető el.
2. A táp az Elosztószekrényből jön, a jel a BASE-ből, a törpefeszültség a RoomBoxban készül.
3. A COMP és az Elosztószekrény között két külön útvonal van: hálózati táp és PANEL LINK (csak adat).
4. A PANEL LINK tere egy szabad DIN-sor vagy egy mérőgaléria, amely minden kimenő áramkörhöz hozzáférést ad; csak galvanikusan leválasztott mérés csatlakozhat hozzá.
5. A COMP könnyű koordinátor; nehéz terhelés soha nem fut rajta.
6. A BASE rétegei telepíthetők együtt vagy külön; külön telepítésnél a LAYER TIE minden belső kapcsolatot egy az egyben reprodukál, és rétegek között csak távolságtűrő kapcsolat haladhat át.
7. A LoRa csak BASE-protokoll; minden protokoll koordinátora kizárólag a NET-ben van.
8. Minden lámpa dedikált ARM-ot kap a saját RoomBoxáig.
9. Az erősáram, a SELV, az adat, a média és a biztonsági rendszer soha nem osztozik védőcsövön; csak osztott dobozokban találkoznak.
10. A CHANNEL a belső falakat részesíti előnyben; a RoomBoxok az L-mintát követik; a szomszédos RoomBoxok eltolva kerülnek beépítésre.
11. A SECURITY réteg a CHANNEL-lel párhuzamosan fut, minden RoomBox melletti biztonsági pontból ágazik el, csillagban éri el a végpontokat, és az SSC-nél két dedikált áramkört kap az Elosztószekrényből.
12. A nagy fogyasztók közvetlenül az Elosztószekrényből kapnak tápot, soha nem RoomBoxon keresztül.
13. A kézi kezelőszervek működnek akkor is, ha a COMP, a hálózat és a CHANNEL kiesik.
14. Minden védőcsőben behúzózsinór van, és mindkét végén címke.

---

## 15. Nyitott döntések

- Helyiséglista és helyiségenkénti RoomBox-osztály; mely helyiségek kapnak közvetlen vonalat és melyek láncoltak.
- 16 portos vagy 8 portos + bővítő switch a NET-ben.
- MEDIA csomag (alap vagy teljes) és a médiaszerver hardverosztálya.
- COMP platform: Pi 5 vagy CM5 hordozó.
- BRIDGE_LINK protokoll: ESPHome RS-485-ön, Modbus RTU vagy CAN.
- KNX igen vagy nem; DALI-2 igen vagy nem.
- Hang: hangszóró-elrendezés helyiségosztályonként; mennyezeti vagy fali hangszórók.
- PANEL LINK A változat (DIN-sor) vagy B változat (mérőgaléria).
- SSC pozíciója és a szolgáltató követelményei (a falak lezárása előtt egyeztetni kell egy szolgáltatóval).
- Érintőpanel-típuscsalád és ujjlenyomat-modul; helyiségszintű felhasználói szerepkörök.

---

## A. függelék — Forrásfájl-leltár a H: meghajtós átdolgozási mappához

A BRIDGE / OmniComm / VRG munka eddig ismert fájljai, amelyeket egy mappába kell gyűjteni, mielőtt egyetlen BRIDGE System Reference dokumentummá olvasztjuk őket. Pipáld ki, ami még megvan.

**BRIDGE architektúra és kapcsolás**
- `BRIDGE-ARCH-001` r2 — egységflotta-alapozó, hétszintű létra
- `BRIDGE-ARCH-A1_parallel-control-topologies.md` — bistabil topológia-áttekintés
- `BRIDGE_Smart-Switch.md` + hét SVG ábra `BRIDGE_Smart-Switch_*`
- `BRIDGE_Project_Planner_Digest.md` — szálakon átívelő összefoglaló
- `CLA_BRIDGE_Inline_Architecture.md` — CLA BASE / ROOM CHANNEL / ROOM BOX vázlat
- Magyar jegyzet a gyengeáramú elválasztással rendelkező szobai központi dobozról (Ethernet + koax vezetése a rackhez)
- `BRIDGE-ARCH-002_Foundational-Architecture-Plan.md` — az angol eredeti
- `BRIDGE-ARCH-002_Alapozo-Architektura-Terv_HU.md` — ez a dokumentum

**BRIDGE-DN (DIN-sínes hub)**
- `BRIDGE_DN_Protocol_Reference.html`
- `BRIDGE_DN_Core_Hardware.md`
- `BRIDGE_DN_Balanced_DNE_DNU.md`
- `BRIDGE_DN_Build_Diagrams.html`

**OmniComm Hub (CM5)**
- `OmniComm_Hub_Build_Spec_1.xlsx`
- `omnicomm_spectrum_1.html` — protokollspektrum
- `full_system_connection_chain.png`
- `network_core_topology.png`
- `ups_bms_power_wiring_lrs35_to_distribution.png`
- `Waveshare_CM5_Dual_Ethernet_4G_5G_Base_Board.pdf` (gyártói adatlap)

**Kapcsolódó hardvervonalak és eszközök (referencia, nem BRIDGE-mag)**
- `esp32_szenzor_lista_2026-05-13.txt` — helyiségenkénti szenzor-bevásárlólista
- `espblok-builder.html` — ESPBLOK CAD builder
- `VRG_MASTERPLAN.md`, `VRG-BuildTree-HANDOFF.md`, `vrg-buildtree.html`
- `varler-field-device-summary.md`
- `VAULT-buildtree-entry.md`, `vault-buildtree-snippet.js`
- `HID-DECK-concept.md`
