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

## WP-47 — Archívum: the Artifact Archive (2026-11-11)

- `Archive/`: one container for every one-shot interactive HTML page Claude made. `index.json` (the source: title, created /
  updated, VRG or not, group, kind, summary, purpose, what was going on at the time, tags, the claude.ai link), `index.js`
  (generated, so the page also works from file://), `files/<id>.html` (the saved copies), `archive.js` (list / check / build / add),
  `vrg-archive.html` (the viewer: VRG first, scope + group + search, a timeline, the detail card, the page run in a viewer).
- First fill: 38 entries (19 VRG, 19 other), 28 saved copies. Docs / Design / Design System artifacts and the shared Mélyvíz stay
  link-only (their content lives in the type's store); Finom lap (needs files beside it) and the Domoszló viewer (a real house)
  stay where they are (`localPath`). The two empty Untitled canvases are left out. DESKU-Q24.
- START: R (Rétegverem) → A Archívum (the main screen has no free letter). Catalog item `archive` (User, knowledge base ·
  artifact archive, in-shell on vrg-app://archive/), section `archivum` (User).
- Shell: IPC `archive.list / show / add`; preload `vrg.archive`; `show` opens the app at `#<id>` (or `#<id>/open`), also before
  its view exists (appHash, read when layout.bounds creates the view); `add` opens main's own file dialog, never a page path.
- `page/desk.js` secArchivum: VRG / Egyéb / Mind, filter, a card per page (ice edge = VRG, warm = other), ▶ runs the page,
  Hozzáadás = a short form + the file dialog. desk.css.
- The viewer's iframe keeps `allow-same-origin`: with an opaque origin the archived pages loaded but did not paint in the
  browser pane, and their own saved state could not persist. They are our own pages; navigation away is still refused by the shell.
- Tests: `wp-47.test.js` (4: the real index valid and VRG-first, add/build/stale on a temp folder, validate, catalog + scheme +
  sections); probe `shell/selftest/wp-47.js` (section, computed edge colours, refusals, a card opens the app at the entry);
  wp-41 section lists updated. `tools/melyviz-sync.js` carries the style into the viewer.

## WP-49 — Telefon: radios, every server, a QR per server (2026-11-14)

- Asked for: one easy click that finds the PC's wireless radios (Wi-Fi, Bluetooth), starts every localhost server (by itself or on
  a toggle) and shows a QR per server for the phone (on hover, or a show/hide button), matching VRG Mobile's new QR button.
- Button: **Telefon** first in the top strip (fixed, not a widget a saved strip could lack or an overflow could hide) and in the
  Irányítópult head; catalog item `phone` (User, launch frame `phone`) for the palette and the Sarokvezérlő.
- `shell/lib/phonelink.js`: one PowerShell `-Command` (Get-NetAdapter + Get-PnpDevice Bluetooth + netsh SSID, ~4.5 s) →
  Wi-Fi / Mobile hotspot / Bluetooth radio + PAN / wired; addresses wireless first, Hyper-V & co. never offered. Bluetooth is shown,
  but the QR rides Wi-Fi, the hotspot, or the LAN (a BT PAN address is offered when one exists). `startAll` = the Gyro relay with
  `--ports` first (restarted only when the shell owns it), then every registry server that is down minus `config/phone.json`'s
  exclude list (the `self` servers that open their own window + the Kapu admin). Setting `phone.auto`: on with a wireless link up,
  the panel's opening and the shell's start do it without the click.
- Why the relay: most servers listen on 127.0.0.1 only. The relay (one port, one firewall rule) got `GET /share/<port>.json`
  (this PC only, the `/pair` rule): `http://<ip>:47291/p/<port>/<path>?vrg_s=<ticket>` + its SVG QR. The ticket lives 5 min and
  opens that one port without pairing; it becomes the cookie `vrg_s<port>` (12 h, that port only); `POST /share/clear` revokes all.
  Reusable within its 5 minutes so a scanner app that previews the link cannot burn it for the phone.
- Page `page/phone.js` (+ desk.css): Rádiók, the address picker, the relay row with the pairing QR, Mind indítása + the auto
  switch + Megosztások visszavonása, the servers with ▦ (QR on hover) and QR ▾ (inline, renewed before the ticket runs out).
  QR = an `<img>` of the relay's SVG (data:), never injected markup. IPC `desktop.phoneScan / phoneStart / phoneQr / phonePair /
  phoneClear`; the page sends a server id and an address the scan returned.
- Mobile: `core/ScanCode.kt` (pair / server / VRG link / LAN page / other) + the home screen's **QR BEOLVASÁSA** button →
  the scanner (feature-pair): a server QR opens at once in a Custom Tab. desk-gen REACH `phone → native pair`, PARITY row 35.
- Tests: `wp-49.test.js` 11; probe `shell/selftest/wp-49.js` (both buttons, real scan, server list, dry start, refusals, a
  real QR with a throwaway relay up); wp-35 channel pin 107 → 112; `Mobile/tests/relay-ports.js` 89 (22 new); kit-core
  `ScanCodeTest` 6, KommandTest pin 34 → 35, 216 green; `assembleDebug` OK. Not run on the phone yet.

## WP-49b — corner metrics and the VRG Mobile download QR (2026-11-14)

- Asked for: in the upper right corner, a show/hide toggle for the internet connection's strength, ping and the other metrics,
  each switchable one by one, side by side as colour-coded numbers and percentages; and a QR for a phone that has no VRG Mobile yet.
- Title bar (both views), just left of the window buttons: `page/netbar.js` + `shell/lib/netgrade.js` (shared, pure: 10 metrics,
  thresholds, formats). ◉ hides / shows the row (setting `net.show`, default on); ▾ lists all ten with a switch and the live value
  each (`net.metrics`, the order they were switched on; Mind / Alap). Green = good, sand = weak, coral = bad, ice = traffic (no
  judgement), grey dash = no value (e.g. Wi-Fi while the dongle is not connected). Default: Wi-Fi, ping, loss, ↓, ↑.
- `shell/lib/netmeter.js` (main, IPC `desktop.netSample`, every 2 s only while shown and the window is visible): ping = a timed TCP
  connect to 1.1.1.1:443 (else 8.8.8.8:443), jitter and loss over the last 20; Wi-Fi signal and link rate from `netsh wlan show
  interfaces` by value (the "NN%" line, the "(Mbps)" lines), every 5 s; ↓ / ↑ from `netstat -e` byte counters; DNS = a timed system
  lookup every 10 s; CPU between two samples; RAM. No admin rights, no translated text read. A selftest gets a fixed sample.
- VRG Mobile download: the releases are on a private GitHub repo a phone without the app cannot read, so the relay serves the APK
  built on this PC (`findApk`: RELAY_APK, else the newest of `Mobile/android/app/build/outputs/apk/{release,debug}`).
  `GET /share/app.json` (this PC only) → a QR to `/vrg-mobile?vrg_s=<ticket>` (10 min, no --ports needed): a phone page with the
  download button and the three steps (Telepítés → allow the browser to install → QR BEOLVASÁSA → the pairing QR), and
  `/vrg-mobile.apk` itself. `POST /share/clear` revokes it too. Panel row "VRG Mobile · Alkalmazás letöltése"; IPC `desktop.phoneApp`.
- Tests: `wp-49.test.js` 15 (+4: grades / formats, the netstat / netsh parsers in English and Hungarian, the sampler on fakes, the
  download QR); probe: the corner row's values, grades and computed colours, the menu (10), switching metrics on and saving them,
  Esc, ◉; the download QR with a throwaway relay; wp-35 channel pin 112 → 114; `relay-ports.js` 102 (+13).

## DevLap — a Lap for picking the dev work up (2026-11-23)

- The Founder asked for one sheet that opens the trackers already built, to find where the work stands and pick a dev
  line up. Preset `devlap` in `config/sheets.json` (Dev level, the whole 4 × 4 grid, focus on the terminal):
  L · Vonaltérkép 2×2 · a browser 2×2 with 13 tabs (claude.ai/code, GO-MAIN, Actions, branches, commits, releases, the
  Mobile roadmap, Rétegverem control / runs / decisions / lineage / commits / search) · Thread Board 2×1 · Claude Code
  (A) 2×2 · git 1×1 · Divergencia 1×1. The L window starts the stack server before the panes open (newSheet awaits
  `desktop.open`), so the browser's 127.0.0.1:8806 tabs load. The phone has its own DevLap (VRG Mobile D-172).
- Tests: `wp-46.test.js` +1 (tiles, focus, every tab restorable, the local tabs on the stack server's port and real
  Stack pages, the GitHub file tabs exist in the repo).

## WP-50 — the VRG Böngésző joins the Asztal: one links format, the pane gets the brain (2026-11-23)

*Number clash: the Munkamenetek work (below, 2026-11-24) also took WP-50. At the merge into main (2026-11-25) this
section kept its number and its test moved to Dashboard/test/wp-50b.test.js (run it with --all or ode --test).*

T1 and T2 of `docs/browser/TRAJECTORIES.md` (BRW-Q01 … Q04 = A).

- **One links format (T1, BRW-Q01 A).** `<userDir>/web.json` is the master of `vrg.web-links` v1 (the Data Vault's browser-kit
  format, DV-Q22). `lib/bookmarks.js` gains `snapshot()`, `applyOps(ops)` (the rules of `Browser/src/core/links.js`: http(s) only,
  the limits, idempotent) and `absorb()` (the inbox `Browser/serve.js` leaves as `web.json.inbox`; taken by rename, every 30 s and on
  each request). `lib/applinks.js` answers `vrg-app://browser/__vrg/links` inside the `vrg-app` handler, to the browser app's origin
  only: GET the links, POST ops. No preload, no IPC channel (DESKU-Q08 kept). The pane's own history is now the app's history too.
- **The pane gets the brain (T2).** `lib/search.js decide()`: a `!bang` picks an engine of `Browser/config/engines.json`, a URL
  loses its tracking parameters, one with a user name or password is refused with a Hungarian reason; `toUrl()` keeps its answer.
  `web.go` and `omni:` targets use it. The Ctrl+K palette shows Gyorsválasz (`Browser/src/core/answers.js`, loaded by the frame
  page) above the rows; a click or Ctrl+Enter copies the result.
- Tests: `wp-50.test.js` 5 (ops idempotent and written as the two arrays, the inbox absorbed once, the door's origin / method / size
  rules, `decide()`, the frame page's scripts); `wp-18` 9 unchanged. The Electron probe was not run (no Electron in the cloud
  session); `wp-08`, `wp-20`, `wp-35` (2), `wp-41`, `wp-43` fail here as before the change (they read `H:\VRG\Full`).

## WP-50b — the VRG Böngésző's knowledge and watches reach the Asztal (2026-11-23)

Phase 3 of `docs/browser/TRAJECTORIES.md` (T5, T6).

- **Küldés Claude-nak.** `lib/applinks.js` answers `vrg-app://browser/__vrg/claude` (the browser app's origin, POST, JSON, ≤ 200 000
  characters); `lib/ctx.js packText(title, text)` writes the pack file as `pack()` does; main emits `browser/claude { packId }` and
  `page/frame.js` opens the chat pane with the pack attached (`openChat`). Nothing goes to Claude until the user asks.
- **Belső keresés: Dokumentumok.** `lib/innersearch.js` takes the repo's Markdown index (`Browser/lib/docs.js`, built on the first
  search) as a third half; `search.openHit` takes `kind: 'doc'`; `page/panes/search.js` draws the section and opens a hit in the viewer.
- **Figyelés.** `lib/presets.js` gains the network kind `page-watch` (allowed hosts, no redirects, as `page-text`): the page's
  readable text (`Browser/lib/reader.js`, short lines kept) against the last run's lines, kept in the cache record's `state` (never
  sent to the page; a failed run keeps it); a change → a *Változott* item and `sources.notify`, which main sends to the relay's
  `/notify` on this PC (VRG Mobile Értesítések). Watches are added by the browser through `Browser/serve.js /api/watch` into
  `<userDir>/presets.json`, with their host in `allowHosts`.
- Tests: `wp-50.test.js` 8 (+3); `wp-20` 12 / 1 and `wp-29` 17 as before the change.

## WP-50 — Munkamenetek: Claude Code sessions inside the VRG Asztal (2026-11-24, cloud session)

- Asked for: an embedded window with one of the cloud sessions of vrg-toolset or one of the local H: sessions, as the Claude
  app shows them, and terminal views too. What exists and what does not: a cloud session already opens in a Böngésző pane
  (claude.ai/code, the DevLap's first tab); the Claude app's own native window cannot be embedded; a local session reaches the
  same web view only through Remote Control; a cloud session has no terminal to embed, only `claude --teleport` brings it down.
- New pane kind **`sessions`** (Munkamenetek; catalog item `sessions`, Dev, under `dev:ai`, beta; dock + Ügynökök section):
  the local sessions of A (`~/.claude`) and B (`Full\home\claude-account-b`), newest 120, each with account, age, ÉLŐ, title
  (the first real prompt, else the summary), project folder name, branch and size; filter by account and words. Buttons:
  **Folytatás** (`--resume <id>` in the transcript's own `cwd`), **Másolat** (`+ --fork-session`), **Távvezérlés**
  (`/remote-control` as the first prompt: unverified, see the handoff), **Vászon** (the Munkavászon at `#s=<id>`); bar:
  **Felhő** (claude.ai/code in a Böngésző pane), **Áthozás** (a Claude terminal in the repo with `--teleport`), **Frissítés**
  (also every 20 s while shown). DESKU-Q25.
- `shell/lib/sessions.js` (list / resume / teleport / canvas / find): the page names an account and a lowercase UUID; main finds
  `<root>/projects/*/<id>.jsonl` and reads the folder from it. Replies carry no path (the folder's last name only). Live =
  written in the last 2 minutes: Folytatás is refused (two processes on one transcript), Másolat works. A vanished folder is
  refused by name. `VRG_SESSIONS_ROOTS="A=<dir>;B=<dir>"` replaces the roots (tests only, CONTRACT §4.9).
- IPC `sessions.list / resume / teleport / canvas`; preload `vrg.sessions`; the kind added to `shell/lib/layout.js` and
  `sheets.js` KINDS, `page/layout.js`, `page/sheets.js` (picker MM), `panes/empty.js`, `shell/lib/palette.js`, `desk.js`
  (one instance, focused); `panes.css` (A edge accent, B edge warm, ÉLŐ in ok-green).
- SessionCanvas: `/api/sessions?s=<uuid>` adds that session when it is older than the newest 80; the page opens `#s=<uuid>` and
  switches *mindig a legújabb* off.
- Tests: `wp-50.test.js` 7 (fixtures in a temp folder); wp-35 channel pin 115 → 119 and the `sessions` namespace; the full
  `Dashboard/test` suite on Linux: 309 pass, the same 68 environment failures as before the change (no H:, no Electron). A
  Chromium render of the pane with a stubbed `vrg`: rows, computed edge colours, every button's call. The Munkavászon's `#s=` on
  a throwaway config folder of 85 sessions. **Not run:** the Electron probe `shell/selftest/wp-50.js`, check-start /
  check-catalog against H:, inventory.js (needs the anonymise map), the real `claude` flags. All in
  `docs/handoff/2026-11-24_munkamenetek-H.md`.
- **Local check (2026-11-25, H:, a worktree of the branch):** WP-50, 51, 52, 35, 46, 24 green; the Electron probe
  `selftest/wp-50.js` green on its first run, unchanged. `--all`: 468 pass and the same 4 failures as `main` before the branch
  (449 pass), all from the catalog entry `sketcher.house3d`, which also makes check-catalog exit 1 on `main`. check-start exits
  0 from the main checkout (a worktree cannot find START.cmd). The probe listed 120 sessions (A 118, B 2), newest first.
  inventory.js + classify.js refreshed: 631 rows. Real `claude` on account A: `--resume` returns the history, `--fork-session`
  makes a new id and leaves the old transcript byte-identical, `--resume --model opus` continues on opus, `--teleport` lists
  the cloud sessions (none pulled: the clean-tree / branch needs are untested). `/remote-control` as the first prompt runs as a
  command but opens an Enable / Never mind menu that needs one keypress. Account B's sign-in had expired: its checks did not
  run. **Live marker:** Claude Code writes `~/.claude/sessions/<pid>.json` (sessionId, cwd, procStart = the process start,
  status busy / idle / waiting); the 2-minute file-age guess missed a live session whose transcript was 18 minutes old.
  Proposed: use these files + a pid check; not changed.

## WP-51 — Munkamenet-tábla: board labels on a Lap (2026-11-24, cloud session)

- Asked for: besides the list, a board like the Desktop's 4 × 4 Lap; around every window its origin (local / cloud / another
  machine) as text and as a colour frame, the session's title above, a note below; each of the four shown or hidden on the board,
  and overridable per window by right-click. Approach B of `docs/research/2026-11-24_elosszuro-roadmap.md` §1: a Desktop Lap
  with labels, not a second grid. DESKU-Q26.
- `shell/lib/sheets.js`: optional `sheet.board = { kind?:'sessions', show:{ origin, color, title, note } }` and
  `win.deco = { origin?, machine?, account?, session?, title?, note?, color?, show? }`, strictly validated (no other key, texts
  ≤ 80 / 200 / 40, no control characters); `setBoard`, `setDeco` (null / '' = back to automatic, an emptied deco is removed),
  `boardOf`, `label(sheet, win, auto)` (the board's switches, the window's overrides, then what the pane reports).
- `page/sheets.js`: every window has a label bar above (origin chip + title) and a note bar below; the frame takes the colour
  (`data-deco`: ice local, violet cloud, warm machine, or the window's own). Automatic: a `claude-a/b` terminal = Helyi · A/B with
  the title Claude Code sets (term.title events); a browser on claude.ai/code = Felhő with the page title. Right-click on the bars
  or Címkék… in the window menu: Cím…, Megjegyzés…, Eredet (Automatikus / Helyi / Felhő / Másik gép…), Szín, Ennél az ablaknál
  (each of the four: tábla szerint → mindig → soha), reset, the board switches. Double-click the title / note to edit. Sheet tab →
  Tábla-címkék… turns labels on for ANY Lap. `VRGSheets.sessionBoard()` makes the Munkamenetek board once (Vezérlő 4 × 1 on top,
  Munkamenetek 1 × 3 on the left) and switches to it; `decorate(id, deco)`, `labelOf(id)`, `onBoard()`.
- Main hands its labels over: `claudeterm.open({ deco })` → `layout.open { …, deco }` → `frame.adoptTerm` → `VRGSheets.decorate`;
  a resumed session = local, its account, its id and title; Áthozás = local, "Áthozva a felhőből".
- Munkamenetek: **Tábla ⇄ Lista** button; **Gyors elérés** right panel (`shared/sidepanel`, folded to its icon rail when the
  pane is narrower than 560 px): Munkavászon, Ügynöknyom, Napló, Divergencia, Rétegverem, Vonaltérkép (Egyszerű) + Futásnapló,
  Vezérlőterem, Döntésnapló, Thread Board, Kontextuscsomag, Claude oldalchat, GO kódszavak, Promptok (Részletes), via `VRGDesk.open`.
- `shared/sidepanel/` (new, a fork of this work): the Planner's side panel (`Planner/projects/varler-planner/src/05db-layout.js`,
  `shell.html` `.side`/`.grp`) as a plug-in for any page: modules with controls, simple / detailed mode, icon rail, resize grip,
  per-key saved state; built-ins links / toggles / notes / status; `README.md` lists six more hosts. Loaded by `vrg-desktop.html`.
- Tests: `wp-51.test.js` 5; `shared/sidepanel/test` 7 (one in Chromium). A Chromium render of a mock board with the real CSS:
  frames ice / violet / warm from computed styles, no page errors.
- **Local check (2026-11-25, H:):** WP-51 green. An Electron probe with a fake `claude`: Tábla opens the Munkamenetek Lap
  (Vezérlő 4 × 1 on top, the list 1 × 3 on the left) and the button turns to Lista; a resumed session lands with HELYI · A, its
  title and an ice frame; origin Laptop gives GÉP: LAPTOP and a warm frame; Gyors elérés starts folded at 395 px. Fixed: the dock
  showed the raw kinds `sessions` / `controller` (`PANE_HU` in `page/desk.js` lacked them). Screenshot:
  `Full\_share\munkamenet-tabla-2026-11-25.png`. Not done by hand: the right-click menu, Tábla-címkék…, a violet cloud window, the
  native-view shift under a label bar.

## WP-52 — Vezérlő + Előszűrő: one prompt box, filtered into a new session (2026-11-24, cloud session)

- Asked for: a central controller above the board. Section 1 = one prompt box; Egyszerű: ＋ (attach) and Küldés; Részletes: a
  row of buttons (Tallózás, Legutóbbiak, Mappa, Galéria, Fotó, QR, Küldés). A prompt is never sent as typed: an offline filter decides
  whether it is a new independent request or one that depends on VRG work and context, and dresses it with a harness (sources,
  rules, output form, model) for consistent and cheaper sessions. Section 2 is the Founder's next part (a placeholder).
- `Prefilter/` (new, a fork of this work): `prefilter.js` (`buildIndex` / `loadIndex` with a gitignored cache, `analyze`, `dress`),
  `rules.json` (thresholds 0.55 / 0.3, weights, intent and continuation words, the three Hungarian templates), `common-words.json`,
  `cli.js`, `README.md`, tests 7. Index here: 445 entities, ~0.1 s; 6–10 ms per prompt.
- `shell/lib/gate.js`: attachments as ids (main's dialog, the recent list in setting `gate.recent`, a roots.json folder, a camera
  photo saved to `Full\inbox\vezerlo`), paths only inside main's prompt; `analyze` (verdict, anchors, the dressing, where it would
  start) and `send`: always dressed; independent → `Full\home\claude-free` (no CLAUDE.md: no VRG context loaded), context /
  unsure → the repo; `--model` from the verdict or the user; window labels (title = first line, note = the route + model).
  `claudeterm.open` takes `maxPrompt` up to 12 000 for a dressed prompt.
- IPC `gate.analyze / send / pick / recent / folders / photo` (wp-35 pin 119 → 125); preload `vrg.gate`; pane kind `controller`
  (`page/panes/controller.js`, panes.css), catalog item `controller` (Dev, under `dev:ai`, beta). QR uses Chromium's
  BarcodeDetector where the platform has one (not on Windows desktop: the pane says so and points to VRG Mobile).
- The frame page's session has no permission handler (Electron allows by default), so the camera works; that default is itself a
  finding for the local session (handoff), not changed blind.
- Research: `docs/research/2026-11-24_prompt-prefilter-research.md` (sourced notes) and `2026-11-24_elosszuro-roadmap.md`
  (the board choice, the pipeline of five stages, 11 vectors).
- Tests: `wp-52.test.js` 6 (a fake Előszűrő, then the real one on this repo); the full Dashboard suite: 320 pass, the same 68
  environment failures as before WP-50. Not run: Electron, the camera, the real `claude --model`.
- **Local check (2026-11-25, H:):** WP-52 green under Electron 44.7.1. `node:sqlite` works in Node 24 and in Electron, so the
  index takes the Stack: 1 243 entities (with `VRG_FULL` set and the Stack database present). A dressed 1 978-character accented
  prompt arrives intact as one argument of `claude.exe` on Windows. Vezérlő probe: "írj egy verset a télről" → independent,
  `claude-free`, but **sonnet** ("írj egy" is the build intent; only an independent question drops to haiku; open); "GO MOBILE hol
  tartunk?" → the repo, sonnet; "folytasd" → the reason names the earlier session; a forced Önálló wrote an `override` label.
  The frame page grants camera, microphone (a stream opened), notifications, geolocation, clipboard-read and MIDI without asking;
  proposed: a handler allowing video only, one-shot after Fotó (not applied). No `BarcodeDetector`: the pane points to VRG Mobile.
  Not done: Fotó with a real camera, the attach dialogs by hand.

## WP-53 — Előszűrő next steps: hook, negation, work-line memory, evaluation, the stronger-model step (2026-11-25, cloud session)

- The roadmap's first vectors (`docs/research/2026-11-24_elosszuro-roadmap.md` §3: 1, 3, 4, 7 and negation).
- `Prefilter/hook.js`: the Előszűrő as a Claude Code `UserPromptSubmit` hook. The first prompt of any session gets its dressing as
  `additionalContext`; later prompts stay quiet unless a new named thing appears or an independent session turns to VRG (a two-line
  "új horgony" note with one Stack search). Skips Vezérlő-dressed prompts, slash commands, `VRG_PREFILTER_OFF=1`; never blocks, never
  logs the text. `--install [--user] [--dry]` writes the settings entry with absolute node and script paths. **Not installed**: it
  would run in every session of the repo; the Founder decides (handoff step 6).
- `prefilter.js`: negation (`rules.negation`: a window after ne / nem / not / without …, before nélkül → weight × 0.1, no anchor) and the
  prior (`analyze(…, { prior })`, `rules.prior`): a bare continuation word takes the previous session's anchors.
- `Prefilter/eval.js` + `eval/seed.jsonl` (44 made-up prompts, hu + en): run / fit (weighted cost: context judged independent = 3)
  / extract (the first prompt of every local session) / label (c / i / s / q). Labels and candidates stay in the gitignored cache.
  Seed set: accuracy 0.886, no context → independent mistake; the fit's suggestion (context ≥ 0.35) is not applied.
- Vezérlő (`gate.js`): the prior is the most recent local session's first prompt (shown in the preview's reasons); a route forced
  against the verdict is recorded as an evaluation label.
- Munkamenetek: **Erősebb modellel** on an idle session = `--resume <id> --model opus` (the cascade step; IPC `sessions.resume`
  gets `stronger`).
- Tests: `Prefilter/test/next.test.js` 4 (on the real repo index), wp-50 / wp-52 extended; the full Dashboard suite: 321 pass, the
  same 68 environment failures.
- **Local check (2026-11-25, H:, a worktree of the branch):** the Prefilter + sidepanel tests 17 pass, 0 fail, 1 skipped (18). The
  hook: `--test` from the repo and from `Full\home\claude-free` gives the full dressing; the `--session t1` sequence behaves as
  specified (full dressing → nothing for "folytasd" → the two-line "új horgony · Kapu" note → nothing). `--install --dry` writes
  the absolute path of the copy it runs from, so install it from the main checkout after the merge; **not installed**. `eval
  extract`: 182 first prompts; labelling left to the Founder. With the Stack the seed accuracy drops to 0.864 (0.932 without it):
  the 2 288 Stack titles add common words as anchors (all 10 real first prompts came out as context). Proposal, not applied:
  keep only multi-word Stack titles or down-weight them. `fit --set all` suggests independent < 0.55 (no unsure band); not
  written.

## WP-55 — Parancs-héj: the voice command overlay (phase 2 of the voice work, 2026-11-25, cloud session, a fork)

- Asked for: short spoken commands and questions on top of the whole Desktop (push-to-talk, like the control-assist shell of
  Westworld S1E5), the answer in as few words as possible, while it drives the Desktop and knows what is on screen. Phase 1
  (WP-54, the offline dictation) delivers the words; this layer understands and acts on the `command`-mode ones.
- `Voice/command/commands.json`: the registry as data, 34 commands with Hungarian and English ways to say them. It covers:
  - open a catalog item, go to a Lap (next / previous), the Munkapad, the board / list, the Dashboard or Desktop view;
  - focus / maximise / restore / shrink / **close** a window;
  - Munkamenetek: resume the latest, on opus, open the canvas;
  - the Vezérlő: fill (never sends), **send**, clear;
  - window labels: note, title, machine, origin, colour;
  - the level with an authorisation phrase;
  - questions: screen, window, sessions, live, Vezérlő;
  - mégse, ismételd, súgó.

  Plus the wake word, the fillers, yes / no, the auth phrases, colours, origins, machines, pane-kind names, and `phrases` (the words
  phase 1 biases the recogniser towards). `build.js` writes `commands.js` (`window.VRGVoiceCommands`) for the frame page, whose CSP
  cannot fetch JSON.
- `Voice/command/parse.js` (UMD): fold and stem exactly as `Prefilter/prefilter.js` does, then a phonetic layer (double letters,
  ly→j, w→v …) with an edit distance that grows with the word, so recogniser slips land ("planert", "bögésző"). Patterns with
  `{slot}` / `{slot?}`, fillers dropped, up to two unknown words skipped. Slots resolve against the catalog, the Lapok, the visible
  windows ("ez / this" = the focused one), colours, origins, machines, levels, the auth phrase and free text (kept as spoken).
  Two close candidates give a ≤ 5-word ask-back ("Melyik: X vagy Y?"), answered by name or "az első / a második"; confidence
  < 0.6 asks "Úgy érted: …?".
- `Dashboard/page/voicecmd.js` + `voicecmd.css`: the HUD over the top strip (DOM chrome, never under a native view; the shell's
  `desktop.cover` hides the native views only while it asks, takes typed input or shows its history). It shows the live words
  while listening, then a ≤ 6-word answer with a dim detail line and a hover history (last 5).
  - It acts only through the page APIs: VRGDesk, VRGSheets (activate, showTree, sessionBoard, decorate, labelOf), VRGFrame, the
    Vezérlő pane instance, `vrg.sessions`. Maximise / shrink click the Lap window's own header buttons.
  - Closing a window and sending a prompt wait for "igen" (spoken, typed, Enter or the button, 12 s); mégse or Esc cancels.
  - "írd a vezérlőbe: …" only fills the box.
  - dev / all levels need the phrase ("VRG, fejlesztői szint. Jogosult vagyok."), and the answer says that speaker verification
    comes in a later phase.
  - "Mi van a képernyőn?" is built by `providers` from the Desktop's own state: the view, the Lap, its windows with their labels,
    the focused one, the live sessions. Phase 3 pushes a screen-reading provider there.
  - Typed fallback: Ctrl+Shift+Space. It attaches to `window.VRGVoice` (WP-54) when it appears and ignores `dictate` events.
    `window.VRGVoiceCmd = { run, parse, state, vocabulary, providers, describe, openInput }`.
- Tests:
  - `Voice/command/test/parse.test.js`: 6 tests, 71 utterances in Hungarian and English, with slips, slots, confirmations, auth, ask-back and unknown input.
  - `Dashboard/test/wp-55.test.js`: 5 tests (the registry, every act has an executor, confirm on close / send, phrases cover the commands, commands.js in step, the helpers).
  - A Chromium run with stub VRGDesk / VRGSheets / VRGFrame / vrg / VRGVoice: 19 checks (open, the confirm flow by voice, Esc and button, fill never sends, the level gate, the screen summary, max, note, resume, canvas, ask-back, voice final, dictate ignored, unknown, typed fallback, colours from the tokens), no page errors.
  - The full Dashboard suite: 326 pass, the same 68 environment failures. Not run: the real Electron frame, a real microphone.
- Wiring (the main session): `voicecmd.css` after `panes.css`, then the scripts `../../Voice/command/commands.js`,
  `../../Voice/command/parse.js`, `voicecmd.js` after `desk.js` / `sheets.js` (their order relative to WP-54's `voice.js` does not matter).

## WP-54 — Diktálás: offline push-to-talk speech to text (2026-11-25, cloud session, phase 1 of the voice line)

- Asked for: hold a key, speak Hungarian or English, see the words live in our own text boxes (the Vezérlő's first). The recording
  must start within 0.5 s and the tool must work offline, biased to our vocabulary. Never type into third-party pages or programs;
  the text goes through the Előszűrő only when sent.
- Engine: whisper.cpp's `whisper-server` (MIT) as a resident child process on 127.0.0.1, model large-v3-turbo q5_0 (small as the
  fallback). Pseudo-streaming: re-decode every 400 ms, a word is fixed once two decodes agree. The vocabulary is the `prompt`
  (≤ 600 chars). sherpa-onnx (hotwords only for transducers, no Hungarian one) and Vosk (no Hungarian) were left out. The reasons and
  sources are in `Voice/README.md`. The engine release (tag v1.8.3, `whisper-bin-x64.zip`) is pinned by sha256; the models are not
  pinned yet (Hugging Face was not reachable from the cloud).
- `Voice/`: `engine/` (host, whisper-server adapter, fake, stable prefix, WAV), `vocab/` (build.js + extra.txt), `fetch.js` +
  `voice-manifest.json`, tests 6.
- Desktop:
  - `shell/lib/voice.js` + IPC `voice.status / enable / start / chunk / stop / cancel` (wp-35 pin +6, whisper-server is an allowed
    child); settings `voice.enabled` (off), `voice.key` (F9), `voice.lang`, `voice.model`.
  - The page: `page/voice.js` (window.VRGVoice: the contract with WP-55), `voice-worklet.js` (16 kHz PCM16, 20 ms frames; the same
    resampler drives a ScriptProcessor fallback when the worklet module cannot load from file://), `voice.css`.
  - The Vezérlő's 🎤: hold to dictate, right-click to switch on / off.
  - Catalog item `voice`.
- Chromium (fake microphone, a stub of main):
  - key-down → first audio sent 13–14 ms, with 300 ms of pre-roll;
  - the live words selected and outlined in the textarea, the final in place;
  - Shift + F9 and a password field give command mode, untouched; Esc restores the field;
  - `simulate()` works the same;
  - the worklet path ran with file access, the ScriptProcessor fallback without.
- Tests: `Voice/test/voice.test.js` 6, `wp-54.test.js` 6.
- Not run: whisper-server itself (a Windows exe, and no model here), Hungarian accuracy, CPU load, the Electron probe
  `shell/selftest/wp-54.js`.
- **Local check (2026-11-26, H:):** WP-54 green under Electron 44.7.1, three runs in a row; the microphone opened, capture = `worklet`.
  - Fixed the probe: the Vezérlő draws itself again shortly after it opens (a new textarea), so `simulate()` wrote into the old,
    detached box. The probe now waits until the box has stayed the same for 600 ms. The same can drop words spoken in the first
    second after opening the Vezérlő. Open.
  - Fetched and pinned: large-v3-turbo q5_0 (sha256 3942217…ffa7e2) and small q5_1 (ae85e4a…0411bb), both equal to the LFS hash
    Hugging Face publishes; the engine v1.8.3 as pinned.
  - Bench without a microphone: anna / amy spoke 10 Hungarian and 10 English sentences with VRG words, pushed at real-time pace
    through the real host + whisper-server with the vocabulary prompt (i5-10400F, GTX 1050 Ti 4 GB):
    - turbo on the CPU build: 51 s per sentence (the encoder takes 54.6 s per 30 s window, AVX2, 8 threads). Unusable here.
    - turbo on the CUDA 12.4 build (v1.8.3, hash = GitHub's digest, unpacked to `tools\voice\bin\v1.8.3-cublas12.4`, not in the
      manifest, not used by the Asztal): encoder 1.76 s; first partial ~4.5 s, final 4–7 s after key-up, CPU ~20 %; WER hu 25 %,
      en 1.7 %.
    - small on the CUDA build: first partial ~1.5 s, final 0.5–1 s; WER hu 45 %, en 1.7 %.
    - `auto` took one Hungarian sentence as Portuguese (turbo) and one as English (small). Silence gave "Kéneze" (turbo) and ","
      (small). Numbers come out as digits. Typical misses: "plennert", "Rétegverem", "dugalj". anna's own Hungarian is imperfect,
      so a real voice may differ.
  - Proposal, not applied: the CUDA build in the manifest, turbo with the language fixed to `hu`, and a silence gate.

## WP-56 Szem + WP-57 Hang — phase 3 of the voice work: read the screen, answer aloud (2026-11-25, cloud session, two forks + the wiring)

- Asked for: phase 3 of `docs/research/2026-11-25_voice-roadmap.md`. Read what is on screen in any program (read-only, offline) and
  say the overlay's short answer aloud.
- **`Voice/screen/`** (the screen fork):
  - `uia-host.ps1` is one long-running Windows PowerShell 5.1 process that reads the foreground window's UI Automation tree. It talks
    in JSON lines, is ASCII only, has no input or write calls, never reads a password value, and answers `elevated` for an elevated
    window.
  - `screen.js` gives `describe('focused' | 'windows' | 'error' | 'read')` with a terse Hungarian `say`. Redaction (e-mail, phones,
    IBAN, 8-8-8 accounts, cards by Luhn, tokens) runs before anything leaves it. The allow / deny policy never names a denied window.
    The Asztal's own windows come back `own`.
  - `ocr.js` uses tesseract.js 7.0.0 with hun + eng as the fallback when the tree is thin. Real OCR here read every accent, at
    confidence 93 and about 0.2 s a read.
  - `fetch-ocr.js` pins tessdata_fast 4.1.0 by sha256.
- **`Voice/tts/`** (the speech fork):
  - `tts.js` drives sherpa-onnx-node 1.13.8 (Apache-2.0, prebuilt; 2.x dropped espeak-ng and breaks Piper) with the Piper voices
    anna, berta, imre and amy. A real 6-word Hungarian answer took 64–157 ms once warm.
  - The SAPI fallback is `sapi-host.ps1`.
  - The queue holds one answer at a time; the newest waiting one wins; `stop()` is the barge-in.
  - `speakable()` and `lexicon.json` make terms sayable: VRG, GO …, M16, numbers, %.
  - `fetch-tts.js` pins every file (sha512 for the npm packages, sha256 for the voices).
  - **The voice licences are UNCLEAR:** the Hungarian datasets are CC0, but every voice was fine-tuned from "lessac", which is widely
    reported as non-commercial. That is fine for answers on the Founder's own PC; anything shipped needs his decision.
- **The Desktop wiring** (this session):
  - An optional global push-to-talk key (`voice.global`, Ctrl+Alt+V): press = listen, press again or 8 s = stop. It works while
    another program is in front, and the window in front at the press is read at once (the glance, `lib/eyes.js`).
  - The answer shows in a small always-on-top window (`lib/hudwin.js`, `page/hud.html`). It takes no focus or input, and its preload
    can only receive.
  - `lib/speak.js` wraps Voice/tts: PCM goes to the page as base64 Float32, the `web` engine uses the OS voices, and `warm()` loads the
    voices at startup.
  - IPC `screen.describe/status`, `speak.say/stop/status` and `hud.show` (wp-35 pin 131 → 137); PowerShell is on the spawn list.
  - New overlay commands: melyik program ez, milyen ablakok vannak nyitva, mi a hiba, olvasd fel, csend, beszélj, ne beszélj.
  - Every answer is spoken; any new push-to-talk stops the voice. "mi van a képernyőn" is about the program in front only when it
    came from the global key.
  - Everything is off by default (`screen.enabled`, `speak.enabled`, `voice.global`). There are deny lists for password managers,
    banking and private windows.
- **Tests:**
  - `Voice/screen` 10 (1 needs the language data), `Voice/tts` 9 (1 needs the voice), `wp-56` 5, `wp-57` 2.
  - The full Dashboard suite: 339 pass, the same 68 environment failures.
  - Chromium (the real page scripts, main stubbed): the global flow, screen commands, spoken answers, barge-in and mute.
  - The answer window rendered.
- **Not run:** the PowerShell helpers (no Windows here), the addon inside Electron, the global key, a Hungarian SAPI voice, and Avast's
  reaction to the helpers' first start.
- **Local check (2026-11-26, H:):** WP-56 and WP-57 green; `Voice/screen` + `Voice/tts` + the WP-54/55 unit tests 29 pass, 2 skipped.
  - Fetched: the hun / eng tessdata and tesseract.js; the sherpa-onnx addon 1.13.8 with anna and amy (licences still UNCLEAR, own PC
    only). Fixed `screen/fetch-ocr.js --npm` (Node 24 refuses to start `npm.cmd` directly: now through `cmd.exe /d /s /c` with a
    fixed command line) and `tts/fetch-tts.js` (Windows 10's tar.exe has no bzip2: the `.bz2` layer now goes through 7-Zip when it
    is installed, after the sha256 check).
  - `uia-host.ps1`: Avast did not block its first start; it comes up in 1.9 s and stays up; then `windows` 43 ms, `focused` on the
    Claude app 1.5 s each time (UI Automation, no OCR needed).
  - `sapi-host.ps1` hung: `[Console]::In.ReadLineAsync()` blocks on .NET Framework, so no `ready` before the first request and every
    answer one line late. Fixed with a StreamReader over the raw stdin; `ready` in 0.5 s, voices in ~50 ms; Hazel spoke.
  - Windows has a Hungarian voice, **Microsoft Szabolcs**, but as a OneCore voice only: System.Speech sees Hazel and Zira (en). Open.
  - `detectLang('This is a test.')` says `hu`, so SAPI refuses a short English answer. Open.
  - The real sherpa test fails on its 300 ms limit: anna needs ~0.1 s per second of audio (387 ms for a 2.7 s sentence; 62–414 ms
    over five). Proposal: a limit relative to the audio length. Not changed. The queue / barge-in test failed once under load, then
    5 / 5 (its 5 / 40 ms timers against a 30 ms fake voice).
  - Not done (needs the Founder at the PC): Ctrl+Alt+V with Chrome / VS Code / Total Commander / Explorer, the deny lists
    (KeePassXC, OTP Bank, InPrivate), the answer window's focus, "csend", "ne beszélj"; a rule for `jobs\` windows; the permission
    handler (microphone, camera, screen capture).

## WP-58 Kéz + WP-59 Hangazonosítás — phase 4 of the voice work: act in other programs, know the voice (2026-11-25, cloud session, two forks + the wiring)

- Asked for: phase 4 of `docs/research/2026-11-25_voice-roadmap.md`. The Founder's rule decides the shape: spoken words never type into
  another program. So there is no text entry of any kind, only clicks and states.
- **`Voice/hands/`** (the actions fork):
  - `act-host.ps1` is one long-running PowerShell helper with ops `ping` / `windows` / `find` / `do` / `state`. It is ASCII only, and a
    static test proves it names no SetValue, SendKeys, SendInput, keybd_event, mouse_event, Clipboard, PostMessage, SendMessage or
    SetFocus.
  - Verbs: invoke, toggle, select, expand / collapse, scroll, focus-window, window min / max / restore / close.
  - `rules.json` sets the risks:
    - reversible: scroll, select, expand, switch, minimise / maximise, a tab;
    - confirm: click, toggle, close;
    - blocked: the Asztal itself, elevated windows, password fields, installers, UAC, Windows Security, password managers, shells,
      and about 80 names (delete, send, pay, buy, approve, sign out, install, restart, push, deploy … and the Hungarian forms).
  - Plans are bound to the window and the element (RuntimeId), expire, and run once. `do` is never retried. `stop()` kills an
    action in flight. The log holds names only.
- **`Voice/identity/`** (the speaker fork):
  - CAM++ (3D-Speaker, Apache-2.0 code, VoxCeleb CC BY 4.0, reported 0.73 % EER) on the same sherpa-onnx-node 1.13.8 as Voice/tts.
  - Enrolment takes 3 samples of ≥ 1.5 s of speech; the newest 10 are kept, with consistency checks. The default threshold is 0.5.
  - It stores embeddings only (about 4 KB a sample, never audio). `calibrate.js` suggests a threshold from real WAVs; `fetch-identity.js`
    fetches the model.
  - Real run here, on synthetic Piper voices only: the owner scored 0.77–0.89, others at most 0.41. A synthetic voice enrolled just as
    well, which is the replay / cloning caveat in practice.
- **The Desktop wiring** (this session):
  - IPC `hands.plan/act/stop/log` and `identity.status/enroll/verify/reset` (wp-35 pin 137 → 145). Main gates actions: `hands.enabled`
    (off by default) and the Dev level.
  - The kill switch: the global voice key while an action runs, plus the spoken "állj" / "stop" / "mégse".
  - The action log goes to `logs/hands.jsonl` (names only). The voiceprint is in the DPAPI-encrypted secrets store, and the model comes
    from `identity/installed.json`.
  - `lib/voice.js` keeps the last COMMAND's audio in memory only (≤ 12 s, for ≤ 30 s, handed out once; dictation is never kept).
  - The overlay plans first:
    - reversible → runs at once, under a red "acting" frame;
    - confirm → "igen"; a matched voice (`identity.enabled`) answers it at the Dev level only;
    - blocked → refused;
    - the All level needs a key (Enter / the button), never a spoken yes.
  - From the global key the window commands act on the program in front.
  - "add át Claude-nak: …" fills the Vezérlő with the task and the screen lines, fenced as data, never as instructions. Sending still
    asks and goes through the Előszűrő.
  - New phrases: kattints, nyomd meg, pipáld be, válaszd ki, görgess, válts át, mit csináltál, állj, tanuld meg / felejtsd el a
    hangomat, ki beszél.
- **Tests:**
  - `Voice/hands` 6, `Voice/identity` 8 (one needs the model), `wp-58` 4.
  - The full Dashboard suite: the same 68 environment failures. Every Voice / Prefilter / sidepanel suite: 60 pass, 3 skipped (they
    need the downloaded models).
  - Chromium (the overlay, main stubbed): reversible runs at once; confirm asks; a matched voice at Dev answers; All never accepts a
    spoken yes; blocked is refused; close from the global key asks once; the hand-off is fenced; "állj" stops.
- **Not run:** both PowerShell helpers (no Windows here), real UI Automation actions, a real voice, the speaker check inside Electron.
