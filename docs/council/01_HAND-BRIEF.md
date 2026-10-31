# The Hand's brief

*Bernard to the Founder, 2026-10-31. Read from the repo at `1d98a31`, the GO files, the 2026-10-30 audit, the DNA session and the Claude Code docs for
v2.1.312. Findings are from this reading; proposals are marked as such.*

*Revised the same day: the seats are now Delos HQ and the Park, and agents are called by persona (`ROSTER.md`). Role ids below map as `wk-gate` = Armistice, `wk-scribe` = Clementine. §2 is done: the briefs were refreshed, the six priority ones written, and `tools/brief-state.js` now keeps them current.*

## 0. The short version

- **You already run a proto-Council.** The second-account drawing kit is a contractor model, GO files are mission orders, `vrg-piacmero` is a real
  specialist, and Kódváros already watches agents. What is missing is a formal chain, a budget gate and a record.
- **The briefs are the weakest part of the set today.** All 25 predate the 27–30 October re-root and housekeeping, several now give wrong paths, and
  the newest work has no brief at all.
- **Your scarcest resource is the Pro plan's 5-hour window, not model intelligence.** Every design choice below follows from that: scripts before
  models, thin coordinator, cheap tiers only for packages a gate can fail.
- **A persona adds no capability.** What makes an agent an expert is its scope, its tools, its context and how it is checked. The face is for you, and
  that is a legitimate reason to have one, but it is not where the value lies.
- **Built today, uncommitted:** local search, the stand-in generator, the budget gate, the charter, DNA v2 and 12 agent drafts. **Nothing is installed.**

## 1. What ran differently, and what to keep

| What happened | Evidence | Lesson for the set |
|---|---|---|
| **Second-account hand-off** | `_handoff/objart-V8`: spec, catalogue, `check.js`, `return/` | The best contractor precedent you have: no shared context, machine-checked return |
| **First real subagent** | `vrg-piacmero`: one source in the Kit, `install.js --check` finds drift | Copy this: scoped tools, fixed report, single source. It has no `model`, so it inherits Opus; it should say `sonnet` |
| **Constraint-first WPs** | `docs/mobile/CLOUD.md`: what the cloud cannot run shapes each WP | Each environment needs its own brief. "Telefonon ellenőrizni" lists keep a WP BETA until a person checks |
| **Read-only pass, then merge gate** | GO TNT: survey, register, phases, stops at ⏸, "merge only when GO MAIN is done" | A gate belongs in the mission order |
| **Audit, then one consolidation** | Audit 2026-10-30, seven answers, GO HK | Work scatters without an owner. This is the Hand's reason to exist |
| **Cheap-builder loop dropped** | BRIDGE Stack, 2026-10-07: "I need high value work" | Construction work needs an eligibility test (charter §6) |
| **Deep research as a pipeline** | `docs/research/reports` + numbered `research_notes` | Keep the notes outside the search index; they are huge |
| **Kódváros as an observer** | Hooks in `settings.local.json`, `agents-poll.js`, `CodeCity/mcp.js`, `23-agents.js` | **The "face" already has a body**: agents can appear in the city |
| **Playbooks** | ServiceKit: 12 playbooks, steps of kind check / change / manual, with `risk` | The exact model for agent workflows: checks run alone, changes ask |
| **A guard hook** | OTG kit `hooks/guard.ps1`, manifest check, `/checkup`, `/wrapup` | You have already built a gate and session commands once |
| **Phone capture** | `mobile-log` branch, one line per note | An inbox the Hand can read each morning |
| **Safety stop mid-job** | GO HK fork: a safety check blocked OneDrive on the web | Plan for a blocked step: leave the state clean and a next step |
| **Wrong starting folder** | Sessions started in `C:\Windows\system32` and the npm folder, then could not read the repo | Start sessions from START, not from wherever the app last was |

## 2. The 25 briefs today

Dated 22 October, except `calc-general` (25th). What is now wrong:

| Brief | Says | Now |
|---|---|---|
| `launchers` | registry in `Planner/START.cmd` | `launcher/vrg-menu.json`; START only forwards |
| `planner` | three checkouts, `GO-R1018` | one checkout; GO PLANNER |
| `repo` | `wt-planner-stack`, `H:\_desktop`, START as the door | no such worktree; old path dead |
| `kapu` | built on `secacc` in a parked folder | on `main` |
| `board-console`, `client-look`, `media-wall`, `planner-cyd`, `research` | "only uncommitted" | committed in GO HK |
| `SESSIONS` | lists R1010, FRAME, V2, ADAT, R1018, STRICT | all archived; the live set is MAIN, PLANNER, ROUTE, CLA, HUB, CITY, MOBILE, OPENWRT |

