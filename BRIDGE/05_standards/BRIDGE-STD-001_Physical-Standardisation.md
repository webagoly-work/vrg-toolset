# BRIDGE-STD-001 — Physical Standardisation

**Doc:** BRIDGE-STD-001 · **r2** · 2026-10-05 · English
**Parent:** BRIDGE-ARCH-002 r1 (architecture) · BRIDGE SELV Telepítési Standard + Melléklet 1/A (craft)
**Annex:** [STD-001-A1 Passive Thermal Design](BRIDGE-STD-001-A1_Passive-Thermal-Design.md) — which
**supersedes the vent areas formerly in §2.6**
**Closes:** U13 CHANNEL buildup · U14 RoomBox modular layout · U15 ARM composition ·
U16 Edge RoomBox · U18 per-room buildup order · U6 thermal budget
**Scope:** the dimensioned, buildable layer beneath ARCH-002. Where ARCH-002 says *what exists
and what connects to what*, this says *how big, how deep, in what order, with what clearance.*

> **r2 applies the round-2 decisions** (`_build/BRIDGE-A-002_decisions.md`) and the recommendations
> in `_build/BRIDGE-E-002_open-items-briefing.md`. Material changes: uniform **110 mm** minimum
> depth · a **row-pitch rule** rather than one pitch · **two spares** in the bundle ·
> **three-letter** endpoint codes · corrected **vent areas** · relaxed **pull-point interval**.

> **Reference scenario S-C.** Dimensions are design envelopes, not product cut-outs. Power work
> to MSZ HD 60364, cable separation to EN 50174-2 and MSZ HD 60364-5-52 §528, SELV to
> IEC/MSZ HD 60364-4-41, fire to OTSZ 54/2014 (BM). Life-safety detection remains certified
> standalone devices; BRIDGE sensors are supplementary and never the only line of defence.

> **Who builds this (A08).** The installation is owner-built, including the mains, so this document
> is written for the person holding the tools rather than for a contractor reading a specification.
> One practical consequence: a fixed 230 V installation still needs a qualified sign-off and
> measurement record (*szabványossági felülvizsgálati jegyzőkönyv*) for insurance and for any later
> sale, whoever did the physical work. Engage the certifying electrician early — they will want to
> see the design, and a design documented to this level is unusually easy to certify.

---

## 1. The dimensional system

One decision governs everything below: **BRIDGE adopts the DIN module as its horizontal unit.**

| Unit | Value | Why |
|---|---|---|
| **M** — horizontal module | **18 mm** | The consumer-unit module. BRIDGE-DN is already drawn on it (48 modules = 4×12). Adopting it in the RoomBox means the cabinet and the room node speak one dimensional language, and the same gear fits both. |
| **R** — vertical row pitch | **125 mm default · 150 mm for the PSU row** | 125 mm is the consumer-unit pitch: 45 mm device face + 80 mm wiring. See the rule below. |
| **D** — depth planes | **D1** 0–25 mm · **D2** 25–80 mm · **D3** 80 mm → rear | Front/cover, device, and conduit-and-service-loop planes respectively. |

Everything in a RoomBox is positioned as `(module, row, plane)`. A zone is a rectangle of
modules × rows at a stated plane.

### 1.1 Row pitch follows what sits on the row (B02)

One pitch for the whole box is the wrong answer; so is choosing per project. **Pitch follows the row's
contents**, which makes "both, for different cases" into a rule:

| Row contents | Pitch |
|---|---|
| Terminals, compact modules, the sub-controller, I/O expanders | **125 mm** |
| **The PSU row** — deepest, hottest, stiffest cable | **150 mm** |
| Any row with full-depth DIN gear fed from both sides | 150 mm |

Each class therefore carries a **stated row map** (§2.1) rather than a uniform pitch. A side effect
works in our favour: a taller box is a taller chimney, which the thermal annex needs.

---

## 2. RoomBox — standardised internal layout (U14)

### 2.1 Envelopes on the grid

Internal clear dimensions from ARCH-002 §8.4, resolved into usable grid counts.

**Depth is uniform at 110 mm minimum (B01).** One depth rule means any gear fits any class, at the
cost of a slightly deeper chase everywhere — which is the right trade, because a box that cannot
accept the device you want is worse than a chase 20 mm deeper.

