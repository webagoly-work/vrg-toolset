# GO MAIN — consolidate every line of work into one `main`, then trim the rest

> **Status 2026-10-24: Phases 0–5 done** on branch `gomain`, fast-forwarded into `main`. What differed from the plan:
> - Phase 0.3 found uncommitted work that was not in `main`, in `wt-planner-stack` (Views plan-sheet / rbx specs) and `wt-planner-sui` (Simple-UI mode).
>   It was **parked**, not merged: WIP commits on those branches, tags `archive/2026-10-24/planner-stack-wip` / `planner-sui-wip`.
>   Client data from `wt-planner-stack` (the `Calculator/` baseline folder, `client-preview/dev`) and the companion tokens were copied
>   outside the repo to `H:/cwebuser/projects/VRG-DE/_parked/2026-10-24/`.
> - Phase 2: `d390c8f` was already in `main` (empty cherry-pick, skipped).
> - Phase 3 merged `archive/2026-10-23/planner-stack`, so the parked WIP commit stayed out. Planner: 3673 assertions, all green.
> - Phase 7 therefore needs `-D` for `planner-stack` and `planner-sui` too (their WIP tips are tagged), and the parked copies
>   (`Calculator/` baseline folder, `client-preview/dev`) in `wt-planner-stack` have to be removed before its `worktree remove`.

*Codephrase **GO MAIN**. Written 2026-10-23 from a read-only survey of every branch. This file is the
whole briefing: a step-by-step runbook. Work top to bottom; each step says what to run, what you should
see, and what to do if you don't.*

**Goal:** one `main` that holds every working part (Kódváros, Kapu, the Planner rounds, GO WIRE, the
Topology View pack, …), pushed to GitHub, and then no other branches or worktrees left over. Feature
work later starts from that `main`.

**Ground rules**

- Run everything in the **main checkout**: `H:\cwebuser\projects\VRG-DE\Planner_VRG_U100` (branch `main`).
  `H:\Dev-VRG\VRG-DE` is a **junction** to `H:\cwebuser\projects\VRG-DE`, so `H:\Dev-VRG\VRG-DE\Planner_VRG_U100`
  is the *same* folder and the *same* repository, not a copy. There is exactly one repository.
- Never `--force` anything (no `push --force`, no `worktree remove --force`, no `branch -D` unless a step
  below says so and says why). A refusal from git is the safety net: stop and read it.
- No `git stash` (the stash is shared across worktrees and sessions). Set work aside with a WIP commit.
- Every merge is `--no-ff`, one source per step, so any single step can be undone alone.
- The anonymisation map `tools/anonymise.map.json` exists **only in the main checkout** (gitignored).
  That is one more reason this runs there.
- Commands are plain `git` / `node` lines that work in Git Bash and in PowerShell. In Claude Code, type
  them with a leading `!` to run them in the session.

---

## The survey (2026-10-23)

| Branch | Where it lives | Not yet in the future `main` | Plan |
|---|---|---|---|
| `worktree-codecity` | worktree `.claude\worktrees\codecity` | — (it **is** the future main: `main` + Kódváros C1–C10 + `GO-MAIN.md`) | Phase 1: fast-forward `main` to it |
| `secacc` | worktree `H:\cwebuser\projects\VRG-DE\SecAcc` | nothing (merged as `2f08529`) | trim |
| `planner-sui` | worktree `H:\Dev-VRG\VRG-DE\wt-planner-sui` | nothing (R1018 is in main) | trim |
| `planner-stack` | worktree `H:\Dev-VRG\VRG-DE\wt-planner-stack` | **14 commits**: GO WIRE — wireway audit, T0–T6, two engine fixes | Phase 3: merge (7 conflicts, all small, listed) |
| `dev-all` | worktree `H:\cwebuser\projects\VRG-DE\wt-dev-all` | nothing of its own: planner-stack + Topology pack + a Konyha cherry-pick + one GO-ALL table edit | trim (sources are merged directly instead) |
| `origin/claude/planner-topological-viewer-f0yhxq` | GitHub only | **1 commit** `0424485` Topology View (TPO) design pack | Phase 2: merge (clean) |
| `origin/claude/new-session-mkexjy` | GitHub only | **1 commit** `53b8cc5` Views V8b Konyha line-art batch | Phase 2: merge (clean) |
| `origin/claude/github-repos-recommendation-10d64e` | GitHub only | **1 commit** `d390c8f` vendor-manifest: pdfjs from `legacy/build/pdf.mjs` | Phase 2: cherry-pick (clean) |
| `origin/bridge-docs`, `origin/planner-circuit-endpoints`, `origin/claude/busy-einstein-7zlx5u` | GitHub only | nothing | trim |
| remote `backup` (`H:\cwebuser\backups\Planner_VRG_U100-mirror`) | local mirror | — | **leave alone** (it is the backup) |

