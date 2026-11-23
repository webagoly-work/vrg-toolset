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
| T3 | **Work-context browsing.** A per-job view (links, saved datasheets, quotes, research by job code), exported into `jobs\<code>\web\`, the Workflow Kit and the Map / Weather job layers. Job codes only. | 2 |
| T4 | **Datasheets and parts.** PDF in the reader (`Vendor/pdfjs`, legacy build), saved offline, attached to Inventory items; a cabinet label's QR opens the datasheet on the phone; supplier pages feed Inventory's price check. | 2 |
| T5 | **Knowledge and AI.** Saved pages as VRG Stack nodes; "Küldés Claude-nak" (the kit's `context-tray`) to the Desktop chat pane; a research mode writing sourced notes; the docs index as a source of Belső keresés. | 3 |
| T6 | **Watching the web.** Page-change watches (NJT, MEKH, standards, prices) as Feed pane presets (WP-29), alerts to Mobile M10. | 3 |
| T7 | **Real browsing on the phone** (BRW-Q04). The confined WebView `web` window of PARITY row 23 / M20, keeping the contract and writing `vrg.web-links`. | 4 |
| T8 | **Parts as plugins** (from DV). The module list becomes manifests (id, needs `net` / `web` / `storage`, hosts); page modules become swappable, matching DV's cells and its `web` need (DV-Q22 Q4). | 4 |
| T9 | **Sharing.** A guest-safe link page in the Kapu; shared reading lists through the shared OneDrive folder. | after T1 |

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

**⏸ Next: Phase 2 (T3 work context, T4 datasheets and parts).**

## LOG

- 2026-11-23 — review, BRW-Q01…Q04 = A, Phase 1 started.
- 2026-11-23 — Phase 1 built (T1 + T2); ⏸ before Phase 2.
