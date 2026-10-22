# Ideas from God's Eye View — for Kódváros and the VRG Dashboard

*2026-10-22. Source: `bilawalsidhu/gods-eye-view` @ v0.2.1 (aa16b7c), fetched to `Vendor/gods-eye-view`
via `vendor-manifest.json`. Code MIT (c) 2026 Bilawal Sidhu; its data and 3D models are NOT (CC BY-NC-SA,
CC BY-NC, ODbL, per-model) — ideas and code only, never its data.*

GEV is a live 3D globe (CesiumJS, vanilla JS, Node proxy): flights, ships, satellites, cameras,
weather; sensor looks (FLIR, NVG, CRT, Noir); click-to-track with trails; a cockpit view; a scene
director for camera tours; share links; a client-side analyst engine; a voice agent with ~30 tools,
also exposed as an MCP server; strict cost caps; an idle render governor.

## A. Best candidates for Kódváros (★ = adopted into the WP plan)

| # | GEV feature (file) | Kódváros version | WP |
|---|---|---|---|
| 1 ★ | Sensor looks on keys 1–7 (`styles/thermal.js`, `noir.js`…) | **Lenses as looks**: 1 normal · 2 *Ironbow* = churn heat · 3 *NVG* = agent share glows green · 4 *Noir* = age, stale goes grey · 5 owner · 6 language | C5 |
| 2 ★ | Split-flap status chips (`splitFlap.js`) | **Commit departure board**: during replay the title bar flips to the commit being played (`a3f9c1 · Planner: UI tidy`) | C4 |
| 3 ★ | Share links (`sharelink.js`) — camera+style+layers+target in `#hash` | `#cam=…&lens=…&t=…&sel=path` — Kapu, the Dashboard or a chat can deep-link straight to a building at a commit | C3 |
| 4 ★ | Timeline Step / Play / Latest (observed weather) | The replay controls, same three verbs | C4 |
| 5 ★ | Interpolate one interval behind (dead reckoning) | Tween heights/colours between commits instead of jumping | C4 |
| 6 ★ | Analyst engine (`data/analystEngine.js`) — pure queries over data already loaded, results = stable ids | **Query bar** without an LLM: `legnagyobb Planner`, `csak Claude`, `nem nyúlt 1 éve` → result list + highlights | C7 |
| 7 ★ | Detection overlay `D` — brackets + IDs on visible objects, density slider | Brackets on the query results / top hotspots in view | C7 |
| 8 ★ | HUD summary + locality "NEAR <landmark>" (`hudLocality.js`) | Bottom HUD line: `KÖRZET Planner/src · 12 forró fájl · NEAR main.js` (landmark = most-imported file) | C7 |
| 9 ★ | Scene Director (shots: camera + visual + layers, hold, playback queue, JSON scene doc v5) | **Városnézés**: authored tours ("this is the Planner district…") for onboarding a colleague; JSON, playable, exportable to video later | C8 |
| 10 ★ | Contacts panel — roster of what is near the tracked target | **Szomszédok**: files that change together with the selected one | C6 |
| 11 ★ | Click-to-track with fading trail | Follow an author or agent through the replay: a trail hops building to building | C9 |
| 12 ★ | Tools defined once → MCP + function calling; `show_in_gods_eye_view` returns a view | Kódváros as an MCP server: Claude answers "where is the agent rework?" with a city view link | C10 ⏸ |
| 13 | Render governor (ref-counted "holds" switch continuous ↔ on-demand) | We render on demand already; adopt the *hold* API when replay animates | C4 |
| 14 | Scope mask / vignette (`scopeMask.js`), bloom | Cheap CSS vignette + emissive windows for the night look | C3 |
| 15 | Layer panel groups (Movement, Cameras, Infrastructure, Events, Weather) | Lens panel groups: Szerkezet · Idő · Emberek · Minőség · Kapcsolatok | C5 |
| 16 | Honest feeds ("answers note stale feeds") | Freshness badge: `scan 3 napos · 5 commit lemaradás` | C3 |
| 17 | Cockpit view | Street-level ride along an import road — fun, low value; parked | — |
| 18 | Weather layers | CI/test runs as storms over districts — needs CI data; parked | — |

## B. Creative uses for the VRG Dashboard (the page VRG Kapu leads to)

1. **The Gate has a departure board.** Kapu = gate, so the Dashboard opens with a split-flap
   *Indulások* board: today's site visits, crew departures, deliveries, quote deadlines — flipping
   like an airport/ferry terminal. One signature visual that also carries real information.
2. **Sensor looks as business lenses.** Same keys 1–7: *Ironbow* = margin heat per job, *NVG* =
   after-hours BRIDGE alarms and device events, *Noir* = archive and closed jobs, normal = today.
3. **Live contacts = live jobs.** Jobs and crews as tracked contacts on a Hungary map
   (OSM/keyless). Click-to-track a job: trail of site visits, materials delivered, status
   telemetry. Contacts panel = "jobs within 30 km" for route planning.
4. **Five-word HUD.** A one-line summary that rewrites itself as you move: `3 MUNKA KÉSIK ·
   2 AJÁNLAT VÁR`.
5. **Analyst query bar, offline.** "melyik ajánlat vár 7 napja?", "P33 anyagköltség" — structured
   queries over the data already loaded (Inventory, quotes, plans), results bracketed on the board.
6. **Monday briefing as a Director tour.** An authored sequence of views for the weekly meeting,
   played on the office TV or stepped with the **Planner CYD** as a remote (GEV's camera verbs).
7. **Business City.** Reuse the Kódváros engine: departments of the Business Topology are
   districts, programs are buildings, lit windows = activity this week, cranes = in development.
   One engine, two cities.
8. **Dispatch through tools.** The ◇ Dispatch agent of the topology gets GEV's pattern: tools
   defined once, exposed to MCP; "show me" answers return a Dashboard view link; *honest actions*
   (only report what succeeded) and an **AI spend meter** with warning/cap, per department.
9. **Freshness on every tile.** GEV-style stale-feed honesty: `Készlet árak 12 napja frissültek`.
10. **Idle wallboard.** The render governor idea: a TV dashboard that costs ~0 GPU when nothing
    changes.
11. **Site weather.** Keyless forecast (Open-Meteo) on outdoor jobs: rain tomorrow → reschedule
    roof-box work. Small, practical, and very GEV.

*Dashboard items belong to the Kapu pack (`docs/hub/`, branch `secacc`); copy this section there when
the Dashboard gets its own WPs.*
