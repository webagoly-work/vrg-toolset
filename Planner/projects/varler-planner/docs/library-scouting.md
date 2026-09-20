# Library scouting — candidates, triaged

*Everything here is judged against the two constraints that never move: the product is
**one self-contained HTML file** that runs **offline** from a stick, and the modules share a
**single global scope**. A library that needs a bundler, a network fetch or ESM imports is
disqualified no matter how good it is. Sizes are rough minified figures for shape, not
promises — measure before committing, since `dist` is already ~514 KB.*

Tags: **NOW** (fits the QR work or an open item) · **1.1** · **2.0 portable** · **WATCH**
(know it exists, don't build on it yet) · **NO** (recorded so it isn't re-investigated).

---

## Directly adjacent to the QR work

### `nayuki/QR-Code-generator` — MIT — **NOW, already in**
The encoder now sitting inside `05f-qr.js`. Worth knowing what else is in that repo: the
same algorithm in ten languages, and a reference implementation of segment-mode optimisation
(splitting a payload into numeric/alphanumeric/byte runs) that squeezes noticeably more into
one code than blind byte encoding. The ES6 build already does the easy part of this; the
advanced `makeSegmentsOptimally` variant is in the repo if a payload ever lands just over the
limit.

### `six-two/qr.html` — Unlicense — **NOW, as reference**
Your source. Two things in it are worth keeping in view beyond the encoder:
`tiny-qr.html` (a <13 KB generator small enough to transfer by *keystroke emulation* onto a
machine with no clipboard and no file transfer — exactly the fresh-machine problem the
Portable Pack fights), and `qr-zip.html` (deflate → binary QR). The latter is a **NO** for us:
it breaks every normal reader, so the receiving phone would need bespoke software.

### `101arrowz/fflate` — MIT — ~8 KB — **1.1**
Pure-JS deflate/inflate and ZIP, no dependencies, works in a single file. Three uses here,
in order of value: (1) compress `.vbundle.json` backups, which are large and highly
repetitive; (2) shrink base64 lamp photos inside a project file; (3) let `/dl` serve a zipped
export. Not a QR enabler — see the `qr-zip` note above.

### QR *reading* on the PC — **WATCH**
Not needed by any current flow (all of them are phone-reads-screen), but when it is:
- **Chromium's native `BarcodeDetector`** — zero bytes, already in Opera GX, no library at
  all. Try this first. Feature-detect it; it is not in Firefox or Safari.
- `cozmo/jsQR` — Apache-2.0, ~35 KB, pure JS, no camera code. Confirmed dormant but still the
  standard fallback.
- `nimiq/qr-scanner` — wraps the decode in a Web Worker with camera handling; better ergonomics,
  but ships as two files, which fights the single-file rule.

---

## For the 1.1 model and UI

### `dagrejs/dagre` — MIT — ~90 KB — **1.1, for R1**
Layered directed-graph layout, client-side, rendering-agnostic: you hand it nodes with widths
and heights, it hands back coordinates, you draw them with your own SVG. That is precisely the
shape of the Rendezés mind-map (R1) — bubbles and lines hanging off the Elosztószekrény, which
is a layered DAG in all but name. `@dagrejs/dagre` on npm is the maintained fork (the original
`cpettitt/dagre` is dead); it was still being updated in 2026.

The alternative, **`kieler/elkjs`**, is far more configurable and is what serious diagram tools
use — but it is a GWT-transpiled Java library, it is large, its API is asynchronous, and it is
**EPL-2.0**, which is weak copyleft and needs a decision rather than a shrug before it goes
into a file you hand to customers. Start with dagre.

Worth saying plainly: R1 may not need auto-layout at all if the user places the bubbles. Take
this one only after you've decided that question.

### `anvaka/ngraph.path` — MIT — ~15 KB — **1.1, for the parked "Path auto router"**
A*/NBA* pathfinding over an arbitrary graph with a pluggable heuristic. This is the closest
off-the-shelf fit for the auto-router idea you parked: once `connectivity()` gives you
terminals and segments, "suggest a route between these two terminals" is a shortest-path
query where the cost function is yours to write — chase length, drilling, level changes,
existing conduit you can backtrack along (which should cost *less* than new geometry, since
`DECISIONS.md` already establishes backtracking as an occupancy rule).

