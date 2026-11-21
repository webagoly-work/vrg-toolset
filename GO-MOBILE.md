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
2. `docs/mobile/DECISIONS.md`: what is decided (D-1…D-11 and the per-WP notes) and what is open (none since 2026-11-06).
3. `Mobile/README.md`: the code layout. Then `Mobile/android/kit-core/.../Feature.kt` (the catalogue) and
   `kit/.../VrgFeature.kt` (the contract). The shared pieces: `kit/relay/Relay` (the one relay link + trust),
   `kit/github/GitHub` (the one GitHub client), `kit/ShellSettings`, `kit/VrgLog`.
4. `CLAUDE.md`: the repo rules (no secrets, no `Planner/apps|home|data`, no `*.pdf`, `.cmd` files CRLF, START.cmd is the front door).

## 2. Where and how

- **Branch:** `main` in the main checkout, like everything else. Commit after each finished step.
- **Check first:** `Mobile\mobile.cmd test` (or `cd Mobile/android && gradlew :kit-core:test :airdeck-core:test`)
  and `node Mobile/tests/relay-pair.js` must be green before you change anything.
- **One WP at a time, in the roadmap's order.** The next one is the first in the table that is not done. Every WP
  without an open decision is now built. The last three were answered on 2026-11-06 (D-7 = A, D-9 = A, D-11 = C) and
  were built as one batch: **M5** (Kódváros online), **M10** (Értesítések) and **M7** (Hálózat) are all done.
  M1, M2, M3, M4, M6, M9, M14, M11 (Indítópult, checked on the phone 2026-11-11), M8 (Localhost, checked
  2026-11-12) and M12 (Átadás, checked 2026-11-12) are live; **M16** (the VRG UI Kit's look on the phone, built
  2026-11-06), **M13** (Képernyő, built 2026-11-06), **M5** (Kódváros online, built 2026-11-06; its city appears after the
  first push, when `.github/workflows/mobile-city.yml` has run), **M10** (Értesítések, built 2026-11-06; the push
  service, D-11 B, is a later WP) and **M7** (Hálózat, built 2026-11-07; the phone's own relay in `relay-core`,
  research in `docs/mobile/research/M7-network.md`) are BETA until the user works through their phone lists in
  `docs/mobile/WP/M16.md`,
  `docs/mobile/WP/M13.md`, `docs/mobile/WP/M5.md`, `docs/mobile/WP/M10.md` and `docs/mobile/WP/M7.md`.
  Before building, re-read its WP file, and ask the user any open decision it depends on in the reply as numbered
  A/B/C options (with your recommendation first). Record the answer in DECISIONS.md.
- Each WP ends with:
  - the catalogue stage moved to BETA;
  - the WP file's "Telefonon ellenőrizni" list left for the user;
  - a short "what I could not verify here" note.
  Stop and report at the end of every WP. Continue only on the user's "tovább".
- **Phone UI text is Hungarian.** Code, comments and docs are English, as in the rest of the repo.
- **Night run 2026-11-12** (`docs/mobile/NIGHT-DESKTOP.md`): N1 parity map and **M19** Asztal (BETA, D-14, D-15)
  built; N3–N6 (M20–M23) not started. Report: `docs/mobile/NIGHT-REPORT-2026-11-12.md`.
- **M20** Lapok built 2026-11-12 (D-16), **BETA**: `docs/mobile/WP/M20.md` → "Telefonon ellenőrizni". Next in order: M21.
- **M21** Alkalmazások built 2026-11-12, **BETA**: `docs/mobile/WP/M21.md` → "Telefonon ellenőrizni" (8 apps, one origin each; `node Mobile/tests/apps-phone.js`). Next in order: M22.
- **M22** Claude built 2026-11-12, **BETA**: `docs/mobile/WP/M22.md` → "Telefonon ellenőrizni" (step 0 first: run `claude remote-control` once by hand on the PC). The relay needs `--claude`. Next in order: M23.
- **M23** PC ablakok built 2026-11-12, **BETA**: `docs/mobile/WP/M23.md` → "Telefonon ellenőrizni". The PC's work folders (D-17) read-only, copy via Átadás; the feed and search stay on the PC (D-18). The relay needs `--files` (`Mobile\mobile.cmd relay` passes it). M23 is the last WP in the table: what comes next is the user's call.
- **M24** Vázlat built 2026-11-17 **in a cloud session** (branch `ccr-8eb857ea-k8amlp`, not yet on `main`: merge it
  locally first), **BETA**: `docs/mobile/WP/M24.md` → "Telefonon ellenőrizni" (16 steps, the last two on the PC with
  the Planner). D-19 … D-23 were taken as defaults while building: revisit them in `docs/mobile/DECISIONS.md`. Its
  logic is `sketch-core` (`gradlew :sketch-core:test`, now in `mobile.cmd test` and CI); the Planner side is
  `src/08ca-sketch-import.js` + `tests/spec-111-sketch-import.js`.
