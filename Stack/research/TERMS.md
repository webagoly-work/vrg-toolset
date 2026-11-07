# VRG Stack: research terms

*Researched 2026-11-06 for the next versions of the stack (see `../ROADMAP.md`). The Founder chose the terms (2026-11-06):*

> 1 B (and above all: **record every work session and play it back visually, step by step**) · 2 A B C · 3 A (explain) · 4 pros and cons · 5 A and B, or the more useful one · 6 explain · 7 explain (ELI10) · 8 B, fallback A · 9 not sure

*Each term below has a plain explanation, where it fits in the stack, sources (one line each), and tools with their licence. Licence rule: no AGPL. GPL tools are fine to **run** as separate programs, but not to bundle into our pages. "verify" means the licence came from a package index and the LICENSE file should be checked before use.*

---

## ★ 0. The main wish: record every session, play it back step by step

You want to watch how a session gathers context, reads files, edits or creates them, and commits, slowed down so you can follow it.

### What already exists (checked on this PC, 2026-11-06)

| Recording source | What it holds | Where |
|---|---|---|
| **Claude Code transcripts** | every prompt, every tool call (Read, Edit, Write, Bash, …) with its input and timestamp, every result | `C:\Users\webag\.claude\projects\<project>\<session>.jsonl` (95 in `H--` today) |
| **File history** | the before/after copies of files Claude edited (Claude Code's own checkpoints) | `C:\Users\webag\.claude\file-history\<session>\` (114 sessions) |
| **Git reflog + log** | every commit, branch move and checkout, with times | the repo (DevRep already reads it) |
| **Console trace hooks** | observe-only hook events from sessions inside the repo | `Planner_VRG_U100/Console/traces/*.jsonl` (11 files; only repo sessions) |
| **Claude Code telemetry** (not on) | OpenTelemetry events: tool calls, permission decisions, tokens and cost | switched on with `CLAUDE_CODE_ENABLE_TELEMETRY=1` plus an exporter |

**So most of the recording exists already.** A replay can be rebuilt *after* a session from the transcript, the file history and git, with no new recorder. An example from one transcript (2026-11-05): 116 tool calls (87 Bash, 5 Write, 4 Edit, 4 Read …), each with a timestamp.

### ⚠ The risk: transcripts are deleted after 30 days

Claude Code removes transcripts older than `cleanupPeriodDays`, which defaults to 30. Your `settings.json` does not set it. **The oldest transcript left in `H--` is from 2026-10-14**, which means the September sessions have already gone from there (DevLog's `sessions.json` keeps a harvested copy). Raising the value to something like 3650 stops the deletion. Do **not** use 0: a reported bug makes it stop writing transcripts altogether. See STK-Q8.

### How a replay would work (dev notes, not built)

1. **Recorder (after the fact):** a script reads one transcript, its file-history folder and the git reflog for the same hours. It writes `recordings/<session>.jsonl` as one event per step, `{t, kind, tool, path, lines, stackNode, tokens}`. The event kinds follow the OpenTelemetry names, so a future live feed fits the same shape:
   - `invoke_agent`: the session, or a subagent
   - `chat`: the model thinking or answering
   - `execute_tool`: Read / Edit / Write / Bash / Grep …
   - `commit`: from git
2. **Join to the stack:** each step's path, commit or decision id goes through the same key extractor as `build.js`, so a step lights up a stack node, for example `Read notes/devlog/DEVLOG.md` lights `A:gen.devlog` and its pillar.
3. **Replayer page ("Visszajátszás"):**
   - a time scrubber with speed control (1×, 10×, step by step) and pauses where the agent was thinking;
   - a file tree that grows like Gource, where files appear, flash on read, change colour on edit, and a commit closes a group;
   - next to it, the stack, where nodes glow as they are touched and fade after.

   This is the **neural view (3.3)** fed by real recordings.
4. **Live later:** the same events can come from hooks (PostToolUse) or from Claude Code's OpenTelemetry feed while a session runs, so the Dashboard can show it live.

**Sources**
- [Claude Code + OpenTelemetry (Better Stack guide)](https://betterstack.com/docs/logs/claude-code/): which env variables turn on events, and that prompt and tool content stay off by default.
- [OpenTelemetry GenAI agent spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans): `invoke_agent` / `chat` / `execute_tool` naming (status: Development).
- [Claude Code hooks reference](https://docs.claude.com/en/docs/claude-code/hooks): hook events and their stdin JSON (session_id, transcript_path, tool_input …).
- [Claude Code deletes history after 30 days (ITdaily)](https://itdaily.com/news/cloud/claude-code-deletes-conversation-history-after-30-days-by-default/) and [cleanupPeriodDays: 0 disables writing (issue report)](https://claudeissues.com/issue/23710-cleanupperioddays-0-silently-disables-all-transcript-persistence-docs-say-it-dis).

**Tools**
- **Gource**, GPL-3.0: draws git history as a growing tree, as a video. Use it as an *outside program* for git-only replays. It needs OpenGL. Its look is the model for our own file tree.
- **Langfuse**, MIT core (an `ee/` folder is commercial): a self-hosted trace viewer. It is heavy (about six services), so take it as a reference for the trace layout, not an install.

---

## 1. Neural-style views of a knowledge graph: B, graph neural networks (message passing)

**ELI10.** Every node holds a small note. In each round, every node reads its neighbours' notes, mixes them with its own and writes a new one. After a few rounds a node "knows" about things two or three steps away. A **graph neural network (GNN)** learns *how* to mix the notes. For you, the useful part is the *picture*: signals travelling along links, round by round, which is exactly how the neural view should animate.

**Where it fits:** 3.3 neural view, as the *animation model* (pulses moving one hop per tick). We don't need to train a GNN. A real GNN could come much later, to predict missing links.

**Sources**
- [A Gentle Introduction to Graph Neural Networks (Distill, 2021)](https://distill.pub/2021/gnn-intro/): the classic illustrated explainer.
- [Reading notes on it (D. Rigby)](https://domrigby.github.io/architectures/IntroToGraphNNs.html): gather, aggregate, update, in short.

**Tools for drawing the stack in 3D or at scale**
- **3d-force-graph** (vasturiano), MIT: three.js force graph, easy to drop into a page; good for the stacked view, with one z-plane per layer.
- **cosmos.gl**, MIT: GPU layout and drawing, built for tens of thousands of nodes.
- **sigma.js + graphology**, MIT: fast 2D WebGL; graphology also brings the algorithms (see §5).

---

## 2. Node activation and state during agent work: A B C

### 2A. Spreading activation
**ELI10.** Think "coffee" and "cup", "morning" and "café" light up a little in your head. That is spreading activation: energy starts at one node, flows to its neighbours, gets weaker with each step, and the most-lit nodes are what you recall. **SYNAPSE** (ACL 2026) uses it as agent memory. It also *dims* the over-connected hubs ("lateral inhibition") so they don't light up for everything.
**Fits:**
- **3.3**: how a glow spreads from a touched node.
- **`stack.js q`**: rank neighbours by activation instead of plain degree.
- **The keystone problem**: our busiest folder nodes (e.g. `C:Planner/projects/varler-planner`, 357 links) would drown every answer, and inhibition handles exactly that.

**Source:** [SYNAPSE: agent memory via spreading activation (arXiv 2601.02744)](https://arxiv.org/abs/2601.02744). Code was "on acceptance" and not confirmed public, so take the idea, not code.

### 2B. Agent tracing / observability
**ELI10.** A flight recorder for agents: every step gets a start time, an end time, a parent ("this tool call belongs to that answer") and a result. Standard shapes let any viewer draw it.
**Fits:** §0 (the recording format), 2.4 Futás layer, 2.5 hooks.
**Sources:** [OpenTelemetry GenAI agent spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans) · [Langfuse licence clarification](https://langfuse.com/resources/engineering/clarifications) (MIT core, self-hostable).

### 2C. Attention / context attribution
**ELI10.** After an answer, you ask: *which* of the things the agent read actually made it say that? **ContextCite** tests this by removing pieces of the context and seeing whether the answer changes.
**Fits:** a later "which nodes mattered" layer in the replay. The read nodes glow, and the ones that *changed the answer* glow brighter.
**Honest limit:** it needs many extra model calls (32 or more per answer) and access to the model's probabilities, which Claude's API does not expose for this. A cheap stand-in: count which read files were later quoted or edited in the same session.
**Source:** [ContextCite (NeurIPS 2024)](https://arxiv.org/abs/2409.00729) · code [MadryLab/context-cite](https://github.com/MadryLab/context-cite).

---

## 3. Process mining (you picked A; here is what it is)

**ELI10.** Watch 100 people cook pasta. One writes down only what each person did, in order: *fill pot → boil → salt → pasta → drain*. Lay all 100 lists on top of each other and the common route shows up, along with the odd detours ("someone salted twice", "three people forgot to drain"). **Process mining** does that with logs. The basic picture is the **directly-follows graph**: an arrow from step X to step Y, as thick as the number of times Y came right after X.

**For us:** each session is a list of steps, for example *read DEVLOG.md → read lines/x.md → edit lines.js → run build.js → commit*. Mine 100 sessions and you see:
- the **usual route** for each kind of task, which becomes a shortcut or a brief (3.4);
- **wasted loops**, such as reading the same five files at the start of every session. Those files belong in L0 or in a brief;
- **where sessions stall**: long gaps before a decision.

**Fits:** 3.4 pattern recognition, fed by §0 recordings.
**Tools:**
- **PM4Py is AGPL-3.0, so avoid it.** A directly-follows graph is simple counting, and we can write it ourselves (about 100 lines).
- **PrefixSpan-py**, MIT (verify): finds frequent *sequences* such as "Read A then Edit B then Bash C".

**Sources:** [PM4Py licence (GitHub)](https://github.com/process-intelligence-solutions/pm4py) · [PrefixSpan-py](https://github.com/chuanconggao/PrefixSpan-py).

---

## 4. Self-maintaining knowledge bases: pros and cons

| Option | What it is (ELI10) | + | − | Fits |
|---|---|---|---|---|
| **A. Link prediction** (knowledge-graph completion) | a model learns the graph's patterns and guesses missing links ("this feature probably has a doc too") | finds links nobody wrote down | needs training (Python, PyKEEN); guesses must be checked; little value at 1 700 nodes | later, for `alike` candidates |
| **B. Agent memory systems** (Letta / MemGPT "sleep-time agents", Graphiti, SYNAPSE) | a background helper rereads the memory while you are away, merges duplicates, updates facts, and marks what went stale | the base keeps itself tidy; Caleb (Solomon's intern) already does a weekly version | costs model usage every run; can quietly rewrite facts unless it only *proposes* | extend Caleb: propose memory and line updates as cards |
| **C. Data observability** (the "five pillars": freshness, volume, schema, distribution, lineage) | health checks on data, like smoke alarms: is it fresh, did it suddenly shrink, did its shape change, where did it come from | no model and no cost; deterministic; fits DRIFT.md directly | finds symptoms, not fixes | **first**: add the pillars to `lib/drift.js` |

**Recommendation:** start with C, because it is free and builds on the drift report. Next do B in the Solomon style, where the helper only proposes and you rule. Leave A for later.

For C in our terms:
- **Freshness:** a layer's source went stale ("features.json is 9 days older than its data.js").
- **Volume:** a layer suddenly lost 30 % of its nodes, i.e. a parser broke.
- **Schema:** a new DECISIONS format was parsed as nothing.
- **Lineage:** this node came from this file at this line.

**Sources:** [Five pillars of data observability (Conduktor)](https://conduktor.io/glossary/what-is-data-observability-the-five-pillars) · [Letta memory blocks + sleep-time agents](https://docs.letta.com/api/python) (Apache-2.0 server, verify) · [PyKEEN](https://github.com/mberr/PyKEEN) (MIT).

---

## 5. Multilayer network analysis: A versatility, B communities

**5A. Versatility (multilayer centrality). ELI10:** some people are important at school and in the football club too. Versatility scores a node by its importance **across** layers, not in just one. **Fits:** better keystones, and better ranking in `stack.js` (a node that matters on F, L and R beats a busy folder that matters only on C). **How:** it is PageRank or eigenvector centrality on the supra-graph (all layers plus vertical links), which takes a few dozen lines in JS.
**Source:** [De Domenico, Porter, Arenas: MuxViz / multilayer analysis (J. Complex Networks 2015)](https://arxiv.org/abs/1405.0843).
**Tool:** MuxViz is GPL-3 and bundles AGPL Infomap. **Study it, don't install it.**

**5B. Multilayer community detection. ELI10:** find the "friend groups" in the graph, meaning sets of nodes more connected to each other than to the rest, while allowing a group to stretch across layers. A group that spans F + L + R + C with no pillar is a **pillar we forgot**.
**Fits:** STK-Q6, automatic pillar suggestions. **This is the more useful of the two for us right now.**
**Tools:**
- **graphology-communities-louvain**, MIT, JS: runs in our Node build. Recommended.
- **leidenalg**, GPL-3, Python + igraph: a better algorithm, fine to *run* offline, not to bundle.
- **Infomap**: AGPL-3.0, so avoid it.

**Sources:** [graphology-communities-louvain](https://www.jsdelivr.com/package/npm/graphology-communities-louvain) · [Infomap licence (mapequation)](https://www.mapequation.org/infomap/) · [leidenalg](https://github.com/vtraag/leidenalg).

---

## 6. Temporal and event-sourced graphs (explained)

**6A. Event sourcing. ELI10:** your bank does not store "balance = 120 000 Ft" and overwrite it. It keeps the **statement**: every deposit and payment, in order, never erased. The balance is *calculated* from the statement whenever you ask. A mistake is not erased either: a correcting line is added.
- **For the stack:** today `build.js` overwrites `stack.json`, so yesterday is gone. With event sourcing, every rebuild appends *what changed* to `events.jsonl` ("line `sol` went waiting → active", "new link L:x → R:y").
- **What that gives you:** "what changed since Monday", a replay of the stack itself, and the feed for the neural view.
- **This is roadmap step 2.1**, and it is the foundation for 3.3 and 3.4.

**6B. Bitemporal data. ELI10:** two dates for every fact. One says *when it became true*: the decision was made on 10-21. The other says *when we found out*: the stack saw it on 11-04. Graphiti stores both on every link (`valid_at`, `invalid_at`, `created_at`).
- **For us:** DevLog dates are "when it happened". Build times are "when we learned". Keeping both lets you tell late recording apart from late work.
- **Source:** [Graphiti (Zep), temporal knowledge graph](https://github.com/getzep/graphiti) (Apache-2.0).

**6C. Time-respecting paths. ELI10:** a train timetable. You can go A → B at 9:00 and B → C at 8:00, but you **cannot** go A → C that day, because the second train left before you arrived. On a time-stamped graph, a real chain of cause must move forward in time.
- **For us:** `stack.js path` should prefer chains that move forward in time: idea → session → commit → document, not a commit "causing" an older idea.
- **Source:** [Holme & Saramäki: Temporal networks (Physics Reports 2012)](https://arxiv.org/abs/1108.1780).

---

## 7. GraphRAG, embeddings, hybrid search (ELI10)

**The library analogy.** You ask the librarian for "something about protecting cables in walls".

- **Keyword search (BM25, what we have):** the librarian looks for books containing *your exact words*. It is fast and free, but it misses "védőcső" if you typed "sleeve".
- **Embeddings (meaning search):** every text gets turned into a point on a big map of meaning, so similar ideas land close together. "Sleeve", "conduit" and "védőcső" end up neighbours, even with no shared word. A small local model can do this on your PC for free, after a one-time download.
- **Hybrid with RRF:** ask *both* librarians and merge their lists by **rank** (1st, 2nd, 3rd …), not by their different scores. Each item gets `1/(60 + rank)` from each list, and the sum decides the order. It is simple, robust, and the industry default.
- **GraphRAG:** after finding a book, the librarian also hands you the books *linked to it*: same author, same shelf, cited by it. Microsoft's GraphRAG also writes a summary of each "neighbourhood" in advance. **`stack.js q` already does the linked-books part**, because every hit lists its vertical neighbours. What we lack is meaning search and the pre-written summaries.

**Fits:** 2.6 semantic search (embeddings + RRF in `stack.js`); pillar summaries (see §9).
**Tools:**
- **sqlite-vec**, MIT or Apache-2.0: vector search inside our existing SQLite file. It is pre-v1, so expect breaking changes.
- **multilingual-e5-small**, MIT: small and local. **bge-m3**, MIT: bigger and stronger.
- **Hungarian quality is not proven for either**, so test on our own texts first.
- Microsoft **GraphRAG** (MIT) and **LightRAG** (MIT): read their ideas, but don't install. Both are heavy Python pipelines that call a model for every chunk.

**Sources:** [RRF explained (BigData Boutique)](https://bigdataboutique.com/blog/reciprocal-rank-fusion-how-it-works-and-when-to-use-it) · [sqlite-vec](https://github.com/asg017/sqlite-vec) · [multilingual-e5-small](https://huggingface.co/intfloat/multilingual-e5-small) · [bge-m3](https://huggingface.co/BAAI/bge-m3) · [GraphRAG](https://github.com/microsoft/graphrag).

---

## 8. MCP servers for local knowledge: B existing servers (fallback A, the spec)

**ELI10.** MCP is a plug standard. A program that speaks it gives every Claude session new buttons ("tools"), so the session can ask the stack directly instead of being told to run `stack.js`.

| Server | What | Licence | Verdict |
|---|---|---|---|
| **`@modelcontextprotocol/server-memory`** (official reference) | a knowledge graph in one JSONL file: *entities*, *relations*, *observations*; tools such as `search_nodes`, `read_graph` | MIT per listings, verify | **copy the shape**: tool names and the entity/relation/observation split match our nodes and links |
| **Graphiti MCP** | temporal graph with episodes, entities and search | Apache-2.0 | good ideas (§6B); needs Neo4j + Docker, too heavy for us |
| **Basic Memory** | Markdown files as the store, a database as the index, graph from links | **AGPL-3.0, avoid** | read its docs for the idea (ours is the same: sources stay Markdown, the stack is the index) |

**Fallback A (the spec in one line):** an MCP server offers three things. *Tools* are actions the model may call, such as `stack_q`. *Resources* are files the model may read, such as L0 and the codec packs. *Prompts* are ready-made starters, such as "continue line X".

**Recommendation for 2.3:** our own small stdio server (Node, no dependency) wrapping `stack.js`. It would offer the tools `stack_q`, `stack_node`, `stack_path` and `stack_drift`, plus the resources `L0.txt` and `L1-pillars.txt`, and copy the official memory server's naming.

**Sources:** [MCP servers repo (reference servers)](https://github.com/modelcontextprotocol/servers) · [Graphiti MCP server](https://github.com/getzep/graphiti/tree/main/mcp_server) · [Basic Memory licence](https://docs.basicmemory.com/reference/technical-information).

---

## 9. Token-efficient context packing (you were not sure; here is a recommendation)

| Option | ELI10 | Verdict |
|---|---|---|
| **A. Prompt compression (LLMLingua, MIT)** | a small model deletes the "unimportant" words from a text before Claude reads it, like a telegram | **skip**: it is lossy, it breaks code and paths, needs Python + a model, and our packs are already terse |
| **B. Hierarchical summaries (RAPTOR)** | summarise small chunks, then summarise the summaries, building a tree from detail up to one page; a question picks the right level | **yes**: our L0–L4 is already this. Add one written summary per pillar and per layer, regenerated only when its members change |
| **C. Prompt caching (Claude)** | Claude keeps the *start* of a conversation in a fast cache; rereading it costs about 10 % of normal | **yes, for free**: Claude Code already caches. Rule for us: keep L0 and house rules **identical** at the start of sessions, so the cache hits; put changing data (drift, dates) later |

**Sources:** [RAPTOR (ICLR 2024)](https://arxiv.org/abs/2401.18059) · [LLMLingua](https://github.com/microsoft/LLMLingua) · [Claude prompt caching](https://docs.claude.com/en/docs/build-with-claude/prompt-caching) (cache read is about 0.1× the input price; check the current page for minimums and TTL).

---

## 10. Proposed changes to ROADMAP.md (not applied)

1. **Add 1.0, "Keep the recordings" (urgent, before 2026-11-13):** raise `cleanupPeriodDays`, and archive transcripts + file history into `H:\VRG\Full\_admin\recordings\` on each build (STK-Q8).
2. **New step 2.0, "Recorder":** `record.js` turns transcript + file history + git reflog into `recordings/<session>.jsonl`, one OpenTelemetry-shaped event per step, each joined to stack nodes. It runs after the fact, with no hooks needed (§0).
3. **2.1 event log:** state that it follows event sourcing (append-only, never edited). Add bitemporal fields (`valid` = when it happened, `seen` = build time) (§6A, 6B).
4. **2.4 Futás layer:** build it from the recordings in 2.0 rather than from new hooks. Hooks (2.5) become the *live* feed of the same event shape.
5. **2.6 semantic search:** name the choice (sqlite-vec + multilingual-e5-small, then RRF with k = 60 against FTS5). Add a Hungarian test set of about 30 queries before choosing a model (§7).
6. **2.3 MCP:** follow the official memory server's naming. Expose L0/L1 as *resources*, not only tools (§8).
7. **New 2.10, "Observability pillars in DRIFT":** freshness, volume, schema and lineage checks per layer (§4C).
8. **New 2.11, "Versatility + communities":** multilayer PageRank in `build.js` (replaces raw degree for keystones and ranking); Louvain on the supra-graph to suggest pillars (§5).
9. **3.2: add "Visszajátszás" (session replay page)** as the first visual page: scrubber, growing file tree, stack nodes glowing. Gource as an outside tool for git-only videos (§0).
10. **3.3 neural view:** use spreading activation with hub inhibition as the glow model, and one hop per tick as the animation (§1, §2A).
11. **3.4 pattern recognition:** directly-follows graph (own code) + PrefixSpan over the recordings; outputs are suggested briefs and L0 additions (§3).
12. **Codec:** add pillar and layer summaries (RAPTOR-style) to L1, regenerated only when members change. Add a "stable prefix" rule for prompt caching. Drop the LLMLingua idea (§9).
13. **`stack.js path`:** prefer time-respecting chains (§6C).

## 11. New questions (A = recommended)

**STK-Q8. Keep session recordings? (urgent: the 10-14 transcripts go about 11-13)**
- **A** set `"cleanupPeriodDays": 3650` in your user settings now, *and* copy transcripts + file history into `_admin/recordings` on each stack build
- B only raise the setting
- C leave the 30-day default

**STK-Q9. Where does the recorder get its steps?**
- **A** after the fact, from transcripts + file history + git (no new hooks, works for every past session still on disk)
- B also turn on Claude Code's OpenTelemetry events to a local collector (live, more detail, more setup)
- C extend the Console trace hooks from the repo to every project (user-level settings)

**STK-Q10. Which replay first?**
- **A** our own "Visszajátszás" page: scrubber, file tree, stack glow, everything joined to the stack
- B Gource videos of git only (outside program, quick, no agent steps)
- C both: Gource now, our page next

**STK-Q11. Community detection for pillar suggestions?**
- **A** graphology-communities-louvain (MIT, runs in our Node build)
- B leidenalg (GPL-3, Python, run offline by hand)
- C none, pillars stay fully by hand

**STK-Q12. Meaning search model?**
- **A** multilingual-e5-small, local, MIT, after a 30-query Hungarian test
- B bge-m3, local, MIT, bigger, slower
- C an embeddings API (per-use cost, nothing to install)

**STK-Q13. Self-maintenance order?**
- **A** observability checks first (free), then a propose-only sleep-time helper (Caleb-style), link prediction last
- B the helper first
- C link prediction first

---
---

# Part 2: terms added 2026-11-06

*The Founder added a second list and a picture of the four basic network metrics. Same format as part 1.*

## 12. The four network metrics, measured on our stack (from your picture)

Measured 2026-11-06 on `out/stack.json`, links without pillars (scratch script, nothing in the stack changed):

| Metric | ELI10 | Our value | What it tells us |
|---|---|---|---|
| **Clustering coefficient** | if two of your friends are friends with each other too, your circle is "cliquey" | **0.35** on average | quite cliquey: a session, its commits and their files tend to all touch each other, so neighbourhoods are tight |
| **Degree centrality** | how many links a node has; the big ones are the **hubs** | top: `C:Planner/projects/varler-planner` 358, `C:tools` 247, commit `6b7eb03` 159, `G:sec.planner` 157 | the hubs are folders, not ideas. They need the inhibition from §2A, otherwise every search answer passes through them |
| **Modularity** | do the nodes fall into groups that link inside more than outside? (0 = no groups, about 0.3+ = clear groups) | by **layer** 0.08 · by **pillar** 0.25 | layers are *not* islands. Vertical links weave them together, which is what we wanted. Pillars *are* real groups, so community detection (§5B) has something to find |
| **Path length** | the fewest steps from one node to another | average **3.6**, longest seen 10 | a "small world": almost anything is 3–4 hops from anything else, which is why `stack.js path` answers are short |

Also: there are **37 separate pieces, and 34 are lone nodes** with no link at all. Those are the first drift list worth checking.

**Proposal:** `build.js` writes these four numbers into STATUS.md on every build, so a jump shows that something broke or merged. Modularity dropping by pillar, for example, means a pillar has gone vague.

---

## 13. Second brain, digital organisation systems, "paracode"

**Building a Second Brain (Tiago Forte).** Your notes system does the remembering, so your head can do the thinking. It has two parts:
- **CODE** is the *movement* of information: **C**apture what resonates, **O**rganize it, **D**istill it to the essence, **E**xpress it as something made.
- **PARA** is the *filing* used in "Organize": **P**rojects (with a goal and an end), **A**reas (ongoing duties), **R**esources (topics of interest), **A**rchives (inactive).

"Paracode" is most likely **PARA + CODE** together.

**The three classic systems** (they answer different questions and combine well):

| System | Answers | ELI10 | Fits us as |
|---|---|---|---|
| **PARA** | "what is this *for*?" | sort by how soon you'll act on it | DevLog status already is PARA: `active` ≈ Project, `recurring` ≈ Area, `parked` / `ended` ≈ Archive. A `para` tag per node would let the Dashboard sort by it |
| **Zettelkasten** (Luhmann) | "how do ideas connect?" | one small idea per card, each card linked to others; insight grows from the links | the Ideas layer (I) and memory notes with `[[links]]` already work this way |
| **Johnny.Decimal** | "where is it?" | at most 10 areas × 10 categories, every folder numbered (`32.04`) | an option for the H:\ folder tree (the re-root line); the number would be a stable key for the stack |

**"20 block system template":** not found under this name. Please give the source (author, video or link) and I'll look again.

**Sources:** [PARA vs Building a Second Brain (Forte Labs help)](https://help.fortelabs.com/hc/en-us/articles/18183648465293) · [CODE explained (no-nonsense guide)](https://medium.com/practice-in-public/a-no-nonsense-guide-to-the-code-framework-a10d3ee48976) · [Zettelkasten vs PARA (Zain Rizvi)](https://zainrizvi.io/blog/remembering-what-you-read-zettelkasten-vs-para/) · [Johnny.Decimal summary](https://tech.stonecharioteer.com/posts/2021/til-johnny-decimal-organization-system).

---

## 14. Concept maps and the Master Knowledge Map (for MindMap)

**Concept map (Novak, 1972).** A map of ideas where every link has a **verb on it**: "cable —*runs in*→ conduit", "conduit —*is chosen by*→ diameter". Every pair plus its link reads as a sentence (a *proposition*). It starts from a **focus question** ("how do we price a job?"), goes from general at the top to specific below, and has **cross-links** between branches. Novak calls these the creative leaps.
- **For MindMap:** today's wires mostly carry a *type* (fork, feeds…). Adding a short verb label and a focus question per map turns any MindMap into a concept map. Cross-links between frames are exactly the stack's vertical links.

**Master Knowledge Map.** Not a fixed standard. The common idea is:
1. make one small map per book, course or topic;
2. **merge** them into one master map, revised every time something new comes in;
3. give every node a stable **id**;
4. keep a **shared backbone** (the concepts) separate from a **personal layer** (how well *you* know each one, as a grade rather than yes/no).

For us, the master map is **the stack itself**:
- the backbone is the layers and pillars;
- the per-topic maps are the existing `.mindmap.json` files;
- a "competence" field per node or pillar would hold the personal layer (see §16).

**Sources:** [Novak & Cañas: Theory underlying concept maps](https://users.cs.northwestern.edu/~paritosh/papers/sketch-to-models/Novak-Canas-TheoryUnderlyingConceptMapsHQ.pdf) · [Knowledge maps, merge into a master map (Limitless Playbook)](https://thelimitlessplaybook.beehiiv.com/p/035-knowledge-maps) · [Backbone + personal mastery layer (project concept)](https://tim-churchill.github.io/knowledge_map.html).

---

## 15. Neural networks, CNNs, forward propagation, transformers vs MoE (for the neural view)

**Artificial neuron (ELI10).** A tiny voter. It receives numbers from others, multiplies each by how much it trusts that sender (the **weight**), adds them up, adds its own mood (the **bias**), and if the total is high enough it "fires". A squashing rule called the **activation** decides how strongly.

**Forward propagation.** The numbers flow one way, layer by layer: inputs → hidden layers → output. Each layer's neurons vote on the previous layer's votes. *That flow, layer by layer, is the animation the neural view should copy:* our layers F → … → G are the network's layers, and a question "propagates" down through them.

**CNN (convolutional neural network).** For pictures. A small stencil (a **filter**) slides over the image looking for one pattern (an edge, a corner). Later layers combine patterns into shapes and then into objects. **For us:** only a metaphor. A "filter" sliding over the stack would be a query that looks for one pattern, for example "a feature with no line", which is what `drift.js` does.

**Transformer.** Every word looks at every other word and decides how much attention to pay to it, then mixes in what it learnt. That is the engine inside Claude.

**Mixture of experts (MoE).** Inside the transformer, the "thinking" block is replaced by many specialists plus a **router** that sends each word to only 1–2 of them. The model can be much bigger without each word costing more, but all experts must still sit in memory.
- **For us:** the router + experts idea is how the Council already works: Bernard routes, specialists answer.
- It is also a good model for `stack.js`: route a question to the 1–2 layers most likely to hold the answer, instead of searching all of them.

**Sources:** [3Blue1Brown: Neural networks series](https://www.3blue1brown.com/topics/neural-networks) · [Forward propagation (DataCamp)](https://www.datacamp.com/tutorial/forward-propagation-neural-networks) · [A closer look into MoE in LLMs (arXiv 2406.18219)](https://arxiv.org/abs/2406.18219).

---

## 16. Context engineering, cognitive augmentation, full-stack strategist, cross-discipline competence

**Context engineering (Anthropic).** The successor to "prompt engineering": choosing *everything* the model sees, not only the question. The goal is **the smallest set of high-signal tokens** that gets the job done. Tools return compact results, files are fetched just in time instead of loaded up front, long histories get compacted, and sub-agents keep side work out of the main context.
- **This is the stack's whole purpose.** L0 → `stack.js q` → node card → source line is just-in-time context. Every new house rule should be judged by "does it add signal or only tokens?"

**Cognitive augmentation (Engelbart, 1962).** Not "a machine that does it for you" but "**you plus your tools as one system** that thinks better". Tools, language, methods and training grow together. The VRG Desktop is this idea: one place where your tools, maps and agents extend your thinking, and you stay the one who decides (the Solomon rule).

**Full-stack strategist.** A loose marketing and strategy term, not a standard title: someone who moves from the big picture to hands-on execution and back, across every layer (analysis, technology, creative, delivery). The name copies "full-stack developer". It describes how you already work: electrician, planner, toolmaker, salesman, all in one.

**Cross-discipline competence ("T-shaped").** Deep in one field (the vertical bar of the T), with working knowledge across many (the horizontal bar).
- **For the stack:** a **competence layer** (Szereplők + mastery) could record, per pillar, who knows it how well. That covers you, a colleague, and which agent persona.
- The Council would then route work by competence, and the Dashboard could show where knowledge sits in one head only (a risk).

**Sources:** [Effective context engineering for AI agents (Anthropic)](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) · [Engelbart: Augmenting Human Intellect (Doug Engelbart Institute)](https://www.dougengelbart.org/AHI-Vistas) · [Full stack strategy (Medium)](https://medium.com/@camillastore/full-stack-strategy-31c96ac5f520).

---

## 17. RPA vs AI agents, and evolving AI architecture stacks

**RPA (robotic process automation).** A **macro that clicks for you**. It follows a fixed script on fixed screens: fast, cheap, predictable, and it breaks when a button moves. **AI agent:** given a goal, it decides the steps, copes with messy input and exceptions, but costs more and needs checking. Practice is **both**: the agent decides, and scripts do the fixed steps.
- **For us** this is exactly the rule "scripts before models" (Council charter): `build.js`, `drift.js`, `run-batch.js` are the RPA side; Claude sessions are the agent side. The stack should label every process node as *script* or *agent*, so the Futás layer can show what costs tokens.

**Evolving AI architecture stacks ("compound AI systems").** Real systems are rarely one model. They are several models + retrievers + tools + memory, with an **orchestration layer** deciding the order, and guardrails around it. The parts change often: new models, new tools.
- **For us:** describe our own AI stack as nodes in the Agentic layer: models used, MCP servers, tools, memory, gate, schedules. Swapping a part (Sonnet → a newer model, FTS → hybrid search) is then a visible event, not a silent change.
- This is the "adapting" part: each swap is logged and compared on the same test questions.

**Sources:** [Agentic AI vs RPA (AI Time Journal)](https://aitimejournal.com/agentic-ai-vs-rpa-whats-actually-different-and-when-to-use-each) · [Compound AI production inference (arXiv 2604.25724)](https://arxiv.org/abs/2604.25724) · [What are compound AI systems (TrueFoundry)](https://www.truefoundry.com/glossary/what-are-compound-ai-systems).

---

## 18. Task analysis, "decision currents", adaptive user-flow composers

**Hierarchical task analysis (HTA).** Break a job into a tree: goal → sub-goals → operations, and for each level a **plan** that says the order *and the decision points* ("do A; if the wall is concrete, do B, else C"). It is used to find bottlenecks, design screens and write training.
- **For us:** your real jobs already have a flow (survey → plan → quote → material → install). An HTA of the *quote* job would show which steps a script can take (RPA), which need an agent, and which need you.
- The process mining in §3 can then check the tree against what sessions actually do.

**"Decision currents."** Not found as an established term. The nearest ideas:
- *decision flow graphs* (Pawlak), where decisions are modelled as flows spreading through a graph;
- the view that a decision is a **current that crystallises** at a vote or contract, rather than a single moment.

For us this would be the Q layer shown as flows: a question raised → discussed in sessions → answered → spreading into lines, features and code. The time-respecting paths from §6C would draw it. **If you have a source for the term, send it.**

**Adaptive / generative user-flow composers.** Instead of one fixed sequence of screens for everyone, the system **assembles the flow** for this user and this moment. Optional steps fold away, the right helper card appears, and a power user sees fewer steps than a newcomer. The designer sets **rules and boundaries**, not every screen. The known risk is opacity, so the user must be able to see *why* this flow appeared and reset to the plain one.
- **For us:** the Dashboard / Desktop could compose the "start of day" from the stack: quiet lines, open decisions, today's job.
- The Simplified UI work in the Planner is the hand-made version of the same idea.

**Sources:** [Hierarchical task analysis (AHRQ toolkit)](https://digital.ahrq.gov/health-it-tools-and-resources/workflow-assessment-health-it-toolkit/all-workflow-tools/hierarchical-task-analysis) · [Decision rules and flow networks (Pawlak)](https://kstit2016.iitis.pl/en/print/1903) · [Generative UI taxonomy (ECIS 2026)](https://aisel.aisnet.org/ecis2026/isd_pm/isd_pm/3/) · [Generative UI design (Lazarev)](https://www.lazarev.agency/articles/generative-ui-design).

---

## 19. Chunking techniques for retrieval, and AEO

**Chunking (ELI10).** Before a search can find "the paragraph about conduit sizes", long documents are cut into pieces. Cut badly and the answer is split across two pieces, or a piece loses what it was about.

| Technique | Idea | Verdict for us |
|---|---|---|
| fixed size | every N words | bad for Markdown and code |
| **structure-aware** | cut at headings and function starts | **what `vrg-ctx.js` already does**; keep it |
| semantic | cut where the topic changes (embeddings) | costs more and is often no better |
| late chunking | embed the whole document, then cut, so each piece remembers the whole | worth it with embeddings (2.6) |
| **contextual retrieval** (Anthropic) | before indexing, add one sentence per piece saying what document and section it is from | **yes, but cheaper**: we can write that line *without a model*, from the file path + heading chain + pillar ("BRIDGE STD-001 › Power › RB-L loads"). About 35–49 % fewer retrieval misses are reported for the model-written version |

**AEO (answer engine optimisation).** SEO for AI answers: making a *website* easy for ChatGPT, Google AI Overviews and similar to quote. Clear definitions near the top, a question-and-answer structure, structured data (schema.org), and the proposed `llms.txt` index file. Evidence that it works is mostly vendor claims.
- **For us** it matters for **public pages** (a future Varler / BRIDGE site), not for the private stack.
- The internal twin of `llms.txt` is our **L0.txt**: a curated index for machines.

**Sources:** [Chunking strategies compared (arXiv 2504.19754)](https://arxiv.org/abs/2504.19754) · [Contextual retrieval (Anthropic)](https://www.anthropic.com/news/contextual-retrieval) · [What is AEO (DEV)](https://dev.to/chudi_nnorukam/what-is-aeo-answer-engine-optimization-explained-2026-4cm1) · [llms.txt and GEO (DEV)](https://dev.to/mbdev/llmstxt-and-geo-in-2026-how-to-get-your-site-cited-by-ai-search-4352).

---

## 20. ArchiDiagram and urbandesignlab.in

### ArchiDiagram (archidiagram.com): what it is
A diagram kit for architects by **Febhouse Studio**:
- a browser **web app** (sun and shadow analysis, instant context maps from site coordinates, a symbols library);
- **SketchUp plugins**: Sun Diagram (sun paths, shadow batches), Shadow Slice (interior sunlight with walls cut away), Dynamic Symbols;
- templates for Canva, PowerPoint and InDesign.

Free / Studio / Pro tiers with a 14-day Pro trial; many free samples (e.g. Sample-70 Shadow Analysis, Sample-53 Quick Site Analysis). Its own terms say **sample files may not go into your portfolio without permission**, and free templates and symbols may be used on commercial projects.

### Is a solstice shadow / daylight / façade study viable for us? **Yes, as our own feature. Not by adopting ArchiDiagram.**
- **Why it fits:** BRIDGE already has **STD-009 Shading** (blind and shutter automation), and the **façade compass bearing is an open BRIDGE question**. A sun study gives exactly that: which façade gets sun when, in summer and winter. That drives:
  - blind schedules;
  - glare in the cinema room;
  - PV and heat-gain notes in the client material;
  - the Planner's 3D views (V-series), which already have the house geometry.
- **How, cheaply:**
  - **SunCalc** (BSD-2, tiny JS) gives the sun's direction for any date, hour and place;
  - the Planner's plan + heights, or OSM building outlines for the neighbours, give the shapes;
  - a three.js shadow map, or a simple 2D projected-shadow polygon, gives the drawing.

  Outputs: solstice / equinox shadow sheets per hour, sun-hours per façade and per window, and a "sun arc" icon per room for the client preview.
- **Avoid:** Ladybug Tools (GPL / AGPL, listed both ways). **Study:** Sunpath (OSM + horizon profile) and the sun-position 3D viewer (three.js + SunCalc) for the method.
- **Where it goes:** not the stack. A new **BRIDGE / Planner feature line** ("Napút / árnyék"), with its own pillar on the day it gets a folder (STK-Q15).

### urbandesignlab.in: inspiration, not a tool
An Indian education and publishing platform (UDL Education Pvt. Ltd.) for urban design, landscape, architecture and planning. It offers:
- paid masterclasses (urban mapping, QGIS, Adobe);
- thesis showcases, articles, competitions and a job portal;
- **downloadable resources**: tree, human and vehicle cutouts, axonometric and site-analysis diagram packs, templates.

No data layers or tools. **What to take from it:** the *structure* (one platform: learning + showcase + resources + community + jobs) is a good model for a future public Varler / BRIDGE site, which is where AEO (§19) applies. Its site-analysis diagram packs are a style reference for the shadow sheets above. Remember the rule: draw our own illustrations, never reuse theirs.

**Sources:** [ArchiDiagram](http://www.archidiagram.com/) · [Urban Design Lab](https://urbandesignlab.in) · [SunCalc (BSD)](https://github.com/mourner/suncalc) · [Sunpath (OSM sun exposure)](https://github.com/YASSERRMD/Sunpath) · [Sun position 3D viewer (three.js forum)](https://discourse.threejs.org/t/sunposition-3d-viewer/40901) · [Ladybug Tools licence listing](https://www.food4rhino.com/en/app/ladybug-tools).

---

## 21. More proposed ROADMAP.md changes (not applied; continues §10)

14. **STATUS.md metrics:** clustering, top hubs, modularity (by layer and by pillar), average path length, lone nodes. Written each build, with the last value beside it (§12).
15. **Concept-map labels:** an optional verb label on link types (`feeds` → "feeds data to") and a focus question per layer in `meta.js`; MindMap exports show them (§14).
16. **PARA tag:** derive `para: project|area|resource|archive` for every node from its existing state (DevLog status, feature tier), so the Dashboard can sort by it (§13).
17. **Contextual chunk headers in `vrg-ctx.js`:** prefix each indexed chunk with "file › heading chain › pillar", written by script, not by a model (§19).
18. **Script / agent label** on every process node (generators, tools, scheduled tasks, sessions), so the Futás layer can show what costs tokens (§17).
19. **Layer routing in `stack.js q`** (the MoE idea): pick the 1–2 layers a question most likely belongs to, search those first, widen only if thin (§15).
20. **Competence layer (later):** per pillar, who knows it how well (you, a colleague, an agent persona); feeds Council routing and a "knowledge in one head" warning (§16).
21. **Not the stack, its own line:** "Napút / árnyék" sun and shadow study for BRIDGE STD-009 and the façade-bearing question (§20).

## 22. More questions (A = recommended)

**STK-Q14. Network metrics in every build?**
- **A** yes, in STATUS.md with the previous value beside it
- B only on demand (`stack.js stats --metrics`)
- C no

**STK-Q15. The sun and shadow study?**
- **A** its own BRIDGE / Planner line later (SunCalc + Planner geometry), starting with the façade bearing for STD-009
- B try ArchiDiagram's free web app on one real house first, then decide
- C not now

**STK-Q16. Which organisation system frames the Dashboard?**
- **A** PARA tags derived from existing states (no new hand work)
- B also number the H:\ folders Johnny.Decimal style
- C neither

**STK-Q17. Concept-map verbs on links?**
- **A** yes, one verb per link *type* (cheap, generated)
- B a verb per individual link (by hand, rich, slow)
- C no

**Open for you:** the "20 block system template" and "decision currents". Send a source (link, author or video) and I'll research them properly.

---

# Answers (2026-11-06) and what was built from them

**Round 1:** STK-Q8 A · Q9 A · Q10 A · Q11 A · Q12 **B** · Q13 A. **Round 2:** STK-Q14 A · Q15 A · Q16 A · Q17 A.

The Founder then asked for the best of these features as one clean, self-healing codebase ready for later work. That is v2 (see `../ARCHITECTURE.md`, `../DECISIONS.md`, `../ROADMAP.md`):

| Proposal | State |
|---|---|
| 1 keep recordings | built |
| 2 recorder | built |
| 3 event sourcing + bitemporal | built |
| 4 Futás from recordings | built |
| 5 semantic search | bge-m3 instead of e5 (Q12 B); hybrid + RRF built, vectors wait for Ollama |
| 6 MCP naming + resources | built |
| 7 observability | built |
| 8 rank + Louvain | built |
| 9 Visszajátszás page | built |
| 10 spreading activation | built, used in the replay |
| 11 DFG + PrefixSpan | built |
| 12 L1 summaries + stable prefix | not started |
| 13 time-respecting paths | built |
| 14 metrics in STATUS | built |
| 15 concept-map verbs | built (the focus question per layer is not) |
| 16 PARA | built |
| 17 contextual chunk headers | built in the stack's own index, not in vrg-ctx.js, so the repo is untouched |
| 18 script/agent label | built |
| 19 layer routing | built, as a soft boost |
| 20 competence layer | not started |
| 21 Napút / árnyék | its own line (Q15 A) |

**Still open:** sources for "20 block system template" and "decision currents".
