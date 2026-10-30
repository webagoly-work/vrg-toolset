# GO PLANNER — the open Planner work (everything except wiring)

*You were started with the codephrase **GO PLANNER**. This file is the whole briefing; it does not depend
on any memory note, so it works from any Claude account on this PC. It replaces GO R1010, GO R1018, GO FRAME
and GO SUI (2026-10-30, originals in `docs/go-archive/`). Wiring and routing are in **GO ROUTE**.*

## 1. Where

- The main checkout `H:\VRG\Full\Planner_VRG_U100`, branch **`main`**, project folder
  `Planner\projects\varler-planner`. Confirm with `git rev-parse --show-toplevel`.
- `git status` first. One session at a time in this checkout; if another is building, tell the user.
- Never commit unasked, never push, never switch branch. Explicit paths only, never `git add -A`.

## 2. Read first

1. `docs/PRIMER.md`: the build/test loop, the golden renders, the traps.
2. Only the pack of the item you pick (§3).

Build and test: `node build.js`, then `node tests/run.js` (the runner does not build). Baseline 2026-10-30:
116 suites, 3 854 checks, golden 70/70 byte-identical. `node tools/check-globals.js` after adding names (one shared
global scope, files concatenated in order). Browser check: `.claude/launch.json`, config `planner-main-serve`
(port 8132) → `/Planner/projects/varler-planner/dist/varler_planner.html`.

## 3. Open (ask the user which first)

| # | Item | State | Waits on | Pack |
|---|---|---|---|---|
| 1 | **Simple-UI S6 look** | S0–S4 + S6 built and merged 2026-10-30, off by default (F2 toggles) | the user's look at `docs/simple-ui/fig/s6-*.jpg` and in the app, then S5, S7 | `docs/simple-ui/` README → 00_CONTRACT → the WP |
| 2 | Simple-UI: place the newer actions | `other` holds 162 of the actions (spec limit raised from 150 to 170); T0–T6, Födém etc. added some | with S5 | `src/11u-sm-tree.js`, `tests/spec-s3-sm-tree.js` |
| 3 | **C6 Mozi fal pen feel** | built; at low zoom a drag misses the faces (~10 px per wall thickness) | the user's report from a real room; do not change the pen before it | `docs/round-2026-10-18/` |
| 4 | **G2 wall refine** | dry run shown, `wrfPlan` built; apply + dialog wait | the user | `docs/round-2026-10-10/` README §4 |
| 5 | M1 print patterns | owed: print patterns on route strokes | — | `docs/round-2026-10-10/` |
| 6 | **CLA-ADD-001 extras** | not packed: bathroom touch buttons, IP display, provisioned terminal points, lábfény, floor heating, island extractor, research items, BRIDGE SECURITY | ask its §2 questions, then pack; do not build in the same go | `docs/round-2026-10-10/NEXT-CLA-ADD-001_cla-extras.md` |
| 7 | SmartFrame Planner pack | concept done (`docs/stack/IDEA-003_smartframe.md`), portals built | goes into `docs/round-cla-add-001/` with item 6 | `NEXT-CLA-ADD-001-SF_smartframe-brief.md` §8 |
| 8 | Views | V1–V9c built; D-V9-6 state to confirm | the user | `docs/views/` |
| 9 | Workflow round | E6 Alosztó built; E6-Q1…Q4 open | the user | `docs/workflow/` |

Other packs with their own status tables: `docs/round-2026-10-22-villany/`, `docs/ui-tidy/`, `docs/mcp/`.

## 4. Rules the user cares about

- Hungarian UI, English code. Phase big work, stop at every ⏸.
- HU switch codes are never renumbered: 105 csillár · 106 váltó · 107 kereszt · 108 dupla váltó.
- Legible sheets: no overlapping labels (`tools/baseline/labels.js`).
- Every open question goes in the reply as numbered A/B/C options, A recommended.
- A SUI-side note: the chapter was built by the secondary account (start steps in `GO-MAIN.md`).
