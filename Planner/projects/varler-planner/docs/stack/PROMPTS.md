# Prompts

## 1. The short form of your capital-letter instruction

You wrote, at the top: *read the whole text to the end, start nothing until you have, then do only the
task that comes with this instruction* — and at the bottom: *now turn back and focus only on that,
the way the top says.* Three ways to say it, shortest last.

**A — the sandwich (most reliable for long pastes).** Task first, material in the middle, task again
at the end. Models weigh the start and the end of a prompt most; repeating the task at the end is what
stops a long paste from turning into the task.
```
TASK: <one or two lines — what you want done>
CONTEXT ↓ read to the end before acting; act only on TASK.

<pasted material>

END CONTEXT ↑ do the TASK only.
```

**B — two lines around anything.**
```
READ ALL FIRST — then do only the TASK at the end.
…
TASK: <…>
```

**C — a header tag.** Put this first and the task on the line after it:
```
⟦READ-ALL · TASK-ONLY⟧
```
It works because the words say it; no memory or setup is needed, so it also works for other models.

## 2. Build a work package — paste into a fresh session

```
BUILD WP-<id> of the Planner BRIDGE Stack.
Read docs/stack/00_CONTRACT.md and docs/stack/WP-<id>_*.md in
H:\Dev-VRG\VRG-DE\Planner_VRG_U100\Planner\projects\varler-planner — nothing else unless the WP lists it.
Work in the planner-stack worktree (CONTRACT §0). Follow the WP exactly; a deviation goes in the report,
not in the code. Run check-globals after every edit batch. Finish with the CONTRACT §8 report and
set the WP's status line in docs/stack/README.md. Do not commit unless I say so.
```

## 3. Verify a work package — a different, stronger model, fresh session

```
VERIFY WP-<id> of the Planner BRIDGE Stack — built by another model, assume nothing.
Read docs/stack/00_CONTRACT.md and the WP file, then the change itself
(git diff in the planner-stack worktree, Planner/projects/varler-planner only).
1. Run: node tools/check-globals.js · node build.js · node tests/spec-<NN>-*.js · node tests/run.js.
2. Check every test line and every "Build" item of the WP against the code — present, correct, tested.
3. Hunt the WP's "Verifier focus" risks and CONTRACT §7 violations; check golden is identical
   (or changed only where the WP allows).
4. Fix defects with the smallest change and add a test for each fix.
Report: confirmed · fixed (what, why) · still open · browser checks still owed.
Set the README status to "verified — <date>" only if nothing is open.
```

## 4. Apply your decision answers

```
RESOLVE PLANNER-STACK-Q-001. My answers (tuner lines):
<paste Q=key ~ note lines>
Change docs/stack (WPs and 01_CATALOGUES.md) only where an answer differs from the default; list each
change with its file. Build nothing.
```

## 5. Where are we

```
STATUS STACK — read docs/stack/README.md: which WPs are built / verified, which is next whose
dependencies are done, and whether a ⏸ checkpoint is due. Five lines.
```

## 6. A new dev draft, prepared the same way as this one

```
ANALYSE + PRESET: below is a Planner dev draft. Read it to the end first. Do not code. Reorder it by
dependency, cut it into small work packages in the format of docs/stack (contract, catalogues, WPs,
decision pack, tests with exact values), check every claim against the real code and the BRIDGE
standards, and flag what the standards do not cover.
<draft>
END — analysis only.
```
