# BRIDGE-STD-002 — Light and Scene

**Doc:** BRIDGE-STD-002 · **r2** · 2026-10-05 · English
**Parent:** BRIDGE-ARCH-002 r1 §10.1/§10.2 · BRIDGE SELV Telepítési Standard · BRIDGE-STD-001
**Closes:** U4 photometry · U17 the secondary 24 V system · U20 scene semantics ·
U21 secondary lighting catalogue
**Scope:** everything about light that the architecture left as conduit and relays. How bright,
how warm, how smooth, how it fails, and what a scene actually *is*.

> **r2 applies the round-2 decisions.** Material changes: **no DALI in v1**, and the reason is the
> bistable rather than the cost (§10) · a **6500 K moonlight channel** added outside the tunable
> pair (§5.4) · three-channel locus-tracking fixtures **dropped**, because the moonlight channel
> already does that work (§5.2) · manual hold-off runs its **full duration** (§8.3) · the assured
> bus gains a **backup connector** (§7.1) · the rooms that are tunable, and those that get colour,
> are now named.

> **Life-safety boundary.** The egress duty in §7 is **supplementary**. Where statutory
> emergency lighting applies, it is provided by certified luminaires to EN 1838 and
> EN 60598-2-22 on their own certified supply. BRIDGE's 24 V egress segment improves safety;
> it never substitutes for a certified system. This mirrors ARCH-002's treatment of smoke, CO
> and gas detection.

---

## 1. The five light layers

A room is not "lit." It carries five simultaneous layers, each with a different job. This is
gaffer practice applied to a dwelling, and it is the organising idea for everything below —
scenes address *layers*, not fixtures.

| Layer | Job | Character | Typical source |
|---|---|---|---|
| **AMBIENT** | the fill — raise the floor, kill harsh shadow | indirect, even, low contrast | cove uplight, perimeter slot |
| **TASK** | the key — directional light where work happens | placed, controllable cutoff | under-cabinet, desk, reading, vanity |
| **ACCENT** | separation and texture — make surfaces read | narrow beam, grazing | art framing, niche, wall graze |
| **PRACTICAL** | the visible fixture that *motivates* the light | seen, warm, low output | pendant, table lamp, sconce |
| **EGRESS** | orientation and escape in the dark or on failure | very low, warm, continuous | skirting, step, handrail |

**Contrast discipline.** Comfortable domestic evening light runs a key-to-fill ratio of about
**2:1 to 4:1**. Beyond roughly 8:1 a room reads as dramatic rather than habitable — useful for
a film scene, wrong for dinner. A room where only AMBIENT exists reads flat and institutional;
a room where only TASK and ACCENT exist reads like a shop window.

**Motivation.** A lighting state should look as though it comes from a plausible source. An
ambience scene that brightens a wall with no visible reason reads as artificial no matter how
well it is executed. Where a scene raises ACCENT, raise a PRACTICAL with it.

---

## 2. Dimming — the perceptual curve

### 2.1 Why linear duty is wrong

Perceived lightness is approximately the cube root of luminance. CIE 1976 L*:

```
  L* = 116 · (Y/Yn)^(1/3) − 16       for Y/Yn >  0.008856
  L* = 903.3 · (Y/Yn)                for Y/Yn ≤ 0.008856
```

So a 50 % duty cycle looks like roughly **76 %** brightness, and the bottom 10 % of the duty
range carries about a third of the *perceived* range. A linear slider spends most of its travel
in a region where nothing visibly changes, then collapses to black at the end. Every badly
dimmed LED installation has this fault.

### 2.2 The BRIDGE curve

**Setpoint `s` ∈ [0,1] is a perceptual quantity.** Output luminance is derived from it, never
the reverse.

**`s³` is the system curve (C01, confirmed).** The decision was waiting on C20, because DALI gear
implements its own logarithmic curve natively and mixing the two needs a correction table. **With no
DALI in v1 (§10), `s³` applies throughout and the correction table never has to exist.**

| Channel type | Mapping | Note |
|---|---|---|
| **24 V PWM, BRIDGE-controlled** | `duty = s³` (CIE L* inverse, γ ≈ 3) | **the default** — perceptually linear |
| **24 V analog / CCR** | `I = s³ · I_max` | same curve, different actuator |
| **0–10 V gear** | `V = 10 · s^2.2` | γ 2.2 because most 0–10 V drivers already apply some internal shaping — verify per driver |
| **Mains phase dimmer** | per fixture, measured | never assume; mains dimming of LED is fixture-specific |
| *DALI gear, if ever added* | *its native log curve* | *254 steps, each × 10^(3/253) ≈ +2.79 %. Would then need the per-fixture correction below* |

