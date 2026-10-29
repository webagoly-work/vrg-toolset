# Mélyvíz rollout — the dev-side apps (2026-10-27)

Mélyvíz (`docs/city/melyviz.md`) leaves Kódváros and becomes the style of every dev-side app. Client material
(offers, Tervezet, brochure, client preview) stays **VRG Title Card**.

## Decisions (2026-10-27)

| # | Question | Answer |
|---|---|---|
| R-1 | Which apps besides Planner, MindMap, Calculator, Workflow Kit | + Data tools (Inventory, BuildTree, Vendor), Front doors (Kapu, toolbox.html, Valena), BRIDGE pages. **Not** the firmware pages (Board Console, CYD settings). |
| R-2 | Workflow Kit | Internal / review pages only. Offers, Tervezet and their golden HTML sources stay as they are; the golden checker must still pass. |
| R-3 | Token source | One file, `shared/melyviz.css`, copied into each app by `tools/melyviz-sync.js` (`--check` gates drift). |
| R-4 | Planner depth | Chrome only: panels, toolbars, dialogs, type. The drawing canvas, symbol and circuit colours keep their meaning and stay. |

## How it is shared

- `shared/melyviz.css` holds `--mv-*` tokens, an **opt-in base layer** (`html.mv`, wrapped in `:where()`, so it has
  zero specificity and any app rule wins) and component classes: `.mv-glass` `.mv-solid` `.mv-cut` `.mv-title`
  `.mv-label` `.mv-btn` `.mv-on` `.mv-live` `.mv-badge`. Print falls back to paper.
- Each app carries a copy between `/* melyviz:begin */` and `/* melyviz:end */` in its own first `<style>`.
  Built apps (Planner, Inventory, Kapu) have the markers in their src; the build carries them into dist.
- `node tools/melyviz-sync.js` writes every copy; `--check` exits 1 on drift, a missing file or missing markers.
  Register each adopted file in `TARGETS` inside the script.

## Recipe per app

1. `<html … class="mv">`, and an empty `<style>/* melyviz:begin */ /* melyviz:end */</style>` before the app's own style.
2. Map the app's own `:root` variables onto `--mv-*` instead of renaming them, so every existing rule picks the skin up.
   Decide each accent by **M1**: something you set or select → `--mv-accent` (ice); something running, live or recent →
   `--mv-warm`; computed OK / warn / error → `--mv-ok` / `--mv-warn` / `--mv-crit`.
3. Drop web fonts (the pages stay offline): mono → `var(--mv-mono)`; display/condensed → `var(--mv-voice)` +
   `font-stretch:75%`.
4. `border-radius` → 0 (dots excepted), `box-shadow` → none, decorative stripes → hairline grid on `html`.
5. Add a short "Mélyvíz skin" block at the end of the app style for what the mapping can't reach (cut corners on the
   main panels, focus glow, condensed titles).
6. Add the file to `TARGETS`, run the sync, then check **computed** styles in the browser (CLAUDE.md), not just a shot.
   Run the app's own tests if it has them.

## Phases

