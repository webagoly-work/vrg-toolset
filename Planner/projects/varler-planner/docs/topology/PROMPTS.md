# Prompts: Topology View (TPO)

Paste one of these into a **fresh** Claude Code session whose working directory is
`H:\VRG\Backup\archive\parked\2026-10-24\wt-planner-stack\Planner\projects\varler-planner`. Each prompt names exactly what to read, so a WP
session loads the pack files it needs (~3–6 k tokens) plus the named code, never the whole tree.

## 0. Answer the decisions first (cheap)

```
TASK: RESOLVE docs/topology/TOPO-Q-001.json with my answers: <T12 A, T14 A, T03 A, …>.
Write them into README §9 "Answers" (id → option, one line each) and set "rev":"r1" + a top-level "answers" object in
the JSON. If an answer changes a rule, edit that rule in 01_RULES.md (keep its id). Change nothing else. Do not commit.
END — RESOLVE only.
```

## 1. Build one work package (the default; one short session each)

```
TASK: BUILD WP-T<n> of the Topology View.
Read, in order: docs/PRIMER.md §0–§5 · docs/topology/00_CONTRACT.md · docs/topology/WP-T<n>_*.md · only the
01_RULES.md sections that WP names. Read code only at the anchors the WP lists.
Follow the WP exactly; a deviation goes in the report, not silently in the code. Decisions = README §9, else the
recommended option. Loop after every edit batch: node build.js && node tools/check-globals.js && node tests/run.js.
Golden 70/70 identical. Finish with the contract §5 report and the README §8 status line. Do not commit.
If the WP has a ⏸, stop there and show me.
END — BUILD WP-T<n> only.
```

## 2. Build a wave (stronger model, stops at every ⏸)

```
TASK: build Wave <A|B|C> of the Topology View, WP by WP, stopping at every ⏸.
READ FIRST: docs/PRIMER.md · docs/topology/README.md · docs/topology/00_CONTRACT.md. Then per WP only that WP file
and the 01_RULES.md sections it names.
Rules: the contract loop after every edit batch; golden identical; never commit; Hungarian UI, English code.
After each WP: the report + the README §8 status line, then continue. At a ⏸: stop, show, wait.
First: git status. Anything dirty that is not yours, tell me before touching it.
END — build Wave <…> only.
```

## 3. Verify a work package (fresh session)

```
TASK: VERIFY WP-T<n> of the Topology View against its file.
Read docs/topology/00_CONTRACT.md, WP-T<n>_*.md and the 01_RULES.md ids it names. Check:
- every Build step exists and does what it says, and every Test exists with the exact numbers;
- golden 70/70; check-globals OK;
- no parallel copy of a helper the WP said to reuse (BL.network, BL.rules, ckt*, cpr*, elp*, jb*, lsw*);
- hooks in shared files are one line each and guarded;
- the rule ids in the code comments match 01_RULES.md.
Open the build in the browser pane for anything the WP draws and attach a screenshot.
Report PASS / FAIL per step, then the fixes (do not fix unless I say so).
END — VERIFY WP-T<n> only.
```

## 4. Status

```
TASK: STATUS of the Topology View. Read docs/topology/README.md §8–§9 and git status. List per WP: built / tested /
open ⏸ / blocked by. Two lines max per WP. No edits.
END — STATUS only.
```
