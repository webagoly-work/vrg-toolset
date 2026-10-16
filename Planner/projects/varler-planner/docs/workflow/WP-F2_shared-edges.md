# WP-F2 — Shared edges: drag a wall line, split a room

Status: todo · Wave F · Depends: F1 · Size: M (~150 lines) · Spec: next free · Decisions: —

## Goal
*"Placing some of their nodes on other rooms' lines indicates shared walls … users can hold and drag shared wall lines
(like in Sims building mode) — a room can be split automatically into two rooms if separated with two new nodes created
on its lines connecting within the room."*

## Read
WP-F1 (the outline record) · `03-geometry.js` `pointInPoly`, `rectsUnionOutline` · `10-lamps.js:356` `allRooms` ·
MATERIAL §1.

## Build
1. `wfpEdges(level)` → every outline edge `{room, i, a, b}`; `wfpShared(level)` → groups of edges that are collinear
   and overlap by ≥ 100 mm (tolerance 5 mm). **Derived, never stored** (05h's rule).
2. In mode `room`, hovering an edge highlights it **and every edge in its shared group**. LMB hold on it → drag
   perpendicular to the edge (100 mm ticks): move both endpoints of every edge in the group; vertices that sat on the
   moved line in other rooms move with it. One `pushUndo(['floors'])` per drag. Live label: `Δ +200 mm`.
3. A drag that would make a room self-intersect or < 300 mm wide is clamped and the HUD says
   `'A helyiség nem lehet keskenyebb 300 mm-nél.'`
4. **Split**: with the pen, start a node ON a room's edge, end ON another edge of the same room (any nodes between) →
   the room is cut into two polygons along that polyline. The bigger part keeps the record (id, name, kinds), the
   smaller one is a new outline room. HUD `'Helyiség kettévágva: 7,20 + 5,76 m²'`.
5. Rooms of stage `floor` with walls built (F3) can be dragged too, but walls then need a rebuild: HUD
   `'A falak frissítése: Falak létrehozása újra.'` (F3 is re-runnable).

## Tests
1. Two rooms 3600 × 3000 side by side sharing x = 3600 → one shared group of 2 edges.
2. Drag that group +200 → room A 3800 wide, room B 3400 wide, both still closed, areas 11,40 / 10,20 m².
3. Split a 6000 × 3000 room with a line x = 3600 → two rooms 10,80 + 7,20 m²; the bigger keeps the id.
4. Clamp: drag that would leave 250 mm → stops at 300.

## Out of scope
Walls (F3) · moving devices that sit in the room (none exist yet at this stage; later stages keep F3's rebuild message).
