# Fényjel — the VRG signal design system

*2026-11-25. The successor look for the user-facing shells: the VRG Mobile home and controller, the VRG Asztal
home, and every feature page behind them. Files: `fenyjel.css` (tokens + components), `icons.js` (pixel icons and LED
numerals, one source for web and phone), `fonts/`, `board.html` (the three screens and every part, live).*

## 1. Why a new system

The brief, in the Founder's words, and what each point became:

| What was wrong | What Fényjel does |
|---|---|
| The background is too mono; the darks show no depth | A lit ground (key light from above, vignette at the edges, a faint dot grid) and five stacked planes with a lit top rim and a real shadow (§3) |
| Monochrome palettes go stale and messy; nothing draws the eye | Eight **function families**, one colour each. Colour appears only where it means something, so it is never wallpaper and never missing (§4) |
| Too many words for too few visual things | The face of every screen is glyphs plus one word. Descriptions live behind the **i** button or inside the feature (§7.5) |
| App icons are generic and clash with everything else | One 12×12 **pixel icon** grid for every feature, coloured by family, drawn from one source for web and phone. No emoji anywhere (§5) |
| Every page looks the same | A feature page takes its family's colour (`data-fj-family`): header glyph, buttons, meters, focus. Készlet is amber, Légegér violet, Radar rose (§7.4) |
| The look wanted | 8-bit pixel and dot-matrix, Fallout-terminal digital: VT323 terminal type, 5×7 LED numerals, LEDs, dot meters, thin HUD line work with corner brackets, dark and sharp but quiet |

How it was made: the brief, the repo's own systems (Mélyvíz M1–M6, the UI Kit "Mérőpult", Grafit), and the design
plugins added on 2026-11-24 as references. `frontend-design` (avoid template defaults, spend boldness in one place),
`design-superpowers` (style recipes, colour theory, token architecture), `design-skills` (design-systems and critique
heuristics) and `dashboard-design` (start a dashboard from the questions it answers) informed the choices; no plugin
code is used.

## 2. Six rules

1. **Picture before word.** A tile is a glyph and one word. A card is a glyph, a title and at most one line. Anything
   more is behind the **i** button or inside the feature.
2. **Colour is meaning.** Every colour on screen is either a function family (what this thing does), a status (ok,
   warn, crit, always with a shape) or the white signal (you are here). Nothing else is coloured.
3. **The dark has depth.** Lit ground, stacked planes, a 1 px lit rim on top, real shadow below. No flat fills.
4. **Thin, sharp line work.** One radius (3 px). Corner brackets instead of full boxes on focal planes. Hairlines only
   where two regions meet.
5. **State is shape plus colour.** LEDs (3×3 dots) and dot meters, always next to a number or a word. A status
   colour never paints an icon.
6. **The console sits beside the machine.** The controller is always in the same place: a dock tab on the phone, the
   right column on the desktop.

## 3. Depth

| Plane | Token | Value | Use |
|---|---|---|---|
| Void | `--fj-void` | `#04070a` | screen edge, wells (console, search field), the vignette |
| Ground | `--fj-floor` | `#091018` | the page |
| Light on the ground | `--fj-floor-lit` | `#13202c` | a radial key light from above the top edge |
| Panel | `--fj-deck` | `#0e1720` | a plane resting on the ground |
| Raised | `--fj-lift` | `#152230` | the top of a plane's gradient, a socket's face, hover |

Every plane gets `inset 0 1px 0 var(--fj-rim)` (the lit top edge), `inset 0 0 0 1px var(--fj-hair)` and
`var(--fj-shadow)`. A plane that belongs to a feature (`.fj-plane--hue`) glows faintly from below in its family
colour. The ground carries a dot grid at 7 % that fades out toward the edges, and the ground under a feature page
picks up 7 % of its family colour at the bottom. Floating layers (dock, sheets) are `.fj-glass` with a 14 px blur.

## 4. Colour

### 4.1 Function families

