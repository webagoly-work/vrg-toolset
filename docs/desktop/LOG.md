# VRG Desktop unify — work log

Branch `desktop/unify` in `H:\VRG\Full\wt-desktop-unify` = `main` (`b4922ab`) + merged `desktop-os/WP-35b` (`5c015d3`).
Plan: `C:\Users\webag\.claude\plans\plan-this-out-in-deep-reddy.md`; prompt: `H:\VRG\Full\notes\desktop-unify\PROMPT.md`.
Run in an attended session on 2026-11-10 (the Founder chose that over the night run).

## U0 — green baseline (2026-11-10)

- START key D collision resolved (DESKU-Q01): UI Kit galéria D → **B**; Irányítópult keeps D.
- `shared/vrg-ui-kit/README.md` row 7 notes the new key. Kapu rebuilt (`node tools/build-hub.js`, kpTools 14).
- Checks: `node Dashboard/test/run.js --all` → 346 pass, 0 fail, selftest ok (343 ids);
  `node tools/check-start.js` → ok (one unlisted page, `Modder/vrg-fenymero.html`, was already there);
  `launcher/test/selftest.ps1` → Rendben.

## U1 — inventory (2026-11-10)

- `Dashboard/tools/inventory.js` (re-runnable, read-only) → `docs/desktop/inventory.json` + `INVENTORY.md`: **526 rows** from 13 sources
  (vrg-menu 153, features 105, dashboard 79, console 51, mobile 19, stack 23, tools 15, prompts 8, agents 17, firmware 4, shared 4, docs 23, folders 25).
- Client codes: 8 features rows held one; the script now swaps codes for their aliases with the anonymise map (the main checkout's copy,
  DESK-Q87 C) and writes nothing without a map. `anonymise.js --check` on the outputs: clean.
- Checks: run.js --all green.

## U2 — glossary + classification (2026-11-10)

- `docs/desktop/GLOSSARY.md`: 30 software-unit terms, 25 UI-container terms, the levels; each with well-known examples and the VRG instance.
- `launcher/vrg-catalog.json` (the decision data, 91 items: 33 user, 52 dev, 6 all) + `Dashboard/tools/classify.js` →
  `docs/desktop/classification.json` + `CLASSIFICATION.md`: all 526 rows typed and levelled (user 118, dev 284, all 124), every
  dev row has a parent in the catalog; 10 naming collisions with proposed names. DESKU-Q02…Q05.
- Checks: classify.js exit 0 (no orphan, no unparented dev row); anonymise --check clean.

## U3 — architecture proposal (2026-11-10)

- `docs/desktop/ARCHITECTURE.md`: why it tangles (7 lists), what VS Code / Windows / macOS / JetBrains Toolbox / Home Assistant–Grafana do,
  the recommended layout, what START / Kapu / Toolbox / hub-seed / Console / Zen become, a 16-row rename table, the migration order.
- DESKU-Q06 … Q12 recorded.

## U4 — the catalog (WP-40, 2026-11-10)

