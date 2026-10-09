# WP-U5 — Panels: resize the rail and the inspector; Tab = wide work mode

Status: todo · Wave U · Depends: U4 (Tab freed) · Size: S/M (~110 lines) · Spec: 62 · Decision: Q-U05

## Goal
*"Make the two info panels next to the sidebars also adjustable with hold and drag. Make it so that
clicking TAB hides the two sidebars and the info panels, another click opens them back (for full-wide
screen work)."*

"The two info panels" = **`#stageRail`** (left, the stage list, 104 px) and **`#inspector`** (right,
238 px) — both absolutely positioned overlays inside `.stage-wrap` (`src/shell.html` lines 70, 90;
filled by `05d-shell.js` `renderShell`). The sidebars `.side` / `.side.r` already have `.resizer`
handles (`12-boot.js` ≈ line 381, clamp 150–460 px).

## Build
1. **Resize handles** — `05d-shell.js`:
   - a 6 px `<div class="pnlGrip" data-p="rail">` on the rail's right edge and `data-p="insp"` on the
     inspector's left edge, created once in `renderShell` (not inside the cached `railHtml` — it would
     be destroyed on every repaint);
   - pointerdown → `setPointerCapture`, pointermove → `state.railW = clamp(80, 260, w)` /
     `state.inspW = clamp(200, 520, w)`, apply `style.width`; pointerup → `renderShell()`;
   - double-click a grip → back to the default width;
   - CSS in `shell.html` next to `.resizer`: same colours, `cursor:col-resize`, `position:absolute;
     top:0; bottom:0`.
   - Everything that assumes the fixed widths: `RAIL_MIN` / `INSP_MIN` (05d line ≈ 91) — make them
     `railW + 226` / `inspW + 282` so the thresholds move with the panels; `modeHint` left offset
     (`'116px'` in `renderShell`) → `(railW + 12) + 'px'`; the inspector's `width:238px` CSS → set
     inline from `state.inspW`. Grep `104` and `238` in `src/` for any other hard-coded copy.
2. **Wide work mode — Tab**, `pnlWide()` in 05d:
   - on: remember `{l: leftHidden, r: rightHidden, rail: shellOn() && railShown, insp: …}` in
     `state.wideWork`, then hide `.side`, `.side.r` (the existing `.hide` class, as `bPanels` does in
     `11-controls.js` line 94), the rail and the inspector (`state.shell=false` is the existing
     switch — but restore must not lose a user's own "Elrejt" choice, hence the snapshot);
   - off: restore exactly the snapshot, then `state.wideWork=null`; re-sync the `hideL` / `hideR`
     arrows and the `bPanels` label;
   - after either: `window.dispatchEvent(new Event('resize'))` is NOT needed — call `setTransform()`
     and `renderShell()`; the stage keeps its centre (compute the plan point at the stage centre
     before, pan so it stays there after — the user is mid-work).
   - Key: plain Tab (no modifiers), ignored when the focus is in INPUT / SELECT / TEXTAREA, when a
     modal is open (`modalBg.style.display==='flex'`) or an editor is open (`edCur()`), and when the
     palette is open. `e.preventDefault()` so the browser does not move focus.
   - Register `view.wide` (`Széles munkanézet (Tab)`, group Nézet, `keys:['tab']`) — check
     `actionKeyString` produces `'tab'` for the Tab key; if the registry cannot express it, keep the
     handler in 08 and register the action without `keys`, documenting Tab in the help dialog.
   - The `⤢ Full view` toolbar button keeps its sidebars-only meaning (Q-U05=A) — or becomes the same
     as Tab (Q-U05=B).
3. Help row: `['Tab','széles munkanézet: oldalsávok és panelek el / vissza']` (MATERIAL §1).

## Tests — `tests/spec-62-panels.js`
jsdom has no layout: assert state and styles, not pixels.
1. Simulated grip drag +60 px on the rail → `state.railW===164`, `$('stageRail').style.width==='164px'`.
2. Clamp: +500 → 260; inspector −400 → 200; double-click → 238.
3. Tab → both `.side` have `.hide`, rail and inspector `display:none`, `state.wideWork` set; Tab again
   → everything back as it was, including a left sidebar the user had hidden before (stays hidden).
4. Tab with focus in an `<input>` → no change.
5. Tab while the RBX tool is active → panels toggle, `HW_T.rb` unchanged (U4 moved it to arrows).

## Browser (owed)
1600 × 950 viewport: drag both grips, Tab, Tab — screenshot both states.