What a thing does decides its colour, wherever it appears. Contrast is measured against panel `#0e1720`: every
family colour reaches at least 7.3:1 there and 6.5:1 on the raised plane, so all of them work as text.

| Family | Token | Hex | Members (Mobile feature id · Desktop tool) |
|---|---|---|---|
| Tervezés (Plan) | `--fj-f-plan` | `#5cc8f5` | VRG Sketcher `sketch`, Fotópont `photo`, Varler Planner `planner`, VRG Térkép `map` · Topológia, Mérés |
| Anyag és pénz (Stock) | `--fj-f-stock` | `#f5b94a` | Készlet `inventory`, Kalkulátorok `calc`, Varler Workflow Kit `workflow` · árajánlat, BuildTree |
| Kapcsolat (Link) | `--fj-f-link` | `#b393ff` | Légegér `airdeck`, Párosítás `pair`, Képernyő `screen`, Átadás `drop`, Hálózat `net`, Eszközök `devices`, PC ablakok `pcwin`, Óra `watch` |
| Tudás (Know) | `--fj-f-know` | `#5ee6c0` | Gyorsjegyzet `notes`, Füzet `fuzet`, Rétegverem `stack`, Archívum `archive`, Gömb `sphere`, Claude `claude`, Katalógus `catalog`, Böngésző `web` · MindMap, CoreRef, BRIDGE |
| Futtatás (Run) | `--fj-f-run` | `#c3ea5c` | Indítópult `launch`, Alkalmazások `apps`, Localhost `ports`, Kódváros `city`, Haladás `pulse`, Asztal `desk`, Lapok `sheets`, DevLap `devlap` · terminál, Git, START |
| Jelzés (Alert) | `--fj-f-alert` | `#ff7a9a` | Értesítések `inbox`, Csipogó `pager`, Radar `radar`, Tárgykereső `tag` |
| Környezet (Ambient) | `--fj-f-env` | `#7ea2ff` | Időjárás `weather` · idő, helyszín |
| Rendszer (System) | `--fj-f-sys` | `#a9b7c4` | Beállítások `settings`, GitHub fiók `account`, Frissítés `update`, Széf `vault` |

A new feature joins a family; it never gets its own hue. If nothing fits, that is a design question for the Founder,
not a ninth colour.

### 4.2 Status and signal

| Token | Hex | Rule |
|---|---|---|
| `--fj-ok` | `#4ee38a` | LEDs, meters, console marks only; always with a glyph (✓) or word |
| `--fj-warn` | `#ffd24a` | same; a meter over its limit turns warn |
| `--fj-crit` | `#ff4f61` | same; the crit LED blinks (still under reduced motion) |
| `--fj-off` | `#3a4a57` | an unlit LED |
| `--fj-signal` | `#f4fbff` | you are here: the active dock slot, focus, the open family in the rail |

Status hues sit near three family hues (ok/know, warn/stock, crit/alert). They never collide in practice because
families paint glyphs, sockets and page accents, and statuses appear only as LEDs, meters and console marks, always
with a shape.

### 4.3 Ink

`--fj-ink #e6eef3` (15.4:1), `--fj-ink-2 #93a5b2` (7.1:1, secondary text), `--fj-ink-3 #5d6e7b` (3.4:1: decoration,
captions of decoration, never information).

## 5. Iconography

- **One grid:** 12×12 pixels, two tones: `#` lit, `+` dim (opacity `--fj-px-dim`, .4), `.` off. One idea per glyph,
  a 1-pixel outline where a shape needs one, at least one solid mass so it reads at 24 px, no letters inside.
- **One source:** `icons.js` holds every glyph with its family. The web draws SVG from it
  (`FJIcons.svg(name, {mode})`). VRG Mobile gets the same grids as data: `tools/kotlin-icons.js` writes kit-core
  `PixelGlyphs.kt` (glyphs + family colours; `--check` runs in CI and `mobile.cmd test`), kit `ui/PixelIcon.kt` draws
  them on a Compose canvas, and kit-core `FeatureIcons.kt` maps every catalogue feature to its glyph
  (`FeatureIconsTest` keeps all three in step). Never redraw a glyph per platform.
