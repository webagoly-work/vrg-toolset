# GitHub kódtár (vrg-toolset) — agent init
*For a Claude Code session that will work on the repository itself. Read this, then the files in §3.*
**Felelős:** Elsie, Behaviour Lab · **Indító:** GO MAIN

## 1. What it is
The private git repository holding every VRG tool's code and text documents
(GitHub `webagoly-work/vrg-toolset`). Each tool is a self-contained HTML app; the Planner and the
Inventory build from modular sources into one file.

## 2. Where
- The one working copy: `H:\VRG\Full\Planner_VRG_U100`, branch `main`. One repository, one checkout.
- `H:\VRG\Backup\code\Planner_VRG_U100.git` is the `backup` remote, a bare repo, not a workspace.
- The front door is the START menu (`launcher/vrg-menu.json`).
- Branch `docs/go-tnt` (worktree `.claude\worktrees\go-tnt`) waits for its merge gate (GO-TNT.md §0).

## 3. Read first
1. `CLAUDE.md` (root)
2. `GO-MAIN.md` — state of every line of work, standing rules
3. The program's own file in `docs/hub/agents/`

## 4. Build / test / check
```bash
git rev-parse --show-toplevel && git branch --show-current
node tools/check-start.js
node tools/brief-state.js --check
node tools/anonymise.js          # dry run; required before any push
node tools/vrg-ctx.js q "<words>"
```

## 5. Rules and traps
- Commit or push only when the user asks; `git add` by path (GO-MAIN.md §5).
- Client names stay out of tracked files; job codes only (GO-MAIN.md §5).
- Confirm the top level if unsure: work once landed in a copy, and reconciling it cost real effort
  (root CLAUDE.md).
- Process checks do not tell you whether a folder is free; attempt the operation and treat its
  failure as the authority (root CLAUDE.md).
- Batch files CRLF, console output ASCII (root CLAUDE.md).
- Vendored source is pinned to a tag; copyright notices travel with copied code (root CLAUDE.md).
- Never make `H:\` itself a repository; it contains `.ssh` (root CLAUDE.md).

## 6. Current state
- git 2026-10-31 2389f3d VRG Mobile: M3 and M6 live after the phone check
- git 2026-10-30 3446d80 VRG Mobile M6: Gyorsjegyzet into the mobile-log branch; M3 Client ID, M1 live
- git 2026-10-30 355b471 VRG Mobile M3: GitHub fiók, device-flow sign-in and the shared client
- Decision files: see each program's file. What waits on the user: `GO-MAIN.md` §4.

## 7. Do not touch
- `Planner/apps/`, `Planner/home/`, `Planner/data/`, `*.pdf`, `Vendor/`, `Inventory/.cache/`,
  `Inventory/price-check-*.json` — never committed (root CLAUDE.md).
- `.claude\worktrees\cloudflare-ecosystem` is a stale leftover (root CLAUDE.md).

Forrás: CLAUDE.md, GO-MAIN.md, GO-TNT.md, git log main, 2026-10-31
