# VRG Inventory — core item database

Vendor-independent core inventory of the electrical installation material
VARLER GROUP orders regularly. Built from the DANIELLA e-mail archive;
designed so that **DANIELLA is only one vendor among many**.

**Status: Phase 10 complete — the last planned phase. Import a Planner
drawing, see what it needs on a floor diagram that colours itself from your
order list, fill the gaps from your favourites, then export, price-check or
QR the result.**

## Try it

Double-click `dist/vrg-inventory.html`. No server, no network, no install.

```bash
npm test      # 201 assertions, plain node --test, no dependencies
npm run build # src/ + data/ -> dist/vrg-inventory.html
npm run data  # re-extract everything from the raw vendor documents
npm run vendor # re-collect the vendor catalogue metadata (network)
npm run pricecheck # read current shelf prices -> price-check-<date>.json (network)
```

## What is here

```
Inventory/
├─ data/
│  ├─ vrg-inventory.json        canonical machine format (nested, per-vendor blocks)
│  ├─ vrg-inventory.csv         flat spreadsheet export (";" separator, decimal comma, UTF-8 BOM)
│  ├─ vrg-id-registry.json      append-only vrg_id assignment — never edit by hand
│  ├─ vrg-price-history.csv     every price point ever observed, per item per document
│  ├─ vrg-orders.csv            every order line from every source document (audit trail)
│  └─ vrg-categories.csv        provisional category list + empty columns for the official mapping
├─ src/
│  ├─ core/              schema · store · vendors · categories · pricing · format
│  │                     events · persistence · userdata · lists · profiles · pricecheck
│  │                     qr · qrpayload · projects · plannerimport · diagram
│  ├─ core/io/           exporters · importers
│  ├─ features/catalog/  columns · table · filters · detail
│  ├─ features/lists/    panel
│  ├─ features/export/   panel · fields
│  ├─ features/pricecheck/ panel
│  ├─ features/qr/       panel
│  ├─ features/projects/ panel · diagram
│  ├─ features/userdata/ panel
│  ├─ ui/                theme.css · dom.js · components.js
│  └─ app.js             composition root
├─ build/bundle.js              ~200 lines, zero dependencies
├─ build/serve.js               dev-only static server (localStorage needs a real origin)
├─ dist/vrg-inventory.html      the deliverable
├─ test/                        schema · store · pricing · catalog · userdata · lists · export · pricecheck · qr · projects · multivendor · bundle
├─ tools/                       the Phase 0 extraction pipeline (CommonJS)
├─ docs/                        AI-CONTEXT · SOURCES · DEV-PLAN
└─ EXPORT_vrg-inventory.txt     dual-layer text export: human section on top, AI block below
```

## Numbers

| | |
|---|---|
| Items | **221** |
| With an observed price | 210 |
| With DANIELLA list price + discount % | 43 |
| With a brand | 221 |
| With a confirmed manufacturer part number | 169 |
| With an official category | 216 |
| With a weight | 214 |
| With a GTIN / EAN | 200 |
| With a manufacturer datasheet | 164 |
| Price observations | 471 |
| Order lines parsed | 483 |
| Source documents | 53 e-mails + 3 PDFs + 4 spreadsheets |
| Order documents covered | 39 orders + 2 quotations |
| Date range | 2026-06-12 … 2026-09-17 |

## Identifiers

`vrg_id` (`VRG-0001` …) is the primary key and is vendor-neutral on purpose.
Assignment lives in `data/vrg-id-registry.json` and is append-only: rebuilding,
reordering or adding items never changes an id that was already handed out,
because user lists, project files and QR payloads reference it.

`legacy_id` keeps the DANIELLA article number that was the key in the Phase 0
snapshot, for traceability. Its *value* is a vendor code, so the UI hides it
until that vendor is selected, exactly like the vendor block itself — a column
can declare `vendorDerived` to opt into that.

## The vendor rule

Everything vendor-neutral lives at the top level of an item: name, brand,
manufacturer part number, category, weight, unit, rough price estimate,
manufacturer product link.

Everything vendor-specific lives in `vendors.<vendor_id>`: vendor article
number, vendor price, list price + discount, pack size, webshop stock, webshop
product URL, price-check timestamp.

**The UI only reveals a vendor block when the user has selected that vendor.**
This is not a convention — `core/schema.js` throws if anyone reads a
`vendors.*` path directly, so every vendor value must pass through
`core/vendors.js`. One choke point, covered by tests, including one that
switches on all 23 columns and asserts that neutral mode still renders zero
vendor article numbers.

## Using the catalogue

| | |
|---|---|
| `/` | focus the search box |
| `Esc` | clear the search / close the detail drawer |
| click a header | sort by that column; click again to reverse. Unknown values always sink |
| click a row | open the detail drawer |
| **Oszlopok** | choose which columns show and in what order |
| **Listák** | the active order list: quantities, notes, totals |
| **Export** | pick a profile, preview it, then save / copy / print |
| **Projektek** | import a Planner drawing, track what it still needs |
| **Árellenőrzés** | load a price check, review the diff, apply it, read the log |
| **QR** | turn the active list or one item into a code a phone can read |
| **Adatállapot** | how much of each field is filled in |
| **Saját adatok** | export / import / reset everything you have added |
| `+` / `−` in the Lista column | put an item on the active list, or take one off |
| category chips | click a category to drill into its sub-categories; `~` marks an AI suggestion |

