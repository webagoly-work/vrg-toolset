// planner_cyd.ino - desk dashboard + remote for the Varler Planner, on the Cheap Yellow Display.
//
// Built on the RL CYD v2 principle (H:/others/RL-CYD-v2): the CYD is dumb, the PC bridge
// is smart. The bridge (app/bridge) joins the Planner's local relay, gets the tab's state
// and sends it here as short lines (protocol.ino). Button presses go back as '!' lines.
//
// Pages (header: [PC chip] < PAGE > [settings]):
//   ALLAPOT     project, level, phase, running tool, layer, selection, checks
//   ESZKOZOK    the current phase's tools as buttons (tap = start, tap again = stop)
//   FAZISOK     the six workflow phases with their error / warning counts (tap = go)
//   VEZERLES    undo, redo, Esc, Select, level up/down, 2D/3D, view home, finish, save
//   MAKROK      up to 12 buttons from the bridge's macros.json: Planner actions, key
//               combinations, programs (works without a Planner tab, only needs the bridge)
//   OSSZESITES  devices, paths, circuits, cables, notes, errors, warnings
//   ORA         time and date from the PC, when the Planner was last worked in, and a
//               button that opens START.cmd on the PC (the bridge decides the file)
//
// Auto switch (Settings, on by default): a phase change jumps to ESZKOZOK;
// when the Planner sits idle (the bridge decides: no input for 5 min, or no tab for 1 min)
// the CYD shows ORA, and goes back to where it was when work starts again (or on a tap).
//
// v0.1 is USB only: no WiFi or Bluetooth, so no radio RAM to budget (see the primer).
// BOOT: short = next page (next row in settings), hold 1.2 s = settings (activate row).
//
// Build: board "ESP32 Dev Module" (esp32:esp32:esp32), default partition. Library: LovyanGFX.
// Files: protocol.ino, ui.ino (shell, input, calibration, LED), pages.ino (the five pages).

#include "display.h"
#include "pc_types.h"
#include "fonts_hu.h"
#include <Preferences.h>
#include <esp_bt.h>

#define HAS_RGB_LED 1

static const uint32_t ALIVE_MS = 4000;  // no line for this long = no bridge

static const int W = 320, H = 240, BAND_H = 42, HDR_H = 22;
static const int PIN_BOOT = 0;
static const int LED_R = 4, LED_G = 16, LED_B = 17;
static const uint8_t BRIGHT[] = { 40, 90, 160, 255 };
static const uint8_t ROTATIONS[] = { 1, 3, 5, 7 };
static const char* PAGE_NAME[PG_COUNT + 1] = { "KEZDŐLAP", "ÁLLAPOT", "ESZKÖZÖK", "FÁZISOK", "VEZÉRLÉS", "MAKRÓK", "ÖSSZESÍTÉS", "ÓRA", "BEÁLLÍTÁS" };
static const char* PAGE_ID[PG_COUNT + 1] = { "home", "status", "tools", "phases", "controls", "macros", "totals", "clock", "settings" };

static LGFX lcd;
static LGFX_Sprite band(&lcd);  // 320 x 42, reused for every horizontal strip
static Preferences prefs;

// Text fonts: HuSans (fonts_hu.h, from Liberation Sans) - the built-in fonts are ASCII only.
// Loaded once from flash; setFont() then just points at them. Digits keep Font4 / Font7.
static lgfx::PointerWrapper huRData, huSData, huBData, huLData;
static lgfx::VLWfont huR, huS, huB, huL;  // 15 px regular, 12 px regular (long button labels), 18 / 24 px bold

static void loadFonts() {
  huRData.set(HU_R15, sizeof HU_R15);
  huSData.set(HU_R12, sizeof HU_R12);
  huBData.set(HU_B18, sizeof HU_B18);
  huLData.set(HU_B24, sizeof HU_B24);
  if (!huR.loadFont(&huRData) || !huS.loadFont(&huSData) || !huB.loadFont(&huBData) || !huL.loadFont(&huLData)) Serial.println("#ERR font load failed");
}
static Settings cfg;

