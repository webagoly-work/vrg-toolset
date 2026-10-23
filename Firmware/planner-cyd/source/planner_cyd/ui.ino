// ui.ino - shell: helpers, header, info screens, settings, render, navigation, input,
// touch calibration and the RGB LED. Adapted from RL CYD v2 (single link, no radios).

// ---------------------------------------------------------------- helpers

// Black text on light colours, white on dark ones.
static uint16_t inkOn(uint16_t c) {
  int r = (c >> 11) << 3, g = ((c >> 5) & 0x3F) << 2, b = (c & 0x1F) << 3;
  return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? C_BG : C_TEXT;
}

// Copy `in` to `out`, cut with ".." so it fits in maxw pixels with the sprite's current font.
static void fitText(LGFX_Sprite& s, const char* in, int maxw, char* out, size_t n) {
  strlcpy(out, in, n);
  if (s.textWidth(out) <= maxw) return;
  for (size_t len = strlen(out); len > 0; --len) {
    if ((in[len] & 0xC0) == 0x80) continue;  // inside a multi-byte character
    char tmp[64];
    snprintf(tmp, sizeof tmp, "%.*s..", (int)len - 1, in);
    if (s.textWidth(tmp) <= maxw || len == 1) { strlcpy(out, tmp, n); return; }
  }
}

static void pushBand(int y, int h) {
  lcd.setClipRect(0, y, W, h);
  band.pushSprite(0, y);
  lcd.clearClipRect();
}

static void setRotation(int r) {
  cfg.rotation = r & 7;
  lcd.setRotation(cfg.rotation);
  saveSettings();
  invalidate();
}

// One centred line in its own band strip. All text goes through the band sprite, like the
// header: nothing is drawn straight onto the panel.
static void textStrip(int y, int h, const lgfx::IFont* font, uint16_t color, const char* text) {
  band.fillScreen(C_BG);
  band.setFont(font);
  band.setTextDatum(textdatum_t::middle_center);
  band.setTextColor(color);
  char fit[64];
  fitText(band, text, W - 16, fit, sizeof fit);
  band.drawString(fit, W / 2, h / 2);
  pushBand(y, h);
}

static void drawMessage(const char* title, const char* sub) {
  lcd.fillScreen(C_BG);
  textStrip(H / 2 - 32, 36, &huL, C_TEXT, title);
  textStrip(H / 2 + 6, 28, &huR, C_MUTED, sub);
}

// ---------------------------------------------------------------- header

// Header: [PC chip + Planner dot][ < PAGE > ][settings]
static const int CHIP_TAP_W = 122;  // x < this: KEZDOLAP
static const int PREV_TAP_X = 168;  // x < this (after the chip): previous page
static const int GEAR_TAP_X = 288;  // x > this: settings; between: next page

static void drawHeader() {
  band.fillScreen(C_BG);
  band.setFont(&huR);
  band.setTextDatum(textdatum_t::middle_left);

  char fit[24];
  bool on = bridgeAlive();
  uint16_t chip = on ? C_SRC_USB : C_TRACK;
  fitText(band, on ? lk.name : "Nincs PC", 100, fit, sizeof fit);
  int cw = band.textWidth(fit) + 12;
  band.fillRoundRect(2, 2, cw, 18, 5, chip);
  band.setTextColor(inkOn(chip));
  band.drawString(fit, 8, 11);
  if (on) band.fillCircle(cw + 9, 11, 3, lk.planner ? C_OK : C_BAD);

  band.setTextDatum(textdatum_t::middle_center);
  band.setTextColor(C_MUTED);
  band.drawString("<", 140, 11);
  band.drawString(">", 274, 11);
  band.setTextColor(C_TEXT);
  band.drawString(PAGE_NAME[page], 207, 11);

  uint16_t gc = page == PG_SETTINGS ? C_TEXT : C_MUTED;
  for (int i = 0; i < 3; ++i) band.fillRect(303, 5 + i * 5, 13, 2, gc);
  band.drawFastHLine(0, HDR_H - 1, W, C_TRACK);
  pushBand(0, HDR_H);
}

// ---------------------------------------------------------------- banner

