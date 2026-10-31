# GO MOBILE — build VRG Mobile, the companion app, one work package at a time

*You were started with the codephrase **GO MOBILE**. This file is the whole briefing. The user asked for
VRG Mobile on 2026-10-29: one companion app for the phone side of the VRG work, with VRG Légegér (AirDeck) as
its first feature, merging the phone controller pieces (Légegér + the Planner's phone-sender / relay) into it,
and growing over time into a full companion. It should be complex but streamlined, sharing functions and the
design system with the rest of the toolset. The base framework (M0) was built that day on the desktop.*

## 0. Where this runs now: the local H: session (since 2026-10-30)

M0–M6 were built in a cloud session (branch `ccr-3aebf098-ytpsqa`). On 2026-10-30 the user moved the work to the
**local session on H:**: the main checkout `H:\VRG\Full\Planner_VRG_U100`, branch `main`, the same
rules as every other line of work (CLAUDE.md, GO MAIN). Confirm with `git rev-parse --show-toplevel`.

**First local session, once:** bring the last cloud commits into `main`. The cloud branch already has `main` merged
into it, so this is a fast-forward:

```
git fetch origin
git status                                   # clean, on main
git merge --ff-only origin/ccr-3aebf098-ytpsqa
```

If `--ff-only` refuses (main moved on locally), use `git merge origin/ccr-3aebf098-ytpsqa` and resolve. Pushing
`main` is the user's call, as always. After that the cloud branch is finished; do not commit to it again.

What changes locally compared with the cloud:
- **The Android build works here.** `Mobile\mobile.cmd` → 2) builds the APK (JDK 17 + Android SDK, it writes
  `local.properties`), 3) installs it with adb on the USB phone, 4) runs the core tests, 5) the relay tests
  (`relay-pair.js`, then `relay-e2e.js` with Playwright). A compile error now shows up before the push, not in Actions.
- **The phone can be checked from the session** when it is on USB (adb), so a WP's phone list can be worked through
  together with the user.
- Actions (`.github/workflows/mobile-android.yml`) still builds an APK on every push touching `Mobile/`.
- `docs/mobile/CLOUD.md` stays as the record of what a cloud session can do, in case one is used again.

## 1. Read first, in this order

1. `docs/mobile/README.md`: the roadmap (M0–M13) with each WP's state, the build order, the architecture rules.
2. `docs/mobile/DECISIONS.md`: what is decided (D-1…D-6, M1–M3 notes) and what is open (D-7…D-11).
3. `Mobile/README.md`: the code layout. Then `Mobile/android/kit-core/.../Feature.kt` (the catalogue) and
   `kit/.../VrgFeature.kt` (the contract). The shared pieces: `kit/relay/Relay` (the one relay link + trust),
   `kit/github/GitHub` (the one GitHub client), `kit/ShellSettings`, `kit/VrgLog`.
4. `CLAUDE.md`: the repo rules (no secrets, no `Planner/apps|home|data`, no `*.pdf`, `.cmd` files CRLF, START.cmd is the front door).

## 2. Where and how

- **Branch:** `main` in the main checkout, like everything else. Commit after each finished step.
- **Check first:** `Mobile\mobile.cmd test` (or `cd Mobile/android && gradlew :kit-core:test :airdeck-core:test`)
  and `node Mobile/tests/relay-pair.js` must be green before you change anything.
- **One WP at a time, in the roadmap's order.** The next one is the first in the table that is not done. Today that is **M9** (M1, M2, M3 and M6 live).
  Before building, re-read its WP file, and ask the user any open decision it depends on in the reply as numbered
  A/B/C options (with your recommendation first). Record the answer in DECISIONS.md.
- Each WP ends with:
  - the catalogue stage moved to BETA;
  - the WP file's "Telefonon ellenőrizni" list left for the user;
  - a short "what I could not verify here" note.
  Stop and report at the end of every WP. Continue only on the user's "tovább".
- **Phone UI text is Hungarian.** Code, comments and docs are English, as in the rest of the repo.

## 3. What the user asked for, mapped to WPs

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
| a file share board on the relay, to dump or grab copies between the phone and the PC (2026-10-30) | M12 (drop) |
| show what is currently on the computer's screen on the phone (2026-10-30) | M13 (screen) |

## 4. Things only the user can do (ask when the WP needs them, not before)

- **M3**: done 2026-10-30 (OAuth App "VRG Mobile", Client ID in `kit/src/main/res/values/github.xml`).
- **M9**: create the release keystore outside the repo, and add the four repo secrets.
- **Every WP**: install the APK (`mobile.cmd` → 3, or from the Actions run / Releases after M9) and work through the
  phone checklist. None is open right now (M3 and M6 passed 2026-10-31).