static Link lk;
static LineReader rd;
static Toast toast = {};

static uint16_t dirty = D_ALL;
static int page = PG_HOME, prevPage = PG_HOME, settingsSel = 0;
static bool screenValid = false, calRequested = false;

static uint32_t ledUntil = 0;
static bool ledR = false, ledG = false, ledB = false;

static int8_t pressedBtn = -1;  // touch feedback on the button pages
static uint32_t pressedUntil = 0;

// Clock: the PC's time (Y| line), kept running on millis().
static uint32_t clkEpoch = 0, clkMillis = 0;

// Auto switch: the phase changed on the PC -> ESZKOZOK; idle -> ORA and back.
static int8_t idleReturnPage = -1;
static bool idleSnoozed = false;  // a tap left the idle clock: stay away until the next idle spell
static bool phaseJump = false;

// ---------------------------------------------------------------- settings

static void loadSettings() {
  prefs.begin("plcyd", false);
  cfg.rotation = prefs.getUChar("rot", ROTATIONS[0]);
  cfg.invert = prefs.getBool("inv", false);
  cfg.brightness = prefs.getUChar("bri", 2) % sizeof BRIGHT;
  cfg.calAsked = prefs.getBool("calask", false);
  cfg.calValid = prefs.getBytes("cal", cfg.cal, sizeof cfg.cal) == sizeof cfg.cal;
  cfg.autoSwitch = prefs.getBool("auto", true);
  cfg.tzMin = prefs.getShort("tz", 0);
}

static void saveSettings() {
  prefs.putUChar("rot", cfg.rotation);
  prefs.putBool("inv", cfg.invert);
  prefs.putUChar("bri", cfg.brightness);
  prefs.putBool("calask", cfg.calAsked);
  if (cfg.calValid) prefs.putBytes("cal", cfg.cal, sizeof cfg.cal);
  prefs.putBool("auto", cfg.autoSwitch);
  prefs.putShort("tz", cfg.tzMin);
}

static bool bridgeAlive() { return lk.lastLine && millis() - lk.lastLine < ALIVE_MS; }
static bool plannerLive() { return bridgeAlive() && lk.planner; }

static void invalidate() { screenValid = false; }

// ---------------------------------------------------------------- main

void setup() {
  Serial.setRxBufferSize(2048);
  Serial.begin(115200);
  pinMode(PIN_BOOT, INPUT_PULLUP);
#if HAS_RGB_LED
  pinMode(LED_R, OUTPUT);
  pinMode(LED_G, OUTPUT);
  pinMode(LED_B, OUTPUT);
  ledSet(false, false, false);
#endif
  esp_bt_mem_release(ESP_BT_MODE_BTDM);  // no Bluetooth in this build: give its RAM back

  loadSettings();
  memset(&lk, 0, sizeof lk);
  strlcpy(lk.name, "PC", sizeof lk.name);
  lk.st.phase = -1;
  lk.activeSet = -1;

  loadFonts();
  lcd.init();
  lcd.setRotation(cfg.rotation);
  lcd.invertDisplay(cfg.invert);
  lcd.setBrightness(BRIGHT[cfg.brightness]);
  if (cfg.calValid) lcd.setTouchCalibrate(cfg.cal);

  band.setColorDepth(16);
  if (!band.createSprite(W, BAND_H)) Serial.println("#ERR sprite alloc failed");

  if (!cfg.calAsked) offerCalibration();
  Serial.println("#HELLO planner_cyd 1");
}

void loop() {
  pollStream(Serial);
  pollInput();
  autoNav();
  updateLed();

  if (calRequested) {
    calRequested = false;
    runCalibration();
  }

  static uint32_t lastDraw = 0, lastStat = 0;
  if (millis() - lastDraw >= 33) {
    lastDraw = millis();
    render();
  }
  if (millis() - lastStat >= 5000) {
    lastStat = millis();
    sendStat();
  }
}
