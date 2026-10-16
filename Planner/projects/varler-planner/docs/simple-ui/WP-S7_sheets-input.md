# WP-S7 — Sheets, gamepad, touch ⏸

**Goal:** a few features *are* tables or palettes (Szabványok, the Szabályok list, the notes panel). In simple mode
they open as one **sheet** on the right and close back to the empty canvas. The menu must also work with the Xbox
controller the user already drives the Planner with, and with touch.

**Read:**
- contract §1 (the 08b hook allowance), §2.2;
- `src/08j-wf-standards.js:160-170` (`stdPanel`, `#stdPanel`);
- `src/08i-wf-rules.js:110-127` (`rbPanel`, `#rbPanel`);
- `src/08b-gamepad.js:323` (`wheelOpen`), `:543` (A), `:560` (Y);
- `src/08-interaction.js:790-800` (the `PLANNER_INPUT` key verbs: `escape`, `finish` …).

## Build

1. **Sheet table** (`11u`):
   ```js
   SM_SHEETS={'wf.standards':{el:'stdPanel',close:()=>stdPanel(false)},
              'wf.rules':{el:'rbPanel',close:()=>rbPanel(false)}}
   ```
   After `runAction(id)` from the menu or from search, when `SM_SHEETS[id]` exists:
   - set `data-sheet` and class `sm-open` on the element;
   - add a `◂ Vissza` button (`.smSheetBack`) at its top, once;
   - CSS: `body.ui-simple [data-sheet].sm-open{display:block!important; position:fixed; top:16px; right:16px; bottom:16px; left:auto; width:360px}`,
     with the S6 glass and bevel around it.

   The Back button, or Esc while the sheet is focused, → `close()` + remove `sm-open`.

   **Also:** a panel opened by any other route while in simple mode, such as the Szabványok ＋ path, gets the same
   treatment. A MutationObserver on each listed element's `style` attribute applies `sm-open` when it becomes visible.
2. **Gamepad** (the only edit outside the owned files: up to 3 guarded lines in `08b-gamepad.js`):
   - **Y** (`wheelOpen` call site, :560): in simple mode, `smToggle()` instead of the wheel;
   - **A** (:543): in simple mode with the menu open, `smActivate(SM.focus)` instead of the pointer press;
   - **B**: check whether B already sends `escape()` (the key verb). If it does, no edit is needed: Esc reaches S2's
     capture handler.

   **The D-pad is the arrow keys** (08b header comment), so ↑ / ↓ already work.
3. **Touch:**
   - tap the dial = toggle;
   - tap an item = activate (pointerup, not click, so there is no 300 ms delay);
   - long-press the dial (600 ms) = Back one level when the menu is open;
   - in `body.mobile.ui-simple`, the mobile bar is hidden (it is a `.stage-wrap` child) — that is intended. Undo is in
     Eszközök.

## Tests — `tests/spec-s7-sm-sheets.js`

1. Simple mode → menu Épület › Szabályok › Szabványok →
   - `#stdPanel` has `data-sheet` and `sm-open`;
   - its computed `display` is not `none`;
   - `.smSheetBack` exists.
2. Click `.smSheetBack` → `stdPanel` is closed (its own state) and `sm-open` is gone.
3. `stdPanel(true)` called directly (not from the menu) in simple mode → `sm-open` is applied (after the observer flush).
4. In normal mode, `stdPanel(true)` → no `sm-open`, no `data-sheet` (the normal look is untouched).
5. A gamepad-style `keydown ArrowDown` / `Enter` / `Escape` dispatched on `document` drives the menu (S2's handler).
   This proves the D-pad and B path without hardware.
6. A long-press on the dial (pointerdown, then fake clock +600 ms, then pointerup) at depth 2 → depth 1.

## ⏸ Hardware check

With the user's Xbox controller and, if available, a touch screen:
- Y opens the menu;
- D-pad moves;
- A activates;
- B goes back;
- a tap works;
- a long-press goes back.

Report what the user saw. Don't tune any timing without them.

## Out of scope

Restyling the modal dialogs (SUI-Q S10).
