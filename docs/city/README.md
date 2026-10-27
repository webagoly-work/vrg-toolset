# VRG Kódváros — the codebase as a city

A git repository rendered as a 3D city that you can fly through and replay through time.
The look builds on Git City (srizzon/git-city): pixel-style buildings, lit windows, night skyline.
The meaning comes from meshing what other visualisers each cover only partly (research 2026-10-22,
summarised in §2).

Self-contained like the other VRG tools: `node CodeCity/scan.js <repo>` reads git and writes one
offline HTML page with the data inside. No server, no network, no build step for the user.

## 1. Files

| Path | What |
|---|---|
| `CodeCity/scan.js` | git → `city.json` (and, with `--html`, the finished page). Node only, no dependencies |
| `CodeCity/build.js` | `src/` + `Vendor/three` → `dist/vrg-codecity.html` (an empty template that opens a `city.json`) |
| `CodeCity/src/` | `shell.html`, `city.css`, `NN-*.js` modules concatenated in filename order |
| `docs/city/wp/` | one file per work package |

## 2. The mesh — what each visual means

| Visual | Meaning | Taken from |
|---|---|---|
| District (raised plate) | folder | CodeCity, CodeCharta |
| Footprint | lines of code (area ~ LOC^0.7, so a 40k-line file does not swallow the city) | Gitropolis, AgentCity |
| Height | number of commits (log) — switchable | AgentCity, CodeCharta |
| Lit windows | recent activity | Git City |
| Colour lens | language · age · churn · owner · agent share | CodeCharta, git-truck, AgentCity |
| Crane / ruin | heavy churn now / untouched > 2 years | RepoVerse, Gitropolis |
| Roads / arcs | imports, co-change | SEE, CodeCharta, emerge |
| Timeline | replay commit by commit, positions never move | Gitropolis, BabiaXR, Evo-Streets |
| Roof flash | file touched by the commit being played | Gitropolis |
| Looks on keys 1–6, split-flap board, deep links, tours, query bar | instrument, not picture | God's Eye View |

Layout is computed once over every file that ever existed, so a building keeps its place through the
replay (the reason BabiaXR and Evo-Streets exist).

Licences: Git City is AGPL-3.0, so its look is **re-implemented, never copied**. three.js is MIT and
its header travels with the build.

## 3. Work packages (small, one per session)

Re-planned 2026-10-22 after the God's Eye View detour (`IDEAS-GEV.md`, ★ items). GEV moved the
city from "a picture of the repo" towards **an instrument you query, tour and deep-link into**.

| WP | Content | Stop |
|---|---|---|
| C1 | `scan.js`: files, LOC, language, commits, renames, authors, agent commits → `city.json` | |
| C2 | `build.js` + static city: stable treemap, instanced buildings, orbit camera, hover + info panel | ⏸ look ✔ |
| C3 | Night look: lit windows (recent = lit), night sky, vignette, emissive glow · START.cmd key **K** · share-link `#hash` state (GEV 3) · freshness badge (GEV 16) | ⏸ look check |
| C4 | Replay: scrubber with Step / Play / Latest (GEV 4), tweened heights (GEV 5), roof flash, born/gone, split-flap commit board (GEV 2) | |
| C5 | Lenses as looks on keys 1–6: Alap · Hő (Ironbow churn) · Kor (Noir age) · Ügynök (NVG agent) · Tulaj · Nyelv (GEV 1); grouped lens panel; cranes and ruins | ⏸ |
| C6 | Roads: regex imports + co-change arcs; Szomszédok panel (GEV 10) | |
| C7 | Query bar over loaded data (GEV 6), brackets on results (GEV 7), HUD line with landmarks (GEV 8) | |
| C8 | Városnézés: authored tours, JSON, play/stop (GEV 9); PNG share card | ⏸ |
| C9 | Compare two refs (green grew / red shrank); follow an author/agent with a trail (GEV 11); agent-session replay (CITY-D7 A) | |
| C10 | Kódváros as MCP tools: answers return a city view link (GEV 12) | CITY-D8 A/A/A |

## 4. Status