- **On the other palettes:** until the phone wears Fényjel itself (R2), a glyph keeps its family colour on every dark
  palette and is pulled 45 % toward black on the light ones (Papír, Sekély víz) so it keeps its contrast; "ui" glyphs
  take the palette's ink.
- **Three renderings:** `px` (default: square pixels with a hairline gutter, a modern LED matrix), `solid` (gapless
  pixel art, for very small sizes) and `dot` (round LEDs, for displays and the splash).
- **The socket:** a glyph sits in a lit well (`.fj-socket`) that glows in its family colour behind the glyph. Sizes:
  96 (focus card), 64 (phone tile), 68–72 (desktop tile), 56 (action row), 40–44 (rail, card head).
- **No emoji.** The current Mobile catalogue's emoji glyphs (📟, 📈, 🗁 …) are replaced one for one.
- **48 glyphs today:** home, control, search, info, back · planner, sketch, map, measure, photo · inventory, calc,
  quote · mouse, pair, screen, drop, net, devices, pcwin, watch · notes, fuzet, stack, archive, sphere, claude, catalog, web ·
  desk, sheets, devlap, apps, launch, ports, terminal, city, git, pulse · pager, inbox, radar, tag · weather ·
  settings, account, update, vault.

### 5.1 Numbers

Numbers never use a font. Clocks, gauges and counters are drawn on the 5×7 LED grid (`FJIcons.digits('14:32')`,
class `.fj-digits`, 1 em high, unlit dots at 10 %). A pixel font's 2 and 5 blur into Z and S at small sizes; the LED
grid never does.

## 6. Type

| Role | Face | Use |
|---|---|---|
| Terminal voice | VT323 (`--fj-font-pixel`, "FJ Term", OFL) | titles 26, tile labels 16, buttons 18, server names 18. Sets small on its em: size it about 1.25× a sans |
| Display | Doto 800 (`--fj-font-dot`, "FJ Dot", OFL) | one moment per screen at most: a hero word, a splash |
| Body | Inter (`--fj-font-sans`) | sub-lines, sheets, settings text, 13–14 px |
| Readout | JetBrains Mono (`--fj-font-mono`) | ports, paths, console, small values, 12 px |
| Numbers | LED digits (§5.1) | every number that matters |

Sentence case everywhere; no tracked uppercase labels (the terminal face carries the character on its own).
Pixelify Sans was tried first and dropped: its capital C reads as O ("Csatlakozás").

## 7. Layout logic

### 7.1 Phone: Kezdőlap

```
┌───────────────────────────────┐
│ 14:32  szerda        ▪▪ ▪▪ ▫▫ │  status rail: LED clock · PC, relay, GitHub LEDs. No text labels.
│ ┌───────────────────────────┐ │
│ │ ▣  Kovács lakás        (i)│ │  focus card: the ONE thing to continue (last job/feature),
│ │ [Folytatás] ••••••··· 62% │ │  in its family colour, corner brackets, one primary action.
│ └───────────────────────────┘ │
│  ▣    ▣    ▣    ▣             │  4 × 3 glyph tiles, one word each, ordered by family so the
│  ▣    ▣    ▣    ▣             │  colours fall into bands; a running feature shows a lime corner
│  ▣    ▣    ▣    ▣             │  dot, a count shows a rose badge.
│            ━ · ·              │  pages (swipe): user-arranged.
│ ⌂    ⌘    [⌕]    🔔    ⚙     │  dock: Kezdőlap · Vezérlő · Keresés (centre) · Jelzések · Beállítások
└───────────────────────────────┘
```

Compared with today: the long scrolling tile list with descriptions goes; descriptions move behind **i**; the
dock replaces the top bar actions; search is the centre of the dock.

