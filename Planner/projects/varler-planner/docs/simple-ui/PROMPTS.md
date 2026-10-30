# Prompts — Simplified UI (SUI)

Paste into a **fresh** Claude Code session whose working directory is
`H:\VRG\Backup\archive\parked\2026-10-24\wt-planner-stack\Planner\projects\varler-planner`. The TASK sandwich is built in.
**Another session is working in the same worktree on the UI tidy (T1–T4).** The contract §0–§2 explains how the two
stay apart.

## 0. Answer the decisions (cheap)

```
TASK: RESOLVE docs/simple-ui/SUI-Q-001.json with my answers: <S01 A, S03 A, …>.
Write them into README §5 (id → option, one line each), set "rev":"r1" and a top-level "answers" object in the JSON.
Change nothing else. Do not commit.
END — RESOLVE only.
```

## 1. Build the whole pack in one session (recommended)

```
TASK: build the Simplified UI pack, WP by WP in README §3 order (S0 S1 S2 S3 S4 S6 S5 S7), stopping at every ⏸.
READ FIRST, in order: docs/PRIMER.md §0–§5 · docs/simple-ui/README.md · docs/simple-ui/00_CONTRACT.md. Then, per WP,
only that WP file and the 01_DESIGN / 02_MENU-TREE sections it names. Open mock/sm-mock.html before S1 and S6.
Rules: own only the files in contract §1; the contract loop after every edit batch; golden 70/70; never commit, never
stash; Hungarian UI, English code; decisions = README §5, else the ★ recommended option.
A parallel session is rewriting tool switching and the sidebars (T1–T4). If its unfinished work breaks the build or a
suite that is not yours, run your own spec directly and report it; don't fix their files.
After each WP: the report (contract §5) plus the README §4 status line, then continue. At a ⏸: stop, show, wait.
First: git status. Tell me what is dirty and whose it looks like before you touch anything.
END — build the SUI pack, stopping at every ⏸.
```

## 2. Build one work package (cheaper model)

```
TASK: BUILD WP-S<n> of the Simplified UI pack.
Read docs/PRIMER.md §0–§5, docs/simple-ui/00_CONTRACT.md, docs/simple-ui/WP-S<n>_*.md and only the 01_DESIGN /
02_MENU-TREE sections it names. Follow the WP exactly; a deviation goes in the report, not in the code. Own only the
contract §1 files. Finish with the contract §5 report and the README §4 status line. Do not commit.
END — BUILD WP-S<n> only.
```

## 3. Verify a work package (stronger model, fresh session)

```
TASK: VERIFY WP-S<n> of the Simplified UI pack against its file.
Read docs/simple-ui/00_CONTRACT.md and WP-S<n>_*.md. Check:
- every Build step exists and does what it says;
- every Test exists with the exact values;
- golden 70/70; check-globals OK (`--prefix sm`);
- no edit outside the contract §1 files;
- no parallel copy of paletteScore / runAction / actionEnabled;
- the Hungarian strings match.
Open planner-stack-dist (:8138) in the browser pane, switch simple mode on, exercise the WP and attach a screenshot.
Report PASS / FAIL per step, then the fixes (do not fix unless I say so).
END — VERIFY WP-S<n> only.
```

## 4. Status

```
TASK: STATUS of the Simplified UI pack. Read docs/simple-ui/README.md §4–§5 and git status; per WP: built / tested /
open ⏸ / blocked by. Two lines max per WP. No edits.
END — STATUS only.
```
