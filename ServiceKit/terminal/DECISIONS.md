# ServiceKit Terminal — decisions

Each open question from the brief (GO PTK §6) with the default in force. Change a default by editing the profile
(`<kit>\terminal\profile.json`) where a field exists, otherwise in code.

| # | Question | In force | Where |
|---|---|---|---|
| D1 | Access-log repo | `<owner>/vrg-access-log`, **private**, separate from `vrg-toolset`. Created only after the owner types yes; refused if it is public. | `profile.accessRepo` |
| D2 | Public IP in the log | **Off.** On = `profile.publicIp = true` and `profile.publicIpService` (default `https://api.ipify.org`, a third party; named in the banner). | `profile.publicIp` |
| D3 | New PCs | **Ephemeral.** Trusted only by an explicit menu choice; the issue says "trusted". | menu |
| D4 | Brief frequency | `SessionEnd` + `Stop` at most every **30 min**. | `profile.briefMinutes` |
| D5 | UI | Dashboard **Terminal** tab + TUI fallback (`TERMINAL.cmd`). The sign-in flow itself runs only in the TUI: it needs a console for the device code and for Claude. | — |
| D6 | Second approval (`/allow`) | **Off**; the device-flow approval is the gate. On = `profile.requireAllow = true`: Claude starts only after an owner `/allow` comment. | `profile.requireAllow` |
| D7 | Recommendation source | The ServiceKit **catalog only**; no web search. | `recommend.ps1` |

## Decisions taken while building (not in the brief)

- **D8 Where credentials live.** Ephemeral: `<kit>\data\claude` and `<kit>\data\gh` (as the brief says), wiped at exit
  **and again at the next start** if an unclean exit (closed window, crash) left them behind. Trusted: in a per-PC folder
  `%LOCALAPPDATA%\ServiceKitTerminal\` (claude + gh), **not on the stick** — otherwise a "trusted" token would travel on
  the stick and a lost stick would carry a working credential, which hard rule 1 forbids.
- **D9 gh token storage.** `gh auth login --insecure-storage` so the token is a file inside the config dir above (and is
  removed by the wipe), not an entry in the PC's Windows Credential Manager that the kit cannot see or clean up.
- **D10 Owner check.** After the device flow, the logged-in GitHub user must equal `profile.githubUser`; otherwise the
  launcher logs out and stops. Without this, anyone could approve with their own GitHub account.
- **D11 Deny signals.** A `deny` label (only people with write/triage access to the private repo can set labels) or a
  comment whose body starts with `/deny` and whose author is `profile.githubUser`. Every other comment is ignored.
- **D12 Claude logout.** There is no scripted logout in every Claude Code version, so "logout" = stop the processes the
  kit started and delete `.credentials.json`. The server-side session stays valid until revoked; README says how.
- **D13 Text.** `.ps1` files are ASCII; Hungarian lives in `text.json`. The TUI folds accents to ASCII for the console;
  the Dashboard shows them.
- **D14 Reports folder.** Tier checks write to `<kit>\reports\<yyyyMMdd-HHmmss>\` as the brief says, apart from the job
  reports in `data\reports`.
- **D15 The GitHub token stays with the launcher.** Claude's window gets no `GH_CONFIG_DIR` and empty `GH_TOKEN` /
  `GITHUB_TOKEN`. The brief hooks only queue their text in `state\terminal-briefs\`, and the launcher posts it. This
  is not a hard boundary: Claude runs as the same Windows user and could still read `data\gh\hosts.yml` from disk,
  then forge an `/allow` or delete a `/deny`. Treat the deny as cooperative (see README). **`gh auth logout` does not
  revoke the token on GitHub**, so after a deny, or regularly, revoke the *GitHub CLI* authorization in GitHub settings.
- **D16 One session per PC.** A second start is refused while the previous Claude window is alive. In ephemeral mode the
  gh dir and the Claude credentials are deleted before sign-in, so every session needs a fresh phone approval.
- **D17 Kill on close.** The Claude window goes into a Windows job object with KILL_ON_JOB_CLOSE, so closing the
  launcher window ends Claude too. PowerShell runs no `finally` block in that case. If the job cannot be set up, the
  launcher says so.
- **D18 Git credentials in ephemeral mode.** `credential.helper` is blanked for Claude's window, so nothing lands in
  the PC's Windows Credential Manager. Pushing over https then asks for credentials. Trusted PCs keep the default.
  The wipe also removes `data\claude\.claude.json`. Transcripts (`data\claude\projects`) stay on the stick: they are
  work history, not credentials.
- **D19 Deletes do not follow junctions.** Folders are removed with cmd's `rmdir /s /q`, never with
  `Remove-Item -Recurse`, which can walk into a junction in Windows PowerShell.
