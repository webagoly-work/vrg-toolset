# Board Console — agent init
*For a Claude Code session that will work on Board Console. Read this, then the files in §3.*

## 1. What it is
The control page for the universal dev board (ESP32-S3-N16R8 DevKit on the GPIO Extension Board):
connector and GPIO layout with setups and a generated `board_pins.h`, a firmware library with an
offline flasher and backups, and a live link to a board agent running on the chip.

## 2. Where
- `Firmware/board-console/`: `app/server.js` (local server, http://localhost:8790), `agent/VrgAgent`
  (Arduino library), `data/` (kept out of git).
- **Only in the main checkout as uncommitted work (2026-10-22)** — not on GitHub yet.
- Started from `Planner/START.cmd` → **U** (README) or `Board Console.bat`.

## 3. Read first
1. `Firmware/board-console/README.md`
2. `H:\VRG_Visual_Base\01_Hardware\Topology_Starter\CONCEPT_Board_Console.md` (outside the repo)

## 4. Build / test / check
- `Board Console.bat` installs `serialport` 12.0.0 on the first run, then starts the server.
- Without hardware: `node app/tools/fake_agent.js 7801 [--uses "ENC-1"] [--extra 5]`, then connect
  the Console to `tcp:127.0.0.1:7801`.

## 5. Rules and traps
- The board model is not copied into the repo; the server reads the generated files in
  `H:\VRG_Visual_Base\01_Hardware\Topology_Starter` (README "Files").
- The server is localhost only: Host/Origin checks, JSON-only posts (README "Files").
- Flashing is offline with the esptool under `_libs/arduino-cli`; a flash makes a full backup first
  unless the chip content is already known (README phase 2).
- The live link closes the port before any flash job and reconnects after (README phase 3a).

## 6. Current state
- 2026-10-18 1–2. fázis + 3a (ügynök, élő kapcsolat)
- Next: 3b, the simulator (README "Next phases"). Decision files: none.

## 7. Do not touch
- `data/` (library, backups, devices.json) and `app/node_modules` — out of git (README).

Forrás: Firmware/board-console/README.md (main checkout), Hub/data/topology.json roadmap, 2026-10-22
