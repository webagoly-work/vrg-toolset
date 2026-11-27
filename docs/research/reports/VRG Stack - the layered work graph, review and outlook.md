# VRG Stack: the layered work graph, a review and an outlook

*Research report, 2026-11-27 (cloud session). Asked by the Founder after PR #29: a detailed analysis and review of the
whole work line built in it, covering what the thing is, what it is for, how it works, what it gives, where it can go,
whether it works on databases in general, and the next steps. Written for the DV research line (the Data Vault's
documents). The Data Vault repository could not be attached to this session, so the report lives here first, in
`docs/research/reports/`, and moves or is copied there unchanged. Nothing in it names a client, a person or an ask's
words.*

**How far to trust it.** The figures come from this branch and from the sandbox builds made in the cloud:
- 33 commits, 137 files, +11 088 / −232 against main;
- 59 modules in `Stack/lib` (about 8 600 lines);
- 24 Stack pages;
- 22 test files with 164 tests, all passing;
- decisions STK-P111 … P212.

Every new layer was built and tested on invented fixtures and one session's transcript. **None has yet run on the
PC's real jobs, boards, recordings or Visual Base.** Where a claim depends on that run, it says so.

---

## 1. The short answer

- **What it is.** The VRG Stack (Rétegverem) is **one graph of the whole VRG work, cut into layers**. Each layer is
  one way of seeing the same body of work: what exists (features), why (ideas, decisions), who and how (people,
  agents, runs), what changed (commits), where (code, documents), how it is reached (entry points), whether it works
  (tests), and what is wrong (signals). The layers sit on top of each other. **Vertical links** join the same real
  thing across layers.
- **The one idea that carries it: the String (Füzér).** Pick anything on any layer and follow its vertical links.
  The set of layers it reaches is a 21-slot mask, and **that mask is the thing's development state**:
  - a thing reaching features, code, commits, documents and runs is a full program;
  - a thing reaching only ideas is a spark;
  - code that reaches no feature and no idea is an orphan.

  The state is never typed by hand. It falls out of the data.
- **What this line added.**
  - Eleven new layers: T, N, P, S, J, M, D, V, O, W, plus the import sub-layer of C.
  - A page for each new layer.
  - The machinery that makes the pages one system: live incremental builds (S5), a write gateway with an
    approved diff (S6), and a cross-page selection contract (S7).
  - The byte-particle Stack Viewer (S8–S10) and Érintésnyom (the touch trace).
  - The phone bundle of all of it.
- **What it gives.** One place to ask "where is X, what state is Y, what touched Z", for the Founder on a page and
  for an agent over MCP in a few hundred tokens. **Drift** (a plan that says one thing while the work says another)
  shows up as a signal, without anyone looking for it.
- **Is it generic?** Yes, more than it looks. Underneath it is a **multilayer property graph with typed vertical
  edges, a reach mask and rule-based classes**. Any set of databases that share keys (an ERP, a CRM, a ticket
  system, a code host) can be layered the same way. §7 shows the SQL shape.
- **The honest weak spot.** It is wide and young. Twenty layers and two dozen pages were built in one long line,
  mostly against fixtures. The first real build on the PC, and what its numbers say, is the next thing that
  matters, ahead of any new layer.

---

## 2. What it is, defined

