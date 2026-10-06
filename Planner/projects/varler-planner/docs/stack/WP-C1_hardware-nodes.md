# WP-C1 — Hardware nodes: RBX, Elosztószekrény, mérőóra, adatbelépés, SSC

Status: todo · Wave C · Depends: B2 · Size: M (~260 lines) · Builder: mid tier
Decisions: Q21 (auto-serve is C2) · Q24 (BASE is C4)

## Goal
*"Hardware: selecting positions of Elosztószekrény, data cable entry point, Mérőóra, we can place RBX
boxes on marked and defined wall sections."* Hardware nodes are **devices** with new `type` values,
so they inherit placement, Wall View, room membership, links to routes and the id/undo plumbing.

## Read (only these)
- `01_CATALOGUES.md §10` (`HW_TYPES`, `HW_RB`, `HW_RB_DEF`)
- `src/02-state.js` `const DEV=` (1 line) · `src/03-geometry.js` `function snapWall` (l.~47)
- `src/09-menus.js` lines 85–104 (board placement + `ensureBoardObject`) — the pattern for a wall box
- `src/10-lamps.js` lines 20–36 (generated lamp objects: `genId`/`genFor`) — the pattern you follow
- `src/04-render.js`: `grep -n "cktRingSvg" src/04-render.js` → the device symbol assembly (~l.500–515)
- `src/06-wall-editor.js`: `grep -n "type==='board'" src/06-wall-editor.js` — how a board is drawn in elevation
- `src/05n-marks.js` `mrkAt`

## Build — `05p-hardware.js` (prefix `hw`)

### 1. Types
Paste `HW_TYPES`, `HW_RB`, `HW_RB_DEF`. At module load: `Object.assign(DEV,HW_TYPES)` (DEV is an
earlier const — safe). `lyrDevCat` already maps them to `device`.
Device records:
```js
{type:'rbx',  level,x,y,h:2150,side,layer, rb:'RB-M', serves:null, radios:hwDefRadios(), ref:'RBX<nn>'}
// hwDefRadios(): (typeof RF_RBX_RADIOS!=='undefined')?RF_RBX_RADIOS.slice():['thread','ble','espnow']  — C3 may not exist yet
{type:'board',…existing}            // placed with the existing board flow, layer = stack hw layer
{type:'meter',level,x,y,h:1500,side,layer, ref:'MÉRŐ'}
{type:'entry',level,x,y,h:300, side,layer, ref:'ISP'}
{type:'ssc',  level,x,y,h:1800,side,layer, ref:'SSC'}
```
`h` = box **centre** height. RBX 2150: STD-001-A1 puts the box bottom ≥ 1.90 m and the top at
2.3–2.5 m; RB-M (500 high) centred at 2150 spans 1900–2400. `ref` for RBX = `'RBX'` + the room number
of the room its face looks into (STD-004: boxes keyed to their room) — `hwRbxRef(d)`: room `num`
digits, 2-digit padded, else running number.

### 2. Placement tool — `STK_TOOLS` `{k:'hwPlace'}`
Actions (group `Hardver`, all `when` = a stack is active):
`hw.rbx` `RBX elhelyezése` ▣ · `hw.board` `Elosztószekrény elhelyezése` ▤ · `hw.meter` `Mérőóra` ◔ ·
`hw.entry` `Adatbelépési pont` ⇲ · `hw.ssc` `Biztonsági központ (SSC)` ⛨.
- Ghost follows `snapWall(e,level,h)` (wall face, angle). Overlay ghost = the box's plan footprint
  (w × d from `HW_RB[rb]`, board 600×150) on the face.
- **Strip preference**: if the pointer is within 400 mm (along the wall) of a `vstrip` tagged `rbx`
  (for RBX), `elo` (board), `ssc` (SSC) on that face, the ghost snaps to the strip centre and turns
  green; over a `ban` mark (`mrkAt` at the box centre height) it turns red and HUD warns
  `'Tilos zóna: <tag>'` — placement is still allowed (the user decides), the device gets `warn` in validation.
- Click → `pushUndo(['devices','objects'])`, push the device with `layer = stkLayer(S,'hw').id`,
  `hwSyncObj(d)`, `ensureIds`, `draw()`. The tool stays on for the next box; `Esc` ends it.
- RB class: `Tab` cycles `HW_RB` keys while placing an RBX (HUD shows class + size).

### 3. Generated 3D box — `hwSyncObj(d)`
Mirror the lamp pattern: one `data.objects` record per hardware device,
`{genFor:'hw', genId:d.id, level, x,y, z:d.h−H/2, w,d:depth, ht:H, ang, onWall:true, name:HW_TYPES[d.type], color, layer:d.layer}`.
Re-run on move (hook the same place lamps re-sync — `grep -n "genFor" src/*.js` to find where generated
objects follow their device; add `hw` next to `lamp`). Deleting the device deletes its object.
Colours: rbx `#c9d6e3` · meter `#d8d2c4` · entry `#cfe3d4` · ssc `#e3cfcf`.

### 4. Symbols
- Plan: one guarded line in the device symbol code (next to `cktRingSvg`):
  `if(typeof hwSymbol==='function'&&HW_TYPES[d.type])sym=hwSymbol(d,x,y,k,back);`
  `hwSymbol` → a rectangle footprint + 3-letter label (`RBX`, `MÉR`, `ISP`, `SSC`) + `rb` under RBX.
- Wall View: mirror the board's elevation branch for `HW_TYPES` with the real `w × h`.

### 5. Right-click on a hardware device (`STK_CTX`)
`RB osztály ▸ RB-M / RB-L / RB-H / RB-E / RB-O / RB-S` (flat items) · `Magasság…` · `Jelölés…` (ref).
(C2 adds the room items.)

### 6. Checks — `STK_CHECKS.hw`
`error` no board · `warn` no meter · `warn` no entry · `info` no RBX yet · `warn` a hardware device on a
`ban` mark (`mrkAt`) · `warn` an RBX whose room is wet (`env` of its room in wet/nedves).

## Tests — `tests/spec-40-hardware.js`
1. `DEV.rbx==='RoomBox (RBX)'`; `lyrDevCat({type:'rbx'})==='device'`.
2. Simulated placement on a wall face creates an rbx at h 2150 on the hw layer with one generated
   object `ht:500, z:1900` (RB-M); moving the device moves the object; deleting removes it.
3. A vstrip tagged `rbx` 300 mm away → the new RBX's along-wall position equals the strip centre.
4. `hwRbxRef` for a box facing room num `1.03` → `RBX03`.
5. Placing over a `tartofal` wall mark → device exists, `validate()` has a warn for it.
6. Checks: empty stack → board error; after placing a board the error is gone.

## Golden
Identical.

## Browser-only checks (for the human)
Ghost follows wall faces smoothly; RBX visible as a box in 3D; strip snap feels right.

## Verifier focus
Generated object sync on move/undo (no orphans, no duplicates — compare with how lamps do it).
`snapWall` side sign matches `deviceHostWall` so room membership is right.

## Out of scope
Room serving and coverage (C2), radios (C3), BASE (C4), routes (C5).
