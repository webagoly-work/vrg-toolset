# BRIDGE-STD-001-A1 — Passive Thermal Design

**Doc:** BRIDGE-STD-001 Annex 1 · r1 · 2026-10-05 · English
**Origin:** round-2 answer **B17** — "a simple yet effective physical layout of empty pipes that can
passively circulate airflow"
**Closes:** **B04** zone order · **B05** RF column position · **B07** fill cap
**Supersedes:** the vent-area figures in **STD-001 §2.6**, which are too small — see §3

> **Status of the numbers.** First-order stack-effect arithmetic, not CFD. The figures are good
> enough to size a cover and wrong enough that the 30-minute sustained-load measurement already
> required by STD-001 §8 is what actually confirms them. Where they disagree, believe the
> thermocouple.

---

## 1. What a passive design can and cannot do here

### 1.1 The driving force is very small

A chimney is driven by the weight difference between the warm column inside and the cool air
outside:

```
   Δp = g · h · (ρ_ambient − ρ_internal)
```

Air is 1.197 kg/m³ at 22 °C and 1.127 at 40 °C, so an 18 K rise gives Δρ ≈ 0.070 kg/m³. Which means:

| Stack height **h** | Driving pressure at ΔT = 18 K |
|---|---|
| 0.3 m | **0.21 Pa** |
| 0.5 m | 0.34 Pa |
| 1.0 m | 0.69 Pa |
| 2.0 m | 1.37 Pa |

For scale: 1 Pa is roughly the pressure of a two-millimetre column of water. Everything below
follows from the fact that there is almost no force available, so **free area is the only lever
that matters.**

### 1.2 The finding that kills the obvious design

The intuitive answer is a duct from the top of the box up to a high grille. It does not work,
because of where the box sits.

```
   ceiling  ─────────────── +2.70 m
                              ↕  only 200–400 mm of stack available
   box top  ─────────────── +2.30 … 2.50 m
                 ROOMBOX       400–600 mm tall
   box base ─────────────── +1.90 m   (STD-001 §2.5, confirmed by B12)
```

The RoomBox bottom edge is at **≥ 1.90 m** and the box is 400–600 mm tall, so it tops out at
2.3–2.5 m against a 2.7 m ceiling. **There are only 200–400 mm of height above the box** — about
0.2 Pa, which moves essentially no air.

### 1.3 And the second intuitive answer is also wrong

The next instinct is to run the *intake* down to floor level to get 2.1 m of height. It does not
work either, and the reason is worth understanding because it is counter-intuitive:

> **The driving head comes from the height of the *hot* column, not the total length of ductwork.**
> An intake duct carries cool ambient air. Adding two metres of cool air to the circuit adds two
> metres of friction and no buoyancy at all.

A low intake is still **mildly worth doing**, but for a different reason: air at +0.3 m in a heated
room is typically 2–3 K cooler than air at 2.2 m. That raises the usable ΔT by about 10 %, which is
a real but modest gain. It buys cooler air, not more draught.

### 1.4 So the box itself is the chimney

The only stack height genuinely available is **the box's own height, 0.4–0.6 m.** Everything else
is detail. That sounds like a defeat and is actually fine, because at these scales free area
dominates and area is cheap.

---

## 2. The arithmetic

Flow through a vent pair driven by stack pressure:

```
   v = √(2Δp / ρ) / √ζ          Q_heat = A · v · ρ · c_p · ΔT
```

with ζ ≈ 5 for a louvre pair plus the internal path (entry 0.5, two louvres ~1.5 each, exit 1.0,
internal 0.5), ρ ≈ 1.12 kg/m³ and c_p = 1005 J/kg·K.

At **ΔT = 20 K** and **h = 0.5 m**: Δp = 0.378 Pa → v ≈ **0.37 m/s** → the vent pair removes about
**8 300 W per m² of free area.**

### 2.1 Required free area, per opening

| Class | Design dissipation | **Free area per opening** | As a slot across the cover |
|---|---|---|---|
| **RB-S** | 25 W | **≈ 3 000 mm²** | 280 × 11 mm |
| **RB-M** | 40 W | **≈ 4 800 mm²** | 380 × 13 mm |
| **RB-L / RB-H** | 70 W | **≈ 8 500 mm²** | 480 × 18 mm |
| **RB-O** (sealed) | 45 W | — | conduction only, see §5 |

**Two openings per box — one low, one high.** The figures above are *each*, not the total.

### 2.2 This corrects STD-001 §2.6

| Class | STD-001 §2.6 said | Should be | Factor |
|---|---|---|---|
| RB-S | 1 200 mm² total | 3 000 mm² **each** | **5×** |
| RB-M | 2 000 mm² total | 4 800 mm² **each** | **4.8×** |
| RB-L / RB-H | 3 500 mm² total | 8 500 mm² **each** | **4.9×** |

