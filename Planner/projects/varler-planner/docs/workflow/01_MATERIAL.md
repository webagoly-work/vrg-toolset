# Workflow round (WF) — MATERIAL

Paste-ready content. A WP names the sections it needs; read only those.

---

## §1 Control model — the room pen (F1, F2)

References the user named, and what each gives:

| Source | What we take |
|---|---|
| Google Maps distance tool | click, click, click; live running length; click the first point to close → area. (Our Floor tool already does this.) |
| Prison Architect (building tool) | drag a **rectangle** to make a room in one gesture; walls are "built" afterwards as a separate step (walls without foundation look unfinished); foundations fill the inside |
| The Sims build mode | grab a wall **segment** and drag it sideways — every room that shares it follows |

Pen controls (Hungarian hint text in WP-F1):

| Input | Action |
|---|---|
| LMB click | add a node (snapped: 45° direction lock from the previous node, length to `penTick` 100 mm) |
| LMB hold + drag (no node yet) | rectangle room in one gesture (Prison Architect), corner to corner, 100 mm grid |
| click the first node | close → room created (stage `outline`), name prompt skipped (name later via the wheel) |
| Enter | close the open polyline |
| Backspace | remove the last node |
| Shift (hold) | free angle (lock off) |
| type digits while drawing | exact length of the current segment (in **inner** mm under Q-F01 A), Enter to apply |
| Esc | cancel the open draft (contract: Esc steps out — the draft is the innermost level) |
| hover an existing room edge | the node snaps onto it → marks a **shared wall** |

Live label at the cursor: `3 600 mm` (segment) · after close: `Kerület 14,40 m · Terület 12,96 m²`.

## §2 Room-type wheels (R1)

Source of truth: `NEED_KINDS` (05t-needs.js:18). Sector 0 = up (North), clockwise; **South (sector 4) = "Továbbiak"**
opens the next ring. Draft order (Q-R01 lets the user reorder):

| Sector | Ring 1 | Ring 2 | Ring 3 |
|---|---|---|---|
| 0 N | Nappali `nappali` | Étkező `etkezo` | Terasz / erkély `kulter` |
| 1 NE | Konyha `konyha` | Dolgozó `dolgozo` | Egyéb `egyeb` |
| 2 E | Háló / szoba `halo` | Kamra / tároló `kamra` | — |
| 3 SE | Fürdő `furdo` | Gépészet / garázs `gepeszet` | — |
| **4 S** | **Továbbiak ›** | **Továbbiak ›** | **‹ Vissza** |
| 5 SW | WC `wc` | Gyerekszoba ⚑ (new kind → `halo` defaults + `gyerek` flag) | — |
| 6 W | Előszoba `eloszoba` | Gardrób ⚑ (new kind → `kamra` defaults) | — |
| 7 NW | Közlekedő `kozlekedo` | Mosókonyha ⚑ (new kind → `gepeszet` defaults) | — |

Click a type the room already has → removes it (toggle). The room label shows `Konyha + Étkező`. Tint colour per kind:
reuse `ROOMS` (00-core.js:163) hues where they exist, else a 12 % tint of the kind's `STK_COL`-neutral palette (F4).

## §3 Standards table — candidates (R4)

Built-in `STD_H`. Columns: code · variant key · Hungarian name · h (mm, box centre unless noted) · auto context ·
source. ⚑ = the user must confirm. **Bold** = the user's own numbers from the draft.

