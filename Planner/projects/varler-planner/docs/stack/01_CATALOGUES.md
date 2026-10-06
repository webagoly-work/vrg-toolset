# Stack build pack — CATALOGUES

Data tables, written as JS so a builder can paste them. Each table names the module it lives in.
Values marked `/*r*/` are **reasoned, not measured** — keep the marker as a comment in the code.
Source tags: `A2` = BRIDGE-STD-001-A2 Layer Wiring Reference · `S1` = STD-001 · `S3` = STD-003 ·
`S4` = STD-004 · `S5` = STD-005 · `S8` = STD-008 · `B1` = P33-BUILD-001 · `Qnn` = decision pack default.

---

## §1 Sub-layer categories — `02-state.js` (WP-A1)

`LAYER_CATS` must sit in `02-state.js` directly above `let layers=` because `layers` is built from
it at load time (a const in a later module would be in its TDZ).

```js
const LAYER_CATS=[                          // panel order. opt:true = shown only when the layer has such items [Q02=A]
 {k:'path',  n:'Pályák'},
 {k:'socket',n:'Dugaljak'},
 {k:'switch',n:'Kapcsolók'},
 {k:'light', n:'Lámpák'},
 {k:'device',n:'Eszközök'},                 // every other device: dobozok, elosztó, RBX, BASE, végpontok
 {k:'wall',  n:'Falak'},
 {k:'door',  n:'Ajtók'},
 {k:'window',n:'Ablakok'},
 {k:'stairs',n:'Lépcsők'},
 {k:'object',n:'Tárgyak'},
 {k:'floor', n:'Padló / helyiség',opt:true},
 {k:'roof',  n:'Tetők',opt:true},
 {k:'note',  n:'Jegyzetek',opt:true},
 {k:'cable', n:'Kábelek (régi)',opt:true},
 {k:'mark',  n:'Jelölések',opt:true},
 {k:'trace', n:'Mozgásnyomok',opt:true}];
const LAYER_CATS_V1={device:['socket','switch','light','device'],build:['door','window','stairs','floor','roof']};
function layerCatsAll(on){const o={};LAYER_CATS.forEach(c=>o[c.k]=on!==false);return o;}
```

Item → category (`lyrCatOf(coll, rec)`, WP-A1):

| collection | category |
|---|---|
| `devices` | `lyrDevCat(d)`: `socket`→socket · `switch`→switch · `light`→light · `ep` with code `LMP`/`LNR`→light, `SWI`→switch, `SOC`→socket · everything else → `device` |
| `openings` | its `type` (`door`/`window`/`stairs`) |
| `floors` · `roofs` · `objects` · `paths` · `cables` | `floor` · `roof` · `object` · `path` · `cable` |
| `notes` · `wallNotes` | `note` |
| walls (`WALLS[l]`) | `wall` |
| `marks` · `traces` | `mark` · `trace` |

## §2 Stack roles — `05m-stack.js` (WP-B1)

```js
const STK_ROLES=[      // order = panel order = stage order. fam = default conduit family (§7)
 {k:'construct',  n:'Szerkezet',   ph:1, cats:['wall','floor','door','window','stairs','object'], hint:'Padló, falak, ajtók, ablakok, helyiségek.'},
 {k:'mark',       n:'Jelölés',     ph:1, cats:['mark','trace'], hint:'Szabályok, tiltások, preferenciák, mozgásnyomok.'},
 {k:'hw',         n:'Hardver',     ph:1, cats:['device'], hint:'Elosztószekrény, mérőóra, adatbelépés, RBX dobozok.'},
 {k:'base',       n:'BASE',        ph:1, cats:['device'], hint:'NET · COMP · MEDIA.'},
 {k:'channel',    n:'Csatorna',    ph:1, cats:['path'],   hint:'Fizikai összeköttetés két hardverpont között.'},
 {k:'sys:MAINS',  n:'Erősáram',               ph:2, fam:'MAINS'},
 {k:'sys:LV',     n:'Törpefeszültség — A busz', ph:2, fam:'LV'},
 {k:'sys:BUSB',   n:'Biztosított 24 V — B busz',ph:2, fam:'BUSB'},
 {k:'sys:CONTROL',n:'Vezérlés (BRIDGE_LINK)', ph:2, fam:'CONTROL'},
 {k:'sys:DATA',   n:'Adat / PoE',             ph:2, fam:'DATA'},
 {k:'sys:KNX',    n:'KNX',                    ph:2, fam:'KNX', off:true},   // P33: not taken
 {k:'sys:SENSOR', n:'Érzékelők',              ph:2, fam:'SENSOR'},
 {k:'sys:RF',     n:'Rádió — lefedettség',    ph:2, fam:null},             // a coverage plan, no conduit (A2 step 9)
 {k:'sys:HMI',    n:'Kezelőfelületek',        ph:2, fam:'CONTROL'},
 {k:'sys:MEDIA',  n:'Média és hang',          ph:2, fam:'MEDIA'},
 {k:'sys:USB',    n:'USB',                    ph:2, fam:'USB'},
 {k:'sys:SECURITY',n:'Biztonságtechnika',     ph:2, fam:'SECURITY', last:true}, // always last [user]
 {k:'arm',        n:'ARM pályák',  ph:2, cats:['path'], hint:'Egyvonalas pályák az RBX-től minden végpontig.'}];
```

## §3 Mark tags — `05n-marks.js` (WP-B2, B3)

`pol` = default polarity when the tag is picked (user can change). `rf` = wall loss in dB at
2.4 GHz used by WP-C3 `/*r*/`. `grp` = mutually exclusive group. Colours: polarity colours win;
`c` is used only for `none`.

