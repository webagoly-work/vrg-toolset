# 02 - Global free / keyless weather APIs for VRG Weather

Read 2026-11-18 by Akecheta. Budget: ~25 tool calls.

## READ THIS FIRST - what this file is and is not

- Every WebFetch to an API host or docs host failed with `getaddrinfo ENOTFOUND`
  (api.open-meteo.com, open-meteo.com, api.met.no, api.rainviewer.com, www.rainviewer.com).
  These hosts are not on the session's allowed-domain list. **No live API response was captured.**
- All "SOURCE SAYS" items below come from WebSearch result summaries (a model's summary of the
  page, not the page text). Treat them as secondhand until re-read on the live page.
- Items marked **[RECALL, UNVERIFIED]** are from the author's background knowledge, not read today.
  **Do not write test fixtures from them without a live capture.** Re-run the fetches once the hosts
  are allowed (api.open-meteo.com, open-meteo.com, ensemble-api.open-meteo.com,
  air-quality-api.open-meteo.com, archive-api.open-meteo.com, flood-api.open-meteo.com, api.met.no,
  docs.api.met.no, api.rainviewer.com, rainviewer.com, re.jrc.ec.europa.eu, power.larc.nasa.gov, dev.meteostat.net).
- `node tools/vrg-ctx.js q` returned "No index yet"; nothing in the project was usable as prior knowledge.
- No client names or job details were used in any search.

## 1. Open-Meteo  (verdict: CORE)

### Source says
- Terms: free API only for non-commercial use; under 10,000 calls/day, 5,000/hour, 600/minute.
  Commercial use or more calls -> paid plan. https://open-meteo.com/en/terms (via search summary, 2026-11-18)
- Paid plans (official announcement, Substack): Standard $29/month = 1M calls; Professional $99/month = 5M calls;
  Enterprise by negotiation. https://openmeteo.substack.com/p/api-subscriptions-for-commercial (via search, 2026-11-18).
  Aggregators give conflicting prices (EUR 4.99, EUR 15) - ignore; check https://open-meteo.com/en/pricing.
- Homepage: "No API key required" for the free tier. https://open-meteo.com/ (search, 2026-11-18)
- ICON: ICON-D2 ~2 km (0.02 deg), 15-minutely, 2-day horizon; ICON-EU ~7 km (0.0625 deg);
  D2 covers "Germany, Denmark, Netherlands, Belgium, Switzerland, Czechia, Austria, parts of neighbouring countries".
  Lightning potential and updraft only in ICON-D2. https://open-meteo.com/en/docs/dwd-api (search, 2026-11-18)
- **Change due in 12 days:** after 2026-11-30 `dwd_icon_global`, `dwd_icon_eu`, `dwd_icon_d2` use native grids;
  visibility no longer available after DWD feed migration. Same source. Re-test parsers after that date.
- ECMWF: IFS HRES 9 km plus open-data IFS and AIFS 0.25 deg; interpolated to 1-hourly, up to 15 days.
  https://open-meteo.com/en/docs/ecmwf-api (search, 2026-11-18)
- GFS API combines NOAA GFS with HRRR. https://open-meteo.com/en/docs/gfs-api (search, 2026-11-18)
- Ensemble endpoint: `https://ensemble-api.open-meteo.com/v1/ensemble`; sources NOAA, DWD, CMCC, ECMWF; also
  `models=google_weathernext2_ensemble`. Individual members stored only ~3 days.
  https://open-meteo.com/en/docs/ensemble-api, https://open-meteo.com/en/docs/ensemble-mean-api (search, 2026-11-18)
- Other pages exist: historical-forecast-api, single-runs-api (`https://single-runs-api.open-meteo.com/v1/forecast`
  + required `run` param), meteoswiss-api, model-updates. (search, 2026-11-18)