- **M25** Fotópont built 2026-11-17 in the same cloud session (D-24 = D-25 = D-26 = A, answered by the user), **BETA**:
  `docs/mobile/WP/M25.md` → "Telefonon ellenőrizni" (10 steps, the last on the PC). A Vázlat plugin, off by default.
- **M26–M31** VRG Sketcher built 2026-11-18 (cloud session, merged to `main` the same day; D-27 … D-34 taken as
  defaults): the Vázlat is now the field instrument with fronts (Jegyzet M27, Munkakör + Kérdések M28, Kamera M29,
  Helyszín M30, Variánsok M31). Design `docs/sketcher/README.md`; phone lists in `docs/mobile/WP/M26.md` … `M31.md`;
  the Desktop page is START P → S; new variants through **GO VARIANT**. `node Sketcher/test/run.js` is its Node suite.
- **M32** Kezdőlap built 2026-11-18 (cloud session, D-35 answered by the user), **BETA**: the home redesign, Sketcher
  as the hero on both homes and in the Asztal dock. `docs/mobile/WP/M32.md` → "Telefonon ellenőrizni".
- **M33** Csipogó built 2026-11-18 (cloud session, merged to `main` the same day; D-36–D-38), **BETA**: `docs/mobile/WP/M33.md` → "Telefonon ellenőrizni" (two phones, Android 10+; a third for the relay). The Site Pager on phones over BLE: pager panel, proximity / finder, chat, push-to-talk, guard, man-down. `pager-core` tests in `mobile.cmd test` and Actions.
- **M34** Ikon built 2026-11-18 (cloud session), **BETA**: `docs/mobile/WP/M34.md` → "Telefonon ellenőrizni". The Varler mark (no wordmark) as the launcher icon in the user's palette, and faint behind the homes. The old home-screen icon may need re-adding once.
- **M35** Eszközök built 2026-11-18 (cloud session, D-39–D-41), **BETA**: `docs/mobile/WP/M35.md` → "Telefonon ellenőrizni". New phones are approved by QR from the owner's phone; `Mobile/trust/devices.json` (release lock on) replaces adding codes to `access.json` by hand.
- **M36** iPhone web app built 2026-11-18 (cloud session, D-42, D-43), **BETA**: `docs/mobile/WP/M36.md`. `Mobile/web/` on GitHub Pages (`mobile-web.yml`); **one-time: Settings → Pages → Source: GitHub Actions**. `node Mobile/tests/web-app.js` is its browser test.
- **M37** RCO built 2026-11-19 (cloud session, D-45), **BETA**: the long-press menu on the dock windows, the home icons
  and seven lists. `docs/mobile/WP/M37.md` → "Telefonon ellenőrizni".
- **M38** Kezdőlap lapok + Katalógus built 2026-11-19 (cloud session, D-47), **BETA**: the home in numbered pages, the
  one-page view on ⌂'s long press, the Katalógus; M39–M41 tiles for the Planner, the calculators and Készlet; M42–M45
  (Workflow Kit, Térkép, Időjárás, Vault) planned. `docs/mobile/WP/M38.md` → "Telefonon ellenőrizni".
