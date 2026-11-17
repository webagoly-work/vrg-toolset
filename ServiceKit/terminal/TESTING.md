# ServiceKit Terminal — testing

## What was run, and where

Written in a Linux cloud container **without PowerShell**: installing PowerShell 7 there was refused, so **no
PowerShell code in this folder has been executed, and none of it is known to work.** What did run:

- `node tests/lint.js` — passes. It checks that every `.ps1` is ASCII, has balanced braces and parentheses outside
  strings and comments, and has no PowerShell 7-only operators (`??`, `?.`, `&&`, `||`, `?[`); that every `.cmd` is
  CRLF; that every JSON file parses; and that every literal text key used by `TT` / `TB` / `Write-TermBoth` exists in
  both languages of `text.json`. It is a rough guard, not a parser.
- `node --check launcher/app.js` — passes (syntax only; the Terminal view was not rendered).
- The six pinned downloads were fetched and hashed (`sha256sum`), and each hash was compared with the publisher's own
  checksum file (gh `checksums.txt`, ripgrep / uv `.sha256`; Claude Code against the npm registry `sha512` integrity).

## Automated tests to run on a PC

```powershell
pwsh -NoProfile -File ServiceKit\terminal\tests\run-tests.ps1
```

`run-tests.ps1` first runs `parse-check.ps1` (the real PowerShell parser on every script, plus the ASCII and PS7-operator
checks), then the Pester 5 suites. Run it under **both** `pwsh` and `powershell.exe` (5.1); Pester 5 is
`Install-Module Pester -Scope CurrentUser -MinimumVersion 5.0`.

| Suite | Covers |
|---|---|
| `Detect.Tests.ps1` | `cwd` extraction from `.jsonl`, session-folder merge and ranking, worktree plan, git repo scan, ASCII folding, profile check |
| `Gate.Tests.ps1` | deny / allow parser (owner only), access-issue body and title, wipe targets, worklines name matching and output, brief due-time, brief text, brief against a temp git repo, worklines against a temp main checkout and worktree |
| `Checks.Tests.ps1` | TLS issuer → interception, recommendations (install, update, hints, Home edition, double Claude, stale ledger row), version compare, report HTML |
| `Ledger.Tests.ps1` | ledger read / write / replace / remove, deletable-path rules, uninstall plan (dry run), full-uninstall plan |
| `Vm.Tests.ps1` | Sandbox verdict, `.wsb` mappings (never `data\`), networking |

## UNTESTED — manual test on a Windows 10/11 PC, step by step

Use a throwaway GitHub repo name in the profile for the first run (for example `<you>/vrg-access-log-test`).

1. **Start.** Double-click `TERMINAL.cmd`. Expect the menu, the PC name, the Claude installs found (or "not found"),
   the profile line and "This PC: ephemeral". Check that `Get-ExecutionPolicy -List` is unchanged afterwards.
2. **Agent Workshop (4).** Install the missing tools. Expect `tools\gh\bin\gh.exe`, `tools\claude-code\claude.exe`
   and the others, each with a row in `state\ledger.json`. Corrupt one byte of a pinned URL's download in
   `tools\_downloads` mid-run (or edit a `sha256` in `core\catalog.json`) and expect "SHA-256 mismatch".
3. **Folder list (1).** Expect your recent Claude folders with dates and session counts, newest first, real paths
   (not `H--VRG-Full` style names). Try G (git scan, ≤ 5 s), W (workspace appears under `workspace\` and in the ledger), B.
4. **Worktree.** In a git repo type a task name: expect `.claude\worktrees\<name>` on branch `wt/<name>`; the same
   name again reopens it; empty = the folder itself.
5. **Banner + device flow.** Expect the HU then EN notice listing exactly the logged fields. Answer y. Expect a code;
   no browser opens on the PC. Approve it on the phone at github.com/login/device.
6. **Wrong account.** Repeat with a different GitHub account approving: expect "a different GitHub account signed
   in", a logout and a stop, and no issue created.
7. **Log repo.** With a missing repo: expect the "create it as private?" question. Make a test repo public: expect a
   refusal and no issue.
8. **Issue.** Expect "Access <PC> <UTC>" in the repo with the table, and a GitHub Mobile notification.
9. **Claude.** A second window opens in the chosen folder with the Kit Shell PATH. `echo %CLAUDE_CONFIG_DIR%` shows
   `<kit>\data\claude`. Claude asks to sign in: open the URL on the phone, type the code back. Check that
   `%USERPROFILE%\.claude\.credentials.json` was not read or changed (its timestamp).
10. **Hooks.** In the main checkout with a fresh uncommitted file, expect the worklines message at session start.
    Work 30+ minutes or end the session: expect a brief comment on the issue with commits and counts, no file contents.
11. **Deny.** Comment `/deny` from another account: nothing happens. Comment `/deny` as the owner (or add the
    `deny` label): within about a minute Claude's window closes, the launcher shows the deny message, the issue gets
    "DENIED … logged out at …" and is closed, `data\gh` and `data\claude\.credentials.json` are gone.
12. **Normal end / Ctrl+C / closed window.** Exit Claude: "session ended" comment, wipe. Ctrl+C in the launcher:
    Claude stops, wipe. Close the launcher window with the X: the next `TERMINAL.cmd` start reports the stale wipe.
13. **Trusted.** Press T on your own PC, start a session: the issue says TRUSTED; after exit the credentials remain in
    `%LOCALAPPDATA%\ServiceKitTerminal`, and nothing credential-like is in `<kit>\data`.
14. **Checks (2).** Run A (all). Expect `reports\<time>\T0..T4.json`, `recommendations.json` and `report.html` opening
    in the browser; with Avast web shield on, T2 should say "intercepted by Avast" and suggest `NODE_EXTRA_CA_CERTS`.
15. **Installs (3).** O / F open Explorer; U on a workspace row asks, then deletes only that folder; a row pointing
    outside the kit (edit `ledger.json` by hand to `C:\Windows`) is refused. X shows the full list and needs `DELETE`;
    cancel it.
16. **Sandbox (5).** On Pro with the feature on: Windows Sandbox opens with Kit Shell; `C:\Kit\tools` is read-only,
    `C:\Kit\exchange` writable, there is no `C:\Kit\data`. On Home: the explanation and the v2 pointer. Feature off:
    the enable command is shown, not run.
17. **Dashboard.** `START.cmd` → *Terminál* tab: session line while step 9 runs, check buttons start the checks
    window, reports open, ledger rows have Folder / File / Uninstall.
