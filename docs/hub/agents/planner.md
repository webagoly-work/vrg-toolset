# Varler Planner — agent init
*For a Claude Code session that will work on Varler Planner. Read this, then the files in §3.*
**Felelős:** Arnold, Design Division · **Indító:** GO PLANNER

## 1. What it is
An electrical planning tool (villanyszerelési tervező) for residential and commercial work. It builds
to one self-contained offline HTML file; that file is the whole product. UI text is Hungarian, code
identifiers English.

## 2. Where
- Source: `Planner/projects/varler-planner/src/*.js` + `src/shell.html` → `dist/varler_planner.html`
- Opened from START key **1**. Submenu **P**: **B** build, **W** build and open, **E** CLA-preloaded,
  **T** test, **G** gyro relay.
- One checkout, `main`; confirm with `git rev-parse --show-toplevel && git branch --show-current`.

## 3. Read first
1. `Planner/projects/varler-planner/CLAUDE.md`
2. `Planner/projects/varler-planner/docs/PRIMER.md`
3. `Planner/projects/varler-planner/docs/ARCHITECTURE.md`
4. `Planner/projects/varler-planner/docs/DECISIONS.md`

## 4. Build / test / check
```bash
cd Planner/projects/varler-planner
node build.js && for f in src/*.js; do node --check "$f"; done
node tests/run.js                 # the runner does not build; golden 70/70 must stay byte-identical
node tools/check-globals.js       # after adding top-level names
node build.js --check             # diff against a saved reference build
```
`node_modules` (jsdom) exists only in the main checkout; elsewhere set `NODE_PATH` to it (PRIMER §1).

## 5. Rules and traps
- `src/*.js` are concatenated in filename order into one shared scope: order is load-bearing,
  names are global, a duplicate top-level name fails silently at boot (CLAUDE.md, PRIMER §5).
- Module names must match the pattern in `build.js`; `src/modules.json` is stale (CLAUDE.md).
- Every user capability is registered once in `05c-actions.js` (CLAUDE.md, PRIMER §6).
- A new top-level data collection goes into both `UKEYS` and `IDPRE` in `01-schema.js` (CLAUDE.md).
- `Esc` never discards; never replace an `<svg>` mid-drag (CLAUDE.md).
- A failing spec is a specification: read what it protects first (PRIMER §5).
- No Python on this machine; write patch scripts to a `.js` file, not `node -e` (PRIMER §5).
- `docs/2_0_architecture.md` is unbuilt design (CLAUDE.md).

## 6. Current state
- git 2026-10-30 34d41f1 Planner: Mélyvíz P6b, inline colours through the shared tokens
- git 2026-10-30 3932351 Re-root: rewrite old paths to H:\VRG\Full
- git 2026-10-29 f1d8000 VRG Mobile M2: QR pairing, a trusted phone
- Open: Simple-UI S6 look, C6 pen feel, G2, CLA-ADD-001 extras, Views, E6 (`GO-PLANNER.md`). Decision files: `docs/DECISIONS.md`,
  `docs/round-2026-10-10/R1010-Q-001.json`, `docs/round-2026-10-18/DECISIONS.md`,
  `docs/simple-ui/SUI-Q-001.json`, `docs/stack/PLANNER-STACK-Q-001.json`, `docs/views/DECISIONS.md`,
  `docs/workflow/WF-Q-001.json`.

## 7. Do not touch
- `dist/` by hand: change `src/` and rebuild (CLAUDE.md).
- `H:\VRG\Backup\code\Planner_VRG_U100-mirror` (dead backup) and `Planner/apps|home|data` (root CLAUDE.md).
- Another session's uncommitted files.

Forrás: Planner/projects/varler-planner/CLAUDE.md, README.md, docs/PRIMER.md, GO-PLANNER.md, launcher/vrg-menu.json, git log main, 2026-10-31
