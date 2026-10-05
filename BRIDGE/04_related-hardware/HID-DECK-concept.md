# HID DECK — three-device tandem controller system

*Working document. Names are placeholders. Status: concept locked enough to prototype, details open.*

---

## 1. The idea in one paragraph

Three devices that are useful alone and better together. A **BASE** that is a dock, hub, power source and PC bridge. A **SCREEN unit** (CYD-based) with touch, gyro, gestures and a live UI. A **GRIP unit**, a composite HID handheld built for one-handed use that scales up to two-handed. Docked into the BASE on a tilted ~15×15–20×20 cm baseplate, the three form a desktop macropad / cyberdeck. Undocked, they are two independent portable controllers that keep working over wireless, through the BASE or directly.

---

## 2. Why this split is the right one

The word cloud has three distinct jobs hiding in it, and they want different hardware:

| Job | What it needs | Device |
|---|---|---|
| Be seen and touched — UI, menus, gestures, feedback | Display + touch + IMU, no USB needed | **SCREEN** |
| Be gripped and felt — sticks, keys, encoder, blind operation | Analog inputs + ergonomics + low latency | **GRIP** |
| Be the infrastructure — power, network, USB, storage, translation | Linux-class SBC + radios + USB host and device | **BASE** |

Key architectural consequence: **the BASE is the USB HID front-end for the whole system.** The CYD's classic ESP32 has BLE but no native USB, so it can never be a USB HID device on its own. Instead of fighting that, the BASE terminates USB. Both portable units speak wireless to the BASE, and the BASE presents one clean composite HID device to the PC. When the BASE is out of the picture, each unit falls back to its own BLE HID profile.

---

## 3. The three devices

### 3.1 BASE — dock, hub, bridge

**Roles:** docking station · power · hotspot and offline LAN · local host · USB HID/BLE aggregator · USB mass-storage port · ESP flasher · PC link (wired + wireless).

**Suggested build:** a Linux SBC (Pi Zero 2 W for minimal, CM5 if it should grow into a real workstation companion) **plus an ESP32-S3 co-processor**. The SBC handles hotspot/LAN, local web app, storage, flashing and the Claude Code style interface. The S3 handles ESP-NOW to the portables, BLE central duty, and can be the USB HID gadget if the SBC's USB gadget mode turns out to be inconvenient. Two chips, clean division: **Linux for services, ESP for radios and real-time input.**

**Ports and power:**
- USB-C in (PD) → charges BASE and both docked units through the bays
- USB-C to PC (data) → composite HID device + serial/config channel
- USB-A host → USB sticks, USB HID devices to be re-broadcast, ESP boards being flashed
- Two dock bays with pogo pins or a short retained USB-C each

**Why it earns its place:** the BASE is the only thing that can make the portables appear to the PC as one device, keep them charged, and give them a network when there is no network.

### 3.2 SCREEN — CYD touch/gyro companion

