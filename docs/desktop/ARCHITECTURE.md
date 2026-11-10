# VRG Asztal (VRG Desktop) — the architecture

*U3 of the Desktop unify, 2026-11-10. Built on the Irányítópult (`Dashboard/`, desktop-os WP-01…WP-35b), the inventory (`INVENTORY.md`, 526 rows),
the terms (`GLOSSARY.md`) and the classification (`CLASSIFICATION.md`). Decisions: `DECISIONS.md` DESKU-Q01 … Q14.*

## 1. Why things tangle today

Seven surfaces each keep their own idea of *what exists* and *where to start*:

| Surface | What it keeps | Overlap |
|---|---|---|
| START (`launcher/vrg-menu.json`) | how to run every tool, server, program; commit guard | the only real registry of *how* |
| Features map (`notes/features`) | what exists as a roadmap, tier 1–5 | names the same things with other ids |
| Kapu (`Hub/`) | a baked tool list (`kpTools`) + sign-in | a copy of START tools |
| Toolbox (`toolbox.html`) | a hub page of tools | a third tool list, hand-made |
| Irányítópult (`Dashboard/`) | panes, palette, acts from START + features | the shell — no notion of *level* or *function* |
| Varler Console (`Console/`) | 49 page manifests | its own catalogue, field-only |
| VRG Mobile (`Mobile/catalogue/tools.json`) | 21 tools for the phone | generated, fine |

Nothing says **what kind of thing** an item is, **who it is for**, or **what it belongs to**. So the START menu mixes a calculator, a
3D code city and a vendor downloader on one screen, and every new surface copies a list.

## 2. How professional programs do it

| Program | What we take from it |
|---|---|
| **VS Code workbench** | One shell; everything is a *contribution* declared in a manifest (commands, views, panels) and found by the **command palette**. Activity bar → views; panel area; status bar. → our **catalog** is the contribution registry; the palette indexes it; panes are views. |
| **Windows shell** | Two layers the user always knows: the **Start menu** (everything, by function, searchable) and the **desktop + taskbar** (what I work on now, pinned + running). Notification area for status. → SUI dial ◣ = Start menu; dock = taskbar; top strip = notification area. |
| **macOS** | **Dock** (pinned + running), **menu bar extras** (status, quick functions), **Launchpad / Mission Control** as a second full-screen view toggled by a gesture, **Spotlight** as a global launcher bar. → the two primary views toggled by double Tab; the quick bar is our Spotlight. |
| **JetBrains Toolbox** | A launcher that knows every installed tool, its version, its projects and updates; the tools themselves stay separate programs. → START stays as the fallback launcher; the catalog knows status (live / beta / dev / planned / retire). |
| **Home Assistant / Grafana dashboards** | A dashboard is **sections of cards** built from data; the same entities appear in several dashboards; edit mode to customise. → the Dashboard view = sections (Ma · Alkalmazások · Munkák · Állapot · …) of tiles built from the catalog + the Kezdőlap data; the top strip is customisable. |
| **Progressive disclosure (all of them)** | Beginners see a short default; "Developer mode" / "Advanced" reveals the rest *in place*, not in another app. → the **User / Dev / All** level switch: Dev items appear *behind their parent* (Planner → build, test, gyro relay). |

## 3. The recommended layout

