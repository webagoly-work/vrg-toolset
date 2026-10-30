# Wire Kódváros into a living GitWorld

*Research report, 2026-10-26. Synthesised from six research notes in `docs/research/research_notes/Kódváros live workspace and GitWorld/` (01 our assets, 02 workspace architecture, 03 Windows live telemetry, 04 overlay OS layer, 05 GitWorld map and repos, 06 media REA candidates) and `docs/city/README.md` §7. No code was changed. Sections 1–7 answer the seven parts of the brief; section numbers are stable because the prompt series in §7 points into them.*

Kódváros can become a live workspace without a rewrite and without new toolchains. **The one piece that unlocks almost everything already exists in the repo**: the parked Kapu companion server (`CodeCity/from-kapu/companion-server.js`), a hardened 127.0.0.1 Node process that serves a page, injects a per-install token and launches whitelisted programs from argument arrays. Extend it into `CodeCity/companion.js`, and the city gets a real origin (fixing `file://` storage and editor workers), a right-click (RCO) menu that opens folders, VS Code, terminals, Claude Code and the Claude app, and a live event stream. The best live source for "watching Claude work" is a **Claude Code HTTP hook** that POSTs every tool call to the companion and fails silently when the city is closed ([Claude Code hooks](https://code.claude.com/docs/en/hooks)); parallel sessions come from `claude agents --json`, the documented "supported interface" for session state ([agent view](https://code.claude.com/docs/en/agent-view)). The GitWorld geography (planet → Land → Kódváros, Tárház, Erőmű, Pályaudvar, USB-falu → district → building → floor) needs **nested scale frames with a camera hand-off**, because float32 cannot hold a planet and a function floor in one coordinate system. Windows system data splits cleanly into three tiers: a no-admin tier that covers CPU, RAM, GPU, connections, windows, audio, media, USB and Bluetooth; an elevated, read-only ETW tier for per-process bytes and "who touched which file on H:"; and things to avoid outright (packet capture, TLS interception, driver swaps). The overlay OS is a late phase: Electron is the only host whose documented JavaScript APIs cover transparency, click-through with mouse forwarding, hotkeys and window capture, but this PC runs **Windows 10 21H2 (build 19044)**, out of servicing, and should move to 22H2 first. The design rule that matters most for a user who does not code is borrowed from process plants: **a calm, grey city means all is well; colour appears only when something needs you** ([Control.com: Going Gray](https://control.com/technical-articles/going-gray/)). Twenty decisions are listed in §6.3, and §7 gives 27 short prompts, one per roadmap step.

---

## 1. One local companion server carries every live feature

The brief asks for many things at once: open and edit files, watch processes, launch programs, right-click menus, Claude app and terminal, multi-select, shortcut prompts, agent choice, Ctrl+K, live Node.js and git, then a planet-to-floor geography, then an overlay OS. They share one hard constraint. A page opened from `file://` has no origin, so `localStorage` fails silently (repo `CLAUDE.md`), and Monaco states that "HTML5 does not allow pages loaded on `file://` to create web workers" ([monaco-editor](https://github.com/microsoft/monaco-editor)). And a browser page can never start a process. Everything live therefore needs a local process the page talks to. The question is only which shape that process takes.

### 1.1 Host architecture: five options, one clear default

| Option | What it is | For | Against | Licence / admin |
|---|---|---|---|---|
| **A. Static page + local Node companion** (recommended) | `node CodeCity/companion.js` serves the city on `http://127.0.0.1:<port>`, injects a token, exposes whitelisted actions and an event stream | Reuses tested code (`from-kapu/test/spec-95-companion.js`), the portable Node v24 already present, START.cmd as the front door; the `file://` build keeps working as a read-only view | Lives in a browser tab, which a non-coder can lose; no overlay powers | own code; no admin |
| B. Electron | Chromium + Node in one desktop app | One icon, one window; the companion becomes the main process with little change | ~100–300 MB; a stream of Chromium updates; must follow the security checklist (context isolation, sandbox, no Node in remote content, CSP, IPC sender checks, fuses) ([Electron security](https://www.electronjs.org/docs/latest/tutorial/security)) | MIT; no admin |
| C. Tauri | Rust shell on WebView2 | One like-for-like benchmark measured **Tauri at 57 MB vs Electron at 323 MB** ([Better Stack](https://betterstack.com/community/guides/scaling-nodejs/tauri-vs-electron-vs-deno-vs-electrobun/)) | Needs Rust + MSVC (not installed, admin install); only the MSVC target is supported and `.msi` needs WiX ([Tauri Windows installer](https://v2.tauri.app/distribute/windows-installer/)); node-pty or git still need a Node sidecar | Apache-2.0/MIT; admin for the toolchain |
| D. VS Code as the editor half | D1: RCO → "Open in VS Code" (portable `Planner/apps/vscode`) or `vscode://anthropic.claude-code/open` ([deep links](https://code.claude.com/docs/en/deep-links)); D2: Kódváros as a VS Code extension webview | D2 gives editor, terminal, git and Claude for free | D2 buries the city inside IDE chrome the user finds confusing; code-server cannot use the Microsoft Marketplace ([code-server FAQ](https://coder.com/docs/code-server/FAQ)) | MIT; no admin |
| E. PWA | Installable app window over localhost | App feel, offline cache | Cannot spawn processes, so still needs A | — |

**Recommendation: A now, written so the companion's action/stream API is the only boundary; B later becomes a packaging step, not a rewrite** (and B is also the overlay host in §1.5). D1 is folded into A as RCO actions from day one. The companion already binds 127.0.0.1 only, checks Host and Origin against fixed sets, compares the token with `timingSafeEqual`, accepts only whitelisted actions with exact argument shapes, realpaths every path inside allowed roots, and spawns from argument arrays, never shell strings ([companion-server.js](file:///H:/VRG/Full/Planner_VRG_U100/CodeCity/from-kapu/companion-server.js)).

The live transport has two parts. A **one-way event stream** (repo changes, Claude events, system samples) fits Server-Sent Events: zero dependencies and a plain `EventSource`. A **two-way channel** is needed only for an embedded terminal, and that needs WebSocket via `ws`, which is already installed at 8.21.3 for the phone relay ([varler-planner/node_modules/ws](file:///H:/VRG/Full/Planner_VRG_U100/Planner/projects/varler-planner/node_modules/ws)). Browsers cannot set custom headers on `EventSource` or `new WebSocket()`, and a token in the URL leaks into logs. So for the stream, the design proposal here is a `SameSite=Strict`, `HttpOnly` cookie set when the companion serves the page, plus the fixed-list Origin check. For WebSocket, the token goes in the first message, and the socket is dropped if it does not arrive within ~2 s. Origin must be compared to a configured list, never derived from `Host`. That exact mistake is Jenkins CVE-2026-33002 ([Rapid7](https://www.rapid7.com/db/vulnerabilities/jenkins-2026-03-18_cve-2026-33002/)), and DNS rebinding is the attack it enables ([NCC Group Singularity](https://github.com/nccgroup/singularity/wiki/%5BAnnouncement-Blog-Post%5D--Singularity-of-Origin:-A-DNS-Rebinding-Attack-Framework)).

The companion's actions fall into four **approval tiers**. **Read** is always allowed. **Open/launch** needs the token. **Write/run** needs the token plus an in-page confirmation that shows the exact path or command. **Destructive git** is handed to Claude Code as a prompt, or goes through a two-step confirm that first makes a safety ref. A terminal endpoint is remote code execution by design, so it must spawn only the configured shell or `claude` binary and stay off until switched on (note 02, Q10).

### 1.2 Claude Code integration: hooks for live, agent view for sessions, deep links for launching

| Need | Method | Status / caveat |
|---|---|---|
| See each file Claude reads, searches, edits, live | **`http` hook** on `PreToolUse` + `PostToolUse` (+ `PostToolUseFailure`, `SessionStart/End`, `SubagentStart/Stop`, `Stop`, `WorktreeCreate`). Every event carries `session_id`, `cwd`, `transcript_path`, `agent_id`; tool events add `tool_name`, `tool_input`, `tool_use_id`. Connection failures are **non-blocking by default** ([hooks](https://code.claude.com/docs/en/hooks)) | A settings change, so the user decides. The Write input carries the **file content**: strip it at the door. A small `command` hook that strips the content and POSTs the rest keeps it off the wire entirely. The companion's 16 KB body limit must rise only if raw http hooks are used |
| Zero-config fallback | Tail `~/.claude/projects/<cwd>/*.jsonl` with the existing privacy filter in [CodeCity/sessions.js](file:///H:/VRG/Full/Planner_VRG_U100/CodeCity/sessions.js) | The docs warn the format "is internal to Claude Code and changes between versions" ([sessions](https://code.claude.com/docs/en/sessions)) |
| Parallel sessions and their state | Poll `claude agents --json --all`: `state` (`working/blocked/done/failed/stopped`), `status`, `waitingFor` (e.g. `permission prompt`), `cwd`, `name` ([agent view](https://code.claude.com/docs/en/agent-view)) | Research preview. `~/.claude/sessions/<pid>.json` holds similar keys locally (note 01) but is not a stable interface |
| Files touched inside Bash | `bashEditDiff.changedFiles` on PostToolUse (v2.1.269+, best-effort) or ETW Kernel-File (Tier B, §1.4) | — |
| Model calls as departing planes | OpenTelemetry `claude_code.api_request` with tokens, cost and duration, batched every 5 s; keep `OTEL_LOG_USER_PROMPTS` off ([monitoring](https://code.claude.com/docs/en/monitoring-usage)) | Optional |
| Open a Claude Code terminal here | `claude-cli://open?cwd=<abs>&q=<prompt>`: Windows Terminal → PowerShell → cmd; the prompt is **pre-filled, never auto-sent**; `q` ≤ 5,000 characters ([deep links](https://code.claude.com/docs/en/deep-links)) | Needs no native module, so it is the first step before an embedded terminal |
| Open the Claude app | `claude://code/new?q=…&folder=<abs>`; the desktop app asks before using a linked folder ([Claude Desktop links](https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link)) | A vendor report claims a crafted `claude://` link could auto-submit a prompt; not verified as fixed ([Oasis report](https://pages.oasis.security/rs/106-PZV-596/images/promptfiction-claude-desktop-technical-report.pdf?version=0)), so the city only builds links from its own templates |
| Start a job with a chosen agent | `claude --bg --name <job> --agent <subagent> "<prompt>"`, or `claude -p --output-format stream-json --verbose` for short shortcut prompts ([headless](https://code.claude.com/docs/en/headless)) | Since v2.1.302, `-p` starts in Manual mode, so calls that need approval are denied unless a `PermissionRequest` hook or `--permission-prompt-tool` approves them |
| Claude asks the city | Existing `CodeCity/mcp.js` (C10) | Add a reverse tool later (`city_selection`: what the user has selected) |

**The installed Claude Code is older than several of these features.** The portable install reports **2.1.261** (note 01). The docs date `bashEditDiff` to 2.1.269, `onFailure: "block"` to 2.1.295 and the `-p` Manual mode to 2.1.302. Whether `http` hooks and `claude agents` exist in 2.1.261 was not checked, so P4 starts with a version check (decision 5). The Agent SDK is richer, but its docs say third-party developers may not offer claude.ai login "unless previously approved" ([Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview)). Driving the user's own installed `claude` CLI avoids that question for a personal tool. Prior art: `disler/claude-code-hooks-multi-agent-observability` pipes hooks → server → SQLite → WebSocket → swim lanes per session, but it has **no licence**, so ideas only ([repo](https://github.com/disler/claude-code-hooks-multi-agent-observability)).

### 1.3 Editor, terminal, git, watching, search, selection

| Part | Recommended | Alternatives and why not first | Key facts |
|---|---|---|---|
| File viewer/editor + diff | **CodeMirror 6 + `@codemirror/merge` + `markdown-it` + DOMPurify** | Monaco: "VS Code in a box", 99 MB unpacked, needs http(s) for workers, AMD build deprecated ([monaco-editor](https://github.com/microsoft/monaco-editor)) | CodeMirror's GitHub mirrors were **archived 2026-04-15**; development moved to code.haverbeke.berlin and npm still publishes ([codemirror/dev](https://github.com/codemirror/dev), [codemirror.net](https://codemirror.net/)). Vendor it as `source: "npm"` with a sha512 digest, not from the archived mirror. `@codemirror/merge` 6.12.3 is 179 KB unpacked ([npm](https://www.npmjs.com/package/@codemirror/merge)) |
| Embedded terminal | **`@xterm/xterm` 6 + node-pty 1.1.0**, phase 2 after the deep link | Spawning without a PTY (child_process pipes) breaks Claude's full-screen TUI | node-pty 1.1.0 ships `prebuilds/win32-x64` including `conpty.dll` and `OpenConsole.exe` ([unpkg listing](https://unpkg.com/node-pty@1.1.0/?meta)); it uses Node-API, so it should load under Node v24 without Visual Studio (test once). Pass `SystemRoot` in the env or PowerShell fails with 8009001d ([node-pty](https://github.com/microsoft/node-pty)). Set `CLAUDE_CODE_GIT_BASH_PATH` to `H:\VRG\Full\tools\git\bin\bash.exe` ([setup](https://code.claude.com/docs/en/setup)). Name sessions `claude -n <name>` so a restart can `--resume` |
| Git | **simple-git** over the portable `git.exe` ([steveukx/git-js](https://github.com/steveukx/git-js)) | isomorphic-git has no worktree, reflog or rebase ([command index](https://isomorphic-git.org/docs/en/alphabetic)); nodegit is a heavy native build; gitgraph.js is **archived** ([repo](https://github.com/nicoespeon/gitgraph.js)) | Data comes from `worktree list --porcelain`, `for-each-ref`, `rev-list --left-right --count main...<b>`, `status --porcelain=v2 -z`, `reflog`. Draw the graph in three.js ourselves |
| File watching | `fs.watch(recursive)` or **chokidar 6** (rewrite on native recursive watch, needs Node 22.22+) ([chokidar](https://github.com/paulmillr/chokidar)) | @parcel/watcher coalesces `git checkout` bursts and can report "changes since last snapshot" ([parcel watcher](https://github.com/parcel-bundler/watcher)), but Windows prebuilds were not confirmed | Debounce ~300–500 ms, rescan only changed files, patch instances with `setMatrixAt`/`setColorAt`; watch `.git/HEAD`, `refs`, `worktrees`, `logs/HEAD` separately |
| Processes | In-house supervisor: config-listed programs, argv only, ring buffer per job, `taskkill /PID <pid> /T /F` | **PM2 is AGPL-3.0**: idea only ([Unitech/pm2](https://github.com/Unitech/pm2)) | Fire-and-forget launches stay detached; supervised jobs (dev servers, builds, tests) pipe their output |
| Ctrl+K | Own palette (lift `from-kapu/src/js/41-search.js`, accent-insensitive NFD) + **uFuzzy** for names and paths ([uFuzzy](https://github.com/leeoniya/uFuzzy)), optional MiniSearch for contents ([MiniSearch](https://github.com/lucaong/minisearch)) | cmdk and kbar are React; ninja-keys idle since 2024 | Prefixes: `>` commands, `@` agents, `#` branches; one palette over files, actions, prompts, agents, sessions, branches, START.cmd tools |
| Multi-select | Ctrl+click toggles a `Set<instanceId>`; Shift+drag uses three.js `SelectionBox`, which already returns instance IDs for `InstancedMesh` ([SelectionBox.js](https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/jsm/interactive/SelectionBox.js)) | OutlinePass outlines whole objects, not instances | Highlight with a second instanced "shell" mesh; group actions re-validate every path server-side |

The research record supports the spatial idea itself, with a caveat. **Code Park** (classes as rooms, overview plus first-person) "significantly helps in code understanding compared to a traditional IDE" ([arXiv 1708.02174](https://arxiv.org/pdf/1708.02174)), and **Code Bubbles'** working sets reduced navigation ([Brown](https://cs.brown.edu/people/spr/codebubbles/about.html)). But Cockburn and McKenzie found that **performance got worse as freedom in the third dimension grew** ([CHI 2002](https://courses.washington.edu/hcde511/a14/readings/cockburn-chi02.pdf)). The rule that follows runs through the whole report: **3D is for overview, status and "where am I"; reading and typing happen in flat 2D panels**, and nothing is ever user-placed in depth.

### 1.4 Live system data: three tiers, chosen by admin need

This PC, measured read-only (note 03): **Windows 10 Pro 21H2, build 19044**; the Claude shell is **not elevated**; **.NET 8 runtimes only, no SDK** (.NET 8 support ends **2026-11-10**); no Rust; portable **Node v24.19.0** (CLAUDE.md says v24.18.0; the binary reports 24.19.0); a **GTX 1050 Ti** with `nvidia-smi`; 101 per-process GPU counter instances; 103 established TCP connections readable unelevated in ~1.3 s; Bluetooth with 26 PnP entries; 12 USB PnP entries; no Equalizer APO.

| Tier | What it covers | How | Admin |
|---|---|---|---|
| **Tier 0 – no install** (prototype) | CPU/RAM/disk/net totals, per-process CPU/RAM, TCP connections with owning PID, USB volumes, BT paired list, Spotify window title | `typeperf -si 1` streamed to Node (wildcards expand only at start, so restart it periodically), one long-lived PowerShell child, `Get-NetTCPConnection`, `Get-PnpDevice` | No |
| **Tier A – unelevated sidecar** `vrg-probe.exe` (C#, self-contained, JSON lines over stdio) | PDH counters keyed by `ID Process` (Win10 instance names renumber), GPU engines, `GetExtendedTcpTable`, window list + `SetWinEventHook` (needs a message loop, hence a sidecar), Core Audio sessions (PID, volume, mute, 30–60 Hz peaks via NAudio, MIT), **GSMTC** now-playing (Win10 1809+) ([Learn](https://learn.microsoft.com/en-us/uwp/api/windows.media.control.globalsystemmediatransportcontrolssessionmanager)), Bluetooth `DeviceWatcher`, USB tree from `DEVPKEY_Device_LocationPaths` + hot-plug | .NET SDK unpacked into `Planner/apps/dotnet` (gitignored, no admin). .NET 10 lists only 21H2 Enterprise/IoT and LTSC as supported ([.NET 10 OS list](https://github.com/dotnet/core/blob/main/release-notes/10.0/supported-os.md)), so a self-contained publish is the safe route | No |
| **Tier B – elevated, read-only** `vrg-etw.exe` | **ETW Kernel-Network** (PID, size, addresses per send/receive: the real ships and planes), **Kernel-File** (who reads/writes which file on H:, names via a FileKey→path map) ([manifest](https://github.com/repnz/etw-providers-docs/blob/master/Manifests-Win10-17134/Microsoft-Windows-Kernel-File.xml)), Kernel-Process tree, DNS-Client names | TraceEvent (MIT). Events arrive **~1–3 s late** ([TraceEvent guide](https://github.com/microsoft/perfview/blob/main/documentation/TraceEvent/TraceEventProgrammersGuide.md)), which still reads as live. Started by one scheduled task "run with highest privileges" that the **user creates themselves**. No network listener; a named pipe with a current-user ACL; no command takes paths | Yes, once |

**Bridging into Node:** C# sidecar (recommended: crash-isolated, no Node ABI coupling); koffi (MIT, prebuilt) only for small synchronous Win32 calls ([koffi](https://koffi.dev/)); a persistent PowerShell child as Tier 0; `systeminformation` (MIT) for one-off inventories only, since its docs warn `getAllData()` can take up to 20 s on Windows ([systeminformation](https://systeminformation.io/general.html)). NodeRT and edge-js are ABI-fragile; Rust needs an admin MSVC install.

**Avoid:** Npcap (free licence allows ≤ 5 installs and no redistribution ([npcap.com](https://npcap.com/)), and it pulls private payloads into the app); TLS interception; WinRing0-based monitors (Defender flags them, so use only a PawnIO build of LibreHardwareMonitor, MPL-2.0 ([LHM](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor))); online GeoIP APIs (they would receive the whole connection list: use **DB-IP Lite, CC BY 4.0, offline `.mmdb`** ([DB-IP](https://db-ip.com/db/lite.php))); driver swaps to WinUSB; `--remote-debugging-port` on browsers. Procmon's current Learn page lists **"Runs on: Windows 11 and higher"** and it cannot stream ([Procmon](https://learn.microsoft.com/en-us/sysinternals/downloads/procmon)). Per-app audio loopback officially needs build 20348 ([Learn](https://learn.microsoft.com/en-us/windows/win32/api/audioclientactivationparams/ns-audioclientactivationparams-audioclient_process_loopback_params)), so on 19044 the stadium uses per-session peak meters. The Spotify Web API is out for visuals: since February 2026 a dev-mode app owner needs Premium and new apps get 5 users ([migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide)), and the policy forbids synchronising recordings with visual media ([policy](https://developer.spotify.com/policy)). **GSMTC metadata plus the OS peak meter never touch the Spotify Platform.**

### 1.5 Overlay layer: ride on top of Windows, never replace it

Every robust modern desktop layer (Seelen UI, Zebar, YASB, Rainmeter, Lively) runs **on top of** explorer.exe. ExplorerPatcher, which patched explorer, was flagged by Defender and broke on updates (note 04). The proposal is three layers of one app:

| Layer | Purpose | Method | Licence |
|---|---|---|---|
| L0 Wallpaper | Ambient city behind the icons, 1–5 fps | **Lively** pointed at the companion URL, no code ([Lively](https://github.com/rocksdanister/lively)) | GPL-3.0, used as the user's program only |
| L1 HUD strip | Glanceable "needs you" and counts | Electron window, always on top, `showInactive()`, `setFocusable(false)` | MIT |
| L2 Summoned controller | Full-screen transparent overlay on a hotkey | Electron `setIgnoreMouseEvents(true, {forward:true})`: clicks fall through while mouse moves still reach the page ([BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window)); `globalShortcut` returns false silently if the combo is taken; one window per monitor | MIT |
| Windows on buildings | Live textures far away, the real window up close | `desktopCapturer` → `<video>` → `THREE.VideoTexture` ([desktopCapturer](https://www.electronjs.org/docs/latest/api/desktop-capturer)), then the **portal hand-off**: fly in, `SetWindowPos` the real Zen window to the facade's screen rectangle, hide the overlay | Built-in |

| Host | Fit |
|---|---|
| **Electron** (recommended) | All the overlay tricks in documented JS. Known bug: transparent windows render **black on some GPUs with hardware acceleration** ([electron#40515](https://github.com/electron/electron/issues/40515)), so test on the GTX 1050 Ti first |
| Tauri | `setIgnoreCursorEvents` has **no forward option**, so you poll the cursor yourself; window capture needs Rust; depends on WebView2 |
| C# WebView2 helper | Most native power, but a second codebase; fine as a helper process later |
| Zebar (GPL-3.0) | Already hosts HTML widgets with audio, media, CPU and network providers ([zebar](https://github.com/glzr-io/zebar)): usable as the user's program for Kódváros-styled widgets, but no code copied |

Platform limits: on Windows 10 a captured window **always gets the yellow capture border**, because `IsBorderRequired` needs build 20348+ ([Learn](https://learn.microsoft.com/en-us/uwp/api/windows.graphics.capture.graphicscapturesession.isborderrequired)). Minimised windows produce no frames, so park them behind instead. Do not reparent foreign windows with `SetParent`: Raymond Chen calls cross-process parenting legal but near-impossible to manage ([Old New Thing](https://devblogs.microsoft.com/oldnewthing/20130412-00/?p=4683)). Zen (Firefox) cannot be embedded, only captured, positioned and, at most, remote-controlled through a separate profile. Microsoft's promise to keep Edge and the WebView2 runtime updated until at least October 2028 applies to **22H2** ([Thurrott](https://www.thurrott.com/cloud/324473/microsoft-edge-on-windows-10-to-be-supported-until-october-2028)), so the 21H2 → 22H2 enablement step comes before any WebView2 host (decision 11). Staying light: render on demand (already true in `03-scene.js`), cap at 30 fps when summoned, `hide()` when dismissed, pause on fullscreen apps, and keep 1–3 live window textures with thumbnails for the rest. The 3D-desktop graveyard (Looking Glass, BumpTop, Flip 3D, Horizon Workrooms, discontinued 16 February 2026 ([Road to VR](https://www.roadtovr.com/meta-horizon-workrooms-discontinued-2026))) supports the same lesson as §1.3: **what lasts is real 2D windows arranged in space.**

### 1.6 Map and zoom: nested scale frames, never one giant coordinate system

float32 has about seven significant digits. If one unit is a metre and the planet radius is 6.4 million, positions near the surface quantise to ~0.5 m, so buildings jitter and floors are impossible (note 05).

| # | Method | Verdict |
|---|---|---|
| M1 | One world + `logarithmicDepthBuffer` | Not recommended: fixes depth but not vertex jitter, and kills early-Z (~65 → ~35 fps reported) ([three.js forum](https://discourse.threejs.org/t/beware-of-logarithmic-depth-buffer-it-can-degrade-scene-performance/88495)) |
| M2 | One world + floating origin | Planet ↔ Land only; every system must respect the rebase |
| **M3** | **Nested scale frames + camera hand-off**: each level is an `Object3D` in its own units; on crossing a threshold, re-parent the camera into the child, rescale, set near/far to `dist×1e-3 … dist×1e3`; draw the parent as a scaled impostor | **Recommended for L0–L5.** The existing city keeps its units untouched |
| M4 | Separate scenes + tween + crossfade (`RenderTransitionPass`, present in r169) | Fallback, and the cleanest way into building interiors |
| M5 | Semantic zoom: dot + label → skyline impostor → buildings → floors, with hysteresis | Required inside M3/M4 |

A **globe-to-map morph** in the vertex shader (lerp each vertex between the sphere and the tangent plane at the Land's centre) hides the M3 seam. For the planet: **G1, an own three.js sphere** (icosphere or `hexasphere.js`, MIT) with instanced dots and a back-face halo, as in the GitHub globe ([GitHub blog](https://github.blog/engineering/how-we-built-the-github-globe)). `three-globe` (MIT) works with r169 as a prototype, but **globe.gl ≥ 2.46 needs three ≥ 0.179**, and Cesium or MapLibre would add a second renderer. Countries come from a **spherical Voronoi** over persisted seeds (`d3-geo-voronoi`, ISC, which also returns the Urquhart graph as a ready road network) ([README](https://unpkg.com/d3-geo-voronoi@2.1.0/README.md)). Places on the Land take **hex slots assigned once and never re-laid-out**, the city's "layout over every file that ever existed" rule lifted one level. For the GitHub planet: P1 ecosystem continents, P3 dependency distance for the "ours-adjacent" zone, and P2 (anvaka's Map of GitHub, code MIT, data "please attribute") as a faint background. Rate limits: **60 requests/h unauthenticated, 5,000/h with a token, and 304s are free only when authenticated** ([GitHub docs](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)). The closest precedents are Netflix **Vizceral** (Apache-2.0, unmaintained: global → region → service with traffic particles) ([repo](https://github.com/Netflix/vizceral)) and **ExplorViz** (a three.js software landscape with semantic zoom and a mini-map, evaluated in user studies) ([arXiv 2510.00003](https://arxiv.org/abs/2510.00003)).

| Level | Name | What it is | Source of truth |
|---|---|---|---|
| L0 | GitWorld | GitHub / all code; other repos as foreign countries | `world.json` (fetched snapshot) |
| L1 | Land | everything ours, on hex slots; coastline = the internet border | `land.json` |
| L2 | Kódváros · Tárház · Erőmű · Pályaudvar · USB-falu · Határ | repo city · H: drive warehouse town · PC compute node · TP-Link station · USB village (appears on plug-in) · Huawei ONT border crossing | `city.json`, `disk.json`, live samples |
| L3–L5 | District · building · floor | folder · file · top-level function/section | `city.json` (+ new `outline`) |

The real topology is already known: PC `192.168.0.100` → TP-Link TL-WR1043ND `192.168.0.1` → Huawei HG8245H ONT `192.168.1.254` (**double NAT**) → ISP `91.120.199.243` ([router note](file:///H:/VRG/Full/Planner_VRG_U100/docs/research/2026-10-26_router-usb-phone-wake.md)). So the Land has a local station and a separate border crossing. When the network is down, the border closes and ships wait in the harbour, while every local source keeps working.

### 1.7 Flows: ships, planes, trains as one instanced system

| Rendering | Use | Source |
|---|---|---|
| F1 GPU-instanced Bézier ribbons (curve evaluated in the vertex shader) | planes, packets, thousands per draw call | [Shopify BFCM globe](https://shopify.engineering/how-we-built-shopifys-bfcm-2023-globe) |
| F2 `CubicBezierCurve3` → `TubeGeometry` + `setDrawRange` | "the few downloads now"; simplest first step | [GitHub globe](https://github.blog/engineering/how-we-built-the-github-globe) |
| F3 Routes sampled into a DataTexture, vehicles as instances `(routeId, t0, speed)` | ships and trains on fixed lanes | [three.js forum](https://discourse.threejs.org/t/spline-datatexture/14252) |

| Event | Vehicle | Size | Route | No-admin source |
|---|---|---|---|---|
| Large download > 50 MB | container ship | containers ≈ 10 MB each | sea lane from the host's dock → Határ → Pályaudvar → rail to the owning place | growing file in Downloads or `.git/objects/pack` (watcher); final size = cargo |
| 1–50 MB | cargo plane | wingspan ~ log(bytes) | air corridor | same |
| < 1 MB (API calls, `git fetch`, Claude API) | small plane / light pulse | constant | dock → router | TCP table (remote IP + owning PID) + DNS cache + port registry |
| Upload / `git push` | same, outbound | | reversed | hooks for `git push` via Bash, TCP table |
| PC ↔ USB stick, PC ↔ H: copy | **train** | wagons ≈ files | rail spur Erőmű ↔ USB-falu / Tárház | `\LogicalDisk(E:)\Disk Write Bytes/sec` (speed, not cargo); Tier B Kernel-File for the cargo list |
| Process ↔ process (local servers, MCP stdio) | tram inside a city | | | TCP LISTEN table, process tree |

Without Tier B, per-process bytes are not available. **Splitting the NIC rate across live connections is honest enough for a picture**, and Tier B then turns it into exact cargo. A shared **port registry** (`ports.json`: github.com, api.anthropic.com, registry.npmjs.org, OneDrive, Spotify…) is one object at two zoom levels: the §7.2 #3 Harbour docks inside the city, and the shoreline ports of the Land.

### 1.8 Constraints found on this machine

| Constraint | Consequence |
|---|---|
| Windows 10 Pro **21H2 (19044)**, out of servicing | Upgrade to 22H2 before WebView2 hosts and before the overlay phase; test Procmon/Sysmon builds (Learn lists Win11+) |
| Shell not elevated | Everything up to Tier A works as the normal user; Tier B only via a user-created scheduled task |
| Node **v24.19.0** portable (CLAUDE.md says 24.18.0) | Node-API prebuilds (node-pty 1.1.0, koffi) fine; avoid node-gyp (no Visual Studio); chokidar 6 needs 22.22+ (OK); fix the CLAUDE.md version line |
| .NET 8 runtimes only, EOL 2026-11-10 | Choose .NET 10 SDK portable (or 8) for the sidecar before that date; publish self-contained |
| No Rust/MSVC | Rules out Tauri and Rust sidecars without an admin install |
| Claude Code **2.1.261** | Older than `bashEditDiff`, `onFailure`, and the `-p` Manual mode change; check `http` hooks and `claude agents` before P4 |
| Claude Code native Windows | No sandboxing (WSL 2 only) ([setup](https://code.claude.com/docs/en/setup)), so the city's own approval tiers matter |
| three.js **r169** (npm is at r186 ([npm](https://www.npmjs.com/package/three))) | Enough for every feature here; `LightningStrike` is gone since r152; `globe.gl` needs r179+ |
| `build.js` inlines only core three | Using addons (`SelectionBox`, `Line2`, bloom) means copying the client-preview build's inlining pattern |
| GTX 1050 Ti | Test the Electron black-transparency bug early; adaptive quality tiers |
| Double NAT, no inbound | No webhooks; poll GitHub; never port-forward |
| Repo rules | New libraries only through `vendor-manifest.json` pinned to a tag or npm + sha512; several older entries are branch-pinned and should be fixed; every new tool goes into START.cmd (`node tools/check-start.js`) |

---

## 2. Every relevant repository, grouped by what we take from it

Licence key: **Code** = permissive (MIT/BSD/ISC/Apache/zlib), may be adapted with the notice travelling (CLAUDE.md rule). **Dep** = use as an unmodified dependency or as the user's own installed program. **Idea** = GPL/AGPL/non-commercial/no licence: re-implement the idea, never copy code. Licences and star counts were read on 2026-10-26 (notes 02, 03, 05).

**2.1 Code cities and software-as-place**

| Repo | Licence | Use | Take |
|---|---|---|---|
| [srizzon/git-city](https://github.com/srizzon/git-city) | AGPL-3.0 | Idea | Our look source; re-implemented already |
| [MaibornWolff/codecharta](https://github.com/MaibornWolff/codecharta) | BSD-3 | Code | Metric-mapping UI, delta view; `.cc.json` as an interchange option |
| [hyeonsangjeon/Repolis](https://github.com/hyeonsangjeon/Repolis) | MIT | Code | Same single-`index.html` three.js build style; LLM "taxi" search driving the camera |
| [honzaap/GithubCity](https://github.com/honzaap/GithubCity) | Apache-2.0 | Code | Small readable three.js night city |
| [cosmtrek/mindwalk](https://github.com/cosmtrek/mindwalk) | MIT | Code | Agent-session replay on a code map: compare transcript parsing |
| [liltrendi/gitlantis](https://github.com/liltrendi/gitlantis) | Apache-2.0 | Code | Project as an ocean (lighthouses, buoys, boat, minimap): sea navigation for the coast |
| [nitr0yukkuri/githubplanet](https://github.com/nitr0yukkuri/githubplanet) | MIT | Code | Activity → planet, pushes as shooting stars |
| [uni-bremen-agst/SEE](https://github.com/uni-bremen-agst/SEE) | MIT (Unity) | Idea | Collaborative VR code cities, debugging traces |
| [ExplorViz/frontend](https://github.com/ExplorViz/frontend) | Apache-2.0 per paper (no licence file found: verify) | Idea until verified | Software landscape, semantic zoom, mini-map |
| [glato/emerge](https://github.com/glato/emerge) | MIT | Code | Dependency metrics as a test oracle for our import scan |
| [git-truck/git-truck](https://github.com/git-truck/git-truck) | MIT | Code | Owner lenses, colour schemes |
| [githubocto/repo-visualizer](https://github.com/githubocto/repo-visualizer) | MIT, archived | Code | Colour-by-extension table |
| [softvis-research/Getaviz](https://github.com/softvis-research/Getaviz) | Apache-2.0 | Code | Metaphor generators, evaluation setups |
| [acaudwell/Gource](https://github.com/acaudwell/Gource) | GPL-3.0 | Idea | Avatars flying to files |
| [aserg-ufmg/JSCity](https://github.com/aserg-ufmg/JSCity) | GPL-2.0 | Idea | Functions as buildings: interiors precedent |
| [babiaxr/aframe-babia-components](https://github.com/babiaxr/aframe-babia-components) | GPL-3.0 | Idea | Stable layout across time |
| [stefanrinderle/softvis3d](https://github.com/stefanrinderle/softvis3d) | LGPL-3.0, archived | Idea | Edge bundling |
| [CoatiSoftware/Sourcetrail](https://github.com/CoatiSoftware/Sourcetrail) | GPL-3.0 | Idea | Symbol graph beside code |
| [techinz/galaxy-portfolio](https://github.com/techinz/galaxy-portfolio) | personal non-commercial | Idea | 7-scene zoom, shader precompile |
| [haystackeditor/haystack-editor](https://github.com/haystackeditor/haystack-editor) | PolyForm Strict | Idea | Canvas IDE: spatial layout must carry meaning |
| [rodrigo-brito/gocity](https://github.com/rodrigo-brito/gocity) | MIT | Code | Go code city |
| [codemetropolis/CodeMetropolis](https://github.com/codemetropolis/CodeMetropolis) | no licence | Idea | Test metrics as gardens |

Precedents without public code: Code Park, EvoStreets, IslandViz (islands in an ocean), Wettel's CodeCity. "Gitropolis" and "AgentCity", named in README §2, **could not be found** (open question Q2).

**2.2 Workspace building blocks**

| Repo | Licence | Use | Take |
|---|---|---|---|
| [xtermjs/xterm.js](https://github.com/xtermjs/xterm.js) (`@xterm/*` 6.0.0) | MIT | Dep | Terminal panel (fit, webgl, attach, serialize addons) |
| [microsoft/node-pty](https://github.com/microsoft/node-pty) 1.1.0 | MIT (with fork-lineage notices) | Dep | ConPTY with prebuilds |
| CodeMirror 6 ([codemirror.net](https://codemirror.net/); GitHub mirror archived) | MIT | Dep (npm + sha512) | Viewer/editor, `@codemirror/merge` |
| [microsoft/monaco-editor](https://github.com/microsoft/monaco-editor) | MIT | Dep (alternative) | Familiar editor and diff, heavy |
| [steveukx/git-js](https://github.com/steveukx/git-js) (simple-git) | MIT | Dep | Git wrapper |
| [isomorphic-git/isomorphic-git](https://github.com/isomorphic-git/isomorphic-git) | MIT | Dep (only if git ever runs in the page) | — |
| [paulmillr/chokidar](https://github.com/paulmillr/chokidar) | MIT | Dep | Watching |
| [parcel-bundler/watcher](https://github.com/parcel-bundler/watcher) | MIT | Dep (if prebuilds confirm) | Coalesced events, "since last time" |
| [leeoniya/uFuzzy](https://github.com/leeoniya/uFuzzy) | MIT | Dep | Ctrl+K fuzzy |
| [lucaong/minisearch](https://github.com/lucaong/minisearch) | MIT | Dep | Full-text |
| [kpdecker/jsdiff](https://github.com/kpdecker/jsdiff) | BSD-3 | Dep | Diffs (keep the notice) |
| markdown-it, DOMPurify (already in `_libs`) | MIT; MPL-2.0 OR Apache-2.0 | Dep | Markdown preview |
| [sindresorhus/execa](https://github.com/sindresorhus/execa), tree-kill, pidusage, ps-list, open | MIT | Dep | Process helpers |
| [Unitech/pm2](https://github.com/Unitech/pm2) | AGPL-3.0 | Idea | Supervisor features |
| [FredrikNoren/ungit](https://github.com/FredrikNoren/ungit) | MIT | Code | Browser git-graph UI for a non-expert |
| [pcottle/learnGitBranching](https://github.com/pcottle/learnGitBranching) | MIT | Code | How to show branches to beginners |
| [jj-vcs/jj](https://github.com/jj-vcs/jj) | Apache-2.0 | Idea | Operation log / undo model |
| [gitbutlerapp/gitbutler](https://github.com/gitbutlerapp/gitbutler) | non-standard (unconfirmed) | Idea | Virtual branches, operation log |
| [nicoespeon/gitgraph.js](https://github.com/nicoespeon/gitgraph.js) | MIT, archived | Idea | Frozen; draw our own |
| [mermaid-js/mermaid](https://github.com/mermaid-js/mermaid) | MIT | Dep | 2D `gitGraph` for docs only |
| [dip/cmdk](https://github.com/dip/cmdk), [timc1/kbar](https://github.com/timc1/kbar) | MIT | Idea | Palette UX (React) |
| [gkjohnson/three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | MIT | Dep | Fast raycasts when the Land grows |
| [coder/code-server](https://github.com/coder/code-server), [gitpod-io/openvscode-server](https://github.com/gitpod-io/openvscode-server) | MIT | Idea | Too heavy to embed |
| [electron/electron](https://github.com/electron/electron) | MIT | Dep | Later shell |
| [tauri-apps/tauri](https://github.com/tauri-apps/tauri) | Apache-2.0/MIT | Idea | Rust toolchain burden |

**2.3 Claude Code front-ends and observers**

| Repo | Licence | Use | Take |
|---|---|---|---|
| [d-kimuson/claude-code-viewer](https://github.com/d-kimuson/claude-code-viewer) | MIT | Code | Full web client: read and borrow with attribution |
| [disler/claude-code-hooks-multi-agent-observability](https://github.com/disler/claude-code-hooks-multi-agent-observability) | none | Idea | Hooks → swim lanes per session |
| [siteboon/claudecodeui](https://github.com/siteboon/claudecodeui) | AGPL-3.0 | Idea | Web UI |
| [simonw/claude-code-transcripts](https://github.com/simonw/claude-code-transcripts) | Apache-2.0 | Code | Transcript rendering |
| [anthropics/claude-agent-sdk-python](https://github.com/anthropics/claude-agent-sdk-python) | MIT | Dep (if ever) | SDK; mind the login clause |
| [sugyan/claude-code-webui](https://github.com/sugyan/claude-code-webui), [wbopan/cui](https://github.com/wbopan/cui) | MIT / Apache-2.0, archived | Idea | — |

**2.4 Globes, maps and geography**

| Repo | Licence | Use | Take |
|---|---|---|---|
| [arscan/hexasphere.js](https://github.com/arscan/hexasphere.js) | MIT | Code | Hex tiling of the planet |
| [arscan/encom-globe](https://github.com/arscan/encom-globe) | MIT | Code (ideas; old three API) | Glowing hex globe look reference |
| [vasturiano/three-globe](https://github.com/vasturiano/three-globe) | MIT | Dep (prototype) | Arcs, rings, labels as an `Object3D`; r169 OK |
| [vasturiano/globe.gl](https://github.com/vasturiano/globe.gl) | MIT | Idea | Needs three ≥ 0.179 |
| [vasturiano/3d-force-graph](https://github.com/vasturiano/3d-force-graph) | MIT | Code | Particles on links |
| [Fil/d3-geo-voronoi](https://github.com/Fil/d3-geo-voronoi) | ISC | Dep | Spherical Voronoi + Urquhart roads |
| [mapbox/delaunator](https://github.com/mapbox/delaunator) | ISC | Dep | Flat Land triangulation |
| [uber/h3-js](https://github.com/uber/h3-js) | Apache-2.0 | Dep (optional) | Hex index on a sphere |
| [redblobgames/mapgen4](https://github.com/redblobgames/mapgen4) | Apache-2.0 | Code | Elevation, rivers |
| [mewo2/terrain](https://github.com/mewo2/terrain) | MIT | Code | Small fantasy-map pipeline |
| [Azgaar/Fantasy-Map-Generator](https://github.com/Azgaar/Fantasy-Map-Generator) | MIT | Code | Countries, routes, names |
| [anvaka/map-of-github](https://github.com/anvaka/map-of-github) | MIT code, attribute data | Code + data | GitHub as countries |
| [anvaka/pm](https://github.com/anvaka/pm) | MIT | Code | Ecosystem galaxies |
| [anvaka/city-roads](https://github.com/anvaka/city-roads) | MIT | Code | Millions of road segments |
| [anvaka/ngraph.forcelayout](https://github.com/anvaka/ngraph.forcelayout) | BSD-3 | Dep | One-time placement |
| [ProbableTrain/MapGenerator](https://github.com/ProbableTrain/MapGenerator) | LGPL-3.0 | Idea | Suburb streets |
| [watabou/TownGeneratorOS](https://github.com/watabou/TownGeneratorOS) | GPL-3.0 | Idea | Walls and gates |
| [maplibre/maplibre-gl-js](https://github.com/maplibre/maplibre-gl-js), [CesiumGS/cesium](https://github.com/CesiumGS/cesium), [visgl/deck.gl](https://github.com/visgl/deck.gl), [NASA-AMMOS/3DTilesRendererJS](https://github.com/NASA-AMMOS/3DTilesRendererJS), [tentone/geo-three](https://github.com/tentone/geo-three) | BSD-3 / Apache-2.0 / MIT | Idea | Real-earth renderers: overkill for a fantasy planet |
| [takram-design-engineering/three-geospatial](https://github.com/takram-design-engineering/three-geospatial) | MIT | Code | Atmosphere shader |
| [protomaps/PMTiles](https://github.com/protomaps/PMTiles), [felt/tippecanoe](https://github.com/felt/tippecanoe) | BSD | Dep (only with MapLibre) | Offline tiles |

**2.5 Flows, network, live system data and git mining**

| Repo | Licence | Use | Take |
|---|---|---|---|
| [Netflix/vizceral](https://github.com/Netflix/vizceral) | Apache-2.0 | Code | Zoom levels + traffic particles |
| [visgl/flowmap.gl](https://github.com/visgl/flowmap.gl) | Apache-2.0 | Idea | Flow clustering by zoom |
| [sebhildebrandt/systeminformation](https://github.com/sebhildebrandt/systeminformation) | MIT | Dep | One-off inventories |
| [node-usb/node-usb](https://github.com/node-usb/node-usb) | MIT (bundles LGPL libusb) | Dep | Hot-plug, enumeration only |
| [sapics/ip-location-db](https://github.com/sapics/ip-location-db) | data varies | Dep (DB-IP Lite part) | Offline IP → country/ASN |
| [GyulyVGC/sniffnet](https://github.com/GyulyVGC/sniffnet), [imsnif/bandwhich](https://github.com/imsnif/bandwhich) | Apache-2.0 / MIT | Idea | Need Npcap |
| [gkubisa/node-ssdp](https://github.com/gkubisa/node-ssdp) | MIT | Dep (if UPnP) | Router discovery |
| [microsoft/perfview](https://github.com/microsoft/perfview) (TraceEvent) | MIT | Dep | ETW consumer |
| [microsoft/krabsetw](https://github.com/microsoft/krabsetw) | MIT | Dep (alternative) | ETW |
| [File-New-Project/EarTrumpet](https://github.com/File-New-Project/EarTrumpet) | MIT modified (excludes three named companies) | Idea | Per-app audio routing |
| [frgnca/AudioDeviceCmdlets](https://github.com/frgnca/AudioDeviceCmdlets) | MIT (verify) | Dep | Default device switch |
| [LibreHardwareMonitor/LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor) | MPL-2.0 | Dep (PawnIO build, unmodified) | Temperatures, fans |
| Equalizer APO ([SourceForge](https://sourceforge.net/projects/equalizerapo/)) | GPL-2.0 | Dep (drive its `config.txt` via an include file) | System EQ |
| [eronnen/procmon-parser](https://github.com/eronnen/procmon-parser) | MIT | Idea | Record-then-replay only |
| [sverweij/dependency-cruiser](https://github.com/sverweij/dependency-cruiser), [pahen/madge](https://github.com/pahen/madge) | MIT | Dep (oracle) | Cycles, reverse deps |
| [adamtornhill/code-maat](https://github.com/adamtornhill/code-maat), [smontanari/code-forensics](https://github.com/smontanari/code-forensics) | GPL-3.0 | Idea | Coupling, hotspots |
| [src-d/hercules](https://github.com/src-d/hercules), [erikbern/git-of-theseus](https://github.com/erikbern/git-of-theseus) | Apache-2.0 | Code | Line survival / strata lens |
| [tree-sitter/tree-sitter](https://github.com/tree-sitter/tree-sitter) (web-tree-sitter), [acornjs/acorn](https://github.com/acornjs/acorn) | MIT | Dep | Floors (outlines) |
| [errwischt/stacktrace-parser](https://github.com/errwischt/stacktrace-parser) | MIT | Dep | Repair tunnel |
| [graphology/graphology](https://github.com/graphology/graphology), [anvaka/ngraph.path](https://github.com/anvaka/ngraph.path) | MIT | Dep | Blast radius, metro routes |
| [pingcap/ossinsight](https://github.com/pingcap/ossinsight), [igrigorik/gharchive.org](https://github.com/igrigorik/gharchive.org) | Apache-2.0 / MIT | Data | Planet decoration |
| [github/gh-skyline](https://github.com/github/gh-skyline) | MIT | Code | Contribution skyline |

**2.6 three.js helpers and the light-line look**

| Repo | Licence | Use | Take |
|---|---|---|---|
| [mrdoob/three.js](https://github.com/mrdoob/three.js) r169 (vendored) | MIT | Dep | `SelectionBox`, `CSS3DRenderer`, `UnrealBloomPass`, `Line2`, `RenderTransitionPass` |
| [yomotsu/camera-controls](https://github.com/yomotsu/camera-controls) | MIT | Dep | Fly-to/fit transitions |
| [tweenjs/tween.js](https://github.com/tweenjs/tween.js) | MIT | Dep (in r169 libs) | Tweens |
| [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing) | zlib | Dep (check r169) | Faster selective bloom/outline |
| [Fyrestar/THREE.InfiniteGridHelper](https://github.com/Fyrestar/THREE.InfiniteGridHelper) | MIT | Code | Anti-aliased grid floor |
| [creativelifeform/three-nebula](https://github.com/creativelifeform/three-nebula) | MIT | Dep | Smoke, weather, fireworks |
| [jwagner/simplex-noise.js](https://github.com/jwagner/simplex-noise.js), [stegu/psrdnoise](https://github.com/stegu/psrdnoise) | MIT | Code | Coastline noise |
| [mkkellogg/TrailRendererJS](https://github.com/mkkellogg/TrailRendererJS), [Anemolo/Infinite-Lights](https://github.com/Anemolo/Infinite-Lights) | no licence | Idea | Light trails |
| [mrdoob/stats.js](https://github.com/mrdoob/stats.js) | MIT | Dep | Adaptive quality |

**2.7 Desktop overlay and shell projects**

| Repo | Licence | Use | Take |
|---|---|---|---|
| [rocksdanister/lively](https://github.com/rocksdanister/lively) | GPL-3.0 | Dep (user's program) | Wallpaper layer, zero code |
| [glzr-io/zebar](https://github.com/glzr-io/zebar) | GPL-3.0 | Dep (user's program) / Idea | Web widgets; provider checklist |
| [amnweb/yasb](https://github.com/amnweb/yasb) | MIT | Code | Windows media/volume/workspace API code |
| [eythaann/Seelen-UI](https://github.com/eythaann/Seelen-UI) | AGPL-3.0 | Idea | Web-tech desktop environment on top of explorer |
| [elvissteinjr/DesktopPlus](https://github.com/elvissteinjr/DesktopPlus) | GPL-3.0 | Idea | Windows as textures in 3D + clicking them |
| [meslzy/electron-as-wallpaper](https://github.com/meslzy/electron-as-wallpaper) | MIT | Code (Win11-tested only) | WorkerW wrapper |
| [khanhas/PluginWebView](https://github.com/khanhas/PluginWebView) (Rainmeter) | not checked | Idea | HTML panels on skins |
| GlazeWM, Windhawk, ExplorerPatcher | GPL | Idea | Cautionary: injection and shell patching break |

---

## 3. Most of the workspace is already lying around the repo

Kódváros is a working offline three.js r169 city (C1–C10 done) that renders on demand, picks with a raycaster, replays commits, already animates agent sessions as light hopping roof to roof, and answers Claude through a zero-dependency MCP server (note 01). What it lacks is a server, live feeds and actions. Every one of those exists somewhere else on the machine.

| Asset | Path | Reuse for |
|---|---|---|
| Companion server (copy; live copy in `Hub/companion/server.js` with `config.example.json`) | [CodeCity/from-kapu/companion-server.js](file:///H:/VRG/Full/Planner_VRG_U100/CodeCity/from-kapu/companion-server.js) | The workspace backbone: token, Host/Origin, whitelist, `open-tool/folder/terminal/claude/vscode`, read-only git, `check-paths`, `KP_DRY_RUN` |
| Action registry with greyed reasons (`need`, `whyNot`) | [from-kapu/src/js/40-actions.js](file:///H:/VRG/Full/Planner_VRG_U100/CodeCity/from-kapu/src/js/40-actions.js) | RCO menu, palette and toolbar from one registry; every unavailable item says why, in Hungarian |
| Accent-insensitive search; keyboard nav with long-press | `from-kapu/src/js/41-search.js`, `47-nav.js` | Ctrl+K; touch and keyboard |
| Editor with claims (3 days), conflict dialog | `from-kapu/src/js/70-edit.js` | Fences (§7.1 #5) |
| Refresh / "Mi változott?", Munkanapló, personal links, companion client, tour/glossary | `57-refresh.js`, `90-log.js`, `80-personal.js`, `92-companion.js`, `97-extras.js` | Morning newspaper, work log, working sets |
| Kapu tests (16 specs, need re-pointing) | `CodeCity/from-kapu/test/` | Regression net for the lifted modules |
| Session replay and privacy filter | [CodeCity/sessions.js](file:///H:/VRG/Full/Planner_VRG_U100/CodeCity/sessions.js), `src/16-session.js` | Live mode feeds the same `[dt, kind, target]` events |
| MCP server sharing the page's code | `CodeCity/mcp.js`, `core.js` | Reverse "city tells Claude" tool |
| Selftest, headless screenshots | `CodeCity/tools/selftest.js`, `tools/shot.js` | Done-checks for every phase |
| WebSocket relay (role-based) + `ws` 8.21.3 | [phone-relay-server.js](file:///H:/VRG/Full/Planner_VRG_U100/Planner/projects/varler-planner/tools/phone-relay-server.js) | The city joins as role `city`; Planner dash and CYD traffic as live data |
| Board Console `/api/live`, `/api/ports` (COM ports) | [Firmware/board-console/app/server.js](file:///H:/VRG/Full/Planner_VRG_U100/Firmware/board-console/app/server.js) | Hardware devices as the first USB-falu residents |
| Macropad: `planner` and `keys` buttons, `winkeys.ps1` | `Firmware/planner-cyd/app/bridge/macros.js` | Physical buttons for city actions (AV may flag key injection) |
| Static servers (8124, 8123, 8131, 8796, 8150) and `.claude/launch.json` | `MindMap/serve.js` etc. | Supervised jobs; "shops open" on a port street |
| START.cmd registry (11 tools, T11 = Kódváros) + `tools/check-start.js` | [Planner/START.cmd](file:///H:/VRG/Full/Planner_VRG_U100/Planner/START.cmd) | City gates and the launch list; one registry, never a second |
| VRG-DE.cmd PROGRAMS, DEV_CLAUDE, PROMPTS sections | [VRG-DE.cmd](file:///H:/VRG/Full/Planner_VRG_U100/VRG-DE.cmd) | Third-party program list (Chrome, Opera GX, Zen, VS Code, Git Bash, 7-Zip, VLC…) |
| 8 shortcut prompts | `tools/prompts/*.txt` | Prompt dock |
| 1 project subagent | `.claude/agents/vrg-piacmero.md` | First "hireable" agent |
| Open MCT 4.3.1 (vendored) + spike + `vrg-telemetry` design (dict/history/WS live) | [2026-10-20_openmct-planner-bridge.md](file:///H:/VRG/Full/Planner_VRG_U100/docs/research/2026-10-20_openmct-planner-bridge.md), `docs/research/openmct-spike/` | A 2D control-room view beside the city; the telemetry service shape |
| Router, USB, Wake-on-LAN note | [2026-10-26_router-usb-phone-wake.md](file:///H:/VRG/Full/Planner_VRG_U100/docs/research/2026-10-26_router-usb-phone-wake.md) | Pályaudvar and Határ content |
| FLIP spike (O(n) spatial hash) | `docs/research/flip-spike/index.html` | Label de-collision, ambient water at the coast |
| three.js r169 with `CSS3DRenderer`, `SelectionBox`, `UnrealBloomPass`, `Line2`, `RenderTransitionPass`, `RollerCoaster` | `Vendor/three` | Everything visual in §1.6–1.7 |
| `_libs`: EasyMDE (CodeMirror 5), markdown-it, nomnoml, DOMPurify | `H:\VRG\Full\tools` | Markdown preview now |
| Portable apps: Chrome 152, Zen 1.23.3b, Opera GX, VS Code 1.134.0 (with node-pty inside, Electron ABI), Git, Node v24.19.0 + Claude Code 2.1.261, VLC, 7-Zip, headless Chrome | [Planner/apps](file:///H:/VRG/Full/Planner_VRG_U100/Planner/apps) | Launch targets; the terminal's `claude.cmd` |
| God's Eye View portable (CesiumJS 1.138, flights, ships, satellites) | `H:\Personal\GodsEyeView\GodsEyeView` | Planet "abroad" layer ideas (MIT; CITY-D5: code with notice, never its data) |
| wifi-heatmapper | `H:\VRG\Full\wifi-heatmapper` | Wi-Fi strength at the station |
| `~/.claude/sessions/<pid>.json`, `projects/<cwd>/*.jsonl`, `daemon/roster.json`, `settings.json` (no hooks yet) | `C:\Users\webag\.claude` | Live session list and transcript fallback |
| H: top level (`Dev-VRG`, `VRG_Visual_Base`, `MC-Server`, job folders BK2/DM1/P33/NV4, `_installers`, `_zipped`, `H_BACKUP_2026-09-16`) | `H:\`, `H:\VRG\Full` | Tárház districts; installers as port depots; backups as fenced depots |
| BRIDGE vocabulary (BASE/CHANNEL/ROOMBOX/ARM, 10 conduit families, tier T7 "operator or agentic interface") | [BRIDGE-OUTLINE-001](file:///H:/VRG/Full/Planner_VRG_U100/BRIDGE/BRIDGE-OUTLINE-001_General-Outline.md) | One infrastructure language for home and code: Land roads as conduit runs |

Two gaps stand out. No process-listing or file-watch stream exists anywhere in the repo yet. And `docs/city/wp/`, listed in README §1, does not exist.

---

## 4. Media shows how to make a live system readable at a glance

REA here means see → understand → build our own: no assets, names, logos or code. Each borrow below maps to a feature. Items marked *(kn)* come from general knowledge and were not re-verified.

| Borrow | From | Feature it serves | How it looks in Kódváros |
|---|---|---|---|
| **Grey when fine, colour only when something needs you; colour never the only cue** | ISA-101 high-performance HMI ([Control.com](https://control.com/technical-articles/going-gray/)) | every state | Dim cyan wireframe baseline; amber = waiting for you, red = failed, white = selected; always paired with a shape or icon |
| "All dark, a stormy world where everything is glass"; less greeble, faster reading; light-blue staple, yellow allowed | Tron: Legacy look development ([GMUNK](https://gmunk.com/TRON-Legacy), [Pushing Pixels](https://www.pushing-pixels.org/2011/06/01/visual-effects-of-tron-legacy-and-beyond-conversation-with-gmunk.html)) | look | Near-black reflective ground, glassy buildings lit only at the edges, bloom on a selective layer |
| Light lines on a figure carry its identity colour; a trail you can read afterwards | Tron (1982) / Legacy | agents, processes | Each Claude session is a low-poly figure with emissive edges in its session colour; a fading ribbon along the roads it walked (thin = read, thick = edit) |
| Arena bracket drawn as procedural linework | Tron: Legacy scoreboard ([GMUNK](https://gmunk.com/TRON-Legacy)) | parallel sessions | Sessions converge pairwise toward `main` on a glass panel |
| A record of everything the program did, carried as a token | Tron: Legacy identity disc ([fan wiki](https://tron.fandom.com/wiki/Identity_Disc)) | agent logs | A **hexagonal chip** (not a ring disc) = the session's trail; drop it on a building to see what it did there |
| The digital world leaking into the real one; two eras side by side | Tron: Ares ([ILM](https://www.ilm.com/tron-ares-david-seager-interview-ilm-vfx/)) | overlay OS, history | Same light-line language on the desktop; a flatter "retro" lens for old commits |
| Corruption spreading; infected parts unusable until repaired | Tron 2.0 ([Wikipedia](https://en.wikipedia.org/wiki/Tron_2.0)) | failing tests | Tint creeping along import roads from a broken file, retracting when fixed |
| Detective framing beats a chore puzzle | Tron: Identity ([Wikipedia](https://en.wikipedia.org/wiki/Tron:_Identity)) | "who changed this and why" | A clue board of people, commits and transcripts; no gamified maintenance |
| Websites as buildings; **unique-everything rejected because "you don't know which one to look at"**; signage toned down; click → a cube lifts you there; transport mirrors real data transport | Ralph Breaks the Internet ([AWN](https://awn.com/animationworld/visualizing-and-building-world-ralph-breaks-internet)) | GitWorld, Ctrl+K travel, flows | Repetitive calm city with few eye-catchers; Ctrl+K result → translucent cube carries the camera; ships/planes/trains |
| Pedestals = directories, blocks = files, colour = age, travel along wires | SGI fsn in Jurassic Park ([Wikipedia](https://en.wikipedia.org/wiki/File_System_Visualizer)) | navigation | Age as a default lens; "ride the wire" camera along imports. Never put 3D in the path of an urgent action |
| A sector sealed by a cube while a game runs; named sectors | ReBoot ([Wikipedia](https://en.wikipedia.org/wiki/ReBoot)) | processes | A translucent dome over a district while a build/test runs there; human district names, path in a tooltip |
| Search highlights in place and gives a path; ambiguous pulses criticised | Hackers ([Sci-Fi Interfaces](https://scifiinterfaces.com/tag/architecture/)) | Ctrl+K | Results light up in the city plus a breadcrumb; every animation means one thing |
| Memory orbs replaying a moment; flushed up a tube to long-term storage | Inside Out ([Pixar wiki](https://pixar.fandom.com/wiki/Headquarters)) | commits, push | Commits as orbs looping a tiny diff; `git push` = orbs sent up a tube to GitWorld; backups as the long-term shelves |
| Less is more: lines, stations, interchanges | Mini Metro ([GDC](https://gdconf.com/news/attend-gdc-2017-and-learn-the-value-of-less-is-more-from-a-mini-metro-dev)) | branches | Branch = metro line, commit = station, merge = interchange, session = train |
| Info views recolour the whole city by one metric; "red volume ≠ problem" | Cities: Skylines ([TM:PE wiki](https://github.com/krzychu124/Cities-Skylines-Traffic-Manager-President-Edition/wiki/Traffic-Routes-Info-View)) | lenses | Already C5; extend to CPU, "touched by agent now" |
| Production rate graphs with selectable time scales | Factorio ([wiki](https://wiki.factorio.com/Production_statistics)) | CPU, net | Click a construct → a small rate graph, 5 s … all time |
| Layered timeline with shaded "something happened here" bands | Cyberpunk 2077 braindance editor ([PC Gamer](https://pcgamer.com/how-to-use-cyberpunk-2077-braindance-editor)) | replay | Stacked lanes (commits / agent edits / builds / downloads) on the scrubber |
| Time-windowed statistics, decaying markers | EVE Online map ([PCGamesN](https://www.pcgamesn.com/eve-online/eve-kill-map)) | live events | Every event leaves a ring that shrinks and cools; window toggle "last 5 min / hour / day" |
| Hidden filters silently changing results | Elite Dangerous route plotter ([forum](https://forums.frontier.co.uk/threads/galaxy-route-plotter-broken-after-ascendancy-update.629063)) | lenses | Active lenses always shown as removable chips |
| Two scales one key apart | Destiny 2 Director ([GamesRadar](https://www.gamesradar.com/destiny-2-menu)) | zoom | One key between GitWorld, Land and city |
| RAM bar occupied by running things; discovered nodes stay on the map | Hacknet ([Scientific Gamer](https://scientificgamer.com/thoughts-hacknet/)) | RAM, navigation | The Erőmű reservoir shows running processes as blocks; visited places stay lit |
| Hover card: one name, one role, one line | Watch Dogs profiler ([fan wiki](https://watchdogs.fandom.com/wiki/File:CtOS_Scan_selection.png)) | hover | Fixed fields: name · owner · state · time. Not the surveillance tone |
| Status on the object itself | Dead Space ([Game Developer](https://gamedeveloper.com/design/video-designing-i-dead-space-i-s-immersive-user-interface)) | progress | Segmented light bands on the building or ship hull, plus one fixed corner for essentials |
| Strips whose placement *is* the state; handover by moving a strip | Air-traffic control ([SKYbrary](https://skybrary.aero/articles/flight-progress-strips)) | sessions, jobs | A dispatch board at City Hall: queued · working · waiting for you · done · failed |
| Same value as plot, number or table; limit bands | NASA Open MCT ([NASA Spinoff](https://spinoff.nasa.gov/node/11075)) | any live value | RCO → "show as number / sparkline / table" |
| "All the graphics had a purpose"; one or two fixed depth planes | Jayse Hansen ([Pushing Pixels](https://www.pushing-pixels.org/?p=7447)) | panels | Each panel answers one question |
| Gesture suits navigation and sorting, fails for text | g-speak / Minority Report ([Microsoft Research](https://www.microsoft.com/en-us/research/video/hands-and-pixels-from-the-minority-report-interface-to-a-full-stack-spatial-computing-platform/)) | selection | Lasso for selection, Ctrl+K for commands |
| *(kn)* Freeze, plan a sequence, execute | Transistor | group actions | Pause the live view, queue actions on the selection, then run |
| *(kn)* Advisors who speak up for their domain | SimCity | "needs you" | At most four: Storage, Network, Git, Agents |
| *(kn)* Rules as physical tiles | Baba Is You | standing rules | "Agent: read-only here" tiles placed on a district |
| *(kn)* Trade routes with visible cargo; heat radius around one generator | Anno, Frostpunk | flows, CPU | Ships on dotted lanes with container stacks; Erőmű glow radius = load |
| *(kn)* Conduits and junction boxes from the user's own trade | Perception's cultural-motif method | Land roads | Roads styled as conduit runs, devices as breakers on a port board (BRIDGE vocabulary) |

**Trademark limits.** "TRON" and its related marks belong to Disney, which actively opposes third-party filings: it blocked the TRON Foundation partner's U.S. applications in 2019 ([Decrypt](https://decrypt.co/15378/disney-halts-justin-suns-attempt-to-trademark-tron)). So the product, UI copy, user-visible file names and any marketing must not use the word "Tron", its logo, the light-cycle or identity-disc silhouettes, or the in-world terms "derezz", "Grid", "Recognizer", "I/O Tower", "Encom". The same caution applies to "braindance" and "ctOS". Generic ideas (glowing edges on dark glass, grids, trails, voxel break-up) are not protectable as such; distinctive shapes are a risk. Use our own words: *lefoszlik* (dissolve), *kapu-torony* (gate tower), *chip* instead of disc, and a skin name of our own (decision 18). Mini Metro's line style is generic, but its exact station glyphs and palette are not ours. fsn/fsv, Open MCT and Gource are real software: re-implement, never paste.

---

## 5. One event grammar turns the whole Land into something a non-coder can act on

The notes describe dozens of feeds. A user who gets confused by control panels, states, progress, parallel sessions and branches does not need dozens of visual languages. He needs one. The extrapolation below is design synthesis built on the notes, not a finding from a source.

### 5.1 Everything that happens is one sentence: who, from where, to where, carrying what, in which state

Every live thing becomes an **event** with five fields: an *actor* (a Claude session, a subagent, a program, a download, a copy job, the user), a *route* (from place → to place on the Land), *cargo* (files, bytes, a prompt), a *state* taken straight from the air-traffic strip bays (queued · working · waiting for you · done · failed), and *undo* (what can be taken back and how). The renderer then needs only one rule per field. Actor sets the vehicle or figure. Route sets the road, rail, sea lane or air corridor. Cargo sets size. State sets colour by the ISA-101 rule. Undo sets the RCO menu's last item. The same five fields fill every hover card in a fixed order, every strip on the City Hall dispatch board, and every line in the "needs you" list. The companion stores the last N events in a memory ring buffer (nothing persisted by default), and that buffer gives the user a **black-box recorder**: the braindance-style scrubber can rewind "what just happened in the last ten minutes" across every lane, not only commits.

### 5.2 Five everyday scenes and what the user can do in each

**A parallel Claude session.** A second session started from a terminal appears as a new figure at the city gate in its own colour, labelled with its `name` from `claude agents --json`. If it runs as a background job, Claude Code moves its edits into a worktree under `.claude/worktrees/` ([agent view](https://code.claude.com/docs/en/agent-view)). The city shows that worktree as a **floating twin district**, an island beside the original, joined by a bridge whose width is the ahead/behind count. Each read is a thin beam from the figure to a roof (PreToolUse lights it, PostToolUse settles it), and each edit raises a **construction fence** in the session colour, which is Kapu's claims made automatic. When a session is `blocked` with `waitingFor: permission prompt`, its strip moves to the "waiting for you" bay and its figure turns amber. Nothing pans the camera by itself; the "needs you" list grows by one line. RCO on the figure: *attach* (opens `claude attach <id>` in a terminal), *show trail*, *open in Claude app*, *stop* (with confirm), *hand the chip to another agent*. The extrapolated feature is a **conflict radar**: when two sessions' fences overlap on the same building, or two worktrees have touched the same files (`git diff --name-only main...<branch>` intersected), the plot flashes with a crossed-fence icon *before* any merge is attempted. That answers the confusion about parallel sessions with one picture: two cars heading for the same plot.

**A merge.** Branches are metro lines and a merge is an interchange. Before anything happens, RCO "Preview merge into main" runs read-only commands (ahead/behind, the changed-file list on both sides, and `git merge-tree --write-tree`, which reports conflicts without touching the working tree: a git 2.38+ feature, verify against the portable git 2.55 before relying on it). Stations both lines touched glow amber, and predicted conflict buildings get a node-capture ring (the Deus Ex hacking image *(kn)*). The user then chooses: *ask Claude to merge and explain* (a pre-filled `claude-cli://` prompt, recommended), or *merge here* (decision 2), which first writes a safety ref `refs/vrg-safety/<timestamp>`. When the merge lands, a firework bursts over the touched districts (§7.2 #11), the twin island sinks back into the mainland, and the dispatch strip moves to "done".

**A download.** A file growing in `Downloads/` or in `.git/objects/pack` launches a vessel at the Határ border crossing: a container ship above 50 MB, a cargo plane below. It is named by the destination from the TCP table, DNS cache and port registry ("from github.com"). Its hull carries a segmented progress band (Dead Space). On arrival it docks at a **customs house**, which is the extrapolated safety step. Customs shows the Mark-of-the-Web state, whether the file is an executable, and, for anything bound for `Vendor/`, whether it went through `fetch-vendor.js` with a pinned tag and sha512. That is the repo's vendoring rule made visible at the moment it matters. RCO: *show in folder*, *move to `_installers` depot*, *ask Claude what this is*. There is no remote "cancel" for a browser download, so the city honestly offers "show in the browser" instead.

**A USB copy.** Plugging in a stick makes the **USB-falu** village rise at the end of a rail spur (volume arrival event). A copy to it is a train: wagons are files (exact with Tier B, otherwise one wagon per second of write activity), and speed is the volume's write counter. The extrapolated rule is **"eject when the platform is empty"**: the village's RCO *safely remove* item stays greyed with a Hungarian reason ("Még úton van 3 kocsi") until no train is in transit. That one picture replaces a progress dialog, a "can I unplug it?" doubt and a corrupted stick.

**Claude reaching addresses on H: and sending data upstream.** Paths outside the repo land in an **outskirts** district on the Land, so a session reading `H:\VRG\Full\VRG_Visual_Base` draws a beam out of the city to Tárház. The extrapolated safety feature is **restricted zones**: `.ssh`, `Planner/data`, `Planner/home`, `*.credentials.json`, client `*.pdf` folders and `H_BACKUP_*` are drawn as walled no-go areas. A beam into one turns red and adds a "needs you" line. If the user later chooses (decision 8), the same hook could refuse such reads before they happen, since `PreToolUse` can block. Upstream data shows as small planes leaving the harbour for the api.anthropic.com dock, sized by `input_tokens` when OpenTelemetry is on. Payloads are encrypted and are never intercepted.

### 5.3 "Where am I, what is happening, what can I do": three answers on every screen

The principle for a non-coder is that **every view answers three questions without a click**. *Where am I* is a breadcrumb that always shows the scale ladder ("GitWorld › Föld › Kódváros › Tervező negyed › 07a-link.js"), a "you are here" pin, and a small inset map of the level above. The Home key always flies back to the Land table view in a tween of 400 ms or more. *What is happening* is a three-line **Now ribbon**: what is running (sessions, jobs, transfers, as counts with their colours), what needs you (the advisor lines), and what changed since you last looked (the morning-newspaper delta from `git log --since`, finished sessions and arrived downloads). *What can I do* means the RCO menu and Ctrl+K are always available, and any action that is unavailable is shown greyed with the reason (the Kapu `whyNot` pattern), never hidden. Two guards keep this honest: a **calm city means all is well**, so an empty ribbon line is literally empty rather than "0 errors"; and every 3D route has a keyboard route (Jurassic Park's lesson), so "stop all agents" is one palette command even if the user is lost on the planet.

### 5.4 Safety and undo in five layers

The user vibecodes, so the city must never be the thing that loses work. Layer one is **read-first**: the city reads and opens everything and writes nothing by default. Writes are handed to Claude as pre-filled prompts that the user sends themselves. Layer two is **dry-run ghosts**: any write action the city can perform (save a file, rename, merge here) first shows a translucent ghost of the result, such as a merge view on the building or a ghost building at the new name, with the exact path in the confirm dialog. Layer three is **safety refs and copies**: before any git write, a `refs/vrg-safety/<timestamp>`; before a file save, a copy into a gitignored `.cache/vrg-safety/`. Layer four is **existing time machines** shown as one timeline: Claude Code checkpoints and `/rewind` for Claude's own edits ([sessions](https://code.claude.com/docs/en/sessions)), and the git reflog as a scrubbable "where was main ten minutes ago" lane. Layer five is **reversible dissolves**: closing a program or deleting a file plays a voxel break-up that takes a few seconds and can be caught with one click. Nothing is hard-deleted; deletions move to a scrapyard folder, which keeps the repo's "never permanently delete" norm. A **panic key** (Esc twice) stops all live animation, hides the overlay and leaves a calm, static city, so the user can always get back to quiet.

### 5.5 Design rules R1–R12

| # | Rule | Origin |
|---|---|---|
| R1 | Grey-normal: colour, motion and blinking only for abnormal states; a calm city means all is well | ISA-101 |
| R2 | Colour is never the only cue: pair with shape, icon or label | ISA-101 |
| R3 | One animation, one meaning; the legend says which | Hackers critique |
| R4 | Repetition with a few eye-catchers; only active or flagged buildings get signage | Ralph |
| R5 | Places never move: layout from data, slots assigned once | Cockburn & McKenzie, EvoStreets, CITY layout rule |
| R6 | 3D for overview and status; reading and typing in flat panels; portal hand-off to real windows | visionOS lesson, Code Park |
| R7 | Every 3D path has a keyboard path (Ctrl+K, hotkeys) | fsn in Jurassic Park |
| R8 | Active lenses and filters are always visible as removable chips | Elite Dangerous |
| R9 | Status on the object, plus one fixed corner for essentials | Dead Space hybrid |
| R10 | Camera moves are tweens ≥ 400 ms, never on a timer, never pulled away from the user | Tron: Legacy restraint, focus-stealing rules |
| R11 | Low-glow mode and ≤ N simultaneous animations; render on demand, ~0 % idle | Uprising flat look, overlay cost |
| R12 | Fixed field order on every card: name · owner · state · time · undo | Air-traffic strips |

Palette tokens: cyan = ours/normal, amber = waiting for you, red = failed, white = selected, neutral white edges = abroad/GitHub, amber edges = vendored third-party code. The engine stays skin-neutral (README §7.2): the light-line look is one theme table.

### 5.6 Where the §7.1/§7.2 ideas interlock with live data

The earlier 28 ideas become stronger when they share the event grammar. **Blast radius (§7.2 #2) becomes a pre-edit shock wave**: when a PreToolUse hook says Claude is about to edit a file, the reverse-import rings pulse once, so the user sees what the edit may affect before it lands. **Fog of war (§7.2 #5) clears live** as beams touch roofs, so "where Claude's knowledge is old" updates in real time. **Weather (§7.1 #8) is driven by supervised selftest jobs**, so a storm appears seconds after a test fails, and the failing output automatically opens a **repair tunnel (§7.2 #1)** from the error to its origin. **Pipes (§7.1 #2)** get an RCO "rebuild" that runs the build as a supervised job, and the flood drains as it succeeds. **City gates (§7.1 #1)** light when that tool's local server is listening (TCP LISTEN table), which makes "is MindMap's 8124 server up?" a glance. A **port street** of lit shop doors (8124, 8123, 8131, 8790, 8795, 47291…), with the process tree claude.exe → bash.exe → node.exe drawn as trams between them, finally shows "Node.js and every software part working". **Quests (§7.2 #13)** get an RCO "start this WP with Claude" that pre-fills the codephrase from City Hall (§7.1 #11). **Harbour docks (§7.2 #3)** are the same port registry the network telemetry uses, so a file that calls api.anthropic.com has a road to the very dock its planes leave from. The **inspector's beacon (§7.2 #8)** feeds the advisors' "needs you" list. **Foundation stones (§7.2 #6)** and the **Vendor power plant (§7.1 #3)** join the customs house, so licence provenance is visible both when code arrives and where it lives.

Three new functions grow out of the combination. **Working sets** (Code Bubbles): a Ctrl+click selection can be named and saved as a temporary district, written into the Munkanapló, and handed to an agent as its context. **The hiring hall**: subagents from `.claude/agents` and `~/.claude/agents` stand as role-shaped figures (reader, editor, tester, reviewer, as in Cells at Work *(kn)*), with tool slots that map to `--allowedTools`. Dropping a working set on a figure pre-fills `claude --bg --agent <name>` or a `claude-cli://` prompt. **Prompt cards**: the eight `tools/prompts/*.txt` sit in a dock as cards; dropping one on a building fills the prompt with that building's path. Taken together they turn "choosing an agent for a job" into a drag the user already understands.

---

## 6. Thirteen phases climb from a served page to an overlay OS

### 6.1 Phases and their done-checks

Each phase is small enough for one or two sessions. Each ends with a check the user can see, and each adds its START.cmd entry and selftest checks.

| Phase | Content | Needs decisions | Done-check |
|---|---|---|---|
| **P0** | Decisions recorded as CITY-D9…; plan written into `docs/city/README.md` §8; `docs/city/wp/` created | — | README §5 lists the answers; §8 has the phase table |
| **P1** | `CodeCity/companion.js` from the Kapu server: serves the city on 127.0.0.1, token, Host/Origin, whitelist; `file://` build unchanged; START.cmd entry; Kapu companion tests re-pointed | 1, 2 | `node tools/check-start.js` passes; page opens from START.cmd in served mode and still from `file://`; selftest green |
| **P2** | RCO menu from the Kapu action registry (open folder, VS Code, terminal, Claude Code via `claude-cli://`, Claude app via `claude://code/new`, copy path, history); Ctrl+K palette; Ctrl+click and box multi-select; group actions; prompt dock; agent hall (static list) | 1, 7 | Right-click a building → VS Code opens on it; Ctrl+K "07a" flies there; three buildings selected → "Ask Claude about these" opens a pre-filled terminal; items are greyed with a reason in `file://` mode |
| **P3** | Live repo: watcher → incremental rescan → SSE; `.git` refs watch; "Mi változott?" since last visit | 1 | Edit a file in VS Code → its building pulses within ~1 s; a commit updates the timeline without reload |
| **P4** | Live Claude: version check; transcript tail + `claude agents --json` (no settings change) → figures, beams, dispatch board; then hooks (after the user approves the settings block); fences; conflict radar; outskirts and restricted zones | 3, 4, 5, 19 | Start a second session → a second figure appears; its reads beam to roofs live; a session waiting for permission shows amber on the board; closing the city does not slow Claude |
| **P5** | Panels: CodeMirror 6 viewer/editor + merge view + markdown preview; save via a confirm + safety copy; embedded xterm + node-pty terminal running `claude` (off by default) | 2, 6, 7 | Open `README.md` in a panel and preview it; an edit shows a diff before saving; `claude` runs inside the panel and resumes after a companion restart |
| **P6** | Process supervisor: config-listed jobs (serve.js servers, builds, selftests), log ring buffers, `taskkill /T`; city gates; port street; pipes; weather; inspector beacon; Now ribbon and advisors | 1 | Start MindMap's server from the city → its gate lights and its log streams; a failing selftest raises a storm and a "needs you" line; stop kills the whole tree |
| **P7** | Git made visible: metro lines, worktree islands, ahead/behind bridges, merge preview (read-only), reflog lane, safety refs; merges handed to Claude by prompt | 2 | Create a test branch with one commit → a new line with one station; preview shows touched stations; the reflog lane scrubs back |
| **P8** | The Land: `land.json` hex slots; nested frames (M3); Land table view, breadcrumb, Home key; Tárház (H: walker, cached); Erőmű (Tier 0 counters); Pályaudvar + Határ (tracert, ARP, NIC counters); shoreline; flows F2; TCP table + DB-IP Lite; ships for downloads; USB-falu and trains | 15, 16, 20 | Zoom from the Land to a file floor without jitter; a 100 MB download sails in as a ship; copying to a stick runs a train and the eject item greys until it arrives |
| **P9** | GitWorld planet: `CodeCity/world.js` fetcher (ETag cache) from `vendor-manifest.json` + metadata; own sphere; continents; globe → Land morph | 13, 14 | The 31 vendored repos sit as foreign cities on their continents with licence colours; offline, the planet renders from the snapshot |
| **P10** | `vrg-probe.exe` sidecar (Tier A): windows + WinEvents, Core Audio sessions and peaks, GSMTC stadium, Bluetooth watcher, USB tree; open programs as temporary constructs | 10, 17, 19 | Spotify playing → the stadium lights with the track; dragging a sound tower changes Spotify's volume; opening Paint raises a construct that dissolves when closed |
| **P11** | Optional Tier B: `vrg-etw.exe` (elevated, read-only, named pipe) for exact ship cargo, everything Bash touches on H:, and the process tree; the user creates the scheduled task | 9, 15 | A `git clone` shows the exact cargo per process; a file read inside a Bash command beams to its roof |
| **P12** | Overlay OS: L0 Lively wallpaper → Electron shell (per-monitor transparent overlay, hotkey, click-through with forward, tray, autostart) → window textures + portal hand-off to Zen → flyouts (launcher, volume, devices) | 11, 12 | After 22H2: the hotkey summons the city over the desktop in < 150 ms; idle cost ~0 %; clicking a Zen building hands off to the real window and Esc returns |
| **P13** | Live-first polish: design-rule audit (R1–R12), low-glow mode, adaptive quality tiers, the Claude Design batch pack (shots of every look), README base fine-tuning from the user's dev notes | 18 | Every rule has a check in `selftest`/`shot.js`; the Design batch pack exists |

### 6.2 Order and the reasoning behind it

P1–P4 deliver most of the felt value with no admin rights, no new toolchain and only one settings change: a city that opens things, finds things, and shows Claude working, live. P5–P7 add the workspace depth (edit, terminal, processes, git) that removes the need to leave the city for routine work. P8–P9 build the geography on top of a working workspace rather than before it, so the Land is filled with real live data from day one instead of decoration. P10–P12 depend on toolchain and OS choices (the .NET SDK, an elevation path, Windows 22H2) that the user should make with the earlier phases in hand. The Kapu README already proposes the same direction: board → district map, claims and Munkanapló on buildings, agent init docs as building cards, helper actions from the city ([from-kapu/README.md](file:///H:/VRG/Full/Planner_VRG_U100/CodeCity/from-kapu/README.md)). One uncertainty is real. Whether the installed Claude Code 2.1.261 offers `http` hooks and `claude agents` decides whether P4 starts with hooks or with the transcript tail.

### 6.3 Open decisions (A is recommended in each)

1. **CITY-D9 Host architecture** (before P1). A) Companion server + browser page now; Electron later as packaging and overlay host. B) Electron now. C) Tauri. D) Kódváros as a VS Code extension.
2. **CITY-D10 Who writes** (before P2). A) The city reads, opens and launches; every write is a pre-filled Claude prompt or a confirm with a ghost preview and a safety copy/ref. B) The city also runs git writes itself (commit, merge) behind a two-step confirm. C) No limits.
3. **CITY-D11 Live Claude feed** (before P4). A) Hooks (a small stripper command hook that POSTs path + kind to the companion) in the gitignored `.claude/settings.local.json`, with transcript tail as fallback. B) Transcript tail + `claude agents --json` only, no settings change. C) OpenTelemetry only.
4. **CITY-D12 Hook reach** (before P4). A) This repo first; move to the user-level `~/.claude/settings.json` (all of H:) after P4's check passes. B) User-level at once. C) This repo only, permanently.
5. **CITY-D13 Claude Code version** (before P4). A) Update the portable Claude Code (2.1.261) before P4, so documented hook features are present. B) Stay, and use only what 2.1.261 has.
6. **CITY-D14 Editor** (before P5). A) CodeMirror 6 + merge, vendored as npm + sha512. B) Monaco. C) No in-city editor; always open the portable VS Code.
7. **CITY-D15 Terminal** (before P2/P5). A) `claude-cli://` deep link in P2; embedded xterm + node-pty in P5, off by default. B) Deep link only, ever. C) Embedded from the start.
8. **CITY-D16 Approvals and blocking from the city** (before P4). A) Show only: no `PermissionRequest` approvals and no restricted-zone blocking until P13, then opt-in. B) Block restricted-zone reads from P4. C) Never.
9. **CITY-D17 Admin tier** (before P11). A) Nothing elevated until P11; then one read-only `vrg-etw.exe` started by a scheduled task the user creates themselves. B) Never elevate; stay with estimates. C) Elevated from the start.
10. **CITY-D18 Sidecar toolchain** (before P10; choose before 2026-11-10). A) C# self-contained, .NET 10 SDK unpacked into `Planner/apps/dotnet`. B) .NET 8 SDK. C) PowerShell Tier 0 only, no sidecar. D) Rust.
11. **CITY-D19 Windows 22H2** (before P12; the user's own action). A) Apply the 21H2 → 22H2 enablement before P12. B) Stay on 21H2; Electron only, no WebView2 hosts.
12. **CITY-D20 Overlay host** (before P12). A) Electron with three layers (wallpaper via Lively first). B) Lively wallpaper only. C) Tauri.
13. **CITY-D21 GitHub data** (before P9). A) Unauthenticated snapshot from `vendor-manifest.json` + ecosyste.ms, refreshed rarely; token optional later. B) A personal token from an environment variable (5,000/h, free 304s). C) No remote fetch; planet from local data only.
14. **CITY-D22 Planet placement** (before P9). A) Mix: ecosystem continents, dependency distance near us, Map of GitHub as faint background. B) Map of GitHub coordinates only. C) Dependency distance only.
15. **CITY-D23 Network precision** (before P8). A) No packet capture: NIC counters + TCP table + DB-IP Lite; exact bytes only via Tier B if decision 9 allows. B) Npcap opt-in.
16. **CITY-D24 Router** (before P8). A) No router change: NIC counters, tracert, ARP. B) Turn on UPnP on the TP-Link for WAN counters (it also opens port mapping to LAN programs). C) Flash OpenWrt.
17. **CITY-D25 Spotify stadium** (before P10). A) GSMTC metadata + OS peak meter, no Spotify API. B) Window title only. C) Spotify Web API.
18. **CITY-D26 Look name and rules** (before P13; affects P2+). A) Adopt R1–R12, the palette tokens and an own skin name (e.g. "Fényvonal"), with no Tron terms anywhere user-visible. B) Rules only, no skin name.
19. **CITY-D27 Privacy of live data** (before P4). A) Window titles, outside paths, IPs, DNS names and device names stay in memory only, with a blur mode; nothing persisted. B) An opt-in log under a gitignored folder (e.g. `Planner/data/`).
20. **CITY-D28 three.js version** (before P8). A) Stay on r169 until P8, then decide. B) Upgrade to r186 first.

Questions without options, to ask in the same session: **Q1** the user's dev notes for Kódváros base fine-tuning (README §7: "ask for those notes first; do not guess"); **Q2** which repos "Gitropolis" and "AgentCity" in README §2 were; **Q3** the TP-Link hardware version (sticker), if decision 16 is ever B or C.

---

## Conclusion

The main shift is that **the live workspace is mostly an integration job, not a new build**. The companion server, action registry, search, session replay, relay, Board Console, launchers, prompt library and MCP server already exist. What is missing is a single event grammar that lets the city show them, and one non-blocking hook that lets it see Claude. The geography that sounds like the most ambitious part sits on well-trodden technique (nested frames, persisted slots, instanced flows). The overlay OS is the part most at the mercy of the platform: an out-of-servicing Windows build, a GPU transparency bug, and a capture border that cannot be removed on Windows 10.

The second shift concerns who the system is for. Fictional interfaces work for an audience for two seconds; this one must work for one user for hours, and that user does not code. Media supplies the vocabulary (light lines, trails, transit lines, strips, domes), but the decisive rules come from control rooms: grey-normal, colour plus shape, strips whose position is the state, and every action greyed with a reason instead of hidden. If the city stays calm when all is well, every beam, fence, ship and train becomes a message the user can act on, and that, more than any glow, is what turns a picture of the code into a place to work.

---

## 7. Prompt series

Copy one prompt into a fresh Claude Code session in the repo (`H:\VRG\Full\Planner_VRG_U100`, branch `main`). "Report" = `docs/research/reports/Kódváros live workspace and GitWorld.md`. Each prompt points at report sections instead of restating context. Run them in order; skip a phase's prompts if its decisions said no.

**KV-01 · Decisions**
```
Read the report §6.3 and §1.8 (docs/research/reports/Kódváros live workspace and GitWorld.md) and docs/city/README.md §5, §7.
Ask me decisions 1–8 and 19 (needed before P1–P4) one at a time with the lettered options, A first; then Q1 (my dev notes) and Q2.
Record answers as CITY-D9… in docs/city/README.md §5; put the notes from Q1 into §7. Stop after recording.
Commit, do not push.
```

**KV-02 · Plan into the README**
```
Read the report §6.1–6.2 and docs/city/README.md §3–§5.
Add docs/city/README.md §8 "Élő munkatér" with the phase table P1–P13 (done-checks, decision links) and create docs/city/wp/ with one stub per phase (goal, done-check, files). No code.
Check: every phase has a stub. Commit, do not push.
```

**KV-03 · P1 Companion server**
```
Read the report §1.1 and §3; read CodeCity/from-kapu/companion-server.js and Hub/companion/server.js.
Create CodeCity/companion.js: serves CodeCity/dist/vrg-codecity.html on 127.0.0.1 with the same token, Host/Origin, whitelist and realpath rules; the file:// page keeps working. Add a START.cmd entry (CLAUDE.md rules), run node tools/check-start.js.
Check: page opens from START.cmd served and from file://; node CodeCity/tools/selftest.js passes. Commit, do not push.
```

**KV-04 · P1 Re-point the Kapu companion tests**
```
Read CodeCity/from-kapu/README.md and the report §3.
Re-point the companion spec (CodeCity/from-kapu/test/spec-95-companion.js) to CodeCity/companion.js and add it to CodeCity/tools/selftest.js using KP_DRY_RUN.
Check: selftest passes, including token rejection and a path outside the roots. Commit, do not push.
```

**KV-05 · P2 Right-click menu**
```
Read the report §1.2 (deep links), §5.3 and CodeCity/from-kapu/src/js/40-actions.js, 92-companion.js.
Add an RCO menu to Kódváros from that action registry: open folder, VS Code, terminal, Claude Code (claude-cli://open?cwd=), Claude app (claude://code/new?folder=), copy path, show history. Greyed items carry a Hungarian reason when the companion is absent.
Check with CodeCity/tools/shot.js in served and file:// mode. Commit, do not push.
```

**KV-06 · P2 Ctrl+K and multi-select**
```
Read the report §1.3 (Ctrl+K, multi-select) and CodeCity/from-kapu/src/js/41-search.js, 47-nav.js.
Add a Ctrl+K palette over files, actions, prompts, START.cmd tools (prefixes > @ #), plus Ctrl+click and Shift+drag selection (three.js SelectionBox, inlined like the client-preview build) with group actions incl. "Ask Claude about these" via claude-cli://.
Check: "07a" flies to the file; 3 selected files land in the pre-filled prompt. Commit, do not push.
```

**KV-07 · P2 Prompt dock and agent hall**
```
Read the report §5.6 (prompt cards, hiring hall) and §1.2.
List tools/prompts/*.txt as cards and .claude/agents/*.md as agent figures; dropping a card or the selection on a building or agent pre-fills a claude-cli:// prompt with the paths (never auto-sent).
Check: one card on one building gives the right prompt text. Commit, do not push.
```

**KV-08 · P3 Live repo stream**
```
Read the report §1.1 (SSE, cookie, Origin) and §1.3 (file watching).
Add to CodeCity/companion.js: recursive watch with the report's ignore list, ~400 ms debounce, incremental rescan, GET /api/stream (SSE); the page patches instances and shows "Mi változott?" since the last visit.
Check: editing a file pulses its building within ~1 s; a commit updates the timeline without reload. Commit, do not push.
```

**KV-09 · P4 Live Claude without settings changes**
```
Read the report §1.2, §1.8 and §5.2 (parallel session); read CodeCity/sessions.js and src/16-session.js.
First report the installed Claude Code version and whether `claude agents --json` works. Then tail the transcripts (sessions.js privacy filter) and poll agents → one figure per session, live beams, the City Hall dispatch board (5 bays).
Check: a second session shows a second figure and live beams. Commit, do not push.
```

**KV-10 · P4 Hooks (needs my yes)**
```
Read the report §1.2 (hooks), §5.2 (restricted zones) and decisions CITY-D11/D12/D16/D27 in docs/city/README.md §5.
Write CodeCity/hook.js (reads stdin, drops content, POSTs path + kind + session to the companion, short timeout, silent on failure) and SHOW me the settings.local.json block; apply it only after I say yes. Add outskirts and restricted zones.
Check: with the city closed Claude works normally; with it open, reads beam live. Commit, do not push.
```

**KV-11 · P4 Fences and conflict radar**
```
Read the report §5.2 (parallel session, conflict radar) and CodeCity/from-kapu/src/js/70-edit.js (claims).
Raise a session-coloured fence on each edited building; flag overlap between sessions and between worktrees (git diff --name-only main...<branch>).
Check with two test worktrees editing one file: the crossed-fence icon appears. Commit, do not push.
```

**KV-12 · P5 File panel and diff**
```
Read the report §1.3 (editor) and §5.4 (safety layers).
Vendor CodeMirror 6, @codemirror/merge, markdown-it, DOMPurify via vendor-manifest.json (npm + sha512, tools/fetch-vendor.js). Add a file panel from the RCO: view, markdown preview, edit with a merge view; save goes through a confirm + safety copy in a gitignored .cache.
Check: open docs/city/README.md, preview it, edit and see the diff before saving. Commit, do not push.
```

**KV-13 · P5 Embedded terminal**
```
Read the report §1.3 (terminal) and §1.1 (WebSocket token rule).
First test whether node-pty 1.1.0 prebuilds load under Planner/apps/node and tell me. If yes: xterm.js panel + WebSocket (token as first message), spawn only the configured shell or claude.cmd, SystemRoot and CLAUDE_CODE_GIT_BASH_PATH set, off by default.
Check: claude runs in the panel and `claude --resume <name>` works after a companion restart. Commit, do not push.
```

**KV-14 · P6 Process supervisor and gates**
```
Read the report §1.3 (processes), §5.6 (gates, port street) and Planner/START.cmd, .claude/launch.json.
Add supervised jobs from a config (the serve.js servers, builds, selftests): log ring buffers streamed to a panel, stop = taskkill /T; START.cmd gates light when their tool's server listens; a port street from the TCP LISTEN table.
Check: start MindMap's server from the city → gate lights, log streams, stop kills the tree. Commit, do not push.
```

**KV-15 · P6 Health and the Now ribbon**
```
Read docs/city/README.md §7.1 #2 #8, §7.2 #1 #8 and the report §5.3, §5.6.
Add pipes (stale builds), weather from selftest jobs, the repair tunnel from failing output, the inspector beacon, and the three-line Now ribbon with at most four advisors (rules R1–R3).
Check: break one selftest on purpose → storm + "needs you" line; fix it → calm. Commit, do not push.
```

**KV-16 · P7 Git as metro lines**
```
Read the report §1.3 (git), §5.2 (merge) and §5.4.
Draw branches as metro lines, worktrees as twin islands with ahead/behind bridges, a reflog lane, and a read-only merge preview (verify git merge-tree --write-tree on the portable git first). Merging is a pre-filled Claude prompt; any city-side git write makes refs/vrg-safety/<timestamp> first (per CITY-D10).
Check on a throwaway branch: line, station, preview, reflog scrub. Commit, do not push.
```

**KV-17 · P8 The Land scaffold**
```
Read the report §1.6 (M3, scale ladder, slots) and §5.3 (breadcrumb, Home key).
Add land.json with persisted hex slots, nested scale frames with camera hand-off, a Land table view holding Kódváros, a breadcrumb, an inset map and the Home key; Tárház from a cached H: walker (sizes only, restricted zones walled).
Check: zoom Land → district → building without jitter; Home returns in one key. Commit, do not push.
```

**KV-18 · P8 Erőmű, station, border, shoreline**
```
Read the report §1.4 (Tier 0), §1.6 (topology) and docs/research/2026-10-26_router-usb-phone-wake.md.
Add a Tier 0 sampler (typeperf / one persistent PowerShell) for CPU/RAM/GPU/disk/NIC; Erőmű towers; Pályaudvar and Határ from tracert -d, ARP and NIC counters; the shoreline with a ports.json registry; DB-IP Lite fetched by a script into a gitignored folder.
Check: CPU load shows on the towers; unplugging the network closes the border. Commit, do not push.
```

**KV-19 · P8 Ships, planes, trains**
```
Read the report §1.7 (both tables) and §5.2 (download, USB copy).
Add flows F2 first: Downloads and .git/objects/pack watched → ships/planes by size, named from the TCP table + DNS cache + ports.json; a customs house on arrival; USB-falu on volume arrival, trains from the volume write counter, eject greyed until the platform is empty.
Check: a 100 MB download sails in; a copy to a stick runs a train. Commit, do not push.
```

**KV-20 · P9 GitWorld planet**
```
Read the report §1.6 (planet, placement, rate limits), §2.4 and decisions CITY-D21/D22.
Write CodeCity/world.js (zero deps, ETag cache in a gitignored .cache, optional token from env only) → world.json from vendor-manifest.json + repo metadata; render an own sphere with continents, licence colours and a globe → Land morph.
Check: the vendored repos appear as foreign cities; offline it renders from the snapshot. Commit, do not push.
```

**KV-21 · P10 Sidecar spike**
```
Read the report §1.4 (Tier A, bridging) and decision CITY-D18.
Unpack the chosen .NET SDK into Planner/apps/dotnet (gitignored; tell me the download first) and build vrg-probe.exe (self-contained, JSON lines on stdio) with the window list + WinEvent hook only; the companion spawns and restarts it.
Check: opening and closing Paint shows a construct rise and dissolve. Commit, do not push.
```

**KV-22 · P10 Stadium, sound towers, devices**
```
Read the report §1.4 (GSMTC, Core Audio, Bluetooth, USB) and §4 (stadium, port board).
Extend vrg-probe.exe: GSMTC now-playing → stadium; audio sessions with peaks and per-app volume → sound towers; Bluetooth watcher with battery → buoys; USB tree + hot-plug → a port board. No Spotify API.
Check: Spotify playing lights the stadium; dragging its tower changes its volume. Commit, do not push.
```

**KV-23 · P11 Elevated ETW (only if CITY-D17 = A)**
```
Read the report §1.4 (Tier B) and §1.8.
Build vrg-etw.exe (TraceEvent, read-only, Kernel-Network/File/Process + DNS-Client, filters fixed in code, named pipe with a current-user ACL, no listener). Write the exact steps for me to create the scheduled task myself; do not create it.
Check after I create it: a git clone shows exact cargo per process. Commit, do not push.
```

**KV-24 · P12 Wallpaper layer**
```
Read the report §1.5 (L0, staying light).
Add a wallpaper mode to the city (#mode=wallpaper: 1–5 fps, no panels, pause when hidden) and write the steps to point Lively at the companion URL; I install and configure Lively myself.
Check: the city runs behind the icons at ~0 % idle CPU. Commit, do not push.
```

**KV-25 · P12 Electron overlay spike (after 22H2)**
```
Read the report §1.5 and §1.8; decisions CITY-D19/D20.
Create a minimal Electron shell (pinned version via vendor-manifest) loading the companion URL: one transparent overlay per monitor, hotkey summon/hide (warn if taken), click-through with forward, tray, START.cmd entry. First test the black-transparency bug on this GPU and report.
Check: summon < 150 ms, idle ~0 %. Commit, do not push.
```

**KV-26 · P12 Windows on buildings and the portal hand-off**
```
Read the report §1.5 (portal hand-off, capture limits) and §5.3.
In the Electron shell: desktopCapturer textures for at most 3 windows, thumbnails for the rest; clicking a Zen building flies in, SetWindowPos's the real window to the facade, hides the overlay; Esc returns. Accept the Win10 yellow border.
Check: hand-off and return with Zen work three times in a row. Commit, do not push.
```

**KV-27 · P13 Rules audit and Design pack**
```
Read the report §5.5 (R1–R12), §4 (trademark limits) and docs/city/README.md §7.
Audit the city against R1–R12 and the trademark list, add a low-glow mode and adaptive quality tiers, and make the Claude Design batch pack (CodeCity/tools/shot.js of every look + the user's dev notes) under docs/city/.
Check: each rule has a selftest or shot check; no Tron terms in user-visible text. Commit, do not push.
```
