// =============================================================================
// pages.ino — page navigation, rendering dispatch, and touch handling.
// Mirrors the simulator's page set: home · sd · pc · deploy · rescue · status · text
// =============================================================================

const char* pageName(Page p) {
  switch (p) { case PG_HOME: return "home"; case PG_SD: return "sd"; case PG_PC: return "pc";
    case PG_DEPLOY: return "deploy"; case PG_RESCUE: return "rescue"; case PG_STATUS: return "status"; default: return "text"; }
}

void requestDrives();                 // proto.ino
void bridgeLs(const char* path);      // proto.ino
void bridgeRun(const char* action, const char* arg);   // proto.ino
void bridgeOpen(const char* path);    // proto.ino

void goPage(Page p) {
  gPage = p; gScroll = 0;
  if (p == PG_SD) { strcpy(gPath, "/"); sdList(gPath); }
  else if (p == PG_PC) { gPath[0] = 0; gDriveN = 0; requestDrives(); }
  else if (p == PG_RESCUE) { sdReadText("/reference/bios-boot-keys.txt", gText, TEXT_MAX); }
  Serial.printf("P|%s\n", pageName(p));
  drawPage();
}

// ------------------------------------------------------------------ dispatch
void drawPage() {
  zReset();
  tft.fillScreen(COL_BG);
  switch (gPage) {
    case PG_HOME:   pageHome(); break;
    case PG_SD:     listView("SD-kartya", strcmp(gPath, "/") != 0); break;
    case PG_PC:     pagePc(); break;
    case PG_DEPLOY: pageDeploy(); break;
    case PG_RESCUE: header("Mento - offline"); textBlock(HEAD_H + 4); break;
    case PG_STATUS: pageStatus(); break;
    case PG_TEXT:   header(gTextName); textBlock(HEAD_H + 4); break;
  }
  drawToast();
}

// ------------------------------------------------------------------ home
struct Tile { const char* label; const char* sub; Page page; uint16_t accent; bool standalone; };
Tile gTiles[5] = {
  { "SD-kartya", "offline tar",        PG_SD,     COL_CYAN,  true },
  { "Mento",     "boot - BIOS",        PG_RESCUE, COL_AMBER, true },
  { "Telepito",  "deploy - ellenorzes", PG_DEPLOY, COL_CYAN,  false },
  { "Gep",       "meghajtok",          PG_PC,     COL_CYAN,  false },
  { "Allapot",   "munka - forgatokonyv", PG_STATUS, COL_CYAN, true }
};
void pageHome() {
  header("ServiceKit CYD");
  int x0 = 8, y0 = HEAD_H + 8, tw = (SCR_W - 16 - 8) / 2, th = 54;
  for (int i = 0; i < 5; i++) {
    int col = i % 2, row = i / 2;
    int x = x0 + col * (tw + 8), y = y0 + row * (th + 7);
    bool live = gTiles[i].standalone || gPcAlive;
    tft.fillRect(x, y, tw, th, 0x0E22);
    tft.drawRect(x, y, tw, th, live ? COL_LINE : 0x1082);
    tft.fillRect(x, y, 3, th, gTiles[i].accent);
    txt(gTiles[i].label, x + 10, y + 16, live ? COL_WHITE : COL_DIM, 4, ML_DATUM);
    txt(gTiles[i].sub, x + 10, y + 37, COL_DIM, 2, ML_DATUM);
    if (!live) txt("PC kell", x + tw - 8, y + 16, COL_CYANDIM, 2, MR_DATUM);
    zAdd(x, y, tw, th, Z_TILE0 + i);
  }
  footer(gPcAlive ? "Hid kapcsolodva" : "Onallo mod - SD es Mento PC nelkul is");
}

// ------------------------------------------------------------------ PC explorer
void pagePc() {
  if (!gPcAlive) { header("Gep - meghajtok"); txt("Nincs el PC", SCR_W / 2, SCR_H / 2 - 10, COL_DIM, 4, MC_DATUM); txt("Inditsd a hidat a gepen", SCR_W / 2, SCR_H / 2 + 12, COL_DIM, 2, MC_DATUM); backChip(); return; }
  if (gPath[0] == 0) {    // drive roots
    header("Gep - meghajtok");
    int top = HEAD_H + 4, visible = (SCR_H - top - FOOT_H) / ROW_H;
    for (int i = gScroll; i < gDriveN && i - gScroll < visible; i++) {
      int y = top + (i - gScroll) * ROW_H;
      tft.fillRect(6, y + 1, SCR_W - 12, ROW_H - 2, COL_ROW); tft.drawRect(6, y + 1, SCR_W - 12, ROW_H - 2, COL_LINE);
      tft.fillRect(6, y + 1, 3, ROW_H - 2, gDrives[i].removable ? COL_AMBER : COL_CYAN);
      char nm[36]; snprintf(nm, sizeof(nm), "%s  %s", gDrives[i].id, gDrives[i].label);
      txt(nm, 16, y + ROW_H / 2, COL_TEXT, 2, ML_DATUM);
      char sz[20]; snprintf(sz, sizeof(sz), "%u/%u GB", gDrives[i].freeGB, gDrives[i].totalGB);
      txt(sz, SCR_W - 14, y + ROW_H / 2, COL_DIM, 2, MR_DATUM);
      zAdd(6, y + 1, SCR_W - 12, ROW_H - 2, Z_ROW0 + i);
    }
    navFooter(gDriveN, visible);
  } else {
    listView("Gep", true);
  }
}