**Base hardware:** a Cheap Yellow Display board (ESP32-2432S028R class: 2.8" ILI9341 + touch), with an IMU (MPU6050 / ICM-42688) added on the free I²C header. Battery + charger in the shell.

**Roles:** companion screen · gesture and air-gyro input · UI for everything else · BLE HID keyboard/mouse/consumer control in standalone mode.

**Notes and constraints:**
- CYD free GPIO is scarce; plan the IMU and any extra buttons around the exposed connectors before committing to a shell.
- Classic ESP32 = BLE HID only. USB is serial-to-PC, not HID. Route USB HID through the BASE.
- Resistive touch is fine for buttons and sliders, weak for multi-touch gestures. Gestures should live mostly in the IMU (tilt, flick, hold-to-aim), not the panel.

### 3.3 GRIP — composite HID handheld

**Base hardware:** ESP32-S3, because it is the only relevant part that does BLE **and** native USB HID, so the GRIP stays useful even without the BASE.

**Inputs:** one PS-style thumbstick (primary, thumb-reachable), 4–8 hot-swap keys, EC11 encoder, shoulder/trigger key, optional second stick, IMU for hold-to-aim, small OLED or just RGB for layer state, optional haptic.

**One-handed first:** every core function must be reachable with one hand. Two-handed mode is an *addition* — the second hand takes the encoder, the extra key cluster, or the second GRIP if you ever build two.

**Outputs:** USB composite HID (keyboard + mouse + gamepad + consumer) when plugged in, BLE HID when free, ESP-NOW to the BASE when docked or in range.

### 3.4 Optional compute core — embedded Android phone (Sony Xperia)

*Optional, additive. It does not replace the SCREEN unit and it does not replace the S3. It sits inside the BASE as a compute and services board that happens to have been a phone.*

**What it contributes:** a multi-core ARM SoC with several GB of RAM, real storage, a Wi-Fi radio that can run a genuine hotspot, Bluetooth, optionally LTE with a SIM, and a Linux userland through Termux. That is what turns the BASE from a controller hub into a small computer, without sourcing an SBC.

**Role split stays clean, now three layers:**

| Layer | Hardware | Owns |
|---|---|---|
| Real-time | ESP32-S3 | USB HID to PC, ESP-NOW, docking, power management, wake |
| Compute | Xperia | Local host, web app, storage, coding companion, network services, LTE |
| Interface | SCREEN / GRIP | Everything the hands and eyes touch |

**What the phone cannot do, and why the S3 stays:** a stock Android phone cannot present itself to a PC as a USB HID keyboard or gamepad. USB gadget HID needs root and kernel configfs support that stock ROMs don't expose. The phone is also non-deterministic — Android suspends processes and juggles power at will. So HID termination and anything latency-critical stay on the S3, exactly as designed. The phone is reachable over USB serial (OTG/CDC) or over the local network.

**Power — the part that needs real design work.** A degraded battery embedded in a sealed enclosure and kept permanently at 100 % is the main risk in this whole build: heat, swelling, and a fire hazard behind a plate you don't open often.

- A fresh replacement battery for an older Xperia is cheap and is the simplest fix. Do this first.
- Running with no battery usually fails: many phones refuse to boot, and those that do can brown out on radio current spikes. A "battery eliminator" or dummy-cell board is a maybe, not a plan.
- Keep the cell in a cycled charge window (roughly 40–80 %) instead of a permanent float. The S3 can own this: read battery level from the phone, switch charge current with a MOSFET or relay, log it. That is a genuinely useful BASE feature, not a workaround.
- Give it a vent path and a metal contact to the baseplate. Passive is probably enough at idle, but measure before sealing.

**One USB port, two needs.** The phone has a single USB-C port and will need to be charged *and* to host peripherals. That requires a powered OTG hub with accessory-charging passthrough, and support for it varies by model and Android version. Verify with the actual phone before committing to a layout.

**Services it can realistically run:**
- Local web app and configurator (Termux + Node or Python), reachable at the BASE's hotspot address
- File store for firmware images, macros, profiles, project files
- SSH endpoint, so the BASE is a thing you log into
- Coding-companion / Claude Code style interface — this is the role that most wants the phone rather than a microcontroller
- Hotspot and offline LAN; LTE fallback if a SIM goes in
- ESP flashing over OTG serial — workable through USB-serial Android apps, rougher than doing it from a real Linux box, so keep an S3-based fallback path

**Physical:** mount it flat under the tilted baseplate, screen down or screen visible through a window. Even if the SCREEN unit is the interface, an always-on phone display behind a cutout makes a decent fixed status panel — logs, network state, battery graph. Its buttons should be reachable or wired out for a hard reboot.

**Verdict:** worth doing if the coding-companion and local-host roles matter to you. If they don't, an ESP32-S3 alone covers dock, power, radios and HID, and the phone is dead weight and a thermal problem. Treat it as a swappable compute module: design the BASE bay so a Pi Zero 2 W or a CM5 could take the same slot later.

---

## 4. The three operating modes

| Mode | Layout | Transport | Feels like |
|---|---|---|---|
| **Docked** | Both units on the tilted baseplate | ESP-NOW/USB to BASE → one composite HID to PC | Desktop macropad / cyberdeck console |
| **Split** | SCREEN in one hand, GRIP in the other, BASE on the desk | Both to BASE, BASE to PC | Two-handed universal controller |
| **Solo** | Either unit alone, BASE off | Each unit's own BLE HID | Air mouse / gamepad / macropad |

Plus a **browser mode** across all three: WebHID, Web Serial and Web Bluetooth let a single-file HTML page configure and drive the system with no installed software — the same approach as the other Varler tools.

---

## 5. Word cloud → assigned home

| From the cloud | Lands on | How |
|---|---|---|
| PC/Mobile Macropad | GRIP + SCREEN docked | Composite HID via BASE, or BLE to phone |
| USB dongle | BASE (or a spare S3 stick) | Portables send ESP-NOW; dongle presents USB HID |
| Local hotspot / Local Host | BASE | AP mode + local web app, works offline |
| Wireless multinode | BASE ↔ SCREEN ↔ GRIP | ESP-NOW mesh; extra nodes join later (ESPBLOK tie-in) |
| Sniffer / Debugger / detector | BASE + SCREEN | BASE scans (Wi-Fi/BLE/ESP-NOW), SCREEN visualises |
| Coding companion / Claude Code interface | BASE (SBC) + SCREEN | BASE runs it; SCREEN is the readout; GRIP fires the macros |
| Companion Screen | SCREEN | Layer display, status, monitoring dashboards |
| ESP Flasher | BASE | USB-A host + stored firmware images; ties into VAULT plans |
| Universal Controller | GRIP | Composite HID + HA/MQTT/ESP-NOW third channel |
| Air Gyro | SCREEN (primary) + GRIP (hold-to-aim) | IMU → mouse; deadzone + fusion, not raw gyro |

Nothing in the cloud is dropped. Everything has exactly one owner.

---

## 6. Physical concept

- Baseplate 15×15 to 20×20 cm, tilted roughly 15–25°.
- Two docking bays: SCREEN upper (viewing angle), GRIP lower-right (hand rests naturally).
- Contacts: pogo pins are cleaner to dock, USB-C is easier to build. Decide after the first shell.
- BASE keeps its own key row or encoder along the front edge, so a docked BASE alone is still a usable macropad.
- Cable exit at the rear; PD input and PC link on the same edge.

---

## 7. Build order

**Phase 0 — GRIP breadboard.** S3, one stick, four keys, encoder. USB composite HID first (easiest to debug), calibration and mouse feel dialled in.

**Phase 1 — SCREEN standalone.** CYD + IMU, BLE HID mouse/keyboard, touch UI with layer pages, gyro hold-to-aim.

**Phase 2 — BASE minimal.** SBC + S3, hotspot, ESP-NOW link to both units, single composite HID out to PC. This is the moment the system becomes a system.

**Phase 3 — Dock and power.** Bays, contacts, charging, power path, tilted baseplate, printed shells.

**Phase 4 — Services.** Flasher, sniffer views, local web configurator, coding companion interface.

Each phase leaves a device that is useful on its own. Nothing is stranded if the project pauses.

---

## 8. Open decisions

- BASE compute core: embedded Xperia vs Pi Zero 2 W vs CM5 vs none (S3 only) — decided by whether the coding-companion and local-host roles are central or a bonus. Design the bay so the module is swappable either way.
- If the phone is used: new battery vs charge-cycling vs both; OTG hub with charging passthrough confirmed on that exact model; screen visible or hidden.
- Where USB HID is terminated: SBC gadget mode vs the S3 co-processor.
- Dock contacts: pogo vs USB-C.
- GRIP second stick: built in, or a snap-on module.
- Whether the portables also talk directly to each other when the BASE is off.
- Naming for all three.

---

## 9. Reference projects

### Joystick and gamepad core
1. **wolfeidau/esp32-hid-joystick** — ESP-IDF BLE HID joystick, battery powered, off-the-shelf parts. https://github.com/wolfeidau/esp32-hid-joystick
2. **ai-e2d/JoyStick** — remaps the joystick shield off ADC2 (which conflicts with Bluetooth) to ADC1 GPIO34/35, plus center calibration. Directly relevant to the PS stick modules. https://github.com/ai-e2d/JoyStick
3. **lemmingDev/ESP32-BLE-Gamepad** — Generic HID / SInput (SDL3) / XInput modes, NimBLE only. SInput gives native Steam recognition with IMU and rumble. https://github.com/lemmingDev/ESP32-BLE-Gamepad
4. **ESP32-BLE-Combo** — keyboard + mouse + gamepad in one BLE device; up to 12 axes, 128 buttons, POV hats. https://github.com/juanmcasillas/ESP32-BLE-Combo
5. **M5StickC wireless gamepad** — joystick unit with its own ATmega over I²C; a model for smart input modules. https://www.hackster.io/esikora/wireless-gamepad-with-esp32-and-ble-9e069a

### Air mouse / gyro
6. **n1rml/esp32_airmouse** — ESP-IDF, MPU6050, built on asterics/esp32_mouse_keyboard. Forum thread covers gyro-only inaccuracy and gyro+accel fusion. https://github.com/n1rml/esp32_airmouse · https://esp32.com/viewtopic.php?t=13157
7. **ESP32-C3 air mouse (Quartz Components)** — deadzone + smoothing pipeline, presentation and TV control framing. https://www.hackster.io/quartz-components/diy-wireless-mouse-using-mpu6050-esp32-c3-e1dad3

### Macropads
8. **DeepDeck** — 16 RGB keys, two encoders with push, OLED, configured through a built-in webserver. https://www.crowdsupply.com/deepsea-developments/deepdeck
9. **duckyPad Pro** — ESP32-S3, 20 hot-swap keys, encoders, 1.5" OLED, BT 5.0, per-application profile switching, microSD, expansion modules. https://www.cnx-software.com/2025/09/23/duckypad-pro-20-key-esp32-s3-macropad-supports-up-to-3700-macros-using-duckyscript-language/
10. **FreeTouchDeck** — ESP32 + touchscreen, BLE keyboard, web config mode. Closest existing thing to the SCREEN unit. https://hackaday.com/blog/?s=macro+keyboard
11. **ESP32MacroPad library** — 16 buttons, 4 encoders, SSD1306, 8 layouts, callback API. https://www.arduinolibraries.info/libraries/esp32-macro-pad

### Wireless architecture, dongles, bridges
12. **Dual-MCU Pro Gaming Controller** — ESP32-S3 + RP2040/GP2040-CE, tri-mode: wired UART, encrypted ESP-NOW via dongle, BLE. Closest match to the BASE-as-dongle idea. https://github.com/VS-CODE-DEVELOPER/Dual-MCU-Pro-Gaming-Controller
13. **finger563/esp-usb-ble-hid** — S3 USB↔BLE HID bridge on a QtPy or T-Dongle-S3. https://github.com/finger563/esp-usb-ble-hid
14. **esp32beans/BLE_HID_Client** — BLE mouse to USB passthrough; states the chip rule plainly (S3 for BLE+USB together). https://github.com/esp32beans/BLE_HID_Client
15. **KoStard USB keyboard → BLE bridge** — S3 USB host to BLE, pairs three hosts, switches with a key combo. https://hackaday.com/2026/01/23/wired-to-wireless-esp32-gives-your-usb-keyboard-bluetooth/

### Oddball worth keeping
16. **Chorded keyboard (ste5eu)** — Twiddler-style one-handed chord input over BLE HID. A GRIP with stick + chord keys could type, not just fire macros. https://ste5eu.com/?p=49

### Official references
- Espressif USB HID device solution (USB HID + BLE HID, custom descriptors, wireless HID with ESP-NOW): https://docs.espressif.com/projects/esp-iot-solution/en/latest/usb/usb_overview/usb_device_solutions.html
- ESP-Dongle, multifunction S3 USB dongle: https://developer.espressif.com/blog/multi-function-usb-dongle-based-on-esp32-s3/

---

## 10. VRG tooling — what needs its own HTML, and what doesn't

Assessed against the VRG layer model: anything new is an **L1 program**, it carries an **L0 envelope**
(`vrg: 1`, `kind: app.doctype`, project id, payload untouched), it declares `produces` / `consumes`
in a manifest so the Shell can route it, and it prefixes every global `vrg*`. The hard rule still
applies: **it may use a server, it may never require one.**

### 10.1 Verdict table

| Candidate | Verdict | `kind` | consumes → produces |
|---|---|---|---|
| **HID profile / keymap editor** | **New app — the big one** | `hid.profile` | `buildtree.device` → `hid.profile` |
| **SCREEN UI designer (CYD pages)** | **New app** | `screen.ui` | `hid.profile`, `catalog.item` → `screen.ui` |
| **Deck layout planner (baseplate, bays, key grid)** | **New app**, reusing Planner's surface-layer patterns | `deck.layout` | `buildtree.device` → `deck.layout` |
| **Flasher console / firmware registry** | **New app**, small | `fw.imageset` | — → `fw.imageset`, flash log |
| Stick calibration + curve editor | **Panel inside the HID profile editor**, not its own file | — | — |
| Pin-budget / GPIO allocation | **New tab in `vrg-buildtree`** — it already does bus, address and footprint conflicts; this is the same engine one level finer | — | extends `buildtree.device` |
| Power / thermal budget for the dock | **Tab in BuildTree, or a várlerÁron-family calculator** if it grows | — | — |
| Wireless sniffer / spectrum view | **Extend `omnicomm_spectrum`**, don't start a new one | — | — |
| Inventory and compatibility for the new parts | **No new tool.** BuildTree catalog entries + a documented variant | — | — |
| Device registration / live link to the Planner | **No new tool.** This is the typed device bus (T4b) and `07d-linkpanel` | — | — |

### 10.2 The four that genuinely need their own file

**`vrg-hid-profile.html` — profile, keymap and layer editor.** Nothing in the family covers it, and
nothing should absorb it. It edits: per-key bindings across layers, stick curves, deadzone and
calibration, gyro sensitivity, encoder actions, and the per-application profile switching. It speaks
**WebHID** to push a profile onto the GRIP live and read one back, so the device stays the source of
truth for what's on it. This is the tool that makes the hardware configurable without a firmware
rebuild — everything else is downstream of it.

**`vrg-screen-ui.html` — SCREEN page designer.** Lays out the CYD's touch pages (buttons, sliders,
status tiles, dashboards), emits a `screen.ui` JSON the LVGL firmware renders at runtime. Same
relationship as FreeTouchDeck's config has to FreeTouchDeck, but VRG-native and offline. Without it,
every UI change is a reflash.

