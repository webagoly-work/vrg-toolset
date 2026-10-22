// protocol.ino - the line protocol (full spec: ../../README.md).
//
// Bridge -> CYD, one line each, fields separated by '|', ASCII only:
//   L|planner             heartbeat, 1 s; planner = 1 while a Planner tab is live
//   N|name                PC name for the header chip
//   S|proj|level|phase|phaseName|tool|layer|sel|err|warn|flat   status (on change)
//   K|i|label|flags       tool button i of the current phase (flags: a = running)
//   J|n                   commit n tool buttons
//   P|i|name|err|warn     phase i
//   R|n                   commit n phases
//   A|dev|paths|circuits|cables|notes   totals
//   E|kind|title|sub      banner: kind 0 info, 1 ok, 2 warning, 3 error
//   Y|epoch|tzMin         clock: UTC seconds and the local offset in minutes
//   Z|idle|lastAct        idle = 1 when nobody works in the Planner; lastAct = UTC s of the last work
//   B|label               the KEZDŐLAP / ÓRA button (opens START.cmd on the PC); B| alone = no button
//   M|i|label|hex         MAKROK button i (colour as RRGGBB)
//   X|n                   commit n MAKROK buttons
//   Q|i|name              button set i (macros.json), for the KEZDŐLAP
//   W|n|active            commit n sets; active = the one MAKROK shows
//   ?                     ask for #HELLO and #STAT
//   O|rot  I|0/1  C|1     rotation 0-7, colour inversion, start touch calibration
//   U|pageId              show a page: home status tools phases controls macros totals clock settings
//
// CYD -> bridge: '#' lines (#HELLO, #STAT every 5 s) and button presses:
//   !T|i   tool button i      !P|i   phase i
//   !C|undo redo esc stop lvlup lvldn view3d home finish save
//   !M|i      MAKROK button i (the bridge runs it)
//   !G|i      KEZDŐLAP: make button set i the active one
//   !O|start  the KEZDŐLAP / ÓRA button: the bridge opens the file it was configured with

static int fi(const char* s) { return (s && *s) ? atoi(s) : 0; }

static uint16_t hexColor(const char* s, uint16_t def) {
  if (!s || strlen(s) != 6) return def;
  uint32_t v = strtoul(s, nullptr, 16);
  return rgb(v >> 16, (v >> 8) & 0xFF, v & 0xFF);
}

static void showToast(uint16_t color, const char* title, const char* sub) {
  toast.on = true;
  toast.until = millis() + 3500;
  toast.color = color;
  strlcpy(toast.title, title, sizeof toast.title);
  strlcpy(toast.sub, sub, sizeof toast.sub);
  dirty |= D_TOAST;
}

static void sendAction(const char* line) { Serial.println(line); }

