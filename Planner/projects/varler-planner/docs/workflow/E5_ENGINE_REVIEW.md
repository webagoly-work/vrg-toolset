# E5 pre-review — the runs and wiring engine (tools/baseline)

*2026-10-15, before E5 brings the engine into the Planner. The user's goal: "review the runs and the wirings' internal
logic, to make sure it will scale well and the rules are applied correctly."*

**What I did:**
- read geom.js, network.js, prep.js, plan.js and rules.js in full (about 950 lines);
- measured the engine on the CLA ground floor;
- measured it on 2×, 4×, 8× and 16× tiled copies of that plan;
- benchmarked one shortest-path search on connected graphs of 128–4 000 nodes.

Nothing was changed.

## 1. How it works — the pipeline

| # | Stage | Code | What it decides | Rules applied (source) |
|---|---|---|---|---|
| 1 | **Geometry** | geom.load | Walls as axis-aligned boxes; each room outline split into **faces**, one per wall it lies on; the arc length round the room (`s`) | A face belongs to a wall whose long side is within 25 mm of the room edge |
| 2 | **Routable walls** | geom.allowedFromSketch | Per wall, the intervals a horizontal pipe may use | User 2026-10-12: only marked walls. Marked = under a sketch line (±150 mm), or a **plus** mark of kind wall / side |
| 3 | **Endpoints** | prep.endpoints, applyHeights | Room, face, context (bed, worktop, island, wet), height | rules.stdHeight: switch 1100, socket 300, worktop 1100, wet 1100, bed 750, DED by appliance … |
| 4 | **Portals** | prep.portals, portalMembers, placeInPortals | Latch side; which switches / sockets belong to a door; moved onto the slot (L1 1100, L3 300, L4 2450 …) | IDEA-003 slots (= the Planner's PT_SLOTS, spec-86); a switch within 800 mm of the opening, a socket within 400 mm; the wet-room switch goes on the dry face |
| 5 | **Network** | network.build | A graph along every room face: nodes at corners, interval limits and anchors | Allowed face = cost 1×. Unmarked face = cost **4×** (soft, used only if nothing else reaches, with a warning). Open boundary (no wall) = 0. **No edge through a wall** except at a service point |
| 6 | **Drops** | plan §1 | Wall endpoints within 250 mm on one face share **one 2-gang leállás box** at 2450 | MERGE 250 |
| 7 | **Service points** | plan §2–3 | Portals (latch face), RBX, BASE. Each drop is assigned to the nearest service point in its zone, by path length | Wall crossing only at a service point (user rule) |
| 8 | **Lamp → switch** | inferLamps | Explicit groups, then `ctl`, then two-way pairs (kind 106), wet rooms from the dry face, then the nearest switch | Heuristics (see F14) |
| 9 | **Circuits** | circuits | The sketch circuits + cfg.socketPlan + cfg.lighting zones; a lamp joins its switch's circuit | Q-E04 V1 / V2 |
| 10 | **Trunk** | plan §6 | **One shortest-path tree from the Elosztó** at 2600. Passing another service point costs +3 m. Unmarked walls only if a point is otherwise unreachable | User: trunk 2600, one tree, avoid service points |
| 11 | **Distribution** | plan §7 | Per circuit: service-point face → each fed drop at 2450 (the union of shortest paths = a tree per circuit) | The leállás box is the meeting point of lamp and switch |
| 12 | **Boxes** | plan §8 | Service-point boxes (L4 at 2450, the RBX), leállás boxes, **a box at every corner passed**, an end box 180 mm past the last box | User rules (README) |
| 13 | **Legs + pipes** | plan §9, rules.sizeConduit | A pipe runs from event to event (feed start, a box serving the circuit, a branch, the end, a change in the cable set, more than 3 bends). Dist: **one pipe per circuit**. Trunk: up to `maxCablesPerPipe` per pipe | Fill: 1 cable → ID ≥ 1,4 × OD; more → ≤ 40 %, ≤ 33 % above 10 m (05w-fill) |
| 14 | **Drops / ceiling** | plan §9 | Vertical chains box → devices, cables shrinking as devices are passed; ceiling lamps chained nearest-first from the riser | — |
| 15 | **Switch plates** | plan §7 | Cores per box: L + PE + 1 per simple switch, 2 two-way, 4 intermediate; ≤ 5 cores → one cable, else one per switch | SWITCH_LEG |

**What is solid:**
- **Wall crossing only at service points** is enforced structurally: the graph simply has no edge through a wall anywhere
  else.
- **"Marked walls only" is a cost rule**, not a ban (×4), and it always warns. That is the right shape: never stuck, never
  silent.
- **The trunk channels come from one shortest-path tree**, so they never contradict each other.
- **Pipes break exactly at the README's events**, and conduit fill follows the 05w-fill rule.
- **Determinism:** ties break by node order, so the same plan gives the same result.

## 2. Speed (measured)

| Plan | Rooms | Endpoints | Graph nodes | Searches | Total |
|---|---|---|---|---|---|
| CLA ground floor | 8 | 152 | 128 | 226 | **62 ms** |
| 4 × CLA | 32 | 596 | 509 | 826 | 134 ms |
| 16 × CLA (copies not connected) | 128 | 2 372 | 2 033 | 3 274 | 0.85 s |

The tiled copies flatter the engine: each search explores only its own copy.

The shortest-path search scans every node at each step, so it is **O(V²)** on a connected graph. Measured per search:

| Nodes | Per search |
|---|---|
| 128 | 0.28 ms |
| 1 000 | 1.95 ms |
| 2 000 | 5.7 ms |
| 4 000 | 22.8 ms |

And the number of searches grows with drops × service-point faces (step 7 searches from every service-point face, once
for every drop). So:
- a **connected** 2 000-node plan (a large villa, or two floors joined) takes about 3 300 × 5.7 ms ≈ **19 s**;
- 4 000 nodes (a small block of flats) takes **about 2–3 minutes**.

**Verdict:**
- **Fine** for one flat or house as a button ("Pályák és vezetékek") at ≤ 1 000 nodes.
- **Not fine** for live recalculation or multi-unit buildings.

The fix is small and changes no result:
- a binary-heap search, O(E log V);
- **one** search per service-point face, reused for every drop, instead of one per drop × face.

Together those take the 16× case from about 3 300 searches to about 180, each about 50× cheaper. They can be checked
for byte-identical output on CLA (E5-Q6 below).

## 3. Findings, most serious first

| # | Sev | Finding | Why it matters | Fix in E5 |
|---|---|---|---|---|
| F1 | **High** | **The routable-wall rule reads the wrong marks.** geom.js:48 makes the WHOLE wall routable for **any plus-polarity mark** of kind wall / side: L-forma, Médiafal, Fejvég, Íróasztal… It ignores the pen's spans (wspan / vstrip, R5) and the Vezethető fal spans (R2). With the Planner's new marks, an L-forma corner would open a whole wall to horizontal runs | Rules applied incorrectly as soon as the Planner feeds it | Read `rwlAllowed(level)` (Vezethető fal only, exact spans). PAD → 0 for pen-drawn spans (the 500 mm PAD was for loose sketch lines) |
| F2 | **High** | **No current-capacity / grouping check.** Pipes are sized by fill only. Up to 3 circuits share a pipe, and a trunk chase carries many pipes side by side. Under MSZ HD 60364-5-52 (B.52.17), 3 grouped circuits take × 0,70: 1,5 mm² (method B2 ≈ 16,5 A) → ≈ 11,6 A, **below a 13 A breaker**; 2,5 mm² (≈ 22–23 A) → ≈ 15,4–16,1 A against a 16 A breaker ⚑ (figures to confirm against the MSZ table) | Ib ≤ In ≤ Iz is the core cable rule; the bigger the house, the more grouping | Per pipe and per chase: count the loaded circuits, apply the grouping factor, check In ≤ Iz·k. Warn, and suggest the next cross-section or fewer circuits per pipe (E5-Q1) |
| F3 | **High** | **No voltage-drop check.** Leg lengths are known per circuit but never summed into ΔU. Example: 1,5 mm², 13 A, 30 m one way → 2·30·13·0,0178 / 1,5 ≈ 9,3 V ≈ **4,0 %**. Limits per MSZ HD 60364-5-52 G ⚑: 3 % lighting / 5 % other, from a public LV supply | Large houses fail silently | ΔU per circuit along its longest branch; warn over the limit (E5-Q2) |
| F4 | Med | **Fixed heights 2600 / 2450 whatever the ceiling.** A 2 500 basement or a drop ceiling puts the trunk above the ceiling | Wrong drawing and quantities on real projects | From the room ceiling (E5-Q3) |
| F5 | Med | **Cable chosen from the breaker TEXT:** `/13A/` → 1,5 mm², else 2,5 mm²; DED by variant | Fragile. A 10 A lighting-socket mix or an edited preset gives the wrong cable | Take mm² / cable from the circuit's M2 preset (`c.preset` → CPR row `mm2`, `cab`) |
| F6 | Med | **Trunk-only corners get their box at 2450** (dist height; plan.js corner boxes take `W.dist`) | The box sits 150 mm below the pipe it serves | The box height = the height of the runs through that corner |
| F7 | Med | **CLA hard-codes:** `ctx.room === 'R05'` (kamra 1100) in rules.stdHeight; `'R03' / 'R03L'` same-zone in inferLamps | Wrong on every other project | Room kinds (R1) and network zones (they already exist: `NW.zones`) |
| F8 | Med | **A non-orthogonal room edge throws** (geom.js: "non-orthogonal edge"). F02 = A allows 45° room outlines | One diagonal room → the whole run crashes | Skip 45° faces as non-routable (a warning), keep the room |
| F9 | Med | **One level, one Elosztó.** `cfg.level` only; no sub-board (alelosztó); upper floors only as empty riser conduits | Two-storey houses get no runs upstairs | Per level, with risers as the trunk's vertical links; sub-board = a service point fed by a DED (E5-Q8) |
| F10 | Low | **The end provision box** goes 180 mm past the last box, with no check that the spot is a routable wall | Can land in a doorway or a corner | Clamp to the routable interval |
| F11 | Low | **Wet rooms: only the height rule** (1100); no 0–2 zone geometry | R3's Vizes marks exist now | Warn on a socket or switch inside a Vizes zone / face |
| F12 | Low | **Ceiling lamps:** straight lines, nearest-first chain from the riser; the user's Mennyezeti út / Padló út lines (E2) are not used | The routes the user drew are ignored | Follow the cline marks when present, else the current chain |
| F13 | Low | **maxCablesPerPipe:** the code default is 2; CLA config and README say 3 | Two sources of one number | One Standard (R4 table / settings) |
| F14 | Info | **Lamp → switch inference heuristics:** `busy`, a 900 mm "mates" penalty, kind-106 pairing | In the Planner, E1's explicit links (`sw.ctl`, `grp`) are the source | E5 reads the links only; the inference stays E1's suggestion table, never silent |

## 4. What the Planner already has that replaces the CLA config

| cla.config.js | Planner source (this round) |
|---|---|
| allowed (sketch lines + plus marks) | **rwlAllowed** (R2 / R5 Vezethető fal) — F1 |
| wetRooms | room kinds furdo / wc (R1) |
| worktop intervals | Munkalap face marks (`pult`, R3) |
| island object | Sziget zone marks (R3) |
| bedZoneMark `agy` | Ágy zóna marks (R3) — same tag |
| lighting zones, socketPlan, sketch circuits | data.circuits (E4, M2 presets) |
| switchGroups, ctl | sw.ctl, lamp `grp` (E1) |
| floorGroups | Padló út lines (E2) |
| ceilLinks | Mennyezeti út lines (E2) — **decision: E5-Q9** |
| latch side (inferred from switches) | the door's own variant (O1): hinge / opening side are explicit now |
| PORTAL_SLOTS | 08g PT_SLOTS (spec-86 keeps them equal) |
| service points: portal, RBX, BASE | + the **szobadoboz** (E3, "does wall crossing") — **decision: E5-Q5** |
| heights (rules.stdHeight) | the Standards table (R4, `stdH`): one source — **decision: E5-Q3** |
| fixFace, adoptSwitches, edits, spBoxSize, risers, prepared | sketch repairs for CLA — not carried over (risers → F9) |

## 5. Decisions before E5

1. **E5-Q1, current capacity:**
   - A) check In ≤ Iz·k per pipe and per chase, warn and propose the fix **★**;
   - B) warn only;
   - C) skip.
