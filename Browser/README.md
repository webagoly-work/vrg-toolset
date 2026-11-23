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
node Browser/test/run.js         # unit, server and page tests (no network; the page test uses the pre-installed Chromium)
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
| **Könyvjelzők** | tags, a job code (`VRG-ÉÉHH-NN`), a note, pin to the start page, export / import (`vrg-bongeszo/1` JSON) | all |
| **Előzmények** | what was opened through the app (the host's browser keeps its own), by day, deletable | all |
| **Olvasó nézet** | `lib/reader.js` through `/api/reader`: a page's text without menus, ads or scripts; **Mentés offline** keeps the text on the device, readable and full-text searchable without a network (on the phone too, once saved) | Asztal, :8812 |
| **Helyi dokumentumok** | `lib/docs.js`: the repo's Markdown (527 files) in the same engine; opens in the reader | Asztal, :8812 |
| **Helyi VRG szerverek** | the START servers with a running lamp; User-level ones first (from the catalog), the dev ones on request | Asztal, :8812, file |
| **Telefonra** | a QR of a URL (the Inventory / Planner encoder, Project Nayuki, MIT) to open it on the phone | not on the phone |
| **Webes javaslatok** | suggestions from Google, DuckDuckGo or Wikipedia while typing, through the server, without cookies. **Off by default:** every keystroke would leave the PC. | Asztal, :8812 |

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
  src/core/               engine · url · answers · store · host          (pure, also loaded by node tests)
  src/vendor/qr.js        the QR encoder, copied unchanged (MIT notice inside)
  src/app/                ui · context · omnibox · views · main
  lib/                    netguard · reader · docs · suggest
  test/                   run.js + *.test.js
  dist/vrg-bongeszo.html  the built app (committed: VRG Mobile fetches it from main)
```

**Adding a search engine:** one line in `config/engines.json` (`id`, `hu`, `group`, `bangs`, `url` with `{q}`), then
`node Browser/build.js`. A bang may belong to one engine only (the build fails otherwise).

**Adding a module:** an entry in `MODULES` (`src/app/context.js`), with `hosts` when it needs the server, plus its
use behind `ctx.on('<id>')`.

## Data

Everything stays on the device, in the app origin's `localStorage` (`vrg-bongeszo:v1:*`): up to 2000 bookmarks, 600
history entries and 300 reading-list items (200 kB of text each). Each host has its own origin, and therefore its
own data. **Mentés fájlba / Betöltés fájlból** moves the data between them (on the phone, Mentés copies the JSON
to the clipboard).
