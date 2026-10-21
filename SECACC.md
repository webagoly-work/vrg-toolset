# SecAcc — the secondary account's workspace

*`H:\cwebuser\projects\VRG-DE\SecAcc` is a **git worktree** of the vrg-toolset repo on its own branch
**`secacc`**. It is a full copy of the code that shares one history with the primary checkout
(`…\Planner_VRG_U100`, branch `main`). The secondary account works here; the primary account keeps
working in the main checkout. Nothing either side does reaches the other until the merge (§C).*

Created 2026-10-21 from `main` at `987b92a`, plus the then-uncommitted Kapu pack (`docs/hub/`,
`GO-HUB.md`, the `GO HUB` line in `CLAUDE.md`) copied in.

## A. Start the secondary account (once per work session)

1. Open **Command Prompt** (not PowerShell).
2. Keep this account's login separate from the primary one:
   ```
   set CLAUDE_CONFIG_DIR=H:\cwebuser\home\claude-account-b
   ```
3. Go to the SecAcc folder:
   ```
   cd /d H:\cwebuser\projects\VRG-DE\SecAcc
   ```
4. Start Claude Code: `claude`. The first time, sign in with the **secondary** account.
5. Type `GO HUB`.

## B. While working (rules for the secondary account's sessions)

- Work only in this folder. Check: `git branch --show-current` → `secacc`.
- **Commit to `secacc` after each finished work package** (`git add <own files>` then
  `git commit -m "Kapu WP-Hn: …"`). The commits are what gets merged back — uncommitted work does not travel.
- **First commit, before any WP:** `git add docs/hub GO-HUB.md CLAUDE.md SECACC.md` then
  `git commit -m "Kapu pack + SecAcc workspace"` — the pack is still uncommitted here when SecAcc starts.
- Never `git push`, never `git merge`, never `git checkout <other branch>`, never touch the main checkout.
- To get newer work from the primary account into SecAcc (only when the primary user asks):
  `git merge main` inside SecAcc. The primary must have committed it on `main` first.

## C. Merge back into the primary account's checkout (the primary account does this)

1. In SecAcc, make sure everything is committed: `git status` must be clean.
2. In the **main checkout**:
   ```
   cd /d H:\cwebuser\projects\VRG-DE\Planner_VRG_U100
   git status
   ```
   Commit or set aside your own open work first. **One-time step for the first merge only:** the
   Kapu pack still sits there uncommitted, and git refuses a merge that would overwrite it. It
   arrives with the merge anyway, so remove the old copies first:
   ```
   git restore CLAUDE.md
   rmdir /s /q docs\hub
   del GO-HUB.md
   ```
   (Only do this if you did not change those files in the main checkout yourself.)
3. See what is coming: `git log --oneline main..secacc` and `git diff --stat main...secacc`.
4. Merge: `git merge secacc`.
5. If git reports conflicts, open the listed files, keep the right lines, `git add` them, then
   `git commit` — or ask a Claude session in the main checkout to resolve them.
6. Check: `node tools/check-start.js` and, once the hub exists, `node tools/build-hub.js` and
   `node Hub/test/run.js`.
7. Afterwards the secondary account continues in SecAcc; to start from the merged state:
   `git merge main` inside SecAcc.

## D. When the job is finished

In the main checkout: `git worktree remove ..\SecAcc` then `git branch -d secacc`
(only after `secacc` is merged; git refuses otherwise, which is the safety net).
