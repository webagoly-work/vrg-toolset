# Stack build pack — CONTRACT

**Every builder reads this file and its own `WP-*.md`. Nothing else, unless the WP lists it.**
Tables a WP needs are in `01_CATALOGUES.md` — the WP names the section; read only that section.

Rev r1 · 2026-10-06 · written by the analysis model for the builder and verifier models.

---

## 0. Where you work

| | |
|---|---|
| Repo root | `H:\Dev-VRG\VRG-DE\Planner_VRG_U100` (`H:\Planner_VRG_U100` is a **backup — never work there**) |
| Planner | `<repo>/Planner/projects/varler-planner` — all paths below are relative to this |
| Branch | **`planner-stack`**, created from **`planner-circuit-endpoints`** (NOT `main` — main lacks `05j`/`05k` and the id repair) |
| Checkout | **a git worktree**, never a branch switch in the main checkout — the main checkout carries other sessions' uncommitted BRIDGE edits and a switch would fail or drag them along |

First-time setup (WP-A1 does this; later WPs reuse the worktree):

```bash
cd H:/Dev-VRG/VRG-DE/Planner_VRG_U100
git worktree add ../wt-planner-stack -b planner-stack planner-circuit-endpoints
cp -r Planner/projects/varler-planner/docs/stack ../wt-planner-stack/Planner/projects/varler-planner/docs/
cp Planner/projects/varler-planner/tools/check-globals.js ../wt-planner-stack/Planner/projects/varler-planner/tools/
# tests need jsdom; node_modules is not in git — reuse the main checkout's
export NODE_PATH="H:/Dev-VRG/VRG-DE/Planner_VRG_U100/Planner/projects/varler-planner/node_modules"
```

Commit the pack as the first commit on `planner-stack` **only if the user said to commit**. Never push.

## 1. Commands — the loop for every WP

```bash
node tools/check-globals.js          # duplicate top-level names + syntax. Run after EVERY edit batch
node build.js                        # npm test does NOT rebuild — always build first
node tests/spec-NN-yourwp.js         # your suite; prints its assertions
node tests/run.js                    # everything + golden (~25 s)
node tests/run.js --golden-update    # ONLY when your WP says golden may change, and say so in the report
```

A spec never exits by itself (JSDOM keeps Node alive) — `run.js` handles that; do not add
`process.exit` to specs. `PLANNER=<path.html> node tests/spec-…` runs a suite against another build.

**Baseline:** before your first edit, run `node build.js && node tests/run.js` and note any suite
that is already red. You are responsible only for not making it worse.

## 2. The single-scope rule (the one that breaks things)

`src/*.js` are concatenated in filename order into ONE `<script>`. No imports, no modules.

- **Every top-level name is global.** Use your WP's prefix (§5) for every new top-level name.
  `check-globals.js` must pass. A duplicate `function` silently replaces the other one.
- **Functions are hoisted; `const`/`let` are not.** A function in `05p` may be *called* from
  `04-render.js` at runtime. A `const` in `05p` must not be *read* by code that runs at load time
  in an earlier module (TDZ → boot failure). Rule: new `const` tables live in your own module and
  are read only inside functions. Exception: `LAYER_CATS` goes in `02-state.js` (WP-A1 says why).
- **Guard cross-module calls into later WPs**: `if(typeof hwServes==='function') …` when the
  callee belongs to a WP that may not be built yet. Never guard calls into existing code.
- New module files are listed in §5. File names must match `/^\d\d[a-z]?-.*\.js$/`.
- Every new module starts with the standard header comment (copy it from `05j-circuits.js` lines 1–8,
  change the first line).

## 3. Data — every addition in one place

Existing: `data = {v, seq, devices, paths, cables, openings, floors, objects, roofs, notes, measures,
wallNotes, circuits, noteHide}`; walls live in `WALLS[level]` (rects `{id:'W…',x0,y0,x1,y1,h?,layer}`),
building rooms in `ROOMSB[level]`, `layers` is a session global (not in `data`).

**New collections** (all seeded by WP-A1, so later WPs only use them):

| collection | IDPRE | record | owner WP |
|---|---|---|---|
| `data.marks` | `J` | `{id, layer, level, kind, …, pol, tags:[], note?}` — §3.2 | B2, B3 |
| `data.traces` | `T` | `{id, layer, level, plane, mode, pts:[[x,y]…], a?, b?, dir, tags:[]}` | B4 |
| `data.runs` | `H` | `{id, stage:'stack', stack, role, room, code, group, from, to, via:[{p,a,b}…], cable, len, basis, manual?}` | E3 |

