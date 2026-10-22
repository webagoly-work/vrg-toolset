# WP-E2 — Mennyezeti út: ceiling reach lines to the lamps

Status: todo · Wave E · Depends: R2, E1 · Size: S (~100 lines) · Spec: next free · Decisions: —

## Goal
*"An additional option: a button changes the device tool into a special Wall Rules tool that lets me draw lines out of
the walls, from a Portal or anywhere on an allowed route, to indicate where on the Mennyezet the routes should reach the
lamps (with an Álmennyezet set in a room, the tool automatically places the route above the álmennyezet)."*

## Read
WP-R2 (`rwlAllowed`, `rwlCovers`) · `05n-marks.js` plane modes (`MRK_PLANE_MODES`, 487) · `07-plane-editor.js` (the
álmennyezet plane, how its height is known — grep `almenny`) · `tools/baseline/geom.js` (the 6 off-wall CLA lines =
ceiling reach) · `ceilLinks` in `tools/baseline/README.md` (the D07 ceiling hop).

## Build
1. Button `Mennyezeti út` in the E0 bar step 4.2 and on a selected lamp's inspector. Tool: press on a point that is a
   portal slot, a box, or a `vezetheto` wall (`rwlCovers`) → drag to a lamp (snaps to lamps ≤ 12 px) → release.
   45° lock + Shift free, like the pen. Middle clicks add bends.
2. Stored as a mark `{kind:'cline', tag:'mennyezet-ut', pts:[[x,y]…], lamp:id, from:{wall,u}|{door,face,k}}`.
   Height: the room's ceiling (`epCeilH`) or, in a room with álmennyezet, **above it** (`void` flag — E5 routes it in
   the void and needs no chase). Label `mennyezet` / `álmennyezet fölött`.
3. A lamp with a reach line is "reached"; E5 uses the line instead of its own shortest guess. A lamp without one gets the
   engine's default (straight from the nearest allowed wall point).
4. Draw: a dashed line in the `sys:LIGHT` colour, a small ⊥ at the wall end.

## Tests
1. A line from a `vezetheto` wall to lamp L3 → one `cline` mark with `lamp:'L3'`'s id and `from.wall`.
2. Start on an unmarked wall → refused, HUD `'Csak vezethető falról, portálból vagy dobozból indulhat.'`
3. Room with álmennyezet → `void:true`.