The table is virtualised — about 33 rows exist in the DOM at a time regardless
of catalogue size.

## Categories

The house taxonomy is DANIELLA's own, adopted deliberately: **216 of 221**
items carry the official path, stored the way the webshop prints it —

```
fo = "Installáció technika"                                (department)
al = "Falon kívüli dobozok és fedelek"                     (the leaf)
ut = "/Szerelvény- és kötődobozok/Installáció technika/"   (ancestors, leaf-most first)
```

`kategoria.forras` records how each one was established, because three degrees
of confidence coexist:

| forras | Meaning | Count |
|---|---|---:|
| `daniella-webshop` | stated by the vendor's own catalogue | 214 |
| `daniella-webshop-testver:<code>` | inferred from a colour-variant sibling | 2 |
| *(empty)* | still on the AI suggestion, shown with a `~` | 5 |

**A promotion is never recorded as a category.** Seven items came back filed
under things like *"Heti Akció: Weidmüller válogatás"* — a weekly sale that
would be wrong the following week. Those are rejected; two were recovered from
a sibling, and the remaining five keep their AI suggestion until someone sets
them by hand in the drawer.

## Still to collect

| Field | Filled by |
|---|---|
| official category for 5 items | by hand in the drawer — the webshop only lists them under a promotion |
| `tomeg_kg` for 7 items | the vendor publishes no weight for them |
| `gyartoi_termek_link` for 57 items | no manufacturer document published |
| `gtin` for 21 items | not published |

`kategoria_javaslat.fo` / `.al` still hold the **provisional AI guess** derived
from the product name, shown with a `~` marker. It is now a fallback for the
handful of items the vendor files under a promotion, not the main story.

## Projects and the Planner

**Projektek → Planner terv importálása** reads a `.vplan.json` exported from
the Planner's left sidebar and turns the drawing into requirements:

```
36 db  Csatlakozóaljzat        26 db  Lámpatest         15 db  Kapcsoló
 5 db  Szerelvénydoboz          2 db  Kötődoboz
2,66 fm Vezetékezés           1,88 fm Gégecső
```

Devices are counted per type; cable runs are measured in 3-D, so a drop down a
wall counts its height and not just its plan distance. Each requirement gets a
progress bar showing how much of it you have actually chosen a product for.

**Hiányzók kitöltése kedvencekből** proposes one item per open requirement — a
favourite in that category if you have marked one, otherwise the item you order
most often — shows the whole proposal, and writes nothing until you confirm.

Two rules the import keeps:

* **Nothing is invented.** A socket needs a frame and a box in practice, but the
  drawing does not say so, so the import does not claim it does.
* **An unrecognised device type is reported, never dropped.** It appears as a
  requirement marked ⚠ with no category, because a plan that quietly loses a
  third of its sockets is worse than one that refuses to import.

Kinds answered by the same categories are merged into one requirement — flush
and surface conduit are both conduit — so one purchase can never tick off two
requirements and make the progress read as twice the material.


### Alaprajz

Under the requirement table the plan is drawn as it was designed, with one
symbol per device:

```
○ Aljzat     □ Kapcsoló     ✳ Lámpa     ◇ Kötődoboz     ▢ Szerelvénydoboz
```

Each symbol is **grey** while nothing on the list answers it, **amber** when
the requirement is partly covered, and **green** when it is fully covered.
Selecting an item in the catalogue lights up exactly the symbols it could
answer; clicking a legend row filters the catalogue to that category. Multi-
level plans get one tab per level.

The colours are not a separate record that has to be kept in step: the panel
draws the diagram and the table from the same progress object in the same
pass, so the drawing and the list cannot disagree.

A project owns a list rather than duplicating one, so everything below works on
it unchanged.

## Order lists

**Listák** in the header holds named lists — one per job. Add items with the
`+` button in the catalogue's *Lista* column or from the detail drawer, then
set exact quantities, add a note per line and a note for the whole list.

A list stores **ids and quantities only**. It never copies a name or a price,
so a list built last month still reads correctly after the catalogue is
rebuilt, and the same list re-prices itself the moment you switch vendor. The
totals bar shows net and gross, and counts honestly what it cannot price.

Pack-size warnings are vendor-gated, because packaging is a vendor fact: in
neutral mode there is no warning at all; pick a vendor and any line that is not
a whole pack is flagged. The drawer then also offers a `+<pack>` button.

Lists can be duplicated and merged (quantities add up for shared items), and a
line whose item has vanished from a rebuilt catalogue is **reported, not
dropped**, so a stale list never silently loses work.

## Exporting

