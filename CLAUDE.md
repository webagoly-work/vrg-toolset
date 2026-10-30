# VRG toolset — working rules

The repo root is `H:\VRG\Full\Planner_VRG_U100` (see Drive layout)
(GitHub: `webagoly-work/vrg-toolset`, private). **`H:\VRG\Backup\code\Planner_VRG_U100-mirror`
is the git `backup` remote, not a second workspace** — push to it from time to
time, never work in it. A copy like it was mixed up with the working copy once
and a full session's work landed in the backup; reconciling them cost real
effort. Confirm with `git rev-parse --show-toplevel` if ever unsure.
Each tool is a self-contained HTML app; the Planner and Inventory additionally
have modular sources that build into one file.

## Drive layout

**One work root, one personal root** (re-rooted 2026-10-27; the plan and the
move scripts are in `H:\VRG\Full\_admin\reorg`). One repository, one checkout:
every line of work is on `main` here; the only other worktree is the docs
branch in `.claude\worktrees\cloudflare-ecosystem`.

```
H:\
  VRG\                          <- WORK: everything program- and job-related
    run.exe  START.cmd  BACKUP.cmd  OTG.cmd      (launchers, step 3-4 of the re-root)
    Full\                       <- the working version
      Planner_VRG_U100\         <- the git repo  (THE working copy)
      BRIDGE\ BRIDGEcomp\ ESP_lab\ Varler_Workflow_Kit\ VRG_Visual_Base\ wifi-heatmapper\ _handoff\
      jobs\                     <- P33, NV4, BK2, DM1, Planner_projektek_*, temp_batch
      tools\                    <- dev toolchain: git node dotnet electron vscode chrome* arduino-cli js-libs
      programs\                 <- user programs: VLC zen opera-gx 7zip keytweak HWiNFO WizTree CrystalDiskInfo
      inbox\  notes\  research\  home\claude-account-b\  _admin\
    Backup\                     <- lightweight: code\ (the git backup remote), installers\, archive\
    OTG\                        <- portable / showcase build; kit\ = the USB kit
  Personal\                     <- MC-Server, RL-CYD, FlyBrainLab (+ its miniforge3), GodsEyeView
```

There is no `Planner\apps` any more (removed 2026-10-27, re-root phase 3.2b):
code reaches the portable toolchain next to the repo — from the repo root
`path.join(path.dirname(REPO), 'tools', ...)` in Node, `%REPO%\..\tools\...` in
batch files, `{full}\tools\...` / `{node}` in `launcher/vrg-menu.json`. Browsers
and user programs (Opera GX, Zen, VLC, ...) are in `Full\programs`. One git:
`Full\tools\git` (the duplicate `git-planner` is parked in
`Backup\archive\parked\2026-10-27`). Older paths (`H:\Dev-VRG\VRG-DE\...`,
`H:\cwebuser\...`, `H:\_desktop\Git`, `Planner\apps\...`) no longer resolve; do
not write them into new files.
`Personal\FlyBrainLab\_libs\miniforge3` keeps a junction at its old place for
good: a conda install cannot be relocated.

**Moving or renaming folders on H: — traps learnt the hard way:**

- **Process checks do not tell you whether a folder is free.** The Claude
  desktop app and the CLI all run as `claude.exe`; Claude Code holds a handle
  on its project folder even when its binary lives on C:, and a shell whose
  current directory is inside the folder holds one too (so never `cd` the
  Bash tool into a folder that is about to move). Attempt the operation and
  treat its failure as the authority.
- **Avast blocks freshly started script processes.** A new
  `powershell -File ...` got "Access is denied" renaming large folders for
  minutes on end, while the same rename from an already-running shell
  worked at once. Run move scripts in-process (`& script.ps1`).
