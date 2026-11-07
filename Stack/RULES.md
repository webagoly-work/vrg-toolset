# Rules of the Subject: multilayer networks for the VRG Stack

*A quick-start for the Founder. It covers what a stacked network is, what it is good for, how to build one so it stays true, and what we still lack. The working database lives next to this file (`README.md` explains how to use it).*

---

## 0. In one paragraph

You already have several maps of the same work: Features, the idea timeline, DevLog, DevRep, Kódváros and the Gömb. Each is a **layer**: a network with its own kind of nodes and its own natural order. **Stacking** them means keeping every layer as it is and adding **vertical links** between layers wherever two nodes talk about the same thing. The Planner feature links to the Planner line, the line to the commits it made, the commits to the folders they touched, and the folders to the documents that describe them. The result is a **multilayer network**. Its value is in the vertical links: you can follow one question down through every layer and get a single answer.

---

## 1. Vocabulary (the words you will meet in papers and tools)

| Term | Meaning | In the VRG Stack |
|---|---|---|
| **Node / edge** | a thing / a relation between two things | a feature, a session, a commit… / `fork`, `feeds`, `parent`… |
| **Layer** | one network with its own node types and rules | F Featured, I Ideas, Q Decisions, L DevLog, A Agentic, R DevRepo, C Code, G Data Globe, Z Codec |
| **Intra-layer (horizontal) edge** | a link inside one layer | a line forks from a line; a commit's parent |
| **Inter-layer (vertical) edge** | a link between layers | a session mentions commit `5ee8b1e` → L ↕ R |
| **Multiplex network** | the *same* nodes on every layer, with different kinds of edges | not ours: our layers hold *different* things |
| **Heterogeneous multilayer network** | each layer has its own node types; layers are coupled by vertical edges | **ours** |
| **Interdependent networks** | layers where a failure in one breaks the other (power grid ↔ internet) | a decision left open blocks a line, which blocks a feature |
| **Replica / identity link** | the same real entity appearing on two layers | `same` edges: a DECISIONS.md is both a Q file and a G document |
| **Entity resolution** | deciding that two records are the same real thing | the **pillars** in `entities.js` and the inferred `alike` links |
| **Pillar** (our word) | the vertical dashed line through the stack for one entity | `E:planner`: 278 nodes on 8 layers |
| **Key / anchor** | a shared identifier that proves two nodes meet | a path, a commit hash, a session id, a memory slug, `HUB-Q3`, `GO HUB` |
| **Provenance** | where a fact or link came from | every vertical link says which key made it (`ref:c`, `ref:p` …) |
| **Supra-graph / supra-adjacency** | all layers flattened into one big graph, with layer tags | `out/stack.json` |
| **Projection / aggregation** | collapsing a layer into fewer nodes | commits → per-day pixels; files → folders (Code layer) |
| **Centrality / versatility** | how important a node is; versatility counts importance *across* layers | keystones: what to protect, what to read first |
| **Community detection** | finding clusters that belong together | could suggest new pillars automatically (STK-Q6) |
| **Temporal network** | edges and nodes with time | sessions, commits and ideas carry dates, so the stack can be replayed |
| **Knowledge graph** | typed nodes and edges plus a schema | the stack is a small, local knowledge graph |
| **BM25 / full-text search** | ranking by word overlap (exact, cheap, offline) | `stack.js q`, `vrg-ctx.js` |
| **Embedding / vector search** | ranking by meaning ("sleeve" finds "conduit") | not built yet (roadmap v2) |
| **GraphRAG** | retrieval that finds a node by search, then follows edges for context | `stack.js q` already does this: each hit lists its vertical neighbours |
| **Drift** | sources that disagree or go quiet while depending on each other | `out/DRIFT.md`, plus Solomon's signals |

---

## 2. What you can achieve with it

