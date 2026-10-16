# WP-S2 — Menu engine (column, Back, paging, keys)

**Goal (user):** "four/five vertical icons that outline a classic (video game-like) menu points system … 5 vertical
buttons max, last one always Back, clicking on a menu point erases current menu buttons to show the sub menu with those
same buttons."

**Read:**
- design §2–§4 and §6 (motion classes only);
- 02_MENU-TREE §2's columns (Kind: tool / action / stay / submenu);
- `src/05c-actions.js:21-41`: `actionById`, `actionEnabled`, `actionCtx`, `runAction`.

## Node model (`src/11t-sm-menu.js`)

```js
// node:  {k, n, i?, items:[node|leaf]}  or  {k, n, i?, gen:'rules'|'endpoints'|'layers'|'projects'|'other'}
// leaf:  {a:'action.id', n?, i?, kind:'action'|'tool'|'stay'}  or  {fn:()=>{}, n, i?, kind, line2?}  (generator-only)
let SM_TREE={k:'root',n:'Menü',items:[]};        // S3 fills it; tests use smUseTree(t)
const SM_GEN={};                                  // S3 registers generators: SM_GEN.rules=()=>[...]
```

## Build

1. **`smUseTree(t)`** sets `SM_TREE=t` (test hook) and resets the stack.
2. **`smChildren(node)`** returns `node.items`, or `SM_GEN[node.gen]()` wrapped in try/catch: on a throw it returns
   `[{n:'Hiba: <msg>', kind:'action', disabled:true}]`.
3. **`smPage(list,page)`** — the paging rule:
   - if `list.length≤4`, there is one page with everything;
   - otherwise pages hold 3 items + `TOVÁBB` **while more than 4 remain**, and the last page holds the rest (≤4).
   - It returns `{items, pages, page}`.
   - Examples:
     - 5 → [3+T, 2];
     - 6 → [3+T, 3];
     - 8 → [3+T, 3+T, 2];
     - 10 → [3+T, 3+T, 4].
4. **`smView()`** builds the current column:
   - top: `SM.stack` (an array of `{node, page, focus}`; the root is `stack[0]`);
   - the slot list = the page items + the Back item (`◂ Vissza`, or `✕ Bezár` when `stack.length===1` and page 0;
     page>0 → Back to the previous page);
   - each slot is `{kind, n, i, a?, sub?, disabled, line2}`;
   - for a leaf with `a`: label = `leaf.n||action.label`, icon = `leaf.i||action.icon||'•'`,
     `disabled=!actionEnabled(action,actionCtx())`, `line2` = disabled ? (action.need||'nem elérhető most') : '';
   - a missing action → disabled, with `line2:'hiányzó parancs: <id>'` (makes S3's coverage failures visible on
     screen too).
5. **`smRender()`** builds the HTML string for `#smMenu`:
   - the breadcrumb line: `Menü / Villamosság / Kapcsolás`, plus ` (2/3)` when paged;
   - then the slots as `<button class="smI" data-s="N" role="menuitem">`, with index `01`–`05`, the icon, the label, and
     a chevron for `sub`, `↺` for stay, `›` for TOVÁBB;
   - `aria-disabled` and `.dis` when disabled;
   - `.foc` on the focused slot.

   Write it only when the string changed. Bind the handlers once, by delegation on `#smMenu`.
6. **`smOpen(mode)`** (`'browse'` now; S4 adds `'search'`): `SM.open=true; SM.stack=[{node:SM_TREE,page:0,focus:0}]`,
   then render and `smDialDraw()`. **`smClose()`**, and **`smToggle()`** (replaces S1's body).
7. **`smActivate(slot)`**:
   - **disabled** → return false (stay open);
   - **sub** → push `{node,page:0,focus:0}`;
   - **TOVÁBB** → `page++`, focus 0;
   - **Back** → `page>0 ? page-- (focus on the TOVÁBB slot = 3) : stack.length>1 ? pop : smClose()`;
   - **leaf:**
     - `kind==='stay'` → run, re-render and stay;
     - otherwise `smClose()` and then run.

     Run means `runAction(a)`, or `leaf.fn()`.

   Return true when something happened.
8. **Keys:** a `keydown` listener **with capture** on `document`, active only when `smOn()&&SM.open`.
   - ↑ / ↓ move focus, wrapping;
   - Enter / → activate;
   - ← / Backspace / Esc → Back;
   - `1`–`5` activate that slot;
   - every handled key gets `preventDefault()` + `stopImmediatePropagation()`;
   - `mod+` combos **other than** `mod+k` pass through (Ctrl+Z still undoes).
9. **Mouse:**
   - hovering a slot sets focus (re-render);
   - clicking activates;
   - a `pointerdown` on `#stage` (capture) while open → `smClose()`, stop the event, consume the click.
10. **Motion hooks** (classes only; S6 styles them):
    - on replace, add `sm-out` to the old buttons, then render the new ones with `sm-in` and
      `style="--d:<index>"`, removing `sm-in` after 200 ms;
    - with `matchMedia('(prefers-reduced-motion: reduce)')` matching, skip both;
    - a new replace while one is running cancels it (keep one timer id in `SM.anim`).

## Tests — `tests/spec-s2-sm-menu.js` (fixture tree, not the real one)

Fixture:
- root items:
  - `A` (sub): 6 leaves `a1`…`a6` with action ids `t.a1`…`t.a6`; register test actions that count runs;
  - `B` (sub): `b1` (stay, `t.b1`), `b2` (action, `t.b2`), `b3` (action `t.off`, whose `when:()=>false` and
    `need:'Előbb jelölj ki'`);
  - `C` (leaf action `t.c`);
  - `D` (sub `gen:'boom'`, where `SM_GEN.boom` throws).

1. `smOpen()`:
   - 5 slots: A, B, C, D, `Bezár`;
   - the breadcrumb is `Menü`;
   - no render ever has more than 5 `.smI` (check after every step below).
2. `2` → B's level; the breadcrumb is `Menü / B`; the last slot is `Vissza`.
3. Activate `b3` → returns false; still open; slot 3's line2 is `Előbb jelölj ki`.
4. Activate `b1` (stay) → the `t.b1` counter is 1, still open at B.
5. Activate `b2` → the `t.b2` counter is 1, closed.
6. Open → A:
   - page 1 = `a1 a2 a3 Tovább Vissza`, breadcrumb `Menü / A (1/2)`;
   - Tovább → page 2 = `a4 a5 a6 Vissza`;
   - Back → page 1, with focus on slot 4 (Tovább);
   - Back → root;
   - Esc → closed.
7. `smPage` on 5, 6, 8 and 10 items gives page sizes [3,2], [3,3], [3,3,2] and [3,3,4].
8. D → a single disabled slot whose text starts `Hiba:`, plus Vissza. Opening it didn't throw.
9. Keys while open:
   - `ArrowDown` ×5 from slot 1 wraps to slot 1;
   - `Escape` does not reach the app (the app's Esc handler counter stays 0; add a bubbling listener that counts);
   - `Ctrl+Z` passes through (the bubbling counter goes up).
10. A `pointerdown` on `#stage` while open → closed, and `__getSel()` unchanged.
11. A missing action id in a leaf → disabled with `hiányzó parancs: x.y`.

## Out of scope

The real tree (S3), search (S4), the look (S6).
