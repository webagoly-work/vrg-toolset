# Wireway subsystem audit — 2026-10-18

*Written after the first full plan made with the workflow alone (the Domoszló test build, client data — kept outside
git in `Planner_projektek_2026-10-16/Domoszlo_erosaram_2026-10-18/`). Part 1 is how that build went. Part 2 is an
audit of wireway creation, debated with a red-team agent that started with no knowledge of the project. Part 3 is the
recommendations. Code anchors are against `planner-stack` at `c421d4e`.*

---

## Part 1 — How the Domoszló blueprint was built, and what it taught

### 1.1 The run, step by step

The plan was built by a script that calls the Planner's own functions in phase order, the same calls the buttons make.
The script started from the base file (walls, floors, openings) plus the sketch's lamp and switch positions.

| # | Step | Planner call | First result | What had to change |
|---|---|---|---|---|
| 1 | Room kinds | `f.kinds` (R1) | "NAGYSZOBA" matched the bedroom regex | set by hand; kinds come from names |
| 2 | Routable walls | `rwlToggleWall`, `rwlAddSpan` (R2) | 2 warnings: corridor and veranda reached over unmarked walls | 2 extra spans; a corner belongs to the *end face* of the neighbouring wall |
| 3 | Rule marks | `mrkAdd` vstrip / zone (R3) | 6 height suggestions disagreed with the placed heights | worktop / media / bed marks; zone leaks through a wall (§1.3 L8) |
| 4 | Endpoints | `epPlace` + `ptSlotSnap` | door snap moved 7 switches (up to 266 mm), 2 pairs merged into one slot | accepted; nothing in the UI says it happened |
| 5 | Refs | `nextRef`, `epRef` | sketch labels renumbered (K15 → K14); two "DED1" | sketch refs written back; DED numbered in one series |
| 6 | Heights | `stdApply` | 13 wall lamps above the 2700 ceiling (sketch 2800) | capped at ceiling − 200; nothing warned |
| 7 | Switching | `lswGroup`, `lswLink`, `lswSuggest` | worked first time; the kamra lamp got its switch from the suggestion | — |
| 8 | Board | `jbPlace('board')` | worked | — |
| 9 | Circuits | `elpSuggest` + `elpApply` | one day-zone lighting circuit with 53 points | split twice (garage V3, then V1/V4 after the check) |
| 10 | Wireways | `blRun` → `blApplyRoutes` → `blApplyWires` | V1 at 4,71 % voltage drop; 5 portal boxes with 7–9 pipes | V1 split fixed the drop; the boxes stay a finding |
| 11 | Verification | jsdom + headless Edge | the W21 elevation showed no conduits | wrong face — outer walls show routes only on the room face |
| 12 | Windows | own check script | 3 pipes at 2300 cross a window whose head is at 2400 | cutting the spans around windows made it worse; the user then said to ignore window heads for now |

Every check passes in the final file: 16 circuits, 207 legs, 111 boxes. Re-running Pályák on the imported file gives
the identical plan.

### 1.2 What worked

- **The phase order holds.** Rules, then endpoints, switching, board, circuits, wireways: no step needed going back
  to redo an earlier one. Each step's output is the next one's input.
- **The engine's checks steer the design.** The voltage-drop row named its own fix ("2,5 mm² vagy a kör
  megosztása"), and splitting the circuit fixed it. The "unmarked wall" warnings named the wall and the room that
  needed a mark.
- **Determinism.** Same input, same plan, to the leg. That made the work bisectable: one change, one diff.
- **Switching by intent.** Lamp groups plus switch links gave the right types (106 / 107 / 101) with no type typed
  in, and the wet-room rule put the WC switch outside.
- **One undo per engine run, a re-run replaces only `gen:'bl'`.** Iterating was cheap.

### 1.3 The lessons (problem → what solved it → what would solve it for good)