| Class | Internal clear W × H × D | Usable modules | Row map | Use |
|---|---|---|---|---|
| **RB-M** | 400 × 500 × **110** | **22 M** | 150 PSU + 2 × 125 + shelf | bedroom, study, kitchen |
| **RB-L** | 500 × 600 × **110** | **27 M** | 150 PSU + 3 × 125 + shelf | living, media, open plan |
| **RB-H** | 600 × 600 × **120** | **33 M** | 150 PSU + 3 × 125 + shelf | RoomBox 1, any chain node carrying 2+ rooms' pass-through |
| **RB-O** | 400 × 500 × **150** IP65 | **22 M** | 150 PSU + 2 × 125 | garden, terrace, garage, irrigation |
| **RB-E** | per §5 | — | per variant | run-end / border / special function |
| **RB-S** *(special)* | 300 × 400 × **110** | **16 M** | 150 PSU + 125 + shelf | **see below** |

> **RB-S is now a special-purpose design, not a standard class (B01).** At 110 mm it accepts
> ordinary gear, but its 300 × 400 envelope still limits it to terminals, a compact PSU, a
> sub-controller and roughly four relay modules. **Use it only where the envelope genuinely cannot
> be larger** — a shallow partition, a cramped cupboard, a retrofit chase. The default for a bath,
> WC, pantry or hall is **RB-M or an RB-E variant**, not RB-S.
>
> The original 90 mm shallow version is retained as a documented **edge-case design** for walls that
> cannot take 110 mm. It accepts no full-depth DIN device and should be treated as an exception
> requiring a note on the drawing, not a size to specify casually.

The shelf on each row map (the residue above the last full row) is **not** a device row. It is the
sensor shelf and RF head — see §2.3.

### 2.2 Vertical zone order — and why it is this way round

**Confirmed (B04), and the annex supplies the physical reason** rather than a convention. Air enters
low and leaves high, so:

1. **Heat sources go high.** The PSU is 18 W of RB-L's 41 W typical — the single largest source. At
   the top its rise leaves immediately through the upper slot; at the bottom it would warm every
   zone above it on the way out, and the sensor shelf worst of all.
2. **Sensors go low**, in incoming air — the coolest air in the box and the closest to the
   temperature of the room they are trying to measure. *A temperature sensor downstream of a power
   supply measures the power supply.* This is also what ARCH-002 §8.3 already requires when it puts
   Z5 "ventilated, at the bottom of the box."

The habit of putting mains at the bottom exists because that is where cable enters a consumer unit
standing on a floor. A box at 1.9 m has no such constraint. Full derivation in
[STD-001-A1 §3.2](BRIDGE-STD-001-A1_Passive-Thermal-Design.md).

Bottom to top, therefore:

```
  ┌─ D1 ────────────────────────────────────────────────┐  ← vented / RF-transparent cover
  │                                                     │
  │  ROW 3   Z1  MAINS          230 V in · terminals ·  │  heat out ▲
  │                             bistable relays ·       │
  │                             dimmers · shutter       │
  │                             interlocks · 230→24 V   │
  │          ══════ reinforced partition, IP2X ══════   │
  │  ROW 2   Z3  DATA/MEDIA/USB PoE switch · keystones ·│   Z4
  │                             HDMI · USB ext · amp    │   RF
  │          ─────────────────────────────────────────  │  column
  │  ROW 1   Z2  LV & CONTROL   24→12 adj · 24→5 ·      │  (D1–D2,
  │                             fused SELV branches ·   │   behind
  │                             sub-controller · iso    │   RF
  │                             RS-485 · I/O · SELV TB  │   window)
  │          ─────────────────────────────────────────  │
  │  SHELF   Z5  SENSOR         T/RH · CO₂ · VOC · lux ·│  air in ▲
  │                             mmWave   (RB-L/H only)  │
  └─────────────────────────────────────────────────────┘
     ZT pass-through occupies the full width of plane D3, untouched and labelled.
     ZI internal monitoring is distributed, not a zone — see §2.4.
```

**Z1 on top also places the 230 V zone furthest from the sensor shelf and the RF column**,
which is the right answer for EMI as well as for heat. The cost is that MAINS conduits enter
from the top — which is where they come from anyway, since they run from the cabinet through
the ceiling or wall head.

### 2.3 Z4 — the RF column

**Confirmed (B05): a vertical column on the hinge-opposite side**, spanning the full row stack in
planes D1–D2, isolated from Z1 by the partition and closed by a **non-metallic RF window** in the
cover.

> **It earns a second job.** Left **open at top and bottom**, the RF column becomes a clear vertical
> duct — the one path through the box guaranteed never to be packed with cable. Requirements:
> ≥ 20 mm clear front-to-back, unobstructed at both ends, radios mounted against the column's outer
> wall so the duct stays open. A **vented** RF window is better than a solid one. See
> [STD-001-A1 §3.3](BRIDGE-STD-001-A1_Passive-Thermal-Design.md).

- Houses: ESP32-C6 (WiFi/BLE/802.15.4), the S3+H2 Thread border-router pair, a Zigbee router,
  sub-GHz transceivers (CC1101 class, 433/868), the 2.4 GHz HID gateway, and the IR head.