```js
const MRK_POL={plus:{n:'Előnyös',c:'#2e9e5b',s:'+'},minus:{n:'Kerülendő',c:'#d08a1e',s:'−'},
               ban:{n:'Tilos',c:'#c8372d',s:'⛔'},none:{n:'Semleges',c:'#6f7f95',s:'·'}};
const MRK_TAGS={
 wall:[ // whole wall — material and status
  {k:'tartofal',   n:'Tartófal — nem véshető',          pol:'ban',  rf:15},
  {k:'fofal',      n:'Vastag fal / főfal',               pol:'minus',rf:12},
  {k:'valaszfal',  n:'Vékony válaszfal',                 pol:'none', rf:5},
  {k:'gipszkarton',n:'Gipszkarton / szerelt fal',        pol:'plus', rf:3},
  {k:'elotet',     n:'Előtétfal / installációs fal',     pol:'plus', rf:3},
  {k:'belso',      n:'Belső fal',                        pol:'none'},
  {k:'szomszed',   n:'Szomszéd felé (közös fal)',        pol:'ban',  rf:12},
  {k:'homlokzat',  n:'Homlokzati / külső fal',           pol:'minus',rf:15},
  {k:'gepeszet',   n:'Gépészet a falban (víz, gáz, fűtés)',pol:'ban'},
  {k:'kemeny',     n:'Kémény / szellőzőkürtő',           pol:'ban'},
  {k:'tuzfal',     n:'Tűzfal / tűzszakasz határ',        pol:'minus'},
  {k:'uvegfal',    n:'Üvegfal / üvegtégla',              pol:'ban',  rf:2}],   // low-E glass is 20+ dB — tag it fofal instead
 side:[ // one face of a wall
  {k:'lforma',     n:'L-forma — preferált sarok',        pol:'plus'},          // [user] two adjacent sides tagged together
  {k:'media',      n:'Média / TV fal',                   pol:'plus'},
  {k:'fejveg',     n:'Ágy fejvége',                      pol:'plus'},
  {k:'pult',       n:'Konyhapult fala',                  pol:'plus'},
  {k:'iroasztal',  n:'Íróasztal fala',                   pol:'plus'},
  {k:'butor',      n:'Bútor takarja (szekrény)',         pol:'minus'},
  {k:'ajtolap',    n:'Ajtólap mögé esik',                pol:'minus'},
  {k:'radiator',   n:'Fűtőtest előtte',                  pol:'minus'},
  {k:'csempe',     n:'Csempézett (doboz a csempekiosztáshoz)',pol:'none'},
  {k:'vizes',      n:'Vizes zóna (fürdő 0–2)',           pol:'ban'},
  {k:'disz',       n:'Díszfal / látszó felület',         pol:'minus'}],
 vstrip:[ // vertical 300 mm strip — where a system element goes [user]
  {k:'elo',        n:'Elosztószekrény helye',            pol:'plus'},
  {k:'base',       n:'BASE helye (NET · COMP · MEDIA)',  pol:'plus'},
  {k:'rbx',        n:'RBX helye',                        pol:'plus'},
  {k:'ssc',        n:'Biztonsági központ helye',         pol:'plus'},
  {k:'felszallo',  n:'Felszálló / függőleges nyomvonal', pol:'plus'},
  {k:'kapcsolo',   n:'Kapcsolóoszlop (ajtó mellett)',    pol:'plus'},
  {k:'portal',     n:'Portálpont (ajtókeret mellett)',   pol:'plus'},
  {k:'av',         n:'AV / média oszlop',                pol:'plus'},
  {k:'zona_f',     n:'Szerelési zóna, függőleges (DIN 18015-3)',pol:'plus'}],
 hstrip:[ // horizontal 300 mm strip along the wall [user]
  {k:'labfeny',    n:'Éjszakai / lábfény',               pol:'plus', v:[150,450]},          // [user]
  {k:'dugalj',     n:'Dugaljsáv',                        pol:'plus', v:[150,450]},
  {k:'kapcsolo',   n:'Kapcsolómagasság',                 pol:'plus', v:[950,1250]},
  {k:'pult',       n:'Pult feletti sáv',                 pol:'plus', v:[1050,1350]},
  {k:'szenzor',    n:'Érzékelősáv',                      pol:'plus', v:[2000,2300]},
  {k:'cove',       n:'Mennyezet alatti sáv (rejtett világítás)',pol:'plus', v:[-300,0]},
  {k:'zona_v',     n:'Szerelési zóna, vízszintes (DIN 18015-3)',pol:'plus', v:[-450,-150]},
  {k:'lambazat',   n:'Lábazat / lambéria',               pol:'minus', v:[0,150]}],
 door:[
  {k:'bejarat',    n:'Bejárat — ház-számláló horgony',   pol:'none'},          // S3: the entry door anchors the house count
  {k:'portal',     n:'Portál',                           pol:'none'},
  {k:'p0',n:'P-0 szint',grp:'tier'},{k:'p1',n:'P-1 szint',grp:'tier'},{k:'p2',n:'P-2 szint',grp:'tier'},{k:'p3',n:'P-3 szint',grp:'tier'},
  {k:'lepcso',     n:'Lépcsőportál — szint-számláló horgony',pol:'none'},    // S3/B1: the stairway portal is the second count anchor
  {k:'nyitva',     n:'Mindig nyitva — nem portál',       pol:'none'},          // S3 "habitually open": the two zones merge
  {k:'nemhasznalt',n:'Nem használt / zárva',             pol:'none'},
  {k:'menekulo',   n:'Menekülési útvonal',               pol:'none'},          // S6 alarm_type: life-safety unlocks it
  {k:'kulso',      n:'Külső (terasz / erkély / kert)',   pol:'none'},
  {k:'tolo',       n:'Tolóajtó (a tok falában nincs doboz)',pol:'minus'},
  {k:'uveg',       n:'Üvegajtó',                         pol:'none'},
  {k:'technikai',  n:'Technikai / garázs / kamra',       pol:'none'}],
 window:[ // [user asked for suggestions] — every tag here feeds a later layer
  {k:'nyithato',   n:'Nyitható (bukó-nyíló)',            grp:'open'},
  {k:'fix',        n:'Fix, nem nyitható',                grp:'open'},
  {k:'redony',     n:'Redőny motorral',                  pol:'none'},          // → SHU need in the room (D2)
  {k:'arnyekolo',  n:'Árnyékoló / reluxa / függönymotor',pol:'none'},          // → SHU need
  {k:'nyitaserz',  n:'Nyitásérzékelő kell',              pol:'none'},          // → SEC contact + "fűtés le, ha nyitva"
  {k:'napos',      n:'Napsütötte (D / Ny) — árnyékolás-automatika',pol:'none'},
  {k:'menekulo',   n:'Menekülési nyílás',                pol:'none'},
  {k:'szellozo',   n:'Szellőztető ablak (CO₂ / pára szerint)',pol:'none'},
  {k:'radiator',   n:'Alatta fűtőtest',                  pol:'minus'},         // no box below the sill; thermostat away from it
  {k:'tukrozes',   n:'Tükröződés — képernyő ne nézzen vele szembe',pol:'minus'},
  {k:'kulsoszenz', n:'Kültéri érzékelő helye (fény, eső, hő)',pol:'plus'},
  {k:'vedett',     n:'Fokozott védelem (rács / üvegtörés-érzékelő)',pol:'none'},
  {k:'tetoablak',  n:'Tetőablak',                        pol:'none'}],
 plane:[ // floor and ceiling strips and zones. pl = floor | ceiling | both
  {k:'folyoso',    n:'Közlekedő sáv / folyosó',  pl:'floor',  pol:'none'},     // [user] corridors
  {k:'tartozkodas',n:'Tartózkodási zóna',        pl:'floor',  pol:'none'},     // [user] dwells
  {k:'vizes',      n:'Vizes terület',            pl:'floor',  pol:'ban'},      // [user] water areas
  {k:'butor',      n:'Fix bútor alatt',          pl:'floor',  pol:'minus'},
  {k:'padlofutes', n:'Padlófűtés — nem fúrható', pl:'floor',  pol:'ban'},
  {k:'padlodoboz', n:'Padlódoboz helye',         pl:'floor',  pol:'plus'},
  {k:'agy',        n:'Ágy helye',                pl:'floor',  pol:'none'},
  {k:'ules',       n:'Kanapé / ülőhely',         pl:'floor',  pol:'none'},
  {k:'asztal',     n:'Asztal / sziget',          pl:'floor',  pol:'none'},
  {k:'szintkul',   n:'Lépcső / szintkülönbség',  pl:'floor',  pol:'none'},
  {k:'almennyezet',n:'Álmennyezet — szerelhető', pl:'ceiling',pol:'plus'},
  {k:'beton',      n:'Látszó beton — nem véshető',pl:'ceiling',pol:'ban'},
  {k:'lampasor',   n:'Lámpasor / világítási sáv',pl:'ceiling',pol:'plus'},
  {k:'hangszoro',  n:'Hangszórópár zónája',      pl:'ceiling',pol:'plus'},
  {k:'szenzor',    n:'Érzékelőzóna',             pl:'both',   pol:'plus'},
  {k:'kifuvo',     n:'Klíma / szellőző kifúvó',  pl:'ceiling',pol:'minus'}]};  // keep sensors out of the air stream
const MRK_TRACE_TAGS=[{k:'mozgas',n:'Mozgás'},{k:'atjaras',n:'Átjárás'},{k:'ejszakai',n:'Éjszakai útvonal'},{k:'lepcso',n:'Lépcsőhasználat'}];
const MRK_DEF={strip:300, snap:50};  // [user] default strip width, mm; positions snap to 50 mm
// hstrip v:[a,b] = default height band in mm above the floor; a negative value counts down from the
// ceiling (wall h or LH[level]): [-450,-150] = 450…150 mm below the ceiling (DIN 18015-3 upper zone).
```

