// VRG Knob Pad — build-time settings.
// Pin numbers are a proposal for the Waveshare ESP32-S3-Zero: check them against the board's
// silkscreen before wiring. Never use G19/G20 (native USB D-/D+) or G26–G37 (flash/PSRAM).
#pragma once

#define FW_VERSION      "1.0.0"
#define HOSTNAME        "vrg-knobs"          // -> http://vrg-knobs.local
#define SETUP_AP_NAME   "VRG-Knobs-Setup"    // first-boot Wi-Fi setup access point

// Optional protection. Empty string = off.
#define WEB_USER        "vrg"
#define WEB_PASS        ""                   // set to protect the config page and /set
#define OTA_PASSWORD    ""                   // set to protect over-the-air uploads

// Encoders: A, B, push switch (switch is active low).
#define ENC1_A 1
#define ENC1_B 2
#define ENC1_SW 4
#define ENC2_A 5
#define ENC2_B 6
#define ENC2_SW 7
#define ENC3_A 8
#define ENC3_B 9
#define ENC3_SW 10

// Flip a knob whose direction comes out backwards (0 = normal, 1 = reversed).
#define ENC1_REVERSE 0
#define ENC2_REVERSE 0
#define ENC3_REVERSE 0

// EC11: half-quadrature decoding gives 2 counts per detent. If one click sends two steps,
// change this to 4; if it takes two clicks per step, change it to 1.
#define COUNTS_PER_DETENT 2

// Displays: SH1106 128x64 at 0x3C, one per I2C bus so the identical addresses never clash.
// Display 1 = the OLED+EC11 module wired as encoder 2, display 2 = the one wired as encoder 3.
#define OLED1_SDA 11
#define OLED1_SCL 12
#define OLED2_SDA 13
#define OLED2_SCL 14   // if G14 is not broken out on your board, use 3 (a strapping pin, fine as I2C here)
