# 04 — The overlay "OS" layer on Windows 10 Pro

Research notes, 2026-10-26. Scope: how VRG Kódváros (three.js city of the repo, growing into GitWorld)
can become a live 3D controller that sits over or behind the normal Windows desktop. Methods,
repos, licences, trade-offs. No code written.

Confidence tags: **[V]** checked against a primary source this session (repo page, official docs);
**[S]** secondary sources only (aggregators, forums, press); **[K]** background knowledge, not
re-checked this session, treat as a lead to verify.

---

## 0. Bottom line

1. **Shell: Electron (MIT).** It is the only host that does every overlay trick in documented JavaScript
   APIs: transparent, always-on-top, click-through *with mouse-move forwarding*, global
   shortcuts, window capture into a `<video>` (so into a three.js `VideoTexture`), one window per monitor,
   auto-start. Tauri (MIT/Apache-2.0) is lighter but needs Rust for the hard parts (its click-through has
   no `forward` option; you'd poll the cursor yourself). For someone who vibecodes and doesn't
   write code, Electron's "all JS, documented, widely copied" wins over Tauri's smaller footprint.
2. **Don't replace the Windows shell. Put layers on top of it.** Every robust modern project
   (Seelen UI, Zebar, YASB, Rainmeter, Lively) runs *on top of* explorer.exe. Replacing or patching
   explorer itself (Cairo as shell, ExplorerPatcher) breaks on Windows updates and gets flagged by Defender.
3. **Three layers, one app.**
   - **Wallpaper layer**: the city lives behind the desktop icons (WorkerW trick or Lively), at low
     frame rate, mostly for ambience.
   - **HUD strip**: a thin always-on-top click-through bar/corner, for indicators.
   - **Summoned controller**: a full-screen transparent overlay on a global hotkey, where you actually
     drive things.
   All three can be windows of the same Electron app that load the same Kódváros pages.
4. **Real app windows "on a building"**: show them as **live textures (Windows.Graphics.Capture via
   Electron `desktopCapturer`)** and, on zoom-in, **hand off to the real window** (move/resize the real
   Zen window to exactly where the texture ended up, then hide the overlay). Don't reparent foreign
   windows (SetParent) into the overlay. Zen (Firefox) can't be embedded as a library. It can only
   be captured, positioned, and remote-controlled (WebDriver BiDi).
5. **Windows 10 caveat for this machine:** the PC reports **10.0.19044 = Windows 10 21H2**. Microsoft's
   promise to keep Edge **and the WebView2 Runtime** updated until at least Oct 2028 is for **22H2 (19045)**.
   Moving to 22H2 (a small enablement package from 21H2) should come before building on WebView2 (Tauri,
   Seelen UI, Zebar, Rainmeter WebView2 plugins). Electron bundles its own Chromium and doesn't depend on it.
   **[S]** for the Edge/WebView2 date. **[K]** for the 21H2→22H2 enablement path.
6. **The 3D-desktop graveyard teaches one lesson:** keep apps as flat, readable 2D panes. Use 3D
   for *orientation, overview and status* (where is my stuff, what is alive, what is busy), not as
   the place where you read and type. That is exactly what visionOS does today, and it's the opposite of
   what Looking Glass and BumpTop tried.

---

## 1. Platform facts that constrain everything

| Fact | Consequence | Tag |
|---|---|---|
| Machine is Win10 **21H2** (19044). Edge + WebView2 Runtime updates promised "until at least Oct 2028" on **Win10 22H2**, no ESU needed | Get to 22H2 first. Electron is self-contained (bundles Chromium) | [S] |
| Electron dropped Win7/8 at v23. Win10 is still supported. No announced Win10 drop | Electron is safe for now. Watch Chromium's Win10 deprecation | [S] |
| WGC border removal (`GraphicsCaptureSession.IsBorderRequired`) needs build **20348+** (Server 2022 / Win11). Win10 client builds are ≤19045 | **On Windows 10, captured windows always get the yellow capture border.** The border can't be removed on Win10. This is a real cosmetic cost for "windows on buildings" | [V] MS Learn + [S] Codex issue on 19045 |
| WGC itself: basic on Win10 1803, full on 2004+ (per Desktop+ README). The Electron/Chromium path uses it | Available on 21H2/22H2 | [V] Desktop+ README |
| Win11 24H2 restructured the desktop window tree (Lively had to rewrite its core; Microsoft put an upgrade hold on wallpaper apps) | Any DIY WorkerW code must be re-tested if the PC ever moves to Win11 | [S] |
| Tauri `setEffects` Acrylic/Blur: Win10 1903+, *no effect on Win11* | Minor | [V] Tauri docs |
| `setVisibleOnAllWorkspaces` is a no-op on Windows (both Electron and Tauri) | Virtual desktops need their own handling | [V] |

---

## 2. Host shells: what can draw a transparent 3D overlay

| Host | Licence | Transparent window | Click-through | Hotkeys | Window capture → WebGL | Fit for this user |
|---|---|---|---|---|---|---|
| **Electron** | MIT [K] | Yes | `setIgnoreMouseEvents(true, {forward:true})`: clicks fall through while mouse-move still reaches the page, so hover over a building can switch interaction back on [V] | `globalShortcut.register` returns false if another app owns the combo (silent) [V] | `desktopCapturer.getSources({types:['window']})` → `getUserMedia`/`getDisplayMedia` → `<video>` → `THREE.VideoTexture` [V] for the API | **Best.** All JS, most examples online. Cost: ~100+ MB install, a Chromium per app |
| **Tauri v2** | MIT/Apache-2.0 [K] | Yes (WebView2). `noRedirectionBitmap` against white flash [V] | `setIgnoreCursorEvents(bool)`, **no forward option** [V]. Known: it rewrites ex-styles and drops `WS_EX_TOOLWINDOW` so the window shows in Alt+Tab [S]. Child-webview click-through bug on Win10 [S] | `@tauri-apps/plugin-global-shortcut`, permissions off by default [V] | No built-in. Needs a Rust crate (e.g. windows-capture) [K] | Good but Rust-heavy for the overlay bits. Small installers. Depends on WebView2 (→ 22H2) |
| **WebView2 in a small C# app (WPF/WinForms)** | MS WebView2 SDK (free redistributable) | `DefaultBackgroundColor` transparent. WPF needs `WebView2CompositionControl` to avoid HWND "airspace" [S] | Win32 `WS_EX_TRANSPARENT` + layered window, by hand [K] | `RegisterHotKey` [K] | WGC directly in C# (best-documented API) [V] | Most native power, but it's a C# codebase to maintain. Good as a **helper process** later, not the main shell |
| **Wails** (Go) | MIT [V] | v3 docs: README now lists v3.0.0 stable. Search results showed it still in beta in Aug 2026, so check [S] | Not found | Yes [K] | No | Go + WebView2. No overlay advantage over Tauri |
| **Neutralino** | MIT [K] | `modes.window.transparent` now works on Windows but forces borderless [V] | No click-through API found | Not built-in [K] | No | Too thin for an overlay |

**GPU cost of a full-screen transparent WebGL overlay** (synthesis, [S]/[K]):
- A per-pixel-alpha window covering the screen makes DWM blend the whole surface every frame it
  changes. Over a fullscreen game this can knock the game out of "independent flip" into composed mode
  (more latency). Microsoft says DWM may keep independent flip via multiplane overlays (MPO) depending on
  hardware. Check with PresentMon. ([V] DXGI flip-model blog)
- Known Electron bug: transparent windows render **black on some Windows GPUs with hardware
  acceleration**. Disabling acceleration fixes it but kills WebGL (electron/electron#40515) [S]. Test on
  this PC early.
- The real cost is *your render loop*, not the window. three.js in "render on demand" mode (only when
  something changed), a 30 fps cap, and `hide()` (not just transparency) when dismissed cost almost
  nothing at idle. A 60 fps full-scene redraw at 4K behind every keystroke won't stay light.

---

## 3. Behind the icons: the city as live wallpaper

| Option | Licence | Interaction | Notes |
|---|---|---|---|
| **Lively Wallpaper** (rocksdanister/lively) | **GPL-3.0** now (older README said Ms-PL) [V] | Mouse forwarded by default. Keyboard opt-in (Settings → Wallpaper input) [V] | Web wallpapers get `livelyPropertyListener`, audio data, system info, current track. Pauses on fullscreen apps, battery, remote desktop. Win10 1903+ [V]. **Zero-code route:** point Lively at `http://localhost:<port>/kodvaros` |
| **Wallpaper Engine** | Commercial (Steam) | Web wallpapers: mouse yes. Keyboard "experimental", none for Workshop items [S] | `wallpaperPropertyListener`, audio listener [V]. CEF-based [K]. Fine as a viewer, closed |
| **DIY WorkerW** | — | Clicks hit the icon layer, so input must be forwarded with hooks | Send `0x052C` to Progman, find the WorkerW without `SHELLDLL_DefView`, then `SetParent` your window into it [S]. Win11 24H2 changed the tree [S]. **meslzy/electron-as-wallpaper (MIT)** wraps this for Electron with `forwardMouseInput`/`forwardKeyboardInput`. Only Win11 marked tested, 3 commits, needs native build [V] |

**Interaction limits** (why the wallpaper can't be the controller): the wallpaper only gets input when
the desktop itself is visible and focused. Any app window covers it. Keyboard input is fragile everywhere.
Lively's own docs warn that app wallpapers can install their own input hooks [V]. **Use the wallpaper
layer for ambience and glanceable status. Do the real control in the summoned overlay.**

---

## 4. Widget, HUD and shell projects: what each one teaches

| Project | Licence | Tech | Lesson for Kódváros |
|---|---|---|---|
| **Seelen UI** (eythaann/Seelen-UI, ~18k★) | **AGPL-3.0** [V], learn only | Tauri + Rust. Widgets in Svelte/TS with IPC to system state [V]. Each component reportedly its own WebView [S] | **The closest precedent: a full web-tech desktop environment on Win10/11.** It replaces the *visible* shell parts (toolbar instead of taskbar, dock, Start replacement, flyouts for volume and brightness, Alt+Tab, tiling WM, virtual desktops, per-workspace wallpaper, widgets on the wallpaper layer) but **does not replace explorer.exe** [V/S]. Ships via MS Store/winget, bundles the WebView2 runtime for Win10 [V]. Study how it hides the native taskbar, its flyouts (the "replace Windows menus" wish), and its media module |
| **Zebar** (glzr-io/zebar) | **GPL-3.0** [V], learn only | Rust + WebView. Widgets are plain HTML/JS packs (`zpack.json`) with providers: audio, battery, cpu, disk, host, ip, keyboard, media, memory, network, systray, weather, glazewm, komorebi [V] | **Proof that a web page can be a Windows status bar.** Its provider list is a ready checklist of the system data Kódváros needs. Audio provider can `setVolume` per device. Media provider can play/pause/skip per session [V]. Zebar can host Kódváros-styled widgets *today* with no shell of our own |
| **YASB Reborn** (amnweb/yasb) | **MIT** [S] | Python/Qt status bar | Permissive. Read its Windows API code (media, volume, workspaces) freely |
| **GlazeWM** | GPL-3.0 [S] | Tiling WM | Shows that window management works without touching explorer |
| **Rainmeter** | GPL-2.0 [S] | C++ skins, plugins | The 20-year veteran desktop-widget layer. WebView2 plugins (khanhas/PluginWebView, RicardoTM05/WebView2, NSTechBytes/WebView2) put HTML on a skin. Need Rainmeter 4.5+ and Win10 1803+. Plugin licences not checked [S]. A cheap way to drop small Kódváros panels on the desktop |
| **Xbox Game Bar widgets** | MS SDK | UWP. Widgets can be **pinned** (stay over games after Win+G closes), opacity and **click-through** per widget [S] | Works on Win10. Good for a tiny HUD while gaming. Too boxed-in for the 3D city |
| **PowerToys** | MIT [K] | Always On Top, FancyZones, Command Palette (preview; extension gallery in 0.100, Jun 2026) [S] | A Command Palette extension is a possible "type to command the city" entry point later. Win10 still gets PowerToys releases [S] |
| **Windhawk** | GPL-3.0 [S] | Injects single-file C++ mods into Explorer and other processes | Deep tweaks of the real taskbar and Start. Powerful but injection-based. Learn, don't depend |
| **Cairo Desktop** | Apache-2.0 [S] | .NET full shell, can *replace* explorer as the shell | Permissive and readable. Shows the cost of a true replacement (tray, notifications, UWP integration). Activity is disputed |
| **ExplorerPatcher** | GPL-2.0 [S] | Patches explorer | Defender flagged it (HackTool), MS blocked the 24H2 upgrade, features broke on updates [S]. **The cautionary tale** |
| **WinXShell** | Closed freeware [K] | Shell for WinPE | Not relevant beyond curiosity |

**What these show about "replacing the shell":** the stable pattern is *suppress or hide* the stock
taskbar and Start, and draw your own on top. Leave explorer running for the tray, notifications,
file dialogs, and Settings. A Kódváros "menu" that replaces Windows menus should launch and control things
(Start-menu-like launcher, volume and brightness flyouts, window switcher) through a helper, not
by hooking explorer.

---

## 5. Real app windows on a building

### 5.1 The four techniques

| Technique | What you get | Limits |
|---|---|---|
| **SetParent / SetWindowPos reparenting** a foreign window into the overlay | A real, interactive window "inside" your app | Raymond Chen: cross-process parent/child is *legal but near-impossible to manage*. Turning a top-level window into a child "will definitely stop working" [S]. Win11 reports of DWM still drawing it separately [S]. **Avoid.** SetWindowPos *alone* (move/resize the real window, keep it top-level) is fine and is the basis of the hand-off below |
| **DWM thumbnails** (`DwmRegisterThumbnail`) | Zero-copy *live* miniature of any top-level window, composed by DWM, with opacity [V] | Destination must be a top-level window **owned by your process**. Drawn **2D, on top of** your window. No perspective, no depth, can't sit "inside" WebGL. MS: "thumbnails do not enable … Flip3D" [V]. Usable for a flat "window wall" layer above the canvas, cheaply |
| **Windows.Graphics.Capture → texture** | Frames of any window or monitor as a GPU texture. In Electron: `desktopCapturer` → `<video>` → `VideoTexture` on a building facade, with perspective, glow, Tron shaders | **Yellow border on Win10, can't remove** [V]. **Minimized windows produce no frames** (occluded ones still do) [S]. Cost: a video decode/copy per window, so cap at a few live windows. Others get a thumbnail snapshot (`thumbnailSize`) [V] |
| **Browser inside the overlay** (iframe / `<webview>` / `WebContentsView`, placed with three.js `CSS3DRenderer`) | Real interactive web pages in 3D perspective, no capture | Not Zen (no Zen profile or extensions). Many sites refuse iframes (X-Frame-Options) [K]. `<webview>` gets around that but Electron "recommend[s] to not use" it [V]. CSS3D has **no depth test against WebGL**. Occlusion needs a "hole-punch" plane trick, and clicks can break [S] |

### 5.2 Recommended pattern: texture while far, real window while near ("portal hand-off")
*(design synthesis, not a found library)*
1. Far away: the building shows a WGC live texture (or a periodic thumbnail if many).
2. User clicks "enter": the camera flies in until the facade fills a known screen rectangle.
3. At the end of the animation: `SetWindowPos` the **real** Zen window to that exact rectangle,
   bring it to the foreground, then hide or click-through the overlay. The user is now in the real app.
4. Hotkey back out: snapshot the window, show the overlay, animate the camera back, and optionally
   move Zen out of the way. Don't minimize it, because a minimized window stops producing frames. Park it
   behind instead.

This avoids input forwarding entirely, which is the hardest and least reliable part.

### 5.3 Zen browser specifically
- Firefox-based. There's no desktop Gecko embedding API (GeckoView is Android-only; XULRunner is long dead) [S]/[K].
- What *is* possible: capture its window (WGC), position it (SetWindowPos), and **remote-control
  it via WebDriver BiDi** (`--remote-debugging-port 9222`). zen-mcp shows tab and page control on Zen.
  Some BiDi gaps exist: no file upload or drag-drop, and sessions get stuck until restart [S]. Through BiDi
  the city could list tabs (one tab = one lit window on the building), open URLs, and take page screenshots.
  Use a **separate Zen profile** for automation [K].

### 5.4 How the established tools do it
- **OBS**: window capture via BitBlt (old, black for hardware-accelerated Chromium windows) or **WGC on Win10 1903+**
  (works with Chrome, shows the yellow border) [S].
- **Desktop+** (elvissteinjr/DesktopPlus, **GPL-3.0**, learn only): desktop via **DXGI Desktop Duplication**,
  windows via **WGC** (Win10 1803 basic, 2004+ full). Interaction through simulated input and window focus
  changes, plus an elevated mode for UIPI/UAC windows. Browser overlays are a separate **CEF** component [V].
  The best open-source reference for "windows as textures in 3D + clicking them".
- **XSOverlay, OVR Toolkit, Virtual Desktop**: commercial and closed. Same family of techniques
  (duplication + WGC + SendInput) [K].
- **Stardock Fences**: commercial. Lives *in* the desktop layer and manages icon regions, not app windows [K].

---

## 6. Summoning, hotkeys, focus, monitors, DPI

- **Hotkey**: register in the main process after `ready`. If another app holds the combo, registration
  fails **silently** (`register` returns false), so show a warning in the UI [V]. **Ctrl+Space is a poor pick on
  Windows** (IME/language toggle on many setups; PowerToys uses Alt+Space) [K]. Something like Ctrl+Alt+Space,
  Win+Alt+K, or a mouse button / Stream Deck key is safer.
- **Focus stealing**: Windows only allows `SetForegroundWindow` when the caller received the last input event
  (plus other conditions) [V]. A hotkey press in practice counts as that input (Chromium relies on it, with
  a fallback timer) [S]. **Summon the overlay only from a hotkey or a click, never on a timer.** For the
  always-on HUD use `showInactive()` and `setFocusable(false)` so it never takes focus [V].
- **Z-order levels (Electron)**: `floating`…`status` sit **below** the taskbar. `pop-up-menu` and up sit **above** it [V].
- **Alt+Tab / taskbar hygiene**: `skipTaskbar`. Watch for the Tauri style-reset bug [S].
- **UIPI**: click-through forwarding pauses when an elevated window has focus. The fix needs admin or UIAccess [V].
  Don't run the overlay elevated by default.
- **Multi-monitor and DPI**: one overlay window **per display** (Electron `screen.getAllDisplays()`, react to
  `display-added`/`removed`/`metrics-changed`) rather than one window spanning monitors with different
  scale factors [K]. Wails had mixed-DPI drag bugs only recently fixed [S]. That kind of edge stays sharp in every host.
- **Screen sharing**: `setContentProtection(true)` hides the overlay from capture (WDA_EXCLUDEFROMCAPTURE) [V].
  Useful for screen-share privacy.

---

## 7. Offline, auto-start, staying light

- **Offline**: vendor three.js and all assets locally (already the repo norm). Load Kódváros from the
  existing local Node server or an Electron custom protocol (`protocol.handle`), so pages have a real
  origin. CLAUDE.md already notes that `file://` and `data:` break localStorage. Everything except the
  "abroad" (internet) layer must render with the network cable out. Treat network-backed parts as optional.
- **Auto-start**: Electron `app.setLoginItemSettings({openAtLogin:true})`, Tauri `plugin-autostart`, or a Task
  Scheduler logon task with a 30–60 s delay (gentler at boot) [K]. Register it in **START.cmd** as well (repo rule).
- **Staying light**:
  - Render on demand. Cap the frame rate (30 fps summoned, 1–5 fps or event-driven as wallpaper/HUD).
  - When dismissed, `hide()` the window instead of keeping a transparent full-screen surface alive.
  - Keep Electron `backgroundThrottling` on. But note an always-visible transparent window is never "hidden"
    to the Page Visibility API, so throttle yourself [V].
  - Pause on fullscreen apps and games. Poll `SHQueryUserNotificationState` about once a second (no
    notifications exist) and add a foreground-window geometry check like Chromium does, for borderless games [V/S].
    Lively already has these rules built in.
  - Pause on battery and remote desktop (Lively does this) [V].
  - Limit live WGC textures to 1–3 and refresh the rest as thumbnails every few seconds.

---

## 8. Data feeds for the later wishes (pointers only)

| Wish | Windows source | Ready-made reference |
|---|---|---|
| Spotify as a stadium | Windows media sessions (`Windows.Media.Control`, SMTC; ~Win10 1809) [S]. Whether Spotify registers needs a live test. Or the Spotify Web API (online only) | Zebar `media` provider [V] |
| Task Manager indicators | CPU, RAM, disk, network, processes | Zebar providers [V]. `systeminformation` npm (MIT, [K]) |
| Sound sources + equalizer | Per-app volume via Core Audio sessions. System EQ via Equalizer APO (GPL [K], drive it through its config file) | EarTrumpet (licence not confirmed [S]), Zebar `audio.setVolume` per device [V] |
| USB / Bluetooth objects | PnP device arrival (WMI / `DeviceWatcher`) | [K]. Its own research note |
| Open programs as temporary constructs | Window list + process list (EnumWindows), WGC thumbnails | Seelen UI Alt+Tab with previews [V] (learn only) |

---

## 9. Precedents: "the OS as a 3D world"

| Precedent | What it was | Outcome and lesson |
|---|---|---|
| **SGI fsn** (1992, in *Jurassic Park*) / **fsv** (clone, LGPL-2.1) | File tree as a 3D landscape of pedestals | SGI itself called fsn "a prototype and an experiment … neither a full featured product nor a replacement for a filesystem manager" [S]. Great for *overview*, never for daily file work. That's the Kódváros sweet spot too |
| **MS Research Task Gallery** (CHI 2000) | Tasks as paintings in a 3D gallery, hosting unmodified 2D apps via output redirection | Users found it enjoyable and spatial memory helped [S]. Its redirection trick is what WGC does today. Never shipped |
| **Cockburn & McKenzie, CHI 2002** | 2D vs 3D spatial memory, physical and virtual | **Performance got worse as freedom in the third dimension grew.** 3D was rated more cluttered and less efficient [S]. Hard evidence: don't make people *place and retrieve* things in depth |
| **Sun Project Looking Glass** (2003–07, GPL) | Java 3D desktop with rotatable, flippable windows | Faded after 1.0.1 (2007). Commentary of the time pointed to resource demands and doubts about a mouse-heavy 3D UI [S] |
| **BumpTop** (physics desktop) | Icons as physical objects on a 3D desk | Acquired by Google 2010 and discontinued. Source later released [S]. A charming toy, but the novelty didn't replace folders |
| **Windows Vista/7 Flip 3D** | Win+Tab 3D window stack | Removed in Windows 8 [K]. Flat Alt+Tab with live thumbnails won |
| **SphereXP**, other 3D desktops | Desktop on a sphere | Curiosities [K] |
| **Gource** (GPL-3.0) | Repo history as an animated tree | Thrives because it is a *visualisation*, not a workspace [K] |
| **Meta Horizon Workrooms** | VR meeting and office space | **Discontinued 16 Feb 2026** amid Reality Labs cuts [S]. Social VR work never became daily habit |
| **Immersed** (VR desktop multi-monitor) | Your real monitors as giant screens in VR | Survives (claims 1.5M users, visionOS app). Its Visor headset was still in pre-order mid-2026 [S]. What lasted is "**your real 2D windows, arranged in space**" |
| **Apple visionOS** | Windows, volumes, immersive spaces in a shared space | The current consensus [K]: apps stay mostly 2D panels. 3D is for placement, context, and select "volumes" |

**Lessons, distilled**
1. 3D wins at **overview, ambient status and "where am I"**. It loses at reading, typing and precise selection.
   So the city is a *map and switchboard*. Work happens in real 2D windows (hand-off, §5.2).
2. **Never force navigation to reach something.** Every building needs a 1-keystroke path: type-to-find, hotkeys.
   The 3D path is optional.
3. **Stable places beat physics and free placement.** Generate layout from data (repo tree, drives,
   devices) so it never drifts. Cockburn's result punishes user-placed depth.
4. **Performance and polish decide survival.** Looking Glass and BumpTop felt heavy. The controller must
   appear in <150 ms and cost ~0% when idle.
5. **Ride the real OS, don't fight it.** Projects that patched the shell died on Windows updates. Overlays
   lived.

---

## 10. Suggested path for Kódváros (for discussion with the user)

| Step | What | Code needed |
|---|---|---|
| L0 | Kódváros as **Lively web wallpaper** pointing at the local server (ambient city behind icons) | None, configuration only |
| L1 | Tiny **Electron shell** (MIT): one transparent overlay per monitor, hotkey summon/hide, click-through when hidden, tray icon, auto-start, entry in START.cmd | Small, all JS |
| L2 | **Live data**: window list, CPU/RAM, media sessions, audio devices, through a local helper (Node first; C#/Rust helper only if Node can't reach an API) | Medium |
| L3 | **Windows on buildings**: `desktopCapturer` textures for 1–3 windows + thumbnails for the rest. **Portal hand-off** to Zen | Medium. Accept the yellow border on Win10 |
| L4 | **Zen via WebDriver BiDi** (separate profile): tabs as windows on a building | Medium |
| L5 | Menus and flyouts (launcher, volume, EQ via Equalizer APO config, devices) | Larger. Study Seelen UI (AGPL, learn only) and YASB (MIT, reusable) |

Before L1: update the PC to **Win10 22H2**, and test Electron transparency + WebGL on this GPU (the black-background bug).

---

## 11. Open questions / not verified

- Zebar's exact window options (zOrder top-most/bottom-most, dock-to-edge, monitor selection). Not in the
  README, they're in the `zpack.json` schema. Not checked.
- Licences not confirmed this session: EarTrumpet, Equalizer APO, `systeminformation`, the Rainmeter WebView2 plugins.
- Whether Spotify desktop registers a Windows media session (needs a live test).
- Wails v3 stable vs beta: sources conflict.
- How exactly Seelen UI hides the native taskbar on Win10 (read its source; AGPL, learn only).
- Measured GPU/CPU cost of an idle transparent Electron overlay on *this* PC (measure with PresentMon + Task Manager).
- The deep-research `researcher.md` instruction file could not be read (blocked by the read-outside-working-directory
  setting). These notes follow a standard method instead: primary sources first, tagged confidence.

---

## Sources

Host shells
- Electron BrowserWindow API — https://www.electronjs.org/docs/latest/api/browser-window
- Electron globalShortcut — https://www.electronjs.org/docs/latest/api/global-shortcut
- Electron desktopCapturer — https://www.electronjs.org/docs/latest/api/desktop-capturer
- Electron DesktopCapturerSource — https://electronjs.org/docs/latest/api/structures/desktop-capturer-source
- Electron webview tag — https://www.electronjs.org/docs/latest/api/webview-tag
- Electron frameless/click-through — https://electronjs.org/de/docs/latest/api/frameless-window
- Electron transparency black-background issue — https://github.com/electron/electron/issues/40515
- Electron Win7/8 deprecation — https://electronjs.org/ja/blog/windows-7-to-8-1-deprecation-notice
- Tauri window API — https://v2.tauri.app/reference/javascript/api/namespacewindow/
- Tauri global-shortcut plugin — https://v2.tauri.app/plugin/global-shortcut/
- Tauri overlay lessons (sticky notes) — https://www.producthunt.com/p/tauri-2/i-built-sticky-notes-that-hide-in-your-windows-screen-edge-with-tauri-2-6-lessons-learned
- Tauri transparent shelf war stories — https://dev.to/devrayat000/building-a-transparent-drag-and-drop-shelf-for-windows-with-tauri-the-engineering-war-stories-3c8c
- Tauri child webview click-through issue — https://github.com/tauri-apps/tauri/issues/11461
- WebView2 WPF composition control — https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.wpf.webview2compositioncontrol
- Wails — https://github.com/wailsapp/wails ; v3 changelog https://docs-preview.wails.io/changelog/
- Neutralino config — https://neutralino.js.org/docs/configuration/neutralino.config.json/ ; v5.1.0 notes https://github.com/neutralinojs/neutralinojs/releases/tag/v5.1.0
- Edge/WebView2 on Win10 until 2028 — https://www.thurrott.com/cloud/324473/microsoft-edge-on-windows-10-to-be-supported-until-october-2028 ; https://pureinfotech.com/microsoft-edge-support-end-october-2028-windows-10/

Windows capture / DWM / input
- Windows.Graphics.Capture — https://learn.microsoft.com/en-us/windows/apps/develop/media-authoring-processing/screen-capture
- IsBorderRequired — https://learn.microsoft.com/en-us/uwp/api/windows.graphics.capture.graphicscapturesession.isborderrequired
- SetIsBorderRequired fails on Win10 19045 — https://upd.dev/openai/codex/issues/25178
- WebRTC WGC session — https://webrtc.googlesource.com/src/+/main/modules/desktop_capture/win/wgc_capture_session.cc
- DWM thumbnail overview — https://learn.microsoft.com/en-us/windows/win32/dwm/thumbnail-ovw
- DwmRegisterThumbnail — https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/nf-dwmapi-dwmregisterthumbnail
- Raymond Chen, cross-process parent/child — https://devblogs.microsoft.com/oldnewthing/20130412-00/?p=4683
- SetForegroundWindow — https://learn.microsoft.com/fi-fi/windows/win32/api/winuser/nf-winuser-setforegroundwindow
- Chromium foreground helper — https://chromium.googlesource.com/chromium/src.git/+/6327123fee94de63bebc47bfbe4487f6ee88c44f/ui/base/win/foreground_helper.cc
- SHQueryUserNotificationState — https://learn.microsoft.com/hu-hu/windows/win32/api/shellapi/nf-shellapi-shqueryusernotificationstate ; Chromium fullscreen_win.cc https://chromium.googlesource.com/chromium/src/+/main/ui/base/fullscreen_win.cc
- DXGI flip model — https://devblogs.microsoft.com/directx/dxgi-flip-model/
- OBS WGC PR — https://github.com/obsproject/obs-studio/pull/2208 ; minimized capture thread https://obsproject.com/forum/threads/how-to-capture-minimized-window.167081/
- Desktop+ — https://github.com/elvissteinjr/DesktopPlus
- three.js CSS3D occlusion threads — https://discourse.threejs.org/t/combine-webglrenderer-with-css3drenderer/37899 ; https://discourse.threejs.org/t/occlusion-errors-with-css3drenderer-and-webgl/65570

Wallpaper layer
- Lively — https://github.com/rocksdanister/lively ; interaction guide https://github.com/rocksdanister/lively/wiki/Web-Guide-IV-:-Interaction ; v2.2.0.0 (24H2) https://newreleases.io/project/github/lively-community/lively/release/v2.2.0.0
- Wallpaper Engine web API — https://docs.wallpaperengine.io/en/web/api/propertylistener.html ; keyboard threads https://steamcommunity.com/app/431960/discussions/2/3484123157240646909
- electron-as-wallpaper — https://github.com/meslzy/electron-as-wallpaper
- WorkerW technique — https://www.purebasic.fr/english/viewtopic.php?p=573432 ; https://learn.microsoft.com/en-us/answers/questions/1386630/doubts-about-the-window-of-program-manager
- Win11 24H2 wallpaper-app hold — https://www.theregister.com/2025/04/14/windows_11_24h2_hold/

Widgets / shells
- Seelen UI — https://github.com/eythaann/Seelen-UI ; https://seelen.io/ ; JSR lib https://jsr.io/@seelen-ui/lib@2.8.3
- Zebar — https://github.com/glzr-io/zebar ; README https://raw.githubusercontent.com/glzr-io/zebar/main/README.md
- YASB — https://github.com/amnweb/yasb ; https://signpath.org/projects/yasb
- Rainmeter — https://signpath.org/projects/rainmeter ; WebView plugins https://github.com/khanhas/PluginWebView , https://github.com/RicardoTM05/WebView2
- Xbox Game Bar widget API — https://learn.microsoft.com/en-us/gaming/game-bar/api/xgb-widget
- PowerToys 0.100 — https://devblogs.microsoft.com/commandline/powertoys-0-100-is-here-new-shortcut-guide-command-palette-improvements-and-much-more/
- Windhawk — https://ramensoftware.com/windhawk
- Cairo Desktop — https://www.alternativeto.net/software/cairoshell/about/ ; https://www.deskmodder.de/blog/2020/02/11/cairo-desktop-windows-10-und-7-shell-ersatz-mit-vielen-raffinessen
- ExplorerPatcher flagged/blocked — https://www.elevenforum.com/t/ms-has-flagged-explorer-patcher-as-malware.28438/latest ; https://winfuture.de/news,153439.html
- GlazeWM — https://www.alternativeto.net/software/glazewm/about/

Zen / Gecko
- zen-mcp (WebDriver BiDi on Zen) — https://www.getdrio.com/mcp/io-github-sh6drack-zen-mcp/md
- MDN, BiDi connection — https://developer.mozilla.org/de/docs/Web/WebDriver/How_to/Create_BiDi_connection
- GeckoView (Android only) — https://firefox-source-docs.mozilla.org/mobile/android/geckoview/index.html

Media / audio
- Windows.Media.Control — https://learn.microsoft.com/en-us/uwp/api/windows.media.control
- EarTrumpet — https://github.com/File-New-Project/EarTrumpet/releases/

Precedents
- Task Gallery — https://www.microsoft.com/en-us/research/?p=145458
- Cockburn & McKenzie CHI 2002 — https://courses.washington.edu/hcde511/a14/readings/cockburn-chi02.pdf
- Project Looking Glass — https://www.wikipedia.org/wiki/LG3D
- BumpTop — https://en.wikipedia.org/wiki/BumpTop ; https://techcrunch.com/2010/05/02/bumptop-possible-google-acquisition/amp/
- fsn / fsv — https://archive.irixnet.org/siliconsurf/free/cool_sw_01.html ; https://en.wikipedia.org/wiki/File_System_Visualizer
- Horizon Workrooms discontinued — https://www.meta.com/en-gb/help/quest/2464765133873078/ ; https://www.roadtovr.com/meta-horizon-workrooms-discontinued-2026
- Immersed Visor status — https://roadtovr.com/immersed-visor-vr-headset-shipping-update-tease/ ; https://vr.org/articles/immersed-visor-shipping-update-price-increase-july-2026
