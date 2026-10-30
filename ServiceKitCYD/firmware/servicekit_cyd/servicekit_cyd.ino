// =============================================================================
// ServiceKit CYD — a classic Cheap Yellow Display as the ServiceKit companion.
//
//   • Own screen + touch + microSD, so it works when the PC's display doesn't.
//   • Standalone pages (SD explorer, Rescue/BIOS keys, text viewer) need no PC.
//   • Bridge pages (PC drive explorer, Deployer, Status mirror) talk to the PC
//     bridge over USB-serial using the protocol in ../../bridge/protocol.md.
//
// The firmware is the "dumb" half: it draws, reads touch, reads its own SD, and
// exchanges short TAG|a|b lines with the smart bridge on the PC. It mirrors the
// browser simulator (sim/skcyd-ui.js) page for page.
//
// UNTESTED ON HARDWARE. See config.h for the pin map / library notes / TODO-CAL.
// =============================================================================
#include <TFT_eSPI.h>
#include <SPI.h>
#include <XPT2046_Touchscreen.h>
#include <FS.h>
#include <SD.h>
#include "config.h"

TFT_eSPI tft = TFT_eSPI();
SPIClass touchSPI(VSPI);
XPT2046_Touchscreen ts(XPT_CS, XPT_IRQ);

// ---- global UI state (definitions; pages.ino/proto.ino/sd.ino use these) ----
enum Page { PG_HOME, PG_SD, PG_PC, PG_DEPLOY, PG_RESCUE, PG_STATUS, PG_TEXT };
Page    gPage = PG_HOME;
int     gScroll = 0;

bool    gPcAlive = false;
char    gPcName[18] = "?";
bool    gKitPresent = false;
char    gKitDrive[4] = "";
char    gKitVer[12]  = "";
bool    gSdOk = false;

// touch zones registered during a draw; a press hit-tests them (newest first)
struct Zone { int16_t x, y, w, h; uint8_t id; };
Zone    gZones[48];
uint8_t gZoneN = 0;

// a small toast
char     gToast[40] = "";
uint8_t  gToastCol = 0;
uint32_t gToastAt = 0;

uint16_t gCmd = 1;              // rolling command id for bridge requests
uint32_t gLastTouch = 0;        // debounce

// ---- shared list model (SD explorer fills from SD; PC explorer from the bridge)
struct Entry { char name[40]; uint8_t isDir; uint32_t sizeKB; };
Entry    gList[MAX_LIST];
uint16_t gListN = 0;
char     gPath[160] = "/";      // current path in the active explorer (SD or PC)
bool     gPcBusy = false;       // waiting for a bridge directory listing
uint32_t gLedOffAt = 0;         // auto-off for a flashed LED

// ---- status mirror (from the bridge) ----
char gJobClient[22] = "", gJobComputer[18] = "", gJobStatus[16] = "";
int  gJobMin = -1;
char gPbTitle[28] = ""; int gPbDone = 0, gPbTotal = 0; bool gPbRunning = false;
char gStepText[64] = ""; uint8_t gStepCol = 0;
int  gSetupDone = -1, gSetupTotal = 0; char gSetupPhase[12] = "";

// ---- text viewer ----
#define TEXT_MAX 4096
char gText[TEXT_MAX]; char gTextName[42] = ""; Page gTextFrom = PG_SD;

// ---- PC drives (from DRV) ----
struct Drive { char id[6]; char label[18]; uint16_t freeGB; uint16_t totalGB; uint8_t removable; };
Drive    gDrives[8];
uint8_t  gDriveN = 0;
uint32_t gLastDrvReq = 0;

// ---- last wizard line (deployer) ----
char gWizText[48] = ""; uint8_t gWizCol = 0;

// SD helpers (sd.ino)
int sdCardGB();
int sdFreeGB();
void sdList(const char* path);
bool sdReadText(const char* path, char* out, size_t cap);
void ledFlash(uint8_t r, uint8_t g, uint8_t b, uint16_t ms);

// forward decls (other .ino files)
void drawPage();
void handleTouch(int id);
void serialPoll();
void sdInit();
void ledSet(uint8_t r, uint8_t g, uint8_t b);
void toast(uint8_t col, const char* msg);

void setup() {
  Serial.begin(SKCYD_BAUD);
  pinMode(LED_R, OUTPUT); pinMode(LED_G, OUTPUT); pinMode(LED_B, OUTPUT);
  ledSet(0, 0, 0);
  pinMode(PIN_BL, OUTPUT); digitalWrite(PIN_BL, HIGH);   // backlight on

  tft.init();
  tft.setRotation(ROT);
  tft.fillScreen(COL_BG);

  touchSPI.begin(XPT_CLK, XPT_MISO, XPT_MOSI, XPT_CS);
  ts.begin(touchSPI);
  ts.setRotation(ROT);

  sdInit();                      // mount the device's own microSD

  // say hello to the bridge (if a PC is listening)
  Serial.printf("HI|%s|%d|%d\n", SKCYD_FW_VERSION, sdCardGB(), sdFreeGB());

  drawPage();
}

void loop() {
  serialPoll();                  // bridge -> CYD lines
  pollTouch();                   // screen -> zones
  tickHeartbeat();               // PC alive timeout + toast expiry
}

// ---- touch polling + hit-test ------------------------------------------------
void pollTouch() {
  if (!ts.tirqTouched() || !ts.touched()) return;
  uint32_t now = millis();
  if (now - gLastTouch < 180) return;         // debounce
  gLastTouch = now;
  TS_Point p = ts.getPoint();
  int16_t x = map(p.x, TOUCH_MIN_X, TOUCH_MAX_X, 0, SCR_W);
  int16_t y = map(p.y, TOUCH_MIN_Y, TOUCH_MAX_Y, 0, SCR_H);
  x = constrain(x, 0, SCR_W - 1); y = constrain(y, 0, SCR_H - 1);
  for (int i = gZoneN - 1; i >= 0; i--) {
    Zone& z = gZones[i];
    if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) { handleTouch(z.id); return; }
  }
}

// ---- heartbeat / timeouts ----------------------------------------------------
uint32_t gLastHb = 0;
void tickHeartbeat() {
  uint32_t now = millis();
  if (gPcAlive && now - gLastHb > 4000) { gPcAlive = false; if (gPage == PG_PC || gPage == PG_DEPLOY || gPage == PG_STATUS) drawPage(); }
  if (gToast[0] && now - gToastAt > 2600) { gToast[0] = 0; drawPage(); }
  if (gLedOffAt && now > gLedOffAt) { ledSet(0, 0, 0); gLedOffAt = 0; }
}

// ---- RGB LED (active LOW) ----------------------------------------------------
void ledSet(uint8_t r, uint8_t g, uint8_t b) {
  digitalWrite(LED_R, r ? LOW : HIGH);
  digitalWrite(LED_G, g ? LOW : HIGH);
  digitalWrite(LED_B, b ? LOW : HIGH);
}
void ledFlash(uint8_t r, uint8_t g, uint8_t b, uint16_t ms) { ledSet(r, g, b); gLedOffAt = millis() + ms; }

void toast(uint8_t col, const char* msg) { strncpy(gToast, msg, sizeof(gToast) - 1); gToast[sizeof(gToast) - 1] = 0; gToastCol = col; gToastAt = millis(); drawPage(); }
