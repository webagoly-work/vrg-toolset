# Home Cinema Installation Guide — Part 1: Architectural Base

**Scope:** First-fix / foundation work for 5.1 and 7.1 surround installations in dedicated and semi-dedicated rooms. Covers placement geometry and the equations to derive it, wireway sizing and topology, power circuit design, and an integrated ambience-lighting variant.

**Audience:** Electrical and AV contractors doing the work that gets buried. Everything in this document has to be right *before* the plasterboard closes.

**Version:** 1.0 — 2026-10-18
**Part 2 (separate document):** Second fix, termination, speaker mounting hardware, calibration, commissioning, acceptance testing and handover documentation.

---

## 0. Regulatory landmines — read before quoting

These four change the design, not just the paperwork.

| # | Issue | Consequence for the design |
|---|---|---|
| 0.1 | **Thermal insulation derating.** MSZ HD 60364-5-52 / BS 7671 Table 52.2: a cable totally surrounded by thermal insulation over a length >0.5 m has `Ci = 0.50`. Shorter lengths use the graduated table. | Mains cables cannot be laid loose in an insulated ceiling void at their nominal rating. Either upsize every run, or build air-gap channels (§5.4). The channel approach is cheaper and reversible. |
| 0.2 | **CPR Euroclass.** Regulation (EU) 305/2011 requires a Declaration of Performance and reaction-to-fire class for cables permanently installed in construction works. Required class per building type is set nationally (HU: OTSZ). | Consumer-grade speaker cable and HDMI leads frequently have no DoP. If it stays in the wall it needs one. Confirm the class before ordering, not after. |
| 0.3 | **Concealed cavity / fire compartmentation.** A suspended ceiling plenum is a concealed cavity. Cavity barriers may be required where it crosses a compartment line. | Insulation in a void containing electrical work: A1/A2 mineral wool only. No PIR, no EPS. Barrier positions must be agreed before the channel layout is set, because a barrier is also a pathway blockage. |
| 0.4 | **Competence boundary.** Final circuit alteration, consumer-unit work and certification are regulated work in most jurisdictions. | If the AV integrator is not also the certifying electrician, the circuit schedule in §7 must be issued to the electrician as a design input, and the test results come back as part of the handover pack. |

---

## 1. Anchor data — what you must have before you draw a line

The entire geometry falls out of a small number of anchors. Collect these at survey. Anything you cannot get, you must *assume and record as an assumption* — an unrecorded assumption is how a screen ends up 200 mm into a door opening.

### 1.1 Hard anchors (measure, never assume)

| Symbol | Quantity | Notes |
|---|---|---|
| `L` | Room length, screen wall → rear wall (m) | Measure at floor level and at 2 m height; out-of-square rooms are common |
| `W` | Room width (m) | Measure at three points along `L` |
| `H` | Structural ceiling height (m) | Before any suspended ceiling |
| `H_f` | Finished ceiling height after any felzárás / plenum (m) | `H_f = H − t_plenum` |
| `x_scr` | Screen plane offset from the front wall (m) | 0 for on-wall, >0 for a false wall or a free-hanging roller |
| — | Door positions, swing/slide zones, window positions | Including where sliding leaves **park** when open |
| — | Structural slab type and direction of joists | Decides whether a transverse ceiling run is cheap or expensive |
| — | Existing services in the front wall and ceiling | |

### 1.2 Soft anchors (client decision, pin down early)

- Seating: single row or two rows; riser height if two
- Seated eye height `h_eye` — use 1.15 m default for a sofa, 1.20 m for a dedicated cinema chair
- Target format: 5.1 / 7.1 / future 7.1.4
- Display: projector + screen, or flat panel (changes §3.8 and §6 entirely)
- Whether the screen is acoustically transparent (AT) — decides whether L/C/R go behind it
- Aesthetic constraint: on-wall / in-wall / invisible

### 1.3 Derived anchors (calculated, §3)

`D` viewing distance · `W_s` image width · `H_s` image height · `x_MLP` seat position · all speaker coordinates · `x_PJ` projector position · the beam keep-out corridor.

### 1.4 Coordinate convention used throughout

```
x : distance from the SCREEN PLANE into the room      (0 … L − x_scr)
y : lateral offset from the room centreline            (− W/2 … + W/2)
z : height above finished floor level (FFL)            (0 … H_f)
```

Angles are measured at the main listening position (MLP), with **0° = straight ahead at the screen**, increasing toward the listener's left and right symmetrically (so a "110° surround" means 110° on both sides).

---

## 2. Placement rules — reference values

Sources: Dolby home theatre guidelines, ITU-R BS.775, THX, and CEDIA/CTA-RP22 *Immersive Audio Design Recommended Practice* (2023, which expands and supersedes CTA/CEDIA-CEB22-B). Where sources differ, both ranges are given — pick one and record the choice.

### 2.1 Horizontal angles

| Channel | 5.1 | 7.1 | Notes |
|---|---|---|---|
| Left / Right front | ±22° to ±30° | ±22° to ±30° | ITU says 30°; THX 22–30°. Never narrower than the screen edges. |
| Centre | 0° | 0° | |
| Side surround (Ls/Rs) | ±100° to ±110° | ±90° to ±110° | In 5.1 the surrounds carry rear information too, so bias toward 110°. In 7.1 they are purely lateral, so 90–100° is correct. **This is the single biggest difference between the two layouts.** |
| Rear surround (Lb/Rb) | — | ±135° to ±150° | Minimum 1.0 m separation between the pair. Below that, collapse to 5.1. |
| Subwoofer | n/a | n/a | Position by mode behaviour, §3.9 |

### 2.2 Heights

