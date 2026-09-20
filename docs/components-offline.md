# Components — single-file / offline, and local tooling

*Everything here either fits inside a single offline HTML file, or runs on this PC at build and
test time and never reaches a `dist`. Nothing on this page requires a server, a database or a
container — for those, see `services-server.md`.*

Machine-readable source of truth: `vendor-manifest.json` at the repo root. Download what is
downloadable with `node tools/fetch-vendor.js --all`; browse it with `vrg-vendor.html`.

**How to read the numbers.** Star counts and dates were read from the GitHub API on 2026-09-20.
"Last push" is `pushed_at`, the last *code* push — not `updated_at`, which moves when somebody
stars the repo and says nothing about whether the project is alive. This distinction already
caught one error in the first scouting pass; see the correction note in `library-scouting.md`.

Priorities: **1** take now · **2** next round · **3** know it exists.

---

## Planner — `Planner/projects/varler-planner/`

The hard constraints here never move: one self-contained HTML file, one shared global scope,
no bundler, no ESM, no network.

### `upb-lea/Inkscape_electric_Symbols` — CC0-1.0 — 572★ — pushed 2026-02-08 — **priority 1**

Electrical schematic symbols as Inkscape SVG, from Paderborn's power-electronics group.

**Why it matters to us:** every gate that disqualifies a library is irrelevant here, because
**symbols are data, not code**. No bundler, no global-scope collision, no TDZ ordering problem,
no size budget argument beyond the bytes you actually paste. It feeds `src/04-render.js` (device
symbols) and `src/10-lamps.js` directly.

The first pass flagged the licence as the only blocker. That blocker does not exist: **CC0-1.0**
is a public-domain dedication, so redistribution inside a customer-facing drawing is
unrestricted. This is the cleanest item on the entire list and the one to start with.

Six years of steady maintenance behind 572 stars is the kind of number worth trusting — compare
the calibration note at the end of this file.

### `101arrowz/fflate` — MIT — 3,018★ — pushed 2026-05-16 — **priority 1**

~8 kB deflate/ZIP, pure JS, no dependencies.

**Why it matters to us:** already `library-scouting.md`'s number-one pick, for three uses in
order of value — compressing `.vbundle.json` backups, shrinking base64 lamp photos inside a
project file, and letting `/dl` serve a zipped export. Nothing here changes that assessment;
this entry only adds that it is now fetchable into `Vendor/fflate` and that it serves
`Inventory/` too, whose `data/` directory is ~450 kB of repetitive JSON plus ~130 kB of CSV.

### `jakearchibald/idb-keyval` — **licence needs checking** — 3,245★ — pushed 2026-07-08 — **priority 2**

~1 kB `get`/`set`/`del` wrapper over IndexedDB.

**Why it matters to us:** `library-scouting.md` records the reasoning — localStorage is
profile-bound, synchronous and capped around 5–10 MB, and projects carry base64 lamp photos. It
remains a deliberate migration rather than a drop-in, because `src/11-controls.js` persistence
goes async.

**One correction to the first pass:** it lists this as Apache-2.0. The GitHub API reports
`NOASSERTION` — no standard licence detected. That does not mean the licence is bad; it means
the LICENSE file needs reading before this goes anywhere near a file you hand to a customer.
Flagged rather than resolved.

### `naptha/tesseract.js` — Apache-2.0 — 38,719★ — pushed 2026-05-17 — **priority 2**

Pure-JS OCR via WebAssembly, 100+ languages including Hungarian (`hun`).

**Why it matters to us:** this is the most interesting *product* idea on the list rather than a
maintenance win. Point the phone at a consumer-unit label or an equipment nameplate and read the
type designation straight into the drawing — no server, no API key, no network. It fits the
architecture instead of fighting it, and it pairs naturally with the existing phone-relay work
in `src/07b-phone-camera.js`.

**The constraint it does violate:** the language data is several megabytes. It cannot be inlined
into `varler_planner.html` without wrecking the size budget, so it belongs in a companion file
next to the deliverable, or served from the relay. `jeromewu/tesseract.js-offline` (198★) is a
worked example of exactly this problem and is worth reading before building anything.

