# Setup checklist — opening the work to the colleague

*Human steps. Claude cannot do the sign-ins or invitations for you, and should not: they are account
actions. Tick them in this order. WP-HA (the pre-share audit) runs before step 3.*

## What I need from you — and what never to send

Send in the chat **only**: each user's **GitHub username** and the **email addresses** they use for
GitHub, Microsoft/OneDrive and (optionally) Google. That is all the allowed list needs.

**Never send passwords, tokens, recovery codes or 2FA codes** — not to Claude, not in a file, not in
the repo. Each person creates their own GitHub token on their own account and pastes it only into
their own browser. If a password ever lands in a chat or a file, change it.

## Steps

| # | Who | Step | Done when |
|---|---|---|---|
| 1 | you + Claude | Answer the questions in `DECISIONS.md` (one line: `Q01 A, Q02 A, …`). | README §5 filled |
| 2 | Claude | **WP-HA pre-share audit**: secrets, client data and size check over the working tree **and the history**. | report says "OK to share" or lists fixes |
| 3 | you | Commit what you want shared, then `git push` (main is 2 commits ahead of GitHub today; worktree branches are not pushed). | GitHub shows today's commit |
| 3a | you + Claude | **Anonymise** (HUB-Q10): in the main checkout, after `secacc` is merged — `node tools/anonymise.js` (dry run), then `--apply`, then the Planner tests and `node tools/check-start.js`, then commit. Needs the local `tools/anonymise.map.json`. | prints "No leftovers", tests green |
| 4 | you | GitHub → repo → Settings → Collaborators → **Add people** → colleague's username (role: Write). | colleague accepted the invite |
| 5 | you | Turn on **two-factor authentication** on your GitHub account, ask the colleague to do the same. | both accounts show 2FA |
| 6 | you | OneDrive: create `VRG-Megosztott` with the folders in `hub-seed.json` → `onedrive.folders`. Share each with **"Adott személyek"** (specific people) → colleague's Microsoft email. Never "Bárki, akinél a link van". | colleague opens a folder link |
| 7 | you | Copy each folder's share link → paste into the Kapu editor (or give the list to Claude for `topology.json`). | no empty folder links |
| 8 | you | `node tools/hub-sign.js --init` once (key goes to `H:\cwebuser\_admin\keys\` — **not** OneDrive, not the repo), fill `Hub/data/access.json`, `node tools/hub-sign.js`. | Kapu shows "aláírás rendben" |
| 9 | colleague | Install Node (or the cwebuser kit, Mode B) and GitHub Desktop; clone `webagoly-work/vrg-toolset`. | clone opens |
| 10 | colleague | Start `Hub\VRG Kapu.cmd` → *Első lépések* → token wizard → board unlocks. | their name shows as "tag" |
| 11 | colleague | Claude Code: own account; open it in the clone; the repo's CLAUDE.md and the Kapu's AI docs guide it. | a first session runs |
| 12 | both | End each day with a **Munkanapló** entry; claim a program before a bigger change. | logs appear in "Ki min dolgozik?" |

## Things that stay yours only

- `Planner/apps`, `Planner/home`, `Planner/data` (browser profile, Claude login) — never in Git, never shared.
- `H:\cwebuser\_admin\keys\` — the allowed-list signing key.
- Your Claude Code sessions: session links open only for the account that made them. The shareable
  equivalent is a **GO file** (a written brief) — that is what layer 3 links to.