**Export** in the header. Pick a profile, and the preview shows exactly what
will be written before you write it.

| Format | For |
|---|---|
| CSV (Excel) | `;` + decimal comma + BOM — opens straight in Hungarian Excel |
| CSV (standard) | `,` + decimal point, for anything that parses properly |
| TSV | pasting into a spreadsheet or a message |
| Kétrétegű szöveg | human-readable block on top, `@`-tagged machine block below |
| Rendelés | plain text to paste into an e-mail to the vendor |
| JSON | for another tool |

A **profile** remembers the target (catalogue or list), the format, the
dialect, which columns and **in what order**, which categories come first, and
whether to group. The three built-ins are starting points — editing one forks
it into your own copy instead of overwriting it.

The vendor-order format refuses to build until you have selected a vendor: it
writes *their* article numbers, and an order addressed to nobody is worse than
no order. Exports obey the vendor gate exactly like the table does.

**Lista importálása CSV-ből** reads a list back out of any CSV this app wrote
— it needs only a `vrg_id` column and a `mennyiseg` column, skips group
headings, sums an item that appears twice, and reports every row it refused.

## Keeping prices current

A page opened from `file://` cannot read the vendor's site, so the check runs
locally and the app imports the result:

```bash
npm run pricecheck                      # every item we have a product URL for
node tools/pricecheck.js --list x.csv   # only the items on an exported list
```

Then **Árellenőrzés → Ellenőrzés betöltése**. You get a diff first — biggest
move at the top, with how many rose, fell, were unchanged or had to be skipped.
**Nothing is written until you press Apply.**

What a check may change: the webshop's **gross shelf price**, the stock level,
the product URL and the "checked at" timestamp. What it can never touch: the
net price we negotiated, the vendor's list price and the pack size — those come
from order documents, not from a webshop read. A hand-edited check file cannot
reach them either.

An unchanged price still records *that it was checked*, so "checked today, same
price" is distinguishable from "never checked".

Every real change appends to the **finance log** — an append-only record of
events, next to a catalogue that describes the present. After a check the app
offers to save the log to a file, **once per day**: run three checks in an
afternoon and it asks the first time only.

## QR handoff

**QR** in the header. Four things can become a code:

| | for | fits |
|---|---|---|
| list — readable text | a phone's camera shows it, and you share it straight into a message | ~40 lines |
| list — compact data | pasting into another copy of the app; ids and quantities only | hundreds of lines |
| one item | a label for a shelf or a box: name, VRG id, manufacturer code, EAN, weight | tiny |
| free text / address | a LAN address you would otherwise type into a phone by hand | — |

The encoder is the **same one the Planner uses** (Nayuki, MIT) — same function
names, same result shape, and a test asserts it reproduces the Planner's
documented smoke result, so the two tools cannot silently drift apart.

**There is no multi-part sequence, on purpose.** A phone's camera reads one
code and shows its text; it cannot reassemble a numbered series, and this page
cannot be the scanner either because camera access needs a secure context and
`file://` is not one. It is also unnecessary: the **entire 221-item catalogue
compacts to 1557 bytes, 53% of a single code**. If something really is too
big, the panel says so and points at the Export panel, which is the honest
answer.

A compact code pasted into the box at the bottom of the panel reopens as a new
list — that is the handoff path that works today with no server: scan on the
phone, share the text to the other machine, paste.

⚠️ **Untested on real hardware:** that a generated code *scans*. This browser
has no `BarcodeDetector`, so it could not be checked here. Point a phone at
one before relying on it.

## Your own data

Order lists, notes, favourites, colour marks, and your own values for weight,
manufacturer link and official category live in a **separate document** from
the catalogue.
That separation is the whole point: `npm run data` replaces the catalogue
wholesale and cannot touch anything you typed.

They are stored in this browser, on this machine. **Saját adatok** in the
header exports them to one JSON file, imports one back, or clears them. Import
only accepts fields you are allowed to own — a hand-edited file cannot rewrite
prices or identifiers — and it warns about items this catalogue does not have.

If the browser blocks local storage (a private window, or opening the file from
a `data:` URL), the app says so in the header and still works; export before
you close the tab.

To verify persistence during development you need a real origin, because
`file://` and `data:` do not get localStorage:

```bash
node build/serve.js    # http://localhost:8123
```

## Rebuilding the data

`npm run vendor` re-collects the vendor catalogue metadata over the network:
`tools/daniella-sitemap.js` caches the sitemap (which `robots.txt` itself
points at), then `tools/daniella-fetch.js` makes one polite, resumable request
per item and keeps the JSON-LD. `tools/enrich-vendor.js` folds the result into
the catalogue — that stage is part of `npm run data` and is skipped with a
notice if the cache is absent, so a rebuild works offline too.

`npm run data` reads the raw documents from `H:\_inbox\database_emails`
(override with `VRG_RAW_DIR`) and rewrites `data/` and the text export.
Intermediates land in `.cache/` and are gitignored. Plain Node, tested on v24.
