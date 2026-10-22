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
| C9 | Compare two refs (green grew / red shrank); follow an author/agent with a trail (GEV 11); agent-session replay | ⏸ decide scope |
| C10 | Kódváros as MCP tools: answers return a city view link (GEV 12) | ⏸ decide |

## 4. Status

| WP | Status | Date | Note |
|---|---|---|---|
| C1 | DONE | 2026-10-22 | |
| C2 | DONE | 2026-10-22 | look check passed ("promising") |
| C3 | DONE | 2026-10-22 | procedural windows (lit ~ recency², distance LOD), night sky + vignette, beacon, `#cam=…&sel=…` links + Link button, freshness badge, START.cmd **K** (T11). Look check passed |
| C4 | DONE | 2026-10-22 | every file instanced (ghosts too), height/footprint/windows at commit T, tween, roof flash, Step/Play/Most + speed + activity strip, split-flap board, `#t=<hash>` links, panel "Ezen a ponton"; `tools/selftest.js` (rename/delete/agent fixture, 8 checks) |
| C5 | DONE | 2026-10-22 | 6 looks on keys 1–6 (body + windows + glow + plates + sky + fog), time-aware heat/age/agent, cranes on the hottest buildings, ruins (2 y untouched: dark windows), legends, `#lens=` links. Look check passed; default Alap (CITY-D6) |
| C6 | DONE | 2026-10-22 | regex imports in scan.js (JS/TS, HTML, CSS, Python, Markdown links; relative only — 221 roads here), arcs on selection (amber imports · cyan importers · violet co-change), U = all roads, Szomszédok list (click flies there), `#roads=1`; selftest 9 checks |
| C7 | in progress | 2026-10-22 | |
| C7–C10 | open | | |

## 5. Decisions

- CITY-D1 Name **VRG Kódváros**, folder `CodeCity/`, Hungarian UI, English code. (assumed — say if not)
- CITY-D2 Data embedded in one offline page, like the client preview. (assumed)
- CITY-D3 Agent commits are recognised from `Co-Authored-By` trailers naming Claude, Copilot, Cursor,
  Codex, Gemini, Devin, Aider. A commit without a trailer counts as "no record", not as human.
- CITY-D4 **A** (user, 2026-10-22): Kódváros gets the letter **K** in START.cmd.
- CITY-D5 God's Eye View is an idea source only (Vendor, priority 3). Its code is MIT and may be
  adapted with the notice; its data and models are never taken.
- CITY-D6 **Alap** is the default look (user, 2026-10-22).

## 6. Use

```
node tools/fetch-vendor.js three                       # once: three.js into Vendor/
node CodeCity/scan.js <repo> --html CodeCity/dist/<name>.html
node CodeCity/build.js                                 # the empty template that opens a *.city.json
node CodeCity/tools/shot.js "CodeCity/dist/<name>.html#pick=0.45,0.6"   # headless check incl. picking
node CodeCity/tools/selftest.js                        # scanner: rename / delete / agent trailer
```
