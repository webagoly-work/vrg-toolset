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

---

## Part 4 — Follow-up: the user's routing model, reviewed by the red team (2026-10-18)

The user's proposal: a **dual connecting system**.
1. **Topology** — the electrical connections the user defines:
   - groups (socket strings, lamp + switch groups), each with a leader;
   - a Group Order sequence inside each group;
   - master points (junction boxes fed directly from the Elosztó);
   - leaders hang on a master or on the Elosztó;
   - reaching the Elosztó prompts a circuit, from a pre-ticked checklist.
2. **Physical space** — where conduit may go:
   - open and blocked walls and sides, on the overlay and per sublayer;
   - directional flow lines (soft), *or* drawn preferred paths bound to the Master / Leader → Elosztó links;
   - manual junction points as nodes.

The autoroute then fits the topology into the physical space, layer by layer.

The red team re-reviewed its own earlier proposals against this. I verified its three load-bearing claims in the code.

### 4.1 The decisive fact: most of the model already exists as data, and the engine ignores it

| Already in the Planner | Read by the engine? |
|---|---|
| lamp groups `d.grp`, switch links `sw.ctl`, the leader switch `swHead` (08l) | yes (`blSwitchGroups`) |
| the szobadoboz as **room feed** (08n:9-13, "szoba betáplálás") | **no** — only as a wall crossing (plan.js:14) |
| `lamp.meet`, the box where a lamp leg meets its switches (08n) | **no** — "meet" appears in plan.js only in a comment (:163) [V] |
| the classic socket chain "Elosztó → first room socket → … → last" (08n:11) | **no** — the engine builds a star from the door, a union of shortest paths (plan.js:129-133) [V] |
| hand-drawn ARM / channel routes with explicit joins `n.j` (05u), chain / star / Steiner over them (05v) | **no** — `blInput` sets `D.paths=[]` (08ob:44) [V] |
| marks with a `layer` | only the overlay `vezetheto` / `belso` |

So the user's model is not new machinery. It is the structure the Planner already half-declares and the router never
consumes. That is the strongest argument for it.

### 4.2 Verdict per idea (red team; my position where it differs)

| Idea | Verdict | Why |
|---|---|---|
| Groups + leader (dedicated → Elosztó, socket strings with a leader socket, lamp + switch groups with a leader switch) | **foundation** | it records what the electrician decides anyway and the engine now guesses (nearest door, star). Lamp groups and the leader switch exist; the leader socket is new. Safe only if every unset group is auto-filled. |
| Master points | **foundation** — exists as the szobadoboz | it replaces the "nearest door" guess and fixes the hub-door funnel at the source: home runs end at masters, so a door is only a crossing. A plain kötődoboz must not silently become a wall crossing. |
| Manual junction points (⌀80 / 100×100) as nodes | **foundation** — exists (08n kot / szoba / ceiling) | the engine must take them as graph and tree nodes |
| The dual system as the base contract | **foundation** | it turns the router from an *inference* engine into an *embedding* engine — far more predictable. Holds only if every topological piece is optional and auto-filled. |
| Elosztó prompts a circuit + checklist | **build, but as a tray** | the checklist exists (08oa). A modal on every link to the board will be clicked away blindly → a non-blocking "Elosztóra vár: 3" tray with batch assign. |
| Master / Leader → Elosztó link with wall-snapped intermediate nodes (the "more defined way") | **build** | a hand-drawn route bound to one link: unambiguous, checkable ("route left at wall X"), already buildable on ARM / channel + 05v. |
| Group Order tool with re-visits | **postpone the tool, keep the data** | a sequence with revisits is a walk the engine must reinterpret as a tree; two users draw the same tree two ways. Simpler: **each click sets `up` = the previously clicked node**, so a branch is two nodes with the same `up`. Default order from `rgChain` (exists). |
| Marks on every sublayer | **postpone** | needed for BRIDGE (SELV on the hinge side, mains on the latch side), overbuilt for Erősáram. Simpler: the overlay applies to all layers; a sublayer mark is only an exception ("tilos here" / "only here"). |
| Free flow lines (soft, directional, may overlap or contradict) | **red team: drop** | an invisible discount the user can neither predict nor check; near-equal preferences flip on small edits. |

