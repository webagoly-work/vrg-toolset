# VRG Desktop unify — decisions (DESKU-Qnn)

Each entry: the question, the option taken (A unless noted), the alternatives. Branch `desktop/unify`.
The run was planned as an unattended night and was run in an attended session on 2026-11-10 instead;
the "take A, record it" rule still applies, the Founder can reverse any entry.

## DESKU-Q01 — START key D: Irányítópult or UI Kit galéria?

`main` gave START tools key **D** to *VRG UI Kit galéria*; the Dashboard branch gave **D** to *Irányítópult* (dev group).
The merge put both on the main screen (check-start error, wp-05 and wp-08 red).

- **A (taken):** the Irányítópult keeps **D** ("D = Desktop", it becomes the VRG Desktop, the new front door);
  the gallery moves to **B**, the first free key on the main START screen (free were B and F).
- B: the gallery keeps D, the Irányítópult moves to F.
- C: the gallery leaves START and is reached only from the Desktop's catalog.

## DESKU-Q02 — What goes into the catalog?

- **A (taken):** one entry per *unit you can open or see* (apps, utilities, panels, companion apps, dev tools, stack pages,
  dev roots): 91 items. Features, START actions, servers, modules, agents and prompts stay in their own registries and are
  drawn *behind* a catalog item (`parent`), so the catalog never forks vrg-menu.json or features.json (CONTRACT §2.3).
- B: every inventory row (526) becomes a catalog entry.
- C: no new file; add `level` / `parent` fields to vrg-menu.json and features.json.

## DESKU-Q03 — Dev roots

- **A (taken):** six roots: Repó & Git · Ügynökök & AI · Tudás · Infrastruktúra · Eszközök & hardver · **Megjelenés**
  (the plan had five; the look items — UI Kit, Mélyvíz, Varler HUD, logo — had no honest home in the other five).
- B: the plan's five, look items under Infrastruktúra.
- C: no roots; parentless dev items in one "Fejlesztés" list.

## DESKU-Q04 — Levels of the borderline items

- **A (taken):** Terminal, Git, Claude Code, side chat, context packs, dev notes = **Dev**; MindMap, Térkép, BuildTree,
  BRIDGE docs, Hírfolyam, Workspaces = **User**; Kódváros, Solomon, Divergence, CoreRef, Kapu (as a page), Toolbox, Zen
  sessions = **Dev**; third-party programs, Console stubs, tier 4–5 features, internal modules = **All**. VRG Mobile features
  split: field use (M0 M1 M2 M7 M9 M12 M13) User, repo / CI / knowledge (M3–M6 M8 M10 M11 M14 M16 M17) Dev.
  The Stack dial shows F, I, Q + Keresés at User level (those four catalog items are `user` under the `dev` Stack).
- B: the terminal and Claude Code at User (the Founder is both user and dev).
- C: everything a tier-1 feature is User.

## DESKU-Q05 — Names for the collisions (proposals only; nothing is renamed tonight)

- **A (taken, as a proposal in CLASSIFICATION.md):** VRG Asztal = the shell, Irányítópult nézet + Asztal nézet = its two views;
  Varler Console → Varler Terep; Board Console → Board Web; Planner SUI → Egyszerű mód + Sarokvezérlő; Varler SUI → Varler HUD;
  stack-search → Rétegkereső; the stack pane → Kontextuscsomag; START N → Git napló; M11 → Távindító. Renames that touch
  files, START keys or the phone wait for the Founder.
- B: rename now in code and registries.
- C: keep every current name, add types only.

## DESKU-Q06 — Product name

- **A (taken):** **VRG Asztal** (*VRG Desktop*) for the program and the exe (`VRG Desktop.exe`); its views are *Irányítópult nézet* and
  *Asztal nézet*; the folder `Dashboard/` keeps its name until a rename is worth the churn.
- B: keep "VRG Irányítópult" for the program. C: rename the folder to `Desktop/` now.

## DESKU-Q07 — Where the catalog lives

- **A (taken):** `launcher/vrg-catalog.json`, next to vrg-menu.json (START, Kapu, the Desktop and check tools all read `launcher/`).
- B: `Dashboard/config/catalog.json`. C: inside `notes/features` (outside git).

