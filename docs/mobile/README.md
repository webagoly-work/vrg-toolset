# VRG Mobile build pack

VRG Mobile is the companion app for the VRG work. It is meant to be rich but streamlined, sharing its functions and
its design with the rest of the toolset. **The phone handles three things:**
- it **controls** the PC (Légegér, the launch pad, transfers);
- it **links** to the PC, the network and GitHub;
- it **follows the work online**, from GitHub, wherever the phone is (progress, Kódváros, notes, notifications).

The base framework is built (M0). This pack is what the cloud sessions build from.

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
| **M3** | GitHub fiók (`account`) | **built, BETA** (2026-10-30, Client ID set; phone check open): GitHub sign-in with the device code; token in the Android Keystore; the shared GitHub client | internet | high |
| **M6** | Gyorsjegyzet (`notes`) | **built, BETA** (2026-10-30, D-6 = A; phone check open): quick notes pushed to a dedicated branch acting as the chat log | GitHub | high |
| **M9** | Frissítés (`update`) | self-update from GitHub Releases built by Actions | GitHub | medium (+ user step: keystore secret) |
| **M4** | Haladás (`pulse`) | active branches, which tool each branch touches, commits, PRs, CI | GitHub | high |
| **M8** | Localhost (`ports`) | the PC's local servers: open on the phone (relay proxy) or in a separate desktop window | relay | high (relay) |
| **M11** | Indítópult (`launch`) | START.cmd's tools from the phone; running ones; their log | relay | high (relay) |
| **M12** | Átadás (`drop`) | photo / file / clipboard / site picture phone → PC (Planner, Inventory, _inbox) and back | relay | medium |
| **M5** | Kódváros online (`city`) | the repo's city from GitHub's fresh state (online parts only), built by Actions | GitHub | medium |
| **M7** | Hálózat (`net`) | BT HID status, phone-as-relay over WiFi, hotspot with usage notification, USB / BT tethering | — | low (Android-bound) |
| **M10** | Értesítések (`inbox`) | PR, CI, relay events in one list, with phone notifications | GitHub | medium |

**Build order is the table's order.** Each step makes the next ones cheaper:
- M1 gives the shell its own settings, which everything after it uses.
- M2 makes the relay link trusted, which M8, M11 and M12 need before they are allowed to do anything on the PC.
- M3 is the GitHub client that M4, M5, M6, M9 and M10 share.
- M6 is the smallest real GitHub write, so it proves M3 end to end.
- After M9, every later build reaches the phone by itself, with no cable or adb.

### Later, not yet WPs (extrapolated)

- **Quick Settings tile + home widget**: Légegér on/off from the shade, a widget for a quick note.
- **Planner site mode**: room photos and measurements on site, queued offline, synced to the job (builds on
  M12 and the Planner's `07b-phone-camera.js`).
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
