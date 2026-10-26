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

## 6. Use

```
node tools/fetch-vendor.js three                       # once: three.js into Vendor/
node CodeCity/scan.js <repo> --html CodeCity/dist/<name>.html
node CodeCity/build.js                                 # the empty template that opens a *.city.json
node CodeCity/scan.js . --js CodeCity/dist/vrg-codecity.data.js  # this repo as the template's default view (START.cmd K runs it on open)
node CodeCity/tools/shot.js "CodeCity/dist/<name>.html#pick=0.45,0.6"   # headless check incl. picking
node CodeCity/tools/selftest.js                        # scanner, sessions privacy, MCP server (23 checks)
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
- **Candidate for a later Claude Design batch** (user, 2026-10-23): the look and feel (night look,
  lenses, panels, readouts, tour captions, share card) is a good fit for one Claude Design pass
  rather than more piecemeal WPs. Bring the notes and screenshots of each look (`tools/shot.js`) to it.
- Until then: no new Kódváros WPs. Fixes only if the consolidation breaks something.
- **2026-10-26 — Kapu's features come here.** Kódváros is to become more than a viewer: the main tool
  for our code work. VRG Kapu was cut down to an access page, and its board, editor, claims,
  Munkanapló, refresh / "Mi változott?", personal links, tour, glossary and helper actions are parked
  in `CodeCity/from-kapu/` (sources, data, tests; README there with first ideas). The plan for
  bringing them in is for its own thread — start from that README.