Unknown from the survey: **uncommitted files** in the six worktrees. Phase 0 finds them.

---

## Phase 0 — prepare (nothing changes yet)

**0.1 Stop the other sessions.** Close every Claude Code session working in SecAcc (secondary account),
wt-planner-stack, wt-planner-sui, wt-dev-all and the codecity worktree. Otherwise they keep writing
while you merge, and a worktree that is open cannot be removed in Phase 7.

**0.2 Open the main checkout** and confirm where you are:
```
git rev-parse --show-toplevel
git branch --show-current
```
Expect `H:/cwebuser/projects/VRG-DE/Planner_VRG_U100` (or the `H:/Dev-VRG/...` spelling of it) and `main`.

**0.3 Uncommitted work in every worktree.** Run each line and write down what it prints:
```
git -C "H:/cwebuser/projects/VRG-DE/Planner_VRG_U100" status --short
git -C "H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/.claude/worktrees/codecity" status --short
git -C "H:/cwebuser/projects/VRG-DE/SecAcc" status --short
git -C "H:/cwebuser/projects/VRG-DE/wt-dev-all" status --short
git -C "H:/cwebuser/projects/VRG-DE/wt-planner-stack" status --short
git -C "H:/cwebuser/projects/VRG-DE/wt-planner-sui" status --short
```
- Empty output = clean.
- **Known and expected:** an untracked `Calculator/CLA_vplan_upper-ghost.json` in wt-planner-stack.
  That file is tracked on `main` now, so this copy is not needed. Compare it first:
  `git diff --no-index "H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/Calculator/CLA_vplan_upper-ghost.json" "H:/cwebuser/projects/VRG-DE/wt-planner-stack/Calculator/CLA_vplan_upper-ghost.json"`
  (no output = identical).
- **Gitignored files are the trap.** `git worktree remove` (Phase 7) does **not** refuse because of ignored
  files: it deletes them with the folder. Client data lives in ignored places (`Calculator/*-baseline/`,
  `*.pdf`, `anonymise.map.json`, `Planner/data/`). List them per worktree, ignoring the rebuildable noise:
  ```
  git -C "H:/cwebuser/projects/VRG-DE/wt-planner-stack" status --short --ignored
  git -C "H:/cwebuser/projects/VRG-DE/wt-planner-sui" status --short --ignored
  git -C "H:/cwebuser/projects/VRG-DE/SecAcc" status --short --ignored
  git -C "H:/cwebuser/projects/VRG-DE/wt-dev-all" status --short --ignored
  ```
  Lines starting `!!` are ignored files. `node_modules/`, `dist/` pages that a build makes and `.cache/` can go.
  Anything else, especially under `Calculator/`, and any `.pdf` or `.json` client file, gets copied to the
  same relative path in the main checkout **if it is not already there** before Phase 7.