- **The IR emitter and receiver must sit at the window with line of sight into the room.** This
  is the one element in the box with a hard optical requirement, and it sets where the window
  goes.
- Antennas stand clear of metal by ≥ 20 mm and never cross the partition.
- **The WiFi access point is not in here.** Per ARCH-002 §10.8 the AP is a ceiling endpoint on
  a dedicated PoE ARM; the RoomBox powers it, it does not host it.
- **LoRa never appears here.** BASE-only protocol.

### 2.4 ZI — internal monitoring, distributed

Not an area. Four fixed positions:

| Sensor | Position |
|---|---|
| PSU body temperature | on or within 20 mm of the 230→24 V unit, row 3 |
| Box air temperature + RH | mid-height, row 2, away from the partition |
| Door / tamper switch | on the door, latch side |
| Water-ingress detector | floor of the box, lowest point |

Plus per-branch current measurement on every SELV branch leaving the box (ARCH-002 §8.5).

### 2.5 Clearances, entries and fill

| Item | Value |
|---|---|
| Service clearance in front of cover | **100 mm** minimum, door swing **110°** |
| Mounting height, bottom edge | **≥ +1.90 m**, near the room entrance, permanently accessible — see **§7** on the height conflict |
| MAINS cable entry | **top**, dedicated gland positions, into Z1 only |
| LV / CONTROL / SENSOR entry | **bottom**, into Z2 / Z5 |
| DATA / MEDIA / USB entry | **side**, CHANNEL side, into Z3 |
| CHANNEL arrival + pass-through | **side**, into plane D3 (ZT) |
| Cable entry method | **knockouts + glands** (B15) — sealed, at defined positions |
| Service loop per cable inside ZT | **300 mm** (B16) |
| Day-one fill per zone | **≤ 60 %** of zone volume, **and see the channel rule below** |
| Door | **hinged paintable polymer** (B13) — RF-transparent, vanishes into the wall, vents easily |
| Partition | metal or reinforced polymer, IP2X toward every other zone; relay panels require reinforced coil-to-contact insulation, **≥ 8 mm creepage class** (ARCH-002 §10.1) |
| Earthing | one star point to PE; every zone cage bonded separately |

> **The fill rule that matters (B07).** 60 % was drafted as headroom for future equipment. It is
> also what keeps air moving — a box packed to 90 % has no internal path and the cover slots do
> nothing. So: **a clear vertical channel of ≥ 20 mm must remain at the front of every zone, from
> the lower slot to the upper.** Cable may fill the depth behind it; the front channel is the
> chimney and nothing lives there. That rule does more for the thermal result than the percentage.

**Cover finish follows the space (B14).** Flush paintable in living spaces — bedroom, living, hall,
where the box should disappear. **Visible service panel** in utility spaces and anywhere access is
frequent — pantry, garage, plant position. Flush is only safe because two things make the box
recoverable: the **as-built photographs keyed to the room in the Planner** (A07), which are not
optional, and an **NL-ND notification light beside the box** (STD-008 §3), which marks the position
without reading as equipment. A discreet light is a better find-aid than a panel.

### 2.6 Thermal budget (closes U6) — **revised in r2**

Natural convection only. **No fans are required** at the vent areas below; B17's provision for a
fan in RB-H is retained as a documented fallback should a commissioning measurement come in hot,
not as a design assumption.

| Class | Typical dissipation | Design maximum | **Free vent area, PER OPENING** |
|---|---|---|---|
| RB-S *(special)* | 12 W | **25 W** | **≈ 3 000 mm²** · 280 × 11 mm slot |
| RB-M | 22 W | **40 W** | **≈ 4 800 mm²** · 380 × 13 mm slot |
| RB-L / RB-H | 41 W | **70 W** | **≈ 8 500 mm²** · 480 × 18 mm slot |
| RB-O | 25 W | **45 W** | sealed IP65 + breather (B18) — conduction only, derate 20 % |

> **These figures replace r1's, which were about five times too small.** r1 specified 1 200 / 2 000 /
> 3 500 mm² *total*; the requirement is 3 000 / 4 800 / 8 500 mm² **per opening**, with **two
> separated openings** — one low, one high. At r1's figures an RB-M at its 40 W design maximum would
> settle roughly **50 K above ambient**: 72 °C in a 22 °C room, 85 °C at the design ambient, which
> cooks electrolytics and voids most PSU derating curves. Derivation, and the reason a chimney above
> the box cannot help, in [STD-001-A1](BRIDGE-STD-001-A1_Passive-Thermal-Design.md).