**My position on flow lines.** I agree that free, directional flow lines should not be built: a tree's cost is the
same in both directions, so the direction adds nothing the router can use. But the user's real need — "I prefer the
routes here" — deserves a predictable form. The honest equivalent is a **third mark strength, "előnyben" (preferred)**,
which costs ×0.5 on a wall or side. It has no direction, may overlap and may go unused, and the report shows whether
it was used. It is the user's flow line made checkable, and it costs one row in the R3 palette.

### 4.3 What the red team revised in its own earlier suggestions
- **Conceded: the room-box star.** It is no longer a separate engine mode; it becomes the **automatic default master**
  when the user sets none.
- **Conceded: the capacity-aware Steiner trunk.** Once leaders and masters fix the tree, it is not needed. The engine
  only fits the fixed links in, with a congestion cost. KMB (05v) stays only for auto-placing a master.
- **Conceded: "drop → service point ignores trunk cost" and the "Gerinc fal" ink.** Masters, the ban / minus marks
  and the drawn link routes cover them.
- **Held: the top-10 bug fixes come first** — the new structure must not sit on a router that counts unmarked metres
  ×4 and drops devices silently.
- **Held: engine-proposed crossing points.** A master in a room with one door still funnels through that door. The
  accepted form of a proposal is simply one of the user's junctions, flagged szobadoboz.
- **Held: the Pálya-ellenőrzés gate** — more important with two models that can contradict each other.

### 4.4 The minimal data model — no new device types, one new field

| Entity | Stored as | Rule |
|---|---|---|
| **Node** | existing devices: endpoints, `junction` (`jb` szoba / kot / ceiling), `board` | + **`up: {id, via?, fix?}`** — exactly one upstream per node, except the board; loops refused when drawn |
| Group, leader, sequence, master | **derived** from the `up` chain | leader = first node below a master or the board; master = a junction whose `up` is the board; sequence = the chain; a branch = siblings |
| Control (switching) | `sw.ctl`, `d.grp`, `swHead` — unchanged | **separate from power.** The leader switch is `swHead`; a leg's meeting box is `lamp.meet` (finally read) |
| Circuit | `data.circuits`, `c.members` stays the source of truth | an `up` chain stays inside its circuit until a junction or the board; mismatch = a check, never a silent re-membership; `c.rooms` derived on read |
| Preferred physical path | existing `data.paths` (ARM / channel, joins) and `cline` marks | `up.via` = a path id; honoured if feasible, a deviation is reported |
| Marks | existing marks (`kind`, `tags`, `pol`, `layer`, `side`) | precedence per layer: **ban > own-layer plus > overlay plus > előnyben (×0.5) > minus (×2) > unmarked (×4, fallback only)**; a ban is never softened |

### 4.5 The configurations — each a superset of the last, all on the same data and report

