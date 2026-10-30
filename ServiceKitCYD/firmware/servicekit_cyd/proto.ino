// =============================================================================
// proto.ino — the serial line protocol (../../bridge/protocol.md). Reads bridge
// -> CYD lines, and sends CYD -> bridge requests.
// =============================================================================

static char gRx[LINE_MAX];
static uint16_t gRxN = 0;

// pull field #idx (0-based) out of a '|'-split line into out
static void field(const char* line, int idx, char* out, size_t cap) {
  out[0] = 0; int cur = 0; size_t o = 0;
  for (const char* p = line; ; p++) {
    if (*p == '|' || *p == 0) { if (cur == idx) { out[o] = 0; return; } cur++; o = 0; if (*p == 0) return; }
    else if (cur == idx && o < cap - 1) out[o++] = *p;
  }
}
static uint8_t colOf(const char* s) {
  if (!strcmp(s, "ok") || !strcmp(s, "done")) return 1;
  if (!strcmp(s, "warn")) return 2;
  if (!strcmp(s, "fail")) return 3;
  if (!strcmp(s, "info") || !strcmp(s, "run")) return 4;
  return 0;
}

void serialPoll() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') { gRx[gRxN] = 0; if (gRxN) handleLine(gRx); gRxN = 0; }
    else if (c != '\r' && gRxN < LINE_MAX - 1) gRx[gRxN++] = c;
    else if (gRxN >= LINE_MAX - 1) gRxN = 0;   // overrun guard
  }
}

void handleLine(const char* ln) {
  char tag[8]; field(ln, 0, tag, sizeof(tag));
  char a[64], b[64], d[16], e[16];

  if (!strcmp(tag, "HELLO")) { field(ln, 1, gPcName, sizeof(gPcName)); field(ln, 2, b, sizeof(b)); gPcAlive = true; gLastHb = millis(); drawPage(); }
  else if (!strcmp(tag, "HB")) { field(ln, 1, a, sizeof(a)); gLastHb = millis(); bool was = gPcAlive; gPcAlive = (a[0] == '1'); if (was != gPcAlive) drawPage(); }
  else if (!strcmp(tag, "KIT")) { field(ln, 1, a, sizeof(a)); gKitPresent = (a[0] == '1'); field(ln, 2, gKitDrive, sizeof(gKitDrive)); field(ln, 3, gKitVer, sizeof(gKitVer)); if (gPage == PG_HOME || gPage == PG_DEPLOY) drawPage(); }
  else if (!strcmp(tag, "JOB")) { field(ln, 1, gJobClient, sizeof(gJobClient)); if (!strcmp(gJobClient, "-")) gJobClient[0] = 0; field(ln, 2, gJobComputer, sizeof(gJobComputer)); field(ln, 3, gJobStatus, sizeof(gJobStatus)); field(ln, 4, d, sizeof(d)); gJobMin = atoi(d); if (gPage == PG_STATUS) drawPage(); }
  else if (!strcmp(tag, "PB")) { field(ln, 1, gPbTitle, sizeof(gPbTitle)); field(ln, 2, d, sizeof(d)); gPbDone = atoi(d); field(ln, 3, e, sizeof(e)); gPbTotal = atoi(e); field(ln, 4, a, sizeof(a)); gPbRunning = (a[0] == '1'); if (gPage == PG_STATUS) drawPage(); }
  else if (!strcmp(tag, "STEP")) { field(ln, 1, a, sizeof(a)); gStepCol = colOf(a); field(ln, 2, gStepText, sizeof(gStepText)); if (gStepCol == 3) ledFlash(1, 0, 0, 1500); if (gPage == PG_STATUS) drawPage(); }
  else if (!strcmp(tag, "SETUP")) { field(ln, 1, d, sizeof(d)); gSetupDone = atoi(d); field(ln, 2, e, sizeof(e)); gSetupTotal = atoi(e); field(ln, 3, gSetupPhase, sizeof(gSetupPhase)); if (gPage == PG_STATUS) drawPage(); }
  else if (!strcmp(tag, "DRV")) {
    if (gDriveN < 8) { Drive& dr = gDrives[gDriveN]; field(ln, 1, dr.id, sizeof(dr.id)); field(ln, 2, dr.label, sizeof(dr.label));
      field(ln, 3, d, sizeof(d)); dr.freeGB = atoi(d); field(ln, 4, e, sizeof(e)); dr.totalGB = atoi(e);
      field(ln, 5, a, sizeof(a)); dr.removable = !strcmp(a, "removable"); gDriveN++; if (gPage == PG_PC && gPath[0] == 0) drawPage(); }
  }
  else if (!strcmp(tag, "DBEG")) { gListN = 0; gPcBusy = true; }
  else if (!strcmp(tag, "D")) {
    if (gListN < MAX_LIST) { Entry& en = gList[gListN]; field(ln, 1, en.name, sizeof(en.name)); field(ln, 2, a, sizeof(a)); en.isDir = (a[0] == '1'); field(ln, 3, d, sizeof(d)); en.sizeKB = strtoul(d, NULL, 10); gListN++; }
  }
  else if (!strcmp(tag, "DEND")) { gPcBusy = false; if (gPage == PG_PC) drawPage(); }
  else if (!strcmp(tag, "WIZ")) { field(ln, 3, a, sizeof(a)); gWizCol = colOf(a); field(ln, 4, gWizText, sizeof(gWizText));
    if (gWizCol == 1) ledFlash(0, 1, 0, 1200); else if (gWizCol == 3) ledFlash(1, 0, 0, 1500);
    if (gWizText[0]) toast(gWizCol, gWizText); if (gPage == PG_DEPLOY) drawPage(); }
  else if (!strcmp(tag, "MSG")) { field(ln, 1, a, sizeof(a)); field(ln, 2, b, sizeof(b)); toast(colOf(a), b); }
  // ACK ignored for now
}

// ------------------------------------------------------------------ CYD -> bridge
void requestDrives() { gDriveN = 0; gLastDrvReq = millis(); Serial.println("DRIVES"); }
void bridgeLs(const char* path) { gPcBusy = true; gListN = 0; Serial.printf("LS|%s|%u\n", path, gCmd++); drawPage(); }
void bridgeRun(const char* action, const char* arg) { Serial.printf("RUN|%s|%s|%u\n", action, arg, gCmd++); }
void bridgeOpen(const char* path) { Serial.printf("OPEN|%s|%u\n", path, gCmd++); }
