# P12 · Overlay OS

Stub (KV-02, 2026-10-26). Plan: `docs/city/README.md` §8; source: the report `docs/research/reports/Kódváros live workspace and GitWorld.md` §6.1.

- **Goal:** Lively wallpaper → Electron shell (transparent overlay, hotkey, click-through, tray, autostart) → window textures + portal hand-off → flyouts.
- **Done-check:** After 22H2: the hotkey summons the city in < 150 ms; idle ~0 %; clicking a building hands off to the real window, Esc returns.
- **Files:** CodeCity/shell/ (new)
- **Decisions:** D19, D20
- **Prompts:** see PROMPTS-WORKSPACE.md
- **Status:** open — L0 wallpaper built (KV-24), L2 overlay spike built (KV-25, 2026-10-27, on 22H2); KV-26 next — 22H2 steps:
  [p12-22h2.md](p12-22h2.md) (Windows Update is switched off on this PC since 2022; the steps switch it on, pinned to 22H2)

## KV-24: the wallpaper (L0)

- `#mode=wallpaper` (`src/00-wallpaper.js`): every requestAnimationFrame of the page is held to `fps` (1–5, default 2) —
  wrapped before any module runs; flights are instant; no bars, panels or HUD (city.css); `view=land` (default) shows the
  whole Land, `view=city` the city. Hidden (a fullscreen app, Lively paused, a locked screen) = the stream is closed.
- The segéd treats `/api/stream?wallpaper=1` as a light listener: file pulses, git and Claude's figures, but no port street,
  samplers, probe, ETW or cargo; `claude agents` every 30 s instead of 6 s while only wallpapers listen. A full page undoes
  it at once (spec-wallpaper.js).
- Found while measuring: the live glow faded per frame (×0.97), so at 2 fps a pulse lasted ~64 s and a busy repo kept the
  page drawing forever; it now fades by time (~2 s at any frame rate).
- **Measured idle** (headless Chrome on the served wallpaper, the real segéd, 60 s, other Claude sessions busy in the repo):
  Chrome 0.2 % of one core; the segéd 1.9 %; `claude agents` 0.35 s CPU per call = 1.2 % at one call per 30 s —
  ≈ 3.3 % of one core ≈ **0.3 % of this 12-core PC**. A real GPU draws a changed frame far cheaper than SwiftShader.

## Your steps: Lively (you install and configure it; Claude does not)

1. Install **Lively Wallpaper** (free, GPL-3.0): Microsoft Store → "Lively Wallpaper", or
   https://github.com/rocksdanister/lively/releases. It is your program; Kódváros only gives it a URL.
2. Start live mode: START.cmd → K → S (the segéd on http://localhost:8797). The wallpaper needs it running; without it
   Lively shows an empty page — start live mode, then in Lively right-click the wallpaper → Reload.
3. Lively → **+ Add Wallpaper** → in the URL box paste `http://localhost:8797/#mode=wallpaper&fps=2` → the arrow → it
   appears in the library → click it → choose the monitor.
4. Lively → Settings → **Performance**: when another application is *fullscreen* (and *focused*, if offered) → **Pause**;
   on battery → Pause. Settings → **Wallpaper → Input: Off**, so the desktop icons stay clickable.
5. Options in the URL: `fps=1` … `fps=5` (2 is the default), `&view=city` for the city instead of the Land.
6. Check: the desktop shows the Land behind the icons; edit a file in the repo → its building glows for ~2 s;
   Task Manager shows Lively's web process and the node of the segéd near 0 % while nothing changes.

## KV-25: the Electron overlay spike (L2)

- **Runtime:** Electron **44.7.1** (Chrome 152; released 2026-10-13), pinned in `vendor-manifest.json` with the npm
  tarball's sha512. `CodeCity/tools/fetch-electron.js` checks that, takes the sha256 of
  `electron-v44.7.1-win32-x64.zip` from the tarball's `checksums.json`, downloads the zip from the GitHub release, checks it
  and unpacks it to `Planner/apps/electron` (git-ignored, 151 MB). No `npm install`, no postinstall scripts.
- **Black-transparency bug (electron#40515) on this GPU — tested first:** `CodeCity/shell/transparency-test.js` puts a
  magenta window under a transparent one and reads the screen. GTX 1050 Ti, driver 32.0.15.6636, hardware acceleration
  **on**: the empty half reads exactly 255,0,255, the 50 % veil 255,128,255 — **no black**. Same with `--disable-gpu`.
  With the real WebGL page (the selftest, below) 0.1 % of the screen is black (dark building faces), not the bug.
- **The shell** (`CodeCity/shell/main.js`, ~150 lines): one transparent, frameless, always-on-top (`screen-saver` level)
  window per monitor, each on `http://127.0.0.1:8797/#mode=overlay`; **Ctrl+Alt+K** summons/hides (taken → a tray
  balloon and the fallback Ctrl+Alt+Shift+K; `globalShortcut.register` only returns false); **Esc** hides (registered
  only while summoned); click-through with forward: the page (00-wallpaper.js) reports where it is solid — a panel, the
  bar, a building, a plate, or a drag that started there — and only there the window takes the mouse; tray: show/hide,
  click-through on/off, reload, quit; one instance (starting it again summons it); monitors added/removed rebuild the
  windows. Sandboxed, context-isolated, no Node in the page; the preload sends two messages and receives none;
  navigation off the segéd's origin and new windows are refused.
- **The page in `#mode=overlay`:** the full page (bar, panels, palette) with no CSS sky, no vignette and no planet sea
  sphere — the desktop is the sea; the stream closes while hidden, as for the wallpaper.
- **START.cmd:** K → **F) Fedoreteg** starts the segéd without a browser if needed, fetches Electron on first use, then
  the shell.

**Check, measured 2026-10-27** — `electron CodeCity/shell --selftest` on the real desktop (3 monitors, GTX 1050 Ti,
a throwaway segéd):

| | |
|---|---|
| Summon (call → second painted frame), warm, ×6 incl. one real Ctrl+Alt+K key press | 23–88 ms (**< 150 ms** ✔); the very first, cold one ~130 ms |
| Screen with the overlay up (magenta behind it) | 35 % clear sky, 24 % behind a plate or fog veil, 0.1 % black |
| Click-through | empty sky falls through ✔, a building and the bar catch ✔ |
| Hidden | every page `hidden`, stream closed; **all shell processes 0.06 % of one core** over 30 s (**~0 %** ✔) |
| Memory | ~640 MB for three monitors (three renderers) |

**Known limits, for KV-26 and later:** Esc is global while the overlay is up (it also closes the overlay when a panel
had focus); every monitor runs the full page (three stream listeners while summoned); secondary monitors show the same
view as the first; the HUD strip (L1) is not built.

## Your steps: the overlay

1. START.cmd → **K** → **F**. The first time it downloads Electron (~150 MB, checked). A cyan hexagon appears in the tray.
2. **Ctrl+Alt+K** shows the city over every monitor; click a building or use the bar as in the browser; empty sky
   clicks through to the desktop; **Ctrl+Alt+K** again or **Esc** hides it.
3. Tray icon → right-click: show/hide, *Átkattintás az üres égen* (turn off to make the whole overlay catch the
   mouse), reload, quit. A balloon at start means Ctrl+Alt+K was taken; then it uses Ctrl+Alt+Shift+K.

