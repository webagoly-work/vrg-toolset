# AI-CONTEXT — vrg-inventory

Agent-facing specification. Read this before touching `data/`.
A generated copy of the essentials is embedded at the bottom of
`EXPORT_vrg-inventory.txt`, so a single exported text file is enough to
reconstruct the database and its rules from scratch.

```
schema            vrg-inventory
schema_version    2.1.0
generated         2026-09-20
primary_key       vrg_id   (neutral, e.g. VRG-0042)
currency          HUF
vat_rate          0.27
encoding          UTF-8
```

## Identifiers

`vrg_id` is the primary key and is **vendor-neutral on purpose**: the whole
point of this database is that no single vendor owns the identity of an item.
Assignment is recorded in `data/vrg-id-registry.json` and is append-only — a
rebuild, a reordering or a new item must never change an id that was already
handed out, because user lists, project files and QR payloads reference it.

`legacy_id` carries the DANIELLA article number that was the primary key in
the Phase 0 snapshot (schema 1.0.0). It exists for traceability and for
importing old files; new code must not look items up by it except through
`store.getByLegacy()`.

The DANIELLA article number itself lives in `vendors.daniella.cikkszam` and is
subject to the vendor gate like every other vendor field.

## Purpose

Vendor-independent core inventory of electrical installation material.
It is consumed by three kinds of client:

1. the standalone interactive HTML app (`vrg-inventory.html`, not built yet),
2. other VRG tools (Planner, Kalkulátor, MindMap) that plug it in as reference data,
3. AI agents that rebuild, enrich or audit it.

## The vendor rule (non-negotiable)

Vendor-neutral facts live at the top level of an item. Vendor-specific facts
live in `vendors.<vendor_id>`. A client must not surface any field from a
vendor block unless the user has explicitly selected that vendor. With no
vendor selected, show the neutral fields plus `becsult_ar` (rough estimate).

Adding a second vendor means adding a key under `vendors` — it must never
require touching the neutral fields.

## Item record (canonical JSON)

```jsonc
{
  "vrg_id": "VRG-0098",                   // primary key, neutral, never changes
  "legacy_id": "OBO2000378",              // the Phase 0 key, traceability only
  "megnevezes": "Kötődoboz 100x100x38 …", // longest observed name
  "marka_gyarto": "OBO Bettermann",       // null if unknown
  "gyartoi_cikkszam": "2000378",          // null if not confirmed against the name
  "gtin": "4012195917090",                // vendor-neutral; best key for matching a second vendor
  "kategoria":          { "fo": null, "al": null, "ut": null },   // OFFICIAL, empty on purpose
  "kategoria_javaslat": { "fo": "…", "al": "…", "forras": "AI-javaslat" }, // PROVISIONAL
  "tomeg_kg": 0.05855,                    // from the vendor catalogue (Phase 6)
  "egyseg": "db",                         // db | fm | pár
  "becsult_ar": { "netto_huf": 496.91, "brutto_huf": 631,
                  "datum": "2026.09.08", "forras": "daniella-rendeles" },
  "gyartoi_termek_link": "https://www.obo.hu/…",  // manufacturer datasheet
  "felhasznalas": { "rendelesek_szama": 1, "osszes_rendelt_mennyiseg": 4,
                    "elso_rendeles": "2026.09.08", "utolso_rendeles": "2026.09.08" },
  "vendors": {
    "daniella": {
      "cikkszam": "OBO2000378",
      "netto_egysegar_huf": 496.91,       // partner-specific DISCOUNTED net price
      "brutto_egysegar_huf": 631,         // computed, net × 1.27
      "listaar_netto_huf": 629,           // DANIELLA net list price (PDF only)
      "engedmeny_szazalek": "21",
      "kiszereles": "1 db", "kiszereles_mennyiseg": 1,
      "aktualis_brutto_ar_huf": null,     // webshop gross price — "Árak frissítése" fills this
      "keszlet_db": null,                 // webshop stock
      "termek_link": null,                // webshop URL
      "ar_ellenorizve": null,             // ISO timestamp of the last webshop check
      "ar_elozmeny": [ { "date": "…", "order": "…", "netto_egysegar": 496.91, "src": "…" } ]
    }
  },
  "nev_valtozatok": ["…"],                // every name variant seen, for fuzzy matching
  "forras": "email:visszaigazolas + pdf:Megrendelés visszaigazolás"
}
```

### Official category — collected in Phase 6