// ------------------------------------------------------------------ deployer
void pageDeploy() {
  header("Telepito");
  if (!gPcAlive) { txt("Nincs el PC", SCR_W / 2, SCR_H / 2 - 10, COL_DIM, 4, MC_DATUM); txt("A telepitohoz a hid kell", SCR_W / 2, SCR_H / 2 + 12, COL_DIM, 2, MC_DATUM); backChip(); return; }
  int y = HEAD_H + 6, bw = SCR_W - 16, bh = 30;
  char k[40];
  if (gKitPresent) snprintf(k, sizeof(k), "Pendrive: %s  v%s", gKitDrive, gKitVer);
  else snprintf(k, sizeof(k), "Nincs ServiceKit pendrive");
  tft.fillRect(8, y, bw, 22, 0x0A22); txtOn(k, 14, y + 11, gKitPresent ? COL_OK : COL_FAIL, 0x0A22, 2, ML_DATUM);
  y += 28;
  button(8, y, bw, bh, "Ellenorzes (verify)", Z_DEP0 + 0, COL_CYAN, false); y += bh + 5;
  button(8, y, bw, bh, "Dashboard inditasa", Z_DEP0 + 1, COL_OK, false); y += bh + 5;
  int hw = (bw - 5) / 2;
  button(8, y, hw, bh, "Setup", Z_DEP0 + 2, COL_CYAN, true);
  button(8 + hw + 5, y, hw, bh, "Kit Shell", Z_DEP0 + 3, COL_CYAN, true); y += bh + 5;
  button(8, y, hw, bh, "Telepit C:", Z_DEP0 + 4, COL_AMBER, true);
  button(8 + hw + 5, y, hw, bh, "Boot USB", Z_DEP0 + 5, COL_AMBER, true);
  if (gWizText[0]) { tft.fillRect(0, SCR_H - FOOT_H, SCR_W, FOOT_H, COL_PANEL); char t[50]; snprintf(t, sizeof(t), "- %s", gWizText); txtOn(t, 8, SCR_H - FOOT_H / 2, statusColor(gWizCol), COL_PANEL, 2, ML_DATUM); }
  else footer("A muvelet a hidon fut, az eredmeny itt latszik");
  backChip();
}

// ------------------------------------------------------------------ status
void pageStatus() {
  header("Allapot");
  if (!gPcAlive) { txt("Nincs el PC", SCR_W / 2, SCR_H / 2, COL_DIM, 4, MC_DATUM); backChip(); return; }
  int y = HEAD_H + 8, bw = SCR_W - 16;
  char v[48];
  // job
  tft.fillRect(8, y, bw, 26, COL_ROW); tft.drawRect(8, y, bw, 26, COL_LINE);
  txt("Munka", 14, y + 13, COL_DIM, 2, ML_DATUM);
  if (gJobClient[0]) snprintf(v, sizeof(v), "%s - %s", gJobClient, gJobComputer); else strcpy(v, "-");
  txt(v, SCR_W - 14, y + 13, gJobClient[0] ? COL_CYAN : COL_DIM, 2, MR_DATUM); y += 30;
  if (gPbTitle[0]) {
    tft.fillRect(8, y, bw, 26, COL_ROW); tft.drawRect(8, y, bw, 26, COL_LINE);
    txt("Forgatokonyv", 14, y + 13, COL_DIM, 2, ML_DATUM); txt(gPbTitle, SCR_W - 14, y + 13, COL_CYAN, 2, MR_DATUM); y += 30;
    tft.fillRect(8, y, bw, 26, COL_ROW); tft.drawRect(8, y, bw, 26, COL_LINE);
    txt("Lepesek", 14, y + 13, COL_DIM, 2, ML_DATUM);
    snprintf(v, sizeof(v), "%d / %d%s", gPbDone, gPbTotal, gPbRunning ? "  >" : "");
    txt(v, SCR_W - 14, y + 13, gPbRunning ? COL_AMBER : COL_OK, 2, MR_DATUM); y += 30;
  }
  if (gStepText[0]) {
    tft.fillRect(8, y, bw, 38, COL_ROW); tft.fillRect(8, y, 3, 38, statusColor(gStepCol));
    char t[52]; clipStr(gStepText, t, 44); txt(t, 16, y + 19, COL_TEXT, 2, ML_DATUM); y += 42;
  }
  if (!gJobClient[0] && !gPbTitle[0]) txt("Nincs aktiv munka", SCR_W / 2, SCR_H / 2 + 10, COL_DIM, 4, MC_DATUM);
  backChip();
}

