// VRG Knob Pad v1 — ESP32-S3-Zero, 3 EC11 encoders, 2 SH1106 OLEDs.
// USB: one composite HID device (keyboard + mouse + media keys) on the native USB-C port.
// Wi-Fi: joins the home network (WiFiManager portal on first boot) and serves a config page
// at http://vrg-knobs.local. The knobs work with or without Wi-Fi.
//
// Arduino IDE: Tools > USB Mode = "USB-OTG (TinyUSB)", USB CDC On Boot = Enabled.
// Libraries: ESP32Encoder (madhephaestus), U8g2 (olikraus), WiFiManager (tzapu).

#include <Arduino.h>
#include "USB.h"
#include "USBHIDKeyboard.h"
#include "USBHIDMouse.h"
#include "USBHIDConsumerControl.h"
#include <ESP32Encoder.h>
#include <Wire.h>
#include <U8g2lib.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <ESPmDNS.h>
#include <WebServer.h>
#include <ArduinoOTA.h>
#include <Preferences.h>
#include "config.h"
#include "webpage.h"

#if ARDUINO_USB_MODE
#error "Set Tools > USB Mode to USB-OTG (TinyUSB) - HID needs the native USB stack"
#endif

USBHIDKeyboard Keyboard;
USBHIDMouse Mouse;
USBHIDConsumerControl Media;

// ---------------------------------------------------------------- actions
// Ids are what the web page and flash storage use; OLED labels stay ASCII (no accents in the font).
enum RotId { R_NONE, R_VOL, R_SCROLL, R_HSCROLL, R_ZOOM, R_ARROW_UD, R_ARROW_LR, R_TRACK, R_BRIGHT,
             R_F13, R_F15, R_F17, R_F19, R_F21, R_F23, R_COUNT };
const char *ROT_IDS[R_COUNT]  = { "none", "vol", "scroll", "hscroll", "zoom", "arrow_ud", "arrow_lr",
                                  "track", "bright", "f13_14", "f15_16", "f17_18", "f19_20", "f21_22", "f23_24" };
const char *ROT_OLED[R_COUNT] = { "-", "VOLUME", "SCROLL", "H-SCROLL", "ZOOM", "UP/DOWN", "LEFT/RIGHT",
                                  "TRACK", "BRIGHT", "F13/F14", "F15/F16", "F17/F18", "F19/F20", "F21/F22", "F23/F24" };

enum PressId { P_NONE, P_MUTE, P_PLAY, P_NEXT, P_PREV, P_ENTER, P_ESC, P_F13, P_COUNT = P_F13 + 12 };
const char *PRESS_IDS[P_COUNT] = { "none", "mute", "play", "next", "prev", "enter", "esc",
                                   "f13", "f14", "f15", "f16", "f17", "f18", "f19", "f20", "f21", "f22", "f23", "f24" };

struct Knob {
  uint8_t pinA, pinB, pinSw;
  bool reverse;
  uint8_t rot, press;          // current mapping (RotId / PressId)
  ESP32Encoder enc;
  int64_t lastRaw = 0;
  long count = 0;              // net detents since boot, shown on the page
  String last = "-";           // last action sent, shown on the page and OLED
  bool swDown = false;
  uint32_t swChangedAt = 0;
};

Knob knobs[3] = {
  { ENC1_A, ENC1_B, ENC1_SW, ENC1_REVERSE, R_VOL,    P_MUTE },
  { ENC2_A, ENC2_B, ENC2_SW, ENC2_REVERSE, R_SCROLL, P_PLAY },
  { ENC3_A, ENC3_B, ENC3_SW, ENC3_REVERSE, R_F13,    P_F13 + 2 },   // F13/F14 turn, F15 press
};

void mediaKey(uint16_t usage) { Media.press(usage); Media.release(); }