// Bottom strip, drawn over whatever page is open; the page is redrawn when it ends.
static const int TOAST_Y = 204, TOAST_H = 34;

static void drawToast() {
  band.fillScreen(C_BG);
  uint16_t ink = inkOn(toast.color);
  band.fillRoundRect(4, 0, 312, TOAST_H, 6, toast.color);
  band.setFont(&huB);
  band.setTextDatum(textdatum_t::middle_left);
  band.setTextColor(ink);
  band.drawString(toast.title, 12, TOAST_H / 2);
  int tw = band.textWidth(toast.title);
  band.setFont(&huR);
  band.setTextDatum(textdatum_t::middle_right);
  char sub[48];
  fitText(band, toast.sub, 296 - tw - 12, sub, sizeof sub);
  band.drawString(sub, 308, TOAST_H / 2);
  pushBand(TOAST_Y, TOAST_H);
}

// ---------------------------------------------------------------- settings page

static const char* SET_LABELS[] = { "Kapcsolat", "Auto váltás", "Fényerő", "Képernyő forgatása", "Érintés kalibrálása", "< Vissza" };
static const int SET_N = 6, SET_ROW_H = 30, SET_Y0 = HDR_H + 4;

static void settingValue(int i, char* out, size_t n) {
  switch (i) {
    case 0:
      if (!bridgeAlive()) strlcpy(out, "nincs bridge", n);
      else snprintf(out, n, "%s, Planner %s", lk.name, lk.planner ? "OK" : "nincs");
      break;
    case 1: strlcpy(out, cfg.autoSwitch ? "Be (fázis / tétlenség)" : "Ki", n); break;
    case 2: snprintf(out, n, "%d%%", (BRIGHT[cfg.brightness] * 100 + 127) / 255); break;
    case 3: snprintf(out, n, "%d", cfg.rotation); break;
    case 4: strlcpy(out, cfg.calValid ? "Kész" : "Nincs", n); break;
    default: out[0] = 0;
  }
}

static void drawSettings() {
  for (int i = 0; i < SET_N; ++i) {
    band.fillScreen(C_BG);
    if (i == settingsSel) {
      band.fillRoundRect(4, 1, 312, SET_ROW_H - 2, 5, C_PANEL);
      band.fillRect(4, 1, 3, SET_ROW_H - 2, C_ORANGE);
    }
    band.setFont(&huR);
    band.setTextDatum(textdatum_t::middle_left);
    band.setTextColor(C_TEXT);
    band.drawString(SET_LABELS[i], 14, SET_ROW_H / 2);
    char v[48], fit[48];
    settingValue(i, v, sizeof v);
    band.setTextDatum(textdatum_t::middle_right);
    band.setTextColor(i == 0 && plannerLive() ? C_OK : C_MUTED);
    fitText(band, v, 170, fit, sizeof fit);
    band.drawString(fit, 308, SET_ROW_H / 2);
    pushBand(SET_Y0 + i * SET_ROW_H, SET_ROW_H);
  }
}

static void openSettings() {
  if (page != PG_SETTINGS) prevPage = page;
  page = PG_SETTINGS;
  settingsSel = 0;
  invalidate();
}

static void closeSettings() {
  page = prevPage;
  invalidate();
}

static void doSetting(int i) {
  switch (i) {
    case 1:
      cfg.autoSwitch = !cfg.autoSwitch;
      idleReturnPage = -1;
      phaseJump = false;
      saveSettings();
      break;
    case 2:
      cfg.brightness = (cfg.brightness + 1) % sizeof BRIGHT;
      lcd.setBrightness(BRIGHT[cfg.brightness]);
      saveSettings();
      break;
    case 3: {
      size_t k = 0;
      while (k < sizeof ROTATIONS && ROTATIONS[k] != cfg.rotation) ++k;
      setRotation(ROTATIONS[(k + 1) % sizeof ROTATIONS]);
      break;
    }
    case 4: calRequested = true; break;
    case 5: closeSettings(); return;
  }
  dirty |= D_SETTINGS | D_HDR;
}

// ---------------------------------------------------------------- info screens