**Three requirements come with the area.** Separated openings top and bottom, or air enters and
leaves through adjacent slots without crossing the box. An **internal baffle** behind the lower slot
directing incoming air to the rear. And **no filter** — a wall box in a bedroom gets no service
schedule, and a blocked filter is an invisible failure.

Worked case, RB-L at design maximum: 150 W PSU at 88 % → 18 W · 8-port PoE switch carrying
~40 W of PoE at 90 % plus idle → **12 W** (raised in r2 per STD-005 §1, which moved the switch to
the local rail at a 63 W injection budget) · sub-controller 3 W · radios 3 W · relays and dimmers
3 W · Class-D **2-channel** amp bay at moderate output 3 W. **≈ 42 W typical.**

**A multichannel amp bay does not fit any class** — six channels are ~9 W typical and ~30 W peak.
Multichannel audio moves to a dedicated AV position (§5.1, STD-007 §2.3).

**Maximum design ambient 35 °C** inside a wall cavity in summer; derate the PSU above 40 °C.
**Acceptance at ΔT ≤ 25 K** air-to-room after 60 minutes at three-quarter load.

---

## 3. CHANNEL — pathway and wiring buildup (U13)

### 3.1 The bundle

The five CHANNEL conduits travel as one identifiable array. They are all SELV/data class, so
they may share a void or trench — **never a conduit**.

```
   direction of travel: BASE ────────────────────────────────────────►

   ┌──────┬──────────┬──────┬──────┬──────┬──────┐
   │  C1  │    C2    │  C3  │  C4  │ C4b  │  C5  │   total width ≈ 200 mm
   │ M25  │   M40    │ M20  │ M25  │ M20  │ M20  │   clipped at 300 mm centres
   │ DATA │  MEDIA   │ CTRL │SPARE │SPARE │ KNX  │
   └──────┴──────────┴──────┴──────┴──────┴──────┘
    left ──────────────────────────────────► right, viewed along the direction of travel from BASE
```

**The order is fixed and never varies.** That is the whole point: at any pull point, in any
room, five years later, C3 is always third from the left looking away from BASE.

| Conduit | Size | Day-one cable | Reserved for |
|---|---|---|---|
| **C1 DATA** | M25 | 2 × Cat6A U/FTP (PoE uplink + spare) | second PoE feed |
| **C2 MEDIA** | M40 | 1 × HDMI 2.1 AOC + 1 × Cat6A (HDBaseT / HDMI-over-IP) | next video standard |
| **C3 CONTROL** | M20 | 1 × Cat6A S/FTP (BRIDGE_LINK) | second RS-485 on pair 2 (CAN reserved, E10) |
| **C4 SPARE** | M25 | **empty + draw cord** | coax, fibre, audio |
| **C4b BUS B** | M20 | **the assured 24 V bus B pair** (K25) | — *(was the spare reserved for a DALI pair; that reservation moves to C5, or C4 if KNX is taken)* |
| **C5 KNX** | M20 | **installed empty** even if KNX is not taken (B10) | KNX TP |

> **Two spares, not one (B08).** r1 specified a single M32. Two independent spares of different
> sizes — M25 and M20 — give two separate futures rather than one large one, and the small one is
> the natural home for a **DALI pair** should C20 ever be revisited.
>
> **C5 is installed empty regardless (B10).** The cheapest moment to put a conduit in a wall is
> while the wall is open. The position was already reserved so the bundle order would not shift;
> installing the pipe costs a few metres of M20 and removes the decision entirely.
>
> **No dedicated fibre conduit (B09).** Cat6A carries 10 Gb to 55 m and 10GBASE-T to 100 m, so fibre
> to a RoomBox solves a problem a dwelling does not have. C4 with a draw cord pulls it in an
> afternoon. **The real fibre case is the LAYER TIE**, where a split BASE puts NET and MEDIA in
> different parts of the house — a different run with a different justification.

**MAINS does not travel in this bundle.** Room circuits run from the cabinet on their own
route — M25 per circuit group — and in a corridor they take the **opposite side** from the
DATA/CONTROL/MEDIA bundle (ARCH-002 §7.2). **SECURITY** runs parallel to the CHANNEL in its
own conduits entirely (§12).

**BRIDGE_LINK pair allocation**, unchanged from ARCH-002 §7.3: pair 1 RS-485 A/B · pair 2
second RS-485 or CAN · pair 3 life signal / interlock · pair 4 reference ground + spare.
No power on BRIDGE_LINK. **Shield earthed at the BASE end only** — this matches the SELV
standard's one-point rule and must not be "improved" by bonding both ends.

### 3.2 Construction section

