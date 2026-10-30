# Board Console

The control page for the universal dev board: ESP32-S3-N16R8 DevKit on the GPIO Extension Board V2775, with the passive 2.54 mm connector panel. Start it from `Planner/START.cmd` → **U**, or `Board Console.bat`. It opens http://localhost:8790.

Concept, decisions and the GitHub research: `H:\VRG\Full\VRG_Visual_Base\01_Hardware\Topology_Starter\CONCEPT_Board_Console.md`.

## Phase 1 (2026-10-18): layout, connectors, setups

- **Two views**:
  - *Csatlakozópanel / Connector panel*: the perfboard to scale. Each header shows its id, its pins' signals, and the GPIO under each signal pin.
  - *Fejlesztőlap / Dev board*: the pinout drawing with a ring on every GPIO pin: used, free, conflict, or reserved (boot, PSRAM, USB, UART0).
  - Both views: drag to pan, mouse wheel or pinch to zoom, **Igazítás / Fit** to reset.
- **Tap anything** to open its info card:
  - a connector: its pins, GPIO and harness pin (`HL.15 ← EX-BL09-S`), what it can't be used with, and the assigned module's pins and cautions;
  - a GPIO: its class, default role and all the places it is broken out.
- **Csatlakozók / Connectors** tab: switch each of the 41 connectors on or off, and pick the module plugged into it. Modules that fit the connector type are listed first. Conflicts (two active connectors on one exclusive GPIO) show at once; I2C and SPI bus lines may be shared.
- **GPIO** tab: all 36 GPIO with their state.
- **Összeállítások / Setups** tab: save, open or delete named setups (Ctrl+S saves). The 8 example builds from the topology load as starting points. The last setup reopens on the next start.
- **board_pins.h** tab: the pin header for the active connectors (`PIN_Q0A_SDA 8`, bus defines, module comments), with `#error` lines while there is a conflict. Copy or download it.
- **Filters**: by connector type; show all, active, free or conflict.
- UI: Hungarian with English below; works at phone width.

## Phase 2 (2026-10-18): firmware library + offline flasher

The header switch **Kiosztás · Layout / Firmware** opens the firmware screen.

**Library** (left):
- **+ Hozzáadás / Add**:
  - the Arduino builds found on this PC (`_libs/arduino-cli/build/*`, `Firmware/*/firmware`), one click each;
  - a folder or `.bin` path;
  - a `.bin` upload (e.g. a downloaded firmware);
  - a backup turned into a library entry.
  - Name and version are optional: the default name is the sketch or file name, the default version is the date.
- **Where each part goes:**
  - An **Arduino build** is stored the way arduino-cli uploads it: bootloader (0x1000 on ESP32/S2, 0x0 on the others), partition table at 0x8000, `boot_app0` at 0xe000, and the app at the first app partition read from the partition table. Its `.merged.bin` is not used: it is padded to the full flash and would also wipe the settings area (touch calibration, NVS).
  - A **single .bin** is classified: a full image (partition table at 0x8000) goes to 0x0, a small image to the bootloader address, and anything else is an app at 0x10000, with a note that the board needs a bootloader already.
  - The chip comes from the image header.
- **Each firmware** has versions, its parts with offsets and sizes, its source, a description, notes, and the **connectors it uses**. The card shows whether those fit the open layout setup.
  - **Szerkesztés / Edit**: name, description, notes, chip, connectors used (or fill them **from the setup**).
  - **Útvonalak a kiosztáson / Show its paths**: switches to the layout with exactly those connectors on.
  - **Törlés / Delete** removes a version.

**Device and flashing** (right):
- **Ports**: listed with their USB chip (CH34x, CP210x, Espressif native USB). Baud 921600 / 460800 / 115200.
- **Chip infó / Chip info**: chip, MAC, flash size, features, and whether its content is known.
- **Teljes mentés / Full backup**: reads the whole flash to `data/backups/<chip>_<mac>_<date>.bin` (+ `.json`).
- **Írás a lapra / Flash** (asks first). The job:
  1. reads the chip and refuses a chip mismatch;
  2. **checks on the chip** (`verify-flash`, checksums only, seconds) whether the current content is the last library flash or the last backup of this MAC;
  3. if it isn't, makes a **full backup first**;
  4. checks the parts' sha256;
  5. writes them;
  6. records it in `data/devices.json`.
  - Options: erase all first; skip the backup (marked not recommended).
- **Job log** with progress bar and Cancel.
- **Known boards** (by MAC, last action) and **Backups**.
- A **busy port** (the CYD bridge / macropad, a serial monitor) gives a clear message instead of an esptool trace.

