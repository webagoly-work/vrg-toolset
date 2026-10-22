# WP-C3 — RF coverage model and the RF layer view

Status: todo · Wave C · Depends: C2 · Size: M (~240 lines) · Builder: mid tier
Decisions: Q23=B

## Goal
*"Show RF layer with every type of comms line toggle show/hide, visualize them as different volumes of
areas originating from the RBX towards the sides, leaving a thin and pale colour tinted zone with a
faint outline (if the signal is short range, or overlapping) showing its sphere of influence."*
Also feeds the RBX ghost's wireless toggle (C2) and the RF needs check (D2).
Model [Q23=B]: simplified **COST-231 multi-wall** — distance loss plus a loss per wall crossed, wall
loss from the Marking layer's material tags. Every number is typical, not measured, and editable.

## Read (only these)
- `01_CATALOGUES.md §9` (`RF_TECH`, `RF_GRID`, `RF_RBX_RADIOS`) and `§3` (`MRK_TAGS.wall[].rf`)
- `src/05n-marks.js` `mrkWallTags` · `src/05p-hardware.js` `hwServes` · `src/03-geometry.js` `wallInfo`

## Build — `05q-rf.js` (prefix `rf`)

### 1. Pure model
```js
rfWallLoss(r)                 // dB at 2.4 GHz: max rf of mrkWallTags(r.id) when any tag has rf,
                              // else by thickness: ≥250 → 12, 120–249 → 8, <120 → 4
rfSegWalls(level,ax,ay,bx,by) // walls whose rect the segment crosses (Liang–Barsky against each rect);
                              // a wall the source is mounted IN does not count (source inside the rect)
rfSources(level,tech)         // [{id,x,y,dev}] — RBX with tech in d.radios (src 'rbx'), ACP endpoints
                              // (src 'acp', D1 — type 'ep' code 'ACP'), BASE (src 'base'); only tech not off
rfMargin(src,x,y,T)           // budget − PL in dB: d=max(0.5,dist/1000);
                              // PL = 10·T.pe·log10(d) + T.f·Σ rfWallLoss; budget = 10·T.pe·log10(T.R0)
                              // (the PL1 constant cancels out — keep it out of the code)
rfGrid(level,tech)            // {cells:[{i,j,m}]} best margin over all sources per RF_GRID cell whose centre
                              // is inside any room of the level; m<0 cells omitted. Memoise on a basis
                              // string (sources' x,y,radios + wall ids/rects + tags) — recompute only on change
rfRoomCover(roomId,tech)      // share 0…1 of the room's cells with m ≥ 0
```

### 2. Settings — `state.rf`
`state.rf = {on:{<tech>:bool}, R0:{<tech>:m}}` defaulting from `RF_TECH` (`off:true` → not shown).
Action `rf.settings` (group `Rádió`, `Rádiós beállítások…`): per tech a show checkbox and an `R0 (m)`
number; a note line `Tipikus beltéri értékek — nem mért. A falcsillapítás a Jelölés réteg falcímkéiből jön.`

### 3. View
- Action `rf.view` (`Rádió-lefedettség mutatása`, key none) toggles `state.rfShow`; on by default when
  the stack stage `sys:RF` is active.
- `rfCoverageSvg(onlySources?)` → for each shown tech: each covered cell as a `RF_GRID` square at
  floor z, fill = tech colour, fill-opacity `0.05 + 0.10 × min(1, m/10)`; the **outline** = cell edges
  between a covered and an uncovered cell, 0.6 px, stroke-opacity .35, same colour. Overlap of techs
  blends naturally. Into `STK_OVERLAY` (a view, not drawing).
- A legend box (HTML in the HUD area or an SVG group at the viewport corner — follow how other
  overlays show legends; if none, a single line in `#modeHint`): tech colour chips with on/off clicks.

### 4. Inspector / room info
When a room is selected and `rfShow` is on, HUD: `WiFi 94 % · Thread 100 % · BLE 81 % · UWB 40 %`.

### 5. Checks — `STK_CHECKS['sys:RF']`
Per room and per RF need ticked in D2 (`rm.needs['sys:RF']`): `warn` when `rfRoomCover < 0.9`
(`'<szoba>: <tech> lefedettség 72 %'`). Until D2 exists: check `wifi` and `thread` for every room.

## Tests — `tests/spec-42-rf.js`
Fixture: two rooms side by side, 4000 wide each, partition 100 mm (untagged → 4 dB), one RBX in room A.
1. `rfWallLoss` of the partition = 4; tagged `tartofal` = 15; a 300 mm outer wall untagged = 12.
2. `rfSegWalls` from the RBX to a point in B counts the partition once, not the RBX's own wall.
3. `rfMargin` at 1 m in free space = `10·pe·log10(R0)` − 0 (to 0.01 dB); at `R0` with no walls ≈ 0.
4. Thread (R0 15): B fully covered with a 4 dB partition; with `tartofal` (15 dB) coverage drops
   (`rfRoomCover` decreases) — assert strictly smaller.
5. UWB `f:1.5` loses more through the same wall than BLE (margin difference = 0.5 × wall loss).
6. Memoisation: two `rfGrid` calls without changes return the same object; moving the RBX changes it.
7. Overlay with `rfShow` contains cells; with the tech unticked, none.

## Golden
Identical (view default off).

## Browser-only checks (for the human)
Performance on CLA's ground floor (should redraw in well under 100 ms after the first compute) ·
tints pale enough to keep the plan readable.

## Verifier focus
The budget formula (no `PL1` in code; at `d = R0` and no walls margin is 0). Cells only inside rooms.
Memo basis includes wall TAGS (retagging a wall must change the result).

## Out of scope
Channel planning per STD-005 (fixed channels are a note, not a computation). AP placement
suggestion — D3's `coverageGap` anchor uses `rfGrid`.