The lighter option is `bgrins/javascript-astar` (MIT, ~5 KB) if a grid is enough. It probably
isn't — walls and openings make this a graph problem, not a grid problem.

### `mourner/rbush` — MIT — ~6 KB — **WATCH**
R-tree spatial index. Relevant to the known weakness in `ARCHITECTURE.md`: hit-testing and
snapping scan every record linearly, and `draw()` has 232 call sites. If a project ever gets
large enough that `pathSectionHit` or `SNAP` lookups show up in a profile, this is the fix —
but **don't take it on speculation.** The measured bottleneck today is SVG parsing, not
JavaScript, and the two-layer repaint already addressed that.

### `mfogel/polygon-clipping` — MIT — ~40 KB — **WATCH, and read `DECISIONS.md` first**
Boolean polygon operations. `DECISIONS.md` records the deliberate choice *not* to take a
union library for chase merging, and to sample polygon edges instead. That decision stands.
Note this one only so that if edge-sampling ever produces a wrong outline on a real drawing,
you know the escape hatch exists and roughly what it costs. `w8r/martinez` (MIT) is the other
implementation of the same algorithm.

### `jakearchibald/idb-keyval` — Apache-2.0 — ~1 KB — **1.1, for open item 2**
Your localStorage rescue item is a symptom of something structural: localStorage is
profile-bound, synchronous, and capped around 5–10 MB — and your projects carry base64 lamp
photos. IndexedDB has no practical cap and survives more browser-profile situations.
`idb-keyval` is a ~1 KB `get`/`set`/`del` wrapper over it, which is all the surface you'd want;
`localForage` (Apache-2.0, ~30 KB) does the same with more fallbacks you don't need.

This would be a real migration — `11-controls.js` persistence goes async — so it is a
deliberate 1.1 item, not a drop-in. But the current pain is a preview of the pain at scale.

### `mholt/PapaParse` — MIT — ~20 KB — **1.1, small**
CSV in and out, offline, handles the encoding and quoting edge cases you'd otherwise
rediscover. Two fits: exporting the BOM to something a supplier can price, and importing the
per-distributor supplier-code mapping that `DECISIONS.md` says belongs to the user rather than
to the catalogue.

### `parallax/jsPDF` + `yWorks/svg2pdf.js` — both MIT — ~350 KB together — **WATCH**
Offline PDF export of the plan. Strategically right for the Dokumentáció stage, and the only
way to hand a customer something that isn't a screenshot or a print dialog. The cost is real:
it roughly doubles `dist`. Check whether the browser print path plus "Save as PDF" gets you
90 % of this for zero bytes before spending it. `canvg` (MIT, ~180 KB) is the SVG→canvas
rasteriser if a PNG export is wanted instead — but you already rasterise QR codes directly
from the module matrix in `05f`, and the same trick (draw it yourself, don't round-trip
through an `<img>`) may well apply to the plan.

---

## For the 2.0 portable / on-site track

### `websockets/ws` — MIT — **already in**
Noted only to say the relay's dependency list should stay at exactly this length. Every
addition is another thing that has to survive being copied to a stick.

### WebRTC (`peers/peerjs`, `feross/simple-peer`) — MIT — **NO**
Recorded as a dead end alongside the ones already in `portable-pack-concept.md`. The appeal is
"phone talks to PC with no server"; the reality is that peers must exchange offers through
*something*, so you still run a signalling server — you've replaced one server with two moving
parts. The relay you already have is simpler and works.

### `gildas-lormeau/zip.js` — BSD-3 — **NO**
Superseded by fflate above for our purposes; noted so it doesn't get evaluated twice.

---

## The shortlist, if you only take three

1. **`fflate`** — smallest change, immediate value on backups and project size, and it
   unblocks a zipped `/dl`.
2. **`ngraph.path`** — the parked auto-router stops being a research question and becomes a
   cost-function question, which is the part only you can answer.
