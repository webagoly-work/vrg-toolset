# NEXT — CLA-ADD-001 · SF: the SmartFrame (BSF), a second BRIDGE box type at every portal

Status: **briefing only, nothing built, nothing decided.** Written 2026-10-10 by an analysis
session as the follow-up to `NEXT-CLA-ADD-001_cla-extras.md` (its §5 points here). The user's
request is in §1, kept close to their words. Everything after §1 is **pre-work**: how the idea
fits into what already exists, the conflicts found, first proposals (marked *draft*), research
targets and questions. The session that picks this up (codephrase **GO FRAME**, see
`GO-FRAME.md` at the worktree root) turns it into a concept, tunes it with the user, then
updates the BRIDGE documents and writes a Planner pack. That session builds no code.

Working name: **SmartFrame — Bridge SmartFrame — BSF**. The user wants a better name (§3.1).

---

## 1. The request (the user's words, lightly tidied; nothing left out)

**What it is.** A second box type for BRIDGE: a **half-independent** subsystem that can also
work **without BRIDGE** as a system of its own. Where it departs from the BRIDGE standard has to be
settled first. It uses what the wall around a doorway already does, and adds smart functions in a
**precisely calculated number of free modular spaces** inside the frame zones. Those spaces give
room to other stack layers and to many sensors along the frame. The frame is one of the
**cluster points**.

**Why the doorway.** Every portal already has things around it. Wireways usually cross into a room
there. The handle-side vertical often has a socket, a switch and a kötődoboz. The switch wiring
already needs the two doors of a room to be connected. The design builds on this:

1. A **100 × 100 or 100 × 150 inline flush corner box** in the upper corner. It is on the
   **secondary 24 V bus** (bus B), which has a **battery-backed PSU**, so the devices inside keep
   working for at least a short time in an emergency, or longer as auxiliary power with a bigger
   pack.
2. The corner box links to its upstream **RBX** over B1 · Vezérlés (BRIDGE_LINK),
   B1 · Adat / PoE and Biztosított 24 V — B busz, and optionally B1 · Média és hang, B1 · USB and
   B1 · Biztonságtechnika. **Bus B reaching the box is enough on its own; bus A plus bus B is the
   preferred minimum.**
3. From the corner box the frame takes over the **hinge-side vertical zone** and the **overhead
   horizontal zone**, an upside-down L. Second priority: the **hinge-side vertical all the way to
   the floor**. With the handle side this gives a **gate shape** of reach, so many functions can
   be concentrated in one place.

**What the frame should house, bottom to top.** This list includes everything at a doorway, not
only the subsystem's own parts. The aim is to arrange the amount, position and size of the spaces
so that one **uniform architectural rule set** covers as many of these as possible:

- *Low zone:* lábfény spot (an extra nightlight socket, or a corridor-type LED lábfény) · a spot for
  low-zone sensors · flush space for a smart endpoint switch · **at 700 mm an unused, hidden
  szerelvénydoboz**, with a wireway to the normal switch box and parallel wiring already in place,
  so that a lower parallel switch can be added later (accessibility, hidden/dormant extra).
- *Middle zone:* normal light switches · shutter (redőny) motor switch · additional flush light
  control panels · a small **CYD display** for room control · thermostat (central heating) ·
  optional chest/head-height sensor node · **smart intercom panel** · notification panel (light or
  sound) · door contact sensors · a **simple audio system** (small laptop speakers, a secondary
  sound system) · a **12 V active buzzer siren** (alarm option).
- *Upper zone:* the **SmartFrame corner box** (the nest) · a **kötődoboz** for normal mains · a
  local **AC/DC adapter point** · an optional parallel smart-up point for switches/shutters in the
  upper zone.
- *Horizontal (over the door):* the routing **channel / wireways that cross into the room**.

**Swarm.** Multisensor nodes for smart-home use (the user asks for useful combinations), various
microcontroller nodes, WiFi mesh, communication nodes, and presence sensing that detects movement,
direction and crossing. This builds on the multi-sensor design discussed earlier: signal-strength
(RSSI) change telemetry, PIR motion, approach/retreat sensors, sound-based localisation, trusted
wireless devices tracked as they pass between portals, plus an **observer that learns habits and
behaviour over time to identify users**. The user wants this written up as the **minimal uniform
ESP32 swarm device/module set for a portal**:

- **Head:** ESP32-S3 **N16R8**, dual USB-C, 42-pin, on a **44-pin I/O shield** (Modulshop).
- **Under the head:** 2–3 simpler, **uniform** ESP32 modules (all C3 or all C6).
- **Sensor modules:** ordered separately, reduced to a few universal unit types built from custom
  sensor modules, covering a large share of smart-home functions. A custom fleet, each unit
  carrying 2–4 sensor modules.
- **Result:** a standard hardware choice for **swarm control fleets on their own wireless network**,
  with modular sensor installation options for higher, emergent capabilities: **spatial telemetry,
  localisation, a fallback network for the smart home's wireless traffic, and a "ghost network"
  for security**.

**Why it matters.** It relieves RBX-centred designs where one central box per room is impractical,
gets crowded, or forces many lines along awkward paths to one point on a wall. One or two portals
take some layers from the top of the stack off the RBX and work alongside it as a subsystem with
mixed duties.

