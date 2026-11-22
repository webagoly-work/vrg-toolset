# VRG Időjárás (VRG Weather)

Multi-source weather for field work, in our own database, driven by commands. It pulls official and open
sources, keeps every forecast with its provenance, fuses them into a consensus with its uncertainty, scores
each source against real measurements, and turns the result into **work windows** and **alerts** per job site
and activity: lightning, MEWP gusts, frost for PVC cable, rain, heat, official warnings, PV commissioning days.

*Többforrású időjárás a terepi munkához, saját adatbázisban, parancsokkal vezérelve: konszenzus-előrejelzés
bizonytalansággal, munkaablak és riasztás munkahelyenként és tevékenységenként.*

Research and the decision behind it: `docs/research/reports/VRG Weather - sources, fusion and field rules.md`.

## Run

START **W** Varler Console → **I** VRG Időjárás → **1** opens `http://localhost:8808/` with the scheduler.
The server is also START **O** → **W**. Or:

```bash
node Weather/serve.js --daemon        # page + scheduler, http://localhost:8808
node Weather/vrg-weather.js help      # every command
node Weather/tools/demo.js            # offline demo on INVENTED data, :8809, real database untouched
node Weather/test/run.js              # 52 tests, invented data only, no network
```

First time on the PC:

1. Create `Weather/config/settings.local.json`. It is gitignored.
2. Run `node Weather/vrg-weather.js doctor --live`. It makes one real request per source and checks the
   parsers, which were written from documentation and have not seen a live answer yet.
3. Run `node Weather/vrg-weather.js run reggel`.

A minimal `settings.local.json`:

```json
{ "contact": "<a cég honlapja vagy e-mail címe>", "keys": { "openMeteo": "" } }
```

MET Norway requires a contact in the User-Agent. Open-Meteo runs only with a key in `commercial` mode
(see Licences).

## Commands

Everything is a command, and pipelines are lists of commands, so anything you can type you can automate.

| Command | What it does |
|---|---|
| `init` · `status` · `sources` · `places [add/off/on]` | database, overview, the source registry with gate and freshness, places |
| `sync-jobs` | the jobs *in progress* from the Map (`jobs\_elozmenyek\helyek.json`) become watched job sites |
| `fetch [source…] [--place] [--force]` | run the adapters; honours cadence, Expires and If-Modified-Since |
| `fuse` | consensus per place and hour: value, spread, confidence, members |
| `verify` | forecast vs HungaroMet measurement → `skill` (n, MAE, bias, RMSE; Brier for probability) |
| `alerts [--list]` · `ack <id>` | rules → alerts (deduplicated, cleared, acknowledged) → outbox → delivery |
| `now` · `forecast [--var gust]` · `windows` · `warnings` | read-outs |
| `brief [place/--all] [--day tomorrow] [--save]` | the Hungarian work-day briefing, as markdown |
| `pv <place> [--kwp --angle --aspect --loss]` | PVGIS monthly yield |
| `export` | `data/export/latest.json` for the VRG Asztal, Kapu and VRG Mobile (job sites without coordinates) |
| `fetch open-meteo-grid met-no-grid` · `run terkep` | the VRG Térkép's weather fields over Hungary (lib/grid.js), plus stations, strikes, radar and warnings for its W layer |
| `run <pipeline>` · `pipelines` · `daemon [--once]` | pipelines and the scheduler (`config/pipelines.json`) |
| `doctor [--live]` · `sql "SELECT …"` · `prune` | health check, read-only SQL, retention |

`--json` gives machine output on any command, and `--replay <dir>` reads recorded answers instead of the
network. Console text is ASCII under the Windows codepage; `VRG_UTF8=1` keeps the accents.

**Pipelines** (`config/pipelines.json`), run on schedule by `daemon` or `serve.js --daemon`:

| Pipeline | When | Steps |
|---|---|---|
| `gyors` | every 15 min | warnings, measurements, strikes, alerts |
| `modell` | hourly at :07 | forecasts, fusion, alerts |
| `reggel` | 05:40 | everything, including verify, the day's brief and export |
| `este` | 18:10 | tomorrow's brief and prune |
| `pv` | 1st of the month | PVGIS |
| `terkep` | on demand (the Térkép's Frissítés, START W → I → M) | everything the Térkép's W layer draws |

A failed step is logged in `run` and the pipeline goes on.

## Files

```
Weather/
  vrg-weather.js        the CLI           serve.js            page + JSON API (:8808), --daemon, --replay
  vrg-idojaras.html     the page (Mélyvíz, copy synced by tools/melyviz-sync.js)
  config/               sources.json (the source manifest) · places.json · rules.json · pipelines.json · settings.json
  lib/                  db · commands · fetch · http · fuse · verify · rules · brief · pipeline · ops · places · sources
                        vars (canonical variables, WMO codes) · csv · zip · common
  lib/adapters/         met-no · dwd-mosmix · open-meteo · open-meteo-aq · meteoalarm · hungaromet-obs
                        hungaromet-lightning · pvgis
  test/                 fixtures.js (invented answers in each source's shape) · run.js · *.test.js
  tools/demo.js         offline demo
  data/                 (gitignored) weather.sqlite · raw/ · briefs/ · outbox/ · export/ · demo/
```

**Adding a source** takes three steps:

1. Write an adapter with `scope` (place, station or global), `url()` and `parse()` that returns
   canonical rows.
2. Register it in `lib/sources.js`.
3. Add its entry to `config/sources.json`, with licence, attribution, `commercial` and `verified`.

The variables are in `lib/vars.js`. Never rename one.

## The VRG Térkép

The Térkép's **W** layer (`docs/map/WEATHER-MAP.md`) reads this database through `lib/maplayers.js`. The fields:

- Open-Meteo on a 0.25° grid when its key is set, otherwise MET Norway on a 0.5° grid;
- the HungaroMet stations interpolated every 10 minutes;
- lightning, radar frames, the warnings placed on `config/areas.json`;
- per job code, the worst weather alert of the next 24 hours.

## Licences

`settings.use` is `commercial` by default, because VARLER work is a company's. In that mode only sources
a company may use run, and a `key` source runs only with its key. `evaluation` runs everything and the page
and brief say **KIÉRTÉKELÉS**. Every source's attribution is shown under the page and the brief. Blitzortung
and RainViewer are deliberately absent: their terms exclude this use.

## Client data

Job sites come from the Map's job layer and live only in `data/weather.sqlite`, which is gitignored. They
are never written to config. They never go into a request except as the coordinates of a forecast query,
and `export` writes them without coordinates.

## Rules are safe defaults

`config/rules.json` carries each limit's basis: legal, standard, datasheet, practice, public-health or
official. The person responsible for work safety should confirm the limits. The MEWP's data plate and the
cable's datasheet always win.

VRG Mobile's Időjárás (WP M44) bundles `config/rules.json`, `places.json`, `sources.json` and `settings.json` in
`Mobile/android/weather-core/src/main/resources/weather/`. After changing one, copy it there; `gradlew :weather-core:test`
fails until the copies match.
