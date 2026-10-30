# VRG Knob Pad — agent init
*For a Claude Code session that will work on VRG Knob Pad. Read this, then the files in §3.*

## 1. What it is
Three rotary knobs that act as a USB keyboard / mouse / media keys on the PC, plus a config page on
the home Wi-Fi at http://vrg-knobs.local. ESP32-S3-Zero firmware (Arduino).

## 2. Where
- `Firmware/knobpad/`: `knobpad.ino`, `config.h`, `webpage.h`, `mock-server.js`.
- Toolchain: `H:\VRG\Full\tools\arduino-cli` (portable, configured by its `arduino-cli.yaml`).
- No launcher entry — — (nincs leírva).

## 3. Read first
1. `Firmware/knobpad/README.md`
2. `Firmware/knobpad/config.h`
3. `BRIDGE/04_related-hardware/EXPLORE-001_mapper-deck-control.md` (the plan it is step 1 of)

## 4. Build / test / check
- Compile: the exact `arduino-cli ... compile -b "esp32:esp32:esp32s3:..."` line in README
  "Command-line build"; add `-u -p COM<n>` to upload.
- Page without hardware: `node Firmware/knobpad/mock-server.js` → http://localhost:8177

## 5. Rules and traps
- Tools: USB Mode = USB-OTG (TinyUSB) or the sketch refuses to compile (README "Arduino IDE setup").
- Power every module from 3V3, not 5V; never use G19/G20 (USB) or G26–G37 (flash/PSRAM) (README "Wiring").
- The two displays share an address, so each has its own I²C bus (README "Wiring").
- Over 89 % of the app partition: if it outgrows it, use *Minimal SPIFFS* (README).
- Set `WEB_PASS` / `OTA_PASSWORD` in `config.h` before relying on the page or OTA (README "Options").

## 6. Current state
- 2026-10-13 Firmware: VRG Knob Pad v1 (ESP32-S3-Zero, 3 encoders, USB-HID + web config)
- README: compiles cleanly, not yet flashed or run on hardware. Next: Claude Code status LED, TM1638
  panel. Decision files: none.

## 7. Do not touch
— (nincs leírva)

Forrás: Firmware/knobpad/README.md, git log main, 2026-10-22
