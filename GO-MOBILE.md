# GO MOBILE — build VRG Mobile, the companion app, one work package at a time

*You were started with the codephrase **GO MOBILE**. This file is the whole briefing. The user asked for
VRG Mobile on 2026-10-29: one companion app for the phone side of the VRG work, with VRG Légegér (AirDeck) as
its first feature, merging the phone controller pieces (Légegér + the Planner's phone-sender / relay) into it,
and growing over time into a full companion. It should be complex but streamlined, sharing functions and the
design system with the rest of the toolset. The base framework (M0) was built that day on the desktop.*

## 0. Read first, in this order

1. `docs/mobile/CLOUD.md`: **what a cloud session can and cannot do** (no Android build here: Google's
   Maven is blocked, so the APK comes from GitHub Actions) and how that shapes every WP.
2. `docs/mobile/README.md`: the roadmap (M0–M12), the build order, the architecture rules.
3. `docs/mobile/DECISIONS.md`: what is decided (D-1…D-5) and what is open (D-6…D-11).
4. `Mobile/README.md`: the code layout. Then `Mobile/android/kit-core/.../Feature.kt` (the catalogue) and
   `kit/.../VrgFeature.kt` (the contract).
5. `CLAUDE.md`: the repo rules (no secrets, no `Planner/apps|home|data`, no `*.pdf`, `.cmd` files CRLF, START.cmd is the front door).

## 1. Where and how

- **Branch.** M0–M2 were merged into `main` on the PC on 2026-10-30. Start from `main` once that is pushed; until
  then, from `claude/gracious-pasteur-vakjwf`.
  Work on your own session branch, commit after each finished step, and **push your branch** so Actions builds
  the APK. Never push `main`, never force-push, never rewrite someone else's commits.
- **Install the APK build first (once).** If `.github/workflows/mobile-android.yml` does not exist yet, copy
  `Mobile/ci/mobile-android.yml` there, commit, and push before anything else (`docs/mobile/CLOUD.md` point 3
  says what to do if the push is refused).
- **Check first:** `cd Mobile/android && VRG_JVM_ONLY=1 ./gradlew :kit-core:test :airdeck-core:test` must
  be green before you change anything.
- **One WP at a time, in the roadmap's order.** The next one is the first in the table that is not done. Today that is **M3** (M1 and M2 built 2026-10-29, both BETA until the user's phone check).
  Before building, re-read its WP file, and ask the user any open decision it depends on in the reply as numbered
  A/B/C options (with your recommendation first). Record the answer in DECISIONS.md.
- Each WP ends with:
  - the catalogue stage moved to BETA;
  - the WP file's "Telefonon ellenőrizni" list left for the user;
  - a short "what I could not verify here" note.
  Stop and report at the end of every WP. Continue only on the user's "tovább".
- **Phone UI text is Hungarian.** Code, comments and docs are English, as in the rest of the repo.

## 2. What the user asked for, mapped to WPs

| The user's words (2026-10-29) | WP |
|---|---|
| Air Deck is a feature of the umbrella app; base framework first | M0 (done) |
| camera QR scan for setup and login; scan the QR on the desktop's screen to log in | M2 (pair) + M3 (account) |
| the app connects to GitHub and uses its login | M3 |
| sync everything online to show the overall progress: every tool patched into the active branches | M4 (pulse) |
| show Kódváros, online parts only (not the PC and H:), in its fresh state | M5 (city) |
| Bluetooth HID; WiFi as a relay; hotspot with usage notification; internet via USB (Bluetooth tether as secondary) | M7 (net), plus Légegér's HID |
| show the localhost addresses, and open them on the desktop in a separate window | M8 (ports) |
| the app updates itself if a new git version is available | M9 (update) |
| quick notes pushed from the app to a dedicated branch that acts as a chat log | M6 (notes) |
| rich, interweaving functions and a shared design system | architecture rules + M1 (settings) |
| "a few logical next steps you extrapolate" | M10 inbox, M11 launch pad, M12 transfer; "Later" list in README |

## 3. Things only the user can do (ask when the WP needs them, not before)

- **M3**: create the GitHub OAuth App with Device Flow enabled, and paste its Client ID (public).
- **M9**: create the release keystore outside the repo, and add the four repo secrets.
- **Every WP**: install the APK from the Actions run (or from Releases after M9) and work through the phone checklist.
