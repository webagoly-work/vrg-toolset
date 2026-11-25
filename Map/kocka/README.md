# VRG Kocka (Térkép-kocka)

A 200 m × 200 m × 200 m cube of the world around one picked point, shown as a holographic point cloud: terrain,
the soil block under it, buildings with their floors, streets, the tram and its overhead line, street lamps and other
street furniture. The look is a hologram projected in a dark room: the cube reconstructs itself from a rising sweep,
then turns slowly; drag to orbit, click a building or a lamp for its data.

**Its own line of work, opened 2026-11-25.** It starts as an independent page and merges into the VRG Térkép later
(phases below). It is the report's T4 ("separate 3D viewer for a picked area",
`docs/research/reports/VRG Map - detailed maps, 3D city and field layers.md` §8). Not the same thing as the Stack's
"Holo" orb (START R → 5), hence the name Kocka.

- Published page (private claude.ai artifact): https://claude.ai/artifact/Jki4qrp8m4mz7Z5aKzboqv
- START: **W → K** (VRG Kocka): S from the Térkép server (`http://localhost:8802/kocka/vrg-kocka.html`), L the offline
  single-file page, B rebuild, T tests.

## The cube

- Centred on the point (x east, y north, in local metres; equirectangular, error < 1 mm over 100 m).
- **The ground at the point is 20 m above the cube's floor**: floor = ground − 20 m, top = floor + 200 m. The 20 m
  below ground is drawn as a soil block (the cube's four sides and its floor). There is no subsurface data in it yet.
- Start point: 47.52629716033015, 19.037238239418304, Budapest III, Újlak, at Bécsi út / Lajos utca: ground 107.1 m,
  so the cube spans 87.1–287.1 m above sea level. Chunk `chunks/start-ujlak.json`.

## What is measured and what is assumed

Every building carries the source of its height, and the page shows it (legend, colour, the info panel):

| Source | Meaning | Start chunk |
|---|---|---|
| `tagged` | an OSM `height` tag | 4 |
| `floors` | OSM `building:levels` × 3.4 m + 1.2 m roof | 5 |
| `class` | assumed from the building type (`CLASS_H` in `lib/chunk.js`) | 14 |
| `size` | assumed from the footprint area | 28 |

Assumed walls are drawn in a different colour (violet-blue) from known ones (cyan). Where the cube's side cuts a
building, that face is drawn as a section (orange), not as a wall. Windows are stylised (one every 3 m per floor).
The terrain source is ~30 m resolution (SRTM / EU-DEM through the AWS terrain tiles), interpolated.

## Files

- `lib/chunk.js`: the cube maths and the point sampler (UMD, pure): `cube`, `terrainSampler`, `buildingHeight`,
  `cloud(chunk) → { pos, kind, feat, seed, features }`. Shared by the page and the tests; the Térkép will reuse it.
- `vrg-kocka.html`: the page. Raw WebGL2 (no library), HTML labels, Hungarian UI. Loads `lib/chunk.js` and
  `chunks/start-ujlak.json` by relative URL; another chunk JSON can be dropped onto it.
- `tools/fetch-chunk.py`: the **secondary-source** fetcher. Builds `chunks/<id>.json` for any point from Overture Maps
  (buildings, roads, rail, water, land, infrastructure, places; GeoParquet on public S3, read by HTTP range, only the
  footers and the row groups that touch the cube) and the AWS terrain tiles. Footer statistics are cached in
  `.cache/` (gitignored; the first run indexes ~930 files and takes a few minutes).
  `python Map/kocka/tools/fetch-chunk.py <lat> <lon> --id <name> [--title "…"]`
  Needs Python with `pyarrow fsspec aiohttp requests shapely pillow numpy`, and network.
- `tools/build-artifact.js`: one self-contained page (`dist/vrg-kocka-<id>.html`, lib and chunk inlined) for
  publishing and the offline START entry.
- `test/run.js`: 13 tests (invented geometry, plus a format check of every committed chunk and the build).
- `chunks/*.json`: format `vrg-kocka/1`, ~30 KB each. Public map data only (ODbL / Overture licences in `sources`).

## Phases

| # | Deliverable | State |
|---|---|---|
| K0 | Independent page + fetcher + sampler + tests, the start point | built 2026-11-25 |
| K1 | Pick in the Térkép: a key (K is free there) shows the 200 m square on the map; "Kocka" opens this page for it | ⏸ waits on Q1 |
| K2 | Our own data first: build the chunk from the Térkép's `hungary.pmtiles` (OSM buildings with heights), `terrain.pmtiles` and the measured Budapest heights `bp-heights.bin` (B layer), in Node, offline. Overture stays the fallback | next |
| K3 | Merge: the cube as a Térkép mode (same camera language, the J jobs and W weather layers inside it) | later |
| K4 | Under the ground: geology (report T5), utilities per job (e-közmű), basements, only with a named source | later |
| K5 | Better surface: Lechner DSM (paid) or the Sketcher's Ház 3D (COLMAP) point clouds placed into the cube | later |

## Open questions (A recommended)

1. **Where is the point picked?** A: a Térkép key, the cube opens in its own tab. B: a side panel in the Térkép.
   C: inside the Térkép's own 3D view.
2. **Under the ground** until real sources exist: A: keep it an honest empty soil block. B: draw assumed basements
   (one storey under every building), marked as assumed.
3. **Name:** A: VRG Kocka. B: another name.
