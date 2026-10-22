# Ügynök indítók — agent init docs

One short file per live or in-development program: what it is, where it lives, what to read first,
how to build and test it, the rules written in its own docs, its current state, and what not to
touch. Each is the **first** AI document on its program card in VRG Kapu ("Ügynök indító").

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

## Writing or updating one

- The template is fixed: the 7 headings in order, at most 60 lines, the last line
  `Forrás: <files>, <date>`. `node tools/check-hub.js` checks this.
- Facts only from the files read. Where a section has no source, write „— (nincs leírva)".
- Every rule in §5 names the file it comes from.

## Files

repo · launchers · prompts · kapu · mindmap · research · client-preview · client-look · planner ·
valena · calc-panel · calc-general · calc-led · inventory · buildtree · bridge · media-wall ·
sh-catalogue · planner-cyd · knobpad · board-console · licences · coreref · vendor · toolbox
