# Primer — Views: from working drawing to beautiful plan

*The development plan for how the Planner **shows** a project: plan, elevation, the pseudo-3D views
between them, and the client-facing exploded house. Written 2026-10-11 from the user's brief that
day. Read this before any session that touches rendering style, camera or export. The ordered work
list is `WORKPLAN.md`, the furniture list is `OBJECTS-CATALOGUE.md`, and the picture references are
`REFERENCES.md` (links only).*

---

## 0. The one principle

**The model is 3D and semantic. Every picture is a *view* generated from it.** We never paint a
picture by hand, and we never ship a raster render as the product. A view is:

```
Model (walls, rooms, openings, objects, devices, routes, stack layers; all with heights)
  → View definition   camera (plan / elevation / axo preset), cut height, scope (level, room, layer)
  → Geometry ops      cut, project, hide what is behind (painter / grid / HLR)
  → Tagged primitives every path still knows what it is: wall-cut, wall-beyond, object, endpoint…
  → Style sheet       line weight, fill, hatch, dash, palette: keyed on tag + view + scale + time of day
  → Output            SVG on screen (infinite zoom), PDF at true paper scale, PNG only as a last export
```

The step that is easiest to get wrong is the fourth: **semantic tags must survive projection.** A
projector that outputs anonymous lines can't be styled afterwards, and every drawing ends up
hand-tuned. A tagged one makes "the five-level client look", "the dark glowing shop drawing" and
"the morning palette" just *different style sheets over the same primitives*.

Vector all the way through means three things: resolution comes free, the same view prints at 1:50,
and a style can be changed live without re-rendering anything heavier than an SVG string.

## 1. Where we start from (2026-10-11)

What already exists in the Planner (`planner-stack` branch):

| piece | where | what it gives us |
|---|---|---|
| 3D view, SVG painter's projection | `04-render.js`, camera in `00-core.js` (`camK`, yaw `state.rot`, `state.pitch`) | free yaw + pitch orthographic camera, face-normal shading, back-face culling |
| wall modes `solid / translucent / hidden` | `state.wallMode` | the slot where a **cutaway** mode belongs |
| render styles `normal / whiteout / blueprint / preview` | `state.style` | the slot where new style sheets belong |
| wall elevation editor | `06-wall-editor.js` `wallElevationSVG` | **already the precursor of the interior elevation**: flat wall, true scale, electrical parts on it |
| plane editor (floor / álmennyezet / mennyezet) | `07-plane-editor.js` | the flat-plan surfaces |
| view scale + real-mm symbols | visual round 2026-10-09 (`vsP`, `devK`, `05z-icons.js`) | sizes already declare model mm vs paper mm |
| fixed role colours | `STK_COL` in `05m-stack.js` | one colour per stack role, shared by every view |
| client preview (WebGL, three.js) | `projects/client-preview/` | the interactive client viewer; it shares *view definitions* with this plan, not code |
| **V0 prototype** | `tools/cla-axo.js` → `docs/views/fig/cla-axo.svg/png` | CLA ground floor in the simplified axonometric look, with a Sims-style cutaway; it proves §4.2 |

Two facts make the whole plan cheaper than it looks:

1. **Planner walls are axis-aligned boxes** (`wallInfo` treats every wall as horizontal or vertical).
   Rooms are orthogonal polygons and most objects sit at 0°/90°. That makes the **grid painter**
   (§4.2) exact for nearly the whole scene, so no 3D engine or HLR library is needed.
2. **In an orthographic view, lifting something vertically is just a screen-y shift.** That makes the
   exploded room-by-room and layer-by-layer animations a matter of CSS `transform: translateY` on
   SVG groups, not re-projection.

## 2. The three families of views

### A · Flat views (orthographic, true scale, printable)

**A1 · Floor-plan output.** A professional plan cut: poché in cut walls, line-weight hierarchy
(cut > beyond > furniture > annotation), dashed for above the cut, door swings, room tags,
dimensions, title block, true paper scale (1:50 / 1:100). The **cut height is adjustable**
(*vágási magasság*, default 1200 mm) because electrical work cares what sits at 300 / 1100 / 1300 mm.
Same machinery for the álmennyezet and mennyezet planes (cut from above, looking up).

**A2 · Interior elevation.** The wall view grows from an editor into a sheet: the wall flat at true
scale, openings, **furniture drawn as clean line art from the front**, endpoints with heights from
the finished floor, and dimension strings. Electrical parts are already there. What's missing is
**2D line-art for every object in front / left / right / top**, which `OBJECTS-CATALOGUE.md` lists
and which we draw ourselves.