## §4 Traces and portal graph — `05o-traces.js` (WP-B4, B5)

```js
const TRC={step:100, ang:45, snapDoor:600, approach:250, rdpEps:50, chaikin:2, freeMin:20};
// step/ang: the 45° line mode moves in 100 mm steps [user]. snapDoor: an end within 600 mm of a door
// centre (on that room's side) attaches to the door [Q16=A]. approach: the attached end sits 250 mm
// inside the room on the door's normal. rdpEps + chaikin: the "smooth" mode [Q17=A]. freeMin: freehand
// samples closer than 20 mm are dropped.
const PRT={grid:500, resample:250};  // [user] 500×500 mm encoding grid; traces resampled every 250 mm first
```

## §5 Endpoint catalogue — `05s-endpoints.js` (WP-D1)

One entry per BRIDGE type code (`S4` §1.2) plus **six proposed codes** marked `new` — they need
adding to STD-004 [Q36]. `role` = the system layer it is placed on. `cat` = sub-layer.
`topo`: `star` = own run from the origin · `chain` = loop-in through the members of a group in order.
`from`: origin of the run — `rbx` (the room's RoomBox) · `board` (Elosztószekrény, never through a
RoomBox — A2 step 1) · `ssc` (security, never into a RoomBox — A2 step 13).
Cables: `{c, w, fam?, n?, from?}` — `c` = §6 key, `w` = the conduit A2 gives for this need on its
own, `fam` overrides the role's family, `n` = count (default 1), `from` overrides the origin.

