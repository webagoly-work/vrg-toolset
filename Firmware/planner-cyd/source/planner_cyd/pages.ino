// pages.ino - KEZDOLAP, the Planner pages (ALLAPOT, ESZKOZOK, FAZISOK, VEZERLES, OSSZESITES),
// MAKROK and ORA.
// Every strip is drawn into the 320 x 42 band sprite and pushed; taller strips in passes
// (draw at y - oy, push min(42, h - oy) rows).

// ---------------------------------------------------------------- shared bits

// ---- button labels
// Hungarian words are long ("Feladatkezelő", "Visszavonás"), so a button label is laid out in
// up to three tries: 15 px on two lines, then 12 px on three lines, then 12 px with long words
// hyphenated at a Hungarian syllable break (characters only as a last resort). Lines break at
// spaces and after a '-'. app/tools/label_fit.js runs the same rules over the preset labels.

static int utf8Len(uint8_t c) { return c < 0x80 ? 1 : (c >> 5) == 6 ? 2 : (c >> 4) == 14 ? 3 : (c >> 3) == 30 ? 4 : 1; }

static bool isVowelCp(uint32_t c) {
  switch (c) {
    case 'a': case 'e': case 'i': case 'o': case 'u': case 'A': case 'E': case 'I': case 'O': case 'U':
    case 0xE1: case 0xE9: case 0xED: case 0xF3: case 0xF6: case 0x151: case 0xFA: case 0xFC: case 0x171:
    case 0xC1: case 0xC9: case 0xCD: case 0xD3: case 0xD6: case 0x150: case 0xDA: case 0xDC: case 0x170:
      return true;
  }
  return false;
}

// Byte offsets in w where a Hungarian syllable may be broken: a digraph (cs dz dzs gy ly ny sz
// ty zs) is one letter, and between two vowels the last consonant starts the next syllable.
// At least two letters stay on each side. Returns how many offsets were written to at[].
static int syllableBreaks(const char* w, int* at, int maxAt) {
  uint32_t cp[32];
  int off[33], n = 0, b = 0;
  while (w[b] && n < 32) {
    int l = utf8Len((uint8_t)w[b]);
    uint32_t c = (uint8_t)w[b];
    if (l == 2) c = ((c & 0x1F) << 6) | (w[b + 1] & 0x3F);
    else if (l == 3) c = ((c & 0x0F) << 12) | ((w[b + 1] & 0x3F) << 6) | (w[b + 2] & 0x3F);
    off[n] = b;
    cp[n++] = c;
    b += l;
  }
  static const char* DG[] = { "dzs", "cs", "dz", "gy", "ly", "ny", "sz", "ty", "zs" };
  int ps[32], np = 0;
  bool pv[32];
  for (int i = 0; i < n;) {
    int took = 1;
    for (const char* d : DG) {
      int L = strlen(d);
      if (i + L > n) continue;
      bool m = true;
      for (int k = 0; k < L && m; ++k) m = cp[i + k] < 128 && tolower((int)cp[i + k]) == d[k];
      if (m) { took = L; break; }
    }
    ps[np] = i;
    pv[np++] = isVowelCp(cp[i]);
    i += took;
  }
  int cnt = 0;
  for (int i = 1; i < np && cnt < maxAt; ++i) {
    if (!pv[i] || pv[i - 1]) continue;
    int j = i - 1;
    while (j > 0 && !pv[j - 1]) j--;
    int c = ps[i - 1];
    if (j > 0 && c >= 2 && n - c >= 2) at[cnt++] = off[c];
  }
  return cnt;
}

