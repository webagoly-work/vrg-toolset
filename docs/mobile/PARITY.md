# PARITY — the VRG Desktop, unit by unit, on VRG Mobile

*Written 2026-11-12 (night run, `NIGHT-DESKTOP.md` N1). The user's ask: VRG Mobile becomes **a simplified VRG
Desktop**, not only a companion: the same frame, the same User-level catalog, the same Lapok, the same apps, the
Mélyvíz look. Dev-level items stay off the phone. With a paired PC it reaches further, and with a Claude Remote
Control session running on the PC, further still.*

**How it reaches the phone:**
- `native`: a Compose screen in VRG Mobile (an M-feature, or a part of the Asztal frame);
- `webapp`: the same HTML app as on the Desktop, in a confined WebView, fetched from GitHub `main` and kept offline (M21);
- `pc`: through the paired relay (M2 trust), behind a relay flag;
- `rc`: only with a Claude Remote Control session the PC started (M22);
- `no`: dev-only or meaningless on a phone (reason given).

Source of the list: `launcher/vrg-catalog.json`, every item with `level: "user"` (34 on 2026-11-12), then the Desktop's
window kinds (`KINDS` in `Dashboard/shell/lib/sheets.js`) and its frame parts.

## 1. The 34 User-level units

| # | Unit (id) | Hungarian name | Desktop source | Mobile today | Reaches the phone | WP |
|---|---|---|---|---|---|---|
| 1 | `desktop` | VRG Asztal | `Dashboard/page/vrg-desktop.html`, `frame.js` | tile home (Kompakt) | native: the Asztal frame | **M19** |
| 2 | `view-dashboard` | Irányítópult nézet | `Dashboard/vrg-dashboard.html` (pane `home`) | M4 Haladás covers the progress part | native: Kompakt home + M4 | M19 |
| 3 | `view-desktop` | Asztal nézet | `Dashboard/page/desk.js` | — | native: the Asztal frame | **M19** |
| 4 | `palette` | Parancspaletta | `Dashboard/shell/lib/palette.js`, `page/palette.js` | — | native: Kommand, same scoring ported to `kit-core` | **M19** |
| 5 | `quick` | Gyorskereső | `Dashboard/shell/lib/quick.js`, `page/quick.js` | — | native: the Kommand field in the top strip | **M19** |
| 6 | `workspaces` | Munkaterek | `Dashboard/shell/lib/workspaces.js` | — | native: Lapok presets (User level only) | **M20** |
| 7 | `notifications` | Értesítések | `Dashboard/page/toasts.js` | M10 Értesítések | native (exists) | M10 |
| 8 | `settings` | Beállítások | `Dashboard/shell/lib/settings.js`, `tray.js`, `selmenu.js` | M1 Beállítások | native (exists); M19 adds Kezdőlap + Tájolás | M1 / M19 |
| 9 | `planner` | Varler Planner | `Planner/projects/varler-planner/dist/varler_planner.html` | — (M12 photos tagged for it) | webapp | **M21** |
| 10 | `client-preview` | Ügyfélnézet | inside the Planner (`feat:b4`) | — | webapp, inside the Planner | M21 |
| 11 | `workflow-kit` | Varler Workflow Kit | `H:\VRG\Full\Varler_Workflow_Kit` (outside the repo) | — | pc: read-only files window (not on GitHub, carries client data) | **M23** |
| 12 | `calc-panel` | Panel anyagár kalkulátor | `Calculator/panel_anyagar_kalkulator.html` | — | webapp | **M21** |
| 13 | `calc-general` | Általános kalkulátor | `Calculator/Altalanos_Villanyszerelui_Kalkulator.html` | — | webapp | **M21** |
| 14 | `calc-led` | LED árkalkulátor | `Calculator/led_arkalkulator.html` | — | webapp | **M21** |
| 15 | `inventory` | Készlet | `Inventory/dist/vrg-inventory.html` | — (M12 photos tagged for it) | webapp | **M21** |
| 16 | `valena` | Valena választó | `Toolbox/valena-life-szerelvenytervezo.html` | — | webapp | **M21** |
| 17 | `buildtree` | VRG BuildTree | `Modder/vrg-buildtree.html` | — | webapp | **M21** |
| 18 | `bridge` | BRIDGE dokumentáció | `BRIDGE/` (repo docs) + `H:\VRG\Full\BRIDGE` | — | pc: read-only files window; later a webapp reader of the repo's `BRIDGE/` | M23 |
| 19 | `jobs` | Munkák | `H:\VRG\Full\jobs` (client folders) | — | pc: read-only, copy via M12 Átadás; never through GitHub (client names, addresses) | **M23** |
| 20 | `files` | Fájlok | `Dashboard/page/panes/files.js`, `shell/lib/fsview.js` | M12 board only | pc: read-only browse of the work roots (Repó, VRG Full, Közös; D-17), relay `--files`; BETA | **M23** |
| 21 | `archive` | Archívum | `Archive/vrg-archive.html` | M18 Archívum | native (exists) | M18 |
| 22 | `mindmap` | VRG MindMap | `MindMap/vrg_mindmap.html` | — | webapp | **M21** |
| 23 | `web` | Böngésző | `Dashboard/page/panes/web.js` | — | native: the phone's browser (Custom Tab); Kommand opens URLs | M19 |
| 24 | `mail` | Posta | `Dashboard/page/panes/mail.js`, `shell/lib/gmail.js` | — | no (decided in M23): the PC's mail rides its own Gmail OAuth on the PC; the phone has its own mail app, opened by intent | M23 |
| 25 | `search` | Belső keresés | `Dashboard/page/panes/search.js`, `shell/lib/innersearch.js` | — | no for now (a relay search over the PC's index is a Later item of M23) | Later |
| 26 | `feed` | Hírfolyam | `Dashboard/page/panes/feed.js` | — | no (D-18): its presets run inside the Desktop on the PC, with its cache; mail is no for the same kind of reason | M23 |
| 27 | `map` | VRG Térkép | `Map/serve.js` (port 8802, offline tiles on H:) | M8 Localhost opens it | pc: through M8's `/p/8802/` proxy; Asztal menu links it | M8 / M19 |
| 28 | `console` | Varler Console | `Console/serve.js` (port 8133) | M8 Localhost opens it | pc: through M8; Asztal menu links it | M8 / M19 |
| 29 | `mobile` | VRG Mobile | `Mobile/` | itself | — (the phone is this unit) | — |
| 30 | `servicekit` | ServiceKit | `ServiceKit/` (a device, status dev) | — | no for now: hardware on the bench; a later WP may talk to it over the phone's WiFi | — |
| 31 | `stack.search` | Keresés (Rétegverem) | `Stack/stack.js q` | M17 Rétegverem | native: Kommand searches the catalog; the Stack search itself stays in M17's pages | M17 / M19 |
| 32 | `layer.i` | I · Ötletfolyam | `Stack/lineage.html` (server `stack`) | — | native via M17: add the page to `stack-pages` (Later in M17); pc via M8 meanwhile | M17 |
| 33 | `layer.f` | F · Kiemelt | the Irányítópult (`view: dashboard`) | — | native: the Asztal's home window | M19 |
| 34 | `layer.q` | Q · Döntésnapló | `Stack/decisions.html` (server `stack`) | — | native via M17 (Later); pc via M8 meanwhile | M17 |

## 2. Window kinds (`KINDS`, `Dashboard/shell/lib/sheets.js`)

| Kind | Desktop pane | On the phone | WP |
|---|---|---|---|
| `home` | `panes/` home (the Irányítópult) | native: the Asztal's home window (the Kompakt tiles as a window face) | M19 / M20 |
| `empty` | `panes/empty.js` (the picker) | native: long-press a free cell → the Kommand list | M20 |
| `files` | `panes/files.js` + `viewer.js` | pc, read-only: `feat:pcwin` (text, image, copy to the board) | M23 |
| `term` | `panes/term.js` | **no**: a terminal is dev level | — |
| `web` | `panes/web.js` | native: a confined WebView or the phone's browser | M20 |
| `mail` | `panes/mail.js` | no (see unit 24) | M23 |
| `stack` | `panes/stack.js` | native: M17 Rétegverem | M17 |
| `chat` | `panes/chat.js` (Claude chat on the PC) | rc: the Claude app, opened on the PC's Remote Control session | M22 |
| `note` | `panes/note.js` | native: M6 Gyorsjegyzet | M6 |
| `git` | `panes/git.js` | **no**: git is dev level; M4 Haladás shows the state read-only | — |
| `feed` | `panes/feed.js` | no (D-18) | M23 |
| `app` | `panes/app.js` (an in-shell HTML app) | webapp | M21 |

## 3. Frame parts

| Part | Desktop source | On the phone | WP |
|---|---|---|---|
| Top strip (sheet tabs, Kommand, clock, state) | `Dashboard/page/frame.js` | native: tabs + Kommand field + orientation toggle | M19 |
| Dock (open windows) | `frame.js` | native: a bottom row of the open windows | M19 |
| ◣ menu dial (the catalog, grouped) | `Dashboard/page/sui-dial.js` | native: the catalog at User level, the Desktop's groups (Munka, Alkalmazások, Fájlok, Rendszer) | M19 |
| ◢ Rétegverem dial | `sui-dial.js` | native: opens M17 | M19 |
| Kommand palette | `palette.js` | native, same scoring | M19 |
| Lapok (sheets, 4×4 grid) | `Dashboard/page/sheets.js`, `shell/lib/sheets.js` | native: the same model, a phone grid | M20 |
| Notifications | `toasts.js` | native: M10 | M10 |
| Settings | `settings.js` | native: M1 + Kezdőlap / Tájolás | M1 / M19 |
| Orientation toggle (phone only, the user asked for it by name) | — | native: Automatikus → Álló → Fekvő | M19 |
| Claude sign-in | the Desktop's `claudeterm` profile | the official Claude app; VRG Mobile only opens it | M22 |

## 4. New WPs from this map

| WP | Feature (id) | What |
|---|---|---|
| M19 | Asztal (`desk`) | the frame: top strip, dock, two dials, Kommand, Kezdőlap Asztal / Kompakt, orientation toggle |
| M20 | Lapok (`sheets`) | the Desktop's sheets model in `kit-core`, a phone grid, the gestures, User presets |
| M21 | Alkalmazások (`apps`) | the User-level HTML apps in a confined WebView, one https origin each, offline after the first fetch |
| M22 | Claude (`claude`) | opens the Claude app; with a paired PC, the PC's Remote Control sessions (list, start) |
| M23 | PC ablakok (`pcwin`) | the PC's work folders read-only (copy via M12); mail and feed stay on the PC (D-18) |

