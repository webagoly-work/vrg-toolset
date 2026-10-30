# GO ALL — one working branch with every line of development, to try every feature

> **Retired 2026-10-24, see `GO-MAIN.md`.** Kept for history; do not run it.

*You were started with the codephrase **GO ALL**. This file is the whole briefing; it does not depend
on any memory note. It was written 2026-10-22 by the secondary account on branch `worktree-codecity`,
which is pushed to GitHub. Until that branch is merged, read this file at
`H:\VRG\Full\Planner_VRG_U100\.claude\worktrees\codecity\GO-ALL.md`
or with `git show origin/worktree-codecity:GO-ALL.md`.*

## 1. Where and who

- **Primary account**, in the **main checkout** (the `[main]` line of `git worktree list`). One session
  at a time there; if another Claude session is building in it, stop and tell the user.
- The result is a new branch **`dev-all`** in its **own worktree** `<VRG-DE>\wt-dev-all`, next to
  `wt-planner-stack` — so the main checkout stays on `main` and nobody's open work is disturbed.
  (A fresh worktree also sidesteps the uncommitted Kapu pack that still sits in the main checkout.)
- `dev-all` is for **trying everything together**. It is not merged back into `main` as a whole:
  features still reach `main` one by one, when the user says so.
- Never force-push, never push `main` unasked, never edit SecAcc or the other `wt-*` worktrees, never
  `git stash` (the stash is shared by every worktree).

## 2. What exists (state 2026-10-22 — re-check with the commands in §3)

| Branch | Where | Ahead of main | What it carries |
|---|---|---|---|
| `main` | main checkout | — (2 commits not on origin yet) | Planner round 2026-10-18/19 (Födém · Igénylista · Házimozi) |
| `planner-stack` | `wt-planner-stack`, on origin | 14 | **GO WIRE**: wireway audit, T0–T6 (up field, chain tool, tray, drawn routes), engine fixes |
| `secacc` | SecAcc worktree, on origin | 35 | **VRG Kapu** (GO HUB, WP-H0…H13): the Homepage / Business Topology board, `Hub/`, `docs/hub/`, `tools/build-hub.js`, `tools/check-hub.js`, SECACC.md, GO-STRICT.md |
| `worktree-codecity` | `.claude/worktrees/codecity`, on origin | 11 | **VRG Kódváros** (GO CITY, C1–C9): `CodeCity/`, `docs/city/`, START.cmd tool 11 on key **K**, God's Eye View in the vendor manifest, this file |
| `origin/claude/new-session-mkexjy` | origin only | 1 | `53b8cc5` Views V8b: object line-art batch Konyha (05zc, 14 objects) — in no other branch |
| `planner-sui`, `planner-circuit-endpoints`, `bridge-docs`, `claude/busy-einstein-…`, `claude/github-repos-recommendation-…` | | 0 | already in `main` — nothing to take |

## 3. Do

1. `git status` in the main checkout. Anything uncommitted stays where it is — it will **not** be in
   `dev-all`. Tell the user which open work that leaves out. If **GO STRICT** has not run yet
   (the five programs Kapu links to: research, client-look, media-wall, planner-cyd, board-console,
   plus the `macros.json` question), say so: Kapu's links stay broken in `dev-all` until it has.
2. Re-check §2: `git fetch origin`, `git worktree list`, and for each branch
   `git rev-list --left-right --count main...<branch>`. Any branch that is new, or that has grown,
   goes into the plan — show the user the list before merging.
3. Make the worktree: `git worktree add <VRG-DE>\wt-dev-all -b dev-all main`, and work inside it.
4. Merge, one branch per step, oldest line first, each with `--no-ff` so it can be undone alone:
   1. `git merge --no-ff planner-stack -m "dev-all: merge planner-stack (GO WIRE)"`
   2. `git merge --no-ff secacc -m "dev-all: merge secacc (VRG Kapu)"`
   3. `git merge --no-ff worktree-codecity -m "dev-all: merge worktree-codecity (VRG Kódváros)"`
   4. **Ask** (lettered): `53b8cc5` (V8b Konyha line art) — A cherry-pick it (`git cherry-pick 53b8cc5`) ·
      B leave it out.
5. Conflicts to expect — **keep both sides** unless they really contradict:
   - `CLAUDE.md` codephrase list: every `GO …` line from every branch (GO WIRE, GO HUB, GO STRICT,
     GO CITY, GO ALL).
   - `Planner/START.cmd`: the registry (tool 11 = Kódváros on **K**, the TOOLKEYS / menu / dispatch
     changes) and the dated NOTE blocks — keep every NOTE, in date order. CRLF line endings:
     `file Planner/START.cmd` must say "CRLF".
   - `vendor-manifest.json` / `vrg-vendor.html`: keep every component, then
     `node tools/fetch-vendor.js --sync-page` to regenerate the page.
   - `VRG-DE.cmd` (Kapu touched it): CRLF, keep every menu entry.
6. Verify, all in `wt-dev-all`:
   - `node tools/check-start.js` → "Rendben"
   - Kódváros: `node tools/fetch-vendor.js three` (once), `node CodeCity/build.js`,
     `node CodeCity/tools/selftest.js` → "all passed", then
     `node CodeCity/scan.js . --html CodeCity/dist/dev-all.html` and open it — the city of `dev-all` itself
   - Kapu: `node tools/build-hub.js`, `node Hub/test/run.js`, `node tools/check-hub.js --strict`
     (only "Rendben" once GO STRICT is in; otherwise report its count)
   - Planner: the build and tests in `Planner/projects/varler-planner` (see its own CLAUDE.md)
   - Report every failure with its output. Do not fix feature code here — fixes belong on the
     feature's own branch, then merge again.
7. **Push only when the user says so**: `git push -u origin dev-all`.

## 4. Report to the user

A table: branch → merged? (commit), conflicts and how they were resolved, test results, and **how to
try each feature**: START.cmd numbers/keys (K = Kódváros, 1 = Planner, …), `Hub/` page for Kapu, the
W/E Planner actions. Then the open items of each line: GO WIRE (its own status), Kapu (setup checklist,
OneDrive links, GO STRICT), Kódváros (C9 ⏸ CITY-D7 agent-session replay, then C10).

## 5. Keeping `dev-all` current

When a feature branch gets new commits: in `wt-dev-all`, `git fetch origin` then
`git merge --no-ff <branch>` again (or `origin/<branch>`), re-run §3.6, push when asked. New lines of
work get added to the §2 table in this file. When a feature is merged into `main`, merge `main` into
`dev-all` too, so the two never drift apart.

## 6. Ask

Numbered questions, lettered options, A recommended first, so the user answers in one line.
Hungarian UI text, English code and commit messages.
