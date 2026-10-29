# VRG Légegér (AirDeck), the first feature of VRG Mobile: the phone as a gyro air mouse and app controller

One Android app with three jobs:

1. **On any computer it is a gyro air mouse, keyboard and media remote.** It uses Bluetooth HID, so
   nothing is installed on the PC. Windows, a TV box or a Pi see an ordinary mouse.
2. **On another smartphone it is a touchscreen** (phone mode). The same Bluetooth link also carries a
   two-finger touch digitizer, so a finger on the pad lands on the other phone's screen as a real
   touch, with Back, Home, Recents and Notifications on buttons.
3. **For the Planner and Kódváros it is a controller.** It connects over WiFi to the existing phone
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

## Phone mode: controlling another smartphone

Pair the target phone with this one, the same way as a PC (Bluetooth → new device). When the host
reports itself as a phone, the deck switches to **TELEFON** by itself (⚙ → "Telefon mód magától").
You can also pin it from the target chip.

- **Pad = its screen.** In ÉRINTÉS mode the pad shows a phone-shaped frame (aspect set in ⚙ →
  Érintőpad). Every finger, up to two, is sent as a contact of a HID multi-touch digitizer at the
  same place in that frame. Taps, long presses, scrolling, dragging, pinch-zoom and the phone's own
  edge gestures (gesture navigation) all behave natively, because the target sees a touchscreen, not
  a mouse. Each finger shows a glowing dot on the pad.
- **EGÉR** mode on the same pad gives Android's mouse pointer instead, and the gyro clutch still
  points.
- Bottom row: ◁ Back (HID consumer AC Back) · ○ Home (AC Home) · ▢ Recents (Meta+Tab) · 🔔
  notifications (Meta+N). Extras: screenshot (SysRq; the picture stays on that phone), volume,
  play, search, screen on/off.
- 3-finger swipes: ← back · → recents · ↑ home · ↓ notifications; 3-finger tap is a screenshot.
- iPhones ignore HID digitizers. Against an iPhone, use EGÉR mode with AssistiveTouch.
- The touchscreen is a new part of the Bluetooth descriptor, and hosts cache the descriptor when they
  pair. A PC or phone paired with the first version must **forget the phone and pair again** before
  it sees the touchscreen.

## Screen gestures on the pad (every mode)

| Gesture | General / Planner* / Kódváros* / Prezentáció* | Telefon |
|---|---|---|
| 3 fingers ↑ ↓ ← → | task view · desktop · previous / next window (Windows defaults) | home · notifications · back · recents |
| 3-finger tap | search (Win+S) | screenshot |
| 4 fingers ← → ↑ ↓ | virtual desktop ← → · full screen · minimise | volume ↑ ↓ |
| 4-finger tap | notifications | play / pause |
| Swipe in from the left / right edge strip | task view · quick settings | back |
| Pinch (EGÉR mode) | Ctrl+wheel: zoom in any PC app | (native pinch in ÉRINTÉS) |

\* Each app overrides the 3-finger set with its own actions (Planner: undo / redo / view / Esc /
palette; Kódváros: commit −1 / +1, Land, Esc, palette; Prezentáció: slides, black screen, laser).
The pad shows a cheat sheet for the current target. Gestures and edge strips can be turned off.

## Customising the deck

- **Palette**: six variants of Mélyvíz in ⚙ → Megjelenés. The default is Mélyvíz. Mélytengeri árok is
  pure black for OLED screens (the screen is kept on, so this saves battery). The others are
  Korallzátony, Éjféli lagúna, Moszaterdő, and Sekély víz, the light one for daylight. Changing it
  recolours everything live, the system bars included. There is also a UI size slider (0.8–1.3×).
- **Screen elements**: every part of the deck can be switched on or off in ⚙ → Képernyő elemei:
  status pills, readout, tool pad, extras, macro row, touchpad, mouse button row, bottom row and
  messages. A **left-handed** switch mirrors the BAL · MUTAT · JOBB row.
- **Macros** (⚙ → Makrók, or ✎ on the macro row): a small script, one step per line or separated
  by `;`.

  ```
  Ctrl+S; wait 250; cmd view.reset        key chord, pause, Planner command
  type Szia!                              typed text
  app Ctrl+K · media play · click right · wheel -3 · shot
  ```
  The editor checks the script as you type and names the line it cannot read. You can pin macros
  (⚲) onto the deck's macro row. Tap a running macro to stop it.

## Screenshots onto the phone

