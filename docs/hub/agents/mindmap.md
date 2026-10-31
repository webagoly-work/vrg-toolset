# VRG MindMap — agent init
*For a Claude Code session that will work on VRG MindMap. Read this, then the files in §3.*
**Felelős:** Arnold, Design Division

## 1. What it is
A mind map with bubbles, frames, coloured connection layers, layer-bound markdown notes and a helix
view, fully usable from the keyboard. One HTML file (topology long text).

## 2. Where
- `MindMap/vrg_mindmap.html` (+ `MindMap/lib/`, `MindMap/serve.js`).
- Opened from START key **4**.

## 3. Read first
1. `CLAUDE.md` (root) — "Testing browser apps"
2. `MindMap/vrg_mindmap.html`

## 4. Build / test / check
No build — single file. For storage tests: `node MindMap/serve.js` (port 8124).

## 5. Rules and traps
- `localStorage` does not work from `file://` or `data:`; serve the folder instead (root CLAUDE.md).
- Verify colour-carrying behaviour by reading computed styles, not screenshots (root CLAUDE.md).

## 6. Current state
- git 2026-10-27 250b235 Mélyvíz rollout P0–P2: shared style, calculators, MindMap
- git 2026-10-06 e797658 MindMap: stop canvas drag from sweep-selecting labels, add frame nodes
- git 2026-09-21 0e8c30a MindMap edge style + bidirectional; a START.cmd rule with a checker
- Decision files: none.

## 7. Do not touch
— (nincs leírva)

Forrás: CLAUDE.md, MindMap/serve.js, Hub/data/topology.json, launcher/vrg-menu.json, git log main, 2026-10-31
