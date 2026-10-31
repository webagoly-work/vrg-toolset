# DNA v2 — the capsule as a virtual reference

*Rewrite of `tools/capsule.js` (branch `docs/go-tnt`, first built 2026-10-30). v1 answers "can the project be rebuilt if every
copy is lost?". v2 adds "can a model that cannot open the files still make accurate guesses and integrate cleanly?".*

## 1. What v1 does, and where it stops

| Strand | v1 content | Size | Limit |
|---|---|---|---|
| 1 Blueprint | every tracked `.md`, plus `vrg-menu.json`, `hub-seed.json`, `package.json` files | 3.5 MB, about 875 000 tokens | Too big for one context (500 000 here), with no reading order, and it **holds no code knowledge**: 1.08 M tokens of source are only in strand 4 |
| 2 File map | path, blob, size | small | Says what exists, not what it does |
| 3 Outside Git | file counts | small | No memory notes, decisions or working style |
| 4 Sequence | git bundle as base64 | 92 MB | Exact, but only code can read it |

So v1 is a good **backup**. It is not yet a **reference**: a model gets either a pile of documents or an unreadable block,
with nothing in between. The missing middle is what you asked for.

## 2. The fix: five folding levels

A model unfolds only as far as the job needs. Each level is a real file type with a size budget.

| Level | Name | Answers | Budget | Source of truth | State |
|---|---|---|---|---|---|
| L0 | **Genome card** | "What exists, where, and who owns it?" | 10 lines per program, about 10 000 tokens for all | generated from `hub-seed.json` + `vrg-menu.json` | design |
| L1 | **Brief** | "How do I start working on it in the real repo?" | 60 lines | `docs/hub/agents/*.md` | exists, 25, stale (see Hand Brief §2) |
| L2 | **Stand-in** | "What is in there, how does it connect, where can I plug in?" | 0.5–3 % of the source | extracted half + authored half | **extracted half built** |
| L3 | **Blueprint** | "How do I rebuild this feature so it behaves the same?" | 2–8 KB per feature | written from the code, with test vectors | **one worked example** |
| L4 | **Sequence** | "Give me the exact bytes." | whole history | git bundle | exists |

Across all levels runs the **connectome**: which file leans on which, which program feeds which, and which decision produced
which rule. Today it is the `Uses:` lines in each stand-in; the program-level graph comes from L0.

### The stand-in, measured on `1d98a31`

