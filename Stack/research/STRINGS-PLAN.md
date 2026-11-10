# VRG Stack: Stack Strings, the live twin and the particle viewer (plan, 2026-11-10)

*A plan only; nothing in it is built. It turns the Founder's original idea for the Stack into work packages for the next session(s). The Thread Board becoming a Stack page is the first concrete piece. Decision ids continue at **STK-Q18**.*

---

## 0. The idea, stated once

1. **There is one body of data.** Every layer is one of two things:
   - a **filter**: the part of the whole that is quantifiable as ideas, as decisions, as commits…
   - a **digital shadow**: the whole seen in another form (the Codec folds it, the Globe holds every word).

   *Planner* is one thing:
   - a program on F;
   - the ideas that became it on I;
   - the questions asked about it on Q;
   - the lines and sessions that moved it on L/U;
   - its commits on R, its folders on C, its words on G;
   - its folded lines on Z.
2. **A Stack String (Füzér)** is what you get when you select a thing on any layer: the vertical connections light up every node about it on every other layer.
   - **The string's reach is its development state.** A thing present on every layer is a full program. A short string, F + I + Q only, is an idea with plans but no build yet.
3. **Pages are generated, never hand-drawn.** Every layer page renders only from the build's state and carries that build's id, so it cannot drift from the data. A page is also an interface: it lets you act on the thing it shows.
4. **Digital twin.** An edit made on any layer goes to its source through one gateway, the stack rebuilds, and every open page updates. No page holds state of its own.
5. **The Stack Viewer** is the central page.
   - Each layer is a horizontal plane.
   - The viewer reads each layer's whole output as raw text and shows it as particles, about 1 particle per 1–2 bytes at full detail. A detail setting keeps lesser machines usable.

### What already exists toward this (do not rebuild it)

| Piece | Where | State |
|---|---|---|
| Layers as filters with vertical keys | `lib/layers.js`, `lib/join.js`, 15 279 edges of which **12 096 vertical** | ✅ |
| Pillars (one real thing across layers) | `entities.js`, 31 pillars, layer E | ✅ but by hand and without a page |
| "Its string, layer by layer" in a node card | `layers.html` `select()`: "Füzér rétegenként" | ◐ list only, not drawn and not scored |
| Bytes as particles | Konnektóm: 1 node = 2 KB on disk | ◐ 2 KB per particle, not per byte |
| Event log, bitemporal | `data/events.jsonl`, `lib/events.js` | ✅ the twin's history already exists |
| Server with actions | `serve.js` :8806, `POST /api/build`, `/api/connectome` | ◐ no push and no edits |
| Generated layer pages | lineage, control, commits, decisions, metro, runs: `out/*-data.js` | ✅ six pages. F, C and G live in other apps |
| Write-back | ROADMAP 2.7 | ✗ the A/B/C buttons copy prompts |

### Measured today (build of 2026-11-10 01:05)

| Layer | Nodes | JSON bytes | Page data |
|---|---|---|---|
| F | 105 | 32 KB | the Dashboard (outside the Stack) |
| I | 129 | 41 KB | lineage-data 69 KB |
| Q | 172 | 93 KB | decisions-data 256 KB |
| L | 188 | 77 KB | metro-data 443 KB |
| A | 192 | 106 KB | control-data 387 KB |
| U | 255 | 114 KB | runs-data 670 KB (recordings 16 MB) |
| R | 455 | 192 KB | commits-data 224 KB |
| C | 221 | 79 KB | Kódváros; the tracked code itself is 26.7 MB |
| G | 447 | 257 KB | Gömb; the tracked `.md` text is 4.6 MB |
| E | 31 | 9 KB | none |
| Z | — | — | codec 232 KB |

The whole graph is **2 195 nodes** and about 1 MB of node JSON. The generated page data adds about 2.3 MB.

---

## 1. Stack Strings (Füzérek)

### 1.1 What a string is

`string(seed)`: start at the seed node and collect the nodes reachable over **vertical** edges (any relation whose ends are on different layers), plus the seed's pillar(s). The walk is weighted and bounded:

- **Depth:** at most 2 hops, default 2.
- **Edge weight:** `ref:*` 1.0, `same` 1.0, `pillar` 0.8, `touched` × (steps / max), `alike` 0.5.
- **Score:** a node's score is the product of the weights along its best path. Nodes below **0.15** are dropped.
- **Hubs:** the hub damping of `lib/activation.js` is reused, so `tools/` and the Planner folder do not swallow every string.
- **Horizontal edges** are followed one step only, and only inside the seed's layer (a feature's `part` children belong to its string).

A string is stored as `{seed, members: [{id, layer, score, via}], reach, profile, class}`. It is computed in Node (`lib/strings.js`) and in the browser from the same code, the way `lib/activation.js` already runs in both.

### 1.2 Reach and profile

- **reach**: the set of layers the string touches, as a fixed 10-letter mask in stack order, e.g. `F I Q L A · R C G Z`. A dot means "not reached".
- **profile**: per layer, the summed score and the newest date. The newest date gives the string a *pulse*: when did anything on it last move?

### 1.3 Development state from reach (the natural side effect)

These rules are evaluated top to bottom, and the first one that matches wins. They are tunable in `config.js`, never hard-coded in a page.

| Class | Rule | Reads as |
|---|---|---|
| **Program** (Teljes program) | F + R + C + G, and L or U, with F tier ≤ 2 | a full-blown tool |
| **In build** (Fejlesztés alatt) | R or C reached, and a U or R event in the last 14 days | being built now |
| **Built, quiet** (Kész, csendes) | R + C reached, nothing in U/R for 30 days or more | built, then left |
| **Planned** (Tervezett) | I and/or Q and G reached, but no R and no C | ideas and documents, no code |
| **Spark** (Szikra) | only F and/or I | an idea, nothing more |
| **Orphan** (Árva) | C or R reached, but no F and no I | code nobody registered: the Stack's version of check-start's "never heard of" list |

The six-step status scale on the Thread Board (`op · high · mid · low · out · idea`) is typed by hand. Each thread can be compared with its string's class. When the two are two or more steps apart, that becomes a drift card in `DRIFT.md`. The card proposes a change and never applies one.

### 1.4 Where strings show

- **Viewer:** the string's members light up on every plane; everything else dims to about 15 %. One vertical **string line** runs through the planes, joining the members' cell centroids layer by layer, and the pillar line is drawn as a straight spine.
- **Every layer page** gets the same selection. Choose Planner in the Viewer and the metro map highlights the Planner lines, the Döntésnapló filters to its questions, Commit-pixel re-colours to its commits (§3.3 says how).
- **CLI and MCP:** `stack.js string <id|words>` prints the reach mask, class and per-layer top members. A new MCP tool, `stack_string`, gives an agent the same answer in about 300 tokens.

---

## 2. The Thread Board as a Stack page (the first concrete step)

### 2.1 What is duplicated today

| Field on the board | Comes from today | Also known by |
|---|---|---|
| status word, last date, quiet days, next step, remaining | `lines.js` + `board-lines.json` | L layer, Vonaltérkép |
| built list `d` | `threads.js`, by hand | F nodes, R commits, Stack pages |
| not-yet list `t` | `threads.js`, by hand | `lines.js remaining`, ROADMAP ✗ rows, PROPOSALS, open Q |
| six-step status `s` | `threads.js`, by hand | could be computed from the string (§1.3) |
| area grouping, note, read list, go | `threads.js`, by hand | **only here** |

### 2.2 The target

- **Threads become pillars.** A thread is a named, saved string. The 47 threads map onto the 31 pillars plus about 16 new ones (Kit Gyár, Finom alaprajz, Chase…). Each pillar gets an **area** and an optional **hand status**. One list then describes "the real things", and the Thread Board is simply **the E layer's page**: **Füzértábla** (String Board), `Stack/board.html` + `out/board-data.js`.
- **The page takes nothing by hand except what only the Founder knows.**
  - **Kept by hand:** area, note, read list, go, the curated not-yet items and the optional hand status.
  - **Computed from `stack.json`:**
    - the reach mask (shown as 10 small squares per row: the string at a glance);
    - the class and the pulse;
    - the DevLog line states;
    - built items (F nodes in tier 1–2 on the string, plus Stack pages);
    - "looks done" flags.
