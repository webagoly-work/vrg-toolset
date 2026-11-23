# VRG Böngésző (VRG Browser)

An independent, standalone browser application: the start page, the search engine, the library and the reader in
one self-contained HTML file. It runs the same way in the **VRG Asztal** (in-shell app), **VRG Mobile**
(Alkalmazások, M21) and any **browser** (from its own local server). Web pages are always shown by the host's
own browser engine, never by the app. That keeps each host's security rules in force: the Desktop's Böngésző
pane, the phone's browser, or a new tab.

*Önálló böngészőalkalmazás: kezdőlap, keresőmotor, könyvtár és olvasó egyetlen HTML fájlban, a VRG Asztalon, a VRG
Mobile-on és böngészőben. A weboldalakat mindig a gazda saját böngészője jeleníti meg.*

## Run

| Where | How | What works |
|---|---|---|
| VRG Asztal | Alkalmazások → VRG Böngésző (catalog `browser`, `vrg-app://browser/`) | everything; pages open in the Böngésző pane; reader and documents when :8812 runs (the tile's server) |
| VRG Mobile | Alkalmazások → VRG Böngésző (M21, fetched from `main`, offline after) | start page, search engines, bangs, Gyorsválasz, bookmarks, history, reading list (saved text); pages open in the phone's browser |
| Browser | START **W → B → S** (or `node Browser/serve.js`), `http://127.0.0.1:8812/` | everything; pages open in a new tab |
| From disk | START W → B → a browser | works, but **saves nothing** (`file://` has no storage); the page says so and offers the server |

```bash
node Browser/serve.js            # http://127.0.0.1:8812 (--port, --no-open, --allow-lan)
node Browser/build.js            # src/ → dist/vrg-bongeszo.html  (--check: exit 1 when dist/ is stale)
node Browser/test/run.js         # 55 tests: core, links, server, jobs, build, page (no network; pages in headless Chromium)
```

## Modules

Every module can be switched off in **Beállítások → Modulok**. "Host" says where a module can work at all.

| Module | What it does | Host |
|---|---|---|
| **Saját kereső** (own search engine) | `src/core/engine.js`: an inverted index with field-weighted BM25, prefix and one-typo matching, Hungarian accent folding (`kotoelem` → Kötőelem) and a light suffix trim (`kábelek` → kábel). It covers bookmarks, history, the reading list with its saved full text, quick links, the PC's servers and the search engines. | all |
| **Keresőmotorok és bangek** | 26 engines in `config/engines.json`, grouped: web, knowledge, maps, manufacturers and datasheets (`!ds`, `!se`, `!hager`, `!abb`, `!legrand`), purchasing (`!tme`, `!mouser`, `!farnell`, `!conrad`, `!ar`), law and standards (`!njt`, `!msz`), development. `!w Ohm` or `Ohm !w`. The Desktop's `Dashboard/config/search.json` engines are merged in at build time. | all |
| **Keresés lap** (meta search) | `#/kereses?q=`: Gyorsválasz, own hits with snippets, the repo's documents, and every engine one click away. Alt+Enter in the omnibox. | all |
| **Gyorsválasz** (quick answers) | `src/core/answers.js`: a safe calculator (no `eval`); P / I / U for one and three phases with cos φ; voltage drop (Cu γ 56, Al γ 35, with the MSZ HD 60364-5-52 G.52.1 guide values 3 % / 5 %); Ohm's law; AWG ↔ mm²; length, power (kW ↔ LE), energy and temperature. Indicative only: the design follows the standard and the datasheet. | all |
| **Tiszta link** | strips tracking parameters (`utm_*`, `fbclid`, `gclid`, `msclkid` …) and Google's `/url?q=` wrapper before a link is opened or saved | all |
| **Linkellenőr** | warns about credentials in a URL, punycode domains, plain http, raw IPs; asks before opening a critical one | all |
| **Könyvjelzők** | `vrg.web-links` v1 rows; tags, a job code (`VRG-ÉÉHH-NN`) and a note beside each; pin to the start page; export / import one v1 file | all |
| **Előzmények** | one row per visit, shown per URL by day; in the Asztal it includes the Böngésző pane's own browsing (T1) | all |
| **Olvasó nézet** | `lib/reader.js` through `/api/reader`: a page's text without menus, ads or scripts; **Mentés offline** keeps the text on the device, readable and full-text searchable without a network (on the phone too, once saved) | Asztal, :8812 |
| **Helyi dokumentumok** | `lib/docs.js`: the repo's Markdown (527 files) in the same engine; opens in the reader | Asztal, :8812 |
| **Munkák** (T3) | per job code (the toolset's `AB12` shape): its links, saved pages and datasheets; **Exportálás a munka mappájába** (links.json in v1, INDEX.md, the saved pages as Markdown, the datasheet PDFs) through `serve.js`; **Térképen** (the Map's `?job=`); **QR-címkék** to print; Mentés fájlba (that job only). The PC's job codes come from `/api/jobs`, codes and status only | all (export: Asztal, :8812) |
| **Alkatrészek** (T4) | the Inventory's catalogue (221 parts, baked by `build.js` from `Inventory/data/vrg-inventory.json`, **no prices**): search by name, brand, part number, VRG id or GTIN; a part's card opens its manufacturer datasheet, reads and saves it offline **with the part id and a job code**, lists the vendor product pages and searches TME / Mouser / Farnell / Árukereső / datasheet PDFs for its part number, prints its QR label | all |
| **PDF adatlap az Olvasóban** (T4) | a datasheet PDF reads like a page (`lib/pdftext.js`, pdf.js from `Vendor/`, text only, per page); saved offline it is full-text searchable on every device | Asztal, :8812 |
| **Helyi VRG szerverek** | the START servers with a running lamp; User-level ones first (from the catalog), the dev ones on request | Asztal, :8812, file |
| **Telefonra** | a QR of a URL (the Inventory / Planner encoder, Project Nayuki, MIT) to open it on the phone | not on the phone |
| **Webes javaslatok** | suggestions from Google, DuckDuckGo or Wikipedia while typing, through the server, without cookies. **Off by default:** every keystroke would leave the PC. | Asztal, :8812 |

## Links: one format, one master (T1)

Bookmarks and history are **`vrg.web-links` v1** (`src/core/links.js`), the format the VRG Asztal's `<userDir>/web.json` has
always had (the two arrays) and the Data Vault's browser-kit reads (DV-Q22): `{ format, v: 1, bookmarks: [{ url, title, at }],
history: [{ url, title, at }] }`. The work line's extra fields travel in the same file under `x-bongeszo` (tags, job, note per
URL; the reading list; the pins); the other readers ignore it. `test/links.test.js` repeats the DV kit's contract cases.

**The master is the Asztal's `web.json`** (BRW-Q01). Each copy keeps the links locally and, once a master has answered,
records every change as an op (`bookmark`, `unbookmark`, `visit`, `forget`, `clear`; idempotent) in an outbox that
`src/core/sync.js` sends; each answer replaces the local links with *master + the ops it has not seen*. The very first
contact uploads what the master lacks; after that the master's deletions win.

| Host | The master is reached through | Notes |
|---|---|---|
| VRG Asztal | `vrg-app://browser/__vrg/links` (main, `Dashboard/shell/lib/applinks.js`) | the browser app's origin only; GET / POST ops; the pane's own visits show up here |
| `serve.js` | `/api/links` | GET reads `web.json` (+ the waiting inbox); POST writes **`web.json.inbox`**, never `web.json` itself (the running Asztal owns it and absorbs the inbox every 30 s) |
| VRG Mobile, from disk | — | the links stay on the device; move them with **Mentés fájlba / Betöltés fájlból** (a v1 file) until T7 |

