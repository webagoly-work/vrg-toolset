# VRG Inventory — development plan

Written 2026-09-19, after Phase 0 (raw data extraction) completed.

The explicit goal of this project is **not to repeat the Planner's
single-file-spaghetti history**. So the plan below fixes the architecture
first and only then adds features, one coherent slice per session.

---

## 0. The one architectural decision everything else rests on

> **Modular source, single-file deliverable.**

The app is written as ES modules under `src/`. A tiny dependency-free Node
script (`build/bundle.js`) inlines modules, CSS and a data snapshot into one
`dist/vrg-inventory.html` that runs offline from `file://` with no server.

Why this and not "just write one big HTML":

* every module is separately testable and separately reviewable;
* the AI-assisted sessions stay cheap — a session edits 2–3 small files, not a
  6000-line document;
* other VRG tools import the *modules*, not a scraped copy of the HTML;
* the user still gets the one double-clickable file they actually want.

Why this and not a bundler (Vite/esbuild/webpack):

* no npm tree, no lockfile drift, nothing to reinstall in two years;
* the build is ~150 lines of Node we fully control.

### Layout

```
Inventory/
├─ data/                         data snapshot (source of truth, versioned)
├─ src/
│  ├─ core/
│  │   schema.js                 field definitions, types, validation, migrations
│  │   store.js                  in-memory db, indexes, query/filter/sort API
│  │   persistence.js            localStorage adapter (namespaced, versioned, quota-aware)
│  │   vendors.js                vendor registry + the "vendor visibility gate"
│  │   pricing.js                VAT, estimates, price history, change detection
│  │   categories.js             taxonomy, path parsing, official vs provisional
│  │   io/importers.js           json | csv | txt-export | planner-save
│  │   io/exporters.js           json | csv | tsv | dual-layer txt | print | clipboard
│  ├─ features/
│  │   catalog/                  browse, search, filter, sort, detail panel
│  │   selection/                order lists, quantities, per-line notes
│  │   projects/                 project containers, Planner import, hollow lists
│  │   favourites/               per-category preference lists + autofill
│  │   priceupdate/              manual vendor price check + finance log
│  │   qrcode/                   QR payload spec + generator
│  │   diagram/                  floor diagram (late phase)
│  ├─ ui/                        shared components + theme
│  └─ app.js                     composition root — wiring only, no logic
├─ build/bundle.js
├─ dist/vrg-inventory.html
└─ test/                         plain Node assertions, `node --test`
```

### Cross-cutting rules, enforced from Phase 1

1. **Vendor gate.** No vendor field ever reaches the UI except through
   `vendors.visible(itemId, field)`, which returns nothing unless that vendor
   is selected. One choke point, so the rule cannot rot.
2. **User data is never mixed into catalogue data.** Catalogue rows are
   read-only at runtime; everything the user creates lives in a separate
   `userdata` document that can be exported and imported on its own. This is
   what makes "copy the HTML, import your save, keep working" true.
3. **Every persisted document carries `schema_version`** and passes through
   `migrate()` on load. No silent shape drift.
4. **No feature reaches into another feature.** Features talk to `core`, and to
   each other only via the event bus in `app.js`.
5. **Everything the app can export, it can re-import.** Round-trip is a test,
   not a hope.

---

## Phase plan

Each phase is sized for roughly one working session and ends with something
runnable. "DoD" = definition of done.

### Phase 1 — Data contract + skeleton  ✅ *done 2026-09-19*

Delivered:

* `core/schema.js` — 33-field registry with types, validation and a real
  migration chain. `get()` **throws** on a `vendors.*` path, so the vendor gate
  is enforced by the code rather than by discipline.
* Schema 2.0.0: neutral `vrg_id` primary key (decision D1), `legacy_id` kept,
  append-only assignment in `data/vrg-id-registry.json`.
* `core/store.js` — accent-insensitive AND-search across every identifier and
  name variant, category/brand/vendor/gap filters, five sorts, gap statistics.