| WP | Status | Date | Note |
|---|---|---|---|
| C1 | DONE | 2026-10-22 | |
| C2 | DONE | 2026-10-22 | look check passed ("promising") |
| C3 | DONE | 2026-10-22 | procedural windows (lit ~ recency², distance LOD), night sky + vignette, beacon, `#cam=…&sel=…` links + Link button, freshness badge, START.cmd **K** (T11). Look check passed |
| C4 | DONE | 2026-10-22 | every file instanced (ghosts too), height/footprint/windows at commit T, tween, roof flash, Step/Play/Most + speed + activity strip, split-flap board, `#t=<hash>` links, panel "Ezen a ponton"; `tools/selftest.js` (rename/delete/agent fixture, 8 checks) |
| C5 | DONE | 2026-10-22 | 6 looks on keys 1–6 (body + windows + glow + plates + sky + fog), time-aware heat/age/agent, cranes on the hottest buildings, ruins (2 y untouched: dark windows), legends, `#lens=` links. Look check passed; default Alap (CITY-D6) |
| C6 | DONE | 2026-10-22 | regex imports in scan.js (JS/TS, HTML, CSS, Python, Markdown links; relative only — 221 roads here), arcs on selection (amber imports · cyan importers · violet co-change), U = all roads, Szomszédok list (click flies there), `#roads=1`; selftest 9 checks |
| C7 | DONE | 2026-10-22 | query bar ( / ): offline Hungarian parser — path words, language, csak/ügynök/ember, forró, régi/friss N nap·hét·hónap·év, >N sor/commit, legnagyobb/legaktívabb/legimportáltabb/legrégebbi, top N; summary + list (click flies), numbered brackets on screen, `#q=` links; HUD line `KÖRZET · fájl · forró · NEAR <landmark>` |
| C8 | DONE ⏸ | 2026-10-22 | Városnézés: a shot = a share-link view + title + caption + fly/hold; automatic tour from the data (9 shots: overview, biggest district, 3 landmarks, hot district, first / middle commit, today); own tours: + Jelenet, export/import JSON, `scan.js --tour` bakes them in; `#tour=auto&loop=1` = wallboard; lower-third captions, Esc / touch stops. "Kép": 1200×630 PNG card. Fixed on the way: animations used the rAF stamp against performance.now (negative progress threw the camera off), HUD debounce → throttle. Look check passed |
| C9 | DONE (part) ⏸ | 2026-10-22 | Δ Összevetés (B): pin a base, buildings show base → shown commit (új / nőtt / csökkent / változatlan), red glass ghosts for files deleted since, red base tick on the strip, `#base=`; Követés: author or agent trail (last 40 commits, fading, head marker), `#follow=a0/g0`. Verified on the selftest fixture (KEEP_FIXTURE=1): ghost + born/gone render. |
| C9 | DONE | 2026-10-23 | Munkamenet (CITY-D7 A): `scan.js --sessions` (opt-in) reads the local Claude Code transcripts of the repo and its worktrees through `sessions.js` and keeps **only** file/folder path, kind (olvas · keres · szerkeszt) and seconds — no prompts, replies, patterns, edit text or commands; newest 30 sessions with ≥ 3 steps. Viewer: session picker + ▶ in the timeline bar, a light hops roof to roof along a low arc (blue read · violet search · amber edit), touched roofs keep a dot in the strongest colour, a folder search floats over its district's skyline, readout with step / time / path / counts, Esc closes, `#sess=<id>` opens finished. Here: 7 sessions, 153 path events. selftest 14 checks (incl. no-secret check on a fake transcript) |
| C10 | DONE | 2026-10-23 | `CodeCity/mcp.js`: zero-dependency MCP server (JSON-RPC 2.0 over stdio, protocol 2025-06-18 / -03-26 / 2024-11-05). Tools: **city_summary** (size, history, agent share, districts, landmarks, hottest, STALE check against HEAD) · **city_query** (the page's own query language, optional `at` commit) · **city_file** (lines, commits, owner, agent share, heat, imports / importers / co-change) · **city_hotspots** (recent churn, `agent` = "where is the agent rework?", `under`) · **city_view_link** (q · sel · lens · t · base · follow by name · roads · tour) · **city_rescan** (writes only dist/<name>.city.json + .html, never --sessions). Every answer ends in a file:/// link with the view set. No duplicated logic: the parser moved to `src/09-ask.js` (pure; metrics to 05-replay) and `core.js` loads the page's own modules in a vm. Page: a `#sel=` link without a camera now flies to the file. selftest 23 checks (9 for mcp) |

## 5. Decisions

- CITY-D1 Name **VRG Kódváros**, folder `CodeCity/`, Hungarian UI, English code. (assumed — say if not)
- CITY-D2 Data embedded in one offline page, like the client preview. (assumed)
- CITY-D3 Agent commits are recognised from `Co-Authored-By` trailers naming Claude, Copilot, Cursor,
  Codex, Gemini, Devin, Aider. A commit without a trailer counts as "no record", not as human.
- CITY-D4 **A** (user, 2026-10-22): Kódváros gets the letter **K** in START.cmd.
- CITY-D5 God's Eye View is an idea source only (Vendor, priority 3). Its code is MIT and may be
  adapted with the notice; its data and models are never taken.
- CITY-D6 **Alap** is the default look (user, 2026-10-22).
- CITY-D8 **A / A / A** (user, 2026-10-23) — Kódváros MCP: (a) read tools + view links + a rescan that writes only CodeCity/dist (no --sessions) · (b) zero-dependency Node over stdio, sharing the page's query code · (c) registered by a documented `claude mcp add` command, no checked-in .mcp.json.
- CITY-D7 **A** (user, 2026-10-23) — agent-session replay (mindwalk-style: what an agent *read, searched, edited* in one
  session, as light moving over the city). Needs Claude Code transcripts (`~/.claude/projects/<repo>/*.jsonl`),
  which hold your prompts and tool output. A) `scan.js --sessions` reads them locally and keeps only
  file paths + read/edit kind + timestamps, nothing else, **opt-in per scan** (recommended) ·
  B) skip it; agent share from commit trailers is enough · C) full transcripts incl. text (not recommended:
  the page would carry your conversations).