**The original figures were roughly five times too small.** At 2 000 mm² total, an RB-M carrying its
40 W design maximum would settle about **50 K above ambient** — 72 °C at a 22 °C room, 85 °C at the
35 °C design ambient, which cooks electrolytics and voids most PSU derating curves.

The correction is undramatic in practice: **a full-width louvered slot 13–18 mm deep at the top and
bottom of the cover.** On a 400 × 500 mm cover that is two thin lines, which a paintable polymer
front (B13) can carry without looking like equipment.

---

## 3. The design

### 3.1 The cover does the work

```
   ┌══════════════════════════════════┐   ← louvered slot, full width, 13–18 mm
   │                                  │
   │   Z1  MAINS · PSU                │   heat sources HIGH — their rise exits immediately
   │ ══════ partition ══════          │
   │   Z3  DATA / MEDIA / USB    ┃ Z4 │   ┃ = RF column, open top and bottom:
   │ ──────────────────────      ┃ RF │       a clear vertical duct (§3.3)
   │   Z2  LV & CONTROL          ┃    │
   │ ──────────────────────           │
   │   Z5  SENSOR  (shelf)            │   sensors LOW — in intake air
   └══════════════════════════════════┘   ← louvered slot, full width
              ↑                    ↑
         cool air in          baffle forces the path across
                              the heat sources, not past them
```

**Four rules.**

1. **Two openings, separated top and bottom.** A cover with vents scattered over its face
   short-circuits: air enters and leaves through adjacent slots and never crosses the box. Separation
   is worth more than total area.
2. **An internal baffle** behind the lower slot, directing incoming air to the rear of the box so it
   rises *through* the equipment rather than up the inside of the cover.
3. **Louvres angled down and outward**, so the slot sheds dust and anything dropped, and reads as a
   shadow line rather than a hole.
4. **No filter.** A filter is a maintenance item nobody services and its blockage is invisible. The
   BASE can have one because the BASE has a fan and a service schedule; a wall box in a bedroom
   cannot. Accept dust and design for cleaning at the slot.

### 3.2 B04 — zone order is now settled, with a physical reason

**Sensors low, mains and PSU high.** Confirmed, and no longer merely a convention:

- The PSU is the dominant heat source — 18 W of RB-L's 41 W typical. **At the top its rise leaves
  immediately through the upper slot.** At the bottom it would warm every zone above it on the way
  out, and the sensor shelf worst of all.
- **Z5 sits in incoming air**, which is both the coolest air in the box and the closest in
  temperature to the room it is trying to measure. A temperature sensor downstream of a power supply
  measures the power supply.
- MAINS conduits enter from the top anyway, because they come from the cabinet through the wall head.

The convention of putting mains at the bottom exists because that is where cable enters a consumer
unit standing on a floor. A box at 1.9 m has no such constraint.

### 3.3 B05 — the RF column earns a second job

**Side column, hinge-opposite** — confirmed, and now with a thermal reason on top of the EMI one:
**leave its top and bottom open to the box and it becomes a clear vertical duct**, the one path
through the box that is guaranteed never to be packed with cable.

Requirements: ≥ 20 mm clear front-to-back, unobstructed at both ends, and the radios mounted against
the outer wall of the column so the duct stays open. The RF window stays non-metallic; a vented RF
window is better still, and the IR head needs its own aperture regardless.

### 3.4 B07 — the fill cap is a thermal limit, not a growth limit

**60 % confirmed**, with the reason corrected and a rule added. The cap was drafted as headroom for
future equipment. It is also the thing that keeps air moving: a box packed to 90 % has no internal
path and the slots do nothing.

> **Add to the fill rule: a clear vertical channel of ≥ 20 mm must remain at the front of every
> zone, from the lower slot to the upper.** Cable may fill the depth behind it; the front channel
> is the chimney and nothing is allowed to live there.

That rule does more for the thermal result than the percentage does.

---

## 4. Where empty pipes genuinely help

The brief asked for a layout of empty pipes. Four places where a conduit earns its keep, and one
where it does not.

| # | Pipe | Size | Gain | Verdict |
|---|---|---|---|---|
| **1** | **Chase cross-vent** — a pair from the masonry chase around the box out to the room, one low one high | 2 × M40 | Turns dead cavity air into part of the circuit and adds the chase height to the stack | **Worth it in a 25 cm masonry chase.** Pointless in a stud wall, where the cavity is already open |
| **2** | **Low intake duct** — box base down to a grille at +0.3 m | M40 | Intake air 2–3 K cooler → **~10 % more heat capacity.** Adds no draught, see §1.3 | **Worth it for RB-L and RB-H only.** Reuses the +0.30 m band already in the SELV standard |
| **3** | **Inter-box link** — between clipped szerelvénydoboz units | M25 | Lets adjacent boxes share a thermal path | Worth it wherever the STD-008 clipped-box pattern is used |
| **4** | **Floor-void riser** — box top into the void above, up to a high grille or a riser | M50 | **The only pipe that adds real stack height** — 1–2 m where a floor exists above | **Best gain available, and the most conditions attached.** Fire-stopping to OTSZ is mandatory; it is also an acoustic path between storeys, so not above a bedroom |
| **5** | ~~Duct to outside~~ | — | — | **No.** It brings moisture and insects into a wall cavity, is a fire path, and in an external wall it breaches the vapour barrier — the condensation risk ARCH-002 §7.2 already warns about. **Vent to the room, never to outdoors** |

