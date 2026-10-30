# GO MAIN — the overall entry point

*You were started with the codephrase **GO MAIN**. This file is the whole briefing; it does not depend on any memory
note, so it works from any Claude account on this PC. Written 2026-10-30 at the end of the housekeeping round
(`docs/housekeeping/AUDIT-2026-10-30.md`). The first GO MAIN is in `docs/go-archive/`.*

## 1. First, every session

1. Confirm: `git rev-parse --show-toplevel` = `H:/VRG/Full/Planner_VRG_U100`, `git branch --show-current` = `main`.
2. `git status -sb`, then `git fetch origin` and `git branch -r --no-merged main`. Anything listed that is not explained
   in §3 is work that drifted away: tell the user before starting.
3. Tell the user, in five lines: where `main` stands, what is unpushed, what §4 says can run now. Ask what to do; do
   not start on your own.

## 2. Where everything lives

| What | Where |
|---|---|
| The repo, the one working copy | `H:\VRG\Full\Planner_VRG_U100`, branch `main` |
| Portable toolchain, user programs | `H:\VRG\Full\tools`, `H:\VRG\Full\programs` |
| Client jobs, local only | `H:\VRG\Full\jobs` |
| Big files and client jobs shared with the colleague | `H:\VRG\Shared` = junction to `C:\Users\webag\OneDrive\VRG-Megosztott` |
| VARLER documents (the two old folders, merged) | `H:\VRG\Shared\10_Projektek\_VARLER Documents`; older copies in its `_utkozesek` |
| Backups | `H:\VRG\Backup` (bare repos in `code\`, archives in `archive\`); START → BACKUP.cmd |
| Second account | `H:\VRG\Full\home\claude-account-b` |

## 3. The lines of work

| Line | Lives in | State | GO |
|---|---|---|---|
| Planner | `Planner/projects/varler-planner` | 116 suites green; Simple-UI merged, off by default | PLANNER, ROUTE |
| Wiring, router, Topology View | `tools/baseline`, `docs/topology`, `docs/workflow` | T0–T6 built; ROUTE waits for the user's answers | ROUTE |
| CLA job | `H:\VRG\Full\jobs`, `tools/baseline` | v1, v2 delivered; questions open | CLA |
| VRG Kapu | `Hub/`, `tools/hub-admin` | built; colleague not invited yet; guest + shared folders planned | HUB |
| Kódváros | `CodeCity/`, `docs/city` | C1–C10, KV-01…27 done; tuning parked | CITY |
| VRG Mobile, Légegér | `Mobile/`, `docs/mobile` | M0–M2 built; next M3; START key L | MOBILE |
| START launcher | `launcher/` | built, all self-tests green | — |
| ServiceKit, CYD, Phone | `ServiceKit*/` | merged 2026-10-30; not in the START registry yet; also in `H:\Personal\ServiceKit` | — |
| Firmware | `Firmware/` | planner-cyd, board-console, knobpad | — |
| BRIDGE | `BRIDGE/`, `H:\VRG\Full\BRIDGE` | standards + concepts; open questions in its docs | — |
| Inventory | `Inventory/` | green | — |
| OpenWrt | `GO-OPENWRT.md` | P0 not started | OPENWRT |

## 4. What can run now

**Waiting on the user only:**

- Push `main`. Then PR #2 on GitHub and the old cloud branches can be closed or deleted by the user.
- Share `VRG-Megosztott`, invite the colleague, 2FA: `docs/hub/04_SETUP-CHECKLIST.md` steps 4–6.
- The Simple-UI S6 look; the C6 pen feel; G2.
- Remove `.claude\worktrees\cloudflare-ecosystem` (stale, nothing unique in it).
- Check the 9 VARLER conflicts: `H:\VRG\Shared\10_Projektek\_VARLER Documents\_utkozesek\varler-merge-2026-10-30.md`.
- After a while, delete the archived old VARLER folders and the parked items in `H:\VRG\Backup\archive`.

**Ready for a session, after the user's yes:** GO ROUTE (§2 questions), GO MOBILE M3 (cloud), GO HUB WP-G1, GO OPENWRT P0.

## 5. Standing rules

- Never commit unasked, never push unasked, never switch branch. `git add` by path.
- Never commit `Planner/apps|home|data`, `*.pdf`, `Vendor/`, client data, or `H:\VRG\Full\_admin\keys`. Never make `H:\` a repo.
- Never ask for, type or store a password, token or 2FA code.
- `node tools/anonymise.js` (dry run) before every push; apply if it finds a client code.
- START is the front door: a tool not in `launcher/vrg-menu.json` does not exist. `node tools/check-start.js` after any move.
- `.cmd` files CRLF, ASCII console output, `launcher/vrg-ui.ps1` ASCII.
- Hungarian UI, English code; user-facing kit text Hungarian first, English in italics below.
- Big work in phases, stop at ⏸. Questions as numbered A/B/C options, A recommended.

## 6. Keep work from scattering again

This is what went wrong before 2026-10-30:

- **Accounts:** a CLI `/login` switches the desktop app's account too, and sessions then seem to vanish. Check the account
  before concluding anything is lost. The second account uses `CLAUDE_CONFIG_DIR=H:\VRG\Full\home\claude-account-b`.
- **Cloud and second-account work** lands on its own branch and nobody merges it. At the end of such a session, ask the
  user to merge, or list the branch in §3.
- **New folders are not in Git until added:** the launcher sat untracked for days, outside every backup. End a session
  with `git status`, and tell the user about anything untracked.
- **Uncommitted is unprotected:** BACKUP's bare repo holds commits only.
- **One copy of a folder.** No second copy on the Desktop or in a portable kit; OTG builds are generated, not edited.

## 7. Picking up

Say **GO PLANNER**, **GO ROUTE**, **GO CLA**, **GO HUB**, **GO CITY**, **GO MOBILE** or **GO OPENWRT**. For the second
account: Command Prompt, `set CLAUDE_CONFIG_DIR=H:\VRG\Full\home\claude-account-b`, `cd /d H:\VRG\Full\Planner_VRG_U100`, `claude`.
