# BRIDGE — General Outline

**Doc:** BRIDGE-OUTLINE-001 · r2 · 2026-10-06 · English · r2 applies round K (upper floor, R07, BASE, riser, box naming)
**Role:** the top of the document set. What the system is, in what order it is built, and where
every detail lives. **P33 is the worked instance** carried alongside.
**Integrates:** `P33-D1 r1` answers (47/47, 2026-10-05) · the P33 floorplan (held locally) · the
dining-as-corridor brief.

> **G08 = C.** This is the **general plan** first; P33 is the instance that proves it. Where the two
> differ, the general rule is in §1–§3 and the P33 fact is in §4.

---

## 0. The system in one page

**BRIDGE is a fixed pathway system with replaceable intelligence.** The hardware changes over the
building's life; the routes are designed to outlive it. Everything follows from four elements and
one doctrine.

| Element | Role |
|---|---|
| **BASE** | the central column — NET (comms), COMP (coordinator), MEDIA (storage and streams) |
| **CHANNEL** | the spine from BASE to each room node. Physical chain, logical star |
| **ROOMBOX** | one per room or area. Termination, power conversion, local control, radio, sensing |
| **ARM** | room node to endpoint. Dedicated (one endpoint) or bus (several) |

**The doctrine is manual-first, and it is implemented in hardware.** Every smart switch routes its
load through a **bistable memory element**; the load follows the memory, and both the human's switch
and the wireless side feed it. So every manual action lands, and losing the intelligence degrades to
a clean manual circuit. This is the one invariant that holds across every scenario and every layer,
and most of the system's other properties are downstream of it.

**Three deployment scales**, not three competing designs:

| | Scenario | Backbone |
|---|---|---|
| **S-A** | Shadow — retrofit a finished home | none. Mains tap, then wireless |
| **S-B** | SELV net — light retrofit | a modest wired 12/24 V layer in conduit |
| **S-C** | **Full infrastructure — the reference** | ten parallel conduit families |

---

## 1. The build sequence

Thirteen steps, dependency-ordered: **no step needs anything from a later one.** Step 1 alone is a
working, code-compliant dumb installation — which is the manual-first doctrine expressed as a
construction order.

| # | Step | Nature |
|---|---|---|
| 1 | **MAINS** — socket and lighting circuits | conduit + cable |
| 2 | **LV** — SELV generation and distribution | conduit + cable |
| 3 | **Actuation** — bistable relays, dimmers, shutter interlocks (ζ/η) | gear in Z1 |
| 4 | **CONTROL** — BRIDGE_LINK to BASE, sub-controller | conduit + cable |
| 5 | **DATA** — Cat6A to the room | conduit + cable |
| 6 | **Network** — switch, AP, VLANs, addressing | gear on DATA |
| 7 | **KNX** — if taken | conduit + cable |
| 8 | **Sensor** — endpoints and bus | conduit + cable |
| 9 | **RF** — radios, coverage, channel plan | coverage plan |
| 10 | **Control panel / HMI** — touch panel, keypad, identity reader | endpoint class |
| 11 | **Media & audio** — HDMI, speakers, amp bay | conduit + cable |
| 12 | **USB** — extension and charging points | conduit + cable |
| 13 | **Security** — third-party layer | conduit + cable, third-party |

**Before any of it:** the room schedule (§4), because every count and every reference keys to it.

---

## 2. The layer map

**Ten conduit families, and only four travel the CHANNEL.** This is the most commonly
misunderstood thing about the system, so it is worth stating as a table.

| Layer | Carries | Originates | On the CHANNEL? |
|---|---|---|---|
| **MAINS** | 230 VAC | Elosztószekrény | **no** — its own route, opposite side of a corridor |
| **LV** | 24 / 12 / 5 VDC | **made in each RoomBox** | **no** |
| **CONTROL** | BRIDGE_LINK, Modbus RTU | COMP | **yes** — C3, M20 |
| **DATA** | Ethernet / PoE | NET | **yes** — C1, M25 |
| **MEDIA** | HDMI-class, audio | MEDIA | **yes** — C2, M40 |
| **USB** | extension, charging | RoomBox Z3 | **no** |
| **KNX** | KNX TP | KNX supply | **yes** — C5, M20 |
| **SENSOR** | sensor bus and power | RoomBox | **no** |
| **RF** | *not a conduit* — a coverage plan | RoomBox Z4 | **no** |
| **SECURITY** | third-party alarm | SSC | **no** — a parallel route, own conduits |
| **NOTIFICATION** | visual output | assured bus + ESP-NOW | **no** — shares the portal stub-out |

Plus **C4 M25**, a spare with a draw cord, and **C4b M20**, which carries the assured 24 V bus (K25).

