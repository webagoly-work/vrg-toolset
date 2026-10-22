// Shared types live here so Arduino's auto-generated prototypes can see them.
#pragma once
#include <stdint.h>
#include <stddef.h>

// What the Planner tab is doing (S| line).
struct Status {
  bool has;
  char proj[25], level[13];
  int8_t phase;            // 0-5, -1 = unknown
  char phaseName[17];
  char tool[29];           // running tool, "" = plain Select
  char layer[21];
  int sel, err, warn;
  bool flat;               // 2D plan view
};

#define MAX_TOOLS 12
struct Btn { char label[25]; uint8_t flags; };  // flags: BTN_LIVE
enum : uint8_t { BTN_LIVE = 1 };

#define MAX_PHASES 6
struct Phase { char name[17]; uint16_t err, warn; };

#define MAX_MACROS 12
struct Macro { char label[25]; uint16_t color; };   // MAKROK page buttons (M| lines)

#define MAX_SETS 6
struct SetName { char name[17]; };                  // KEZDOLAP button sets (Q| lines)

struct Totals { bool has; int dev, paths, circuits, cables, notes; };

struct Toast { bool on; uint32_t until; uint16_t color; char title[17]; char sub[41]; };

// One link (USB). The PC on the other end runs the bridge.
struct Link {
  char name[20];
  bool planner;            // the bridge has a live Planner tab (L| line)
  bool idle;               // nobody has worked in the Planner for a while (Z| line)
  uint32_t lastAct;        // UTC seconds of the last work in the tab, 0 = unknown
  char openLabel[33];      // the ÓRA page button (B| line), "" = no button
  Status st;
  Btn tools[MAX_TOOLS], toolsIn[MAX_TOOLS];
  uint8_t nTools;
  bool hasTools;
  Phase phases[MAX_PHASES], phasesIn[MAX_PHASES];
  uint8_t nPhases;
  Totals tot;
  Macro macros[MAX_MACROS], macrosIn[MAX_MACROS];
  uint8_t nMacros;
  bool hasMacros;
  SetName sets[MAX_SETS], setsIn[MAX_SETS];
  uint8_t nSets;
  int8_t activeSet;        // -1 = not known yet
  uint32_t lastLine, linesOk, linesBad;
};

struct LineReader { char buf[256]; uint16_t len; bool overflow; };

enum Page { PG_HOME, PG_STATUS, PG_TOOLS, PG_PHASES, PG_CONTROLS, PG_MACROS, PG_TOTALS, PG_CLOCK, PG_COUNT, PG_SETTINGS = PG_COUNT };

struct Settings {
  bool invert, calValid, calAsked, autoSwitch;
  int16_t tzMin;           // local time offset, from the PC
  uint8_t rotation, brightness;
  uint16_t cal[8];
};

enum : uint16_t {
  D_HDR = 1, D_TOAST = 2, D_STATUS = 4, D_TOOLS = 8, D_PHASES = 16, D_CTRL = 32, D_TOTALS = 64,
  D_SETTINGS = 128, D_INFO = 256, D_BUTTONS = 512, D_CLOCK = 1024, D_MACROS = 2048, D_HOME = 4096,
  D_ALL = 0xFFFF
};

// One cell of a button grid (pages.ino): fill in its label and colour, or clear `used`.
typedef void (*CellFn)(int i, const char** label, uint16_t* fill, bool* used);
