# Setup checklist — opening the work to the colleague

*Human steps. Claude cannot do the sign-ins or invitations for you, and should not: they are account
actions. Tick them in this order. WP-HA (the pre-share audit) runs before step 3.*

*Updated 2026-10-30 for the access-only Kapu (2026-10-26 rework): Kapu is the GitHub sign-in + the
signed allowed list + START.cmd. The board, its OneDrive folder links and the Munkanapló are parked in
`CodeCity/from-kapu/`, so the steps that served them are retired. Step numbers are kept because
`GO-HUB.md` and `docs/hub/README.md` refer to them.*

## What I need from you — and what never to send

Send in the chat **only**: each user's **GitHub username** and the **email addresses** they use for
GitHub and (only if you use the OneDrive share, step 6) Microsoft/OneDrive. That is all the allowed
list needs.

**Never send passwords, tokens, recovery codes or 2FA codes** — not to Claude, not in a file, not in
the repo. Each person creates their own GitHub token on their own account and pastes it only into
their own browser. If a password ever lands in a chat or a file, change it.

## Steps

The colleague gets in with steps 3, 4, 5, 9, 10. OneDrive (step 6) is not needed for access.

| # | State | Who | Step | Done when |
|---|---|---|---|---|
| 1 | done | you + Claude | Answer the questions in `DECISIONS.md`. | README §5 filled |
| 2 | done | Claude | **WP-HA pre-share audit**: secrets, client data and size check over the working tree **and the history**. | report says "OK to share" |
| 3 | open | you | Commit what you want shared, then push `main`. Run `git status -sb` first: if it says *behind*, pull before pushing. Before the commit, the four checks in `GO-HUB.md` §5 must be green. | GitHub shows today's commit |
| 3a | done | you + Claude | **Anonymise** (HUB-Q10): `node tools/anonymise.js` (dry run), `--apply`, tests, commit. Re-run the dry run before step 3 if client jobs were added since. | prints "No leftovers" |
| 4 | open | you | Invite the colleague: GitHub → repo → Settings → Collaborators → **Add people** → username, role **Write**. The admin page (START → O → M) opens that page for you. | colleague accepted the invite |
| 5 | open | you + colleague | Turn on **two-factor authentication** on both GitHub accounts. | both accounts show 2FA |
| 6 | optional | you | **OneDrive, for big files only.** Create `VRG-Megosztott` with just the folders you will use now (at least `10_Projektek` for client jobs — HUB-Q10: new client jobs only there, by job code; others from `hub-seed.json` → `onedrive.folders` when needed). Share the **`VRG-Megosztott` folder** with **"Adott személyek"** (specific people) → colleague's Microsoft email. Never "Bárki, akinél a link van". If you make `00_START`: `node tools/build-hub.js --onedrive <…\VRG-Megosztott\00_START>` once, and set the folder in the admin page so later rebuilds copy there too. | colleague opens the shared folder |
| 7 | retired | — | ~~Paste each folder's share link into the Kapu editor.~~ The editor and the folder links belonged to the board (parked). | — |
| 8 | done | you | Signed allowed list: 2 people (owner + member), key in `H:\VRG\Full\_admin\keys\` (**not** OneDrive, not the repo). Day to day: the admin page (START → O → M, http://127.0.0.1:8798) adds / removes people, signs, rebuilds and writes the welcome message. | Kapu shows "aláírás rendben" |
| 9 | open | colleague | Install Node (nodejs.org, LTS) and GitHub Desktop; clone `webagoly-work/vrg-toolset`. | clone opens |
| 10 | open | colleague | Start `Hub\VRG Kapu.cmd` in the clone → GitHub token (their own, fine-grained, only in their browser) → on the allowed list → START.cmd and the tool list open. | their name shows as "tag" |
| 11 | open | colleague | Claude Code: own account; open it in the clone; the repo's `CLAUDE.md` and the GO files guide it. | a first session runs |
| 12 | retired | — | ~~Daily Munkanapló entry; claim a program before a bigger change.~~ The Munkanapló is parked for Kódváros. Until it returns, agree on who works on what by message, and commit with clear messages. | — |

**Before step 4 (by Claude, on request):** a clean-profile check of the Kapu with the user typing
their own token (GO-HUB §4.4).

**Note:** the admin page's welcome message points the colleague at `VRG-Megosztott\00_START\vrg-kapu.html`.
If you skip step 6, tell them to start `Hub\VRG Kapu.cmd` from their clone instead (step 10).
`KOLLEGA-INDULAS.md` still describes the old board (tour, map, Munkanapló) and needs the same update.

## Things that stay yours only

- `Planner/home`, `Planner/data` (browser profile, Claude login) and `H:\VRG\Full\tools` — never in
  Git, never shared.
- `H:\VRG\Full\_admin\keys\` — the allowed-list signing key.
- Your Claude Code sessions: session links open only for the account that made them. The shareable
  equivalent is a **GO file** (a written brief in the repo).