2. **E5-Q2, voltage drop:**
   - A) 3 % lighting / 5 % other ⚑ **★**;
   - B) 4 % flat;
   - C) skip.
3. **E5-Q3, run heights:**
   - A) from the room ceiling: trunk = ceiling − 250, dist = trunk − 150, with the R4 table as the override **★**;
   - B) fixed 2600 / 2450, with an error below a 2 750 ceiling.
4. **E5-Q4, corner boxes:**
   - A) keep a box at every corner (the CLA rule; CLA had 107 boxes for 152 endpoints) **★**;
   - B) only where a pull box is needed (more than 3 bends) or the run branches.
5. **E5-Q5, the szobadoboz:**
   - A) is a service point — walls may be crossed there **★**;
   - B) not a crossing point.
6. **E5-Q6, the speed fix** (heap + one search per source):
   - A) do it in E5 and prove byte-identical CLA output **★**;
   - B) later.
7. **E5-Q7, routable walls:**
   - A) rwlAllowed only; unmarked walls stay a ×4 fallback with a warning **★**;
   - B) also the plus marks (as now).
8. **E5-Q8, more than one level or board:**
   - A) its own work package after E5 (E6) **★**;
   - B) inside E5.
9. **E5-Q9, ceiling crossings:**
   - A) a Mennyezeti út line drawn between two wall points is a trunk ceiling crossing **★**;
   - B) a separate mark.

