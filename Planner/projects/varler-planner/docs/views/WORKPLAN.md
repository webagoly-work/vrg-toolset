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
| V4 | **"Tiszta axo" style + export** (SVG / PNG / print) from the Planner | C1 | V1 V3 | M | ⏸ look |
| V5 | **Room-by-room explode** (static, then animated) | C2 | V4 | M | ⏸ motion |
| V6 | **Stack plates** exploded upward with leaders | C3 | V5 | M | ⏸ look |
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

The V0 look as a selectable style in the 3D view and as an export (*Exportálás → Axonometria
SVG/PNG/Nyomtatás*), using the existing `svgToPng` / `printSVG`. Includes: title block, legend from
the roles actually present, room tags, hardware tags, and the entrance marker (from the `bejarat`
mark tag, not a hard-coded id).
**⏸ look:** P33 and NV4 side by side.

## V5 · Room-by-room explode

Render per-room groups (PRIMER §4.4). Static exploded first (rooms lifted by order × step). Then
*Szétszedés* animation: entrance first, 250 ms per room, eased. Decision to take: shared walls
**split at the centreline** (recommended) or go with the later room.

## V6 · Stack plates

Above the house, one plate per stack role present, in stack order. Each plate shows only its
primitives (marks, hardware, BASE, channels, endpoints per system), with dashed leaders from plate
items down to their positions. Bottom-to-top painter order. The ghost rule from the design system v3
applies: out-of-scope levels are ghosted and empty layers are left out.

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
