# Our assets on this computer for a live Kódváros workspace / GitWorld

Scope: what already exists on this PC (repo `H:\cwebuser\projects\VRG-DE\Planner_VRG_U100`, the
sibling folders on `H:\`, `Planner/apps`, `C:\Users\webag\.claude` structure only) that can be reused
to turn VRG Kódváros into a live workspace / overlay OS. Read-only pass, 2026-10-26. All sources are
local files; links are `file:///` paths. Secrets were not opened (`.credentials.json`, `.ssh`,
`sessions/*.key`, `daemon/*.key`, `Hub/companion/.token`, GEV's keys were all skipped).

## 1. CodeCity/ itself: which modules already provide parts of the workspace?

### Takeaway
Kódváros is already a working offline three.js r169 city (C1–C10 all DONE) with commit replay, lenses,
import/co-change roads, a Hungarian query bar, tours, compare/follow, **agent-session replay from
Claude Code transcripts** and a **zero-dependency MCP server**. It is a viewer only: no file opening,
no process view, no live feed, no server. The live pieces have to come from elsewhere (§2, §3).

### Cited Findings
- Build model: `scan.js` reads git (`git ls-files` + one `git log --numstat --summary -M`) into `city.json`; `build.js` concatenates `src/NN-*.js` in filename order with `Vendor/three` into one inline `<script type="module">` so the page works from `file://` with no server — [CodeCity/scan.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CodeCity/scan.js), [CodeCity/build.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CodeCity/build.js)
- Outputs present: `CodeCity/dist/vrg-codecity.html` (792 KB), `vrg-codecity.data.js` and `Planner_VRG_U100.city.json` (~165 KB each), dated 2026-10-25 — directory listing of [CodeCity/dist](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CodeCity/dist)
- Visual mesh: district = folder, footprint ~ LOC^0.7, height = commits (log), lit windows = recent activity, crane/ruin = churn/untouched > 2 y, roads/arcs = imports and co-change, timeline replay with fixed positions, roof flash on touched files; layout is computed once over every file that ever existed so buildings never move — [docs/city/README.md §2](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/docs/city/README.md)
- Git City (srizzon/git-city) is AGPL-3.0, so its look is re-implemented, never copied; three.js is MIT and its header travels with the build — [docs/city/README.md §2](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/docs/city/README.md)
- Module map (lines): `01-data` 38, `02-layout` 66 (stable treemap), `03-scene` 205 (renderer, orbit camera, instanced buildings, picking, render-on-demand via `requestRender`, `afterRender` hook for screen overlays), `04-ui` 177 (hover tip, info panel, share link, open city.json), `05-replay` 114, `06-timeline` 124, `07-lens` 128 (looks on keys 1–6), `08-roads` 99, `09-ask` 84 (pure query parser), `10-query` 61 (brackets on results), `11-hud` 42, `12-tour` 160, `13-card` 35 (PNG card), `14-compare` 74, `15-follow` 61, `16-session` 186, `99-boot` 25 — [CodeCity/src](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CodeCity/src) (`wc -l`)
- `03-scene.js` renders on demand only ("an idle city costs nothing"); sky is CSS behind a transparent canvas; windows are a procedural shader — [CodeCity/src/03-scene.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CodeCity/src/03-scene.js)
- Query bar ( / ): offline Hungarian parser — path words, language, csak/ügynök/ember, forró, régi/friss N nap/hét/hónap/év, >N sor/commit, legnagyobb/legaktívabb/…, top N; numbered brackets on screen; `#q=` links; HUD `KÖRZET · fájl · forró · NEAR <landmark>` — [docs/city/README.md §4 C7](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/docs/city/README.md)
- Deep links already cover view state: `#cam=…&sel=…`, `#t=<hash>`, `#lens=`, `#roads=1`, `#q=`, `#base=`, `#follow=a0/g0`, `#tour=auto&loop=1` (wallboard), `#sess=<id>` — [docs/city/README.md §4, §6](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/docs/city/README.md)
- Session replay (C9, CITY-D7 A): `scan.js --sessions` reads `~/.claude/projects/<mangled cwd>/*.jsonl` locally and keeps **only** path, kind (olvas/keres/szerkeszt) and seconds; tool-name map covers Read/Write/Edit/MultiEdit/NotebookEdit/Grep/Glob and Desktop Commander's read_file/write_file/edit_block/start_search/list_directory — [CodeCity/sessions.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CodeCity/sessions.js)
- Viewer side: a light hops roof to roof on a low arc (blue read · violet search · amber edit), touched roofs keep a dot, folder searches float over the district skyline; the whole session plays in ~30 s (`SESS_SECONDS = 30`) — [CodeCity/src/16-session.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CodeCity/src/16-session.js)
- Roads: amber = imports, cyan = importers, violet = co-change; U toggles all; regex imports for JS/TS, HTML, CSS, Python, Markdown links, relative only (221 roads in this repo) — [CodeCity/src/08-roads.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CodeCity/src/08-roads.js), [docs/city/README.md C6](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/docs/city/README.md)
- MCP (C10): `mcp.js` is a zero-dependency JSON-RPC 2.0 over stdio server (protocols 2025-06-18 / 2025-03-26 / 2024-11-05) with tools `city_summary`, `city_query`, `city_file`, `city_hotspots`, `city_view_link`, `city_rescan` (writes only dist, never `--sessions`); every answer ends with a `file:///` view link; register with `claude mcp add kodvaros -- node <repo>/CodeCity/mcp.js` (no checked-in `.mcp.json`, CITY-D8) — [CodeCity/mcp.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CodeCity/mcp.js), [docs/city/README.md §5–6](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/docs/city/README.md)
- `core.js` loads the page's own DOM-free modules (01-data, 02-layout, 05-replay, 09-ask) into a Node `vm` so the MCP answers and the page's query bar are the same code — [CodeCity/core.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CodeCity/core.js)
- Test tooling: `CodeCity/tools/selftest.js` (23 checks incl. a no-secret check on a fake transcript) and `tools/shot.js` (headless screenshot incl. `#pick=x,y`) — [docs/city/README.md §6](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/docs/city/README.md)
- Status: parked since 2026-10-23; base fine-tuning waits for the user's dev notes ("ask for those notes first; do not guess"); candidate for a Claude Design batch; since 2026-10-26 Kapu's features are to come here — [docs/city/README.md §7](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/docs/city/README.md)
- Idea lists already ranked: §7.1 #5 "live mode (Kapu's companion server) drives a car to each building a Claude session is reading or editing now — sessions are only replayed today"; §7.2 #3 "Harbour" (GitHub remote, Claude API, npm, OneDrive, ESPHome dock at the city edge; files that call out get a road to their dock); §7.2 #10 build mode / run mode; §7.2 #12 region map of neighbouring repos joined by highways ("`scan.js` already reads any repo"); §7.2 #9 building interiors / zoom levels city → district → building → floor; §7.1 #1 START.cmd as city gates — [docs/city/README.md §7.1–7.2](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/docs/city/README.md)
- `docs/city/IDEAS-GEV.md` (64 lines) holds the God's Eye View idea source (★ items) behind C3–C10 — [docs/city/IDEAS-GEV.md](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/docs/city/IDEAS-GEV.md)

### Inferences
- Live session traffic (§7.1 #5) needs little new code on the viewer side: `16-session.js` already animates path events; a live mode would feed the same `[dt, kind, target]` events from a server instead of baked `city.sessions`.
- The single-file / `file://` constraint is the main architectural obstacle: anything live (processes, file open/edit, launching) needs a localhost server, exactly the pattern Kapu's companion already uses (§2).
- The MCP server is the natural "Claude asks the city" channel; a live workspace could reuse it in reverse (the city telling Claude what the user selected).
- `scan.js` taking any repo path is the seed of the GitWorld multi-city map (§7.2 #12).

### Gaps
- No `docs/city/wp/` folder exists although README §1 lists it (directory listing of `docs/city` shows only README.md and IDEAS-GEV.md).
- The user's "dev notes" for base fine-tuning are not written down anywhere found.

## 2. CodeCity/from-kapu/: the parked Kapu features and companion-server.js

### Takeaway
A complete, tested snapshot of the old Kapu UI sits ready to lift: an **action registry driving an RCO
menu**, **accent-insensitive Ctrl+K search**, info drawer, keyboard nav with long-press, editor with
**claims**, Munkanapló, live refresh/"Mi változott?", glossary/tour, and the page side of a **local
companion server** that can already open a folder, terminal, Claude Code, VS Code, a tool page and run
read-only git, all behind a hardened localhost API.

### Cited Findings
- The folder is "a snapshot, not a working program"; whole Kapu as on `main` at commit `40b7143` (page build `bba2939ad7db`), sources + data + tests; tests "still reach into `Hub/` and `tools/` by path, so they need re-pointing" — [CodeCity/from-kapu/README.md](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CodeCity/from-kapu/README.md)
- Module table: `10-model` topology schema; `20-layout`/`30-board` SVG board with pan/zoom; `40-actions`, `41-search`, `45-drawer`, `47-nav`, `42-md` (RCO, Ctrl+K, drawer, keyboard nav, mini markdown); `55-signin`; `57-refresh` (live topology, commits per program, branches, "Mi változott?"); `70-edit` (editor + save to GitHub, claims, conflict dialog); `80-personal` (own links, File System Access target folder); `90-log` Munkanapló; `92-companion` (terminal, Claude Code, git pull, per-node folders); `97-extras` (tour, glossary, installers, link check, PNG/print) — [CodeCity/from-kapu/README.md](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CodeCity/from-kapu/README.md)
- Action registry: "one registry for every surface (RCO menu now; top bar and palette later)"; each action has id, label, alt, group, surfaces (`at`), `need` ('companion' | 'github' | 'log') which greys it with a Hungarian reason until available, `when(ctx)`/`whyNot`, submenus, `run(ctx)`; reasons e.g. "Ehhez fusson a Kapu segéd — indítsd a VRG Kapu.cmd-vel" — [from-kapu/src/js/40-actions.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CodeCity/from-kapu/src/js/40-actions.js) (15.8 KB)
- Search: accent-insensitive (`NFD` normalise, "Árvíztűrő" → "arvizturo"), ranks kinds program > dept > agent/go > folder/local > git — [from-kapu/src/js/41-search.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CodeCity/from-kapu/src/js/41-search.js)
- Navigation: click, right-click / long-press (500 ms), arrow-key focus hopping, tooltip delay 400 ms, Ctrl+K — [from-kapu/src/js/47-nav.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CodeCity/from-kapu/src/js/47-nav.js)
- Editing is operation-based (`set`, `add`, `hide`, `claim`, `replace`) replayed on GitHub's current copy at save time; claims last `KP_CLAIM_DAYS = 3` — [from-kapu/src/js/70-edit.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CodeCity/from-kapu/src/js/70-edit.js)
- Refresh: ETag-cached GitHub fetches, auto refresh every 10 min, 8 commits per program, up to 10 branches, decision-file detection (`DECISIONS*.md`, `*-Q-*.json`) — [from-kapu/src/js/57-refresh.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CodeCity/from-kapu/src/js/57-refresh.js)
- Munkanapló: form → markdown with front matter `type: vrg-munkanaplo/1`, sections Mit csináltam / Félkész / Következő lépés / Kérdések / Linkek; outputs download, local folder, GitHub `Hub/logs/`, OneDrive — [from-kapu/src/js/90-log.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CodeCity/from-kapu/src/js/90-log.js)
- Personal layer: own links (L5) and a local target folder via the File System Access API with the handle in IndexedDB (L6) — [from-kapu/src/js/80-personal.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CodeCity/from-kapu/src/js/80-personal.js)
- Companion page side: active only when served by the companion (which injects `window.KP_COMPANION = {token, port}`); calls `POST /api/<action>` with header `X-Kapu-Token` — [from-kapu/src/js/92-companion.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CodeCity/from-kapu/src/js/92-companion.js)
- Data: `topology.json` (13 branches / 55 slots of the business map) and `glossary.json` (25 entries); 16 spec files in `test/` — [from-kapu/README.md](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CodeCity/from-kapu/README.md), [from-kapu/test](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CodeCity/from-kapu/test)
- **companion-server.js endpoints** (copy of live `Hub/companion/server.js`, port 8795): `GET /` serves the page with the token injected; `GET /api/status` (branch, dirty count, ahead/behind via `git status --porcelain=v1 -b`); `POST /api/open-tool {path}` (only `.html` inside the repo, opened in portable Chrome/Opera GX/Zen); `open-folder {dir}` (explorer); `open-terminal {dir}` (Windows Terminal `wt.exe` if present, else cmd); `open-claude {dir}` (terminal running `Planner/apps/node/claude.cmd`); `open-vscode {dir}` (portable `Code.exe`); `git {cmd}` with a fixed whitelist `status`, `pull --ff-only`, `worktree list`, `log -1`; `check-paths {paths[≤500]}` — [CodeCity/from-kapu/companion-server.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CodeCity/from-kapu/companion-server.js)
- **Security model**: binds 127.0.0.1 only; checks Host and Origin; every POST needs a per-install token (`Hub/companion/.token`, 24 random bytes, compared with `timingSafeEqual`); whitelisted actions with exact key shapes; max body 16 KB; every path realpath'd inside allowed roots (repo and its parent `VRG-DE`, plus `config.json` roots); programs come only from config, spawned from argument arrays (never a shell string from request data), detached and unref'd; `KP_DRY_RUN=1` echoes instead of spawning (tests) — [companion-server.js header and body](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CodeCity/from-kapu/companion-server.js)
- The live copy stays in `Hub/companion/server.js` with `config.example.json`; Kapu itself is now only the access page (GitHub sign-in + signed allowed list → START.cmd) — [Hub/README.md](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Hub/README.md), [Hub/companion](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Hub/companion)
- UI spec with RCO strings (§5), main action per node kind (§4), panels incl. Munkanapló template (§6), top bar strings incl. "Keresés… (Ctrl+K)" (§7); "Click = the node's main action, Right-click / long-press = the RCO menu" — [docs/hub/03_UI.md](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/docs/hub/03_UI.md)
- 25 agent init docs (one per program: planner, inventory, kapu, board-console, planner-cyd, knobpad, bridge, vendor, launchers, prompts, research…) plus README and SESSIONS.md — [docs/hub/agents](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/docs/hub/agents)
- Kapu's README ideas for the move: board → district map (one data model), claims + Munkanapló on buildings, agent init docs as building cards (and handed to Claude via the MCP), helper actions from the city, "Mi változott?" as a lens — [from-kapu/README.md](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CodeCity/from-kapu/README.md)

### Inferences
- The companion server is the ready-made seed of the workspace's "OS layer": RCO → "open terminal / Claude Code / VS Code / folder here" works today for any directory under `VRG-DE`. Missing for the brief: open a single file in an editor, list processes, stream output, launch arbitrary downloaded programs, Claude desktop app. Each would be one more whitelisted action of the same shape.
- The `need`/`whyNot` greying pattern fits a non-coder: every RCO item explains why it is unavailable instead of failing.
- Multi-select (Ctrl+click) and agent choice are not in the snapshot; the action registry's `ctx` would need a selection list.

### Gaps
- Not verified whether the from-kapu tests pass after re-pointing (they are documented as not runnable in place).
- `Hub/companion/config.example.json` was not read in detail.

## 3. Other servers, launchers and tools in the repo (Hub, Toolbox, MindMap, Inventory, Planner, Firmware, launchers, tools/)

### Takeaway
The repo already contains a family of small hardened localhost Node servers with the same rules
(loopback, Host/Origin checks, JSON only), a **WebSocket relay** (`ws` 8.21.3) used by Planner ⇄ phone
⇄ CYD, a **serial-port live link** to ESP32 boards, a **macropad that launches Planner actions and
presses Windows keys**, and two menu launchers (VRG-DE.cmd, START.cmd) whose registries already list
every tool and portable program — i.e. the data for "city gates" and "launch third-party programs".

### Cited Findings
- Static dev servers (all because `localStorage` fails on `file://`): `MindMap/serve.js` (8124), `Inventory/build/serve.js` (8123), `Planner/projects/varler-planner/tools/serve.js` (8131, serves the repo root), `Hub/test/serve.js` (8796), `docs/research/openmct-spike/serve.js` (8150) — [MindMap/serve.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/MindMap/serve.js), [Inventory/build/serve.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Inventory/build/serve.js), [Planner tools/serve.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Planner/projects/varler-planner/tools/serve.js), [Hub/test/serve.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Hub/test/serve.js), [openmct-spike/serve.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/docs/research/openmct-spike/serve.js)
- Preview launch configs for the Claude browser pane already exist (mindmap 8124, planner 8131, planner-stack-dist 8138, …) — [.claude/launch.json](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/.claude/launch.json)
- **phone-relay-server.js**: local relay that serves `phone-sender.html` and rebroadcasts every WebSocket message to all other clients; port 47291 (probes 47291..47298), works over home Wi-Fi/hotspot with no internet; handles the dual-homed PC (Ethernet + Wi-Fi dongle) — [Planner/projects/varler-planner/tools/phone-relay-server.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Planner/projects/varler-planner/tools/phone-relay-server.js); `ws` 8.21.3 is installed in [varler-planner/node_modules/ws](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Planner/projects/varler-planner/node_modules/ws)
- Planner side of the link: `07a-link.js` owns "the socket · the message envelope · the hello handshake and capability negotiation · reconnect · throttled state broadcast · command routing" — [Planner/projects/varler-planner/src/07a-link.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Planner/projects/varler-planner/src/07a-link.js)
- **planner-cyd bridge**: joins the relay as role `cyd`, turns Planner `dash` snapshots into serial lines for a CYD display over USB, button presses come back as relay commands; flags `--port COM19`, `--tcp` fake device, `--demo` mock Planner — [Firmware/planner-cyd/app/bridge/bridge.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Firmware/planner-cyd/app/bridge/bridge.js)
- Macropad: up to 6 sets × 12 buttons in `macros.json`; button types `planner` (run a Planner action id via relay) and `keys` (press a key combination into the focused window via `winkeys.ps1`); settings page on `http://localhost:8788` (loopback, Host/Origin checks, JSON only); `autostart.js` toggles a Startup-folder shortcut only — [macros.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Firmware/planner-cyd/app/bridge/macros.js), [winkeys.ps1](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Firmware/planner-cyd/app/bridge/winkeys.ps1), [configui.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Firmware/planner-cyd/app/bridge/configui.js), [autostart.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Firmware/planner-cyd/app/bridge/autostart.js)
- winkeys.ps1 warning: "Some antivirus products flag scripts that inject keys (seen with Avast on the RL pack)" — [winkeys.ps1](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Firmware/planner-cyd/app/bridge/winkeys.ps1)
- **Board Console** (port 8790): JSON API `/api/board`, `/api/setups`, `/api/fw` (firmware library, esptool, backups, devices), `/api/ports` (COM ports), `/api/job`, **`/api/live`** (polled live view of a board agent: HELLO, USES, PINS, values, line log), firmware upload with a custom header against cross-site posts; listens on 127.0.0.1 and ::1 with Host/Origin checks; depends on `serialport` 12.0.0 — [Firmware/board-console/app/server.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Firmware/board-console/app/server.js), [live.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Firmware/board-console/app/live.js), [package.json](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Firmware/board-console/app/package.json)
- Board model comes from generators in `H:\VRG_Visual_Base\01_Hardware\Topology_Starter` (`make_starter.js`, `make_connectors.js`, `make_panel.js`) — [server.js header](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Firmware/board-console/app/server.js)
- Knob pad mock server serves the real page from `webpage.h` on 8177 without hardware — [Firmware/knobpad/mock-server.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Firmware/knobpad/mock-server.js)
- **START.cmd registry**: 11 tools (`TOOLCOUNT=11`), T11 = "VRG Kodvaros" → `..\CodeCity\dist\vrg-codecity.html`; menu handles keys 1–9, 0 and K — [Planner/START.cmd](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Planner/START.cmd) (lines 135–184)
- `tools/check-start.js` verifies every `T<n>_PATH`, TOOLCOUNT, and lists unregistered tool pages — [tools/check-start.js](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/tools/check-start.js), [CLAUDE.md](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CLAUDE.md)
- **VRG-DE.cmd** (874 lines): sections MAIN, PROJECT, DEV_CLAUDE (start Claude Code in VRG-DE root / Planner / Inventory via `start "Claude Code" /D <dir> cmd /k call %CLAUDE_CMD%`), DEV_VSCODE, DEV_GITHUB, DEV_LOG, DEV_REPO, DEV_ZEN (Zen sessions ONLINE / LEAD / DEV), PROGRAMS (Chrome, Opera GX, Zen, VS Code, Git Bash, KeyTweak, 7-Zip, Node console, ChromeDriver), PROMPTS (copies a prompt to the clipboard), SELFCHECK, RUN_SERVER / RUN_NODE_SERVER, VENDOR_RUN — [VRG-DE.cmd](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/VRG-DE.cmd)
- Prompt library: 8 shortcut prompts (új funkció, hibakeresés, nagy feladat fázisokra, külső könyvtár, munkamenet indítás, átnézés/review, új eszköz felvétele, adat és mentés) — [tools/prompts](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/tools/prompts)
- Other tools: `fetch-vendor.js` (zero-dep vendor fetcher, keeps `vrg-vendor.html` in sync), `build-hub.js`, `check-hub.js` (no token/key pattern in the built page), `hub-sign.js` (owner signature on the allowed list), `anonymise.js` (swap client job codes) — [tools/](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/tools)
- CoreRef: offline ESPHome/Home Assistant reference DB in `node:sqlite` (`CoreRef/db/coreref.sqlite`, harvest/mirror tools) — [CoreRef/README.md](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CoreRef/README.md)
- Planner client-preview: a three.js 3D tour build (same recipe build.js copies) — [Planner/projects/client-preview](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Planner/projects/client-preview), [CodeCity/build.js header](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CodeCity/build.js)
- `Toolbox/` holds only `valena-life-szerelvenytervezo.html`; `toolbox.html` at the root is the dev mini-tool page — directory listing of [Toolbox](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Toolbox)

### Inferences
- The relay is the obvious **live bus** for the city: Kódváros could join it as role `city` (as the CYD bridge does as `cyd`) and receive Planner dash, Board Console and CYD traffic with no new transport. It needs `ws` resolution from wherever the city server lives (or Node 24's built-in WebSocket client).
- The macropad's `keys` type plus `winkeys.ps1` is an existing, if AV-sensitive, way to drive arbitrary Windows apps; the `planner` type proves remote command routing into an open tab.
- Board Console's `/api/live` and COM-port listing are a ready source for "USB devices" and "hardware as a district" in the overlay.
- VRG-DE.cmd PROGRAMS + START.cmd registry together are the list of "gates" and "launchable programs"; parsing them (check-start.js already parses START.cmd) avoids a second registry.

### Gaps
- No process-listing / Task-Manager-like server exists anywhere in the repo (searched for `createServer|WebSocket|.listen(`; none lists processes).
- No server-sent-events or file-watch (fs.watch) stream to a browser was found; all live views poll or use the relay.
- Inventory's server/price-check internals were not inspected beyond the static server.

## 4. docs/research notes relevant to live telemetry, router, USB, 3D

### Takeaway
Open MCT (vendored, spike working) is a ready telemetry-console framework and its note already designs a
small `vrg-telemetry` Node service (dict / history / WS live) on the relay pattern — a direct template
for a live city feed. The router note gives the real network topology (PC → TP-Link → Huawei ONT → ISP,
double NAT) for the "transport hub" and "abroad" geography.

### Cited Findings
- Open MCT verdict: "a telemetry console framework, not a planning tool" — plots, tables, live values on a background picture, alarms, timelines, notebooks; no commanding API; fetched as npm 4.3.1 (sha512 verified) into `Vendor/openmct` — [docs/research/2026-10-20_openmct-planner-bridge.md §0](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/docs/research/2026-10-20_openmct-planner-bridge.md)
- Recommended data path C: own `vrg-telemetry` service, "one Node process, no deps beyond `ws`", same shape as `phone-relay-server.js`, `node:sqlite` history like CoreRef; protocol `GET /dict`, `GET /history?point&start&end&strategy`, `WS /live`; pluggable inputs `relay`, `modbus`, `ha`, `mqtt`, `sim`; start with live sources that exist today (Board Console agent, Planner dash) — [openmct note §0, §5.3](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/docs/research/2026-10-20_openmct-planner-bridge.md)
- Open MCT capabilities rated: object tree, telemetry provider (history + subscribe), limits, plots, LAD tables, Display Layout ("a picture with live values placed on it"), Fault Management (acknowledge/shelve), Time Conductor, Notebook, Event timestrip, WebPage embedding — [openmct note §2](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/docs/research/2026-10-20_openmct-planner-bridge.md)
- Spike: `docs/research/openmct-spike/` (index.html, serve.js on 8150, vrg-planner.js plugin) — [openmct-spike](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/docs/research/openmct-spike)
- Network facts: PC DESKTOP-EE24ALH, Gigabyte B560M DS3H V2, Realtek GbE, `192.168.0.100` wired → TP-Link TL-WR1043ND `192.168.0.1` → Huawei HG8245H GPON ONT `192.168.1.254` → ISP `91.120.199.243`; double NAT — [docs/research/2026-10-26_router-usb-phone-wake.md](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/docs/research/2026-10-26_router-usb-phone-wake.md)
- Router USB: TP-Link shares a USB stick over SMB/FTP + DLNA; Huawei FTP only; SMBv1-era stock SMB should not be enabled on Windows 10; WoL armed on the PC side (BIOS ErP unchecked); remote sign-in via Tailscale + RDP, never port-forward 3389; old Android phone as Termux SSH terminal and WoL relay — [router note](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/docs/research/2026-10-26_router-usb-phone-wake.md)
- REA note: REA is an MCP server + CLI that drives analysis tools and returns "Evidence records"; rated ★★★ as the most mature MCP contract seen (Evidence, summary vs detail, capabilities/doctor); clone at `H:/Dev-VRG/_research/rea-src/rea`, nothing installed — [docs/research/2026-10-20_rea-reverse-engineer-anything.md §0](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/docs/research/2026-10-20_rea-reverse-engineer-anything.md)
- CAD/MCP note: CADCraft, SolidCraft (read "for the MCP, not for the geometry"), USD BRep vendored at tags; §4 sketches a Planner MCP server — [docs/research/2026-10-19_cad-sources-and-mcp.md](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/docs/research/2026-10-19_cad-sources-and-mcp.md)
- FLIP spike: single-file Canvas-2D fluid sim, 56×41 grid, 2 784 particles ≈ 3 ms/step; reusable parts: MAC grid + pressure projection, counting-sort spatial hash (O(n) neighbour search), Gauss–Seidel relaxation; "ambient visuals" idea for WebGL — [docs/research/2026-10-23_flip-fluid-simulation.md](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/docs/research/2026-10-23_flip-fluid-simulation.md), [flip-spike/index.html](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/docs/research/flip-spike/index.html)
- Chase spike: swept 3D cut (union of cut as a depth map) in one file — [docs/research/2026-10-23_chase-sweep-cut-3d.md](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/docs/research/2026-10-23_chase-sweep-cut-3d.md), [chase-spike/index.html](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/docs/research/chase-spike/index.html)

### Inferences
- The `vrg-telemetry` design (dict + history + WS live, pluggable inputs) maps one-to-one onto a "city live service": inputs `claude-sessions`, `processes`, `fs-watch`, `git`, `relay`, `serial`; Open MCT could even be the 2D "control room" next to the 3D city.
- The router note's hop list is the first concrete content for the transport-hub / shoreline geography (LAN 192.168.0.x = home island, ONT = harbour, ISP = sea).
- The FLIP spatial hash is directly reusable for label de-collision of many floating building labels/vehicles.

### Gaps
- No research note covers Windows process/CPU/RAM telemetry, USB/Bluetooth enumeration from Node, audio sessions or desktop overlay windows; those need new research.

## 5. vendor-manifest.json and Vendor/: pinned libs, and terminal/editor libraries

### Takeaway
three.js r169 (0.169.0) is vendored with the full `examples/jsm` addons, including **CSS3DRenderer**
(HTML panels/iframes placed on 3D buildings), CSS2DRenderer, Fly/FirstPerson/PointerLock controls and
UnrealBloomPass (Tron glow). **No xterm.js, Monaco or CodeMirror is vendored**; the nearest on disk are
EasyMDE (bundles CodeMirror 5) in `_libs`, and VS Code's internal `node-pty`.

### Cited Findings
- Manifest has 31 components (indices 0–30) with `_comment`, `generated`, `vendorDir`, `components`; relevant: three.js (npm), God's Eye View `v0.2.1` tag (MIT), Open MCT (npm), Mind Elixir `v5.15.1`, jsMind `v0.9.1`, excalidraw, fflate, idb-keyval, pdf.js, tesseract.js, playwright, biome, restic, recall, planning-with-files, pascal editor — [vendor-manifest.json](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/vendor-manifest.json)
- Several older entries are pinned to branches (`master`/`main`), e.g. tesseract.js, fflate, idb-keyval, excalidraw, playwright, biome, which conflicts with the CLAUDE.md rule "Source that will be read or adapted is pinned to a tag" — [vendor-manifest.json](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/vendor-manifest.json), [CLAUDE.md](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/CLAUDE.md)
- Fetched in `Vendor/`: cadcraft, diagram-design, excalidraw, fflate, homerougheditor, idb-keyval, inkscape-electric-symbols, jsmind, mind-elixir, openmct, pdfjs, solidcraft, tesseract-js, three, usd-brep — directory listing of [Vendor](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Vendor)
- `Vendor/three/package.json` version 0.169.0; `examples/jsm/renderers`: CSS2DRenderer, CSS3DRenderer, Projector, SVGRenderer; `controls`: Arcball, Drag, FirstPerson, Fly, Map, Orbit, PointerLock, Trackball, Transform; `postprocessing` includes EffectComposer, UnrealBloomPass, OutlinePass, GlitchPass, FilmPass, AfterimagePass — [Vendor/three](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Vendor/three)
- A filename search for xterm / monaco / codemirror / node-pty across the repo (excluding `.git`, `Planner/home`) found only Git-for-Windows terminfo and timezone files — search over [Planner_VRG_U100](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100)
- Unvendored libs in `H:\cwebuser\projects\VRG-DE\_libs`: EasyMDE 2.21.0 (MIT, depends on `codemirror ^5.65.15`), markdown-it 15.0.1, nomnoml 1.7.0, DOMPurify 3.4.14, arduino-cli, miniforge3 — [_libs](file:///H:/cwebuser/projects/VRG-DE/_libs) package.json files
- Portable VS Code 1.134.0 contains `node_modules.asar.unpacked/node-pty` — [Planner/apps/vscode/110a328ea5/resources/app](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Planner/apps/vscode/110a328ea5/resources/app)

### Inferences
- CSS3DRenderer is the existing, licence-clean path for "Zen/web pages laid on buildings" and for in-world file editors/terminals as HTML panels, though cross-origin sites may refuse framing.
- A browser terminal (xterm.js) and code editor (Monaco or CodeMirror 6) would be new vendor entries; they should be added through `vendor-manifest.json` pinned to tags (npm with sha512), per the repo rule.
- VS Code's bundled `node-pty` is built for VS Code's Electron ABI, so it is unlikely to load in plain portable Node v24 (unverified); a real PTY for an in-city terminal probably needs its own `node-pty` (native) or a non-PTY fallback (child_process pipes).

### Gaps
- Whether `@xterm/xterm` is present inside VS Code's `node_modules.asar` was not checked (asar not unpacked).
- No exact versions are recorded in the manifest summary for npm entries (three/openmct) beyond package.json; integrity digests were not inspected.

## 6. Outside the repo on H:\, Planner/apps, and C:\Users\webag\.claude structure

### Takeaway
The machine already has the "Land" contents: portable Chrome, Zen, Opera GX, VS Code, Git, Node with
**Claude Code 2.1.261**, VLC, 7-Zip, KeyTweak, headless Chrome + ChromeDriver; a **CesiumJS 3D globe app
(God's Eye View portable)** that is a ready "planet" renderer; and `~/.claude/sessions/<pid>.json` files
that describe each **running** Claude Code session (pid, sessionId, cwd, status, name) — the live
source the city lacks today.

### Cited Findings
- `Planner/apps`: 7zip, VLC, chrome (152.0.7977.82), chrome-headless-shell, chromedriver, git, keytweak, node, opera-gx (136.0.6008.x), vscode (1.134.0), zen-browser (Version 1.23.3b) — directory listing and version files of [Planner/apps](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Planner/apps)
- Portable Node reports **v24.19.0** (`node.exe --version`), not v24.18 as the brief and CLAUDE.md say; `node_modules` holds `@anthropic-ai` (claude-code **2.1.261**), corepack, npm; `claude.cmd` sits next to node.exe — [Planner/apps/node](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Planner/apps/node)
- `H:\` top level: Dev-VRG, MC-Server (a Minecraft-style server folder: backups, downloads, java, server, tools), Planner_VRG_U100 (backup copy), VRG_Visual_Base, `_desktop` (junction), `_files`, cwebuser, others, user — listing of [H:\](file:///H:/)
- `H:\cwebuser\projects\VRG-DE` siblings: BK2/DM1/P33/NV4 job folders, BRIDGE, BRIDGEcomp, ESP_lab (cyd_term, s3_uart_bridge sketches), FlyBrainLab, Planner_projektek_2026-10-16, Varler_Workflow_Kit, `_backup_untracked_*`, `_desktop` (portable Git), `_edit`, `_files`, `_gev-portable`, `_git-backups`, `_handoff` (objart-V8), `_inbox`, `_installers`, `_libs`, `_needs-review`, `_parked`, `_showcase-2026-10-22`, `_zipped`, `claude` (empty), `wifi-heatmapper` — listing of [VRG-DE](file:///H:/cwebuser/projects/VRG-DE)
- `_installers`: Git 2.55.0.5, KiCad portable 10.0.4 and 10.0.6, NotepadMD, Opera GX 134, arduino-cli 1.5.1, keytweak 2.3.1, miniforge, VLC 3.0.24, Zen installer; `_zipped`: PortableGit, VSCode 1.134.0, chrome/headless/chromedriver, node-v24.19.0, mermaid, markdown-it, nomnoml, EasyMDE, DOMPurify — [_installers](file:///H:/cwebuser/projects/VRG-DE/_installers), [_zipped](file:///H:/cwebuser/projects/VRG-DE/_zipped)
- **God's Eye View portable**: "A 3D globe in your browser with live, public data: flights, satellites, earthquakes, weather, storms, public traffic cameras, radio, rocket launches"; runs from its folder with its own Node (node-v24.22.1 zip); free setup with no keys; app has `node_modules/cesium` 1.138.0, `ws`, `vite-plugin-cesium`, and `server/` with `mcp`, `providers`, `standalone` — [_gev-portable/GodsEyeView/HOW-TO.txt](file:///H:/cwebuser/projects/VRG-DE/_gev-portable/GodsEyeView/HOW-TO.txt), [app](file:///H:/cwebuser/projects/VRG-DE/_gev-portable/GodsEyeView/app)
- wifi-heatmapper (Next.js app): measures Wi-Fi signal strength and throughput and draws heat maps on a floor plan; data stays local in `data/surveys/` — [wifi-heatmapper/README.md](file:///H:/cwebuser/projects/VRG-DE/wifi-heatmapper/README.md)
- `_showcase-2026-10-22`: a gallery `index.html` with launchers for Kapu (full mode), Board Console, Planner CYD demo, Inventory server, all tests — [_showcase-2026-10-22](file:///H:/cwebuser/projects/VRG-DE/_showcase-2026-10-22)
- `H:\VRG_Visual_Base`: 01_Hardware (ESP32-S3_IO-Board, Topology_Starter with `make_*.js` generators and `CONCEPT_Board_Console.md`, collected), 02_Planner_Plans (mocks, SVG elevations, client-preview template), 03_BRIDGE_SmartHome, 04_Pricing_Kit, 05_Tools_Apps (copies of toolbox, inventory, vendor, mindmap pages), `_tools/collect_visuals.js`, `INDEX.md`, `index.html` — [VRG_Visual_Base](file:///H:/VRG_Visual_Base)
- `C:\Users\webag\.claude` structure: `projects/<mangled-cwd>/` (37 entries for this repo: `<uuid>.jsonl` transcripts and `<uuid>/` folders; also folders for `H--Dev-VRG-VRG-DE-Planner-VRG-U100`, the backup mirror, the old `codecity` worktree, `SecAcc`), `sessions/` (20 entries: `<pid>.json` + `<pid>.<hash>.key`), `daemon/` (roster.json, pty-pids, dispatch, attach-journal, key files), `jobs/`, `file-history/`, `shell-snapshots/`, `history.jsonl`, `plugins/`, `skills/synced`, `telemetry/`, `settings.json` — listing of [C:\Users\webag\.claude](file:///C:/Users/webag/.claude)
- `sessions/<pid>.json` keys (contents not read beyond key names): `pid, sessionId, cwd, startedAt, procStart, version, peerProtocol, peerFeatures, kind` (e.g. `interactive`), `entrypoint, pidDomain, messagingSocketPath, name, nameSource, status, updatedAt, statusUpdatedAt, parkedJobId`/`bridgeSessionId` — [~/.claude/sessions](file:///C:/Users/webag/.claude/sessions); `daemon/roster.json` keys `proto, supervisorPid, updatedAt, workers` — [~/.claude/daemon/roster.json](file:///C:/Users/webag/.claude/daemon/roster.json)
- User `settings.json` keys: permissions, enableWorkflows, extraKnownMarketplaces, skipWorkflowUsageWarning, theme, agentPushNotifEnabled, inputNeededNotifEnabled — **no hooks configured**; no `~/.claude/hooks`, `agents` or `commands` folders; the repo has `.claude/agents/vrg-piacmero.md` and `.claude/launch.json`, no project `settings.json` — [~/.claude/settings.json](file:///C:/Users/webag/.claude/settings.json), [repo .claude](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/.claude)

### Inferences
- **Live Claude traffic without hooks**: tailing the newest `projects/<cwd>/*.jsonl` (with `sessions.js`'s privacy filter) plus reading `sessions/*.json` for which sessions are alive and where (`cwd`, `status`) would let the city show live cars per session. A Claude Code `PostToolUse` hook writing path + kind to a local file/socket is the cleaner alternative; none exists yet, and adding one is a settings change that needs the user's approval.
- God's Eye View's CesiumJS globe is the most direct existing asset for the **GitWorld planet** level (and its "abroad" layer: flights, ships); Cesium is Apache-2.0 (from general knowledge, not checked here) and GEV is MIT per the manifest. Mixing a Cesium globe with three.js cities would be two renderers; a three.js sphere might be simpler (inference).
- The `H:\` listing itself (repo, VRG_Visual_Base, MC-Server, job folders, `_installers`, `_zipped`) is the content of the user's "Land": each top folder is a candidate town; `_installers`/`_zipped` are "warehouses/port depots" of downloaded programs.
- wifi-heatmapper could later feed real Wi-Fi strength into the router "transport hub".

### Gaps
- The meaning of `sessions/*.json` `status` values and whether they update live was not observed over time.
- `MC-Server`, `FlyBrainLab`, `Varler_Workflow_Kit` and `_parked` contents were only listed, not assessed.
- The Claude desktop app's install path (for "open the Claude app") was not located (`AppData\Roaming\Claude` exists per the skill path, but the executable was not looked up).

## 7. BRIDGE/: the system concept and its relation to a live nervous-system view

### Takeaway
BRIDGE is a home-infrastructure concept with a ready vocabulary for a "nervous system" view: BASE
(NET/COMP/MEDIA) → CHANNEL spine → ROOMBOX per room → ARM to endpoints, ten conduit layers, and gear tiers
up to "T7 the operator or agentic interface". It is hardware planning, not software; its live side is
Open MCT / telemetry later.

### Cited Findings
- "BRIDGE is a fixed pathway system with replaceable intelligence"; elements BASE (NET comms, COMP coordinator, MEDIA storage/streams), CHANNEL ("physical chain, logical star"), ROOMBOX, ARM; doctrine "manual-first, implemented in hardware" — [BRIDGE/BRIDGE-OUTLINE-001_General-Outline.md §0](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/BRIDGE/BRIDGE-OUTLINE-001_General-Outline.md)
- Ten conduit families (MAINS, LV, CONTROL, DATA, MEDIA, USB, KNX, SENSOR, RF, SECURITY, NOTIFICATION), only four on the CHANNEL; gear tiers T1 base gateways … T5 the coordinator, T6 adaptive/predictive, T7 operator or agentic interface; "COMP coordinates and never computes" — [BRIDGE-OUTLINE-001 §2](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/BRIDGE/BRIDGE-OUTLINE-001_General-Outline.md)
- Folder: 01_architecture … 10_media-wall, `_build`, `_tuner`, `_source-variants`; OmniComm hub (CM5) drawings incl. `network_core_topology.svg`, `full_system_connection_chain.svg`, `omnicomm_radio_spectrum.svg` — [BRIDGE/README.md](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/BRIDGE/README.md), [BRIDGE/03_omnicomm-hub](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/BRIDGE/03_omnicomm-hub)
- Open MCT note maps BRIDGE's STD-004 register map to a telemetry dictionary, event ring to an event stream, heartbeat/autonomy/fault to Fault Management — [openmct note §0](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/docs/research/2026-10-20_openmct-planner-bridge.md)
- Kódváros §7.2 #3 names the Harbour as "Where BRIDGE hardware enters first" (ESPHome devices docking) — [docs/city/README.md §7.2](file:///H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/docs/city/README.md)

### Inferences
- BRIDGE's layered model (spine + room nodes + typed conduits) is structurally the same as the user's GitWorld idea (PC as compute node, router as transport hub, typed traffic: ships/planes/trains). Reusing BRIDGE's layer names for the city's "infrastructure lens" would give one vocabulary across home and code.
- The Board Console / CYD / knob pad / ESP32 devices are the only live hardware today; they are the first "devices" an overlay could show.

### Gaps
- BRIDGE sub-documents (ARCH-001/002, STD-00x) were not read in full; only the outline and README.
