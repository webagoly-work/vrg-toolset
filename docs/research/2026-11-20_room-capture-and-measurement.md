# Room capture, rough 3D and measuring from photos: what is possible offline (research note)

Date: 2026-11-20. Cloud session. The user asked two questions for VRG Sketcher's camera (M25 Fotópont, M29 Kamera):

1. Are **four photos from one point, turned 90° each time**, enough for a basic render of a room? Is there software
   we could REA or learn from, so we can write our own code for this kind of render?
2. **Distances, measurements and ratios.** What ways are there to measure from the camera or from photos, built into
   our own app? The main uses are room interiors (map them out and measure them) and the outside of a house (its
   exact size and 3D shape, from one or more angles).

The constraint: **offline and standalone by default**. Nothing calls an AI service for each capture.

**How far to trust this.** The licence and support facts come from web search summaries (sources at the end), not
from reading each LICENSE file. Before anything is vendored, check its LICENSE at the pinned tag (CLAUDE.md:
`vendor-manifest.json`, tags only). Lines marked **(own)** are my engineering judgement, not a sourced claim. The
accuracy figures marked "to test" are what I expect, not measurements.

---

## 0. Short answers

- **Four photos from one point cannot give real 3D by themselves.** Turning on one spot produces no parallax, so no
  photogrammetry program can triangulate depth from those photos. Together they are a partial panorama. With the
  phone's normal (1×) lens they also leave gaps **at the room's corners** and miss most of the floor and ceiling (§1).
- **But we don't need the photos to supply the geometry. The sketch already has it.** M24 has the room's outline and
  sizes, and M25 has where the photo point is and which way each photo faces. Raise the outline to a ceiling height,
  project each photo onto the walls it sees, and you get a textured "room box" you can walk around. It works offline,
  is deterministic (no AI) and is a few hundred lines of three.js. **This is the render to build first (K1).**
- **Measuring.** The best accuracy for the money is a **Bluetooth laser distance meter** feeding the sketch's size
  fields (±1–2 mm). The second-best tool is **measuring on a plane in a photo** against a known reference (a printed
  marker card, an A4 sheet, a door), with OpenCV-style homography maths, offline. Live **ARCore** measuring and
  **monocular depth** models are possible but rougher. They also need decisions, because ARCore requires our own
  viewfinder and Google's AR runtime. For a **house exterior**, real 3D comes from **multi-view photogrammetry on the
  PC** (COLMAP/GLOMAP, BSD), scaled by one or two true distances.
- **Very little needs REA.** The best references are open source with permissive licences: COLMAP, OpenCV, OpenMVG,
  HorizonNet and Brush. REA is useful in one place: the **Bluetooth protocol of a closed laser-meter app**. Even
  there, community re-implementations exist (§4).

---

## 1. What four photos from one point actually contain

### 1.1 Field of view (own: 36×24 mm equivalent, horizontal × vertical, landscape)

| Lens (35 mm equiv.) | Horizontal | Vertical | 4 shots at 90° in landscape | 4 shots in portrait |
|---|---|---|---|---|
| Main, ~26 mm (1×) | ~69° | ~50° | 4×69 = 276°: a **~21° gap at every corner** | 4×50 = 200°: half the room missing |
| Ultrawide, ~13–16 mm (0.5×) | ~97–108° | ~74–85° | **7–18° overlap** each side: a full ring | ~74–85° each: gaps |

(own) Phone sensors are 4:3 and makers quote "equivalent" focal lengths differently, so the true angles vary by a
few degrees. The EXIF tag `FocalLengthIn35mmFilm` tells us which lens took a photo, where the camera app writes it.

Consequences:
- **With 1× and four shots, the corners fall in the gaps.** The corners are exactly what you need to place the walls.
  Two cures: shoot with **0.5×** (with TakePicture the user picks it in their own camera app, so we can only ask for
  it), or take **eight shots at 45°**.
- **Floor and ceiling** are mostly outside the frame at 1×. That matters for ceiling lights, floor boxes and cable
  routes, but not for the walls.
- **No parallax, no depth.** All four photos share one optical centre, so a point's distance cannot be read from them.
  The distance has to come from somewhere else: the sketch's sizes, a known camera height plus the floor line, or a
  reference object (§3).

### 1.2 Three levels of "render" from this kind of capture