| Channel | Target `z` | Tolerance |
|---|---|---|
| L / R front | Tweeter at `h_eye` ±0.15 m, or aimed at MLP | If the tweeter is >0.3 m off-axis, toe and tilt are mandatory |
| Centre | Behind an AT screen: image centre. Below a non-AT screen: as high as possible, tilted up at MLP | Never below 0.6 m |
| Ls / Rs | `h_eye + 0.60 m` (Dolby: ~2 ft above ear) | Range `h_eye + 0.45` to `h_eye + 0.90`; cap at `H_f − 0.30` |
| Lb / Rb | Same as Ls/Rs — match them | Mismatched surround heights are audible on pans |
| Subwoofer | Floor | |

### 2.3 Hard clearances

| Rule | Value | Reason |
|---|---|---|
| Speaker baffle to nearest side wall | ≥ 0.60 m | SBIR cancellation notch |
| MLP to rear wall | ≥ 1.00 m, ≥ 1.20 m preferred | Rear-wall SBIR and rear surround angle |
| MLP not at `0.5 · L` | avoid `0.5L ± 0.05L` | Pressure null of the first-order length mode |
| Image bottom edge to FFL | ≥ 0.60 m | Sightline over furniture |
| Ceiling to beam apex | ≥ depth of any ceiling fixture that protrudes | §3.8 |
| Rear surround pair separation | ≥ 1.00 m | Below this they image as one source |

---

## 3. The equations

Five starter sets, depending on what is already fixed. Run the set that matches your anchors, then **always run §3.10 (the constraint sweep)** — the sets produce an ideal, the sweep tells you whether the room allows it.

Constants used:
```
AR   = image aspect ratio (1.78 for 16:9, 2.35 or 2.39 for scope)
θ    = horizontal viewing angle subtended by the image at the MLP
       SMPTE reference  30°      (conservative, good for mixed use)
       THX / RP22 range 36°–40°  (cinema reference)
c    = 343 m/s (speed of sound, 20 °C)
ρ_Cu = 0.0178 Ω·mm²/m
```

### 3.1 Set A — only the room is known (new build, blank room)

This is the normal case and the one that gives the best result, because nothing is fixed yet.

**Step 1 — seat position.**
```
x_MLP ∈ [0.55·L , 0.65·L]          preferred (larger image, better rear surround room)
x_MLP ∈ [0.35·L , 0.45·L]          alternative ("38% rule", better bass, smaller image)
```
Exclude `0.5L ± 0.05L` in both cases. Then enforce:
```
L − x_MLP ≥ 1.20                   (rear clearance)
```
For 7.1 additionally:
```
L − x_MLP ≥ 1.50                   (7.1 VIABILITY TEST — see §3.6)
```
If this fails, the room is a 5.1 room. Say so in writing at design stage rather than discovering it at second fix.

**Step 2 — viewing distance.**
```
D = x_MLP − x_scr
```

**Step 3 — image width, from the viewing angle.**
```
W_s(angle) = 2 · D · tan(θ/2)
```

**Step 4 — image width, from the ceiling height.** This is the constraint most often missed, and it binds hard in rooms with a suspended ceiling.
```
z_bot  = h_eye − H_s/3             (eye in the lower third of the image)
H_s    = W_s / AR
```
Solve for the maximum image the room height allows, where `c_lens` is the vertical space you need above the image for the lens plus mount plus any screen pocket (0.30–0.40 m typical, 0.22 m absolute minimum with a recessed projector):

```
H_s,max = (H_f − c_lens − h_eye) / (1 − 1/3)
        = 1.5 · (H_f − c_lens − h_eye)

W_s,max(height) = AR · H_s,max
```

**Step 5 — take the binding constraint.**
```
W_s = min( 2·D·tan(θ_max/2) , AR · 1.5 · (H_f − c_lens − h_eye) )
```
Then recompute `H_s = W_s/AR` and `z_bot = h_eye − H_s/3`, and verify `z_bot ≥ 0.60`.

