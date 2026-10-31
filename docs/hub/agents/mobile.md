# VRG Mobile — agent init
*For a Claude Code session that will work on VRG Mobile. Read this, then the files in §3.*
**Felelős:** Elsie, Behaviour Lab · **Indító:** GO MOBILE

## 1. What it is
One Android app for the phone side of the VRG work, which grows by features. Each feature is a Gradle
module plugging into a shared shell and the Mélyvíz design system, shown as a home-screen tile. The
first is Légegér, the gyro air mouse and Planner / Kódváros controller.

## 2. Where
- `Mobile/android/`: `kit-core/` pure Kotlin with tests, `kit/` Android shared parts, `app/` the shell.
- `Mobile/mobile.cmd`: build, install, test, relay, e2e, studio. START submenu **L**.
- `Mobile/tests/`: `relay-pair.js`, `relay-e2e.js`.
- `docs/mobile/`: roadmap, decisions, work packages. Branch `main`, main checkout, since 2026-10-30.

## 3. Read first
1. `GO-MOBILE.md`
2. `docs/mobile/README.md` — the roadmap M0–M13 and the architecture rules
3. `docs/mobile/DECISIONS.md` — D-1…D-6 decided, D-7…D-11 open
4. `Mobile/README.md`, then `Feature.kt` (the catalogue) and `VrgFeature.kt` (the contract)

## 4. Build / test / check
```bash
Mobile\mobile.cmd test            # must be green before any change
node Mobile/tests/relay-pair.js   # must be green before any change
Mobile\mobile.cmd                 # 2 build the APK, 3 install on the USB phone, 5 relay tests
```
GitHub Actions builds an APK on every push touching `Mobile/` (GO-MOBILE.md §0).

## 5. Rules and traps
- One WP at a time, in the roadmap's order; stop at the end of each and continue only on "tovább"
  (GO-MOBILE.md §2).
- A WP ends at BETA, with its "Telefonon ellenőrizni" list left for the user and a note on what could
  not be verified (GO-MOBILE.md §2).
- Phone UI text is Hungarian; code, comments and docs are English (GO-MOBILE.md §2).
- Share the one relay link and the one GitHub client, `Relay` and `GitHub` in `kit` (GO-MOBILE.md §1).
- A cloud session has different limits: `docs/mobile/CLOUD.md`.

## 6. Current state
- git 2026-10-31 2389f3d VRG Mobile: M3 and M6 live after the phone check
- git 2026-10-31 c253286 VRG Mobile M6: send the outbox when the app comes on screen
- git 2026-10-31 1d98a31 VRG Mobile M13 plan: the PC's screen live on the phone
- M1, M2, M3 and M6 live; next is M9 (root CLAUDE.md).
- M9 needs the user's release keystore outside the repo and four repo secrets (GO-MOBILE.md §4).
- `GO-MOBILE.md` §0 still names the old checkout path; the real one is in root `CLAUDE.md`.

## 7. Do not touch
- The cloud branch `ccr-3aebf098-ytpsqa` is finished; do not commit to it (GO-MOBILE.md §0).
- The release keystore and repo secrets: the user's (GO-MOBILE.md §4).

Forrás: GO-MOBILE.md, Mobile/README.md, launcher/vrg-menu.json, git log main, 2026-10-31