- For anything else, decide per item, **before** Phase 1:
  - (a) It belongs to that line: commit it **on that worktree's branch** (`git -C <worktree> add <files>`,
    then `git -C <worktree> commit -m "..."`). Phase 2/3 then merges it with the rest.
    Note: a commit on `planner-sui`, `secacc` or `dev-all` makes that branch carry something new again.
    Then merge it the way Phase 2 does (`git merge --no-ff <branch>`).
  - (b) It is scratch: leave it. Phase 7 refuses to remove that worktree until it is gone, so copy what you
    want to keep somewhere outside the repo first.
  - Client data in gitignored folders: see the `--ignored` check above.

**0.4 A safety tag for every line**, so everything stays reachable whatever happens next:
```
git tag archive/2026-10-23/main main
git tag archive/2026-10-23/worktree-codecity worktree-codecity
git tag archive/2026-10-23/secacc secacc
git tag archive/2026-10-23/planner-stack planner-stack
git tag archive/2026-10-23/planner-sui planner-sui
git tag archive/2026-10-23/dev-all dev-all
git tag archive/2026-10-23/bridge-docs origin/bridge-docs
git tag archive/2026-10-23/planner-circuit-endpoints origin/planner-circuit-endpoints
git tag archive/2026-10-23/claude-busy-einstein origin/claude/busy-einstein-7zlx5u
git tag archive/2026-10-23/claude-github-repos-recommendation origin/claude/github-repos-recommendation-10d64e
git tag archive/2026-10-23/claude-new-session origin/claude/new-session-mkexjy
git tag archive/2026-10-23/claude-planner-topological-viewer origin/claude/planner-topological-viewer-f0yhxq
```
Check with `git tag -l "archive/*"`: 12 tags. If anything goes wrong later, `git reset --hard archive/2026-10-23/main` on
`main` (in the main checkout) brings back today's start. Run it only after `git status` shows nothing you
want to keep.

---

## Phase 1 — `main` catches up with Kódváros (fast-forward, no merge commit)

`worktree-codecity` already contains all of `main` (merged as `1bf52e7`, conflicts resolved: CLAUDE.md,
START.cmd, vendor-manifest.json, vrg-vendor.html). So `main` only moves forward:
```
git merge --ff-only worktree-codecity
```
- Expect "Fast-forward" and about 17 commits. `GO-MAIN.md` (this file) is now in the main checkout too.
- If it says "Not possible to fast-forward", `main` got a new commit since 2026-10-23. Run
  `git merge --no-ff worktree-codecity` instead and resolve as in Phase 3.
- If it refuses because local changes would be overwritten, that is Phase 0.3 unfinished. Go back.

Check: `node tools/check-start.js` → "Rendben".

---

## Phase 2 — the three small GitHub-only commits (all apply cleanly)

```
git fetch origin
git cherry-pick -x d390c8f
git merge --no-ff origin/claude/planner-topological-viewer-f0yhxq -m "Merge the Topology View (TPO) design pack into main"
git merge --no-ff origin/claude/new-session-mkexjy -m "Merge Views V8b Konyha line-art batch into main"
```
- `d390c8f`: vendor-manifest note "load pdfjs from `legacy/build/pdf.mjs`" (+ `"entry"`). It matches the
  CLAUDE.md rule. After it, run `node tools/fetch-vendor.js --sync-page` and commit `vrg-vendor.html`
  if it changed: `git commit -am "vrg-vendor.html: resync after the pdfjs note"`.
- The two merges were dry-run on 2026-10-23 with no conflicts. If one now conflicts, resolve it the way
  Phase 3 does.
- `dev-all` also carries the Konyha batch, as a cherry-pick `fe41d2b` of the same patch. Merging the
  original here is what lets `dev-all` go in Phase 7 without losing it.

---

## Phase 3 — GO WIRE (`planner-stack`): the one real merge

```
git merge --no-ff planner-stack -m "Merge planner-stack (GO WIRE: wireway audit, T0–T6, engine fixes) into main"
```
The dry run gives **7 conflicts**. Every Planner one has the same shape: `planner-stack` added real logic
(T0 / T2) on lines that `main` had meanwhile **anonymised** (the client code → CLA). The rule each time: **take the
`planner-stack` side, then write CLA where it still has the old client code** (its old config file name → `cla.config.js`).

