# WP-T0: Seam (the view shell)

Status: todo · Wave A · Depends: none · Size: S (~90 lines) · Spec: next free · Decisions: Q-T14

## Goal
*"I want a plugin for the Planner that can act as a Viewer mode."*

This WP makes an empty, working overlay that opens, pans, zooms, switches tabs and closes. Nothing is drawn in it yet.

## Read
- `00_CONTRACT.md` §1–§2
- `05c-actions.js` 21–25 (`registerAction`) and 170 (an example list)
- `05db-layout.js` 25–45 (`PH_LIST`: the Villamosság and Pályák phases)
- `09-menus.js` 103 (`openModal`, for its styling only)
- `shell.html`: grep `id="hud"` to find where an overlay `<div>` sits beside the canvas
- STATE.md "Two bugs worth remembering" (`window.X` vs `typeof`)

## Build (`src/08pb-tpo-view.js`)
1. **The overlay.**
   - `#tpoView` (created once, appended to `document.body`): a toolbar, a left panel (`#tpoLeft`), the canvas
     `<svg id="tpoSvg">` with one `<g id="tpoRoot">`, a right inspector (`#tpoRight`) and a checks bar (`#tpoChecks`).
     The layout is `fig/08`.
   - Hidden by default.
   - Colours come from CSS variables in the overlay's own `<style>`, with a dark-mode block.
2. **The state.**
   - `state.tpo = {open:false, tab:'path', level:null, cur:null, tool:null, z:1, px:0, py:0, speed:1}`, read with defaults.
   - `tpoOpen(level)` and `tpoClose()`. Opening takes `state.active` as the level.
3. **Tabs** `Pályák | Kapcsolatok | Csövek` → `state.tpo.tab`, then `tpoRender()`. In T0 it renders a placeholder text
   per tab.
4. **Pan and zoom** on `#tpoSvg`:
   - wheel = zoom about the cursor; drag on empty space = pan; `0` = fit.
   - Never replace the `<svg>` element itself, only `#tpoRoot`'s children (ARCHITECTURE invariant).
5. **Keys.**
   - `Esc` closes the view, unless a tool is active (then it ends the tool). Esc never discards.
   - `T` toggles the view (only while `typeof tpoOpen === 'function'`; check `11c-wf-keys.js` for a free key, otherwise
     use no key and report).
6. **Hooks** (one line each, guarded):
   - `registerActions([{id:'view.topology', label:'Topológia nézet', group:'Nézet', icon:'⌗', run:()=>tpoOpen()}])`;
   - `PH_LIST`: add `{a:'view.topology', n:'⌗ Topológia'}` to the `vill` and `paly` tool lists;
   - the board's device menu (`STK_DEVMENU`): `⌗ Topológia nézet`.

## Tests
1. `tpoOpen()` sets `state.tpo.open` and shows `#tpoView`. `tpoClose()` hides it. Neither changes `data` (deep-equal
   before and after).
2. The tab switch updates `state.tpo.tab` and the placeholder text.
3. The action `view.topology` exists. `actionById('view.topology').run()` opens the view.
4. Golden 70/70 identical; check-globals OK.

**Browser:** open it from the phase bar, pan, zoom, Esc. Screenshot.
