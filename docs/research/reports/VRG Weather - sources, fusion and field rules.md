# VRG Időjárás (VRG Weather): sources, fusion and field rules (research and decision)

*2026-11-18. The research behind `Weather/`. Scope from the Founder: our own comprehensive database and
command-based automation for a multi-source weather feed, in the VRG family's style, built on the best
candidate a deep research turns up.*

Three scouts ran in parallel. Their sourced notes are in `docs/research/research_notes/weather/`:

| Note | Question |
|---|---|
| `01_official-hu-eu-sources.md` | HungaroMet ODP, MeteoAlarm, DWD (MOSMIX, ICON, Bright Sky), ECMWF open data, Copernicus, lightning, OPERA radar |
| `02_global-free-apis.md` | Open-Meteo, MET Norway, RainViewer, NASA POWER, PVGIS, Meteostat, key-based free tiers, NOAA |
| `03_architecture-and-field-thresholds.md` | how Open-Meteo, Bright Sky, Pirate Weather, weewx and Home Assistant are built; verification; thresholds for electricians |

**Honest limit.** The session's network could not reach any weather API host, either by curl or by
WebFetch. Everything comes from documentation and search summaries, plus recall where marked. No live
response was captured. So every adapter in `Weather/` is marked `verified: "no"`, and its first online run
should be `node Weather/vrg-weather.js doctor --live` (START W → I → L). The parsers were built so a
small mismatch is a config change, not a code change:

- HungaroMet CSV columns are matched by header from `sources.json`.
- Both MeteoAlarm shapes (JSON and Atom) are read.
- Open-Meteo keys are suffixed by model.

---

## 1. The decision in one paragraph

Build a **local multi-source hub**: one zero-dependency Node tool with one SQLite file (`node:sqlite`, as
in Stack and CoreRef). The flow:

1. Small adapters pull official and open sources. Every source carries its licence, its attribution and
   whether a company may use it.
2. Every forecast is stored with `issued_at` and `valid_at` and never overwritten.
3. The sources are fused into a consensus per place and hour, with its spread shown as uncertainty.
4. The consensus is scored against HungaroMet station measurements, so the weights are earned.
5. Field rules turn the consensus into alerts and work windows per activity. Each rule says whether its
   limit is law, a standard, a datasheet value or practice.
6. Everything is a command. Pipelines are named lists of commands, and the scheduler runs them.

The page, START, the CLI and the scheduler all call the same dispatcher.

## 2. Candidates compared

| | A. One API (Open-Meteo only) | B. Commercial aggregator (Tomorrow.io, OWM, Visual Crossing) | C. Self-hosted model pipeline (ECMWF + DWD GRIB) | **D. Local multi-source hub** |
|---|---|---|---|---|
| Licence for a company | free tier non-commercial; paid key needed | paid; storage often restricted | open (CC BY 4.0) | **per source, gated; works without any paid key** |
| Resilience | one point of failure | one point of failure | heavy, own failure modes | **any source can fail; warnings keep coming** |
| Hungarian relevance | good models, no official warnings or measurements | weak | models only | **HungaroMet measurements and warnings, DWD MOS station, models** |
| Uncertainty shown | models side by side, no verification | no | yes, if built | **spread + verified skill** |
| Offline / own data | no history kept | no | yes | **everything stored with provenance** |
| Effort, fit with VRG | small | small, but cloud and keys | large: GRIB decoder, GBs per run | **medium; zero-dependency Node, SQLite, START** |
| Verdict | a member of D, with key | optional adapter later | park (phase W5) | **chosen** |

Why D wins. It is the only candidate that is legally clean for VARLER without spending money, keeps
working when a source dies, and gives a crew lead a reason to trust the number: the spread, the score,
and the basis of each limit. It also follows the family's own rules: a manifest of sources the way
`vendor-manifest.json` governs code, client data that never leaves the PC, Hungarian UI, English code,
and START as the front door.

## 3. Sources: verdicts