| Term | Meaning |
|---|---|
| **Source** | Something the work already keeps: `notes/features`, the idea timeline, the DevLog, git, the repo files, the decisions files, `launcher/vrg-menu.json`, the catalog, the recorded Claude sessions, the UI kit, `vendor-manifest.json`, the access list, the job register, the Board Console. **A source is read, never written** (except through the gateway, §3.6). |
| **Layer** | A **filter** (the part of the work that is countable as ideas, as decisions, as commits…) or a **shadow** (the whole seen in another form: the Codec folds it, the Globe holds every word). One letter, one adapter, one page. |
| **Node** | One thing on one layer: `F:p9` a feature, `Q:VIS-Q5` a decision, `R:5ee8b1e` a commit, `N:start.P` a START key, `J:<kind>.<subject>` a warning, `M:<job code>` a client job (code only). |
| **Edge** | A typed relation from `schema/links.js`, each with a verb for reading it as a sentence. **Horizontal** inside a layer (a feature's parts, a file's imports); **vertical** across layers (a commit *touches* a folder, a decision *answers* an idea). |
| **Pillar (E)** | One real thing across layers (Planner, Kapu, VRG Mobile…), kept by hand in `entities.js`, each with a Head that owns it (`docs/council/ROSTER.md`). |
| **String (Füzér)** | `string(seed)`: the nodes reachable over vertical edges within two weighted hops, plus the seed's pillar. Hubs are damped so `tools/` does not swallow everything. |
| **Reach mask** | The layers a string touches, in stack order: `W F V M N S I T Q L A U P R C D O G K J Z`. A dot is a layer not reached. |
| **Class** | Rules over the mask and the dates: Program · In build · Built, quiet · Planned · Spark · Orphan (STRINGS-PLAN §1.3, tunable in `config.js`). |
| **Signal (J)** | Every warning any check raises, as a node standing on what it is about, so a warning has a string too. |
| **Page** | A generated view of one layer. It renders only from the build's data and carries the build's id, so it cannot drift from the data. |

The stack order, top to bottom, reads as a story: who (W), what is shown (F), how it looks (V), for whom (M jobs), how
it is reached (N), what was asked (S), the ideas and open work (I, T), the questions and lines (Q, L), the agents and
runs (A, U), the tests (P), the commits, code and devices (R, C, D), what comes from outside (O), the words (G), the
handbook (K, from main), what is wrong (J), and the fold of it all (Z). E, the pillars, runs through every layer as a spine.

---

## 3. How it works

### 3.1 The build

`Stack/lib/pipeline.js` runs guarded stages, each under a health collector:

```
archive ─► layer adapters (W F V M N I T Q L A P R C D O G K, S after the recordings)
       ─► join (vertical edges by shared keys and resolved mentions)
       ─► record ─► U · Futás ─► pillars ─► validate
       ─► analytics (PageRank, Louvain, metrics) ─► signals (J) ─► write graph
       ─► events + snapshot ─► search index (SQLite FTS5 + optional bge-m3 vectors)
       ─► pages' data (one optional stage per page) ─► HEALTH.md, DRIFT.md
```

- A layer that fails is **carried forward** from the last good build and marked stale, so one broken map never
  empties its layer.
- An optional stage that fails is skipped.
- A required stage that fails stops the build, and `out/` keeps the last good files.
- Writes are atomic (a `.tmp` file, then a rename) under a single build lock.
- `out/` is derived and safe to delete.
- `data/` (the event log, metrics and snapshots) is append-only history and is validated and repaired, never rebuilt.

### 3.2 An adapter per layer

Each layer is one function returning `{ nodes, edges }`. Adding a layer means five things:
- the adapter;
- a row in `lib/meta.js`;
- its letter in `schema/shapes.js`;
- its relations in `schema/links.js`;
- a DRIFT section if it raises signals.

This line followed that recipe eleven times:

| Step | Layer | Reads | Main signal it raises |
|---|---|---|---|
| S3 | T Teendők | not-yet lists, ROADMAP ✗ rows, PROPOSALS, open Q | `looks done` (open work whose string is built), `status drift` |
| S11 | N Belépők | START (`vrg-menu.json`), servers, programs, the catalog, Mobile features | `unreachable`: pillars with code no door opens; a door to a missing file shows on its page |
| S12 | P Próbák | the test suites, how each runs, recorded results (`stack.js probe`) | `test fail`, `test stale`, `no runner`, `unverified` (code no test reaches) |
| S13 | S Kérések | the Founder's prompts and slash commands from the recordings, clustered | `asked again`: an ask in two or more sessions that no commit followed |
| S14 | J Jelzések | every other check | (it is the signals) |
| S15 | M Munkák | the job register, **job codes only** | `job quiet`: a job the register calls running with no new file for 30+ days |
| S16 | D Eszközök | sketches, firmware, boards from the Board Console | `fw stale` (firmware older than its sketch), `board behind`, `board unknown` |
| S17 | V Látvány | the UI kit, Mélyvíz, which look each page wears | `look drift` (a Mélyvíz copy differs from its source), `kit behind` (an older inlined kit) |
| S18 | O Külső | `vendor-manifest.json`, npm, MCP servers | `vendor branch` (pinned to a branch, not a tag), copyleft, `licence unknown` |
| S19 | W Szereplők | agents, seats, the access list, **by role only** | `access signature` (the Kapu's list does not verify), `seat vacant`; DRIFT lists pillars no Head owns |
| C+ | C Függőségek | every `require`/`import` in the repo | `import broken`, `import cycle` (68 false broken imports went to 0 by reading statements only) |

### 3.3 Incremental build and the live twin (S5)

- A **source map** (`lib/sourcemap.js`) knows which layer each source path feeds. A file watcher turns a hand edit
  into a re-run of only that layer's adapter. The other layers come from the **layer cache** (`out/layers/*.json`),
  the join runs again, and the graph is rewritten. A test proves the result is identical to a full build.
- When the set of known keys changes (a new file), the build falls back to a full one rather than guess.
- Health signals are carried from the last full build, so they don't flicker on incremental ones.
- `serve.js` pushes a `changed` event. Each open page reloads only if a layer it shows changed, keeping its
  selection, and never while something is being typed.

### 3.4 The page contract (S7)

Every layer page loads its `out/<page>-data.js` and `lib/live.js`, then calls
`StackLive.contract({ layer, data, items, select, getSelection })`.
- When the Founder selects something, the page sends the ids on a BroadcastChannel.
- The sender computes the **string** from `out/stack-data.js`.
- Every other open page lights the string's members in its own vocabulary and dims the rest.
- A page lint (`test/pages.test.js`) holds every page to the contract: no hard-coded node ids, the contract call
  present, the data file loaded.

### 3.5 The Stack Viewer and Érintésnyom (S8–S10)

- **The Viewer** (WebGL2) draws every layer as a horizontal plane. Each plane is filled with particles made from
  the layer's own text, about one particle per 16 bytes, laid out in the layer's natural order and then along a
  Hilbert curve.
  - The phone gets the **byte classes** only (letter, digit, space, punctuation…), never the text.
  - A time scrubber replays the event log.
  - A live diff glows where the last build changed something.
- **Érintésnyom** lights the layers a recorded session touched, step by step. It adds a Forecast (what an ask is
  likely to touch) and a blast radius (what a change to a node reaches).

### 3.6 The write gateway (S6)

The house rule is that a source changes only by its own tool or by hand. The gateway is that tool.

`preview(op)` shows the exact diff and its hash. `apply(op, hash)` writes it only if:
- the file has not changed since the preview;
- the path is a decisions file the Q layer reads (or `threads.js` for "mark done");
- the next build's own parser will read the result as intended.

The gateway never commits and never touches R, U, A, C or G. Every write is an `edit` event in the log. Two editors
exist today:
- answering a decision (one fixed line under the question);
- moving a not-yet item to built on the Füzértábla.

### 3.7 Asking it

- **CLI:** `stack.js q "<words>"` (hybrid search: BM25 over nodes and heading chunks, bge-m3 when present, fused by
  RRF), plus `node`, `path` (time-respecting paths), `ent`, `session`, `probe` and the reports.
- **MCP:** `stack_search`, `stack_node`, `stack_path`, `stack_pillar`, `stack_session`, `stack_report`, and
  `stack://codec/L0` as a one-screen orientation. The MCP side is read-only and can never start a build.

### 3.8 Privacy, built in rather than bolted on

| Layer | Rule | How it is enforced |
|---|---|---|
| M (client jobs) | job codes only: no folder label, register note, address or file name | a test on an invented fixture |
| W (people) | by role only: never a name, email or login | a test against the real access list's shape |
| S (asks) | the words stay on the PC, in the git-ignored `out/` | the phone's connectome data gets neutral titles |
| Viewer on the phone | byte classes only, never the bytes | in `bundleViewer` |

---

## 4. What it is used for

| Who | Question | Where the answer is |
|---|---|---|
| The Founder | "What state is the Board Console really in?" | the string's mask and class, on any page |
| The Founder | "What did I keep asking for that never happened?" | Figyelemtérkép (S): open threads, asks no commit followed |
| The Founder | "Which START keys lead nowhere? What code has no door?" | Ajtótérkép (N) |
| The Founder | "What is wrong right now, and with what?" | Jelzéstábla (J), the Viewer's ⚠ |
| The Founder | "Which questions wait for my answer?" | Döntésnapló (Q), with the answer written back through the gateway |
| An agent | "Where is X?" before opening any file | `stack_search`, then `stack_node`, in a few hundred tokens |
| An agent | "What will my change touch?" | `stack_path`, Érintésnyom's blast radius |
| A Head (Council) | "What do I own, and what in it is unverified?" | Ki kicsoda (W) × Tesztfal (P) |
| On the phone | the whole Stack offline, from the ◢ dial | stack-pages bundle (Mobile D-191) |

---

## 5. Benefits

1. **One truth with many faces.** No page holds state, so no two pages can disagree. An edit anywhere reaches every
   view within a build, about a second when incremental.
2. **State is measured, not declared.** A thread's hand-typed status can be checked against its string's reach,
   and a gap of two or more steps becomes a drift card. This is the Stack's main use: it catches plans and reality
   coming apart.
3. **Cheap for agents.** Asking before reading replaces opening ten files with one query. The work it saves grows
   with the repo, and the CLAUDE.md rule "ask the VRG Stack before reading files" depends on this.
4. **Warnings have context.** A signal is a node on the thing it is about, so it carries that thing's string: who
   owns it, what tested it, which decision governs it.
5. **Safe by construction.**
   - Sources are read-only.
   - Derived outputs are disposable.
   - History is append-only.
   - The one write path shows its diff and waits for a click.
   - Privacy is per layer and tested.
6. **Extensible on a fixed recipe.** Eleven layers were added the same way, so a twelfth is a known cost of about
   one session.
7. **Portable.** Plain Node with no dependencies beyond `node:sqlite`, files on disk, and pages that work from
   `file://` and on the phone.

---

## 6. Review: strengths, weaknesses and risks

### 6.1 What is strong

- **The model is right-sized.** Layers plus vertical edges plus a reach mask is a small idea that pays for itself
  many times over. It needs no ontology, no graph database and no model; embeddings are optional.
- **The failure behaviour is mature:** carried-forward layers, health checks (freshness, volume, schema,
  distribution, lineage, retention), `doctor --fix`, and atomic writes with a lock. This came from real breakages
  and shows it.
- **The tests are real.** They have known answers on fixtures and include the equality of incremental and full
  builds, the privacy assertions and the page lint.
- **Decisions are recorded.** STK-P111 … P212 explain each choice, including the re-letter of Kérések K → S when
  main's Kisokos took K (STK-P212).

### 6.2 What is weak

| Weakness | Why it matters | What would fix it |
|---|---|---|
| **Built against fixtures** | The heuristics (clustering of asks, "unverified", "unowned", door-less code) were tuned on small or invented data. Several were narrowed after the first sandbox runs (46 → 2, 30 → 5). Real data will need another round. | The first PC build, then one tuning pass per noisy signal |
| **Breadth before depth** | 21 layer slots, 24 pages. Some pages will be visited rarely. | Measure page use (the event log can) and fold rarely used pages into the Viewer's cards |
| **Letter space** | 26 letters, 22 used. The K collision with main happened once already. | A registry check in CI: a new layer letter is refused if main or any open branch uses it |
| **Page weight** | The Viewer is about 3 MB and Érintésnyom about 3 MB in the phone bundle | Level-of-detail data files; the phone loads its planes lazily |
| **Windows-path assumptions** | The cloud sandbox needed path patching (`config.js`, `common.js`, …). A Kapu rebuilt in the cloud got broken Linux paths. | One `roots()` function every module asks, and a cloud mode the tests use |
| **One maintainer's complexity** | 59 modules is a lot for one person to hold. The ARCHITECTURE and LAYERS docs carry it today. | Keep the recipe strict; any new module reaches the graph only through an adapter or a report |
| **Kotlin side checked only by CI** | The ◢ dial and the page list are merged code that could only be compiled in Actions (it failed once on a dropped import, fixed in `dc0b658`). | A local Gradle check on the PC (`Mobile\mobile.cmd`) before the next phone release |

### 6.3 Risks to keep watching

- **Signals becoming noise.** If J fills with low-value warnings, it gets ignored. The rule so far (narrow every new
  signal until it is under about five real hits) should become a written threshold.
- **The gateway's reach growing.** Two editors exist today. Each new one should carry the same four checks (path,
  unchanged hash, own-parser round trip, no R/U/A/C/G) and its own test.
