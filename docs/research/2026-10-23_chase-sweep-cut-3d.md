# Véset as a swept 3D cut (the Fusion 360 "sweep → cut" frame). Research note, 2026-10-23

Source: a screenshot of Autodesk Fusion. A long rectangular channel runs along a path, turns a corner and
ends in a deeper box. The body is drawn **translucent red-brown**, which is how Fusion previews an
Extrude/Sweep set to **Cut**: the volume about to be removed is shown inside the body before it is subtracted.
For us this is exactly a **wall chase (véset) + box pocket (dobozfészek)**. This is a clean-room study of
the technique; no Autodesk code or assets are involved.

Spike: [`chase-spike/index.html`](chase-spike/index.html). It is one file and opens directly. You draw chase paths on a
3.6 × 2.7 m wall elevation; the 3D view shows them carved into the wall, or as a Fusion-style red body
(**Előnézet**). The path being drawn always shows as a red translucent body. It also gives live quantities:
metres per width×depth, box pockets, union volume vs. naive sum, and debris kg. The rules are the same as
the Planner's: width = ⌀ × 1.6 (min 20), depth 30 mm up to ⌀25 and 35 mm for ⌀32, pocket 68+4 mm × 45 mm,
square caps. It was checked in the browser pane: carved, preview and draft modes all render, and wheel
zoom shows the groove walls and the deeper pocket step.

---

## 0. What Fusion does, step by step

| Fusion | What it is | Planner today |
|---|---|---|
| Sketch a path on a face | the route on the wall plane | ✅ path sections in the wall elevation (`t.ua,ha → ub,hb`) |
| Profile (rectangle w × d) | the chase cross-section | ✅ `chaseWidthOf(⌀)`, `chaseDepthOf(sec,⌀)` |
| Sweep / extrude along the path, **Cut** | remove that volume from the wall body | ❌ only a 2D hatched area in the elevation |
| Ends join cleanly | union of the swept pieces, square/mitre ends | ✅ square caps in `wvChaseShapes` + `chaseOutline` union |
| Second, deeper cut for the box | a pocket of its own depth | ✅ box shapes with `state.boxDepth` (45) |
| Red translucent preview | shows the removal before it is committed | ❌ |

So we already have the *sketch* and the *profile*. What's missing is the **solid** (a 3D body) and anything that **uses**
it. One more finding: chase metres are only drawn as text under each elevation (`chaseSummaryLines`). Nothing
collects them per project: `chaseSummary` is called only from the wall editor (06) and the plane editor (07).
They don't reach the totals, the 3D view or the client preview.

## 1. The core trick: union of the cut as a depth map

Each cell of the wall face stores **the deepest cut covering it** (chase 30/35, pocket 45). From that:
- removed volume = Σ cell area × depth. Overlaps at corners and boxes are counted **once**. In the spike's
  sample the union is 7.9 l against a naive 8.4 l, so the naive method over-counts by 6 %;
- the 3D faces come out directly: bottoms are runs of equal depth, side walls are the edges where neighbouring
  depths differ (this includes the 30→45 step into the box), and caps are the openings in the wall face;
- carved drawing in a painter's renderer: draw the groove faces far-to-near, **then** the wall face with the
  openings as `evenodd` holes, so the face correctly hides groove walls you shouldn't see.

The spike uses a 5 mm raster. In the Planner nearly every chase is horizontal or vertical, so the same
union can be built **exactly** with coordinate compression: split the wall on every rectangle edge into a
small grid and take the max depth per grid cell. That gives no raster error and only a few hundred cells per wall. Keep
the raster only as the fallback for diagonal sections.

## 2. Options for the Planner

| # | Option | What the user gets | Builds on | Effort |
|---|---|---|---|---|
| **O0** | **`chaseModel(wall)` in mm**: a pure function returning `{kind, u0,h0,u1,h1, w, dep, side}` per chase/pocket, plus the exact union. `wvChaseShapes` becomes a pixel mapping of it. | nothing visible; one source of truth for everything below; golden-testable | 06 wall editor | S |
| **O1** | **Project quantities**: véset m per width×depth, pockets, union volume, debris (by wall material), per room / level / project, in the totals and the export | the **vésés** labour line priced from the plan, not guessed; feeds the Workflow Kit | O0 | S–M |
| **O2** | **Carved walls in the 3D view**: a "Vésetek" layer that pushes groove faces into the existing depth-sorted face list (`lyrFaces`), on the right side of the wall (`back` flag) | see the rough-in state of the house; check routes in 3D | O0 | M |
| **O3** | **Fusion-style live preview**: while a süllyesztett path is being drawn, its cut shows as a red translucent body in 3D and as a red outline in the elevation | instant feedback on what the drawing costs in wall damage | O2 | S |
| **O4** | **Wall-safety checks**: back-to-back chases on thin walls (front + back depth vs. wall thickness), chases too close to openings/corners, horizontal runs outside the allowed zones | catches a plan that would weaken a wall; warnings in the Rules (08i) panel | O0 | M |
| **O5** | **Floor/slab chases**: same model on the Padló / Födém plane (07 plane editor already draws them) | floor channels in quantities and 3D | O0, O2 | S–M |
| **O6** | **Client preview "Bontás" layer**: chases in the `cpv` model; the WebGL page shows the carved walls | the client sees how much opening-up a version means (v1 vs. BRIDGE-ready) | O0, O2 | M |
| **O7** | **Crew sheet / DXF**: a per-wall "Vésési terv" booklet (elevation + table), later the chase layer in the DXF writer from the CAD note | something the crew can work from on site | O0 (+ DXF WP) | S / M |

