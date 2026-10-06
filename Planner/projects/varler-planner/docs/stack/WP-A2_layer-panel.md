# WP-A2 — Layer panel: vertical sub-layers, opacity, swap / move

Status: todo · Wave A · Depends: A1 · Size: M (~250 lines) · Builder: mid tier
Decisions: Q01=A · Q02=A · Q03=A · Q08=A

## Goal
The user's words: *"place the sub layer buttons vertically so that every sub layer has enough place
next to it … an RCO for each sub layer (or hold button and drag) so that they can be placed on
another Layer (the two layer's sublayers change place). Next to it two 10 percent up/down buttons,
one hide/visible button for each sub layer."*

## Read (only these)
- `src/12-boot.js` `function renderLayers` (whole function, ~15 lines) — you will MOVE it
- `src/shell.html`: `grep -n "layerList\|addLayer\|\.lcat\|\.lblock\|\.lrow\|\.lcats\|\.ltint" src/shell.html`
  and the CSS rules those hit
- `src/10-lamps.js` `function ctxMenu` (3 lines) and `function hideCtx`
- `src/05l-layers.js` (yours from A1)

## Build — all in `05l-layers.js` unless stated

### 1. Move `renderLayers` into `05l-layers.js`
Delete it from `12-boot.js` (function declarations are hoisted, every caller keeps working). Keep the
existing per-layer row exactly: active radio, 👁, name input, ✕, tint picker + ⊘ (from 05j). Add a
fold toggle `▸/▾` at the row start (`L.collapsed`; default: only the active layer is expanded [Q08=A]).

### 2. Sub-layer rows (vertical, replaces the `.lcats` button strip)
One row per `LAYER_CATS` entry, in order; `opt:true` entries only when `lyrCount(L.id,cat)>0` [Q02=A].
```
 [👁] Dugaljak ············ 12   [−] 60% [+]
```
- 👁 toggles `L.cats[cat]` (same as today's button), dimmed row when off.
- name — `LAYER_CATS[].n`; count — `lyrCount(layerId,cat)` = items of that layer whose
  `lyrCatOf(coll,rec)===cat`, over `UKEYS` collections + walls of all levels. Count 0 → row text dimmed.
- `[−]` / `[+]` — `lyrSetOp(L.id,cat,op∓0.1)`; the % shows `Math.round(op*100)`. Min 10 %, max 100 %
  (0 is what 👁 is for) [Q03=A]. Buttons disabled at the limits.
- The row is the drag handle and the right-click target (data attributes `data-sl="<layerId>:<cat>"`).
- CSS in `shell.html` next to the existing `.lcat` rules: `.lsub` grid
  `grid-template-columns:22px 1fr auto 22px 38px 22px`, row height 20 px, font 11.5 px. Reuse the
  panel's existing colours; no new colour literals.

### 3. Right-click on a sub-layer row (RCO)
`ctxMenu(e,[…])`, items:
| label | act |
|---|---|
| `Csere ezzel a réteggel ▸ <név>` — one item per other layer | `lyrSwapCat(fromId,toId,cat)` |
| `Áthelyezés ide ▸ <név>` — one item per other layer | `lyrMoveCat(fromId,toId,cat)` |
| `Csak ez látszik` | every other cat of this layer off, this one on |
| `Átlátszatlanság visszaállítása` | `lyrSetOp(L.id,cat,1)` |
Keep the list flat (the menu has no submenus): `Csere: Réteg 2`, `Csere: Réteg 3`, …, a separator
item `{label:'—',act:()=>{}}` (`ctxMenu` calls `act()` on every click — an item without one throws),
then `Áthelyezés: …`.

### 4. Hold and drag [Q01=A]
`pointerdown` on a sub-layer row → after **350 ms** without moving more than 6 px the row lifts
(class `.ldrag`, `setPointerCapture`). While dragging, the layer block under the pointer highlights.
Drop on another layer block → `lyrSwapCat` (the user's "the two layer's sublayers change place");
drop with **Ctrl** held → `lyrMoveCat`. Release on its own block or outside → nothing. A click
shorter than 350 ms is not a drag. `Esc` cancels the drag (and only that — see CONTRACT §7).

### 5. Operations
```js
lyrItemsOf(layerId,cat)  // [{coll, rec}] incl. walls ({coll:'walls', rec:<rect>}) — the shared iterator
lyrSwapCat(a,b,cat)      // lyrPushUndo(); items of (a,cat) → b and items of (b,cat) → a, in one pass
                         // (collect both lists first, then assign); also swaps L.cats[cat] and L.op[cat]
                         // so each set keeps its own visibility/opacity; renderLayers(); draw(); HUD:
                         // 'Csere: Dugaljak — Réteg 1 ↔ Réteg 2 (12 ↔ 3 elem)'
lyrMoveCat(a,b,cat)      // lyrPushUndo(); items of (a,cat) → b; L(b).cats[cat] := true; HUD 'Áthelyezve: …'
```
Walls changed by either op: rebuild `SNAP[l]=centerlines(WALLS[l])` for touched levels.
Refuse (HUD, no undo step) when `a===b` or the source set is empty.

### 6. Actions (group `Réteg`)
`layer.swapCat` and `layer.moveCat` — `run` opens a small modal (from-layer, category, to-layer
selects) for palette users. `when` = more than one layer exists.

## Tests — `tests/spec-33-layer-panel.js`
1. `renderLayers()` produces one `.lsub` row per non-opt cat for the active layer; an opt cat
   (`note`) appears only after a note is added to that layer.
2. Counts: 3 sockets + 1 switch on L0 → Dugaljak 3, Kapcsolók 1.
3. Clicking `[−]` on Dugaljak twice → `L.op.socket===0.8`, label `80%`; `[+]` at 100 % is disabled.
4. `lyrSwapCat('L0','L1','socket')`: L0's 3 sockets now on L1, L1's 2 sockets now on L0; switches
   untouched; `L0.op.socket`/`L1.op.socket` swapped; one undo step restores all (`doUndo`).
5. `lyrMoveCat` of walls moves the wall rects and `SNAP` is rebuilt (a wall hit-test still finds it).
6. Context menu on a row lists `Csere: <name>` and `Áthelyezés: <name>` for each other layer.
7. Hold-drag simulated (pointerdown, advance timers 400 ms, pointermove over L1 block, pointerup)
   → swap happened; the same with `ctrlKey` → move; a 100 ms press → nothing.

## Golden
Identical (the panel is not part of the scene). No update allowed.

## Browser-only checks (for the human)
Hold-drag feel on mouse and touch · the panel stays readable at 16 sub-layers · right-click menu
position near the panel edge.

## Verifier focus
Swap must collect both lists before assigning (else items ping-pong back). Pointer capture released
on every exit path. `renderLayers` removed from `12-boot.js` exactly once (check-globals).

## Out of scope
Duplicate / merge / link / lock (A3). Stack grouping in the panel (B1).