**On #5, the obvious objection and its answer:** venting into the room puts the heat into the house.
Forty watts is the output of half a person. It disappears into the room's own thermal budget and in
winter it is useful. Outdoor venting trades a non-problem for three real ones.

---

## 5. The sealed case — RB-O and RB-E/W

**RB-O is IP65 with a breather membrane (B18) and cannot vent.** It loses heat by conduction through
its enclosure and keeps 80 % of its budget, so 45 W against RB-M's 40 W class. Three rules:

- The **24 VAC irrigation transformer is the lowest component in the box** — it is the largest single
  source and conduction, not convection, is doing the work.
- Metal enclosure, or a metal back-plate bonded to the wall, in preference to all-polymer.
- Shade it. A sealed box in direct sun gains more from insolation than from its own electronics.

**RB-E/W, the wet-room box**, vents **to the dry side of the room** (STD-001 §5) and has condensation
as its binding constraint rather than temperature. A small, deliberate air change matters more than
the free area, and ZI's water-ingress detector is mandatory here.

---

## 6. The option that would remove the problem entirely

Worth stating because it is the only change that makes the thermal question disappear, and because
the round-2 answers already point halfway toward it.

**Move the 230 → 24 V supply out of the RoomBox.** The PSU is 18 W of RB-L's 41 W typical and the
single largest source. Centralise it and RB-L's dissipation falls to around **23 W** — comfortably
inside an RB-S cover specification, with no fan anywhere in the house and the §2.1 areas halved.

**C17 already chose a central assured pack**, so a central 24 V supply is a continuation of a
direction you have taken rather than a reversal.

**What it costs**, stated plainly because it is not free:

- A **24 V distribution conduit** that the CHANNEL does not currently have — LV is explicitly *not*
  a CHANNEL layer, so this adds a conduit to the bundle.
- **Voltage drop.** A RoomBox draws several amps; at 3 A on 2.5 mm², the 3 % limit is reached at
  about 22 m. Distant rooms would need 4 mm² or a local supply after all.
- **A single point of failure** for all low voltage, where the present design has one per room.
- It contradicts ARCH-002's *power at the point of use* principle, which exists for good reasons.

**Recommendation: do not adopt it now.** The §2.1 cover specification handles the full design load
passively, and the distributed PSU is more robust. But if the cover slots prove unacceptable
visually, or the commissioning measurement comes in hot, this is the move — and it is cheaper to
take at first fix than later.

---

## 7. Commissioning — replaces the thermal line in STD-001 §8

- [ ] Verify **two separated openings**, upper and lower, with the free area of §2.1 for the class.
      Measure the free area; a louvre's gross dimension is not its free area and the difference is
      usually 40–60 %.
- [ ] Verify the **internal baffle** directs incoming air to the rear of the box.
- [ ] Verify the **≥ 20 mm clear front channel** in every zone, from lower slot to upper.
- [ ] Verify the **RF column is open at both ends** and that nothing has been routed through it.
- [ ] **Run the box at sustained three-quarters of its design load for 60 minutes** — not 30 — and
      record air temperature at the top of the box, at the PSU body, and at the sensor shelf.
- [ ] **Accept at ΔT ≤ 25 K** air-to-room. Investigate above 30 K. At 35 K the box is undersized,
      under-vented, or over-filled.
- [ ] Verify the sensor shelf reads within **1.5 K of the room** — if it does not, Z5 is in the
      exhaust path rather than the intake and the baffle is wrong.
- [ ] RB-O: run it in summer sun and record. Conduction has no safety factor.

---

## 8. Open

| Item | Open |
|---|---|
| Louvre free-area ratio | Depends on the chosen profile. It sets the gross slot size, so it needs a product before the cover can be drawn |
| Floor-void riser | Where a floor exists above, and what OTSZ requires of the penetration. Worth asking the certifying electrician at the same time as C29 |
| B02 row pitch | Interacts with this annex: a taller row pitch means a taller box, which means more stack. Addressed in the open-items briefing |
| — | These numbers want one validation against a real box before the cover is tooled. One instrumented RB-M at full load would confirm or correct the whole annex for the cost of an afternoon |
