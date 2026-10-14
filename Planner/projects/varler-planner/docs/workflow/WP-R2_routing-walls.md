# WP-R2 — Vezethető fal: the routing-walls tool (the key feature)

Status: todo · Wave R · Depends: F3 (walls) · Size: M (~170 lines) · Spec: next free · Decisions: Q-R03

## Goal
*"A new tool to set which walls are allowed for routing (click LMB to select a wall in a room, hold to drag on a wall
to select only parts of that wall) — this is the key feature of the new workflow: defining only horizontal movements
by hand; the Z height of everything else is set for every device type, configurable by whole project / room /
selected. This tool automatically selects whole walls with both sides, on the centre line of the wall."*

## Why this replaces the P33 sketch lines
On P33 the user drew 24 loose `gege` paths on the Csatorna layer; `tools/baseline/geom.js` matched them to walls with a
±500 mm tolerance (+ Jelölés `plus` walls/sides). This tool records the same intent **exactly** and on the wall itself.

## Read
`05n-marks.js` 15–120 (`MRK_POL`, `MRK_TAGS`, `MRK_KINDS`, `MRK_MODES`), 278 (`mrkAdd`), 325 (`mrkToolStart`), 373
(`mrkHit`) · `tools/baseline/geom.js` (how allowed walls are derived today) · MATERIAL §7.

## Build
1. New mark tag `vezetheto` (`n:'Vezethető fal (vízszintes pálya)'`, pol `plus`) and a new kind `wspan`
   (`{wall:id, u0, u1}` along the centreline, both faces) beside the existing `wall` kind. Q-R03 A: these are marks
   on the Jelölés layer (one store, the P33 engine already reads marks). B: a separate `data.routeWalls` collection.
2. Tool `🟩 Vezethető fal` (action `wf.routeWalls`, group `Véset`; also in the rules palette R3): **LMB click a wall** →
   `kind:'wall'` mark (whole wall, both faces); click a marked wall again → removes it. **LMB hold + drag along a wall**
   → `wspan` from the press point to the release point (snapped 50 mm, `MRK_DEF.snap`), both faces.
3. Draw: a 60 mm green band on the wall centreline (both faces), dashed where `wspan` ends. Unmarked walls are not
   drawn differently (no noise).
4. Query `rwlAllowed(level)` → `[{wall, u0, u1}]` merged intervals per wall — the one function E2/E5 read.
   `rwlCovers(wallId, u)` → bool.
5. Shift+drag across several walls (a rectangle) marks every wall inside it whole — the "select area" gesture.

## Tests
1. Click wall W3 → one `vezetheto` mark kind `wall`; click again → none.
2. Drag 1000 → 2600 on W3 → `wspan {u0:1000,u1:2600}`; a second span 2400 → 3200 → `rwlAllowed` merges to 1000–3200.
3. `rwlCovers('W3', 1500)` true, `(W3, 3500)` false.
4. P33 check (spec, read-only): converting the 24 sketch lines of `Calculator/P33-baseline/v1_2026-10-12/…vplan(3).json`
   via `geom.js`'s matcher into `wspan` marks and back gives the same allowed-wall set (exact count in the spec).
