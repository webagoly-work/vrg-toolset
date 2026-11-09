# VRG Map — detailed maps, a 3D city and field layers (research)

*2026-11-05. Research only, nothing built. Scope from the Founder: search an address in the
workspace/dashboard and see the place in high detail (Budapest + Pest county first, Hungary second);
build our own map from raw data instead of Google's; a separate 3D viewer of buildings and terrain;
later GodsEyeView feeds and our own electrician / smart-home / field-work layers.*

Items marked **[verify]** were not confirmed by a source during this research.

---

## 1. Recommendation in one paragraph

Build one keyless, self-hosted stack: **OpenStreetMap data → our own vector tiles in a single
PMTiles file → MapLibre GL JS with a VRG style**. That gives the address search and the detailed
street map (building outlines, crossings, footways, trees, power lines…) for the whole of Hungary at
once — Budapest/Pest is not more work than the country, so the "secondary goal" comes almost free.
The same map does 2.5D buildings + terrain; a **separate 3D viewer** (CesiumJS — already vendored
through God's Eye View — or three.js) does the "beautiful rendition" view. Every data layer,
ours or public, goes through a **data manifest** (source, date, licence, refresh command) the same
way `vendor-manifest.json` governs code.

---

## 2. Why our own map is realistic

The "more detailed than Google" maps on Reddit are almost all **OpenStreetMap** rendered with a
custom style. OSM in Budapest is very rich: every building outline, house numbers, footways and
crossings (`highway=crossing`, `crossing=zebra/traffic_signals`), kerbs, trees, benches, street
lamps, bus stops, parking lots, **power lines, substations and transformers** (`power=*`). Google
simply chooses to draw less.

The pretty Reddit pieces come from a handful of tools:

| Look | Tool | Interactive? |
|---|---|---|
| Poster-style city maps | `prettymaps` (Python), QGIS | No (images) |
| 3D night/clay renders | Blender + **Blosm** / BlenderGIS add-ons, Aerialod | No (renders) |
| Shaded relief with buildings | `rayshader` (R), QGIS hillshade | No |
| Live detailed vector map | **MapLibre + custom style** (edited in Maputnik) | **Yes** — this is ours |
| Live 3D city | CesiumJS, deck.gl, three.js | Yes |

So: MapLibre for the working map, and Blender/Blosm later only if we want poster renders of a job
site for a client presentation.

---

## 3. Base map: data, tiles, search

### 3.1 Data
- **OSM Hungary extract** from Geofabrik (`hungary-latest.osm.pbf`, a few hundred MB, daily).
  Licence ODbL: attribution "© OpenStreetMap contributors" required; internal use is free; if we
  ever *publish* a derived database it must stay open.
- **Overture Maps** (Linux Foundation; OSM + Microsoft/Google ML footprints merged, GeoParquet and
  PMTiles per release). Useful as a cross-check for missing buildings. Note: its PMTiles for the
  2026-02 release were reported missing ([issue #500](https://github.com/OvertureMaps/data/issues/500)) —
  check the release before relying on it. Height coverage for Hungary unknown **[verify]**.

### 3.2 Tiles — two steps
1. **Start (days):** MapLibre on a free keyless hosted tileset (OpenFreeMap or Protomaps' demo
   builds) to prove the UI and the search.
2. **Own (week):** generate our own tiles from the Geofabrik extract with **Planetiler** (Java,
   minutes for Hungary) or **tilemaker** (one Windows exe). Output = one `hungary.pmtiles` file,
   roughly 0.5–1.5 GB to z15 **[verify size on first build]**. A PMTiles file needs no tile server:
   the browser reads byte ranges from any static server — our local Node servers, the OTG USB kit,
   or Cloudflare R2 (the Cloudflare ring in GO CITY) for the phone. Works **offline** on site.
   We choose the schema, so electrician-relevant tags (`power=*`, `man_made=street_cabinet`,
   `highway=street_lamp`, `emergency=fire_hydrant`, `building:levels`, `roof:shape`) are kept
   instead of being thrown away like in generic tiles.

### 3.3 Style
A VRG style written once (Maputnik), two variants: **day/field** (high contrast, readable in sun)
and **Mélyvíz** (the launcher's look). Detail by zoom: z16–18 show every outline, entrance, crossing,
tree, lamp, cabinet and power line; z≤12 is a clean Hungary overview.

### 3.4 Address search (geocoding)
- **Start:** public **Nominatim** (OSM's geocoder): free, but max 1 request/second, a real
  User-Agent, no bulk geocoding, no autocomplete-as-you-type.
- **Own:** **Photon** (autocomplete, built on Nominatim data) self-hosted on the Hungary extract,
  or a light own index (street + house number table extracted at tile-build time → a few MB JSON,
  searchable fully in the browser, offline). Hungarian address forms (`Fő u. 12.`, `1052 Bp.`,
  `hrsz`) need a small normaliser either way.
- Helyrajzi szám (parcel number) search needs cadastral data — see §6.

---

## 4. 3D: buildings and terrain

### 4.1 Building heights — sources, best first

| Source | Coverage | Quality | Cost / licence |
|---|---|---|---|
| **Budapest Open Data Atlas — "Épületmagasság"** | Budapest, >350k footprints, height in field `DN` (GeoJSON) — [described here](https://towardsdatascience.com/visualizing-3d-spatial-data-with-pydeck-b7f58a936c67/) | Measured-looking heights, per footprint | Free; licence and current URL **[verify]** on opendata.budapest.hu |
| OSM `height` / `building:levels` | Patchy; good in the centre | Levels × ~3.2 m estimate | ODbL |
| Overture / Microsoft ML footprints | Fills OSM gaps | Heights sparse | ODbL / CDLA |
| **Lechner DSM − DTM** (LiDAR / stereo surface + terrain model) | National | Best: true height of every roof | Paid via geoshop.hu; free only for education/research up to 50 km², or when >10 years old ([Lechner](https://hirlevel.egov.hu/2019/09/15/dijmentesen-elerheto-foldmeresi-es-terkepeszeti-adatok-a-lechner-tudaskozpontnal/)) |

Plan: Budapest atlas heights → OSM levels → default 2 levels for Pest county; buy a Lechner
surface model per job area only when a job needs real roof geometry (PV, lightning protection).

### 4.2 Terrain
- **Copernicus GLO-30 DEM** (30 m, free, global) or the AWS/Mapzen terrain tiles (terrarium
  encoding, free) — enough for hills of Buda, Pilis, Gödöllő hills.
- **Lechner DDM** (5 m or LiDAR DTM) for detail — paid, as above. Fresh orthophotos 2017–2025 are
  listed on [data.lechnerkozpont.hu](https://data.lechnerkozpont.hu/adatkor/ortofoto-adatbazis-2017-2025);
  the free INSPIRE view is 12.5 m pixels only
  ([data sheet](https://inspire.lechnerkozpont.hu/inspire/ortofoto/2023/HU.OI.2023NFO.pdf)).

### 4.3 Viewers
- **In the map (2.5D):** MapLibre `fill-extrusion` + terrain + hillshade. Cheap, same page.
- **Own 3D viewer:** **CesiumJS** (we already have it via `Vendor/gods-eye-view`, Apache-2.0) with
  buildings converted to 3D Tiles, or **three.js** for a stylised "clay/night" look like the Reddit
  renders and like Kódváros. Recommendation: three.js for the look and to share code with Kódváros;
  Cesium only if we need globe-scale or GEV-style feeds in the same view.
- **Google Photorealistic 3D Tiles** cover Budapest and look stunning, but need an API key and the
  terms forbid caching, offline use and extracting geometry — usable only as an optional
  "reference look" layer, never as our data.

---

## 5. God's Eye View (later step)

Local install `H:\Personal\GodsEyeView`, vendored code in `Vendor/gods-eye-view` (MIT), and the
idea list `docs/city/IDEAS-GEV.md` already exists. Rule from that doc stands: **code and ideas yes,
its data no** (its data/models are non-commercial licences). Feeds worth pulling into the VRG map:
weather (Open-Meteo, keyless), lightning (Blitzortung — non-commercial terms, check), public
transport (BKK FUTÁR GTFS-realtime, free key) for crew travel time, the share-link/camera/HUD
patterns. Each one gets its own manifest entry with its licence.

---

## 6. Our own layers — electrician, smart home, field work

Ranked by value for VRG and how reachable the data is.

| Layer | Why it matters | Source | Access |
|---|---|---|---|
| **Geology / soil → earth-rod prior** | Soil type predicts earth resistivity (clay ~20–100 Ωm, sand/gravel 200–3000 Ωm, rock higher) → rod length / mesh choice before going on site | MBFSZ geological map 1:100 000 (WMS/WFS on map.mbfsz.gov.hu — [MBFSZ](https://eles.mbfsz.gov.hu/en/node/35), [metadata](https://metadata.europe-geology.eu/record/full/4c15d72f-d6e4-48df-ab83-06c40a01080d?dlang=hun)); soil maps (HUN-REN TAKI, DOSoReMI) **[verify]** | Free view; layer names from GetCapabilities |
| Earth-resistivity estimate | Derived: geology + soil class → a resistivity band, plus *our own measured values* (Wenner) pinned to job sites — over time our measurements become the best layer in the country | Ours | — |
| **Utilities (közmű)** | Where cables/pipes run before digging | **e-közmű** (Lechner, Korm. rend. 324/2013) — fee-based, for közműegyeztetés ([decree](https://njt.jog.gov.hu/jogszabaly/2013-324-20-22)); OSM `power=*` for overhead lines/substations | Paid / per request; OSM free |
| Distribution operator by address | Who to file the igénybejelentés with (Budapest + most of Pest county: ELMŰ **[verify borders]**) | DSO service-area maps | Free, digitise once |
| **PV potential** | Solar quotes: yearly kWh per kWp for the exact roof, tilt, azimuth | **PVGIS** (EU JRC) API — free, keyless | Free |
| Lightning density (Ng) | MSZ EN 62305 risk assessment | Standard's national map; Blitzortung history | Free/check terms |
| **Parking zones, codes, fees** | Crew parking cost and rules per job | No official open GeoJSON found; the OSM wiki notes districts only gave screenshots ([OSM](https://wiki.openstreetmap.org/wiki/Hungary/Import%C3%A1l%C3%A1s/parkol%C3%B3jegy-automat%C3%A1k)); zone codes + fees on Nemzeti Mobilfizetési's zone list **[verify]** | Digitise ourselves: polygon + zone code + fee + hours + "checked on" date |
| Cadastral parcels / hrsz | Parcel search, ownership boundary on plans | Lechner INSPIRE cadastral view service (free view) **[verify]**; e-ING/TakarNet (paid) | View free, data paid |
| Mobile / broadband coverage | Smart home: LTE/5G backup, whether a gateway will reach the cloud | NMHH broadband & coverage maps **[verify API]** | Free view |
| Flood / groundwater | Basement installs, earthing, equipment height | Vízügy (OVF) flood maps **[verify]** | Free view |
| Protected buildings (műemlék) | Permits, surface-mount rules | Forster Központ / e-építés **[verify]** | Free view |
| **Our jobs** | Every job from `jobs\` / Planner projects geocoded, status, crew, devices installed, BRIDGE devices, service history | Ours | — |
| Suppliers | Wholesalers (villamossági nagyker), DSO offices, ELMŰ customer service | OSM + our list | — |
| EV chargers | Charger install context | Open Charge Map API | Free key |

Honesty rule for the geology layer: it is a **prior**, never a design value. The earthing design
still rests on a measured resistance; the layer should say so on screen.

---

## 7. Architecture

```
raw sources  ──►  tools/map/*.js build scripts  ──►  Map/data/  (gitignored, rebuildable)
 OSM pbf, DEM,        (Planetiler/tilemaker,          hungary.pmtiles, terrain.pmtiles,
 Budapest heights,     height join, address index)    buildings-3d, address-index.json
 WMS endpoints                                         layers/*.geojson (ours)
                       data-manifest.json  ← source, date, licence, refresh cmd per layer

Map/index.html  — MapLibre, search box, layer panel          (START key + Kapu tile)
Map/3d.html     — three.js / Cesium viewer of a picked area
Kapu / Dashboard / Planner: embed via  Map/index.html#lat,lon,z,layers  share-links (GEV idea)
VRG Mobile: same page in the WebView, PMTiles from R2 or the phone's storage
```

Fits the house rules: a self-contained HTML tool, registered in `launcher/vrg-menu.json`,
served locally (localStorage needs a served origin), big data gitignored like `Vendor/` and
rebuildable by one command, provenance in a manifest.

## 8. Proposed phases

| # | Deliverable | Effort |
|---|---|---|
| T1 | MapLibre page + Nominatim search + hosted keyless tiles; START key; Kapu tile | small |
| T2 | Own Hungary PMTiles (Planetiler) + VRG day/Mélyvíz styles + offline address index | medium |
| T3 | 2.5D buildings (Budapest atlas heights + OSM) + terrain/hillshade in the map | medium |
| T4 | Separate 3D viewer for a picked area (three.js clay/night look) | medium |
| T5 | Field layers wave 1: geology WMS, PVGIS lookup, DSO area, our jobs geocoded | medium |
| T6 | Parking zones layer (digitised), utilities via e-közmű per job, cadastral view | ongoing |
| T7 | GEV feeds (weather, lightning, transit), share-links into Planner/Kapu/Mobile | later |

## 9. Decisions needed from the Founder

1. **Where does it live first** — the Kapu dashboard, the Planner workspace (a job's address →
   map of the site), or a stand-alone START tool embedded in both? (Recommended: stand-alone tool,
   embedded by link.)
2. **Offline on site** — required? (Decides whether T2 comes right after T1.)
3. **Budget for Lechner data** (surface/terrain models, orthophotos) per job area, or free sources
   only for now?
4. **Google 3D tiles** as an optional view-only layer with an API key — yes or never?
5. **Style** — field/day look first, or the Mélyvíz look first?

**Decided 2026-11-06 (Founder):** 1 a START tool · 2 offline, yes · 3 free sources only ·
4 Google as an *option*: an embedded view shown on command, already zoomed and angled to match our
own map · 5 our own style first, the field/day look ("VRG Terep").

**Built 2026-11-06 (T1 and T2 merged, because offline is required):** `Map/` — START **M**, server
**H** on :8802. Instead of Planetiler (needs Java) the basemap is a Hungary extract of the free
Protomaps daily planet build (schema v4, z0–15, ~1 GB) and the terrain a Hungary extract of the
Mapterhorn planet (z0–12, ~0.35 GB), both cut with the pmtiles CLI by `Map/tools/fetch-data.js`.
The offline address index is built from the Geofabrik extract by a dependency-free .pbf reader
(`Map/tools/build-addresses.js`). The Google view opens on **G** beside the map, aimed at the same
centre, heading, tilt and distance: keyless satellite embed, or with a Map Tiles API key the
photorealistic 3D city in CesiumJS (free quota 1 000 openings a month). Our own Planetiler schema
(power lines, street cabinets, lamps kept) stays open for when the Protomaps schema runs short.
See `Map/README.md`.

## Sources

- [Budapest building heights in the Open Data Atlas (tutorial)](https://towardsdatascience.com/visualizing-3d-spatial-data-with-pydeck-b7f58a936c67/)
- [Lechner — free surveying and mapping data](https://hirlevel.egov.hu/2019/09/15/dijmentesen-elerheto-foldmeresi-es-terkepeszeti-adatok-a-lechner-tudaskozpontnal/)
- [Lechner — orthophoto database 2017–2025](https://data.lechnerkozpont.hu/adatkor/ortofoto-adatbazis-2017-2025)
- [Lechner — fresh orthophotos and terrain models for a third of Hungary](https://lechnerkozpont.hu/cikk/friss-ortofotok-es-domborzatmodellek-keszultek-magyarorszag-egyharmadarol)
- [Lechner — INSPIRE orthophoto 2023 data sheet](https://inspire.lechnerkozpont.hu/inspire/ortofoto/2023/HU.OI.2023NFO.pdf)
- [OSM wiki — use of Hungarian state orthophotos](https://wiki.openstreetmap.org/wiki/Hungary/Magyar_%C3%A1llami_(F%C3%96MI,_Lechner)_ortofot%C3%B3k_felhaszn%C3%A1l%C3%A1sa)
- [MBFSZ map services](https://eles.mbfsz.gov.hu/en/node/35)
- [Geological map of Hungary 1:100 000 — metadata](https://metadata.europe-geology.eu/record/full/4c15d72f-d6e4-48df-ab83-06c40a01080d?dlang=hun)
- [324/2013 Korm. rendelet — e-közmű](https://njt.jog.gov.hu/jogszabaly/2013-324-20-22)
- [OSM wiki — Budapest parking ticket machines import](https://wiki.openstreetmap.org/wiki/Hungary/Import%C3%A1l%C3%A1s/parkol%C3%B3jegy-automat%C3%A1k)
- [Budapest paid parking zone changes (news)](https://www.economx.hu/magyar-gazdasag/fovarosi-kozgyules-parkolas-fizeto-zonak.781186.html)
- [Overture + PMTiles docs](https://docs.overturemaps.org/examples/overture-tiles)
- [Overture PMTiles 2026-02 missing — issue #500](https://github.com/OvertureMaps/data/issues/500)
- `docs/city/IDEAS-GEV.md` (God's Eye View ideas, licences)

---

# Addendum 2 — 2026-11-06: two modes, weather & sun, overlays, the Budapest time machine

## A1. Decision: work mode first, private mode later (if at all)

The Founder decided on 2026-11-06 that the **default (work) version uses only free, open or
use-free sources** and is built first. A separate **private mode** for non-commercial or research
layers comes later, if at all, gated as follows:

- Every layer carries a licence class in `data-manifest.json`: `open` · `private-nc` · `licensed`.
- Work mode (Planner, Kapu, Mobile, OTG) loads `open` only. The layer loader enforces this; hiding
  a menu entry is not enough.
- Private mode has its own START key and a visible "PRIVÁT · NEM MUNKÁRA" frame. Its data is
  stored under `H:\Personal\...`, never in the repo, `jobs\`, `Shared\` or the work backup. It
  allows no export, share link or copy into job files, keeps a small log of which layers were
  opened, and needs a written permit for each `licensed` source.
- Rule of purpose: anything consulted to decide or price a job is commercial use.

### Private-use notes (parked, NOT in the default build)

| Source | Why private only | What it would add |
|---|---|---|
| Lechner DDM/DSM, fresh orthophotos (research exemption ≤50 km²) | Exemption is for education/research; needs a request + written terms | True roof heights, 5 m terrain |
| Blitzortung lightning | Non-commercial terms | Live strikes, history |
| God's Eye View data/models | CC BY-NC / per-model | Its feeds and 3D models |
| Google Photorealistic 3D Tiles | Key + no caching/extraction | Photoreal reference look |
| ShadeMap (shadow service) | Commercial service | Ready-made shadows; we compute our own instead (A3) |
| Arcanum MAPIRE historical maps | Subscription | Georeferenced 18th–20th c. maps for the time machine |
| Hungaricana / BFL map scans | Reuse terms not confirmed **[verify]** | Historical city plans (e.g. [1832 Buda–Pest plan](https://maps.hungaricana.hu/en/BFLTerkeptar/123)) |
| Open-Meteo free API | Free tier is non-commercial | Forecast/history by point (self-hosting it is `open`) |

## A2. Parking zones (Budapest), the NMZRT map

[nmzrt.hu parking zones](https://nmzrt.hu/szolgaltatasok/parkolas/parkolasi-zonak.html) shows the
zones street by street, but the page offers **no download and no API**. It marks the map
"tájékoztató jellegű" (for information only) and "Minden jog fenntartva" (all rights reserved), so
we must not scrape or copy it. The legal routes, best first:

1. **Build it from the law itself.** Municipal decrees set the zones, their streets, fees and hours:
   the Fővárosi Közgyűlés parking decree and the district decrees, with street-list annexes.
   Legislation is excluded from copyright (Szjt. 1. § (4)). Parse the street lists and match them
   to OSM street geometry. The result is our own `parking-zones.geojson` with zone code, fee,
   hours, decree number and a "checked on" date, in the `open` class. **[verify current decree numbers]**
2. **Ask for the data.** Send NMZRT a közérdekű adatigénylés (a public-information request) for
   the zone polygons and codes. The page links to its Közérdekű adatok section and to
   [kozadat.hu](https://kozadat.hu/kereso/). If they grant it with reuse terms, it goes in the
   `open` class.
3. **Link out.** Until then, a "Parkolás itt" button opens the NMZRT map at that place.

## A3. Weather, sun, shadows, climate, wind, lightning

| Need | Source | Licence / access | Class |
|---|---|---|---|
| **Current + past observations, station series from 1870, gridded climate** | **HungaroMet open data server** ([terms](https://odp.met.hu/ODP_altalanos_felhasznalasi_feltetelek.pdf)) | Free reuse, credit "HungaroMet Nonprofit Zrt" | `open` |
| Radar, satellite, lightning (recent 24–48 h) | HungaroMet ODP remote sensing, listed in a [2024 talk](https://nimbus.elte.hu/oktatas/nyarigyak/HungaroMet_NyiltNap_20240416/02_HungaroMet_nyiltnap_20240416_Hodossyne_Retfalvi_Rita_informatika.pdf) | Same terms **[verify with odp@met.hu]** | `open` if confirmed |
| Forecast + hourly history at any point | Open-Meteo, self-hosted (open-source server on ERA5/ICON data) | Open source; the hosted free API is non-commercial | `open` self-hosted |
| Reanalysis 1940→today (hourly temp, wind, radiation) | Copernicus ERA5 (CDS) | Copernicus licence: free incl. commercial, with attribution | `open` |
| **Monthly/yearly climate statistics** | HungaroMet station series + ERA5 | as above | `open` |
| Wind speed/direction climatology, wind roses | Global Wind Atlas (CC BY 4.0), ERA5 | free | `open` |
| Solar radiation, typical year | PVGIS (EU JRC) | free | `open` |
| **Sun path over a location** | Computed, no data needed: SunCalc (BSD-2) or the NOAA algorithm gives azimuth/elevation per minute, sunrise/sunset, the day's arc and the yearly analemma | own code | `open` |
| **Shadow casting by date and hour** | Computed: sun vector + building heights + DEM in a three.js / MapLibre shadow pass; date and hour sliders; a "sun hours per day" heatmap | own code on open data | `open` |
| Lightning density (Ng) for MSZ EN 62305 | HungaroMet if published; else the standard's own map | **[verify]** | `open` |

The shadow and sun-hours layers are directly useful for PV roof shading and site planning, and
they need nothing licensed.

## A4. Extended view: catalogue of open overlays

Grouped as for the layer panel. All are believed to be `open`; each gets checked when it enters the
manifest.

- **Base and terrain:** OSM detail, hillshade + contours (Copernicus DEM), slope/aspect, 3D
  buildings, sun/shadow (A3).
- **Imagery:** Sentinel-2 true colour / NDVI (Copernicus, free, 10 m, every ~5 days), Lechner
  INSPIRE orthophoto view (12.5 m), Lechner orthophotos older than 10 years (free archive).
- **Environment:** air quality (national OLM network **[verify feed]**; EEA European AQ index),
  strategic noise maps (EU directive, Budapest), urban heat (Landsat / Sentinel-3 surface
  temperature), tree cover and green space (OSM + Copernicus Urban Atlas), CORINE land cover.
- **Water:** OVF flood-risk maps, Danube and river levels (vízügy hydroinfo **[verify terms]**),
  groundwater wells.
- **Ground:** MBFSZ geology 1:100 000, soil maps, radon potential (EU Radon Atlas), earthquakes
  (EMSC), Budapest caves and cavities (MBFSZ **[verify]**).
- **Energy and utilities:** OSM power grid (lines, substations, transformers), EV chargers (Open
  Charge Map, CC BY-SA), PV potential (PVGIS), DSO service areas (digitised).
- **Mobility:** BKK GTFS stops and lines (free key), cycle network, parking zones (A2), height and
  weight limits (OSM).
- **Administration:** districts, settlements, postcodes (OSM), protected buildings and zones,
  zoning-plan areas (PDF plans, digitised **[verify]**).
- **Population and built form:** GHSL population and built-up grids (CC BY 4.0), KSH census
  tables per settlement and district.
- **Connectivity:** NMHH broadband/mobile coverage (view), OpenCelliD tower positions (CC BY-SA).
- **Our own:** jobs, measured earth resistances, installed devices, suppliers, crew routes.

## A5. Budapest time machine: the city built up backwards

A player like the Kódváros replay: Step / Play / Latest, tweening between epochs, a split-flap
year board. It runs from today back to the 1700s, fading out or colouring whatever did not exist
yet.

### Data, coarse to fine (all `open` unless marked)

| Period | Source | Resolution |
|---|---|---|
| 1975 → 2030, 5-year epochs | **GHSL built-up surface** (EU JRC, [CC BY 4.0](https://registry.opendata.aws/ghs-built-s/)): built-up share per cell | 100 m (10 m for 2018 only) |
| ~1950s → today | Lechner orthophotos older than 10 years (free archive); we trace new built-up areas per decade | building level, our tracing |
| Per building | OSM `start_date`, Budapest100 house data, heritage registers | exact but sparse |
| 1700s → 1940s | Historical city plans (1782, 1832, 1873, 1908, 1937 …); we trace the built-up blocks of each into our own vector epochs | block level |

**Historical map scans:** the old maps are long out of copyright, and since the 2019 EU DSM
directive (Art. 14) a faithful reproduction of a public-domain work gets no new copyright. Portals
can still attach database or contractual terms, though: **[verify for Hungaricana/BFL]**; MAPIRE is
a subscription, so private only. The safe path is to use only scans with clear reuse terms, or to
trace by hand. The traced vector epochs are then our own data, with the source cited.

### How it plays

- Each building or block gets `built_from` (and optionally `demolished`): the exact year where
  known, otherwise the first epoch it appears in, with a confidence value shown as opacity.
- The timeline has a year scrubber (1700–2030), Play backwards and forwards, and Latest. Between
  epochs, heights grow or fade (Kódváros tweening), and a faint ghost of the 2026 city stays
  visible for orientation.
- Lenses: colour by era (Reform Era, the 1873 unification and Dualism, interwar, 1950–89 housing
  estates, after 1990), and by building material where known (brick, prefabricated panel,
  reinforced concrete). This is where the private historical-buildings study would connect.
- The detail is marked honestly: exact buildings in the centre where data exists, blocks
  elsewhere, and at least the 100 m grid for the last 50 years.

## A6. Order of work (updated)

T1–T5 as in §8, work mode only. Then **T5b** sun path, shadows and HungaroMet weather/climate
layers; **T5c** parking zones from the decrees; **T8** the time machine (GHSL epochs first, then
traced historical epochs, then per-building years). Private mode and its layers come last, if ever.

### Sources (addendum)

- [NMZRT parking zones](https://nmzrt.hu/szolgaltatasok/parkolas/parkolasi-zonak.html)
- [HungaroMet ODP general terms](https://odp.met.hu/ODP_altalanos_felhasznalasi_feltetelek.pdf)
- [HungaroMet daily station series from 1870](https://odp.met.hu/climate/station_data_series/daily/Leiras_eghajlati_napi_allomasi_adatsorok_1870tol.pdf)
- [HungaroMet open-day talk, open data offer (2024)](https://nimbus.elte.hu/oktatas/nyarigyak/HungaroMet_NyiltNap_20240416/02_HungaroMet_nyiltnap_20240416_Hodossyne_Retfalvi_Rita_informatika.pdf)
- [GHSL built-up surface (AWS registry)](https://registry.opendata.aws/ghs-built-s/)
- [GHSL in the Earth Engine catalogue](https://developers.google.com/earth-engine/datasets/catalog/JRC_GHSL_P2023A_GHS_BUILT_S)
- [Hungaricana BFL map catalogue entry](https://maps.hungaricana.hu/en/BFLTerkeptar/123)
- [Budapest időgép launch (2017)](https://welovebudapest.com/cikk/2017/12/4/budapesti-idogep-epul-soha-ilyen-konnyen-nem-volt-kutathato-ennyi-izgalmas-anyag)
- [Fifty maps of 150-year-old Budapest (2023)](https://444.hu/2023/08/16/a-130-as-utszakasztol-a-padokon-at-150-ev-varosfejlodeseig-otven-kulonleges-terkep-keszult-budapestrol)

---

# Addendum 3 — 2026-11-06: God's Eye View feed study (clean-room)

*Read from the local install `H:\Personal\GodsEyeView\GodsEyeView\app` (its `DATA_SOURCES.md`
and `server/providers/`). Ground rule from the Founder: **no verbatim copies**. We study what each
feed is, where it comes from and how GEV handles it; our code is written fresh from this
description, in our own structure. Nothing below is GEV code.*

## B1. How GEV gets its data — the pattern worth learning

1. **Every feed goes through a small server-side provider** (one module per source under
   `server/providers/`), never straight from the browser. That hides keys, gets round CORS, and
   lets one cache serve every open tab.
2. **Single-flight + TTL cache per feed**: if a refresh is already running, later requests wait on
   it instead of hitting the upstream again; the result is kept for the feed's natural cadence
   (wind: 1 h; camera catalogues: 15 min).
3. **Honest failure**: when an upstream fails, the provider answers with the last good snapshot
   marked `stale`, or an explicit `unavailable` with a reason — the UI shows it instead of
   silently showing old data.
4. **Hard limits**: a timeout per fetch, a rate limiter per route, bounded request parameters
   (e.g. only two wind models × three overlays can ever be cached).
5. **Byte-range reads of big model files** (the clever bit): NOAA GFS and ECMWF publish each
   forecast as a large GRIB2 file plus a small `.idx` text inventory listing where each variable
   sits. GEV reads the inventory, then downloads only the byte ranges of the variables it needs
   (10 m wind U/V, 2 m temperature, pressure) — a few MB instead of hundreds — decodes them and
   resamples to a coarse grid for the particle animation.
6. **Attribution registry**: each layer registers its credit line in one place; the credit panel
   is built from it and stays visible in every mode.
7. **Licence carve-outs documented per dataset** (`DATA_SOURCES.md`): exactly the discipline we
   adopted as licence classes (A1).

## B2. Feed-by-feed verdict for VRG (Hungary)

Licence column = the source's own terms as GEV records them; **class** = our A1 class.

| GEV feed | Source & access | Licence | Useful for us? | Class |
|---|---|---|---|---|
| Wind particles (+2 m temp, pressure) | NOAA GFS (S3, keyless) / ECMWF open data, byte-range GRIB2 | Public domain / CC BY 4.0 | **Yes** — animated wind over Hungary, wind at a job site for roof/crane work; global models are coarse (0.25°), so pair with HungaroMet stations | `open` |
| Rain radar, satellite clouds | NOAA nowCOAST (US only) | PD | Concept yes, source no → **HungaroMet radar** (A3) or EUMETSAT | `open` (ours) |
| Lightning density | NOAA nowCOAST (Americas only) | PD | Concept yes → HungaroMet (verify) | `open` if confirmed |
| Earthquakes | USGS feed (global, keyless) | PD | Small but free; add EMSC for Europe | `open` |
| Recent satellite imagery | NASA GIBS tiles (Sentinel-2/Landsat HLS, VIIRS) + NASA CMR catalogue | Open, NASA terms | **Yes** — near-current imagery of a site, by date | `open` |
| Satellites | CelesTrak TLEs + SGP4 | PD, citation | Fun only; skip for work | `open` |
| Flights | OpenSky (non-commercial) / adsb.lol (ODbL) | NC / ODbL | Low value; adsb.lol is the legal one | `open` (adsb.lol) / `private-nc` (OpenSky) |
| Vessels | AISStream.io (beta, no ToS) | unclear | Danube shipping — curiosity only | `private-nc` |
| Public transit live | per-city GTFS-realtime | city open licences | **Yes** with **BKK FUTÁR** (GTFS + GTFS-rt, free key) — crew travel time, where the tram is | `open` |
| Traffic cameras | per-city open camera catalogues (none Hungarian) | various | Útinform / Magyar Közút cameras **[verify terms]** — road conditions on the way to site | `open` if terms allow |
| Traffic flow | TomTom (paid key) | proprietary | No | — |
| Routing | OSRM on FOSSGIS servers | usage policy (light use) | **Yes** for "time to site"; self-host OSRM/Valhalla on the Hungary extract for real use | `open` |
| Place search | Photon (komoot) public instance | fair use | Yes as fallback; self-host later (§3.4) | `open` |
| Terrain | Re:Earth / **Mapterhorn** terrain tiles, keyless | CC BY 4.0 | **Yes** — a keyless terrain source we did not have in §4.2 | `open` |
| Basemap | OpenFreeMap / OpenMapTiles vector tiles | ODbL | Yes — our T1 starter tiles | `open` |
| Esri World Imagery | ArcGIS tiles | Esri master agreement | No (terms) | — |
| Google 3D Tiles | key | proprietary | Private only (A1) | `private-nc` |
| Current weather | Open-Meteo API | CC BY 4.0 data, free API non-commercial | Self-host or HungaroMet (A3) | `open` self-hosted |
| News | Google News RSS / GDELT | ToS / GDELT terms | Local news by place — low value | — |
| Bikeshare (GBFS) | MOL Bubi has a GBFS feed **[verify]** | attribution | Low | `open` |
| Fire perimeters / FIRMS | NASA FIRMS (global, free key) | open | Low (field fires near Pest county sites) | `open` |
| Datacenters, dams, military names | OSM extracts | ODbL | Datacenters/substations from OSM `power=*` instead — ours from our own tiles | `open` |
| Submarine cables | TeleGeography | **CC BY-NC-SA** | No | — |
| Admin outlines | Natural Earth | PD | Yes, Hungary-level overview | `open` |
| Radio stations | Radio Browser | PDDL | No | — |

## B3. What we build, better than GEV for our use

1. **`feeds/` service in our own Node server** (the T1 map server): one provider per feed with
   single-flight, TTL, timeout, rate limit, stale/unavailable answers — plus things GEV lacks:
   a **disk cache** so the last snapshot survives a restart and works **offline on site**, and a
   **freshness badge** on every layer ("radar 6 perc", "szél: 06z futás").
2. **Wind over Hungary**: byte-range GRIB2 reading done our own way, clipped to a Central-Europe
   box (far smaller than global), ECMWF + GFS side by side, and **blended with HungaroMet station
   observations** so the arrows near a site show measured wind, not just the model. Wind rose per
   site from ERA5 history (A3).
3. **Weather stack in one timeline**: radar (HungaroMet), lightning, wind, temperature on one
   scrubber with past (observations) and future (forecast) — the same player control as the time
   machine (A5), so one UI component serves both.
4. **Site card instead of a cockpit**: click a job → current weather + next 48 h, sun path and
   shadows today (A3), nearest BKK stops and travel time by car/transit (self-hosted router),
   recent satellite image date, parking zone (A2), road cameras on the way.
5. **Attribution and licence registry merged**: one manifest drives the loader gate (A1), the
   credit panel and the "honest feed" status — GEV keeps these in two places.
6. **Analyst/query and share-link ideas** from IDEAS-GEV.md stay valid; implemented fresh.

## B4. Clean-room procedure

- One person/session reads GEV and writes behaviour notes (this addendum and per-feed notes in
  `docs/research/research_notes/`), never code excerpts.
- Our implementation is written from the notes and the upstream providers' own public
  documentation (NOAA `.idx` format, ECMWF open-data docs, GTFS-rt spec), not from GEV files.
- Where a small algorithm is standard (SGP4, GRIB2 decoding, SunCalc-style sun position), we use
  the published spec or a properly licensed library listed in `vendor-manifest.json` with its
  notice — not GEV's version.
- GEV's MIT licence would allow copying with its notice; we choose not to, by the Founder's rule.

## B5. Order

After T1 (map + our server exists): **F1** feeds service skeleton (cache, stale, badges,
registry) → **F2** HungaroMet observations + radar → **F3** wind (byte-range GRIB2) →
**F4** BKK transit + routing to site → **F5** NASA GIBS recent imagery + Mapterhorn terrain →
**F6** site card. Earthquakes, flights, satellites only if they come cheap.

## B6. Instead of satellites and radio stations: a connectivity layer

Same rendering ideas (points, footprints, live-ish feed), aimed at what a smart-home installer
needs: will a gateway, camera or LTE backup work at this address, and where does Wi-Fi drop
inside the house.

| Layer | Source | Licence | Class |
|---|---|---|---|
| Cell tower positions (per operator, 2G/4G/5G cell IDs) | OpenCelliD (free key, crowd-sourced) | CC BY-SA 4.0 | `open` |
| **Our own measured signal** (RSRP/RSRQ per operator, Wi-Fi RSSI, speed) | VRG Mobile logs it on site (Android telephony + Wi-Fi scan), pinned to the job | ours | `open` |
| Indoor Wi-Fi heat map per job | `H:\VRG\Full\wifi-heatmapper` (already on disk) → attach its survey to the job location | ours | `open` |
| **Predicted signal / line of sight** | Computed: tower positions + our 3D buildings + terrain → a simple path-loss / LOS shading (Fresnel check); also usable for outdoor Wi-Fi links, LoRa, Zigbee/Thread reach between buildings | own code | `open` |
| Operator coverage maps (Telekom, Yettel, One) | Operators' own sites | proprietary | link out only |
| NMHH coverage / broadband data | NMHH (no open download found) | **[verify]**; request as public data | `open` if granted |
| Speed-test tiles (mobile + fixed, quarterly) | Ookla Open Data ([AWS registry](https://registry.opendata.aws/speedtest-global-performance)) | **CC BY-NC-SA 4.0** | `private-nc` |
| Wi-Fi networks map | WiGLE | non-commercial | `private-nc` |
| LoRaWAN / Meshtastic coverage | TTN Mapper, Meshtastic maps **[verify terms]** | various | check |

The strongest layer is the one we build ourselves: every site visit adds measured signal values,
so over time we get a better coverage map of Budapest/Pest than any free source — and it is ours
to use for work.
