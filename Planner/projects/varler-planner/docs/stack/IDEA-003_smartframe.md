# IDEA-003 — SmartFrame: the Portal as a second BRIDGE box type

Status: **concept r1, 2026-10-10 · the §13 questions answered (all defaults, Q1 and Q2 confirmed) · the Planner part built
the same day (§15)** · feeds the future **BRIDGE-STD-009** (Q-SF-02) and the
Planner pack `docs/round-cla-add-001/` (after round 2026-10-10 is built)
Brief: [`../round-2026-10-10/NEXT-CLA-ADD-001-SF_smartframe-brief.md`](../round-2026-10-10/NEXT-CLA-ADD-001-SF_smartframe-brief.md)
Related: [IDEA-001](IDEA-001_cluster-flush-boxes.md) (cluster points) · [IDEA-002](IDEA-002_flush-cover-standard.md)
(housings, Ladder D / H) · [WORKSHOP-001](WORKSHOP-001_routing.md) (paths, provisioned state) ·
BRIDGE STD-001 / STD-003 / STD-005 / STD-008 · ARCH-001
Figures (generated, never hand-edited): [F1 door elevation](fig/IDEA-003_F1_door-elevation.svg) ·
[F2 CLA room pattern](fig/IDEA-003_F2_room-pattern.svg) · [F3 floor-plan cut](fig/IDEA-003_F3_plan-cut.svg) ·
[F4 the L unfolded](fig/IDEA-003_F4_wall-unfold.svg) · [set-cover tables](fig/IDEA-003_setcover.md) —
sources in `fig/src/idea-003-figs.js` and `fig/src/idea-003-setcover.js`

> *"…a half-independent subsystem that can also work without BRIDGE… It uses what the wall around a
> doorway already does, and adds smart functions in a precisely calculated number of free modular
> spaces inside the frame zones."* — the user, 2026-10-10 (brief §1)

⚑ = a figure or claim not yet verified against a primary source.

---

## 0. Words, answers, and how to read this document

### 0.1 Vocabulary (the user's answer to Q-SF-04)

| word | meaning | not to be confused with |
|---|---|---|
| **Ajtó / door** | the opening in the wall, with or without a leaf | — |
| **Portál / Portal** | a door integrated into the smart home: a **silver-tier node** with a corner box, a slot set and a place on its room's Silver Rail | STD-003's *portal* (the graph edge it instruments: the two meanings coincide on purpose) · the `prt` graph prefix · catalogue code `POR` (the sensors) |
| **SmartFrame** | the set of functions ("the series of enchantments") added to a door to make it a Portal: slots, sensors, rail, risers | a picture or UI frame |
| **SmartFraming** | the act of doing that, in design or on site | — |
| **Rail** | several **same-tier nodes on one string**, usually horizontal, feeding downstream paths together | a single node, which is just a node |
| **Silver Rail** | the rail of one room: its RBX plus its Portals, along the high wall zone | WORKSHOP-001's old "silver path" (§8 reconciles them) |

