# P12 · Overlay OS

Stub (KV-02, 2026-10-26). Plan: `docs/city/README.md` §8; source: the report `docs/research/reports/Kódváros live workspace and GitWorld.md` §6.1.

- **Goal:** Lively wallpaper → Electron shell (transparent overlay, hotkey, click-through, tray, autostart) → window textures + portal hand-off → flyouts.
- **Done-check:** After 22H2: the hotkey summons the city in < 150 ms; idle ~0 %; clicking a building hands off to the real window, Esc returns.
- **Files:** CodeCity/shell/ (new)
- **Decisions:** D19, D20
- **Prompts:** see PROMPTS-WORKSPACE.md
- **Status:** open — L0 wallpaper built (KV-24, 2026-10-27); KV-25/26 need 22H2 first (CITY-D19 A) — the user's steps:
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