static void infoStep(int y, const char* no, const char* text) {
  band.fillScreen(C_BG);
  band.fillCircle(28, 15, 10, C_PANEL);
  band.setFont(&huR);
  band.setTextDatum(textdatum_t::middle_center);
  band.setTextColor(C_TEXT);
  band.drawString(no, 28, 15);
  band.setTextDatum(textdatum_t::middle_left);
  band.setTextColor(C_SOFT);
  char fit[64];
  fitText(band, text, W - 54, fit, sizeof fit);
  band.drawString(fit, 46, 15);
  pushBand(y, 30);
}

static void drawInfo() {
  lcd.fillRect(0, HDR_H, W, H - HDR_H, C_BG);
  if (!bridgeAlive()) {
    textStrip(34, 36, &huL, C_TEXT, "Nincs kapcsolat");
    infoStep(78, "1", "Dugd a CYD-t a gépbe (USB)");
    infoStep(108, "2", "Makropad: START.cmd > K > 4");
    infoStep(138, "3", "Plannerrel: START.cmd > K > 1");
    textStrip(176, 24, &huR, C_MUTED, "Érintés: ÓRA oldal");
  } else {
    textStrip(34, 36, &huL, C_TEXT, "Várakozás a Plannerre");
    infoStep(78, "1", "Fusson a relay (a K > 1 elindítja)");
    infoStep(108, "2", "Nyisd meg a Plannert (magától kapcsol)");
    infoStep(138, "3", "Ha nem: Ctrl+K, írd be: relay");
    textStrip(176, 24, &huR, C_OK, "Érintés: KEZDŐLAP - makrók Planner nélkül is");
  }
  textStrip(212, 24, &huR, C_MUTED, "Beállítás: BOOT hosszan, vagy a jobb felső sarok");
}

// ---------------------------------------------------------------- render

// Which pages show the "connect" info screen instead of themselves: the Planner pages need a
// live tab, KEZDOLAP and MAKROK only the bridge, ORA and settings nothing.
static bool showsInfo(int p) {
  if (p == PG_SETTINGS || p == PG_CLOCK) return false;
  if (p == PG_HOME || p == PG_MACROS) return !bridgeAlive();
  return !plannerLive();
}

static void render() {
  static bool wasInfo = false;
  static uint32_t lastNet = 0;
  static bool wasAlive = false;

  // the clock and the settings work without a Planner; every other page needs the tab
  bool needInfo = showsInfo(page);
  if (needInfo != wasInfo) { wasInfo = needInfo; invalidate(); }

  if (millis() - lastNet > 500) {
    lastNet = millis();
    bool a = bridgeAlive();
    if (a != wasAlive) { wasAlive = a; invalidate(); }
  }

  if (!screenValid) {
    lcd.fillScreen(C_BG);
    dirty = D_ALL;
    screenValid = true;
  }

  if (toast.on && (int32_t)(millis() - toast.until) > 0) {
    toast.on = false;
    dirty |= D_ALL & ~D_HDR;  // repaint what the banner covered
  }
  if (pressedBtn >= 0 && (int32_t)(millis() - pressedUntil) > 0) { pressedBtn = -1; dirty |= D_BUTTONS; }

  // the clock rolls over a minute
  static uint32_t lastSec = 0;
  if (millis() - lastSec >= 1000) {
    lastSec = millis();
    static int lastMin = -1;
    struct tm tm;
    int m = localTime(&tm) ? tm.tm_hour * 60 + tm.tm_min : -1;
    if (m != lastMin) { lastMin = m; dirty |= D_CLOCK; }
  }

  uint16_t body = dirty & ~(D_HDR | D_TOAST);
  if (dirty & D_HDR) drawHeader();
  if (needInfo) {
    if (dirty & D_INFO) drawInfo();
  } else {
    switch (page) {
      case PG_HOME: if (dirty & (D_HOME | D_STATUS | D_BUTTONS)) drawHome(); break;
      case PG_STATUS: if (dirty & (D_STATUS | D_PHASES)) drawStatus(); break;
      case PG_TOOLS: if (dirty & (D_TOOLS | D_BUTTONS)) drawTools(); break;
      case PG_PHASES: if (dirty & (D_PHASES | D_STATUS | D_BUTTONS)) drawPhases(); break;
      case PG_CONTROLS: if (dirty & (D_CTRL | D_STATUS | D_BUTTONS)) drawControls(); break;
      case PG_MACROS: if (dirty & (D_MACROS | D_BUTTONS)) drawMacros(); break;
      case PG_TOTALS: if (dirty & D_TOTALS) drawTotals(); break;
      case PG_CLOCK: if (dirty & (D_CLOCK | D_STATUS | D_BUTTONS)) drawClock(); break;
      case PG_SETTINGS: if (dirty & D_SETTINGS) drawSettings(); break;
    }
  }
  // the banner sits on top: redraw it when it is new or when the page under it was drawn
  if (toast.on && (dirty & D_TOAST || body)) drawToast();
  dirty = 0;
}

