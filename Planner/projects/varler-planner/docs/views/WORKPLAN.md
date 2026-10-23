# Workplan — Views

*The ordered work list for `PRIMER-VIEWS.md`. One line of intent per package. Each package becomes
a full WP spec (the build-pack format: goal, files and anchors, functions, HU strings, tests with
exact values, verifier focus, out of scope) **when its phase starts**, not before, so the specs are
written against the code as it is then. ⏸ = look checkpoint: show a rendered sample and wait.*

Order follows the user's priority (2026-10-11): **the simplified axonometric + exploded house first**,
then the camera and cutaway help for everyday drawing, then the flat professional outputs, then the
show pieces.

| # | package | family | depends on | size | ⏸ |
|---|---|---|---|---|---|
| V0 | **Prototype:** CLA axo, grid painter, Sims cutaway (`tools/cla-axo.js`) | C1 | — | done | ✅ shown 2026-10-11 |
| V1 | **View core** in the Planner: `06c-view-core.js` — view definition, grid painter, tagged primitives, style-sheet application | all | V0 | L | ✅ built 2026-10-12 |
| V2 | **Camera presets + 90° rotation lock** in the existing 3D view | B1 B2 | — (independent) | S | ✅ built 2026-10-12 |
| V3 | **Kivágás wall mode** (cutaway follows the camera) in the existing 3D view | B3 | V2 | M | ✅ built 2026-10-12 · ⏸ feel |
| V4 | **"Tiszta axo" style + export** (SVG / PNG / print) from the Planner | C1 | V1 V3 | M | ✅ built 2026-10-14 (slices 1–3) · look approved; D-V4-3 fixes built 2026-10-14 |
| V5 | **Room-by-room explode** (static, then animated) | C2 | V4 | M | ◐ slice 1 (static) built 2026-10-14 · animation answered (D-V5-2), not built · ⏸ motion |
| V6 | **Stack plates** exploded upward with leaders | C3 | V5 | M | ✅ built 2026-10-14 · look approved after D-V6-5 A (todo) |
| V7 | **Object library extension** (`OBJECTS-CATALOGUE.md` → `OBJLIB`) | A2 | — (independent) | S | ✅ built 2026-10-12 |
| V8 | **Object line-art** set: front / left / right / top SVG per object | A2 | V7 | L (rolling) | ◐ V8a built 2026-10-14 (machinery + first 5) · first 5 approved (D-V8-2 A A A) · V8b–h next in order |
| V9 | **Floor-plan output** with adjustable cut height, poché, weights, title block, paper scale | A1 | V1 | L | ◐ V9a–c built 2026-10-14 · ⏸ sheet look (D-V9-6) · V9d optional |
| V10 | **Interior elevation sheet** from the wall view, with object line-art and dimensions | A2 | V8 V9 | M | ⏸ look |
| V11 | **Time-of-day palettes** + offline sunrise/sunset, live mode | B5 | V4 | M | ⏸ palettes |
| V12 | **Local relight** on switch toggle | B6 | V11 | M | ⏸ motion |
| V13 | **Soft-shaded iso** (Qecad register): face tones, tubes for routes | B4 | V4 | M | ⏸ look |
| V14 | **Detail / millwork register**, light + inverted glow | A3 | V9 | L | ⏸ look |
| V15 | **Layer info panel** (click a plate → slide apart + info) | C4 | V6 | M | ⏸ UX |
| V16 | **Five-level client style sheet** over C1–C4; brochure figures | C5 | V6 V13 | L | ⏸ look |

V2 and V7 are independent quick wins and can be done in any session that has a spare hour.

---

## V1 · View core

