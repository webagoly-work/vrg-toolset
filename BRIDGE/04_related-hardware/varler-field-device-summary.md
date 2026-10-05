# Varler Field Device — Project Summary

*Hardware branch of the Planner/BRIDGE work: the physical body for the software.
Read with `hardware-branch-workplan.md` and `varler-buildtree.html`.*

## What it is

An all-in-one, self-hosted field/personal device built around the ESP32-S3. It grows from
a simple control pendant into a carried mini-computer that hosts the Varler Planner and the
other tools, reachable both locally and over the internet. The spine is a generalized
device bus (relay → typed message bus), proven first by the phone-control extension: every
level plugs into that one seam.

## Variants

- **Pendant (v0)** — control surface: encoder + touch + gesture feeding `PLANNER_CAM`;
  replaces the gyro's *job* with clean hardware events (no browser sensor, no secure context).
- **PiP-boy base** — two clicked-together PVC halves: terminal half (WROOM LVGL touchscreen,
  battery left) + compute half (S3 + peripherals, battery right), linked by ESP-NOW. Batteries
  on opposite sides keep the stack thin.
- **Cupboard server / vault** — always-on; serves the tools + versioned backups; reachable
  worldwide via a thin-helper tunnel (real TLS → phone gyro works over the internet).
- **Wearable rework (L7)** — arm-mount (PiP-boy) or backpack-hub form for site carry.

## Build levels

1. Pendant / auto-negotiating hub — links Desktop + Mobile across any of the 6 topologies.
2. Internet URL + working gyro — thin-helper tunnel (GL.iNet mini router / Pi Zero 2 W / Pi 5).
3. Mini-server — runs services, not just stores; touchscreen + encoder.
4. Programming multitool — switchable-port USB hub for the flash/serial adapters.
5. Wireless suite — NFC / sub-GHz / Zigbee-Thread / LoRa / LTE.
6. HackRF — full SDR TX/RX.
7. Wearable, modular repackage.

## Modules — v0 build (Hardware / Software)

**Hardware**
- ESP32-S3 N16R8 — brain + vault host (3.3V; avoid GPIO 0/3/19/20/26–37/45/46)
- ESP32 WROOM LVGL 2.4" — interface only (display + touch onboard)
- 1.3" OLED + EC11 encoder — secondary display + rotary input (I2C 0x3C + 3 GPIO)
- microSD module (SPI) — the vault store
- VL6180X ToF (I2C 0x29) — touchless gesture / proximity
- MPU6050 IMU (optional, I2C) — real orientation over the link; retires the gyro blocker in hardware
- 2× 18650 + powerbank controllers — two independent 1S rails (right = compute, left = terminal)
- level shifters — for any 5V module against the 3.3V S3
- **Missing only:** the clamshell enclosure (fabrication, not a purchase)

**Software**
- Device-bus relay — generalized from the phone extension (`/whoami`, handshake, QR)
- `PLANNER_CAM` adapter — encoder/gesture → camera events → `drawSoon()`
- ESP-NOW link — terminal ↔ brain (no wire across the join; common GND only if wired-UART fallback)
- S3 drivers — I2C (OLED, ToF), encoder GPIO, microSD SPI
- LVGL UI — on the terminal board
- Vault file-server + versioning — `/current/`, `/versions/vX/`, ≥1 known-good backup

## Geometric sketch (rough — relative scale, not exact)

Scale ≈ 2.5 mm per character across, 6.7 mm per line down. Module sizes are proportional
to each other; treat as schematic, not a cut template.

```
TERMINÁL fél (felülnézet)                90 × 100 mm
+--------------------------------------+
| +------+                             |
| |      |    +---------------------+  |
| |18650 |    |                     |  |
| | akku |    |     TOUCHSCREEN     |  |
| |(BAL) |    |   WROOM LVGL 2.4"   |  |
| |      |    |      50 x 75 mm     |  |
| |~76mm |    |                     |  |
| |      |    |                     |  |
| +------+    +---------------------+  |
|   20mm              50mm              |
+--------------------------------------+

COMPUTE fél (felülnézet)                 90 × 100 mm
+--------------------------------------+
| +-------------+ +------+     +------+ |
| | 1.3" OLED   | |micro | (o) |      | |
| |  + EC11 (O) | | SD   |     |18650 | |
| | 35 x 58 mm  | +------+     | akku | |
| |             | +------+     |(JOBB)| |
| |             | |VL6180|     |      | |
| +-------------+ | X ToF|     |~76mm | |
| +-------------+ +------+     |      | |
| | ESP32-S3    |              |      | |
| |  57 x 28 mm |              |      | |
| +-------------+              +------+ |
+--------------------------------------+

OLDALNÉZET — felek összekattintva (~38 mm vastag)
   [=== touch felület ===]
+--------------------------------------+  FELSŐ (terminál)
|#akku#|      WROOM LVGL panel         |  akku BAL
+------+-------------------------------+
|===========  klikk-illesztés  ========|
+-------------------------------+------+  ALSÓ (compute)
|  S3 + OLED + microSD + ToF    |#akku#|  akku JOBB
+-------------------------------+------+
 |<------------ 90 mm ---------------->|

A két akku ELLENTÉTES oldalon van (bal fent / jobb lent), így nem egymásra
esnek — ettől marad vékony (~38 mm) a szendvics. A cella (Ø18 mm) a
legmagasabb elem, ő szabja meg a vastagságot.
```

## Pin map (S3, example — remappable)

- I2C: SDA→G8, SCL→G9 (OLED 0x3C + VL6180X 0x29 shared)
- Encoder: A→G4, B→G5, SW→G6, + GND
- microSD SPI: MOSI→G11, SCK→G12, MISO→G13, CS→G10, + 3V3 + GND
- Power: 5V ← powerbank OUT+, GND ← OUT− (one source at a time: USB **or** 5V)

## Bring-up order (HW/SW interleaved — each gate before the next)

1. **HW** Power-test cell → powerbank module → confirm stable 5V (both halves)
2. **SW** S3 alone: flash blink, confirm enumeration (flash on the UART USB-C)
3. **HW/SW** I2C scan → OLED (0x3C); display a test
4. **HW/SW** Add VL6180X → scan shows 0x29 too; read distance
5. **HW/SW** Encoder on GPIO → read counts + button
6. **HW/SW** microSD over SPI → mount, write, read back (vault path)
7. **HW** Cut USB, run the compute half on battery
8. **SW** Terminal half: flash WROOM LVGL, run demo, confirm touch
9. **SW** ESP-NOW: print MACs, pair, test packet both ways (both on battery)
10. **SW** Integration: a touch on the terminal changes something on the compute half (round-trip)
11. **HW** Only now: paper-template the ~90×100 mm footprint, dry-fit, cut PVC, mount (batteries last, vented)

*Rule: if a step goes red, stop there — every fault is cheapest to find at the step that introduced it.*

## Inventory status (context)

- ESP boards: 3 in hand (S3 + WROOM-32D + WROOM LVGL), +2 S3 inbound.
- Wireless-capable modules: 8 (3× WiFi/BLE, 2× nRF905 sub-GHz, PN532 + 2× MFRC-522 NFC).
- Owned power: 2× 18650 cells, 2× powerbank controllers, 4× TP4056, LM2596 ×2, holders.
- Tunnel helper (L2) and cert route (LAN gyro) are the two decisions still open.