`node tools/standin.js --all` writes to `H:\VRG\Full\_admin\dna\standin\`, outside Git:

| Program | Source tokens | Stand-in tokens | Ratio |
|---|--:|--:|--:|
| Planner | 469 576 | 6 227 | 1.3 % |
| Kódváros | 145 005 | 3 268 | 2.3 % |
| Firmware | 144 736 | 1 289 | 0.9 % |
| ServiceKit | 115 435 | 516 | 0.4 % (thin: its big scripts need an authored half) |
| Mobile | 92 295 | 2 510 | 2.7 % |
| Inventory | 79 535 | 2 195 | 2.8 % |
| Launcher | 24 038 | 292 | 1.2 % |
| Kapu | 10 670 | 647 | 6.1 % |
| **Total** | **1 081 290** | **16 944** | **1.6 %** |

So the extracted half of all eight programs costs less than one mid-size source file. `--names` adds every defined name for a
fuller version. Each stand-in carries the commit and a source fingerprint, and `--check` exits 1 when one has gone stale.

**What this proves and what it does not.** It proves the compression and the freshness check. It does not yet prove that a
model guesses *accurately* from it. That is the acceptance test in §6, and it has not been run.

### A stand-in has two halves

- **Extracted** (generated): file map, each file's purpose line, names other files call, load-bearing files. Never hand-edited.
- **Authored** (`docs/council/dna/authored/<id>.md`): purpose, data contracts, invariants, integration seams, traps. Short, written
  from reading the code, and every line tagged:

| Tag | Meaning | A model may |
|---|---|---|
| `[E]` | extracted or read from the code at the header commit | treat as fact for that commit |
| `[A]` | stated in a project document | treat as intent, code may differ |
| `[I]` | inferred | treat as a guess and put it in the assumption ledger |

Worked example: [dna/authored/planner.md](dna/authored/planner.md).

### A blueprint rebuilds behaviour, not text

A blueprint is a build manual for one feature: inputs, the algorithm in order, every constant that matters, worked numbers, and
test vectors that decide whether a rebuild is faithful. Fidelity is judged by the vectors, so a model may rebuild in any language.
Worked example: [dna/blueprints/BP-market-compare.md](dna/blueprints/BP-market-compare.md).

## 3. Virtual integration: working without the files

This is how a cloud session, a second account or a separate worktree builds against something it cannot see:

1. **Unfold** L0, the program's L1, and the L2 for each program it touches. Note the commit in the stand-in header.
2. **Declare** an assumption ledger before writing code: each thing it relies on, tagged, with how to check it.
3. **Build to the seam.** Touch only the named seams; put new logic in new files. Where a dependency is missing, write a stub with
   the same names, marked `STUB`.
4. **Deliver** the change, the ledger and a check script, as in the existing `_handoff/objart-V8` kit (`return/` + `check.js`).
5. **Reconcile** in the real repo: a contractor walks the ledger, confirms or corrects each line, runs the check, and removes stubs.
   A wrong guess lands here, as a one-line fix, rather than after a merge.

```text
ASSUMPTION LEDGER — <task> — against planner @1d98a31
[E] registerAction() exists in 05c-actions.js             check: grep
[A] new top-level data goes in UKEYS and IDPRE            check: spec run
[I] the new panel can read state without a migration      check: open an old project
```

## 4. Capsule v2 layout

Strand 4 keeps its marker, so the `verify` logic in `capsule.js` still works. The change is additive.

| Strand | v2 content | Why |
|---|---|---|
| 0 **Folding guide + genome** (new) | [dna/FOLDING.md](dna/FOLDING.md) + all L0 cards | The first thing a model reads: what this is and how to unfold it |
| 1 **Blueprint** | 1a stand-ins · 1b blueprints · 1c briefs · 1d all other documents | Most useful first, so truncated reading still gives value |
| 2 **File map + connectome** | v1 map + program and file graphs as JSON | Structure a model can query by eye |
| 3 **Outside Git + epigenome** | v1 counts + anonymised memory digest, decision register, conventions, money-path summary | What makes it *your* project, not just its code |
| 4 **Sequence** | unchanged | Exactness |

Three rules carry over from v1 and tighten:

- **Not encrypted.** Base64 hides nothing, so treat it like the bare repos. To leave the PC it needs encryption with a passphrase only you hold.
- **No client data.** The epigenome digest passes `tools/anonymise.js`, because memory notes carry client names and addresses. v1 notes
  that old client codes survive in Git history, so strand 4 still holds them.
- **Built after a commit, from committed state.** Uncommitted work is invisible to it, like BACKUP.

## 5. Work to finish DNA v2

| WP | What | Tier |
|---|---|---|
| D1 | `tools/genome.js`: L0 cards and the program graph, from the seed and menu | contractor |
| D2 | Authored half for Kapu, Mobile, Inventory, Kódváros, ServiceKit, launcher | contractor, seat reviews |
| D3 | First blueprint set: the money path end to end, then wire routing, then the Kapu build | contractor, seat reviews |
| D4 | Decision register: merge every `*-Q-*.json` and `DECISIONS.md` into one index | worker + script |
| D5 | Memory digest: anonymised, no client names, checked by the gate | contractor |
| D6 | `capsule.js` v2 layout, with `verify` extended to check the stand-in fingerprints | contractor |
| D7 | **Blind test**, §6 | Hand |

## 6. Acceptance: the blind test

Stand-ins earn their place only if a model guesses better with them. Pick ten integration questions with answers checkable in the
code ("where would a new endpoint type be registered?", "what must a new top-level collection also touch?"). Ask a cheap model
with no file access three ways: no context, L1 only, L1 + L2. Score each answer against the code.

**Pass:** L1 + L2 is right on at least 8 of 10, and its wrong answers are tagged `[I]`. Below that, the authored half needs work
before the set grows.
