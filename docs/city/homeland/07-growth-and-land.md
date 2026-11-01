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
| **S3** | ETW upgrades, sensors through LibreHardwareMonitor (CITY-D51 A: confirm the PawnIO need, ask before installing), physical page view, opt-in recording | The user's elevated steps |

**S1 as built:** `CodeCity/probe/Homeland.cs`, `CodeCity/homeland.js`, `homeland-classes.json`, `probe-hw.ps1`,
`src/40-hm-core.js`, `41-hm-island.js`, `42-hm-city.js`, `tools/spec-homeland.js`. Open with START → K → G or
`http://localhost:8797/homeland`; `#hmtest=1` is the fixture. Keys: PgUp / PgDn layers, A every process, T tags, M measured
only, Home frames the island. The Street level (−1) stands on the surface as small booths. Not in S1: CITY-D45's Mérés lens
only dims metaphor parts, because S1 builds none tagged J; the 15-minute memory history (CITY-D48) comes with S3; hints cover
the Temp and Downloads origin only, not signatures.

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