**Live workspace decisions** (user, 2026-10-26, KV-01; options in the report
`docs/research/reports/Kódváros live workspace and GitWorld.md` §6.3):

- CITY-D9 **A + D** — host: companion server + browser page now, Electron later as packaging and
  overlay host; **plus** a VS Code extension (D) as a second front end on the same companion.
- CITY-D10 **A** — the city reads, opens and launches; every write is a pre-filled Claude prompt or a
  confirm with a ghost preview and a safety copy/ref. No git writes by the city itself.
- CITY-D11 **A** — live Claude feed via a small stripper hook (path + kind POSTed to the companion) in
  the gitignored `.claude/settings.local.json`; transcript tail as fallback.
- CITY-D12 **A** — hook in this repo first; move to the user-level `~/.claude/settings.json` after P4's
  check passes.
- CITY-D13 **A** — update the portable Claude Code (2.1.261) before P4.
- CITY-D14 **A** — in-city editor: CodeMirror 6 + merge, vendored as npm + sha512.
- CITY-D15 **C, with A's link as fallback** — embedded terminal (xterm + node-pty) from the start;
  the `claude-cli://` deep link stays as the fallback when the embedded one is unavailable.
- CITY-D16 **A** — show only: no `PermissionRequest` approvals, no restricted-zone blocking until P13,
  then opt-in.
- CITY-D27 **A** — window titles, outside paths, IPs, DNS and device names stay in memory only, with a
  blur mode; nothing persisted.
- CITY-D23 **A** (user, 2026-10-26, before P8) — no packet capture: NIC counters + the TCP table + DB-IP Lite;
  exact bytes only via Tier B, if ever.
- CITY-D24 **A for now** (user, 2026-10-26) — no router change: NIC counters, tracert, ARP. The user wants to flash
  OpenWrt anyway: its own thread, codephrase `GO OPENWRT` (`GO-OPENWRT.md`); after that, re-ask D24 as C
  (read-only router telemetry).
- CITY-D28 **A** (user, 2026-10-26) — stay on three.js r169; upgrade only when a feature needs it (globe.gl: r179+).
- **Tárház / H: walk** (user, 2026-10-26, KV-17): memory only, rescanned when the city opens — CITY-D27 A holds;
  KV-17's "cached H: walker" is not built as a cache.
- CITY-D21 **A** (user, 2026-10-26, before P9) — an unauthenticated snapshot from vendor-manifest.json + public repo
  metadata, refreshed rarely; a token only later, from an environment variable, never stored.
- CITY-D22 **A** (user, 2026-10-26) — placement mix: ecosystem continents, the repos we depend on near our Land, the
  Map of GitHub as a faint background.
- CITY-D18 **A** (user, 2026-10-26, before P10; before 2026-11-10) — the .NET 10 SDK unpacked into Planner/apps/dotnet
  (gitignored, no admin); vrg-probe.exe published self-contained. Name the download to the user first.
