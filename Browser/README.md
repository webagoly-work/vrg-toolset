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
node Browser/test/run.js         # 60 tests: core, links, server, jobs, knowledge, build, page (no network; pages in headless Chromium)
```

## Modules

Every module can be switched off in **Beállítások → Modulok**. "Host" says where a module can work at all. Since T8 the
modules, the parts they live in and what each part may reach are one manifest, `modules.json` (see *Parts as plugins*).

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
| **Kutatás** (T5) | notebooks of quotes (select a passage in the Olvasó → *Idézet a kutatásba*), sources and own notes; one sourced Markdown note (`src/core/research.js`, numbered references, the sources list): copy, download, **save into the repo's `docs/research/web/`** (searchable at once, part of the VRG Stack once committed) or, with a job code, **into the job's folder** (`web\kutatas\`) — a note naming one of the PC's job codes is refused for the repo | all (save: Asztal, :8812) |
| **Küldés Claude-nak** (T5) | a page (from the Olvasó) or a notebook: in the Asztal a context pack attached to a new thread of the chat pane (nothing is sent until you ask); elsewhere the text on the clipboard and claude.ai | all |
| **Figyelés** (T6) | page watches the VRG Asztal runs: a `page-watch` preset in its feed registry (`<userDir>\presets.json`); its readable text against the last run; a change shows in the Hírek pane and rings the phone (relay `/notify`, Értesítések M10). Add from the Olvasó (*Figyelés*) or the Figyelés page; hourly to weekly | Asztal, :8812 |
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

## Knowledge and watching (T5, T6)

- **`/api/research`** (`serve.js`): `{ title, md, job? }` → `docs/research/web/<date>_<title>.md` in the repo (never overwrites
  another note: `-2`, `-3`…; the document index rebuilds at once) or the job's `web\kutatas\`. Refused for the repo when the
  note names one of this PC's job codes (`/api/jobs`): job codes are client data and the repo goes to GitHub.
- **`/__vrg/claude`** (the Asztal's door, `Dashboard/shell/lib/applinks.js`): `{ title, text }` from the browser app's origin
  only → `ctx.packText` writes a pack file, the frame opens the chat pane with it attached (`vrg.on('browser', 'claude')`).
- **Belső keresés** now has a third half, **Dokumentumok**: the same index as Helyi dokumentumok (`Browser/lib/docs.js`, the
  research notes included), opened in the same viewer as a code hit.
- **`/api/watch`** (`lib/watch.js`): GET the watches with their last result (from the Asztal's `cache\presets.json`), POST
  `{ url, hu, every }` / `{ remove }`. Only public http(s) pages (`lib/netguard.js` check); 60 minutes to 7 days; at most 100.
  The page's host joins the registry's `allowHosts` (the preset rule) and leaves with its last watch when the browser added it.
- **`page-watch`** (`Dashboard/shell/lib/presets.js`): the page through the preset's own fetch (allowed hosts, no redirects),
  its text by `lib/reader.js` (short lines kept: a date or a price is a change), lines compared with the last run's (≤ 600
  lines, bare dates and counters left out). First run: a baseline; no change: *Nem változott*; a change: *Változott* with the
  new and the vanished lines, and a notice to the phone through the relay on this PC (`notify` source in main). A failed run
  keeps what the watch had seen; the stored lines never go to the page.

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
  src/core/               engine · url · answers · links · research · store · sync · host   (pure; links / url / answers are also
                          loaded by the VRG Asztal's shell: Dashboard/shell/lib/bookmarks.js, search.js, the palette)
  src/vendor/qr.js        the QR encoder, copied unchanged (MIT notice inside)
  src/app/                ui · context · omnibox · views · work (Munkák, Alkatrészek, labels) · knowledge (Kutatás, Figyelés,
                          Claude) · main
  modules.json            the parts: files, needs, hosts, routes, switches, nav (T8; checked by lib/modules.js)
  lib/                    modules · netguard · reader · pdftext · docs · suggest · jobs · watch
  test/                   run.js + *.test.js
  dist/vrg-bongeszo.html  the built app (committed: VRG Mobile fetches it from main)
```