```
VRG Desktop.exe  (Electron 44.7.1 portable, one instance, frameless, default window mode Munka = fullscreen work)
 └ boot state machine:  splash → gate (Kapu; auth.enabled = false → skipped) → the last primary view (first run: Dashboard)
    ├ PRIMARY VIEW 1  Irányítópult nézet (Dashboard view): one scrollable page of sections, filtered by level
    │    User:  Ma · Alkalmazások (by group: Tervezés · Árazás · Anyag · Iroda · Terep) · Munkák · Állapot
    │    Dev:   + Fejlesztési vonalak · Rétegverem · Ügynökök · Szerverek · Mérőszámok, and dev items drawn under their parent tile
    │    All:   + Katalógus (every catalog item, feature and START item, one filterable table)
    ├ PRIMARY VIEW 2  Asztal nézet (Desktop view): the workspace
    │    top strip    customisable quick functions: clock, servers up, git, last backup, quick search, Divergence ring, Console pages
    │    workspace    empty Mélyvíz ground — or the open windows (the existing layout: tabs, splits, panes) when something is open
    │    bottom dock  pinned User apps + running windows (Dev: dev items after a divider) + "show desktop"
    │    ◣ Sarokvezérlő  main menu by function: Munka · Alkalmazások · Fájlok · Rendszer (Dev: + Fejlesztés), ≤ 5 rows, breadcrumb, type-to-search
    │    ◢ Rétegverem dial  the same component mirrored: the layers F I Q L A U R C G Z + Konnektóm · Holo · Rétegek · Keresés (User: F I Q + Keresés)
    ├ toggle: double Tab (≤ 350 ms, not in a text field or terminal) · double-click on empty background · the corner toggle button
    └ everything opens INSIDE, on the Desktop view's workspace:
         HTML apps → an in-shell window on  vrg-app://<catalog-id>/<repo path>  (a real origin: localStorage works; only that
                     item's folder + shared/ are served; a page at the repo root is served alone)
         apps with a server → the browser pane on 127.0.0.1:<port>   built-in panes (files, terminal, browser, mail, chat, git, …) as today
 registries:  launcher/vrg-menu.json  = HOW to run (unchanged; check-start)      notes/features  = the roadmap (unchanged)
              launcher/vrg-catalog.json (new) = WHAT exists: type, level, parent, group, status, surfaces, launch ref (check-catalog)
 START.cmd = the fallback / recovery launcher, kept working, labelled "tartalék"
```

**One rule for opening:** a tile, a dock icon, a dial row, a palette line and a top-strip button all send the same thing —
a **catalog id** — and main resolves it (`desktop.open`): an START act id, a pane kind, a server + path, a features act, a primary
view or a frame tool. The page never sends a path (CONTRACT §3). Opening from the Dashboard view switches to the Desktop view
with the window open (like an app launched from Launchpad).

**Levels are a filter, not a mode switch.** The same catalog drives every surface; `listFor(level)` returns the items of that level
and below, each with its children (catalog items whose `parent` is it, its START submenu actions, its servers).

## 4. What the old surfaces become

| Today | Becomes | Why |
|---|---|---|
| START (`START.cmd`, `vrg-ui.ps1`) | **START tartalék indító**: the fallback / recovery launcher, kept fully working; key **D** opens the VRG Asztal | a console launcher still works when Electron does not; the Founder knows its keys |
| VRG Irányítópult (the app) | **VRG Asztal** — `VRG Desktop.exe` — the shell | it already is a workbench; it gains the two primary views and levels |
| Kezdőlap (D0–D4 page) | the data and widgets of the **Irányítópult nézet**; the full page stays openable as a pane (*Részletes kezdőlap*) | reuse, not rewrite |
| VRG Kapu | the **gate** of the boot flow (`auth.enabled`, off for now) + the guest page for people without the Desktop | it was always "the front door until the dashboard exists" |
| Kapu `kpTools` (baked START tools) | reads the catalog's User items in a later Kapu build | one list |
| Toolbox (`toolbox.html`) | **retired** into the catalog (status `retire`), kept until the Founder removes it | a hand-made third list |
| `docs/hub/hub-seed.json` | folders → `config/roots.json` of the Desktop (Shared roots); tool rows → the catalog | it seeded Kapu's topology |
| Varler Console | stays **its own companion app** (phone / field PWA); on the Desktop its quick pages are **top-strip shortcuts** and its agent trace sits behind it at Dev | different device, different job |
| VRG Mobile | stays the Android companion; its features are classified, its tile shows status | — |
| Zen munkamenetek | **retired** into Munkaterek (saved Desktop layouts) | the Desktop has its own browser and workspaces |
| Planner Simple-UI dial | lifted into the shell as the **Sarokvezérlő** component (`Dashboard/page/sui-dial.js`); the Planner keeps its own | same design, different host |