- CITY-D25 **A** (user, 2026-10-26) — Spotify stadium from Windows' own now-playing (GSMTC) + the OS peak meter; no
  Spotify API, no login.
- **KV-21 download approved** (user, 2026-10-26): .NET SDK **10.0.403** win-x64 zip (released 2026-10-25, runtime
  10.0.14, security release, ~300 MB) from builds.dotnet.microsoft.com; check its SHA-512 against
  `release-metadata/10.0/releases.json`, unzip into `Planner/apps/dotnet` (gitignored). **Done 2026-10-26 (KV-21):** SHA-512
  matched, unpacked. The zip has no runtime pack, so a truly self-contained publish needs one more download
  (Microsoft.NETCore.App.Runtime.win-x64 10.0.14 from nuget.org, not asked yet); until then vrg-probe.exe is
  framework-dependent and runs on Planner/apps/dotnet's own runtime (the segéd sets DOTNET_ROOT) — no admin, no install.
- CITY-D17 **A** (user, 2026-10-26, before P11) — nothing elevated until P11; then one read-only vrg-etw.exe started by a
  scheduled task the user creates from written steps (Claude never creates it).
- CITY-D19 **A** (user, 2026-10-26, before P12) — the user applies the 21H2 → 22H2 enablement package; write the steps first.
- CITY-D20 **A** (user, 2026-10-26) — Electron overlay host, three layers (Lively wallpaper first).
- Still open: CITY-D26 (look name and rules, before P13).

## 6. Use

```
node tools/fetch-vendor.js three                       # once: three.js into Vendor/
node CodeCity/scan.js <repo> --html CodeCity/dist/<name>.html
node CodeCity/build.js                                 # the empty template that opens a *.city.json
node CodeCity/scan.js . --js CodeCity/dist/vrg-codecity.data.js  # this repo as the template's default view (START.cmd K runs it on open)
node CodeCity/tools/shot.js "CodeCity/dist/<name>.html#pick=0.45,0.6"   # headless check incl. picking
node CodeCity/tools/selftest.js                        # scanner, sessions privacy, MCP server, companion, specs (77 checks)
# wallpaper (KV-24): Lively → Add wallpaper → URL  http://localhost:8797/#mode=wallpaper&fps=2   (steps: wp/p12-overlay.md)
# overlay (KV-25): START.cmd K → F, or  Planner\apps\electron\electron.exe CodeCity\shell   (Ctrl+Alt+K; live check: … CodeCity\shell --selftest)
node CodeCity/tools/build-etw.js                       # vrg-etw.exe (P11): TraceEvent from nuget.org, pinned by CodeCity/etw/packages.lock.json
node CodeCity/tools/build-probe.js                     # vrg-probe.exe (P10) with the portable SDK in Planner/apps/dotnet, offline
node CodeCity/companion.js                             # live mode: the city on http://localhost:8797 with local actions (START.cmd K → S)
node tools/fetch-vendor.js node-pty xterm xterm-fit    # once: the embedded terminal (else Terminál itt opens an outside window)
node CodeCity/scan.js <repo> --tour tours.json --html … # bake exported Városnézés tours into the page
node CodeCity/scan.js <repo> --sessions --html …       # opt-in: agent sessions (paths + kind + time only)
#                                    [--sessions-dir <~/.claude/projects/<folder>>] to name the transcripts
# MCP (C10): register once — this checkout, or add --scope user for every project
claude mcp add kodvaros -- node <repo>/CodeCity/mcp.js     # [<other repo>] [--dist <dir>]
# then ask Claude e.g. "where is the agent rework in Planner?" — answers end in a city link
# page.html#sess=<id>                                  # a session, finished; &sessplay=1 plays it (test hook)
# page.html#tour=auto&loop=1                           # wallboard: the automatic tour, forever
# page.html#cardtest=1                                 # headless check of the PNG card (shows it on the page)
```

## 7. Later — circle back (parked 2026-10-23)

**Parked on purpose.** C1–C10 work, and the current priority is elsewhere: merge every working line
into one main working version and trim the other branches (GO ALL / consolidation). Kódváros waits
until that list is done.

- **Fine-tuning its base**: the user has dev notes for it, not yet written down here. When this is
  picked up, ask for those notes first; do not guess at them.
  **2026-10-26 (KV-01):** the user will bring the dev notes to the Claude Design batch (below),
  together with the screenshots; none are recorded yet.
