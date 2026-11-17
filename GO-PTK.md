# GO PTK — ServiceKit Terminal (portable Claude Code launcher with a phone gate)

*Codephrase **GO PTK**. This file is the whole briefing for a Claude **cloud** session. It does not depend on any
memory note or on files outside this repo. Written 2026-11-17 from a desktop session on the user's PC.*

## 0. What you are building, in one paragraph

A portable, folder-independent **Claude Code launcher** that lives inside the existing **ServiceKit** (a portable
Windows service kit already in this repo). The user carries it on a stick or pulls it with ServiceKit's one-line
bootstrap. On any Windows PC it: finds out whether Claude Code is installed, offers the folders where Claude sessions
were run on that PC (or an isolated workspace inside the kit), signs in **only after the owner approves on their
phone**, and logs every access to a private GitHub repo so the owner can see who used it, where, and when, and can
deny access, which logs that PC out. Around this sit: selectable compatibility checks with install/uninstall
recommendations from the ServiceKit catalog, a ledger of everything the kit downloaded or installed (open, uninstall,
full uninstall), an **Agent Workshop** bundle of portable dev tools, and a disposable VM (Windows Sandbox first).

## 1. Read first (in this order)

1. `ServiceKit/README.md`: what the kit is, folders, bootstrap, the HU-first/EN-below text style.
2. `ServiceKit/core/kitshell.cmd`: the portable environment. It already sets `CLAUDE_CONFIG_DIR=<kit>\data\claude`,
   `HOME`, git/npm/pip caches inside the kit. **Reuse this; do not invent a second environment.**
3. `ServiceKit/core/catalog.json`: 70 packages; fields `id,cat,tier,name,sizeMB,page,source,format,win7,note,desc,apps`.
4. `ServiceKit/core/setup.ps1`, `kit.ps1`, `collect.ps1`, `tasks.ps1`, `server.ps1`, `ServiceKit/launcher/*`:
   installer, system collection, the local Dashboard (PowerShell HTTP server + HTML).
5. `ServiceKit/START.cmd` / `SETUP.cmd`: how PowerShell is started (`powershell.exe -NoProfile -ExecutionPolicy Bypass -File …`).
   That is process-scoped. Use the same pattern and **never change the machine's execution policy**.

Base your branch on `main`. Also look at `origin/servicekit` (the branch the public bootstrap URL reads from) and note in
your report whether it differs from `main`'s `ServiceKit/`.

## 2. Hard rules (security; not negotiable, even if a later section seems to ask otherwise)

1. **No credential is ever stored in the repo, in a zip, or in the "portable file".** The thing the user carries is a
   *trust profile* (`ServiceKit/terminal/profile.json`): GitHub username, access-log repo name, display name, options.
   No tokens, no `.credentials.json`, no cookies. Reason: a copied token works without the launcher, so a lost stick
   would bypass the phone gate completely. `CLAUDE.md` calls `vrg-toolset` private, while the ServiceKit README's
   bootstrap calls its source a public repo: check which is true (`gh repo view --json visibility`), report it, and
   treat everything committed as if it will be published either way.
2. **Sign-in happens on each PC through the official flows, approved on the phone:**
   - GitHub: device flow (`gh auth login --web --git-protocol https` with `GH_CONFIG_DIR=<kit>\data\gh`). The PC shows a
     code; the owner enters it at github.com/login/device **on the phone** and approves. This is "the phone accept".
   - Claude: Claude Code's own `/login`. It prints a URL; the owner opens it on the phone, signs in, and types the code
     back on the PC. Credentials land in `<kit>\data\claude` only (via `CLAUDE_CONFIG_DIR`).
   - Never automate, replay, or bypass either approval, and never read or copy the PC's own `~/.claude/.credentials.json`.
3. **Ephemeral by default.** On exit (normal, Ctrl+C, window closed where catchable) wipe `<kit>\data\claude\.credentials.json`
   and `<kit>\data\gh`. A PC can be marked **trusted** in the menu: then credentials are kept and the access log says so.
4. **Disclosure.** Before anything is sent, show a banner (HU first, EN below) telling whoever sits at the PC exactly what
   is logged (§4 P2) and where it goes. No hidden data collection.
