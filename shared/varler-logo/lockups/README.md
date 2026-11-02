# Varler logo + text — lockups of the original mark

Seven lockups of the **original** Varler mark, each in two themes: ink on paper and on dark. The animated logo
(v1, mark F) gets its text later, from the same rules.

| id | Text | Ratio (width : height) |
|---|---|---|
| `caps` | VARLER | 1 : 3/2 |
| `lower` | varler | 1 : 3/2 |
| `group-caps` | VARLER GROUP | 1 : √2 |
| `group-lower` | varler group | 1 : 3/2 |
| `vrg` | VRG | 1 : φ |
| `vrg-sub-lower` | VRG over varler group | 1 : φ |
| `vrg-sub-caps` | VRG over VARLER GROUP | 1 : φ |

The files are in `svg/` as `varler-logo-<id>-light.svg` and `-dark.svg`. Each has its ground colour and a clear space of
the globe width / φ⁴ on every side. Design canvas: <https://claude.ai/artifact/6jugeKG8uuf5PLFREtiqQ6>, page
"Logo + text"; its Guides switch draws the ratio box.

## The rules (`gen.js`)

- **Width.**
  - Every line is exactly as wide as the mark's widest line, the globe (374.9 units). It is centred under the mark.
  - Tracking is solved so the ink fills that width.
- **Overlap.**
  - The text sits on top of the mark. Its main line covers the lowest 10 units of the E27 base's cap; the main line is
    the cap height for capitals and the x-height for lowercase.
  - The cap is 38 units tall, so most of it stays visible. Ascenders such as the `l` reach a little higher.
  - The gap between the mark and the text is gone.
- **Proportion.**
  - The lockup's outer box, from the top of the globe to the lowest ink, snaps to a classic ratio: φ, 3:2 or √2.
  - Each variant takes the first ratio it reaches with sensible tracking: up to 0.45 em for capitals, up to 0.17 em for
    lowercase.
  - One line of a given width has only one natural height, so a single ratio cannot fit all seven.
- **varler group** reaches none of the ratios at that overlap. Its descender makes the line too tall for √2 and too
  short for 3:2. It is set at zero tracking on 3:2, where its x-height meets the cap and the ascenders cover the cap.
- **The VRG stacks.**
  - The subline is the monogram's size / φ² (Poppins SemiBold).
  - The gap between the lines is the subline's cap height / φ.
  - Both lines are justified to the globe width, which spaces VRG out (about 1.1 em tracking).
- **Glow.**
  - The letters carry a halo in the ground colour: a crisp knockout edge (radius 4 % of the type size, 3–6 units) plus a
    blurred soft layer.
  - Where the text crosses the base, the base fades into the letters instead of being cut by a hard line.
  - On its own ground the halo is invisible. Placing a file on a different ground shows it, so pick the file that
    matches.
- **Type.**
  - Poppins Bold for the main lines and SemiBold for the sublines.
  - The original wordmark is Poppins Bold with about 0.025 em extra tracking: its ascender height matches to 2 units and
    it overlaps the trace at IoU 0.80, the best of 21 candidates.
  - The fonts are in `fonts/`, under the SIL OFL (`fonts/OFL.txt`).

## Rebuild

```
cd shared/varler-logo/lockups
npm install          # opentype.js 1.3.4, only for the build
npm run build        # gen.js -> lockups.json, svgs.js -> svg/
```

`render.js` is the one SVG writer; the canvas boards are made from the same function.
