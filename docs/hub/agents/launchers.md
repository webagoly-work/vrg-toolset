# Indítópult (START.cmd · VRG-DE.cmd) — agent init
*For a Claude Code session that will work on Indítópult (START.cmd · VRG-DE.cmd). Read this, then the files in §3.*

## 1. What it is
The console menus that start every tool. `Planner/START.cmd` is the master launcher and the only
entry point the user goes through; `VRG-DE.cmd` is the umbrella launcher with project categories,
dev tooling, standalone programs and the prompt library.

## 2. Where
- `Planner/START.cmd` — TOOL REGISTRY (`T<n>_NAME` / `T<n>_PATH`, `TOOLCOUNT`), letter actions in
  `ACTIONKEYS`.
- `VRG-DE.cmd` at the repo root — `L<n>` projects, sections C/V/G/N/R/Z/P/K/X.
- Shims at `H:\Dev-VRG\Start.cmd` and `VRG-DE-Launcher.cmd`.

## 3. Read first
1. `CLAUDE.md` (root) — "VRG Digital Environment", "START.cmd is the front door"
2. `Planner/START.cmd`
3. `tools/check-start.js`

## 4. Build / test / check
```bash
node tools/check-start.js     # exit 1 when a path, TOOLCOUNT or the registry is wrong
```

## 5. Rules and traps
- CRLF line endings; with LF, `for (...)` blocks silently stop matching (root CLAUDE.md).
- Never `goto` out of a `for (...)` block; echo values via `!delayed!` inside blocks; use
  `ping -n N 127.0.0.1 >nul`, not `timeout` (root CLAUDE.md).
- Console output ASCII only (root CLAUDE.md).
- Keep existing tool numbers stable; update the dated NOTE block when the registry changes
  (root CLAUDE.md).
- The numbered slots are full at ten; a new entry needs a letter in `ACTIONKEYS` (Planner PRIMER §5).

## 6. Current state
- 2026-10-18 U) Board Console bejegyzés
- 2026-10-16 START.cmd: tool 1 = the merged working Planner (2026-10-16), dated note
- 2026-10-10 START.cmd: E) builds and opens the P33-preloaded Planner from the worktree
- Decision files: none.

## 7. Do not touch
— (nincs leírva)

Forrás: CLAUDE.md, Planner/START.cmd, VRG-DE.cmd, Planner/projects/varler-planner/docs/PRIMER.md, git log main, 2026-10-22
