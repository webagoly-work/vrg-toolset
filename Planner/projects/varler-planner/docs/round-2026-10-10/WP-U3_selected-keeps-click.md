# WP-U3 — The selected piece keeps the click; its centre is a handle

Status: todo · Wave U · Depends: U1, U2 · Size: S (~50 lines) · Spec: 60

## Goal
*"Trying to click on a selected feature's centre (little blue spot) usually makes me misclick if
another feature's centre is somewhere nearby."*

## Root cause (README F2)
- The gizmo centre dot (`12-boot.js` `gizmoSvg`, the `<circle … r="3.5" fill="#2f6fb0"/>` after
  "// centre dot", and the `r="4"` dot in `gizmoSvgAt`) has **no `class="giz"`** → the click falls
  through to `hitTest()`, which picks the nearest centre of *any* piece.
- `hitTest()` (09 line 10) lets objects / roofs claim a radius (`rad`) and then sets `hd` to their
  distance, shadowing nearer small pieces; nothing prefers the current selection.

## Build
1. **Centre = free-move handle.** In both gizmo functions replace the dot with
   ```js
   g+=`<g class="giz" data-ax="move" style="cursor:move">`
     +`<circle cx="${C[0]}" cy="${C[1]}" r="11" fill="#000" fill-opacity="0.001"/>`   // the target: 11 px
     +`<circle cx="${C[0]}" cy="${C[1]}" r="3.5" fill="#2f6fb0"/></g>`;
   ```
   (`fill-opacity` near zero, not `fill="none"` — `none` is not hit-testable in SVG.) The grab
   pointerdown `.giz` path builds `gizDrag` without `grab`; for `ax==='move'` set
   `grab: baseToPlan(...clientToBase(e), dz(pieceLevel(selected), pGetZ(selected)))` exactly as the
   piece-click path does (08 ≈ line 96), so the centre drags the piece by the offset under the cursor.
2. **Sticky selection in `hitTest`.** Before returning, if a piece is selected and visible
   (`hitOk`), and the click is within `14/state.zoom` base units of its drawn centre — or inside its
   footprint for walls / objects / floors / roofs — return the selected piece instead of `hit`.
   Implement as `hitPreferSel(hit, bx, by)` called at the end of `hitTest`.
3. **Fair distances for big pieces.** For objects and roofs, compute `d` as the distance to the
   footprint (0 inside it) and keep `hd` as the *centre* distance only when two candidates tie. Simplest
   correct form: collect candidates `{h, d, area}` and pick min `d`, ties → smaller area. Keep the
   existing priority order otherwise (devices beat walls, floors only when nothing else).
4. Alt+click **cycles** through the candidates under the cursor (the user's
   "something is in the way" escape) — HUD `'Átfedő elemek: 2 / 3 — Alt+kattintás: következő'`.
   Alt is the fine-mode key while dragging; a click without movement is unambiguous — verify fine
   mode does not latch (`fineOn` fires on keydown; `fineOff` on keyup — a click between them is fine).

## Tests — `tests/spec-60-sticky-select.js`
1. Two devices 10 mm apart in plan: select A; click 3 px off A towards B → still A.
2. Click on the gizmo centre element (`.giz[data-ax=move]` in the overlay) → `gizDrag.ax==='move'`
   and `gizDrag.grab` set.
3. A 2 m object and a socket 200 mm from its centre but inside its footprint: click on the socket →
   the socket (footprint distance tie → smaller area).
4. Alt+click on a stack of three candidates cycles 1 → 2 → 3 → 1.

## Verifier focus
The 11 px target must not swallow clicks meant for the arrow handles (they are drawn after? check
z-order: the centre group must be **before** the arrows in the SVG so arrows win where they overlap).