Each new collection must be in **all five** places: `data` init (`02-state.js` ~l.174), `UKEYS`
(`11-controls.js` ~l.123), `IDPRE` (`01-schema.js` l.19), `hardResetWorkspace` (`12-boot.js`), and a lazy
getter `xxxList()` in the owner module (pattern: `cktList()` in `05j-circuits.js`).

### 3.1 Existing records — new fields

| record | field | meaning | WP |
|---|---|---|---|
| layer | `cats:{<cat>:bool}` | v2 cat set, `01_CATALOGUES §1` | A1 |
| layer | `op:{<cat>:0.1…1}` | sub-layer opacity; absent = 1 | A1 |
| layer | `lock` `link` `collapsed` | bool · link-group id `'g…'` · panel fold | A2, A3 |
| layer | `role` `stack` | stack role key (`01_CATALOGUES §2`) · stack id | B1 |
| room (`data.floors[i]` and `ROOMSB[l][i]`) | `id` | building rooms get ids `Y…` via `ensureIds` | B1 |
| room | `kind` | room kind key, `01_CATALOGUES §8`; absent = derived from name | D2 |
| room | `needs` | `{<role>:{<code>:true}}` checklist ticks | D2 |
| opening | — | tags live in `data.marks` (`kind:'opening'`), not on the opening | B3 |
| device | `type` | new values `rbx` `base` `meter` `entry` `ssc` `ep` | C1, D1 |
| device | `code` `var` | BRIDGE type code + variant key (`01_CATALOGUES §5`) | D1 |
| device | `rb` `serves` `radios` | RoomBox class · `null`=auto or `[roomId…]` · `['thread',…]` | C1–C3 |
| device | `units` | BASE: subset of `['NET','COMP','MEDIA']` | C4 |
| path | `route` | `'channel'` \| `'arm'` (absent = ordinary path) | C5, E1 |
| path | `rule` `carrier` | `'sull'`\|`'csat'` · carrier override (`01_CATALOGUES §10`) | C5 |
| path node | `j` | `{p,n}` explicit join onto another route's node | E1 |
| path section | `cont` | `{auto:[…], manual:null\|[…], basis}` containment per family | E3 |

`stacks` is a new **session global** next to `layers` (saved in `sessionObj`, loaded in
`applyProjectData`, exported/imported with `layers` in `11-controls.js`, reset in
`hardResetWorkspace`). Record: `{id:'S'+base36, name, kind:'bridge', scale:'S-C', layers:[layerId…],
phase:1|2}`.

**Undo:** `layers` and `stacks` are NOT in undo today. WP-A1 adds them to `snap_()` as `__layers`,
**only when the scope contains the marker `'__layers'`** — a plain `pushUndo()` must not carry them,
or undoing a device move would also revert a visibility toggle made after it. Every layer/stack
operation calls **`lyrPushUndo()`** (= `pushUndo(['__walls','__layers'])`: all collections + walls +
layers, symmetric for redo).

### 3.2 `data.marks` kinds

| kind | geometry fields | WP |
|---|---|---|
| `wall` | `wall:'W7'` | B2 |
| `side` | `wall, side:+1\|-1` (+1 = along `wallInfo(r).perp`) | B2 |
| `vstrip` | `wall, side, u0, u1` — mm along the wall from its start (`x0` or `y0`) | B2 |
| `hstrip` | `wall, side, v0, v1` — mm above the floor | B2 |
| `hband` | `room, v0, v1` — an hstrip on every wall face that looks into the room (derived at draw) | B2 |
| `opening` | `op:'B5'` | B3 |
| `pstrip` | `plane:'floor'\|'ceiling', axis:'x'\|'y', c, w` — centre line and width, clipped to the room it starts in, `room` | B3 |
| `zone` | `plane, shape:'rect'\|'circle', x0,y0,x1,y1 \| cx,cy,r` | B3 |

`pol` ∈ `'plus'` (előnyös) · `'minus'` (kerülendő) · `'ban'` (tilos) · `'none'`. Tags are keys from
`01_CATALOGUES §3`.

## 4. Conventions

- **UI text Hungarian, identifiers English.** New chrome strings go through `t('key','Magyar szöveg')`.
  Hungarian labels are given in the WPs — copy them exactly.
- **Every capability is an action** — `registerActions([...])` in your module (pattern: end of
  `05j-circuits.js`). Shape `{id, label, group, icon?, hint?, alias?, need?, keys?, when?(ctx), run(ctx)}`.
  `alias` = English + accent-free Hungarian search words. Disabled actions stay visible with `need`.
  Single-letter `keys` only after `grep -n "keys:\['<k>'\]" src/*.js` and the keydown handlers in
  `08-interaction.js` show the key is free.
