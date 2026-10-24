# GO FRAME — start a session on the BRIDGE SmartFrame (BSF) concept

> **2026-10-24 — GO MAIN:** the worktrees are retired. Work in the main checkout `H:\cwebuser\projects\VRG-DE\Planner_VRG_U100`, branch `main`. Any worktree path or branch named below means the main checkout and `main`.

*You were started with the codephrase **GO FRAME**. This file is the whole briefing; it does not
depend on any memory note, so it works from any Claude account on this PC.*

## 1. Where

- Git worktree `H:\cwebuser\projects\VRG-DE\Planner_VRG_U100`, branch `planner-stack` (project folder
  `Planner\projects\varler-planner`). BRIDGE documents live in the **main checkout**
  `H:\Dev-VRG\VRG-DE\Planner_VRG_U100\BRIDGE` (branch `main`). `H:\Planner_VRG_U100` is a dead
  backup; never work there.
- Start with `git status` in both. Expected: `Calculator/CLA_vplan_upper-ghost.json` untracked in the
  worktree. If **another session is building round 2026-10-10 (GO R1010)** in the worktree, do not
  touch its files: write only the new files this briefing names, and tell the user.

## 2. What

Read, in this order:
1. `Planner/projects/varler-planner/docs/round-2026-10-10/NEXT-CLA-ADD-001-SF_smartframe-brief.md`.
   **This is the task.** It holds the user's request (§1), what exists (§2), the analysis (§3–5), the
   research list (§6), the questions (§7) and the phase plan (§8).
2. The files its §2 table names, as needed: STD-003 §2, ARCH-001, IDEA-001, IDEA-002,
   WORKSHOP-001 §1, `docs/stack/01_CATALOGUES.md` (POR, NTL), `docs/PRIMER.md`.

Then follow brief §8:
- **Phase 1 (now):** ask the §7 questions in one batch, then do the §6 research (verify ESPHome names
  in CoreRef, cite web sources), then write `docs/stack/IDEA-003_smartframe.md` plus own SVG
  illustrations (one door elevation with both faces, one CLA room plan with the L pattern).
  ⏸ **Stop and fine-tune with the user.**
- **Phase 2 (after the user's go):** the BRIDGE document version chosen in Q-SF-02, plus the amendments
  the brief lists.
- **Phase 3 (only once round 2026-10-10 is built):** the Planner pack in `docs/round-cla-add-001/`
  together with the CLA-ADD-001 extras. **Build no code in this go.**

## 3. Rules the user cares about

- Hungarian UI, English code and docs. Phase big work, ask midway, stop at every ⏸.
- **Never commit or push unless the user says so**; commit with explicit paths, never `git add -A`.
- Client-device code: MIT/Apache/BSD only, no AGPL. Draw your own illustrations; never reuse
  collected images.
- Mark unverified figures ⚑. Put open choices to the user as questions with a recommended default;
  do not invent standards.

## 4. First reply to the user

In five lines: the `git status` result, whether GO R1010 is in progress, and that you are starting
Phase 1. Then ask the §7 questions.
