# WP-TV0: View shell

Status: todo · Wave A · Depends: none · Size: S (~90 lines) · Spec: next free · Decisions: Q-TV14

## Goal
*"I want a plugin for the Planner that can act as a Viewer mode."*

An empty overlay that opens, pans, zooms, switches tabs and closes. It writes nothing to the document.

## Read
- `00_CONTRACT.md` §1–§3
- `05c-actions.js` :21–25 (`registerAction`)
- `05db-layout.js` :25–45 (`PH_LIST`: phases `vill`, `paly`)
- `08od-wf-uptree.js` :130 (how the 🌳 overlay hooks `STK_OVERLAY`) and :162 (its action, the pattern to copy)
- `09-menus.js` :103 (`openModal`, styling only)
- STATE.md "Two bugs worth remembering" (`window.X` vs `typeof`)

## Build (`src/08tb-tpo-view.js`)
1. **The overlay** `#tpoView`:
   - created once and appended to `document.body`;
   - inside it: a toolbar, `#tpoLeft`, `<svg id="tpoSvg">` holding one `<g id="tpoRoot">`, `#tpoRight` and
     `#tpoChecks`. The layout is `fig/08`.
   - Hidden by default.
   - Its own `<style>` with CSS variables, a dark-mode block, and the Mélyvíz tokens (`shared/melyviz.css`) where the
     shell uses them.
2. **The state** `state.tpo = {open:false, tab:'path', level:null, cur:null, tool:null, z:1, px:0, py:0, speed:1,
   mirror:false}`, read with defaults.
   - `tpoOpen(level)` takes `state.active` and sets `UP.view = true`, so the blueprint's 🌳 overlay shows the same tree.
   - `tpoClose()` restores `UP.view` to what it was.
3. **Tabs** `Pályák · Betáp-fa · Csövek` → `state.tpo.tab` → `tpoRender()`. In TV0 each renders a placeholder.
4. **Pan and zoom:**
   - wheel = zoom about the cursor; drag on empty space = pan; `0` = fit.
   - Only `#tpoRoot`'s children are replaced, never the `<svg>` (ARCHITECTURE invariant).
5. **Keys:**
   - Esc ends the active tool first, then closes. Esc never discards.
   - No global key: `11c-wf-keys.js` is full; reuse it only if a key is free, and say so in the report.
6. **Hooks**, one guarded line each:
   - `registerActions([{id:'view.topology', label:'Topológia nézet', group:'Nézet', icon:'⌗', run:()=>tpoOpen()}])`;
   - `PH_LIST`: add `{a:'view.topology', n:'⌗ Topológia'}` to `vill` and `paly`;
   - `STK_DEVMENU`: `⌗ Topológia nézet` on the board.

## Tests
1. `tpoOpen()` shows the overlay and sets `UP.view`; `tpoClose()` restores it. `data` is deep-equal before and after.
2. The tab switch updates the state and the placeholder.
3. `actionById('view.topology').run()` opens the view.
4. Golden 70 / 70; check-globals OK.

**Browser:** open from the phase bar, pan, zoom, Esc. A screenshot.
