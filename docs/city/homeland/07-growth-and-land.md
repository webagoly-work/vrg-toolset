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
| **S2** | Növekedés plan with the rearranging move; Birtok land view | S1 |
| **S3** | ETW upgrades, sensors through LibreHardwareMonitor, physical page view, opt-in recording | The user's elevated steps; a PawnIO driver question |

**S1 as built:** `CodeCity/probe/Homeland.cs`, `CodeCity/homeland.js`, `homeland-classes.json`, `probe-hw.ps1`,
`src/40-hm-core.js`, `41-hm-island.js`, `42-hm-city.js`, `tools/spec-homeland.js`. Open with START → K → G or
`http://localhost:8797/homeland`; `#hmtest=1` is the fixture. Keys: PgUp / PgDn layers, A every process, T tags, M measured
only, Home frames the island. The Street level (−1) stands on the surface as small booths. Not in S1: CITY-D45's Mérés lens
only dims metaphor parts, because S1 builds none tagged J; the 15-minute memory history (CITY-D48) comes with S3; hints cover
the Temp and Downloads origin only, not signatures.