"Gate" is dropped (it was the user's description of the shape, and the Smart Gate Switch already uses it).
The shape is called the **frame shape** below: two verticals and one horizontal round a door.

### 0.2 Answers already given (2026-10-10)

| # | answer | where it lands |
|---|---|---|
| Q-SF-01 | the cut-off sentence: *"both variants"* | §7.4 — read as two cluster variants, **⚑ to confirm** |
| Q-SF-02 | **(c)** a new standard **STD-009** | Phase 2 |
| Q-SF-03 | **yes**, a deliberate, documented departure | §10, §12 |
| Q-SF-04 | Ajtó / Portál / SmartFrame / SmartFraming | §0.1 |
| Q-SF-05 | node tiers gold / silver / bronze, rails | §8 |
| Q-SF-06 | both faces may be equipped; **Portal classes like RBX classes** | §4 |
| Q-SF-07 | yes, an accessibility height was the intention; more ideas welcome | §5.3, §6 |
| Q-SF-08 | **hinge-side upper corner**; illustrations later in a standard manner | §3.3, `STYLE` in the figure script |
| Q-SF-09 | research the most compatible satellite configuration | §9.2 |
| Q-SF-10 | **as drawn** (two Portals on the L's arms, RBX at the L's corner, three corner clusters); one door → the more future-proof option; doors on opposite walls → a **Portal-to-Portal rail via the wall between them** | §7 |
| Q-SF-11 | SF-0/1 = Alap, SF-2/3 = Prémium | §4.2 |
| Q-SF-12 | merge BRIDGE SECURITY (ADD-001 #11) and the ghost network | §9.5, a later research doc |
| hinge zone | **(a)**: declare it as a documented BRIDGE zone | §2.2 |
| ceiling | CLA normal **2850**; the R06 open area ≈ 5400 | §2.3 |

---

## 1. The idea in one paragraph

Every door already gathers things: the switch column, a socket, a kötődoboz, the wireway that
crosses into the room. A **Portal** turns that habit into a standard. One **corner box** high up at
the hinge-side corner (the *nest*), fed by the room's RBX over the **Silver Rail** and by the assured
**bus B**, carries an ESP32-S3 head and 2–3 identical satellites. Around it sits a **fixed, small set of
slots** (§5) chosen so that one rule set covers ≥ 90 % of everything that ever lives at a doorway.
The Portal does the door's own jobs without BRIDGE (crossing, direction, lábfény, local alarm) and
takes the top layers off the RBX where one central box per room is crowded or awkward to reach.
Per room, **two Portals and the RBX** are the primary nodes, joined by the rail along two walls that
form an **L**; **three corner cluster points** complete the room (§7).

## 2. The zone argument — and the one place we leave the standard

### 2.1 What DIN 18015-3 actually says

Wiring practice already reserves the frame shape, **except one leg of it**:

| zone | DIN 18015-3 (interior) | what the Portal puts there |
|---|---|---|
| **ZS-t** | vertical, **20 cm wide, 10–30 cm from the raw opening edge**, floor to ceiling, **on the latch side** of a single-leaf door, both sides only for double doors | the traditional latch column: L1, L2, M1, M2 |
| **ZW-o** | horizontal, 30 cm wide, **15–45 cm below the ceiling** | the Silver Rail (lower line) and the golden channel (upper line) |
| **ZW-u** | horizontal, 30 cm wide, 15–45 cm above the floor | the lábfény feed, L0 |
| ZW-m | 100–130 cm, only where worktops stand | — |
| ZS-e | vertical, 10–30 cm from a wall corner | the corner cluster points (§7) |

Source: secondary descriptions of DIN 18015-3:2016-09 (baukobox.de, immoportal.com) ⚑ — confirm the
latch-side wording in the norm text before STD-009 cites it.

So the brief's line *"the gate shape is ZS-t + ZW-o + ZS-t"* was half wrong: **the hinge-side vertical
is outside every standard zone.** A cable found there is exactly what a later tradesman does not
expect.

### 2.2 The hinge zone ZS-t(h) — a documented BRIDGE zone (answer: option a)

The hinge side is declared a **BRIDGE installation zone, ZS-t(h)**, mirroring ZS-t: 20 cm wide, 10–30
cm from the raw opening edge, floor to the rail. It is only legitimate if it is *findable*:

1. **As-built drawing:** every Portal sheet shows ZS-t(h) and what runs in it (the Planner will
   produce this from the model).
2. **Label in the nest:** the inside of the H0 hatch carries a printed card, *"ZS-t(h): vezeték a
   zsanér oldali sávban, 100–300 mm a nyílás élétől, padlótól a sínig"* (Hungarian, on site).
3. **Photo record** of the open chase before plastering, filed with the as-built set.
4. **Never a lone mains run** in ZS-t(h): the hinge riser carries SELV / bus B / data. Mains for L0's
   nightlight socket is fed from the latch column (L1), not down the hinge side. This keeps the
   consequence of an unexpected drill hit at SELV.

Rule 4 is new and worth confirming (open question 4).

### 2.3 Heights for CLA (reference ceiling 2850)

| line | height | rule |
|---|---|---|
| ceiling | 2850 | user, 2026-10-10 |
| ZW-o | 2400–2700 | 150–450 below the ceiling |
| **golden channel** (H2) | ≈ 2600 | upper part of ZW-o, *only where a channel passes* |
| **Silver Rail** + **nest centre** (H0) | **≈ 2450** | "the lowest line of the high band", the user's rule |
| head pockets (H1) | ≈ 2400 | on the rail line, over the opening |
| lintel top | ≈ 2230 ⚑ | raw opening 2100 (Planner `DOOR_H`) + a ≈ 130 lintel ⚑ |
| raw opening head | 2100 | Planner default; HU leaves are 210 high, the raw opening a little more ⚑ |

**The 2850 ceiling settles the lintel conflict** the brief raised (§3.3): the rail at 2450 runs about
200 mm **above** the lintel, in the wall above it, so a precast lintel is never chased. With a
2650–2700 ceiling the rail would drop to ≈ 2250 and hit the lintel band, which is why STD-009 must
state the rule as *"rail = max(ZW-o lower line, lintel top + 150)"* rather than a fixed number.

**R06's open area (≈ 5400):** ZW-o measured from the real ceiling would put the rail at ≈ 5000. Zones
there follow a **reference ceiling of 2850** (a virtual line continuing the normal rooms), so the rail
stays reachable and continuous. The Planner needs a per-wall `refCeiling` for this (pack item).

**The Planner test plans say 2700** (`building.heights.ground`). Update to 2850 before any Portal
geometry is computed from them (pack item; not touched now).

## 3. Four faces and the corner box

### 3.1 Two jambs × two faces

| zone | swing face (the leaf opens toward it) | non-swing face |
|---|---|---|
| latch ZS-t | the room's switch column | the other room's switch column, often empty |
| hinge ZS-t(h) | **behind the open leaf** up to ≈ 2050: hidden, unreachable while open → hidden items only (buzzer, BLE radio, service access) | **free, visible wall nobody uses** → the visible terminal (M3) |
| head ZW-o | rail, head sensors | rail continues |

### 3.2 What the model already knows

Handing is in the data: `variant` bit1 = hinge at the far jamb, bit0 = swing side (`04-render.js`
`bpDoorSymbol`). `fig/src/idea-003-figs.js` derives, for every CLA ground door, the hinge jamb, the
swing face and **how much free wall lies beyond the hinge jamb** before the next wall:

| door | between | swing into | free wall beyond the hinge jamb | H0 at the hinge side? |
|---|---|---|---|---|
| B107 | outside → R01 | R01 | 144 (R01 face) | **no** → H0-3 |
| B106 | R01 ↔ R03 | R03 | 414 (R01) · 3221 (R03) | yes |
| B105 | R01 ↔ R04 WC | R04 | 142 | **no** → H0-3 |
| B104 | R03 ↔ R05 kamra | R03 | 27 | **no** → H0-3 |
| B103 | R03 ↔ R06 | R06 | 1549 (R03) · 824 (R06) | yes |
| B171 | R06 ↔ R07 | R06 | 163 | **no** → H0-3 |
| B109 | R07 ↔ R08 | R07 | 443 | yes |

**Four of seven CLA doors are hung with the hinge tight against a corner** — the normal way to hang a
door, so this is not a CLA accident. The hinge-corner rule therefore needs a fallback.

### 3.3 Where the nest goes (Q-SF-08 answered "hinge side"; three rules)

- **H0-1** The nest (H0) sits at the **hinge-side upper corner**, where ZS-t(h) meets the rail line
  (≈ 2450), on the **served room's face**.
- **H0-2** On a **swing face** the nest stays (at 2450 it is above the open leaf), but the **visible
  terminal M3 moves to the latch side**, above or beside M2, because the hinge side is behind the
  leaf. Hidden items (M4's vented node can stay, the buzzer, the radio) remain hinge-side.
- **H0-3** If the free wall beyond the hinge jamb is **< 300 mm** (a 200 box needs 100–300 from the
  edge), the nest moves to the **latch side** at the same height (inside DIN ZS-t). Alternative
  **H0-3b**: turn the corner and place it on the return wall inside that wall's **ZS-e** corner zone,
  which is also a DIN zone. *Default H0-3 (latch); H0-3b is open question 5.*

F2 shows H0-2 (B103, B171 open into R06) and H0-3 (B171) on the real plan.

## 4. Portal classes and tiers

### 4.1 Classes (Q-SF-06: "types like with RBXs")

The RBX ladder is RB-S / M / L / H / E/W / O by size and duty. Portals vary by **which faces are
equipped and where they stand**, so the classes are duty classes:

| class | what | faces | notes |
|---|---|---|---|
| **PT-S** single | serves one room | one face equipped, the other SF-0 at most | the common case |
| **PT-D** double | serves both rooms | both faces equipped, **one nest per face**, one head sensor set shared | **the ToF pair splits one per face**: the wall thickness becomes the 200 mm spacing STD-003 §2.3 asks for, so direction comes for free (⚑ check the cone clears the architrave) |
| **PT-E** entry | the only edge to outside (STD-003 P-3) | inside face only | full SF-3, mmWave + thermal, keypad / NFC, doorbell; nothing outside but the doorbell |
| **PT-W** wet | one face is a bathroom / WC | the wet face IP44 boxes, no M3, no sockets | MSZ HD 60364-7-701 zones govern the wet face ⚑ |
| **PT-B** blind | **no door**: the end of an L arm in a one-door room | one face, SF-0 by default | keeps the L, so a later door or a later cluster needs no new chase (§7.2) |

Habitually open, door-less openings are **not Portals** (STD-003 §2.5: draw the two spaces as one
zone). The class code prefix `PT-` is new; check it against the catalogue codes before STD-009 fixes it
(open question 3).

### 4.2 Tiers (Q-SF-11: SF-0/1 Alap, SF-2/3 Prémium)

| tier | built | covers | price band |
|---|---|---|---|
| **SF-0 előkészítve** | H0 box + rail conduits + hinge riser, empty, draw cords, bus B pair pulled | provision only | Alap |
| **SF-1 portál** | SF-0 + S3 head + SAT-P (H1) | STD-003 P-1 / P-2 | Alap |
| **SF-2 keret** | SF-1 + M3 terminal + M4 node + L0 low pocket + SAT-E + SAT-L | the room's control point, lábfény, climate | Prémium |
| **SF-3 teljes** | SF-2 + L2 dormant box + MJ jamb (leaf transfer, door angle) + acoustic pair + H2 where a channel passes | everything in §1 of the brief | Prémium |

## 5. The slot standard — "the most with the least"

### 5.1 The slots

Heights for the 2850 reference ceiling; centrelines on the zone centre (200 mm from the raw edge),
every housing on IDEA-002's shared centreline. See F1.

| slot | height | side | holds | housing (draft) | class |
|---|---|---|---|---|---|
| **L0** | 250 | hinge | lábfény feed / spot, low PIR / floor ToF, low smart-endpoint space | Ø68 deep (60–65) | SELV |
| **L1** | 300 | latch | socket, nightlight socket | Ø68 | mains |
| **L2** | **1000** | latch | **dormant parallel switch**, wired to M2, blank lid (Dietzel HWD/TD 65) | Ø68 deep | mains, provisioned |
| **M1** | 1150 | latch | NTL-TR (STD-008), door-state head | Ø68 | SELV |
| **M2** | 1300 | latch | switch column: light, shutter, extra panel | Chorus ONE 2–4 module (IDEA-002) | mains |
| **M3** | 1450 | hinge (non-swing) / latch (H0-2) | CYD, flush panel, thermostat, intercom, speaker | 2-gang deep or panel back box | SELV |
| **M4** | 1600 | hinge | chest/head sensor node (mmWave LD2450, optional thermal) | Ø68 deep, vented / sensor-transparent cover | SELV |
| **MJ** | 1000 | hinge jamb (reveal) | leaf cable transfer, door-angle hall sensor | transfer housing + reed | SELV |
| **H0** | **2450** | hinge corner (H0-1…3) | the nest: S3 head, bus A/B terminals, RS-485, AC/DC adapter, mains kötődoboz in a separated compartment, BLE radio, buzzer | **K3 200 × 200 partitioned** (IDEA-002 §6), 200 × 200 GK-insert hatch | SELV + mains (divided) |
| **H1** | 2400 | over the door | ToF + mmWave across the opening; second pocket: speaker, mic 2, siren | 2 × Ø68, sensor-transparent | SELV |
| **H2** | 2600 | over the door | golden channel conduits, only where one passes | conduits | channel |

**The nest is a K3, not a 100 × 100.** IDEA-002 found no true 100 × 100 flush box (107 or 116 mm
exist), and the brief's own contents list (head + adapter + mains kötődoboz + terminals) needs the
divider. K3 is on Ladder H, so the nest and an RBX hatch are visibly the same object at two sizes —
and it **answers IDEA-002 open question 5** ("portal box: 107/116, or promote to a 200 hatch?"):
promote. A **100 × 150** inline box (the user's other size) was not found as a flush product at HU
vendors (closest: Tracon D100X100 100 × 100 × 51.5; 120 × 98 × 50 and 160 × 110 × 70 screw-lid boxes)
⚑ — kept as an option for a SF-1-only nest.

### 5.2 The set-cover result

`fig/src/idea-003-setcover.js` searches **every subset** of the 11 slots (with the three risers
counted once each) for the cheapest set reaching a coverage target over the **30 doorway functions**
(standard-bearing ones count double). Costs are relative units (a Ø68 box + plaster work = 1.0) ⚑,
for ranking only. Full tables: [fig/IDEA-003_setcover.md](fig/IDEA-003_setcover.md).

| target | cheapest slot set | functions | cost |
|---|---|---|---|
| ≥ 70 % | L0 L1 L2 M1 M2 M4 H1 H2 | 21 / 30 | 14.4 |
| ≥ 80 % | + M3 | 24 / 30 | 17.4 |
| **≥ 90 %** | **L0 L1 M1 M2 M3 M4 H0 H1** | **27 / 30** | **21.5** |
| 100 % | all 11 | 30 / 30 | 24.9 |

Reading it:
- **The ≥ 90 % set is SF-2 on a door that keeps its normal switch column.** The three functions it
  drops are exactly the SF-3 extras: the dormant parallel switch (L2), the leaf transfer (MJ), and the
  channel (H2, which by definition only exists where a channel passes). The tiers in §4.2 are not
  arbitrary; they fall out of the search.
- **Going from 90 % to 100 % costs +16 %** (21.5 → 24.9).
- **Naive vs standard:** one housing per function = **29 housings** and up to three vertical chases per
  door; the ≥ 90 % set = **9 housings** (H1 counts as two pockets) on two risers plus the rail stub.

### 5.3 The dormant parallel switch at 1000 (Q-SF-07)

Hungarian accessibility practice puts controls at **0.90–1.10 m** (tender requirements and access
statements); the EN 17210 draft reach range for operable parts is **800–1100**; the OTÉK has been
replaced by the **TÉKA (280/2024. (IX. 30.) Korm. rendelet)**, whose exact paragraph on control
heights was not located ⚑. **L2 at 1000** sits in the middle of the HU band, below the handle line
(≈ 1050 on the leaf), and above M1's NTL at 1150 only by a box pitch, so the latch column reads
1000 / 1150 / 1300 at a regular rhythm.

*Corollary worth saying:* if a client wants accessibility from day one, **M2 itself moves to 1000** and
L2 is not needed. L2 is the answer for "not now, but never chase again".

## 6. The hinge side and other ideas (the user asked for these)

From the brief §3.5, kept and sharpened:

1. **Leaf cable transfer (MJ).** Concealed transfers exist from ASSA ABLOY, LINK and 2N: ≈ **24 V,
   1 A continuous** (4 A short-term), cable ≤ 7 mm, pocket milled in the leaf (LINK M 12 91:
   480 × 24 × 42 mm, separable plug so the leaf can still be lifted off). Bus B fits that rating. This
   opens leaf electronics: latch state, handle touch, an edge light, a battery-free leaf contact.
2. **Reveal crossing sensors.** A ToF or IR pair in the reveal at ≈ 300 and ≈ 1000, looking across
   the opening: pet vs person without the head ToF.
3. **Door angle at the hinge jamb.** A hall sensor in MJ: open / ajar / closed and an angle, which
   STD-003's open-door degradation rule (D09) needs.
4. **Vertical light line** in ZS-t(h), on bus B: an orientation line at night that doubles as egress
   guidance in a blackout, and continues the lábfény.
5. **Hidden service column** on a swing face: everything that should be serviceable but never seen.
6. **Visible terminal** on a non-swing face (M3).
7. **The riser to the floor** (L0) instead of a second chase on the busy latch side.
8. **Acoustic pair**: mic 1 in the nest, mic 2 in H1b, ≈ 1 m apart on one board's clock → a
   left / right / through-the-door bearing.

New ideas "like the 700 box" (provisioned, cheap now, expensive later):

9. **A pull cord in the rail for every layer not taken now** — the provisioned state of WORKSHOP-001 §2
   applied to the rail, so a later layer never cuts a chase.
10. **A spare Ø68 at 300 on the hinge side behind the leaf**, for a future wired door stop / holder
    magnet (fire-door style hold-open on bus B, released by the alarm).
11. **The second H1 pocket empty**, for a later speaker or siren.
12. **A test point in the nest**: bus B voltage and RS-485 A/B on a small terminal, so a service visit
    needs no tools.
13. **The nest label** (§2.2) printed with the Portal's reference (`CLA.PT.R06.B103`), its class and tier.
14. **A floor-level Ø68 under the threshold line on the swing face**, for a future threshold strip or
    floor-contact mat (child / pet gate logic) — low priority.

## 7. The room pattern

### 7.1 The L (Q-SF-10, as drawn)

Two walls that meet in a corner form the **L**. Each carries a door → a **Portal** on each arm. The
**RBX sits at or near the L's corner**. The **Silver Rail** runs along both arms at ≈ 2450:
Portal A → RBX → Portal B, one string, two walls chased. The **three other corners** get corner cluster
points (ZS-e high pockets with a SAT-E / radio node, fed from the nearest Portal or the RBX), which is
where STD-001's *corner radio nodes ×2* and *UWB anchors ×3* for living rooms find a home.

### 7.2 Variants

| room | rail | why |
|---|---|---|
| **two doors on adjacent walls** | the L | the base case |
| **one door** | Portal → RBX → a **PT-B blind Portal** at the end of the second arm (SF-0) | the user chose the more future-proof option: the L is built, so a second door, a corner cluster or a later terminal on that arm needs no new chase |
| **two doors on opposite walls** | **Portal → along its wall → the wall between them → along the other wall → Portal**, a U through the in-between wall; the RBX on that in-between wall | the user's answer: the rail runs toward the inner wall between the two |
| **more than two doors** | the two doors that best form an L are the arms; the others join as PT-S spurs from the nearest rail point | ⚑ not yet discussed |
| **no door on a wall that the L needs** | PT-B | as above |

### 7.3 CLA: R06 nappali and R07 szoba (F2)

The test plan already carries the user's **L-forma marks** on exactly these rooms:
- **R06**: W12's east face (door B103) + W15's north face (door B171) — an L with its corner at the
  SW, where **RBX06** stands in W15. The rail runs B103 → corner → RBX06 → B171 (whose nest moves
  latch-side, H0-3). The corner clusters go NW, NE, SE.
- **R07**: W15's south face (B171) + W14's east face (B109). R07 is itself L-shaped round the R08
  notch, so its two marked faces do not meet: its rail goes **round the notch along W12 and W13**.
- **W15 is an arm of both rooms**, and RBX06 sits in it: one box, two rails, one per face. That is the
  pattern working as intended: the shared wall is the shared spine.
- R07's SW corner point lies 120 mm from B109's nest: **a corner cluster within ≈ 600 mm of a nest is
  absorbed by the Portal** (rule C-1, drawn dashed).

### 7.4 Q-SF-01, "both variants" ⚑

The cut-off sentence (*"…the living room and the bedroom of CLA will have wall clusters in the …"*)
was answered *"both variants"*. This document reads it as **both cluster placements the pattern
produces**: (i) the **corner clusters** in the corners the L leaves out, and (ii) a cluster at the
**inner corner of the L** beside the RBX. In R06 and R07 the two variants appear together (F2). **If
"both variants" meant something else** (both CLA rooms as two variants of the L, the convex R06 and
the notched R07, or two of the other guesses), say so and §7 changes accordingly.

## 8. Tiers, paths and rails (Q-SF-05)

**Node tiers:**

| tier | nodes |
|---|---|
| **gold** | BASE and its parts, Elosztó, Mérőóra, ISP inline |
| **silver** | RBX, **Portal** |
| **bronze** | every endpoint |

**Path rules, as read from the user's answer** (*"a"* = the path takes the tier of the node it leaves):

- **P-1** A node reaches nodes of **equal or lower tier** with its own tiered path. At a lower node,
  *that* node's path continues.
- **P-2** A **gold path ending at a bronze endpoint is a direct line** (dedicated / heavy load: DED,
  AVP). This is WORKSHOP-001's old "bronze path", renamed: bronze is now a node tier, not a path.
- **P-3** A **shared circuit is a silver path, a dedicated one gold** — the general rule (answered
  2026-10-10). A shared mains circuit (dugalj áramkör) leaving the Elosztó serves a string of endpoints like
  a rail does, so it is silver even though the Elosztó is a gold node.
- **P-4** One node alone is a node. **Same-tier nodes on one string, feeding downstream in tandem,
  form a Rail.** BASE and its parts form the **gold rail**; a room's RBX + Portals form its **Silver
  Rail**.
- **P-5** Silver paths now end at the **serving node, RBX or Portal**: an endpoint in a Portal's reach
  is served from the Portal (`from:'frame'` in the pack).

What changes in WORKSHOP-001 §0 (Phase 2): the "words" table gains node tiers; "bronze path" becomes
"gold direct line"; "silver path" becomes "a path from a silver node"; the rail is added. The routing
method of WORKSHOP-001 §2 (build with B, select with A, provision on purpose) is unchanged.

## 9. The swarm module set

### 9.1 Head (one per Portal, in the nest)

**ESP32-S3 N16R8 Dual USB-C** (owned ×3, BuildTree `s3`) on the **44-pin S3 I/O shield** (owned ×1,
`s3shield44`). Jobs: BRIDGE_LINK RS-485 to the RBX · WiFi + `bluetooth_proxy` · ESP-NOW coordinator
of its satellites · I²S audio out and in · buzzer / siren · NTL · local autonomy (§10).

Draft GPIO plan (avoiding the N16R8's flash/PSRAM pins G26–G37, the USB pins G19/G20, strapping G0,
G3, G45, G46 and the CH343 console G43/G44, as noted in the BuildTree) ⚑ verify against the shield's
breakout:

| function | pins |
|---|---|
| RS-485 BRIDGE_LINK (TX, RX, DE/RE) | G17, G18, G16 |
| I²S out → MAX98357A (BCLK, LRC, DOUT) | G4, G5, G6 |
| I²S in ← 2 × INMP441, L/R on one bus (SCK, WS, SD) | G38, G39, G40 |
| I²C / Qwiic (SDA, SCL) | G8, G9 |
| UART2 (LD2450 on the head, or a wired CYD link) | G10, G11 |
| buzzer MOSFET · NTL data (WS2812) · door reed / hall | G12 · G13 · G14 |
| spare | G1, G2, G7, G15, G21, G41, G42, G47 (G48 = the on-board RGB LED ⚑) |

### 9.2 Satellites (Q-SF-09: "the most compatible configuration")

| | ESP32-C6 | ESP32-C3 |
|---|---|---|
| radio | WiFi 6, BLE 5, **802.15.4 (Thread / Zigbee)** | WiFi 4, BLE 5 |
| ESPHome | `openthread` (FTD by default, so a full Thread device), `zigbee`; **ESP-IDF framework only** | either framework |
| fits | Thread router / Matter end device, parent for ADD-001 #9 battery sensors | cheap WiFi / ESP-NOW node |
| owned | C6 DevKit N4R2 ×2 | C3 Zero ×6, ETH01-EVO ×2 |

**Recommendation: all C6**, because it is the only one that speaks the BRIDGE protocol floor
(Thread / Matter) as well as ESP-NOW, and ESP-IDF is ESPHome's direction anyway. Use the owned C3s for
the bench and the ESP-NOW trials. Form factor: C6 SuperMini class (4 MB flash, fits a Ø68 deep box);
set the 4 MB flash size explicitly, because the usual `esp32-c6-devkitc-1` board definition assumes
the 8 MB DevKit ⚑. **Power: 5 V from the head** (the head's buck feeds the satellites through the
risers), which keeps one 24 V → 5 V conversion per Portal.

**Head ↔ satellite link:** `packet_transport` over `espnow` (core, with `encryption`), and the same
`packet_transport` over `uart` on an RS-485 drop in the same conduit as the wired fallback and the
ghost-network path (§9.5).

### 9.3 One satellite carrier, three personalities

Every satellite exposes the same ports: **2 × Qwiic (JST-SH I²C) · 1 × 4-pin UART (radar) · 1 × I²S
(mic) · 2 × GPIO**. A personality is only which modules are plugged in:

| personality | modules | gives | slot |
|---|---|---|---|
| **SAT-P portál** | ToF (per face, PT-D) · LD2450 across the opening · hall door angle | crossing, direction, count, adult/child/pet, door state | H1 |
| **SAT-E klíma** | SHT4x · SCD41 · VEML7700 · SGP41 or BME680 | comfort, ventilation trigger, daylight | M4 or a corner cluster |
| **SAT-L alsó** | AM312 PIR · floor ToF · VEML7700 | lábfény trigger, segmented lábfény, night path | L0 |
| *SAT-A akusztika* (optional) | 1–2 × INMP441 · buzzer · NTL LED | sound events, bearing, alarm | H0 / H1 |

### 9.4 ESPHome components, checked against CoreRef 2026.9.1

| component | status | used for |
|---|---|---|
| `espnow`, `packet_transport` (platforms `espnow`, `uart`, `udp`, `sx126x`, `sx127x`) | core | head ↔ satellites, ghost network |
| `bluetooth_proxy`, `esp32_ble_tracker` | core | BLE proxy (ARCH-001 §4.1), Bermuda |
| `openthread`, `zigbee` | core | C6 satellites |
| `ld2450`, `ld2410`, `ld2412`, `at581x`, `seeed_mr60bha2`, `seeed_mr60fda2` | core | mmWave options (the last two: vital signs / fall) |
| `vl53l0x`, `tof10120` | core | ToF |
| **`vl53l1x`** | **not core** | external component needed; licence not yet confirmed ⚑ |
| `scd4x`, `sht4x`, `sgp4x`, `veml7700`, `bme680`, `bme68x_bsec2`, `tmp117` | core | SAT-E |
| `bmp3xx` | core (schema not harvested) | wet-room pressure |
| **`mlx90640`** | **not core** | the bathroom thermal array needs an external component ⚑ |
| `i2s_audio`, `microphone`, `speaker`, `media_player`, `mixer`, `sound_level`, `rtttl` | core | audio, buzzer tunes, level events |
| `micro_wake_word`, `voice_assistant` | core | optional voice satellite on the S3 |
| `modbus`, `uart` | core | BRIDGE_LINK |
| `ina226` | core | bus B current / voltage in the nest |

**The ToF trade-off** (needs a decision, open question 6): STD-003 P-2 assumes VL53L1X (≈ 4 m).
The core `vl53l0x` reaches ≈ 2 m ⚑: mounted at 2400 it still classifies an adult (range ≈ 700) and a
child (≈ 1300) but returns *nothing* for a pet or an empty doorway, so "pet" must come from SAT-L.
Either accept that (core only), or take VL53L1X through an external component after a licence check.

### 9.5 Emergent functions: what is realistic, and the licences

| function | how | realistic? | licence check |
|---|---|---|---|
| crossing / direction / count | SAT-P + STD-003 portal graph | **yes** | own code |
| trusted devices between Portals | every head a BLE proxy + **Bermuda** in HA | **yes, room level** | Bermuda **MIT** ✓ · ESPresense **AGPL-3.0 ✗** (and needs its own firmware) |
| RSSI / CSI device-free motion | ESP-NOW beacons between heads; CSI | **experimental**: an evidence term in STD-003 fusion, not a locator | espressif/esp-csi **Apache-2.0** ✓ · ESPectre (ready ESPHome CSI motion) **GPL-3.0 ✗** for client devices |
| sound bearing | one board's mic pair | at one door yes; room-scale TDOA across nodes no | own code |
| fallback network | `packet_transport` over ESP-NOW frame → frame → BASE; RS-485 wired spine | **yes**; allowed traffic: alarms, presence, NTL | core |
| **ghost network** | the same swarm with WiFi off / hidden, encrypted, on bus B | **yes**, as the base of **BRIDGE SECURITY** (Q-SF-12: merged; its own research doc later, not built on Trinity) | core |
| habit / identity observer | HA-side history + occupancy model, bounded by STD-003 §4.5 | yes, software; privacy-flagged | — |

## 10. Standalone mode (Q-SF-03: a documented departure)

- **SA-1** A Portal never needs the hub for its **SF-1 functions**: crossing and direction, door state,
  lábfény on presence-when-dark, NTL on a door left open at night, the local siren.
- **SA-2** It needs the hub for **history, identity and cross-room scenes**.
- **SA-3** Portals talk to **each other** without the hub over ESP-NOW: count propagation along the
  room graph, alarm relay, sentinel mode.
- **SA-4** Local UI = the CYD (M3) or the head's web page; **no cloud**, and only MIT / Apache / BSD
  code on the devices (no ElegantOTA, ESP-DASH, WebSerial).
- **SA-5** Without BRIDGE at all (a client who takes only Portals), a set of Portals plus one bus B PSU
  is a complete small system: doorway lights, presence, alarm. That is the "half-independent" claim.

## 11. Power on bus B

Draft figures ⚑ (to be replaced by measured values; buck efficiency 85 %):

| | per Portal | CLA ground floor (7 Portals) |
|---|---|---|
| SF-1 (head + SAT-P + LD2450) | ≈ 1.5 W | B104, B105 → 3.0 W |
| SF-2 (+ SAT-E, SAT-L, CYD dimmed, amp idle) | ≈ 3.2 W | B106, B103, B171, B109 → 12.8 W |
| SF-3 (+ NTL, leaf electronics, mics) | ≈ 3.6 W | B107 entry → 3.6 W |
| **total, normal** | | **≈ 19.4 W** |
| **sentinel** (WiFi off, ESP-NOW listen, CYD off, radar on) | ≈ 1.0 W | **≈ 7 W** |

Pack (K27, R05 kamra; STD-006 asks for **2 h** on mains loss): 2 h normal ≈ 39 Wh; **24 h sentinel ≈
168 Wh**. On an 8S LiFePO4 (25.6 V) with 80 % depth of discharge and 20 % ageing margin that is ≈ 2.4 Ah
for 2 h and ≈ 10.5 Ah for 24 h sentinel, **before** the existing bus B loads (NTL, egress lights, RBX
sub-controllers), which BUILD-001 does not quantify yet ⚑. Suggested class: **12–15 Ah 8S**, decided
when the other bus B loads are counted.

Voltage drop is not the limit: one Portal draws ≈ 0.15 A at 24 V; four on a 20 m chain of 0.5 mm²
(≈ 36 mΩ/m) lose ≈ 0.9 V (3.6 %) ⚑ (the C4b pair's conductor size is not fixed in STD-001).
Each nest steps down locally: 24 → 5 V (head + satellites), 24 → 12 V for the siren; an `ina226` on
the 24 V input makes every Portal a bus B monitor point.

## 12. Departures from existing documents (for STD-009 to state)

| # | document | what it says | what the Portal does |
|---|---|---|---|
| D-1 | ARCH-001 §2 | no second low-voltage backbone | bus B reaches every nest — the assured bus already exists (K25), the Portal extends it to doors |
| D-2 | ARCH-001 / BRIDGE | the hub is the brain | SA-1…SA-5 |
| D-3 | STD-003 §2.4 | the portal needs no new pathway | it now has one: the Silver Rail and ZS-t(h) |
| D-4 | DIN 18015-3 | ZS-t on the latch side only | ZS-t(h), documented (§2.2) |
| D-5 | WORKSHOP-001 §0 | silver = endpoint → RBX; bronze = dedicated path | node tiers and rails (§8) |
| D-6 | IDEA-001 §3 | high zone starts at 1900 | the rail and nest at ≈ 2450 (over-door safe) |
| D-7 | STD-001 room table | door frame point + portal + NTL-TR per room | → one Portal class + tier per door |
| D-8 | catalogues `POR` / `NTL` | portal box at 2150, NTL at 1150 beside the door | POR moves into H0 / H1; NTL into M1 |

## 13. Questions of the fine-tuning — answered 2026-10-10

**Answers:** 1 yes · 2 **general rule** (a shared circuit is always a silver path, a dedicated one gold) · 3–10 the
defaults below. So: PT-S/D/E/W/B (PT-D/W for a double Portal with a wet face) · ZS-t(h) carries SELV and data only ·
H0-3 = latch side · core `vl53l0x` first, `vl53l1x` after a licence check · M3 to the latch side on a swing face ·
more than two doors: the best L, others as spurs · the CLA list below · `STYLE` is the draft figure standard.

The questions as asked:

1. **Q-SF-01**: is §7.4's reading of "both variants" right?
2. **Tiers**: is P-3 (shared circuit = silver) the only exception, or the general rule?
3. **Class codes** `PT-S / D / E / W / B`: keep the prefix, and is a PT-D with one wet face "PT-D/W"?
4. **ZS-t(h) rule 4**: SELV and data only in the hinge zone, mains always from the latch column?
5. **H0-3**: when the hinge corner is too tight, latch side (default) or round the corner into ZS-e?
6. **ToF**: core `vl53l0x` (no pet return) or external `vl53l1x` after a licence check?
7. **H0-2**: on a swing face, M3 to the latch side — agreed?
8. **More than two doors in a room** (§7.2): the two that best form an L, others as spurs?
9. **CLA Portal list** as in §3.2 / §11 (B107 PT-E SF-3; B106, B103, B171 PT-D SF-2; B109 PT-D with a
   wet R08 face, SF-2; B105 PT-W SF-1; B104 PT-S SF-1, beside the bus B pack)?
10. The **figure style** (`STYLE` in `fig/src/idea-003-figs.js`): accept as the draft standard for
    SmartFrame illustrations, or align it with the "VRG Title Card" design system first?

## 14. What happens next

**Phase 2** (after the user's go): **BRIDGE-STD-009 SmartFrame** in the main checkout, plus amendments
to STD-003 §2.4, the STD-001 room table and WORKSHOP-001 §0/§1. **Phase 3** (after round 2026-10-10 is
built): the Planner pack `docs/round-cla-add-001/` with the other CLA-ADD-001 items — model items:
`hwNode.kind:'portal'`, `route:'rail'`, endpoint `from:'frame'`, door-face selection, wall `material`
(the lintel rule), per-wall `refCeiling`, tier / provisioned state, ground height 2850.

---

## Sources

Zones: [baukobox.de — Installationszone](https://baukobox.de/wissen/153-installationszone) ·
[immoportal.com](https://www.immoportal.com/node/98387) ·
[DIN 18101 door sizes (catalogue entry)](https://dinmedia.de/en/standard/din-18101/1175344)

Accessibility: [ETSI EN 301 549 issue on EN 17210 reach ranges](https://labs.etsi.org/rep/HF/en301549/-/issues/540) ·
[Rudabánya akadálymentesítési műszaki leírás (0,90–1,10 m)](https://www.rudabanya.hu/shared_documents/feltoltendo_doksik/2018/My_folder/d._Muleiras_akadalymentesites.pdf) ·
[palyazat.gov.hu akadálymentesítési összefoglaló](https://www.palyazat.gov.hu/api/download/65c1ed29455e7c083bb7aa34) ·
[Budapest Főváros Kormányhivatala — TÉKA hivatkozás](https://service-einfoszab.budapest.hu/api/dvd/208367)

Leaf transfers: [ASSA ABLOY MSL Kabelübergänge](https://www.assaabloy.com/ch/de/documents/service/downloads/msl/broschuere-msl-kabeluebergaenge-zubehoer.pdf) ·
[LINK M 12 91 Montage](https://www.glametec.ch/files/shop/LINK/Montage_M_12_91_2r7.pdf) ·
[2N Kabelübergänge](https://www.2n.com/de_DE/documents/22902/8523946/3_datasheet_kabelove_pruchodky_de.pdf)

Flush boxes: [árgép — süllyesztett kötődobozok](https://www.argep.hu/trend/KOET/Koetoedoboz-obi.html) (Tracon D100X100 and screw-lid sizes) · IDEA-002 §6 / §9

Radios and boards: [esp32.co.uk — C3 vs C6](https://esp32.co.uk/esp32-c3-vs-esp32-c6-which-one-should-you-use/) ·
[esp32.co.uk — best ESP32 for Home Assistant](https://esp32.co.uk/best-esp32-for-home-assistant-s3-c3-c6-c5/) ·
[espboards.dev — ESP32-C6 Super Mini](https://www.espboards.dev/esp32/esp32-c6-super-mini/) ·
[ESPHome LD2450](https://next.esphome.io/components/sensor/ld2450/) ·
[Zbotic HLK-LD2450 listing](https://zbotic.in/product/hi-link-hlk-ld2450-24ghz-trajectory-detection-radar-sensor/) ·
[m5k10/vl53l1x_sensor (external component, licence unconfirmed)](https://github.com/m5k10/vl53l1x_sensor) ·
CoreRef `data/esphome-schema/2026.9.1` (main checkout) · BuildTree `Modder/vrg-buildtree.html`

Localisation: [Bermuda (MIT)](https://github.com/agittins/bermuda) ·
[espressif/esp-csi (Apache-2.0)](https://github.com/espressif/esp-csi) ·
[ESPresense (AGPL-3.0)](https://github.com/ESPresense/ESPresense) ·
[ESPectre on the Espressif registry (GPL-3.0)](https://components.espressif.com/components/francescopace/espectre/versions/3.0.0/readme)

## 15. In the Planner (built 2026-10-10)

See `docs/stack/README.md` → *SmartFrame, clusters and ideal spots*. What the drawings F3 / F4 show is what the
Planner computes: the nest rules H0-1 / H0-3, the cluster rule of IDEA-001 (same face, same zone, ≤ 300 mm;
MAINS + SELV → K3), the corner points of an L room (three outer corners plus the inner one, never over an opening),
and the tiers. Found while drawing F4: **CLA v2's POR sensors sit at 2150, inside the lintel band** — the Portal's
H1 pocket at 2400 is where they belong.