**The cause is structural:** briefs are hand-written snapshots with no freshness check. `tools/check-hub.js` checks their format, not their truth.

**Proposal:** split each brief into a stable part and a generated "current state" part fed from `git log`, `vrg-menu.json` and GO files, and give
each one a source fingerprint like the stand-ins. Then `wk-gate` can name the stale ones.

## 3. Brief candidates

### Programs with no brief

| Priority | Brief | Why now |
|---|---|---|
| **1** | `workflow-kit` | The core of the money path, live, and only in its own README |
| **1** | `jobs` | The register and 19 past jobs |
| **1** | `mobile` | In daily work, with its last commit today |
| **1** | `kodvaros` | 438 file changes since 15 Oct, and absent from the Kapu map |
| **1** | `routing` | Wiring, router, Topology View: a line of work, not one program |
| **1** | `backups` | Backup, capsule, what is protected and what is not |
| 2 | `servicekit`, `servicekit-cyd`, `servicekit-phone` | Merged 30 Oct, not in the START menu or the Kapu map |
| 2 | `doc-rules` | Live rule set |
| 2 | `visual-base`, `esp-lab`, `otg-kit` | Live and undocumented for agents |
| 2 | `planner-mcp`, `melyviz`, `openwrt` | Have packs, no entry page |
| 3 | `din-rail`, `omct`, `onedrive` | Ideas; a brief when work starts |

The 19 `v2` slots in the map (Dispatch, Lobby, …) need nothing until they are built.

**The Kapu map itself is behind:** `hub-seed.json` has no Mobile, Kódváros, ServiceKit or OpenWrt. The Kapu shows the old world.

### New kinds of brief (same size, different axis)

| Type | Examples | What it answers |
|---|---|---|
| **Environment** | `env-local`, `env-cloud`, `env-account-b`, `env-worktree`, `env-phone`, `env-stick` | What can run here, what cannot, what to do about it |
| **Data contract** | `data-vplan`, `data-offer`, `data-hub-seed`, `data-inventory`, `data-relay` | One format, its fields, who reads it, how it migrates |
| **Job type** | `job-survey`, `job-tervezet`, `job-arajanlat`, `job-potmunka`, `job-service-call` | The steps of a kind of work, not of a program |
| **Trap card** | `traps-windows`, `traps-powershell5`, `traps-cmd`, `traps-android-build` | Short lists learned the hard way, now buried in `CLAUDE.md` |
| **Role** | seats and contractors | Already drafted |

## 4. What to add, by scope

### Claude Code settings and habits

| Item | Use | Verdict |
|---|---|---|
| `/usage`, then `f`; per-model and per-subagent attribution, `d`/`w` | Your real budget report | **Now, weekly** |
| `/insights` | HTML report on your own friction, from up to 200 sessions. Costs usage | **Now, monthly** |
| `/context` | What fills a session | Now |
| `claude agents --json --all` | State of every session; Kódváros already polls it | Have |
| `claude --agent bernard` | Runs the Hand as the main session | After Q4 |
| `model`, `effort`, `maxTurns`, `omitClaudeMd`, `memory`, `color`, `skills` | Agent frontmatter; `omitClaudeMd` saves every worker the 230-line `CLAUDE.md` | In the drafts |
| `.claude/workflows/` + a `+500k` budget directive | Saved construction lines with a hard ceiling | Draft line written |
| `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` | Default 20; set 3 on Pro | Now |
| `subagentPromptCacheTtl` | Default 5 min for some subagents; 1 h may help long lines | Test |
| OpenTelemetry export | Token data into Kódváros; research already mapped it | Later |
| Status line | Context + plan use always visible | Now |
| Agent teams | Experimental, about 7× tokens in plan mode, not resumable | **Skip** on Pro |

**Quick wins, measured in this session:** tools 36 000, MCP 21 000 and skills 10 000 tokens, so **67 000 tokens of overhead before you say anything**.

- 13 MCP connectors fail at every start. Disconnect the ones you do not use (Q7).
- Plugins you may not use add skills to every session: Bright Data, incident.io, TinyFish, 8b.
- `CLAUDE.md` is 230 lines; the docs suggest under 200. Launcher and backup detail can move to path-scoped rules or a skill.
- `autoCompactWindow: 500000` lets a session grow large, and every turn re-reads all of it. That is deliberate for big jobs, but expensive as a default.