The status line says where the links are ("könyvjelzők: Asztal · 3 vár" = three changes waiting for the master).

## The Desktop pane gets the brain (T2)

The pure core also runs inside the VRG Asztal itself:

- the **Böngésző pane's omnibox** (`Dashboard/shell/lib/search.js decide()`): `!bang`s from `config/engines.json`, Tiszta link on
  URLs, a link with a user name or password refused;
- the **Ctrl+K palette**: Gyorsválasz above the command rows (`230V 16A`, `2,5mm2 30m 16A`, `= 2*(3+4)`), a click or Ctrl+Enter
  copies the result.

## The work context and datasheets (T3, T4)

- **Job codes** are the toolset's own (`^[A-Z]{1,3}\d{1,3}$`, as `Map/tools/build-jobs.js` and the Asztal's `desktop.mapJob`);
  the first release's sample shape `VRG-ÉÉHH-NN` is still read. Typing a code in the omnibox offers the job (first only when
  this device knows it: `M8` is also a bolt size).
- **`/api/jobs`** (`lib/jobs.js`) lists the PC's jobs from `jobs\<CODE>_*`, `jobs\_elozmenyek\<CODE>` and the Map's
  `helyek.json`: **code, status and period only**, never a folder name, label or address; each read of `helyek.json` leaves a
  line in `helyek-log.jsonl`, as the Map's access rule asks.
