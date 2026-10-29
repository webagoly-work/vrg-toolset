# VRG Mobile: the companion app

One Android app for the phone side of the VRG work. It grows by **features**. Each one is a
Gradle module that plugs into a shared shell, uses the shared Mélyvíz design system, and appears as a tile
on the home screen. The first feature is **Légegér** (the gyro air mouse, keyboard, touchscreen and
Planner / Kódváros controller, formerly AirDeck; its manual is [docs/legeger.md](docs/legeger.md)).
The rest of the roadmap is already on the home screen as planned tiles, each naming the work package that
builds it.

The plan, the decisions and the work packages are in [`docs/mobile/`](../docs/mobile/README.md); a cloud
session starts from [`GO-MOBILE.md`](../GO-MOBILE.md).

```
Mobile/
  mobile.cmd            build · install · test · relay · e2e · studio (START.cmd A, VRG-DE.cmd D6)
  docs/legeger.md       Légegér's manual
  tests/relay-e2e.js    relay + real Kódváros page + fake Planner + fake phone
  tests/relay-pair.js   QR pairing against a real relay: codes, P-256 signatures, the trust gate
  android/
    kit-core/           pure Kotlin: Feature catalogue (Feature.kt), link routing (Links.kt),
                        shell settings rules (ShellPrefs.kt), the log buffer (LogBook.kt),
                        relay pairing: address, QR offer, signature, messages (Pairing.kt) + tests
    kit/                Android: Mélyvíz theme (theme/Melyviz.kt), the feature contract (VrgFeature.kt),
                        ShellSettings (look, start screen, paired PCs, relay), VrgLog, shared parts (ui/Parts.kt),
                        relay/ Relay (the app's one relay link + trust), PhoneKey (Keystore P-256), Discovery
    app/                the shell and the APK (hu.vrg.mobile): ShellActivity · HomeScreen · Registry
    feature-airdeck/    Légegér (package hu.vrg.legeger): Deck engine, HID, relay client, deck UI
    feature-settings/   Beállítások (WP M1): Megjelenés · Indulás · Párosított PC-k · Névjegy · Napló
    feature-pair/       QR párosítás (WP M2): CameraX + ML Kit scanner, vrg://pair links, the result
    airdeck-core/       Légegér's pure Kotlin: protocol, HID reports, layouts, gyro maths, macros
```

## How the pieces fit

- **`Catalogue`** (kit-core) lists every feature as data: id, title, blurb, glyph, group, stage
  (Kész / Teszt / Terv), the WP that builds it, and what it needs (Bluetooth, relay, internet, GitHub,
  camera). The home screen, the WP numbering and the tests all read it.
- **`VrgFeature`** (kit) is the contract. A feature provides `Screen(host)` and optionally handles `open(route)`
  for links, `onKey` for hardware keys and `onForeground`. **`FeatureHost`** is what the shell gives back:
  the Activity, `keepScreenOn`, `home()`, `open(id)` and `note(text)`. Window-wide state goes through
  the host and is undone when the feature leaves.
- **`Registry`** (app) lists the features built into this APK. A catalogue entry with no registry line
  shows as a plan.
- **`Links`** (kit-core) routes every link to a feature. The links are `vrg://<feature>/...` (the app's own), `vrgdeck://connect?ws=…`
  (Légegér's original link) and `http://<pc>:47291/phone-sender.html` (the Planner's phone QR).
- The app opens where you left it. A Légegér user lands straight on the deck, and Back goes to the home screen.

## Build

```bash
cd Mobile/android
./gradlew :kit-core:test :airdeck-core:test   # pure Kotlin tests, no Android SDK
./gradlew assembleDebug                       # -> app/build/outputs/apk/debug/app-debug.apk
VRG_JVM_ONLY=1 ./gradlew :kit-core:test :airdeck-core:test   # never touches Google's Maven (cloud)
```

On Windows, `Mobile\mobile.cmd` does all of this. It finds a JDK, writes `local.properties` and works
behind an HTTPS-scanning antivirus. GitHub Actions builds the APK on every push that touches `Mobile/`
(`.github/workflows/mobile-android.yml`, installed from `Mobile/ci/mobile-android.yml`), and the APK can be downloaded from the run's artifacts.

**The app id is `hu.vrg.mobile`** (decision D-1 = A). It installs beside the old `hu.vrg.legeger` APK,
whose settings do not carry over. Uninstall the old one once VRG Mobile works.
