# GO STRICT — commit the five uncommitted programs so VRG Kapu's links resolve

> **Retired 2026-10-24, see `GO-MAIN.md`.** Kept for history; do not run it.

*You were started with the codephrase **GO STRICT**. This file is the whole briefing; it does not
depend on any memory note, so it works from any Claude account on this PC. It was written on branch
`secacc` (decision HUB-Q24 A, 2026-10-22). Until that branch is merged, read it at
`H:\cwebuser\projects\VRG-DE\SecAcc\GO-STRICT.md`.*

## 1. Where

- The main checkout `H:\Dev-VRG\VRG-DE\Planner_VRG_U100`, branch **`main`**. `H:\Planner_VRG_U100`
  is a dead backup: never work there. Confirm with `git rev-parse --show-toplevel` and
  `git branch --show-current`.
- **One session at a time here.** If another Claude session is building in this checkout, stop and
  tell the user.
- Do not edit the SecAcc worktree or switch to `secacc`.

## 2. Why

VRG Kapu (the shared homepage, built on `secacc`) links to five programs that exist here only as
uncommitted work. On GitHub those links would 404, so `node tools/check-hub.js --strict` reports 16
errors. They must be committed and pushed before the colleague is invited.

## 3. Do

Start with `git status`. Show the user anything dirty that is **not** in this list, and leave it alone.

1. `Firmware/.gitignore` (modified): ignores `planner-cyd/firmware/` and `board-console/data/`. Its own
   comment calls `board-console/data/` "personal, like macros.json", but
   `Firmware/planner-cyd/app/bridge/macros.json` is **not** ignored. **Ask the user** (lettered options):
   A ignore it (their own button sets) · B commit it as the default set.
2. `Firmware/planner-cyd/`: no compiled firmware, no `node_modules`.
3. `Firmware/board-console/`: no `data/`, no `app/node_modules`.
4. `BRIDGE/10_media-wall/` (MW-001 r0, `fig/`, `src/make-fig.js`).
5. `docs/research/` (three notes + `openmct-spike/`) and `docs/client-look/directions.html`.

Never stage `*.pdf`, `Vendor/`, or `Planner/apps|home|data`. One commit per item is fine. **Push
only when the user says so.** Then tell the user that `secacc` can be merged, and that
`node tools/check-hub.js --strict` after the merge must say "Rendben".

## 4. Ask

Questions as numbered items with lettered options (A recommended first), so the user can answer in
one line. Hungarian for UI text, English for code and commit messages.