```js
const EP_CAT=[
 // ---- MAINS ----
 {code:'LMP',role:'sys:MAINS',n:'Lámpa',cat:'light',mount:'ceiling',topo:'chain',from:'rbx',vars:[
   {k:'230',n:'230 V lámpahely',cab:[{c:'NYM3x15',w:'M20'}]}]},
 {code:'SWI',role:'sys:MAINS',n:'Kapcsoló (bemenet)',cat:'switch',mount:'wall',h:1100,topo:'star',from:'rbx',vars:[
   {k:'230', n:'230 V nyomó (RC-szűrt, BRIDGE-DN)',cab:[{c:'NYM3x15',w:'M20'}]},            // default [Q29]
   {k:'selv',n:'SELV nyomó → bistabil bemenet',    cab:[{c:'JY2x2x08',w:'M16',fam:'CONTROL'}]}]},
 {code:'SOC',role:'sys:MAINS',n:'Dugalj',cat:'socket',mount:'wall',h:300,topo:'chain',from:'rbx',vars:[
   {k:'s04',n:'1,5 mm² kör (S04)',cab:[{c:'NYM3x15',w:'M20'}]},
   {k:'25', n:'2,5 mm² kör',      cab:[{c:'NYM3x25',w:'M25'}]}]},
 {code:'DED',new:true,role:'sys:MAINS',n:'Dedikált fogyasztó',cat:'device',mount:'wall',h:300,topo:'star',from:'board',vars:[
   {k:'g16',  n:'16 A — sütő, mosogatógép, mosógép, bojler, klíma, AV',cab:[{c:'NYM3x25',w:'M25'}]},
   {k:'hob32',n:'Indukciós főzőlap 32 A, 1 fázis',cab:[{c:'NYM3x6',w:'M32'}]},
   {k:'hob2l',n:'Indukciós főzőlap 2L+2N / 3 fázis',cab:[{c:'NYM5x25',w:'M25'}]},
   {k:'alelo',n:'Alelosztó betáp, 3 fázis',cab:[{c:'NYM5x6',w:'M32'}]}]},
 {code:'SHU',role:'sys:MAINS',n:'Redőnymotor',cat:'device',mount:'wall',topo:'star',from:'rbx',vars:[
   {k:'230',n:'Fel · le · N · PE',cab:[{c:'NYM4x15',w:'M20'}]}]},
 // ---- LV, bus A ----
 {code:'LNR',role:'sys:LV',n:'LED-vonal / rejtett világítás',cat:'light',mount:'ceiling',topo:'star',from:'rbx',vars:[
   {k:'rov',    n:'Rövid (≤ 5 m, ≤ 2 A)',cab:[{c:'H05_2x15',w:'M20'}]},
   {k:'hosszu', n:'Hosszú / középbetáp (≤ 5 A)',cab:[{c:'H05_2x25',w:'M20'}]}]},
 {code:'UEP',role:'sys:LV',n:'Univerzális végpont',cat:'device',mount:'wall',h:300,topo:'star',from:'rbx',vars:[
   {k:'selv',n:'SELV pár + üres tartalék',cab:[{c:'H05_2x15',w:'M16'},{c:'SPARE',w:'M16'}]},
   {k:'usbc',n:'USB-C töltő (PD modul)',   cab:[{c:'H05_2x15',w:'M16'}]}]},
 // ---- bus B, assured ----
 {code:'LMP',role:'sys:BUSB',n:'Menekülési / lépcső fény',cat:'light',mount:'wall',h:300,topo:'star',from:'rbx',vars:[
   {k:'b',n:'B busz pár',cab:[{c:'H05_2x15',w:'M16'}]}]},
 {code:'LNR',role:'sys:BUSB',n:'Kapaszkodó / lépcső LED',cat:'light',mount:'wall',h:900,topo:'star',from:'rbx',vars:[
   {k:'b',n:'B busz pár',cab:[{c:'H05_2x15',w:'M16'}]}]},
 {code:'NTL',role:'sys:BUSB',n:'Értesítő fény (NTL)',cat:'device',mount:'wall',h:1150,topo:'star',from:'rbx',vars:[   // S8 NL-ST/TR eye level 1100–1200
   {k:'tr',  n:'NL-TR, B busz pár',cab:[{c:'H05_2x15',w:'M16'}]},
   {k:'trd', n:'NL-TR + adatpár',  cab:[{c:'H05_2x15',w:'M16'},{c:'JY2x2x08',w:'M16',fam:'CONTROL'}]}]},
 // ---- CONTROL ----
 {code:'POR',role:'sys:CONTROL',n:'Portál vezérlőpont (RS-485)',cat:'device',mount:'wall',h:2150,topo:'star',from:'rbx',vars:[
   {k:'rs485',n:'J-Y(St)Y 2×2×0,8',cab:[{c:'JY2x2x08',w:'M16'}]},
   {k:'cat',  n:'Cat6A S/FTP',      cab:[{c:'CAT6A_S',w:'M20'}]}]},
 // ---- DATA ----
 {code:'ACP',role:'sys:DATA',n:'WiFi hozzáférési pont',cat:'device',mount:'ceiling',topo:'star',from:'rbx',vars:[
   {k:'poe',n:'1 × Cat6A PoE',cab:[{c:'CAT6A_U',w:'M20'}]}]},
 {code:'ETH',new:true,role:'sys:DATA',n:'Adataljzat',cat:'device',mount:'wall',h:300,topo:'star',from:'rbx',vars:[
   {k:'1',n:'Egyes',cab:[{c:'CAT6A_U',w:'M20'}]},
   {k:'2',n:'Kettős (asztal, médiafal)',cab:[{c:'CAT6A_U',w:'M25',n:2}]}]},
 {code:'CAM',role:'sys:DATA',n:'Kamera',cat:'device',mount:'wall',h:2400,topo:'star',from:'rbx',vars:[
   {k:'poe',n:'Cat6A + LV tartalék',cab:[{c:'CAT6A_U',w:'M20'},{c:'SPARE',w:'M16',fam:'LV'}]}]},
 // ---- KNX (role off by default) ----
 {code:'ACT',role:'sys:KNX',n:'KNX eszköz',cat:'device',mount:'wall',h:1100,topo:'chain',from:'rbx',vars:[
   {k:'knx',n:'YCYM 2×2×0,8 — vonal, soha nem hurok',cab:[{c:'YCYM',w:'M16'}]}]},
 // ---- SENSOR ----
 {code:'SEN',role:'sys:SENSOR',n:'Érzékelő',cat:'device',mount:'ceiling',topo:'star',from:'rbx',vars:[
   {k:'mmwave', n:'Jelenlét (mmWave)',cab:[{c:'LIYCY4x05',w:'M16'}]},
   {k:'co2',    n:'CO₂ / levegőminőség',cab:[{c:'LIYCY4x05',w:'M16'}]},
   {k:'pir',    n:'PIR',cab:[{c:'LIYCY4x05',w:'M16'}]},
   {k:'leak',   n:'Vízszivárgás (padlószint)',cab:[{c:'LIYY2x05',w:'M16'}]},
   {k:'thermal',n:'Hőkamera-tömb (fürdő)',cab:[{c:'CAT6A_S',w:'M20'}]},
   {k:'bed',    n:'Ágy életjel-érzékelő',cab:[{c:'H05_2x15',w:'M16',fam:'LV'},{c:'LIYCY4x05',w:'M16'},{c:'SPARE',w:'M16'}]}]},
 {code:'POR',role:'sys:SENSOR',n:'Portál érzékelő (ToF, nyitás)',cat:'device',mount:'wall',h:2150,topo:'star',from:'rbx',vars:[
   {k:'tof',n:'LiYCY 6×0,25',cab:[{c:'LIYCY6x025',w:'M16'}]},
   {k:'cat',n:'Cat6A S/FTP',  cab:[{c:'CAT6A_S',w:'M20'}]}]},
 // ---- HMI ----
 {code:'PAN',role:'sys:HMI',n:'Kezelőpanel',cat:'device',mount:'wall',h:1450,topo:'star',from:'rbx',vars:[   /*r h*/
   {k:'touch',n:'Érintőpanel (PoE + LV)',cab:[{c:'CAT6A_U',w:'M20',fam:'DATA'},{c:'H05_2x15',w:'M16',fam:'LV'}]},
   {k:'entry',n:'Belépési pont (kód, ujjlenyomat, NFC)',cab:[{c:'CAT6A_S',w:'M20'}]}]},
 {code:'THR',role:'sys:HMI',n:'Termosztát',cat:'device',mount:'wall',h:1500,topo:'star',from:'rbx',vars:[       /*r*/
   {k:'bus',n:'LiYCY 4×0,5',cab:[{c:'LIYCY4x05',w:'M16',fam:'SENSOR'}]}]},
 // ---- MEDIA & AUDIO ----
 {code:'SPK',role:'sys:MEDIA',n:'Hangszóró',cat:'device',mount:'ceiling',topo:'star',from:'rbx',vars:[
   {k:'17',    n:'≤ 17 m — 2×1,5',cab:[{c:'SPK2x15',w:'M16'}]},
   {k:'27',    n:'≤ 27 m — 2×2,5',cab:[{c:'SPK2x25',w:'M20'}]},
   {k:'pair',  n:'Sztereó pár egy kábelen — 4×2,5',cab:[{c:'SPK4x25',w:'M25'}]},
   {k:'sub',   n:'Mélynyomó, vonalszint',cab:[{c:'LINE',w:'M20'}]}]},
 {code:'SCR',new:true,role:'sys:MEDIA',n:'Képernyő',cat:'device',mount:'wall',h:1200,topo:'star',from:'rbx',vars:[
   {k:'aoc', n:'HDMI AOC fix fejjel + Cat6A',cab:[{c:'AOC_FIX',w:'M40'},{c:'CAT6A_U',w:'M20',fam:'DATA'}]},
   {k:'aocd',n:'HDMI AOC levehető fejjel + Cat6A',cab:[{c:'AOC_DET',w:'M25'},{c:'CAT6A_U',w:'M20',fam:'DATA'}]}]},
 {code:'AVP',new:true,role:'sys:MEDIA',n:'AV pozíció',cat:'device',mount:'wall',h:300,topo:'star',from:'rbx',vars:[
   {k:'std',n:'Saját kör + média + 2 × adat',cab:[{c:'NYM3x25',w:'M25',fam:'MAINS',from:'board'},
     {c:'AOC_FIX',w:'M40'},{c:'CAT6A_U',w:'M25',fam:'DATA',n:2}]}]},
 // ---- USB ----
 {code:'USB',new:true,role:'sys:USB',n:'USB adatpont',cat:'device',mount:'wall',h:300,topo:'star',from:'rbx',vars:[
   {k:'u2',n:'USB 2.0 Cat6A extenderrel (nem az IT hálózaton)',cab:[{c:'CAT6A_U',w:'M20'}]},
   {k:'u3',n:'USB 3.x aktív optikai',cab:[{c:'AOC_USB',w:'M25'}]}]},
 // ---- SECURITY (last) ----
 {code:'SEC',new:true,role:'sys:SECURITY',n:'Biztonsági pont',cat:'device',mount:'wall',h:2200,topo:'star',from:'ssc',vars:[
   {k:'det',    n:'Mozgásérzékelő',cab:[{c:'ALARM6',w:'M16'}]},
   {k:'contact',n:'Nyitásérzékelő',cab:[{c:'ALARM6',w:'M16'}]},
   {k:'siren',  n:'Kültéri sziréna',cab:[{c:'SIREN4',w:'M16'}]},
   {k:'keypad', n:'Kezelő / buszeszköz',cab:[{c:'BUS4',w:'M16'}]}]}];
```