**Cross-technology consistency is a requirement, not a nicety.** A scene set to 40 % must look
the same on a 0–10 V downlight and a PWM cove in the same room. The commissioning step in §11
measures each fixture's actual curve and stores a correction, so that the *scene* is the authority
and the gear is not.

### 2.3 Minimum stable level

| Channel | Minimum | Why |
|---|---|---|
| 24 V constant-voltage strip, PWM | **1 %** | limited by MOSFET switching cleanliness, not the LED |
| 24 V constant-current driver | **1–10 %**, per driver grade | cheap CC drivers drop out or flicker below ~10 % |
| DALI DT6 | **0.1 %** nominal, **1 %** practical | the gear's own floor |
| Mains phase dimmer | **5–10 %** | and often unstable at the bottom |

**Rule:** any fixture in the EGRESS or night-ambience role must reach **≤ 2 %** without flicker
or dropout. A night light that cannot go low enough is worse than no night light — it wakes
people. Specify the driver for the bottom of the range, not the top.

---

## 3. Flicker — the hard constraint

### 3.1 IEEE 1789-2015

Percent modulation (`Mod%`) against fundamental frequency `f`:

| Region | f < 90 Hz | 90 Hz ≤ f ≤ 1250 Hz |
|---|---|---|
| **No observable effect** | `Mod% ≤ 0.01 · f` | `Mod% ≤ 0.0333 · f` |
| **Low risk** | `Mod% ≤ 0.025 · f` | `Mod% ≤ 0.08 · f` |

Above roughly **1250 Hz** the human visual system no longer responds and modulation depth is
effectively unconstrained. At 120 Hz — the ripple frequency of a poorly filtered mains supply —
low risk permits only about **10 %** modulation and no-effect only about **4 %**.

### 3.2 The BRIDGE rule

**All 24 V PWM channels run at ≥ 3 kHz; design target 10–20 kHz.**

Three kilohertz sits comfortably clear of the 1250 Hz ceiling, so any modulation depth —
including 100 % at low duty, which is exactly what PWM does — falls in the no-effect region.
This single decision removes flicker as a concern for the entire ambience layer.

### 3.3 The camera problem, and where PWM stops being right

High PWM frequency solves the eye and not the sensor. A rolling-shutter camera samples the
scene line by line; when PWM interacts with the line rate you get banding, and slow-motion
capture makes it dramatically worse. This matters here because the house is also a place where
things get filmed.

| | **PWM** | **CCR / analog** |
|---|---|---|
| Flicker to the eye | solved above 3 kHz | none, inherently |
| On camera | banding risk; needs ≥ 20 kHz, and slow-motion may still break | **clean at any frame rate** |
| Colour stability at low level | **excellent** — the LED always runs at its rated current, so chromaticity holds | shifts slightly warm as current drops |
| EMI on long runs | real — fast edges on a 10 m strip radiate | negligible |
| Driver cost and availability | cheap, ubiquitous | dearer, less common at 24 V |

**Selection rule (C04, confirmed).** PWM is the default. Use **CCR** anywhere a strip run exceeds
about 8 m, where EMI and voltage drop both argue against fast switching at the far end — and in the
**effect-capable rooms** below.

> **The effect-capable rooms (C05): media room and living.** These are *not* filming spaces — the
> intent is ambient and visual-effect work, not camera work. So they get **CCR for its clean low-end
> behaviour and its freedom from banding on any incidental capture, without being held to
> camera-grade flicker specification.** Practically: CCR drivers on the architectural channels,
> and no requirement to prove ≥ 20 kHz or to validate against a high-speed camera. If a genuine
> filming position is ever wanted, it is one room's drivers and a measurement, not a redesign.

---

## 4. Colour quality

### 4.1 Targets

| Metric | Primary living space | Task critical (kitchen, vanity, studio) | Utility |
|---|---|---|---|
| **CRI Ra** | ≥ 90 | **≥ 95** | ≥ 80 |
| **R9** (strong red) | ≥ 50 | **≥ 90** | — |
| **TM-30-20 Rf** (fidelity) | ≥ 85 | **≥ 90** | ≥ 75 |
| **TM-30-20 Rg** (gamut) | 95–110 | 98–110 | — |
| **Rcs,h1** (red chroma shift) | −1 % to +15 % | 0 % to +15 % | — |
| **Binning, same visual field** | ≤ 3 SDCM | ≤ 3 SDCM | ≤ 5 SDCM |
| **Binning, continuous run** | **≤ 2 SDCM** | ≤ 2 SDCM | ≤ 3 SDCM |

