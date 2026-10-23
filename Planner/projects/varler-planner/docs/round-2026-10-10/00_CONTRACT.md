# Round 2026-10-10 — CONTRACT

*The rules every WP of this round follows. Short on purpose: `docs/PRIMER.md` (read it first) and
`docs/stack/00_CONTRACT.md` §2–§7 still apply; this file only adds what is different.*

## 0. Where you work

```bash
cd H:/Dev-VRG/VRG-DE/wt-planner-stack/Planner/projects/varler-planner
git rev-parse --show-toplevel && git branch --show-current     # must say wt-planner-stack · planner-stack
grep -c "stkCreate" dist/varler_planner.html                  # > 0, else you are on a main build
export NODE_PATH=H:/Dev-VRG/VRG-DE/Planner_VRG_U100/Planner/projects/varler-planner/node_modules
```

Every WP of this round lives on `planner-stack` — the U and G waves would also fit `main`, but the
stack branch is where the user works and `main` lacks the 10-09 view scale every size here uses.

**Other sessions share this worktree.** `git status` before you start and before you commit; commit
with explicit paths only. Never commit unless the user says so.

## 1. The loop (every edit batch)

```bash
node build.js && for f in src/*.js; do node --check "$f" || break; done
node tools/check-globals.js
node tests/spec-NN-<yours>.js
node tests/run.js                 # full suite + 70 golden — before you report
```

Run the full suite **once before your first edit** and write down what is already red; a red you
did not cause goes in the report, not in your fix list.

## 2. Golden policy for this round

- **U1–U7, G2, S1–S5, M2:** golden must stay **70/70 identical**. None of them changes what
  `drawNormalGeom()` / the blueprint / the editors draw at default settings.
- **G1** is the only WP allowed to move goldens, and only the opening faces: build it first behind
  `state.openingStyle` with the old look as default (goldens identical = the refactor is pure),
  then flip the default and run `node tests/run.js --golden-update` **once**, listing in the report
  which captures changed (expect `scene@*` and `plan2d` of fixtures with openings; blueprint must not
  change).
- **M1** may change goldens only if a fixture has a stack (none does today — if one moves, stop and
  report).
- Remember PRIMER §2: goldens never call `draw()`. Plan symbols, overlay, hover, gizmo, aura — all
  outside the net. Those need the browser (§4).

## 3. Data — additions of this round (all read with defaults; no `SCHEMA_VERSION` bump)

| Where | Field | WP | Default when absent |
|---|---|---|---|
| `state` | `kbdLayout:'shift'\|'ijkl'` — the keyboard layout (answers U03 / U04) | U4 | `'shift'` |
| `state` | `railW`, `inspW` (px), `wideWork:{l,r,rail,insp}\|null` | U5 | 104 · 238 · `null` |
| `state` | `devHover:bool` | U6 | `false` |
| `state` | `openingStyle:'wide'\|'line'` | G1 | `'wide'` after the flip |
| `state` | `hwFollow:bool` | S4 | `true` |
| device (rbx) | `one:bool` — one-room build | S2 | `false` |
| stack record | `secTier:'alap'\|'premium'` | S5 | `'alap'` |
| `state` | `printPal:bool` — grey-safe palette in print / PNG grey | M1 | `true` |
| layer (stack role) | `role` values `sys:DED`, `sys:SOC`, `sys:LIGHT` | M1 | migrated from `sys:MAINS` |
| `data.circuits[]` | `preset`, `rooms:[roomId]\|['*']` ("waiting" is derived: no members) | M2 | absent = a plain 05j circuit |
| `data` | `eloPresets:[{id:'E1', key, n, kind, mcb, mm2, tier, custom?}]` — the project's own preset list | M2 | absent / empty = the built-in catalogue |

`state` is saved whole with the project (`sessionObj()` / `saveSession()` in `12-boot.js` ≈ line
295, and the JSON export in `11-controls.js` ≈ line 219), so a new `state` field persists by itself —
read it with a default, and sync its checkbox where `11-controls.js` ≈ line 225 syncs the others.
`data.eloPresets` is a new top-level **collection** → add it to **`UKEYS`** (`11-controls.js` line
128 — not `01-schema.js`, whatever CLAUDE.md says) **and** to `IDPRE` (`01-schema.js` line 19, prefix
`'E'`, free) or it will silently not undo / save / get ids. It must be an **array**: `ensureIds` and
`snap_` call `.forEach` on every `UKEYS` entry, so an object there throws at the first snapshot.

## 4. Browser verification (owed by every WP that changes pixels or input)

```text
preview_start  name: planner-serve        (H:\.claude\launch.json, port 8131, serves the REPO ROOT)
```
```js
const r = await fetch('/Calculator/CLA-teszt_v2.vplan.json').then(r => r.json());
hardResetWorkspace(); applyProjectData(r.project || r); draw();
```
Measure, do not squint (PRIMER §4): read computed styles, `getBBox()`, `selected`, `state.*`.
Set the viewport to 1600 × 950 — the pane's default is too narrow for the rail and inspector to show
(`RAIL_MIN` / `INSP_MIN` in `05d-shell.js`). Reset it to `desktop` when done.

## 5. Conventions specific to this round

- UI strings Hungarian, identifiers English. Every new capability is registered in `05c-actions.js`
  style (`registerActions([...])` in the module that owns it) — **a feature not in the registry is a
  feature nobody can find**, and the registry is what Ctrl+K searches (the user's "K control").
- Every new key goes into the **help dialog** (`help.keys` in `05c-actions.js` ≈ line 309) and the
  `HINTS` text of the affected tool (`08-interaction.js` line 11) in the same WP.
- No SVG `filter` for glows — an exporter drops filters (PRIMER). Glows are stroke passes.
- Screen-constant sizes through `vsP()` / `vsBadge()` (PRIMER §3).
- New top-level names carry the WP prefix: U1 `hitOk*` · U2 `selAura*` · U4 `kbd*` · U5 `pnl*` ·
  U6 `hov*` · G1 `opn*` · G2 `wrf*` · S1 `rli*` · S4 `flw*` · M1 `mns*` · M2 `cpr*`. S2, S3 extend `hw*`,
  S5 extends `ep*`.
- New specs: `tests/spec-58-…` upward, one per WP, numbered in build order
  (U1 58 · U2 59 · U3 60 · U4 61 · U5 62 · U6 63 · U7 64 · G1 65 · G2 66 · S1 67 · S2 68 · S3 69 ·
  S4 70 · S5 71 · M1 72 · M2 73). Copy the harness from `tests/spec-57-icons-layers.js`.

## 6. Do not

Everything in `docs/stack/00_CONTRACT.md` §7, plus:
- do not change the meaning of a key that the WP does not list — the user uses these daily;
- do not remove the old behaviour of a setting a WP replaces without the WP saying so (G1 keeps
  `openingStyle:'line'`);
- do not "fix" the F11 discrepancies (README §2) — they are the user's call.

## 7. Report (≤ 25 lines, paste back)

```
WP-xx  <title>  — BUILT | PARTIAL | BLOCKED
files: <file +/- lines>
names: <n> new top-level, prefix ok: yes/no · check-globals: ok
tests: spec-NN <p>/<t> · full: <green>/<total> suites · golden: identical | updated (<which>, why)
baseline red before my edit: <none | list>
browser: <what was measured, numbers> | owed: <list>
deviations: <none | each + reason>
found, not fixed: <…>
```
Then set the WP's line in README §4 to `built — <date> — uncommitted`.
