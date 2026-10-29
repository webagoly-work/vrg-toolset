// =============================================================================
// config.h — ServiceKit CYD, board + look config for the classic Cheap Yellow
// Display (ESP32-2432S028R: ESP32 + 2.8" ILI9341 320x240 + XPT2046 + microSD).
//
// This sketch is UNTESTED ON HARDWARE (written without a board to flash). Treat
// the pin map and touch calibration as a starting point and adjust once you can
// see the screen. Everything marked TODO-CAL needs a real panel.
//
// LIBRARIES (Arduino IDE / arduino-cli):
//   - TFT_eSPI            (Bodmer)          display
//   - XPT2046_Touchscreen (Paul Stoffregen) resistive touch
//   - SD (built-in), SPI (built-in), FS (built-in)
//
// TFT_eSPI needs a User_Setup for this board. The simplest path is to use the
// "Setup" for the ESP32-2432S028R that ships in many CYD guides, OR define it
// inline. The CYD specifics TFT_eSPI must know:
//   ILI9341_2_DRIVER, TFT_WIDTH 240, TFT_HEIGHT 320,
//   TFT_MISO 12, TFT_MOSI 13, TFT_SCLK 14, TFT_CS 15, TFT_DC 2, TFT_RST -1,
//   TFT_BL 21, TFT_BACKLIGHT_ON HIGH, SPI_FREQUENCY 55000000, and the fonts
//   LOAD_GLCD LOAD_FONT2 LOAD_FONT4 SMOOTH_FONT. (The TFT runs on HSPI; the
//   touch and SD use their own buses, set below.)
// =============================================================================
#pragma once

#define SKCYD_FW_VERSION "0.1.0"
#define SKCYD_BAUD       115200

// ---- Touch (XPT2046) — its own SPI bus (VSPI pins repurposed on the CYD) ----
#define XPT_CLK   25
#define XPT_MOSI  32
#define XPT_MISO  39
#define XPT_CS    33
#define XPT_IRQ   36

// Touch calibration (raw ADC -> screen). TODO-CAL: adjust to your panel.
#define TOUCH_MIN_X 200
#define TOUCH_MAX_X 3700
#define TOUCH_MIN_Y 240
#define TOUCH_MAX_Y 3800

// ---- microSD — shared HSPI with the TFT on the classic CYD; CS on GPIO5 ----
// On the ESP32-2432S028R the SD shares the TFT's SPI bus. If your variant wires
// SD to a separate VSPI header, set SD_SCK/MISO/MOSI and use a second SPIClass.
#define SD_CS     5

// ---- Backlight + RGB status LED (active LOW on the CYD) ----
#define PIN_BL    21
#define LED_R      4
#define LED_G     16
#define LED_B     17

// ---- Screen geometry (landscape) ----
#define SCR_W   320
#define SCR_H   240
#define HEAD_H   26
#define FOOT_H   22
#define ROT       1   // USB on the left in landscape; flip to 3 if upside down

// ---- "Mélyvíz" palette (RGB565) ----
#define COL_BG      0x0862   // deep navy
#define COL_PANEL   0x0929
#define COL_LINE    0x11C7
#define COL_CYAN    0x4EBD
#define COL_CYANDIM 0x2C11
#define COL_AMBER   0xFD44
#define COL_TEXT    0xCE7B
#define COL_DIM     0x6CB4
#define COL_OK      0x3E31
#define COL_WARN    0xF324
#define COL_FAIL    0xE26B
#define COL_INFO    0x5D5F
#define COL_WHITE   0xEF7D
#define COL_ROW     0x0C27
#define COL_SEL     0x1246

// Limits
#define MAX_LIST   256   // entries read from one SD/PC directory
#define LINE_MAX   256   // serial line buffer
