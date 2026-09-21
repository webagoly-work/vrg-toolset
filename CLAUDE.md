# VRG toolset — working rules

The repo root is `H:\Planner_VRG_U100` (GitHub: `webagoly-work/vrg-toolset`, private).
Each tool is a self-contained HTML app; the Planner and Inventory additionally
have modular sources that build into one file.

## Drive layout

```
H:\
  Dev-VRG\                  <- the whole environment; this is what gets zipped
    VRG-DE\                 <- everything, same internal layout as before
      Planner_VRG_U100\     <- the git repo
      _installers\ _inbox\ _zipped\ _libs\ _desktop\ ...
    Start.cmd               <- shim -> VRG-DE\...\Planner\START.cmd
    VRG-DE-Launcher.cmd     <- shim -> VRG-DE\...\VRG-DE.cmd
  H_BACKUP_2026-09-16\      <- deliberately left outside; 8.1 GB, would double the archive
  _desktop                  <- JUNCTION -> Dev-VRG\VRG-DE\_desktop  (see below)
```

Both launchers at the `Dev-VRG` root are thin shims: the real menus stay in
the repo so they remain version-controlled and there is no second copy to keep
in sync. Each falls back to the pre-move location and says so, so they work
either way.

Nothing in the launcher needed re-pathing for the move, because `VRG-DE.cmd`
derives `DE` from `%~dp0` and `HROOT` from one level above it — so
`%HROOT%\_installers` resolves correctly in both layouts.

**The repo folder cannot be renamed while Claude Code has it open**, and
process checks will not tell you why. Two traps, learnt the hard way:

- Matching by process *name* is useless: the Claude desktop app and the CLI
  both run as `claude.exe` (20 processes here, most of them the app). A
  name-based check refuses forever no matter what the user closes.
- Matching by executable *path* is necessary but **not sufficient**. Claude
  Code watches its project directory, so it holds a handle even when its
  binary lives elsewhere — after an update it runs from
  `C:\Users\<user>\AppData\Roaming\Claude\claude-code\`, and a path check over
  `H:\` then reports "nothing is running from there" while the move still
  fails with Access Denied.

So: never conclude a folder is free from a process listing. Attempt the
operation, and treat its failure as the authority; list processes only as
hints. A rename of the repo root has to happen with Claude Code fully closed.

**`H:\_desktop` is a junction, not a folder.** It contains only the portable
Git that the Claude Code harness runs its shell from
(`H:\_desktop\Git\bin\bash.exe`), pinned by absolute path. Moving it into
`Dev-VRG` broke the Bash tool outright, so a junction keeps the old path
resolving while the real 357 MB lives inside `Dev-VRG` and travels with the
archive. Delete the junction only after pointing the harness at another Git —
the repo carries one at `Planner\apps\git`.

## VRG Digital Environment

`VRG-DE.cmd` at the repo root is the umbrella launcher. Projects sit in
categories (LEAD / UNDER-DEV), each project's build-test-serve actions live in
that project's own submenu rather than in one flat list, and there are
sections for dev tooling, standalone programs and a prompt library
(`tools/prompts/*.txt`). `Planner/START.cmd` still works and is not replaced.

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

## START.cmd is the front door — keep it current

`Planner/START.cmd` is the master launcher and the only entry point the user
actually goes through. **A tool that is not in it does not exist**, and an
entry pointing at a moved or renamed file is worse than a missing one: the
menu still looks complete and only fails when that number is picked.

So, whenever a change touches what tools exist or where they live — adding a
tool, renaming or moving a file, changing a build output path, retiring
something — check START.cmd in the same change and update it:

```bash
node tools/check-start.js
```

It verifies that every registered `T<n>_PATH` resolves, that `TOOLCOUNT`
matches the number of entries actually defined (an entry above TOOLCOUNT is
never shown in the menu), and it lists tool pages in the repo that the
registry has never heard of. Exit code 1 when something is wrong, so it can
gate a commit.

To add a tool: copy a `T<n>_NAME` / `T<n>_PATH` pair in the TOOL REGISTRY
section, bump the number, raise `TOOLCOUNT`, then run the check. Paths are
relative to the `Planner` folder, which is why the other tools start with
`..\`. Keep existing numbers stable — the user knows them by heart.

Also update the dated NOTE block at the top of START.cmd when the registry
changes, so the file says when it was last reconciled and what moved.

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