R9 is the metric that separates light people like from light they tolerate. Ra averages eight
pastel samples and is nearly blind to deep red, which is most of what skin, wood, food and
textile actually are. **A fixture with Ra 95 and R9 20 will make a room look wrong and the
datasheet will look fine.**

A continuous cove or under-cabinet run is the strictest binning case in the house: two adjacent
tape segments one bin apart are visible as a step on a white ceiling, where the same pair in two
separate downlights would pass unnoticed.

**C11 confirmed at ≤ 2 SDCM**, which is normal for quality product and widely stocked; ≤ 1 SDCM is a
specialist order with lead times and a premium. **The discipline does most of the work for nothing:
one bin, one reel, one room** (§9.1). Ordering a continuous run from a single reel removes the
comparison entirely, whatever the bin.

**The Ra ≥ 80 variant, and what it costs (C06).** The target stays Ra ≥ 90 / R9 ≥ 50, with task
positions at 95 / 90. Should supply or budget force Ra ≥ 80, the consequences are specific rather
than general: **deep reds go flat** — wood, skin, textile, cooked food all lose saturation, and R9
on an Ra 80 product is routinely below 20; **the vanity position becomes indefensible**, since that
is the one place the spec is visibly on skin; and **mixed procurement becomes visible**, because an
Ra 80 fixture beside an Ra 95 one reads as a fault in the cheaper one. If the variant is taken,
take it **per room and never within a visual field** — utility spaces and the pantry can carry it
with nobody noticing. Never in the kitchen, the bathroom or the living room.

### 4.2 Duv — the asymmetric tolerance

Duv is the signed distance from the Planckian locus in CIE 1960 (u,v). ANSI C78.377 defines
chromaticity quadrangles around nominal CCTs — 2200, 2500, 2700, 3000, 3500, 4000, 4500, 5000,
5700 and 6500 K — with a tolerance of roughly **±0.006**.

**BRIDGE tightens this, and asymmetrically:**

```
   −0.004  ≤  Duv  ≤  +0.002
            ↑                ↑
      slightly pink      slightly green
      acceptable         barely acceptable
```

The eye forgives a white that sits slightly below the locus — it reads as warm, flattering,
candle-adjacent. It does not forgive green. A positive Duv of +0.004 makes skin look ill and
white walls look like a hospital corridor, and once it is noticed it cannot be unnoticed. Every
gaffer knows this asymmetry; the standards do not encode it. **Reject green-tinted product even
when it is inside C78.377.**

---

## 5. Tunable white — the chord problem

### 5.1 The error almost everyone ships

Mix two white channels and the result traverses a **straight line** in chromaticity space
between them. The Planckian locus is **curved**. So the mid-mix of a wide pair sits *below* the
locus — negative Duv, visibly pink — while both endpoints are perfectly on it.

```
         ·· 6500K
      ··   ╲                     the locus curves;
   ··       ╲  ← the mix chord   the mix is a chord.
  ·           ╲                  midpoint sits below → pink
 ·        ✕    ╲                 ✕ = where a 50/50 mix lands
·   mid-mix     ╲
                 ·· 2700K
```

Approximate mid-mix excursion:

| Channel pair | Mid-mix Duv | Verdict |
|---|---|---|
| 2700 K + 6500 K | ≈ −0.008 to −0.010 | **outside C78.377** — this is the common, wrong design |
| 2700 K + 5000 K | ≈ −0.005 | marginal |
| **2700 K + 4000 K** | ≈ **−0.003** | **within BRIDGE tolerance** |
| 2200 K + 3000 K | ≈ −0.001 | excellent, narrow range |

### 5.2 The BRIDGE answer

**The pair is 2700 K + 4000 K (C08, confirmed)**, which tracks the locus closely enough to stay
inside the §4.2 window across its whole range, and covers the CCT span a home actually wants in
a single room.

**Tunable white is fitted in living, bedroom, kitchen and study (C09).** The bathroom is
**fixed-CCT** — a vanity position wants one correct colour at Ra ≥ 95 / R9 ≥ 90, not a range, and
fixed-CCT product at that fidelity is cheaper and better than tunable at the same price.

