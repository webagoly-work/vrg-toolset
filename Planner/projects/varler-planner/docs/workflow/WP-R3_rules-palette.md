# WP-R3 — Rules palette: the CLA colour-coded marks as one-click rules

Status: todo · Wave R · Depends: R2 · Size: S (~110 lines) · Spec: next free · Decisions: Q-R07

## Goal
*"Continue with the more granular wall setting rules based on the colour-coded rules you asked me to mark the walls on
CLA and features with — it was perfect and I want to integrate it. Options here have half-side wall selection by default
(same LMB rules). (Floor rules — make the place for it, under dev.)"*

## Read
`05n-marks.js` 15–120 (tags, polarity colours), 325 (`mrkToolStart` modes) · WP-R2 · MATERIAL §7 (the palette rows).

## Build
1. A **Szabályok** panel (rail panel, like the Jelölés tool's) with four sections:
   **Fal** — the MATERIAL §7 wall rows; **Nyílászáró** — Redőny, Portál (opens the O2 slot view); **Egyéb területek** —
   the non-electrical areas of MATERIAL §7b (user, R07: wet walls, pipes, gas, radiator, chimney, stack, furniture);
   **Padló** — one disabled row `'Padló szabályok — fejlesztés alatt'`.
2. Each button = `mrkToolStart` with a preset `{kind, tag, pol}`. Default selection is **one face** (`side`): LMB picks
   the face nearest the cursor; hold-drag along it = a `vstrip`/part of that face (same gesture as R2). `Vezethető fal`
   (R2) is the only whole-wall default. Zones (ágy, közlekedő, padlófűtés, sziget) draw rectangles (existing `zone`
   plane mode).
3. New tags (Q-R07 confirms each): `kerulendo`, `tilos`, `media`, `munkalap` (sides), `sziget` (zone). `munkalap` and
   `sziget` replace `cla.config.js`'s hand-written `worktop` / `island` lists (E5 reads the marks).
4. The panel shows a live legend with counts: `Vezethető fal 12 · L-forma 4 · Tilos 2 …`.

## Tests
1. Each palette button writes the mark MATERIAL §7 says (tag, kind, pol).
2. LMB on a wall 30 mm left of its centreline → the left face only.
3. Floor section: the row is present and disabled.