- **The S layer's sensitivity.** The asks are the most private data in the Stack. The rule that their words never
  leave `out/` must survive every new consumer: the phone, the Kapu, any export.

---

## 7. Generic use with databases

The Stack never assumed its sources were Markdown and git. It assumed only three things:
- each source can be read into `{nodes, edges}`;
- things on different sources share **keys** (a path, a commit hash, a decision id, a job code);
- someone can say which relations count as **vertical**.

Any group of databases meets those three.

### 7.1 The mapping

| Stack concept | In a database estate |
|---|---|
| Layer | a system or bounded domain: CRM, ERP, tickets, billing, code host, HR, IoT telemetry |
| Adapter | an extract query or CDC stream per system, turning rows into nodes (entities) and edges (foreign keys, references) |
| Vertical edge | a key shared across systems: a customer id in CRM and billing, an order number in ERP and the warehouse, an issue key in a commit message |
| Pillar | a master-data entity (the golden customer, the product, the site) |
| String | cross-system lineage of one entity: everything any system knows about this customer or order |
| Reach mask | **data completeness**: an order reached in ERP and billing but not in shipping is a stuck order |
| Class | lifecycle stage computed from reach (lead → customer → paying → churned) |
| Signal | a data-quality rule as a node: orphan rows, broken references, stale syncs, a key present in A and absent in B |
| Health | freshness, volume, schema and distribution per source: the standard data-observability pillars, which the Stack already runs |
| Write gateway | a reviewed change set, previewed, hash-checked and applied by the owning system's own API, never a direct cross-system write |