**The gear tiers**, which sit on top of the conduit rather than beside it: T1 base gateways ·
T2 integrated devices · T3 manual-first actuation · T4 sensor fleet · **T5 the coordinator** ·
T6 adaptive and predictive · T7 the operator or agentic interface.

**COMP coordinates and never computes.** Home Assistant, MQTT, the protocol bridges, ESPHome,
the arbiter. Never transcoding, library serving, camera recording, bulk backup or local inference —
those live on MEDIA or a dedicated node.

---

## 3. The element map

```
  VILLANYÓRA ──► ELOSZTÓSZEKRÉNY ══ PANEL LINK (data only) ══╗
        │  MAINS, own route                                   ║
        │   ├─► BASE (2–3 dedicated system circuits)          ║
        │   ├─► every RoomBox                                 ║
        │   ├─► SSC (2 dedicated)                             ║
        │   └─► big loads, direct — never via a RoomBox       ║
        ▼                                                     ║
   ┌──── BASE ────┐                                           ║
   │ NET          │  modem · PoE switch · protocol masters    ║
   │ COMP  ═══════╪═══════════════════════════════════════════╝
   │ MEDIA        │  storage · Snapcast · NVR
   └──────┬───────┘
          │ CHANNEL — C1 data · C2 media · C3 control · C4 spare · C4b bus B · C5 knx
      ROOMBOX ──► ARM ──► ENDPOINT
          │
   SSC ══ SECURITY CHANNEL ══► security point per RoomBox ══► star ARMs
```

**RoomBox internals**, bottom to top, because air enters low and leaves high: **Z5 sensors** (in
intake air) · **Z2 LV & control** · **Z3 data/media/USB** · **Z1 mains and PSU** (at the top, so
their heat leaves immediately) · **Z4 RF** as a side column open at both ends, doubling as the one
duct guaranteed never to be packed with cable · **ZI** internal monitoring · **ZT** pass-through.

Classes: **RB-M** 400×500×110 · **RB-L** 500×600×110 · **RB-H** 600×600×120 (chain node) ·
**RB-O** 400×500×150 IP65 · **RB-E** terminal and function-bounded (/W wet, /G garden, /T technical)
· **RB-S** 300×400×110, **a special-purpose design only**.

---

## 4. P33 — the worked instance

### 4.1 The dwelling

**A two-storey flat.** Ground floor from the 1:50 plan, 8.62 × 7.83 m footprint:

| Ref | Room | Floor finish | **Area** | Lamps | Notes |
|---|---|---|---|---|---|
| **R01** | ELŐSZOBA — entrance | csempe | **2.55 m²** | 2 | flat's entrance. Cabinet and BASE here (G03) |
| **R02** | KONYHA — kitchen | csempe | **5.05 m²** | 3 | half-open to R03 |
| **R03** | **ÉTKEZŐ — dining + corridor** | laminált | **10.16 m²** | *see §4.3* | **the hub. See §4.3** |
| **R04** | WC | csempe | **1.36 m²** | 1 | |
| **R05** | KAMRA — spájz | csempe | **1.36 m²** | 1 | **under the stairs** — see §4.4 |
| **R06** | NAPPALI — living | laminált | **18.43 m²** | 5 | 4+ shutters · SSC here (L08) · screen |
| **R07** | SZOBA — room | laminált | **12.16 m²** | 3 | 2 shutters |
| **R08** | FÜRDŐ — bathroom | csempe | **4.75 m²** | 2 | |
| | *ground floor* | | **≈ 55.8 m²** | **17 + R03** | |
| **R09** | SZOBA — upper room | laminált | **10.24 m²** *(12.01 incl. < 1.90 m)* | 2 | **upper floor.** Sloped ceiling; railing on the void side. RBX09 here |
| **R10** | FÜRDŐ — upper bathroom | csempe | **4.07 m²** | 2 | upper floor. Served by ARMs from RBX09, no box of its own (K15) |
| **R11** | KÖZLEKEDŐ — upper hall | — | **1.94 m²** | 1 + stair | upper floor. Stair head |
| **R12** | TERASZ — roof terrace | — | **6.18 m²** | 1 | upper floor. Outdoor endpoints on ARMs, no RB-O (K16). **Later development** |
| **R13** | TÁROLÓ — store | — | **3.64 m²** | 1 | upper floor, reached from the terrace |
| | *upper floor* | | **≈ 26.1 m²** | **7** | **not renovated until the ground floor is finished** |

> **Correction (K01, 2026-10-06).** The upper floor was carried here as "two bedrooms and a small
> hall". The plan says otherwise: one room, a bathroom, a hall, a roof terrace and a store. Room
> refs R09–R13 replace the R09–R11 placeholders, which were never issued (K11). Lamp counts are the
> accepted provisional defaults (K17).

