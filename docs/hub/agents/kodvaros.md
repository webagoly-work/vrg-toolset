# VRG Kódváros — agent init
*For a Claude Code session that will work on Kódváros. Read this, then the files in §3.*
**Felelős:** Elsie, Behaviour Lab · **Indító:** GO CITY

## 1. What it is
The codebase shown as a 3D city and used as a live workspace: terminals, files, agents and sessions
appear in it. For the Council it is the Control Room's screen, because agents already show up there
through hooks and `CodeCity/agents-poll.js`.

## 2. Where
- `CodeCity/`: `src/`, `build.js`, `scan.js`, `companion.js` (the live segéd, :8797), `mcp.js`,
  `agents-poll.js`, `hook.js`, `tools/`, `dist/`. Plans in `docs/city/`.
- START key **K**: page, **S** live mode, **F** overlay. Electron and the .NET SDK are in
  `H:\VRG\Full\tools`.

## 3. Read first
1. `GO-CITY.md`
2. `docs/city/README.md` — §7 dev notes, §8 done list
3. `docs/city/PROMPTS-WORKSPACE.md` when picking up the live-workspace series

## 4. Build / test / check
```bash
node CodeCity/build.js
node CodeCity/tools/selftest.js
```

## 5. Rules and traps
- Touch only `CodeCity/`, `docs/city/` and the `launcher/vrg-menu.json` entries a task names (GO-CITY.md §1).
- `git add` by path, never push, stash or switch branch. The other account may work in the same
  folder: never commit its pending files (GO-CITY.md §1).
- Write patch scripts with the Write tool; shell heredocs here lose backslashes (GO-CITY.md §4).
- `String.replace(a, b)` with `$'` in `b` corrupts the file: use `replace(a, () => b)` (GO-CITY.md §4).
- An open SSE stream stops headless Chrome's virtual clock; rAF barely ticks headless (GO-CITY.md §4).
- Launching `claude.exe` freezes the launcher about 3 s: keep such spawns in a helper (GO-CITY.md §4).
- A companion started inside a Claude session must not pass on its CLAUDE_* markers (GO-CITY.md §4).
- Never test git writes, worktrees or real saves in this checkout; use fixture repos (GO-CITY.md §4).

## 6. Current state
- git 2026-10-30 e654103 GO files consolidated, new GO MAIN, CLAUDE.md codephrases; anonymiser re-run
- git 2026-10-30 2ac1adc Kódváros: pending src, tools, shell, design pack and rebuilt dist
- git 2026-10-30 3932351 Re-root: rewrite old paths to H:\VRG\Full
- Done: C1–C10, KV-01…KV-27, the Mélyvíz skin (GO-CITY.md §3).
- Open: fine-tuning from the user's notes (ask first, never guess); Zen, Lively and overlay checks; the
  USB-stick train; Cloudflare ring CF-01…CF-07, not started (GO-CITY.md §4).
- Not yet in `docs/hub/hub-seed.json`. Decision ids: CITY-Dn.

## 7. Do not touch
- `CodeCity/dist/` by hand; rebuild instead.

Forrás: GO-CITY.md, launcher/vrg-menu.json, git log main, 2026-10-31
