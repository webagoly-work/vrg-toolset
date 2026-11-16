# VRG Térkép — the jobs on the map

*The J layer of the VRG Térkép (`Map/`): where each job is, for internal intake and planning.
Client data: it lives outside Git, and every way it can leave this PC is switched, logged or refused.*

## Decisions (asked 2026-11, answered by the Founder)

| Id | Question | Answer |
|---|---|---|
| **MAP-D1** | Where do the job coordinates live? | **A** — `H:\VRG\Full\jobs\_elozmenyek\helyek.json`, outside the repo, next to the register. |
| **MAP-D2** | May the phone see the job layer through the VRG Mobile relay (M8, `/p/8802/`, `docs/mobile/PARITY.md` row 27)? | **B** — yes. *"It is a necessary step sadly, we should control the aftermath instead."* The controls are below. |
| **MAP-D3** | Who writes the past jobs' addresses (the register has none)? | **A** — Claude drafts them from the folder names and the documents' text; the Founder corrects them. |
| **MAP-D4** | A map in the client-facing Költségvetési Tervezet? | **A** — no. The map stays an internal intake link. |

## Data flow

```
jobs\<CODE>_*\job\funnel\decisions.json  ─┐ (Workflow Kit `address`)
jobs\<CODE>_*\job\answers_r1.json        ─┤
jobs\_elozmenyek\helyszinek.json          ─┼─► node Map/tools/build-jobs.js ──► jobs\_elozmenyek\helyek.json
jobs\_elozmenyek\REGISZTER.md             ─┤      (Map/lib/geocode.js,             │
jobs\_elozmenyek\osszegek.csv             ─┤       OFFLINE ONLY)                    ▼
Map\data\addresses.json (offline index)   ─┘                            Map/serve.js /jobs/helyek.json
                                                                                  │  no-store, logged
                                       ┌──────────────────────────────────────────┤
                         VRG Térkép page, J layer (Map/lib/jobs-layer.js)   VRG Mobile relay /p/8802/
                         ▲ Asztal Munkák 📍  ▲ ?job=CODE  ▲ Workflow Kit link   (x-vrg-via: relay)
```

- **Geocoding is offline only.** `build-jobs.js` uses the same index and matcher as the search box
  (`Map/lib/geocode.js`); Nominatim or any online service is never asked for a client address. The
  page's "Keresés az interneten" row is the user's own click on the search box, unrelated to jobs.
- **`helyek.json` holds no written address**: code, status, period, folder label, lon/lat, precision,
  source, total, the draft flag. The precision says how far the point may be from the real place:

  | `prec` | meaning | ring |
  |---|---|---|
  | `cím` | the house number itself | none |
  | `legközelebbi` | the nearest house number on the same street side | 40 m |
  | `utca` | somewhere on the street (no house numbers in the index) | 250 m |
  | `település` | the settlement centre (outside Budapest + Pest county the index has settlements only) | 1.5 km |
  | `nincs` | no place yet: listed in the legend, no pin | — |

- Totals come from `osszegek.csv`: the latest-dated file of the job, duplicate rows once.
- Related codes come from the register ("BK2 előzménye") or `kapcsolodik` in `helyszinek.json`.
- A folder name that points at a person can be replaced by `cimke` in `helyszinek.json` (JK1 does).

## The aftermath controls (MAP-D2 B)

| Control | Where |
|---|---|
| **No caching** | `/jobs/helyek.json` and `/jobs/status` answer `Cache-Control: no-store`, `nosniff`, `no-referrer`; the page fetches with `cache: 'no-store'`. |
| **Access log** | every request for `helyek.json` (and every refusal) appends one line to `jobs\_elozmenyek\helyek-log.jsonl`: `{ t, via: "local" \| "relay", ua, ok, n }`. The relay sets `x-vrg-via: relay` on everything it forwards and overwrites a value a phone sends (`Planner/projects/varler-planner/tools/relay-ports.js`). `/jobs/status` carries no client data and is not logged. |
| **Kill switch** | either of: the flag file `H:\VRG\Full\jobs\_elozmenyek\TERKEP-KI` (any content; delete it to switch back), or `"jobsLayer": false` on the M tool entry in `launcher/vrg-menu.json`. Read on every request: the layer is off at once, locally and through the relay; the J button greys out with the reason, `helyek.json` answers 403. |
| **Never in Kapu guest mode** | the page drops the layer for `?vendeg=1` / `?guest=1`. Kapu WP-G1 (guest mode, planned) must open the map with `?vendeg=1`. |
| **Never in OTG** | the M tool is `"otg": false`; on top, `serve.js` refuses the layer when `VRG_OTG=1`, a file `.otg` is in the repo root, or the repo runs from a path under `\OTG\`. |
| **Not in `?embed=1`** | unless the embedding page asks with `?jobs=1`. |
| **Visible marker** | while the layer is on, a red "● ÜGYFÉLADAT · MUNKÁK" badge sits at the top of the map. |
| **Off by default** | the layer remembers the last J state per browser; `?job=` turns it on. |
| **Not in client documents** | MAP-D4: no map in the Költségvetési Tervezet; the Kit link is console-only. |

To see who opened it: `type H:\VRG\Full\jobs\_elozmenyek\helyek-log.jsonl` (one JSON line per request).

## Ways in

- **VRG Térkép**: START **M** (server **H**, `:8802`), then **J** or the *Munkák* button.
- **`?job=CODE`**: `http://localhost:8802/?job=BK2` turns the layer on and flies to the job, tilted.
  Job codes are also found by the search box.
- **VRG Asztal → Munkák**: the 📍 at the end of each job row (`desktop.mapJob`, job codes only).
- **Workflow Kit address step** (`02_question_funnel/tools/funnel.js`): prints
  `Megnézem a térképen: http://localhost:8802/?job=<code>` after the decisions — see "Open" below.
- **Phone**: VRG Mobile → Localhost → 8802 (the relay with `--ports`), logged as `relay`.

## Confirming the drafted addresses (MAP-D3 A)

1. Open `H:\VRG\Full\jobs\_elozmenyek\helyszinek.json`. Each job has a row; drafted rows say
   `"vazlat": true`, uncertain ones also `"bizonytalan": true` with a `megjegyzes`.
2. Correct `address` (postcode, settlement, street, number; floor and door may stay, they are
   ignored), or give a manual point: `"lat": 47.5, "lon": 19.05, "pontossag": "cím"` (it wins over
   the address — use it outside Pest county, where the index has no streets).
3. Set `"vazlat": false` (or delete the line) for each row you have checked.
4. Run `node Map/tools/build-jobs.js` (`--check` first shows the result without writing). Its
   console names codes, never addresses.

On the map a draft pin has a yellow rim and its card says *vázlat*.

## Tests

`node Map/test/run.js` — the geocoder, `build-jobs.js` and the server routes (kill switches, log,
no-store, OTG) on invented addresses and jobs only. `node Map/test/make-fixture-jobs.js` writes 31
invented jobs to `Map/test/fixtures/jobs` for browser checks: the launch config `terkep-fixture`
serves them on `:8803` (`VRG_JOBS_DIR`). `Mobile/tests/relay-ports.js` checks the relay header;
`Dashboard/test/run.js WP-41` the Asztal pins (with `VRG_DESK_HOME` pointing at a throwaway folder).

## Open

- The Workflow Kit line in `funnel.js` was not applied from the worktree session (the Kit is outside
  its allowed folders); the one-line patch is in the session's hand-over note.
- Kapu guest mode (WP-G1) does not exist yet; when it does, it opens the map with `?vendeg=1`.
