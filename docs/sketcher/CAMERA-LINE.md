# Dev line: Sketcher Kamera+ — room box, measuring, house 3D (`skcam`)

*Opened 2026-11-20 from the user's request: "custom camera software modded for our needs" for the Sketcher. Use the
Photo feature (M25 Fotópont: four photos per room, 90° apart) to map a room visually, render a basic model of it,
and measure distances, sizes and ratios from the camera. Rooms first; then a house from one or more angles. Offline
and standalone by default: no AI session per capture.*

Research: `docs/research/2026-11-20_room-capture-and-measurement.md` (sources, licences, accuracy).
Grows out of: M24 Vázlat, M25 Fotópont, M29 Kamera, M30 Helyszín (`docs/mobile/WP/`). Builds on decisions D-24…D-26
and D-31/D-32 (`docs/mobile/DECISIONS.md`).

## 1. The answer this line starts from

- **Four photos from one point do not contain depth.** Turning in place gives no parallax, so photogrammetry cannot
  build 3D from them. At 1×, four shots also miss the room's corners (~69° × 4 = 276°) and most of the floor and
  ceiling. At **0.5× (ultrawide)** four shots close the ring.
- **The sketch supplies the geometry, and the photos supply the look.** The room outline and sizes (M24), the point and
  the facing side (M25), and a ceiling height together give a textured 3D **room box**. It is offline, deterministic and
  small. That is stage K1.
