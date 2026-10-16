# Prompts — workflow round (WF)

Paste into a **fresh** Claude Code session whose working directory is
`H:\Dev-VRG\VRG-DE\wt-planner-stack\Planner\projects\varler-planner`. The TASK sandwich is built in.
Run the WPs **one at a time** in README §2 order — F1/F2/F3 share the room code, E1/E3/E5 share the link data.

## 0. Answer the decisions first (cheap)

```
TASK: RESOLVE docs/workflow/WF-Q-001.json with my answers: <F01 A, F02 A, …>.
Write them into README §5 "Answers" (id → option, one line each) and set "rev":"r1" + a top-level "answers" object in the
JSON. Change nothing else. Do not commit.
END — RESOLVE only.
```

## 1. Build one wave in one strong session (recommended)

```
TASK: build Wave <F|O|R|E> of the Planner workflow round, WP by WP, stopping at every ⏸.
READ FIRST, in order: docs/PRIMER.md · docs/workflow/README.md · docs/workflow/00_CONTRACT.md. Then per WP only that
WP file and the 01_MATERIAL.md sections it names.
Rules: wt-planner-stack worktree only; the CONTRACT loop after every edit batch; golden identical; never commit;
Hungarian UI, English code; decisions = README §5, else the recommended option.
After each WP: the report (contract §5) + the README §4 status line, then continue. At a ⏸: stop, show, wait.
First: git status — anything dirty that is not yours (other sessions share this worktree), tell me before touching it.
END — build Wave <…> only, stopping at every ⏸.
```

## 2. Build one work package (cheaper model)

```
TASK: BUILD WP-<id> of the workflow round.
Read docs/PRIMER.md §0–§5, docs/workflow/00_CONTRACT.md, docs/workflow/WP-<id>_*.md and only the 01_MATERIAL.md sections
it names. Follow the WP exactly; a deviation goes in the report, not in the code. Finish with the contract §5 report and
the README §4 status line. Do not commit.
END — BUILD WP-<id> only.
```

## 3. Verify a work package (stronger model, fresh session)

```
TASK: VERIFY WP-<id> of the workflow round against its file.
Read docs/workflow/00_CONTRACT.md and WP-<id>_*.md. Check: every Build step exists and does what it says; every Test
exists with the exact numbers; golden 70/70; check-globals OK; no parallel copy of a helper the WP said to reuse; the
Hungarian strings match. Open the build in the browser pane (planner-stack-dist, 8138) for anything the WP draws and
attach a screenshot. Report: PASS / FAIL per step, then fixes (do not fix unless I say so).
END — VERIFY WP-<id> only.
```

## 4. Status

```
TASK: STATUS of the workflow round. Read docs/workflow/README.md §4–§5 and git status; list per WP: built / tested /
open ⏸ / blocked by. Two lines max per WP. No edits.
END — STATUS only.
```
