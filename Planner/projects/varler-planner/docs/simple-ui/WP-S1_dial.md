# WP-S1 — The dial (quarter circle)

**Goal (user):** "show one interactive feature as a corner left symbol of a circle with only a quarter of it showing in
the corner. That will be the menu."

**Read:**
- design §1, §2 (the dial rows), §4 (the dial rows), §8;
- `mock/sm-mock.html`, the `#dial` SVG: copy its geometry, not its colours (S6 does colours).

## Build (in `src/11s-sm-mode.js`)

1. **`smRoot` children:** `<svg id="smDial" width="96" height="96">`, plus empty `<div id="smMenu">` and
   `<div id="smHint">` (S2 and S5 fill them).
   - Position the dial `position:absolute;left:0;bottom:0;pointer-events:none`.
   - The quarter shape gets `pointer-events:visiblePainted`, so a click outside the quadrant reaches the canvas.
2. **`smDialSvg(st)`** returns the SVG inner string. `st={open, depth, tool, warn}`.
   - The centre is the corner: `(0,96)` in SVG coordinates.
   - **Quadrant path:** `M0,96 L0,8 A88,88 0 0 1 88,96 Z`, class `smQ` (this is the hit shape).
   - **Rings:** arcs of r 88 (2 px), 64 (1 px), 40 (filled, class `smCore`).
   - **Ticks:** 10, at 4.5° + i·9°, 6 px inward from r 88.
   - **Depth arcs:** 4 arcs on r 76 with a 5 px stroke, each 20°, starting at 1.25° + i·22.5° (the mock's `dialSvg`). The first
     `st.depth` of them get class `on`.
   - **Core glyph:** `≡` idle, `×` open, `st.tool.icon` when a tool runs. A `<text>` at (9,88), 20 px (as in the mock).
   - **Warning numeral:** `st.warn>0` → `<text class="smWarn">` at 45°, r 100 (just outside the ring; the svg has `overflow:visible`).
3. **`smDialDraw()`** writes `smDialSvg(smDialState())` only when the string changed (cache the last one).
   - `smDialState()` returns `{open:SM.open, depth:SM.stack.length, tool:null, warn:0}` here.
   - S5 fills in `tool` and `warn`.
4. **Input:**
   - `click` / `pointerup` on `.smQ` → `smToggle()`. Here: `SM.open=!SM.open; smDialDraw()`. S2 replaces the body,
     keeping the name.
   - The svg gets `tabindex=0`, `role=button`, `aria-haspopup=menu`, `aria-expanded`.
   - Enter or Space on the focused dial → `smToggle()`.
   - `stopPropagation` on `pointerdown`, so the canvas never sees a dial press.
5. **Draw hook:** call `smDialDraw()` from `smSet` and `smToggle`. Do **not** hook `draw()`.

## Tests — `tests/spec-s1-sm-dial.js`

1. In simple mode, `#smDial` exists inside `#smRoot`, `.smQ` has `d` = `M0,96 L0,8 A88,88 0 0 1 88,96 Z`, and there
   are 10 ticks.
2. `smDialSvg({open:false,depth:0})` contains `≡`; with `open:true` it contains `×`; `depth:2` → exactly 2 `.on` arcs.
3. Dispatch `pointerup` on `.smQ` → `__SM.open===true`, `aria-expanded="true"`; again → false.
4. `smDialDraw()` twice with no change → the second call does not touch `innerHTML`. Spy by counting a
   MutationObserver's records: 0.
5. `warn:3` → a `.smWarn` text `3`.
6. A `pointerdown` on `.smQ` does not change `__getSel()`, and `state.mode` stays `select`.

## Out of scope

The column (S2) and the colours (S6).
