# GO WIRE — pick-up prompt: the wireway routing rebuild (dual model, K1)

Paste this into a new Claude Code session (working directory `H:\Dev-VRG\VRG-DE\wt-planner-stack`).

---

We continue the Planner's wireway-routing work where the previous session stopped (2026-10-18). Read these first,
in this order, before any work:

1. `Planner/projects/varler-planner/docs/workflow/WIREWAY_AUDIT_2026-10-18.md` — **the whole file.** It covers:
   - Part 1: lessons from building the Domoszló plan with the workflow;
   - Part 2: the red-team audit (findings F1–F13);
   - Part 3: the merged top-10 fixes;
   - Part 4: my dual routing model, reviewed. Configurations K0–K3, the data model with the new `up` field, guard
     rails, build order T0–T7.
2. `Planner/projects/varler-planner/docs/PRIMER.md`, then `docs/workflow/README.md` and `docs/workflow/E5_ENGINE_REVIEW.md`.
3. `Planner/projects/varler-planner/tools/baseline/README.md` — the engine's rules. The engine is pure Node and is
   bundled into the HTML by `build.js`; the glue is `src/08ob-wf-engine.js`.

## Where we are

- **Worktree:** `H:\Dev-VRG\VRG-DE\wt-planner-stack`, branch `planner-stack`, head `85b81f1` or later (the commit that added this file), pushed.
- **`main`** (`H:\Dev-VRG\VRG-DE\Planner_VRG_U100`) is at `c421d4e`. That is the 2026-10-16 working version; START.cmd
  tool 1 opens it. Merge into `main` only when I ask for a new working version.
- **Nothing of T0–T7 is built yet.** Only docs were committed after `c421d4e`.

## My decisions (approved 2026-10-18 — all A)

| | Decision | Answer |
|---|---|---|
| Q1 | Base configuration | **K1 "Szobadoboz-mester"**, with the `up` field (`{id, via?, fix?}` on every node) stored from day one |
| Q2 | Flow lines | **No free directional flow lines.** Instead a third mark strength, **"előnyben"** (preferred): ×0.5 cost, no direction, may overlap or go unused; the report shows whether it was used |
| Q3 | Group Order | **Each click sets `up` = the previously clicked node.** No revisits; a branch = two nodes with the same `up`; default order from `rgChain` (05v) |
| Q4 | Elosztó prompt | **A non-blocking "Elosztóra vár: N" tray** with batch assignment, defaulting to the matching circuit suggestion (08oa). No modal |
| Q5 | Socket topology | **The classic chain from the leader socket** (the rule already written in `src/08n-wf-boxes.js:11`), not the engine's star from the door |

Still a default, not a decision: grouping stays **per pipe** (E5-Q10 = A). The report must show the per-chase figure
next to it, with a ⚑ to confirm against MSZ HD 60364-5-52 (audit F7).

## The work — build order (audit §4.7)