// ---------------------------------------------------------------- navigation

// `manual` = the user chose this page, which cancels a pending return from the idle clock.

static void goPage(int p, bool manual) {
  if (manual) idleReturnPage = -1;
  if (p == page) return;
  bool same = showsInfo(p) && showsInfo(page);
  page = p;
  pressedBtn = -1;
  if (same) { dirty |= D_HDR; return; }  // same screen under a new name: no full redraw (no flash)
  invalidate();
}

static void stepPage(int dir) {
  int p = page == PG_SETTINGS ? prevPage : page;
  goPage((p + dir + PG_COUNT) % PG_COUNT, true);
}

// Auto switch. A phase change on the PC opens ESZKOZOK (the tools of the new phase);
// an idle Planner shows ORA, and work starting again goes back to the page before.
static void autoNav() {
  static uint32_t lastCheck = 0;
  if (millis() - lastCheck < 250) return;
  lastCheck = millis();
  bool jump = phaseJump;
  phaseJump = false;
  static bool wasBridge = false;
  bool br = bridgeAlive();
  // the bridge has just arrived (the CYD was plugged in, or the bridge started): the start page
  if (br && !wasBridge && page != PG_SETTINGS) goPage(PG_HOME, false);
  wasBridge = br;
  if (!cfg.autoSwitch || page == PG_SETTINGS) return;

  bool idle = bridgeAlive() && lk.idle;
  if (!idle) idleSnoozed = false;
  if (idle && !idleSnoozed && page != PG_CLOCK && idleReturnPage < 0) {
    idleReturnPage = page;
    goPage(PG_CLOCK, false);
  } else if (!idle && idleReturnPage >= 0) {
    goPage(idleReturnPage, false);
    idleReturnPage = -1;
  }
  if (jump) {
    if (page == PG_CLOCK && idleReturnPage >= 0) idleReturnPage = PG_TOOLS;  // back to the new phase's tools
    else if (page != PG_CLOCK) goPage(PG_TOOLS, false);
  }
}

static void pressFeedback(int i) {
  pressedBtn = i;
  pressedUntil = millis() + 180;
  dirty |= D_BUTTONS;
}

// ---------------------------------------------------------------- input

static void onShortPress() {
  if (page == PG_SETTINGS) {
    settingsSel = (settingsSel + 1) % SET_N;
    dirty |= D_SETTINGS;
  } else if (showsInfo(page)) {
    goPage(bridgeAlive() ? PG_HOME : PG_CLOCK, true);  // nothing to page through without a Planner
  } else {
    stepPage(1);
  }
}

static void onLongPress() {
  if (page == PG_SETTINGS) doSetting(settingsSel);
  else openSettings();
}

