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

# Second pass — 2026-09-20

The second scouting round searched GitHub directly rather than reading a recommendation feed. It
covered the whole VRG toolset, not just the planner, so **it does not live in this file** — a
document scoped to "judged against the single-file rule" loses its value if business tooling and
servers get mixed in. It lives here instead:

| | |
|---|---|
| `/docs/components-offline.md` | single-file/offline components and local build-time tooling, grouped by which VRG aspect they serve |
| `/docs/services-server.md` | things that need a server, with the operational cost stated up front |
| `/vendor-manifest.json` | machine-readable source of truth — licence, stars, last **code** push |
| `/vrg-vendor.html` | the same list as a VRG-style page; `node tools/fetch-vendor.js --all` downloads what is downloadable |

What the second pass changes about **this** file:

### `jakearchibald/idb-keyval` — the licence above is unverified
This document records it as Apache-2.0. The GitHub API reports `NOASSERTION` — no standard
licence detected. That is not an accusation, it is a gap: read the LICENSE file before this goes
into a file handed to a customer. The technical argument for it is unaffected.

### A method correction worth keeping
Judging whether a project is alive means reading `pushed_at` (last code push), **not**
`updated_at` — the latter moves when somebody stars the repository. The second pass initially
called `ekymo/homeRoughEditor` actively maintained on the strength of `updated_at: 2026-09`; its
last actual code push was **2024-07-21**. Good as a reference, disqualifying as a dependency.
The same mistake is easy to repeat on every entry in this file.

### One blocker dissolved
`upb-lea/Inkscape_electric_Symbols` is **CC0-1.0** — a public-domain dedication. It is the
cleanest candidate in either pass: symbols are data, so none of the constraints at the top of
this document apply to them at all.

### One dependency is staler than it looked
`exceljs` was recommended over SheetJS. That still holds, but its last code push was
**2025-01-21** with 808 open issues. SheetJS having left npm for `git.sheetjs.com` is the reason
to prefer it, not its health.
