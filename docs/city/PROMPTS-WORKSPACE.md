# Kódváros live workspace: prompt series

What this is: the 27 copy-paste prompts (KV-01 … KV-27) that build Kódváros into a live workspace, GitWorld and later an overlay OS, one per roadmap step.
They are short on purpose: each one points into the report `docs/research/reports/Kódváros live workspace and GitWorld.md` (§1–§6) instead of restating context.
Same content as that report's §7; if the two ever differ, update both. Run them in order in a fresh Claude Code session on `main`.


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
