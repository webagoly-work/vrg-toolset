# WP-F3 — Falak létrehozása (Create Walls)

Status: todo · Wave F · Depends: F1, F2 · Size: L (~250 lines) · Spec: next free · Decisions: Q-F01, Q-F02, Q-F04 · **⏸ before build**

## Goal
*"These wall lines represent the centre line of walls that helps create perfectly aligned joints and corners (but beware
… users would expect that the line they set will apply to measurements they took, which is always meant to be the inner
wall to inner wall distance). … Create Walls auto-draws the walls, adding a thickness that is developed symmetrically …
90° wall sections intersecting define the inner corner points of every room (which anchor the accurate elevation view
of a wall end to end). Standard wall thickness 20 or 30 cm, later sizeable by our current methods."*

## ⏸ First
Build only the planner function `wfwPlan(level)` (step 1–3, no writes) and show the user, on a 2-room sketch and on a
4-room L-shaped sketch: the typed inner sizes, the wall centrelines both Q-F01 options give, the move table. Wait.

## Read
`03-geometry.js` 201–237 (`rectWalls`), 287–348 (`wrfPlan`, `wrfSummary` — junction forms L/T/X), 352 (`createRoom`) ·
`00-core.js` 181–183 (`centerlines`, `wr`) · `06-wall-editor.js` (how an elevation finds its wall ends) · MATERIAL §8.

## Build
1. `wfwPlan(level)` → `{walls:[{x0,y0,x1,y1,t,ext,rooms:[id]}], moves:[{room, dx, dy, why}], skipped:[{edge, why}]}`.
   Q-F01 A: the grid-line expansion of MATERIAL §8 (rooms keep their clear size; shared lines become centrelines `t`
   apart). Q-F01 B: the drawn lines are centrelines, no moves.
2. Thickness: `state.penThick.ext` (300) for edges no other room touches, `.int` (200) for shared ones (Q-F04 sets the
   pair). 45° edges → `skipped` with `'ferde él — fal később'` (Q-F02 A).
3. Junctions exact via `wrfPlan`'s forms (L = full corner square, T = butt on the face).
4. Button `🧱 Falak létrehozása` (stage rail + action registry `wf.walls`, group `Fal`) → dry-run table (contract §4:
   one row per room move + a summary line `27 fal · 12 L · 15 T · 0 ferde`) → Alkalmaz: apply moves to the floor
   polys, push walls into `WALLS[level]` (with ids, `layer:curLayer()`), `SNAP[level]=centerlines(...)`,
   one `pushUndo()`.
5. **Re-runnable:** walls created by this button carry `gen:'wfw'`; a re-run replaces only those (hand-drawn walls stay).
   Rooms stay `stage:'outline'` until F4.
6. Wall look until F4 runs: walls drawn as today; the rooms show no floor fill (the "walls without foundation" look).

## Tests
1. Two rooms 3600 × 3000 drawn sharing x = 3600, Q-F01 A, int 200, ext 300: room B moves +200 in x; walls: shared
   centreline x = 3700, outer left centreline x = −150, outer right x = 7400 + 150 = 7550; both rooms' clear widths
   still 3600.
2. Same with Q-F01 B: no moves; centrelines x = 0 / 3600 / 7200, clear widths 3600 − 150 − 100 = 3350 each (the label
   shows `tengely 3 600 · belméret 3 350`).
3. L-shaped 3-room sketch → junction counts match `wrfSummary` (exact numbers written by the builder into the spec after
   the ⏸, from the approved sketch).
4. Re-run after an F2 drag replaces `gen:'wfw'` walls only; a hand-drawn wall survives.
5. `createRoom` / `rectWalls` output byte-identical (golden 70/70).

## Out of scope
Diagonal walls (Q-F02 B/C would be its own WP) · openings (O1).