| Source | Kind | Company use | Verdict | Why |
|---|---|---|---|---|
| **MET Norway Locationforecast 2.0** | forecast | yes (CC BY 4.0), User-Agent with contact | **core** | keyless, global, ECMWF-driven, includes P(thunder) |
| **DWD MOSMIX_L** (single-station KMZ) | forecast | yes (DWD open data) | **core** | statistically corrected point forecast, P(thunder) `wwT`, P(precip) `R101`; Budapest 12843 *(whether it is in the catalogue is unverified)* |
| **HungaroMet ODP 10-minute SYNOP** | observation | yes, cite the source, do not alter the data | **core** | the ground truth for verification and the "Most" card |
| **MeteoAlarm Hungary** (CAP, from HungaroMet) | warning | yes (CC BY 4.0 reported) | **core** | the official warnings |
| **PVGIS 5.3** | climate / PV | yes (EU reuse) | **core** for PV | monthly yield per kWp for offers and commissioning days |
| **Open-Meteo** (ICON-D2, ICON-EU, ECMWF IFS, GFS) | forecast | **key only** (free tier is non-commercial) | core *with key* | four models in one call, lightning potential, CAPE; ICON-D2 ends around 20.3° E |
| Open-Meteo Air Quality (CAMS) | air / pollen | key only | secondary | ragweed (parlagfű) and EAQI for the crew |
| HungaroMet LINET lightning | lightning | yes | **built, off** until the file pattern is confirmed | real strikes for the 30/30 rule |
| HungaroMet radar | radar | yes | link only | netCDF composites later |
| ECMWF open data, DWD ICON GRIB | model fields | yes | park (W5) | needs a GRIB decoder |
| Bright Sky | DWD wrapper | — | avoid | Germany-centred |
| CAMS and ERA5 direct | — | account and queue | avoid | Open-Meteo gives the same, simpler |
| Blitzortung | lightning | **no**: terms forbid commercial and warning use | avoid | |
| RainViewer | radar | personal use; cut back in 2026 | avoid | |
| Meteostat | history | likely non-commercial | avoid until the terms are read | |
| OWM, Tomorrow.io, Visual Crossing, WeatherAPI | forecast | paid, restrictive | optional later | they mostly repackage the same models |

The licence gate (`settings.use`) enforces the second column. `commercial`, the default, runs only
sources a company may use, and runs a `key` source only with its key. `evaluation` runs everything and
marks the page and the brief **KIÉRTÉKELÉS** ("evaluation").

## 4. Database: patterns taken from the aggregators (note 03 A7)

- A source table with licence, attribution and a commercial flag (`source`, synced from `config/sources.json`).
- Observations and forecasts in separate tables. The forecast key is
  (source, model, place, issued_at, valid_at, var), so every issue is kept: it is the raw material of
  verification.
- Provenance per request (`fetch_log`, with cache headers), with the raw answer gzipped in
  `data/raw/<source>/<day>/`.
- The consensus is a separate table and never changes its inputs (`fused`).
- Verification lives in its own `skill` table, per member, variable and lead-time bucket: n, MAE, bias,
  RMSE; Brier score for precipitation probability.
- Warnings are stored in CAP shape (`warning`, linked to places in `warning_place`).
- Times are UTC, minute precision, ISO text that sorts. The page shows Europe/Budapest.

## 5. Fusion and verification

**Members.** A member is source/model. At each run, each member's latest issue counts. An issue older
than 36 hours, or from a source the licence gate stops, does not.

**Weights.** Each member starts from its source's `prior_weight`. Note 03's advice is to use the median
first and switch to inverse-error weights only after about 30 matched pairs. So: until a member has
`fusion.minPairsForSkill` (30) verified pairs for a variable and lead bucket, the consensus is the
**weighted median**. Once every member has that many, it is the **weighted mean** with weights of
prior / MAE.

**By kind of variable:**

