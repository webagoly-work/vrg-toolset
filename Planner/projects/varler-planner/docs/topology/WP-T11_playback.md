# WP-T11: ▶ Bekötés lejátszása (playback)

Status: todo · Wave C · Depends: T10 · Size: S (~130 lines) · Spec: next free · Decisions: Q-T13

## Goal
*"The autowiring function should show in quick flashes how routing is set by the engine: a small animation that shows
each circuit's wiring one after the other, how each circuit reaches its spots, circuit by circuit, making a composite in
the end."*

## Read
- `fig/07`
- `08pb` (T2 render)
- T9 `tpoRoute`
- T10 runs

## Build (`src/08pb-tpo-view.js`)
1. **`tpoPlay(level)`.**
   - The order is circuits by board order: DED first, then sockets, then lighting, each by `ref`.
   - Per circuit:
     - dim everything else to 25 %;
     - draw its wire tree edge by edge from the board outward (BFS order over its links), with `stroke-dasharray =
       length` and an animated `stroke-dashoffset`, ≈ 0,6 s per circuit at 1×;
     - the inspector shows `A1 · 4 pont · 7,2 m · 2 doboz`.
   - Then the **composite**: the Csövek tab render (T10) fades in, and the share table totals are shown.
2. **Controls** in the toolbar strip: `▶ ⏸ ⏭ ⏹`, speed `½× 1× 2× ⏩`.
   - `⏭` jumps to the next circuit; `⏹` / Esc jumps to the composite. Esc never leaves a half state.
   - One `requestAnimationFrame` loop; no timers left behind on close.
3. **Reduced motion:** with `matchMedia('(prefers-reduced-motion: reduce)')`, ▶ goes straight to the composite and the
   circuit list becomes a step-through (⏭ only).
4. **Mirror on the blueprint (Q-T13 A, optional toggle `Alaprajzon is`):** the same sequence through `STK_OVERLAY` on
   the canvas, along the real paths (T1 `nodes`), with the view minimised to a strip. The overlay is removed at the
   end. `draw()` is untouched.
5. Playback is read-only: it never writes `data` or undo.

## Tests
1. The order: DED → socket → light; `⏭` steps through it; `⏹` ends on the composite with all edges at full opacity.
2. Reduced motion (stubbed `matchMedia`): ▶ renders the composite directly, and no rAF loop is running.
3. Closing the view mid-play cancels the loop (no further frames after close).
4. `data` is deep-equal before and after a full play.

**Browser:** a screen recording or 4 screenshots (one frame per circuit + the composite).
