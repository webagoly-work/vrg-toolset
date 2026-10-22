# GO HUB — build VRG Kapu (the shared Homepage)

*You were started with the codephrase **GO HUB**. This file is the whole briefing; it does not depend
on any memory note, so it works from any Claude account on this PC.*

## 1. Where

- **Secondary account: work ONLY in `H:\cwebuser\projects\VRG-DE\SecAcc`**, branch **`secacc`** (a git
  worktree of the vrg-toolset repo). Never edit the main checkout `…\Planner_VRG_U100` — the primary
  account works there. Confirm with `git rev-parse --show-toplevel` (must end in `SecAcc`) and
  `git branch --show-current` (must say `secacc`).
- Read `SECACC.md` in this folder first: how commits and the hand-back work.
- Commit to `secacc` after each finished WP (message `Kapu WP-Hn: …`). Never push, never merge,
  never switch branch.

## 2. Read first

1. `docs/hub/00_CONTRACT.md` — rules, file ownership, the build/test loop, the report format.
2. `docs/hub/README.md` — §3 the WP order, §4 the status table, §5 the user's answers.
3. The next WP file in `docs/hub/wp/` whose status is not DONE, and only the
   `01_ARCHITECTURE.md` / `03_UI.md` sections it names.

## 3. Do

Build that one WP (or, if the user said "all", continue in README §3 order). Stop at every ⏸ and when
a decision is missing. After each WP: the contract §5 report and the README §4 status line.

## 4. Ask

Questions to the user as numbered items with the DECISIONS.md id and lettered options (A recommended
first), so they can answer in one line. If the question is visual, add a simple SVG picture with no
overlapping labels.

User working style: phase big work, stop at checkpoints, never commit unasked, Hungarian UI text,
English code. Never ask for, type or store a password or token — each user enters their own token in
their own browser.

## 5. Status

2026-10-22: WP-H0 to H12 done on `secacc` (H12 = the agent init docs in `docs/hub/agents/`).
WP-H13 partial: `build-hub.js --onedrive` + `OLVASS_EL.md`, `docs/hub/KOLLEGA-INDULAS.md` with
screenshots, README §6 done. Also fixed: prompt 05 path, `VRG-DE.cmd` `>nul`, no auto tour from file://.

Waiting for the user:
1. Setup checklist steps 3–8 (push, invite, 2FA, OneDrive shares).
2. The OneDrive share links (12 empty) and the real `VRG-Megosztott\00_START` path.
3. The clean-profile verify, with the user typing their own token.
4. **`GO STRICT`** (HUB-Q24 A) in the main checkout: commit the five uncommitted programs, then merge
   `secacc`. After that, `node tools/check-hub.js --strict` must say "Rendben" (today: 16 errors,
   all those five programs).

The live table is `docs/hub/README.md` §4.
