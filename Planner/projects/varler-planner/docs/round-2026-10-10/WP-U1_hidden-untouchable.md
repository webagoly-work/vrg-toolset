# WP-U1 — What is not seen cannot be touched

Status: todo · Wave U · Depends: — · Size: S (~80 lines) · Spec: 58 · Decision: Q-U01

## Goal
*"Inactive / toggle-hidden layers' devices and features should not still be clickable — what is not
seen can not be touched."*

## Root cause (README F3)
`hitTest()` and `devHitIdx()` (`09-menus.js` lines 10, 64) filter by **lock** only (`lyrLockHit`);
draw time (`04-render.js`) filters by `state.levels[level] && layerShows(item, cat) && soloOk(...)`.

## Build
1. **`hitOk(item, cat, level)`** in `09-menus.js` above `hitTest` — the single predicate, mirroring
   draw time:
   ```js
   // the hit side of what 04-render draws: a level that is off, a layer or sub-layer that is hidden,
   // a solo room that excludes it — none of it can be clicked, hovered, boxed or menu'd
   function hitOk(item,cat,level){const L=level||(item&&item.level)||state.active;
     if(L&&state.levels&&state.levels[L]===false)return false;
     if(!layerShows(item,cat))return false;
     if(item&&item.x!=null&&typeof soloOk==='function'&&!soloOk(item.x,item.y,L))return false;
     return true;}
   ```
   Categories exactly as 04-render passes them: roofs/openings/floors `'build'`, objects `'object'`
   (+ the `isGenObject && !genObjectsVisible()` rule), devices `'device'`, walls `'wall'` (+
   `soloWallOk`, and `state.wallMode==='hidden'` → walls untouchable), paths `'path'`, cables `'cable'`
   (+ `circOn[cb.type]`), notes `'note'`.
2. Apply it in **every** hit path, each a one-line guard next to the existing `lyrLockHit`:
   `hitTest` (all eight collections), `devHitIdx`, `pathSectionHit` (09 line ≈ 58), `wallHitRect`
   (find it — `grep -n "function wallHitRect" src/*.js`), `finishSelBox` (08 ≈ line 283), `lampAt`
   (10-lamps line 134), and the stack pick helpers that select devices by click (`grep -n
   "devHitIdx\|hitTest(" src/05*.js` — every caller inherits the fix, but any module that loops over
   `data.devices` itself to find a click target needs the guard too).
3. **Not** in scope (Q-U01=A): snapping. Wall / centreline snapping and the path-node-on-box snap keep
   using geometry the user may have hidden on purpose (drawing on a hidden wall layer is common).
   If Q-U01=B, add `hitOk` to `placeSnap`'s box search (05k) as well.
4. Layer **spotlight** (`lyrSpotSet(lyrSpotOfDevice(devHitIdx(e)))`, 08 lines 68 / 151) now never
   lights a hidden layer — correct, no change needed.

## Tests — `tests/spec-58-hit-visible.js`
Fixture: two layers L0 + L1; a device, an opening, a wall and a note on L1 at known points.
1. `hitTest` at each point returns the item; hide L1 → `null`; show L1, hide only the `device`
   sub-layer (`L.cats.socket=false` for a socket) → the device is not hit, the note still is.
2. Level off (`state.levels.ground=false`) → nothing on it is hit.
3. `devHitIdx` mirrors 1–2.
4. Box select over all four with L1 hidden → `selList().length === 0`.
5. `state.wallMode='hidden'` → the wall is not hit; `'translucent'` → it is.
6. Locked layer still reports "Zárolt réteg" (unchanged behaviour).

## Verifier focus
A collection missed in one hit path (cables and measures are easy to forget); the generated-object
rule; `soloOk` called with a wall rect (walls use `soloWallOk`); nothing in the render changed (golden
identical).

## Browser (owed)
CLA v2: hide "Erősáram" (or a sub-layer row) → click where a socket was → nothing selected, no menu
on right-click, no lamp thumbnail on hover.