5. **Deny = cooperative kill switch, and say so honestly.** If the owner denies (§4 P2), the launcher logs out and wipes.
   A hostile PC can ignore that, so the README must also tell the owner how to revoke for real: the GitHub OAuth app
   authorization (GitHub → Settings → Applications) and the Claude account's own session/sign-out controls.
6. **Downloads only through the catalog**: official source URL, pinned version, SHA-256 checked, size shown. Installing
   anything that needs admin or changes Windows features (Sandbox, Hyper-V, WSL) is **offered as a command with an
   explanation**; the user runs or confirms it. Uninstall only what the ledger (P4) recorded; never auto-remove.
7. Do not touch folders other than `ServiceKit/` (plus a pointer line in the repo root `CLAUDE.md` if you must).
   Do not push `main`, do not merge, do not force-push.

## 3. Where it goes

```
ServiceKit/
  TERMINAL.cmd                 entry point (double-click); starts terminal/terminal.ps1 the START.cmd way
  terminal/
    terminal.ps1               menu + flow (PowerShell 5.1 compatible: it must run on a stock Windows 10/11)
    gate.ps1                   GitHub device flow, access-log issue, deny poller, wipe
    detect.ps1                 Claude Code detection + session-folder discovery
    checks/                    one script per tier (P3), all read-only
    recommend.ps1              check results -> catalog ids (install / uninstall suggestions)
    ledger.ps1                 P4 ledger read/write + uninstall
    vm/                        P6 Windows Sandbox (.wsb) generator; DESIGN-VM-V2.md
    hooks/                     Claude Code hooks shipped in <kit>\data\claude\settings.json (worklines, briefs)
    profile.example.json       the trust profile template (no secrets)
    PLAN.md  DECISIONS.md  TESTING.md  README.md
```

The Dashboard (`launcher/`) gets a **Terminal** tab that mirrors the menu (P1 status, checks, ledger). The TUI in
`TERMINAL.cmd` is the fallback when the Dashboard server cannot run.

## 4. Phases (commit after each; stop conditions at the end)

**P0 — Plan.** Read §1, then write `terminal/PLAN.md` (how each phase maps onto existing ServiceKit code) and
`terminal/DECISIONS.md` (§6 questions, each with your default). Do not block on them: use the default and go on.

**P1 — Start screen: detect and pick a folder.**
- Claude Code detection, each with version and path: PATH `claude`; `%APPDATA%\npm\claude.cmd`;
  `%USERPROFILE%\.local\bin\claude.exe`; `<kit>\tools\claude` (kit copy); the desktop app (`%LOCALAPPDATA%\AnthropicClaude`
  and the Store package folder). If none: offer the kit copy (catalog package, see P5).
- Folder options:
  a) **Recent session folders on this PC**: scan `%USERPROFILE%\.claude\projects\*\*.jsonl` (and `$env:CLAUDE_CONFIG_DIR`
     if set). The folder names are lossy (`H:\VRG\Full` -> `H--VRG-Full`), so read the real path from the `cwd` field in the
     first lines of the newest `.jsonl`. List by last activity, with session count. Read only.
  b) **Git repos in common places**: user profile (`Documents`, `source\repos`, `Projects`, `dev`, `code`), then each fixed
     drive's root to depth 2. Time-boxed (≤ 5 s), skip system and hidden folders.
  c) **Isolated workspace**: `<kit>\workspace\<name>`; everything stays inside the kit for easy deletion.
  d) Browse.