**Flashing is offline**: it uses the `esptool.exe` (v5.3.1) that the Arduino ESP32 core installed under `_libs/arduino-cli`. Override with `--esptool <path>`.

`data/` layout (kept out of git):
- `library/<id>/<version>/manifest.json` + the parts. The manifest is a superset of the esp-web-tools format: `{name, version, builds:[{chipFamily, parts:[{path, offset}]}]}` plus `id, description, notes, uses, source, added, parts[{size, sha256}]`.
- `backups/`
- `devices.json`

## Phase 3a (2026-10-18): board agent + live link

**Board agent**: `agent/VrgAgent`, a header-only Arduino library.
- **Use:** `#include "board_pins.h"`, then `#include <VrgAgent.h>`, then `VRG_AGENT_BEGIN("name", "version")` in `setup()` after `Serial.begin(115200)`.
- **How it learns the pins:** it wraps `pinMode` / `digitalWrite` / `analogRead` / `ledcAttach` / `ledcWrite` in macros (the gpio_viewer trick), so the sketch needs no other change. Buses come from `board_pins.h`.
- **Protocol:** it talks over `Serial`, which on the dev board is the COM / UART (CH343) port. The lines are `#HELLO`, `#USES`, `#PINS`, and `#P` / `#A` / `#D` for values, sent at up to 20 Hz and only on change. `?` resends everything. The full description is in the header.
- **Example:** `examples/enc_test` (encoder on ENC-1, with a sample `board_pins.h`).
- **Compiling with your toolchain:** pass `--library <...>/agent/VrgAgent`. It compiles for the ESP32-S3 (290 KB) and for the classic ESP32 (the CYD).