- **M45** Vault built 2026-11-20 (cloud session, D-53 = A, D-54 = A), **BETA**: the Proton Vault's own web app inside the
  app, with its own device approval. `docs/mobile/WP/M45.md` → "Telefonon ellenőrizni" (step 1 may need the Vault's address).
- **M42** Varler Workflow Kit built 2026-11-20 (cloud session, D-52 = C), **BETA**: the PC seals each Kit job to the owner's
  phone key (`node tools/workflow-seal.js trust <ID> <CODE>`, then `seal`), only ciphertext on the `workflow-sealed`
  branch. `docs/mobile/WP/M42.md` → "Telefonon ellenőrizni" (13 steps, two on the PC).
- **M43** VRG Térkép built 2026-11-20 (cloud session, D-48 = A, D-49 = A + B + C), **BETA**: `docs/mobile/WP/M43.md` →
  "Telefonon ellenőrizni" (12 steps; 6–8 need START M and the relay with `--ports`). `feature-map`, rules in
  `kit-core/MapPhone.kt`.
- **M46–M54** the VRG Sketcher forks (`docs/sketcher/FORKS.md`), 2026-11-20/21, cloud sessions, each **BETA**: M46
  Kamera 2 (F3, D-55 … D-61, D-90), M47 Munkakör lap + takeoff (F2, D-67 … D-71, D-77 … D-79), M48 Helyszín ↔ Térkép
  (F1, D-62 … D-66), M49 Apró hiányok (F4, D-72 … D-76), M50 Maradékok (F5, D-80 … D-84), M51 Kapcsolók (F6, D-91 … D-99),
  M52 Saját kamera (F7, D-100 … D-109), M53 Összefésülés (F8, D-110 … D-116: the forks tested together end to end), M54 Jegyzőkönyv a telefonon (F9,
  D-120 … D-128). Their
  phone lists make one two-phone plan: `docs/sketcher/TEST-2PHONES.md` (`node Sketcher/tools/test-plan.js`).
- **M55** Térkép-feed built 2026-11-21 (cloud session, D-129 … D-132), **BETA**: the nearest Otthon, Daniella, shops,
  food, doctor … in the Térkép (key F) with distance, ETA, ghost lines and hold-to-select. `docs/mobile/WP/M55.md` →
  "Telefonon ellenőrizni" (step 0 on the PC: `fetch-data.js --only=osm,pois`). N2 (own routing, D-129) and N3
  (traffic, D-130) are next in that line.
- **M56** Saját útvonaltervezés (N2) built 2026-11-21 (cloud session, D-129 A), **BETA**: our own offline road network
  and router in the Térkép; the feed's road times, a held place routed and drawn. `docs/mobile/WP/M56.md` →
  "Telefonon ellenőrizni" (step 0 on the PC: `fetch-data.js --only=osm,roads`). N3 (guidance, traffic) is next.
- **M57** Vezetés + forgalom (N3) built 2026-11-21 (cloud session, D-130), **BETA**: ▶ Indulás on a routed place:
  banner, voice (Android TTS on the phone), camera follow, roundabouts, re-planning; 🚦 TomTom traffic with the
  user's own key on a tap. `docs/mobile/WP/M57.md` → "Telefonon ellenőrizni" (step 0: rebuild `roads.bin`, format 2).

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
- **M9**: done 2026-10-31. A push to `main` touching `Mobile/android` makes a release and the phone updates itself.
  The keystore is `H:\VRG\Full\_admin\keys\vrg-mobile.jks`. `mobile.cmd` → 3 cannot replace a release: its key differs.
- **Temporary access** (2026-11-02): `Mobile/access.json` switches the repo-name entry and the trusted device list;
  see the end of `docs/mobile/WP/M3.md`. Only the user decides when they change.
- **Every WP**: install the APK (`mobile.cmd` → 3, or from the Actions run / Releases after M9) and work through the
  phone checklist. Open right now: **M16** (`docs/mobile/WP/M16.md` →
  "Telefonon ellenőrizni": the ten palettes, the kit faces, the MINI rings, TalkBack, "Animációk eltávolítása") and **M13** (`docs/mobile/WP/M13.md` → "Telefonon ellenőrizni": the PC's screen moving with the cursor, the notice
  window and its Leállítás, steering with the Légegér strip, monitor / window switch, Home, removing the pairing,
  a UAC prompt, the frame rate on WiFi and on the hotspot; the relay with `--shots`: `Mobile\mobile.cmd` → 1)
  and **M5** (`docs/mobile/WP/M5.md` → "Telefonon ellenőrizni": first push, so that the **VRG Mobile (Kódváros
  online)** Actions run publishes `city-pages`; then the main city and a work branch's city on the phone, the
  gestures, ⟳ without a new download, the offline open)
  and **M10** (`docs/mobile/WP/M10.md` → "Telefonon ellenőrizni": the permission asked in context, a failing Actions
  run ringing within 15 minutes and silenced by its channel, green after red, a review request, the tap marking the
  thread read on github.com, a new release, `relay-notify.js` ringing at once on the same WiFi, a board file from the PC)
  and **M7** (`docs/mobile/WP/M7.md` → "Telefonon ellenőrizni": the research matrix on the Redmi, and Pixel / Sony if
  at hand: the tethering settings link and states, Helyi WiFi, the usage figures and the once-a-day warning, the HID row,
  and the phone relay with Kódváros / the Planner pairing by code, Légegér on it, and 10 minutes with the screen off)
  and **M18** Archívum (`docs/mobile/WP/M18.md` → "Telefonon ellenőrizni": built 2026-11-11, D-13; needs `Archive/`
  on `main` first; ⟳, list → entry → ▶, Back through all three, claude.ai ↗ in the browser, offline open;
  `node Mobile/tests/archive-phone.js` is its headless 375 px check).
