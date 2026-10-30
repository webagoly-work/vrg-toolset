// =============================================================================
// draw.ino — drawing helpers + the touch-zone table. Mirrors sim/skcyd-ui.js.
// =============================================================================

// zone ids
#define Z_BACK   1
#define Z_UP     2
#define Z_DOWN   3
#define Z_TILE0 10          // +0..4 home tiles
#define Z_DEP0  20          // +0..5 deployer buttons
#define Z_ROW0 100          // +row index, list rows

static const int ROW_H = 26;

void zReset() { gZoneN = 0; }
void zAdd(int x, int y, int w, int h, uint8_t id) { if (gZoneN < 48) { gZones[gZoneN++] = { (int16_t)x, (int16_t)y, (int16_t)w, (int16_t)h, id }; } }

void txt(const char* s, int x, int y, uint16_t color, uint8_t font, uint8_t datum) {
  tft.setTextColor(color, COL_BG);
  tft.setTextDatum(datum);
  tft.drawString(s, x, y, font);
}
void txtOn(const char* s, int x, int y, uint16_t color, uint16_t bg, uint8_t font, uint8_t datum) {
  tft.setTextColor(color, bg); tft.setTextDatum(datum); tft.drawString(s, x, y, font);
}

// clip a UTF-8-ish string to n chars (byte-ish; the CYD fonts are 8-bit latin)
void clipStr(const char* s, char* out, int n) { int i = 0; for (; s[i] && i < n; i++) out[i] = s[i]; if (s[i]) { out[n > 1 ? n - 1 : 0] = '~'; } out[i < n ? i : n] = 0; }

uint16_t statusColor(uint8_t c) {
  switch (c) { case 1: return COL_OK; case 2: return COL_WARN; case 3: return COL_FAIL; case 4: return COL_INFO; default: return COL_DIM; }
}

void header(const char* title) {
  tft.fillRect(0, 0, SCR_W, HEAD_H, COL_PANEL);
  tft.drawFastHLine(0, HEAD_H - 1, SCR_W, COL_CYANDIM);
  txtOn(title, 8, HEAD_H / 2, COL_CYAN, COL_PANEL, 4, ML_DATUM);
  // right: pc name + kit + heartbeat dot
  tft.fillCircle(SCR_W - 10, HEAD_H / 2, 3, gPcAlive ? COL_OK : COL_FAIL);
  char r[32];
  if (gKitPresent) snprintf(r, sizeof(r), "%s  KIT %s", gPcName, gKitDrive);
  else snprintf(r, sizeof(r), "%s  nincs KIT", gPcName);
  txtOn(r, SCR_W - 20, HEAD_H / 2, gKitPresent ? COL_DIM : COL_CYANDIM, COL_PANEL, 2, MR_DATUM);
}

void footer(const char* hint) {
  tft.fillRect(0, SCR_H - FOOT_H, SCR_W, FOOT_H, COL_PANEL);
  tft.drawFastHLine(0, SCR_H - FOOT_H, SCR_W, COL_LINE);
  txtOn(hint, 8, SCR_H - FOOT_H / 2, COL_DIM, COL_PANEL, 2, ML_DATUM);
}

void backChip() {
  tft.fillRect(0, SCR_H - FOOT_H, 62, FOOT_H, COL_PANEL);
  txtOn("< Vissza", 8, SCR_H - FOOT_H / 2, COL_CYAN, COL_PANEL, 2, ML_DATUM);
  zAdd(0, SCR_H - FOOT_H, 62, FOOT_H, Z_BACK);
}

void navFooter(int total, int visible) {
  tft.fillRect(0, SCR_H - FOOT_H, SCR_W, FOOT_H, COL_PANEL);
  tft.drawFastHLine(0, SCR_H - FOOT_H, SCR_W, COL_LINE);
  txtOn("< Vissza", 8, SCR_H - FOOT_H / 2, COL_CYAN, COL_PANEL, 2, ML_DATUM);
  zAdd(0, SCR_H - FOOT_H, 62, FOOT_H, Z_BACK);
  if (total > visible) {
    bool up = gScroll > 0, dn = gScroll + visible < total;
    txtOn("UP", SCR_W - 150, SCR_H - FOOT_H / 2, up ? COL_TEXT : COL_CYANDIM, COL_PANEL, 2, MC_DATUM);
    txtOn("DN", SCR_W - 90, SCR_H - FOOT_H / 2, dn ? COL_TEXT : COL_CYANDIM, COL_PANEL, 2, MC_DATUM);
    zAdd(SCR_W - 175, SCR_H - FOOT_H, 55, FOOT_H, Z_UP);
    zAdd(SCR_W - 115, SCR_H - FOOT_H, 55, FOOT_H, Z_DOWN);
  }
}

