# VRG MindMap — agent init
*For a Claude Code session that will work on VRG MindMap. Read this, then the files in §3.*

## 1. What it is
A mind map with bubbles, frames, coloured connection layers, layer-bound markdown notes and a helix
view, fully usable from the keyboard. One HTML file (topology long text).

## 2. Where
- `MindMap/vrg_mindmap.html` (+ `MindMap/lib/`, `MindMap/serve.js`).
- Opened from `Planner/START.cmd` key **4**, or VRG-DE.cmd **L2**.

## 3. Read first
1. `CLAUDE.md` (root) — "Testing browser apps"
2. `MindMap/vrg_mindmap.html`

## 4. Build / test / check
No build — single file. For storage tests: `node MindMap/serve.js` (port 8124).

## 5. Rules and traps
- `localStorage` does not work from `file://` or `data:`; serve the folder instead (root CLAUDE.md).
- Verify colour-carrying behaviour by reading computed styles, not screenshots (root CLAUDE.md).

## 6. Current state
- 2026-10-06 MindMap: stop canvas drag from sweep-selecting labels, add frame nodes
- 2026-09-22 Új kezelés: keretek, egér, kétkezes billentyűzet
- 2026-09-21 MindMap edge style + bidirectional; a START.cmd rule with a checker
- Decision files: none.

## 7. Do not touch
— (nincs leírva)

Forrás: CLAUDE.md, MindMap/serve.js, Hub/data/topology.json, Planner/START.cmd, VRG-DE.cmd, git log main, 2026-10-22