**Room pattern.** Portals sit on the **two walls that form the arms of an L**, and the **RBX** sits
somewhere between them, handling the 230 V side of the layers. Other layers' devices may still
reach the RBX, but even one portal takes load off the central node. **These are the three primary
nodes.** In addition there are **three cluster points** that cover **the three corners of the room**
the L leaves out. Together the two node types give a more modular and more balanced room network.
The L outline makes the layout **rail-like**, which suits the travelling nature of wiring. It also
shapes how every other point in a room is clustered: *"with L shape based rooms for example like
the living room and the bedroom of CLA will have wall clusters in the"* — **the sentence ends here
in the original. Ask the user how it continues (Q-SF-01).**

**What the user asked for:**
1. **In-depth research**, building the concept out in detail.
2. **Standardisable versions** of portal wireways and flush-mount locations, in the mathematical
   combination that **does the most with the least**.
3. **Ideas for using the hinge-side vertical zone.**
4. **After fine-tuning with the user:** integrate it into the design as **a new version of this part
   of the document** (which document: Q-SF-02).
5. **Change the Planner:** a renewed design with stack layers in an order that can produce it.
   Base and hardware first; then the first RBX in a room connects up to its portals, forming the
   **Silver Rail**. Along parts of that rail, **cross-room channel wireways run above it**, either
   direct or chained, because the rail usually sits on **the lowest line of the high horizontal
   sáv**.

---

## 2. What already exists (do not re-derive; read these)

| Where | What it already says that the SmartFrame inherits or changes |
|---|---|
| `BRIDGE/05_standards/BRIDGE-STD-003_Presence-and-Identity.md` §2 (main checkout) | **The portal model.** Doors are graph edges, P-0…P-3 tiers, P-2 = two ToF sensors 200 mm apart at the lintel looking down, giving direction, count and adult/child/pet. P-3 only at the entry door. §2.4: *"the portal needs no new pathway"*, because the STD-001 door-frame-point ARM and Melléklet 1/A stub-out cover it. **The SmartFrame is the physical home of STD-003 §2**, and it makes §2.4 out of date: it *is* a new pathway (the rail). §4.5 privacy boundary governs the habit observer. |
| `BRIDGE/01_architecture/BRIDGE-ARCH-001_unit-fleet-primer.md` | The Shadow Layer and the unit fleet. Its tenets (non-invasive, manual-first, optional, discreet…) apply as written. **Conflict:** §2 says *"no second low-voltage backbone; power where used, wireless from there"*. The SmartFrame on bus B is exactly a second SELV feed. State the departure (Q-SF-03). §3.3: vented or sensor-transparent covers, never sealed. §4.1: BLE = ESPHome Bluetooth proxies. |
| `BRIDGE/05_standards/BRIDGE-STD-001_Physical-Standardisation.md` | Room demand table (§≈359–364): every room already has a **door frame point + portal + NTL-TR**; living rooms have **corner radio nodes ×2** and **UWB anchors ×3**. Those corner counts are the user's "three corner cluster points" in another form. §≈269/417: C4b bus B in every box (K25). |
| `BRIDGE/05_standards/BRIDGE-STD-005_Network-and-RF.md` | ESP-NOW is already planned as the **notification swarm** on WiFi channel 1 (with STD-008 §6.1). The swarm's own network extends this; it does not add a new radio plan. 868 MHz LoRa is BASE-only. |
| `BRIDGE/05_standards/BRIDGE-STD-008_Notification-Lights.md` | NTL-TR beside every portal at 1100–1200 mm. It moves into the frame. |
| `BRIDGE/01_architecture/BRIDGE_Smart-Switch.md` | The **Peer** and **Gate** switch families. **"Gate" is taken**, so the SmartFrame cannot be named Gate. The dormant 700 mm parallel point is a Peer / staircase-type parallel switch. |
| `BRIDGE/04_related-hardware/presence-sensing-building-blocks-v1.md` | 23 mono-sensor technologies plus commercial fusion sensors. This is the catalogue the swarm module set draws on. |
| BUILD-001 K27 | The **assured pack sits in R05 (kamra)**, not in the BASE joinery. Bus B power for frames comes from there. |
| `docs/stack/WORKSHOP-001_routing.md` | **golden** = channel between hardware nodes · **silver** = endpoint → its RBX (ARM) · **bronze** = dedicated load → Elosztó. **Clash:** the user's "Silver Rail" is RBX → portal, a trunk, not an endpoint arm (§3.2). |
| `docs/stack/IDEA-001_cluster-flush-boxes.md` | Cluster points, low/medium/high zones (200–500 / 800–1400 / 1900–2500), `full` sizing policy. Open Q5 (*does the portal box count as the high housing of the door column?*) is answered by the SmartFrame: yes, and more. Open Q1 (corner clusters) connects to the three corner points. |
| `docs/stack/IDEA-002_flush-cover-standard.md` | Ladder D (83 mm device module) and Ladder H (100 mm hatches 200…600), a shared centreline, Zone 3 portal box 100 × 100 → *"no true 100 × 100 flush box exists: 107 (Kaiser 9195-91) or 116 (Kopos KO 110/L)"*. Answer 5 (2026-10-09): **"leave it for now, as it is a placeholder for a later dev idea"**. **This is that idea.** Chorus ONE for BRIDGE cluster plates; push-open GK hatches high up. |
| `docs/stack/01_CATALOGUES.md` | `POR` exists twice (sys:CONTROL h 2150 RS-485/Cat6A, and sys:SENSOR ToF), `NTL` with the `doorFlank` anchor (h 1150, off 200), door marks `portal` / `lepcso` / `nyitva`. |
| `docs/round-2026-10-10/01_MATERIAL.md` | The layer descriptions (sys:CONTROL *"10×10 portal box at the door's upper corner, 2150 mm, handle side"*). This is the text the user calls "this part of the document" if Q-SF-02 answers "the Planner layer help". |
| `src/05t-needs.js` ≈ line 180 | Already works out the **handle jamb from the door's `variant`** (bit1 = hinge at the far jamb, bit0 = opening side, `04-render.js` ≈ 166). Hinge side and swing face can therefore be derived from the model with no new data. |
| `docs/stack/WP-B5_portal-graph.md` + `05o-traces.js` | `prtGraph()`: doors as nodes, 500 mm grid. A frame is the physical instance of a graph node. |
| `NEXT-CLA-ADD-001_cla-extras.md` #4, #5, #9, #11 | #4 provisioned terminal positions **next to every portal**, #5 lábfény, #9 battery sensors, #11 BRIDGE SECURITY (**not built on Trinity**). The SmartFrame takes in #4 completely and touches the other three. Pack them together. |
| CoreRef (`<main checkout>/CoreRef/`, ESPHome 2026.9.1 + HA 2026.10.0) | Check **every** ESPHome component name used below against it before writing it into a doc. |