* `core/vendors.js`, `core/categories.js`, `core/pricing.js`, `core/format.js`.
* `build/bundle.js` — ~200 dependency-free lines; rejects the banned ES subset
  at build time with file and line, and detects import cycles.
* `dist/vrg-inventory.html` — 306 kB, offline, responsive down to 375 px.
* 35 tests: schema, migration, store, gate, categories, pricing, formatting,
  and the bundler's own rules.

Verified in a real browser from `file://`: 221 rows, no console output, the
vendor selector adds and removes the four DANIELLA columns, search and filters
behave, `window.VRG.inventory` is exposed for the other tools.

Two things the tests caught that are worth remembering: a multi-line
`export { … }` was passing through the bundler untransformed (would have been a
syntax error in the browser), and the import-cycle check was dead because the
module-cache lookup ran before the stack check.

### Phase 2 — Catalogue UI  ✅ *done 2026-09-19*

Delivered:

* `features/catalog/columns.js` — 23-column registry; each column owns its
  label, width, reader, renderer and comparator, so a new vendor field is one
  entry and never a change in the table code.
* `features/catalog/table.js` — virtualised: 33 rows in the DOM for 221 items,
  fixed 30 px rows, sticky header, click-to-sort with unknown values always
  sinking, keyboard-reachable rows and headers.
* `features/catalog/filters.js` — debounced search, category chip tree with
  counts and drill-down, brand / price / gap filters, column picker with
  show-hide and reorder, "clear filters".
* `features/catalog/detail.js` — drawer with chips, neutral fields, estimate,
  usage, the vendor block, price-history sparkline + table, name variants.
* `core/events.js` — the bus the cross-cutting rules called for.
* 21 new tests (56 total): windowing arithmetic, column state round-trip,
  comparators, the gate under every column being switched on.

Verified in the browser: 221 rows, no console output, query 1–9 ms, sorting
numeric not lexicographic, `/` focuses search, Esc closes the drawer, no
horizontal page overflow, mobile layout holds.

**One rule tightened.** `legacy_id` is stored as a neutral field but its value
*is* the DANIELLA article number, so showing it in neutral mode put a vendor
code on screen through the back door. Columns can now declare `vendorDerived`,
which the gate treats like a real vendor column; `legacy_id` is the first user.
With every one of the 23 columns switched on, neutral mode now renders zero
vendor article numbers. The cost is that the old code is invisible until you
pick the vendor — if that proves annoying in daily use, the flag is one line to
drop.

### Phase 3 — Persistence + user-owned data  ✅ *done 2026-09-19*

Delivered:

* `core/persistence.js` — namespaced localStorage with every failure mode
  handled as a result rather than an exception: storage disabled, a private
  window that throws, a full quota, and a corrupt value (quarantined under a
  `.corrupt.<ts>` key instead of being discarded). Debounced autosave with a
  `flush()` on `beforeunload` and `visibilitychange`.
* `core/userdata.js` — one versioned, self-contained document holding both
  purely own fields (megjegyzes, kedvenc, jeloles) and **overrides** of
  catalogue fields the user may fill in (tomeg_kg, gyartoi_termek_link,
  kategoria). `sanitize()` drops anything not on the allow-list, so a
  hand-edited or hostile file cannot rewrite prices or identifiers.
* The store now keeps the published catalogue immutable and serves **merged
  views** of base + overrides, with `overridden` listing which fields the user
  supplied. This is what makes the invariant real: a data rebuild replaces the
  catalogue wholesale and cannot touch user values.
* Detail drawer editing, favourite/mark columns, a favourites filter, notes
  included in the search index.
* `features/userdata/panel.js` — export to file, import from file, and reset,
  with an honest warning when the browser has no storage at all.
* 27 new tests (83 total), including the round-trip promise end to end.

Verified in a browser over http (localStorage is unavailable on `file://` and
`data:` origins, hence `build/serve.js`): edits persist across a full reload
along with the vendor, search text and column set; reset clears everything;
importing the exported file restores it exactly.

