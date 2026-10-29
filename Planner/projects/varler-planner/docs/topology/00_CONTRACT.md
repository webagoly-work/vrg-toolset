# Topology View (TV): CONTRACT (r2, 2026-10-29)

*Short on purpose. These still apply:*
- *`docs/PRIMER.md` (read first);*
- *`GO-ROUTE.md` §3 (the thread's rules);*
- *`GO-WIRE.md` "Working rules";*
- *`docs/workflow/00_CONTRACT.md` (the approval-table and round conventions).*

*This file adds only what is particular to the Topology View.*

## 0. Where you work

- **The main checkout** `H:\cwebuser\projects\VRG-DE\Planner_VRG_U100`, branch `main` (GO MAIN), project folder
  `Planner/projects/varler-planner`. On a cloud session, use the branch the session gives you.
- `git status` before you start and before you report. Commit and push every development, with explicit paths (the
  user's rule since 2026-10-16).

```bash
export NODE_PATH=H:/Dev-VRG/VRG-DE/Planner_VRG_U100/Planner/projects/varler-planner/node_modules   # cloud: a scratch npm install
node build.js && node tools/check-globals.js && node tests/run.js
```

- **Baseline:** 110 suites, 3 736 checks, golden 70 / 70 (money-path audit, `fe0d23e`).
- **Specs:** a new spec takes the next free number at build time (`ls tests | sort -V`; 109 was the last at r2). Write
  the number into README §8.
- **Client data stays out of git** (GO ROUTE §3). Job codes are anonymised (`CLA`, `CLANV4`, HUB-Q10 B). The
  practice apartment `tools/practice/Gyakorlo_lakas_villany.vplan.json` is the in-git acceptance plan.

## 1. Rules of this pack

1. **The tree is GO WIRE's.**
   - The view reads and writes `d.up`, `d.lead`, `lamp.meet`, `sw.ctl` / `grp` / `swHead` and the circuits **only
     through the existing functions** (README §7).
   - It never writes `d.up` directly. It never adds a second topology store.
   - A need the existing functions do not cover gets a new function in the module that owns the data, and that is
     named in the report.
2. **One engine.**
   - The Csövek tab and the playback show **`BL_LAST`**: the engine's run on the current level.
   - The view never routes, packs or sizes on its own.
   - When `blStale(level) > 0`, the tab says `'elavult — futtasd újra: ⚒ Pályák'` and dims the overlay. It does not
     recompute silently.
3. **A plugin, not a fork.**
   - Everything new lives in `08t…08td` and reaches the app through the existing seams: `registerActions`
     (05c-actions.js:25), `PH_LIST` (05db-layout.js:25), `STK_DEVMENU`, `STK_CHECKS`, `STK_OVERLAY`, `openModal`
     (09-menus.js:103).
   - A hook in a shared file is one guarded line (`typeof tpoX === 'function'`; `window.X` for consts).
   - Deleting the `08t*` files leaves a working Planner.
4. **Engine changes are G-items, not TV work.**
   - Anything in `tools/baseline` belongs to `02_ENGINE_GAPS.md` and is built under GO ROUTE: pure Node, no `fs`, no
     DOM, CLI ↔ bundle parity (spec-98).
   - A TV WP that would need one stops and names the G-item.
5. **Every automatic step ends in a table** (`tpoTable` on the `elpDialog` pattern, 08oa:114). Every user action is one
   undo step.
6. **Hungarian UI, English code.**
   - The strings in `01_RULES.md` §7 are final unless marked ⚑.
   - HU switch codes are never renumbered (105 / 106 / 107 / 108).
   - Every open question goes to the user as numbered A/B/C options.
7. **Names:**
   - prefix `tpo` for globals (free at r2; `tv` is too short to grep safely);
   - the derived helpers `tvKind`, `tvPattern`, `tvGroups`, `tvCheck` are the exception and live in `08ta`.
   - `node tools/check-globals.js` stays OK.

## 2. Module files (filename order = load order: after `08s-villany.js`, before `09-menus.js`)

| File | Owns | WPs |
|---|---|---|
| `src/08t-tpo-graph.js` | GP (the contraction of `BL.network` onto anchors), unreachable, the overlay of `BL_LAST` onto GP | TV1, TV9 |
| `src/08ta-tpo-model.js` | `tvKind`, `tvPattern`, `tvGroups`, `tvCheck` (CK-8 … CK-13, `upCheck` reused), `tpoTable`, the suggest-and-accept | TV3, TV8 |
| `src/08tb-tpo-view.js` | the overlay shell, the layout, the SVG render, the mini-plan, the playback | TV0, TV2, TV11 |
| `src/08tc-tpo-edit.js` | the Körkészlet panel and the canvas tools: Betáp, Master, Lánc, Kapcsolás, KD role | TV4–TV7 |
| `src/08td-tpo-share.js` | runs, pipes per stretch, box fill, departures, the share table, all from `BL_LAST.R` | TV10 |

`08t`, `08ta` and `08td` (without their DOM parts) must run under the jsdom spec harness with no `draw()`.

## 3. Data (no `SCHEMA_VERSION` bump, no new collection)

| Where | Field | WP | Default | Note |
|---|---|---|---|---|
| device (junction: `jb` kot / szoba / ceiling) | **`tpoRole: 'pref' \| 'must'`** | TV5 | none = pass-through | the only new field in Wave B. The engine reads it from G4 on; before that, CK-13 notes it as `'a motor még nem követi (G4)'` |
| circuit (`data.circuits[]`) | `ownPipe: true` | TV5 | `false` | the V1 string's own conduit; read by the engine from G2 on |
| — | `d.up`, `d.lead`, `lamp.meet`, `sw.ctl`, `grp`, `swHead` | TV5–TV8 | — | **existing**, written only through their functions |
| `state` | `tpo: {open, tab:'path' \| 'tree' \| 'pipes', level, cur, tool, z, px, py, speed, mirror}` | TV0 | closed, `'path'` | session UI state; not in the document |

- **Old files** load, render and route exactly as before. No golden fixture has `tpoRole` or `ownPipe`.
- `blInput`'s stale signature already includes the tree (GO WIRE T2). G2 / G4 add `ownPipe` / `tpoRole` to it when they
  start reading them.

## 4. Golden and quantity policy

- **TV0–TV11: identical.** The view is an overlay outside `draw()`. GO WIRE's `STK_OVERLAY` 🌳 drawing is not touched.
- **G-items:**
  - may change engine output only where their rule says so;
  - each lists the changed metres on the practice flat;
  - the practice-flat **quantity golden** (money-path audit §7.8) is the net. If it does not exist when the first
    G-item starts, that G-item adds it first.
- PRIMER §2 holds: goldens never call `draw()`. The view, tools and playback need the browser, with a screenshot in the
  report.

## 5. Report

Use the PRIMER / R1010 §7 format, plus four lines:
- **"Hooks in shared files:"**: file:line each, or "none".
- **"Rules covered:"**: `01_RULES.md` ids.
- **"Writes through:"**: the existing functions this WP calls to change data (`upSet`, `ldSetLeader`, …).
- **"Engine gaps touched:"**: the G-items the WP's features wait for, or "none".