- **Right-click menus** (RCO = right-click option): `ctxMenu(e, [{label, act}])` in `10-lamps.js`.
  Add items where the WP says; never build a second menu system.
- **Dialogs**: `openModal(title, html, onOk)` / `closeModal()`.
- **HUD line**: `$('hud').textContent = '…'` for one-line feedback.
- **Ids**: never set an id by hand except where the WP says (`ensureIds(data)` issues them).
  Copies go through `copyRecord(coll, rec)`.
- **Derived, never stored**: coverage, portal graph, checklist done-state, carrier, ARM refs.
  Stored: what the user drew or chose. Generated data that must persist (runs, `sec.cont`) is stored
  as `{auto, manual, basis}` — recompute writes `auto` only; a stale `basis` with a `manual` value is
  a `warn`, never an overwrite.
- **Rendering**: scene vs overlay. Things that are the drawing → scene string. Ghosts, previews,
  hover, pick-mode highlights, coverage fields → **overlay** string. With no stack data present, the
  scene string must be **byte-identical** to before (that is what golden proves).
- **Opacity**: wrap or attribute every new scene element with `lyrOpAttr(item, cat)` (WP-A1); it
  returns `''` at 100 %, so default output does not change.
- **Validation**: new "this looks wrong" rules go into `validate()` in `01-schema.js` via a hook
  (WP-B1 adds `VALIDATORS=[]`; your module pushes `{code, run()→[{sev,code,msg,ref}]}`) — not into the UI.
- **Every derived result is a pure function returning plain JSON** — that is the Phase 3 export seam.
  Expose it on `window` in the test-hooks block at the end of your module.

## 5. Files and prefixes

| WP | module (new) | prefix | spec |
|---|---|---|---|
| A1 A2 A3 | `05l-layers.js` | `lyr` | spec-32, 33, 34 |
| B1 | `05m-stack.js` | `stk` | spec-35 |
| B2 B3 | `05n-marks.js` | `mrk` | spec-36, 37 |
| B4 B5 | `05o-traces.js` | `trc` (traces) · `prt` (portal graph) | spec-38, 39 |
| C1 C2 C4 | `05p-hardware.js` | `hw` | spec-40, 41, 43 |
| C3 | `05q-rf.js` | `rf` | spec-42 |
| C5 | `05r-channel.js` | `chn` | spec-44 |
| D1 D4 | `05s-endpoints.js` | `ep` | spec-45, 48 |
| D2 D3 | `05t-needs.js` | `need` · `sug` | spec-46, 47 |
| E1 | `05u-arms.js` | `arm` | spec-49 |
| E2 | `05v-graph.js` | `rg` | spec-50 |
| E3 E4 | `05w-fill.js` | `afill` | spec-51, 52 |
| E5 | `05x-cabinet.js` | `elo` | spec-53 |

Run `node tools/check-globals.js --prefix <yours>` to list what you added.
Edits to existing files are allowed **only at the anchors your WP names**. Anything else → stop and
write it in the report as a question.

## 6. Test file pattern

Copy the skeleton of `tests/spec-27-circuits.js` lines 1–20 (JSDOM boot, `newBlankProject()`,
`ok(name, cond, extra)` collector) and its last lines (verdict print). Rules:
- deterministic fixtures — no `Math.random`, no `Date.now()` in data that is asserted;
- assert behaviour through the `window` hooks your module exports, not through DOM scraping, except
  for the panel/menu WPs where the DOM *is* the behaviour;
- one assertion per acceptance line of your WP, named in English, short.

## 7. Do not

- touch `dist/` by hand, `tests/golden.json` without the WP's permission, or `docs/` other than
  your own WP status line and `docs/ARCHITECTURE.md`'s module table row for your new module;
- rename or reorder existing modules, change existing ids, change `SCHEMA_VERSION` (new fields are
  read with defaults — no version bump is needed for anything in this pack);
- replace an `<svg>` element during a drag; hold a wall reference across an undo; let `Esc` discard;
- add a library, a network call, or `localStorage` for project data;
- implement anything from another WP "while you are there". Out-of-scope work goes in the report.

## 8. The report (paste back at the end, ≤ 25 lines)

```
WP-xx  <title>  — BUILT | PARTIAL | BLOCKED
files: <new/edited files with +/- line counts>
names: <count> new top-level names, prefix ok: yes/no
tests: spec-NN  <passed>/<total> · full run: <suites green>/<total> · golden: identical | updated (why)
baseline red before my edit: <list or none>
deviations from the WP: <none | each with reason>
questions / found but not fixed: <…>
browser-only checks still owed: <from the WP's list>
```

Then set your WP's status line in `README.md` (§ Status) to `built — <date> — <commit or 'uncommitted'>`.