| Condition | Requirement |
|---|---|
| In floor screed | conduit crown **≥ 25 mm** below finished floor level, **verified against the actual buildup room by room** (B26); bundle laid flat, not stacked |
| **In screed with underfloor heating** | **the conduit goes in the insulation layer beneath the screed, not in the screed.** UFH pipes occupy the same zone, the conduit must sit below them, and the available depth runs out fast. This is a coordination item with the heating design, not a dimension to pick |
| In chased masonry | **≥ 20 mm** cover over the conduit, plaster mesh over the chase |
| In a ceiling void | clipped to structure at 300 mm centres, never resting on insulation or ductwork |
| In a stud partition | through grommeted holes at mid-depth, ≥ 25 mm from the plate edge |
| Crossing MAINS | cross at **right angles**; MAINS in the mechanically more protected position (deeper, or its own conduit) |
| Parallel to Cat/PoE | a few cm separation for EMI, not for safety |
| Through a fire compartment | fire-rated sleeve with intumescent collar per OTSZ; recorded in the as-built |

### 3.3 Bends, pull points and labelling

- **≤ two 90° bends** between pull points.
- **The interval is bend-driven, not distance-driven (B25).** A pull point wherever a third bend
  would otherwise accumulate, and **every ~15 m as a default — extending to 22–24 m where the run
  is straight and unobstructed.** A straight 20 m pull in smooth conduit with a draw cord needs no
  box; a 10 m run with two bends and a rough joint does.
- **Bend radius ≥ 8 × cable OD** (B27) — Cat6A gives ≈ 65–75 mm, so a sweep, never an elbow.
- **Draw cord in every conduit**, including occupied ones.
- **Both ends labelled** `<project>-R<room>-C<n>`, machine-printed, legible after plastering.
  **Label stock is chosen by access, not by date (A06): thermal transfer for anything that will be
  buried, plastered over or sealed** — those labels can never be replaced, and they are the ones that
  have to be legible in twenty years. Laser print in a clear sleeve is fine for cabinet rows, patch
  panels and anything behind a door that opens.
- **Photograph every run before it is closed**, and file against the room reference **in the
  Planner** (A07), which also owns the conduit and cable schedule (B28).
- **Corridor side convention is fixed once and documented** (B11): MAINS always takes the same hand,
  the CHANNEL bundle the other. Decide it at the first corridor and never think about it again.

### 3.4 Installation sequence

1. Set out RoomBox positions and the per-room L-pattern.
2. Mark the CHANNEL route — interior walls first, avoiding external and party walls.
3. Fix RoomBox back boxes and the security points beside them.
4. Install CHANNEL conduits with draw cords; label both ends.
5. Install MAINS conduits on their separate route.
6. Install SECURITY conduits parallel to the CHANNEL.
7. Install ARM conduits per room, per §4.
8. **Photograph everything.**
9. Pull day-one cables, **≤ 40 % fill**.
10. Terminate, test per §8, and close out the as-built.

---

## 4. ARM composition per room class (U15)

**Rule, from ARCH-002 §9.1:** every lamp gets its own dedicated ARM back to its RoomBox, so it
can be switched and reassigned individually. Bus ARMs terminate only in a RoomBox — they never
loop back to the cabinet.

Where a function is not yet decided, build a **UEP** (universal endpoint position, §9.2): deep
flush box with a mains pair if needed, a SELV pair, a signal pair, and an empty spare conduit
back to the RoomBox. **Two per room minimum, four in RB-L (B24)** — it is the cheapest
future-proofing in the design and the easiest to under-provide.

Endpoints are referenced with the **three-letter type codes** of STD-004 §1.2 — `LMP` `LNR` `SOC`
`SWI` `SEN` `SPK` `SHU` `PAN` `CAM` `ACP` `THR` `POR` `NTL` `UEP` — so `CLA.R03.LMP2`. ARM
references stay flat: `CLA.R03.A2`, with layers as an attribute rather than in the name.