**The CLA parity check:** E5 must reproduce the v1 legs / boxes / circuits of `Calculator/CLA-baseline/v1_2026-10-12`
(local only — client data). Differences are allowed only where a decision above changes a rule, and each one is listed.

## 6. Answers (user, 2026-10-15)

| Q | Answer | What it means for E5 |
|---|---|---|
| E5-Q1 | **A** | Current capacity: per pipe and per chase, In ≤ Iz · k(grouping). Warn and propose the fix (the next cross-section, or fewer circuits in the chase). Iz / k tables ⚑ (IEC 60364-5-52 values, to confirm against MSZ) |
| E5-Q2 | **B** | Voltage drop: one limit, **4 %**, per circuit along its longest branch |
| E5-Q3 | **A** | Run heights from the ceiling: trunk = ceiling − 250, distribution = trunk − 150. The R4 Standards can override. CLA (2850) keeps 2600 / 2450 |
| E5-Q4 | **B by default, A as an option** | Default: no box at a plain corner; a pull box only where a run has more than 3 bends, plus branch / end boxes. The CLA rule (a box at every corner) becomes an option for the **BRIDGE layers** (`cornerBoxes:'all'`) |
| E5-Q5 | **A** | The szobadoboz (E3, `jb:'szoba'`) is a service point: walls may be crossed there |
| E5-Q6 | **B** | The speed fix comes later (the engine stays O(V²) for now; fine at house size) |
| E5-Q7 | **A** | Routable = Vezethető fal only (rwlAllowed: whole wall / spans). L-forma and other plus marks no longer open a wall. Unmarked walls stay a ×4 fallback with a warning |
| E5-Q8 | **own answer** | **Every further level gets its own sub-board, the Alosztó** (or a DIN-rail RBX variant), so each floor has its own RCD protection. The main Elosztó feeds the Alosztó with a dedicated feeder; each level's runs start from its own Alosztó. Planned as **WP-E6** after E5 |
| E5-Q9 | **A** | A Mennyezeti út line drawn between two wall points is a trunk ceiling crossing |