**A3 · Shop-drawing / millwork detail.** The detail register: LV modules, flush-mounted designs,
SmartFrame / Portál, cluster boxes, light built into furniture, panel spaces. Two looks:
- *Light:* AutoCAD-like dense detail (centrelines, section cuts, hardware callouts, hidden lines).
- *Inverted glow:* dark background, light linework, emissive elements (LED strips, panels, frames)
  with a soft glow. It's still vector: SVG `feGaussianBlur` on a copy of the emissive paths, never
  a bitmap.

Also used for stylish **top-down whole-blueprint overviews** (dark, line-only, like the user's
first reference image).

### B · Pseudo-3D (2.5D) views: orientation and visualisation

**B1 · Camera presets with snap.** One click snaps the camera to a named projection:

| preset (HU label) | yaw / pitch | use |
|---|---|---|
| Izometrikus | 45° / 35.26° | equal axes, the classic |
| Dimetrikus | 45° / 30° (or 20°/15° asymmetric) | a calmer, less "game" look |
| Axonometria (plan-oblique) | 45° / 60° | rooms read like a plan with height, which suits drawing |
| Katonai (military) 45° | plan undistorted + vertical | the WJEC / exploded-diagram look |
| Homlokzati (elevation-oblique) | 0° / 15° | one wall true, depth hinted |

**B2 · Rotation lock.** A toggle (*Forgatás 90°-onként*) that snaps yaw to the four 90° quadrants
of the preset (45°, 135°, 225°, 315°) and keeps pitch at the preset's value. Free camera stays
available when the lock is off. Q/E (or the existing rotate keys) step one quadrant.

**B3 · Sims-style cutaway.** A new wall mode, *Kivágás*. Walls that stand between the camera and
the room interiors drop to a low height; the far walls stay up. **The rule is recomputed on every
camera rotation**, so the cutaway follows the camera. This is the fix for "the walls are annoying
while drawing in isometric". Rule (proved in V0): an exterior wall whose open side faces the camera
→ low (`NEAR_CUT`); an interior wall → cut (`CUT`); an exterior wall facing away → full height.
Variants for later: *falak le* (everything cut), *teljes* (all up), and per-room cutaway (only the
room under the cursor opens).

**B4 · Soft-shaded isometric** (the Qecad pipe-drawing register). Pastel flat tones per face
orientation, gentle gradients, conduits and routes drawn as **tubes** (a stroke plus a lighter
inner stroke = a vector cylinder), fittings at the bends. This is the most "product" looking style
and the natural home for showing Védőcső / Csatorna routes in 3D.

**B5 · Time-of-day palettes.** The same tagged primitives under five palettes: *hajnal* (dawn),
*reggel* (morning), *nappal* (day), *alkony* (dusk), *éjszaka* (night). Live mode follows the clock
with **sunrise and sunset computed offline** from the project's latitude and longitude (the NOAA
solar-position formula: no network, which fits a single offline file). An optional weather-station
API can add cloud cover, but only as an enhancement. Palettes interpolate between keyframes, so the
change is continuous.

**B6 · Local relight.** The step after B5: at night a switched lamp lights *its* part of the scene.
Faces inside the lamp's room (or within its radius) take the day palette, with a soft radial falloff,
while everything else stays in night. Animated on toggle. The lamp ↔ switch ↔ room relation
already exists in the data (`ctl`, `serves`, rooms), so this is a demo of the model, not new data.

### C · Client-facing exploded house

**C1 · Simplified axonometric of the home.** The WJEC / exploded-diagram look: white walls with fine
black outlines, pastel floors per room type, a base plate, small furniture blocks, endpoints coloured
by system. V0 is the first try (`fig/cla-axo.png`).

**C2 · Room-by-room disassembly.** Each room is its own SVG group (floor, its walls, its furniture,
its endpoints). The animation lifts rooms in a sequence (entrance first) with eased `translateY`.
Painter order between room groups stays near-to-front, which is valid because lifting changes only
screen y (§1 fact 2).

**C3 · The BRIDGE stack as exploded layers.** Above the house: the stack roles (Szerkezet → Jelölés
→ Hardver → BASE → Csatorna → systems) as **translucent plates** in the house footprint, each
carrying only its own primitives, connected by thin dashed leaders (the reference's dotted lines and
circled icons). Bottom-to-top painter order.

**C4 · Interactive info.** Click a plate → it slides apart from its neighbours and an info panel
opens (what the layer is, counts, cost share). This is the basis of an info display. Later work.

