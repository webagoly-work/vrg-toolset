# VRG Stack: architecture (v2, 2026-11-06)

*How the code is built and why, for whoever extends it next.*

## 1. Three folders, three rules

| Folder | What | Rule |
|---|---|---|
| **sources** | the maps (`notes/features`, `idea-timeline`, `devlog`, `devrep`), the repo, memory, transcripts | read, never written. A problem with a source becomes a line in `out/HEALTH.md` for a person. |
| **`out/`** | everything derived: graph, index, codec, reports, recordings, replay data | safe to delete; `stack.js build` makes it again from the sources |
| **`data/`** | history: `events.jsonl` (event log), `metrics.jsonl` (metrics per build), `snapshots/<day>.json.gz` | append-only. It cannot be rebuilt, so it is validated, a torn last line is repaired (the cut part is kept in `.torn`), and nothing else ever rewrites it |

There is a fourth place, `H:/VRG/Full/_admin/recordings`: a copy of every Claude Code transcript and file-history checkpoint (STK-Q8 = A). The build refreshes it incrementally and never deletes from it. That makes it the recorder's source, so a transcript that Claude Code cleans up still replays.

Every write goes through `lib/fsx.js`:
- `writeAtomic` writes a `.tmp` file and renames it. It retries when Windows holds a fresh file, and copies as a last resort.
- `withLock` allows one build at a time. A lock older than 10 minutes is taken over.

## 2. The build: guarded stages

`lib/pipeline.js` runs these in order. Each stage runs under `health.collector().stage()`.

```
archive ─► layers F I Q L A R C G ─► join ─► record ─► U · Futás ─► pillars
   ─► validate ─► analytics (PageRank, Louvain, metrics, PARA, actor)
   ─► write graph ─► events + snapshot ─► search index (+ bge-m3 vectors)
   ─► codec · drift · patterns · replay · connectome · status · proposals ─► HEALTH.md
```

| A stage that … | does this when it fails |
|---|---|
| reads a **layer** | is **carried forward**: the last good build's nodes for that layer are reused, marked `stale`. One broken map never empties its layer. |
| is **optional** (archive, embeddings, drift, patterns, replay, connectome) | is **skipped**, and the build goes on |
| builds the **search index** | keeps the last good index |
| is **required** (git facts, join) | stops the build; `out/` keeps the last good files and HEALTH.md says why |

**Health checks** are written to `out/HEALTH.md` and `health.json` on every build, the "data observability" pillars:
- **freshness:** a source changed after what the stack shows
- **volume:** a layer lost more than 30 % of its nodes
- **schema:** invalid nodes are dropped, a loose date is kept, a relation not in the registry is flagged
- **distribution:** the vertical share of links moved more than 25 %
- **lineage:** dangling links, unresolved mentions
- **retention:** `cleanupPeriodDays` is checked (0 is a failure, because it stops transcripts being written)

**Heal on demand:**
- `stack.js doctor [--fix]` checks the graph, outputs, index integrity (`PRAGMA quick_check`), recordings, history logs, the lock and retention. With `--fix` it repairs the logs, clears a stale lock and rebuilds whatever is derived.
- `lib/query.js` heals on read: when `out/stack.json` is missing or has an older schema, the first question triggers one build.
- The MCP server never builds (`readOnly()`), so a session cannot start a build by accident.

**Schema version:** `config.schema` (now 2). Bump it when the shape of `stack.json` changes; old outputs are then rebuilt automatically. The recorder has its own `VERSION` in `lib/record.js`, and bumping it re-records every session.

## 3. Where each feature lives

