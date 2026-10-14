# WP-R1 — Room type wheel (LMB), advanced settings (RMB)

Status: todo · Wave R · Depends: F1 · Size: M (~180 lines) · Spec: next free · Decisions: Q-R01, Q-R02

## Goal
*"Users can click on unset rooms to choose which room type they will be — clicking brings up the cycle menu we created
for the Controller: an 8-section selection wheel with the seven most common room types; South always brings up the next
wheel. This can be done multiple times on the same room to make it multi-type — selecting an already chosen one
deselects it. Left click = the wheel quick set, right click = our current method, the advanced room settings."*

## Read
`08b-gamepad.js` 214–372 (the wheel: `GROUP_ORDER`, `TOP`, `wheelOpen`, `wheelDescend`, `drawWheel` into `#gpWheel`) ·
`05t-needs.js` 17–60 (`NEED_KINDS`, `needKind`, `rm.kind` override at line 129) · `10-lamps.js` 356–360 (`allRooms`,
`roomHitAt`), 496/510 (RMB → `roomMenuItems`) · MATERIAL §2.

## Build
1. Lift the wheel **drawing** out of the GP closure into `rwDraw(host, ring, pick)` (geometry R 150 / r 62, sector 0 up,
   clockwise — byte-identical SVG for the gamepad, spec-checked) and use it from both. The gamepad keeps its own state.
2. `rwOpen(at, rings, onPick)` — mouse wheel menu at the click point: hover picks a sector (angle from centre, dead zone
   r < 30 = none), LMB confirms, Esc / RMB / click in the dead zone closes. Sector 4 (South) = `Továbbiak ›` → next ring;
   on the last ring South = `‹ Vissza`.
3. Rings from MATERIAL §2 (`RW_ROOM_RINGS`), Q-R01 may reorder. New kinds `gyerek`, `gardrob`, `mosokonyha` are added to
   `NEED_KINDS` **only** if Q-R02 = A (each with the defaults row of the kind it inherits).
4. Room field `kinds:[]`: pick a kind not in it → push; pick one in it → remove (toggle); `rm.kind = kinds[0]`
   (`delete rm.kind` when empty) so every old reader (`needKind`, F4 tint) keeps working. Sectors already set are drawn
   filled (selected state).
5. Trigger: in modes `select` and `room`, **LMB on a room's interior where no other item is hit** opens the wheel —
   only for rooms with no kind yet, or always? → Q-R02 b (default: always, but only with the `room` tool or with Alt in
   `select`, so plain selecting does not keep popping a wheel).
6. RMB keeps today's `roomMenuItems` (the advanced settings) — no change.
7. Room label: `Konyha + Étkező` when 2+ kinds.

## Tests
1. `rwDraw` output for the gamepad's first ring is byte-identical to the old `drawWheel`.
2. Angle → sector: (0,−100) → 0, (100,0) → 2, (0,100) → 4, r 20 → none.
3. Pick konyha, etkezo → `kinds=['konyha','etkezo']`, `kind='konyha'`; pick konyha again → `['etkezo']`, `kind='etkezo'`.
4. South on ring 1 → ring 2 shown; South on the last ring → ring 1.
