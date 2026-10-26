# Gyakorló lakás — the practice apartment (2026-10-26)

An invented flat for practising the wireway work (Pályák) by hand. About 77 m² clear, 10 rooms. It holds one of every
wall, corner and door situation that has caused trouble so far, and a minimal stock Erősáram job. It is not client data,
so it lives in git.

**Open it:** Projekt ▾ → 📥 Fájl import → `tools/practice/Gyakorlo_lakas.vplan.json`.
**Rebuild it:** `node tools/practice/build-gyakorlo.js` (from `Planner/projects/varler-planner`, after `node build.js`).
It writes the plan and `build-report.json` (walls, switches, circuits, the log).

The build uses the Planner's own workflow functions in phase order, the same calls the buttons make (since 2026-10-26 the
workflow bar creates a **Villany Stack**). **It stops before
Pályák.** Nothing is set on the rules either: no Vezethető fal (R2), no marks (R3). Those are the hand work.

## Layout (x → east, y → south, clear sizes in mm)

| Room | Kind | Clear outline |
|---|---|---|
| HÁLÓ | háló | L-shape: 3800 × 4000 minus the gardrób corner (0–1500, 2500–4000) |
| GARDRÓB | kamra | 0–1300 × 2700–4000 |
| GYEREKSZOBA | háló | 4000–7000 × 0–4000 |
| NAPPALI · ÉTKEZŐ | nappali + étkező | 7200–11400 × 0–7600, minus the balcony notch (9600–, –1800) and the kitchen (–9600, 5400–) |
| KONYHA | konyha | 7200–9400 × 5600–7600 |
| FÜRDŐSZOBA | fürdő | 0–2600 × 4200–7600 |
| WC | wc | 2800–3800 × 5600–7600 |
| KÖZLEKEDŐ | közlekedő | 2800–7000 × 4200–5400 (1200 wide) |
| ELŐSZOBA | előszoba | 4000–7000 × 5600–7600, the front door in its south wall |
| ERKÉLY | kültér | 9900–11700 × −300–1500, in the notch, outside the house walls |

Walls: 300 outside, 200 inside, made by **Falak létrehozása** from the clear outlines. There are no shifts, steps or
skipped edges: the outlines were drawn 200 apart, so every gap is exactly one inner wall. The zuhanyfal is 100 thick and
hand-drawn.

## The practice cases

| Case | Where |
|---|---|
| **X junction** (4 rooms meet) | (7100, 5500): nappali · konyha · közlekedő · előszoba |
| **T junctions** | háló / gyerek wall onto the corridor's north wall (3900, 4100); WC / előszoba wall onto its south wall (3900, 5500) |
| **Two T's 1300 apart, from opposite sides** | gardrób wall (x 1400, from the north) and fürdő wall (x 2700, from the south) on the y 4100 wall |
| **Concave outer corner** (step in the façade) | the balcony notch: walls W11 / W24 meet at (9900, 1500) |
| **L-shaped room** | HÁLÓ (round the gardrób) |
| **8-cornered room** | NAPPALI · ÉTKEZŐ: two concave corners (balcony + kitchen notch) |
| **Room in a room's corner** | GARDRÓB inside the háló's L, windowless |
| **Free-ended wall** | zuhanyfal in the fürdő, (1450, 6400 → 7600), its north end free |
| **Door jamb flush with a corner** | háló door: its west jamb is the corridor's end wall (x 2800) |
| **Door 200 from a corner** | gyerekszoba door (east jamb at 6800, corner 7000) |
| **Short piers both sides** | WC door: 100 / 200 mm piers in a 1000 wall |
| **Door in a short end wall** | fürdő and nappali doors in the corridor's 1200 end walls |
| **Doors facing each other** | WC door under the háló door across the corridor |
| **Pocket door** | konyha (falba futó tolóajtó) |
| **Double door** | előszoba ↔ közlekedő (kétszárnyú, 1400) |
| **Wall opening, no frame** | konyha ↔ nappali falnyílás, 1600 |
| **Outward-opening door** | WC (into the corridor) |
| **Corner window pair** | háló north + west, each 400 from the corner |
| **Two windows on one wall** | nappali east wall |
| **Window 300 from a step corner** | nappali north window next to the balcony notch |
| **French door to outside** | erkélyajtó (a window type, sill 0): no door slots, switch placed by hand |
| **Windowless rooms** | WC (fan socket at 1900), gardrób |
| **Outdoor room** | ERKÉLY (kind kültér), added after the walls |

## Erősáram (stock job)

**63 points:** 15 lamps · 15 switches · 25 sockets · 6 dedicated · 1 roller-shutter motor · 1 Elosztó. Heights come
from the Standards table.

**Switch types, one or more of each:**
- **101**: gardrób, gyerek, WC.
- **105**: konyha (ceiling + munkafény); fürdő (ceiling + tükör, outside the door).
- **106**: háló door + bed; előszoba front door + double door.
- **107**: the corridor's middle switch in a 106 – 107 – 106 chain.
- **108**: bedside (shared ceiling + reading lamp); both nappali switches.
- **redőny**: gyerekszoba.

Every door switch sits in its door's latch slot (L1) on the room's face. The fürdő and WC switches are outside, in the
corridor.

**Elosztó:** EL1 in the előszoba, west wall, h 1500.

**Circuits:** the Elosztó's own suggestion (E4), all rows ticked. I made one change: the gardrób's single socket joins
the háló circuit instead of getting its own. That gives 16 circuits:

| Kind | Circuits |
|---|---|
| bedroom sockets | A1 HÁLÓ · GARDRÓB (13 A), A2 GYEREKSZOBA (13 A) |
| large room, split | A3 / A4 NAPPALI · ÉTKEZŐ I / II (16 A) |
| worktop | A5 KONYHA munkalap (16 A) |
| wet room | A6 FÜRDŐSZOBA (16 A) |
| outdoor | A7 ERKÉLY (16 A) |
| small rooms by adjacency | A8 KONYHA (hűtő, páraelszívó) · ELŐSZOBA · WC · KÖZLEKEDŐ (13 A) |
| dedicated | A9 főzőlap 32 A · A10 sütő · A11 mosogatógép · A12 mosógép · A13 bojler · A14 klíma (16 A each) |
| lighting | V1 nappali zóna · V2 éjszakai zóna (10 A) |

## Left for hand work

R2 Vezethető fal · R3 marks (munkalap, médiafal, ágy zóna, fürdő zones) · Szobadoboz · the betáp-fa (`up`) · Pályák ·
Vezetékek.

## Watch out

- **Falak létrehozása re-run** walls in the ERKÉLY on all four sides. It was added after the walls on purpose. If you
  re-run it, delete the balcony's new walls (or the balcony room first, then redraw it).
- The zuhanyfal is hand-drawn (no `gen:'wfw'`), so a re-run keeps it.

## The fully stacked versions (2026-10-26)

`node tools/practice/build-gyakorlo-stack.js` (after `build-gyakorlo.js`) writes two more plans. Both carry endpoints and
"Elosztó" units only. **No path is drawn on any layer.** Less is more: each layer gets one to five points, enough to show
what lives on it.

**`Gyakorlo_lakas_villany.vplan.json`: the Villany Stack (V1), every layer**

| Layer | What is on it |
|---|---|
| Jelölés | the bejárat mark |
| Igények | the nappali and háló room lists (the suggestion, taken as is) |
| Meglévő / bontás | old socket in the háló (megmarad), old ceiling lamp in the nappali (cserélendő, next to the new L5), old switch and old socket in the corridor (bontandó), and an old surface cable run along the corridor (bontandó, red dashed) |
| Betáplálás és elosztás | EL1 · mérőóra (outside, by the front door) · ISP · **MDB** médiadoboz · **SSC** riasztóközpont (gardrób) · **TJK** tűzjelző központ · **EPH** fő EPH sín |
| Dedikált · Dugaljak · Világítás | the Erősáram job above, unchanged |
| Gyengeáram | TV / SAT + data on the nappali media wall, TV / SAT in the háló, data at the gyerekszoba desk, doorbell push outside, intercom in the előszoba |
| Érintésvédelem / EPH | the fürdő's local bar, the bath, the kitchen pipes |
| Riasztó | keypad, front-door contact, nappali corner motion detector, indoor siren (cable only) |
| Tűzvédelem | smoke in the corridor and the nappali, heat in the konyha, call point and sounder (red pairs, own conduit) |
| Veszélyérzékelők | gas (high, natural gas) and heat alarm in the konyha, water leak under the sink and on the fürdő floor |
| Nyomvonal és dobozok | empty: the paths are the hand work |
| Okos előkészítés | a neutral box behind the nappali door switch, a deep box in the gyerekszoba, spare conduit on the media wall |

**`Gyakorlo_lakas_bridge.vplan.json`: the same stack promoted to BRIDGE (V8), plus one example per BRIDGE-only layer**

The promotion is one step (Stack menu → *Bővítés BRIDGE Stackké*), and it duplicates nothing:
- Gyengeáram dissolves by purpose: TVA → Média, ETH → Adat, BEL / ICM → Biztonság.
- Riasztó → Biztonságtechnika. The points stay *cable only*.
- The empty Nyomvonal goes away. Csatorna and ARM take its place.
- Meglévő, EPH, Tűzvédelem and Okos előkészítés stay as they are.

On top of that:

| Layer | Example |
|---|---|
| Hardver | 4 RBX (nappali + gyerek · háló + fürdő · előszoba + konyha · közlekedő + WC; gardrób and erkély left without one on purpose) · 5 portals (front door, nappali and háló doors, every room face) |
| BASE | NET · COMP · MEDIA in the gardrób |
| Csatorna · ARM | empty (paths) |
| Törpefeszültség A | LED line, nappali cove |
| Biztosított 24 V B | orientation light in the corridor |
| Vezérlés | portal control point at the front door |
| Adat / PoE | WiFi AP in the corridor (+ the two moved ETH) |
| Érzékelők | mmWave presence in the nappali |
| Rádió | coverage only, no points |
| Kezelőfelületek | touch panel in the nappali, thermostat in the háló |
| Média és hang | ceiling speaker in the nappali (+ the two moved TVA) |
| USB | gyerekszoba desk |
| Biztonságtechnika | the moved Riasztó, doorbell and intercom points |
| Klaszterpontok | 5, opened automatically beside the new endpoints |
| Extrák és ötletek | phone-holder charger by the bed |

Also in both versions:
- a **switch-sensor** (jelenlét, 2200) in the WC: the lamp works on its own, and the corridor switch K10 is set to *Kizárás* (KI / AUTO);
- **IP44** on the balcony socket and lamp, given automatically;
- **1P+N** on the two circuits that reach the balcony (the V7 suggestion, applied);
- the **Áramkörök és védelem** stage, now clean.

KNX and Házimozi are off by default and left out. The layer checks list what is still missing in each room ("hiányzik …").
That is expected in an example this small.
