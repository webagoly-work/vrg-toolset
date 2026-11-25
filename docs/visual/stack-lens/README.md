# Rétegfény: the Stack, lit by the work that touches it

*Fork study for VIS-Q5 (2026-11-20). The Founder's answer: everything goes to the Labor shelf except the Stack
layers. The Stack view becomes the main visual and shows which paths the workflow touches by lighting node
patterns. This file checks that against the code, says what it takes, and reassesses the Látótér plan
(`docs/visual/README.md`). Nothing here is built; `sketch.html` beside this file is a made-up-data sketch of
the look. The Stack data cannot be built in the cloud container (it needs `H:\` paths), so statements about
counts come from `Stack/LAYERS.md` (v1 build, 2026-11-04). Where something is inferred from code rather than
from data, it says so.*

## 0. The short version

- **Most of the machinery already exists.** The Stack's recorder already turns every tool call of every
  session into the Stack nodes it touched: `Stack/lib/record.js:126` resolves each step through the join's own
  resolver (`Stack/lib/join.js:48`). Spreading activation with hub damping exists too (`Stack/lib/activation.js`,
  STK-P59 = B), along with a replay that glows the stack (`replay.html`) and the Konnektóm "firing" of recorded
  runs. The Stop hook already writes the touched nodes of every turn to `data/live/<sid8>.jsonl`
  (`Stack/hook.js:115`). What is missing is the picture: one stacked view where that light lands on the layers.
- **Name and job:** **Rétegfény** (*Stack Light*): *the Stack's layers, where each piece of work lights the
  nodes it touches and how far that touch reaches, live or replayed.*
- **One conflict to settle.** The Stack Viewer plan (STRINGS-PLAN S9) is a WebGL2 byte-particle view of
  millions of points. VIS-Q6 = A chose the kit `layerstack` (SVG). An SVG layer stack can carry the ~2 000 nodes
  of the Stack but never byte particles. Recommendation: build Rétegfény at **node level** on `layerstack`, and
  move the byte-particle Viewer to "later, if ever" (STL-Q3).
- **The Látótér island is cut for now.** Its useful parts move into Rétegfény: the ribbon (Munkavászon) under
  the stack, the lens ring (now the node card's actions) and the boats (now agent tracers). The island can
  come back later as a skin of the F plane. Section 5 says why.

## 1. What the workflow can touch, in Stack terms

Stack nodes (LAYERS.md §2): F features 105 · I ideas 129 · Q decisions 119 · L lines 50 + sessions 138 ·
A agentic 183 · U runs 179 + days 43 · R commits 349 · C code folders 186 · G sections + documents + signals
428 · E pillars 55. That is about 2 000 nodes, a size SVG can handle.

The join keys are the extractor's (`Stack/lib/common.js:47-120`): `p:` paths (deepest owning folder wins), 7–40
hex commits, 8-hex session ids, `XX-Q12` decision ids, `GO NAME`, `[[mem]]` / `mem:` slugs, and unique basenames.

| Munkavászon event (`SessionCanvas/vrg-munkavaszon.html` model) | Join key | Lands on | Kind |
|---|---|---|---|
| Read / Edit / Write / NotebookEdit `file_path` | `p:` path → deepest owning folder | **C** folder (a file is not a node, LAYERS.md:104); **G** document when the path is a tracked doc; **Q** when it is a DECISIONS file (`same`); **A** when it is memory, an agent, a brief, `CLAUDE.md`, a `GO-*.md` | **exact** |
| Grep / Glob `path` | `p:` | C | **exact** |
| Grep `pattern`, WebSearch `query` | text through the extractor | only if the text holds a key (a decision id, a path) | inferred, usually nothing |
| Bash `command` | path-looking words (`Stack/hook.js:77` `commandPaths`) | C, G | **exact for paths named**, nothing for what a script does inside |
| `git commit` in Bash | the commit hash | **R** node | **exact after the fact** (the recorder matches the first commit within 3 min, `record.js:118`). Live it is impossible until the R node exists: the build is by hand (STK-Q3 = A). Live shows a ghost R node until the next build |
| Agent / Task `subagent_type` | the agent's name | **A** agent node (`.claude/agents/<name>.md` has a path key) | **exact** when the name maps to the file (needs a small name → id table) |
| Agent `prompt`, TaskCreate `subject`, a prompt, Claude's text | extractor keys in the text | **Q** (decision ids), **A** (`GO …`, memory slugs), **R** (hashes), **C/G** (paths, basenames) | **exact for keys**; topic words are **inferred** (`alike`-style Dice match to F/I/L titles) and not done by `resolveText` today |
| `GO PLANNER` (codephrase) | `ref:go` | **A** `go.PLANNER` | **exact** |
| `/deep-research`, other slash commands and skills | — | nothing: skills, plugins, MCP servers and hooks are not in A yet (LAYERS.md:83) | **impossible today**; add them to A or U |
| MCP `stack_*` calls | node ids in the input | any layer | **exact** |
| WebFetch / WebSearch results | — | nothing (outside the Stack) | **impossible** (shown on the ribbon only) |
| The session itself | session id | **U** run (after recording); **L** session and its line (after `harvest.js`) | **exact after the fact**; live, the run exists only as `data/live/<sid8>.jsonl` |
| Any C or G hit | the pillar's `paths` (`entities.json`) | **E** pillar, and through it every F / I / L / Q node on that pillar | **exact** for the pillar; members are lit only when activation reaches them (below) |

**The bridge across layers is the pillar.** A touch on `Planner/projects/varler-planner/src` lands on a C folder.
That folder belongs to the `planner` pillar, and the pillar holds the Planner's features (F), ideas (I),
decisions (Q), lines (L) and agents (A). So one Edit can light a vertical path through the whole stack, which is
the "affected path" the Founder described.

## 2. How the light looks

Mélyvíz rules hold: **warm = activity, ice = you** (M1); one animation, one meaning.

| What | Drawn as | Animation | Meaning |
|---|---|---|---|
| A node a step touched directly | warm dot, full | glow rises in 150 ms, then decays | "touched now" |
| Neighbours reached by activation (2 hops, decay 0.5, hub damping STK-P59 = B) | warm dot, dimmer by energy | the same decay | "reached by that touch" |
| The pillar of a touched node | one warm vertical line through every plane the pillar has lit nodes on; not through the others | draws itself top to bottom in 240 ms, once per new pillar | "this is one thing across layers" |
| A write (Edit / Write) vs a read | a write adds one ring pulse on the node; a read never does | ring 420 ms, once | "it changed" |
| A commit | a ghost R node at the time axis, solid after the next build | rises once | "it was committed" |
| Decay | energy × 0.5 every 90 s live (half-life); replay uses the step clock | continuous fade, no pulsing | "how recent" |
| Several agents at once (a deep-research fan-out) | each agent gets a **tracer**: a thin line joining its last few touches in order, labelled with the agent's short name; the coordinator's tracer is solid, subagents' are dotted | the tracer's head moves to each new touch | "who is walking where" |
| Your selection (click, search, the bus) | ice ring, ice pillar | 240 ms lift | "you are here" |
| Cold areas (nothing touched in N days) | the node's fill drops to the plane colour | none | "quiet" (optional overlay) |

**Planes in their natural order** (LAYERS.md §1 ①, STRINGS-PLAN §6.2 at node level, not byte level):

| Plane | Layout |
|---|---|
| F | tier × lane grid |
| I, L, U, R | x = time, y = lane / line / branch |
| Q | namespace columns |
| A | kind bands |
| C, G | squarified treemap (containment) |
| E | one column per pillar, as the spine |

Then a fan-out reads at a glance: four tracers leave the A plane (the agents) and go down to the C and G planes,
each lighting its own patch, and they meet at the report writer's Write in G.

**The page:**
- The stack on top.
- The Munkavászon ribbon docked under it on the same clock: scrubbing either moves both.
- The node card on the right, where the Látótér's lens ring becomes the card's actions: open the layer page,
  open the session in the Munkavászon, open the folder in Kódváros, copy the string.

## 3. Other things the same lighting can show, ranked

| Rank | What lights | Data | Value |
|---|---|---|---|
| 1 | **Forecast.** What a prompt, a `GO` codephrase or a prompt template (`tools/prompts/*.txt`) *will* touch, before you start it: `resolveText` on the text plus activation, drawn as an ice outline | exists (`join.js:48`, `activation.js`) | Very high: shows scope and collisions before spending a session; also "is someone already working there" |
| 2 | **Live and replayed work**: the core of this study | recordings exist; live through the spine (§4) | Very high |
| 3 | **A decision's blast radius**: the string of a `Q` node (`stack.js string`, `lib/strings.js`) | exists | High: what an answer to VIS-Q/STK-Q changes |
| 4 | **Cold areas**: nodes with no touch in 14 / 30 days (U `touched` edges over time) | exists after recording | High for cleanup: pairs with the drift report |
| 5 | **A commit's reach**: R → its C / G downward links | exists | Medium |
| 6 | **Divergence signals** as beacons on the nodes they name (`layerstack` already has warm beacons) | `Divergence/signals.json` names targets | Medium |
| 7 | **Two sessions colliding**: two tracers lighting the same C folder within a window | live spine | Medium: worth a toast, cheap once live works |
| 8 | **Token cost per node** (tokens of the steps that touched it) | recordings carry `tok` | Low to medium |
| 9 | **Test coverage** | no test → folder map exists | Low: needs new data |

## 4. Data path

| Mode | Source | Granularity | Latency | Cost |
|---|---|---|---|---|
| **Replay** | `out/recordings/<sid8>.jsonl` (steps with `nodes`) and `out/replay/<sid8>.js` (`lib/replay.js`: steps + touched subgraph + adjacency) | per tool call, subagents included | none | none |
| **Live, call level** (recommended) | the event spine (VIS-Q4 = `shared/vrg-events`, the Munkavászon model) fed by `SessionCanvas/serve.js` SSE (:8810), resolved **in the page** through a path → node index | per tool call, subagents included | ≈ 1 s (0.6 s poll + resolve) | none, no tokens |
| Live, turn level (fallback) | `data/live/<sid8>.jsonl` from the Stop hook (`Stack/hook.js:115`) | per turn, main agent only, ≤ 120 nodes | end of each turn | none |
| Cloud sessions | the claude-code-remote session API (only from inside a Claude session) | per event | minutes | tokens per poll; defer |

**What the Stack build has to add:**
1. **`out/lens-index.js`**: the resolver as data, so a browser can resolve without the Node extractor:
   - own path keys and folder prefixes → node id;
   - unique basenames → path;
   - decision ids, `GO` names, memory slugs, agent names → node id;
   - pillar paths → pillar id.

   Estimated well under 200 KB (inferred from the node counts). Alternatively make `lib/common.js`
   `makeExtractor` load in the browser, like `activation.js` already does, and ship its `known` sets.
2. **The compact adjacency** for activation over the whole stack (today `replay.js` exports only each session's
   subgraph). `out/connectome-data.js` already carries the nodes and links the Konnektóm draws (inferred), so
   reuse it rather than add a file.
3. **Skills, plugins, MCP servers and hooks as A (or U) nodes**, so `/deep-research` and friends land somewhere
   (LAYERS.md:83 lists them as missing).
4. **Agent name → A node**, so `subagent_type: "arnold"` lands on `A:agent.arnold`.
5. Later: **incremental build** (STRINGS-PLAN S5) so new commits and new files become nodes without a manual
   rebuild. Until then: ghost nodes for anything the index does not know, resolved to the nearest known folder.

**The kit has to add:**
- **`layerstack.light(map id → energy)` and `tracer(agent, ids)`.** These update classes and attributes on
  existing nodes only. Today `draw()` empties and rebuilds every group (`shared/vrg-ui-kit/components/layerstack.js:75-76`),
  which is fine for a gallery but not for 2 000 nodes at 4–10 updates a second.
- Natural-order positions are the caller's job (`at: {plane: {x, y}}` already takes them).

## 5. Reassessment of the Látótér plan

| Látótér plan item | After this study |
|---|---|
| Isometric island (V4) | **Cut for now.** Rétegfény answers the same question ("what is the work touching, where") on real structure rather than on a hand-drawn map, and it reuses work that exists. The island's diorama look can come back as a *skin* of the F plane (features drawn as small dioramas on the top plane), only if the plain view feels too abstract after use. |
| Ribbon (Munkavászon under the board) | **Keep**, docked under Rétegfény, on the same clock |
| Lens ring, three zoom levels | **Keep the logic, change the object**: the levels become stack → plane (solo) → node card / layer page; the ring becomes the card's actions |
| Boats, cranes, banners | Boats → **tracers**; cranes (background jobs) → a warm beacon on the node the job works in; banners (commands) → the ribbon's command lane only |
| Event spine (V2, VIS-Q4) | **Unchanged and now first**: Rétegfény live needs it |
| Lens registry (V1) | Unchanged; Rétegfény is the first lens registered |
| Stack Viewer S9 (byte particles, WebGL2) | **Deferred** (STL-Q3). Rétegfény at node level replaces Rétegek under START R → 7 (STK-Q25 = A still holds, with a different Viewer) |
| Konnektóm, Holo, Konnektóm-labor | **Labor**, per VIS-Q5. Their firing schedule (`connectome.html:360`) and tracer idea move into Rétegfény. STRINGS-PLAN §6.5 ("stay as other shadows") is overruled. |
| Rétegek (`layers.html`) | Its touch gestures and `#full #crisp` flags carry over (STK-Q25 = A); its WebGL force layout goes |

**Candidly:** the Látótér island was the more striking picture, but it was a picture of a made-up map. Rétegfény
is less pretty at first and much more true. It shows real nodes, real links and real reach, and the Stack
already computes most of it. The plan should spend its next sessions here.

**Scope of "everything to Labor".** The answer can be read two ways, so it is a decision (STL-Q2). Read
narrowly, it covers the brain and orb family plus the island. Read widely, it covers every visual tool. The
apps people use for work (Térkép, Időjárás, Planner views) are not visual toys, and the layer pages (Kódváros
= C, Solomon Gömb = G, Vonaltérkép = L …) are the Stack's own per-layer views (LAYERS.md §1). The narrow
reading keeps them.

## 6. Plan, decisions, risks

| Step | What | Size (sessions) | Done when |
|---|---|---|---|
| **SL0** | `lens-index.js` build stage; skills / agents into A; kit `layerstack.light()` + `tracer()`; a 2 000-node SVG frame-time test on the PC and the phone | 1–2 | a step's nodes resolve in the page exactly as `record.js` resolves them (a test compares the two on recorded sessions) |
| **SL1** | Rétegfény replay: natural-order planes, pillars, activation and decay from `out/replay`, node card, ribbon docked | 2 | yesterday's sessions replay with the right nodes lit; START R → 7 opens it |
| **SL2** | Live: the spine from `SessionCanvas/serve.js`, page-side resolution, ghost nodes, tracers for subagents and fan-outs | 1–2 | a session's Edit lights its folder and pillar within 2 s |
| **SL3** | Forecast (prompt / GO / template → predicted reach), a decision's blast radius, cold areas | 1–2 | a GO phrase shows its reach before the session starts |
| **SL4** | Phone: a published bundle like M17's `retegek.html`, read-only (VIS-Q9 = A) | 1 | same replay on the phone |
| later | F-plane diorama skin; Divergence beacons; collision toasts; cloud sessions; byte-particle deep zoom | — | — |

**Decisions for the Founder:**

| Id | Question | Options (recommendation first) |
|---|---|---|
| **STL-Q1** | The name | **A Rétegfény** · B Érintésnyom · C keep "Stack Viewer" |
| **STL-Q2** | What "everything to the Labor shelf" covers | **A the brain / orb family (Konnektóm, Holo, Konnektóm-labor) and the Látótér island; the layer pages and the work apps stay** · B every visual tool except the Stack layers |
| **STL-Q3** | The byte-particle Stack Viewer (STRINGS-PLAN S9/S10, WebGL2) | **A deferred; Rétegfény at node level on the kit layerstack replaces Rétegek** · B build both · C drop S9 for good |
| **STL-Q4** | The live source | **A the event spine from `SessionCanvas/serve.js` (call level, subagents)** · B extend the Stack Stop hook (turn level) · C both, the hook as fallback |
| **STL-Q5** | Light inferred links (topic-word matches to F / I / L) | **A no: exact keys and pillars only; inferred matches only on demand in the card** · B yes, dimmer |
| **STL-Q6** | Where it lives | **A START R → 7 (the Rétegek key) + a Lap page on the Asztal + the Desktop Dev ground, in place of the island** · B its own START key, Rétegek kept |
| **STL-Q7** | The first use beyond live work | **A Forecast (what a prompt / GO will touch)** · B a decision's blast radius · C cold areas |

**Risks:**
- **SVG at 2 000 nodes with live updates.** It works only with the class-toggle API in §4. SL0 measures frame time
  before anything else; the fallback is a canvas layer for the dots under the SVG chrome.
- **Hub flooding.** A touch on a big folder (`docs/`) lights half the stack. STK-P59 = B damping, plus "seeds and
  pillars are never damped", is the existing answer; SL1 checks it on real replays.
- **Coarse C granularity.** C nodes are folders, not files (LAYERS.md:104), so an Edit lights a folder. That is
  right for overview; file level is Kódváros's job, opened from the card.
- **Stale index.** Rebuild is by hand (STK-Q3 = A). New files and commits fall back to their nearest known
  folder or a ghost node until the next build, and the page says how old the index is.
- **Two plans disagree on paper.** STRINGS-PLAN S9 (WebGL particles) and VIS-Q6 (SVG layerstack) need STL-Q3
  answered before SL1, or the next session builds the wrong Viewer.
- **Privacy.** G holds job documents with client names. The page needs the same redaction switch as the
  Munkavászon (Kitakarás) before any screenshot leaves the PC.

## Answers (2026-11-20)

| Id | Answer |
|---|---|
| **STL-Q1** Name | **B · Érintésnyom** (the lit-paths view; "Rétegfény" above is the study's working name for it) |
| **STL-Q2** What goes to Labor | Answered with a direction: the ◢ Stack button opens a menu of the layers top to bottom (Rétegek last), each layer opening its own view. That layer menu is the **base outline of the whole Stack**; the session-workflow visualizer (Érintésnyom, fed by the Munkavászon's spine) sits **on top of it**. Built the same day on the Asztal and VRG Mobile (D-48). |
| **STL-Q3** The byte-particle Viewer (S9/S10) | **B · build both**: Érintésnyom at node level on the kit `layerstack` (SVG) and the WebGL2 byte-particle Viewer |
| **STL-Q4** Live source | **A · the event spine** (`SessionCanvas/serve.js`, call level, subagents) |
| **STL-Q5** Inferred links | **B, with a condition:** inferred matches light too, dimmer and **in another colour**, and stored **separately in the data**, so the exact (real) lines can always be extracted on their own |
| **STL-Q6** Where it lives | Settled by the STL-Q2 answer: on top of the ◢ layer menu and the Rétegek view |
| **STL-Q7** First use beyond live work | **A · Forecast** as the primary, with **B · a decision's blast radius** wanted as well |

## Built (2026-11-20)

- **SL0:** `Stack/lib/lens.js` (resolver, inference, layout; `test/lens.test.js` checks it against `lib/join.js`), the build
  stage `out/lens-index.js` (`lib/pipeline.js`), kit `layerstack` `light()` / `tracer()` / attribute-only hover / plane options,
  and the event spine `shared/vrg-events/events.js` (VIS-Q4; the Munkavászon keeps a synced copy, `tools/events-sync.js`).
- **SL1 + SL2:** `Stack/erintesnyom.html` with live (Munkavászon server, :8810, which now lets the Stack's origin read
  `/api/sessions` and `/api/stream`), replay (`out/replay`) and a dropped transcript; exact (warm) and inferred (violet)
  kept apart; tracers per agent; node card with the layer page link; ribbon with scrubbing. START R → S, catalog
  `stack.touch` (the first entry with a `lens` block, VIS-Q3), the Asztal's ◢ column above Rétegek.
- Checked here on a test stack built from this repo's real folders, documents, agents, decision files, commits and the
  55 real pillars, with this session's own transcript live and from file. Not checked here: the real Stack build
  (it needs H:), and START's new `open` field on a server item (`vrg-ui.ps1`, no PowerShell in the cloud).
- **Next:** SL3 Forecast (STL-Q7) and a decision's blast radius; SL4 the phone bundle; skills and plugins as A nodes so
  `/deep-research` and friends land somewhere.

## Built (2026-11-25): SL3 Forecast and blast radius

- `lens.forecast(text, history)`: the keys the text names and their exact reach (certain), the nodes recorded sessions with a
  similar opening prompt touched most (six-letter stems, generic work words dropped, overlap more than Dice because a new
  prompt is long and a recorded title is 90 characters), and title words (weakest). Every node keeps its reasons.
  `lens.reach(id)`: a node's blast radius, 3 hops over the exact links.
- Build stage `out/forecast-index.js`: each recorded session's opening prompt and its 30 most touched nodes, plus the prompt
  templates of `tools/prompts`.
- Page: the Előrejelzés panel (text, GO phrase, template), ice dashed rings (the kit's new `forecast` light kind: the
  instrument's guess, Mélyvíz M1), a list with reasons, the similar sessions it drew on, and a live count of how many of
  the 20 likeliest came true and how many touches were unexpected. "A munkamenet első kérése" forecasts a recorded session
  from its own first prompt and replays it, which is how to judge the forecast. Hatókör on every node's card.
- Checked here on the test stack with this session as history (split at each prompt): the forecasts and the reach light as
  designed; how good the forecast is can only be judged on the real history after a build on the PC.
- **Next:** SL4 the phone bundle; skills and plugins as A nodes; GO phrases reach through their files only after a build
  (the test stack has no links from GO files).

## Built (2026-11-25): skills, plugins and slash commands in the A layer

- `lib/layers.js` agentic: every `SKILL.md` and custom command under the Claude home and the repo's `.claude`, and every
  plugin's skills and commands (the plugin's name from its `.claude-plugin/plugin.json`), as A nodes of kind `skill`,
  `plugin skill`, `command`, `plugin`. A skill owns `sk:<name>` and `sk:<plugin>:<name>`; it is part of its plugin.
- The extractor (`lib/common.js`) and the lens read `sk:` keys; the recorder (VERSION 5, every recording is redone once)
  records a typed slash command as a step `sk:<name>` and a `Skill` call with its skill's key, so a `/deep-research`
  turn now lands on its skill node, live and replayed.

## Built (2026-11-25): SL4 Érintésnyom on the phone

- `Mobile/stack/publish-stack.js` bundles `erintesnyom.html` into `stack-pages` as one self-contained file: the stack, the
  lens and forecast indexes, the kit and the event spine inlined, and the 12 newest recorded sessions (at most 4 MB) as
  `window.REPLAY_BUNDLE`. Replay only (VIS-Q9 = read-only first): no live mode on the phone; a transcript can still be
  opened from a file. Layer links point at the phone's own layer pages.
- The page has a phone layout under 700 px (the stack full width, the plane list hidden, the panels below).
- VRG Mobile: `erintesnyom` is an optional page of the Rétegverem feature, and the ◢ menu has an Érintésnyom row above
  Rétegek (D-48's order on the Asztal too).
- Checked here: the bundle built from the test stack is 0.75 MB, opens on a Pixel 7 viewport with every network request
  blocked, lists its sessions, replays and lights nodes, and fits the screen. It reaches the phone after one
  `node Mobile/stack/publish-stack.js --push` on the PC, after a build.

## Built (2026-11-25): Rétegverem, the byte-particle Stack Viewer (STL-Q3 = both)

- `Stack/viewer.html` (START R → 7, ◢ Rétegek on the Asztal and the phone) is S8 + S9 of `Stack/research/STRINGS-PLAN.md`:
  the build writes every layer's text (`lib/layertext.js` → `out/layertext/<L>.bin`, `.idx`, `.js`, deterministic, diffed
  against the last build), and the page draws each layer as an isometric plane of byte particles, nodes as cells in the
  layer's natural order (`lib/viewer-layout.js`), Hilbert tiles inside, picking on the GPU, the words under the pointer.
- The session layer on top: Érintésnyom posts its light on the BroadcastChannel `vrg-stack`; the Viewer colours the same
  nodes with the same meanings (warm exact, violet inferred, ice dashed forecast) and dims the rest. A forecast typed in
  Érintésnyom therefore lights the bytes of the decision, the line, the GO phrase, the folders, the documents and the
  pillars it reaches. The builder's choices are STK-P67…P74 in `Stack/DECISIONS.md`.
- Checked here on a test stack built from this repo (984 nodes, 4 MB of layer text): 1.05 M particles at Finom, picking
  back to the right node and the right words, the fly-in at one byte a dot, the file:// page and the 0.7 MB phone bundle
  (no text in it) at 412 px, the light arriving from Érintésnyom. Frame rates measured here are software GL and say
  nothing: the 60 fps at Finom target is to be measured on the PC (`VIEWER.perf()`).
- **S10, the same day:** the time scrubber (⏱ Idő: the layers day by day, nodes born on their work date, changes
  pulsing), the code stream of a C folder (▦ Kód bájtjai: its tracked files, every byte a dot, the file name under the
  pointer), the live glow after any finished build (● élő over `serve.js` `/api/events`), and the card's actions without
  the write gateway (the layer's page with the node selected, the string, a prompt). STK-P75…P79. Checked against the
  real `serve.js` on this repo: `Stack/lib` streamed 37 files / 309 KB and the pointer read `lens.js`; a rebuilt layer
  text pulsed exactly the nodes whose bytes changed; the phone bundle (0.75 MB) scrubs time and stays text-free.