## 5. Rename table (proposals; nothing is renamed in files tonight — DESKU-Q05)

| Old name | Type | New name (HU · *EN*) |
|---|---|---|
| VRG Irányítópult (the program) | workbench shell | **VRG Asztal** · *VRG Desktop* |
| Kezdőlap | dashboard | **Irányítópult nézet** · *Dashboard view* |
| — | desktop / workspace | **Asztal nézet** · *Desktop view* |
| Varler Console | companion app (field PWA) | **Varler Terep** · *Varler Field* |
| Board Console | device web UI | **Board Web** · *Board web UI* |
| Simplified UI (SUI), Planner | app mode | **Egyszerű mód** · *Simple mode* |
| SUI dial | corner dial (radial launcher) | **Sarokvezérlő** · *Corner dial* |
| Varler SUI | design system (HUD) | **Varler HUD** · *Varler HUD* |
| Rétegverem (`stack-search.html`) | view (search) | **Rétegkereső** · *Stack search* |
| Rétegverem (Dashboard pane) | panel (context builder) | **Kontextuscsomag** · *Context packs* |
| Napló (START N) | command | **Git napló** · *Git log* |
| Indítópult (Mobile M11) | feature module | **Távindító** · *Remote launcher* |
| START | launcher (TUI) | **START tartalék indító** · *START fallback launcher* |
| VRG Kapu (gate) | gate (sign-in screen) | **Kapu (belépés)** · *Gate* |
| VRG Kapu (page) | launcher page | **Kapu vendégoldal** · *Guest page* |
| Solomon Gömb / "Data Globe" | application | **Solomon Gömb** · *Solomon Sphere* |

## 6. Migration order

1. **U0–U4 (done tonight):** green baseline; inventory; classification; the catalog + its checker. Nothing moves.
2. **U5–U7 (tonight):** the two primary views, the level switch, the double-Tab toggle, the Desktop view with dock, top strip and both
   corner dials, in-shell apps on `vrg-app://`, the boot state machine with the gate behind `auth.enabled`.
3. **U8 (tonight):** `VRG Desktop.exe` beside the repo (`H:\VRG\Full\build\vrg-desktop`); START D prefers it.
4. **Founder, attended:** merge `desktop/unify` → `main`; give the exe its icon (rcedit, vendored first); decide the renames (§5).
5. **Next sessions:** the Kapu reads the catalog (one list); `hub-seed` folders into `roots.json`; Toolbox and Zen sessions removed;
   Console quick pages as real top-strip widgets (not shortcuts); the gate turned on when Kapu auth is ready; a catalog field
   `pinned` edited from the Desktop; START's own screens grouped by the catalog's `group` (the TUI stays, its order follows the catalog).

## 7. Decisions taken here (A each; B/C in DECISIONS.md)

- **DESKU-Q06** product name **VRG Asztal / VRG Desktop**; folder `Dashboard/` keeps its name.
- **DESKU-Q07** the catalog sits next to vrg-menu.json (`launcher/vrg-catalog.json`), not in `Dashboard/config`.
- **DESKU-Q08** in-shell HTML apps on a privileged `vrg-app://<id>/<repo path>` scheme serving that item's folder + `shared/`.
- **DESKU-Q09** opened things live on the Desktop view's workspace (the existing layout); the Dashboard view covers it; opening from
  the Dashboard switches to the Desktop.
- **DESKU-Q10** Varler Console stays its own app; its pages surface as top-strip shortcuts.
- **DESKU-Q11** Toolbox, Zen sessions and the Kapu tool list retire into the catalog (proposal; files stay).
- **DESKU-Q12** the exe is the portable Electron renamed, with a `resources/app` bootstrap that loads the repo's shell (no npm, no network).
