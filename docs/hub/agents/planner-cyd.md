# Planner CYD — agent init
*For a Claude Code session that will work on Planner CYD. Read this, then the files in §3.*

## 1. What it is
A desk dashboard and remote for the Varler Planner on a CYD (ESP32 touch display): status, the
phase's tools as buttons, a clock, and MAKRÓK, which also works as a plain PC macropad. The CYD is
dumb, a Node bridge on the PC is smart; they talk in short `X|a|b` lines over USB.

## 2. Where
- `Firmware/planner-cyd/`: `source/planner_cyd/` (firmware), `app/bridge/` (bridge, settings page
  on port 8788, macros), `app/tools/` (fake CYD, e2e, fonts). Planner side: `src/07e-dash-link.js`.
- **Only in the main checkout as uncommitted work (2026-10-22)** — not on GitHub yet.
- Launchers in the folder: `1 - USB - Planner.bat` … `5 - Makropad beallitasa.bat`; README §4 names
  START.cmd → K.

## 3. Read first
1. `Firmware/planner-cyd/README.md`
2. `Planner/projects/varler-planner/src/07e-dash-link.js`
3. `Planner/projects/varler-planner/tools/phone-relay-server.js`

## 4. Build / test / check
- Firmware: `3 - Flash CYD firmware.bat` (compiles, then `arduino-cli upload`).
- Without the CYD: `node app/tools/fake_cyd.js 7788`, then
  `node app/bridge/bridge.js --demo --tcp 127.0.0.1:7788` (README §4).
- Planner side: `tests/spec-101-dash-link.js` in the Planner suite.

## 5. Rules and traps
- Flashing replaces the RL firmware (README §3).
- The settings page listens on 127.0.0.1/::1 only, checks Host and Origin, takes JSON only (README).
- At most 12 tools per phase; `proj.save` on a never-saved project may open a name prompt (README §6).
- `node_modules` (serialport) is not in git; `1 - USB - Planner.bat` installs it (README §3).

## 6. Current state
- 2026-10-17 v0.7: KEZDŐLAP, makró készletek, magyar betűk
- README §5: the screen itself is not yet seen by Claude; the user checks layout, colours, touch.
  Decision files: none (decisions in README §6).

## 7. Do not touch
- `firmware/` (compiled image, not in git) and `app/bridge/macros.json` (the user's own sets).

Forrás: Firmware/planner-cyd/README.md (main checkout), Hub/data/topology.json roadmap, 2026-10-22