### 7.2 The storage shape

The Stack keeps its graph in JSON plus a SQLite search index. In a database it is three tables and one recursive
query:

```sql
CREATE TABLE layer (code CHAR(1) PRIMARY KEY, name TEXT, ord INT);
CREATE TABLE node  (id TEXT PRIMARY KEY, layer CHAR(1) REFERENCES layer, kind TEXT, title TEXT,
                    t DATE, state TEXT, props JSONB);
CREATE TABLE edge  (a TEXT REFERENCES node, b TEXT REFERENCES node, rel TEXT, w REAL DEFAULT 1,
                    vertical BOOLEAN GENERATED ALWAYS AS (left(a,1) <> left(b,1)) STORED);

-- the string of one seed: vertical edges, two hops, best score per node (here as the plain product of weights)
WITH RECURSIVE s(id, score, depth) AS (
  SELECT :seed, 1.0, 0
  UNION ALL
  SELECT CASE WHEN e.a = s.id THEN e.b ELSE e.a END, s.score * e.w, s.depth + 1
  FROM s JOIN edge e ON (e.a = s.id OR e.b = s.id) AND e.vertical
  WHERE s.depth < 2 AND s.score * e.w >= 0.15)
SELECT n.layer, n.id, max(s.score) AS score
FROM s JOIN node n USING (id) GROUP BY n.layer, n.id ORDER BY n.layer, score DESC;

-- the reach mask: one character per layer, in stack order
SELECT string_agg(CASE WHEN r.layer IS NULL THEN '·' ELSE l.code END, ' ' ORDER BY l.ord)
FROM layer l LEFT JOIN (SELECT DISTINCT n.layer FROM s JOIN node n USING (id)) r ON r.layer = l.code;
```