---

## 3. Findings from the analysis (what the next session must deal with)

### 3.1 The name

Already taken: **Gate** (Smart Gate Switch), **ARCH** (doc prefix), `prt` (portal-graph prefix),
**BKV** (any K-V abbreviation reads as the Budapest transit company). Candidates for the user:

| name | HU reading | for | against |
|---|---|---|---|
| **PORTA** (BRIDGE Porta, code `PTA`) | *porta* = gatehouse; *portás* = doorkeeper | matches the existing portal vocabulary; the doorkeeper metaphor fits a swarm head watching crossings; short, says itself in both languages | close to "portal", so docs must keep **portal** = the opening and **Porta** = the hardware |
| **KÁVA** | *ajtókáva* = door reveal / jamb | literally the place it lives; very Hungarian | the accent; no good 3-letter code (KVA = kVA) |
| **TOKKERET / Frame** | *tok* = door frame | plain | generic; "frame" collides with UI frames, picture frames, the SVG "frame" |
| **Kapufa** | goalpost (Π shape) | memorable, the exact shape | reads as a joke to a client |
| **Lintel Node** | — | technical, accurate | English only; it is more than the lintel |

*Draft recommendation:* **PORTA**. The opening is the *portal*, the hardware at it is the *Porta*,
and a Porta-equipped room is "portázott". **Ask (Q-SF-04).** Until then the docs use **SmartFrame**.

### 3.2 "Silver Rail" collides with "silver path"

