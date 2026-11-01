# 7. The user's additions, and the build phases

Both additions came with the decisions on 2026-10-31. The wording below keeps the user's images.

## 7.1 Növekedés: the organic street plan (CITY-D42 C)

The island can be rearranged between two plans, with the same buildings moving to their new places:

- **Bekötés:** the board's real wiring (CITY-D42 A).
- **Növekedés:** the city as it grew. It follows the git history: a small village first, a primitive Planner, growing
  into a multi-vector dev project where ideas grow and merge, leaving data, code and programs behind them.

| Element | Means | Source |
|---|---|---|
| The hub | Where the first commits landed: the Planner village | `city.json`: earliest folder |
| Main roads | Idea vectors, starting at the hub | Top-level areas in the order they first appeared |
| Shops along a road | Programs of that idea | Shipped tools in `launcher/vrg-menu.json` |
| Warehouses, boxes, packs | Memory data, code and programs left along the way | File sizes and kinds per area |
| Gardens | A program with the design system applied | Mélyvíz files in that program |
| Road junctions | Ideas merging | Co-change between areas |

## 7.2 Birtok: drives as land (CITY-D45 note)

Viewed **from above**, memory fields correspond to size: a drive's total capacity is the whole estate, and each program,
folder or file takes the area its bytes really take.

| Land | Means |
|---|---|
| Farm fields, open pasture | Empty, unused space |
| Shacks, small farmhouses | Small files |
| Taller, downtown-looking skyscrapers | Large files |
| Art Gallery | Pictures |
| Concert Hall | Audio |
| and so on | Other kinds get a fitting building |

Sizes come from a disk walk that stays in memory only and shows names blurred (CITY-D27 A). It is a measured view (**M**)
for area; the farm imagery is the rendering.

## 7.3 Phases

| Phase | Content | Waits on |
|---|---|---|
| **S1 ✔ 2026-10-31** | View, island on a real water plane, nine complexes, ground and undercity, live feed, panels, close program, toggles for bodies and tags, fixture mode, START key, Erőmű door | Nothing |
| **S2a ✔ 2026-10-31** | Növekedés plan with the rearranging move and the replay | S1 |
| **S2b ✔ 2026-11-01** | Birtok land view: every drive (CITY-D52 A) | S2a |
| **S3a ✔ 2026-11-01** | The 15-minute memory history with look-back, the opt-in recording | S2 |
| **S3b** | Sensors, disk I/O per program, physical page map (installed by the user on 2026-11-01), traffic per program (live) | The user's elevated steps |

**S1 as built:** `CodeCity/probe/Homeland.cs`, `CodeCity/homeland.js`, `homeland-classes.json`, `probe-hw.ps1`,
`src/40-hm-core.js`, `41-hm-island.js`, `42-hm-city.js`, `tools/spec-homeland.js`. Open with START → K → G or
`http://localhost:8797/homeland`; `#hmtest=1` is the fixture. Keys: PgUp / PgDn layers, A every process, T tags, M measured
only, Home frames the island. The Street level (−1) stands on the surface as small booths. Not in S1: CITY-D45's Mérés lens
only dims metaphor parts, because S1 builds none tagged J; the 15-minute memory history (CITY-D48) comes with S3; hints cover
the Temp and Downloads origin only, not signatures.

**S3a as built:** `src/47-hm-time.js` and `aggregate()` in `homeland.js`. The strip at the bottom shows the last 15 minutes; a drag
or ← → looks back, and End or Élő returns. Decided in the build:

- **The ring lives in the page**, not in the segéd as 04-data-feed first said: it needs no second API, the fixture gets it for
  free, and it goes with the page, so nothing outlives the view. Each second is folded by program family, about 30 kB.
- **It fills only while the view is open,** because the feed runs only then. A gap in the strip is time the view was closed.
- **The past cannot read as live:** a permanent banner, the HUD frozen on that second, closing a program off, and the
  *Mind* view shows families, because single processes were folded away.
- **The recording** is the user's switch, stops with the feed, and ends by itself after a day. Each line covers ten seconds:
  totals and per-class CPU and memory. No program, folder or file name can reach it (`aggregate()`, tested).
  Files go to `.cache/homeland/`, which is gitignored; the *Felvételek* panel lists them with their peaks.

**CITY-D53 A (sensors), built, waiting on the user's install:** `CodeCity/etw/Sensors.cs` reads CPU, board and disk sensors through
LibreHardwareMonitorLib 0.9.6 (MPL-2.0, pinned by hash), inside the elevated `vrg-etw`, while someone reads the pipe. Read-only: no
fan or voltage is set. Checked before adding it: neither the library nor its dependencies contain service-creation calls or a
PawnIO installer, only an "is it installed" check and the Pawn modules. PawnIO itself is a third-party kernel driver by namazso;
its install is the user's. A real unelevated run on this PC read the CPU's name and power rows with `pawnio:false`, no temperature,
and left no driver behind. Temperatures and fans are therefore **not yet seen on real hardware**. Steps: [04-data-feed.md](04-data-feed.md) §4.7.

**S3b, the rest as built:** all of it comes with one reinstall of `vrg-etw`, done by the user on 2026-11-01. Real data read from the pipe that day: sensors,
disk rows and the page map; the HUD reads *ETW: be · szenzor: be*. Seen in the live panels the same day: a disk panel's program row, the *Hálózat* row and the page map, both modes, no warning.

