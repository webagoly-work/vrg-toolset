# The Council — charter of Delos and the Park

*2026-10-31, with the Founder's answers (`DECISIONS.md`). The agents are installed. The budget gate is off (Q5 C).*

Delos is the head office and the Park is the operation. The Board at HQ oversees money, quality and the running of the whole. Heads of Department in the Park design and run things. Shared facilities serve them all.

**The names are internal.** Delos, the Park and every persona name stay inside the team. They never reach a client document, a quote or anything outside.

## 1. Chain of command

```text
FOUNDER · Alapító              sets goals; holds every outward and irreversible decision
   │
BOARD · Igazgatóság            Delos HQ: Bernard, Charlotte, (Stubbs)           Opus
   │                           Bernard, the Hand, is the main session
HEADS · Osztályvezetők         The Park: Arnold, Elsie, (Lee)                   Opus, high effort
   │
CONTRACTORS · Alvállalkozók    own one package or check                         Sonnet
   │
WORKERS · Segédmunkások        one narrow job, then gone                        Haiku, low effort
   │
TOOLS · Szerszámok             tests, gates, search, generators                 no model at all
```

This fits Claude Code's real limit: subagents may nest three layers below the main session, which is exactly head, contractor, worker.

## 2. The seats and the facilities

| Seat | Call | Magyar cím | Post | Division | Domain | Model |
|---|---|---|---|---|---|---|
| I | **Bernard** | Főművezető | Director of Park Operations, the Hand | Control Room (HQ) | The whole: routing, budget, record, GO MAIN, housekeeping | Opus, medium |
| II | **Arnold** | Tervezőmérnök | Head of Design | Design Division (Park) | Planner, wiring, router, Topology View, Views, client preview, job plans | Opus, high |
| III | **Charlotte** | Gazdasági vezető | Executive Director | Finance and Contracts (HQ) | Workflow Kit, market, calculators, Inventory, BuildTree, jobs, TNT feed, document rules | Opus, high |
| IV | **Elsie** | Üzemmérnök | Head of Behaviour Engineering | Behaviour Lab (Park) | BRIDGE, firmware, Kapu, Mobile, Kódváros, ServiceKit, launcher, backups, CoreRef, OpenWrt | Opus, high |
| V | *vacant:* **Stubbs** | Minőségellenőr | Director of QA and Security | QA and Security (HQ) | Independent check: standards, security, quality. Until filled, Theresa serves Bernard | |
| VI | *vacant:* **Lee** | Ügyfélreferens | Head of Narrative | Narrative (Park) | What clients and colleagues see: Title Card, brochure, onboarding, marketing | |

**When a vacant seat fills:**
- **Stubbs:** when work ships to a client without you reviewing every line, or after the second defect that verification missed.
- **Lee:** when client material becomes a steady stream rather than occasional jobs.
- **Split the Behaviour Lab** into BRIDGE and Platform if it takes more than half of Council time for a month.

Bernard owns no product. A coordinator with its own line of work starts favouring it, so the facilities he keeps are the ones that serve everybody.

### Facilities

A facility is shared ground, not a seat. It has a keeper and needs no extra agent.

| Facility | Magyarul | In the show | Here | Keeper |
|---|---|---|---|---|
| **Control Room** | Irányítóterem | Watches the whole Park | `council-gate`, ledger, permits, usage, Kódváros as the screen | Bernard |
| **Manufacturing** | Gyártás | Builds and repairs | The construction line, §6. Felix works here; the ordering Head owns each WP | Bernard schedules |
| **Diagnostics** | Diagnosztika | Tests behaviour | Test suites, `check-*`, `brief-state`, Armistice, Theresa | Bernard, until Stubbs |
| **Cold Storage** | Hűtőraktár | Keeps retired hosts, not running | `docs/go-archive`, `H:\VRG\Backup\archive`, `jobs\_tnt-tukor`, retired agents, archived ledgers such as DM0's. **Read only; noted, never corrected** | Bernard |
| **The Forge** | Adattár | Holds everything ever recorded | `vrg-ctx` index, registers, catalogues, briefs, `jobs\_elozmenyek` | Elsie; job data is Charlotte's |
| **The Cradle** | Bölcső | A backup world that replays the Park | DNA: capsule, stand-ins, blueprints. Moves to `main` only with the GO TNT merge (Q6 B) | Abernathy, under Elsie |

### Contractors and workers

| Call | Magyar cím | Tier | Works in | Job |
|---|---|---|---|---|
| **Felix** | Szerelő | Contractor | Manufacturing | Builds one prepared WP |
| **Theresa** | Ellenőr | Contractor | Diagnostics | Tries to prove a finished change wrong |
| **Akecheta** | Munka-előkészítő | Contractor | Any | Scouts one bounded question, with sources |
| **Abernathy** | Tervtáros | Contractor | The Cradle | Writes stand-ins and blueprints |
| **Logan** (`vrg-piacmero`) | Piacmérő | Contractor | Finance and Contracts | Refreshes market prices; the file keeps its id |
| **Teddy** | Felmérő | Worker | Any | Finds where things are |
| **Armistice** | Műszerész | Worker | Diagnostics | Runs named checks, reports pass or fail |
| **Clementine** | Naplóvezető | Worker | Control Room | Writes the ledger line, lists loose ends |
| **Sylvester** | Anyagkiíró | Worker | Any | Pulls rows from documents by a schema |

## 3. What belongs to the Founder

No agent decides these, and the Hand cannot grant them:

- Push, merge to `main`, publish, send, or anything another person sees.
- Delete, or change sharing on `TNT` or `VRG-Megosztott`.
- Final prices, quotes and any client document.
- Electrical sign-off, measurement records and compliance statements.
- Passwords, tokens, keys and account changes.
- Filling a vacant seat, or changing this charter.