// Greedy wrap with the band's current font. Returns the line count, or 0 if it needs more than
// maxLines (or a word is wider than maxw and breakWords is off).
static int wrapLabel(const char* s, int maxw, int maxLines, bool breakWords, char out[][32]) {
  int n = 0;
  out[0][0] = 0;
  while (*s) {
    while (*s == ' ') s++;
    if (!*s) break;
    char tok[32];
    int tl = 0;
    while (*s && *s != ' ' && tl < 30) { char c = *s++; tok[tl++] = c; if (c == '-') break; }
    tok[tl] = 0;
    // onto the current line?
    if (out[n][0]) {
      size_t ll = strlen(out[n]);
      bool glue = out[n][ll - 1] == '-';  // after a hyphen: no space
      char cand[64];
      snprintf(cand, sizeof cand, "%s%s%s", out[n], glue ? "" : " ", tok);
      if (band.textWidth(cand) <= maxw && strlen(cand) < 32) { strcpy(out[n], cand); continue; }
      if (++n >= maxLines) return 0;
      out[n][0] = 0;
    }
    if (band.textWidth(tok) <= maxw) { strlcpy(out[n], tok, 32); continue; }
    if (!breakWords) return 0;
    // the most even syllable break where both halves fit
    int at[12], na = syllableBreaks(tok, at, 12), best = -1, bestD = 1 << 30;
    for (int k = 0; k < na; ++k) {
      char p1[34];
      memcpy(p1, tok, at[k]);
      strcpy(p1 + at[k], "-");
      int w1 = band.textWidth(p1), w2 = band.textWidth(tok + at[k]), d = abs(w1 - w2);
      if (w1 <= maxw && w2 <= maxw && d < bestD) { best = at[k]; bestD = d; }
    }
    if (best >= 0) {
      memcpy(out[n], tok, best);
      strcpy(out[n] + best, "-");
      if (++n >= maxLines) return 0;
      strlcpy(out[n], tok + best, 32);
      continue;
    }
    // no syllable break fits: as many characters as fit with a trailing '-'
    const char* q = tok;
    while (*q) {
      char piece[32];
      int pl = 0;
      while (*q) {
        int cl = utf8Len((uint8_t)*q);
        if (pl + cl + 2 > (int)sizeof piece) break;
        char test[34];
        memcpy(test, piece, pl);
        memcpy(test + pl, q, cl);
        strcpy(test + pl + cl, q[cl] ? "-" : "");
        if (pl && band.textWidth(test) > maxw) break;
        memcpy(piece + pl, q, cl);
        pl += cl;
        q += cl;
      }
      piece[pl] = 0;
      if (*q) {
        strcat(piece, "-");
        strlcpy(out[n], piece, 32);
        if (++n >= maxLines) return 0;
        out[n][0] = 0;
      } else {
        strlcpy(out[n], piece, 32);
      }
    }
  }
  return out[n][0] ? n + 1 : n;
}

static void drawBtnLabel(const char* label, int cx, int cy, uint16_t ink, int maxw) {
  struct Try { const lgfx::IFont* font; int lines, lineH; bool brk; };
  static const Try TRIES[] = { { &huR, 2, 17, false }, { &huS, 3, 14, false }, { &huS, 3, 14, true } };
  char out[3][32];
  band.setTextDatum(textdatum_t::middle_center);
  band.setTextColor(ink);
  for (const Try& t : TRIES) {
    band.setFont(t.font);
    int n = wrapLabel(label, maxw, t.lines, t.brk, out);
    if (!n) continue;
    int y0 = cy - (n - 1) * t.lineH / 2;
    for (int i = 0; i < n; ++i) band.drawString(out[i], cx, y0 + i * t.lineH);
    return;
  }
  char fit[32];  // still too long (a label of nonsense): cut it on one line
  band.setFont(&huS);
  fitText(band, label, maxw, fit, sizeof fit);
  band.drawString(fit, cx, cy);
}

// A small rounded count chip: "3 hiba". Returns its width.
static int drawChip(int x, int y, int h, uint16_t fill, const char* text) {
  band.setFont(&huR);
  int w = band.textWidth(text) + 12;
  band.fillRoundRect(x, y, w, h, h / 2, fill);
  band.setTextDatum(textdatum_t::middle_center);
  band.setTextColor(inkOn(fill));
  band.drawString(text, x + w / 2, y + h / 2);
  return w;
}

static void noDataMessage(int y, const char* a, const char* b) {
  textStrip(y - 14, 28, &huR, C_SOFT, a);
  textStrip(y + 12, 24, &huR, C_MUTED, b);
}

// ---------------------------------------------------------------- button grid (tools, controls)

static const int G_COLS = 4, G_ROWS = 3, G_W = 76, G_H = 67, G_Y0 = 26, G_SX = 80, G_SY = 71;


