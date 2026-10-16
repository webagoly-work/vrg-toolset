# WP-G1 — Wide doors and windows

Status: todo ⏸ look checkpoint first · Wave G · Depends: — (U2's aura uses its footprint later) ·
Size: M (~160 lines) · Spec: 65 · Decision: Q-G01

## Goal
*"Doors and windows so far were a thin line from the top-down view → I want you to make them wide,
ajtó reaching wall to wall, windows almost reaching wall to wall, with some slight but visually
apparent differences."* (picture 3 shows the current line look.)

## ⏸ Before building
Draw the MATERIAL §7 door and window (one hinged door, one double door, one window) as a static mock
— an SVG in the scratchpad, or `openingSym` variants rendered via the browser pane on P33 v2 at top
view and at 30° — and show the user. Wait for "ok" or for changes to the §7 numbers.

## Read
`04-render.js` lines 194–260 (`bpDoorSymbol`, `bpWallSpans`), 636–690 (`DOORTYPE`, `openingSym`,
`pushOpening`), line 98 (where openings enter the scene) and 823 (white-out) · `03-geometry.js`
`wallInfo`, `openingOnCentreline`.

## Build
1. `opnHost(o)` (MATERIAL §7) + a per-draw cache keyed by `sceneVer` or rebuilt at the top of
   `drawNormalGeom` — openings × walls is small, but `openingSym` is also called from the white-out
   overlay every frame.
2. `opnFootprint(o)` → `{door:bool, corners:[4 plan pts], u0,u1, inset, host}` — door full thickness,
   window inset `clamp(0.12·t, 15, 40)` mm.
3. `pushOpening(faces,o)` when `state.openingStyle!=='line'` and a host exists:
   - 3D: the two vertical faces at the footprint's two long edges (door: wall faces; window: inset
     planes), plus the two jamb faces, z from sill to head; door fill `bgCol()` op 0.96, window glass
     tint op 0.35 + the frame stroke; key bias +40 as today;
   - top (pitch ≥ 88): additionally the footprint polygon at wall-top z (key bias so it sorts above
     the wall top face), carrying the 2D symbol lines (jambs, leaf + swing, or the double glass line).
   Factor `bpDoorSymbol` so it takes a pen function (`bpSW` for the blueprint, `nvSW` with
   `NV_PEN` for the modelling view) instead of duplicating the six door types.
4. `openingSym(o)` (white-out overlay) — the same footprint and lines, no fill colour.
5. `state.openingStyle` — select in the View panel `Nyílászárók: széles / vonal`, action
   `view.openings`; default **`'line'` while you build**, then flip (step 7).
6. Selection: the aura (U2) and `hitTest` use the footprint once this exists (inside the footprint
   = a hit on the opening) — small follow-up inside this WP if U2/U3 are built.
7. **Golden:** with `'line'` default → run the suite, goldens identical. Flip the default to `'wide'`,
   `node tests/run.js --golden-update`, and list in the report every capture that changed. Expected:
   `scene@0/45/90` and `plan2d` of fixtures that have openings; **blueprint and editor captures must
   not change** — if one does, stop.

## Tests — `tests/spec-65-wide-openings.js`
1. `opnHost` finds the wall for a door on a 100 mm and a 300 mm wall; returns null for a free-standing
   opening.
2. Door footprint width across the wall = wall thickness exactly; window = thickness − 2·inset
   (100 mm wall → 76; 300 mm → 220; 30 mm → 0 is impossible — inset clamps so the window keeps ≥ 0;
   assert ≥ 10 mm).
3. `openingStyle='line'` → scene string identical to before the WP (capture taken at the start).
4. Top view, `'wide'`: the scene contains a polygon at wall-top z with the door's four corners.

## Verifier focus
Hinge side and swing direction for every `variant` (bits 0 and 1 — compare with the blueprint, which
is right); the 180°-rotated P33 test plan (`variant ^= 3` convention, 10-09 handover); windows on
thin partitions; openings whose host wall was deleted.
