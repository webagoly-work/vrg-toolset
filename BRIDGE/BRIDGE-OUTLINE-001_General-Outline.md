# BRIDGE — General Outline

**Doc:** BRIDGE-OUTLINE-001 · r1 · 2026-10-05 · English
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

Plus two spares — **C4 M25 and C4b M20** — empty with draw cords.

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
          │ CHANNEL — C1 data · C2 media · C3 control · C4/C4b spare · C5 knx
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
| **R09** | bedroom 1 | — | ? | ? | **upper floor** |
| **R10** | bedroom 2 | — | ? | ? | upper floor |
| **R11** | small hall | — | ? | ? | upper floor |

Two floors (G01), occupied space above throughout (G02) — **so a floor-void thermal riser is
available**, which is the only pipe that adds real stack height.

### 4.2 Topology

```
   ELOSZTÓSZEKRÉNY + BASE          R01 ELŐSZOBA
            │ CHANNEL
            ▼
      RBX01  ──  R03 ÉTKEZŐ        RB-H · the hub · serves R01 R02 R03 R04 R05
        ├──► RBX02 — R06 NAPPALI   RB-L · SSC alongside
        ├──► RBX03 — R08 FÜRDŐ     RB-E/W · terminal · IP44
        └──► RBX04 — upper floor   RB-M terminal · serves R09 R10 R11
                   via the R05 stair void
```

**RBX01 belongs in R03, not R01**, and three things agree on it: R03 is the circulation hub so the
ARM runs to the most endpoints are shortest; it is the **geometric centre of the plan**, which is the
best possible position for RF coverage and for BLE/UWB trilateration; and R01 at 2.55 m² has no wall
to spare. A three-branch chain node makes it **RB-H**.

**R07 SZOBA is served from RBX01 or RBX02** depending on which wall it shares — the plan will say.

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

The pantry is **under the stairs**, which makes it the obvious vertical route to RBX04 — and the
obvious home for the **floor-void thermal riser** that G02 just made possible. A 1.36 m² understairs
store is poor for storage and excellent for services. Fire-stopping to OTSZ applies to the
penetration.

### 4.5 Three consequences of the answers worth flagging

**Doubled socket circuits grow the cabinet.** S04's note — *"as a preferred standard we double the
circuit of power socket to keep the 1,5 mm² cable type"* — is a sound rule and it doubles MCB ways
and M25 conduits for sockets. **The 48-module cabinet is already full at V2.** The second enclosure
already planned for PANEL LINK (B20, RB-E/T) absorbs this, but it is now **required rather than
optional**, and it should be sized for the doubled circuit count before it is bought.

**No hob on the big-load list.** S06 named oven, dishwasher, washing machine and water heater but
**not a hob**. Gas, or on the oven circuit? It changes a 2P C16 way in the cabinet, so worth
confirming.

**The lamp count passed the DALI crossover and the answer still holds.** Ground floor ≈ 19 controlled
mains lamps with R03's two; with the upper floor, roughly 27. That is above the 15–25 crossover on
count — but **C30 keeps a bistable relay per lamp regardless**, which forecloses DALI's main benefit
before cost enters the argument. **No DALI in v1** stands, and the C4b conduit keeps the door open.

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

| | Open | Blocks |
|---|---|---|
| 1 | **Upper floor** — areas, lamp counts, and whether RBX04 serves three rooms as RB-M terminal *(the "small end terminal" of G07 is probably too small for three habitable rooms)* | the CHANNEL schedule and RBX04's class |
| 2 | **R07's shared wall** — served from RBX01 or RBX02 | the ARM schedule |
| 3 | **G06 wall construction** — answered `?` with a request for **simple visuals of the choices** | chase depth, cross-vent, the 110 mm envelope |
| 4 | **C23 / C23B** — which integrated lighting types, waiting on `06_reference-images/` | the fixture schedule |
| 5 | **G04 / G05 BASE arrangement** — split or unit, modular per available space | the LAYER TIE, and whether fibre is wanted there |
| 6 | **The hob** (§4.5) · **H10** Snapcast placement, to be measured not argued · **D9** the security provider and `alarm_type` | |

**Next build step:** `P33-BUILD-001` — the hardware composition, which needs items 1 and 2 above.

---

## 6. Where everything lives

```
  BRIDGE/
   ├── BRIDGE-OUTLINE-001_General-Outline.md     ← you are here
   ├── 01_architecture/   ARCH-001 · ARCH-002 HU · Smart-Switch + figures · SELV standard + 1/A
   ├── 02_bridge-dn/      the built 48-module cabinet · buildup PDFs
   ├── 03_omnicomm-hub/   CM5 hardware line · KiCad · datasheets
   ├── 04_related-hardware/  VRG line · ESP32 sensor list · presence building blocks
   ├── 05_standards/      STD-001…008 + A1 thermal annex + README index
   ├── 06_reference-images/  17 lighting type folders, awaiting photographs
   ├── 07_P33/            ** LOCAL ONLY, NOT IN GIT ** — client property. Blueprints, the
   │                      electrical plan, the room survey. The design knowledge is in
   │                      05_standards and in §4 above, de-identified
   ├── _build/            the register, decision records, briefings
   └── _tuner/            the question tool and packs
```

**Authority chain:** ARCH-001 (doctrine, S-A) → **ARCH-002** (architecture, S-C) →
**Smart Switch r1** (control authority, supersedes ARCH-A1) → **STD-001…008**. ARCH-A1 and
P33-BRIDGE-ARCH-01 are history, marked superseded, never cited as current.

**Read in this order:** this outline → `05_standards/README.md` → STD-001 → 004 → 005 → 006 →
002 → 003 → 007 → 008. Open items live per-document and in `_build/BRIDGE_infobase.md` by ID —
**C** contradictions, **D** declared decisions, **U** gaps.
