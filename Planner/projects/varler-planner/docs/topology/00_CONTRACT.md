# Topology View (TPO): CONTRACT

*Short on purpose. `docs/PRIMER.md` (read first), `docs/workflow/00_CONTRACT.md` and `docs/round-2026-10-10/00_CONTRACT.md`
§0–§1 and §7 still apply: the worktree check, NODE_PATH, the build → check → test loop and the report format. This file
only adds what is different.*

## 0. Where you work

`H:/VRG/Backup/archive/parked/2026-10-24/wt-planner-stack/Planner/projects/varler-planner` on the branch the user names. For a cloud session,
that is the designated `claude/…` branch.
- Run `git status` before you start and before you report. Other sessions may share the worktree.
- Commit with explicit paths only, and only when the user says so.

```bash
export NODE_PATH=H:/VRG/Full/Planner_VRG_U100/Planner/projects/varler-planner/node_modules
node build.js && node tools/check-globals.js && node tests/run.js
```

New spec files take the **next free number at build time** (`ls tests/spec-*`; 99 was the last at writing). Write the
number into README §8.

## 1. Rules of this pack

1. **A plugin, not a fork.**
   - Everything lives in the new modules below and reaches the app through the existing seams: `registerActions`
     (05c-actions.js:25), `STK_CHECKS`, `STK_DEVMENU`, the phase bar `PH_LIST` (05db-layout.js:25) and `openModal`
     (09-menus.js:103).
   - Shared files get **one-line hooks** at most, each listed in the report.
   - Deleting the `08p*` files must leave a working Planner. Every hook is `typeof tpoX === 'function'`-guarded, with
     `window.X` for consts (STATE.md: the TDZ trap).
2. **Reuse before you write.** Every WP names the helper it extends: `BL.network`, `BL.rules`, 05j `ckt*`, 08o `cpr*`,
   08oa `elpSuggest`, 08n `jb*`, 08l switch links, `wfTable`. A parallel copy is a defect (README §7).
3. **The view edits connection data only.** It never moves a device, a wall or a mark. One user action = one undo step,
   `pushUndo(['circuits'])` (plus `['devices']` when a KD is created or flagged).
4. **Every automatic step ends in a table** (the round rule): the T8 seed, the T10 missing-box suggestions, and the T12
   engine diff. They share one helper, `tpoTable` (T8), on the `elpDialog` pattern (08oa:114).
5. **Derived stays derived.** GP, S, `tpoPattern`, the switch types and the core counts are computed on demand and cached
   on the `blInput(level).sig` hash. They are never written into the document.
6. **Hungarian UI, English code.** The strings in `01_RULES.md` §7 and in the WPs are final unless marked ⚑.
7. **Prefix `tpo`** for every new global (`tpoGraph`, `tpoCheck`, `TPO_…`). It is free at writing (`grep -n "tpo" src/`
   finds only the unrelated `topo:` field in 05s). `node tools/check-globals.js` must stay OK.

## 2. Module files (filename order = load order; all after `08oc`, before `09`)

| File | Owns | WPs |
|---|---|---|
| `src/08p-tpo-graph.js` | GP: the contraction of `BL.network` onto anchors, connectivity, the link router | T1, T9 |
| `src/08pa-tpo-model.js` | `c.topo` read/write, `tpoPattern`, `tpoCheck` (the CK rules), the seed | T3, T8 |
| `src/08pb-tpo-view.js` | the overlay shell, the layout, the SVG render, the mini-plan, the playback | T0, T2, T11 |
| `src/08pc-tpo-edit.js` | the Körkészlet panel and the tools: Betáp, Master, Lánc, Kapcsolás, KD | T4–T7 |
| `src/08pd-tpo-share.js` | runs, departures, KD roles, packing and sizing through `BL.rules`, the share table | T10 |

The pure parts (`08p`, `08pa`, `08pd` without DOM) must run under the jsdom spec harness with no `draw()`.

## 3. Data additions (read with defaults; no `SCHEMA_VERSION` bump; **no new top-level collection**)

| Where | Field | WP | Default when absent |
|---|---|---|---|
| `data.circuits[]` | `topo: {v:1, links:[{a, b, k, fix?, via?}], groups:[{grp, logic, hub?, order?}]}`. `a` / `b` are device ids (the board, a mid or an endpoint); `k ∈ feed · master · chain · sw · lamp` | T3 | absent = no topology yet: the view shows GP only and T8 can seed it |
| `data.circuits[]` | `ownPipe: true`, the circuit keeps its own conduit (TR-H3) | T5 | `false`; T8 sets it on the `vil` string (Q-T07) |
| device (junction / box) | `tpoRole: 'pref' \| 'must'` | T5 | none = pass-through (SR-3) |
| device (junction) | `gen: 'tpo'`, a KD suggested at a departure and approved in the T10 table | T10 | — |
| `state` | `tpo: {open, tab:'path' \| 'conn' \| 'share', level, cur, tool, z, px, py, speed}` (`cur` = the active circuit id) | T0 | closed; `tab:'path'` |

- `c.topo` rides on `data.circuits`, which is already in `UKEYS`, so undo, save and clear work unchanged.
- **Old files** have no `topo`. They load, render and run the engine exactly as before, and **the E5 engine ignores
  `c.topo` until T12**.
- **Dangling ids** (a deleted device) are dropped on read by `tpoLinks(c)`, the same way 05j drops dead members. They
  are never "repaired".

## 4. Golden policy

- **Identical, every WP.** The view is an overlay outside `draw()`, and no fixture has `c.topo`. If a golden moves,
  stop.
- T12 may change engine output **only** for circuits that carry `c.topo`. The CLA parity run (README §5) proves that a
  seeded topology reproduces today's legs and boxes exactly.
- PRIMER §2 still holds: goldens never call `draw()`. The view, its tools and the playback need the browser pane
  (`planner-stack-dist`, port 8138), with a screenshot in the report.

## 5. Report

Use the PRIMER / R1010 §7 format, plus three lines:
- **"Hooks in shared files:"**: file:line for each, or "none".
- **"Rules covered:"**: the `01_RULES.md` ids this WP implements or checks.
- **"Overlay or model:"**: which existing data the WP writes to.