| Phase | Apps | State |
|---|---|---|
| P0 | `shared/melyviz.css`, `tools/melyviz-sync.js`, pilot `Calculator/led_arkalkulator.html` | **done 2026-10-27** |
| P1 | Calculator: `panel_anyagar_kalkulator.html`, `Altalanos_Villanyszerelui_Kalkulator.html` | **done 2026-10-27** — selected segments are an ice outline (no solid fills); the old amber "bad" check is `--mv-warn`; munkadíj keeps its own data hue `#a9b6ef` (not ice); the HTML export stays paper (its amber table header untouched) |
| P2 | MindMap `vrg_mindmap.html`: chrome only, node palette stays (palette ownership) | **done 2026-10-27** — a fifth theme `melyviz` in `THEMES` (the default for maps with no saved theme; `mv:true` puts `html.mv` on, so the chrome skin at the end of the style applies only in that theme). Bubbles, wires, kind colours and note bodies keep their shapes. The status bar stays sans (mono wrapped it to two lines); only its `kbd` caps are mono. Maps saved with another theme keep it until switched in ◐ Színvilág |
| P3 | Inventory (src → dist), `Modder/vrg-buildtree.html`, `vrg-vendor.html` | **done 2026-10-27** — **BuildTree** (the palette owner) gains `[data-theme="melyviz"]` with the MindMap's colours, first swatch and default; `setTheme` toggles `html.mv` and a chrome skin (outline buttons, ice washes instead of the hard-coded amber ones). **Inventory**: the block sits in `src/ui/theme.css`, `build/bundle.js` writes `class="mv"`; the OS light/dark switch is gone (one dark screen style, print stays paper); its red accent split into ice (selection, sorted, active) and `--crit` (danger, error, missing, price up); 201/201 tests. **Vendor**: amber → ice, priority 1 (rust) → warm. The old BuildTree copy in `BRIDGE/04_related-hardware` is left as it is |
| P4 | Kapu (`Hub/src` → dist), `toolbox.html` | **done 2026-10-27** — **Kapu** copies BuildTree's themes, so it gains the same `melyviz` palette (first swatch, default for a browser with no saved theme; `kpSetTheme` toggles `html.mv`), chrome in the new `Hub/src/css/20-melyviz.css`; 32/32 tests, `check-hub` Rendben. **toolbox.html**: same recipe as Vendor (amber → ice, snippet rust → warm). **Valena is out** (user, 2026-10-27): it is being merged into a new project |
| P5 | BRIDGE: `_tuner/bridge-tuner.html`, `09_catalogue/smarthome-db.html`, `09_catalogue/tools/viewer.html`, `04_related-hardware/espblok-builder*.html` (not `_source-variants`) | **done 2026-10-27** — **Tuner**: Mélyvíz is the default, ◐ still reaches the old light paper look (`data-theme="light"` drops `html.mv`, so the skin is scoped to it); the OS light/dark switch is gone; the picked option is an ice outline, "recommended" is warm. **Catalogue**: the block sits in the template `09_catalogue/tools/viewer.html`; `node BRIDGE/09_catalogue/tools/build.js` writes `smarthome-db.html` (one dark style, pro / con / ⚑ = ok / crit / warn). **ESPBLOK builders 1 + 2**: chrome only — board, copper, silk, rails, module, pin and protocol hues stay; Google Fonts dropped; selection is ice (builder 2's hard-coded amber selection outline in the script now reads `var(--accent)`); builder 2's old `--warn` was its green OK colour, so it maps to `--mv-ok` and the real warnings get `--mv-warn`. `smart_home_sensors.html` and the old BuildTree copy are left as they are |
| P6 | Planner `projects/varler-planner/src` chrome (largest; build + `npm test`) | **6a built 2026-10-28** (user: default on + toggle, two stages). The block is in `src/shell.html`, the skin at the end of its style, all under `html.mv`; ◐ in the ⚙ Megjelenés head and the ⌘K action `view.melyviz` turn it off and back (`05dd-chrome.js` `chrMv`, stored as `villanyterv_mv`). The stage keeps its paper ground; drawing, symbols, circuits and layer colours untouched; 3736 assertions green, 70 golden renders byte-identical. The rules / standards panels (injected `<style>`) are skinned from the shell; a short `[style*=…]` list catches the commonest inline light backgrounds, borders and dark text in the dark regions. **Light islands until 6b**: `#modal` (wall / plane editors and dialogs), the notes panel `.ntP` and the tray `#blTray` keep their light look with dark text pinned. **6b open**: turn the ~270 inline literals in 25 modules into variables, module by module, `npm test` after each |
| P7 | Workflow Kit `01_nv4_build/pipeline/nv4/web/internal.html` and other non-client review pages (outside the repo) | open |

Not touched: `Varler_Workflow_Kit/00_precursors/calculator/*` (archived precursors), the BRIDGE blueprints and
client pages, the firmware pages, Kódváros (it keeps its own `city.css`, which is the origin of these tokens).