1. **One question across every layer.** "What is going on with Planner Views?" returns the feature (in development), the line (parked), its decisions (D-V…), the commits that built it, and the primer document, in about 700 tokens. Try `stack.js q "planner views"`.
2. **Unfinished work becomes visible.** Each layer can only see its own gaps. Cross-layer checks catch the rest: a feature marked "in development" with no commit or session for weeks, a line waiting on a decision, a built folder that the Dashboard never shows. Every rebuild writes them to `out/DRIFT.md`.
3. **Cheap context for agents.** A new session reads L0 (600 tokens) and asks `stack.js`, so it does not open twenty files to find where something lives. This is the main token saving: it reads fewer files, rather than squeezing more text into each token.
4. **Impact before change.** Before you edit a standard, `stack.js node G:<doc>` shows which lines, features and memory notes lean on it. Solomon's `lemaradt` signal does this for documents; the stack does it for everything.
5. **Keystones.** The nodes with the most vertical links hold the structure up. In v1 the top ones are the folder `Planner/projects/varler-planner` (357 vertical links), `tools/` (245), the anonymiser commit `6b7eb03` (159) and the Kódváros README (122). A break or rename there ripples furthest.
6. **Replay and activation (later).** Every node has a date, so the stack can be animated through time. When agent sessions log which nodes they touch, the same picture becomes the "neural" view you asked about: nodes light up during work, much-used paths thicken, and unused ones fade.
7. **Self-improving routes (later).** Paths that agents walk often (question → line → brief → file) can become shortcuts, such as a new pillar, a brief or a codec line. This is the "self-developing" part, and it needs the event log first (§6).

---

## 3. How to build it correctly: the twelve rules

| # | Rule | Why | How the v1 obeys it |
|---|---|---|---|
| R1 | **One source of truth per fact.** Layers are generated views, never hand copies | copies are where drift is born | every layer is read live from its own source by `build.js` |
| R2 | **Stable ids, prefixed by layer** | links and bookmarks must survive a rebuild | `L:views`, `R:5ee8b1e`, `G:docs/solomon/README.md` |
| R3 | **Every vertical link has evidence or says it is inferred** | an untraceable link is a rumour | `ref:<key>` = quoted; `alike` = name match; `pillar` = hand list |
| R4 | **Each layer keeps its natural order** | forcing time onto a hierarchy (or the reverse) destroys meaning | time for I/L/R; hierarchy for F; containment for C; sections for G |
| R5 | **Small, typed edge vocabulary per layer** | free-text relations cannot be queried | `fork · next · feeds · absorbed-by · parent · contains · holds · flags` |
| R6 | **Rebuild is cheap, idempotent and frequent** | a stale database is worse than none | ~2 s, same output for the same inputs |
| R7 | **Privacy tiers** | client names must never reach tracked files | the stack lives in `notes/` outside the repo, like DevLog |
| R8 | **Progressive disclosure for agents** | context is the scarce resource | L0 → L1 → L2 → node card → source lines |
| R9 | **Show what is inferred** | a guessed answer must look different from a quoted one | `≈` on loose parses, `open≈`, `alike` |
| R10 | **The stack never writes into a source** | the Solomon rule: nothing changes without the Founder | read-only; write-back only through the source's own tool, with approval |
| R11 | **Measure it** | coverage tells you where the joins are weak | `STATUS.md`: nodes with a vertical link per layer, failed joins, token cost |
| R12 | **Time is an axis everywhere** | replay, quiet detection and activation all need it | dates on sessions, commits, ideas, memory, documents |

---

## 4. "Huffman for agents": what actually saves tokens

**Huffman coding makes bytes smaller, but a model reads tokens.** A Huffman bitstream, or its base64 form, costs *more* tokens than plain text, and a model cannot read it without decoding it first. For storage it is fine. For an agent's context it is the wrong tool. What does carry over is the principle: **give the most frequent, longest things the shortest names.** The Codec layer (Z) applies that principle at four levels:

1. **Codebook (the Huffman idea, on tokens).** Folder prefixes that repeat get a symbol `§n`, with the smallest numbers going to the most frequent ones. A prefix only gets a code if the code saves more than its own codebook line costs. In v1 there are 29 codes and they save about 11 % of the L2 packs (≈ 4 200 of 37 500 tokens). That gain is modest, because the packs were already terse.
2. **Short ids instead of long names.** `R:5ee8b1e` stands in for a whole commit, and the agent asks for the card only when it needs it.
3. **Folding levels.** These save the most:
   - L0 is one screen (≈ 600 tokens).
   - L1 holds the pillars (≈ 5 800 tokens).
   - L2 has one line per node, one file per layer.
   - L3 is a node card.
   - L4 is the source lines.

   L0 and L1 together are **≈ 1.6 % of the whole graph** and are enough to orient an agent.
4. **Retrieval instead of reading.** `stack.js q` returns about 700 tokens where opening the files would take tens of thousands.