static void drawGrid(int n, CellFn cell) {
  for (int r = 0; r < G_ROWS; ++r)
    for (int oy = 0; oy < G_H; oy += BAND_H) {
      band.fillScreen(C_BG);
      for (int c = 0; c < G_COLS; ++c) {
        int i = r * G_COLS + c, x = 4 + c * G_SX;
        const char* label = "";
        uint16_t fill = C_PANEL;
        bool used = i < n;
        if (used) cell(i, &label, &fill, &used);
        if (!used) { band.drawRoundRect(x, -oy, G_W, G_H, 10, C_PANEL); continue; }
        bool pr = pressedBtn == i;
        band.fillRoundRect(x, -oy, G_W, G_H, 10, pr ? C_TEXT : fill);
        drawBtnLabel(label, x + G_W / 2, G_H / 2 - oy, pr ? C_BG : inkOn(fill), G_W - 8);
      }
      pushBand(G_Y0 + r * G_SY + oy, std::min(BAND_H, G_H - oy));
    }
}

// -1 = between buttons
static int gridHit(int x, int y) {
  if (y < G_Y0) return -1;
  int c = (x - 4) / G_SX, r = (y - G_Y0) / G_SY;
  if (c < 0 || c >= G_COLS || r < 0 || r >= G_ROWS) return -1;
  if ((x - 4) % G_SX > G_W || (y - G_Y0) % G_SY > G_H) return -1;
  return r * G_COLS + c;
}

// ---------------------------------------------------------------- ALLAPOT

static const uint16_t C_LIVE = rgb(255, 150, 40);   // a running tool
static const uint16_t C_PHASE = rgb(40, 110, 220);  // the current phase

static void drawStatus() {
  const Status& s = lk.st;
  char buf[48], fit[48];

  // project + level
  band.fillScreen(C_BG);
  band.setFont(&huB);
  band.setTextDatum(textdatum_t::middle_left);
  band.setTextColor(C_TEXT);
  fitText(band, *s.proj ? s.proj : "(névtelen terv)", 210, fit, sizeof fit);
  band.drawString(fit, 8, 14);
  strlcpy(buf, *s.level ? s.level : "SZINT -", sizeof buf);
  band.setFont(&huR);
  int cw = band.textWidth(buf) + 12;
  drawChip(316 - cw, 5, 18, C_TRACK, buf);
  pushBand(24, 28);

  // the six phases as segments, the current one lit
  band.fillScreen(C_BG);
  int np = lk.nPhases ? lk.nPhases : MAX_PHASES;
  int segW = (312 - (np - 1) * 4) / np;
  for (int i = 0; i < np; ++i) {
    int x = 4 + i * (segW + 4);
    bool cur = i == s.phase;
    uint16_t f = cur ? C_PHASE : C_TRACK;
    band.fillRoundRect(x, 2, segW, 18, 5, f);
    band.setFont(&huR);
    band.setTextDatum(textdatum_t::middle_center);
    band.setTextColor(cur ? C_TEXT : C_MUTED);
    snprintf(buf, sizeof buf, "%d", i + 1);
    band.drawString(buf, x + segW / 2, 11);
    if (i < lk.nPhases && lk.phases[i].err) band.fillCircle(x + segW - 7, 7, 3, C_BAD);
    else if (i < lk.nPhases && lk.phases[i].warn) band.fillCircle(x + segW - 7, 7, 3, C_GOLD);
  }
  band.setTextDatum(textdatum_t::middle_left);
  band.setTextColor(C_MUTED);
  band.drawString("FÁZIS", 8, 32);
  band.setTextColor(C_TEXT);
  band.drawString(*s.phaseName ? s.phaseName : "-", 52, 32);
  pushBand(54, 40);

  // the running tool, big
  const int TH = 52;
  bool running = *s.tool;
  for (int oy = 0; oy < TH; oy += BAND_H) {
    band.fillScreen(C_BG);
    band.fillRoundRect(4, -oy, 312, TH, 8, C_PANEL);
    band.fillRoundRect(4, -oy, 6, TH, 3, running ? C_LIVE : C_NEUTRAL);
    band.setFont(&huR);
    band.setTextDatum(textdatum_t::top_left);
    band.setTextColor(C_MUTED);
    band.drawString("ESZKÖZ", 18, 4 - oy);
    band.setFont(&huL);
    band.setTextDatum(textdatum_t::baseline_left);
    band.setTextColor(running ? C_TEXT : C_MUTED);
    fitText(band, running ? s.tool : "Kijelölés", 290, fit, sizeof fit);
    band.drawString(fit, 18, 44 - oy);
    pushBand(96 + oy, std::min(BAND_H, TH - oy));
  }

  // layer, selection, checks, view
  const int LH = 50;
  for (int oy = 0; oy < LH; oy += BAND_H) {
    band.fillScreen(C_BG);
    band.setFont(&huR);
    band.setTextDatum(textdatum_t::top_left);
    band.setTextColor(C_MUTED);
    band.drawString("RÉTEG", 8, 4 - oy);
    band.setTextColor(C_TEXT);
    fitText(band, *s.layer ? s.layer : "-", 150, fit, sizeof fit);
    band.drawString(fit, 8, 22 - oy);
    if (s.sel) {
      snprintf(buf, sizeof buf, "%d kijelölve", s.sel);
      band.setTextColor(C_BLUE);
      band.drawString(buf, 8, 38 - oy);
    }
    int x = 170;
    snprintf(buf, sizeof buf, "%d hiba", s.err);
    x += drawChip(x, 4 - oy, 18, s.err ? C_BAD : C_TRACK, buf) + 6;
    snprintf(buf, sizeof buf, "%d figy.", s.warn);
    drawChip(x, 4 - oy, 18, s.warn ? C_GOLD : C_TRACK, buf);
    drawChip(170, 26 - oy, 18, C_TRACK, s.flat ? "2D alaprajz" : "3D nézet");
    pushBand(152 + oy, std::min(BAND_H, LH - oy));
  }
}