## DESKU-Q08 — How HTML apps open inside the shell

- **A (taken):** a privileged standard scheme `vrg-app://<catalog-id>/<repo-relative path>`, served by main from that item's own folder
  plus `shared/` (a page whose folder is the repo root is served alone). Real origin per app → localStorage works, apps stay apart.
  The view has no preload, sandbox on, its own partition `persist:vrg-app`.
- B: `file://` in a view (localStorage fails: null origin). C: a local static server per app.

## DESKU-Q09 — Where opened things live

- **A (taken):** on the Desktop view's workspace, in the existing layout (tabs, splits); the Dashboard view covers the workspace; opening
  from the Dashboard switches to the Desktop. "Show desktop" in the dock hides the windows (the empty ground).
- B: a third "work" view. C: separate OS windows.

## DESKU-Q10 — Varler Console on the Desktop

- **A (taken):** stays its own companion app (field PWA, :8133); its quick pages are top-strip shortcuts that open it on the page.
- B: embed Console pages as native Desktop widgets now. C: merge the Console into the Desktop.

## DESKU-Q11 — Old lists

- **A (taken, proposal):** Toolbox, Zen sessions and Kapu's baked tool list retire into the catalog; the files stay until the Founder removes them.
- B: remove them now. C: keep all of them as equal lists.

## DESKU-Q12 — How the exe is made

- **A (taken):** copy the portable Electron 44.7.1, rename `electron.exe` → `VRG Desktop.exe`, drop `default_app.asar`, add a
  `resources/app` bootstrap that loads the repo's `Dashboard/shell/main.js` (path in `vrg-desktop.json` beside the exe). No npm, no network.
  The file icon stays Electron's until rcedit is vendored (attended).
- B: electron-builder (needs npm + network). C: a .cmd shortcut only.

## DESKU-Q13 — The top strip's built-in widgets