// ------------------------------------------------------------------ touch router
void handleTouch(int id) {
  if (id == Z_BACK) { onBack(); return; }
  if (id == Z_UP) { if (gScroll > 0) { gScroll -= 6; if (gScroll < 0) gScroll = 0; drawPage(); } return; }
  if (id == Z_DOWN) { gScroll += 6; drawPage(); return; }

  if (gPage == PG_HOME && id >= Z_TILE0 && id < Z_TILE0 + 5) {
    Tile& t = gTiles[id - Z_TILE0];
    if (t.standalone || gPcAlive) goPage(t.page); else toast(2, "Ehhez el PC kell");
    return;
  }
  if (gPage == PG_DEPLOY && id >= Z_DEP0 && id < Z_DEP0 + 6) {
    switch (id - Z_DEP0) {
      case 0: gWizText[0] = 0; bridgeRun("verify", ""); toast(4, "Ellenorzes..."); break;
      case 1: bridgeRun("launch", "dashboard"); break;
      case 2: bridgeRun("launch", "setup"); break;
      case 3: bridgeRun("launch", "shell"); break;
      case 4: bridgeRun("deploy", "dest:C:\\ServiceKit;confirm:1"); toast(4, "Masolas..."); break;   // TODO: on-screen confirm modal
      case 5: bridgeRun("makeboot", ""); break;
    }
    return;
  }
  if ((gPage == PG_SD || gPage == PG_PC) && id >= Z_ROW0) {
    int vi = id - Z_ROW0;
    if (gPage == PG_SD) onSdRow(vi);
    else onPcRow(vi);
    return;
  }
}

void onBack() {
  if (gPage == PG_TEXT) { goPage(gTextFrom); return; }
  if (gPage == PG_SD && strcmp(gPath, "/") != 0) { pathPop(); sdList(gPath); gScroll = 0; drawPage(); return; }
  if (gPage == PG_PC && gPath[0]) {
    // "C:/" -> roots; deeper -> parent
    if (strlen(gPath) <= 3) { gPath[0] = 0; gScroll = 0; drawPage(); }
    else { pathPop(); bridgeLs(gPath); }
    return;
  }
  goPage(PG_HOME);
}

void onSdRow(int vi) {
  bool showUp = strcmp(gPath, "/") != 0;
  if (showUp && vi == 0) { pathPop(); sdList(gPath); gScroll = 0; drawPage(); return; }
  Entry& e = gList[vi - (showUp ? 1 : 0)];
  if (e.isDir) { pathPush(e.name); sdList(gPath); gScroll = 0; drawPage(); }
  else {
    char full[200]; snprintf(full, sizeof(full), "%s%s%s", gPath, (gPath[strlen(gPath) - 1] == '/') ? "" : "/", e.name);
    if (sdReadText(full, gText, TEXT_MAX)) { strncpy(gTextName, e.name, sizeof(gTextName) - 1); gTextName[sizeof(gTextName) - 1] = 0; gTextFrom = PG_SD; goPage(PG_TEXT); }
    else toast(2, "Nincs elonezet");
  }
}

void onPcRow(int vi) {
  if (gPath[0] == 0) {      // a drive
    if (vi < gDriveN) { snprintf(gPath, sizeof(gPath), "%s/", gDrives[vi].id); gScroll = 0; bridgeLs(gPath); }
    return;
  }
  bool showUp = true;
  if (vi == 0) { onBack(); return; }
  Entry& e = gList[vi - 1];
  char full[200]; snprintf(full, sizeof(full), "%s%s%s", gPath, (gPath[strlen(gPath) - 1] == '/') ? "" : "/", e.name);
  if (e.isDir) { strncpy(gPath, full, sizeof(gPath) - 1); gPath[sizeof(gPath) - 1] = 0; gScroll = 0; bridgeLs(gPath); }
  else { bridgeOpen(full); toast(4, "Megnyitas a gepen..."); }
}