**In the Console:**
- **Header chip** *Élő · Live*: off, connecting, or the running firmware's name and version, and the port. Clicking it opens the Live tab.
- **Élő · Live tab:**
  - pick the port (COM, or `tcp:host:port` for a test agent) and baud (115200), then connect;
  - the running firmware (whether it's in the library), chip, MAC, its setup name and connectors;
  - **warnings**: a connector used by the firmware but off in the setup; an unknown connector; a pin that isn't on the panel; a pin on none of the connectors in USES; two connectors in USES clashing;
  - **Kiosztás a firmware-ből / Setup from the firmware** turns on exactly the firmware's connectors;
  - a live pin table.
- **Konzol · Console tab:** every line the board sends (value lines are left out so it stays readable), a send box, `?`, follow, clear.
- **Views:**
  - connectors the firmware uses get a cyan dashed outline;
  - every pin on a live GPIO gets a dot (green = 1), or a bar for ADC and PWM;
  - on the dev board view, the firmware's pins get a cyan ring and a live dot.
- **Ports and flash jobs:** the live link closes the port before any chip info / backup / flash job and reconnects 1.5 s after it ends. If the board disappears (USB reset, reflash), it retries every 2 s.
- **`board_pins.h`** now also defines `VRG_SETUP` and `VRG_USES` for the agent.
- **Panel variant select:** **B 150 × 80** (the primary, default) or A 90 × 100. The server reads both `LAYOUT_Panel_150x80.html` and `LAYOUT_Panel.html`.

**Test agent:** `node app/tools/fake_agent.js 7801 [--uses "ENC-1"] [--extra 5]` imitates `enc_test` with the agent over TCP. Connect the Console to `tcp:127.0.0.1:7801`. It is the seed of the phase 3b simulator.

**Dependency:** `serialport` 12.0.0 (`app/package.json`, the same version as the CYD bridge). `Board Console.bat` installs it on the first run; `app/node_modules` stays out of git.

## Files

| File | What |
|---|---|
| `app/server.js` | Local server, no dependencies; serial ports come from Windows (PowerShell). Serves the page, reads the board model, saves setups. Localhost only: Host/Origin checks, JSON-only posts. Options: `--port`, `--board-dir`, `--data-dir`, `--no-open`. |
| `app/console.html` | The whole UI (single file). |
| `app/firmware.js` | Phase 2: library, image classification, devices, backups, the esptool job runner. |
| `app/live.js` | Phase 3a: the serial / TCP link to the board agent, its parsed state and the log. |
| `app/tools/fake_agent.js` | A test board agent over TCP (no hardware). |
| `app/package.json` | The one dependency: `serialport`. |
| `agent/VrgAgent/` | The board agent library + the `enc_test` example. |
| `Board Console.bat` | Starts the server and opens the browser (CRLF). If it's already running, it only opens the browser. |
| `data/setups/*.json` | Saved setups (`vrg-board-setup/1`: name, notes, active connectors, module per connector). Kept out of git (`Firmware/.gitignore`). |

**The board model is not copied here.** The server reads the generated files in `H:\VRG\Full\VRG_Visual_Base\01_Hardware\Topology_Starter` (`DEVBOARD_ESP32-S3_IO-Board.html`, `TOPOLOGY_Connectors.html`, `LAYOUT_Panel.html`, `MODULES_BuildTree.md`) on every page load. Re-run their generators (`make_starter.js`, `make_connectors.js`, `make_panel.js`) and reload the page.

## Next phases (from the concept)

2. ~~Firmware library + offline flasher~~ done (bridge-side esptool instead of esptool-js: the toolchain's esptool.exe is already installed and works in any browser; esptool-js stays an option for flashing from a phone).
3. ~~3a: board agent + live link~~ done. **3b**: the simulator (a virtual board as a port, virtual components on connectors, test scenarios, a CLI runner); see `PLAN_v2_Phase3_Addon_Power.md`.
4. Build through arduino-cli + `board_pins.h` straight into the sketch; simple firmware generated from settings.
5. Test console firmware; later the SD-card firmware library on the board.

## Verified, phase 3a (2026-10-18)

- **The agent** compiles in `enc_test` for the ESP32-S3 and the classic ESP32, with no warnings. It has not run on hardware yet: the S3 isn't plugged in.
- **Against the fake agent, through the server API:** HELLO, USES, PINS and values parsed; `pos` lines in the log; a sent line echoed.
- **In the browser pane:**
  - the Live tab connects to `tcp:127.0.0.1:7801`;
  - the chip shows *enc_test 1.1*;
  - both warnings are correct (ENC-1 off in the setup; GPIO5 on none of the USES connectors);
  - ENC-1 gets the cyan outline, and 21 live dots are drawn on panel B;
  - the dev board view shows 12 rings and 12 dots (4 GPIO × 3 access points);
  - the Console streams the output;
  - "Setup from the firmware" turns on ENC-1 and clears that warning;
  - `board_pins.h` carries `VRG_SETUP` and `VRG_USES`;
  - phone width: no sideways scroll.
- Panel B is the default; A is still selectable.

## Verified, phase 2 (2026-10-18)

- Import:
  - the planner_cyd build → 4 parts, ESP32, bootloader at 0x1000;
  - the knobpad build → ESP32-S3, bootloader at 0x0;
  - the ESP_lab `S3_uart_bridge.bin` (app only) → 0x10000 with the app-only note (it first went to 0x0, which would have overwritten the bootloader; caught and fixed);
  - the merged CYD image → 0x0 with the full-image note;
  - a duplicate version is refused, and an upload without the page header gets 415.
- The duplicated planner_cyd build folder (repo copy + build path) is listed once.
- Through the UI: add a build with name and version; edit its connectors (from the setup + typed, lowercase normalised); the fit warning; "Show its paths" switches the layout.
- Chip info on COM19 while the macropad held it: a clean "port busy" message, and the macropad was not disturbed.
- Phone width: no sideways scroll.
- **On hardware** (the CYD on COM19, with the macropad stopped, 2026-10-18):
  - **Chip info**: ESP32-D0WD-V3 rev 3.1, MAC 70:4b:ca:8d:07:14, 4 MB, 3 s.
  - **First flash** of Planner CYD 0.7: the board was new to the Console, so it made a full backup first (`data/backups/esp32_704bca8d0714_20261018-0152.bin`, 4 MB, about 50 s), then wrote the 4 parts, each verified by esptool: 70 s in total.
  - **Second flash**: verify-flash matched all 4 parts, so no backup was needed: 17 s.
  - **Afterwards**: the macropad reconnected within 2 s (`cyd: csatlakozva`). The settings area was not written, so the touch calibration and other settings were kept.
  - **Correction (later the same day):** that restart was started from my command shell and stopped when the command ended, so the macropad was not actually left running. It was restarted through Explorer and checked separately.

## Verified, phase 1 (2026-10-18, browser pane)

- Board data loads: 41 connectors, 36 GPIO, 74 modules. No console errors.
- The "Desk control head" example loads with no clash. ENC-1 + SER-1 together are flagged on GPIO 39/40/41, both in the views and the list, and the header gets `#error` lines.
- A module assigned to Q0-A shows in the pin header.
- Save with no name asks for one. The setup is saved to a file and reopens after a reload.
- Tapping GPIO8 on the dev board view shows its role, its breakout pins and the active connector.
- Phone width (375 px): no sideways scroll.
- Server: a foreign Origin gets 403, a form post 415. The launcher starts the server.