| Room class | Dedicated ARMs | Bus ARMs | UEP |
|---|---|---|---|
| **Bath / WC** (RB-E/W, or RB-M) | ceiling lamp · mirror/vanity bilateral task · extractor · thermal array *(primary presence here, D14)* · leak detector at floor · door frame point · **portal** · **NTL-TR** | LV ambient (skirting / niche) | **2** |
| **Hall / pantry** (RB-M; RB-S only where the envelope forces it) | ceiling lamp · switch · door frame point · corner motion · **portal** · **NTL-TR** | sockets · LV ambient | **2** |
| **Bedroom** (RB-M) | ceiling lamp · 2 × bedside pendant · switch · shutter motor · window + door frame points · touch panel · thermostat · ceiling presence · CO₂ · **bed vital-signs stub (D13, see below)** · **portal** · **NTL-TR + NTL-ST** | sockets (+0.30 m) · LV ambient (cove, under-bed, headboard) | **2** |
| **Study** (RB-M) | ceiling lamp · task lamp · switch · shutter · frame points · touch panel · AP · workstation (DATA + **USB data** + MAINS) · CO₂ · 2 × speaker · **NTL-ST** | sockets · LV ambient | **2** |
| **Kitchen** (RB-M) | ceiling lamps ×2 · under-cabinet LV task · switch · frame points · touch panel · ceiling presence · CO₂ · leak detectors under sink and appliances · follow-me pair · **portal** · **NTL-TR + NTL-ST** | sockets above worktop (+1.10 m) · LV ambient | **2** |
| **Living / media** (RB-L) | ceiling lamps ×2–4 · switch group · shutter ×n · frame points · touch panel · thermostat · ceiling presence · corner motion · AP · **media wall (MEDIA + DATA + USB data + MAINS)** · **AV position** (§4.1) · follow-me ceiling pair · corner radio nodes ×2 · **UWB anchors ×3** · **NTL-TR + NTL-ST** | sockets ×2 runs · LV ambient (cove, plinth, shelf) | **4** |
| **RoomBox 1 / chain node** (RB-H) | as its own room class, **plus** full ZT pass-through for every downstream room · entry **portal P-3** · entry multi-point (keypad / fingerprint / NFC, doorbell indicator) · **NTL-TR** | — | **4** |
| **Outdoor** (RB-O) | outdoor lamps · gate / door operator · weather sensor · EV-charger control line · **camera positions provisioned, cameras not fitted (D15)** | irrigation valve bus (24 VAC) · outdoor LV ambient | **2** |

### 4.1 Two reserved envelopes that are impossible to add later

**The AV position** (STD-007 §2.3). A multichannel amplifier bay does not fit any RoomBox class —
six channels are ~9 W typical and ~30 W peak against RB-L's 70 W ceiling that already carries 42 W.
It needs its own position at the media wall: a ventilated joinery void or small enclosure (B14's
"behind joinery" case), with **its own 230 V circuit**, an **HDMI and eARC path** to the screen, and
the **media-wall cable route** of STD-007 §5.3. It is not a RoomBox class and gets no RoomBox
reference; treat it as a named position in the room schedule.

**The bed vital-signs stub (D13).** A flush box on the bed centreline at ceiling level, carrying a
SELV pair, a signal pair and a spare conduit — which is to say, exactly the Melléklet 1/A stub-out,
already specified. Nothing more is needed until the silicon is chosen, and the research (TI IWRL6432
at ±5 BPM respiration and ±10 BPM heart rate, needing 20 s stationary — a condition a bed satisfies
continuously) says the category will have moved by then. **The box and conduit cost almost nothing
now and are impossible later.** Reserve, defer the device.

**Camera-ready without cameras (D15).** No cameras are fitted indoors. Conduit and positions are
provisioned to full CCTV standard — PoE ARM plus LV spare to each corner and entry position, capped
and labelled — so the installation is a pull and a terminate rather than a chase.

**Big loads are absent from every row above, by rule.** Oven, hob, dishwasher, washing machine,
water heater and EV charger are fed **directly from the cabinet** (ARCH-002 §3). They are
observed through PANEL LINK metering and controlled through their own interface or a certified
contactor in the cabinet. High current never enters a RoomBox.

### 4.2 System supply from the cabinet (F04)

The Elosztószekrény provisions **two to three dedicated circuits to feed the BRIDGE system itself** —
over and above the per-room circuits. Provision all of them even if only one is used on day one;
the spare capacity is redundancy, and it is a chase, a breaker way and a cable, which is the cheapest
redundancy available anywhere in the design.

**At least one of them runs through a remotely operable breaker**, so the system can be power-cycled
without a trip to the cabinet — which matters most for the one case where you cannot get to it. The
rule from ARCH-002 §6 still binds: only **certified** motorised or auto-reclosing devices, and the
PANEL LINK side sees galvanically isolated measurement only.

---

## 5. RB-E — the Edge RoomBox (U16)

**Definition.** A RoomBox that is **terminal on its CHANNEL run and bounded in function** —
it serves one special-purpose domain and passes nothing onward.

Two properties define it, and the first pays for the second:

1. **No ZT.** Nothing routes through it, so plane D3 is freed for its own service loops. An
   RB-E can sit one class smaller than its endpoint count would otherwise demand.
2. **A reduced CHANNEL spur.** A terminal node rarely needs all five conduits. Typical spur:
   **C1 DATA + C3 CONTROL + C4 SPARE + C4b BUS B** *(C4b added by K25: every box needs the assured bus)*; C2 MEDIA omitted unless the domain has a screen;
   C5 per the KNX decision.