**Three-channel locus-tracking fixtures are not used anywhere (C10).** The reasoning is worth
recording, because it is a case of one decision quietly settling another: a third channel exists to
widen the range while staying on the locus, and the **6500 K moonlight channel of §5.4 already
provides the wide end** — as an independent scene channel that never enters the white mix and so
never needs correcting. Paying for a third channel inside the fixture would buy the same reach
twice, and the more awkward way round.

**Never synthesise white from RGB.** White from red, green and blue primaries has deep spectral
gaps and gives dreadful fidelity whatever the nominal CCT. White comes from white LEDs. RGB
adds saturated accent on top. A fixture that must do both is **RGBWW** at minimum — RGB plus
*two* whites, not one (C12).

**Colour is fitted in the living room and the media room only (C13).** The reason for the narrow
scope is that the honest use of colour in a house is mostly *communicative* — telling you something
— and **STD-008's notification layer now owns that job properly**, with a fixed vocabulary, in every
room and at every doorway. Tinting a cove to signal something would be more expensive and less
legible than four purpose-built pixels. What remains for architectural colour is scene effect in the
two rooms where scenes are actually composed, which is where it was always going to be used.

### 5.3 Mixing arithmetic

Mix in linear light, in tristimulus space, and only then convert back:

1. Convert each channel's setpoint to **linear luminance** — undo §2.2's curve.
2. Scale each channel's measured XYZ by its linear luminance.
3. **Sum X, Y, Z** across channels.
4. Convert the sum to xy, then to u′v′ / CCT / Duv to verify the §4.2 window.
5. Apply the output curve per channel.

**Never add gamma-encoded values.** Summing setpoints directly is the second most common
tunable-white bug after the chord error, and it produces a mix that is both the wrong
brightness and the wrong colour.

### 5.4 The moonlight channel — a 6500 K scene channel (C08)

A **separate 6500 K channel, outside the tunable pair**, driven independently and used only at very
low level.

**What it is for.** Cool light at low intensity reads as moonlight, and nothing in a 2700–4000 K
pair can produce that sensation at any level — a dimmed warm white reads as candlelight however far
down you take it, because hue and intensity are doing the same thing. Separating them gives a
genuinely different register: a room at 2 % on 6500 K looks like a room with the curtains open on a
clear night, which is a quality the warm pair simply does not contain.

**Why keeping it outside the pair is the important part.**

- It **never enters the white mix**, so the chord problem of §5.1 does not apply to it. No Duv
  correction, no locus tracking, no lookup table.
- It is a **scene** channel, not a white channel. It never participates in CCT setpoints and never
  appears in the tunable range the panel offers.
- It **replaces the case for three-channel fixtures** (§5.2) at a fraction of the cost.

| | |
|---|---|
| Channel | one additional 6500 K channel on the LV ambient runs, driven separately |
| Usable range | **0–8 %.** Above roughly 10 % it stops reading as moonlight and starts reading as a fault |
| Rooms | wherever an ambient run exists in a room used at night — living, bedroom |
| Fidelity | Ra is nearly irrelevant at these levels; **Duv still matters** and the §4.2 window applies, because a green-tinted moonlight is worse than no moonlight |
| Scene use | its own entry in the scene vector (§8.1), additive over the warm layers, never substituting for them |

**One caution.** At 6500 K the melanopic content per lux is the highest of any source in the house.
At 2 % the absolute level is so low that it does not matter — but **the circadian discipline of §6
still governs, and the night cap is an absolute lux figure, not a percentage.** In a bedroom that
means the moonlight channel is bound by the ≤ 1 lx floor figure like everything else, and it will
reach that cap sooner than a warm channel would.

---

## 6. Light level and the circadian dimension

| Space | Task illuminance | Ambient (evening) | Night / egress |
|---|---|---|---|
| Kitchen worktop | **500 lx** | 150 lx | 5 lx |
| Study / desk | **500 lx** (750 for fine work) | 150 lx | 5 lx |
| Bathroom vanity | **300 lx** vertical at the face | 100 lx | 2 lx |
| Living | 200 lx where read | **50–100 lx** | 2 lx |
| Bedroom | 200 lx where read | 30–50 lx | **≤ 1 lx** at the floor |
| Stair / hall | 100 lx | 50 lx | **2–5 lx** continuous |

**Circadian handling.** Intensity at the eye matters more than CCT, and both matter. Working
from the current consensus recommendations: aim for a high melanopic EDI during the day —
on the order of **≥ 250 lx** at the eye — falling to **below about 10 lx** in the few hours
before sleep, and effectively dark during it. CCT is a convenient proxy and an incomplete one;
a bright 2700 K room late at night is still a bright room.

