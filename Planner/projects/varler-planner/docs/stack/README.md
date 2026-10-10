# BRIDGE Stack — build pack for the Planner

**What this is.** The 2026-10-06 dev draft (layer rework + BRIDGE Stack, phases 1–2) turned into
**22 small work packages (WPs)** that a cheaper model can build one at a time with little context,
and a stronger model can verify. The expensive thinking — order, data model, algorithms, edge cases,
test values — is done here once, so each build session reads ~2 short files instead of the codebase.

| file | read by | what |
|---|---|---|
| `00_CONTRACT.md` | every builder and verifier | where to work, commands, the single-scope rule, all data additions, conventions, report format |
| `01_CATALOGUES.md` | the WPs that name a section | every data table as paste-ready JS (tags, codes, cables, conduits, RF, rules) |
| `WP-*.md` | one builder each | goal (your words), files to read, functions, anchors, UI strings, tests, verifier focus |
| `PLANNER-STACK-Q-001.json` | you | 41 decisions with defaults, in the BRIDGE tuner's pack format |
| `PROMPTS.md` | you | the short prompts: read-all-first, build, verify, resolve, status |
| `../../tools/check-globals.js` | builders, verifiers | duplicate global names + syntax check over `src/` (written and tested 2026-10-06) |

---

## How to run it

1. **Answer the decisions** (optional — every WP carries a default). Load `PLANNER-STACK-Q-001.json`
   into the BRIDGE tuner (*Load pack → paste*), answer, paste the `Q=key ~ note` lines back with the
   **RESOLVE** prompt. Only answers that differ from the default change anything.
2. **Set up once** — the worktree on branch `planner-stack` from `planner-circuit-endpoints`
   (`00_CONTRACT.md §0`). WP-A1's builder does this.
3. **Per WP, in order:** a fresh session with the **BUILD** prompt → a fresh session with the
   **VERIFY** prompt → the verifier sets the status below to `verified`.
4. **Stop at every ⏸** and try it in the browser yourself before the next wave — those are the points
   where a design call, not code, decides whether the next wave is right.