Paths below are under `Planner/projects/varler-planner/` unless they start at the root.

| # | File | Take | Resulting text (exact intent) |
|---|---|---|---|
| 1 | `CLAUDE.md` (root) | **both** | keep main's codephrase list and add the `GO WIRE` entry. Phase 5 rewrites the list anyway. |
| 2 | `src/08g-wf-slots.js` (~line 11) | planner-stack | `// Since T0 it IS that table (below). NOTE: 06a's own zone offset PT_OFF is 200 mm;` / `// the slots use the engine's 150 (450 for the panel column), which is what the CLA offers were built on.` |
| 3a | `src/08ob-wf-engine.js` (~line 8) | planner-stack | the 3-line comment `The CLA baseline engine (…) build.js puts it in 08fz-wf-baseline.js as BL (…; moved before 08g by T0 …)` |
| 3b | `src/08ob-wf-engine.js` (~line 27) | planner-stack | `const BL_OPT={cornerAll:false,congest:0.05};   // T2: the trunk's congestion term (× length × cables already there) · E5-Q4: cornerAll = the CLA rule (a box at every corner) — the BRIDGE option` (planner-stack glued two comments together; this is them, tidied) |
| 4 | `tests/spec-98-wf-engine.js` (~line 127) | planner-stack | its three lines (they save and restore `BL_OPT.congest` around the run), with `if(fs.existsSync(CLA))` and `'cla.config.js'`. The `CLA` constant is already defined higher up on main's side. |
| 5 | `tools/baseline/cla.config.js` (~line 15; git shows it as `cla.config.js` on the planner-stack side because main renamed the file) | planner-stack | both lines: `latchFrom: 'switches', // T0 / F4: CLA v1 voted the latch from the switches; …` and `cornerBoxes: 'all', // E5-Q4: the CLA rule …` |
| 6 | `tools/baseline/plan.js` (~line 8) | planner-stack | the whole block: the `rn` helper (room names in messages), `runHeights` with `(CLA 2850 → 2600 / 2450)`, `cornerAll`, and the T0/F4 door-latch `warn.push(...)` |
| 7 | `dist/varler_planner.html` | **neither by hand** | it is the build output: `git checkout --ours -- Planner/projects/varler-planner/dist/varler_planner.html`, then rebuild in step 3.3 |

**3.1** After editing, confirm no markers are left:
```
git diff --check
git grep -n -E "^(<<<<<<<|>>>>>>>)" -- Planner CLAUDE.md
```
Both should print nothing.

**3.2 Re-anonymise.** The merge brings CLA back in files that merged cleanly: `GO-WIRE.md`,
`docs/workflow/WIREWAY_AUDIT_2026-10-18.md`, `tools/baseline/README.md`, `prep.js`, `to-planner.js`. Main
also has a few of its own since the anonymisation (`src/06-wall-editor.js`,
`docs/research/2026-10-23_chase-sweep-cut-3d.md`).
```
node tools/anonymise.js
node tools/anonymise.js --apply
node tools/anonymise.js
```
The first run is a dry run: read the list. It should be exactly those files, plus whatever Phase 0.3
committed. The last run must report 0 changes and exit 0.

**3.3 Rebuild and test the Planner** (the conflicted engine files are in its build):
```
npm --prefix Planner/projects/varler-planner run build
npm --prefix Planner/projects/varler-planner test
```
- The baseline on 2026-10-22 was **3500 assertions + 70 golden, all green**. GO WIRE adds its own
  assertions, so expect more, all green.
- spec-98 runs the CLA v1 sketch only when the gitignored client file is present. With it present,
  "same plan" must hold.
- A failure in spec-98 or the wf-engine specs most likely means a conflict was resolved with the main
  side instead of planner-stack's. Re-read rows 3b and 4.

