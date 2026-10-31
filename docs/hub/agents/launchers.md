# Indítópult (START · BACKUP · OTG) — agent init
*For a Claude Code session that will work on the launcher. Read this, then the files in §3.*
**Felelős:** Elsie, Behaviour Lab · **Indító:** GO MAIN

## 1. What it is
The one console menu that starts every tool, and the only entry point the user goes through. One
registry drives START, BACKUP and OTG, and the Node side (Kapu build, Kódváros segéd) reads it too.
A tool that is not in the registry does not exist.

## 2. Where
- `launcher/vrg-menu.json` — the only registry: tools, submenus, servers, programs, prompts.
- `launcher/vrg-ui.ps1` draws the menu; `launcher/vrg-launch.cmd` opens it in the portable Windows
  Terminal; `launcher/menu.js` is the Node reader.
- `launcher/vrg-git.ps1` commit + push, `launcher/backup.ps1` backup (see `backups.md`).
- Shims: `H:\VRG\START.cmd`, `BACKUP.cmd`, `OTG.cmd`. The old launcher files only forward (root CLAUDE.md).

## 3. Read first
1. `CLAUDE.md` (root) — "The START launcher", "START is the front door"
2. `launcher/vrg-menu.json`
3. `tools/check-start.js`

## 4. Build / test / check
```bash
node tools/check-start.js                        # exit 1 on a missing path, double key or port clash
powershell -NoProfile -ExecutionPolicy Bypass -File launcher\test\selftest.ps1      # renders every screen offline
powershell -NoProfile -ExecutionPolicy Bypass -File launcher\test\git-selftest.ps1  # throwaway repos only
```
After a tool change also run `node tools/build-hub.js`, which bakes the tool list in.

## 5. Rules and traps
- Keep existing keys stable; the user knows them by heart (root CLAUDE.md).
- `launcher/vrg-ui.ps1` stays ASCII; Hungarian text lives in the JSON's `ui` block (root CLAUDE.md).
- Batch files are CRLF; with LF, `for (...)` blocks silently stop matching (root CLAUDE.md).
- Never `goto` out of a `for (...)` block; echo values via `!delayed!` inside blocks; use
  `ping -n N 127.0.0.1 >nul`, not `timeout` (root CLAUDE.md).
- In cmd, `shift` also shifts `%0`: take `%~dp0` before any shift (root CLAUDE.md).
- Console output ASCII only (root CLAUDE.md).
- Never test the git flow on a real repo (root CLAUDE.md).

## 6. Current state
- git 2026-10-30 e654103 GO files consolidated, new GO MAIN, CLAUDE.md codephrases; anonymiser re-run
- git 2026-10-30 aeca63a START launcher: one menu, shims and the portable-path scripts
- Decision files: none. ServiceKit is merged but has no menu entry yet (2026-10-30 audit).

## 7. Do not touch
- `H:\VRG\Full\tools\git`: the harness's shell runs from it; change `CLAUDE_CODE_GIT_BASH_PATH` first
  (root CLAUDE.md).

Forrás: CLAUDE.md, launcher/vrg-menu.json, docs/housekeeping/AUDIT-2026-10-30.md, git log main, 2026-10-31
