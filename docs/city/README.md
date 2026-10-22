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

Layout is computed once over every file that ever existed, so a building keeps its place through the
replay (the reason BabiaXR and Evo-Streets exist).

Licences: Git City is AGPL-3.0, so its look is **re-implemented, never copied**. three.js is MIT and
its header travels with the build.

## 3. Work packages (small, one per session)

| WP | Content | Stop |
|---|---|---|
| C1 | `scan.js`: files, LOC, language, commits, renames, authors, agent commits → `city.json` | |
| C2 | `build.js` + static city: stable treemap layout, instanced buildings, orbit camera, hover + info panel, language colours (launcher: CITY-D4) | ⏸ look check |
| C3 | Git City look: window texture (lit = recent), night sky, fog, pixel font, LOD | ⏸ look check |
| C4 | Timeline replay: scrubber, play/step, city at commit N, roof flash, born/gone | |
| C5 | Lenses: age · churn · owner · agent share; legend; cranes and ruins | ⏸ |
| C6 | Roads: regex imports and co-change arcs, click a building to light its links | |
| C7 | Compare two refs (green grew / red shrank); agent-session replay (mindwalk-style) | ⏸ decide scope |
| C8 | Export: PNG share card, launcher entry in `VRG-DE.cmd` | |

## 4. Status

| WP | Status | Date | Note |
|---|---|---|---|
| C1 | DONE | 2026-10-22 | |
| C2 | DONE ⏸ | 2026-10-22 | waiting for the look check |
| C3–C8 | open | | |

## 5. Decisions

- CITY-D1 Name **VRG Kódváros**, folder `CodeCity/`, Hungarian UI, English code. (assumed — say if not)
- CITY-D2 Data embedded in one offline page, like the client preview. (assumed)
- CITY-D3 Agent commits are recognised from `Co-Authored-By` trailers naming Claude, Copilot, Cursor,
  Codex, Gemini, Devin, Aider. A commit without a trailer counts as "no record", not as human.
- CITY-D4 **open** — START.cmd is full (10 one-key slots: 1–9, 0). Kódváros needs
  A) letter **K** in START.cmd (BILLENTYUK + DISPATCH, recommended) · B) only in `VRG-DE.cmd` under
  UNDER-DEV · C) wait until C8. Until then: open `CodeCity/dist/vrg-codecity.html` directly.

## 6. Use

```
node tools/fetch-vendor.js three                       # once: three.js into Vendor/
node CodeCity/scan.js <repo> --html CodeCity/dist/<name>.html
node CodeCity/build.js                                 # the empty template that opens a *.city.json
node CodeCity/tools/shot.js "CodeCity/dist/<name>.html#pick=0.45,0.6"   # headless check incl. picking
```