3. **`idb-keyval`** — because the localStorage problem is going to come back, and it will come
   back on site.

Everything else on this list is a *know it exists* entry, not a *take it* entry.

---

# Second pass — GitHub search, 2026-09-20

*Found by searching GitHub directly rather than by reading a recommendation feed. Every entry
below carries its **star count and last-push date**, because that is the signal the
link-aggregator route does not give you and the thing most worth knowing before you depend on
anything.*

One tag is new. **TOOLING** means *runs on this PC at build or test time and never enters
`dist`* — so the single-file rule, the global-scope rule and the size budget simply do not
apply to it. That distinction is what makes most of this section cheap. A few entries below are
scoped to `Inventory/` rather than the planner; they are marked, and they live here because
this is where library decisions get recorded, not because the planner needs them.

**Calibration, stated once.** Star counts in the agent-skills corner of GitHub are currently
inflated by marketplace and curated-list dynamics — several three-month-old repos sit above
100k. Read those as marketing reach, not as evidence of being battle-tested. The numbers worth
trusting here are the unglamorous ones: 394 stars over eight years beats 142k over three months.

---

## Things that could ship in `dist`

### `upb-lea/Inkscape_electric_Symbols` — 572★, active — **NOW, pending a licence read**
An electrical symbol library in Inkscape SVG, from Paderborn's power-electronics group. The
reason this one is unusually low-risk: **symbols are data, not code.** No bundler, no global
scope to collide with, no TDZ ordering question — it is geometry you paste into `04-render.js`
or `10-lamps.js`. The only real gate is whether its licence permits redistribution inside a
drawing you hand to a customer. Read that before inlining a single path.

### `ekymo/homeRoughEditor` — 394★, created 2018, still pushed — **reference, not a dependency**
"Floorplan editor SVG to create houseplan and homeplan with Javascript for client." The closest
public peer to this project that exists: same medium, same no-framework posture, same problem.
Take it as a **reading exercise, not an import** — specifically how it models wall junctions and
room detection, since `1.1_backlog.md` is about to rework exactly that into
terminals/segments/runs/circuits. Eight years of survival is the interesting fact about it.

### `pascalorg/editor` — 24.2k★, very active — **NO as a dependency, WATCH as a design source**
Local-first 3D architectural editor — BIM/CAD/floorplan — with MCP tools and agent skills built
in. Next.js and react-three-fiber, so adopting it is off the table and always will be. Noted
because it is the only serious *floorplan editor designed for an agent to drive*, which makes
its document schema worth reading against `2_0_architecture.md`. Read the model, take nothing.

---

## TOOLING — never enters `dist`

### `NVIDIA/SkillSpector` — 17.9k★ — **TOOLING, do this first**
Scans agent skills (Claude Code, Codex, MCP) for prompt injection, data exfiltration and
supply-chain risk *before installation*. This is the highest-value entry in this pass and it is
not close. Any skill arriving from a link aggregator, a curated list or a social feed should go
through this before it touches the machine — see the provenance note under **Recorded as NO**.

### Playwright — Apache-2.0 — **TOOLING, and the search's most useful negative result**
`browser_verification_checklist.md` exists because jsdom cannot do that pass, and
`tests/README.md` documents the gap. Playwright closes it: it drives `file://` directly, which
is the actual deployment target, and its screenshot comparison complements the 70 jsdom golden
renders rather than duplicating them.

The negative result matters as much: **no dedicated visual-regression library is worth adding
on top.** `lost-pixel` (1.7k★) is archived; the rest are Storybook- or Cypress-bound and assume
a framework and a dev server, neither of which exists here. Playwright's built-in
`toHaveScreenshot` is the whole answer, so this recommendation costs one dev dependency.

### `iconv-lite` — MIT — **TOOLING, `Inventory/`, and it fixes a live bug**
`tools/eml.js:10` falls back to `latin1` for any non-UTF-8 charset. Hungarian vendor mail is
routinely **ISO-8859-2 (Latin-2)**, where `ő` is `0xF5` — in Latin-1 that decodes as `õ`. Lines
48–49 have the same defect: the quoted-printable body is pushed through the latin1→utf8 trick
regardless of the declared charset, which is correct for UTF-8 mail and mojibake for Latin-2.
`iconv-lite` honours the declared charset. This is very likely also *why* `tools/pdf2.js` needs
its hand-written `MAP = { '0118': 'ő', '0126': 'ű' }`.