### `ekymo/homeRoughEditor` — MIT — 394★ — pushed 2024-07-21 — **priority 2, as reading**

SVG floorplan editor, plain JavaScript, client-side, 212 kB.

**Why it matters to us:** the closest public peer to the Planner that exists — same medium, same
no-framework posture, same problem. The specific thing to read is how it models **wall junctions
and room detection**, because `docs/1.1_backlog.md` is about to rework exactly that into
terminals/segments/runs/circuits, and it says plainly that connectivity currently exists only as
"these two nodes happen to share coordinates."

**Take it as a reading exercise, not an import.** And note the date: the last code push was
**July 2024**. The first pass called it "still pushed" on the strength of `updated_at`; that was
wrong. It is dormant, which is fine for a reference and disqualifying for a dependency.

### `pascalorg/editor` — 24,171★ — **priority 3, design source only**

Local-first 3D architectural editor — BIM/CAD/floorplan — with MCP tools and agent skills built
in. Next.js and react-three-fiber, so **adopting it is off the table and always will be**.

**Why it matters to us:** it is the only serious floorplan editor designed for an agent to
drive, which makes its document schema worth reading against `docs/2_0_architecture.md`. Read
the model, take nothing. (Listed under `szerver` in the manifest because running it is a
Next.js app, not because we would ever host it.)

---

## Inventory — `Inventory/`

`Inventory/tools/` runs in Node at data-build time and never ships in `dist/`. The single-file
rule has never applied to it. That is what makes this section cheap.

### `iconv-lite` (npm) — **priority 1 — the only entry that fixes an existing bug**

**Why it matters to us:** `tools/eml.js:10` falls back to `latin1` for any non-UTF-8 charset:

```js
return buf.toString(/utf-?8/i.test(cs) ? 'utf8' : 'latin1');
```

Hungarian vendor mail is routinely **ISO-8859-2 (Latin-2)**, where `ő` is `0xF5` — which Latin-1
renders as `õ`. Lines 48–49 repeat the defect: the quoted-printable body is pushed through the
latin1→utf8 round-trip regardless of the declared charset, which is correct for UTF-8 mail and
mojibake for Latin-2. `iconv-lite` honours the declared charset.

This is very likely also *why* `tools/pdf2.js` carries its hand-written
`MAP = { '0118': 'ő', '0126': 'ű' }`.

**What is established and what is not:** the code path is confirmed by reading it. Corruption in
the actual DANIELLA archive is **inferred, not measured** — nobody has run this against a known
Latin-2 message yet. Ten minutes with one such message settles it, and that check should happen
before the fix, not after.

The GitHub repository for this package could not be confirmed by search, so the manifest records
it as an npm package only rather than asserting a path. Install with `npm i iconv-lite`.

### `mozilla/pdf.js` — Apache-2.0 — 53,902★ — pushed 2026-09-20 — **priority 1**

**Why it matters to us:** replaces `tools/pdf2.js`, which is 62 lines that regex-scan for
`stream` blocks and understand only `Td`/`Tj` in latin1 — so it breaks on any vendor PDF using
Type0/CID fonts. `getTextContent()` returns text *with positions*, which is precisely the shape
`tools/pdfrows.js` already wants, so this is a substitution rather than a rewrite.

### `exceljs/exceljs` — MIT — 15,480★ — pushed 2025-01-21 — **priority 2**

**Why it matters to us:** replaces `tools/xlsx.js`, 45 lines of hand-rolled ZIP
central-directory walking that reads only `sharedStrings`, with no handling for inline strings,
date serials or number formats.

**Stated plainly, because the first pass did not:** last code push was **January 2025**, with
808 open issues. It works, but it is not actively maintained. It remains the recommendation only
because SheetJS has left npm and GitHub for `git.sheetjs.com` — verified, its repo description
says so — which is more friction than a stale-but-working dependency. If `tools/xlsx.js` is
handling your real files today, this is genuinely optional.

---

## MindMap — `MindMap/`

### `cathrynlavery/diagram-design` — 41,495★ — **priority 2**

*"Self-contained HTML + SVG. No shadows. No Mermaid slop."*

