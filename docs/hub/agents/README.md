# Ügynök indítók — agent init docs

One short file per live or in-development program or line of work: what it is, where it lives, what
to read first, how to build and test it, the rules written in its own docs, its current state, and
what not to touch. Each is the **first** AI document on its program card in VRG Kapu ("Ügynök indító").

## Connecting your own Claude Code

Each of you uses your **own** Claude account; nothing here needs a shared login.

1. Open Claude Code in your own clone of `vrg-toolset`, or on claude.ai/code with the repo.
2. Say: **„olvasd el a docs/hub/agents/<id>.md-t, és …"**, followed by what you want done.
   `<id>` is the program's id, e.g. `planner`, `inventory`, `bridge`.
3. The agent reads the file, then the files in its §3, and starts from there.

In VRG Kapu the right-click item **„Claude Code itt → indító prompt másolása"** copies exactly this
sentence for the program you clicked; with the Kapu segéd running, **✳ Claude Code** also opens a
Claude Code window in that program's folder.

For a longer job with checkpoints, use a GO file instead (see `SESSIONS.md`).

## How the Council uses them

A brief is the cheapest good context: about 600 tokens, and it says which files are worth the rest.

1. The owner line under the title says who answers for the program. `docs/council/ROSTER.md` is the call sheet.
2. A Head or contractor reads the brief, then only the §3 files the job needs, and searches with
   `node tools/vrg-ctx.js q "<words>"` before opening anything large.
3. Armistice runs `node tools/brief-state.js --check` at the start of a round. A stale brief is
   refreshed before anyone relies on it.

## Writing or updating one

- The template is fixed: the 7 headings in order, at most 60 lines, the last line
  `Forrás: <files>, <date>`. `node tools/check-hub.js` checks this.
- The owner line and the `- git` lines in §6 are generated. Never edit them by hand: run
  `node tools/brief-state.js`. A new brief also needs a row in that tool's `BRIEFS` table.
- Facts only from the files read. Where a section has no source, write „— (nincs leírva)".
- Every rule in §5 names the file it comes from.
- §6 by hand holds only what git cannot show: what is open, what is blocked, the decision files.
- No client names: job codes only.

## Files

**Arnold:** planner · routing · client-preview · client-look · mindmap · valena

**Charlotte:** workflow-kit · jobs · inventory · buildtree · calc-panel · calc-general · calc-led · licences

**Elsie:** bridge · media-wall · sh-catalogue · planner-cyd · knobpad · board-console · kapu · mobile ·
kodvaros · launchers · backups · repo · prompts · research · coreref · vendor · toolbox