| Level | Input | What you get | How (offline) | Cost |
|---|---|---|---|---|
| **A · Room box** (K1) | M24 room polygon + ceiling height + M25 point + 4 photos | A 3D box of the room with the photos projected onto its walls; orbit or stand at the point | Projective texture mapping: a virtual camera at the point (height ~1.4 m, (own) or a field), yaw from the side, FOV from EXIF. One-tap correction per photo: drag a wall-corner line onto the box's corner (fixes the yaw and the swipe's 90° rounding) | **S–M**, three.js (MIT) |
| **B · 360 view** (K4) | 0.5× four shots, or 1× eight shots | A seamless panorama to look around in, plus optional automatic room-shape check | OpenCV `Stitcher` (Apache-2.0) on the PC, or our own cylindrical warp; viewer Pannellum (MIT) or Marzipano (Apache-2.0). Room layout from the panorama with HorizonNet (MIT); its shape is up to scale, and the camera height or one size makes it metric | **M** |
| **C · Real 3D** (K5) | Photos from **many positions** (walk along the walls), or a video | Point cloud / mesh / Gaussian splat with true depth, including furniture, pipes, the board | Photogrammetry (COLMAP/GLOMAP) or a feed-forward model (MapAnything Apache checkpoint, VGGT-1B-Commercial), on the PC GPU; splats with Brush (Apache-2.0) | **L** |

(own) Level A is the right first step. It uses only what M24/M25 already capture, it is exact where the sketch is
exact, and it makes every photo "land" on the wall it shows, which is what the Planner needs (a socket in the photo →
a position on the wall). Level C is the right tool for the house exterior and for the "everything in 3D" wish, but it
needs a different way of shooting (moving, not turning).

---

## 2. What exists: software to learn from (and the licences)

Licence status is from search summaries; **check each LICENSE file before use.** "Use" = may go into our code or
toolchain; "learn" = read for ideas; "no" = blocked for business use.

### 2.1 Geometry and photogrammetry (classic, no AI)