It remains a **full SELV source for its domain** — it converts, fuses and monitors exactly as
any other RoomBox. Being terminal reduces its throughput, never its autonomy.

| Variant | Domain | Specifics |
|---|---|---|
| **RB-E/W** — wet | bathroom, shower room, at the end of a run | RB-M envelope at minimum, **IP44 or better**, located outside zones 0–2. Beyond the box the room is **SELV only**. Condensation management takes priority over vent area: the cover vents to the room's dry side, and ZI's water-ingress detector is mandatory, not optional. |
| **RB-E/G** — garden | garden, terrace, irrigation | The RB-O case made explicit. Dedicated **24 VAC** transformer alongside the DC rails for irrigation valves, mounted lowest. Own RCD-protected circuit and surge protection. Weather sensing, gate and door operators, outdoor cameras. |
| **RB-E/T** — technical | garage, utility, boiler room, meter position | Metering, leak detection, the main water shut-off actuator, heating interface (OpenTherm / Modbus / relay). The natural host for the **main water valve** that function #39 asks for. Also the sensible position for a second enclosure when the consumer unit is full — see **C3**. |

**RB-E/T answers C3.** BRIDGE-DN V2 fills all 48 modules, so PANEL LINK has nowhere to live.
A technical Edge RoomBox adjacent to the cabinet gives the measuring gallery a home without
rebuilding the consumer unit.

---

## 6. The per-room buildup order (U18)

Your brief gives a buildup *sequence*; ARCH-002 §2.3 gives a conduit *taxonomy*. These are two
different cuts through the same material and the Reference needs both — which is exactly what
the guide/catalogue split is for. The mapping:

| # | Buildup step | Conduit family | Nature |
|---|---|---|---|
| 1 | **Normal circuits** — socket and lighting | MAINS | conduit + cable |
| 2 | **LV** — SELV generation and distribution | LV | conduit + cable **← missing from the brief; inserted** |
| 3 | **Automation / actuation** — bistable relays, dimmers, shutter interlocks (ζ/η) | *gear in Z1* | **not a conduit** — a gear tier |
| 4 | **Control** — BRIDGE_LINK to BASE, sub-controller | CONTROL | conduit + cable |
| 5 | **Data** — Cat to the room | DATA | conduit + cable |
| 6 | **Network** — switch, AP, VLANs, addressing | *gear on DATA* | **not a conduit** — a gear tier |
| 7 | **KNX** — if taken | KNX | conduit + cable |
| 8 | **Sensor** — endpoints and bus | SENSOR | conduit + cable |
| 9 | **RF** — radios, coverage, channel plan | *coverage plan* | **not a conduit ← missing from the brief; inserted** |
| 10 | **Control panel / HMI** — touch panel, keypad, identity reader | *endpoint on DATA + LV* | endpoint class |
| 11 | **Media & audio** — HDMI, speakers, amp bay | MEDIA & AUDIO | conduit + cable |
| 12 | **USB** — extension points | USB | conduit + cable |
| 13 | **Security** — door, window, bidirectional device spots | SECURITY | conduit + cable, third-party |

**Three observations on the reconciliation.**

- Your list treats **automation**, **network** and **control panel** as layers. They are real,
  but they are *gear tiers and endpoint classes* rather than conduit families — they occupy a
  layer that already exists rather than needing their own pipe. Keeping them in the sequence is
  right; adding them to the conduit taxonomy would be wrong.
- **LV and RF were absent** from the sequence and must be inserted. LV comes early, at step 2,
  because the actuation at step 3 needs coil power before it can exist. RF comes after network,
  at step 9, because the channel plan depends on what the APs are doing.
- The order is now **dependency-ordered**: no step requires anything from a later step. Step 1
  alone is a working, code-compliant dumb installation — which is the manual-first doctrine
  expressed as a construction sequence.

---

## 7. The mounting-height conflict (U9) — resolved

Two reference systems exist. They are not actually in conflict once you see that they measure
different objects.

| Height | SELV Standard §7 | ARCH-002 | Resolution |
|---|---|---|---|
| **+0.30 m** | floor-level sensors, LED strip feed | socket group | both — a shared low band |
| **+1.05 m** | — | wall switch | **switch plate = +1.05 m** |
| **+1.10 m** | — | socket above worktop | worktop band |
| **+1.10 m** | "switch-type controls, wall touch/button panel" | — | **panel = +1.10 m** |
| **+1.30–1.40 m** | BRIDGE junction boxes, local module distributors | — | **zone distributor band** (Melléklet 1/A), *not* the RoomBox |
| **+1.50 m** | — | thermostat | thermostat |
| **+1.55 m** | — | COMP screen centre | BASE only |
| **≥ +1.90 m** | — | RoomBox bottom edge | **RoomBox** |
| **+2.70 m / ceiling** | motion sensor, ceiling ambient, antenna | ceiling endpoints | both |

