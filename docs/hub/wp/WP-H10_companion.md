# WP-H10 — Kapu segéd (local companion): serve the hub, open tools, terminal, Claude Code

**Goal (user):** "Option to open Terminal, option to open up a Claude Code terminal" — plus the
storage reason in `01_ARCHITECTURE.md` §3.1 (the full hub must run from an http origin).

## Depends / decisions
H3. **HUB-Q08** (A = companion), **HUB-Q05** (A = open tools like START.cmd does).

## Read
`01_ARCHITECTURE.md` §6–§7 · `00_CONTRACT.md` §2 *Security of the companion* ·
`Firmware/board-console/app/server.js` (the toolset's existing no-deps Node server: copy its argument
style `--port --no-open`) · `Planner/START.cmd` lines that resolve browsers (`CHROME_EXE`,
`OPERAGX_EXE`, `ZEN_EXE`) and the Claude Code action (`start "Claude Code" /D … cmd /k call "%CLAUDE_CMD%"`).

## Build
1. `Hub/companion/server.js` (Node 24, no deps): `--port 8795 --no-open --config <file>`.
   - binds `127.0.0.1` only; rejects requests whose `Host` is not `localhost:8795`/`127.0.0.1:8795`,
     and API requests whose `Origin` (when present) differs.
   - per-install secret: `Hub/companion/.token` (gitignored; created with `crypto.randomBytes(24)`);
     injected into the served `vrg-kapu.html` as `window.KP_COMPANION = {token}`; every `POST /api/*`
     must send `X-Kapu-Token`.
   - serves `Hub/dist/vrg-kapu.html` at `/`; nothing else from disk.
   - `Hub/companion/config.json` (gitignored; `config.example.json` committed): `roots` (repo root
     auto, plus extra folders the user adds — VRG-DE siblings for `local` paths), `browser`
     (`{exe, args}` — default: the first of START.cmd's browsers that exists, else the system default),
     `claudeCmd` (default `claude`), `terminal` (`wt.exe` when present, else `cmd.exe`).
2. API (POST JSON, fixed shapes; anything else 400):
   `open-tool {path}` — path relative to the repo, must exist, must end `.html`; spawns
   `browser.exe [--new-window] file:///…` (same as START.cmd) ·
   `open-folder {dir}` · `open-terminal {dir}` · `open-claude {dir}` (terminal running `claudeCmd` in
   `dir`) · `open-vscode {dir}` · `git {cmd:'status'|'pull'|'worktrees'|'log1'}` (`pull` = `--ff-only`)
   · `check-paths {paths[]}` → `{path: exists}`.
   Every `dir`/`path` is resolved with `path.resolve` and must start with one of `roots` (after
   `realpath`); spawns use `spawn(exe, argsArray, {detached:true, stdio:'ignore', windowsHide:false})`
   then `unref()` — **detached**, because a child tied to the server dies with it (toolset lesson).
3. `GET /api/status` → `{ok, version, repo, branch, dirty: n, ahead: n, behind: n}` (git porcelain).
4. Page: `kpCaps.companion` = status ok; the greyed actions from H3 come alive; Belépések row
   "Kapu segéd ● fut"; top-bar "⌨ Terminál" (repo root) and "✳ Claude Code" (menu: helyi / web /
   indító prompt másolása). "Frissítés a GitHubról" (☰) = `git pull` with the output shown.
5. `Hub/VRG Kapu.cmd`: start the server detached (`start "" /min node …\server.js`), wait until
   `/api/status` answers (ping loop, max 10 s), open `http://localhost:8795/` in the configured
   browser. Already running → just open.
6. `.gitignore`: `Hub/companion/.token`, `Hub/companion/config.json`.
7. The START.cmd / VRG-DE.cmd entries from H0 already call `Hub\VRG Kapu.cmd` — do not edit the
   launchers; run `node tools/check-start.js` to confirm they still resolve.
   `.claude/launch.json` `vrg-kapu` → the companion with `--no-open` on 8795.

## Tests (`Hub/test/spec-95-companion.js`, server started on a random port in the test)
- `GET /` without the right Host header (`Host: evil.test`) → 403.
- `POST /api/open-folder` without token → 401; with token and `dir: 'C:\\Windows'` → 403 (outside roots);
  `dir: '<repo>/../../..'` → 403; `dir: '<repo>/Hub'` with `KP_DRY_RUN=1` → 200 and the would-be
  spawn `{exe, args}` echoed (no process started in tests).
- `open-tool {path:'MindMap/vrg_mindmap.html'}` dry-run → args end with
  `file:///…/MindMap/vrg_mindmap.html`; `{path:'CLAUDE.md'}` → 400 (not .html).
- unknown action → 400; body > 16 KB → 413.
- `git {cmd:'rm'}` → 400.
- Browser: the page served from :8795 shows "Kapu segéd ● fut"; "Terminál itt" on Inventory, dry-run
  mode, returns the Inventory folder path.

## Verify focus
No shell strings built from request data; detached spawns; Host/Origin/token checks; CRLF `.cmd`.

## Out of scope
Microsoft/Google sign-in through this origin (v2). Running arbitrary commands — never.