### Skills to write (procedures that load only when needed)

`vrg-session-close`, `vrg-wp-build`, `vrg-decision-pack`, `vrg-tervezet-rules`, `vrg-legible-sheets`, `vrg-go-brief`. Each replaces text now repeated in memory notes and GO files. There are **no custom VRG skills yet**.

### Tools and MCP

| Item | State | Verdict |
|---|---|---|
| `tools/vrg-ctx.js` | **Built**: 1 170 files, 8 734 chunks, 1.9 s, 26 MB, zero dependencies | Use now. An MCP wrapper can follow `CodeCity/mcp.js` |
| `CodeCity/mcp.js` | Exists | Register for seat IV |
| Planner MCP | Pack `docs/mcp`, WP-MCP-0…3 | **High value for seat II**; an agent could query a plan rather than parse it |
| CoreRef as MCP | Data exists, no reader UI yet | Later, for BRIDGE work |
| Kit as tools | `market.js`, funnel | A skill first, MCP if used often |
| Serena (symbols via language servers) | External | Fits Kotlin in Mobile. Little gain on the Planner's one shared scope; `standin.js` covers that |
| Repomix (repo to one file) | External | Skip for your own repo; useful for outside repos |
| Desktop Commander plugin | Installed | Overlaps Bash and Read; candidate to disable |

### Knowledge and databases

| Base | State | Next |
|---|---|---|
| `arkatalogus.csv`, `munkadij-tetelek.csv`, `osszegek.csv` | Extracted, labour partial | GO TNT T3 |
| CoreRef | 11 MB SQLite | Reader or MCP |
| SMARTHOME-DB-001 | Built | Query tool |
| ServiceKit Súgó, 330 commands, 70-tool catalog | Ready-made offline data | Index with `vrg-ctx` |
| **Decision register** | Scattered across `*-Q-*.json` and `DECISIONS.md` | **New:** one index, so nobody re-asks |
| **Trap register** | In `CLAUDE.md`, `HARDSHIPS_LOG`, memory | **New** |
| Standards | Referenced, not held | Licensed texts stay outside the repo; hold **clause references**, not copies |

### Calculation cards

Tested functions that agents must call instead of doing the maths in their heads, the same rule `vrg-piacmero` follows. A card holds the formula, inputs, units, limit source, test vectors and owner. **Check first what the Planner's sizing code already has.** Limits are taken from the standard you hold, never from a model.

| Domain | Cards |
|---|---|
| Power | Voltage drop `ΔU = 2·I·L·cosφ / (κ·A)` (√3 for three-phase) · `Ib ≤ In ≤ Iz` · fault loop `Zs·Ia ≤ U0` · adiabatic `k²S² ≥ I²t` · diversity · selectivity · conduit fill |
| Low voltage | PoE budget · 24 V drop · LED strip feed length and driver size · speaker loop ≤ 0.4 Ω (STD-007) |
| Light | Lumen method `E = Φ·UF·MF / A` · perceptual dimming `duty = s³` (STD-002) · chord error |
| Graphs | Shortest path, Steiner tree for shared routes · **articulation points**: this is how the key room in the CLA plan was found · min-cut for failure domains |
| RF | Path loss, duty cycle (868 MHz 1 % = 36 s/h) · presence log-odds fusion (STD-003) |
| Money | Labour bands · margin · deposit · `P40/P50` · structure scale · tax basis check |
| Agents | Expected cost per tier (charter §6) · Reciprocal Rank Fusion `Σ 1/(k+rank)` for hybrid search |

### Topological reference diagrams

Generated from data, never hand-drawn, or they rot like the briefs. Use `labels.js` for legibility.

| Diagram | Generated from |
|---|---|
| Program connectome | seed + menu + stand-ins |
| Money path: sketch → wireways → quantities → price → documents | audit + Kit |
| Session lifecycle: GO → work → gate → close → backup | GO MAIN |
| Chain of command with budget classes | charter |
| Data-contract graph: who reads which format | data briefs |
| BRIDGE layers and the six-axis topology | infobase |
| Power tree, network, room portal graph per job | Planner, de-identified |
| Failure-domain map | standards |

### Harnesses

