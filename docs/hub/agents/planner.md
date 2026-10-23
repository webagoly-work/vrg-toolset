# Varler Planner — agent init
*For a Claude Code session that will work on Varler Planner. Read this, then the files in §3.*

## 1. What it is
An electrical planning tool (villanyszerelési tervező) for residential and commercial work. It builds
to one self-contained offline HTML file; that file is the whole product. UI text is Hungarian, code
identifiers English.

## 2. Where
- Source: `Planner/projects/varler-planner/src/*.js` + `src/shell.html` → `dist/varler_planner.html`
- Opened from `Planner/START.cmd` key **1**, or VRG-DE.cmd **L1**. START.cmd **W** builds and opens
  the worktree build, **E** the CLA-preloaded one, **B** build, **T** test, **G** gyro relay.
- Three checkouts exist; check `git rev-parse --show-toplevel && git branch --show-current` first.

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
- 2026-10-19 Planner round 2026-10-18 follow-up: Igénylista hand-off, slab join, R6, cinema Sets B–E
- 2026-10-19 Vezetékcsatorna T0–T6; kör utómunka
- 2026-10-18 Planner round 2026-10-18: Födém, Igénylista, Házimozi C1–C7
- Open: C6 Mozi fal pen feel (GO-R1018.md §4). Decision files: `docs/DECISIONS.md`,
  `docs/round-2026-10-10/R1010-Q-001.json`, `docs/round-2026-10-18/DECISIONS.md`,
  `docs/simple-ui/SUI-Q-001.json`, `docs/stack/PLANNER-STACK-Q-001.json`, `docs/views/DECISIONS.md`,
  `docs/workflow/WF-Q-001.json`.

## 7. Do not touch
- `dist/` by hand: change `src/` and rebuild (CLAUDE.md).
- `H:\Planner_VRG_U100` (dead backup) and `Planner/apps|home|data` (root CLAUDE.md).
- Another session's uncommitted files (GO-R1018.md §1 lists them).

Forrás: Planner/projects/varler-planner/CLAUDE.md, README.md, docs/PRIMER.md, GO-R1018.md, Planner/START.cmd, git log main, 2026-10-22