Also verified the degradation path in an origin where storage really is
blocked: the app runs, edits work in-session, and a "nincs helyi mentés" badge
plus an explicit warning tell the user to export before leaving.

One thing worth remembering: import rebuilds each record in a canonical field
order, so an exported and a re-imported document are deep-equal but not
byte-equal. Compare values, never the serialised string.

### Phase 4 — Selection + order lists  ✅ *done 2026-09-20*

Delivered:

* `core/lists.js` — named lists with quantities, line notes and a list note;
  create, rename, duplicate, merge, delete, clear. A list stores **ids and
  quantities only**, never a name or a price, so it still reads correctly after
  a catalogue rebuild and re-prices itself against whichever vendor is selected.
* userdata schema **1.1.0** with a real migration: a document written in Phase 3
  gains `lists: {}` and `activeList: null` instead of failing to load.
  `sanitize()` now validates list lines too — unknown items, zero and
  non-numeric quantities are dropped with a warning, a blank list name is
  replaced, and a dangling `activeList` is repaired.
* Columns can now declare `render()` and return a DOM node, which the table
  uses for the one editable cell: the `Lista` quantity stepper.
* `features/lists/panel.js` — the active list with editable quantities, line
  notes, per-line and total prices, and a totals bar that counts what it cannot
  price.
* Detail drawer gained a list section with `+1`, `+<pack>` and a quantity field.
* 24 new tests (107 total).

**Pack-size awareness is vendor-gated, and that is the correct behaviour**:
packaging is a vendor fact, so in neutral mode there is no warning at all. Pick
DANIELLA and lines that are not whole packs are flagged in the row and counted
in the totals.

Verified in the browser over http: a 30-line list built from the table's `+`
buttons survives a full reload with quantities, notes, the selected vendor and
the totals intact; duplicate, merge (quantities correctly summed) and delete all
behave; dark mode resolves for every new element; no horizontal overflow.

**One real bug, caught only in the browser.** The quantity cell wrote through
to the list but nothing re-rendered — the cell still showed `·`, the panel
showed zero rows and the header count stayed blank, while the data underneath
was already correct. Interactive cells now announce writes through
`ctx.onListChange`, which repaints the table and emits `lists:changed` for the
panel. Worth remembering: unit tests cannot see this class of bug, because the
state was right the whole time.

### Phase 5 — Export engine  ✅ *done 2026-09-20*

Delivered:

* `core/io/exporters.js` — pure string producers: CSV/TSV in two dialects
  (Excel-HU `;` + decimal comma + BOM, or standard `,` + dot), JSON, the
  dual-layer text, and the plain-text vendor order. Optional grouping by
  category with a **user-defined category order**; categories the user has not
  ranked keep Hungarian alphabetical order after the ranked ones, so an
  incomplete order never hides anything.
* `core/io/importers.js` — an RFC4180-ish parser (quotes, doubled quotes,
  separators and newlines inside fields, BOM, separator sniffing), a number
  parser that takes `1 234,56`, `1.234,56`, `1,234.56` and `496,91 Ft`, plus
  `parseListCsv` and `parseDualText`.
* `core/profiles.js` — saved export profiles in userdata (schema **1.2.0**):
  target, format, dialect, column set **and order**, category order, grouping,
  header. Built-in profiles are starting points: editing one **forks** it
  rather than overwriting.
* `features/export/panel.js` — profile picker, live preview of exactly what
  will be written, column and category ordering, save / clipboard / print, and
  CSV import back into a new list.

**DoD met, both halves.** Three profiles produce three genuinely different
spreadsheets from one list (verified by content, not just by not throwing), and
a list exported to grouped Excel-HU CSV re-imports through the real file input
to byte-identical lines — group headings skipped, quotes and semicolons inside
notes survived.

Exports obey the vendor gate exactly like the table: a neutral export offers no
vendor field and contains no vendor article number even when one is explicitly
requested in the column list. The vendor-order format **refuses to build
without a selected vendor** — an order addressed to nobody is worse than none.

