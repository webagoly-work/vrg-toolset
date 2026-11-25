# VRG Böngésző — the trajectories (the T line)

*Written 2026-11-23 after the base app (`Browser/`, commit 8588a6c) and the review against the VRG environment and the
Data Vault's parallel browser line (DV-Q22, `webagoly-work/data-vault` `docs/plans/DV-Q22-browser.md`). The Founder
answered the four questions below with **A** on 2026-11-23 and asked to proceed with the T line.*

## The review in one paragraph

The base app fits the house rules (one file, UI Kit, START + catalog, M21 to the phone, the Desktop's web contract) and
its VRG parts carry the value (Gyorsválasz, supplier and datasheet bangs, job codes, offline datasheets). It also began
the tangle `docs/desktop/ARCHITECTURE.md` §1 names: a **third bookmark and history list** (beside the Desktop's
`web.json` and DV's `vrg.web-links`), a **third search** (beside the palette and Belső keresés), and it is **blind to
real browsing** (the Desktop pane sees every page, the app only what it opened). The Data Vault line shows the way out:
two lines that share **one contract and one links format**, not code; the browser as separate, switchable parts; an
offline half and a live half.

## Decisions (BRW-Q01 … Q04, 2026-11-23, all A)

| # | Question | Answer |
|---|---|---|
| **BRW-Q01** | The master bookmark list | **A** — the Desktop's `<userDir>/web.json` in `vrg.web-links` v1; every other copy syncs to it |
| **BRW-Q02** | The default search engine | **A** — the work line keeps a default, chosen once by the user (first run asks); the personal DV line keeps none |
| **BRW-Q03** | Work and personal | **A** — two lines, one format: work links stay in the VRG toolset, personal ones in the Data Vault, moved between them only explicitly (a `vrg.web-links` file) |
| **BRW-Q04** | Live browsing on the phone | **A** — VRG Mobile for work pages (PARITY row 23, the M20 `web` window); the DV companion for personal ones (DV-Q22 Q1a) |

T9's decisions (2026-11-25):

| # | Question | Answer |
|---|---|---|
| **BRW-Q05** | Where a guest (no GitHub sign-in) sees shared links | **A** — a standalone guest page, `VRG-Megosztott\00_START\linkek.html`, made from a list the user picks, and a **Linkek (vendég)** button on the Kapu's sign-in card that opens it. Decides only this part of WP-G1 (GO-HUB §7); the rest of guest mode stays open |
| **BRW-Q06** | Where shared lists live | **B** — a new top-level folder, `VRG-Megosztott\60_Linkek` (`docs/hub/hub-seed.json` → `od-links`) |
| **BRW-Q07** | What a shared list carries | **C** — everything it holds: tags, job codes, notes, saved reading text (only the people the folder is shared with see it). The history is never a list |

## The format: `vrg.web-links` v1 (shared with the Data Vault's `browser-kit`)

```
{ "format": "vrg.web-links", "v": 1, "exported"?: "…",
  "bookmarks": [ { "url", "title", "at" } ],          // unique by url, ≤ 2000, at = ms (0 = unknown)
  "history":   [ { "url", "title", "at" } ],          // oldest first, one row per visit, ≤ 20000
  "x-bongeszo"?: { "meta": { "<url>": { "tags", "job", "note" } }, "reading": [ … ], "pinned": [ "<url>" ] } }
```

The Desktop's `web.json` is the same two arrays without the envelope, and both readers ignore unknown keys, so the
`x-bongeszo` extension (the work line's tags, job codes, notes, reading list) travels in the same file without either
side losing anything. Rules: http(s) only, ≤ 4096 characters; titles ≤ 300; a merge never loses a row (a bookmark in
both keeps the earlier `at` and the longer title; history is every distinct `(url, at)`); a newer `v` is refused, never
half-read. `Browser/src/core/links.js` implements it; `Browser/test/links.test.js` repeats the DV kit's contract cases.

## The trajectories

| # | Trajectory | Phase |
|---|---|---|
| **T1** | **One links format.** The app's store keeps `vrg.web-links` v1; the Desktop's `web.json` is the master: in the Asztal the app reads and writes it through main (`vrg-app://browser/__vrg/links`, the browser app's origin only), from `serve.js` through an inbox the Desktop absorbs; the phone syncs by file. Export / import is the v1 file. | **1** |
| **T2** | **The Desktop pane gets the brain.** The app's pure core (`url.js`, `answers.js`) inside the Böngésző pane's omnibox (`shell/lib/search.js`: bangs from `Browser/config/engines.json`, Tiszta link, a link with credentials refused) and Gyorsválasz in the Ctrl+K palette. | **1** |
| **T3** | **Work-context browsing.** A per-job view (links, saved datasheets, quotes, research by job code), exported into `jobs\<code>\web\`, the Workflow Kit and the Map / Weather job layers. Job codes only. | 2 |
| **T4** | **Datasheets and parts.** PDF in the reader (`Vendor/pdfjs`, legacy build), saved offline, attached to Inventory items; a cabinet label's QR opens the datasheet on the phone; supplier pages feed Inventory's price check. | 2 |
| **T5** | **Knowledge and AI.** Saved pages as VRG Stack nodes; "Küldés Claude-nak" (the kit's `context-tray`) to the Desktop chat pane; a research mode writing sourced notes; the docs index as a source of Belső keresés. | 3 |
| **T6** | **Watching the web.** Page-change watches (NJT, MEKH, standards, prices) as Feed pane presets (WP-29), alerts to Mobile M10. | 3 |
| T7 | **Real browsing on the phone** (BRW-Q04). The confined WebView `web` window of PARITY row 23 / M20, keeping the contract and writing `vrg.web-links`. | 4 |
| T8 | **Parts as plugins** (from DV). The module list becomes manifests (id, needs `net` / `web` / `storage`, hosts); page modules become swappable, matching DV's cells and its `web` need (DV-Q22 Q4). | 4 |
| T9 | **Sharing.** A guest-safe link page in the Kapu; shared reading lists through the shared OneDrive folder. | 5 |

## Phase 1 (T1 + T2) — built 2026-11-23

**T1 · one links format.** `Browser/src/core/links.js` (v1: read / write / merge / visit / toggle / prune / ops / grouped; the
DV kit's contract cases in `Browser/test/links.test.js`). The app's store keeps v1 rows plus `meta` (tags, job, note per URL)
and an outbox of idempotent ops; `src/core/sync.js` talks to the master: in the Asztal `vrg-app://browser/__vrg/links`
(`Dashboard/shell/lib/applinks.js`, the browser app's origin only), from `serve.js` `/api/links` (reads `web.json`, writes
`web.json.inbox`, which `Dashboard/shell/lib/bookmarks.js absorb()` takes). The first contact uploads what the master lacks,
later the master's deletions win. The phone moves links by file until T7. The first release's storage migrates once; its
`vrg-bongeszo/1` backups still import. BRW-Q02: the start page asks once for the default engine.

**T2 · the pane gets the brain.** `Dashboard/shell/lib/search.js decide()` (bangs, Tiszta link, a password-carrying link
refused; `toUrl()` unchanged) behind `web.go` and `omni:`; Gyorsválasz in the Ctrl+K palette.

Tests: `node Browser/test/run.js` 50 (core, links, server, build, page: the served page pulls a `web.json` bookmark and its
own bookmark and visit land in the inbox); `Dashboard/test/wp-50.test.js` 5; `wp-18` 9 unchanged.

**Not verified here** (no Electron, no phone in the cloud session): the Asztal's real `vrg-app` door and the pane's omnibox in
`VRG Desktop.exe`; check on the PC:

1. START D (or the exe) → Alkalmazások → VRG Böngésző: the status line says "könyvjelzők: Asztal"; the Böngésző pane's
   bookmarks appear under Könyvjelzők, a page visited in the pane appears under Előzmények within 20 s.
2. A bookmark added in the app shows in the pane's ☆ list.
3. The pane's omnibox: `!tme NYM-J 3x2,5` opens TME's search; `index.hu/?utm_source=x` opens without `utm_source`;
   `https://a:b@x.hu/` is refused with a Hungarian message.
4. Ctrl+K → `230V 16A` shows 3,68 kW above the rows; Ctrl+Enter copies it.
5. START W → B → S, then the app at :8812 with the Asztal running: a bookmark added there reaches the pane within 30 s.

## Phase 2 (T3 + T4) — built 2026-11-23

**T3 · work context.** The job code is the toolset's own (`AB12`, `^[A-Z]{1,3}\d{1,3}$`; the first release had used the UI
kit's sample shape, still read). New pages: **Munkák** (the codes of this device's links plus the PC's jobs from
`/api/jobs`, codes and status only) and one job's page (its links, datasheets, saved pages; Térképen; Mentés fájlba for that
job; QR-címkék; **Exportálás a munka mappájába**: `<job folder>\web\` gets `links.json`, `INDEX.md`, `olvaso\*.md` and,
when asked, `adatlapok\*.pdf`). `Browser/lib/jobs.js`: the folder is `jobs\<CODE>_*` or `jobs\_elozmenyek\<CODE>`; a code
without a folder is refused; the reply never names the folder; reading the Map's `helyek.json` is logged as its rule asks.

**T4 · datasheets and parts.** `build.js` bakes the Inventory's 221 parts (`Inventory/data/vrg-inventory.json`: id, name,
brand, part number, GTIN, category, the manufacturer link (164, 117 of them a PDF) and the vendor product pages; no
prices). **Alkatrészek**: search and categories; a part's card reads its datasheet in the Olvasó and saves it offline with
the part id and a job code; vendor pages; supplier searches for its part number; its QR label. The reader reads **PDF**
(`Browser/lib/pdftext.js`, pdf.js legacy build from `Vendor/`, text only, by page; up to 20 MB). Labels: A4 sheets,
3 × 8 / 2 × 4 / 4 × 10, print shows the sheet only. The Inventory app itself is not changed: the link lives on the browser's
side (a reading item's `part`), the Inventory can read it later from the export.

Tests: `node Browser/test/run.js` 55 (+ `jobs.test.js`: codes only, the log line, the folder rule, the export's files, the
routes' write rules and the Asztal origin's preflight; the reader reads an invented PDF; the page test walks part →
datasheet read and saved for T07 → job → export with the PDF → label sheet). `Mobile/tests/apps-phone.js` 38 ok.

**Check on the PC** (not reproducible in the cloud session):

1. Once: `node tools/fetch-vendor.js pdfjs`. Then START W → B → S, Alkatrészek → a part with an ABB or Schneider datasheet →
   Olvasás és mentés: the PDF's text, by page.
2. Munkák: the PC's job codes appear (and nothing but codes and status); one job → Exportálás (with PDFs): the job's folder
   has `web\INDEX.md`, `links.json`, `olvaso\`, `adatlapok\`; `_elozmenyek\helyek-log.jsonl` has a `"via":"bongeszo"` line.
3. QR-címkék → Nyomtatás on a 3 × 8 label sheet; the phone's camera opens the datasheet from a printed label.
4. In the Asztal (with :8812 running) the same export works from the in-shell app.

## Phase 3 (T5 + T6) — built 2026-11-23

**T5 · knowledge and AI.**
- **Kutatás** notebooks in the app (`src/core/research.js`, `src/app/knowledge.js`): quotes taken from the Olvasó by selecting a
  passage, the page as a source, own notes; one sourced Markdown note with numbered references and the sources list.
- **Saved pages into the VRG Stack** by the repo's own convention: the note goes to `docs/research/web/<date>_<title>.md`
  (`/api/research`), searchable at once in Helyi dokumentumok and Belső keresés, and part of the Stack once committed (the layers
  read the repo's tracked files). No new Stack source and no charter change were needed. A job's note goes to the job's
  folder instead, and the server refuses a repo note that names one of the PC's job codes.
- **Küldés Claude-nak**: in the Asztal the door's `/__vrg/claude` makes a context pack (`ctx.packText`) and the frame opens
  the chat pane with it attached; nothing is sent until the user asks. Elsewhere: clipboard + claude.ai.
- **The docs index joins Belső keresés** as its third half, Dokumentumok, opened in the same viewer as a code hit.
- Not built: an automatic research agent. The research mode is the notebook; Claude reads it through the chat pane, where
  the user decides what to ask (an agent that browses on its own is a later step, and would need its own decision).

**T6 · watching the web.** A `page-watch` kind in the Feed pane's presets (`Dashboard/shell/lib/presets.js`, WP-29): the
page's readable text against the last run; *Változott* with the new and the vanished lines in Hírek, and a notice to the
phone through the relay (`/notify`, M10). Added from the Olvasó or the Figyelés page through `serve.js /api/watch`, which
writes `<userDir>\presets.json` (the Asztal only reads it); the host joins `allowHosts` and leaves with its last watch.
The reader keeps short lines for watches (a date or a price is a change; found by a test).

Tests: `node Browser/test/run.js` 60 (+ `knowledge.test.js`; a page walk: a quote selected in the Olvasó → a notebook → the
note into a temp repo → the Claude fallback → a watch added); `Dashboard/test/wp-50.test.js` 8 (+ page-watch baseline /
unchanged / changed / the phone rung once / a failed run keeps state / the host rule; the Claude door; Belső keresés's
documents); `wp-29` 17 unchanged; `Mobile/tests/apps-phone.js` 38 ok.

**Check on the PC** (not reproducible in the cloud session):

1. In the Asztal: VRG Böngésző → Olvasó → a page → select a paragraph → Idézet a kutatásba → Kutatás → Küldés Claude-nak: the
   chat pane opens with the pack attached; a question answers from it.
2. Kutatás → Mentés a repóba: the note is in `docs/research/web/`; START shows it as a change; Belső keresés finds it under
   Dokumentumok. With a job code in the text it is refused.
3. Olvasó → Figyelés (naponta) on an NJT page: `presets.json` has the watch; the Hírek pane shows *Figyelés indult*; after a
   change on the page *Változott*, and with the relay running (START O → 7) the phone's Értesítések ring.

## Phase 4 (T7 + T8) — built 2026-11-24

**T7 · real browsing on the phone** (BRW-Q04 = A: work pages in VRG Mobile). WP **M66 Böngésző** (`docs/mobile/WP/M66.md`),
a native feature `web` with a confined WebView that keeps the Asztal's contract: http / https only, no bridge into the app,
file / content access off, no mixed content, no third-party cookies, every permission and geolocation request denied,
certificate errors never overridden, one view (no pop-ups), a download handed to the phone's browser after a yes, only an
origin in the log.
- The rules are a Kotlin port of the PC's (`kit-core` `WebRules`: the address bar, `!bangs` of the bundled
  `Browser/config/engines.json`, Tiszta link; `WebLinks`: `vrg.web-links` v1). **One fixture, two languages:**
  `Browser/test/fixtures/links-contract.json` (reads, merge, visits, ops, strip, 15 address-bar cases) is replayed by
  `links.test.js` and by `WebTest.kt`; `WebTest` also keeps the bundled engines equal to the PC's file.
- Bookmarks and history are `filesDir/web/links.json` in v1; ⚙ → Export / Import exchanges them with the PC (the VRG Böngésző
  loads the file; opened in the Asztal, the rows go on to its `web.json`) and the Data Vault's browser-kit.
- The shell sends web addresses here: the Kommand's URLs, the Asztal's Böngésző unit (desk-gen `web` → native `web`), and the
  VRG Böngésző web app's pages (AppsFeature → `vrg://web?u=…`, through the new `FeatureHost.openRoute`). Other web apps'
  outside links still go to the phone's browser.
- Home: page 7 (Egyéb), because the test pins the Founder's pages 1–5; moving it is one line in `HomeLayout`. The Katalógus
  page `web` (BOTH) replaces the Desktop-only `desk:web` page.
- Not built: syncing with the Asztal over the relay (it is by file now), the reader on the phone, per-site settings.

**T8 · parts as plugins.** `Browser/modules.json` (`vrg.browser-modules` v1) is the module list as manifests: 16 parts, one
per source file in load order, 4 of them plugins (`answers`, `qr`, `work`, `knowledge`). Each declares needs (`net`, `web`,
`storage`), hosts, the routes it calls, its switches and nav entries. `lib/modules.js` checks the manifest against the
code (fetch → net, opening pages → web, localStorage → storage, every route named in a file declared); `build.js` takes its
order from it and builds a variant with `--without <plugins>`; the app reads its switches and its rail from it, and
`ctx.api` / `ctx.post` refuse an undeclared route or a switched-off module's before sending. Beállítások → Részek lists
each part and what it may reach.
- **DV's cells:** the need words are the vault plugins' (`net`, `storage`) plus `web` limited to named hosts, which is
  DV-Q22 Q4's first option. Each plugin part is the unit a DV cell would point at (`dv.browser`'s stages B1–B6: links, the
  reader, research). The vault repo is not readable from this session, so the cell entries themselves are not written;
  that is one step on the vault side once Q4 is answered. If it is answered otherwise, `NEEDS` in `lib/modules.js` follows.

Tests: `node Browser/test/run.js` 66 (+ `modules.test.js` 4: the manifest against the code, every rule catching its mistake,
a plugin leaving with its files / switches / nav / routes, the run-time route gate in a VM; + a page walk of a build without
all four plugins); the shared fixture in `links.test.js`; `:kit-core:test` 277 (+ `WebTest` 7; `HomeLayoutTest`,
`CatalogGuideTest`, `KommandTest` with the new feature); `Mobile/tests/apps-phone.js` 38 ok. The APK is built by CI.

**Check on the phone and the PC** (not reproducible in the cloud session): `docs/mobile/WP/M66.md` § Phone check (10 steps),
and on the PC: `node Browser/build.js --without work --out %TEMP%\vb.html`, open it from `node Browser/serve.js`: no Munkák
in the rail, Beállítások → Részek says what was left out.

**⏸ After Phase 4: T9 (sharing).**

## Phase 5 (T9) — built 2026-11-25

**Shared lists (BRW-Q06 = B, Q07 = C).** The app's new **Megosztás** page (plugin part `share` in `modules.json`: `core/share.js`
+ `app/share.js`, needs net and storage, routes `/api/shared` and `/api/guest`, works where the PC's server is: the Asztal and
:8812). A list is picked from the bookmarks and / or the reading list, narrowed by a tag or a job, named, and saved through
`serve.js` (`lib/shared.js`) as `VRG-Megosztott\60_Linkek\<slug>.links.json`: `vrg.web-links` v1 with everything it holds and
`x-bongeszo.share` = name, who, when. The same name updates its file; OneDrive keeps the older versions. **Közös listák**
shows every list in the folder: look into it, open a link, or load it into this device (`importAll`, nothing is lost; when
the app runs in the Asztal the rows go on to its `web.json`). A newer or foreign file is listed as unreadable, never half-read.
The root is `VRG_SHARED` or `<repo>\..\..\Shared` (on H: the junction `H:\VRG\Shared`), never guessed further.

**The guest page (BRW-Q05 = A).** The same picker → `00_START\linkek.html`, a static page (no script; a CSP that allows only its
own style; no referrer; links open as new tabs without an opener). Only what is safe for anyone goes on it: https, a public
host (not this PC, the LAN or a raw IP), no user name, no secret-looking parameter (token, key, sig, password, session …),
not a private file store (Drive / Docs, OneDrive, SharePoint, Dropbox, iCloud, WeTransfer), no job code (the PC's list, or
the old VRG-ÉÉHH-NN) and nothing tied to a job; tracking parameters stripped; notes and tags never. The page previews what
goes and what stays out with the reason; the server filters again with the PC's job codes before it writes. In the Kapu
(`Hub/`): a **Linkek (vendég)** button on the sign-in card opens `linkek.html` next to it (from OneDrive in links-only
mode; the Kapu segéd serves the same file with a CSP header in full mode). `build-hub.js` writes an empty placeholder into
`Hub/dist/`, and `--onedrive` copies it only where no `linkek.html` exists yet (the Böngésző's own is never overwritten);
`OLVASS_EL.md` explains both. Nothing else of the Kapu opens to a guest.

Tests: `node Browser/test/run.js` 74 (+ `share.test.js` 7: picking, the list file, every guest rule with its reason, the page
escaped and script-free, `60_Linkek` and `00_START` in a temp tree, the routes' Origin / JSON rule; + a page walk: a list shared,
the guest page written, a colleague's list loaded); `node Hub/test/run.js` 35/36 (+ the guest page from the Kapu segéd, the
OneDrive copy keeping an existing page; the one failure is the registry's Windows paths, the same on HEAD in the cloud).

**Check on the PC** (not reproducible in the cloud session):
1. `node tools/build-hub.js --onedrive H:\VRG\Shared\00_START` → `linkek.html` (empty) appears next to the Kapu.
2. START W → B → S, then the VRG Böngésző → Megosztás: share a list → `H:\VRG\Shared\60_Linkek\<név>.links.json`; on the
   colleague's PC (after OneDrive syncs) it shows under Közös listák and loads.
3. Vendégoldal mentése → open `00_START\vrg-kapu.html` signed out → **Linkek (vendég)** shows the links; a LAN, Drive or job
   link is not there.

**⏸ T9 built: the T line (T1–T9) is complete.**

## LOG

- 2026-11-23 — review, BRW-Q01…Q04 = A, Phase 1 started.
- 2026-11-23 — Phase 1 built (T1 + T2); ⏸ before Phase 2.
- 2026-11-23 — Phase 2 built (T3 + T4); ⏸ before Phase 3.
- 2026-11-23 — Phase 3 built (T5 + T6); ⏸ before Phase 4.
- 2026-11-24 — Phase 4 built (T7: VRG Mobile M66 Böngésző; T8: modules.json); ⏸.
- 2026-11-25 — BRW-Q05 A, Q06 B, Q07 C; Phase 5 built (T9: Megosztás, 60_Linkek, the guest page and the Kapu's Linkek (vendég)); ⏸.