Suggested model and effort per session (set both in the session's model picker before the prompt):

| session | model | effort |
|---|---|---|
| BUILD A2 A3 B3 B4 B5 C1–C5 D1 D2 D4 E1 E5 | Sonnet 5.5 | medium |
| BUILD A1 B1 (shared plumbing: undo, render, pointer hooks) · B2 D3 (large) | Sonnet 5.5 | high |
| BUILD E3 E4 (the fill — the physics rules live here) | Opus 5.5 | high |
| BUILD E2 (pure algorithms, exact tests) | Haiku 4.5 (no effort setting) — Sonnet 5.5 low if it struggles |
| VERIFY every WP | Opus 5.5 | high — its default is medium, set it |
| VERIFY A1 B1 E3 E4 | Opus 5.5 | xhigh |
| ⏸ checkpoint review of a whole wave | Opus 5.5 high · once after wave E: Fable 5.1 medium |
| RESOLVE · STATUS | Sonnet 5.5 | medium · low |

Move a WP's builder up one step when its verifier had to fix more than a couple of things — cost per
finished WP is what counts, not per session.

## Order, dependencies, status

| WP | title | depends | size | status |
|---|---|---|---|---|
| A1 | Layer model v2 + schema seed | — | M | verified — 2026-10-06 — 58c3ecc · 1 fix (active layer after undo) · follow-ups: whiteout walls + Wall View notes ignore opacity |
| A2 | Layer panel: vertical sub-layers, opacity, swap/move | A1 | M | built — 2026-10-06 — 552148c |
| A3 | Duplicate, merge, link, lock | A2 | M | built — 2026-10-06 — 552148c |
| ⏸ | **checkpoint — use the new layer panel on NV4 / P33** | | | |
| B1 | Stack model, wizard, panel group, stage rail, shared hooks | A3 | L | built — 2026-10-07 — d5cbf43 |
| B2 | Marks: walls, sides, vertical/horizontal strips | B1 | L | built — 2026-10-07 — fc5e894 |
| B3 | Marks: doors, windows, floor/ceiling strips and zones | B2 | M | built — 2026-10-07 — fc5e894 |
| B4 | Movement traces: 45° line, freehand, smoothed, door snap | B3 | M | built — 2026-10-07 — f40abfe |
| B5 | Portal graph: line of sight, 500 mm encoding, heatmap | B4 | M | built — 2026-10-07 — f40abfe |
| ⏸ | **checkpoint — mark one real floor; do the tags feel right?** | | | |
| C1 | Hardware nodes: RBX, board, meter, entry, SSC | B2 | M | built + verified — 2026-10-07 — ce1413e (spec-40) |
| C2 | RBX room serving + coverage ghost | C1 | M | built + verified — 2026-10-07 — ce1413e (spec-40) |
| C3 | RF multi-wall model + RF view | C2 | M | built + verified — 2026-10-07 — ce1413e (spec-42) |
| C4 | BASE placement + guideline highlights | C1 | S–M | built + verified — 2026-10-07 — ce1413e (spec-40) |
| C5 | Channel routes between hardware nodes | C1, C4 | M | built + verified — 2026-10-07 — ce1413e (spec-44) |
| ⏸ | **checkpoint — phase 1 of a stack end to end** | | | |
| D1 | Endpoint catalogue (BRIDGE codes) | B1 | M | built + verified — 2026-10-07 — 7d04549 (spec-45) |
| D2 | Room needs checklists | D1, B3 | M | built + verified — 2026-10-07 — 7d04549 (spec-46) |
| D3 | Placement suggestions | D1, D2, B5, (C3) | L | built + verified — 2026-10-07 — 7d04549 (spec-46) |
| D4 | Circuits + control groups in the stack | D1 | M | built + verified — 2026-10-07 — 7d04549 (spec-45) |
| ⏸ | **checkpoint — fill one room layer by layer** | | | |
| E1 | Stack view + ARM routes | C5, D1 | M | built + verified — 2026-10-07 — 96cd797 (spec-49) |
| E2 | Route graph: Dijkstra · chain · Steiner (KMB) | E1 | M | built + verified — 2026-10-07 — 96cd797 (spec-50) |
| E3 | Auto-fill: runs, pipes, sizing | E2, D4, D2 | L | built + verified — 2026-10-07 — 96cd797 (spec-51) |
| ⏸ | **checkpoint — compare a filled room with your own hand count** | | | |
| E4 | Channel fill: bundle, RBX feeds, trunks | E3, C5 | M | built + verified — 2026-10-07 — 96cd797 (spec-52) |
| E5 | Elosztószekrény: ways, RCBO, modules, phases | E4, D4 | M | built + verified — 2026-10-07 — 96cd797 (spec-53) |

Built: 13 new modules (`05l`…`05x`, 3 568 dense lines) + 19 spec files; 6 073 lines added over
`src/` + `tests/` against `planner-circuit-endpoints`. Suite: 48 suites, 2 029 assertions, golden
70/70. The golden hashes were re-baselined once (f140380): the 36 diffs were the six fixtures' six
drawing renders, changed by the page-scale work already on the base branch, not by the stack.
`spec-54-stack-e2e` builds one apartment through every phase (hardware → channel → endpoints →
ARM → fill → cabinet) and times `draw()`.

From C1 on, the WPs were built in the main session instead of by cheaper builders, and the whole
stack was then reviewed as one piece. What that review changed in code that existed before:

- path ids: `finishPath` and the parallel-path copy issued timestamp ids, which collide when two
  paths finish in the same millisecond → both now take `data.seq` ids (`ensureIds`, `copyRecord`).
- a tool flag (channel / ARM / endpoint) leaked onto the next ordinary path → `setMode` emits a
  `mode` tool event and every stack tool resets on it.
- the stage rail's checks and the status-bar validation were cached across model changes (stale
  ticks in spec-17/18) → keyed on `shellModelKey()`; an explicit `renderShell()` recomputes.