- `Dashboard/shell/lib/catalog.js`: load + validate `launcher/vrg-catalog.json` against `build.collect()` (START acts, servers,
  submenus, features) and the pane kinds; `listFor(level)`, `children(id, level)` (catalog children, START submenu actions, servers),
  `resolve(id)` (act / web / pane / view / frame / start), `appTarget(id)` (the page + the folders vrg-app:// may serve).
- `tools/check-catalog.js` (ASCII, exit 1 on errors; lists START / features apps the catalog does not know: only e6 RL-CYD, personal).
- `Dashboard/test/wp-40.test.js`: 11 tests. Catalog fixes found by the checker: layer ids lowercased (the IPC id type), prompts and
  three items with no opener re-pointed, the map opens its server.
- CLAUDE.md: the catalog rule next to the START rule.
- Checks: run.js --all 357/0, selftest ok; check-start ok; check-catalog ok.

## U5 — primary views + level switch (WP-41, 2026-11-10)

- `Dashboard/shell/lib/desk.js` (UMD, shared by main and page): levels, views, the double-tap detector, `toggleSpec`, the boot steps,
  Dashboard `sections`, `attached` (what a tile carries behind it per level).
- `page/vrg-desktop.html` → title "VRG Asztal": `#stage` holds the Desktop view (top strip, workspace with the ground and the old
  `#root` layout, dock) and the Dashboard view, plus the corner toggle and the boot screen. `page/desk.js` + `page/desk.css` draw them.
- Dashboard sections: Ma · Alkalmazások (by group) · Munkák · Állapot; Dev adds Fejlesztési vonalak · Rétegverem · Ügynökök ·
  Szerverek · Mérőszámok, dev items drawn attached under their parent tile (dashed); All adds the filterable Katalógus table.
  Reuses `dashboard-data.js` (the Kezdőlap's data).
- Level switch: control in both views, palette `desk:level:*`, settings `desk.level` (default user, remembered). View: `desk.view`.
- Toggle: double Tab (DESKU-Q14), double-click on the empty background, the corner button; `config/keymap.json` desktopToggleKey/Ms.
- The Dashboard job list uses `data-role="job-list"` (`jobs` is the frame's fixed job strip and floated over the tiles).

## U6 — the Desktop view (WP-42)

- `page/sui-dial.js` (VRGSuiDial): the Planner SUI dial's design re-written for the frame (01_DESIGN.md §2–§4): 88 px quadrant,
  ≤ 5-row column 100 px above it, 3 per page + TOVÁBB, Back/Bezár at the bottom, breadcrumb, type-to-search, keys 1–5, arrows,
  Esc / Backspace; mirrored for the right corner. While a dial is open the web views are hidden (`desktop.cover`, by reason).
- ◣ tree = the catalog by function (Munka · Alkalmazások · Fájlok · Rendszer; Dev adds Fejlesztés with six roots; a Szint submenu).
- ◢ Rétegverem = layers (User F, I, Q; Dev/All all ten, Z shown not openable) + Konnektóm · Holo · Rétegek · Keresés.
- Dock: pinned user apps, Dev items after a divider, running windows, show desktop. Top strip: DESKU-Q13, Testreszabás sheet.

## U7 — in-shell apps + gate stub (WP-43)

- `shell/lib/appscheme.js`: `vrg-app://<catalog-id>/…` decides every request (the item's folder + `shared/`; a repo-root page alone;
  traversal, encoded traversal, dot-files and secret names refused). `protocol.handle` on `persist:vrg-app`; real origin, localStorage works.
- `views.createApp`: no preload, sandbox, its own partition, off-origin links go to the browser pane; `hideAll/showAll(reason)`.
- New pane kind `app` (`page/panes/app.js`); `desktop.*` IPC namespace (catalog, state, open, server, cover); `auth.enabled`
  page-read-only (DESKU-Q16); boot splash → (gate) → ready.
- Double Tab over a web view: the first version missed forms (the async probe saw the input Tab had just focused); fixed with the
  isolated-world recorder; the probe now checks both: toggles from the app's body, does not from a text field in it.
- Tests: `wp-41.test.js` (9), `wp-42.test.js` (7), `wp-43.test.js` (11); one window probe `shell/selftest/wp-41.js` for all three
  (DESKU-Q17), with screenshots when `VRG_SHOTS` is set. wp-35's channel count 89 → 94 (the desktop namespace).
- The earlier window probes (WP-03 … WP-35) test the workbench, which since U5 starts hidden behind the Dashboard: `--start windows`
  boots the Desktop view with its windows (the selftest gives it to probes below WP-40), and a pane opened from elsewhere (palette,
  hotkey, link) switches to the Desktop with its windows shown instead of opening unseen. WP-20 had broken before this branch: the Stack
  folder's `stack.js q --json` now answers `{ hits:[{ id, node }] }`; `innersearch.parseStack` reads both shapes (test added).
- Checks: run.js --all 387/0; all 20 window probes ok (WP-03 … WP-35, WP-41); check-start ok; check-catalog ok; anonymise clean.

## U8 — VRG Desktop.exe (WP-44)

- `Dashboard/tools/package.js`: copies `{full}\tools\electron` (44.7.1) to `{full}\build\vrg-desktop\` without `electron.exe` and
  `resources\default_app.asar`, as `VRG Desktop.exe`; writes `resources\app\{package.json, main.js}` and `vrg-desktop.json` (the repo).
  Never deletes: an out folder that is not an earlier build is refused. `--dry`, `--check`, `--out`, `--electron`, `--repo`.
- `Dashboard/tools/exe-bootstrap.js` (= `resources\app\main.js`): `--repo <dir>` or `vrg-desktop.json` → `require(<repo>\Dashboard\shell\main.js)`;
  every other argument reaches the shell. A bad repo: an error box (with `--selftest`: a JSON error, exit 1).
- `Dashboard\VRG Irányítópult.cmd` (CRLF, ASCII): the exe with `--repo` this checkout when it exists, else the portable electron.exe.
- START dev **F** "VRG Desktop .exe építése"; catalog item `desktop-exe` (dev, behind VRG Asztal); inventory + classification re-run
  (532 rows; the new `pane:app` row typed). Kapu rebuilt (its tool list did not change).
- Tests: `wp-44.test.js` (6) against a fake Electron folder in %TEMP%.
- Real run: built (75 files, 367 MB); `"VRG Desktop.exe" --selftest` ok (ids 344); `--selftest --probe wp-41` ok; `--repo H:/VRG/Full/nope
  --selftest` refused with the reason; `package.js --check` ok.
- Not done (needs the Founder): the file icon (rcedit, not vendored); the exe's `vrg-desktop.json` names this worktree — after the
  merge run START F (or `node Dashboard/tools/package.js`) from the main checkout once.

## U9 — screens, independent check, report

- Screenshots (from the final code, `VRG_SHOTS`): dash-user/dev/all, desk-sui, desk-stack, desk-app, app-view in
  `H:\VRG\Full\notes\desktop-unify\shots\` (outside git). The empty pane's buttons got the shell's look.
- theresa (read-only) against PROMPT U4–U8: one bug (the START `.cmd` from U8 had control characters where its backslashes were: START D
  could find nothing), scheme name tricks, double Tab in iframes / stale reads, package.js marker order. All fixed with tests; see
  MORNING.md for what was left and why.
- `docs/desktop/MORNING.md`: the report.

## After the merge — the theory tightened (2026-11-10)

- Review of GLOSSARY / CLASSIFICATION / ARCHITECTURE: four mechanical fixes made, four points left to the Founder (in ARCHITECTURE §6.5).
- DESKU-Q19 the fixed type list (`types` in the catalog, `qualifier` for detail; validate + classify enforce it; tiles show
  "Utility · calculator"); Q20 scopes open / internal / roadmap (level only for open rows); Q21 User = `live` / `beta` only
  (`effectiveLevel` in catalog.js: Ügyfélnézet and ServiceKit now show from Dev).
- GLOSSARY: where the list lives, six terms it lacked (device, library, web service, folder, asset, category), scopes.
  ARCHITECTURE: up to date (counts, Q01…Q21, migration status, the collision renames marked ●, the Founder's open calls).
- Tests: wp-40 +3 (type list, the User rule, classification scopes); wp-40 / wp-41 fixtures updated.

## WP-45 — Programok: install third-party programs from the Dashboard view (2026-11-10)

- `launcher/programs.json`: the levels, folders and detect paths over the ServiceKit catalog (70 packages) + VLC, Zen, Opera GX,
  KeyTweak = 74 programs, 12 at User. DESKU-Q22.
- `Dashboard/shell/lib/programs.js`: merge, detect (detect paths, else the app's exe under its folder, 3 levels), resolve sources as
  ServiceKit does (url / github / scrape / sfrss, https only), download with Node's https (fetch crashed the process on a paused
  stream end), zip via System32 tar (never Git's GNU tar), 7z / sfx via a 7za bootstrapped into `programs\_kit`, a lone top folder
  stripped, links in an archive refused, post steps (vscode-data, portable.ini/txt), `programs\_state.json` (version, url, sha256).
  One job per program (kind `program`); the install level is the saved `desk.level`, never the page's word.
- IPC `programs.list / install / launch / page / folder`; preload `vrg.programs`; catalog section `programok` (User);
  `page/desk.js` secProgramok (ghost / page / busy / installed, select, Mind kijelölése, Törlés, Telepítés (n), filter); desk.css.
- Tests: `wp-45.test.js` (8, a throwaway folder, no network); probe `shell/selftest/wp-45.js` (User 12, Dev 74, ghost styles from
  computed CSS, ticking, refusals); wp-41 section lists updated. Live run into a temp folder: Everything, SumatraPDF, 7-Zip (sfx via
  the 7za bootstrap), CrystalDiskInfo, Rufus all installed and found.

## WP-46 — Workspace: Lapok (Sheets) on a 4 × 4 grid (2026-11-11)

- `Dashboard/shell/lib/sheets.js` (shared, pure): doc / sheet / window / preset model, validate, open (= full, tile = the clicked cell),
  minimize (one cell) / maximize / restore, resizeTarget (edges between where they were and the pull, nearest free wins), moveTarget
  (free, or a same-size swap), moveToSheet, view (covered under a full one), presets (fromPreset / savePreset). DESKU-Q23.
- `Dashboard/page/sheets.js`: the layer (16 cells + windows by grid-area + a drag ghost), headers (tab, ▢/⧉, ▁, ✕, double-click,
  right-click menu, drag), 8 grips, the picker (search + groups, URL → browser, cat items through desktop.open), the sheet bar (tabs,
  ＋ presets, rename, save as preset, order, bar top / bottom, close with confirm), keys (Ctrl+Alt+↑/↓/←/→/N, Ctrl+W), save now for
  structure / 600 ms for pane state.
- `frame.js`: one pane host for tree and sheets (`VRGFrame.host`, owner tree|sheet), open / find / focus routed to the Lap in front,
  rects from both, the tree prunes only its own panes. `layout.js`: no tree keys while a Lap is in front. `desk.js`: showWindows /
  bars / dock / boot go through VRGSheets; `VRGDesk.apply`. `catalog.js`: listFor `win` (opens as a window).
- Main: `desk.sheets` setting, IPC `sheets.get` (doc + presets) / `sheets.set`, `pruneViews()` over tree + sheets, `config/sheets.json`
  (7 presets: Üres, Áttekintés, Iroda, Posta és web, Készlet és árak; Dev: Fejlesztés, Claude munka). wp-35 pinned channels 99 → 101.
- Tests: `wp-46.test.js` (12); probe `shell/selftest/wp-46.js` — real input events: + menu, right-click picker, typed search + Enter,
  double-clicks, corner drag to 2×2, header move / refused move, tabs ⇄ Munkapad, dock, saved doc, refused overlap, Iroda preset with
  two app views measured inside their windows, a tree save that keeps them, full hides them, closing prunes them.
- **Dev/Code preset (first showcase sheet, Dev level):** Jegyzet 2×2 (the dev-note pane stands in for VRG Jegyzetek, which is not built
  yet: docs/notes), Thread Board 2×1, Claude Code (A) / Parancssor / PowerShell 1×1, a browser 2×3 on Google with the keyboard in its
  search box. New: preset `focus` (index of the window that gets the keyboard; Mentés sablonként keeps it; `presetFocus`), the web
  pane's `focusInput`. The Thread Board (`Full\notes\devlog\BOARD.html`) got START R → L and catalog `threadboard` (app act); the
  vrg-app scheme serves a page from a work folder outside the repo (main's `APP_ROOTS` = `Full\notes`) with its own folder as the
  root, nothing above it (DESKU-Q23 addendum). A preset's focus holds for up to 12 s (focusin + a 120 ms check of activeElement): terminals
  focus themselves when their shell starts and would take the keyboard; a click or a key elsewhere ends the hold. A starting terminal
  now asks first (`VRGSheets.holding()`) and does not take the keyboard from a held window; the timer is only the fallback (in a
  background window Chromium throttles it to ~1 s, which made the probe fail 1 run in 3 before this).
- **`Dashboard/page/panes.css` (new):** the inside of the Böngésző and Jegyzet panes in the Mélyvíz look, scoped by
  `[data-pane][data-kind=…]` (the Lap window carries data-kind too): tab strip with an accent top line, the address bar (mono omni,
  icon buttons, bordered panel buttons that light up for the open panel, tighter under 520 px by container query), find / ask bars,
  panel lists; the Jegyzet form as a label grid whose text field fills the window, an accent Mentés. The same rules draw the "Mentés
  fejlesztői jegyzetként" dialog. Web bar labels shortened (Szerverek, ↗ for the external browser; the full text is the tooltip).
  Then **Fájlok** (the two sides with an accent top line on the active one, root tabs, a mono path, a sticky sortable header with
  ▲/▼, dirs in accent, the cursor row with an accent edge, marked rows warm, size/date in mono, date and state dropped under 460 px,
  status line, the F7/F2 ask bar docked at the bottom, menus) and **Git** (labelled sections, change-kind chips coloured by kind, the
  diff in its own column from 760 px, an accent Commit, a warm Push, "main" warning bar; the h2 hidden as the window says Git).
  Then **Posta** (account pills, search, list rows with unread dot / sender / mono date / two-line snippet, the open mail with an accent
  edge, headers, attachments; the read box shows only while a mail view sits there), **Rétegverem** (search, hits, the cluster with
  layer chips, budget meter ok/over, send buttons in accent), **chat** (thread list, user bubbles right in accent, answers left with a
  warm edge, code in mono, chips, A/B, Küldés), **Hírek**, the **empty pane** (a grid of kinds), the **search panel**, the **Nézőke**
  (line numbers, markdown), the **terminal bar** and xterm itself (`term.js` THEME: the Mélyvíz colours instead of black), the app box.
  Every pane is now in the look; all checked as computed styles in the probe.
- **Dock window buttons:** with many windows open the labels lost both ends ("ontextuscsoma"): a button centres its content and
  ignores `text-overflow`. The label is now a span that carries the ellipsis ("Kontextu…"); the full name is the tooltip.
  The probe's screenshots (`VRG_SHOTS` runs only) switch off background throttling, else the hidden window showed the previous Lap.
- **Kezdőlap (`vrg-dashboard.html`)** in a tile: its own − □ ✕, the drag region and the double-click maximise are gone (the page
  only ever runs in a view of the Asztal now; the frame owns the window); a ≤ 520 px layout for 1-2 cell tiles (no sideways scroll:
  498 → 385 px at 1×1). The selftest only checks that `.wbar` exists; it still does.
- **`VRGSheets.closeSheet(sid)`** (the tab menu's close, exposed). Found on the way: removing sheets by writing main's doc
  (`vrg.sheets.set`) leaves the page's panes mounted, so a real `cmd` / `powershell` pty stayed alive and Electron's `app.exit()`
  never returned (status 124 after 400 s; 16 s without terminals). The probes now close through the page; WP-15 had the same rule.
  A selftest also starts with no Lapok (`desk.sheets` reset next to `layout.tree`), so one run's sheets cannot leak into the next.
- **Catalog speed:** `listFor` read the registry (`collect()`) up to three times per item (resolve, the new `win`, children). It now
  takes one snapshot per call and resolves each item once. Tests that pass an uncached `build.collect()` went from 36 s / 99 s to 6 s
  each; the full `--all` run had crossed run.js's 5-minute limit. Main always passed a cached collect, so the app was not slowed. Tests +3; the probe opens Dev/Code with fake-claude and a 127.0.0.1 page for Google.
