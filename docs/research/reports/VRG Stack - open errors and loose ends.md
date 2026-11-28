# VRG Stack: open errors and loose ends (brief)

*2026-11-27, the companion to "VRG Stack - the layered work graph, review and outlook". This is a short list of what
could still go wrong in the PR #29 work line and what fixes it. Every page was loaded headless in Chromium against the
sandbox build. Two real errors turned up and are fixed in the same commit as this note (§1). The rest are open (§2–§4),
in the order they should be dealt with.*

## 1. Found and fixed now

| # | Error | Effect | Fix |
|---|---|---|---|
| F1 | **Konnektóm threw on the new layers.** `connectome.html`'s `LAYER` table knew only F I E A G C L Q U R K. The graph now has W V M N S T P D O J nodes, and `LAYER[it.layer].col` failed on the first one. It is the same bug main fixed for K in `f18f3d8`. | The Konnektóm page was blank on the PC and in the phone's `konnektom.html`. This has been the case since S11, when the first N node appeared. | All the layers were added, in the Viewer's colours, plus a fallback entry, so a future layer cannot break the page. `LORDER` (the legend) now follows the stack order. Checked: no page errors. |
| F2 | **The asks layer was still called K in four visible places** after the K → S re-letter (STK-P212). These were the Figyelemtérkép header, the START hint (R → Y), the catalog qualifier and two comments in `lib/asks.js`. | The labels contradicted the data. | All four changed to S. |

Every other Stack page (24 in all) loads without page errors. The two console errors left are expected:
- Érintésnyom has no live server from `file://`.
- Kisokos has no data in the sandbox.

## 2. Needs the PC (cannot be checked in the cloud)

| # | Risk | Why it is open | How to close it |
|---|---|---|---|
| P1 | **No layer has run on real data.** The jobs (M), boards (D), recordings (S, U), the Visual Base (V) and the access list (W) were only ever fixtures. | Adapters can still fail on real shapes: an odd register line, a board without a MAC, a transcript format change. | `node Stack/stack.js probe --all`, then a full `node Stack/stack.js build`. Read `out/HEALTH.md`. A failing layer is carried forward, not lost. |
| P2 | **Signal noise on real data.** `unverified`, `unreachable`, `asked again`, `job quiet` and the D/V/O signals were narrowed on small data (46 → 2, 30 → 5). | Real counts may be much higher, and a Jelzéstábla with 200 rows gets ignored. | Tune each signal to five or fewer real hits, or explain why not, in DRIFT.md. |
| P3 | **`check-start.js` was never run** on this branch. The cloud lacks the H: paths. | A new START key could point at a moved file. | `node tools/check-start.js` (exit 0). |
| P4 | **The Kapu is stale.** `Hub/dist/vrg-kapu.html` was not rebuilt, so its tool list lacks the ten new pages. The cloud rebuild kept in the stash has broken Linux paths and must not be used. | The access page under-reports what exists. | `node tools/build-hub.js` on the PC. Drop the stash. |
| P5 | **The phone side was compiled, never run.** CI built and tested the ◢ dial and the page list, but no device has opened the twelve pages. The Viewer and Érintésnyom are about 3 MB each. | They may be slow or run out of memory in the WebView. | Publish (START → R → T), then open every page from the ◢ dial on the phone. |
| P6 | **Kotlin merge choices.** `dontesek` was renamed to main's `dontesnaplo`. Five pages are dial-only (kept off the chip row). | An old bookmark or deep link to `vrg://stack/dontesek` would find nothing. | Open the Döntésnapló from the dial and from a chip. Add a redirect if old links exist. |

## 3. Structural weak points (fix in code, any session)

| # | Weak point | Suggested fix |
|---|---|---|
| S1 | ~~The layer order is copied into seven places~~ **Fixed 2026-11-28 (STK-P213).** One `Stack/schema/layers.js`; every former copy reads it, and `test/layers.test.js` fails on a page that keeps a colour table again. | — |
| S2 | ~~No guard against layer-letter collisions~~ **Fixed 2026-11-28 (STK-P214).** `tools/check-layer-letters.js`, run by `.github/workflows/stack.yml` on every Stack push and PR, fails when a letter names two layers across unmerged branches. | — |
| S3 | **The Viewer's colour uniform** (`uCol[24]`) has room for 24 planes; 21 are used. | Now asserted: `test/layers.test.js` fails when the table has more than 24 planes. |
| S4 | **Hard-coded H: paths** in `config.js`, `lib/common.js`, `archive.js`, `lens.js` and `meta.js`. The cloud sandbox has to patch them with `sed`. | One `roots()` that reads an environment variable first. The tests use it. |
| S5 | **Mobile decision D-191 is the very next free number.** Main is already at D-190 (the mérőkártya, M72). Any Mobile session that opens a decision before PR #29 merges will take D-191 too. | Merge PR #29 soon, or tell the next GO MOBILE session that D-191 is taken. |
| S6 | **The live badge polls `out/build-stamp.js` every 60 s** from `file://`, and Érintésnyom logs a refused connection when no server runs. | Harmless, but noisy in the console. Back off after the first failure. |

## 4. Rules that are not yet written down

- **A noise threshold for signals** (§2 P2): the "about five" rule lives only in decisions, not in `Stack/RULES.md`.
- **The write gateway's four checks** (path, unchanged hash, own-parser round trip, never R/U/A/C/G) should be a
  listed rule, so every future editor carries them.
- **S-layer privacy:** the asks' words never leave `out/`. Every new consumer (Kapu, phone, export) needs a test for
  it, like the one the connectome has.