- **`POST /api/jobs/<CODE>/export`** writes into that job's existing folder, under `web\`: `links.json` (v1 + extension),
  `INDEX.md`, `olvaso\*.md` (the saved texts with their source and date) and, when asked, `adatlapok\*.pdf` (downloaded
  through `lib/netguard.js`, 25 MB each). The reply names the code, never the folder. Same write rules as `/api/links`
  (own page or the Asztal's app origin, JSON). A code without a folder is refused, nothing is created elsewhere.
- **PDF**: `node tools/fetch-vendor.js pdfjs` once on the PC (Vendor/ is not in git); without it the reader says so.
- **QR labels** (`#/munkak/<CODE>/cimkek`, a part's QR-címke): A4 sheets of 3 × 8, 2 × 4 or 4 × 10 labels; printing shows the
  sheet only.

## How the hosts open pages

`src/core/host.js`: the app never builds an iframe or a proxy for web pages.

- **VRG Asztal** (`vrg-app://browser/`): a top-level navigation is caught by main (`Dashboard/shell/lib/views.js`
  `createApp → onLink`) and opened in the Böngésző pane: tabs, find, zoom, the `persist:vrg-web` partition. The app
  view itself stays where it was.
- **VRG Mobile** (`https://browser.appassets.androidplatform.net/`): `AppsFeature.shouldOverrideUrlLoading` hands a
  main-frame http(s) navigation to the phone's browser. Requests off the app's origin are refused, so the server
  modules switch themselves off there.
- **Browser**: a new tab (`noopener,noreferrer`).

## Safety (serve.js)

- Bound to `127.0.0.1`. The Host header must name the server (this stops DNS rebinding). An Origin, when sent, must
  be the server itself or `vrg-app://browser`. The server is read-only, writes nothing to disk and keeps no copy.
- The reader fetches through `lib/netguard.js`: http / https only, no credentials in the URL, and **public
  addresses only**. The check runs inside the socket's DNS lookup, so a name that resolves to this PC or the LAN is
  refused. Every redirect hop is checked again, with a 3 MB cap, a 12 s timeout and at most three pages at once.
  `--allow-lan` lifts the rule for the LAN only, never for this PC.
- Reader blocks are plain text and rendered with `textContent`: no markup from a fetched page reaches the DOM.
- Documents: only files in the index can be opened (`/api/doc?path=` names an index entry).

## Files

```
Browser/
  serve.js                the local server (:8812)          build.js   src → dist (deterministic, --check)
  config/engines.json     engines, bangs, groups            config/quicklinks.json   the start page's default tiles
  src/index.html          template + the UI Kit region (inline.js --sync-app)       src/app.css
  src/core/               engine · url · answers · links · store · sync · host   (pure; links / url / answers are also
                          loaded by the VRG Asztal's shell: Dashboard/shell/lib/bookmarks.js, search.js, the palette)
  src/vendor/qr.js        the QR encoder, copied unchanged (MIT notice inside)
  src/app/                ui · context · omnibox · views · work (Munkák, Alkatrészek, labels) · main
  lib/                    netguard · reader · pdftext · docs · suggest · jobs
  test/                   run.js + *.test.js
  dist/vrg-bongeszo.html  the built app (committed: VRG Mobile fetches it from main)
```

**Adding a search engine:** one line in `config/engines.json` (`id`, `hu`, `group`, `bangs`, `url` with `{q}`), then
`node Browser/build.js`. A bang may belong to one engine only (the build fails otherwise).

**Adding a module:** an entry in `MODULES` (`src/app/context.js`), with `hosts` when it needs the server, plus its
use behind `ctx.on('<id>')`.

## Data

On the device, in the app origin's `localStorage` (`vrg-bongeszo:v1:` `links`, `meta`, `reading`, `settings`, `outbox`,
`master`): up to 2000 bookmarks, 20 000 history rows (the Asztal's limits) and 300 reading-list items (200 kB of text each).
In the Asztal and from `serve.js` the bookmarks and the history are a copy of the master (above); the reading list, tags,
job codes and pins stay per device and travel in the export. The first release's keys are migrated once. **Mentés fájlba /
Betöltés fájlból** is one `vrg.web-links` v1 file; it also loads the Asztal's `web.json` and the first release's
`vrg-bongeszo/1` backups (on the phone, Mentés copies the JSON to the clipboard).

**The default search engine** is asked once on the start page (BRW-Q02); the Data Vault's personal line keeps none.
