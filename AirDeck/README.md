# VRG Légegér (AirDeck): the phone as a gyro air mouse and app controller

One Android app with two jobs:

1. **On any computer it is a gyro air mouse, keyboard and media remote.** It uses Bluetooth HID, so
   nothing is installed on the PC. Windows, a TV box or a Pi see an ordinary mouse.
2. **For the Planner and Kódváros it is a controller.** It connects over WiFi to the existing phone
   relay (`Planner/projects/varler-planner/tools/phone-relay-server.js`, START.cmd → **G**). The phone
   follows whichever of the two apps is focused on the PC and switches its layout to match.

Each half works without the other. A phone whose maker removed the HID profile is still a full
Planner/Kódváros controller, and a laptop with no relay still gets a mouse.

```
                ┌──────────── Bluetooth HID ────────────►  any PC: mouse · keyboard · media keys
 phone ─────────┤
 (gyro, touch,  └──── WiFi ws:// ──► relay :47291 ──┬──►  Planner   (07a-link.js, role 'planner')
  volume keys)                       (routing, focus,└──►  Kódváros  (36-link.js,  role 'codecity')
                                      roster, replay)
```

## What the phone does

| Control | General (any PC) | Planner | Kódváros |
|---|---|---|---|
| **TARTSD · MUTAT** (clutch, hold) | gyro moves the cursor | gyro moves the cursor | gyro moves the cursor |
| **Rögzít** (latch) | clutch stays on | ← | ← |
| **BAL / JOBB**, volume − / + | left / right mouse button (held = drag) | ← | ← |
| Pad, one finger | mouse | pan (old phone page) | pan |
| Pad, two fingers | scroll · tap = right click | pinch zoom | pinch zoom · drag orbits |
| Pad, double tap | double click | view reset | Land home |
| Tool pad | — | **the Planner's own tools, from its hello** | **the lenses 1–6, from its hello** |
| Extras row | back, forward, desktop, F11, play | ⌘K, Enter, Del, 2D↔3D, save | Land, roads, compare base, ⌘K, search |
| Bottom row | Esc, Alt+Tab (hold-walk), Win, Enter | undo, redo, view reset, Esc | commit −1, play, +1, latest |
| 🧭 **Kamera** | — | gyro → plan camera (old 🧭) | gyro → orbit, relative to where it was switched on |
| ⇆ **hold + roll the phone** | scroll wheel | undo / redo history | step through commits |
| Wrist **flick** ←→↑↓ | Alt+←/→, Win+Tab, Win+D | undo, redo, reset, Esc | commit −1/+1, Land, Esc |
| ⌨ sheet | type text (HU/US layout), shortcut chips, media keys | + "key into the app" (old ⌨ dialog) | ← |
| ⚙ sheet | pair, reconnect, sensitivity, deadzone, smoothing, accel | relay URL, **network search**, follow focus | ← |

The header shows two links: **BT** (green = connected to a PC) and **RELÉ** (blue = apps on the
line). The target chip says what the phone is aimed at. ◎ means it follows the PC's focus. Tap the
chip to pin a target with ⚲.

## Everything from the old phone relay is kept

`Planner/projects/varler-planner/mobile/phone-sender.html` still works unchanged. The app carries
over all of its features:

| phone-sender.html (2.0-b) | Légegér |
|---|---|
| 2.0 envelope `{v,from,seq,t,type,payload}`, `hello` with caps | same envelope (`core/Protocol.kt`), plus optional `to` |
| tool pad built from the Planner's hello `tools` | same, for every app on the relay |
| state strip (mode · szint · h · ⌀ · cable · 2D · 🔒) | same bits (`Profiles.stateBits`) |
| ↶ ↷ ⌂ buttons → `edit.undo` / `edit.redo` / `view.reset` | Planner bottom row and flicks |
| pad: one finger pan, pinch zoom, double tap reset → `gesture` | pad in KAMERA mode |
| 🧭 gyro → `orientation` (pitch 5..90, yaw 0..360, 30 Hz) | 🧭 Kamera, same convention (`Pose.fromAndroid`) |
| ⌨ key + Ctrl/Shift → `keys` | ⌨ sheet, last section (+ Alt) |
| ⚙ relay address, stored | ⚙ relay URL, stored, plus **Keresés** (asks `/whoami` across the /24) |
| reconnect every 2 s, connection dot | same, plus 15 s pings |
| nack shown as a note | same |
| wake lock | "Képernyő ébren tartása" |
| gyro dead over plain http:// (no secure context) | gone: a native app reads the sensors directly |

## The relay protocol additions (backwards compatible)

`phone-relay-server.js`, see the 27 Oct note in its header:

- **`to`**: `{..., to:'codecity'}` reaches only that role. Without `to`, routing is unchanged, except
  that two *app* roles no longer feed each other. Without this, Kódváros's hello would become the
  Planner's peer.
