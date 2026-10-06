# WP-B5 — Portal graph: doors as nodes, line of sight, 500 mm trace encoding, heatmap

Status: todo · Wave B · Depends: B4 · Size: M (~260 lines, mostly pure functions) · Builder: mid tier
Decisions: Q18=A

## Goal
The user's words: *"doors … independently encode … relative distance and relative position and door
frame angle — whereas the drawn traces are encoded between/around these doors on a 500×500 mm
resolution grid. Drawn paths are always related to the shortest line connecting two doors that 'see'
each other … line of sight happens automatically when two doors share a floor."*
This is BRIDGE-STD-003's **portal graph** (zones as nodes, doorways as edges) built from the drawing.
Everything here is **derived, never stored** — one pure function returning JSON, plus two overlays.

## Read (only these)
- `01_CATALOGUES.md §4` (`PRT`) · `src/05o-traces.js` (yours) · `src/05n-marks.js`: `mrkDoorRooms`,
  `mrkOpeningTags`, `mrkDoorTier` · `src/10-lamps.js` `pointInPoly`, `allRooms`

## Build — `05o-traces.js` (prefix `prt`)

### 1. Geometry helpers (pure)
```js
prtSegInPoly(a,b,poly)   // true when segment a–b stays inside poly: no proper intersection with any edge
                         // AND the midpoint is inside. Touching a vertex counts as inside.
prtGrid(poly,g)          // cells {i,j} whose centre ((i+.5)g,(j+.5)g) is inside poly — absolute grid
prtAStar(poly,a,b,g)     // 8-neighbour A* over prtGrid cells from a's cell to b's cell; diagonal moves only
                         // when both orthogonal neighbours are free (no corner cutting); cost 1 / √2 × g;
                         // returns {len_mm, cells:[[i,j]…]} or null. Ties broken by (i,j) order — deterministic.
prtFrame(o,approachPt)   // {ox,oy, ux,uy, vx,vy}: origin = the approach point, u = wall direction
                         // [cos ang, sin ang], v = the inward normal (pointing into the room of approachPt)
prtToFrame(F,x,y)        // [(x−ox)·u, (y−oy)·v] in mm
prtBearing(F,x,y)        // degrees −180…180 of (x,y) seen from the origin, 0 = straight into the room
```

### 2. `prtGraph(level)` → plain JSON
```js
{level, grid:500,
 doors:[{id, x,y, ang, w, tier, tags, open, anchor, rooms:[ridA, ridB]}],   // ridX null when outside
 edges:[{a,b, room, d, los, dGrid, bearA, bearB}],
 traces:[{id, room, a,b, dir, len, ratio, cells:[[i,j]…]}],
 heat:{<roomId>:{'i,j':count}}}
```
- **doors**: openings `type==='door'` on `level`, excluding tag `nemhasznalt`. `open` = tag `nyitva`
  (a habitually open door: no portal, the two zones merge — STD-003). `anchor` = tag `bejarat`
  → `'house'`, `lepcso` → `'floor'`, else null. `tier` from `mrkDoorTier`. Rooms by `mrkDoorRooms`.
- **edges**: for each room, every unordered pair of its doors (a by id order < b). Endpoints are the
  two doors' approach points into THIS room (`trcApproach` toward the room's interior: use the room
  side of the door). `d` = straight distance (mm, rounded). `los = prtSegInPoly(pa,pb,roomPoly)`.
  `dGrid` = `los ? d : prtAStar(...).len_mm` (null if unreachable). `bearA` = `prtBearing(frameA, pb)`,
  `bearB` = `prtBearing(frameB, pa)`, rounded to 1°.
- **traces**: `data.traces` on `level`, `plane==='floor'`. `room` = the room holding most of its points.
  Resample the polyline every `PRT.resample` (250 mm, ends included). If `a` is set: frame = door a's
  frame in this room; cells = `[floor(u/500), floor(v/500)]` per sample in that frame, consecutive
  duplicates removed. Without `a`: absolute cells (`floor(x/500)`,`floor(y/500)`) and `rel:false`.
  `len` = polyline length; `ratio` = `len / dGrid(a,b)` when both ends sit on doors with an edge, else null.
- **heat**: per room, absolute cells of every resampled trace point → count (a trace counts once per
  cell: dedupe within the trace).

### 3. Overlays (toggles in `state`, both default off)
- `state.prtShow` — action `portal.graph` (group `Jelölés`, `Portálgráf mutatása`): door nodes as 8 px
  circles (anchor doors double ring, `open` doors hollow), edges as straight dashed lines when `los`,
  else the A* cell-centre polyline dotted; edge label `d` in m (1 decimal) at the midpoint.
- `state.prtHeat` — action `portal.heat` (`Mozgás-hőtérkép`): each heat cell as a 500 mm square at
  floor z, fill `#d0503a`, fill-opacity `0.08 + 0.42 × count/max` of that room.
Both into `STK_OVERLAY` (derived views, not drawing).

### 4. Export — action `portal.export` (`Portálgráf exportálása (JSON)`)
`download('portalgraph-'+level+'.json', JSON.stringify(prtGraph(level),null,1))` (`download` exists
in `11-controls.js`). This is the Phase 3 seam for STD-003's presence engine.

### 5. Checks — `STK_CHECKS.mark`
`warn` a room with ≥ 2 doors and no trace between any two of them (`'<szoba>: nincs mozgásnyom két
ajtó között.'`) · `info` a door with no room on one side (outside door) is fine — skip it.

## Tests — `tests/spec-39-portal-graph.js`
Fixture A: rectangle room 4000×3000, door D1 on the left wall at y=1500, door D2 on the right wall at
y=1500. Fixture B: L-shaped room (0,0)-(4000,0)-(4000,1500)-(1500,1500)-(1500,4000)-(0,4000), door on
the bottom of the vertical leg and door on the right end of the horizontal leg.
1. A: one edge, `los:true`, `d` = 4000 − 2×250 = 3500, `bearA` ≈ 0, `bearB` ≈ 0.
2. B: `los:false`, `dGrid > d`, `prtAStar` path cells all inside the polygon, deterministic on re-run.
3. `prtSegInPoly` on a segment cutting the L's inner corner → false; along an edge → true.
4. A straight trace D1→D2 in A (attached: from (250,1500) to (3750,1500)) encodes in D1's frame
   (u along the wall, v into the room, origin at D1's approach point) to exactly
   `[[0,0],[0,1],…,[0,7]]` (v = 0…3500 mm → indices 0…7); `ratio` = 1.0 (±0.02).
5. heat: two identical traces → each cell count 2; one trace looping over the same cell → count 1 there.
6. A door tagged `nemhasznalt` is absent; `nyitva` is present with `open:true`; `bejarat` → `anchor:'house'`.
7. `prtGraph` output survives `JSON.parse(JSON.stringify(x))` unchanged (plain data).

## Golden
Identical (overlays default off).

## Browser-only checks (for the human)
Graph overlay readable on a real plan (P33 ground floor) · heatmap tint not overpowering.

## Verifier focus
No-corner-cutting rule in A*. Frame orientation (v into THIS room, per room — the same door has two
frames). Determinism (sorting by id everywhere output order matters).

## Out of scope
Presence-engine logic (STD-003 fusion), zone splitting of one room into dwell/transit (a later use of
`plane` zones tagged `tartozkodas` / `folyoso`).
