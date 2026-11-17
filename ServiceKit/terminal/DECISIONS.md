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