**Why it matters to us:** `MindMap/lib/mermaid.min.js` is **3.5 MB** — the largest file in the
repository, larger than `varler_planner.html` and `vrg-inventory.html` put together. It is the
one place the single-file, minimal-bytes philosophy was compromised, and this is a project with
the same philosophy aimed squarely at it. Discount the star count per the calibration note;
judge the approach.

---

## Development harness — cross-cutting

### `NVIDIA/SkillSpector` — 17,918★ — **priority 1, do this first**

Security scanner for agent skills: prompt injection, data exfiltration, supply-chain risk,
detected *before* installation.

**Why it matters to us:** this whole list started from a subreddit where one account posted ~45
of ~55 entries in 20 days. Several items below are agent skills from exactly that kind of
channel. This is the tool that makes installing them a considered act rather than a gamble, and
it should run over anything from a link aggregator — **including the four skill packs listed
further down this page.**

### `microsoft/playwright` — Apache-2.0 — 96,412★ — pushed 2026-09-20 — **priority 1**

**Why it matters to us:** `docs/browser_verification_checklist.md` exists precisely because
jsdom cannot do that pass, and `tests/README.md` documents the gap. Playwright closes it: it
drives `file://` URLs directly — which is the actual deployment target, not a dev server — and
its screenshot comparison complements the 70 jsdom golden renders rather than duplicating them.

**And it costs exactly one dependency**, because the search turned up a useful negative result:
no dedicated visual-regression library is worth stacking on top. `lost-pixel` (1.7k★) is
**archived**; the rest are Storybook- or Cypress-bound and assume a framework and a dev server,
neither of which exists here. Playwright's built-in `toHaveScreenshot` is the whole answer.

### `biomejs/biome` — Apache-2.0 — 25,833★ — pushed 2026-09-20 — **priority 2**

**Why it matters to us:** `CLAUDE.md` states it outright — *"There is no lint script.
`node build.js --check` … is the project's substitute for 'did I break anything structurally.'"*
Biome fills that gap with a single binary: no bundler, no framework, essentially no
`node_modules` sprawl. That is about as close to this project's values as a toolchain gets.

It will not replace `build.js --check`, which verifies something Biome cannot see — that a
change to `src/` produced a byte-identical build.

### Agent skill packs — **priority 3, all of them**

Four items that mechanise habits this repository already has by hand. None is urgent; all should
go through SkillSpector first.

- **`DietrichGebert/ponytail`** — "the best code is the code you never wrote." `library-scouting.md`
  already reasons this way (see its `rbush` entry: *"don't take it on speculation"*), but that
  discipline currently lives in review. This moves it into the agent.
- **`OthmanAdi/planning-with-files`** — file-based planning that survives `/clear` and
  compaction. `ARCHITECTURE.md` + `DECISIONS.md` + `1.1_backlog.md` are the hand-built version.
- **`raiyanyahya/recall`** — durable Claude Code memory, entirely offline. `docs/AI-CONTEXT.md`
  and the dual-layer `EXPORT_vrg-inventory.txt` are the hand-built version.

Licences for all four were not confirmed; the manifest marks them as needing a check, and
`vrg-vendor.html` shows that in red.

---

## New territory — not yet an aspect

### `excalidraw/excalidraw` — MIT — 132,531★ — pushed 2026-09-20 — **priority 3**

Hand-drawn-style sketching, works offline.

**Why it matters to us:** explicitly **not** a Planner competitor. It serves the step *before*
the Planner — the rough site sketch made before anything is measured, which currently has no
home in the toolset at all. If it earns a place it becomes its own aspect rather than a feature
of something existing.

---

## Calibration — how to read a star count

Star counts in the agent-skills corner of GitHub are currently inflated by marketplace and
curated-list dynamics: several repositories a few months old sit above 100,000. Read those as
marketing reach, not as evidence of being battle-tested.

The numbers worth trusting are the unglamorous ones — 572 stars over six years for the Paderborn
symbol library, 394 over eight for `homeRoughEditor`. And pair every star count with the last
*code* push before believing it: `homeRoughEditor` scores well on both counts except the one
that matters for a dependency.