| # | Problem | Fix used | Fix for good |
|---|---|---|---|
| L1 | **No scripting surface.** Calling the tools needed internal names: `const` values only via `eval`, layer side effects of `wfLayer`, which call takes a `g`. | read the source of every tool | a small public API (`window.VP.place(...)`, `.markWall`, `.run()` — the T1 API already promised) |
| L2 | **Marks only steer, they never block.** An unmarked face costs ×4 (`SOFT`, network.js:41) but stays usable. Cutting a span at a window just let the engine use the gap, and broke a better route. | reverted | a third mark state: *tilos* (blocking) and *vezethető* (allowed) on top of the unmarked default |
| L3 | **Windows are not modelled.** Only doors exist for the engine (portals); a 2300 run crossed a 2400 window head. | ignored by instruction | openings as height bands on their face: a run at height h may not cross an opening whose band contains h |
| L4 | **Wall ends and corners.** A room corner can lie on the end face of the next wall; a span "along the wall" (u on the centreline) does not obviously cover it. | widened the span to 0 | mark by room face (what the user sees), let the engine map it to walls |
| L5 | **The trunk funnels through doors.** Walls are crossed only at portals, so the hub doors take 7–9 pipes in a 2-gang box. | reported | hub-aware box sizing, or a user-placed crossing point (szobadoboz / RBX) suggested where the count exceeds the box |
| L6 | **Circuit policy has no size or length cap.** "Day zone" put 53 points on one circuit; only the voltage-drop check caught it. | manual split | split suggestions by area / length / point count before the engine runs; re-run the suggestion after the check |
| L7 | **Stale derived data.** After moving points between circuits, `c.rooms` still listed the old rooms, and the side panel reported "kör vár végpontra" in 5 rooms. | recomputed by script | derive `c.rooms` from members on read, never store it |
| L8 | **Zone radius ignores walls.** The ágy zóna (600 mm) changed a socket's suggested height on the other side of a wall. | moved the socket | clip zones to the room they are drawn in |
| L9 | **Standards row order.** A room-kind row wins before a word / tag row: the WC fan is suggested at 1100, the hood in a worktop strip at 1100. | left as a suggestion | rank by specificity (word > tag > zone > kind) |
| L10 | **Silent snaps and merges.** The door snap moved switches up to 266 mm and stacked two into one slot; the engine then drops one cable for both gangs and gives the second switch no leg of its own. | checked by script | say it in the HUD and the result table ("K6 → B32 L1, a K5 kerete") |
| L11 | **Heights not validated.** Wall lamps above the ceiling, a switch at 300 — accepted silently. | capped / normalised by script | a check: `h > ceiling − box` and `h` outside the code's plausible band |
| L12 | **Refs are not stable.** Placing renumbers; two code families shared a series (DED1 twice). | rewrote refs | refs kept when given; one series per code; a duplicate-ref check |
| L13 | **Warnings speak engine ids.** "F13 W20" means nothing on screen; the room name and a click-to-zoom would. | looked up by script | messages with room names + a "mutasd" link to the face |
| L14 | **Elevation face convention.** The outer walls show conduits only on the room face; the other face shows the devices dimmed and no conduits — it looks like "nothing was routed". | found by inspecting the engine legs | open the room face first; show the other face's conduits greyed |
| L15 | **Verification needed outside tools.** Window crossings, unmarked-wall use per leg, legs per device — none is a button. | three ad-hoc scripts | a "Pálya-ellenőrzés" report (§3.4) |

### 1.4 What would have helped most, in order

1. **L1 — a public API.** Half the build effort was finding which internal function does what a button does.
2. **L2 + L3 — blocking marks and openings as obstacles.** Most of the routing "surprises" were the engine
   legally using a face the plan meant to forbid.
3. **L15 — one routing report.** Everything I checked by script (crossings, soft-wall use, devices without a leg, box
   fill, per-room cable metres) belongs in the result table.
4. **L6 — a smarter circuit split before the engine runs.** The engine's checks are good, but the loop
   "suggest → run → fail → split → run" should be one step.

---

## Part 2 — Audit of wireway creation (with a red-team debate)

**Method.** A fresh agent with no project knowledge got only the code paths, the design claim and the Domoszló file.
It audited independently: 13 perturbation scripts, with marks removed, the board moved, walls added, the device
order reversed. It wrote its report without seeing Part 1. I then checked its three gravest claims in the code myself, and
we ran one debate round on six contested points. **[V]** = verified by reading or running the code; **[I]** = inferred.

### 2.1 What the subsystem actually is

```
Planner session ──blInput (08ob)──► engine input (JSON copy, heights pinned, marks, floor / ceiling lines, sig)
   geom.load          rooms are the truth: every polygon edge → a "face"; a face belongs to a wall only if a
                      wall's long side is within 25 mm (geom.js:31)
   allowedFromSketch  only 'vezetheto' / 'belso' marks open a wall (geom.js:57)
   network.build      per room a perimeter loop; edges: face (×1, marked) · soft (×4, unmarked wall) ·
                      open (0, no wall between rooms) · cross (service-point faces) · over (ceiling link, trunk only)
   plan.plan          drop groups (250 mm, greedy) → nearest service point → lamp↔switch → circuits →
                      ONE trunk tree from the board (Dijkstra, +3 m to pass a service point, soft walls only as
                      a fallback) → per-circuit distribution (union of shortest paths, ×4 graph) → boxes →
                      pipes (≤ 3 cables, weakest-cable grouping) → checks (Iz·k, ΔU 4 %)
```