static void handleLine(char* line) {
  char* f[12];
  int n = 0;
  f[n++] = line;
  for (char* p = line; *p && n < 12; ++p)
    if (*p == '|') { *p = 0; f[n++] = p + 1; }
  if (f[0][0] == 0 || f[0][1] != 0) { lk.linesBad++; return; }

  switch (f[0][0]) {
    case 'L': {
      bool v = fi(n > 1 ? f[1] : nullptr) != 0;
      if (v != lk.planner) { lk.planner = v; invalidate(); }
      break;
    }
    case 'N':
      if (n > 1 && *f[1] && strcmp(lk.name, f[1])) { strlcpy(lk.name, f[1], sizeof lk.name); dirty |= D_HDR | D_INFO; }
      break;
    case 'S': {
      if (n < 11) { lk.linesBad++; return; }
      Status s = {};
      s.has = true;
      strlcpy(s.proj, f[1], sizeof s.proj);
      strlcpy(s.level, f[2], sizeof s.level);
      s.phase = fi(f[3]);
      strlcpy(s.phaseName, f[4], sizeof s.phaseName);
      strlcpy(s.tool, f[5], sizeof s.tool);
      strlcpy(s.layer, f[6], sizeof s.layer);
      s.sel = fi(f[7]); s.err = fi(f[8]); s.warn = fi(f[9]);
      s.flat = fi(f[10]) != 0;
      if (memcmp(&s, &lk.st, sizeof s)) {
        bool phaseMoved = s.phase != lk.st.phase;
        if (phaseMoved && lk.st.has && lk.st.phase >= 0) phaseJump = true;  // not on the first status
        memcpy(&lk.st, &s, sizeof s);
        dirty |= D_STATUS | D_TOTALS | (phaseMoved ? D_PHASES : 0);
      }
      break;
    }
    case 'K': {
      if (n < 4) { lk.linesBad++; return; }
      int i = fi(f[1]);
      if (i < 0 || i >= MAX_TOOLS) return;
      memset(&lk.toolsIn[i], 0, sizeof(Btn));
      strlcpy(lk.toolsIn[i].label, f[2], sizeof lk.toolsIn[i].label);
      lk.toolsIn[i].flags = strchr(f[3], 'a') ? BTN_LIVE : 0;
      break;
    }
    case 'J': {
      int cnt = constrain(fi(n > 1 ? f[1] : nullptr), 0, MAX_TOOLS);
      if (!lk.hasTools || cnt != lk.nTools || memcmp(lk.tools, lk.toolsIn, sizeof(Btn) * cnt)) {
        memcpy(lk.tools, lk.toolsIn, sizeof(Btn) * cnt);
        lk.nTools = cnt;
        lk.hasTools = true;
        dirty |= D_TOOLS;
      }
      break;
    }
    case 'P': {
      if (n < 5) { lk.linesBad++; return; }
      int i = fi(f[1]);
      if (i < 0 || i >= MAX_PHASES) return;
      memset(&lk.phasesIn[i], 0, sizeof(Phase));
      strlcpy(lk.phasesIn[i].name, f[2], sizeof lk.phasesIn[i].name);
      lk.phasesIn[i].err = fi(f[3]);
      lk.phasesIn[i].warn = fi(f[4]);
      break;
    }
    case 'R': {
      int cnt = constrain(fi(n > 1 ? f[1] : nullptr), 0, MAX_PHASES);
      if (cnt != lk.nPhases || memcmp(lk.phases, lk.phasesIn, sizeof(Phase) * cnt)) {
        memcpy(lk.phases, lk.phasesIn, sizeof(Phase) * cnt);
        lk.nPhases = cnt;
        dirty |= D_PHASES | D_STATUS;
      }
      break;
    }
    case 'A': {
      if (n < 6) { lk.linesBad++; return; }
      Totals t = { true, fi(f[1]), fi(f[2]), fi(f[3]), fi(f[4]), fi(f[5]) };
      if (memcmp(&t, &lk.tot, sizeof t)) { lk.tot = t; dirty |= D_TOTALS; }
      break;
    }
    case 'E': {
      if (n < 4) { lk.linesBad++; return; }
      int kind = fi(f[1]);
      static const uint16_t KC[] = { C_NEUTRAL, C_OK, C_GOLD, C_BAD };
      showToast(KC[constrain(kind, 0, 3)], f[2], f[3]);
      if (kind == 3) ledFlash(true, false, false, 2500);
      else if (kind == 1) ledFlash(false, true, false, 800);
      break;
    }
    case 'Y': {
      if (n < 3) { lk.linesBad++; return; }
      clkEpoch = strtoul(f[1], nullptr, 10);
      clkMillis = millis();
      int tz = fi(f[2]);
      if (tz != cfg.tzMin) { cfg.tzMin = tz; prefs.putShort("tz", tz); }
      dirty |= D_CLOCK;
      break;
    }
    case 'Z': {
      if (n < 3) { lk.linesBad++; return; }
      bool idle = fi(f[1]) != 0;
      uint32_t at = strtoul(f[2], nullptr, 10);
      if (idle != lk.idle || at != lk.lastAct) { lk.idle = idle; lk.lastAct = at; dirty |= D_CLOCK; }
      break;
    }
    case 'M': {
      if (n < 4) { lk.linesBad++; return; }
      int i = fi(f[1]);
      if (i < 0 || i >= MAX_MACROS) return;
      memset(&lk.macrosIn[i], 0, sizeof(Macro));
      strlcpy(lk.macrosIn[i].label, f[2], sizeof lk.macrosIn[i].label);
      lk.macrosIn[i].color = hexColor(f[3], C_PANEL);
      break;
    }
    case 'X': {
      int cnt = constrain(fi(n > 1 ? f[1] : nullptr), 0, MAX_MACROS);
      if (!lk.hasMacros || cnt != lk.nMacros || memcmp(lk.macros, lk.macrosIn, sizeof(Macro) * cnt)) {
        memcpy(lk.macros, lk.macrosIn, sizeof(Macro) * cnt);
        lk.nMacros = cnt;
        lk.hasMacros = true;
        dirty |= D_MACROS;
      }
      break;
    }
    case 'Q': {
      if (n < 3) { lk.linesBad++; return; }
      int i = fi(f[1]);
      if (i < 0 || i >= MAX_SETS) return;
      strlcpy(lk.setsIn[i].name, f[2], sizeof lk.setsIn[i].name);
      break;
    }
    case 'W': {
      int cnt = constrain(fi(n > 1 ? f[1] : nullptr), 0, MAX_SETS);
      int act = n > 2 ? fi(f[2]) : -1;
      if (cnt != lk.nSets || act != lk.activeSet || memcmp(lk.sets, lk.setsIn, sizeof(SetName) * cnt)) {
        memcpy(lk.sets, lk.setsIn, sizeof(SetName) * cnt);
        lk.nSets = cnt;
        lk.activeSet = act;
        dirty |= D_HOME;
      }
      break;
    }
    case 'B': {
      const char* l = n > 1 ? f[1] : "";
      if (strcmp(l, lk.openLabel)) { strlcpy(lk.openLabel, l, sizeof lk.openLabel); dirty |= D_CLOCK | D_HOME; }
      break;
    }
    case '?':
      Serial.println("#HELLO planner_cyd 1");
      sendStat();
      break;
    case 'O':
      if (n > 1) setRotation(fi(f[1]));
      break;
    case 'I':
      if (n > 1) { cfg.invert = fi(f[1]) != 0; lcd.invertDisplay(cfg.invert); saveSettings(); }
      break;
    case 'C':
      calRequested = true;
      break;
    case 'U':
      if (n > 1)
        for (int p = 0; p <= PG_COUNT; ++p)
          if (!strcmp(f[1], PAGE_ID[p])) { if (p == PG_SETTINGS) openSettings(); else goPage(p, true); }
      break;
    default:
      lk.linesBad++;
      return;
  }
  lk.linesOk++;
}