DANIELLA's taxonomy, adopted deliberately as the house taxonomy:

```
kategoria.fo     = "Installáció technika"                              department
kategoria.al     = "Falon kívüli dobozok és fedelek"                   the leaf
kategoria.ut     = "/Szerelvény- és kötődobozok/Installáció technika/" ancestors, LEAF-MOST FIRST
kategoria.forras = "daniella-webshop"
```

`forras` is not decoration — three degrees of confidence coexist:

| value | meaning |
|---|---|
| `daniella-webshop` | the vendor's own catalogue says so (214 items) |
| `daniella-webshop-testver:<code>` | inferred from a colour-variant sibling; the named donor resolves via `getByLegacy` (2 items) |
| `null` with no `al` | never established; `kategoria_javaslat` shows instead (5 items) |

**A merchandising bucket is never a category.** Roots matching
`/^(Akciós termékek|Egyéb)$/` are rejected in `tools/enrich-vendor.js`: a
weekly sale would be wrong the following week. Any future importer must keep
that rule.

`kategoria_javaslat` remains the fallback for items the vendor files only
under a promotion.

### Where the vendor metadata comes from

`robots.txt` permits crawling and names the sitemap; product URLs end in
`-id-<article number>`, so items map to pages with no search requests. Pages
are server-rendered with schema.org JSON-LD: `BreadcrumbList` and
`Product.category` give the taxonomy, `Product.weight`, `gtin`,
`offers.price` (GROSS shelf price, not our partner price), `offers.inventoryLevel`
and `hasCertification` give the rest. See `tools/daniella-fetch.js`.

## Empty vs. unknown

`null` / empty string always means **"not collected yet"**, never "zero" and
never "not applicable". Nothing in this dataset was guessed to fill a gap:
a field is filled only when a source document states it or when it is
arithmetically derived from one (and then `forras` says so).

## Invariants a writer must preserve

1. `vrg_id` is immutable and append-only. A vendor renumbering changes
   `vendors.<id>.cikkszam`, never the `vrg_id` — that is the entire reason the
   neutral key exists.
2. `becsult_ar.netto_huf` is always the **newest** entry of the vendor price
   history that the estimate was derived from.
3. `becsult_ar.brutto_huf == round(netto_huf * 1.27)`.
4. A rebuild from source documents must never overwrite user-owned fields
   (`megjegyzes`, `kedvenc`, official `kategoria`, `tomeg_kg`,
   `gyartoi_termek_link`, and anything a price check wrote).
5. `vendors.daniella.netto_egysegar_huf` is a *partner-specific discounted*
   price. Do not present it as a list price and do not compare it against a
   webshop gross price without applying VAT and noting the discount.

## Price-update contract — implemented in Phase 7

`core/pricecheck.js`. A check file (`schema: "vrg-price-check"`, written by
`tools/pricecheck.js`) is parsed, **planned**, then applied:

```
parseCheck(file, {knownId, knownVendor})  -> {vendor, datum, tetelek, warnings}
planCheck(check, store)                   -> {valtozasok, valtozatlan, ujak, kihagyva, …}
applyPlan(plan, userdata)                 -> {irt, naplo, stamp}
```

**planCheck writes nothing.** It exists so the diff can be reviewed before any
value moves; a UI must show it and only then offer to apply.

A refreshed reading does NOT go into the catalogue — the app owns only the user
document, and a data rebuild must not erase it. It is written to
`userdata.vendorData[vendor][vrg_id]`, and `mergeItem` folds that into the
item's vendor block, so **the vendor gate keeps working unchanged**: a
refreshed price is invisible until that vendor is selected. The merged item
carries `vendor_frissitve` listing which vendor fields came from a check.

Only `VENDOR_REFRESHABLE` = `aktualis_brutto_ar_huf`, `keszlet_db`,
`termek_link`, `ar_ellenorizve` may be refreshed. `netto_egysegar_huf`,
`listaar_netto_huf` and `kiszereles*` come from order documents and are
unreachable from a check or a hand-edited file; `sanitize()` enforces this.

An unchanged reading still writes `ar_ellenorizve` but appends **no** log
entry: "checked today, unchanged" must be distinguishable from "never checked",
and a non-event is not an event.

`financeLog` is append-only, one entry per real change:
`{ datum, vrg_id, vendor, regi_brutto, uj_brutto, valtozas_huf, valtozas_szazalek, forras_url }`.
The catalogue describes the present; the log records events.