- 15-minute variables list includes lightning potential index and CAPE (Rust client source list); soil_temperature_0cm
  at 15-min not confirmed. https://docs.rs/crate/openmeteo-rs/1.0.0/source/src/variables/minutely.rs (search, 2026-11-18)
- Licence: not confirmed this session (CC-BY 4.0 attribution is what the task assumes).

### [RECALL, UNVERIFIED] endpoints, ids, response shape
- Forecast: `https://api.open-meteo.com/v1/forecast?latitude=&longitude=&hourly=...&models=...&timezone=Europe/Budapest`
- Archive (ERA5/ERA5-Land): `https://archive-api.open-meteo.com/v1/archive` (start_date, end_date)
- Air quality (CAMS): `https://air-quality-api.open-meteo.com/v1/air-quality` (pm10, pm2_5, european_aqi ...)
- Flood (GloFAS): `https://flood-api.open-meteo.com/v1/flood` (river_discharge)
- Model ids: `icon_d2`, `icon_eu`, `icon_global`, `icon_seamless`, `ecmwf_ifs025`, `ecmwf_aifs025`, `gfs_seamless`,
  `gfs_global`, `meteofrance_seamless`, `meteofrance_arpege_europe`, `meteofrance_arome_france`, `ukmo_seamless`,
  `gem_seamless`, `meteoswiss_icon_ch1`. Hungary note: ICON-D2 domain edge is about 20.3 E, so Budapest (19.04 E)
  is inside but the far east of Hungary (to ~22.9 E) is probably outside; AROME France and MeteoSwiss do NOT
  cover Hungary. Verify with a live call at lon 21-22.
- With one model the hourly keys are plain (`temperature_2m`); with several models each key gets the model id suffix:
  `temperature_2m_icon_d2`, `temperature_2m_ecmwf_ifs025`. Top level: `latitude, longitude, generationtime_ms,
  utc_offset_seconds, timezone, timezone_abbreviation, elevation, hourly_units{}, hourly{ time[], <var>[] }`.
  `time` is ISO8601 local without offset (`2026-11-18T00:00`) unless `timezone=GMT`; `timeformat=unixtime` available.
  Units default: temperature degC, precipitation mm, wind km/h, radiation W/m2, cape J/kg, pressure hPa,
  freezing_level_height m, snowfall cm, soil temperature degC, weather_code wmo code. Missing values = null.
- Params: `wind_speed_unit=ms`, `minutely_15=...`, `forecast_minutely_15=`, `past_days=`, `forecast_days=`, `current=`, `cell_selection=`.
- Variable names (known to exist): temperature_2m, apparent_temperature, precipitation, precipitation_probability,
  rain, showers, snowfall, wind_speed_10m, wind_gusts_10m, wind_direction_10m, cape, lightning_potential,
  weather_code, shortwave_radiation, direct_radiation, diffuse_radiation, global_tilted_irradiance, freezing_level_height,
  soil_temperature_0cm, cloud_cover, visibility. Per-model availability varies (null arrays when absent).

## 2. MET Norway Locationforecast 2.0  (verdict: SECONDARY - good independent global model)

### Source says
- ToS: requests must carry an identifying User-Agent (app/domain, optional version, contact); missing or generic
  (okhttp, Dalvik, fhttp, Java) -> 403. https://docs.api.met.no/doc/TermsOfService , https://docs.api.met.no/doc/FAQ
  (search, 2026-11-18)
- `/compact` returns a core parameter set. https://docs.api.met.no/2020/06/12/locfc2.html (search, 2026-11-18)
- Caching: third-party guides say honour Expires and use If-Modified-Since (304 when unchanged). Official page not read.
- Nowcast service exists at https://api.met.no/weatherapi/nowcast/2.0/ ; coverage page "converage" exists. Coverage not read.

