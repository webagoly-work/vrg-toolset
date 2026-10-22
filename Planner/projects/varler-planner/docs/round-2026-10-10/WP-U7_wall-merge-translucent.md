# WP-U7 — "Falak egyesítve" works in translucent mode

Status: todo · Wave U · Depends: — · Size: S (~60 lines) · Spec: 64 · Decision: Q-U06

## Goal
*"What does this button (Falak egyesítve) do, and when is it working exactly? It doesn't seem to work
for me."* — Answer in README §3. The fix makes it do what the user expects in the default wall mode.

## Root cause
`04-render.js` line 86: `const merge = wallMergeOn() && wm === 'solid';` — the default `wallMode` is
`'translucent'`, so the toggle is a no-op there (measured byte-identical on CLA v2).

Simply widening the gate is **not enough**: `faceBuried()` (line 495) tests a face's *centroid*, so it
drops end caps that sit inside another wall but keeps the two **top faces** that overlap at every
corner square and any side face only *partly* inside a neighbour. At opacity 1 that is invisible; at
0.5 the overlap is painted twice — the darker squares of picture 3 would stay.

## Build
1. Line 86 → `const merge = wallMergeOn() && wm !== 'hidden';`
2. **Cover each plan point once** (only when `merge && op < 1`): walls are axis-aligned boxes, so
   clipping is rectangle arithmetic, not general polygon clipping.
   - `rectMinus(a, list)` → array of ≤ 4·n axis-aligned rects (a minus every rect in `list`).
   - **Top face** of wall *i*: `rectMinus(footprint_i, footprints of walls 0…i−1 that share its top z
     (±2 mm))` → push one top face per remaining piece (same fill, same key as the original top
     face).
   - **Side face** lying in the plane x = c (or y = c): its rectangle in (along, z) minus, for every
     sibling box that contains the plane strictly inside its x-range (y-range), the sibling's
     (along-range × z-range) → push the pieces. The existing centroid test stays for whole buried faces.
   Put both in `pushBox` behind the `mg` argument (`mg.clip = op < 1`), so solid mode and every
   golden fixture take the unchanged path.
3. The checkbox (`shell.html` line 385) and the `view.wallmerge` action: disabled with the tooltip
   `'Rejtett falaknál nincs mit egyesíteni.'` when `wallMode==='hidden'`; the existing tooltip gains
   `' Áttetsző és tömör falaknál is működik.'`.
4. Q-U06: default stays **off** (A), or on for new projects (B; an existing project's
   `state.wallMerge` is respected).

## Tests — `tests/spec-64-wall-merge.js`
1. `rectMinus` unit cases: disjoint → unchanged; contained → `[]`; corner overlap → 2 pieces whose
   areas sum to `area(a) − overlap`; cross → 4 pieces.
2. An L corner of two 100 mm walls, translucent, top view: with merge on, the summed area of all top
   faces equals the **union** area (no double coverage); off → equals the sum of both footprints.
3. Hidden mode: scene identical on / off. Solid mode: scene identical to today's solid + merge
   (byte-compare against a capture taken before your edit).
4. Golden identical (fixtures render with merge off).

## Browser (owed)
Translucent walls, the corner of picture 3, top view and 30°: before / after screenshots; sample the
pixel colour inside the corner square and inside a plain wall — equal after the fix.
