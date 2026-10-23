# WP-S4 — Golden and silver routes follow their hardware

Status: todo · Wave S · Depends: U2 (drag threshold) · Size: M (~120 lines) · Spec: 70 · Decision: Q-S05

## Goal
*"Make it so that silver lines connected to an RBX point are (by default), once reached, linked in a
way that they follow moving an RBX on the wall it is already on — same for the golden path too."*

## Root cause (README F7)
Routes attach to hardware through `dev.links` (`hasLinkTo`, 05r `chnDevAt`, 05u `armNodeLinked`).
`wvPushLinkedNodes()` (06 line 532) moves linked nodes, but only the Wall/Plane View editors call it;
plan-view moves (select drag 08 ≈ 232, `pSetC` 12-boot 61, keyboard nudge U4) do not.

## Build
1. **`flwMove(d, dx, dy)`** in 05u (it owns ARM routes; channel routes are read through `chnDevAt`):
   for every route node linked to `d` (`devLinks(d)` → `linkTargets`), on paths with
   `route==='arm'` (silver) or `route==='channel'` (golden):
   - move the linked node by `(dx, dy)` in plan; its height stays (plan-only links never pull the
     height — 05k's rule);
   - **keep the approach square**: if the neighbouring node's segment to the linked node is
     perpendicular to the wall (the drop / approach leg), move that neighbour by the along-wall
     component of the move too; if the segment runs along the wall, leave the neighbour (the leg just
     gets longer or shorter);
   - `n.j` joins (branches off another route) are not touched — a branch end that lands on a moved
     node follows automatically because joins are by id.
2. **Moving along the wall.** Dragging an RBX / BASE in plan (select drag, grab gizmo, Shift+WASD)
   slides it **along its host wall** (`hwHost(d)` → clamp `u` to the wall, keep `side`); Ctrl while
   dragging releases it to any wall (today's `cableSnap` behaviour). Then `flwMove` with the actual
   delta. Hook it where the move is applied: the select-drag `devices` branch (08 ≈ 232), `pSetC` for
   `t==='devices'` when `hwIs(d)`, and `kbdNudge` (U4).
3. **Default on**: `state.hwFollow !== false`; action + View checkbox `Pályák követik a hardvert`
   (Q-S05: also for endpoints = every linked device, not only hardware → B).
4. "Once reached": a route end becomes linked when it is finished on the box (05k `placeSnap` marks
   it, `finishPath` links it — already so); add a one-time repair action `Pálya-végek kötése a
   hardverhez` that links any channel / ARM end lying within `ARM_SNAP` (150 mm) of a hardware box in
   plan but not linked yet (CLA test plans were generated, so check them).
5. Undo: the existing single undo step of the drag covers the nodes (paths are in `UKEYS`).

## Tests — `tests/spec-70-follow.js`
1. RBX on a horizontal wall with an ARM route whose last node is linked and whose previous node is
   300 mm straight out from the wall: drag the RBX +500 mm along the wall → last node +500, previous
   node +500 (square approach kept), the rest unchanged.
2. Same with the previous node along the wall → only the last node moves.
3. A channel (golden) route between BASE and RBX: move the RBX → only the RBX end moves.
4. `hwFollow=false` → nodes stay.
5. Drag with Ctrl across to another wall → the RBX changes wall; nodes follow by the full delta.
6. Repair action links an unlinked end 80 mm from an RBX; one 400 mm away is left alone.