- **Gitropolis and AgentCity** (§2 credits): the user does not have the links at hand — look the
  likely repos up on GitHub in a later prompt and add the links to §2 (KV-01 Q2).
- **Candidate for a later Claude Design batch** (user, 2026-10-23): the look and feel (night look,
  lenses, panels, readouts, tour captions, share card) is a good fit for one Claude Design pass
  rather than more piecemeal WPs. Bring the notes and screenshots of each look (`tools/shot.js`) to it.
- Until then: no new Kódváros WPs. Fixes only if the consolidation breaks something.
- **2026-10-26 — Kapu's features come here.** Kódváros is to become more than a viewer: the main tool
  for our code work. VRG Kapu was cut down to an access page, and its board, editor, claims,
  Munkanapló, refresh / "Mi változott?", personal links, tour, glossary and helper actions are parked
  in `CodeCity/from-kapu/` (sources, data, tests; README there with first ideas). The plan for
  bringing them in is for its own thread — start from that README.

### 7.1 Metaphor ideas (2026-10-26, ranked, not WPs yet)

Ranked by use for our own work, not by looks. 1–4 are cheap: their data is already in the repo, and
each catches a mistake this repo has made before. Turn them into WPs only with the user.

**Shows what is invisible today**

1. **City gates = START.cmd.** Each registered tool is a gate in the wall with a road to its page. A
   tool page with no road to a gate is unregistered (it does not exist for the user); a gate whose
   road ends in nothing is a broken entry. `tools/check-start.js` as a picture.
2. **Underground pipes = builds.** Pipes from the Planner / Inventory / Kapu / Kódváros sources to
   their `dist/` output; a source newer than its build floods the basement (stale build).
3. **Power plant = `Vendor/`.** One plant per vendored library, power lines to the files that use it;
   a sign with its licence (MIT, BSD-3) and tag pin, red when pinned to a branch (`vendor-manifest.json`).
4. **Building sites = the GO plans.** Each `GO-*.md` is a fenced site over the files it touches, with
   a progress board from its WP table; parked plans are boarded up.
5. **Construction fences and live traffic, from Kapu.** Kapu's claims fence the claimed buildings so
   two sessions do not build on the same plot; a live mode (Kapu's companion server) drives a car to
   each building a Claude session is reading or editing now — sessions are only replayed today.
   This is where `CodeCity/from-kapu/` comes in; plan it from that README.

**Health as weather and wear**

6. **Smoke from chimneys** — TODO / FIXME / HACK counts per file (a grep in `scan.js`).
7. **Cracked facades** — very long functions or deep nesting; a rough count is enough.
8. **Weather over a district** — storm when its selftests fail, clear when they pass, fog where
   there are no tests.
9. **Traffic jams** — circular imports as a glowing road loop; much-imported files get wider roads.

**Reading the city**

10. **Zoning lens (Övezet)** — shipped HTML tools commercial, `tools/` industrial, docs residential,
    data and fixtures parks.
11. **City hall** — CLAUDE.md and the codephrases as a notice board in the centre; a codephrase
    flies to its building site.
12. **Morning newspaper** — Kapu's "Mi változott?" and Munkanapló as a front page on open:
    yesterday's commits, new buildings, demolitions, the hottest street.
13. **Museum district outside the walls** — archive tags (`archive/2026-10-24/planner-*-wip`) as
    boarded-up buildings: what is parked and where.
14. **Warehouses** — the files the scan skips (binaries, > 2 MB) as a warehouse row, so they do not
    silently vanish.

**Looks only — for the Claude Design batch:** seasons by repo age, a day/night cycle on the real
clock, street names from the Kapu glossary.

### 7.2 Borrowed ideas (2026-10-26, ranked, not WPs yet)

Source: the user's ChatGPT conversation "Compare visual metaphors" (alternatives to the city for
BRIDGE, then deliberately poor fits). Its key point: a **metaphor stack** — one world carries the
structure, other metaphors lend their visual language to single aspects. The city stays the base;
each idea below is a district, mode or phenomenon inside it. Only what §7.1 does not already cover.

**Strongest — new kinds of answers**

1. **Repair tunnel** (dungeon) — paste a stack trace or failing test output; its files light up as
   one underground tunnel from the error to its origin. Only paths and line numbers need parsing.
2. **Blast radius** (clockwork, spider web) — select a building; a shock wave runs ring by ring along
   the reverse import roads: what a change here affects. A graph walk over data we already have.