Save-prompt rule: `needsSavePrompt(userdata)` is true unless `saveLog` already
holds an entry dated today, so several checks in one day prompt once.
`recordSave()` writes that entry — call it only after the file is actually
written.

## Application layer

The app is modular ES source under `src/`, bundled by `build/bundle.js` into
one offline `dist/vrg-inventory.html`. Modules an agent will care about:

```
src/core/schema.js      field registry, validation, migrations. get() THROWS on a
                        vendors.* path — that is how the gate is enforced, not by convention
src/core/vendors.js     the only module that can read a vendor block
src/core/store.js       indexes + query({text, fo, al, brand, vendor, hasPrice, missing, sort})
src/core/categories.js  official vs provisional resolution, tree, path parsing
src/core/pricing.js     VAT, estimates, discount check, price-change log entries
src/core/format.js      Hungarian number/date formatting
src/core/events.js      the bus; features never talk to each other directly

src/features/catalog/columns.js  column registry: label, width, reader, renderer,
                        comparator. `vendor: true` reads through the gate;
                        `vendorDerived: true` marks a neutral field whose VALUE is a
                        vendor code (legacy_id) — both are hidden in neutral mode
src/features/catalog/table.js    virtualised rows; windowRange() is pure and tested
src/features/catalog/filters.js  search, category tree, filters, column picker
src/features/catalog/detail.js   the item drawer
```

Bus events: `item:selected`, `item:deselected`, `vendor:changed`,
`columns:changed`, `filters:changed`, `catalog:rendered`, `userdata:changed`.
`window.VRG.inventory.on(type, fn)` exposes them to other tools.

## User data and the override overlay

`core/userdata.js` holds one versioned document (`vrg-userdata`, currently
1.4.0) with everything the user creates. Two kinds of field:

| | |
|---|---|
| own | `megjegyzes`, `kedvenc`, `jeloles` — exist nowhere in the catalogue |
| overrides | `tomeg_kg`, `gyartoi_termek_link`, `kategoria` — win over the catalogue value |

The store keeps the published catalogue immutable in `base` and serves **merged
views**: `store.items[i]` is `mergeItem(base[i], record)`, carrying `user` and
`overridden` (the list of fields the user supplied). `store.remerge(vrg_id)`
after a single edit, `store.remergeAll()` after an import or reset.

This is what makes invariant 4 real rather than aspirational: a data rebuild
replaces `data/vrg-inventory.json` wholesale and physically cannot overwrite a
user value, because user values were never in that file.

`sanitize(doc, knownId)` is the only way in from a file. It drops every field
not on the allow-list, coerces types, discards unknown marks, and reports items
this catalogue does not have — so a hand-edited or hostile file cannot rewrite
prices, identifiers or vendor blocks. It also rebuilds records in a canonical
field order, so an exported and a re-imported document are **deep-equal but not
byte-equal**; compare values, never the serialised string.

`core/persistence.js` treats every storage failure as a result, never an
exception: unavailable storage, a throwing private window, a full quota, and a
corrupt value (kept under a `<key>.corrupt.<timestamp>` key rather than
discarded). Writes are debounced and flushed on `beforeunload` and
`visibilitychange`.

## Order lists

`core/lists.js`, stored in the same userdata document (schema 1.2.0):

```jsonc
"lists": {
  "l<id>": {
    "id": "l<id>", "nev": "Hetényi",
    "created": "…", "updated": "…", "megjegyzes": "Peterdy 33",
    "sorok": { "VRG-0098": { "mennyiseg": 7, "megjegyzes": "sürgős" } }
  }
},
"activeList": "l<id>"
```

**A line holds a `vrg_id` and a quantity — nothing else.** No name, no price,
no vendor. Everything shown is resolved live by `lists.rows()` against the
current catalogue and the selected vendor, which is what lets a list survive a
catalogue rebuild and re-price itself when the vendor changes. A line whose
item no longer exists comes back with `hianyzo: true` and `item: null` rather
than being dropped.

`lists.rows()` returns `egysegar` with `egysegar_forras: 'vendor' | 'becsles'`,
`sor_netto`, and — **only when a vendor is selected** — `csomag_mennyiseg` and
`csomag_ok`. Packaging is a vendor fact, so neutral mode never warns about it.

`lists.totals()` sums what it can and counts what it cannot: `ar_nelkul`,
`hianyzo_tetel`, `csomag_figyelmeztetes`.