- **`focus`**: an app sends `{type:'focus', payload:{app,title}}` when its window gains focus. The
  relay remembers the last one and passes it to the phones.
- **`roster`**: on every hello and close, phones get `{from:'relay', type:'roster',
  payload:{peers, focus}}`.
- **hello replay**: each app's last hello is replayed to a phone that connects later. Before this, a
  phone that joined after the Planner never got its tool table.
- `/whoami` is `v: 3` and also reports `roster` and `focus`.

App side: the Planner (`src/07a-link.js`) now sends `focus`. Kódváros gets
`CodeCity/src/36-link.js`, which finds the relay on 127.0.0.1:47291..47298 by itself and maps the
phone's commands, gestures, orientation and keys onto the city.

## Launchers

- **Planner\START.cmd → A)** opens the Légegér submenu: start the relay (in its own window), build the
  APK, install it with adb, run the core tests, run the e2e test, open Android Studio, the README and the
  folder.
- **VRG-DE.cmd → D6** (UNDER-DEV) has the same actions inside the project's submenu.

Both call **`AirDeck\legeger.cmd`**, which holds the actions in one place (`legeger.cmd build`, `install`,
`test`, `relay`, `e2e`, `studio`, `readme`, `folder`; with no argument it shows its own menu). It finds
Android Studio's bundled JDK, and if `local.properties` is missing it writes it from
`ANDROID_HOME`, `ANDROID_SDK_ROOT` or `%LOCALAPPDATA%\Android\Sdk`.

## Build and install

Requires Android Studio (or a JDK 17+ and the Android SDK 35) and a phone with Android 9+ and a gyro.

```bash
cd AirDeck/android
./gradlew :core:test            # protocol, HID reports, HU/US layouts, gyro maths (no SDK needed)
./gradlew assembleDebug         # -> app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

On Windows, use `gradlew.bat`. The SDK location goes in `local.properties` (`sdk.dir=...`), which
Android Studio writes on first open. That file and `build/` are gitignored. Opening `AirDeck/android`
in Android Studio is the simplest route: it installs the SDK and builds with ▶.

### First run

1. **Bluetooth**: allow the permissions. On the PC open Settings → Bluetooth → *Add device*, and pick
   the phone. If the phone is not listed, use ⚙ → *Láthatóvá tesz*. Once paired, the PC shows it as
   a mouse and keyboard and the BT pill turns green. If the phone was paired with this PC *before*
   the app ran, remove it on the PC and pair again, because Windows caches the old record without HID.
2. **Relay**: on the PC, START.cmd → **G**. Then on the phone, ⚙ → *Keresés a hálózaton*. You can
   also scan the Planner's "Telefon csatlakoztatása" QR and choose Légegér, or type the address. The
   phone and the PC must be on the same WiFi.
3. Open the Planner or Kódváros (START.cmd → 11). The phone switches layout when you click into
   either window.

## Files

```
AirDeck/
  android/
    core/        pure Kotlin, unit-tested: Protocol.kt · Hid.kt (descriptor + reports) · Keys.kt
                 (chords, HU/US layouts) · Motion.kt (AirPointer, FlickDetector, Scrubber, Pose) · Profiles.kt
    app/         Android: Deck.kt (the engine) · hid/HidPeripheral.kt · motion/MotionSource.kt ·
                 relay/RelayClient.kt, Discovery.kt · DeckService.kt · ui/ (Compose) · ui/theme/Melyviz.kt
  tests/relay-e2e.js   relay + real Kódváros page (headless Chromium) + fake Planner + fake phone
```

## Style: Mélyvíz

The Mélyvíz reference artifact could not be opened from the session that built this (its link did
not resolve for this account). The theme is therefore a **"deep water" reading of the name**: abyss
background, blue-green depths for surfaces, thin current lines, and one bioluminescent cyan accent
for anything live. **All of it lives in one object, `app/.../ui/theme/Melyviz.kt`.** To match the
reference exactly, change the colour, radius and type values there. No other file has a colour.

## Verified, and what still needs a real phone

Checked in a Linux container, without the Android Gradle Plugin (its download was blocked there):

- `:core:test`: 18 tests (envelope, parsing, HID descriptor balance and sizes, HU/US typing, motion
  maths, URL normalising).
- Every app source except `MainActivity.kt` type-checks against the Android 15 framework jar and
  Compose 1.7. `MainActivity` uses AndroidX Activity, which could not be fetched there.
- `tests/relay-e2e.js`: 15 checks, all green.
- The Planner's `npm test`: 3736 assertions, golden renders byte-identical.

Not yet verified, and needs the real device: the first full `assembleDebug`, pairing with Windows,
the gyro feel and its default tuning, and the volume-key clicks.

Known limits: iPhone cannot be a Bluetooth HID device (iOS has no API for it), so the relay half
would be the only option there. Some Android builds disable the HID Device profile; the BT pill then
reads "nem támogatott". Typed text follows the layout set in the ⌨ sheet, so it must match the PC's.
