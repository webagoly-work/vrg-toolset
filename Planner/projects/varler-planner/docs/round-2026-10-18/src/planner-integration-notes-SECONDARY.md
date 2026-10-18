# Varler Planner — Integration Notes from the Home Cinema Design Session

> ## ⚠ SECONDARY SOURCE — REVIEW BEFORE USE
>
> **Provenance:** Extracted from a home-cinema design conversation on **2026-10-18**. The Planner-side
> observations in this file were made against the project state described in `STATE.md` as of
> **2026-08-25** (v1.0.0) and `ARCHITECTURE.md` as of **2026-09-07**.
>
> **Why this is secondary:**
> 1. Nothing here was verified against the current `src/` tree. Module line counts, identifier
>    collisions, function names and the action registry contents are all quoted from documentation,
>    not from the code.
> 2. The design guidance it encodes (placement equations, pathway sizing, circuit rules) comes from
>    a *general installation guide* written in the same session. If that guide has since been
>    revised, **the guide is authoritative and this file is not.**
> 3. The feature proposals below were never costed against the queue or the lane system. They are
>    candidates, not committed work.
>
> **Before acting on anything in this file:** re-read `ARCHITECTURE.md`, `STATE.md`,
> `DECISIONS.md` and `invariants-and-learnings.md`, and run a fresh collision check against
> `dist/varler_planner.html`.

---

## 1. Proposed feature: `studio` render mode

### 1.1 Origin

The user responded positively to the visual language used in a set of hand-authored SVG blueprints
during the session and asked for a render mode in the Planner that emulates it. The look is not a
colour scheme — it is four rules applied consistently:

1. **One meaning per hue, never decoration.** Green = permitted area, red = keep-out, teal = route,
   amber = fixture or rail, purple = special/smart. Nothing is coloured because it looked nice.
2. **Three line weights and no more.** 0.5 for context, 1.4–2.0 for the thing being communicated,
   3.0 for the single most important run.
3. **Zone fills always at 12% opacity.** A region reads without competing with what is on top.
4. **One type size, one weight.** 12 px, regular. No bold anywhere. Labels inside their chip or in
   the legend, never floating.

### 1.2 Proposed token table

| Role | Fill | Stroke | Weight |
|---|---|---|---|
| Structure (wall, slab, room) | `#9A9A93` @ 0.10 | `#6B6B64` | 0.5 |
| Permitted zone | `#639922` @ 0.12 | `#3B6D11` | 0.8, dash 5 4 |
| Keep-out zone | `#E24B4A` @ 0.12 | `#A32D2D` | 0.8, dash 5 4 |
| Route / conduit trunk | — | `#1D9E75` | 2.0 |
| Route / branch | — | `#1D9E75` | 1.4 |
| Rail / primary run | — | `#BA7517` | 3.0, round cap |
| Device chip | `#EF9F27` | `#854F0B` | 0.5, rx 4 |
| Smart / addressable | `#7F77DD` | `#3C3489` | 1.0 |

Corner radius: 4 on chips, 2 on bands, 6 on closed loops. Legend stacks bottom-left at 18 px line
pitch, one line per semantic class **actually present in the drawing** (generated, not hand-written).

### 1.3 Proposed implementation

New module `src/04b-studio.js`. Rationale for a new module rather than extending `04-render.js`:
the existing render module was quoted at ~772 lines and already holds four render paths; a fifth
belongs beside it, not inside it.

**Identifier prefix: `stu` / `STU`.** Proposed new top-level names — `stuDraw`, `stuDevice`,
`stuPath`, `stuLegend`, `stuZone`, `STUPAL`, `STUW`. **Every one of these must be grepped against
the compiled `dist/varler_planner.html` before introduction** — this is a hard invariant
(single global scope; the `SC` collision precedent).

Build-system note: `build.js` must match `04b-`. Per `invariants-and-learnings.md` the pattern was
corrected to `/^\d\d[a-z]?-.*\.js$/`, so this should already be covered — **verify, don't assume.**

### 1.4 Proposed phasing