- **The source stays a source.** The hand-kept part of `threads.js` moves into `Stack/entities.js` (or a `threads.json` it reads). It moves as data, not as JavaScript code, so the write gateway (§4) can edit it safely. `notes/devlog/board.js` becomes a three-line forwarder for one release, then retires. START F opens `board.html`. `metro.js` reads threads from the stack instead of re-reading `threads.js`.
- **Open work becomes a layer.** The not-yet items become **T · Teendők** nodes (§5). This gives them vertical links, which makes the drift check possible: a T node whose best match on F/R is built ("Döntésnapló" ↔ `F` tier 1 + commit `6ec3239`) is shown as **"késznek tűnik · looks done"**, with the evidence and a one-click "mark done" (through §4, with approval).
- **The anonymised copy for claude.ai** is regenerated from the same data with `anonymise.map.json`, replacing `board.js --public`. Board data stays in `out/` (git-ignored, because it quotes job codes).

### 2.3 Acceptance

- **Parity test:** every thread and every item on today's `BOARD.html` appears on `board.html`, and no item is lost.
- **Drift check:** the stale "Missing pages: Döntésnapló…" case from 2026-11-10 is flagged automatically.
- **No duplicated hand data:** no field exists in two hand-edited files (a test greps for it).

---

## 3. Generated pages and the live twin

### 3.1 The page contract (every layer page)

1. **Data:** the page renders only from `out/<page>-data.js`, which carries `{build, schema, generated}`. The page shows "generated from build N, HH:MM" and turns amber when a newer build exists. A lint test fails if a page holds literal node ids or hand data.
2. **API:** the page exposes `window.STACK_PAGE = { layer, select(id), highlight(ids, mode), getSelection() }`.
3. **Selection bus:** the page joins `BroadcastChannel('vrg-stack')` with the messages `select`, `string` and `changed`. It falls back to `storage` events, and works on its own when neither is available.
4. **Actions:** every button that changes something goes through §4 and shows the diff first. Copy-prompt buttons stay as the offline fallback.

### 3.2 Live updates (the twin's nervous system)

```
source file changes (hand edit, a session, the gateway)
   └─► serve.js fs.watch (debounced 1.5 s) ─► which layer owns this path? (config.js source map)
          └─► incremental build: re-run only that layer's adapter + join + strings + the affected page stages
                 └─► event log (node+/node-/state/edge±) ─► SSE /api/events  {build, layers, ids}
                        └─► every open page refetches its data file and animates the diff (changed nodes pulse)
```

- **Speed:** a full build takes 6–30 s today. The target for a one-layer change (`threads.js`, `lines.js`, a DECISIONS file) is **under 1.5 s**. The join is the expensive part, so it has to become incremental by layer: only the edges touching the changed layer are recomputed.
- **file:// fallback:** the existing 60 s re-read of the data file stays. Live updates, the bus and edits need `node serve.js`, and the pages say so.
- **The MCP server stays read-only.** It never builds and never edits.

### 3.3 Cross-page highlight, in practice

Each page maps a string onto its own vocabulary:

| Page | Shows a string as |
|---|---|
| Ötletfolyam | the string's streams, others greyed |
| Döntésnapló | filtered list |
| Vonaltérkép | tracks highlighted, other tracks thinned |
| Futásnapló | bars of the string's runs |
| Commit-pixel | grid re-coloured to the string's commits |
| Vezérlőterem | agents and briefs on the string |
| Füzértábla | the row opened |
| Konnektóm / Holo | firing replayed on the string's nodes |

F, C and G live in other apps (Dashboard, Kódváros, Gömb). Each gets a small adapter that listens on the same bus and is added only when that app is next touched. Until then the Viewer links to them with `#sel=`.

---

## 4. The write gateway (edits from any layer)

The Stack's house rule is still in force: *"a source changes only by its own tool or by hand."* The gateway respects it. It **is** that tool, and the Founder's click in the diff dialog is the "by hand".