// ---------------------------------------------------------------- ESZKOZOK

static void toolCell(int i, const char** label, uint16_t* fill, bool* used) {
  *label = lk.tools[i].label;
  *fill = (lk.tools[i].flags & BTN_LIVE) ? C_LIVE : C_PANEL;
}

static void drawTools() {
  if (!lk.hasTools || !lk.nTools) {
    lcd.fillRect(0, HDR_H, W, H - HDR_H, C_BG);
    noDataMessage(110, "Ebben a fázisban nincs eszköz.", "Válts fázist a FÁZISOK oldalon.");
    return;
  }
  drawGrid(lk.nTools, toolCell);
}

static bool toolsTap(int x, int y) {
  int i = gridHit(x, y);
  if (i < 0) return true;              // between buttons: do nothing, don't change page
  if (i >= lk.nTools) return lk.nTools > 0;
  char line[12];
  snprintf(line, sizeof line, "!T|%d", i);
  sendAction(line);
  pressFeedback(i);
  return true;
}

// ---------------------------------------------------------------- FAZISOK

static const int F_W = 154, F_H = 67, F_Y0 = 26, F_SX = 158, F_SY = 71;

static void drawPhases() {
  char buf[24], fit[24];
  for (int r = 0; r < 3; ++r)
    for (int oy = 0; oy < F_H; oy += BAND_H) {
      band.fillScreen(C_BG);
      for (int c = 0; c < 2; ++c) {
        int i = r * 2 + c, x = 4 + c * F_SX;
        if (i >= lk.nPhases) { band.drawRoundRect(x, -oy, F_W, F_H, 10, C_PANEL); continue; }
        const Phase& p = lk.phases[i];
        bool cur = i == lk.st.phase, pr = pressedBtn == i;
        uint16_t f = pr ? C_TEXT : cur ? C_PHASE : C_PANEL, ink = inkOn(f);
        band.fillRoundRect(x, -oy, F_W, F_H, 10, f);
        band.setFont(&fonts::Font4);
        band.setTextDatum(textdatum_t::middle_center);
        band.setTextColor(pr ? C_BG : cur ? ink : C_MUTED);
        snprintf(buf, sizeof buf, "%d", i + 1);
        band.drawString(buf, x + 18, 22 - oy);
        band.setFont(&huB);
        band.setTextDatum(textdatum_t::middle_left);
        band.setTextColor(ink);
        fitText(band, p.name, F_W - 44, fit, sizeof fit);
        band.drawString(fit, x + 36, 22 - oy);
        int bx = x + 10;
        if (p.err) { snprintf(buf, sizeof buf, "%d hiba", p.err); bx += drawChip(bx, 42 - oy, 18, C_BAD, buf) + 4; }
        if (p.warn) { snprintf(buf, sizeof buf, "%d figy.", p.warn); drawChip(bx, 42 - oy, 18, C_GOLD, buf); }
        if (!p.err && !p.warn) {
          band.setFont(&huR);
          band.setTextDatum(textdatum_t::middle_left);
          band.setTextColor(cur ? ink : C_OK);
          band.drawString("rendben", x + 12, 51 - oy);
        }
      }
      pushBand(F_Y0 + r * F_SY + oy, std::min(BAND_H, F_H - oy));
    }
}