### 7.2 Phone: Vezérlőpult (console)

The PC's console on the phone, a dock tab of its own:

1. **Head:** the PC (glyph, name, LED, link and latency), **i** for details.
2. **Gauges:** CPU, memory, disk, network: glyph, dot meter, LED number. Over a limit the meter and number turn warn.
3. **Actions:** four big sockets (Egér, Képernyő, Átadás, Zárolás), one word each.
4. **Servers:** START's servers as rows: family LED, name, port, switch. A switch starts or stops it.
5. **Console:** the last lines of the relay log and a prompt.

### 7.3 Desktop: VRG Asztal home

```
┌──┬──────────────────────────────────────────────┬───────────────┐
│⌂ │ 14:32  szerda          [⌕ Keresés …  Ctrl K] │ ▣ Ez a gép    │
│··│ ┌──────────┐ ┌──────────┐ ┌──────────┐       │ gauges        │
│▣ │ │continue 1│ │continue 2│ │continue 3│       │ servers       │
│▣ │ └──────────┘ └──────────┘ └──────────┘       │ console       │
│▣ │  ▣  ▣  ▣  ▣  ▣  ▣  ▣  ▣                      │               │
│… │  ▣  ▣  ▣  ▣  ▣  ▣  ▣  ▣                      │               │
│⚙ │                                              │               │
└──┴──────────────────────────────────────────────┴───────────────┘
```

Left: the family rail (one glyph per family; picking one filters the grid; the open one is lit). Centre: LED clock,
search, three continue cards, the program grid. Right: the machine's console column, the same parts as the phone's
controller.

### 7.4 A feature page

`data-fj-family` on the page root. Head: socket with the feature glyph, title, one sub-line, **i**. Body: the
feature's own content, using `.fj-btn` (one solid primary action per screen), `.fj-meter`, `.fj-switch`, `.fj-led`,
all following `--fj-hue`. The ground under the page picks up its colour faintly.

### 7.5 The i button

Every card, tile group and page head may carry **i** (`.fj-i`): it opens a sheet (glass, from the bottom on a phone,
a popover on a desktop) with the description, the facts, the help text that used to be printed on the face. If a
screen needs a sentence to be understood without **i**, the screen is wrong, not the rule.

## 8. Components

| Class | What |
|---|---|
| `.fj-ground` | the lit, vignetted page ground with the fading dot grid |
| `.fj-plane` · `--flat` · `--hue` | a panel; flat (no shadow) for lists; hue (glows in its family) for focal cards |
| `.fj-glass` | floating layer (dock, sheet) |
| `.fj-brackets` · `--hue` | four HUD corner brackets |
| `.fj-socket` · `--lg` `--sm` `--bare` | the lit well a glyph sits in |
| `.fj-tile` (`data-state="run"`, `data-badge`) | socket plus one word |
| `.fj-i` | the info button |
| `.fj-led` (`data-s="ok warn crit hue"`) | 3×3 dot LED |
| `.fj-meter` (`--v`, `data-s`) | dot meter |
| `.fj-digits` | LED numerals (from `FJIcons.digits`) |
| `.fj-btn` · `--solid` | thin-line button; solid = the one primary action |
| `.fj-switch` (`role="switch"`, `aria-checked`) | square toggle |
| `.fj-console` | the terminal well |
| `.fj-dock` (`aria-current="page"`, `.fj-dock__main`) | phone dock |
| `.fj-title` `.fj-sub` `.fj-pixel` `.fj-display` `.fj-mono` | type roles |

## 9. Where it stands with the other systems

- **Fényjel** is for the shells a person uses every day: the Mobile home and controller, the Asztal home, the feature
  pages behind them.
- **Mélyvíz** stays for the dev-side tools until each one is moved; **Grafit** stays a calm alternative palette.
- **The VRG UI Kit** stays the component library; Fényjel is a separate token set (`--fj-*`) for now, so adopting it
  is per app. Once R2 lands, the kit gains a `fenyjel` theme that maps these tokens onto `--vk-*`, the same way
  Mélyvíz is mapped.