- **Paths over 260 characters** (they exist in `inbox`) make `Move-Item` and
  cmd `move` fail. Use `MoveFileEx` with the `\\?\` prefix; the reorg scripts
  show how.
- **The Claude Code harness runs its shell from `H:\VRG\Full\tools\git\bin\bash.exe`**
  (`CLAUDE_CODE_GIT_BASH_PATH`, set 2026-10-27; the Machine PATH points at the
  same git). Moving or renaming `Full\tools\git` breaks the harness's shell:
  change that variable first.

## The START launcher (`launcher/`)

Since 2026-10-27 (re-root phase 3.2) there is one menu: `launcher/vrg-ui.ps1`
draws it in the Mélyvíz 8-bit style and `launcher/vrg-menu.json` is its only
registry — tools (keys 1-9, 0, K), project submenus (P Planner, I Készlet,
Y CYD, U Board Console, V Vendor) with their build/test/serve actions, dev
items, the local servers (O), the programs (A) and the prompt library
(`tools/prompts/*.txt`). `Planner/START.cmd` and `VRG-DE.cmd` only forward to
`launcher/vrg-start.cmd`, so every shortcut keeps working. The Node side
(Kapu build, Kódváros segéd) reads the same JSON through `launcher/menu.js`.
`vrg-ui.ps1` must stay ASCII (Windows PowerShell 5.1 misreads accents in a
BOM-less script); Hungarian text lives in the JSON's `ui` block.
`powershell -File launcher\test\selftest.ps1` renders every screen offline and
checks its geometry and keys.

Windows and shims (phase 3.4): `H:\VRG\START.cmd`, `BACKUP.cmd`, `OTG.cmd` call
`launcher/vrg-launch.cmd <start|backup|otg>`, which opens the menu in the
portable Windows Terminal (`H:\VRG\Full\tools\terminal`, `.portable` marker,
its own `settings\settings.json` with profile VRG + scheme Melyviz; zip kept in
`Backup\installers`) and falls back to the plain console when WT is missing,
when already inside WT (`WT_SESSION`), or with `--console` / `VRG_CONSOLE=1`.
Other arguments go through to `vrg-ui.ps1`. In cmd, `shift` also shifts `%0`:
take `%~dp0` before any shift. BACKUP and OTG are `items` list menus (no git,
no exit guard) until phases 3.5 / 3.6 fill them. WT has no greyable X, so
there only Q / Esc / Ctrl+C go through the exit guard.

BACKUP (phase 3.5, `launcher/backup.ps1`, settings in the registry's `backup`
block): 1 sync = `git push --all/--tags` to each repo's bare backup
(`Backup\code\<name>.git`, created on first use, a diverged branch is reported,
never forced; a `backup` remote pointing elsewhere is left alone) + the work
folders (BRIDGE, BRIDGEcomp, ESP_lab, jobs, notes, Varler_Workflow_Kit,
VRG_Visual_Base, _handoff) mirrored into `Backup\code\work`. **Nothing is lost:**
a file the backup would overwrite or drop is moved to
`Backup\archive\sync\<stamp>\` first, and an emptied or missing source folder
is skipped, never wiped. 2 integrity = `git fsck` + every backed-up file
re-hashed against `Backup\logs\manifest.tsv`. 3 = the newest
`Backup\logs\sync-*.json`. 4 restore = a file or folder from the backup or any
archived copy; overwrites, never deletes, the current copy saved to
`Backup\archive\restore\<stamp>\` first. 5 = installer per `tools\` /
`programs\` folder (`installerRules`). Tests: `test\backup-selftest.ps1`,
`test\backup-e2e.ps1` (throwaway folders only). PowerShell 5.1 traps met here:
piping strings into git adds a BOM (pass lists through files), and a BOM-less
test script misreads accented literals (match an ASCII part).

Commit + push (phase 3.3, `launcher/vrg-git.ps1`): the status row counts each
work repo's changes (`git status -uall`) and commits not on origin; **S** commits
the current branch (`git add -A`) and pushes `HEAD:launcher-collect` — never
`--force`, never any other branch on origin; when launcher-collect has diverged
it falls back to `launcher-collect-YYYY-MM-DD` (then `-2` … `-9`). Secret-looking
names (`.env`, `*.pem`, `credentials*.json`, …), token/private-key contents and
files over 5 MB stop that repo. Q / Esc / Ctrl+C with unpushed work open the
exit guard (C commit + push / L leave / B back), and the window's X is greyed
meanwhile. `test\git-selftest.ps1` (functions) and `test\git-e2e.ps1` (the real
key loop via the test-only `-Keys`) run against throwaway repos in `%TEMP%\VRG`
— never test the flow on a real repo.

**Batch files must be written with CRLF line endings.** With LF, cmd.exe
silently mis-parses multi-line parenthesised blocks — single-line `if ... goto`
keeps working while every `for (...)` block quietly stops matching, so the
menu renders but nothing can be selected. `.gitattributes` enforces
`*.cmd text eol=crlf` on checkout, but a file written directly to disk needs
converting. Two further cmd traps this launcher already hit:

- Never `goto` out of a `for (...)` block; set a flag and jump after it.
  Otherwise cmd loses its place and later fails on a label that does exist.
- Inside a parenthesised block, echo values via `!delayed!`, not `%~1`. A name
  containing brackets, like `VRG BuildTree (modder)`, closes the block early
  because argument substitution happens before the block is parsed.
- `timeout /t` errors when stdin is redirected; use `ping -n N 127.0.0.1 >nul`.

Console output from the launcher and its helpers stays ASCII-only — accented
Hungarian garbles under the console codepage.

## START is the front door — keep its registry current

The START menu is the master launcher and the only entry point the user
actually goes through. **A tool that is not in `launcher/vrg-menu.json` does
not exist**, and an entry pointing at a moved or renamed file is worse than a
missing one: the menu still looks complete and only fails when that key is
picked.

So, whenever a change touches what tools exist or where they live — adding a
tool, renaming or moving a file, changing a build output path, a server's
script or port, retiring something — update `launcher/vrg-menu.json` in the
same change and run:

```bash
node tools/check-start.js
```

It verifies that every file the registry names exists (tool pages, step
commands, server scripts, programs — an `optional` program that is missing is
only listed), that no screen uses a key twice and no two servers share a port,
that the old `START.cmd` / `VRG-DE.cmd` still forward to the launcher, and it
lists tool pages in the repo that the registry has never heard of. Exit code 1
when something is wrong, so it can gate a commit. After a tool change also
rebuild the Kapu (`node tools/build-hub.js`), which bakes the tool list in.

To add a tool: add an entry to `start.tools` with a free key. Paths use the
tokens `{repo}`, `{full}`, `{vrg}` and the `paths` shortcuts (`{planner}`,
`{node}`, ...). Keep existing keys stable — the user knows them by heart.

## Things that must not be committed

`.gitignore` covers these; do not defeat it.

- `Planner/apps/`, `Planner/home/`, `Planner/data/` — portable Chrome/VS Code/
  Node plus a browser profile and `.credentials.json`. Secrets and gigabytes.
- `*.pdf` — client quotes carry names and addresses.
- `Vendor/` — fetched third-party source, rebuildable with
  `node tools/fetch-vendor.js --all`.
- `Inventory/.cache/`, `Inventory/price-check-*.json` — regenerable.

Never make `H:\` itself a repository; it contains `.ssh`.

## Vendored third-party code

`vendor-manifest.json` plus `tools/fetch-vendor.js` own everything under
`Vendor/`. Source that will be read or adapted is pinned to a **tag**
(`refType: "tag"`), never a branch — a branch quietly becomes different code
tomorrow, and the provenance of an adapted function then becomes unknowable.
npm-sourced components (`source: "npm"`) pin an exact version and their
sha512 integrity digest is checked before anything is extracted.

When code is copied out of `Vendor/` into one of our apps, the copyright
notice travels with it. MIT and BSD-3 both require it, and BSD-3 adds a
no-endorsement clause.

`Vendor/pdfjs` must be loaded from `legacy/build/pdf.mjs`. The modern
`build/pdf.mjs` calls `Uint8Array.prototype.toHex()`, which Node v24.18.0 does
not implement, and throws at import.

## Testing browser apps

`localStorage` does not work from `file://` or `data:` — both give a null
origin and saving fails silently. Serve the folder instead:
`node MindMap/serve.js` (port 8124) or `npm run serve` in `Inventory`
(port 8123). Verify colour-carrying behaviour by reading *computed* styles,
not by looking at a screenshot; a CSS specificity bug once left finished
symbols grey while every class was correct and every test passed.

## Codephrases

All of them run in the **main checkout `H:\VRG\Full\Planner_VRG_U100`, branch `main`** (one checkout since GO MAIN, 2026-10-24).

- **`GO HK`** — read `GO-HK.md` at the repo root and do what it says: the housekeeping round from
  `docs/housekeeping/AUDIT-2026-10-30.md` (HK-Q1…Q7 all A): commit the local work, merge the
  GitHub-only branches + SUI into `main` (no push), park clutter, the shared OneDrive tree
  `H:\VRG\Shared`, merge the two VARLER folders, consolidate the GO files, then write the new GO MAIN.
- **`GO R1010`** — read `GO-R1010.md` at the repo root (main checkout, branch `main`)
  and do what it says: continue the Planner round 2026-10-10, then the CLA-ADD-001 extras.
- **`GO FRAME`** — read `GO-FRAME.md` at the repo root (main checkout, branch `main`)
  and do what it says: the BRIDGE SmartFrame (BSF) concept: research, IDEA-003, tune with the user,
  then the BRIDGE doc and (after round 2026-10-10 is built) the Planner pack. No code.
- **`GO V2`** — read `GO-V2.md` at the repo root (main checkout, branch `main`)
  and do what it says: the CLA second version — v1 (VG-2026-CLA-01) fully built + every other BRIDGE layer
  prepared (conduit, cable pulled, boxes, niches; no hardware), quick survey-precision quantities and prices vs v1,
  a per-room ESPHome marketing list; then hand the fair-price calculation to the Workflow Kit session (V2_FELADAT.md).
- **`GO R1018`** — read `GO-R1018.md` at the repo root (main checkout, branch `main`) and do what it says:
  continue the Planner round 2026-10-18 (Födém · Igénylista · Házimozi, all built + committed 2026-10-19):
  only the C6 Mozi fal pen feel is open.
- **`GO WIRE`** — read `GO-WIRE.md` at the repo root (main checkout, branch `main`)
  and do what it says: the wireway routing rebuild — the dual model, configuration K1 (decisions 2026-10-18, all A),
  build order T0–T7 from `docs/workflow/WIREWAY_AUDIT_2026-10-18.md` (T0–T6 merged into `main` 2026-10-24).
- **`GO ADAT`** — read `GO-ADAT.md` at the repo root (main checkout, branch `main`) and do what it says.
- **`GO HUB`** — read `GO-HUB.md` at the repo root (main checkout, branch `main`) and do what it says:
  VRG Kapu. **Reworked 2026-10-26**: Kapu is now only the access page (GitHub sign-in + the signed
  allowed list → START.cmd and its tools) until the dashboard exists. The board, editor, Munkanapló and
  the rest are parked for Kódváros in `CodeCity/from-kapu/`; the `docs/hub/` pack describes the old,
  full Kapu. Still open from it: setup steps 3–6 (push, invite, 2FA, the OneDrive `00_START` share),
  the clean-profile check.
- **`GO CITY`** — read `GO-CITY.md` at the repo root and do what it says: VRG Kódváros, the codebase-as-a-city
  viewer (C1–C10 on `main`; **parked**: base fine-tuning from the user's dev notes, a later Claude Design
  batch candidate — README §7). New WPs start from `main`.
- **`GO LIVE`** — read `GO-LIVE.md` at the repo root and do what it says: build Kódváros into the live
  workspace / GitWorld / overlay OS from the prompt series `docs/city/PROMPTS-WORKSPACE.md` (KV-01 …
  KV-27, research in `docs/research/reports/Kódváros live workspace and GitWorld.md`). Meant for the
  secondary account (start steps in GO-LIVE §0); one prompt per step, commit, never push.
- **`GO OPENWRT`** — read `GO-OPENWRT.md` at the repo root and do what it says: prepare, guide and verify
  OpenWrt on the TP-Link TL-WR1043ND (the user flashes; Claude never touches the router). Asked for 2026-10-26
  with CITY-D24; phases P0–P5, the first is the sticker's hardware version.
- **`GO MOBILE`** — read `GO-MOBILE.md` at the repo root and do what it says: VRG Mobile, the companion app
  (`Mobile/`, Légegér is its first feature), one WP at a time from `docs/mobile/` (M0 done, M1 + M2 built 2026-10-29). Made for
  **cloud sessions**: the APK is built by GitHub Actions, not in the sandbox (`docs/mobile/CLOUD.md`). Exception to
  "one checkout, branch main": start from `claude/gracious-pasteur-vakjwf` until PR #2 is merged, and push your own branch.
- **`GO ROUTE`** — read `GO-ROUTE.md` at the repo root and do what it says: new wiring features with the
  Budakalász job as the basis and a PCB-style autorouter (rip-up-and-reroute, negotiated congestion) as the model.
  Follows `docs/workflow/MONEY-PATH-AUDIT_2026-10.md`; starts by asking the user (job, features, router scope, licences).
  Includes the **Topology View** (merged 2026-10-29): the netlist / ratsnest view over the GO WIRE up-tree,
  pack `Planner/projects/varler-planner/docs/topology/` (TV0–TV12; engine gaps G1–G8 = candidate features).
- **`GO STRICT`** — **done**: the five programs VRG Kapu links to are on `main` (`check-hub --strict` → Rendben). Retired.
- **`GO ALL`** — **retired** 2026-10-24: `dev-all` is replaced by `main`. See GO MAIN.
- **`GO MAIN`** — **done** 2026-10-24 (`GO-MAIN.md`): every line consolidated into `main`, the other
  branches and worktrees trimmed. Parked WIP, not in `main`: tags `archive/2026-10-24/planner-stack-wip`
  (Views plan-sheet / rbx specs) and `archive/2026-10-24/planner-sui-wip` (Simple-UI mode).
