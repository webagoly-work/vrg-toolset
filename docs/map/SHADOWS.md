# VRG Térkép — Árnyék (S): the buildings' shadows at any date and time

*Built 2026-11-21 as "option 1" of the shadow study (the Founder: "go ahead with option 1"). The question
was a ShadeMap-like view; ShadeMap's MapLibre plugin (`mapbox-gl-shadow-simulator`) is proprietary
(npm: UNLICENSED, needs their key), so the VRG Térkép computes its own, from data it already has.*

## What it does

- **S** (or the **Árnyék** button) opens a panel: the day (date picker, **Most**), a time slider from
  sunrise to sunset in 5-minute steps, **▶ Napnyugtáig** (plays the light down to sunset in about eight
  seconds), and a readout: where the sun is (compass word and azimuth), how high, and how long a shadow
  is compared with the height ("árnyék 5.6× a magasság").
- Every building in the loaded basemap tiles casts its shadow on the ground, and the 3D buildings are lit
  from the sun's direction (the light's height is kept at 30° or more, so roofs stay readable at dusk).
- `?arnyek=1` opens it at the current time, `?arnyek=2026-12-21T15:30` at that local time.
- It works wherever the map works: on the PC, in VRG Mobile (both files are kept on the phone, WP M43),
  offline with the phone's tile cache. No network, no new data.

## How

- `Map/lib/sun.js` (also Node): the sun's azimuth and altitude by the NOAA solar calculator, refraction by
  Bennett's formula; sunrise and sunset at −0.833°. Checked against Budapest's published times (21 June
  04:46 / 20:44, 21 December 07:29 / 15:55, within 2 minutes) in `Map/test/sun.test.js`.
- The shadow of a building is the exact union of its footprint moved from its base height to its top along
  the sun's direction: the moved roof plus the parallelogram every edge sweeps (courtyard walls included).
  Length = height ÷ tan(altitude), capped at 800 m near the horizon.
- `Map/lib/shadow-layer.js` takes the buildings from the basemap's `buildings` layer (`height`, `min_height`;
  7 m where OSM has neither, the same default the 3D buildings use) for the loaded tiles around the view,
  and draws all shadows as one `fill-extrusion` layer 25 cm tall under the 3D buildings: a fill-extrusion's
  opacity applies to the whole layer, so overlapping shadows do not darken twice. From zoom 14; above
  25 000 buildings in view it asks to zoom in.
- `Map/test/shadows.test.js` runs the layer with the real MapLibre in headless Chromium on invented
  buildings: the shadow on the side away from the sun, moving with the time, gone at night and when closed.

## Limits (say so when the answer matters)

- **Flat ground.** Hills cast no shadow, and on a slope a shadow has its flat-ground length. Option 2 of
  the study (a height-map trace, also "sun hours per day") would fix both.
- **Heights are OSM's.** Many Hungarian buildings have no height or level count and are drawn as 7 m.
  Better heights: the Budapest Open Data Atlas layer (T3 in the research report), or a Lechner surface
  model for one job's street. Trees are not in it.
- Shadows fall on the ground, not on other buildings' walls and roofs (a roof in a neighbour's shadow is
  not darkened). For a PV roof question, read the ground shadow next to the roof edge, or wait for option 2.
- The clock is the device's (the PC and the phones are in Hungary).