String doRotate(uint8_t rot, int dir) {
  switch (rot) {
    case R_VOL:      mediaKey(dir > 0 ? CONSUMER_CONTROL_VOLUME_INCREMENT : CONSUMER_CONTROL_VOLUME_DECREMENT); return dir > 0 ? "VOL+" : "VOL-";
    case R_SCROLL:   Mouse.move(0, 0, dir > 0 ? -1 : 1); return dir > 0 ? "SCROLL DN" : "SCROLL UP";
    case R_HSCROLL:  Mouse.move(0, 0, 0, dir); return dir > 0 ? "SCROLL R" : "SCROLL L";
    case R_ZOOM:     Keyboard.press(KEY_LEFT_CTRL); Mouse.move(0, 0, dir); Keyboard.release(KEY_LEFT_CTRL); return dir > 0 ? "ZOOM+" : "ZOOM-";
    case R_ARROW_UD: Keyboard.write(dir > 0 ? KEY_DOWN_ARROW : KEY_UP_ARROW); return dir > 0 ? "DOWN" : "UP";
    case R_ARROW_LR: Keyboard.write(dir > 0 ? KEY_RIGHT_ARROW : KEY_LEFT_ARROW); return dir > 0 ? "RIGHT" : "LEFT";
    case R_TRACK:    mediaKey(dir > 0 ? CONSUMER_CONTROL_SCAN_NEXT : CONSUMER_CONTROL_SCAN_PREVIOUS); return dir > 0 ? "NEXT" : "PREV";
    case R_BRIGHT:   mediaKey(dir > 0 ? CONSUMER_CONTROL_BRIGHTNESS_INCREMENT : CONSUMER_CONTROL_BRIGHTNESS_DECREMENT); return dir > 0 ? "BRIGHT+" : "BRIGHT-";
    default:
      if (rot >= R_F13 && rot < R_COUNT) {
        uint8_t fn = 13 + 2 * (rot - R_F13) + (dir > 0 ? 0 : 1);   // clockwise = the lower key of the pair
        Keyboard.write(KEY_F13 + (fn - 13));
        return "F" + String(fn);
      }
      return "-";
  }
}

String doPress(uint8_t press) {
  switch (press) {
    case P_MUTE:  mediaKey(CONSUMER_CONTROL_MUTE); return "MUTE";
    case P_PLAY:  mediaKey(CONSUMER_CONTROL_PLAY_PAUSE); return "PLAY/PAUSE";
    case P_NEXT:  mediaKey(CONSUMER_CONTROL_SCAN_NEXT); return "NEXT";
    case P_PREV:  mediaKey(CONSUMER_CONTROL_SCAN_PREVIOUS); return "PREV";
    case P_ENTER: Keyboard.write(KEY_RETURN); return "ENTER";
    case P_ESC:   Keyboard.write(KEY_ESC); return "ESC";
    default:
      if (press >= P_F13 && press < P_COUNT) {
        Keyboard.write(KEY_F13 + (press - P_F13));
        return "F" + String(13 + press - P_F13);
      }
      return "-";
  }
}

// ---------------------------------------------------------------- storage
Preferences prefs;

void loadMapping() {
  prefs.begin("knobs", true);
  for (int i = 0; i < 3; i++) {
    uint8_t r = prefs.getUChar(("r" + String(i)).c_str(), knobs[i].rot);
    uint8_t p = prefs.getUChar(("p" + String(i)).c_str(), knobs[i].press);
    if (r < R_COUNT) knobs[i].rot = r;
    if (p < P_COUNT) knobs[i].press = p;
  }
  prefs.end();
}

void saveMapping(int i) {
  prefs.begin("knobs", false);
  prefs.putUChar(("r" + String(i)).c_str(), knobs[i].rot);
  prefs.putUChar(("p" + String(i)).c_str(), knobs[i].press);
  prefs.end();
}

int findId(const char *const *ids, int n, const String &id) {
  for (int k = 0; k < n; k++) if (id == ids[k]) return k;
  return -1;
}

// ---------------------------------------------------------------- displays
U8G2_SH1106_128X64_NONAME_F_HW_I2C oled1(U8G2_R0, U8X8_PIN_NONE);
U8G2_SH1106_128X64_NONAME_F_2ND_HW_I2C oled2(U8G2_R0, U8X8_PIN_NONE);
bool oledDirty = true;
uint32_t oledDrawnAt = 0;

void drawKnob(U8G2 &d, const Knob &k, const char *title, const String &footer) {
  d.clearBuffer();
  d.setFont(u8g2_font_6x12_tr);
  d.drawStr(0, 10, title);
  d.drawStr(128 - d.getStrWidth(ROT_OLED[k.rot]), 10, ROT_OLED[k.rot]);
  d.drawHLine(0, 13, 128);
  d.setFont(u8g2_font_logisoso16_tr);
  d.drawStr(0, 38, k.last.c_str());
  d.setFont(u8g2_font_6x12_tr);
  d.drawStr(0, 52, ("push: " + String(PRESS_IDS[k.press])).c_str());
  d.drawStr(0, 63, footer.c_str());
  d.sendBuffer();
}

void drawDisplays() {
  String net = WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : String("wifi: ") + SETUP_AP_NAME;
  drawKnob(oled1, knobs[1], "KNOB 2", "K1 " + String(ROT_OLED[knobs[0].rot]) + " " + knobs[0].last);
  drawKnob(oled2, knobs[2], "KNOB 3", net);
}

// ---------------------------------------------------------------- web
WiFiManager wm;
WebServer server(80);
bool netStarted = false;

bool authorised() {
  if (strlen(WEB_PASS) == 0) return true;
  if (server.authenticate(WEB_USER, WEB_PASS)) return true;
  server.requestAuthentication();
  return false;
}

void cors() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
}