📸 in the header (and on each app's extras row) asks the relay for a capture of the PC. On Windows
it uses PowerShell with System.Drawing, and is DPI-aware, so a 150% display comes out at its real
pixels. You can capture either the whole screen or the active window (⚙ → Képernyőkép). The picture
downloads straight away and opens in a sheet. From there you can **save it to the Gallery**
(Pictures/VRG Legeger), **share it** to any app, take a new one, or pick an earlier one from the
strip.

Because anyone on the WiFi could otherwise ask to see the screen, the relay only captures when
started with **`--shots`**. `mobile.cmd → 1` starts it that way; START.cmd → G does not. Captures are
served under random 128-bit names for 10 minutes and logged on the relay console. Only a client that
introduced itself as a phone may ask, and only that phone receives the answer.

## More that the deck does

- **Prezentáció** target: PageUp / PageDown on wrist flicks and 3-finger swipes, black and white
  screen, F5 / Shift+F5, and Ctrl+L for PowerPoint's laser pointer, driven by the gyro clutch.
- **Fine aim**: rest a finger on the pad while holding MUTAT and the pointer drops to 30% speed
  with no acceleration.
- **🎤 Diktálás** (⌨ sheet): the phone's speech recogniser (Hungarian when the layout is HU), and the
  text is typed into the PC.
- **📋 Vágólap begépelése**: whatever was copied on the phone, typed into the PC.
- **Face down = pause**: laying the phone screen-down on the table sends play/pause once. Off by
  default; turn it on in ⚙ → Egyéb.

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
- `/whoami` is `v: 3` and also reports `roster`, `focus` and whether `shots` are on.
- **`screenshot.request`** (`to:'relay'`, phones only, needs `--shots`): the relay captures the PC
  and answers `{type:'screenshot', payload:{ok, url:'/shot/<hex>.png', name, bytes}}` to the asking
  phone. `GET /shot/<hex>.png` serves it for 10 minutes. `RELAY_SHOT_FILE=<png>` stands in for the
  capture, for tests.

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
cd Mobile/android
./gradlew :core:test            # protocol, HID reports, HU/US layouts, gyro maths (no SDK needed)
./gradlew assembleDebug         # -> app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

On Windows, use `gradlew.bat`. The SDK location goes in `local.properties` (`sdk.dir=...`), which
Android Studio writes on first open. That file and `build/` are gitignored. Opening `Mobile/android`
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
    core/        pure Kotlin, unit-tested: Protocol.kt · Hid.kt (descriptor, reports, touchscreen) · Keys.kt
                 (chords, HU/US layouts) · Motion.kt (AirPointer, FlickDetector, Scrubber, Pose, FaceDown) ·
                 Gestures.kt (pad gestures, pinch zoom) · Macros.kt (script, storage) · Profiles.kt (5 targets)
    app/         Android: Deck.kt (the engine) · ShotStore.kt · Settings.kt · hid/HidPeripheral.kt ·
                 motion/MotionSource.kt · relay/RelayClient.kt, Discovery.kt · DeckService.kt ·
                 ui/ DeckScreen · Controls (touchpad) · Sheets (keyboard) · SettingsSheet · MacroSheet ·
                 ShotSheet · theme/Melyviz.kt (palettes)
  tests/relay-e2e.js   relay + real Kódváros page (headless Chromium) + fake Planner + fake phone
```

## Style: Mélyvíz

The Mélyvíz reference artifact could not be opened from the session that built this (its link did
not resolve for this account). The theme is therefore a **"deep water" reading of the name**: abyss
background, blue-green depths for surfaces, thin current lines, and one bioluminescent cyan accent
for anything live. **All of it lives in `app/.../ui/theme/Melyviz.kt`.** It holds the six palettes
as plain data, and `Melyviz` reads the current one from Compose state. To match the reference
exactly, edit the `MELYVIZ` palette there. No other file has a colour.

## Verified, and what still needs a real phone

Checked in a Linux container, without the Android Gradle Plugin (its download was blocked there):

- `:core:test`: 29 tests. They cover the envelope and parsing, the HID descriptor (4 report ids,
  balanced) and sizes, touch reports and frame mapping, HU/US typing, motion maths, pad gestures
  and pinch, the macro script and its storage, face-down, the screenshot protocol and URL
  normalising.
- Every app source type-checks against the Android 15 framework jar and Compose 1.7. AndroidX
  Activity/Core could not be fetched there, so their few calls (`registerForActivityResult`,
  `setContent`, `FileProvider`, `WindowCompat`) were checked against stand-in signatures.
- `tests/relay-e2e.js`: 20 checks, all green. They include the screenshot path: only phones may ask,
  the PNG downloads byte for byte, a guessed name gets a 404, and the answer goes to the asker only.
- The Planner's `npm test`: 3736 assertions, golden renders byte-identical.

Not yet verified, and needs the real device: the first full `assembleDebug`, pairing with Windows,
the gyro feel and its default tuning, and the volume-key clicks. Phone mode needs a real Android
target: the digitizer descriptor follows the HID multi-touch spec, but every vendor's input stack
should be tried once. The same goes for the Meta+Tab / Meta+N shortcuts, which some launchers
ignore, and for the PowerShell capture on the actual PC.

Known limits: iPhone cannot be a Bluetooth HID device (iOS has no API for it), so the relay half
would be the only option there. Some Android builds disable the HID Device profile; the BT pill then
reads "nem támogatott". Typed text follows the layout set in the ⌨ sheet, so it must match the PC's.