## §6 Cables and conduits — `05w-fill.js` (WP-E3)

```js
// od = outer diameter, mm — the UPPER end of A2 §2.2's range ("size up when in doubt").
// minW = smallest conduit the PLUG passes (A2: "the plug is the limit").
const AFILL_CABLES={
 NYM3x15:{n:'NYM-J 3×1,5',od:9},   NYM3x25:{n:'NYM-J 3×2,5',od:10.5}, NYM4x15:{n:'NYM-J 4×1,5',od:10},
 NYM5x25:{n:'NYM-J 5×2,5',od:12},  NYM3x6:{n:'NYM-J 3×6',od:13.5},    NYM5x6:{n:'NYM-J 5×6',od:16},
 H05_2x15:{n:'H05VV-F 2×1,5',od:7.5}, H05_2x25:{n:'H05VV-F 2×2,5',od:9},
 JY2x2x08:{n:'J-Y(St)Y 2×2×0,8',od:5.5}, JY4x2x08:{n:'J-Y(St)Y 4×2×0,8',od:7},
 LIYCY4x05:{n:'LiYCY 4×0,5',od:6}, LIYCY6x025:{n:'LiYCY 6×0,25',od:5.5/*r*/}, LIYY2x05:{n:'LiYY 2×0,5',od:4.5/*r*/},
 YCYM:{n:'YCYM 2×2×0,8 (KNX)',od:5.5},
 CAT6A_U:{n:'Cat6A U/FTP',od:7.5}, CAT6A_S:{n:'Cat6A S/FTP',od:8},
 AOC_FIX:{n:'HDMI AOC, fix fej',od:4.5,minW:'M40'}, AOC_DET:{n:'HDMI AOC, levehető fej',od:4.5,minW:'M25'},
 AOC_USB:{n:'USB 3.x AOC',od:5/*r*/,minW:'M25'},
 SPK2x15:{n:'Hangszóró 2×1,5',od:6.5}, SPK2x25:{n:'Hangszóró 2×2,5',od:7.5}, SPK4x25:{n:'Hangszóró 4×2,5',od:10},
 LINE:{n:'Árnyékolt vonalkábel',od:6/*r*/},
 ALARM6:{n:'Riasztó 4×0,22+2×0,5 árny.',od:5.5}, SIREN4:{n:'Sziréna 2×0,75+2×0,22 árny.',od:6/*r*/},
 BUS4:{n:'Szolgáltatói 4 eres busz',od:5/*r*/},
 SPARE:{n:'Üres cső + behúzószál',od:0,empty:true}};
// flexible light conduit, inner diameter mm (A2 §2.1 — typical, check the datasheet)
const AFILL_CONDUITS=[{k:'M16',id:10.7},{k:'M20',id:14.1},{k:'M25',id:18.3},{k:'M32',id:24.3},
                      {k:'M40',id:31.2},{k:'M50',id:39.6},{k:'M63',id:52.6}];
const AFILL_RULE={single:1.4, fill:0.40, fillLong:0.33, longMm:10000, slackPerEnd:500};
// single: one cable needs ID ≥ 1.4 × OD · fill: Σ cable area ≤ 40 % of the bore · fillLong: 33 % when the
// pipe is longer than 10 m (A2 §1; the two-bend half of that rule needs bend counting — not in v1)
```