**The practical schedule** is therefore not "warm in the evening" but *dim and warm*, with the
dimming doing most of the work: 4000 K and bright in the morning, 3000 K and moderate through
the afternoon, 2700 K and low after dusk, 2200 K and minimal late, EGRESS only overnight.

---

## 7. BRIDGE-LX — the secondary 24 V system (U17)

Five duties were named for the 24 V layer: built-in, ambience, secondary control network,
emergency, and auxiliary power. **They do not share a reliability requirement**, and that is
the whole design problem. Convenience light may fail freely. Egress light may not.

### 7.1 Two buses, segmented by reliability class

```
  230 VAC (Z1) ──► 24 V PSU ──┬──► BUS A — CONVENIENCE
                              │      built-in · ambience · general LV
                              │      fails with mains. Acceptable.
                              │
                              └──► buffered converter ──┬──► BUS B — ASSURED
                                         │              │     secondary control network
                                    LiFePO4 pack        │     egress / step / handrail
                                    (ideal-diode OR,    │     essential sensors
                                     no switching gap)  │     survives mains loss
                                                        │
                                   hardwired latching relay ──► EGRESS FALLBACK
                                   (energises egress at a fixed level with
                                    no logic involved — manual-first, applied
                                    to light)
```

| | **Bus A — convenience** | **Bus B — assured** |
|---|---|---|
| Serves | built-in, ambience, general auxiliary | secondary control, egress, essential sensors, **NL-TR notification lights** (STD-008 §5) |
| Source | 24 V PSU in Z1 | **one central LiFePO4 pack feeding an assured 24 V bus** (C17), ideal-diode OR |
| On mains loss | **off** | **continues** |
| Autonomy target | — | **2 h at 15 W** → ≈ 30 Wh usable; specify ≈ 6 Ah at 24 V for cycle margin |
| Transfer | — | none required — battery floats, takes over with no gap |
| Fallback | — | hardwired latching relay, fixed level, **no controller in the path** |
| Self-test | — | monthly timed discharge, capacity trend logged, alert on degradation |

> **Why the pack is central and not per-room (C17), and the argument came from the failure matrix
> rather than from convenience.** With the battery inside each RoomBox, a single room's 230 V
> circuit failure takes out that room's PSU **and** its egress light together — in precisely the
> room where a fault has just occurred and someone may be standing in the dark. A central pack
> feeding an assured bus survives that, and gives one battery to maintain and test instead of one
> per room. See STD-006 §2.1.
>
> **The pack carries a backup connector.** A documented hardpoint — polarised, fused, labelled — on
> the assured bus, for a portable pack or a replacement during service. It costs a connector and it
> means the assured bus is never down because a battery is out for exchange.

### 7.2 Why the hardwired fallback exists

The manual-first doctrine says a physical path must survive the loss of the intelligent one.
Applied to lighting, that means the egress segment cannot depend on the sub-controller being
alive. On simultaneous loss of mains *and* the controller, a latching relay on Bus B energises
the egress fixtures at a fixed level — no scene, no logic, no network. It is the ζ/η principle
moved from the wall switch to the lighting rail, and it is the single most important line in
this document.

### 7.3 The secondary control network duty

Bus B also carries a **parallel control path** so that built-in light remains controllable when
COMP or the CHANNEL is down. It is not a second automation system; it is the RoomBox
sub-controller's own local loop, powered from the assured bus, holding last state and honouring
local wall input with no upstream dependency — which is what ARCH-002 §10.3 already promises and
never specifies a supply for. **Bus B is that supply.**

### 7.4 Auxiliary power duty

Bus A's spare capacity is the general-purpose SELV supply for non-lighting loads: valve
actuators, 24 V shutter motors, locks, sensor branches. Rules from the SELV standard apply
without exception — **12 V and 24 V stay electrically separate**, every branch leaving the box
is individually fused and current-monitored, and conductors are sized for **≤ 3 % drop**
(24 V roughly doubles the reach of the 12 V table: 1.5 mm² ≈ 66 m at 0.5 A).

---

## 8. The scene model (U20)

### 8.1 What a scene is

**A scene is an intent, expressed as a vector over layers — not a list of device states.**

```
  scene "evening" = {
      AMBIENT   : { level 0.35, cct 2700 }
      TASK      : { level 0.00 }
      ACCENT    : { level 0.50, cct 3000 }
      PRACTICAL : { level 0.60, cct 2400 }
      EGRESS    : { level 0.02, cct 2200 }
      transition: 2.0 s
  }
```