Two floors (G01), occupied space above throughout (G02) — **so a floor-void thermal riser is
available**, which is the only pipe that adds real stack height.

**A double-height void links the floors (K12).** Over the window strip of **R06 only**, the space
is open to the roof — about **4.5 m** — and R09's railing looks down into it. Three consequences:
an mmWave sensor in R09 will see across the railing into R06 and needs masking; sound and heat
travel up; and the **stair remains the only walkable link**, so the stairway count anchor of §4.3
still holds.

### 4.2 Topology

```
  ELOSZTÓSZEKRÉNY ══ power + data ══ BASE ═ CHANNEL ═ RBX03 ─┬─► RBX06  R06 NAPPALI   RB-H · R06 R07 + AV position
  R01 · ISP entry                    R03, stacked     R03     ├─► RBX08  R08 FÜRDŐ     RB-E/W · terminal · IP44
                                     under RBX03      RB-H    └─► RBX09  R09 (upper)   RB-M terminal · R09–R13
                                                      R01–R05        via the R05 kamra riser (V1)
```

**Boxes are keyed to the room they sit in (K19, STD-004 §1.3)** — reference, room and Modbus
address are one number. The chain-order names RBX01–04 used until r1 are retired; "RoomBox 1"
survives only as plain English for the hub.

**RBX03 belongs in R03, not R01**, and three things agree on it: R03 is the circulation hub so the
ARM runs to the most endpoints are shortest; it is the **geometric centre of the plan**, which is the
best possible position for RF coverage and for BLE/UWB trilateration; and R01 at 2.55 m² has no wall
to spare. A three-branch chain node makes it **RB-H**.

**RBX03 and BASE share one position (K13, G04/G05)** — on R03's south wall, the stretch with the
WC and the entrance hall behind it: RoomBox in the upper section, BASE at eye level, in a
**joinery build-out** because that wall is a thin partition that cannot take a 120 mm box flush.
It sits between the entrance and the hub, as the network-first rule wants, and backs straight onto
the cabinet side.

**R07 SZOBA is served from RBX06 (K07)**, across the shared R06/R07 wall, and RBX06 grows to
**RB-H** — it now serves two rooms and carries ARMs to the media wall.

**The upper floor rises through R05 (K14).** The riser runs up the kamra's left side, against the
masonry spine that continues upstairs between R09 and the stair. Built now as capped sleeves and an
inspection box with draw cords; RBX09's exact position is set during the upper renovation.

### 4.3 The finding — R03 is the articulation point

Your brief: half-open to the kitchen, while the other half lengthwise is the corridor between the
living room, the under-stair pantry, the stairway and the entrance hall. That makes R03 the node
every route passes through, and five consequences follow.

**1 · It carries more portals than anywhere else.** POR to **R01 előszoba**, the **stairway**,
**R06 nappali**, **R05 kamra**, and an open boundary with **R02 konyha**. Four portals and an open
edge on one 10 m² room.

**2 · It — not the entry door — is where portal accuracy matters most.** The entry door anchors the
*house* count; R03 decides every *internal* route. A missed or misordered crossing there corrupts
every downstream zone at once. **P-3 belongs here as much as at the entrance.**

**3 · The stairway portal is the second anchor.** It is the only link between floors, so it anchors
the upper-floor count exactly as the entry door anchors the house. **Also P-3.** Two anchors,
not one — which is a change to STD-003 §2.2, where only the entry door was named.

**4 · It is two functional zones in one room.** The dining half is a *dwell* space; the corridor half
is *transit*. One room-level sensor cannot tell "someone is eating" from "someone walked through",
and the two want opposite vacancy behaviour. So: **zoned mmWave** — either a zoning-capable sensor or
two sensors — and **two zones in the graph**, not one.

**5 · Its grace period is a hall's, not a dining room's.** STD-003 §3.4 would give a dining room
12–15 minutes. The corridor half should behave like R01: **3 minutes.** Splitting the zone per
consequence 4 is what makes that possible.

**And it needs its own lamps.** N03 answered "merged with the kitchen", which is true of the *space*
but not of the lighting: a 10 m² room doing double duty wants at least **a pendant over the table and
a separate run for the corridor** — two dedicated ARMs minimum, switched independently, because the
two halves are used at different times for different reasons.

### 4.4 R05 KAMRA is the services riser

The pantry is **under the stairs**, which makes it the obvious vertical route to RBX09 — and the
obvious home for the **floor-void thermal riser** that G02 just made possible. A 1.36 m² understairs
store is poor for storage and excellent for services. Fire-stopping to OTSZ applies to the
penetration.

### 4.5 Three consequences of the answers worth flagging

