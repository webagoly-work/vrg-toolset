# VRG Weather - architecture patterns and field thresholds

Read 2026-11-18 by Akecheta. Budget ~25 tool calls; used about 23.
Convention: SAYS = what the source states. CONCLUDE = our inference. UNVERIFIED = from background knowledge or a secondary source only, not read at the primary source.
Network note: the sandbox allowed github.com and WebSearch only. These hosts did not resolve and need allowing to confirm primary text: open-meteo.com, weewx.com, developers.home-assistant.io, njt.jog.gov.hu, adozona.hu, ipaf.org, products.lappgroup.com.
Project ctx query (`vrg-ctx q weather`): no index, nothing relevant.

---------------------------------------------------------------
## PART A - architecture of multi-source aggregators

### A1. Open-Meteo (read 2026-11-18)
- SAYS ([GitHub repo page](https://github.com/open-meteo/open-meteo)): downloads open NWP data from national weather services, ">5 TB daily"; combines regional + global models "to select suitable forecast data"; processed data kept in a "custom file format optimized for compressed time-series access" (the OM format); GeoDNS API; self-host via Docker / Ubuntu package, can read the public DB remotely and cache locally.
- SAYS: code AGPLv3-or-later; data CC BY 4.0 (attribution + licence link + indicate changes); free for open-source/non-commercial, commercial use must contact them; >10,000 req/day contact them.
- Not confirmed: the `best_match` algorithm (page does not name it), OM format internals, last-commit date (page capture showed 2,670 commits, no date).
- CONCLUDE: AGPL code -> do not copy code into a closed tool; calling the API is fine for non-commercial but VRG is a company, so a commercial licence/contact is probably needed. Check before depending on it. Copy the idea (per-model series kept separate; a "pick best model per region" layer on top), not the code.

### A2. Bright Sky (DWD wrapper) (read 2026-11-18)
- SAYS ([repo](https://github.com/jdemaeyer/brightsky)): PostgreSQL; two relevant tables `sources` (locations/stations with records) and `weather` (history of measurements or forecasts); schema from `.sql` files run by a `migrate` command; observations from DWD stations, forecasts from MOSMIX; parsing is a separate package `dwdparse`; Redis only as task-queue backend; MIT licence; DWD Open Data credited.
- SAYS ([OpenAPI](https://api.brightsky.dev/openapi.json) via search snippet): `source_id` param from `/sources`, several ids can be given in priority order.
- Not confirmed: column definitions (migration file URL guesses 404'd), how forecast vs observation rows are distinguished.
- CONCLUDE: pattern = a `sources` table + one `weather` table, source ids passed in priority order = cheap fallback chain. MIT: patterns and even small code reusable with notice.

### A3. Pirate Weather (read 2026-11-18)
- SAYS ([repo](https://github.com/Pirate-Weather/pirateweather)): Apache-2.0; Dark-Sky-compatible API; blending method not described on that page (points to `pirate-weather-code`). A [DataSources doc](https://docs.pirateweather.net/en/latest/DataSources/) exists (seen in search results, not opened).
- Not confirmed: how it blends HRRR/GFS/NBM/ECMWF.
- CONCLUDE: not needed beyond "short-range high-res model first, global model for the tail". Low priority.

### A4. weewx, Home Assistant, Meteostat
- weewx: site unreachable. UNVERIFIED (background): archive table keyed by `dateTime` (epoch) with `usUnits`, `interval` and one column per observation type; `archive_day_<obs>` daily-summary tables; GPLv3. Check at weewx.com/docs.
- Home Assistant weather entity: site unreachable (raw GitHub path 404). UNVERIFIED (background): normalised `condition` enum (clear-night, cloudy, exceptional, fog, hail, lightning, lightning-rainy, partlycloudy, pouring, rainy, snowy, snowy-rainy, sunny, windy, windy-variant), forecast types daily/hourly/twice_daily with fields datetime, temperature, precipitation, precipitation_probability, wind_speed, wind_bearing, is_daytime. Entity docs are CC BY-NC-SA / code Apache-2.0 (UNVERIFIED).
- Meteostat (read via [search summary](https://github.com/meteostat/meteostat-python), 2026-11-18): code MIT; endpoints hourly/daily/monthly/normals; hourly built from historical DBs, METAR, SYNOP, with model data filling gaps in annual dumps; data licence is inconsistent across pages (CC BY-NC 4.0 in older README, no commercial redistribution as-is in current README, CC BY 4.0 on the CLI page). Terms page https://dev.meteostat.net/terms not read.
- CONCLUDE: Meteostat data may be non-commercial only. Treat as "do not use for VRG until terms confirmed". Note model data mixed into "observations" - exactly the provenance muddle we must avoid.

### A5. CAP and WMO codes
- SAYS ([NWS CAP v1.2 guide](https://www.weather.gov/media/alert/CAP_v12_guide_03-07-2017.pdf), [Google CAP requirements](https://developers.google.com/public-alerts/guides/cap-requirements/entities/alert), via search summary 2026-11-18): required alert elements identifier, sender, sent, status, msgType, scope, >=1 info; info requires category, event, urgency, severity, certainty; geography in info/area (areaDesc, polygon); Cancel msgType is for alerts sent in error.
- WMO WW/4677 present-weather codes: search returned nothing. UNVERIFIED: WMO code table 4677 (ww 00-99) and WMO 4680 (automatic stations); Open-Meteo uses a WMO subset 0-99 (UNVERIFIED).
- CONCLUDE: store our own warnings in a CAP-shaped table (severity/urgency/certainty/msgType/references) so DWD/HungaroMet CAP feeds and our own rule output share one schema. Keep our own small normalised condition enum and a column for the raw source code (WMO or source-specific).

### A6. Verification basics (not read from a source this session - UNVERIFIED, standard textbook method)
- Bias = mean(forecast - obs); MAE = mean|forecast - obs|; RMSE; per variable, per lead-time bucket (0-6 h, 6-24 h, 24-48 h, ...), per source, rolling window (e.g. 30 d), optionally per season.
- Precipitation probability: Brier score = mean((p - o)^2), o in {0,1}; plus reliability (calibration bins). Precipitation amount: hit/miss on threshold (e.g. >=0.2 mm/h, >=1 mm/h) rather than MAE.
- Consensus options: (1) median of models (robust, no training); (2) inverse-MAE weights per variable x lead bucket with a floor and a minimum sample size, falling back to equal weights; (3) spread (std dev or max-min of members/sources) as uncertainty; ensemble spread from true ensembles is better than spread of a few deterministic sources.
- CONCLUDE: start with median + spread; add inverse-error weights only when >=30 matched pairs per (source, variable, lead bucket).

### A7. Concrete design patterns to copy (CONCLUSIONS, linked to the evidence above)
1. `source` table with id, name, kind (observation|forecast|alert|model), licence, attribution text, terms URL, commercial_ok flag, last_checked. Basis: Open-Meteo/Meteostat licence mess (A1, A4); Bright Sky `sources` (A2).
2. Separate `observation` and `forecast` tables (or one with `kind`), never mix. Meteostat's model-filled "observations" is the anti-pattern (A4).
3. Forecast key = (source_id, location_id, variable, issued_at, valid_at); UNIQUE on that tuple gives dedup and idempotent re-fetch. Store `lead_hours` as a generated column. Keep every issue (do not overwrite) - needed for verification.
4. Observation key = (source_id, station_id, variable, observed_at); store `interval_s` as weewx does (UNVERIFIED), value in fixed SI units, original unit/raw value in a side column.
5. `fetch_run` table (url, started, http status, bytes, sha256 of payload, parser version); every row references its run - provenance and replay.
6. Lead-time-aware verification table: (source, variable, lead_bucket, window_end, n, bias, mae, rmse, brier) - recomputed nightly (A6).
7. Consensus table: (location, variable, issued_at, valid_at, value_median, value_weighted, spread, n_sources, method, source_ids). Never overwrite inputs.
8. Station-to-site mapping with distance and elevation difference; reject observations beyond a radius for verification.
9. Warnings in a CAP-shaped table (A5); automations emit CAP-like records (severity, urgency, certainty, expires) so dedup/cancel/update (references) works.
10. Source fallback by priority list per variable, as Bright Sky's `source_id` priority (A2).
11. Normalised condition enum (HA-style, UNVERIFIED) + raw WMO code kept.
12. Licence gate: a source with commercial_ok=0 is excluded from outputs shown to crews until cleared.

---------------------------------------------------------------
## PART B - thresholds for electricians / outdoor work (HU / EU)

Legend of basis: LEGAL = law/decree; STANDARD; DATASHEET; PRACTICE = guidance/common practice.
Honest status: the sandbox could not open Hungarian legal texts, so Hungarian legal claims below are mostly UNVERIFIED and must be checked at njt.jog.gov.hu.

| # | Topic | Threshold | Basis | Source / status |
|---|-------|-----------|-------|-----------------|
| 1 | Lightning 30/30 | Thunder within 30 s of flash -> go to shelter; resume 30 min after last thunder | PRACTICE (NOAA/NWS, referenced in OSHA/NOAA fact sheet 3863). Not a numeric OSHA mandate per one careful source | [HSE Blog](https://www.hseblog.com/lightning-safety-at-work/), [UVM](https://uvm.edu/safety/lightning), [UF/IFAS](https://ask.ifas.ufl.edu/publication/AE526) read via search 2026-11-18; OSHA 3863 itself not opened |
| 2 | Lightning distance | 30 s = ~6 mi = ~10 km. Other guidance uses 8 mi (~13 km) / 16 km / 30 km radii | PRACTICE, varies | same search; 16/30 km values not confirmed from a primary source |
| 3 | Hungarian lightning rule for outdoor / overhead-line work | No source found. UNVERIFIED that MSZ 1585 or Hungarian rules forbid work on overhead lines in thunderstorm | LEGAL/STANDARD? unknown | Search 2026-11-18 found none. Check MSZ 1585 text (paid) and the Hungarian electrical safety rules (OVBSZ / 40/2017 NGM decree, UNVERIFIED). |
| 4 | MEWP wind | Design limit 12.5 m/s (28 mph, ~Beaufort 6) for outdoor-rated MEWP; max is on the data plate and varies by model; measured at platform; wind ~50% higher at 20 m; indoor-only machine rated 0 m/s | STANDARD (EN 280:2001+A2:2009 / 2013+A1:2015) + DATASHEET/data plate | [IPAF](https://www.ipaf.org/en/node/5848), [Genie](https://www.genielift.com/en/aerialpros/wind-speed-ratings-mewp), [Boels](https://www.boels.com/en-nl/blog/working-safely-at-height-strong-winds) via search 2026-11-18; clause text not read. Boels calls 12.5 m/s "permitted by law" - treat as loose |
| 5 | Ladder / roof / scaffold wind | No legal numeric limit found; advisory 23-25 mph (~10-11 m/s, Beaufort 5-6) for general work; roof tiling stop >23 mph; roofing membrane >17 mph (~7.6 m/s) not advised; mobile towers (PASMA) stop around Beaufort 4 (~17 mph, ~7.6 m/s) | PRACTICE (UK sources) | [HSE Blog](https://www.hseblog.com/working-high-winds/), [Xamax](https://www.xamax.co.uk/blog/working-in-high-winds-the-risks-and-how-to-mitigate-them.html) via search 2026-11-18. Hungarian rule / MSZ EN 12811 wind clause not found |
| 6 | Cable laying temp, PVC | Datasheets differ: min installation 0 C (a Nexans datasheet), "ideally not below 0 or 5 C", +4 C (one guide), -10 C (Southwire, US practice). Lapp NYY-J: fixed installation -40..+70 C (EN, EMAS), -5..+50 C stated for the "installation" range on a Lapp/RS listing | DATASHEET | [Nexans](https://www.nexans.be/en/business/Building-Territories/Building/Distributors/Temperatures.html), [Southwire](https://www.southwire.com/medias/sys_master/root/h62/haf/8909532397598/2402-Wire-and-Cable-Minimum-Operating-Temperature-and-Minimum-Installation-Temperature-Flyer-WEB-2-.pdf), [RS NYY-J](https://hu.rs-online.com/web/p/tapkabel/7210689) via search 2026-11-18. Lapp product page not reachable. |
| 7 | Cable laying, flexing | -5 C min for occasional flexing (EN, PVC H05/NYM-type per EMAS datasheet); NYM-J listed -5 C min (RS PRO) | DATASHEET / standard family (HD 21/22) | [EMAS datasheet](https://www.emas.cz/files/1910576/Bk37qh2y/elkaos1963597.pdf), [RS NYM-J](https://hu.rs-online.com/web/p/tapkabel/5154275). Note -5 C is flexing/operating, not the laying minimum. |
| 8 | Cable XLPE / halogen-free | One source: thermoset insulation often rated to -40 C for installation - always check datasheet. No halogen-free XLPE datasheet value found | DATASHEET | [Van Meter](https://vanmeterinc.com/blog/tips-for-pulling-wire-in-cold-weather) via search. NOT CONFIRMED for NAYY/halogen-free. |
| 9 | Cable bending radius vs temp | Prysmian: at >=15 C bending radius may be halved | DATASHEET/guidance | [Prysmian](https://uk.prysmian.com/media/news/whats-the-minimum-installation-and-operating-temperatures-for-cables) via search |
| 10 | Cold handling | Pre-warm reels (e.g. +15 C for 48-72 h) | PRACTICE | Van Meter, above |
| 11 | Heat alert (hosegriasztas) | Level 3: forecast daily mean >= 27 C on >=3 consecutive days, issued by the national chief medical officer (orszagos tisztifoorvos). Levels 1-2 (25 C: 1 day / 3 days) reported by one older article, NOT confirmed. Daily mean = average of 01, 07, 13, 19 h readings (one source). Alerts run by date-time ranges | Public-health alert (not itself a work-law threshold) | [444.hu 2022](https://444.hu/2022/08/16/harmadfoku-hosegriasztas-lep-eletbe-szerdatol), [Infostart 2026-06-23](https://infostart.hu/belfold/2026/06/23/harmadfoku-hosegriasztas-lep-ervenybe-az-egesz-orszagban-hamarosan); news sites, not the NNGYK notice. |
| 12 | Employer duties in heat | Employer must provide suitable drinking water (14-16 C quoted), shade/awning where possible, organised breaks during alerts (break time not added to working time), risk assessment for hot work; inspections intensify during alerts | LEGAL (Mvt. 1993. evi XCIII. + a 2024 decree reported as 25/2024. (II. 14.) Korm. rendelet - contents not confirmed) | [Penzcentrum 2025](https://www.penzcentrum.hu/karrier/20250703/mit-jelent-a-hosegriado-munkahelyi-szabalyok-hosegriasztas-munkavedelem-szempontjabol-ezt-irja-a-munka-torvenykonyve-1181505), [Infostart 2024](https://infostart.hu/belfold/2024/06/20/hosegriado-kulonleges-szabalyai-vannak-a-munkavegzesnek-mutatjuk-a-reszleteket) via search 2026-11-18. Secondary press. A 2019 article said no heat-alert-specific employer rule then; that has changed. No WBGT limit found in any result. |
| 13 | 3/2002 SzCsM-EuM | Workplace minimum requirements decree; temperature, outdoor-workplace and drinking-water clauses NOT retrieved | LEGAL | [Netjogtar](https://net.jogtar.hu/jogszabaly?docid=a0200003.scm) listed in search; text unreachable. |
| 14 | Rain / wet | Common practice: no live work in rain; enclosure ingress rating (IP) sets what may be open; trench flooding. No specific numeric threshold researched | PRACTICE | NOT RESEARCHED (budget). Suggest rule inputs: precip >0.2 mm/h or probability, soil saturation. |
| 15 | Snow/ice load, freezing rain | Not researched (budget). EN 1991-1-3 snow loads; Hungarian national annex values per zone UNVERIFIED | STANDARD | NOT CONFIRMED |
| 16 | Concrete/screed frost, adhesives/sealants | Not researched (budget). Typical: no concreting/screed below +5 C air or in frost without protection; sealant datasheets +5..+40 C usual | PRACTICE/DATASHEET | UNVERIFIED, from background knowledge |
| 17 | PV commissioning | Not researched (budget). IEC 62446-1 expects irradiance measured (commonly >=600-700 W/m2 for IV curve/thermography) | STANDARD | UNVERIFIED, background knowledge. Soiling: no source. |

### B-conclusions (ours)
- Safe defaults for rules, to be tuned by the safety officer: lightning = warn when a strike is detected/forecast within ~16 km (conservative), clear after 30 min; wind = warn at gust >= 7.6 m/s for ladders/roof membrane/mobile towers, >= 10 m/s for roof work, hard stop at the MEWP data-plate limit (default 12.5 m/s) using GUST at height (apply a height factor); cold = flag PVC-sheathed cable laying when air <= +5 C (conservative), block at <= 0 C unless datasheet allows; heat = mirror the NNGYK alert level, and add our own hourly heat-index warning.
- Every rule threshold in the DB should carry `basis` (legal|standard|datasheet|practice), source link and `reviewed_on`, so legal and rule-of-thumb limits are never shown the same way.
- Forecast wind is a 10 m mean; MEWP/ladder limits are about gusts at the work position. Use gust variable, not mean, and show uncertainty (spread).

## Could not confirm
- Open-Meteo best_match algorithm, OM format spec; Bright Sky exact columns; weewx schema; HA weather enum (all UNVERIFIED background); WMO 4677 table.
- Last-commit dates for every project (GitHub pages showed no dates); Meteostat data licence (conflicting).
- Hungarian law texts: 3/2002 clauses, Mvt. heat duties, the 2024 decree, MSZ 1585, any thunderstorm ban on overhead-line work; NNGYK levels 1-2 criteria.
- 10/16/30 km stop distances from a primary source; Hungarian wind limits for ladders/scaffolds.
- Halogen-free / NAYY installation minimum; items 14-17 not researched.