Three consequences, all of them deliberate:

- **Scenes survive hardware change.** Replace a fixture, re-tag it to a layer, and every scene
  still means what it meant.
- **Scenes compose by layer override, not replacement.** Turning on TASK for cooking does not
  destroy the AMBIENT state underneath it, so cancelling the task returns to where you were
  rather than to a default.
- **A scene is addressable per room and per layer**, so "dim the accent everywhere" is one
  operation.

### 8.2 Transitions

Fades run **in perceptual space** — interpolate `s`, not duty — or the first half of the fade
appears to do nothing and the second half jumps.

| Layer | Default transition |
|---|---|
| AMBIENT | 2.0 s |
| ACCENT / PRACTICAL | 1.5 s |
| TASK | **0.3 s** — a task light that fades feels broken |
| EGRESS | **0 s** on activation, 5 s on release |
| Any layer, manual input | **0.2 s** — manual must feel instant, always |

### 8.3 Precedence

Full arbitration belongs to U3 and BRIDGE-STD-004. The lighting layer needs this much of it
now, highest authority first:

1. **Manual** — a physical edge wins instantly and holds. Non-negotiable; this is the doctrine.
2. **Safety / egress** — mains loss, alarm, leak. Overrides scene and automation both.
3. **Explicit scene** — a human chose it, by panel, app or voice.
4. **Presence** — occupancy-driven change.
5. **Schedule / circadian** — the slow background ramp.

A manual edge sets a **hold-off** on levels 3–5 for that room: **90 minutes (C14), and it runs its
full duration (C15) — there is no early release when the room empties.** Without a hold-off, an
automation reasserts itself thirty seconds after a person overrode it, which is the single most
infuriating failure mode a smart home has.

> **r1 released the hold-off after 10 minutes of vacancy; r2 does not.** The reasoning for the
> change: an override is a statement about how the room should be, not about who is standing in it.
> Leaving to fetch something and returning to find the automation has reclaimed the room is the
> same insult as being overridden while present. **Predictability wins over responsiveness here** —
> the cost is a light occasionally burning for an hour in an empty room, which is a far smaller
> failure than an override that silently expires.

### 8.4 Standard scene set per room

**Ten scenes (C28):** `Off` · `Egress` (≤ 2 %, warm, assured bus) · `Night` (minimal, 2200 K,
floor-level only) · `Moonlight` (6500 K channel at 0–8 %, §5.4, living and bedroom) ·
`Morning` (bright, 4000 K) · `Day` (moderate, 3000–3500 K) · `Evening` (low, 2700 K) ·
`Task` (per room, TASK layer up) · `Film` (ACCENT and PRACTICAL only, AMBIENT ≤ 5 %) ·
`Guest` (generous, flattering, 2700 K, high R9) · `Clean` (everything to full, 4000 K — the one
scene that is deliberately unflattering).

**Two variants are documented and available per room**, since C28 asked for them:

| Variant | Set | When it is the right choice |
|---|---|---|
| **Five-core** | `Off` `Night` `Day` `Evening` `Task` | utility and circulation spaces — hall, pantry, WC, garage. Less to configure, less to maintain, and nobody composes a scene in a pantry |
| **Per-room custom** | whatever the room needs | the media room and the studio, where the scene *is* the point and a generic set gets in the way |

The ten-scene set is the default for habitable rooms. **A room's variant is recorded in the room
schedule**, not decided in the controller — so a scene name means the same thing everywhere it
exists, which is the whole premise of §8.1.

---

## 9. Secondary lighting catalogue (U21)

Positions, optics and cautions for integrated light. Driver and dimming per §2–§3; colour per
§4; binning ≤ 2 SDCM on every continuous run.

