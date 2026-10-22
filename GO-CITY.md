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