## Exports and imports

`core/io/exporters.js` holds pure data→string functions; `core/io/importers.js`
parses them back. Invariant 5 of the project is a test, not a hope: a list
exported to grouped Excel-HU CSV re-imports to identical lines.

Dialects: `excel-hu` (`;`, decimal comma, BOM, CRLF) and `standard` (`,`, dot,
LF); `tsv` is its own dialect. `orderByCategory(rows, keyOf, order)` ranks the
categories the user listed and leaves the rest in Hungarian alphabetical order
after them, so an incomplete order can never hide a row.

`parseListCsv` needs only a `vrg_id` column and a `mennyiseg` column. It skips
group headings, sums an item that appears twice, and returns a warning for
every row it refused — it never invents a value. Names and prices in the file
are ignored on purpose: the catalogue is the authority, a list owns only ids
and quantities.

Export profiles live in userdata (`exportProfiles`, schema 1.2.0) and carry
target, format, dialect, column ids **in order**, category order, grouping and
header. Built-ins are starting points: `profiles.update()` on a `builtin`
profile **forks** it. `profiles.create()` always mints a fresh id — passing a
copy of an existing profile must not overwrite the original.

Export field descriptors come from `features/export/fields.js`; the catalogue
set is derived from the table's column registry so a column is defined once.
`visibleFields()` applies the vendor gate, so a neutral export offers no vendor
field and contains no vendor article number even if one is named explicitly.

## QR

`core/qr.js` is the Planner's encoder (Nayuki v1.8.0, MIT) adopted verbatim —
same names, same result shape. `test/qr.test.js` asserts it reproduces the
Planner's documented smoke result (`version 3, 29×29`), which is what keeps
the two tools provably on the same engine. Keep `shape-rendering="crispEdges"`:
without it phone cameras fail on small renders.

`core/qrpayload.js` has two payloads because there are two readers:

```
VRGL1|<list name>|<id>:<qty>,<id>:<qty>…     compact, re-importable, ids only
```

plain ASCII and **deliberately uncompressed** — a QR encoder packs
alphanumerics better than base64 of a deflate stream, so compressing makes the
code bigger. `decodeList` never throws on a malformed row; it reports it,
because a payload that arrived by camera or clipboard has had every chance to
be mangled.

**Do not add chunked / multi-part QR sequences.** A phone's camera reads one
code and cannot reassemble a series, and this page cannot be the scanner
because `getUserMedia` needs a secure context and `file://` is not one. The
whole 221-item catalogue compacts to 1557 bytes — 53% of one code — so the case
does not arise. Anything genuinely too big travels as a file.

## Projects and the Planner import