## 7. Stage 1 built — the engine fixes (2026-10-15), measured on CLA

Changed in `tools/baseline`:
- **geom:** F1 / Q7 routable walls, exact mark spans, F8 45° steps, room kinds;
- **network:** no PAD on exact spans;
- **rules:** Q3 `runHeights`, Q1 `IZ` / `groupK`, Q2 `vdropPct`, F7;
- **prep:** kinds, wet rooms by kind;
- **plan:** Q3 heights, F7 zones, F8 warning, Q4 `cornerBoxes`, F6, F10, F13 (default 3), Q5 szobadoboz, the Q1 / Q2
  `cableChecks`.
- **cla.config:** `roomKinds {R05: kamra}` and `cornerBoxes: 'all'`, so CLA stays reproducible.

**Parity with the delivered v1** (`Calculator/CLA-baseline/v1_2026-10-12/kimenet`):
- Same 16 circuits, same 185 legs, the same takeoff.
- **5 trunk legs are 150 mm shorter.** One trunk-only corner box (X76) now sits at the trunk height, 2600, not 2450 (F6).
- No route changed. CLA's sketch lines already cover the walls the L-forma marks used to open.

**Q4 default (pull boxes only) on CLA:** 107 → **81 boxes**. The 23 plain-corner boxes go; no distribution run passes
3 bends, so no new pull box is added. Routes and cable metres are unchanged.

**Q1 / Q2 on CLA — needs the user's ruling (E5-Q10, E5-Q11):**