| WP | Phase | Content | Effort |
|---|---|---|---|
| **T0** | Pályák | the top-10 fixes, listed below | S–M |
| T1 | Villamosság | the `up` field, auto-fill from today's logic, invariants (one upstream, no loops), dashed "javasolt" / solid "rögzített" states | M |
| T2 | Pályák | the engine fits a FIXED tree (only each link's path in the wall graph is searched, stable order, light congestion term); szobadoboz = room feed (master); reads `lamp.meet`; `blInput` keeps user `D.paths` (gen ≠ 'bl') | M |
| T3 | Villamosság | master suggestion per room (dashed); the leader-socket click; `rgChain` default order | S–M |
| T4 | Villamosság | the Elosztó tray + circuit checklist binding | S–M |
| T5 | Villamosság | the chain tool (Group Order, no revisits) | M |
| T6 | Pályák | drawn routes (`up.via` = ARM / channel path / cline) as preferred fits (×0.25, never through a ban), with a deviation report | M |
| T7 | Szabályok | per-layer mark precedence — **deferred** until a second layer autoroutes | M–L |

**T0 content, in this order:**
1. Geometric lengths in `leg.len`, spans and cable metres; the weights are for search only (F1, plan.js:289/:348).
2. An error for every circuit member with no leg, off-wall, or outside all rooms (F2).
3. Wire the R3 marks into the engine per face (side → face). Ban marks (`pol:'ban'`: tilos, gáz, kémény, vizes,
   padlófűtés, strang) = no edge. Minus marks = ×2. Előnyben = ×0.5. Unmarked = ×4 and only as a fallback, also for
   distribution (F3, F6; geom.js:57, network.js:128).
4. Door latch from `door.variant` / `ptSlots`, one slot table shared by engine and Planner (F4, prep.js:70-72).
5. Fix the `wallsOf` midpoint (F5, plan.js:227); every warning carries the room name and a "mutasd" link.
6. The Pálya-ellenőrzés report (audit §3.4) + a stale flag; errors block "Felrajzolás" unless confirmed.
7. Order-independent drop grouping (sort, then sweep — plan.js:35); input validation: height > ceiling − box,
   duplicate refs, snap / merge notices.

**⏸ Checkpoints:** after T0 and before T2, show me the Domoszló diff (legs, boxes, metres, warnings) and wait.

## Test fixtures and tools (client data — never in git, never off this machine)

All under `H:\Dev-VRG\VRG-DE\Planner_projektek_2026-10-16\`:

- `Domoszlo_alap.vplan.json` — the base: walls, floors, openings.
- `Domoszlo_erosaram_2026-10-18\`:
  - `Domoszlo_erosaram_claude.vplan.json` — the full Erősáram plan, the acceptance fixture;
  - `DOMOSZLO_TERV.md` — its logic;
  - `falnezetek\` — 20 elevations;
  - `build-report.json`.
- `_script\` in the same folder:
  - `build-dom.js <dist.html> <alap.vplan.json> <outDir>` rebuilds the whole plan through the workflow functions, so
    it is the end-to-end regression;
  - `elev.js` renders every room face's elevation to PNG;
  - `win.js` counts window crossings;
  - `inspect.js`, `chk.js`, `imp.js` check the plan (`imp.js` through Fájl import);
  - `cdp-shot.js` takes headless Edge screenshots.
- `_redteam\` in the same folder — the red team's perturbation scripts (`h.js` loader, `t1`–`t13.js`). Re-run them
  after T0: each finding should flip from silent to reported or fixed.
- CLA v1: `Calculator/CLA-baseline/v1_2026-10-12/` (untracked). `tests/spec-98` uses it for CLI ↔ Planner parity
  (167/167 legs).

## Working rules (the standing ones)

- **Run node from the project folder.** Tests need
  `NODE_PATH=H:\Dev-VRG\VRG-DE\Planner_VRG_U100\Planner\projects\varler-planner\node_modules` (the worktree has no
  node_modules).
  - Build: `node build.js`.
  - All suites: `node tests/run.js`. Baseline before T0: 94 suites, 3290 checks, golden 70/70.
  - **The golden renders stay identical unless a change is intended.**
- **Commit and push every development as standard** (my rule since 2026-10-16).
  - Explicit paths; never `git add -A`; never a bare `git stash`.
  - End commit messages with the Co-Authored-By line.
- **Never commit** `apps/`, `home/`, `data/`, `*.pdf`, `Vendor/`, or client data. Never make `H:\` a repository.
- **Text and naming:**
  - Hungarian UI, English code.
  - HU switch codes are never renumbered: 105 csillár, 106 váltó, 107 kereszt, 108 dupla váltó.
  - Legible sheets: no overlapping labels (`tools/baseline/labels.js`).
- **Every open question goes into the reply as numbered A/B/C options.**
- **`.cmd` files** are CRLF with ASCII console output. If a tool moves, update START.cmd and run `node tools/check-start.js`.

## Also open (not this thread)

- My own Domoszló version, to compare with Claude's in the elevations.
- CLA acceptance step B: I redraw CLA with the workflow tools.
- E6-Q2 left at its default.
- The parallel Simplified-UI session (`docs/simple-ui`).

Start with: read the files above, confirm the plan in 5–10 lines, then build T0 item by item (tests after each),
commit and push, and stop at the T0 ⏸ checkpoint with the Domoszló diff.