Claude Code enforces part of this: **an approval relayed by an agent is not your approval**. A subagent's message cannot answer a
permission prompt, and auto mode treats a relayed approval as untrusted. The Hand's authority covers budget and routing only.

## 4. Budget classes

Bernard checks `get_usage` at the start of each round and before any G2.

| Class | Examples | Who approves |
|---|---|---|
| **G0 free** | scripts, tests, `vrg-ctx`, gates | nobody |
| **G1 routine** | work inside the agent's tier, reads under its limit | the owning Head |
| **G2 Hand** | tier jump, read over the limit, a contractor starting a workflow, web use by a worker | Bernard, by permit |
| **G3 Founder** | Fable, max effort, agent teams, research sweeps, workflows over five agents, the second account | you |

**Limits, proposed:**

| Reading | Rule |
|---|---|
| 5-hour window at 60 % | no new G2 |
| 5-hour window at 80 % | finish the running package, then stop and hand off in a file |
| Weekly at 70 % | Council sessions only with your go-ahead |
| Hand's context at 40 % | write state to file, then `/clear` |

Read limits per file: worker 60 KB, contractor 200 KB, Head 1 MB. Line ranges and `vrg-ctx` are always free.

**DNA stays out of context.** Everyone knows the Cradle by reference. Only Abernathy loads DNA material as a matter of course, and anyone else needs a G2 and a reason. With the files at hand, a stand-in adds nothing.

### How the gate works

**Off for now (Q5 C), and the Founder wants a reminder to change that.** While it is off, nothing enforces the hiring rules, read limits or G2: they hold only as instructions, and Bernard grants G2 by answering an ESCALATE instead of writing a permit.

`tools/council-gate.js` is a `PreToolUse` hook. It sees which agent is calling and refuses a costly move, telling the agent to escalate.
Bernard opens a door with a timed permit. This is needed because Claude Code ignores a subagent's own `Agent(type)` list, so "who may
hire whom" can only be enforced there. Tiers come from the roster in the gate, so add any new agent there too.

It is a seatbelt, not a sandbox, like the OTG kit's `guard.ps1`: a determined agent could get round it.

## 5. Escalation

A subagent cannot stop and ask. It ends its turn with this block, and the owner resumes it with `SendMessage`, which keeps its history.

```text
ESCALATE
kind:   model | effort | workflow | web | bigread | hire | scope | blocked
need:   what exactly
why:    why the current tier cannot do it
cost:   rough size
state:  what is done, what is safe to keep
```

The chain is worker to contractor to Head to Bernard to the Founder. Each level solves it or passes it on; nobody skips a level unless it
concerns §3.

## 6. How work moves: the construction line

| Stage | Who | Output | Effort |
|---|---|---|---|
| 1 **Brief** | Founder + Bernard | goal, limits, which department | low |
| 2 **Survey** | Teddy, `vrg-ctx` | facts, not opinions | low |
| 3 **Plan** | the Head | build pack: contract, WPs, tests with exact values, decisions | **high** |
| 4 **Decide** | Founder | answers to A/B/C questions | |
| 5 **Build** | Felix, one WP at a time | code + report | medium |
| 6 **Gate** | scripts, Armistice | pass or fail | none |
| 7 **Verify** | Theresa, a different context from the builder | findings | medium to high |
| 8 **Close** | Clementine, Bernard | log, status, what is untracked | low |

Stages 5–8 can run as a saved workflow, so the line is prepared in advance: [workflows/construction-line.js](workflows/construction-line.js).

### What may go down the line

A package goes to a cheap builder only if **all** of these hold:

1. Its acceptance test has exact expected values.
2. It names its files and anchors.
3. It needs no design choice.
4. It touches at most about 5 files.
5. A gate can fail it without a person looking.

Otherwise it stays with the Head. This is a hard rule because the cheap-builder loop was dropped once on the BRIDGE Stack (2026-10-07):
"finish the job yourself, I need high value work". The method works for well-specified work and slows down everything else.

**Choosing the tier.** Pick the lowest tier with the lowest expected cost, using failure rates from the ledger:

```text
E(tier) = build(tier) + verify + failure_rate(tier) × (build(next tier) + verify)
```

A cheap model that fails often costs more than a strong one that doesn't. Start every package type one tier high, then step down when the ledger earns it.

### One writer

The rule from `CLAUDE.md` stands: one repository, one checkout, every line on `main`. So builders run **one at a time**, and `isolation: worktree`
is not the default. A second builder needs either a `go-tnt`-style branch that the Founder merges, or a Handoff kit.

## 7. Choosing the form

| Need | Form | Why |
|---|---|---|
| One focused job, result comes back | Subagent | Lowest cost |
| A repeatable multi-step line | Saved workflow | Control flow lives in code, not in a model's judgement |
| A long task you want to steer yourself | Separate session | Own context, can be reopened |
| Parallel work on separate files | Sessions, or subagents with worktrees | Needs a merge plan |
| No access to the files, or another account | Handoff kit + stand-in | The `objart-V8` pattern |
| Agents arguing a design | Agent team | Experimental, needs your approval, costs far more (G3) |

## 8. The record

| File | Holds | Written by |
|---|---|---|
| `_admin/council/ledger.jsonl` | per package: department, tier, passed first time?, rework | Clementine |
| `_admin/council/gate.log` | every refusal | the gate |
| `_admin/council/permits.json` | live permits | Bernard |
| `docs/council/DECISIONS.md` | Council-level decisions | Bernard |

## 9. Review

After ten packages through the line, Bernard reports: first-pass rate per tier, cost per package, refusals by kind, and which agents never
earned their place. **An agent nobody called in a month goes to Cold Storage.** The set stays small on purpose.