| Circuit | In / mm² | Circuits in its pipe | Circuits in its chase | Iz · k, per pipe | Iz · k, per chase | Longest branch | ΔU |
|---|---|---|---|---|---|---|---|
| A2, A3, A6, A9–A13, A15 | 16 A / 2,5 | 3 | 16 | 16,1 ok | 9,4 ✗ | 11–19 m | 1,4–2,4 % |
| A4, A5, A14 | 13 A / 1,5 | 3 | 16 | **11,5 ✗** | 6,8 ✗ | 12–18 m | 2,0–3,1 % |
| A7 | 13 A / 1,5 | 2 | 16 | 13,2 ok | 6,8 ✗ | 7 m | 1,2 % |
| A8 (hob, 2L+2N, 5 × 2,5) | 16 A | 3 | 16 | **14,0 ✗** (3 loaded cores) | 8,2 ✗ | 19 m | 2,4 % |
| V1 / V2 lighting | 10 A / 1,5 | 3 | 16 | 11,5 ok | 6,8 ✗ | 38 / 22 m | **4,96 % ✗** / 2,9 % |

- **Counted per chase** (every circuit side by side in the 2600 horony leaving the Elosztó), **every circuit fails**:
  16 grouped circuits give k = 0,41.
- **Counted per pipe**, the only failures are:
  - the 1,5 mm² / 13 A circuits that share a pipe with 2 others (k 0,70 → 11,5 A);
  - the 2L+2N hob.
- **The voltage drop** fails only V1 (38 m at the full 10 A breaker current). With the real lighting load (a few A) it
  is about 1–2 %.

**Answered 2026-10-15:** E5-Q10 = **A**, E5-Q11 = **A** (below).

| Q | Answer | Built |
|---|---|---|
| E5-Q10 | **A** — grouping per pipe | `cableChecks` counts per pipe (`cfg.groupBy:'chase'` kept for comparison). Trunk pipes are packed by capacity: a pipe takes only as many circuits as its weakest cable still carries its breaker at (In ≤ Iz·k(n)), and a 1,5 mm² cable shares its pipe with at most one other circuit (`cfg.maxCirc15`, 2). The strongest cables are packed first. |
| E5-Q11 | **A** — lighting drop from the real load | `cfg.loadW` (LMP 60 W a point, SHU 150 W a motor); `cfg.lightCurrent:'mcb'` gives the strict reading. The capacity check still uses the breaker. |

**CLA after Q10 / Q11:** every capacity check passes (A4 / A5 / A14 / A7 at 2 circuits per pipe → 13,2 A; the A8 hob at 2 →
16,0 A). Pipes: M20 120 → 128, M25 58 → 55, M32 22 → 38, M40 25 → 13. Circuits, boxes, legs, lengths and cable metres
are unchanged. One warning is left: **V1, 4,14 %** (38 m, 8,3 A estimated load, 1,5 mm²), with the suggested fix
"2,5 mm² or split the circuit".

## 8. Stage 2 built — the engine in the Planner (2026-10-15)

- **Bundle** (`build.js`): `tools/baseline/{rules,geom,network,prep,plan}.js` are wrapped in a require shim. They replace
  the `/*__BASELINE__*/` marker in `src/08ob-wf-engine.js` as `BL`, so the CLI and the page run one engine.
  - `applyEdits` moved from `run.js` to `prep.js`, so the bundle carries it too.
  - The shell substitution became a function, so a `$&` in a source is never read as a pattern.
- **Adapter** `blInput(level)`, working on a copy of `sessionObj()`:
  - **Removed from the input:** the engine's own gen:'bl' output.
  - **Layers:** MAINS endpoints are mapped to one engine `sys:MAINS` layer; devices with no code count as hardware.
  - **Redőny (SHU):** left out, with a note.
  - **Heights:** as placed (`hFix`). R4 owns heights, and devices are never moved (no `placeInPortals`).
  - **Circuits:** lighting is recognised by its preset, ref or members; the breaker is converted to text (`mcbText`).
  - **Run heights:** from the ceiling (`LH[level]`), unless the Standards table has a project PATH row.
  - **Padló út:** each line becomes a floor group; its leg follows the drawn line.
  - **Mennyezeti út:**
    - a line to a lamp becomes the drawn ceiling leg;
    - a line from one Vezethető fal to another becomes a ceiling crossing (Q9). The 〰 tool now finishes on a second
      routable wall.
