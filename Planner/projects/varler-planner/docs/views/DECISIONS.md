# Decisions — Views

*Questions a Views session stopped on, because the docs did not settle them. Each has a recommended
default; answer with the letter (or "default") and the next session builds that. Answered entries stay
here with the answer, so the reason is not lost.*

---

## D-V4-1 · How does "Tiszta axo" work *in the 3D view*? — answered 2026-10-14: **A** (built, slice 2)

WORKPLAN V4 says "the V0 look as a selectable style in the 3D view". The docs don't say what happens to
the camera, overlays and editing while it is on. The facts, from the code:

- The view core (`viewRender`) draws with its own true orthographic camera (`viewCamera(yaw, pitch)`).
  The 3D view uses `project()` / `camK()`, where `state.pitch` is not a true angle (a blend from true iso at
  30, with a hidden +45° yaw, to plan at 90). At the same numbers the two pictures do **not** line up.
- `project()` is linear, so the core can be given the live camera instead (`def.camera = {prj, cx, cy}`
  is already accepted). Then the Tiszta picture sits exactly where the normal 3D view draws, and the
  overlay (selection, handles, hover) and hit-testing stay valid.
- The core draws one level and skips paths/routes, notes, measures and the stack overlay.

Options:

- **A (recommended)** — *Tiszta axo* is a fourth entry in the existing *Stílus* menu (`state.style='tiszta'`),
  3D only. The scene layer becomes `viewRender({camera: live project(), cut: state.cutH, nearCut: state.cutNearH})`
  for the current level; the overlay layer stays as it is, so selecting and moving things still works.
  Routes and notes are not drawn in this style (it is a presentation look). In 2D it falls back to *normal*.
  Wall mode is ignored: the style always draws the cutaway.
- **B** — the same as A, but read-only: editing tools are disabled while the style is on (a HUD line says
  so). Safer, but switching back and forth to edit is a chore.
