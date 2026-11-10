# VRG Stack: roadmap and dev notes

*v1 built 2026-11-04. **v2 built 2026-11-06** from the research fork (research/TERMS.md) and the answers STK-Q8 … Q17 (DECISIONS.md). The code layout is in ARCHITECTURE.md.*

## v1: done 2026-11-04

- 8 layers + the Codec, read live from their sources, joined by keys (path, commit, session, memory, decision id, GO name), `same`, `alike` and 31 pillars. 1 731 nodes and 10 793 links: 7 121 vertical with evidence, 985 pillar links, 2 687 horizontal. Rebuild takes 2 s.
- `stack.js` (q, node, path, ent, layer, drift, stats) on an FTS5 index with accents folded.
- `stack-search.html`: search in layer rows, node card, context copy for Claude, layer table, pillar table.
- `out/DRIFT.md`: repo state, quiet lines, open decisions, idle features, Globe signals, floating nodes, pillar gaps, failed joins.
- The stack registered on the Features map (k14) and as a DevLog line (`layers`).

## v1.1: small, no design needed

| # | Step | Dev note |
|---|---|---|
| 1.1 | `doc:` column in `features/data.js` | F→G is the thinnest pair (1 link); one doc per feature fixes most of it |
| 1.2 | Questions files for chat-only question sets | OMCT-Q, REA-Q, MW-Q, CH-Q, FLIP-Q live only in memory. One `QUESTIONS.md` per line would make them Q nodes |
| 1.3 | Stack line in `MORNING.md` (if STK-Q3 = A) | `build.js --quiet`, then read DRIFT §2 and §4 |
| 1.4 | ~~CLAUDE.md pointer~~ done 2026-11-06 | one line in root `CLAUDE.md` + in the DevLog session-brief template |
| 1.5 | Pillar candidates | the build lists title-word clusters that span ≥ 3 layers and have no pillar; confirmed ones go into `entities.js` by hand |
| 1.6 | Fixture test | a tiny fake source set with known joins, so a parser change cannot silently drop links |

## v2: the machinery: built 2026-11-06 except where marked

| # | State 2026-11-06 |
|---|---|
| 1.0 keep recordings | ✅ cleanupPeriodDays 3650 + archive in _admin/recordings |
| 2.0 recorder | ✅ lib/record.js, 179 sessions |
| 2.1 event log (bitemporal) | ✅ data/events.jsonl |
| 2.2 daily snapshot | ✅ data/snapshots |
| 2.3 MCP server | ✅ built, registered at user scope 2026-11-06 |
| 2.4 Futás layer | ✅ layer U |
| 2.5 session hooks | ✅ 2026-11-10 `hook.js`: SessionStart prints the stamp + L0; Stop appends each turn's touched nodes to `data/live` (shown in the Futásnapló). Registered in the main checkout's `.claude/settings.local.json` |
| 2.6 semantic search | ◐ hybrid search + RRF built; bge-m3 off until Ollama is installed |
| 2.7 write-back with approval | ✗ next (Döntésnapló) |
| 2.8 imports in Code | ✗ |
| 2.9 more layers | ✗ |
| 2.10 observability | ✅ HEALTH.md + doctor |
| 2.11 communities + rank | ✅ Louvain + PageRank |
| 3.2 replay page | ✅ replay.html (function only) |
| 3.3 neural view | ◐ activation runs in the replay; the stacked visual is a design session |
| 3.4 pattern recognition | ✅ PATTERNS.md (DFG + PrefixSpan) |
| 3.5 self-maintenance | ◐ PROPOSALS.md (propose-only); the Divergence-ring hand-over is next |

The original v2 plan, kept for its dev notes:

| # | Step | Dev note |
|---|---|---|
| 2.1 | **Event log** `out/events.jsonl` | each build diffs against the last `stack.json`: node added / removed / state changed / link added. Append only. This underlies replay, "since yesterday", activation and pattern finding |
| 2.2 | **Daily snapshot** | keep `stack.json.gz` per day (small), so the stack can be replayed |
| 2.3 | **MCP server `vrg-stack`** | stdio, same functions as stack.js; register in user settings; every session can ask without being told how |
| 2.4 | **Futás layer** (runtime + usage) | from transcripts: per session, the tool calls and which files and nodes they touched; per day, sessions, prompts and token estimates; servers and ports from `vrg-menu.json`; scheduled runs |
| 2.5 | **Session hooks** | SessionStart → print L0; Stop → append "nodes touched" to Futás; both cheap and read-only |
| 2.6 | **Semantic search** | a second index of embeddings (local model, or API with the Founder's OK on cost) next to FTS5; the query merges both |
| 2.7 | **Write-back with approval** | Döntésnapló answers go through one tool that appends a dated answer line into the DECISIONS file; shown as a diff first; never silent |
| 2.8 | **Imports in Code** | require/import/script-src graph per file, so `path` and impact analysis reach below folders |
| 2.9 | Munkák · Eszközök · Látvány · Külső · Szereplők layers | one adapter each; order from STK-Q5 |

## v3: the visual stack (design session first; the look is redone in v2 design anyway)

| # | Step | Dev note |
|---|---|---|
| 3.1 | **Stacked view** | isometric planes, one per layer, each laid out in its own natural order (time / hierarchy / tree); vertical links drawn only for the selection and its pillar, or the picture drowns (8 000+ vertical links) |
| 3.2 | **Missing layer pages** | Döntésnapló, Commit-pixel, Vonaltérkép, Vezérlőterem, Lineage river (LAYERS.md §1) |
| 3.3 | **Neural view** | needs 2.1 + 2.4: replay the event log; nodes light up when an agent touches them, links thicken with use, unused ones fade |
| 3.4 | **Pattern recognition** | frequent paths across sessions (question → line → brief → file) become suggested shortcuts: a brief, a pillar, a codec line |
| 3.5 | **Self-maintenance** | the drift report proposes fixes as cards (Divergence ring); the Founder accepts or ignores, and nothing is applied silently |

## Next, in order

1. **Install bge-m3** (Founder: install Ollama, then ollama pull bge-m3), then write the 30-query Hungarian test set and compare the words-only and words + meaning results.
2. ~~Register the MCP server~~ done 2026-11-06. The CLAUDE.md pointer (1.4) is done too (2026-11-06): root CLAUDE.md section + DevLog brief rule.
3. **Döntésnapló** (STK-Q4 A): the decision inbox, using 2.7 write-back with a diff shown first.
4. **Proposals → Divergence ring:** proposals.json cards become ring notes (enter / dev note / ignore).
5. **Live feed:** a PostToolUse hook writes steps into data/live; the replay page shows the running session.
6. **Design session:** the stacked isometric view and the replay look (Mélyvíz), then link prediction (STK-Q13 step 3).

## Its own sessions (not this line)

- **Napút / árnyék** (STK-Q15 A): solstice shadow + façade sun study for BRIDGE STD-009 and the façade-bearing question; SunCalc (BSD) + Planner geometry; avoid Ladybug.

- **Research terms (fork, opened 2026-11-04):** asks the Founder for terms, then builds the vocabulary and reading list that v2/v3 will use.
- **VRG Desktop as an overlay OS (proposed):** the full functions roadmap with linked context briefs, for an overnight SecAcc batch. Function only; design comes later. Its seed is this stack: the Dashboard reads F, and "send Claude a node cluster" is `stack.js` plus the context copy.