| Project | What it is | Licence | Fit for us |
|---|---|---|---|
| **COLMAP** (+ GLOMAP, now in the same repository) | The reference structure-from-motion + multi-view stereo pipeline. CLI, CUDA for dense. 3.12 released; Debian ships 4.0.2 | BSD (the "new BSD" licence); bundled dependencies have their own licences [1][2] | **Use** on the PC for K5 (house exterior, multi-view rooms). Vendor as a tagged binary under `tools\` |
| **OpenMVG** | SfM library, readable C++ | MPL-2.0 [3] | Learn / use |
| **AliceVision + Meshroom** | Full photogrammetry pipeline with a node GUI | MPL-2.0 [3] | Use (PC) or learn; Meshroom is an easy first test of whether our photos are good enough |
| **OpenMVS** | Dense reconstruction + meshing + texturing | (own memory: AGPL-3.0; a mirror says MPL-2.0, **unverified** [3]) | Learn only until the licence is confirmed; run as a separate program, never link it into the app |
| **OpenSfM** (Mapillary) | Python SfM, the easiest to read | (own memory: BSD-2, unverified) | Learn |
| **OpenCV** | Homography, `solvePnP`, ArUco/ChArUco markers, LSD line detection, `Stitcher` | Apache-2.0 (own) | **Use**: the core maths of K3 and K4. On the phone, a 4-point homography is ~50 lines of Kotlin, so OpenCV Android is not even needed |
| **Criminisi–Reid–Zisserman single-view metrology** | Measuring from one photo with vanishing lines and one reference length; includes error propagation | Paper (ICCV 1999 / IJCV 2000) [4] | **Learn**: the theory behind K3 and the corner alignment in K1 |
| **three.js** | The 3D viewer | MIT (own) | **Use** (K1 viewer, Desktop Sketcher page / Planner) |
| **Pannellum / Marzipano** | 360 panorama viewers | MIT / Apache-2.0 (own) | Use (K4) |
| **RTAB-Map** | RGB-D / visual SLAM; the Android source has an ARCore build flag. The iOS app does full room scans but needs LiDAR | BSD (own) [5] | Learn (how a room scanner on ARCore is put together) |

### 2.2 Learned models (offline once downloaded, mostly PC; a few fit a phone)

| Model | What it does | Licence | Fit |
|---|---|---|---|
| **HorizonNet** | Room layout (corners, walls, ceiling) from one 360 panorama; post-processing <20 ms | MIT (code) [6] | **Use / learn** for K4 (checks the drawn outline against the panorama) |
| **Depth Anything V2 Small** (also a *metric indoor* Small fine-tune on Hypersim) | Depth from one photo; the metric version in metres | Small = Apache-2.0; Base/Large/Giant = CC-BY-NC-4.0 [7]. The metric-indoor-Small licence is confirmed only by a third-party conversion | **Use the Small model only**, as a plausibility check (K7), never as a measurement |
| **Depth Pro** (Apple) | Metric depth + focal length from one photo | apple-amlr / Apple ASCL; commercial use **unclear** [8] | **No** until the licence is clear |
| **MapAnything** (Meta + CMU) | Feed-forward metric 3D from N photos (poses, depth, SfM, MVS in one network) | `facebook/map-anything-apache` = Apache-2.0 (updated 2026-01-20); default checkpoint CC-BY-NC [9] | **Use the Apache checkpoint** (PC GPU) for K5 experiments: a few photos → a metric point cloud |
| **VGGT** (Meta) | Feed-forward cameras + depth + points from a few to hundreds of photos | Code relicensed 2025-07-29 for commercial use except military; only the **VGGT-1B-Commercial** checkpoint is commercial, and it is gated behind a form [10] | Usable (PC), after accepting its terms |
| **DUSt3R / MASt3R** | The two-view "pointmap" models that started this family | CC BY-NC-SA 4.0 + dataset terms [11] | **No** (non-commercial) |
| **π³ (Pi3)** | VGGT-like, permutation-equivariant | Code BSD-3, **weights CC BY-NC 4.0** [11] | **No** for the weights |
| **Brush** | Gaussian splatting training + viewer in Rust; Android, desktop and browser (WebGPU) | Apache-2.0 (per mirrors; check upstream) [12] | Learn / use for a photoreal walk-around of K5 results; not for measuring |

### 2.3 Phone platform pieces

| Piece | What it gives | Status | Fit |
|---|---|---|---|
| **ARCore** (Google Play Services for AR) | Motion tracking, plane detection, hit tests, **Depth API** (depth from motion; ToF where present), **Raw Depth** with confidence (meant for measuring and 3D reconstruction), **Recording & Playback** (records the camera, depth and IMU into an MP4 for later processing) | Google: Depth API on >87% of active devices (Oct 2025) [13][14]. Runs on the device (own: works offline once installed; not stated by the sources). Closed runtime; SDK/sample licence not confirmed | Possible (K6), but needs **our own viewfinder** (against D-32) and Google's AR runtime (to be squared with D-31). Ask first |
| **TakePicture intent** (what M25/M29 use) | The user's own camera app; we get the JPEG + EXIF | In use | Enough for K1, K3, K4, K5 (all work after the shot) |

---

## 3. Measuring: the options, ranked for our work

| # | Method | Accuracy (expected) | Offline | Needs | Good for | Cost |
|---|---|---|---|---|---|---|
| 1 | **Bluetooth laser distance meter → the sketch** (pick a wall, press the meter, the length lands on it) | ±1–2 mm (device spec class) | yes | a meter (~€60–150) + its BLE protocol (§4) | room sizes, ceiling height, everything a quote is built on | **M** |
| 2 | **Measuring on a plane in a photo** (homography): a known rectangle on the wall plane (a printed **ArUco/ChArUco card**, an A4 sheet, a standard 80×80 mm switch frame, a door 2.0 m) turns the wall in the photo into a scaled drawing; then any two taps on that wall give a distance | (own, to test) ~1–2% near the reference, worse off-plane and at steep angles | yes | the reference in the frame | socket/switch heights, box spacing, door and window sizes, the board's free space, routes on a wall | **M** |
| 3 | **Sketch + photo cross-check** (K1's box): the wall's size comes from the sketch, so a point tapped in a projected photo has a wall position in cm | as good as the sketch size, ±the projection error (own: a few cm) | yes | K1 | "where on this wall is that box?", the photo → Planner symbol | comes with K1 |
| 4 | **Camera-height method** (single-view metrology): with the camera height known (a fixed 1.4 m or a monopod) and the floor–wall line visible, the distance to the wall and its height follow | (own, to test) 3–5% | yes | a level, held camera; the floor line in view | quick room-depth estimate without a meter | S (on top of K3 maths) |
| 5 | **ARCore live measure** (tap two points in the live view) | (own, to test) cm-level at 1–3 m; worse on blank white walls | yes once installed | our own ARCore viewfinder; a supported phone | quick single distances, the AR "tape" | **L** + decision |
| 6 | **Monocular metric depth** (Depth Anything V2 metric-indoor Small) | (own) ±5–10%, scene-dependent | yes | the model on the phone (TFLite/ONNX) or PC | a red flag when a typed size is clearly wrong ("this wall looks 4 m, you typed 2.4") | **M** |
| 7 | **Multi-view photogrammetry + scale** (house exterior, or a room shot while walking) | (own, to test) 1–2 cm on a house with a good scale; the scale error dominates | yes (PC) | 40–150 photos with 60–80% overlap from moving positions; 2 markers at a known distance, or one lasered length | the house's shape and size, facades, the roof, cable routes outside | **L** |
| 8 | **Facade rectification from one photo** (a plane again): the facade is one plane, so one true width (from the laser, or from the OSM footprint of M30) scales the whole facade | (own) 1–3% with a lasered width; OSM widths only ±0.5–1 m | yes | one straight photo + one width | window, door and meter-box positions on the facade | S once K3 exists |

Notes.
- (own) **Exact dimensions always need one trusted distance.** Photos give shape and proportions. A metric number
  comes from a laser, a tape, a marker of known size or a known camera height. Every method above except #1 and #5
  is "photo + one trusted length". That is why #1 is first: it supplies the trusted length for all the others.
- (own) **A marker card is the cheapest accuracy win.** An A5 card with an ArUco/ChArUco pattern, set against the wall
  for one shot, gives size, orientation and lens calibration at once. Calibrating the lens once per phone (a ChArUco
  board, OpenCV) removes the barrel distortion that otherwise bends the 0.5× lens's edges.
- The research of 2026-11-18 ranked "measurement from photo / AR" as *skip* (row 15). That was about **live AR**
  with the TakePicture intent. #1–#4 and #7–#8 all work **after** the shot, so they fit D-32 as it stands.

---

## 4. REA: where reverse engineering actually helps

| Target | Why | What exists already |
|---|---|---|
| **Bosch GLM 50 C / 50-27 CG / 100 C laser meters** (BLE, the "MT protocol") | Feeding #1 without Bosch's app | `ketan/bosch-glm50c-rangefinder` (ESP32/NimBLE C++, reverse-engineered from the Measureon app on Android dumps; last pushed Dec 2024), `piannucci/pymtprotocol` (Python, GLM 100 C, the discovery/ack/fragmentation stack), `philipptrenz/BOSCH-GLM-rangefinder`, an Android B4X library; an EEVblog thread got a GLM 50-27 working from Python [15]. Some GLM models also have a classic-Bluetooth serial mode |
| **Leica DISTO** (D1, D110, D2, D510, D810, X-series) | The same, for Leica | Leica has an Android SDK (`ch.leica.sdk`, seen in a debug log with service UUID `3ab10100-f831-4395-b29d-570977d5bf94`); no public GATT documentation found; phyphox users read a DISTO as a ~2 Hz distance sensor [16] |
| **magicplan, CamToPlan, Polycam, RealityScan** (closed apps) | Learning their **UX**, not their code: how they guide a capture and how they make a plan from AR | Their behaviour can be studied by using them; the methods are in the open papers above |

(own) For a laser meter, REA's role is small: (1) read a community re-implementation; (2) confirm on the real device
with nRF Connect (GATT browser) or an Android HCI snoop log of the maker's app; (3) write our own small Kotlin BLE
client. This is interoperability work on a device we own, which the REA note of 2026-10-20 already places under the
EU interoperability rules. **The model the user owns (or buys) decides which protocol we implement.**

---

## 5. What I recommend, in order (the dev line's stages)

1. **K1 · Szobadoboz (room box)**: Level A render from the M24 sketch + M25 photos. Ceiling height per room (a size
   field), FOV from EXIF, one-tap corner alignment per photo. It runs on the Desktop Sketcher page (three.js) and
   later in the Planner. Ask for 0.5× in the M25 hint text. **S–M, nothing to decide except where it shows.**
2. **K2 · Lézer**: BLE laser meter → the selected wall's size. **M; depends on which meter.**
3. **K3 · Síkmérés (plane measuring)** in the photo viewer: reference card / A4 / door → measure on the wall. Also
   #8 facades. **M.**
4. **K4 · Körkép (360)**: 8 shots or 0.5×; stitched on the PC, Pannellum view, optional HorizonNet outline check. **M.**
5. **K5 · Ház 3D**: a capture mode for walking around a house ("Sorozat" already brings the camera back after each
   shot), then COLMAP/GLOMAP (or the MapAnything Apache checkpoint) on the PC, scaled by K2. A viewer with a
   measuring tool. **L.**
6. **K6 · AR mérő** (optional): our own ARCore viewfinder for live distances and Raw Depth. **L + two decisions.**
7. **K7 · Mélységbecslés** (optional): Depth Anything V2 Small metric as a "this size looks wrong" check. **M.**

The open questions for the user are in `docs/sketcher/CAMERA-LINE.md` §4.

---

## Sources

1. COLMAP repository, licence statement — https://github.com/colmap/colmap ; Debian README 4.0.2 —
   https://sources.debian.org/src/colmap/4.0.2-1/README.md
2. COLMAP 3.12 released (Radiance Fields) — https://radiancefields.com/colmap-3-12-released
3. AliceVision Debian copyright (MPL-2.0) — https://sources.debian.org/src/alicevision/3.3.1%2Brepack-3/debian/copyright ;
   OpenMVG paper (MPL2) — https://imagine.enpc.fr/~marletr/publi/RRPR-2016-Moulon-et-al.pdf ; OpenMVS AGPL thread —
   https://groups.google.com/g/openmvs/c/8zqNHrp9IWY
4. Single view metrology (Criminisi, Reid, Zisserman) — https://www.microsoft.com/en-us/research/publication/single-view-metrology-4/ ;
   DimensionApp (Android, ±5 mm claim) — https://arxiv.org/pdf/1609.07597
5. RTAB-Map Android source (ARCore flag) — https://docs.ros.org/en/api/rtabmap/html/RTABMapActivity_8java_source.html ;
   iOS app — https://apps.apple.com/us/app/-/id1564774365 ; ARCore vs RTAB-Map benchmark — https://www.mdpi.com/2079-9292/9/12/2091 ;
   ARCore has no room-scan API — https://github.com/google-ar/arcore-android-sdk/issues/1772
6. HorizonNet — https://arxiv.org/abs/1901.03861 ; licence listing — https://awesome.ecosyste.ms/projects/github.com%2Fsunset1995%2Fhorizonnet
7. Depth Anything V2 README (licences) — https://raw.githubusercontent.com/DepthAnything/Depth-Anything-V2/main/README.md ;
   metric indoor small (third-party, Apache) — https://huggingface.co/kerasformers/depth_anything_v2_metric_indoor_small
8. Depth Pro — https://github.com/apple/ml-depth-pro ; https://huggingface.co/apple/DepthPro
9. MapAnything — https://arxiv.org/abs/2509.13414 ; Apache checkpoint — https://huggingface.co/facebook/map-anything-apache ;
   default checkpoint — https://huggingface.co/facebook/map-anything/blob/main/README.md
10. VGGT-1B-Commercial — https://huggingface.co/facebook/VGGT-1B-Commercial
11. MASt3R — https://github.com/naver/mast3r/wiki ; π³ — https://github.com/yyfz/pi3
12. Brush — https://github.com/ArthurBrussee/brush ; https://radiancefields.com/platforms/brush
13. ARCore supported devices — https://developers.google.com/ar/devices ; Raw Depth —
    https://developers.google.com/ar/develop/unity-arf/depth/raw-depth ; codelab — https://codelabs.developers.google.com/codelabs/arcore-rawdepthapi
14. ARCore Recording & Playback — https://developers.google.com/ar/develop/recording-and-playback ; announcement —
    https://developers.googleblog.com/2021/05/unlock-use-cases-and-increase-developer-velocity-with-new-capabilities-in-arcore.html
15. Bosch GLM — https://awesome.ecosyste.ms/projects/github.com%2Fketan%2Fbosch-glm50c-rangefinder ;
    https://github.com/piannucci/pymtprotocol ; https://www.eevblog.com/forum/projects/hacking-the-bosch-glm-20-laser-measuring-tape/msg4771613/ ;
    https://b4x.com/android/forum/threads/bosch-glm100c-mt-protocol-to-read-devicemeasurent-from-bosch-rangefinder-using-bluetooth.160495/
16. Leica DISTO — https://shop.leica-geosystems.com/sites/default/files/2019-02/leica_disto_bluetooth_and_apps_getting_started_on_android_en.pdf ;
    https://gist.github.com/AppWerft/34f4a7abf023fc0c3e05a24bf91b0bba ; https://phyphox.org/forums/printthread.php?tid=1240
