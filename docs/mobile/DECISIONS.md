# VRG Mobile: decisions

Answered ones stay here with the date. Open ones are asked in the session's reply as numbered A/B/C
options as well (the user answers like "A, A, B"), and the answer is recorded here.

## Answered

- **D-1 · App identity** (2026-10-29: **A**). New app id `hu.vrg.mobile`, installed beside the old
  `hu.vrg.legeger`. Légegér's settings do not carry over (it is a different app sandbox).
- **D-2 · GitHub sign-in** (2026-10-29: **A**). The GitHub **device flow**: the phone shows a code, and the
  user enters it at github.com/login/device. No client secret in the app. Needs a GitHub OAuth App with
  device flow enabled (a user step in M3). QR-from-the-PC is not the sign-in path. M2's QR pairs the
  phone with the relay, not with GitHub.
- **D-3 · Where the updater gets new versions** (2026-10-29: **A**). **GitHub Releases**, created by Actions,
  with a stable signing key held in a repo secret (user step in M9). Actions artifacts stay as
  the per-push test builds.
- **D-4 · Folder and launcher** (2026-10-29). `AirDeck/` became `Mobile/`, and `legeger.cmd` became
  `mobile.cmd`. START opens VRG Mobile on key **L** (launcher/vrg-menu.json; A is Programok since 2026-10-27).
- **D-5 · Start screen** (2026-10-29). The app reopens the feature that was on screen last, and Back goes
  home. So a Légegér user lands on the deck, as before.

- **M1 · Where the look is set** (2026-10-29, no question needed). Palette and size are the shell's
  (`ShellSettings` in kit), applied by `ShellActivity` around every screen. Légegér's ⚙ keeps a Megjelenés
  line that shows the current look and opens Beállítások; it has no palette of its own. Its stored look is
  handed over once on the first M1 start (`ShellPrefs.adoptLook`), then removed from Légegér's store.

- **M2 · How pairing is built** (2026-10-29, no question needed). The relay link became the app's (`kit: Relay`),
  so the relay address moved from Légegér to `ShellSettings.relayUrl` (handed over once, like the look). The scanner
  is ML Kit's **bundled** model (no Play-services download). The relay's `/pair` QR is drawn with the Planner's own
  encoder (`src/05f-qr.js`, Nayuki, MIT), read from that file rather than copied. `--shots` now needs a paired
  phone, so the old `hu.vrg.legeger` APK (which cannot pair) no longer gets screenshots.

- **M3 · Which GitHub app** (2026-10-30, the WP default). A classic **OAuth App** with Device Flow, scopes
  `repo notifications`; the Client ID goes in `Mobile/android/kit/src/main/res/values/github.xml`. A GitHub App with
  fine-grained permissions (contents + notifications on this one repo) would be narrower; it can replace the OAuth App
  later without touching the features, since they all go through `kit: GitHub`.

- **D-6 · Chat-log branch (M6)** (2026-10-30: **A**). One branch `mobile-log`, one file per day
  `log/YYYY-MM-DD.md`. The branch name is a constant and the client writes no other branch.

- **M12 · File board** (2026-10-30, the user's request). Transfers go through a shared two-way board in
  `H:\VRG\Full\inbox\board\`, shown at `localhost:47291/board` on the PC and in the app, instead of the one-way
  `POST /drop` first planned. The Planner and Inventory routes stay as targets of a board file. In M12 only the PC's
  browser and the paired app use it; a phone browser would need its own one-time QR and is left for later.

- **M13 · Live screen** (2026-10-31, the user's request). A refresh loop of JPEG frames from one long-running capture
  process, not a video stream: no new tool (`ffmpeg` is not in the toolchain) and no video player in the app. It is
  viewing plus Légegér's existing pointer, with no new way of controlling the PC. A video stream can replace the loop
  later if the measured frame rate is not enough.

- **D-8 · Which branches are "active" (M4)** (2026-10-31: **A, reworded**). `main` first (its commits, CI, the tools changed
  in 7 days), then only a branch ahead of `main` with a commit in the last 14 days. `mobile-log` is left out. Asked with the
  facts of that day: every line of work lands on `main`, and 7 of the 8 other branches had nothing unmerged.

- **M14 · Gömb** (2026-11-01, the Founder's SOL-Q1 = A, SOL-Q2 = B). Built out of the table's order, on the Founder's word.
  The phone reads and rules on `solomon-data`, a data-only branch the PC makes; `Contents.putBody` now accepts that branch
  as well as `mobile-log`. Its own tabs change by tapping, so a sideways swipe on that page always means the home screen.

- **M16 · Kit** (2026-11-04, the user's `1A 2A 3A 4A 5A`). The VRG UI Kit (`shared/vrg-ui-kit`) comes to the phone as
  Compose tokens, not HTML. **1A:** the kit's four themes (Éj, Papír, Kontraszt, Mélyvíz-kit) join the six palettes; the
  default palette stays. **2A:** one source: a kit generator writes `KitTokens.kt` from the kit's token files, with a drift
  check. **3A:** Inter, Barlow Condensed and JetBrains Mono ship as `res/font` (OFL, licences beside them). **4A:** a
  `Mini` composable (icon = button = progress) on the home tiles and for sync / export. **5A:** the WP file is written in the
  cloud session; it is built on H: after M8, where Gradle and the phone are.

- **D-10 · Localhost on the phone (M8)** (2026-11-05: **C**). Both: "A PC-n" opens a server in its own desktop window
  for any paired phone; "Itt" shows it on the phone through the relay's `/p/<port>/` proxy, paired phones only, and only
  while the relay runs with `--ports` (off by default, like `--shots`).

- **M8 · How Localhost is built** (2026-11-05, no question needed). Windows reads `netstat -ano` + `tasklist`
  (not Get-NetTCPConnection: ~100 ms instead of a PowerShell start; listening rows found by the zero foreign
  port, since the state word is localised). "📱 Itt" is a Custom Tab through `/p/<port>/`, not a WebView; the
  proxy token is one per pairing for 12 hours, made a cookie on the first request, revoked with the pairing.
  `Mobile/catalogue/ports.json` is generated from START's servers (`ports-gen.js`). `mobile.cmd relay` starts
  the relay with `--shots --ports`; START's bare relay (O → 7) with neither. Details: `WP/M8.md`.

## Open (to ask when the WP that needs them starts)

- **D-7 · Kódváros online (M5).** A) Actions runs `CodeCity/scan.js` on each push and publishes the city
  to a `city-pages` branch, and the phone loads it into a WebView; B) the phone builds the city itself
  from the GitHub tree API (a Kotlin port of the layout); C) both: A now, B later for offline.
- **D-9 · Phone as the relay (M7).** A) the phone runs a small relay itself (the PC apps connect to it
  over the phone's WiFi or hotspot), for sites without a PC relay; B) the phone only bridges, forwarding
  to the PC relay; C) not needed.
- **D-11 · Notifications (M10).** A) poll GitHub every 15 min (WorkManager), plus relay events while on the
  same WiFi; B) a small push service (needs a server, e.g. a GitHub Action calling ntfy.sh); C) A now, B later.