## 10. Rollout

| Step | What | Where |
|---|---|---|
| R0 | This spec, tokens, icons, fonts, the board | `shared/fenyjel/` (done 2026-11-25) |
| R1 | Icons on the phone: `tools/kotlin-icons.js` → kit-core `PixelGlyphs.kt`, kit `PixelIcon`, `FeatureIcons` for all 38 features; the home cards and grid, plugin chips, long-press menus, planned page, update mark, Katalógus, Asztal and Lapok draw them instead of the emoji (done 2026-11-25) | Mobile `kit`, `app` |
| R2 | Phone: the Fényjel palette (VT323 + Doto as Android fonts); picking it turns the home into the Fényjel shell (`app/FenyjelShell.kt`): status rail, Kezdőlap (focus card, HomeLayout pages as 4-column glyph grids, one-word labels), Vezérlőpult (PC link and uptime, CPU / memory / disk from the relay's new `sys.stats`, four action sockets, START servers with switches, the log console) and the dock. Parts in kit `ui/Fenyjel.kt` (done 2026-11-25) | Mobile `app`, `kit`, relay `relay-sys.js` |
| R3 | Phone: under Fényjel every feature page wears its family colour (kit `Palettes.forFeature`: the accent becomes the family hue, the ground takes a trace of it; the shell applies it while a feature is open). Kit `FeatureTop` gives a page its header (back glyph, socket, terminal title, **i** → a sheet with the description, stage and needs) and draws the old rows on every other palette; `FjBlurb` hides on-face descriptions under Fényjel. On it: Claude, Átadás, Értesítések, Indítópult, Hálózat, Localhost, Haladás, Radar, Tárgykereső, Óra, Gyorsjegyzet, Képernyő, Kódváros. The other pages (their own headers: Csipogó, PC ablakok, Gömb, Időjárás, Légegér, Vázlat …) get the colour now and the header as each is next touched (2026-11-25) | kit, `feature-*` |
| R4 | Desktop: a third look, `ui.look` = `fenyjel` (palette command *Megjelenés: Fényjel*, the toggle cycles Mélyvíz → Grafit → Fényjel). Under it the Irányítópult view becomes the 7.3 home (`page/fenyjel-home.js`): the family rail (home + the eight families filter the grid), the LED clock and date, the search field that opens the palette, the level switch, up to three continue cards (open jobs with their step meter, then lines waiting on you), every openable catalog item outside Rendszer as a glyph tile in family order with one word, and the console column (this PC from the new `desktop.sys` = the relay's `relay-sys.js` sampler, polled every 3 s; START's servers with switches through the new `desktop.serverStart` / the existing stop; the toasts as a console log). `fenyjel-home.css` also maps the frame's Mélyvíz tokens to Fényjel, so the panes and dialogs take the palette. Test `wp-58` (done 2026-11-25) | `Dashboard/page`, `shell/main.js` |
| R5 | Desktop: the shell chrome in Fényjel (`page/fenyjel-chrome.css`, `fenyjel-chrome.js`). The ground is lit from the top with a faint dot screen; the title bar and the top strip are void and deck planes with 3×3 LED dots; the dock is a shelf of glyph sockets, each in its family colour, with a lit dot row under a running program, and its open windows show the glyph of what they hold. A window is a lit plane with HUD corner brackets: its head carries its glyph and a VT323 title, and on focus the edge, the brackets and a soft glow take its family colour (a catalog item's family, else its pane kind's). The tiled frame's groups and tabs, the split handles, the palette and quick bar (dark glass, pixel input), the sheets, the ask box, toasts (a LED edge), jobs, scrollbars and the corner dials follow. The glyphs come and go with the look, and the other looks keep their monograms. Test `wp-59` (done 2026-11-25) | `Dashboard/page` |

Each step is a reviewable change on its own; nothing in R0 changes a running app.