**Built 2026-10-12.** `src/06c-view-core.js`: `viewRender(def)` → `{prims, body, svg, bounds, roles, stats}`; the grid
painter for all four quadrants (far cells first per axis; the visible face is on the camera side of each axis;
edge-on axes draw no faces), rotated objects as painter-sorted sprites, endpoints after the cell in front of their
face, room / hardware / entrance labels through a greedy collision-avoiding placer (`viewPlaceLabels`: nothing on
top of a marker or another label), `VIEW_STYLES.tiszta` as data, `viewRoomTone` by Hungarian room name.
`viewWallClass` / `viewWallTops` are the one classifier (V3 uses them). `tools/cla-axo.js` now boots the build in
jsdom and calls the core (V0's standalone copy kept as `tools/cla-axo-v0.js`); `--yaw=` renders any quadrant.
Proof: yaw 225 reproduces V0 exactly (far W6 W7 W9, near W8 W10 W11), yaw 45 swaps them; spec-69.


**Goal.** Move the V0 pipeline into the Planner as a pure function:
`viewRender(viewDef, model) → {svg, prims}`. The tagged primitive list is the API that every later
style uses.
- `viewDef = {kind:'axo'|'plan'|'elev', yaw, pitch, cut, nearCut, scope:{levels, rooms, layers}, style, time}`
- Grid painter from `tools/cla-axo.js`, generalised to the four yaw quadrants. Rotated objects,
  stairs and roofs become sprites (PRIMER §4.2).
- Primitive tags: `wall.top.cut`, `wall.top.full`, `wall.face.lit`, `wall.face.shade`, `plinth.*`,
  `floor.<roomNum>`, `obj.*`, `opening.*`, `ep.<role>.<type>`, `label.*`.
- Style sheets as data (`VIEW_STYLES`), the first one = V0's look.

**Read first.** `tools/cla-axo.js`; `00-core.js` `camK`/`depthOf`; `04-render.js` `drawPreview*`
(the `preview` style shows how a style is plumbed today); `05h-rooms.js` `deviceHostWall`.

**Tests.** CLA v2 fixture → the far-wall set for each quadrant is exact (225°: `W6 W7 W9`). Primitive
counts are stable. The default `draw()` is byte-identical (goldens 70/70).

## V2 · Camera presets + rotation lock

**Built 2026-10-12.** `CAM_PRESETS` + `camPresetApply` / `camLockSet` / `camLockYaw` in `00-core.js` (next to
`camK`); every yaw write (`setRot`, `setRotSilent`) and pitch write (`setPitch`, `camSetPitch`) goes through
the lock. Panel row *Vetület* + *90°-onként* (View group), actions `view.cam.<k>` / `view.cam.lock`,
`tests/spec-68-camera-objlib.js`. Finding: `state.pitch` is not a true view angle — camK blends a true iso at
30 (hidden +45° yaw) into the plan at 90 — so presets are Planner pitches chosen for a whole-degree
`extra`: iso 30, dim 20, axo 46, mil 70, elev 15. The preset jump is instant (no animation yet).


A preset menu in the view panel (*Nézet → Vetület*: Izometrikus / Dimetrikus / Axonometria / Katonai /
Homlokzati / Szabad). Choosing one animates `rot`/`pitch` to the preset. *Forgatás 90°-onként*
toggle: yaw drag snaps to the quadrants, pitch drag is locked, and the existing rotate keys step
±90°. Stored in `state` (`camPreset`, `camLock`) and saved with the project.
**Tests.** Preset values exact. With the lock on, `setRot(100)` → 135. The lock survives save/load.

## V3 · Kivágás wall mode

**Built 2026-10-12.** Wall mode *kivágás (Sims)* (`state.wallMode='cutaway'`) in `drawNormalGeom`: walls opaque,
tops from `cutTops(level)` = `viewWallClass` against the live camera (camera side per plan axis from `depthOf`),
heights `state.cutH` (1500) / `state.cutNearH` (1000) with a panel row *Kivágás belső … külső … mm* shown only in this
mode; openings clipped to the lowered host (`cutOpening`, gone when the sill is above the cut); one classification
per camera quadrant (`CUT_MEMO`, keyed on the camera sides, heights and a wall/room coordinate checksum). Action
`view.cutaway` toggles and restores the previous mode. Shots: `fig/cla-3d-solid-102.png`, `fig/cla-3d-cutaway-102.png`,
`fig/cla-3d-cutaway-282.png` (building layer only). Still open: **⏸ feel** — the user draws on CLA with it.
Not done: device symbols above the cut on a lowered wall still draw at their height (V4 can fade them).


A fourth `wallMode`: `cutaway`. Per wall: classify near / far / interior against the current yaw
(PRIMER §4.3) and draw at `nearCut` / full / `cut`. Reclassify when the yaw crosses a quadrant (cache
per quadrant). Device symbols on lowered walls above the cut get the "seen past the cut" treatment.
**⏸ feel:** the user draws on CLA in iso with it on.

## V4 · "Tiszta axo" style + export

**Slice 1 built 2026-10-14** (uncommitted): `viewSheetSvg(R, {title, sub, H})` in `06c-view-core.js` — the sheet frame
(title, legend of the roles present, symbol + wall rows) moved from `tools/cla-axo.js` into the Planner; the tool now
calls it (output byte-identical, minus the old "nézeti mag (V1)" note); `VIEW_ROLE_HU`, `VIEW_LEVEL_HU`, `VIEW_SHEET`;
`tests/spec-73-view-sheet.js` (19). Suite 67/2559 green, golden 70/70.
**Slices 2–3 built 2026-10-14** (uncommitted), per DECISIONS D-V4-1 A / D-V4-2: Render menu *Tiszta axo (3D)* (`state.style='tiszta'`,
`tisztaOn` / `tisztaRender` / `drawTisztaGeom` in `04-render.js`): the scene is the core's body through the live `planToBase`
camera (frame = base / vsK, group `scale(vsK)`), always the cutaway, active level only, no routes / notes / measures / stack
scene layer (the path/cable/device draft block is kept), overlay untouched; memo on camera + model fingerprint (7 ms per
redraw in Chrome vs 67 ms per render); 2D → normal. `src/06d-view-export.js`: the Exportálás menu, `vexpSheet(k, title)`,
`viewSheetSvg` gained `opts.scale`. Specs 74 (19) + 75 (21). Look sample: `tools/v4-look.js` →
`fig/v4-look-cla-clanv4.png` (CLA | CLANV4 × Felülnézet | Axonometria). **⏸ look** open: CLANV4 has no stack roles, so its legend
header stands empty; top-down follows the current yaw (CLANV4's sample came out turned).
*Was stopped on* `DECISIONS.md` D-V4-1 (how the style behaves in the 3D view: live camera, overlay, editing) and D-V4-2
(export camera, title source, where the actions go). Remaining slices: (2) the style in the 3D view per D-V4-1;
(3) the three export actions per D-V4-2; (4) ⏸ look — CLA and CLANV4 side by side.

The V0 look as a selectable style in the 3D view and as an export (*Exportálás → Axonometria
SVG/PNG/Nyomtatás*), using the existing `svgToPng` / `printSVG`. Includes: title block, legend from
the roles actually present, room tags, hardware tags, and the entrance marker (from the `bejarat`
mark tag, not a hard-coded id).
**⏸ look:** CLA and CLANV4 side by side.

## V5 · Room-by-room explode

### WP V5 · slice 1 — static exploded view (spec, 2026-10-14; decisions D-V5-1)

**Goal.** `viewRender({explode:{step}})` draws the level with every room lifted by (rank + 1) × step, rank 0 = the
entrance room, then the others by plan distance (centroid to centroid) from it. Shared walls are split at their
centreline, so each lifted room is a closed box. Same tagged primitives, same style; explode off = byte-identical.

**Why the grid painter stays exact.** Each plan cell gets ONE owner room (the split makes that true for wall cells
too), and a lift only shifts that cell's z-intervals. Two cells with disjoint plan footprints are separated by a
vertical plane, and the camera-side one is in front whatever their heights, so the far → near cell order still holds.
(PRIMER §4.4's per-room `<g>` order is NOT exact for L-shaped rooms; slice 2 has to keep the per-cell order.)

**Anchors.** `06c-view-core.js` `viewRender` (grid lines, cell columns, devices, sprites, labels, bounds);
`06d-view-export.js` `vexpSheet` / `vexpCur`; `shell.html` `#expMenu`.

**Functions.**
- `viewExplodeOrder(M)` → `[{room, rank, lift}]`: entrance room = the room beside `M.entry` (60 mm probes on both
  faces of its host wall); no entrance → the largest room is rank 0. Ties keep `M.rooms` order.
- `viewExplodeStep(level, k)`: `'900'` → 900, `'600'` → 600, `'wall'` → `wallH(level)`.
- In `viewRender`, when `def.explode`: the centrelines of walls that bound a room on both sides join the grid; the
  cell owner = its room, else (a wall cell) the room found walking away from the wall centreline on the cell's side,
  else the other side, else none (lift 0). Intervals, sprites, endpoints (their face cell), room labels, hardware
  tags and the entrance marker shift by the owner's lift; `stats.lifts` = `{roomNum: lift}`; bounds cover the top lift.
  Every primitive carries `room` (owner num) for slice 2.
- `vexpSheet(k, title, {rot, explode})`; the menu gets *Szétszedve* + *Emelés lépcsője*.

**HU strings.** *Szétszedve* (checkbox) · *Emelés lépcsője* 900 mm · 600 mm · falmagasság · subtitle suffix
` · szétszedve, lépcső N mm`.

**Tests (spec-76, CLA v2 ground).** rank 0 = R01 Előszoba with lift 900; ranks are a permutation of the ground rooms;
lifts are (rank + 1) × 900; step 600 → R01 at 600; 'wall' → 2850; explode off → the svg equals the plain render
byte for byte; every wall cell has exactly one owner; a shared wall gives two half-thickness faces (the grid gains its
centreline coordinates); devices keep their plan x and are shifted by their room's lift only (screen dy = lift × the
camera's z factor, exact); labels follow; bounds top = max lift + H above the plain bounds; deterministic; data
untouched; the export menu passes the step. Exact counts (rooms, cells) recorded in the spec at build.

**Out of scope.** The animation (slice 2); exploding inside the live 3D view (D-V5-2); multi-level; stack plates (V6).

**Built 2026-10-14** (uncommitted) as specified: `viewExplodeOrder`, `viewWallRooms`, `viewRoomKey`, `VIEW_EXPLODE_STEPS`,
`viewExplodeStep`; cell owners = room, else a walk off the wall centreline, else a flood from owned neighbours (corners,
stubs); `stats.lifts / order / step`; prims carry `grp`. CLA ground: order R01 R04 R03L R03 R05 R08 R06 R07, grid
78×78 → 83×81, 0 unowned cells. Export menu *Szétszedve* + *Emelés lépcsője*; `tools/cla-axo.js --explode=` →
`fig/cla-explode-900.png`. spec-76 (25, incl. the D-V4-3 fixes: empty legend heading hidden, Felülnézet *Forgatás*).
Slice 2 (Szétszedés) stopped on DECISIONS D-V5-2 (where it plays, how frames are drawn).

Render per-room groups (PRIMER §4.4). Static exploded first (rooms lifted by order × step). Then
*Szétszedés* animation: entrance first, 250 ms per room, eased. Decision to take: shared walls
**split at the centreline** (recommended) or go with the later room.

## V6 · Stack plates

Above the house, one plate per stack role present, in stack order. Each plate shows only its
primitives (marks, hardware, BASE, channels, endpoints per system), with dashed leaders from plate
items down to their positions. Bottom-to-top painter order. The ghost rule from the design system v3
applies: out-of-scope levels are ghosted and empty layers are left out.

### WP V6 · stack plates (spec, 2026-10-14; decisions D-V6-1…4)

**Goal.** `viewRender({plates:{step, leaders}})` draws the plain house of the level, then one thin pale plate per
stack role with content, bottom to top in `STK_ROLES` order, each carrying only that role's items at their true
plan position, with dashed vertical leaders down to the house. Other levels with geometry show as a faint outline.

**Painter.** Every plate lies above the wall tops, so a horizontal plane separates it from the house and from the
plates below: house → ghost outlines → plates bottom to top is exact. Within a plate: camera-facing slab sides,
the top, its leaders, its items. A leader crosses the lower plates on top of them (diagram convention).

**Anchors.** `06c-view-core.js` `viewRender` (after the house, before the bounds), `viewBodySvg`; `05m-stack.js`
`STK_ROLES` / `STK_COL`; `05n-marks.js` `mrkGeom`; `06d-view-export.js`; `shell.html` `#expMenu`.

**Functions.**
- `viewPlateRoles(M)` → `[{role, n, items}]`: roles in `STK_ROLES` order with content on the level, minus
  `construct` and `arm` (D-V6-1 A). Items: devices (the core's 128, by layer role; on-wall ones at their face point),
  channel paths (role `channel`: the polyline and its two ends), marks (opening marks → the opening; wall marks →
  the middle of their first face).
- `viewFootprint(walls, rooms)` → outline loops of the solid plan (walls ∪ rooms) on a grid, collinear runs merged.
- Plate k (0-based) top at `H + (k + 1) × step` (D-V6-2 A; step from the V5 menu, 900 default), slab 60 mm.
- Leaders (D-V6-3): `'key'` (default) = hardware, BASE and channel ends; `'all'` = every item.
- Ghosts (D-V6-4 A): every other level with walls → its footprint as a faint outline at its height relative to this
  level (`wz(l,0) − wz(level,0)`: the real heights, not the 3D view’s display gap); empty levels skipped; no plates for them.
- `stats.plates = [{role, n, z}]`, `stats.leaders`, `stats.ghosts`; primitives carry `grp = role`.
- `plates` set → `explode` is ignored (the house below is the plain one).

**HU strings.** Plate label = the `STK_ROLES` name + count (`Világítás · 38`) · menu *Rétegek* (checkbox) ·
*minden elemhez vezetővonal* (checkbox) · subtitle suffix ` · rétegek N, lépcső S mm`.

**Tests (spec-77, CLA v2 ground).** 16 plates in order mark hw base channel DED SOC LIGHT LV BUSB CONTROL DATA SENSOR
HMI MEDIA USB SECURITY with counts 15 3 1 5 5 18 38 7 11 5 5 16 5 10 1 3; plate k at 2850 + 900 (k + 1) (first 3750,
last 17250); no construct / arm plate; key leaders 14 (3 + 1 + 2 × 5), all leaders 153 (15 + 128 + 10); an item's
screen x = its house x, dy = Δz × the camera's z factor; upper ghosted once at 2850; the house part of the primitive
list equals the plain render's; bounds top = the last plate; step 600 → the first plate at 3450; explode is ignored;
deterministic; data untouched; the export menu passes plates + leaders; plates off = plain render byte for byte.

**Out of scope.** The click-a-plate info panel (V15); animation of the plates; per-plate styling beyond the role
colour; multi-level plates.

**Built 2026-10-14** (uncommitted) as specified, plates and leaders in one go: `viewPlateRoles`, `viewFootprint`,
`viewPlates` in `06c-view-core.js`; new primitive kinds `gline` `lead` `pline` `dot`, `label.plate`; style `plateOp 0.34`
(0.8 hid the lower plates: at pitch 50 a 900 mm step is ≈ 61 px against a ≈ 700 px plate, so plates overlap ≈ 90 %);
the frame takes the plate labels in. Export *Rétegek* + *minden elemhez vezetővonal*; `tools/cla-axo.js --plates=` →
`fig/cla-plates-900.png`. spec-77 (25). Chrome: 107 ms per plates render. ⏸ look questions: DECISIONS D-V6-5.

## V7 · Object library extension

**Built 2026-10-12.** `OBJLIB` is now generated from the catalogue by `tools/objlib-gen.js`
(`--check` is part of spec-68): 106 items in 12 room groups, every old name kept, plus `room`, `art`, `sym`.
Edit the catalogue, run the tool, rebuild.


Paste the catalogue's `OBJLIB` block into `02-state.js`. Keep the existing names unchanged (saved
projects reference `name`). Add `cat` groups and the `art` key that V8 fills.
**⏸ list:** the user strikes or adds items in `OBJECTS-CATALOGUE.md` first.

## V8 · Object line-art

Per object, four views drawn by us: **front, left, right, top**. Rules:
- SVG symbol, units = mm, origin at the bottom-centre-front, `viewBox` = the true size.
- Classes: `oa-out` 0.35 mm outline, `oa-det` 0.18 mm detail, `oa-hid` 0.13 mm dashed, `oa-fill`
  white. No shading: the clean, colourless elevation look.
- Built **parametrically** where the family allows (cabinet doors, drawer splits, sofa cushions from
  w/d/h), so a resized object stays correct. Hand-drawn detail only where it adds character.
- Stored in a new `src/05zb-objart.js` (`OBJART[name] = {front, left, right, top}`).
- References: `REFERENCES.md` §B, for proportion and detail only.

**⏸ first 5:** kanapé, ágy, WC, konyhapult + felső, hűtő. Then rolling batches of ~10.

Split (2026-10-14): **V8a** machinery + the first 5 ⏸ · **V8b–h** room-group batches (Konyha, Fürdő, Nappali,
Háló + Gyerek, Dolgozó + Étkező + Előszoba, Gépészet, Kültér + Építészeti).

### V8a · work-package spec (written 2026-10-14, before the build)

**Goal.** The OBJART store and its drawing machinery in the Planner, plus a contact-sheet tool, and the first five
objects drawn with it, every view in each item's `art[]`, correct at the catalogue size and when resized.

**Files and anchors.**
- new `src/05zb-objart.js` (after `05z-icons.js`, before `06-wall-editor.js`; reads `OBJLIB` from `02-state.js`, no DOM).
- `build.js` + `tools/check-globals.js`: `MODULE_RE` accepts one **or two** letters after the number
  (`/^\d\d[a-z]{0,2}-.*\.js$/`), so `05zb-` is a module and not refused by the guard. Nothing else changes in the order.
- new `tools/objart-sheet.js` → `docs/views/fig/objart-<batch>.svg` (+ `.png` with `--png`, the headless Chrome of
  `cla-axo.js`); boots the built Planner in jsdom; labels through `tools/baseline/labels.js`.
- new `tests/spec-78-objart.js`.

**Conventions.**
- Units mm. Each view is drawn in its own 2-D frame, *up* = +b, rendered with SVG y = −b:
  - **F** (front): a = across (−w/2 … w/2), b = height (0 … h) → `viewBox="-w/2 -h w h"`.
  - **L** (seen from the object's left): a = depth from the front (0 … d) drawn to the **left** (x = −a), b = height →
    `viewBox="-d -h d h"`; the front is the right edge.
  - **R**: the same with x = +a → `viewBox="0 -h d h"`; the front is the left edge. For `sym` objects R = L mirrored
    (the same side drawing through x = +a), so a family draws one side.
  - **T** (top): a = across, b = depth from the front (0 … d) → `viewBox="-w/2 -d w d"`; the front is the bottom edge
    (third-angle: T sits above F and their front edges meet).
  - The origin is the bottom-centre-front in F, the bottom-front in L/R, the front-centre in T. The *front* is the
    front-most point including handles (so nothing pokes out of the box).
- Classes only, no colours in the art: `oa-out` (outline, 0.35 paper mm), `oa-det` (detail, 0.18), `oa-hid` (hidden,
  0.13, dashed 1.2 / 0.8 paper mm), `oa-fill` (white fill, added to closed shapes that hide what is behind them).
  Hidden lines are made by painting back to front with `oa-fill`; `oa-hid` only where a hidden part is worth showing.
- Line widths are paper mm: `objArtCss(k)` returns the stylesheet for a drawing at 1 : k (stroke = paper mm × k model mm).
- No SVG transforms: every coordinate is computed from w/d/h, so line weights never distort when resized.
- **Resizing rule.** Parametric families recompute their parts from w/d/h (counts below); every family keeps its
  small details at a fixed mm size (legs, handles, plinth, worktop, drawer height, gaps, seat and lid thickness).
  A family with nothing to count (WC) stretches its shape with w/d/h and keeps the fixed details → DECISIONS D-V8-1.

**Functions** (all global, prefixes `OA_` / `oa` / `objArt`).
- `OA_W = {out:.35, det:.18, hid:.13}`, `OA_DASH = [1.2, .8]` (paper mm).
- `objArtCss(k = 20)` → CSS text for `.oa-out/.oa-det/.oa-hid/.oa-fill`.
- `oaPen(map)` → pen in the view's (a, b) frame: `rect(a0,b0,a1,b1,cls,{rx,rt,rb,part})` (rt / rb = top / bottom corner
  radius), `line`, `poly(pts,cls,{close})`, `path(segs,cls)` (M L Q C Z only), `circ(a,b,r,cls)`; `cls` = `out|det|hid`
  with an optional `+fill`; each call may tag a `part`, counted in `parts`; keeps `prims` (mapped points) and `body`.
- `OA_FAM[fam] = {F, S, T, resize}` drawing functions `(P, s)` (S = the side, used for L and R); `OBJART[name] =
  {fam, front, left, right, top}` (the WORKPLAN shape; each view a `(s) → result` function).
- `objArtItem(name)` → the `OBJLIB` item or null. `objArt(name, view, size?, opt?)` → `{name, view, size, vb, body,
  svg, parts, prims}` or null (unknown name / view); `size` defaults to the catalogue size; `opt.k` = paper scale
  (adds `width`/`height` in mm and the stylesheet), `opt.css === false` leaves the stylesheet out.

**The first five** (names as in OBJLIB; *fixed* = mm that do not scale).
- `Kanapé 3ü` → `kanape`: arms 180 (≤ w/6), legs 120, seat top 430, back frame top h − 80, back depth 220 (≤ 0.3 d);
  **cushions n = max(1, round((w − 2·arm)/650))**, seat and back cushion per n.
- `Ágy 200×160` → `agy`: front = the foot end; legs 100, rail top min(300, 0.55 h), mattress top min(rail + 220, h − 30),
  head panel 60 deep, h high; **pillows n = w ≥ 1200 ? 2 : 1**.
- `WC csésze` → `wc`: close-coupled; bowl, seat 15, lid 30, cistern (back 0.25 d, from 0.48 h), cistern lid 25,
  flush button r 30, trap hidden in the side view; stretches (D-V8-1).
- `Konyhapult 60`, `Konyhapult 120`, `Konyhapult` → `pult`: worktop 40 with 30 front overhang, plinth 100 set back,
  door 18, top drawer 140, gaps 2, bar handles 160; **units n = ceil(w / 600)**, one drawer + one door per unit,
  a hidden shelf in the side view; swing marks (`oa-hid`) point to the hinge (left half of the units hinge left).
- `Felsőszekrény` → `felso`: wall cabinet, origin = its own bottom; door 18 behind a 20 handle zone, bar handle 60
  above the bottom; **doors n = ceil(w / 600)**, **shelves = max(0, round(h / 350) − 1)** (hidden, side view).
- `Hűtő 60` → `huto`: handle zone 30, door 60, kick strip 60 with vent slots, compressor hidden in the side view;
  **doors = h ≥ 1500 ? 2 (freezer below, split at 0.38 h) : 1**; hinge left.

**Tests (spec-78, exact values).**
1. OBJART has exactly the 8 names above; each is in OBJLIB; every view in its `art[]` renders, plus R.
2. viewBox: Kanapé 3ü F `-1100 -850 2200 850`, L `-900 -850 900 850`, R `0 -850 900 850`, T `-1100 -900 2200 900`;
   resized 2800×950×850 F `-1400 -850 2800 850`, T `-1400 -950 2800 950`; Hűtő 60 F `-300 -1850 600 1850`.
3. Every drawn point of every view of the 8 names, at catalogue size and at the resized size, lies inside its viewBox
   (± 0.01).
4. Classes: every element carries `oa-out`, `oa-det` or `oa-hid` (+ optional `oa-fill`) and nothing else; no `fill=` /
   `stroke=` attributes; every view has an `oa-out`; `oa-hid` appears in Kanapé L, Konyhapult L and T, Felső F and L,
   Hűtő F and L, WC L.
5. Parametric counts: Kanapé F seat 3 → 4 at w 2800 (back the same, T the same); Ágy T pillow 2 → 1 at w 900;
   Konyhapult F door/drawer 1 @ 600, 2 @ 1100, 2 @ 1200, 3 @ 1800; Felső F door 1 @ 600 → 2 @ 1000, L shelf 1 @ h 700 →
   2 @ h 900; Hűtő F door 2 @ h 1850 → 1 @ h 850.
6. WC (stretch): T bowl half-width 180 at w 400 → 225 at w 500; the flush button r 30 at both.
7. R = L mirrored: same parts and prim count, every R x = −(L x), same y.
8. `objArt('nincs','F')` and `objArt('Kanapé 3ü','X')` → null; default size = the OBJLIB size; `opt.k 25` → width
   `88mm` height `34mm` (Kanapé F); `objArtCss(25)` has `.oa-out{stroke-width:8.75`; deterministic; OBJLIB untouched.

**Contact sheet.** `node tools/objart-sheet.js --batch=first5 --png`: per object a row, two blocks (catalogue size,
resized), each third-angle (T above F, L left of F, R right of F when listed), at 1 : 25, 3 px per paper mm; captions
through `labels.js`, no overlaps. Resized sizes: Kanapé 2800×950×850 · Ágy 900×2000×550 · WC 500×650×800 ·
Konyhapult 120 → 1800×600×900 · Felső 1000×350×900 · Hűtő 600×600×850.

**Out of scope.** Using the art anywhere in the Planner (V10 does: elevation sheet), the other 98 items (V8b–h),
editing / picking art in the UI, colours / styles beyond the four classes, asymmetric families (sarok, L-sofa).

**Built 2026-10-14** (uncommitted) as specified: `src/05zb-objart.js` (6 families, 8 names), `tools/objart-sheet.js`
→ `fig/objart-first5.svg/png` (1843 × 1238, 48 labels, no overlaps), spec-78 (35); suite 72 / 2684 green, golden 70/70.
`MODULE_RE` widened to two letters in build.js + check-globals.js (05zb was refused by the one-letter rule).
Resizing rule = D-V8-1 A (built default). ⏸ look: DECISIONS D-V8-2. Next: V9a (after the ⏸), then V8b/c.

## V9 · Floor-plan output

A cut-plane plan at an adjustable height (*Vágási magasság* slider, presets 300 / 1100 / 1200 / 1500).
Poché in cut walls, weights per PRIMER §4.5, dashed above-cut items, door swings, room tags with
area, dimension strings, a north arrow, a title block, and paper sizes A3/A4 at 1:50 / 1:100. The
`whiteout` and `blueprint` styles become style sheets of the same view.

Split (2026-10-14): **V9a** the cut-plane plan core + *Alaprajz* in the 2D Stílus menu (D-V9-1 A): *Vágási magasság*
slider + presets 300 / 1100 / 1200 / 1500, poché in cut walls, PRIMER §4.5 weights, openings cut / beyond / above-cut
dashed, door swings (the existing `variant` hinge / side bits), objects in plan (OBJART top view where drawn, else the
footprint), endpoints by the cut rule ⏸ look · **V9b** room tags with area, chained dimension strings, north arrow ·
**V9c** title block, A3 / A4 at 1:50 / 1:100, export next to the V4 ones ⏸ · **V9d** whiteout / blueprint as style
sheets (optional, D-V9-2 A).
D-V9-3 and D-V9-4 answered A (2026-10-14).

### V9a · work-package spec (written 2026-10-14, before the build)

**Goal.** *Alaprajz*: a professional cut-plane plan of the active level as a 2D style, at an adjustable cut height,
with poché, the PRIMER §4.5 weights, openings and objects classified against the cut, door swings, the V8 line-art for
objects that have it (front by D-V9-3 A), and endpoints by D-V9-4 A. Default view unchanged; goldens identical.

**Files and anchors.**
- new `src/06e-view-plan.js` (prefix `ap` / `AP_`): reads `WALLS`, `ROOMSB`, `data.floors/openings/objects`, the
  blueprint helpers `bpWallSpans` `bpSeg` `bpRect` `bpDoorSymbol` `bpSW` `bpScaleN` `bpFine` `rectsUnionSegs`, and
  `objArt` (05zb). Same pens as the blueprint (paper mm at `state.bpScale`), so 1:50 / 1:100 already applies.
- `04-render.js` `draw()`: `alaprajzOn() ? drawAlaprajzGeom()` before the whiteout branch; the device loop wraps an endpoint
  above the cut in `<g class="ap-above" opacity="0.5">` when `alaprajzOn()`.
- `shell.html`: Render option *Alaprajz (2D)*; row `apCutRow` (only with that style): *Vágási magasság* range
  100–2700 step 50 + number + preset buttons 300 · 1100 · 1200 · 1500.
- `11-controls.js`: the style handler switches to 2D like Blueprint does; `apCutSet(v)`.
- `10-lamps.js` object context menu: *Eleje: …* (cycles auto → ↑ → → → ↓ → ← → auto; sets / deletes `O.front`).
- `02-state.js`: `state.planCutH: 1200`.

**Rules.**
- `alaprajzOn()` = `state.style==='alaprajz' && state.pitch >= 88` (in 3D the normal drawing, like Tiszta in 2D).
- Cut c = `state.planCutH` (clamped 100…2700). A wall (z0, top = z0 + (h || wallH)) is **cut** if z0 < c < top,
  **beyond** if top ≤ c (outline 0.25, no fill), **above** if z0 ≥ c (dashed 0.13).
- An opening in a cut wall (sill, top) is **cut** if sill < c < top → a gap in the poché with its symbol (window: two
  face lines 0.25 + glass 0.18; door: `bpDoorSymbol` with the plan pen); otherwise **hidden** (the wall is solid at c)
  → its outline dashed in white over the poché.
- Poché: cut pieces filled `#262626`, then ONE contour (0.5) around the union of all cut pieces of the level.
- Rooms and floors: white, no stroke. Stairs: not in V9a (V9b).
- Objects (blueprint filter): z0 ≥ c → **above**, footprint dashed 0.13; else the V8 top view if `OBJART[name]` exists
  (**art**), else the footprint 0.18 with white fill (**outline**). Art pens: oa-out 0.18, oa-det 0.13, oa-hid 0.13
  dashed (furniture under beyond, PRIMER §4.5); art sits in a `<g transform="matrix(…)">` (rotation + plan scale only).
- Front (D-V9-3 A), `apFront(o)` → a unit vector in plan mm: `o.front` (0 → −y, 90 → +x, 180 → +y, 270 → −x) if set;
  else the nearest wall of the level whose face is ≤ 600 mm from the object's footprint box and whose span overlaps it
  → the front points away from that wall; else local −d (`ang` 0 → −y). Across = w and depth = d when the front is
  along the object's d axis, else swapped.
- Endpoints (D-V9-4 A): `h ≤ c` full; `h > c` 50 % ink, outline only (`.ap-above :not(text){fill-opacity:0}`).
- `AP_LAST` = the stats of the last render: `{cut, walls:{cut,beyond,above}, open:{cut,hidden}, obj:{art,outline,above},
  fronts:[{name,f}], dev:{full,faint}}`.

**Tests (spec-79, CLA v2 ground, 2D).**
1. Default style untouched: Normal draws no `ap-` markup; switching to Alaprajz from 3D lands at pitch 90; in 3D with
   the style set, `alaprajzOn()` is false and the normal geometry is drawn.
2. Cut 1200: walls cut 19 / beyond 0 / above 0; openings cut 11 (7 doors + 4 windows) / hidden 0; objects art 6
   (Kanapé 3ü, Ágy 200×160, WC csésze × 2, Konyhapult, Hűtő 60), above 1 (Elosztószekrény 1600–2400), outline 24;
   endpoints full 42 / faint 123.
3. Cut 300: openings cut 7 / hidden 4 (the windows, sill 900); endpoints 22 / 143. Cut 2200: openings cut 4 / hidden 7
   (the doors, top 2100); endpoints 81 / 84. Cut 1500: endpoints 63 / 102.
4. One contour: the poché is one `<path>`/polylines set with stroke-width = bpSW(0.5) and fill #262626 pieces = cut pieces.
5. Front: `o.front` 90 → (1, 0); a free object with `ang` 0 → (0, −1); an object 100 mm from a horizontal wall below it
   (larger y) → (0, −1), from one above it → (0, 1); a vertical wall to its left → (1, 0); 700 mm away → the free rule.
6. Art transform: a Kanapé's art matrix maps its art origin (front centre) to the plan point c + f·d/2 (± 0.5 base units).
7. The *Eleje* menu cycles undefined → 0 → 90 → 180 → 270 → undefined; saved in the object; undo restores it.
8. Presets set 300 / 1100 / 1200 / 1500 and redraw; the number input clamps to 100…2700.
9. Normal / whiteout / blueprint / tiszta output byte-identical with and without a `front` field on every object; golden 70/70.

**Out of scope.** Room tags with area, dimension strings, north arrow, stairs (V9b); title block, paper frame, export (V9c);
whiteout / blueprint as style sheets (V9d); art for the other 98 objects (V8b–h).

**Built 2026-10-14** (uncommitted) as specified, plus three things the CLA sample showed:
- **One host per opening:** `bpWallSpans` also caught door B103 in partition W18 (its edge runs 57 mm past where the
  partition starts), which cut a sliver; Alaprajz keeps an opening only in its `opnHost` wall. The blueprint plan
  still has the sliver (golden-covered, left alone).
- **Clean output:** with everything on top (routes, portals, stack layers, cluster labels) the plan drowned, so like
  Tiszta the clean Alaprajz keeps only the geometry, the draft and the **active level's** endpoints; a tick
  *útvonalak, rétegek is* (`state.apAll`) brings the rest back.
- **No text yet:** the endpoint codes (NTL, SEN …), the board caption and the old painted room labels overlapped each
  other; Alaprajz drops them until V9b places room tags and codes with a collision-avoiding placer.
Samples `tools/cla-plan.js --cut=1200|300 --png` → `fig/cla-plan-1200.png`, `fig/cla-plan-300.png`. spec-79 (39);
suite 73 / 2723 green, golden 70/70. ⏸ look: DECISIONS D-V9-5 — answered 1 B, 2 A, 3 C and built (poché `#9a9a9a`;
endpoints above the cut not drawn, counted in the HUD); spec-79 (40), suite 73 / 2724, golden 70/70. Next: V9b.

### V9b · work-package spec (written 2026-10-14, before the build)

**Goal.** The annotation of the Alaprajz: room tags with area, the endpoint codes back, outer dimension chains, a
north arrow and stairs, with **every text placed by one collision-avoiding placer** (the legible-sheets rule: no text
on another text or on an endpoint symbol; a displaced text gets a leader). No ⏸ (V9c is the next look).

**Files and anchors.** `src/06e-view-plan.js` (all new code); `04-render.js`: the blueprint stairs block becomes
`bpStairsSvg(o, z, pen, cut)` used by both (blueprint output byte-identical: goldens); `draw()`: when the clean
Alaprajz is on, the annotation is appended after the endpoints (`apAnnotSvg()`); `shell.html` apCutRow: ticks
*méretláncok* (`state.apDims`, default on) and *végpont-kódok* (`state.apCodes`, default on).

**Rules.**
- Sizes in paper mm at `state.bpScale` (bpFS / bpU): room tag title 3.5 bold, area 2.5; codes 1.8 bold in the endpoint's
  role colour; dimension text 2.5; north letter 3.5. Every text: a white halo pass, then the fill pass.
- **Room tag** (rooms and floors of the active level with a name, `noText` skipped): line 1 `NUM  NAME` upper case,
  line 2 `12,34 m²` (area of the polygon, 2 decimals, comma); a third line with `rm.mat` only when it is set. Anchored
  at the polygon centroid, candidates in rings inside the room; leader when moved more than one line height.
- **Codes**: for each endpoint drawn (at or below the cut, active level) the first text the Normal view prints under its
  symbol (`apDevCode(d)`: the symbol rendered in Normal, its first `<text>`); none → no code. Anchored at the symbol,
  preferred below, then right, left, above; leader when displaced.
- **Blocks** for the placer: every drawn endpoint symbol (a square of 2 × its radius), the north arrow, each dimension
  chain line. Order: room tags, then codes, then dimension texts.
- **Dimension chains** (`state.apDims`): chain 1 at 900 mm outside the level box on the −y and −x sides with the
  **façade of that side** (walls within 400 mm of the box edge: their edges; the openings hosted in them; the box edges)
  — every wall face of the level read as a barcode on CLA (changed during the build), the overall chain at 1900 mm; ticks at 45°; a segment's text
  in metres with a comma (2 decimals), anchored at its middle on the outer side; segments < 60 mm get no text.
- **North arrow:** the blueprint convention (north = plan −y), 1800 mm long, at the level box's +x / −y corner + 2200 mm.
- **Stairs** (type `stairs` on the level): the blueprint outline, treads and walking line; with a cut: treads whose
  top (i × riser) is below the cut are solid, the rest dashed (0.13), and a break line across the stair at the cut tread.
- `AP_LAST.labels = {rooms, codes, dims, leaders, overlaps}` where overlaps = pairs of placed text boxes that intersect
  plus texts on endpoint blocks (must be 0).

**Tests (spec-80, CLA v2 ground, cut 1200, 1:50).**
1. Room tags 8 (R01 R03 R04 R05 R03L R06 R07 R08) with the areas of their polygons (e.g. R06 `18,27 m²` = polyArea).
2. Codes = the endpoints drawn that have one; each code equals the Normal view's first text for that device.
3. overlaps 0 at cuts 300 / 1200 / 1500 and at 1:50 and 1:100.
4. Dimension chains: 4 chain lines when apDims, 0 when off; the overall chains read the level box size in metres.
5. North arrow present once, its letter É.
6. Stairs (a test stair, riser 180, 16 treads, cut 1200): 6 solid tread lines + 9 dashed + 1 break line; cut 2700 (max):
   15 solid, 0 dashed, 1 break.
7. Ticks: apDims / apCodes off remove dims / codes; room tags stay. Blueprint stairs byte-identical (goldens 70/70).

**Out of scope.** Title block, paper frame, export (V9c); per-wall interior dimension chains; editable tag positions.

**Built 2026-10-14** (uncommitted) as specified, plus: chain 1 dimensions the **façade** of its side (every wall face read
as a barcode on CLA); one placer `apPlacer` in base units (room tags → codes → dimension texts, blocks = endpoint symbols
via `apSvgBox`, chain lines, the north arrow); `bpStairsSvg` shared with the blueprint (goldens identical). CLA cut 1200:
8 room tags, 24 codes of 42 endpoints, 26 dimension texts, 4 chains, 59 texts, 3 leaders, **0 overlaps** (also at 1:100 and
cuts 300 / 1500). Sample `fig/cla-plan-1200.png`. spec-80 (18), spec-79 adjusted (no text outside the annotation group);
suite 74 / 2742 green, golden 70/70. Next: V9c (title block, paper, export) ⏸.

### V9c · work-package spec (written 2026-10-14, before the build)

**Goal.** The Alaprajz as a printable sheet: ISO paper A3 / A4 at a **true** 1:50 / 1:100, frame, title block (the V4 title
source: the Exportálás *Cím* field, blank = the level only), a scale bar, and SVG / PNG / Nyomtatás from the same
Exportálás menu as the V4 axo. If the plan does not fit, the menu says so in Hungarian and nothing is exported.

**Anchors.** `06c-view-core.js` `viewSheetSvg(R, opts)`: **extended** with `opts.paper` (the same title lines t1 / t2,
then the paper layout instead of the px axo frame; the axo output stays byte-identical). `06d-view-export.js`: a tick
*Alaprajz-lap* (`expPlan`; `VEXP_VIEWS` stays as spec-75 pins it), `vexpPlanSheet(paper, N, title, opts)`, `vexpPlanFit`; the
existing `vexpSvg / vexpPng / vexpPrint` branch on the tick. `06-wall-editor.js` `printSVG(svg, title, page)`: an optional `@page` size.
`shell.html`: rows *Papír* A3 / A4 · *Lépték* 1:50 / 1:100 (`expPaperRow`) and the fit line `expFit`, shown when the tick is on;
the Forgatás choice applies to it; Nézet / Szétszedve / Rétegek are greyed out for it.

**Rules.**
- Paper (mm): A3 420 × 297, A4 297 × 210. Frame: 20 left, 10 elsewhere (ISO 5457). Title block 180 × 30 in the
  bottom-right corner of the frame; the drawing area = the frame interior above a 30 mm bottom band.
- Scale: the plan is the Alaprajz scene (the live renderer, `state.bpScale` = N while rendering, pitch 90, rotation =
  Forgatás) mapped by **1 / (SC · N) mm per base unit**, so 1000 mm of plan = 1000 / N mm of paper; pens and texts are
  paper mm by construction.
- What is framed: the level box + 2600 mm on −x / −y (dimension chains) + 2900 on +x and 300 on +y (north arrow),
  projected; centred in the drawing area.
- Orientation: landscape if it fits, else portrait if that fits, else **no fit**: the line reads
  `Nem fér el: A4 1:50 → a rajz 311 × 203 mm, a rajzterület 267 × 160 mm (álló: 180 × 247 mm). Válassz nagyobb lapot vagy kisebb léptéket.`
  (numbers rounded to mm) and SVG / PNG / Nyomtatás do nothing but keep the line; a fit shows `A3 fekvő · 1:50 · rajz 311 × 203 mm`.
- Title block lines: t1 = (Cím · szint) upper case; t2 = `Alaprajz · vágás C mm · N végpont a vágás alatt`; cells
  `Lépték 1:N` · `Lap A3` · `Dátum YYYY-MM-DD` · `Varler Planner`. Scale bar 0–5 m (5000 / N mm) left of the title block.
- PNG at 150 dpi (A3 → 2480 × 1754 px); print with `@page {size: A3 landscape; margin: 0}`.

**Tests (spec-81, CLA v2 ground, CLANV4 ground).**
1. Sheet sizes: A3 → `width="420mm" height="297mm" viewBox="0 0 420 297"` (landscape); A4 landscape 297 × 210; a portrait
   case swaps them.
2. True scale: a 1000 mm segment maps to 20.000 mm at 1:50 and 10.000 mm at 1:100 (± 0.001), at rotation 0 and 90.
3. Fit: CLA A3 1:50 fits landscape (311 × 203 mm); CLA A4 1:50 no fit with the exact line above; CLA A4 1:100 fits
   landscape; CLANV4 A3 1:100 fits. No fit → the export functions return null.
4. Frame and title block geometry: frame rect 20 / 10 / 390 × 277 on A3; title block at x 230, y 257, 180 × 30.
5. Scale bar length 100 mm at 1:50, 50 mm at 1:100. Title t1 = `CLA · FÖLDSZINT` with Cím CLA.
6. State restored after a sheet: style, pitch, rot, bpScale, the scene string.
7. The V4 axo sheet byte-identical (vexpSheet for top / axo before and after); goldens 70/70.

**Out of scope.** Multi-sheet sets, a sheet index, custom title-block fields (project address, author): later with V16.

**Built 2026-10-14** (uncommitted) as specified. `viewSheetSvg` gained `opts.paper` (`viewPaperSheet`, shared title lines
`viewSheetTitles`; the axo sheet byte-identical); `06d`: `vexpPlanBox / vexpPlanFit / vexpPlanSheet / vexpFitSync`, the tick
*Alaprajz-lap* + Papír / Lépték + the fit line; `printSVG(svg, title, page)` takes an `@page` size. Found on CLANV4: the traced
background (`bgSvg`) leaked into the clean plan → the clean Alaprajz drops it (the tick brings it back). CLA A3 1:50 = 311 × 203 mm
landscape, CLANV4 A3 1:100 = 155 × 111 mm; CLA A4 1:50 → the no-fit line. `tools/cla-plan.js --paper=A3 --scale=50` →
`fig/cla-sheet-A3-50.png`, `fig/clanv4-sheet-A3-100.png`. spec-81 (26); suite 75 / 2768 green (spec-16's idle-redraw budget
read 20.1 ms once under the parallel runner, 8.3–8.8 ms alone), golden 70/70 unchanged (no golden renders the plan
sheet). Browser check on 8138 (launch entry *planner-stack-dist* added). ⏸ look: DECISIONS D-V9-6.

## V10 · Interior elevation sheet

From `wallElevationData`: the wall at true scale, openings, object line-art (front view; side views
for objects standing perpendicular to the wall), endpoints with height labels from the finished
floor, chained dimensions, and a sheet title with a wall key on a mini plan. A *Kliens* toggle hides
the installer detail.

## V11 · Time-of-day palettes

Five keyframe palettes over the V4 tags, interpolated. Project fields `lat`, `lon` (CLA default:
Budapest). NOAA sunrise/sunset computed locally. *Napszak* control: Kézi (manual slider) / Élő (live
from the clock). An optional weather API key adds cloud dimming. It is off by default, and the
offline file never needs it.

## V12 · Local relight

Night palette everywhere, except faces inside a switched lamp's room, which take the day palette
with a radial falloff from the lamp. Toggle by clicking a switch (`ctl`) or a lamp. Animated over
400 ms.

## V13 · Soft-shaded iso

The Qecad register: tones per face orientation from a three-tone ramp, a subtle gradient on long
faces, and routes and conduits as tubes (outer stroke plus a lighter inner stroke, with caps at the
fittings).

## V14 · Detail / millwork register

The light AutoCAD-like detail style and the **inverted glow** style (dark ground, light lines, an
`feGaussianBlur` glow on emissive tags: LED, panel, SmartFrame). First subjects: one SmartFrame
portal, one cluster box, one piece of furniture with built-in light.

## V15 · Layer info panel

Click a plate → its neighbours part (animated) and a panel shows the layer: name, items per room,
cost share, standards links. Hover highlights the matching endpoints in the house below.

## V16 · Five-level client style

The client style sheet (calm colour fields, delicate lines, icons in circles, generous margins) over
V4–V6 and V13, plus the BRIDGE brochure figures rendered from CLA with it.

---

## Session order (suggested)

1. **V2 + V7** (quick wins, no look risk) → user tries the presets and reviews the object list.
2. **V1 → V3 → V4** (the core, then the cutaway and the axo style in the Planner) → ⏸.
3. **V5 → V6** (the exploded house and the stack) → ⏸.
4. **V8 first five → V9 → V10** (the flat professional outputs).
5. **V11 → V12**, **V13**, **V14**, then **V15 → V16**.