| # | Installation | Layer | CCT | Output | Mounting and caution |
|---|---|---|---|---|---|
| 1 | **Cove — indirect uplight** | AMBIENT | 2700–3000 K | 8–14 W/m | ≥ 150 mm from the ceiling, with a return lip to hide the strip. The best ambient source in a room; the most commonly botched. Strip too close to the ceiling gives scalloping. |
| 2 | **Perimeter slot / shadow gap** | AMBIENT·ACCENT | 2700–3000 K | 6–10 W/m | Grazes the wall. Needs a flat wall — it reveals every defect in the plaster, which is a feature in new work and a disaster in old. |
| 3 | **Under-cabinet** | TASK | 3000–3500 K | ≥ 500 lx on worktop | **Front edge** of the cabinet, not the back, or you light the splashback and shadow the work. Diffused — a bare strip reflects as a line of dots in polished stone. CRI ≥ 95, R9 ≥ 90 for food. |
| 4 | **Plinth / toe-kick** | EGRESS·AMBIENT | 1800–2200 K | 3–6 W/m | Night orientation at the lowest useful height. Natural Bus B load. |
| 5 | **Skirting / step marker** | **EGRESS** | 2200 K | 2–4 W/m | **Bus B, assured.** The backbone of night navigation; must dim to ≤ 2 %. |
| 6 | **Stair tread / riser** | **EGRESS** | 2200–2700 K | per tread | Bus B and the hardwired fallback of §7.2. Light the tread, never the eye of someone descending. |
| 7 | **Handrail integrated** | EGRESS·ACCENT | 2200–2700 K | 4–8 W/m | Continuous, shielded downward. Doubles as ambience. |
| 8 | **Wardrobe / drawer** | TASK | **4000 K** | 300 lx | Door-switched, local. Cooler here on purpose — clothing colour discrimination needs it. |
| 9 | **Mirror / vanity** | TASK | 3500–4000 K | 300 lx **vertical at the face** | **Bilateral vertical** — light from both sides, not above. CRI ≥ 95, R9 ≥ 90. A downlight over a mirror is the worst light in any house. |
| 10 | **Shelf / niche / display** | ACCENT | 3000 K | narrow beam | Light the object, not the shelf. Hide the source above the sight line. |
| 11 | **Art / picture framing** | ACCENT | 3000 K | framed to the canvas | Rf ≥ 95, UV-free. Beam cut to the frame edge — spill onto the wall destroys the effect. |
| 12 | **Headboard / reading** | TASK | 2700 K | 200 lx at the page | Sharp cutoff. A reading light that spills onto the other pillow ends marriages. |
| 13 | **Bathroom niche / shower** | ACCENT·EGRESS | 2700 K | low | **IP65, SELV only.** Beyond the RB-E/W there is no mains in the room. |
| 14 | **Ceiling perimeter graze** | ACCENT | 2700–3000 K | 6–10 W/m | Texture on a textured ceiling only. On a flat ceiling it looks like a mistake. |
| 15 | **Outdoor — facade graze** | ACCENT | **2200–2700 K** | shielded | Warm and low. Dark-sky discipline: full cutoff, nothing above horizontal, 3000 K ceiling. |
| 16 | **Outdoor — path / step** | EGRESS | 2200 K | 1–3 W each | Shielded downward, spaced for continuity not brightness. |
| 17 | **Outdoor — tree uplight** | ACCENT | 2700 K | narrow | Aim into canopy; never across a boundary or into a neighbour's window. |

### 9.1 Installation rules for continuous runs

- **Aluminium profile always.** LED life roughly halves for every 10 °C of junction temperature;
  bare tape stuck to plasterboard runs hot and fades unevenly, which on a cove reads as a stripe.
- **Centre-feed long runs.** A 24 V strip fed from one end dims visibly toward the far end;
  centre-feeding halves the drop. Size to ≤ 3 % per the SELV standard; at 24 V, 1.5 mm² carries
  roughly 66 m at 0.5 A.
- **Dot-free spacing or a deep diffuser** anywhere the strip is within sight of the eye, which
  includes every reflection in glass, stone and gloss paint.
- **Corners:** mitre the profile and use a corner connector; do not bend tape around an internal
  corner — it stresses the copper and the bend becomes the first failure.
- **One bin, one reel, one room.** Order continuous runs from a single reel and record the bin.

---

## 10. Choosing a control path

| Need | Path | Note |
|---|---|---|
| Mains lamp, on/off only | bistable relay in Z1, SELV coil | ζ/η per Smart Switch. The default. |
| Mains lamp, dimmed | mains dimmer in Z1 | fixture-specific; measure the curve and the floor |
| 24 V single-colour strip | PWM (or CCR per §3.3) from Z2 | the workhorse |
| 24 V tunable white | two PWM/CCR channels, §5.2 pair | locus-checked lookup |
| 24 V RGBWW | five channels | white from white; RGB for accent only |
| Third-party driver, simple | 0–10 V | verify the internal curve |
| 6500 K moonlight channel | PWM or CCR from Z2, **driven independently** | §5.4. Never part of a CCT setpoint |