- deleting a layer and changing a stack's phase were not undoable → both push undo.

---

## Your draft → where each part lives

| draft | WP |
|---|---|
| sub-layer buttons vertical, room next to each | A2 |
| RCO / hold-and-drag a sub-layer onto another layer, the two swap | A2 |
| two 10 % buttons + hide/visible per sub-layer | A1 (model, render) · A2 (buttons) |
| new sub-layers: path, dugaljak, kapcsolók, lámpák, eszközök, walls, doors, lépcsők, tárgyak | A1 (+ ablakok and six optional rows, Q02) |
| Photoshop: duplicate, link, merge | A3 (+ lock, Q07) |
| layer-by-layer work; parallel paths on different layers don't get confused | B1 (stack) · E3 (same route, separate pipes) |
| new BRIDGE Stack; existing layers can take a stack role; several can merge into the base | B1 |
| constructional layer: floor, walls, doors, windows, rooms | B1 (Szerkezet role + checks) |
| marking: wall tags, +/− on walls and sides, L-shape, TV wall | B2 |
| tool cycle wall → side → vertical zone → horizontal zone; RCO extend to whole room | B2 |
| zone tags (Elosztó, BASE, RBX locations; night/leg light bands) | B2 (`vstrip` / `hstrip` tags) |
| door marks: entrance, portal, unused, others | B3 |
| window marks — suggestions | B3 + Q19 |
| floor/ceiling strips | B3 |
| 45° lines in 100 mm steps, freehand, smoothed freehand | B4 |
| traces near a door attach to it | B4 |
| doors encoded by relative distance, position, frame angle; traces on a 500 mm grid; line of sight between doors of the same room | B5 |
| rectangles and circles for corridors, dwells, water areas | B3 |
| hardware: Elosztószekrény, data entry, mérőóra, RBX on marked wall sections | C1 |
| ghost with a visual field from each side; direct coverage; RCO to add rooms; every room needs an RBX | C2 |
| wireless cloud toggle | C2 + C3 |
| BASE: units separately or as one; guideline highlights | C4 |
| channel topology: path-tool variant between hardware nodes, multiple routes allowed, flush / trunking rule | C5 |
| per-room, per-layer checklists with sensible ticks; ≥ 1 device per ticked type = done | D2 |
| suggested placements from phase 1 (points and strips) | D3 |
| RF layer with per-technology toggles, pale zones, faint outline | C3 |
| SECURITY last | B1 role order · D1 (`from:'ssc'`, never into a RoomBox) |
| devices as path end points with a dedicated circuit; socket strings; switch–lamp logic | D4 (+ Q29: in BRIDGE the switch is an input, not a wire to the lamp) |
| draw on the stack as one layer; one-line paths branching from the RBX to every endpoint | E1 |
| "there is a word for that algorithm" | E2 — **Steiner tree** (minimum tree through a given network), next to **home runs** (shortest-path tree) and **daisy chains** |
| auto-fill wireway + cable per layer per room | E3 |
| RCO on a finished RBX fills the hardware channel | E4 |
| Elosztószekrény module count, RCD type, MCB, overvoltage | E5 |
| phase 3: export formats | not in this pack — every derived result is already a pure JSON function (`prtGraph`, `needReport`, `afillReport`, `eloSchedule`) so phase 3 is formatters only |

---

## Found while preparing this — worth knowing before building

1. **The live Planner code is not on `main`.** It is on `planner-circuit-endpoints` (2 commits ahead,
   unmerged: circuits, auto-clip, auto-link, id repair). The pack builds on that branch, in a worktree,
   because the main checkout holds other sessions' uncommitted BRIDGE edits.
2. **A gap in STD-001** (Q37): the CHANNEL bundle sizes are fixed (C1 M25 = two Cat6A at 40 %), but a
   chained RoomBox passes downstream rooms' uplinks through. The standard does not say what the
   upstream bundle carries. Default: warn, never upsize silently.