3. **Harbour** (port) — external systems dock at the city edge: GitHub remote, Claude API, npm,
   OneDrive, later the ESPHome devices. Files that call out (`fetch`, serial, `child_process`) get a
   road to their dock; Kapu's GitHub sign-in is the customs house. Where BRIDGE hardware enters first.
4. **Metro line** (subway) — pick two buildings, get the shortest import route as a metro line with
   stations. From a START.cmd gate (§7.1 #1) it shows how the launcher reaches any file.
5. **Fog of war** (game world) — districts no Claude session has read in N days are fogged
   (`--sessions` already records reads): where the agents' knowledge of the code is old.

**Good, medium effort**

6. **Foundation stone** (DNA) — a plaque with the building's lineage: birth commit, renamed from
   (renames are followed already), adapted from which `Vendor/` code and under what licence.
7. **City library** (library) — `docs/` as a library; a building shows the docs that mention it,
   unmentioned buildings are marked undocumented. A path grep over the Markdown.
8. **Inspector's beacon** (hospital) — one roof lamp summing §7.1's smoke, cracks, weather and stale
   builds: green / yellow / red / grey. One glance instead of four lenses.
9. **Building interiors** (arcology, universe zoom) — zoom into a building: one floor per top-level
   function or section, a cutaway shows sizes. Zoom levels city → district → building → floor.
10. **Build mode / run mode** (Lego vs factory) — build mode shows sites, scaffolding and "% assembled"
    from the GO plans; run mode shows traffic, live sessions and the harbour. Keeps them apart.

**Nice touches**

11. **Fireworks** (space launch) — in the replay, merge and tag commits burst over the district they
    touched; a finished GO plan is a launch.
12. **Region map** (universe) — zoom out to neighbouring cities (other repos, e.g. `VRG_Visual_Base`)
    joined by highways where they share files or data. `scan.js` already reads any repo.
13. **Waypoints and quests** (game world) — bookmarked buildings as waypoints; each GO plan's next
    open WP as a quest marker over its site.
14. **Epidemic lens** (petri dish) — follow one pattern (a function name, an old API) as it spreads
    through the replay. The costliest: needs file contents at every commit, not just line counts.

Left out: orchestra and ant colony (follow and §7.1 #5 cover them); metaphor skins (the same city
rendered as factory or space station) — the city is the base, but keep the engine skin-neutral.

## 8. Élő munkatér

The live-workspace plan (2026-10-26): Kódváros grows from a viewer into the main tool for our code
work — open, find, launch and watch Claude, live. Source: the report
`docs/research/reports/Kódváros live workspace and GitWorld.md` §6; prompts
`docs/city/PROMPTS-WORKSPACE.md` (KV-01 … KV-27), run in order. Decisions in §5 (CITY-D9…).
One stub per phase in `docs/city/wp/`.

| Phase | Content | Decisions | Done-check | Status |
|---|---|---|---|---|
| P0 | [Decisions and plan](wp/p00-decisions.md) | — | README §5 lists the answers; §8 has the phase table; every phase has a stub here. | DONE |
| P1 | [Companion server](wp/p01-companion.md) | D9, D10 | `node tools/check-start.js` passes; the page opens from START.cmd served and still from `file://`; selftest green. | DONE |
| P2 | [Actions, Ctrl+K, multi-select, terminal](wp/p02-actions.md) | D9, D15 | Right-click a building → VS Code opens on it; Ctrl+K "07a" flies there; three selected → "Ask Claude about these" opens a pre-filled prompt; items greyed with a Hungarian reason in `file://` mode; the embedded terminal runs `claude`, or the link opens when it cannot. | DONE |
| P3 | [Live repo stream](wp/p03-live-repo.md) | D9 | Edit a file in VS Code → its building pulses within ~1 s; a commit updates the timeline without reload. | DONE |
| P3b | [VS Code extension (CITY-D9 D)](wp/p03b-vscode.md) | D9, D10 | In the portable VS Code, the command "Kódváros: megnyitás" shows the city; switching editor tabs flies to that building. | open |
| P4 | [Live Claude](wp/p04-live-claude.md) | D11, D12, D13, D16, D27 | A second session shows a second figure; its reads beam to roofs live; a session waiting for permission shows amber on the board; closing the city does not slow Claude. | DONE |
| P5 | [Panels: editor and terminal](wp/p05-panels.md) | D10, D14, D15 | Open README.md in a panel and preview it; an edit shows a diff before saving; `claude` runs in the panel and resumes after a companion restart. | DONE |
| P6 | [Process supervisor](wp/p06-processes.md) | D9 | Start MindMap's server from the city → its gate lights and its log streams; a failing selftest raises a storm; stop kills the whole tree. | DONE |
| P7 | [Git made visible](wp/p07-git.md) | D10 | A test branch with one commit → a new line with one station; the preview shows touched stations; the reflog lane scrubs back. | DONE |
| P8 | [The Land](wp/p08-land.md) | D23, D24, D28 | Zoom from the Land to a file floor without jitter; a 100 MB download sails in as a ship; copying to a stick runs a train. | DONE |
| P9 | [GitWorld planet](wp/p09-planet.md) | D21, D22 | The vendored repos sit as foreign cities on their continents with licence colours; offline, the planet renders from the snapshot. | DONE |
| P10 | [Probe sidecar (Tier A)](wp/p10-probe.md) | D18, D25, D27 | Spotify playing → the stadium lights; dragging a sound tower changes its volume; Paint raises a construct that dissolves when closed. | DONE (with Spotify itself: the user's check) |
| P11 | [Elevated ETW (Tier B, optional)](wp/p11-etw.md) | D17, D23 | A `git clone` shows the exact cargo per process; a file read inside a Bash command beams to its roof. | DONE (checked 2026-10-27 on the user's elevated task) |
| P12 | [Overlay OS](wp/p12-overlay.md) (L0 wallpaper KV-24, L2 overlay spike KV-25) | D19, D20 | After 22H2: the hotkey summons the city in < 150 ms; idle ~0 %; clicking a building hands off to the real window, Esc returns. | open |
| P13 | [Live-first polish](wp/p13-polish.md) | D26 | Every rule has a check in selftest/shot.js; the Design batch pack exists. | open |

Changes against the report, from the user's KV-01 answers: P2 brings the embedded terminal forward
(CITY-D15 C, link as fallback); P3b is new (VS Code extension, CITY-D9 D).

**Prompts done** (`KV-nn ✔ date commit`):

- KV-01 ✔ 2026-10-26 2af8607
- KV-02 ✔ 2026-10-26 9e1f402
- KV-03 ✔ 2026-10-26 7b39857
- KV-04 ✔ 2026-10-26 bd221e1
- KV-05 ✔ 2026-10-26 0d38244
- KV-06 ✔ 2026-10-26 f50bbc3
- KV-07 ✔ 2026-10-26 1bd1c8f
- P2 embedded terminal (CITY-D15 C) ✔ 2026-10-26 764913b — not a KV prompt; added from the user's KV-01 answer
- KV-08 ✔ 2026-10-26 a62235f
- KV-09 ✔ 2026-10-26 3b9704d
- KV-10 ✔ 2026-10-26 263c298 (hooks applied after the user's yes; exec form, onFailure continue)
- KV-11 ✔ 2026-10-26 c9d7474
- KV-12 ✔ 2026-10-26 b5ab297
- KV-13 ✔ 2026-10-26 98b7820
- KV-14 ✔ 2026-10-26 ada1352
- KV-15 ✔ 2026-10-26 9779674
- KV-16 ✔ 2026-10-26 5f1a07b
- KV-17 ✔ 2026-10-26 a3b7b5a
- KV-18 ✔ 2026-10-26 57e8a07
- KV-19 ✔ 2026-10-26 3fe20ea (the real USB-stick check is the user's step — wp/p08-land.md)
- KV-20 ✔ 2026-10-26 1bec540
- KV-21 ✔ 2026-10-26 0ef5900 — framework-dependent until the runtime pack is fetched (§5)
- KV-22 ✔ 2026-10-26 f113c30 — P10 done; checked live on Opera (GSMTC + its tower), Spotify was not running
- KV-23 ✔ 2026-10-26 84b255d — checked 2026-10-27 with the user's elevated task: a clone's exact cargo per process, a cmd read of GO-LIVE.md beamed to its session
- KV-24 ✔ 2026-10-27 ad3b93a — idle wallpaper measured at ≈0.3 % of the PC; Lively itself is the user's step
- KV-25 ✔ 2026-10-27 (this commit) — Electron 44.7.1 overlay: no black-transparency bug on the GTX 1050 Ti; summon 23–88 ms, hidden 0.06 % of one core
