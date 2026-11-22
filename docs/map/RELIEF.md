# VRG Térkép: relief measuring (R), the hills' shadow (⛰) and measured building heights (B)

*Built 2026-11-22. The Founder asked for a measurable terrain and building layer of Hungary, focused on Budapest,
built from open data. Google's 3D map data was declined, because its terms forbid storing it or deriving anything
from it. The Founder then chose all three parts: measurable relief, Budapest building heights, and terrain-aware
shadows. The same maths also drives the Data Vault's standalone Térkép page (data-vault `pages/terkep/`, cell
`dv.terkep`).*

## R: Domborzat mérése

**R** (or the **Mérés** button) opens a panel with these parts:

- **The read-out under the pointer.** It shows the height above sea level, the slope in degrees, the way the ground
  faces (É, ÉK, …) and the coordinates.
- **Szintvonalak.** Contour lines over the view at an interval that fits it (`relief.interval`: 8–25 lines). Every
  fifth line is bold and labelled. They are traced when the view stops moving.
- **Lejtő.** Slope classes laid on the map as an image: 2–5°, 5–10°, 10–15°, 15–25°, and over 25°.
- **Metszet.**
  - Two clicks draw a line, and a chart of the heights along it.
  - The panel shows the distance, the height difference, the climb, the descent and the steepest stretch.
  - A third click starts a new profile.

It works from zoom 10. `?domborzat=1` opens it.

**The heights.** They come from the map's own terrain tiles (`data/terrain.pmtiles`: Mapterhorn, terrarium-encoded,
z12, about 26 m a pixel here).

- `lib/dem.js` decodes the tiles. It reads heights bilinearly across tile edges and builds an equirectangular grid of
  the view.
- `lib/relief.js` measures on that grid. It is pure, and the same file serves the page, Node and the Data Vault.
- The tiles are a **surface model** (Copernicus GLO-30 and national models): roofs and tree tops are in it.

## ⛰: the hills' shadow (in S)

The **Árnyék** panel has a **⛰ Domborzat** chip, on by default when the terrain tiles are there.

- For each block of 4 × 4 pixels of the view, a ray goes towards the sun over the terrain (`relief.shadowView`). The
  ray starts 0.5 m above the ground. Its step grows with distance, and it stops 6 km out or at the grid's highest
  point.
- The grid reaches 6 km beyond the view in every direction, so a hill outside the view can still shade it.
- The result is one image under the building shadows, from zoom 11. It follows the time slider and the view.
- The buildings' own shadows are still flat-ground ones (`docs/map/SHADOWS.md`).

## B: Épületmagasság (measured, Budapest)

**B** shows buildings with measured heights in 3D: the Budapest Open Data Atlas *Épületmagasság*, or any GeoJSON of
footprints with a height.

- Inside the measured file's area, the basemap's OSM 3D buildings step aside.
- A click on a building says its height and its source.
- While B is on, the **S** shadows come from the measured buildings.
- Without the file, the button stays greyed and its tooltip says how to make the file.

**The data is made on the PC, from a file you download yourself.** This keeps the licence check with you.

1. Download the atlas layer as GeoJSON and save it as `Map\data\src\bp-epuletmagassag.geojson`.
2. Run `node Map\tools\fetch-data.js --only=heights`, or `node Map\tools\build-bp-heights.js <file> --licence "…"`.

The tool does the rest:

- it finds the height field (`DN`, `height`, `magassag`, …, or `--field`);
- it recognises EOV coordinates (EPSG:23700) and converts them to WGS84 (`heights.eovToWgs`: Swiss oblique Mercator
  on GRS67, then the HD72 → WGS84 shift `52.17, −71.82, −14.9`);
- it drops heights outside 2–400 m;
- it writes `Map/data/bp-heights.bin` and records the source and licence in `data/manifest.json`.

**The file.** It starts with `VRGH`, v1, and a meta JSON. Each footprint follows as a height in decimetres, then its
rings: the first point as i32 micro-degrees, the rest as i16 differences. A longer step is split on writing. The
whole of Budapest should come to roughly 10–15 MB. It is local data, because `Map/data` is gitignored.

**The height rule** (`heights.pick`), in order: measured, then OSM `height`, then OSM levels × 3.2 m, then 7 m.

## Tests

- `Map/test/relief.test.js`, on invented grids:
  - a tilted plane: height, slope and aspect;
  - a cone: the 400 m contour is a closed ring 1 km round its top;
  - the profile over the cone;
  - a ridge's shadow, which starts exactly 200 m ÷ tan(sun) from its foot;
  - packed grids round-trip.
- `Map/test/dem.test.js`, on invented tiles:
  - terrarium decoding;
  - the tile of Gellért-hegy;
  - reading across tile edges;
  - contours on a known hill, which lie at their level.
- `Map/test/heights.test.js`:
  - the file round-trips, including courtyards and long walls;
  - the index, the view and the building under a point (holes too);
  - the height rule;
  - EOV: the origin, Budapest, and 1 km steps that stay 1 km;
  - the converter: field detection, EOV detection, broken heights.
- `Map/test/relief-page.test.js` (Playwright and the real MapLibre, on an invented ridge 300 m high):
  - contours between 100 and 400 m;
  - the read-out: 400 m on the crest, and the west flank steep and facing west;
  - the profile: up 300 m and down 300 m;
  - the slope image;
  - a low south-east sun putting the land west of the ridge in shadow, with almost no shadow at June noon;
  - everything cleared when the layer is turned off.
- `Map/test/heights-page.test.js` (Playwright, with an invented heights file):
  - the greyed button without the file;
  - the measured buildings in 3D, with the OSM ones aside;
  - the shadows from the measured buildings;
  - the click read-out;
  - B off restores the OSM buildings.

## Open

- The atlas itself: its download address, format and licence are checked on the PC. The prompt is
  `docs/handoff/2026-11-22_bp-heights-H.md`.
- Sun hours per day, and shadows from the B buildings onto the terrain.
- A finer terrain for Budapest (Lechner's 1 m DTM or DSM is paid; free only for research, up to 50 km²).
