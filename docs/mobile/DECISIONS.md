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

## Open (to ask when the WP that needs them starts)

- **D-7 · Kódváros online (M5).** A) Actions runs `CodeCity/scan.js` on each push and publishes the city
  to a `city-pages` branch, and the phone loads it into a WebView; B) the phone builds the city itself
  from the GitHub tree API (a Kotlin port of the layout); C) both: A now, B later for offline.
- **D-8 · Which branches are "active" (M4).** A) every branch with a commit in the last 14 days;
  B) the ones with an open PR plus `main`; C) a list the user pins in the app.
- **D-9 · Phone as the relay (M7).** A) the phone runs a small relay itself (the PC apps connect to it
  over the phone's WiFi or hotspot), for sites without a PC relay; B) the phone only bridges, forwarding
  to the PC relay; C) not needed.
- **D-10 · Localhost on the phone (M8).** A) through the relay as a proxy (`/p/<port>/`, paired phone only);
  B) only "open on the PC"; C) both, with the proxy off by default.
- **D-11 · Notifications (M10).** A) poll GitHub every 15 min (WorkManager), plus relay events while on the
  same WiFi; B) a small push service (needs a server, e.g. a GitHub Action calling ntfy.sh); C) A now, B later.