static void pollStream(Stream& st) {
  LineReader& r = rd;
  for (int budget = 1024; budget > 0 && st.available(); --budget) {
    char c = st.read();
    if (c == '\n') {
      if (!r.overflow && r.len) {
        if (r.buf[r.len - 1] == '\r') r.len--;
        r.buf[r.len] = 0;
        bool wasAlive = bridgeAlive();
        lk.lastLine = millis();
        if (!wasAlive) invalidate();
        handleLine(r.buf);
      }
      r.len = 0;
      r.overflow = false;
    } else if (r.len < sizeof r.buf - 1) {
      r.buf[r.len++] = c;
    } else {
      r.overflow = true;
    }
  }
}

static void sendStat() {
  char line[160];
  snprintf(line, sizeof line, "#STAT ok=%lu bad=%lu page=%d planner=%d idle=%d tools=%d macros=%d sets=%d active=%d heap=%u min=%u blk=%u",
           (unsigned long)lk.linesOk, (unsigned long)lk.linesBad, page, lk.planner ? 1 : 0, lk.idle ? 1 : 0, lk.nTools, lk.nMacros, lk.nSets, lk.activeSet,
           ESP.getFreeHeap(), ESP.getMinFreeHeap(), ESP.getMaxAllocHeap());
  Serial.println(line);
}
