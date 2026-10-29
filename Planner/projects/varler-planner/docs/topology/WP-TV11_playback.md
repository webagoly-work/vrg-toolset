# WP-TV11: ▶ Bekötés lejátszása (playback)

Status: todo · Wave C · Depends: TV9, TV10; G7 for the true order · Size: S (~130 lines) · Spec: next free · Decisions: Q-TV13 · Engine gaps: G7, G8

## Goal
*"The autowiring function should show in quick flashes how routing is set by the engine: a small animation that shows
each circuit's wiring one after the other, how each circuit reaches its spots, circuit by circuit, making a composite in
the end."*

## Read
- `fig/07`
- `08tb` (TV2 render), `08t` `tpoOverlay` (TV9)
- `02_ENGINE_GAPS.md` G7 (`R.log`) and G8
- `08ob` `blShow`, and `STK_OVERLAY` for the blueprint mirror

## Build (`src/08tb-tpo-view.js`)
1. **The sequence:**
   - **With G7** (`BL_LAST.R.log` exists): play the log in commit order. Home runs first, as `routeChannels` commits
     them (nearest first, then by id), then the room runs per circuit. With G8, each pass is a chapter and its rip-ups
     flash red, then fade.
   - **Without G7:** circuits in board order (DED → sockets → lighting, then by `ref`). Per circuit, its legs from
     `legsOf` in BFS order from the board. The header says `'sorrend: körönként (a motor naplója nélkül)'`.
2. **Per step:**
   - dim the rest to 25 %;
   - draw the step's GP edges with an animated `stroke-dashoffset`, ≈ 0,6 s per circuit at 1×;
   - the inspector shows `A1 · 4 pont · 7,2 m · 2 doboz`.
3. **The composite:** the Csövek tab render (TV10) fades in, with the totals.
4. **Controls:** `▶ ⏸ ⏭ ⏹`, speed `½× 1× 2× ⏩`.
   - ⏭ = the next circuit (or pass); ⏹ / Esc = the composite at once.
   - One `requestAnimationFrame` loop, cancelled on close.
5. **Reduced motion** (`prefers-reduced-motion: reduce`): ▶ goes straight to the composite; ⏭ steps.
6. **Mirror on the blueprint** (Q-TV13 A, the toggle `Alaprajzon is`): the same steps through `STK_OVERLAY` along the
   legs' `poly`, with the view minimised to a strip. It is removed at the end, and `draw()` is untouched.
7. Read-only: no data, no undo.

## Tests
1. The order without G7: DED → socket → light; ⏭ steps; ⏹ ends with every edge at full opacity.
2. With a stub `R.log` of 2 passes: chapters = 2, and the rip-up steps are drawn red.
3. Reduced motion: no rAF loop runs.
4. Closing mid-play stops further frames; `data` is deep-equal before and after.

**Browser:** 4 screenshots (3 circuits + the composite), or a short recording.