static bool phasesTap(int x, int y) {
  if (y < F_Y0) return true;
  int c = (x - 4) / F_SX, r = (y - F_Y0) / F_SY, i = r * 2 + c;
  if (c < 0 || c > 1 || r < 0 || r > 2 || i >= lk.nPhases) return true;
  char line[12];
  snprintf(line, sizeof line, "!P|%d", i);
  sendAction(line);
  pressFeedback(i);
  return true;
}

// ---------------------------------------------------------------- VEZERLES

static const char* CTRL_ID[12] = { "undo", "redo", "esc", "stop", "lvlup", "lvldn", "view3d", "home", "finish", "", "", "save" };
static const char* CTRL_LABEL[12] = { "Visszavon", "Újra", "Esc", "Kijelölés", "Szint fel", "Szint le", "", "Nézet alap",
                                      "Lezárás", "", "", "Mentés" };

static void ctrlCell(int i, const char** label, uint16_t* fill, bool* used) {
  if (!*CTRL_ID[i]) { *used = false; return; }
  *label = i == 6 ? (lk.st.flat ? "3D nézet" : "2D alaprajz") : CTRL_LABEL[i];
  if (i == 11) *fill = rgb(30, 130, 70);
  else if (i == 2) *fill = rgb(120, 45, 45);
  else if (i == 3 && *lk.st.tool) *fill = C_LIVE;   // Select ends the running tool
}

static void drawControls() { drawGrid(12, ctrlCell); }

static bool controlsTap(int x, int y) {
  int i = gridHit(x, y);
  if (i < 0 || !*CTRL_ID[i]) return true;
  char line[16];
  snprintf(line, sizeof line, "!C|%s", CTRL_ID[i]);
  sendAction(line);
  pressFeedback(i);
  return true;
}

// ---------------------------------------------------------------- MAKROK

static void macroCell(int i, const char** label, uint16_t* fill, bool* used) {
  *label = lk.macros[i].label;
  *fill = lk.macros[i].color;
}

static void drawMacros() {
  if (!lk.hasMacros || !lk.nMacros) {
    lcd.fillRect(0, HDR_H, W, H - HDR_H, C_BG);
    noDataMessage(110, lk.hasMacros ? "Nincs makró beállítva." : "Még nem jöttek makrók.", "A bridge mappájában: macros.json");
    return;
  }
  drawGrid(lk.nMacros, macroCell);
}

static bool macrosTap(int x, int y) {
  int i = gridHit(x, y);
  if (i < 0) return true;
  if (i >= lk.nMacros) return lk.nMacros > 0;
  char line[12];
  snprintf(line, sizeof line, "!M|%d", i);
  sendAction(line);
  pressFeedback(i);
  return true;
}

// ---------------------------------------------------------------- KEZDOLAP

// What the CYD shows when it is plugged in and the bridge answers: a big START.cmd button and
// the macro sets (macros.json) to choose from. A set tap makes it active and opens MAKROK.
static const int HOME_START_Y = 28, HOME_START_H = 44;
static const int HS_COLS = 3, HS_W = 100, HS_H = 48, HS_Y0 = 104, HS_SX = 106, HS_SY = 54;
static const int PRESS_START = 20, PRESS_SET = 30;   // pressedBtn ids on this page