### 10.1 No DALI in v1 (C20) — and the reason is the bistable, not the cost

**What DALI-2 DT8 would buy.** Individual addressing of every fixture over one bus pair. Dimming
and colour without a control conductor per fixture. Lamp-failure reporting. Scene storage in the
gear. One two-core bus instead of a switched live each.

**What it would cost.** €10–25 per fixture in driver premium, a bus power supply, a gateway, and
real commissioning — every fixture addressed and grouped, repeated whenever one is replaced.

**On fixture count it is a coin toss.** The reference dwelling has about **15 controlled mains
fixtures** and about **10 low-voltage runs**. DALI would not touch the LV runs — BRIDGE drives those
from Z2 directly, more cheaply and with a better curve. Fifteen points sits squarely in the usual
15–25 crossover.

**But count is not what decides it:**

> **A DALI driver has no bistable memory element.** The ζ/η guarantee of the Smart Switch standard is
> implemented *in hardware* — a bistable relay the load follows, fed by both the manual switch and
> the wireless side, degrading to a clean manual circuit when the intelligence dies. A DALI fixture
> has none of that. Manual-first on DALI would have to be re-implemented in firmware, which is
> precisely what the doctrine exists to prevent.

And **C30 keeps the bistable relay per lamp in Z1 regardless** — so DALI's largest single benefit,
replacing per-fixture switching wiring, is foreclosed before the comparison begins. What remains is
a nicer dimming protocol, and PWM and 0–10 V already provide that.

**Decision: no DALI in v1. Two things keep the door open for almost nothing** — the **C4b M20 spare**
in the CHANNEL bundle can carry a DALI pair later (STD-001 §3.1), and the gateway position at NET
from ARCH-002 §4.2 stays reserved. If fixture count doubles, or lamp-failure reporting becomes worth
real money, it is an addition rather than a rebuild.

---

## 11. Commissioning the light layer

- [ ] Measure and record each fixture's **dim curve and minimum stable level**; store the
      per-fixture correction so a scene at 40 % matches across DALI, PWM and 0–10 V.
- [ ] Verify PWM frequency **≥ 3 kHz** on every channel; **≥ 20 kHz** or CCR in filmed spaces.
- [ ] Record **CCT, Duv, Ra, R9 and TM-30 Rf/Rg** per fixture type from the datasheet, and
      reject any product with **Duv > +0.002**.
- [ ] Verify binning **≤ 2 SDCM** on every continuous run; record reel and bin.
- [ ] For every tunable-white fixture, verify **mid-mix Duv** lies within −0.004…+0.002.
- [ ] Measure **task illuminance** at the working plane against §6; measure **vertical**
      illuminance at the face for vanity positions.
- [ ] Verify night/egress levels reach **≤ 2 %** without flicker or dropout.
- [ ] **Bus B discharge test:** 2 h at design load; log capacity; schedule the monthly repeat.
- [ ] **Egress fallback test:** drop mains *and* the sub-controller; confirm the latching relay
      energises egress at the fixed level with no logic in the path.
- [ ] Verify the manual hold-off: override a scene by hand, confirm no automation reasserts for
      the configured window.

---

## 12. Open items

| Ref | Open |
|---|---|
| **C23 / C23B** | **Which integrated lighting types are in the first build.** Waiting on photographs rather than on reasoning — see [`06_reference-images/`](../06_reference-images/README.md). Five items depend on seeing them |
| **U20+** | The per-room scene schedule — §8.4 gives the sets, not the values per room. Needs D1 |
| **C29** | Certified emergency luminaires on the stairs: confirm with the electrician what OTSZ actually requires here, at the same time as the A08 certification conversation |
| — | Melanopic EDI figures in §6 follow current consensus and should be checked against the latest CIE position before being quoted to anyone else |
| — | Fixture schedule per room, which depends on D1 and on P33's hardware composition (U22) |
| — | The moonlight channel's 0–8 % ceiling (§5.4) is judgement, not measurement. Worth setting by eye on the first installed run and then fixing the number |

**Closed in r2:** C01 *(by C20)* · C02 C03 C04 C05 C06 C07 C08 C09 · C10 *(by C08)* · C11 C12 ·
C13 *(by STD-008)* · C14 C15 C16 C17 C18 C19 C20 C21 C22 C24 C25 C26 C27 C28 C30. **D6 is resolved
as "no"** by §10.1; **D7 moves to STD-007 §2.4**, where the amp-bay thermal finding settled it; and
**U3's general ladder is now STD-006 §1**.
