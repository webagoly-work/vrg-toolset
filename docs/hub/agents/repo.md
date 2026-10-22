# GitHub kódtár (vrg-toolset) — agent init
*For a Claude Code session that will work on GitHub kódtár (vrg-toolset). Read this, then the files in §3.*

## 1. What it is
The private git repository holding every VRG tool's code and text documents
(GitHub `webagoly-work/vrg-toolset`). Each tool is a self-contained HTML app; the Planner and the
Inventory build from modular sources into one file.

## 2. Where
- The real working copy: `H:\Dev-VRG\VRG-DE\Planner_VRG_U100`, branch `main`. Worktrees beside it
  (`wt-planner-stack`, the SecAcc worktree) carry their own branches.
- The front door is `Planner/START.cmd`; the umbrella launcher is `VRG-DE.cmd`.

## 3. Read first
1. `CLAUDE.md` (root)
2. `tools/prompts/05-munkamenet-inditas.txt`
3. The program's own file in `docs/hub/agents/`

## 4. Build / test / check
```bash
git rev-parse --show-toplevel && git branch --show-current
node tools/check-start.js
```

## 5. Rules and traps
- `H:\Planner_VRG_U100` is a backup copy, never a workspace (root CLAUDE.md).
- The repo folder cannot be renamed while Claude Code has it open; attempt the operation and treat
  its failure as the authority (root CLAUDE.md).
- `H:\_desktop` is a junction holding the harness's Git (root CLAUDE.md).
- Batch files CRLF, console output ASCII (root CLAUDE.md).
- Vendored source is pinned to a tag; copyright notices travel with copied code (root CLAUDE.md).
- Never make `H:\` itself a repository; it contains `.ssh` (root CLAUDE.md).

## 6. Current state
- 2026-10-16 planner-stack beolvasztva a main ágba
- 2026-09-19 Első feltöltés a GitHubra
- 2026-09-17 Repó létrehozva
- Decision files: see each program's file.

## 7. Do not touch
- `Planner/apps/`, `Planner/home/`, `Planner/data/`, `*.pdf`, `Vendor/`, `Inventory/.cache/`,
  `Inventory/price-check-*.json` — never committed (root CLAUDE.md).

Forrás: CLAUDE.md, tools/prompts/05-munkamenet-inditas.txt, Hub/data/topology.json, 2026-10-22