static void drawHome() {
  char fit[48];

  // START.cmd
  band.fillScreen(C_BG);
  bool on = *lk.openLabel;
  bool pr = pressedBtn == PRESS_START;
  uint16_t f = !on ? C_TRACK : pr ? C_TEXT : rgb(40, 110, 220);
  band.fillRoundRect(8, 0, W - 16, HOME_START_H, 10, f);
  band.setFont(&huB);
  band.setTextDatum(textdatum_t::middle_center);
  band.setTextColor(pr ? C_BG : on ? C_TEXT : C_MUTED);
  fitText(band, on ? lk.openLabel : "Nincs START.cmd beállítva", W - 40, fit, sizeof fit);
  band.drawString(fit, W / 2, HOME_START_H / 2);
  pushBand(HOME_START_Y, HOME_START_H);

  // caption
  band.fillScreen(C_BG);
  band.setFont(&huR);
  band.setTextDatum(textdatum_t::middle_left);
  band.setTextColor(C_MUTED);
  band.drawString("MAKRÓKÉSZLET", 10, 12);
  band.setTextDatum(textdatum_t::middle_right);
  band.drawString("érintés: MAKRÓK", 310, 12);
  pushBand(78, 24);

  // the sets
  if (!lk.nSets) {
    lcd.fillRect(0, HS_Y0, W, 2 * HS_SY, C_BG);
    noDataMessage(HS_Y0 + 44, "Még nem jöttek makrókészletek.", "A bridge mappájában: macros.json");
  } else {
    for (int r = 0; r < 2; ++r)
      for (int oy = 0; oy < HS_H; oy += BAND_H) {
        band.fillScreen(C_BG);
        for (int c = 0; c < HS_COLS; ++c) {
          int i = r * HS_COLS + c, x = 4 + c * HS_SX;
          if (i >= lk.nSets) { band.drawRoundRect(x, -oy, HS_W, HS_H, 10, C_PANEL); continue; }
          bool act = i == lk.activeSet, p = pressedBtn == PRESS_SET + i;
          uint16_t fill = p ? C_TEXT : act ? rgb(46, 125, 91) : C_PANEL;
          band.fillRoundRect(x, -oy, HS_W, HS_H, 10, fill);
          if (act && !p) band.drawRoundRect(x, -oy, HS_W, HS_H, 10, C_OK);
          drawBtnLabel(lk.sets[i].name, x + HS_W / 2, HS_H / 2 - oy, p ? C_BG : inkOn(fill), HS_W - 10);
        }
        pushBand(HS_Y0 + r * HS_SY + oy, std::min(BAND_H, HS_H - oy));
      }
  }

  // the Planner, in one line
  if (plannerLive()) {
    char buf[48];
    snprintf(buf, sizeof buf, "Planner: %s", *lk.st.proj ? lk.st.proj : "(névtelen terv)");
    textStrip(214, 24, &huR, C_OK, buf);
  } else {
    textStrip(214, 24, &huR, C_MUTED, "Planner nincs megnyitva (START.cmd > K > 1)");
  }
}

static bool homeTap(int x, int y) {
  if (y >= HOME_START_Y && y < HOME_START_Y + HOME_START_H) {
    if (!*lk.openLabel) return true;
    sendAction("!O|start");
    pressFeedback(PRESS_START);
    return true;
  }
  if (y < HS_Y0) return true;
  int c = (x - 4) / HS_SX, r = (y - HS_Y0) / HS_SY;
  if (c < 0 || c >= HS_COLS || r < 0 || r > 1 || (x - 4) % HS_SX > HS_W || (y - HS_Y0) % HS_SY > HS_H) return true;
  int i = r * HS_COLS + c;
  if (i >= lk.nSets) return true;
  char line[12];
  snprintf(line, sizeof line, "!G|%d", i);
  sendAction(line);
  lk.activeSet = i;           // the bridge confirms with W| and the new M| buttons
  goPage(PG_MACROS, true);
  return true;
}

// ---------------------------------------------------------------- OSSZESITES

static void drawTotals() {
  const Totals& t = lk.tot;
  const char* lbl[] = { "Készülékek", "Pályák", "Áramkörök", "Kábelek", "Jegyzetek", "Hibák", "Figyelmeztetések" };
  int val[] = { t.dev, t.paths, t.circuits, t.cables, t.notes, lk.st.err, lk.st.warn };
  const int RH = 30;
  for (int i = 0; i < 7; ++i) {
    band.fillScreen(C_BG);
    if (i % 2 == 0) band.fillRect(0, 0, W, RH, C_PANEL);
    band.setFont(&huR);
    band.setTextDatum(textdatum_t::middle_left);
    band.setTextColor(C_SOFT);
    band.drawString(lbl[i], 12, RH / 2);
    char s[12];
    if (i < 5 && !t.has) strcpy(s, "-"); else snprintf(s, sizeof s, "%d", val[i]);
    band.setFont(&fonts::Font4);
    band.setTextDatum(textdatum_t::middle_right);
    uint16_t c = C_TEXT;
    if (i == 5 && val[i]) c = C_BAD;
    if (i == 6 && val[i]) c = C_GOLD;
    band.setTextColor(c);
    band.drawString(s, 308, RH / 2 + 1);
    pushBand(HDR_H + 2 + i * RH, RH);
  }
}

// ---------------------------------------------------------------- ORA

