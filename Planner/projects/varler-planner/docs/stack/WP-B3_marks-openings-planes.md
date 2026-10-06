# WP-B3 — Marking layer: doors, windows, floor and ceiling strips and zones

Status: todo · Wave B · Depends: B2 · Size: M (~280 lines) · Builder: mid tier
Decisions: Q19 (window tags) · Q20 · Q09=A

## Goal
The user's words: *"Ajtó: can be marked to set Entrance, Portal, unused, or other types. Window:
make suggestions. Floor (padló and mennyezet): … simple vertical or horizontal stripes … important
zones on the padló and mennyezet can be indicated with simple custom rectangles and circles (corridors,
dwells, water areas, etc.)"* — the line / freehand / smoothed modes are WP-B4 and plug into the
plane tool built here.

## Read (only these)
- `00_CONTRACT.md §3.2` · `01_CATALOGUES.md §3` (door, window, plane lists)
- `src/04-render.js` lines 131–170 (door symbol: `variant` bit1 = hinge at far jamb, bit0 = opening side;
  `o.w` = width, `o.ang` = wall direction)
- `src/07-plane-editor.js`: `grep -n "function renderPlaneView" -A25` — find the SVG assembly and `PV.plane`/level fields
- `src/05n-marks.js` (yours from B2: picker, hit, drawing helpers)

## Build — `05n-marks.js`

### 1. Openings
In the wall tool (B2), a click whose hit is an **opening** (`hitTest(e)` → `{t:'openings',i}`) takes
priority over the wall under it in every mode: open `mrkPicker('door'|'window', existing, …)` by the
opening's `type` (stairs: no tags in v1 → HUD `'Lépcsőhöz nincs címke.'`). Record:
`{kind:'opening', op:<opening id>, pol, tags}` — one per opening per layer.
```js
mrkOpeningTags(opId)   // union of tags on that opening's marks
mrkDoorTier(opId)      // 'p0'…'p3' or null
mrkDoorRooms(o)        // [roomA, roomB] — allRooms entries on the two sides: door centre ± normal ×
                       // (host wall thick/2 + ROOM_PROBE); normal = [-sin(ang), cos(ang)]; null when outside
```
Drawing (plan, `STK_SCENE`): a ring around the opening centre in the polarity colour plus a short
label: door → `BEJ` (bejarat) · `P2` (tier) · `LÉP` · `NYITVA` · `✕` (nemhasznalt) · first tag otherwise;
window → `RED` (redony) · `ÉRZ` (nyitaserz) · first tag otherwise. 9 px text, haloed (stroke pass, then fill pass).

### 2. The plane tool — `STK_TOOLS` entry `{k:'mrkPlane'}`
State `MRK_P={on, plane:'floor'|'ceiling', mode, pol, tags}`. Modes come from an extensible list:
```js
const MRK_PLANE_MODES=[{k:'px',n:'Sáv (vízszintes)'},{k:'py',n:'Sáv (függőleges)'},
                       {k:'rect',n:'Téglalap zóna'},{k:'circle',n:'Kör zóna'}];  // WP-B4 pushes line45/free/smooth
```
- Action `mark.plane` (group `Jelölés`, label `Padló / mennyezet jelölése`, icon `▦`, key **`g`**
  [Q14=A], verify free). `g` cycles modes, `Shift+g` back, **`Tab`** toggles floor ↔ ceiling
  (HUD `Padló` / `Mennyezet`). Mode + plane in `#modeHint`.
- `px` / `py`: click inside a room → `{kind:'pstrip', plane, room:<id>, axis:'x'|'y', c:<snapped centre>, w:300}`.
  `axis:'x'` runs left-to-right (constant y), `'y'` top-to-bottom (constant x) — the user's "vertical
  and horizontal meaning left-to-right and up-to-down". **Shift+drag** across sets `w` (min 100).
- `rect`: drag corner to corner (50 mm snap) → `{kind:'zone', plane, shape:'rect', x0,y0,x1,y1}` (normalised).
- `circle`: press at the centre, drag the radius (50 mm snap, min 150) → `{…shape:'circle', cx,cy,r}`.
- After the geometry: `mrkPicker('plane', …)` with `MRK_TAGS.plane` filtered to `pl===plane||pl==='both'`
  (Shift = use the brush). `pushUndo(['marks'])`. Overlay preview while dragging.
```js
mrkPlaneAt(level,plane,x,y)   // marks of that plane covering the point → [{m,pol,tags}]
mrkRoomZones(roomId,plane?)   // pstrips + zones whose centre lies in the room
```

### 3. Drawing
Plan (`STK_SCENE`), floor marks at `dz(level,0)`, ceiling marks at `dz(level,LH[level])` but only when
`state.flat` or plan style — in iso, ceiling marks would float; draw them at floor z with a dashed
outline instead and say so in the report if that reads badly. A pstrip is clipped to its room with a
`<clipPath>` (`id="mrkc-<mark id>"`) — never `mask`. Fill-opacity .14, outline .5 px, label at the
shape's centre. Polarity colours as B2.
Plane View: one guarded line at the end of the plane SVG assembly in `07-plane-editor.js`:
`if(typeof stkHookSvg==='function')<svgVar>+=stkHookSvg(STK_PV);` — `STK_PV` fn draws marks whose
`plane` matches `PV`'s plane (floor ↔ floor; álmennyezet and ceiling ↔ ceiling).

### 4. Right-click (`STK_CTX`, extend `mrkHit`)
Openings: `Címkék…` · `Polaritás …` · `Törlés`. Plane marks: the same + for pstrip `Szélesség…`.

### 5. Validation
`mark.dangling` also covers `op` (opening gone) and pstrip `room` gone.
`STK_CHECKS.mark` gains: `warn` when the stack has doors but none tagged `bejarat`
(`'Nincs bejárat jelölve — a portálgráf horgonya hiányzik.'`).

## Tests — `tests/spec-37-marks-openings.js`
1. Tagging a door `portal`+`p2` stores one opening mark; tagging `p3` replaces `p2` (grp); `mrkDoorTier` → `p3`.
2. `mrkDoorRooms` of a door in the partition between two rooms returns both, in normal order.
3. A window tagged `redony` → `mrkOpeningTags` contains it.
4. `px` click at (2000,1500) in a 4000×3000 room → pstrip `axis:'x', c:1500, w:300, room:<id>`.
5. rect drag (500,500)→(1450,1210) stores x0:500,y0:500,x1:1450,y1:1200 (snapped).
6. circle centre (2000,1500), drag to (2000,2120) → r:600 (snapped 50).
7. `mrkPlaneAt(level,'floor',2000,1500)` returns the pstrip and the circle; `'ceiling'` returns none.
8. `Tab` switches plane; the picker for ceiling offers `almennyezet`, not `padlofutes`.
9. Scene: the pstrip uses `clipPath`, the document contains no `<mask`.

## Golden
Identical.

## Browser-only checks (for the human)
Door labels legible at normal zoom · zones visible in Plane View · Tab does not steal focus from inputs.

## Verifier focus
Opening priority over wall in the wall tool. `Tab` must only be eaten while the plane tool is on and
focus is not in an input. clipPath ids unique per mark.

## Out of scope
Line / freehand / smooth traces and door snapping (B4). The portal graph (B5).