static void onTap(int32_t x, int32_t y) {
  if (page == PG_SETTINGS) {
    if (y < HDR_H) { if (x > GEAR_TAP_X) closeSettings(); return; }
    int row = (y - SET_Y0) / SET_ROW_H;
    if (row >= 0 && row < SET_N) {
      settingsSel = row;
      doSetting(row);
    }
    return;
  }
  if (y < HDR_H + 6) {
    if (x < CHIP_TAP_W) goPage(PG_HOME, true);
    else if (x > GEAR_TAP_X) openSettings();
    else if (x < PREV_TAP_X) stepPage(-1);
    else stepPage(1);
    return;
  }
  if (page == PG_CLOCK && openTap(x, y)) return;
  if (page == PG_CLOCK && idleReturnPage >= 0) {  // tap on the idle clock: back to work
    int8_t back = idleReturnPage;
    idleSnoozed = true;
    goPage(back, true);
    return;
  }
  if (showsInfo(page)) { goPage(bridgeAlive() ? PG_HOME : PG_CLOCK, true); return; }  // the info screen: tap = the start page
  // the button pages handle their own taps; the read-only pages step on
  if (page == PG_HOME && homeTap(x, y)) return;
  if (page == PG_TOOLS && toolsTap(x, y)) return;
  if (page == PG_PHASES && phasesTap(x, y)) return;
  if (page == PG_CONTROLS && controlsTap(x, y)) return;
  if (page == PG_MACROS && macrosTap(x, y)) return;
  stepPage(1);
}

static void pollInput() {
  static bool wasDown = false, longDone = false;
  static uint32_t lastPoll = 0, lastTap = 0, bootDown = 0;
  if (millis() - lastPoll < 30) return;
  lastPoll = millis();

  // Until the touchscreen is calibrated, any touch acts like a short BOOT press.
  int32_t x = -1, y = -1;
  bool down;
  if (cfg.calValid) {
    down = lcd.getTouch(&x, &y);
  } else {
    lgfx::touch_point_t tp;
    down = lcd.getTouchRaw(&tp, 1) > 0;
  }
  if (down && !wasDown && millis() - lastTap > 250) {
    lastTap = millis();
    if (cfg.calValid) onTap(x, y); else onShortPress();
  }
  wasDown = down;

  bool boot = digitalRead(PIN_BOOT) == LOW;
  if (boot) {
    if (!bootDown) { bootDown = millis(); longDone = false; }
    if (!longDone && millis() - bootDown > 1200) { longDone = true; onLongPress(); }
  } else if (bootDown) {
    if (!longDone && millis() - bootDown > 40) onShortPress();
    bootDown = 0;
  }
}

// ---------------------------------------------------------------- touch calibration

static void runCalibration() {
  lcd.fillScreen(C_BG);
  textStrip(H / 2 - 24, 24, &huR, C_TEXT, "Érintsd meg a nyilak hegyét");
  textStrip(H / 2, 24, &huR, C_MUTED, "(egyszerre egy sarkot)");
  lcd.calibrateTouch(cfg.cal, C_TEXT, C_BG, std::max(lcd.width(), lcd.height()) >> 3);
  lcd.setTouchCalibrate(cfg.cal);
  cfg.calValid = cfg.calAsked = true;
  saveSettings();
  invalidate();
}

// First boot: offer calibration, skip if nobody touches within 8 s.
static void offerCalibration() {
  drawMessage("Érintőképernyő beállítása", "Érintsd meg a kalibráláshoz (8 mp múlva kihagyja)");
  cfg.calAsked = true;
  saveSettings();
  uint32_t t0 = millis();
  while (millis() - t0 < 8000) {
    lgfx::touch_point_t tp;
    if (lcd.getTouchRaw(&tp, 1) > 0) {
      while (lcd.getTouchRaw(&tp, 1) > 0) delay(20);
      delay(200);
      runCalibration();
      return;
    }
    delay(20);
  }
  invalidate();
}

// ---------------------------------------------------------------- RGB LED

static void ledSet(bool r, bool g, bool b) {
#if HAS_RGB_LED
  digitalWrite(LED_R, !r);
  digitalWrite(LED_G, !g);
  digitalWrite(LED_B, !b);
#endif
}

static void ledFlash(bool r, bool g, bool b, uint32_t ms) {
  ledR = r;
  ledG = g;
  ledB = b;
  ledUntil = millis() + ms;
}

static void updateLed() {
#if HAS_RGB_LED
  if (!ledUntil || (int32_t)(millis() - ledUntil) > 0) { ledSet(false, false, false); ledUntil = 0; return; }
  bool on = (millis() / 150) % 2;
  ledSet(ledR && on, ledG && on, ledB && on);
#endif
}