| Phase | Content | Risk |
|---|---|---|
| **A** | `04b-studio.js`, read-only over the existing model. Hairline structure, paths coloured by circuit through the semantic ramp, devices as chips with their `DEVKIND` code centred, generated legend. Forces `pitch = 90` on entry (as blueprint mode does) — the look depends on true orthographic top-down. ~350 lines. | Low — additive |
| **B** | Wiring: fourth option in the style select (`shell.html`), `view.style.studio` in the action registry, i18n strings, a studio options row mirroring `#bpOpts` (legend on/off, zone fills on/off, mono-for-print toggle). | Low |
| **C** | `data.zones` — see §2. Schema bump, migration, new `validate()` rule. | Medium — schema change |

**Golden render expectation:** adding a fourth style should leave all 70 existing goldens
byte-identical, because no other branch changes. **If any golden moves, the dispatch edit in
`04-render.js` is wrong** — stop and diff before proceeding. Note the `core.autocrlf=false` H1
guard still applies.

### 1.5 Files that would need to be opened

| File | Role |
|---|---|
| `src/04-render.js` | edit — style dispatch in `draw()`; source of `p2b`, `bpSeg`, `bpRect`, `bpWallSpans`, `bgCol`, `R` |
| `src/02-state.js` | edit — `state.style` allowed values, layer/circuit colour source |
| `src/shell.html` | edit — `<option value="studio">`, studio options row |
| `src/05c-actions.js` | edit — `view.style.studio`, matching the three existing `view.style.*` entries |
| `src/11-controls.js` | edit — style select wiring, `bpUI()`-equivalent toggle |
| `src/00b-i18n.js` | edit — HU/EN labels |
| `src/03-geometry.js` | read-only — polygon/projection helpers |
| `src/00-core.js` | read-only — `DEVKIND`, `LH`/`ORD`, `SC` |
| `build.js` | read-only — confirm the `NNx` pattern |
| `tests/run.js` + one `spec-NN-*.js` | read-only — spec header convention for a new golden |
| `dist/varler_planner.html` | **collision-check scope** |

---

## 2. Proposed schema addition: `data.zones`

### 2.1 What it is

A *derived region* collection. The motivating case: in a projector room, the beam sweeps a wedge
across the ceiling that no fixture may occupy, and the usable track-lighting bands are what remains
after subtracting that wedge plus wall margins. The Planner can express neither today.

The wedge is computed, not drawn:

```
T    = x_PJ − x_scr                        throw
w(s) = (W_s / 2) · (s / T)                 plan half-width at distance s from the lens
```

giving a triangle with its apex at the lens and a base of `W_s` at the screen plane, plus a
working margin of 0.25–0.30 m.

### 2.2 Why it is worth the schema bump

Rendering it is cosmetic. **Validating against it is not.** A `validate()` rule of the form
*"fixture placed inside a keep-out zone"* turns the studio render mode from a skin into a design
check — which is the stated purpose of the whole tool.

Second and third applications beyond cinema rooms, both squarely in the Varler Group domain:
- Required clear working space in front of a distribution board
- Safety zones around a gas line or a buried service

### 2.3 Rough shape (not a specification)

```js
zones: [{
  id:    'Z3',                 // from data.seq, as every other record
  level: 'FS',
  kind:  'keepout' | 'permitted',
  src:   'derived' | 'manual',
  from:  { device: 'D12' },    // id reference for derived zones — the projector
  poly:  [[x,y], ...],         // cached result; recomputed on change
  margin: 300                  // mm
}]
```

Follows existing conventions: ids from `data.seq`, cross-references by id not index,
`linkTarget()`-style resolution so a deleted projector leaves a dangling reference that
`pruneLinks()` tidies rather than a corrupted polygon.

**Open question not resolved in session:** whether `poly` should be cached at all, or recomputed on
every draw. Caching means a migration path when the derivation formula changes; recomputing means
a cost on every render. Given the render-scheduler work already shipped (scene/overlay split), the
recompute cost is probably acceptable — **needs measurement, not assumption.**

---

## 3. Suspended-ceiling plenum as a plane-editor artefact

### 3.1 The observation

`07-plane-editor.js` already handles the álmennyezet plane as one of its projections. The
service-channel layout designed in this session is exactly the drawing that editor should produce:

- The plenum is divided into cells that are either **insulation** or **service**
- Service cells carry a 200 × 80 mm channel with tray, formed by profile kerbs
- Insulation is continuous in plan; it steps up over each channel as a removable lid
- A flush service hatch sits below every junction and every direction change

### 3.2 Why it maps cleanly