### [RECALL, UNVERIFIED]
- `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=47.4979&lon=19.0402` (max 4 decimals; more is rejected/redirected),
  also `/complete`, `/classic` (XML). Shape: GeoJSON `{type:"Feature", geometry:{type:"Point", coordinates:[lon,lat,alt]},
  properties:{ meta:{updated_at, units:{air_temperature:"celsius", precipitation_amount:"mm", wind_speed:"m/s", ...}},
  timeseries:[{time:"2026-11-18T12:00:00Z", data:{ instant:{details:{air_pressure_at_sea_level, air_temperature,
  cloud_area_fraction, relative_humidity, wind_from_direction, wind_speed}}, next_1_hours:{summary:{symbol_code},
  details:{precipitation_amount}}, next_6_hours:{...}, next_12_hours:{summary:{symbol_code}} }}]}}`.
  No gust in compact (wind_speed_of_gust is in complete, and not reliably). Hourly for ~2.5 days then 6-hourly to ~9-10 days.
  Nowcast is Nordic-only (MET radar coverage). Licence NLOD 2.0 and CC BY 4.0, attribution required. Commercial use allowed.

## 3. RainViewer  (verdict: AVOID as a dependency; optional for visual radar only)

### Source says
- Official transition summary (https://rainviewer.com/api/transition-faq.html, search, 2026-11-18): from 2026-01-01
  nowcast (future) radar, satellite IR and all colour schemes except Universal Blue were discontinued; single radar
  data limited to last 6 images from 2025-08-01; Weather Radar Database API discontinued 2025-12-31.
- Free zoom max 10 per examples page; full zoom for Patrons. https://www.rainviewer.com/api/examples.html (search)
- Free use: personal, educational, small-scale community. No numeric rate limit found. Only supported index:
  `https://api.rainviewer.com/public/weather-maps.json`. https://rainviewer.com/api.html (search)
- Forum reports of service extension to 2026-01-31 and later "officially gone" for some integrators
  (https://forum.flowx.io/t/rainviewer-is-officially-gone/2138) - live state unknown.
- Commercial/business use of the free API looks outside the stated free scope.

### [RECALL, UNVERIFIED]
`{version, generated, host:"https://tilecache.rainviewer.com", radar:{past:[{time,path}], nowcast:[...]}, satellite:{infrared:[...]}}`;
tile = `{host}{path}/{size 256|512}/{z}/{x}/{y}/{color}/{smooth}_{snow}.png`. Re-verify before any code.
For Hungary prefer the national radar (HungaroMet) - see other notes.

## 4. NASA POWER and PVGIS  (verdicts: PVGIS CORE for PV yield; NASA POWER SECONDARY/optional)

### Source says
- PVGIS: base `https://re.jrc.ec.europa.eu/api/v5_3/<tool>?...`; tools PVcalc, SHScalc, MRcalc, DRcalc, seriescalc, tmy, printhorizon;
  example `.../PVcalc?lat=45&lon=8&peakpower=1&loss=14`; `outputformat=json` supported; out-of-range input returns a JSON error.
  A rate-limit section exists (figure not read; commonly cited ~30 calls/s per IP - unconfirmed).
  https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/api-non-interactive-service_en
  (search, 2026-11-18). seriescalc example: `lat=45&lon=8&startyear=2016&pvcalculation=1&peakpower=1&loss=14` (pyPVGIS, third party).
  Keyless; EU JRC, free; licence/commercial terms not read (JRC data is normally reusable with attribution - confirm).
- NASA POWER: `/api/temporal/hourly/point?parameters=...&community=...&longitude=&latitude=&start=&end=&format=...`
  (also daily, monthly, climatology); max 15 parameters hourly, 20 other. Rate limit not formally published;
  team "monitors usage"; a 2021 reply cited 30 req/min on climatology. https://power.larc.nasa.gov/docs/services/api/temporal/hourly/ ,
  https://forum.earthdata.nasa.gov/viewtopic.php?p=15146 (search, 2026-11-18).
- Inference: both are historical/climatological or TMY, not forecasts. Use PVGIS for yield estimate per site and Open-Meteo
  `shortwave_radiation`/`global_tilted_irradiance` for next-days yield. NASA POWER lags real time by days; skip unless needed.

## 5. Meteostat  (verdict: OPTIONAL, historical station checks only)

### Source says
- JSON API only via RapidAPI key; free plan hard limit 500 requests/month. https://dev.meteostat.net/api (search, 2026-11-18)
- Python library uses bulk data, not the hosted API. Licence not confirmed this session; [RECALL] bulk data CC BY-NC 4.0,
  which blocks commercial use - treat as avoid for a company until the licence page is read.
- Not realtime; Hungarian stations come from NOAA ISD/DWD-style feeds. Open-Meteo archive (ERA5) covers the need.

## 6. Key-based free tiers  (verdict: OPTIONAL adapters; none are core)

Source says (aggregators, unreliable; all via search 2026-11-18, e.g. https://geekflare.com/guides/weather-api/,
https://apibouncer.com/guides/best-free-weather-apis, https://agentdeals.dev/vendor/openweathermap):
- OpenWeatherMap: conflicting (1,000 calls/day for One Call 3.0 vs 1M/month for older free endpoints). One Call 3.0 needs a card
  on file; free 1,000/day, then pay-per-call [RECALL]. Check https://openweathermap.org/price.
- Tomorrow.io: free limits unconfirmed (one aggregator says 500/day). Commercial terms not read.
- Visual Crossing: free tier 1,000 records/day, non-commercial per one source.
- WeatherAPI.com: free tier 1M calls/month, 3-day forecast only, no history.
- Pirate Weather: nothing found. [RECALL] Dark Sky compatible, free tier 10,000 calls/month with key, CC-BY attribution, built on NOAA/GFS/HRRR
  (weak over Hungary).
- Inference: all repackage NWP models already available via Open-Meteo, so they add little independence. The only
  adds are different post-processing (Tomorrow.io, WeatherAPI) and a commercial SLA. Build one generic adapter interface, ship none enabled.

## 7. NOAA/NWS and GFS (NOMADS)  (verdicts: NWS AVOID/irrelevant; GFS direct AVOID)

- [RECALL, UNVERIFIED] api.weather.gov covers US territories only; irrelevant for Hungary. Not searched.
- GFS is reachable already through Open-Meteo (`gfs_seamless`), see source above. NOMADS GRIB filter needs GRIB2 decoding
  and is incompatible with a zero-dependency Node tool. Not searched.

## Summary table

| API | Auth | Free limit (source) | Commercial for small firm | Verdict |
|---|---|---|---|---|
| Open-Meteo forecast/ensemble/AQ/archive/flood | none | <10k/day, 5k/h, 600/min | No on free tier; paid $29/mo (1M calls) | core (budget the plan) |
| MET Norway Locationforecast | none, UA required | throttle by ToS | yes, attribution | secondary |
| RainViewer | none | unpublished | outside free scope; nowcast removed 2026 | avoid |
| PVGIS 5.3 | none | rate limit unread | likely yes, confirm | core for PV |
| NASA POWER | none | unpublished | public domain data [RECALL] | optional |
| Meteostat JSON | RapidAPI | 500 req/month | unknown | optional/avoid |
| OWM, Tomorrow, VisualCrossing, WeatherAPI, PirateWeather | key | see s.6 | varies | optional |
| NWS / NOMADS | - | - | - | avoid |

## Open items for the next session (needs the hosts allowed)
1. Live capture of Open-Meteo forecast with `models=icon_d2,ecmwf_ifs025`, plus one at lon 22 to test D2 domain edge; save as fixtures.
2. Ensemble member key naming (`temperature_2m_member01` form) and model ids.
3. Locationforecast compact fixture; confirm Expires/If-Modified-Since text and licence.
4. RainViewer weather-maps.json live state after 2026-01-01.
5. Open-Meteo pricing page and licence line; PVGIS rate-limit figure and terms; Meteostat bulk licence.
