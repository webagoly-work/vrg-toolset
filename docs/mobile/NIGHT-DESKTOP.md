# NIGHT-DESKTOP — VRG Mobile becomes the Desktop on the phone (unattended night run)

*Written 2026-11-12 for one unattended session of 3–4 hours. The user is asleep. Read this whole file, then
`GO-MOBILE.md` §1–2 and `CLAUDE.md`, and work without asking anything.*

## 1. What the user asked for (their words, 2026-11-12)

> Take the current state of our overall features that is basically for the desktop version and one by one, create
> and integrate every feature onto VRG Mobile - I want this new version to basically be the same as the Desktop (not
> for coding obviously, but it should seem feel and function as much as it can as the Desktop experience is - not
> just a Mobile Companion, but a simplified version of the Desktop (manual toggle to change screen orientation)
> (plugin for claude app sign in - with a Remote Control session opened on a PC, it should be even more like the full
> Desktop capable)

So the phone stops being only a companion. It becomes **a simplified VRG Desktop**: the same frame, the same
catalog at User level, the same Lapok (Sheets), the same apps, the Mélyvíz look. Dev-level items (coding, terminals,
git, agents) stay off the phone. When a PC is paired, and more so when a Claude Remote Control session runs on it,
the phone reaches further.

## 2. Rules for this night (they override GO-MOBILE's "stop after every WP")

1. **Never ask, never wait.** Every open decision takes your recommended option. Record it in
   `docs/mobile/DECISIONS.md` as `D-14`, `D-15`, … with the line `Night default (2026-11-12), the user revisits it.`
   and the alternatives you rejected, as A/B/C. Do not call AskUserQuestion. Do not stop between WPs.
2. **Commit after every finished step** on `main` (tests green first), message `Mobile: <WP> …`.
   **Never push.** A push to `main` touching `Mobile/android` releases an APK that the phone installs by itself (M9).
   Pushing is the user's call in the morning.
3. **Never touch:** the phone (no adb install, no taps), the router, other repos, `Planner/apps|home|data`,
   anything under `H:\VRG\Backup`. No new accounts, no credentials, no sign-ins. Don't start a real
   `claude remote-control` session. Test it with the stub (`VRG_CLAUDE_BIN`, see `Dashboard/shell/lib/claudeterm.js`).
4. **Time.** Run `date` when you start and at the start of every WP, and note the time in the night log
   (`docs/mobile/NIGHT-LOG.md`). Start no new WP after **3 h 15 min** from the start. At the end, or when anything
   stops you, write the morning report (§6) and commit it. If the usage limit is near, write the report first.
5. **One WP at a time, smallest working slice first.** A WP that would not finish gets cut down to a slice that works
   and is committed. The rest goes into its WP file under "Later". A half-built feature behind a PLANNED tile is
   better than a broken build.
6. Everything built tonight is **BETA**. The user checks each "Telefonon ellenőrizni" list later.
7. The house rules hold: the phone UI is in Hungarian, code and docs in English, and colours only from `Melyviz`.
   A feature is a module, shared things go to the kit, the PC side stays one relay, and every relay ability is paired-only.

## 3. Preflight (≤ 10 min)

```
git rev-parse --show-toplevel        # H:/VRG/Full/Planner_VRG_U100
git status                           # clean except docs/mobile/NIGHT-DESKTOP.md (commit it first: "Mobile: night brief")
cmd /c "Mobile\mobile.cmd test < nul"
node Mobile/tests/relay-pair.js
```
If the core tests are red before you start, fix nothing else. Log it and write the report.
`mobile.cmd` pauses at the end, so always run it with `< nul`.

## 4. The work, in this order

### N1 — Parity map (≤ 30 min, no code)

Write `docs/mobile/PARITY.md`, one table with **every User-level unit of the Desktop catalog** (34 today:
`node -e` over `launcher/vrg-catalog.json`, level `user`). Add the Desktop's window kinds (`KINDS` in
`Dashboard/shell/lib/sheets.js`: home, files, web, mail, stack, chat, note, feed, app …) and the frame parts
(top strip, dock, ◣ menu dial, ◢ Rétegverem dial, Kommand palette, Lapok, notifications, settings). Each row gets:

- the Desktop source (file);
- the Mobile feature that already covers it, if any (M0–M18: `Mobile/android/kit-core/.../Feature.kt`);
- **how it reaches the phone:** `native` (Compose), `webapp` (the same HTML app in a confined WebView), `pc` (through
  the paired relay), `rc` (only with a Claude Remote Control session), or `no` (dev-only or meaningless on a phone, with the reason);
- the WP that builds it.

Docs to read for it: `docs/desktop/CLASSIFICATION.md`, `docs/desktop/GLOSSARY.md`, `docs/desktop/DECISIONS.md`.
Add the new WPs (M19…) to the roadmap table in `docs/mobile/README.md`, the `Catalogue` in `Feature.kt` (PLANNED)
and one file each in `docs/mobile/WP/`. Commit.

### N2 — M19 Asztal: the Desktop frame on the phone, plus the orientation toggle

- The phone's home becomes the **Asztal** frame. A top strip carries the sheet tabs and a Kommand search field, a
  dock holds the open windows, and the two corner dials are the menu (the catalog, grouped as on the Desktop) and the
  Rétegverem (M17). The current tile home stays reachable as **Kompakt** (setting `Kezdőlap: Asztal / Kompakt`).