The plane editor's existing descriptor already supplies `local(ev)`, `clamp`, `nodeUV`, `addNode`
and a per-surface renderer. A plenum map needs:
- a cell grid (new, but the plane editor already has a top view and `badge:false`)
- channel polylines (these are *paths* — the existing collection)
- hatch markers (these are *devices* with a new `DEVKIND`)

So the model may already support most of it. **Verify against the current `07-plane-editor.js`
before scoping.**

### 3.3 Candidate `validate()` rules this would enable

| Rule | Severity |
|---|---|
| Path segment crosses an insulation cell without a channel | error |
| Junction node with no hatch device within *n* mm | error |
| Conduit run with >180° accumulated bend between hatches | warn |
| Fixture inside a derived keep-out zone | error |
| Conduit fill above 40% | warn |

---

## 4. Domain constants that could feed `00-core.js` / the standards panel

`05e-settings.js` already collects every domain number in one dialog. These are candidates to join
them. **All values below are from the general installation guide produced in the same session —
check that document, which is the authority, before hard-coding anything.**

### 4.1 Placement

```
θ_view            30° (SMPTE) … 40° (THX / CEDIA-CTA-RP22)
φ_front           22° … 30°
α_side_5.1        100° … 110°
α_side_7.1        90° … 100°
β_rear_7.1        135° … 150°
surround_height   h_eye + 0.60 m, capped at H_f − 0.30
min_rear_sep      1.00 m
min_wall_clear    0.60 m
min_rear_clear    1.20 m  (1.50 m for 7.1 viability)
MLP_exclusion     0.5·L ± 0.05·L
```

### 4.2 Pathway

```
conduit_fill      0.40 (3+ cables), 0.31 (2), 0.53 (1)
max_bend          180° accumulated between draw points
min_bend_radius   6 × conduit OD
HDMI_head         ~22 × 12 mm  → Ø32 minimum, Ø40 recommended
channel           200 × 80 mm
separation        300 mm mains↔unscreened, 150 mm mains↔screened, 90° crossings
```

Conduit internal diameters (rigid / corrugated, mm) — **product-dependent, treat as defaults:**
Ø16 12.2/10.7 · Ø20 15.8/14.1 · Ø25 20.6/18.3 · Ø32 26.6/24.3 · Ø40 34.4/31.2 · Ø50 43.4/39.6

### 4.3 Electrical

```
Zs_max            218.5 / Ia      [Ia = 5·In for B-curve, 10·In for C-curve]
                                  16 A B → 2.73 Ω ; 16 A C → 1.37 Ω
ΔU_budget         3% lighting, 5% power
RCD               Type A 30 mA, standing leakage < 9 mA
Ci_insulation     0.50 for >0.5 m totally surrounded (MSZ HD 60364-5-52 / BS 7671 Table 52.2)
ρ_Cu              0.0178 Ω·mm²/m
speaker_cable     A ≥ 0.712 · l / Z_min   [mm², DF ≥ 20]
```

---

## 5. Already captured in `invariants-and-learnings.md`

For cross-reference — these two were filed during the session and should not be duplicated:

- Home cinema cable routing invariant (MSZ HD 60364-5-52): all cables run in air-gap service
  channels (200 × 80 mm perforated tray) separated from mineral wool by a removable lid — never
  embedded in insulation
- Service hatches required above every junction and direction change

---

## 6. Review checklist before any of this enters the queue

- [ ] Re-read current `ARCHITECTURE.md`, `STATE.md`, `DECISIONS.md`
- [ ] Confirm the open items in `STATE.md` (gyro camera adapter, localStorage rescue,
      `spec-20-backup.js`, PortableGit) are resolved or explicitly parked — this work should not
      jump the trunk
- [ ] Collision-check every proposed identifier against `dist/varler_planner.html`
- [ ] Confirm `build.js` accepts `04b-`
- [ ] Confirm the 70 golden renders are green on the current build *before* starting
- [ ] Decide lane assignment (T / B) for Phase A, B and C separately — C is a schema change and
      probably belongs on the trunk, A and B are parallel-safe
- [ ] Re-derive §4 constants from the current version of the installation guide, not from this file
- [ ] Confirm the `07-plane-editor.js` descriptor actually supports §3.2 before scoping the plenum map

---

*This file is a handoff artefact. It is not a specification and it has not been reviewed against
code. Treat every claim in it as a lead to verify, not a fact to build on.*