46 ms on the Domoszló ground floor: 139 nodes, 207 legs, 111 boxes. Deterministic for a given input — but **the order
of `data.devices` matters** (greedy drop grouping, plan.js:35) [V].

There are **two routing engines in one app**: `05v-graph.js` (heap Dijkstra, star / chain, a KMB Steiner tree over
drawn routes) and `05w-fill.js` (its own cable catalogue) predate `tools/baseline`. The two share nothing; `PORTAL_SLOTS`
and the cable table exist twice, kept equal by tests [V].

### 2.2 Findings, ranked after the debate

| # | Finding | Evidence | Severity |
|---|---|---|---|
| F1 | **Unmarked-wall metres count ×4 in the quantities.** `leg.len` sums search weights; cable metres and the > 10 m fill rule read it. One soft wall turned a 5,6 m route into 14,6 m. | plan.js:289, :348, 08ob:193 [V, checked twice] | high |
| F2 | **Devices vanish silently.** A device > 260 mm off a wall, outside every room, or on an outer face stays in its circuit with no leg and no warning. A switchless lamp in a zone without a service point is skipped. | prep.js:246, plan.js:136 [V] | high |
| F3 | **The forbidden marks are ignored.** The R3 palette paints tilos / gáz / kémény / vizes / padlófűtés / strang (ban) and kerülendő / fűtőtest / külső fal (minus). The router reads none of them — the user believes they forbade a face. | 08i-wf-rules.js:21-42 vs geom.js:57 [V] | high |
| F4 | **The engine's door latch differs from the Planner's.** `prep.portals` votes on the switch majority and never reads `door.variant`. On 9 of 11 doors the engine's L4 box sits 1,1–2,8 m from the Planner's slot. "The door is the portal" breaks at the door. | prep.js:70-72 [V] | high |
| F5 | **The warning names the wrong wall.** The soft-wall midpoint wraps the wrong way when a path walks backwards. Domoszló: "W20" and "W28" reported (both fully marked); the culprit was W21. | plan.js:227-228 [V] | medium-high |
| F6 | **Marks steer, they never block — for distribution, even unmarked is no "last resort".** Only the trunk has the marked-first fallback. A 3 m unmarked wall beat a 20 m marked route. | plan.js:75, :131; network.js:128 [V] | medium-high |
| F7 | **The trunk funnels through the hub doors.** 11 trunk + 3 distribution pipes (16 circuits) in one chase at the board; 11 pipes cross one wall at B32. The overfill check ignores pipes passing a box, so the 5 warnings understate it. Per-pipe grouping (E5-Q10 = A) treats them as ungrouped; per chase they would all fail. | plan.js:238-243, :434 [V] | medium |
| F8 | **Openings are invisible.** Runs at 2300 inside a window opening (head 2400), trunk at 2450 in a lintel; a 2400 ceiling puts the distribution below the door heads with no warning. *By the user's instruction window heads are non-blocking for now* — kept as an informational count; the door-head case still matters. | plan.js reads no opening heights [V] | medium (accepted) |
| F9 | **Geometry cliffs.** A room drawn 40 mm inside its walls loses every face (7 misleading "no marked wall" errors); a new wall drawn without redrawing the rooms leaves the routes running through it. | geom.js:31 [V] | medium |
| F10 | **Stale / destructive state.** Drawn routes stay after an edit with no stale marker; a re-run deletes every hand fix to a generated box; errors don't block "felrajzolás". | 08ob:153-217 [V] | medium |
| F11 | **Electrical model gaps.** A csillár unit's lamp leg stays 3×1,5 (needs 4 cores); ΔU sums all ceiling legs and omits meter → board; reference method fixed at B2. | plan.js:174-182, :470 [V / I] | low-medium |
| F12 | **Trunk = shortest-path tree, not minimum length.** Marking every wall made the total *longer* (398 → 428 m). Drop → service point ignores trunk cost. | [V] | low |
| F13 | **Scaling** — O(V²) Dijkstra; irrelevant at house size, a heap exists in 05v. | network.js:135 [V] | low |