Not worth it: a real B-rep/CSG kernel (SolidCraft/truck) to subtract solids. Walls are boxes and chases are
boxes, so the depth-map union is exact for our case and far cheaper.

**Recommendation:** O0 → O1 first (money, no 3D risk), then O2 + O3 together (the Fusion look), then O4.
O5–O7 later, as needed.

## 3. Rules to settle before O1/O4

- Wall material per wall (tégla / beton / Ytong / GK): drives debris density and whether chasing is allowed at
  all. In GK walls the conduit runs inside the cavity, so there is no véset.
- Horizontal chase zones: the Planner already has drawing heights (`s1100` etc.). Germany's DIN 18015-3
  installation zones are a known reference; Hungarian practice should be confirmed with you, not assumed.
- Minimum remaining wall behind a chase, especially back-to-back on 10–12 cm walls.

## 4. Built 2026-10-23 (CH-Q1 = A): O0 + O1

In `Planner/projects/varler-planner` (uncommitted):
- **`06-wall-editor.js`**: `chaseModel(d, sides)` (mm items) · `chaseRect` / `chaseCovers` · `chaseUnion(items)` (exact
  coordinate-compression union, memoised; returns `area`, `vol` and `byGroup`, the area each run class owns) ·
  `wvChaseShapes` is now a pixel mapping of `chaseModel` (golden 70/70 byte-identical) · `chaseProject()` ·
  `chaseBOMRows()` · `showChaseReport()`. Elevation records gained `sd` (distance from the wall centreline).
- **`05-totals.js`**: `computeBOM` appends `Falvésés w×d mm` (m) and `Dobozfészek vésés w×d mm` (db) rows, with
  stable ids (`chase_32x30`, `chasebox_72x45`), so prices stick in `state.price`.
- **`05c-actions.js`**: action `chase.report`, "Véset összesítő (fm, fészek, térfogat)", in the Véset group.
- **`tests/spec-108-chase-project.js`**: 23 checks (model = drawing, exact union, corner dedupe, coincident runs,
  hidden layer, BOM, report).

Rules decided while building (on P33 data):
- **Priced metres come from the union, not the section sum.** The stack layers lay several conduits on one line,
  and on P33 baseline the section sum is 297.6 m against 150.1 m of real chase. The sum stays visible in the report
  ("Szakaszok összege").
- **A corner run or box is counted once**, on the wall it sits closest to.
- **Hidden layers are off**, as in `05t-needs`. The P33 file carries the hidden original sketch ("Vázlat — kézi
  vonalak", 106 m of sunk routes), which would otherwise be priced.
- Sunk sections on no wall (floor/ceiling) are reported as "Falon kívül", never priced as wall chasing. P33: 37.1 m.
- Debris uses 1600 kg/m³ (tégla) until CH-Q2 is answered, and appears only in the report (CH-Q3 open).

P33 baseline (`P33_teszt_v1_m_solat_alapreteg`): **150.1 m** wall chase 32×30, pockets 161 × 72, 92 × 144,
4 × 204, 1 × 154, 270 l removed, ≈ 432 kg. The 2026-10-12 takeoff (`MENNYISEGEK.md`) has 32.1 + 45.3 + 68.5 =
**145.9 m**, so we're +2.9 %. That is about what the square caps at free run ends (w/2 each) add. It was not reconciled
run by run.

## 5. Open questions

- ~~**CH-Q1** Which first?~~ **A** (2026-10-23): built, see §4.
- **CH-Q5** Several conduits on ONE line: should the chase widen (e.g. 3 × ⌀20 side by side, so wider than 32 mm)?
  A) yes, width from the conduit count  B) no, one 32 mm chase (today; matches the takeoff rule "egy horony több
  párhuzamos csőnek is")  C) widen only above N conduits
- **CH-Q2** Where does wall material come from?  A) per wall field  B) per level default + override  C) per project
- **CH-Q3** Should debris (kg / bags / container) appear on the quote?  A) yes, as its own line  B) internal only  C) no
- **CH-Q4** Should the wall-safety checks (O4) block or only warn?  A) warn  B) block on back-to-back overlap only
