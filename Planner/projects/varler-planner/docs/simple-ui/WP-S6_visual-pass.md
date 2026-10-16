# WP-S6 — Visual pass (Zion-inspired) ⏸

**Goal (user):** "with a light greyish blue background, UI buttons design as in Matrix, where we see the Zion control
interface."

**Read:**
- design §6 (motion), §7 (tokens, item, dial), §8;
- `mock/sm-mock.html`: the reference. **Match it.** If you think it should change, say so at the ⏸; don't drift
  silently.

## Build (the CSS lives in `src/11t-sm-menu.js`, injected as `<style id="smMenuCss">`)

1. **Tokens:** design §7, verbatim, on `body.ui-simple`.
2. **Column** (`#smMenu`):
   - `position:absolute; left:20px; bottom:100px; width:248px`;
   - `display:flex; flex-direction:column; gap:6px`;
   - the breadcrumb line as in §2.
3. **Item** `.smI`: design §7 *Item*, including the bevel (two hairlines), `--sm-scan` and the backdrop blur.
   - The index in `--sm-num`, `--sm-ink-dim`, 11 px.
   - The icon 16 px, monochrome (design §7 filter).
   - The label 14 px caps, letter-spacing .08em.
   - A right-aligned chevron.
   - `.foc` gets the glow, the light glass and the accent bar (`::before`, 3 px).
   - `.dis` → the children at 45 % opacity (`.dis>*`), the glass unchanged; line 2 in 10.5 px, one line, ellipsis.
   - The Back item uses `--sm-glass-back`.
4. **Pressed:** `:active`, the inverted bevel, 80 ms.
5. **Motion:**
   - `.sm-out`: translateX(−8px), opacity 0, 90 ms, delay `calc(var(--d)*20ms)`;
   - `.sm-in`: from translateY(10px) and opacity 0, 140 ms, delay `calc((4 - var(--d))*25ms)`, so the bottom comes
     first;
   - Back mirrors it (`.sm-back` on the column flips the directions);
   - `@media (prefers-reduced-motion: reduce)` → `transition:none; animation:none`.
6. **Dial:**
   - the quadrant fill is the glass, and the ring stroke is `--sm-edge-lo`;
   - ticks at 50 % `--sm-ink-dim`;
   - `.on` depth arcs are `--sm-accent`;
   - `.tool` ring is `--sm-accent` with the glow;
   - the core glyph is `--sm-ink`, 20 px;
   - `.smWarn` is `--sm-warn`, 11 px, bold.
7. **Hint pill:** glass, a 1 px bevel, 12.5 px `--sm-font`, `--sm-ink`; fades 200 ms.
8. **Search line:** `⌕` and the query in `--sm-ink`; the count in `--sm-ink-dim`; a blinking caret
   (`step-end 1s`, off when reduced motion is on).

## Tests — `tests/spec-s6-sm-look.js` (jsdom, light: real looks are the ⏸)

1. `#smMenuCss` exists and contains all 13 token names from design §7.
2. In simple mode, a `.smI` computed `font-family` contains `Bahnschrift`.
3. `.smI.foc` gets a `::before` rule with `width:3px`. Check the CSS text.
4. A replace sets `.sm-in` on the new items, with `--d` = 0…4. After 200 ms (fake timers or a real wait) no `.sm-in`
   remains.
5. With `matchMedia` stubbed to reduced motion: no `.sm-in` / `.sm-out` classes on a replace.

## ⏸ Look checkpoint (stop here and show the user)

Browser pane, `planner-stack-dist` (:8138), 1600×900. Load the example house and turn simple mode on. Take these
screenshots:
1. idle dial;
2. the root open;
3. Villamosság › Kapcsolás with focus on item 2;
4. a paged level (Épület › Szabályok › Szabálykészlet › Fal, page 2);
5. search `kap`;
6. the routing-wall tool running, with the hint pill;
7. the same as (2) on the **Ügyfél-előnézet** dark style.

Send them with `SendUserFile` (render), side by side with `mock/sm-mock.html`. Ask:
- Q1 keep the bevel strength;
- Q2 the glass opacity;
- Q3 the font (Bahnschrift vs Segoe UI);
- Q4 monochrome icons, or the colour emoji.

Then wait.