`core/plannerimport.js` reads a `.vplan.json` (`format: "varler-planner"`,
written by the Planner's `src/11b-backup.js`) and produces requirements:

```
{ kulcs:'dev:socket', cimke:'Csatlakozóaljzat', egyseg:'db',
  mennyiseg:36, kategoriak:['Csatlakozóaljzatok'], ismeretlen:false }
```

Devices are counted per `type`; path sections are measured with `segLength`
in 3-D (height included) and summed per `build`.

Three rules a future editor must keep:

1. **Nothing is invented.** The drawing does not say a socket needs a frame, so
   the import does not add one.
2. **An unrecognised type is reported, never dropped** — it becomes a
   requirement with `ismeretlen:true` and no categories.
3. **Requirements sharing a category set are MERGED** (`parsePlan` does this
   after building them). Flush and surface conduit are both conduit; leaving
   them separate lets one purchase satisfy two requirements and the progress
   reads as twice the material. `test/projects.test.js` asserts the merged
   sets are pairwise disjoint — if you add a rule, that test is the guard.

`progress(terv, rows)` counts a list line toward a requirement only when the
item's category (official, else the AI suggestion) is in `kategoriak`.
`autofillPlan` proposes one item per open requirement — a `kedvenc` in that
category, else the most frequently ordered — and **writes nothing**, the same
review-before-apply rule as the price check.

`core/projects.js` holds the job: name, address, date, the imported `terv`,
and `listaId` pointing at an ordinary order list. The project references a
list rather than duplicating one, so every list feature works on it unchanged;
`sanitize()` repairs a `listaId` whose list no longer exists.

## The floor diagram

`plannerimport.extractDrawing(data)` pulls the geometry out of the same
`.vplan.json` — `{ szintek, helyisegek, eszkozok, nyilasok, hatar }`, about
10 kB for a house-sized plan — and it is stored in the project next to the
requirements. `userdata.sanitizeDrawing()` bounds and type-checks it on the
way in, like every other thing the user can hand us.

`core/diagram.js` — `buildDiagram({ rajz, progress, szint, kiemeltKategoriak })`
— is a **pure function of geometry and progress with no state of its own**.
That is the whole design: a symbol is green because `stateOf()` looked at the
requirement it belongs to, not because some listener remembered to repaint it.

```
stateOf(req) -> 'nincs-igeny' | 'ismeretlen' | 'kesz' | 'reszben' | 'nincs'
requirementFor(tipus, igenyek)   // matches 'dev:<tipus>', including merged
                                 // keys joined with '+'
SYMBOLS   socket→kör · switch→négyzet · light→csillag
          junction→rombusz · box→négyzet-üres   (unknown type → kör-üres)
```

An editor must keep two things:

1. **Do not give the diagram its own state.** `features/projects/panel.js`
   renders the requirement table and the diagram from the *same* `prog`
   object in one pass; that is what makes them structurally unable to
   disagree. A cached colour map would break the guarantee silently.
2. **Coordinates stay in millimetres** and go straight into the SVG
   `viewBox` (`MARGIN = 400` mm). There is no scale factor anywhere, so
   there is none to get wrong.

Beware CSS specificity here: `svg.floorplan .symbols .sym` is (0,3,1) and
out-ranks a bare `svg.floorplan .sym-kesz` (0,2,1), which once left finished
symbols grey while every class was correct and every test passed. The state
rules in `theme.css` are written at matching specificity with a comment
saying why. Verify colours by reading **computed** styles — a screenshot does
not catch this.

## Interactive cells

A column may declare `render(item, ctx, dom)` returning a DOM node instead of
text; the `lista` column is the only one so far. Such a cell **must**
`stopPropagation` (the row click opens the drawer) and **must** call
`ctx.onListChange(id)` after writing, which repaints the table and emits
`lists:changed`. A cell that writes without announcing it leaves the UI showing
stale values while the stored data is already correct.

`window.VRG.inventory` is the read-only plug-in surface other VRG tools use:
`get(vrg_id)`, `getByLegacy(daniella_code)`, `query(q)`, `stats()`,
`categories()`.

The bundler accepts a deliberately small ES subset: named exports only, no
default exports, no re-exports, no dynamic `import()`, no top-level await, no
import cycles. Violations throw at build time with file and line.

## Rebuild from raw documents

See `SOURCES.md` for the per-format rules, and `tools/` for the reference
implementation (plain Node, no dependencies, CommonJS):

```
tools/eml.js         .eml → decoded HTML (base64 / quoted-printable, multipart)
tools/pdfrows.js     .pdf → positioned text → item rows (2 layouts, custom glyph map)
tools/xlsx.js        .xlsx → cell dump (zip + inflate, sharedStrings)
tools/hints.json     article numbers harvested by hand from the spreadsheets
tools/paths.js       RAW / CACHE locations
tools/ids.js         append-only vrg_id assignment against data/vrg-id-registry.json
tools/build.js       merge all sources on the vendor article number
tools/enrich.js      brand / manufacturer part no. / provisional category rules
tools/export.js      → data/*.csv, data/vrg-inventory.json  (assigns vrg_id)
tools/textexport.js  → EXPORT_vrg-inventory.txt (human layer + this AI layer)
```

## Known gaps (2026-09-20, after Phase 6 enrichment)

| Gap | Count |
|---|---|
| Official DANIELLA category | 5 / 221 (all 221 have at least a provisional one) |
| Weight | 7 / 221 |
| Manufacturer product link | 57 / 221 |
| GTIN | 21 / 221 |
| Manufacturer part no. unconfirmed | 52 |
| Vendor webshop price / stock | 20 / 221 |
| Vendor product link | 0 / 221 |
| No price ever observed | 11 |
| Names that still embed the vendor's own article number | 17 (all Stilo and deLux) |

Re-derive these rather than trusting the table: `npm run data` rebuilds and
prints the current counts.

## Unverified

**Whether a generated QR code actually scans on a phone has never been
confirmed.** The encoder is Nayuki v1.8.0 adopted verbatim and its own test
vectors pass, but no `BarcodeDetector` was available in the verification
browser, so the chain from `qrpayload` through the renderer to a real camera
is untested end to end. The Planner carries the same open item.
