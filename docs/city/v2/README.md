# Kódváros 2.0 — the city that grew

*2026-11-06. A look-and-layout concept from the Founder's brief of the same day; design only, nothing built.
Plan sketch: [concept-plan.html](concept-plan.html). Decisions to take: §10 (CITY-D54 …). Work packages: §11.*

**The idea in one line.** Today's Kódváros is a planned city: one squarified treemap, a big square of
plates. 2.0 tells the truth about how the repo came to be — a village around one client job and one
workshop, which grew by need, unplanned, into a town and then a port city on its own island. The
layout follows the history; the buildings say what they are.

---

## 1. What we take from urbandesignlab.in

The site is an urban-design learning and resource platform (masterclasses, map-type tutorials, Illustrator
and QGIS courses, cutout libraries, presentation templates), not a tool or a dataset. What transfers is the
**vocabulary of urban-design drawings**, and it fits both of our maps:

| Their idea | In Kódváros 2.0 | In VRG Térkép |
|---|---|---|
| **Figure-ground** map (black built mass, white open space) | A lens: *Beépítés* — the city as a plan drawing; shows at a glance that the growth is organic | Same lens over OSM buildings: density of a job's surroundings |
| **The eight map types** of their Urban Mapping class: land use, figure-ground, street hierarchy, open space, built-age, building heights, activity, accessibility | One lens each where we have the data: *Funkció* (district = land use), *Utcarend* (road hierarchy = how central an area is), *Kor* (built-age = first commit), *Magasság* (commits) | The same lenses on real data: land use and heights from OSM, built-age later (the Budapest time machine, report A5) |
| **Entourage** — tree, people and vehicle cutouts in plan and elevation, sketchy / watercolour / realistic | Trees on unbuilt land, people on squares where an agent works, carts on roads during a replay; one style per look | Trees from OSM as sprites at high zoom |
| **Site-analysis symbols** (arrows, nodes, edges, landmarks, views — Lynch's image of the city) | Landmarks = the program buildings, nodes = squares where roads meet (co-change), edges = the shore and district walls, paths = idea roads | A job-site analysis sheet: sun path, access, noise, landmarks |
| **Presentation boards and poster maps** (diary, puzzle, playing-card city maps; Bauhaus / Van Gogh themes) | *Tabló* export: the city as a printable plan in a chosen style (blueprint, watercolour, Mélyvíz) for the wall or a client | A job's location sheet in the same styles |

So: no code or assets from the site, only the drawing conventions, which are common professional practice.

---

## 2. The story: five ages, from the real git history

The repo's areas really arrived in this order (first commit that touched them):

| Date | Arrived |
|---|---|
| 2026-09-17 | Planner (with the Domoszló job), Calculator, MindMap, Modder, Toolbox |
| 2026-09-20 | Inventory, docs, tools |
| 2026-10-05 | BRIDGE (with the OmniComm Hub) |
| 2026-10-13/14 | Firmware, CoreRef |
| 2026-10-21/22 | Hub (Kapu), CodeCity |
| 2026-10-27/30 | AirDeck, shared (UI kit), Mobile, ServiceKit ×3, launcher (START) |
| 2026-11-01/02 | Console, Solomon, Divergence — and now Map (Térkép) |

The ages are **thresholds on the data, not dates**, so they stay true as the repo grows. Like an age-up in a
strategy game, crossing one gives a short title card and upgrades the landmark buildings.

| Age | Hungarian name | Crossed when | What the city looks like |
|---|---|---|---|
| I | **Falu** (village) | first commit | Domoszló castle on its hill, the Planner workshop below it, a dirt track between them, a few huts (the first small tools) |
| II | **Mezőváros** (market town) | ≥ 5 programs or ≥ 300 files | A market square (Inventory), a paved main street, the first stone houses; docs become a scribe's house |
| III | **Céhes város** (guild town) | a second big area with its own sub-areas (BRIDGE) | Guild quarters, a town wall with the first gate, the hill suburb begins, a forge by the water (Firmware) |
| IV | **Város** (city) | a gateway and a launcher exist (Kapu + START), ≥ 15 programs | The city gate (Kapu), the central station (START), the harbour, the first towers downtown |
| V | **Kikötőváros** (port city) | outward links: a phone app, a cloud build, remote sessions | The airport, the radio mast, ferries to the worktree islands, a full downtown skyline |

Today the repo is in age V.

---

## 3. Organic growth: how the layout is made

**The promise stays:** the layout is still computed **once**, over every file that ever existed, so nothing moves during a
replay. What changes is *how* the places are chosen: by simulated growth instead of a treemap.

1. **Seed.** The castle (Domoszló, the first job the Planner served) on a hill, and the Planner workshop at its foot. One
   track joins them: *the first road was built to build the castle.*
2. **Roads grow from roads.** Areas are added in the order they first appeared. Each new area starts a road from the
   **nearest existing road node toward its strongest neighbour** (the area it most often changes together with), bending
   with low-frequency noise, avoiding water, slope and existing plots. That is how a real village grows: the next lane
   leaves the last one where it is easiest.
3. **Plots along roads.** Files take plots **fronting a road**, in commit order, alternating sides, with irregular depth
   and frontage (from a hash of the path), rotated to the road. When a road is full, a side lane branches off. Nothing is
   aligned to a grid unless the district says so (downtown, §4).
4. **Densification.** Busy areas (many commits) get infill: back-lot buildings, then taller ones. Quiet areas stay low and
   leafy. Old paths that many later roads join become main streets and are widened.
5. **Squares** form where roads of areas that change together meet (co-change from the existing *Szomszédok* data): a
   market square, a station square.
6. **Determinism.** One seed (the repo's first commit hash) and stable per-path hashes: the same repo always grows the same
   city, and a new file never moves an old one; it only takes the next free frontage.

The old treemap stays as a view: **Tervrajz** (the planned city) next to **Növekedés** (the grown city), with the
same buildings flying between the two — the rearranging move Gépország already has (44-hm-grow.js).

---

## 4. The districts and their social geography

The city reads like a real one: rich hill suburbs, middle-class housing estates, workers' quarters from the edge in,
a downtown of office towers, a castle and a campus.

| District | Who lives there | Look |
|---|---|---|
| **Vár** (castle hill) | Client jobs: Domoszló as the castle; later jobs as manors and keeps around it | Stone keep, curtain wall, a flag per job. Names stay blurred unless the job is public (CITY-D27 A rule) |
| **Akadémia** (campus) | The Planner and its parts | §5.1 |
| **Belváros** (downtown) | docs, big data and JSON, financial and client data (Calculator prices, Inventory, the job register) | GitCity-style office towers on a regular block grid — the one planned part of the city, laid out late, as downtowns are |
| **Villanegyed** (hill suburb, upper class) | BRIDGE: the architecture, the unit fleet, the inline designs | White modernist villas with flat roofs, glass, pools and lawns, curving drives on the hillside — the gated, manicured suburb |
| **OmniComm Lakópark** (housing estate) | BRIDGE/03_omnicomm-hub | 4–8-unit terraced rows (*sorház*) in phases: the estate grows a row per batch of commits, with a car park and a playground, never all at once |
| **Munkásnegyed** (workers' quarter) | Everything small and plain: config, scripts, small helpers, tests | Today's default box building, from the shore towards downtown, dense and low |
| **Ipari part** (works by the water) | Firmware, BuildTree, the build tooling | Foundry, cranes, sheds |
| **Kikötő és reptér** | The outward links | §6 |

**District styles** change the same building slightly: roof pitch, facade colour, window rhythm, street trees. A
`.js` house is brick in the Munkásnegyed, plaster in the Akadémia, glass downtown — still recognisably a `.js`.

---

## 5. Every program as a landmark

### 5.1 The Planner: workshop → manufactory → academy

The Founder's example, as the model for all others. The Planner is not one big square any more: it is a **campus**.

| Stage | Crossed when | Look |
|---|---|---|
| 1 Műhely | first commit | One timber workshop with a yard, building the castle |
| 2 Műhelyudvar | ≥ 20 source modules | Workshop, store and a drafting room around a yard |
| 3 Manufaktúra | ≥ 50 modules, first plugin-like parts (wiring, routing, views) | Pre-industrial manufactory: a long brick hall, chimney, a drying loft, a cart gate |
| 4 Akadémia | today | The **core building** (00-core … 05-totals: state, geometry, render) as the main hall with a clock tower; every function family as its own faculty building on the quad: Szobák, Áramkörök, Nyomvonalak, Hardver, RF, Kliens-előnézet, Falszerkesztő, Nézetek … Worktrees and branches are annexes and temporary pavilions; tests are the sports grounds |

The core is always the same, identifiable building; the faculties are generated from the module families
(`05h-rooms`, `05j-circuits`, `05o-traces` …), so a new family gets a new faculty building by itself.

### 5.2 The others

| Program | Landmark | Grows from → to |
|---|---|---|
| **Domoszló ház** (the first job) | The castle | Keep → castle with walls and a bailey as the job's plan grows |
| **Inventory / Készlet** | Market hall and warehouse row (*Raktárváros*) | Market stall → covered market → warehouses on the quay |
| **Calculators** (panel, general, LED) | Counting houses on the market square | One small counting house each; the price data behind them lives downtown |
| **MindMap** | Library with a reading garden | Reading room → library |
| **Modder / BuildTree** | Joinery yard with cranes | Shed → yard with a gantry |
| **Toolbox** | Smithy | One forge |
| **Firmware** (ESP boards, CYD, knob pad) | Foundry by the water | Furnace → foundry with a jetty |
| **CoreRef** (standards) | Law library beside the town hall | — |
| **Solomon** (rulings, the Gömb) | Court of justice with a dome | — |
| **Divergence** (signal board) | Signal tower / weather station on the town square | — |
| **Hub / Kapu** | The **city gate** with a toll house — literally the Kapu | Wooden gate → stone gatehouse → gate with towers |
| **launcher / START** | The **central station**: every road starts here | Halt → station → terminus with a clock |
| **Console** | Control room / dispatch centre | — |
| **CodeCity** itself | City museum with a scale model of the city inside | — |
| **Map / Térkép** | Surveyor's office with an observation tower | — |
| **Mobile** | Airport terminal (the app goes out to the phone) | Airstrip → terminal |
| **AirDeck** | Air-traffic control tower beside the terminal | — |
| **ServiceKit, CYD, Phone** | Service guild: the main garage, a roadside kiosk, a mobile van | — |
| **shared** (UI kit, logo) | Design guild hall and the paint yard that dresses the town: where its look is applied, gardens bloom (the Növekedés rule from Gépország) | — |
| **tools** | Waterworks and pumping stations | — |
| **docs** | Downtown newspaper and office towers; the GO-*.md files are the town hall | — |
| **Vendor** (fetched third-party code) | Foreign merchants' quarter by the harbour: it came by ship | — |

---

## 6. The island, the harbour and the airport

The city stands on an island about **twice its built area**: hills behind the castle and the villas, beaches,
fields and woods where the city can still grow. The coastline comes from noise, seeded like the layout.

From Gépország (docs/city/homeland/01-topology.md) we carry over the outward links, re-read for the repo:

| On the island | Means in the repo | From Gépország |
|---|---|---|
| **Deep-water harbour** | `origin` on GitHub: pushes leave and pulls arrive as cargo ships | *Tengeri kikötő* (Ethernet) and the existing ships (31-flows.js) |
| **Lighthouse and bonded store** | The `backup` remote: a sealed store on a headland | *Óvóhely* bunkers |
| **Ferries and bridges** | Worktrees and branches as twin islands (the existing metro islands, 28-metro.js) | — |
| **Airport** | Mobile: GitHub Actions building the APK = a plane leaving on every push; the phone relay = the arrivals hall | *Hajó, repülő* downloads |
| **Radio mast** | Wireless links: the phone relay, the CYD boards, the Cloudflare ring | *Rádiótorony* (Wi-Fi) |
| **Fishing jetty** | Short-range devices: Bluetooth, the macro pad, the knob pad | *Halászmóló* (Bluetooth) |
| **Customs house** | Vendor and downloads coming in, red/amber/green as today | the existing customs house |
| **Power station on the edge** | Erőmű stays: the PC the city runs on, the door to Gépország | *Erőmű* |

---

## 7. Every building says what it holds

A small **grammar** replaces the one box: footprint, roof, facade and details come from the file.

| File | Typology |
|---|---|
| `.js` / `.ts` | Townhouses: pitched roof, regular windows |
| `.cs` / `.kt` / `.c` / `.cpp` (compiled) | Stone houses with a cellar (the build output) |
| `.html` (a tool page) | Shopfront with a sign: it is where a program meets its users |
| `.css` | Painted facade and front garden |
| `.md` | Timber-and-plaster house with a hanging signboard; long docs are guild halls |
| `.json` / data | Barns, silos and stores; big data files are downtown vaults |
| images, audio | Gallery, music hall (Birtok's rule, 07-growth-and-land §7.2) |
| tests | Fenced training yards |
| scripts (`.cmd`, `.ps1`, `.sh`) | Sheds and pumping huts |

Measured details on top: **height** = commits (as now), **footprint** = lines, **lit windows** = recency (as now),
**scaffolding** = churn in the last week, **patina / ivy** = age since the last change, **awning colour** = the main
author or agent. Each building is slightly different (hash-based variations within its typology), so a street never
looks copy-pasted.

---

## 8. The timeline

The replay (05-replay.js, 06-timeline.js) keeps its verbs; what it shows changes:

- Roads are laid as they first get a file; buildings rise on their plots; the landmark buildings change stage.
- Age crossings give a title card (*II. korszak — Mezőváros, 2026-09-20*) and a short camera pull-back.
- The harbour gets its first ship at the first push, the airport its first plane at the first APK build.
- A *Krónika* panel lists the ages and stages with their dates — the repo's history told as the town's.

---

## 9. What we keep

Everything in GO-CITY's done list keeps working: lenses, roads between roofs, metro and worktree islands, ships and
planes, live mode, Gépország and Birtok, Mélyvíz, the low-glow and quality tiers. 2.0 is a new layout and a new
building grammar under the same city, plus the island, ages and landmarks. Render budget: instancing per typology
(a few dozen instanced meshes instead of one), still render-on-demand.

---

## 10. Decisions

Numbered as usual; A recommended.

- **CITY-D54 — the default plan.** A: Növekedés (grown) is the default, Tervrajz (treemap) a toggle. B: the treemap stays
  default. C: Növekedés only.
- **CITY-D55 — client jobs on the castle hill.** Job folders are not in the repo and carry client names.
  A: only Domoszló, as the castle, name shown (it is the founding story); other jobs later as unnamed manors read from
  `jobs\` by the segéd, names blurred. B: Domoszló only, nothing from `jobs\`. C: every job, names shown.
- **CITY-D56 — the ages.** A: thresholds on the data as in §2 (stay true as the repo grows). B: fixed dates.
- **CITY-D57 — the Planner's faculties.** A: generated from the module families in `src/` (a new family = a new
  building). B: a hand-made list.
- **CITY-D58 — downtown.** A: docs, big data and the financial / client data. B: docs only; data stays in the warehouses.
- **CITY-D59 — the look.** A: one pass of 3D building kits per typology (low-poly, our own meshes, made in code), in the
  Mélyvíz palette. B: textured models (heavier; licences per model, as Gépország noted). C: stylised extrusions only.
- **CITY-D60 — urbandesignlab ideas.** A: the figure-ground and land-use lenses and the Tabló export in 2.0; entourage
  sprites later. B: lenses only. C: none.

**Decided 2026-11-06:** D54–D60 all A (the user: "A for all").

- **CITY-D61 — idle motion (K2-09).** Mélyvíz's rule M2 / R3 said the water moves only when clicked, and R11 that a
  quiet city renders nothing. The user asked for life on the streets. Taken (2026-11-06, the user: "do K2-09
  Hangulat"): the moving life is **on by default** and one key (H) turns it off; it never runs on the wallpaper, with
  prefers-reduced-motion, in a hidden tab, in Gépország or zoomed out past the city. The water's idle swell is low and
  carries no meaning; a click wave stays the only motion that answers the user. Revisit if it costs too much on the
  laptop.

---

## 11. Work packages (CITY-2 series)

| WP | Content | Depends on |
|---|---|---|
| **K2-01** | Growth layout: seed, road growth, frontage plots, squares, determinism; Tervrajz ↔ Növekedés move | D54 |
| **K2-02** | Island: coastline twice the built area, hills, beaches; shore, harbour, lighthouse, airport positions | K2-01 |
| **K2-03** | Building grammar: typologies by file kind, hash variations, district styles, scaffolding / patina / awnings | D59 |
| **K2-04** | Districts: Vár, Akadémia, Belváros grid, Villanegyed, OmniComm Lakópark phases, Munkásnegyed, Ipari part | K2-01, D55, D58 |
| **K2-05** | Landmarks with stages: the Planner campus (D57) and the §5.2 table | K2-03 |
| **K2-06** | Ages: thresholds, title cards, Krónika panel; the replay drives roads, plots and stages | K2-01, D56 |
| **K2-07** | Outward links on the island: harbour = origin, lighthouse = backup, airport = APK builds and the relay, radio mast, jetty | K2-02 |
| **K2-08** | Urban-design lenses and the Tabló export | D60 |
| **K2-09** | *Hangulat*: life and atmosphere without models — shadows, street lamps, the shining shore, people and carts by the data, flicker, the sea's swell, tilt-shift | K2-01, D61 |

Each WP keeps the existing selftest green (`node CodeCity/tools/selftest.js`) and adds its own spec.

### Built

- **K2-01 (2026-11-06)** — `CodeCity/src/02-grow.js`, spec `CodeCity/tools/spec-grow.js` (in the selftest). The castle
  track first, then each top-level area in order of first appearance, leaving from the area it changes with most; files
  front both sides of the road, turned to it; every row leaves gaps for side streets, and a road stops at 110 (main) /
  60 (lane) so a big area branches instead of running on. Deterministic per repo. P (or the header button) flies the
  buildings between Növekedés (default) and Tervrajz; the camera keeps its relative place. This repo's scan: 1,417 files on
  278 roads, every file a plot, no overlaps, ~2–3 s in Node; the grown town is ~1.3× the treemap's width (street space).
  The ground is a star-shaped blob with a slope limit (no spikes); K2-02 makes it the island. Squares are not in yet.
  Spacing widened on request (gap 1.2, setback 1.1): the town side is now ~563, ~350 roads, ~4.5 s in Node.
- **K2-02 (2026-11-06)** — `CodeCity/src/02-island.js` (data, DOM-free, in spec-grow) and `islandMeshes` (drawing). The
  coast is the town blob pushed out by seeded periodic noise and scaled by bisection to exactly twice the town's area.
  Hills behind the castle and the BRIDGE villas plus three small seeded ones, rising only outside the town and falling
  to a beach; woods (instanced cones, ≤ 2,800, thinned evenly) and patchwork fields between. Sites: the harbour where
  the town is nearest the sea (pier, T-head, boats, warehouse), the lighthouse on the most prominent headland (banded
  tower, lantern, a beam that sweeps while Hangulat runs), the airfield across the widest free land (runway with edge
  lights, apron, terminal, hangar, tower). Access roads join each site to the nearest town street; the ground along
  them and the runway is levelled and kept free of trees. `side` still measures the town (camera, fog, the Land).
- **K2-03 (2026-11-06)** — `CodeCity/src/51-grammar.js` plus the building shader. One instanced house mesh (walls and
  a gable roof whose ridge the shader raises, so instance i is still file i for picking, lenses, selection and the
  replay). Typology by file kind: brick townhouse (code), timber house (docs, steep roofs), stone (compiled), shop with
  a lit shopfront and awning (.html), barn / vault (data; big data flat), shed / hall (scripts, tests), gallery
  (media); any house over 16 high becomes a flat-roofed glass tower as it grows. Scaffolding = 4+ changes in the week
  before the shown commit, patina and ivy = age, awning colour = main author. Materials tint the lens colour fully only
  on Alap (uMat), so the other lenses keep their meaning. The attributes are packed (12 of WebGL's 16; the selftest
  guards it — over 16 the buildings silently stop drawing). District styles (villas, downtown grid) wait for K2-04.
- **K2-04 (2026-11-07)** — `GROWTH_DISTRICTS` in `02-grow.js` (layout), `51-grammar.js` (styles), `52-district.js`
  (drawing). Matched per group path, first match wins: Akadémia = Planner; Belváros = docs, Calculator, Inventory
  (D58 A); OmniComm Lakópark = BRIDGE/03_omnicomm-hub; Villanegyed = the rest of BRIDGE; Ipari part = Firmware,
  Modder, ServiceKitCYD, tools, .github; Munkásnegyed = everything else. Each district scales the plot gap and
  setback, the street's bend and the pull to the centre: downtown streets are straight on the world axes (a grid),
  villas stand far apart with lit garden pools, the terraces nearly touch and are capped to like-sized units (the data
  stays in their height), the works lean towards the shore. Styles (packed beside the typology, aGram.x = kind +
  16 × district): college halls of pale plaster with slate roofs, glass offices downtown (towers from 9 high, not 16),
  white flat-roofed villas with panoramic windows, brick terraces under one roof line, sheds and works, brick in the
  Munkásnegyed. The Vár: the Domoszló castle (D55 A) at the head of the first track — curtain wall, four towers, a
  gatehouse towards the town, a keep with battlements and lit slits, a red flag, its name. Each district's name floats
  over its middle. Spec: every building has a district, downtown segments are multiples of 90°, pools never sit on a
  plot. The layout costs ~5 s of CPU on this repo (the spec now times CPU, not wall-clock: a busy machine took 20 s+);
  the occupancy grid became a flat bitset on the way. Not yet: the villas on their hill (the hill is behind them, the
  town stays flat), a district as one contiguous place (each sub-folder lane still leaves where the growth finds room),
  Lakópark phases by commit batch.
- **K2-09 (2026-11-06)** — `CodeCity/src/50-mood.js` plus the building shader in `03-scene.js` and the swell in
  `38-sea.js`. Static: a soft shadow under each building leaning away from the moon (follows the replay), lamps with
  posts and light pools every 6–7.5 m of road, a foam band and a halo on the shore, floor lines, dark feet, parapets and
  roof rims, warm / cool window tints. Moving (H, default on, CITY-D61): up to 2,600 people and carts (1,400 / 500 on the
  mid / low tiers) walking the streets — each area's share follows its recent changes at the shown commit and the whole
  town is busier when the repo is; one window in eight on its own clock; the shore shimmers; the sea breathes; a
  tilt-shift blur (CSS backdrop-filter) at the top and bottom. Test hook `#moodtest=1` (`window.kvMood()`, `kvMood(1).step(n)`
  drives frames by hand where animation frames do not tick).
  Left for later: bloom as a real post pass (needs three's EffectComposer vendored), interior-mapped windows, CC0 packs
  (Kenney / Quaternius / Poly Haven, licence notes per pack) — they belong with K2-03's building grammar.