**One real bug the tests caught.** `profiles.create()` merged the caller's
object *after* the freshly minted id, so forking a built-in profile reused its
id and silently overwrote the original. The id is now forced last.

Also fixed after browser use: the export panel forgot which profile you last
used, which would have grated daily. It now persists with the rest of the UI
state.

### Phase 6 — Category + metadata enrichment  ✅ *done 2026-09-20*

The webshop turned out to publish everything we needed as schema.org JSON-LD on
server-rendered product pages, so this became one clean pass rather than a
scraping exercise.

**How the items were found.** `robots.txt` allows crawling and names the
sitemap; the sitemap's 165 079 URLs end in `-id-<article number>`, so all 221
of our items mapped to their product pages **with zero extra requests**.
`tools/daniella-sitemap.js` caches that; `tools/daniella-fetch.js` then makes
one polite, resumable request per item and keeps ~1 kB of the ~800 kB page.

**What arrived**, and which side of the vendor line it lands on:

| | | |
|---|---:|---|
| official category path | 216 / 221 | neutral — adopted as the house taxonomy |
| weight | 214 / 221 | neutral |
| GTIN / EAN | 200 / 221 | neutral — **new field**, the best key for matching a second vendor |
| manufacturer datasheet | 164 / 221 | neutral |
| webshop gross price | 201 / 221 | vendor block |
| stock level | 221 / 221 | vendor block |
| product URL | 221 / 221 | vendor block — **Phase 7's prerequisite, now met** |

Schema 2.1.0 adds `gtin` and `kategoria.forras`, with a migration.

**A promotion is not a category.** Seven items came back filed under
`Akciós termékek > Heti Akció: Weidmüller válogatás` and similar — a weekly
sale, which would have been wrong the following week. Those roots are rejected
outright. Two of them were recovered from a **colour-variant sibling** (the
green terminal has the real path; its blue and grey twins were in the promo),
recorded as `daniella-webshop-testver:<donor>` so the inference is visible
rather than passed off as vendor truth. The remaining **five keep their AI
suggestion** and stay marked provisional — they are a one-line fix by hand in
the drawer, which is exactly what the override mechanism is for.

The drawer now names the provenance of every category, because "the vendor
says so", "inferred from a sibling" and "you typed it" are three different
degrees of confidence.

**Name cleanup.** All 17 names that embedded the vendor's own article number
are cleaned, with the original kept in `nev_valtozatok`. Zero remain.

**A useful side-effect**: our partner net price is visibly below the webshop's
gross — `OBO2000378` is 496,91 Ft net (631 Ft gross) against a 799 Ft shelf
price. Keeping the two apart was the right call.

Tests: 135, including four new ones asserting that no promo root survives, that
every official category names its source, that the inferred pair resolves to a
real donor, and that the path is stored leaf-most-first as the user specified.
Seven older tests that had pinned "Phase 0 emptiness" as if permanent were
rewritten to assert the right thing rather than re-pinned to new magic numbers.

### Phase 7 — Price update + finance log  ✅ *done 2026-09-20*

Delivered:

* `tools/pricecheck.js` — the local helper decision D2 called for. Reuses the
  product URLs collected in Phase 6, so it needs no search and no sitemap
  re-download; writes `price-check-<date>.json`. `--list lista.csv` scopes a
  check to the items on an exported order list.
* `core/pricecheck.js` — parse, **plan**, apply, the save-prompt rule and the
  log summary, all pure and testable.
* `features/pricecheck/panel.js` — load a check, review the diff, apply it,
  and browse the finance log.
* userdata schema **1.3.0** adds the vendor overlay (`vendorData`), the
  append-only `financeLog` and the `saveLog`, with a migration.
* 19 new tests (154 total).

**A plan writes nothing.** The diff is computed and shown first — biggest move
at the top — and only the Apply button touches anything. Verified live:
loading a 20-item check with 3 changes left `vendorData` and `financeLog`
completely empty until Apply was pressed.

