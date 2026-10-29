# Prompts: Topology View (TV), inside GO ROUTE (r2)

Paste one of these into a **fresh** Claude Code session in the main checkout
`H:\cwebuser\projects\VRG-DE\Planner_VRG_U100` (branch `main`), or into a cloud session on this repo. Each prompt names
exactly what to read: a WP session loads about 3–6 k tokens of pack plus the named code, never the whole tree.

**The usual start is the codephrase `GO ROUTE`.** It reads `GO-ROUTE.md`, asks the §2 questions (the TV ones
included) and waits. The prompts below are for after those answers.

## 0. Record the decisions (cheap)

```
TASK: RESOLVE docs/topology/TOPO-Q-001.json with my answers: <TV19 A, TV03 A, TV18 A, …> and the G-items I picked:
<G7, G1, G4>.
Write them into docs/topology/README.md §9 "Answers" (id → option, one line each), set "rev":"r3" and a top-level
"answers" object in the JSON. If an answer changes a rule, edit that rule in 01_RULES.md (keep its id and its Status
column). Copy the G-item pick into GO-ROUTE.md §5 under the order diagram. Change nothing else. Commit and push.
END — RESOLVE only.
```

## 1. Build one TV work package (the default; one short session each)

```
TASK: BUILD WP-TV<n> of the Topology View.
Read, in order: docs/PRIMER.md §0–§5 · docs/topology/00_CONTRACT.md · docs/topology/WP-TV<n>_*.md · only the
01_RULES.md / 02_ENGINE_GAPS.md sections that WP names. Read code only at the anchors the WP lists.
Rules: write the up-tree only through upSet / upFill / ldSetLeader / trayApply …; never route in the view (BL_LAST);
modules src/08t*, prefix tpo. Decisions = README §9, else the recommended option.
Loop after every edit batch: node build.js && node tools/check-globals.js && node tests/run.js — golden 70/70.
Finish with the contract §5 report (+ "Writes through" and "Engine gaps touched") and the README §8 status line.
Commit and push. If the WP has a ⏸, stop there and show me.
END — BUILD WP-TV<n> only.
```

## 2. Build one engine gap (GO ROUTE)

```
TASK: BUILD G<n> from docs/topology/02_ENGINE_GAPS.md, under GO ROUTE.
Read: GO-ROUTE.md §3 · docs/topology/00_CONTRACT.md §1.4 and §4 · 02_ENGINE_GAPS.md (the table and §G<n>) ·
WP-TV12_engine-gaps.md · tools/baseline/README.md · the plan.js / network.js lines §G<n> names.
Engine code in tools/baseline only (pure Node, no fs, no DOM), then node build.js. spec-98 parity stays green; the
practice-flat quantity golden (money-path audit §7.8) exists first (add it if this is the first G-item) and every
changed metre is listed. Remove G<n>'s CK-14 line and update tpoOverlay if R's shape changed.
Write the spec named in §G<n> Tests. Report with the practice-flat diff. Commit and push.
END — BUILD G<n> only.
```

## 3. Build a TV wave (stronger model, stops at every ⏸)

```
TASK: build Topology View Wave <A|B|C>, WP by WP, stopping at every ⏸.
READ FIRST: GO-ROUTE.md §5 · docs/PRIMER.md · docs/topology/README.md · docs/topology/00_CONTRACT.md. Then per WP
only that WP file and the rules / gap sections it names.
After each WP: the report + README §8 status line, commit and push, continue. At a ⏸: stop, show, wait.
First: git status. Anything dirty that is not yours, tell me before touching it.
END — build Wave <…> only.
```

## 4. Verify a work package or a G-item (fresh session)

```
TASK: VERIFY <WP-TV<n> | G<n>> against its file.
Read docs/topology/00_CONTRACT.md and the WP / §G<n>. Check:
- every Build step exists and does what it says, and every Test exists with the exact numbers;
- golden 70/70; check-globals OK; spec-98 green;
- no second topology store; no routing in the view; no parallel copy of upSet / ldChains / bflClick / trayApply /
  cpr* / lsw* / jb*;
- hooks in shared files are one guarded line each;
- the rule ids in the comments match 01_RULES.md.
Open the build in the browser for anything the WP draws and attach a screenshot.
Report PASS / FAIL per step, then the fixes (do not fix unless I say so).
END — VERIFY only.
```

## 5. Status

```
TASK: STATUS of GO ROUTE's Topology View. Read GO-ROUTE.md §5, docs/topology/README.md §8–§9 and git log -20. List
per WP and per picked G-item: built / tested / open ⏸ / blocked by. Two lines max each. No edits.
END — STATUS only.
```