**`vrg-deck-layout.html` — physical layout planner.** The tilted baseplate, dock bay positions, key
grid, encoder and port placement, in millimetres. It matters because it is the join between the
physical build and the keymap: the key grid it defines is the grid the profile editor binds to, and
the same file feeds the enclosure design. Reuse the Planner's editor patterns rather than inventing
a new canvas idiom.

**`vrg-flasher.html` — firmware registry and flash console.** Named firmware images with versions
and checksums, a flash log per board, and **WebSerial**-based flashing via esptool-js. This is the
"ESP Flasher" cloud item, and it belongs in the browser rather than on the phone, because the phone's
OTG flashing path is the rough one. It also serves BuildTree and VAULT, not just this project.

### 10.3 The blocker to check before building any of them

**WebHID, Web Serial and Web Bluetooth require a secure context.** `file://` behaves inconsistently
across browsers for these APIs, and Web Bluetooth in particular tends to refuse opaque origins.
That collides directly with the VRG hard rule that every program opens from `file://` with full core
function — the same class of problem as the gyro `DeviceOrientationEvent` blocker, and it has the
same solution: the localhost or tunnel rung of the transport ladder.

**Verify this early, in the actual pinned Chrome for Testing build**, because the answer decides the
architecture of three of the four tools above:

- If `file://` works: these are ordinary offline VRG programs.
- If it doesn't: they are the **first VRG programs whose core function requires rung 1+**. That is an
  exception to the hard rule and needs writing into `DECISIONS.md` rather than discovering mid-build.

Mitigation either way: design each tool so **editing works offline and only the live device link
needs the secure origin.** Edit a profile from `file://`, export the JSON, and push it to hardware
from the served copy. Then the hard rule survives intact and the blocker only downgrades a
convenience.

### 10.4 Overlap to resolve first

This project overlaps the **Varler Field Device** hardware branch. The Pendant v0 (encoder + touch +
gesture feeding `PLANNER_CAM`) and the PiP-boy terminal/compute split are describing the same
ambitions as SCREEN and GRIP. Decide deliberately whether HID DECK **is** the pendant level of that
branch, or a sibling. If it is the same branch, the GRIP becomes the pendant's successor and both
inherit the typed device bus work for free. If it is a sibling, the two will drift — which is exactly
the várlerÁron failure mode the masterplan was written to stop.

---

## 11. Space left open

*(Add here: chosen names, dock contact decision, shell sketches, pin maps per device, HID descriptor layout, layer/profile scheme, BASE service list.)*