**Where a refreshed price lives.** Not in the catalogue: the app only owns the
user document, and a data rebuild must not erase a reading. So a check writes
an overlay into userdata, which `mergeItem` folds into the item's vendor block
— which means **the gate keeps working unchanged**: a refreshed price is still
invisible until that vendor is selected. Only `aktualis_brutto_ar_huf`,
`keszlet_db`, `termek_link` and `ar_ellenorizve` are refreshable; a hand-edited
file cannot reach `netto_egysegar_huf`, `listaar_netto_huf` or the pack size,
and there is a test that tries.

**An unchanged reading is still a reading.** It refreshes `ar_ellenorizve` so
"checked today, same price" is distinguishable from "never checked", but it
produces no log entry, because nothing happened.

**DoD met exactly**, verified in the browser: three simulated changes produced
three log entries and one save prompt with one file written; a second check the
same day logged its change but did **not** prompt again — *"Ma már mentettél
(2026-09-20), ezért nem kérdezek rá újra."* All of it survived a reload.

A real run against the live site (40 items) came back **40 unchanged, 0
changed** — correct, since the baseline was collected hours earlier, and a
useful confirmation that the comparison is stable rather than noisy.

The two prices coexist correctly: on `VRG-0004` the shelf price moved
263 → 302 Ft while our negotiated 161,46 Ft net and the 207 Ft list price
stayed exactly where they were.

### Phase 8 — QR handoff  ✅ *done 2026-09-20*

Reading the Planner's `docs/qr-subsystem.md` first was the right call, and it
changed the design twice.

**The engine is shared, not reinvented.** `src/core/qr.js` is the Planner's
encoder (Nayuki v1.8.0, MIT) with the same function names and the same result
shape — its own documentation says that file is meant to be copied into the
next project unchanged. A test asserts our encoder reproduces the Planner's
documented smoke result (`version 3, 29×29`), so the two tools are provably
running the same engine and a fix in one is a known patch for the other.

**Chunking was dropped, with the user's agreement to be asked for.** Decision
D3 called for a multi-part sequence when a list overflows one code. The Planner
had already rejected that, and the reasoning holds: a phone's own camera reads
one code and shows its text — it cannot reassemble a numbered sequence, and our
own page cannot be the scanner either, because `getUserMedia` needs a secure
context and `file://` is not one. So chunked codes would be readable by nothing
the user owns.

Then the measurement made it moot: with the compact payload the **entire
221-item catalogue is 1557 bytes — 53% of a single code**. A 25-line list is
189 bytes. No realistic order list can overflow, so the case chunking existed
to serve does not arise.

**Two payloads, because there are two readers.**

| target | for | size |
|---|---|---|
| list — readable text | a phone's camera, which shows it and lets you share it into a message | ~40 lines |
| list — compact data | pasting into another copy of the app; ids and quantities only | hundreds of lines |
| one item | a label for a shelf or a box: name, VRG id, manufacturer code, EAN, weight | tiny |
| free text / address | a LAN address you would otherwise type into a phone by hand | — |

The compact format is deliberately uncompressed ASCII: a QR encoder packs
alphanumerics better than it packs base64 of a deflate stream, so "compressing"
it would make the code *bigger*.

The round trip is verified end to end in the browser: 25 lines → compact code →
pasted back → 25 identical lines. Over-capacity refuses honestly and names the
two real fixes — and only suggests lowering the error correction when there is
room to lower it, because advice to do what you have already done makes every
other message less believable.

The vendor gate holds here too: an item code carries the neutral identifiers,
and gains the DANIELLA article number and product link only once that vendor is
selected.

**Not verified, and it needs real hardware:** that a generated code actually
*scans*. `BarcodeDetector` is absent from this browser build, so the check
could not run here. The Planner's own checklist carries the same open item —
"a code that renders is not a code that scans". Point a phone at one before
relying on it.

### Phase 9 — Projects + Planner import  ✅ *done 2026-09-20*

Delivered:

* `core/plannerimport.js` — reads a `.vplan.json` and turns the drawing into
  requirements: devices counted per type, cable runs measured in 3-D (height
  counts, not just plan distance) and totalled per build method.
* `core/projects.js` — a job with an address, a date, the imported plan and the
  order list that answers it. The project **owns a list rather than duplicating
  one**, so quantities, notes, totals, export and QR all work on it unchanged.
* `features/projects/panel.js` — import, per-requirement progress bars, and
  autofill from favourites.
* userdata schema **1.4.0** adds `projects` / `activeProject`, with a migration
  and repair of a project pointing at a list that no longer exists.
* 20 new tests (192 total), run against the **real** `P33_vplan_updated.json`
  rather than a fixture.

**DoD met end to end in the browser**: importing the real plan produced
84 devices → 7 requirements (36 sockets, 26 lights, 15 switches, 5 device
boxes, 2 junction boxes, 2.66 fm wiring, 1.88 fm conduit) with every counter at
zero; autofill then drove all seven to ✓, and it survived a reload.

Two rules the importer keeps:

* **Nothing is invented.** A socket needs a frame and a box in practice, but
  the drawing does not say so, so the import does not claim it does.
* **An unrecognised device type is reported, never dropped.** It still appears
  as a requirement, marked ⚠ and uncategorised, because a plan that quietly
  loses a third of its sockets is worse than one that refuses to import.

**A real modelling bug the browser run exposed.** Autofill filled both
"Szerelvénydoboz" and "Kötődoboz" with the *same* product, because their
category sets overlapped — so one box ticked off two requirements and the
progress read as twice the material on the list. The fix is not disjoint rules:
flush conduit and surface conduit legitimately share "Gégecsövek", and both are
conduit. Instead `parsePlan` **merges requirements that share a category set**
(summing the metres, joining the labels), and a test asserts the merged sets
are pairwise disjoint. After the fix each requirement draws a distinct item —
the device box gets a Kopos plasterboard box, the junction box an OBO
leágazódoboz.

Autofill prefers a **favourite** in the category and says so, falling back to
the most frequently ordered; like the price check, it shows the full proposal
and writes nothing until confirmed.

### Phase 10 — Floor diagram  ✅ *done 2026-09-20*

Delivered:

* `plannerimport.extractDrawing()` — pulls the geometry out of a Planner save
  (levels, room polygons, device positions, openings, bounding box). ~10 kB for
  P33, stored inside the project alongside the requirements.
* `core/diagram.js` — `buildDiagram({ rajz, progress, szint, kiemeltKategoriak })`
  is a **pure function of geometry and progress**. It keeps no state, so a
  symbol is green because the requirement it belongs to is satisfied, not
  because something remembered to colour it. Coordinates stay in millimetres
  and go straight into the SVG `viewBox` — no scaling arithmetic to get wrong.
* `features/projects/diagram.js` — renders rooms, openings and one symbol per
  device (circle = aljzat, square = kapcsoló, star = lámpa, diamond =
  kötődoboz, hollow square = szerelvénydoboz), plus level tabs and a clickable
  legend with per-category `van/kell` counts and ✓ ticks.
* Selecting a catalogue item lights up exactly the symbols it could answer;
  clicking a legend row filters the catalogue to that category.
* `sanitizeDrawing()` in `userdata.js` so an imported drawing is bounded and
  type-checked like everything else the user can hand us.
* 9 new tests (201 total).

**DoD met — the diagram and the list structurally cannot disagree**, because
the panel renders both from the *same* `prog` object in the same pass. Verified
in the browser against the real P33 plan: 11 rooms, 84 symbols, 13 openings,
viewBox `239 1706 10619 7892`. With an empty list all 84 symbols were grey and
the legend read `Aljzat 0/36, Lámpa 0/26, Kapcsoló 0/15, Szerelvénydoboz 0/5,
Kötődoboz 0/2`; autofill turned all 84 green with ✓ on every legend row;
selecting a Forix socket highlighted exactly 36 symbols, all of type Aljzat.
Knocking the socket quantity back to 10 and the lamps to 0 split the drawing
into 22 green / 36 amber / 26 grey with the legend matching the table row for
row.