- **Real 3D (furniture, pipes, a house's shape) needs photos from moving positions.** That is photogrammetry on the
  PC (COLMAP/GLOMAP, BSD; or the MapAnything Apache-2.0 checkpoint), scaled by one true distance. That is stage K5.
- **A measurement is only exact when one trusted length is known.** That length comes from a Bluetooth laser meter
  (K2), a reference card or object in the photo (K3), or a known camera height. Every other method works from photos
  plus that one length.

## 2. Stages

| Stage | Name | What it is | Runs where | Size | Depends on |
|---|---|---|---|---|---|
| **K0** | Kutatás | The research note above | — | done 2026-11-20 | — |
| **K1** | Szobadoboz (room box) | Room outline × ceiling height (new per-room size field) → 3D box; each Fotópont photo projected onto the walls it faces (virtual camera at the point, ~1.4 m, FOV from EXIF `FocalLengthIn35mmFilm`, yaw from the side). **One-tap correction per photo**: drag the vertical line of a wall corner in the photo onto the box's corner, which fixes the yaw and the swipe's 90° rounding. Orbit view + "stand at the point" view. The M25 hint asks for 0.5× where the phone has it | Desktop Sketcher page first (three.js, MIT), then the Planner's 3D/Views | S–M | M24, M25 (data already captured) |
| **K2** | Lézer | Bluetooth laser distance meter: pick a wall (or ceiling height) on the sketch, press the meter's button, and the length lands on the wall | phone (Kotlin BLE) | M | **Q1** (which meter) |
| **K3** | Síkmérés (plane measuring) | In the photo viewer (M29): mark a known rectangle on a wall plane (a printed ArUco/ChArUco card, an A4 sheet, an 80×80 switch frame, a door) → homography → tap two points and read the distance on that plane; heights from the floor line. The same maths rectifies a **facade** from one photo + one width. Optional one-time lens calibration per phone (ChArUco) | phone + Desktop | M | K2 helps (trusted length) |
| **K4** | Körkép (360) | Eight shots at 45°, or four at 0.5×: stitched into a 360 panorama (OpenCV `Stitcher`, Apache-2.0, on the PC), viewed in Pannellum (MIT); optional HorizonNet (MIT) outline check against the drawn room | PC + viewer anywhere | M | K1 |
| **K5** | Ház 3D | A capture mode for walking around a house or along a room's walls (M29 *Sorozat* with an overlap hint and a "two markers at a known distance" step) → COLMAP/GLOMAP (or MapAnything Apache) on the PC → mesh/points scaled by K2 or the markers → a viewer with a measuring tool; optional Gaussian splat view (Brush, Apache-2.0) | PC (GPU for dense) | L | K2 or K3; **Q4** |
| **K6** | AR mérő (optional) | Our own ARCore viewfinder: live two-point distance, Raw Depth points, Recording API (camera + depth + IMU to MP4 for the PC) | phone | L | **Q2**; reopens D-32 |
| **K7** | Mélységbecslés (optional) | Depth Anything V2 **Small** (Apache-2.0; the larger models are non-commercial) metric-indoor: "this typed size looks wrong" warnings on the Nyitott front | phone or PC | M | licence check of the metric checkpoint |

**Not used** (licence): DUSt3R / MASt3R (CC BY-NC-SA), π³ weights (CC BY-NC), Depth Pro (commercial use unclear),
the default MapAnything and original VGGT checkpoints (non-commercial). OpenMVS is used only as a separate program,
and only after its licence is confirmed.

## 3. Next step

**K1 · Szobadoboz.** Write its WP: the ceiling-height field in the M24 room record, the projection maths, the
corner-alignment record on the M25 shot (`{deg, side, file, taken}` + `yawFix`, `fov`), and the viewer on the Desktop
Sketcher page. It needs no new decision except Q3 (whether the hint asks for 0.5×) and where the box shows first.

## 4. Open questions for the user

- **Q1 · Laser meter.** Do you have a Bluetooth laser distance meter, or will you buy one? Which model? Bosch GLM 50 C /
  50-27 CG / 100 C have community re-implementations of their protocol; Leica DISTO has an SDK but no public protocol.
  The model decides which protocol K2 implements.
- **Q2 · ARCore.** Is Google's AR runtime (Google Play Services for AR, runs on the phone) acceptable for an optional
  live measuring mode? It needs our own viewfinder, which reopens D-32 (the phone's own camera app).
- **Q3 · Your phone.** Which phone is it, and does it have a 0.5× ultrawide? If yes, M25's hint asks for it, so that
  four shots cover the corners. If no, Fotópont offers eight sides (45°).
- **Q4 · The PC.** Is there an NVIDIA GPU on the work PC (COLMAP dense, MapAnything, splats)? Without one, K5 uses the
  sparse and CPU paths and is slower.

## 5. The DevLog entry (for `notes/devlog/lines.js`, filled in on H:)

The DevLog lives in `H:\VRG\Full\notes\devlog\`, outside the repo, so the cloud session that opened this line could
not write it. `docs/handoff/2026-11-20_camera-devline-H.md` is the prompt for the local session. The entry, in the
fields `Stack/lib/layers.js` reads:

```js
{
  id: 'skcam',
  name: 'Sketcher Kamera+ (szobadoboz, mérés, ház 3D)',
  lane: '<the lane that holds the Sketcher / Mobile lines>',
  status: 'open',
  from: ['<the Sketcher / M25 line id>', 'Fotópont photos → a room render and measuring'],
  brief: 'Offline camera features for the Sketcher: the 4 Fotópont photos projected onto the sketched room (room box), a BLE laser meter, measuring on a plane in a photo, a 360 view, house 3D by PC photogrammetry. No AI session per capture.',
  milestones: [['11-20', 'K0 research: docs/research/2026-11-20_room-capture-and-measurement.md; line brief docs/sketcher/CAMERA-LINE.md']],
  remaining: [
    'K1 Szobadoboz: room box from sketch + Fotópont photos (Desktop Sketcher page, three.js)',
    'K2 Lézer: BLE laser meter → wall size (needs Q1: which meter)',
    'K3 Síkmérés: homography measuring on a wall / facade in the photo viewer',
    'K4 Körkép: 8×45° or 4×0.5× → 360 panorama + HorizonNet check',
    'K5 Ház 3D: walk-around capture → COLMAP/GLOMAP on the PC, scaled',
    'K6 AR mérő (optional, Q2, reopens D-32)',
    'K7 Mélységbecslés (optional, Depth Anything V2 Small)',
  ],
  nextStep: 'Write the K1 Szobadoboz WP; ask Q1–Q4 (docs/sketcher/CAMERA-LINE.md §4).',
  notes: ['4 photos from one point carry no depth: the geometry comes from the sketch, the photos give the look.'],
}
```
