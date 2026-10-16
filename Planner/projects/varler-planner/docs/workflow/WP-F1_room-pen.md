# WP-F1 — Room pen (Helyiség-toll)

Status: todo · Wave F · Depends: — · Size: M (~200 lines) · Spec: next free · Decisions: Q-F01, Q-F02, Q-F03

## Goal
*"Users can click to create multiple nodes, the line drawn is locked into 45 degree straight lines with 100 mm ticks —
if the last node touches the first, it creates a custom size room with data on Kerület and Terület. Also, hold and drag
to select area like with multiple selection. Users create each room like this."*

## Read
`08-interaction.js` 15–33 (`HINTS`, `setMode`), 106–150 (pointer down: `selBox`, the Floor tool's `floorDraft` push at
142–144), 485–510 (`floorNearFirst`, `finishFloorDraft`) · `04-render.js` 965–980 (Floor draft render, live label) ·
`03-geometry.js` 352–368 (`createRoom` — what a room record is) · MATERIAL §1, §8.

## Build
1. New mode `room` (toolbar button `⬚ Helyiség` in the `wall`/`build` group of shell.html:283, hint below). It reuses
   the Floor tool's draft array and close logic — refactor `floorNearFirst`/`finishFloorDraft` to take the draft as an
   argument rather than copying them.
2. Snapping per node, in this order: (a) existing room vertex ≤ 12 px → that vertex; (b) existing room edge ≤ 12 px →
   the foot point on it (marks a shared edge — F2 reads it); (c) direction locked to the nearest 45° from the previous
   node (`state.pen45`, Shift = free); (d) length rounded to `state.penTick` (100).
3. Hold + drag with no draft open = rectangle room (corner to corner, 100 mm grid). Under 300 × 300 = ignored (that was
   a click).
4. Typing digits while a segment is open sets its exact length (Enter applies). Under Q-F01 A the typed number is the
   **inner** length (the record is a clear polygon); the label says `belméret`.
5. Close (first node / Enter / rectangle release) → `data.floors.push({level, poly, name:'', stage:'outline',
   clear:true, layer:curLayer(), mat:'hidegburkolat'})` with `pushUndo(['floors'])`. No walls, no fill.
6. Render `stage:'outline'`: dashed 1.2 px outline, no fill, centre label `Kerület 14,40 m · Terület 12,96 m²`
   (Hungarian decimal comma, area of the clear poly). Rooms of other stages render as today.
7. Edges at 45° are allowed in the outline (Q-F02 A); the label marks them `ferde`.
8. Hint (HINTS.room): `'Helyiség-toll — kattints pontról pontra (45°-os irányzár, 100 mm lépés; Shift = szabad szög),
   az első pontra kattintva zárul. Nyomva tartva húzz: téglalap helyiség. Gépelj számot a pontos hosszhoz (belméret).
   Backspace: utolsó pont vissza · Esc: elvetés.'`

## Tests
1. Nodes (0,0) → cursor (1234, 40) with pen45 → snapped to (1200, 0); cursor (1010, 1030) from (0,0) → (1000, 1000) (45°).
2. 4 nodes 3600 × 3000 + close → one floor, `stage:'outline'`, `clear:true`, area 10,80 m², perimeter 13,20 m.
3. Rectangle drag 0,0 → 3610,2990 → poly 3600 × 3000. Drag 200 × 200 → no room.
4. Node near another room's edge (8 px) → lands on the edge (foot point), flagged `shared` in the draft.
5. Undo removes the room; old files without `stage` render exactly as before (golden identical).

## Out of scope
Dragging edges, splitting (F2) · walls (F3) · naming / type (R1).