**Adding a search engine:** one line in `config/engines.json` (`id`, `hu`, `group`, `bangs`, `url` with `{q}`), then
`node Browser/build.js`. A bang may belong to one engine only (the build fails otherwise).

**Adding a module:** a switch on its part in `modules.json` (`id`, `hu`, `desc`, `on`, `runs` when it needs the server,
`api` for the serve.js routes it calls), plus its use behind `ctx.on('<id>')`; then `node Browser/build.js`.

## Parts as plugins (T8)

`modules.json` (`vrg.browser-modules` v1) lists the app's **parts** in load order: one per source file, `core` (always built)
or `plugin` (can be left out). Each part says what it **needs** — `net` (it calls a server), `web` (it opens or reads web
pages), `storage` (it keeps data on this device) — and its **hosts** (`self` = its own host: the Asztal's door or serve.js;
`127.0.0.1:8812`; `127.0.0.1:*` = the PC's servers' lamps; `*` = any page the user asks for, only `core.host` has it), the
**routes** it calls (`api`), its **switches** (the modules of Beállítások) and its **nav** entries (the view rail, by `at`).

| Part | Kind | Needs | Hosts |
|---|---|---|---|
| `answers` Gyorsválasz | plugin | — | — |
| `qr` QR-kód | plugin | — | — |
| `work` Munkák és alkatrészek | plugin | net, storage | :8812 |
| `knowledge` Kutatás és figyelés | plugin | net, storage | self, :8812 |
| `core.store`, `app.main` | core | storage | — |
| `core.sync` | core | net | self (`/__vrg/links`, `/api/links`) |
| `core.host` | core | web | `*` |
| `app.context`, `app.omnibox` | core | net | :8812 |
| `app.views` | core | net, web | :8812, the PC's servers |
| the rest (engine, url, links, research, ui) | core | — | — |

`lib/modules.js` checks the manifest **against the code** at every build: a file that calls `fetch(` must be in a part that
needs `net`, one that opens pages (`location.assign`, `window.open`) needs `web`, one that reaches `.localStorage` needs
`storage`, and every `/api/…` or `/__vrg/…` route a file names must be declared by its part, a core part or a part it requires.
Every source file must be in exactly one part. At run time `ctx.api` / `ctx.post` refuse a route no built part declares, and
one whose switch is off, before anything is sent.

**Swapping:** `node Browser/build.js --without work,knowledge --out <file>` builds a page without those plugins: their files,
switches, nav entries and routes leave together, and the page says what was left out (Beállítások → Részek). `dist/` is always
the full build. **Beállítások → Részek** shows each part of the running build and what it may reach.

The need words are the Data Vault plugins' (`net`, `storage`) plus the `web` need the Data Vault's DV-Q22 Q4 proposes for
plugins that act on a page, limited to named hosts; if the vault answers Q4 differently, `NEEDS` in `lib/modules.js` follows it.

## Data

On the device, in the app origin's `localStorage` (`vrg-bongeszo:v1:` `links`, `meta`, `reading`, `settings`, `outbox`,
`master`): up to 2000 bookmarks, 20 000 history rows (the Asztal's limits) and 300 reading-list items (200 kB of text each).
In the Asztal and from `serve.js` the bookmarks and the history are a copy of the master (above); the reading list, tags,
job codes and pins stay per device and travel in the export. The first release's keys are migrated once. **Mentés fájlba /
Betöltés fájlból** is one `vrg.web-links` v1 file; it also loads the Asztal's `web.json` and the first release's
`vrg-bongeszo/1` backups (on the phone, Mentés copies the JSON to the clipboard).

**The default search engine** is asked once on the start page (BRW-Q02); the Data Vault's personal line keeps none.