| Harness | Purpose | State |
|---|---|---|
| `wk-gate` plus checks | One command for all gates | Draft |
| **Usage report** | `/usage` + ledger + `gate.log` into a weekly page | New; the Kapu or Kódváros could host it |
| **Workflow creation** | The construction line as a template | Draft |
| **Blind test** | Does a stand-in help? | Designed, DNA §6 |
| **Agent evals** | Fixed tasks with known answers, rerun after changing an agent | New; golden 70/70 and CLANV4 28/28 are the model |
| **Replay** | Rerun an old WP on a cheaper tier to measure it | New; this fills the failure-rate column |
| **Morning report** | Plan limits, unmerged branches, untracked work, `mobile-log` | New; `/morning` skill can be adapted |

## 5. Service Kit findings: local context

**What the kit offers:**

| Part | Use for sessions |
|---|---|
| **Kit Shell** | Sets `CLAUDE_CONFIG_DIR` inside the kit: **a clean separate Claude environment** with its own Git, Node, Python and settings, apart from your standard one |
| Sandboxie-Plus, Windows Sandbox | Run an untrusted repo or tool in a box. `exchange\` is the writable channel |
| Everything | Instant file search across the machine; useful with its CLI |
| Python 3.12 + `envs\` | Home for any Python tool, kept off the system |
| Súgó, Parancsok, `catalog.json` | Three ready offline knowledge sets |
| Playbook engine | Step kinds, risk levels, logging: the model for agent playbooks |
| `docs\` folder | Datasheets and wiring diagrams, ready to index |
| KeePassXC | Client passwords stay here, never in context |

**What it lacks:** the catalog has no RAG tool, no local model and no ripgrep. So this part needed building.

**The local RAG ladder.** Climb only when the rung below fails. Your PC has 16 GB RAM, an i5-10400F and a GTX 1050 Ti, which rules out useful local chat models but not embeddings.

| Rung | What | Cost | State |
|---|---|---|---|
| 1 | **BM25 over tracked files:** `node tools/vrg-ctx.js q "..."` | Zero | **Built, working** |
| 2 | Add `docs\`, datasheets, Súgó as separate indexes | Zero | Next |
| 3 | PDFs and Office files to text first (the Inventory tools already do part of this) | Zero | Next |
| 4 | Hybrid search: FTS5 + `sqlite-vec` + a small CPU embedding model, merged with Reciprocal Rank Fusion | CPU minutes | Only if a real query fails |
| 5 | `qmd`, a ready local Markdown search with BM25, vectors and reranking | Install | Alternative to 4; check licence and pin it |
| 6 | Local LLM through Ollama for classification | Slow on this GPU | **Skip for now**; the kit's env vars already route model folders off C: |

**Limits of rung 1:** it finds words, not meaning; compound Hungarian words split badly, so "csatorna" misses "vezetékcsatorna". Queries may need the exact stem. That is the honest case for rung 4.

Client data stays out of the shared index by design, because only Git-tracked files go in. A job index should be a separate database in `H:\VRG\Full\jobs`.

## 6. What an agent really is

### The honest definition

**An agent is a model running in a loop with tools, inside a harness that decides what it can see and do.** It looks at the state, picks an action, the harness runs it, the result comes back, and it repeats until done. A chatbot answers; an agent acts and checks.

```text
                 ┌─────────────── HARNESS ───────────────────┐
 goal ─────────► │  CONTEXT  system prompt · rules · memory  │
                 │           files · tool results · history  │
                 │     │                                     │
                 │     ▼                                     │
                 │   MODEL  decides the next step            │
                 │     │                                     │
                 │     ▼                                     │
                 │  POLICY  permissions · hooks · budget ────┼─► refuse
                 │     │                                     │
                 │     ▼                                     │
                 │   TOOLS  read · edit · run · search · web │
                 │     │                                     │
                 │     └── result back to CONTEXT ───────────┼─► done: report
                 └───────────────────────────────────────────┘
