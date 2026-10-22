# WP-H2 — The board: origin, departments, programs, layers, roadmap  ⏸ look

**Goal (user):** "Business Topology … as different branches originating from the same origin …
programs next to each other horizontally, the additional layers under that, connected by vertical
lines … the last layer is the start of the connected git libraries, with a vertical roadmap starting
downwards … under every node, a short text explaining what that node holds."

## Depends / decisions
H1. **HUB-Q02** (layout; A = columns under departments), **HUB-Q09** (EN line under HU).

## Read
`03_UI.md` §1–§3 · `01_ARCHITECTURE.md` §2 · `docs/hub/q/q02-layout.svg` · MindMap's pan/zoom
(`MindMap/vrg_mindmap.html`, search `wheel`) for the camera feel the user already knows.

## Build
1. `Hub/src/js/20-layout.js` — pure: `kpLayout(visibleTopo, opts)` → `{nodes:[{id,kind,x,y,w,h,layer,dept,progId}], edges:[{from,to,kind}], width, height}`
   with every number from one `KP_LAYOUT` constant (03_UI §2). Collapsed departments take one column.
2. `Hub/src/js/30-board.js` — draws the layout into `#kpBoard`: department headers in their hue,
   cards, description text under each card (wrap to ≤3 lines × 30 chars with `…`), `dEn` italic
   below when HUB-Q09 = A, connectors, dashed `idea`, dotted 60 % `v2`, layer bands with labels
   ("Programok", "Megosztott mappák", "AI dokumentumok", "Git és ütemterv", "Saját linkek", "Helyi célmappa").
   Roadmap: seed entries, newest first, one dot + date + text per row.
3. Camera: wheel zoom around cursor, middle-drag / Space+drag pan, `0` fit, `+`/`−`. LOD: hide
   descriptions < 0.5, cards < 0.3 (headers only).
4. Layer rail: six toggles; state in `kpStore` (`vrgKapu.layers`). View toggle Jelenlegi / Bővített.
   Department collapse (click header), Fókusz (double-click, `Esc`).
5. No label may overlap another: run a collision check in a test (below) — the user has a standing
   rule that every sheet keeps every label readable.

## Tests (`spec-20-layout.js`)
- `'now'` view: 13 header nodes, 36 program cards; `'vision'`: 55.
- No two cards overlap (pairwise rect test over all cards, both views).
- No description block overlaps any card or another description (same test incl. text boxes from
  `kpWrap`: 3 lines × 15 px).
- Columns are left-to-right in department order ALT, VEZ, ERT, TERV, KALK, BESZ, KIV, TFEJ, JOG, ARC, TUD, IT, IRO.
- Planner's roadmap: 6 rows, first row date `2026-10-19`.
- Collapsing `TFEJ` in `'now'` reduces total width by exactly (8 − 1) × (200 + 24) px
  (TFEJ has 8 visible programs in 'now').

## ⏸ Checkpoint
Screenshot at fit-all and at 100 % on the Planner column, both themes amber + light. **Stop and
show the user.** The look is theirs to approve before H3.

## Out of scope
Clicks (H3), locks (H5), live data (H6).