**A CSS specificity bug the screenshot could not catch.** `svg.floorplan
.symbols .sym` (0,3,1) out-ranked `svg.floorplan .sym-kesz` (0,2,1), so a
finished symbol kept the grey fill even though the correct class was applied.
Nothing looked broken — the drawing rendered, the classes were right, the
tests passed, and grey-on-dark simply read as "not done yet". It only surfaced
by reading *computed* styles (`rgb(154,150,143)` where `rgb(31,122,77)` was
expected). The state-colour rules are now written at matching specificity, and
a comment in `theme.css` says why they must stay that way.

### Later (explicitly out of scope for now)

Password-protected encrypted user files · GitHub pull/push sync ·
the Kezdőlap dashboard with re-pointable dynamic links ·
multi-user logins and SCP-style clearance levels.

These are recorded so the architecture leaves room for them — in particular,
`userdata` being a separate, self-contained, versioned document is precisely
what makes encryption and sync additive later rather than a rewrite.

---

## Decisions taken (2026-09-19)

**D1 — Identifier scheme: neutral `vrg_id`.**
`vrg_id` (`VRG-0001` …) becomes the primary key in Phase 1. The DANIELLA
article number moves entirely into `vendors.daniella.cikkszam`; the current
value is additionally kept as `legacy_id` so every existing reference, export
and CSV produced in Phase 0 still resolves. `legacy_id` is never used for
lookups in new code — it exists only for traceability back to the Phase 0 data.

**D2 — Price fetch: local Node helper, with manual paste as the permanent
fallback.** `tools/pricecheck.js` reads `daniella_termek_link` for the selected
items, fetches the product pages, and writes a `price-check-<date>.json` that
the HTML imports. The app always also offers "open the product page and paste
the gross price", so the feature never depends on the helper being runnable.
Consequence: **`daniella_termek_link` must be collected in Phase 6**, before
Phase 7 can do anything automatic.

**D3 — QR payload: one compact code. The chunking half was dropped in Phase 8,
and the revision is worth reading before anyone proposes it again.**
A QR carries `vrg_id` + quantity pairs as plain ASCII — uncompressed, because a
QR encoder packs alphanumerics better than it packs base64 of a deflate stream.

The multi-part sequence did not survive contact with the Planner's existing QR
subsystem, which had already rejected it for a reason that still holds: a
phone's own camera reads one code and shows its text, and cannot reassemble a
numbered sequence. Our own page cannot be the scanner either — `getUserMedia`
requires a secure context and `file://` is not one. Chunked codes would
therefore be readable by nothing the user owns.

Measurement then made it moot: the entire 221-item catalogue encodes to 1557
bytes, 53% of a single code. No realistic order list can overflow.

**D4 — Planner save format: the per-project export from the left sidebar.**
`Planner/projects/varler-planner/src/11b-backup.js` writes one
`<név>.vplan.json` per project (and a `.vbackup` bundle of all of them). The
per-project file is the Phase 9 import target and looks like:

```jsonc
{ "format": "varler-planner", "version": 1, "name": "P33",
  "saved": "2026-09-11T04:50:05.408Z",
  "project": { "v": …, "state": …, "LH": …, "DROPC": …, "GAP": …, "guides": … } }
```

A real sample already exists at `Calculator/P33_vplan_updated.json`, so Phase 9
can be designed against it without waiting for an export. Note the Planner also
has `docs/qr-subsystem.md` and a `mobile/phone-sender.html` — read both before
Phase 8 rather than inventing a second QR scheme.

**D5 — A second vendor is coming, gradually.** The gate is therefore tested
against two vendors from now on (`test/multivendor.test.js`), including the
case most likely to leak: an item only one of them carries.

## Still open

Nothing blocking. Raise anything new as it comes up.
