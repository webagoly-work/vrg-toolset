# VRG Mobile build pack

VRG Mobile is the companion app for the VRG work. It is meant to be rich but streamlined, sharing its functions and
its design with the rest of the toolset. **The phone handles three things:**
- it **controls** the PC (Légegér, the launch pad, transfers);
- it **links** to the PC, the network and GitHub;
- it **follows the work online**, from GitHub, wherever the phone is (progress, Kódváros, notes, notifications).

The base framework is built (M0). This pack is what the sessions build from (cloud until M6, the local H: session since 2026-10-30).

- [CLOUD.md](CLOUD.md): what a cloud session can and cannot do, and how the WPs are shaped around it.
- [DECISIONS.md](DECISIONS.md): decisions taken and open (answer the open ones in the session, with A/B/C).
- [WP/](WP/): one file per work package. The ids match `Catalogue` in
  `Mobile/android/kit-core/.../Feature.kt`, and the app's planned tiles link to them.

## The roadmap

| WP | Feature (id) | What it does | Needs | Cloud share |
|---|---|---|---|---|
| **M0** | Légegér (`airdeck`) + the shell | **done**: shell, catalogue, links, Mélyvíz kit, Légegér as a feature | — | — |
| **M1** | Beállítások (`settings`) | **LIVE** (built 2026-10-29, checked on the phone 2026-10-30): shell-wide look (palette, size) moved out of Légegér, About + log, paired PCs list | — | high |
| **M2** | QR párosítás (`pair`) | **LIVE** (built 2026-10-29, checked on the phone 2026-10-30): scan the PC's QR: relay address + one-time code → a **trusted** phone; QR for Légegér | camera, relay | high (relay + parser) |
| **M3** | GitHub fiók (`account`) | **LIVE** (built 2026-10-30, checked on the phone 2026-10-31): GitHub sign-in with the device code; token in the Android Keystore; the shared GitHub client | internet | high |
| **M6** | Gyorsjegyzet (`notes`) | **LIVE** (built 2026-10-30, D-6 = A, checked on the phone 2026-10-31): quick notes pushed to a dedicated branch acting as the chat log | GitHub | high |
| **M9** | Frissítés (`update`) | **LIVE** (built and checked on the phone 2026-10-31): self-update from GitHub Releases built by Actions | GitHub | medium (+ user step: keystore secret) |
| **M4** | Haladás (`pulse`) | **LIVE** (built 2026-10-31, D-8 = A, checked on the phone 2026-11-05): main first, then branches with unmerged work; which tools changed, commits, PRs, CI | GitHub | high |
| **M8** | Localhost (`ports`) | **LIVE** (built 2026-11-05, D-10 = C, checked on the phone 2026-11-12): the PC's local servers: open on the phone (relay proxy, `--ports`) or in a separate desktop window | relay | high (relay) |
| **M16** | Kit (`kit`) | **BETA** (built 2026-11-06, waiting for the phone check): the VRG UI Kit's look on the phone: its tokens generated into Kotlin beside the six palettes (ten in all), the three OFL fonts, the MINI as a Compose part on the tiles and chips | — | low (UI only) |
| **M11** | Indítópult (`launch`) | **LIVE** (built 2026-11-06, checked on the phone 2026-11-11): START's tools from the phone; running ones; their log | relay | high (relay) |
| **M12** | Átadás (`drop`) | **LIVE** (built 2026-11-06, checked on the phone 2026-11-12): a two-way file board (`localhost:47291/board` + the app, `inbox\board\`), the clipboard both ways, photos tagged for the Planner / Inventory (their intake is the Later list's site mode / scan) | relay | medium |
| **M13** | Képernyő (`screen`) | **BETA** (built 2026-11-06, ~9.5 frames/s measured, waiting for the phone check): the PC's screen live on the phone, with Légegér's pointer; off unless `--shots`, paired phones only, and the PC shows a notice window with Leállítás while it is watched | relay | high (relay) |
| **M5** | Kódváros online (`city`) | **BETA** (built 2026-11-06, D-7 = A, waiting for the first Actions run and the phone check): the repo's city from GitHub's fresh state (online parts only): `.github/workflows/mobile-city.yml` scans each pushed branch onto `city-pages`, the phone shows it in a confined WebView with touch | GitHub | medium |
| **M7** | Hálózat (`net`) | **BETA** (built 2026-11-07, D-9 = A, waiting for the phone check): every link's honest state with a settings link where an app cannot switch it (hotspot, USB / BT tethering), Helyi WiFi (LocalOnlyHotspot), the day's mobile data with a once-a-day threshold warning, Légegér's BT HID status, and the phone's own relay (`relay-core`, paired PCs only); research in `research/M7-network.md` | — | low (Android-bound) |
| **M10** | Értesítések (`inbox`) | **BETA** (built 2026-11-06, D-11 = C, waiting for the phone check): PR, CI, release, note and relay events in one list grouped by day, phone notifications on five channels; GitHub polled every 15 min (WorkManager, conditional requests), relay events live (`relay-notify.js`); the push service (D-11 B) is a later WP | GitHub | medium |
| **M17** | Rétegverem (`stack`) | **BETA** (built 2026-11-07, D-12 = PC publishes, waiting for the phone check): the VRG Stack's Konnektóm and Holo 3D pages, published from the PC on `stack-pages` (START → R → T), shown offline-capable in a confined WebView, with touch gestures in the pages | GitHub | medium |
| **M18** | Archívum (`archive`) | **BETA** (built 2026-11-11, D-13, waiting for `Archive/` on main and the phone check): the Artifact Archive (VRG Desktop WP-47): every one-shot page Claude made, with when / why / what was going on; the repo's `Archive/` folder read from main, only changed files downloaded, the PC's own viewer in a confined WebView (artifact CDNs allowed), Back through viewer → entry → list | GitHub | high |
| **M14** | Gömb (`sphere`) | **LIVE** (built 2026-11-01, checked on the phone 2026-11-05): the Solomon sphere as a swipe page beside home: three signals on every document, rulings from the phone | GitHub | medium |
| **M19** | Asztal (`desk`) | **BETA** (built in the night run 2026-11-12, D-14, D-15, waiting for the phone check): the VRG Desktop's frame on the phone: sheet tabs, Kommand search (the Desktop palette's scoring), dock, ◣ menu and ◢ Rétegverem dials; the tile home stays as Kompakt; the orientation toggle Automatikus / Álló / Fekvő. Map: [PARITY.md](PARITY.md) | — | low (UI) |
| **M20** | Lapok (`sheets`) | **BETA** (built 2026-11-12, D-16, waiting for the phone check): the Desktop's sheets model ported to `kit-core` (same JSON, same validate, same operations), the phone's 2 × 4 grid drawn 4 × 2 lying down, double-tap / long-press gestures, the User presets fitted | — | high (model) |
| **M21** | Alkalmazások (`apps`) | **BETA** (built 2026-11-12, waiting for the phone check; 375 px notes in the WP): the Desktop's User-level HTML apps (Planner, calculators, Készlet, MindMap, BuildTree, Valena) in a confined WebView, one https origin each, from GitHub `main`, offline after the first fetch | GitHub | high |
| **M22** | Claude (`claude`) | **BETA** (built 2026-11-12, waiting for the phone check; relay `--claude`): opens the official Claude app (no sign-in in VRG Mobile); with a paired PC, the PC's Remote Control sessions: list, start one in a folder (relay `--claude`) | relay | high (relay) |
| **M23** | PC ablakok (`pcwin`) | **BETA** (built 2026-11-12, waiting for the phone check; relay `--files`): the PC's work folders (Repó, VRG Full, Közös) read-only, a look at text and images, a copy onto the Átadás board; mail and feed stay on the PC (D-18) | relay | medium |
| **M24** | Vázlat (`sketch`) | **BETA** (built 2026-11-17, D-19 … D-23, waiting for the first Actions build and the phone check): the field sketch, a note taker with plugins (Jegyzet, Alaprajz, Villany): rooms as rectangles or a lineout, sizes on the walls, points current / planned, the hold wheel for types and memos, circuits, the Elosztó and Bekötés, nyomvonal, tags by drag and drop; the solver in `sketch-core` derives what the measures imply and guesses the rest from the sketch, marked; the Planner opens the package (`08ca-sketch-import.js`) with the guesses marked ≈ | — | high (core) |
| **M25** | Fotópont (`photo`) | **BETA** (built 2026-11-17, D-24 = D-25 = D-26 = A, waiting for the first Actions build and the phone check): the Vázlat's plugin for a point in each room: tap it and the camera app opens, swipe toward the side the photo faces (É, K, D, Ny of the sketch), four wedges per point; each photo shared as its own board file named by the package; the Planner draws the points and view cones and attaches the photos by name (⌘K → Vázlat: fotók) | camera | low (camera) |
| **M26** | VRG Sketcher (`sketch`) | **BETA** (built 2026-11-18, D-27 … D-34): the field instrument: the Vázlat becomes the umbrella with seven fronts as symbols and colours, ✎ and ◉ on every front, chaos-proof records, Nyitott (every loose end); one survey file v2; the Desktop page (START P → S, Asztal dock). Design: `../sketcher/README.md` | — | high (core) |
| **M27** | Jegyzet (in `sketch`) | **BETA**: the conversation: dictation, quick chips instead of typing, the room in focus, Tisztázandó; keyword detectors behind the notes that suggest scope and answers | — | high (core) |
| **M28** | Munkakör + Kérdések (in `sketch`) | **BETA**: the job's toggles and quantities with the scope card; the questionnaire as a digital shadow (48 questions with conditions, options + text, Később / Nem releváns) | — | high (core) |
| **M29** | Kamera (in `sketch`) | **BETA**: photos with a purpose, the shot list that grows with the job, Sorozat, gallery by purpose, vector markup, dictated captions, EXIF GPS; burned copies on export | camera | medium |
| **M30** | Helyszín (in `sketch`) | **BETA**: address, GPS, VRG Térkép through the relay with Átvétel, OSM on request, the building's footprint against the solved sketch | relay (map) | medium |
| **M31** | Variánsok (in `sketch`) | **BETA**: agent-made variants (GO VARIANT, `Sketcher/variants/PROTOCOL.md`) under ⚙ with the corner toggle; Sablon tool, point presets; requests without client data | — | high (data) |
| **M32** | Kezdőlap (both homes) | **BETA** (built 2026-11-18, D-35, waiting for the phone check): the home redesigned: VRG Sketcher as the hero with Fotópont on it, a quick row of four (QR, Légegér, Átadás, Gyorsjegyzet), foldable groups, a side-by-side split lying down, Sketcher in the Asztal dock; the same layout on the Asztal and on Kompakt (`kit-core/HomeLayout.kt`) | — | low |

**Build order is the table's order.** Each step makes the next ones cheaper:
- M1 gives the shell its own settings, which everything after it uses.
- M2 makes the relay link trusted, which M8, M11, M12 and M13 need before they are allowed to do anything on the PC.
- M3 is the GitHub client that M4, M5, M6, M9 and M10 share.
- M6 is the smallest real GitHub write, so it proves M3 end to end.
- After M9, every later build reaches the phone by itself, with no cable or adb.

### Later, not yet WPs (extrapolated)

- **Quick Settings tile + home widget**: Légegér on/off from the shade, a widget for a quick note.
- **Planner site mode**: the measurements and the layout are M24 (Vázlat), the room photos M25 (Fotópont), both BETA; still
  later: the sketch sent straight into a running Planner over the relay (D-20 B), existing points onto the Planner's
  Meglévő layer (D-22).
- **Inventory scan**: barcodes and labels into VRG Inventory (M2's scanner + M12's transfer).
- **Hand-off to a Claude session**: a note (M6) marked as a task becomes a GO prompt the user can start.
- **Board Console / CYD bridge**: the phone as the WiFi link for the ESP32 boards (Firmware/board-console).

## Architecture rules (all WPs)

1. **A feature is a module.** `feature-<id>` (Android library) + its logic in a pure Kotlin module
   (`<id>-core`, or `kit-core` when it is shared). One `object : VrgFeature`, one line in `Registry`, and the
   catalogue entry's stage changes from PLANNED to BETA. It becomes LIVE when the user has checked it on the phone.
2. **Shared things go to the kit, once.** The GitHub client (M3), the relay link (lifted from Légegér's
   `RelayClient` in M2), the settings store (M1) and the Mélyvíz components all live in `kit` / `kit-core`.
   A feature never talks to another feature directly. It uses the kit, or `host.open(id)`.
3. **Mélyvíz everywhere.** Every colour comes from `Melyviz` (kit/theme). The UI is Hungarian, and the console output of
   `.cmd` files stays ASCII. The look matches the toolset: deep water, one glow accent for whatever is live.
4. **The PC side stays one relay.** New PC abilities are relay message types (`{v,from,seq,t,type,payload,to}`
   envelope, see `airdeck-core/Protocol.kt`). Anything that acts on the PC needs the M2 pairing. Each new
   ability is behind a relay flag like `--shots` until it is paired.
5. **Secrets.** No token, keystore or OAuth client secret is ever committed. GitHub tokens live in the
   Android Keystore (EncryptedSharedPreferences or a Keystore-wrapped key). A device-flow client id is
   public and may be committed.
6. **Tests.** Each WP adds JVM tests for its core module and, for relay work, Node tests in `Mobile/tests/`.
   `kit-core`'s catalogue tests must stay green: every feature has a unique id and its own WP.