| | Name | The user does | The engine does | Effort |
|---|---|---|---|---|
| **K0** | Csak jelölés (marks only) | marks, ban marks, endpoints, switching, board, circuits — as today | today's routing with the top-10 fixes; fills every `up` automatically so later steps can show it | ~1 week |
| **K1** ★ | Szobadoboz-mester (masters) | K0 + optionally one szobadoboz per room (or accepts the dashed suggestion) + optionally a leader socket per socket circuit (one click) | home run Elosztó → master per circuit; leader switch box → master; socket strings in `rgChain` order; dedicated → board; with no master, the latch L4 of the door is the master (today's behaviour, made explicit); **only the fit of each link into the walls is searched** | +1–2 weeks |
| **K2** | Topológia (explicit tree) | K1 + the chain tool (each click sets `up`; a click on a chain node starts a branch) + the Elosztó tray (default from the checklist) | as K1 — more of the tree is user-fixed | +2–3 weeks |
| **K3** | Teljes kettős (full dual) | K2 + drawn routes on any link (`via`, the existing ARM pen) + per-layer exception marks | prefers `via` (×0.25, never through a ban); per-layer precedence; layers in a fixed order with shared-chase congestion | when a second layer autoroutes |

**Recommended base: K1, with K2's `up` field written from day one.**
- It delivers the essence of the user's model: masters and leaders, which the engine ignores today.
- It costs two optional clicks per room.
- It removes the hub-door funnel structurally.
- With only marks drawn, it still routes exactly as K0.
- K2 then adds only a tool, not a migration.

### 4.6 Engine and foolproofing (agreed)
- **Fitting a fixed tree:**
  - each link child → parent gets one shortest path in the wall graph;
  - links are processed in a stable order (circuit, depth, id);
  - a light congestion term (+c × pipes already there, two passes) spreads parallel home runs across doors;
  - lengths are always geometric.
- **Blocking checks before routing:**
  - a loop or two upstreams;
  - a leader or master that cannot reach its parent (naming the blocking ban mark or the missing wall mark);
  - a chain that crosses circuits;
  - a leader switch outside its own lighting circuit.
- **Warnings:** a group spanning rooms, a master with no board link (auto-linked, dashed), `c.members` ≠ the `up` set
  (with a "javít" button), a `via` route only partly honoured.
- **Guard rails:**
  1. Only marks, the board and the circuits are mandatory. Everything else is auto-filled and drawn **dashed**
     ("javasolt"); one click makes it **solid** ("rögzített"); "Elfogadom mind" per room.
  2. The editor cannot break the tree: one upstream per node, loops refused with a plain Hungarian reason.
  3. Four visible device states: unassigned / suggested / fixed / unreached.
  4. Ban is hard and red; unmarked-wall legs are drawn hatched and counted in the report.
  5. The non-blocking Elosztó tray instead of modal prompts.
  6. The Pálya-ellenőrzés gate: errors block "Felrajzolás", warnings need one acknowledgement per run.
  7. Re-runs regenerate only `auto` items, with stable generated ids; drawn items show a stale state after an edit.
  8. Every snap and merge is announced.

### 4.7 Build order (fits the workflow phases)

| WP | Phase | Content | Effort |
|---|---|---|---|
| T0 | Pályák | the top-10 fixes (geometric lengths, unreached = error, ban / minus + előnyben marks, latch from the door, the wrong-wall fix, the report + stale flag + error gate) + order-independent drop grouping | S–M |
| T1 | Villamosság | the `up` field, auto-fill from today's logic, invariants, dashed / solid states | M |
| T2 | Pályák | the engine fits a fixed tree; masters as room feeds; reads `lamp.meet`; keeps user `D.paths` | M |
| T3 | Villamosság | master suggestion per room; the leader-socket click; `rgChain` default order | S–M |
| T4 | Villamosság | the Elosztó tray + checklist binding (on 08oa) | S–M |
| T5 | Villamosság | the chain tool (Group Order without revisits) | M |
| T6 | Pályák | drawn routes (`via`) as preferred fits, with a deviation report | M |
| T7 | Szabályok | per-layer mark precedence — only when a second layer autoroutes | M–L |

### 4.8 Decisions for the user
1. **Base configuration:**
   - A: K1 with the `up` field from day one (recommended by both sides)
   - B: K0 only, decide K1 later
   - C: go straight to K2
2. **Flow lines:**
   - A: the "előnyben" mark (×0.5, no direction) instead of flow lines — my proposal
   - B: drop entirely — the red team's view
   - C: build directional flow lines as drawn
3. **Group Order:**
   - A: each click sets `up`, no revisits (recommended)
   - B: sequences with revisits, as drawn
4. **Elosztó prompt:**
   - A: the non-blocking tray (recommended)
   - B: a modal on every link to the board
5. **Socket topology:** the engine today builds a star from the door, against the classic chain written in 08n.
   - A: the chain from the leader socket (08n's rule)
   - B: keep the star
   - C: per circuit, as a setting

**Answered 2026-10-18 by the user: all A** — K1 with `up` from day one · the "előnyben" mark instead of flow lines ·
each click sets `up`, no revisits · the non-blocking Elosztó tray · the classic socket chain from the leader socket.
Build continues from `GO-WIRE.md` (repo root of the worktree): T0 first.

---

## Part 5 — T0 built (2026-10-18)

All seven T0 items are in `tools/baseline` (so the CLI and the Planner run the same engine) plus the Planner glue.
Spec: `tests/spec-100-wireway-t0.js` (44 checks). Full suite: 95 suites, 3 334 checks, golden 70 / 70 identical.

| # | Item | Where | What changed |
|---|---|---|---|
| 1 | Geometric lengths (F1) | network.js `link(…, geo)`, plan.js `edgeW` | every edge carries its real length; legs, spans, cable metres and the prepared route read `geo`; `w` is search-only |
| 2 | Unreached = error (F2) | plan.js, `R.unreached` | every circuit member without a conduit: ⛔ with the reason (off the wall by N mm, outside every room, no route to a service point, switchless lamp with no service point, its switch not wired) |
| 3 | Marks per face (F3, F6) | geom.js `faceMarks` / `faceSide`, network.js | ban (tilos, gáz, kémény, vizes, gépészet, a strang zone) = no edge, listed in `g.banned`; minus ×2 (`cfg.minusK`); **előnyben** ×0.5 (`cfg.prefK`), a new R3 preset and face ink; unmarked ×4 is now fallback-only for the distribution too (`P()` and drop → service point: marked first). L-forma / médiafal / munkalap marks change nothing |
| 4 | Latch from the door (F4) | prep.js `doorLatch`, `08fz-wf-baseline.js` | the latch follows `door.variant` / `ang` exactly as the Planner draws its slots (spec: 2 doors × 4 variants × 2 angles); the bundle moved before 08g, so `PT_SLOTS` **is** `BL.rules.PORTAL_SLOTS`; an info line where the switches stand on the hinge side; `cfg.latchFrom:'switches'` keeps the old vote (P33 v1 uses it) |
| 5 | The wall a warning names (F5, L13) | network.js edge `wall`, plan.js | the soft edge knows its wall; warnings say the room's name and carry `{room, at, ids, walls}`; the Planner shows a **mutasd** link that centres the view and rings the place (`blShow`) |
| 6 | Pálya-ellenőrzés (§3.4, F10) | plan.js `pathReport` → `R.report`; 08ob `blReportHtml`, 🔎 action `bl.check` | unreached, metres by surface (geometric vs weighted), előnyben used or not, the five busiest chases and crossings (with the ⚑ per-chase note, E5-Q10 stays per pipe), box fill **with the pipes passing by**, stacked endpoints, room edges with no wall, opening clashes (informational), drop-group changes since the last run, the stale flag (`blStale`), cable metres per room. **Errors block "Pályák felrajzolása"** unless the confirm box is ticked (`blApplyRoutes(run, {confirm})`) |
| 7 | Order and input (L10–L12) | plan.js, 08g, 08ob | drop groups: sort (room, face, u, id) then sweep; pipe packing and the váltó head break ties by id, not file order; a wall point above ceiling − 100 warns; one ref on several endpoints warns; endpoints stacked on one spot (same face, place, height) are an info line; the door-slot snap HUD says how far it jumped and whose frame it shares |

### The Domoszló diff (the acceptance file, ground floor)

| | before T0 | after T0 |
|---|---|---|
| circuits / endpoints / drops | 16 / 107 / 78 | 16 / 107 / 78 |
| legs (dist · trunk · drop · ceil) | 82 · 21 · 86 · 18 = 207 | 83 · 21 · 86 · 18 = 208 |
| conduit metres (dist · trunk · drop · ceil) | 132,4 · 131,0 · 98,6 · 36,4 = **398,4 m** | 147,5 · 128,0 · 98,6 · 36,6 = **410,7 m** |
| cable metres 3×1,5 · 3×2,5 · 3×6 · 4×1,5 · 5×1,5 | 280,3 · 154,4 · 10,5 · 81,3 · 4,8 | 297,0 · 146,6 · 10,5 · 85,5 · 4,8 |
| boxes (sp · drop · end) | 17 · 75 · 19 = 111 | 17 · 74 · 15 = 106 |
| warnings / errors | 5 / 0 | 17 / 0 (9 warn, 8 info) |

**The whole difference is F4.** The same T0 engine with `latchFrom:'switches'` gives the pre-T0 plan exactly (398,4 m, 111
boxes, the same 5 warnings). F1, F6 and the grouping change nothing on Domoszló: it had no soft leg and no order-sensitive
drop. Seven doors move their L4 box to the door's latch side: B33 B34 B35 B46 by 1 200 mm, B43 by 1,5–1,7 m, B39 by 2,15 m,
B45 by 2,8 m. On five of them (B33 B34 B35 B39 B46) the user's switches stand on the hinge side — an info line each. At
B39 the latch face lies on **W23, which is not Vezethető**: the trunk now reaches B39 only over 10 m of unmarked wall (3
warnings). The end-to-end rebuild (`build-dom.js`) runs unchanged and gives the same 106 boxes, 226 paths.

Report figures: 262 m of horizontal route (248 on Vezethető walls, 10 unmarked, 3,7 crossings; the search weighted it
292 m); busiest chase at the board in the garage, 14 pipes / 16 circuits; busiest crossing B32, 11 pipes; box fill X3 and
X4 9 in + 9 passing; 5 runs inside a window band (informational); no unreached endpoint, no wall-less room edge.

### The red team, re-run

| Script | Finding | Before | After |
|---|---|---|---|
| t9 (off-wall, exterior, outer-face socket) | F2 | no leg, no message | ⛔ each, with the distance / "helyiségen kívül"; blocks the drawing (t9b) |
| t9 case 3 (room 40 mm inside its walls) | F9 | 7 misleading "no marked wall" lines | ⛔ per drop + the report's wall-less edges |
| t6 / t10 (a mark removed) | F5 | "W20" / "W28" named | the wall the run is on (W21 / W26), with the room |
| t11 (3 m unmarked vs 20 m marked) | F6 | the unmarked wall | the marked route (20,4 m) |
| t7 / t5 (device order reversed) | L10 | drops and pipes changed | identical (drops, legs, boxes, switch groups — t5b) |
| t7 (engine L4 vs Planner slot) | F4 | 1,1–2,8 m apart on 9 of 11 doors | the same place along the wall (75–150 mm = half the wall, face vs centreline) |
| t12 / t13 (openings) | F8 | unseen | listed in the report (informational, as instructed) |

**P33 v1 (CLI, `p33.config`):** the latch keeps the switch vote (`latchFrom:'switches'`), and the converter turns each
door's handle to P33's latch side, so spec-98's parity holds (167 → 171 legs on both sides). The CLI plan itself moves:
one room run in R06 / R03 had been counted 12,4 m (×4) for 2,9 m of soft wall and now takes the marked route; one R08
drop regrouped under the sort-and-sweep rule. Total 243,8 → 237,7 m, boxes 97 → 89. The delivered v1 is untouched
(E5-Q13 = B). P33's own warnings now show three duplicated refs (D2, D17, DED1 — three each).

### Open questions from T0

1. **Q-T0-1, the Domoszló doors whose switches stand on the hinge side (B33 B34 B35 B39 B46):**
   - A: the doors are drawn right — keep the latch from the door; the switches move to the latch side when you redraw
     (★ — it is what F4 asked for);
   - B: the switches are right — flip those doors' hinge (variant), and the L4 box follows;
   - C: where switches stand beside a door, let them decide the latch (make `latchFrom:'switches'` the default).
2. **Q-T0-2, B39's latch face on W23:** A: mark W23 Vezethető around B39 (★); B: decided by Q-T0-1 B (flip B39).
3. **Q-T0-3, előnyben on an unmarked wall:** A: it opens the face at ×0.5 (built ★); B: it only discounts a Vezethető face.
4. **Q-T0-4, height bands and floor zones:** built: a strang zone bans the faces within 100 mm, a padlófűtés zone bans
   only floor runs, hstrip bands are not read. A: keep for now (★); B: read the hstrip band against the run heights now.

**⏸ T0 checkpoint.** T1 (the `up` field) starts after the answers above.

**Answered 2026-10-18 by the user: all A** ("approved, continue") — the latch stays with the door; W23 is Vezethető around
B39 (in `build-dom.js`, span 300–3000, and the acceptance file is rebuilt from it — the previous one is kept as
`Domoszlo_erosaram_claude_preQ2.vplan.json`); előnyben opens an unmarked face; the strang / padlófűtés scope stays.
With W23 marked: 409,9 m, 108 boxes, 0 m on unmarked walls, only the 5 box-overfill warnings left.

---

## Part 6 — T1 built (2026-10-18): the `up` field

`src/08od-wf-uptree.js`, spec `tests/spec-101-uptree.js` (26 checks). Full suite: 96 suites, 3 360 checks, golden 70 / 70.

| Piece | What it is |
|---|---|
| Data | `d.up = {id, room?, via?, fix?}` on every node: Erősáram endpoints, junctions (szobadoboz / kötődoboz / mennyezeti), RBX, BASE, an Alosztó. `id` = a device, the board, or a **door** (its L4 on face `room` — K1's derived master). `fix` = rögzített; none = javasolt. `via` stored for T6. Saved with the plan, undoable |
| Roles (derived, `upRole`) | master = a szobadoboz / RBX / BASE fed from the board; leader = the first node below a master, a door or the board; member = the rest. `upChain` walks to the root |
| ⚙ Betáp-fa javaslat (`up.fill`) | reads one engine run: the device's first leg — the previous device of a vertical / ceiling chain **of the same circuit** (a switched lamp feeds only lamps of its own switching unit), else the drop's service point; a switched lamp hangs on the box its leg meets in (08n jbMeet), else its head switch; masters on the board. Replaces only javasolt links, ONE undo step. ⚒ Pályák refreshes them too, in its own undo step |
| Invariants (`upSet`) | one upstream (one field); no loop (refused, the chain spelled out: "Hurok: …"); not itself; the board is the root; a source must exist, be a node, and be on the same level |
| States | none · javasolt (dashed ring and link) · rögzített (solid) · bekötetlen (red ring, from the last run's `R.unreached`). 🌳 shows them; 📌 Betáp-fa rögzítése: one click on a node flips javasolt ↔ rögzített; the device menu: rögzítés / feloldás / törlés, and **Elfogadom mind ebben a helyiségben** |
| Checks (`upCheck`, Dugaljak layer) | a loop (err), a source no longer in the plan (warn), a chain into another circuit (warn), circuit members with no upstream (info; redőny left out — its own layer) |

The engine does **not** read `up` yet — that is T2. So T1 changes no route: on Domoszló every leg, box, metre and warning
is identical before and after T1 (checked).

**On Domoszló:** 106 links suggested, 0 refused; 64 leaders on door L4s, 42 members (switched lamps on their switch
boxes, vertical chains), chains at most 4 deep, no loop, no check line. **On P33 (the converted plan, in the browser):**
105 links, 0 refused, 4 masters (the RBXs and the BASE), no check line; a real click with 📌 flips a lamp to rögzített
and the drawing turns solid.

Found while building (fixed): a vertical chain in one box passes devices of other circuits, so "the previous device"
is not always the power source (K10 under D22, DED2 under D28 on Domoszló); a wall lamp above its own switch in one
box would make the switch hang on its lamp — a loop upSet refused (P33 K1 / L13); RBX and BASE were not accepted as
nodes. **Also noted for T2/T3:** today's engine feeds a room's sockets through its szobadoboz, against 08n ("a
szobadoboz never distributes sockets") — T3's socket chain from the leader socket replaces it.

**⏸ Checkpoint before T2** (GO-WIRE): T2 makes the engine fit this tree (only each link's path is searched). The
Domoszló figures it starts from: 16 circuits, 208 legs, 409,9 m of conduit (dist 139,6 · trunk 135,0 · drop 98,6 ·
ceil 36,6), 108 boxes, 5 warnings (box overfill at B31 / B32 / B33), 0 m on unmarked walls.

---

## Part 7 — T2 built (2026-10-19): the engine fits the tree

User, 2026-10-19: "proceed, make an effort for a larger batch" — the ⏸ before T2 was passed on that word. Spec
`tests/spec-102-tree-fit.js` (22). Full suite: 97 suites, 3 382 checks, golden 70 / 70.

| Piece | Where | What |
|---|---|---|
| The tree in | 08ob `blInput` | `cfg.tree` = every node's `up` on the level; a lamp with none but a pinned `meet` box gets that box. The tree is in the stale signature. The user's own `D.paths` stay in the input (T6), only `gen:'bl'` goes |
| Drops | plan.js §3 `fromTree` | a member's up names the drop's feed: a door's L4 on face `room`, a hub (szobadoboz / RBX / BASE), the board, or a device in ANOTHER drop = a chain (fed from that drop; the root's service point carries the home run, `depth` kept). Unreachable, another zone, or no route on Vezethető walls → ⛔ naming why (and the room's ban marks); the drop then falls back to today's nearest rule. No up = today's rule. A lamp on a switch is its leg, not a feed |
| Room runs | §7 | parents first; a chain drop's run starts at its parent's box when the same circuit feeds it (else a warning, and the service point); the voltage drop sums the chain |
| Lamps | §7 units | the leg starts where it meets: a service point on the wall graph (szobadoboz, door L4, RBX) — with a switch leg (NYM-J 3×1,5, 4×1,5 for a double) from there to the switch box unless the switch is fed from that box — or a ceiling junction (box → riser → junction → lamps). Ceiling lamps follow the up order: chain or star |
| Home runs | §6 `routeChannels` | collected first, then routed in a stable order (nearest first, id) with a congestion term `cfg.congest × length × cables already there`. `congest` 0 (CLI, P33) = today's single tree exactly; the Planner uses 0,05 (`BL_OPT.congest`) |
| Fixed point | 08ob `blApplyRoutes` | fill the javasolt links from the run, run again on the new tree, until they stop changing (≤ 3): what is drawn is the run of the tree as it stands — not stale the moment it is drawn |

**Domoszló** (the Q-T0-2 fixture):

| | no tree | auto tree, congest 0 | auto tree, congest 0,05 (Planner) |
|---|---|---|---|
| conduit (dist · trunk · ceil) | 139,6 · 135,0 · 36,6 → **409,9 m** | identical, leg by leg | 139,6 · 144,5 · 36,6 → **419,4 m** |
| cable 3×1,5 · 3×2,5 | 291,9 · 162,9 | identical | 295,4 · 168,3 |
| busiest chase · crossings | garázs 14 pipes / 16 circuits · garázs 11, konyha 5, közlekedő 2 | identical | garázs 13 / 16 · garázs 10, konyha 3, konyha 3 |
| boxes · warnings · errors | 108 · 5 · 0 | 108 · 5 · 0 | 108 · 5 · 0 |

So the tree reproduces today's plan exactly when it is today's plan, and the congestion term spreads the home runs
a little (+9,5 m of trunk for one pipe less at the garage crossing and two less at the kitchen). P33 (CLI, congest 0,
no tree) is identical to T1, leg by leg.

---

## Part 8 — T3 built (2026-10-19): leader sockets, the chain, masters

`src/08oe-wf-leaders.js`, spec `tests/spec-103-leaders.js` (18). Full suite: 98 suites, 3 400 checks, golden 70 / 70.

- **The classic socket chain (Q5 = A)** is now the suggestion for every socket circuit, per room: the leader is the
  clicked socket (📍 Vezető dugalj, `d.lead`, one per circuit and room) or the drop nearest its feed; from it, each
  next socket hangs on the nearest unvisited one along the routable walls — rgChain's rule (05v), on the engine's wall
  graph. The leader hangs on a door's L4 or the board, **never on a szobadoboz** (08n). Dedicated circuits keep their
  home run. It lives inside `upSuggest` (`UP_SUGGEST`), so a refill and Pályák keep it; rögzített links are untouched.
- **The engine follows it** (T2). A chain is per member: one box may hold a socket chained to its neighbour and a
  switch fed from the door (found on Domoszló: K10 / D22 — a false "chain into another circuit" before the fix).
- **Masters (K1):** ▣ Szobadoboz-javaslat lists every room with no hub and ≥ 4 drops, the spot with the shortest run to
  its drops plus the home run, on a Vezethető wall. Pre-ticked only where a door box overfills (the F7 funnel); the
  rest is offered unticked. Placing = a szobadoboz (on the board, a master) + a refill. The dashed squares show while
  the betáp-fa is shown.

**Domoszló, Pályák with T3 (chains, congest 0,05):** 429,7 m (dist 152,5 · trunk 142,0 · drop 98,6 · ceil 36,6), 104
boxes, cable 3×1,5 303,2 m · 3×2,5 154,4 m; 24 socket links in chains, 10 leaders on door L4s; not stale after drawing.
Warnings 4: three door-box overfills (B32 ×2, B33) and **A4 (Háló dugalj) at 4,83 % voltage drop** — the chain
lengthens its longest branch to 28,5 m on 1,5 mm² / 13 A; the check proposes 2,5 mm² or a split (a real consequence of
Q5, for the user). Master suggestions: Garázs, Háló, Konyha / étkező, Veranda, Nagyszoba, Közlekedő — Garázs, Konyha
and Közlekedő pre-ticked (their door boxes overfill). None placed in the fixture.

---

## Part 9 — T4 built (2026-10-19): the Elosztó tray

`src/08of-wf-tray.js`, spec `tests/spec-104-tray.js` (11). Q4 = A: no modal on every link to the board — a small
fixed panel **⚡ Elosztóra vár: N** (shown in Villamosság, or with the betáp-fa), opened inline:
- **waiting** = an endpoint with no circuit whose up chain reaches the board — straight, through a door's L4, or
  through a master. No up = not yet waiting (it has not reached the board).
- **rows** = 08oa's circuit suggestion (E4, MATERIAL §6) cut to the waiting endpoints, pre-ticked; each row's target is
  the suggested new circuit or any existing one (the socket added to a room that already has its circuit).
- **Hozzárendel**: new circuits through `elpApply` and joins by `cktAssign`, in ONE undo step.
On Domoszló nothing waits (every endpoint has its circuit); the tray matters once the chain tool (T5) builds topology
before circuits.

---

## Part 10 — T5 built (2026-10-19): the chain tool

`src/08og-wf-chaintool.js` (⛓ Betáp-lánc, prefix `bfl` — `chn` is 05r's channel code), spec
`tests/spec-105-chaintool.js` (15). Q3 = A: **each click sets up = the previously clicked node** (rögzített); no revisits.
The first click, a click on a node already in this chain, on the board, a hub or a door (its L4 on the side clicked),
or Shift + click starts from there without linking — a branch is two nodes with the same up. A loop is refused with
upSet's reason and the chain keeps its place; every link is one undo step. The engine follows the drawn chain (T2):
drawn topology → ⚡ the tray gives it circuits (T4) → ⚒ Pályák fits it into the walls.

---

## Part 11 — T6 built (2026-10-19): drawn routes on links

Engine (plan.js §6–7) + `src/08oh-wf-via.js`, spec `tests/spec-106-via.js` (13). A node's `up.via` names one of the
user's own drawn paths (ARM / channel; never the engine's `gen:'bl'` output). For that link only, the wall-graph edges
lying along it (both ends within 200 mm of one of its segments) cost ×0,25 (`cfg.viaK`) — preferred, never forced, and
never through a ban (a ban has no edge). It works for a room run (the link's member in that circuit) and for a hub's
home run (gerinc). `R.report.via` lists every via with the share followed; below 90 %, or a via no longer in the plan,
warns; the 🔎 report has a "Rajzolt betáp-útvonalak" section. Setting it: the device menu "↝ Rajzolt pálya ehhez a
betáphoz" → click a path (the link becomes rögzített); the same menu takes it off.

**Browser pass (P33 converted plan, real clicks):** ⚒ Pályák draws 227 paths and fills 105 links; two sockets taken out of
their circuit show **⚡ Elosztóra vár: 2**; opening the tray and clicking Hozzárendel made A16 "Szoba dugalj" (2) and the
tray hid itself. The ⛓ chain tool: a click on L26 starts there; a click on K3 would put K3 under its own lamp — refused
with "Hurok: L26 már K3 alól kap betápot (L26 → K3b → K3 → B171)", the chain keeping its place. No console errors.

## The batch T2–T6, in one line each

| WP | Commit | What the user does now |
|---|---|---|
| T2 | `2c24af1` | nothing new — the engine follows whatever tree there is (auto, or drawn) |
| T3 | `931b0ad` | 📍 Vezető dugalj (one click) · ▣ Szobadoboz-javaslat (tick and place) |
| T4 | `e11ac36` | ⚡ Elosztóra vár: N — assign circuits to what reached the board, in one click |
| T5 | `007b39f` | ⛓ Betáp-lánc — click the source, then each node in order |
| T6 | this one | ↝ Rajzolt pálya ehhez a betáphoz — a drawn path for one link |

T7 (per-layer mark precedence) stays deferred until a second layer autoroutes.

**Q2 = A (user, 2026-10-19): the three szobadobozok placed** (Garázs @W30, Konyha / étkező @W21, Közlekedő @W28), in
`build-dom.js` before Pályák. Domoszló now: 451,5 m (dist 150,2 · trunk 155,3 · drop 98,6 · ceil 47,4), 105 boxes,
cable 3×1,5 355,4 m · 3×2,5 154,1 m. The masters do NOT remove the garage funnel — the garage is the board's own room,
so B32 still carries 11 pipes; the other door boxes ease (B33 off the overfill list). Warnings: X3 / X4 at B32, and A4.
Fixed on the way: a szobadoboz box was checked as a 2-gang box (6 pipes); it is the big box (≤ 12). Q1 (A4) still open.
A Planner copy with Domoszló baked in (finished · test run without routes · base) is built by
`_script/make-dom-preload.js` into the client folder — never in git.

**Q1 = A (user, 2026-10-19): A4 Háló dugalj on 2,5 mm²** (its 13 A breaker kept). The engine now honours a circuit's own
cross-section (05j `c.mm2`, the circuit form) before the breaker-text rule (E5 F5, partly). A4: NYM-J 3×2,5, Iz·k 18,4 A,
28,5 m, **2,9 %** ✓. Domoszló: 451,5 m, 105 boxes, cable 3×1,5 328,0 m · 3×2,5 181,5 m; warnings left: the two B32 door
boxes (7 / 8 pipes). Both open questions of the batch are answered.