## §7 Conduit families and route sharing — `05w-fill.js` (WP-E3)

```js
// cls = sharing class of A2 §5
const AFILL_FAMS={MAINS:{n:'Erősáram',cls:'mains'},LV:{n:'A busz (SELV)',cls:'selvp'},BUSB:{n:'B busz (biztosított)',cls:'selvp'},
  CONTROL:{n:'Vezérlés',cls:'sig'},DATA:{n:'Adat',cls:'sig'},KNX:{n:'KNX',cls:'sig'},SENSOR:{n:'Érzékelő',cls:'sig'},
  MEDIA:{n:'Média',cls:'sig'},USB:{n:'USB',cls:'sig'},SECURITY:{n:'Biztonság',cls:'sec'}};
// A2 §5, one entry per unordered pair of classes found on the SAME route segment
const AFILL_SHARE={'mains|selvp':'warn','mains|sig':'warn','mains|sec':'warn',
  'selvp|sig':'ok','selvp|sec':'ok','sig|sec':'ok','mains|mains':'ok','selvp|selvp':'ok','sig|sig':'ok','sec|sec':'ok'};
// warn text: 'Erősáram és törpefeszültség egy nyomvonalon: ≥ 50 mm távolság vagy rögzített fémválaszfal, keresztezés 90°-ban (A2 §5).'
```
Hard rules the fill enforces regardless of the table: **two families never share a pipe**; **LV and
BUSB never share a pipe** (they are separate families already); `SPARE` is always its own empty pipe.
(12 V and 24 V in separate pipes is an A2 rule v1 does not model — the catalogue has no voltage
split. Logged as follow-up F3 in the README.)

## §8 Room kinds and default needs — `05t-needs.js` (WP-D2)

```js
// kind is matched against the accent-folded, lower-cased room name; first match wins; rm.kind overrides.
const NEED_KINDS=[
 {k:'eloszoba', n:'Előszoba',  re:/eloszob|bejarat|hall\b/},
 {k:'konyha',   n:'Konyha',    re:/konyh/},
 {k:'etkezo',   n:'Étkező',    re:/etkez/},
 {k:'nappali',  n:'Nappali',   re:/nappal|living/},
 {k:'halo',     n:'Háló / szoba',re:/halo|szoba|gyerek|bedroom/},
 {k:'dolgozo',  n:'Dolgozó',   re:/dolgoz|iroda|office/},
 {k:'furdo',    n:'Fürdő',     re:/furd|zuhany|bath/},
 {k:'wc',       n:'WC',        re:/\bwc\b|mosdo|toalett/},
 {k:'kamra',    n:'Kamra / tároló',re:/kamra|spajz|tarolo|gardrob/},
 {k:'kozlekedo',n:'Közlekedő', re:/kozleked|folyoso|lepcso/},
 {k:'kulter',   n:'Terasz / erkély',re:/terasz|erkely|kert|loggia/},
 {k:'gepeszet', n:'Gépészet / garázs',re:/gepesz|kazan|garazs|mosokonyha/},
 {k:'egyeb',    n:'Egyéb',     re:/.*/}];
// default ticks: kind → role → codes. "@" entries are DERIVED from Phase 1 marks, not fixed (WP-D2 §derive).
const NEED_DEFAULTS={
 '*':        {'sys:MAINS':['LMP','SWI','SOC'],'sys:SENSOR':['SEN'],'sys:RF':['wifi','thread'],'sys:MEDIA':['SPK']},
 eloszoba:   {'sys:BUSB':['LMP'],'sys:HMI':['PAN'],'sys:DATA':['CAM'],'sys:SECURITY':['SEC'],'sys:MEDIA':[]},
 konyha:     {'sys:MAINS':['DED'],'sys:LV':['LNR'],'sys:SENSOR':['SEN'],'sys:RF':['wifi','thread','uwb']},
 etkezo:     {'sys:RF':['wifi','thread','uwb']},
 nappali:    {'sys:LV':['LNR','UEP'],'sys:DATA':['ETH','ACP'],'sys:HMI':['PAN','THR'],'sys:MEDIA':['SPK','SCR','AVP'],'sys:USB':['USB'],'sys:RF':['wifi','thread','uwb']},
 halo:       {'sys:LV':['UEP'],'sys:DATA':['ETH'],'sys:HMI':['THR']},
 dolgozo:    {'sys:LV':['UEP'],'sys:DATA':['ETH'],'sys:USB':['USB']},
 furdo:      {'sys:LV':['LNR'],'sys:HMI':['THR']},            // SEN variant thermal + leak — D3 suggests the variant
 wc:         {'sys:MAINS':['LMP','SWI'],'sys:MEDIA':[]},       // no socket by default
 kamra:      {'sys:MAINS':['LMP','SWI'],'sys:SENSOR':[],'sys:MEDIA':[],'sys:RF':[]},
 kozlekedo:  {'sys:MAINS':['LMP','SWI'],'sys:BUSB':['LMP','NTL'],'sys:MEDIA':[]},
 kulter:     {'sys:MAINS':['LMP','SOC'],'sys:DATA':['CAM'],'sys:SENSOR':[],'sys:MEDIA':[],'sys:RF':[]},
 gepeszet:   {'sys:MAINS':['LMP','SWI','SOC','DED'],'sys:SENSOR':['SEN'],'sys:MEDIA':[]},
 egyeb:      {}};
// merge rule: start from '*', then the kind's entries REPLACE the role's list ([] = nothing ticked).
// derived ticks (added on top, shown with a ⚙ mark so the user sees why):
//  SHU      if a window in the room has tag redony or arnyekolo
//  NTL      (sys:BUSB) if a door of the room has tag portal, bejarat or lepcso   — S8 NL-TR beside every portal
//  POR      (sys:CONTROL and sys:SENSOR) if a door of the room has tag p2 or p3
//  SEC      if the room has an opening tagged kulso, bejarat, nyitaserz or vedett
//  LMP      (sys:BUSB) if the room holds a trace tagged ejszakai or lepcso
```