- **C** — no style in the 3D view at all; Tiszta axo exists only as an export with a preview dialog
  (its own camera: the four quadrants at the core's pitch 50).

## D-V4-2 · The export: which camera, which title, where in the UI? — answered 2026-10-14 (built, slice 3)

**Answer (user):** a new *Exportálás* menu; the camera is chosen from the named views; the export keeps the
zoom currently on screen but always centres the drawing; the basic option is the top-down view.
Built as: header button *📤 Exportálás ▾* → Nézet (Felülnézet default + the five presets, each at the quadrant
nearest the current yaw) · Cím (free text, blank = level only; the title source was not answered, so no name is
invented) · SVG / PNG (2×, ≤ 8192 px) / Nyomtatás. The whole drawing is framed at body scale vsK × zoom.

*Original question:*

- **Camera.** Recommended: the export draws what the 3D view shows (the live camera, via the same
  `def.camera` as D-V4-1 A). Alternative: always the core's own camera at the nearest quadrant, pitch 50
  (= the V0/CLA sheet, comparable between projects).
- **Title.** The Planner keeps no project name in `data`. Recommended: the name of the last loaded /
  saved file without extension (fallback *Terv*), editable in a one-line prompt before the export.
- **UI.** There is no *Exportálás* menu today (only the action `proj.export`, JSON). Recommended: three
  actions in the *Nézet* group — *Axonometria SVG*, *Axonometria PNG*, *Axonometria nyomtatás* — using the
  existing `svgToPng` / `printSVG`, PNG at 2× the sheet size.

Already built without needing these answers (slice 1): `viewSheetSvg(R, {title, sub, H})` in
`06c-view-core.js` — the frame `tools/cla-axo.js` used to draw (title, legend of the roles present,
symbol and wall rows), now in the Planner; the tool calls it (byte-identical output); `tests/spec-73-view-sheet.js`.

## D-V5-1 · Exploded view: where does a shared wall go? — answered 2026-10-14

**Answer (user):** shared walls **A — split at the centreline**. Lift order **A — entrance room first, then by
plan distance from it**. Lift step **selectable** between 900 mm (default), 600 mm and one wall height per room
(HU: *Emelés lépcsője* 900 mm · 600 mm · falmagasság).

*Original question:*

V5 lifts each room as its own group (PRIMER §4.4). A wall between two rooms bounds both; the docs leave
open which group it rides with (WORKPLAN V5, PRIMER §4.4 "decide in C2").

- **A (recommended)** — **split at the centreline.** Each room takes its half of the wall thickness, so every
  lifted room is a closed box with all four walls, and the gap between two lifted rooms shows each side's own
  face. In the grid painter this is cheap: the wall's cells are split at the centre line into two columns,
  each owned by the room on its side. Exterior walls go wholly with their one room. Doors and windows in a
  shared wall are cut in both halves.
- **B** — **the wall goes with the room that is lifted later** (the higher one in the stack). It is simpler (no
  split), but the room lifted first ends up open on that side, and which side is open depends on the lift order.
- **C** — **shared walls stay down** on the base plate and only floors, furniture and endpoints lift. Rooms
  read as trays, which is the calmest look but the least like an exploded house.

Also needed with A or B, recommended defaults: lift order = entrance room first (the `bejarat` tag), then by
plan distance from it; step = 900 mm of model height per room; the core's frame includes the lifted height,
so the sheet grows upward.

## D-V4-3 · ⏸ look follow-ups — answered 2026-10-14

**Answer (user):** the look is approved after two fixes (6B):
- **Legend (4A):** hide the *VÉGPONTOK RENDSZERENKÉNT* heading when no role rows would follow (CLANV4).
- **Felülnézet rotation (5C):** a rotation choice in the Exportálás menu (HU: *Forgatás* 0° / 90° / 180° / 270°).
  Default: 0° (plan north up; the user picked C over A, so A's 0° is the natural starting value).

## D-V5-2 · Szétszedés animation: where does it play, and how is it drawn? — answered 2026-10-14

**Answer (user):** 2a **A** (a *Lejátszás* preview panel from the Exportálás menu). 2b **A or C** — either is fine:
build A (CSS groups, snap to the exact frame on landing); switch to C (precomputed exact frames) if A's overlaps show.
V5 static look: **approved** as it is (entrance lowest).

*Original question:*

Slice 1 (static explode) is built: `viewRender({explode:{step}})`, export menu *Szétszedve*. The animation is
not, because two things are not settled.

Facts from the build: the exact picture comes from the per-cell painter (every cell lifted with its room). PRIMER
§4.4's plan, one `<g>` per room moved with CSS, is **not exact**: an L-shaped room and its neighbour interleave
in the painter order, so as whole groups one of them is drawn over the other in places. An exact frame costs one
render: 129 ms for CLA exploded in Chrome (≈ 8 frames/s).

**D-V5-2a · Where it plays**
- **A (recommended)** — a *Lejátszás* button in the Exportálás menu opens a preview panel over the stage
  (play / pause / step, the room order listed); the editable 3D view is not touched.
- **B** — in the live Tiszta 3D view, with editing paused while it plays; the end state stays on screen until
  the next click.
- **C** — no player; the export writes an animated SVG file (for the client / brochure).

**D-V5-2b · How the frames are drawn**
- **A (recommended)** — CSS groups per room for the motion (smooth, 250 ms per room, eased, as WORKPLAN says),
  then the frame snaps to the exact render when each room lands; small overlaps can show while a room moves.
- **B** — exact frames only: re-rendered on the fly (≈ 8 frames/s on CLA, visibly stepped).
- **C** — exact frames precomputed before playing (smooth playback; CLA ≈ 6 s of preparing first, then cached).

## D-V6 · Stack plates — answered 2026-10-14

**Answer (user):** 1 **A** (every role with content, minus Szerkezet and ARM) · 2 **A** (plain house, first plate 900 mm
above the wall top, then the V5 step) · 3 **A, and B as an option** (key leaders by default; a switch for a leader
from every item) · 4 **A** (other levels with geometry as a faint outline at their height, under the plates).

*Original questions:*

WORKPLAN V6 fixes the order (`STK_ROLES`), "one plate per role present", "only its own primitives", dashed
leaders, bottom-to-top painting, and the ghost rule (design system v3: a level is *in* = the work, *ghost* = has
geometry but is outside the work, faint and not clickable, or *skip* = empty). Not fixed, from what CLA ground has
(roles with content: mark 15 marks · hw 3 · base 1 · channel 5 paths · DED 5 · SOC 18 · LIGHT 38 · LV 7 · BUSB 11 ·
CONTROL 5 · DATA 5 · SENSOR 16 · HMI 5 · MEDIA 10 · USB 1 · SECURITY 3 · arm 37 junctions; the upper floor has walls):

**D-V6-1 · Which roles get a plate?**
- **A (recommended)** — every role with content on the level, except *Szerkezet* (the house below is that plate)
  and *ARM pályák* (routing junctions, not a system). CLA: 16 plates.
- **B** — infrastructure in one plate (Jelölés + Hardver + BASE + Csatorna), then one per system. CLA: 13.
- **C** — one plate per conduit family (Erősáram = DED + SOC + LIGHT together, …). CLA: about 10.

**D-V6-2 · The house below, and the plate spacing**
- **A (recommended)** — the plain (not exploded) house; the first plate 900 mm above the wall top, then one every
  900 mm (the V5 step menu applies: 900 / 600 / falmagasság). A plate = the level's outline as a thin pale slab.
- **B** — the V5 exploded house below, the plates above its highest room.
- **C** — the plain house, plates packed tighter (450 mm), for a compact sheet.

**D-V6-3 · Leaders**
- **A (recommended)** — dashed vertical leaders only from hardware, BASE and the channel ends (CLA: ≈ 14); the
  endpoints on the system plates sit at their true plan position, so the eye lines them up without lines.
- **B** — a dashed leader from every item on every plate down to its position (CLA: ≈ 150 lines).
- **C** — no item leaders; one dashed line per plate corner down to the house (the reference's look).

**D-V6-4 · The ghost rule here**
- **A (recommended)** — the other levels with geometry (CLA: upper) are drawn as a faint outline at their own
  height, under the plates; no plates for them; empty levels skipped.
- **B** — other levels left out of this view entirely (ghosting stays a client-preview rule).
- **C** — other levels drawn in full but faint (opacity ghost), plates above the top one.

## D-V6-5 · ⏸ look on the plates sample (fig/cla-plates-900.png) — answered 2026-10-14

**Answer (user):** 1 **A** — ticking *Rétegek* sets the step to falmagasság (900 / 600 stay selectable); 2 **B** — the V6
look is approved once that is in. *To build:* a one-line onchange in 06d + a spec-77 check (not built yet).

*Original question:*

At the export camera (pitch 50) a 900 mm step lifts a plate ≈ 61 px while a plate is ≈ 700 px deep, so the 16
plates overlap ≈ 90 % and read as a dense translucent stack.
- **A (recommended)** — when *Rétegek* is ticked, the step menu defaults to *falmagasság* (2850 mm, ≈ 194 px per
  plate on CLA), so each plate shows a clear band; 900 / 600 stay selectable.
- **B** — keep it as it is; the user picks *falmagasság* (2850) in the step menu when the stack has many layers.
- **C** — plate count drives the step: 900 mm up to 6 plates, then falmagasság.

---

## D-V9-1 · Where does the floor-plan output live? — answered 2026-10-14 (in advance): **A**

- **A (chosen)** — a new *Alaprajz* entry in the 2D *Stílus* menu (`state.style='alaprajz'`), plus export
  actions next to the V4 ones. Same pattern as Tiszta axo. The normal / blueprint / whiteout views stay as they are.
- B — export only, with a preview dialog.

## D-V9-2 · Whiteout and blueprint as style sheets of the plan view? — answered 2026-10-14 (in advance): **A**

- **A (chosen)** — later, as the separate optional slice V9d, after V9a–c have been seen. The goldens are the
  contract: every existing whiteout / blueprint golden must stay identical.
- B — now, inside V9a. C — never.

## D-V10-1 · Which objects appear on a wall's elevation? — answered 2026-10-14 (in advance): **A**

- **A (chosen)** — objects whose footprint lies within **600 mm** of the wall face and inside the wall's span.
  Parallel to the wall → front view; perpendicular → side view (L/R by orientation).
- B — A plus a per-wall *Megjelenítés* tick list. C — only objects marked manually.

---

## D-V8-1 · Resizing rule for object line-art — answered 2026-10-14: **A** (as built)

The brief: parametric where the family allows; otherwise decide stretch vs fixed detail and write it down.
Built as **A** (spec-78 checks it):

- **A (built, default)**: families with parts to count recompute them from w/d/h (sofa cushions = round(seat / 650),
  bed pillows 1 / 2 at w 1200, base units = ceil(w / 600) each with a drawer + door, wall-unit doors = ceil(w / 600)
  and shelves = round(h / 350) − 1, fridge 2 doors from h 1500). **Every** family keeps its small details at a fixed mm
  size: legs, handles 160 × 12, plinth 100, worktop 40, drawer 140, gaps 2, seat 15, lid 30, flush button r 30.
  A family with nothing to count (**WC**) **stretches**: its shape is fractions of w/d/h, with the fixed details above.
  No SVG transform anywhere, so line weights never distort.
- **B**: non-countable families keep the catalogue drawing **fixed**, centred in the resized box, with the box as a thin
  outline (honest about a product that comes in one size; looks wrong when the box is much bigger).
- **C**: non-countable families scale **uniformly** by the smaller ratio (keeps proportions, leaves a gap on one axis).

## D-V8-2 · ⏸ look on the first five (fig/objart-first5.png) — answered 2026-10-14: **2a A, 2b A, 2c A** (approved as built)

Kanapé 3ü, Ágy 200×160, WC csésze, Konyhapult 120 (+ 60 / 1100), Felsőszekrény, Hűtő 60, at catalogue size and resized,
at 1 : 25. Three things to look at:

- **2a · overall register** — **A (recommended)** approve as is, roll on with V8b batches · **B** heavier (contour 0.5,
  detail 0.25) · **C** lighter / fewer details (drop seams, vent slots, fold line).
- **2b · swing marks** (the dashed hinge triangles) — **A (recommended)** keep them on every door (the elevation
  convention; they tell the installer which side opens) · **B** wall units and appliances only, not base units · **C** none.
- **2c · hinge default** — **A (recommended)** the left half of a run hinges left, the right half right; single doors
  and the fridge hinge left · **B** every single door hinges right · **C** a per-object *Nyitás* (bal / jobb) field
  later in the Planner (V10 needs it anyway for real projects).

---

## D-V9-3 · Which side of a placed object is its front? — answered 2026-10-14: **A**

V9a draws furniture in the plan with the V8 top view (front at the bottom of T), and V10 picks F vs L/R by it. The
model does not know the front: an object is `{x, y, w, d, ht, ang}`; wall-snapping sets `ang` 0 for a horizontal wall
on **either** side (π/2 for a vertical one), and every one of CLA's 31 ground-floor objects has `ang` 0 (4 fotels around
a table, 6 chairs, the sofa, the fridge …). So today a sofa against a south wall and one against a north wall are
the same record.

- **A (recommended)** — a derived front plus an override: an object whose footprint lies within 600 mm of a wall face
  (the D-V10-1 rule) has its **back to the nearest wall**; a free-standing one faces local −d (`ang` 0 → the front looks
  toward −y, i.e. up in the plan); a new optional field `front` (0 / 90 / 180 / 270, set from the object's context menu,
  HU *Eleje: ↑ → ↓ ←*) overrides both. Nothing changes in saved files until the user sets it.
- **B** — derived only (A without the field). Free-standing chairs and fotels around a table will often face wrong.
- **C** — no art in the plan: footprint outlines (+ name) only, as the blueprint plan does today; the front question
  is left for V10.

## D-V9-4 · Endpoints and the cut height in *Alaprajz* — answered 2026-10-14: **A**

The cut height (*Vágási magasság*, presets 300 / 1100 / 1200 / 1500) makes the building section; the brief says
electrical work cares what sits at 300 / 1100 / 1300 mm. CLA ground has 165 endpoints: 23 at ≤ 500, 19 at 501–1250,
28 at 1251–2000 and **95 above 2000** (ceiling lights), so the rule matters.

- **A (recommended)** — every endpoint is drawn (it is an electrical plan); those at or below the cut in full, those
  above it in the faint *above-cut* variant (outline only, 50 % ink), so moving the cut highlights the band you care
  about without hiding the lights.
- **B** — a band: only endpoints within ± 300 mm of the cut in full, all others faint.
- **C** — the cut moves the building only; every endpoint is always drawn in full.

## D-V9-5 · ⏸ look on the Alaprajz samples (fig/cla-plan-1200.png, fig/cla-plan-300.png) — answered 2026-10-14: **1 B, 2 A, 3 C** (built)

**Answer (user):** walls **B** mid-grey poché (`#9a9a9a`, contour unchanged) · content **A** as built · endpoints above the
cut **C** hidden, counted in the HUD (*a vágás fölött N rejtve*). Built the same day; samples re-rendered; spec-79 (40).

*Original question:*

CLA ground at 1:50, cut 1200 and 300. Built as specified (D-V9-3 A, D-V9-4 A); the clean output carries no text until V9b.

- **5a · walls** — **A (recommended)** solid dark poché (#262626) with one 0.5 contour, as built · **B** mid-grey poché
  (lighter print, endpoints on the walls read better) · **C** the blueprint's 45° hatch.
- **5b · what the clean plan shows** — **A (recommended)** building + objects + the active level's endpoints; routes,
  portals and stack layers only with *útvonalak, rétegek is* (as built) · **B** routes (paths / cables) always on,
  portals and stack layers on the tick · **C** everything the Normal view draws.
- **5c · endpoints above the cut** — **A (recommended)** 50 % ink, outline only (as built) · **B** fainter (30 %) so the
  band under the cut stands out more · **C** hidden, with a count in the HUD.

## D-V9-6 · ⏸ look on the plan sheets (fig/cla-sheet-A3-50.png, fig/clanv4-sheet-A3-100.png) — open

Built as V9c specified: ISO frame, a 180 × 30 title block, a 0–5 m bar, true 1:50 / 1:100, the fit line instead of a shrink.

- **6a · title block** — **A (recommended)** as built: title · level, the Alaprajz line, Lépték / Lap / Dátum / Varler Planner ·
  **B** also the project address and the author (the blueprint's *proj / addr / by* fields) in a second cell row · **C** a
  logo cell (VRG Title Card look) in place of *Varler Planner*.
- **6b · endpoint symbols on paper** — **A (recommended)** as built: they follow the drawing scale (≈ 4 mm across at 1:50,
  ≈ 2 mm at 1:100, as a plan symbol should) · **B** one fixed paper size at every scale (≈ 3 mm) · **C** as built, but
  1.5 × at 1:100 so the CLANV4 sheet reads without a loupe.