```

### Its parts

| Organ | What it is | Yours today |
|---|---|---|
| **Model** | The engine; tier sets cost and judgement | Opus, Sonnet, Haiku; Fable to confirm on Pro |
| **Identity** | System prompt: role, rules, output shape | `vrg-piacmero` body |
| **Tools** | What it can do | Allowlists |
| **Permissions** | What it may do | Modes, deny rules |
| **Context** | What it can see now: the real scarce resource | CLAUDE.md, briefs, stand-ins |
| **Working memory** | The conversation; dies with the agent | Session |
| **Episodic memory** | What happened | Logs, ledger, transcripts |
| **Semantic memory** | Facts | Auto-memory, DBs, stand-ins |
| **Procedural memory** | How to do things | Skills, playbooks, WPs |
| **Retrieval** | Fetches what is not in context | `vrg-ctx` |
| **Planner** | Breaks down work | Seats; build packs |
| **Verifier** | Proves the result | Tests, golden sets, gates |
| **Orchestration** | Who runs when | Subagents, workflows |
| **Observability** | What it did and cost | Kódváros, `/usage`, hooks |

### What a Claude Code subagent literally is

A Markdown file: YAML frontmatter plus a system prompt. It starts cold, with its own context and no memory of yours, does the job, and returns **one message**. Nothing more persists unless written down. Its "expertise" is whatever you loaded and allowed. It can be resumed with `SendMessage`, keeping its history.

| Form | Context | Talks to | Cost | Use |
|---|---|---|---|---|
| Subagent | Own, cold | Its caller | Low | Focused jobs |
| Fork | Copy of yours | Back to you | Medium | A side job needing this conversation |
| Workflow | One per step | Script | Sum of steps | Repeatable lines |
| Session | Own, long | You | High | Steered work |
| Agent team | One each | Each other | Very high | Debate |

### The patterns that work

From most to least useful for you: **routing** (send to the right specialist) · **prompt chaining** (fixed steps with gates) · **orchestrator–workers** · **evaluator–optimizer** (builder plus independent verifier) · **parallel fan-out** (only for independent work).

### How agents fail

| Failure | Cause | Guard here |
|---|---|---|
| Context rot | A long session goes vague | Thin Hand, state in files |
| False success | Reports done without proof | Gate, independent verifier |
| Scope creep | "Improves" nearby code | "Only what the WP names" |
| Injection | Instructions hidden in documents or web pages | Text is data. **Never combine private data, outside content and outbound access in one agent** |
| Runaway cost | Fan-out, retries | `maxTurns`, gate, budget class |
| Telephone game | Facts degrade through layers | Reports point to files; findings are quoted |
| Drift | Copies differ | One source, `--check` |
| Persona over substance | Sounds expert, knows nothing | Scope and evals decide, not tone |

## 7. The rest of the Lego set

| # | Type | Grain | State | Count now → target |
|---|---|---|---|---|
| 1 | Mission order (GO) | line of work | Strong | 8 |
| 2 | Brief | program | **Stale** | 25 → 40 |
| 3 | Build pack / WP | feature | Strong | many |
| 4 | Decision pack | question | Strong | many |
| 5 | Agent | role | New | 1 → 13 |
| 6 | Stand-in | program | **Prototype** | 1 authored → 8 |
| 7 | Blueprint | feature | **Prototype** | 1 → 15 |
| 8 | Genome card | program | Designed | 0 → 55 |
| 9 | **Skill** | procedure | **Missing** | 0 → 6 |
| 10 | **Hook** | rule | Thin | 1 → 3 |
| 11 | **Saved workflow** | process | **Missing** | 0 → 3 |
| 12 | MCP server | service | Thin | 1 → 3 |
| 13 | Checker | fact | Strong | 6+ |
| 14 | **Calc card** | formula | **Missing** | 0 → 25 |
| 15 | Data pack | dataset | Good | 6 |
| 16 | **Reference diagram** | topology | Partial | 8 |
| 17 | Golden set | behaviour | Strong for code | keep |
| 18 | **Agent eval** | agent | **Missing** | 1 per tier |
| 19 | Hand-off kit | contract | Proven once | template |
| 20 | **Playbook** | field routine | In ServiceKit only | 5 |
| 21 | **Output contract** | report shape | Scattered | 6 |
| 22 | Style pack | look and voice | Good: Mélyvíz, Title Card, HU/EN | 3 |
| 23 | **Ledger / permits** | budget | **Prototype** | 1 |
| 24 | **After-action note** | lesson | Scattered | template |
| 25 | **Environment profile** | where it runs | Partial | 6 |
| 26 | **Fixture project** | test world | Partial | 1 anonymised plan |
| 27 | Policy pack | safety rules | In OTG kit | 1 |

**The biggest gaps:** skills, saved workflows, calc cards and agent evals. Everything else exists at least in embryo.

**Set granularity rule:** each type should have one fixed template, one size limit, one checker and one owner. That is what made the briefs work as a set, and the only thing they lacked was freshness.

## 8. Through three professional eyes

### As an electrician

- **Liability stays human.** No agent signs, measures or declares compliance. Build this in as a rule, as the charter does. BRIDGE's A08 note already says the HU sign-off needs a qualified person.
- **The site is offline and gloved.** The agent's output there is a checklist, a QR code or a Hungarian voice note. A field-ready job pack on the phone matters more than a clever session.
- **The real data is on the phone.** Site photos and video were only counted in TNT. Tagging a photo to a job and a wall is high-value, cheap worker work.
- **Survey to Tervezet is the money moment.** If the Council shortens one thing, it should be that. TNT shows the line: primer, plan, material sheet, quote, extra work, site log, invoice. The Kit covers the middle; the two ends are manual.
- **Variation orders lose money quietly.** A site-log-to-pótmunka flow would likely pay back faster than any Planner feature. This is my judgement, not a measured result.

### As an admin

- **Immediate items from the TNT pass:** a key generator and an activator sit in a shared folder, and VS Code data with possible sign-in state sits there too. These matter more than any agent. The DM job ledger stays as archived material with a note, and the tax wording is covered by the Kit's addendum (Founder, 2026-10-31).
- **Personal data:** the job register, photos and client documents are subject to data-protection duties, and sending them to any model is a decision. Set it once, in writing, with retention periods. I can draft it; a lawyer should check it.
- **Backups are of commits only.** Agents make it easier to leave a large uncommitted pile, which already happened (201 files on 30 Oct). `wk-scribe` exists for this reason.
- **Bus factor.** Today the system is you plus a colleague not yet invited. A Council that only you can run is a single point of failure; `KOLLEGA-INDULAS.md` and briefs are how it survives.
- **Two accounts.** Use the second account for hand-off work, not to get round limits. Check what your plan's terms allow.

### As a programmer

- **Tests are the Council's real authority.** A strong test suite lets cheap builders work. Where none exists (UI feel, Mobile on the device), keep a stronger model and a person in the loop.
- **Don't build a framework.** Thirteen agents and a gate is already a lot for one person. The services note says it well: three services and you have "quietly taken a second job". The same applies here. Pilot one line first.
- **One writer.** `isolation: worktree` conflicts with your one-checkout rule, and `node_modules` exists only in the main checkout. Keep builders serial.
- **Prompts are code.** Version agents, test them with evals, retire them. `install.js --check` is the right idea.
- **Measure before optimising.** You have no failure rates yet, so the tier table is an informed guess. The ledger fixes that after ten packages.
- **An uncomfortable note on myself:** this session ended at 79 % of a 500 000-token context, and the round took the 5-hour window from 17 % to 30 %. A real Hand should not work this way. This job justified it once; routine rounds must not.

## 9. Roadmap

| Phase | What | Stop for |
|---|---|---|
| **0** Decide | Answer `DECISIONS.md` | Founder |
| **1** Pilot | Install Hand + `wk-gate` + `wk-scribe`; gate in log-only mode for a week | Check `gate.log` |
| **2** First line | One real package through the line, small and checkable | First-pass rate |
| **3** Seats | Install three seats; one real job each | Did it beat a plain session? |
| **4** DNA | After the GO TNT merge: D1–D7, including the blind test | Blind-test result |
| **5** Foundations | Skills, calc cards, evals, usage report | Ten-package review |
| **6** Faces | Council in Kódváros and the Kapu | Founder |

Do the immediate admin items from §8 first; none of them needs an agent.

## Sources

Read 2026-10-31.

- [Claude Code: subagents](https://code.claude.com/docs/en/sub-agents) · [hooks](https://code.claude.com/docs/en/hooks) · [agent teams](https://code.claude.com/docs/en/agent-teams) · [costs](https://code.claude.com/docs/en/costs)
- [qmd notes](https://jc-aiwiki.pages.dev/claude-ai/qmd-hybrid-search) (third-party summary of the v2.1.0 README; confirm against the repo) · [raggle](https://github.com/mhingston/raggle) · [mdvault](https://pypi.org/project/mdvault/0.1.0/)
- [Serena](https://github.com/oraios/Serena) · [code-intelligence MCP comparison](https://developertoolkit.ai/en/ecosystem/mcp/code-intelligence-mcp/)
- The agent patterns in §6 follow Anthropic's published "Building effective agents" guidance, from my background knowledge rather than a check today.