| Kind | Variables | Consensus |
|---|---|---|
| Amounts | precipitation | always the median, so one wet model does not make every hour wet |
| Probabilities | precipitation probability | the mean; a member with only an amount votes 100 or 0 |
| Directions | wind direction | vector mean |
| Weather code | WMO code | the most severe code at least two members reach, so one model's thunderstorm stays "possible" (amber), not "agreed" (red) |

**Confidence.** `magas` (high), `közepes` (medium) or `alacsony` (low), from the spread against a
per-variable tolerance in `settings.fusion.tolerance`. A single source is shown as `egy` (one source).

**Verification.** Each place is paired with the nearest HungaroMet station within 15 km. Temperature,
humidity, wind, gust and pressure are compared at the full hour. Precipitation uses the six 10-minute
amounts of the hour. Probability is scored with Brier. The skill table is recomputed over the last 30
days at every `verify`.

## 6. Field rules (note 03 part B)

`config/rules.json` holds them. Every rule carries `basis`, its source and a `reviewed_on` date:

| Rule | Limit | Basis |
|---|---|---|
| Strike nearby | ≤ 16 km within 30 min → red; resume 30 min after the last | practice (30/30, NOAA/NWS; 16 km is the cautious radius) |
| Thunder agreed / possible | consensus code 95–99 → red; one source, or CAPE ≥ 800 with P ≥ 40 % → amber | practice |
| MEWP gust | ≥ 12.5 m/s → red | standard (EN 280 design limit; the data plate decides) |
| Ladder, mobile tower, roof membrane | gust upper bound ≥ 7.6 m/s → amber | practice (UK guidance) |
| Roof work | gust ≥ 10 m/s → red | practice |
| PVC cable laying | ≤ +5 °C (lower bound) → amber; ≤ 0 °C for 2 h → red | datasheet (0 … +5 °C, varies by cable) |
| Freezing rain | WMO 56/57/66/67 from any source → red | practice |
| Rain | ≥ 0.2 mm/h and ≥ 50 % → amber (no live work outdoors); ≥ 4 mm/h → red | practice |
| Heat | apparent temperature ≥ 32 → amber, ≥ 35 on roofs → red | employer duty in law; the trigger is ours |
| Heatwave | daily mean ≥ 27 °C on 3 days → red (the level-3 heat alert); ≥ 25 °C → amber (unconfirmed level) | public health (NNGYK) |
| Official warning | yellow → amber; orange or red → red | official (CAP) |
| Air | EAQI ≥ 80 or ragweed ≥ 30 → amber | public health |
| PV commissioning window | irradiance ≥ 600 W/m² for 2 h, dry → info | standard (IEC 62446-1; unverified) |

The rules use the cautious side of the uncertainty: wind uses the upper bound, cold uses the lower
bound. **These are safe defaults, not legal advice.** The person responsible for work safety should
confirm them. The Hungarian law texts (3/2002 SzCsM-EüM, Mvt., MSZ 1585, OVBSZ) could not be opened in
this session.

## 7. Open questions and next phases

| # | What | How |
|---|---|---|
| W1 | Confirm every parser against a live answer | `doctor --live` on the PC; then set `verified: "yes"` per source |
| W2 | HungaroMet lightning: file pattern and freshness | open odp.met.hu/weather/lightning, set the URL, `enabled: true` |
| W3 | Open-Meteo for VARLER | buy the API plan (about $29 a month for 1M calls, unconfirmed), put the key in `settings.local.json` |
| W4 | Delivery to phones | the outbox has a `webhook` channel; wire it to VRG Mobile or ntfy once chosen |
| W5 | Own model fields | ECMWF / ICON GRIB, radar netCDF: only if the hub proves too coarse |
| W6 | The safety officer's review of `rules.json` | set `reviewed_on`, adjust limits |
| W7 | HungaroMet's "do not alter the data" | we store converted units and keep the raw file; ask odp@met.hu before customer-facing reuse |
| W8 | DWD ICON on native grids from 2026-11-30 | re-run `doctor --live` after that date (affects Open-Meteo's ICON members) |