**Where the debate moved positions**
- *Red team → me:* F1, F2, F4 and F5 I had not seen. In my build, F5 sent me to look at a wall that was already marked.
- *Me → red team:* F3 (the ignored ban marks). The agent conceded it is worse than its own S6 and dropped its proposed
  second "Gerinc fal" ink: the trade words already exist as pens.
- *Window heights:* both agreed F8 drops to an accepted limitation under the user's instruction, but stays visible as
  a count.
- *Crossings:* a user-placed crossing point alone is not enough, because the funnel is only visible after a run. The
  engine should **propose** one, the user accepts it, and it becomes a service point. That keeps the 2026-10-12 rule
  "walls are crossed only at service points".
- *Grouping:* E5-Q10 = A stays, but the per-chase figure goes next to it in the report with a ⚑ to confirm against
  MSZ HD 60364-5-52.

### 2.3 Is the design intact?

**The premise holds.** Endpoints plus allowed walls plus a board, then one button, matches how an electrician thinks in
installation zones. Topology is enforced by graph structure, not by penalties. It is fast, traceable to decision ids,
and on a well-drawn plan with complete marks the topology is good: Domoszló came out with no errors.

**The promise doesn't hold yet.** "The user draws intent, the machine derives the rest" fails in four places:
- **Intent is half-read.** Allow-marks are read; forbid-marks are not (F3); the door's own geometry is not (F4).
- **Derivation is unchecked where the site bites:** openings, lintels, chase density (F7, F8).
- **Quantities are wrong where the plan is incomplete** (F1).
- **Failures are silent, mislabelled or non-blocking** (F2, F5, F10). A non-programmer cannot tell a good result from a
  plausible wrong one — the core risk.

**Verdict:** a sound topology generator, not yet a trustworthy quantity or constructability generator. The fixes are
mostly small (Part 3); the design does not need replacing.

---

## Part 3 — Recommendations

### 3.1 The merged top 10 (signed by both sides of the debate)

| # | Action | Fixes | Effort |
|---|---|---|---|
| 1 | Geometric lengths in `leg.len`, spans and cable metres; weights only for search | F1 | S |
| 2 | Error on every circuit member with no leg, off-wall, or outside all rooms | F2 | S |
| 3 | Wire the R3 marks in per face: ban = no edge, minus = ×k (≈ 2, a setting), unmarked = ×4 *and* fallback-only for distribution too, vezethető = ×1 | F3, F6, L2 | S–M |
| 4 | Door latch from `door.variant` / `ptSlots`; one slot table for engine and Planner | F4 | S |
| 5 | Fix the `wallsOf` midpoint; every warning with the room name and a "mutasd" link | F5, L13 | S |
| 6 | **Pálya-ellenőrzés** report (§3.4) + a stale flag; errors block "felrajzolás" unless confirmed | F10, L15 | M |
| 7 | A public `VP` API (`place`, `markWall` / `markFace`, `run`, `report` — plain JSON) — the promised T1 | L1 | M |
| 8 | Proposed crossing points at overloaded portals, user-accepted; per-chase grouping shown with ⚑ | F7, L5 | M |
| 9 | Validation before the run: height > ceiling − box, duplicate refs, snap / merge notices, order-independent drop grouping | L10–L12 | S–M |
| 10 | A second engine mode: **room-box star in the ceiling** (§3.5) | F7, F8 | M |

Items 1–5 together are about two days and turn silent wrong results into visible right ones without touching the design.

