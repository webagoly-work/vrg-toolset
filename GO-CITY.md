# GO CITY — build VRG Kódváros (the codebase city)

> **2026-10-24 — GO MAIN:** the worktrees are retired. Work in the main checkout `H:\cwebuser\projects\VRG-DE\Planner_VRG_U100`, branch `main`. Any worktree path or branch named below means the main checkout and `main`.

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
7. **C1–C10 all DONE 2026-10-23.** C9: session replay (CITY-D7 A). C10: `CodeCity/mcp.js`, the
   zero-dependency MCP server (CITY-D8 A/A/A), registered with `claude mcp add kodvaros -- node
   <repo>/CodeCity/mcp.js`. The WP list in README §3 is finished, and `main` is merged in (1bf52e7).
8. **PARKED 2026-10-23** — README §7. The priority is consolidating every line of work into one
   `main`. Come back later to fine-tune Kódváros's base: ask the user for their dev notes first.
   It is a **candidate for a later Claude Design batch** (look and feel in one pass, not more WPs).
