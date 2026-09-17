# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Varler Planner — an electrical planning tool (villanyszerelési tervező) for residential/commercial
work. It builds to **one self-contained offline HTML file**; that file is the whole product. UI text
and docs are primarily Hungarian; code identifiers are English.

## Commands

```bash
npm install               # once — jsdom (tests) + ws (phone relay)
npm run build              # src/ → dist/varler_planner.html
node build.js --check      # build, diff against ./planner.html (or $REF) — verifies a pure/no-op change
node build.js --list       # show module list + build order without building
npm test                   # build + run every tests/spec-*.js + golden.js (595+ assertions, 70 golden renders)
node tests/run.js --golden-update   # accept intentional rendering changes (updates tests/golden.json)
node tests/spec-14-schema.js        # run a single suite directly (any spec-*.js works the same way)
npm run manifest            # node tools/manifest.js
node tools/phone-relay-server.js    # gyro/phone-link relay server (needs Node at runtime)
```

Open `dist/varler_planner.html` in a browser — that's the entire deliverable, no server needed.

There is no lint script. `node build.js --check` (comparing against a saved reference build) is the
project's substitute for "did I break anything structurally."

## Architecture

**Read `docs/ARCHITECTURE.md` before editing anything non-trivial** — it's the canonical module map
and invariant list; this section is a condensed pointer to it. `docs/DECISIONS.md` explains *why*
non-obvious choices were made (read before "fixing" one back). `docs/1.1_backlog.md` has queued
work; `docs/2_0_architecture.md` is an unbuilt design doc for a phone-link/tool-taxonomy rework —
**not implemented**, don't assume any of it exists in code.

### The one rule that matters

`src/*.js` are concatenated **in filename order** by `build.js` into a single `<script>` in
`src/shell.html` (which has markup/CSS plus a `/*__SRC__*/` marker). There are no ES modules and no
runtime boundaries — every top-level name lives in one shared scope.

- **Order is load-bearing.** Top-level `const`/`let` are in a TDZ until their point in the
  concatenation; moving a module earlier can break startup silently.
- **Names are global.** Grep before adding a new top-level function/const — collisions fail silently
  at boot (e.g. a duplicate `SC` once broke the whole app). `node build.js && node --check
  dist/varler_planner.html` catches syntax breaks fast.
- Module filenames must match `/^\d\d[a-z]?-.*\.js$/` (`00-core.js`, `00b-i18n.js`, `11b-backup.js`).
  This lets a file be inserted between two numbers (`05b`, `05c`, ...) without renumbering everything
  after it. `build.js` refuses to build if any `.js` in `src/` doesn't match — that guard exists
  because the old stricter pattern once silently excluded i18n/settings/actions from a build.
- `src/modules.json` is a **stale, hand-written snapshot** from an earlier module layout (compare its
  filenames to the real `src/` listing) — don't treat it as authoritative; `docs/ARCHITECTURE.md`'s
  module table and `node build.js --list` are.

**Where does new code go?** By subject, not size: a new door type → `04-render.js`; a new wall/plane
editor action → `06-wall-editor.js` / `07-plane-editor.js`; a new standard/catalogue number →
`00-core.js` for now. Something that runs on this PC outside the browser → `tools/`. Something that
runs on another device (phone/tablet/client) → `mobile/`.

### Data model

```js
data = {v, seq, devices, paths, cables, openings, floors, objects, roofs,
        notes, measures, wallNotes, noteHide}
```

- Every record has an **id** (`D7`, `P3`, path node `n12`) issued from `data.seq`, a forward-only
  per-document counter — ids are never reused. `ensureIds()` is idempotent, run on
  snapshot/save/load.
- **Cross-references are ids, not indices** (`dev.link = {p:'P3', n:'n12'}`), resolved via
  `linkTarget(dev)` → `null` if either end is gone. Deleting anything is therefore always safe;
  `pruneLinks()` tidies dangling refs.
