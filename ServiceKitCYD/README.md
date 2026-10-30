# ServiceKit CYD

Turning the ServiceKit deployment from a **passive USB stick** into an **active
companion**: a classic Cheap Yellow Display (ESP32 + 2.8" touchscreen + microSD)
that plugs into a PC over USB and has its **own screen, touch and SD card** — so
it still works when the PC's display doesn't.

> Personal project, v0.1. The firmware is **untested on hardware** (written
> without a board to flash). The bridge and the browser simulator are tested and
> run with no hardware. **No client/job/GDPR data anywhere — example names only.**

## Why a CYD instead of a plain stick

A passive stick is pure storage: the PC must mount it, run its software, and show
that software on the PC's own screen. That fails exactly in the bad states a
service call is about — no/garbled display, autorun off, Explorer crashed, won't
boot to desktop, output on the wrong port, a headless box. The CYD has its own
screen and buttons, so it shows status and acts as a console regardless.

**Two-part design (chosen):** the passive **ServiceKit stick stays the drive** the
PC mounts (a classic CYD can only be a COM port — not USB mass storage and not a
USB keyboard). The **CYD is the companion console** with its own microSD for
offline reference, and it talks to a small PC **bridge** over serial.

```
  ServiceKit stick (mass storage)        CYD companion (this project)
  E:\ServiceKit  ── PC mounts ──▶ PC     320x240 screen + touch + microSD
                                   │               │  USB-serial (COM)
                                   └── bridge.js ◀──┘  short TAG|a|b lines
                                       (smart half)
```

## What's here

| Path | What | State |
|---|---|---|
| `firmware/servicekit_cyd/` | Arduino sketch for the real classic CYD (ESP32-2432S028R) | **untested on HW** |
| `bridge/bridge.js` | PC-side bridge: serial *or* simulator; mirrors ServiceKit, lists PC drives, runs the deployer | tested (logic) |
| `bridge/protocol.md` | the line protocol | — |
| `sim/sim.html` + `skcyd-ui.js` | browser CYD simulator (320×240) — the UI reference the firmware mirrors | tested |
| `sd-template/` | what to copy onto the CYD's microSD (offline reference + manifest) | — |

## Try it now (no hardware)

```bash
cd bridge
node bridge.js --sim --mock-pc        # starts the WebSocket on 127.0.0.1:47814 with a fake PC
```

Open `sim/sim.html` in a browser and press **Csatlakozás a hídhoz**. You get:

- **SD-kártya** — browse the device's microSD, open a `.txt`/`.md` (works with no PC).
- **Mentő** — BIOS/boot-key cheat-sheet from the SD (works with no PC).
- **Gép** — browse the PC's drives and folders over the bridge.
- **Telepítő** — verify the deployment stick against `manifest.json`, launch the
  dashboard/Setup/Kit Shell, deploy to `C:\ServiceKit`, open the boot-stick tool.
- **Állapot** — live mirror of the active ServiceKit job / playbook / installer.

The **Demo esemény** button fakes a job + playbook result with an LED flash,
using example names only.

## v1 scope

Chosen features: **SD file explorer**, **deployer/installer wizard**, **status
mirror**, with the **PC bridge**. No HID (a classic CYD can't type to the PC; that
would need an ESP32-S3 board or a helper chip — a later option).

## Real hardware

1. **Flash:** open `firmware/servicekit_cyd/` in the Arduino IDE (ESP32 core).
   Install `TFT_eSPI` and `XPT2046_Touchscreen`. Set up `TFT_eSPI`'s `User_Setup`
   for the ESP32-2432S028R (see the notes at the top of `config.h`). The pin map,
   colors and **touch calibration (TODO-CAL)** live in `config.h` — the touch
   mapping will need adjusting once you can see the screen.
2. **SD:** copy the contents of `sd-template/` to the microSD root.
3. **Bridge:** on the PC, `cd bridge && npm i serialport` (only needed for real
   serial), then `node bridge.js --port COM5` (your CYD's port). The bridge
   auto-detects a mounted `*:\ServiceKit` stick, or pass `--kit "E:\ServiceKit"`.

## Privacy

The bridge never reads, sends, stores or shows real client data. The job line
carries only example/placeholder names; a real ServiceKit job is shown with the
client blanked to `—` unless explicitly opted in. Nothing client-identifying is
written to the CYD SD. Keep it that way — this is a personal project first.

## Next ideas (not built)

- On-screen confirm modal before `deploy` (the firmware currently sends the
  confirm directly; the simulator shows the modal).
- PC-drive file **preview** on the CYD (pull small text files over serial).
- An **ESP32-S3** variant: SD visible to the PC as a drive, and openly-operated
  HID macros (open Run, launch the kit, type long commands) — the tech-pendant
  direction.
- Fold this into `vrg-toolset` as `Firmware/servicekit-cyd/`, sharing the CYD
  line-protocol conventions with `planner-cyd`.