- **Disk I/O per program** (`Keywords.DiskIO`, plus `Thread` because a disk event names a thread): bytes per program and disk, top 24,
  once a second, on the disk panels and as a program's *Lemez* row. No file name leaves the sidecar. Work with no owner counts as System.
  **No hard-fault keyword:** the process snapshot already counts hard faults per program, so ETW would add cost and no fact.
- **The physical page map** (`etw/Pages.cs`, `src/48-hm-pages.js`, CITY-D44 B): the market's *Fizikai lapok…* button. Every frame, folded
  into 64 × 64 cells by address, by list or by use, with totals. Program and file are never read.
  - **On request only:** connecting to a second one-way pipe, `vrg-etw-pages`, is the request, so the sidecar still takes no input. No timer; a result stands for 10 s.
  - **Undocumented, so checked:** each reading is compared with the live page-list counters. Over 10 % off and the panel warns and tags it K.
    A refusal shows its reason. Unelevated, the query is refused with access denied (0xC0000022). Elevated, the layout held on 2026-11-01:
    690 ms, every frame seen (15.87 GB), page lists about 1 % from the counters.
  - **Privileges:** debug and profile are switched on in this process only, for the scan, and back off after it. No system setting changes.

**Found while testing:** ETW names a program without `.exe`, so the *Hálózat* row of the previous commit never matched; names are now
normalised (`hmExeKey`). In Gépország the HUD bar covered the panel's title and ×; the panel now starts below it. A `#hmtest=1` page
took whatever was on the stream, ETW and even another page's full feed, under its PRÓBAADAT banner; every feed event now passes one gate
(`hmLive`), tested.

**Checked by hand 2026-11-01:** closing is off in the past and back at End; names blur, show and blur again; *Mappa megnyitása* opens one
Explorer window; the page retries every 15 s and C: arrives (408 GB) without stalling at 98 %.

**S2b as built:** `CodeCity/probe/Estate.cs` (`vrg-probe --estate`), `CodeCity/estate-walk.js` (the fallback),
`src/45-hm-estate-plan.js` (pure, tested), `46-hm-estate.js`. The Birtok button or key B opens it, the drive buttons switch,
Újramérés walks again. Decided in the build:

- **True area on one scale.** The square is the capacity and each byte takes the same area on every drive, so C: is about ten
  times the size of H:. Below 1 GB a partition is left out: the two 100 MB system partitions would be specks.
- **Three kinds of land:** free space is pasture (M); read folders are plots (M); what is used but not read is the dark
  *Nem olvasott* zone (K): system files, refused folders, walled zones, or the time limit. It keeps its true area.
- **On a plot** the five largest files of 100 MB or more are towers. A kind with 12 % or more of the plot gets its hall: Képtár,
  Koncertterem, Mozi, Könyvtár, Műhely, Raktár, Gyártelep. The rest are farmhouses and shacks, up to 14 per plot.
  The number of homes grows with the log of the file count; only the area is exact.
- **No file names, ever** (CITY-D27 A): the page gets sizes, kinds and folder names, and a tower is "Videó · 3,2 GB". Folder names
  are blurred until clicked, and no sign on the map shows one, because `jobs` holds client names. *Mappa megnyitása* opens the
  plot's folder in Explorer, which is how a hall is "reachable" without carrying names into the city.
- **The walk is native.** With the antivirus on every file open, Node managed about 3 000 files a second. A directory listing
  carries the sizes, so `vrg-probe` reads about 9 000 a second on the same disk. Folders take turns in 0.7 s slices for up to
  180 s, at low priority, one drive at a time, on request, and the result stays in the segéd's memory for 30 minutes.
- **Measured 2026-10-31 on a busy machine:** H: 37 GB in 43 s, G: 207 GB in 7 s, both complete; F: 607 GB complete; C: 368 GB
  in 180 s, partial, so C: shows an honest *Nem olvasott* zone for what is left.

**S2a as built:** `CodeCity/src/43-hm-plan.js` (pure, tested) and `44-hm-grow.js`. Key N or the Bekötés / Növekedés buttons
switch plans, R or Újra replays the history. Decided in the build:

- **Distance from the hub is commit time**, order around the hub is first appearance, so age rings form. The street's curve
  is decoration (J); sizes are lines of code, because the scan keeps no bytes.
- **The hub is the area with the most files in the first commit.** The history starts at the import, so earlier work is
  not visible, and the hub's panel says so.
- **Complexes move, nothing is rebuilt.** Eleven zones shrink to 55 % onto a ring with their live lights, panels and plots;
  the F: barge stays moored. The board's wires fold into a ring road that carries the same measured traffic.
- **Lots** are per area, period (one seventh of the history) and kind: warehouse from 5 000 lines, boxes from 500, then a
  pack. A deleted file leaves a ruin, a deleted idea a dark street.
- **Shops** are START's tools (a page without the segéd has none). **Gardens** need a Mélyvíz HTML or CSS file in the
  tool's folder; `scan.js` marks these as `mv`.
- **Junctions:** the six strongest pairs by shared commits (Jaccard), at least three commits; commits across more than six
  areas count as sweeps. Very distant pairs are left out, because their link would cross the village.