Smallest change on this list, and the only entry that repairs something already broken.

### `mozilla/pdf.js` (`pdfjs-dist`) — Apache-2.0 — **TOOLING, `Inventory/`**
Replaces `tools/pdf2.js` — 62 lines that regex-scan for `stream` blocks and understand only
`Td`/`Tj` in latin1, and therefore break on any vendor PDF using Type0/CID fonts.
`getTextContent()` returns text *with positions*, which is the shape `pdfrows.js` already wants.

### `exceljs` — MIT — **TOOLING, `Inventory/`**
Replaces `tools/xlsx.js` — 45 lines of hand-rolled ZIP central-directory walking that reads only
`sharedStrings`, with no handling for inline strings, date serials or number formats.

SheetJS is the better-known option and is **not** the easier one any more: its GitHub repo now
redirects to `git.sheetjs.com`, and it has left npm. Verified, not remembered. Prefer `exceljs`
unless something specific demands otherwise.

### `ibrahimqureshae/mdflux` — 424★ — **WATCH, `Inventory/`**
Local-first PDF→Markdown including scanned PDFs with OCR. A desktop app rather than a library,
so treat it as a **benchmark** — does it beat `pdf2.js` on the real vendor documents? — rather
than as something to import into the pipeline.

---

## Agent harness — matches discipline this repo already has

### `cathrynlavery/diagram-design` — 41.5k★ — **1.1**
Tagline: *"Self-contained HTML + SVG. No shadows. No Mermaid slop."* `MindMap/lib/mermaid.min.js`
is **3.5 MB** — the largest file in the repository, larger than both deliverables put together.
Same philosophy as this project's, aimed squarely at the one place it was compromised.

### `DietrichGebert/ponytail` — **WATCH**
"The best code is the code you never wrote." This document already reasons this way — *"don't
take it on speculation"* under `rbush` — but that discipline currently lives in review. This
moves it into the agent. Discount the star count per the calibration note; judge the rules.

### `OthmanAdi/planning-with-files` — 27k★ — **WATCH**
File-based planning that survives `/clear` and compaction. `ARCHITECTURE.md`, `DECISIONS.md` and
`1.1_backlog.md` are a hand-built version of this. Worth comparing before mechanising anything.

### `raiyanyahya/recall` — 752★ — **WATCH**
Durable Claude Code memory, entirely offline. `docs/AI-CONTEXT.md` and the dual-layer
`EXPORT_vrg-inventory.txt` are the manual version. Modest stars, but offline-first, which is the
constraint that matters here.

---

## Recorded as NO, so they aren't evaluated twice

### `BuilderIO/mitosis` — **NO**
Write a UI component once, compile it to React/Vue/Svelte/Angular. Actively wrong for this
project: there is no framework, no bundler and a deliberate single-global-scope rule. It solves
a problem this codebase engineered its way out of.

### Provenance note — link-aggregator recommendations
The feed that prompted this pass (r/BestGitHubRepos) had roughly 45 of ~55 posts from a single
account over 20 days, most scoring 2–12 upvotes. That is a promotional channel, not curation.
It is not a reason to ignore it, but it is a reason to run **SkillSpector** over anything
sourced from it, and to weight a three-week-old repo with nine stars accordingly — against a
product whose whole premise is surviving on a stick, offline, years from now.

---

## The shortlist for this pass, if you only take three

1. **`NVIDIA/SkillSpector`** — before anything else on this page gets installed, including the
   rest of this shortlist.
2. **`iconv-lite`** — the only entry that fixes a bug that is already corrupting data.
3. **`upb-lea/Inkscape_electric_Symbols`** — symbols are data, so the constraints that gate
   everything else on this page do not apply. Licence read first.

Playwright sits just outside the three only because it is a harness change rather than a
dependency; it remains the right answer to the manual browser pass.
