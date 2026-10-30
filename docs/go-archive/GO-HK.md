> **Done 2026-10-30.** Result: `docs/housekeeping/AUDIT-2026-10-30.md` §5.

# GO HK — the housekeeping round (2026-10-30)

*You were started with the codephrase **GO HK**. This file is the whole briefing; it does not depend
on any memory note, so it works from any Claude account on this PC. The findings behind it are in
`docs/housekeeping/AUDIT-2026-10-30.md` (read §1–§3 first). The user answered HK-Q1…HK-Q7 there:
**all A** (§4). Do not ask them again.*

## 0. Where and the hard rules

- The main checkout `H:\VRG\Full\Planner_VRG_U100`, branch **`main`**. Confirm with
  `git rev-parse --show-toplevel` and `git branch --show-current` before anything.
- The user said yes to the commits and local merges this round (HK-Q1, HK-Q2). **No push** to any
  remote (HK-Q3). Do not delete any branch on GitHub. Do not switch branches in this checkout; merge
  into `main` here.
- Never commit `Planner/apps|home|data`, `*.pdf`, `Vendor/`, `H:\VRG\Full\_admin\keys`. Never make `H:\`
  a repo. Never ask for, type or store a password, token or 2FA code.
- Nothing is deleted on disk this round: clutter is **moved** to `H:\VRG\Backup\archive\…`, old
  OneDrive folders to `VRG-Megosztott\_archiv\`. The user deletes later.
- Moving folders on H: — the traps are in `CLAUDE.md` → Drive layout (handles held by claude.exe,
  Avast vs fresh PowerShell, >260-char paths, the harness's git bash path).
- Phase the work. **Stop at each ⏸** and report in a few lines before going on.
- Planner tests in a worktree or fresh clone need `NODE_PATH` (the project's own `node_modules`);
  in this checkout `npm test` in `Planner/projects/varler-planner` works. `npm test` does not build:
  run `npm run build` first when the dist matters.

## 1. Safety snapshot (first, before any commit or merge)

1. `git stash list`, `git status -sb` (expect: ahead 1, behind 4, ~201 changed/untracked).
2. Copy the untracked `launcher/` and `tools/hub-admin/` folders to
   `H:\VRG\Backup\archive\hk-2026-10-30\untracked\` (plain copy). They exist nowhere else.
3. Tag the current tip: `git tag archive/2026-10-30/pre-hk`.

## 2. Commit the local work (HK-Q1 = A)

Run the checks first:

```bash
node tools/check-start.js
node tools/build-hub.js
node Hub/test/run.js
node tools/check-hub.js --strict
powershell -File launcher\test\selftest.ps1
```

plus `npm run build` + `npm test` in `Planner/projects/varler-planner` and `Inventory`. A red suite
is reported, not hidden; a group whose suite is red is still committed only if it was red before
this round too (say so in the commit message).

Then grouped commits, in this order (one commit each; message = what + why, the attribution line the
session gives you):

1. **START launcher + shims**: `launcher/` (all), `Planner/START.cmd`, `VRG-DE.cmd`, the
   `.gitattributes` change if any. Check every `.cmd` is CRLF before adding.
2. **Re-root path rewrite** (the 49 path-only files: `H:\cwebuser` / `Planner\apps` → `H:\VRG\Full`).
3. **Mélyvíz P6b** — Planner inline colours (`Planner/projects/varler-planner/**` + its dist).
4. **Kódváros** (`CodeCity/**`).
5. **Kapu**: `Hub/**`, `tools/hub-admin/`, `tools/build-hub.js`, `docs/hub/**` (checklist, colleague
   guide + its 3 images, the removed old images).
6. **Firmware / BRIDGE / research** (planner-cyd, board-console, knobpad, `BRIDGE/**`, `docs/research/**`).
7. **GO files, CLAUDE.md, SECACC.md, `docs/housekeeping/`, this `GO-HK.md`.**

Use `git add <paths>` per group, never `git add -A` across groups. After the last one,
`git status` must be clean except ignored files. If a file fits no group, list it and ask.

⏸ Report: the commit list (`git log --oneline -8`) and any suite that is red.

## 3. Merge the GitHub-only work (HK-Q2 = A)

`git fetch origin` and `git fetch backup` first. Merge with `--no-ff`, one branch at a time, the
suites from §2 after each:

| Order | Branch | Expect |
|---|---|---|
| 1 | `origin/main` (AirDeck / VRG Légegér, 4) | clean |
| 2 | `origin/ccr-3aebf098-ytpsqa` (VRG Mobile M1–M2) | **`Planner/START.cmd`**: keep ours (the shim); move the Légegér / Mobile entries into `launcher/vrg-menu.json` with free keys, then `node tools/check-start.js`. **`CodeCity/dist/*`**: take either side, then rebuild Kódváros. |
| 3 | `origin/claude/planner-topological-viewer-f0yhxq` (GO-ROUTE.md, money-path audit, Topology View r2) | clean |
| 4 | `origin/servicekit-drop` (ServiceKit, 111 files) | clean; leave `H:\Personal\ServiceKit` alone |
| 5 | `origin/planner-sui` (Simple-UI S0–S6, 1 WIP commit) | clean; then Planner build + test, Simple-UI must still be off by default |
| 6 | `backup/docs/cloudflare-ecosystem` | conflict in `docs/city/README.md`: keep both sections (ours first, the Cloudflare §8 after) |

`origin/claude/gracious-pasteur-vakjwf` and `origin/ccr-b9501064-28qdxi` are subsets: confirm with
`git branch -a --merged main` after the merges, no merge needed. `backup/claude/github-repos-recommendation`
is already in `main` (check the same way).

After all six: rebuild every dist (Planner, Inventory, Kapu, Kódváros), run every suite, then
`node tools/check-start.js` and `node tools/build-hub.js`. Commit the rebuilt dists if they changed.

Then the worktree: `git worktree remove .claude/worktrees/cloudflare-ecosystem` **only** if
`git -C .claude/worktrees/cloudflare-ecosystem status` is clean.

⏸ Report: what merged, how each conflict was resolved, the new keys added to the menu, test results.

## 4. Backups and clutter (moves only)

1. Run BACKUP sync (`launcher/vrg-launch.cmd backup` → 1, or `launcher/backup.ps1` per its README)
   so the bare backup `H:\VRG\Backup\code\Planner_VRG_U100.git` holds the new `main` and tags.
2. Now that AirDeck is in `main`: move `H:\VRG\Backup\code\wt-airdeck` and
   `H:\VRG\Backup\code\Planner_VRG_U100-mirror` to `H:\VRG\Backup\archive\parked\2026-10-30\`.
   The `backup` remote is the bare `H:/VRG/Backup/code/Planner_VRG_U100.git` (checked 2026-10-30), not
   the mirror; confirm with `git remote get-url backup` before moving. CLAUDE.md's first paragraph
   still calls the mirror the backup remote: correct it to the bare repo.
3. `H:\VRG\Full\inbox\_sort\for-deletion` (463 MB) → `H:\VRG\Backup\archive\for-deletion-2026-10-30\`.
   `Backup\archive\parked\2026-10-27\git-planner` stays where it is (already parked).
4. `H:\VRG\Full\inbox`: sort only what is obvious — client PDFs to the job folder in
   `H:\VRG\Full\jobs\<job>` when the job code is in the name, BRIDGE drafts to `H:\VRG\Full\BRIDGE\_inbox`,
   Kapu/BRIDGE HTML exports to `H:\VRG\Full\inbox\_sort\exports`. Everything else stays; list it.
5. Missing installers in `H:\VRG\Backup\installers` (dotnet, electron, 7zip, CrystalDiskInfo): do not
   download. Write the list into `docs/housekeeping/AUDIT-2026-10-30.md` §5 for the user.

⏸ Report: moved paths + sizes, the inbox leftovers list.

## 5. The shared OneDrive tree on H: (HK-Q4 = A)

1. Create `C:\Users\webag\OneDrive\VRG-Megosztott` with the folders from `docs/hub/hub-seed.json` →
   `onedrive.folders`: `00_START`, `10_Projektek`, `20_Telepitok`, `30_Nagy_fajlok`, `40_Vizualis`,
   `50_Kutatas`, `90_Naplok`, plus `_archiv`. Put a short `OLVASS_EL.md` (HU + EN italic) in each,
   from that file's `d` / `dEn` text.
2. Junction: `cmd /c mklink /J H:\VRG\Shared C:\Users\webag\OneDrive\VRG-Megosztott`. Check that a
   file written through `H:\VRG\Shared` appears under the C: path.
3. `node tools/build-hub.js --onedrive H:\VRG\Shared\00_START` (copies `vrg-kapu.html` + `OLVASS_EL.md`).
4. Do **not** share it — sharing ("Adott személyek" only) is the user's click (setup checklist step 6).
5. Add `H:\VRG\Shared` to the Drive layout block in `CLAUDE.md` (one line: junction → OneDrive,
   never a repo, client files only there).

## 6. Merge the two VARLER folders (HK-Q5 = A)

Sources: `C:\Users\webag\OneDrive\VARLER Documents-` (305 files, call it ROOT) and
`C:\Users\webag\OneDrive\Asztali gép\VARLER Documents-` (250 files, DESK).
Target: `C:\Users\webag\OneDrive\VRG-Megosztott\10_Projektek\_VARLER Documents`.

1. **Copy** (not move) ROOT into the target, keeping the tree.
2. For each DESK file: missing in the target → copy in (18 expected). Identical by hash → skip (223).
   Different (9 expected: `BUDAKALASZ_TERV.sxe(.bak)`, `DOMOSZLOTERV.sxe(.bak)`, `KIRALY.sxe(.bak)`,
   `KKHO_installation.sxe(.bak)`, `20260612_log.txt`) → the newer LastWriteTime keeps the name, the
   other goes to `_utkozesek\<relative path>\<name>.<yyyy-MM-dd>.<ext>`.
3. Verify: every file of ROOT and DESK exists in the target or `_utkozesek` with an identical hash.
   Write the script and its report to `docs/housekeeping/varler-merge-2026-10-30.md` (paths and
   counts only, no file contents).
4. Only after the check passes: move both old folders to `VRG-Megosztott\_archiv\VARLER-root-2026-10-30`
   and `…\VARLER-asztali-2026-10-30`. OneDrive may hold handles: if a move fails, wait for the sync
   and retry once, then report.

⏸ Report: counts (copied / identical / conflicts), the conflicts table, where the old folders went.

## 7. GO files (HK-Q6 = A)

1. `git mv` to `docs/go-archive/`: `GO-ALL.md`, `GO-STRICT.md`, `GO-R1010.md`, `GO-FRAME.md`, the old
   `GO-MAIN.md` (as `GO-MAIN-2026-10-24.md`), and the merged sources below once merged. Add
   `docs/go-archive/README.md`: one line per file — what it was, done/retired date, where its open
   items went.
2. New / merged GO files at the repo root, each in the GO HUB shape (Where · What · Read first · Open
   · Check · Ask), every path checked to exist, no dead `H:\Dev-VRG`, `H:\cwebuser`, `Planner\apps`
   or `planner-stack` reference:
   - **GO PLANNER** ← R1018 (only the C6 Mozi fal pen feel), SUI (waits at the S6 ⏸ look), the open
     items of R1010 and FRAME (read them; Planner round 2026-10-10 G2, the CLA-ADD-001 extras, the
     SmartFrame Planner pack), the Views D-V9-6 state, the workflow round E6-Q1…Q4.
   - **GO ROUTE** ← WIRE (T0–T6 done, T7 deferred) + ROUTE (from the merged branch) + the money-path
     audit.
   - **GO CLA** ← V2 + ADAT (ADAT waits on ADATRETEG-Q-001); fix the V2 paths.
   - **GO CITY** ← CITY + LIVE (CITY parked tuning; LIVE = KV-01…KV-27 for the secondary account).
   - **GO HUB**: add §7 below.
   - **GO OPENWRT**: unchanged.
   - `GO-SUI.md` (from the merge) → archive once folded into GO PLANNER.
3. Update `CLAUDE.md` → Codephrases to exactly the live set: MAIN, HK (done), PLANNER, ROUTE, CLA,
   CITY, HUB, OPENWRT, plus one line pointing at `docs/go-archive/README.md` for the old phrases (so
   an old codephrase typed by habit leads to its successor).

## 8. GO HUB additions (HK-Q7 = A: written, not built)

Add to `GO-HUB.md` as open WPs, with a short design note each, no code:

- **WP-G1 Vendég (guest) mode** — a "Belépés vendégként" button on the sign-in card: no token, read-only
  view (the tool list without Megnyitás/Mappa or START, the dashboard read-only once it exists),
  a clear "Vendég — csak olvasás" badge. Open points as A/B/C questions: does a guest need any
  identity, what exactly is visible, does it work in links-only mode.
- **WP-S1 Shared folders via Kapu sign-in** — after sign-in, the person's shared OneDrive folders
  (`VRG-Megosztott` tree, per role/layer from the allowed list) as cards with "Megnyitás"; owner sees
  all, member their layers, guest none. Folder paths/links live in the signed list, never tokens.
- **Housekeeping note — TNT**: `C:\Users\webag\OneDrive\TNT` (9 174 files, 5.2 GB, the shared place
  today) mixes job folders (`-Jelenleg futó munkák-`, `Befejezett`, `Meghíusult`, `Varler`) with
  personal (`suli`, `számlák`). Future round: job folders into `VRG-Megosztott\10_Projektek` by job
  code, personal out of the shared tree, then retire TNT as a share. Not this round — needs the
  user's per-folder OK.

## 9. The new GO MAIN (last)

Write a new `GO-MAIN.md`: the overall entry point a fresh session starts with.

- State of the codebase after this round (one table: line of work → where it lives → its GO).
- The order of work across GOs (what is blocked on the user, what can run now, what is for the
  secondary account).
- The standing rules (no push unasked, the never-commit list, START registry, CRLF, the drive
  layout, the shared tree on `H:\VRG\Shared`).
- How to pick up: "say GO <NAME>".

Mark `GO HK` done in CLAUDE.md.

## 10. End

1. All suites green (or the pre-existing reds listed), `git status` clean, `git log origin/main..main`
   shown to the user — **they push**, or tell you to.
2. Run BACKUP sync once more.
3. Final report: commits, merges, moves, the OneDrive tree, the GO list, and what is waiting on the
   user (push, OneDrive share, setup steps 4–6, the S6 look, the C6 pen feel, ADATRETEG-Q-001).

## Ask

Questions to the user as numbered items with lettered options (A recommended first), so they can
answer in one line. User working style: phase big work, stop at checkpoints, Hungarian UI text with
English in italics below, English code.