- **A (taken):** seven built-ins drawn by the Desktop itself (`w:clock`, `w:search`, `w:servers`, `w:git`, `w:backup`, `w:ring`, `w:level`);
  catalog items with `surfaces.top` (the Varler Console, Kódváros …) join them as shortcuts. The Testreszabás sheet picks and orders
  at most 12, saved as `desk.top` (per user, in the Dashboard's settings file). Default: clock · search · servers · git · backup · ring · Console · level.
- B: Console pages as live widgets now (needs a page-to-widget contract). C: a fixed strip with no choice.

## DESKU-Q14 — Double Tab: who detects it

- **A (taken):** the frame page detects its own double Tab (it sees the focused element before Tab moves the focus, and can
  `preventDefault` the second tap); every other webContents (web tabs, in-shell apps, the Kezdőlap) is watched by main through
  `before-input-event`, and an isolated-world recorder (`TAB_RECORDER`, world 1013) notes at each Tab keydown whether the focus took
  text. A pair from a text field, a textarea, contenteditable or a terminal never toggles. Key and interval: `config/keymap.json`.
- B: main only (its async probe ran after Tab had moved focus into the first input: toggled from text fields / skipped on forms).
  C: a global shortcut (steals Tab from every other program).

## DESKU-Q15 — Esc

- **A (taken):** Esc closes the open dial or sheet first; on the Desktop's own chrome (empty ground, dock, top strip) it hides the
  windows (show desktop). Inside an app Esc belongs to the app; the way back is double Tab or the dock.
- B: Esc always returns to the Dashboard (breaks every app that uses Esc). C: no Esc behaviour.

## DESKU-Q16 — The gate flag

- **A (taken):** `auth.enabled` (default false) is a settings key the page can read but never write (`app.setting` refuses it with
  `forbidden`); only the settings file or a later Kapu step turns it on. With it off the boot is splash → ready; on, splash → gate
  (a placeholder until Kapu's sign-in moves in) → ready.
- B: a page-settable flag (a page could switch the gate off). C: no flag, the gate added later.

## DESKU-Q17 — One probe for three WPs

- **A (taken):** WP-41, 42 and 43 share one real-window probe (`shell/selftest/wp-41.js`): the views, the dials and the in-shell app
  depend on each other's state and one window start costs ~10 s. WP-42 and WP-43 have their own unit tests.
- B: three probes (three window starts, duplicated set-up).

## DESKU-Q18 — How the old workbench is reached, and the exe's START key

- **A (taken):** the boot shows the last primary view (default Dashboard) with the workspace's windows hidden until something opens;
  `--start windows` boots straight into the Desktop with its windows (the Irányítópult as it was before U5). START D keeps its key and
  now prefers `VRG Desktop.exe` (passing its own checkout as `--repo`); the new dev key **F** builds the exe. The exe keeps the shell's
  app name (`vrg-dashboard-shell`), so it and `electron.exe Dashboard\shell` share one profile.
- B: turn D into a submenu (start / build) — changes a key the Founder types by heart. C: a productName "VRG Desktop" (a second,
  empty profile: the in-shell apps' saved data would seem lost).

## DESKU-Q19 — A fixed type list (after the review of the theory, 2026-11-10)

- **A (taken):** the catalog's `types` block holds the glossary's terms (56: 35 software units, 21 UI containers) with EN / HU names;
  an item's `type` must be one of them and the detail goes in a free `qualifier` ("utility · calculator"). `validate` (check-catalog)
  and `classify.js` refuse any other type. The 90 free-text types of U2 collapsed into 44 used terms.
- B: free text with a lint for near-duplicates (still not groupable). C: a two-level enum (kind → type) with no qualifier (too rigid).

## DESKU-Q20 — Only things you can open have a level

- **A (taken):** every classification row has a scope: **open** (a level: user / dev / all), **internal** (code modules, libraries,
  config, id schemes, hooks, source folders, the app-host pane) or **roadmap** (plans, ideas, stubs, planned items). U2 had put 127
  rows at "all", most of them never openable. Now: open 418 (user 115, dev 279, all 24), internal 68, roadmap 46. The catalog's planned
  items keep `level: all` so the Katalógus can list them, marked planned.
- B: keep "all" as a catch-all (the original muddle). C: drop internal rows from the inventory (loses the map of what exists).

## DESKU-Q21 — User shows finished things only

- **A (taken):** a User item whose status is not `live` or `beta` shows from the Dev level on (`effectiveLevel`); its declared level
  stays in the catalog, so it moves to User by itself when its status changes. Today: Ügyfélnézet and ServiceKit.
- B: move those items to `level: dev` by hand (and back by hand later). C: show them at User marked unfinished.

## DESKU-Q22 — Third-party programs in the Dashboard view (revises Q04 for them; the Founder, 2026-11-10)

- **A (taken):** a **Programok** section at User level (WP-45). The list is `launcher/programs.json` over every ServiceKit package:
  User sees a short everyday set (7-Zip, Notepad++, Everything, WizTree, CrystalDiskInfo, HWiNFO, SumatraPDF, ShareX, KeePassXC,
  VLC, Zen, Opera GX); Dev and All see every program. Not installed = a ghost; tick one or more and Telepítés installs them in the
  same window, into `Full\programs\<dir>` (the dev category into `Full\programs\dev\<id>`). Installer, ISO and manual sources are
  never run: they stay ghosts that open the official download page, and count as installed once found. The START A list is unchanged.
- B: install into a folder of the Dashboard's own. C: run vendor installers too (admin rights, outside the VRG folders).

## DESKU-Q24 — The Artifact Archive (the Founder asked for it, 2026-11-11)

- **A (taken):** `Archive/` in the repo holds the index and the saved copies (all small, the Founder's own pages, backed up with
  git); the VRG Asztal shows an **Archívum** section at User level and opens `Archive/vrg-archive.html` in-shell. A page Claude
  publishes from now on is added with `node Archive/archive.js add` in the same session (CLAUDE.md). A page that needs files
  beside it, or shows a real client's or a private house, keeps a `localPath` instead of a copy. START key: R → A.
- B: keep the copies outside the repo (`Full\artifacts`) and add that folder to BACKUP. C: links only, no copies.
