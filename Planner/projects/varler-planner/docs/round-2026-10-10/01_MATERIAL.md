# Round 2026-10-10 — MATERIAL (paste-ready)

*Everything a WP needs that is content rather than code: the key map, the layer info texts, the
security catalogue, the MAINS split table, the circuit preset catalogue, the wall-refine algorithm and
the opening dimensions. Values marked `/*r*/` are reasoned (the codebase's own marker), `⚑` = verify
against a datasheet or standard before a client sees it.*

| § | Content | Used by |
|---|---|---|
| 1 | Keyboard: old → new | U4, U5 |
| 2 | `RLI_TEXT` — Info texts for every stack layer | S1 (M1, S5 update rows) |
| 3 | Security catalogue (Home Assistant / ESPHome) | S5 |
| 4 | Erősáram split: roles, colours, code map, migration | M1 |
| 5 | Elosztó circuit presets | M2 |
| 6 | Wall refine — algorithm, bookkeeping, fixture | G2 |
| 7 | Wide openings — dimensions and look | G1 |

---

## 1. Keyboard — old → new (U4; Tab row = U5)

**The principle:** plain W A S D Q E are the **camera, always** — in every tool, with or without a
selection. Acting on the *selection* is the same keys **with Shift**. Arrows keep exactly what they do
today. Tab becomes one global key; the five tools that used Tab move to keys they can own.

| Key | Today | New | Where |
|---|---|---|---|
| W A S D | pan — **but** move the selection in Move (grab) mode, and a selected object in Select mode | **pan, always** | 08 ≈ 332, 355, 364 |
| Q / E | zoom — **but** rotate the selection (Move), a selected object (Select), the Object ghost | **zoom, always** | 08 ≈ 336, 351, 359 |
| **Shift + W A S D** | (pan, Shift ignored) | **move the selection 100 mm** (Move tool, or any selection in Select); with fine mode on (F held or 🔍 locked) **10 mm** — or I J K L in the `'ijkl'` layout, below | new |
| **Shift + Q / E** | — | **rotate the selection ±15°**; in the Object tool rotate the ghost — or U / O | new |
| ↑ / ↓ | draw height (path, cable, device, wall-snapped object) · lift the selection (Move; selected object) · else camera pitch | **unchanged** · Shift = 10 mm lift step, unchanged | 08 ≈ 337, 360, 376 |
| ← / → | Space-palette (path, cable) · device type (Device) · build type (Build) · else camera rotate 15° | **unchanged**, plus: RBX class in the RBX tool, endpoint variant in the endpoint tool (were Tab) | 08 ≈ 368; 05p, 05s |
| **R** | — | **toggle the tool's second mode**: channel / ARM route süllyesztett ↔ kábelcsatorna (05r, 05u); mark-plane padló ↔ mennyezet (05n) (all were Tab) | new |
| **Tab** | RBX class · EP variant · channel rule · ARM rule · mark-plane surface; else browser focus moves | **wide work mode**: hide both sidebars, the stage rail and the inspector; Tab again restores exactly what was showing (U5) | new, global |
| Ctrl + D, Delete, Backspace, Enter, Space, Esc, Ctrl, Alt / F, 1–9, K, J, G, Ctrl+K/S/P/3/,/←/→/Z/Y | — | **unchanged** | |

**Two selectable layouts (answers U03 / U04: "toggle between 1 and 2").** Settings →
`Billentyűkiosztás`, `state.kbdLayout`, default `'shift'`; the old capture-WASD behaviour is **not**
kept.

| Action on the selection | `'shift'` (default) | `'ijkl'` |
|---|---|---|
| move 100 mm (fine mode 10 mm) | Shift + W A S D | I (fel) · J (bal) · K (le) · L (jobb) |
| rotate ±15° (also the Object ghost) | Shift + Q / E | U / O |
| mark wall tool / previous mode | J / Shift+J | **T / Shift+T** (was M — M is the Move tool) |
| circuit end point picking | K | **N** (was C — C is the Cable tool) |

**Correction found while building U4 (2026-10-10, answered by the user):** the tool actions in
`05c-actions.js` (`_mode(…)`) already held seven plain letters — **V** select · **M** move · **W** wall ·
**B** build · **D** device · **P** path · **C** cable — which this table had missed (they are built by a
helper, so a `keys:[…]` grep does not show them). Plain W and D therefore switched tool *and* panned. Answers:
W and D are **camera only** now (Wall = 5, Device = 3, Ctrl+K); in `'ijkl'` the two moved tools take **T** and
**N** instead of M and C.

Everything else in the table above is identical in both layouts. Switching layout rewrites the
`keys` of the two moved registry actions (`mark.wall`, `mark.wallBack`, `circuit.pick`) at runtime
and every hint / help line that names them — build the hint strings from one key table
(`KBD_LAYOUTS`), never hard-code a letter. Shift+WASD stays the selection nudge in the IJKL layout too
(harmless, and muscle memory survives a switch). Ctrl+Shift+W is never used (it closes the browser
window in Chrome).

Still free after this round (plain letters): `'shift'` layout **H I L N O T U Y Z**; `'ijkl'` **H Y Z** (X only
inside the mark tools, R only inside the five tools that used Tab; Y / Z are Ctrl+Y / Ctrl+Z when held with Ctrl).

**Help dialog rows to add / change** (`help.keys`, 05c ≈ line 312):
```js
['W A S D · Q / E','kamera: mozgatás · nagyítás (mindig)'],
['Shift + W A S D','a kijelölés mozgatása 100 mm (finom módban 10 mm)'],
['Shift + Q / E','a kijelölés forgatása 15°'],
['R','az eszköz második módja (süllyesztett ↔ csatorna, padló ↔ mennyezet)'],
['Tab','széles munkanézet: oldalsávok és panelek el / vissza'],
['←/→','paletta, típus vagy variáns váltása (RBX osztály, végpont-variáns is)'],
```
`HINTS.grab` and `HINTS.object` (08 line 11) say "WASD tol, Q/E forgat" today — rewrite them to the
Shift forms. The five tool hints that say "Tab: …" (05p `hwHint`, 05s, 05r, 05u, 05n) change to
"←/→: …" or "R: …".

---

## 2. `RLI_TEXT` — Info for every stack layer (S1)

Paste into the module S1 names. The **device-type list is not stored here** — S1 renders it live from
`EP_CAT` (`role === key`) so it can never drift; this table carries only what the catalogue cannot
say. Rows for `sys:DED`, `sys:SOC`, `sys:LIGHT` are used once M1 lands; until then `sys:MAINS` is
shown. Sources in brackets: A2 = STD-001-A2 Layer Wiring Reference, W = WORKSHOP-001 §7 answers,
I2 = IDEA-002, N = `NEED_DEFAULTS` (05t), H = `HW_BASE_RULES` (05p).

```js
// what / where + how many / cluster with — Hungarian UI text, one entry per stack role
const RLI_TEXT={
 construct:{cel:'A ház geometriája: falak, padló és helyiségek, ajtók, ablakok, lépcső, tárgyak. Minden más réteg erre épül — fal-gazda, helyiség-azonosítás, portálgráf.',
   hol:'Minden helyiség zárt padlópoligonnal és számmal (R01…). Minden nyílászáró a saját falán. Tipp: Falak finomítása (jobb klikk) a sarkok pontosításához.',
   klaszter:'—  (alap; a Jelölés réteg olvassa)'},
 mark:{cel:'Szabályok a rajzon: tiltott (⛔), előnyös (+) és kerülendő (−) falak és sávok; RBX / BASE / Elosztó helye sávok; padló- és mennyezetzónák; mozgásnyomok; nyílászáró-címkék (bejárat, külső, portál P2/P3, redőny).',
   hol:'A bejárat jelölése kötelező (a portálgráf horgonya). Minden nedves helyiség, minden tervezett RBX-fal sávval.',
   klaszter:'Minden második fázisú réteg olvassa (a helyiség-igények levezetése innen jön).'},
 hw:{cel:'Elosztószekrény, mérőóra, adatbelépés (ISP), RBX dobozok, biztonsági központ (SSC).',
   hol:'1 Elosztó lakásonként. Minden helyiséget pontosan egy RBX szolgál ki — 1 RBX 1–2 helyiségre, lehetőleg két helyiség közös belső falán. RBX alja ≥ 1900 mm (RB-M közép 2150). SSC védett, nem bejárható helyen. [H, W]',
   klaszter:'BASE (a Csatornán át); közös falszakasz BASE-zel megengedett, de kerülendő, ha a BASE mindhárom egysége egy oszlopban van.'},
 base:{cel:'A rendszer szíve: NET (kommunikáció) · COMP (koordinátor) · MEDIA (tárolás, streamek).',
   hol:'Száraz helyiség; Elosztó ≤ 8 m; NET az adatbelépéstől ≤ 10 m; az egységek egy oszlopban (≤ 1 m), hacsak nem szándékosan osztott; a szint közepéhez közel; minden RBX ≤ 90 m Cat6A nyomvonalon. Lakásonként 1. [H]',
   klaszter:'Hardver (RBX közös falszakasz — lásd ott), Csatorna.'},
 channel:{cel:'Arany pálya: fizikai összeköttetés két hardverpont között (Elosztó → BASE → RBX lánc). Hordozók: C1 adat M25 · C2 média M40 · C3 vezérlés M20 · C4b B busz M20 · C5 KNX M20; a 230 V-os világítási füzér külön sávon. [A2 §4]',
   hol:'Gerinc a mennyezet alatt 300 mm-rel; minden T-pontban kötődoboz. Minden RBX-et el kell érnie. [W]',
   klaszter:'Az ARM pályák (ezüst) ágaznak le róla.'},
 'sys:MAINS':{cel:'Erősáram, 230 V: lámpák, kapcsolók, dugaljak, dedikált fogyasztók, redőnymotorok.',
   hol:'Kapcsoló 1100 mm (a kilincs oldalán), dugalj 300 mm, lámpa a mennyezeten. Hálók köre külön; nagyobb szobánként 1–2 dugaljkör; egy világítási füzér az egész lakásra, minden RBX-et érint. [W, N]',
   klaszter:'Csak erősárammal közös pályán és csőben — SELV és adat soha. Ahol családok találkoznak: osztott szerelvénydoboz. [A2 §4, I2 K3]'},
 'sys:DED':{cel:'Dedikált körök (bronz pálya): sütő, mosogatógép, mosógép, bojler, klíma, főzőlap, AV pozíció, alelosztó betáp — mind saját kör, egyenesen az Elosztóba.',
   hol:'A fogyasztó mellett, 300 mm-en, vagy a gyártó szerinti helyen. Konyha 2–4, mosókonyha / fürdő 1–2, klíma beltéri egységenként 1. Cső: M25 (16 A), M32 (32 A főzőlap, betáp). [A2 Step 1]',
   klaszter:'Dugalj, Világítás (230 V). SELV és adat soha egy csőben.'},
 'sys:SOC':{cel:'Dugaljkörök: szobai, konyhai munkalap, fürdő, kültéri.',
   hol:'300 mm; konyhapult felett 1050–1100. Hálók köre külön, nagyobb szobánként 1–2 kör, konyhán 3 munkalap-kör (A, B + sziget). Szobánként jellemzően 3–6 dugaljhely. [W, ELO_RULES]',
   klaszter:'Dedikált, Világítás (230 V). Más család mellé osztott dobozban. [I2 K3]'},
 'sys:LIGHT':{cel:'Világítás: lámpahelyek és kapcsolók együtt. Előbb köthetők hagyományosan (kapcsoló → lámpa), később RBX bistabil bemenetre (a kapcsoló az RBX bemenete). [Q29]',
   hol:'Kapcsoló 1100 mm a kilincs oldalán, ajtónként 1 kapcsolóhely; lámpa a mennyezeten, helyiségenként ≥ 1. Egy világítási füzér az egész lakásra, minden RBX-et érint. [W]',
   klaszter:'Dugalj (230 V). A kapcsoló fölé, a 1300-as sávba kerülhet az okos vezérlés (Kezelőfelületek, NTL) — közös klaszterdoboz K1/K2. [I2]'},
 'sys:LV':{cel:'Törpefeszültség, A busz (kényelmi SELV 24/12/5 V): LED-vonalak, univerzális végpontok (UEP), USB-C töltők.',
   hol:'LED rejtett világítás mennyezeten / pult alatt (nappali, konyha, fürdő); UEP 300 mm-en (háló, dolgozó, nappali). UEP mellé mindig egy üres M16 tartalék. [A2 Step 2, N]',
   klaszter:'Minden SELV és adat réteggel közös pályán, saját csőben.'},
 'sys:BUSB':{cel:'Biztosított 24 V, B busz: menekülési és lépcsőfény, kapaszkodó LED, értesítő fény (NTL).',
   hol:'Közlekedő, lépcső, előszoba; NTL szemmagasságban 1100–1200; az éjszakai mozgásnyomok mentén. [N, STD-008]',
   klaszter:'SELV és adat — de soha nem az A busz csövében. [A2 §4]'},
 'sys:CONTROL':{cel:'Vezérlés, BRIDGE_LINK (RS-485): portál vezérlőpontok; a Csatornában C3.',
   hol:'Portál ajtók (P2/P3 címke) felső sarkában, 2150 mm, a kilincs oldalán — 10×10-es portáldobozba. [W]',
   klaszter:'Érzékelők portál pontja (ugyanabba a dobozba), minden SELV és adat.'},
 'sys:DATA':{cel:'Adat és PoE: WiFi hozzáférési pont, adataljzat, kamera.',
   hol:'AP a mennyezeten, szintenként 1–2; adataljzat 300 mm (nappali, dolgozó, háló); kamera 2400 mm. [N]',
   klaszter:'Minden SELV és adat, Média, USB.'},
 'sys:KNX':{cel:'KNX busz — csak ha a projekt KNX-et választ (P33-ban nem).',
   hol:'Vonal vagy fa, soha nem hurok. [A2 Step 7]',
   klaszter:'Minden SELV és adat.'},
 'sys:SENSOR':{cel:'Érzékelők: jelenlét (mmWave), CO₂, PIR, vízszivárgás, hőkamera (fürdő), ágy-életjel, portál ToF.',
   hol:'Helyiségenként 1 jelenlét a mennyezeten; szivárgás padlószinten a gép mellett; portál pont az ajtó felső sarkában. [N]',
   klaszter:'SELV és adat; portálnál a Vezérléssel közös dobozban.'},
 'sys:RF':{cel:'Rádiós lefedettségi terv — nincs cső: Thread, BLE, ESP-NOW, WiFi, UWB.',
   hol:'RBX-enként; nagy helyiségben UWB. Az RBX elhelyezése dönti el. [A2 Step 9]',
   klaszter:'Hardver (RBX).'},
 'sys:HMI':{cel:'Kezelőfelületek: érintőpanel, termosztát, belépési pont.',
   hol:'A ≈ 1300-as okos sávban (panel 1450, termosztát 1500); bejárat, nappali, háló. [W]',
   klaszter:'A Világítás kapcsolóival egy oszlopban, közös klaszterdobozban (K1/K2); Adat (PoE). [I2]'},
 'sys:MEDIA':{cel:'Média és hang: hangszóró, képernyő, AV pozíció.',
   hol:'Nappali médiafal (képernyő 1200, AV 300), háló; hangszóró a mennyezeten. Médiafal útvonal M50–M63 vagy kétrekeszes parapet. [A2 Step 11]',
   klaszter:'Adat, USB.'},
 'sys:USB':{cel:'USB adatpontok (nem az IT hálózaton): asztal, médiafal.',
   hol:'300 mm vagy asztalmagasság; dolgozó, nappali. [N]',
   klaszter:'Média, Adat.'},
 'sys:SECURITY':{cel:'Biztonságtechnika — Home Assistant + ESPHome alapú riasztó: mozgás-, nyitás-, üvegtörés-érzékelők, szirénák, kezelő, füst- / CO-érzékelők, pánikgomb, kaputelefon, zár.',
   hol:'Alap kivitel: a határvédelem (nyitás, üvegtörés, sziréna, kezelő, zár) csillagban az SSC-ig, a belső mozgásérzékelők és a pánikgomb a helyiség RBX-éhez. Prémium: minden behatolás-érzékelő csillagban az SSC-ig, saját kábelen. Bejárat: nyitásérzékelő + kezelő (1450) + beltéri sziréna; minden külső nyílászáró: nyitásérzékelő; sarok-mozgásérzékelő 2200-on a bejárati útvonalra nézve; füst a hálók és közlekedők mennyezetén; CO a tüzelőberendezés terében. Mindig utolsó réteg. [S5]',
   klaszter:'Saját cső (M16 / érzékelő); a kaputelefon és a kamera az Adat családban fut. Életvédelem (füst, CO): a tanúsított önálló jelző az elsődleges, a HA csak értesít.'},
 arm:{cel:'Ezüst pályák: egyvonalas pályák az RBX-től minden végpontig. Egy ARM több réteget visz, külön csövekben (ezt a feltöltés számolja).',
   hol:'Minden második fázisú végpontot el kell érnie (a hiányzókat a réteg jelzi).',
   klaszter:'Minden második fázisú réteg.'}};
```

---

## 3. Security catalogue — Home Assistant / ESPHome (S5)

**Grounding (CoreRef, ESPHome 2026.9.1 / HA core 2026.10.0, `H:\Dev-VRG\VRG-DE\Planner_VRG_U100\CoreRef\db\coreref.sqlite`):**
ESPHome has `alarm_control_panel` + `template.alarm_control_panel`, `gpio.binary_sensor` (wired
contacts and PIR), `ld2410` / `ld2420` / `ld2450` (mmWave), `matrix_keypad`, `wiegand`, `pn532`,
`rc522`, `rdm6300`, `fingerprint_grow`, `rtttl` / `dfplayer` (sounders), `sim800l` (GSM fallback),
`ethernet`, `status_led`, `zigbee` (C6/H2 end device). HA core has `manual` (Manual alarm control
panel, helper, iot_class *calculated*), `template`, `esphome`, `zha`, `matter`, `thread`, `onvif`,
`reolink` (local push). Use `select * from esphome_component where name=?` to check a name before
citing it.

**Topology — two tiers (answer S01: "default is 3, premium is 1").** A per-stack setting
`S.secTier`, Info + inspector select `Biztonsági kivitel: Alap / Prémium`:

| Device | **Alap** (default — mixed) | **Prémium** (star) |
|---|---|---|
| DWC, GLB, SRN, KPD, LCK — the perimeter | SSC | SSC |
| MOT, PNC — interior | the room's RBX | SSC |
| SMK, COA, DBL | RBX | RBX |

So `from` in the catalogue below is the **premium** value; `epFromOf(entry, d)` returns `'rbx'` for
MOT and PNC when the stack's tier is `'alap'` (absent = `'alap'`). Star wiring to one protected
controller is the classic alarm practice (one cable per point, end-of-line resistors and a tamper loop
possible, a cut cable detectable) — that is what the premium tier sells; the basic tier saves cable on
the interior detectors. The SSC is an ESPHome node with Ethernet, battery backup and an optional GSM
module, exposing a `template` alarm control panel to HA; HA's `manual` panel is the fallback. Life-safety
detectors (smoke, CO) are **certified standalone devices** (EN 14604 / EN 50291 ⚑) — HA only
notifies; never make an ESPHome sensor the primary smoke or CO alarm. State this in the Info text and
in any client material.

**New codes** (all `role:'sys:SECURITY'`, `cat:'device'`; existing `SEC` stays for third-party
systems). `from:'ssc'` needs an SSC node; P33 has none (10-09 handover) — the fill reports
`fill.unreached` until one is placed, which is the right message.

```js
 // ---- SECURITY — Home Assistant / ESPHome (S5). /*r*/ heights are reasoned; ⚑ before client use ----
 {code:'MOT',new:true,role:'sys:SECURITY',n:'Mozgásérzékelő (behatolás)',cat:'device',mount:'wall',h:2200,topo:'star',from:'ssc',vars:[   /*r*/ corner, 2.0–2.4 m
   {k:'pir', n:'PIR, vezetékes (ESPHome gpio)',          cab:[{c:'ALARM6',w:'M16'}]},
   {k:'dual',n:'PIR + mikrohullám (kettős technológia)', cab:[{c:'ALARM6',w:'M16'}]},
   {k:'pet', n:'Kisállatbarát PIR',                       cab:[{c:'ALARM6',w:'M16'}]},
   {k:'mmw', n:'mmWave jelenlét + behatolás (LD2410 / LD2450)',cab:[{c:'LIYCY4x05',w:'M16'}]}]},
 {code:'DWC',new:true,role:'sys:SECURITY',n:'Nyitásérzékelő (ajtó / ablak)',cat:'device',mount:'wall',h:2050,topo:'star',from:'ssc',vars:[  /*r*/ frame top, latch side
   {k:'reed',n:'Reed + szabotázs, vezetékes',      cab:[{c:'ALARM6',w:'M16'}]},
   {k:'roll',n:'Redőny / görgős nyitásérzékelő',  cab:[{c:'ALARM6',w:'M16'}]},
   {k:'zb',  n:'Elemes, Zigbee / Thread (nincs kábel)',cab:[]}]},
 {code:'GLB',new:true,role:'sys:SECURITY',n:'Üvegtörés-érzékelő',cat:'device',mount:'wall',h:2200,topo:'star',from:'ssc',vars:[   /*r*/ facing the glazing ≤ 6 m ⚑
   {k:'wired',n:'Vezetékes (akusztikus)',cab:[{c:'ALARM6',w:'M16'}]},
   {k:'zb',   n:'Elemes, Zigbee / Thread',cab:[]}]},
 {code:'SRN',new:true,role:'sys:SECURITY',n:'Sziréna',cat:'device',mount:'wall',h:2300,topo:'star',from:'ssc',vars:[
   {k:'bel',n:'Beltéri sziréna (12 V)',                 cab:[{c:'SIREN4',w:'M16'}]},
   {k:'kul',n:'Kültéri sziréna villogóval, akkus, szabotázs',cab:[{c:'SIREN4',w:'M16'}]}]},   /*r*/ outdoor: h 2800, out of reach
 {code:'KPD',new:true,role:'sys:SECURITY',n:'Kezelő / belépési pont',cat:'device',mount:'wall',h:1450,topo:'star',from:'ssc',vars:[   // the ≈1300 smart band [W]
   {k:'kod',n:'Kódbillentyűzet (matrix_keypad / Wiegand)',cab:[{c:'JY4x2x08',w:'M16'}]},
   {k:'nfc',n:'NFC / RFID olvasó (PN532 / RC522)',        cab:[{c:'JY4x2x08',w:'M16'}]},
   {k:'ujj',n:'Ujjlenyomat-olvasó',                       cab:[{c:'JY4x2x08',w:'M16'}]},
   {k:'pan',n:'Érintőpanel riasztó-felülettel (PoE)',      cab:[{c:'CAT6A_S',w:'M20',fam:'DATA'}]}]},
 {code:'PNC',new:true,role:'sys:SECURITY',n:'Pánikgomb',cat:'device',mount:'wall',h:900,topo:'star',from:'ssc',vars:[   /*r*/ bedside / entry
   {k:'wired',n:'Vezetékes',cab:[{c:'ALARM6',w:'M16'}]},
   {k:'zb',   n:'Elemes, Zigbee / Thread',cab:[]}]},
 {code:'LCK',new:true,role:'sys:SECURITY',n:'Zár / zárnyelv-állapot',cat:'device',mount:'wall',h:1050,topo:'star',from:'ssc',vars:[   /*r*/ door frame, latch side
   {k:'str',n:'Elektromos zárfogadó + állapotjelzés (12 V)',cab:[{c:'JY2x2x08',w:'M16'}]},
   {k:'mot',n:'Motoros okoszár, elemes (Zigbee / Thread / Matter)',cab:[]}]},
 {code:'SMK',new:true,role:'sys:SECURITY',n:'Füst- / hőérzékelő (EN 14604)',cat:'device',mount:'ceiling',topo:'star',from:'rbx',vars:[   // life safety: standalone first
   {k:'zb',  n:'Elemes füstjelző, rádiós összekötéssel + HA (Zigbee / Thread)',cab:[]},
   {k:'ilk', n:'230 V összekötött füstjelző + relékimenet az RBX bemenetre',cab:[{c:'NYM3x15',w:'M20',fam:'MAINS',from:'board'},{c:'JY2x2x08',w:'M16',fam:'CONTROL'}]},
   {k:'heat',n:'Hőérzékelő (konyha, garázs)',cab:[]}]},
 {code:'COA',new:true,role:'sys:SECURITY',n:'CO-érzékelő (EN 50291)',cat:'device',mount:'wall',h:2000,topo:'star',from:'rbx',vars:[   /*r*/ ⚑ EN 50292: high on the wall, ≥150 mm below the ceiling, 1–3 m from the appliance
   {k:'zb', n:'Elemes, Zigbee / Thread',cab:[]},
   {k:'ilk',n:'Hálózati + relékimenet az RBX bemenetre',cab:[{c:'JY2x2x08',w:'M16',fam:'CONTROL'}]}]},
 {code:'DBL',new:true,role:'sys:SECURITY',n:'Videós kaputelefon / csengő',cat:'device',mount:'wall',h:1500,topo:'star',from:'rbx',vars:[   // local: ONVIF / Reolink [CoreRef]
   {k:'poe',n:'PoE, helyi (ONVIF)',cab:[{c:'CAT6A_U',w:'M20',fam:'DATA'}]}]},
```
(If `cab:[]` breaks an assumption in the fill or the symbols — battery devices carry no cable —
S5 must make an empty cable list legal rather than invent a dummy cable. Grep `en.vars[…].cab` users
in 05w first.)

**Room needs** (`NEED_DEFAULTS`, 05t): add to the kinds, keep everything else:
```js
 eloszoba:  { … 'sys:SECURITY':['DWC','KPD','SRN','MOT'] },   // replaces ['SEC']
 nappali:   { … 'sys:SECURITY':['MOT'] },
 halo:      { … 'sys:SECURITY':['SMK'] },
 kozlekedo: { … 'sys:SECURITY':['SMK','MOT'] },
 konyha:    { … 'sys:SECURITY':['SMK'] },     // SMK variant 'heat' suggested in kitchens
 gepeszet:  { … 'sys:SECURITY':['SMK','COA'] },
 kulter:    { … 'sys:SECURITY':['SRN','MOT'] },
```
**Derived from the marks** (`needDerived`, 05t ≈ line 66): today any door/window tagged
`kulso / bejarat / nyitaserz / vedett` adds `SEC`. New: `bejarat` → `DWC`, `KPD`, `DBL`; `kulso` /
`nyitaserz` / `vedett` on a door or window → `DWC`; a window tagged `vedett` → also `GLB`.

**Placement hints** (`EP` placement suggestions, 05t `sug*`): `DWC` on the opening's frame, top,
latch side (`sugDoorPt` gives the latch side — reuse it, 10-09 handover); `MOT` in the room corner
whose view covers the most door openings; `KPD` inside the entrance, latch side, 1450; `SRN kul` on
the outer face above the eaves line (h 2800). Symbols: the 05z icon convention — body = family
(security uses the existing SEC body), mark = device; add one mark per new code.

---

## 4. Erősáram split (M1)

**Roles** (replace the one `sys:MAINS` row in `STK_ROLES`, 05m line 21, same position):
```js
 {k:'sys:DED',   n:'Dedikált körök',            ph:2, fam:'MAINS'},
 {k:'sys:SOC',   n:'Dugaljak',                  ph:2, fam:'MAINS'},
 {k:'sys:LIGHT', n:'Világítás',                 ph:2, fam:'MAINS'},
```
**Colours** (`STK_COL`) — the user's words: barna, vörös, világospiros (lámpa), narancs (kapcsoló):
```js
 'sys:DED':'#6d4c41',   // barna — darker than BUSB #b07a2a so the two do not read as one
 'sys:SOC':'#c62828',   // vörös
 'sys:LIGHT':'#ef7b72', // világospiros = the layer colour and the LAMP symbol colour
```
and a per-code override for the switch inside the lighting layer, read by the endpoint symbol where
it now reads `EP_ROLE_COL[role]`:
```js
const EP_CODE_COL={'sys:LIGHT':{SWI:'#f08c2e'}};   // narancs — kapcsoló
```
Check against neighbours: mark `#c0530f` (orange, phase 1 only), LV `#e6a800` (amber). If the user
finds SWI orange too close to LV, Q-M04 offers `#e8590c`.

**Icons:** `STK_ICONS` `'sys:DED':'🔌'`, `'sys:SOC':'⚡'`, `'sys:LIGHT':'💡'` (the 05z rail icons follow the
same keys).

**Code → role** (EP_CAT `role` field and the migration):

| Code | Today | New |
|---|---|---|
| DED (all variants) | sys:MAINS | sys:DED |
| SOC | sys:MAINS | sys:SOC |
| LMP (230 V) | sys:MAINS | sys:LIGHT |
| SWI | sys:MAINS | sys:LIGHT |
| SHU (redőnymotor) | sys:MAINS | **sys:LIGHT** (switched load, same input logic) — Q-M03 |
| classic device without a code: `light` / `switch` / `socket` | by `EP_FROM_TYPE` | LIGHT / LIGHT / SOC |
| AVP | sys:MEDIA (its MAINS cable has `fam:'MAINS', from:'board'`) | unchanged |

**One helper instead of 40 string edits:**
```js
const MNS_ROLES=['sys:DED','sys:SOC','sys:LIGHT'];
function mnsIs(role){return role==='sys:MAINS'||MNS_ROLES.indexOf(role)>=0;}
function mnsRoleOf(code,type){…}   // the table above
```
Every place that compares to `'sys:MAINS'` either takes the union (`epCircuits`, `epInRoom(…,
'sys:MAINS')` → loop over `MNS_ROLES`), or keys per role (`NEED_DEFAULTS`, `STK_GROUPS['+sys:…']`,
`STK_CHECKS['sys:MAINS']` in 05x line 91 → register on each of the three). Counts today: 05m 4 · 05s
11 · 05t 9 · 05w 3 · 05x 2 · tests 54 (spec-35, 45, 46, 49, 51–54, 57). The fill keeps `fam:'MAINS'`
for all three roles, so `AFILL_FAMS`, the conduit packing and the cabinet need no change — verify
by grepping where a cable's `fam` is filled from the role's `fam`.

**`NEED_DEFAULTS` split:** `'*': {'sys:MAINS':['LMP','SWI','SOC']}` becomes
`{'sys:LIGHT':['LMP','SWI'],'sys:SOC':['SOC']}`; `konyha`/`gepeszet` add `'sys:DED':['DED']`;
`wc`/`kamra`/`kozlekedo` (`LMP,SWI` only) → `'sys:LIGHT':['LMP','SWI'],'sys:SOC':[]`; `kulter`
(`LMP,SOC`) → `'sys:LIGHT':['LMP'],'sys:SOC':['SOC']`. `needDerived` `add('sys:MAINS','SHU')` →
`'sys:LIGHT'`. Room records that saved `rm.needs['sys:MAINS']` are split by code on migration.

**Migration** (load time, idempotent, inside the existing `lyrMigrateAll()` path in 12-boot ≈ line 217
or the stack's own migrate):
1. For each stack with a layer `L` of role `sys:MAINS`: `L.role='sys:SOC'`, `L.name='Dugaljak'`
   (it keeps its id, visibility, lock, opacity, tint); create `sys:DED` and `sys:LIGHT` layers with
   new ids, copying `visible / lock / op` from `L`, inserted in role order.
2. Move every device on `L` whose code maps to DED / LIGHT to the new layer (`d.layer = …`). Paths and
   cables on `L` (rare — ARM routes live on `arm`) stay on `L`.
3. Split `rm.needs['sys:MAINS']` by code into the three keys; delete the old key.
4. `state.activeLayer` pointing at `L` stays valid.
A plan saved after migration opens in an older build with three unknown roles — they behave as plain
layers there (verify: `stkRole(k)` returns null → no crash). Write that into the CHANGELOG.

### 4b. Grey-safe print palette (answer M04: "colour-printed documents printed in grayscale must
### translate into distinguishable shades of grey")

**The problem, measured** (CIE L*, the lightness a grey print keeps): the 21 screen role colours
crowd into L* 44–59 — base 44, SOC 44, CONTROL 46, KNX 46, HMI 48, construct 49, mark 49, SENSOR 50,
USB 51 … — and inside the new Erősáram group lamp (65) and switch (68) are 3 apart. In grey they are
one colour. 21 roles cannot get 21 distinct greys (a print separates ~5–6 reliably), so the print
palette carries **two** channels: a lightness level (4 steps, 15 L* apart) and a line pattern
(4 kinds). Every phase-2 role gets a unique (level, pattern) pair; the Erősáram four share the solid
pattern and are spread over all four levels, because they are the ones printed together most.

Each print colour keeps its screen hue (chroma reduced only where sRGB forces it), so the colour print
still reads as the same system. Generated by `print-palette.js` in this folder (keep hue, set L*;
`node print-palette.js` reprints the table):

```js
// grey-safe print palette: c = colour for colour print, L = CIE L* it greys to, p = line pattern
// p: s solid · d dash '6 3' · o dot '1.2 2.4' · x dash-dot '7 2 1.5 2'  (paper mm, through bpSW-style pens)
const STK_PRINT={
 'sys:DED':{c:'#5f3f34',L:30,p:'s'},  'sys:SOC':{c:'#ca2c2b',L:45,p:'s'},
 SWI:{c:'#d87817',L:60,p:'s'},        'sys:LIGHT':{c:'#fea096',L:75,p:'s'},   // lamp
 'sys:CONTROL':{c:'#4d3593',L:30,p:'d'},'sys:BUSB':{c:'#92600c',L:45,p:'d'},
 'sys:DATA':{c:'#1ca388',L:60,p:'d'}, 'sys:LV':{c:'#edae10',L:75,p:'d'},
 'sys:USB':{c:'#2e4b57',L:30,p:'o'},  'sys:HMI':{c:'#4c69a8',L:45,p:'o'},
 'sys:SENSOR':{c:'#5392e5',L:60,p:'o'},'sys:MEDIA':{c:'#ff9ac1',L:75,p:'o'},
 'sys:SECURITY':{c:'#474747',L:30,p:'x'},'sys:KNX':{c:'#2a7a2f',L:45,p:'x'},
 arm:{c:'#35a460',L:60,p:'x'},        'sys:RF':{c:'#64c8c8',L:75,p:'x'},
 // phase 1 — boxes and walls, told apart by kind, so levels may repeat
 hw:{c:'#394956',L:30,p:'s'}, base:{c:'#25738f',L:45,p:'s'}, channel:{c:'#9687cc',L:60,p:'s'},
 mark:{c:'#e3702e',L:60,p:'x'}, construct:{c:'#7e766a',L:50,p:'s'}};
```
Where it applies: the Print path (`@media print` already greys the stage, `shell.html` line 196),
`exportPNG(true)` (PNG grey, `11-controls.js` line 239), and the BRIDGE sheet / client-preview
renderers when they draw role colours. Screen colours (`STK_COL`) stay as answered (M04 = A); the
print palette replaces them only while printing / exporting, and adds the pattern to route strokes and
symbol outlines. A Legend block on printed sheets shows each used role as a swatch + pattern + name.
`state.printPal` (default on) can switch it off for a true-colour print.

**Alternative the user may prefer (Q-M01 B):** keep one Erősáram layer and colour its four device
sub-layers (Dugaljak · Kapcsolók · Lámpák · Eszközök already exist as sub-layer rows). Ten times
cheaper, no migration, but it is not what the draft says ("instead of one Erősáram layer").

---

## 5. Elosztó circuit presets (M2)

Written in the Kalkulátor form `mcbParse` reads (05j line 67). Defaults follow `ELO_RULES.mcb`
(05x line 22 — **C curve**, the project's existing choice); the dialog offers B ↔ C per line because
the user named both (Q-M06). Values are common Hungarian residential practice, **not a design**: the
real rating comes from the cable, the installation method and the load (MSZ HD 60364-4-43 / -5-52 ⚑).
Every way gets the 30 mA RCBO of `ELO_RULES.perWay` — not repeated per line.

`scope`: `house` = one per dwelling · `room` = linked to rooms (the `kinds` list pre-selects rooms of
those kinds for the reminder) · `unit` = one per appliance.

```js
const CPR_CAT=[
 // tier 1 — alap: minden otthonban
 {key:'vil',    tier:1,kind:'light', n:'Világítás (lakás-füzér)',            mcb:'1C 10A',  mm2:1.5, cab:'NYM3x15', scope:'house', codes:['LMP','SWI']},
 {key:'dugsz',  tier:1,kind:'socket',n:'Dugaljkör — szoba (1,5 mm², S04)',   mcb:'1C 13A',  mm2:1.5, cab:'NYM3x15', scope:'room', kinds:['halo','nappali','dolgozo','etkezo'], codes:['SOC']},
 {key:'dug25',  tier:1,kind:'socket',n:'Dugaljkör — 2,5 mm²',                mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'room', kinds:['nappali','dolgozo'], codes:['SOC']},
 {key:'konyhaA',tier:1,kind:'socket',n:'Konyhai munkalap A',                 mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'room', kinds:['konyha'], codes:['SOC']},
 {key:'konyhaB',tier:1,kind:'socket',n:'Konyhai munkalap B',                 mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'room', kinds:['konyha'], codes:['SOC']},
 {key:'furdo',  tier:1,kind:'socket',n:'Fürdőszobai dugalj',                 mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'room', kinds:['furdo'], codes:['SOC']},
 {key:'mosog',  tier:1,kind:'ded',   n:'Mosógép',                            mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'unit', kinds:['furdo','gepeszet','kamra'], codes:['DED:g16']},
 {key:'mosogat',tier:1,kind:'ded',   n:'Mosogatógép',                        mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'unit', kinds:['konyha'], codes:['DED:g16']},
 {key:'suto',   tier:1,kind:'ded',   n:'Sütő',                               mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'unit', kinds:['konyha'], codes:['DED:g16']},
 {key:'fozo',   tier:1,kind:'ded',   n:'Főzőlap, 1 fázis 32 A',              mcb:'1C 32A',  mm2:6,   cab:'NYM3x6',  scope:'unit', kinds:['konyha'], codes:['DED:hob32']},
 {key:'rsys',   tier:1,kind:'sys',   n:'BRIDGE rendszerkör (BASE, SSC, puffer)',mcb:'1C 10A', mm2:1.5, cab:'NYM3x15', scope:'house', codes:[]},
 {key:'klima',  tier:1,kind:'ded',   n:'Klíma (beltéri egységenként)',       mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'unit', kinds:['halo','nappali','dolgozo'], codes:['DED:g16'], expect:[1,2]},   // answer M06: 1–2 expected by default
 // tier 2 — kiegészítő: gyakori
 {key:'fozo2l', tier:2,kind:'ded',   n:'Főzőlap 2L+2N',                      mcb:'1P-N C16A',mm2:2.5,cab:'NYM5x25', scope:'unit', kinds:['konyha'], codes:['DED:hob2l']},
 {key:'huto',   tier:2,kind:'ded',   n:'Hűtő / fagyasztó (saját kör)',       mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'unit', kinds:['konyha','kamra'], codes:['DED:g16']},
 {key:'mikro',  tier:2,kind:'ded',   n:'Mikrohullámú sütő',                  mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'unit', kinds:['konyha'], codes:['DED:g16']},
 {key:'szarit', tier:2,kind:'ded',   n:'Szárítógép',                         mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'unit', kinds:['furdo','gepeszet'], codes:['DED:g16']},
 {key:'bojler', tier:2,kind:'ded',   n:'Villanybojler',                      mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'unit', kinds:['furdo','gepeszet','kamra'], codes:['DED:g16']},
 {key:'szobakor',tier:2,kind:'socket',n:'Szobakör — dugaljak + világítás (felújítás, NV4-minta)',mcb:'1C 16A',mm2:2.5,cab:'NYM3x25', scope:'room', kinds:['nappali','halo','dolgozo'], codes:['SOC','LMP','SWI']},
 {key:'av',     tier:2,kind:'ded',   n:'AV pozíció (médiafal)',              mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'unit', kinds:['nappali'], codes:['AVP']},
 {key:'kulter', tier:2,kind:'socket',n:'Kültéri dugalj (IP44)',              mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'room', kinds:['kulter'], codes:['SOC']},
 {key:'garazs', tier:2,kind:'socket',n:'Garázs / műhely dugalj',             mcb:'1C 16A',  mm2:2.5, cab:'NYM3x25', scope:'room', kinds:['gepeszet'], codes:['SOC']},
 {key:'csengo', tier:2,kind:'sys',   n:'Csengő / kaputelefon táp',           mcb:'1B 6A',   mm2:1.5, cab:'NYM3x15', scope:'house', codes:[]},
 {key:'kapu',   tier:2,kind:'ded',   n:'Kapunyitó / garázskapu motor',       mcb:'1C 10A',  mm2:1.5, cab:'NYM3x15', scope:'unit', codes:['DED:g16']},
 // tier 3 — speciális
 {key:'ev',     tier:3,kind:'ded',   n:'Elektromosautó-töltő, 3 fázis 11 kW',mcb:'3C 16A',  mm2:4,   cab:'NYM5x4',  scope:'unit', codes:['DED'], note:'RCD A-EV / B típus ⚑'},
 {key:'hosziv', tier:3,kind:'ded',   n:'Hőszivattyú kültéri egység',         mcb:'3C 16A',  mm2:2.5, cab:'NYM5x25', scope:'unit', codes:['DED'], note:'gyártói adat szerint ⚑'},
 {key:'pfutes', tier:3,kind:'ded',   n:'Elektromos padlófűtés (helyiségenként)',mcb:'1C 16A',mm2:2.5, cab:'NYM3x25', scope:'room', kinds:['furdo'], codes:['DED:g16']},
 {key:'szauna', tier:3,kind:'ded',   n:'Szaunakályha',                       mcb:'3C 16A',  mm2:2.5, cab:'NYM5x25', scope:'unit', codes:['DED']},
 {key:'tuzhely3',tier:3,kind:'ded',  n:'Tűzhely, 3 fázis',                   mcb:'3C 16A',  mm2:2.5, cab:'NYM5x25', scope:'unit', kinds:['konyha'], codes:['DED:hob2l']},
 {key:'cee',    tier:3,kind:'socket',n:'Ipari (CEE) dugalj 3 fázis',         mcb:'3C 16A',  mm2:2.5, cab:'NYM5x25', scope:'unit', codes:['SOC']},
 {key:'medence',tier:3,kind:'ded',   n:'Medence- / kerti szivattyú',         mcb:'1C 10A',  mm2:1.5, cab:'NYM3x15', scope:'unit', codes:['DED:g16'], note:'C görbe a motor miatt'},
 {key:'napelem',tier:3,kind:'ded',   n:'Napelemes inverter',                 mcb:'3C 16A',  mm2:4,   cab:'NYM5x4',  scope:'unit', codes:['DED'], note:'inverter adatlap szerint ⚑'},
 {key:'alelo',  tier:3,kind:'ded',   n:'Alelosztó betáp, 3 fázis',           mcb:'3C 25A',  mm2:6,   cab:'NYM5x6',  scope:'unit', codes:['DED:alelo']}];
```
`expect:[min,max]` = how many active circuits of this key the reminder expects (absent = `[1,1]` for
tier 1, `[0,…]` otherwise). Klíma: 1–2 by default (answer M06); 0 active → `⚠ alapkör`, 3+ → no
warning (NV4 has 3).

**Sample preset (answer M06):** `samples/NV4-minta.vrg-elo-presets.json` — NV4's finalised 13-circuit
schedule (Költségvetési Tervezet 12.3.4: one `1B 10A` lighting circuit for the shared rooms + the hall
socket, three mixed room circuits, kitchen worktop, oven/hob 16 A, fridge, microwave, bathroom, three
klíma, washing machine — all `1C 16A` on 2.5 mm²). It carries no client name or address. M2 ships it as
a built-in "Minta: panellakás felújítás (NV4)" preset set the dialog can load in one click, and as the
import test fixture. Note how real practice differs from `ELO_RULES.mcb`: lighting B10, not C10 —
the dialog's per-row B / C toggle exists for exactly this.

`codes` ties a preset to EP codes (`'DED:g16'` = code + variant) so a box chosen from the box menu
gets the right endpoint code and the right M1 layer. Cable codes are the 05w ones (`NYM5x4` does not
exist yet ⚑ — add `NYM5x4:{n:'NYM-J 5×4',od:13.5}` per A2 §2.2 or use `NYM5x6`).

**Export format** (download, `vrg-elo-presets` — same pattern as `cktExportObj`, 05j line 158):
```json
{"format":"vrg-elo-presets","v":1,"project":"<name>","date":"YYYY-MM-DD",
 "items":[{"key":"dugsz","n":"Dugaljkör — szoba (1,5 mm², S04)","kind":"socket","tier":1,"mcb":"1C 13A","mm2":1.5,"cab":"NYM3x15","scope":"room","kinds":["halo"],"codes":["SOC"]}]}
```

---

## 6. Wall refine (G2)

Walls are axis-aligned rectangles `{id,x0,y0,x1,y1,h?,z0?,layer}` in `WALLS[level]`; `wallInfo(r)`
(03-geometry line 60) gives `horiz`, the centre segment and `thick`. A wall's **band** is its
thickness interval across (y for horizontal, x for vertical), its **span** the length interval.

**Junction search.** For every pair (A horizontal, B vertical) on the level, both on visible unlocked
layers (`hitOk` from U1), `|A.z0−B.z0| ≤ 10` and the same height class (raised walls skip):
`TOL = max(60, 1.5 × max(tA, tB))` /*r*/. A and B touch when A's span reaches B's band within TOL
**and** B's span reaches A's band within TOL. `passA` = A's span extends beyond B's band by > TOL on
**both** sides; same for `passB`.

| passA | passB | Type | Change (default Q-G02 = A) |
|---|---|---|---|
| yes | yes | **X** | nothing (report only) |
| yes | no | **T** (A through) | B's near end → A's **near** face (a clean butt joint, no overlap) |
| no | yes | **T** (B through) | A's near end → B's near face |
| no | no | **L** | A's near end → B's outer face, B's near end → A's outer face: the overlap is exactly the `tA × tB` corner square |

"Near end" = the end closer to the other wall's band centre. "Near / outer face" = the other wall's
band edge on the side towards / away from this wall's body. That is what "perfect squares at the
connection points, seen from above" means: every L corner is the full square of the two bands,
every T stem stops exactly on the through wall's face, nothing sticks out (picture 3's overshoot)
and nothing falls short.

Q-G02 alternatives: **B** = "nearest exact form" — per junction take whichever exact form (L: square ·
A owns the corner · B owns the corner; T: butt · through to the far face) costs the least total
movement, ties → A's form; it respects how a plan was drawn but leaves mixed styles. **C** = T stems
through to the far face (overlap `tB × tA`).

**Measured on `P33-teszt_v2` (ground, 19 walls, thicknesses 104 / 200 / 250 / 300 / 400 mm)** with a
read-only prototype of this table: **27 junctions — 12 L, 15 T, 0 X — only 1 already exact; 33 end
moves, largest 308 mm; 12 of them are exactly half the partner's thickness.** Those 12 are walls
joined *at the partner's centreline* — what the wall tool's centreline snap produces. At an L corner a
centreline joint leaves a missing `tA/2 × tB/2` notch on the outside and a half overlap inside: this is
the "not clean" look the user describes, and the reason the function is worth having. Coordinates
are fractional (the plan was turned 180°, e.g. `5026.7255…`).

**Two traps the prototype hit:**
- **One end, two junctions.** `W15.s0` and `W169.s1` are each the near end of two junctions whose
  targets differ (5 327 vs 5 027 mm — a three-wall meeting). Rule: an end belongs to the junction
  whose partner band is nearest to it; the other junction keeps only its partner's move, and the pair
  is listed as `többszörös csomópont` in the report.
- **Fractional coordinates.** Run a pre-pass that rounds every wall coordinate on the level to 1 mm
  (equal values stay equal, so existing alignment is preserved), then refine — targets are then whole
  millimetres and the next run is idempotent.

**Collinear pairs** (same orientation, bands overlap, ends within TOL of each other): if the band
offset is ≤ 20 mm /*r*/, snap the shorter wall's band onto the longer's and close the end gap
exactly. Larger offsets are deliberate (a step in the wall) — report, do not touch.

**Guards.** Skip and list as "kézi ellenőrzés" any change that moves an end by more than
`max(300, 2 × thickness)` /*r*/, makes a wall shorter than 120 mm (the wall tool's own minimum, 08
line ≈ 127), or would leave an opening outside its wall.

**Bookkeeping — every changed wall** (this is where silent damage happens, README F9):
1. If the **start** coordinate moved by `d` (x0 for horizontal, y0 for vertical): shift every mark
   with `m.wall === r.id` (`u`, `u0`, `u1`) and every wall note of this wall (`u`) by `−d`. Verify
   the wall-note `u` origin in `wvCreate…` (06 line ≈ 512 uses the editor's `u`) before relying on it.
2. Re-key `data.wallNotes[].wallKey` and `data.noteHide` from `wallKey(old)` to `wallKey(new)`
   (06 line 191) — compute every old key **before** mutating anything.
3. Band moved (collinear case only): move openings, and devices hosted on that wall
   (`deviceHostWall`, 05h), by the same perpendicular delta.
4. `SNAP[level]=centerlines(WALLS[level])` once at the end; `reselectAfterSnap()` if a wall was
   selected (never hold a wall reference across the undo).
5. One unscoped `pushUndo()` before the first mutation (walls live in `__walls`, notes and marks in
   `UKEYS`, `noteHide` is snapshotted too).

**Entry points.** Wall right-click (`10-lamps.js` ≈ line 444, next to "🗑 Fal törlése"): "📐 Falak
finomítása (ez a szint)…"; registry action `walls.refine` (`Falak finomítása`, group Szerkezet — the
user's "K control" = Ctrl+K finds it); layer right-click on `L0 Alap` and on any `construct`-role
layer (S1's hook): "📐 Falak finomítása ezen a rétegen…" (restricts to that layer's walls).

**Dialog = dry run first:** counts per type (L · T · X · kollineáris), the largest end move, the
skipped list with wall ids; the changed junctions are drawn in the overlay (a 2 px square outline per
corner square) while the dialog is open; "Alkalmaz" applies, "Mégse" leaves the plan untouched.

**Fixture for spec-66** (one level, 100 mm walls, mm):
```text
A  horizontal  x0=  0  x1=4030  y0=  0  y1=100     L with B, overshoots B's outer face by 30
B  vertical    x0=3900 x1=4000  y0= 20  y1=3000    starts 20 short of A's outer face (0)
C  horizontal  x0=  0  x1=3940  y0=3000 y1=3100    L with B at the bottom, 60 short of B's outer face
D  vertical    x0=1950 x1=2050  y0=100  y1=2960    a partition: T into A at the top (butts A's near face),
                                                   T into C at the bottom (40 short of C's near face)
Expected (Q-G02=A — L corners square, T stems butt):
  A.x1=4000 · B.y0=0 · B.y1=3100 · C.x1=4000 · D.y0=100 (already butt, unchanged) · D.y1=3000
  overlaps: A∩B=[3900,4000]×[0,100] and B∩C=[3900,4000]×[3000,3100] — two 100×100 squares;
            D touches A and C face to face, no overlap; counts L 2 · T 2 · X 0 · moves 5
With Q-G02=C (stems to the far face): D.y0=0, D.y1=3100, everything else the same.
Second fixture, the centreline joint (same A and C, after refine, plus): E vertical x 2950–3050,
y 50–3050 — both ends on the centrelines of A (y 50) and C (y 3050) → E.y0=100, E.y1=3000 (each
move is half of A's / C's 100 mm); counts in that fixture T 2 more.
```

---

## 7. Wide openings (G1)

**Host:** `opnHost(o)` — the wall rect on `o.level` whose band contains `(o.x,o.y)` within
`thick/2 + 220` and whose orientation matches `o.ang` (the same test `bpWallSpans`, 04 line 259,
uses). No host → the old line look.

**Footprint** (plan, mm) along the wall `u ∈ [−w/2, +w/2]`, across the wall `v`:

| | Across the wall | Fill | Lines |
|---|---|---|---|
| **Door** | full thickness, face to face (`v ∈ [−t/2, +t/2]`) | `bgCol()` — reads as a gap in the wall | two jamb lines across the wall at `u = ±w/2` (`NV_PEN.thick`); the leaf as a thin line from the hinge jamb, length `w`, and its quarter-circle swing (`NV_PEN.soft`, dashed `vsDash('4 3')`), by `variant` and `dtype` exactly like `bpDoorSymbol` (04 line 194) |
| **Window** | **inset** `i = clamp(0.12·t, 15, 40)` mm from each face (`v ∈ [−t/2+i, +t/2−i]`) /*r*/ | pale glass `#e3eef8` at 0.85 | the frame outline (`NV_PEN.edge`), and **two** glass lines 6 mm apart along the centre in the window blue `#2f6fb0` (`NV_PEN.soft`) |

So at a glance: a door is a white gap across the whole wall with a swing; a window is a blue-tinted
pane that stops short of both faces, with a double glass line and no arc. Sliding / pocket / double /
fire / opening door types reuse the blueprint symbol shapes with the modelling pens (factor the
blueprint function to take a pen set rather than copying it).

**3D (pitch < 88):** door = two vertical faces at both wall faces from 0 to the head, plus the two
jamb faces, filled `bgCol()`; window = two vertical faces at the inset planes from sill to head
(glass tint, op 0.35) plus jambs. **Top (pitch ≥ 88):** the footprint drawn at wall-top height with a
key bias so it shows through the wall top. **White-out** uses `openingSym()` (04 line 642) — same
footprint, no fill colour.

Build behind `state.openingStyle` (`'line'` = today) so goldens prove the refactor, then flip the
default to `'wide'` and re-baseline once (CONTRACT §2). Add the View panel select "Nyílászárók:
széles / vonal" and a registry action.