- Then the **worktree question** (port of the user's current setup, §7): task name → `.claude\worktrees\<name>` on
  branch `wt/<name>` from HEAD; same name reopens; empty = the folder itself, guarded by the worklines hook.
- Claude always starts with the Kit Shell environment, so its config lives in `<kit>\data\claude`.

**P2 — Phone gate, access log, deny, briefs.**
1. Banner (rule 4). 2. GitHub device flow (rule 2), using the kit's portable `gh` (add to the catalog if missing).
3. Open an **issue** in the private repo named in the profile (default `<owner>/vrg-access-log`; create it on first use
   only if the owner confirms, and refuse to use it if it turns out to be public). Title `Access <PC name> <UTC time>`.
   Body: UTC + local time and time zone, computer name, Windows user, OS edition/build, local IPv4 addresses, kit path,
   chosen folder, trusted or ephemeral, launcher version. Public IP is **off** unless the profile enables it (it needs a
   third-party lookup). GitHub Mobile notifies the owner about the new issue.
4. **Deny**: while the launcher runs, poll the issue every 60 s. Label `deny`, or a comment `/deny` by the owner →
   stop Claude processes the kit started, `claude` logout (wipe `<kit>\data\claude` credentials), `gh auth logout`, wipe,
   comment "logged out at …", close the issue, show the message on screen. Comments by anyone else are ignored.
   Optional (D6): require `/allow` before Claude starts.
5. Then Claude sign-in (rule 2).
6. **Briefs** (the "silent copy"): a `SessionEnd` hook plus a throttled `Stop` hook (at most every 30 min) in the kit's
   Claude settings comments on the same issue: repo, branch, worktree, commits since session start (`git log --oneline`),
   `git diff --stat` summary, uncommitted file count. **No prompt text, no file contents.** "Silent" means it does not
   interrupt the person at the PC; it is still listed in the banner.
7. On exit: wipe unless trusted (rule 3), comment "session ended".

**P3 — Tier checks (read-only, pick one or several).** Each writes JSON to `<kit>\reports\<time>\` plus one HTML report.
Reuse `collect.ps1` where it already gathers data.
- **T0 Alap / Basics**: OS edition/build, CPU, RAM, free disk per drive, admin or not, PowerShell version, execution
  policy (read only), antivirus product (`root\SecurityCenter2`), long-path support.
- **T1 Fejlesztés / Dev**: git, node, python, VS Code, winget, WSL, Windows Terminal: present? version?
- **T2 Claude**: Claude Code version; reach `api.anthropic.com` and `github.com` (HTTPS HEAD, timeout); proxy settings;
  TLS interception (certificate issuer is not the expected public CA → hint `NODE_EXTRA_CA_CERTS` / `UV_SYSTEM_CERTS=1`,
  which the user needs on their own PC because Avast intercepts TLS).
- **T3 Hardver / VRG**: COM ports, USB-serial drivers (CH340, CP210x, FTDI), arduino-cli, esptool.
- **T4 VM**: firmware virtualization on, Hyper-V state, Windows Sandbox feature state, edition (Home has no Sandbox or
  Hyper-V), free RAM/disk.
`recommend.ps1` maps results to catalog ids, as **suggestions** with the reason: "install X (portable, 42 MB)",
"update Y", "uninstall Z (conflicts / unused)". Uninstall suggestions are never executed without the user ticking them.

**P4 — Ledger and the Telepítések (Installs) view.**
- Every download, extract, install, or folder the kit creates appends to `<kit>\state\ledger.json`:
  `{id, pkg, kind: portable|installed|download|workspace, paths[], source, sha256, sizeMB, time, uninstall}`.
  Make `setup.ps1` write to it too.
- A refreshable list (Dashboard tab + TUI): per row **Open folder in Explorer**, **Open file**; multi-select →
  **Uninstall selected** (portable = delete its folder; installed = the recorded uninstall command / `winget uninstall`,
  confirm each).
- **Full uninstall**: removes everything the ledger lists plus `data\`, `tools\`, `workspace\`, `reports\`, `logs\` and the
  credentials, then leaves only the original launcher file(s) the user copied in. Show the exact list first, then ask for
  a typed confirmation.
- Things found on the PC that the kit did not create are shown read-only and are never deleted by the kit.

**P5 — Agent Workshop.** A catalog group `agent-workshop`: everything that helps Claude work on a PC, portable only.
Portable Git, Node LTS, Python embeddable + uv, ripgrep, fd, jq, gh, 7-Zip, PowerShell 7, sqlite3, plus Claude Code itself
(npm into `<kit>\data\npm-global`, or the official native binary if its download is version-pinnable and checksummed).
Many are already in the catalog: add only what is missing, same fields, pinned version + SHA-256. One button: "install
all missing", which goes into `tools\`, onto the Kit Shell PATH, and into the ledger.

**P6 — VM.**
- **v1 (build now, portable)**: Windows Sandbox. Generate a `.wsb` that maps the kit read-only and `exchange\` read-write,
  networking on/off as chosen, and a logon command that opens Kit Shell inside. If the feature is off: explain it and show
  the enable command (admin + reboot) for the user to run. Home edition: say it is not available and point to v2.
- **v2 (design only this round)**: `vm/DESIGN-VM-V2.md`: a proper installed VM (Hyper-V on Pro: VHDX, checkpoints,
  internal switch; VirtualBox as the Home fallback), what the kit would automate, and what needs admin.

**Stop conditions.** Finish P0–P4 before starting P5/P6. If you run low on context or time after any phase: commit, push the
branch, write the report (§8) and stop. A finished P0–P2 with honest notes beats a broken P0–P6.

## 5. Testing (you are in a Linux container)

- Install PowerShell 7 if you can, and test the pure logic with Pester: the `.jsonl` `cwd` extraction, folder ranking,
  ledger read/write/uninstall planning (dry run), check-result → recommendation mapping, issue body formatting, the deny
  comment parser (owner-only), and the brief builder against a temp git repo.
- Everything Windows-only (WMI, registry, Sandbox, `gh` device flow, Explorer, real installs) is **UNTESTED**: list it in
  `terminal/TESTING.md` as a step-by-step manual test for the user's PC. Never write "works" for something you did not run.
- Keep the scripts PowerShell 5.1-compatible (no `??`, `?.`, ternary, `&&`); add a parse check that runs them under pwsh.

## 6. Open decisions → `terminal/DECISIONS.md` (use the default, keep going)

- **D1** Access-log repo: `<owner>/vrg-access-log`, private, separate from `vrg-toolset`. *(default)*
- **D2** Public IP in the log: off. *(default)*; on = profile flag plus a named lookup service.
- **D3** New PCs: ephemeral. *(default)*; trusted only by explicit menu choice, recorded in the log.
- **D4** Brief frequency: at session end + at most every 30 min. *(default)*
- **D5** UI: Dashboard tab + TUI fallback. *(default)*
- **D6** Second approval (`/allow` comment) before Claude starts: off; device-flow approval is the gate. *(default)*
- **D7** Recommendations source: the existing ServiceKit catalog only. *(default)*; no web search for programs.

## 7. The user's current setup to port (it lives on their PC, not in this repo)

- **Worklines check** (a SessionStart hook): in a repo's *main* checkout it flags (1) uncommitted files changed in the
  last 3 h and (2) other Claude transcripts (`~/.claude/projects/<sanitized path>/*.jsonl`, excluding its own session id)
  written in the last 30 min, in the same folder or a parent folder (sanitized name: every non-alphanumeric → `-`; a
  parent matches when the child name starts with it and the next char is `-`, or it already ends in `-`). If either
  fires it injects `additionalContext`: "move into a new worktree before editing; don't touch the main checkout" and a
  `systemMessage`. It is silent in a linked worktree or outside git, and never blocks. Rewrite it in PowerShell or
  Node (Node only if the kit's portable Node is present) under `terminal/hooks/` and register it in the kit's
  `<kit>\data\claude\settings.json`.
- **Worktree launcher**: ask a task name → `git worktree add .claude\worktrees\<name> -b wt/<name> HEAD` (or attach the
  existing `wt/<name>` branch), spaces → `-`, same name reopens, empty → the folder itself.
- `worktree.baseRef = "head"` in Claude settings (local `main` is often ahead of the remote).
- The `claude.ps1` npm shim is blocked by default execution policy on many PCs: always call `claude.cmd` / `claude.exe`.

## 8. Finish

- Follow the repo root `CLAUDE.md`. For this job that means: `.cmd` files with **CRLF** line endings (never `goto` out of
  a `for (...)` block; `!delayed!` echoes inside blocks); PowerShell 5.1 scripts **ASCII-only** with Hungarian text in a
  JSON file (a BOM-less script misreads accents); console output ASCII; a new tool gets an entry in
  `launcher/vrg-menu.json` **and** `launcher/vrg-catalog.json`, checked with `node tools/check-start.js` and
  `node tools/check-catalog.js` (both must exit 0); anything that looks like a secret never goes into a commit.
- Branch `servicekit/terminal` from `main`, one commit per phase, push the branch. No PR merge, no `main` push.
- Final report (your last message): per phase done / partly / not started; what was tested and how; the UNTESTED list;
  D1–D7 as you left them; anything in §2 you could not honour and why; the exact first manual test the user should run.
- User-facing text: Hungarian first, English below in italics (ServiceKit convention). Code comments in English.
