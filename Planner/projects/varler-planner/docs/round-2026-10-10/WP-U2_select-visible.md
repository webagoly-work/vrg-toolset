# WP-U2 — The Select tool selects visibly

Status: todo · Wave U · Depends: U1 · Size: S (~70 lines) · Spec: 59 · Decision: Q-U02

## Goal
*"Select gomb should work as a Select button — currently it does nothing: the object selected should
glow with a discreet aura, while the right info panel should change to show its info (currently it
only changes when, after selecting an item invisibly, I change to the Move tool)."*

## Root cause (README F1)
`08-interaction.js` pointerdown, select branch (≈ lines 106–121): a hit sets `selected` and
`dragItem` and returns **without `draw()`**; the overlay (04-render ≈ line 978) draws a single-piece
highlight only in grab mode; the inspector refreshes only through `draw()` → `renderShell(true)`.
Also: any pointer movement after the click drags the piece and pushes undo (no threshold).

## Build
1. **Draw on select.** In the select branch, after `selected=h` (both the multi and the single path)
   and after `selected=null; clearMulti();` on an empty click: `draw();`. Check `renderInspector`
   receives the selection (05d) — it reads the global `selected`.
2. **Drag threshold.** `dragItem` gets `{…, x0:e.clientX, y0:e.clientY, live:false}`; the pointermove
   `if(dragItem){…}` branch (08 ≈ line 229) returns early until `Math.hypot(dx,dy) ≥ 4` px, then sets
   `live=true`, pushes undo once (the existing `pushed` flag) and continues as today. A click that
   never crosses 4 px moves nothing and records no undo step.
3. **The aura — `selAuraSvg(h)`** in `04-render.js` next to the selection overlay; called for the
   single selection in **select** mode (and in grab mode under the gizmo — the user should see the
   same glow in both). No SVG filter (exporters drop filters): two stroke passes, screen-constant.
   ```js
   // a discreet glow around the selected piece: a wide pale stroke under a thin bright one
   const SEL_AURA={c:'#2f8fff',wide:7,thin:1.6,op:0.22};
   ```
   - device / hw / endpoint: a circle of radius `devK()`-scaled symbol radius + 6 px at the device's
     drawn point (`planToBase(d.x,d.y,dz(d.level,d.h||0))`);
   - wall, opening, object, roof, floor: the footprint polygon (wall rect / `opnHost` footprint once G1
     exists / object box base / roof rect / floor poly) at its base z, `fill="none"`;
   - path section, note, measure: the polyline / point.
   Wide pass `stroke-opacity=op`, `stroke-width=vsP(wide)` (screen-constant per PRIMER §3 — use the
   `C/state.zoom` form if the wrapped value grows with the view scale; measure it), round joins; thin
   pass full opacity.
4. Multi-select keeps today's circles (they already show in select mode); add the aura to each piece
   only if it reads better — the user's call at the browser check, default **off** for multi (Q-U02).
5. `HINTS.select` (08 line 11) reads "Click cable/device to delete" — it does not delete; rewrite:
   `'Kijelölés — kattints egy elemre: kiemelve, a jobb oldali panel mutatja. Húzás: mozgatás · Ctrl: több elem · jobb klikk: menü.'`

## Tests — `tests/spec-59-select-visible.js`
1. Simulated pointerdown on a device in select mode → `selected` set **and** the overlay string
   contains the aura marker (`data-sel-aura` attribute on the group — add it for testability).
2. The inspector title (`#inspector .insHead b`) equals the device's title right after the click
   (no mode switch).
3. pointerdown + pointermove 2 px + pointerup → device position unchanged, `undo.length` unchanged;
   with 10 px → moved, exactly one undo step.
4. Empty click → `selected===null`, aura gone.
5. Golden identical (the overlay is outside the golden net — the scene must not change).

## Verifier focus
`draw()` vs `drawSoon()` inside pointerdown (use `draw()` — the user needs the feedback now); the
aura must not enter the **scene** string (it would invalidate `updateTotals` caching and goldens);
stack tools that run in select mode (hwServe, epCtl, cktPick) still work — they return before this
branch.

## Browser (owed)
Click a socket, a wall, a door, the BASE → glow + inspector in each case; screenshot for the user.