In WORKSHOP-001, silver = endpoint → RBX. The user's Silver Rail runs RBX → frame, carrying the
upper layers that the frame then distributes. **Two readings:**
- **(a) Rail = a trunk of silver paths.** Silver paths from frame-served endpoints end at the frame;
  the rail is the shared conduit bundle from the RBX to the frame along ZW-o. The colour logic stays
  intact (silver = belongs to the room's RBX).
- **(b) Rail = a new tier between golden and silver** (hardware node ↔ sub-node). The frame becomes a
  hardware node like RBX/BASE, and its arms are silver.

*Draft recommendation:* **(b)** in the model (the frame is a hardware node: it has power, a
controller, and serves endpoints), **named Silver Rail** as the user wants, with silver paths
re-defined as *endpoint → its serving node (RBX **or** frame)*. This changes one line in WORKSHOP-001
§1. **Ask (Q-SF-05).**

### 3.3 The geometry is already a standard: DIN 18015-3 installation zones ⚑

DIN 18015-3 (Installationszonen, cited in WORKSHOP-001 R-rules) defines, from memory, **to be
verified against the text**:
- **ZS-t**: the vertical zone beside door openings, **100–300 mm from the raw opening edge**, on
  both jambs. **The SmartFrame verticals are ZS-t.**
- **ZW-o**: the upper horizontal zone, **150–450 mm below the finished ceiling** (preferred line
  300 mm below). **The Silver Rail and the channel above it are ZW-o.**
- **ZW-u**: the lower horizontal zone, **150–450 mm above the finished floor** (preferred 300 mm).
  **The lábfény band and the hinge-side low pocket are ZW-u.**
- ZW-m (1000–1300) only where worktops are; ZS-e corners 100–300 mm from the corner, which is where
  the **three corner cluster points** sit.

So the user's gate shape is ZS-t + ZW-o + ZS-t, which wiring practice already treats as the
legitimate place for concealed runs. A **cable found there is expected; a cable found outside it is
a drilling hazard.** This is the strongest argument for the concept and should open the concept
document.

**The conflict in the numbers:** IDEA-001's "high zone" starts at **1900**, but a horizontal run
**over a door** cannot be below **door head + architrave** (raw opening ≈ 2050–2100 + architrave
≈ 60–80 mm, so ≥ ≈ 2180). The rail's "lowest line of the high sáv" therefore has to be **over-door
safe**: ≈ 2200–2250 at the bottom, with the channel at ≈ 2350–2450, the DIN preferred line for a
2650–2750 ceiling. **CLA ceiling heights are not in the docs found** (`CLA-D1` has none). The next
session gets them from the plan PDF / Planner model, or asks.

**Lintels ⚑.** A precast lintel (áthidaló) over a masonry opening **must not be chased**, so the
horizontal arm over a masonry door can only run in render depth (thin), in a GK lining, surface /
skirting-type, or above the lintel. New GK partitions (the new bathroom wall, K29) have no such
limit. **Every SmartFrame needs a wall-material check**, and the Planner model needs to know the wall
type (check whether walls carry a material property; WP-G2 wall-refine may add one).

### 3.4 Hinge side, latch side, swing face: four faces, not one

Each door has **two jambs × two wall faces**. With the leaf open 90°+, the hinge-side wall on the
**swing face** is behind the leaf (dead space); on the **non-swing face** it is free wall. The
model already has handing (`variant` bits, `05t-needs.js` handle jamb). Consequences:

| zone | swing face | non-swing face |
|---|---|---|
| latch side (ZS-t) | traditional column: switch 1300, socket, kötődoboz, the dormant 700 box | same, the room's *other* side of the switch, usually empty → a second-room panel position |
| hinge side (ZS-t) | **behind the open leaf**: hidden, not reachable when the door is open; good for **things that should not be seen or touched** (gateway pocket, BLE proxy, buzzer, vented PSU niche, service hatch) | **free, visible wall** that nobody uses: good for **display/panel/intercom at 1450**, vertical light line |
| head (ZW-o) | rail + head sensors (ToF down, mmWave across) | rail continues; corner box on the room side |

**Which face gets the corner box** = the room the frame serves. A door between two rooms serves
**one** room (the one whose RBX feeds it) unless both sides are equipped (Q-SF-06, ties to
ADD-001 Q5).

### 3.5 Ideas for the hinge-side vertical zone (the user asked for these)

1. **Leaf cable transfer (kábelátvezető / Kabelübergang).** The hinge side is the only place
   power/data can enter the **door leaf**: concealed cable transfer or a power-transfer hinge.
   This makes leaf-mounted electronics possible: e-lock / latch-state, handle-touch sensing, leaf
   LED edge light, leaf-mounted contact without a battery. *Research: concealed cable transfers for
   interior doors (Dorma/Assa Abloy/Eff-Eff/Simonswerk/Dr. Hahn) and their HU availability and price.*
2. **Reveal-mounted crossing sensors.** In the reveal (the wall-thickness face of the opening),
   looking **across** the opening: ToF or IR break-beam at two heights (≈ 300 and ≈ 1000) gives
   **pet vs person** and, as a pair, **direction**, without a ceiling sensor. It complements
   STD-003 P-2 (ToF looking down from the lintel).
3. **Door-angle sensing.** A hall sensor or magnet at the hinge-side jamb gives **open / ajar /
   closed** and an angle, which STD-003's "open-door degradation" rule (D09) needs. Cheaper and more
   honest than a contact on the latch side.
4. **Vertical light line.** A recessed LED profile in or beside the hinge-side jamb, on bus B: an
   orientation/night line that marks the doorway in the dark and doubles as **emergency egress
   guidance** (bus B is assured). It continues the lábfény at the bottom (ADD-001 #5).
5. **Hidden service column (swing face).** Behind the open leaf: one Ladder-H hatch (200 × 200 or
   200 × 300) for the **AC/DC adapter point + the S3 head + bus A/B terminals**. It is serviceable
   and never in sight. Thermal: vented push-open (ARCH-001 §3.3).
6. **Visible control column (non-swing face).** CYD / panel / intercom / thermostat at the ≈ 1300–1500
   smart band, out of the way of the latch-side switch.
7. **Floor-to-ceiling riser.** The hinge-side vertical down to ZW-u carries the **lábfény feed, the
   low sensor pocket and a socket** without a second vertical chase on the latch side, which is
   already busy. This is the user's "secondary: hinge side to the floor".
8. **Acoustic pair.** One microphone at the hinge-side top and one at the latch-side top, about
   1 m apart (the opening width plus 2 × 200), gives a **left/right/through-the-door bearing**
   (TDOA on one board, because the two mics share the head's clock). §4.4 explains why
   distributed-mic localisation across nodes is not realistic.

### 3.6 Draft slot standard (for the "most with least" maths, to be refined, not decided)

Heights from finished floor, CLA switch height 1300 (user's own). The **frame grid**: vertical
zones on the ZS-t centreline at **150–200 mm** from the raw opening edge (HU practice ≈ 150, DIN
band 100–300); box pitch **71 mm** within multi-gang boxes (HU standard), hatches on Ladder H
100 mm, every box on the shared centreline (IDEA-002 §2).

| slot | height (mm) | side | holds (candidates) | box (draft) | layers |
|---|---|---|---|---|---|
| **L0** | 150–300 | hinge riser foot / ZW-u | lábfény feed & spot, nightlight socket, low PIR (AM312) / ToF-along-floor for segmented lábfény | Ø68 deep (60–65) | BUSB / LV, SENSOR |
| **L1** | 300 | latch | socket (existing practice) | Ø68 | SOC |
| **L2** | **700** (Q-SF-07: 700 or 850–900) | latch | **dormant parallel-switch box**, wireway to the 1300 box, parallel wiring pulled, blank plaster-flush (Dietzel HWD/TD 65) | Ø68 deep | LIGHT (provisioned) |
| **M1** | 1150 | latch | NTL-TR (STD-008 1100–1200), door-contact head | Ø68 | BUSB |
| **M2** | 1300 | latch | switch column: light, shutter, secondary control panel → **Chorus ONE 2–4 module plate** | 2–4-gang | LIGHT, HMI |
| **M3** | 1400–1500 | hinge, non-swing face | CYD / panel / intercom / thermostat — **one 2-module "terminal" slot** (ADD-001 #4 `PAN prep`) | 2-gang deep or panel back box | HMI, DATA, LV |
| **M4** | 1500–1650 | hinge | chest/head sensor node (mmWave LD2450 facing the room, thermal array optional) | Ø68 deep + sensor-transparent cover | SENSOR |
| **H0** | 2150–2250 | corner (Q-SF-08: latch or hinge) | **corner box (nest)**: S3 head, bus A/B, RS-485, AC/DC adapter, kötődoboz for mains in a separated compartment | 116 × 116 (KO 110/L) or a 200 × 200 partitioned hatch (M2 class) | CONTROL, DATA, BUSB, LV, MAINS (separated) |
| **H1** | ≈ 2200–2300 | over the door | **Silver Rail**: ToF pair (P-2), mmWave across the opening, speaker pair, buzzer | rail conduits; 1–2 Ø68 sensor pockets on the centreline | SENSOR, MEDIA, SECURITY |
| **H2** | ≈ 2350–2450 | over the door | **channel** (golden, cross-room), only where it passes | conduits only | channel |

*Draft tiers* (they map onto S5's Alap / Prémium idea and ADD-001's "provisioned" state):

| tier | what is built | covers |
|---|---|---|
| **SF-0 előkészítve** | H0 box + rail conduits + hinge riser conduit, all empty, bus B pair pulled | provision only (ADD-001 non-\* items) |
| **SF-1 portál** | SF-0 + S3 head + head sensors (H1) | STD-003 P-1/P-2 |
| **SF-2 keret** | SF-1 + M3 terminal + M4 node + L0 low pocket | the room's control point, lábfény |
| **SF-3 teljes kapu** | SF-2 + latch column integrated (L2 dormant, M1, M2) + acoustic pair + leaf transfer | full gate |

**The maths the next session should actually do:** treat it as a **set-cover with costs**. The
elements are the functions in §1's list plus the CLA room demands from `01_CATALOGUES.md`. The
candidate sets are slot × box size. The costs are chase metres + boxes + hatches (prices in
IDEA-002 §4). The constraints are zone heights, MAINS/SELV separation (EN 50174-2), reach (≤ 1.5 m
from the door for controls), wet zones, and the lintel rule. Find the **smallest slot set that
covers ≥ 90 % of functions for the CLA rooms**. Show it as a table of functions × slots, with the
naive count (one box per function) beside it, as IDEA-001 §3.6 did.

### 3.7 Power budget method (bus B)

Rough *draft* figures, to be replaced with datasheet values: S3 head with WiFi ≈ 0.4–0.6 W average ·
C3/C6 satellite ≈ 0.15–0.3 W · LD2450 ≈ 0.5 W · ToF ≈ 0.1 W · small amp idle ≈ 0.1 W, peaks a few W
· 12 V buzzer ≈ 0.3–1 W while sounding. **≈ 2–3 W per SF-2 frame continuous.** CLA with ≈ 8 frames
≈ 20–25 W on bus B, plus NTL and egress lights. The session sizes the K27 assured pack for a stated
hold-up (e.g. 4 h full, 24 h in "sentinel" mode with radios duty-cycled) and checks it against
whatever pack BUILD-001 already specifies. Also: the frame must **step down 24 V locally** (buck to
5 V / 3.3 V; 12 V for the buzzer), and what is lost on bus B voltage drop over the rail length.

---

## 4. The swarm module set (draft for the write-up the user asked for)

### 4.1 Head vs satellites

- **Head (1 per frame): ESP32-S3 N16R8** on the Modulshop 44-pin I/O shield. Its jobs: the
  **BRIDGE_LINK RS-485** transceiver to the RBX · WiFi + **ESPHome Bluetooth proxy** (ARCH-001 §4.1)
  · **ESP-NOW coordinator** of its satellites (STD-005 already reserves ESP-NOW on channel 1) ·
  **I²S audio** out (small amp + the "laptop speaker" pair) and in (the acoustic pair §3.5-8) ·
  optional **voice satellite** (the S3 can run on-device wake word, ESPHome `micro_wake_word` +
  `voice_assistant` ⚑ check CoreRef) · CYD link · buzzer / siren driver · local **autonomy** (rules
  that run with BRIDGE absent, the "half-independent" requirement).
- **Satellites (2–3 per frame): all ESP32-C6** is the *draft recommendation* over C3: 802.15.4
  (Thread/Zigbee, so a satellite can also be a Thread router or the ADD-001 #9 battery-sensor
  parent), WiFi 6, BLE 5, an LP core, and CSI-capable. C3 is cheaper and more mature but has no
  802.15.4. Form factor: "SuperMini"-class boards (≈ 23 × 18 mm) fit a Ø68 deep box. ⚑ Verify
  current C6 SuperMini availability at Modulshop/HU vendors, the ESPHome C6 support level (ESP-IDF
  framework only?) and its Thread role support.
- **Head ↔ satellite link:** *draft* = **wired power (from the frame's 5 V) + ESP-NOW data**, with an
  optional wired UART/RS-485 drop in the same conduit as the fallback and ghost-network path.
  Verify ESPHome's `espnow` and `packet_transport` components in CoreRef 2026.9.1.

### 4.2 One satellite board, three personalities (the "universal unit types")

Standardise the **satellite carrier**, not the sensors: every satellite exposes the same ports, and
a personality is just which sensor modules are plugged in.

- **Ports (draft):** 2 × **Qwiic / STEMMA QT** (JST-SH 4-pin I²C, a big ready-made module ecosystem)
  · 1 × 4-pin **UART** (mmWave radars) · 1 × **I²S** (mic) · 2 × GPIO (PIR, reed/hall, buzzer).
- **Power in:** 5 V from the head (or 24 V bus B with an on-board buck, Q-SF-09).

| personality | sensor modules (2–4) | gives | where |
|---|---|---|---|
| **SAT-P portál** | 2 × VL53L1X (ToF down, 200 mm apart, XSHUT for addressing) · LD2450 (mmWave, position tracking, across the opening) · reed/hall door angle | P-2/P-3 crossing: direction, count, adult/child/pet, speed, door state | H1 over the door |
| **SAT-E klíma** | SHT4x (T/RH) · SCD41 (CO₂) · VEML7700 (lux) · SGP41 or BME680 (VOC) | comfort, ventilation trigger (ADD-001 #10), daylight for circadian shutters (ADD-001 #1) | M4 or a corner cluster |
| **SAT-L alsó** | AM312 PIR (looking down/along) · VL53L1X or LD2450 along the floor · VEML7700 | lábfény trigger + segmented lábfény presence (ADD-001 #5b), night path | L0 |
| *(optional)* **SAT-A akusztika** | 1–2 × INMP441 (I²S) · buzzer driver · NTL LED | sound-level events, coarse localisation, alarm sounder | H0 / H1 |

**Useful multisensor combinations to offer the user** (the request asked for examples):
- *Doorway truth:* ToF pair + mmWave + door angle. The portal graph gets count and direction, and
  mmWave ghosting is vetoed (STD-003 §2.5).
- *Room comfort:* T/RH + CO₂ + lux. Thermostat, ventilation and circadian light from one pocket.
- *Wet room:* T/RH + VOC + pressure (BMP390). Extractor run-on and a shower-start detect (humidity
  slope), ADD-001 #10.
- *Night path:* low PIR + lux + floor ToF. Lábfény only when dark and only where someone is walking.
- *Sentinel (ghost network):* mmWave + mic level + door angle, running on bus B with WiFi off and
  ESP-NOW only, reporting to the BASE over the swarm when the main network is down (§4.3).
- *Wellbeing (parked topic, BRIDGE CLA open questions):* thermal array (MLX90640) + mmWave vital
  signs in the bathroom/bedroom, for fall / no-movement alerts. Bring it up, do not design it.

### 4.3 The higher, emergent functions: what is realistic

| function | how | realistic? |
|---|---|---|
| **Crossing / direction / count** | SAT-P + the portal graph (STD-003 §2) | **yes**, proven pattern |
| **Trusted-device tracking between portals** | every head is a BLE proxy, and HA-side room-level BLE localisation (check **Bermuda BLE Trilateration** and **ESPresense** licences and HA fit) | **yes**, room level, not cm |
| **RSSI change telemetry (device-free)** | heads and satellites exchange ESP-NOW beacons; a body in the link path changes RSSI/CSI. Check **espressif/esp-csi** (licence, S3/C6 support) and any ESPHome/HA CSI integration | **experimental**: good as a *motion evidence* term in the STD-003 fusion (log-odds), not as a locator |
| **Sound localisation** | TDOA needs µs-synchronised mics: **only within one board** (the head's mic pair, §3.5-8). Across nodes, use **level comparison** (which frame heard it loudest) | bearing at one door yes; room-scale TDOA no |
| **Fallback network** | ESP-NOW swarm frame → frame → BASE, independent of WiFi APs; BRIDGE_LINK RS-485 as the wired spine | **yes**; define what traffic is allowed (alarms, presence, NTL) |
| **"Ghost network" for security** | the same swarm with WiFi off / hidden, encrypted ESP-NOW (PMK/LMK), on bus B; carries the security layer when WiFi is jammed or down | **yes** as a concept; it is what ADD-001 #11 "BRIDGE SECURITY" should be built on → **merge the two topics** |
| **Habit / identity observer** | HA-side (history + an occupancy model), **not** on the ESPs; bounded by STD-003 §4.5 privacy rules; identity = the Trinity principle, but the observer must not *depend* on Trinity (ADD-001 #11) | yes, software; flag privacy |

### 4.4 Standalone mode (the "half-independent" requirement)

Define what one frame does with **no BRIDGE** (no HA): local rules on the head (e.g. presence →
lábfény, door open at night → NTL, sentinel → buzzer), a local web UI or the CYD, and what a set of
frames does with **each other but no hub** (ESP-NOW mesh: count propagation, alarm relay). This is
the part where the SmartFrame **departs from the BRIDGE standard** (Q-SF-03): BRIDGE says the hub
is the brain. Write the departure as an explicit rule, e.g. *"a frame never needs the hub for the
functions in tier SF-1; it needs the hub for history, identity and cross-room scenes."*

Licences: MIT/Apache/BSD only for anything that ships on client devices. **No AGPL**
(ElegantOTA, ESP-DASH, WebSerial), per the S3 shortlist rule. The shortlist is at
`H:/Dev-VRG/VRG-DE/_inbox/s3_gits/_SHORTLIST.md`.

---

## 5. Room pattern and the Planner (pre-analysis for the later pack)

### 5.1 The room pattern, as understood (confirm Q-SF-10)

- **Three primary nodes:** frame A on wall 1, frame B on wall 2 (the two arms of an L), **RBX
  between them** (on the corner or along one arm). Rail = frame A → RBX → frame B along ZW-o,
  following the two walls.
- **Three cluster points** at the **three corners the L does not occupy**. With the RBX corner
  that makes all four corners instrumented, which is exactly STD-001's *corner radio nodes / UWB
  anchors ×3* for living rooms. Draft: corner cluster = a ZS-e high pocket (2150) with a SAT-E/RF
  node, fed from the nearest frame or the RBX.
- Rooms with **one door**: one frame + RBX, a straight rail. **No door on the second arm**: the second
  arm's frame becomes a **"blind frame"** at a corner cluster (Q-SF-10b).

### 5.2 Layer order the user wants in the Planner

1. Construct + marks (walls, openings with handing, wall material).
2. Hardware: Elosztó, BASE, **RBX** (existing C1/C2/C4).
3. **Frames** as a new hardware node kind, anchored to a door (id + face + side derived from
   `variant`), with a tier SF-0…3.
4. **Silver Rail**: RBX → frames along ZW-o (a new route kind, or `route:'rail'`).
5. **Channel** (golden) runs: where a cross-room channel shares the wall, it runs **above** the rail
   (ZW-o upper line), direct or chained through the frame's H2.
6. Endpoints: codes that today say `from:'rbx'` may say **`from:'frame'`** when inside a frame's
   reach (the offload). POR (CONTROL + SENSOR) and NTL move **into** the frame by default.
7. Corner cluster points.

### 5.3 What to read in the code before writing the pack (anchors to verify)

`src/05t-needs.js` (handle jamb ≈ 180, `doorFlank` anchor) · `04-render.js` ≈ 166 (door variant
bits) · WP-C1 hardware nodes / WP-C2 rbx-serving / WP-C4 base placement / WP-C5 channel routes ·
WP-E1/E2 arms and route graph · round 2026-10-10 **WP-S2 one-room-rbx, WP-S3, WP-S4
routes-follow-hardware** (they change the same ground, so **the Planner pack waits until R1010 is
built**) · WP-B5 portal graph · `docs/stack/00_CONTRACT.md` data additions format.

Likely new model items (for the pack, not now): `hwNode.kind:'frame'` · `route:'rail'` · endpoint
`from:'frame'` · door-face selection · a wall `material` (lintel rule) · tier / provisioned state
(shared with ADD-001 §3).

---

## 6. Research list for the next session (web + CoreRef, cite sources)

1. **DIN 18015-3 zones**: exact ZS-t / ZW-o / ZW-u figures, and whether MSZ HD 60364-5-52 or a
   Hungarian practice note says the same (⚑ §3.3).
2. **HU interior door dimensions**: standard leaf 65/75/90/100 × 210, raw opening sizes, tok and
   architrave widths, typical lintel types and heights (Porotherm/Leier), and the "no chasing into
   lintels" rule source.
3. **Flush boxes**: real 100 × 150 / 150 × 150 / partitioned boxes for masonry and GK (Kopos, Kaiser,
   Spelsberg, Dietzel, JANGAR), depth ≥ 60, with a mains/SELV divider; prices at HU vendors
   (IDEA-002 §7 vendor channel).
4. **Concealed door cable transfers / power-transfer hinges** for interior doors (§3.5-1).
5. **Hardware**: Modulshop ESP32-S3 N16R8 dual USB-C board + the 44-pin I/O shield (exact
   product, pinout, free GPIOs after RS-485 + I²S + I²C), ESP32-C6 SuperMini availability, LD2450,
   VL53L1X, SCD41, VEML7700 modules in Qwiic form at HU/EU vendors (check the VRG Inventory /
   BuildTree first: Modulshop buys go in `Modder/vrg-buildtree.html`).
6. **ESPHome (CoreRef 2026.9.1)**: `espnow`, `packet_transport`, `ld2450`, `vl53l0x` (is there a
   `vl53l1x`? if not, note the external-component route), `scd4x`, `veml7700`, `sht4x`, `sgp4x`,
   `i2s_audio`, `micro_wake_word`, `voice_assistant`, `rs485`/`modbus`, `bluetooth_proxy`, C6
   support.
7. **Localisation**: Bermuda BLE Trilateration, ESPresense, espressif/esp-csi (licence, status,
   HA fit). Is there a maintained ESPHome/HA CSI motion integration?
8. **Accessibility heights** for the dormant parallel switch (EN 17210, OTÉK / HU accessibility
   guidance: is 700 or 850–1000 the norm?).
9. **Bus B pack**: what BUILD-001 K27 already specifies, and sizing for N frames.

---

## 7. Questions to ask the user FIRST (before the concept doc), with draft defaults

| # | question | draft default |
|---|---|---|
| Q-SF-01 | Your sentence ended mid-way: *"L shape based rooms … like the living room and the bedroom of CLA will have wall clusters in the …"*. How does it continue? | — |
| Q-SF-02 | "Create a new version of this part in the document": which document? (a) BRIDGE STD-003 §2 portal model, (b) STD-001 door frame point, (c) a new standard **STD-009 SmartFrame**, (d) the Planner layer help (`01_MATERIAL`) | **(c) a new STD-009**, with STD-003 §2.4 and STD-001's room table amended to point to it; the Planner text follows in the pack |
| Q-SF-03 | ARCH-001 says "no second low-voltage backbone; the hub is the brain". The SmartFrame is a bus B SELV feed and runs standalone. Is that a deliberate, documented departure? | yes: state it as a rule (§4.4) |
| Q-SF-04 | Name: PORTA / KÁVA / Kapufa / other? | **PORTA** (§3.1) |
| Q-SF-05 | Silver Rail: a new tier (frame = hardware node) or a bundle of silver paths? | **new tier**; silver re-defined as endpoint → serving node |
| Q-SF-06 | A door between two rooms: one frame serving one room, or both faces equipped? | one face (the serving RBX's room), the other face SF-0 if wanted |
| Q-SF-07 | The dormant parallel box: 700 mm as written, or the accessibility range 850–1000? | ask; recommend matching the cited accessibility norm |
| Q-SF-08 | Corner box (H0): **latch** upper corner (today's placeholder) or **hinge** upper corner (where your L starts)? | **hinge-side upper corner on the non-swing face** when that face is the served room; else latch. The latch column stays the traditional switch column, the hinge side becomes the smart column |
| Q-SF-09 | Satellites: all C6 or all C3? Powered 5 V from the head, or 24 V each? | **C6, 5 V from the head** |
| Q-SF-10 | Room pattern: is §5.1 right (two frames on the L's arms, RBX between, three corner clusters at the corners the L leaves out)? And with only one door, a blind frame? | as §5.1 |
| Q-SF-11 | Tiers SF-0…3: do they map to S5's Alap / Prémium? | SF-0/1 = Alap, SF-2/3 = Prémium |
| Q-SF-12 | Merge ADD-001 #11 "BRIDGE SECURITY" with the swarm's ghost network into one research document? | **yes** |

Ask them in one batch (or as a BRIDGE tuner pack `BSF-Q-001` in the R1010-Q-001.json format if the
user prefers the tuner), then write.

---

## 8. What the next session produces (and in what order)

**Phase 1 (docs only, any time; may run before R1010 is built):**
1. Ask §7. Do the §6 research (send parallel searches in one turn; cite everything).
2. Write **`docs/stack/IDEA-003_smartframe.md`** (IDEA-001/002 format): concept, the DIN-zone argument,
   the four-face geometry, the slot standard with the set-cover table for CLA, tiers, the
   hinge-side ideas, the swarm module set, standalone rules, power budget, open questions.
3. **Own illustrations** (memory rule: draw, don't collect): an SVG **elevation of one door, both
   faces**, with slots L0–H2, the rail and the channel; an SVG **room plan** of the L pattern
   (CLA nappali). Keep the generator script, never hand-edit output.
4. ⏸ **Stop: fine-tune with the user.**

**Phase 2 (after fine-tuning):** the BRIDGE document version the user picked in Q-SF-02 (main
checkout `H:\Dev-VRG\VRG-DE\Planner_VRG_U100\BRIDGE\…`, branch `main`), plus amendments to STD-003
§2.4 and the STD-001 room table, and WORKSHOP-001 §1 (silver).

**Phase 3 (only after round 2026-10-10 is built):** a Planner pack **`docs/round-cla-add-001/`**
together with the other CLA-ADD-001 items (same format: contract, material, WPs, decisions). Build
nothing.

**Rules:** never commit or push unless the user says so; explicit paths, never `git add -A`.
Hungarian UI strings, English code. One session at a time in the worktree: if another session is
building R1010 there, write only the new files named above and tell the user.
