# The Council pack

*Written 2026-10-31 by Bernard, the Hand. Agents installed, budget gate off (COUNCIL-Q5 C). Nothing is committed.*

| Read | File | What it is |
|---|---|---|
| 1 | [ROSTER.md](ROSTER.md) | The call sheet: who to call, for what |
| 2 | [03_COUNCIL-CHARTER.md](03_COUNCIL-CHARTER.md) | Delos and the Park: seats, facilities, authority, budget classes, escalation, the construction line |
| 3 | [DECISIONS.md](DECISIONS.md) | Your answers, and the questions still open |
| 4 | [01_HAND-BRIEF.md](01_HAND-BRIEF.md) | Review, candidates, tools, agent technology, the Lego set, roadmap |
| 5 | [02_DNA-V2.md](02_DNA-V2.md) | The capsule rewritten as a virtual reference. Waits for the GO TNT merge; not needed for daily work |

## Contents

| Path | State |
|---|---|
| `agents/` | 12 drafts named by persona: Bernard, 3 seats, 4 contractors, 4 workers. The existing `vrg-piacmero` makes 13 |
| `workflows/construction-line.js` | Draft: build, gate, verify, one WP at a time. Never run |
| `dna/FOLDING.md` | Strand 0 text of capsule v2 |
| `dna/authored/planner.md` | Worked stand-in, authored half |
| `dna/blueprints/BP-market-compare.md` | Worked blueprint; a full rebuild has not been tested |

## Tools

| Tool | State |
|---|---|
| `tools/vrg-ctx.js` | Working. Index in `H:\VRG\Full\_admin\ctx` |
| `tools/standin.js` | Working. Output in `H:\VRG\Full\_admin\dna\standin` |
| `tools/brief-state.js` | Working. Keeps the briefs' current state and checks them for stale facts |
| `tools/council-gate.js` | Tested on simulated input. **Off by decision (Q5 C)**, so the real hook input is unconfirmed |

```bash
node tools/vrg-ctx.js index
node tools/vrg-ctx.js q "vendor rule" --path Inventory
node tools/brief-state.js --check
node tools/standin.js --check
```

## Installing

`docs/council/agents/` is the single source. After changing a draft, install it again; a new session sees it.

```bash
node docs/council/agents/install.js .claude/agents ../.claude/agents
node docs/council/agents/install.js --check .claude/agents ../.claude/agents
```

If the gate is turned on later, it goes in `settings.local.json` under `PreToolUse`, with `onFailure: "continue"` as the Kódváros hooks do.