| Feature | Module | Choice |
|---|---|---|
| Keep transcripts | `lib/archive.js`, `cleanupPeriodDays: 3650` in user settings | STK-Q8 A |
| Recorder (after the fact) | `lib/record.js` → `out/recordings/<sid8>.jsonl` + `index.json` | STK-Q9 A |
| Step shape (OpenTelemetry span names) | `schema/shapes.js` `checkStep` | §0 |
| Futás layer U (runs, days, `touched` weights) | `lib/futas.js` | roadmap 2.4 |
| Replay page | `replay.html` + `lib/replay.js` → `out/replay/*.js` | STK-Q10 A |
| Connectome page (Konnektóm) | `connectome.html` + `lib/connectome.js` → `out/connectome-data.js`; `stack.js connectome`; serve.js `/api/connectome`, `/api/build` | CN-Q1…Q5 A (2026-11-07) |
| Holo page (polip ⇄ gömb) | `orb.html`; pathways = `pathways()` in `lib/connectome.js` (scores +4 line, +2 session, +1 run touch, +0.5 pillar) → columns `line`, `line2`, plus `lines`, `lineLinks`, `bundles` in the same data file | HO-Q1…Q6 (2026-11-07) |
| Spreading activation with hub inhibition | `lib/activation.js` (Node and browser) | roadmap 3.3 |
| Event log, bitemporal, snapshots | `lib/events.js` → `data/` | roadmap 2.1, 2.2 |
| Louvain communities (own code) | `lib/louvain.js` | STK-Q11 A |
| Four metrics + PageRank | `lib/metrics.js`; STATUS.md with the previous value | STK-Q14 A |
| Hybrid search: BM25 nodes + heading chunks + bge-m3, RRF k = 60, layer routing, HU↔EN bridge | `lib/search.js`, `lib/store.js`, `lib/embed.js` | STK-Q12 B |
| Contextual chunk headers ("Layer › title › heading › pillars") | `lib/store.js` | proposal 17 |
| Concept-map verbs per link type | `schema/links.js` | STK-Q17 A |
| PARA tags, script/agent label | `lib/enrich.js` | STK-Q16 A, proposal 18 |
| Pattern mining (directly-follows graph + PrefixSpan) | `lib/patterns.js`, `lib/insight.js` → PATTERNS.md | roadmap 3.4 |
| Propose-only helper | `lib/insight.js` → PROPOSALS.md | STK-Q13 A, step 2 |
| Observability + self-repair | `lib/health.js` | STK-Q13 A, step 1 |
| Time-respecting paths | `lib/graph.js` `shortest(…, { time })` | proposal 13 |
| MCP server | `mcp/server.js` | roadmap 2.3 |

**Not built, on purpose:**
- Link prediction: STK-Q13 A puts it last.
- The competence layer: proposal 20 needs its data first.
- The sun study: STK-Q15 A makes it a BRIDGE/Planner line of its own.
- Live hooks: STK-Q9 A records after the fact. The step shape is ready for a live feed.

## 4. Extending it

| To add … | Do this |
|---|---|
| a layer | 1. Write an adapter that returns `{ nodes, edges }`, the way the ones in `lib/layers.js` do.<br>2. Add its row to `lib/meta.js` and its letter to `schema/shapes.js` `LAYER`.<br>3. Register its relations in `schema/links.js`.<br>4. Call it in `pipeline.js` under `hc.stage(…, { fallback: carryForward })`. |
| a report | Write a function in `lib/insight.js` and an optional stage in `pipeline.js`. Reports only read the graph. |
| an MCP tool | Write the function in `lib/query.js` (the CLI and the server share it), then add a line in `TOOLS` and in `callTool`. |
| live recording | A PostToolUse hook appends steps in the `checkStep` shape to `data/live/<sid8>.jsonl`; `record.js` merges them in. No change to Futás or the replay page. |
| embeddings | Install Ollama, then `ollama pull bge-m3` (about 1.2 GB). The next build embeds up to 2 000 nodes and the rest follow on later builds. Search switches to words + meaning by itself. |

## 5. Tests

`..\..\tools\node\node.exe --test test/stack.test.js` runs 16 tests with known answers:
- the metrics, Louvain, PageRank and time-respecting paths
- DFG and PrefixSpan, spreading activation, RRF and routing
- absolute-path extraction (a v1 bug)
- the recorder, on a fixture transcript with a torn line
- the commit join, the event diff, log repair and the build lock
- the schema and verbs, PARA and actor, and the MCP protocol

No test reads a real source or `out/`.