### 3.2 What would have helped me during the Domoszló build
1. **The public API (#7)** — half the effort was finding which internal call a button makes.
2. **Blocking marks (#3)** — every routing surprise was the engine legally using a face I meant to forbid.
3. **The report (#6)** — I wrote three throw-away scripts for things that belong in one table.
4. **A length-aware circuit suggestion** — the run → fail → split → run loop for V1 should be one step (§3.6).
5. **Stable refs (#9)** — so a plan built from a sketch keeps the sketch's labels, and the comparison stays one-to-one.

### 3.3 Simple user steps after the current workflow
1. **Paint the forbidden faces** (gáz, kémény, vizes, fűtőtest) before the first run — once #3 makes them count.
2. **Confirm each door's mains side**: one L / R chip per door, shown before Pályák (removes F4 even before the fix).
3. **Accept or reject the proposed crossing points** (#8); a rejection is remembered.
4. **Tick the per-room review card** in the report: soft walls and unreached devices in red; the tick is stored with
   the plan's `sig`, so an edit clears it.
5. **Pin generated boxes you moved**, so a re-run keeps them (F10).
6. Optional, once per window type: head height and redőny flag — makes F8 checkable when it is switched on.

### 3.4 The Pálya-ellenőrzés report (one button, one table)
- Devices with no leg.
- Metres on unmarked walls, metres on minus marks.
- Geometric vs weighted metres, until #1 lands.
- Pipes per chase and per crossing (busiest five), box fill counting pass-by pipes.
- Door-slot snaps and merges.
- Room edges with no wall within 25 mm.
- Run / opening clashes (informational).
- Drop-grouping changes since the last run.
- Stale flag (`sig` ≠ drawn).
- Per-room cable metres.
- Every line carries the room name and a "mutasd" link.

### 3.5 Other viable methods — for wireways
| Method | Fits | Effort | Verdict |
|---|---|---|---|
| **Room-box star in the ceiling** — one box per room (szobadoboz / RBX already exist); each point rises to the ceiling or box, runs straight to it; room boxes home-run to the board through the slab | slab (födém) / suspended-ceiling builds, most new builds; no door funnel | S–M | **the second mode** (#10) |
| Capacity-aware Steiner trunk on the existing 05v code (KMB + pipe-count² edge cost) | the current wall model; spreads load across doors, shorter trunk (F12) | M–L | later, as an internal improvement of mode 1 |
| Grid A\* on a wall-band strip (50 mm cells, z bands) | openings, lintels, obstacles native; bends and "pipes already here" as costs | L | only if F8 must become blocking |
| Orthogonal connector routing (libavoid) | nudges parallel conduits apart — exactly the "11 pipes in a chase" look | M + licence work | for drawing quality, not topology |
| Rule templates per room kind | the quickest "basic coverage" draft | S | good for endpoints (§3.6), too rigid for routes |

### 3.6 Other viable methods — for the rest of the workflow
- **Endpoints: coverage templates per room kind.** I placed every socket by hand: 2 per long wall, clear of doors, worktop
  run, bedside pair. A "Lefedettség javaslat" — per kind and wall length, skipping openings and door slots — would draft
  the same layout in one click. It is the R4 / E4 pattern again: suggest, tick, apply.
- **Circuits: length- and load-aware split.** Split the lighting zone by area or tree distance before the engine runs
  (≤ N points, or the estimated ΔU from the board-to-room distance), not after the check fails.
- **Heights: a ceiling-aware clamp at placement** — the tool already knows the room ceiling (`epCeilH`).
- **Verification: the elevation set.** The script that rendered all 20 room faces (`wallElevationSVG` → PNG) should be a
  Kimenet item — "Falnézetek (minden helyiség)" — exactly what the comparison with the user's own version needs.

### 3.7 Open-source code worth knowing (licences checked by web search 2026-10-18 — re-check each LICENSE before vendoring)
| Project | Language | Licence | Use for us |
|---|---|---|---|
| [qiao/PathFinding.js](https://github.com/qiao/PathFinding.js) | JS | MIT [checked] | grid A* / orthogonal JPS — the wall-band grid option |
| [anvaka/ngraph.path](https://github.com/anvaka/ngraph.path) | JS | MIT [checked] | A* / NBA* with a fast heap — drop-in for the O(V²) Dijkstra |
| mourner/tinyqueue | JS | ISC [agent, via licences.dev] | a 1 kB heap — the smallest fix for F13 |
| [rsmt-ts](https://npmjs.com/package/rsmt-ts) | TS | MIT [npm] | exact rectilinear Steiner tree (GeoSteiner method); author warns of edge bugs |
| OpenROAD Flute3 | C++ | BSD-3 [docs] | RSMT by lookup table; a port, not a drop-in |
| [adaptagrams libavoid](https://www.adaptagrams.org/documentation/libavoid.html) + libavoid-js (WASM) | C++ / JS | LGPL-2.1+ [docs; repo file not checked] | orthogonal routing with nudging; LGPL in a single-file HTML needs relink care |
| elkjs | JS | EPL-2.0 [several sources] | orthogonal edge routing; copyleft-ish |
| [AlexAgo83/electrical-plan-editor](https://github.com/AlexAgo83/electrical-plan-editor) | TS / React | MIT [checked] | harness routing, not buildings; ideas for route locking |
| GeoSteiner, SCIP-Jack | C | conflicting / academic | avoid until the licence is clear |

No open-source building-conduit autorouter turned up. The tools that exist are commercial: CYPE Open BIM Cable Routing
(manual layout) and Stabicad autorouting. The engine itself is the asset; the libraries above fill single holes: a heap,
a Steiner tree, nudging.
