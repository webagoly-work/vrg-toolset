# Dev line: Sketcher Kamera+ — room box, measuring, house 3D (`skcam`)

*Opened 2026-11-20 from the user's request: "custom camera software modded for our needs" for the Sketcher. Use the
Photo feature (M25 Fotópont: four photos per room, 90° apart) to map a room visually, render a basic model of it,
and measure distances, sizes and ratios from the camera. Rooms first; then a house from one or more angles. Offline
and standalone by default: no AI session per capture.*

Research: `docs/research/2026-11-20_room-capture-and-measurement.md` (sources, licences, accuracy).
Grows out of: M24 Vázlat, M25 Fotópont, M29 Kamera, M30 Helyszín, M52 Saját kamera (`docs/mobile/WP/`). Builds on
decisions D-24…D-26, D-31, D-90 and D-100…D-109 (`docs/mobile/DECISIONS.md`).

**State, 2026-11-22:** K0 done, **K1 built** (WP M57, BETA, D-133…D-136), **K1b built** (WP M59, BETA, D-137…D-141), **K3 built** (WP M60, BETA, D-145…D-149), **K4 built** (WP M62, BETA, D-153…D-156), **K5 built** (WP M63, BETA, D-158…D-161), **K6 built** (WP M64, BETA, D-164…D-167), the **K1 polish built** (WP M71, BETA, D-187…D-188), the **K3 marker card built** (WP M72, BETA, D-189…D-190). Fork **DV1** (Data Vault) turns the line's
written and collected features into Data Vault cells (§6).