- **Kommand:** one search over the catalog, the features and the open windows. It shares the scoring of the Desktop's
  palette (`Dashboard/shell/lib/palette.js`). Port it to `kit-core` with the same results on the same inputs, and write a
  JVM test that runs both on a fixture.
- **Orientation toggle (the user asked for it by name):** a button in the top strip that cycles
  `Automatikus → Álló → Fekvő`, stored in `ShellSettings`, applied with `setRequestedOrientation`, also in Settings
  (M1). JVM test for the setting, and the layout must work in both orientations (Compose previews or Robolectric if present).

### N3 — M20 Lapok on the phone

- **Port the pure model** `Dashboard/shell/lib/sheets.js` to Kotlin in `kit-core`. Use the same JSON (`{v:1, active,
  bar, sheets:[{id,name,wins,focus}], mine}`) and the same `validate`. Mirror the same operations: open = full,
  minimise = 1 cell, `resizeTarget` snapping and stopping at neighbours, move / swap with a window of the same size,
  presets. Mirror `Dashboard/test/wp-46.test.js` as JVM tests on the same cases.
- **Grid on the phone:** 2 columns × 4 rows upright, 4 × 2 lying down. Keep the model's 4×4 and map it, or make N a
  parameter. Choose one, test it, record the choice as a D-number.
- **Gestures:** double-tap the header tab = full ⇄ one cell; long-press an edge or corner, then drag = snap resize;
  long-press the header, then drag = move; long-press a free cell = the picker (the Kommand list). Presets from
  `Dashboard/config/sheets.json`, User level only.
- Windows are the M-features themselves (each `VrgFeature` gets a compact face for 1×1 and its full screen when
  full) and, after N4, the web apps.

### N4 — M21 Alkalmazások: the Desktop's HTML apps on the phone

- The User-level in-shell apps (the catalog items that open as `app`, e.g. planner, calc-panel, calc-general,
  calc-led, inventory, workflow-kit, mindmap, buildtree, client-preview, valena, map: check the catalog) open in a
  confined WebView. Do it the way M18 Archívum does: fetch from GitHub `main`, download only the changed files, and
  keep them offline after the first fetch.
- **Origin:** `localStorage` must work. A file:// page has a null origin and saving fails silently. Serve the files
  from one https origin per app with `WebViewAssetLoader` (or an equivalent intercept). Allow only that app's
  folder plus `shared/`, the same rules as `Dashboard/shell/lib/appscheme.js` (no dot-files, no secret names, no
  links leading out). Port its decision function and its tests.
- For each app, note in its WP file whether it is usable at 375 px and what breaks. Fixing the apps is a later WP.
- Node check like `Mobile/tests/archive-phone.js`: each app loads headless at 375 px without console errors.

### N5 — M22 Claude: the Claude app plugin and the PC's Remote Control sessions

- **No sign-in inside VRG Mobile, ever.** The user signs in to Claude in the official Claude app. VRG Mobile only
  opens it: an intent to the installed Claude app (find the package; if it is missing, open `https://claude.ai` in the
  browser), and a "Claude" window that shows the sign-in state it *can* know (only whether the app is installed).
- **With a paired PC:** a new relay message type (paired-only, behind a relay flag `--claude`) lists the Remote
  Control sessions the PC's VRG Desktop started. It can also ask the PC to start one in a chosen folder: the
  Desktop's `claudeterm` profile with `claude remote-control --name <name>`. The relay passes back the session link
  the CLI prints, and the phone opens it in the Claude app. With an RC session running, the Desktop is "fully"
  reachable from the phone: that is the user's "even more like the full Desktop".
- Run `claude remote-control --help` for the flags. **Test only with the stub binary** (`VRG_CLAUDE_BIN`, a .js
  that prints a fake session URL) and a Node test in `Mobile/tests/relay-claude.js`. Never start the real one.

### N6 — M23 PC windows (only if time is left)

With a paired PC, the Desktop's **files** window (browse the PC's work folders read-only, take a copy through M12
Átadás) and **mail** / **feed** if their Desktop panes have a data source the relay can reach. Look at
`Dashboard/page/panes/*.js` and decide per pane. Terminal, git and chat are dev-level: not on the phone.

## 5. Build check at the end of each WP

```
cmd /c "Mobile\mobile.cmd test < nul"
cmd /c "Mobile\mobile.cmd build < nul"     # must compile; the APK is not installed tonight
node Mobile/tests/relay-pair.js            # + the WP's own Node test
node tools/check-start.js                  # if anything in launcher/ changed
node tools/check-catalog.js
```

## 6. Morning report (always, last commit of the night)

`docs/mobile/NIGHT-REPORT-2026-11-12.md`, short, in English, with these parts:
- **What was built:** each WP with its state, its commits and its tests.
- **Night defaults to revisit:** each D-number, one line each, with the alternative.
- **What I could not verify here:** each item with the reason.
- **Your phone checks:** the new "Telefonon ellenőrizni" lists, in the order to do them.
- **To ship:** the exact commands. The user installs the APK with `Mobile\mobile.cmd install` (debug) or pushes main for a release.
- **Next:** what is left of §4.

Also add one line to `GO-MOBILE.md` §2 saying the night run happened and where its report is.