If you still want a true Huffman file later (for example a compact archive of all transcripts), it belongs to storage and backup, not to agent context (STK-Q7).

---

## 5. Search: two engines and two users

| | Exact (BM25 / FTS5) | Semantic (embeddings) |
|---|---|---|
| finds | the words you typed, accent-free, prefixes ("vezetek" → vezetékcsatorna) | the meaning ("sleeve" → védőcső) |
| cost | free, offline, milliseconds | needs a model (local or API), an index rebuild |
| VRG today | `stack.js q` (nodes), `vrg-ctx.js q` (source lines) | none yet; roadmap v2 |

- **The AI user** runs `stack.js q "<words>" --budget 900`, gets ranked hits, each with its vertical neighbours, then calls `stack.js node <id>`, and opens a source file only at the end.
- **The human user** opens `stack-search.html` (the Rétegverem page). Results come in layer rows from top to bottom. A click opens the node card, and **Kontextus másolása Claude-nak** copies a short context pack to paste into a prompt. This is the first small version of "send Claude a selected node cluster".

---

## 6. What is missing

### 6a. Layers we do not have yet

| Proposed layer | Holds | Why it matters | Its page |
|---|---|---|---|
| **Munkák** (Jobs) | client jobs, quotes (VG numbers), deliveries, payments | the money path is a real layer; the Dashboard's D4 table already reads it | Projektmunkák table → a job timeline |
| **Futás** (Runtime + usage) | servers, ports, scheduled runs, sessions per day, token use, which nodes an agent touched | **needed for the neural view** (activation and path frequency) | Control Room live view |
| **Eszközök** (Devices) | boards, COM ports, firmware builds, flash history | ties firmware code to physical boards | Board Console |
| **Látvány** (Look + assets) | design systems, illustrations, logos, visual base | the look is shared across apps and drifts too | VRG Visual Base gallery |
| **Külső** (Outside) | vendored repos, third-party programs, MCP servers, plugins, licences | what we depend on and under which licence | Vendor shelf (vrg-vendor.html) |
| **Szereplők** (People + roles) | the Founder, the colleague, accounts (primary / SecAcc), agent personas | who may do what; account mix-ups already cost a day | Kapu sign-in |
| **Események** (Events) | an append-only log of everything that happened, across all layers | turns the stack from a snapshot into a film: replay, activation, "what changed since" | the time scrubber on the stacked view |

### 6b. Machinery we do not have yet

- **Event log.** Every rebuild should write the differences (new node, changed state, new link) to an append-only `events.jsonl`. This underlies time travel, the "since yesterday" view, activation and pattern finding.
- **An MCP server for the stack.** With `stack_q`, `stack_node` and `stack_path` as tools, any Claude session (Desktop, CLI, a cloud session) can ask without being told how (STK-Q2).
- **Session hooks.** Start: give the session L0. End: log the nodes it touched (into Futás and Események).
- **Embeddings** for semantic search, as a second index next to FTS5.
- **Write-back with approval**, so that answering a decision in the Döntésnapló writes the dated answer into its DECISIONS.md, through the same Founder rule as Solomon.
- **An import graph inside the Code layer** (which file requires which), so impact analysis reaches below folders.
- **Snapshots** of `stack.json` per day (cheap), for the replay.
- **Tests:** a fixture stack with known joins, so a parser change cannot silently drop links.

---

## 7. Things in your own code that fit this approach

- **MindMap layers and the ACT registry.** The stack's link types map one to one onto MindMap connection layers, so any slice of the stack can be exported as a `.mindmap.json` for the existing viewer.
- **The MindMap RNA / helix mode** is already a vertical, stacked reading of a graph. A helix of layers is a natural "neural" view for later.
- **Planner layers.** Planner's model is the same: one plan, many layers that can be hidden, with links between them. Its interaction rules (one action registry, Ctrl multi-select) should drive the stacked view.
- **Solomon's three signals** (contradiction, dark zone, frozen) are drift detectors for the G layer. The stack generalises them to every layer, and the Divergence ring can be where drift notices land.
- **Council personas** are agents that read a layer. Elsie (QA) owns DRIFT, Arnold (design) owns F, Charlotte (finance) owns Munkák.
- **Kódváros** is the C layer's page, and its live agent trace is the seed of the Futás layer.
- **DNA capsule L0–L4** uses the same folding idea as the Codec. The two should merge rather than compete.