**C5 · The five-level aesthetic.** The highest-quality client register (the user's favourite
reference): calm colour fields, delicate linework, generous white space, iconography in circles. It
becomes the client style sheet over C1–C4, and the BRIDGE brochure figures reuse it.

## 3. How the families relate

```
                   ┌── A1 plan ─── A3 detail / glow
 view core (V1) ───┼── A2 elevation ◄── object line-art (catalogue)
                   └── B1–B3 camera + cutaway ── B4 soft iso ── B5 time of day ── B6 relight
                                   └── C1 axo ── C2 rooms explode ── C3 stack plates ── C4 info ── C5 client look
```

- **One view core, many style sheets.** Plan, axo and exploded views run the same pipeline with
  different view definitions.
- **WebGL client preview vs vector views.** The client preview (three.js) stays the interactive 3D
  toy. These views are the Planner's own and the printable ones. They share *data*: camera presets,
  cutaway rule, palettes, role colours and room colours live as JSON so both renderers read them.
  Nothing here replaces the WebGL work.
- **The 70 golden renders** (see `docs/PRIMER.md`) call `drawNormalGeom()` / `drawBlueprint*()` and
  the editor surfaces. Every new style or mode must leave them byte-identical (the default view is
  unchanged) and add its own goldens.

## 4. Technical notes worth not re-deriving

### 4.1 Camera

The existing camera is a yaw (`state.rot`) and pitch orthographic projection. Presets are just
named `(rot, pitch)` pairs with the lock flag. V0 uses `sx = rx·K`, `sy = (ry·sin p − z·cos p)·K`
after rotating the plan by the yaw: a rotation plus a vertical squash, **never a mirror**, so the
axo always reads the same way round as the plan.

### 4.2 The grid painter (exact hidden lines for axis-aligned scenes)

Collect every x and y edge coordinate (walls, openings, room corners, object boxes) into a grid. Each
cell holds a **column of solid z-intervals** (plinth, wall, lintel, sill, furniture). For a camera
looking along +x+y, drawing cells **i descending, then j descending**, is an exact painter's order:
two disjoint cells either share a row or column (the far one goes first) or are separated in both x
and y, and then their screen projections can't overlap (screen x is a fixed multiple of x − y). For
the other three quadrants, flip the loops. Within a column, intervals go bottom to top.

Only real edges get a stroke. A face edge is stroked where the face plane stops: the neighbour cell
isn't solid there, or its own face isn't exposed. Fills carry a same-colour hairline to hide seams.
Endpoints are drawn right after the cell in front of their wall face, so walls in front hide them
correctly.

Out of grid: rotated objects (the CLA terrace set at 45°), stairs and roofs. These are drawn as
small painter-sorted sprites after the cell under their centre. That is good enough for furniture,
and true HLR (`three-edge-projection`) is the fallback only if a real need appears.

### 4.3 Cutaway

Classify every wall once per camera quadrant: interior, near-exterior (open side toward the camera)
or far-exterior. Probe 60 mm off both long faces for a room or another wall. The heights come from
the view definition (`CUT`, `NEAR_CUT`), not from the model.

### 4.4 Exploding

Room membership: a wall belongs to the room(s) it bounds. Shared walls go with the room that is
lifted later, or are split at the centreline (decide in C2). Objects and devices belong to
`roomOfDevice` / point-in-room. Animation: one `<g>` per room with a CSS transition. No
re-projection during the animation.

### 4.5 Style sheets

A style sheet is data: `{tags → {fill, stroke, width (paper mm), dash, opacity, filter}}`, plus
palette keyframes for time of day. Line widths are declared in paper mm (0.13 / 0.18 / 0.25 / 0.35 /
0.5 / 0.7) and use `vector-effect: non-scaling-stroke` on screen. The existing `vsP` already knows
the difference.

## 5. Rules that apply to every phase

- **Own illustrations only.** Reference images are not ours. `REFERENCES.md` holds links, and
  anything downloaded goes to `H:/Dev-VRG/VRG-DE/_refmirror` (outside the repo). Object line-art,
  icons and client figures are drawn by us.
- **Hungarian UI, English code.** Labels in this primer marked *(HU)* are the intended UI strings.
- **Checkpoint before design.** Every phase that is a look decision (A1, A2, A3, B4, B5, C1, C5)
  stops at a ⏸ with a rendered sample before it is built into the Planner.
- **Default view unchanged.** New modes are opt-in. Goldens stay green, and new goldens cover the
  new modes.
- **Step by step.** V0 is the "pulp" first try on purpose. Each later phase raises one register.
