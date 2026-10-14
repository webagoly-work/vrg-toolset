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
| V0 | **Prototype:** P33 axo, grid painter, Sims cutaway (`tools/p33-axo.js`) | C1 | — | done | ✅ shown 2026-10-11 |
| V1 | **View core** in the Planner: `06c-view-core.js` — view definition, grid painter, tagged primitives, style-sheet application | all | V0 | L | ✅ built 2026-10-12 |
| V2 | **Camera presets + 90° rotation lock** in the existing 3D view | B1 B2 | — (independent) | S | ✅ built 2026-10-12 |
| V3 | **Kivágás wall mode** (cutaway follows the camera) in the existing 3D view | B3 | V2 | M | ✅ built 2026-10-12 · ⏸ feel |
| V4 | **"Tiszta axo" style + export** (SVG / PNG / print) from the Planner | C1 | V1 V3 | M | ✅ built 2026-10-14 (slices 1–3) · look approved; D-V4-3 fixes built 2026-10-14 |
| V5 | **Room-by-room explode** (static, then animated) | C2 | V4 | M | ◐ slice 1 (static) built 2026-10-14 · animation answered (D-V5-2), not built · ⏸ motion |
| V6 | **Stack plates** exploded upward with leaders | C3 | V5 | M | ✅ built 2026-10-14 · look approved after D-V6-5 A (todo) |
| V7 | **Object library extension** (`OBJECTS-CATALOGUE.md` → `OBJLIB`) | A2 | — (independent) | S | ✅ built 2026-10-12 |
| V8 | **Object line-art** set: front / left / right / top SVG per object | A2 | V7 | L (rolling) | ⏸ first 5 |
| V9 | **Floor-plan output** with adjustable cut height, poché, weights, title block, paper scale | A1 | V1 | L | ⏸ look |
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
`viewWallClass` / `viewWallTops` are the one classifier (V3 uses them). `tools/p33-axo.js` now boots the build in
jsdom and calls the core (V0's standalone copy kept as `tools/p33-axo-v0.js`); `--yaw=` renders any quadrant.
Proof: yaw 225 reproduces V0 exactly (far W6 W7 W9, near W8 W10 W11), yaw 45 swaps them; spec-69.


**Goal.** Move the V0 pipeline into the Planner as a pure function:
`viewRender(viewDef, model) → {svg, prims}`. The tagged primitive list is the API that every later
style uses.
- `viewDef = {kind:'axo'|'plan'|'elev', yaw, pitch, cut, nearCut, scope:{levels, rooms, layers}, style, time}`
- Grid painter from `tools/p33-axo.js`, generalised to the four yaw quadrants. Rotated objects,
  stairs and roofs become sprites (PRIMER §4.2).
- Primitive tags: `wall.top.cut`, `wall.top.full`, `wall.face.lit`, `wall.face.shade`, `plinth.*`,
  `floor.<roomNum>`, `obj.*`, `opening.*`, `ep.<role>.<type>`, `label.*`.
- Style sheets as data (`VIEW_STYLES`), the first one = V0's look.

**Read first.** `tools/p33-axo.js`; `00-core.js` `camK`/`depthOf`; `04-render.js` `drawPreview*`
(the `preview` style shows how a style is plumbed today); `05h-rooms.js` `deviceHostWall`.

**Tests.** P33 v2 fixture → the far-wall set for each quadrant is exact (225°: `W6 W7 W9`). Primitive
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
`view.cutaway` toggles and restores the previous mode. Shots: `fig/p33-3d-solid-102.png`, `fig/p33-3d-cutaway-102.png`,
`fig/p33-3d-cutaway-282.png` (building layer only). Still open: **⏸ feel** — the user draws on P33 with it.
Not done: device symbols above the cut on a lowered wall still draw at their height (V4 can fade them).


A fourth `wallMode`: `cutaway`. Per wall: classify near / far / interior against the current yaw
(PRIMER §4.3) and draw at `nearCut` / full / `cut`. Reclassify when the yaw crosses a quadrant (cache
per quadrant). Device symbols on lowered walls above the cut get the "seen past the cut" treatment.
**⏸ feel:** the user draws on P33 in iso with it on.

## V4 · "Tiszta axo" style + export

**Slice 1 built 2026-10-14** (uncommitted): `viewSheetSvg(R, {title, sub, H})` in `06c-view-core.js` — the sheet frame
(title, legend of the roles present, symbol + wall rows) moved from `tools/p33-axo.js` into the Planner; the tool now
calls it (output byte-identical, minus the old "nézeti mag (V1)" note); `VIEW_ROLE_HU`, `VIEW_LEVEL_HU`, `VIEW_SHEET`;
`tests/spec-73-view-sheet.js` (19). Suite 67/2559 green, golden 70/70.
**Slices 2–3 built 2026-10-14** (uncommitted), per DECISIONS D-V4-1 A / D-V4-2: Render menu *Tiszta axo (3D)* (`state.style='tiszta'`,
`tisztaOn` / `tisztaRender` / `drawTisztaGeom` in `04-render.js`): the scene is the core's body through the live `planToBase`
camera (frame = base / vsK, group `scale(vsK)`), always the cutaway, active level only, no routes / notes / measures / stack
scene layer (the path/cable/device draft block is kept), overlay untouched; memo on camera + model fingerprint (7 ms per
redraw in Chrome vs 67 ms per render); 2D → normal. `src/06d-view-export.js`: the Exportálás menu, `vexpSheet(k, title)`,
`viewSheetSvg` gained `opts.scale`. Specs 74 (19) + 75 (21). Look sample: `tools/v4-look.js` →
`fig/v4-look-p33-nv4.png` (P33 | NV4 × Felülnézet | Axonometria). **⏸ look** open: NV4 has no stack roles, so its legend
header stands empty; top-down follows the current yaw (NV4's sample came out turned).
*Was stopped on* `DECISIONS.md` D-V4-1 (how the style behaves in the 3D view: live camera, overlay, editing) and D-V4-2
(export camera, title source, where the actions go). Remaining slices: (2) the style in the 3D view per D-V4-1;
(3) the three export actions per D-V4-2; (4) ⏸ look — P33 and NV4 side by side.

The V0 look as a selectable style in the 3D view and as an export (*Exportálás → Axonometria
SVG/PNG/Nyomtatás*), using the existing `svgToPng` / `printSVG`. Includes: title block, legend from
the roles actually present, room tags, hardware tags, and the entrance marker (from the `bejarat`
mark tag, not a hard-coded id).
**⏸ look:** P33 and NV4 side by side.

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

**Tests (spec-76, P33 v2 ground).** rank 0 = R01 Előszoba with lift 900; ranks are a permutation of the ground rooms;
lifts are (rank + 1) × 900; step 600 → R01 at 600; 'wall' → 2850; explode off → the svg equals the plain render
byte for byte; every wall cell has exactly one owner; a shared wall gives two half-thickness faces (the grid gains its
centreline coordinates); devices keep their plan x and are shifted by their room's lift only (screen dy = lift × the
camera's z factor, exact); labels follow; bounds top = max lift + H above the plain bounds; deterministic; data
untouched; the export menu passes the step. Exact counts (rooms, cells) recorded in the spec at build.

**Out of scope.** The animation (slice 2); exploding inside the live 3D view (D-V5-2); multi-level; stack plates (V6).

**Built 2026-10-14** (uncommitted) as specified: `viewExplodeOrder`, `viewWallRooms`, `viewRoomKey`, `VIEW_EXPLODE_STEPS`,
`viewExplodeStep`; cell owners = room, else a walk off the wall centreline, else a flood from owned neighbours (corners,
stubs); `stats.lifts / order / step`; prims carry `grp`. P33 ground: order R01 R04 R03L R03 R05 R08 R06 R07, grid
78×78 → 83×81, 0 unowned cells. Export menu *Szétszedve* + *Emelés lépcsője*; `tools/p33-axo.js --explode=` →
`fig/p33-explode-900.png`. spec-76 (25, incl. the D-V4-3 fixes: empty legend heading hidden, Felülnézet *Forgatás*).
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

**Tests (spec-77, P33 v2 ground).** 16 plates in order mark hw base channel DED SOC LIGHT LV BUSB CONTROL DATA SENSOR
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
the frame takes the plate labels in. Export *Rétegek* + *minden elemhez vezetővonal*; `tools/p33-axo.js --plates=` →
`fig/p33-plates-900.png`. spec-77 (25). Chrome: 107 ms per plates render. ⏸ look questions: DECISIONS D-V6-5.

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

## V9 · Floor-plan output

A cut-plane plan at an adjustable height (*Vágási magasság* slider, presets 300 / 1100 / 1200 / 1500).
Poché in cut walls, weights per PRIMER §4.5, dashed above-cut items, door swings, room tags with
area, dimension strings, a north arrow, a title block, and paper sizes A3/A4 at 1:50 / 1:100. The
`whiteout` and `blueprint` styles become style sheets of the same view.

## V10 · Interior elevation sheet

From `wallElevationData`: the wall at true scale, openings, object line-art (front view; side views
for objects standing perpendicular to the wall), endpoints with height labels from the finished
floor, chained dimensions, and a sheet title with a wall key on a mini plan. A *Kliens* toggle hides
the installer detail.

## V11 · Time-of-day palettes

Five keyframe palettes over the V4 tags, interpolated. Project fields `lat`, `lon` (P33 default:
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
V4–V6 and V13, plus the BRIDGE brochure figures rendered from P33 with it.

---

## Session order (suggested)

1. **V2 + V7** (quick wins, no look risk) → user tries the presets and reviews the object list.
2. **V1 → V3 → V4** (the core, then the cutaway and the axo style in the Planner) → ⏸.
3. **V5 → V6** (the exploded house and the stack) → ⏸.
4. **V8 first five → V9 → V10** (the flat professional outputs).
5. **V11 → V12**, **V13**, **V14**, then **V15 → V16**.
