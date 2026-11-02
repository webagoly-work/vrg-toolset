# Varler logo — animated v1 and the divergence ring

The animated Varler logo and the original divergence ring (after the Rehoboam ring in
[lovelace-rehoboam](https://github.com/FHeilmann/lovelace-rehoboam)), drawn by one engine. Canvas 2D, no
dependencies, generative: the strata are computed live, on a seamless 40 s loop.

- **Logo v1** (approved 2026-11-02) = form `logo` with mark `F` ("Mix"):
  - the large leaf comes from refined option E;
  - the small leaf, the screw base and the lower bulb (neck, collar and stem) are the original trace;
  - the globe ring is pared from the inside down to a 9-unit line, with a round cap at its end.
- **The ring** = form `ring`. It is a full circle on the logo's globe circle (r 187.26), with a black eclipse disc and
  an 8-unit bright band. It has the same strata, events and glow as the logo.
- The design canvas with every option (0, A–F), the first ring and these two:
  <https://claude.ai/artifact/6jugeKG8uuf5PLFREtiqQ6> (page "Logo v1").
- Source art: `H:\VRG\Full\jobs\_tnt-tukor\Varler\Logo\varler_logoL100.png`, traced into `logo.json`.

## Files

| File | What |
|---|---|
| `divergence.js` | **The one file a page loads.** Built; do not edit by hand. |
| `engine.js` | The renderer (strata, bloom, eclipse, intro sweep, mark layer, the two forms). |
| `marks.js` | Mark options as draw ops (`fill`, `stroke`, `cut`, `cutstroke`); `F` is logo v1. |
| `logo.json` | The traced contours of the original logo (bulb, leaves, base, wordmark). |
| `build.js` | `node shared/varler-logo/build.js` → `divergence.js`. Run after any change to the three above. |
| `preview.html` | Both forms side by side, with a morph slider. `?theme=light` for ink on paper. |

## API

```js
const api = VarlerDivergence.mount(canvas, opts); // sizes itself to the canvas's CSS box, redraws on resize
api.set({ ... });   // change any option live
api.replay();       // run the intro sweep again
api.destroy();      // stop the loop and the observers
```

| Option | Default | |
|---|---|---|
| `form` | `'logo'` | `'logo'` (bulb outline + mark) or `'ring'` (the full divergence ring) |
| `morph` | `null` | 0..1 overrides `form`: 0 = ring, 1 = logo. Every value in between is a valid shape (see below) |
| `mark` | `'orig'` | `'F'` for logo v1; `'orig'`, `'E'`, `'A'`–`'D'` are the earlier options |
| `lockup` | `'full'` | `'full'` (with wordmark, `orig` only), `'mark'`, `'icon'` |
| `ring` | `true` | `false` draws only the mark (or the band in ring form), static |
| `theme` | `'dark'` | `'dark'` or `'light'` (ink on paper) |
| `amp`, `speed`, `glow` | 1 | strata height, loop speed, bloom strength |
| `intro` | `true` | the sweep that draws the ring on at mount |
| `still` | `null` | 0..1: freeze on that point of the loop (thumbnails, icons) |

Reduced motion (`prefers-reduced-motion`) shows one still frame.

## The two forms share the geometry

Sample `i` (499 of them) is the same point of the ring in both forms:
- **Angle:** the bulb's span of −158°…91° in `logo`, the full −180°…180° in `ring`.
- **Radius:** the bulb outline in `logo`, the circle in `ring`.
- **Envelope:** dying into the neck and the leaf in `logo`, all round in `ring`.
- **Events:** each one has a place on the bulb (`c`) and a place on the full ring (`rc`).

`morph` interpolates all of these. In between the two forms:
- the band bends into the bulb outline;
- the mark fades in;
- the view shifts from the circle's centre to the mark's centre.

The noise is made angle-periodic past 150° (`per()`), so the full ring has no seam at the bottom. The toggle between the
two states (a tween of `morph`) is GO LOGO's job: see `GO-LOGO.md`.
