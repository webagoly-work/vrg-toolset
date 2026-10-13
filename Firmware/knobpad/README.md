# VRG Knob Pad v1

Three rotary knobs that act as a USB keyboard / mouse / media keys on the PC, plus a config page
on the home Wi-Fi at **http://vrg-knobs.local**. BuildTree variant: *Enkóder-pult v1*.
Step 1 of the hardware line in `BRIDGE/04_related-hardware/EXPLORE-001_mapper-deck-control.md`.

**Status (2026-10-13): compiles cleanly (no warnings), not yet flashed or run on hardware.**
Built with arduino-cli 1.5.1, esp32 core 3.3.12, ESP32Encoder 5.0.0, U8g2 2.36.19,
WiFiManager 2.0.17: 1 167 035 bytes = 89 % of the default 1.25 MB app partition, 88 KB RAM.
The web page was checked in a browser against `mock-server.js`.

If the sketch outgrows the partition, choose *Minimal SPIFFS (1.9MB APP with OTA)* under
Tools > Partition Scheme (`PartitionScheme=min_spiffs`).

## Command-line build (portable toolchain on H:)
arduino-cli and the whole ESP32 toolchain (~8.5 GB) live in `H:\Dev-VRG\VRG-DE\_libs\arduino-cli`,
configured by `arduino-cli.yaml` there so nothing lands on C:.

```bash
H:/Dev-VRG/VRG-DE/_libs/arduino-cli/bin/arduino-cli.exe --config-file H:/Dev-VRG/VRG-DE/_libs/arduino-cli/arduino-cli.yaml compile -b "esp32:esp32:esp32s3:USBMode=default,CDCOnBoot=cdc,FlashSize=4M,PSRAM=enabled" --output-dir H:/Dev-VRG/VRG-DE/_libs/arduino-cli/build/knobpad Firmware/knobpad
```

Add `-u -p COM<n>` to upload over USB (`arduino-cli board list` shows the port).

## Parts (all owned, see BuildTree)
- ESP32-S3-Zero Mini (brain; its single USB-C is the native USB port)
- 1× EC-11 encoder module, 2× 1.3" OLED + EC11 module (SH1106, I²C 0x3C)
- Dupont wires

## Wiring (from `config.h` — check the S3-Zero silkscreen first)

| | A | B | Push | Display SDA | Display SCL |
|---|---|---|---|---|---|
| Knob 1 (EC-11 module) | G1 | G2 | G4 | — | — |
| Knob 2 (OLED module #1) | G5 | G6 | G7 | G11 | G12 |
| Knob 3 (OLED module #2) | G8 | G9 | G10 | G13 | G14 (or G3) |

- Power every module from **3V3**, not 5V, so the encoders' pull-ups pull to 3.3 V.
- The two displays have the same address, so each gets its own I²C bus (`Wire` and `Wire1`).
- Never use G19/G20 (USB) or G26–G37 (flash/PSRAM).

## Arduino IDE setup
1. Boards Manager: **esp32 by Espressif** (3.x). Board: *ESP32S3 Dev Module* (or the Waveshare
   S3-Zero entry if present).
2. Tools: **USB Mode = USB-OTG (TinyUSB)** — the sketch refuses to compile otherwise.
   **USB CDC On Boot = Enabled**. Flash size 4 MB, PSRAM *QSPI* — the Waveshare S3-Zero normally
   carries the ESP32-S3FH4R2 (4 MB flash, 2 MB PSRAM); check the chip marking if unsure.
3. Library Manager: **ESP32Encoder** (madhephaestus), **U8g2** (olikraus), **WiFiManager** (tzapu).
4. First upload over USB. If the port does not appear: hold **BOOT**, tap **RESET**, release BOOT,
   upload, then tap RESET.

## First boot
1. The knobs work at once over USB, with or without Wi-Fi.
2. On the phone, join the Wi-Fi network **VRG-Knobs-Setup**, pick the home network, type its
   password. The pad restarts and joins it (2.4 GHz only).
3. Open **http://vrg-knobs.local**; if the name does not resolve (some Android phones), use the
   IP shown at the bottom of display 2. Reserving that IP in the router is worth doing.

## Default mapping
| Knob | Turn | Push |
|---|---|---|
| 1 | volume | mute |
| 2 | scroll | play / pause |
| 3 | F13 / F14 | F15 |

F13–F24 exist on no normal keyboard, so nothing else uses them: map them freely in AutoHotkey or
in a program's own shortcut settings. Change any mapping on the web page; it is saved in the pad
and survives power loss.

## HTTP API (for VRG tools)
CORS is open, so a VRG HTML page opened from `file://` can call these with plain `fetch`.

| Call | Does |
|---|---|
| `GET /state` | `{"fw","host","ip","enc":[{"count","last","rot","press"}×3]}` |
| `POST /set?enc=1..3&rot=<id>&press=<id>` | change and save a mapping; returns the new state |
| `POST /wifi-reset` | forget Wi-Fi, restart into setup mode |

Turn ids: `none vol scroll hscroll zoom arrow_ud arrow_lr track bright f13_14 f15_16 f17_18 f19_20 f21_22 f23_24`.
Push ids: `none mute play next prev enter esc f13 … f24`.

## Options in `config.h`
- `WEB_PASS` — set it to put a password on the page and `/set` (user `vrg`).
- `OTA_PASSWORD` — after the first USB upload, new firmware can go over Wi-Fi (Arduino IDE shows
  `vrg-knobs` as a network port). Set a password before relying on it.
- `ENCx_REVERSE` — flip a knob that turns the wrong way.
- `COUNTS_PER_DETENT` — 2 for most EC11s; 4 if one click sends two steps, 1 if two clicks send one.

## Trying the page without hardware
```
node Firmware/knobpad/mock-server.js
```
Then open http://localhost:8177. It serves the real page from `webpage.h` with a fake knob 1.

## Next steps
- Claude Code status LED: the S3-Zero's onboard RGB LED driven by a `/led` call from Claude Code
  hooks (step 3 of the plan).
- TM1638 + LED-button panel (BuildTree variant *Kétirányú asztali panel*).
