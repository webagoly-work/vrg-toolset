# 05 — GitWorld map, implementation methods for §7.1/§7.2, and the repo map

2026-10-26 · research notes, no code changed. Scope: (1) a multi-scale "GitWorld" geography around
VRG Kódváros (planet → Land → cities → district → building → floor), (2) a method, algorithm and
library for each idea in `docs/city/README.md` §7.1 and §7.2, (3) every GitHub repo that is at least
partly useful, with licence and what to take from it.

**Method.** Web search and the pages it found; repo metadata (licence, language, stars, last push,
archived) from the ecosyste.ms repo API on 2026-10-26, with licence files read straight from
`raw.githubusercontent.com` where ecosyste.ms had none. The vendored three.js was inspected in
`Vendor/three` (npm `three@0.169.0`). The deep-research `researcher.md` instructions could not be
read: the session blocks reads outside the repo, and that was not worked around.

**Licence rule used throughout.** ✅ = MIT / BSD / ISC / Apache / zlib: code may be adapted, the
notice travels. ⚠ = LGPL / MPL / unclear / no licence file: read for ideas, do not copy code until
checked. ⛔ = GPL / AGPL / non-commercial: re-implement the idea only, never copy code.

---

## 0. Verdict — what to do first

| Piece | Recommended method | Runner-up | Why |
|---|---|---|---|
| Multi-scale zoom | **Nested scale frames with camera hand-off** (§2 M3) + per-level near/far | Separate scenes with a crossfade (`RenderTransitionPass`, in r169) | float32 cannot hold a planet and a function floor in one coordinate system. Our city keeps its own units, untouched |
| Planet | **Own three.js sphere** (hexasphere or icosphere), Tron shader, `InstancedMesh` dots, GitHub-globe tricks | `three-globe` 2.45.x as an `Object3D` (MIT, peer `three >=0.154`, so r169 works) | No extra renderer, no tiles, offline. Cesium and MapLibre fight our scene and add MBs |
| Countries and coastline | **Spherical Voronoi** (`d3-geo-voronoi`, ISC) over seeds stored in a `world.json` registry, edges warped with simplex noise | mapgen4- or Azgaar-style elevation + sea level | Stable as long as seeds never move, the same rule as the city layout |
| Placing places on our Land | **Hex slots** assigned once, persisted, collision-probed by hash | Force layout run once, then frozen | Positions never move (the BabiaXR/Evo-Streets lesson, already CITY rule) |
| Flows | **GPU-instanced Bézier ribbons** for planes/arcs (Shopify BFCM technique), **curves in a DataTexture** for ships/trains | `Line2` arcs + `TubeGeometry.setDrawRange` (GitHub globe technique) | Thousands of vehicles in a few draw calls |
| Live data | **Companion server** (Kapu's `companion-server.js` pattern, 127.0.0.1) + SSE stream; the page stays an offline snapshot when it is not running | Polling a JSON file the scanner rewrites | `file://` has no origin; EventSource needs `http://127.0.0.1` |
| GitHub planet data | **Snapshot fetcher** in Node (ETag cache, PAT optional) writing `world.json`; sources: `vendor-manifest.json` (31 repos), package.json deps, remote, stars | anvaka's Map of GitHub coordinates for "the rest of the world" | 60 req/h without a token; conditional 304s are free only when authenticated |

The single most reusable precedent for the whole GitWorld idea is **Netflix Vizceral**
(Apache-2.0): global → region → service levels with traffic particles and a zoom between them.
Its code is unmaintained, but it is the semantic-zoom-plus-traffic pattern exactly. For a
code-specific precedent of semantic zoom, see **ExplorViz** (three.js, "software landscape" of many
applications, semantic zoom + mini-map evaluated in two user studies, arXiv 2510.00003, 2025).

---

## 1. The scale ladder and the data model

| Level | Name | What it is | Source of truth | Units in its own frame |
|---|---|---|---|---|
| L0 | **GitWorld** (planet) | GitHub / all code. Other repos as foreign countries and cities | `world.json` (fetched snapshot) | planet radius = 1000 |
| L1 | **Land** (our country) | Everything "ours" on one map: repo city, H: storage, PC, router, USB village | `land.json` (registry of places, hex slots) | 1 unit = 1 "km" |
| L2 | **City / suburb / village** | Kódváros (repo), Tárház (H: drive), Erőmű (PC: CPU/RAM), Pályaudvar (router), USB village (when present) | each place's own scan (`city.json`, `disk.json`, live stats) | city units, as now |
| L3 | District | folder | `city.json` | city units |
| L4 | Building | file | `city.json` | city units |
| L5 | Floor | top-level function / section | `outline` in `city.json` (new) | building-local |

**Abroad** = the internet: the coast of our Land. The router city sits on the coast (its WAN port is
the harbour and airport). Docks and gates are a shared **port registry** (`ports.json`): host →
dock (github.com, api.anthropic.com, registry.npmjs.org, OneDrive, Spotify…). The §7.2 #3 Harbour
idea and the GitWorld shoreline are the same object, at two zoom levels.

Real topology to draw, already looked up (`docs/research/2026-10-26_router-usb-phone-wake.md`):
PC `192.168.0.100` → TP-Link TL-WR1043ND `192.168.0.1` → Huawei HG8245H ONT `192.168.1.254` (double
NAT) → ISP `91.120.199.243`. So the Land has two transport hubs in a chain: a local station
(TP-Link) and a border crossing (Huawei ONT). Hops come from `tracert -d`.

**Stability rule.** Every place, country seed and dock gets its slot **once** and keeps it in the
registry file. New things take the nearest free slot, and nothing is ever re-laid-out. This is the
city's "layout over every file that ever existed" rule, lifted one level.

---

## 2. Multi-scale map: methods (three.js r169)

Why a method is needed at all: float32 has ~7 significant digits. If one unit is 1 m and the planet
radius is 6.4e6, positions near the surface are quantised to ~0.5 m, so buildings jitter and floors
are impossible. Depth precision is a second, separate problem.

What r169 itself has (checked in `Vendor/three`):

- `logarithmicDepthBuffer` (renderer option): fixes depth range, but writes `gl_FragDepth`. That
  disables early-Z for every fragment. Reported cost: ~65 → ~35 fps on an instanced foliage scene.
  It does **not** fix vertex jitter.
- `reverseDepthBuffer: true` (renderer option, used only when `EXT_clip_control` exists). It was
  renamed `reversedDepthBuffer` in r179. Shadows are reported as partly broken with it, and it is an
  init-time setting.
- `THREE.LOD`, `InstancedMesh`, `BatchedMesh` (core), `CSS2DRenderer` (labels).
- Addons present: `postprocessing/RenderTransitionPass.js` (crossfade two scenes),
  `UnrealBloomPass`, `OutlinePass`, `AfterimagePass`, `SMAAPass`, `lines/Line2`/`LineSegments2`,
  `misc/RollerCoaster.js` (rail-track geometry), `misc/TubePainter.js`,
  `misc/GPUComputationRenderer.js`, `objects/Sky`, `Water`, `Lensflare`, `math/SimplexNoise`,
  `ImprovedNoise`, `libs/tween.module.js`. **`LightningStrike` is gone** (removed in r152).
- Kódváros today inlines only core three (`CodeCity/build.js`, `threeAsObject`). Using any addon means
  copying the client-preview build's pattern, which already inlines `examples/jsm/lines`.

| # | Method | How | Good | Bad | Use for |
|---|---|---|---|---|---|
| M1 | Single world + log depth | All levels in one scene at real ratios, `logarithmicDepthBuffer` | Simplest code | Vertex jitter at depth; perf cost (no early-Z) | Not recommended |
| M2 | Single world + **floating origin** | Each frame, subtract the camera target from every root (or keep the camera at the origin and move the world), plus reversed depth | Continuous zoom, one scene | Every system (raycast, lines, labels) must respect the rebase; float64 positions must be kept on the CPU | Planet ↔ Land only |
| M3 | **Nested scale frames + hand-off** (recommended) | Each level is an `Object3D` with its own units. When the camera crosses a threshold into a child, re-parent the camera into the child frame, rescale (child units become 1), and set near/far to `dist×1e-3 … dist×1e3`. The parent is drawn as a scaled impostor (KSP "scaled space") | Each renderer (our city!) keeps its units; precision never runs out; works with r169 as is | Hand-off code; two scenes visible at the seam (draw the far one first, `clearDepth` between) | The whole ladder L0–L5 |
| M4 | Separate scenes + camera tween + crossfade | Scene per level; tween the camera to a "portal" view, then crossfade with `RenderTransitionPass`; precompile each scene to a 1×1 target on load (galaxy-portfolio trick, 7 scenes from galaxy to desk) | Easiest to build and to reason about | A cut, not a continuous zoom | Fallback, or L2 → L5 entry into interiors |
| M5 | Semantic zoom by LOD / impostors | At each distance, swap representation: city → glowing dot + label → skyline impostor → buildings → floors (`THREE.LOD` or our own distance bands) | Required inside every method above | Thresholds need tuning; hysteresis needed against flicker | Always, inside M3/M4 |

**Globe → map morph** (for L0 → L1). In a vertex shader, lerp each vertex between its position on the
sphere and on the tangent plane at the Land's centre, by a zoom factor. When zoomed in, the Land
becomes flat and the city frames sit on a plane. MapLibre's globe does the equivalent at high zoom.
Cheap, and it hides the M3 seam.

**Camera.** `camera-controls` (yomotsu, MIT) has smooth `setLookAt`/`fitToBox` transitions and
`dollyToCursor`. Shopify's globe camera notes: spherical interpolation (radius, phi, theta), and reset
`camera.up` every frame from phi/theta, or the view flips near the poles. tween.js (MIT) ships in
r169's `libs/`.

---

## 3. The planet and the geography

### 3.1 Rendering the planet

| # | Option | Licence / size | Fit |
|---|---|---|---|
| G1 | **Own sphere** — icosphere or `hexasphere.js` tiles (MIT, arscan). Land dots as one `InstancedMesh` (GitHub globe: ~12k circles, density by latitude rows ∝ cos(lat), land test from a tiny PNG's alpha). Halo = back-face sphere ×1.15 with a gradient shader. Fade dots by `gl_FragCoord.z` near the limb against moiré | ours | **Best**: no dependency, Tron look is ours |
| G2 | `three-globe` (vasturiano, MIT) as an `Object3D` in our scene: arcs, paths, hex-bin, polygons, rings, labels, custom layer. Pulls d3-geo, h3-js, tween.js, kapsule… → needs bundling into the single page | MIT, peer `three >=0.154` | Good for a quick prototype. **globe.gl ≥2.46 needs three ≥0.179**: not usable with r169 |
| G3 | `encom-globe` (arscan, MIT) — Tron: Legacy boardroom globe: hexagon tiles, satellites, markers, loading animations | MIT (2014–17), old three API | Look reference; port the ideas, not the code |
| G4 | MapLibre GL JS 6.x (BSD-3) globe projection + three.js custom layer (official example "3D model on globe using three.js"); real cartography, vector tiles, PMTiles offline | BSD-3, ~1 MB+ | Only if the map must look like a map (anvaka's Map of GitHub is MapLibre). Two renderers share one GL context |
| G5 | CesiumJS (Apache-2.0) / deck.gl GlobeView (MIT) / 3DTilesRendererJS (Apache-2.0) / geo-three (MIT) / three-geospatial (MIT, atmosphere and clouds) | heavy | Real-earth tools; overkill for a fantasy planet. `three-geospatial` is worth reading for an atmosphere shader |

### 3.2 Countries, coastlines and terrain

- **Spherical Voronoi**: `d3-geo-voronoi` (Fil, ISC) takes `[lon, lat]` seeds and returns Delaunay +
  Voronoi on the sphere, plus `find(lon, lat)` (which cell contains a point) and the **Urquhart
  graph**, a natural road/rail network between seeds. Seeds = countries (our Land, each GitHub owner
  or ecosystem). Convert polygons to 3D with lat/lon → xyz, and triangulate each cell as a fan from its
  centroid.
- **Seed placement**: a spherical Fibonacci lattice gives N even, deterministic slots. Map entity → slot
  by a stable hash with linear probing, and persist it in `world.json`. Optionally run one or two
  Lloyd relaxation passes **before** the first save, never afterwards.
- **Coastline**: domain-warp the cell boundary with simplex noise (`simplex-noise.js` MIT, or r169's
  `SimplexNoise`). Or compute elevation = f(distance to the seed) + fBm noise, and threshold at sea level.
  Azgaar's Fantasy Map Generator (MIT, 2017–24) builds ~10k Voronoi cells with template heightmaps
  (hill, pit, range, trough primitives). mewo2/terrain (MIT, 2016) is the clearest small write-up of
  erosion → coast → rivers → cities. Red Blob mapgen4 (Apache-2.0) is the cleanest modern code for
  dual-mesh elevation, rivers and painting. `delaunator` (ISC) is for flat maps.
- **Hex grid on the Land**: `h3-js` (Apache-2.0) if the Land should live on the real sphere, or a plain
  axial hex grid on the flattened Land (Red Blob Games' hex guide). Hex slots make "city / suburb /
  village" sizes discrete: a city takes 7 hexes, a suburb 3, a village 1.
- **Roads inside the Land**: Urquhart or relative-neighbourhood graph between places, smoothed with
  `CatmullRomCurve3`. Rails use r169 `RollerCoaster.js` track geometry, or a ribbon with sleepers by
  instancing.
- **Procedural city/road generators (looks only)**: ProbableTrain/MapGenerator (tensor-field streets,
  LGPL-3 ⚠), watabou TownGeneratorOS (GPL-3 ⛔), `anvaka/city-roads` (MIT, real OSM roads, rendering
  millions of line segments). Our districts are already the city; these are for suburbs and villages.

### 3.3 Our places on the Land (L2)

| Place | Metaphor | Data (Windows, **no admin**) | Live? |
|---|---|---|---|
| **Kódváros** (repo) | the existing city | `scan.js` | rescan on change (§6) |
| **Tárház** (H: drive) | warehouse town: top folders = districts, size = bytes (treemap like WinDirStat/SpaceSniffer), the backup copy `H:\VRG\Backup\code\Planner_VRG_U100-mirror` and `H_BACKUP_…` as fenced depots | a Node walker (`fs.readdir` with `withFileTypes`, sizes), cached, refreshed hourly | slow |
| **Erőmű** (PC compute node) | power station: one cooling tower per logical CPU (glow = load), RAM = reservoir level, GPU = turbine hall, disks = silos | `systeminformation` (MIT): `currentLoad()`, `mem()`, `fsSize()`, `graphics()`; or `typeperf "\Processor(_Total)\% Processor Time"`. Note: `os.loadavg()` is always 0 on Windows | 1–2 s |
| **Pályaudvar** (TP-Link router) | central station with platforms = flows; hop-on/hop-off = LAN ports / Wi-Fi; a border crossing to the Huawei ONT | NIC counters `Get-Counter "\Network Interface(*)\Bytes Received/sec"`; router WAN counters via **UPnP IGD** `WANCommonInterfaceConfig:GetTotalBytesReceived/Sent` (SOAP to the control URL from SSDP's `igddesc.xml`; works only if UPnP is on, which TP-Link often leaves off by default) | 1–5 s |
| **USB village** | appears at the end of a rail spur when a stick is plugged in | `systeminformation.blockDevices()` / `usb()`; or PowerShell `Get-PnpDevice -PresentOnly`; hotplug via WMI `Win32_VolumeChangeEvent` (`Register-WmiEvent`) or `node-usb` (MIT) hotplug events | events |
| **Bluetooth devices** | small objects (buoys, drones) | `systeminformation.bluetoothDevices()` / `Get-PnpDevice -Class Bluetooth` | 10 s |
| **Open programs** | temporary constructs (pop-up pavilions) by process; size = working set | `systeminformation.processes()` or `Get-Process` with `MainWindowTitle` (only windowed apps) | 2–5 s |
| **Spotify** | stadium; the floodlights pulse while playing; scoreboard = track | Cheapest: the window title of `Spotify.exe` ("Artist - Title") via `Get-Process`, no API. Web API `currently-playing` needs an OAuth app: since Feb 2026 the dev-mode owner needs Premium, and new apps are capped at 5 users | 5 s |

---

## 4. Flows: ships, planes, trains

### 4.1 Rendering methods

| # | Method | Source | Scale | Notes |
|---|---|---|---|---|
| F1 | **GPU Bézier ribbons, instanced** — 4 control points (P1/P2 at 25 %/75 % lifted) packed into an interleaved instanced buffer; the vertex shader evaluates the curve and offsets a camera-facing strip (tangent × view dir); `v` drives the reveal/dissolve; only a finished arc's slice is re-uploaded | Shopify BFCM 2023 globe write-up | tens of thousands per draw call (1M benchmarked on M1) | WebGL vertex stride ≤ 255 bytes: they cut 94 floats to 17. Best for **planes / packets** |
| F2 | `CubicBezierCurve3` → `TubeGeometry`, animate with `setDrawRange`; landing dot + expanding ring (`scale += (1-scale)·0.06`, opacity `1-scale`) | GitHub globe write-up | hundreds | Simplest; fine for "the few downloads now" |
| F3 | **Paths in a DataTexture**: sample each route (sea lane, rail) into a float texture (position + Frenet frame per texel); each vehicle instance has (routeId, t0, speed); the vertex shader reads the texture and orients the model | three.js forum "Spline + DataTexture" | thousands of ships/trains, 1 draw call per model | Best for **ships and trains** that follow fixed lanes |
| F4 | Planes on orbits: a pivot rotates, or orbit maths in the vertex shader via `onBeforeCompile` on `MeshBasicMaterial`, instance matrix from `lookAt` | Shopify | many | Holding patterns over the airport |
| F5 | Light trails: `AfterimagePass` (r169, cheap, whole screen) or our own ribbon trail (Codrops "High-speed light trails" technique, frame-rate-independent loop; its repo `Anemolo/Infinite-Lights` has no licence ⚠ = idea only; `TrailRendererJS` has no licence file ⚠) | Codrops | — | Tron light-cycle look |
| F6 | deck.gl `TripsLayer` / `ArcLayer`, flowmap.gl (Apache-2.0) | vis.gl | huge | Only if the map is deck.gl. Read for the timestamp trick: offset epoch values before float32 |

### 4.2 Event → vehicle mapping (proposal)

| Event | Vehicle | Size ↔ | Speed ↔ | Route |
|---|---|---|---|---|
| Large download (> 50 MB: installers, `git clone`, model files) | **container ship** | length ~ log(bytes), containers = 10 MB each | observed bytes/s (log) | sea lane from the host's dock across the coast to the router harbour, then rail to the place that owns the file |
| Medium download (1–50 MB: npm tarballs, release assets) | cargo plane | wingspan ~ log(bytes) | bytes/s | air corridor → router airport |
| Small requests (< 1 MB: API calls, `git fetch`, Claude API) | small plane / drone, or a light pulse on F1 | constant | latency (RTT) | dock host → router |
| Upload / `git push` | same vehicles, outbound | | | reversed |
| PC ↔ USB stick, PC ↔ H: copy | **train** | wagons ~ files, length ~ bytes | MB/s | rail spur Erőmű ↔ USB village / Tárház |
| Process ↔ process (local server, MCP over stdio) | metro / tram | | | inside a city |
| LAN device ↔ router | taxi / bus at the station platforms | | | Pályaudvar |

**Where the events come from (no admin, no packet capture):**

- **Remote endpoints + owning program**: `Get-NetTCPConnection -State Established` gives the remote
  IP/port and `OwningProcess`. Name them with `Get-DnsClientCache` (github.com, api.anthropic.com…)
  plus the port registry.
- **Throughput**: per-NIC counters (`Get-Counter`). Per-connection or per-process bytes need ETW
  (`Microsoft-Windows-Kernel-Network`, admin) or Npcap capture (bandwhich, Sniffnet). Leave these as
  an opt-in "precise mode". Without them, split the NIC rate across live connections, which is
  honest enough for a picture.
- **Downloads**: watch the Downloads folder and the repo's `.git/objects/pack` with `fs.watch` or
  chokidar (MIT). A growing file = a ship in transit, and the final size = cargo.
- **Where abroad is**: GeoIP from `sapics/ip-location-db` (CC0 / CC-BY data from DB-IP lite,
  iptoasn), or the ASN only: "which foreign country the ship comes from". Sniffnet does the same with
  MaxMind data.
- **Live at world scale (decoration)**: GitHub public events API (`/events`, honour `X-Poll-Interval`
  and ETag) for random arcs between foreign repos; GH Archive hourly dumps for replays.

---

## 5. GitHub as the planet

### 5.1 What to place, and from where

| Layer | Data | Endpoint / file | Cost |
|---|---|---|---|
| Our remote | `webagoly-work/vrg-toolset` (private) | `GET /repos/{o}/{r}` (needs a PAT) | 1 req |
| **Vendored neighbours** | `vendor-manifest.json`: **31 components**, each with repo + licence (MIT … AGPL-3.0) + pin type | local file, enriched by `GET /repos/{o}/{r}` or ecosyste.ms | 31 req, cacheable |
| npm dependencies | `Inventory/package.json` (+ lockfile) | deps.dev `GET /v3/systems/npm/packages/{name}/versions/{v}:dependencies` (resolved graph; caching explicitly allowed; data CC-BY 4.0); npm registry packument | per package |
| GitHub's own dependency graph | SPDX SBOM | `GET /repos/{o}/{r}/dependency-graph/sbom` (works unauthenticated for public repos; newer async generate → `fetch-report/{uuid}` flow, 202 while processing) | 1–2 req |
| Forks / stargazers | | `/repos/{o}/{r}/forks`, `/stargazers` | paged |
| Things we starred | | `/users/{user}/starred` | paged |
| "The rest of the world" | ~400–500k repos clustered by shared stargazers into named countries | anvaka **Map of GitHub** (code MIT; data: "please attribute"); pipeline: BigQuery GH Archive stars → Jaccard similarity → clustering → force layout → GeoJSON → tippecanoe → MapLibre | static download |
| Rankings, trends | | OSS Insight (pingcap, Apache-2.0) API | free |
| Provenance ("where else does this file live") | SWHIDs | Software Heritage API (origins, visits, snapshots; the graph endpoint needs special permission) | slow, rate-limited |
| Repo metadata without a token | licence, stars, pushed | ecosyste.ms repos API: free tier 300 req/h; add `mailto` to the User-Agent for the polite pool | — |

### 5.2 Placement options (pick one, persist the result)

| # | Rule | Semantics | Stability |
|---|---|---|---|
| P1 | **Ecosystem continents**: npm, PyPI, crates, GitHub-only, Go…; inside them, owners as countries; language colour from GitHub linguist `languages.yml` (MIT) | readable | by registry |
| P2 | **Map of GitHub coordinates**: take anvaka's 2D layout (similar audiences cluster), wrap it onto the sphere (equirectangular or per-continent caps) | strongest "real world" meaning | fixed dataset |
| P3 | **Dependency distance**: our Land at a pole, with direct deps on the first ring, transitive deps further out; force layout on the sphere (constrain to the surface each tick) run once, then frozen | answers "how far is this from us" | frozen after first run |
| P4 | Hash → Fibonacci slot | none | perfect |

Recommendation: P1 for continents, P3 inside the "ours-adjacent" zone (vendored + deps), P2 as a
faint background population.

### 5.3 Rate limits (docs.github.com, read 2026-10-26)

- REST primary: **60/h unauthenticated** (per IP), **5,000/h** with a PAT, 1,000/h for `GITHUB_TOKEN` in Actions.
- Secondary: ≤ 100 concurrent; **900 points/min** for REST (GET = 1), 2,000/min for GraphQL; ≤ 90 s CPU per
  60 s; content creation ~80/min.
- **Conditional requests**: a `304 Not Modified` to an `If-None-Match`/`If-Modified-Since` request does
  **not** count against the primary limit, **only when authenticated**. Keep the same parameters on every
  poll, or the ETag changes.
- Read `x-ratelimit-remaining/reset/resource`; on a secondary limit, wait `retry-after`, else ≥ 1 min,
  then back off exponentially. `GET /rate_limit` is free against the primary limit.
- Webhooks are preferred over polling, but the PC is behind double NAT. So poll, or relay through a
  third party (smee.io and the like) only with the user's say-so: it is an outside service seeing our
  repo events.

**Design consequence.** A Node fetcher (`CodeCity/world.js`, zero deps, like `scan.js`) with an ETag
cache under a git-ignored `.cache/`, an optional `GITHUB_TOKEN` from the environment (never written into
the page), and output `world.json`. The page renders the snapshot; the companion refreshes it at most
every 15 min.

---

## 6. Staying live

1. **Snapshot first** (CITY-D2 stays true): every page works offline from embedded data.
2. **Live overlay when the companion runs**: extend Kapu's `companion-server.js` (127.0.0.1:8795, Host
   and Origin checks, whitelisted actions) with `GET /api/stream` (Server-Sent Events) and
   `POST /api/event`. The page tries `EventSource('http://127.0.0.1:8795/api/stream')` and falls back
   silently.
3. **Repo changes**: `fs.watch(repo, {recursive:true})` (native on Windows) or chokidar, debounce
   ~500 ms, then incremental rescan: `git status --porcelain`, plus `git log HEAD@{1}..HEAD` after
   commits. Push deltas (file LOC/heat changes, born/gone), not a whole new `city.json`.
4. **Live Claude sessions** (§7.1 #5): Claude Code **hooks**. `PostToolUse` (matcher
   `Read|Edit|Write|Grep|Glob`) receives JSON on stdin with `session_id`, `tool_name` and
   `tool_input.file_path`. A tiny Node hook script keeps only path + kind + time (the same privacy cut as
   `sessions.js`) and POSTs it to the companion with a short timeout, failing silently. Alternative
   without hooks: tail the transcript `*.jsonl` with `fs.watch` and the existing `sessions.js` filter.
   Adding a hook is a settings change: the user decides.
5. **System and network**: one sampler loop in the companion (systeminformation / PowerShell counters,
   1–5 s), emitting events on the same stream.

---

## 7. Tron aesthetic — recipe

- **Selective bloom**: `UnrealBloomPass` on a bloom layer only (r169 example
  `webgl_postprocessing_unreal_bloom_selective`: render bloom objects to a target, darken the rest,
  composite). Emissive values > 1 feed it. GitHub's globe ran with antialias off, using the halo to
  hide the edge; with bloom, add `SMAAPass`.
- **Edges**: `EdgesGeometry` → `LineSegments2` + `LineMaterial` (fat lines, r169) in cyan/orange;
  `OutlinePass` for the selection.
- **Grid floor**: a shader using `fract(worldPos.xz / cell)` with `fwidth` antialiasing (the
  `THREE.InfiniteGridHelper` technique, MIT, Fyrestar), fading with distance. On the planet, the same
  done in lat/lon.
- **Rim light**: fresnel `pow(1 - dot(N, V), k)` on buildings and the planet (encom-globe and GitHub
  halo).
- **Trails**: F5 ribbons for vehicles; `AfterimagePass` for a cheap global smear.
- **Atmosphere**: back-face halo sphere (GitHub), or `three-geospatial` (MIT) for a physically based one
  (heavier).
- **Particles**: own GPU points (Shopify fireworks: icosahedron strips, noise dissolve, one draw call),
  or `three-nebula` 13.x (MIT, peer `three >=0.122`).
- Keep the engine **skin-neutral** (README §7.2 note): materials come from a theme table, so "Tron" is
  one skin.

---

## 8. Methods for the §7.1 / §7.2 ideas

Columns: data → algorithm → library (licence) → rough cost. "scan" = `CodeCity/scan.js` (Node, zero
dependency; a vendored single-file lib is allowed only through `fetch-vendor.js`).

### 8.1 §7.1 Metaphor ideas

| # | Idea | Data | Algorithm | Library | Cost |
|---|---|---|---|---|---|
| 1 | City gates = START.cmd | `tools/check-start.js` → add `--json` (T<n> name/path, TOOLCOUNT, unregistered pages) | set difference registry ↔ discovered pages; gates placed on the **convex hull** of the city (Andrew's monotone chain), spaced by tool number so they never move; road = A* on the street grid or a straight arc | `d3-polygon` `polygonHull` (ISC) or 30 lines | S |
| 2 | Pipes = builds, stale dist floods the basement | each `build.js` declares inputs (globs) → output; latest input commit time (`git log -1 --format=%ct -- <inputs>`) vs a build stamp written into the dist (hash of inputs) | make-style DAG; stale = any input hash ≠ stamp; flood height ~ age of staleness | none (`Water.js` for looks) | S |
| 3 | Power plant = Vendor/ | `vendor-manifest.json` (31 entries: licence, ref type) + grep build scripts for `Vendor/<slug>` | bipartite graph vendor → consuming files; red sign if pinned to a branch; licence class from SPDX (permissive / weak / strong copyleft) | `spdx-expression-parse` (MIT) optional | S |
| 4 | Building sites = GO plans | `GO-*.md`: backticked paths (regex), WP tables (`| WP | … | Status |`) | progress = DONE / rows; fence = convex hull (or bbox) of the touched footprints per district; parked → boarded | none | S |
| 5 | Fences + live traffic | Kapu claims (`from-kapu/data`) + live hook events (§6.4) | claims → fence polygons; car = instanced mesh moving along the road polyline from the previous to the current building | companion SSE | M |
| 6 | Smoke = TODO/FIXME/HACK | `git grep -n -I -E "TODO|FIXME|HACK|XXX" HEAD` (one call; replay at HEAD only) | count per file → emission rate | GPU points (own) or three-nebula (MIT) | S |
| 7 | Cracked facades = long functions / deep nesting | per-file max function length, max nesting | token/brace depth scanner (lizard's language-agnostic approach), or AST via acorn for JS (and `<script>` blocks of our HTML tools) | acorn 8.19 (MIT); lizard (MIT, Python) as reference only | M |
| 8 | Weather = selftests | each selftest emits `--json` → `test-status.json` {suite, pass/fail, time}; test → district via the test file's imports | storm / clear / fog per district | rain = instanced streaks; lightning = own jagged `Line2` (midpoint displacement), since LightningStrike is gone | M |
| 9 | Traffic jams = circular imports | import graph (have it: 221 roads) | **Tarjan SCC**; cycles = SCCs of size > 1; road width ~ log(in-degree) | 30 lines, or `graphology` (MIT); cross-check with `madge --circular` / dependency-cruiser `no-circular` | S |
| 10 | Zoning lens | `CodeCity/zones.json`: glob → zone, first match wins (like `.gitattributes`) | glob match | own glob → regex, or `picomatch` (MIT) | S |
| 11 | City hall | `CLAUDE.md` codephrases (regex on `**\`GO …\`**`) | landmark at the city centre; phrase → its site (#4) | none | S |
| 12 | Morning newspaper | `git log --since=<last visit>` (last visit in localStorage, or the companion) | diff summary: new, demolished, hottest street | none | S |
| 13 | Museum district | `git for-each-ref refs/tags/archive/` + `git diff --name-status main...<tag>` | boarded-up buildings outside the wall for files differing | none | S |
| 14 | Warehouses | scan's skip list (binary, > 2 MB) with sizes | warehouse row, volume ~ bytes | none | S |

### 8.2 §7.2 Borrowed ideas

| # | Idea | Data | Algorithm | Library | Cost |
|---|---|---|---|---|---|
| 1 | **Repair tunnel** (stack trace) | pasted text | parse frames: V8 `at fn (path:line:col)`, Firefox `fn@path:line:col`, Python `File "…", line N`, .NET `in path:line N`; normalise (strip `file:///`, drive letter, case-fold on Windows, map to repo-relative); keep in frame order | `stacktrace-parser` (MIT) for JS; own regexes for the rest. Tunnel = `TubeGeometry` on a `CatmullRomCurve3` under the ground through the buildings; line → floor when interiors exist | S |
| 2 | **Blast radius** | import graph + co-change | **reverse-dependency BFS** (in-edges), ring = BFS depth, animated by depth; optional weighting by co-change confidence (code-maat's coupling = shared commits / commits of the source) → Dijkstra with cost −log p | 15 lines, or `graphology-traversal` (MIT) | S |
| 3 | Harbour | call-site regex (`fetch(`, `XMLHttpRequest`, `WebSocket`, `child_process`, `https.request`, `net.connect`, serial) + host literals | file → dock edges via the shared port registry (§1) | none | S |
| 4 | **Metro line** | import graph | **BFS shortest path** (unweighted = fewest hops); A*/NBA* when weighted; Yen's k-shortest for alternatives; draw with stations as discs, segments snapped to 45° for the metro-map look | `ngraph.path` (MIT) or 20 lines | S |
| 5 | Fog of war | `--sessions` reads (path + time) | per-district share of files unread in N days → density; render a top-down **mask render target** (footprints of read files painted white, blurred) and sample it in a fog shader; cheap version: one translucent noise volume per district | own shader | M |
| 6 | Foundation stone | git | birth: `git log --follow --diff-filter=A --format=%H%x09%an%x09%aI -- <f>`; renames already followed; "adapted from Vendor": match `git hash-object` of the file / functions against `Vendor/` blobs, or a `// adapted from` header; licence from the manifest; function lineage `git log -L :fn:file` | Software Heritage SWHID lookup (optional) | M |
| 7 | City library | `docs/**/*.md` | Markdown links + backticked paths → doc → file edges; undocumented = no incoming doc edge | regex; `markdown-it` (MIT) if needed | S |
| 8 | Inspector's beacon | outputs of #2, #6, #7, #8 (§7.1) | **worst-of** aggregation (max severity), grey = no data | none | S |
| 9 | **Building interiors** | file text at HEAD | outline of top-level declarations with line ranges, computed in scan → `outline` in `city.json`. Three ways: (a) regex at brace depth 0, zero deps; (b) acorn AST for JS + `<script>` blocks; (c) **web-tree-sitter 0.27 (MIT)** with each grammar's `tags.scm` (`@definition.function` / `@definition.class`), multi-language, wasm runtime + one wasm per grammar. Floor height ~ lines; cutaway with `material.clippingPlanes` + `renderer.localClippingEnabled` (core r169) | acorn / web-tree-sitter | M–L |
| 10 | Build / run mode | same data | two `Object3D.layers` sets toggled; build = sites, scaffolds, % assembled; run = traffic, sessions, harbour | none | S |
| 11 | Fireworks | merges = commits with ≥ 2 parents (`%P`), tags `git log --tags --simplify-by-decoration --format="%H %D"`; GO plan DONE = launch | GPU burst (Shopify technique: icosahedron strips, gravity, noise dissolve, one draw call) + bloom | own | S |
| 12 | **Region map** (several repos) | several `city.json` | inter-city highways = shared blob SHAs (`git ls-tree -r HEAD` in both repos, intersect), shared Vendor slugs, cross-references; cities on Land hex slots (§3.2); highway width ~ shared count | none | M — this is GitWorld L1 |
| 13 | Waypoints, quests | bookmarks (localStorage / companion); GO plan's first non-DONE WP row | marker over the site | none | S |
| 14 | **Epidemic lens** | git, **no full contents needed** | `git log -G<re> -p --unified=0 --format=%H%x09%ct` → per (commit, file) count of `+` minus `-` lines matching → running infection count per file over the replay. `-S<string>` (pickaxe) is cheaper: it only lists commits where the occurrence count changes, so follow with the diff of those commits only | none | M (cheaper than the README feared) |

---

## 9. Repo map

Metadata from ecosyste.ms on 2026-10-26 (★ = stars, push = last push). "Take" = what to reuse or
learn. Licence marks as in the header.

### 9.1 Code cities and software-as-place

| Repo | Licence | Lang | ★ | Push | Take |
|---|---|---|---|---|---|
| [MaibornWolff/codecharta](https://github.com/MaibornWolff/codecharta) | ✅ BSD-3 | Kotlin/TS | 554 | 2026-10 | treemap city with metric mapping UI, importers (SonarQube, git log, CSV), delta view; its `.cc.json` format is an interchange option for `city.json` |
| [uni-bremen-agst/SEE](https://github.com/uni-bremen-agst/SEE) | ✅ MIT | C# (Unity) | 29 | 2026-10 | collaborative code cities in VR, dependency edge bundling, evolution, debugging traces in the city; academic theses list. Unity: ideas, not code. Some plug-ins are commercial |
| [srizzon/git-city](https://github.com/srizzon/git-city) | ⛔ AGPL-3.0 | TS (R3F) | 5,812 | 2026-10 | our look source: pixel buildings, lit windows, flight mode. **Re-implement only** (already the rule) |
| [honzaap/GithubCity](https://github.com/honzaap/GithubCity) | ✅ Apache-2.0 | JS three.js | 1,296 | 2023-10 | contribution-graph city, night look, export to STL; small readable three.js |
| [hyeonsangjeon/Repolis](https://github.com/hyeonsangjeon/Repolis) | ✅ MIT | HTML, plain three.js, one `index.html` | 46 | 2026-09 | **same build style as ours**; repos as buildings, LLM "taxi" search driving the camera, night glow |
| RepoVerse ([forum](https://discourse.threejs.org/t/repoverse-turning-a-github-repo-into-a-navigable-3d-city/93702), repoverse.online) | ? no repo found | R3F | — | 2026 | procedural windows by `onBeforeCompile`, grid from instance scale not UVs; lit fraction ∝ symbol count; seeded by hash, no `Math.random`; blobless clone `--filter=blob:none`; cranes = touched this week. Ideas only |
| [cosmtrek/mindwalk](https://github.com/cosmtrek/mindwalk) | ✅ MIT | Go | 1,376 | 2026-08 | agent-session replay on a 3D code map (Claude Code, Codex); the C9 precedent; compare its transcript parsing |
| [liltrendi/gitlantis](https://github.com/liltrendi/gitlantis) | ✅ Apache-2.0 | TS three.js (VS Code ext.) | 501 | 2026-03 | project as an ocean: folders = lighthouses, files = buoys, boat navigation, minimap, compass, breadcrumbs. **Sea navigation** for our coast/abroad |
| [nitr0yukkuri/githubplanet](https://github.com/nitr0yukkuri/githubplanet) | ✅ MIT | JS three.js | 6 | 2026-10 | GitHub activity → a planet: language → terrain shader, contributions → size/stars, push webhooks → shooting stars over Socket.IO. Small, current |
| [techinz/galaxy-portfolio](https://github.com/techinz/galaxy-portfolio) | ⛔ personal non-commercial | TS (R3F) | 96 | 2025-06 | 7-scene zoom galaxy → desk with a scene manager, shader precompile to 1×1 targets. Learn the pattern only |
| [glato/emerge](https://github.com/glato/emerge) | ✅ MIT | Python + d3 | 1,172 | 2026-08 | dependency graphs + metrics (fan-in/out, Louvain modularity, code churn) for many languages; good test oracle for our import scan |
| [git-truck/git-truck](https://github.com/git-truck/git-truck) | ✅ MIT | TS | 774 | 2026-09 | truck factor / author lenses, circle-packing of folders; colour schemes for owners |
| [githubocto/repo-visualizer](https://github.com/githubocto/repo-visualizer) | ✅ MIT, archived | JS | 1,310 | 2026-01 | circle-packing SVG per commit in Actions; colour-by-extension table |
| [acaudwell/Gource](https://github.com/acaudwell/Gource) | ⛔ GPL-3.0 | C++ | 13,174 | 2026-03 | commit replay as a growing tree with avatars flying to files: the "light hops" feel. Idea only |
| [aserg-ufmg/JSCity](https://github.com/aserg-ufmg/JSCity) | ⛔ GPL-2.0 | JS three.js | 1,401 | 2019-11 | JS functions as buildings: **interiors precedent** (§8.2 #9). Idea only |
| [stefanrinderle/softvis3d](https://github.com/stefanrinderle/softvis3d) | ⚠ LGPL-3.0, archived | TS three.js | 62 | 2023-09 | SonarQube city + dependency view (edge bundling) |
| [softvis-research/Getaviz](https://github.com/softvis-research/Getaviz) | ✅ Apache-2.0 | Java + web | 53 | 2023-04 | generator for many metaphors (city, RD, city floors) to A-Frame/X3D; evaluation setups |
| [ExplorViz/frontend](https://github.com/ExplorViz/frontend) | ✅ Apache-2.0 per 2020 paper metadata (no licence file found: verify) | TS three.js | 6 | 2026-10 | **software landscape of many apps** + live traces + semantic zoom + mini-map (arXiv 2510.00003), HTML structure as cities (2510.00004). Closest academic match to GitWorld L1 |
| [babiaxr/aframe-babia-components](https://github.com/babiaxr/aframe-babia-components) | ⛔ GPL-3.0 (GitLab mirror) | JS A-Frame | 18 | 2025-08 | CodeCity with evolution, layout kept stable across time. Idea only |
| [codemetropolis/CodeMetropolis](https://github.com/codemetropolis/CodeMetropolis) | ⚠ no licence file | Java | 13 | 2025-02 | Minecraft city from SourceMeter metrics (U. Szeged); gardens/outposts for **test metrics** (cf. weather) |
| [DeathStar3/varicity](https://github.com/DeathStar3/varicity) | ⚠ LGPL-3.0 | Java/TS | 5 | 2021-10 | variability "streets" from entry points: start-from-the-gate layout (cf. §7.1 #1) |
| [CoatiSoftware/Sourcetrail](https://github.com/CoatiSoftware/Sourcetrail) | ⛔ GPL-3.0, archived · fork [petermost/Sourcetrail](https://github.com/petermost/Sourcetrail) active 2026-09 | C++ | 16,466 | 2021-12 | symbol graph + code side by side: the "library ↔ code" and interiors navigation pattern |
| [rboyd/metric-hero](https://github.com/rboyd/metric-hero) | ⚠ no licence | JS | 14 | 2013 | historical curiosity: files as buildings, commit-time height |
| Wettel CodeCity | ⚠ Smalltalk/Moose, 2014, no clear licence | Smalltalk | — | 2014 | the original metaphor and packing layout (VISSOFT 2007); scripting-only |
| Code Park (Khaloo et al., VISSOFT 2017, arXiv 1708.02174) | no public code found | Unity | — | — | classes as rooms with code on the walls, overview ↔ first-person: **interiors** |
| EvoStreets (Steinbrückner & Lewerentz, BTU Cottbus) | no public code found | — | — | — | stable street layout across versions; stability comparison vs Wettel packing |
| VR-City, CityVR, IslandViz (DLR, islands = OSGi bundles, VISSOFT 2018/2020) | no public code found | Unity | — | — | **islands in an ocean** = the GitWorld "countries" metaphor; history via dynamic graph layout |
| "Gitropolis", "AgentCity" (named in README §2) | **not found** in this pass | — | — | — | the earlier research's names could not be re-verified; ask which repos they were |

### 9.2 Git history and dependency mining (data, not pictures)

| Repo | Licence | Lang | ★ | Push | Take |
|---|---|---|---|---|---|
| [sverweij/dependency-cruiser](https://github.com/sverweij/dependency-cruiser) | ✅ MIT | JS | 7,303 | 2026-10 | rule engine (`no-circular`, `no-orphans`, forbidden paths) → jams, orphans; validate our regex imports |
| [pahen/madge](https://github.com/pahen/madge) | ✅ MIT | JS | 10,176 | 2026-01 | `--circular`, `--orphans`, `--depends` (reverse deps = blast-radius oracle) |
| [adamtornhill/code-maat](https://github.com/adamtornhill/code-maat) | ⛔ GPL-3.0 | Clojure | 2,641 | 2025-07 | coupling, hotspots, age, main developer: **the algorithms are described in "Your Code as a Crime Scene"**; re-implement |
| [smontanari/code-forensics](https://github.com/smontanari/code-forensics) | ⛔ GPL-3.0 | JS | 406 | 2023-01 | hotspot / coupling / knowledge-map reports (circle packing) |
| [src-d/hercules](https://github.com/src-d/hercules) | ✅ Apache-2.0 | Go | 2,811 | 2023-02 | burndown (line survival), couples, ownership over time → "Kor" lens and foundation stones |
| [erikbern/git-of-theseus](https://github.com/erikbern/git-of-theseus) | ✅ Apache-2.0 | Python | 2,972 | 2023-11 | cohort survival of lines per year: a strata/geology lens |
| [tomgi/git_stats](https://github.com/tomgi/git_stats) | ✅ MIT | Ruby | 1,082 | 2025-11 | stats pages (authors, activity by hour) → newspaper |
| [hoxu/gitstats](https://github.com/hoxu/gitstats) | ⛔ GPLv2+ | Python | 1,676 | 2024-03 | same, older |
| [isomorphic-git/isomorphic-git](https://github.com/isomorphic-git/isomorphic-git) | ✅ MIT | JS | 8,377 | 2026-10 | git in the browser, if the page ever reads a repo without Node |
| [tree-sitter/tree-sitter](https://github.com/tree-sitter/tree-sitter) (`web-tree-sitter` 0.27.1) | ✅ MIT | Rust/wasm | 27,214 | 2026-10 | multi-language outlines via `tags.scm` → floors |
| [acornjs/acorn](https://github.com/acornjs/acorn) (8.19.0) | ✅ MIT | JS | 11,463 | 2026-10 | JS AST for floors and cracks; single file, vendorable |
| [errwischt/stacktrace-parser](https://github.com/errwischt/stacktrace-parser) | ✅ MIT | JS | 119 | 2026-10 | repair tunnel |
| [graphology/graphology](https://github.com/graphology/graphology) | ✅ MIT | JS | 1,763 | 2026-09 | graph object + traversal, shortest path, components, metrics, ForceAtlas2 |
| [anvaka/ngraph.path](https://github.com/anvaka/ngraph.path) | ✅ MIT | JS | 3,134 | 2026-07 | A*, NBA* path finding → metro |
| [anvaka/ngraph.forcelayout](https://github.com/anvaka/ngraph.forcelayout) | ✅ BSD-3 | JS | 215 | 2026-10 | n-dimensional force layout (one-time placement of regions / foreign repos) |
| [paulmillr/chokidar](https://github.com/paulmillr/chokidar) | ✅ MIT | TS | 12,253 | 2026-10 | file watching (or plain `fs.watch` recursive on Windows) |

### 9.3 Globes, maps and geography

| Repo | Licence | Lang | ★ | Push | Take |
|---|---|---|---|---|---|
| [vasturiano/three-globe](https://github.com/vasturiano/three-globe) (2.45.6) | ✅ MIT | JS | 1,640 | 2026-10 | arcs/paths/rings/hex/labels layers as an `Object3D`; peer `three >=0.154` (r169 OK) |
| [vasturiano/globe.gl](https://github.com/vasturiano/globe.gl) (2.46.2) | ✅ MIT | JS | 3,203 | 2026-08 | **needs three ≥0.179**: read the examples only |
| [vasturiano/3d-force-graph](https://github.com/vasturiano/3d-force-graph) / [three-forcegraph](https://github.com/vasturiano/three-forcegraph) | ✅ MIT | JS | 6,482 / 302 | 2026-09 | region map as a graph; directional particles on links = flow particles |
| [arscan/encom-globe](https://github.com/arscan/encom-globe) | ✅ MIT | JS | 1,162 | 2025-03 | **Tron: Legacy globe**: hex tiles, satellites, markers, intro animations |
| [arscan/hexasphere.js](https://github.com/arscan/hexasphere.js) | ✅ MIT | JS | 276 | 2022-07 | hex/pent tiling of the sphere: planet tiles, country cells |
| [dataarts/webgl-globe](https://github.com/dataarts/webgl-globe) | ✅ Apache-2.0, archived | JS | 3,767 | 2020-09 | classic spikes-on-globe |
| [anvaka/map-of-github](https://github.com/anvaka/map-of-github) | ✅ MIT (code; attribute the data) | JS | 2,874 | 2025-12 | **GitHub as countries**: Jaccard on stargazers → clusters → force layout → GeoJSON → tippecanoe → MapLibre; LLM-named countries |
| [anvaka/pm](https://github.com/anvaka/pm) | ✅ MIT | JS | 1,788 | 2026-06 | package-manager galaxies (npm, Go, PyPI…) in 3D: ecosystem continents |
| [anvaka/city-roads](https://github.com/anvaka/city-roads) | ✅ MIT | JS | 9,763 | 2026-10 | rendering millions of road segments in WebGL |
| [Fil/d3-geo-voronoi](https://github.com/Fil/d3-geo-voronoi) | ✅ ISC | JS | 277 | 2026-03 | **spherical Voronoi + Urquhart graph** |
| [mapbox/delaunator](https://github.com/mapbox/delaunator) | ✅ ISC | JS | 2,635 | 2026-06 | flat Delaunay (Land map) |
| [uber/h3-js](https://github.com/uber/h3-js) | ✅ Apache-2.0 | JS | 1,090 | 2026-10 | hex index on the sphere |
| [redblobgames/mapgen4](https://github.com/redblobgames/mapgen4) | ✅ Apache-2.0 | TS | 925 | 2026-03 | dual-mesh elevation, rivers, fast WebGL map |
| [mewo2/terrain](https://github.com/mewo2/terrain) | ✅ MIT | JS | 3,044 | 2016-08 | small, explained fantasy-map pipeline (erosion, coast, cities, labels) |
| [Azgaar/Fantasy-Map-Generator](https://github.com/Azgaar/Fantasy-Map-Generator) | ✅ MIT (2017–24) | JS | 6,134 | 2026-10 | full country/state/burg/route generator; heightmap templates; cultures, names |
| [ProbableTrain/MapGenerator](https://github.com/ProbableTrain/MapGenerator) | ⚠ LGPL-3.0 | TS | 1,475 | 2024-05 | tensor-field street networks for suburbs |
| [watabou/TownGeneratorOS](https://github.com/watabou/TownGeneratorOS) | ⛔ GPL-3.0 | Haxe | 1,948 | 2021-01 | medieval town wards and walls: wall + gates (cf. §7.1 #1). Idea only |
| [CesiumGS/cesium](https://github.com/CesiumGS/cesium) | ✅ Apache-2.0 | JS | 15,862 | 2026-10 | real globe, 3D Tiles; heavy |
| [visgl/deck.gl](https://github.com/visgl/deck.gl) | ✅ MIT | TS | 14,700 | 2026-10 | ArcLayer, TripsLayer, GlobeView |
| [visgl/flowmap.gl](https://github.com/visgl/flowmap.gl) | ✅ Apache-2.0 | TS | 141 | 2026-10 | flow aggregation and clustering by zoom |
| [maplibre/maplibre-gl-js](https://github.com/maplibre/maplibre-gl-js) (6.16.0) | ✅ BSD-3 | TS | 11,900 | 2026-10 | globe + three.js custom layer (official example) |
| [protomaps/PMTiles](https://github.com/protomaps/PMTiles) | ✅ BSD-3 (verify) | TS | 3,088 | 2026-09 | single-file offline tiles |
| [felt/tippecanoe](https://github.com/felt/tippecanoe) | ✅ BSD-2 | C++ | 1,623 | 2026-09 | GeoJSON → vector tiles |
| [NASA-AMMOS/3DTilesRendererJS](https://github.com/NASA-AMMOS/3DTilesRendererJS) | ✅ Apache-2.0 | JS | 2,500 | 2026-10 | LOD streaming in three.js |
| [tentone/geo-three](https://github.com/tentone/geo-three) | ✅ MIT | TS | 958 | 2026-04 | tile LOD on a sphere/plane in three.js |
| [takram-design-engineering/three-geospatial](https://github.com/takram-design-engineering/three-geospatial) | ✅ MIT | TS | 1,743 | 2026-05 | atmosphere, clouds, stars (three.js) |
| [jscastro76/threebox](https://github.com/jscastro76/threebox) | ⚠ "other" (fork) | JS | 689 | 2026-07 | three.js in Mapbox/MapLibre custom layers |

### 9.4 Flows, network and live system data

| Repo | Licence | Lang | ★ | Push | Take |
|---|---|---|---|---|---|
| [Netflix/vizceral](https://github.com/Netflix/vizceral) | ✅ Apache-2.0, unmaintained | JS (WebGL) | 4,100 | 2023-11 | **global → region → service zoom with traffic particles**, error-coloured flows: the GitWorld precedent |
| [GyulyVGC/sniffnet](https://github.com/GyulyVGC/sniffnet) | ✅ Apache-2.0 | Rust | 41,687 | 2026-10 | per-host/country traffic with MaxMind geo: the "abroad" mapping; needs Npcap |
| [imsnif/bandwhich](https://github.com/imsnif/bandwhich) | ✅ MIT | Rust | 12,009 | 2026-08 | per-process bandwidth; Windows via WinAPI + **Npcap** (precise mode) |
| [sebhildebrandt/systeminformation](https://github.com/sebhildebrandt/systeminformation) | ✅ MIT | JS | 3,137 | 2026-10 | CPU, RAM, disks, NICs, network stats/connections, USB, Bluetooth, processes from Node: the Erőmű / USB / programs feed |
| [node-usb/node-usb](https://github.com/node-usb/node-usb) | ✅ MIT | TS | 1,655 | 2026-10 | USB hotplug events |
| [sapics/ip-location-db](https://github.com/sapics/ip-location-db) | ⚠ data licences vary (CC0 / CC-BY / GeoLite2 EULA) | data | 2,226 | 2026-10 | IP → country/ASN offline |
| [NSkelsey/monopticon](https://github.com/NSkelsey/monopticon) | ⛔ GPL-3.0 | C++ | 66 | 2020 | 3D live Ethernet monitor (Zeek); look only |
| [gpp256/glNetViz](https://github.com/gpp256/glNetViz) | ✅ MIT | JS | 6 | 2013 | WebGL network topology + traffic, tiny |
| [pingcap/ossinsight](https://github.com/pingcap/ossinsight) | ✅ Apache-2.0 | TS | 2,512 | 2026-09 | GitHub event analytics API (trends, collections) for the planet |
| [igrigorik/gharchive.org](https://github.com/igrigorik/gharchive.org) | ✅ MIT | Ruby | 3,084 | 2025-05 | hourly public GitHub timeline dumps |
| [github/gh-skyline](https://github.com/github/gh-skyline) | ✅ MIT | Go | 1,364 | 2026-10 | contribution skyline as a 3D-printable model |
| [spotify/web-api-examples](https://github.com/spotify/web-api-examples) | ✅ Apache-2.0 | JS | 2,074 | 2024-07 | PKCE auth flow, if the stadium ever uses the API |

### 9.5 three.js helpers and Tron look

| Repo | Licence | Lang | ★ | Push | Take |
|---|---|---|---|---|---|
| [mrdoob/three.js](https://github.com/mrdoob/three.js) r169 (vendored) | ✅ MIT | JS | 116,710 | 2026-10 | core + the addons listed in §2 |
| [yomotsu/camera-controls](https://github.com/yomotsu/camera-controls) | ✅ MIT | TS | 2,437 | 2026-10 | smooth fly-to / fit transitions between levels |
| [tweenjs/tween.js](https://github.com/tweenjs/tween.js) | ✅ MIT | TS | 10,149 | 2026-10 | tweens (also in r169 `libs/`) |
| [gkjohnson/three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | ✅ MIT | JS | 3,527 | 2026-10 | fast raycasts on big merged meshes (planet, Land) |
| [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing) | ✅ zlib | JS | 2,899 | 2026-10 | faster selective bloom, outline and god rays than the examples' EffectComposer (check that the pinned version supports r169) |
| [Fyrestar/THREE.InfiniteGridHelper](https://github.com/Fyrestar/THREE.InfiniteGridHelper) | ✅ MIT | JS | 172 | 2023-02 | anti-aliased infinite grid shader (Tron floor) |
| [creativelifeform/three-nebula](https://github.com/creativelifeform/three-nebula) (13.3.0) | ✅ MIT | JS | 1,238 | 2026-10 | particle engine: smoke, weather, fireworks |
| [jwagner/simplex-noise.js](https://github.com/jwagner/simplex-noise.js) | ✅ MIT | TS | 1,852 | 2024-07 | coastline / terrain noise |
| [stegu/psrdnoise](https://github.com/stegu/psrdnoise) | ✅ MIT (GLSL) | GLSL | 328 | 2023-03 | tiling flow noise used in Shopify's globe shader |
| [mkkellogg/TrailRendererJS](https://github.com/mkkellogg/TrailRendererJS) | ⚠ no licence file | JS | 191 | 2024-06 | object trails; idea only until licensed |
| [Anemolo/Infinite-Lights](https://github.com/Anemolo/Infinite-Lights) | ⚠ no licence file | JS | 252 | 2019-11 | Codrops light trails; idea only |
| [mrdoob/stats.js](https://github.com/mrdoob/stats.js) | ✅ MIT | JS | 9,150 | 2024-10 | FPS for the GitHub-globe-style adaptive quality tiers |

---

## 10. Techniques worth copying verbatim (as ideas; all from public write-ups)

- **Adaptive quality tiers** (GitHub globe): average FPS over 50 frames; below 55.5, step down one of
  4 tiers: pixel ratio 2 → 1.5, arc spawn rate ×⅔, raycast every +4 frames, dot density ×0.65 (rebuild).
- **Initial orientation without geolocation**: rotate the globe by `π·(timezoneOffset/720)`.
- **Perceived load**: show a static gradient image, crossfade to the canvas in 600 ms (Web Animations API).
- **Windows by shader, not texture** (RepoVerse, and our C3): window grid from instance scale; lit
  fraction per instance.
- **Determinism**: seed everything from a hash of the path; no `Math.random()` in layout.
- **Blobless clone for history only** (`--filter=blob:none --no-checkout`): for scanning foreign repos
  on the planet without downloading contents.

---

## 11. Open questions for the user

1. GitWorld placement: ecosystem continents (P1), Map-of-GitHub coordinates (P2), or dependency
   distance (P3), or the proposed mix?
2. Is a GitHub token acceptable for the world fetcher (5,000/h, free 304s), or must it stay
   unauthenticated (60/h, snapshot refreshed rarely)?
3. Live session traffic through Claude Code **hooks** (a settings change) or by tailing transcripts?
4. Router counters: may UPnP be switched on on the TP-Link (it opens port mapping to LAN programs), or
   stay with the PC's NIC counters?
5. "Precise network mode" with Npcap (installer, admin): wanted at all?
6. Which repos were "Gitropolis" and "AgentCity" in README §2? Neither could be found in this pass.

## 12. Sources

- Kódváros: `docs/city/README.md` §2, §7.1, §7.2; `CodeCity/build.js`; `CodeCity/from-kapu/README.md`,
  `companion-server.js`; `vendor-manifest.json`; `Vendor/three` (0.169.0);
  `docs/research/2026-10-26_router-usb-phone-wake.md`.
- GitHub globe: https://github.blog/engineering/how-we-built-the-github-globe
- Shopify BFCM 2023 globe: https://shopify.engineering/how-we-built-shopifys-bfcm-2023-globe
- Galaxy portfolio zoom: https://discourse.threejs.org/t/galaxy-portfolio-an-interactive-zoom-journey-from-milky-way-to-desk/82229
- Log-depth cost: https://discourse.threejs.org/t/beware-of-logarithmic-depth-buffer-it-can-degrade-scene-performance/88495 ·
  reversed depth: https://discourse.threejs.org/t/reverse-z-infinite-projection/88394 , https://threejs.org/examples/webgl_reverse_depth_buffer.html
- Floating origin: https://discourse.threejs.org/t/camera-and-floating-point-origin/51486
- RepoVerse: https://discourse.threejs.org/t/repoverse-turning-a-github-repo-into-a-navigable-3d-city/93702 ·
  Repolis: https://discourse.threejs.org/t/repolis-a-walkable-three-js-city-for-github-repos/92391 ·
  GitHub Planet: https://discourse.threejs.org/t/github-planet-turn-your-github-activity-into-a-living-3d-planet/93235
- Semantic zoom + mini-maps for software cities (ExplorViz): https://arxiv.org/abs/2510.00003
- Software cartography (Kuhn et al.): https://arxiv.org/pdf/1209.5490
- IslandViz: https://www.dlr.de/en/sc/research-transfer/projects/islandviz ·
  VISSOFT 2020: https://conferences.computer.org/icsme/pdfs/VISSOFT2020-21GoJXGHj7IxcVsXivi2jW/991400a012/991400a012.pdf
- Code Park: https://arxiv.org/abs/1708.02174 · EvoStreets: https://opus4.kobv.de/opus4-btu/frontdoor/index/index/docId/1681
- Map of GitHub: https://raw.githubusercontent.com/anvaka/map-of-github/main/README.md
- d3-geo-voronoi: https://unpkg.com/d3-geo-voronoi@2.1.0/README.md
- MapLibre three.js on globe: https://maplibre.org/maplibre-gl-js/docs/examples/add-a-3d-model-to-globe-using-threejs/
- deck.gl TripsLayer: https://deck.gl/docs/api-reference/geo-layers/trips-layer
- Spline in DataTexture: https://discourse.threejs.org/t/spline-datatexture/14252
- Codrops light trails: https://tympanus.net/codrops/2019/11/13/high-speed-light-trails-in-three-js/
- GitHub REST rate limits: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api ·
  best practices (304s): https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api ·
  SBOM: https://docs.github.com/en/rest/dependency-graph/sboms
- deps.dev API v3: https://docs.deps.dev/api/v3/index.html
- ecosyste.ms pricing / pools: https://ecosyste.ms/pricing , https://docs.ecosyste.ms/docs/usage/
- Software Heritage API: https://docs.softwareheritage.org/devel/apidoc/swh.web.api.views.graph.html
- UPnP WANCommonInterfaceConfig: https://upnp.org/specs/gw/UPnP-gw-WANCommonInterfaceConfig-v1-Service.pdf ·
  TP-Link UPnP FAQ: https://www.omadanetworks.com/uk-ua/support/faq/4624/
- Spotify 2026 dev-mode changes: https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide ,
  https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates
- Claude Code hooks: https://docs.claude.com/en/docs/claude-code/hooks
- Vizceral: https://github.com/Netflix/vizceral · bandwhich README (Npcap note): https://github.com/imsnif/bandwhich
- Repo metadata: https://repos.ecosyste.ms/api/v1/hosts/GitHub/repositories/{owner}%2F{repo} (2026-10-26)