- **Button 1, ⚙ Pályák kiszámítása** (phase 5 Pályák):
  - opens a summary and the checks table, with the corner-box option (Q4);
  - writes one path per pipe: the trunk to the stack's Csatorna layer as `route:'channel'`, everything else to the ARM
    layer;
  - writes one junction per box, on the Dugaljak layer;
  - tags all of these gen:'bl'. A re-run replaces only gen:'bl' items, in one undo step.
- **Button 2, 🧵 Vezetékek** (scope Eszköz | Helyiség | Ház):
  - writes the cable text and circuits into the sections and totals the metres per cable type;
  - refuses to run when the plan has changed since the Pályák run (input hash).
- **spec-98**: 28 checks. On the CLA v1 sketch (when present), the bundled engine and the CLI give the same plan
  exactly. Full suite: 92 suites, 3 211 checks, golden 70 / 70.

**⏸ CLA acceptance — the v1 sketch alone is not enough.** I loaded the v1 sketch into the Planner and turned its
sketch lines into Vezethető fal spans. The engine then runs, but it gives:
- 11 circuits instead of 16 (no V1 / V2);
- 82 endpoints instead of 111;
- 69 warnings.

The missing pieces are the answers that live only in `cla.config.js`: the lighting zones, the socket plan, the added
and moved points, the switch groups, the floor groups and the stair crossing. The comparison needs those answers as
Planner data first. See decision E5-Q12.

**Open (found in the browser):** the Planner's "N készülék nincs pályához kötve" check does not see the gen:'bl' paths.
The engine's paths end at boxes, not at device links.

## 9. CLA acceptance, step A: the converter (E5-Q12 = C, 2026-10-15)

`tools/baseline/to-planner.js` writes `cla.config.js`'s answers as ordinary Planner data:

| CLA answer | Becomes, in the Planner |
|---|---|
| edits, heights, portal placement | the devices themselves |
| socket plan + lighting zones | `data.circuits` (lighting: preset `vil`) |
| switch groups + inferred switching | `sw.ctl`, lamp legs (`grp`), `swType` 101 / 105 / 106 / 107, `swHead` |
| `rbxSwitched` | `lamp.rbxSw` (also a lamp menu item now) |
| wet rooms, room kinds | room kinds |
| sketch lines + `allowExtra` | Vezethető fal spans; the sketch is kept on a hidden layer |
| floor groups | Padló út lines (right-angled; a shared junction at the last bend, `boxH`) |
| `ceilLinks` | a wall-to-wall Mennyezeti út |

Not carried over (no Planner equivalent yet): floorLinks, risers, prepared routes, spBoxSize, and the shutter
switches / motors (their own layer).

**Adapter additions (`08ob`):**
- `blSwitchGroups`: switches sharing a leg become a váltó or kereszt chain, with chain[0] = `swHead` or the end nearest
  the lamps; one switch with two legs is a csillár;
- `rbxSwitched`;
- `fixFace` from `roomOfDevice` (the Planner's own room for a wall device);
- Padló út lines that share a start and a junction form one group;
- a crossing end lands on the far side of its wall.

**Result:** the converted plan through the Planner's engine equals the CLI run with the same exclusions:
- **167 / 167 legs and 97 / 97 boxes identical**;
- the same metres (243,8 m), cables, pipes and checks;
- 16 circuits.

spec-98 checks this on every run (when the client file is present).

**Found along the way — and fixed in the engine:**
- **F15:** CLA v1 socket **D339 (D23, R01, A7) was never wired**. Its sketch point lay 290 mm off the wall, and
  `fixFace` moved it onto the R01 face but left `onWall` false, so it got no drop and no cable, silently.
  - With the fix, the CLA CLI result gains 1 drop box, a 340 mm room run and a 2150 mm drop (+3 m NYM-J 3×1,5, +2 M20).
  - One corner box goes, because the drop box now sits on that corner.
  - **The delivered v1 outputs (kimenet, takeoff) predate this fix.**
- **Network:**
  - a span end within 2 mm of a face end no longer splits the face;
  - points within 2 mm on a face are one node.
  - On CLA these change nothing; on rounded Planner spans they removed a 0,6 mm edge and a duplicate corner box.

The converted file is `Calculator/CLA-baseline/v1_2026-10-12/planner/CLA_v1_planner-adat.vplan.json` (client data,
local only). Load it in the Planner to try the two buttons; tick "Doboz minden saroknál" for the CLA rule.
**Step B (the user redraws CLA with the workflow tools) stays open.**

**E5-Q13 = B (user, 2026-10-15):** v1 stays as delivered; D339 is picked up the next time CLA is priced (the engine fix is in).