**The resolution:** the SELV standard's 1 300–1 400 mm band is the **zone distributor** of
Melléklet 1/A — a small intermediate star point gathering nearby stub-outs — and not the
RoomBox, which sits at ≥ 1 900 mm. A room may legitimately contain both: a RoomBox high on the
interior wall, and one or two zone distributors at handset height where stub-outs cluster, such
as the entry multi-point. Switch plate is 1 050 mm and panel is 1 100 mm; these differ by 50 mm
and should not be averaged, because a panel beside a switch at the same height reads as a
mistake.

---

## 8. Commissioning — the physical layer (partial close on U8)

The SELV standard already carries a handover checklist for the SELV layer. This extends it to
the physical and conduit layers. The DATA, CONTROL, MEDIA and RF test plans belong to
BRIDGE-STD-004 and are not in this revision.

**Before closing any surface**

- [ ] Every conduit has a draw cord, including occupied ones.
- [ ] Both ends of every conduit labelled `<project>-R<room>-C<n>`, machine-printed.
- [ ] Bundle order C1…C5 verified left-to-right from BASE at every pull point.
- [ ] Day-one fill ≤ 40 % in every conduit.
- [ ] ≤ two 90° bends between pull points; pull boxes at ≤ 15 m.
- [ ] Fire-compartment penetrations sleeved and collared; positions recorded.
- [ ] MAINS and the CHANNEL bundle on opposite sides of every corridor; crossings at 90°.
- [ ] **Every run photographed** and filed against its room reference.

**At RoomBox fit-out**

- [ ] Partition installed and IP2X verified toward every zone before energising Z1.
- [ ] Single PE star point; every zone cage separately bonded.
- [ ] 12 V and 24 V rails electrically separate — separate supply, separate fuse branch.
- [ ] Every SELV branch leaving the box individually fused and current-monitored.
- [ ] Z5 and Z4 thermally and electromagnetically clear of Z1 across the partition.
- [ ] IR head has unobstructed line of sight through the RF window.
- [ ] Antennas ≥ 20 mm clear of metal; none crossing the partition.
- [ ] ZT service loops ≥ 300 mm, labelled, undisturbed.
- [ ] **Two separated openings**, upper and lower, with the §2.6 free area **per opening** for the
      class. **Measure the free area** — a louvre's gross dimension is not its free area, and the
      difference is usually 40–60 %.
- [ ] Internal baffle directs incoming air to the rear of the box.
- [ ] **≥ 20 mm clear front channel** in every zone, lower slot to upper. RF column open at both ends.
- [ ] **60 minutes at three-quarter design load**; record air temperature at the top of the box, at
      the PSU body and at the sensor shelf. **Accept at ΔT ≤ 25 K** air-to-room; investigate above
      30 K. Sensor shelf within **1.5 K of the room** — if not, Z5 is in the exhaust path and the
      baffle is wrong. Full procedure in [STD-001-A1 §7](BRIDGE-STD-001-A1_Passive-Thermal-Design.md).
- [ ] Zone fill ≤ 60 %.
- [ ] 100 mm service clearance in front of the cover; door swings 110°.

---

## 9. What this document does not yet settle

| Ref | Still open |
|---|---|
| **D1** | Room list and RoomBox class per room; which rooms are direct and which chained. Until this exists, §4 is a template rather than a schedule — and it now gates more than anything else in the set. |
| **D14** *(tuner)* | The stub-out box envelope dimension. Melléklet 1/A fixes the *contents* of a stub-out but not its size; INST-001 is blocked on it. |
| **U22** | CLA's concrete hardware composition, the first real test of §2 and §4. |
| Louvre profile | The free-area ratio of the chosen louvre sets the gross slot size, so the cover cannot be drawn until a profile is picked. |
| Floor-void riser | Whether a riser above a RoomBox is available and what OTSZ requires of the penetration — ask the certifying electrician alongside C29. |
| Validation | The §2.6 figures want one instrumented RB-M at full load before a cover is tooled. An afternoon's work confirms or corrects the whole annex. |

**Closed since r1:** U1 and U2 by STD-004 · C2-T by STD-004 §4 · B01 B02 B04 B05 B07 B08 B09 B10
B11 B12 B13 B14 B15 B16 B17 B18 B19 B20 B21 B22 B23 B24 B25 B26 B27 B28 by r2 · A05 A06 A07 A08
and F04 by r2 · the thermal budget by Annex A1.