- In **Postgres**, the same thing runs with Apache AGE if Cypher is wanted.
- In **Neo4j** or **Memgraph**, the layer is a label and the string is a variable-length match.
- In **DuckDB**, the graph can be rebuilt from Parquet extracts on every run, which is what `out/` already is: a
  disposable derived view.

The Stack's own choice, files plus SQLite FTS5, is the right one at its size (thousands of nodes). The table shape
above is the step for hundreds of thousands.

### 7.3 Where it sits among existing tools

- Data catalogs (DataHub, OpenMetadata, Amundsen) and lineage standards (OpenLineage) already hold "tables and jobs
  as a graph".
- Knowledge-graph platforms hold "entities across systems".
- Process mining (Celonis, PM4Py) holds "an entity's path through systems over time"; the Stack's
  directly-follows graph and PrefixSpan are the same family.

What the Stack adds on top is the **layered reading**: the reach mask as a state, and drift as the gap between a
declared status and the measured one. As far as this review knows, none of those tools treats an entity's
cross-layer coverage as its lifecycle state. That is the part worth carrying into a generic product.

### 7.4 What a generic version needs that the Stack does not have yet

- **Identity resolution.** In VRG the keys are exact: paths, hashes, ids. Real estates need fuzzy matching (the
  same customer under two spellings), with the match confidence carried as the edge weight.
- **Scale in the join.** Today's join is in-memory. Beyond about 10⁶ edges it should become a set-based SQL join
  per key type.
