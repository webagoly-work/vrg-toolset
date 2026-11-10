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
