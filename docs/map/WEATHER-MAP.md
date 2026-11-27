# VRG Térkép: the weather layer (W)

*Built 2026-11-20. The weather that VRG Időjárás fetches from online sources, drawn and animated on the VRG Térkép
in the Terep look, every layer on its own toggle, all of them overlaid.*

## Using it

| Key / control | What it does |
|---|---|
| **W** or the **Időjárás** button | the layer on or off (remembered); `?wx=1` turns it on at load, `?wx=0` hides the button |
| layer chips | each layer on or off independently (remembered); a dimmed chip has no data right now |
| **Előrejelzés (48 óra)** / **Mérés (3 óra)**, key **M** | the forecast fields, or the stations' last 3 hours |
| ▶ / **P** | play the timeline (looping), **[** **]** step an hour (10 min in measured mode), **Most** back to now |
| ◐ | opacity of the fields and the radar |
| **Frissítés** | runs VRG Időjárás's `terkep` pipeline (the online sources), then reloads; not in guest mode |
| cursor | readout under the pointer: temperature, wind direction and speed, gust, rain, cloud at the timeline's moment |
| a station | click it for its card (time, temperature, humidity, wind, gust, rain in the last hour, pressure) |

## The layers, bottom to top

| Layer | Drawn as | Data |
|---|---|---|
| Hőmérséklet | translucent field, steel blue (frost) → paper → burnt orange → red | forecast grid / measured IDW |
| Felhőzet | a grey veil with a cloud texture drifting with the wind | forecast grid |
| Széllökés-sávok | bands at the rule limits: 7.6 (ladder, tower) amber, 10 (roof) orange, **12.5 m/s (MEWP, EN 280) hatched red** | forecast grid / measured |
| Csapadék | blue → violet → magenta on a square-root scale, with rain-cell texture drifting with the wind | forecast grid / measured |
| Radar | the HungaroMet composite frames, cross-faded; shown while the timeline is inside their hour | `hungaromet-radar` (off until its folder is confirmed) |
| Figyelmeztetések | the warning area tinted by level, dashed edge, orange/red ones breathing; label pill | MeteoAlarm (CAP) |
| Munkák kockázata | a ring around each job pin with an open weather alert in the next 24 h, red ones pulsing; a line in the job card | VRG Időjárás alerts (**client data**: only with the J layer) |
| Villámok | the last hour's strikes, coloured by age (white-yellow → red), the newest pulsing outward | `hungaromet-lightning` |
| Szél | particles flowing with the wind; ink for light wind, orange from 7 m/s, red from 11 m/s | forecast grid u/v / measured |
| Mérőállomások | a chip with the temperature in its colour, a wind arrow (length = speed, red at MEWP gusts), ↯gust, rain mm | HungaroMet 10-minute readings |

Readings and strikes are of *now*: they fade while the timeline is more than 45 minutes away from now.

The Terep basemap stays light in both colour schemes (REFINE R11), so the weather palette is the same in dark mode.
Every field is translucent, so the streets and labels show through. The fields are drawn below the labels, and the
3D buildings stand above them.

## Data flow

```
online sources ──► VRG Időjárás (Weather/)            ──► Weather/data/weather.sqlite
                    fetch open-meteo-grid | met-no-grid      grid_frame (Float32 per var and hour)
                    fetch hungaromet-obs → obs-idw grid      observation, station, strike, warning, radar_frame
                    fetch hungaromet-lightning / -radar      alert (per job site)
                    meteoalarm, alerts
                                                       ──► Map/serve.js /weather/* (read-only, Weather/lib/maplayers.js)
                                                       ──► Map/lib/weather-layer.js + weather-fields.js (the page)
```

- **Forecast fields.** The map uses Open-Meteo on a 0.25° grid (four requests, multi-point) when the licence gate
  lets it run, which needs a key or `use: evaluation`. Otherwise it uses MET Norway on a 0.5° grid: 105 points,
  at most 4 requests a second, each honouring its own Expires. MET Norway is allowed for company use. Both cover
  3 hours back to 48 hours ahead, hourly, with t2m, precip, cloud, u/v, gust and cape.
- **Measured fields.** The HungaroMet stations are interpolated (inverse distance) onto a 0.1° grid, one frame
  every 10 minutes for the last 3 hours, rebuilt at every station fetch.
- **Schedule.** The `modell` pipeline fetches both grids hourly. `gyors` fetches stations, lightning, radar and
  warnings every 15 minutes. `terkep` fetches all of it and is what the map's **Frissítés** runs (also START W → I → M).
- **Payloads.** Fields go over the wire as Int16 per frame (base64), about 0.75 KB per variable and hour on the
  0.25° grid. The page decodes them once and interpolates in space (bilinear) and time (linear) on every frame.
- **Drawing.** Each field is a MapLibre canvas source laid out in Web Mercator rows, painted through a 1024-step
  colour table. All four fields take about 11 ms per redraw. Particles and station chips are 2D canvases inside
  the map's canvas container, so markers and popups stay above them.

## Privacy and switches

- **The job weather** (`/weather/jobs`, the rings, the card line) is client data. It follows the job layer's
  switches: the registry `jobsLayer`, the flag file `TERKEP-KI`, OTG, guest mode and `?embed=1`. Every request is
  written to the job layer's access log with `what: "weather"`.
- **The rest is public weather data.** It shows in guest mode too, without the Frissítés button.
- **Kill switch:** `"weatherLayer": false` on START's M entry turns the whole layer off on the server.
- **Licences:** the panel shows every used source's attribution. In `evaluation` mode a **KIÉRTÉKELÉS** badge
  marks that non-commercial sources are on screen.

## Tests

```bash
node Map/test/run.js weather
```

`weather.test.js` covers the routes, the switches, the job-weather log and the POST guard. `weather-page.test.js`
runs headless Chrome over CDP and covers the panel, toggles, timeline, painted canvases, job rings, guest mode,
`?wx=0` and that no exceptions are thrown.

The page test needs chrome-headless-shell (`$CHROME` or `H:\VRG\Full\tools\chrome-headless-shell`) and
`Vendor/maplibre-gl`. It runs on a **stub basemap**, a valid PMTiles file with no tiles, so it needs no 1.7 GB
download. The weather is invented by `Weather/test/fixtures-map.js`: a cold front crossing Hungary, about 40
stations, a moving lightning cluster and radar frames.

## Open

| # | What |
|---|---|
| WM1 | Warning areas are circles around county centres (`Weather/config/areas.json`). The county polygons could be cut from `Map/data/src/hungary-latest.osm.pbf` (admin_level 6) by a `Map/tools/build-areas.js`. |
| WM2 | Radar: confirm the odp.met.hu folder, file pattern and box (`sources.json` hungaromet-radar), then `enabled: true` (report W2). |
| WM3 | Lightning: confirm the LINET file pattern (report W2); until then the layer stays empty. |
| WM4 | Pass VRG Időjárás's hourly point consensus to the job rings at the timeline's hour, not only "next 24 h". |
| WM5 | On the phone the panel is a bottom sheet; with the J legend also open, the two stack. |
