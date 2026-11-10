# VRG UI Kit v1 — "Mérőpult"

A modular, offline, token-driven front-end kit for the VRG toolset: 55 components across ten surface
families, four themes, three densities, one action registry, one icon sprite, and vendored fonts. It is plain
CSS plus vanilla JS. There is no framework, no CDN and no build step for consumers, and it works from `file://`.
An app inlines only what it needs into its single HTML file.

- **Gallery:** `gallery.html` — every component, every state, with theme and density switches and Hungarian
  labels. Open it straight from disk. Published copy (private to the owner): <https://claude.ai/artifact/JQ1MF3TBCaobEZXzyS27LP>.
- **Contract for builders:** `CONVENTIONS.md`.
- **Checks:** `node test/lint.js` (no literal colours, known tokens only) and
  `NODE_PATH=$(npm root -g) node test/verify.js` (contrast, offline, keyboard, 320×240, bundle).

No existing app or `shared/` file was changed. Adoption by the apps is left to later sessions.

---

## 1 · Adopt it in a single-file app

### A. Inline only what you need (decision 2A: the way apps take the kit)

```bash
node shared/vrg-ui-kit/inline.js table palette badge --themes dark,light --insert MyApp/app.html
```

Put two markers in the app's `<head>` once, and the command fills the region between them. It adds the tokens,
the chosen themes, density, every dependency in order, a sprite holding only the icons those components use,
the vendored fonts (decision 6B: always inlined, about 130 kB; `--no-fonts` opts out), and one `<script>`.
The begin marker records the component list, for example `<!-- vk:begin table palette badge --themes dark,light -->`,
so later runs need no arguments:

```bash
node shared/vrg-ui-kit/inline.js --sync-app MyApp/app.html Other/app.html
```

```bash
node shared/vrg-ui-kit/inline.js --check-app MyApp/app.html Other/app.html
```

`--sync-app` rebuilds each app's region from its own marker. `--check-app` exits 1 when a region differs from
what the kit now builds (`DRIFT`), the same way `tools/melyviz-sync.js --check` guards the Mélyvíz copies.

```html
<!-- vk:begin -->
<!-- vk:end -->
```