- `connectivity()` and `validate()` are **derived, never stored** — computed from geometry on demand,
  not kept in sync by hand.
- `data.v` is the schema version; `migrate()` upgrades old files on load.
- Adding a new top-level collection requires adding it to **both** `UKEYS` and `IDPRE` in
  `01-schema.js`, or it silently won't undo/save/clear/get ids.

### Actions, shell, surfaces

- Every user capability is declared once in `05c-actions.js` as
  `{id, label, group, icon?, hint?, alias?, need?, keys?, when?(ctx), run(ctx)}`. Three consumers
  (⌘K palette, keyboard map, status bar) read the same list — a capability not registered here is a
  feature nobody can find. Disabled actions still show, dimmed, with `need` — don't filter them out.
- `05d-shell.js` (stage rail + inspector) is generated entirely from the action registry — it's
  chrome, not drawing; a test asserts the scene layer is byte-identical with the shell on/off.
- A wall elevation and the three plan planes (floor/álmennyezet/ceiling) are all **projections of the
  model onto a 2D-mm surface**, unified under `05b-editor-core.js` via an `edBindSurface(E, svgEl,
  {kind, local, clamp, data, nodeUV, setDev, setNode, ..., menu, badge?})` descriptor. Adding a new
  surface (a roof plane, the 1.1 Rendezés graph) means writing a descriptor + renderer, not a new
  editor.

### Invariants (do not violate without reading `docs/ARCHITECTURE.md` first)

- `draw()` builds separate `scene`/`overlay` strings; `paintLayers()` reassigns `innerHTML` only for
  whichever one actually changed (SVG parse is the expensive part, not string building).
  `updateTotals()` only runs when the scene string changed.
- Undo can be **scoped** (`pushUndo(['paths'])`); an unscoped `pushUndo()` snapshots everything. Both
  editors share one session via `edCur()` (`wvPush`/`wvUndo`/`wvCloseEditor`/`wvOpenModal`) — editor
  edits don't touch the global undo stack until the session is saved.
- **`Esc` never discards** — it steps out one level (finish path → clear warp → clear selection →
  leave fullscreen). Closing an editor session is only via Mentés/Elvetés buttons.
- **Never replace an `<svg>` element mid-drag** (kills pointer capture) — replace its children
  (`edInner()`).
- A wall hit is `{t:'wall', ref:<rect>}`, not `data[t][i]`; walls carry ids (`W12`) because
  `applySnap` rebuilds every wall object. **Never hold a wall reference across an undo** —
  `reselectAfterSnap()` re-resolves by id instead.
- Chases merge via `clipPath` (union by spec), not `mask` (silently ignored by an exporter). Haloed
  text is drawn as a stroke pass then a fill pass (not `paint-order`, which exporters ignore).
- `t(key, hu)` (i18n, `00b-i18n.js`) falls back to **the Hungarian string passed in**, never to the
  bare key — so partial translation always reads correctly.

## Testing

`npm test` runs every `tests/spec-*.js` (plain Node scripts, no framework) plus `tests/golden.js`,
which renders 70 outputs from 6 fixture projects and hashes them — any `CHANGED` line during a
refactor means the change wasn't pure. Run a single suite directly with `node tests/spec-NN-*.js`.
`docs/browser_verification_checklist.md` covers what jsdom cannot test (pointer capture, real layout,
touch, printing, canvas export) — needs a human in an actual browser.

## Environment notes

- This repo lives on a portable USB dev environment (`VARLER`/`Planner`); `apps/`, `node_modules/`,
  and `.git/` are intentionally excluded from OneDrive sync — only `data/` (outside this repo) and
  built `dist/` artifacts sync. Not generally relevant to code changes, but explains why
  `node_modules/` may need to be brought over manually rather than `npm install`-ed in place.
- `dist/` is generated — never hand-edit it; change `src/` and rebuild.
