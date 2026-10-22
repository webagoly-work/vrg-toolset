# Prompts — round 2026-10-10

Paste into a **fresh** Claude Code session whose working directory is the worktree project folder:
`H:\Dev-VRG\VRG-DE\wt-planner-stack\Planner\projects\varler-planner`.
The TASK sandwich (task first, task again at the end) is built in.

## 1. Build the whole round in one strong session (recommended — the user's 10-07 preference)

```
TASK: build round 2026-10-10 of the Planner, wave by wave, stopping at every ⏸.
READ FIRST, in order, before any edit: docs/PRIMER.md · docs/round-2026-10-10/README.md ·
docs/round-2026-10-10/00_CONTRACT.md. Then, per WP, only that WP file and the 01_MATERIAL.md
sections it names.
Rules: work only in the wt-planner-stack worktree; run the CONTRACT §1 loop after every edit batch;
golden must stay identical except where G1 says; never commit; Hungarian UI, English code.
Order: U1 U2 U3 U4 U5 U6 U7 → G1 (⏸ show the look mock first) → G2 (⏸ dry-run report on CLA v2) →
S1 S2 S3 S4 S5 → M1 → M2 (decisions answered 2026-10-10, see README §4).
After each WP: the CONTRACT §7 report in chat, the README §4 status line, then continue.
At each ⏸: stop, show, wait for me.
First of all: git status — anything dirty beyond README §0's known untracked file, tell me before
touching it.
END — do the TASK above only: build round 2026-10-10 wave by wave, stopping at every ⏸.
```

## 2. Build one work package (cheaper model / parallel sessions)

```
TASK: BUILD WP-<id> of round 2026-10-10.
Read docs/PRIMER.md §0–§5, docs/round-2026-10-10/00_CONTRACT.md, docs/round-2026-10-10/WP-<id>_*.md
and only the 01_MATERIAL.md sections it lists. Nothing else unless the WP names it.
Follow the WP exactly; a deviation goes in the report, not in the code. Finish with the CONTRACT §7
report and the README §4 status line. Do not commit.
END — BUILD WP-<id> only.
```
Run the WPs **one at a time**, in README order: they share `08-interaction.js` (U2 U3 U4 U6 S4),
`04-render.js` (U2 U7 G1), `shell.html` (U5 U6 U7 G1), `05z-icons.js` + spec-57 (S2 S5 M1) — two
sessions in one worktree would overwrite each other's edits.

## 3. Verify a work package (stronger model, fresh session)

```
TASK: VERIFY WP-<id> of round 2026-10-10 — built by another session, assume nothing.
Read docs/round-2026-10-10/00_CONTRACT.md and the WP file, then the change (git diff in the
wt-planner-stack worktree, Planner/projects/varler-planner only).
1. Run: node tools/check-globals.js · node build.js · per-module node --check · node tests/spec-<NN>-*.js
   · node tests/run.js.
2. Check every Build item and every test line of the WP against the code: present, correct, tested.
3. Hunt the WP's "Verifier focus"; check golden is identical (or changed only as G1 allows).
4. Do the WP's browser checks in the pane (config planner-serve, CLA-teszt_v2, 1600 × 950) and give
   numbers or a screenshot.
5. Fix defects with the smallest change and a test per fix.
Report: confirmed · fixed (what, why) · still open. Set README §4 to "verified — <date>" only if
nothing is open.
END — VERIFY WP-<id> only.
```

## 4. Apply the decision answers

```
TASK: RESOLVE PLANNER-R1010-Q-001. My answers (tuner export):
<paste the tuner's exported lines>
Change docs/round-2026-10-10 (the WP files and 01_MATERIAL.md) only where an answer differs from
the recommended option; list each change with its file. Write the answers into README §4 "Answers".
Build nothing.
END — RESOLVE only.
```
The tuner copy is `H:\Dev-VRG\VRG-DE\_inbox\BRIDGE Tuner - Planner R1010.html` (24 questions,
recommended options marked; "Export answers" gives the lines to paste).

## 5. Where are we

```
STATUS R1010 — read docs/round-2026-10-10/README.md §4: built / verified per WP, the next WP whose
dependencies are done, and whether a ⏸ is due. Five lines.
```
