# ServiceKit Terminal — plan (GO PTK, P0)

*Hungarian user text lives in `text.json`; this plan is a developer document, so it is English.*

## Goal

`TERMINAL.cmd` starts a menu that finds Claude Code on the PC, offers a folder, gates sign-in behind the owner's
phone (GitHub device flow), logs the access as an issue in a private repo, honours a remote **deny**, and wipes
credentials on exit. Around it: read-only tier checks with catalog-based suggestions, a ledger of everything the kit
put on the disk, an Agent Workshop bundle, and a disposable Windows Sandbox.

## How it maps onto the existing ServiceKit code

| Need | Reused | New |
|---|---|---|
| Start PowerShell without touching the machine policy | `START.cmd` pattern: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File` | `TERMINAL.cmd` |
| Paths, JSON (PS2-safe), `Get-Key`, OS facts, hashing, downloads, logging | `core/kit.ps1` (dot-sourced by `terminal/lib.ps1`) | — |
| Portable environment for Claude | `core/kitshell.cmd` (PATH, `HOME`, caches, `CLAUDE_CONFIG_DIR`) | `lib.ps1` calls it, then adds `GH_CONFIG_DIR` and the per-mode config dir |
| Program list, sources, sizes | `core/catalog.json` | P5 entries (`gh`, `ripgrep`, `fd`, `jq`, `uv`, `sqlite`, `claude-code`) with `version` + `sha256`; `setup.ps1` checks `sha256` when a source has one |
| Install / download | `core/setup.ps1` | writes ledger rows via `terminal/ledger.ps1` |
| System facts for checks | `core/collect.ps1` (`W`, `Get-Inventory` pieces), `Get-KitOS` | `checks/T0..T4.ps1` (read-only) |
| Windows Sandbox | `server.ps1` `Start-WindowsSandbox` (the Safe space panel) | `vm/wsb.ps1`: maps the whole kit read-only, starts Kit Shell inside |
| Dashboard | `server.ps1` + `launcher/app.js` (views, `call`, `act`) | a **Terminal** view and `/api/term*` routes |

## Files

```
ServiceKit/TERMINAL.cmd            entry point (CRLF)
ServiceKit/terminal/
  lib.ps1        paths, text.json loader, ASCII folding for the console, profile + session state, Claude settings
  text.json      HU / EN strings (the only file with accents)
  terminal.ps1   menu (TUI) and the launch flow
  detect.ps1     Claude installs, session folders (cwd from .jsonl), git repos, worktree plan
  gate.ps1       banner facts, gh device flow, access-log issue, deny parser + poller, wipe
  checks/        T0..T4 + run.ps1 (JSON per tier + one HTML report in <kit>\reports\<time>\)
  recommend.ps1  check results -> catalog ids, with reasons; uninstall suggestions are only listed
  ledger.ps1     <kit>\state\ledger.json; uninstall plan; full uninstall plan
  hooks/         worklines.ps1 (SessionStart), brief.ps1 (Stop throttled, SessionEnd)
  vm/            wsb.ps1, DESIGN-VM-V2.md
  tests/         Pester tests for the pure logic + parse-check.ps1
  profile.example.json  PLAN.md  DECISIONS.md  TESTING.md  README.md
```

## Phases

- **P0** this plan + `DECISIONS.md`.
- **P1** `detect.ps1`, worktree plan, `terminal.ps1` start screen. Pure functions: `Get-CwdFromJsonl`,
  `Get-SessionFolders`, `Get-SanitizedName`, `Get-WorktreePlan`.
- **P2** `gate.ps1` + hooks. Pure: `Format-AccessIssueBody`, `Test-DenySignal` (owner only), `Get-BriefText`,
  `Test-BriefDue`. Flow: banner → device flow → verify login = profile owner → repo private → issue → start Claude in
  its own window → poll every 60 s (deny / Claude exit) → wipe + comments.
- **P3** checks + `recommend.ps1`. Pure: `Test-TlsIntercepted`, `Get-Recommendations`.
- **P4** `ledger.ps1` + `setup.ps1` hook + Installs view (TUI + Dashboard). Pure: `Add-LedgerEntry`,
  `Get-UninstallPlan`, `Get-FullUninstallPlan`.
- **P5** catalog group `agent-workshop`, "install all missing" = `setup.ps1 -Ids <missing>`.
- **P6** `vm/wsb.ps1` (v1) + `vm/DESIGN-VM-V2.md`.

## Constraints kept

PowerShell 5.1 syntax (no `??`, `?.`, ternary, `&&`/`||`), ASCII-only `.ps1`, ASCII console output (accents are
folded), CRLF `.cmd`, no change to the machine execution policy, no secret in any committed file.