- **Access control per layer.** The privacy rules are coded per layer. A generic version needs them as data
  (who may see which layer's titles, which only its counts), in the same way the phone sees byte classes but not
  bytes.
- **An adapter SDK.** The `{ nodes, edges }` contract, plus a declared key list per layer and a declared vertical
  relation set. Everything else (join, strings, signals, pages) is already generic.

---

## 8. Potential applications

| Application | Layers | What the reach mask shows |
|---|---|---|
| **The Data Vault** (personal data) | contacts, files, notes, photos, places, accounts, devices | what you know about a person or a project across every store you keep, and what is held in only one place (the backup risk). The vault's no-network rule (DV-Q20) fits: the Stack works fully offline. |
| **An electrician's business** (VRG's own) | lead, survey, plan, quote, materials, job, invoice, warranty | a job that reached "quote" but not "materials" is stalled. M already holds the job codes, and the money path (Charlotte's) is the natural next set of layers. |
| **A software team** | issues, PRs, deploys, incidents, docs, owners, tests | a feature with code and no test, an incident with no postmortem, a doc no code references. This is the Stack as it is today, for any repo. |
| **Compliance and audit** | rules, controls, evidence, owners, systems | a rule with no control, or a control with no evidence: the string is the audit trail. |
| **Client hand-over** | the delivered plan, the as-built, the devices, the manuals | the job's string, filtered to what the client may see (the privacy rules already split this). |
| **Research and labs** | hypotheses, experiments, data sets, code, papers | an idea that never reached an experiment, or a result with no code that produced it. |

---

## 9. Vectors of further development

1. **Depth over breadth: calibrate on real data.** This comes first. Run every signal on the PC's data, tune each
   to a written noise threshold, and record the numbers in `STATUS.md` as the new baseline.
2. **Strings as first-class saved objects.** Threads are already named strings. Saving any string with its mask
   over time gives a *pulse* per thing (when did its reach last grow?), and a "maturity curve" per pillar.
3. **More editors in the gateway.** The natural next ones are a T item's status, a pillar's owner (W) and a door's
   target (N, writing `vrg-menu.json` through check-start's own validation). Each one follows the four checks.
4. **Live recording.** The step shape is ready for a PostToolUse feed (`data/live/<sid8>.jsonl`). With it,
   Érintésnyom shows a session touching the Stack as it happens, not after.
5. **Semantic layer.** Turn on bge-m3 (Ollama) so search and the S clustering use meaning, not only words, and
   suggest vertical edges that keys miss (proposal-only, never auto-joined).
6. **Link prediction, last.** STK-Q13 A keeps it last. Once real strings exist, a missing vertical edge that many
   similar strings have is a good proposal.
7. **Federation.** The same engine over two repos (the toolset and the Data Vault), with a shared pillar list and
   per-side privacy, so a pillar's string can cross repos without either side's private layers crossing.
8. **The generic engine.** Extract the core (pipeline, join, strings, signals, live, contract, gateway) from the VRG
   adapters into a package with the adapter SDK of §7.4. The VRG Stack becomes its first user.

---

## 10. Next steps, in order

| # | Step | Who / where | Done when |
|---|---|---|---|
| 1 | Merge PR #29 after review | the Founder | main carries the layers; CI green (it is, on `dc0b658`) |
| 2 | On the PC: `node tools/check-start.js`, `node tools/check-catalog.js` | local H: session | both exit 0 |
| 3 | On the PC: `node Stack/stack.js probe --all`, then a full `node Stack/stack.js build` | local | HEALTH.md has no red rows. Every new layer has a node count. |
| 4 | Read DRIFT.md §9–20 and the Jelzéstábla; narrow each noisy signal | the next Stack session | each signal under its threshold, or explained |
| 5 | `node tools/build-hub.js` on the PC (the Kapu's tool list) | local | the Kapu shows the ten new pages |
| 6 | Publish the phone bundle (START → R → T); open each page from the ◢ dial | local + phone | all twelve pages open offline |
| 7 | Write the noise threshold and the layer-letter rule into `Stack/RULES.md`; add the letter check to CI | Stack session | a duplicate layer letter fails CI |
| 8 | Decide the next gateway editor (§9.3) and live recording (§9.4) | the Founder | an STK-Q answered |
| 9 | Decide whether the Data Vault gets its own Stack (§8, §9.7) | the Founder, with the DV line | a DV-Q opened |

---

## 11. Questions this review leaves for the Founder

1. **Depth or the next layer?** This report recommends a calibration session on real data (§10 steps 3–4) before
   any new layer. A different choice changes the order of §9.
2. **Should the Data Vault get a Stack?** A personal-data Stack would be the first test of the engine outside the
   toolset, and the first case for federation (§9.7). It would also be the first time the Stack's privacy rules
   face data more personal than client job codes.
3. **Generic engine: when?** Extracting the core (§9.8) is worth doing only once a second user exists. The Data
   Vault would be that user.
4. **Which pages earn their place?** After a month of use, the event log can show which pages are opened. Fold the
   unused ones into Viewer cards, or keep them all?

---

### Where things are

- The plan: `Stack/research/STRINGS-PLAN.md` (S3–S19).
- The decisions: `Stack/DECISIONS.md` (STK-P111 … P212).
- Mechanics: `Stack/ARCHITECTURE.md`, `Stack/LAYERS.md`, `Stack/README.md`.
- The checks: `Stack/lib/drift.js` and `Stack/lib/signals.js` (DRIFT §9–20).
- Tests: `Stack/test/*.test.js`.
- The phone bundle: `Mobile/stack/publish-stack.js`.
- The PR: [webagoly-work/vrg-toolset#29](https://github.com/webagoly-work/vrg-toolset/pull/29).