| Option | Effect |
|---|---|
| `--no-fonts` | Leaves out the three OFL fonts, which are otherwise embedded as `data:` URIs (about 130 kB); the system fallbacks are then used (Segoe UI, Bahnschrift, Cascadia Mono). |
| `--icons all` / `--icons a,b` / `--icons +a,b` | Sprite subset (default `used`, the components' own icons). `+a,b` adds the icons the app's own markup uses; the app is not scanned. |
| `--out file` | Writes the snippet to a file. |
| `--list` | Shows the resolved order. |
| `--check` | Validates the manifest. |
| `--all --page in.html --out out.html` | Inlines a whole page, like the published gallery. |
| `--sync` | Regenerates `icons/icons.json` and `icons/sprite.js` after editing `icons/sprite.svg`. |

### B. Link the files (dev pages, the gallery)

```html
<html class="vk" lang="hu" data-vk-theme="dark" data-vk-density="comfortable">
<link rel="stylesheet" href="shared/vrg-ui-kit/fonts/fonts.css">
<link rel="stylesheet" href="shared/vrg-ui-kit/tokens/base.css">        <!-- + theme-*.css, density.css -->
<link rel="stylesheet" href="shared/vrg-ui-kit/components/base.css">    <!-- + each component's .css -->
<script src="shared/vrg-ui-kit/icons/sprite.js"></script>                <!-- injects the sprite (file:// safe) -->
<script src="shared/vrg-ui-kit/components/core.js"></script>
<script src="shared/vrg-ui-kit/components/focus.js"></script>
<script src="shared/vrg-ui-kit/actions.js"></script>                      <!-- + each component's .js -->
```

Every JS file is an IIFE that attaches to `window.VK`. Each file can also be imported as an ES-module side
effect (`import './components/table.js'`), and including a file twice is harmless. Firefox loads `file://` fonts
only from the page's own folder or below, which is one more reason path A inlines them.

### Boot once per page

```js
VK.focus.enableHop();            // Shift+Arrow jumps between [data-vk-hop] regions
VK.actions.setContext(() => ({ sel: mySelection }));   // what every action's when()/run() receives
VK.actions.registerAll([...]);   // your commands (see §4)
VK.palette.attach();             // Ctrl+K
VK.actions.bindKeys(document);   // every registered shortcut, one listener
```

Then mount what you use: `VK.table.mount(el, opts)`, `VK.graph.mount(el, opts)`, and so on. Components do
nothing at load time. Theme and density are attributes on `<html>`; after switching them, fire
`document.dispatchEvent(new CustomEvent('vk:theme'))` so the canvas components redraw.

---

## 2 · Design: three directions judged, one synthesised

The user's reference board was the input. The Pinterest pins could not be fetched from the cloud session
(`pinterest.com` is outside the network allowlist), so the screenshots the user pasted during the session were
used instead. They covered metro-style node wiring, isometric stacked planes, hexagon panels, contribution
grids, film-HUD event rails, micrographics sheets, loader sheets, isometric city dioramas, figure-ground and
transit city maps, and an extruded blue city with glowing streets. The repo's own **Mélyvíz** rules (M1–M6) were
the second input.

| Direction | Idea | Legibility at density | Theme range | Small-screen survival | Versatility | Total /20 |
|---|---|---|---|---|---|---|
| **A · Calm technical HUD** | Near-black ground, white hairlines, colour only for meaning, ice = you / warm = activity, mono readouts, condensed titles | 5 | 4 | 4 | 5 | **18** |
| B · Dense engineering console | Grey panels, tight grid, everything visible, heavy tables, bright status colours | 5 | 3 | 2 | 4 | 14 |
| C · Soft glass workspace | Frosted layered panels, generous radius, depth and motion | 3 | 4 | 3 | 3 | 13 |

**The synthesis, "Mérőpult" (instrument panel), is A as the spine, with three grafts:**

- **From B:** a compact density, tabular mono numbers, keyboard hints everywhere, and tables as first-class surfaces.
- **From C:** glass only where something floats (palette, menus, HUD mode), plus a single overlay shadow token.
  Mélyvíz sets that token to `none`.
- **From the board:**
  - graph glyphs: filled dot = node, hollow diamond = junction, small square = terminal;
  - metro wires;
  - chamfered corners for focal panels;
  - the **MINI** (every feature's small icon is also its button and its progress indicator — the user called this
    crucial);
  - isometric stacks with pillars and beacons, and the program emblem as an isometric diorama.

## 3 · Themes, density, tokens

| Theme | `data-vk-theme` | Character |
|---|---|---|
| Éj (default, decision 4A) | `dark` | Near-black, white hairlines, ice + warm |
| Papír | `light` | Drafting paper; status hues darkened for AA on white |
| Kontraszt | `contrast` | Pure black, white lines, yellow focus ring no status shares, 3 px ring |
| Mélyvíz | `melyviz` | `shared/melyviz.css` mapped onto kit tokens: slate-water ground, square corners, no shadows, Bahnschrift / Cascadia first. Dev-side apps opt in per app, as they do today with `html.mv`. |

**Mélyvíz mapping (decision 3A).** `shared/melyviz.css` stays the one source. `tokens/theme-melyviz.css` is
**generated** from it by `tokens/melyviz-map.js`, and `node tools/melyviz-sync.js` now writes it along with the app
copies; `--check` reports it as `DRIFT` when it is out of date. The mapping:

- surfaces: `--mv-bg` → `--vk-bg`, `--mv-panel-solid` → `--vk-surface-1`, `--mv-raised` → `--vk-surface-2`,
  `--mv-panel` → `--vk-overlay`;
- lines and text: `--mv-line(-strong)` → `--vk-line(-strong)`, `--mv-dim` → `--vk-text-muted`;
- the two temperatures: `--mv-accent` → `--vk-accent`, `--mv-warm` → `--vk-activity`;
- states and glass: `--mv-ok/warn/crit` → `--vk-ok/warn/crit`, `--mv-cut`/`--mv-blur`/`--mv-glow` → `--vk-cut`/`--vk-blur`/`--vk-glow`.

Values Mélyvíz does not define (surface-3, info, the heat scale, the terminal tones) are kit-owned constants in
`melyviz-map.js`. Never edit `theme-melyviz.css` by hand.

**Density** (`data-vk-density`):

- `comfortable` (default): 28 px controls.
- `compact`: 24 px controls and 22 px rows.
- `touch`: 40 px targets, larger type, no hover-only actions. Used for phones and 320×240 CYD boards.
  Coarse pointers get touch-sized targets even without the attribute.

**Rules:**

- Components never write a literal colour; `test/lint.js` enforces it.
- Status meaning goes through alias tokens (`--vk-st-*`, `--vk-sig-*`, `--vk-wire-*`), so the meaning map lives in
  one place.
- Soft fills are derived with `color-mix()` in `base.css`, so a theme only defines the primaries.

<!-- tokens:begin -->
Every token, its default value, and the value in each theme (`·` means the theme inherits the default). Density overrides of the size tokens are in `tokens/density.css`.

| Group | Token | Éj (default) | Papír | Kontraszt | Mélyvíz | Use |
|---|---|---|---|---|---|---|
| colour: ground and surfaces (dark default) | `--vk-bg` | `#0b0d0f` | `#f2f3f1` | `#000000` | `#0a141c` | the ground: app background |
| colour: ground and surfaces (dark default) | `--vk-bg-sunken` | `#070809` | `#e8eae7` | `#000000` | `#071017` | wells: canvas, terminal, inputs on a panel |
| colour: ground and surfaces (dark default) | `--vk-surface-1` | `#111417` | `#fbfbfa` | `#000000` | `#121c24` | panels, docks, cards |
| colour: ground and surfaces (dark default) | `--vk-surface-2` | `#171b1f` | `#ffffff` | `#0d0d0d` | `#17232c` | raised: headers, toolbars, hovered card |
| colour: ground and surfaces (dark default) | `--vk-surface-3` | `#1f2429` | `#eceeec` | `#1a1a1a` | `#1d2a34` | menus, popovers, pressed |
| colour: ground and surfaces (dark default) | `--vk-overlay` | `rgba(17, 20, 23, .9)` | `rgba(252, 252, 251, .94)` | `#000000` | `rgba(20, 30, 38, .74)` | glass base for palette, menus, HUD (with backdrop blur) |
| colour: ground and surfaces (dark default) | `--vk-scrim` | `rgba(3, 4, 5, .62)` | `rgba(20, 28, 34, .32)` | `rgba(0, 0, 0, .82)` | `rgba(4, 9, 13, .6)` | behind modal layers |
| colour: lines | `--vk-line` | `rgba(235, 240, 245, .11)` | `rgba(18, 26, 32, .12)` | `#8c8c8c` | `rgba(232, 240, 246, .15)` | decorative hairline (dividers, grid) |
| colour: lines | `--vk-line-strong` | `rgba(235, 240, 245, .24)` | `rgba(18, 26, 32, .26)` | `#ffffff` | `rgba(232, 240, 246, .34)` | panel edges, frames |
| colour: lines | `--vk-border-control` | `#69737c` | `#7a858e` | `#ffffff` | `#6c7880` | control boundaries: ≥3:1 on every surface |
| colour: text | `--vk-text` | `#eef2f5` | `#11181d` | `#ffffff` | `#e8f0f6` |  |
| colour: text | `--vk-text-muted` | `#a5aeb6` | `#4b5761` | `#e2e2e2` | `#a6afb7` | secondary text: ≥4.5:1 on surface-3 |
| colour: text | `--vk-text-faint` | `#6c757d` | `#8d969d` | `#b8b8b8` | `#646d74` | disabled and decorative only — never information |
| colour: text | `--vk-text-on-accent` | `#061418` | `#ffffff` | `#000000` | `#071318` |  |
| colour: text | `--vk-text-on-solid` | `#0b0d0f` | `#ffffff` | `#000000` | `#0a141c` | text on a filled status colour |
| colour: the two temperatures | `--vk-accent` | `#9fd8ea` | `#1b6682` | `#5ce1ff` | `#93d3e6` | ice: selection, focus, playhead, "you are here" |
| colour: the two temperatures | `--vk-accent-hover` | `#c2e7f3` | `#124a5f` | `#a8f0ff` | `#b9e3f0` |  |
| colour: the two temperatures | `--vk-activity` | `#eaa46f` | `#9c5216` | `#ffb36b` | `#e8a873` | warm: running, heat, recent work |
| colour: the two temperatures | `--vk-focus` | `#9fd8ea` | `#1b6682` | `#ffe14d` | `#93d3e6` | the focus ring |
| colour: meaning | `--vk-ok` | `#84d0a0` | `#276f43` | `#6dff9e` | `#8bcca1` |  |
| colour: meaning | `--vk-warn` | `#e7c27a` | `#7f5a00` | `#ffe14d` | `#e3be7b` |  |
| colour: meaning | `--vk-crit` | `#f08479` | `#b0322a` | `#ff7a6e` | `#e4877d` |  |
| colour: meaning | `--vk-info` | `#98b8f4` | `#2d58b0` | `#93b9ff` | `#9db8e8` |  |
| colour: meaning | `--vk-idea` | `#bba9f2` | `#6a48bd` | `#d6bdff` | `#b4a7e6` |  |
| colour: categorical layers (wires, graph layers, series) | `--vk-layer-1` | `#f08f6c` | `#c4502b` | `#ff9a70` | · | erősáram / power |
| colour: categorical layers (wires, graph layers, series) | `--vk-layer-2` | `#e6cd62` | `#8a6f00` | `#ffe14d` | · | világítás / lighting |
| colour: categorical layers (wires, graph layers, series) | `--vk-layer-3` | `#7db3f2` | `#2c6cbd` | `#7fc0ff` | · | adat / data |
| colour: categorical layers (wires, graph layers, series) | `--vk-layer-4` | `#b69bf2` | `#7550c4` | `#cfa8ff` | · | vezérlés / control |
| colour: categorical layers (wires, graph layers, series) | `--vk-layer-5` | `#84d19a` | `#2c8448` | `#6dff9e` | · | védőföld / earth |
| colour: categorical layers (wires, graph layers, series) | `--vk-layer-6` | `#5fd0c3` | `#0f8076` | `#4dffe9` | · | busz / bus |
| colour: categorical layers (wires, graph layers, series) | `--vk-layer-7` | `#f08fbf` | `#b23a79` | `#ff9ad0` | · | jel / signal |
| colour: categorical layers (wires, graph layers, series) | `--vk-layer-8` | `#aab4bd` | `#66717b` | `#e2e2e2` | · | egyéb / other |
| colour: heat scale (contribution grid, intensity) — warm = activity | `--vk-heat-0` | `#171b1f` | `#e4e7e4` | `#1a1a1a` | `#17232c` |  |
| colour: heat scale (contribution grid, intensity) — warm = activity | `--vk-heat-1` | `#3d2c20` | `#f2d6bd` | `#5c3b10` | `#3a2e25` |  |
| colour: heat scale (contribution grid, intensity) — warm = activity | `--vk-heat-2` | `#6f4628` | `#e2a775` | `#9e5f1c` | `#6a4a30` |  |
| colour: heat scale (contribution grid, intensity) — warm = activity | `--vk-heat-3` | `#ad6c3c` | `#c0753a` | `#e08a2e` | `#a87048` |  |
| colour: heat scale (contribution grid, intensity) — warm = activity | `--vk-heat-4` | `#eaa46f` | `#8a4a17` | `#ffc27a` | `#e8a873` |  |
| colour: terminal | `--vk-term-bg` | `#070809` | `#161c21` | `#000000` | `#071017` |  |
| colour: terminal | `--vk-term-text` | `#d9e3ea` | `#dfe7ee` | `#ffffff` | `#d8e4ec` |  |
| colour: terminal | `--vk-term-ok` | `var(--vk-ok)` | `#84d0a0` | `#6dff9e` | `#8bcca1` |  |
| colour: terminal | `--vk-term-warn` | `var(--vk-warn)` | `#e7c27a` | `#ffe14d` | `#e3be7b` |  |
| colour: terminal | `--vk-term-crit` | `var(--vk-crit)` | `#f08479` | `#ff7a6e` | `#e4877d` |  |
| colour: terminal | `--vk-term-info` | `var(--vk-info)` | `#98b8f4` | `#93b9ff` | `#9db8e8` |  |
| colour: terminal | `--vk-term-muted` | `#9ba7b1` | `#9ba7b1` | `#e2e2e2` | `#a6afb7` |  |
| elevation (themes may set these to none: Mélyvíz has no drop shadows) | `--vk-shadow-1` | `0 1px 0 rgba(0, 0, 0, .35)` | `0 1px 0 rgba(18, 26, 32, .06)` | `none` | `none` |  |
| elevation (themes may set these to none: Mélyvíz has no drop shadows) | `--vk-shadow-overlay` | `0 12px 32px rgba(0, 0, 0, .55), 0 0 0 1px rgba(0, 0, 0, .5)` | `0 12px 32px rgba(18, 26, 32, .18), 0 0 0 1px rgba(18, 26, 32, .08)` | `0 0 0 1px #ffffff` | `none` |  |
| elevation (themes may set these to none: Mélyvíz has no drop shadows) | `--vk-glow` | `0 0 6px rgba(159, 216, 234, .35)` | `0 0 0 3px rgba(27, 102, 130, .16)` | `none` | `0 0 3px rgba(147, 211, 230, .5)` | emission around an "on" control |
| elevation (themes may set these to none: Mélyvíz has no drop shadows) | `--vk-blur` | `14px` | · | `0px` | `12px` | backdrop blur of glass layers |
| derived colour (color-mix keeps themes short; themes may override any) | `--vk-accent-soft` | `color-mix(in srgb, var(--vk-accent) 15%, transparent)` | · | `color-mix(in srgb, var(--vk-accent) 26%, transparent)` | · |  |
| derived colour (color-mix keeps themes short; themes may override any) | `--vk-accent-line` | `color-mix(in srgb, var(--vk-accent) 55%, transparent)` | · | · | · |  |
| derived colour (color-mix keeps themes short; themes may override any) | `--vk-activity-soft` | `color-mix(in srgb, var(--vk-activity) 15%, transparent)` | · | · | · |  |
| derived colour (color-mix keeps themes short; themes may override any) | `--vk-ok-soft` | `color-mix(in srgb, var(--vk-ok) 15%, transparent)` | · | · | · |  |
| derived colour (color-mix keeps themes short; themes may override any) | `--vk-warn-soft` | `color-mix(in srgb, var(--vk-warn) 15%, transparent)` | · | · | · |  |
| derived colour (color-mix keeps themes short; themes may override any) | `--vk-crit-soft` | `color-mix(in srgb, var(--vk-crit) 15%, transparent)` | · | · | · |  |
| derived colour (color-mix keeps themes short; themes may override any) | `--vk-info-soft` | `color-mix(in srgb, var(--vk-info) 15%, transparent)` | · | · | · |  |
| derived colour (color-mix keeps themes short; themes may override any) | `--vk-idea-soft` | `color-mix(in srgb, var(--vk-idea) 15%, transparent)` | · | · | · |  |
| derived colour (color-mix keeps themes short; themes may override any) | `--vk-hover-bg` | `color-mix(in srgb, var(--vk-text) 6%, transparent)` | `color-mix(in srgb, var(--vk-text) 5%, transparent)` | `color-mix(in srgb, var(--vk-text) 14%, transparent)` | · |  |
| derived colour (color-mix keeps themes short; themes may override any) | `--vk-press-bg` | `color-mix(in srgb, var(--vk-text) 10%, transparent)` | · | · | · |  |
| derived colour (color-mix keeps themes short; themes may override any) | `--vk-select-bg` | `color-mix(in srgb, var(--vk-accent) 18%, transparent)` | `color-mix(in srgb, var(--vk-accent) 12%, transparent)` | `color-mix(in srgb, var(--vk-accent) 28%, transparent)` | · |  |
| derived colour (color-mix keeps themes short; themes may override any) | `--vk-select-line` | `var(--vk-accent)` | · | · | · |  |
| status vocabulary (aliases: change the meaning map here, not in components) | `--vk-st-inuse` | `var(--vk-ok)` | · | · | · |  |
| status vocabulary (aliases: change the meaning map here, not in components) | `--vk-st-built` | `var(--vk-accent)` | · | · | · |  |
| status vocabulary (aliases: change the meaning map here, not in components) | `--vk-st-dev` | `var(--vk-activity)` | · | · | · |  |
| status vocabulary (aliases: change the meaning map here, not in components) | `--vk-st-planned` | `var(--vk-info)` | · | · | · |  |
| status vocabulary (aliases: change the meaning map here, not in components) | `--vk-st-idea` | `var(--vk-idea)` | · | · | · |  |
| status vocabulary (aliases: change the meaning map here, not in components) | `--vk-st-active` | `var(--vk-activity)` | · | · | · |  |
| status vocabulary (aliases: change the meaning map here, not in components) | `--vk-st-waiting` | `var(--vk-warn)` | · | · | · |  |
| status vocabulary (aliases: change the meaning map here, not in components) | `--vk-st-parked` | `var(--vk-text-muted)` | · | · | · |  |
| status vocabulary (aliases: change the meaning map here, not in components) | `--vk-st-ended` | `var(--vk-text-muted)` | · | · | · |  |
| status vocabulary (aliases: change the meaning map here, not in components) | `--vk-sig-contradiction` | `var(--vk-crit)` | · | · | · |  |
| status vocabulary (aliases: change the meaning map here, not in components) | `--vk-sig-gap` | `var(--vk-warn)` | · | · | · |  |
| status vocabulary (aliases: change the meaning map here, not in components) | `--vk-sig-frozen` | `var(--vk-info)` | · | · | · |  |
| status vocabulary (aliases: change the meaning map here, not in components) | `--vk-wire-power` | `var(--vk-layer-1)` | · | · | · |  |
| status vocabulary (aliases: change the meaning map here, not in components) | `--vk-wire-light` | `var(--vk-layer-2)` | · | · | · |  |
| status vocabulary (aliases: change the meaning map here, not in components) | `--vk-wire-data` | `var(--vk-layer-3)` | · | · | · |  |
| status vocabulary (aliases: change the meaning map here, not in components) | `--vk-wire-control` | `var(--vk-layer-4)` | · | · | · |  |
| status vocabulary (aliases: change the meaning map here, not in components) | `--vk-wire-earth` | `var(--vk-layer-5)` | · | · | · |  |
| status vocabulary (aliases: change the meaning map here, not in components) | `--vk-wire-bus` | `var(--vk-layer-6)` | · | · | · |  |
| status vocabulary (aliases: change the meaning map here, not in components) | `--vk-wire-signal` | `var(--vk-layer-7)` | · | · | · |  |
| status vocabulary (aliases: change the meaning map here, not in components) | `--vk-wire-other` | `var(--vk-layer-8)` | · | · | · |  |
| type | `--vk-font-sans` | `"VK Inter", "Inter", "Segoe UI", system-ui, sans-serif` | · | · | `"Segoe UI", "VK Inter", system-ui, sans-serif` |  |
| type | `--vk-font-voice` | `"VK Barlow Condensed", "Barlow Condensed", Bahnschrift, "DIN Alternate", "Arial Narrow", sans-serif` | · | · | `Bahnschrift, "DIN Alternate", "Arial Narrow", "VK Barlow Condensed", sans-serif` |  |
| type | `--vk-font-mono` | `"VK JetBrains Mono", "JetBrains Mono", "Cascadia Mono", Consolas, ui-monospace, monospace` | · | · | `"Cascadia Mono", "Cascadia Code", Consolas, "VK JetBrains Mono", ui-monospace, monospace` |  |
| type | `--vk-fs-2xs` | `10px` | · | · | · |  |
| type | `--vk-fs-xs` | `11px` | · | · | · |  |
| type | `--vk-fs-sm` | `12px` | · | · | · |  |
| type | `--vk-fs-md` | `13px` | · | · | · | body; density.css rescales |
| type | `--vk-fs-lg` | `15px` | · | · | · |  |
| type | `--vk-fs-xl` | `18px` | · | · | · |  |
| type | `--vk-fs-2xl` | `24px` | · | · | · |  |
| type | `--vk-fs-3xl` | `32px` | · | · | · |  |
| type | `--vk-lh-tight` | `1.2` | · | · | · |  |
| type | `--vk-lh` | `1.45` | · | · | · |  |
| type | `--vk-fw-regular` | `400` | · | · | · |  |
| type | `--vk-fw-strong` | `600` | · | · | · |  |
| type | `--vk-tracking-label` | `.12em` | · | · | · | small uppercase labels |
| type | `--vk-tracking-title` | `.06em` | · | · | · | condensed titles |
| space and size (density.css overrides) | `--vk-space-1` | `2px` | · | · | · |  |
| space and size (density.css overrides) | `--vk-space-2` | `4px` | · | · | · |  |
| space and size (density.css overrides) | `--vk-space-3` | `8px` | · | · | · |  |
| space and size (density.css overrides) | `--vk-space-4` | `12px` | · | · | · |  |
| space and size (density.css overrides) | `--vk-space-5` | `16px` | · | · | · |  |
| space and size (density.css overrides) | `--vk-space-6` | `24px` | · | · | · |  |
| space and size (density.css overrides) | `--vk-space-7` | `32px` | · | · | · |  |
| space and size (density.css overrides) | `--vk-control-h` | `28px` | · | · | · | buttons, inputs, tabs |
| space and size (density.css overrides) | `--vk-row-h` | `28px` | · | · | · | table rows, list items, menu items |
| space and size (density.css overrides) | `--vk-icon-size` | `16px` | · | · | · |  |
| space and size (density.css overrides) | `--vk-icon-stroke` | `1.5` | · | · | · |  |
| space and size (density.css overrides) | `--vk-target-min` | `24px` | · | · | · | smallest hit area (WCAG 2.5.8); 40px in touch density |
| space and size (density.css overrides) | `--vk-pad-panel` | `12px` | · | · | · |  |
| space and size (density.css overrides) | `--vk-gutter` | `16px` | · | · | · |  |
| shape | `--vk-radius-sm` | `2px` | · | · | `0` |  |
| shape | `--vk-radius` | `3px` | · | · | `0` |  |
| shape | `--vk-radius-lg` | `5px` | · | · | `0` |  |
| shape | `--vk-radius-pill` | `999px` | · | · | · |  |
| shape | `--vk-cut` | `6px` | · | · | `6px` | chamfer on .vk-cut panels (two opposite corners) |
| shape | `--vk-border-w` | `1px` | · | · | · |  |
| shape | `--vk-focus-w` | `2px` | · | `3px` | · |  |
| shape | `--vk-focus-offset` | `2px` | · | · | · |  |
| motion | `--vk-dur-1` | `80ms` | · | · | · |  |
| motion | `--vk-dur-2` | `150ms` | · | · | · |  |
| motion | `--vk-dur-3` | `240ms` | · | · | · |  |
| motion | `--vk-dur-4` | `420ms` | · | · | · |  |
| motion | `--vk-ease` | `cubic-bezier(.2, .7, .2, 1)` | · | · | · |  |
| motion | `--vk-ease-in-out` | `cubic-bezier(.6, 0, .3, 1)` | · | · | · |  |
| layering | `--vk-z-panel` | `10` | · | · | · |  |
| layering | `--vk-z-sticky` | `20` | · | · | · |  |
| layering | `--vk-z-hud` | `100` | · | · | · |  |
| layering | `--vk-z-popover` | `200` | · | · | · |  |
| layering | `--vk-z-modal` | `300` | · | · | · |  |
| layering | `--vk-z-toast` | `400` | · | · | · |  |
<!-- tokens:end -->

## 4 · The action registry and the MINI

`actions.js` is the one list. An entry declares an action **and every surface it appears on**:

```js
VK.actions.register({ id: 'export.pdf', label: 'Export PDF', hint: 'A terv nyomtatható változata', group: 'Fájl',
  icon: 'download', keys: ['mod+e'], at: ['palette', 'menu:canvas', 'toolbar:main', 'statusbar'],
  when: c => c.sel.length > 0, reason: 'Jelölj ki legalább egy elemet',
  progress: c => job.p, state: c => job.state,             // drives its MINI
  run: c => startExport(c) });
```

- **Surfaces read the registry:** the palette (`palette`), menus (`menu:<ctx>`), toolbars (`toolbar:<id>`), the
  status bar (`statusbar`), the file manager's F-keys (`fkeys`), and the CYD/phone bars.
  `VK.actions.touch(id)` tells them that state changed.
- **Keyboard:** `bindKeys` leaves typing keys and editing chords (Ctrl+Z/C/V/X/A…) native inside text fields
  unless `keysInInputs: true`.
- **Search:** fuzzy and Hungarian-folded, so "orszem" finds "Őrszem".

The field names are a superset of Planner's `05c-actions.js` (`id, label, group, icon, hint, keys, when, run`)
and MindMap's `ACT` (`at`). Both registries can be ported entry by entry.

## 5 · Component index

<!-- index:begin -->
Families: 1 Shell / workspace · 2 Command layer · 3 Graph and topology · 4 Time views · 5 Data views · 6 Status and signals · 7 Decisions and input · 8 Agent / AI surfaces · 9 Small screens · 10 Program identity (emblem, city map, micrographics, textures).

| Component | Families | Files | Depends on | What it is | API |
|---|---|---|---|---|---|
| `base` | all | base.css | — | Opt-in base layer under .vk, focus ring, .vk-icon, type/surface/layout utilities, .vk-cut chamfer, .vk-glass. | CSS only |
| `core` | all | core.js | — | VK namespace: el(), icon(), uid(), emitter(), fire(), place() popover positioning, token(), fold(), rng(). | VK.el, VK.icon, VK.place, VK.token, VK.fold, VK.rng, VK.reducedMotion |
| `focus` | all | focus.js | core | Keyboard plumbing: roving tabindex, focus trap, Shift+Arrow region hopping ([data-vk-hop]). | VK.focus.roving(el, opts), VK.focus.trap(el, opts), VK.focus.enableHop() |
| `actions` | 2 | actions.js | core | The one action registry: palette, menus, toolbars, status bar and shortcuts all read it. | VK.actions.register(a), forSurface(id, ctx), run(id), search(q), bindKeys(), keyLabel() |
| `button` | 1, 2, 7 | button.css | base | Buttons: outline/primary/ghost/quiet/danger, icon, small, pressed; segmented .vk-btn-group. | CSS only |
| `mini` | 1, 2, 6, 8, 9 | mini.css mini.js | base, core | The MINI: every feature's icon that is also its button and its progress indicator (ring/ticks/square meter, states). | VK.mini.create(o), VK.mini.set(el, {progress, state, value, pressed}), VK.mini.fromAction(id) |
| `shell` | 1 | shell.css shell.js | base, focus, mini, panel, actions, core | Full-screen app frame: CSS grid (top bar, left/right/bottom docks, main, status bar); docks collapse to a rail of minis; HUD mode (data-mode=hud) turns the frame transparent over content with glass bars and panels; auto-collapse when narrow. | VK.shell.mount(el, {mode, docks:{left:{collapsed,size},right,bottom}, autoCollapse (default 480), touchCollapse (default 1100), onChange}) → {toggle(side, open?), collapsed, setSize, setMode, toggleMode, mode, state, refreshRails, destroy}; VK.shell.actions(sh, {prefix, at, keys}) → [<prefix>.hud, <prefix>.dock.left/right/bottom] |
| `commandbar` | 1 | commandbar.css commandbar.js | base, focus, mini, actions, core | Top command bar: brand emblem slot, breadcrumbs as buttons, a search trigger that runs registry action palette.open when registered, minis from surface toolbar:command; container-query responsive. Minis that do not fit go behind a "…" overflow menu. | VK.commandbar.mount(el, {brand:{name,tag,emblem}, path:[{label,icon,mono}], onNavigate(i,seg), surface, searchAction, searchText}) (narrow: surplus minis → "…" menu) → {setPath, setBrand, refresh, render, path, destroy} |
| `statusbar` | 1 | statusbar.css statusbar.js | base, focus, mini, actions, core | Bottom status bar rendering registry surface statusbar as minis + short mono text (action.statusText / statusSide / statusPin) plus passive readouts, start/end groups, polite role=status live region for state changes. | VK.statusbar.mount(el, {surface, label, items:[{id,key,text,side,pin}]}) → {refresh(id?), setText(id, text, announce?), announce, render, destroy} |
| `panel` | 1 | panel.css panel.js | base, focus, mini, core, actions | Dockable panel: header with micro label, condensed title and minis (collapse, maximise, float, close, registry verbs, state), scrolling body, data-vk-hop; works in docks and floating (pointer drag, Ctrl+arrows). | VK.panel.mount(el, {title, label, icon, level, controls:[collapse,maximize,float,close], surface, collapsed, onCollapse, onMaximize, onFloat, onClose}) → {collapse, toggle, maximize, float, close, open, setTitle, setState({state,progress,label}), isCollapsed, refresh, destroy}; VK.panel.get(el) |
| `splitter` | 1 | splitter.css splitter.js | base, core | Resizable split view, horizontal or vertical, nestable: role=separator with aria-valuenow/min/max, arrows / Ctrl+arrows / PageUp/PageDown / Home/End, Enter or double-click resets, min sizes, onChange for persistence. | VK.splitter.mount(el, {orientation:horizontal/vertical, value, default, min:[a,b], step, bigStep, label, onChange(v)}) → {value, set, reset, destroy} |
| `tabs` | 1 | tabs.css tabs.js | base, focus, mini, actions, core | Tablist with closable tabs, dirty dot (warm), overflow scroll with chevrons, roving keyboard (arrows, Home/End, Delete closes), registry minis (e.g. Új lap), tabpanels, empty state. | VK.tabs.mount(el, {tabs:[{id,label,icon,dirty,closable,panel}], active, activation, surface, emptyText, onSelect, onClose}) → {add, close, closeActive, select, next, setDirty, setLabel, active, ids, refresh, destroy}; VK.tabs.actions(t, {prefix, when}) → close (mod+w), next, prev |
| `wm` | 1 | wm.css wm.js | base, focus, mini, actions, core | Window manager for the VRG Desktop: floating non-modal role=dialog windows, pointer drag/resize, edge snap, focus/z-order, minimise to a taskbar of minis (progress per window), maximise, snap halves, tile all, keyboard move/resize mode. | VK.wm.mount(area, {taskbar, glass, sheetBelow (default 480: full-width sheets), onChange}) → {open({id,title,icon,tag,content,x,y,w,h}), close, minimize, restore, maximize, snap, tile, cycle, move, resize, setProgress, setTitle, focus, active, list, get, destroy}; VK.wm.actions(wm, {prefix, when, keys}) → move, resize, minimize, maximize, snapLeft, snapRight, tile, cycle, close |
| `kbd` | 2 | kbd.css kbd.js | base, core, focus, actions | Keycap chips from registry keys, Alt-held key-hint badges over visible [data-action] elements, searchable cheat-sheet dialog (and inline sheet). | VK.kbd.chip(key), chips(keys), forAction(a), label(k), aria(k), hints({root, delay}) → off, showHints/hideHints, sheet(opts), renderSheet(el, opts), attachHelp({keys, at}) → actions 'help.keys' + 'help.hints' |
| `menu` | 2 | menu.css menu.js | base, core, focus, actions, kbd | Context / dropdown menus and a menubar from registry surfaces: groups with separators, disabled with reason, checkable, danger, key hints, submenus (children / many), typeahead, VK.place flipping, overflow '…' on the menubar. | VK.menu.open(surfaceOrItems, anchorOrPoint, ctx, {label, side, focus, restore, inline}) → {close, focusFirst, focusLast}; VK.menu.close(); bindContext(el, surface, ctxFn) → off; button(btn, surface, opts) → off; menubar(el, [{label, surface}], opts) → {layout, destroy} |
| `palette` | 2 | palette.css palette.js | base, core, focus, actions, kbd, mini | Command palette (Ctrl+K): glass modal combobox, fuzzy hits highlighted, grouped, recent first, toggles BE/KI, running minis, 'Nem érhető el most' for disabled-only matches, prefix providers ('#' jump). Inline mount for docs. | VK.palette.attach({surface, keys, at, label}) registers 'palette.open'; open(text) · close() · toggle() · isOpen(); addProvider(prefix, fn(q, ctx) → [{label, hint, icon, run}], {label, placeholder}) → off; mount(el, {query, surface}) → {setQuery, refresh, destroy} |
| `toolbar` | 2 | toolbar.css toolbar.js | base, core, focus, actions, mini, menu, kbd | Registry surface 'toolbar:<id>' as minis or labelled buttons: roving arrows, group separators, dropdowns for children, ResizeObserver overflow into 'Továbbiak', toggleable placement top/bottom/left/right/floating via registry actions + onPlacement. | VK.toolbar.mount(el, {id, mode:'mini'/'label', placement, placeable, placementAt, onPlacement(p, xy), name, ctx}) → {refresh, rebuild, layout, setPlacement(p, xy), placement(), setMode(m), destroy} |
| `graph` | 3 | graph.css graph.js | base, core, mini, focus, actions | SVG node/wire topology: bubble/dot/junction/terminal/hex nodes, metro/curve/straight wires typed by layer (planned dashed, active warm flow, arrows, labels, bundled fan-in/out), dashed chamfered frames, selection (click, Ctrl+click, Shift+box, Ctrl+A), keyboard spatial focus, layer show/hide with a legend of toggle minis, flat or iso-board projection (extruded slabs, glowing hub). Emits vk:selection. | VK.graph.mount(el, {nodes, edges, frames, layers, projection:"flat"/"iso", label, edgeStyle, arrows}) → {setData, select(ids,{add,toggle}), selection, focusNode, fit, zoomTo(k/id), zoomBy, panBy, centerOn, getView, setView, setLayerVisible(id,on), isLayerVisible, setProjection, bounds, model, legend(el), on(select/focus/open/rename/badge/view/layer/data), destroy}; registry ids: graph.zoomIn, graph.zoomOut, graph.fit, graph.delete |
| `minimap` | 3 | minimap.css minimap.js | base, core, graph | Overview of a graph with the ice viewport rectangle: click/drag to move, arrows pan, +/- zoom, 0 fit; follows pan/zoom, selection and layer changes. .vk-minimap--overlay[data-corner=bl/tr] floats it on the stage. | VK.minimap.mount(el, graphInstance, {label}) → {update, destroy} |
| `layerstack` | 3 | layerstack.css layerstack.js | base, core, mini, focus | Stacked isometric planes; dashed vertical pillars tie the same entity across planes, warm beacons rise from active entities; plane list of show/hide/solo minis; hover/focus lights an entity on every plane; keyboard Up/Down plane, Left/Right entity, S solo, H hide. | VK.layerstack.mount(el, {planes:[{id,name,color}], entities:[{id,label,at:{planeId:{x,y}},beacon}], links}) → {setData, setVisible(id,on), solo(id/null), focus(planeId,entityId), highlight(id), state, on(focus/open/visibility), destroy} |
| `timeline` | 4 | timeline.css timeline.js | base, button, mini, core, focus, actions | Swimlane timeline: sticky lanes, session bars / commit dots / release squares with run states, Nap/Hét/Hónap zoom, today marker, draggable ice playhead, roving-grid keyboard, registry actions as MINIs. | VK.timeline.mount(el, {lanes, items, from, to, zoom, now, playhead, follow, actions}) → {setRange, setPlayhead, setZoom, zoomIn, zoomOut, setFollow, setItems, select, focusItem, scrollTo, refreshActions, state, on, destroy} |
| `eventrail` | 4 | eventrail.css eventrail.js | base, core | Film-HUD event rail: chamfered band, year/age axis, warm pips, metro leader lines to row-stacked labels (date · [kategória] · text), id chips with warning glyph, ice selection. | VK.eventrail.mount(el, {from, to, events:[{t, label, cat, id, flag}], now, axis, born, maxRows}) → {setEvents, select, layout, on, destroy} |
| `heatgrid` | 4 | heatgrid.css heatgrid.js | base, core | Contribution pixel grid weeks × days (H K Sze Cs P Szo V), --vk-heat-0…4, legend, multi-year stack with totals, role=grid keyboard (day/week/month), live readout, select event. | VK.heatgrid.mount(el, {years, data, unit, levels, now, title}) → {setData, select, focusDate, on, destroy} |
| `scrubber` | 4 | scrubber.css scrubber.js | base, button, mini, core | Time scrubber / range slider: ticks + date labels, play/pause MINI showing playback progress, step buttons, role=slider with date aria-valuetext, optional two-thumb range. | VK.scrubber.mount(el, {min, max, value, range, step, bigStep, duration, time, disabled}) → {set, get, play, pause, toggle, playing, setBounds, setDisabled, on, destroy} |
| `table` | 5 | table.css table.js | base, core, mini | Dense data table (role=grid): sort (aria-sort), global + per-column quick filters (number expressions), sticky header and first column, click/Ctrl/Shift and Space/Shift+Space/Ctrl+A/Esc selection, roving cell, status cells via render(), zebra, loading/error/empty states, footer counts. | VK.table.mount(el, {columns, rows, selectable, onSelect, onActivate, onRefresh, tools, stickyFirst, zebra}) → {setRows, getSelection, select, selectAll, clearSelection, sort, filter, setState, getView, focus, refresh, destroy} |
| `tree` | 5 | tree.css tree.js | base, core, mini | Treeview (WAI-ARIA tree): expand/collapse, arrows, typeahead, * expands siblings, icons by kind, tri-state checkboxes, lazy children with a loading/error MINI and retry, metro indent guides. | VK.tree.mount(el, {items, checkboxes, lazy, icons, onSelect, onActivate, onCheck, onToggle}) → {setItems, expand, collapse, expandAll, collapseAll, select, focusItem, getSelected, getChecked, setChecked, focus, destroy} |
| `filemanager` | 5 | filemanager.css filemanager.js | base, core, actions, mini | Dual-pane Total Commander style file manager: breadcrumb path bars, dense lists (name/ext/size/date), active pane in ice, warm marks, Tab pane switch, Enter/Backspace navigation, Insert/Space marking, F-key bar rendered from a registry surface (fkeys) with a MINI per key, status line. | VK.filemanager.mount(el, {provider(path) → entries/Promise, left, right, rootLabel, surface: "fkeys", onOpen}) → {cd, up, refresh, getActive, getOther, getTargets, mark, clearMarks, setStatus, refreshKeys, switchPane, focus, destroy} |
| `card` | 5 | card.css card.js | base, core, focus, mini | Cards (title + mono id + minis, body, meta row, footer, status edge) and selectable tile grids (listbox, 2-D roving): tile, compact tile, program tile whose icon sits in a MINI meter for launch progress. | VK.card.create({title, id, minis, body, meta, footer, status}) → el · VK.card.tile({id, icon, title, sub, value, unit, kind, status}) → el · VK.card.tiles(el, {multi, activateOnClick, onSelect, onActivate}) → {getSelection, select, setState, update, destroy} |
| `inspector` | 5 | inspector.css inspector.js | base, core, mini | Key-value inspector: collapsible groups, mono values with units, inline edit (Enter/Esc, F2), copy value via a MINI (done/error), read-only (lock) and changed (warm dot) states; one tab stop. | VK.inspector.mount(el, {sections:[{title, collapsed, fields:[{key, label, value, unit, type, options, editable, readonly, changed}]}], onChange}) → {setData, set, get, getChanged, resetChanged, edit, destroy} |
| `diff` | 5 | diff.css diff.js | base, button, core, mini | Line diff (LCS; unified and side-by-side; + − ~ markers and colour, intra-line highlight, context folding, N/P J/K change navigation) and a drift list (expected vs actual) with per-kind counts in filter MINIs. | VK.diff.mount(el, {a, b, mode, labels, context}) → {setText, setMode, next, prev, getStats, destroy} · VK.diff.drift(el, {items, labels, show, onActivate}) → {setItems, filter, next, prev, getCounts, destroy} · VK.diff.lines(a, b) |
| `badge` | 6 | badge.css badge.js | base, core | State badges: lifecycle (használatban/kész/fejlesztés alatt/tervezett/ötlet) and run state (aktív/várakozik/parkolva/lezárva), each with its own glyph shape; outline/solid/dot variants, sm/md/lg; aktív pulses (still halo under reduced motion). | <span class="vk-badge" data-state="inuse/built/dev/planned/idea/active/waiting/parked/ended" data-variant="solid/dot" data-size="sm/lg">; VK.badge.create(state, {variant, size, label, glyphOnly}), VK.badge.set(el, state), VK.badge.STATES/LIFECYCLE/RUN |
| `signal` | 6 | signal.css signal.js | base, core | Signal markers ellentmondás/hiány/fagyott: inline marker, node-corner flag, count chip; own icon and own frame each (hatched / dashed / double). | VK.signal.marker(kind, text), VK.signal.flag(kind), VK.signal.flags(host, kinds), VK.signal.count(kind, n), VK.signal.setCount(chip, n) |
| `progress` | 6 | progress.css progress.js | base, core | Progress: linear bar (determinate, indeterminate, done/error/paused, tick scale, sizes), segmented, stepped with labels (vertical under 360 px), thin inline meter with warn/crit; role=progressbar/meter with aria-valuetext. | VK.progress.create({label, value/null, max, text, variant:"segments", segments, scale, size, unit}), VK.progress.set(el, value/null, {text, state}), VK.progress.meter({label, value, max, warn, crit, tone}), VK.progress.steps({label, steps, current, error}), VK.progress.step(el, i, {error}) |
| `loader` | 6 | loader.css loader.js | base, core | Loader sheet (own drawing, CSS): ring, dots, fade, ball, clock, bars; role=status + hidden text; a still meaningful frame under reduced motion; .vk-loader-sheet grid. | VK.loader.create(kind, {label, size:"sm/md/lg/xl", decorative}) |
| `toast` | 6 | toast.css toast.js | base, core, button, mini | Toast stack: info/ok/warn/error/activity, title+text+action, auto-dismiss counted down on the close MINI ring (pauses on hover/focus), Esc dismisses the focused toast, max N visible + queue, six positions, page or contained stack, activity toasts with progress. | VK.toast.show({kind, title, text, source, action, timeout, progress}) → {update, dismiss}; VK.toast.configure({position, max}), focusLatest(), clear(), count(); VK.toast.stack(container, opts) → same API. Suggested actions: toast.focus (Alt+T), toast.clear |
| `notify` | 6 | notify.css notify.js | base, core, focus, mini, actions, state | Notification board + RING: radial SVG timeline, peaks by time, height and cap shape by severity, warm activity / crit errors, read dashed; unread count in the centre; ring peaks and board items roving and linked by selection; Ma/Tegnap/Korábban groups; registry toolbar as MINIs; bell MINI. | VK.notify.mount(el, {items, now, span, toolbar, label, onSelect, onChange}) → {add, remove, markRead, markAllRead, clear, select, selected, items, unread, setFilter, filter, mini, refresh, destroy}. Suggested actions: notify.read, notify.readAll, notify.unreadOnly, notify.clear |
| `state` | 6 | state.css state.js | base, core, button, loader | Empty / loading / error blocks: reticle mark, mono code, title, text, primary + secondary action (registry ids); inline and panel sizes; error role=alert, loading role=status. | <div class="vk-state" data-kind="empty/loading/error" data-size="panel">; VK.state.create({kind, size, icon, code, title, text, action, secondary, loader}) |
| `readout` | 6 | readout.css readout.js | base, core, badge | HUD stat block (own drawing): corner brackets, micro label with №, big mono value, tick ruler with triangle marker and warn/crit zones (role=meter), cross-tally over a stacked bar, status list with badge glyphs; Papír theme gets a black title bar. | VK.readout.create({label, code, tag, tagTone, value, digits, unit, delta, min, max, warn, crit, ticks, tally, list}), VK.readout.update(el, partial) |
| `field` | 7 | field.css field.js | base, core | Form fields: label, help, error (aria-invalid + aria-describedby), required mark, text, number with mono unit suffix, textarea, native styled select, custom-drawn checkbox/radio (tri-state), prefix icon/text, readonly, disabled, inline vs stacked, fieldset, responsive form row grid. | CSS .vk-field/.vk-field__box/__input/__unit/__choice, .vk-fieldset, .vk-field-grid · VK.field.setError(input, msg/null), VK.field.tristate(parent, children), VK.field.mountAll(root) ([data-vk=tristate]), VK.field.number(input) |
| `question` | 7 | question.css question.js | base, core, button, mini | Decision cards: title, one line of context, lettered options A/B/C (A = Ajánlott), free-text Más option; letters choose, arrows move (radiogroup), Enter confirms; answered = one compact line; stack with progress MINI (2/4) and copy MINI producing 1A 2C 3B. | VK.question.mount(el, {questions:[{id,title,context,options,recommended,other,answer}], onAnswer, title}) → {answers, line, copy, focus, reopen, set, destroy}; suggested action question.copyAll |
| `rename` | 7 | rename.css rename.js | base, core, focus | Inline rename: F2 or double-click turns a label into an input in place (same metrics), stem selected without extension, Enter commits, Esc cancels, blur commits; empty/forbidden-char/duplicate validation in a popover tied by aria-describedby. | VK.rename.attach(listEl, {item, label, names(), validate(name), onCommit(item, name, old), onCancel}) → {start(item), destroy}; VK.rename.start(labelEl, opts) → {commit, cancel}; suggested action item.rename |
| `search` | 7 | search.css search.js | base, core, field, mini | Search field: clear button, Hungarian-folded matching (otodik → Ötödik), grouped results with counts and highlighted hits, ARIA combobox + listbox with aria-activedescendant, arrows/Enter/Esc, no-results state, recent searches, async provider shown on the search MINI. | VK.search.mount(el, {provider(q) → groups/Promise, recent, onPick(item, group, q), label, placeholder}) → {query, open, close, clear, recent, focus, destroy}; VK.search.match(q, text), VK.search.filter(items, q) |
| `chip` | 7 | chip.css chip.js | base, core, focus, mini | Chips: filter (aria-pressed, tick + ice frame, wire swatch), removable (Delete/Backspace, sensible focus), count chips, roving focus, + add chip opening an inline input; group MINI = active filter count, click resets. | VK.chip.mount(el, {label, chips:[{id,label,kind:filter/remove/count,pressed,count,color}], add:{label,validate,onAdd}, onChange, onRemove}) → {add, remove, get, set, pressed, reset, mini, destroy} |
| `slider` | 7 | slider.css slider.js | base, core, mini | Single and range slider (two non-crossing thumbs), ticks with labels, mono readout with unit, role=slider + aria-valuetext, arrows/PageUp/PageDown/Home/End, pointer drag, disabled, vertical variant; MINI shows position. | VK.slider.mount(el, {label, unit, min, max, step, bigStep, value / values:[a,b], ticks, labels, vertical, disabled, format, onInput, onChange}) → {get, set, disable, mini, destroy} |
| `toggle` | 7 | toggle.css toggle.js | base, core, mini | Switch (role=switch): label left/right, sizes sm/md/lg, disabled, busy (aria-busy, spinning warm arc while a Promise applies, clicks wait), error revert; MINI mirror. | VK.toggle.create({label, hint, checked, size, labelSide, disabled, block, onChange(on) → Promise/false}) · enhance(btn) · mountAll(root) · set(t, {checked, busy, disabled, error}) · get(t) · mini(t, {icon, caption}) |
| `chat` | 8 | chat.css chat.js | base, button, core, mini, actions | Agent side chat: header with status mini, role=log messages (prose, inline code, fenced mono code with copy mini), collapsible tool-call blocks, thinking indicator, auto-growing composer with attach mini and context chips; SEND mini turns into STOP/progress while streaming; empty state with suggested prompts. | VK.chat.mount(el, {agent, model, status, suggestions, chips, messages, onSend(text, {chips, instance}), onStop, onAttach}) → {add(msg), update(id, patch), stream(id, chunk), end(id), setBusy(on, progress), addChip, removeChip, chips, clear, focus, send, stop, setStatus, registerActions(prefix), destroy} |
| `context-tray` | 8 | context-tray.css context-tray.js | base, button, core, focus, mini, actions | "Küldés Claude-nak" tray: a selection becomes a context pack — chips (icon by kind, label, mono id) in a listbox with Alt+Arrow reorder and Delete, ~token estimate, Markdown/JSON preview, copy and send minis (progress), collapsed slim bar with count; follows document vk:selection. | VK.contextTray.mount(el, {title, format, collapsed, items, onSend(pack, tray), onChange}) → {add, set, remove, clear, move, items, pack(format), tokens, setCollapsed, setPreview, setFormat, setSending(p/null/"done"/"error"/false), copy, send, registerActions(prefix), destroy}; VK.contextTray.bindSelection(tray, resolver, {mode, accept}) → unbind; VK.contextTray.estimate(n) |
| `trace` | 8 | trace.css trace.js | base, button, core, focus, mini, actions | Agent activity trace: steps (planned → running → done/error) on a vertical rail of minis, nested collapsible tool calls with leader lines (args, result excerpt, mono duration), node state chips, timestamps, retry, filter (Összes/Eszközhívások/Hibák), auto-follow mini, run mini; role=log over a keyboard tree. | VK.trace.mount(el, {title, run, follow, steps, onSelect(step), onRetry(step), onRun}) → {add(step), update(id, patch), addTool(stepId, call), updateTool(stepId, toolId, patch), expand(id, open), setFilter, setFollow, setRun, clear, steps, registerActions(prefix), destroy} |
| `terminal` | 8 | terminal.css terminal.js | base, core, mini, actions | Console pane: role=log scrollback with token-mapped tones (ok/warn/crit/info/muted/accent/strong) and ANSI SGR, prompt with history, Tab completion hook, Ctrl+L, Ctrl+C, copy selection mini, running-command mini (progress), progress lines; commands are registry actions on a surface. | VK.terminal.mount(el, {title, tag, prompt, greeting, surface, onCommand(line, term), complete(value), onInterrupt, max}) → {print(text, tone), write(chunk, tone), progress(p, label) → {set, end}, setBusy(label, p), finish(state), interrupt, run(line), clear, copy, focus, history, isBusy, registerActions(prefix), destroy} |
| `phone` | 9 | phone.css phone.js | base, core, focus, button, mini, actions | Phone layout (360–430 px): app bar with registry minis, back stack, bottom nav of MINIs with progress, one FAB (a MINI), modal/non-modal bottom sheet (drag, Kibontás half/full, Esc, focus trap), safe-area insets (--vk-phone-inset-*), list rows, registry action rows, optional 390×844 device frame. | VK.phone.mount(el, {screens:[{id,title,render(params,app),parent,toolbar,fab}], nav:[{id,icon,label}], start, title, headingLevel}) → {go(id,params), back(), openSheet(el,{title,sub,modal,size}) → {el,body,close(),expand()}, setNav(id,{state,progress}), refresh(), current(), depth(), destroy()}; VK.phone.list(rows,{onOpen}); VK.phone.menu(surface,{onRun}) |
| `cyd` | 9 | cyd.css cyd.js | base, core, focus, mini | 320×240 embedded display (ESP32 CYD): 24 px header (title, pager dots, clock, link MINI), 2×3 / 3×2 / 3×1 big MINI tiles (actions, readouts, switches), pager zones, soft keys A/B/C mapped to physical buttons and a/b/c · 1/2/3, big progress ring, PASS/FAIL verdict, cells, toast; optional board mock (.vk-cyd-board) with LED and buttons; zoom via --vk-cyd-zoom. | VK.cyd.mount(frame, {screens:[{id,title,cols,rows,tiles:[{id,icon,label,sub,state,progress,value,unit,tone,toggle,checked,go,run,onToggle}]/render(body,cyd),keys:{a,b,c}}], start, clock, link, label, onScreen}) → {go, next, prev, key(k), setTile, setKeys, setLink, led, toast, announce, zoom(z), focus, current, destroy}; VK.cyd.ring(o) / setRing(el,o) / read(o) |
| `emblem` | 10 | emblem.css emblem.js | base, core | Program large logo: kicker, condensed name, sprite glyph, date and readout above a seeded isometric diorama on a plinth (planner/mindmap/inventory/calculator/city/hub); day phase on light grounds, night with warm lit windows on dark; hero/tile/mini sizes. | VK.emblem.render(el, {kind, name, kicker, glyph, date, readout, seed, size:"hero"/"tile"/"mini", activity, level}) → {update(patch), destroy()}; VK.emblem.kinds |
| `citymap` | 10 | citymap.css citymap.js | base, core, focus, actions, mini | Generative city map on canvas from a seed or data rows [{name,size,heat,group}]: figure-ground, transit (octilinear pipelines, ring hubs, moving jobs) and iso styles; organic commit-by-commit buildup with a play/pause MINI; keyboard pan/zoom/play/reseed; registry actions citymap.*. | VK.citymap.mount(el, {style:"figure"/"transit"/"iso", seed, data, grow, commits, label}) → {setStyle, reseed, play, pause, toggle, step, zoom, pan, fit, setData, state, destroy} |
| `micro` | 10 | micro.css micro.js | base, core | Micrographics: corner-bracket frame, tick ruler, crosshair, dot matrix, segmented meter (role=meter), coded chips, hex badge, callout card with leader line, beacon light columns. | CSS .vk-micro-frame/-ruler/-cross/-dots/-meter/-chip/-hex/-callout/-beacon; VK.micro.ruler(el,o), dots(el,o), meter(el,v,o), chip(parts,o), callout(host,{target,title,rows,side}) → {update,setTarget,destroy}, beacon(host,{x,y,h}) |
| `textures` | 10 | textures.css | base | Texture pack from token colours (gradients only, background-color untouched): hatch, crosshatch, dots, grid, blueprint, windows (warm lit), water, road-glow, sand. | CSS .vk-tex-hatch/crosshatch/dots/grid/blueprint/windows/water/road-glow/sand; knobs --vk-tex-ink, --vk-tex-gap, --vk-tex-warm |
<!-- index:end -->

## 6 · Verification (what was run, and the result)

Run on 2026-11-04, headless Chromium (Playwright), `NODE_PATH=$(npm root -g) node test/verify.js`:

| Check | Result |
|---|---|
| Contrast | 67 token pairs × 4 themes meet WCAG AA (text 4.5:1, UI marks and focus ring 3:1). This includes selected rows, pressed controls, glass, solid badges, every wire layer and the terminal. |
| No literal colours | `test/lint.js`: 0 errors across 102 component files, the gallery and `actions.js`. Every `var(--vk-*)` is a defined token. |
| Offline | `gallery.html` from `file://` with all network blocked: 0 requests and 0 console errors in all 4 themes. The vendored fonts load, with ő ű Ő Ű. |
| Keyboard-only | Tab walk of the whole gallery: 353 stops, every one with a visible ring, no traps, every section reached. `Shift+ArrowDown` hops regions, and Ctrl+K focuses the palette input. Each family's builder also ran its own keyboard script, 30–190 assertions each, all passing. |
| 320×240 | The CYD frame is exactly 320×240, every target is ≥ 36 px (40 px by design), all text ≥ 11 px, and nothing overflows. Every family was also audited at 390×844 and 320×240 in touch density, and the findings were fixed. |
| `inline.js` bundle | `table palette badge toggle mini --fonts` builds one file of about 290 kB. It boots offline; Ctrl+K → "orsz" → Enter runs "Őrszem indítása". |

The adversarial pass found and fixed:

- two keyboard traps (the file-manager Tab and the terminal Tab completion);
- region hopping that preferred far-away small regions;
- a `$'` corruption in fragment insertion;
- focus-trap wrap and scroll jumps;
- editing shortcuts firing inside text fields;
- density being applied after mount;
- small-screen overflow in the shell, the cheat sheet, the menubar and the placement controls;
- touch targets in the timeline, heatgrid, notify ring and table minis.

## 7 · Known gaps

- **Graph:** no node dragging or editing, no pinch zoom, and no obstacle-avoiding routes. At fit-to-view on a
  phone, nodes are below touch size; zoom and the keyboard path work.
- **Citymap:** no per-building hit testing. In iso view, large rotated lots can be drawn in the wrong order.
- **Table and terminal:** no virtualisation (comfortable up to about 2,000 rows).
- **Agent surfaces:** chat markdown is minimal. The trace's retry button isn't on the Tab path (the R key does
  the same job).
- **Small fixes:**
  - The search clear button is mouse-only (Esc clears).
  - Ctrl+W is taken by the browser in a normal tab.
  - The floating toolbar is moved with a pointer only (keyboard users pick a docked position).
- **The Papír terminal** stays dark on purpose. Its tones are the `--vk-term-ok/warn/crit/info/muted` tokens
  (decision 5A), set in every theme and checked for AA against the terminal background.

## 8 · Decisions (answered 2026-11-04)

The user's answers to the open questions: `1A 2A 3A 4A 5A 6B 7B 8A` (8B only as a fallback).

| # | Question | Decision | Where it stands |
|---|---|---|---|
| 1 | First app to adopt the kit | **A — Kapu**, the closest to the VRG Desktop shell | Done: `Hub/src/index.html` (GO HUB, 2026-11-04) |
| 2 | How apps take the kit | **A — `inline.js --insert`** with the component list recorded in the marker, plus `--sync-app` / `--check-app` | Done (§1) |
| 3 | Keeping Mélyvíz in sync | **A — `tools/melyviz-sync.js` also generates `theme-melyviz.css`** | Done (§3) |
| 4 | Default theme | **A — Éj**; Mélyvíz chosen per app | Already so |
| 5 | Terminal tones in Papír | **A — `--vk-term-*` tokens** in every theme | Done (§3) |
| 6 | Fonts in single-file apps | **B — always inline** (`--no-fonts` to opt out) | Done (§1) |
| 7 | START registry | **B — add it now**: key **B** (was D until 2026-11-10, DESKU-Q01), "VRG UI Kit galéria", in `launcher/vrg-menu.json`; Kapu rebuilt | Done |
| 8 | Graph editing | **A — in the GO ROUTE Topology View work**, where the real editing rules live; a generic kit version (B) only if that work doesn't produce one | Later |
