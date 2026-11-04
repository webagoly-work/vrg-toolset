# VRG UI Kit — component conventions (the contract every component follows)

Read this before writing or changing a component. The README tells an app how to *adopt* the kit;
this file tells a builder how to *extend* it.

## Files and naming

- One component = `components/<name>.css` and optionally `components/<name>.js`. `<name>` is
  lower-case, one word or hyphenated (`context-tray`). Nothing else in the file system is shared.
- CSS classes: BEM-ish under `vk-<name>`: `.vk-table`, `.vk-table__cell`, `.vk-table--compact`.
  State through ARIA or `data-*` (`[aria-selected="true"]`, `[data-state="running"]`), not `.is-*`
  classes (the one exception: `.is-on` mirrors `aria-pressed` where ARIA can't be used).
- JS: one IIFE that attaches to `window.VK.<camelName>` (copy the header of `components/mini.js`).
  It must work as a classic `<script>` **and** as an ES-module side-effect import, so: no `import`,
  no `export`, no top-level `const`/`let` outside the IIFE, and `if (VK.<name>) return;` at the top so
  a double include is harmless.
- **No work at load time** except defining functions. Mount with an explicit call:
  `VK.table.mount(el, opts)` → returns an instance `{ update(), destroy(), … }`. Prefer progressive
  enhancement: markup that already reads correctly without JS, JS that adds keyboard/behaviour.
  Declarative auto-init is allowed only through an explicit `VK.<name>.mountAll(root)` that looks for
  `[data-vk="<name>"]`.
- Dependencies are **explicit**: if `table.js` calls `VK.focus.roving`, the manifest entry lists
  `focus`. Never rely on a component that isn't in your `deps`.

## Tokens only

- Components use `var(--vk-*)` for every colour, radius, space, shadow, font, size and duration.
  **No literal colours** anywhere in `components/` (no `#hex`, `rgb()`, `hsl()`, named colours).
  Allowed keywords: `transparent`, `currentColor`, `inherit`, `none`. `color-mix(in srgb, var(--vk-x) 20%,
  transparent)` is fine. Masks may use `currentColor` as the opaque value.
- Canvas/SVG drawing in JS reads colours with `VK.token('--vk-accent')` at draw time (themes switch
  live; redraw on the `vk:theme` event the gallery fires on `document`).
- Status meaning goes through the alias tokens (`--vk-st-*`, `--vk-sig-*`, `--vk-wire-*`), never a raw hue,
  so the meaning map lives in one place (`tokens/base.css`).
- New tokens are not added by builders. If you truly need one, use a component-local custom
  property defaulting to an existing token (`--vk-table-stripe: var(--vk-hover-bg)`) and say so in your report.
- Run `node test/lint.js` — it fails on literal colours and on unknown `--vk-*` names.

## Visual language (synthesised direction "Mérőpult" — see README §Design)

- Near-black ground, white hairlines (`--vk-line`, `--vk-line-strong`), colour only where it means
  something. Two temperatures: **ice `--vk-accent` = the instrument and you** (selection, focus,
  playhead, "you are here"); **warm `--vk-activity` = the system working** (running, heat, recent work).
  Never swap them.
- Readouts, numbers, ids, paths, keys: `--vk-font-mono` + `.vk-num`. Titles: `.vk-title` (condensed voice,
  uppercase). Tiny labels: `.vk-label` (mono, uppercase, tracked) — the "micrographics" voice:
  `MODULE-D9`, `[01]`, `CH 04 // AKTÍV`.
- Graph glyphs: **filled dot = node, hollow diamond = junction/decision, small square = terminal/endpoint**.
  Wires bend with rounded corners ("metro") or curve; typed by `--vk-wire-*` / `--vk-layer-*`.
- Panels: `--vk-surface-1` + `--vk-line-strong` 1 px border; floating layers (palette, menus, HUD) use
  `.vk-glass` + `--vk-shadow-overlay`. `.vk-cut` chamfers a panel's two corners — use it for focal
  panels only (it clips focus rings, so never on a focusable element itself).
- Radii come from tokens (Mélyvíz sets them to 0). No drop shadows except `--vk-shadow-overlay`.

## The MINI rule (from the user: crucial)

**Every feature has a mini version: one small icon that doubles as its button and its progress
indicator.** Use `components/mini.css` + `mini.js` for any feature trigger that can be running, done,
failed, waiting or toggled: toolbars, status bar items, panel headers, node badges, agent steps, sync,
export, build. `VK.mini.fromAction(id)` renders a registry action as a mini (`action.progress`,
`action.state`, `action.checked`). A plain `.vk-btn` is for verbs without state (OK, Mégse).

## Actions

- Any user-facing verb is a registry action (`actions.js`). Surfaces read the registry; they do
  not keep their own lists. Surface ids: `palette`, `menu:<context>`, `toolbar:<id>`, `statusbar`.
- Components that *offer* commands (menu, toolbar, palette, status bar) take a surface id and render
  `VK.actions.forSurface(id)`. Components that *are* content (table, graph) expose their verbs as
  actions the app registers (document them in the component header with suggested ids).

## Keyboard and ARIA (keyboard-first)

- Everything works without a mouse. Composite widgets use one tab stop + arrows
  (`VK.focus.roving`); modal layers trap focus (`VK.focus.trap`) and close on Esc, restoring focus.
- Regions that a user would jump between (panels, docks, sections, panes) carry `data-vk-hop`:
  `Shift+Arrow` hops between them (`VK.focus.enableHop()` once per page). Inside a text field,
  Shift+Arrow is left to text selection.
- Use real roles: `grid`/`row`/`gridcell`, `tree`/`treeitem`, `tablist`/`tab`/`tabpanel`, `menu`/`menuitem`,
  `listbox`/`option`, `dialog`, `status`/`log` (live regions for toasts and traces), `toolbar`, `separator`
  (with `aria-valuenow` for splitters), `slider`, `switch`, `radiogroup`.
- Visible focus everywhere: rely on the base ring (`--vk-focus`); never `outline: none` without a
  replacement. Inside dense widgets an inset ring (`outline-offset: -2px`) is fine.
- No hover-only actions: anything revealed on hover is also revealed on `:focus-within` and is
  always visible in `[data-vk-density="touch"]`.
- `prefers-reduced-motion`: durations come from `--vk-dur-*` (already 1 ms under reduce); JS
  animations check `VK.reducedMotion()` and render one still frame.

## Density and small screens

- Sizes come from `--vk-control-h`, `--vk-row-h`, `--vk-icon-size`, `--vk-space-*`, `--vk-fs-*`,
  `--vk-target-min`, so comfortable / compact / touch work without component-specific rules.
  Every hit target ≥ `--vk-target-min`.
- At `[data-vk-density="touch"]` (phones, 320×240 CYD boards) the component must stay usable in a
  320×240 box: no fixed widths over 320 px, no hover dependence, text ≥ `--vk-fs-xs`.

## Language

UI text Hungarian, identifiers English. Sample data uses job codes (`VRG-2611-03`), never client names.
Make sure ő ű Ő Ű appear in your samples (e.g. "Kötőelem", "Hűtő", "Erősáram", "Űrlap", "Ősszeg").

## Gallery fragment

Each family owns `gallery/NN-<family>.html` (NN = 01…10). Format:

```html
<section class="g-sec" id="f03" data-vk-hop aria-labelledby="f03-h">
  <header class="g-sec__head">
    <span class="g-sec__num">03</span>
    <h2 id="f03-h" class="vk-title">Gráf és topológia</h2>
    <p class="g-sec__lead">Egy mondat arról, mit fed le ez a család.</p>
  </header>
  <article class="g-demo" id="f03-graph">
    <h3 class="g-demo__title">Csomópontok és vezetékek <code>graph</code></h3>
    <p class="g-demo__note">Billentyűk: …</p>
    … live demo markup …
  </article>
</section>
<script data-g-init>
  // runs after every kit script has loaded; use VK.* freely. Wrapped in try/catch per fragment.
</script>
```

Show **every state** (default, hover-equivalent via a static class only if the component offers one,
focus, selected, disabled, empty, loading, error) with Hungarian labels. `node gallery/build.js`
assembles `gallery.html`; `node gallery/build.js --only 03 --out <file>` builds a test page with just
your fragment.

## Manifest entry

Each component has one entry in `manifest.json`:

```json
{ "name": "table", "files": ["components/table.css", "components/table.js"],
  "deps": ["base", "focus"], "families": [5], "icons": ["sort-asc", "sort-desc"],
  "tokens": ["--vk-surface-1", "--vk-line", "--vk-select-bg", "…every --vk-* the files read"],
  "summary": "Dense table: sort, filter, sticky header, Ctrl/Shift row selection, keyboard grid.",
  "api": "VK.table.mount(el, {columns, rows, onSelect}) → {setRows, select, destroy}" }
```

`tokens` lists every token the component reads (`node test/lint.js --tokens components/x.css` prints them).
