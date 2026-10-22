# Toolbox — agent init
*For a Claude Code session that will work on Toolbox. Read this, then the files in §3.*

## 1. What it is
The collecting page for smaller tools still under development (topology description).

## 2. Where
- `toolbox.html` at the repo root — one file.
- Opened from `Planner/START.cmd` key **7**.

## 3. Read first
1. `toolbox.html`
2. `CLAUDE.md` (root) — "START.cmd is the front door"

## 4. Build / test / check
No build — single file. `node tools/check-start.js` after adding or moving a tool.

## 5. Rules and traps
- A tool that is not in START.cmd does not exist; update the registry and its dated NOTE in the same
  change (root CLAUDE.md).

## 6. Current state
- 2026-09-20 Vendor: manifest, fetch tool and VRG Vendor page for third-party components
- 2026-09-17 Initial import of the VRG toolset
- Decision files: none.

## 7. Do not touch
— (nincs leírva)

Forrás: toolbox.html, CLAUDE.md, Hub/data/topology.json, Planner/START.cmd, git log main, 2026-10-22