> **Worked example.** `L = 6.0, W = 6.0, H = 2.85, t_plenum = 0.25 → H_f = 2.60`, `x_scr = 0.50`, `h_eye = 1.15`, `AR = 1.78`, `θ_max = 40°`, `c_lens = 0.32`.
> `x_MLP = 0.60 · 6.0 = 3.60` → rear clearance `2.40 ✓`, 7.1 viable ✓
> `D = 3.60 − 0.50 = 3.10`
> Angle-limited: `W_s = 2 · 3.10 · tan(20°) = 2.26 m`
> Height-limited: `H_s,max = 1.5 · (2.60 − 0.32 − 1.15) = 1.70 m` → `W_s,max = 3.02 m`
> Binding: the **angle**, so `W_s = 2.26 m`. In practice round down to a stock size: **2.10 m (95") → θ = 37.4°**, `H_s = 1.18`, `z_bot = 1.15 − 0.39 = 0.76 m`.
> Raise `z_bot` to 0.95 m for furniture clearance and accept the eye at 16% up the image, or keep 0.76 m — record the choice.

### 3.2 Set B — screen size already fixed

Client owns the screen, or the wall dictates it.
```
D       = W_s / (2 · tan(θ/2))     evaluate for θ = 30° and θ = 40°
x_MLP   = x_scr + D
```
This gives an acceptable seating *band*, not a point. Pick within it subject to `x_MLP ∉ 0.5L ± 0.05L` and `L − x_MLP ≥ 1.20`.

If the band does not intersect the room at all, the screen is the wrong size — state which direction and by how much.

### 3.3 Set C — seating fixed (retrofit, existing furniture)

```
D    = x_MLP − x_scr               (measured)
W_s  = 2 · D · tan(θ/2)            evaluate the 30°–40° band → a size range
```
Then clamp with the Step-4 height constraint from Set A. Everything downstream (speakers, projector) follows from `D` and `W_s` as in Set A.

### 3.4 Set D — projector already owned

Throw ratio `TR` is a range `[TR_min, TR_max]` from the zoom.
```
T        = TR · W_s                (throw, lens to screen plane)
x_PJ     = x_scr + T
```
Given the room, the achievable image range is:
```
W_s ∈ [ (x_PJ − x_scr)/TR_max , (x_PJ − x_scr)/TR_min ]
```
with `x_PJ ≤ L − 0.30`. Cross-check against Sets A/C and take the intersection. If the intersection is empty, the projector is wrong for the room — usually too long a throw.

Also verify the lens shift is achievable:
```
z_lens        = H_f − d_mount      d_mount = 0.12 m (recessed) … 0.40 m (pole mount)
z_ctr         = z_bot + H_s/2
shift_required = (z_lens − z_ctr) / H_s × 100 %
```
Compare against the projector's published vertical shift. Typical units offer ±60% to ±96% of image height. **Shift and zoom are not interchangeable** — a projector that cannot shift enough must be lowered on a longer pole, which eats beam clearance (§3.8).

### 3.5 Set E — ceiling height is the binding constraint

Low ceilings, suspended ceilings, basements. Start from height and work outward.
```
H_s   = 1.5 · (H_f − c_lens − h_eye)
W_s   = AR · H_s
D_max = W_s / (2 · tan(θ_min/2))         θ_min = 30°
D_min = W_s / (2 · tan(θ_max/2))         θ_max = 40°
```
Seat anywhere in `[x_scr + D_min, x_scr + D_max]` subject to the §3.1 exclusions.

### 3.6 Speaker coordinates — 5.1 and 7.1

Let `t` = mounting setback from the wall face (0.05 m on-wall, 0.00 m in-wall, 0.30 m for a floorstander pulled out).

**Front L/R** — three competing constraints, take the feasible intersection:
```
y_LR ≥ W_s/2 + 0.15            (outside the image edge)
y_LR  = D · tan(φ)             φ ∈ [22°, 30°]
y_LR ≤ W/2 − 0.60              (side-wall clearance)
x_LR  = x_scr
```
If `D·tan(22°) > W/2 − 0.60`, the room is too narrow for the seating distance. Move the seat forward:
```
D_max,width = (W/2 − 0.60) / tan(22°)
```

**Centre** — `y = 0`, `x = x_scr`. Tilt angle if mounted off-axis:
```
tilt = arctan( (h_eye − z_C) / D )
```

**Side surrounds Ls/Rs** — wall-mounted at `y = ±(W/2 − t)`, angle `α`:
```
x_S = x_MLP − (W/2 − t) / tan(α)

   α = 90°  → x_S = x_MLP                (exactly beside the listener)
   α = 100° → x_S = x_MLP + 0.176·(W/2−t)
   α = 110° → x_S = x_MLP + 0.364·(W/2−t)
```
(`tan α` is negative for α > 90°, which is why the term adds.)

For **5.1**, choose `α ∈ [100°, 110°]`.
For **7.1**, choose `α ∈ [90°, 100°]` — the rears now cover the back, so the sides must stay lateral. Using 110° sides in a 7.1 layout leaves a hole at 120° and crowds the rears.

Constraint: `x_S ≤ L − 0.30`.

**Rear surrounds Lb/Rb (7.1 only)** — on the rear wall at `x = L − t`, angle `β`:
```
Δx  = (L − t) − x_MLP
y_B = ± Δx · tan(180° − β)

   β = 135° → y_B = ± Δx · 1.000
   β = 140° → y_B = ± Δx · 0.839
   β = 150° → y_B = ± Δx · 0.577
```
Constraints:
```
2·|y_B| ≥ 1.00                 (minimum pair separation)
|y_B|   ≤ W/2 − 0.50
Δx      ≥ 1.20
```
If `2·|y_B| < 1.00` at β = 135°, there is not enough depth behind the seat. **Build 5.1.** Two rear speakers 0.6 m apart are worse than none — they image as a single phantom centre-rear and destroy the pan.

Height for both surround pairs:
```
z_S = z_B = min( h_eye + 0.60 , H_f − 0.30 )
```

### 3.7 Converting angles to AVR distance settings

Every speaker's path length differs. The processor needs the true distance, not the plan offset:
```
d_i = √( (x_MLP − x_i)² + (y_MLP − y_i)² + (h_eye − z_i)² )
```
Record all of these on the as-built drawing. They are the single most useful number at commissioning and the first thing lost when the installer changes.

### 3.8 Projector and the beam keep-out corridor

This is the equation that governs everything on the ceiling.

```
T       = x_PJ − x_scr                       (throw)
z_lens  = H_f − d_mount
z_top   = z_bot + H_s
```

**Beam half-width in plan**, at distance `s` measured from the lens toward the screen:
```
w(s) = (W_s / 2) · (s / T)
```
So the plan keep-out is a triangle: apex at the lens `(x_PJ, 0)`, base `W_s` wide at the screen plane. Add a working margin `m = 0.25…0.30 m` all round.

**Beam upper edge height**, same parameter `s`:
```
z_beam(s) = z_lens − (z_lens − z_top) · (s / T)
```

**Clearance below the finished ceiling:**
```
C(s) = H_f − z_beam(s)
```
`C(s)` is **smallest at the lens** (`s = 0`), where `C(0) = d_mount`. That is the governing number.

**Luminaire rule.** A ceiling fixture at plan position `(x, y)` with protrusion depth `p` below the finished ceiling is legal if **either**:
```
|y| > w(T − (x − x_scr)) + m           (laterally outside the corridor)
   OR
p < C(T − (x − x_scr))                 (above the beam at that point)
```
In practice: keep everything out of the corridor laterally, and allow only flush fixtures (`p ≤ 0.06 m`) on the centreline.

**Usable ceiling bands for track lighting.** Taking the conservative (widest) corridor section:
```
y_inner = W_s/2 + m
y_outer = W/2 − 0.60
x_from  = x_scr + 0.40
x_to    = x_PJ − 0.10
```
A band exists only if `y_outer > y_inner`. If not, the room cannot carry track lighting alongside a projector — use cove or wall lighting instead.

### 3.9 Subwoofers and room modes

**Mode frequencies** (rigid-wall approximation, good enough for planning):
```
f(n_x, n_y, n_z) = (c/2) · √( (n_x/L)² + (n_y/W)² + (n_z/H_f)² )
```
First-order axials:
```
f_L = c / (2·L)      f_W = c / (2·W)      f_H = c / (2·H_f)
```
**Square-room warning:** if `L ≈ W`, the length and width modes coincide and every peak doubles. Flag this at survey; it changes the subwoofer count from 1 to 2 minimum, 4 preferred.

**Placement by count:**

| Subs | Position | Effect |
|---|---|---|
| 1 | Front wall at `y = ±W/4`, or a front corner | Maximum output, worst seat-to-seat consistency. Acceptable only for a single seat. |
| 2 | Midpoints of **opposing side walls**, `x = L/2`, `y = ±(W/2 − t)` | Sitting at the length midpoint, they do not excite odd-order length modes; being symmetric, their outputs cancel odd-order width modes. Best 2-sub configuration for a rectangular room. |
| 2 (alt) | Front wall, `y = ±W/4` | Easier pathway, less modal benefit. Use when the side walls are unavailable. |
| 4 | All four wall midpoints | Cancels odd-order modes in both horizontal axes. The correct answer for a square room. |

**Pathway consequence:** subs sit on the floor and need a socket there anyway. Run their LFE and 230 V **in the floor screed or skirting**, not down a finished wall from the ceiling. This is the one endpoint that should leave the ceiling pathway system.

### 3.10 Constraint sweep — run this every time

After any set, check all of these. Each failure has a prescribed remedy.

| # | Check | If it fails |
|---|---|---|
| 1 | `z_bot ≥ 0.60` | Shrink the image or raise the seat |
| 2 | `z_top + c_lens ≤ H_f` | Shrink the image (Set E binds) |
| 3 | `x_MLP ∉ 0.5L ± 0.05L` | Move the seat 0.3 m |
| 4 | `L − x_MLP ≥ 1.20` | Move the seat forward; re-run from Step 2 |
| 5 | `y_LR ≤ W/2 − 0.60` | Reduce `φ` toward 22°, or move the seat forward |
| 6 | `y_LR ≥ W_s/2 + 0.15` | Shrink the image or widen `φ` |
| 7 | 7.1 only: `2·|y_B| ≥ 1.00` | Build 5.1 |
| 8 | `x_S ≤ L − 0.30`, `x_PJ ≤ L − 0.30` | Reduce `α`; shorter-throw projector |
| 9 | Shift required ≤ projector capability | Longer mount pole (costs beam clearance), or different projector |
| 10 | Ceiling band exists (`y_outer > y_inner`) | Cove/wall lighting instead of track |
| 11 | `L ≈ W` | Minimum 2 subs, specify 4 |
| 12 | Every speaker position clear of doors, door **park zones**, windows, radiators | Relocate or change mounting type |

Check 12 catches more real projects than checks 1–11 combined.

---

## 4. Wireway architecture

### 4.1 The governing principle

**Pathway topology and circuit topology are different things.** Every speaker is home-run electrically — no daisy chains, ever. The topology below describes the *physical route the conduit takes*, not how the circuits connect.

### 4.2 Three canonical topologies

| Topology | Shape | Best for | Cable total | Weakness |
|---|---|---|---|---|
| **Star / home-run** | Every endpoint direct to the rack | Small rooms, solid floors, slab ceilings where a transverse pull is cheap | Highest | A blocked route has no alternative; many parallel conduits converge on the rack and congest it |
| **Ring + spur** | Closed perimeter loop, short spur per endpoint | Retrofit, rooms where pulls may need to go either direction | Medium | Shared conduit means one circuit's failure needs a shared pull |
| **Comb (collector + ribs)** | One collector along the panel wall, transverse ribs across the room | Suspended ceilings; the void is the distribution medium | Lowest | Rib spacing must be designed around fixture positions, so late changes are expensive |

**Default recommendation: ring + spur for walls, comb for a suspended ceiling, star for the subwoofers only.** The ring's great advantage is that with a draw box at every corner you can pull from either side; a four-bend pull in one direction is often a two-bend pull the other way.

### 4.3 Where the panel goes — and why it matters

| Panel wall | Effect |
|---|---|
| **Rear wall, on the centreline** | Default best. All mirrored pairs get matched route lengths; the rack sits behind the listener so fan noise and standby LEDs are out of the field of view; a centreline ceiling spine serves the projector and the centre channel in one conduit. Cost: it occupies the rear wall where acoustic treatment wants to be — build it into a cabinet with a fabric or perforated front. |
| **Side wall** | Use when the door is on that wall (the rack should be near the door) or the rear wall must stay free for full-width treatment. Cost: asymmetry — the far-side surround and far-side subwoofer travel most of the perimeter. Matched-length requirement for the two LFE runs then has to be met by deliberately coiling the short one. |
| **Front wall / behind the screen** | Avoid. Puts heat, fans and a service access requirement in the one zone that must stay sealed and acoustically clean. |

### 4.4 Topology matrix — what connects to what

```
                PANEL / RACK
                     │
      ┌──────────────┼──────────────┬─────────────────┐
      │              │              │                 │
  CEILING        FRONT WALL      SIDE WALLS       FLOOR / SCREED
   SPINE          CAVITY          RING             (subs only)
      │              │              │                 │
      ├─ Projector   ├─ L           ├─ Ls             ├─ Sub 1  (LFE + 230 V)
      ├─ Screen      ├─ C           ├─ Rs             └─ Sub 2  (LFE + 230 V)
      │   motor      ├─ R           │
      ├─ Centre ch.  └─ (AT screen  └─ REAR WALL
      │   (if AT)       cavity)         ├─ Lb   (7.1 only)
      └─ Ceiling                        └─ Rb   (7.1 only)
          lighting
```

Rules embedded in that diagram:
- The front-wall cavity (false wall / baffle wall) replaces the front leg of a ceiling ring. Do not run both.
- Subwoofers leave the ceiling system entirely. They terminate at floor level and need a socket there regardless.
- The screen motor shares the ceiling spine with the projector because both are 230 V + low-voltage control, and both terminate within 0.5 m of the ceiling.
- Lighting is a **parallel, physically separated** system sharing the same geometry — see §8.

### 4.5 Access points

The maintainability rule, stated once and applied everywhere:

> **Replacing any single cable must require opening no more than one access point.**

That gives the access schedule directly:
- An access hatch or draw box at **every junction**
- At **every direction change** of a conduit carrying more than one circuit
- At **every pull point** where the accumulated bend exceeds 180°
- Above **every driver, transformer or active device** left in the structure
- At **every point where a conduit enters or leaves the panel**

Hatch sizes: 300 × 300 mm standard, 400 × 400 mm at tees, 500 × 500 mm hinged service door at the projector. Flush push-open plasterboard hatches, painted with the ceiling, are effectively invisible and cost very little.

**Junction boxes are never buried in insulation.** Screw-lid, not clip-lid. Labelled. Directly above a hatch.

---

## 5. Wireway sizing

### 5.1 The connector is the binding dimension, not the cable

The most common and most expensive first-fix error: sizing a conduit for the diameter of an HDMI cable and then discovering the **connector head** will not pass.

| Item | Cable OD | Connector/head envelope |
|---|---|---|
| HDMI (passive or AOC) | 4.2–8.0 mm | **~22 × 12 mm** |
| Terminated CAT6A patch | 7.0–7.8 mm | ~15 × 12 mm (RJ45 + boot) |
| RCA / coax | 6.9 mm | ~12 mm Ø |
| XLR | 6–8 mm | ~20 mm Ø |

**Consequence:** any conduit that must pass a pre-terminated HDMI needs **Ø32 minimum, Ø40 recommended**. If you are pulling a Ø40 anyway, that is the conduit to use for the entire projector spine. Field-terminated cable is a false economy for fibre AOC, which is usually factory-terminated and directional.

### 5.2 Fill calculation

```
A_required = Σ ( π · d_i² / 4 ) / k

k = 0.40   three or more cables           (standard working fill)
k = 0.31   two cables
k = 0.53   one cable
```
`d_i` is the *effective circular* diameter — for a flat figure-8 speaker cable, use the diagonal of its bounding rectangle.

Typical internal diameters (verify against the product datasheet, they vary by manufacturer and by rigid vs corrugated):

| Nominal | Rigid ID (mm) | Corrugated ID (mm) | Usable area at 40% (mm²) |
|---|---|---|---|
| Ø16 | ~12.2 | ~10.7 | 47 / 36 |
| Ø20 | ~15.8 | ~14.1 | 78 / 62 |
| Ø25 | ~20.6 | ~18.3 | 133 / 105 |
| Ø32 | ~26.6 | ~24.3 | 222 / 186 |
| Ø40 | ~34.4 | ~31.2 | 372 / 306 |
| Ø50 | ~43.4 | ~39.6 | 592 / 493 |

### 5.3 Pulling rules

- **Pull string in every conduit, without exception.** Including the ones you think are full.
- Maximum accumulated bend between draw points: **180°** (two 90° bends). Three bends is a hand-over-hand nightmare; four is a re-chase.
- Minimum bend radius: **6 × conduit OD** for the conduit itself; separately check the **cable's** own minimum bend radius — fibre AOC is typically 25–50 mm and does not forgive.
- Pull with the **source end leading** for directional AOC cable. Mark direction on the drum.
- **Spare capacity:** minimum two empty Ø25 along the main spine, one empty Ø20 to each endpoint group. This is the entire reason for building a pathway system rather than chasing cables.

### 5.4 Air-gap channels in an insulated void

Where the ceiling or wall void will be filled with insulation, cables must not sit in it (§0.1). The solution that works and is cheap:

```
Structural slab
  └─ Mineral wool, A1/A2
       └─ Removable wool lid over each channel  ← insulation layer stays continuous in plan,
       └─ CHANNEL: 200 × 80 mm, formed by profile kerbs    it just steps up over the channel
            └─ Perforated cable tray, cables in free air
  └─ CD/UD profile frame, nonius hangers
  └─ Plasterboard 12.5 mm
       └─ Flush service hatch at every junction
```

Channel sizing: 200 × 80 mm carries a 60 mm tray comfortably and accepts a Ø40 alongside. Channel area typically consumes 15–20% of the ceiling plan; the removable wool lid restores thermal continuity so the loss is a thickness step, not a gap.

### 5.5 Segregation between power and signal

Reference: EN 50174-2 for IT cabling, plus general EMC practice.

| Situation | Minimum separation |
|---|---|
| Mains and unscreened signal, parallel run | 300 mm |
| Mains and screened signal, parallel run | 150 mm |
| Mains and signal in the same metallic tray | Divider, or 50 mm with both screened |
| Crossings | 90°, no separation requirement |
| **Dimmed lighting (phase-cut) and analogue audio** | **Never in the same conduit. 300 mm minimum.** |

Phase-cut dimmers are the worst EMI source in a domestic cinema. If the lighting design uses them, that alone justifies two physically separate pathway systems.

---

## 6. Cable schedule

### 6.1 Speaker cable sizing

Size by **damping factor at the speaker**, not by current. The target: loop resistance ≤ 5% of the speaker's minimum impedance.

```
R_loop = 2 · ρ_Cu · l / A

Requirement:   R_loop ≤ 0.05 · Z_min

Therefore:     A ≥ (2 · ρ_Cu · l) / (0.05 · Z_min)
                 = (0.712 · l) / Z_min         [mm², with l in m]
```

| Run length | 8 Ω speaker | 4 Ω speaker |
|---|---|---|
| ≤ 10 m | 1.5 mm² | 2.5 mm² |
| 10–20 m | 2.5 mm² | 4.0 mm² |
| 20–30 m | 4.0 mm² | 6.0 mm² |

Round up, never down, and **use the same cross-section for every channel in the system** regardless of individual run length — mismatched damping factors are audible as a timbre shift between channels on pans.

### 6.2 Full schedule per endpoint

| Endpoint | Cable | Qty | Conduit | Notes |
|---|---|---|---|---|
| L, C, R | Speaker, per §6.1 | 1 each | Ø20 each, or Ø32 shared | Terminate inside the cavity, not on the wall face |
| Ls, Rs | Speaker, per §6.1 | 1 each | Ø20 | |
| Lb, Rb (7.1) | Speaker, per §6.1 | 1 each | Ø20 | Omit in 5.1 — but **pull them anyway**; the cost is trivial and the upgrade later is not |
| Subwoofer ×n | Screened LFE (RG6-type or CAT6A + balun) + 230 V | 1 + 1 | Ø25 signal, separate for mains | Balanced XLR for runs >10 m. **Match the lengths of multiple LFE runs** or compensate in the processor |
| Projector | Fibre HDMI (AOC), CAT6A, 230 V, 1× spare | — | **Ø40** signal, separate mains | Ø40 is set by the HDMI head (§5.1) |
| Screen motor | 230 V + 2×0.75 mm² low-voltage trigger | — | Ø20 | Trigger can be dry contact, 12 V, or RF — pull the pair regardless |
| Rack | Mains per §7, CAT6A ×2, aerial/satellite if used | — | Ø50 or tray | |
| Every endpoint | Pull string | — | — | |

### 6.3 Future-proofing pulls

Pull these even when the current scope does not need them. Each costs minutes at first fix and a day at second:
- The 7.1 rear pair in a 5.1 build
- Four ceiling positions for a future 7.1.4 Atmos upgrade (at `x_MLP ± 0.5·D`, `y = ±0.35·W`, approximately — a spare Ø20 and a blanked box is enough)
- One CAT6A to the screen position (network-controlled screens are now standard)
- One spare Ø25 front-to-rear on the ceiling spine

---

## 7. Power

### 7.1 Load schedule

Use nameplate ratings for compliance, realistic continuous figures for thermal design.

| Equipment | Nameplate / peak | Realistic continuous |
|---|---|---|
| AV receiver or processor | 500–900 W | 150–300 W |
| Multichannel power amp (Class AB) | 1000–1800 W | 200–500 W |
| Multichannel power amp (Class D) | 600–1200 W | 100–250 W |
| Active subwoofer, each | 500–1200 W | 80–200 W |
| Projector — lamp | 280–450 W | 280–450 W |
| Projector — laser | 150–350 W | 150–350 W |
| Motorised screen | 100–200 W | brief, with inrush |
| Rack: sources, network, control | 100–200 W | 100–200 W |

### 7.2 Circuit design

**Minimum (5.1, modest system): two dedicated radials.**
**Recommended (any 7.1 or any system with two subs): three.**

| Circuit | Serves | Rating | Curve | Notes |
|---|---|---|---|---|
| **AV-1** | Rack: processor, sources, network, control | 16 A | B | Clean, low-inrush loads |
| **AV-2** | Power amplifier(s), subwoofers | 16 A | **C** | Toroidal transformers draw 60–100 A for a few milliseconds at switch-on |
| **AV-3** | Projector + screen motor | 16 A | B | Keeps the projector's fan and the screen motor off the audio circuits |
| **LGT-1** | Cinema lighting (all groups) | 10 or 16 A | B | Never shared with AV |

**The single most important rule in this section:**

> **Every AV circuit must originate from the same phase and the same busbar in the distribution board.**

Hum loops in home cinema are overwhelmingly caused by a potential difference between the earth references of interconnected equipment. Feeding the amplifier from L1 and the projector from L2 guarantees it, and no amount of cable quality fixes it afterwards. Record this on the circuit schedule issued to the electrician, because it looks like an arbitrary request otherwise.

### 7.3 Protection and disconnection

**Disconnection time.** `Zs ≤ U₀ · C_min / Ia`, with `C_min = 0.95`, `U₀ = 230 V`:

| Device | `Ia` (0.4 s) | Max `Zs` |
|---|---|---|
| 16 A, B-curve | 80 A | 2.73 Ω |
| 16 A, C-curve | 160 A | **1.37 Ω** |
| 10 A, B-curve | 50 A | 4.37 Ω |

The C-curve halves the permitted loop impedance. On a long radial to a remote room this can bind — verify `Zs` at design stage, not at test stage, or you will be re-pulling in a larger cross-section.

**RCD.** Type A, 30 mA. Give the AV circuits **their own RCD**, not one shared with the rest of the dwelling. Every switched-mode supply contributes standing leakage; a rack with eight SMPS devices plus two Class-D subs can sit at 5–8 mA before anything is playing. The working limit is to keep standing leakage below ~30% of the RCD rating (9 mA on a 30 mA device). Above that, nuisance tripping is a matter of when, not if.

**Voltage drop.** Budget 3% for lighting, 5% for power (MSZ HD 60364-5-52, informative):
```
ΔU = 2 · l · I · ρ_Cu / A        [V, single phase, resistive approximation]
```

**Inrush sequencing.** Two or more large amplifiers on one circuit will trip a B-curve device and may trip a C-curve one. Specify either a soft-start module per amplifier or a **power sequencer** in the rack with 1–2 s staggered outlets. The sequencer also solves the thump-on-power-up problem, so it earns its place twice.

### 7.4 Socket positions

| Location | Provision |
|---|---|
| Rack | 2 × double socket minimum, on AV-1 and AV-2, plus one spare way |
| Each subwoofer position | 1 × single, floor level, on AV-2 |
| Projector | 1 × single at the ceiling mount, on AV-3, in the service hatch |
| Screen pocket | 1 × fused spur at the motor end, on AV-3 |
| Each active/powered speaker position | 1 × single |
| Front wall cavity | 1 × double for future active fronts or an in-cavity amp |

### 7.5 Earthing and bonding

- **One earth. One path.** The AV rack bonds through its circuit protective conductors and nothing else.
- Do **not** install a separate earth electrode for the AV system. A second earth reference is the mechanism that creates the hum loop it is supposed to fix.
- Metallic cable tray in the ceiling: bond at one end only, to the same bar.
- If the installation has an SPD, its effectiveness depends on a short, low-inductance path to the main earthing terminal — a long SPD tail defeats it.

---

## 8. Variant W — ambience and side lighting integrated into the foundation

### 8.1 Why it belongs in Part 1

Retrofitting cinema lighting into a finished room is the most expensive change on this list, because the pathways are the whole job. The fixtures are a decision that can wait; the conduit is not.

### 8.2 Lighting zones

A cinema needs **at least three independently dimmable wall groups**, not one. The reason is functional, not aesthetic: during content you want the group *behind* the seating lit at 3–5% for orientation and eye comfort, with the groups beside and in front of the seating fully off. A single combined wall circuit cannot do this.

| Group | Fixture | Purpose |
|---|---|---|
| **LGT-A** | Front-of-room wall wash (side walls, screen half) | House lights only — always off during content |
| **LGT-B** | Mid-room wall wash | House lights; can run at low level during intermission |
| **LGT-C** | Rear wall wash or rear cove | The one that stays on during content |
| **LGT-D** | Ceiling track, spots/floods | Task and cleaning light; also artwork and step lighting |
| **LGT-E** | Feature fixture (RGB/RGBW centre, cove, star ceiling) | Pre-show and ambience |

### 8.3 Placement rules for lighting

**Wall washers:** mount at `z = H_f − 0.20` aimed up, spaced at `1.0 × (H_f − z_fixture) × 2` to `1.5 ×` that figure — in practice 1.0–1.6 m spacing for a 2.4 m mounting height. Keep them off the screen wall entirely.

**Cove / perimeter:** when a wall has no usable surface (a full-width glazed opening, a door head at ceiling level), a perimeter cove or a dropped ceiling raft with a shadow slot replaces the wall washers completely, and it is usually the better detail anyway. The slot also doubles as a tool-free access route to the perimeter pathway.

**Track:** only within the bands derived in §3.8. Surface track rather than recessed, for three reasons: it does not penetrate the ceiling membrane, it does not sit in insulation (see below), and heads can be repositioned afterwards without touching the building.

**Recessed downlights and insulation.** A recessed fitting buried in mineral wool is a heat trap. Either use fittings explicitly marked for insulation contact, or provide a 100 mm keep-clear fire hood around each. In a cinema ceiling that is already carrying a service channel grid, the hoods become yet another thing to coordinate — which is why surface track usually wins.

**Feature fixture on the centreline.** Subject to the §3.8 luminaire rule. Flush only, `p ≤ 60 mm`. Verify `C(s)` at its exact plan position.

### 8.4 Lighting pathways

A **second, parallel pathway system**, geometrically similar to the AV system but physically separated:

```
AV pathway:        ceiling level, 0.25 m in from the wall
Lighting pathway:  on the wall face at 2.55–2.65 m, or in the void at a different level

Diagonal separation achieved: ~0.45 m — satisfies §5.5 with no coordination effort
Crossings: 90° only
```

Sizing:
- **Ø32** for the ring/collector — it carries all five lighting circuits back to the panel
- **Ø25** for ceiling branches to track feeds and feature fixtures
- **Ø20** for individual fixture drops

### 8.5 Low-voltage LED — the voltage-drop trap

Constant-voltage LED tape at 24 V has a 5% budget of only 1.2 V. Using the §7.3 equation with `ρ_Cu = 0.0178`:

| Run | Current | 1.5 mm² | 2.5 mm² |
|---|---|---|---|
| 5 m | 4 A | 0.47 V ✓ | 0.28 V ✓ |
| 8 m | 4 A | 0.76 V ✓ | 0.46 V ✓ |
| 12 m | 4 A | 1.14 V ✗ marginal | 0.68 V ✓ |
| 12 m | 8 A | 2.28 V ✗ | 1.37 V ✗ |

Remedies, in order of preference: **48 V tape** for runs over 8 m; **inject at both ends** of a cove run; upsize the conductor; move the driver closer. Note that moving the driver closer usually means putting it in the ceiling void, which creates a heat and access problem — see below.

### 8.6 Driver and transformer location

**Drivers never go in the insulation, and never go anywhere without a hatch above them.** Preferred order:

1. In the rack, with the rest of the electronics — best for heat, access and noise, worst for voltage drop
2. In a dedicated ventilated enclosure in the void, directly above a 400 × 400 mm hatch
3. Nowhere else

Drivers are consumables. They fail at a higher rate than anything else in a lighting installation, and the one that fails will be the one you cannot reach.

### 8.7 Lighting control

- **DALI-2 or 0–10 V** for the wall washes and track. Avoid phase-cut dimming entirely in a room containing analogue audio (§5.5).
- Wireless/RF fixtures (the RGB feature light, typically) need a **permanently live** supply — never a switched leg, or the receiver loses pairing at every switch-off.
- One **keypad position** by the door and one at the seating. Pull CAT6A to both regardless of the control protocol chosen; it covers almost every system and costs nothing now.
- The AV processor's **12 V trigger** output should drive the lighting scene change. Pull a 2 × 0.75 mm² from the rack to the lighting control position.

---

## 9. First-fix acceptance gates

Nothing gets boarded until all of these pass. Each has caught a real failure.

| # | Gate | Method |
|---|---|---|
| 1 | **Every conduit is pullable** | Physically pull the string through, end to end, after all bends are formed. A string that binds now is a cable that will not pass later. |
| 2 | **Every speaker cable is continuous and not shorted** | Continuity + insulation resistance test on every run, at the pulled length, before boarding. A screw through a cable is cheap to find today. |
| 3 | **Every cable is labelled at both ends** | Permanent labels, not tape. Scheme: `<zone>-<channel>-<circuit>`, e.g. `CEIL-PJ-AV3`. |
| 4 | **Photographic record** | Photograph every run against a scale reference and a room-referenced datum, before insulation, before boarding. This is the single highest-value 20 minutes on the job. |
| 5 | **As-built coordinates recorded** | Every endpoint's `(x, y, z)` and every `d_i` from §3.7, on the drawing. Not in someone's head. |
| 6 | **Zs verified on every circuit** | Especially the C-curve circuit (§7.3) |
| 7 | **Hatch positions agreed with the decorator** | Before the ceiling is set out, not after |
| 8 | **Beam corridor verified on site** | String line or laser from the lens position to the screen corners, with the ceiling grid in place. Catches coordination errors no drawing does. |
| 9 | **Spare capacity confirmed** | Count the empty conduits against §5.3. If there are none, the pathway system has failed its purpose. |
| 10 | **Assumptions register signed off** | Every soft anchor from §1.2 that was assumed rather than confirmed, listed and initialled by the client |

---

## Appendix A — Quick reference card

```
VIEWING
  W_s = 2 · D · tan(θ/2)                    θ = 30° (SMPTE) … 40° (THX/RP22)
  H_s = W_s / AR
  z_bot = h_eye − H_s/3                     ≥ 0.60 m
  H_s,max = 1.5 · (H_f − c_lens − h_eye)

SEATING
  x_MLP ∈ [0.55L, 0.65L]  or  [0.35L, 0.45L]      exclude 0.5L ± 0.05L
  L − x_MLP ≥ 1.20                                 ≥ 1.50 for 7.1

SPEAKERS
  y_LR = D · tan(φ)                         φ = 22°…30°;  ≤ W/2 − 0.60
  x_S  = x_MLP − (W/2 − t) / tan(α)         α = 100°…110° (5.1), 90°…100° (7.1)
  y_B  = ± (L − t − x_MLP) · tan(180° − β)  β = 135°…150°;  2|y_B| ≥ 1.00
  z_S  = z_B = h_eye + 0.60                 cap at H_f − 0.30
  d_i  = √((x_MLP−x_i)² + (y_MLP−y_i)² + (h_eye−z_i)²)

PROJECTOR
  T = TR · W_s
  w(s) = (W_s/2)(s/T)                       plan beam half-width
  z_beam(s) = z_lens − (z_lens − z_top)(s/T)
  C(s) = H_f − z_beam(s)                    min at the lens = d_mount
  shift% = (z_lens − z_ctr) / H_s × 100

ROOM
  f(nx,ny,nz) = (343/2)·√((nx/L)² + (ny/W)² + (nz/H_f)²)

CABLE
  A ≥ 0.712 · l / Z_min                     [mm²]  speaker, DF ≥ 20
  A_conduit = Σ(π d_i²/4) / 0.40
  ΔU = 2 · l · I · 0.0178 / A
  Zs ≤ 218.5 / Ia                           Ia = 5·In (B), 10·In (C)
```

## Appendix B — References

- CEDIA/CTA-RP22 (2023), *Immersive Audio Design Recommended Practice* — supersedes and expands CTA/CEDIA-CEB22-B
- ITU-R BS.775, *Multichannel stereophonic sound system with and without accompanying picture*
- Dolby home theatre speaker placement guidelines (5.1 / 7.1)
- MSZ HD 60364 series, in particular -5-52 (wiring systems, derating) and -4-41 (protection against electric shock)
- EN 50174-2, *Information technology — Cabling installation — Planning and installation practices inside buildings*
- MSZ EN 61386 series, *Conduit systems for cable management*
- Regulation (EU) 305/2011 (CPR) and the applicable national fire regulation (HU: OTSZ) for cable Euroclass requirements

---

*Part 2 — second fix, termination, mounting hardware, calibration, commissioning and handover — is a separate document.*
