# GO CITY — build VRG Kódváros (the codebase city)

*You were started with the codephrase **GO CITY**. This file is the whole briefing.*

1. **Where:** branch `worktree-codecity` (worktree `.claude/worktrees/codecity` of the vrg-toolset repo)
   until it is merged into `main`. Confirm with `git branch --show-current`.
2. **Read:** `docs/city/README.md` — §2 the visual mesh, §3 the WP order, §4 the status.
3. **Do:** the next WP in §3 whose status is not DONE. One WP per session unless the user says "all".
   Stop at every ⏸. Commit after each WP (`Kódváros WP-Cn: …`), never push unasked.
4. **Test:** `node CodeCity/scan.js . --html CodeCity/dist/self.html` then screenshot it with
   `node CodeCity/tools/shot.js CodeCity/dist/self.html` (headless Chrome from `Planner/apps`).
5. **Ask** as numbered items with the CITY-Dn id and lettered options, A recommended.
6. **Trying it together with everything else:** the branch is pushed to GitHub (2026-10-22). The
   primary account builds **`dev-all`** (codephrase **GO ALL**, `GO-ALL.md`): every line of work merged
   into one worktree, `wt-dev-all`, to try every feature at once. Feature work still happens HERE, on
   `worktree-codecity`; `dev-all` picks it up by merging again (GO-ALL §5). Never commit Kódváros work
   on `dev-all` itself.
7. **C9 DONE 2026-10-23** (CITY-D7 A: session replay, `scan.js --sessions`, paths + kind + time only).
   Next: **C10** (Kódváros as MCP tools, ⏸ decide). Its first question when resuming: the scope of
   the MCP server (which tools, read-only or not, where it runs); ask it as CITY-D8 before any code.
