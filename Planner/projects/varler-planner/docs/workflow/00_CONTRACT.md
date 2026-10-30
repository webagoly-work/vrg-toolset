# Workflow round (WF) — CONTRACT

*Short on purpose. `docs/PRIMER.md` (read first) and `docs/round-2026-10-10/00_CONTRACT.md` §0–§1 and §7 still apply
(worktree check, NODE_PATH, the build → check → test loop, report format). This file only adds what is different.*

## 0. Where you work

`H:/VRG/Backup/archive/parked/2026-10-24/wt-planner-stack/Planner/projects/varler-planner`, branch `planner-stack`. Other sessions share
this worktree (Views V9+, R1010 M2): `git status` before you start and before you report; never commit unless the user
says so; commit with explicit paths only.

```bash
export NODE_PATH=H:/VRG/Full/Planner_VRG_U100/Planner/projects/varler-planner/node_modules
node build.js && node tools/check-globals.js && node tests/run.js
```

New spec files take the **next free number at build time** (`ls tests/spec-*` — the Views work keeps adding them).
Write the number into README §4.

## 1. Rules of this round

1. **Reuse before you write.** Every WP names the existing helper it extends (Floor tool, `createRoom`, `rectWalls`,
   `wrfPlan`, 06a portals, 05n marks, the gamepad wheel, 05j circuits, M2 presets). A parallel copy of an existing
   mechanism is a defect.
2. **Every automatic step ends in a table** the user can approve or override (the CLA lesson: lamp→switch, circuits,
   heights were all approved as tables). The table is a modal list with ☑ per row and "Alkalmaz"; nothing silent.
3. **Intent by hand, the derivable by rule.** Tools in this round record only what the user means (outline, allowed
   wall, link, group). Heights, boxes, switch types, cables are derived — and a derived value the user overrides is
   stored as an override flag (`hFix:true`, `typeFix:true`), never lost on the next derive.
4. **Hungarian UI, English code.** Strings in the WPs are final unless marked ⚑.
5. **New global names** use the round prefixes: `wfp` (pen/outline, F1–F2), `wfw` (Create Walls/Floors, F3–F4),
   `opn` (O1, existing prefix in 04-render), `pt` (O2, existing 06a prefix), `rw` (wheel, R1), `rwl` (routing walls, R2),
   `std` (Standards, R4), `wf` (workflow bar, E0), `lsw` (lamp↔switch, E1), `jb` (junction boxes, E3), `bl` (engine, E5).
   `node tools/check-globals.js` must stay OK.

## 2. Data additions (all read with defaults; no `SCHEMA_VERSION` bump unless a WP says so)

| Where | Field | WP | Default when absent |
|---|---|---|---|
| `data.floors[]` | `stage:'outline'\|'floor'` — outline = drawn room, no slab yet | F1 | `'floor'` (old files) |
| `data.floors[]` | `clear:true` — the poly is the INNER (measured) outline, walls go outside it | F1/F3 | absent = centreline poly (old `createRoom`) |
| `state` | `penThick:{ext:300,int:200}`, `penTick:100`, `pen45:true` | F1/F3 | as written |
| `state` | `floorTint:bool` — room-type tint on floors | F4 | `true` |
| `data.floors[]` | `kinds:[kindKey]` (multi-type); `kind` stays = `kinds[0]` for old readers | R1 | derived from `kind` / name |
| `data.marks[]` | tag `vezetheto` (kind `wall` = both faces, or `wspan` `{wall,u0,u1}`) | R2 | — |
| `data` | `stdHeights:[{code,var,ctx,h,scope,ref?}]` — project overrides of the Standards table | R4 | absent = built-in `STD_H` |
| device | `hVar:'garazs'…` (chosen height variant), `hFix:true` (manual height) | R4 | auto |
| `state` | `wfPhase:'alap'\|'nyil'\|'szab'\|'vill'` | E0 | `'alap'` |
| device (light) | `grp:'G3'` lamp group id (one switched leg) | E1 | ungrouped |
| device (switch) | `ctl:[lampId]` — **exists** (05s-endpoints.js:282, Q29); E1 writes it, a slot link first creates the switch at the slot | E1 | unlinked |
| device (switch) | `slot:{door, face, k}` — the portal slot it sits in; `typeFix:true` | E1 | free-standing / derived type |
| `data.marks[]` | kind `cline`, tag `mennyezet-ut` (ceiling reach line, `{pts, lamp, from, void}`) | E2 | — |
| device (box) | `jb:'pre-rbx'\|'portal'\|'switching'\|'ceiling'`, `size:'100x100'\|'150x100'` | E3 | — |

`data.stdHeights` is a new **array** top-level collection → `UKEYS` (11-controls.js:151) **and** `IDPRE`
(01-schema.js:19, prefix `'K'` — free at analysis time; `H` is taken by `runs`). Everything else rides on existing collections.

## 3. Golden policy

- **F3** may move goldens only if a fixture is re-run through Create Walls — none is; goldens stay **70/70 identical**.
  The new wall builder is new code; `createRoom` and `rectWalls` keep their output byte-identical.
- **F4** tint: default `floorTint` must not change any golden fixture (fixtures have no `kinds`) — if one moves, stop.
- Every other WP: **identical**. PRIMER §2 still holds: goldens never call `draw()` — tools, ghosts, the wheel, the bar
  and overlays need the browser pane (`planner-stack-dist`, port 8138) with a screenshot in the report.

## 4. The approval table (shared UI, built once in E1, reused by E3–E5 and R4)

`wfTable(title, rows, cols, onApply)` — rows `{id, on:true, cells:[…], why}`; a "Miért?" column shows the rule that
produced the row (the same text `stdHeight` returns as `rule`). Build it in E1; if R4 is built first, R4 builds it.

## 5. Report

PRIMER / R1010 §7 format, plus one line: **"Overlay or model:"** — which existing data the WP writes to.
