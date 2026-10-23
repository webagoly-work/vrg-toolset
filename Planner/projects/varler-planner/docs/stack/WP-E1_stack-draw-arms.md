# WP-E1 — Draw on the stack as one layer: ARM routes

Status: todo · Wave E · Depends: C5, D1 · Size: M (~230 lines) · Builder: mid tier
Decisions: Q40=A

## Goal
*"Making use of the layer stack (and a function that lets me draw on it as if it were a single
layer), I want to draw simple, one-line connected pathways … that branch out on one or multiple
pathways from the RBX to reach every endpoint in the room, regardless of function or layer."*
These one-line routes are BRIDGE **ARMs** (STD-004: `CLA.R03.A2`, layers as an attribute, never in the
name). One route carries any number of layers — **the same route, separate conduits** (A2 §0) is
worked out later by the fill (E3); here we only draw geometry and joins.

## Read (only these)
- `src/05r-channel.js` (`CHN_T`, `CHN_PATH_HOOKS`, the tool pattern — copy it)
- `src/05k-room-auto.js` lines 266–285 (`devAtBase`, `placeSnapAt`)
- `src/05l-layers.js` `lyrOp` (you add one multiplier)
- `grep -n "function insertNode\|function splitSection\|function addNodeAt\|insertNodeAt" src/*.js` — is
  there an existing "insert a node into a path at a point"? (decides §3)

## Build — `05u-arms.js` (prefix `arm`)

### 1. Stack view — `state.stkView`
Action `stack.view` (group `Stack`, `Stack nézet (egy rétegként)`, key none): on → every layer of the
active stack is drawn as is; every **non-stack** layer is faded to 30 %. Implement as one guarded
multiplier in `lyrOp`: `if(state.stkView&&typeof armFade==='function')op*=armFade(item);` where
`armFade(item)` = 1 for items on a layer of the active stack, else 0.3. Hit-testing is unchanged —
devices of every visible layer stay snappable (that is what "as one layer" means for drawing).

### 2. The ARM tool
`ARM_T={on:false, rule:'sull'}` — action `arm.route` (group `ARM`, `ARM pálya rajzolása`, icon `⑂`):
sets `state.activeLayer` = the stack's `arm` layer, turns `stkView` on, `setMode('path')`,
`ARM_T.on=true`. `Tab` flips the rule (HUD). Node-on-device snapping and linking come from
`placeSnapAt` (any device on any visible layer).
`CHN_PATH_HOOKS.push(armPathFinished)`: when `ARM_T.on` → `p.route='arm'`, `p.rule`, sections' `build`
as in C5, `p.color='#5a5a5a'`; then `armJoinEnds(p)`.

### 3. Branching — explicit joins
```js
armJoinEnds(p)   // for the first and the last node: another route (route 'arm' or 'channel') node at the
                 // same level within 1 mm in plan → n.j={p:other.id, n:otherNode.id}; the height may
                 // differ (the vertical drop counts as length in E2). Snap the end exactly onto it.
```
Branching from the MIDDLE of an existing segment: if an insert-node function exists, split that
segment at the projected point (≤ 15 px from the segment) and join there; otherwise v1 allows branching
from existing nodes only — HUD `'Ágaztatás meglévő csomópontból: kattints egy pálya-töréspontra.'`
and say which in the report.
A node `j` pointing at a deleted path/node is dropped by a tidy pass in `pruneLinks`'s spirit —
add `armPruneJoins()` and call it from a `VALIDATORS` run (report), not on every draw.

### 4. Derived
```js
armRoutes(roomId?)   // route 'arm' paths (in a room: most nodes inside its polygon)
armRef(p)            // 'A<n>': n = rank of p among its room's ARM paths by id (creation) order
armRoomOf(p)
```
Overlay while the ARM stage is active: `armRef` labels at each route's first segment; unlinked
route ends as hollow red circles; endpoints of the room with **no** ARM route reaching them (no link
on any node of an arm/channel route) as pulsing-free amber rings (static — no animation).

### 5. Checks — `STK_CHECKS.arm`
`warn` an endpoint (any `ep`/classic device on a stack `sys:*` layer) not linked to any arm/channel
route node · `warn` an ARM route end neither linked nor joined · `warn` a `sull` ARM segment lying
along a wall tagged `ban` (both nodes inside the wall rect expanded by 20 mm, segment parallel to the
wall) → `'Tartófal: süllyesztett ARM itt tilos — <armRef>'` · `info` an ARM crossing a `ban` wall
(a penetration) · `info` a room with endpoints and no RBX route start (no ARM node linked to its RBX).

## Tests — `tests/spec-49-arms.js`
1. Drawing a route from an RBX to a SEN with the ARM tool: `route==='arm'`, both ends linked.
2. A second route starting on the first route's middle node gets `j` pointing at it (same x,y; h may differ).
3. `armRef`: three routes in one room → A1, A2, A3 by id order; another room starts at A1.
4. `stkView` on: an item on a non-stack layer renders with `opacity="0.3"` (combined with its op);
   off: unchanged scene (byte-identical to before).
5. Checks: an unlinked SOC → warn; a sull ARM along a `tartofal` wall → warn; along a `valaszfal` → none.
6. Deleting the joined-to path → `armPruneJoins` removes the dangling `j` and reports it.

## Golden
Identical.

## Browser-only checks (for the human)
Drawing branches feels natural; stack view makes the room readable as one drawing.

## Verifier focus
The hook order: `armJoinEnds` must run after `linkMarkedNodes` (it does, via `CHN_PATH_HOOKS`).
`Tab` handling shared with C5 without double-flipping (only the active tool flips).

## Out of scope
Cables and conduits (E3). Automatic routing (the user draws; the system fills).
