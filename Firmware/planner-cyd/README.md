# Planner CYD: desk dashboard and remote for the Varler Planner

v0.7, 2026-10-17. Built on the RL CYD principle (`H:\others\RL-CYD-v2\PRIMER-cyd-dashboard.md`): the CYD is dumb, the PC bridge is smart, and the two talk in short `X|a|b` lines. It lives in the repo at `Firmware/planner-cyd`, and you start it from `Planner/START.cmd` → **K**: 1 = with the Planner, 2 = demo, 3 = flash, **4 = the macropad** (for everyday Windows use; it also picks up the Planner when its relay runs), **5 = macropad settings** (http://localhost:8788).

```
 Planner tab (browser)          phone relay (Node)          bridge (Node)             CYD
 src/07e-dash-link.js  ──ws──▶  tools/phone-relay-  ──ws──▶ app/bridge/   ──USB──▶  source/planner_cyd/
 'dash' snapshots               server.js :47291            bridge.js      lines    6 pages, touch
 runs the commands     ◀──────  role routing        ◀────── '!' presses    ◀─────── buttons
```

The Planner already had the phone link (`PLANNER_LINK`, 07a) and its relay. The bridge joins that relay as one more client (role `cyd`), so the Planner only needed one small consumer module, and the relay needed no changes. The Planner connects to the relay by itself on boot when the relay is running.

## 1. The section-2 table, filled in

| Question | Planner answer |
|---|---|
| Where does the live data come from? | The open Planner tab. `07e-dash-link.js` sends a `dash` snapshot over the existing relay: on change, and at least every 2.5 s as a heartbeat. |
| What's worth glancing at? | **ÁLLAPOT** (project, level, phase 1–6, running tool, layer, selection, errors/warnings, 2D/3D) · **ÖSSZESÍTÉS** (devices, paths, circuits, cables, notes, errors, warnings) · **ÓRA**, the idle dashboard (time, date, the project and when it was last worked on, and a **START.cmd megnyitása** button that opens the launcher on the PC) |
| What should it show when plugged in? | **KEZDŐLAP**, the start page: a big **START.cmd megnyitása** button and the macro sets (Windows, Média, Iroda, Planner, or your own). A tap on a set makes it active and opens MAKRÓK. |
| What should touching the CYD do? | **ESZKÖZÖK**: the current phase's tools as buttons (tap = start, tap again = stop). **FÁZISOK**: jump to a phase. **VEZÉRLÉS**: undo, redo, Esc, Select, level up/down, 2D/3D, view home, finish run, save. **MAKRÓK**: a macropad of up to 12 buttons from `macros.json`. |
| Which events deserve a banner/LED? | Planner connected / gone, error count went up (red LED), saved (green LED), a refused action ("NEM SIKERULT: …"), a press while no tab is open. |
| One device or several? | One: the PC the CYD is plugged into, over USB. |
| When should it switch pages by itself? | **Auto váltás** (Settings, on by default). When the phase changes, from the PC or from FÁZISOK, it jumps to ESZKÖZÖK. When the Planner is idle it shows ÓRA, and when work starts again it goes back to the page it was on. A tap on the idle clock also goes back, and the CYD stays off the clock until the next idle spell. A manual page change cancels the pending return. |

**Idle** is decided by the bridge:
- no keyboard or pointer input in the tab for `--idle-min` minutes (default 5); the tab reports its last input time, rounded to 30 s;
- or no tab at all for 1 minute.

## 2. Line protocol

UTF-8, limited to what the CYD's fonts can draw: ASCII, áéíóöőúüű ÁÉÍÓÖŐÚÜŰ and ° – … · ×. The bridge folds other accented letters to their base letter (ä → a), drops emoji, turns `|` into `/`, and cuts each field to the CYD's buffer **in bytes**, never inside a character.

**Bridge → CYD**

| Line | Meaning |
|---|---|
| `L\|planner` | Heartbeat, 1 s; `planner`=1 while a Planner tab is live. No line for 4 s means no bridge. |
| `N\|name` | PC name, for the header chip. |
| `S\|proj\|level\|phase\|phaseName\|tool\|layer\|sel\|err\|warn\|flat` | Status, sent on change. `level` = the Hungarian level name (FOLDSZINT…); `tool` empty = plain Select. |
| `K\|i\|label\|flags` … `J\|n` | Tool buttons of the current phase (≤ 12), committed by count; `flags` `a` = running. |
| `P\|i\|name\|err\|warn` … `R\|n` | The phases, committed by count. |
| `A\|dev\|paths\|circuits\|cables\|notes` | Totals. |
| `Y\|epoch\|tzMin` | Clock: UTC seconds and the local offset in minutes. Sent on connect and every 30 s; the CYD keeps it running in between. |
| `Z\|idle\|lastAct` | `idle` 1/0; `lastAct` = UTC seconds of the last work in the tab (0 = unknown). Sent on change. |
| `M\|i\|label\|hex` … `X\|n` | MAKRÓK buttons (colour as RRGGBB), committed by count. |
| `Q\|i\|name` … `W\|n\|active` | The macro sets for KEZDŐLAP, committed by count with the active one's index. |
| `B\|label` | The KEZDŐLAP and ÓRA button, e.g. `B|START.cmd megnyitása`; `B|` alone = no button. |
| `E\|kind\|title\|sub` | Banner. kind 0 = info, 1 = ok, 2 = warning, 3 = error. |
| `?` | Ask for `#HELLO` and `#STAT`. |
| `O\|rot` `I\|0/1` `C\|1` `U\|page` | Rotation, inversion, touch calibration, go to a page (`status tools phases controls totals clock settings`). |

**CYD → bridge:** `#HELLO planner_cyd 1`, `#STAT ok= bad= page= planner= idle= tools= macros= sets= active= heap= min= blk=` every 5 s, and the presses: `!T|i` (tool button), `!P|i` (phase), `!C|name` (control: `undo redo esc stop lvlup lvldn view3d home finish save`), `!M|i` (MAKRÓK button), `!G|i` (KEZDŐLAP: make set i active), `!O|start` (the KEZDŐLAP / ÓRA button).

**The MAKRÓK page** (like the RL macropad). `app/bridge/macros.json` holds up to 6 named **sets** of up to 12 buttons `{label, color, type, value, args}`, and which set is active: `{"active": 0, "sets": [{"name": "Windows", "buttons": [...]}, ...]}`. The CYD's KEZDŐLAP or the settings page picks the active set. The bridge writes four sets on its first run (Windows, Média, Iroda, Planner), and re-reads the file whenever it is saved. An older file that is a plain list of buttons is converted on the first run: the old defaults become the four sets, anything else is kept as a set called "Saját". Three button types:

| type | value | what happens |
|---|---|---|
| `planner` | a Planner action id (`check.list`, `doc.print`, `view.style.blueprint`, `edit.delete`…; any id in `05c-actions.js` or a phase tool) | runs in the open tab through the relay, so no key injection is involved |
| `keys` | a key combination: `ctrl+c`, `win+shift+s`, `volume_mute`, `f5`… | pressed into the focused window by `winkeys.ps1`, a long-running PowerShell trimmed from RL's winhelper |
| `run` | a program, file or URL (+ `args`) | `start "" "<value>" <args>` |

The Planner set: Ellenőrzés, Anyagkimutatás, Nyomtatás / PDF, Kép (PNG), Blueprint nézet, Normál nézet, Kijelölt törlése, Parancsok (Ctrl+K), Másolás, Beillesztés, Képernyőkép, Számológép. **The settings page** (START.cmd → K → 5, or http://localhost:8788 while the bridge runs) is where the macropad is customised:
- **Készletek**: the sets as tabs (● CYD marks the active one); rename, **Ez legyen a CYD-n**, **+ Új készlet** (empty or from a template), **Készlet törlése**, and **Sablon betöltése** to refill the open set from a template. When the CYD switches sets, the page follows while nothing is unsaved;
- a preview of the CYD's MAKRÓK grid: click a button to select it;
- for each button: colour, label, type (Billentyű / Program / Planner), value, arguments, **Próba** (runs it now), ↑ ↓ ✕;
- a **library of 46 presets** in six groups (Windows, Média, Szerkesztés, Böngésző, Programok, Planner): a click puts one in the selected slot, or at the end;
- **Mentés és küldés a CYD-re** writes `macros.json` and sends the buttons at once;
- **Indítás a Windowszal**: a shortcut to `4 - USB - Makropad.bat` (minimised) in your Startup folder (`shell:startup`). It is created or deleted only when you click the switch.

It is reachable only from this PC: it listens on 127.0.0.1 and ::1, checks the Host and Origin headers, and takes JSON only. A save from a foreign web page gets 403, a form post 415.

**One bridge for everything.** The macropad bridge is the full bridge: it keeps looking for the Planner relay and takes the Planner over when it appears. `1 - USB - Planner.bat` first checks for a running bridge (the settings port) and, if there is one, only starts the relay. So a macropad started with Windows and a Planner started later never fight over COM19.

**MAKRÓK is also a plain PC macropad.** With no Planner tab:
- the CYD opens KEZDŐLAP by itself when the bridge connects (plugged in, or the bridge started); a set tap opens MAKRÓK;
- a tap on any waiting screen goes there too;
- it never jumps to the idle clock ("idle" only means idle in the Planner);
- Planner buttons turn grey and get their colours back when a tab opens; keys and programs work as normal. If an antivirus quarantines `winkeys.ps1` (Avast did that to RL's helper), only the key buttons stop.

**The START.cmd button** (KEZDŐLAP and ÓRA). The bridge opens its own setting, `--start <file>`; the default is `<repo>/Planner/START.cmd`, and `--start none` hides the button. It uses `start "" "<file>"`, so a `.cmd` file gets its own console window and anything else opens in its default program. The CYD only sends `!O|start`, so nothing on the serial line can choose what runs.

**Bridge → Planner**, as relay envelopes `{v, from:'cyd', type, payload}`:

| CYD press | Relay message | Planner side |
|---|---|---|
| `!T\|i` | `cmd dash.action {a, mode}`, or `dash.stop` if that tool is already running | `runAction(a)`, falling back to `setMode(mode)` |
| `!P\|i` | `cmd dash.phase {k}` | `phSet(k)` |
| `!C\|stop` | `cmd dash.stop` | `toolStop()` |
| `!C\|undo / redo / home` | `cmd edit.undo / edit.redo / view.reset` | 07a's built-in commands |
| `!C\|esc` | `keys {key:'Escape'}` | 07a's key path (Esc never discards) |
| `!C\|save / view3d / lvlup / lvldn / finish` | `cmd dash.action {a: proj.save / view.toggle3d / level.up / level.down / draw.finish}` | registered actions; a disabled one is refused, and the CYD shows why |

The Planner answers each `cmd` with an `ack {id, ok, reason}`. The bridge turns a refusal into a banner.

## 3. Files

| Path | What it is |
|---|---|
| `source/planner_cyd/fonts_hu.h` | **HuSans**: four VLW smooth fonts (15 and 12 px regular, 18 and 24 px bold, 68 KB in all), rasterised from Liberation Sans. LovyanGFX's own fonts are ASCII only. Licence: `fonts_hu_OFL.txt` (SIL OFL 1.1; the name "Liberation" is reserved, hence HuSans). The 7-segment clock and the big digits stay Font7 / Font4. |
| `app/tools/make_fonts.js` | Rebuilds `fonts_hu.h`, using headless Edge to rasterise. Only needed to change the sizes or the glyph set. |
| `app/tools/font_preview.js` | Draws sample Hungarian text with the generated fonts, using LovyanGFX's metrics, to a PNG. |
| `source/planner_cyd/` | Firmware: `planner_cyd.ino` (globals, fonts, settings, setup/loop), `protocol.ino`, `ui.ino` (header, banner, settings, info screens, render, auto switch, input, calibration, LED), `pages.ino` (the six pages), `pc_types.h`, `display.h` (copied unchanged from RL v2: ST7789, backlight on 27, touch on CS 33). |
| `firmware/` | Compiled image, **not in git**; `3 - Flash CYD firmware.bat` rebuilds it. 450 KB, 34 % of flash; 25 KB globals, about 300 KB free for the heap. |
| `app/bridge/bridge.js` | The bridge: the RL link layer (USB serial, or TCP for a fake CYD), the relay client, snapshot → lines (sends only what changed), clock and idle, the button map, banners. |
| `app/bridge/configui.js`, `autostart.js` | The settings page (port 8788), and the Startup-folder shortcut behind its "Indítás a Windowszal" switch. |
| `app/tools/label_fit.js` | Lays out every preset label exactly as the CYD does (fonts_hu.h metrics) and lists the ones that need 12 px or a hyphen; `--png` draws the buttons. |
| `5 - Makropad beallitasa.bat` | Opens the settings page, starting the macropad first if no bridge answers. |
| `app/bridge/macros.js`, `winkeys.ps1`, `macros.json` | The MAKRÓK page: the sets (`normalizeDoc()`, `SET_TEMPLATES`, watched for saves), running the buttons, and the key helper. `macros.json` is your own button sets. |
| `app/bridge/mock_planner.js` | `--demo`: a fake Planner tab that has the same phase and tool table, answers commands and acks, and changes a little every few seconds. `--demo-idle N` makes the user "stop working" after N s. |
| `app/tools/fake_cyd.js` | A fake CYD: a TCP server that prints the lines it receives and can press buttons from a script or from what you type. |
| `app/tools/e2e_planner.js` | End to end with a real Planner build. |
| `1 - USB - Planner.bat` | Starts the relay if nothing answers on 47291, then the bridge. Installs `serialport` on the first run (`node_modules` is not in git). |
| `2 - USB - Demo.bat` | The bridge with the mock tab. |
| `4 - USB - Makropad.bat` | The macropad for everyday use (the full bridge, so it takes the Planner over when its relay appears). |
| `3 - Flash CYD firmware.bat` | Compiles, then runs `arduino-cli upload`, which keeps the CYD's settings. It **replaces** the RL firmware. |
| Planner `src/07e-dash-link.js` | The Planner side: `PLANNER_DASH`, the snapshot (incl. `inputAt`), and the `dash.*` commands. It polls only while the link is up. |
| Planner `tests/spec-101-dash-link.js` | 19 checks against a stub WebSocket. No relay needed. |

All the launchers find their paths from their own folder: the Planner is `..\..\Planner`, and the portable Node and arduino-cli sit next to the repo.

## 4. Running it

1. Flash once: START.cmd → K → 3 (COM19). On first boot it offers touch calibration (8 s window).
2. START.cmd → K → 1, then open the Planner. The header dot turns green, and ÁLLAPOT fills in.
3. Without a browser: K → 2 (demo).
4. Without the CYD: `node app/tools/fake_cyd.js 7788`, then `node app/bridge/bridge.js --demo --tcp 127.0.0.1:7788`. Type `!P|0`, `!T|0`, `!C|undo`…

Navigation is the same as RL: header = `[PC chip] < PAGE > [≡]`. Tapping the chip goes to KEZDŐLAP. On ÁLLAPOT, ÖSSZESÍTÉS and ÓRA a tap anywhere goes to the next page. BOOT short = next page, hold = settings.

## 5. What was verified (2026-10-17)

- Firmware compiles (esp32 core 3.3.12, LovyanGFX 1.2.33). **Not yet seen by Claude:** the screen itself (layout, colours, touch). The user checks those.
- MAKRÓK, every type (with the demo tab): a Planner action acked, a key pressed through `winkeys.ps1`, a program run (a marker file appeared), a broken entry cleaned up, and a bad key reported as a banner.
- **Button labels**: Hungarian words are long, so a label tries 15 px on two lines, then 12 px on three, then a hyphen at a real Hungarian syllable break (digraphs as one letter; the last consonant between two vowels starts the next syllable; the most even split wins), for example Vissza-vonás, Feladat-kezelő, Számo-lógép. Of the 45 preset labels, 29 fit at 15 px, 9 at 12 px and 7 are hyphenated; none is cut (`label_fit.js`). The same layout is used on the ESZKÖZÖK and FÁZISOK buttons.
- **Button sets** (v0.7): a fake CYD's `!G|1` swapped in the six Média buttons with `W|4|1` and a KÉSZLET banner, and `!G|9` was ignored; an old one-list `macros.json` was converted to the four sets. On the settings page: a new set from a template, renamed, made active and saved reached the fake CYD (`Q|4|Zene`, `W|5|4`); a hand edit of the file was followed by the open page; a set with junk buttons was saved as an empty set; 415 / 403 as before. On the board: KEZDŐLAP opened by itself when the bridge connected (`page=0 sets=4 macros=12 bad=0`). End to end still 30/30.
- **Settings page** in the browser pane: a preset placed into a selected slot, Mentés wrote `macros.json` and the (fake) CYD got the new button at once; Próba ran a key combination; a foreign Origin (403), a form post (415) and a foreign Host (403) are refused. Start with Windows was tested in a scratch folder: the shortcut's target and minimised window were checked, then it was removed; the real Startup folder was not touched.
- **Macropad on the board** (the plain bridge, as K → 4 runs it): it opened MAKRÓK by itself (`page=4 macros=12`), and the settings page reported `cyd: csatlakozva`.
- **Macropad on the board** (`--no-relay`): it opened MAKRÓK by itself and was still there after 70 s (`page=4 idle=0 macros=12 planner=0`).
- **On the board** (flashed 2026-10-17): `#STAT` shows `bad=0`, `tools=12`, `macros=12`, heap 287 KB; the idle switch to ÓRA fired.
- Bridge + mock + fake CYD: phase switch, tool start/stop, undo, save banner, refusal banner, and the idle cycle (`Z|0` → idle `Z|1` → a CYD press → `Z|0`).
- **End to end with the real Planner** (a build with 07e in jsdom → the real `phone-relay-server.js` → the real bridge → a fake CYD): 30/30. That covers the phase and tool buttons, Select, 2D/3D, a refused level-up, Esc, the clock line, accented text (FÖLDSZINT, Helyiség-toll), the ÓRA button (`B|`, and `!O|start` opening a stand-in file), a MAKRÓK Planner button (`M|`/`X|`, and `!M|0` switching the tab to blueprint view), `Z|0` with the tab's input time, the tab closing (→ `L|0` + banner), and a press with no tab. Run it with `PLANNER=<build with 07e>` and `NODE_PATH=<varler-planner>/node_modules`.
- `2 - USB - Demo.bat` was run from its repo location against a fake CYD; the START.cmd menu was driven through K → X → Q.
- Planner full suite: 95 suites, 3306 assertions, golden 70/70 byte-identical; `check-globals` OK.

## 6. Decisions

- Accents: **real Hungarian text** (2B): the HuSans fonts.
- Wireless: **USB only** (3A).
- MAKRÓK works without the Planner, as a PC macropad (the user, 2026-10-17).
- The macropad is customisable on a settings page, with Windows presets and start with Windows (the user, 2026-10-17).
- Choosable macro sets, and a start page with a START.cmd button when the CYD is plugged in (the user, 2026-10-17).
- All text is drawn through the band sprite; nothing is drawn straight onto the panel (after "only the header shows").
- Auto page switch: **phase → ESZKÖZÖK, idle → ÓRA** (4C).
- Home: **the repo**, START.cmd → K (5B).
- The ÓRA page opens **START.cmd** (the user, 2026-10-17).

Known limits:
- At most 12 tools per phase (Villamosság has exactly 12).
- `proj.save` on a never-saved project may open a name prompt in the browser.
- The CYD shows the error/warning counts but not the messages.
- Idle is accurate to about 30 s.