// a tappable button
void button(int x, int y, int w, int h, const char* label, uint8_t id, uint16_t accent, bool center) {
  tft.fillRect(x, y, w, h, COL_ROW);
  tft.drawRect(x, y, w, h, COL_LINE);
  if (accent) tft.fillRect(x, y, 3, h, accent);
  txtOn(label, center ? x + w / 2 : x + 10, y + h / 2, COL_TEXT, COL_ROW, 2, center ? MC_DATUM : ML_DATUM);
  if (id) zAdd(x, y, w, h, id);
}

// a scrolling list drawn from gList[] (SD or PC), with a path chip + nav footer
void listView(const char* title, bool showUp) {
  header(title);
  int top = HEAD_H + 2;
  tft.fillRect(0, top, SCR_W, 16, 0x0A22);
  char pc[48]; clipStr(gPath, pc, 46); txtOn(pc, 8, top + 8, COL_CYANDIM, 0x0A22, 2, ML_DATUM);
  if (gPcBusy) txtOn("...", SCR_W - 12, top + 8, COL_CYAN, 0x0A22, 2, MR_DATUM);
  top += 18;
  int visible = (SCR_H - top - FOOT_H) / ROW_H;

  // virtual row 0 = ".." when showUp
  int total = gListN + (showUp ? 1 : 0);
  for (int vi = gScroll; vi < total && vi - gScroll < visible; vi++) {
    int y = top + (vi - gScroll) * ROW_H;
    tft.fillRect(6, y + 1, SCR_W - 12, ROW_H - 2, COL_ROW);
    tft.drawRect(6, y + 1, SCR_W - 12, ROW_H - 2, COL_LINE);
    char nm[42];
    if (showUp && vi == 0) {
      txt("<", 14, y + ROW_H / 2, COL_CYAN, 4, ML_DATUM);
      txt("..", 30, y + ROW_H / 2, COL_TEXT, 2, ML_DATUM);
    } else {
      Entry& e = gList[vi - (showUp ? 1 : 0)];
      txt(e.isDir ? ">" : "-", 14, y + ROW_H / 2, e.isDir ? COL_AMBER : COL_CYAN, 4, ML_DATUM);
      clipStr(e.name, nm, 30); txt(nm, 30, y + ROW_H / 2, COL_TEXT, 2, ML_DATUM);
      if (!e.isDir) { char sz[14]; if (e.sizeKB >= 1024) snprintf(sz, sizeof(sz), "%lu MB", (unsigned long)(e.sizeKB / 1024)); else snprintf(sz, sizeof(sz), "%lu KB", (unsigned long)e.sizeKB); txt(sz, SCR_W - 14, y + ROW_H / 2, COL_DIM, 2, MR_DATUM); }
    }
    zAdd(6, y + 1, SCR_W - 12, ROW_H - 2, Z_ROW0 + vi);
  }
  navFooter(total, visible);
}

// text block viewer from gText
void textBlock(int top) {
  int lh = 14, visible = (SCR_H - top - FOOT_H) / lh;
  // split gText into lines on the fly
  int line = 0, i = 0, shown = 0;
  char buf[52];
  while (gText[i] && shown < visible) {
    int j = 0; while (gText[i] && gText[i] != '\n' && j < 50) buf[j++] = gText[i++];
    buf[j] = 0; if (gText[i] == '\n') i++;
    if (line >= gScroll) {
      // crude "header" highlight: all-caps short line
      bool hdr = true; for (int k = 0; buf[k]; k++) if (buf[k] >= 'a' && buf[k] <= 'z') { hdr = false; break; }
      uint16_t col = (hdr && j > 2) ? COL_AMBER : ((buf[0] >= '1' && buf[0] <= '9' && buf[1] == '.') ? COL_CYAN : COL_TEXT);
      txt(buf, 8, top + shown * lh + 7, col, 2, ML_DATUM);
      shown++;
    }
    line++;
  }
  navFooter(line, visible);
}

void drawToast() {
  if (!gToast[0]) return;
  int w = 220, x = (SCR_W - w) / 2, y = SCR_H - FOOT_H - 26;
  tft.fillRect(x, y, w, 20, 0x0622); tft.drawRect(x, y, w, 20, statusColor(gToastCol));
  txtOn(gToast, SCR_W / 2, y + 10, COL_WHITE, 0x0622, 2, MC_DATUM);
}
