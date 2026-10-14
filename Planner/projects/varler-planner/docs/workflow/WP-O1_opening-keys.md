# WP-O1 — Doors and windows as their own tools: ←/→ type, ↑/↓ opening side

Status: todo · Wave O · Depends: F3 (walls to sit on) · Size: S (~90 lines) · Spec: next free · Decisions: Q-O01

## Goal
*"Basically the same, but as a separate selectable feature — both have arrow left/right to cycle the different types of
Doors/Windows, already showing their ghost. Arrow up/down cycles between the four possible opening sides, which is
important with doors."*

## Read
`08-interaction.js:265` (`buildGhost` — the Build tool ghost) and the `build` mode click handler · `04-render.js`
204–260 (door symbol, `variant` bits), 705–714 (`DOORTYPE`) · the window type list (grep `WINTYPE\|wtype`
04-render.js) · `09-menus.js:178` (door type menu) · R1010 WP-U4 key map (what the arrows do today in `build`) ·
MATERIAL §4.

## Build
1. Two toolbar buttons replace `🚪 Build` for openings: `🚪 Ajtó` (mode `build`, `state.buildType='door'`) and
   `🪟 Ablak` (`buildType='window'`). The old Build button stays for the other build types if any remain (check the
   `buildType` list; if only door/window exist, the old button goes).
2. While the ghost is shown: **←/→** cycles `DOORTYPE` keys (door) or the window types; **↑/↓** cycles `variant`
   0 → 1 → 3 → 2 → 0 (one press flips one thing; MATERIAL §4). Window ↑/↓ cycles its opening variants if it has them,
   else does nothing. The ghost redraws at once; HUD `'Ajtó: Nyíló ajtó (egyszárnyú) · zsanér bal, befelé'`.
3. The last type + variant is remembered per tool (`state.buildPick={door:{dtype,variant}, window:{…}}`).
4. These keys win over the U4 arrow meanings only while the ghost is visible in `build` mode (the U4 meaning returns
   when the mode changes) — Q-O01.

## Tests
1. Door ghost, → three times from `hinged` → `sliding`→… exact order = `Object.keys(DOORTYPE)`.
2. ↑ from variant 0 → 1 → 3 → 2 → 0.
3. Placed door carries the ghost's `dtype` + `variant`.
4. Mode change → arrows do the U4 thing again.