| Code | var | Név | h | Auto when | Source |
|---|---|---|---|---|---|
| SOC | alap | Dugalj | **300** | default | EP_CAT / draft |
| SOC | garazs | Dugalj — garázs / műhely | **500** | room kind `gepeszet` (garázs) | draft |
| SOC | ejjeli | Dugalj — éjjeliszekrény fölött | 750 | zone `agy` within 600 mm | rules.js |
| SOC | ejjeli-also | Dugalj — ágy mellett, alsó | 300 | zone `agy`, placed ≤ 600 | rules.js |
| SOC | media | Dugalj — médiafal (TV mögött) | 1200 ⚑ | tag `media` on the wall | draft (height ⚑) |
| SOC | pult | Dugalj — konyhapult fölött | 1100 (900 + 200) | room `konyha`, on a worktop wall | rules.js |
| SOC | borotva | Borotválkozó dugalj — tükör / mosdó mellett | **1400** | room `furdo`/`wc`, beside a mirror / sink | user R06 |
| SOC | furdo | Dugalj — fürdő, egyéb | 1100 (Q-R09 = A) | room `furdo`/`wc` | rules.js (701 zones are a distance rule) |
| SOC | sziget | Dugalj — szigetben, oldallapon | 750 ⚑ | zone `sziget` | rules.js |
| SOC | kamra | Dugalj — kamra polcmagasság | 1100 | room `kamra` | rules.js |
| SOC | ventil | Dugalj — ventilátor / elszívó | 1900 (R4 ⏸) | note `ventil` | user |
| SWI | alap | Kapcsoló | 1100 | default | WORKSHOP-001 |
| SWI | ejjeli | Kapcsoló — ágy mellett | 750 | zone `agy` | rules.js |
| SWI | redony | Redőnykapcsoló | 1100 | beside a window | rules.js |
| PAN | alap | Kezelőpanel / okos vezérlés | 1450 | — (the ~1300 band = smart control) | rules.js / WORKSHOP-001 |
| THR | alap | Termosztát | 1500 | — | rules.js |
| DED | fozolap | Főzőlap csatlakozó | 600 | circuit name `főzőlap` | rules.js |
| DED | suto | Sütő / sütőtorony | 300 ⚑ | `sütő` | rules.js |
| DED | mosogato | Mosogatógép | 300 | `mosogatógép` | rules.js |
| DED | mosogep | Mosógép | 1100 | `mosógép` | rules.js |
| DED | klima | Klíma beltéri | 2300 | `klíma` | rules.js |
| DED | bojler | Bojler / villanybojler | 1800 ⚑ | `bojler` | new ⚑ |
| DED | szagelszivo | Páraelszívó | 2000 ⚑ | `elszívó` (the "no island hood point" CLA finding) | new ⚑ |
| SHU | alap | Redőnymotor | 2500 | window slot W1 | rules.js |
| LMP | mennyezet | Mennyezeti lámpa | = ceiling (2850) | not on a wall | rules.js |
| LMP | fali | Fali lámpa | 1800 | on a wall | rules.js |
| LMP | olvaso | Olvasólámpa ágytámla fölött | 1400 | zone `agy` | rules.js |
| LMP | tukor | Tükörlámpa | 1900 | room `furdo` | rules.js |
| LMP | munkafeny | Munkafény a felső szekrény alján | 1450 ⚑ | note `munkafény` | rules.js |
| LMP | allolampa | Kapcsolt dugalj állólámpának | 300 | placed ≤ 450 | rules.js |
| LMP (BUSB) | labfeny | Lábfény | 300 | role BUSB | rules.js |
| SEN | alap / co2 / leak | Érzékelő fal / CO₂ / szivárgás | 2400 / 1400 / 0 | — | rules.js |
| CAM · ACP · SPK | — | Kamera / AP / hangszóró | 2400 / ceiling / ceiling | — | rules.js |
| ETH · USB | — | Adat / USB aljzat | 300 | — | rules.js |
| ETH | media | Adat — médiafal | 1200 ⚑ | tag `media` | new ⚑ |

**Paths and boxes** (same table, `code` = the path kind):

| Code | Név | h | Source |
|---|---|---|---|
| PATH:trunk | Gerinc (Elosztó ↔ szervizpont) | 2600 | CLA decision |
| PATH:dist | Leágazó (szervizpont ↔ végpont) | 2450 | CLA decision |
| PATH:data | Adat sáv | 2700 | ADATRETEG |
| BOX:rbx | RBX dobozközép (alja ≥ 1900) | 2150 | STD-001-A1 |
| BOX:drop | Leállás-doboz (2 szerelvényes) | = dist (2450) | CLA |
| LVL:ceiling | Belmagasság (alap) | 2850 | CLA |
| LVL:worktop | Munkalap | 900 | rules.js |
| LVL:lintel | Szemöldök | 2100 | rules.js |

### §3b Appliance sockets — below the worktop (user, R05) · all heights confirmed at the R4 ⏸ (laundry stays 1100, above the machine)

Their own catalogue items: a socket **for one designated device** (or a dedicated circuit device). Family `SOC` when it
shares a socket circuit, `DED` when the appliance needs its own circuit (M2 decides). Heights ⚑ — confirm at the R4 ⏸.

| Item | h | Typical place | Circuit |
|---|---|---|---|
| Hűtő dugalj | 300 ⚑ (behind / beside the fridge housing) | konyha | socket circuit (kitchen) |
| Mosogatógép dugalj | 300 | neighbour base cabinet | DED |
| Sütő / sütőtorony | 300 ⚑ | tower base | DED |
| Mikró (beépített) | 300 ⚑ or in the tall unit | konyha | socket circuit |
| Páraelszívó | 2000 ⚑ | above the hob | socket circuit |
| Mosógép dugalj | 1100 ⚑ (above the machine) or 300 under a worktop | fürdő / mosókonyha | DED |
| Szárítógép dugalj | 1100 ⚑ / 300 | mosókonyha | DED |
| Bojler | 1800 ⚑ | fürdő / gépészet | DED |
| Kazán / hőszivattyú beltéri | 1500 ⚑ | gépészet | DED |