**The cabinet fits after all (K31, K32).** S04 doubles socket circuits to keep 1.5 mm² cable, and
the 48-module cabinet was full at V2 — but V2's fourth row holds the **centralised** variant's
core, which a distributed house like P33 does not need. That row becomes the PANEL LINK row. With
**one-module RCBOs on every way**, BASE on two system ways, and S04's doubling **kept only where the
load concentrates** (the kitchen worktop and island), the house needs **24 ways: 29 of 36 modules
on single phase, 34 of 36 three-phase-ready.** No second enclosure. Derivation and the supply
calculation for both cases: `P33-BUILD-001` §14. *This reverses r2's "second enclosure required".*

**The hob is induction, on the island (K20).** S06 omitted it; the plan put it in the island. It
takes its own big-load circuit from the cabinet to the island, never through a RoomBox, and the
island needs that feed in the floor before the screed.

**The lamp count passed the DALI crossover and the answer still holds.** Ground floor ≈ 19 controlled
mains lamps with R03's two; with the upper floor, roughly 26. That is above the 15–25 crossover on
count — but **C30 keeps a bistable relay per lamp regardless**, which forecloses DALI's main benefit
before cost enters the argument. **No DALI in v1** stands, and a CHANNEL spare keeps the door open — C5 while KNX is not taken, otherwise C4 (K25).

### 4.6 Provision, as answered

Tunable white in R02 R03 R06 R07 · colour in R06 only · **CO₂ added to R06** (P01) ·
**follow-me pair added to R07** (P02) · **R08 thermal array only**, promoted to primary (P03) ·
screens in R06 R02 R03 (P04) · mmWave in R03 R06 R07 R01 · ten-scene set in habitable rooms,
five-core in R01 R04 R05.

---

## 5. Resolved, and open

**Resolved:** all 141 design questions (round 2) and all 47 room questions (round 3). Eight standards
at r2 plus a thermal annex. The three contradictions C1, C2, C3 closed; C4 and C5 proposed.

**Open, in the order it matters:**

**Closed 2026-10-06 (round K):** the upper floor (K01–K06, K11, K15–K17) · R07 from RBX06 (K07) ·
the BASE position (K09, K10, K13) · the riser (K14) · box naming (K19) · the hob (K20). **G06 is
largely answered by the marked plan**: the spine and both outer walls are masonry ≥ 25 cm, the
partitions are thin — which is what put RBX03 + BASE in a joinery build-out.

| | Open | Blocks |
|---|---|---|
| 1 | **C23 / C23B** — which integrated lighting types, waiting on `06_reference-images/` | the fixture schedule |
| 2 | **RBX08's wall** in the redrawn bathroom, outside zones 0–2 | the R08 ARM runs |
| 3 | **The media wall's position** in R06 | the AV position and RBX06's exact wall |
| 4 | **H10** Snapcast placement, to be measured not argued · **D9** the security provider and `alarm_type` | |

**Next build step:** `P33-BUILD-001` — the topology and hardware composition. Nothing above blocks it.

---

## 6. Where everything lives

```
  BRIDGE/
   ├── BRIDGE-OUTLINE-001_General-Outline.md     ← you are here
   ├── 01_architecture/   ARCH-001 · ARCH-002 HU · Smart-Switch + figures · SELV standard + 1/A
   ├── 02_bridge-dn/      the built 48-module cabinet · buildup PDFs
   ├── 03_omnicomm-hub/   CM5 hardware line · KiCad · datasheets
   ├── 04_related-hardware/  VRG line · ESP32 sensor list · presence building blocks
   ├── 05_standards/      STD-001…009 + A1 thermal + A2 wiring annexes + README index
   ├── 06_reference-images/  17 lighting type folders, awaiting photographs
   ├── 07_P33/            ** LOCAL ONLY, NOT IN GIT ** — client property. Blueprints, the
   │                      electrical plan, the room survey. The design knowledge is in
   │                      05_standards and in §4 above, de-identified
   ├── 08_builds/         P33-BUILD-001 topology + composition · fig/ · src/ (figure generators)
   ├── _build/            the register, decision records, briefings
   └── _tuner/            the question tool and packs
```

**Authority chain:** ARCH-001 (doctrine, S-A) → **ARCH-002** (architecture, S-C) →
**Smart Switch r1** (control authority, supersedes ARCH-A1) → **STD-001…008**. ARCH-A1 and
P33-BRIDGE-ARCH-01 are history, marked superseded, never cited as current.

**Read in this order:** this outline → `05_standards/README.md` → STD-001 → 004 → 005 → 006 →
002 → 003 → 007 → 008. Open items live per-document and in `_build/BRIDGE_infobase.md` by ID —
**C** contradictions, **D** declared decisions, **U** gaps.