String stateJson() {
  String s = "{\"fw\":\"" FW_VERSION "\",\"host\":\"" HOSTNAME "\",\"ip\":\"" + WiFi.localIP().toString() + "\",\"enc\":[";
  for (int i = 0; i < 3; i++) {
    if (i) s += ",";
    s += "{\"count\":" + String(knobs[i].count) + ",\"last\":\"" + knobs[i].last +
         "\",\"rot\":\"" + ROT_IDS[knobs[i].rot] + "\",\"press\":\"" + PRESS_IDS[knobs[i].press] + "\"}";
  }
  return s + "]}";
}

void handleSet() {
  cors();
  if (server.method() == HTTP_OPTIONS) { server.send(204); return; }   // CORS preflight
  if (!authorised()) return;
  int i = server.arg("enc").toInt() - 1;                 // 1-based on the wire
  if (i < 0 || i > 2) { server.send(400, "text/plain", "enc must be 1..3"); return; }
  if (server.hasArg("rot")) {
    int r = findId(ROT_IDS, R_COUNT, server.arg("rot"));
    if (r < 0) { server.send(400, "text/plain", "unknown rot"); return; }
    knobs[i].rot = r;
  }
  if (server.hasArg("press")) {
    int p = findId(PRESS_IDS, P_COUNT, server.arg("press"));
    if (p < 0) { server.send(400, "text/plain", "unknown press"); return; }
    knobs[i].press = p;
  }
  saveMapping(i);
  oledDirty = true;
  server.send(200, "application/json", stateJson());
}

void startNetworkServices() {
  if (wm.getConfigPortalActive()) wm.stopConfigPortal();   // frees port 80 for our own server
  ArduinoOTA.setHostname(HOSTNAME);
  if (strlen(OTA_PASSWORD)) ArduinoOTA.setPassword(OTA_PASSWORD);
  ArduinoOTA.begin();                                      // also starts mDNS as HOSTNAME.local
  MDNS.addService("http", "tcp", 80);

  server.on("/", HTTP_GET, [] { if (authorised()) server.send_P(200, "text/html", PAGE_HTML); });
  server.on("/state", HTTP_GET, [] { cors(); server.send(200, "application/json", stateJson()); });
  server.on("/set", HTTP_ANY, handleSet);
  server.on("/wifi-reset", HTTP_POST, [] {
    if (!authorised()) return;
    server.send(200, "text/plain", "ok - restarting into setup mode");
    delay(300);
    wm.resetSettings();
    ESP.restart();
  });
  server.onNotFound([] {
    cors();
    if (server.method() == HTTP_OPTIONS) server.send(204);
    else server.send(404, "text/plain", "not found");
  });
  server.begin();
  netStarted = true;
  oledDirty = true;
}

// ---------------------------------------------------------------- setup / loop
void setup() {
  Serial.begin(115200);
  Keyboard.begin();
  Mouse.begin();
  Media.begin();
  USB.productName("VRG Knob Pad");
  USB.begin();

  loadMapping();
  ESP32Encoder::useInternalWeakPullResistors = puType::up;
  for (auto &k : knobs) {
    k.enc.attachHalfQuad(k.pinA, k.pinB);
    k.enc.clearCount();
    pinMode(k.pinSw, INPUT_PULLUP);
  }

  Wire.begin(OLED1_SDA, OLED1_SCL);
  Wire1.begin(OLED2_SDA, OLED2_SCL);
  oled1.begin();
  oled2.begin();

  WiFi.setHostname(HOSTNAME);
  wm.setHostname(HOSTNAME);
  wm.setConfigPortalBlocking(false);                       // knobs keep working while unconfigured
  wm.autoConnect(SETUP_AP_NAME);
}

void loop() {
  uint32_t now = millis();

  for (auto &k : knobs) {
    int64_t raw = k.enc.getCount();
    long steps = (raw - k.lastRaw) / COUNTS_PER_DETENT;
    if (steps) {
      k.lastRaw += steps * COUNTS_PER_DETENT;
      int dir = (steps > 0) != k.reverse ? 1 : -1;
      for (long n = min(labs(steps), 8L); n > 0; n--) k.last = doRotate(k.rot, dir);   // cap a fast spin
      k.count += dir * labs(steps);
      oledDirty = true;
    }
    bool down = digitalRead(k.pinSw) == LOW;
    if (down != k.swDown && now - k.swChangedAt > 30) {    // 30 ms debounce
      k.swDown = down;
      k.swChangedAt = now;
      if (down) { k.last = doPress(k.press); oledDirty = true; }
    }
  }

  wm.process();
  if (!netStarted && WiFi.status() == WL_CONNECTED) startNetworkServices();
  if (netStarted) {
    server.handleClient();
    ArduinoOTA.handle();
  }

  if (oledDirty && now - oledDrawnAt > 50) {               // at most ~20 redraws a second
    drawDisplays();
    oledDirty = false;
    oledDrawnAt = now;
  }
}