**Since the line opened:** fork F7 (WP M52, D-100…D-109) gave the Sketcher an **in-app CameraX camera**, with the
phone's camera app as the fallback. D-32 ("the phone's own camera app") no longer limits this line. Our viewfinder
can pick the 0.5× lens, show a level and keep the lens's field of view with each shot (K1b), and K6 (AR) gets
cheaper: its viewfinder exists, only the ARCore session is new.

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
| **K1** ✓ M57 | Szobadoboz (room box) | Room outline × ceiling height (new per-room size field) → 3D box; each Fotópont photo projected onto the walls it faces (virtual camera at the point, ~1.4 m, FOV from EXIF `FocalLengthIn35mmFilm`, yaw from the side). **One-tap correction per photo**: drag the vertical line of a wall corner in the photo onto the box's corner, which fixes the yaw and the swipe's 90° rounding. Orbit view + "stand at the point" view. The M25 hint asks for 0.5× where the phone has it | **Built** on the Desktop Sketcher page (own WebGL 1, no library, D-135); the Planner can reuse `roombox.js` | S–M | M24, M25 (data already captured) |
| **K2** | Lézer | Bluetooth laser distance meter: pick a wall (or ceiling height) on the sketch, press the meter's button, and the length lands on the wall | phone (Kotlin BLE) | M | **Q1** (which meter) |
| **K3** ✓ M60 | Síkmérés (plane measuring) | In the photo viewer (M29): mark a known rectangle on a wall plane (a printed ArUco/ChArUco card, an A4 sheet, an 80×80 switch frame, a door) → homography → tap two points and read the distance on that plane; heights from the floor line. The same maths rectifies a **facade** from one photo + one width. Optional one-time lens calibration per phone (ChArUco) | phone + Desktop | M | K2 helps (trusted length) |
| **K4** ✓ M62 | Körkép (360) | Eight shots at 45°, or four at 0.5×: stitched into a 360 panorama (OpenCV `Stitcher`, Apache-2.0, on the PC), viewed in Pannellum (MIT); optional HorizonNet (MIT) outline check against the drawn room | PC + viewer anywhere | M | K1 |
| **K5** ✓ M63 | Ház 3D | A capture mode for walking around a house or along a room's walls (M29 *Sorozat* with an overlap hint and a "two markers at a known distance" step) → COLMAP/GLOMAP (or MapAnything Apache) on the PC → mesh/points scaled by K2 or the markers → a viewer with a measuring tool; optional Gaussian splat view (Brush, Apache-2.0) | PC (GPU for dense) | L | K2 or K3; **Q4** |
| **K1b** ✓ M59 | Szobadoboz a telefonon | The same `roombox.js` in a WebView (as M54's jegyzőkönyv); `SketchJson` keeps the `box` key; the F7 camera stores the lens / zoom / field of view with each Fotópont shot and offers 0.5× for Fotópont | phone | M | K1 |
| **K6** ✓ M64 | AR mérő: Google AR csomag | One opt-in switch for the whole ARCore pack: a live two-point distance (onto a wall from its Méret), a room scan written as a to-scale Ház 3D file, the Recording API (camera + depth + IMU to MP4 for the PC). ARCore runs its own camera session, so it does not use F7's viewfinder | phone | L | Q2 answered: ARCore, as an option |
| **K7** | Mélységbecslés (optional) | Depth Anything V2 **Small** (Apache-2.0; the larger models are non-commercial) metric-indoor: "this typed size looks wrong" warnings on the Nyitott front | phone or PC | M | licence check of the metric checkpoint |

**Not used** (licence): DUSt3R / MASt3R (CC BY-NC-SA), π³ weights (CC BY-NC), Depth Pro (commercial use unclear),
the default MapAnything and original VGGT checkpoints (non-commercial). OpenMVS is used only as a separate program,
and only after its licence is confirmed.

## 3. Next step

K1 and K1b are built (WP M57 on the Desktop, WP M59 on the phone; their *Telefonon ellenőrizni* lists are the check).
K3, K4 and K5 are built too (WP M60: measuring on a plane in one photo; WP M62: the photo point aligned and its 360°
image; WP M63: a house as a measurable point cloud, COLMAP on the PC). **Next:** COLMAP installed on the PC
(`docs/handoff/2026-11-22_colmap-house3d-H.md`) and a first real house; the phone check with real photos and a tape
measure (M57, M59, M60, M62, M71, M72, and M64 on a phone with ARCore); then **K2** (the laser) as soon as Q1 (which laser meter)
is answered. Beside the line: the open-data terrain and building layer for VRG Térkép (the Founder, 2026-11-22: "both,
start with the ARCore pack"). **K6 built** (WP M64: the Google AR csomag, one switch).
**K1 polish built** (WP M71: 📐 Sarok, drag a corner line onto the corner in the photo; one corner fixes the
direction, two also the lens). **The K3 marker card built** (WP M72: the VRG mérőkártya, printed from the Desktop and
found in the photo by itself, so ① Referencia needs no taps).

## 4. Open questions for the user

- **Q1 · Laser meter.** Do you have a Bluetooth laser distance meter, or will you buy one? Which model? Bosch GLM 50 C /
  50-27 CG / 100 C have community re-implementations of their protocol; Leica DISTO has an SDK but no public protocol.
  The model decides which protocol K2 implements.
- **Q2 · ARCore.** *Answered 2026-11-22:* the recommended option, ARCore as an option, as one pack switched on as a
  whole (D-164, D-165). A Google-independent tracker (open visual-inertial SLAM) stays a later spike.
- **Q3 · Your phone.** Which phone is it, and does it have a 0.5× ultrawide? If yes, K1b makes the in-app camera pick
  it for Fotópont, so four shots cover the corners. If no, Fotópont offers eight sides (45°).
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
  milestones: [['11-20', 'K0 research: docs/research/2026-11-20_room-capture-and-measurement.md; line brief docs/sketcher/CAMERA-LINE.md'],
               ['11-21', 'K1 Szobadoboz built on the Desktop page (WP M57, D-133…D-136); fork DV1 opened (Data Vault feature cells)'],
               ['11-22', 'K1b Szobadoboz on the phone (WP M59, D-137…D-141): WebView viewer, box key kept, lens per Fotópont shot; DV1 merged (data-vault#12)'],
               ['11-22', 'K3 Síkmérés (WP M60, D-145…D-149): distances and heights on a wall from one photo and a known rectangle, phone and Desktop'],
               ['11-22', 'K4 Körkép (WP M62, D-153…D-156): neighbour alignment into the box key, the 360° GPano JPEG, phone and Desktop'],
               ['11-22', 'K5 Ház 3D (WP M63, D-158…D-161): COLMAP on the PC (START P → 3), the point cloud scaled and measured in the Sketcher'],
               ['11-22', 'K6 Google AR csomag (WP M64, D-164…D-167): one switch; ARCore live distance, a to-scale room scan for Ház 3D, the Recording API'],
               ['11-26', 'K1 polish Sarok (WP M71, D-187…D-188): drag the corners onto the photo; one fixes the direction, two also the lens, phone and Desktop'],
               ['11-26', 'K3 mérőkártya (WP M72, D-189…D-190): a printed card the Síkmérés finds in the photo by itself, own detector in plain JS']],
  remaining: [
    'K2 Lézer: BLE laser meter → wall size (needs Q1: which meter)',
    'K3 follow-ups: lens calibration (a board of cards), measured values into the sketch and the jegyzőkönyv',
    'K4 follow-ups: eight 45° shots for phones without 0.5×; the outline checked against the panorama',
    'K5 follow-ups: a walk-round guide on the phone, a mesh / splat view, the scale from K2 or the map',
    'K6 follow-ups: a Google-independent tracker (open VIO spike), the scan as a room outline, playback of a recording',
    'K7 Mélységbecslés (optional, Depth Anything V2 Small)',
  ],
  nextStep: 'COLMAP on the PC (docs/handoff/2026-11-22_colmap-house3d-H.md) and a first real house; phone check of M57, M59, M60, M62, M71, M72; phone check of M64 (ARCore); then K2 (laser) once Q1 is answered.',
  notes: ['4 photos from one point carry no depth: the geometry comes from the sketch, the photos give the look.'],
}
```

## 6. Fork DV1: the Data Vault cells

The Founder, 2026-11-21: *"make a fork, especially towards the data vault repo, to create a Data Vault fitting data
base for our written and collected features"*. The Data Vault (`webagoly-work/data-vault`, PR #4 turned it from Proton
Vault into a catalogue of cells, one JSON per unit of work) knows the WPs and research notes only as whole documents.
Fork session **DV1** (branch `claude/dv-feature-cells` there) adds a feature-level harvest:

- **written** features: one cell per Sketcher registry feature (`Sketcher/catalog/features.json`, D-90), with its WP
  and state;
- **collected** features: one cell per row of a research note's ranked tables (the 2026-11-18 camera / intake rankings,
  this line's software and measuring tables), with value, cost, accuracy, licence and source;
- links between a scouted feature and the one that was built from it, and the `skcam` stages K0–K7 as cells.

Its report comes back to the coordinating session of this line.