**3.4 Conclude the merge:**
```
git add -A
git commit
```
Keep the default merge message and add one line: "conflicts: planner-stack side + client code→CLA (GO MAIN
§3); re-anonymised; Planner rebuilt".

---

## Phase 4 — verify the whole consolidated tree

| Check | Command | Expect |
|---|---|---|
| START.cmd registry | `node tools/check-start.js` | "Rendben", exit 0 |
| Planner | `npm --prefix Planner/projects/varler-planner test` | all green (Phase 3.3) |
| VRG Kapu build + tests | `node tools/build-hub.js` then `node Hub/test/run.js` | 84/84 or more |
| Kapu strict | `node tools/check-hub.js --strict` | "Rendben" (GO STRICT's five programs are on main now) |
| Inventory | `npm --prefix Inventory test` | all pass |
| Kódváros | `node CodeCity/tools/selftest.js` | "all passed" (23) |
| Kódváros page | `node CodeCity/build.js` | builds; `git status` shows no change to `CodeCity/dist/vrg-codecity.html` |
| anonymisation | `node tools/anonymise.js` | 0 changes |
| nothing stray | `git status --short` | empty |

If a build step changed a tracked dist file, commit it:
`git commit -am "Rebuild dist after the consolidation"`.

---

## Phase 5 — make the docs say "one main"

Edit and commit in one go (`GO MAIN: docs point at main; worktree lines retired`):

1. **`CLAUDE.md` → Codephrases.** Every entry that names a worktree (`wt-planner-stack`, `SecAcc`,
   `codecity`, `wt-dev-all`) now says **main checkout, branch `main`**:
   - GO R1010, GO FRAME, GO V2, GO WIRE, GO ADAT were `wt-planner-stack`.
   - GO HUB was `SecAcc` / `secacc`. Its README §4 waiting items (setup steps 3–8, OneDrive links, the
     clean-profile check) stay open; only the place changes.
   - GO STRICT: done. Mark it so, or remove it.
   - GO CITY: parked (README §7). It stays.
   - GO ALL: **retired**. `dev-all` is replaced by `main`. Remove the entry, or mark it retired with a pointer to GO MAIN.
   - Add **GO MAIN** itself, marked done with the date.
2. **`CLAUDE.md` → Drive layout.** Say plainly: the real folder is `H:\cwebuser\projects\VRG-DE`;
   `H:\Dev-VRG\VRG-DE` is a junction to it. One repository, one checkout.
3. **The GO files with worktree paths** (`GO-R1010.md`, `GO-FRAME.md`, `GO-V2.md`, `GO-ADAT.md`,
   `GO-WIRE.md`, `GO-HUB.md`, `GO-CITY.md`, `GO-ALL.md`): replace the worktree path with the main checkout.
   Add a one-line "retired 2026-10-23, see GO-MAIN" at the top of `GO-ALL.md` and `GO-STRICT.md`.
   (`SECACC.md`, if present, gets the same retirement line.)
4. **`Planner/START.cmd`** NOTE block: one dated line, `2026-10-23 - consolidated into main (GO MAIN);
   no tool moved`. Then `node tools/check-start.js`. Keep CRLF: edit with an editor that preserves it.
   `.gitattributes` enforces it on checkout.

---

## Phase 6 — push `main`

```
git log --oneline origin/main..main
git push origin main
```
- The first command lists what is about to go up; expect the Phase 1–5 commits.
- The push must be a plain fast-forward on GitHub. If it is rejected, someone pushed to `main`
  meanwhile: `git pull --no-rebase origin main`, re-run Phase 4, push again. Never `--force`.
- Also push the archive tags, so the history of every trimmed branch stays on GitHub:
  `git push origin "refs/tags/archive/2026-10-23/*"`.

---

## Phase 7 — trim (only after Phase 6 succeeded)

**7.1 Prove each branch is in `main`** before it goes:
```
git branch --merged main
```
Expect `secacc`, `planner-sui`, `planner-stack`, `worktree-codecity`, and `main` itself. `dev-all` is **not**
listed (its own merge commits never reach `main`). Check it by content instead:
```
git cherry -v main dev-all
```
Every line should start with `-`, meaning the patch is already in main. The one expected `+` is `0768a53`
"GO ALL: add the Topology View branch to the branch table". That edit is to a file that Phase 5 retires,
so it is deliberately not kept. Any other `+`: stop and look at it.

**7.2 Remove the worktrees.** No `--force`: git refuses if a worktree has changes or untracked files,
which is what you want:
```
git worktree remove "H:/cwebuser/projects/VRG-DE/SecAcc"
git worktree remove "H:/cwebuser/projects/VRG-DE/wt-dev-all"
git worktree remove "H:/cwebuser/projects/VRG-DE/wt-planner-stack"
git worktree remove "H:/cwebuser/projects/VRG-DE/wt-planner-sui"
git worktree remove "H:/cwebuser/projects/VRG-DE/Planner_VRG_U100/.claude/worktrees/codecity"
git worktree prune
git worktree list
```
- The last command must show only the main checkout.
- "contains modified or untracked files": go back to Phase 0.3 for that worktree.
- Ignored files do **not** stop it and are deleted with the folder. That is why Phase 0.3 has the `--ignored` check.
- "Permission denied" / "Access denied": a program still holds the folder. Close the Claude Code
  session, editor or Explorer window that has it open. The CLAUDE.md lesson applies: a process list
  will not tell you which; the failed operation is the authority.

**7.3 Delete the local branches.** Use `-d`, which refuses anything not merged:
```
git branch -d secacc planner-sui planner-stack worktree-codecity
git branch -D dev-all
```
`dev-all` needs `-D` because of 7.1 (merge commits). Its content was proven present there, and its tip is
kept as the tag `archive/2026-10-23/dev-all`.

**7.4 Delete the remote branches on GitHub.** Each one is also kept as an archive tag (0.4, pushed in Phase 6):
```
git push origin --delete secacc planner-stack dev-all worktree-codecity bridge-docs planner-circuit-endpoints
git push origin --delete claude/busy-einstein-7zlx5u claude/github-repos-recommendation-10d64e claude/new-session-mkexjy claude/planner-topological-viewer-f0yhxq
git fetch --prune origin
git branch -a
```
The last command should show `main`, `remotes/origin/main` (+ `origin/HEAD`) and the untouched `backup/*`.
`planner-sui` was never pushed, so it has nothing to delete remotely.

**7.5 Folders left on disk.** `git worktree remove` deletes the worktree folders. Anything you chose to
keep in 0.3 (b) is wherever you copied it. `H:\Planner_VRG_U100`, if it still exists, is the old dead
original: see CLAUDE.md, `H:\Dev-VRG\_remove-old-copy.ps1`.

---

## Phase 8 — refresh the backup (optional, recommended)

The `backup` remote is a local mirror. Bring it to the consolidated state without deleting its own
history. Push only `main` and the tags, **not** `--mirror`, because a mirror push would delete its `backup/*` branches:
```
git push backup main
git push backup "refs/tags/archive/2026-10-23/*"
```

---

## Done when

- `git worktree list` → one line (the main checkout); `git branch -a` → `main` (+ backup/*).
- `origin/main` = local `main`; Phase 4 table all green on it.
- CLAUDE.md codephrases all point at the main checkout. GO ALL / GO STRICT are retired, GO MAIN is marked done.
- Tell the user: what was merged (Phase 1–3 commits), what was trimmed (7.2–7.4), anything parked in 0.3 (b).

**Parked, not part of this:** Kódváros fine-tuning (docs/city/README.md §7, a Claude Design batch candidate);
GO R1018 C6 pen feel; Kapu's setup checklist. All of them continue on `main` afterwards.