3. **STD-001 and A2 read differently on room-circuit feeds** (Q38): "M25 per circuit group" vs "two
   S04 circuits → M32". Default packing satisfies both.
4. **NV4's switch–lamp wiring does not apply in a BRIDGE stack** (Q29): the switch is an input to the
   RoomBox bistable and each lamp group an output, so there is no switch-to-lamp cable. The 101/105
   schemes stay with the conventional wiring pipeline (slice S6).
5. **Six type codes are missing from STD-004** (Q36): DED, ETH, SCR, AVP, USB, SEC.
6. **Your 300 mm strip is the DIN 18015-3 installation-zone width** — the standard zones are offered as
   tags (`zona_v`, `zona_f`), so the marking layer can start from the norm.
7. **Undo had to be designed carefully:** layers become undoable only for layer operations; otherwise
   undoing a device move would also undo a visibility toggle made after it.
8. **Acceptance anchored to a real design:** E5's test reproduces P33's settled cabinet (24 ways,
   29 modules single-phase, 34 three-phase).
9. **STD-001's fixed C1 size meets A2 only up to 10 m** (found while building E4): C1 M25 with two
   Cat6A is 34 %; A2 §1 allows 40 %, but only 33 % on a run over 10 m. The fill keeps STD-001's
   size and raises an info (`chn.long`) on such a channel, never a warning, never an upsize.
   A single cable in its fixed pipe is judged by the 1.4 × OD rule, so a lone bus-B pair in M20 is
   not an overfill.
10. **One owner per room.** Two RoomBoxes with an equal claim on a room (both face it, no manual
    assignment) are an error in the Hardver checks; the lower id serves it until you assign one.

## After the pack — test plans and the routing workshop (2026-10-09)

- **P33 test plans**, generated through the Planner's own functions by `tools/testplans/p33-teszt.js`
  (v1) and `p33-teszt-v2.js` (v2), into `Calculator/P33-teszt_v1.vplan.json` and `_v2`.
  - **v1:** P33 turned 180° with the remodel applied; hardware nodes, the golden path (CHANNEL lane +
    230 V lane), the client's new endpoints only, circuits, and a portal box per door.
  - **v2:** v1 plus every higher layer at ideal positions, and spine T-boxes; it clears every room-needs
    checklist.
  - `tools/testplans/render-plan.js` draws a labelled review sheet of either.
- **WORKSHOP-001_routing.md:** layer selection without ghost wireways (build with B, select with A,
  provision on purpose), wall / floor / mixed route types, the draft rulebook. **Answered 2026-10-09**
  (§7): switches at 1100 with a smart band at 1300, mixed routing by default, ceiling as a third type,
  partitioned boxes wherever families meet.
- **IDEA-001_cluster-flush-boxes.md:** cluster points and flush-box sizing, for a later round.
- **IDEA-002_flush-cover-standard.md** + `FLUSH-COVERS-001.json`: the product half of IDEA-001 — the
  two size ladders (83 mm device / 100 mm hatch), real products per zone, the three cluster classes
  K1–K3, and the vendor channel with in-person pickup per vendor. Side research, 2026-10-09;
  answered the same day (§10): two-tier covers, Chorus ONE for clusters, a second hatch supplier.

## SmartFrame, clusters and ideal spots (built 2026-10-10, GO FRAME)

Concept: [IDEA-003](IDEA-003_smartframe.md). Built on request in the same session, outside the WP pack:

| what | where | in short |
|---|---|---|
| Portal | `src/06a-portals.js` | hardware type `portal` on a door face; ⌘K *Portál elhelyezése*, *Portálok a jelölt ajtókhoz*; right-click: class, tier, side |
| Silver Rail | `src/06a-portals.js` | `route:'rail'`, the Path tool with a flag (like the channel); ⌘K *Ezüst sín* |
| cluster boxes | `src/06b-clusters.js` | type `cluster` K1/K2/K3 on the new **Klaszterpontok** layer; ⌘K *Klaszterdoboz elhelyezése*, *Klaszterek a végpontokból* |
| ideal spots | `src/06b-clusters.js`, ✦ in `05l` | every stack layer's ideal places as dashed ghosts; right-click one to place it; ⌘K *Ideális helyek: minden réteg* |
| device list | `src/06b-clusters.js` | right-click a Portal / RBX / box / BASE on a system layer, or a custom point on a higher layer → one-click list |
| secondary boxes | `EP_PLACED` hook in `05s` | a higher-layer endpoint on a custom spot opens a dashed K1 box; the next one beside it joins it |
| Extrák layer | `XTR_CAT` in `06b` | the top role `sys:EXTRA`: P33-ADD-001 #1–#11 and the SmartFrame slots as provisioned endpoints |
| preloaded build | `tools/make-preload.js` | `dist/varler_planner_P33.html`: P33 v1 + v2 with only the Elosztó placed, ceiling 2850 |

Tests: `spec-66-portals-clusters.js`; spec-35 / 54 count the two new roles. The fill (E3/E4) does not read rails or
hosts yet — a later round decides how a Portal-served endpoint is filled (`from:'frame'`, IDEA-003 §8 P-5).

## Session brief — the step-by-step build session (2026-10-06 → 10-07, closed 2026-10-10)

A session built the pack one work package at a time (A1 → B5, the user committing after each pair).
It was cut off by an app quit while B4/B5 were still uncommitted — and on re-check it was **superseded,
not lost**: the worktree is shared, so another session committed the same files (`f40abfe`), then built
C1–E5 itself (`ce1413e`, `7d04549`, `96cd797`), reviewed the stack (`3e0c0d2`) and ran the 10-09 visual
round. Specs 36–39 (marks, openings, traces, portal graph: 93 / 95 / 80 / 64) still pass on the current branch.

- **What that session built:** A1 `58c3ecc` (layer model v2; verifier fix: active layer after undo) · A2/A3 `552148c`
  (panel, swap/move, duplicate/merge/link/lock) · B1 `d5cbf43` (stack model, wizard, rail, shared `STK_*` hooks) ·
  B2/B3 `fc5e894` (marks, door/window tags, plane strips and zones) · B4/B5 `f40abfe` (traces, portal graph).
- **Findings worth keeping:**
  - The WP-B1 claim "golden identical" was wrong: building rooms getting `Y` ids moves `data.seq`, so the six
    `/session` golden hashes changed (patched surgically, once).
  - `stkHookSvg(list, arg)` passes the view's own scales to `STK_WV` / `STK_PV`.
  - The Escape handler in `08-interaction.js` calls `stkToolEvent('esc')` **after** `closeModal()` — a finishing
    trace opens its own dialog.
  - Pointer release must use its own position (a touch tap sends no move event).
  - The marking tools switch themselves off when `state.mode` leaves `select` (no `setMode` edit).
  - The marks align in the normal and blueprint plan views (looked at in the browser pane).
- **Still open (yours):** the ⏸ checkpoints on a real floor — do the tags feel right, freehand and 45° drawing
  feel, heat-map tint.

## Follow-ups (not in this pack)
F1 phase-3 exporters · F2 conventional switch schemes (wiring pipeline S6) · F3 12 V / 24 V separate
conduits (A2 rule not modelled) · F4 bend counting for the 33 % rule · F5 undo for building-model rooms ·
F6 auto-placing a kötődoboz at a branch node · F7 STD-005 channel plan checks · F8 conduit labels and
wire codes (wiring pipeline S8).

## Glossary
**RCO** right-click option · **RBX** RoomBox · **BASE** NET + COMP + MEDIA · **CHANNEL** the BASE→RBX
bundle C1…C5 · **ARM** a route from an RBX to endpoints (`R03.A2`) · **role** what a stack layer is for ·
**run** one cable pull between two terminals · **leg** one piece of a chain run · **pipe** one conduit,
always box to box · **family** conduit family (MAINS, LV, BUSB, CONTROL, DATA, KNX, SENSOR, MEDIA, USB,
SECURITY) — families never share a pipe · **carrier** what a channel route carries, from its end types.
