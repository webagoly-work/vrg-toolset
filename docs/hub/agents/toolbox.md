# Toolbox — agent init
*For a Claude Code session that will work on Toolbox. Read this, then the files in §3.*
**Felelős:** Elsie, Behaviour Lab

## 1. What it is
The collecting page for smaller tools still under development (topology description).

## 2. Where
- `toolbox.html` at the repo root — one file.
- Opened from START key **7**.

## 3. Read first
1. `toolbox.html`
2. `CLAUDE.md` (root) — "START is the front door"

## 4. Build / test / check
No build — single file. `node tools/check-start.js` after adding or moving a tool.

## 5. Rules and traps
- A tool that is not in `launcher/vrg-menu.json` does not exist; update it in the same change and
  run `node tools/check-start.js` (root CLAUDE.md).

## 6. Current state
- git 2026-10-27 f058e6f Mélyvíz rollout P3–P4: BuildTree palette, Inventory, Vendor, Kapu, toolbox
- git 2026-09-20 9a92e57 Vendor: manifest, fetch tool and VRG Vendor page for third-party components
- git 2026-09-17 35305ff Initial import of the VRG toolset
- Decision files: none.

## 7. Do not touch
— (nincs leírva)

Forrás: toolbox.html, CLAUDE.md, Hub/data/topology.json, launcher/vrg-menu.json, git log main, 2026-10-31
