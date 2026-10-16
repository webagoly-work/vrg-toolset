# WP-B4 — Movement traces: 45° line, freehand, smoothed; door snapping

Status: todo · Wave B · Depends: B3 · Size: M (~260 lines) · Builder: mid tier
Decisions: Q16=A · Q17=A · Q18=A

## Goal
The user's words: *"these can be rotated in 45 degree (controller friendly) steps to manually draw
straight lines with 100 mm steps — or free hand mode with a toggle, but also a mode where it is free
hand, but at the end of each trace … an automatic process smoothes the jittery movements … Traced
lines like these can indicate movement heatmap / directional movement paths within the Room.
Starting/ending a path mark drawn near a Door automatically connects … that Door."*

## Read (only these)
- `01_CATALOGUES.md §3` (`MRK_TRACE_TAGS`) and `§4` (`TRC`)
- `src/05n-marks.js`: `MRK_PLANE_MODES`, the plane tool, `mrkDoorRooms`, `mrkPicker`

## Build — `05o-traces.js` (prefix `trc`)

### 1. Record (CONTRACT §3)
`{id, layer:mrkLayer(), level, plane, mode:'line45'|'free'|'smooth', pts:[[x,y]…], a:<door id>|null,
b:<door id>|null, dir:1|0, tags:['mozgas']}` — `dir:1` = directional, drawing order a→b; `0` = both ways.
`trcList()` lazy getter for `data.traces`.

### 2. Plane-tool modes — push into `MRK_PLANE_MODES`
`{k:'line45',n:'Vonal 45°-onként'}`, `{k:'free',n:'Szabadkézi'}`, `{k:'smooth',n:'Simított szabadkézi'}`.
The plane tool (B3) dispatches these modes to `trcDown/trcMove/trcUp/trcKey`.

**line45** — click-click polyline:
- first click = start (door snap §3). Each move shows the next segment in the overlay: direction =
  the pointer vector's angle rounded to a multiple of 45°, length = its projection on that direction
  rounded to 100 mm (min 100). Click commits the vertex.
- `Enter` or a double-click finishes; `Backspace` removes the last vertex; `Esc` finishes when the
  trace has ≥ 2 points, else drops the single start point (a draft, not data — CONTRACT `Esc` rule
  concerns stored data).
- the 45° rule is relative to plan axes, so a gamepad's 8 directions map 1:1 (the user's
  "controller friendly").

**free** — pointerdown starts, every move adds a point ≥ `TRC.freeMin` (20 mm) from the last,
pointerup finishes. **smooth** — as free, then on finish `trcSmooth(pts)`:
```js
trcRdp(pts,eps)        // Ramer–Douglas–Peucker, eps = TRC.rdpEps (50 mm); keeps both ends
trcChaikin(pts,n)      // Chaikin corner cutting, n = TRC.chaikin (2) passes; keeps both ends fixed
trcSmooth(pts)         // trcChaikin(trcRdp(pts,50),2), coordinates rounded to 1 mm
```
Finishing: door snap at both ends (§3), then `mrkPicker`-style small modal with `MRK_TRACE_TAGS`
checkboxes and `☐ kétirányú` (Shift = brush, no modal), then `pushUndo(['traces'])` + push.
A finished trace with fewer than 2 points or shorter than 200 mm is dropped with HUD
`'Túl rövid nyom — nem mentettem.'`.

### 3. Door snapping [Q16=A]
```js
trcDoorNear(level,x,y)   // doors (openings type 'door', not tagged nemhasznalt) whose centre is within
                         // TRC.snapDoor (600 mm) of (x,y) → nearest, or null
trcApproach(o,towards)   // the point TRC.approach (250 mm) from the door centre along the normal, on the
                         // side where `towards` lies (sign of dot((towards−centre), normal))
```
On finish: if `pts[0]` is near a door → `a=door.id`, `pts[0]=trcApproach(door, pts[1])`; same for the
last point → `b`. While drawing, the overlay shows a ring on a door the pointer is within range of.

### 4. Drawing (`STK_SCENE`)
Polyline at floor z (`dz(level,0)`; ceiling traces at floor z dashed, as B3), stroke 2 px, colour by
first tag (`mozgas` #2a8c8c, `atjaras` #5470b0, `ejszakai` #7a5cc0, `lepcso` #b07a2a), round joins.
Direction: a small filled triangle every 1000 mm along the line pointing a→b (computed geometry —
**no SVG `<marker>`**, exporters drop them); `dir:0` → no triangles, a dot at each end. Ends attached
to a door get a 3 px circle. Through `lyrWrap(t,'trace',…)`; visibility `layerShows(t,'trace')`.

### 5. Right-click (`STK_CTX`) on a trace
`Címkék…` · `Irány megfordítása` (reverse `pts`, swap `a`/`b`) · `Kétirányú be / ki` ·
`Simítás most` (free → smooth) · `Ajtókhoz kötés újra` (re-run §3) · `Törlés`.

### 6. Validation
`trace.room` (info): points of one trace fall in more than one room (`roomOf` by `pointInPoly` on
`allRooms`) — `'A nyom több helyiségen halad át: helyiségenként rajzold, ajtótól ajtóig.'`
`trace.door` (warn): `a`/`b` points at a missing opening.

## Tests — `tests/spec-38-traces.js`
1. line45 from (0,0): pointer (730,40) → vertex (700,0) (angle 3° → 0°, projection 730 → 700);
   pointer (520,480) → vertex (495,495) (angle 42.7° → 45°, projection 707 → 700 mm along 45°,
   coordinates rounded to 1 mm).
2. `trcRdp` on a straight jittery line (±10 mm) of 50 points returns 2 points.
3. `trcSmooth` keeps both end points exactly; output has more points than RDP's (Chaikin) and no point
   farther than 60 mm from the input polyline.
4. A trace ending 400 mm from a door centre attaches: `b===door.id`, last point 250 mm from the
   centre on the trace's side; 700 mm away → `b===null`.
5. A door tagged `nemhasznalt` is never snapped to.
6. Reverse swaps `a`/`b` and the point order; `dir:0` draws no triangles (scene check).
7. A 150 mm trace is dropped; undo removes a saved trace.

## Golden
Identical.

## Browser-only checks (for the human)
Freehand feel on mouse and touch · the smoothing looks natural · gamepad/keyboard-style 45° drawing.

## Verifier focus
Chaikin must keep ends fixed (standard Chaikin moves them). Door side choice uses the NEXT point,
not the pointer. Every coordinate stored rounded to 1 mm.

## Out of scope
Grid encoding, line of sight, heatmap, the room graph (B5).