// Local time from the PC's Y| line, kept running on millis(). false until the first one.
static bool localTime(struct tm* out) {
  if (!clkEpoch) return false;
  time_t t = (time_t)clkEpoch + (millis() - clkMillis) / 1000 + cfg.tzMin * 60;
  gmtime_r(&t, out);
  return true;
}

static const int OPEN_X = 24, OPEN_W = 272, OPEN_Y = 178, OPEN_H = 32;

static const char* WEEKDAY_HU[7] = { "vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat" };

static void drawClock() {
  struct tm tm;
  bool has = localTime(&tm);
  char buf[48], fit[48];

  // HH:MM, big (Font7 is the 7-segment font: digits and ':' only)
  const int CH = 60;
  for (int oy = 0; oy < CH; oy += BAND_H) {
    band.fillScreen(C_BG);
    band.setFont(&fonts::Font7);
    band.setTextDatum(textdatum_t::middle_center);
    band.setTextColor(has ? C_TEXT : C_NEUTRAL);
    if (has) snprintf(buf, sizeof buf, "%02d:%02d", tm.tm_hour, tm.tm_min); else strcpy(buf, "--:--");
    band.drawString(buf, W / 2, CH / 2 - oy);
    pushBand(28 + oy, std::min(BAND_H, CH - oy));
  }

  // date
  band.fillScreen(C_BG);
  band.setFont(&huB);
  band.setTextDatum(textdatum_t::middle_center);
  band.setTextColor(C_SOFT);
  if (has) snprintf(buf, sizeof buf, "%04d. %02d. %02d.  %s", tm.tm_year + 1900, tm.tm_mon + 1, tm.tm_mday, WEEKDAY_HU[tm.tm_wday]);
  else strcpy(buf, "Az időt a PC küldi (bridge)");
  band.drawString(buf, W / 2, 14);
  pushBand(92, 28);

  // the Planner: project and when it was last worked in
  const int PH = 50;
  for (int oy = 0; oy < PH; oy += BAND_H) {
    band.fillScreen(C_BG);
    band.fillRoundRect(4, -oy, 312, PH, 8, C_PANEL);
    band.setFont(&huR);
    band.setTextDatum(textdatum_t::top_left);
    band.setTextColor(C_MUTED);
    band.drawString("PLANNER", 14, 6 - oy);
    band.setTextColor(plannerLive() ? C_TEXT : C_MUTED);
    fitText(band, plannerLive() ? (*lk.st.proj ? lk.st.proj : "(névtelen terv)") : "nincs megnyitva", 200, fit, sizeof fit);
    band.drawString(fit, 14, 24 - oy);
    if (lk.lastAct) {
      time_t t = (time_t)lk.lastAct + cfg.tzMin * 60;
      struct tm la;
      gmtime_r(&t, &la);
      snprintf(buf, sizeof buf, "utolsó munka %02d:%02d", la.tm_hour, la.tm_min);
      band.setTextDatum(textdatum_t::top_right);
      band.setTextColor(C_MUTED);
      band.drawString(buf, 306, 6 - oy);
    }
    if (lk.idle && bridgeAlive()) {
      band.setTextDatum(textdatum_t::top_right);
      band.setTextColor(C_GOLD);
      band.drawString("tétlen", 306, 24 - oy);
    }
    pushBand(124 + oy, std::min(BAND_H, PH - oy));
  }

  // the button: open START.cmd on the PC
  band.fillScreen(C_BG);
  if (*lk.openLabel && bridgeAlive()) {
    bool pr = pressedBtn == 0;
    uint16_t f = pr ? C_TEXT : rgb(40, 110, 220);
    band.fillRoundRect(OPEN_X, 0, OPEN_W, OPEN_H, 8, f);
    band.setFont(&huB);
    band.setTextDatum(textdatum_t::middle_center);
    band.setTextColor(pr ? C_BG : C_TEXT);
    fitText(band, lk.openLabel, OPEN_W - 16, fit, sizeof fit);
    band.drawString(fit, W / 2, OPEN_H / 2);
  }
  pushBand(OPEN_Y, OPEN_H);
}

static bool openTap(int x, int y) {
  if (!*lk.openLabel || !bridgeAlive()) return false;
  if (x < OPEN_X || x > OPEN_X + OPEN_W || y < OPEN_Y || y > OPEN_Y + OPEN_H) return false;
  sendAction("!O|start");
  pressFeedback(0);
  return true;
}
