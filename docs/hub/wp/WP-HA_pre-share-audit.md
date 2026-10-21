# WP-HA — Pre-share audit (before the colleague is invited)

**Goal (user):** "open up my work for other people (one other trusted colleague first)". Before that,
know exactly what they will see, and that nothing secret is in it — including the Git history.
**Read-only.** No file is changed except the report. Wave 0, no decisions needed (HUB-Q10 is asked
with the findings).

## Read
`CLAUDE.md` (what must not be committed) · `.gitignore` · `docs/hub/04_SETUP-CHECKLIST.md`.

## Do
1. `git status`, `git branch -a`, `git log origin/main..main --oneline`, `git worktree list` → what is
   unpushed, which branches exist only locally.
2. **Secrets, working tree + full history** (`git log --all -p` streamed through a Node script in the
   scratchpad, not printed): patterns `ghp_`, `github_pat_`, `sk-ant-`, `sk-`, `AKIA`, `-----BEGIN`,
   `"password"`, `.credentials.json`, `refresh_token`, `client_secret`, `xox[bp]-`. Report path +
   commit + pattern, never the matched value.
3. **Personal / client data**: tracked files whose name or content holds client names, street
   addresses, phone numbers, emails other than the two users' (regex for `+36`, `@`, `utca|út|tér` +
   number). List `git ls-files | grep -iE 'p33|nv4|peterdy'` with sizes. Known today: 61 tracked
   paths match `p33` (Calculator `*.vplan.json`, `BRIDGE/08_builds/fig/*`, BRIDGE P33 docs) and
   some BRIDGE PDFs are tracked despite `*.pdf` in `.gitignore`.
4. **Size**: largest 20 blobs in history (`git rev-list --objects --all | git cat-file --batch-check`),
   total `.git` size.
5. **Ignored but sensitive on disk** (must stay out): confirm `Planner/apps|home|data` are ignored and
   never appear in history.
6. Licences: anything under `Vendor/` or copied third-party code that is not in `vendor-manifest.json`.

## Output
`docs/hub/AUDIT-2026-10-XX.md`: a table per check (OK / FIX), and a final line **"OK to share"** or
**"Fix first: …"** with the smallest fix for each (e.g. `git rm --cached`, history rewrite only if a
real secret was committed — and then the secret must be rotated first; say so plainly).
Then ask HUB-Q10 (client data) with the real file list in hand.

## Out of scope
Changing anything. Rewriting history. Pushing.