## §9 RF technologies and wall loss — `05q-rf.js` (WP-C3)

Model: **COST-231 multi-wall**, simplified — `PL(d) = PL1 + 10·pe·log10(d) + Σ wall loss`, `d` in m
(min 0.5). A cell is covered when `PL ≤ PL1 + 10·pe·log10(R0)`, i.e. `R0` is the free-space range.
All values `/*r*/` — typical indoor figures, not measured; they are user-editable in the RF panel.

```js
const RF_TECH=[
 {k:'wifi',  n:'WiFi 2,4 GHz',   c:'#3b82c4', R0:20, pe:2.2, f:1.0,  src:['acp']},
 {k:'wifi5', n:'WiFi 5 GHz',     c:'#2a5f99', R0:12, pe:2.4, f:1.6,  src:['acp'], off:true},
 {k:'thread',n:'Thread (ch 20)', c:'#3fa36b', R0:15, pe:2.3, f:1.0,  src:['rbx']},   // S5 channel plan
 {k:'zigbee',n:'Zigbee (ch 25)', c:'#7aa63a', R0:15, pe:2.3, f:1.0,  src:['rbx'], off:true},
 {k:'ble',   n:'BLE',            c:'#8a63c2', R0:10, pe:2.2, f:1.0,  src:['rbx']},
 {k:'uwb',   n:'UWB',            c:'#c2638a', R0:10, pe:2.0, f:1.5,  src:['rbx']},   // NLOS hurts ranging: walls ×1.5
 {k:'espnow',n:'ESP-NOW (ch 1)', c:'#c28a3b', R0:20, pe:2.2, f:1.0,  src:['rbx','base']},
 {k:'lora',  n:'LoRa 868 MHz',   c:'#8a8a8a', R0:80, pe:2.0, f:0.6,  src:['base'], off:true}]; // S5: BASE-only (1 % duty)
// pe = path-loss exponent. f = multiplier on wall loss (5 GHz and UWB lose more per wall; 868 MHz less).
// wall loss without a material tag, by thickness: ≥ 250 mm → 12 dB · 120–249 → 8 · < 120 → 4.  /*r*/
// with a tag: MRK_TAGS.wall[].rf. Glass (uvegfal) 2 dB — coated low-E glass is 20+: tag it fofal.
const RF_GRID=500;           // mm — same grid as the portal encoding
const RF_RBX_RADIOS=['thread','ble','espnow'];   // default radios of a new RBX; 'uwb' added in key rooms (S5/U23)
```

## §10 Hardware — `05p-hardware.js` (WP-C1, C2, C4) · `05r-channel.js` (WP-C5)

```js
const HW_TYPES={rbx:'RoomBox (RBX)',base:'BASE',meter:'Mérőóra',entry:'Adatbelépési pont',ssc:'Biztonsági központ (SSC)'};
// RoomBox classes, w × h × d mm (Outline §3). RB-E is its own class family; size as RB-M until STD-001 fixes it.
const HW_RB={'RB-M':[400,500,110],'RB-L':[500,600,110],'RB-H':[600,600,120],
             'RB-E':[400,500,110],'RB-O':[400,500,150],'RB-S':[300,400,110]};
const HW_RB_DEF='RB-M';
const HW_BASE_UNITS={NET:{n:'NET — kommunikáció',c:'#3b82c4'},COMP:{n:'COMP — koordinátor',c:'#3fa36b'},
                     MEDIA:{n:'MEDIA — tárolás, streamek',c:'#c2638a'}};
const HW_BASE_SIZE=[600,1800,400];   /*r*/ // one column, units stacked; real size comes from the joinery design
// guidance shown while placing BASE (WP-C4). sev = what a violation raises.
const HW_BASE_RULES=[
 {k:'dry',    sev:'error',n:'BASE nem kerülhet vizes helyiségbe (környezet: nedves / vizes).'},
 {k:'board',  sev:'warn', n:'BASE az Elosztószekrény közelében: PANEL LINK + 2–3 rendszerkör. Javasolt ≤ 8 m.', mm:8000 /*r*/},
 {k:'entry',  sev:'info', n:'NET az adatbelépési pont közelében.', mm:10000 /*r*/},
 {k:'column', sev:'warn', n:'NET · COMP · MEDIA egy oszlopban (≤ 1 m), hacsak nem szándékosan osztott (LAYER TIE).', mm:1000},
 {k:'centre', sev:'info', n:'A szint közepéhez közel: jobb rádiós lefedettség és UWB/BLE helymeghatározás.'},
 {k:'strip',  sev:'info', n:'Jelölt „BASE helye” sávban.'},
 {k:'cat6a',  sev:'error',n:'Minden RBX ≤ 90 m Cat6A nyomvonalon (állandó link, ISO/IEC 11801).', mm:90000}];
```

Carrier of a channel route, derived from the device types at its two ends (order-free).
`content` is what WP-E4 fills in.