- **Module:** `lib/edit.js`, with one **editor per source format**:
  - `threads` (data; the first one);
  - `lines` (status, next step, remaining);
  - `decisions` (append a dated answer in the file's own format: ROADMAP 2.7);
  - `features` (tier, state; "a tier changes only by hand, when you say so" is satisfied by the approval);
  - `ideas` (add an idea, add a link).
- **Flow:**
  1. The page sends `POST /api/edit/preview {op}`.
  2. The server returns a unified diff plus the file's hash.
  3. The page shows the diff, and the Founder approves it.
  4. The page sends `POST /api/edit/apply {op, hash}`.
  5. The editor refuses if the hash changed (optimistic lock: someone edited the file meanwhile).
  6. Otherwise it writes with `fsx.writeAtomic` and appends an `edit` event (who, page, op, diff hash).
  7. The incremental build and the SSE push follow (§3.2).
- **Never touched by the gateway:**
  - R (git history is never rewritten);
  - U (recordings are only what transcripts say);
  - A (agents' memory belongs to the agents);
  - C and G file contents. For these, the page offers *open in editor*, *copy a prompt* and *jump to Kódváros / Gömb*.
- **Never commits.** Edits land in the working tree; committing stays with START S or a session.
- **Tests:** throwaway copies of each source in `%TEMP%\VRG`, the same pattern as the launcher's git e2e tests. A round-trip test: parse → edit → parse gives the expected node change and no other byte changes.

---

## 5. More layers to filter the same data by (suggestions)

The planned five (RULES §6a) are Munkák, Eszközök, Látvány, Külső and Szereplők. The table below adds candidates that the String idea specifically needs. Each one is one adapter (ARCHITECTURE §4).

| Layer | Letter? | Holds | Source | What it adds to a string | Effort | Rec. |
|---|---|---|---|---|---|---|
| **Teendők** (Open work) | T | every not-yet item, deduplicated across the board's `t`, `lines.js remaining`, ROADMAP ✗ rows, PROPOSALS and open Q | the existing files | what is **missing** along a string; makes "looks done" possible | S | **1st** (the board needs it) |
| **Belépők** (Entry points) | N | every way to open a thing: START keys, servers + ports, desktop catalog items, Mobile features, `vrg-app://` | `launcher/vrg-menu.json`, `vrg-catalog.json`, Mobile registry | "a tool not in START does not exist": a string with C but no N is unreachable | S | **2nd** |
| **Próbák** (Tests and checks) | P | test suites, golden renders, check-start / check-hub / selftests, last result | `test/` folders, runner outputs | separates **built** from **verified**; the Program class should require it | M | 3rd |
| **Kérések** (Founder's asks) | K | every Founder prompt from the recordings, clustered | `out/recordings` | where attention went; the upstream of Q and I; asks that never became a line | M | 4th |
| **Jelzések** (Signals) | J | every warning: HEALTH, DRIFT, Solomon signals, check-start failures, stale briefs | the reports | a string can **glow red**; the Viewer shows where trouble sits | S | 5th |
| Munkák (Jobs) | M | client jobs, quotes, deliveries | job register, Workflow Kit | the money path on a string (Planner → which jobs used it) | M | per STK-Q5 |
| Eszközök (Devices) | D | boards, ports, firmware builds | Board Console, firmware | code → physical board | M | later |
| Látvány (Look) | V | design systems, logos, assets | Visual Base, UI Kit | which look a thing wears; look drift | S | later |
| Külső (Outside) | O | vendored repos, programs, MCP servers, plugins, licences | `vendor-manifest.json`, programs, settings | what a string depends on, under which licence | S | later |
| Szereplők (People and roles) | W | Founder, colleague, accounts, agent personas, competence | Kapu, ROSTER | who knows / owns a string | M | later |
| Függőségek (Imports) | — | a sub-layer of C (ROADMAP 2.8): file → file | require/import scan | strings reach below folders | M | with C |

**Letters:** only one letter clashes. The ROADMAP's working names had **E**szközök and **L**átvány, but E and L are taken (pillars and DevLog). The letters above are free; the namespace is `[FIQLAURCGEZ]` + the new letters (`schema/shapes.js LAYER`).

**Stack order** (top = user, bottom = raw):

- **New order:** N · F · K · I · Q · T · L · A · U · P · R · C · G · J · Z
- **Today:** F · I · Q · L · A · U · R · C · G · Z

Signals sit next to the raw material they flag.

---

## 6. The Stack Viewer (Rétegverem) with byte particles

### 6.1 What it reads: the layer text

- **What it is:** a new build stage writes **`out/layertext/<L>.bin`** per layer: a deterministic, canonical serialisation of that layer's whole output. The parts are:
  - the layer's nodes in natural order, each as `title · brief · fields`;
  - its page data;
  - for G, the documents' own text (≈ 4.6 MB);
  - for C, the tree listing with sizes. The actual code bytes (26.7 MB) are streamed only on demand (§6.4).
- **The index:** next to each file, **`<L>.idx`** maps each node id to its `[start, end)` byte range. Every particle can therefore be resolved back to its node and to the words at that offset. This answers Cortesi's open problem ("where in the binary does this lie"), because here every range has a name.
- **Deterministic:** the same data gives the same bytes. A changed node therefore changes only its own byte range, and the Viewer can glow exactly the particles that changed after a rebuild.
- **Estimated size:** about 3 MB without document text, about 8 MB with it.

### 6.2 Layout: the layer's natural order, then a Hilbert fill

1. **Cells.** Each plane is divided into node cells by the layer's own order (the ◐ ① item in LAYERS §1):
   - F: tier × lane grid;
   - I, L, U, R: x = time (date), y = lane / line / branch;
   - Q: namespace columns;
   - A: kind bands;
   - C, G: a squarified treemap (containment), cell area ∝ bytes;
   - T: thread groups;
   - E: one cell per pillar.
2. **Particles.** Inside its cell, a node's bytes run along a **Hilbert curve**. The Hilbert curve keeps nearby bytes near each other better than other curves (Cortesi's binvis), so a document's paragraphs become visible blocks and a long brief becomes a patch.
3. **Colour.** The byte's class (letter, accented letter, digit, space, punctuation, structure `{}[]",`, other) sets the shade, tinted by the layer's colour. The node's state (open / done / stale) sets the brightness, and string membership sets the glow.

### 6.3 Particle budget and the detail setting

| Preset | Bytes per particle | Particles (≈3–8 MB of layer text) | For |
|---|---|---|---|
| Vázlat (Sketch) | 64 | 50 k – 130 k | phone, weak GPU, file:// bundles |
| Normál | 16 | 200 k – 500 k | **default on the phone** |
| Finom (Fine) | 4 | 0.8 M – 2 M | **default on the desktop** |
| Bájt (Byte) | 2 | 1.5 M – 4 M | desktop GPU |
| Teljes (Full) | 1 | 3 M – 8 M | strong GPU; the "every byte" view |
| **Auto** | measured | as above | picks the finest preset whose first-frame time is under 12 ms; steps down at below 40 fps |

- **Why 1 B per particle is cheap here:** a particle needs **no position buffer**.
  - The vertex shader computes the position from `gl_VertexID`: the Hilbert `d2xy` (about 12 loop steps), offset by the node cell. The cell comes from a small cell texture looked up by the node index, and a range texture maps a byte to its node.
  - The only per-particle attribute is the byte value itself (1 `UNSIGNED_BYTE`).
  - At Full, 8 M particles take **8 MB of GPU memory**.
- **Coarser presets** aggregate k bytes into one particle on the CPU at load time: the dominant class and the mean value. The cost is a single pass of under 50 ms.
- **Zoom LOD:** when a node cell is close to the camera, that cell is drawn at Full detail and the rest stay at the preset. The finest level is therefore always reachable locally, even on a phone.
- **Renderer:** plain WebGL2 in the page, as CN-Q5 decided. ES modules and Three.js do not load from file://.
- **Perf test:** the page records frame times with an fps counter; the target is 60 fps at Fine on this PC and 30 fps at Normál on the phone.

### 6.4 Interaction

- **Picking:** a GPU ID buffer encodes the particle index in RGB (up to 16 M; one 24-bit id is enough at Full).
  - It is drawn at **¼ resolution**, re-rendered only when the camera stops moving or a filter changes, and read as one pixel. The synchronous `readPixels` stall is then paid once per pick, not every frame.
  - The id resolves to the layer + byte offset → the node (from the index) → the **actual words** at that offset, shown in the tooltip. Pointing at a dot shows the text it is made of.
  - This replaces `layers.html`'s CPU loop over all items, which cannot scale to millions.
- **Clicks:**
  - click = select the node → its string (§1.4);
  - double-click = fly into the cell (local Full detail);
  - Shift+click = add to the selection (two strings and their overlap);
  - a layer label = solo the layer;
  - right-click = hide it.
- **Deep dive on C:** with a C cell selected, **Kód bájtjai** streams that folder's real file bytes from `serve.js` (`GET /api/bytes?path=`, read-only, capped at 4 MB) into the cell, one particle per byte.
- **Time:** a scrubber replays `data/snapshots`. Particles of nodes not yet born are hidden, and an `edit` event pulses its range.
- **Live:** on the SSE `changed` event, the Viewer refetches only the changed layer texts and glows the byte ranges that differ.
- **Act:** the card offers the actions of §4 for the selected node, through the same diff dialog as the layer pages.

### 6.5 What happens to today's 3D pages

| Page | Its job after the Viewer arrives |
|---|---|
| `layers.html` (Rétegek) | replaced by the Viewer (same START key R → 7). Its isometric camera, touch gestures and `#full #crisp` carry over |
| Konnektóm / Holo | stay as *other shadows* (the brain, the orb). They take the bus so a string lights there too |
| `stack-search.html` | stays as the flat, text-first view |

The Viewer is the hub: every layer label opens that layer's page with the current selection.

### 6.6 Prior art (read before building)

- **Arena3D / Arena3Dweb:** stacked network layers in 3D, each layer movable and rotatable. Separating layers in depth leaves room for the links between them. The view needs strong navigation help, which the isometric home and solo layer give.
- **muxViz:** multilayer analysis, explicit layers vs. an edge-coloured multigraph. Our analytics side is already closer to this.
- **binvis.io / scurve (Cortesi):** Hilbert-curve byte maps and the class colouring. Its missing piece, knowing *where* a byte lies, is solved here by the node index.
- **GPU picking practice:** ID buffer, reduced resolution, re-render only on change, 1×1 readback (webgl2fundamentals, PlayCanvas, deck.gl RFC).
- **Twin / event sourcing:** the authoritative record is the sources plus the event log; pages are **projections** rebuilt from it, and a checkpoint (build id) keeps each projection aligned. This is what §3.1 ① enforces.

---

## 7. Dev rollout

Each work package (WP) is one commit (or a few), with its tests. **S** is under 1 h of build, **M** is 1–3 h, **L** is a session or more.

| WP | What | Depends | Size | Done when |
|---|---|---|---|---|
| **S0** ✅ 11-10 | Answer STK-Q18…Q25 (§8) | — | — | DECISIONS.md has the answers (Q20 = narrow A, revised the same day) |
| **S1** ✅ 11-10 | `lib/strings.js`: walk, reach, profile, class; `stack.js string`; MCP `stack_string`; fixture tests | — | M | Planner reaches ≥ 8 layers and classes as Program; a fixture Spark stays a Spark; the Orphan list is non-empty and checked by eye |
| **S2** ✅ 11-10 | Pillars take threads: an area in `entities.json`, and a hand `status` only on the 11 pillars with no F row (STK-Q20 narrow A); the 47 threads mapped (24 new pillars, 55 in all) | S0 | M | every thread id resolves to a pillar; `stack.js ent` lists them |
| **S3** | **T layer (Teendők)** adapter, deduplicated; "looks done" check in DRIFT; status drift cards (F tier or hand `status` vs the string's evidence, 2+ steps apart, STK-Q20) | S1, S2 | M | the Döntésnapló item is flagged with evidence |
| **S4** | **Füzértábla** `board.html` + `lib/board.js` → `out/board-data.js`; reach squares, class, pulse, "looks done"; anonymised export; START F repointed; `notes/devlog/board.js` forwards | S1–S3 | L | parity test vs. BOARD.html passes; `check-start` clean on main; Kapu rebuilt |
| **S5** | Live bus: `serve.js` fs.watch + source map + **incremental per-layer build** + SSE `/api/events`; `live.js` shared by every page; `BroadcastChannel` selection | — (parallel to S1–S4) | L | a hand edit of `lines.js` reaches an open metro page in under 2 s |
| **S6** | Write gateway `lib/edit.js` + preview/apply endpoints + diff dialog component; editors: `threads` first, then `lines`, then `decisions` (= ROADMAP 2.7) | S4, S5 | L | round-trip tests on throwaway copies; hash-conflict refusal tested; nothing commits |
| **S7** | Page contract retrofit: build stamp, `STACK_PAGE`, bus, lint test, for the six Stack pages | S5 | M | selecting Planner in one page highlights it in the other five |
| **S8** | Layer text stage: `out/layertext/<L>.bin` + `.idx`, deterministic, with a diff between builds | — (parallel) | M | the same build gives identical bytes; a one-node change differs only in that range |
| **S9** | **Viewer v1**: natural-order cells, Hilbert-in-shader particles, presets + Auto, GPU picking with the words tooltip, strings drawn, pillar spine | S1, S8 | L | 60 fps at Fine here; the phone usable at Normál; LAYERS §1 "The stack itself" row ✅ |
| **S10** | Viewer v2: zoom LOD, C byte stream, time scrubber, live diff glow, actions from the card | S5, S6, S9 | L | an edit on the board glows its bytes in the Viewer |
| **S11+** | New layers in the order of STK-Q24: Belépők, Próbák, Kérések, Jelzések… one adapter each | S1 | M each | each appears in strings and the Viewer with no page code change |

**Parallel lanes.** These three are independent until S6, S9 and S10:

- Lane A: S1 → S2 → S3 → S4 (strings → board)
- Lane B: S5 → S7 (live)
- Lane C: S8 (layer text)

They touch different files, so each lane can run as its own session in its own worktree.

**Recommended first session:** S0 + S1 + S2. The strings engine is the heart, and the board, Viewer and drift all read it. S3–S4 follow in the next session, or in the same one if time allows.

---

## 8. Questions for the Founder (STK-Q18…)

| Id | Question | Options (A = recommended) |
|---|---|---|
| STK-Q18 | Name of the selection trail | **A Füzér / Stack String** · B Szál · C Oszlop (taken by pillars) |
| STK-Q19 | Threads and pillars | **A threads become pillars (one list)** · B threads stay a separate list that references pillars |
| STK-Q20 | Is the board's six-step status kept by hand? | **A hand status optional; computed class shown next to it, a drift card when they differ** · B computed only · C hand only |
| STK-Q21 | Write-back scope for the first release | **A threads + lines + decisions answers, with diff approval** · B decisions only (2.7) · C none yet (live view only) |
| STK-Q22 | Default detail | **A Auto (Fine on desktop, Normál on phone)** · B always Normál · C always Full |
| STK-Q23 | G in the layer text: whole documents (≈ 4.6 MB) or titles + headings only? | **A whole documents ("every single word")** · B headings only, documents on demand |
| STK-Q24 | Order of new layers | **A T → N → P → K → J, then STK-Q5's** · B STK-Q5 first (Munkák) |
| STK-Q25 | `layers.html` | **A replaced by the Viewer under the same key** · B kept beside it |

---

## 9. Risks and rules to keep

- **Job codes:** layer text, board data and strings quote client codes. They stay in `out/` (git-ignored). Anything that leaves the PC (artifact, phone bundle on a pushed branch) goes through `anonymise.map.json`. The phone bundle's `publish-stack.js` must anonymise the new data files too.
- **file://:** live updates, the bus, edits and the C byte stream need `serve.js`. Every page must still render read-only from file:// and say what it is missing.
- **Concurrency:** a hand edit and a gateway edit at the same time are caught by the hash check. Two builds are prevented by `withLock`, and the incremental build takes the same lock.
- **Editing JavaScript sources:** `threads.js`, `lines.js` and `features/data.js` are JS. Their editors must work on data, not on text: either migrate the hand data to JSON with a thin JS wrapper first (recommended for threads in S2), or edit only well-delimited literal entries and re-parse to verify before writing.
- **Hub dominance:** without damping, every string would reach `tools/` and the Planner folder. The S1 tests must include a hub case.
- **Performance claims:** no public benchmark gives WebGL2 frame times at several million points, so S9 must measure on this PC and on the phone before the Auto thresholds are fixed.
- **Process rules stay:** push nothing unasked, commit by path, never `--force`, `check-start` + Kapu rebuild when START changes, CRLF for `.cmd`, ASCII console output.