Scope cascade (most specific wins): **selected device (`hFix`) → room → room kind → project (`data.stdHeights`) →
built-in `STD_H`**. The Standards panel edits project and room-kind rows; a room's RMB settings edit room rows.

## §4 Door = portal, window slot (O2)

Door `variant` (04-render.js:238): `hingeAtStart = !(variant & 2)`, `opensToSide = (variant & 1) ? +1 : −1`.
↑/↓ in O1 cycles `variant` 0 → 1 → 3 → 2 (hinge left-in, left-out, right-out, right-in — so one press flips one thing).

Portal slots per face (copy of `PORTAL_SLOTS`, tools/baseline/rules.js:66 — **one source**: WP-O2 moves the table into
`06a-portals.js` as `PT_SLOTS` and the engine reads that copy through E5's bundle; until E5, a spec asserts the two are
equal):

| k | side | u (mm from edge) | h | family | what |
|---|---|---|---|---|---|
| L4 | latch (kilincs) | 150 | 2450 | MAINS | erősáramú leállás-doboz, 230 V átvezetés |
| L1 | latch | 150 | 1100 | MAINS | kapcsoló (1–3 gang, váltó) |
| L3 | latch | 150 | 300 | MAINS | ajtó melletti dugalj |
| L2 | latch | 450 | 1450 | CONTROL | kezelőpanel (külön SELV oszlop) |
| H0 | hinge (zsanér) | 150 | 2450 | CONTROL | fészek, SELV átvezetés |
| H3 | hinge | 150 | 1450 | SENSOR | levegő-modul / termosztát |
| H2 | hinge | 150 | 1150 | BUSB | értesítő fény |
| H1 | hinge | 150 | 300 | BUSB | lábfény + alacsony PIR |
| T1 | head (közép) | 0 | 2150 | SENSOR | ToF pár, függöny-PIR |
| T2 | head | 0 | 2400 | MEDIA | fejzseb |

Slots are **positions, not devices**: drawn as faint ghosts while the Erősáram phase is active (only MAINS slots) and
become a real device when something is linked to them (E1) or placed on them.

Window slot: `W1` — beside the window head on the side away from the nearest corner, u 150, h 2500, family MAINS,
"redőny betáp". **Dormant** (not drawn) unless the window's room has the rule `redony` (R3 palette, or the opening tag
`redony` CLA used).

## §5 Switch type from links (E1)

> ⚠ **The Hungarian switch codes — DO NOT CHANGE (the user, 2026-10-14, after correcting this twice).** The code has gaps:
> 100 impulzuskapcsoló · 101 egypólusú · 102 kétpólusú (+N) · 103 háromfázisú · 104 régi, nem használt ·
> **105 csillár** ("101+1") · **106 váltó** · 107 keresztkapcsoló · **108 dupla váltó** ("106+6"). The shutter switch has
> no number (key `redony`). `src/02-state.js` SWITCH_TYPES follows this; an older table there was wrong.

Input: lamp legs (`d.grp`, a lone lamp is its own leg) and the existing `sw.ctl`. Written to the existing `sw.swType`.

| Legs on this switch | Same leg on other switches | `swType` |
|---|---|---|
| 1 | none | **101** egypólusú |
| 2+ | none | **105** csillár (3+ legs flagged "többes kapcsoló ⚑") |
| 1 | 1 other | **106** váltó — both ends |
| 1 | 2+ others | **106** at the two ends of the chain, **107** kereszt in the middle (chain = nearest-next walk) |
| 2 shared legs | — | **108** dupla váltó |
| shutter only | — | `redony` |

A user-set type sticks (`typeFix`).

## §6 Circuit suggestion policy (E4)

From the CLA rounds (ALAPRETEG Q-001/Q-002) and WORKSHOP-001 — each row becomes a suggested circuit, ☑ by default:

1. **Every DED endpoint → its own circuit** (preset by appliance: főzőlap 3×2,5 / 5×2,5 / 3×6, sütő, mosogatógép,
   mosógép, klíma, bojler — M2's catalogue).
2. **Bedrooms (`halo`) → one socket circuit each.**
3. **Large rooms** (> 20 m² ⚑ or > 8 sockets ⚑) → 2 socket circuits; others share by adjacency, ≤ 8 sockets ⚑ per
   circuit.
4. **Kitchen worktop** → its own socket circuit (2,5 mm²).
5. **Wet rooms** → their own socket circuit (RCD 30 mA — all circuits are RCD-protected anyway ⚑).
5b. **Classic (non-BRIDGE) socket chains** (E06 answer): a room's socket circuit runs Elosztó → first room socket →
   … → last room socket. The szobadoboz does not distribute sockets.
6. **Lighting** → Q-E04: A = two zones (V1 day, V2 night = háló + fürdő; the CLA decision), B = one string for the
   whole flat (WORKSHOP-001), C = one per floor.
7. **Outdoor** → own circuit.

Each row: name (`A2 Konyha pult`), members (count), mm², MCB, why. Unassigned endpoints after "Alkalmaz" are listed.

## §7 Rules palette (R3) — the CLA marks as one-click rules

| Button | Mark written | Colour (MRK_POL) | Default selection |
|---|---|---|---|
| Vezethető fal | `vezetheto` (R2) | plus · green | whole wall, both faces |
| L-forma oldal | `side` + `lforma` | plus · green | one face (half) |
| Belső fal | `wall` + `belso` | plus · green | whole wall |
| Kerülendő | `side` + `kerulendo` ⚑ new | minus · orange | one face |
| Tilos | `side` + `tilos` ⚑ new / existing `tartofal`, `szomszed` | ban · red | one face |
| Ágy zóna | `zone` + `agy` | none · grey | rectangle |
| Közlekedő | `zone` + `folyoso` | none · grey | rectangle |
| Padlófűtés (tilos) | `zone` + `padlofutes` | ban · red | rectangle |
| Redőny | `opening` + `redony` | none | click a window |
| Médiafal | `side` + `media` ⚑ new | plus | one face |
| Munkalap | `side` + `munkalap` ⚑ new (replaces cla.config `worktop`) | none | one face, 600 deep |
| Sziget | `zone` + `sziget` ⚑ new (replaces cla.config `island`) | none | rectangle |

### §7b Non-electrical areas (user, R07) — section **Egyéb területek** of the palette

They tell the router where *not* to chase and the client sheets what is in the wall. All one-face or zone marks.

| Button | Mark | pol | What |
|---|---|---|---|
| Vizes fal | `side` + `vizes` | minus | water supply / waste in or on the wall |
| Gépészet a falban | `wall` + `gepeszet` (exists) | ban | water, gas, heating pipes |
| Gázvezeték | `side` + `gaz` ⚑ new | ban | gas line route |
| Fűtőtest | `side` + `futotest` ⚑ new | minus | radiator (no sockets behind it) |
| Padlófűtés | `zone` + `padlofutes` (exists) | ban | no floor routing |
| Kémény / szellőző | `wall` + `kemeny` (exists) | ban | flue / vent shaft |
| Lefolyó / strang | `zone` + `strang` ⚑ new | ban | waste stack / riser |
| Bútor / szekrénysor | `side` + `butor` ⚑ new | none | furniture run (drives appliance-socket placement) |

Selection rule (the user's): LMB = the face nearest the cursor (half wall), hold-drag along the wall = part of that face.
`Vezethető fal` alone defaults to the whole wall. Floor rules: an empty "Padló szabályok — fejlesztés alatt" section.

## §8 Inner size → centreline (F3, Q-F01 A)

The pen stores the **clear** (inner) polygon — the numbers the user measured. Create Walls derives centrelines:

1. Each clear edge gets a thickness `t` = `penThick.ext` if no other room touches it, else `penThick.int`.
2. **Shared edge** (two rooms' clear edges on one line, facing each other): the rooms are pushed apart by `t` so both
   keep their clear size. **Built 2026-10-14 as a RIGID shift per room** (not a global grid-line expansion — that made a
   room spanning another row's partition grow, seen on a 4-room flat): every contact says "the + room sits ≥ t beyond
   the − room", per axis, and the longest push chain wins. Sizes never change. Where the measured sizes do not add up,
   an outer line that was straight comes out stepped — the dialog lists it (`Lépcső a külső falon: Konyha ↔ Háló 200 mm`).
3. **Outer edge**: centreline = clear edge moved outward by `t/2`.
4. Joints (built): wall bands outside every orthogonal edge (the gap to a facing room, else the outer thickness) + the
   corner square at every convex corner, cut on one cell grid; a cell in a band and in no room is wall. The wall that runs
   THROUGH a junction owns it (T = butt on the face, as the G2 default); L corners and X go to the horizontal wall. No two
   walls overlap and the wall area is exactly envelope − rooms (spec-83).
5. Inner corner points of each room = the clear polygon itself → the wall editor anchors elevations on them.
6. 45° edges: under Q-F02 A they stay floor-only and are listed `ferde él — fal később`.

Q-F01 B (centreline mode): no shifting; the label shows both `tengely 3 800 · belméret 3 600`.