```js
const CHN_CARRIERS=[
 {pair:['meter','board'], k:'feed',    n:'Fővezeték'},
 {pair:['entry','base'],  k:'isp',     n:'Szolgáltatói belépés'},
 {pair:['board','base'],  k:'panel',   n:'PANEL LINK + rendszerkörök'},
 {pair:['base','rbx'],    k:'channel', n:'CHANNEL köteg'},
 {pair:['rbx','rbx'],     k:'channel', n:'CHANNEL köteg (lánc)'},
 {pair:['board','rbx'],   k:'mains',   n:'Erősáramú szobakörök'},
 {pair:['board','ssc'],   k:'mains',   n:'SSC körök'},
 {pair:['ssc','rbx'],     k:'security',n:'Biztonsági törzs'},
 {pair:['base','ssc'],    k:'data',    n:'SSC adat (VLAN 50)'}];
// the CHANNEL bundle, S1 §3.1 — fixed order, fixed sizes
const CHN_BUNDLE=[
 {k:'C1', fam:'DATA',   w:'M25', cab:[{c:'CAT6A_U',n:2}]},
 {k:'C2', fam:'MEDIA',  w:'M40', cab:[{c:'AOC_FIX'},{c:'CAT6A_U'}]},
 {k:'C3', fam:'CONTROL',w:'M20', cab:[{c:'CAT6A_S'}]},
 {k:'C4', fam:null,     w:'M25', cab:[{c:'SPARE'}]},
 {k:'C4b',fam:'BUSB',   w:'M20', cab:[{c:'H05_2x25'}]},
 {k:'C5', fam:'KNX',    w:'M20', cab:[{c:'SPARE'}], note:'KNX / DALI tartalék, üresen beépítve'}];
```

## §11 Placement suggestions — `05t-needs.js` (WP-D3)

Each rule produces ghost hints for a code while that code is being placed. `anchor` names a function
WP-D3 implements. Heights in mm. All `/*r*/` unless sourced.

```js
const SUG_RULES=[
 {code:'SWI', anchor:'doorHandle',  h:1100, off:150, n:'Kilincs felőli oldal, 150 mm-re a tokól'},
 {code:'SOC', anchor:'hband',       h:300,  n:'Dugaljsáv a + jelölt oldalakon, L-forma előnyben'},
 {code:'LMP', anchor:'roomCentre',  n:'Mennyezet közepe / lámpasor sáv'},
 {code:'SEN', anchor:'farCorner',   h:2200, n:'Az ajtóval átlós sarok, 2000–2300'},
 {code:'POR', anchor:'doorLintel',  h:2150, n:'Ajtó szemöldök fölött (ToF pár)', src:'S3'},
 {code:'NTL', anchor:'doorFlank',   h:1150, off:200, n:'Minden portál mellett', src:'S8'},
 {code:'SHU', anchor:'windowTop',   off:100, n:'Ablak fölött, redőnytokban'},
 {code:'PAN', anchor:'doorHandle',  h:1450, off:300, n:'Bejárat mellett, kilincs felől'},
 {code:'THR', anchor:'innerWall',   h:1500, n:'Belső fal, ablaktól és fűtőtesttől távol'},
 {code:'SPK', anchor:'ceilingPair', n:'Mennyezeti pár, a hallgatási pontra szimmetrikus'},
 {code:'ACP', anchor:'coverageGap', n:'Mennyezet, a WiFi lefedettség hiányának közepe'},
 {code:'LNR', anchor:'hstripTag',   tag:'cove', n:'Mennyezet alatti sáv'},
 {code:'LMP', role:'sys:BUSB', anchor:'traceTag', tag:'ejszakai', h:300, n:'Éjszakai útvonal mentén, lábfény magasság'},
 {code:'RBX', anchor:'vstripTag',   tag:'rbx', n:'Jelölt „RBX helye” sáv'},
 {code:'*',   anchor:'avoid',       n:'Tilos / kerülendő jelölés: piros / narancs takarás'}];
```

## §12 Elosztószekrény rules — `05x-cabinet.js` (WP-E5)

Defaults are P33's settled answers (B1 §14, K31/K32). Ratings `/*r*/` — typical, check against the
design; `05j` circuits that already carry an `mcb` keep theirs.

```js
const ELO_RULES={
 perWay:'rcbo',            // K31: one 1-module RCBO on every way; 'rcd' = grouped RCDs instead [Q33]
 rcbo:{type:'A',ma:30,mod:1},
 rcd:{type:'A',ma:30,amps:40,mod:2,maxWays:4},       /*r*/ // only when perWay==='rcd'
 sys:{base:2, ssc:2, pack:1},                        // B1 §14.3: BASE ×2, SSC ×2, assured pack ×1
 lightPerRbx:1,                                      // B1 §14.3
 socketGroupsPerRbx:1, socketKitchen:3,              // S04 trimmed (B1 §14.2): kitchen 3, other rooms 1 per RBX
 mcb:{lighting:'1C 10A', socket15:'1C 13A', socket25:'1C 16A', g16:'1C 16A', hob32:'1C 32A', hob2l:'2× 1P-N C16A', sys:'1C 10A', alelo:'3C 25A'}, /*r*/
 feed:{ '1f':[{n:'Főkapcsoló 2P',mod:2},{n:'Túlfeszültség-védelem 1P+N (T1+T2)',mod:2}],
        '3f':[{n:'Főkapcsoló 4P',mod:4},{n:'Túlfeszültség-védelem 3P+N (T1+T2)',mod:4}] },
 bell:{n:'Moduláris csengő',mod:1,on:true},
 phase:'3f',               // K32: build three-phase-ready
 rowModules:12, spareMin:2,
 // typical connected load per way, kW — B1 §14.4 (reasoned on typical ratings; BUILD-002 replaces with nameplates)
 kw:{hob2l:7.4, hob32:7.4, g16:2.0, oven:3.5, washer:2.2, dishwasher:2.0, bojler:2.0, klima:1.2, avp:0.5,
     socketKitchen:1.0, socket:0.7, light:0.15, sys:0.1}};   /*r*/ // kitchen 3.0 kW over 3 circuits; "other sockets 2.0" over ~3
// a DED device's kw: by its name/ref keyword (sütő→oven, mosogató→dishwasher, mosógép→washer, bojler, klíma),
// else ELO_RULES.kw[var]. Hob on 3f: half of hob2l on each of its two ways.
```
