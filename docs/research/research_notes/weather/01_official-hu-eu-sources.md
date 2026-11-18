# VRG Weather - official HU/EU data sources (research notes 01)

Read: 2026-11-18, by Akecheta. **Method limit:** every WebFetch failed with DNS errors (odp.met.hu, opendata.dwd.de,
ecmwf.int, blitzortung.org, api.brightsky.dev are not in the sandbox's allowed domains), and curl is proxy-blocked.
So everything below comes from WebSearch result summaries only. No real sample responses were captured.
Items marked [UNVERIFIED] are my inference or a single third-party mention. Project index was empty
(`node tools/vrg-ctx.js q weather` -> "No index yet"), so nothing existing was checked.

Legend: SAYS = what the source says. CONCLUDE = my reading.

## 1. HungaroMet open data portal (odp.met.hu)

SAYS
- Top level `/weather/` has folders: lightning, nwp (model forecasts), radar, satellite, text_forecast, uv_forecast,
  warnings, weather_reports. https://odp.met.hu/weather/ (2026-11-18, via search summary)
- Radar: `/weather/radar/composite/` with `nc/` (netCDF) and `png/`; README says archive content still being developed.
  https://odp.met.hu/weather/radar/composite/ (2026-11-18)
- Lightning: `/weather/lightning/` with `alha/` (current) and daily subfolder, LINET docs (PDF). Modification dates look old
  in the listing. https://odp.met.hu/weather/lightning/ (2026-11-18)
- Observations: 10-minute wind dataset is formatted CSV with metadata header, updated every 10 min; SYNOP 10-min wind
  is zipped CSV. Paths seen: `/climate/observations_hungary/10_minutes_wind/now/` and
  `/weather/weather_reports/synoptic/hungary/10_minutes_wind/`.
  https://odp.met.hu/climate/observations_hungary/10_minutes_wind/now/Leiras_automata_10perces_szel-HABP_10MWIND_now-hu.pdf ;
  https://odp.met.hu/weather/weather_reports/synoptic/hungary/10_minutes_wind/Leiras_automata_10perces_szel-HABP_10MWIND_SYNOP-hu.pdf (2026-11-18)
- WMO team page: 10-minute AWS data of ~140 Hungarian stations in BUFR since 2023-01-16.
  https://wmo-teams.atlassian.net/wiki/spaces/OE/pages/330727446/Hungary+BUFR+data+exchange+hourly+and+10-minute (2026-11-18)
- Terms: free, unrestricted use of observation/measurement data and HungaroMet model forecasts; cite HungaroMet Nonprofit Zrt.
  as source; data used without modification (changes need written consent); no guarantee for warnings it did not transmit;
  contact odp@met.hu. https://odp.met.hu/ODP_General_Term_of_Use.pdf (2026-11-18)
- A conference abstract claims CC-BY-SA applies to all its data (EMS2024-1149):
  https://meetingorganizer.copernicus.org/EMS2024/EMS2024-1149.html (2026-11-18). Conflicts in wording with the terms PDF.
- Third-party HA integration reads HungaroMet forecast + radar PNG from the portal:
  https://github.com/ztarsoly/ha-hungaromet-weather-and-forecast (2026-11-18)
- Third-party "hunmetdataapi" (station data API): https://github.com/code-nogi/hunmetdataapi (listed, not read)

CONCLUDE
- Auth: none (plain HTTP directory listings; Node `https.get` + CSV/zip parse is enough; zip needs a tiny inflate via `zlib`).
- Core for Hungary observations, radar PNG/netCDF, warnings folder. PNG radar needs no decoder; netCDF does.
- Lightning folder: likely LINET but possibly stale; check timestamps before relying on it. [UNVERIFIED]
- Exact file names, station-list file, forecast (nwp) formats, and warnings file format/cadence NOT confirmed.
- The "no modification" clause: re-plotting/thresholding is probably fine, republishing altered data is not. Ask odp@met.hu if
  VRG redistributes to customers.
- Verdict: **use as core** (obs, radar, warnings), pending a first manual look at the listings.

## 2. MeteoAlarm / EUMETNET

SAYS
- WMO register entry for Hungary lists met.hu with a blank CAP feed field. https://alertingauthority.wmo.int/authorities.php?recId=69 (2026-11-18)
- Legacy Atom pattern `feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-<country>` exists for other countries (search summary);
  EUMETNET says MeteoAlarm Feeds give aggregated active warnings and new APIs for bulk/archive are being built.
  https://www.eumetnet.eu/ (2026-11-18)
- Licence: third-party docs state content is "EUMETNET/MeteoAlarm (CC BY 4.0)"; a Belgian catalogue also lists CC BY 4.0.
  https://meteoalarm.readthedocs.io/en/latest/warnings.html ; https://meteoalarm.readthedocs.io/en/latest/_sources/cite.md (2026-11-18).
  Official terms and the redistributor hub were not read.

CONCLUDE
- Likely URL `https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-hungary` (CAP per entry) [UNVERIFIED]; the newer
  `/api/v1/warnings/feeds-hungary` form is from memory and unconfirmed. Auth, rate limits, cadence: unknown.
- Region codes are EMMA_ID (HU0xx per county) - needs confirming from a live sample.
- Verdict: **use as secondary** (single uniform CAP format, good fallback/cross-check to the HungaroMet warnings folder).
  Attribute "EUMETNET/MeteoAlarm" and confirm terms on the redistributor hub first.

## 3. DWD Open Data, MOSMIX, Bright Sky

SAYS
- MOSMIX_L per-station path pattern:
  `https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/<ID>/kml/MOSMIX_L_LATEST_<ID>.kmz`
  (example ID 11120). ~5000+ stations worldwide, horizon up to 240 h. (wetterdienst docs)
  https://wetterdienst.readthedocs.io/en/latest/data/provider/dwd/mosmix/ (2026-11-18)
- Station catalogue: https://www.dwd.de/DE/leistungen/met_verfahren_mosmix/mosmix_stationskatalog.cfg (named by a project; not opened)
- Budapest synoptic station is WMO 12843, 47.52N 19.03E, 130 m (CEDA / klimadiagramme.de):
  https://catalogue.ceda.ac.uk/uuid/451c6b910c4a4a518e835ff827bf359e/ ; https://klimadiagramme.de/Europa/ungarn.html (2026-11-18).
- Bright Sky: free JSON API over DWD observations + MOSMIX; endpoints `/current_weather`, `/weather`; lat/lon or station ids; MIT
  licence (aggregator). https://api.brightsky.dev/openapi.json ; https://github.com/jdemaeyer/brightsky (2026-11-18)

CONCLUDE
- Whether 12843 (or any HU station) is in MOSMIX catalogue: NOT confirmed. MOSMIX_L is worldwide station-based so likely, [UNVERIFIED].
- KMZ = zip of one KML; Node can parse with zlib + regex/XML scan, no deps, but KML is verbose.
- Bright Sky is focused on Germany; its lat/lon lookup picks nearest DWD station, so it is probably useless for Budapest.
  Did not verify. Public instance has fair-use norms, no stated limits found.
- ICON-EU / ICON-D2 coverage of Hungary: not researched in this pass (ICON-EU covers central Europe incl. Hungary, ICON-D2 domain
  edges at ~ Austria/Czech; from memory, UNVERIFIED). GRIB2 on icosahedral grid needs regridding: impractical without decoder.
- DWD licence: DWD open data is generally free with source citation "Deutscher Wetterdienst" [UNVERIFIED here].
- Verdict: **MOSMIX KMZ: secondary** (a second opinion forecast, only if HU station present). **Bright Sky: avoid for HU**.
  **ICON GRIB: avoid** at this stage.

## 4. ECMWF Open Data

SAYS
- Subset of real-time IFS and AIFS forecasts free, CC-BY-4.0 + ECMWF Terms of Use; 0.25 deg GRIB2 unless stated; AIFS 6-hourly to 15 d.
  https://ecmwf.int/en/forecasts/datasets/open-data ; https://ecmwf.int/en/forecasts/dataset/aifs-machine-learning-data (2026-11-18)
- Hosted at https://data.ecmwf.int/forecasts and AWS https://registry.opendata.aws/ecmwf-forecasts/ ; Python `ecmwf-opendata` recommended.
  https://confluence.ecmwf.int/x/-pz9Kw (2026-11-18)
- A search result claims IFS goes to 0.1 deg from 2026-10-20 (single source, not confirmed).
  https://www.ecmwf.int/node/37199 (2026-11-18)

CONCLUDE
- No auth. Whole-globe GRIB2 files; HTTP byte-range via the `.index` files lets you fetch just a few messages, but you still need a
  GRIB2 decoder (simple packing is writable in ~150 lines, but IFS uses CCSDS/AEC compression in some products - [UNVERIFIED]).
- Verdict: **avoid for v1** (secondary later, via a decoder or a JSON wrapper). Open-Meteo wraps ECMWF as JSON but is not official
  and its free tier is non-commercial.

## 5. Copernicus CAMS / ERA5

SAYS
- ADS needs an account and personal API key; datasets under Copernicus Products Licence (accept in portal). CAMS Europe air quality
  forecasts dataset incl. pollen variables (e.g. birch_pollen).
  https://ads.atmosphere.copernicus.eu/datasets/cams-europe-air-quality-forecasts (2026-11-18)
- ERA5 CDS needs a separate account (inference by search tool, not directly sourced).

CONCLUDE
- Account + key + asynchronous queue requests, GRIB/NetCDF output. Poor fit for an offline-first no-dependency tool;
  ERA5 is a reanalysis (history), not operational feed. Pollen is not a stated VRG need.
- Verdict: **avoid** for v1 (ERA5 only useful for PV climatology later).

## 6. Lightning

SAYS
- Blitzortung compendium: commercial use of its data is prohibited. https://www.blitzortung.org/en/compendium.php (2026-11-18, via search)
- Forum moderators: data CC-BY-SA 4.0 but apps must be freely accessible, source named, not for storm warning systems, insurance,
  or risk analysis. https://forum.blitzortung.org/showthread.php?pid=12557 ; https://www.lightningmaps.org/about?lang=gb (2026-11-18)
- HungaroMet lightning folder (LINET) see section 1.

CONCLUDE
- Blitzortung: a field-safety tool for a company is commercial and a warning use: **avoid** (get written permission if wanted).
- HungaroMet LINET: **use as core if the folder is live** (needs freshness check). EUMETSAT MTG-LI: not researched, [UNVERIFIED].
  Non-binding legal remark: not legal advice.

## 7. OPERA radar composite

SAYS
- EUMETNET distributes OPERA composites under CC BY 4.0; ODIM HDF5 (+ COG TBD); the Open Radar Data API is IP-whitelisted via
  support.opera@eumetnet.eu; mirrors via meteogate.eu. https://eumetnet.github.io/openradardata-documentation/1-ORD-API-overview/ ;
  https://eumetnet.github.io/openradardata-documentation/ORD_HVD_summary/ (2026-11-18)

CONCLUDE
- Needs whitelisting + HDF5 decoder: **avoid**; HungaroMet radar PNG/netCDF covers Hungary directly.

## Summary table

| Source | Auth | Format | Verdict |
|---|---|---|---|
| HungaroMet odp.met.hu obs/radar/warnings | none | CSV, zip, netCDF, PNG, BUFR | core |
| HungaroMet LINET lightning | none | files in /weather/lightning | core if fresh |
| MeteoAlarm HU feed | none (probably) | Atom/CAP XML | secondary |
| DWD MOSMIX_L KMZ | none | KMZ/KML | secondary (if HU station) |
| Bright Sky | none | JSON | avoid for HU |
| ECMWF open data | none | GRIB2 | avoid v1 |
| CAMS / ERA5 | account+key | GRIB/NetCDF | avoid |
| Blitzortung | n/a | n/a | avoid (licence) |
| OPERA | IP whitelist | HDF5 | avoid |

## Not confirmed (needs network access to the real hosts)
1. Real listings and sample files under odp.met.hu (station list, CSV columns, warnings format, nwp, cadence, lightning freshness).
2. Exact MeteoAlarm Hungary feed URL, region codes, official terms.
3. Whether MOSMIX has Hungarian stations (12843?).
4. ICON coverage; DWD licence text; ECMWF 0.1 deg change; Bright Sky limits.
5. Licence mismatch at HungaroMet: terms PDF (cite, no modification) vs CC-BY-SA claim in abstract.
Action: allow odp.met.hu, opendata.dwd.de, feeds.meteoalarm.org, data.ecmwf.int in the session network settings and re-run.
