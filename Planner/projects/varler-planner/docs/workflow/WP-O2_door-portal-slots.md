# WP-O2 — The door is the portal: slots from placement; window redőny slot

Status: todo · Wave O · Depends: O1 · Size: M (~160 lines) · Spec: next free · Decisions: Q-O02, Q-O03

## Goal
*"As we discovered Portal mid-way, I want to bring this notion to the point of setting Doors — doors already carry
measurements and positions of future layers, lining up vertically: knob side by default expecting 230 V things, hinge
side for LV and other features, and the middle of the door. Windows, similarly, create their optional position on their
sides for redőny betáplálás (activated only if redőny is selected later for the room the window is in)."*

## Read
`06a-portals.js` whole (182 lines: `PT_CLS`, `PT_OFF`, `ptDoorGeo`, `ptSlotPt`, `ptOf`, `ptAuto`, `ptMake`) ·
`tools/baseline/rules.js` 66–78 (`PORTAL_SLOTS`, `PORTAL_ZONE`) · `04-render.js:238` (variant → hinge side) ·
MATERIAL §4.

## Build
1. Move `PORTAL_SLOTS` into `06a-portals.js` as `PT_SLOTS` (same rows, same keys). Spec asserts deep-equal with
   `require('../tools/baseline/rules.js').PORTAL_SLOTS` until E5 makes the engine read the Planner copy.
2. `ptSlots(door, face)` → `[{k, side, x, y, h, fam, n, codes}]` in plan mm, the hinge side taken from the door's
   `variant` (`hingeAtStart`), using `ptDoorGeo` + `ptSlotPt` (they already place the hinge/latch columns).
3. **On door placement** (O1) and on variant change: if Q-O02 = A, call `ptAuto` for that door (a `portal` device per
   face, tier `SF-0 előkészítve`) — the slots then exist from the first click. B: slots are drawn as ghosts only; the
   portal device is made when the first thing links to a slot.
4. Draw: slots as faint dots + key (`L1`, `H0`…) on the door's faces, **only those whose family's phase is active**
   (E0 sets `state.wfPhase`; before E0 lands, show MAINS slots when the Erősáram layer is active, all slots when the
   Hardver layer is active).
5. Window slot `W1` (MATERIAL §4): computed the same way; drawn and offered only when the room has the `redony` rule
   (R3) or the opening tag `redony` (P33's mark). Otherwise it does not exist (Q-O03).
6. Slot hit-test: `ptSlotAt(e)` → `{door, face, k}` for E1 linking (no UI here beyond the hover label
   `'L1 · kapcsoló (kilincsoldal) · 1100'`).

## Tests
1. `PT_SLOTS` deep-equals the engine's table.
2. A door 900 wide on a wall along x, variant 0 → `L1` on the latch side at `u = 150` from the latch edge, h 1100; flip
   to variant 2 → L1 moves to the other edge (exact coordinates in the spec).
3. Q-O02 A: placing a door creates one portal per face (`ptOf(door.id,0/1)` both non-null); undo removes them.
4. Window in a room without redőny → `ptSlots(window)` empty; with the `redony` tag → one `W1` at h 2500.
